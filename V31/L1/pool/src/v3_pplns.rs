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

use std::collections::{HashMap, HashSet, VecDeque};
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tracing::warn;
use zion_l1_types::u128_str;

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
    /// Coin the share was mined for — lowercase ticker (`"zion"`, `"qtu"`,
    /// `"prl"`, bridged coin ids).  `#[serde(default)]` keeps pre-F2
    /// snapshots loadable; all historical shares were ZION.
    #[serde(default = "default_share_coin")]
    pub coin: String,
}

fn default_share_coin() -> String {
    "zion".to_string()
}

/// Internal window entry using u32 miner index (zero-allocation hot path).
#[derive(Debug, Clone)]
struct WindowEntry {
    miner_index: u32,
    /// u16 index into [`CoinRegistry`] — which leg/coin the share was for.
    coin_index: u16,
    worker_name: String,
    timestamp_ms: u64,
    height: u64,
    difficulty: u64,
}

/// Coin key registry — maps lowercase coin tickers (`"zion"`, `"qtu"`,
/// `"prl"`, bridged ids) to compact `u16` indices used in
/// [`WindowEntry`].  Follows the same interning pattern as
/// [`MinerRegistry`]; the coin set is small (<64) so `u16` is ample.
#[derive(Debug, Clone, Default)]
struct CoinRegistry {
    key_to_index: HashMap<String, u16>,
    index_to_key: Vec<String>,
}

impl CoinRegistry {
    /// Normalize a coin label to its canonical key (lowercase ticker).
    fn key(coin: &str) -> String {
        coin.to_ascii_lowercase()
    }

    fn lookup_or_register(&mut self, coin: &str) -> u16 {
        let key = Self::key(coin);
        if let Some(&idx) = self.key_to_index.get(&key) {
            return idx;
        }
        let idx = self.index_to_key.len() as u16;
        self.index_to_key.push(key.clone());
        self.key_to_index.insert(key, idx);
        idx
    }

    fn lookup(&self, coin: &str) -> Option<u16> {
        self.key_to_index.get(&Self::key(coin)).copied()
    }

    fn key_for(&self, index: u16) -> &str {
        &self.index_to_key[index as usize]
    }
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

/// Per-coin accounting snapshot (F2) — emitted by
/// [`PplnsEngine::coin_stats`] for APIs and ops tooling.
#[derive(Debug, Clone, Serialize)]
pub struct CoinShareStats {
    /// Canonical coin key (lowercase ticker).
    pub coin: String,
    /// Lifetime accepted shares recorded for this coin.
    pub accepted_total: u64,
    /// Sum of difficulties of this coin's shares in the current window.
    pub window_weight: u128,
    /// Miners with nonzero window weight in this coin.
    pub active_miners: u64,
}

/// Per-miner payout entry produced by [`PplnsEngine::compute_payouts`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PayoutEntry {
    pub miner_id: String,
    pub address: String,
    /// Amount in flowers (1 ZION = 1_000_000 flowers, post-3.0.3).
    /// For non-ZION payout chains this stays denominated in flowers — the
    /// external sweeper converts at send time with its configured rate.
    pub amount: u64,
    pub share_count: u64,
    /// Payout chain: `None`/`"zion"` = native ZION sweep; `"quantus"` =
    /// drained by the multichain QTC payout sweeper.
    #[serde(default)]
    pub payout_chain: Option<String>,
    /// `true` when `amount` is denominated in the payout chain's own base
    /// units (e.g. QTU planks) rather than flowers.  Set by the per-coin
    /// revenue distribution path (F3); the drain response surfaces it as
    /// `"unit":"native"` so external sweepers skip FX conversion.
    #[serde(default)]
    pub native_units: bool,
    /// Coin ticker whose revenue produced this entry (`"qtu"`, `"prl"`).
    /// `None` on the unified (ZION block reward) distribution path.
    #[serde(default)]
    pub coin: Option<String>,
    /// Revenue event idempotency key (e.g. `"qtu:rev:42"`) supplied by the
    /// coin-revenue oracle.  Sweepers must include it in their ledger key
    /// so two events at the same source height cannot collide.
    #[serde(default)]
    pub revenue_event: Option<String>,
}

impl PayoutEntry {
    /// Normalized payout chain label (`"zion"` when unset).
    pub fn chain(&self) -> &str {
        self.payout_chain.as_deref().unwrap_or("zion")
    }

    /// Drain unit: `"native"` for per-coin revenue payouts, `"flowers"`
    /// for the unified ZION distribution (external sweepers FX-convert).
    pub fn unit(&self) -> &str {
        if self.native_units {
            "native"
        } else {
            "flowers"
        }
    }
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
    /// Coin tickers (lowercase) whose shares earn **only** their own
    /// coin's revenue events (native-unit payouts, F3) — they are excluded
    /// from the unified ZION distribution.  Empty default preserves
    /// pre-F3 unified semantics (external shares share ZION rewards).
    /// Configured via `ZION_POOL_NATIVE_PAYOUT_COINS=qtu,prl`.
    pub native_payout_coins: Vec<String>,
    /// Per-coin minimum payout in the coin's native base units
    /// (key = lowercase ticker, e.g. `qtu` → planks).  Unset = 0 (every
    /// distribution emits all balances — the sweeper's own dust guard
    /// applies downstream).
    pub min_payout_native: HashMap<String, u64>,
}

impl Default for PplnsConfig {
    fn default() -> Self {
        Self {
            window_size: 500_000,
            min_payout_flowers: zion_core::MIN_PAYOUT_AMOUNT,
            fee_config: FeeConfig::default(),
            native_payout_coins: Vec::new(),
            min_payout_native: HashMap::new(),
        }
    }
}

/// Per-coin (native-unit) distribution target for `distribute_weighted` —
/// routes earnings into `unpaid_native` keyed by (miner, coin) instead of
/// the flowers `unpaid` bucket, and forces the entry's payout chain.
struct NativeDest {
    coin_idx: u16,
    /// Lowercase coin ticker — keys `min_payout_native` and `PayoutEntry.coin`.
    coin_key: String,
    /// Required registered payout chain (`"quantus"`, `"pearl"`, …).
    chain: String,
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
    /// Payout chain per miner_index (`"zion"` | `"quantus"`); `None`/missing
    /// = `"zion"`.  Kept parallel to `addresses`.
    chains: Vec<Option<String>>,
    /// Accumulated unpaid balance per miner_index (flowers).
    unpaid: Vec<u64>,
    /// Cumulative paid amount per miner_index (flowers).
    paid_per_miner: Vec<u128>,
    /// Cumulative share/block stats per miner_index.
    shares_per_miner: Vec<MinerShareStats>,
    /// Last share timestamp (seconds) per miner_index.
    last_share_time_per_miner: Vec<u64>,
    /// Coin registry — lowercase ticker → u16 index used in WindowEntry.
    coin_registry: CoinRegistry,
    /// Incremental window weight per coin (indexed by coin_index) — the
    /// per-coin slice of `window_total_difficulty`.  Updated on each
    /// record/eviction alongside `share_weights`.
    coin_window_weight: Vec<u128>,
    /// Incremental window weight per (miner_index, coin_index) — lets a
    /// per-coin payout round find each miner's weight in that coin's
    /// slice without scanning the window.
    miner_coin_weights: HashMap<(u32, u16), u128>,
    /// Cumulative accepted share count per coin (lifetime stat for API).
    coin_share_counts: HashMap<u16, u64>,
    /// Accumulated unpaid balances for native-unit coins, keyed
    /// `(miner_index, coin_index)` (F3).  Kept separate from `unpaid`
    /// (flowers) so ZION and e.g. QTU-plank balances never mix units.
    unpaid_native: HashMap<(u32, u16), u64>,
    /// Per-wallet payout threshold overrides (flowers, A2.3) — ZIS-account
    /// configured, persisted in the share store (`miner_settings`), applied
    /// to the unified (flowers) payout path only. Keyed by wallet; lookup
    /// falls back to the id's `.worker`-stripped prefix for dotted logins.
    payout_overrides: HashMap<String, u64>,
    /// Total native-unit payouts emitted per coin (lifetime stat).
    total_paid_native: HashMap<u16, u128>,
    /// Native revenue events included in state and durable snapshots.
    applied_revenue_events: HashSet<String>,
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
    #[serde(with = "u128_str")]
    pub window_total_difficulty: u128,
    pub addresses: HashMap<String, String>,
    pub unpaid: HashMap<String, u64>,
    /// Miner payout chain labels (miner_id → `"zion"`/`"quantus"`).
    /// `#[serde(default)]` keeps pre-QTC snapshots loadable.
    #[serde(default)]
    pub payout_chains: HashMap<String, String>,
    /// Cumulative accepted share counts per coin key (F2).  `#[serde(default)]`
    /// keeps pre-F2 snapshots loadable.
    #[serde(default)]
    pub coin_share_counts: HashMap<String, u64>,
    /// Native-unit unpaid balances, serialized as `"<miner_id>|<coin>"` →
    /// amount (F3).  `#[serde(default)]` keeps pre-F3 snapshots loadable.
    #[serde(default)]
    pub unpaid_native: HashMap<String, u64>,
    /// Total native-unit payouts emitted per coin key (F3 lifetime stat).
    #[serde(default)]
    #[serde(with = "u128_str::map")]
    pub total_paid_native: HashMap<String, u128>,
    /// Revenue event ids already included in this snapshot. This lets the
    /// SQLite journal distinguish an event applied before a crash from one
    /// that still needs replay.
    #[serde(default)]
    pub applied_revenue_events: HashSet<String>,
    #[serde(with = "u128_str::map")]
    pub paid_per_miner: HashMap<String, u128>,
    pub shares_per_miner: HashMap<String, MinerShareStats>,
    pub last_share_time_per_miner: HashMap<String, u64>,
    #[serde(with = "u128_str")]
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
            chains: Vec::new(),
            unpaid: Vec::new(),
            paid_per_miner: Vec::new(),
            shares_per_miner: Vec::new(),
            last_share_time_per_miner: Vec::new(),
            coin_registry: CoinRegistry::default(),
            coin_window_weight: Vec::new(),
            miner_coin_weights: HashMap::new(),
            coin_share_counts: HashMap::new(),
            unpaid_native: HashMap::new(),
            payout_overrides: HashMap::new(),
            total_paid_native: HashMap::new(),
            applied_revenue_events: HashSet::new(),
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
            self.chains.resize(needed, None);
            self.unpaid.resize(needed, 0);
            self.paid_per_miner.resize(needed, 0);
            self.shares_per_miner
                .resize(needed, MinerShareStats::default());
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
                coin: self.coin_registry.key_for(e.coin_index).to_string(),
            })
            .collect();

        // Convert Vec-indexed per-miner data back to HashMap format for serialization.
        let mut addresses = HashMap::with_capacity(self.registry.len());
        let mut payout_chains = HashMap::new();
        let mut unpaid = HashMap::with_capacity(self.registry.len());
        let mut paid_per_miner = HashMap::with_capacity(self.registry.len());
        let mut shares_per_miner = HashMap::with_capacity(self.registry.len());
        let mut last_share_time = HashMap::with_capacity(self.registry.len());

        for i in 0..self.registry.len() {
            let id = self.registry.index_to_id[i].clone();
            if let Some(ref addr) = self.addresses[i] {
                addresses.insert(id.clone(), addr.clone());
            }
            if let Some(ref chain) = self.chains[i] {
                payout_chains.insert(id.clone(), chain.clone());
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
            payout_chains,
            coin_share_counts: self
                .coin_share_counts
                .iter()
                .map(|(idx, n)| (self.coin_registry.key_for(*idx).to_string(), *n))
                .collect(),
            unpaid_native: self
                .unpaid_native
                .iter()
                .map(|((m, c), bal)| {
                    (
                        format!(
                            "{}|{}",
                            self.registry.id(*m),
                            self.coin_registry.key_for(*c)
                        ),
                        *bal,
                    )
                })
                .collect(),
            total_paid_native: self
                .total_paid_native
                .iter()
                .map(|(idx, n)| (self.coin_registry.key_for(*idx).to_string(), *n))
                .collect(),
            applied_revenue_events: self.applied_revenue_events.clone(),
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
        for id in snap.payout_chains.keys() {
            self.registry.lookup_or_register(id);
        }
        for id in snap.unpaid.keys() {
            self.registry.lookup_or_register(id);
        }
        for key in snap.unpaid_native.keys() {
            if let Some((miner_id, _)) = key.split_once('|') {
                self.registry.lookup_or_register(miner_id);
            }
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
        self.chains = vec![None; n];
        self.unpaid = vec![0u64; n];
        self.paid_per_miner = vec![0u128; n];
        self.shares_per_miner = vec![MinerShareStats::default(); n];
        self.last_share_time_per_miner = vec![0u64; n];

        // Restore window entries with u32 indices + rebuild share_weights
        // and the per-coin weight maps (derived state — not serialized).
        self.coin_registry = CoinRegistry::default();
        self.coin_window_weight.clear();
        self.miner_coin_weights.clear();
        for share in snap.window {
            let idx = self.registry.lookup_or_register(&share.miner_id);
            let coin_idx = self.coin_registry.lookup_or_register(&share.coin);
            if self.coin_window_weight.len() <= coin_idx as usize {
                self.coin_window_weight.resize(coin_idx as usize + 1, 0);
            }
            let diff = share.difficulty.max(1);
            self.window.push_back(WindowEntry {
                miner_index: idx,
                coin_index: coin_idx,
                worker_name: share.worker_name,
                timestamp_ms: share.timestamp_ms,
                height: share.height,
                difficulty: diff,
            });
            self.window_total_difficulty += diff as u128;
            self.share_weights[idx as usize] += diff as u128;
            self.coin_window_weight[coin_idx as usize] += diff as u128;
            *self.miner_coin_weights.entry((idx, coin_idx)).or_insert(0) += diff as u128;
        }

        // Restore cumulative per-coin counts (independent of window).
        self.coin_share_counts = snap
            .coin_share_counts
            .into_iter()
            .map(|(key, n)| (self.coin_registry.lookup_or_register(&key), n))
            .collect();

        // Restore native-unit unpaid balances + per-coin paid totals (F3).
        // Keys serialize as "<miner_id>|<coin>"; malformed keys are skipped.
        self.unpaid_native.clear();
        for (key, bal) in snap.unpaid_native {
            if let Some((miner_id, coin)) = key.split_once('|') {
                let m = self.registry.lookup_or_register(miner_id);
                let c = self.coin_registry.lookup_or_register(coin);
                self.unpaid_native.insert((m, c), bal);
            }
        }
        self.total_paid_native = snap
            .total_paid_native
            .into_iter()
            .map(|(key, n)| (self.coin_registry.lookup_or_register(&key), n))
            .collect();
        self.applied_revenue_events = snap.applied_revenue_events;

        // Restore per-miner data.
        for (id, addr) in snap.addresses {
            let idx = self.registry.lookup_or_register(&id);
            self.addresses[idx as usize] = Some(addr);
        }
        for (id, chain) in snap.payout_chains {
            let idx = self.registry.lookup_or_register(&id);
            self.chains[idx as usize] = Some(chain);
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

    pub fn has_applied_revenue_event(&self, event_id: &str) -> bool {
        self.applied_revenue_events.contains(event_id)
    }

    pub fn mark_revenue_event_applied(&mut self, event_id: &str) {
        self.applied_revenue_events.insert(event_id.to_string());
        self.dirty = true;
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

    /// Save engine state only if it has changed since the last save.
    ///
    /// Returns `Ok(true)` if a snapshot was written, `Ok(false)` if the state
    /// was already clean and no write was needed.
    pub fn save_if_dirty<P: AsRef<Path>>(&mut self, path: P) -> std::io::Result<bool> {
        if !self.dirty {
            return Ok(false);
        }
        let snap = self.snapshot();
        Self::write_snapshot_to_path(&snap, path)?;
        self.dirty = false;
        Ok(true)
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
            f.sync_all()?;
        }
        // Atomic rename (POSIX guarantee on same filesystem).
        std::fs::rename(&tmp, path)?;
        #[cfg(unix)]
        {
            let parent = path
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
                .unwrap_or_else(|| Path::new("."));
            std::fs::File::open(parent)?.sync_all()?;
        }
        Ok(())
    }

    /// Load engine state from a JSON file. Returns `Ok(None)` if file doesn't
    /// exist (first run); corrupt or unreadable snapshots are errors.
    ///
    /// F1.2 upgrade: cleans up stale `.json.tmp` files from a previous crash.
    pub fn load_from_path<P: AsRef<Path>>(path: P) -> std::io::Result<Option<PplnsSnapshot>> {
        let path = path.as_ref();
        // Clean up stale temp file from a previous crash (F1.2).
        let tmp = path.with_extension("json.tmp");
        if tmp.exists() {
            warn!(
                "pplns_persistence: cleaning up stale temp file {} (previous crash during save?)",
                tmp.display()
            );
            if let Err(e) = std::fs::remove_file(&tmp) {
                if e.kind() != std::io::ErrorKind::NotFound {
                    warn!(
                        "pplns_persistence: failed to remove stale temp file {}: {}",
                        tmp.display(),
                        e
                    );
                }
            }
        }
        match std::fs::read(path) {
            Ok(data) => serde_json::from_slice::<PplnsSnapshot>(&data)
                .map(Some)
                .map_err(|e| {
                    std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        format!("failed to parse PPLNS snapshot {}: {e}", path.display()),
                    )
                }),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Register (or update) the payout address for a miner.
    pub fn register_address(&mut self, miner_id: &str, address: &str) {
        self.register_address_with_chain(miner_id, address, "zion");
    }

    /// Register a payout address on a specific chain (`"zion"`, `"quantus"`).
    pub fn register_address_with_chain(&mut self, miner_id: &str, address: &str, chain: &str) {
        let idx = self.registry.lookup_or_register(miner_id);
        self.ensure_capacity(idx);
        self.addresses[idx as usize] = Some(address.to_string());
        self.chains[idx as usize] = (chain != "zion").then(|| chain.to_string());
        self.dirty = true;
    }

    /// Payout chain registered for a miner (`"zion"` default).
    pub fn payout_chain_for(&self, miner_id: &str) -> &str {
        self.registry
            .lookup(miner_id)
            .and_then(|idx| self.chains.get(idx as usize))
            .and_then(|c| c.as_deref())
            .unwrap_or("zion")
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
        self.record_share_with_diff_for_coin(miner_id, worker_name, height, difficulty, "zion");
    }

    /// Record an accepted share tagged with the coin it was mined for.
    ///
    /// Per-coin accounting (F2): every window entry carries a coin index so
    /// the engine can later slice payouts per coin.  The unified
    /// [`compute_miner_payouts`] distribution (ZION block → whole window)
    /// is unchanged — coin slices feed [`compute_miner_payouts_for_coin`]
    /// used by the per-coin payout engines (F3).
    pub fn record_share_with_diff_for_coin(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        height: u64,
        difficulty: u64,
        coin: &str,
    ) {
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.record_share_at_diff_for_coin(
            miner_id,
            worker_name,
            height,
            timestamp_ms,
            difficulty,
            coin,
        );
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
        self.record_share_at_diff_for_coin(
            miner_id,
            worker_name,
            height,
            timestamp_ms,
            difficulty,
            "zion",
        );
    }

    /// Record a coin-tagged share with explicit timestamp — the single
    /// implementation all record paths delegate to.
    pub fn record_share_at_diff_for_coin(
        &mut self,
        miner_id: &str,
        worker_name: &str,
        height: u64,
        timestamp_ms: u64,
        difficulty: u64,
        coin: &str,
    ) {
        let idx = self.registry.lookup_or_register(miner_id);
        let coin_idx = self.coin_registry.lookup_or_register(coin);
        self.ensure_capacity(idx);
        if self.coin_window_weight.len() <= coin_idx as usize {
            self.coin_window_weight.resize(coin_idx as usize + 1, 0);
        }

        let diff = difficulty.max(1);
        self.window.push_back(WindowEntry {
            miner_index: idx,
            coin_index: coin_idx,
            worker_name: worker_name.to_string(),
            timestamp_ms,
            height,
            difficulty: diff,
        });
        self.window_total_difficulty += diff as u128;
        self.share_weights[idx as usize] += diff as u128; // P8
        self.coin_window_weight[coin_idx as usize] += diff as u128;
        *self.miner_coin_weights.entry((idx, coin_idx)).or_insert(0) += diff as u128;
        *self.coin_share_counts.entry(coin_idx).or_insert(0) += 1;

        // Update per-miner stats.
        self.last_share_time_per_miner[idx as usize] = timestamp_ms / 1000;
        self.shares_per_miner[idx as usize].valid += 1;

        while self.window_total_difficulty > self.config.window_size as u128 {
            if let Some(oldest) = self.window.pop_front() {
                self.window_total_difficulty -= oldest.difficulty as u128;
                self.share_weights[oldest.miner_index as usize] -= oldest.difficulty as u128;
                // P8
                self.coin_window_weight[oldest.coin_index as usize] -= oldest.difficulty as u128;
                if let Some(w) = self
                    .miner_coin_weights
                    .get_mut(&(oldest.miner_index, oldest.coin_index))
                {
                    *w = w.saturating_sub(oldest.difficulty as u128);
                    if *w == 0 {
                        self.miner_coin_weights
                            .remove(&(oldest.miner_index, oldest.coin_index));
                    }
                }
            } else {
                break;
            }
        }
        self.dirty = true;
    }

    /// Per-coin share statistics — one entry per coin that ever recorded a
    /// share (F2, feeds `/public/v1/coins` and ops tooling).
    ///
    /// Each row: `(coin_key, lifetime_accepted, window_weight, active_miners)`
    /// where `window_weight` is the coin's slice of the current window and
    /// `active_miners` counts miners with nonzero weight in that slice.
    pub fn coin_stats(&self) -> Vec<CoinShareStats> {
        let mut out = Vec::new();
        for (idx, key) in self.coin_registry.index_to_key.iter().enumerate() {
            let coin_idx = idx as u16;
            let window_weight = self
                .coin_window_weight
                .get(coin_idx as usize)
                .copied()
                .unwrap_or(0);
            let active_miners = self
                .miner_coin_weights
                .iter()
                .filter(|(&(_, c), &w)| c == coin_idx && w > 0)
                .count() as u64;
            out.push(CoinShareStats {
                coin: key.clone(),
                accepted_total: self.coin_share_counts.get(&coin_idx).copied().unwrap_or(0),
                window_weight,
                active_miners,
            });
        }
        out
    }

    /// Miner's difficulty weight inside `coin`'s window slice — the same
    /// incremental counter `distribute_*` uses, so `weight / coin_weight`
    /// is exactly the miner's share of the next payout for that coin.
    pub fn window_weight_for_miner(&self, miner_id: &str, coin: &str) -> u128 {
        let (Some(m), Some(c)) = (
            self.registry.lookup(miner_id),
            self.coin_registry.lookup(coin),
        ) else {
            return 0;
        };
        self.miner_coin_weights.get(&(m, c)).copied().unwrap_or(0)
    }

    /// Current window weight of a single coin (`"qtu"` → its slice only).
    pub fn window_weight_for_coin(&self, coin: &str) -> u128 {
        self.coin_registry
            .lookup(coin)
            .and_then(|idx| self.coin_window_weight.get(idx as usize).copied())
            .unwrap_or(0)
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

    /// Minimum payout threshold for `coin` — `min_payout_native` for
    /// native-payout coins, `min_payout_flowers` for the unified pool.
    pub fn min_payout_for(&self, coin: &str) -> u64 {
        let key = coin.trim().to_ascii_lowercase();
        self.config
            .min_payout_native
            .get(&key)
            .copied()
            .unwrap_or(self.config.min_payout_flowers)
    }

    /// Effective threshold for a specific wallet — the ZIS-account override
    /// when set AND the coin rides the unified (flowers) payout path;
    /// native-payout coins keep their global threshold since the override
    /// is denominated in flowers (A2.3). Dotted ids resolve via prefix.
    pub fn min_payout_for_miner(&self, miner_id: &str, coin: &str) -> u64 {
        let key = coin.trim().to_ascii_lowercase();
        if !self.config.min_payout_native.contains_key(&key) {
            if let Some(v) = self
                .payout_overrides
                .get(miner_id)
                .or_else(|| {
                    miner_id
                        .split('.')
                        .next()
                        .and_then(|w| self.payout_overrides.get(w))
                })
                .copied()
            {
                return v;
            }
        }
        self.min_payout_for(coin)
    }

    /// Replace the whole override map (boot restore from `miner_settings`).
    pub fn set_payout_overrides(&mut self, overrides: HashMap<String, u64>) {
        self.payout_overrides = overrides;
    }

    /// Set or clear one wallet's override — called by the account API.
    pub fn set_payout_override(&mut self, miner_id: &str, flowers: Option<u64>) {
        match flowers {
            Some(f) if f > 0 => {
                self.payout_overrides.insert(miner_id.to_string(), f);
            }
            _ => {
                self.payout_overrides.remove(miner_id);
            }
        }
    }

    /// `true` when `coin` is configured for native-unit payouts
    /// (`native_payout_coins`) — its shares earn only coin revenue events
    /// and are excluded from the unified ZION distribution.
    pub fn is_native_payout_coin(&self, coin: &str) -> bool {
        let key = coin.trim().to_ascii_lowercase();
        self.config.native_payout_coins.iter().any(|c| c == &key)
    }

    /// Resolve configured native-payout tickers to coin indexes.
    fn native_coin_indexes(&self) -> HashSet<u16> {
        self.config
            .native_payout_coins
            .iter()
            .filter_map(|c| self.coin_registry.lookup(c))
            .collect()
    }

    /// Accumulated unpaid balance for a miner on a native-unit coin.
    pub fn unpaid_native_balance(&self, miner_id: &str, coin: &str) -> u64 {
        let (Some(m), Some(c)) = (
            self.registry.lookup(miner_id),
            self.coin_registry.lookup(coin),
        ) else {
            return 0;
        };
        self.unpaid_native.get(&(m, c)).copied().unwrap_or(0)
    }

    /// Lifetime native-unit payouts emitted for a coin (F3 stat).
    pub fn total_paid_native_for(&self, coin: &str) -> u128 {
        self.coin_registry
            .lookup(coin)
            .and_then(|c| self.total_paid_native.get(&c).copied())
            .unwrap_or(0)
    }

    /// Shared distribution + threshold-collection logic for the PPLNS window.
    ///
    /// P8: Uses incremental `share_weights` (Vec<u128>) maintained on each
    /// record_share/eviction, making this O(active_miners) instead of
    /// O(window_len).  At 10k miners with 500k shares in the window, this
    /// is 50× faster than iterating the window.
    ///
    /// F3: miners' weight in `native_payout_coins` is excluded — those
    /// coins are paid only by their own revenue events
    /// ([`compute_miner_payouts_for_coin`]) so a QTU miner's shares never
    /// draw on ZION rewards and ZION shares never dilute QTU revenue.
    fn distribute_to_miners(&mut self, miner_reward: u64) -> Vec<PayoutEntry> {
        let native = self.native_coin_indexes();

        // Collect active miners (weight > 0).  With no native coins
        // configured the incremental share_weights path is exact; once a
        // native set exists we recompose weights from miner_coin_weights
        // filtered to non-native coins.
        let mut active_miners: Vec<(u32, u128)> = Vec::new();
        if native.is_empty() {
            for (i, &w) in self.share_weights.iter().enumerate() {
                if w > 0 {
                    active_miners.push((i as u32, w));
                }
            }
        } else {
            let mut combined: HashMap<u32, u128> = HashMap::new();
            for (&(m, c), &w) in self.miner_coin_weights.iter() {
                if w > 0 && !native.contains(&c) {
                    *combined.entry(m).or_insert(0) += w;
                }
            }
            active_miners.extend(combined);
            active_miners.sort_unstable_by_key(|(m, _)| *m);
        }

        // Count shares per miner in the window for PayoutEntry.share_count.
        // This is a lightweight pass — we need share counts for the payout
        // response, and we can't derive them from share_weights (which is
        // difficulty-weighted, not count-weighted).
        let mut share_counts: Vec<u64> = vec![0; self.share_weights.len()];
        for entry in &self.window {
            if native.is_empty() || !native.contains(&entry.coin_index) {
                share_counts[entry.miner_index as usize] += 1;
            }
        }
        self.distribute_weighted(active_miners, share_counts, miner_reward, None)
    }

    /// Distribute a reward across a single coin's window slice — the per-coin
    /// payout path used by the coin payout engines (F3).  Only shares tagged
    /// with `coin` participate; entries are produced exactly like
    /// [`distribute_to_miners`] (same unpaid/threshold/registry semantics).
    ///
    /// `coin` is a lowercase/uppercase-tolerant ticker (`"qtu"`, `"prl"`, …).
    /// Returns `Vec::new()` when the coin has no window weight.
    /// `expected_chain` is the coin's native payout chain
    /// (`qtu`→`"quantus"`, `prl`→`"pearl"`).  Miners whose registered
    /// payout address lives on a different chain keep their unpaid_native
    /// balance until they register an address on the right chain — a
    /// QTU revenue event must never route planks to a `zion1…` address.
    pub fn compute_miner_payouts_for_coin(
        &mut self,
        coin: &str,
        miner_reward: u64,
        expected_chain: &str,
    ) -> Vec<PayoutEntry> {
        if miner_reward == 0 {
            return Vec::new();
        }
        let Some(coin_idx) = self.coin_registry.lookup(coin) else {
            return Vec::new();
        };
        let mut active_miners: Vec<(u32, u128)> = Vec::new();
        for (&(m, c), &w) in self.miner_coin_weights.iter() {
            if c == coin_idx && w > 0 {
                active_miners.push((m, w));
            }
        }
        if active_miners.is_empty() {
            return Vec::new();
        }
        // Deterministic ordering keeps the "last miner gets remainder" rule
        // reproducible across runs.
        active_miners.sort_unstable_by_key(|(m, _)| *m);

        // Share counts limited to this coin's entries for PayoutEntry.
        let mut share_counts: Vec<u64> = vec![0; self.share_weights.len()];
        for entry in &self.window {
            if entry.coin_index == coin_idx {
                share_counts[entry.miner_index as usize] += 1;
            }
        }
        let dest = NativeDest {
            coin_idx,
            coin_key: self.coin_registry.key_for(coin_idx).to_string(),
            chain: expected_chain.to_string(),
        };
        self.distribute_weighted(active_miners, share_counts, miner_reward, Some(dest))
    }

    /// Weighted distribution core shared by [`distribute_to_miners`]
    /// (unified window) and [`compute_miner_payouts_for_coin`] (coin slice).
    /// `active_miners` is `(miner_index, weight)` pairs; `share_counts`
    /// indexes raw per-miner share counts for `PayoutEntry.share_count`.
    ///
    /// `dest == Some(NativeDest)` switches accounting to per-coin
    /// native-unit buckets (`unpaid_native`), per-coin min threshold, and
    /// a forced payout chain — entries below threshold or on a mismatched
    /// registered chain stay accrued for the next revenue event.
    fn distribute_weighted(
        &mut self,
        active_miners: Vec<(u32, u128)>,
        share_counts: Vec<u64>,
        miner_reward: u64,
        dest: Option<NativeDest>,
    ) -> Vec<PayoutEntry> {
        let mut total_weight: u128 = 0;
        for &(_, w) in &active_miners {
            total_weight += w;
        }
        if total_weight == 0 {
            total_weight = 1;
        }

        let native_min_payout = dest
            .as_ref()
            .and_then(|d| self.config.min_payout_native.get(&d.coin_key).copied());

        // Distribute miner_reward proportionally into the right bucket:
        // `unpaid` (flowers) for unified, `unpaid_native` (coin base units)
        // for per-coin revenue events — the two never mix.
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
            match &dest {
                Some(d) => {
                    *self.unpaid_native.entry((*idx, d.coin_idx)).or_insert(0) += amount;
                }
                None => {
                    self.unpaid[*idx as usize] = self.unpaid[*idx as usize].saturating_add(amount);
                }
            }
        }

        // Collect payouts for miners above the minimum threshold with a
        // registered address on the required payout chain.
        let mut payouts = Vec::new();
        let mut paid_keys: Vec<(usize, Option<u16>)> = Vec::new();
        match &dest {
            Some(d) => {
                let min = native_min_payout.unwrap_or(0);
                for (&(m, c), &bal) in self.unpaid_native.iter() {
                    if c != d.coin_idx || bal < min {
                        continue;
                    }
                    let chain_ok = if d.chain == "zion" {
                        self.chains[m as usize].is_none()
                    } else {
                        self.chains[m as usize].as_deref() == Some(d.chain.as_str())
                    };
                    if !chain_ok {
                        continue;
                    }
                    if let Some(ref address) = self.addresses[m as usize] {
                        payouts.push(PayoutEntry {
                            share_count: share_counts.get(m as usize).copied().unwrap_or(0),
                            miner_id: self.registry.id(m).to_string(),
                            address: address.clone(),
                            amount: bal,
                            payout_chain: (d.chain != "zion").then(|| d.chain.clone()),
                            native_units: true,
                            coin: Some(d.coin_key.clone()),
                            revenue_event: None,
                        });
                        paid_keys.push((m as usize, Some(c)));
                    }
                }
            }
            None => {
                for (i, unpaid) in self.unpaid.iter().enumerate() {
                    let miner_id = self.registry.id(i as u32);
                    let min = self
                        .payout_overrides
                        .get(miner_id)
                        .or_else(|| {
                            miner_id
                                .split('.')
                                .next()
                                .and_then(|w| self.payout_overrides.get(w))
                        })
                        .copied()
                        .unwrap_or(self.config.min_payout_flowers);
                    if *unpaid >= min {
                        if let Some(ref address) = self.addresses[i] {
                            let miner_id = miner_id.to_string();
                            payouts.push(PayoutEntry {
                                share_count: share_counts[i],
                                miner_id,
                                address: address.clone(),
                                amount: *unpaid,
                                payout_chain: self.chains[i].clone(),
                                native_units: false,
                                coin: None,
                                revenue_event: None,
                            });
                            paid_keys.push((i, None));
                        }
                    }
                }
            }
        }

        // Clear paid balances.
        for (i, coin) in &paid_keys {
            match coin {
                Some(c) => {
                    self.unpaid_native.remove(&(*i as u32, *c));
                }
                None => {
                    self.unpaid[*i] = 0;
                }
            }
        }

        if !payouts.is_empty() {
            self.payout_rounds = self.payout_rounds.saturating_add(1);
            let round_total: u128 = payouts
                .iter()
                .fold(0u128, |acc, p| acc.saturating_add(p.amount as u128));
            match &dest {
                Some(d) => {
                    *self.total_paid_native.entry(d.coin_idx).or_insert(0) += round_total;
                }
                None => {
                    self.total_paid_flowers = self.total_paid_flowers.saturating_add(round_total);
                    for payout in &payouts {
                        let idx = self.registry.lookup(&payout.miner_id).unwrap_or(0);
                        self.paid_per_miner[idx as usize] =
                            self.paid_per_miner[idx as usize].saturating_add(payout.amount as u128);
                    }
                }
            }
        }
        self.dirty = true;

        payouts
    }

    /// Roll back a previously computed payout batch.
    ///
    /// Used by the pool when payout execution fails after `compute_payouts`
    /// has already moved balances out of `unpaid`.  Native-unit entries
    /// (`payout.coin` set) roll back into `unpaid_native` so units stay
    /// isolated.
    pub fn rollback_payouts(&mut self, payouts: &[PayoutEntry]) {
        if payouts.is_empty() {
            return;
        }

        for payout in payouts {
            let Some(idx) = self.registry.lookup(&payout.miner_id) else {
                continue;
            };
            let i = idx as usize;
            match payout
                .coin
                .as_deref()
                .and_then(|c| self.coin_registry.lookup(c))
            {
                Some(c) => {
                    *self.unpaid_native.entry((idx, c)).or_insert(0) += payout.amount;
                    let cur = self.total_paid_native.get(&c).copied().unwrap_or(0);
                    self.total_paid_native
                        .insert(c, cur.saturating_sub(payout.amount as u128));
                }
                None => {
                    self.unpaid[i] = self.unpaid[i].saturating_add(payout.amount);
                    self.paid_per_miner[i] =
                        self.paid_per_miner[i].saturating_sub(payout.amount as u128);
                    self.total_paid_flowers = self
                        .total_paid_flowers
                        .saturating_sub(payout.amount as u128);
                }
            }
        }

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

        let registered_miners = self.addresses.iter().filter(|a| a.is_some()).count();

        let miners_with_unpaid = self.unpaid.iter().filter(|&&v| v > 0).count();

        let total_unpaid: u128 = self
            .unpaid
            .iter()
            .fold(0u128, |acc, &v| acc.saturating_add(v as u128));

        PplnsStats {
            window_size: self.config.window_size,
            window_used: self.window.len(),
            window_total_difficulty: self.window_total_difficulty,
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

    /// Public-safe window distribution for `/public/v1/pplns` — single pass
    /// over the window, no state clones (snapshot() would copy every
    /// entry). Returns (miners_in_window, top_miner_share_pct,
    /// coin->weight_pct of window difficulty).
    pub fn public_window_summary(
        &self,
    ) -> (usize, f64, std::collections::HashMap<String, f64>) {
        let total = self.window_total_difficulty.max(1);
        let mut by_miner: std::collections::HashMap<u32, u128> =
            std::collections::HashMap::new();
        let mut by_coin: std::collections::HashMap<u16, u128> =
            std::collections::HashMap::new();
        for e in &self.window {
            let w = u128::from(e.difficulty.max(1));
            *by_miner.entry(e.miner_index).or_default() += w;
            *by_coin.entry(e.coin_index).or_default() += w;
        }
        let top = by_miner.values().copied().max().unwrap_or(0) as f64;
        let coins = by_coin
            .iter()
            .map(|(ci, w)| {
                (
                    self.coin_registry.key_for(*ci).to_string(),
                    *w as f64 / total as f64 * 100.0,
                )
            })
            .collect();
        (by_miner.len(), top / total as f64 * 100.0, coins)
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
    pub window_total_difficulty: u128,
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
            native_payout_coins: Vec::new(),
            min_payout_native: HashMap::new(),
        })
    }

    fn engine_with_fees(window_size: usize, min_payout: u64) -> PplnsEngine {
        PplnsEngine::new(PplnsConfig {
            window_size,
            min_payout_flowers: min_payout,
            fee_config: FeeConfig::default(), // 5/5/1 split
            native_payout_coins: Vec::new(),
            min_payout_native: HashMap::new(),
        })
    }

    /// Engine with `native_coins` siloed for native-unit payouts (F3) and
    /// per-coin minimum thresholds in native base units.
    fn engine_native(
        window_size: usize,
        min_payout: u64,
        native_coins: &[&str],
        min_native: &[(&str, u64)],
    ) -> PplnsEngine {
        PplnsEngine::new(PplnsConfig {
            window_size,
            min_payout_flowers: min_payout,
            fee_config: FeeConfig::no_fees(),
            native_payout_coins: native_coins.iter().map(|c| c.to_string()).collect(),
            min_payout_native: min_native
                .iter()
                .map(|(c, m)| (c.to_string(), *m))
                .collect(),
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

    /// A2.3: a per-wallet override applies to unified-path selection in
    /// both directions (lower pays earlier, higher holds longer) and
    /// clearing restores the global threshold.
    #[test]
    fn payout_override_applies_and_clears() {
        let mut e = engine(100, 500_000);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "zion1bob");
        for i in 0..3 {
            e.record_share_at("alice", "r", 1, 1000 + i);
        }
        e.record_share_at("bob", "r", 1, 2000);
        // alice 750k, bob 250k.

        e.set_payout_override("alice", Some(900_000)); // raise → hold
        e.set_payout_override("bob", Some(200_000)); // lower → pay
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "bob");
        assert_eq!(payouts[0].amount, 250_000);
        assert_eq!(e.unpaid_balance("alice"), 750_000);

        e.set_payout_override("alice", None); // clear → global again
        e.record_share_at("alice", "r", 2, 3000);
        // Nonzero reward needed — compute_payouts short-circuits on 0.
        let payouts = e.compute_payouts(1);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "alice");
        assert!(payouts[0].amount >= 750_000);
    }

    /// A2.3: overrides are keyed on the wallet — a dotted login id
    /// (`wallet.rig`) resolves via its prefix.
    #[test]
    fn payout_override_dotted_miner_id_uses_wallet_prefix() {
        let mut e = engine(100, 500_000);
        e.register_address("w1.rigA", "zion1w1");
        e.set_payout_override("w1", Some(100));
        e.record_share_at("w1.rigA", "r", 1, 1000);
        let payouts = e.compute_payouts(250);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].amount, 250);
    }

    /// A2.3: `min_payout_for_miner` — override on unified coins, prefix
    /// resolution, global fallback, and native-payout coins keep their
    /// native-unit threshold (the override is flowers-denominated).
    #[test]
    fn min_payout_for_miner_resolves_override_and_native() {
        let mut e = engine_native(100, 500_000, &["qtu"], &[("qtu", 42)]);
        e.set_payout_override("w1", Some(777));
        assert_eq!(e.min_payout_for_miner("w1", "zion"), 777);
        assert_eq!(e.min_payout_for_miner("w1.rigA", "zion"), 777);
        assert_eq!(e.min_payout_for_miner("w2", "zion"), 500_000);
        assert_eq!(e.min_payout_for_miner("w1", "qtu"), 42);

        // Bulk restore replaces the whole map.
        e.set_payout_overrides(HashMap::from([("w9".to_string(), 1u64)]));
        assert_eq!(e.min_payout_for_miner("w9", "zion"), 1);
        assert_eq!(e.min_payout_for_miner("w1", "zion"), 500_000);
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
        assert_eq!(cfg.min_payout_flowers, zion_core::MIN_PAYOUT_AMOUNT);
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
        let snap = PplnsEngine::load_from_path(&path)
            .expect("snapshot read should succeed")
            .expect("snapshot should exist");
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
        assert!(PplnsEngine::load_from_path(&path).unwrap().is_none());
    }

    #[test]
    fn corrupt_snapshot_is_an_error() {
        let path =
            std::env::temp_dir().join(format!("zion_pplns_corrupt_{}.json", std::process::id()));
        std::fs::write(&path, b"{not-json").unwrap();

        let err = PplnsEngine::load_from_path(&path).unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidData);

        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn failed_snapshot_write_keeps_engine_dirty_for_retry() {
        let root =
            std::env::temp_dir().join(format!("zion_pplns_save_failure_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("missing").join("state.json");

        let mut engine = engine_with_fees(100, 100);
        engine.record_share_at("alice", "rig1", 1, 10);
        assert!(engine.save_if_dirty(&path).is_err());
        assert!(engine.dirty);

        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        assert!(engine.save_if_dirty(&path).unwrap());
        assert!(!engine.dirty);

        std::fs::remove_dir_all(root).unwrap();
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

    // ── F2: per-coin share accounting ────────────────────────────────

    #[test]
    fn coin_tagged_shares_slice_window() {
        let mut e = engine_with_fees(1_000_000, 1);
        e.register_address("alice", "zion1alice");
        e.register_address("bob", "qz1bob");
        e.record_share_at_diff_for_coin("alice", "rig1", 1, 1000, 100, "zion");
        e.record_share_at_diff_for_coin("alice", "rig1", 1, 1100, 200, "qtu");
        e.record_share_at_diff_for_coin("bob", "rig2", 1, 1200, 400, "qtu");
        e.record_share_at_diff_for_coin("bob", "rig2", 1, 1300, 50, "prl");

        let stats = e.coin_stats();
        assert_eq!(stats.len(), 3);
        let zion = stats.iter().find(|s| s.coin == "zion").unwrap();
        assert_eq!(zion.accepted_total, 1);
        assert_eq!(zion.window_weight, 100);
        assert_eq!(zion.active_miners, 1);
        let qtu = stats.iter().find(|s| s.coin == "qtu").unwrap();
        assert_eq!(qtu.accepted_total, 2);
        assert_eq!(qtu.window_weight, 600);
        assert_eq!(qtu.active_miners, 2);
        let prl = stats.iter().find(|s| s.coin == "prl").unwrap();
        assert_eq!(prl.window_weight, 50);

        assert_eq!(e.window_weight_for_coin("qtu"), 600);
        assert_eq!(e.window_weight_for_coin("QTU"), 600); // case-insensitive
        assert_eq!(e.window_weight_for_coin("vrsc"), 0); // unknown coin
        assert_eq!(e.stats().window_total_difficulty, 750);
    }

    #[test]
    fn coin_payouts_distribute_within_slice_only() {
        let mut e = engine_with_fees(1_000_000, 1);
        e.register_address("alice", "zion1alice");
        e.register_address_with_chain("bob", "qz1bob", "quantus");
        // alice mines zion, bob mines qtu — coin slices must not mix.
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "zion");
        e.record_share_at_diff_for_coin("bob", "r", 1, 1000, 300, "qtu");

        let payouts = e.compute_miner_payouts_for_coin("qtu", 1000, "quantus");
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "bob");
        assert_eq!(payouts[0].amount, 1000);
        assert_eq!(payouts[0].share_count, 1);

        // ZION slice pays only alice.
        let payouts = e.compute_miner_payouts_for_coin("zion", 1000, "zion");
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "alice");

        // Unknown/empty coin → no payouts.
        assert!(e
            .compute_miner_payouts_for_coin("vrsc", 1000, "vrsc")
            .is_empty());
        assert!(e
            .compute_miner_payouts_for_coin("qtu", 0, "quantus")
            .is_empty());
    }

    #[test]
    fn coin_payouts_proportional_within_slice() {
        let mut e = engine_with_fees(1_000_000, 1);
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        e.register_address_with_chain("bob", "qz1bob", "quantus");
        // alice 300 diff qtu, bob 100 diff qtu + zion noise that must not
        // dilute the qtu round.
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 300, "qtu");
        e.record_share_at_diff_for_coin("bob", "r", 1, 1000, 100, "qtu");
        e.record_share_at_diff_for_coin("bob", "r", 1, 1000, 10_000, "zion");

        let payouts = e.compute_miner_payouts_for_coin("qtu", 400, "quantus");
        assert_eq!(payouts.len(), 2);
        let alice = payouts.iter().find(|p| p.miner_id == "alice").unwrap();
        let bob = payouts.iter().find(|p| p.miner_id == "bob").unwrap();
        assert_eq!(alice.amount, 300);
        assert_eq!(bob.amount, 100);
    }

    #[test]
    fn coin_tags_survive_window_eviction() {
        // Window of 100 difficulty — evictions must decrement per-coin
        // weights too.  A share larger than the whole window evicts
        // itself, so the overflow share must stay <= 100.
        let mut e = engine_with_fees(100, 1);
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 60, "qtu");
        e.record_share_at_diff_for_coin("alice", "r", 1, 1001, 40, "zion");
        // Push 60 diff of zion — total 160 evicts only the oldest qtu share.
        e.record_share_at_diff_for_coin("bob", "r", 1, 1002, 60, "zion");

        assert_eq!(e.window_weight_for_coin("qtu"), 0);
        assert_eq!(e.window_weight_for_coin("zion"), 100); // alice 40 + bob 60
                                                           // Miner-coin weight map fully drained for evicted entries.
        let qtu = e
            .coin_stats()
            .into_iter()
            .find(|s| s.coin == "qtu")
            .unwrap();
        assert_eq!(qtu.window_weight, 0);
        assert_eq!(qtu.active_miners, 0);
        assert_eq!(qtu.accepted_total, 1); // lifetime count survives
    }

    #[test]
    fn coin_snapshot_roundtrip() {
        let mut e = engine_with_fees(1_000_000, 1);
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "qtu");
        e.record_share_at_diff_for_coin("alice", "r", 1, 1001, 50, "prl");

        let snap = e.snapshot();
        let mut e2 = engine_with_fees(1_000_000, 1);
        e2.restore(snap);

        assert_eq!(e2.window_weight_for_coin("qtu"), 100);
        assert_eq!(e2.window_weight_for_coin("prl"), 50);
        let stats = e2.coin_stats();
        assert_eq!(stats.len(), 2);
        // Coin-sliced payout works post-restore.
        let payouts = e2.compute_miner_payouts_for_coin("qtu", 1000, "quantus");
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].amount, 1000);
    }

    #[test]
    fn pre_f2_snapshot_defaults_to_zion() {
        // Shares serialized before F2 have no `coin` field — serde default
        // must tag them "zion" so old snapshots keep loading.
        let json =
            r#"{"miner_id":"m","worker_name":"w","timestamp_ms":1,"height":1,"difficulty":5}"#;
        let share: PplnsShare = serde_json::from_str(json).unwrap();
        assert_eq!(share.coin, "zion");
    }

    // ---- F3: native-unit payout isolation ----

    #[test]
    fn native_revenue_pays_in_coin_units() {
        let mut e = engine_native(1_000_000, 1, &["qtu"], &[]);
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        e.register_address_with_chain("bob", "zion1bob", "zion");
        // alice mines QTU, bob mines ZION.
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "qtu");
        e.record_share_at_diff_for_coin("bob", "r", 1, 1000, 100, "zion");

        let payouts = e.compute_miner_payouts_for_coin("qtu", 5_000_000, "quantus");
        assert_eq!(payouts.len(), 1);
        let p = &payouts[0];
        assert_eq!(p.miner_id, "alice");
        assert_eq!(p.amount, 5_000_000); // planks, not flowers
        assert!(p.native_units);
        assert_eq!(p.coin.as_deref(), Some("qtu"));
        assert_eq!(p.payout_chain.as_deref(), Some("quantus"));
        // Native units never leaked into the flowers bucket.
        assert_eq!(e.unpaid_balance("alice"), 0);
        assert_eq!(e.unpaid_native_balance("alice", "qtu"), 0); // paid out
    }

    #[test]
    fn native_coin_excluded_from_unified_distribution() {
        let mut e = engine_native(1_000_000, 1, &["qtu"], &[]);
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        e.register_address_with_chain("bob", "zion1bob", "zion");
        // Equal weights, different coins.
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "qtu");
        e.record_share_at_diff_for_coin("bob", "r", 1, 1000, 100, "zion");

        // Unified ZION block reward must go entirely to bob — alice's
        // QTU weight earns only QTU revenue events.
        let payouts = e.compute_payouts(1_000_000);
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].miner_id, "bob");
        assert_eq!(payouts[0].amount, 1_000_000);
        assert!(!payouts[0].native_units);
    }

    #[test]
    fn native_threshold_accumulates_across_events() {
        let mut e = engine_native(1_000_000, 1, &["qtu"], &[("qtu", 500)]);
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "qtu");

        // First event below threshold — nothing emitted, balance accrues.
        let payouts = e.compute_miner_payouts_for_coin("qtu", 300, "quantus");
        assert!(payouts.is_empty());
        assert_eq!(e.unpaid_native_balance("alice", "qtu"), 300);

        // Second event pushes over the threshold — pays the full accrued
        // amount, not just this event's delta.
        let payouts = e.compute_miner_payouts_for_coin("qtu", 300, "quantus");
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].amount, 600);
        assert!(payouts[0].native_units);
        assert_eq!(e.unpaid_native_balance("alice", "qtu"), 0);
    }

    #[test]
    fn native_chain_mismatch_keeps_balance() {
        let mut e = engine_native(1_000_000, 1, &["qtu"], &[]);
        // alice registered a *zion* payout address but mines qtu —
        // sending planks to a ZION address must never happen.
        e.register_address_with_chain("alice", "zion1alice", "zion");
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "qtu");

        let payouts = e.compute_miner_payouts_for_coin("qtu", 1_000, "quantus");
        assert!(payouts.is_empty());
        assert_eq!(e.unpaid_native_balance("alice", "qtu"), 1_000);

        // She re-registers a quantus address — next event pays her.
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        let payouts = e.compute_miner_payouts_for_coin("qtu", 500, "quantus");
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].amount, 1_500);
    }

    #[test]
    fn native_snapshot_preserves_balances() {
        let mut e = engine_native(1_000_000, 1, &["qtu", "prl"], &[("qtu", 1_000)]);
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        e.register_address_with_chain("bob", "prl1bob", "pearl");
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "qtu");
        e.record_share_at_diff_for_coin("bob", "r", 1, 1000, 100, "prl");

        // Accrue below-threshold qtu + emit a prl payout (lifetime stat).
        assert!(e
            .compute_miner_payouts_for_coin("qtu", 300, "quantus")
            .is_empty());
        let prl = e.compute_miner_payouts_for_coin("prl", 700, "pearl");
        assert_eq!(prl.len(), 1);

        let snap = e.snapshot();
        let mut e2 = engine_native(1_000_000, 1, &["qtu", "prl"], &[("qtu", 1_000)]);
        e2.restore(snap);

        assert_eq!(e2.unpaid_native_balance("alice", "qtu"), 300);
        assert_eq!(e2.unpaid_native_balance("bob", "prl"), 0);
        // The emitted prl payout counted toward the lifetime total.
        assert_eq!(e2.total_paid_native_for("prl"), 700);
        // Threshold is still enforced post-restore: 300+500=800 < 1000,
        // another 500 pushes it to 1300 ≥ 1000 → pays the full balance.
        assert!(e2
            .compute_miner_payouts_for_coin("qtu", 500, "quantus")
            .is_empty());
        let payouts = e2.compute_miner_payouts_for_coin("qtu", 500, "quantus");
        assert_eq!(payouts.len(), 1);
        assert_eq!(payouts[0].amount, 1_300);
    }

    #[test]
    fn native_rollback_restores_coin_bucket() {
        let mut e = engine_native(1_000_000, 1, &["qtu"], &[]);
        e.register_address_with_chain("alice", "qz1alice", "quantus");
        e.record_share_at_diff_for_coin("alice", "r", 1, 1000, 100, "qtu");
        let payouts = e.compute_miner_payouts_for_coin("qtu", 800, "quantus");
        assert_eq!(payouts.len(), 1);
        assert_eq!(e.unpaid_native_balance("alice", "qtu"), 0);

        e.rollback_payouts(&payouts);
        assert_eq!(e.unpaid_native_balance("alice", "qtu"), 800);
        assert_eq!(e.unpaid_balance("alice"), 0); // flowers untouched
    }
}
