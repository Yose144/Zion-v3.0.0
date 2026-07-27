//! Future PoC / experimental algorithm superstructure.
//!
//! This module is intentionally a stub. New governed experiments (e.g. NPU
//! integration, ASIC-hard variants, green-energy proofs) will implement
//! `PowAlgorithm` here without touching the canonical `EkamDeeksha` path.

use zion_l1_types::Hash;

use super::PowAlgorithm;

pub const ALGORITHM_NAME: &str = "poc";

/// Placeholder for future experimental algorithms.
#[derive(Clone, Copy, Debug, Default)]
pub struct PocAlgorithm;

impl PocAlgorithm {
    pub fn new() -> Self {
        Self
    }
}

impl PowAlgorithm for PocAlgorithm {
    fn name(&self) -> &'static str {
        ALGORITHM_NAME
    }

    fn hash(&self, _header: &[u8], _nonce: u64) -> Hash {
        unimplemented!("PoC algorithm is not activated in Mainnet Alpha")
    }

    fn find_nonce(
        &self,
        _header: &[u8],
        _start: u64,
        _limit: u64,
        _target: &[u8; 32],
    ) -> Option<(u64, Hash)> {
        None
    }
}
