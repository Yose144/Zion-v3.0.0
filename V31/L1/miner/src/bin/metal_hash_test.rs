//! Metal ↔ CPU hash comparison test for EkamDeeksha v3.2.
//!
//! Mines a single batch on Metal GPU with an easy target, then compares
//! the GPU hash against the CPU reference for the same nonce.

use zion_miner::gpu::{create_gpu_backend, GpuBackendKind};
use zion_core::{MiningHeader, V3DifficultyTarget};
use zion_cosmic_harmony::algorithm::ekam_deeksha::EkamDeeksha;

fn main() {
    let header = MiningHeader {
        version: 3,
        previous_hash: [0xAA; 32],
        merkle_root: [0xBB; 32],
        timestamp: 1_762_000_200,
        difficulty_bits: 0x1f00ffff,
    };
    let header_bytes = header.to_bytes();

    // Easy target: first 4 bytes = 0xFFFFFFFF (every nonce passes)
    let target = V3DifficultyTarget { bytes: [0xFF; 32] };

    let mut miner = create_gpu_backend(GpuBackendKind::Metal, 256, "ekam_deeksha", "")
        .expect("Metal init failed");

    println!("Device: {}", miner.device_name());
    println!("Header: {}", hex::encode(header_bytes));
    println!();

    // Mine a small batch — every nonce should pass with 0xFF target
    let batch_size = 4u64;
    let result = miner
        .mine_batch(header, target, 0, batch_size)
        .expect("mine_batch failed");

    println!("GPU batch result: {} solutions, {} nonces tested",
             result.solutions.len(), result.nonces_tested);

    if result.solutions.is_empty() {
        eprintln!("ERROR: No solutions found with 0xFF target — GPU kernel bug!");
        std::process::exit(1);
    }

    let (gpu_nonce, gpu_hash, _) = result.solutions[0];
    let gpu_hex: String = gpu_hash.iter().map(|b| format!("{:02x}", b)).collect();

    // CPU reference hash for the same nonce
    let cpu_hash = EkamDeeksha::hash_bytes(&header_bytes, gpu_nonce);
    let cpu_hex: String = cpu_hash.iter().map(|b| format!("{:02x}", b)).collect();

    println!("Nonce: {}", gpu_nonce);
    println!("GPU hash: {}", gpu_hex);
    println!("CPU hash: {}", cpu_hex);
    println!();

    if gpu_hex == cpu_hex {
        println!("=== PASS: Metal GPU hash matches CPU hash ===");
        std::process::exit(0);
    } else {
        println!("=== FAIL: Metal GPU hash does NOT match CPU hash ===");

        // Also check step 1 (Keccak256) separately
        use sha3::{Digest, Keccak256};
        let mut input88 = [0u8; 88];
        let hlen = header_bytes.len().min(80);
        input88[..hlen].copy_from_slice(&header_bytes[..hlen]);
        input88[80..88].copy_from_slice(&gpu_nonce.to_le_bytes());
        let cpu_s1: [u8; 32] = Keccak256::digest(input88).into();
        let cpu_s1_hex: String = cpu_s1.iter().map(|b| format!("{:02x}", b)).collect();
        println!("CPU s1 (Keccak256): {}", cpu_s1_hex);

        std::process::exit(1);
    }
}
