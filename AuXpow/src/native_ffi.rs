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
    pub fn blake3_alph(
        header_blob: *const u8,
        header_len: usize,
        extranonce1: *const u8,
        extranonce1_len: usize,
        nonce: u64,
        output: *mut u8,
    );
    pub fn blake3_alph_simple(
        header_blob: *const u8,
        header_len: usize,
        nonce: u64,
        output: *mut u8,
    );
    pub fn blake3_verify(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        target: *const u8,
    ) -> i32;
    pub fn blake3_alph_verify(
        header_blob: *const u8,
        header_len: usize,
        extranonce1: *const u8,
        extranonce1_len: usize,
        nonce: u64,
        target: *const u8,
    ) -> i32;
    pub fn blake3_selftest() -> i32;
    pub fn blake3_benchmark(iterations: i32) -> f64;
    pub fn blake3_version() -> *const c_char;
}

/// Compute Blake3 of `input` using the C implementation.
pub fn hash_blake3_native(input: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    // SAFETY: slice ptr is non-null and valid for input.len() bytes;
    // out is fresh stack memory, non-aliasing.
    // For empty input, ptr may be dangling but len=0 so no read occurs.
    unsafe {
        blake3_hash(input.as_ptr(), input.len(), out.as_mut_ptr());
    }
    out
}

/// DCR mining variant: hash `(header || nonce_le)` using the C implementation.
pub fn mine_blake3_native(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        blake3_mine(header.as_ptr(), header.len(), nonce, out.as_mut_ptr());
    }
    out
}

/// ALPH (Alephium) double-Blake3 mining hash:
/// `blake3(blake3(nonce_24B || header_blob))`.
///
/// The 24-byte nonce is: 8-byte big-endian candidate + 16 zero bytes.
/// candidate = base + nonce, where base is derived from extranonce1
/// (interpreted as a big-endian integer).
///
/// This matches the Rust reference `hash_blake3_alph` in `external_hashers.rs`.
pub fn mine_blake3_alph_native(
    header_blob: &[u8],
    extranonce1: &[u8],
    nonce: u64,
) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        blake3_alph(
            header_blob.as_ptr(),
            header_blob.len(),
            extranonce1.as_ptr(),
            extranonce1.len(),
            nonce,
            out.as_mut_ptr(),
        );
    }
    out
}

/// ALPH with a direct 64-bit candidate (no extranonce1 base).
/// Convenience wrapper: candidate = nonce.
pub fn mine_blake3_alph_simple_native(header_blob: &[u8], nonce: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        blake3_alph_simple(header_blob.as_ptr(), header_blob.len(), nonce, out.as_mut_ptr());
    }
    out
}

/// Run the BLAKE3 self-test (verifies blake3("") matches the known vector).
/// Returns true if the test passes.
pub fn blake3_native_selftest() -> bool {
    unsafe { blake3_selftest() != 0 }
}

// ── kHeavyHash (KAS) ─────────────────────────────────────────────────

unsafe extern "C" {
    pub fn kheavyhash_hash(input: *const u8, len: usize, output: *mut u8);
    pub fn kheavyhash_mine(
        pre_pow_hash: *const u8,
        pre_pow_hash_len: usize,
        timestamp: u64,
        nonce: u64,
        output: *mut u8,
    );
    pub fn kheavyhash_verify(
        pre_pow_hash: *const u8,
        pre_pow_hash_len: usize,
        timestamp: u64,
        nonce: u64,
        target: *const u8,
    ) -> i32;
    pub fn kheavyhash_benchmark(iterations: i32) -> f64;
    pub fn kheavyhash_version() -> *const c_char;
}

/// Compute kHeavyHash of `input` using the C implementation.
///
/// This treats `input` as the data absorbed by the ProofOfWorkHash cSHAKE
/// (no timestamp / nonce), then runs the matrix step and the HeavyHash cSHAKE.
pub fn hash_kheavyhash_native(input: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        kheavyhash_hash(input.as_ptr(), input.len(), out.as_mut_ptr());
    }
    out
}

/// Mining variant: compute the full kHeavyHash for a Kaspa block candidate
/// using the C implementation.
///
/// `pre_pow_hash` is the 32-byte pre-pow hash, `timestamp` is the block
/// timestamp (Unix seconds), and `nonce` is the 64-bit nonce.
pub fn mine_kheavyhash_native(pre_pow_hash: &[u8], timestamp: u64, nonce: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        kheavyhash_mine(
            pre_pow_hash.as_ptr(),
            pre_pow_hash.len(),
            timestamp,
            nonce,
            out.as_mut_ptr(),
        );
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
    /// Compute KawPow mix_hash and final_hash.
    ///
    /// `dag` is a pointer to the precomputed DAG buffer of 128-byte entries.
    /// `dag_size` is the number of 128-byte entries.
    pub fn kawpow_hash(
        header_hash: *const u8,
        nonce: u64,
        dag: *const u8,
        dag_size: u64,
        mix_out: *mut u8,
        hash_out: *mut u8,
    );
    /// Mine a single nonce: returns 1 if hash <= target, 0 otherwise.
    /// Writes the 32-byte final hash into `output`.
    pub fn kawpow_mine(
        header_hash: *const u8,
        nonce: u64,
        dag: *const u8,
        dag_size: u64,
        target: *const u8,
        output: *mut u8,
    ) -> i32;
    /// Verify a solution against expected mix and target.
    pub fn kawpow_verify(
        header_hash: *const u8,
        nonce: u64,
        dag: *const u8,
        dag_size: u64,
        expected_mix: *const u8,
        target: *const u8,
    ) -> i32;
    pub fn kawpow_get_epoch(height: u32) -> u32;
    pub fn kawpow_version() -> *const c_char;
}

/// Compute KawPow hash for RVN/CLORE mining using the C implementation.
///
/// `dag` is the precomputed DAG buffer (128-byte entries).
/// `dag_size` is the number of 128-byte entries.
///
/// Returns (mix_hash, final_hash), each 32 bytes.
pub fn hash_kawpow_native_with_dag(
    header: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size: u64,
) -> ([u8; 32], [u8; 32]) {
    let mut mix = [0u8; 32];
    let mut out = [0u8; 32];
    // SAFETY: header is 32 bytes, dag slice is valid for dag.len() bytes,
    // dag_size matches the entry count, mix/out are fresh stack buffers.
    unsafe {
        kawpow_hash(
            header.as_ptr(),
            nonce,
            dag.as_ptr(),
            dag_size,
            mix.as_mut_ptr(),
            out.as_mut_ptr(),
        );
    }
    (mix, out)
}

/// Mine a single KawPow nonce against a target using the C implementation.
///
/// Returns `Some(hash)` if the hash meets the target, `None` otherwise.
pub fn mine_kawpow_native(
    header: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size: u64,
    target: &[u8; 32],
) -> Option<[u8; 32]> {
    let mut out = [0u8; 32];
    // SAFETY: all pointers are valid for their stated sizes.
    let meets = unsafe {
        kawpow_mine(
            header.as_ptr(),
            nonce,
            dag.as_ptr(),
            dag_size,
            target.as_ptr(),
            out.as_mut_ptr(),
        )
    };
    if meets == 1 {
        Some(out)
    } else {
        None
    }
}

/// Compute KawPow hash for RVN/CLORE mining.
///
/// **Note:** This function requires a precomputed DAG. When called without
/// DAG management, it returns zeroed hashes. Use `hash_kawpow_native_with_dag`
/// for real mining with a DAG buffer.
///
/// Returns (mix_hash, final_hash), each 32 bytes.
pub fn hash_kawpow_native(header: &[u8; 32], nonce: u64, _height: u32) -> ([u8; 32], [u8; 32]) {
    // Without a DAG, we cannot compute a valid KawPow hash.
    // Callers must use hash_kawpow_native_with_dag() with a real DAG.
    // This stub maintains API compatibility for the no-DAG path.
    let _ = (header, nonce);
    ([0u8; 32], [0u8; 32])
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

    // Primary DAG-based API (real Ethash).
    /// Compute the full Ethash hash over a precomputed DAG.
    pub fn ethash_hash_dag(
        header_hash: *const u8,
        nonce: u64,
        dag: *const u8,
        dag_size_entries: u64,
        output: *mut u8,
    );
    /// Compute the full Ethash hash over a precomputed DAG and return 1 if it
    /// meets the target (hash <= target, big-endian), else 0.
    pub fn ethash_mine(
        header_hash: *const u8,
        nonce: u64,
        dag: *const u8,
        dag_size_entries: u64,
        target: *const u8,
        output: *mut u8,
    ) -> i32;
    /// Register a precomputed DAG for the legacy `ethash_hash`/`ethash_verify`
    /// path.  The DAG memory is owned by the caller and must remain valid until
    /// the next `ethash_set_dag` or `ethash_cleanup` call.
    pub fn ethash_set_dag(dag: *const u8, dag_size_entries: u64);
}

/// Initialize the Ethash epoch cache.  Must be called once before any
/// `hash_ethash_native` calls (only needed for the light-mode fallback; the
/// DAG-based `mine_ethash_native` / `hash_ethash_with_dag_native` do not
/// require it).
pub fn init_ethash() {
    unsafe {
        ethash_init();
    }
}

/// Register a precomputed DAG for use by the legacy `hash_ethash_native` path.
///
/// `dag` is the raw DAG buffer (128 bytes per entry), `dag_size_entries` is the
/// number of 128-byte entries.  The buffer is borrowed (not copied) and must
/// outlive subsequent `hash_ethash_native` calls.
pub fn set_ethash_dag(dag: &[u8], dag_size_entries: u64) {
    unsafe {
        ethash_set_dag(dag.as_ptr(), dag_size_entries);
    }
}

/// Compute Ethash/EtcHash mix hash for ETC mining (legacy path).
///
/// Uses the globally-registered DAG (see `set_ethash_dag`) when available,
/// otherwise falls back to a light cache evaluation that is NOT valid for real
/// mining.  For real mining use `hash_ethash_with_dag_native` / `mine_ethash_native`.
pub fn hash_ethash_native(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        ethash_hash(header.as_ptr(), header.len(), nonce, height, out.as_mut_ptr());
    }
    out
}

/// Compute the real Ethash hash over a precomputed DAG.
///
/// `header_hash` is the 32-byte block header hash, `dag` is the raw DAG buffer
/// (128 bytes per entry), and `dag_size_entries` is the number of 128-byte
/// entries.  Returns the 32-byte final hash.
pub fn hash_ethash_with_dag_native(
    header_hash: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size_entries: u64,
) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        ethash_hash_dag(
            header_hash.as_ptr(),
            nonce,
            dag.as_ptr(),
            dag_size_entries,
            out.as_mut_ptr(),
        );
    }
    out
}

/// Compute the real Ethash hash over a precomputed DAG and check it against the
/// target.  Returns `Some(hash)` if `hash <= target` (big-endian), else `None`.
pub fn mine_ethash_native(
    header_hash: &[u8; 32],
    nonce: u64,
    dag: &[u8],
    dag_size_entries: u64,
    target: &[u8; 32],
) -> Option<[u8; 32]> {
    let mut out = [0u8; 32];
    let met = unsafe {
        ethash_mine(
            header_hash.as_ptr(),
            nonce,
            dag.as_ptr(),
            dag_size_entries,
            target.as_ptr(),
            out.as_mut_ptr(),
        )
    };
    if met == 1 {
        Some(out)
    } else {
        None
    }
}
