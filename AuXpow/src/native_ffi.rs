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
pub fn mine_blake3_alph_native(header_blob: &[u8], extranonce1: &[u8], nonce: u64) -> [u8; 32] {
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
        blake3_alph_simple(
            header_blob.as_ptr(),
            header_blob.len(),
            nonce,
            out.as_mut_ptr(),
        );
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
    /// Convenience: compute Autolykos v2 hash by generating the table
    /// internally.  Returns the first 8 bytes of the hash as a LE u64.
    ///
    /// # Safety
    /// - `header` must be valid for `header_len` readable bytes.
    /// - `output` must be valid for 32 writable bytes, non-aliasing with header.
    pub fn autolykos_hash(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        height: u32,
        output: *mut u8,
    ) -> u64;

    /// Generate the Autolykos v2 precomputed table.
    ///
    /// `table` must point to `table_size * 8` bytes of writable memory.
    /// Each entry is a u64 derived from BLAKE2b-256(SHA256(header) || be64(i) || be32(height)).
    ///
    /// # Safety
    /// - `header` must be valid for `header_len` readable bytes.
    /// - `table` must be valid for `table_size * 8` writable bytes.
    pub fn autolykos_generate_table(
        header: *const u8,
        header_len: usize,
        height: u32,
        table: *mut u64,
        table_size: u64,
    );

    /// Mine a single nonce using a precomputed table.
    ///
    /// Returns 1 if the resulting hash is <= `target` (big-endian comparison),
    /// 0 otherwise.  The 32-byte hash is written to `output`.
    ///
    /// If `table` is null, the table is generated internally (slower).
    ///
    /// # Safety
    /// - `header` must be valid for `header_len` readable bytes.
    /// - `table` must either be null or point to `table_size * 8` readable bytes.
    /// - `target` must point to 32 readable bytes (or be null to skip target check).
    /// - `output` must be valid for 32 writable bytes, non-aliasing with header.
    pub fn autolykos_mine(
        header: *const u8,
        header_len: usize,
        nonce: u64,
        table: *const u64,
        table_size: u64,
        target: *const u8,
        output: *mut u8,
    ) -> i32;

    pub fn autolykos_version() -> *const c_char;
}

/// Compute Autolykos v2 hash for ERG mining.
///
/// `header` is the block header (without nonce), `height` is the block
/// height (needed for table generation), and `nonce` is the 64-bit nonce.
/// Returns the 32-byte hash output.
///
/// This convenience function generates the table internally on every call.
/// For production mining, precompute the table once with
/// [`generate_autolykos_table_native`] and use [`mine_autolykos_native`].
pub fn hash_autolykos_native(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        autolykos_hash(
            header.as_ptr(),
            header.len(),
            nonce,
            height,
            out.as_mut_ptr(),
        );
    }
    out
}

/// Generate the Autolykos v2 precomputed table on the host.
///
/// `table` must be pre-allocated with `table_size` entries (each 8 bytes).
/// The table is derived from `SHA256(header)` and `height`.
pub fn generate_autolykos_table_native(header: &[u8], height: u32, table: &mut [u64]) {
    unsafe {
        autolykos_generate_table(
            header.as_ptr(),
            header.len(),
            height,
            table.as_mut_ptr(),
            table.len() as u64,
        );
    }
}

/// Mine a single nonce using a precomputed table.
///
/// Returns `Some(hash)` if the hash meets the target (hash <= target in
/// big-endian comparison), or `None` if it does not.  In both cases the
/// 32-byte hash is written to the returned array.
///
/// If `table` is empty (length 0), the table is generated internally.
pub fn mine_autolykos_native(
    header: &[u8],
    nonce: u64,
    table: &[u64],
    target: &[u8; 32],
) -> ([u8; 32], bool) {
    let mut out = [0u8; 32];
    let table_ptr = if table.is_empty() {
        std::ptr::null()
    } else {
        table.as_ptr()
    };
    let meets = unsafe {
        autolykos_mine(
            header.as_ptr(),
            header.len(),
            nonce,
            table_ptr,
            table.len() as u64,
            target.as_ptr(),
            out.as_mut_ptr(),
        )
    };
    (out, meets != 0)
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

    /// Generate the full KawPow DAG for a given epoch.
    /// Returns a malloc'd buffer (caller must free via kawpow_free_dag).
    pub fn kawpow_generate_dag(
        epoch: u32,
        dag_size_entries: *mut u64,
        progress_cb: Option<unsafe extern "C" fn(u32)>,
    ) -> *mut u8;

    /// Free a DAG buffer generated by kawpow_generate_dag.
    pub fn kawpow_free_dag(dag: *mut u8);

    /// Generate only the light cache for a given epoch (for on-GPU DAG generation).
    /// Returns a malloc'd buffer (caller must free via kawpow_free_light_cache).
    pub fn kawpow_generate_light_cache(
        epoch: u32,
        cache_size_bytes: *mut u64,
        cache_items: *mut u64,
        dag_size_entries: *mut u64,
    ) -> *mut u8;

    /// Free a light cache buffer generated by kawpow_generate_light_cache.
    pub fn kawpow_free_light_cache(cache: *mut u8);
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

    /// Generate the full Ethash DAG for a given epoch.
    /// Returns a malloc'd buffer (caller must free via ethash_free_dag).
    /// progress_cb may be null.
    pub fn ethash_generate_dag(
        epoch: u32,
        dag_size_entries: *mut u64,
        progress_cb: Option<unsafe extern "C" fn(u32)>,
    ) -> *mut u8;

    /// Free a DAG buffer generated by ethash_generate_dag.
    pub fn ethash_free_dag(dag: *mut u8);

    /// Generate only the light cache for a given epoch (for on-GPU DAG generation).
    /// Returns a malloc'd buffer (caller must free via ethash_free_light_cache).
    pub fn ethash_generate_light_cache(
        epoch: u32,
        cache_size_bytes: *mut u64,
        cache_items: *mut u64,
        dag_size_entries: *mut u64,
    ) -> *mut u8;

    /// Free a light cache buffer generated by ethash_generate_light_cache.
    pub fn ethash_free_light_cache(cache: *mut u8);
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
        ethash_hash(
            header.as_ptr(),
            header.len(),
            nonce,
            height,
            out.as_mut_ptr(),
        );
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

// ── DAG generation wrappers ──────────────────────────────────────────

/// An owned Ethash DAG buffer generated by `generate_ethash_dag`.
///
/// The buffer is allocated in C (via malloc) and freed via `ethash_free_dag`
/// when this struct is dropped.  The buffer is stored as a raw pointer +
/// length because it was allocated by C's malloc and must be freed by C's
/// free (via `ethash_free_dag`), not by Rust's allocator.
pub struct EthashDag {
    ptr: *mut u8,
    len: usize, // total bytes = dag_size_entries * 128
    pub dag_size_entries: u64,
    pub epoch: u32,
}

unsafe impl Send for EthashDag {}
unsafe impl Sync for EthashDag {}

impl EthashDag {
    /// Returns the DAG buffer as a byte slice.
    pub fn as_slice(&self) -> &[u8] {
        if self.ptr.is_null() {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(self.ptr, self.len) }
        }
    }

    /// Returns the DAG buffer as a slice of little-endian u64 words
    /// (16 words per 128-byte entry).
    pub fn as_u64_slice(&self) -> &[u64] {
        if self.ptr.is_null() {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(self.ptr as *const u64, self.len / 8) }
        }
    }
}

impl Drop for EthashDag {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            unsafe { ethash_free_dag(self.ptr) }
            self.ptr = std::ptr::null_mut();
        }
    }
}

/// Generate the full Ethash DAG for a given epoch.
///
/// This is an expensive operation (1+ GB for epoch 0, growing ~8 MB per epoch).
/// The returned `EthashDag` owns the C-allocated buffer and frees it on drop.
///
/// `progress_cb` is called periodically with a percentage (0..100); it may be
/// `None`.
pub fn generate_ethash_dag(epoch: u32) -> Option<EthashDag> {
    let mut dag_size_entries: u64 = 0;
    let ptr = unsafe { ethash_generate_dag(epoch, &mut dag_size_entries, None) };
    if ptr.is_null() {
        None
    } else {
        Some(EthashDag {
            ptr,
            len: (dag_size_entries as usize) * 128,
            dag_size_entries,
            epoch,
        })
    }
}

// ── Ethash light cache (for on-GPU DAG generation) ───────────────────

/// RAII wrapper for an Ethash light cache buffer allocated by the C code.
/// The buffer is freed automatically when dropped.
pub struct EthashLightCache {
    ptr: *mut u8,
    /// Size of the cache in bytes.
    pub cache_size: u64,
    /// Number of 64-byte cache items.
    pub cache_items: u64,
    /// Number of 128-byte DAG entries (for the full DAG).
    pub dag_size_entries: u64,
    /// Epoch number.
    pub epoch: u32,
    /// True if the buffer was allocated by pure-Rust (Box), false if by C malloc.
    rust_owned: bool,
}

impl EthashLightCache {
    /// Returns the cache buffer as a byte slice.
    pub fn as_slice(&self) -> &[u8] {
        if self.ptr.is_null() {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(self.ptr, self.cache_size as usize) }
        }
    }
}

impl Drop for EthashLightCache {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            if self.rust_owned {
                // Free via Rust's allocator (Box from Box::into_raw)
                unsafe {
                    let _ = Box::from_raw(std::slice::from_raw_parts_mut(
                        self.ptr,
                        self.cache_size as usize,
                    ));
                }
            } else {
                unsafe { ethash_free_light_cache(self.ptr) }
            }
            self.ptr = std::ptr::null_mut();
        }
    }
}

/// Generate the Ethash light cache for a given epoch (for on-GPU DAG generation).
/// The light cache is small (~16MB + epoch*128KB) and fast to generate on CPU.
pub fn generate_ethash_light_cache(epoch: u32) -> Option<EthashLightCache> {
    let mut cache_size: u64 = 0;
    let mut cache_items: u64 = 0;
    let mut dag_size_entries: u64 = 0;
    let ptr = unsafe {
        ethash_generate_light_cache(
            epoch,
            &mut cache_size,
            &mut cache_items,
            &mut dag_size_entries,
        )
    };
    if ptr.is_null() {
        None
    } else {
        Some(EthashLightCache {
            ptr,
            cache_size,
            cache_items,
            dag_size_entries,
            epoch,
            rust_owned: false,
        })
    }
}

/// An owned KawPow DAG buffer generated by `generate_kawpow_dag`.
pub struct KawpowDag {
    ptr: *mut u8,
    len: usize,
    pub dag_size_entries: u64,
    pub epoch: u32,
}

unsafe impl Send for KawpowDag {}
unsafe impl Sync for KawpowDag {}

impl KawpowDag {
    /// Returns the DAG buffer as a byte slice.
    pub fn as_slice(&self) -> &[u8] {
        if self.ptr.is_null() {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(self.ptr, self.len) }
        }
    }

    /// Returns the DAG buffer as a slice of little-endian u64 words.
    pub fn as_u64_slice(&self) -> &[u64] {
        if self.ptr.is_null() {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(self.ptr as *const u64, self.len / 8) }
        }
    }
}

impl Drop for KawpowDag {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            unsafe { kawpow_free_dag(self.ptr) }
            self.ptr = std::ptr::null_mut();
        }
    }
}

/// Generate the full KawPow DAG for a given epoch.
pub fn generate_kawpow_dag(epoch: u32) -> Option<KawpowDag> {
    let mut dag_size_entries: u64 = 0;
    let ptr = unsafe { kawpow_generate_dag(epoch, &mut dag_size_entries, None) };
    if ptr.is_null() {
        None
    } else {
        Some(KawpowDag {
            ptr,
            len: (dag_size_entries as usize) * 128,
            dag_size_entries,
            epoch,
        })
    }
}

// ── KawPow light cache (for on-GPU DAG generation) ───────────────────

/// RAII wrapper for a KawPow light cache buffer allocated by the C code.
/// The buffer is freed automatically when dropped.
pub struct KawpowLightCache {
    ptr: *mut u8,
    /// Size of the cache in bytes.
    pub cache_size: u64,
    /// Number of 64-byte cache items.
    pub cache_items: u64,
    /// Number of 128-byte DAG entries (for the full DAG).
    pub dag_size_entries: u64,
    /// Epoch number.
    pub epoch: u32,
    /// True if the buffer was allocated by pure-Rust (Box), false if by C malloc.
    rust_owned: bool,
}

impl KawpowLightCache {
    /// Returns the cache buffer as a byte slice.
    pub fn as_slice(&self) -> &[u8] {
        if self.ptr.is_null() {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(self.ptr, self.cache_size as usize) }
        }
    }
}

impl Drop for KawpowLightCache {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            if self.rust_owned {
                unsafe {
                    let _ = Box::from_raw(std::slice::from_raw_parts_mut(
                        self.ptr,
                        self.cache_size as usize,
                    ));
                }
            } else {
                unsafe { kawpow_free_light_cache(self.ptr) }
            }
            self.ptr = std::ptr::null_mut();
        }
    }
}

/// Generate the light cache for a given epoch (for on-GPU DAG generation).
/// The light cache is small (~16MB + epoch*128KB) and fast to generate on CPU.
pub fn generate_kawpow_light_cache(epoch: u32) -> Option<KawpowLightCache> {
    let mut cache_size: u64 = 0;
    let mut cache_items: u64 = 0;
    let mut dag_size_entries: u64 = 0;
    let ptr = unsafe {
        kawpow_generate_light_cache(
            epoch,
            &mut cache_size,
            &mut cache_items,
            &mut dag_size_entries,
        )
    };
    if ptr.is_null() {
        None
    } else {
        Some(KawpowLightCache {
            ptr,
            cache_size,
            cache_items,
            dag_size_entries,
            epoch,
            rust_owned: false,
        })
    }
}

// ── VerusHash v2.2 (VRSC) ────────────────────────────────────────────

unsafe extern "C" {
    fn verushash_init();
    fn verushash_hash(header: *const u8, header_len: usize, nonce: u64, output: *mut u8);
    fn verushash_hash_raw(header: *const u8, header_len: usize, output: *mut u8);
}

/// Initialize VerusHash lookup tables (Haraka round constants, CLHash keys).
/// Must be called once before any `hash_verushash_native` calls.
pub fn init_verushash() {
    unsafe {
        verushash_init();
    }
}

/// Compute VerusHash v2.2 using the native C++ implementation.
///
/// Calls the Haraka+CLHash pipeline from VerusCoin upstream.
/// Returns a 32-byte hash.
pub fn hash_verushash_native(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        verushash_hash(header.as_ptr(), header.len(), nonce, out.as_mut_ptr());
    }
    out
}

/// Compute VerusHash v2.2 of a complete header (no nonce appended).
pub fn hash_verushash_raw_native(header: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        verushash_hash_raw(header.as_ptr(), header.len(), out.as_mut_ptr());
    }
    out
}

// ── ProgPow (EPIC) ───────────────────────────────────────────────────
//
// ProgPow native FFI stubs. The full C implementation (keccak_f800 + DAG +
// KISS99 random math) is not yet linked. These stubs return errors so the
// pure-Rust fallback in external_hashers.rs is used instead.
//
// To enable native ProgPow, port the C implementation from:
//   https://github.com/ifdefelse/ProgPOW (libprogpow/ProgPow.h)
// and link it via build.rs with the `native-hashers` feature.

/// Compute ProgPow hash using native C FFI (stub — not yet implemented).
///
/// Returns `Err` to signal the caller to use the pure-Rust fallback.
pub fn hash_progpow_native(
    _header: &[u8; 32],
    _nonce: u64,
    _height: u32,
) -> Result<([u8; 32], [u8; 32]), &'static str> {
    Err("native ProgPow FFI not yet implemented — using pure-Rust fallback")
}

/// Compute ProgPow hash with a precomputed DAG using native C FFI (stub).
///
/// Returns `Err` to signal the caller to use the pure-Rust fallback.
pub fn hash_progpow_native_with_dag(
    _header_hash: &[u8; 32],
    _nonce: u64,
    _dag: &[u64],
    _dag_size_entries: u64,
) -> Result<([u8; 32], [u8; 32]), &'static str> {
    Err("native ProgPow FFI with DAG not yet implemented — using pure-Rust fallback")
}

// ── Pearl (PRL) — PearlHash PoUW ─────────────────────────────────────

/// Compute Pearl hash using native C FFI (stub).
///
/// Returns `Err` to signal the caller to use the pure-Rust BLAKE3 fallback.
/// The full PoUW implementation requires INT8 MatMul + noise generation,
/// which will be implemented in the GPU kernels (pearl_kernel.cl/metal).
pub fn hash_pearl_native(_header_hash: &[u8; 32], _nonce: u64) -> Result<[u8; 32], &'static str> {
    Err("native Pearl FFI not yet implemented — using pure-Rust BLAKE3 fallback")
}

// ── Pure-Rust light cache generation (no C FFI, no SIGILL risk) ──────
//
// These functions replace the C FFI `generate_kawpow_light_cache` and
// `generate_ethash_light_cache` for platforms where the C code triggers
// SIGILL (e.g. Pentium G4560 without AVX). The algorithm is identical:
// seed hash → keccak-512 chain → 3 rounds of RANDMEMOHASH mixing.
//
// The light cache is small (~16 MB + epoch * 128 KB) so pure-Rust
// performance is adequate (~1-3 seconds even on a slow CPU).

use sha3::{Digest, Keccak256, Keccak512};

const CACHE_ROUNDS: usize = 3;
const CACHE_BYTES_INIT: u64 = 1 << 24; // 16 MB
const CACHE_BYTES_GROWTH: u64 = 1 << 17; // 128 KB
const HASH_BYTES: u64 = 64;
const DATASET_BYTES_INIT: u64 = 1 << 30; // 1 GB
const DATASET_BYTES_GROWTH: u64 = 1 << 23; // 8 MB
const MIX_BYTES: u64 = 128;

/// Primality test for u64 using trial division (sufficient for cache/dataset
/// item counts, which are < 2^64 and whose square roots are small).
fn is_prime_u64(n: u64) -> bool {
    if n < 2 {
        return false;
    }
    if n % 2 == 0 {
        return n == 2;
    }
    if n % 3 == 0 {
        return n == 3;
    }
    let mut i = 5u64;
    while i * i <= n {
        if n % i == 0 || n % (i + 2) == 0 {
            return false;
        }
        i += 6;
    }
    true
}

/// Compute the cache size for a given epoch.
///
/// Follows the Ethash/ProgPoW spec: linear growth rounded down to the largest
/// size whose number of 64-byte items is prime.
fn cache_size_for_epoch(epoch: u32) -> u64 {
    let mut items =
        (CACHE_BYTES_INIT + (epoch as u64) * CACHE_BYTES_GROWTH - HASH_BYTES) / HASH_BYTES;
    while !is_prime_u64(items) {
        items = items.saturating_sub(2).max(1);
    }
    items * HASH_BYTES
}

/// Compute the dataset (DAG) size for a given epoch.
///
/// Follows the Ethash/ProgPoW spec: linear growth rounded down to the largest
/// size whose number of 128-byte items is prime.
fn dataset_size_for_epoch(epoch: u32) -> u64 {
    let mut items =
        (DATASET_BYTES_INIT + (epoch as u64) * DATASET_BYTES_GROWTH - MIX_BYTES) / MIX_BYTES;
    while !is_prime_u64(items) {
        items = items.saturating_sub(2).max(1);
    }
    items * MIX_BYTES
}

/// Compute the seed hash for an epoch by keccak-256 chaining.
fn seed_hash_for_epoch(epoch: u32) -> [u8; 32] {
    let mut seed = [0u8; 32];
    for _ in 0..epoch {
        let mut hasher = Keccak256::new();
        hasher.update(&seed);
        seed = hasher.finalize().into();
    }
    seed
}

/// Generate the light cache in pure Rust.
/// Returns (cache_bytes, cache_items, dag_size_entries).
fn generate_light_cache_rust(epoch: u32) -> (Vec<u8>, u64, u64) {
    let cache_size = cache_size_for_epoch(epoch);
    let cache_items = cache_size / 64;
    let dag_size_entries = dataset_size_for_epoch(epoch) / 128;

    let seed = seed_hash_for_epoch(epoch);

    // Allocate cache
    let mut cache = vec![0u8; cache_size as usize];

    // Generate cache: seed first item, chain with keccak-512
    {
        let mut hasher = Keccak512::new();
        hasher.update(&seed);
        let hash = hasher.finalize();
        cache[..64].copy_from_slice(&hash);
    }
    for i in 1..cache_items as usize {
        let mut hasher = Keccak512::new();
        hasher.update(&cache[(i - 1) * 64..i * 64]);
        let hash = hasher.finalize();
        cache[i * 64..(i + 1) * 64].copy_from_slice(&hash);
    }

    // RANDMEMOHASH mixing rounds (3 rounds)
    for _r in 0..CACHE_ROUNDS {
        for i in 0..cache_items as usize {
            let v = u32::from_le_bytes([
                cache[i * 64],
                cache[i * 64 + 1],
                cache[i * 64 + 2],
                cache[i * 64 + 3],
            ]) % cache_items as u32;
            let prev = (i + cache_items as usize - 1) % cache_items as usize;

            let mut tmp = [0u8; 64];
            for j in 0..64 {
                tmp[j] = cache[prev * 64 + j] ^ cache[v as usize * 64 + j];
            }

            let mut hasher = Keccak512::new();
            hasher.update(&tmp);
            let hash = hasher.finalize();
            cache[i * 64..(i + 1) * 64].copy_from_slice(&hash);
        }
    }

    (cache, cache_items, dag_size_entries)
}

/// Pure-Rust replacement for `generate_kawpow_light_cache`.
/// KawPow epoch length = 7500.
pub fn generate_kawpow_light_cache_rust(epoch: u32) -> Option<KawpowLightCache> {
    let (cache, cache_items, dag_size_entries) = generate_light_cache_rust(epoch);
    let cache_size = cache.len() as u64;

    // Leak the Vec to get a raw pointer that matches the C FFI interface.
    // The KawpowLightCache Drop impl will free it via kawpow_free_light_cache,
    // but since we're in pure Rust, we need to handle it differently.
    // We'll use Box::into_raw to allocate, and the Drop will use Rust's free.
    let ptr = Box::into_raw(cache.into_boxed_slice()) as *mut u8;

    Some(KawpowLightCache {
        ptr,
        cache_size,
        cache_items,
        dag_size_entries,
        epoch,
        rust_owned: true,
    })
}

/// Pure-Rust replacement for `generate_ethash_light_cache`.
/// Ethash/ProgPow epoch length = 30000.
pub fn generate_ethash_light_cache_rust(epoch: u32) -> Option<EthashLightCache> {
    let (cache, cache_items, dag_size_entries) = generate_light_cache_rust(epoch);
    let cache_size = cache.len() as u64;

    let ptr = Box::into_raw(cache.into_boxed_slice()) as *mut u8;

    Some(EthashLightCache {
        ptr,
        cache_size,
        cache_items,
        dag_size_entries,
        epoch,
        rust_owned: true,
    })
}
