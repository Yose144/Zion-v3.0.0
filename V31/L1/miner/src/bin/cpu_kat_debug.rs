fn main() {
    use zion_cosmic_harmony::algorithm::ekam_deeksha::{EkamDeeksha, LITE_KAT_HEADER};
    use sha3::{Digest, Keccak256};

    let header = LITE_KAT_HEADER;
    let nonce: u64 = 0;

    // Step 1: Keccak256(header[0..80] || nonce_le[0..8])
    let mut input = [0u8; 88];
    let hlen = header.len().min(80);
    input[..hlen].copy_from_slice(&header[..hlen]);
    input[80..88].copy_from_slice(&nonce.to_le_bytes());
    let s1: [u8; 32] = Keccak256::digest(input).into();
    println!("CPU s1 (nonce=0): {}", s1.iter().map(|b| format!("{:02x}", b)).collect::<String>());

    // Also show the pre-state (first 80 bytes absorbed, no padding)
    let mut state = [0u64; 25];
    for (i, &b) in header.iter().enumerate() {
        let word_idx = i / 8;
        let shift = (i % 8) * 8;
        state[word_idx] ^= (b as u64) << shift;
    }
    println!("CPU pre_state[0..4]: {:016x} {:016x} {:016x} {:016x}", state[0], state[1], state[2], state[3]);
    println!("CPU pre_state[10] (nonce pos): {:016x}", state[10]);

    // Full hash
    let hash = EkamDeeksha::hash_bytes(header, nonce);
    println!("CPU full hash (nonce=0): {}", hash.iter().map(|b| format!("{:02x}", b)).collect::<String>());
}
