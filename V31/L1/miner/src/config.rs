use zion_l1_types::Address;

/// Miner runtime configuration.
#[derive(Clone, Debug)]
pub struct MinerConfig {
    /// ZION address that receives mining rewards.
    pub reward_address: Address,
    /// Optional external stratum pool URL for AuxPoW shares.
    pub auxpow_pool: Option<String>,
    /// Worker name used on AuxPoW pools.
    pub worker: String,
    /// Password used on AuxPoW pools.
    pub password: String,
    /// Whether to enable AuxPoW merged mining.
    pub auxpow_enabled: bool,
    /// Normalized rig hashrate used for profit estimation.
    pub hashrate_per_unit: f64,
    /// Number of sequential nonces to try per ZION mining step.
    pub zion_nonce_batch: u64,
    /// Number of sequential nonces to try per AuxPoW share search.
    pub auxpow_nonce_batch: u64,
}

impl MinerConfig {
    pub fn new(reward_address: Address) -> Self {
        Self {
            reward_address,
            auxpow_pool: None,
            worker: "zion_worker".to_string(),
            password: "x".to_string(),
            auxpow_enabled: true,
            hashrate_per_unit: 1000.0,
            zion_nonce_batch: 10_000,
            auxpow_nonce_batch: 1_000_000,
        }
    }
}
