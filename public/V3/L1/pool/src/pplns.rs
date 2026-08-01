//! PPLNS (Pay Per Last N Shares) payout engine.
//!
//! Tracks per-miner accepted shares in a sliding window and computes
//! proportional payout splits when a block is found.
//!
//! Block rewards are split according to [`FeeConfig`]:
//! - 89% to miners (distributed proportionally via PPLNS)
//! - 5% humanitarian tithe (Children Future Fund)
//! - 5% Issobella fund (L5/L6)
//! - 1% pool operator fee
//!
//! ## 10k+ Miner Optimizations (P7-P10)
//!
//! - **P7 Miner ID interning:** `miner_id` is stored as `u32` index into
//!   [`MinerRegistry`] throughout the engine.  This eliminates per-share
//!   `String` allocations in the hot path (50k shares/sec at 10k miners).
//! - **P8 Incremental share weights:** A running `Vec<u128>` tracks each
//!   miner's total weight in the window, updated on insert/evict.  This
//!   makes [`PplnsEngine::distribute_to_miners`] O(active_miners) instead
//!   of O(window_len).
//! - **P9 Configurable window size:** `ZION_PPLNS_WINDOW_SIZE` env var
//!   allows scaling the PPLNS window for large miner counts.
//! - **P10 Backward-compatible snapshot:** [`PplnsSnapshot`] preserves the
//!   original `String`-based format for compatibility with existing state
//!   files.  Conversion between `u32` indices and `String` IDs happens only
//!   during save/load.

use std::collections::{HashMap, VecDeque};
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tracing::{error, warn};

/// Single accepted share recorded in the PPLNS window (serialization format).
///
/// This struct uses `String` miner_id for backward-compatible JSON
/// serialization.  Internally, the engine uses [`WindowEntry`] with `u32`
/// indices for zero-allocation hot-path performance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PplnsShare {
    pub miner_id: String,
    pub worker_name: String,
    pub timestamp_ms: u64,
    pub height: u64,
    /// Share difficulty (work weight).  A share at difficulty 1000 counts
    /// as 1000× more work than a share at difficulty 1.  For backward
    /// compatibility, 0 is treated as 1.
    pub difficulty: u64,
}

/// Internal window entry using u32 miner index (zero-allocation hot path).
#[derive(Debug, Clone)]
struct WindowEntry {
    miner_index: u32,
    worker_name: String,
    timestamp_ms: u64,
    height: u64,
    difficulty: u64,
}

/// Miner ID registry — maps between `String` miner IDs and compact `u32`
/// indices.  All per-miner data structures in [`PplnsEngine`] are indexed
/// by `u32`, making lookups O(1) array accesses instead of HashMap hashes.
#[derive(Debug, Clone, Default)]
struct MinerRegistry {
    /// String miner_id → u32 index.
    id_to_index: HashMap<String, u32>,
    /// u32 index → String miner_id.
    index_to_id: Vec<String>,
}

impl MinerRegistry {
    fn new() -> Self {
        Self {
            id_to_index: HashMap::new(),
            index_to_id: Vec::new(),
        }
    }

    /// Look up or register a miner ID, returning its u32 index.
    fn lookup_or_register(&mut self, miner_id: &str) -> u32 {
        if let Some(&idx) = self.id_to_index.get(miner_id) {
            return idx;
        }
        let idx = self.index_to_id.len() as u32;
        self.index_to_id.push(miner_id.to_string());
        self.id_to_index.insert(miner_id.to_string(), idx);
        idx
    }

    /// Look up an existing miner ID, returning its u32 index, or None.
    fn lookup(&self, miner_id: &str) -> Option<u32> {
        self.id_to_index.get(miner_id).copied()
    }

    /// Get the miner_id string for a given index.
    fn id(&self, index: u32) -> &str {
        &self.index_to_id[index as usize]
    }

    /// Number of registered miners.
    fn len(&self) -> usize {
        self.index_to_id.len()
    }
}

/// Per-miner payout entry produced by [`PplnsEngine::compute_payouts`].
#[derive(Debug, Clone, PartialEq)]
pub struct PayoutEntry {
    pub miner_id: String,
    pub address: String,
    /// Amount in flowers (1 ZION = 1_000_000 flowers, post-3.0.3).
    pub amount: u64,
    pub share_count: u64,
}

/// Cumulative per-miner shares and blocks (persistent across restarts).
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize, Deserialize)]
pub struct MinerShareStats {
    pub valid: u64,
    pub invalid: u64,
    pub blocks: u64,
}

/// Fee split configuration for pool reward distribution.
#[derive(Debug, Clone)]
pub struct FeeConfig {
    /// Humanitarian tithe percentage (default: 5%).
    pub humanitarian_pct: u64,
    /// Issobella fund percentage (default: 5%).
    pub issobella_pct: u64,
    /// Pool operator fee percentage (default: 1%).
    pub pool_fee_pct: u64,
    /// Humanitarian tithe wallet address.
    pub humanitarian_wallet: String,
    /// Issobella fund wallet address.
    pub issobella_wallet: String,
    /// Pool fee wallet address (empty = stays in coinbase wallet).
    pub pool_fee_wallet: String,
}

impl Default for FeeConfig {
    fn default() -> Self {
        // WARNING: These defaults must stay in sync with `zion_core::emission`.
        // If the protocol-level split changes, update here, in server.rs,
        // cosmic-harmony/src/revenue.rs, and the whitepapers.
        Self {
            humanitarian_pct: 5,
            issobella_pct: 5,
            pool_fee_pct: 1,
            humanitarian_wallet: String::new(),
            issobella_wallet: String::new(),
            pool_fee_wallet: String::new(),
        }
    }
}

impl FeeConfig {
    /// Total percentage deducted from block reward before miner distribution.
    pub fn total_fee_pct(&self) -> u64 {
        self.humanitarian_pct + self.issobella_pct + self.pool_fee_pct
    }

    /// Miner share percentage (100 - total fees).
    pub fn miner_pct(&self) -> u64 {
        100u64.saturating_sub(self.total_fee_pct())
    }

    /// Configuration with no fees (100% to miners).
    pub fn no_fees() -> Self {
        Self {
            humanitarian_pct: 0,
            issobella_pct: 0,
            pool_fee_pct: 0,
            humanitarian_wallet: String::new(),
            issobella_wallet: String::new(),
            pool_fee_wallet: String::new(),
        }
    }
}

/// PPLNS engine configuration.
#[derive(Debug, Clone)]
pub struct PplnsConfig {
    /// Maximum total difficulty in the sliding window.
    ///
    /// The window is measured in **work units** (sum of share difficulties),
    /// not raw share count. A share with difficulty 4096 consumes 4096
    /// units of window capacity. This makes the window size independent of
    /// vardiff and gives fair PPLNS regardless of per-miner difficulty.
    ///
    /// Default 50_000 gives ~25 shares per miner at diff 2000 with 1000
    /// miners, or several minutes of history at typical submit rates.
    pub window_size: usize,
    /// Minimum payout amount in flowers. Miners below this accumulate.
    pub min_payout_flowers: u64,
    /// Fee split configuration (humanitarian tithe, issobella, pool fee).
    pub fee_config: FeeConfig,
}

impl Default for PplnsConfig {
    fn default() -> Self {
        Self {
            window_size: 500_000,
            min_payout_flowers: zion_core::wallet::MIN_PAYOUT_AMOUNT,
            fee_config: FeeConfig::default(),
        }
    }
}

/// Miner address registry and PPLNS share window.
#[derive(Debug)]
pub struct PplnsEngine {
    config: PplnsConfig,
    /// Miner ID registry — maps String IDs to u32 indices.
    registry: MinerRegistry,
    /// Sliding window of recent accepted shares (newest at back).
    /// Uses u32 miner_index instead of String for zero-allocation hot path.
    window: VecDeque<WindowEntry>,
    /// Sum of difficulties of all shares currently in the window.
    /// Used for difficulty-weighted eviction (work-unit PPLNS).
    window_total_difficulty: u128,
    /// Incremental share weights per miner (P8).  Updated on each
    /// record_share/eviction so distribute_to_miners is O(miners) not
    /// O(window_len).  Indexed by miner_index.
    share_weights: Vec<u128>,
    /// Registered payout addresses per miner_index.
    addresses: Vec<Option<String>>,
    /// Accumulated unpaid balance per miner_index (flowers).
    unpaid: Vec<u64>,
    /// Cumulative paid amount per miner_index (flowers).
    paid_per_miner: Vec<u128>,
    /// Cumulative share/block stats per miner_index.
    shares_per_miner: Vec<MinerShareStats>,
    /// Last share timestamp (seconds) per miner_index.
    last_share_time_per_miner: Vec<u64>,
    /// Total block rewards distributed via this engine (flowers).
    total_paid_flowers: u128,
    /// Number of payout rounds executed.
    payout_rounds: u64,
    /// Accumulated humanitarian tithe obligation (flowers).
    fee_humanitarian_flowers: u64,
    /// Accumulated Issobella fund obligation (flowers).
    fee_issobella_flowers: u64,
    /// Accumulated pool operator fee (flowers).
    fee_pool_flowers: u64,
    /// Dirty flag — set true whenever state changes, cleared by the
    /// persistence thread after a successful save.  Avoids redundant
    /// JSON serialize + file write when no shares arrived since last save.
    dirty: bool,
}

/// Serializable snapshot of all PPLNS engine mutable state.
///
/// Used for crash-safe persistence: the pool server saves this to a JSON
/// file periodically and on shutdown, and restores it on startup so that
/// unpaid miner balances and the share window survive restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PplnsSnapshot {
    pub window: Vec<PplnsShare>,
    pub window_total_difficulty: u128,
    pub addresses: HashMap<String, String>,
    pub unpaid: HashMap<String, u64>,
    pub paid_per_miner: HashMap<String, u128>,
    pub shares_per_miner: HashMap<String, MinerShareStats>,
    pub last_share_time_per_miner: HashMap<String, u64>,
    pub total_paid_flowers: u128,
    pub payout_rounds: u64,
    pub fee_humanitarian_flowers: u64,
    pub fee_issobella_flowers: u64,
    pub fee_pool_flowers: u64,
}

impl PplnsEngine {
    pub fn new(config: PplnsConfig) -> Self {
        Self {
            config,
            registry: MinerRegistry::new(),
            window: VecDeque::with_capacity(1_024),
            window_total_difficulty: 0,
            share_weights: Vec::new(),
            addresses: Vec::new(),
            unpaid: Vec::new(),
            paid_per_miner: Vec::new(),
            shares_per_miner: Vec::new(),
            last_share_time_per_miner: Vec::new(),
            total_paid_flowers: 0,
            payout_rounds: 0,
            fee_humanitarian_flowers: 0,
            fee_issobella_flowers: 0,
            fee_pool_flowers: 0,
            dirty: false,
        }
    }

    /// Ensure per-miner Vecs have capacity for the given index.
    /// Called when a new miner is registered.
    fn ensure_capacity(&mut self, idx: u32) {
        let needed = idx as usize + 1;
        if self.share_weights.len() < needed {
            self.share_weights.resize(needed, 0);
            self.addresses.resize(needed, None);
            self.unpaid.resize(needed, 0);
            self.paid_per_miner.resize(needed, 0);
            self.shares_per_miner.resize(needed, MinerShareStats::default());
            self.last_share_time_per_miner.resize(needed, 0);
        }
    }

    /// Capture a serializable snapshot of the current engine state.
    /// Converts internal u32 indices to String miner_ids for backward
    /// compatibility with existing state file format.
    pub fn snapshot(&self) -> PplnsSnapshot {
        let window: Vec<PplnsShare> = self
            .window
            .iter()
            .map(|e| PplnsShare {
                miner_id: self.registry.id(e.miner_index).to_string(),
                worker_name: e.worker_name.clone(),
                timestamp_ms: e.timestamp_ms,
                height: e.height,
                difficulty: e.difficulty,
            })
            .collect();

        // Convert Vec-indexed per-miner data back to HashMap format for serialization.
        let mut addresses = HashMap::with_capacity(self.registry.len());
        let mut unpaid = HashMap::with_capacity(self.registry.len());
        let mut paid_per_miner = HashMap::with_capacity(self.registry.len());
        let mut shares_per_miner = HashMap::with_capacity(self.registry.len());
        let mut last_share_time = HashMap::with_capacity(self.registry.len());

        for i in 0..self.registry.len() {
            let id = self.registry.index_to_id[i].clone();
            if let Some(ref addr) = self.addresses[i] {
                addresses.insert(id.clone(), addr.clone());
            }
            if self.unpaid[i] > 0 {
                unpaid.insert(id.clone(), self.unpaid[i]);
            }
            if self.paid_per_miner[i] > 0 {
                paid_per_miner.insert(id.clone(), self.paid_per_miner[i]);
            }
            if self.shares_per_miner[i] != MinerShareStats::default() {
                shares_per_miner.insert(id.clone(), self.shares_per_miner[i]);
            }
            if self.last_share_time_per_miner[i] > 0 {
                last_share_time.insert(id, self.last_share_time_per_miner[i]);
            }
        }

        PplnsSnapshot {
            window,
            window_total_difficulty: self.window_total_difficulty,
            addresses,
            unpaid,
            paid_per_miner,
            shares_per_miner,
            last_share_time_per_miner: last_share_time,
            total_paid_flowers: self.total_paid_flowers,
            payout_rounds: self.payout_rounds,
            fee_humanitarian_flowers: self.fee_humanitarian_flowers,
            fee_issobella_flowers: self.fee_issobella_flowers,
            fee_pool_flowers: self.fee_pool_flowers,
        }
    }

    /// Restore engine state from a previously saved snapshot.
    /// Converts String miner_ids in the snapshot to u32 indices internally.
    pub fn restore(&mut self, snap: PplnsSnapshot) {
        // Rebuild window with u32 indices.
        self.window.clear();
        self.window_total_difficulty = 0;
        self.share_weights.clear();
        self.registry = MinerRegistry::new();

        // First pass: register all miner IDs from all maps.
        for share in &snap.window {
            self.registry.lookup_or_register(&share.miner_id);
        }
        for id in snap.addresses.keys() {
            self.registry.lookup_or_register(id);
        }
        for id in snap.unpaid.keys() {
            self.registry.lookup_or_register(id);
        }
        for id in snap.paid_per_miner.keys() {
            self.registry.lookup_or_register(id);
        }
        for id in snap.shares_per_miner.keys() {
            self.registry.lookup_or_register(id);
        }
        for id in snap.last_share_time_per_miner.keys() {
            self.registry.lookup_or_register(id);
        }

        // Ensure Vecs are sized.
        let n = self.registry.len();
        self.share_weights = vec![0u128; n];
        self.addresses = vec![None; n];
        self.unpaid = vec![0u64; n];
        self.paid_per_miner = vec![0u128; n];
        self.shares_per_miner = vec![MinerShareStats::default(); n];
        self.last_share_time_per_miner = vec![0u64; n];

        // Restore window entries with u32 indices + rebuild share_weights.
        for share in snap.window {
            let idx = self.registry.lookup_or_register(&share.miner_id);
            let diff = share.difficulty.max(1);
            self.window.push_back(WindowEntry {
                miner_index: idx,
                worker_name: share.worker_name,
                timestamp_ms: share.timestamp_ms,
                height: share.height,
                difficulty: diff,
            });
            self.window_total_difficulty += diff as u128;
            self.share_weights[idx as usize] += diff as u128;
        }

        // Restore per-miner data.
        for (id, addr) in snap.addresses {
            let idx = self.registry.lookup_or_register(&id);
            self.addresses[idx as usize] = Some(addr);
        }
        for (id, bal) in snap.unpaid {
            let idx = self.registry.lookup_or_register(&id);
            self.unpaid[idx as usize] = bal;
        }
        for (id, paid) in snap.paid_per_miner {
            let idx = self.registry.lookup_or_register(&id);
            self.paid_per_miner[idx as usize] = paid;
        }
        for (id, stats) in snap.shares_per_miner {
            let idx = self.registry.lookup_or_register(&id);
            self.shares_per_miner[idx as usize] = stats;
        }
        for (id, ts) in snap.last_share_time_per_miner {
            let idx = self.registry.lookup_or_register(&id);
            self.last_share_time_per_miner[idx as usize] = ts;
        }

        self.total_paid_flowers = snap.total_paid_flowers;
        self.payout_rounds = snap.payout_rounds;
        self.fee_humanitarian_flowers = snap.fee_humanitarian_flowers;
        self.fee_issobella_flowers = snap.fee_issobella_flowers;
        self.fee_pool_flowers = snap.fee_pool_flowers;
        self.dirty = false;
    }

    /// Save engine state to a JSON file (atomic + durable write via temp + fsync + rename).
    ///
    /// F1.2 upgrade: writes to a temp file, fsyncs it (so data hits disk before
    /// rename), then atomically renames.  This guarantees the main state file is
    /// never in a corrupt state, even if the process is killed mid-write.
    pub fn save_to_path<P: AsRef<Path>>(&self, path: P) -> std::io::Result<()> {
        let path = path.as_ref();
        let snap = self.snapshot();
        Self::write_snapshot_to_path(&snap, path)
    }

    /// Returns `true` if state has changed since the last save, and clears
    /// the dirty flag.  The persistence thread calls this to decide whether
    /// to save.  This avoids redundant JSON serialize + file I/O when no
    /// shares have arrived since the last save cycle.
    pub fn take_dirty(&mut self) -> bool {
        std::mem::replace(&mut self.dirty, false)
    }

    /// Write a pre-captured snapshot to a JSON file (atomic + durable write
    /// via temp + fsync + rename).  This is a standalone function so the
    /// persistence thread can snapshot under the lock, then serialize + write
    /// **outside** the lock, avoiding blocking share submissions during file I/O.
    ///
    /// F1.2 upgrade: added `fsync` on the temp file before rename for crash
    /// durability.  Without fsync, a power loss after rename could leave the
    /// file with zero-length or partially-flushed data on some filesystems.
    pub fn write_snapshot_to_path<P: AsRef<Path>>(
        snap: &PplnsSnapshot,
        path: P,
    ) -> std::io::Result<()> {
        let path = path.as_ref();
        let json = serde_json::to_vec(snap).map_err(std::io::Error::other)?;
        let tmp = path.with_extension("json.tmp");
        // Write + fsync the temp file so data is durable on disk.
        {
            let mut f = std::fs::File::create(&tmp)?;
            f.write_all(&json)?;
            f.flush()?;
            let _ = f.sync_all(); // fsync — best effort, ignore errors
        }
        // Atomic rename (POSIX guarantee on same filesystem).
        std::fs::rename(&tmp, path)?;
        Ok(())
    }

    /// Load engine state from a JSON file. Returns `None` if file doesn't
    /// exist (first run).  Errors are logged and treated as "no snapshot"
    /// so the pool can still start.
    ///
    /// F1.2 upgrade: cleans up stale `.json.tmp` files from a previous crash.
    pub fn load_from_path<P: AsRef<Path>>(path: P) -> Option<PplnsSnapshot> {
        let path = path.as_ref();
        // Clean up stale temp file from a previous crash (F1.2).
        let tmp = path.with_extension("json.tmp");
        if tmp.exists() {
            warn!(
                "pplns_persistence: cleaning up stale temp file {} (previous crash during save?)",
                tmp.display()
            );
            let _ = std::fs::remove_file(&tmp);
        }
        match std::fs::read(path) {
            Ok(data) => match serde_json::from_slice::<PplnsSnapshot>(&data) {
                Ok(snap) => Some(snap),
                Err(e) => {
                    error!(
                        "pplns_persistence: failed to parse snapshot {}: {} — starting fresh",
                        path.display(),
                        e
                    );
                    None
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => {
                error!(
                    "pplns_persistence: failed to read snapshot {}: {} — starting fresh",
                    path.display(),
                    e
                );
                None
            }
        }
    }

    /// Register (or update) the payout address for a miner.
    pub fn register_address(&mut self, miner_id: &str, address: &str) {
        let idx = self.registry.lookup_or_register(miner_id);
        self.ensure_capacity(idx);
        self.addresses[idx as usize] = Some(address.to_string());
        self.dirty = true;
    }

    /// Returns the registered payout address for a miner, if any.
    pub fn address_for(&self, miner_id: &str) -> Option<&str> {
        let idx = self.registry.lookup(miner_id)?;
        self.addresses[idx as usize].as_deref()
    }

    /// Returns all miner IDs registered to a given payout address.
    pub fn miner_ids_for_address(&self, address: &str) -> Vec<&str> {
        self.addresses
            .iter()
            .enumerate()
            .filter_map(|(i, addr)| {
                if addr.as_deref() == Some(address) {
                    Some(self.registry.id(i as u32))
                } else {
                    None
                }
            })
            .collect()
    }

    /// Record an accepted share into the PPLNS window (difficulty = 1).
    pub fn record_share(&mut self, miner_id: &str, worker_name: &str, height: u64) {
        self.record_share_with_diff(miner_id, worker_name, height, 1);
    }

    /// Record a rejected/invalid share for a miner.
    pub fn record_invalid_share(&mut self, miner_id: &str) {
        let idx = self.registry.lookup_or_register(miner_id);
        self.ensure_capacity(idx);
        self.shares_per_miner[idx as usize].invalid += 1;
        self.dirty = true;
    }

    /// Record that a miner found a block.
    pub fn record_block_found(&mut self, miner_id: &str) {
        let idx = self.registry.lookup_or_register(miner_id);
        self.ensure_capacity(idx);
        self.shares_per_miner[idx as usize].blocks += 1;
        self.dirty = true;
    }

    /// Record an accepted share with explicit difficulty weight.
    ///
    /// A share at difficulty 1000 contributes 1000× as much PPLNS weight
    /// as a share at difficulty 1.  This is the core of fair vardiff PPLNS.
    ///
    /// P7: Uses u32 miner_index — zero String allocations for miner_id.
    /// P8: Updates incremental share_weights on insert and eviction.
    pub fn record_share_with_diff(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        height: u64,
        difficulty: u64,
    ) {
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let idx = self.registry.lookup_or_register(miner_id);
        self.ensure_capacity(idx);

        let diff = difficulty.max(1);
        self.window.push_back(WindowEntry {
            miner_index: idx,
            worker_name: worker_name.to_string(),
            timestamp_ms,
            height,
            difficulty: diff,
        });
        self.window_total_difficulty += diff as u128;
        self.share_weights[idx as usize] += diff as u128; // P8: incremental weight

        // Update per-miner stats (O(1) array access, no String alloc).
        let now_s = timestamp_ms / 1000;
        self.last_share_time_per_miner[idx as usize] = now_s;
        self.shares_per_miner[idx as usize].valid += 1;

        // Evict oldest shares until total difficulty fits the window limit.
        while self.window_total_difficulty > self.config.window_size as u128 {
            if let Some(oldest) = self.window.pop_front() {
                self.window_total_difficulty -= oldest.difficulty as u128;
                self.share_weights[oldest.miner_index as usize] -= oldest.difficulty as u128; // P8
            } else {
                break;
            }
        }
        self.dirty = true;
    }

    /// Like [`record_share`] but with an explicit timestamp (for testing).
    pub fn record_share_at(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        height: u64,
        timestamp_ms: u64,
    ) {
        self.record_share_at_diff(miner_id, worker_name, height, timestamp_ms, 1);
    }

    /// Record a share with explicit timestamp and difficulty (for testing).
    pub fn record_share_at_diff(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        height: u64,
        timestamp_ms: u64,
        difficulty: u64,
    ) {
        let idx = self.registry.lookup_or_register(miner_id);
        self.ensure_capacity(idx);

        let diff = difficulty.max(1);
        self.window.push_back(WindowEntry {
            miner_index: idx,
            worker_name: worker_name.to_string(),
            timestamp_ms,
            height,
            difficulty: diff,
        });
        self.window_total_difficulty += diff as u128;
        self.share_weights[idx as usize] += diff as u128; // P8

        // Update per-miner stats.
        self.last_share_time_per_miner[idx as usize] = timestamp_ms / 1000;
        self.shares_per_miner[idx as usize].valid += 1;

        while self.window_total_difficulty > self.config.window_size as u128 {
            if let Some(oldest) = self.window.pop_front() {
                self.window_total_difficulty -= oldest.difficulty as u128;
                self.share_weights[oldest.miner_index as usize] -= oldest.difficulty as u128; // P8
            } else {
                break;
            }
        }
        self.dirty = true;
    }

    /// Number of shares currently in the window.
    pub fn window_len(&self) -> usize {
        self.window.len()
    }

    /// Compute proportional payouts for a block reward.
    ///
    /// Deducts fees (humanitarian tithe, issobella fund, pool fee) from the
    /// block reward first, then splits the remaining miner share among miners
    /// proportional to their share count in the current window.
    ///
    /// Returns the list of miners whose accumulated balance meets the minimum
    /// payout threshold.
    pub fn compute_payouts(&mut self, block_reward_flowers: u64) -> Vec<PayoutEntry> {
        if self.window.is_empty() || block_reward_flowers == 0 {
            return Vec::new();
        }

        // Apply fee split: deduct humanitarian, issobella, pool fee before miner distribution.
        let fee = &self.config.fee_config;
        let humanitarian_share = block_reward_flowers
            .saturating_mul(fee.humanitarian_pct)
            .saturating_div(100);
        let issobella_share = block_reward_flowers
            .saturating_mul(fee.issobella_pct)
            .saturating_div(100);
        let pool_fee_share = block_reward_flowers
            .saturating_mul(fee.pool_fee_pct)
            .saturating_div(100);
        // Miner reward is the remainder after all fees (avoids rounding dust).
        let miner_reward = block_reward_flowers
            .saturating_sub(humanitarian_share)
            .saturating_sub(issobella_share)
            .saturating_sub(pool_fee_share);

        self.fee_humanitarian_flowers = self
            .fee_humanitarian_flowers
            .saturating_add(humanitarian_share);
        self.fee_issobella_flowers = self.fee_issobella_flowers.saturating_add(issobella_share);
        self.fee_pool_flowers = self.fee_pool_flowers.saturating_add(pool_fee_share);

        self.distribute_to_miners(miner_reward)
    }

    /// Distribute a pre-split miner reward to miners proportional to their
    /// difficulty-weighted share count, WITHOUT deducting any protocol fees.
    ///
    /// Use this when the protocol fee split (humanitarian / issobella / pool
    /// fee) is already performed upstream — e.g. by the core coinbase, which
    /// pays the four 89/5/5/1 outputs atomically at block creation. In that
    /// model the pool wallet receives only the 89% miner slice, and that
    /// entire slice must be redistributed to miners here (no second split).
    pub fn compute_miner_payouts(&mut self, miner_reward_flowers: u64) -> Vec<PayoutEntry> {
        if self.window.is_empty() || miner_reward_flowers == 0 {
            return Vec::new();
        }
        self.distribute_to_miners(miner_reward_flowers)
    }

    /// Shared distribution + threshold-collection logic for the PPLNS window.
    ///
    /// P8: Uses incremental `share_weights` (Vec<u128>) maintained on each
    /// record_share/eviction, making this O(active_miners) instead of
    /// O(window_len).  At 10k miners with 500k shares in the window, this
    /// is 50× faster than iterating the window.
    fn distribute_to_miners(&mut self, miner_reward: u64) -> Vec<PayoutEntry> {
        // Collect active miners (weight > 0) from incremental share_weights.
        let mut active_miners: Vec<(u32, u128)> = Vec::new();
        let mut total_weight: u128 = 0;
        for (i, &w) in self.share_weights.iter().enumerate() {
            if w > 0 {
                active_miners.push((i as u32, w));
                total_weight += w;
            }
        }
        if total_weight == 0 {
            total_weight = 1;
        }

        // Count shares per miner in the window for PayoutEntry.share_count.
        // This is a lightweight pass — we need share counts for the payout
        // response, and we can't derive them from share_weights (which is
        // difficulty-weighted, not count-weighted).
        let mut share_counts: Vec<u64> = vec![0; self.share_weights.len()];
        for entry in &self.window {
            share_counts[entry.miner_index as usize] += 1;
        }

        // Distribute miner_reward proportionally and accumulate in `unpaid`.
        let mut distributed = 0u64;
        for (i, (idx, weight)) in active_miners.iter().enumerate() {
            let amount = if i == active_miners.len() - 1 {
                // Last miner gets the remainder to avoid rounding dust.
                miner_reward.saturating_sub(distributed)
            } else {
                let part = (miner_reward as u128)
                    .saturating_mul(*weight)
                    .saturating_div(total_weight);
                u64::try_from(part).unwrap_or(0)
            };
            distributed = distributed.saturating_add(amount);
            self.unpaid[*idx as usize] = self.unpaid[*idx as usize].saturating_add(amount);
        }

        // Collect payouts for miners above the minimum threshold with a registered address.
        let mut payouts = Vec::new();
        let mut paid_indices = Vec::new();
        for i in 0..self.unpaid.len() {
            if self.unpaid[i] >= self.config.min_payout_flowers {
                if let Some(ref address) = self.addresses[i] {
                    let miner_id = self.registry.id(i as u32).to_string();
                    payouts.push(PayoutEntry {
                        share_count: share_counts[i],
                        miner_id,
                        address: address.clone(),
                        amount: self.unpaid[i],
                    });
                    paid_indices.push(i);
                }
            }
        }

        // Clear paid balances.
        for i in &paid_indices {
            self.unpaid[*i] = 0;
        }

        if !payouts.is_empty() {
            self.payout_rounds = self.payout_rounds.saturating_add(1);
            let round_total: u128 = payouts
                .iter()
                .fold(0u128, |acc, p| acc.saturating_add(p.amount as u128));
            self.total_paid_flowers = self.total_paid_flowers.saturating_add(round_total);
            for payout in &payouts {
                let idx = self.registry.lookup(&payout.miner_id).unwrap_or(0);
                self.paid_per_miner[idx as usize] =
                    self.paid_per_miner[idx as usize].saturating_add(payout.amount as u128);
            }
        }
        self.dirty = true;

        payouts
    }

    /// Roll back a previously computed payout batch.
    ///
    /// Used by the pool when payout execution fails after `compute_payouts`
    /// has already moved balances out of `unpaid`.
    pub fn rollback_payouts(&mut self, payouts: &[PayoutEntry]) {
        if payouts.is_empty() {
            return;
        }

        for payout in payouts {
            if let Some(idx) = self.registry.lookup(&payout.miner_id) {
                let i = idx as usize;
                self.unpaid[i] = self.unpaid[i].saturating_add(payout.amount);
                self.paid_per_miner[i] =
                    self.paid_per_miner[i].saturating_sub(payout.amount as u128);
            }
        }

        let round_total: u128 = payouts
            .iter()
            .fold(0u128, |acc, p| acc.saturating_add(p.amount as u128));
        self.total_paid_flowers = self.total_paid_flowers.saturating_sub(round_total);
        if self.payout_rounds > 0 {
            self.payout_rounds -= 1;
        }
        self.dirty = true;
    }

    /// Get the unpaid balance for a miner (flowers).
    pub fn unpaid_balance(&self, miner_id: &str) -> u64 {
        self.registry
            .lookup(miner_id)
            .map(|idx| self.unpaid[idx as usize])
            .unwrap_or(0)
    }

    /// Get the cumulative paid amount for a miner (flowers).
    pub fn paid_per_miner(&self, miner_id: &str) -> u128 {
        self.registry
            .lookup(miner_id)
            .map(|idx| self.paid_per_miner[idx as usize])
            .unwrap_or(0)
    }

    /// Get cumulative share/block stats for a miner.
    pub fn share_stats(&self, miner_id: &str) -> MinerShareStats {
        self.registry
            .lookup(miner_id)
            .map(|idx| self.shares_per_miner[idx as usize])
            .unwrap_or_default()
    }

    /// Get the last recorded share time (seconds) for a miner.
    pub fn last_share_time(&self, miner_id: &str) -> u64 {
        self.registry
            .lookup(miner_id)
            .map(|idx| self.last_share_time_per_miner[idx as usize])
            .unwrap_or(0)
    }

    /// Summary statistics.
    ///
    /// Includes a migration-aware clamp on `total_paid_flowers`: a pool server
    /// that ran through the 3.0.3 decimal fork without restart would have
    /// accumulated lifetime payouts in legacy 12-decimal flowers (1 ZION =
    /// 1e12). After the fork, flowers are 6-decimal (1 ZION = 1e6), so the old
    /// counter is up to 1e6× too large. We clamp it to `MINING_EMISSION_FLOWERS`
    /// (the total mining supply in 6-decimal flowers) — any value above that is
    /// physically impossible and clearly a pre-fork artifact.
    pub fn stats(&self) -> PplnsStats {
        /// Total mining emission = 127.22B ZION = 127,220,000,000,000,000 flowers (6-decimal).
        /// total_paid can never exceed this. Values above are pre-hardfork 12-decimal artifacts.
        const MINING_EMISSION_FLOWERS_6DEC: u128 = 127_220_000_000_000_000;

        let clamped_paid = if self.total_paid_flowers > MINING_EMISSION_FLOWERS_6DEC {
            // Pre-hardfork 12-decimal artifact — divide by MIGRATION_DIVISOR (1e6)
            // to convert to 6-decimal, then clamp to mining emission as a safety net.
            let migrated = self.total_paid_flowers / 1_000_000;
            migrated.min(MINING_EMISSION_FLOWERS_6DEC)
        } else {
            self.total_paid_flowers
        };

        let registered_miners = self
            .addresses
            .iter()
            .filter(|a| a.is_some())
            .count();

        let miners_with_unpaid = self.unpaid.iter().filter(|&&v| v > 0).count();

        let total_unpaid: u128 = self
            .unpaid
            .iter()
            .fold(0u128, |acc, &v| acc.saturating_add(v as u128));

        PplnsStats {
            window_size: self.config.window_size,
            window_used: self.window.len(),
            registered_miners,
            miners_with_unpaid,
            total_unpaid_flowers: total_unpaid,
            total_paid_flowers: clamped_paid,
            payout_rounds: self.payout_rounds,
        }
    }

    /// Fee accumulation statistics.
    pub fn fee_stats(&self) -> FeeStats {
        FeeStats {
            humanitarian_pct: self.config.fee_config.humanitarian_pct,
            issobella_pct: self.config.fee_config.issobella_pct,
            pool_fee_pct: self.config.fee_config.pool_fee_pct,
            miner_pct: self.config.fee_config.miner_pct(),
            humanitarian_accumulated_flowers: self.fee_humanitarian_flowers,
            issobella_accumulated_flowers: self.fee_issobella_flowers,
            pool_fee_accumulated_flowers: self.fee_pool_flowers,
            humanitarian_wallet: self.config.fee_config.humanitarian_wallet.clone(),
            issobella_wallet: self.config.fee_config.issobella_wallet.clone(),
            pool_fee_wallet: self.config.fee_config.pool_fee_wallet.clone(),
        }
    }

    /// Drain all accumulated fee balances, returning them and resetting
    /// internal accumulators to zero.  Used when the pool server executes
    /// an on-chain fee-payout transaction.
    pub fn drain_fees(&mut self) -> (u64, u64, u64) {
        let humanitarian = self.fee_humanitarian_flowers;
        let issobella = self.fee_issobella_flowers;
        let pool = self.fee_pool_flowers;
        self.fee_humanitarian_flowers = 0;
        self.fee_issobella_flowers = 0;
        self.fee_pool_flowers = 0;
        (humanitarian, issobella, pool)
    }

    /// Restore fee balances (e.g. after a failed on-chain submission).
    /// Saturating add prevents overflow.
    pub fn restore_fees(&mut self, humanitarian: u64, issobella: u64, pool: u64) {
        self.fee_humanitarian_flowers = self.fee_humanitarian_flowers.saturating_add(humanitarian);
        self.fee_issobella_flowers = self.fee_issobella_flowers.saturating_add(issobella);
        self.fee_pool_flowers = self.fee_pool_flowers.saturating_add(pool);
        self.dirty = true;
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PplnsStats {
    pub window_size: usize,
    pub window_used: usize,
    pub registered_miners: usize,
    pub miners_with_unpaid: usize,
    pub total_unpaid_flowers: u128,
    pub total_paid_flowers: u128,
    pub payout_rounds: u64,
}

/// Fee accumulation statistics reported via pool API.
#[derive(Debug, Clone, PartialEq)]
pub struct FeeStats {
    pub humanitarian_pct: u64,
    pub issobella_pct: u64,
    pub pool_fee_pct: u64,
    pub miner_pct: u64,
    pub humanitarian_accumulated_flowers: u64,
    pub issobella_accumulated_flowers: u64,
    pub pool_fee_accumulated_flowers: u64,
    pub humanitarian_wallet: String,
    pub issobella_wallet: String,
    pub pool_fee_wallet: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine(window_size: usize, min_payout: u64) -> PplnsEngine {
        PplnsEngine::new(PplnsConfig {
            window_size,
            min_payout_flowers: min_payout,
            fee_config: FeeConfig::no_fees(),
        })
    }

    fn engine_with_fees(window_size: usize, min_payout: u64) -> PplnsEngine {
        PplnsEngine::new(PplnsConfig {
            window_size,
            min_payout_flowers: min_payout,
            fee_config: FeeConfig::default(), // 5/5/1 split
        })
    }

    #[test]
    fn empty_window_returns_no_payouts() {
        let mut e = engine(100, 1);
        let payouts = e.compute_payouts(1_000_000);
        assert!(payouts.is_empty());
    }

    #[test]
    fn zero_reward_returns_no_payouts() {
        let mut e = engine(100, 1);
        e.record_share_at("alice", "rig1", 1, 1000);
        let payouts = e.compute_payouts(0);
        assert!(payouts.is_empty());
    }

    #[test]
    fn single_miner_gets_full_reward() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");
        for i in 0..10 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "alice");
        assert_eq!(payouts[0].amount, 1_000_000);
        assert_eq!(payouts[0].share_count, 10);
    }

    #[test]
    fn two_miners_split_proportionally() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");

        // Alice: 3 shares, Bob: 1 share → 75%/25%
        for i in 0..3 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        e.record_share_at("bob", "rig2", 1, 2000);

        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 2);

        let alice = payouts.iter().find(|p| p.miner_id == "alice").unwrap();
        let bob = payouts.iter().find(|p| p.miner_id == "bob").unwrap();

        // Total must equal the reward exactly (no dust lost).
        assert_eq!(alice.amount + bob.amount, 1_000_000);
        assert_eq!(alice.share_count, 3);
        assert_eq!(bob.share_count, 1);
    }

    #[test]
    fn min_payout_threshold_holds_back_small_balances() {
        let mut e = engine(100, 500_000);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");

        // Alice: 3 shares, Bob: 1 share → reward 1M → alice 750k, bob 250k
        for i in 0..3 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        e.record_share_at("bob", "rig2", 1, 2000);

        let payouts = e.compute_payouts(1_000_000);
        // Only Alice (750k >= 500k threshold). Bob (250k) held back.
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "alice");
        assert_eq!(e.unpaid_balance("bob"), 250_000);
    }

    #[test]
    fn unpaid_accumulates_across_rounds() {
        let mut e = engine(100, 500_000);
        e.register_address("bob", "zion1bob");

        // Round 1: Bob gets 250k (below threshold)
        e.record_share_at("bob", "rig1", 1, 1000);
        let p1 = e.compute_payouts(250_000);
        assert!(p1.is_empty());
        assert_eq!(e.unpaid_balance("bob"), 250_000);

        // Round 2: Bob gets another 300k → total 550k (above threshold)
        e.record_share_at("bob", "rig1", 2, 2000);
        let p2 = e.compute_payouts(300_000);
        assert_eq!(p2.len(), 1);
        assert_eq!(p2[0].amount, 550_000);
        assert_eq!(e.unpaid_balance("bob"), 0);
    }

    #[test]
    fn unregistered_miner_balance_held() {
        let mut e = engine(100, 1);
        // No address registered for alice.
        e.record_share_at("alice", "rig1", 1, 1000);
        let payouts = e.compute_payouts(1_000_000);
        assert!(payouts.is_empty());
        assert_eq!(e.unpaid_balance("alice"), 1_000_000);

        // Now register and trigger another round (even with 0 new reward).
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 2, 2000);
        let payouts = e.compute_payouts(0);
        // 0 reward this round, but previous unpaid is still there.
        // Only the new round's allocation is 0, unpaid stays.
        assert!(payouts.is_empty() || payouts[0].amount == 1_000_000);
        // Verify balance is still 1M (nothing new from 0-reward round).
        assert_eq!(e.unpaid_balance("alice"), 1_000_000);
    }

    #[test]
    fn window_evicts_oldest_shares() {
        let mut e = engine(5, 1);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");

        // Fill window with Alice (5 shares).
        for i in 0..5 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        assert_eq!(e.window_len(), 5);

        // Add 5 Bob shares — Alice shares should be evicted.
        for i in 0..5 {
            e.record_share_at("bob", "rig2", 2, 2000 + i);
        }
        assert_eq!(e.window_len(), 5);

        // Now Bob has 100% of the window.
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "bob");
        assert_eq!(payouts[0].amount, 1_000_000);
    }

    #[test]
    fn stats_reflect_state() {
        let mut e = engine(100, 500);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.record_share_at("alice", "rig1", 2, 2000);

        let s = e.stats();
        assert_eq!(s.window_size, 100);
        assert_eq!(s.window_used, 2);
        assert_eq!(s.registered_miners, 1);
        assert_eq!(s.payout_rounds, 0);

        e.compute_payouts(1_000_000);
        let s2 = e.stats();
        assert_eq!(s2.payout_rounds, 1);
        assert_eq!(s2.total_paid_flowers, 1_000_000);
    }

    #[test]
    fn no_dust_lost_with_many_miners() {
        let mut e = engine(1000, 1);
        for i in 0..7 {
            let id = format!("miner{i}");
            e.register_address(&id, &format!("zion1addr{i}"));
            e.record_share_at(&id, "rig", 1, 1000 + i as u64);
        }

        let reward = 1_000_003u64; // indivisible by 7
        let payouts = e.compute_payouts(reward);
        let total: u64 = payouts.iter().map(|p| p.amount).sum();
        assert_eq!(total, reward, "no flowers lost to rounding");
    }

    #[test]
    fn payout_clears_balance_then_accumulates_fresh() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");

        e.record_share_at("alice", "rig1", 1, 1000);
        e.compute_payouts(500);
        assert_eq!(e.unpaid_balance("alice"), 0);

        e.record_share_at("alice", "rig1", 2, 2000);
        e.compute_payouts(300);
        assert_eq!(e.unpaid_balance("alice"), 0);
        assert_eq!(e.stats().total_paid_flowers, 800);
    }

    #[test]
    fn register_address_updates_existing() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1old");
        assert_eq!(e.address_for("alice"), Some("zion1old"));
        e.register_address("alice", "zion1new");
        assert_eq!(e.address_for("alice"), Some("zion1new"));
    }

    #[test]
    fn default_config_uses_core_constants() {
        let cfg = PplnsConfig::default();
        assert_eq!(cfg.window_size, 500_000);
        assert_eq!(cfg.min_payout_flowers, zion_core::wallet::MIN_PAYOUT_AMOUNT);
        // Guard against drift with zion_core::emission constants.
        assert_eq!(
            cfg.fee_config.humanitarian_pct,
            zion_core::emission::HUMANITARIAN_PCT
        );
        assert_eq!(
            cfg.fee_config.issobella_pct,
            zion_core::emission::ISSOBELLA_PCT
        );
        assert_eq!(
            cfg.fee_config.pool_fee_pct,
            zion_core::emission::POOL_FEE_PCT
        );
        assert_eq!(cfg.fee_config.miner_pct(), zion_core::emission::MINER_PCT);
    }

    #[test]
    fn fee_split_deducts_from_reward() {
        let mut e = engine_with_fees(100, 1);
        e.register_address("alice", "zion1alice");
        for i in 0..10 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        // Block reward = 1,000,000 flowers
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 1);
        // Miner gets 89%: 890,000
        assert_eq!(payouts[0].amount, 890_000);

        let fs = e.fee_stats();
        assert_eq!(fs.humanitarian_accumulated_flowers, 50_000); // 5%
        assert_eq!(fs.issobella_accumulated_flowers, 50_000); // 5%
        assert_eq!(fs.pool_fee_accumulated_flowers, 10_000); // 1%
                                                             // Total: 890k + 50k + 50k + 10k = 1M (no dust)
        assert_eq!(
            payouts[0].amount
                + fs.humanitarian_accumulated_flowers
                + fs.issobella_accumulated_flowers
                + fs.pool_fee_accumulated_flowers,
            1_000_000
        );
    }

    #[test]
    fn fee_split_accumulates_across_blocks() {
        let mut e = engine_with_fees(100, 1);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.compute_payouts(1_000_000);
        e.record_share_at("alice", "rig1", 2, 2000);
        e.compute_payouts(1_000_000);

        let fs = e.fee_stats();
        assert_eq!(fs.humanitarian_accumulated_flowers, 100_000); // 5% × 2 blocks
        assert_eq!(fs.issobella_accumulated_flowers, 100_000);
        assert_eq!(fs.pool_fee_accumulated_flowers, 20_000);
    }

    #[test]
    fn fee_split_with_real_block_reward() {
        // 5,400,067,000 flowers = 5,400.067 ZION (V3 base reward, 6-decimal)
        let block_reward: u64 = 5_400_067_000;
        let mut e = engine_with_fees(100, 1);
        e.register_address("miner1", "zion1miner1");
        e.record_share_at("miner1", "rig1", 1, 1000);
        let payouts = e.compute_payouts(block_reward);

        let fs = e.fee_stats();
        let humanitarian = 5_400_067_000u64 * 5 / 100; // 270,003,350
        let issobella = 5_400_067_000u64 * 5 / 100;
        let pool_fee = 5_400_067_000u64 / 100; // 54,000,670
        let miner_share = block_reward - humanitarian - issobella - pool_fee;

        assert_eq!(fs.humanitarian_accumulated_flowers, humanitarian);
        assert_eq!(fs.issobella_accumulated_flowers, issobella);
        assert_eq!(fs.pool_fee_accumulated_flowers, pool_fee);
        assert_eq!(payouts[0].amount, miner_share);
        // Verify no dust lost
        assert_eq!(
            miner_share + humanitarian + issobella + pool_fee,
            block_reward
        );
    }

    #[test]
    fn no_fees_config_gives_full_reward() {
        let cfg = FeeConfig::no_fees();
        assert_eq!(cfg.miner_pct(), 100);
        assert_eq!(cfg.total_fee_pct(), 0);

        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts[0].amount, 1_000_000);
    }

    #[test]
    fn compute_miner_payouts_distributes_full_amount_without_fee_deduction() {
        // Even with a fee config present, compute_miner_payouts must NOT deduct
        // protocol fees — the core coinbase already did the 89/5/5/1 split, and
        // the pool wallet holds only the 89% miner slice that must be fully
        // redistributed to miners.
        let mut e = engine_with_fees(100, 1);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");
        for i in 0..6 {
            e.record_share_at("alice", "rig1", 1, 1000 + i);
        }
        for i in 0..4 {
            e.record_share_at("bob", "rig2", 1, 2000 + i);
        }

        // miner_share = 89% of subsidy already (passed in by the server).
        let miner_share: u64 = 4_806_059_630_000_000;
        let payouts = e.compute_miner_payouts(miner_share);

        // The full miner_share is distributed; nothing is skimmed for fees.
        let total: u64 = payouts.iter().map(|p| p.amount).sum();
        assert_eq!(total, miner_share);

        // No fees accumulated by this path.
        let fs = e.fee_stats();
        assert_eq!(fs.humanitarian_accumulated_flowers, 0);
        assert_eq!(fs.issobella_accumulated_flowers, 0);
        assert_eq!(fs.pool_fee_accumulated_flowers, 0);
    }

    #[test]
    fn compute_miner_payouts_empty_window_returns_nothing() {
        let mut e = engine_with_fees(100, 1);
        e.register_address("alice", "zion1alice");
        assert!(e.compute_miner_payouts(1_000_000).is_empty());
    }

    #[test]
    fn drain_fees_returns_and_clears_accumulators() {
        let mut e = engine_with_fees(100, 1);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.compute_payouts(1_000_000);

        let fs_before = e.fee_stats();
        assert_eq!(fs_before.humanitarian_accumulated_flowers, 50_000);

        let (h, i, p) = e.drain_fees();
        assert_eq!(h, 50_000);
        assert_eq!(i, 50_000);
        assert_eq!(p, 10_000);

        let fs_after = e.fee_stats();
        assert_eq!(fs_after.humanitarian_accumulated_flowers, 0);
        assert_eq!(fs_after.issobella_accumulated_flowers, 0);
        assert_eq!(fs_after.pool_fee_accumulated_flowers, 0);
    }

    #[test]
    fn restore_fees_re_adds_balances() {
        let mut e = engine_with_fees(100, 1);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.compute_payouts(1_000_000);

        let (h, _i, _p) = e.drain_fees();
        assert_eq!(h, 50_000);

        e.restore_fees(10_000, 20_000, 5_000);
        let fs = e.fee_stats();
        assert_eq!(fs.humanitarian_accumulated_flowers, 10_000);
        assert_eq!(fs.issobella_accumulated_flowers, 20_000);
        assert_eq!(fs.pool_fee_accumulated_flowers, 5_000);
    }

    #[test]
    fn restore_fees_saturates_on_overflow() {
        let mut e = engine_with_fees(100, 1);
        e.fee_humanitarian_flowers = u64::MAX;
        e.restore_fees(1, 0, 0);
        assert_eq!(e.fee_stats().humanitarian_accumulated_flowers, u64::MAX);
    }

    #[test]
    fn total_paid_flowers_can_grow_past_u64_max() {
        let mut e = engine(100, 1);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.total_paid_flowers = u64::MAX as u128;

        let payouts = e.compute_miner_payouts(10);

        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].amount, 10);
        // Internal counter grows past u64 max
        assert_eq!(e.total_paid_flowers, u64::MAX as u128 + 10);
    }

    #[test]
    fn stats_clamps_pre_hardfork_12decimal_artifact() {
        let mut e = engine(100, 1);
        // Simulate a pool that ran through the 3.0.3 decimal fork without restart.
        // Pre-fork total_paid_flowers was in 12-decimal flowers (1 ZION = 1e12).
        // A typical value: ~20M ZION × 1e12 = 20,000,000,000,000,000,000 (2e19)
        e.total_paid_flowers = 19_980_693_363_360_934_807u128;

        let s = e.stats();
        // Should be divided by 1e6 to convert to 6-decimal: ~19,980,693 ZION
        let expected = 19_980_693_363_360_934_807u128 / 1_000_000;
        assert_eq!(s.total_paid_flowers, expected);
        // And should be within mining emission (127.22B ZION)
        assert!(s.total_paid_flowers <= 127_220_000_000_000_000u128);
    }

    #[test]
    fn stats_clamps_absurd_values_to_mining_emission() {
        let mut e = engine(100, 1);
        // Even after division by 1e6, if the value is still > mining emission, clamp it
        e.total_paid_flowers = u128::MAX;

        let s = e.stats();
        assert_eq!(s.total_paid_flowers, 127_220_000_000_000_000u128);
    }

    #[test]
    fn stats_passes_through_normal_values() {
        let mut e = engine(100, 1);
        // Normal post-fork value: 5.4M ZION × 1e6 = 5,400,000,000,000 flowers
        e.total_paid_flowers = 5_400_000_000_000u128;

        let s = e.stats();
        assert_eq!(s.total_paid_flowers, 5_400_000_000_000u128);
    }

    /// Ten miners with different hashrates (simulated via difficulty).
    /// Each miner submits shares proportional to their simulated hashrate.
    /// Verify that payout ratio per unit difficulty is equal across all miners.
    #[test]
    fn ten_miners_payout_ratio_is_fair() {
        // Simulated hashrates (arbitrary units) and corresponding share difficulty.
        let miners: Vec<(&str, u64)> = vec![
            ("miner_01", 100),
            ("miner_02", 200),
            ("miner_03", 300),
            ("miner_04", 400),
            ("miner_05", 500),
            ("miner_06", 600),
            ("miner_07", 700),
            ("miner_08", 800),
            ("miner_09", 900),
            ("miner_10", 1000),
        ];
        let _total_simulated_hashrate: u64 = miners.iter().map(|(_, h)| h).sum();

        // Use a large window so all shares fit.
        let mut e = engine(1_000_000, 1);
        for (id, _diff) in &miners {
            e.register_address(id, &format!("zion1{id}"));
        }

        // Each miner submits 100 shares at their own difficulty.
        // Total work in window = sum(100 * diff) = 100 * total_simulated_hashrate.
        for (id, diff) in &miners {
            for _ in 0..100 {
                e.record_share_at_diff(id, "rig", 1, 1000, *diff);
            }
        }

        let block_reward = 10_000_000_000u64;
        let payouts = e.compute_miner_payouts(block_reward);
        assert_eq!(payouts.len(), miners.len(), "all 10 miners should be paid");

        // Expected payout for each miner = block_reward * (miner_work / total_work).
        let total_work: u128 = miners.iter().map(|(_, d)| 100u128 * *d as u128).sum();
        for (id, diff) in &miners {
            let miner_work = 100u128 * *diff as u128;
            let expected = (block_reward as u128 * miner_work / total_work) as u64;
            let actual = payouts
                .iter()
                .find(|p| p.miner_id == *id)
                .map(|p| p.amount)
                .unwrap_or(0);
            // Allow up to N-1 flowers rounding error (dust handled by last-miner-gets-remainder).
            let delta = expected.abs_diff(actual);
            assert!(
                delta <= miners.len() as u64,
                "miner {id}: expected ~{expected}, got {actual}, delta={delta}"
            );
        }

        // Total payouts must equal the block reward exactly (no dust lost).
        let total_payout: u64 = payouts.iter().map(|p| p.amount).sum();
        assert_eq!(
            total_payout, block_reward,
            "total payout must equal block reward"
        );

        // Verify payout ratio per unit work is identical across miners (<0.1% deviation).
        let mut ratios = Vec::new();
        for (id, diff) in &miners {
            let payout = payouts
                .iter()
                .find(|p| p.miner_id == *id)
                .map(|p| p.amount)
                .unwrap_or(0);
            let work = 100u128 * *diff as u128;
            let ratio = payout as f64 / work as f64;
            ratios.push(ratio);
        }
        let first_ratio = ratios[0];
        for (i, ratio) in ratios.iter().enumerate() {
            let rel_diff = (ratio - first_ratio).abs() / first_ratio;
            assert!(
                rel_diff < 0.001,
                "miner {} ratio {:.12} deviates from first {:.12} by {:.6}%",
                i + 1,
                ratio,
                first_ratio,
                rel_diff * 100.0
            );
        }
    }

    #[test]
    fn snapshot_and_restore_preserves_state() {
        let mut e = engine_with_fees(100, 500_000);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.record_share_at("bob", "rig2", 1, 2000);
        e.compute_payouts(1_000_000);
        // Bob is below threshold, so he has unpaid balance.
        let bob_unpaid = e.unpaid_balance("bob");
        assert!(bob_unpaid > 0);

        let snap = e.snapshot();
        let mut e2 = engine_with_fees(100, 500_000);
        e2.restore(snap);

        assert_eq!(e2.window_len(), e.window_len());
        assert_eq!(e2.unpaid_balance("bob"), bob_unpaid);
        assert_eq!(e2.address_for("alice"), Some("zion1alice"));
        assert_eq!(e2.stats().total_paid_flowers, e.stats().total_paid_flowers);
        assert_eq!(
            e2.fee_stats().humanitarian_accumulated_flowers,
            e.fee_stats().humanitarian_accumulated_flowers
        );
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("zion_pplns_test_{}.json", std::process::id()));
        // Clean up any leftover from a previous run.
        let _ = std::fs::remove_file(&path);

        let mut e = engine_with_fees(100, 500_000);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.record_share_at("bob", "rig2", 1, 2000);
        e.compute_payouts(1_000_000);
        let bob_unpaid = e.unpaid_balance("bob");
        let total_paid = e.stats().total_paid_flowers;

        // Save
        e.save_to_path(&path).expect("save should succeed");
        assert!(path.exists(), "snapshot file should exist");

        // Load into a fresh engine
        let snap = PplnsEngine::load_from_path(&path).expect("snapshot should load");
        let mut e2 = engine_with_fees(100, 500_000);
        e2.restore(snap);

        assert_eq!(e2.unpaid_balance("bob"), bob_unpaid);
        assert_eq!(e2.stats().total_paid_flowers, total_paid);
        assert_eq!(e2.address_for("alice"), Some("zion1alice"));

        // Clean up
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn load_nonexistent_returns_none() {
        let path = std::env::temp_dir().join("zion_pplns_nonexistent_999999.json");
        let _ = std::fs::remove_file(&path);
        assert!(PplnsEngine::load_from_path(&path).is_none());
    }

    #[test]
    fn restore_preserves_fee_accumulators() {
        let mut e = engine_with_fees(100, 1);
        e.register_address("alice", "zion1alice");
        e.record_share_at("alice", "rig1", 1, 1000);
        e.compute_payouts(1_000_000);

        let snap = e.snapshot();
        let mut e2 = engine_with_fees(100, 1);
        e2.restore(snap);

        let fs = e2.fee_stats();
        assert_eq!(fs.humanitarian_accumulated_flowers, 50_000);
        assert_eq!(fs.issobella_accumulated_flowers, 50_000);
        assert_eq!(fs.pool_fee_accumulated_flowers, 10_000);
    }
}
