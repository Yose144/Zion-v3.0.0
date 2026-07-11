//! Native FFI wrappers for C hasher implementations.
//!
//! When the `native-hashers` feature is enabled, these wrappers call into
//! the C implementations in `csrc/`.  When the feature is disabled, the
//! pure-Rust implementations in `external_hashers.rs` are used instead.
//!
//! The C sources are copied from `V3/L1/native-ffi/csrc/` and provide
//! high-performance CPU implementations of:
//!   - Blake3 (ALPH, DCR)
//!   - kHeavyHash (KAS)
//!   - Autolykos v2 (ERG)
//!   - KawPow (RVN, CLORE)
//!   - Ethash/EtcHash (ETC)

use std::ffi::c_char;

// ── Blake3 (ALPH, DCR) ───────────────────────────────────────────────

unsafe extern "C" {
    pub fn blake3_hash(input: *const u8, input_len: usize, output: *mut u8);
    pub fn blake3_mine(header: *const u8, header_len: usize, nonce: u64, output: *mut u8);
    pub fn blake3_verify(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        target: *const u8,
    ) -> i32;
    pub fn blake3_benchmark(iterations: i32) -> f64;
    pub fn blake3_version() -> *const c_char;
}

/// Compute Blake3 of `input` using the C implementation.
pub fn hash_blake3_native(input: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    // SAFETY: slice ptr is non-null and valid for input.len() bytes;
    // out is fresh stack memory, non-aliasing.
    unsafe {
        blake3_hash(input.as_ptr(), input.len(), out.as_mut_ptr());
    }
    out
}

/// Mining variant: hash `(header || nonce_le)` using the C implementation.
pub fn mine_blake3_native(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        blake3_mine(header.as_ptr(), header.len(), nonce, out.as_mut_ptr());
    }
    out
}

// ── kHeavyHash (KAS) ─────────────────────────────────────────────────

unsafe extern "C" {
    pub fn kheavyhash_hash(input: *const u8, len: usize, output: *mut u8);
    pub fn kheavyhash_mine(header: *const u8, header_len: usize, nonce: u64, output: *mut u8);
    pub fn kheavyhash_verify(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        target: *const u8,
    ) -> i32;
    pub fn kheavyhash_benchmark(iterations: i32) -> f64;
    pub fn kheavyhash_version() -> *const c_char;
}

/// Compute kHeavyHash of `input` using the C implementation.
pub fn hash_kheavyhash_native(input: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        kheavyhash_hash(input.as_ptr(), input.len(), out.as_mut_ptr());
    }
    out
}

/// Mining variant: hash `(header || nonce_le)` using the C implementation.
pub fn mine_kheavyhash_native(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        kheavyhash_mine(header.as_ptr(), header.len(), nonce, out.as_mut_ptr());
    }
    out
}

// ── Autolykos v2 (ERG) ───────────────────────────────────────────────

unsafe extern "C" {
    /// Returns the hit value as a u64 (first 8 LE bytes of the hash).
    pub fn autolykos_hash(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        height: u32,
        output: *mut u8,
    ) -> u64;
    pub fn autolykos_version() -> *const c_char;
}

/// Compute Autolykos v2 hash for ERG mining.
///
/// `header` is the block header (without nonce), `height` is the block
/// height (needed for the N parameter), and `nonce` is the 64-bit nonce.
/// Returns the 32-byte hash output.
pub fn hash_autolykos_native(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        autolykos_hash(header.as_ptr(), header.len(), nonce, height, out.as_mut_ptr());
    }
    out
}

// ── KawPow (RVN, CLORE) ──────────────────────────────────────────────

unsafe extern "C" {
    pub fn kawpow_hash(
        header: *const u8,
        nonce: u64,
        height: u32,
        epoch: u32,
        mix_out: *mut u8,
        hash_out: *mut u8,
    );
    pub fn kawpow_get_epoch(height: u32) -> u32;
    pub fn kawpow_version() -> *const c_char;
}

/// Compute KawPow hash for RVN/CLORE mining.
///
/// Returns (mix_hash, final_hash), each 32 bytes.
pub fn hash_kawpow_native(header: &[u8; 32], nonce: u64, height: u32) -> ([u8; 32], [u8; 32]) {
    let mut mix = [0u8; 32];
    let mut out = [0u8; 32];
    let epoch = unsafe { kawpow_get_epoch(height) };
    unsafe {
        kawpow_hash(
            header.as_ptr(),
            nonce,
            height,
            epoch,
            mix.as_mut_ptr(),
            out.as_mut_ptr(),
        );
    }
    (mix, out)
}

// ── Ethash/EtcHash (ETC) ─────────────────────────────────────────────

unsafe extern "C" {
    pub fn ethash_init();
    pub fn ethash_hash(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        height: u32,
        output: *mut u8,
    );
    pub fn ethash_verify(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        height: u32,
        target: *const u8,
    ) -> i32;
    pub fn ethash_get_epoch(block_number: u32) -> u32;
    pub fn ethash_cleanup();
    pub fn ethash_version() -> *const c_char;
}

/// Initialize the Ethash epoch cache.  Must be called once before any
/// `hash_ethash_native` calls.
pub fn init_ethash() {
    unsafe {
        ethash_init();
    }
}

/// Compute Ethash/EtcHash mix hash for ETC mining.
pub fn hash_ethash_native(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        ethash_hash(header.as_ptr(), header.len(), nonce, height, out.as_mut_ptr());
    }
    out
}
