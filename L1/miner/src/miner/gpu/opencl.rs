//! OpenCL GPU mining implementation
//!
//! Cross-platform GPU mining using OpenCL (AMD, Intel, NVIDIA).

#[cfg(feature = "gpu")]
use super::GpuPlatform;
use super::{GpuDevice, GpuMiner};
use anyhow::{anyhow, Result};
use std::time::Instant;

#[cfg(feature = "gpu")]
use ocl::{Buffer, Device, DeviceType, Platform, Program, ProQue};

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
    #[cfg(feature = "gpu")]
    result_hash_buf: Option<Buffer<u8>>,
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
                result_hash_buf: None,
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

            let platform_name = platform.name().unwrap_or_default();
            let device_name = device.name().unwrap_or_else(|_| String::from("unknown"));

            let compile_opts = std::env::var("ZION_OPENCL_BUILD_OPTS")
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| {
                    let platform_l = platform_name.to_ascii_lowercase();
                    let device_l = device_name.to_ascii_lowercase();
                    if platform_l.contains("amd") || device_l.contains("amd") || device_l.contains("gfx") {
                        String::from("-cl-std=CL1.2 -cl-mad-enable -cl-fast-relaxed-math -cl-no-signed-zeros -cl-denorms-are-zero")
                    } else {
                        String::from("-cl-mad-enable -cl-fast-relaxed-math -cl-no-signed-zeros -cl-denorms-are-zero")
                    }
                });

            println!("[OpenCL] Building Cosmic Harmony v3 kernel...");
            println!("[OpenCL] Compile opts: {}", compile_opts);
            let mut prog_bldr = Program::builder();
            prog_bldr.src(OPENCL_KERNEL);
            prog_bldr.cmplr_opt(&compile_opts);
            let pro_que = ProQue::builder()
                .prog_bldr(prog_bldr)
                .platform(platform)
                .device(device)
                .dims(1usize)
                .build()?;

            let header_buf = pro_que.buffer_builder::<u8>().len(144).build()?;
            let results_buf = pro_que.buffer_builder::<u64>().len(2).build()?;
            let result_count_buf = pro_que.buffer_builder::<u32>().len(1).build()?;
            let result_hash_buf = pro_que.buffer_builder::<u8>().len(32).build()?;

            self.pro_que = Some(pro_que);
            self.header_buf = Some(header_buf);
            self.results_buf = Some(results_buf);
            self.result_count_buf = Some(result_count_buf);
            self.result_hash_buf = Some(result_hash_buf);

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
            let result_hash_buf = self
                .result_hash_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL result hash buffer not initialized"))?;

            if batch_size == 0 {
                return Ok(None);
            }

            // ═══ CHv3 target: pool sends full 32-byte target hex.
            // Pool validator does:  u32::from_le_bytes(hash[0..4]) ≤ target_int
            //   where target_int = u32::from_str_radix(&hex[0..8], 16)
            //                    = u32::from_be_bytes(decoded[0..4])
            // parse_target_bytes places decoded bytes at natural positions:
            // target[0..4] = first 4 bytes = the most significant part.
            let target_u32: u32 = u32::from_be_bytes([
                target[0], target[1], target[2], target[3],
            ]);

            // Reset buffers
            let result_init = [0u64, 0u64];
            results_buf.write(&result_init[..]).enq()?;
            let count_init = [0u32];
            result_count_buf.write(&count_init[..]).enq()?;
            let hash_init = [0u8; 32];
            result_hash_buf.write(&hash_init[..]).enq()?;

            // Upload header — cap at 80 bytes (CPU/pool only uses first 80).
            // Pad to 144 bytes to match buffer allocation size.
            let header_len = header.len().min(80);
            let mut padded_header = [0u8; 144];
            padded_header[..header_len].copy_from_slice(&header[..header_len]);
            header_buf.write(&padded_header[..]).enq()?;

            // Optimal local work size — 256 fully occupies AMD wavefronts (64)
            // and Nvidia warps (32).  Query device max and cap.
            let max_wg = pro_que.device().max_wg_size().unwrap_or(256);
            let local_work_size = 256usize.min(max_wg);
            let raw_global = (batch_size.min(u32::MAX as u64)) as usize;
            let raw_global = raw_global.max(local_work_size); // at least one workgroup
            let global_work_size =
                ((raw_global + local_work_size - 1) / local_work_size) * local_work_size;

            // "cosmic_harmony_v3_mine"
            let kernel = pro_que
                .kernel_builder("cosmic_harmony_v3_mine")
                .arg(header_buf)
                .arg(header_len as u32)
                .arg(nonce_start)
                .arg(target_u32)
                .arg(results_buf)
                .arg(result_count_buf)
                .arg(result_hash_buf)
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
                let mut gpu_hash = [0u8; 32];
                result_hash_buf.read(&mut gpu_hash[..]).enq()?;
                return Ok(Some((nonce, gpu_hash)));
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
