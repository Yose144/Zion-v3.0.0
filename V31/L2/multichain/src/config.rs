use serde::{Deserialize, Serialize};

use zion_l1_types::Address;

/// Top-level configuration for `zion-multichain`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MultichainConfig {
    #[serde(default)]
    pub server: ServerConfig,
    #[serde(default)]
    pub database: DatabaseConfig,
    #[serde(default = "default_l1_rpc_url")]
    pub l1_rpc_url: String,
    #[serde(default)]
    pub adapters: Vec<AdapterConfig>,
    pub pool: Option<PoolConfigFile>,
    #[serde(default)]
    pub warp: Option<crate::warp::config::WarpConfig>,
}

impl Default for MultichainConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            database: DatabaseConfig::default(),
            l1_rpc_url: default_l1_rpc_url(),
            adapters: Vec::new(),
            pool: None,
            warp: None,
        }
    }
}

fn default_l1_rpc_url() -> String {
    "http://127.0.0.1:9443".to_string()
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ServerConfig {
    pub bind: String,
    pub port: u16,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub path: String,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: "multichain.db".to_string(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AdapterConfig {
    pub chain: String,
    pub rpc_url: String,
    pub enabled: bool,
}

/// On-disk pool configuration (mirrors `zion_pool::PoolConfig` with hex targets).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PoolConfigFile {
    pub enabled: bool,
    pub port: u16,
    pub pool_fee_bps: u16,
    pub pplns_window_shares: usize,
    pub pplns_window_blocks: u64,
    pub zion_target_hex: String,
    pub auxpow_target_hex: String,
    pub pool_address: Address,
    pub worker: String,
    pub password: String,
    #[serde(default)]
    pub l1_rpc_url: Option<String>,
    #[serde(default)]
    pub state_path: Option<String>,
}

impl Default for PoolConfigFile {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 8444,
            pool_fee_bps: 100,
            pplns_window_shares: 10000,
            pplns_window_blocks: 100,
            zion_target_hex: "ff".repeat(32),
            auxpow_target_hex: "ff".repeat(32),
            pool_address: Address::new(zion_l1_types::ChainId::ZionL1, vec![0u8; 20], "zion1pool")
                .unwrap(),
            worker: String::new(),
            password: String::new(),
            l1_rpc_url: None,
            state_path: None,
        }
    }
}

impl PoolConfigFile {
    /// Convert to the runtime `zion_pool::PoolConfig`.
    pub fn to_pool_config(&self) -> zion_pool::PoolConfig {
        zion_pool::PoolConfig {
            port: self.port,
            pool_fee_bps: self.pool_fee_bps,
            pplns_window_shares: self.pplns_window_shares,
            pplns_window_blocks: self.pplns_window_blocks,
            zion_target: hex_to_32(&self.zion_target_hex),
            auxpow_target: hex_to_32(&self.auxpow_target_hex),
            pool_address: self.pool_address.clone(),
            worker: self.worker.clone(),
            password: self.password.clone(),
            l1_rpc_url: self.l1_rpc_url.clone(),
            state_path: self.state_path.clone(),
            reconnect_rate_limit: Default::default(),
        }
    }
}

fn hex_to_32(hex: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    if hex.len() == 64 {
        let _ = hex::decode_to_slice(hex, &mut out);
    }
    out
}
