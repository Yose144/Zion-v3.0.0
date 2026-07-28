//! Native AuxPoW hashing (placeholder).
//!
//! The `native-hashers` feature selects this module. It is currently a shim that
//! delegates to the pure-Rust stubs in `pure.rs` until real FFI/GPU kernels are
//! linked.

use zion_cosmic_harmony::ExternalCoin;

/// Native hash dispatch. Currently falls back to the pure-Rust implementation.
pub fn hash_for_coin(coin: ExternalCoin, header: &[u8], nonce: u64) -> [u8; 32] {
    crate::auxpow::pure::hash_for_coin(coin, header, nonce)
}
