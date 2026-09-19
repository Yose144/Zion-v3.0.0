//! OpenCL backend — checksum + PBKDF2 on any OpenCL GPU (NVIDIA, AMD,
//! Intel, Apple). The host keeps stage 4 (BIP32/secp256k1 + target match).
//!
//! Two kernels per batch (see kernel.cl): `bip39_filter` does the combo →
//! indices → checksum → phrase → U1 stages; `pbkdf2_step` runs the remaining
//! HMAC iterations in chunks — a full 2048-round PBKDF2 in one work-item
//! exceeds per-item execution limits on Apple OpenCL (verified: ~75% of
//! items silently die; chunked steps lose none).

use crate::engine::{Template, HOLE, MAX_HOLES, MAX_WORDS, WORDLIST};
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
/// Remaining PBKDF2 iterations per step launch — well under the observed
/// per-item limit (1536 iters verified safe on Apple; 512 has margin).
/// Total = 1 (U1 in filter) + 2047 across steps = 2048.
const STEP_ITERS: u32 = 512;
const REMAINING: u32 = 2048 - 1;
/// State record size — must match kernel.cl STATE_SIZE.
const STATE_SIZE: usize = 392;
const OFF_COMBO: usize = 0;
const OFF_PLEN: usize = 8;
const OFF_PHRASE: usize = 12;
const OFF_T: usize = 324;
const OFF_TAG: usize = 388;
const TAG_C: u32 = 0x9E3779B9;
const MAX_PHRASE: usize = 248;
/// Result ceiling per batch: worst pass rate is 1/16 (12-word checksum).
const RESULT_SLACK: usize = 1024;

fn cl_err(e: impl std::fmt::Display) -> anyhow::Error {
    anyhow::anyhow!("opencl: {e}")
}

pub struct Gpu {
    queue: CommandQueue,
    k_filter: Kernel,
    k_step: Kernel,
    k_perm: Kernel,
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
    /// Host copy of "mnemonic{pass}" — CPU-repairs records whose GPU
    /// work-item died mid-PBKDF2 (detected via the chain tag).
    salt_bytes: Vec<u8>,
    pub device_name: String,
}

impl Gpu {
    pub fn init(device_index: usize, max_batch: usize) -> Result<Self> {
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
        let opts = std::env::var("KERNEL_OPTS").unwrap_or_default();
        let program = Program::create_and_build_from_source(&context, KERNEL_SRC, &opts)
            .map_err(|e| anyhow::anyhow!("opencl kernel build: {e}"))?;
        let k_filter = Kernel::create(&program, "bip39_filter").map_err(cl_err)?;
        let k_step = Kernel::create(&program, "pbkdf2_step").map_err(cl_err)?;
        let k_perm = Kernel::create(&program, "permute_filter").map_err(cl_err)?;

        // wordlist blob + offsets (u16 — total < 16 KiB)
        let mut blob = Vec::with_capacity(16 * 1024);
        let mut offs = Vec::with_capacity(2049);
        for w in WORDLIST.lines().map(str::trim).filter(|w| !w.is_empty()) {
            offs.push(blob.len() as u16);
            blob.extend_from_slice(w.as_bytes());
        }
        offs.push(blob.len() as u16);
        assert_eq!(offs.len(), 2049);

        let max_results = max_batch / 8 + RESULT_SLACK;
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
            queue
                .enqueue_write_buffer(&mut wl_blob, CL_NON_BLOCKING, 0, &blob, &[])
                .map_err(cl_err)?;
            queue
                .enqueue_write_buffer(&mut wl_off, CL_NON_BLOCKING, 0, &offs, &[])
                .map_err(cl_err)?;
            queue.finish().map_err(cl_err)?;
            Ok(Gpu {
                queue,
                k_filter,
                k_step,
                k_perm,
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
        #[allow(unused_unsafe)]
        unsafe {
            self.queue
                .enqueue_write_buffer(&mut self.words, CL_NON_BLOCKING, 0, &w, &[])
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

    /// Stage 2 + readback shared by derive_batch/derive_perm_batch:
    /// runs the remaining PBKDF2 chunks on `got` state records and returns
    /// `(record_id, seed)` pairs. Each step launch extends a chain tag in
    /// the record; records whose GPU work-item died mid-chain fail the
    /// final tag check and are recomputed on CPU from their stored phrase.
    #[allow(unused_unsafe)]
    unsafe fn finish_batch(&mut self, got: usize) -> Result<Vec<(u64, [u8; 64])>> {
        // remaining 2047 PBKDF2 iterations in chunks
        // (512, 512, 512, 511 — never overshoot the count)
        let mut left = REMAINING;
        let mut seq = 0u32;
        while left > 0 {
            let it = STEP_ITERS.min(left);
            seq += 1;
            let mut ex = ExecuteKernel::new(&self.k_step);
            ex.set_arg(&self.states).set_arg(&it).set_arg(&seq);
            ex.set_global_work_size(got)
                .enqueue_nd_range(&self.queue)
                .map_err(cl_err)?;
            left -= it;
        }
        self.queue.finish().map_err(cl_err)?;

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
        Ok(out)
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

    /// One batch: combos `base .. base+n` → `(combo, seed)` pairs.
    pub fn derive_batch(
        &mut self,
        tpl: &Template,
        base: u64,
        n: usize,
    ) -> Result<Vec<(u64, [u8; 64])>> {
        if n > self.max_batch {
            bail!("batch {n} exceeds GPU max_batch {}", self.max_batch);
        }
        #[allow(unused_unsafe)]
        unsafe {
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
            if got == 0 {
                return Ok(Vec::new());
            }
            self.finish_batch(got)
        }
    }

    /// One batch of the permutation domain: perm numbers `base .. base+n`
    /// → `(perm, seed)` pairs. `n_words` = length of the bound word list.
    pub fn derive_perm_batch(
        &mut self,
        n_words: usize,
        base: u64,
        n: usize,
    ) -> Result<Vec<(u64, [u8; 64])>> {
        if n > self.max_batch {
            bail!("batch {n} exceeds GPU max_batch {}", self.max_batch);
        }
        #[allow(unused_unsafe)]
        unsafe {
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
                .set_arg(&self.states);
            ex.set_global_work_size(n)
                .enqueue_nd_range(&self.queue)
                .map_err(cl_err)?;
            self.queue.finish().map_err(cl_err)?;

            let got = self.result_count()?;
            if got == 0 {
                return Ok(Vec::new());
            }
            self.finish_batch(got)
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
        let mut gpu_out = g.derive_batch(&tpl, 0, 1 << 16).unwrap();
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
        let gpu_out = g.derive_perm_batch(widx.len(), 0, 1 << 16).unwrap();
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
}
