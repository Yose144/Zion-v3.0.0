//! CPU↔GPU bit-identical verification for Ekam Deeksha v3.2 (512 KiB scratchpad).
//!
//! Runs the CUDA `ekam_deeksha_debug` kernel for known nonces and compares
//! the output hash against the CPU KAT vectors from `ekam_deeksha.rs`.

#[cfg(feature = "gpu-cuda")]
use zion_cosmic_harmony::algorithm::ekam_deeksha::{EkamDeeksha, LITE_KAT, LITE_KAT_HEADER};
#[cfg(feature = "gpu-cuda")]
use sha3::{Digest, Keccak256, Sha3_512};

#[cfg(feature = "gpu-cuda")]
fn main() {
    use cudarc::driver::{CudaDevice, LaunchAsync, LaunchConfig};
    use cudarc::nvrtc::{compile_ptx_with_opts, CompileOptions};

    // ── Compile the CUDA kernel ──
    let kernel_src = include_str!("../gpu/kernels/cuda/ekam_deeksha.cu");
    let dev = CudaDevice::new(0).expect("CUDA device init failed");
    let arch = "compute_61".to_string();
    let opts = vec![
        "--use_fast_math".to_string(),
        format!("-arch={}", arch),
        "--std=c++14".to_string(),
        "-lineinfo".to_string(),
        "--ptxas-options=-O3".to_string(),
    ];
    let ptx = compile_ptx_with_opts(
        kernel_src,
        CompileOptions {
            options: opts,
            ..Default::default()
        },
    )
    .expect("NVRTC compile failed");
    dev.load_ptx(ptx, "ekam_deeksha", &["ekam_deeksha_debug"])
        .expect("PTX load failed");

    // ── Precompute Keccak state from KAT header ──
    // The GPU kernel expects the raw Keccak state after absorbing the first 80
    // bytes of the header (XOR only, no permutation — 80 < 136 byte rate).
    // The kernel itself XORs the nonce at st[10], adds 0x01 padding at st[11],
    // 0x80 at st[16], then runs keccak_f1600.
    // We must NOT add padding here — the kernel does it.
    let header = LITE_KAT_HEADER; // b"ZION_LITE_KAT_V1" (16 bytes, padded to 80 by zeros)
    let mut state = [0u64; 25];
    for (i, &b) in header.iter().enumerate() {
        let word_idx = i / 8;
        let shift = (i % 8) * 8;
        state[word_idx] ^= (b as u64) << shift;
    }

    // Upload state
    let state_buf = dev.htod_copy(state.to_vec()).expect("state upload");
    let scratchpad_buf = dev
        .alloc_zeros::<u8>(524_288)
        .expect("scratchpad alloc");
    let output_buf = dev.alloc_zeros::<u8>(128).expect("output alloc");

    let func = dev
        .get_func("ekam_deeksha", "ekam_deeksha_debug")
        .expect("ekam_deeksha_debug not found");

    let mut all_ok = true;
    for (expected_hex, nonce) in LITE_KAT.iter() {
        // Launch debug kernel (1 thread, 1 block)
        let cfg = LaunchConfig {
            grid_dim: (1, 1, 1),
            block_dim: (1, 1, 1),
            shared_mem_bytes: 256, // for AES S-box shared memory
        };
        unsafe {
            func.clone()
                .launch(cfg, (&state_buf, *nonce, &output_buf, &scratchpad_buf))
                .expect("kernel launch");
        }
        dev.synchronize().expect("sync");

        let gpu_result: Vec<u8> = dev.dtoh_sync_copy(&output_buf).expect("download");
        let gpu_s1: String = gpu_result[0..32].iter().map(|b| format!("{:02x}", b)).collect();
        let gpu_hash: String = gpu_result[32..64].iter().map(|b| format!("{:02x}", b)).collect();
        let gpu_s2: String = gpu_result[64..96].iter().map(|b| format!("{:02x}", b)).collect();
        let gpu_s3: String = gpu_result[96..128].iter().map(|b| format!("{:02x}", b)).collect();

        // CPU reference
        let cpu_hash = EkamDeeksha::hash_bytes(header, *nonce);
        let cpu_hex: String = cpu_hash.iter().map(|b| format!("{:02x}", b)).collect();

        // CPU intermediate values
        // Step 1: Keccak256(header[0..80] || nonce_le)
        let mut input88 = [0u8; 88];
        let hlen = header.len().min(80);
        input88[..hlen].copy_from_slice(&header[..hlen]);
        input88[80..88].copy_from_slice(&(*nonce).to_le_bytes());
        let cpu_s1: [u8; 32] = Keccak256::digest(input88).into();

        // Step 2: memory-hard (simplified — just compute s2)
        let mut state64 = [0u8; 64];
        state64[..32].copy_from_slice(&cpu_s1);
        let mut scratchpad = vec![0u8; 524_288];
        let block_count = 16384usize;
        let block_size = 32usize;
        let random_reads = 128u64;
        let passes = 2usize;
        let mut inp65 = [0u8; 65];
        for blk in 0..block_count {
            inp65[..64].copy_from_slice(&state64);
            inp65[64] = (blk & 0xFF) as u8;
            let out = Sha3_512::digest(&inp65[..65]);
            let off = blk * block_size;
            scratchpad[off..off + 32].copy_from_slice(&out[..32]);
            state64[..32].copy_from_slice(&out[..32]);
        }
        // Forward pass
        for i in 0..block_count {
            let prev = if i == 0 { block_count - 1 } else { i - 1 };
            let (cur, prv) = (i * block_size, prev * block_size);
            for j in 0..block_size {
                let pv = scratchpad[prv + j];
                scratchpad[cur + j] ^= pv;
            }
        }
        // Backward pass
        if passes >= 2 {
            for i in (0..block_count).rev() {
                let next = if i + 1 == block_count { 0 } else { i + 1 };
                let (cur, nxt) = (i * block_size, next * block_size);
                for j in 0..block_size {
                    let nv = scratchpad[nxt + j];
                    scratchpad[cur + j] ^= nv;
                }
            }
        }
        // Random reads
        let mut acc = [0u8; 32];
        acc.copy_from_slice(&cpu_s1);
        let mut pos: usize = 0;
        for r in 0..random_reads {
            let off = pos * block_size;
            for i in 0..block_size {
                acc[i] ^= scratchpad[off + i];
            }
            let idx_val = u64::from_le_bytes(acc[0..8].try_into().unwrap()) ^ pos as u64 ^ r;
            pos = (idx_val % block_count as u64) as usize;
        }
        let cpu_s2 = acc;

        let cpu_s1_hex: String = cpu_s1.iter().map(|b| format!("{:02x}", b)).collect();
        let cpu_s2_hex: String = cpu_s2.iter().map(|b| format!("{:02x}", b)).collect();

        let gpu_matches_cpu = gpu_hash == cpu_hex;
        let cpu_matches_kat = cpu_hex == *expected_hex;
        let gpu_matches_kat = gpu_hash == *expected_hex;

        let status = if gpu_matches_kat { "✓ PASS" } else { "✗ FAIL" };
        if !gpu_matches_kat {
            all_ok = false;
        }

        println!(
            "nonce={:<20} {}",
            nonce,
            status,
        );
        println!("  KAT:  {}", expected_hex);
        println!("  CPU:  {} {}", cpu_hex, if cpu_matches_kat { "✓" } else { "✗" });
        println!("  GPU:  {} {}", gpu_hash, if gpu_matches_cpu { "✓" } else { "✗" });
        println!("  s1:   GPU={} CPU={} {}", gpu_s1, cpu_s1_hex, if gpu_s1 == cpu_s1_hex { "✓" } else { "✗" });
        println!("  s2:   GPU={} CPU={} {}", gpu_s2, cpu_s2_hex, if gpu_s2 == cpu_s2_hex { "✓" } else { "✗" });
        println!("  s3:   {}", gpu_s3);
        println!();
    }

    if all_ok {
        println!("\n=== ALL KAT VECTORS PASS — CPU↔GPU BIT-IDENTICAL ===");
        std::process::exit(0);
    } else {
        println!("\n=== KAT VERIFICATION FAILED ===");
        std::process::exit(1);
    }
}

#[cfg(not(feature = "gpu-cuda"))]
fn main() {
    eprintln!("This binary requires --features gpu-cuda");
    std::process::exit(1);
}
