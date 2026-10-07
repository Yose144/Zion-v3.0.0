//! Verthash CPU reference — bit-exact port of `csrc/opencl/verthash_kernel.cl`
//! + `sha3_512_precompute.cl` + `sha3_512_256.cl` (VerthashMiner structure).
//!
//! Pipeline per nonce:
//!   1. precompute: 8 Keccak-f1600 states from header[0..72) with
//!      h0 = header_u32[0] + j + 1 (j = 0..8), single block, no padding.
//!   2. io_hash: Keccak(header72 ‖ in18 ‖ nonce, 0x06 pad) → 32 B.
//!   3. 4-lane stage: per lane `e` and pass `s3s` (2 states per lane from
//!      kStates), st[0] ^= (in18, nonce); st[1] ^= 0x06; st[8] ^= 1<<63;
//!      permute; store st[0..8] as uint2 into the combined 128-u32 state.
//!   4. 4096 memory seeks: seek_index = state.u[i & 127] (rotated left 1
//!      after read), offset = fnv1a(seek_index, acc) % mdiv << 1, each lane
//!      reads memory.u2[offset + e], fnv1a-accumulates into up1; acc chains
//!      across all 4 lane values per iteration.
//!   5. Output = 4 × up1 (uint2) → 32 B hash.

/// Keccak-f1600 permutation — the GPU kernels implement the standard
/// permutation (verified: io_hashes ≡ SHA3-256 of the absorbed message);
/// use the audited `keccak` crate instead of a hand port.
fn keccak_f1600(st: &mut [u64; 25]) {
    keccak::f1600(st);
}

#[inline]
fn fnv1a(a: u32, b: u32) -> u32 {
    (a ^ b).wrapping_mul(0x0100_0193)
}

/// Header as big-endian u32 words (VerthashMiner be32enc convention).
fn header_u32_be(header: &[u8]) -> [u32; 20] {
    let mut u = [0u32; 20];
    for i in 0..20 {
        let off = i * 4;
        if off + 4 <= header.len().min(80) {
            u[i] = u32::from_be_bytes([
                header[off],
                header[off + 1],
                header[off + 2],
                header[off + 3],
            ]);
        }
    }
    u
}

/// The 8 precomputed Keccak states (sha3_512_precompute.cl).
fn kstates(uheader: &[u32; 20]) -> [[u64; 25]; 8] {
    let mut out = [[0u64; 25]; 8];
    for (j, state) in out.iter_mut().enumerate() {
        let h0 = uheader[0].wrapping_add(j as u32).wrapping_add(1);
        let mut st = [0u64; 25];
        st[0] = ((uheader[1] as u64) << 32) | h0 as u64;
        for k in 1..9 {
            st[k] = ((uheader[2 * k + 1] as u64) << 32) | uheader[2 * k] as u64;
        }
        keccak_f1600(&mut st);
        *state = st;
    }
    out
}

/// io_hashes for a nonce (sha3_512_256.cl): Keccak(72B header ‖ in18 ‖ nonce).
fn io_hash(uheader: &[u32; 20], in18: u32, nonce: u32) -> [u64; 4] {
    let mut st = [0u64; 25];
    for k in 0..9 {
        st[k] = ((uheader[2 * k + 1] as u64) << 32) | uheader[2 * k] as u64;
    }
    st[9] ^= ((nonce as u64) << 32) | in18 as u64;
    st[10] ^= 0x06;
    st[16] ^= 0x8000_0000_0000_0000;
    keccak_f1600(&mut st);
    [st[0], st[1], st[2], st[3]]
}

/// Debug: the io_hash (sha3_512_256 stage) for one nonce.
pub fn verthash_io_hash_ref(header: &[u8], nonce: u64) -> [u8; 32] {
    let uh = header_u32_be(header);
    let ih = io_hash(&uh, uh[18], nonce as u32);
    let mut out = [0u8; 32];
    for (i, v) in ih.iter().enumerate() {
        out[8 * i..8 * i + 8].copy_from_slice(&v.to_le_bytes());
    }
    out
}

/// Full Verthash for one nonce. `memory` is verthash.dat (read as LE uint2
/// pairs); `mdiv` = ((len - 32) / 16) + 1.
///
/// Returns the 32-byte hash (4 lanes × 8-byte up1 accumulator).
pub fn verthash_hash_ref(header: &[u8], nonce: u64, memory: &[u8]) -> [u8; 32] {
    let uheader = header_u32_be(header);
    let in18 = uheader[18];
    let mdiv = (((memory.len() - 32) / 16) + 1) as u32;
    let ks = kstates(&uheader);
    let n32 = nonce as u32;

    // Combined 128-u32 seek state for the 4-lane group.
    let mut sha3_st = [0u32; 128];
    for e in 0..4usize {
        for s3s in 0..2usize {
            // Lane state = kStates[e].ul[s3s*25 .. +25] → block 2e+s3s.
            let mut st = ks[2 * e + s3s];
            st[0] ^= ((n32 as u64) << 32) | in18 as u64;
            st[1] ^= 0x06;
            st[8] ^= 0x8000_0000_0000_0000;
            keccak_f1600(&mut st);
            for i in 0..8 {
                let u2idx = e * 16 + s3s * 8 + i;
                sha3_st[2 * u2idx] = st[i] as u32;
                sha3_st[2 * u2idx + 1] = (st[i] >> 32) as u32;
            }
        }
    }

    // io_hash initial up1 per lane: sha3_512_256 writes 8 u32 per nonce;
    // verthash_4w lane `e` reads uint2 index 4*idx+e → u32 pair (2e, 2e+1)
    // of that 32-byte hash (LE u64 words serialized little-endian).
    let ih = io_hash(&uheader, in18, n32);
    let mut ih_u32 = [0u32; 8];
    for (w, v) in ih.iter().enumerate() {
        ih_u32[2 * w] = *v as u32;
        ih_u32[2 * w + 1] = (*v >> 32) as u32;
    }
    let mut up1 = [[0u32; 2]; 4];
    for (e, lane) in up1.iter_mut().enumerate() {
        lane[0] = ih_u32[2 * e];
        lane[1] = ih_u32[2 * e + 1];
    }

    // memory as LE u32 pairs.
    let mem_u32 = |idx: usize| -> u32 {
        let off = idx * 4;
        u32::from_le_bytes(memory[off..off + 4].try_into().unwrap())
    };

    let mut acc = 0x811c_9dc5u32;
    for i in 0..4096usize {
        let s3idx0 = i & 127;
        let seek_index = sha3_st[s3idx0];
        sha3_st[s3idx0] = seek_index.rotate_left(1);

        // offset is in uint2 units (8 bytes); u32 index = 2*(offset + e).
        let offset = (fnv1a(seek_index, acc) % mdiv) << 1;
        let mut vv = [0u32; 8]; // 4 lanes × uint2
        for e in 0..4 {
            let base = 2 * (offset as usize + e);
            vv[2 * e] = mem_u32(base);
            vv[2 * e + 1] = mem_u32(base + 1);
        }
        for e in 0..4 {
            up1[e][0] = fnv1a(up1[e][0], vv[2 * e]);
            up1[e][1] = fnv1a(up1[e][1], vv[2 * e + 1]);
        }
        for e in 0..4 {
            acc = fnv1a(acc, vv[2 * e]);
            acc = fnv1a(acc, vv[2 * e + 1]);
        }
    }

    let mut out = [0u8; 32];
    for e in 0..4 {
        out[8 * e..8 * e + 4].copy_from_slice(&up1[e][0].to_le_bytes());
        out[8 * e + 4..8 * e + 8].copy_from_slice(&up1[e][1].to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// io_hash must equal SHA3-256 over the byte-serialized message
    /// (LE u32 words of the BE-decoded header + LE(in18) ‖ LE(nonce)).
    #[test]
    fn io_hash_matches_sha3_256() {
        use sha3::Digest;
        let mut header = [0u8; 80];
        for (i, b) in header.iter_mut().enumerate() {
            *b = i as u8;
        }
        let uh = header_u32_be(&header);
        let in18 = uh[18];
        let nonce = 0xdead_beefu32;
        let got = io_hash(&uh, in18, nonce);

        // Reconstruct the absorbed message: 72B header (LE u32 words) +
        // LE(in18) + LE(nonce) = 80 B.
        let mut msg = Vec::new();
        for w in &uh[..18] {
            msg.extend_from_slice(&w.to_le_bytes());
        }
        msg.extend_from_slice(&in18.to_le_bytes());
        msg.extend_from_slice(&nonce.to_le_bytes());
        let want: [u8; 32] = sha3::Sha3_256::digest(&msg).into();

        let mut got_b = [0u8; 32];
        for (i, v) in got.iter().enumerate() {
            got_b[8 * i..8 * i + 8].copy_from_slice(&v.to_le_bytes());
        }
        assert_eq!(got_b, want);
    }
}
