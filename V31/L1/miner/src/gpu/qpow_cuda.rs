//! Dedicated CUDA backend for Quantus QPoW (Poseidon2 over the Goldilocks
//! field).
//!
//! The generic `GpuMiner` trait cannot represent QPoW: the nonce and the
//! difficulty target are 512-bit values and the digest is 64 bytes, while
//! `mine_batch_raw` is built around a `u64` nonce and a `[u8; 32]` target /
//! hash.  Instead of shoehorning QPoW into that shape we run a dedicated
//! kernel — `csrc/cuda/poseidon2_kernel.cu`, a 1:1 port of the upstream
//! `mining_u64.wgsl` — behind a small dedicated API.
//!
//! Host-side layout (mirrors the WGSL kernel):
//!   - results:        u32[33]  — flag, 16 nonce limbs, 16 hash limbs
//!   - midstate:       u32[24]  — 12 Goldilocks limbs as LE u32 pairs
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
const QPOW_THREADS_PER_BLOCK: u32 = 256;
/// u32[33]: found flag + 16 nonce limbs + 16 hash limbs.
const RESULT_WORDS: usize = 33;

/// Result of one QPoW GPU batch.
pub struct QpowGpuResult {
    /// Full 64-byte wire nonce (big-endian U512).
    pub nonce: [u8; 64],
    /// Full 64-byte wire hash (big-endian U512).
    pub hash: [u8; 64],
    /// Nonces actually scanned by this launch.
    pub nonces_tested: u64,
}

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
        let ptx = compile_ptx_with_opts(
            &processed,
            CompileOptions {
                options: vec![
                    "--use_fast_math".to_string(),
                    format!("-arch={}", arch),
                    "--std=c++14".to_string(),
                ],
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
            .map_err(|e| anyhow::anyhow!("qpow midstate alloc: {e}"))?;
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
    /// a big-endian U512 (the kernel iterates the low 256 bits; the host must
    /// keep `total` small enough not to carry into the high half — in
    /// practice batches stay within the low64 cursor, which is far below the
    /// 2^256 wrap point).
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
        let total32 = total.min(u32::MAX as u64) as u32;
        if total32 == 0 {
            return Ok(None);
        }

        // Host-side prestate: absorb header + high nonce half once per batch.
        let mid = qpow::mining_midstate(header, &nonce_be[..32]);
        let mut midstate32 = [0u32; 24];
        for i in 0..12 {
            midstate32[2 * i] = mid[i] as u32;
            midstate32[2 * i + 1] = (mid[i] >> 32) as u32;
        }
        let start_nonce = u512_be_to_limbs(nonce_be);
        let target_limbs = u512_be_to_limbs(target);

        let total_threads = (total32 as usize).min(self.work_size) as u32;
        let nonces_per_thread = total32.div_ceil(total_threads);
        let blocks = total_threads.div_ceil(QPOW_THREADS_PER_BLOCK);

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
            block_dim: (QPOW_THREADS_PER_BLOCK, 1, 1),
            shared_mem_bytes: 0,
        };
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

        let results = self
            .dev
            .dtoh_sync_copy(&self.results_buf)
            .map_err(|e| anyhow::anyhow!("qpow results download: {e}"))?;
        if results[0] == 0 {
            return Ok(None);
        }

        let mut nonce_limbs = [0u32; 16];
        nonce_limbs.copy_from_slice(&results[1..17]);
        let mut hash_limbs = [0u32; 16];
        hash_limbs.copy_from_slice(&results[17..33]);
        let nonce = limbs_to_u512_be(&nonce_limbs);
        let hash = limbs_to_u512_be(&hash_limbs);

        // Belt-and-suspenders: verify the candidate on the CPU before it ever
        // reaches the wire. A GPU false-positive would otherwise burn the
        // pool's share-validation budget and waste a submit.
        if !qpow::is_valid_nonce(header, &nonce, target) {
            anyhow::bail!("qpow GPU produced invalid share (hash !< target)");
        }
        if hash != qpow::get_nonce_hash(header, &nonce) {
            anyhow::bail!("qpow GPU hash mismatch vs CPU reference");
        }

        Ok(Some(QpowGpuResult {
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
