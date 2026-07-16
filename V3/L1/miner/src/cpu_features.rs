//! Runtime CPU feature detection (XMRig-style).
//!
//! Detects CPU instruction set support at runtime using `is_x86_feature_detected!`
//! on x86_64, and provides a centralized query interface for the miner to
//! decide which code paths are safe to execute.
//!
//! This is critical for distribution builds that may run on older CPUs
//! (e.g. Intel Pentium G4560 with SSE4.2 + AES-NI but NO AVX/BMI2).
//! The build system (`ZION_CPU_TARGET=x86-64`) compiles C/C++ code with
//! baseline ISA, and this module provides runtime checks for any Rust
//! code that uses `#[target_feature(enable = "...")]` or conditional paths.

use std::sync::OnceLock;

/// Detected CPU features at runtime.
#[derive(Debug, Clone)]
pub struct CpuFeatures {
    pub has_aes: bool,
    pub has_sse42: bool,
    pub has_avx: bool,
    pub has_avx2: bool,
    pub has_bmi1: bool,
    pub has_bmi2: bool,
    pub has_fma: bool,
    pub has_avx512f: bool,
    pub has_pclmulqdq: bool,
    pub has_popcnt: bool,
    /// CPU brand string (best-effort)
    pub brand: String,
    /// Number of logical cores
    pub cores: usize,
}

impl CpuFeatures {
    /// Returns true if the CPU supports AVX2 + BMI2 (i.e. "x86-64-v3" level).
    pub fn has_avx2_bmi2(&self) -> bool {
        self.has_avx2 && self.has_bmi2
    }

    /// Returns true if the CPU supports at least AES-NI + SSE4.2 (baseline for mining).
    pub fn has_mining_baseline(&self) -> bool {
        self.has_aes && self.has_sse42
    }
}

impl Default for CpuFeatures {
    fn default() -> Self {
        Self {
            has_aes: false,
            has_sse42: false,
            has_avx: false,
            has_avx2: false,
            has_bmi1: false,
            has_bmi2: false,
            has_fma: false,
            has_avx512f: false,
            has_pclmulqdq: false,
            has_popcnt: false,
            brand: "unknown".to_string(),
            cores: 1,
        }
    }
}

static FEATURES: OnceLock<CpuFeatures> = OnceLock::new();

/// Detect CPU features at runtime.
///
/// On x86_64, uses `is_x86_feature_detected!` macro which calls `cpuid`.
/// On other architectures, returns a default with all features disabled.
pub fn detect() -> CpuFeatures {
    FEATURES
        .get_or_init(detect_impl)
        .clone()
}

#[cfg(target_arch = "x86_64")]
fn detect_impl() -> CpuFeatures {
    let mut f = CpuFeatures {
        cores: num_logical_cores(),
        brand: cpu_brand(),
        ..CpuFeatures::default()
    };

    // is_x86_feature_detected! uses CPUID at runtime — safe on any x86_64 CPU.
    f.has_aes = std::is_x86_feature_detected!("aes");
    f.has_sse42 = std::is_x86_feature_detected!("sse4.2");
    f.has_sse42 = std::is_x86_feature_detected!("sse4.2");
    f.has_avx = std::is_x86_feature_detected!("avx");
    f.has_avx2 = std::is_x86_feature_detected!("avx2");
    f.has_bmi1 = std::is_x86_feature_detected!("bmi1");
    f.has_bmi2 = std::is_x86_feature_detected!("bmi2");
    f.has_fma = std::is_x86_feature_detected!("fma");
    f.has_pclmulqdq = std::is_x86_feature_detected!("pclmulqdq");
    f.has_popcnt = std::is_x86_feature_detected!("popcnt");

    // AVX-512 may not be available on all compilers — wrap in cfg
    #[cfg(target_feature = "avx512f")]
    {
        f.has_avx512f = std::is_x86_feature_detected!("avx512f");
    }

    f
}

#[cfg(not(target_arch = "x86_64"))]
fn detect_impl() -> CpuFeatures {
    CpuFeatures {
        cores: num_logical_cores(),
        brand: cpu_brand(),
        ..CpuFeatures::default()
    }
}

/// Get the number of logical CPU cores.
fn num_logical_cores() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
}

/// Get the CPU brand string (best-effort, Linux only).
#[cfg(target_os = "linux")]
fn cpu_brand() -> String {
    std::fs::read_to_string("/proc/cpuinfo")
        .ok()
        .and_then(|content| {
            content
                .lines()
                .find(|line| line.starts_with("model name"))
                .and_then(|line| line.split(':').nth(1))
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "unknown".to_string())
}

#[cfg(not(target_os = "linux"))]
fn cpu_brand() -> String {
    "unknown".to_string()
}

/// Print CPU feature detection results to stderr (for logging).
pub fn log_features() {
    let f = detect();
    eprintln!("cpu_features: brand={} cores={}", f.brand, f.cores);
    eprintln!(
        "cpu_features: aes={} sse42={} avx={} avx2={} bmi1={} bmi2={} fma={} pclmul={} popcnt={}",
        f.has_aes,
        f.has_sse42,
        f.has_avx,
        f.has_avx2,
        f.has_bmi1,
        f.has_bmi2,
        f.has_fma,
        f.has_pclmulqdq,
        f.has_popcnt
    );
    if !f.has_avx2 || !f.has_bmi2 {
        eprintln!(
            "cpu_features: WARNING — CPU lacks AVX2/BMI2, some algorithms will use slower fallback paths"
        );
    }
    if !f.has_aes {
        eprintln!(
            "cpu_features: WARNING — CPU lacks AES-NI, RandomX will use soft AES (~10x slower)"
        );
    }
}
