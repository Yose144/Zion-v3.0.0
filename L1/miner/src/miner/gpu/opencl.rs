//! OpenCL GPU mining implementation
//!
//! Cross-platform GPU mining using OpenCL (AMD, Intel, NVIDIA).

#[cfg(feature = "gpu")]
use super::GpuPlatform;
use super::{GpuDevice, GpuMiner};
use anyhow::{anyhow, Result};
use std::time::Instant;

#[cfg(feature = "gpu")]
use ocl::{Buffer, Device, DeviceType, Platform, ProQue};

#[cfg(feature = "gpu")]
use ocl::enums::{DeviceInfo, DeviceInfoResult};

const OPENCL_KERNEL: &str = include_str!("kernels/cosmic_harmony_v3.cl");

/// OpenCL miner implementation
pub struct OpenCLMiner {
    device_id: usize,
    device_info: GpuDevice,
    hashes_computed: u64,
    start_time: Instant,
    #[cfg(feature = "gpu")]
    pro_que: Option<ProQue>,
    #[cfg(feature = "gpu")]
    header_buf: Option<Buffer<u8>>,
    #[cfg(feature = "gpu")]
    results_buf: Option<Buffer<u64>>,
    #[cfg(feature = "gpu")]
    result_count_buf: Option<Buffer<u32>>,
}

impl OpenCLMiner {
    pub fn new(device_id: usize) -> Result<Self> {
        #[cfg(feature = "gpu")]
        {
            let devices = list_opencl_devices()?;
            let (_, _, device_info) = devices
                .get(device_id)
                .ok_or_else(|| anyhow!("OpenCL device {} not found", device_id))?
                .clone();

            Ok(Self {
                device_id,
                device_info,
                hashes_computed: 0,
                start_time: Instant::now(),
                pro_que: None,
                header_buf: None,
                results_buf: None,
                result_count_buf: None,
            })
        }

        #[cfg(not(feature = "gpu"))]
        {
            let _ = device_id;
            Err(anyhow!(
                "OpenCL support not enabled. Build with --features gpu"
            ))
        }
    }
}

impl GpuMiner for OpenCLMiner {
    fn init(&mut self) -> Result<()> {
        #[cfg(feature = "gpu")]
        {
            println!("[OpenCL] Initializing device {}", self.device_id);

            let devices = list_opencl_devices()?;
            let (platform, device, _) = devices
                .get(self.device_id)
                .ok_or_else(|| anyhow!("OpenCL device {} not found", self.device_id))?
                .clone();

            println!("[OpenCL] Building Cosmic Harmony v3 kernel...");
            let pro_que = ProQue::builder()
                .src(OPENCL_KERNEL)
                .platform(platform)
                .device(device)
                .dims(1usize)
                .build()?;

            let header_buf = pro_que.buffer_builder::<u8>().len(144).build()?;
            let results_buf = pro_que.buffer_builder::<u64>().len(2).build()?;
            let result_count_buf = pro_que.buffer_builder::<u32>().len(1).build()?;

            self.pro_que = Some(pro_que);
            self.header_buf = Some(header_buf);
            self.results_buf = Some(results_buf);
            self.result_count_buf = Some(result_count_buf);

            Ok(())
        }

        #[cfg(not(feature = "gpu"))]
        {
            Err(anyhow!(
                "OpenCL support not enabled. Build with --features gpu"
            ))
        }
    }

    fn mine_batch(
        &mut self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        batch_size: u64,
    ) -> Result<Option<(u64, [u8; 32])>> {
        #[cfg(feature = "gpu")]
        {
            let pro_que = self
                .pro_que
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL not initialized"))?;
            let header_buf = self
                .header_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL header buffer not initialized"))?;
            let results_buf = self
                .results_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL results buffer not initialized"))?;
            let result_count_buf = self
                .result_count_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL result count buffer not initialized"))?;

            if batch_size == 0 {
                return Ok(None);
            }

            // Extract target difficulty high u64 (Big Endian from target[24..32])
            // Target is 32 bytes. [0] is LSB .. [31] MSB? No.
            // Bitcoin-like target is simple 256 bit number.
            // If checking (hash < target).
            // Usually we compare high words first.
            // Let's stick to the convention used in CUDA implementation:
            // Input  is assumed LE byte array or BE?
            // "target" parameter in  is usually byte array of target threshold.
            // We take bytes 24-31 (highest 8 bytes) and interpret as u64.

            let mut target_u64_bytes = [0u8; 8];
            if target.len() == 32 {
                target_u64_bytes.copy_from_slice(&target[24..32]);
            }
            let target_difficulty = u64::from_le_bytes(target_u64_bytes);

            // Reset buffers
            let result_init = [0u64, 0u64];
            results_buf.write(&result_init[..]).enq()?;
            let count_init = [0u32];
            result_count_buf.write(&count_init[..]).enq()?;

            // Upload header — pad to exactly 144 bytes to match buffer size
            let header_len = header.len().min(144);
            let mut padded_header = [0u8; 144];
            padded_header[..header_len].copy_from_slice(&header[..header_len]);
            header_buf.write(&padded_header[..]).enq()?;

            let global_work_size = (batch_size.min(u32::MAX as u64)) as usize;
            let local_work_size = if global_work_size >= 256 { 256 } else { 1 };

            // "cosmic_harmony_v3_mine"
            let kernel = pro_que
                .kernel_builder("cosmic_harmony_v3_mine")
                .arg(header_buf)
                .arg(header_len as u32)
                .arg(nonce_start)
                .arg(target_difficulty)
                .arg(results_buf)
                .arg(result_count_buf)
                .global_work_size(global_work_size)
                .local_work_size(local_work_size)
                .build()?;

            unsafe {
                kernel.enq()?;
            }

            pro_que.queue().finish()?;

            let mut count_res = [0u32; 1];
            result_count_buf.read(&mut count_res[..]).enq()?;

            self.hashes_computed += batch_size;

            if count_res[0] > 0 {
                let mut res = [0u64; 2];
                results_buf.read(&mut res[..]).enq()?;
                let nonce = res[1];
                return Ok(Some((nonce, [0u8; 32])));
            }

            Ok(None)
        }

        #[cfg(not(feature = "gpu"))]
        {
            let _ = (header, target, nonce_start, batch_size);
            Err(anyhow!(
                "OpenCL support not enabled. Build with --features gpu"
            ))
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
}

/// Detect OpenCL devices
pub fn detect_opencl_devices() -> Result<Vec<GpuDevice>> {
    #[cfg(feature = "gpu")]
    {
        let devices = list_opencl_devices()?;
        Ok(devices.into_iter().map(|(_, _, info)| info).collect())
    }

    #[cfg(not(feature = "gpu"))]
    {
        Ok(vec![])
    }
}

#[cfg(feature = "gpu")]
fn list_opencl_devices() -> Result<Vec<(Platform, Device, GpuDevice)>> {
    let mut devices = Vec::new();
    for platform in Platform::list() {
        let platform_name = platform.name().unwrap_or_default();
        println!("[OPENCL] Platform: {}", platform_name);

        // Use DeviceType::ALL to catch AMD GPUs that may not respond to DeviceType::GPU
        let platform_devices = match Device::list(platform, Some(DeviceType::ALL)) {
            Ok(d) => d,
            Err(e) => {
                println!(
                    "[OPENCL] Failed to list devices for {}: {}",
                    platform_name, e
                );
                continue;
            }
        };

        println!(
            "[OPENCL] {} raw devices on {}",
            platform_devices.len(),
            platform_name
        );

        for device in platform_devices {
            let name = device.name().unwrap_or_else(|_| "Unknown Device".into());

            // Skip CPU devices — we only want GPUs and accelerators
            let dev_type = match device.info(DeviceInfo::Type) {
                Ok(DeviceInfoResult::Type(t)) => t,
                _ => DeviceType::GPU, // assume GPU if we can't query
            };
            if dev_type == DeviceType::CPU {
                println!("[OPENCL] Skipping CPU device: {}", name);
                continue;
            }

            let compute_units = match device.info(DeviceInfo::MaxComputeUnits) {
                Ok(DeviceInfoResult::MaxComputeUnits(v)) => v as u32,
                _ => 0,
            };
            let memory_mb = match device.info(DeviceInfo::GlobalMemSize) {
                Ok(DeviceInfoResult::GlobalMemSize(v)) => (v / (1024 * 1024)) as u64,
                _ => 0,
            };

            println!(
                "[OPENCL] Found GPU: {} ({} CU, {} MB)",
                name, compute_units, memory_mb
            );

            let id = devices.len();
            devices.push((
                platform,
                device.clone(),
                GpuDevice {
                    id,
                    name,
                    platform: GpuPlatform::OpenCL,
                    compute_units,
                    memory_mb,
                },
            ));
        }
    }

    Ok(devices)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_opencl_detection() {
        if let Ok(devices) = detect_opencl_devices() {
            println!("OpenCL devices found: {}", devices.len());
        }
    }
}
