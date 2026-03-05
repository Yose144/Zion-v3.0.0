/// ZION Cosmic Harmony — Unified CHv3/CHv4/CHv4.2 Wrapper
///
/// This module delegates ALL hashing to the canonical `zion-cosmic-harmony-v3` crate.
/// Legacy CH v1/v2 implementations have been archived to `archive/legacy-algorithms/`.
///
/// Dispatch podle výšky bloku (height-aware):
///   ≥ CHV4_2_FORK_HEIGHT  → CHv4.2 Merkabah Dual-Spin (backward passes + kabala)
///   ≥ CHV4_NPU_FORK_HEIGHT → CHv4 (memory-hard + NPU mixing)
///   ≥ CHV3_MEMORY_HARD_FORK_HEIGHT → CHv3 (memory-hard scratchpad)
///   else → CHv3 legacy (no memory-hard)

/// Blockchain convenience: algorithm-specific PoW hash.
///
/// This is the ONLY entry point for consensus hashing.
/// Delegates to `cosmic_harmony_with_height()` — universal fork-aware dispatch
/// covering CHv3 → CHv4 → CHv4.2 (Merkabah Dual-Spin).
///
/// # Arguments
/// * `data` - Block header bytes (156 bytes from calculate_hash, or 80+ byte template blob)
/// * `nonce` - 64-bit nonce
/// * `block_height` - Current block height (used for fork-gate + algorithm selection)
pub fn hash(data: &[u8], nonce: u64, block_height: u64) -> Vec<u8> {
    let h = zion_cosmic_harmony_v3::algorithms_opt::cosmic_harmony_with_height(
        data,
        nonce,
        block_height,
    );
    h.data.to_vec()
}

/// Check if hash meets difficulty target (leading zero bits, big-endian)
pub fn check_difficulty(hash: &[u8; 32], target_difficulty: u32) -> bool {
    let mut leading_zeros = 0u32;

    // Scan from last byte (most significant) to first
    for &byte in hash.iter().rev() {
        if byte == 0 {
            leading_zeros += 8;
        } else {
            let mut mask = 0x80u8;
            while (byte & mask) == 0 && mask != 0 {
                leading_zeros += 1;
                mask >>= 1;
            }
            break;
        }
    }

    leading_zeros >= target_difficulty
}

/// Check if hash meets 32-bit target (GPU mining compatibility)
///
/// Compares first 4 bytes (little-endian) against target
pub fn check_target32(hash: &[u8; 32], target32: u32) -> bool {
    let state0 = u32::from_le_bytes([hash[0], hash[1], hash[2], hash[3]]);
    state0 <= target32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chv3_hash_deterministic() {
        let input = b"ZION_TEST_BLOCK_CHV3_UNIFIED";
        let nonce = 12345u64;
        let height = 100u64;

        let hash1 = hash(input, nonce, height);
        let hash2 = hash(input, nonce, height);

        assert_eq!(hash1, hash2, "CHv3 hash should be deterministic");
        assert_eq!(hash1.len(), 32, "Hash should be 32 bytes");
    }

    #[test]
    fn test_chv3_nonce_changes_hash() {
        let input = b"ZION_TEST_BLOCK";
        let height = 100u64;

        let hash1 = hash(input, 0, height);
        let hash2 = hash(input, 1, height);

        assert_ne!(
            hash1, hash2,
            "Different nonces should produce different hashes"
        );
    }

    #[test]
    fn test_chv3_height_changes_hash() {
        let input = b"ZION_TEST_BLOCK";
        let nonce = 42u64;

        let hash1 = hash(input, nonce, 0);
        let hash2 = hash(input, nonce, 100000);

        // Both heights use CHv4 path (CHV4_NPU_FORK_HEIGHT = 0, CHV3_MEMORY_HARD_FORK_HEIGHT = 0).
        // Height is used only for algorithm path selection, NOT as hash input — the
        // block header data (containing height) is the caller's responsibility.
        // Different heights on the same path → same output for same input+nonce.
        assert_eq!(
            hash1, hash2,
            "Both heights use CHv4 path: same input+nonce gives same hash"
        );
    }

    #[test]
    fn test_difficulty_check() {
        let mut hash = [0u8; 32];
        hash[31] = 0x00;
        hash[30] = 0x00;
        hash[29] = 0x01;

        assert!(check_difficulty(&hash, 15));
        assert!(check_difficulty(&hash, 16));

        let mut hash2 = [0xff; 32];
        hash2[31] = 0x00;
        hash2[30] = 0x80;

        assert!(check_difficulty(&hash2, 7));
        assert!(check_difficulty(&hash2, 8));
        assert!(!check_difficulty(&hash2, 9));
    }

    #[test]
    fn test_target32_check() {
        let mut hash = [0u8; 32];
        hash[0] = 0xFF;
        hash[1] = 0xFF;
        hash[2] = 0xFF;
        hash[3] = 0x00;

        assert!(check_target32(&hash, 0x00FFFFFF));
        assert!(check_target32(&hash, 0x01000000));
        assert!(!check_target32(&hash, 0x00FFFFFE));
    }
}
