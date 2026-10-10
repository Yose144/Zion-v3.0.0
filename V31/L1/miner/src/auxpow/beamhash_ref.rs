//! BeamHash III CPU reference — seed-stage (stepElem/workBits) port of
//! `csrc/beamHashIII_ref.cpp` / the BeamMW opencl-miner `beamHashIII_seed`
//! kernel. Used by the KAT to verify the GPU seed output bit-for-bit:
//!   elem.s0..s6 = sipHash24(prepow, gid*8 + 0..6)
//!   elem.s7     = gid
//!   elem.s0     = mixer(elem)   // overwrites s0 after lanes are set
//!   bucket      = elem.s0 & 0xFFF
//!
//! prePow keys = first 32 bytes of blake2b-512(header || nonce8), read as
//! 4 little-endian u64s (host `mine_beamhash_solver` does the same).

#[inline]
fn rotl(x: u64, b: u64) -> u64 {
    (x << b) | (x >> (64 - b))
}

macro_rules! sip_round {
    ($v:expr) => {{
        $v[0] = $v[0].wrapping_add($v[1]);
        $v[2] = $v[2].wrapping_add($v[3]);
        $v[1] = rotl($v[1], 13);
        $v[3] = rotl($v[3], 16);
        $v[1] ^= $v[0];
        $v[3] ^= $v[2];
        $v[0] = rotl($v[0], 32);
        $v[2] = $v[2].wrapping_add($v[1]);
        $v[0] = $v[0].wrapping_add($v[3]);
        $v[1] = rotl($v[1], 17);
        $v[3] = rotl($v[3], 21);
        $v[1] ^= $v[2];
        $v[3] ^= $v[0];
        $v[2] = rotl($v[2], 32);
    }};
}

/// sipHash-2-4 of a single u64 under the 4-word prePow key —
/// identical to `siphash24` in `beamHashIII_ref.cpp` and the OpenCL kernel.
pub fn beamhash_siphash24(prepow: &[u64; 4], nonce: u64) -> u64 {
    let mut v = [prepow[0], prepow[1], prepow[2], prepow[3] ^ nonce];
    sip_round!(v);
    sip_round!(v);
    v[0] ^= nonce;
    v[2] ^= 0xff;
    for _ in 0..4 {
        sip_round!(v);
    }
    v[0] ^ v[1] ^ v[2] ^ v[3]
}

/// OpenCL `mixer()` — rotate-sum of the 8 element words.
fn beamhash_mixer(w: &[u64; 8]) -> u64 {
    let r = w
        .iter()
        .zip([29u64, 58, 23, 52, 17, 46, 11, 40])
        .fold(0u64, |acc, (x, b)| acc.wrapping_add(rotl(*x, b)));
    rotl(r, 24)
}

/// The prePow key: blake2b-512(header||nonce8) → first 32 bytes as 4 u64 LE.
/// Matches `mine_beamhash_solver` byte-for-byte (nonce suffix/prefix split
/// from `extra` is done by the caller — pass the composed `full_nonce`).
pub fn beamhash_prepow(header: &[u8], full_nonce: &[u8; 8]) -> [u64; 4] {
    let mut buf = header.to_vec();
    buf.extend_from_slice(full_nonce);
    let h = blake2b_simd::blake2b(&buf);
    core::array::from_fn(|i| u64::from_le_bytes(h.as_bytes()[i * 8..i * 8 + 8].try_into().unwrap()))
}

/// Full seed element for `gid` — the 8 words stored into buffer0 by
/// `beamHashIII_seed` (s0 = mixer output, s1..s6 = siphash lanes 1..6,
/// s7 = gid).
pub fn beamhash_seed_elem(prepow: &[u64; 4], gid: u64) -> [u64; 8] {
    let mut e = [0u64; 8];
    for i in 0..7 {
        e[i] = beamhash_siphash24(prepow, (gid << 3) + i as u64);
    }
    e[7] = gid;
    e[0] = beamhash_mixer(&e);
    e
}
