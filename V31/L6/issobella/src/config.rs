//! Configuration for zion-issobella daemon.

use serde::{Deserialize, Serialize};

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
}

impl Default for IssobellaConfig {
    fn default() -> Self {
        Self {
            name: "zion-issobella".to_string(),
            bind: "0.0.0.0".to_string(),
            port: 8096,
            db_path: "./issobella.db".to_string(),
            l1_rpc_url: "http://127.0.0.1:9443/jsonrpc".to_string(),
            scan_interval_secs: 60,
            api_key: std::env::var("ISSOBELLA_API_KEY").unwrap_or_default(),
            issobella_fund_address: "zion1issobella000000000000000000000000".to_string(),
            min_mission_budget_zion: 10_000,
            max_mission_budget_zion: 100_000_000,
            hiran_endpoint: Some("http://localhost:8002".to_string()),
            hiran_enabled: false,
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
        if let Ok(url) = std::env::var("ISSOBELLA_HIRAN_URL") {
            cfg.hiran_endpoint = Some(url);
        }
        if let Ok(enabled) = std::env::var("ISSOBELLA_HIRAN_ENABLED") {
            cfg.hiran_enabled = enabled.eq_ignore_ascii_case("true");
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
