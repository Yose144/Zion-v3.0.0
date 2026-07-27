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
    /// Enable Stream 1 (ZION canonical mining).
    pub stream1_enabled: bool,
    /// Enable Stream 2 (GPU external AuxPoW).
    pub stream2_enabled: bool,
    /// Enable Stream 3 (CPU external AuxPoW).
    pub stream3_enabled: bool,
    /// Nonce batch for Stream 2 (GPU).
    pub stream2_batch: u64,
    /// Nonce batch for Stream 3 (CPU).
    pub stream3_batch: u64,
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
            stream1_enabled: true,
            stream2_enabled: true,
            stream3_enabled: true,
            stream2_batch: 100_000,
            stream3_batch: 1_000_000,
        }
    }
}
