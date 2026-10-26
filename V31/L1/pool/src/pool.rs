use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::Context;
use ed25519_dalek::SigningKey;
use serde::{Deserialize, Serialize};
use zion_cosmic_harmony::ExternalCoin;
use zion_l1_types::{Address, ChainId};

use crate::config::PoolConfig;
use crate::share::ShareSubmission;
use crate::store::ShareStore;
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
    #[error("coin not enabled for native payouts")]
    CoinNotNative,
    #[error("revenue event already processed")]
    DuplicateRevenueEvent,
    /// Same (job, nonce/proof) already accepted once — replayed submissions
    /// must not draw a second PPLNS credit.
    #[error("duplicate share")]
    DuplicateShare,
}

/// Result of applying a native-coin revenue event (`on_coin_revenue`).
#[derive(Debug, Clone)]
pub struct CoinRevenueOutcome {
    /// Normalized coin ticker.
    pub coin: String,
    /// Revenue distributed (native base units).
    pub amount: u64,
    /// Payout entries emitted this event (below-threshold balances keep
    /// accruing in `unpaid_native` and are not listed here).
    pub emitted: usize,
    /// Sum of emitted amounts — equals `amount` only when every share
    /// holder had a valid payout address on the coin's chain.
    pub emitted_total: u64,
    /// Generated native payouts, persisted to the SQLite outbox by the API
    /// before the PPLNS snapshot is committed.
    pub payouts: Vec<(u64, PayoutEntry)>,
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

/// Durable payout-idempotency ledger persisted next to the PPLNS state file
/// (`<state_path>.payouts.json`). Covers the crash/restart window where the
/// in-memory `paid_block_heights`/`sent_payouts`/`pending_payouts` guards
/// would otherwise be dropped (IA-14, POL-002 follow-up).
///
/// Semantics after restart: pending entries are restored and re-swept;
/// `sent_payouts` suppresses resubmission of payouts already accepted by the
/// node. The residual window — a crash after the node accepted the batch but
/// before `mark_payout_sent` persisted — is at-most-once safe: the height is
/// already in `paid_block_heights`, so the block is never re-distributed, and
/// the submitted tx is the only payout attempt.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PayoutLedgerState {
    /// Block heights already processed by `on_block_found`.
    #[serde(default)]
    pub paid_block_heights: Vec<u64>,
    /// `(block_height, address)` pairs already submitted on-chain.
    #[serde(default)]
    pub sent_payouts: Vec<(u64, String)>,
    /// Payouts queued (or in-flight at last save) awaiting submission.
    #[serde(default)]
    pub pending_payouts: Vec<(u64, PayoutEntry)>,
}

#[derive(Debug)]
pub struct Pool {
    pub config: PoolConfig,
    pub pplns: PplnsEngine,
    pub validator: ShareValidator,
    pub current_job_id: AtomicU64,
    pub accepted: AtomicU64,
    pub rejected: AtomicU64,
    pub pplns_persist_success_timestamp_s: u64,
    pub pplns_persist_failures_total: u64,
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
    /// Bounded (job-bucket → nonce/proof-tag) dedup for accepted shares.
    /// Buckets track the live job map — entries are evicted FIFO when the
    /// job-key count exceeds the cap, so memory stays proportional to the
    /// working set rather than to total submissions.
    share_dedup: HashMap<String, HashSet<u64>>,
    share_dedup_order: std::collections::VecDeque<String>,
    /// Optional persistence for the dedup set — every mark is mirrored to
    /// `share_dedup` in the share store so a restart cannot reopen the
    /// replay window (upstream-keyed `ext:` job ids outlive a bounce).
    /// Ops go through a bounded queue to the dedup writer thread —
    /// synchronous SQLite under `pool.lock()` wedged the API on
    /// 2026-10-26; a full queue drops marks (fail-open, in-memory set
    /// stays authoritative) rather than stalling share processing.
    dedup_tx: Option<std::sync::mpsc::SyncSender<crate::store::DedupOp>>,
    /// Shared per-worker telemetry registry (hashrate, shares, blocks).
    pub telemetry: Arc<Mutex<MinerTelemetryRegistry>>,
    pub(crate) pearl: Option<Arc<crate::pearl_gateway::PearlRuntime>>,
}

/// Job buckets retained for share dedup.  Stratum keeps ~256 live jobs —
/// this comfortably covers every bucket that can still produce a credit.
const SHARE_DEDUP_JOB_CAP: usize = 512;
/// Nonce tags retained per job bucket.  An honest job sees shares in the
/// thousands; this is headroom, and a saturated bucket fails closed
/// (treated as duplicate) rather than growing without bound.
const SHARE_DEDUP_TAG_CAP: usize = 500_000;
/// How long persisted dedup marks are kept/restored for. Upstream job ids
/// rotate in minutes; 4h covers restart gaps plus upstream outages without
/// letting the table accumulate dead buckets.
const SHARE_DEDUP_RETAIN_S: u64 = 4 * 3600;

impl Pool {
    pub fn new(config: PoolConfig, telemetry: Arc<Mutex<MinerTelemetryRegistry>>) -> Self {
        Self::try_new(config, telemetry)
            .unwrap_or_else(|e| panic!("failed to initialize pool: {e:#}"))
    }

    pub fn try_new(
        config: PoolConfig,
        telemetry: Arc<Mutex<MinerTelemetryRegistry>>,
    ) -> anyhow::Result<Self> {
        let pplns_config = PplnsConfig {
            window_size: config.pplns_window_size,
            min_payout_flowers: config.min_payout_flowers,
            fee_config: config.fee_config.clone(),
            native_payout_coins: config.native_payout_coins.clone(),
            min_payout_native: config.min_payout_native.clone(),
        };
        let mut pplns = PplnsEngine::new(pplns_config);
        if let Some(path) = config.state_path.as_ref() {
            if let Some(snap) = PplnsEngine::load_from_path(path)
                .with_context(|| format!("failed to load PPLNS state from {path}"))?
            {
                pplns.restore(snap);
            }
        }
        let signing_key = config.pool_wallet_key.as_deref().and_then(|hex_str| {
            let bytes = hex::decode(hex_str).ok()?;
            let arr = <[u8; 32]>::try_from(bytes).ok()?;
            Some(SigningKey::from_bytes(&arr))
        });
        let ledger = Self::load_payout_ledger(config.state_path.as_deref());
        Ok(Self {
            config,
            pplns,
            validator: ShareValidator::new(),
            current_job_id: AtomicU64::new(1),
            accepted: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
            pplns_persist_success_timestamp_s: 0,
            pplns_persist_failures_total: 0,
            session_counters: SessionCounters::default(),
            worker_addresses: HashMap::new(),
            worker_ext_payouts: HashMap::new(),
            last_payouts: None,
            signing_key,
            pending_payouts: ledger.pending_payouts,
            sent_payouts: ledger.sent_payouts.into_iter().collect(),
            paid_block_heights: ledger.paid_block_heights.into_iter().collect(),
            share_dedup: HashMap::new(),
            share_dedup_order: std::collections::VecDeque::new(),
            dedup_tx: None,
            telemetry,
            pearl: crate::pearl_gateway::PearlRuntime::from_env(),
        })
    }

    /// Sidecar path for the payout ledger (`<state_path>.payouts.json`).
    fn payout_state_path(&self) -> Option<PathBuf> {
        self.config
            .state_path
            .as_ref()
            .map(|p| PathBuf::from(format!("{p}.payouts.json")))
    }

    /// Load the payout ledger sidecar, if present and parseable.
    /// Corrupt or unreadable files fail open (empty ledger) with a warning —
    /// losing the guards is recoverable by operator inspection, a pool that
    /// refuses to start is not.
    fn load_payout_ledger(state_path: Option<&str>) -> PayoutLedgerState {
        let Some(path) = state_path.map(|p| PathBuf::from(format!("{p}.payouts.json"))) else {
            return PayoutLedgerState::default();
        };
        match std::fs::read_to_string(&path) {
            Ok(raw) => match serde_json::from_str::<PayoutLedgerState>(&raw) {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!(
                        "payout ledger {} unparsable ({}), starting empty",
                        path.display(),
                        e
                    );
                    PayoutLedgerState::default()
                }
            },
            Err(_) => PayoutLedgerState::default(),
        }
    }

    /// Persist the payout ledger next to the PPLNS state file. Best-effort:
    /// write failures are logged and counted, never fatal — the pool must
    /// keep serving miners even if the disk hiccups.
    fn persist_payout_ledger(&mut self) {
        let Some(path) = self.payout_state_path() else {
            return;
        };
        let state = PayoutLedgerState {
            paid_block_heights: self.paid_block_heights.iter().copied().collect(),
            sent_payouts: self.sent_payouts.iter().cloned().collect(),
            pending_payouts: self.pending_payouts.clone(),
        };
        let write = || -> std::io::Result<()> {
            let tmp = path.with_extension("payouts.json.tmp");
            let body = serde_json::to_vec(&state)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            std::fs::write(&tmp, body)?;
            std::fs::rename(&tmp, &path)?;
            Ok(())
        };
        if let Err(e) = write() {
            self.pplns_persist_failures_total = self.pplns_persist_failures_total.saturating_add(1);
            tracing::warn!("payout ledger persist failed {}: {}", path.display(), e);
        }
    }

    pub fn next_job_id(&self) -> u64 {
        self.current_job_id.fetch_add(1, Ordering::Relaxed) + 1
    }

    /// Read-only dedup probe: `true` when this (job bucket, tag) was already
    /// credited. Checking before validation (and marking only on success)
    /// keeps invalid submissions from burning tags that a later valid
    /// resubmit at a lower session target could still legitimately use.
    fn share_seen(&self, job_bucket: &str, tag: u64) -> bool {
        self.share_dedup
            .get(job_bucket)
            .is_some_and(|s| s.contains(&tag))
    }

    /// Dedup mark: `false` when this (job bucket, tag) was already credited
    /// or the bucket is full (fail closed). First valid submission claims
    /// the pair; replays fail closed.
    fn mark_share_seen(&mut self, job_bucket: &str, tag: u64) -> bool {
        if !self.share_dedup.contains_key(job_bucket) {
            while self.share_dedup.len() >= SHARE_DEDUP_JOB_CAP {
                match self.share_dedup_order.pop_front() {
                    Some(old) => {
                        self.share_dedup.remove(&old);
                        self.queue_dedup_op(crate::store::DedupOp::DeleteBucket { bucket: old });
                    }
                    None => break,
                }
            }
            self.share_dedup_order.push_back(job_bucket.to_string());
            self.share_dedup
                .insert(job_bucket.to_string(), HashSet::new());
        }
        let set = self
            .share_dedup
            .get_mut(job_bucket)
            .expect("bucket present");
        if set.len() >= SHARE_DEDUP_TAG_CAP {
            return false;
        }
        let claimed = set.insert(tag);
        // Mirror the fresh mark to disk — a restart restores it and the
        // replay window stays closed. Fail-open: the in-memory mark is
        // authoritative for the live session; a dropped queue entry only
        // widens the post-restart window, never rejects an honest share.
        if claimed {
            self.queue_dedup_op(crate::store::DedupOp::Mark {
                bucket: job_bucket.to_string(),
                tag,
                ts: crate::telemetry::now_unix_seconds(),
            });
        }
        claimed
    }

    /// Non-blocking hand-off to the dedup writer. A full queue drops the
    /// op — the in-memory set is authoritative for the live session, so
    /// this only widens the post-restart replay window, never rejects an
    /// honest share. Warn at most once per drop burst via a cheap flag.
    fn queue_dedup_op(&self, op: crate::store::DedupOp) {
        let Some(tx) = &self.dedup_tx else { return };
        if tx.try_send(op).is_err() {
            tracing::warn!("dedup persist: queue full/disconnected — mark dropped");
        }
    }

    /// Attach the share store for dedup persistence and rebuild the
    /// in-memory seen-set from the newest persisted buckets. A restore
    /// failure is non-fatal — the pool starts with an empty set exactly
    /// as it did before persistence existed.
    pub fn attach_dedup_store(&mut self, store: Arc<crate::store::ShareStore>) {
        match store.load_dedup_marks(SHARE_DEDUP_JOB_CAP, SHARE_DEDUP_RETAIN_S) {
            Ok(rows) => {
                let mut restored = 0usize;
                for (bucket, tag) in rows {
                    if !self.share_dedup.contains_key(&bucket) {
                        if self.share_dedup.len() >= SHARE_DEDUP_JOB_CAP {
                            break;
                        }
                        self.share_dedup_order.push_back(bucket.clone());
                        self.share_dedup.insert(bucket.clone(), HashSet::new());
                    }
                    if let Some(set) = self.share_dedup.get_mut(&bucket) {
                        if set.insert(tag) {
                            restored += 1;
                        }
                    }
                }
                if restored > 0 {
                    tracing::info!(restored, "share dedup restored from store");
                }
            }
            Err(e) => tracing::warn!("dedup persist: restore failed: {e}"),
        }
        // Bounded queue to the writer thread — every dedup write stays
        // off `pool.lock()`. Capacity sized so a stalled writer still
        // covers a long burst before marks start dropping.
        let (tx, rx) = std::sync::mpsc::sync_channel::<crate::store::DedupOp>(8192);
        let writer = Arc::clone(&store);
        match std::thread::Builder::new()
            .name("dedup-writer".to_string())
            .spawn(move || crate::store::dedup_writer_loop(writer, rx, SHARE_DEDUP_RETAIN_S))
        {
            Ok(_) => self.dedup_tx = Some(tx),
            Err(e) => tracing::warn!("dedup persist: writer spawn failed: {e}"),
        }
    }

    /// Dedup for external (AuxPoW) legs — `tag` is any stable proof/nonce
    /// string; it is hashed to u64 for storage. Returns `false` on replay.
    pub fn mark_external_share_seen(&mut self, coin: &str, job_id: &str, tag: &str) -> bool {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        tag.hash(&mut h);
        self.mark_share_seen(&format!("ext:{coin}:{job_id}"), h.finish())
    }

    fn parse_nonce(nonce_hex: &str) -> Result<u64, PoolError> {
        let s = nonce_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        u64::from_str_radix(s, 16).map_err(|_| PoolError::Parse)
    }

    fn record_share(&mut self, submission: &ShareSubmission, height: u64, coin: &str) {
        let worker = &submission.worker;
        let (chain, address) = self.worker_payout_target(worker);
        self.pplns
            .register_address_with_chain(worker, &address, &chain);
        let share_difficulty = submission.difficulty.max(1);
        self.pplns
            .record_share_with_diff_for_coin(worker, worker, height, share_difficulty, coin);
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
    /// Returns `false` when `dedup_key` was already credited — callers must
    /// pass a stable per-share identifier (e.g. `"{job}:{nonce_hex}"` or the
    /// upstream proof) so replays cannot double-credit PPLNS.
    pub fn record_external_share(
        &mut self,
        _miner_id: &str,
        worker_name: &str,
        height: u64,
        weight: u64,
        coin: &str,
        dedup_job: &str,
        dedup_tag: &str,
    ) -> bool {
        // Bucket on the external job id so the tag space rotates with job
        // turnover — a single per-coin bucket would exhaust its tag cap on a
        // long-running pool and fail closed.
        if !self.mark_external_share_seen(coin, dedup_job, dedup_tag) {
            return false;
        }
        let (chain, address) = self.worker_payout_target(worker_name);
        self.pplns
            .register_address_with_chain(worker_name, &address, &chain);
        self.pplns.record_share_with_diff_for_coin(
            worker_name,
            worker_name,
            height,
            weight.max(1),
            coin,
        );
        true
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
        if let Some(prl) = parse_pearl_payout(wallet) {
            return ("pearl".to_string(), prl);
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

    /// `true` when `wallet` parses to a known payout target (ZION / QTU /
    /// PRL address, optionally `chain:`-tagged).  Public-authorize guard —
    /// garbage wallets would otherwise silently mine to the pool address.
    pub fn wallet_is_valid(&self, wallet: &str) -> bool {
        let wallet = wallet.split('.').next().unwrap_or(wallet).trim();
        parse_quantus_payout(wallet).is_some()
            || parse_pearl_payout(wallet).is_some()
            || parse_worker_address(wallet).is_some()
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
        if let Some(prl) = parse_pearl_payout(wallet) {
            self.worker_ext_payouts
                .insert(worker.to_string(), ("pearl".to_string(), prl.clone()));
            self.pplns
                .register_address_with_chain(worker, &prl, "pearl");
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
        if let Some(_prl) = parse_pearl_payout(addr) {
            self.worker_ext_payouts
                .insert(miner_id.to_string(), ("pearl".to_string(), _prl.clone()));
            self.pplns
                .register_address_with_chain(miner_id, &_prl, "pearl");
            return Some(("pearl", addr));
        }
        if addr.starts_with("zion1") {
            if let Ok(parsed) = Address::new(ChainId::ZionL1, addr.as_bytes().to_vec(), addr) {
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
        // Reject replays before paying the validation hash — a duplicate
        // (job, nonce) can never draw a second credit.
        if self.share_seen(&submission.job_id, nonce) {
            self.rejected.fetch_add(1, Ordering::Relaxed);
            return Err(PoolError::DuplicateShare);
        }
        if self.validator.validate_zion(header, nonce, target) {
            self.mark_share_seen(&submission.job_id, nonce);
            self.record_share(&submission, height, "zion");
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
        if self.share_seen(&format!("aux:{}:{coin}", submission.job_id), nonce) {
            self.rejected.fetch_add(1, Ordering::Relaxed);
            return Err(PoolError::DuplicateShare);
        }
        if self.validator.validate_auxpow(coin, header, nonce, target) {
            self.mark_share_seen(&format!("aux:{}:{coin}", submission.job_id), nonce);
            self.record_share(&submission, height, coin.as_str());
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
        // Persist before the sweeper can drain — the at-most-once guarantee
        // depends on `paid_block_heights` surviving a restart.
        self.persist_payout_ledger();
    }

    /// Apply a native-coin revenue event (F3): the treasury oracle observed
    /// `amount_native` base units of new income for `coin` (node-authored
    /// blocks landing in the node wallet, or upstream-pool payouts into our
    /// per-coin account).  Distributes it across the coin's PPLNS slice and
    /// queues `native_units` payout entries tagged with `event_id`.
    ///
    /// Fail-closed rules:
    /// - `coin` must be listed in `native_payout_coins` — otherwise its
    ///   shares would also earn from the unified ZION distribution and the
    ///   event would double-pay.
    /// - `event_id` must be unique (oracle-supplied, e.g. `"qtu:rev:42"`);
    ///   repeats are rejected so POST retries cannot double-distribute.
    pub fn on_coin_revenue(
        &mut self,
        coin: &str,
        amount_native: u64,
        ref_height: u64,
        event_id: &str,
    ) -> Result<CoinRevenueOutcome, PoolError> {
        let coin = coin.trim().to_ascii_lowercase();
        if !self.pplns.is_native_payout_coin(&coin) {
            return Err(PoolError::CoinNotNative);
        }
        if event_id.is_empty() || self.pplns.has_applied_revenue_event(event_id) {
            return Err(PoolError::DuplicateRevenueEvent);
        }

        let chain = crate::coin_leg::payout_chain_for_coin(&coin).into_owned();
        let mut entries = self
            .pplns
            .compute_miner_payouts_for_coin(&coin, amount_native, &chain);
        for entry in &mut entries {
            entry.revenue_event = Some(event_id.to_string());
        }
        let payouts: Vec<_> = entries
            .into_iter()
            .map(|entry| (ref_height, entry))
            .collect();
        self.pending_payouts.extend(payouts.iter().cloned());
        self.persist_payout_ledger();
        self.pplns.mark_revenue_event_applied(event_id);
        let emitted_total = payouts
            .iter()
            .map(|(_, payout)| payout.amount)
            .fold(0u64, u64::saturating_add);
        Ok(CoinRevenueOutcome {
            coin,
            amount: amount_native,
            emitted: payouts.len(),
            emitted_total,
            payouts,
        })
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
            match self.pplns.save_if_dirty(path) {
                Ok(saved) => {
                    if saved {
                        self.pplns_persist_success_timestamp_s =
                            crate::telemetry::now_unix_seconds();
                    }
                    Ok(saved)
                }
                Err(e) => {
                    self.pplns_persist_failures_total =
                        self.pplns_persist_failures_total.saturating_add(1);
                    Err(e)
                }
            }
        } else {
            Ok(false)
        }
    }

    /// Restore PPLNS state from the configured path, if any.
    pub fn restore(&mut self) -> std::io::Result<()> {
        if let Some(path) = self.config.state_path.as_ref() {
            if let Some(snap) = PplnsEngine::load_from_path(path)? {
                self.pplns.restore(snap);
            }
        }
        let ledger = Self::load_payout_ledger(self.config.state_path.as_deref());
        self.paid_block_heights = ledger.paid_block_heights.into_iter().collect();
        self.sent_payouts = ledger.sent_payouts.into_iter().collect();
        self.pending_payouts = ledger.pending_payouts;
        Ok(())
    }

    /// Drain and return the queued ZION payouts for the sweep thread.
    /// External-chain entries (e.g. Quantus) stay queued — they are drained
    /// via [`take_external_payouts`].
    ///
    /// The drain is persisted immediately: a restart during the in-flight
    /// submission must not find these entries in the restored queue (they
    /// were already handed to the sweeper, which re-runs them only on
    /// failure). At-most-once on purpose — a lost payout can be re-triggered
    /// by the operator, a duplicated payout cannot be recalled.
    pub fn take_pending_payouts(&mut self) -> Vec<(u64, PayoutEntry)> {
        let (zion, ext): (Vec<_>, Vec<_>) = std::mem::take(&mut self.pending_payouts)
            .into_iter()
            .partition(|(_, p)| p.chain() == "zion");
        self.pending_payouts = ext;
        if !zion.is_empty() {
            self.persist_payout_ledger();
        }
        zion
    }

    /// Live snapshot of every coin leg — the runtime counterpart of
    /// `coin_leg`'s static registry.  Consumed by the stratum router and
    /// the `/public/v1/coins` API tier.
    pub fn leg_statuses(
        &self,
        multi_bridge: &crate::auxpow_bridge::MultiAuxPowBridge,
    ) -> Vec<crate::coin_leg::LegStatus> {
        use crate::coin_leg::{LegKind, LegStatus};
        let mut legs: Vec<LegStatus> = Vec::new();

        // ZION native — always served; "connected" = node RPC configured.
        legs.push(LegStatus {
            leg_id: "zion".into(),
            coin: "ZION".into(),
            kind: LegKind::Native,
            enabled: true,
            connected: self.config.l1_rpc_url.is_some(),
            job_id: None,
            job_age_ms: None,
            share_pct: None,
        });

        // QTC native leg (own quantus-node over QUIC).
        let (q_en, q_conn, q_pct, q_jid, q_age) = multi_bridge.native_status();
        legs.push(LegStatus {
            leg_id: "qtc-native".into(),
            coin: "QTU".into(),
            kind: LegKind::Native,
            enabled: q_en,
            connected: q_conn,
            job_id: q_jid,
            job_age_ms: q_age,
            share_pct: Some(q_pct),
        });

        // PRL native + upstream legs (pearl-gateway / LuckyPool).
        if let Some(pearl) = &self.pearl {
            let (n_en, njid, nage, npct, u_en, u_conn, ujid, uage, _upend, _sn, _su) =
                pearl.status();
            legs.push(LegStatus {
                leg_id: "prl-native".into(),
                coin: "PRL".into(),
                kind: LegKind::Native,
                enabled: n_en,
                connected: njid.is_some(),
                job_id: njid,
                job_age_ms: nage,
                share_pct: Some(npct),
            });
            legs.push(LegStatus {
                leg_id: "prl-upstream".into(),
                coin: "PRL".into(),
                kind: LegKind::Upstream,
                enabled: u_en,
                connected: u_conn,
                job_id: ujid,
                job_age_ms: uage,
                share_pct: None,
            });
        }

        // Bridged auxpow legs — one per enabled coin. "connected" is the
        // job-freshness proxy the dashboard already uses (<120 s).
        for coin in multi_bridge.enabled_coins() {
            let job = multi_bridge.latest_job_for_coin(&coin);
            let (jid, age) = job
                .as_ref()
                .map(|j| {
                    (
                        Some(j.external_job_id.clone()),
                        j.received_at.map(|t| t.elapsed().as_millis() as u64),
                    )
                })
                .unwrap_or((None, None));
            let (leg_id, kind) = if coin == zion_cosmic_harmony::ExternalCoin::Quantus {
                // QTU upstream leg — same source as the coin row above,
                // but tracked under its own leg id.
                ("qtc-upstream".to_string(), LegKind::Upstream)
            } else {
                (
                    format!("aux-{}", coin.as_str().to_lowercase()),
                    LegKind::Upstream,
                )
            };
            legs.push(LegStatus {
                leg_id,
                coin: coin.as_str().to_string(),
                kind,
                enabled: true,
                connected: age.map(|a| a < 120_000).unwrap_or(false),
                job_id: jid,
                job_age_ms: age,
                share_pct: None,
            });
        }

        legs
    }

    /// Drain queued payouts for a non-ZION chain (`"quantus"`).  ZION
    /// entries and other chains stay queued.
    pub fn take_external_payouts(&mut self, chain: &str) -> Vec<(u64, PayoutEntry)> {
        let (taken, kept): (Vec<_>, Vec<_>) = std::mem::take(&mut self.pending_payouts)
            .into_iter()
            .partition(|(_, p)| p.chain() == chain);
        self.pending_payouts = kept;
        if !taken.is_empty() {
            self.persist_payout_ledger();
        }
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

    pub fn pending_revenue_payouts(&self, event_id: &str) -> Vec<(u64, PayoutEntry)> {
        self.pending_payouts
            .iter()
            .filter(|(_, payout)| payout.revenue_event.as_deref() == Some(event_id))
            .cloned()
            .collect()
    }

    /// Put payouts back into the queue for a later retry.
    pub fn requeue_payouts(&mut self, payouts: Vec<(u64, PayoutEntry)>) {
        self.pending_payouts.extend(payouts);
        self.persist_payout_ledger();
    }

    /// Mark a payout as successfully submitted so it is not re-sent.
    pub fn mark_payout_sent(&mut self, block_height: u64, address: &str) {
        self.sent_payouts
            .insert((block_height, address.to_string()));
        self.persist_payout_ledger();
    }

    /// Mark a ZION payout settled AND remove it from the pending queue.
    /// Used by the service-level `execute_payouts` path, which pays from the
    /// `last_payouts` snapshot instead of draining the queue — without the
    /// removal the paid entry would sit in `pending_payouts` forever
    /// (unbounded queue/sidecar growth and a latent double-pay if any
    /// future path drains zion entries in the same process).
    pub fn settle_payout(&mut self, block_height: u64, address: &str) {
        self.pending_payouts
            .retain(|(h, p)| !(*h == block_height && p.address == address && p.chain() == "zion"));
        self.sent_payouts
            .insert((block_height, address.to_string()));
        self.persist_payout_ledger();
    }
}

pub fn recover_pending_coin_revenue(pool: &mut Pool, store: &ShareStore) -> anyhow::Result<usize> {
    let pending_events = store.pending_coin_revenue()?;
    if pending_events.is_empty() {
        return Ok(0);
    }
    let state_path = pool
        .config
        .state_path
        .as_deref()
        .context("pending native revenue requires PPLNS state persistence")?
        .to_string();

    let mut recovered = 0;
    for event in pending_events {
        let (emitted, emitted_total, payouts) =
            if pool.pplns.has_applied_revenue_event(&event.event_id) {
                let payouts = pool.pending_revenue_payouts(&event.event_id);
                let outbox_count = store.coin_revenue_outbox_count(&event.event_id)?;
                let emitted = event.emitted.max(payouts.len());
                if outbox_count < emitted {
                    anyhow::bail!(
                    "native revenue event {} is snapshotted but its payout outbox is incomplete",
                    event.event_id
                );
                }
                let emitted_total = if event.emitted > 0 {
                    event.emitted_total
                } else {
                    payouts
                        .iter()
                        .map(|(_, payout)| payout.amount)
                        .fold(0u64, u64::saturating_add)
                };
                (emitted, emitted_total, payouts)
            } else {
                let outcome = pool
                    .on_coin_revenue(
                        &event.coin,
                        event.amount_native,
                        event.ref_height,
                        &event.event_id,
                    )
                    .with_context(|| {
                        format!("failed to replay native revenue event {}", event.event_id)
                    })?;
                (outcome.emitted, outcome.emitted_total, outcome.payouts)
            };

        store
            .prepare_coin_revenue(&event.event_id, emitted, emitted_total, &payouts)
            .with_context(|| {
                format!(
                    "failed to recover outbox for revenue event {}",
                    event.event_id
                )
            })?;
        pool.pplns.save_if_dirty(&state_path).with_context(|| {
            format!(
                "failed to persist recovered PPLNS state for {}",
                event.event_id
            )
        })?;
        store
            .complete_coin_revenue(&event.event_id)
            .with_context(|| {
                format!(
                    "failed to commit recovered revenue event {}",
                    event.event_id
                )
            })?;
        recovered += 1;
    }
    Ok(recovered)
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
    if bare.len() >= 45
        && bare.len() <= 50
        && bare.starts_with("qz")
        && bare.chars().all(|c| c.is_ascii_alphanumeric())
    {
        Some(bare.to_string())
    } else {
        None
    }
}

/// Parse a Pearl payout target from a worker wallet field.
///
/// Accepts `prl:<bech32>` / `pearl:<bech32>` (explicit) or a bare `prl1…`
/// segwit address (mainnet HRP `prl`, BIP86 taproot `prl1p…`).  Full bech32m
/// checksum verification happens in the multichain sweeper — the pool only
/// needs routing, so a shape check suffices here.
fn parse_pearl_payout(wallet: &str) -> Option<String> {
    let lower = wallet.to_ascii_lowercase();
    let bare = if lower.starts_with("prl:") {
        &wallet[4..]
    } else if lower.starts_with("pearl:") {
        &wallet[6..]
    } else {
        wallet
    };
    // Bech32 segwit address: `prl1` + 6–87 data/checksum chars (v1 p2tr = 62
    // total).  All-lowercase by spec; reject mixed-case and non-bech32 chars.
    let lower_bare = bare.to_ascii_lowercase();
    if bare.len() >= 20
        && bare.len() <= 90
        && lower_bare.starts_with("prl1")
        && bare == lower_bare.as_str()
        && bare[4..]
            .chars()
            .all(|c| "qpzry9x8gf2tvdw0s3jn54khce6mua7l".contains(c))
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
    fn startup_recovery_replays_prepared_revenue_after_pre_snapshot_crash() {
        let root = std::env::temp_dir().join(format!(
            "zion_pool_revenue_recovery_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let state_path = root.join("pplns.json");
        let config = PoolConfig {
            native_payout_coins: vec!["qtu".into()],
            state_path: Some(state_path.to_string_lossy().into_owned()),
            ..config()
        };
        let store = ShareStore::open_in_memory().unwrap();
        let mut original = Pool::new(config.clone(), telemetry());
        original
            .pplns
            .register_address_with_chain("alice", "qz1alice", "quantus");
        original
            .pplns
            .record_share_with_diff_for_coin("alice", "rig", 1, 100, "qtu");
        original.save().unwrap();
        store
            .begin_coin_revenue("qtu:recovery:1", "qtu", 5_000_000, 42)
            .unwrap();
        let outcome = original
            .on_coin_revenue("qtu", 5_000_000, 42, "qtu:recovery:1")
            .unwrap();
        store
            .prepare_coin_revenue(
                "qtu:recovery:1",
                outcome.emitted,
                outcome.emitted_total,
                &outcome.payouts,
            )
            .unwrap();
        drop(original);

        let mut restarted = Pool::try_new(config.clone(), telemetry()).unwrap();
        assert!(!restarted.pplns.has_applied_revenue_event("qtu:recovery:1"));
        assert_eq!(
            recover_pending_coin_revenue(&mut restarted, &store).unwrap(),
            1
        );
        assert!(store.pending_coin_revenue().unwrap().is_empty());
        assert_eq!(
            store.coin_revenue_outbox_count("qtu:recovery:1").unwrap(),
            1
        );
        assert_eq!(
            store.pending_coin_revenue_payouts("quantus").unwrap().len(),
            1
        );

        let restored = Pool::try_new(config, telemetry()).unwrap();
        assert!(restored.pplns.has_applied_revenue_event("qtu:recovery:1"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn try_new_fails_when_configured_snapshot_is_corrupt() {
        let path = std::env::temp_dir().join(format!(
            "zion_pool_corrupt_snapshot_{}.json",
            std::process::id()
        ));
        std::fs::write(&path, b"{not-json").unwrap();

        let err = Pool::try_new(
            PoolConfig {
                state_path: Some(path.to_string_lossy().into_owned()),
                ..config()
            },
            telemetry(),
        )
        .unwrap_err();

        assert!(format!("{err:#}").contains("failed to load PPLNS state"));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn failed_pplns_snapshot_save_is_counted_and_retried() {
        let root =
            std::env::temp_dir().join(format!("zion_pool_snapshot_retry_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("missing").join("state.json");
        let mut pool = Pool::new(
            PoolConfig {
                state_path: Some(path.to_string_lossy().into_owned()),
                ..config()
            },
            telemetry(),
        );
        pool.pplns.record_share_at("miner", "worker", 1, 10);

        assert!(pool.save().is_err());
        assert_eq!(pool.pplns_persist_failures_total, 1);
        assert_eq!(pool.pplns_persist_success_timestamp_s, 0);

        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        assert!(pool.save().unwrap());
        assert_eq!(pool.pplns_persist_failures_total, 1);
        assert!(pool.pplns_persist_success_timestamp_s > 0);

        std::fs::remove_dir_all(root).unwrap();
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
    fn dedup_marks_survive_restart_via_store() {
        let store = Arc::new(ShareStore::open_in_memory().unwrap());
        let mut pool = Pool::new(config(), telemetry());
        pool.attach_dedup_store(store.clone());

        // First external share credits; the exact replay does not.
        assert!(pool.record_external_share("miner", "w1", 100, 500, "qtu", "job-a", "nonce-1"));
        assert!(!pool.record_external_share("miner", "w1", 100, 500, "qtu", "job-a", "nonce-1"));

        // The mark lands via the queued writer — wait for the batch
        // flush before the simulated restart attaches.
        std::thread::sleep(std::time::Duration::from_millis(700));

        // A "restarted" pool attaching the same store sees the mark —
        // the replay is rejected before any credit. (ext: job ids are
        // upstream-keyed and outlive the process.)
        let mut restarted = Pool::new(config(), telemetry());
        restarted.attach_dedup_store(store.clone());
        assert!(
            !restarted.record_external_share("miner", "w1", 100, 500, "qtu", "job-a", "nonce-1")
        );
        // …but a genuinely new tag on the same upstream job still credits.
        assert!(restarted.record_external_share("miner", "w1", 100, 500, "qtu", "job-a", "nonce-2"));
    }

    #[test]
    fn dedup_store_write_failure_does_not_reject_share() {
        // No store attached → identical in-memory behavior.
        let mut pool = Pool::new(config(), telemetry());
        assert!(pool.record_external_share("miner", "w1", 100, 500, "qtu", "job-a", "tag"));
        assert!(!pool.record_external_share("miner", "w1", 100, 500, "qtu", "job-a", "tag"));
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
    fn settle_payout_drains_zion_and_keeps_external() {
        let mut pool = Pool::new(
            PoolConfig {
                min_payout_flowers: 0,
                ..config()
            },
            telemetry(),
        );
        pool.pplns.register_address("alice", "z1alice");
        pool.pplns.record_share_with_diff("alice", "rig", 1, 100);
        pool.on_block_found(100, 1_000_000);

        // Queue also holds an external-chain entry the zion path must not
        // touch.
        pool.pending_payouts.push((
            100,
            PayoutEntry {
                miner_id: "bob".into(),
                address: "qtu1bob".into(),
                amount: 42,
                share_count: 1,
                payout_chain: Some("quantus".into()),
                native_units: true,
                coin: Some("qtu".into()),
                revenue_event: None,
            },
        ));

        let pending_before = pool.pending_payouts.len();
        pool.settle_payout(100, "z1alice");

        // ZION entry drained + marked sent; external entry untouched.
        assert_eq!(pool.pending_payouts.len(), pending_before - 1);
        assert!(pool
            .pending_payouts
            .iter()
            .all(|(_, p)| p.chain() == "quantus"));
        assert!(pool.sent_payouts.contains(&(100, "z1alice".to_string())));
    }

    #[test]
    fn payout_ledger_survives_restart() {
        let dir = std::env::temp_dir().join(format!(
            "zion-pool-ledger-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let state_path = dir.join("pplns.json");
        let cfg = PoolConfig {
            state_path: Some(state_path.to_string_lossy().into_owned()),
            min_payout_flowers: 0,
            ..config()
        };

        // First process lifetime: block found, one payout queued and sent.
        {
            let mut pool = Pool::new(cfg.clone(), telemetry());
            pool.pplns.register_address("alice", "z1alice");
            pool.pplns.record_share_with_diff("alice", "rig", 1, 100);
            pool.on_block_found(100, 1_000_000);
            let pending = pool.take_pending_payouts();
            assert_eq!(pending.len(), 1);
            pool.mark_payout_sent(100, &pending[0].1.address);
        }

        // Restart: guards restored, reprocessing the height is a no-op.
        {
            let mut pool = Pool::new(cfg.clone(), telemetry());
            assert!(pool.paid_block_heights.contains(&100));
            assert_eq!(pool.sent_payouts.len(), 1);
            pool.on_block_found(100, 1_000_000);
            assert!(
                pool.take_pending_payouts().is_empty(),
                "height 100 must not re-pay after restart"
            );
        }

        // Requeue persists — a crashed sweep restores pending entries.
        {
            let mut pool = Pool::new(cfg.clone(), telemetry());
            pool.on_block_found(101, 1_000_000);
            let pending = pool.take_pending_payouts();
            // PPLNS window was not snapshotted (no save()), so height 101 may
            // emit nothing — enqueue directly to exercise the ledger path.
            if pending.is_empty() {
                pool.requeue_payouts(vec![(
                    101,
                    PayoutEntry {
                        miner_id: "alice".into(),
                        address: "z1alice".into(),
                        amount: 42,
                        share_count: 1,
                        payout_chain: None,
                        native_units: false,
                        coin: None,
                        revenue_event: None,
                    },
                )]);
            } else {
                pool.requeue_payouts(pending);
            }
        }
        {
            let mut pool = Pool::new(cfg, telemetry());
            let pending = pool.take_pending_payouts();
            assert_eq!(pending.len(), 1, "requeued payout must survive restart");
        }

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn coin_revenue_distributes_native_units() {
        let mut pool = Pool::new(
            PoolConfig {
                native_payout_coins: vec!["qtu".into()],
                ..config()
            },
            telemetry(),
        );
        pool.pplns
            .register_address_with_chain("alice", "qz1alice", "quantus");
        pool.pplns
            .record_share_with_diff_for_coin("alice", "rig", 1, 100, "qtu");

        // Coin not enabled for native payouts → CoinNotNative.
        assert!(matches!(
            pool.on_coin_revenue("zion", 1000, 42, "zion:bal:0:1000"),
            Err(PoolError::CoinNotNative)
        ));
        // Empty event id → DuplicateRevenueEvent.
        assert!(matches!(
            pool.on_coin_revenue("qtu", 1000, 42, ""),
            Err(PoolError::DuplicateRevenueEvent)
        ));

        let out = pool
            .on_coin_revenue("QTU", 5_000_000, 42, "qtu:bal:0:5m")
            .unwrap();
        assert_eq!(out.coin, "qtu");
        assert_eq!(out.emitted, 1);
        assert_eq!(out.emitted_total, 5_000_000);

        // Duplicate event id is rejected — retries can't double-pay.
        assert!(matches!(
            pool.on_coin_revenue("qtu", 5_000_000, 42, "qtu:bal:0:5m"),
            Err(PoolError::DuplicateRevenueEvent)
        ));

        // The emitted entry is a native-unit quantus payout carrying the
        // event id, drained via the quantus external queue.
        let drained = pool.take_external_payouts("quantus");
        assert_eq!(drained.len(), 1);
        let (h, p) = &drained[0];
        assert_eq!(*h, 42);
        assert_eq!(p.miner_id, "alice");
        assert_eq!(p.amount, 5_000_000);
        assert_eq!(p.unit(), "native");
        assert_eq!(p.coin.as_deref(), Some("qtu"));
        assert_eq!(p.revenue_event.as_deref(), Some("qtu:bal:0:5m"));
        // Nothing leaked into the ZION queue.
        assert!(pool.take_pending_payouts().is_empty());

        let snapshot = pool.pplns.snapshot();
        let mut restored = Pool::new(
            PoolConfig {
                native_payout_coins: vec!["qtu".into()],
                ..config()
            },
            telemetry(),
        );
        restored.pplns.restore(snapshot);
        assert!(matches!(
            restored.on_coin_revenue("qtu", 5_000_000, 42, "qtu:bal:0:5m"),
            Err(PoolError::DuplicateRevenueEvent)
        ));
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
        assert_eq!(parse_quantus_payout(QTC_ADDR).as_deref(), Some(QTC_ADDR));
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

    const PRL_ADDR: &str = "prl1p29st0fecym0gk9zyh8ch90sxkf6apmwqdznk0tvu6kf5wxwsmqxqqzwjdm";

    #[test]
    fn pearl_worker_parses_prl_prefix() {
        assert_eq!(
            parse_pearl_payout(&format!("prl:{PRL_ADDR}")).as_deref(),
            Some(PRL_ADDR)
        );
        assert_eq!(
            parse_pearl_payout(&format!("pearl:{PRL_ADDR}")).as_deref(),
            Some(PRL_ADDR)
        );
        assert_eq!(
            parse_pearl_payout(&format!("PRL:{PRL_ADDR}")).as_deref(),
            Some(PRL_ADDR)
        );
        assert_eq!(parse_pearl_payout(PRL_ADDR).as_deref(), Some(PRL_ADDR));
        assert_eq!(parse_pearl_payout("zion1abc"), None);
        assert_eq!(parse_pearl_payout("prl1"), None);
        assert_eq!(
            parse_pearl_payout(PRL_ADDR.to_ascii_uppercase().as_str()),
            None
        );
        assert_eq!(parse_pearl_payout(&format!("prl:{QTC_ADDR}")), None);
    }

    #[test]
    fn pearl_worker_registers_external_payout() {
        let mut pool = Pool::new(config(), telemetry());
        pool.register_worker(&format!("prl:{PRL_ADDR}.rig1"));
        let (chain, addr) = pool.worker_payout_target(&format!("prl:{PRL_ADDR}.rig1"));
        assert_eq!(chain, "pearl");
        assert_eq!(addr, PRL_ADDR);
        // Bare prl1 wallet (native pearl stratum identity) routes too.
        let (chain, addr) = pool.worker_payout_target(&format!("{PRL_ADDR}.rig1"));
        assert_eq!(chain, "pearl");
        assert_eq!(addr, PRL_ADDR);
    }

    #[test]
    fn explicit_payout_address_routes_pearl() {
        let mut pool = Pool::new(config(), telemetry());
        let pa = format!("prl:{PRL_ADDR}");
        let res = pool.register_payout_address("miner43", &pa);
        assert_eq!(res.map(|(c, a)| (c, a)), Some(("pearl", &pa[..])));
        let (chain, addr) = pool.worker_payout_target("miner43.rigB");
        assert_eq!(chain, "pearl");
        assert_eq!(addr, PRL_ADDR);
    }

    /// F2c: shares recorded through the pool carry a coin tag that lands
    /// in `PplnsEngine::coin_stats` — auxpow submits take the ExternalCoin
    /// ticker, external-stream credits take the leg's coin string.
    #[test]
    fn shares_carry_coin_tags_into_pplns() {
        let mut pool = Pool::new(config(), telemetry());
        let sub = ShareSubmission {
            worker: "zion1m".into(),
            job_id: "j1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        pool.submit_zion(sub, b"h", 1).unwrap();

        let sub = ShareSubmission {
            worker: "zion1m".into(),
            job_id: "j2".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 2,
        };
        pool.submit_auxpow(ExternalCoin::Quantus, sub, b"h", 1)
            .unwrap();

        // Native QTU leg credits via record_external_share with "qtu".
        assert!(pool.record_external_share("wallet", "wallet.rig", 1, 4, "qtu", "job1", "nonce1"));
        // Pearl native leg credits via record_external_share with "prl".
        assert!(pool.record_external_share(
            "wallet2",
            "wallet2.rig",
            1,
            8,
            "prl",
            "job1",
            "proof1"
        ));
        // P-01: a replayed (job, tag) pair draws no second credit.
        assert!(!pool.record_external_share("wallet", "wallet.rig", 1, 4, "qtu", "job1", "nonce1"));

        let stats = pool.pplns.coin_stats();
        let find = |c: &str| stats.iter().find(|s| s.coin == c).unwrap();
        assert_eq!(find("zion").accepted_total, 1);
        // auxpow Quantus submit (weight 2) + external "qtu" credit (4) → 6
        assert_eq!(find("qtu").accepted_total, 2);
        assert_eq!(find("qtu").window_weight, 6);
        assert_eq!(find("prl").accepted_total, 1);
        assert_eq!(find("prl").window_weight, 8);
    }
}
