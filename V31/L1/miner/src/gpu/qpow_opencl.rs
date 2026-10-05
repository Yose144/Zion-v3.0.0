//! Dedicated OpenCL backend for Quantus QPoW (Poseidon2 over the Goldilocks
//! field) — the AMD counterpart of `qpow_cuda.rs`.
//!
//! Runs `csrc/opencl/poseidon2_kernel.cl` (a line-level port of the CUDA
//! G2 kernel) behind the same buffer ABI:
//!   - results:        u32[9]   — candidate count, up to 8 logical indices
//!   - prestate:       u32[24]  — 12 Goldilocks limbs as LE u32 pairs
//!   - start_nonce:    u32[16]  — U512 little-endian limbs
//!   - difficulty:     u32[16]  — U512 little-endian limbs
//!   - dispatch:       u32[3]   — {total_threads, nonces_per_thread, total}
//!
//! Vega notes (gfx900, wave64): local work size is pinned to one wavefront
//! (64) by default and the kernel keeps `nonces_per_thread` small — the
//! 12-lane u64 sponge state is register-hungry on GCN. Override via
//! `ZION_QPOW_OCL_LOCAL_SIZE` / `ZION_QPOW_OCL_NPT`.

use anyhow::Result;
use ocl::builders::ProgramBuilder;
use ocl::flags::MemFlags;
use ocl::{Buffer, Kernel, ProQue};

use crate::auxpow::qpow;

const POSEIDON2_CL: &str = include_str!("../../csrc/opencl/poseidon2_kernel.cl");

const QPOW_KERNEL: &str = "qpow_mine";
/// Candidate slots recorded per launch (mirrors upstream `MAX_HITS`).
const MAX_HITS: usize = 8;
/// u32[9]: hit count + up to `MAX_HITS` logical indices.
const RESULT_WORDS: usize = 1 + MAX_HITS;

use crate::gpu::QpowGpuResult;

/// Persistent OpenCL miner for `qpow-poseidon2`.
pub struct QpowOpenclMiner {
    pro_que: ProQue,
    device_name_cached: String,
    /// Local work-group size (one wavefront = 64 on GCN).
    local_size: usize,
    /// Nonces scanned per work-item inside the kernel loop.
    nonces_per_thread: u32,
    results_buf: Buffer<u32>,
    midstate_buf: Buffer<u32>,
    start_nonce_buf: Buffer<u32>,
    target_buf: Buffer<u32>,
    dispatch_buf: Buffer<u32>,
}

impl QpowOpenclMiner {
    /// Create the miner on the OpenCL device picked by the standard
    /// `ZION_OCL_PLATFORM_IDX` / `ZION_OCL_DEVICE_IDX` / `ZION_OCL_DEVICE_NAME`
    /// env overrides (the same selection the AuxPoW external miner uses, so
    /// `ZION_ZANO_DEVICE_NAME=vega` keeps QPoW on the reserved Vega).
    pub fn new(work_size: usize) -> Result<Self> {
        let (platform, device, platform_name, device_name) =
            crate::auxpow::gpu_opencl_full::ExtGpuMiner::pick_opencl_device()?;

        let local_size = std::env::var("ZION_QPOW_OCL_LOCAL_SIZE")
            .ok()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .map(|v| v.clamp(32, 256))
            .unwrap_or(64);
        let nonces_per_thread = std::env::var("ZION_QPOW_OCL_NPT")
            .ok()
            .and_then(|v| v.trim().parse::<u32>().ok())
            .unwrap_or(1)
            .max(1);

        let mut prog = ProgramBuilder::new();
        prog.src(POSEIDON2_CL);
        // The wrapper ships `-cl-std=CL1.2 -cl-mad-enable` via
        // ZION_OCL_BUILD_OPTS; honor the same env override here.
        let opts = std::env::var("ZION_OCL_BUILD_OPTS")
            .unwrap_or_else(|_| "-cl-std=CL1.2 -cl-mad-enable".to_string());
        prog.cmplr_opt(&opts);

        let pro_que = ProQue::builder()
            .platform(platform)
            .device(device)
            .prog_bldr(prog)
            .dims(work_size.max(local_size))
            .build()
            .map_err(|e| anyhow::anyhow!("OpenCL build failed for qpow: {e}"))?;
        let q = pro_que.queue().clone();

        let results_buf = Buffer::<u32>::builder()
            .queue(q.clone())
            .flags(MemFlags::READ_WRITE)
            .len(RESULT_WORDS)
            .build()
            .map_err(|e| anyhow::anyhow!("qpow results alloc: {e}"))?;
        let midstate_buf = Buffer::<u32>::builder()
            .queue(q.clone())
            .flags(MemFlags::READ_ONLY)
            .len(24)
            .build()
            .map_err(|e| anyhow::anyhow!("qpow prestate alloc: {e}"))?;
        let start_nonce_buf = Buffer::<u32>::builder()
            .queue(q.clone())
            .flags(MemFlags::READ_ONLY)
            .len(16)
            .build()
            .map_err(|e| anyhow::anyhow!("qpow nonce alloc: {e}"))?;
        let target_buf = Buffer::<u32>::builder()
            .queue(q.clone())
            .flags(MemFlags::READ_ONLY)
            .len(16)
            .build()
            .map_err(|e| anyhow::anyhow!("qpow target alloc: {e}"))?;
        let dispatch_buf = Buffer::<u32>::builder()
            .queue(q.clone())
            .flags(MemFlags::READ_ONLY)
            .len(3)
            .build()
            .map_err(|e| anyhow::anyhow!("qpow dispatch alloc: {e}"))?;

        crate::ext_info!(
            "gpu_qpow_opencl_init platform=\"{}\" device=\"{}\" work_size={} lws={} npt={}",
            platform_name,
            device_name,
            work_size,
            local_size,
            nonces_per_thread,
        );

        Ok(Self {
            pro_que,
            device_name_cached: device_name,
            local_size,
            nonces_per_thread,
            results_buf,
            midstate_buf,
            start_nonce_buf,
            target_buf,
            dispatch_buf,
        })
    }

    pub fn device_name(&self) -> String {
        self.device_name_cached.clone()
    }

    /// Scan `total` candidate nonces, starting from `nonce_be` interpreted as
    /// a big-endian U512. Same contract as `QpowCudaMiner::mine_batch`:
    /// only the low 64 nonce bits advance and every recorded candidate is
    /// recomputed on the CPU before it may reach the wire.
    pub fn mine_batch(
        &mut self,
        header: &[u8; qpow::QPOW_HEADER_LEN],
        nonce_be: &[u8; qpow::QPOW_NONCE_LEN],
        target: &[u8; qpow::QPOW_TARGET_LEN],
        total: u64,
    ) -> Result<Option<QpowGpuResult>> {
        let low64_base = u64::from_be_bytes(nonce_be[56..64].try_into().expect("nonce len"));
        // Headroom until the low 64 bits carry into the high half.
        let headroom = match low64_base.wrapping_neg() {
            0 => u64::MAX,
            h => h,
        };
        let total64 = total.min(headroom).min(u32::MAX as u64);
        let total32 = total64 as u32;
        if total32 == 0 {
            return Ok(None);
        }

        // Host-side prestate: header + nonce_be[0..56] absorbed, initial
        // linear layer + round-0 constants already applied.
        let mid = qpow::mining_prestate_low64(header, nonce_be);
        let mut midstate32 = [0u32; 24];
        for i in 0..12 {
            midstate32[2 * i] = mid[i] as u32;
            midstate32[2 * i + 1] = (mid[i] >> 32) as u32;
        }
        let start_nonce = u512_be_to_limbs(nonce_be);
        let target_limbs = u512_be_to_limbs(target);

        let npt = self.nonces_per_thread;
        let total_threads = total32.div_ceil(npt);
        let gws = (total_threads as usize).div_ceil(self.local_size) * self.local_size;

        let t_up = std::time::Instant::now();
        // Reset + upload
        self.results_buf
            .write(&vec![0u32; RESULT_WORDS])
            .enq()
            .map_err(|e| anyhow::anyhow!("qpow results reset: {e}"))?;
        self.midstate_buf
            .write(&midstate32.to_vec())
            .enq()
            .map_err(|e| anyhow::anyhow!("qpow midstate upload: {e}"))?;
        self.start_nonce_buf
            .write(&start_nonce.to_vec())
            .enq()
            .map_err(|e| anyhow::anyhow!("qpow nonce upload: {e}"))?;
        self.target_buf
            .write(&target_limbs.to_vec())
            .enq()
            .map_err(|e| anyhow::anyhow!("qpow target upload: {e}"))?;
        self.dispatch_buf
            .write(&vec![total_threads, npt, total32])
            .enq()
            .map_err(|e| anyhow::anyhow!("qpow dispatch upload: {e}"))?;

        let kernel = Kernel::builder()
            .queue(self.pro_que.queue().clone())
            .program(self.pro_que.program())
            .name(QPOW_KERNEL)
            .arg(&self.results_buf)
            .arg(&self.midstate_buf)
            .arg(&self.start_nonce_buf)
            .arg(&self.target_buf)
            .arg(&self.dispatch_buf)
            .build()
            .map_err(|e| anyhow::anyhow!("qpow kernel build: {e}"))?;

        let up_ms = t_up.elapsed();
        let t_kern = std::time::Instant::now();
        unsafe {
            kernel
                .cmd()
                .global_work_size(gws)
                .local_work_size(self.local_size)
                .enq()
                .map_err(|e| anyhow::anyhow!("qpow launch: {e}"))?;
        }
        self.pro_que
            .queue()
            .finish()
            .map_err(|e| anyhow::anyhow!("qpow queue finish: {e}"))?;
        let kern_ms = t_kern.elapsed();
        if std::env::var("QPOW_TIMING").is_ok() {
            eprintln!(
                "qpow_timing(cl): upload={:?} kernel_sync={:?} threads={} npt={} gws={}",
                up_ms, kern_ms, total_threads, npt, gws
            );
        }

        let t_dl = std::time::Instant::now();
        let mut results = vec![0u32; RESULT_WORDS];
        self.results_buf
            .read(&mut results)
            .enq()
            .map_err(|e| anyhow::anyhow!("qpow results download: {e}"))?;
        let dl_ms = t_dl.elapsed();
        let hits = results[0] as usize;
        if hits == 0 {
            if std::env::var("QPOW_TIMING").is_ok() {
                eprintln!(
                    "qpow_timing(cl): download={:?} total={:?} hits=0",
                    dl_ms,
                    t_up.elapsed()
                );
            }
            return Ok(None);
        }
        let recorded = hits.min(MAX_HITS);
        if hits > MAX_HITS {
            crate::ext_warn!(
                "qpow launch produced {} candidates, only {} slots",
                hits,
                MAX_HITS
            );
        }

        // The kernel's lazy 128-bit reduction can slip by ±EPS on ~1 in 3e6
        // nonces, so every recorded index is recomputed and verified on the
        // CPU before it may reach the wire.
        let mut best: Option<([u8; 64], [u8; 64])> = None;
        for &index in &results[1..=recorded] {
            let low64 = low64_base.wrapping_add(index as u64);
            let mut nonce = *nonce_be;
            nonce[56..64].copy_from_slice(&low64.to_be_bytes());
            let hash = qpow::get_nonce_hash(header, &nonce);
            if hash.as_slice() >= target.as_slice() {
                crate::ext_warn!("qpow GPU candidate {} rejected by CPU verification", index);
                continue;
            }
            let better = best
                .as_ref()
                .map(|(n, _)| nonce.as_slice() < n.as_slice())
                .unwrap_or(true);
            if better {
                best = Some((nonce, hash));
            }
        }

        if std::env::var("QPOW_TIMING").is_ok() {
            eprintln!(
                "qpow_timing(cl): download={:?} total={:?} hits={}",
                dl_ms,
                t_up.elapsed(),
                hits
            );
        }
        Ok(best.map(|(nonce, hash)| QpowGpuResult {
            nonce,
            hash,
            nonces_tested: total32 as u64,
        }))
    }
}

/// Pack a 64-byte big-endian U512 into 16 little-endian u32 limbs
/// (the kernel/host wire format).
fn u512_be_to_limbs(wire: &[u8; 64]) -> [u32; 16] {
    let mut limbs = [0u32; 16];
    for i in 0..16 {
        limbs[i] = u32::from_be_bytes([
            wire[60 - 4 * i],
            wire[61 - 4 * i],
            wire[62 - 4 * i],
            wire[63 - 4 * i],
        ]);
    }
    limbs
}

/// Inverse of `u512_be_to_limbs`.
#[cfg(test)]
fn limbs_to_u512_be(limbs: &[u32; 16]) -> [u8; 64] {
    let mut wire = [0u8; 64];
    for i in 0..16 {
        wire[60 - 4 * i..64 - 4 * i].copy_from_slice(&limbs[i].to_be_bytes());
    }
    wire
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Bit-exact Rust mirror of `poseidon2_kernel.cl` — same lazy-reduction
    /// semantics as the PTX carry chains, used to bisect kernel bugs on the
    /// host before any GPU is involved.
    mod cl_mirror {
        pub const P64: u64 = 0xFFFFFFFF00000001;
        const EPS64: u64 = 0xFFFFFFFF;
        const EPS32: u32 = 0xFFFFFFFF;

        const RC_INTERNAL: [u64; 23] = [
            0x97f7798a784ad863,
            0xd1d2bf082f60d4f0,
            0x69a377a79f9ad206,
            0xa9d06906a3858e24,
            0x295275001eede5b5,
            0x5874e441117bd746,
            0x8a084bbba8ed86cc,
            0x3defd7645cde6425,
            0x3998cfe6871cc137,
            0x3e52ef8bca48314a,
            0x964a209f85dc9ecc,
            0x3fcc9ee82cc4577e,
            0x8e79b4a5d0096d6d,
            0x8492362ad2392556,
            0xee72f470262574d6,
            0x1e0e18496da2444a,
            0x0f3a74bf215eaac6,
            0x1b061b76a1c0ded3,
            0x192c42d86803d7a6,
            0xf6d49ff997ae0260,
            0x3ec372e7a0fa3786,
            0x5538cdf4f23445d3,
            0,
        ];
        const RC_INITIAL: [[u64; 12]; 5] = [
            [
                0xc002e770975b1607,
                0xbca51a8dfe14593a,
                0x72938dfbe774f7f9,
                0xe4f2fe29e03234ac,
                0xd5e0ba2f541b6449,
                0xec33b868f3cc46c1,
                0x486dcb55419d475a,
                0x6c1cb2a358cc24f1,
                0xe3f30d509a1436bb,
                0xd9a64f068dca7c29,
                0xe59b3f57aabba1ae,
                0x2a3dd4505b478fdc,
            ],
            [
                0xada1f8dc7676ed25,
                0x2711aa8b5509d516,
                0x4ae6acd0c9c92897,
                0x56eb3d6b5256d67a,
                0x1f7a9d55923bf51e,
                0x3600427d397a7f68,
                0xe5076df75b72c3d0,
                0xfcd59aa12c6090ad,
                0xcd895e8c68b57a9e,
                0x41df7ef9d730ae3e,
                0xee3e2b889abe977d,
                0xd29bb7edbeb9c405,
            ],
            [
                0x7d5c08eef608e382,
                0x89ae889caaf0802c,
                0xb35a8e976d2af617,
                0xdb14234eafaf5173,
                0x78f04462d48b1c98,
                0x265293b0e47ce88a,
                0x999a649b69b9d32f,
                0x64b0a186698e01d3,
                0xee0b22d0dfae8bb8,
                0x4fd53e50ca04a7ee,
                0x5762bfe181f25047,
                0xf51593e2beb5e3bd,
            ],
            [
                0x1e5e2b5760e32477,
                0x622462a1f9aaaeed,
                0xaa284b3ecdb222ae,
                0x63c8e72f542bf3fc,
                0x3ba588cacb43b5e0,
                0x23eda6f3c99150dd,
                0xaad3bea4baac9a5a,
                0xe9da8d699b94184a,
                0xcdb13f4cd93e024c,
                0x902cbd0956f655e3,
                0x5b4e40ffc759532f,
                0xde795c20a2357af7,
            ],
            [0x97f7798a784ad863, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ];
        const RC_TERMINAL: [[u64; 12]; 5] = [
            [
                0x7b72c539e0ea4c6e,
                0x144573dae2ce9976,
                0x802028b68f35fc88,
                0x6d36c5022c4fe7c2,
                0xa205d0ffa9b9def3,
                0xf6e7e38b1ea6ba2f,
                0x34f7909ae5258d64,
                0xb0464d9d77b97fca,
                0x64ddb9d5de7e00a6,
                0x0ed0d75c27975d97,
                0x1cbb36f11127338b,
                0x6673e505cfd0b6ba,
            ],
            [
                0x605f902830872e01,
                0x3fd5eb927e95fe4f,
                0xe81025b5a24c69cd,
                0xf7d0ce75de23f74e,
                0xf39942b6a8585089,
                0x6d808a08f7b71df6,
                0xf8806b6588f49a8b,
                0x57df2d8c2a32107a,
                0x16e7c2074d654a2d,
                0x213de241fcf33835,
                0xb0f2b8905a0976f6,
                0xd8e3cf2bbd355417,
            ],
            [
                0xe498691679d9330f,
                0x763b45d2a3821b28,
                0x0908bf65eb0a1f0d,
                0x7691eb2d194b24f4,
                0x0e43551233ae13b2,
                0x93c393dbfc2fe76f,
                0x98f607485d48cdea,
                0xe3d95f30309819c0,
                0x1ef581a93eaf6acf,
                0x0b24c1b7a030fca4,
                0x624370be5670b327,
                0x5f1e28615a11e486,
            ],
            [
                0xfe04051f909e042b,
                0x7257e5b147fd3803,
                0xe6ae134bb82f2e78,
                0x5711fd5cf4784511,
                0xf83a42660c08c0bc,
                0x2cd8c96d9a3ce855,
                0x7d2ffb1bb0e17271,
                0x85ae1528caea3811,
                0x52a345d5c7adb0b8,
                0x504c4c51f3faee94,
                0xbce34a649cfccaf9,
                0xe0a3389266fb6dc9,
            ],
            [0; 12],
        ];
        const MDS_DIAG: [u64; 12] = [
            0xc3b6c08e23ba9300,
            0xd84b5de94a324fb6,
            0x0d0c371c5b35b84f,
            0x7964f570e7188037,
            0x5daf18bbd996604b,
            0x6743bc47b9595257,
            0x5528b9362c59bb70,
            0xac45e25b7127b68b,
            0xa2077d7dfbb606b5,
            0xf3faac6faee378ae,
            0x0c6388b51545e883,
            0xd27dbb6944917b60,
        ];

        fn gf64_add(a: u64, b: u64) -> u64 {
            let mut s = a.wrapping_add(b);
            if s < a {
                s = s.wrapping_add(EPS64);
            }
            s
        }

        fn mul64wide(a: u64, b: u64) -> (u32, u32, u32, u32) {
            let p = (a as u128) * (b as u128);
            (
                p as u32,
                (p >> 32) as u32,
                (p >> 64) as u32,
                (p >> 96) as u32,
            )
        }

        /// Exact mirror of `reduce128` in poseidon2_kernel.cl.
        fn reduce128(r0: u32, r1: u32, r2: u32, r3: u32) -> u64 {
            let x0 = ((r1 as u64) << 32) | (r0 as u64);
            let mut s = x0.wrapping_add((r2 as u64).wrapping_mul(EPS64));
            let k = (s < x0) as u64;
            s = s.wrapping_add(k << 32);
            s.wrapping_sub((r3 as u64) + k)
        }

        fn gf64_mul(a: u64, b: u64) -> u64 {
            let (r0, r1, r2, r3) = mul64wide(a, b);
            reduce128(r0, r1, r2, r3)
        }

        fn gf64_sqr(a: u64) -> u64 {
            let a0 = (a as u32) as u64;
            let a1 = a >> 32;
            let ll = a0 * a0;
            let lh = a0 * a1;
            let hh = a1 * a1;
            let lo = ll.wrapping_add(lh << 33);
            let hi = hh
                .wrapping_add(lh >> 31)
                .wrapping_add(if lo < ll { 1 } else { 0 });
            reduce128(lo as u32, (lo >> 32) as u32, hi as u32, (hi >> 32) as u32)
        }

        fn gf64_sbox(x: u64) -> u64 {
            let x2 = gf64_sqr(x);
            let x3 = gf64_mul(x2, x);
            let x4 = gf64_sqr(x2);
            gf64_mul(x4, x3)
        }

        pub fn gf64_canon(a: u64) -> u64 {
            a - if a >= P64 { P64 } else { 0 }
        }

        #[derive(Clone, Copy)]
        struct Wide {
            l0: u32,
            l1: u32,
            h: u32,
        }
        fn wide_from(x: u64) -> Wide {
            Wide {
                l0: x as u32,
                l1: (x >> 32) as u32,
                h: 0,
            }
        }
        fn wide_add(w: &mut Wide, x: u64) {
            let s = (w.l0 as u64) + (x as u32 as u64);
            w.l0 = s as u32;
            let t = (w.l1 as u64) + ((x >> 32) as u32 as u64) + (s >> 32);
            w.l1 = t as u32;
            w.h = w.h.wrapping_add((t >> 32) as u32);
        }
        fn wide_add_wide(w: &mut Wide, x: Wide) {
            let s = (w.l0 as u64) + (x.l0 as u64);
            w.l0 = s as u32;
            let t = (w.l1 as u64) + (x.l1 as u64) + (s >> 32);
            w.l1 = t as u32;
            w.h = w.h.wrapping_add(x.h).wrapping_add((t >> 32) as u32);
        }
        fn wide_reduce(w: Wide) -> u64 {
            reduce128(w.l0, w.l1, w.h, 0)
        }
        fn add128_wide(r: &mut (u32, u32, u32, u32), w: Wide) {
            let s = (r.0 as u64) + (w.l0 as u64);
            r.0 = s as u32;
            let t = (r.1 as u64) + (w.l1 as u64) + (s >> 32);
            r.1 = t as u32;
            let u = (r.2 as u64) + (w.h as u64) + (t >> 32);
            r.2 = u as u32;
            r.3 = r.3.wrapping_add((u >> 32) as u32);
        }

        fn ext_layer64(state: &mut [u64; 12], rc12: &[u64; 12]) {
            let mut y = [wide_from(0); 12];
            for chunk in 0..3 {
                let o = chunk * 4;
                let (x0, x1, x2, x3) = (state[o], state[o + 1], state[o + 2], state[o + 3]);
                let mut t01 = wide_from(x0);
                wide_add(&mut t01, x1);
                let mut t23 = wide_from(x2);
                wide_add(&mut t23, x3);
                let mut t0123 = t01;
                wide_add_wide(&mut t0123, t23);
                let mut t01123 = t0123;
                wide_add(&mut t01123, x1);
                let mut t01233 = t0123;
                wide_add(&mut t01233, x3);
                y[o + 3] = t01233;
                wide_add(&mut y[o + 3], x0);
                wide_add(&mut y[o + 3], x0);
                y[o + 1] = t01123;
                wide_add(&mut y[o + 1], x2);
                wide_add(&mut y[o + 1], x2);
                y[o] = t01123;
                wide_add_wide(&mut y[o], t01);
                y[o + 2] = t01233;
                wide_add_wide(&mut y[o + 2], t23);
            }
            let mut sums = [wide_from(0); 4];
            for k in 0..4 {
                sums[k] = y[k];
                wide_add_wide(&mut sums[k], y[k + 4]);
                wide_add_wide(&mut sums[k], y[k + 8]);
            }
            for i in 0..12 {
                let mut w = y[i];
                wide_add_wide(&mut w, sums[i % 4]);
                wide_add(&mut w, rc12[i]);
                state[i] = wide_reduce(w);
            }
        }

        fn int_round_p(state: &mut [u64; 12], x: u64, rc0: u64) -> u64 {
            let mut s = wide_from(state[1]);
            for i in 2..12 {
                wide_add(&mut s, state[i]);
            }
            wide_add(&mut s, x);
            let mut s0 = s;
            wide_add(&mut s0, rc0);
            let mut r = mul64wide(x, MDS_DIAG[0]);
            add128_wide(&mut r, s0);
            let out0 = reduce128(r.0, r.1, r.2, r.3);
            for i in 1..12 {
                let mut r = mul64wide(state[i], MDS_DIAG[i]);
                add128_wide(&mut r, s);
                state[i] = reduce128(r.0, r.1, r.2, r.3);
            }
            out0
        }

        fn permute64_after_initial(state: &mut [u64; 12]) {
            for r in 0..4 {
                for i in 0..12 {
                    state[i] = gf64_sbox(state[i]);
                }
                ext_layer64(state, &RC_INITIAL[r + 1]);
            }
            let mut x = gf64_sbox(state[0]);
            for r in 0..21 {
                x = gf64_sbox(int_round_p(state, x, RC_INTERNAL[r + 1]));
            }
            state[0] = int_round_p(state, x, 0);
            for i in 0..12 {
                state[i] = gf64_add(state[i], RC_TERMINAL[0][i]);
            }
            for r in 0..4 {
                for i in 0..12 {
                    state[i] = gf64_sbox(state[i]);
                }
                ext_layer64(state, &RC_TERMINAL[r + 1]);
            }
        }

        fn permute64_twice_after_initial(state: &mut [u64; 12]) {
            for pass in 0..2 {
                if pass != 0 {
                    ext_layer64(state, &RC_INITIAL[0]);
                }
                permute64_after_initial(state);
                if pass == 0 {
                    state[0] = gf64_add(state[0], 1);
                    state[1] = gf64_add(state[1], 1);
                }
            }
        }

        /// Post-inject (pre-permute) state — for bisecting kernel vs mirror.
        pub fn inject_state(prestate: &[u64; 12], nonce_low_base: u64, index: u32) -> [u64; 12] {
            let mut st = *prestate;
            let nonce_low = nonce_low_base.wrapping_add(index as u64);
            let x6 = ((nonce_low >> 32) as u32).swap_bytes() as u64;
            let x7 = (nonce_low as u32).swap_bytes() as u64;
            let x6_2 = x6 + x6;
            let x6_3 = x6_2 + x6;
            let x6_4 = x6_2 + x6_2;
            let x6_6 = x6_3 + x6_3;
            let x7_2 = x7 + x7;
            let x7_3 = x7_2 + x7;
            let x7_4 = x7_2 + x7_2;
            let x7_6 = x7_3 + x7_3;
            let c0 = x6 + x7;
            let c1 = x6_3 + x7;
            let c2 = x6_2 + x7_3;
            let c3 = x6 + x7_2;
            st[0] = gf64_add(st[0], c0);
            st[1] = gf64_add(st[1], c1);
            st[2] = gf64_add(st[2], c2);
            st[3] = gf64_add(st[3], c3);
            st[4] = gf64_add(st[4], x6_2 + x7_2);
            st[5] = gf64_add(st[5], x6_6 + x7_2);
            st[6] = gf64_add(st[6], x6_4 + x7_6);
            st[7] = gf64_add(st[7], x6_2 + x7_4);
            st[8] = gf64_add(st[8], c0);
            st[9] = gf64_add(st[9], c1);
            st[10] = gf64_add(st[10], c2);
            st[11] = gf64_add(st[11], c3);
            st
        }

        /// Kernel-equivalent first squeeze for `logical_index` — returns the
        /// 8 u32 words the kernel compares against the target high half.
        pub fn eval_first8(prestate: &[u64; 12], nonce_low_base: u64, index: u32) -> [u32; 8] {
            let mut st = inject_state(prestate, nonce_low_base, index);
            permute64_twice_after_initial(&mut st);
            let mut first = [0u32; 8];
            for i in 0..4 {
                let c = gf64_canon(st[i]);
                first[2 * i] = (c & EPS64) as u32;
                first[2 * i + 1] = (c >> 32) as u32;
            }
            first
        }
    }

    /// Host-side mirror check: the exact kernel semantics implemented in
    /// Rust must reproduce the CPU reference's first squeeze — catches port
    /// bugs without needing a GPU.
    #[test]
    fn cl_mirror_matches_cpu_first_squeeze() {
        let header = [0u8; 32];
        for (extranonce, low64) in [
            ([0u8; 4], 0u64),
            ([0x00, 0x0c, 0x00, 0x01], 0xdeadbee0u64),
            ([0xde, 0xad, 0xbe, 0xef], u64::MAX),
            ([0x11, 0x22, 0x33, 0x44], 0x0123456789abcdefu64),
        ] {
            let mut nonce_be = [0u8; 64];
            nonce_be[..4].copy_from_slice(&extranonce);
            nonce_be[56..64].copy_from_slice(&low64.to_be_bytes());
            let mid = qpow::mining_prestate_low64(&header, &nonce_be);
            let hash = qpow::get_nonce_hash(&header, &nonce_be);
            let first = cl_mirror::eval_first8(&mid, low64, 0);
            eprintln!("low64={low64:#x} mid: {:016x?}", mid);
            eprintln!("mirror first8: {:08x?}", first);
            eprintln!("cpu hash[0..32]: {:02x?}", &hash[..32]);
            for i in 0..8 {
                let want = u32::from_le_bytes(hash[4 * i..4 * i + 4].try_into().unwrap());
                assert_eq!(
                    first[i], want,
                    "low64={low64:#x} word {i}: {:08x} vs {:08x}",
                    first[i], want
                );
            }
        }
    }

    /// On-device correctness gate (mirrors the CUDA KV test): runs the real
    /// kernel on an OpenCL GPU for the canonical KAT nonce with targets
    /// `hash - 1`, `hash` and `hash + 1` — only the last may produce a
    /// candidate, and the reported nonce/hash must be the exact CPU
    /// reference values.
    ///
    /// Requires an OpenCL GPU; run with:
    /// `cargo test --release -p zion-miner --features gpu-opencl -- --ignored`
    #[test]
    #[ignore]
    fn opencl_kernel_matches_cpu_golden_and_boundaries() {
        let mut miner = QpowOpenclMiner::new(1 << 16).expect("qpow opencl init");

        let header = [0u8; 32];
        // Canonical KAT: header=0, nonce=0 → 8e64e3d8…
        let nonce_be = [0u8; 64];
        let hash = qpow::get_nonce_hash(&header, &nonce_be);

        // target = hash: strict `hash < target` must NOT fire.
        let r = miner
            .mine_batch(&header, &nonce_be, &hash, 1)
            .expect("batch");
        assert!(r.is_none(), "target == hash must not yield a candidate");

        // target = hash - 1: must not fire either (hash > target).
        let mut below = hash;
        let mut i = 63;
        loop {
            let (v, c) = below[i].overflowing_sub(1);
            below[i] = v;
            if !c {
                break;
            }
            i -= 1;
        }
        let r = miner
            .mine_batch(&header, &nonce_be, &below, 1)
            .expect("batch");
        assert!(r.is_none(), "target = hash-1 must not yield a candidate");

        // target = hash + 1: candidate 0 must appear, hash exact.
        let mut above = hash;
        let mut i = 63;
        loop {
            let (v, c) = above[i].overflowing_add(1);
            above[i] = v;
            if !c {
                break;
            }
            i -= 1;
        }
        let r = miner
            .mine_batch(&header, &nonce_be, &above, 1)
            .expect("batch")
            .expect("target = hash+1 must yield the KAT nonce");
        assert_eq!(&r.nonce, &nonce_be);
        assert_eq!(&r.hash, &hash);

        // Nonzero batch base crossing the 32-bit limb boundary inside low64:
        // with a max target every nonce is a candidate and the host must
        // report the lowest, i.e. base_low itself. Also exercises the
        // byte-swapped sparse inject (regression: a wrong bswap mask broke
        // every nonce != 0 while nonce 0 still passed).
        let mut nonce2 = [0u8; 64];
        nonce2[..4].copy_from_slice(&[0x00, 0x0c, 0x00, 0x01]); // extranonce
        let base_low = 0xffff_fffcu64;
        nonce2[56..64].copy_from_slice(&base_low.to_be_bytes());
        let hash2 = qpow::get_nonce_hash(&header, &nonce2);
        let max_target = [0xffu8; 64];
        let r = miner
            .mine_batch(&header, &nonce2, &max_target, 8)
            .expect("batch")
            .expect("max target yields candidates");
        assert_eq!(
            u64::from_be_bytes(r.nonce[56..64].try_into().unwrap()),
            base_low
        );
        assert_eq!(&r.hash, &hash2);

        // Same boundaries for the nonzero nonce: target == its hash must
        // not fire (batch of 1 isolates index 0 — with a wider batch other
        // nonces can legitimately hash below the ~uniform hash2 target),
        // hash + 1 must report index 0 with the exact hash.
        let r = miner
            .mine_batch(&header, &nonce2, &hash2, 1)
            .expect("batch");
        assert!(r.is_none(), "target == hash2 must not yield a candidate");
        let mut above2 = hash2;
        let mut i = 63;
        loop {
            let (v, c) = above2[i].overflowing_add(1);
            above2[i] = v;
            if !c {
                break;
            }
            i -= 1;
        }
        let r = miner
            .mine_batch(&header, &nonce2, &above2, 8)
            .expect("batch")
            .expect("target = hash2+1 must yield base_low");
        assert_eq!(
            u64::from_be_bytes(r.nonce[56..64].try_into().unwrap()),
            base_low
        );
        assert_eq!(&r.hash, &hash2);
    }

    /// Throughput bench: `QPOW_BENCH_BATCH` (default 1<<22),
    /// `QPOW_BENCH_ITERS` (default 12, first two are warmup).
    ///
    /// `cargo test --release -p zion-miner --features gpu-opencl qpow_bench -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn qpow_bench_effective_throughput() {
        let batch = std::env::var("QPOW_BENCH_BATCH")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(1 << 22);
        let iters = std::env::var("QPOW_BENCH_ITERS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(12);
        let mut miner = QpowOpenclMiner::new(batch as usize).expect("qpow opencl init");

        let header = [0u8; 32];
        let mut target = [0u8; 64];
        target[63] = 1; // unreachable → every batch scans fully

        let mut base = 0u64;
        for i in 0..iters {
            base = base.wrapping_add(batch);
            let mut n = [0u8; 64];
            n[56..64].copy_from_slice(&base.to_be_bytes());
            let t0 = std::time::Instant::now();
            let r = miner
                .mine_batch(&header, &n, &target, batch)
                .expect("batch");
            let dt = t0.elapsed();
            assert!(r.is_none());
            eprintln!(
                "qpow_bench(cl) iter={} batch={} wall={:?} rate={:.2} MH/s",
                i,
                batch,
                dt,
                batch as f64 / dt.as_secs_f64() / 1e6
            );
        }
    }

    #[test]
    fn u512_limb_packing_roundtrips() {
        let mut wire = [0u8; 64];
        wire[..4].copy_from_slice(&[0x00, 0x0c, 0x00, 0x01]);
        wire[56..64].copy_from_slice(&0xdeadbeefcafef00du64.to_be_bytes());
        wire[32..36].copy_from_slice(&[1, 2, 3, 4]);
        let limbs = u512_be_to_limbs(&wire);
        assert_eq!(limbs[15], 0x000c0001);
        assert_eq!(limbs[0], 0xcafef00d);
        assert_eq!(limbs[1], 0xdeadbeef);
        assert_eq!(limbs[7], 0x01020304);
        assert_eq!(limbs_to_u512_be(&limbs), wire);
    }
}
