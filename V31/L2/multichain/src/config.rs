use serde::{Deserialize, Serialize};

use zion_l1_types::Address;

/// Node reward service configuration.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NodeRewardsConfig {
    /// Address that accumulates the 1% node reward pool. Defaults to the
    /// canonical mainnet node reward wallet.
    #[serde(default = "default_node_reward_address")]
    pub reward_address: String,
    /// Block height at which the L1 coinbase starts minting the 1% slot.
    #[serde(default = "default_u64_max")]
    pub activation_height: u64,
    /// Epoch length in blocks. Payouts are computed and submitted each epoch.
    #[serde(default = "default_node_reward_epoch_blocks")]
    pub epoch_blocks: u64,
    /// Minimum blocks a node must be registered before it is eligible for
    /// payouts in the current epoch.
    #[serde(default = "default_node_reward_min_blocks")]
    pub min_blocks_registered: u64,
    /// Optional BIP39 mnemonic for the node reward pool signer. If not set,
    /// the service will use the `ZION_NODE_REWARD_MNEMONIC` env variable.
    #[serde(default)]
    pub signer_mnemonic: Option<String>,
}

impl Default for NodeRewardsConfig {
    fn default() -> Self {
        Self {
            reward_address: default_node_reward_address(),
            activation_height: u64::MAX,
            epoch_blocks: default_node_reward_epoch_blocks(),
            min_blocks_registered: default_node_reward_min_blocks(),
            signer_mnemonic: None,
        }
    }
}

fn default_node_reward_address() -> String {
    zion_core::v3_compat::MAINNET_CANONICAL_NODE_REWARD_WALLET.to_string()
}

fn default_u64_max() -> u64 {
    u64::MAX
}

fn default_node_reward_epoch_blocks() -> u64 {
    10_080 // ~1 week at 60s block time
}

fn default_node_reward_min_blocks() -> u64 {
    1_440 // ~1 day
}

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
    pub mnemonic: Option<String>,
    /// Optional BIP39 mnemonic for the custodial multichain wallet.
    /// Falls back to `ZION_WALLET_MNEMONIC` env var. Must be different from
    /// `mnemonic` / `WARP_MNEMONIC` in production.
    #[serde(default)]
    pub wallet_mnemonic: Option<String>,
    #[serde(default)]
    pub adapters: Vec<AdapterConfig>,
    pub pool: Option<PoolConfigFile>,
    #[serde(default)]
    pub warp: Option<crate::warp::config::WarpConfig>,
    #[serde(default)]
    pub solver: SolverConfig,
    #[serde(default)]
    pub solvers: Vec<SolverEntry>,
    #[serde(default)]
    pub node_rewards: NodeRewardsConfig,
    #[serde(default)]
    pub reconciliation: ReconciliationConfig,
}

impl Default for MultichainConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            database: DatabaseConfig::default(),
            l1_rpc_url: default_l1_rpc_url(),
            mnemonic: None,
            wallet_mnemonic: None,
            adapters: Vec::new(),
            pool: None,
            warp: None,
            solver: SolverConfig::default(),
            solvers: Vec::new(),
            node_rewards: NodeRewardsConfig::default(),
            reconciliation: ReconciliationConfig::default(),
        }
    }
}

fn default_l1_rpc_url() -> String {
    "http://127.0.0.1:9445".to_string()
}

/// Reconciliation task configuration.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReconciliationConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Seconds between reconciliation passes.
    #[serde(default = "default_reconciliation_interval")]
    pub interval_seconds: u64,
    /// Absolute difference larger than this triggers an alert.
    #[serde(default = "default_reconciliation_threshold")]
    pub alert_threshold: String,
}

impl Default for ReconciliationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_seconds: 300,
            alert_threshold: "1000000".to_string(),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_reconciliation_interval() -> u64 {
    300
}

fn default_reconciliation_threshold() -> String {
    "1000000".to_string()
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ServerConfig {
    pub bind: String,
    pub port: u16,
    #[serde(default)]
    pub rate_limit: RateLimitConfig,
    #[serde(default)]
    pub auth: AuthConfig,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_second: f64,
    pub burst: u32,
    #[serde(default = "default_user_rate")]
    pub user_requests_per_second: f64,
    #[serde(default = "default_user_burst")]
    pub user_burst: u32,
}

fn default_user_rate() -> f64 {
    2.0
}

fn default_user_burst() -> u32 {
    20
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_second: 10.0,
            burst: 100,
            user_requests_per_second: default_user_rate(),
            user_burst: default_user_burst(),
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct AuthConfig {
    pub api_key: Option<String>,
}

/// Local solver node configuration.
///
/// When `enabled` is true, this warpd instance will advertise itself as a
/// solver and authenticate inbound `/v1/swap/solve` requests with `api_key`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SolverConfig {
    pub enabled: bool,
    #[serde(default = "default_solver_name")]
    pub name: String,
    #[serde(default)]
    pub fee_bps: u16,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub advertised_url: Option<String>,
}

impl Default for SolverConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            name: default_solver_name(),
            fee_bps: 0,
            api_key: None,
            advertised_url: None,
        }
    }
}

fn default_solver_name() -> String {
    "zion-solver".to_string()
}

/// Pre-configured off-chain solver known to the buyer node.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SolverEntry {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub reputation: u64,
    #[serde(default)]
    pub api_key: Option<String>,
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
    #[serde(default = "default_pplns_window_size")]
    pub pplns_window_size: usize,
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
    #[serde(default)]
    pub min_payout_flowers: u64,
    #[serde(default)]
    pub humanitarian_address: String,
    #[serde(default)]
    pub issobella_address: String,
    #[serde(default)]
    pub pool_fee_address: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub admin_key: Option<String>,
    #[serde(default)]
    pub pool_wallet_key: Option<String>,
    #[serde(default = "default_payout_interval_s")]
    pub payout_interval_s: u64,
    #[serde(default = "default_payout_tx_fee_flowers")]
    pub payout_tx_fee_flowers: u64,
}

impl Default for PoolConfigFile {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 8444,
            pool_fee_bps: 100,
            pplns_window_size: default_pplns_window_size(),
            pplns_window_blocks: 100,
            zion_target_hex: "ff".repeat(32),
            auxpow_target_hex: "ff".repeat(32),
            pool_address: Address::new(zion_l1_types::ChainId::ZionL1, vec![0u8; 20], "zion1pool")
                .unwrap(),
            worker: String::new(),
            password: String::new(),
            l1_rpc_url: None,
            state_path: None,
            min_payout_flowers: zion_core::MIN_PAYOUT_AMOUNT,
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            api_key: None,
            admin_key: None,
            pool_wallet_key: None,
            payout_interval_s: default_payout_interval_s(),
            payout_tx_fee_flowers: default_payout_tx_fee_flowers(),
        }
    }
}

impl PoolConfigFile {
    /// Convert to the runtime `zion_pool::PoolConfig`.
    pub fn to_pool_config(&self) -> zion_pool::PoolConfig {
        zion_pool::PoolConfig {
            port: self.port,
            pool_fee_bps: self.pool_fee_bps,
            pplns_window_size: self.pplns_window_size,
            min_payout_flowers: self.min_payout_flowers,
            pplns_window_blocks: self.pplns_window_blocks,
            zion_target: hex_to_32(&self.zion_target_hex),
            auxpow_target: hex_to_32(&self.auxpow_target_hex),
            pool_address: self.pool_address.clone(),
            worker: self.worker.clone(),
            password: self.password.clone(),
            l1_rpc_url: self.l1_rpc_url.clone(),
            state_path: self.state_path.clone(),
            reconnect_rate_limit: Default::default(),
            fee_config: zion_pool::v3_pplns::FeeConfig {
                humanitarian_pct: 5,
                issobella_pct: 5,
                pool_fee_pct: u64::from(self.pool_fee_bps) / 100,
                humanitarian_wallet: self.humanitarian_address.clone(),
                issobella_wallet: self.issobella_address.clone(),
                pool_fee_wallet: self.pool_fee_address.clone(),
            },
            api_key: self.api_key.clone(),
            admin_key: self.admin_key.clone(),
            humanitarian_address: self.humanitarian_address.clone(),
            issobella_address: self.issobella_address.clone(),
            pool_wallet_key: self.pool_wallet_key.clone(),
            payout_interval_s: self.payout_interval_s,
            payout_tx_fee_flowers: self.payout_tx_fee_flowers,
        }
    }
}

fn default_pplns_window_size() -> usize {
    500_000
}

fn default_payout_interval_s() -> u64 {
    30
}

fn default_payout_tx_fee_flowers() -> u64 {
    zion_core::fee::MIN_TX_FEE.max(1)
}

fn hex_to_32(hex: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    if hex.len() == 64 {
        let _ = hex::decode_to_slice(hex, &mut out);
    }
    out
}
