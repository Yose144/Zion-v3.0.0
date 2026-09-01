use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use ed25519_dalek::SigningKey;
use zion_cosmic_harmony::ExternalCoin;
use zion_l1_types::{Address, ChainId};

use crate::config::PoolConfig;
use crate::share::ShareSubmission;
use crate::telemetry::MinerTelemetryRegistry;
use crate::v3_pplns::{PayoutEntry, PplnsConfig, PplnsEngine};
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
    pub pplns: PplnsEngine,
    pub validator: ShareValidator,
    pub current_job_id: AtomicU64,
    pub accepted: AtomicU64,
    pub rejected: AtomicU64,
    /// Authorized worker name -> payout address (anonymous mining).
    pub worker_addresses: HashMap<String, Address>,
    /// Last computed payouts for a found block, keyed by block height.
    pub last_payouts: Option<(u64, Vec<PayoutEntry>)>,
    /// Ed25519 signing key for the pool payout wallet (hex 32 bytes).
    pub signing_key: Option<SigningKey>,
    /// Payouts waiting to be submitted on-chain.
    pub pending_payouts: Vec<(u64, PayoutEntry)>,
    /// (block_height, address) pairs already submitted to the wallet.
    pub sent_payouts: HashSet<(u64, String)>,
    /// Block heights that have already been processed for payout (idempotency guard).
    paid_block_heights: HashSet<u64>,
    /// Shared per-worker telemetry registry (hashrate, shares, blocks).
    pub telemetry: Arc<Mutex<MinerTelemetryRegistry>>,
}

impl Pool {
    pub fn new(config: PoolConfig, telemetry: Arc<Mutex<MinerTelemetryRegistry>>) -> Self {
        let pplns_config = PplnsConfig {
            window_size: config.pplns_window_size,
            min_payout_flowers: config.min_payout_flowers,
            fee_config: config.fee_config.clone(),
        };
        let mut pplns = PplnsEngine::new(pplns_config);
        if let Some(path) = config.state_path.as_ref() {
            if let Some(snap) = PplnsEngine::load_from_path(path) {
                pplns.restore(snap);
            }
        }
        let signing_key = config.pool_wallet_key.as_deref().and_then(|hex_str| {
            let bytes = hex::decode(hex_str).ok()?;
            let arr = <[u8; 32]>::try_from(bytes).ok()?;
            Some(SigningKey::from_bytes(&arr))
        });
        Self {
            config,
            pplns,
            validator: ShareValidator::new(),
            current_job_id: AtomicU64::new(1),
            accepted: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
            worker_addresses: HashMap::new(),
            last_payouts: None,
            signing_key,
            pending_payouts: Vec::new(),
            sent_payouts: HashSet::new(),
            paid_block_heights: HashSet::new(),
            telemetry,
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

    fn record_share(&mut self, submission: &ShareSubmission, height: u64) {
        let worker = &submission.worker;
        let address = self.worker_address(worker);
        self.pplns.register_address(worker, &address.encoded);
        let share_difficulty = submission.difficulty.max(1);
        self.pplns
            .record_share_with_diff(worker, worker, height, share_difficulty);
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
            self.worker_addresses
                .insert(worker.to_string(), addr.clone());
            self.pplns.register_address(worker, &addr.encoded);
        }
    }

    pub fn submit_zion(
        &mut self,
        submission: ShareSubmission,
        header: &[u8],
        height: u64,
    ) -> Result<bool, PoolError> {
        let target = self.config.zion_target;
        self.submit_zion_with_target(submission, header, height, &target)
    }

    pub fn submit_zion_with_target(
        &mut self,
        submission: ShareSubmission,
        header: &[u8],
        height: u64,
        target: &[u8; 32],
    ) -> Result<bool, PoolError> {
        let nonce = Self::parse_nonce(&submission.nonce_hex)?;
        if self.validator.validate_zion(header, nonce, target) {
            self.record_share(&submission, height);
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
        height: u64,
    ) -> Result<bool, PoolError> {
        let target = self.config.auxpow_target;
        self.submit_auxpow_with_target(coin, submission, header, height, &target)
    }

    pub fn submit_auxpow_with_target(
        &mut self,
        coin: ExternalCoin,
        submission: ShareSubmission,
        header: &[u8],
        height: u64,
        target: &[u8; 32],
    ) -> Result<bool, PoolError> {
        let nonce = Self::parse_nonce(&submission.nonce_hex)?;
        if self.validator.validate_auxpow(coin, header, nonce, target) {
            self.record_share(&submission, height);
            self.accepted.fetch_add(1, Ordering::Relaxed);
            Ok(true)
        } else {
            self.rejected.fetch_add(1, Ordering::Relaxed);
            Err(PoolError::Invalid)
        }
    }

    /// Compute miner payouts for the given full block subsidy.
    ///
    /// The node coinbase already splits the block reward 89/5/5/1, so the pool
    /// only redistributes the miner share (89% minus rounding dust).
    pub fn payouts(&mut self, block_reward: u64) -> Vec<PayoutEntry> {
        let miner_share = zion_core::emission::fee_split(block_reward).0;
        self.pplns.compute_miner_payouts(miner_share)
    }

    /// Record a found block and compute PPLNS payouts for it.
    pub fn on_block_found(&mut self, block_height: u64, block_reward: u64) {
        if !self.paid_block_heights.insert(block_height) {
            return;
        }
        let payouts = self.payouts(block_reward);
        for payout in payouts {
            let key = (block_height, payout.address.clone());
            if !self.sent_payouts.contains(&key) {
                self.pending_payouts.push((block_height, payout));
            }
        }
        self.last_payouts = Some((
            block_height,
            self.pending_payouts
                .iter()
                .map(|(_, p)| p.clone())
                .collect(),
        ));
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
    ///
    /// Returns `Ok(true)` if a snapshot was written because the state was dirty,
    /// `Ok(false)` if there was nothing to save, and `Err` only on I/O failure.
    pub fn save(&mut self) -> std::io::Result<bool> {
        if let Some(path) = self.config.state_path.as_ref() {
            self.pplns.save_if_dirty(path)
        } else {
            Ok(false)
        }
    }

    /// Restore PPLNS state from the configured path, if any.
    pub fn restore(&mut self) {
        if let Some(path) = self.config.state_path.as_ref() {
            if let Some(snap) = PplnsEngine::load_from_path(path) {
                self.pplns.restore(snap);
            }
        }
    }

    /// Drain and return the queued payouts for the sweep thread.
    pub fn take_pending_payouts(&mut self) -> Vec<(u64, PayoutEntry)> {
        std::mem::take(&mut self.pending_payouts)
    }

    /// Put payouts back into the queue for a later retry.
    pub fn requeue_payouts(&mut self, payouts: Vec<(u64, PayoutEntry)>) {
        self.pending_payouts.extend(payouts);
    }

    /// Mark a payout as successfully submitted so it is not re-sent.
    pub fn mark_payout_sent(&mut self, block_height: u64, address: &str) {
        self.sent_payouts
            .insert((block_height, address.to_string()));
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

    fn telemetry() -> Arc<Mutex<MinerTelemetryRegistry>> {
        Arc::new(Mutex::new(MinerTelemetryRegistry::new()))
    }

    #[test]
    fn submits_valid_zion_share() {
        let mut pool = Pool::new(config(), telemetry());
        let header = b"zion_header";
        let nonce = 0u64;
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "zion_1".into(),
            nonce_hex: format!("{:016x}", nonce),
            difficulty: 1,
        };
        assert!(pool.submit_zion(submission, header, 0).unwrap());
        assert_eq!(pool.stats(), (1, 0));
    }

    #[test]
    fn rejects_invalid_zion_share() {
        let mut pool = Pool::new(config(), telemetry());
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "zion_1".into(),
            nonce_hex: "not_a_nonce".into(),
            difficulty: 1,
        };
        assert!(pool.submit_zion(submission, b"header", 0).is_err());
    }

    #[test]
    fn submits_valid_auxpow_share() {
        let mut pool = Pool::new(config(), telemetry());
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "aux_1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        assert!(pool
            .submit_auxpow(ExternalCoin::Bitcoin, submission, b"aux_header", 0)
            .unwrap());
        assert_eq!(pool.stats(), (1, 0));
    }

    #[test]
    fn rejects_invalid_auxpow_share() {
        let mut pool = Pool::new(
            PoolConfig {
                auxpow_target: [0x00u8; 32],
                ..config()
            },
            telemetry(),
        );
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "aux_1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        assert!(pool
            .submit_auxpow(ExternalCoin::Bitcoin, submission, b"aux_header", 0)
            .is_err());
    }

    #[test]
    fn payouts_are_proportional() {
        let mut pool = Pool::new(
            PoolConfig {
                min_payout_flowers: 1,
                ..config()
            },
            telemetry(),
        );
        let header = b"payout_header";
        for i in 0..4 {
            let submission = ShareSubmission {
                worker: "worker1".into(),
                job_id: format!("zion_{i}"),
                nonce_hex: format!("{:016x}", i),
                difficulty: 1,
            };
            pool.submit_zion(submission, header, 1).unwrap();
        }
        let reward = 1_000_000;
        let payouts = pool.payouts(reward);
        assert_eq!(payouts.len(), 1);
        let miner_share = zion_core::emission::fee_split(reward).0;
        assert_eq!(payouts[0].amount, miner_share);
    }

    #[test]
    fn on_block_found_is_idempotent() {
        let mut pool = Pool::new(config(), telemetry());
        pool.on_block_found(100, 1_000_000);
        let pending1 = pool.take_pending_payouts();
        pool.on_block_found(100, 1_000_000);
        let pending2 = pool.take_pending_payouts();
        assert_eq!(pending2.len(), 0, "duplicate block height must not produce new payouts");
        pool.requeue_payouts(pending1);
        let pending3 = pool.take_pending_payouts();
        assert_eq!(
            pending3.len(),
            0,
            "requeue of drained payouts after idempotent on_block_found should not duplicate"
        );
    }

    #[test]
    fn next_job_id_increments() {
        let pool = Pool::new(config(), telemetry());
        assert_eq!(pool.next_job_id(), 2);
        assert_eq!(pool.next_job_id(), 3);
    }

    #[test]
    fn anonymous_worker_address_parsed_from_username() {
        let mut pool = Pool::new(config(), telemetry());
        pool.register_worker("zion1abc.worker1");
        let addr = pool.worker_address("zion1abc.worker1");
        assert_eq!(addr.encoded, "zion1abc");
    }
}
