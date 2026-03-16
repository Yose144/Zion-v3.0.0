/// DCR PoW hash: blake3(180-byte header) → 32 bytes (DCP-0011).
///
/// Fixed-size input lets the compiler elide bounds checks.
#[inline(always)]
pub fn dcr_hash(header: &[u8; 180]) -> [u8; 32] {
    *blake3::hash(header).as_bytes()
}

/// Fast target check — `hash <= target` (big-endian, 256-bit).
///
/// Compares as two u128 words instead of per-byte loop.
#[inline(always)]
pub fn hash_meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    let h_hi = u128::from_be_bytes([
        hash[0], hash[1], hash[2], hash[3], hash[4], hash[5], hash[6], hash[7],
        hash[8], hash[9], hash[10], hash[11], hash[12], hash[13], hash[14], hash[15],
    ]);
    let t_hi = u128::from_be_bytes([
        target[0], target[1], target[2], target[3], target[4], target[5], target[6], target[7],
        target[8], target[9], target[10], target[11], target[12], target[13], target[14], target[15],
    ]);
    if h_hi != t_hi {
        return h_hi < t_hi;
    }
    let h_lo = u128::from_be_bytes([
        hash[16], hash[17], hash[18], hash[19], hash[20], hash[21], hash[22], hash[23],
        hash[24], hash[25], hash[26], hash[27], hash[28], hash[29], hash[30], hash[31],
    ]);
    let t_lo = u128::from_be_bytes([
        target[16], target[17], target[18], target[19], target[20], target[21], target[22], target[23],
        target[24], target[25], target[26], target[27], target[28], target[29], target[30], target[31],
    ]);
    h_lo <= t_lo
}

/// DCR nonce position inside the 180-byte header.
pub const NONCE_OFFSET: usize = 140;

/// Convert stratum pool difficulty to 32-byte big-endian target.
///
/// diff1 = `0x00000000FFFF0000…(224 zero bits)`.
/// `pool_target = diff1 / difficulty`.
pub fn difficulty_to_target(difficulty: f64) -> [u8; 32] {
    if difficulty <= 0.0 || !difficulty.is_finite() {
        return [0xFF; 32];
    }

    let diff_u64 = difficulty.ceil().max(1.0) as u64;
    let words: [u64; 4] = [0x00000000FFFF0000, 0, 0, 0];
    let mut target = [0u8; 32];
    let mut remainder: u128 = 0;

    for i in 0..4 {
        let dividend = (remainder << 64) | (words[i] as u128);
        let q = (dividend / diff_u64 as u128) as u64;
        remainder = dividend % diff_u64 as u128;
        target[i * 8..(i + 1) * 8].copy_from_slice(&q.to_be_bytes());
    }

    target
}

/// Benchmark raw Blake3 hashing on a 180-byte header.
/// Returns (hashes, elapsed_secs, megahashes_per_sec).
pub fn bench_blake3(seconds: f64) -> (u64, f64, f64) {
    use std::time::Instant;

    let mut header = [0u8; 180];
    let target = [0u8; 32]; // impossible — pure throughput measurement
    let start = Instant::now();
    let mut count: u64 = 0;
    let mut nonce: u32 = 0;

    loop {
        for _ in 0..8192 {
            header[NONCE_OFFSET..NONCE_OFFSET + 4].copy_from_slice(&nonce.to_le_bytes());
            let hash = dcr_hash(&header);
            std::hint::black_box(hash_meets_target(&hash, &target));
            nonce = nonce.wrapping_add(1);
        }
        count += 8192;

        let elapsed = start.elapsed().as_secs_f64();
        if elapsed >= seconds {
            let mhps = (count as f64) / elapsed / 1_000_000.0;
            return (count, elapsed, mhps);
        }
    }
}

/// Benchmark with precomputed Hasher state (first 128 bytes cached).
/// Only recomputes the last 52-byte block per nonce.
pub fn bench_blake3_precompute(seconds: f64) -> (u64, f64, f64) {
    use std::time::Instant;

    let header = [0u8; 180];
    let target = [0u8; 32];

    // Pre-process the first 128 bytes (2 blake3 compression blocks)
    let mut base_hasher = blake3::Hasher::new();
    base_hasher.update(&header[..128]);

    // Tail contains bytes 128..180, with nonce at offset 12..16
    let mut tail = [0u8; 52];
    tail.copy_from_slice(&header[128..180]);

    let start = Instant::now();
    let mut count: u64 = 0;
    let mut nonce: u32 = 0;

    loop {
        for _ in 0..8192 {
            tail[12..16].copy_from_slice(&nonce.to_le_bytes());
            let mut h = base_hasher.clone();
            h.update(&tail);
            let hash: [u8; 32] = *h.finalize().as_bytes();
            std::hint::black_box(hash_meets_target(&hash, &target));
            nonce = nonce.wrapping_add(1);
        }
        count += 8192;

        let elapsed = start.elapsed().as_secs_f64();
        if elapsed >= seconds {
            let mhps = (count as f64) / elapsed / 1_000_000.0;
            return (count, elapsed, mhps);
        }
    }
}

/// Detect SIMD features available for Blake3.
pub fn detect_simd() -> &'static str {
    #[cfg(target_arch = "x86_64")]
    {
        if is_x86_feature_detected!("avx512f") {
            return "AVX-512";
        }
        if is_x86_feature_detected!("avx2") {
            return "AVX2";
        }
        if is_x86_feature_detected!("sse4.1") {
            return "SSE4.1";
        }
        if is_x86_feature_detected!("sse2") {
            return "SSE2";
        }
    }
    #[cfg(target_arch = "aarch64")]
    {
        return "NEON";
    }
    "portable"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blake3_hash_deterministic() {
        let h1 = dcr_hash(&[0xAB; 180]);
        let h2 = dcr_hash(&[0xAB; 180]);
        assert_eq!(h1, h2);
    }

    #[test]
    fn different_nonce_different_hash() {
        let mut hdr = [0u8; 180];
        hdr[NONCE_OFFSET..NONCE_OFFSET + 4].copy_from_slice(&0u32.to_le_bytes());
        let h1 = dcr_hash(&hdr);
        hdr[NONCE_OFFSET..NONCE_OFFSET + 4].copy_from_slice(&1u32.to_le_bytes());
        let h2 = dcr_hash(&hdr);
        assert_ne!(h1, h2);
    }

    #[test]
    fn max_target_always_passes() {
        let hash = dcr_hash(&[0; 180]);
        assert!(hash_meets_target(&hash, &[0xFF; 32]));
    }

    #[test]
    fn zero_target_never_passes() {
        let hash = dcr_hash(&[1; 180]);
        assert!(!hash_meets_target(&hash, &[0; 32]));
    }

    #[test]
    fn equal_hash_and_target_passes() {
        let hash = dcr_hash(&[42; 180]);
        assert!(hash_meets_target(&hash, &hash));
    }

    #[test]
    fn target_comparison_u128_consistent() {
        for seed in 0u8..=255 {
            let hash = dcr_hash(&[seed; 180]);
            let mut t = hash;
            if t[31] < 255 { t[31] += 1; }
            assert!(hash_meets_target(&hash, &t));
        }
    }

    #[test]
    fn diff1_target_correct() {
        let target = difficulty_to_target(1.0);
        assert_eq!(&target[0..6], &[0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF]);
        assert_eq!(&target[6..32], &[0u8; 26]);
    }

    #[test]
    fn diff2_target_halved() {
        let target = difficulty_to_target(2.0);
        assert_eq!(
            &target[0..8],
            &[0x00, 0x00, 0x00, 0x00, 0x7F, 0xFF, 0x80, 0x00]
        );
    }

    #[test]
    fn diff_zero_returns_max() {
        assert_eq!(difficulty_to_target(0.0), [0xFF; 32]);
        assert_eq!(difficulty_to_target(-1.0), [0xFF; 32]);
        assert_eq!(difficulty_to_target(f64::NAN), [0xFF; 32]);
    }

    #[test]
    fn bench_sanity() {
        let (_count, _elapsed, mhps) = bench_blake3(0.3);
        assert!(mhps > 0.01, "Blake3 throughput too low: {mhps:.2} MH/s");
    }
}
