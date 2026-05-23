//! DAO Core Types
//!
//! Shared types used across all DAO modules.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// DAO Address Constants
// ---------------------------------------------------------------------------

/// DAO Treasury address on L1 (from genesis premine)
/// Total: 4,000,000,000 ZION across 3 addresses
pub const DAO_TREASURY_ADDRESSES: &[&str] = &[
    "zion1dao0treasury0main000000000000000000001",
    "zion1dao0treasury0main000000000000000000002",
    "zion1dao0treasury0main000000000000000000003",
];

/// Total DAO treasury in atomic units (4B × 10⁶)
pub const DAO_TREASURY_TOTAL: u64 = 4_000_000_000_000_000;

/// Minimum ZION balance to create a proposal (1M ZION)
pub const PROPOSAL_THRESHOLD: u64 = 1_000_000_000_000; // 1M × 10⁶

/// Voting period in seconds (7 days)
pub const VOTING_PERIOD_SECS: u64 = 7 * 24 * 60 * 60;

/// Timelock duration in seconds (48 hours)
pub const TIMELOCK_SECS: u64 = 48 * 60 * 60;

/// Quorum percentage (10% of circulating supply must vote)
pub const QUORUM_PERCENT: f64 = 10.0;

/// Multi-sig threshold for treasury operations
pub const MULTISIG_THRESHOLD: u32 = 5;
pub const MULTISIG_TOTAL: u32 = 7;

/// Maximum treasury spend per day in atomic units (100M ZION)
pub const DAILY_SPEND_LIMIT: u64 = 100_000_000_000_000;

// ---------------------------------------------------------------------------
// DAO Memo Format
// ---------------------------------------------------------------------------

/// DAO memo prefix for L1 transactions
/// Format: "DAO:<action>:<data>"
/// Examples:
///   "DAO:vote:42:yes"       — Vote yes on proposal 42
///   "DAO:propose:treasury"  — Create treasury proposal
///   "DAO:execute:42"        — Execute approved proposal 42
pub const DAO_MEMO_PREFIX: &str = "DAO";

/// Parse a DAO memo from an L1 transaction
pub fn parse_dao_memo(memo: &str) -> Option<DaoMemo> {
    let parts: Vec<&str> = memo.split(':').collect();
    if parts.first() != Some(&DAO_MEMO_PREFIX) || parts.len() < 3 {
        return None;
    }
    match parts[1] {
        "vote" if parts.len() >= 4 => Some(DaoMemo::Vote {
            proposal_id: parts[2].to_string(),
            choice: match parts[3] {
                "yes" => VoteChoice::Yes,
                "no" => VoteChoice::No,
                "abstain" => VoteChoice::Abstain,
                _ => return None,
            },
        }),
        "propose" => Some(DaoMemo::Propose {
            proposal_type: parts[2].to_string(),
        }),
        "execute" => Some(DaoMemo::Execute {
            proposal_id: parts[2].to_string(),
        }),
        _ => None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DaoMemo {
    Vote {
        proposal_id: String,
        choice: VoteChoice,
    },
    Propose {
        proposal_type: String,
    },
    Execute {
        proposal_id: String,
    },
}

// ---------------------------------------------------------------------------
// Vote Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VoteChoice {
    Yes,
    No,
    Abstain,
}

// ---------------------------------------------------------------------------
// Guardian (multi-sig signer)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guardian {
    pub name: String,
    pub address: String,
    pub public_key: String,
    pub is_active: bool,
}

// ---------------------------------------------------------------------------
// Snapshot of voter balance
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoterSnapshot {
    /// Voter L1 address
    pub address: String,
    /// Balance in atomic units at snapshot block
    pub balance: u64,
    /// Block height at which balance was snapshotted
    pub snapshot_block: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_vote_memo() {
        let memo = "DAO:vote:42:yes";
        let parsed = parse_dao_memo(memo).unwrap();
        match parsed {
            DaoMemo::Vote {
                proposal_id,
                choice,
            } => {
                assert_eq!(proposal_id, "42");
                assert_eq!(choice, VoteChoice::Yes);
            }
            _ => panic!("Expected Vote memo"),
        }
    }

    #[test]
    fn test_parse_proposal_memo() {
        let memo = "DAO:propose:treasury";
        let parsed = parse_dao_memo(memo).unwrap();
        match parsed {
            DaoMemo::Propose { proposal_type } => {
                assert_eq!(proposal_type, "treasury");
            }
            _ => panic!("Expected Propose memo"),
        }
    }

    #[test]
    fn test_parse_invalid_memo() {
        assert!(parse_dao_memo("BRIDGE:base:0x123").is_none());
        assert!(parse_dao_memo("DAO:invalid").is_none());
        assert!(parse_dao_memo("random text").is_none());
    }

    #[test]
    fn test_constants() {
        // 4B ZION = 4_000_000_000 × 1_000_000 atomic
        assert_eq!(DAO_TREASURY_TOTAL, 4_000_000_000_000_000);
        // 1M ZION threshold
        assert_eq!(PROPOSAL_THRESHOLD, 1_000_000_000_000);
        // 7 days
        assert_eq!(VOTING_PERIOD_SECS, 604_800);
        // 48 hours
        assert_eq!(TIMELOCK_SECS, 172_800);
        // 5-of-7
        assert_eq!(MULTISIG_THRESHOLD, 5);
        assert_eq!(MULTISIG_TOTAL, 7);
    }
}
