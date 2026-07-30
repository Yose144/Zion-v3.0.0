use zion_cosmic_harmony::ExternalCoin;
use zion_l1_types::Address;

/// Miner runtime configuration.
///
/// Triple Stream model:
///   - Stream 1: ZION canonical mining (always primary, never disabled by default).
///   - Stream 2: external GPU AuxPoW (optional fallback revenue).
///   - Stream 3: external CPU AuxPoW (optional fallback revenue).
#[derive(Clone, Debug)]
pub struct MinerConfig {
    /// ZION address that receives mining rewards.
    pub reward_address: Address,
    /// Optional ZION L1 node RPC URL for solo mining (template fetch + block submit).
    ///
    /// When set, Stream 1 fetches `getBlockTemplate` from the node and submits
    /// solved blocks via `submitBlock`. When `None`, the miner builds blocks
    /// locally from the genesis header (useful for unit tests).
    pub node_rpc_url: Option<String>,
    /// Optional stratum pool URL for ZION share mining.
    ///
    /// When set, Stream 1 connects to the pool as a stratum v1 client
    /// (subscribe/authorize/notify/submit) instead of solo mining.
    /// Takes precedence over `node_rpc_url` when both are set.
    pub pool_url: Option<String>,
    /// Optional external stratum pool URL for AuxPoW shares.
    pub auxpow_pool: Option<String>,
    /// Worker name used on AuxPoW pools.
    pub worker: String,
    /// Password used on AuxPoW pools.
    pub password: String,
    /// Whether to enable AuxPoW merged mining (Stream 2/3).
    ///
    /// When `false`, the miner runs ZION-only — useful for testing, SMOS public
    /// builds, or when external pools are unreachable.
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
    /// Force Stream 3 (CPU) to this external coin, ignoring profit estimates.
    /// Parsed from `ZION_STREAM3_FORCE_COIN`.
    pub stream3_force_coin: Option<ExternalCoin>,
    /// How long to wait (ms) before retrying a failed AuxPoW operation.
    pub auxpow_retry_ms: u64,
}

impl MinerConfig {
    pub fn new(reward_address: Address) -> Self {
        Self {
            reward_address,
            node_rpc_url: None,
            pool_url: None,
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
            stream3_force_coin: std::env::var("ZION_STREAM3_FORCE_COIN")
                .ok()
                .and_then(|s| s.trim().to_uppercase().parse().ok()),
            auxpow_retry_ms: 5000,
        }
    }

    /// Return true if any AuxPoW stream is enabled.
    pub fn any_auxpow_enabled(&self) -> bool {
        self.auxpow_enabled && (self.stream2_enabled || self.stream3_enabled)
    }
}
