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
        let now = Instant::now();
        let mut history = self.history.lock().unwrap();
        let attempts = history.entry(ip).or_insert_with(VecDeque::new);

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
