use serde::{Deserialize, Serialize};

/// Top-level configuration for `zion-multichain`.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct MultichainConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub adapters: Vec<AdapterConfig>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ServerConfig {
    pub bind: String,
    pub port: u16,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            bind: "127.0.0.1".to_string(),
            port: 8453,
        }
    }
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
