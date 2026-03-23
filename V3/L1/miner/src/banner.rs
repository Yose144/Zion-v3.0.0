//! Startup banner with hardware detection and version info.

/// Print the startup banner with version, consensus, and hardware info.
pub fn print_banner(threads: usize) {
    println!("╔══════════════════════════════════════════════╗");
    println!("║          ZION v3 Miner — Ekam Deeksha        ║");
    println!("╚══════════════════════════════════════════════╝");
    println!();

    // Version + consensus
    println!("version=3.0.0-dev");
    println!("consensus={}", zion_core::consensus_profile());
    println!(
        "protocol_version={}",
        zion_pool::protocol_version()
    );

    // CPU info
    let logical_cpus = num_cpus::get();
    let physical_cpus = num_cpus::get_physical();
    println!(
        "cpu_cores={} logical={} mining_threads={}",
        physical_cpus, logical_cpus, threads
    );

    // SIMD detection
    print!("simd=");
    let mut simd_caps = Vec::new();
    #[cfg(target_arch = "x86_64")]
    {
        if is_x86_feature_detected!("avx512f") {
            simd_caps.push("AVX-512");
        }
        if is_x86_feature_detected!("avx2") {
            simd_caps.push("AVX2");
        }
        if is_x86_feature_detected!("sse4.1") {
            simd_caps.push("SSE4.1");
        }
        if is_x86_feature_detected!("aes") {
            simd_caps.push("AES-NI");
        }
    }
    #[cfg(target_arch = "aarch64")]
    {
        simd_caps.push("NEON");
        #[cfg(target_feature = "crypto")]
        simd_caps.push("AES");
    }
    if simd_caps.is_empty() {
        println!("none");
    } else {
        println!("{}", simd_caps.join(","));
    }

    // GPU detection
    #[cfg(any(feature = "gpu-opencl", feature = "gpu-cuda", feature = "gpu-metal"))]
    {
        let gpus = crate::gpu_backend::detect_gpus();
        if gpus.is_empty() {
            println!("gpu=none");
        } else {
            for (i, gpu) in gpus.iter().enumerate() {
                println!("gpu[{i}]={gpu}");
            }
        }
    }
    #[cfg(not(any(feature = "gpu-opencl", feature = "gpu-cuda", feature = "gpu-metal")))]
    {
        println!("gpu=disabled (compile with --features gpu-opencl)");
    }

    // Backend selection
    let backend = crate::gpu_backend::GpuBackendKind::from_env();
    println!("backend={}", backend.as_str());

    println!();
}
