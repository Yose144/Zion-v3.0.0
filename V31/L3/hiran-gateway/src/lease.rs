//! Short-lived agent leases for remote `code.run` metering.
//!
//! CLI mints a lease with `zis_*`, passes `lease_token` in enqueue args
//! (never the long-lived user key). Rig presents the lease as Bearer on
//! gateway chat; usage meters against the original key_hash.

use crate::{
    auth::VerifiedKey,
    error::{ApiError, ApiResult},
    meter::Plan,
};
use rand::RngCore;
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

pub const LEASE_PREFIX: &str = "hiran_lease_";
const DEFAULT_TTL_SECS: u64 = 15 * 60;
const MAX_TTL_SECS: u64 = 60 * 60;
const DEFAULT_MAX_TURNS: u32 = 8;
const HARD_MAX_TURNS: u32 = 16;

struct LeaseEntry {
    key_hash: String,
    user_id: String,
    plan: Plan,
    expires: Instant,
    max_turns: u32,
    used: u32,
}

pub struct LeaseStore {
    inner: Mutex<HashMap<String, LeaseEntry>>,
}

impl LeaseStore {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn mint(
        &self,
        vk: &VerifiedKey,
        ttl_secs: Option<u64>,
        max_turns: Option<u32>,
    ) -> (String, u64, u32) {
        self.gc();
        let ttl = ttl_secs
            .unwrap_or(DEFAULT_TTL_SECS)
            .clamp(60, MAX_TTL_SECS);
        let turns = max_turns
            .unwrap_or(DEFAULT_MAX_TURNS)
            .clamp(1, HARD_MAX_TURNS);
        let mut raw = [0u8; 24];
        rand::thread_rng().fill_bytes(&mut raw);
        let token = format!("{LEASE_PREFIX}{}", hex::encode(raw));
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        g.insert(
            token.clone(),
            LeaseEntry {
                key_hash: vk.key_hash.clone(),
                user_id: vk.user_id.clone(),
                plan: vk.plan,
                expires: Instant::now() + Duration::from_secs(ttl),
                max_turns: turns,
                used: 0,
            },
        );
        (token, ttl, turns)
    }

    /// Resolve lease Bearer and consume one chat turn.
    pub fn consume(&self, token: &str) -> ApiResult<VerifiedKey> {
        if !token.starts_with(LEASE_PREFIX) {
            return Err(ApiError::unauthorized("not a lease token"));
        }
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let entry = g
            .get_mut(token)
            .ok_or_else(|| ApiError::unauthorized("unknown or expired lease"))?;
        if Instant::now() > entry.expires {
            g.remove(token);
            return Err(ApiError::unauthorized("lease expired"));
        }
        if entry.used >= entry.max_turns {
            return Err(ApiError::overloaded("lease turn budget exhausted"));
        }
        entry.used += 1;
        Ok(VerifiedKey {
            key_hash: entry.key_hash.clone(),
            user_id: entry.user_id.clone(),
            plan: entry.plan,
        })
    }

    fn gc(&self) {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();
        g.retain(|_, e| e.expires > now);
    }
}

impl Default for LeaseStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::meter::Plan;

    fn vk() -> VerifiedKey {
        VerifiedKey {
            key_hash: "abc".into(),
            user_id: "u1".into(),
            plan: Plan::Free,
        }
    }

    #[test]
    fn mint_and_consume() {
        let store = LeaseStore::new();
        let (tok, ttl, turns) = store.mint(&vk(), Some(120), Some(2));
        assert!(tok.starts_with(LEASE_PREFIX));
        assert_eq!(ttl, 120);
        assert_eq!(turns, 2);
        assert!(store.consume(&tok).is_ok());
        assert!(store.consume(&tok).is_ok());
        assert!(store.consume(&tok).is_err());
    }

    #[test]
    fn reject_non_lease() {
        let store = LeaseStore::new();
        assert!(store.consume("zis_nope").is_err());
    }
}
