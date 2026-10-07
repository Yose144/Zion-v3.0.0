//! NeoScrypt CPU reference — bit-exact port of `csrc/opencl/neoscrypt_kernel.cl`.
//!
//! Pipeline (kernel variant): BLAKE2s-256(header ‖ nonce_le64) →
//! PBKDF2-HMAC-BLAKE2s(hash, hash, 1, 128B) → ROMix(N=32, r=1,
//! blake2s BlockMix) → PBKDF2-HMAC-BLAKE2s(hash, B, 1, 32B) →
//! BLAKE2s-256(hash ‖ scrypt_out).
//!
//! NOTE: this mirrors the kernel exactly, including its deviations from
//! mainline NeoScrypt (BlockMix seeds X from B[0] making Y0 = hash(0),
//! N=32 instead of 128, blake2s instead of salsa/chacha mix). This is a
//! GPU≡CPU consistency reference, not a consensus-vs-mainnet proof.

use blake2::digest::typenum::U32;
use blake2::Blake2s;
use blake2::Digest;

type Blake2s256 = Blake2s<U32>;

fn blake2s_256(data: &[u8]) -> [u8; 32] {
    Blake2s256::digest(data).into()
}

/// Manual HMAC-BLAKE2s (kernel-identical: keys >64 B hashed, then padded).
fn hmac_blake2s(key: &[u8], msg: &[u8]) -> [u8; 32] {
    let mut kpad = [0u8; 64];
    if key.len() > 64 {
        let kh = blake2s_256(key);
        kpad[..32].copy_from_slice(&kh);
    } else {
        kpad[..key.len()].copy_from_slice(key);
    }
    let mut inner = Vec::with_capacity(64 + msg.len());
    inner.extend(kpad.iter().map(|b| b ^ 0x36));
    inner.extend_from_slice(msg);
    let ih = blake2s_256(&inner);
    let mut outer = Vec::with_capacity(96);
    outer.extend(kpad.iter().map(|b| b ^ 0x5c));
    outer.extend_from_slice(&ih);
    blake2s_256(&outer)
}

/// PBKDF2-HMAC-BLAKE2s with BE32 block counters (kernel-identical).
fn pbkdf2_hmac_blake2s(password: &[u8], salt: &[u8], iterations: u32, out: &mut [u8]) {
    let blocks = out.len().div_ceil(32);
    for b in 1..=blocks as u32 {
        let mut sb = Vec::with_capacity(salt.len() + 4);
        sb.extend_from_slice(salt);
        sb.extend_from_slice(&b.to_be_bytes());
        let mut u = hmac_blake2s(password, &sb);
        let mut t = u;
        for _ in 1..iterations {
            u = hmac_blake2s(password, &u);
            for i in 0..32 {
                t[i] ^= u[i];
            }
        }
        let off = (b as usize - 1) * 32;
        let copy = (out.len() - off).min(32);
        out[off..off + copy].copy_from_slice(&t[..copy]);
    }
}

/// Kernel BlockMix r=1 (blake2s instead of salsa; see header NOTE about
/// the degenerate first output block).
fn blockmix_r1(b_in: &[u8; 128]) -> [u8; 128] {
    let mut x = [0u8; 64];
    x.copy_from_slice(&b_in[..64]);

    // Y0: tmp = X ^ B_in[0..64] (== 0 in this variant) → hash → pad to 64.
    let mut y0 = [0u8; 64];
    let tmp: Vec<u8> = (0..64).map(|i| x[i] ^ b_in[i]).collect();
    let d = blake2s_256(&tmp);
    y0[..32].copy_from_slice(&d);
    x = y0;

    // Y1: tmp = X ^ B_in[64..128] → hash → pad.
    let mut y1 = [0u8; 64];
    let tmp: Vec<u8> = (0..64).map(|i| x[i] ^ b_in[64 + i]).collect();
    let d = blake2s_256(&tmp);
    y1[..32].copy_from_slice(&d);

    let mut out = [0u8; 128];
    out[..64].copy_from_slice(&y0);
    out[64..].copy_from_slice(&y1);
    out
}

const NEOSCRYPT_N: usize = 32;

/// ROMix with N=32, r=1 (kernel-identical, block=128 B).
fn romix_n32_r1(b: &mut [u8; 128]) {
    let mut v = vec![[0u8; 128]; NEOSCRYPT_N];
    v[0] = *b;
    for i in 1..NEOSCRYPT_N {
        v[i] = blockmix_r1(&v[i - 1]);
    }
    let mut x = v[NEOSCRYPT_N - 1];
    for _ in 0..NEOSCRYPT_N {
        let j = (u64::from_le_bytes(x[120..128].try_into().unwrap()) % NEOSCRYPT_N as u64) as usize;
        for k in 0..128 {
            x[k] ^= v[j][k];
        }
        x = blockmix_r1(&x);
    }
    *b = x;
}

/// Full kernel neoscrypt: nonce appended LE (8 B) after the header.
pub fn neoscrypt_hash_ref(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut hdr = Vec::with_capacity(header.len() + 8);
    hdr.extend_from_slice(&header[..header.len().min(152)]);
    hdr.extend_from_slice(&nonce.to_le_bytes());

    let initial_hash = blake2s_256(&hdr);

    let mut b = [0u8; 128];
    pbkdf2_hmac_blake2s(&initial_hash, &initial_hash, 1, &mut b);
    romix_n32_r1(&mut b);

    let mut scrypt_out = [0u8; 32];
    pbkdf2_hmac_blake2s(&initial_hash, &b, 1, &mut scrypt_out);

    let mut final_in = [0u8; 64];
    final_in[..32].copy_from_slice(&initial_hash);
    final_in[32..].copy_from_slice(&scrypt_out);
    blake2s_256(&final_in)
}
