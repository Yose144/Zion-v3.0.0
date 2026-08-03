//! `zion-cosmic-harmony` — canonical ZION proof-of-work layer.
//!
//! V31 simplifies the L1 PoW surface to a single canonical algorithm:
//! **Ekam Deeksha**. The previous three profile names collapse into this one
//! implementation. A `PocAlgorithm` stub is reserved for future governed
//! experiments.

pub mod algorithm;
pub mod algorithms_npu;
pub mod algorithms_opt;
pub mod deeksha;
pub mod deeksha_lite;
pub mod deeksha_lite_fire;
pub mod hic;
pub mod hugepages;
pub mod ncl_integration;
pub mod profit;
pub mod revenue;
pub mod revenue_journal;
pub mod scratchpad_ekam;
pub mod sha3_fast;
pub mod stream_layers;
pub mod stream_profit;

pub use algorithm::{DynPowAlgorithm, EkamDeeksha, PocAlgorithm, PowAlgorithm};
pub use profit::{CoinProfile, Device, ExternalCoin, ProfitEntry, ProfitRouter};

/// Static canonical algorithm name used by pool, miner and status banners.
pub const CANONICAL_ALGORITHM: &str = algorithm::ekam_deeksha::ALGORITHM_NAME;
