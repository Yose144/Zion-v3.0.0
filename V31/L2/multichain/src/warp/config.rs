use serde::{Deserialize, Serialize};

/// WARP configuration loaded from TOML.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpConfig {
    pub node_id: String,
    pub listen_addr: String,
    pub listen_port: u16,
    pub database_path: String,

    pub quorum: usize,
    pub daily_limit_zion: u64,
    pub timelock_threshold_zion: u64,

    pub l1_rpc_url: String,
    pub l1_vault_address: String,

    /// Poll interval for chain watchers in seconds (default: 15).
    #[serde(default)]
    pub poll_interval_secs: Option<u64>,

    #[serde(default)]
    pub chains: Vec<ChainConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub name: String,
    pub family: String,
    pub enabled: bool,
    pub rpc_url: String,
    pub contract_address: Option<String>,
    pub finality_blocks: u64,
    /// If `enabled` is false, this explains why (e.g. "contract not deployed").
    /// Used by the `/chains` API and operator tooling.
    #[serde(default)]
    pub disabled_reason: Option<String>,
}

impl Default for ChainConfig {
    fn default() -> Self {
        Self {
            name: String::new(),
            family: "Evm".into(),
            enabled: false,
            rpc_url: String::new(),
            contract_address: None,
            finality_blocks: 12,
            disabled_reason: None,
        }
    }
}

impl Default for WarpConfig {
    fn default() -> Self {
        Self {
            node_id: "warp-node-1".into(),
            listen_addr: "0.0.0.0".into(),
            listen_port: 9333,
            database_path: "data/warp.db".into(),
            quorum: 3,
            daily_limit_zion: 10_000_000,
            timelock_threshold_zion: 1_000_000,
            l1_rpc_url: "http://127.0.0.1:9445".into(),
            l1_vault_address: "zion1warp_vault_address".into(),
            chains: vec![],
            poll_interval_secs: None,
        }
    }
}

impl WarpConfig {
    pub fn load_from_str(toml_str: &str) -> Result<Self, toml::de::Error> {
        toml::from_str(toml_str)
    }

    /// Convert ZION whole units to flowers (6 decimals).
    pub fn daily_limit_flowers(&self) -> u64 {
        self.daily_limit_zion * 1_000_000
    }

    pub fn timelock_threshold_flowers(&self) -> u64 {
        self.timelock_threshold_zion * 1_000_000
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = WarpConfig::default();
        assert_eq!(config.quorum, 3);
        assert_eq!(config.listen_port, 9333);
        assert_eq!(config.daily_limit_zion, 10_000_000);
    }

    #[test]
    fn test_daily_limit_flowers() {
        let config = WarpConfig::default();
        assert_eq!(config.daily_limit_flowers(), 10_000_000_000_000);
    }

    #[test]
    fn test_timelock_flowers() {
        let config = WarpConfig::default();
        assert_eq!(config.timelock_threshold_flowers(), 1_000_000_000_000);
    }

    #[test]
    fn test_load_from_toml() {
        let toml_str = r#"
            node_id = "my-node"
            listen_addr = "127.0.0.1"
            listen_port = 9444
            database_path = "test.db"
            quorum = 2
            daily_limit_zion = 5000000
            timelock_threshold_zion = 500000
            l1_rpc_url = "http://localhost:8443"
            l1_vault_address = "zion1vault"
        "#;
        let config = WarpConfig::load_from_str(toml_str).unwrap();
        assert_eq!(config.node_id, "my-node");
        assert_eq!(config.quorum, 2);
        assert_eq!(config.listen_port, 9444);
    }

    #[test]
    fn test_chain_config_in_toml() {
        let toml_str = r#"
            node_id = "n1"
            listen_addr = "0.0.0.0"
            listen_port = 9333
            database_path = "warp.db"
            quorum = 3
            daily_limit_zion = 10000000
            timelock_threshold_zion = 1000000
            l1_rpc_url = "http://localhost:8443"
            l1_vault_address = "zion1vault"

            [[chains]]
            name = "base"
            family = "evm"
            enabled = true
            rpc_url = "https://base-rpc.example.com"
            contract_address = "0xWZION"
            finality_blocks = 12

            [[chains]]
            name = "solana"
            family = "solana"
            enabled = true
            rpc_url = "https://api.mainnet-beta.solana.com"
            finality_blocks = 31
        "#;
        let config = WarpConfig::load_from_str(toml_str).unwrap();
        assert_eq!(config.chains.len(), 2);
        assert_eq!(config.chains[0].name, "base");
        assert_eq!(config.chains[1].name, "solana");
    }

    #[test]
    fn test_chain_disabled_reason_in_toml() {
        let toml_str = r#"
            node_id = "n1"
            listen_addr = "0.0.0.0"
            listen_port = 9333
            database_path = "warp.db"
            quorum = 3
            daily_limit_zion = 10000000
            timelock_threshold_zion = 1000000
            l1_rpc_url = "http://localhost:8443"
            l1_vault_address = "zion1vault"

            [[chains]]
            name = "aptos"
            family = "aptos"
            enabled = false
            disabled_reason = "BCS not implemented"
            rpc_url = "https://fullnode.mainnet.aptoslabs.com"
            finality_blocks = 3
        "#;
        let config = WarpConfig::load_from_str(toml_str).unwrap();
        assert_eq!(config.chains.len(), 1);
        assert_eq!(config.chains[0].enabled, false);
        assert_eq!(
            config.chains[0].disabled_reason,
            Some("BCS not implemented".to_string())
        );
    }
}
