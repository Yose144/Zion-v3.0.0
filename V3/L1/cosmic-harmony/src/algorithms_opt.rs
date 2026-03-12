use aes::cipher::{BlockEncrypt, KeyInit};
use aes::Aes128;
use sha3::{Digest, Keccak256, Sha3_512};

pub const PHI_POWERS_FP: [u64; 16] = [
    4294967296,
    6949403065,
    11244370361,
    18193773427,
    29438143788,
    47631917215,
    77070061004,
    124701978219,
    201772039223,
    326474017443,
    528246056666,
    854720074109,
    1382966130776,
    2237686204885,
    3620652335660,
    5858338540545,
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C, align(32))]
pub struct Hash32 {
    pub data: [u8; 32],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C, align(64))]
pub struct Hash64 {
    pub data: [u8; 64],
}

impl Hash32 {
    #[inline]
    pub const fn new() -> Self {
        Self { data: [0u8; 32] }
    }
}

impl Hash64 {
    #[inline]
    pub const fn new() -> Self {
        Self { data: [0u8; 64] }
    }
}

#[inline]
pub fn keccak256_opt(input: &[u8]) -> Hash32 {
    let mut hasher = Keccak256::new();
    hasher.update(input);
    let result = hasher.finalize();

    let mut hash = Hash32::new();
    hash.data.copy_from_slice(&result);
    hash
}

#[inline]
pub fn sha3_512_opt(input: &[u8]) -> Hash64 {
    crate::sha3_fast::sha3_512_bytes(input)
}

#[inline]
pub fn golden_matrix_opt(input: &[u8]) -> Hash64 {
    const MATRIX_SIZE: usize = 8;

    let mut matrix = [[0u64; MATRIX_SIZE]; MATRIX_SIZE];
    let input_len = input.len();

    for i in 0..MATRIX_SIZE {
        let base = i * MATRIX_SIZE;
        for j in 0..MATRIX_SIZE {
            matrix[i][j] = input[(base + j) % input_len] as u64;
        }
    }

    let mut result = [0u64; MATRIX_SIZE];
    for i in 0..MATRIX_SIZE {
        let mut sum: u128 = 0;
        for j in 0..MATRIX_SIZE {
            sum += (matrix[i][j] as u128) * (PHI_POWERS_FP[i + j] as u128);
        }
        result[i] = (sum >> 32) as u64;
    }

    let mut hash = Hash64::new();
    for (index, value) in result.iter().enumerate() {
        hash.data[index * 8..(index + 1) * 8].copy_from_slice(&value.to_le_bytes());
    }
    hash
}

#[inline]
pub fn cosmic_fusion_opt(input: &[u8]) -> Hash32 {
    cosmic_fusion_opt_rounds(input, 4)
}

#[inline]
pub fn cosmic_fusion_opt_rounds(input: &[u8], rounds: usize) -> Hash32 {
    let mut state = [0u8; 64];
    let copy_len = input.len().min(64);
    state[..copy_len].copy_from_slice(&input[..copy_len]);

    for round in 0..rounds {
        fusion_round(&mut state, round as u8);
    }

    let mut hasher = Sha3_512::new();
    hasher.update(&state[..32]);
    let final_state = hasher.finalize();

    let mut hash = Hash32::new();
    hash.data.copy_from_slice(&final_state[..32]);
    hash
}

#[inline(always)]
fn fusion_round(state: &mut [u8; 64], round: u8) {
    let mut h1 = Keccak256::new();
    h1.update(&state[..32]);
    h1.update([round]);
    let intermediate = h1.finalize();

    let aes_key: &[u8; 16] = intermediate[..16].try_into().expect("aes128 key");
    let mut block0: [u8; 16] = state[32..48].try_into().expect("block0");
    let mut block1: [u8; 16] = state[48..64].try_into().expect("block1");
    let cipher = Aes128::new_from_slice(aes_key).expect("aes128 key init");
    cipher.encrypt_block((&mut block0).into());

    let mut tweaked_key = [0u8; 16];
    tweaked_key.copy_from_slice(aes_key);
    tweaked_key[0] ^= round;
    tweaked_key[15] ^= 0xAB;
    let tweaked_cipher = Aes128::new_from_slice(&tweaked_key).expect("aes128 tweak init");
    tweaked_cipher.encrypt_block((&mut block1).into());

    for index in 0..16 {
        state[index] = intermediate[index] ^ block0[index];
        state[index + 16] = intermediate[index + 16] ^ block1[index];
    }

    for index in 0..16 {
        state[index + 32] ^= intermediate[index];
        state[index + 48] ^= intermediate[index + 16];
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn golden_matrix_is_stable() {
        let input = [7u8; 64];
        let left = golden_matrix_opt(&input);
        let right = golden_matrix_opt(&input);
        assert_eq!(left, right);
    }

    #[test]
    fn cosmic_fusion_is_stable() {
        let input = [9u8; 64];
        let left = cosmic_fusion_opt_rounds(&input, 8);
        let right = cosmic_fusion_opt_rounds(&input, 8);
        assert_eq!(left, right);
    }
}
