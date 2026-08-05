//! Native AuxPoW hashing dispatch.
//!
//! The `native-hashers` feature selects this module. Coins with real FFI
//! implementations are wired here; everything else falls back to `pure.rs`.

use zion_cosmic_harmony::ExternalCoin;

/// Native hash dispatch. Uses real FFI for supported coins, otherwise falls
/// back to the pure-Rust stubs in `pure.rs`.
pub fn hash_for_coin(coin: ExternalCoin, header: &[u8], nonce: u64) -> [u8; 32] {
    match coin {
        #[cfg(feature = "native-verushash")]
        ExternalCoin::Verus => zion_native_ffi::verushash::hash(header, nonce),
        _ => crate::auxpow::pure::hash_for_coin(coin, header, nonce),
    }
}
