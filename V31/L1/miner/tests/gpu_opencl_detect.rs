//! OpenCL GPU Go/No-Go verification.
//!
//! Run with:
//!   cargo test -p zion-miner --features gpu-opencl --test gpu_opencl_detect -- --ignored --nocapture
//!
//! A positive hashrate means the OpenCL backend successfully enumerated a GPU,
//! built the Deeksha kernel, and ran a 1-second benchmark.

#[cfg(feature = "gpu-opencl")]
#[test]
#[ignore = "requires an OpenCL GPU and kernel build"]
fn opencl_gpu_go_no_go() {
    use zion_miner::gpu::{GpuBackendKind, create_gpu_backend};

    let mut backend = create_gpu_backend(GpuBackendKind::Auto, 4096, "deeksha_lite_v1", "")
        .expect("OpenCL backend should enumerate and initialize a GPU");

    eprintln!(
        "opencl_go_no_go device={} algorithm={} backend={}",
        backend.device_name(),
        backend.algorithm(),
        backend.backend_kind().as_str(),
    );

    let (hashes, elapsed, khps) =
        backend.benchmark(1.0).expect("OpenCL benchmark should run");

    eprintln!(
        "opencl_go_no_go hashes={} elapsed={:.2}s khps={:.2}",
        hashes, elapsed, khps
    );

    assert!(
        khps > 0.0,
        "OpenCL benchmark produced zero hashrate — GPU kernel did not run"
    );
}
