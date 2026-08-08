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
    /// Populated from `ZION_POOL_ADDR` if not set explicitly.
    pub pool_url: Option<String>,
    /// Optional external stratum pool URL for AuxPoW shares.
    pub auxpow_pool: Option<String>,
    /// Optional Stream 2 (GPU AuxPoW) stratum URL, from `ZION_STREAM2_URL`.
    pub stream2_url: Option<String>,
    /// Optional Stream 3 (CPU AuxPoW) stratum URL, from `ZION_STREAM3_URL`.
    pub stream3_url: Option<String>,
    /// GPU backend selection: "opencl", "cuda", "metal", "cpu" or "auto".
    /// Read from `ZION_GPU_BACKEND`, default "cpu".
    pub gpu_backend: String,
    /// Number of CPU mining threads. Read from `ZION_MINER_THREADS`,
    /// defaults to the number of logical CPUs.
    pub miner_threads: usize,
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
    /// Force Stream 2 (GPU) to this external coin, ignoring profit estimates.
    /// Parsed from `ZION_STREAM2_FORCE_COIN`.
    pub stream2_force_coin: Option<ExternalCoin>,
    /// Force Stream 3 (CPU) to this external coin, ignoring profit estimates.
    /// Parsed from `ZION_STREAM3_FORCE_COIN`.
    pub stream3_force_coin: Option<ExternalCoin>,
    /// How long to wait (ms) before retrying a failed AuxPoW operation.
    pub auxpow_retry_ms: u64,
    /// Enable autonomous profit switching for Stream 2/3.
    pub autonomous: bool,
    /// Re-evaluate profit estimates every N seconds (default 300 = 5 min).
    pub profit_interval_sec: u64,
    /// Hysteresis percentage for profit switching (default 15%).
    pub profit_hysteresis_pct: f64,
}

impl MinerConfig {
    pub fn new(reward_address: Address) -> Self {
        Self {
            reward_address,
            node_rpc_url: std::env::var("ZION_NODE_RPC").ok(),
            pool_url: std::env::var("ZION_POOL_ADDR").ok(),
            auxpow_pool: std::env::var("ZION_AUXPOW_POOL").ok(),
            stream2_url: std::env::var("ZION_STREAM2_URL").ok(),
            stream3_url: std::env::var("ZION_STREAM3_URL").ok(),
            gpu_backend: std::env::var("ZION_GPU_BACKEND").unwrap_or_else(|_| "cpu".to_string()),
            miner_threads: std::env::var("ZION_MINER_THREADS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(|| num_cpus::get().max(1)),
            worker: std::env::var("ZION_WORKER").unwrap_or_else(|_| "zion_worker".to_string()),
            password: std::env::var("ZION_PASSWORD").unwrap_or_else(|_| "x".to_string()),
            auxpow_enabled: true,
            hashrate_per_unit: 1000.0,
            zion_nonce_batch: 10_000,
            auxpow_nonce_batch: 1_000_000,
            stream1_enabled: std::env::var("ZION_STREAM1_ENABLED")
                .map(|v| v != "0" && !v.eq_ignore_ascii_case("false"))
                .unwrap_or(true),
            stream2_enabled: std::env::var("ZION_STREAM2_ENABLED")
                .map(|v| v != "0" && !v.eq_ignore_ascii_case("false"))
                .unwrap_or(true),
            stream3_enabled: std::env::var("ZION_STREAM3_ENABLED")
                .map(|v| v != "0" && !v.eq_ignore_ascii_case("false"))
                .unwrap_or(true),
            stream2_batch: 1_048_576, // 1M nonces per batch for ProgPoW GPU mining
            stream3_batch: 1_000_000,
            stream2_force_coin: std::env::var("ZION_STREAM2_FORCE_COIN")
                .ok()
                .and_then(|s| s.trim().to_uppercase().parse().ok()),
            stream3_force_coin: std::env::var("ZION_STREAM3_FORCE_COIN")
                .ok()
                .and_then(|s| s.trim().to_uppercase().parse().ok()),
            auxpow_retry_ms: 5000,
            autonomous: std::env::var("ZION_AUTONOMOUS")
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
            profit_interval_sec: std::env::var("ZION_PROFIT_INTERVAL")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(300),
            profit_hysteresis_pct: std::env::var("ZION_PROFIT_HYSTERESIS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(15.0),
        }
    }

    /// Return true if any AuxPoW stream is enabled.
    pub fn any_auxpow_enabled(&self) -> bool {
        self.auxpow_enabled && (self.stream2_enabled || self.stream3_enabled)
    }
}
