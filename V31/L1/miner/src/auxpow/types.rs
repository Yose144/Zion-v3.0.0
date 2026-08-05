use serde::{Deserialize, Serialize};
use zion_cosmic_harmony::ExternalCoin;

/// Algorithm identifier for external hashing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ExternalAlgorithm {
    Blake3,
    KHeavyHash,
    Autolykos,
    KawPow,
    Ethash,
    RandomX,
    VerusHash,
    ZelHash,
    ProgPow,
    PearlHash,
    GhostRider,
    Eaglesong,
    Octopus,
    Equihash,
    NeoScrypt,
    KeryxHash,
}

impl ExternalAlgorithm {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Blake3 => "blake3",
            Self::KHeavyHash => "kheavyhash",
            Self::Autolykos => "autolykos",
            Self::KawPow => "kawpow",
            Self::Ethash => "ethash",
            Self::RandomX => "randomx",
            Self::VerusHash => "verushash",
            Self::ZelHash => "zelhash",
            Self::ProgPow => "progpow",
            Self::PearlHash => "pearlhash",
            Self::GhostRider => "ghostrider",
            Self::Eaglesong => "eaglesong",
            Self::Octopus => "octopus",
            Self::Equihash => "equihash",
            Self::NeoScrypt => "neoscrypt",
            Self::KeryxHash => "keryxhash",
        }
    }

    pub fn from_str_loose(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "blake3" => Some(Self::Blake3),
            "kheavyhash" | "kheavy" => Some(Self::KHeavyHash),
            "autolykos" => Some(Self::Autolykos),
            "kawpow" => Some(Self::KawPow),
            "ethash" | "etchash" => Some(Self::Ethash),
            "randomx" => Some(Self::RandomX),
            "verushash" | "verus" => Some(Self::VerusHash),
            "zelhash" | "zel" => Some(Self::ZelHash),
            "progpow" => Some(Self::ProgPow),
            "pearlhash" | "pearl" => Some(Self::PearlHash),
            "ghostrider" | "gr" => Some(Self::GhostRider),
            "eaglesong" => Some(Self::Eaglesong),
            "octopus" => Some(Self::Octopus),
            "equihash" => Some(Self::Equihash),
            "neoscrypt" => Some(Self::NeoScrypt),
            "keryxhash" | "keryx" => Some(Self::KeryxHash),
            _ => None,
        }
    }
}

/// A stratum job received from an external (AuxPoW) pool.
#[derive(Clone, Debug)]
pub struct Job {
    pub job_id: String,
    pub coin: ExternalCoin,
    pub header: Vec<u8>,
    pub target: [u8; 32],
    pub extranonce: Vec<u8>,
    pub extranonce2: String,
    pub ntime: String,
    /// Block height / block number from the external pool (for DAG/epoch derivation).
    pub height: u64,
}

impl Default for Job {
    fn default() -> Self {
        Self {
            job_id: String::new(),
            coin: ExternalCoin::Bitcoin,
            header: Vec::new(),
            target: [0u8; 32],
            extranonce: Vec::new(),
            extranonce2: "00".to_string(),
            ntime: "00000000".to_string(),
            height: 0,
        }
    }
}

/// A found share ready for submission.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Share {
    pub job_id: String,
    pub coin: ExternalCoin,
    pub nonce: u64,
    pub hash: [u8; 32],
    /// Mix hash for Ethash/KawPow/ProgPow-style shares (needed by upstream pool).
    pub mix_hash: Option<[u8; 32]>,
    /// Variable-length solution blob for Equihash/BeamHash/VerusHash-style shares.
    pub solution: Option<Vec<u8>>,
    pub extranonce2: String,
    pub ntime: String,
}

impl Share {
    pub fn nonce_hex(&self) -> String {
        format!("{:016x}", self.nonce)
    }

    /// Hex representation of the solution blob, if any.
    pub fn solution_hex(&self) -> Option<String> {
        self.solution.as_ref().map(hex::encode)
    }

    /// Hex representation of the mix hash, if any.
    pub fn mix_hash_hex(&self) -> Option<String> {
        self.mix_hash.map(|m| hex::encode_upper(m).to_lowercase())
    }
}

// ── Pool preference ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PoolPreference {
    NiceHash,
    HeroMiners,
    ZPool,
    Default,
}

impl PoolPreference {
    pub fn from_str_loose(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "nicehash" | "nh" => Self::NiceHash,
            "herominers" | "hm" => Self::HeroMiners,
            "zpool" => Self::ZPool,
            _ => Self::Default,
        }
    }
}

// ── Job package (pool-side multiplexing) ─────────────────────────────

/// A job package prepared by the pool-side multiplexer for ZION miners.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobPackage {
    pub external_coin: ExternalCoin,
    pub external_job_id: String,
    pub algorithm: String,
    pub header_bytes: Vec<u8>,
    pub target_bytes: [u8; 32],
    #[serde(default)]
    pub share_target_bytes: [u8; 32],
    pub timestamp: u64,
    pub block_number: Option<u64>,
    pub extranonce1: Vec<u8>,
    pub start_nonce: u64,
    pub nonce_count: u64,
    #[serde(default)]
    pub seed_hash: Option<Vec<u8>>,
}

// ── Share forward result ─────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShareForwardResult {
    BelowTarget,
    Accepted,
    Rejected(String),
    Unknown,
    NotConnected,
}

// ── Split config ─────────────────────────────────────────────────────

/// Simple revenue split between ZION and external coins.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SplitConfig {
    pub zion_weight: u32,
    pub external_weight: u32,
}

impl Default for SplitConfig {
    fn default() -> Self {
        Self {
            zion_weight: 75,
            external_weight: 25,
        }
    }
}

// ── AuxPoW config ────────────────────────────────────────────────────

/// Top-level configuration for the AuxPow subsystem.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuxPowConfig {
    pub enabled: bool,
    pub force_coin: Option<ExternalCoin>,
    pub allocation_pct: f64,
    pub pool_preference: PoolPreference,
    pub region: String,
    pub check_interval_secs: u64,
    pub hysteresis_pct: f64,
    pub payout_wallet: String,
    pub worker_name: String,
    pub circuit_breaker_threshold: u32,
    pub circuit_breaker_reset_secs: u64,
}

pub const DEFAULT_BTC_WALLET: &str = "bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh";

impl Default for AuxPowConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            force_coin: None,
            allocation_pct: 0.25,
            pool_preference: PoolPreference::Default,
            region: "eu".to_string(),
            check_interval_secs: 300,
            hysteresis_pct: 10.0,
            payout_wallet: DEFAULT_BTC_WALLET.to_string(),
            worker_name: "zion_auxpow".to_string(),
            circuit_breaker_threshold: 10,
            circuit_breaker_reset_secs: 60,
        }
    }
}

impl AuxPowConfig {
    pub fn from_env() -> Self {
        let mut cfg = Self::default();
        if let Ok(v) = std::env::var("ZION_AUXPOW_ENABLED") {
            cfg.enabled = v.trim().eq_ignore_ascii_case("1")
                || v.trim().eq_ignore_ascii_case("true")
                || v.trim().eq_ignore_ascii_case("yes");
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_ALLOCATION") {
            if let Ok(pct) = v.trim().parse::<f64>() {
                cfg.allocation_pct = pct.clamp(0.0, 1.0);
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_POOL_PREFERENCE") {
            cfg.pool_preference = PoolPreference::from_str_loose(&v);
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_REGION") {
            cfg.region = v;
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_CHECK_INTERVAL") {
            if let Ok(secs) = v.trim().parse::<u64>() {
                cfg.check_interval_secs = secs;
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_HYSTERESIS_PCT") {
            if let Ok(pct) = v.trim().parse::<f64>() {
                cfg.hysteresis_pct = pct;
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_WALLET") {
            cfg.payout_wallet = v;
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_WORKER_NAME") {
            cfg.worker_name = v;
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_CB_THRESHOLD") {
            if let Ok(t) = v.trim().parse::<u32>() {
                cfg.circuit_breaker_threshold = t;
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_CB_RESET_SECS") {
            if let Ok(s) = v.trim().parse::<u64>() {
                cfg.circuit_breaker_reset_secs = s;
            }
        }
        cfg
    }
}

// ── AuxPoW stats ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuxPowStats {
    pub enabled: bool,
    pub current_coin: Option<String>,
    pub current_pool: Option<String>,
    pub current_algorithm: Option<String>,
    pub shares_submitted: u64,
    pub shares_accepted: u64,
    pub shares_rejected: u64,
    pub revenue_usd: f64,
    pub consecutive_failures: u32,
    pub circuit_open: bool,
    pub uptime_secs: u64,
    pub last_switch_ts: Option<String>,
    pub coin_switches: u64,
}
