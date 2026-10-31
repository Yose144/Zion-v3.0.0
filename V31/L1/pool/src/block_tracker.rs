//! Block tracker module — orphan monitoring + pool luck tracking.
//!
//! Ported from V3 pool (`archive/V3/L1/pool/src/bin/server.rs` lines 168-341).
//! F1.5: background thread polls node RPC to confirm/orphan blocks.
//! F1.6: pool luck = expected_shares / actual_shares (100% = average).

use std::collections::VecDeque;
use std::time::{SystemTime, UNIX_EPOCH};

/// Current wall-clock time in Unix seconds.
pub fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Confirmation status of a block found by the pool.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BlockStatus {
    Pending,
    Confirmed,
    Orphaned,
}

/// Record of a single block found by the pool.
#[derive(Debug, Clone)]
pub struct BlockRecord {
    pub height: u64,
    pub miner_id: String,
    pub worker_name: String,
    /// Wall-clock timestamp (unix seconds) when the block was found.
    pub found_at_unix: u64,
    /// Share difficulty at the time the block was found (for luck calc).
    pub share_difficulty: u64,
    /// Network difficulty at the time (for luck calc).
    pub network_difficulty: u64,
    /// Number of shares submitted since the previous block (for luck calc).
    pub shares_since_prev_block: u64,
    /// Whether the node accepted the block submission.
    pub node_accepted: bool,
    /// Confirmation status: Pending, Confirmed, Orphaned.
    pub status: BlockStatus,
    /// Height of the chain when this block was confirmed/orphaned (0 = pending).
    pub confirmed_at_chain_height: u64,
}

/// Dominant-miner concentration over a trailing window of found blocks
/// (IA-19/1.B6): the largest single miner's block share — the metric whose
/// spike revealed the G8 run #2 single-miner dependency.
#[derive(Debug, Clone, Default)]
pub struct DominantShare {
    /// Miner identity (`miner_id` from the winning share).
    pub miner_id: String,
    /// Blocks attributed to that miner inside the window.
    pub blocks: u64,
    /// Total blocks in the window.
    pub total: u64,
    /// `blocks / total * 100`.
    pub share_pct: f64,
}

/// Summary statistics for the block tracker.
#[derive(Debug, Clone, Default)]
pub struct BlockTrackerStats {
    pub total_blocks: u64,
    pub total_confirmed: u64,
    pub total_orphans: u64,
    pub pending_count: usize,
    pub pool_luck_100: Option<f64>,
    pub pool_luck_500: Option<f64>,
    /// Live accepted-share counter since the last found block — feeds the
    /// public "current effort" gauge (effort = actual/expected shares).
    pub shares_since_last_block: u64,
    /// Largest single-miner share of the last 100 found blocks (1.B6).
    pub dominant_share_100: Option<DominantShare>,
}

/// In-memory block tracker with stats for pool luck and orphan monitoring.
///
/// F1.5: background thread polls node RPC to confirm/orphan blocks.
/// F1.6: pool luck = expected_shares / actual_shares (100% = average).
pub struct BlockTracker {
    /// Recent block records (newest at back, capped at 1000).
    blocks: VecDeque<BlockRecord>,
    /// Running count of shares since the last block was found.
    shares_since_last_block: u64,
    /// Total blocks found (all time).
    total_blocks: u64,
    /// Total orphaned blocks (all time).
    total_orphans: u64,
    /// Total confirmed blocks (all time).
    total_confirmed: u64,
}

impl Default for BlockTracker {
    fn default() -> Self {
        Self {
            blocks: VecDeque::with_capacity(100),
            shares_since_last_block: 0,
            total_blocks: 0,
            total_orphans: 0,
            total_confirmed: 0,
        }
    }
}

impl BlockTracker {
    /// Create a new empty block tracker.
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a share submission (called on every accepted ZION share).
    pub fn record_share(&mut self) {
        self.shares_since_last_block += 1;
    }

    /// Record a block found. Returns the accepted-share count since the
    /// previous block — callers persist it as the luck input (v8).
    pub fn record_block_found(
        &mut self,
        height: u64,
        miner_id: &str,
        worker_name: &str,
        share_difficulty: u64,
        network_difficulty: u64,
        node_accepted: bool,
    ) -> u64 {
        let shares = self.shares_since_last_block;
        let now = now_unix_seconds();
        self.blocks.push_back(BlockRecord {
            height,
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            found_at_unix: now,
            share_difficulty,
            network_difficulty,
            shares_since_prev_block: shares,
            node_accepted,
            status: if node_accepted {
                BlockStatus::Pending
            } else {
                BlockStatus::Orphaned
            },
            confirmed_at_chain_height: 0,
        });
        if !node_accepted {
            self.total_orphans += 1;
        }
        self.total_blocks += 1;
        self.shares_since_last_block = 0;
        // Cap memory at 1000 blocks.
        while self.blocks.len() > 1000 {
            self.blocks.pop_front();
        }
        shares
    }

    /// Rebuild the tracker from persisted block rows + the live share
    /// counter. Called once at boot after migrations — restores the full
    /// luck window (luck_100/luck_500), all-time totals and the pending
    /// set. Rows must arrive oldest-first.
    pub fn restore(&mut self, rows: Vec<crate::store::DbBlockRow>, shares_since_last_block: u64) {
        self.shares_since_last_block = shares_since_last_block;
        for row in rows {
            let status = match row.status.as_str() {
                "confirmed" => BlockStatus::Confirmed,
                "orphaned" => BlockStatus::Orphaned,
                _ => BlockStatus::Pending,
            };
            self.blocks.push_back(BlockRecord {
                height: row.height,
                miner_id: row.miner_id,
                worker_name: row.worker_name,
                found_at_unix: row.ts.max(0) as u64,
                share_difficulty: row.share_difficulty,
                network_difficulty: row.network_difficulty,
                shares_since_prev_block: row.shares_since_prev,
                node_accepted: status != BlockStatus::Orphaned,
                status,
                confirmed_at_chain_height: 0,
            });
        }
        while self.blocks.len() > 1000 {
            self.blocks.pop_front();
        }
        self.total_blocks = self.blocks.len() as u64;
        self.total_confirmed = self
            .blocks
            .iter()
            .filter(|b| b.status == BlockStatus::Confirmed)
            .count() as u64;
        self.total_orphans = self
            .blocks
            .iter()
            .filter(|b| b.status == BlockStatus::Orphaned)
            .count() as u64;
    }

    /// Mark a block as confirmed or orphaned by height.
    pub fn resolve_block(&mut self, height: u64, orphaned: bool, chain_height: u64) {
        if let Some(rec) = self
            .blocks
            .iter_mut()
            .find(|b| b.height == height && b.status == BlockStatus::Pending)
        {
            rec.status = if orphaned {
                BlockStatus::Orphaned
            } else {
                BlockStatus::Confirmed
            };
            rec.confirmed_at_chain_height = chain_height;
            if orphaned {
                self.total_orphans += 1;
            } else {
                self.total_confirmed += 1;
            }
        }
    }

    /// Load a pending block from the DB on startup so the orphan monitor
    /// continues to track blocks that were found before a restart.
    pub fn load_pending_block(
        &mut self,
        height: u64,
        miner_id: &str,
        worker_name: &str,
        share_difficulty: u64,
        network_difficulty: u64,
    ) {
        if self.blocks.iter().any(|b| b.height == height) {
            return;
        }
        self.blocks.push_back(BlockRecord {
            height,
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            found_at_unix: 0,
            share_difficulty,
            network_difficulty,
            shares_since_prev_block: 0,
            node_accepted: true,
            status: BlockStatus::Pending,
            confirmed_at_chain_height: 0,
        });
        while self.blocks.len() > 1000 {
            self.blocks.pop_front();
        }
    }

    /// Pool luck percentage for the last N blocks.
    ///
    /// luck = (expected_shares / actual_shares) * 100
    /// expected_shares = network_difficulty / share_difficulty
    /// 100% = average luck, >100% = lucky, <100% = unlucky.
    pub fn pool_luck_pct(&self, last_n: usize) -> Option<f64> {
        let recent: Vec<&BlockRecord> = self.blocks.iter().rev().take(last_n).collect();
        if recent.is_empty() {
            return None;
        }
        let mut total_expected = 0.0_f64;
        let mut total_actual = 0.0_f64;
        for rec in &recent {
            if rec.share_difficulty == 0 || rec.shares_since_prev_block == 0 {
                continue;
            }
            let expected = rec.network_difficulty as f64 / rec.share_difficulty as f64;
            total_expected += expected;
            total_actual += rec.shares_since_prev_block as f64;
        }
        if total_actual == 0.0 {
            return None;
        }
        Some((total_expected / total_actual) * 100.0)
    }

    /// Accepted shares counted since the last block — persisted
    /// periodically (pool_state kv) so a restart restores the counter.
    pub fn shares_since_last_block(&self) -> u64 {
        self.shares_since_last_block
    }

    /// Pending blocks (found but not yet confirmed/orphaned).
    pub fn pending_blocks(&self) -> Vec<&BlockRecord> {
        self.blocks
            .iter()
            .filter(|b| b.status == BlockStatus::Pending)
            .collect()
    }

    /// The N most recent blocks (newest first).
    pub fn recent_blocks(&self, n: usize) -> Vec<&BlockRecord> {
        self.blocks.iter().rev().take(n).collect()
    }

    /// Largest single-miner share over the last `window` found blocks.
    /// `None` when no blocks are recorded. Ties resolve to the miner whose
    /// most recent block is newest (the concentration that is *currently*
    /// growing is the operational concern).
    pub fn dominant_miner_share(&self, window: usize) -> Option<DominantShare> {
        let recent: Vec<&BlockRecord> = self.blocks.iter().rev().take(window).collect();
        if recent.is_empty() {
            return None;
        }
        let total = recent.len() as u64;
        let mut counts: std::collections::HashMap<&str, u64> = std::collections::HashMap::new();
        for rec in &recent {
            *counts.entry(rec.miner_id.as_str()).or_default() += 1;
        }
        let (miner_id, blocks) = counts
            .iter()
            .max_by(|(m1, b1), (m2, b2)| {
                b1.cmp(b2).then_with(|| {
                    // Tie-break: newer last-seen block wins (recency).
                    let last_seen = |m: &str| {
                        recent
                            .iter()
                            .position(|r| r.miner_id == m)
                            .map(|i| recent.len() - i)
                            .unwrap_or(0)
                    };
                    last_seen(m1).cmp(&last_seen(m2))
                })
            })
            .map(|(m, b)| (*m, *b))?;
        Some(DominantShare {
            miner_id: miner_id.to_string(),
            blocks,
            total,
            share_pct: blocks as f64 / total as f64 * 100.0,
        })
    }

    /// Return summary statistics for the tracker.
    pub fn stats(&self) -> BlockTrackerStats {
        BlockTrackerStats {
            total_blocks: self.total_blocks,
            total_confirmed: self.total_confirmed,
            total_orphans: self.total_orphans,
            pending_count: self.pending_blocks().len(),
            pool_luck_100: self.pool_luck_pct(100),
            pool_luck_500: self.pool_luck_pct(500),
            shares_since_last_block: self.shares_since_last_block,
            dominant_share_100: self.dominant_miner_share(100),
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_share_increments() {
        let mut tracker = BlockTracker::new();
        assert_eq!(tracker.shares_since_last_block, 0);
        tracker.record_share();
        tracker.record_share();
        tracker.record_share();
        assert_eq!(tracker.shares_since_last_block, 3);
    }

    #[test]
    fn test_record_block_found_resets_counter() {
        let mut tracker = BlockTracker::new();
        tracker.record_share();
        tracker.record_share();
        tracker.record_share();
        assert_eq!(tracker.shares_since_last_block, 3);

        tracker.record_block_found(100, "miner1", "worker1", 1000, 100_000, true);
        assert_eq!(tracker.shares_since_last_block, 0);
        assert_eq!(tracker.total_blocks, 1);
        assert_eq!(tracker.blocks.len(), 1);

        let rec = &tracker.blocks[0];
        assert_eq!(rec.height, 100);
        assert_eq!(rec.miner_id, "miner1");
        assert_eq!(rec.worker_name, "worker1");
        assert_eq!(rec.share_difficulty, 1000);
        assert_eq!(rec.network_difficulty, 100_000);
        assert_eq!(rec.shares_since_prev_block, 3);
        assert!(rec.node_accepted);
        assert_eq!(rec.status, BlockStatus::Pending);
    }

    #[test]
    fn test_resolve_block_confirmed() {
        let mut tracker = BlockTracker::new();
        tracker.record_block_found(200, "miner1", "worker1", 1000, 100_000, true);
        assert_eq!(tracker.total_confirmed, 0);

        tracker.resolve_block(200, false, 250);
        assert_eq!(tracker.total_confirmed, 1);
        assert_eq!(tracker.pending_blocks().len(), 0);

        let rec = &tracker.blocks[0];
        assert_eq!(rec.status, BlockStatus::Confirmed);
        assert_eq!(rec.confirmed_at_chain_height, 250);
    }

    #[test]
    fn test_resolve_block_orphaned() {
        let mut tracker = BlockTracker::new();
        tracker.record_block_found(300, "miner1", "worker1", 1000, 100_000, true);
        assert_eq!(tracker.total_orphans, 0);

        tracker.resolve_block(300, true, 310);
        assert_eq!(tracker.total_orphans, 1);
        assert_eq!(tracker.pending_blocks().len(), 0);

        let rec = &tracker.blocks[0];
        assert_eq!(rec.status, BlockStatus::Orphaned);
        assert_eq!(rec.confirmed_at_chain_height, 310);
    }

    #[test]
    fn test_pool_luck_calculation() {
        let mut tracker = BlockTracker::new();

        // Block 1: network_diff=100_000, share_diff=1000 → expected=100 shares
        // actual shares since prev = 80 → lucky (100/80 * 100 = 125%)
        tracker.shares_since_last_block = 80;
        tracker.record_block_found(1, "m", "w", 1000, 100_000, true);

        // Block 2: network_diff=100_000, share_diff=1000 → expected=100 shares
        // actual shares since prev = 120 → unlucky (100/120 * 100 ≈ 83.33%)
        tracker.shares_since_last_block = 120;
        tracker.record_block_found(2, "m", "w", 1000, 100_000, true);

        // total expected = 200, total actual = 200 → luck = 100%
        let luck = tracker.pool_luck_pct(10).expect("luck should be Some");
        assert!(
            (luck - 100.0).abs() < 0.01,
            "expected 100% luck, got {luck}"
        );
    }

    #[test]
    fn test_cap_at_1000_blocks() {
        let mut tracker = BlockTracker::new();
        for h in 0..1005 {
            tracker.record_block_found(h, "m", "w", 1000, 100_000, true);
        }
        assert_eq!(tracker.blocks.len(), 1000);
        // Oldest blocks (0..4) should have been evicted; block 5 is now the front.
        assert_eq!(tracker.blocks.front().unwrap().height, 5);
        // Total blocks counter still reflects all-time count.
        assert_eq!(tracker.total_blocks, 1005);
    }

    #[test]
    fn test_pending_blocks() {
        let mut tracker = BlockTracker::new();
        tracker.record_block_found(1, "m", "w", 1000, 100_000, true);
        tracker.record_block_found(2, "m", "w", 1000, 100_000, true);
        tracker.resolve_block(1, false, 50);

        let pending = tracker.pending_blocks();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].height, 2);
        assert_eq!(pending[0].status, BlockStatus::Pending);
    }

    /// v8 restart path: restoring persisted rows rebuilds the luck
    /// window, totals, pending set and the live share counter — same
    /// numbers the tracker would report had it never restarted.
    #[test]
    fn test_restore_rebuilds_luck_and_counter() {
        let row = |height: u64, shares: u64, nd: u64, status: &str| crate::store::DbBlockRow {
            coin: "zion".to_string(),
            height,
            hash: "h".to_string(),
            miner_id: "m".to_string(),
            worker_name: "w".to_string(),
            share_difficulty: 1000,
            network_difficulty: nd,
            shares_since_prev: shares,
            status: status.to_string(),
            ts: 1_700_000_000 + height as i64,
            confirmed_at: None,
        };
        let mut tracker = BlockTracker::new();
        tracker.restore(
            vec![
                row(1, 100, 100_000, "confirmed"), // expected=100 actual=100
                row(2, 120, 100_000, "orphaned"),  // expected=100 actual=120
                row(3, 0, 100_000, "pending"),     // row predating v8
            ],
            55, // shares accepted after block 3
        );
        assert_eq!(tracker.shares_since_last_block, 55);
        assert_eq!(tracker.total_blocks, 3);
        assert_eq!(tracker.total_confirmed, 1);
        assert_eq!(tracker.total_orphans, 1);
        assert_eq!(tracker.pending_blocks().len(), 1);
        // expected=200, actual=220 → luck ≈ 90.9% (v8-less row ignored).
        let luck = tracker.pool_luck_pct(10).expect("luck restored");
        assert!((luck - 90.9).abs() < 0.1, "got {luck}");
        let stats = tracker.stats();
        assert_eq!(stats.total_blocks, 3);
        assert!(stats.pool_luck_100.is_some());
        // New shares keep counting on the restored counter.
        tracker.record_share();
        assert_eq!(tracker.shares_since_last_block, 56);
        // A new block captures the restored counter and resets it.
        let n = tracker.record_block_found(4, "m", "w", 1000, 100_000, true);
        assert_eq!(n, 56);
        assert_eq!(tracker.shares_since_last_block, 0);
    }

    // ── 1.B6/IA-19: dominant-miner share ─────────────────────────────────

    #[test]
    fn dominant_share_none_when_empty() {
        let tracker = BlockTracker::new();
        assert!(tracker.dominant_miner_share(100).is_none());
        assert!(tracker.stats().dominant_share_100.is_none());
    }

    #[test]
    fn dominant_share_single_miner_is_100pct() {
        let mut tracker = BlockTracker::new();
        for h in 1..=5 {
            tracker.record_block_found(h, "whale", "w1", 1000, 100_000, true);
        }
        let d = tracker.dominant_miner_share(100).unwrap();
        assert_eq!(d.miner_id, "whale");
        assert_eq!(d.blocks, 5);
        assert_eq!(d.total, 5);
        assert!((d.share_pct - 100.0).abs() < f64::EPSILON);
    }

    #[test]
    fn dominant_share_picks_largest_miner() {
        let mut tracker = BlockTracker::new();
        // whale 7, small 3 → 70/30.
        for h in 1..=7 {
            tracker.record_block_found(h, "whale", "w", 1000, 100_000, true);
        }
        for h in 8..=10 {
            tracker.record_block_found(h, "small", "w", 1000, 100_000, true);
        }
        let d = tracker.dominant_miner_share(100).unwrap();
        assert_eq!(d.miner_id, "whale");
        assert_eq!(d.blocks, 7);
        assert_eq!(d.total, 10);
        assert!((d.share_pct - 70.0).abs() < 0.01);
    }

    #[test]
    fn dominant_share_window_excludes_older_blocks() {
        let mut tracker = BlockTracker::new();
        // 10 whale blocks, then 5 small blocks. Window 5 → only small.
        for h in 1..=10 {
            tracker.record_block_found(h, "whale", "w", 1000, 100_000, true);
        }
        for h in 11..=15 {
            tracker.record_block_found(h, "small", "w", 1000, 100_000, true);
        }
        let d = tracker.dominant_miner_share(5).unwrap();
        assert_eq!(d.miner_id, "small");
        assert_eq!(d.total, 5);
        assert!((d.share_pct - 100.0).abs() < f64::EPSILON);
    }

    #[test]
    fn dominant_share_tie_prefers_most_recent() {
        let mut tracker = BlockTracker::new();
        tracker.record_block_found(1, "alice", "w", 1000, 100_000, true);
        tracker.record_block_found(2, "bob", "w", 1000, 100_000, true);
        tracker.record_block_found(3, "alice", "w", 1000, 100_000, true);
        tracker.record_block_found(4, "bob", "w", 1000, 100_000, true);
        // 2–2 tie; bob's last block is newer.
        let d = tracker.dominant_miner_share(100).unwrap();
        assert_eq!(d.miner_id, "bob");
        assert_eq!(d.blocks, 2);
        assert!((d.share_pct - 50.0).abs() < f64::EPSILON);
    }

    #[test]
    fn dominant_share_in_stats() {
        let mut tracker = BlockTracker::new();
        for h in 1..=4 {
            tracker.record_block_found(h, "solo", "w", 1000, 100_000, true);
        }
        let d = tracker.stats().dominant_share_100.unwrap();
        assert_eq!(d.miner_id, "solo");
        assert_eq!(d.total, 4);
    }
}
