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

/// Stratum connection/session counters shared between every
/// `StratumServer` listener (primary port, extra ports, TLS) and the HTTP
/// API. Cloning the handle shares the same underlying atomics.
#[derive(Clone, Debug, Default)]
pub struct SessionCounters {
    /// Currently open stratum sessions.
    pub active_sessions: Arc<AtomicU64>,
    /// Cumulative accepted connections since start.
    pub total_connections: Arc<AtomicU64>,
}

#[derive(Debug)]
pub struct Pool {
    pub config: PoolConfig,
    pub pplns: PplnsEngine,
    pub validator: ShareValidator,
    pub current_job_id: AtomicU64,
    pub accepted: AtomicU64,
    pub rejected: AtomicU64,
    /// Live stratum session counters for the HTTP API.
    pub session_counters: SessionCounters,
    /// Authorized worker name -> payout address (anonymous mining).
    pub worker_addresses: HashMap<String, Address>,
    /// Worker name -> (external chain, raw address) for non-ZION payouts
    /// (e.g. `qtc:<ss58>` Quantus payouts).  Entries here bypass the ZION
    /// UTXO sweeper and are drained by the multichain payout sweeper via
    /// `POST /admin/external-payouts/drain`.
    pub worker_ext_payouts: HashMap<String, (String, String)>,
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
            session_counters: SessionCounters::default(),
            worker_addresses: HashMap::new(),
            worker_ext_payouts: HashMap::new(),
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
        let (chain, address) = self.worker_payout_target(worker);
        self.pplns
            .register_address_with_chain(worker, &address, &chain);
        let share_difficulty = submission.difficulty.max(1);
        self.pplns
            .record_share_with_diff(worker, worker, height, share_difficulty);
    }

    /// Credit an accepted external (AuxPoW) stream share into PPLNS so the
    /// miner earns ZION for upstream-verified work (multi-algo phase C).
    ///
    /// External shares carry no meaningful ZION difficulty — upstream
    /// targets are coin-specific — so they are credited at an explicit
    /// configured weight (`ZION_POOL_AUXPOW_WEIGHT_<COIN>` override, else
    /// `ZION_POOL_AUXPOW_PPLNS_WEIGHT`, default 500 ≈ the vardiff floor).
    /// The external coin itself stays with the pool as revenue; the ZION
    /// PPLNS credit is what the miner is paid out of.
    pub fn record_external_share(
        &mut self,
        _miner_id: &str,
        worker_name: &str,
        height: u64,
        weight: u64,
    ) {
        let (chain, address) = self.worker_payout_target(worker_name);
        self.pplns
            .register_address_with_chain(worker_name, &address, &chain);
        self.pplns.record_share_with_diff(
            worker_name,
            worker_name,
            height,
            weight.max(1),
        );
    }

    /// Resolve a worker string to its `(chain, payout_address)` target.
    ///
    /// `qtc:<ss58>` / bare `qz…` SS58 → `("quantus", ss58)`; `zion1…` →
    /// `("zion", encoded)`; anything else falls back to the pool wallet
    /// (shares still counted, payout retained by the pool).
    fn worker_payout_target(&self, worker: &str) -> (String, String) {
        let wallet = worker.split('.').next().unwrap_or(worker).trim();
        if let Some((chain, addr)) = self
            .worker_ext_payouts
            .get(worker)
            .or_else(|| self.worker_ext_payouts.get(wallet))
        {
            return (chain.clone(), addr.clone());
        }
        if let Some(ss58) = parse_quantus_payout(wallet) {
            return ("quantus".to_string(), ss58);
        }
        if let Some(addr) = self
            .worker_addresses
            .get(worker)
            .or_else(|| self.worker_addresses.get(wallet))
            .cloned()
            .or_else(|| parse_worker_address(worker))
        {
            return ("zion".to_string(), addr.encoded);
        }
        ("zion".to_string(), self.config.pool_address.encoded.clone())
    }

    pub fn register_worker(&mut self, worker: &str) {
        let wallet = worker.split('.').next().unwrap_or(worker).trim();
        if let Some(ss58) = parse_quantus_payout(wallet) {
            self.worker_ext_payouts
                .insert(worker.to_string(), ("quantus".to_string(), ss58.clone()));
            self.pplns
                .register_address_with_chain(worker, &ss58, "quantus");
            return;
        }
        if let Some(addr) = parse_worker_address(worker) {
            self.worker_addresses
                .insert(worker.to_string(), addr.clone());
            self.pplns.register_address(worker, &addr.encoded);
        }
    }

    /// Register an explicit payout address for a miner (v3 Hello
    /// `payout_address` field).  Accepts `qtc:<ss58>`/`qtu:<ss58>`/bare
    /// `qz…` for Quantus payouts and `zion1…` for native payouts.
    /// Returns the registered `(chain, address)` on success.
    pub fn register_payout_address<'a>(
        &mut self,
        miner_id: &str,
        address: &'a str,
    ) -> Option<(&'static str, &'a str)> {
        let addr = address.trim();
        if let Some(ss58) = parse_quantus_payout(addr) {
            self.worker_ext_payouts
                .insert(miner_id.to_string(), ("quantus".to_string(), ss58.clone()));
            self.pplns
                .register_address_with_chain(miner_id, &ss58, "quantus");
            return Some(("quantus", addr));
        }
        if addr.starts_with("zion1") {
            if let Ok(parsed) =
                Address::new(ChainId::ZionL1, addr.as_bytes().to_vec(), addr)
            {
                self.worker_addresses
                    .insert(miner_id.to_string(), parsed.clone());
                self.pplns.register_address(miner_id, &parsed.encoded);
                return Some(("zion", addr));
            }
        }
        None
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

    /// Drain and return the queued ZION payouts for the sweep thread.
    /// External-chain entries (e.g. Quantus) stay queued — they are drained
    /// via [`take_external_payouts`].
    pub fn take_pending_payouts(&mut self) -> Vec<(u64, PayoutEntry)> {
        let (zion, ext): (Vec<_>, Vec<_>) = std::mem::take(&mut self.pending_payouts)
            .into_iter()
            .partition(|(_, p)| p.chain() == "zion");
        self.pending_payouts = ext;
        zion
    }

    /// Drain queued payouts for a non-ZION chain (`"quantus"`).  ZION
    /// entries and other chains stay queued.
    pub fn take_external_payouts(&mut self, chain: &str) -> Vec<(u64, PayoutEntry)> {
        let (taken, kept): (Vec<_>, Vec<_>) = std::mem::take(&mut self.pending_payouts)
            .into_iter()
            .partition(|(_, p)| p.chain() == chain);
        self.pending_payouts = kept;
        taken
    }

    /// Snapshot (without draining) of queued external-chain payouts for a
    /// chain — used by the status API.
    pub fn pending_external_payouts(&self, chain: &str) -> Vec<&PayoutEntry> {
        self.pending_payouts
            .iter()
            .map(|(_, p)| p)
            .filter(|p| p.chain() == chain)
            .collect()
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

/// Parse a Quantus payout target from a worker wallet field.
///
/// Accepts `qtc:<ss58>` / `qtu:<ss58>` (explicit) or a bare `qz…` SS58-189
/// address (Quantus account IDs encode with prefix 189 → base58 `qz`).
/// Full checksum verification happens in the multichain sweeper — the pool
/// only needs routing, not custody, so a shape check suffices here.
fn parse_quantus_payout(wallet: &str) -> Option<String> {
    // Strip an explicit chain tag (case-insensitive) but keep the SS58
    // address itself verbatim — base58 is case-sensitive.
    let lower = wallet.to_ascii_lowercase();
    let bare = if lower.starts_with("qtc:") || lower.starts_with("qtu:") {
        &wallet[4..]
    } else {
        wallet
    };
    // SS58 prefix 189 addresses are 47-48 base58 chars starting with "qz".
    if bare.len() >= 45 && bare.len() <= 50 && bare.starts_with("qz")
        && bare.chars().all(|c| c.is_ascii_alphanumeric())
    {
        Some(bare.to_string())
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
        assert_eq!(
            pending2.len(),
            0,
            "duplicate block height must not produce new payouts"
        );
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
        let (chain, addr) = pool.worker_payout_target("zion1abc.worker1");
        assert_eq!(chain, "zion");
        assert_eq!(addr, "zion1abc");
    }

    const QTC_ADDR: &str = "qzmAAFv4c7tprk5UyJfav4hgkGR8xyckGeZL2KhwM1FWMW1gk";

    #[test]
    fn quantus_worker_parses_qtc_prefix() {
        assert_eq!(
            parse_quantus_payout(&format!("qtc:{QTC_ADDR}")).as_deref(),
            Some(QTC_ADDR)
        );
        assert_eq!(
            parse_quantus_payout(&format!("QTU:{QTC_ADDR}")).as_deref(),
            Some(QTC_ADDR)
        );
        assert_eq!(
            parse_quantus_payout(QTC_ADDR).as_deref(),
            Some(QTC_ADDR)
        );
        assert_eq!(parse_quantus_payout("zion1abc"), None);
        assert_eq!(parse_quantus_payout("qzshort"), None);
        assert_eq!(parse_quantus_payout("qtc:notqz_address!"), None);
    }

    #[test]
    fn quantus_worker_registers_external_payout() {
        let mut pool = Pool::new(config(), telemetry());
        pool.register_worker(&format!("qtc:{QTC_ADDR}.rig1"));
        let (chain, addr) = pool.worker_payout_target(&format!("qtc:{QTC_ADDR}.rig1"));
        assert_eq!(chain, "quantus");
        assert_eq!(addr, QTC_ADDR);
    }

    #[test]
    fn explicit_payout_address_routes_quantus() {
        let mut pool = Pool::new(config(), telemetry());
        // v3 Hello payout_address
        let pa = format!("qtc:{QTC_ADDR}");
        let res = pool.register_payout_address("miner42", &pa);
        assert_eq!(res.map(|(c, a)| (c, a)), Some(("quantus", &pa[..])));
        let (chain, addr) = pool.worker_payout_target("miner42.rigA");
        assert_eq!(chain, "quantus");
        assert_eq!(addr, QTC_ADDR);
        // zion1 still works, garbage rejected
        assert_eq!(
            pool.register_payout_address("m2", "zion1zz"),
            Some(("zion", "zion1zz"))
        );
        assert_eq!(pool.register_payout_address("m3", "garbage"), None);
    }

    #[test]
    fn external_payouts_partition_from_zion() {
        let mut pool = Pool::new(
            PoolConfig {
                min_payout_flowers: 1,
                ..config()
            },
            telemetry(),
        );
        // One QTC miner + one ZION miner submit shares at height 1.
        pool.register_worker(&format!("qtc:{QTC_ADDR}.rig1"));
        let sub_qtc = ShareSubmission {
            worker: format!("qtc:{QTC_ADDR}.rig1"),
            job_id: "zion_1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        let sub_zion = ShareSubmission {
            worker: "zion1miner".into(),
            job_id: "zion_2".into(),
            nonce_hex: "0000000000000001".into(),
            difficulty: 1,
        };
        pool.submit_zion(sub_qtc, b"h", 1).unwrap();
        pool.submit_zion(sub_zion, b"h", 1).unwrap();
        pool.on_block_found(1, 1_000_000);

        // ZION drain must leave the quantus entry behind.
        let zion = pool.take_pending_payouts();
        assert!(zion.iter().all(|(_, p)| p.chain() == "zion"));
        assert_eq!(zion.len(), 1);
        let ext = pool.take_external_payouts("quantus");
        assert_eq!(ext.len(), 1);
        assert_eq!(ext[0].1.chain(), "quantus");
        assert_eq!(ext[0].1.address, QTC_ADDR);
    }
}
