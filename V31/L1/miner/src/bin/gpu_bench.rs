use zion_miner::gpu::{create_gpu_backend, GpuBackendKind, GpuMiner};

fn main() {
    let work_size = std::env::var("ZION_GPU_WORK_SIZE")
        .ok().and_then(|v| v.parse().ok()).unwrap_or(2048);
    let backend = std::env::var("ZION_GPU_BACKEND").unwrap_or_default();
    let kind = match backend.as_str() {
        "metal" => GpuBackendKind::Metal,
        "opencl" => GpuBackendKind::OpenCL,
        "cuda" => GpuBackendKind::Cuda,
        _ => {
            #[cfg(target_os = "macos")]
            { GpuBackendKind::Metal }
            #[cfg(not(target_os = "macos"))]
            { GpuBackendKind::Cuda }
        }
    };
    let mut miner = create_gpu_backend(kind, work_size, "deeksha_lite_v1", "")
        .expect("GPU init failed");
    println!("Device: {}", miner.device_name());
    println!("Running 10-second benchmark with work_size={}...", work_size);
    let (total, elapsed, khps) = miner.benchmark(10.0).expect("benchmark failed");
    println!("Result: {} nonces in {:.2}s = {:.2} KH/s ({:.2} MH/s)",
             total, elapsed, khps, khps / 1000.0);
}
