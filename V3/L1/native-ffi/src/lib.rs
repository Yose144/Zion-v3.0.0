//! # zion-native-ffi
//!
//! Feature-gated safe Rust wrappers around the ZION native C algorithm libraries.
//!
//! ## Feature flags
//!
//! Enable algorithms individually or all at once:
//!
//! ```toml
//! # In Cargo.toml of your crate:
//! zion-native-ffi = { path = "../native-ffi", features = ["native-all"] }
//! ```
//!
//! | Feature                | Algorithm       | Coins           |
//! |------------------------|-----------------|-----------------|
//! | `native-etchash`       | Ethash/EtcHash  | ETC             |
//! | `native-kawpow`        | KawPow          | RVN, CLORE      |
//! | `native-autolykos`     | Autolykos v2    | ERG             |
//! | `native-kheavyhash`    | kHeavyHash      | KAS             |
//! | `native-blake3-algo`   | Blake3          | ALPH, DCR       |
//! | `native-cosmic-harmony`| Cosmic Harmony v3 | ZION          |
//! | `native-verushash`     | VerusHash v2.2  | VRSC            |
//! | `native-randomx`       | RandomX         | XMR, ZEPH       |
//! | `native-all`           | All of the above| —               |

// ---------------------------------------------------------------------------
// Etchash / Ethash
// ---------------------------------------------------------------------------

#[cfg(feature = "native-etchash")]
pub mod etchash {
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
        pub fn ethash_benchmark(iterations: i32) -> f64;
        pub fn ethash_cleanup();
        pub fn ethash_version() -> *const std::ffi::c_char;
    }

    /// Compute the Ethash/EtcHash of a block header.
    ///
    /// Returns 32-byte mix hash.  Thread-unsafe (global epoch cache) — use a
    /// single-threaded executor or external locking when calling concurrently.
    pub fn hash(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe {
            ethash_hash(header.as_ptr(), header.len(), nonce, height, out.as_mut_ptr());
        }
        out
    }

    /// Returns `true` if the computed hash is below `target` (LE big-int comparison).
    pub fn verify(header: &[u8], nonce: u64, height: u32, target: &[u8; 32]) -> bool {
        unsafe { ethash_verify(header.as_ptr(), header.len(), nonce, height, target.as_ptr()) == 1 }
    }

    /// Run a quick initialisation for epoch 0 (safe to call multiple times).
    pub fn init() {
        unsafe { ethash_init(); }
    }

    /// Hash/s estimate over `iterations` single-hash invocations.
    pub fn benchmark(iterations: i32) -> f64 {
        unsafe { ethash_benchmark(iterations) }
    }
}

// ---------------------------------------------------------------------------
// KawPow  (RVN / CLORE)
// ---------------------------------------------------------------------------

#[cfg(feature = "native-kawpow")]
pub mod kawpow {
    unsafe extern "C" {
        /// header: 32-byte header hash; two 32-byte output buffers: mix_out + hash_out
        pub fn kawpow_hash(
            header: *const u8,
            nonce: u64,
            height: u32,
            epoch: u32,
            mix_out: *mut u8,
            hash_out: *mut u8,
        );
        pub fn kawpow_verify(
            header: *const u8,
            nonce: u64,
            height: u32,
            epoch: u32,
            expected_mix: *const u8,  // may be null
            target: *const u8,
        ) -> i32;
        pub fn kawpow_get_epoch(height: u32) -> u32;
        pub fn kawpow_benchmark_cpu(iterations: i32) -> f64;
        pub fn kawpow_version() -> *const std::ffi::c_char;
    }

    /// Returns (mix_hash, final_hash) tuple, each 32 bytes.
    pub fn hash(header: &[u8; 32], nonce: u64, height: u32) -> ([u8; 32], [u8; 32]) {
        let mut mix = [0u8; 32];
        let mut out = [0u8; 32];
        let epoch = unsafe { kawpow_get_epoch(height) };
        unsafe {
            kawpow_hash(header.as_ptr(), nonce, height, epoch, mix.as_mut_ptr(), out.as_mut_ptr());
        }
        (mix, out)
    }

    /// Verify with difficulty target; pass `None` for `expected_mix` to skip mix check.
    pub fn verify(header: &[u8; 32], nonce: u64, height: u32, expected_mix: Option<&[u8; 32]>, target: &[u8; 32]) -> bool {
        let epoch = unsafe { kawpow_get_epoch(height) };
        let mix_ptr = expected_mix.map_or(std::ptr::null(), |m| m.as_ptr());
        unsafe {
            kawpow_verify(header.as_ptr(), nonce, height, epoch, mix_ptr, target.as_ptr()) == 1
        }
    }

    pub fn benchmark(iterations: i32) -> f64 {
        unsafe { kawpow_benchmark_cpu(iterations) }
    }
}

// ---------------------------------------------------------------------------
// Autolykos v2  (ERG)
// ---------------------------------------------------------------------------

#[cfg(feature = "native-autolykos")]
pub mod autolykos {
    unsafe extern "C" {
        /// Returns first 8 bytes of output as LE u64; output buf receives full 32-byte hash.
        pub fn autolykos_hash(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            height: u32,
            output: *mut u8,
        ) -> u64;
        /// target is a u64 difficulty threshold; returns 1 if hash < target.
        pub fn autolykos_verify(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            height: u32,
            target: u64,
        ) -> i32;
        pub fn autolykos_benchmark_cpu(iterations: i32) -> f64;
    }

    /// Compute Autolykos v2 hash.  Returns 32-byte output hash.
    pub fn hash(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe {
            autolykos_hash(header.as_ptr(), header.len(), nonce, height, out.as_mut_ptr());
        }
        out
    }

    /// Returns `true` if the hash value (first 8 bytes as LE u64) is below `target`.
    pub fn verify_u64(header: &[u8], nonce: u64, height: u32, target: u64) -> bool {
        unsafe {
            autolykos_verify(header.as_ptr(), header.len(), nonce, height, target) == 1
        }
    }

    pub fn benchmark(iterations: i32) -> f64 {
        unsafe { autolykos_benchmark_cpu(iterations) }
    }
}

// ---------------------------------------------------------------------------
// kHeavyHash  (KAS)
// ---------------------------------------------------------------------------

#[cfg(feature = "native-kheavyhash")]
pub mod kheavyhash {
    unsafe extern "C" {
        pub fn kheavyhash_hash(input: *const u8, len: usize, output: *mut u8);
        pub fn kheavyhash_mine(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            output: *mut u8,
        );
        pub fn kheavyhash_verify(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            target: *const u8,
        ) -> i32;
        pub fn kheavyhash_benchmark(iterations: i32) -> f64;
        pub fn kheavyhash_version() -> *const std::ffi::c_char;
    }

    pub fn hash(input: &[u8]) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe { kheavyhash_hash(input.as_ptr(), input.len(), out.as_mut_ptr()); }
        out
    }

    pub fn mine(header: &[u8], nonce: u64) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe { kheavyhash_mine(header.as_ptr(), header.len(), nonce, out.as_mut_ptr()); }
        out
    }

    pub fn verify(header: &[u8], nonce: u64, target: &[u8; 32]) -> bool {
        unsafe { kheavyhash_verify(header.as_ptr(), header.len(), nonce, target.as_ptr()) == 1 }
    }

    pub fn benchmark(iterations: i32) -> f64 {
        unsafe { kheavyhash_benchmark(iterations) }
    }
}

// ---------------------------------------------------------------------------
// Blake3-algo  (ALPH, DCR)
// Feature name is blake3-algo to avoid collision with the blake3 pure-Rust
// crate used elsewhere in the workspace.
// ---------------------------------------------------------------------------

#[cfg(feature = "native-blake3-algo")]
pub mod blake3_algo {
    unsafe extern "C" {
        pub fn blake3_hash(input: *const u8, input_len: usize, output: *mut u8);
        pub fn blake3_mine(
            header: *const u8,
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
        pub fn blake3_benchmark(iterations: i32) -> f64;
        pub fn blake3_version() -> *const std::ffi::c_char;
    }

    pub fn hash(input: &[u8]) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe { blake3_hash(input.as_ptr(), input.len(), out.as_mut_ptr()); }
        out
    }

    pub fn mine(header: &[u8], nonce: u64) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe { blake3_mine(header.as_ptr(), header.len(), nonce, out.as_mut_ptr()); }
        out
    }

    pub fn verify(header: &[u8], nonce: u64, target: &[u8; 32]) -> bool {
        unsafe { blake3_verify(header.as_ptr(), header.len(), nonce, target.as_ptr()) == 1 }
    }

    pub fn benchmark(iterations: i32) -> f64 {
        unsafe { blake3_benchmark(iterations) }
    }
}

// ---------------------------------------------------------------------------
// Cosmic Harmony v3  (ZION)
// ---------------------------------------------------------------------------

#[cfg(feature = "native-cosmic-harmony")]
pub mod cosmic_harmony {
    unsafe extern "C" {
        /// Full CHv3 pipeline through nonce: Keccak-256 → SHA3-512 → Golden Matrix → Cosmic Fusion.
        /// Returns 0 on success;  output receives 32-byte final hash.
        pub fn cosmic_harmony_v3_hash(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            output: *mut u8,
        ) -> i32;
        pub fn cosmic_harmony_v3_hash_raw(
            input: *const u8,
            input_len: usize,
            output: *mut u8,
        ) -> i32;
        /// duration_seconds: run for this many wallclock seconds and return H/s.
        pub fn cosmic_harmony_v3_benchmark(duration_seconds: i32) -> f64;
        pub fn cosmic_harmony_v3_get_info() -> *const std::ffi::c_char;
    }

    /// Hash block header with nonce appended; returns 32-byte CHv3 output.
    pub fn mine(header: &[u8], nonce: u64) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe {
            cosmic_harmony_v3_hash(header.as_ptr(), header.len(), nonce, out.as_mut_ptr());
        }
        out
    }

    /// Hash raw bytes (no nonce appended internally); returns 32-byte CHv3 output.
    pub fn hash_raw(input: &[u8]) -> [u8; 32] {
        let mut out = [0u8; 32];
        unsafe {
            cosmic_harmony_v3_hash_raw(input.as_ptr(), input.len(), out.as_mut_ptr());
        }
        out
    }

    /// Run benchmark for `duration_secs` seconds; returns hashes/second.
    pub fn benchmark(duration_secs: i32) -> f64 {
        unsafe { cosmic_harmony_v3_benchmark(duration_secs) }
    }
}

// ---------------------------------------------------------------------------
// VerusHash v2.2  (VRSC)
// ---------------------------------------------------------------------------

#[cfg(feature = "native-verushash")]
pub mod verushash {
    unsafe extern "C" {
        pub fn verushash_init();
        pub fn verushash_hash(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            output: *mut u8,
        );
        pub fn verushash_verify(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            target: *const u8,
        ) -> i32;
        pub fn verushash_benchmark(iterations: i32) -> f64;
        pub fn verushash_version() -> *const std::ffi::c_char;
    }

    use std::sync::Once;
    static INIT: Once = Once::new();

    pub fn init() {
        INIT.call_once(|| unsafe { verushash_init(); });
    }

    pub fn hash(header: &[u8], nonce: u64) -> [u8; 32] {
        init();
        let mut out = [0u8; 32];
        unsafe {
            verushash_hash(header.as_ptr(), header.len(), nonce, out.as_mut_ptr());
        }
        out
    }

    pub fn verify(header: &[u8], nonce: u64, target: &[u8; 32]) -> bool {
        init();
        unsafe {
            verushash_verify(header.as_ptr(), header.len(), nonce, target.as_ptr()) == 1
        }
    }

    pub fn benchmark(iterations: i32) -> f64 {
        init();
        unsafe { verushash_benchmark(iterations) }
    }
}

// ---------------------------------------------------------------------------
// RandomX  (XMR, ZEPH)
// ---------------------------------------------------------------------------

#[cfg(feature = "native-randomx")]
pub mod randomx {
    unsafe extern "C" {
        pub fn randomx_zion_init();
        pub fn randomx_zion_hash(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            output: *mut u8,
        );
        pub fn randomx_zion_verify(
            header: *const u8,
            header_len: usize,
            nonce: u64,
            target: *const u8,
        ) -> i32;
        pub fn randomx_zion_benchmark(iterations: i32) -> f64;
        pub fn randomx_zion_version() -> *const std::ffi::c_char;
    }

    use std::sync::Once;
    static INIT: Once = Once::new();

    pub fn init() {
        INIT.call_once(|| unsafe { randomx_zion_init(); });
    }

    pub fn hash(header: &[u8], nonce: u64) -> [u8; 32] {
        init();
        let mut out = [0u8; 32];
        unsafe {
            randomx_zion_hash(header.as_ptr(), header.len(), nonce, out.as_mut_ptr());
        }
        out
    }

    pub fn verify(header: &[u8], nonce: u64, target: &[u8; 32]) -> bool {
        init();
        unsafe {
            randomx_zion_verify(header.as_ptr(), header.len(), nonce, target.as_ptr()) == 1
        }
    }

    pub fn benchmark(iterations: i32) -> f64 {
        init();
        unsafe { randomx_zion_benchmark(iterations) }
    }
}

// ---------------------------------------------------------------------------
// Algorithm registry  — enumerate which features are compiled in
// ---------------------------------------------------------------------------

/// Returns the list of native algorithm names compiled into this build.
pub fn compiled_algorithms() -> Vec<&'static str> {
    let mut v = Vec::new();
    #[cfg(feature = "native-etchash")]        { v.push("etchash"); }
    #[cfg(feature = "native-kawpow")]         { v.push("kawpow"); }
    #[cfg(feature = "native-autolykos")]      { v.push("autolykos"); }
    #[cfg(feature = "native-kheavyhash")]     { v.push("kheavyhash"); }
    #[cfg(feature = "native-blake3-algo")]    { v.push("blake3"); }
    #[cfg(feature = "native-cosmic-harmony")] { v.push("cosmic-harmony"); }
    #[cfg(feature = "native-verushash")]      { v.push("verushash"); }
    #[cfg(feature = "native-randomx")]        { v.push("randomx"); }
    v
}

// ---------------------------------------------------------------------------
// Runtime self-test — validates each compiled algorithm against a canonical
// deterministic check at startup.  Returns a list of (algo_name, passed) pairs.
// ---------------------------------------------------------------------------

/// Result of a single algorithm self-test.
#[derive(Debug, Clone)]
pub struct AlgoTestResult {
    pub name: &'static str,
    pub passed: bool,
    pub detail: String,
}

/// Run deterministic self-tests for every compiled algorithm.
///
/// Each test computes a hash with a fixed input and verifies:
/// 1. The output is non-zero (symbol loaded correctly).
/// 2. A second invocation produces the same output (determinism).
///
/// Call this once at miner startup.  If any result has `passed == false`,
/// the corresponding algorithm should not be used for real mining.
pub fn runtime_self_test() -> Vec<AlgoTestResult> {
    let mut results = Vec::new();

    #[cfg(feature = "native-etchash")]
    {
        let name = "etchash";
        let header = [0xA1u8; 32];
        let h1 = etchash::hash(&header, 1, 0);
        let h2 = etchash::hash(&header, 1, 0);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    #[cfg(feature = "native-kawpow")]
    {
        let name = "kawpow";
        let header = [0xA2u8; 32];
        let (_, h1) = kawpow::hash(&header, 1, 0);
        let (_, h2) = kawpow::hash(&header, 1, 0);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    #[cfg(feature = "native-autolykos")]
    {
        let name = "autolykos";
        let header = [0xA3u8; 32];
        let h1 = autolykos::hash(&header, 1, 700_000);
        let h2 = autolykos::hash(&header, 1, 700_000);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    #[cfg(feature = "native-kheavyhash")]
    {
        let name = "kheavyhash";
        let header = [0xA4u8; 80];
        let h1 = kheavyhash::mine(&header, 1);
        let h2 = kheavyhash::mine(&header, 1);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    #[cfg(feature = "native-blake3-algo")]
    {
        let name = "blake3";
        let header = [0xA5u8; 32];
        let h1 = blake3_algo::mine(&header, 1);
        let h2 = blake3_algo::mine(&header, 1);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    #[cfg(feature = "native-cosmic-harmony")]
    {
        let name = "cosmic-harmony";
        let header = [0xA6u8; 80];
        let h1 = cosmic_harmony::mine(&header, 1);
        let h2 = cosmic_harmony::mine(&header, 1);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    #[cfg(feature = "native-verushash")]
    {
        let name = "verushash";
        let header = [0xA7u8; 76];
        let h1 = verushash::hash(&header, 1);
        let h2 = verushash::hash(&header, 1);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    #[cfg(feature = "native-randomx")]
    {
        let name = "randomx";
        let header = [0xA8u8; 76];
        let h1 = randomx::hash(&header, 1);
        let h2 = randomx::hash(&header, 1);
        let ok = h1 != [0u8; 32] && h1 == h2;
        results.push(AlgoTestResult {
            name, passed: ok,
            detail: if ok { "deterministic, non-zero".into() } else { "FAILED: zero or non-deterministic".into() },
        });
    }

    results
}

/// Returns `true` if all compiled algorithms pass their self-test.
pub fn all_algorithms_healthy() -> bool {
    runtime_self_test().iter().all(|r| r.passed)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiled_algorithms_baseline() {
        // Always passes — just documents which algos are in this build.
        let algos = compiled_algorithms();
        println!("zion-native-ffi compiled algorithms: {:?}", algos);
    }

    #[test]
    fn runtime_self_test_all_pass() {
        let results = runtime_self_test();
        println!("runtime_self_test: {} algos tested", results.len());
        for r in &results {
            println!("  {} — {} ({})", r.name, if r.passed { "OK" } else { "FAIL" }, r.detail);
            assert!(r.passed, "algorithm {} failed self-test: {}", r.name, r.detail);
        }
    }

    #[test]
    fn all_algorithms_healthy_passes() {
        assert!(all_algorithms_healthy() || compiled_algorithms().is_empty());
    }

    #[test]
    fn self_test_count_matches_compiled() {
        let compiled = compiled_algorithms().len();
        let tested = runtime_self_test().len();
        assert_eq!(compiled, tested, "every compiled algo must have a self-test");
    }

    #[cfg(feature = "native-etchash")]
    #[test]
    fn etchash_smoke() {
        etchash::init();
        let header = [0x01u8; 32];
        let hash = etchash::hash(&header, 12345, 0);
        assert_ne!(hash, [0u8; 32], "etchash must produce non-zero output");
        println!("etchash smoke: {:02x?}", &hash[..8]);
    }

    #[cfg(feature = "native-kawpow")]
    #[test]
    fn kawpow_smoke() {
        let header = [0x02u8; 32];
        let (_mix, hash) = kawpow::hash(&header, 99999, 1_000_000);
        assert_ne!(hash, [0u8; 32], "kawpow must produce non-zero output");
        println!("kawpow smoke: {:02x?}", &hash[..8]);
    }

    #[cfg(feature = "native-autolykos")]
    #[test]
    fn autolykos_smoke() {
        let header = [0x03u8; 32];
        let hash = autolykos::hash(&header, 42, 700_000);
        assert_ne!(hash, [0u8; 32], "autolykos must produce non-zero output");
        println!("autolykos smoke: {:02x?}", &hash[..8]);
    }

    #[cfg(feature = "native-kheavyhash")]
    #[test]
    fn kheavyhash_smoke() {
        let header = [0x04u8; 80];
        let hash = kheavyhash::mine(&header, 1234);
        assert_ne!(hash, [0u8; 32], "kheavyhash must produce non-zero output");
        println!("kheavyhash smoke: {:02x?}", &hash[..8]);
    }

    #[cfg(feature = "native-blake3-algo")]
    #[test]
    fn blake3_algo_smoke() {
        let header = [0x05u8; 32];
        let hash = blake3_algo::mine(&header, 5678);
        assert_ne!(hash, [0u8; 32], "blake3-algo must produce non-zero output");
        println!("blake3 smoke: {:02x?}", &hash[..8]);
    }

    #[cfg(feature = "native-cosmic-harmony")]
    #[test]
    fn cosmic_harmony_smoke() {
        let header = [0x06u8; 80];
        let hash = cosmic_harmony::mine(&header, 7890);
        assert_ne!(hash, [0u8; 32], "cosmic-harmony must produce non-zero output");
        let h2 = cosmic_harmony::mine(&header, 7890);
        assert_eq!(hash, h2, "cosmic-harmony must be deterministic");
        println!("cosmic-harmony smoke: {:02x?}", &hash[..8]);
    }

    #[cfg(feature = "native-verushash")]
    #[test]
    fn verushash_smoke() {
        let header = [0x07u8; 76];
        let h1 = verushash::hash(&header, 0);
        let h2 = verushash::hash(&header, 0);
        assert_eq!(h1, h2, "verushash must be deterministic");
        assert_ne!(h1, [0u8; 32], "verushash must produce non-zero output");
        println!("verushash smoke: {:02x?}", &h1[..8]);
    }

    #[cfg(feature = "native-randomx")]
    #[test]
    fn randomx_smoke() {
        let header = [0x08u8; 76];
        let h1 = randomx::hash(&header, 0);
        let h2 = randomx::hash(&header, 0);
        assert_eq!(h1, h2, "randomx must be deterministic");
        assert_ne!(h1, [0u8; 32], "randomx must produce non-zero output");
        println!("randomx smoke: {:02x?}", &h1[..8]);
    }
}
