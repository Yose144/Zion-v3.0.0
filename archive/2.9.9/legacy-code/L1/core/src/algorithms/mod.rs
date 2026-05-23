pub mod blake3_algo;
/// Mining algorithm implementations
///
/// ZION uses **Cosmic Harmony v3** as the single production PoW algorithm.
/// CHv3 is a 5-phase pipeline: Keccak→SHA3→GoldenMatrix→(Scratchpad)→CosmicFusion.
/// The canonical implementation lives in the `zion-cosmic-harmony-v3` crate.
///
/// Legacy algorithms (Blake3, RandomX, Yescrypt) are retained for:
///   - Block template compatibility (Algorithm enum serialization)
///   - VerusHash revenue mining (external pool, not consensus)
///   - Future multi-algo rotation (commented out in block.rs)
///
/// **CH v1 and v2 have been archived** — see `archive/legacy-algorithms/`.
pub mod cosmic_harmony;
pub mod randomx;
pub mod verushash;
pub mod yescrypt;

// Small convenience shim so blockchain code can call `algorithms::blake3::hash(...)`.
pub mod blake3 {
    pub fn hash(data: &[u8]) -> [u8; 32] {
        super::blake3_algo::blake3_hash(data)
    }

    pub fn hash_with_nonce(data: &[u8], nonce: u32) -> [u8; 32] {
        super::blake3_algo::blake3_hash_with_nonce(data, nonce)
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Algorithm {
    /// ZION native algorithm — Cosmic Harmony v3 (CHv3)
    /// 5-phase pipeline with memory-hard scratchpad (fork-gated)
    #[default]
    CosmicHarmony,
    /// Monero-style RandomX (CPU optimized) — used for revenue mining
    RandomX,
    /// Memory-hard Yescrypt
    Yescrypt,
    /// Simple Blake3 fallback
    Blake3,
}

impl Algorithm {
    /// Parse algorithm from string
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "cosmic" | "cosmic_harmony" | "cosmicharmony" | "cosmic-harmony"
            | "cosmic_harmony_v3" | "cosmicharmonyv3" | "cosmic-harmony-v3" | "chv3" | "ch3" => {
                Some(Self::CosmicHarmony)
            }
            "randomx" | "random-x" | "rx/0" | "rx0" => Some(Self::RandomX),
            "yescrypt" => Some(Self::Yescrypt),
            "blake3" => Some(Self::Blake3),
            _ => None,
        }
    }

    /// Get algorithm name
    pub fn name(&self) -> &'static str {
        match self {
            Self::CosmicHarmony => "cosmic_harmony_v3",
            Self::RandomX => "randomx",
            Self::Yescrypt => "yescrypt",
            Self::Blake3 => "blake3",
        }
    }

    /// Get expected hashrate (H/s) for CPU baseline
    pub fn baseline_hashrate(&self) -> u64 {
        match self {
            Self::CosmicHarmony => 500_000, // 500 kH/s (pre-scratchpad)
            Self::RandomX => 600,           // 600 H/s
            Self::Yescrypt => 1_000,        // 1 kH/s
            Self::Blake3 => 5_000_000,      // 5 MH/s
        }
    }

    /// Check if algorithm has known ASIC hardware
    pub fn has_known_asic(&self) -> bool {
        match self {
            Self::RandomX => true, // Antminer X5 (212 kH/s, ~$5-8K)
            _ => false,
        }
    }

    /// Get ASIC resistance level (0-100)
    pub fn asic_resistance_score(&self) -> u8 {
        match self {
            Self::CosmicHarmony => 90, // CHv3 with memory-hard scratchpad
            Self::RandomX => 20,       // ASIC exists (Antminer X5)
            Self::Yescrypt => 85,      // Memory-hard, no known ASIC
            Self::Blake3 => 10,        // Trivial to ASIC
        }
    }

    /// Is this algorithm quantum-resistant?
    pub fn is_quantum_resistant(&self) -> bool {
        // CHv3 memory-hard scratchpad provides partial quantum resistance
        matches!(self, Self::CosmicHarmony)
    }
}

impl std::fmt::Display for Algorithm {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}


