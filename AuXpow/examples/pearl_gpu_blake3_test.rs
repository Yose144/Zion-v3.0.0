//! Verify GPU-native BLAKE3 chunk hashing matches CPU BLAKE3 (tree mode, no ROOT).

#[cfg(feature = "gpu-metal")]
fn main() {
    use blake3::hazmat::HasherExt;
    use zion_auxpow::gpu_metal::MetalBackend;

    let mut gpu = MetalBackend::new(262144).expect("Metal backend");

    println!("=== GPU vs CPU BLAKE3 Chunk Hash Verification (tree mode) ===\n");

    // Test 1: All zeros
    let chunk1 = [0u8; 1024];
    let key1 = [0x42u8; 32];

    let mut hasher1 = blake3::Hasher::new_keyed(&key1);
    hasher1.update(&chunk1);
    let cpu_cv1 = hasher1.finalize_non_root();

    let gpu_cv1 = gpu.test_blake3_chunk_hash(&chunk1, &key1).expect("GPU");

    println!("Test 1: All zeros, key=0x42");
    println!("  CPU: {:02x?}", &cpu_cv1[..8]);
    println!("  GPU: {:02x?}", &gpu_cv1[..8]);
    println!("  Match: {}", cpu_cv1 == gpu_cv1);
    println!();

    // Test 2: Sequential bytes
    let mut chunk2 = [0u8; 1024];
    for i in 0..1024 {
        chunk2[i] = (i % 256) as u8;
    }
    let key2 = [0xAAu8; 32];

    let mut hasher2 = blake3::Hasher::new_keyed(&key2);
    hasher2.update(&chunk2);
    let cpu_cv2 = hasher2.finalize_non_root();

    let gpu_cv2 = gpu.test_blake3_chunk_hash(&chunk2, &key2).expect("GPU");

    println!("Test 2: Sequential bytes, key=0xAA");
    println!("  CPU: {:02x?}", &cpu_cv2[..8]);
    println!("  GPU: {:02x?}", &gpu_cv2[..8]);
    println!("  Match: {}", cpu_cv2 == gpu_cv2);
    println!();

    // Test 3: Pseudo-random
    let mut chunk3 = [0u8; 1024];
    for i in 0..1024 {
        chunk3[i] = ((i * 7 + 13) % 256) as u8;
    }
    let mut key3 = [0u8; 32];
    for i in 0..32 {
        key3[i] = ((i * 3 + 1) % 256) as u8;
    }

    let mut hasher3 = blake3::Hasher::new_keyed(&key3);
    hasher3.update(&chunk3);
    let cpu_cv3 = hasher3.finalize_non_root();

    let gpu_cv3 = gpu.test_blake3_chunk_hash(&chunk3, &key3).expect("GPU");

    println!("Test 3: Pseudo-random data and key");
    println!("  CPU: {:02x?}", &cpu_cv3[..8]);
    println!("  GPU: {:02x?}", &gpu_cv3[..8]);
    println!("  Match: {}", cpu_cv3 == gpu_cv3);
    println!();

    let all_match = cpu_cv1 == gpu_cv1 && cpu_cv2 == gpu_cv2 && cpu_cv3 == gpu_cv3;
    println!(
        "=== Overall: {} ===",
        if all_match {
            "ALL TESTS PASSED"
        } else {
            "SOME TESTS FAILED"
        }
    );
}

#[cfg(not(feature = "gpu-metal"))]
fn main() {
    eprintln!("Requires gpu-metal feature.");
}
