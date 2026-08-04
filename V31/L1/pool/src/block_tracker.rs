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

/// Summary statistics for the block tracker.
#[derive(Debug, Clone, Default)]
pub struct BlockTrackerStats {
    pub total_blocks: u64,
    pub total_confirmed: u64,
    pub total_orphans: u64,
    pub pending_count: usize,
    pub pool_luck_100: Option<f64>,
    pub pool_luck_500: Option<f64>,
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

    /// Record a block found.
    pub fn record_block_found(
        &mut self,
        height: u64,
        miner_id: &str,
        worker_name: &str,
        share_difficulty: u64,
        network_difficulty: u64,
        node_accepted: bool,
    ) {
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

    /// Return summary statistics for the tracker.
    pub fn stats(&self) -> BlockTrackerStats {
        BlockTrackerStats {
            total_blocks: self.total_blocks,
            total_confirmed: self.total_confirmed,
            total_orphans: self.total_orphans,
            pending_count: self.pending_blocks().len(),
            pool_luck_100: self.pool_luck_pct(100),
            pool_luck_500: self.pool_luck_pct(500),
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
        assert!((luck - 100.0).abs() < 0.01, "expected 100% luck, got {luck}");
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
}
