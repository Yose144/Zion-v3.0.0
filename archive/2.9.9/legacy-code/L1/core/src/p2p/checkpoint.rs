//! Blockchain Checkpoints — ZION L1 Core
//!
//! Hardcoded block-height → block-hash pairs that allow new nodes to skip
//! full validation of old history and trust the majority-chain up to the
//! latest checkpoint.  This is the same approach used by Bitcoin and other
//! major PoW chains.
//!
//! Inspired by `TREE_NODES/sync/checkpoint_manager.py` from the 2.9-History
//! Python codebase, rewritten in Rust for production.
//!
//! ## How it works
//! 1. During IBD, after validating a block `height`, call `is_valid_block()`.
//! 2. If a checkpoint exists for that height, the stored hash must match.
//! 3. If it doesn't match → the chain is invalid / attacker's fork → abort.
//! 4. The highest checkpoint also lets us fast-forward headers without
//!    downloading every block body (future optimisation).

use std::collections::HashMap;

/// A single hardcoded checkpoint.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Checkpoint {
    pub height: u64,
    /// Lowercase hex SHA-256 block hash.
    pub hash: String,
    /// Human-readable label (optional, for logging).
    pub label: &'static str,
}

/// All checkpoints for the ZION mainnet.
///
/// **How to add a new checkpoint:**
/// 1. Wait until the block is deeply buried (≥ 1000 confirmations recommended).
/// 2. Get the canonical hash via `curl -s localhost:8545 -d '{"method":"getBlockByHeight","params":[<N>]}' | jq .result.hash`
/// 3. Append an entry here and bump the version in `Cargo.toml`.
pub const MAINNET_CHECKPOINTS: &[(&u64, &str, &str)] = &[
    // (height, hash, label)
    // Genesis — height 0. Hash is set after actual mainnet launch.
    // Placeholder zeros will be replaced before mainnet.
    (&0,      "0000000000000000000000000000000000000000000000000000000000000000", "genesis"),
    // Testnet reference points (will be replaced with mainnet hashes)
    // (&10_000, "...", "testnet-month-1"),
    // (&50_000, "...", "mainnet-first-epoch"),
];

/// In-memory checkpoint index, built once at startup.
pub struct CheckpointManager {
    index: HashMap<u64, Checkpoint>,
    /// Highest checkpoint height — blocks below this can trust headers only.
    pub highest: u64,
}

impl CheckpointManager {
    /// Build from the hardcoded `MAINNET_CHECKPOINTS` slice.
    pub fn new() -> Self {
        let mut index = HashMap::new();
        let mut highest = 0u64;

        for &(height, hash, label) in MAINNET_CHECKPOINTS {
            let h = *height;
            index.insert(
                h,
                Checkpoint {
                    height: h,
                    hash: hash.to_string(),
                    label,
                },
            );
            if h > highest {
                highest = h;
            }
        }

        CheckpointManager { index, highest }
    }

    /// Returns `true` if the block passes checkpoint validation.
    ///
    /// - If no checkpoint exists at `height` → always `true` (no opinion).
    /// - If a checkpoint exists → hash must match exactly.
    pub fn is_valid_block(&self, height: u64, hash: &str) -> bool {
        match self.index.get(&height) {
            None => true, // no checkpoint at this height
            Some(cp) => {
                let valid = cp.hash == hash;
                if !valid {
                    println!(
                        "[Checkpoint] ⚠️  FORK DETECTED at height {}! \
                         Expected {} but got {}",
                        height, cp.hash, hash
                    );
                }
                valid
            }
        }
    }

    /// Returns the checkpoint at `height` if it exists.
    pub fn get(&self, height: u64) -> Option<&Checkpoint> {
        self.index.get(&height)
    }

    /// How many checkpoints are loaded.
    pub fn len(&self) -> usize {
        self.index.len()
    }

    /// True if there are no checkpoints (genesis-only node).
    pub fn is_empty(&self) -> bool {
        self.index.is_empty()
    }

    /// Returns all checkpoints sorted by height (useful for RPC/metrics).
    pub fn all_sorted(&self) -> Vec<&Checkpoint> {
        let mut v: Vec<&Checkpoint> = self.index.values().collect();
        v.sort_by_key(|c| c.height);
        v
    }
}

impl Default for CheckpointManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checkpoint_manager_builds() {
        let cm = CheckpointManager::new();
        assert!(!cm.is_empty(), "Must have at least genesis checkpoint");
        assert_eq!(cm.len(), MAINNET_CHECKPOINTS.len());
    }

    #[test]
    fn test_valid_genesis() {
        let cm = CheckpointManager::new();
        let genesis_hash = "0000000000000000000000000000000000000000000000000000000000000000";
        assert!(cm.is_valid_block(0, genesis_hash));
    }

    #[test]
    fn test_invalid_genesis() {
        let cm = CheckpointManager::new();
        assert!(!cm.is_valid_block(0, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"));
    }

    #[test]
    fn test_no_checkpoint_passes() {
        let cm = CheckpointManager::new();
        // Height 9999 has no checkpoint — any hash should pass
        assert!(cm.is_valid_block(9999, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
        assert!(cm.is_valid_block(9999, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    }

    #[test]
    fn test_all_sorted_order() {
        let cm = CheckpointManager::new();
        let sorted = cm.all_sorted();
        for w in sorted.windows(2) {
            assert!(w[0].height < w[1].height, "Checkpoints must be sorted by height");
        }
    }

    #[test]
    fn test_highest_is_correct() {
        let cm = CheckpointManager::new();
        // Highest should be max height in MAINNET_CHECKPOINTS
        let expected_max = MAINNET_CHECKPOINTS.iter().map(|(h, _, _)| **h).max().unwrap_or(0);
        assert_eq!(cm.highest, expected_max);
    }
}
