use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use zion_cosmic_harmony::ExternalCoin;
use zion_l1_types::{Address, Amount, ChainId};

use crate::config::PoolConfig;
use crate::pplns::{Payout, PplnsState, ShareRecord};
use crate::share::ShareSubmission;
use crate::validator::ShareValidator;

/// Placeholder block reward used for PPLNS payout calculation until the pool
/// is wired to the node's coinbase output.
pub const DEFAULT_BLOCK_REWARD_ZION: u64 = 6_000_000;

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
    /// Authorized worker name -> payout address (anonymous mining).
    pub worker_addresses: HashMap<String, Address>,
    /// Last computed payouts for a found block, keyed by block height.
    pub last_payouts: Option<(u64, Vec<Payout>)>,
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
            worker_addresses: HashMap::new(),
            last_payouts: None,
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
            address: self.worker_address(worker),
            value,
            timestamp: chrono::Utc::now(),
        };
        self.pplns.add_share(record);
    }

    fn worker_address(&self, worker: &str) -> Address {
        if let Some(addr) = self.worker_addresses.get(worker) {
            return addr.clone();
        }
        if let Some(addr) = parse_worker_address(worker) {
            return addr;
        }
        self.config.pool_address.clone()
    }

    pub fn register_worker(&mut self, worker: &str) {
        if let Some(addr) = parse_worker_address(worker) {
            self.worker_addresses.insert(worker.to_string(), addr);
        }
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

    /// Record a found block, compute PPLNS payouts for it and store them.
    pub fn on_block_found(&mut self, block_height: u64, block_reward: u64) {
        let block_reward = Amount::new(block_reward as u128);
        let payouts = self.pplns.payouts_for(block_reward);
        self.last_payouts = Some((block_height, payouts));
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

    /// Persist the current PPLNS state, if a state path is configured.
    pub fn save(&self) -> std::io::Result<()> {
        if let Some(path) = self.config.state_path.as_ref() {
            self.pplns.save_to(path)?;
        }
        Ok(())
    }

    /// Restore PPLNS state from the configured path, if any.
    pub fn restore(&mut self) {
        if let Some(path) = self.config.state_path.as_ref() {
            if let Some(state) = PplnsState::restore(path) {
                self.pplns = state;
                self.pplns.set_fee_bps(self.config.pool_fee_bps);
            }
        }
    }
}

fn parse_worker_address(worker: &str) -> Option<Address> {
    let wallet = worker.split('.').next().unwrap_or(worker).trim();
    if wallet.starts_with("zion1") {
        Address::new(ChainId::ZionL1, wallet.as_bytes().to_vec(), wallet).ok()
    } else {
        None
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

    #[test]
    fn anonymous_worker_address_parsed_from_username() {
        let mut pool = Pool::new(config());
        pool.register_worker("zion1abc.worker1");
        let addr = pool.worker_address("zion1abc.worker1");
        assert_eq!(addr.encoded, "zion1abc");
    }
}
