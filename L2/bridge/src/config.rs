//! Bridge configuration — L1 RPC, EVM chains, validator keys, thresholds.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Top-level bridge configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeConfig {
    /// Bridge identity
    pub bridge: BridgeIdentity,

    /// ZION L1 connection
    pub l1: L1Config,

    /// EVM chain connections (can bridge to multiple chains)
    pub evm_chains: Vec<EvmChainConfig>,

    /// Validator / multisig settings
    pub validator: ValidatorConfig,

    /// Security settings
    pub security: SecurityConfig,

    /// Database settings
    pub database: DatabaseConfig,

    /// Monitoring
    pub metrics: MetricsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeIdentity {
    /// Human-readable bridge name
    pub name: String,

    /// Bridge version
    pub version: String,

    /// Network (testnet / mainnet)
    pub network: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct L1Config {
    /// ZION L1 RPC URL (e.g., "http://77.42.31.72:8444")
    pub rpc_url: String,

    /// Backup L1 RPC URL
    pub rpc_url_backup: Option<String>,

    /// Bridge lock address on L1 (ZION locked here → wZION minted)
    pub bridge_address: String,

    /// L1 finality requirement (blocks to wait before processing lock)
    pub finality_blocks: u64,

    /// Poll interval for new blocks (seconds)
    pub poll_interval_secs: u64,

    /// Last processed L1 block height (persisted in DB)
    pub start_block_height: Option<u64>,

    /// Optional Bearer token for L1 RPC write endpoints (ZION_RPC_TOKEN on L1 node).
    /// If set, it is sent as `Authorization: Bearer <token>` to /api/bridge/unlock.
    pub l1_rpc_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmChainConfig {
    /// Chain identifier (e.g., "base", "arbitrum", "bsc", "polygon")
    pub chain_id: String,

    /// Human-readable chain name
    pub name: String,

    /// EVM chain ID (8453 = Base, 42161 = Arbitrum, 56 = BSC, 137 = Polygon)
    pub evm_chain_id: u64,

    /// EVM RPC URL (WebSocket preferred for event listening)
    pub rpc_url: String,

    /// Backup RPC URL
    pub rpc_url_backup: Option<String>,

    /// Deployed wZION contract address
    pub wzion_address: String,

    /// Deployed ZIONBridge contract address
    pub bridge_contract_address: String,

    /// EVM finality blocks (varies by chain)
    pub finality_blocks: u64,

    /// Whether this chain is active
    pub enabled: bool,

    /// Gas price strategy: "legacy", "eip1559"
    pub gas_strategy: String,

    /// Max gas price (in gwei) — safety limit
    pub max_gas_gwei: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorConfig {
    /// This node's validator private key file (for signing EVM TX)
    pub private_key_file: PathBuf,

    /// This node's validator identifier (for L1 RPC requests)
    #[serde(default)]
    pub validator_id: String,

    /// Required confirmations (e.g., 3 out of 5)
    pub threshold: u8,

    /// Total validator count
    pub total_validators: u8,

    /// List of all validator EVM addresses (for verification)
    pub validator_addresses: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Maximum amount per single bridge operation (wZION, 18 decimals)
    pub max_single_amount: String,

    /// Daily throughput limit (wZION, 18 decimals)
    pub daily_limit: String,

    /// Minimum bridge amount (anti-dust)
    pub min_bridge_amount: String,

    /// Timelock threshold (amounts above this get 24h delay)
    pub timelock_threshold: String,

    /// Rate limit: max bridge operations per hour
    pub max_ops_per_hour: u32,

    /// Watchdog: alert if no L1 blocks for N seconds
    pub l1_block_timeout_secs: u64,

    /// Auto-pause bridge if anomaly detected
    pub auto_pause_on_anomaly: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// SQLite database path for bridge state
    pub path: PathBuf,

    /// Backup interval (seconds)
    pub backup_interval_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    /// Enable Prometheus metrics endpoint
    pub enabled: bool,

    /// Metrics HTTP port
    pub port: u16,

    /// Log level (trace, debug, info, warn, error)
    pub log_level: String,
}

impl BridgeConfig {
    /// Load configuration from a TOML file.
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: BridgeConfig = toml::from_str(&content)?;
        Ok(config)
    }

    /// Get active EVM chains.
    pub fn active_chains(&self) -> Vec<&EvmChainConfig> {
        self.evm_chains.iter().filter(|c| c.enabled).collect()
    }
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            bridge: BridgeIdentity {
                name: "ZION Bridge Relay".into(),
                version: "0.1.0".into(),
                network: "testnet".into(),
            },
            l1: L1Config {
                rpc_url: "http://127.0.0.1:8444".into(),
                rpc_url_backup: None,
                bridge_address: "zion1bridge000000000000000000000000000vault".into(),
                finality_blocks: 60,
                poll_interval_secs: 15,
                start_block_height: None,
                l1_rpc_token: None,
            },
            evm_chains: vec![],
            validator: ValidatorConfig {
                private_key_file: PathBuf::from("keys/validator.key"),
                validator_id: "validator-1".into(),
                threshold: 3,
                total_validators: 5,
                validator_addresses: vec![],
            },
            security: SecurityConfig {
                max_single_amount: "5000000000000000000000000".into(), // 5M wZION
                daily_limit: "10000000000000000000000000".into(),      // 10M wZION
                min_bridge_amount: "100000000000000000000".into(),     // 100 wZION
                timelock_threshold: "1000000000000000000000000".into(), // 1M wZION
                max_ops_per_hour: 100,
                l1_block_timeout_secs: 300,
                auto_pause_on_anomaly: true,
            },
            database: DatabaseConfig {
                path: PathBuf::from("data/bridge.db"),
                backup_interval_secs: 3600,
            },
            metrics: MetricsConfig {
                enabled: true,
                port: 9100,
                log_level: "info".into(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let cfg = BridgeConfig::default();
        assert_eq!(cfg.bridge.name, "ZION Bridge Relay");
        assert_eq!(cfg.bridge.network, "testnet");
        assert_eq!(cfg.l1.rpc_url, "http://127.0.0.1:8444");
        assert_eq!(
            cfg.l1.bridge_address,
            "zion1bridge000000000000000000000000000vault"
        );
        assert_eq!(cfg.l1.finality_blocks, 60);
        assert_eq!(cfg.l1.poll_interval_secs, 15);
        assert_eq!(cfg.validator.threshold, 3);
        assert_eq!(cfg.validator.total_validators, 5);
        assert!(cfg.evm_chains.is_empty());
        assert!(cfg.security.auto_pause_on_anomaly);
        assert_eq!(cfg.metrics.port, 9100);
    }

    #[test]
    fn test_active_chains_empty() {
        let cfg = BridgeConfig::default();
        assert_eq!(cfg.active_chains().len(), 0);
    }

    #[test]
    fn test_active_chains_filter() {
        let mut cfg = BridgeConfig::default();
        cfg.evm_chains = vec![
            EvmChainConfig {
                chain_id: "base".into(),
                name: "Base".into(),
                evm_chain_id: 8453,
                rpc_url: "ws://base.rpc".into(),
                rpc_url_backup: None,
                wzion_address: "0xWZION".into(),
                bridge_contract_address: "0xBRIDGE".into(),
                finality_blocks: 15,
                enabled: true,
                gas_strategy: "eip1559".into(),
                max_gas_gwei: 50,
            },
            EvmChainConfig {
                chain_id: "arbitrum".into(),
                name: "Arbitrum".into(),
                evm_chain_id: 42161,
                rpc_url: "ws://arb.rpc".into(),
                rpc_url_backup: None,
                wzion_address: "0xWZION_ARB".into(),
                bridge_contract_address: "0xBRIDGE_ARB".into(),
                finality_blocks: 12,
                enabled: false, // disabled
                gas_strategy: "eip1559".into(),
                max_gas_gwei: 30,
            },
        ];

        let active = cfg.active_chains();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].chain_id, "base");
    }

    #[test]
    fn test_config_load_from_toml() {
        let toml_str = r#"
[bridge]
name = "Test Bridge"
version = "0.1.0"
network = "testnet"

[l1]
rpc_url = "http://77.42.31.72:8444"
bridge_address = "zion1bridge000000000000000000000000000vault"
finality_blocks = 60
poll_interval_secs = 15

[[evm_chains]]
chain_id = "base"
name = "Base Sepolia"
evm_chain_id = 84532
rpc_url = "wss://base-sepolia.rpc"
wzion_address = "0xWZION_TEST"
bridge_contract_address = "0xBRIDGE_TEST"
finality_blocks = 15
enabled = true
gas_strategy = "eip1559"
max_gas_gwei = 50

[validator]
private_key_file = "keys/test.key"
threshold = 3
total_validators = 5
validator_addresses = ["0xAAA", "0xBBB", "0xCCC", "0xDDD", "0xEEE"]

[security]
max_single_amount = "5000000000000000000000000"
daily_limit = "10000000000000000000000000"
min_bridge_amount = "100000000000000000000"
timelock_threshold = "1000000000000000000000000"
max_ops_per_hour = 100
l1_block_timeout_secs = 300
auto_pause_on_anomaly = true

[database]
path = "data/bridge.db"
backup_interval_secs = 3600

[metrics]
enabled = true
port = 9100
log_level = "info"
"#;
        let config: BridgeConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.bridge.name, "Test Bridge");
        assert_eq!(config.l1.rpc_url, "http://77.42.31.72:8444");
        assert_eq!(config.evm_chains.len(), 1);
        assert_eq!(config.evm_chains[0].chain_id, "base");
        assert_eq!(config.evm_chains[0].evm_chain_id, 84532);
        assert_eq!(config.validator.threshold, 3);
        assert_eq!(config.validator.validator_addresses.len(), 5);
        assert!(config.security.auto_pause_on_anomaly);
    }

    #[test]
    fn test_security_limits_parsing() {
        let cfg = BridgeConfig::default();
        // Verify we can parse the string amounts
        let daily: u128 = cfg.security.daily_limit.parse().unwrap();
        let min: u128 = cfg.security.min_bridge_amount.parse().unwrap();
        let max_single: u128 = cfg.security.max_single_amount.parse().unwrap();

        assert!(daily > max_single, "Daily limit must exceed single max");
        assert!(max_single > min, "Max single must exceed minimum");
        assert!(min > 0, "Minimum must be positive");
    }
}
