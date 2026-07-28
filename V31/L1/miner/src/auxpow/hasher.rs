//! External algorithm hashing dispatcher.
//!
//! By default the runtime uses the pure-Rust stubs in `pure.rs`. Enabling the
//! `native-hashers` feature switches to `native.rs`, which is a placeholder for
//! real FFI/GPU kernels and currently delegates back to `pure.rs`.

use zion_cosmic_harmony::ExternalCoin;

/// Hash `header || nonce_le` with the algorithm used by `coin`.
pub fn hash_for_coin(coin: ExternalCoin, header: &[u8], nonce: u64) -> [u8; 32] {
    #[cfg(feature = "native-hashers")]
    {
        crate::auxpow::native::hash_for_coin(coin, header, nonce)
    }
    #[cfg(not(feature = "native-hashers"))]
    {
        crate::auxpow::pure::hash_for_coin(coin, header, nonce)
    }
}

/// Check whether `hash` meets the 32-byte `target` (little-endian).
pub fn meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash <= target
}
