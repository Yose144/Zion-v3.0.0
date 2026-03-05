//! Metal GPU mining backend for Apple Silicon — CHv4
//!
//! Native Metal GPU acceleration for Apple Silicon on M1/M2/M3/M4/M5.
//! Full CHv4 pipeline: Keccak → SHA3 → GoldenMatrix → Scratchpad(64KiB)
//! → NPU Mixing (INT8 MLP 64→128→64) → CosmicFusion.
//!
//! CHV4_NPU_FORK_HEIGHT = 0: CHv4 always active from genesis block 0.
//! Hashes are fully pool-compatible.
//!
//! Uses zion-cosmic-harmony-v3 crate’s MetalMiner with correct
//! packed struct buffer layout matching the Metal compute shader.

use super::{GpuDevice, GpuMiner, GpuPlatform};
use anyhow::{anyhow, Result};
use std::time::Instant;

/// Metal miner wrapping zion-cosmic-harmony-v3 MetalMiner
pub struct MetalGpuMiner {
    device_info: GpuDevice,
    hashes_computed: u64,
    start_time: Instant,
    batch_size: usize,
    #[cfg(all(feature = "metal", target_os = "macos"))]
    inner: Option<zion_cosmic_harmony_v3::gpu::metal_miner::MetalMiner>,
}

impl MetalGpuMiner {
    pub fn new(batch_size: usize) -> Result<Self> {
        #[cfg(all(feature = "metal", target_os = "macos"))]
        {
            // Create MetalMiner from zion-cosmic-harmony-v3 crate
            let inner = zion_cosmic_harmony_v3::gpu::metal_miner::MetalMiner::new(batch_size)
                .map_err(|e| anyhow!("Metal init failed: {}", e))?;

            let dev_info = inner.device_info();

            let device_info = GpuDevice {
                id: 0,
                name: dev_info.name.clone(),
                platform: GpuPlatform::Metal,
                compute_units: dev_info.compute_units,
                memory_mb: dev_info.global_memory / (1024 * 1024),
            };

            Ok(Self {
                device_info,
                hashes_computed: 0,
                start_time: Instant::now(),
                batch_size,
                inner: Some(inner),
            })
        }

        #[cfg(not(all(feature = "metal", target_os = "macos")))]
        {
            let _ = batch_size;
            Err(anyhow!("Metal GPU support not available. Requires macOS + Apple Silicon. Build with --features metal"))
        }
    }

    /// Run benchmark and return hashrate in H/s
    #[cfg(all(feature = "metal", target_os = "macos"))]
    pub fn benchmark(&mut self, duration_secs: f64) -> Result<f64> {
        let inner = self
            .inner
            .as_mut()
            .ok_or_else(|| anyhow!("Metal miner not initialized"))?;
        Ok(inner.benchmark(duration_secs))
    }

    /// Get batch size
    pub fn get_batch_size(&self) -> usize {
        self.batch_size
    }
}

impl GpuMiner for MetalGpuMiner {
    fn init(&mut self) -> Result<()> {
        #[cfg(all(feature = "metal", target_os = "macos"))]
        {
            if self.inner.is_none() {
                return Err(anyhow!("Metal device not available"));
            }
            self.start_time = Instant::now();
            log::info!(
                "Metal GPU initialized (CHv4): {} | batch_size={}",
                self.device_info.name,
                self.batch_size
            );
            Ok(())
        }

        #[cfg(not(all(feature = "metal", target_os = "macos")))]
        {
            Err(anyhow!("Metal GPU not available on this platform"))
        }
    }

    fn mine_batch(
        &mut self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        _batch_size: u64,
        height: u64,
    ) -> Result<Option<(u64, [u8; 32])>> {
        #[cfg(all(feature = "metal", target_os = "macos"))]
        {
            let inner = self
                .inner
                .as_mut()
                .ok_or_else(|| anyhow!("Metal miner not initialized"))?;

            // ONE GPU dispatch per mine_batch call = self.batch_size nonces in parallel.
            // The outer gpu_mining_loop handles iteration — this keeps job-switching latency
            // equal to one GPU dispatch (~seconds) instead of millions of nonces * seconds.
            if let Some((found_nonce, found_hash)) = inner.mine(header, target, nonce_start, height) {
                self.hashes_computed += self.batch_size as u64;
                return Ok(Some((found_nonce, found_hash)));
            }

            self.hashes_computed += self.batch_size as u64;
            Ok(None)
        }

        #[cfg(not(all(feature = "metal", target_os = "macos")))]
        {
            let _ = (header, target, nonce_start, _batch_size, height);
            Err(anyhow!("Metal GPU not available"))
        }
    }

    fn device_info(&self) -> &GpuDevice {
        &self.device_info
    }

    fn hashrate(&self) -> f64 {
        let elapsed = self.start_time.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            self.hashes_computed as f64 / elapsed
        } else {
            0.0
        }
    }

    fn natural_batch_size(&self) -> Option<u64> {
        // Expose the actual Metal chip batch so the mining loop calls us
        // with the right granularity (1 GPU dispatch per mine_batch call).
        Some(self.batch_size as u64)
    }
}

/// Detect Metal GPU devices (Apple Silicon only)
pub fn detect_metal_devices() -> Result<Vec<GpuDevice>> {
    #[cfg(all(feature = "metal", target_os = "macos"))]
    {
        // Try to create a MetalMiner to detect device — use tiny batch_size (no hashing).
        // Large batch would allocate a huge scratchpad (batch × 64 KiB), causing OOM.
        match zion_cosmic_harmony_v3::gpu::metal_miner::MetalMiner::new(64) {
            Ok(miner) => {
                let info = miner.device_info();
                Ok(vec![GpuDevice {
                    id: 0,
                    name: info.name,
                    platform: GpuPlatform::Metal,
                    compute_units: info.compute_units,
                    memory_mb: info.global_memory / (1024 * 1024),
                }])
            }
            Err(e) => {
                log::debug!("Metal device detection failed: {}", e);
                Ok(vec![])
            }
        }
    }

    // macOS without metal feature — try to detect Apple GPU anyway
    #[cfg(all(not(feature = "metal"), target_os = "macos"))]
    {
        // We know there's a GPU but we can't use it without the metal feature
        log::debug!("Apple Silicon detected but Metal feature not enabled");
        Ok(vec![])
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(vec![])
    }
}
