// ── Block Propagation ──────────────────────────────────────────────────
//
// Flood-fill block relay with deduplication. When a node accepts a new
// block (from mining, RPC submit, or peer announce), the propagation
// engine decides which connected peers should receive the AnnounceBlock
// message, skipping the source peer and any block the node has already
// relayed.
//
// The library side is pure logic (no I/O). The node binary is
// responsible for the actual TCP relay calls.

use crate::PeerEndpoint;
use std::collections::{HashSet, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};

// ── Seen blocks cache ──────────────────────────────────────────────────

/// Maximum number of block hashes to remember for dedup.
pub const MAX_SEEN_BLOCKS: usize = 2048;

/// Bounded FIFO set of block hashes we have already relayed or received.
/// Prevents relay loops in flood-fill propagation.
pub struct SeenBlocks {
    hashes: HashSet<String>,
    order: VecDeque<String>,
    capacity: usize,
}

impl SeenBlocks {
    pub fn new() -> Self {
        Self::with_capacity(MAX_SEEN_BLOCKS)
    }

    pub fn with_capacity(capacity: usize) -> Self {
        assert!(capacity > 0, "seen cache capacity must be > 0");
        Self {
            hashes: HashSet::with_capacity(capacity),
            order: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    /// Insert a block hash. Returns `true` if the hash was new (not seen
    /// before). Returns `false` if this hash was already in the cache.
    pub fn insert(&mut self, hash: String) -> bool {
        if self.hashes.contains(&hash) {
            return false;
        }
        // Evict oldest if at capacity
        if self.hashes.len() >= self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.hashes.remove(&oldest);
            }
        }
        self.hashes.insert(hash.clone());
        self.order.push_back(hash);
        true
    }

    /// Check if a block hash has been seen.
    pub fn contains(&self, hash: &str) -> bool {
        self.hashes.contains(hash)
    }

    pub fn len(&self) -> usize {
        self.hashes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.hashes.is_empty()
    }
}

impl Default for SeenBlocks {
    fn default() -> Self {
        Self::new()
    }
}

// ── Relay planning ─────────────────────────────────────────────────────

/// A single relay target.
#[derive(Debug, Clone)]
pub struct RelayTarget {
    pub peer: PeerEndpoint,
}

/// A plan describing which peers should receive a newly accepted block.
#[derive(Debug, Clone)]
pub struct RelayPlan {
    pub block_hash: String,
    pub block_height: u64,
    pub targets: Vec<RelayTarget>,
}

/// Compute the relay plan for a newly accepted block.
///
/// - `block_hash`: hex hash of the accepted block
/// - `block_height`: height of the accepted block
/// - `connected_peers`: all known/connected peers
/// - `source_addr`: address of the peer that sent us this block (excluded
///   from relay). `None` if the block was locally mined.
/// - `seen`: the seen-blocks cache (updated on success)
///
/// Returns `None` if the block was already seen or there are no relay
/// targets.
pub fn plan_relay(
    block_hash: &str,
    block_height: u64,
    connected_peers: &[PeerEndpoint],
    source_addr: Option<&str>,
    seen: &mut SeenBlocks,
) -> Option<RelayPlan> {
    // Dedup: skip if already relayed
    if !seen.insert(block_hash.to_string()) {
        return None;
    }

    let targets: Vec<RelayTarget> = connected_peers
        .iter()
        .filter(|peer| {
            // Exclude the source peer
            source_addr.map_or(true, |src| peer.address() != src)
        })
        .map(|peer| RelayTarget { peer: peer.clone() })
        .collect();

    if targets.is_empty() {
        return None;
    }

    Some(RelayPlan {
        block_hash: block_hash.to_string(),
        block_height,
        targets,
    })
}

// ── Propagation statistics ─────────────────────────────────────────────

/// Atomic counters for block propagation telemetry.
pub struct PropagationStats {
    pub blocks_relayed: AtomicU64,
    pub relay_attempts: AtomicU64,
    pub relay_successes: AtomicU64,
    pub relay_failures: AtomicU64,
    pub duplicates_skipped: AtomicU64,
}

impl PropagationStats {
    pub fn new() -> Self {
        Self {
            blocks_relayed: AtomicU64::new(0),
            relay_attempts: AtomicU64::new(0),
            relay_successes: AtomicU64::new(0),
            relay_failures: AtomicU64::new(0),
            duplicates_skipped: AtomicU64::new(0),
        }
    }

    pub fn record_relay(&self, target_count: u64) {
        self.blocks_relayed.fetch_add(1, Ordering::Relaxed);
        self.relay_attempts.fetch_add(target_count, Ordering::Relaxed);
    }

    pub fn record_success(&self) {
        self.relay_successes.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_failure(&self) {
        self.relay_failures.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_duplicate(&self) {
        self.duplicates_skipped.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> PropagationSnapshot {
        PropagationSnapshot {
            blocks_relayed: self.blocks_relayed.load(Ordering::Relaxed),
            relay_attempts: self.relay_attempts.load(Ordering::Relaxed),
            relay_successes: self.relay_successes.load(Ordering::Relaxed),
            relay_failures: self.relay_failures.load(Ordering::Relaxed),
            duplicates_skipped: self.duplicates_skipped.load(Ordering::Relaxed),
        }
    }
}

impl Default for PropagationStats {
    fn default() -> Self {
        Self::new()
    }
}

/// Point-in-time snapshot of propagation counters (non-atomic, copyable).
#[derive(Debug, Clone, Copy, Default)]
pub struct PropagationSnapshot {
    pub blocks_relayed: u64,
    pub relay_attempts: u64,
    pub relay_successes: u64,
    pub relay_failures: u64,
    pub duplicates_skipped: u64,
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── SeenBlocks ─────────────────────────────────────────────────

    #[test]
    fn seen_blocks_insert_new_returns_true() {
        let mut seen = SeenBlocks::new();
        assert!(seen.insert("aabbcc".to_string()));
        assert_eq!(seen.len(), 1);
    }

    #[test]
    fn seen_blocks_insert_duplicate_returns_false() {
        let mut seen = SeenBlocks::new();
        assert!(seen.insert("aabbcc".to_string()));
        assert!(!seen.insert("aabbcc".to_string()));
        assert_eq!(seen.len(), 1);
    }

    #[test]
    fn seen_blocks_contains() {
        let mut seen = SeenBlocks::new();
        assert!(!seen.contains("aabbcc"));
        seen.insert("aabbcc".to_string());
        assert!(seen.contains("aabbcc"));
    }

    #[test]
    fn seen_blocks_evicts_oldest_at_capacity() {
        let mut seen = SeenBlocks::with_capacity(3);
        seen.insert("a".to_string());
        seen.insert("b".to_string());
        seen.insert("c".to_string());
        assert_eq!(seen.len(), 3);

        // Inserting "d" should evict "a"
        assert!(seen.insert("d".to_string()));
        assert_eq!(seen.len(), 3);
        assert!(!seen.contains("a"));
        assert!(seen.contains("b"));
        assert!(seen.contains("c"));
        assert!(seen.contains("d"));
    }

    #[test]
    fn seen_blocks_eviction_chain() {
        let mut seen = SeenBlocks::with_capacity(2);
        seen.insert("x".to_string());
        seen.insert("y".to_string());
        seen.insert("z".to_string()); // evicts "x"
        assert!(!seen.contains("x"));
        seen.insert("w".to_string()); // evicts "y"
        assert!(!seen.contains("y"));
        assert!(seen.contains("z"));
        assert!(seen.contains("w"));
    }

    #[test]
    fn seen_blocks_default_capacity() {
        let seen = SeenBlocks::new();
        assert_eq!(seen.capacity, MAX_SEEN_BLOCKS);
        assert!(seen.is_empty());
    }

    // ── plan_relay ────────────────────────────────────────────────

    #[test]
    fn plan_relay_returns_none_for_already_seen_block() {
        let mut seen = SeenBlocks::new();
        seen.insert("hash_a".to_string());

        let peers = vec![PeerEndpoint::new("1.2.3.4", 8334)];
        let plan = plan_relay("hash_a", 10, &peers, None, &mut seen);
        assert!(plan.is_none());
    }

    #[test]
    fn plan_relay_returns_none_when_no_peers() {
        let mut seen = SeenBlocks::new();
        let plan = plan_relay("hash_b", 10, &[], None, &mut seen);
        assert!(plan.is_none());
    }

    #[test]
    fn plan_relay_excludes_source_peer() {
        let mut seen = SeenBlocks::new();
        let peers = vec![
            PeerEndpoint::new("1.2.3.4", 8334),
            PeerEndpoint::new("5.6.7.8", 8334),
        ];
        let plan = plan_relay("hash_c", 10, &peers, Some("1.2.3.4:8334"), &mut seen);
        let plan = plan.expect("should have a relay plan");
        assert_eq!(plan.targets.len(), 1);
        assert_eq!(plan.targets[0].peer.address(), "5.6.7.8:8334");
    }

    #[test]
    fn plan_relay_returns_none_when_only_source_peer() {
        let mut seen = SeenBlocks::new();
        let peers = vec![PeerEndpoint::new("1.2.3.4", 8334)];
        let plan = plan_relay("hash_d", 10, &peers, Some("1.2.3.4:8334"), &mut seen);
        assert!(plan.is_none());
    }

    #[test]
    fn plan_relay_includes_all_non_source_peers() {
        let mut seen = SeenBlocks::new();
        let peers = vec![
            PeerEndpoint::new("10.0.0.1", 8334),
            PeerEndpoint::new("10.0.0.2", 8334),
            PeerEndpoint::new("10.0.0.3", 8334),
            PeerEndpoint::new("10.0.0.4", 8334),
        ];
        let plan = plan_relay("hash_e", 5, &peers, Some("10.0.0.2:8334"), &mut seen);
        let plan = plan.expect("should have a relay plan");
        assert_eq!(plan.targets.len(), 3);
        assert_eq!(plan.block_height, 5);
        assert_eq!(plan.block_hash, "hash_e");
        let addrs: Vec<_> = plan.targets.iter().map(|t| t.peer.address()).collect();
        assert!(addrs.contains(&"10.0.0.1:8334".to_string()));
        assert!(!addrs.contains(&"10.0.0.2:8334".to_string()));
        assert!(addrs.contains(&"10.0.0.3:8334".to_string()));
        assert!(addrs.contains(&"10.0.0.4:8334".to_string()));
    }

    #[test]
    fn plan_relay_locally_mined_block_goes_to_all_peers() {
        let mut seen = SeenBlocks::new();
        let peers = vec![
            PeerEndpoint::new("10.0.0.1", 8334),
            PeerEndpoint::new("10.0.0.2", 8334),
        ];
        let plan = plan_relay("hash_f", 1, &peers, None, &mut seen);
        let plan = plan.expect("should have a relay plan");
        assert_eq!(plan.targets.len(), 2);
    }

    #[test]
    fn plan_relay_marks_block_as_seen() {
        let mut seen = SeenBlocks::new();
        let peers = vec![PeerEndpoint::new("10.0.0.1", 8334)];
        let plan = plan_relay("hash_g", 1, &peers, None, &mut seen);
        assert!(plan.is_some());
        // Second call with same hash should return None
        let plan2 = plan_relay("hash_g", 1, &peers, None, &mut seen);
        assert!(plan2.is_none());
    }

    // ── PropagationStats ──────────────────────────────────────────

    #[test]
    fn propagation_stats_counters() {
        let stats = PropagationStats::new();
        stats.record_relay(3);
        stats.record_success();
        stats.record_success();
        stats.record_failure();
        stats.record_duplicate();

        let snap = stats.snapshot();
        assert_eq!(snap.blocks_relayed, 1);
        assert_eq!(snap.relay_attempts, 3);
        assert_eq!(snap.relay_successes, 2);
        assert_eq!(snap.relay_failures, 1);
        assert_eq!(snap.duplicates_skipped, 1);
    }

    #[test]
    fn propagation_stats_default() {
        let snap = PropagationStats::default().snapshot();
        assert_eq!(snap.blocks_relayed, 0);
        assert_eq!(snap.relay_attempts, 0);
    }
}
