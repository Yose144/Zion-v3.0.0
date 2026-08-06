//! DAO configuration.

use std::env;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaoConfig {
    pub name: String,
    pub version: String,
    pub api_port: u16,
    pub api_key: String,
    pub db_path: String,
    pub l1_rpc_url: String,
    pub l1_rpc_backup: Option<String>,
    pub scan_interval_secs: u64,
    pub min_vote_weight: u64,
    pub finality_blocks: u64,
    pub proposal_threshold: u64,
    pub quorum_percent: f64,
    pub voting_period_days: u32,
    pub timelock_hours: u32,
    pub treasury_addresses: Vec<String>,
    pub daily_spend_limit: u64,
    pub multisig_threshold: u32,
    pub multisig_total: u32,
    #[serde(default)]
    pub guardians: Vec<GuardianConfig>,
    #[serde(default)]
    pub co_admins: Vec<CoAdminConfig>,
    #[serde(default = "default_true")]
    pub cross_layer_veto_enabled: bool,
    #[serde(default = "default_cross_layer_threshold")]
    pub cross_layer_consent_threshold: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardianConfig {
    pub name: String,
    pub address: String,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoAdminConfig {
    pub layer: u8,
    pub role: String,
    pub name: String,
    pub address: String,
    pub public_key: String,
    pub bonded_amount: u64,
    pub reputation: u64,
    pub term_start: String,
    pub term_end: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool {
    true
}

fn default_cross_layer_threshold() -> u8 {
    2
}

impl Default for DaoConfig {
    fn default() -> Self {
        Self {
            name: "ZION DAO".into(),
            version: "3.1.0-alpha.1".into(),
            api_port: 8080,
            api_key: String::new(),
            db_path: "data/dao.db".into(),
            l1_rpc_url: "127.0.0.1:9443".into(),
            l1_rpc_backup: Some("127.0.0.1:9443".into()),
            scan_interval_secs: 10,
            min_vote_weight: 1_000_000,
            finality_blocks: 6,
            proposal_threshold: 1_000_000_000_000,
            quorum_percent: 10.0,
            voting_period_days: 7,
            timelock_hours: 48,
            treasury_addresses: vec![
                "zion1x8g2z2v3v5n08542a5u7v7q365l4852048qv6w6".into(),
                "zion1q4n03368p4n0f0w3x2u3a5a5g46363g2d64v4r0".into(),
                "zion1j765h3r6x4u8l222v8u278c406m4e755g0pt0f0".into(),
            ],
            daily_spend_limit: 100_000_000,
            multisig_threshold: 5,
            multisig_total: 7,
            guardians: vec![],
            co_admins: vec![],
            cross_layer_veto_enabled: true,
            cross_layer_consent_threshold: 2,
        }
    }
}

impl DaoConfig {
    pub fn load(file_path: Option<&str>) -> Self {
        let mut cfg = Self::default();

        let toml_path = file_path
            .map(|s| s.to_string())
            .or_else(|| env::var("DAO_CONFIG").ok());

        if let Some(ref path) = toml_path {
            match Self::from_toml_file(path) {
                Ok(file_cfg) => {
                    tracing::info!("Config loaded from {}", path);
                    cfg = file_cfg;
                }
                Err(e) => {
                    tracing::warn!("Could not load DAO_CONFIG={}: {} — using defaults", path, e);
                }
            }
        }

        if let Ok(v) = env::var("DAO_API_PORT") {
            if let Ok(p) = v.parse::<u16>() {
                cfg.api_port = p;
            }
        }
        if let Ok(v) = env::var("ZION_DAO_API_KEY") {
            cfg.api_key = v;
        }
        if let Ok(v) = env::var("DAO_DB_PATH") {
            cfg.db_path = v;
        }
        if let Ok(v) = env::var("DAO_L1_RPC") {
            cfg.l1_rpc_url = v;
        }

        cfg
    }

    fn from_toml_file(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        if !Path::new(path).exists() {
            return Err(format!("file not found: {}", path).into());
        }
        let raw = std::fs::read_to_string(path)?;
        let cfg: Self = toml::from_str(&raw)?;
        Ok(cfg)
    }

    pub fn to_toml_string(&self) -> String {
        toml::to_string_pretty(self).unwrap_or_else(|_| "# serialization error".into())
    }
}
