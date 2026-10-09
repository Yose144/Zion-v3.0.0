//! Dedicated CUDA backend for Quantus QPoW (Poseidon2 over the Goldilocks
//! field).
//!
//! The generic `GpuMiner` trait cannot represent QPoW: the nonce and the
//! difficulty target are 512-bit values and the digest is 64 bytes, while
//! `mine_batch_raw` is built around a `u64` nonce and a `[u8; 32]` target /
//! hash.  Instead of shoehorning QPoW into that shape we run a dedicated
//! kernel — `csrc/cuda/poseidon2_kernel.cu`, a port of the upstream
//! engine-cuda `mining.cu` (G2) — behind a small dedicated API.
//!
//! Host-side layout (mirrors upstream engine-cuda `mining.cu`):
//!   - results:        u32[9]   — candidate count, up to 8 logical indices
//!   - prestate:       u32[24]  — 12 Goldilocks limbs as LE u32 pairs
//!   - start_nonce:    u32[16]  — U512 little-endian limbs
//!   - difficulty:     u32[16]  — U512 little-endian limbs
//!   - dispatch:       u32[3]   — {total_threads, nonces_per_thread, total}

use anyhow::Result;
use cudarc::driver::{CudaDevice, CudaSlice, LaunchAsync, LaunchConfig};
use cudarc::nvrtc::{compile_ptx_with_opts, CompileOptions};
use std::sync::Arc;

use super::cuda_external::{detect_cuda_arch, preprocess_kernel};
use crate::auxpow::qpow;

const POSEIDON2_CU: &str = include_str!("../../csrc/cuda/poseidon2_kernel.cu");

const QPOW_MODULE: &str = "qpow_poseidon2";
const QPOW_KERNEL: &str = "qpow_mine";
/// Must equal `QPOW_LB_MAX` in poseidon2_kernel.cu (512 was the measured
/// optimum on sm_61 vs. the upstream 256).
const QPOW_THREADS_PER_BLOCK: u32 = 512;
/// Grid cap mirroring upstream `MAX_BLOCKS` — bounds resident threads so the
/// inner nonce loop amortizes thread setup across `nonces_per_thread` hashes.
const QPOW_MAX_BLOCKS: u32 = 4096;
/// Candidate slots recorded per launch (mirrors upstream `MAX_HITS`).
const MAX_HITS: usize = 8;
/// u32[9]: hit count + up to `MAX_HITS` logical indices.
const RESULT_WORDS: usize = 1 + MAX_HITS;

/// Result of one QPoW GPU batch — shared with the OpenCL backend.
pub use crate::gpu::QpowGpuResult;

/// Persistent CUDA miner for `qpow-poseidon2`.
pub struct QpowCudaMiner {
    dev: Arc<CudaDevice>,
    work_size: usize,
    device_name_cached: String,
    results_buf: CudaSlice<u32>,
    midstate_buf: CudaSlice<u32>,
    start_nonce_buf: CudaSlice<u32>,
    target_buf: CudaSlice<u32>,
    dispatch_buf: CudaSlice<u32>,
}

impl QpowCudaMiner {
    /// Create the miner on an existing device (e.g. the shared Stream-1
    /// `CudaDevice` — mandatory on consumer GPUs without MPS).
    pub fn new_with_device(work_size: usize, dev: Arc<CudaDevice>) -> Result<Self> {
        let device_name = dev
            .name()
            .unwrap_or_else(|_| "unknown CUDA device".to_string());
        let arch = detect_cuda_arch(&dev);
        let processed = preprocess_kernel(POSEIDON2_CU);
        // Extra NVRTC options for tuning experiments (e.g.
        // `QPOW_NVRTC_OPTS="-DQPOW_IUNROLL=5 -maxrregcount=80"`). The kernel
        // exposes QPOW_LB_MAX / QPOW_LB_MIN / QPOW_IUNROLL / QPOW_EUNROLL
        // defines with measured-optimal defaults; unset env = production
        // behavior unchanged.
        let mut options = vec![
            "--use_fast_math".to_string(),
            format!("-arch={}", arch),
            "--std=c++14".to_string(),
        ];
        if let Ok(extra) = std::env::var("QPOW_NVRTC_OPTS") {
            options.extend(extra.split_whitespace().map(str::to_string));
        }
        let ptx = compile_ptx_with_opts(
            &processed,
            CompileOptions {
                options,
                ..Default::default()
            },
        )
        .map_err(|e| anyhow::anyhow!("NVRTC compile failed for qpow: {e}"))?;
        dev.load_ptx(ptx, QPOW_MODULE, &[QPOW_KERNEL])
            .map_err(|e| anyhow::anyhow!("PTX load failed for qpow: {e}"))?;

        let results_buf = dev
            .alloc_zeros::<u32>(RESULT_WORDS)
            .map_err(|e| anyhow::anyhow!("qpow results alloc: {e}"))?;
        let midstate_buf = dev
            .alloc_zeros::<u32>(24)
            .map_err(|e| anyhow::anyhow!("qpow prestate alloc: {e}"))?;
        let start_nonce_buf = dev
            .alloc_zeros::<u32>(16)
            .map_err(|e| anyhow::anyhow!("qpow nonce alloc: {e}"))?;
        let target_buf = dev
            .alloc_zeros::<u32>(16)
            .map_err(|e| anyhow::anyhow!("qpow target alloc: {e}"))?;
        let dispatch_buf = dev
            .alloc_zeros::<u32>(3)
            .map_err(|e| anyhow::anyhow!("qpow dispatch alloc: {e}"))?;

        crate::ext_info!(
            "gpu_qpow_cuda_init device=\"{}\" work_size={}",
            device_name,
            work_size,
        );

        Ok(Self {
            dev,
            work_size: work_size.max(QPOW_THREADS_PER_BLOCK as usize),
            device_name_cached: device_name,
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

    /// Return the underlying CUDA device so sibling backends can share the
    /// context instead of creating a second one.
    pub fn shared_cuda_device(&self) -> Option<Arc<CudaDevice>> {
        Some(self.dev.clone())
    }

    /// Scan `total` candidate nonces, starting from `nonce_be` interpreted as
    /// a big-endian U512. The kernel iterates the low 64 nonce bits only —
    /// the batch is capped at the low64 carry boundary (the caller advances
    /// its cursor by the full `total` regardless, so the un-scanned tail past
    /// the boundary is skipped once per 2^64 nonces).
    ///
    /// `nonce_be` already embeds the pool extranonce in its high half (see
    /// `qpow::build_nonce`). `target` is the 64-byte big-endian U512 target;
    /// a candidate is valid iff `hash < target` (strict).
    pub fn mine_batch(
        &mut self,
        header: &[u8; qpow::QPOW_HEADER_LEN],
        nonce_be: &[u8; qpow::QPOW_NONCE_LEN],
        target: &[u8; qpow::QPOW_TARGET_LEN],
        total: u64,
    ) -> Result<Option<QpowGpuResult>> {
        let low64_base = u64::from_be_bytes(nonce_be[56..64].try_into().expect("nonce len"));
        // Headroom until the low 64 bits carry into the high half.
        // wrapping_neg() == 0 only at low64_base == 0 (full 2^64 space).
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
        // linear layer + round-0 constants already applied. The kernel only
        // injects the two low64 lanes and finishes the hash.
        let mid = qpow::mining_prestate_low64(header, nonce_be);
        let mut midstate32 = [0u32; 24];
        for i in 0..12 {
            midstate32[2 * i] = mid[i] as u32;
            midstate32[2 * i + 1] = (mid[i] >> 32) as u32;
        }
        let start_nonce = u512_be_to_limbs(nonce_be);
        let target_limbs = u512_be_to_limbs(target);

        // Pascal-tuned dispatch: one nonce per thread. The G2 j-loop carries
        // a 12-lane u64 sponge state; looping nonces inside a thread loses
        // ~12% on sm_61 vs. simply launching more blocks (measured: npt=1
        // ≈ 40 MH/s, npt=5 ≈ 35 MH/s on GTX 1070 Ti).
        // QPOW_TPB / QPOW_NPT envs exist for tuning runs; defaults are the
        // measured optimum.
        let tpb = std::env::var("QPOW_TPB")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .filter(|v| *v >= 32 && *v <= 1024)
            .unwrap_or(QPOW_THREADS_PER_BLOCK);
        let nonces_per_thread = std::env::var("QPOW_NPT")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .filter(|v| *v >= 1)
            .unwrap_or(1u32);
        let total_threads = total32.div_ceil(nonces_per_thread);
        let blocks = total_threads.div_ceil(tpb);

        let t_up = std::time::Instant::now();
        // Reset + upload
        self.dev
            .htod_copy_into(vec![0u32; RESULT_WORDS], &mut self.results_buf)
            .map_err(|e| anyhow::anyhow!("qpow results reset: {e}"))?;
        self.dev
            .htod_copy_into(midstate32.to_vec(), &mut self.midstate_buf)
            .map_err(|e| anyhow::anyhow!("qpow midstate upload: {e}"))?;
        self.dev
            .htod_copy_into(start_nonce.to_vec(), &mut self.start_nonce_buf)
            .map_err(|e| anyhow::anyhow!("qpow nonce upload: {e}"))?;
        self.dev
            .htod_copy_into(target_limbs.to_vec(), &mut self.target_buf)
            .map_err(|e| anyhow::anyhow!("qpow target upload: {e}"))?;
        self.dev
            .htod_copy_into(
                vec![total_threads, nonces_per_thread, total32],
                &mut self.dispatch_buf,
            )
            .map_err(|e| anyhow::anyhow!("qpow dispatch upload: {e}"))?;

        let func = self
            .dev
            .get_func(QPOW_MODULE, QPOW_KERNEL)
            .ok_or_else(|| anyhow::anyhow!("kernel {} not found", QPOW_KERNEL))?;
        let cfg = LaunchConfig {
            grid_dim: (blocks, 1, 1),
            block_dim: (tpb, 1, 1),
            shared_mem_bytes: 0,
        };
        let up_ms = t_up.elapsed();
        let t_kern = std::time::Instant::now();
        unsafe {
            func.clone()
                .launch(
                    cfg,
                    (
                        &mut self.results_buf,
                        &self.midstate_buf,
                        &self.start_nonce_buf,
                        &self.target_buf,
                        &self.dispatch_buf,
                    ),
                )
                .map_err(|e| anyhow::anyhow!("qpow launch: {e}"))?;
        }
        self.dev
            .synchronize()
            .map_err(|e| anyhow::anyhow!("qpow device sync: {e}"))?;
        let kern_ms = t_kern.elapsed();
        if std::env::var("QPOW_TIMING").is_ok() {
            eprintln!(
                "qpow_timing: upload={:?} kernel_sync={:?} threads={} npt={} blocks={}",
                up_ms, kern_ms, total_threads, nonces_per_thread, blocks
            );
        }

        let t_dl = std::time::Instant::now();
        let results = self
            .dev
            .dtoh_sync_copy(&self.results_buf)
            .map_err(|e| anyhow::anyhow!("qpow results download: {e}"))?;
        let dl_ms = t_dl.elapsed();
        let hits = results[0] as usize;
        if hits == 0 {
            if std::env::var("QPOW_TIMING").is_ok() {
                eprintln!(
                    "qpow_timing: download={:?} total={:?} hits=0",
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
                "qpow_timing: download={:?} total={:?} hits={}",
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

    /// On-device correctness gate (mirrors upstream `cuda_*` KV tests):
    /// runs the real kernel on the local GPU for the canonical KAT nonce,
    /// with targets `hash - 1`, `hash` and `hash + 1` — only the last may
    /// produce a candidate, and the reported nonce/hash must be the exact
    /// CPU reference values.
    ///
    /// Requires a CUDA device; run with:
    /// `cargo test --release -p zion-miner --features gpu-cuda -- --ignored`
    #[test]
    #[ignore]
    fn cuda_kernel_matches_cpu_golden_and_boundaries() {
        let dev = CudaDevice::new(0).expect("CUDA device 0");
        let mut miner = QpowCudaMiner::new_with_device(1 << 16, dev).expect("qpow cuda init");

        let header = [0u8; 32];
        // Canonical KAT: header=0, nonce=0 → 8e64e3d8…
        let nonce_be = [0u8; 64];
        let hash = qpow::get_nonce_hash(&header, &nonce_be);

        // Boundary checks scan exactly one nonce so neighbouring nonces
        // cannot satisfy the crafted targets.
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

        // A nonzero batch base + a mid-range carry: nonce = 2^32 - 3, the
        // batch crosses the 32-bit limb boundary inside low64.
        let mut nonce2 = [0u8; 64];
        nonce2[..4].copy_from_slice(&[0x00, 0x0c, 0x00, 0x01]); // extranonce
        let base_low = 0xffff_fffcu64;
        nonce2[56..64].copy_from_slice(&base_low.to_be_bytes());
        // Make every nonce in the batch a candidate; the kernel records the
        // first 8 — host must report the lowest, i.e. base_low itself.
        let max_target = [0xffu8; 64];
        let r = miner
            .mine_batch(&header, &nonce2, &max_target, 8)
            .expect("batch")
            .expect("max target yields candidates");
        assert_eq!(
            u64::from_be_bytes(r.nonce[56..64].try_into().unwrap()),
            base_low
        );
        assert_eq!(&r.hash, &qpow::get_nonce_hash(&header, &r.nonce));
    }

    /// Throughput bench for the real kernel on the local GPU: repeatedly
    /// calls `mine_batch` over an unreachable-target window (no candidates)
    /// and reports effective nonces/s including all per-batch host overhead.
    ///
    /// Env knobs: `QPOW_BENCH_BATCH` (nonces per batch, default 1<<22),
    /// `QPOW_BENCH_ITERS` (default 12, first two are warmup).
    ///
    /// `cargo test --release -p zion-miner --features gpu-cuda qpow_bench -- --ignored --nocapture`
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
        let dev = CudaDevice::new(0).expect("CUDA device 0");
        let mut miner =
            QpowCudaMiner::new_with_device(batch as usize, dev).expect("qpow cuda init");

        let header = [0u8; 32];
        // Target 1 (last byte = big-endian least significant): unreachable,
        // so every batch scans fully with no candidates.
        let mut target = [0u8; 64];
        target[63] = 1;

        let mut base = 0u64;
        for i in 0..iters {
            nonce_in(&mut base, batch);
            let mut n = [0u8; 64];
            n[56..64].copy_from_slice(&base.to_be_bytes());
            let t0 = std::time::Instant::now();
            let r = miner
                .mine_batch(&header, &n, &target, batch)
                .expect("batch");
            let dt = t0.elapsed();
            assert!(r.is_none());
            eprintln!(
                "qpow_bench iter={} batch={} wall={:?} rate={:.2} MH/s",
                i,
                batch,
                dt,
                batch as f64 / dt.as_secs_f64() / 1e6
            );
        }

        fn nonce_in(base: &mut u64, step: u64) {
            *base = base.wrapping_add(step);
        }
    }

    /// The limb packing must round-trip and must place the extranonce
    /// (wire bytes 0..4) in the fixed high half (limb 15).
    #[test]
    fn u512_limb_packing_roundtrips() {
        let mut wire = [0u8; 64];
        wire[..4].copy_from_slice(&[0x00, 0x0c, 0x00, 0x01]); // extranonce
        wire[56..64].copy_from_slice(&0xdeadbeefcafef00du64.to_be_bytes());
        wire[32..36].copy_from_slice(&[1, 2, 3, 4]);
        let limbs = u512_be_to_limbs(&wire);
        // limb15 = wire[0..4], limb0 = wire[60..64] (u64 low32), limb1 =
        // wire[56..60], limb7 = wire[32..36].
        assert_eq!(limbs[15], 0x000c0001);
        assert_eq!(limbs[0], 0xcafef00d);
        assert_eq!(limbs[1], 0xdeadbeef);
        assert_eq!(limbs[7], 0x01020304);
        assert_eq!(limbs_to_u512_be(&limbs), wire);
    }
}
