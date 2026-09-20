//! OpenCL backend — checksum + PBKDF2 + (optionally) stage 4 on any OpenCL
//! GPU (NVIDIA, AMD, Intel, Apple).
//!
//! Three kernels per batch (see kernel.cl): `bip39_filter` does the combo →
//! indices → checksum → phrase → U1 stages; `pbkdf2_step` runs the remaining
//! HMAC iterations in chunks — a full 2048-round PBKDF2 in one work-item
//! exceeds per-item execution limits on Apple OpenCL (verified: ~75% of
//! items silently die; chunked steps lose none). When `bind_match` has run,
//! `derive_match` then does BIP32/secp256k1/hash160/target matching on-GPU
//! and only hits come back over PCIe; without it the host keeps stage 4.

use crate::engine::{DerivePlan, TargetSet, Template, HOLE, MAX_HOLES, MAX_WORDS, WORDLIST};
use anyhow::{bail, Result};
use opencl3::command_queue::CommandQueue;
use opencl3::context::Context as ClContext;
use opencl3::device::{get_all_devices, Device, CL_DEVICE_TYPE_GPU};
use opencl3::kernel::{ExecuteKernel, Kernel};
use opencl3::memory::{Buffer, CL_MEM_READ_ONLY, CL_MEM_READ_WRITE};
use opencl3::program::Program;
use opencl3::types::{cl_uint, cl_ulong, CL_BLOCKING, CL_NON_BLOCKING};
use std::cell::Cell;

const KERNEL_SRC: &str = include_str!("kernel.cl");
/// Remaining PBKDF2 iterations per step launch — the chunking exists for
/// drivers with per-item execution limits (Apple loses ~75% of items at the
/// full count — verified 2026-09). NVIDIA has no such limit, so it runs all
/// 2047 in one launch (saves 3 record load/store round-trips per seed).
/// PBKDF2_STEP_ITERS overrides both.
const STEP_ITERS: u32 = 512;
const REMAINING: u32 = 2048 - 1;
/// State record size — must match kernel.cl STATE_SIZE (392 + 128 B of
/// HMAC midstates appended at OFF_HI/OFF_HO; earlier offsets unchanged).
const STATE_SIZE: usize = 520;
const OFF_COMBO: usize = 0;
const OFF_PLEN: usize = 8;
const OFF_PHRASE: usize = 12;
const OFF_T: usize = 324;
const OFF_TAG: usize = 388;
const TAG_C: u32 = 0x9E3779B9;
const MAX_PHRASE: usize = 248;
/// Result ceiling per batch: worst pass rate is 1/16 (12-word checksum).
const RESULT_SLACK: usize = 1024;
/// Hit record stride in the derive_match output buffer: u64 id + 64B seed.
const HIT_REC: usize = 8 + 64;
/// Dead-item record stride: u64 id + u32 plen + phrase bytes.
const BAD_REC: usize = 8 + 4 + MAX_PHRASE;

/// One derive batch result. `seeds` = records needing host attention —
/// in GPU-match mode that is only hits plus CPU-repaired dead items;
/// in host-match mode it is every checksum-valid seed. `valid` = how many
/// checksum-valid seeds the batch contained (progress accounting).
pub struct BatchOut {
    pub seeds: Vec<(u64, [u8; 64])>,
    pub valid: u64,
}

fn cl_err(e: impl std::fmt::Display) -> anyhow::Error {
    anyhow::anyhow!("opencl: {e}")
}

/// Fixed-base window table for the kernel's `ec_mult_g`: entry
/// `(w*15 + d-1)` is affine (x‖y, u32 LE limbs) of `d·2^{4w}·G`,
/// d=1..15, w=0..63 — 960 points = 61,440 B. Built once at init; the
/// kernel then does ≤64 mixed additions per pubkey instead of ~256
/// doublings + ~128 adds.
fn g_table() -> Vec<u32> {
    use bitcoin::secp256k1::{PublicKey, Secp256k1, SecretKey};
    let secp = Secp256k1::new();
    let mut t = Vec::with_capacity(64 * 15 * 16);
    for w in 0..64usize {
        let limb = (4 * w) / 32;
        let sh = (4 * w) % 32;
        for v in 1..16u32 {
            let mut kb = [0u8; 32];
            let l = v << sh; // ≤ 15·2^28 < 2^32 — nibble never crosses a limb
            kb[28 - 4 * limb..32 - 4 * limb].copy_from_slice(&l.to_be_bytes());
            let pk = PublicKey::from_secret_key(&secp, &SecretKey::from_slice(&kb).unwrap());
            let un = pk.serialize_uncompressed(); // 04 ‖ x_be(32) ‖ y_be(32)
            for i in 0..8 {
                t.push(u32::from_be_bytes(un[29 - 4 * i..33 - 4 * i].try_into().unwrap()));
            }
            for i in 0..8 {
                t.push(u32::from_be_bytes(un[61 - 4 * i..65 - 4 * i].try_into().unwrap()));
            }
        }
    }
    t
}

pub struct Gpu {
    context: ClContext,
    queue: CommandQueue,
    k_filter: Kernel,
    k_step: Kernel,
    k_perm: Kernel,
    k_match: Kernel,
    max_batch: usize,
    max_results: usize,
    salt_len: Cell<u32>,
    wl_blob: Buffer<u8>,
    wl_off: Buffer<u16>,
    templ: Buffer<u16>,
    hole_pos: Buffer<u8>,
    words: Buffer<u16>,
    salt: Buffer<u8>,
    count: Buffer<u32>,
    states: Buffer<u8>,
    plan_buf: Buffer<u32>,
    targets_buf: Buffer<u8>,
    xtargets_buf: Buffer<u8>,
    gtab: Buffer<u32>,
    hit_count: Buffer<u32>,
    bad_count: Buffer<u32>,
    hits_buf: Buffer<u8>,
    bads_buf: Buffer<u8>,
    /// Permute phrase-dedupe set: open-addressed u64 table, 2^21 slots.
    dedup: Buffer<u64>,
    /// Hit/dead output capacity per batch (≤ max_results).
    out_cap: usize,
    n_targets: u32,
    n_xtargets: u32,
    /// Set by bind_match — switches finish_batch to the on-GPU stage 4.
    match_bound: bool,
    /// PBKDF2 iterations per step launch (see STEP_ITERS comment).
    step_iters: u32,
    /// Host copy of "mnemonic{pass}" — CPU-repairs records whose GPU
    /// work-item died mid-PBKDF2 (detected via the chain tag).
    salt_bytes: Vec<u8>,
    pub device_name: String,
}

impl Gpu {
    pub fn init(device_index: usize, max_batch: usize) -> Result<Self> {
        // checksum pass rate ≤ 1/16 (12-word) → /8 + slack covers it; the
        // permute path dedupes phrases in-kernel, so the same bound holds
        // there (records ≤ distinct valid phrases ≤ ~1/16 of perms)
        Self::init_ex(device_index, max_batch, max_batch / 8 + RESULT_SLACK)
    }

    fn init_ex(device_index: usize, max_batch: usize, max_results: usize) -> Result<Self> {
        let gpus = get_all_devices(CL_DEVICE_TYPE_GPU).unwrap_or_default();
        if gpus.is_empty() {
            bail!("no OpenCL GPU devices found");
        }
        let dev_id = *gpus.get(device_index).ok_or_else(|| {
            anyhow::anyhow!("gpu index {device_index} out of range ({} devices)", gpus.len())
        })?;
        let device = Device::new(dev_id);
        let device_name = device.name().unwrap_or_else(|_| "?".into());
        let context = ClContext::from_device(&device).map_err(cl_err)?;
        // macOS ships OpenCL 1.2 only — the 2.0 create-with-properties
        // symbol is absent from the framework, so it needs the legacy call.
        #[cfg(target_os = "macos")]
        let queue = CommandQueue::create(&context, dev_id, 0).map_err(cl_err)?;
        #[cfg(not(target_os = "macos"))]
        let queue =
            CommandQueue::create_with_properties(&context, dev_id, 0, 0).map_err(cl_err)?;
        // NVIDIA: register-cap the two pipeline stages separately — the
        // filter runs best at ~40 regs (occupancy), pbkdf2_step at ~64
        // (measured on GTX 1070 Ti: +34% filter, +79% pbkdf2 vs default).
        // KERNEL_OPTS overrides both; KERNEL_OPTS_{FILTER,STEP} win per-stage.
        let env_opts = std::env::var("KERNEL_OPTS").unwrap_or_default();
        let is_nv = {
            let v = device.vendor().unwrap_or_default().to_lowercase();
            let n = device_name.to_lowercase();
            v.contains("nvidia") || n.contains("nvidia") || n.contains("geforce")
        };
        let pick = |var: &str, nv_default: &str| -> String {
            std::env::var(var).unwrap_or_else(|_| {
                if !env_opts.is_empty() {
                    env_opts.clone()
                } else if is_nv {
                    nv_default.into()
                } else {
                    String::new()
                }
            })
        };
        let opts_f = pick("KERNEL_OPTS_FILTER", "-cl-nv-maxrregcount=40");
        let opts_s = pick("KERNEL_OPTS_STEP", "-cl-nv-maxrregcount=64");
        // Chunked beats single-launch even on NVIDIA (measured GTX 1070 Ti:
        // 4×512 ≈ 42k seeds/s vs 1×2047 ≈ 36k — inter-chunk scheduling
        // absorbs item-time variance, one giant launch can't rebalance).
        let step_iters = std::env::var("PBKDF2_STEP_ITERS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(STEP_ITERS);
        let prog_f = Program::create_and_build_from_source(&context, KERNEL_SRC, &opts_f)
            .map_err(|e| anyhow::anyhow!("opencl filter build: {e}"))?;
        let prog_s = if opts_s == opts_f {
            None
        } else {
            Some(
                Program::create_and_build_from_source(&context, KERNEL_SRC, &opts_s)
                    .map_err(|e| anyhow::anyhow!("opencl step build: {e}"))?,
            )
        };
        let prog_step = prog_s.as_ref().unwrap_or(&prog_f);
        let k_filter = Kernel::create(&prog_f, "bip39_filter").map_err(cl_err)?;
        let k_step = Kernel::create(prog_step, "pbkdf2_step").map_err(cl_err)?;
        let k_perm = Kernel::create(&prog_f, "permute_filter").map_err(cl_err)?;
        // derive_match is register-hungry (secp256k1) — it shares the step
        // program's looser cap rather than the filter's occupancy-tuned 40.
        let k_match = Kernel::create(prog_step, "derive_match").map_err(cl_err)?;

        // wordlist blob + offsets (u16 — total < 16 KiB)
        let mut blob = Vec::with_capacity(16 * 1024);
        let mut offs = Vec::with_capacity(2049);
        for w in WORDLIST.lines().map(str::trim).filter(|w| !w.is_empty()) {
            offs.push(blob.len() as u16);
            blob.extend_from_slice(w.as_bytes());
        }
        offs.push(blob.len() as u16);
        assert_eq!(offs.len(), 2049);

        // hit/dead output buffers are capped — hits are rare by definition
        // and dead items are a driver pathology, not a throughput path
        let out_cap = max_results.min(1 << 20);
        #[allow(unused_unsafe)]
        unsafe {
            let mut wl_blob = Buffer::<u8>::create(
                &context,
                CL_MEM_READ_ONLY,
                blob.len(),
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            let mut wl_off = Buffer::<u16>::create(
                &context,
                CL_MEM_READ_ONLY,
                offs.len(),
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            let templ =
                Buffer::<u16>::create(&context, CL_MEM_READ_ONLY, MAX_WORDS, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let hole_pos =
                Buffer::<u8>::create(&context, CL_MEM_READ_ONLY, MAX_HOLES, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let words =
                Buffer::<u16>::create(&context, CL_MEM_READ_ONLY, MAX_WORDS, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let salt = Buffer::<u8>::create(&context, CL_MEM_READ_ONLY, 128, std::ptr::null_mut())
                .map_err(cl_err)?;
            let count =
                Buffer::<u32>::create(&context, CL_MEM_READ_WRITE, 1, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let states = Buffer::<u8>::create(
                &context,
                CL_MEM_READ_WRITE,
                max_results * STATE_SIZE,
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            // stage-4 buffers — sized to max_results so an overflow can never
            // silently drop a hit or a dead record (both are ≤ got ≤ max_results)
            let plan_buf =
                Buffer::<u32>::create(&context, CL_MEM_READ_ONLY, 13, std::ptr::null_mut())
                    .map_err(cl_err)?;
            // bind_match recreates these sized to the actual target lists
            let targets_buf =
                Buffer::<u8>::create(&context, CL_MEM_READ_ONLY, 20, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let xtargets_buf =
                Buffer::<u8>::create(&context, CL_MEM_READ_ONLY, 32, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let mut gtab = Buffer::<u32>::create(
                &context,
                CL_MEM_READ_ONLY,
                64 * 15 * 16,
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            let hit_count =
                Buffer::<u32>::create(&context, CL_MEM_READ_WRITE, 1, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let bad_count =
                Buffer::<u32>::create(&context, CL_MEM_READ_WRITE, 1, std::ptr::null_mut())
                    .map_err(cl_err)?;
            let hits_buf = Buffer::<u8>::create(
                &context,
                CL_MEM_READ_WRITE,
                out_cap * HIT_REC,
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            let bads_buf = Buffer::<u8>::create(
                &context,
                CL_MEM_READ_WRITE,
                out_cap * BAD_REC,
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            let dedup = Buffer::<u64>::create(
                &context,
                CL_MEM_READ_WRITE,
                1 << 21,
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            queue
                .enqueue_write_buffer(&mut wl_blob, CL_NON_BLOCKING, 0, &blob, &[])
                .map_err(cl_err)?;
            queue
                .enqueue_write_buffer(&mut wl_off, CL_NON_BLOCKING, 0, &offs, &[])
                .map_err(cl_err)?;
            let gt = g_table();
            queue
                .enqueue_write_buffer(&mut gtab, CL_NON_BLOCKING, 0, &gt, &[])
                .map_err(cl_err)?;
            queue.finish().map_err(cl_err)?;
            Ok(Gpu {
                context,
                queue,
                k_filter,
                k_step,
                k_perm,
                k_match,
                max_batch,
                max_results,
                salt_len: Cell::new(0),
                wl_blob,
                wl_off,
                templ,
                hole_pos,
                words,
                salt,
                count,
                states,
                plan_buf,
                targets_buf,
                xtargets_buf,
                gtab,
                hit_count,
                bad_count,
                hits_buf,
                bads_buf,
                dedup,
                out_cap,
                n_targets: 0,
                n_xtargets: 0,
                match_bound: false,
                step_iters,
                salt_bytes: Vec::new(),
                device_name,
            })
        }
    }

    /// Upload job constants (template, hole positions, salt). Once per search.
    pub fn bind(&mut self, tpl: &Template, passphrase: &str) -> Result<()> {
        let mut t = [HOLE; MAX_WORDS];
        t[..tpl.indices.len()].copy_from_slice(&tpl.indices);
        let mut hp = [0u8; MAX_HOLES];
        for (i, &h) in tpl.holes.iter().enumerate() {
            hp[i] = h as u8;
        }
        let salt = format!("mnemonic{passphrase}");
        if salt.len() > 128 {
            bail!("passphrase too long (max 120 bytes)");
        }
        let mut sbuf = [0u8; 128];
        sbuf[..salt.len()].copy_from_slice(salt.as_bytes());
        #[allow(unused_unsafe)]
        unsafe {
            self.queue
                .enqueue_write_buffer(&mut self.templ, CL_NON_BLOCKING, 0, &t, &[])
                .map_err(cl_err)?;
            self.queue
                .enqueue_write_buffer(&mut self.hole_pos, CL_NON_BLOCKING, 0, &hp, &[])
                .map_err(cl_err)?;
            self.queue
                .enqueue_write_buffer(&mut self.salt, CL_NON_BLOCKING, 0, &sbuf, &[])
                .map_err(cl_err)?;
            self.queue.finish().map_err(cl_err)?;
        }
        self.salt_len.set(salt.len() as u32);
        self.salt_bytes = salt.into_bytes();
        Ok(())
    }

    /// Upload constants for a permutation job: sorted word indices + salt.
    /// `words` must be sorted ascending — host `perm_indices` decodes the
    /// same numbering the kernel uses.
    pub fn bind_permute(&mut self, words: &[u16], passphrase: &str) -> Result<()> {
        if words.len() > MAX_WORDS {
            bail!("{} words exceeds MAX_WORDS", words.len());
        }
        let mut w = [0u16; MAX_WORDS];
        w[..words.len()].copy_from_slice(words);
        let salt = format!("mnemonic{passphrase}");
        if salt.len() > 128 {
            bail!("passphrase too long (max 120 bytes)");
        }
        let mut sbuf = [0u8; 128];
        sbuf[..salt.len()].copy_from_slice(salt.as_bytes());
        let zeros = vec![0u64; 1 << 21];
        #[allow(unused_unsafe)]
        unsafe {
            self.queue
                .enqueue_write_buffer(&mut self.words, CL_NON_BLOCKING, 0, &w, &[])
                .map_err(cl_err)?;
            self.queue
                .enqueue_write_buffer(&mut self.salt, CL_NON_BLOCKING, 0, &sbuf, &[])
                .map_err(cl_err)?;
            // fresh search → clear the dedupe set (it persists per run, so
            // phrases repeated across batches are PBKDF2'd only once)
            self.queue
                .enqueue_write_buffer(&mut self.dedup, CL_NON_BLOCKING, 0, &zeros, &[])
                .map_err(cl_err)?;
            self.queue.finish().map_err(cl_err)?;
        }
        self.salt_len.set(salt.len() as u32);
        self.salt_bytes = salt.into_bytes();
        Ok(())
    }

    /// Upload the stage-4 job (derivation plan + target hash160s) and switch
    /// derive_batch/derive_perm_batch into GPU-match mode: `derive_match`
    /// runs the whole BIP32 walk on the GPU and only hits + dead records
    /// come back. Plan limits: ≤8 purposes, chains ⊆ {0,1}.
    pub fn bind_match(&mut self, plan: &DerivePlan, targets: &TargetSet) -> Result<()> {
        if plan.purposes.len() > 8 {
            bail!("GPU match supports ≤8 purposes (got {})", plan.purposes.len());
        }
        if plan.chains.iter().any(|&c| c > 1) {
            bail!("GPU match supports chains 0/1 only");
        }
        let mut pw = [0u32; 13];
        pw[0] = plan.purposes.len() as u32;
        pw[1] = plan.coin;
        pw[2] = plan.accounts;
        pw[3] = plan.chains.iter().fold(0u32, |m, &c| m | (1 << c));
        pw[4] = plan.max_index;
        for (i, &p) in plan.purposes.iter().enumerate() {
            pw[5 + i] = p;
        }
        let mut sorted: Vec<[u8; 20]> = targets.hashes.iter().copied().collect();
        sorted.sort_unstable();
        let mut tb = Vec::with_capacity(20 * sorted.len().max(1));
        for h in &sorted {
            tb.extend_from_slice(h);
        }
        let mut xsorted: Vec<[u8; 32]> = targets.xkeys.iter().copied().collect();
        xsorted.sort_unstable();
        let mut xb = Vec::with_capacity(32 * xsorted.len().max(1));
        for k in &xsorted {
            xb.extend_from_slice(k);
        }
        #[allow(unused_unsafe)]
        unsafe {
            // empty target lists still need a nonzero-size buffer
            self.targets_buf = Buffer::<u8>::create(
                &self.context,
                CL_MEM_READ_ONLY,
                tb.len().max(20),
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            self.xtargets_buf = Buffer::<u8>::create(
                &self.context,
                CL_MEM_READ_ONLY,
                xb.len().max(32),
                std::ptr::null_mut(),
            )
            .map_err(cl_err)?;
            self.queue
                .enqueue_write_buffer(&mut self.plan_buf, CL_NON_BLOCKING, 0, &pw, &[])
                .map_err(cl_err)?;
            if !tb.is_empty() {
                self.queue
                    .enqueue_write_buffer(&mut self.targets_buf, CL_NON_BLOCKING, 0, &tb, &[])
                    .map_err(cl_err)?;
            }
            if !xb.is_empty() {
                self.queue
                    .enqueue_write_buffer(&mut self.xtargets_buf, CL_NON_BLOCKING, 0, &xb, &[])
                    .map_err(cl_err)?;
            }
            self.queue.finish().map_err(cl_err)?;
        }
        self.n_targets = sorted.len() as u32;
        self.n_xtargets = xsorted.len() as u32;
        self.match_bound = true;
        Ok(())
    }

    /// Stage 2 driver shared by both readback modes: runs the remaining
    /// PBKDF2 chunks on `got` state records and returns the number of step
    /// launches (the chain tag multiplier the records must carry).
    #[allow(unused_unsafe)]
    unsafe fn run_steps(&mut self, got: usize) -> Result<u32> {
        // remaining 2047 PBKDF2 iterations in chunks of `step_iters`
        // (NVIDIA: one launch of 2047; Apple-safe default: 512,512,512,511)
        let mut left = REMAINING;
        let mut seq = 0u32;
        while left > 0 {
            let it = self.step_iters.min(left);
            seq += 1;
            let mut ex = ExecuteKernel::new(&self.k_step);
            ex.set_arg(&self.states).set_arg(&it).set_arg(&seq);
            ex.set_global_work_size(got)
                .enqueue_nd_range(&self.queue)
                .map_err(cl_err)?;
            left -= it;
        }
        self.queue.finish().map_err(cl_err)?;
        Ok(seq)
    }

    /// Stage 2 + readback shared by derive_batch/derive_perm_batch.
    /// Each step launch extends a chain tag in the record; records whose
    /// GPU work-item died mid-chain fail the final tag check and are
    /// recomputed on CPU from their stored phrase.
    #[allow(unused_unsafe)]
    unsafe fn finish_batch(&mut self, got: usize) -> Result<BatchOut> {
        let seq = self.run_steps(got)?;
        if self.match_bound {
            return self.match_readback(got, seq);
        }

        // read back state records → verify chain tag → (record_id, seed=T)
        let mut raw = vec![0u8; got * STATE_SIZE];
        self.queue
            .enqueue_read_buffer(&mut self.states, CL_BLOCKING, 0, &mut raw, &[])
            .map_err(cl_err)?;
        let want_tail = seq.wrapping_mul(TAG_C);
        let mut repaired = 0u64;
        let mut dropped = 0u64;
        let out = raw
            .chunks_exact(STATE_SIZE)
            .filter_map(|st| {
                let id = u64::from_le_bytes(st[OFF_COMBO..OFF_COMBO + 8].try_into().unwrap());
                let seed: [u8; 64] = st[OFF_T..OFF_T + 64].try_into().unwrap();
                let tag = u32::from_le_bytes(st[OFF_TAG..OFF_TAG + 4].try_into().unwrap());
                let head = u32::from_le_bytes(st[OFF_T..OFF_T + 4].try_into().unwrap());
                if tag == (head ^ want_tail) {
                    return Some((id, seed));
                }
                // GPU item died mid-chain — recompute from the stored phrase
                let plen =
                    u32::from_le_bytes(st[OFF_PLEN..OFF_PLEN + 4].try_into().unwrap()) as usize;
                if plen == 0 || plen > MAX_PHRASE {
                    dropped += 1;
                    return None;
                }
                let phrase = &st[OFF_PHRASE..OFF_PHRASE + plen];
                let Ok(phrase) = std::str::from_utf8(phrase) else {
                    dropped += 1;
                    return None;
                };
                let mut s = [0u8; 64];
                pbkdf2::pbkdf2_hmac::<sha2::Sha512>(
                    phrase.as_bytes(),
                    &self.salt_bytes,
                    2048,
                    &mut s,
                );
                repaired += 1;
                Some((id, s))
            })
            .collect();
        if repaired + dropped > 0 {
            eprintln!("gpu: repaired {repaired} / dropped {dropped} dead-item records");
        }
        Ok(BatchOut {
            seeds: out,
            valid: got as u64,
        })
    }

    /// GPU-match readback: run `derive_match` over the finished records and
    /// pull back only hits (id+seed) and dead items (id+phrase → CPU redo).
    #[allow(unused_unsafe)]
    unsafe fn match_readback(&mut self, got: usize, seq: u32) -> Result<BatchOut> {
        self.queue
            .enqueue_write_buffer(&mut self.hit_count, CL_NON_BLOCKING, 0, &[0u32], &[])
            .map_err(cl_err)?;
        self.queue
            .enqueue_write_buffer(&mut self.bad_count, CL_NON_BLOCKING, 0, &[0u32], &[])
            .map_err(cl_err)?;
        let mut ex = ExecuteKernel::new(&self.k_match);
        ex.set_arg(&self.states)
            .set_arg(&self.plan_buf)
            .set_arg(&self.targets_buf)
            .set_arg(&self.gtab)
            .set_arg(&self.n_targets)
            .set_arg(&self.xtargets_buf)
            .set_arg(&self.n_xtargets)
            .set_arg(&seq)
            .set_arg(&self.hit_count)
            .set_arg(&self.hits_buf)
            .set_arg(&self.bad_count)
            .set_arg(&self.bads_buf)
            .set_arg(&(self.out_cap as cl_uint));
        ex.set_global_work_size(got)
            .enqueue_nd_range(&self.queue)
            .map_err(cl_err)?;
        self.queue.finish().map_err(cl_err)?;

        let mut cnts = [0u32; 2];
        self.queue
            .enqueue_read_buffer(&self.hit_count, CL_BLOCKING, 0, &mut cnts[..1], &[])
            .map_err(cl_err)?;
        self.queue
            .enqueue_read_buffer(&self.bad_count, CL_BLOCKING, 0, &mut cnts[1..], &[])
            .map_err(cl_err)?;
        let n_hit = (cnts[0] as usize).min(self.out_cap);
        let n_bad = (cnts[1] as usize).min(self.out_cap);
        if cnts[0] as usize > n_hit || cnts[1] as usize > n_bad {
            eprintln!(
                "gpu: WARNING match output overflow (hits {} bads {}) — enlarge batch",
                cnts[0], cnts[1]
            );
        }

        let mut seeds = Vec::with_capacity(n_hit + n_bad);
        if n_hit > 0 {
            let mut hraw = vec![0u8; n_hit * HIT_REC];
            self.queue
                .enqueue_read_buffer(&self.hits_buf, CL_BLOCKING, 0, &mut hraw, &[])
                .map_err(cl_err)?;
            for r in hraw.chunks_exact(HIT_REC) {
                let id = u64::from_le_bytes(r[..8].try_into().unwrap());
                let seed: [u8; 64] = r[8..72].try_into().unwrap();
                seeds.push((id, seed));
            }
        }
        if n_bad > 0 {
            let mut braw = vec![0u8; n_bad * BAD_REC];
            self.queue
                .enqueue_read_buffer(&self.bads_buf, CL_BLOCKING, 0, &mut braw, &[])
                .map_err(cl_err)?;
            let mut repaired = 0u64;
            for r in braw.chunks_exact(BAD_REC) {
                let id = u64::from_le_bytes(r[..8].try_into().unwrap());
                let plen = u32::from_le_bytes(r[8..12].try_into().unwrap()) as usize;
                if plen == 0 || plen > MAX_PHRASE {
                    continue;
                }
                let Ok(phrase) = std::str::from_utf8(&r[12..12 + plen]) else {
                    continue;
                };
                let mut s = [0u8; 64];
                pbkdf2::pbkdf2_hmac::<sha2::Sha512>(
                    phrase.as_bytes(),
                    &self.salt_bytes,
                    2048,
                    &mut s,
                );
                repaired += 1;
                seeds.push((id, s));
            }
            eprintln!("gpu: repaired {repaired} dead-item records");
        }
        Ok(BatchOut {
            seeds,
            valid: got as u64,
        })
    }

    /// Reads the filter result count, bails on overflow.
    #[allow(unused_unsafe)]
    unsafe fn result_count(&mut self) -> Result<usize> {
        let mut cnt = [0u32];
        self.queue
            .enqueue_read_buffer(&self.count, CL_BLOCKING, 0, &mut cnt, &[])
            .map_err(cl_err)?;
        if cnt[0] as usize > self.max_results {
            bail!("result overflow ({}) — reduce --batch", cnt[0]);
        }
        Ok(cnt[0] as usize)
    }

    /// One batch: combos `base .. base+n` → BatchOut (all valid seeds, or
    /// only hits+repaired when bind_match ran).
    pub fn derive_batch(
        &mut self,
        tpl: &Template,
        base: u64,
        n: usize,
    ) -> Result<BatchOut> {
        if n > self.max_batch {
            bail!("batch {n} exceeds GPU max_batch {}", self.max_batch);
        }
        #[allow(unused_unsafe)]
        unsafe {
            let debug = std::env::var_os("BTCUNLOCK_DEBUG").is_some();
            let t0 = std::time::Instant::now();
            // stage 1 — filter + U1
            self.queue
                .enqueue_write_buffer(&mut self.count, CL_NON_BLOCKING, 0, &[0u32], &[])
                .map_err(cl_err)?;
            let mut ex = ExecuteKernel::new(&self.k_filter);
            ex.set_arg(&self.wl_blob)
                .set_arg(&self.wl_off)
                .set_arg(&self.templ)
                .set_arg(&(tpl.indices.len() as cl_uint))
                .set_arg(&self.hole_pos)
                .set_arg(&(tpl.holes.len() as cl_uint))
                .set_arg(&(base as cl_ulong))
                .set_arg(&self.salt)
                .set_arg(&self.salt_len.get())
                .set_arg(&(self.max_results as cl_uint))
                .set_arg(&self.count)
                .set_arg(&self.states);
            ex.set_global_work_size(n)
                .enqueue_nd_range(&self.queue)
                .map_err(cl_err)?;
            self.queue.finish().map_err(cl_err)?;

            let got = self.result_count()?;
            if debug {
                eprintln!("gpu: filter {n} combos → {got} seeds in {:.2?}", t0.elapsed());
            }
            if got == 0 {
                return Ok(BatchOut {
                    seeds: Vec::new(),
                    valid: 0,
                });
            }
            let out = self.finish_batch(got);
            if debug {
                eprintln!("gpu: pbkdf2 {got} seeds in {:.2?}", t0.elapsed());
            }
            out
        }
    }

    /// One batch of the permutation domain: perm numbers `base .. base+n`
    /// → BatchOut. `n_words` = length of the bound word list.
    pub fn derive_perm_batch(
        &mut self,
        n_words: usize,
        base: u64,
        n: usize,
    ) -> Result<BatchOut> {
        if n > self.max_batch {
            bail!("batch {n} exceeds GPU max_batch {}", self.max_batch);
        }
        #[allow(unused_unsafe)]
        unsafe {
            let debug = std::env::var_os("BTCUNLOCK_DEBUG").is_some();
            let t0 = std::time::Instant::now();
            self.queue
                .enqueue_write_buffer(&mut self.count, CL_NON_BLOCKING, 0, &[0u32], &[])
                .map_err(cl_err)?;
            let mut ex = ExecuteKernel::new(&self.k_perm);
            ex.set_arg(&self.wl_blob)
                .set_arg(&self.wl_off)
                .set_arg(&self.words)
                .set_arg(&(n_words as cl_uint))
                .set_arg(&(base as cl_ulong))
                .set_arg(&self.salt)
                .set_arg(&self.salt_len.get())
                .set_arg(&(self.max_results as cl_uint))
                .set_arg(&self.count)
                .set_arg(&self.states)
                .set_arg(&self.dedup)
                .set_arg(&((1u32 << 21) - 1));
            ex.set_global_work_size(n)
                .enqueue_nd_range(&self.queue)
                .map_err(cl_err)?;
            self.queue.finish().map_err(cl_err)?;

            let got = self.result_count()?;
            if debug {
                eprintln!("gpu: filter {n} perms → {got} seeds in {:.2?}", t0.elapsed());
            }
            if got == 0 {
                return Ok(BatchOut {
                    seeds: Vec::new(),
                    valid: 0,
                });
            }
            let out = self.finish_batch(got);
            if debug {
                eprintln!("gpu: pbkdf2 {got} seeds in {:.2?}", t0.elapsed());
            }
            out
        }
    }
}

/// Enumerate OpenCL GPU devices (for `gpu-list` / diagnostics).
pub fn list_devices() -> Vec<String> {
    get_all_devices(CL_DEVICE_TYPE_GPU)
        .unwrap_or_default()
        .into_iter()
        .map(|d| {
            let dev = Device::new(d);
            format!(
                "{} — {} CUs",
                dev.name().unwrap_or_else(|_| "?".into()),
                dev.max_compute_units().unwrap_or(0)
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{cpu_seeds, parse_template};

    /// GPU vs CPU on the same combo range — exact seed parity required.
    /// Run: cargo test --features gpu gpu::tests -- --ignored
    #[test]
    #[ignore]
    fn gpu_cpu_parity() {
        let tpl = parse_template(
            "abandon abandon abandon abandon abandon abandon abandon abandon \
             abandon abandon abandon abandon abandon abandon abandon abandon \
             abandon abandon abandon abandon abandon ? ? ?",
        )
        .unwrap();
        let mut g = Gpu::init(0, 1 << 20).unwrap();
        g.bind(&tpl, "").unwrap();
        let mut gpu_out = g.derive_batch(&tpl, 0, 1 << 16).unwrap().seeds;
        let cpu_out = cpu_seeds(&tpl, "", 0, 1 << 16);
        gpu_out.sort_by_key(|x| x.0);
        let mut cpu_sorted = cpu_out;
        cpu_sorted.sort_by_key(|x| x.0);
        eprintln!("gpu={} cpu={}", gpu_out.len(), cpu_sorted.len());
        if gpu_out.len() == cpu_sorted.len() {
            for (g,c) in gpu_out.iter().zip(cpu_sorted.iter()) {
                if g.0 != c.0 { eprintln!("combo mismatch gpu={} cpu={}", g.0, c.0); break; }
                if g.1 != c.1 { eprintln!("seed mismatch combo={}
gpu={}
cpu={}", g.0, hex::encode(g.1), hex::encode(c.1)); break; }
            }
        }
        assert_eq!(gpu_out.len(), cpu_sorted.len(), "valid-count mismatch");
        for (g, c) in gpu_out.iter().zip(cpu_sorted.iter()) {
            assert_eq!(g.0, c.0, "combo order differs");
            assert_eq!(g.1, c.1, "seed mismatch at combo {}", g.0);
        }
    }

    /// GPU vs CPU on the permutation domain — same perm numbers, byte-exact
    /// seeds. Run: cargo test --features gpu gpu::tests -- --ignored
    #[test]
    #[ignore]
    fn gpu_cpu_permute_parity() {
        use crate::engine::{perm_seeds, word_index};
        // canonical valid 12-word vector is abandon×11 + "about" — every
        // perm number that leaves "about" in the last slot passes checksum
        let mut widx: Vec<u16> = "abandon abandon abandon abandon abandon abandon \
            abandon abandon abandon abandon abandon about"
            .split_whitespace()
            .map(|w| word_index(w).unwrap())
            .collect();
        widx.sort_unstable();
        let mut g = Gpu::init(0, 1 << 20).unwrap();
        g.bind_permute(&widx, "").unwrap();
        let gpu_out = g.derive_perm_batch(widx.len(), 0, 1 << 16).unwrap().seeds;
        // CPU dedupes repeated phrases (dup words) pre-PBKDF2; compare the
        // unique seed sets — GPU emits every valid perm incl. dup phrases.
        let cpu_out = perm_seeds(&widx, "", 0, 1 << 16, None);
        // diagnostics: group GPU output by seed, show minority records
        {
            use std::collections::HashMap;
            let mut by_seed: HashMap<[u8; 64], Vec<u64>> = HashMap::new();
            for (p, s) in &gpu_out {
                by_seed.entry(*s).or_default().push(*p);
            }
            let mut groups: Vec<_> = by_seed.iter().collect();
            groups.sort_by_key(|(_, v)| std::cmp::Reverse(v.len()));
            for (i, (seed, ids)) in groups.iter().take(4).enumerate() {
                eprintln!(
                    "  gpu-seed[{i}] ×{} — first ids {:?} — seed[..8]={:02x?}",
                    ids.len(),
                    &ids[..ids.len().min(8)],
                    &seed[..8]
                );
            }
        }
        let mut gpu_seeds: Vec<[u8; 64]> = gpu_out.iter().map(|x| x.1).collect();
        gpu_seeds.sort();
        gpu_seeds.dedup();
        let mut cpu_seeds: Vec<[u8; 64]> = cpu_out.iter().map(|x| x.1).collect();
        cpu_seeds.sort();
        cpu_seeds.dedup();
        eprintln!("perm gpu={} cpu={} uniq_gpu={}", gpu_out.len(), cpu_out.len(), gpu_seeds.len());
        assert_eq!(gpu_seeds.len(), cpu_seeds.len(), "perm unique-seed count mismatch");
        for (gs, cs) in gpu_seeds.iter().zip(cpu_seeds.iter()) {
            assert_eq!(gs, cs, "perm seed mismatch");
        }
    }

    /// GPU stage-4: bind a target, mask the last word of the canonical
    /// 24-word vector, and require derive_match to return exactly its hit.
    /// Run: cargo test --features gpu gpu::tests -- --ignored
    #[test]
    #[ignore]
    fn gpu_match_finds_known() {
        use crate::engine::{DerivePlan, TargetSet};
        use bip39::{Language, Mnemonic};
        use bitcoin::bip32::DerivationPath;
        use bitcoin::secp256k1::Secp256k1;
        use bitcoin::{Address, Network, PublicKey};
        use std::str::FromStr;

        const KNOWN: &str = "abandon abandon abandon abandon abandon abandon abandon abandon \
            abandon abandon abandon abandon abandon abandon abandon abandon \
            abandon abandon abandon abandon abandon abandon abandon art";
        let m = Mnemonic::parse_in_normalized(Language::English, KNOWN).unwrap();
        let secp = Secp256k1::new();
        let xp = bitcoin::bip32::Xpriv::new_master(Network::Bitcoin, &m.to_seed("")).unwrap();
        let child = xp
            .derive_priv(&secp, &DerivationPath::from_str("m/84'/0'/0'/0/0").unwrap())
            .unwrap();
        let pk = PublicKey::new(child.private_key.public_key(&secp));
        let want = Address::p2wpkh(&pk, Network::Bitcoin).unwrap().to_string();

        let mut ts = TargetSet::default();
        ts.add(&want).unwrap();
        let plan = DerivePlan::standard(Network::Bitcoin, &[84], 1, 1, false).unwrap();
        let tpl = parse_template(&KNOWN.replacen("art", "?", 1)).unwrap();
        let mut g = Gpu::init(0, 1 << 20).unwrap();
        g.bind(&tpl, "").unwrap();
        g.bind_match(&plan, &ts).unwrap();
        let out = g.derive_batch(&tpl, 0, 2048).unwrap();
        assert_eq!(out.seeds.len(), 1, "exactly one GPU hit expected");
        // the hit seed must re-derive to the target on the host
        let hits = crate::engine::match_seed(&out.seeds[0].1, &plan, &ts);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].0, "m/84'/0'/0'/0/0");
        assert_eq!(hits[0].1.to_string(), want);
    }

    /// GPU stage-4 taproot: purpose 86, bc1p target — the kernel must
    /// reproduce the host's tweaked-xonly output key.
    /// Run: cargo test --features gpu gpu::tests -- --ignored
    #[test]
    #[ignore]
    fn gpu_match_finds_taproot() {
        use crate::engine::{DerivePlan, TargetSet};
        use bip39::{Language, Mnemonic};
        use bitcoin::bip32::DerivationPath;
        use bitcoin::secp256k1::Secp256k1;
        use bitcoin::{Address, Network};
        use std::str::FromStr;

        const KNOWN: &str = "abandon abandon abandon abandon abandon abandon abandon abandon \
            abandon abandon abandon abandon abandon abandon abandon abandon \
            abandon abandon abandon abandon abandon abandon abandon art";
        let m = Mnemonic::parse_in_normalized(Language::English, KNOWN).unwrap();
        let secp = Secp256k1::new();
        let xp = bitcoin::bip32::Xpriv::new_master(Network::Bitcoin, &m.to_seed("")).unwrap();
        let child = xp
            .derive_priv(&secp, &DerivationPath::from_str("m/86'/0'/0'/0/0").unwrap())
            .unwrap();
        let (xonly, _) = child.private_key.public_key(&secp).x_only_public_key();
        let want = Address::p2tr(&secp, xonly, None, Network::Bitcoin).to_string();

        let mut ts = TargetSet::default();
        ts.add(&want).unwrap();
        let plan = DerivePlan::standard(Network::Bitcoin, &[86], 1, 1, false).unwrap();
        let tpl = parse_template(&KNOWN.replacen("art", "?", 1)).unwrap();
        let mut g = Gpu::init(0, 1 << 20).unwrap();
        g.bind(&tpl, "").unwrap();
        g.bind_match(&plan, &ts).unwrap();
        let out = g.derive_batch(&tpl, 0, 2048).unwrap();
        assert_eq!(out.seeds.len(), 1, "exactly one GPU taproot hit expected");
        let hits = crate::engine::match_seed(&out.seeds[0].1, &plan, &ts);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].0, "m/86'/0'/0'/0/0");
        assert_eq!(hits[0].1.to_string(), want);
    }
}
