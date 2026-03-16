/// DCR PoW hash: blake3(header) → 32 bytes (DCP-0011).
pub fn dcr_hash(header: &[u8]) -> [u8; 32] {
    *blake3::hash(header).as_bytes()
}

/// Returns true if `hash <= target` (big-endian comparison).
pub fn hash_meets_target(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    for i in 0..32 {
        if hash[i] < target[i] {
            return true;
        }
        if hash[i] > target[i] {
            return false;
        }
    }
    true // equal
}

/// Convert stratum pool difficulty to 32-byte big-endian target.
///
/// Uses Bitcoin-style diff1: `0x00000000FFFF0000…0000`.
/// `pool_target = diff1 / difficulty`.
pub fn difficulty_to_target(difficulty: f64) -> [u8; 32] {
    if difficulty <= 0.0 || !difficulty.is_finite() {
        return [0xFF; 32];
    }

    let diff_u64 = difficulty.ceil().max(1.0) as u64;

    // diff1 as four big-endian u64 words:
    // 0x00000000FFFF0000 | 0 | 0 | 0
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
    fn hash_length_independent() {
        // blake3 accepts any input length
        let _short = dcr_hash(&[0u8; 80]);
        let _dcr = dcr_hash(&[0u8; 180]);
        let _long = dcr_hash(&[0u8; 256]);
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
}
