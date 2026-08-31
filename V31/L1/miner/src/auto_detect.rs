//! Hardware auto-detection and stream auto-configuration.
//!
//! Detects CPU architecture, GPU devices (CUDA/OpenCL/Metal), system memory,
//! and derives the optimal Trinity mining configuration:
//!
//! - **GPU detected** → Triple Parallel: Stream 1 (ZION GPU) + Stream 2 (BOOST 1) + Stream 3 (BOOST 2)
//! - **CPU-only** → Dual Stream: Stream 1 (ZION CPU) + Stream 3 (BOOST 2)
//!
//! All decisions can be overridden with env vars:
//! - `ZION_GPU_BACKEND` — force backend (cuda/opencl/metal/cpu)
//! - `ZION_STREAM1_ENABLED` / `ZION_STREAM2_ENABLED` / `ZION_STREAM3_ENABLED`
//! - `ZION_EXT_CPU_THREADS` / `ZION_EXT_CPU_NONCE_COUNT`
//! - `ZION_NONCE_COUNT` / `ZION_STREAM2_BATCH`

use crate::gpu::{self, AutoTuneResult, GpuBackendKind};

/// Hardware profile detected at startup.
#[derive(Clone, Debug)]
pub struct HardwareProfile {
    pub cpu_vendor: String,
    pub cpu_model: String,
    pub cpu_physical_cores: usize,
    pub cpu_logical_cores: usize,
    pub cpu_arch: gpu::CpuArch,
    pub cpu_simd: Vec<&'static str>,
    pub gpu_devices: Vec<GpuSummary>,
    pub gpu_backend: GpuBackendKind,
    pub has_gpu: bool,
    pub sys_ram_bytes: u64,
}

#[derive(Clone, Debug)]
pub struct GpuSummary {
    pub name: String,
    pub backend: String,
    pub compute_units: u32,
    pub vram_mb: u64,
}

/// Auto-derived mining configuration based on hardware.
#[derive(Clone, Debug)]
pub struct AutoMineConfig {
    /// "Triple Parallel (GPU + CPU)" or "CPU Dual Stream"
    pub mode_name: String,
    /// Resolved GPU backend kind
    pub gpu_backend: GpuBackendKind,
    /// GPU work size for ZION deeksha (Stream 1)
    pub gpu_work_size: usize,
    /// GPU work size for Stream 2 (ProgPoW/KawPow)
    pub secondary_gpu_work_size: usize,
    /// CPU threads for ZION Stream 1 (CPU fallback)
    pub miner_threads: usize,
    /// CPU threads for VRSC Stream 3
    pub ext_cpu_threads: usize,
    /// VRSC nonce batch
    pub verushash_nonce_count: u64,
    /// ZION nonce batch
    pub zion_nonce_batch: u64,
    /// Stream 2 nonce batch
    pub stream2_batch: u64,
    pub stream1_enabled: bool,
    pub stream2_enabled: bool,
    pub stream3_enabled: bool,
}

/// Detect CPU SIMD features at runtime.
fn detect_cpu_simd() -> Vec<&'static str> {
    let mut features = Vec::new();

    #[cfg(target_arch = "x86_64")]
    {
        if std::is_x86_feature_detected!("aes") {
            features.push("AES-NI");
        }
        if std::is_x86_feature_detected!("sse4.1") {
            features.push("SSE4.1");
        }
        if std::is_x86_feature_detected!("sse4.2") {
            features.push("SSE4.2");
        }
        if std::is_x86_feature_detected!("avx") {
            features.push("AVX");
        }
        if std::is_x86_feature_detected!("avx2") {
            features.push("AVX2");
        }
        if std::is_x86_feature_detected!("bmi1") {
            features.push("BMI1");
        }
        if std::is_x86_feature_detected!("bmi2") {
            features.push("BMI2");
        }
        if std::is_x86_feature_detected!("fma") {
            features.push("FMA");
        }
        if std::is_x86_feature_detected!("pclmulqdq") {
            features.push("PCLMULQDQ");
        }
        if std::is_x86_feature_detected!("avx512f") {
            features.push("AVX-512");
        }
    }

    #[cfg(target_arch = "aarch64")]
    {
        features.push("NEON");
        if std::arch::is_aarch64_feature_detected!("aes") {
            features.push("AES");
        }
        if std::arch::is_aarch64_feature_detected!("sha2") {
            features.push("SHA2");
        }
    }

    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        features.push("unknown");
    }

    features
}

/// Detect all hardware and return a profile.
pub fn detect_hardware() -> HardwareProfile {
    let tune = gpu::auto_tune_work_sizes();

    // Query GPU details
    let gpu_infos = gpu::query_gpu_details();
    let mut gpu_devices: Vec<GpuSummary> = gpu_infos
        .iter()
        .map(|g| GpuSummary {
            name: g.name.clone(),
            backend: g.platform.clone(),
            compute_units: g.compute_units,
            vram_mb: g.global_mem_bytes / (1024 * 1024),
        })
        .collect();

    // Also check detect_gpus() for CUDA devices not in OpenCL
    let detected_names = gpu::detect_gpus();
    if gpu_devices.is_empty() && !detected_names.is_empty() {
        for name in &detected_names {
            let (backend, dev_name) = name.split_once(':').unwrap_or(("unknown", name));
            gpu_devices.push(GpuSummary {
                name: dev_name.to_string(),
                backend: backend.to_string(),
                compute_units: 0,
                vram_mb: 0,
            });
        }
    }

    let has_gpu = !gpu_devices.is_empty();
    let gpu_backend = if has_gpu {
        gpu::resolve_auto_backend()
    } else {
        GpuBackendKind::Cpu
    };

    let cpu_simd = detect_cpu_simd();

    HardwareProfile {
        cpu_vendor: tune.cpu_vendor.clone(),
        cpu_model: tune.cpu_model.clone(),
        cpu_physical_cores: tune.cpu_physical_cores,
        cpu_logical_cores: tune.cpu_cores,
        cpu_arch: classify_cpu_public(&tune.cpu_vendor, &tune.cpu_model),
        cpu_simd,
        gpu_devices,
        gpu_backend,
        has_gpu,
        sys_ram_bytes: tune.sys_ram_bytes,
    }
}

/// Public wrapper for classify_cpu (which is private in gpu/mod.rs).
fn classify_cpu_public(vendor: &str, model: &str) -> gpu::CpuArch {
    let v = vendor.to_ascii_lowercase();
    let m = model.to_ascii_lowercase();

    if v.contains("apple") || m.contains("apple") {
        return gpu::CpuArch::AppleSilicon;
    }
    if v.contains("amd") || v.contains("authenticamd") {
        return gpu::CpuArch::AmdZen;
    }
    if v.contains("intel") || v.contains("genuineintel") {
        // Check for Atom/Celeron (low-power)
        if m.contains("atom") || m.contains("celeron") || m.contains("pentium") {
            return gpu::CpuArch::Other;
        }
        return gpu::CpuArch::IntelCore;
    }
    gpu::CpuArch::Other
}

/// Derive the optimal mining configuration from the hardware profile
/// and the auto-tune result.
pub fn derive_auto_config(hw: &HardwareProfile, tune: &AutoTuneResult) -> AutoMineConfig {
    if hw.has_gpu {
        // Triple Parallel: GPU + CPU
        // Stream 1: ZION Deeksha (GPU primary, CPU fallback)
        // Stream 2: ZANO / external GPU coin (GPU)
        // Stream 3: VRSC / external CPU coin (CPU VerusHash)
        let mode_name = format!(
            "Triple Parallel ({} + CPU)",
            backend_display(hw.gpu_backend)
        );

        AutoMineConfig {
            mode_name,
            gpu_backend: hw.gpu_backend,
            gpu_work_size: tune.gpu_work_size,
            secondary_gpu_work_size: tune.secondary_gpu_work_size,
            miner_threads: (hw.cpu_logical_cores / 2).max(1),
            ext_cpu_threads: tune.threads,
            verushash_nonce_count: tune.verushash_nonce_count,
            zion_nonce_batch: 1_048_576, // 1M — good for GPU
            stream2_batch: tune.secondary_gpu_work_size as u64,
            stream1_enabled: true,
            stream2_enabled: true,
            stream3_enabled: true,
        }
    } else {
        // CPU-only: Dual Stream
        // Stream 1: ZION Deeksha (CPU)
        // Stream 2: Disabled (no GPU)
        // Stream 3: VRSC (CPU VerusHash)
        #[cfg(feature = "public_build")]
        let mode_name = "CPU Dual Stream (ZION + BOOST)".to_string();
        #[cfg(not(feature = "public_build"))]
        let mode_name = "CPU Dual Stream (ZION + VRSC)".to_string();
        AutoMineConfig {
            mode_name,
            gpu_backend: GpuBackendKind::Cpu,
            gpu_work_size: 1 << 18, // 256K
            secondary_gpu_work_size: 0,
            miner_threads: hw.cpu_physical_cores,
            ext_cpu_threads: tune.threads,
            verushash_nonce_count: tune.verushash_nonce_count,
            zion_nonce_batch: 65_536, // 64K — smaller for CPU
            stream2_batch: 0,
            stream1_enabled: true,
            stream2_enabled: false,
            stream3_enabled: true,
        }
    }
}

fn backend_display(kind: GpuBackendKind) -> &'static str {
    match kind {
        GpuBackendKind::Cuda => "CUDA",
        GpuBackendKind::OpenCL => "OpenCL",
        GpuBackendKind::Metal => "Metal",
        GpuBackendKind::Cpu => "CPU",
        GpuBackendKind::Auto => "Auto",
    }
}

fn arch_display(arch: &gpu::CpuArch) -> &'static str {
    match arch {
        gpu::CpuArch::AmdZen => "AMD Zen",
        gpu::CpuArch::IntelCore => "Intel Core",
        gpu::CpuArch::AppleSilicon => "Apple Silicon",
        gpu::CpuArch::Other => "Other",
    }
}

fn format_ram(bytes: u64) -> String {
    let gb = bytes as f64 / (1024.0 * 1024.0 * 1024.0);
    if gb >= 1.0 {
        format!("{:.0} GB", gb)
    } else {
        let mb = bytes / (1024 * 1024);
        format!("{} MB", mb)
    }
}

fn format_vram(mb: u64) -> String {
    if mb >= 1024 {
        format!("{:.0} GB", mb as f64 / 1024.0)
    } else {
        format!("{} MB", mb)
    }
}

/// Print a clean, professional hardware detection summary.
pub fn print_hardware_summary(hw: &HardwareProfile) {
    eprintln!();
    eprintln!("  ╔══════════════════════════════════════════════════════════╗");
    eprintln!("  ║          ZION MINER — HARDWARE DETECTION                 ║");
    eprintln!("  ╠══════════════════════════════════════════════════════════╣");
    eprintln!("  ║  CPU:  {:<50}║", truncate(&hw.cpu_model, 50));
    eprintln!(
        "  ║        cores={}/{} arch={} ram={:<20}║",
        hw.cpu_physical_cores,
        hw.cpu_logical_cores,
        arch_display(&hw.cpu_arch),
        format_ram(hw.sys_ram_bytes)
    );
    eprintln!(
        "  ║        SIMD: {}",
        if hw.cpu_simd.is_empty() {
            "none".to_string()
        } else {
            hw.cpu_simd.join(", ")
        }
    );
    eprintln!("  ╠══════════════════════════════════════════════════════════╣");
    if hw.gpu_devices.is_empty() {
        eprintln!("  ║  GPU:  none detected                                     ║");
        eprintln!("  ║  Mode: CPU-only mining                                   ║");
    } else {
        for (i, dev) in hw.gpu_devices.iter().enumerate() {
            let label = if i == 0 { "GPU:" } else { "    " };
            eprintln!("  ║  {} {:<44} ║", label, truncate(&dev.name, 44));
            eprintln!(
                "  ║        backend={} CUs={} VRAM={:<24} ║",
                dev.backend,
                dev.compute_units,
                format_vram(dev.vram_mb)
            );
        }
        eprintln!(
            "  ║  Backend: {}                                            ║",
            backend_display(hw.gpu_backend)
        );
    }
    eprintln!("  ╚══════════════════════════════════════════════════════════╝");
}

/// Print the auto-configured mining plan.
pub fn print_mine_plan(cfg: &AutoMineConfig) {
    eprintln!();
    eprintln!("  ╔══════════════════════════════════════════════════════════╗");
    eprintln!("  ║          ZION MINER — AUTO MINE CONFIGURATION            ║");
    eprintln!("  ╠══════════════════════════════════════════════════════════╣");
    eprintln!("  ║  Mode:    {:<47}║", truncate(&cfg.mode_name, 47));
    eprintln!("  ║  Backend: {:<47}║", backend_display(cfg.gpu_backend));
    eprintln!("  ╠══════════════════════════════════════════════════════════╣");
    eprintln!(
        "  ║  Stream 1 (ZION):     {:<34} ║",
        stream_status(
            cfg.stream1_enabled,
            &format!("threads={}", cfg.miner_threads)
        )
    );
    #[cfg(feature = "public_build")]
    let stream2_label = "Stream 2 (BOOST 1)";
    #[cfg(not(feature = "public_build"))]
    let stream2_label = "Stream 2 (ZANO GPU)";
    eprintln!(
        "  ║  {}: {:<34} ║",
        stream2_label,
        stream_status(
            cfg.stream2_enabled,
            &format!("batch={}", format_batch(cfg.stream2_batch))
        )
    );
    #[cfg(feature = "public_build")]
    let stream3_label = "Stream 3 (BOOST 2)";
    #[cfg(not(feature = "public_build"))]
    let stream3_label = "Stream 3 (VRSC CPU)";
    eprintln!(
        "  ║  {}: {:<34} ║",
        stream3_label,
        stream_status(
            cfg.stream3_enabled,
            &format!(
                "threads={} batch={}",
                cfg.ext_cpu_threads,
                format_batch(cfg.verushash_nonce_count)
            )
        )
    );
    eprintln!("  ╠══════════════════════════════════════════════════════════╣");
    eprintln!("  ║  Overrides: ZION_GPU_BACKEND, ZION_EXT_CPU_THREADS,      ║");
    eprintln!("  ║             ZION_EXT_CPU_NONCE_COUNT, ZION_NONCE_COUNT,  ║");
    eprintln!("  ║             ZION_STREAM{{1,2,3}}_ENABLED                   ║");
    eprintln!("  ╚══════════════════════════════════════════════════════════╝");
    eprintln!();
}

fn stream_status(enabled: bool, detail: &str) -> String {
    if enabled {
        format!("ENABLED  ({})", detail)
    } else {
        "disabled".to_string()
    }
}

fn format_batch(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{}M", n / 1_000_000)
    } else if n >= 1_000 {
        format!("{}K", n / 1_000)
    } else {
        n.to_string()
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}…", &s[..max - 1])
    }
}

/// Run full hardware detection and print summary + mine plan.
/// Returns the auto-derived config.
pub fn run_auto_detect() -> (HardwareProfile, AutoMineConfig) {
    let hw = detect_hardware();
    let tune = gpu::auto_tune_work_sizes();
    let cfg = derive_auto_config(&hw, &tune);

    print_hardware_summary(&hw);
    print_mine_plan(&cfg);

    (hw, cfg)
}
