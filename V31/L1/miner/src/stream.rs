//! Triple-stream mining statistics and identifiers.

use zion_cosmic_harmony::ExternalCoin;

/// Identifies one of the three concurrent mining streams.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub enum StreamId {
    Zion,
    GpuExternal,
    CpuExternal,
}

impl StreamId {
    pub fn as_str(&self) -> &'static str {
        match self {
            StreamId::Zion => "zion",
            StreamId::GpuExternal => "gpu-external",
            StreamId::CpuExternal => "cpu-external",
        }
    }

    pub fn index(&self) -> u8 {
        match self {
            StreamId::Zion => 0,
            StreamId::GpuExternal => 1,
            StreamId::CpuExternal => 2,
        }
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
