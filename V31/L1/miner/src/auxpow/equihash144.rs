//! Equihash 144,5 solver — vendored tromp `equi_miner.c` (compiled as
//! `equi144.c` with `-DWN=144 -DWK=5 -DRESTBITS=4`) behind a small FFI.
//!
//! Used for zpool `equihash192` ports that actually serve Equihash 144,5
//! work (`params[8]="144_5"`, `params[9]="sngemPoW"`). The GPU OpenCL kernel
//! is still 192,7-oriented (wrong Xi byte layout), so this CPU path is the
//! correctness reference that makes ZCL E2E produce accepted shares.
//!
//! The blake2b hot path lives entirely in C (`eq144_blake.c`) — ~11M
//! digests per run make a Rust callback per hash far too slow. Verification
//! of candidate solutions reuses `blake2b_simd` (only ~11 calls per sol).
//!
//! Wire format: solutions are the standard minimal-encoded 32 × 25-bit
//! indices = 100 bytes; block hash = sha256d(header140 || varint || soln).

use std::ffi::c_void;
use std::marker::{PhantomData, PhantomPinned};
use std::ptr;
use std::slice;
use std::vec::Vec;

use crate::auxpow::hasher;

pub const N: u32 = 144;
pub const K: u32 = 5;
/// floor(512/N) * N/8 = 3 * 18 = 54-byte Blake2b output.
pub const HASHOUT: usize = 54;
pub const PROOFSIZE: usize = 1 << K; // 32 indices
/// (N/(K+1)+1) = 25 bits per index → 32*25/8 = 100-byte minimal solution.
pub const SOL_LEN: usize = 100;
pub const HEADER_LEN: usize = 140;
pub const NONCE_LEN: usize = 32;
/// Bytes of the header covered by the blake midstate (before the nonce).
pub const INPUT_LEN: usize = HEADER_LEN - NONCE_LEN; // 108

// ── FFI ─────────────────────────────────────────────────────────────────

#[repr(C)]
struct CEqui {
    _f: [u8; 0],
    _m: PhantomData<(*mut u8, PhantomPinned)>,
}

type BlakeClone = unsafe extern "C" fn(*const c_void) -> *mut c_void;
type BlakeFree = unsafe extern "C" fn(*mut c_void);
type BlakeUpdate = unsafe extern "C" fn(*mut c_void, *const u8, usize);
type BlakeFinalize = unsafe extern "C" fn(*mut c_void, *mut u8, usize);

#[link(name = "equitromp144")]
extern "C" {
    // tromp solver (equihash144/equi144.c, namespaced eq144_*)
    fn eq144_new(
        blake2b_clone: BlakeClone,
        blake2b_free: BlakeFree,
        blake2b_update: BlakeUpdate,
        blake2b_finalize: BlakeFinalize,
    ) -> *mut CEqui;
    fn eq144_free(eq: *mut CEqui);
    fn eq144_setstate(eq: *mut CEqui, ctx: *const c_void);
    fn eq144_clearslots(eq: *mut CEqui);
    fn eq144_digit0(eq: *mut CEqui, id: u32);
    fn eq144_digitodd(eq: *mut CEqui, r: u32, id: u32);
    fn eq144_digiteven(eq: *mut CEqui, r: u32, id: u32);
    fn eq144_digitK(eq: *mut CEqui, id: u32);
    fn eq144_nsols(eq: *const CEqui) -> usize;
    fn eq144_sols(eq: *const CEqui) -> *const u32;

    // C blake2b (equihash144/eq144_blake.c) — used both as the solver's
    // callbacks and directly for per-nonce ctx construction.
    fn eq144_cb_clone(state: *const c_void) -> *mut c_void;
    fn eq144_cb_free(state: *mut c_void);
    fn eq144_cb_update(state: *mut c_void, input: *const u8, len: usize);
    fn eq144_cb_finalize(state: *mut c_void, out: *mut u8, out_len: usize);
    fn eq144_ctx_create(
        pers16: *const u8,
        input: *const u8,
        input_len: usize,
        outlen: u8,
    ) -> *mut c_void;
    fn eq144_ctx_update(ctx: *mut c_void, data: *const u8, len: usize);
    fn eq144_ctx_free(ctx: *mut c_void);
}

/// Per-thread solver context (~1.3 GB scratch — keep the count low).
pub struct Solver {
    eq: *mut CEqui,
}

impl Solver {
    pub fn new() -> Option<Self> {
        let eq = unsafe {
            eq144_new(
                eq144_cb_clone,
                eq144_cb_free,
                eq144_cb_update,
                eq144_cb_finalize,
            )
        };
        if eq.is_null() {
            None
        } else {
            Some(Self { eq })
        }
    }

    /// One Wagner run for a single nonce. `ctx` is a midstate already
    /// updated with header[..108] || nonce[32] (consumed — freed here).
    /// Returns uncompressed 32-index proofs.
    fn run(&mut self, ctx: *mut c_void) -> Vec<[u32; PROOFSIZE]> {
        unsafe {
            eq144_setstate(self.eq, ctx);
            eq144_ctx_free(ctx); // setstate clones the ctx internally
            eq144_digit0(self.eq, 0);
            eq144_clearslots(self.eq);
            for r in 1..K {
                if r & 1 == 1 {
                    eq144_digitodd(self.eq, r, 0);
                } else {
                    eq144_digiteven(self.eq, r, 0);
                }
                eq144_clearslots(self.eq);
            }
            eq144_digitK(self.eq, 0);

            let nsols = eq144_nsols(self.eq);
            let sols = eq144_sols(self.eq);
            if nsols == 0 || sols.is_null() {
                return Vec::new();
            }
            let raw = slice::from_raw_parts(sols, nsols * PROOFSIZE);
            raw.chunks_exact(PROOFSIZE)
                .map(|c| {
                    let mut a = [0u32; PROOFSIZE];
                    a.copy_from_slice(c);
                    a
                })
                .collect()
        }
    }
}

impl Drop for Solver {
    fn drop(&mut self) {
        unsafe { eq144_free(self.eq) };
    }
}

// Safety: each Solver owns a private C context; we only ever move it
// between threads (one `spawn_blocking` worker per stream).
unsafe impl Send for Solver {}

/// Build the 16-byte Blake2b personalization: pers8 || n_le32 || k_le32.
pub fn personalization(pers8: &[u8]) -> [u8; 16] {
    let mut pers = [0u8; 16];
    pers[..8.min(pers8.len())].copy_from_slice(&pers8[..8.min(pers8.len())]);
    pers[8..12].copy_from_slice(&N.to_le_bytes());
    pers[12..16].copy_from_slice(&K.to_le_bytes());
    pers
}

/// Build a per-nonce solver ctx: init(pers16, outlen=54) ‖ update(header108)
/// ‖ update(nonce32). The caller passes ownership to `Solver::run`.
fn ctx_for_nonce(pers16: &[u8; 16], header108: &[u8], nonce32: &[u8; 32]) -> *mut c_void {
    unsafe {
        let ctx = eq144_ctx_create(pers16.as_ptr(), header108.as_ptr(), header108.len(), 54);
        if ctx.is_null() {
            return ptr::null_mut();
        }
        eq144_ctx_update(ctx, nonce32.as_ptr(), NONCE_LEN);
        ctx
    }
}

/// Rust-side personalized midstate (blake2b_simd) — used only by the
/// solution verifier, not the mining hot loop.
fn verify_base_state(header108: &[u8], pers8: &[u8]) -> Option<blake2b_simd::State> {
    if header108.len() != INPUT_LEN || pers8.len() > 8 {
        return None;
    }
    let pers = personalization(pers8);
    let mut st = blake2b_simd::Params::new()
        .hash_length(HASHOUT)
        .personal(&pers)
        .to_state();
    st.update(header108);
    Some(st)
}

/// Compress 32 u32 indices into the 100-byte minimal (25-bit BE) encoding.
pub fn compress_indices(indices: &[u32; PROOFSIZE]) -> Vec<u8> {
    const BIT_LEN: usize = 25;
    const OUT_LEN: usize = PROOFSIZE * BIT_LEN / 8; // 100
    let mut out = Vec::with_capacity(OUT_LEN);
    let mut acc: u64 = 0;
    let mut bits: usize = 0;
    for idx in indices {
        acc = (acc << BIT_LEN) | (idx & 0x1ff_ffff) as u64;
        bits += BIT_LEN;
        while bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    debug_assert_eq!(out.len(), OUT_LEN);
    out
}

/// Reorder a solver-emitted index tree into the consensus-canonical form:
/// at every merge level, each left subtree's first index must be smaller
/// than its right sibling's (zcash `indices_before` rule). Tromp emits
/// leaves in discovery order — leaf pairs stay adjacent but deeper subtree
/// order can be scrambled.
pub fn canonicalize(indices: &mut [u32; PROOFSIZE]) {
    let mut w = 1usize;
    while w < PROOFSIZE {
        let mut s = 0;
        while s < PROOFSIZE {
            if indices[s] > indices[s + w] {
                indices[s..s + 2 * w].rotate_left(w);
            }
            s += 2 * w;
        }
        w *= 2;
    }
}

/// sha256d(header140 || varint(sol_len) || solution) — the PoW block hash
/// the share target applies to. CompactSize(100) is the single byte 0x64
/// (fd-prefixed varints only apply at >= 253 bytes).
pub fn share_hash(header140: &[u8], solution: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    let mut buf = Vec::with_capacity(HEADER_LEN + 3 + SOL_LEN);
    buf.extend_from_slice(header140);
    buf.extend_from_slice(&hasher::zcash_varint_for_len(solution.len()));
    buf.extend_from_slice(solution);
    let h1 = sha2::Sha256::digest(&buf);
    let h2 = sha2::Sha256::digest(h1);
    let mut out = [0u8; 32];
    out.copy_from_slice(&h2);
    out
}

/// Full validity check for a candidate solution (protects the upstream pool
/// from malformed shares): distinct indices, pairwise ordering, XOR tree
/// sums to zero. `indices` are the raw u32 proof values.
pub fn verify_indices(
    header108: &[u8],
    pers8: &[u8],
    nonce32: &[u8; 32],
    indices: &[u32; PROOFSIZE],
) -> bool {
    // indices must be in [0, 2^25): NBLOCKS is rounded up to a whole
    // blake2b output, so the solver can emit the out-of-range index 2^25
    // (which would silently truncate in the 25-bit wire encoding).
    const NHASHES: u32 = 1 << 25;
    if indices.iter().any(|&i| i >= NHASHES) {
        return false;
    }
    // distinct + pairwise ordered
    for i in (0..PROOFSIZE).step_by(2) {
        if indices[i] >= indices[i + 1] {
            return false;
        }
    }
    let mut seen = indices.to_vec();
    seen.sort_unstable();
    if seen.windows(2).any(|w| w[0] == w[1]) {
        return false;
    }
    let Some(base) = verify_base_state(header108, pers8) else {
        return false;
    };
    // recompute each 144-bit Xi and fold the XOR tree
    let mut level: Vec<[u8; 18]> = Vec::with_capacity(PROOFSIZE);
    for &idx in indices {
        let mut st = base.clone();
        st.update(nonce32);
        st.update(&(idx / 3).to_le_bytes());
        let out = st.finalize();
        let b = out.as_bytes();
        let off = (idx % 3) as usize * 18;
        let mut xi = [0u8; 18];
        xi.copy_from_slice(&b[off..off + 18]);
        level.push(xi);
    }
    while level.len() > 1 {
        let mut next = Vec::with_capacity(level.len() / 2);
        for pair in level.chunks_exact(2) {
            let mut x = [0u8; 18];
            for i in 0..18 {
                x[i] = pair[0][i] ^ pair[1][i];
            }
            next.push(x);
        }
        level = next;
    }
    level[0].iter().all(|&b| b == 0)
}

/// Scan `nonce_count` nonces starting at `start` on one solver ctx.
/// `header140` must already contain extranonce1 at bytes [108..108+en1).
/// The varying u64 nonce is written at [108+en1_len .. +8] little-endian.
/// Returns (nonce, wire_solution, share_hash) of the first target-meeting
/// valid share — `wire_solution` includes the CompactSize prefix (0x64 for
/// 100 bytes), matching what equihash pools expect in mining.submit.
pub fn scan(
    solver: &mut Solver,
    header140: &[u8],
    en1_len: usize,
    pers8: &[u8],
    target: &[u8; 32],
    start: u64,
    nonce_count: u64,
    cancel: &std::sync::atomic::AtomicBool,
) -> Option<(u64, Vec<u8>, [u8; 32])> {
    let pers16 = personalization(pers8);
    let header108 = &header140[..INPUT_LEN];
    let mut nonce_field = [0u8; NONCE_LEN];
    nonce_field[..en1_len].copy_from_slice(&header140[INPUT_LEN..INPUT_LEN + en1_len]);

    for off in 0..nonce_count {
        if cancel.load(std::sync::atomic::Ordering::Relaxed) {
            return None;
        }
        let nonce = start.wrapping_add(off);
        nonce_field[en1_len..en1_len + 8].copy_from_slice(&nonce.to_le_bytes());
        let ctx = ctx_for_nonce(&pers16, header108, &nonce_field);
        if ctx.is_null() {
            crate::ext_warn!("eq144: ctx alloc failed");
            return None;
        }
        let mut hdr = [0u8; HEADER_LEN];
        hdr.copy_from_slice(header140);
        hdr[INPUT_LEN..].copy_from_slice(&nonce_field);
        let mut nsols_total = 0usize;
        let mut nverify_fail = 0usize;
        let mut min_h0 = 0xFFu8;
        for mut indices in solver.run(ctx) {
            nsols_total += 1;
            if !verify_indices(header108, pers8, &nonce_field, &indices) {
                nverify_fail += 1;
                continue;
            }
            canonicalize(&mut indices);
            let sol = compress_indices(&indices);
            let h = share_hash(&hdr, &sol);
            if h[0] < min_h0 {
                min_h0 = h[0];
                if h[0] <= 0x0f {
                    crate::ext_warn!(nonce, hash = %hex::encode(h), "eq144: low-hex sol hash");
                }
            }
            // ZION_EQ144_FORCE_SUBMIT: emit the first valid sol regardless
            // of target — wire-path probe; upstream must reject with
            // "low difficulty" (format correct) rather than malformed-soln.
            let force = std::env::var_os("ZION_EQ144_FORCE_SUBMIT").is_some();
            if force || hasher::meets_target(&h, target) {
                // Soln prefix probes — upstream verifyEH slices the soln at a
                // fixed offset past the 140B header: +143 assumes a 3-byte
                // varint (fd6400), +141 assumes CompactSize (0x64), +140 none.
                // ZION_EQ144_SOLN=fd|raw overrides the default 0x64 prefix.
                match std::env::var("ZION_EQ144_SOLN").as_deref() {
                    Ok("raw") => return Some((nonce, sol, h)),
                    Ok("fd") => {
                        let mut w = vec![0xfd, 0x64, 0x00];
                        w.extend_from_slice(&sol);
                        return Some((nonce, w, h));
                    }
                    _ => {
                        let mut sol_wire = hasher::zcash_varint_for_len(SOL_LEN);
                        sol_wire.extend_from_slice(&sol);
                        return Some((nonce, sol_wire, h));
                    }
                }
            }
        }
        crate::ext_info!(nonce, nsols_total, nverify_fail, min_h0, "eq144: run complete");
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One full Wagner run over a synthetic header: solver must find
    /// ~2 solutions on average, each passing our strict verifier. Also
    /// cross-checks the C blake2b against blake2b_simd on the same pers.
    #[test]
    fn solver_finds_valid_144_5_solutions() {
        let mut solver = Solver::new().expect("solver alloc");
        let mut header = [0u8; HEADER_LEN];
        for (i, b) in header.iter_mut().enumerate() {
            *b = (i * 7 + 3) as u8;
        }
        let pers16 = personalization(b"sngemPoW");
        let nonce = [0x42u8; NONCE_LEN];
        let ctx = ctx_for_nonce(&pers16, &header[..INPUT_LEN], &nonce);
        let sols = solver.run(ctx);
        assert!(!sols.is_empty(), "expected ≥1 solution per run on average");
        for idx in &sols {
            assert!(
                verify_indices(&header[..INPUT_LEN], b"sngemPoW", &nonce, idx),
                "solver emitted invalid solution"
            );
            let mut cidx = *idx;
            canonicalize(&mut cidx);
            // Canonical reorder must preserve tree validity.
            assert!(
                verify_indices(&header[..INPUT_LEN], b"sngemPoW", &nonce, &cidx),
                "canonicalized solution no longer verifies"
            );
            // Canonical ordering: at every merge level each left subtree's
            // first index < its right sibling's (zcash indices_before).
            let mut w = 1usize;
            while w < PROOFSIZE {
                for s in (0..PROOFSIZE).step_by(2 * w) {
                    assert!(
                        cidx[s] < cidx[s + w],
                        "noncanonical order at level w={w} block {s}: {} !< {}",
                        cidx[s],
                        cidx[s + w]
                    );
                }
                w *= 2;
            }
            let sol = compress_indices(&cidx);
            assert_eq!(sol.len(), SOL_LEN);
        }
    }

    /// scan() with a trivially-passed target must return on the first
    /// verified solution, and the wire solution must be varint(0x64) ||
    /// 100B minimal encoding — the exact bytes submitted upstream.
    #[test]
    fn scan_returns_wire_formatted_share() {
        let mut solver = Solver::new().expect("solver alloc");
        let mut header = [0u8; HEADER_LEN];
        for (i, b) in header.iter_mut().enumerate() {
            *b = (i * 11 + 5) as u8;
        }
        let target = [0xFFu8; 32];
        let cancel = std::sync::atomic::AtomicBool::new(false);
        // One run finds ~1.8 sols on average — try up to 5 nonces so a
        // zero-solution run can't flake the test.
        let mut found = None;
        for n in 7..12u64 {
            if let Some(s) = scan(&mut solver, &header, 4, b"sngemPoW", &target, n, 1, &cancel) {
                found = Some(s);
                break;
            }
        }
        let (nonce, sol_wire, _h) = found.expect("easy target must produce a share within 5 runs");
        assert!((7..12).contains(&nonce));
        assert_eq!(sol_wire.len(), 1 + SOL_LEN);
        assert_eq!(sol_wire[0], 0x64);
    }
}
