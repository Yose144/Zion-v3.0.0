//! X-API-Key auth via ZIS `/api/keys/verify` + in-memory plan cache +
//! per-key rate limiting (rpm + daily token quota per plan tier).

use crate::{
    error::{ApiError, ApiResult},
    meter::{key_hash, Meter, Plan},
};
use axum::http::HeaderMap;
use serde::Deserialize;
use std::{
    collections::{HashMap, VecDeque},
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Debug, Clone)]
pub struct VerifiedKey {
    pub key_hash: String,
    pub user_id: String,
    pub plan: Plan,
}

#[derive(Deserialize)]
struct VerifyResponse {
    valid: bool,
    user: Option<VerifyUser>,
}

#[derive(Deserialize)]
struct VerifyUser {
    id: String,
}

struct CacheEntry {
    user_id: String,
    at: Instant,
}

pub struct Auth {
    client: reqwest::Client,
    verify_url: String,
    ttl: Duration,
    cache: Mutex<HashMap<String, CacheEntry>>,
    /// Per-key sliding window of request timestamps (rpm enforcement).
    windows: Mutex<HashMap<String, VecDeque<Instant>>>,
}

impl Auth {
    pub fn new(verify_url: &str, ttl_secs: u64) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_default();
        Self {
            client,
            verify_url: verify_url.to_string(),
            ttl: Duration::from_secs(ttl_secs),
            cache: Mutex::new(HashMap::new()),
            windows: Mutex::new(HashMap::new()),
        }
    }

    /// Extract the API key from `X-API-Key` or `Authorization: Bearer`.
    pub fn extract_key(headers: &HeaderMap) -> ApiResult<String> {
        if let Some(v) = headers.get("x-api-key").and_then(|v| v.to_str().ok()) {
            let k = v.trim();
            if !k.is_empty() {
                return Ok(k.to_string());
            }
        }
        if let Some(v) = headers.get("authorization").and_then(|v| v.to_str().ok()) {
            if let Some(rest) = v.strip_prefix("Bearer ") {
                let k = rest.trim();
                if !k.is_empty() {
                    return Ok(k.to_string());
                }
            }
        }
        Err(ApiError::unauthorized(
            "Missing API key — send X-API-Key or Authorization: Bearer",
        ))
    }

    /// Verify key against ZIS (60s-positive cache), resolve plan tier.
    pub async fn verify(&self, key: &str, meter: &Meter) -> ApiResult<VerifiedKey> {
        let kh = key_hash(key);

        if let Some(user_id) = self.cached_user(&kh) {
            return Ok(VerifiedKey {
                key_hash: kh,
                plan: meter.get_plan(&key_hash(key)),
                user_id,
            });
        }

        let resp = self
            .client
            .post(&self.verify_url)
            .json(&serde_json::json!({ "apiKey": key }))
            .send()
            .await
            .map_err(|e| {
                tracing::warn!(error = %e, "ZIS verify transport failed");
                ApiError::server("auth backend unreachable")
            })?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ApiError::unauthorized("Invalid API key"));
        }
        if !resp.status().is_success() {
            tracing::warn!(status = %resp.status(), "ZIS verify unexpected status");
            return Err(ApiError::server("auth backend error"));
        }
        let vr: VerifyResponse = resp.json().await.map_err(|_| {
            ApiError::server("auth backend malformed response")
        })?;
        let user = vr
            .user
            .filter(|_| vr.valid)
            .ok_or_else(|| ApiError::unauthorized("Invalid API key"))?;

        self.cache.lock().unwrap().insert(
            kh.clone(),
            CacheEntry { user_id: user.id.clone(), at: Instant::now() },
        );
        Ok(VerifiedKey {
            plan: meter.get_plan(&kh),
            key_hash: kh,
            user_id: user.id,
        })
    }

    fn cached_user(&self, kh: &str) -> Option<String> {
        let cache = self.cache.lock().unwrap();
        let e = cache.get(kh)?;
        if e.at.elapsed() < self.ttl {
            Some(e.user_id.clone())
        } else {
            None
        }
    }

    /// Sliding-window rpm + persisted daily-token quota.
    /// Returns Err(429) with OpenAI shape when exceeded.
    pub fn check_limits(&self, vk: &VerifiedKey, meter: &Meter) -> ApiResult<()> {
        let (rpm, tok_per_day) = vk.plan.limits();

        let mut windows = self.windows.lock().unwrap();
        let w = windows.entry(vk.key_hash.clone()).or_default();
        let cutoff = Instant::now() - Duration::from_secs(60);
        while w.front().is_some_and(|t| *t < cutoff) {
            w.pop_front();
        }
        if w.len() as u32 >= rpm {
            return Err(ApiError::rate_limited(format!(
                "rate limit: {} req/min on {} plan",
                rpm,
                vk.plan.as_str()
            )));
        }
        w.push_back(Instant::now());
        drop(windows);

        let used = meter.tokens_today(&vk.key_hash);
        if used >= tok_per_day {
            return Err(ApiError::rate_limited(format!(
                "daily token quota exhausted on {} plan ({} used)",
                vk.plan.as_str(),
                used
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn extract_key_header_paths() {
        let mut h = HeaderMap::new();
        h.insert("x-api-key", HeaderValue::from_static("zis_aaa"));
        assert_eq!(Auth::extract_key(&h).unwrap(), "zis_aaa");
        let mut h2 = HeaderMap::new();
        h2.insert(
            "authorization",
            HeaderValue::from_static("Bearer zis_bbb"),
        );
        assert_eq!(Auth::extract_key(&h2).unwrap(), "zis_bbb");
        assert!(Auth::extract_key(&HeaderMap::new()).is_err());
    }

    #[test]
    fn rpm_window_limits() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let meter = Meter::open(tmp.path().to_str().unwrap()).unwrap();
        let auth = Auth::new("http://127.0.0.1:1/verify", 60);
        let vk = VerifiedKey {
            key_hash: key_hash("k"),
            user_id: "u".into(),
            plan: Plan::Free,
        };
        for _ in 0..20 {
            auth.check_limits(&vk, &meter).unwrap();
        }
        assert!(auth.check_limits(&vk, &meter).is_err());
    }
}
