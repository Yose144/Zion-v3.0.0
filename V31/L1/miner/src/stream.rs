//! Triple-stream mining statistics and identifiers.

use zion_cosmic_harmony::ExternalCoin;

/// Identifies one of the four concurrent mining streams.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub enum StreamId {
    Zion,
    GpuExternal,
    CpuExternal,
    /// Second GPU AuxPoW stream (Quad mode, Stream 4). Shares the card
    /// with Stream 1 and Stream 2 via the same duty-cycle time-slicing.
    GpuExternal2,
}

impl StreamId {
    pub fn as_str(&self) -> &'static str {
        match self {
            StreamId::Zion => "zion",
            StreamId::GpuExternal => "gpu-external",
            StreamId::CpuExternal => "cpu-external",
            StreamId::GpuExternal2 => "gpu-external-2",
        }
    }

    pub fn index(&self) -> u8 {
        match self {
            StreamId::Zion => 0,
            StreamId::GpuExternal => 1,
            StreamId::CpuExternal => 2,
            StreamId::GpuExternal2 => 3,
        }
    }

    /// Both GPU external slots — they share the same device class and
    /// each keeps its own backend + nonce state.
    pub fn is_gpu_external(&self) -> bool {
        matches!(self, StreamId::GpuExternal | StreamId::GpuExternal2)
    }
}

/// Pearl PoUW counts completed attempts/s, not hashes. One attempt
/// (matrix-gen + merkle + ~2.1 GMAC matmul scan) matches ~6.9 GH of
/// SRBMiner pearlhash throughput — calibrated from eased-share hit rates
/// (SRB ~1.5 hits/s @48.4 TH/s vs our ~1/4700-attempt hit), ±20%.
/// Convert for display so rates are directly comparable with SRBMiner.
pub const PEARL_GH_PER_ATTEMPT: f64 = 6.9;

/// Raw `hashrate` tracked by a stream is in native units; pearl's native
/// unit is attempts/s → multiply into SRB-equivalent H/s for display.
pub fn display_hps(coin: &str, hps: f64) -> f64 {
    if coin.eq_ignore_ascii_case("prl") || coin.eq_ignore_ascii_case("pearlhash") {
        hps * PEARL_GH_PER_ATTEMPT * 1e9
    } else {
        hps
    }
}

/// Mutable statistics for a single stream.
#[derive(Clone, Debug)]
pub struct StreamStats {
    pub stream: StreamId,
    pub coin: Option<ExternalCoin>,
    pub algorithm: Option<String>,
    pub accepted: u64,
    pub rejected: u64,
    pub shares_found: u64,
    pub hashrate: f64,
    pub active: bool,
}

impl StreamStats {
    pub fn new(stream: StreamId) -> Self {
        Self {
            stream,
            coin: None,
            algorithm: None,
            accepted: 0,
            rejected: 0,
            shares_found: 0,
            hashrate: 0.0,
            active: false,
        }
    }
}
