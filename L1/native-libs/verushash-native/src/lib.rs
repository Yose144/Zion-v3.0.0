//! # verushash-native
//!
//! Rust wrapper around the VerusHash v2.2 C/C++ implementation from VerusCoin.
//!
//! Supports **x86_64** (SSE4 + AES-NI) and **aarch64** (NEON + crypto via sse2neon).
//!
//! ## Usage
//!
//! ```rust
//! use verushash_native::verus_hash_v2_2;
//!
//! let data = b"Hello VerusCoin!";
//! let hash = verus_hash_v2_2(data);
//! assert_eq!(hash.len(), 32);
//! ```
//!
//! ## Prerequisites
//!
//! Before building, run `download_sources.sh` to fetch the C sources from GitHub:
//!
//! ```bash
//! cd native-libs/verushash-native && bash download_sources.sh
//! ```

use std::sync::Once;

// ---------------------------------------------------------------------------
// FFI declarations — these are provided by csrc/ffi_wrapper.cpp
// ---------------------------------------------------------------------------
extern "C" {
    /// One-time initialization of Haraka constants and VerusHash lookup tables.
    fn verushash_init();

    /// Compute VerusHash v2.2 over `data[0..len]` and write 32-byte digest to `out`.
    fn verus_hash_v2_2_ffi(data: *const u8, len: u32, out: *mut u8);

    /// Return 1 if the CPU supports the optimized (AES-NI / ARM crypto) code path.
    fn verushash_cpu_optimized() -> i32;
}

// ---------------------------------------------------------------------------
// One-time init
// ---------------------------------------------------------------------------
static INIT: Once = Once::new();

/// Ensure the VerusHash library is initialized (safe to call many times).
fn ensure_init() {
    INIT.call_once(|| {
        unsafe {
            verushash_init();
        }
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Compute VerusHash v2.2 of arbitrary input data.
///
/// Returns a 32-byte (256-bit) hash.
///
/// This function is thread-safe. The underlying C++ code uses internal
/// thread-local state for the scratchpad, and the one-time initialization
/// is protected by `std::sync::Once`.
///
/// # Example
///
/// ```rust
/// let hash = verushash_native::verus_hash_v2_2(b"block header bytes");
/// println!("hash = {:?}", hash);
/// ```
pub fn verus_hash_v2_2(data: &[u8]) -> [u8; 32] {
    ensure_init();
    let mut out = [0u8; 32];
    unsafe {
        verus_hash_v2_2_ffi(data.as_ptr(), data.len() as u32, out.as_mut_ptr());
    }
    out
}

/// Check whether the current CPU supports the optimized VerusHash code path.
///
/// - **x86_64**: requires AES-NI + SSE4.1 + PCLMUL
/// - **aarch64**: requires ARMv8 Crypto Extensions (AES + PMULL)
///
/// If this returns `false`, the library will still work but will use the
/// portable (slower) implementation.
pub fn is_cpu_optimized() -> bool {
    ensure_init();
    unsafe { verushash_cpu_optimized() != 0 }
}

/// Convenience: hash and return the result as a hex string.
pub fn verus_hash_v2_2_hex(data: &[u8]) -> String {
    let hash = verus_hash_v2_2(data);
    let mut s = String::with_capacity(64);
    for byte in &hash {
        s.push_str(&format!("{:02x}", byte));
    }
    s
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_deterministic() {
        let a = verus_hash_v2_2(b"test data 12345");
        let b = verus_hash_v2_2(b"test data 12345");
        assert_eq!(a, b, "Same input must produce same hash");
    }

    #[test]
    fn test_hash_different_inputs() {
        let a = verus_hash_v2_2(b"input A");
        let b = verus_hash_v2_2(b"input B");
        assert_ne!(a, b, "Different inputs should (almost certainly) produce different hashes");
    }

    #[test]
    fn test_hash_length() {
        let h = verus_hash_v2_2(b"hello");
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn test_empty_input() {
        let h = verus_hash_v2_2(b"");
        // Should not panic, should return some 32-byte value
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn test_hex_output() {
        let hex = verus_hash_v2_2_hex(b"hello");
        assert_eq!(hex.len(), 64, "Hex string should be 64 chars");
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_cpu_optimized_does_not_panic() {
        // Just check it doesn't crash
        let _opt = is_cpu_optimized();
    }

    #[test]
    fn test_large_input() {
        let data = vec![0xABu8; 1_000_000];
        let h = verus_hash_v2_2(&data);
        assert_eq!(h.len(), 32);
    }
}
