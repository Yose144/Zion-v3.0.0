use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use tokio::time::Instant;

use crate::config::RateLimitConfig;

#[derive(Clone)]
pub struct IpRateLimiter {
    config: RateLimitConfig,
    history: Arc<Mutex<HashMap<IpAddr, VecDeque<Instant>>>>,
}

impl IpRateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            history: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn allow(&self, ip: IpAddr) -> bool {
        // Local loopback is always trusted; rate limiting is for remote
        // reconnect storms, not for co-located miners/services.
        if ip.is_loopback() {
            return true;
        }

        let now = Instant::now();
        let mut history = self.history.lock().unwrap();
        let attempts = history.entry(ip).or_default();

        while let Some(front) = attempts.front() {
            match now.checked_duration_since(*front) {
                Some(elapsed) if elapsed > self.config.window => {
                    attempts.pop_front();
                }
                _ => break,
            }
        }

        attempts.push_back(now);
        attempts.len() <= self.config.max_reconnects_per_minute as usize
    }
}

/// Token-bucket rate limiter for share submissions.
///
/// Refills at `capacity` tokens per second.  A share is allowed only if a token
/// is available; otherwise the share is throttled.
#[derive(Debug, Clone)]
pub struct ShareRateLimiter {
    tokens: f64,
    capacity: f64,
    refill_per_sec: f64,
    last_refill: Instant,
}

impl ShareRateLimiter {
    pub fn new(per_sec: f64) -> Self {
        let capacity = per_sec.max(1.0);
        Self {
            tokens: capacity,
            capacity,
            refill_per_sec: per_sec,
            last_refill: Instant::now(),
        }
    }

    /// Returns true if the share is allowed (a token is consumed), false if
    /// throttled.
    pub fn allow(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_per_sec).min(self.capacity);
        self.last_refill = now;
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}
