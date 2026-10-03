//! Quantus QPoW — Poseidon2 squeeze-twice over the Goldilocks field.
//!
//! Bit-exact port of Quantus `pow-core` (`get_nonce_hash`, `is_valid_nonce`,
//! `mining_midstate`, `mining_prestate_low64`) built on `qp-poseidon-core`,
//! the same crate the Quantus chain uses, so hashing matches the reference
//! implementation byte-for-byte (verified against `pow-core` KAT vectors).
//!
//! QPoW works on a 512-bit nonce and a 512-bit target, both serialized as
//! 64-byte big-endian values on the wire. `get_nonce_hash` produces a 64-byte
//! digest (two 32-byte sponge squeezes, each felt = 8 LE bytes) which is
//! interpreted as a big-endian U512 and compared `<= target` numerically —
//! for fixed-width big-endian byte arrays that is a plain lexicographic
//! comparison.
//!
//! The sponge input is `header(32B) || nonce_be(64B)` encoded as 4 bytes/felt
//! with a terminator felt, i.e. 25 felts absorbed in 4 blocks. That gives the
//! midstate/prestate optimization used by the reference GPU miner:
//!
//! - `mining_midstate(header, nonce_be[..32])` — state after 2 permutations
//!   (header block + high 256 bits of nonce), reusable across low-half scans.
//! - `mining_prestate_low64(header, nonce_be)` — midstate + absorb of
//!   `nonce_be[32..56]` + first external linear layer + round-0 constants;
//!   only the last 64 nonce bits are injected per candidate.
//!
//! With the low-64 injection the remaining work per candidate is ~3
//! permutations instead of 5. NOTE: a batch of nonces sharing a prestate must
//! not overflow the low 64 bits (carry into `nonce_be[56]` would change the
//! prestate) — callers chunk iteration at the 2^64 boundary, exactly like the
//! reference `mining_u64.wgsl` kernel.

use qp_poseidon_core::{
    goldilocks::Goldilocks,
    poseidon2::{
        INITIAL_EXTERNAL_CONSTANTS, INTERNAL_CONSTANTS, MATRIX_DIAG, SPONGE_WIDTH,
        TERMINAL_EXTERNAL_CONSTANTS,
    },
    serialization::digest_to_bytes,
};

/// QPoW nonce width (U512, big-endian on the wire).
pub const QPOW_NONCE_LEN: usize = 64;
/// QPoW target width (U512, big-endian on the wire).
pub const QPOW_TARGET_LEN: usize = 64;
/// QPoW digest width (two 32-byte squeezes).
pub const QPOW_HASH_LEN: usize = 64;
/// QPoW header width.
pub const QPOW_HEADER_LEN: usize = 32;

/// Byte offset of the pool `extranonce` inside the 64-byte big-endian nonce.
///
/// The stratum pools assign a 4-byte `extranonce` per connection; miners
/// brute-force the low 256 nonce bits (`nonce_be[32..64]`), so the extranonce
/// must live in the high half. The reference miner places it at the top of
/// the nonce — confirmed against the live pool by `quantus_accept` testing.
pub const QPOW_EXTRANONCE_OFFSET: usize = 0;

// ============================================================================
// Reference path (full absorb via qp-poseidon-core sponge)
// ============================================================================

/// `pow-core::get_nonce_hash`: Poseidon2 squeeze-twice of `header || nonce`.
///
/// Both inputs are the big-endian wire representations; the result is the
/// 64-byte big-endian digest (interpreted as U512 for target comparison).
pub fn get_nonce_hash(header: &[u8; QPOW_HEADER_LEN], nonce: &[u8; QPOW_NONCE_LEN]) -> [u8; QPOW_HASH_LEN] {
    let mut input = [0u8; QPOW_HEADER_LEN + QPOW_NONCE_LEN];
    input[..QPOW_HEADER_LEN].copy_from_slice(header);
    input[QPOW_HEADER_LEN..].copy_from_slice(nonce);
    qp_poseidon_core::hash_squeeze_twice(&input)
}

/// `pow-core::is_valid_nonce` / `qpow_math::is_valid_nonce`:
/// `get_nonce_hash(h, n) < target` as U512 (strict less-than).
///
/// Big-endian fixed-width comparison is lexicographic.
pub fn is_valid_nonce(
    header: &[u8; QPOW_HEADER_LEN],
    nonce: &[u8; QPOW_NONCE_LEN],
    target: &[u8; QPOW_TARGET_LEN],
) -> bool {
    let hash = get_nonce_hash(header, nonce);
    hash.as_slice() < target.as_slice()
}

// ============================================================================
// Midstate / prestate fast path (port of pow-core GPU helpers)
// ============================================================================

/// State after absorbing the header and the high 256 nonce bits
/// (`mining_midstate` in pow-core). Values are the (non-canonical) Goldilocks
/// limbs, ready to feed `mining_prestate_low64` / `hash_from_prestate_low64`.
pub fn mining_midstate(header: &[u8; QPOW_HEADER_LEN], nonce_high_be: &[u8]) -> [u64; SPONGE_WIDTH] {
    assert_eq!(nonce_high_be.len(), 32, "nonce high half must be 32 bytes");
    let mut state = [Goldilocks::ZERO; SPONGE_WIDTH];

    for (i, chunk) in header.chunks_exact(4).enumerate() {
        state[i] += Goldilocks::from_u64(u32::from_le_bytes(chunk.try_into().unwrap()) as u64);
    }
    permute_full(&mut state);

    for (i, chunk) in nonce_high_be.chunks_exact(4).enumerate() {
        state[i] += Goldilocks::from_u64(u32::from_le_bytes(chunk.try_into().unwrap()) as u64);
    }
    permute_full(&mut state);

    core::array::from_fn(|i| state[i].as_canonical_u64())
}

/// `mining_prestate_low64`: absorb `nonce_be[32..56]` into the midstate and
/// advance through the first external linear layer + round-0 constants.
///
/// Returns the raw state limbs; `hash_from_prestate_low64` injects the low 64
/// nonce bits and finishes the hash.
pub fn mining_prestate_low64(
    header: &[u8; QPOW_HEADER_LEN],
    nonce_be: &[u8; QPOW_NONCE_LEN],
) -> [u64; SPONGE_WIDTH] {
    let mut state = mining_midstate(header, &nonce_be[..32])
        .map(Goldilocks::from_u64);

    for (i, chunk) in nonce_be[32..56].chunks_exact(4).enumerate() {
        state[i] += Goldilocks::from_u64(u32::from_le_bytes(chunk.try_into().unwrap()) as u64);
    }
    external_linear_layer(&mut state);
    for i in 0..SPONGE_WIDTH {
        state[i] += Goldilocks::from_u64(INITIAL_EXTERNAL_CONSTANTS[0][i]);
    }

    core::array::from_fn(|i| state[i].as_canonical_u64())
}

/// Finish the hash for a candidate whose low 64 nonce bits are `low64`
/// (the big-endian integer value of `nonce_be[56..64]`).
///
/// The prestate covers `nonce_be[0..56]`; the two missing felts
/// (`nonce_be[56..60]`, `nonce_be[60..64]` as LE u32s) are injected through
/// the linear layer's sparse image, after which the remaining external
/// rounds, internal rounds, terminal rounds, padding block and the second
/// squeeze complete the digest. Bit-exact with `get_nonce_hash` (asserted by
/// the cross-check tests).
pub fn hash_from_prestate_low64(
    prestate: &[u64; SPONGE_WIDTH],
    low64: u64,
) -> [u8; QPOW_HASH_LEN] {
    let mut st = prestate.map(Goldilocks::from_u64);

    // f6/f7 are the two absorbed felts missing from the prestate. Each felt
    // is u32::from_le_bytes of its 4-byte BE slice, i.e. a byte-swapped u32
    // limb of the nonce value (the `bswap32` in mining_u64.wgsl). They sit
    // in lanes 6..7 of block 3 *before* the linear layer runs; since the
    // layer is linear and the prestate already applied it, their
    // contribution is added as the linear image M·(0,0,a,b).
    let f6 = Goldilocks::from_u64(((low64 >> 32) as u32).swap_bytes() as u64);
    let f7 = Goldilocks::from_u64((low64 as u32).swap_bytes() as u64);
    inject_low64(&mut st, f6, f7);

    // Resume external round 0 (constants already added in the prestate).
    for elem in st.iter_mut() {
        *elem = elem.exp7();
    }
    external_linear_layer(&mut st);
    for rc in INITIAL_EXTERNAL_CONSTANTS.iter().skip(1) {
        external_round(&mut st, rc);
    }
    for rc in INTERNAL_CONSTANTS {
        internal_round(&mut st, rc);
    }
    for rc in TERMINAL_EXTERNAL_CONSTANTS {
        external_round(&mut st, &rc);
    }

    // Padding block: the 25th felt (terminator) + sponge pad ONE land on
    // lanes 0 and 1, the rest of the block is zeros.
    st[0] += Goldilocks::ONE;
    st[1] += Goldilocks::ONE;
    permute_full(&mut st);

    let mut out = [0u8; QPOW_HASH_LEN];
    let first: [Goldilocks; 4] = st[..4].try_into().expect("squeeze slice");
    out[..32].copy_from_slice(&digest_to_bytes(&first));

    permute_full(&mut st);
    let second: [Goldilocks; 4] = st[..4].try_into().expect("squeeze slice");
    out[32..].copy_from_slice(&digest_to_bytes(&second));
    out
}

/// Linear image of a block-3 contribution limited to lanes 6..7:
/// `M·(0,0,0,0, 0,0,a,b, 0,0,0,0)` where M = mat4-chunks + circulant sums.
#[inline]
fn inject_low64(st: &mut [Goldilocks; SPONGE_WIDTH], a: Goldilocks, b: Goldilocks) {
    // apply_mat4((0,0,a,b)) = (a+b, 3a+b, 2a+3b, a+2b) — this is also the
    // circulant sums vector since the other two chunks are zero.
    let sums = [a + b, a.double() + a + b, a.double() + b.double() + b, a + b.double()];
    // lanes 0..4 and 8..12 get just the circulant sums; lanes 4..8 get
    // the chunk output plus the sums (chunk output itself == sums here).
    for k in 0..4 {
        st[k] += sums[k];
        st[4 + k] += sums[k].double();
        st[8 + k] += sums[k];
    }
}

// ============================================================================
// Local Poseidon2 permutation (mirrors qp_poseidon_core::poseidon2 internals,
// which are private — reimplemented here so midstate/prestate can drive them
// mid-round; the constants are the published Poseidon2-Goldilocks vectors).
// ============================================================================

#[inline]
fn permute_full(state: &mut [Goldilocks; SPONGE_WIDTH]) {
    external_linear_layer(state);
    for rc in INITIAL_EXTERNAL_CONSTANTS {
        external_round(state, &rc);
    }
    for rc in INTERNAL_CONSTANTS {
        internal_round(state, rc);
    }
    for rc in TERMINAL_EXTERNAL_CONSTANTS {
        external_round(state, &rc);
    }
}

#[inline]
fn external_round(state: &mut [Goldilocks; SPONGE_WIDTH], rc: &[u64; SPONGE_WIDTH]) {
    for i in 0..SPONGE_WIDTH {
        state[i] += Goldilocks::from_u64(rc[i]);
        state[i] = state[i].exp7();
    }
    external_linear_layer(state);
}

#[inline]
fn internal_round(state: &mut [Goldilocks; SPONGE_WIDTH], rc: u64) {
    state[0] += Goldilocks::from_u64(rc);
    state[0] = state[0].exp7();
    internal_linear_layer(state);
}

#[inline]
fn external_linear_layer(state: &mut [Goldilocks; SPONGE_WIDTH]) {
    for chunk in state.chunks_exact_mut(4) {
        apply_mat4(chunk.try_into().expect("4-lane chunk"));
    }
    let sums: [Goldilocks; 4] =
        core::array::from_fn(|k| (0..SPONGE_WIDTH).step_by(4).map(|j| state[j + k]).sum());
    for (i, elem) in state.iter_mut().enumerate() {
        *elem += sums[i % 4];
    }
}

#[inline(always)]
fn apply_mat4(x: &mut [Goldilocks; 4]) {
    let t01 = x[0] + x[1];
    let t23 = x[2] + x[3];
    let t0123 = t01 + t23;
    let t01123 = t0123 + x[1];
    let t01233 = t0123 + x[3];
    x[3] = t01233 + x[0].double();
    x[1] = t01123 + x[2].double();
    x[0] = t01123 + t01;
    x[2] = t01233 + t23;
}

#[inline]
fn internal_linear_layer(state: &mut [Goldilocks; SPONGE_WIDTH]) {
    let sum: Goldilocks = state.iter().copied().sum();
    for (i, elem) in state.iter_mut().enumerate() {
        *elem = sum + *elem * Goldilocks::from_u64(MATRIX_DIAG[i]);
    }
}

// ============================================================================
// Nonce / target helpers
// ============================================================================

/// Build a 64-byte mining nonce: pool extranonce at `QPOW_EXTRANONCE_OFFSET`,
/// `low` in the last 8 bytes, zero elsewhere. The caller owns iteration of
/// `low`; everything above it stays fixed within a job.
pub fn build_nonce(extranonce: &[u8], low64: u64) -> [u8; QPOW_NONCE_LEN] {
    let mut nonce = [0u8; QPOW_NONCE_LEN];
    let end = QPOW_EXTRANONCE_OFFSET + extranonce.len().min(QPOW_NONCE_LEN - QPOW_EXTRANONCE_OFFSET);
    nonce[QPOW_EXTRANONCE_OFFSET..end].copy_from_slice(&extranonce[..end - QPOW_EXTRANONCE_OFFSET]);
    nonce[56..64].copy_from_slice(&low64.to_be_bytes());
    nonce
}

/// Increment the low `width` bytes of a big-endian nonce in place.
/// Returns `false` on overflow past the incremented region.
pub fn increment_nonce_be(nonce: &mut [u8; QPOW_NONCE_LEN], width: usize) -> bool {
    for i in (QPOW_NONCE_LEN - width..QPOW_NONCE_LEN).rev() {
        let (v, carry) = nonce[i].overflowing_add(1);
        nonce[i] = v;
        if !carry {
            return true;
        }
    }
    false
}

/// Parse a hex string into a fixed-width big-endian byte array.
/// Right-aligned (short hex is zero-padded on the left), like U512 decoding.
pub fn biguint_from_hex<const N: usize>(s: &str) -> Option<[u8; N]> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if s.len() > N * 2 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let mut out = [0u8; N];
    let bytes = hex::decode(s).ok()?;
    out[N - bytes.len()..].copy_from_slice(&bytes);
    Some(out)
}

pub fn to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// Scan `count` candidates starting at `start_low64` on the given prestate.
/// Returns `(low64, hash)` on the first `hash <= target`.
///
/// The scan must not wrap `low64`; callers bound `count` so
/// `start_low64 + count - 1` stays within u64 (checked here).
pub fn scan_low64(
    prestate: &[u64; SPONGE_WIDTH],
    target: &[u8; QPOW_TARGET_LEN],
    start_low64: u64,
    count: u64,
) -> Option<(u64, [u8; QPOW_HASH_LEN])> {
    start_low64.checked_add(count)?;
    for i in 0..count {
        let low = start_low64 + i;
        let hash = hash_from_prestate_low64(prestate, low);
        if hash.as_slice() < target.as_slice() {
            return Some((low, hash));
        }
    }
    None
}

// Re-export for callers that need the raw sponge (pool-side verification).
pub use qp_poseidon_core::hash_squeeze_twice;

#[cfg(test)]
mod tests {
    use super::*;

    /// Canonical Quantus KAT from pow-core `NONCE_HASH_KVS`
    /// (header = 0, nonce = 0 → 8e64e3d8…).
    const KAT_ZERO_HASH: &str = "8e64e3d8e0f38f882e8501f9e525df0a95d2e91e9cfc32c9248d756fb07780e2f8fdca2c5a54441e6fcd8d774a5f6aae72f36d1c76bc19f691a0d4f6c607e8cc";

    #[test]
    fn kat_zero_header_zero_nonce() {
        let hash = get_nonce_hash(&[0u8; 32], &[0u8; 64]);
        assert_eq!(hex::encode(hash), KAT_ZERO_HASH);
    }

    #[test]
    fn prestate_path_matches_reference() {
        // Cross-check the fast path against the full absorb for assorted
        // headers/nonces including low64 boundary values.
        let headers: [[u8; 32]; 2] = [[0u8; 32], [0xAB; 32]];
        for header in headers {
            for base in [0u64, 1, u64::MAX - 1, 0x1234_5678_9abc_def0] {
                let mut nonce = [0u8; 64];
                nonce[..4].copy_from_slice(&[0xde, 0xad, 0xbe, 0xef]);
                let prestate = mining_prestate_low64(&header, &nonce);
                for delta in 0u64..3 {
                    let low = base.wrapping_add(delta);
                    nonce[56..64].copy_from_slice(&low.to_be_bytes());
                    let want = get_nonce_hash(&header, &nonce);
                    let got = hash_from_prestate_low64(&prestate, low);
                    assert_eq!(got, want, "low64={low:#x}");
                }
            }
        }
    }

    #[test]
    fn is_valid_nonce_respects_target() {
        let header = [0u8; 32];
        let nonce = [0u8; 64];
        let hash = get_nonce_hash(&header, &nonce);
        // Strict less-than: target == hash must FAIL (qpow_math semantics).
        assert!(!is_valid_nonce(&header, &nonce, &hash));
        // Zero target can only pass on a zero hash — this hash is nonzero.
        assert!(!is_valid_nonce(&header, &nonce, &[0u8; 64]));
        // Full target always passes.
        assert!(is_valid_nonce(&header, &nonce, &[0xffu8; 64]));
    }

    #[test]
    fn nonce_build_and_increment() {
        let mut n = build_nonce(&[0x08, 0x00, 0x01], 0);
        assert_eq!(&n[..3], &[0x08, 0x00, 0x01]);
        assert_eq!(n[3], 0);
        assert!(increment_nonce_be(&mut n, 8));
        assert_eq!(u64::from_be_bytes(n[56..64].try_into().unwrap()), 1);
        // Overflow of the low64 region returns false and leaves high intact.
        n[56..64].copy_from_slice(&u64::MAX.to_be_bytes());
        assert!(!increment_nonce_be(&mut n, 8));
        assert_eq!(&n[..4], &[0x08, 0x00, 0x01, 0x00]);
    }

    #[test]
    fn hex_roundtrip_u512() {
        let v = biguint_from_hex::<64>(&"ff".repeat(64)).unwrap();
        assert_eq!(v, [0xffu8; 64]);
        let short = biguint_from_hex::<64>("0x1234").unwrap();
        assert_eq!(short[62..64], [0x12, 0x34]);
        assert!(biguint_from_hex::<64>(&"ff".repeat(65)).is_none());
        assert_eq!(to_hex(&[0xde, 0xad]), "dead");
    }

    #[test]
    fn scan_finds_valid_share() {
        // Max target → first candidate wins.
        let header = [0u8; 32];
        let nonce = [0u8; 64];
        let prestate = mining_prestate_low64(&header, &nonce);
        let target = [0xffu8; 64];
        let (low, hash) = scan_low64(&prestate, &target, 0, 8).unwrap();
        assert_eq!(low, 0);
        assert_eq!(hex::encode(hash), KAT_ZERO_HASH);
    }

    /// Replicates the CUDA kernel's sponge schedule step-for-step
    /// (`poseidon2_kernel.cu` / upstream `mining_u64.wgsl`): midstate →
    /// absorb low 32 nonce bytes as LE-u32 felts → permute → pad block
    /// [1,1] → permute → squeeze 4 → permute → squeeze 4.
    ///
    /// This is the strongest on-host guarantee that the GPU transcription
    /// is bit-exact: if this diverged from `get_nonce_hash`, the kernel
    /// port would be wrong in the same way.
    #[test]
    fn midstate_kernel_flow_matches_reference() {
        let headers: [[u8; 32]; 2] = [[0u8; 32], [0xAB; 32]];
        for header in headers {
            for low in [0u64, 1, u64::MAX, 0x1234_5678_9abc_def0] {
                for mid_bytes in [0u64, 7] {
                    let mut nonce = [0u8; 64];
                    nonce[..4].copy_from_slice(&[0x00, 0x0c, 0x00, 0x01]);
                    nonce[32..40].copy_from_slice(&mid_bytes.to_be_bytes());
                    nonce[56..64].copy_from_slice(&low.to_be_bytes());

                    // mining_midstate(header, nonce[..32]) → 12 u64 felts.
                    let mut st = mining_midstate(&header, &nonce[..32])
                        .map(Goldilocks::from_u64);
                    // Absorb low half: st[i] += u32::from_le_bytes(nonce[32+4i..])
                    // (== bswap32 of the U512 LE limb on the GPU).
                    for i in 0..8 {
                        let limb = u32::from_le_bytes(
                            nonce[32 + 4 * i..36 + 4 * i].try_into().unwrap(),
                        );
                        st[i] += Goldilocks::from_u64(limb as u64);
                    }
                    permute_full(&mut st);
                    st[0] += Goldilocks::ONE;
                    st[1] += Goldilocks::ONE;
                    permute_full(&mut st);

                    let mut out = [0u8; 64];
                    let first: [Goldilocks; 4] = st[..4].try_into().unwrap();
                    out[..32].copy_from_slice(&digest_to_bytes(&first));
                    permute_full(&mut st);
                    let second: [Goldilocks; 4] = st[..4].try_into().unwrap();
                    out[32..].copy_from_slice(&digest_to_bytes(&second));

                    assert_eq!(
                        out,
                        get_nonce_hash(&header, &nonce),
                        "kernel flow diverged low={low:#x} mid={mid_bytes:#x}"
                    );
                }
            }
        }
    }

    /// The kernel's compare loop must implement strict `hash < target` on
    /// the full U512: a nonce whose hash equals the target's high half must
    /// pay for the second squeeze and still lose when the low half is >=.
    #[test]
    fn kernel_compare_is_strict_full_width() {
        // Find a nonce whose hash has hash[63] > 0 and hash[31] < 0xff so
        // the low-half decrement / high-half increment stay within their
        // respective halves (a few candidates always qualify).
        let header = [0u8; 32];
        let mut nonce = [0u8; 64];
        let mut hash = [0u8; 64];
        for low in 0u64..256 {
            nonce[56..64].copy_from_slice(&low.to_be_bytes());
            hash = get_nonce_hash(&header, &nonce);
            if hash[63] > 0 && hash[31] < 0xff {
                break;
            }
        }
        assert!(hash[63] > 0 && hash[31] < 0xff);
        // Target sharing the high 32 bytes but a smaller low half → reject
        // (the kernel's second-squeeze compare path).
        let mut target = [0u8; 64];
        target[..32].copy_from_slice(&hash[..32]);
        target[32..].copy_from_slice(&hash[32..]);
        target[63] -= 1;
        assert!(!is_valid_nonce(&header, &nonce, &target));
        // Target with the high 32 bytes one larger always wins regardless
        // of the low half — matches the kernel's early-accept on cmp==2.
        let mut big = [0u8; 64];
        big[..32].copy_from_slice(&hash[..32]);
        big[31] += 1;
        assert!(is_valid_nonce(&header, &nonce, &big));
    }
}
