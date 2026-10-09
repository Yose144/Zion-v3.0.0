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
