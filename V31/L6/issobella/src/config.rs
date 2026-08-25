//! Configuration for zion-issobella daemon.

use serde::{Deserialize, Serialize};

/// Canonical V31 mainnet Issobella fund address.
pub const DEFAULT_ISSOBELLA_FUND_ADDRESS: &str =
    "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IssobellaConfig {
    pub name: String,
    pub bind: String,
    pub port: u16,
    pub db_path: String,
    pub l1_rpc_url: String,
    pub scan_interval_secs: u64,
    pub api_key: String,
    pub issobella_fund_address: String,
    pub min_mission_budget_zion: u64,
    pub max_mission_budget_zion: u64,
    pub hiran_endpoint: Option<String>,
    pub hiran_enabled: bool,
    pub dao_api_url: String,
    pub dao_api_key: String,
    pub dao_proposer: String,
    pub dao_proposer_balance: u64,
    pub dao_snapshot_block: u64,
}

impl Default for IssobellaConfig {
    fn default() -> Self {
        Self {
            name: "zion-issobella".to_string(),
            bind: "127.0.0.1".to_string(),
            port: 8097,
            db_path: "./issobella.db".to_string(),
            l1_rpc_url: "http://127.0.0.1:9445/jsonrpc".to_string(),
            scan_interval_secs: 60,
            api_key: std::env::var("ISSOBELLA_API_KEY").unwrap_or_default(),
            issobella_fund_address: DEFAULT_ISSOBELLA_FUND_ADDRESS.to_string(),
            min_mission_budget_zion: 10_000,
            max_mission_budget_zion: 100_000_000,
            hiran_endpoint: Some("http://localhost:8002".to_string()),
            hiran_enabled: false,
            dao_api_url: std::env::var("ZION_DAO_API_ADDR")
                .unwrap_or_else(|_| "http://127.0.0.1:8456".to_string()),
            dao_api_key: std::env::var("ZION_DAO_API_KEY").unwrap_or_default(),
            dao_proposer: std::env::var("ZION_DAO_PROPOSER").unwrap_or_default(),
            dao_proposer_balance: std::env::var("ZION_DAO_PROPOSER_BALANCE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0),
            dao_snapshot_block: std::env::var("ZION_DAO_SNAPSHOT_BLOCK")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0),
        }
    }
}

impl IssobellaConfig {
    pub fn load(path: Option<&str>) -> Self {
        let mut cfg = Self::default();

        if let Ok(port) = std::env::var("ISSOBELLA_PORT") {
            cfg.port = port.parse().unwrap_or(cfg.port);
        }
        if let Ok(bind) = std::env::var("ISSOBELLA_BIND") {
            cfg.bind = bind;
        }
        if let Ok(db) = std::env::var("ISSOBELLA_DB") {
            cfg.db_path = db;
        }
        if let Ok(rpc) = std::env::var("ISSOBELLA_L1_RPC") {
            cfg.l1_rpc_url = rpc;
        }
        if let Ok(key) = std::env::var("ISSOBELLA_API_KEY") {
            cfg.api_key = key;
        }
        if let Ok(addr) = std::env::var("ISSOBELLA_FUND_ADDRESS") {
            cfg.issobella_fund_address = addr;
        }
        if let Ok(url) = std::env::var("ISSOBELLA_HIRAN_URL") {
            cfg.hiran_endpoint = Some(url);
        }
        if let Ok(enabled) = std::env::var("ISSOBELLA_HIRAN_ENABLED") {
            cfg.hiran_enabled = enabled.eq_ignore_ascii_case("true");
        }
        if let Ok(url) = std::env::var("ZION_DAO_API_ADDR") {
            cfg.dao_api_url = url;
        }
        if let Ok(key) = std::env::var("ZION_DAO_API_KEY") {
            cfg.dao_api_key = key;
        }
        if let Ok(v) = std::env::var("ZION_DAO_PROPOSER") {
            cfg.dao_proposer = v;
        }
        if let Ok(v) = std::env::var("ZION_DAO_PROPOSER_BALANCE") {
            if let Ok(n) = v.parse() {
                cfg.dao_proposer_balance = n;
            }
        }
        if let Ok(v) = std::env::var("ZION_DAO_SNAPSHOT_BLOCK") {
            if let Ok(n) = v.parse() {
                cfg.dao_snapshot_block = n;
            }
        }

        if let Some(p) = path {
            if let Ok(text) = std::fs::read_to_string(p) {
                if let Ok(loaded) = toml::from_str::<IssobellaConfig>(&text) {
                    cfg = loaded;
                }
            }
        }

        cfg
    }
}
