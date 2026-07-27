//! Proof-of-Work algorithms for ZION L1.
//!
//! V31 canonizes a single mainnet algorithm — **Ekam Deeksha**. The previous
//! three profile names (`deeksha_lite_v1`, `deeksha_chv3`, `deeksha_lite_fire`)
//! collapse into this one implementation. A `PocAlgorithm` stub is kept for
//! future governed experiments without touching the canonical code path.

pub mod ekam_deeksha;
pub mod poc;

pub use ekam_deeksha::EkamDeeksha;
pub use poc::PocAlgorithm;

use zion_l1_types::Hash;

/// Common interface for every ZION PoW algorithm.
///
/// Hashing is synchronous CPU work; callers that need concurrency should run
/// `find_nonce` on a dedicated thread pool (e.g. `tokio::task::spawn_blocking`).
pub trait PowAlgorithm: Send + Sync {
    /// Canonical algorithm name (used by pool/miner banners and status).
    fn name(&self) -> &'static str;

    /// Compute the PoW hash for `header` and `nonce`.
    ///
    /// `header` is treated as opaque bytes; callers serialize `BlockHeader`
    /// consistently (e.g. first 80 bytes + 8-byte LE nonce appended inside the
    /// function). Only the first 80 bytes of `header` are used.
    fn hash(&self, header: &[u8], nonce: u64) -> Hash;

    /// Return `true` if `hash(header, nonce)` meets the 32-byte `target`.
    fn verify(&self, header: &[u8], nonce: u64, target: &[u8; 32]) -> bool {
        let hash = self.hash(header, nonce);
        hash.0 <= *target
    }

    /// Brute-force search for a nonce in `[start, start + limit)`.
    ///
    /// Returns the first `(nonce, hash)` pair whose hash meets `target`, or
    /// `None` if the range is exhausted.
    fn find_nonce(
        &self,
        header: &[u8],
        start: u64,
        limit: u64,
        target: &[u8; 32],
    ) -> Option<(u64, Hash)>;
}

/// Default boxed alias used by consensus and miner.
pub type DynPowAlgorithm = std::sync::Arc<dyn PowAlgorithm>;
