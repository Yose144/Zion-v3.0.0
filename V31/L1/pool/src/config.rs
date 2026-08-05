use std::time::Duration;

use zion_l1_types::{Address, ChainId};

use crate::v3_pplns::FeeConfig;

#[derive(Clone, Copy, Debug)]
pub struct RateLimitConfig {
    pub max_reconnects_per_minute: u32,
    pub window: Duration,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_reconnects_per_minute: 20,
            window: Duration::from_secs(60),
        }
    }
}

#[derive(Clone, Debug)]
pub struct PoolConfig {
    pub port: u16,
    /// Deprecated: kept for config compatibility. Use `fee_config` for protocol split.
    pub pool_fee_bps: u16,
    /// PPLNS window measured in total difficulty (work units), not raw share count.
    pub pplns_window_size: usize,
    /// Minimum accumulated miner payout before a payout is generated, in flowers.
    pub min_payout_flowers: u64,
    pub pplns_window_blocks: u64,
    pub zion_target: [u8; 32],
    pub auxpow_target: [u8; 32],
    pub pool_address: Address,
    pub worker: String,
    pub password: String,
    /// Optional Zion L1 RPC URL where solved blocks are submitted.
    pub l1_rpc_url: Option<String>,
    /// Optional path for PPLNS state persistence.
    pub state_path: Option<String>,
    pub reconnect_rate_limit: RateLimitConfig,
    /// Protocol fee split (humanitarian / issobella / pool) and destination addresses.
    pub fee_config: FeeConfig,
    /// Optional API key for read-only pool HTTP API.
    pub api_key: Option<String>,
    /// Optional admin key for privileged pool HTTP API endpoints.
    pub admin_key: Option<String>,
    /// Humanitarian address passed to `getTemplate` so the coinbase is split on-chain.
    pub humanitarian_address: String,
    /// Issobella address passed to `getTemplate` so the coinbase is split on-chain.
    pub issobella_address: String,
    /// Hex-encoded 32-byte Ed25519 signing key for the pool wallet.
    pub pool_wallet_key: Option<String>,
    /// Seconds between payout sweep attempts.
    pub payout_interval_s: u64,
    /// Per-payout transaction fee in flowers.
    pub payout_tx_fee_flowers: u64,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            port: 8444,
            pool_fee_bps: 100,
            pplns_window_size: 500_000,
            min_payout_flowers: zion_core::MIN_PAYOUT_AMOUNT,
            pplns_window_blocks: 100,
            zion_target: [0xFF; 32],
            auxpow_target: [0xFF; 32],
            pool_address: Address::new(ChainId::ZionL1, vec![0u8; 20], "zion1pool").unwrap(),
            worker: String::new(),
            password: String::new(),
            l1_rpc_url: None,
            state_path: None,
            reconnect_rate_limit: RateLimitConfig::default(),
            fee_config: FeeConfig::default(),
            api_key: None,
            admin_key: None,
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_wallet_key: None,
            payout_interval_s: 30,
            payout_tx_fee_flowers: zion_core::fee::MIN_TX_FEE.max(1),
        }
    }
}
