//! DAO core types.

use serde::{Deserialize, Serialize};

pub const DAO_TREASURY_ADDRESSES: &[&str] = &[
    "zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5",
    "zion1s27490u7n823g098w42077h8f2n824w0y75w0s3",
    "zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238",
];

pub const FLOWERS_PER_ZION: u64 = 1_000_000;
pub const DAO_TREASURY_TOTAL: u128 = 4_000_000_000_u128 * FLOWERS_PER_ZION as u128;
pub const PROPOSAL_THRESHOLD: u64 = 1_000_000 * FLOWERS_PER_ZION;
pub const VOTING_PERIOD_SECS: u64 = 7 * 24 * 60 * 60;
pub const TIMELOCK_SECS: u64 = 48 * 60 * 60;
pub const QUORUM_PERCENT: f64 = 10.0;
pub const MULTISIG_THRESHOLD: u32 = 5;
pub const MULTISIG_TOTAL: u32 = 7;
pub const DAILY_SPEND_LIMIT: u128 = 100_000_000_u128 * FLOWERS_PER_ZION as u128;

pub const DAO_MEMO_PREFIX: &str = "DAO";

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
                candidate => VoteChoice::Candidate(candidate.to_string()),
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VoteChoice {
    Yes,
    No,
    Abstain,
    Candidate(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guardian {
    pub name: String,
    pub address: String,
    pub public_key: String,
    pub is_active: bool,
}

pub type LayerId = u8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoAdminRole {
    Validator,
    CoreDev,
    Security,
    Treasury,
    Bridge,
    Relayer,
    Auditor,
    Curator,
    Moderator,
    Community,
    Network,
    Steward,
}

impl CoAdminRole {
    pub fn layer(&self) -> LayerId {
        match self {
            CoAdminRole::Validator | CoAdminRole::CoreDev | CoAdminRole::Security => 1,
            CoAdminRole::Treasury | CoAdminRole::Bridge => 2,
            CoAdminRole::Relayer | CoAdminRole::Auditor => 3,
            CoAdminRole::Curator | CoAdminRole::Moderator => 4,
            CoAdminRole::Community | CoAdminRole::Network => 5,
            CoAdminRole::Steward => 6,
        }
    }

    pub fn role_name(&self) -> &'static str {
        match self {
            CoAdminRole::Validator => "validator",
            CoAdminRole::CoreDev => "core_dev",
            CoAdminRole::Security => "security",
            CoAdminRole::Treasury => "treasury",
            CoAdminRole::Bridge => "bridge",
            CoAdminRole::Relayer => "relayer",
            CoAdminRole::Auditor => "auditor",
            CoAdminRole::Curator => "curator",
            CoAdminRole::Moderator => "moderator",
            CoAdminRole::Community => "community",
            CoAdminRole::Network => "network",
            CoAdminRole::Steward => "steward",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoAdmin {
    pub name: String,
    pub address: String,
    pub public_key: String,
    pub role: CoAdminRole,
    pub layer: LayerId,
    pub bonded: u64,
    pub reputation: u64,
    pub is_active: bool,
    pub appointed_at: u64,
    pub term_end: Option<u64>,
}

impl CoAdmin {
    pub fn is_in_layer(&self, layer: LayerId) -> bool {
        self.layer == layer && self.is_active
    }

    pub fn can_cross_layer(&self) -> bool {
        matches!(
            self.role,
            CoAdminRole::Treasury
                | CoAdminRole::Bridge
                | CoAdminRole::Network
                | CoAdminRole::Steward
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoterSnapshot {
    pub address: String,
    pub balance: u64,
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
            DaoMemo::Propose { proposal_type } => assert_eq!(proposal_type, "treasury"),
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
    fn test_co_admin_role_layer() {
        assert_eq!(CoAdminRole::Validator.layer(), 1);
        assert_eq!(CoAdminRole::Treasury.layer(), 2);
        assert_eq!(CoAdminRole::Relayer.layer(), 3);
        assert_eq!(CoAdminRole::Curator.layer(), 4);
        assert_eq!(CoAdminRole::Community.layer(), 5);
        assert_eq!(CoAdminRole::Steward.layer(), 6);
    }

    #[test]
    fn test_co_admin_cross_layer() {
        let treasury = CoAdmin {
            name: "Alice".into(),
            address: "zion1alice".into(),
            public_key: "pk1".into(),
            role: CoAdminRole::Treasury,
            layer: 2,
            bonded: 1_000_000,
            reputation: 500,
            is_active: true,
            appointed_at: 100,
            term_end: None,
        };
        assert!(treasury.can_cross_layer());
        assert!(treasury.is_in_layer(2));
        assert!(!treasury.is_in_layer(5));

        let validator = CoAdmin {
            name: "Bob".into(),
            address: "zion1bob".into(),
            public_key: "pk2".into(),
            role: CoAdminRole::Validator,
            layer: 1,
            bonded: 2_000_000,
            reputation: 1000,
            is_active: true,
            appointed_at: 200,
            term_end: None,
        };
        assert!(!validator.can_cross_layer());
    }

    #[test]
    fn test_constants() {
        assert_eq!(FLOWERS_PER_ZION, 1_000_000);
        assert_eq!(DAO_TREASURY_TOTAL, 4_000_000_000_000_000_u128);
        assert_eq!(PROPOSAL_THRESHOLD, 1_000_000_000_000);
        assert_eq!(DAILY_SPEND_LIMIT, 100_000_000_000_000_u128);
        assert_eq!(VOTING_PERIOD_SECS, 604_800);
        assert_eq!(TIMELOCK_SECS, 172_800);
        assert_eq!(MULTISIG_THRESHOLD, 5);
        assert_eq!(MULTISIG_TOTAL, 7);
    }
}
