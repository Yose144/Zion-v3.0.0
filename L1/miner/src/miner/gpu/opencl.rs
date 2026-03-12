//! OpenCL GPU mining implementation
//!
//! Cross-platform GPU mining using OpenCL (AMD, Intel, NVIDIA).

#[cfg(feature = "gpu")]
use super::GpuPlatform;
use super::{GpuDevice, GpuMiner};
use anyhow::{anyhow, Result};
use std::time::Instant;
use zion_cosmic_harmony_v3;

#[cfg(feature = "gpu")]
use ocl::{Buffer, Device, DeviceType, Platform, Program, ProQue};

#[cfg(feature = "gpu")]
use ocl::enums::{DeviceInfo, DeviceInfoResult};

const OPENCL_KERNEL: &str = include_str!("kernels/cosmic_harmony_deeksha.cl");

/// Scratchpad size per thread (must match CL_SCRATCHPAD_BYTES in kernel)
const SCRATCHPAD_BYTES: usize = 64 * 1024;
/// Max parallel threads when memory-hard is active (scratchpad × threads ≤ ~2 GB)
/// 4096 × 64 KiB = 256 MiB — fits comfortably in 4+ GB VRAM
const MH_BATCH_DEFAULT: usize = 4096;

/// OpenCL miner implementation
pub struct OpenCLMiner {
    device_id: usize,
    device_info: GpuDevice,
    hashes_computed: u64,
    start_time: Instant,
    /// Max threads for memory-hard mining (limited by VRAM/scratchpad size)
    mh_batch_size: usize,
    #[cfg(feature = "gpu")]
    pro_que: Option<ProQue>,
    #[cfg(feature = "gpu")]
    header_buf: Option<Buffer<u8>>,
    #[cfg(feature = "gpu")]
    result_nonce_buf: Option<Buffer<u64>>,
    #[cfg(feature = "gpu")]
    result_hash_buf: Option<Buffer<u8>>,
    /// Scratchpad buffer: mh_batch_size × SCRATCHPAD_BYTES bytes in GPU global mem
    #[cfg(feature = "gpu")]
    scratchpad_buf: Option<Buffer<u8>>,
    /// CHv4 NPU weight buffers (derived once from genesis seed, static for lifetime)
    #[cfg(feature = "gpu")]
    npu_w1_buf: Option<Buffer<i8>>,
    #[cfg(feature = "gpu")]
    npu_b1_buf: Option<Buffer<i8>>,
    #[cfg(feature = "gpu")]
    npu_w2_buf: Option<Buffer<i8>>,
    #[cfg(feature = "gpu")]
    npu_b2_buf: Option<Buffer<i8>>,
    #[cfg(feature = "gpu")]
    npu_scale1_buf: Option<Buffer<i16>>,
    #[cfg(feature = "gpu")]
    npu_scale2_buf: Option<Buffer<i16>>,
}

impl OpenCLMiner {
    const EKAM_DEBUG_STAGE_BYTES: usize = 320;

    pub fn new(device_id: usize) -> Result<Self> {
        #[cfg(feature = "gpu")]
        {
            let devices = list_opencl_devices()?;
            let (_, _, device_info) = devices
                .get(device_id)
                .ok_or_else(|| anyhow!("OpenCL device {} not found", device_id))?
                .clone();

            // Allow overriding MH batch via env (for memory tuning)
            let mh_batch_size = std::env::var("ZION_GPU_MH_BATCH")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok())
                .unwrap_or(MH_BATCH_DEFAULT)
                .max(64)
                .min(32768);

            Ok(Self {
                device_id,
                device_info,
                hashes_computed: 0,
                start_time: Instant::now(),
                mh_batch_size,
                pro_que: None,
                header_buf: None,
                result_nonce_buf: None,
                result_hash_buf: None,
                scratchpad_buf: None,
                npu_w1_buf: None,
                npu_b1_buf: None,
                npu_w2_buf: None,
                npu_b2_buf: None,
                npu_scale1_buf: None,
                npu_scale2_buf: None,
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

    fn env_flag(name: &str) -> bool {
        std::env::var(name)
            .map(|v| {
                let value = v.trim().to_ascii_lowercase();
                value == "1" || value == "true" || value == "yes" || value == "on"
            })
            .unwrap_or(false)
    }

    fn run_ekam_parity_selftest(&mut self) -> Result<()> {
        use zion_cosmic_harmony_v3::algorithms_npu::npu_mixing_hash64;
        use zion_cosmic_harmony_v3::algorithms_opt::{
            cosmic_fusion_opt_rounds, golden_matrix_opt, keccak256_opt, sha3_512_opt,
        };
        use zion_cosmic_harmony_v3::scratchpad_ekam::memory_hard_transform_ekam_light;

        let sample_count = std::env::var("ZION_OPENCL_EKAM_SELFTEST_COUNT")
            .ok()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .unwrap_or(4)
            .clamp(1, 16);

        let header = b"ZION_OPENCL_EKAM_SELFTEST_HEADER_V1";
        let easy_target = [0xFFu8; 32];
        let mut mismatches = 0usize;

        for i in 0..sample_count {
            let nonce = i as u64;
            let gpu = self
                .mine_batch(header, &easy_target, nonce, 1, 0)?
                .ok_or_else(|| anyhow!("OpenCL parity self-test produced no hash for nonce {}", nonce))?;

            let (gpu_nonce, gpu_hash) = gpu;
            let cpu_hash = zion_cosmic_harmony_v3::deeksha::cosmic_harmony_ekam_deeksha(header, nonce);

            if gpu_nonce != nonce || gpu_hash != cpu_hash.data {
                mismatches += 1;
                log::error!(
                    "❌ OpenCL Ekam parity mismatch nonce={} gpu_nonce={} gpu_hash={} cpu_hash={}",
                    nonce,
                    gpu_nonce,
                    hex::encode(gpu_hash),
                    hex::encode(cpu_hash.data),
                );

                if mismatches == 1 {
                    let gpu_stages = self.debug_ekam_stages(header, nonce)?;

                    let s1 = keccak256_opt(&{
                        let mut input = [0u8; 88];
                        let copy_len = header.len().min(80);
                        input[..copy_len].copy_from_slice(&header[..copy_len]);
                        input[80..88].copy_from_slice(&nonce.to_le_bytes());
                        input
                    });
                    let s2 = sha3_512_opt(&s1.data);
                    let s3 = golden_matrix_opt(&s2.data);
                    let s4 = memory_hard_transform_ekam_light(&s3.data);
                    let s5 = npu_mixing_hash64(&s4.data);
                    let final_hash = cosmic_fusion_opt_rounds(&s5.data, 8);

                    let cpu_stages = [
                        ("s1-keccak", s1.data.as_slice()),
                        ("s2-sha3", s2.data.as_slice()),
                        ("s3-golden", s3.data.as_slice()),
                        ("s4-ekam-mh", s4.data.as_slice()),
                        ("s5-npu", s5.data.as_slice()),
                        ("s6-fusion", final_hash.data.as_slice()),
                    ];
                    let gpu_ranges = [
                        (0usize, 32usize),
                        (32, 96),
                        (96, 160),
                        (160, 224),
                        (224, 288),
                        (288, 320),
                    ];

                    for ((label, cpu_bytes), (start, end)) in cpu_stages.iter().zip(gpu_ranges) {
                        let gpu_bytes = &gpu_stages[start..end];
                        if gpu_bytes != *cpu_bytes {
                            log::error!(
                                "❌ OpenCL Ekam stage mismatch at {} nonce={} gpu={} cpu={}",
                                label,
                                nonce,
                                hex::encode(gpu_bytes),
                                hex::encode(cpu_bytes),
                            );
                            break;
                        }
                    }
                }
            }
        }

        if mismatches == 0 {
            println!(
                "[OpenCL] Ekam parity self-test OK ({} sample nonce{})",
                sample_count,
                if sample_count == 1 { "" } else { "s" }
            );
            Ok(())
        } else {
            Err(anyhow!(
                "OpenCL Ekam parity self-test failed: {} mismatch(es)",
                mismatches
            ))
        }
    }

    fn debug_ekam_stages(&mut self, header: &[u8], nonce: u64) -> Result<Vec<u8>> {
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
            let scratchpad_buf = self
                .scratchpad_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL scratchpad buffer not initialized"))?;
            let npu_w1_buf = self.npu_w1_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU w1 buffer not initialized"))?;
            let npu_b1_buf = self.npu_b1_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU b1 buffer not initialized"))?;
            let npu_w2_buf = self.npu_w2_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU w2 buffer not initialized"))?;
            let npu_b2_buf = self.npu_b2_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU b2 buffer not initialized"))?;
            let npu_scale1_buf = self.npu_scale1_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU scale1 buffer not initialized"))?;
            let npu_scale2_buf = self.npu_scale2_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU scale2 buffer not initialized"))?;

            let header_len = header.len().min(80);
            let mut padded_header = [0u8; 144];
            padded_header[..header_len].copy_from_slice(&header[..header_len]);
            header_buf.write(&padded_header[..]).enq()?;

            let stage_buf = pro_que
                .buffer_builder::<u8>()
                .len(Self::EKAM_DEBUG_STAGE_BYTES)
                .fill_val(0u8)
                .build()?;

            let kernel = pro_que
                .kernel_builder("ekam_deeksha_debug")
                .arg(header_buf)
                .arg(header_len as u32)
                .arg(nonce)
                .arg(scratchpad_buf)
                .arg(&stage_buf)
                .arg(npu_w1_buf)
                .arg(npu_b1_buf)
                .arg(npu_w2_buf)
                .arg(npu_b2_buf)
                .arg(npu_scale1_buf)
                .arg(npu_scale2_buf)
                .global_work_size(1usize)
                .local_work_size(1usize)
                .build()?;

            unsafe {
                kernel.enq()?;
            }
            pro_que.queue().finish()?;

            let mut stages = vec![0u8; Self::EKAM_DEBUG_STAGE_BYTES];
            stage_buf.read(&mut stages[..]).enq()?;
            Ok(stages)
        }

        #[cfg(not(feature = "gpu"))]
        {
            let _ = (header, nonce);
            Err(anyhow!("OpenCL support not enabled. Build with --features gpu"))
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

            println!("[OpenCL] Building Cosmic Harmony Deeksha kernel...");
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
            let result_nonce_buf = pro_que.buffer_builder::<u64>().len(1).build()?;
            let result_hash_buf = pro_que.buffer_builder::<u8>().len(32).build()?;

            // Scratchpad buffer: mh_batch_size × 64 KiB.
            // Allocated once at init; only used when memory_hard=1 in the kernel.
            let scratchpad_len = self.mh_batch_size * SCRATCHPAD_BYTES;
            println!("[OpenCL] Allocating scratchpad: {} MiB ({} threads × 64 KiB)",
                scratchpad_len / (1024 * 1024), self.mh_batch_size);
            let scratchpad_buf = pro_que.buffer_builder::<u8>()
                .len(scratchpad_len)
                .fill_val(0u8)
                .build()?;

            self.pro_que = Some(pro_que);
            self.header_buf = Some(header_buf);
            self.result_nonce_buf = Some(result_nonce_buf);
            self.result_hash_buf = Some(result_hash_buf);
            self.scratchpad_buf = Some(scratchpad_buf);

            // CHv4 NPU weights — derived once from genesis seed, uploaded to GPU
            let npu_w = zion_cosmic_harmony_v3::algorithms_npu::chv4_npu_weights_flat();
            let npu_w1_buf = self.pro_que.as_ref().unwrap().buffer_builder::<i8>().len(npu_w.w1.len()).build()?;
            npu_w1_buf.write(&npu_w.w1[..]).enq()?;
            let npu_b1_buf = self.pro_que.as_ref().unwrap().buffer_builder::<i8>().len(npu_w.b1.len()).build()?;
            npu_b1_buf.write(&npu_w.b1[..]).enq()?;
            let npu_w2_buf = self.pro_que.as_ref().unwrap().buffer_builder::<i8>().len(npu_w.w2.len()).build()?;
            npu_w2_buf.write(&npu_w.w2[..]).enq()?;
            let npu_b2_buf = self.pro_que.as_ref().unwrap().buffer_builder::<i8>().len(npu_w.b2.len()).build()?;
            npu_b2_buf.write(&npu_w.b2[..]).enq()?;
            let npu_scale1_buf = self.pro_que.as_ref().unwrap().buffer_builder::<i16>().len(npu_w.scale1.len()).build()?;
            npu_scale1_buf.write(&npu_w.scale1[..]).enq()?;
            let npu_scale2_buf = self.pro_que.as_ref().unwrap().buffer_builder::<i16>().len(npu_w.scale2.len()).build()?;
            npu_scale2_buf.write(&npu_w.scale2[..]).enq()?;
            println!("[OpenCL] CHv4 NPU weights uploaded ({} B)",
                npu_w.w1.len() + npu_w.b1.len() + npu_w.w2.len() + npu_w.b2.len()
                + npu_w.scale1.len() * 2 + npu_w.scale2.len() * 2);
            self.npu_w1_buf    = Some(npu_w1_buf);
            self.npu_b1_buf    = Some(npu_b1_buf);
            self.npu_w2_buf    = Some(npu_w2_buf);
            self.npu_b2_buf    = Some(npu_b2_buf);
            self.npu_scale1_buf = Some(npu_scale1_buf);
            self.npu_scale2_buf = Some(npu_scale2_buf);

            if Self::env_flag("ZION_OPENCL_EKAM_SELFTEST") {
                self.run_ekam_parity_selftest()?;
            }

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
        height: u64,
    ) -> Result<Option<(u64, [u8; 32])>> {
        #[cfg(feature = "gpu")]
        {
            let _ = height; // Deeksha is always active from genesis (fork height = 0)
            let pro_que = self
                .pro_que
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL not initialized"))?;
            let header_buf = self
                .header_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL header buffer not initialized"))?;
            let result_nonce_buf = self
                .result_nonce_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL result nonce buffer not initialized"))?;
            let result_hash_buf = self
                .result_hash_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL result hash buffer not initialized"))?;
            let scratchpad_buf = self
                .scratchpad_buf
                .as_ref()
                .ok_or_else(|| anyhow!("OpenCL scratchpad buffer not initialized"))?;
            let npu_w1_buf = self.npu_w1_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU w1 buffer not initialized"))?;
            let npu_b1_buf = self.npu_b1_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU b1 buffer not initialized"))?;
            let npu_w2_buf = self.npu_w2_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU w2 buffer not initialized"))?;
            let npu_b2_buf = self.npu_b2_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU b2 buffer not initialized"))?;
            let npu_scale1_buf = self.npu_scale1_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU scale1 buffer not initialized"))?;
            let npu_scale2_buf = self.npu_scale2_buf.as_ref()
                .ok_or_else(|| anyhow!("OpenCL NPU scale2 buffer not initialized"))?;

            if batch_size == 0 {
                return Ok(None);
            }

            // ═══ Deeksha target: pool sends 8-hex-char u32 target, right-justified
            // in a 32-byte array by parse_target_bytes(). Read the last 4 bytes (BE).
            let target_u32: u32 = u32::from_be_bytes([
                target[28], target[29], target[30], target[31],
            ]);

            // Reset result buffers
            let nonce_init = [u64::MAX];
            result_nonce_buf.write(&nonce_init[..]).enq()?;
            let hash_init = [0u8; 32];
            result_hash_buf.write(&hash_init[..]).enq()?;

            // Upload header — cap at 80 bytes, pad to 144.
            let header_len = header.len().min(80);
            let mut padded_header = [0u8; 144];
            padded_header[..header_len].copy_from_slice(&header[..header_len]);
            header_buf.write(&padded_header[..]).enq()?;

            // Deeksha always uses memory-hard scratchpad — limit batch to pre-allocated slots.
            let max_wg = pro_que.device().max_wg_size().unwrap_or(256);
            let local_work_size = 256usize.min(max_wg);
            let effective_batch = (batch_size as usize).min(self.mh_batch_size);
            let raw_global = effective_batch.max(local_work_size);
            let global_work_size =
                ((raw_global + local_work_size - 1) / local_work_size) * local_work_size;

            // Build Ekam Deeksha kernel (Blake3 XOF scratchpad, 8-round fusion)
            let kernel = pro_que
                .kernel_builder("ekam_deeksha_mine")
                .arg(header_buf)
                .arg(header_len as u32)
                .arg(nonce_start)
                .arg(effective_batch as u32)
                .arg(scratchpad_buf)
                .arg(target_u32)
                .arg(result_nonce_buf)
                .arg(result_hash_buf)
                .arg(npu_w1_buf)
                .arg(npu_b1_buf)
                .arg(npu_w2_buf)
                .arg(npu_b2_buf)
                .arg(npu_scale1_buf)
                .arg(npu_scale2_buf)
                .global_work_size(global_work_size)
                .local_work_size(local_work_size)
                .build()?;

            unsafe {
                kernel.enq()?;
            }

            pro_que.queue().finish()?;

            let mut nonce_res = [0u64; 1];
            result_nonce_buf.read(&mut nonce_res[..]).enq()?;

            self.hashes_computed += effective_batch as u64;

            if nonce_res[0] != u64::MAX {
                let nonce = nonce_res[0];
                let mut gpu_hash = [0u8; 32];
                result_hash_buf.read(&mut gpu_hash[..]).enq()?;
                return Ok(Some((nonce, gpu_hash)));
            }

            Ok(None)
        }

        #[cfg(not(feature = "gpu"))]
        {
            let _ = (header, target, nonce_start, batch_size, height);
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

    fn effective_batch_size(&self, requested_batch_size: u64, _height: u64) -> u64 {
        requested_batch_size.min(self.mh_batch_size as u64)
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
