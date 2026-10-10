//! Dedicated Metal backend for Quantus QPoW (Poseidon2 over the Goldilocks
//! field) — the Apple Silicon counterpart of `qpow_opencl.rs`/`qpow_cuda.rs`.
//!
//! Runs `kernels/metal/poseidon2_kernel.metal` (a line-level port of the
//! OpenCL kernel) behind the identical buffer ABI:
//!   - results:        u32[9]   — candidate count, up to 8 logical indices
//!   - prestate:       u32[24]  — 12 Goldilocks limbs as LE u32 pairs
//!   - start_nonce:    u32[16]  — U512 little-endian limbs
//!   - difficulty:     u32[16]  — U512 little-endian limbs
//!   - dispatch:       u32[3]   — {total_threads, nonces_per_thread, total}
//!
//! QPoW is pure-ALU (no DAG, no scratchpad) so it is a natural fit for the
//! integrated Apple GPU — unlike the memory-hard Ekam Deeksha path.
//! Env knobs: `ZION_QPOW_METAL_SRC` (runtime kernel source override for
//! bench iterations), `ZION_QPOW_METAL_TPG`, `ZION_QPOW_METAL_NPT`,
//! `ZION_QPOW_METAL_IUNROLL` / `ZION_QPOW_METAL_EUNROLL` (#define injects).

use anyhow::Result;
use metal::{Device, MTLResourceOptions, MTLSize};

use crate::auxpow::qpow;

const POSEIDON2_METAL: &str = include_str!("kernels/metal/poseidon2_kernel.metal");

const QPOW_KERNEL: &str = "qpow_mine";
/// 3-lane × 4-felt lane-parallel variant (10 nonces per simdgroup32).
const QPOW_KERNEL_LANE: &str = "qpow_lane";
/// Candidate slots recorded per launch (mirrors upstream `MAX_HITS`).
const MAX_HITS: usize = 8;
/// u32[9]: hit count + up to `MAX_HITS` logical indices.
const RESULT_WORDS: usize = 1 + MAX_HITS;

use crate::gpu::QpowGpuResult;

/// Persistent Metal miner for `qpow-poseidon2`.
pub struct QpowMetalMiner {
    device: Device,
    queue: metal::CommandQueue,
    pipeline: metal::ComputePipelineState,
    lane_pipeline: Option<metal::ComputePipelineState>,
    use_lane: bool,
    device_name_cached: String,
    threads_per_tg: usize,
    nonces_per_thread: u32,
    results_buf: metal::Buffer,
    prestate_buf: metal::Buffer,
    start_nonce_buf: metal::Buffer,
    target_buf: metal::Buffer,
    dispatch_buf: metal::Buffer,
}

impl QpowMetalMiner {
    /// Create the miner on the system-default Metal device.
    pub fn new(_work_size: usize) -> Result<Self> {
        let device =
            Device::system_default().ok_or_else(|| anyhow::anyhow!("no Metal device found"))?;
        let device_name = device.name().to_string();
        let queue = device.new_command_queue();

        // ZION_QPOW_METAL_SRC loads the kernel source from a file at runtime
        // (benchmark/tuning iterations without rebuilding the binary — same
        // pattern as ZION_QPOW_OCL_SRC).
        let mut src = std::env::var("ZION_QPOW_METAL_SRC")
            .ok()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .unwrap_or_else(|| POSEIDON2_METAL.to_string());
        // Optional unroll overrides injected as preprocessor defines (the
        // kernel keeps #ifndef defaults when unset).
        let iu = std::env::var("ZION_QPOW_METAL_IUNROLL").ok();
        let eu = std::env::var("ZION_QPOW_METAL_EUNROLL").ok();
        if iu.is_some() || eu.is_some() {
            let mut prefix = String::new();
            if let Some(v) = &iu {
                prefix.push_str(&format!("#define QPOW_IUNROLL {v}\n"));
            }
            if let Some(v) = &eu {
                prefix.push_str(&format!("#define QPOW_EUNROLL {v}\n"));
            }
            src = format!("{prefix}{src}");
        }

        let options = metal::CompileOptions::new();
        let library = device
            .new_library_with_source(&src, &options)
            .map_err(|e| anyhow::anyhow!("Metal qpow shader compilation failed: {e}"))?;
        let func = library
            .get_function(QPOW_KERNEL, None)
            .map_err(|e| anyhow::anyhow!("Metal qpow kernel function not found: {e}"))?;
        let pipeline = device
            .new_compute_pipeline_state_with_function(&func)
            .map_err(|e| anyhow::anyhow!("Metal qpow pipeline creation failed: {e}"))?;

        // ZION_QPOW_METAL_IMPL: scalar | lane | auto (default auto → lane if
        // the qpow_lane pipeline builds, scalar otherwise). The lane kernel
        // maps 3 SIMD lanes per nonce and needs a different grid size.
        let impl_sel =
            std::env::var("ZION_QPOW_METAL_IMPL").unwrap_or_else(|_| "auto".to_string());
        let lane_pipeline = if impl_sel == "scalar" {
            None
        } else {
            library
                .get_function(QPOW_KERNEL_LANE, None)
                .ok()
                .and_then(|f| device.new_compute_pipeline_state_with_function(&f).ok())
        };
        let use_lane = match impl_sel.as_str() {
            "lane" => {
                if lane_pipeline.is_none() {
                    anyhow::bail!(
                        "ZION_QPOW_METAL_IMPL=lane but qpow_lane failed to build"
                    );
                }
                true
            }
            _ => lane_pipeline.is_some(),
        };

        let max_tpg = pipeline.max_total_threads_per_threadgroup() as usize;
        // ALU-only kernel: larger threadgroups keep the SIMD units fed.
        let threads_per_tg = std::env::var("ZION_QPOW_METAL_TPG")
            .ok()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .unwrap_or(256)
            .min(max_tpg);
        // Lane mode needs whole simdgroups per threadgroup.
        let threads_per_tg = if use_lane {
            (threads_per_tg / 32).max(1) * 32
        } else {
            threads_per_tg
        };
        let nonces_per_thread = std::env::var("ZION_QPOW_METAL_NPT")
            .ok()
            .and_then(|v| v.trim().parse::<u32>().ok())
            .unwrap_or(1)
            .max(1);

        let shared = MTLResourceOptions::StorageModeShared;
        let results_buf = device.new_buffer((RESULT_WORDS * 4) as u64, shared);
        let prestate_buf = device.new_buffer((24 * 4) as u64, shared);
        let start_nonce_buf = device.new_buffer((16 * 4) as u64, shared);
        let target_buf = device.new_buffer((16 * 4) as u64, shared);
        let dispatch_buf = device.new_buffer((3 * 4) as u64, shared);

        crate::ext_info!(
            "gpu_qpow_metal_init device=\"{}\" impl={} tpg={} npt={}",
            device_name,
            if use_lane { "lane" } else { "scalar" },
            threads_per_tg,
            nonces_per_thread,
        );

        Ok(Self {
            device,
            queue,
            pipeline,
            lane_pipeline,
            use_lane,
            device_name_cached: device_name,
            threads_per_tg,
            nonces_per_thread,
            results_buf,
            prestate_buf,
            start_nonce_buf,
            target_buf,
            dispatch_buf,
        })
    }

    pub fn device_name(&self) -> String {
        self.device_name_cached.clone()
    }

    /// Scan `total` candidate nonces, starting from `nonce_be` interpreted as
    /// a big-endian U512. Same contract as `QpowOpenclMiner::mine_batch`:
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
        // Lane mode: grid threads = ceil(groups/10)*32 must stay under 2^31,
        // so cap one launch at 64M nonces (groups ≤ 64M/npt with npt ≥ 1).
        let total64 = if self.use_lane {
            total64.min(64_000_000)
        } else {
            total64
        };
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
        // Scalar kernel: one thread per nonce → grid = ceil(total/npt).
        // Lane kernel: 3 lanes × 10 nonce-groups per simdgroup32 →
        // grid = ceil(ceil(total/npt)/10)*32 threads.
        let (pipeline, total_threads) = if self.use_lane {
            let groups = total32.div_ceil(npt) as u64;
            (
                self.lane_pipeline.as_ref().expect("lane pipeline"),
                (groups.div_ceil(10) * 32) as u32,
            )
        } else {
            (&self.pipeline, total32.div_ceil(npt))
        };

        let t_up = std::time::Instant::now();
        // Reset + upload (StorageModeShared — CPU writes are GPU-visible).
        unsafe {
            let zero = [0u32; RESULT_WORDS];
            std::ptr::copy_nonoverlapping(
                zero.as_ptr(),
                self.results_buf.contents() as *mut u32,
                RESULT_WORDS,
            );
            std::ptr::copy_nonoverlapping(
                midstate32.as_ptr(),
                self.prestate_buf.contents() as *mut u32,
                24,
            );
            std::ptr::copy_nonoverlapping(
                start_nonce.as_ptr(),
                self.start_nonce_buf.contents() as *mut u32,
                16,
            );
            std::ptr::copy_nonoverlapping(
                target_limbs.as_ptr(),
                self.target_buf.contents() as *mut u32,
                16,
            );
            let dispatch = [total_threads, npt, total32];
            std::ptr::copy_nonoverlapping(
                dispatch.as_ptr(),
                self.dispatch_buf.contents() as *mut u32,
                3,
            );
        }

        let cb = self.queue.new_command_buffer();
        let enc = cb.new_compute_command_encoder();
        enc.set_compute_pipeline_state(pipeline);
        enc.set_buffer(0, Some(&self.results_buf), 0);
        enc.set_buffer(1, Some(&self.prestate_buf), 0);
        enc.set_buffer(2, Some(&self.start_nonce_buf), 0);
        enc.set_buffer(3, Some(&self.target_buf), 0);
        enc.set_buffer(4, Some(&self.dispatch_buf), 0);
        let grid = MTLSize::new(total_threads as u64, 1, 1);
        let tg = MTLSize::new(self.threads_per_tg as u64, 1, 1);
        enc.dispatch_threads(grid, tg);
        enc.end_encoding();
        cb.commit();
        cb.wait_until_completed();
        if cb.status() == metal::MTLCommandBufferStatus::Error {
            anyhow::bail!("qpow Metal command buffer failed (MTLCommandBufferStatus::Error)");
        }
        let kern_ms = t_up.elapsed();
        if std::env::var("QPOW_TIMING").is_ok() {
            eprintln!(
                "qpow_timing(metal): dispatch+kernel={:?} threads={} npt={}",
                kern_ms, total_threads, npt
            );
        }

        let t_dl = std::time::Instant::now();
        let mut results = [0u32; RESULT_WORDS];
        unsafe {
            std::ptr::copy_nonoverlapping(
                self.results_buf.contents() as *const u32,
                results.as_mut_ptr(),
                RESULT_WORDS,
            );
        }
        let hits = results[0] as usize;
        if hits == 0 {
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
                "qpow_timing(metal): download={:?} total={:?} hits={}",
                t_dl.elapsed(),
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

    /// On-device correctness gate (mirrors the OpenCL golden test): runs the
    /// real Metal kernel on the canonical KAT nonce with targets `hash - 1`,
    /// `hash` and `hash + 1` — only the last may produce a candidate, and the
    /// reported nonce/hash must be the exact CPU reference values.
    ///
    /// Requires a Metal GPU; run with:
    /// `cargo test --release -p zion-miner --features gpu-metal -- --ignored`
    #[test]
    #[ignore]
    fn metal_kernel_matches_cpu_golden_and_boundaries() {
        let mut miner = QpowMetalMiner::new(1 << 16).expect("qpow metal init");

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
        // report the lowest, i.e. base_low itself.
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

        // target == its hash must not fire, hash + 1 must report index 0.
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
    /// `cargo test --release -p zion-miner --features gpu-metal qpow_metal_bench -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn qpow_metal_bench_effective_throughput() {
        let batch = std::env::var("QPOW_BENCH_BATCH")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(1 << 22);
        let iters = std::env::var("QPOW_BENCH_ITERS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(12);
        let mut miner = QpowMetalMiner::new(batch as usize).expect("qpow metal init");

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
                "qpow_bench(metal) iter={} batch={} wall={:?} rate={:.2} MH/s",
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
