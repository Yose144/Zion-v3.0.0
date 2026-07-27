//! `zion-cosmic-harmony` — canonical ZION proof-of-work layer.
//!
//! V31 simplifies the L1 PoW surface to a single canonical algorithm:
//! **Ekam Deeksha**. The previous three profile names collapse into this one
//! implementation. A `PocAlgorithm` stub is reserved for future governed
//! experiments.

pub mod algorithm;
pub mod profit;

pub use algorithm::{DynPowAlgorithm, EkamDeeksha, PocAlgorithm, PowAlgorithm};
pub use profit::{CoinProfile, Device, ExternalCoin, ProfitEntry, ProfitRouter};

/// Static canonical algorithm name used by pool, miner and status banners.
pub const CANONICAL_ALGORITHM: &str = algorithm::ekam_deeksha::ALGORITHM_NAME;
