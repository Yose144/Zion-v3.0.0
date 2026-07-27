use std::sync::atomic::{AtomicU64, Ordering};

use zion_cosmic_harmony::ExternalCoin;
use zion_l1_types::{Address, Amount};

use crate::config::PoolConfig;
use crate::pplns::{Payout, PplnsState, ShareRecord};
use crate::share::ShareSubmission;
use crate::validator::ShareValidator;

#[derive(Clone, Copy, Debug, thiserror::Error)]
pub enum PoolError {
    #[error("nonce parse error")]
    Parse,
    #[error("invalid share")]
    Invalid,
    #[error("unknown job")]
    UnknownJob,
    #[error("unauthorized worker")]
    Unauthorized,
}

#[derive(Debug)]
pub struct Pool {
    pub config: PoolConfig,
    pub pplns: PplnsState,
    pub validator: ShareValidator,
    pub current_job_id: AtomicU64,
    pub accepted: AtomicU64,
    pub rejected: AtomicU64,
}

impl Pool {
    pub fn new(config: PoolConfig) -> Self {
        let mut pplns = PplnsState::new(config.pplns_window_shares);
        pplns.set_fee_bps(config.pool_fee_bps);
        Self {
            config,
            pplns,
            validator: ShareValidator::new(),
            current_job_id: AtomicU64::new(1),
            accepted: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
        }
    }

    pub fn next_job_id(&self) -> u64 {
        self.current_job_id.fetch_add(1, Ordering::Relaxed) + 1
    }

    fn parse_nonce(nonce_hex: &str) -> Result<u64, PoolError> {
        let s = nonce_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        u64::from_str_radix(s, 16).map_err(|_| PoolError::Parse)
    }

    fn record_share(&mut self, worker: &str, _value: u64) {
        let value = 1u64;
        let record = ShareRecord {
            worker: worker.to_string(),
            address: self.config.pool_address.clone(),
            value,
            timestamp: chrono::Utc::now(),
        };
        self.pplns.add_share(record);
    }

    pub fn submit_zion(
        &mut self,
        submission: ShareSubmission,
        header: &[u8],
    ) -> Result<bool, PoolError> {
        let nonce = Self::parse_nonce(&submission.nonce_hex)?;
        if self
            .validator
            .validate_zion(header, nonce, &self.config.zion_target)
        {
            self.record_share(&submission.worker, 1);
            self.accepted.fetch_add(1, Ordering::Relaxed);
            Ok(true)
        } else {
            self.rejected.fetch_add(1, Ordering::Relaxed);
            Err(PoolError::Invalid)
        }
    }

    pub fn submit_auxpow(
        &mut self,
        coin: ExternalCoin,
        submission: ShareSubmission,
        header: &[u8],
    ) -> Result<bool, PoolError> {
        let nonce = Self::parse_nonce(&submission.nonce_hex)?;
        if self
            .validator
            .validate_auxpow(coin, header, nonce, &self.config.auxpow_target)
        {
            self.record_share(&submission.worker, 1);
            self.accepted.fetch_add(1, Ordering::Relaxed);
            Ok(true)
        } else {
            self.rejected.fetch_add(1, Ordering::Relaxed);
            Err(PoolError::Invalid)
        }
    }

    pub fn payouts(&self, block_reward: Amount) -> Vec<Payout> {
        self.pplns.payouts_for(block_reward)
    }

    pub fn stats(&self) -> (u64, u64) {
        (
            self.accepted.load(Ordering::Relaxed),
            self.rejected.load(Ordering::Relaxed),
        )
    }

    pub fn pool_address(&self) -> &Address {
        &self.config.pool_address
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> PoolConfig {
        PoolConfig::default()
    }

    #[test]
    fn submits_valid_zion_share() {
        let mut pool = Pool::new(config());
        let header = b"zion_header";
        let nonce = 0u64;
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "zion_1".into(),
            nonce_hex: format!("{:016x}", nonce),
        };
        assert!(pool.submit_zion(submission, header).unwrap());
        assert_eq!(pool.stats(), (1, 0));
    }

    #[test]
    fn rejects_invalid_zion_share() {
        let mut pool = Pool::new(config());
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "zion_1".into(),
            nonce_hex: "not_a_nonce".into(),
        };
        assert!(pool.submit_zion(submission, b"header").is_err());
    }

    #[test]
    fn submits_valid_auxpow_share() {
        let mut pool = Pool::new(config());
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "aux_1".into(),
            nonce_hex: "0000000000000000".into(),
        };
        assert!(pool
            .submit_auxpow(ExternalCoin::Bitcoin, submission, b"aux_header")
            .unwrap());
        assert_eq!(pool.stats(), (1, 0));
    }

    #[test]
    fn rejects_invalid_auxpow_share() {
        let mut pool = Pool::new(PoolConfig {
            auxpow_target: [0x00u8; 32],
            ..config()
        });
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "aux_1".into(),
            nonce_hex: "0000000000000000".into(),
        };
        assert!(pool
            .submit_auxpow(ExternalCoin::Bitcoin, submission, b"aux_header")
            .is_err());
    }

    #[test]
    fn payouts_are_proportional() {
        let mut pool = Pool::new(PoolConfig {
            pool_fee_bps: 0,
            ..config()
        });
        let header = b"payout_header";
        for i in 0..4 {
            let submission = ShareSubmission {
                worker: format!("worker{i}"),
                job_id: format!("zion_{i}"),
                nonce_hex: format!("{:016x}", i),
            };
            pool.submit_zion(submission, header).unwrap();
        }
        let reward = Amount(1_000_000);
        let payouts = pool.payouts(reward);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].amount.0, 1_000_000);
    }

    #[test]
    fn next_job_id_increments() {
        let pool = Pool::new(config());
        assert_eq!(pool.next_job_id(), 2);
        assert_eq!(pool.next_job_id(), 3);
    }
}
