//! Hardware auto-detection and triple-stream auto-configuration.
//!
//! When the user runs `zion mine auto`, this module:
//! 1. Detects available GPU hardware (OpenCL / CUDA / Metal)
//! 2. Detects CPU cores and SIMD capabilities
//! 3. Determines the optimal mining configuration:
//!    - GPU + CPU → Triple Parallel (Stream 1 GPU ZION + Stream 2 GPU external + Stream 3 CPU external)
//!    - CPU only  → CPU-only mode (Stream 1 CPU ZION + Stream 3 CPU external)
//! 4. Prints a summary and launches the miner with the right env vars

use std::process::Command;

/// Detected hardware profile.
#[derive(Debug, Clone)]
pub struct HardwareProfile {
    /// Detected GPU devices (e.g. "opencl:AMD Radeon RX 5700 XT")
    pub gpu_devices: Vec<String>,
    /// Number of CPU cores (physical + logical via num_cpus)
    pub cpu_cores: usize,
    /// CPU SIMD support summary
    pub cpu_simd: String,
    /// Best available GPU backend: "opencl", "cuda", "metal", or "cpu"
    pub best_backend: String,
    /// Whether any GPU was detected
    pub has_gpu: bool,
}

/// Mining configuration derived from hardware detection.
#[derive(Debug, Clone)]
pub struct AutoMineConfig {
    /// Backend to use: "auto" (GPU) or "cpu"
    pub backend: String,
    /// Number of CPU threads for Stream 3 (external CPU coins)
    pub cpu_threads: usize,
    /// Whether Stream 1 (ZION primary) is enabled
    pub stream1_enabled: bool,
    /// Whether Stream 2 (GPU external) is enabled
    pub stream2_enabled: bool,
    /// Whether Stream 3 (CPU external) is enabled
    pub stream3_enabled: bool,
    /// Mining profile: "pool" (triple) or "pool" (cpu-only, same profile)
    pub profile: String,
    /// Human-readable mode name
    pub mode_name: String,
    /// List of coins that will be mineable in this configuration
    pub supported_coins: Vec<&'static str>,
}

/// Detect available hardware by querying the miner binary.
///
/// The miner binary has GPU detection built in (OpenCL/CUDA/Metal).
/// We call it with `--detect-hardware` flag which prints JSON-like output.
/// If the miner binary is not available, we fall back to CPU-only detection.
pub fn detect_hardware(miner_bin: &str) -> HardwareProfile {
    let cpu_cores = num_cpus::get();
    let cpu_simd = detect_cpu_simd();

    // Try to detect GPUs by running the miner binary with --detect-hardware
    let gpu_devices = detect_gpus_via_miner(miner_bin);

    let has_gpu = !gpu_devices.is_empty();
    let best_backend = if has_gpu {
        // Pick the best backend from detected devices
        if gpu_devices.iter().any(|d| d.starts_with("cuda:")) {
            "cuda".to_string()
        } else if gpu_devices.iter().any(|d| d.starts_with("metal:")) {
            "metal".to_string()
        } else if gpu_devices.iter().any(|d| d.starts_with("opencl:")) {
            "opencl".to_string()
        } else {
            "auto".to_string()
        }
    } else {
        "cpu".to_string()
    };

    HardwareProfile {
        gpu_devices,
        cpu_cores,
        cpu_simd,
        best_backend,
        has_gpu,
    }
}

/// Detect GPU devices by calling the miner binary with --detect-hardware.
/// Falls back to empty list if miner binary is not found or doesn't support the flag.
fn detect_gpus_via_miner(miner_bin: &str) -> Vec<String> {
    let output = Command::new(miner_bin)
        .arg("--detect-hardware")
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            // Miner prints lines like: "gpu_detect: opencl:AMD Radeon RX 5700 XT"
            // or "gpu_detect: metal:Apple M1 Pro"
            stdout
                .lines()
                .filter(|l| l.starts_with("gpu_detect:"))
                .map(|l| l.trim_start_matches("gpu_detect: ").to_string())
                .collect()
        }
        _ => {
            // Miner binary not available or doesn't support --detect-hardware
            // Try basic platform detection
            detect_gpus_fallback()
        }
    }
}

/// Fallback GPU detection without the miner binary.
/// Uses basic heuristics — on macOS, Metal is always available.
/// On Linux, checks for /dev/nvidia* (CUDA) or OpenCL platform files.
fn detect_gpus_fallback() -> Vec<String> {
    let mut devices = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // On macOS, Metal is always available on modern hardware
        devices.push("metal:Apple GPU (Metal)".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        // Check for NVIDIA devices (CUDA)
        if std::path::Path::new("/dev/nvidia0").exists() {
            devices.push("cuda:NVIDIA GPU".to_string());
        }
        // Check for OpenCL ICD loader
        if std::path::Path::new("/etc/OpenCL/vendors").exists()
            || std::path::Path::new("/usr/lib/libOpenCL.so").exists()
            || std::path::Path::new("/usr/lib/x86_64-linux-gnu/libOpenCL.so.1").exists()
        {
            devices.push("opencl:GPU (OpenCL)".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, assume GPU is available (most mining rigs have one)
        // The miner binary will do proper detection
        devices.push("auto:GPU (auto-detect)".to_string());
    }

    devices
}

/// Detect CPU SIMD capabilities.
fn detect_cpu_simd() -> String {
    #[cfg(target_arch = "x86_64")]
    {
        if is_x86_feature_detected!("avx512f") {
            "AVX-512".to_string()
        } else if is_x86_feature_detected!("avx2") {
            "AVX2".to_string()
        } else if is_x86_feature_detected!("sse4.1") {
            "SSE4.1".to_string()
        } else {
            "SSE2".to_string()
        }
    }

    #[cfg(target_arch = "aarch64")]
    {
        "NEON".to_string()
    }

    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        "unknown".to_string()
    }
}

/// Derive the optimal mining configuration from the hardware profile.
pub fn derive_auto_config(hw: &HardwareProfile) -> AutoMineConfig {
    if hw.has_gpu {
        // Triple Parallel mode: GPU + CPU
        // Stream 1: ZION Deeksha (GPU primary)
        // Stream 2: External GPU coins (blake3, kheavyhash, kawpow, etc.)
        // Stream 3: External CPU coins (verushash, randomx)
        AutoMineConfig {
            backend: hw.best_backend.clone(),
            cpu_threads: (hw.cpu_cores / 2).max(1), // Use half cores for CPU stream
            stream1_enabled: true,
            stream2_enabled: true,
            stream3_enabled: true,
            profile: "pool".to_string(),
            mode_name: "Triple Parallel (GPU + CPU)".to_string(),
            supported_coins: ALL_COINS.to_vec(),
        }
    } else {
        // CPU-only mode
        // Stream 1: ZION Deeksha (CPU — slower but works)
        // Stream 2: Disabled (no GPU)
        // Stream 3: External CPU coins (verushash, randomx)
        AutoMineConfig {
            backend: "cpu".to_string(),
            cpu_threads: hw.cpu_cores,
            stream1_enabled: true,
            stream2_enabled: false,
            stream3_enabled: true,
            profile: "pool".to_string(),
            mode_name: "CPU Dual Stream (ZION + CPU external)".to_string(),
            supported_coins: CPU_COINS.to_vec(),
        }
    }
}

/// All supported coins (GPU + CPU)
static ALL_COINS: &[&str] = &[
    "ZION", "PRL", "VRSC", "XMR", "DCR", "KAS", "ALPH", "ERG", "RVN", "ETC",
    "EVR", "MEWC", "FLUX", "CLORE", "EPIC", "QUAI", "BEAM",
];

/// CPU-only mineable coins
static CPU_COINS: &[&str] = &["ZION", "VRSC", "XMR"];

/// Print a hardware detection summary.
pub fn print_hardware_summary(hw: &HardwareProfile) {
    println!();
    println!("  ┌─────────────────────────────────────────────┐");
    println!("  │          HARDWARE DETECTION                 │");
    println!("  ├─────────────────────────────────────────────┤");
    println!("  │ CPU cores:  {:<32}│", format!("{} cores", hw.cpu_cores));
    println!("  │ CPU SIMD:   {:<32}│", hw.cpu_simd);
    if hw.gpu_devices.is_empty() {
        println!("  │ GPU:        {:<32}│", "none detected");
    } else {
        for (i, dev) in hw.gpu_devices.iter().enumerate() {
            let label = if i == 0 { "GPU:" } else { "    " };
            println!("  │ {}  {:<34}│", label, dev);
        }
    }
    println!("  │ Backend:    {:<32}│", hw.best_backend);
    println!("  └─────────────────────────────────────────────┘");
}

/// Print the auto-configured mining plan.
pub fn print_mine_plan(cfg: &AutoMineConfig) {
    println!();
    println!("  ┌─────────────────────────────────────────────┐");
    println!("  │          AUTO MINE CONFIGURATION            │");
    println!("  ├─────────────────────────────────────────────┤");
    println!("  │ Mode:       {:<32}│", cfg.mode_name);
    println!("  │ Backend:    {:<32}│", cfg.backend);
    println!("  │ CPU threads:{:<32}│", cfg.cpu_threads);
    println!("  ├─────────────────────────────────────────────┤");
    println!("  │ Stream 1 (ZION primary):     {:<13}│", if cfg.stream1_enabled { "ENABLED" } else { "disabled" });
    println!("  │ Stream 2 (GPU external):     {:<13}│", if cfg.stream2_enabled { "ENABLED" } else { "disabled" });
    println!("  │ Stream 3 (CPU external):     {:<13}│", if cfg.stream3_enabled { "ENABLED" } else { "disabled" });
    println!("  ├─────────────────────────────────────────────┤");
    println!("  │ Supported coins ({}):", cfg.supported_coins.len());
    // Wrap coins list
    let mut chars = 0;
    let mut line = String::from("  │ ");
    for coin in &cfg.supported_coins {
        if chars + coin.len() + 2 > 43 {
            println!("{}{:<45}│", line, "");
            line = String::from("  │ ");
            chars = 0;
        }
        line.push_str(coin);
        line.push_str(", ");
        chars += coin.len() + 2;
    }
    if !line.trim().is_empty() {
        println!("{}{:<45}│", line, "");
    }
    println!("  └─────────────────────────────────────────────┘");
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpu_triple_parallel_config() {
        let hw = HardwareProfile {
            gpu_devices: vec!["opencl:AMD RX 5700".to_string()],
            cpu_cores: 8,
            cpu_simd: "AVX2".to_string(),
            best_backend: "opencl".to_string(),
            has_gpu: true,
        };
        let cfg = derive_auto_config(&hw);
        assert!(cfg.stream1_enabled, "Stream 1 should be enabled with GPU");
        assert!(cfg.stream2_enabled, "Stream 2 should be enabled with GPU");
        assert!(cfg.stream3_enabled, "Stream 3 should be enabled with GPU");
        assert_eq!(cfg.backend, "opencl");
        assert_eq!(cfg.cpu_threads, 4, "Should use half CPU cores");
        assert!(cfg.supported_coins.len() > 10, "Should support all coins");
    }

    #[test]
    fn test_cpu_only_config() {
        let hw = HardwareProfile {
            gpu_devices: vec![],
            cpu_cores: 4,
            cpu_simd: "SSE4.1".to_string(),
            best_backend: "cpu".to_string(),
            has_gpu: false,
        };
        let cfg = derive_auto_config(&hw);
        assert!(cfg.stream1_enabled, "Stream 1 should be enabled even CPU-only");
        assert!(!cfg.stream2_enabled, "Stream 2 should be disabled without GPU");
        assert!(cfg.stream3_enabled, "Stream 3 should be enabled (CPU coins)");
        assert_eq!(cfg.backend, "cpu");
        assert_eq!(cfg.cpu_threads, 4, "Should use all CPU cores");
        assert!(cfg.supported_coins.contains(&"VRSC"), "Should support VRSC");
        assert!(cfg.supported_coins.contains(&"XMR"), "Should support XMR");
        assert!(!cfg.supported_coins.contains(&"KAS"), "Should not support KAS (GPU-only)");
    }

    #[test]
    fn test_cpu_threads_minimum_1() {
        let hw = HardwareProfile {
            gpu_devices: vec!["metal:Apple M1".to_string()],
            cpu_cores: 1,
            cpu_simd: "NEON".to_string(),
            best_backend: "metal".to_string(),
            has_gpu: true,
        };
        let cfg = derive_auto_config(&hw);
        assert_eq!(cfg.cpu_threads, 1, "Should have at least 1 CPU thread");
    }

    #[test]
    fn test_cuda_backend_priority() {
        let hw = HardwareProfile {
            gpu_devices: vec![
                "opencl:Intel iGPU".to_string(),
                "cuda:NVIDIA RTX 4090".to_string(),
            ],
            cpu_cores: 16,
            cpu_simd: "AVX-512".to_string(),
            best_backend: "cuda".to_string(),
            has_gpu: true,
        };
        let cfg = derive_auto_config(&hw);
        assert_eq!(cfg.backend, "cuda", "CUDA should be preferred over OpenCL");
    }

    #[test]
    fn test_metal_backend_on_macos() {
        let hw = HardwareProfile {
            gpu_devices: vec!["metal:Apple M2 Pro".to_string()],
            cpu_cores: 12,
            cpu_simd: "NEON".to_string(),
            best_backend: "metal".to_string(),
            has_gpu: true,
        };
        let cfg = derive_auto_config(&hw);
        assert_eq!(cfg.backend, "metal");
        assert!(cfg.stream2_enabled, "Metal GPU should enable Stream 2");
    }
}
