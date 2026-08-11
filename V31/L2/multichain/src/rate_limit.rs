//! Basic token-bucket rate limiter and API-key auth middleware for the
//! multichain HTTP gateway.
//!
//! Alpha scope: per-IP token bucket with configurable refill rate and burst,
//! plus optional `Authorization: Bearer <api_key>` guard. Health endpoint is
//! excluded from auth/rate-limit so load balancers can probe freely.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Instant;

use axum::body::Body;
use axum::extract::{ConnectInfo, State};
use axum::http::{Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use tokio::sync::Mutex;
use tower::{Layer, Service};

use crate::config::ServerConfig;

/// Per-IP token bucket.
#[derive(Clone, Debug)]
pub struct TokenBucket {
    tokens: f64,
    last_update: Instant,
    rate: f64,
    burst: f64,
}

impl TokenBucket {
    pub fn new(rate: f64, burst: f64) -> Self {
        Self {
            tokens: burst,
            last_update: Instant::now(),
            rate,
            burst,
        }
    }

    /// Try to consume one token. Returns false if the bucket is empty.
    pub fn try_consume(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_update).as_secs_f64();
        self.last_update = now;
        self.tokens = (self.tokens + elapsed * self.rate).min(self.burst);
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// In-memory per-IP rate limiter.
#[derive(Clone)]
pub struct RateLimiter {
    buckets: Arc<Mutex<HashMap<SocketAddr, TokenBucket>>>,
    rate: f64,
    burst: f64,
    api_key: Option<String>,
}

impl RateLimiter {
    pub fn new(config: &ServerConfig) -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            rate: config.rate_limit.requests_per_second,
            burst: f64::from(config.rate_limit.burst),
            api_key: config.auth.api_key.clone(),
        }
    }

    /// Check (and record) a request from `addr`. Returns `true` if allowed.
    pub async fn check(&self, addr: SocketAddr) -> bool {
        let mut buckets = self.buckets.lock().await;
        let bucket = buckets
            .entry(addr)
            .or_insert_with(|| TokenBucket::new(self.rate, self.burst));
        bucket.try_consume()
    }

    /// Returns the configured API key, if any.
    pub fn api_key(&self) -> Option<&str> {
        self.api_key.as_deref()
    }
}

/// Tower/Axum middleware that enforces API key auth and per-IP rate limits.
pub async fn auth_rate_limit(
    State(limiter): State<RateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = req.uri().path();

    // Health endpoint is always public and unthrottled.
    if path == "/health" || path == "/v1/multichain/health" {
        return Ok(next.run(req).await);
    }

    // Optional API key auth only for mutating requests.
    let is_read = matches!(
        req.method(),
        &Method::GET | &Method::HEAD | &Method::OPTIONS
    );
    if !is_read {
        if let Some(expected) = limiter.api_key() {
            let header = req
                .headers()
                .get("authorization")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("");
            let provided = header
                .strip_prefix("Bearer ")
                .or_else(|| header.strip_prefix("bearer "))
                .unwrap_or(header)
                .trim();
            if provided != expected {
                return Err(StatusCode::UNAUTHORIZED);
            }
        }
    }

    // Per-IP token bucket.
    if !limiter.check(addr).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(req).await)
}

/// Tower layer wrapping `RateLimiter` middleware.
#[derive(Clone)]
pub struct RateLimitLayer {
    limiter: RateLimiter,
}

impl RateLimitLayer {
    pub fn new(limiter: RateLimiter) -> Self {
        Self { limiter }
    }
}

impl<S> Layer<S> for RateLimitLayer {
    type Service = RateLimitService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RateLimitService {
            inner,
            limiter: self.limiter.clone(),
        }
    }
}

/// Tower service wrapping `RateLimiter` middleware.
#[derive(Clone)]
pub struct RateLimitService<S> {
    inner: S,
    limiter: RateLimiter,
}

impl<S> Service<Request<Body>> for RateLimitService<S>
where
    S: Service<Request<Body>, Response = Response> + Send + Sync + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = S::Future;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: Request<Body>) -> Self::Future {
        req.extensions_mut().insert(self.limiter.clone());
        self.inner.call(req)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_bucket_allows_burst_then_refills() {
        let mut bucket = TokenBucket::new(1000.0, 3.0);
        assert!(bucket.try_consume());
        assert!(bucket.try_consume());
        assert!(bucket.try_consume());
        // Burst exhausted.
        assert!(!bucket.try_consume());
    }

    #[tokio::test]
    async fn rate_limiter_tracks_per_ip() {
        let config = ServerConfig::default();
        let limiter = RateLimiter::new(&config);
        let addr: SocketAddr = "127.0.0.1:1234".parse().unwrap();

        // Default config: burst=100, so many requests pass.
        for _ in 0..50 {
            assert!(limiter.check(addr).await);
        }
    }
}
