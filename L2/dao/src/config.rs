//! DAO Configuration

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaoConfig {
    /// DAO identity
    pub name: String,
    pub version: String,

    /// L1 connection (for balance queries + TX submission)
    pub l1_rpc_url: String,
    pub l1_rpc_backup: Option<String>,

    /// Governance parameters
    pub proposal_threshold: u64,
    pub quorum_percent: f64,
    pub voting_period_days: u32,
    pub timelock_hours: u32,

    /// Treasury
    pub treasury_addresses: Vec<String>,
    pub daily_spend_limit: u64,
    pub multisig_threshold: u32,
    pub multisig_total: u32,

    /// Guardians
    pub guardians: Vec<GuardianConfig>,

    /// Database
    pub database_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardianConfig {
    pub name: String,
    pub address: String,
    pub public_key: String,
}

impl Default for DaoConfig {
    fn default() -> Self {
        Self {
            name: "ZION DAO".into(),
            version: "1.0.0".into(),
            l1_rpc_url: "http://77.42.31.72:8332".into(),
            l1_rpc_backup: Some("http://195.201.31.201:8332".into()),
            proposal_threshold: 1_000_000_000_000, // 1M ZION
            quorum_percent: 10.0,
            voting_period_days: 7,
            timelock_hours: 48,
            treasury_addresses: vec![
                "zion1dao0treasury0main000000000000000000001".into(),
                "zion1dao0treasury0main000000000000000000002".into(),
                "zion1dao0treasury0main000000000000000000003".into(),
            ],
            daily_spend_limit: 100_000_000_000_000, // 100M ZION
            multisig_threshold: 5,
            multisig_total: 7,
            guardians: vec![],
            database_path: "data/dao.db".into(),
        }
    }
}
