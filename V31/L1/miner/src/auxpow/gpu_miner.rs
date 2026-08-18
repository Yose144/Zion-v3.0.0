//! GPU miner harness for OpenCL-accelerated ZION Ekam Deeksha mining.
//!
//! When the `gpu-opencl` feature is enabled, this module builds the canonical
//! `ekam_deeksha.cl` kernel from `zion-cosmic-harmony` and dispatches it on the
//! first available OpenCL GPU device. Without `gpu-opencl`, the backend is a
//! stub that reports GPU mining as unavailable.

use anyhow::Result;

/// A found share from GPU mining.
#[derive(Debug, Clone)]
pub struct GpuFoundShare {
    pub nonce: u64,
    pub hash: [u8; 32],
    pub mix_hash: Option<[u8; 32]>,
    pub solution: Option<Vec<u8>>,
}

/// DAG manager for Ethash/KawPow/ProgPow (stub).
#[derive(Clone)]
pub struct DagManager;

impl DagManager {
    pub fn new() -> Result<Self> {
        anyhow::bail!("DAG management is not implemented in V31")
    }
}

/// OpenCL backend module.
pub mod opencl_backend {
    use super::GpuMiner;
    use anyhow::Result;

    pub fn new(_batch_size: usize) -> Result<GpuMiner> {
        GpuMiner::new()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// OpenCL implementation
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(feature = "gpu-opencl")]
mod opencl_impl {
    use super::GpuFoundShare;
    use crate::gpu_guard::{GpuAlgorithm, GpuDeviceFamily, GpuTuning};
    use anyhow::{Context, Result};
    use ocl::builders::ProgramBuilder;
    use ocl::{Buffer, Device, Kernel, MemFlags, Platform, ProQue};
    use zion_cosmic_harmony::algorithms_npu::{chv4_npu_weights_packed, epoch_from_height};
    use zion_cosmic_harmony::gpu::opencl_kernel;

    const SCRATCHPAD_BYTES: usize = 512 * 1024; // 512 KiB per thread (Ekam Deeksha v3.2)
    const SENTINEL: u64 = 0xFFFF_FFFF_FFFF_FFFF;

    /// Precompute Keccak-256 state after absorbing the 80-byte header.
    ///
    /// The kernel then only XORs the 8-byte nonce into state word 10,
    /// applies the Ethereum padding bits and runs `keccak_f1600`.
    fn precompute_header_keccak_state(header_80: &[u8; 80]) -> [u64; 25] {
        let mut state = [0u64; 25];
        for (i, &b) in header_80.iter().enumerate() {
            let word_idx = i / 8;
            let shift = (i % 8) * 8;
            state[word_idx] ^= (b as u64) << shift;
        }
        state
    }

    fn is_deeksha_algorithm(algorithm: &str) -> bool {
        matches!(
            algorithm,
            "ekam_deeksha"
                | "deeksha_lite_v1"
                | "deeksha_lite"
                | "deeksha_chv3"
                | "deeksha_lite_fire"
                | "cosmic_harmony_ekam_deeksha_v2"
        )
    }

    /// Single compiled OpenCL kernel with its device-side buffers.
    struct OpenClState {
        pro_que: ProQue,
        kernel: Kernel,
        header_state_buf: Buffer<u64>,
        scratchpad_buf: Buffer<u8>,
        output_hashes_buf: Buffer<u8>,
        stream_weights_buf: Buffer<f32>,
        result_flag_buf: Buffer<u32>,
        result_nonce_buf: Buffer<u64>,
        result_hash_buf: Buffer<u8>,
        work_size: usize,
        local_ws: usize,
    }

    impl OpenClState {
        fn new(
            device: Device,
            platform: Platform,
            family: GpuDeviceFamily,
            vram: usize,
            kernel_src: &str,
            kernel_name: &str,
        ) -> Result<Self> {
            // Tuning for canonical Ekam Deeksha v3.2 (512 KiB scratchpad,
            // SHA3-512 + AES pipeline).
            let tuning = GpuTuning::auto_tune(GpuAlgorithm::EkamDeeksha, family, vram);

            // Allow the operator to override the local work size.
            let local_ws = std::env::var("ZION_OCL_LOCAL_SIZE")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok())
                .map(|v| v.clamp(32, 512))
                .unwrap_or(tuning.local_ws);

            let actual_work_size = tuning.work_size.max(64).next_power_of_two();

            let mut prog = ProgramBuilder::new();
            prog.src(kernel_src);
            if !tuning.build_opts.is_empty() {
                prog.cmplr_opt(&tuning.build_opts);
            }

            let pro_que = ProQue::builder()
                .platform(platform)
                .device(device)
                .prog_bldr(prog)
                .dims(actual_work_size)
                .build()
                .with_context(|| format!("OpenCL build failed for {kernel_name}"))?;

            let q = pro_que.queue().clone();

            let header_state_buf = Buffer::<u64>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(25)
                .build()
                .with_context(|| "header_state_buf allocation failed")?;

            let scratchpad_buf = Buffer::<u8>::builder()
                .queue(q.clone())
                .len(actual_work_size * SCRATCHPAD_BYTES)
                .build()
                .with_context(|| "scratchpad_buf allocation failed")?;

            let output_hashes_buf = Buffer::<u8>::builder()
                .queue(q.clone())
                .len(actual_work_size * 32)
                .build()
                .with_context(|| "output_hashes_buf allocation failed")?;

            let stream_weights_zero = [0.0f32; 6];
            let stream_weights_buf = Buffer::<f32>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(6)
                .copy_host_slice(&stream_weights_zero[..])
                .build()?;

            let result_flag_buf = Buffer::<u32>::builder()
                .queue(q.clone())
                .len(1)
                .copy_host_slice(&[0u32])
                .build()?;

            let result_nonce_buf = Buffer::<u64>::builder()
                .queue(q.clone())
                .len(1)
                .copy_host_slice(&[SENTINEL])
                .build()?;

            let result_hash_buf = Buffer::<u8>::builder().queue(q.clone()).len(32).build()?;

            let kernel = pro_que
                .kernel_builder(kernel_name)
                .arg(&header_state_buf)
                .arg(0u64)
                .arg(0u32)
                .arg(&output_hashes_buf)
                .arg(&scratchpad_buf)
                .arg(&stream_weights_buf)
                .arg(0u32)
                .arg(&result_flag_buf)
                .arg(&result_nonce_buf)
                .arg(&result_hash_buf)
                .build()
                .with_context(|| format!("kernel build failed for {kernel_name}"))?;

            Ok(Self {
                pro_que,
                kernel,
                header_state_buf,
                scratchpad_buf,
                output_hashes_buf,
                stream_weights_buf,
                result_flag_buf,
                result_nonce_buf,
                result_hash_buf,
                work_size: actual_work_size,
                local_ws,
            })
        }

        /// Write the 80-byte header state to device memory.
        fn set_header(&self, header: &[u8]) -> Result<()> {
            let mut header_80 = [0u8; 80];
            let len = header.len().min(80);
            header_80[..len].copy_from_slice(&header[..len]);
            let state = precompute_header_keccak_state(&header_80);
            self.header_state_buf
                .write(&state[..])
                .enq()
                .with_context(|| "header state buffer write failed")?;
            Ok(())
        }

        /// Mine `nonce_count` nonces starting at `start_nonce`.
        /// Returns the first nonce that produces a hash <= target.
        fn mine(
            &mut self,
            header: &[u8],
            target: &[u8; 32],
            start_nonce: u64,
            nonce_count: u64,
        ) -> Result<Option<GpuFoundShare>> {
            if nonce_count == 0 {
                return Ok(None);
            }

            self.set_header(header)?;

            // Big-endian interpretation of the most significant 4 bytes.
            // The kernel performs the same comparison on-device.
            let target_u32 = u32::from_be_bytes([target[0], target[1], target[2], target[3]]);

            if target_u32 != 0 {
                // Fast path: on-device target check. The kernel writes the
                // winning nonce and hash directly into `result_*` buffers.
                self.result_flag_buf.write(&[0u32][..]).enq()?;
                self.result_nonce_buf.write(&[SENTINEL][..]).enq()?;
                self.kernel.set_arg(6, target_u32)?;

                let mut current_nonce = start_nonce;
                let mut left = nonce_count;

                while left > 0 {
                    let chunk = (left as usize).min(self.work_size);
                    let local_size = self.local_ws.min(chunk).max(1);
                    let global_size = chunk.div_ceil(local_size) * local_size;

                    self.kernel.set_arg(1, current_nonce)?;
                    self.kernel.set_arg(2, chunk as u32)?;

                    unsafe {
                        self.kernel
                            .cmd()
                            .global_work_size(global_size)
                            .local_work_size(local_size)
                            .enq()
                            .with_context(|| "kernel enqueue failed")?;
                    }

                    current_nonce = current_nonce.wrapping_add(chunk as u64);
                    left = left.saturating_sub(chunk as u64);
                }

                self.pro_que.queue().finish()?;

                let mut flag = vec![0u32; 1];
                self.result_flag_buf.read(&mut flag).enq()?;

                if flag[0] != 0 {
                    let mut nonce = vec![0u64; 1];
                    self.result_nonce_buf.read(&mut nonce).enq()?;
                    let mut hash = vec![0u8; 32];
                    self.result_hash_buf.read(&mut hash).enq()?;
                    let mut hash_arr = [0u8; 32];
                    hash_arr.copy_from_slice(&hash);
                    return Ok(Some(GpuFoundShare {
                        nonce: nonce[0],
                        hash: hash_arr,
                        mix_hash: None,
                        solution: None,
                    }));
                }

                return Ok(None);
            }

            // Benchmark / all-hashes path: target_u32 == 0. The kernel writes
            // every computed hash to `output_hashes_buf`; we scan it on the CPU.
            self.kernel.set_arg(6, 0u32)?;
            let mut current_nonce = start_nonce;
            let mut left = nonce_count;

            while left > 0 {
                let chunk = (left as usize).min(self.work_size);
                let local_size = self.local_ws.min(chunk).max(1);
                let global_size = chunk.div_ceil(local_size) * local_size;

                self.kernel.set_arg(1, current_nonce)?;
                self.kernel.set_arg(2, chunk as u32)?;

                unsafe {
                    self.kernel
                        .cmd()
                        .global_work_size(global_size)
                        .local_work_size(local_size)
                        .enq()
                        .with_context(|| "kernel enqueue failed")?;
                }

                self.pro_que.queue().finish()?;

                let mut hashes = vec![0u8; chunk * 32];
                self.output_hashes_buf.read(&mut hashes).enq()?;

                for i in 0..chunk {
                    let mut hash = [0u8; 32];
                    hash.copy_from_slice(&hashes[i * 32..(i + 1) * 32]);
                    if crate::auxpow::hasher::meets_target(&hash, target) {
                        let nonce = current_nonce.wrapping_add(i as u64);
                        return Ok(Some(GpuFoundShare {
                            nonce,
                            hash,
                            mix_hash: None,
                            solution: None,
                        }));
                    }
                }

                current_nonce = current_nonce.wrapping_add(chunk as u64);
                left = left.saturating_sub(chunk as u64);
            }

            Ok(None)
        }
    }

    /// OpenCL state for the full Cosmic Harmony Ekam Deeksha v2 kernel.
    struct EkamOpenClState {
        pro_que: ProQue,
        kernel: Kernel,
        header_buf: Buffer<u8>,
        scratchpad_buf: Buffer<u8>,
        result_nonce_buf: Buffer<u64>,
        result_hash_buf: Buffer<u8>,
        npu_weights_buf: Buffer<i8>,
        npu_biases_buf: Buffer<i8>,
        npu_scales_buf: Buffer<i16>,
        npu_meta_buf: Buffer<u32>,
        work_size: usize,
        local_ws: usize,
        current_epoch: u64,
    }

    impl EkamOpenClState {
        fn new(
            device: Device,
            platform: Platform,
            family: GpuDeviceFamily,
            vram: usize,
        ) -> Result<Self> {
            let tuning = GpuTuning::auto_tune(GpuAlgorithm::EkamDeeksha, family, vram);
            let local_ws = std::env::var("ZION_OCL_LOCAL_SIZE")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok())
                .map(|v| v.clamp(32, 512))
                .unwrap_or(tuning.local_ws);
            let actual_work_size = tuning.work_size.max(64).next_power_of_two();

            eprintln!(
                "gpu_opencl_ekam_init family={family:?} vram={}MiB work_size={actual_work_size} local_ws={local_ws}",
                vram / (1024 * 1024)
            );

            let mut build_opts = tuning.build_opts;
            build_opts.push_str(&format!(" -DWGS={} -DNPU_MAX_DIM=256", local_ws));

            let mut prog = ProgramBuilder::new();
            prog.src(opencl_kernel::get_ekam_deeksha_kernel_source());
            if !build_opts.is_empty() {
                prog.cmplr_opt(&build_opts);
            }

            let pro_que = ProQue::builder()
                .platform(platform)
                .device(device)
                .prog_bldr(prog)
                .dims(actual_work_size)
                .build()
                .with_context(|| "OpenCL build failed for ekam_deeksha_mine")?;

            let q = pro_que.queue().clone();

            let header_buf = Buffer::<u8>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(80)
                .build()
                .with_context(|| "ekam header_buf allocation failed")?;

            let scratchpad_buf = Buffer::<u8>::builder()
                .queue(q.clone())
                .len(actual_work_size * SCRATCHPAD_BYTES)
                .build()
                .with_context(|| "ekam scratchpad_buf allocation failed")?;

            let result_nonce_buf = Buffer::<u64>::builder()
                .queue(q.clone())
                .len(1)
                .copy_host_slice(&[SENTINEL])
                .build()?;

            let result_hash_buf = Buffer::<u8>::builder().queue(q.clone()).len(32).build()?;

            // Allocate placeholder NPU buffers; they are populated on first mine()
            // once the block height (and thus NPU epoch) is known.
            let npu_weights_buf = Buffer::<i8>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(1)
                .build()?;
            let npu_biases_buf = Buffer::<i8>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(1)
                .build()?;
            let npu_scales_buf = Buffer::<i16>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(1)
                .build()?;
            let npu_meta_buf = Buffer::<u32>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(1)
                .build()?;

            let kernel = pro_que
                .kernel_builder(opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME)
                .arg(&header_buf)
                .arg(0u32)
                .arg(0u64)
                .arg(0u32)
                .arg(&scratchpad_buf)
                .arg(0u32)
                .arg(&result_nonce_buf)
                .arg(&result_hash_buf)
                .arg(&npu_weights_buf)
                .arg(&npu_biases_buf)
                .arg(&npu_scales_buf)
                .arg(&npu_meta_buf)
                .build()
                .with_context(|| "ekam_deeksha_mine kernel build failed")?;

            Ok(Self {
                pro_que,
                kernel,
                header_buf,
                scratchpad_buf,
                result_nonce_buf,
                result_hash_buf,
                npu_weights_buf,
                npu_biases_buf,
                npu_scales_buf,
                npu_meta_buf,
                work_size: actual_work_size,
                local_ws,
                current_epoch: u64::MAX,
            })
        }

        fn upload_npu_buffers(&mut self, block_height: u64) -> Result<()> {
            let epoch = epoch_from_height(block_height);
            if epoch == self.current_epoch {
                return Ok(());
            }
            self.current_epoch = epoch;

            let packed = chv4_npu_weights_packed(epoch);

            let q = self.pro_que.queue().clone();

            self.npu_weights_buf = Buffer::<i8>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(packed.weights.len())
                .copy_host_slice(&packed.weights)
                .build()
                .with_context(|| "ekam npu_weights_buf allocation failed")?;

            self.npu_biases_buf = Buffer::<i8>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(packed.biases.len())
                .copy_host_slice(&packed.biases)
                .build()
                .with_context(|| "ekam npu_biases_buf allocation failed")?;

            self.npu_scales_buf = Buffer::<i16>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(packed.scales.len())
                .copy_host_slice(&packed.scales)
                .build()
                .with_context(|| "ekam npu_scales_buf allocation failed")?;

            self.npu_meta_buf = Buffer::<u32>::builder()
                .queue(q.clone())
                .flags(MemFlags::READ_ONLY)
                .len(packed.meta.len())
                .copy_host_slice(&packed.meta)
                .build()
                .with_context(|| "ekam npu_meta_buf allocation failed")?;

            self.kernel.set_arg(8, &self.npu_weights_buf)?;
            self.kernel.set_arg(9, &self.npu_biases_buf)?;
            self.kernel.set_arg(10, &self.npu_scales_buf)?;
            self.kernel.set_arg(11, &self.npu_meta_buf)?;

            Ok(())
        }

        fn set_header(&self, header: &[u8]) -> Result<()> {
            let mut header_80 = [0u8; 80];
            let len = header.len().min(80);
            header_80[..len].copy_from_slice(&header[..len]);
            self.header_buf
                .write(&header_80[..])
                .enq()
                .with_context(|| "ekam header write failed")?;
            self.kernel.set_arg(1, len as u32)?;
            Ok(())
        }

        fn mine(
            &mut self,
            header: &[u8],
            target: &[u8; 32],
            start_nonce: u64,
            nonce_count: u64,
            block_height: u64,
        ) -> Result<Option<GpuFoundShare>> {
            if nonce_count == 0 {
                return Ok(None);
            }

            self.upload_npu_buffers(block_height)?;
            self.set_header(header)?;

            let target_u32 = u32::from_be_bytes([target[0], target[1], target[2], target[3]]);
            self.kernel.set_arg(5, target_u32)?;
            self.result_nonce_buf.write(&[SENTINEL][..]).enq()?;

            let mut current_nonce = start_nonce;
            let mut left = nonce_count;

            while left > 0 {
                let chunk = (left as usize).min(self.work_size);
                let local_size = self.local_ws.min(chunk).max(1);
                let global_size = chunk.div_ceil(local_size) * local_size;

                self.kernel.set_arg(2, current_nonce)?;
                self.kernel.set_arg(3, chunk as u32)?;

                unsafe {
                    self.kernel
                        .cmd()
                        .global_work_size(global_size)
                        .local_work_size(local_size)
                        .enq()
                        .with_context(|| "ekam kernel enqueue failed")?;
                }

                self.pro_que.queue().finish()?;

                let mut nonce = vec![0u64; 1];
                self.result_nonce_buf.read(&mut nonce).enq()?;
                if nonce[0] != SENTINEL {
                    let mut hash = vec![0u8; 32];
                    self.result_hash_buf.read(&mut hash).enq()?;
                    let mut hash_arr = [0u8; 32];
                    hash_arr.copy_from_slice(&hash);
                    return Ok(Some(GpuFoundShare {
                        nonce: nonce[0],
                        hash: hash_arr,
                        mix_hash: None,
                        solution: None,
                    }));
                }

                current_nonce = current_nonce.wrapping_add(chunk as u64);
                left = left.saturating_sub(chunk as u64);
            }

            Ok(None)
        }
    }

    pub struct GpuMiner {
        device_name: String,
        device: Device,
        platform: Platform,
        family: GpuDeviceFamily,
        vram: usize,
        lite: Option<OpenClState>,
        chv3: Option<OpenClState>,
        ekam: Option<EkamOpenClState>,
    }

    impl GpuMiner {
        fn pick_device() -> Result<(Platform, Device, String, String)> {
            let platforms = Platform::list();
            if platforms.is_empty() {
                anyhow::bail!("no OpenCL platforms found");
            }

            let platform_idx_override = std::env::var("ZION_OCL_PLATFORM_IDX")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok());
            let device_idx_override = std::env::var("ZION_OCL_DEVICE_IDX")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok());

            let mut candidates = Vec::new();
            for (pidx, platform) in platforms.iter().enumerate() {
                if let Some(only_idx) = platform_idx_override {
                    if pidx != only_idx {
                        continue;
                    }
                }
                let platform_name = platform
                    .name()
                    .unwrap_or_else(|_| "unknown-platform".to_string());
                let gpus = Device::list(platform, Some(ocl::flags::DeviceType::GPU))
                    .with_context(|| format!("OpenCL device list on {platform_name}"))?;
                for (didx, device) in gpus.into_iter().enumerate() {
                    let device_name = device
                        .name()
                        .unwrap_or_else(|_| "unknown-device".to_string());
                    candidates.push((
                        pidx,
                        didx,
                        *platform,
                        device,
                        platform_name.clone(),
                        device_name,
                    ));
                }
            }

            if candidates.is_empty() {
                anyhow::bail!("no OpenCL GPU devices found");
            }

            let idx = device_idx_override
                .unwrap_or(0)
                .min(candidates.len().saturating_sub(1));
            let (pidx, didx, platform, device, platform_name, device_name) =
                candidates.swap_remove(idx);

            eprintln!(
                "gpu_opencl_pick platform_idx={pidx} device_idx={didx} \"{platform_name}\" \"{device_name}\""
            );

            Ok((platform, device, platform_name, device_name))
        }

        pub fn new() -> Result<Self> {
            let (platform, device, _platform_name, device_name) = Self::pick_device()?;
            let family = GpuDeviceFamily::from_name(&device_name);
            let vram = device
                .info(ocl::enums::DeviceInfo::GlobalMemSize)
                .ok()
                .and_then(|v| match v {
                    ocl::enums::DeviceInfoResult::GlobalMemSize(n) => Some(n as usize),
                    _ => None,
                })
                .unwrap_or(2_000_000_000);

            let tuning = GpuTuning::auto_tune(GpuAlgorithm::EkamDeeksha, family, vram);
            let actual_work_size = tuning.work_size.max(64).next_power_of_two();
            let local_ws = std::env::var("ZION_OCL_LOCAL_SIZE")
                .ok()
                .and_then(|v| v.trim().parse::<usize>().ok())
                .map(|v| v.clamp(32, 512))
                .unwrap_or(tuning.local_ws);

            eprintln!(
                "gpu_opencl_init family={family:?} device=\"{device_name}\" vram={}MiB work_size={actual_work_size} local_ws={local_ws}",
                vram / (1024 * 1024)
            );

            let lite = OpenClState::new(
                device,
                platform,
                family,
                vram,
                opencl_kernel::get_ekam_deeksha_kernel_source(),
                opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME,
            )
            .with_context(|| "deeksha_lite OpenCL state setup failed")?;

            Ok(Self {
                device_name,
                device,
                platform,
                family,
                vram,
                lite: Some(lite),
                chv3: None,
                ekam: None,
            })
        }

        fn lite_state(&mut self) -> Result<&mut OpenClState> {
            if self.lite.is_none() {
                self.lite = Some(OpenClState::new(
                    self.device,
                    self.platform,
                    self.family,
                    self.vram,
                    opencl_kernel::get_ekam_deeksha_kernel_source(),
                    opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME,
                )?);
            }
            Ok(self.lite.as_mut().expect("lite state just created"))
        }

        fn chv3_state(&mut self) -> Result<&mut OpenClState> {
            if self.chv3.is_none() {
                self.chv3 = Some(OpenClState::new(
                    self.device,
                    self.platform,
                    self.family,
                    self.vram,
                    opencl_kernel::get_ekam_deeksha_kernel_source(),
                    opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME,
                )?);
            }
            Ok(self.chv3.as_mut().expect("chv3 state just created"))
        }

        fn ekam_state(&mut self) -> Result<&mut EkamOpenClState> {
            if self.ekam.is_none() {
                self.ekam = Some(EkamOpenClState::new(
                    self.device,
                    self.platform,
                    self.family,
                    self.vram,
                )?);
            }
            Ok(self.ekam.as_mut().expect("ekam state just created"))
        }

        pub fn mine_simple(
            &mut self,
            algorithm: &str,
            header: &[u8],
            target: &[u8; 32],
            start_nonce: u64,
            nonce_count: u64,
            _block_height: u64,
        ) -> Result<Option<GpuFoundShare>> {
            if !is_deeksha_algorithm(algorithm) {
                return Ok(None);
            }
            self.lite_state()?
                .mine(header, target, start_nonce, nonce_count)
        }

        pub fn device_name(&self) -> &str {
            &self.device_name
        }
    }
}

#[cfg(feature = "gpu-opencl")]
pub use opencl_impl::GpuMiner;

// ═══════════════════════════════════════════════════════════════════════════
// Stub implementation
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(not(feature = "gpu-opencl"))]
pub struct GpuMiner;

#[cfg(not(feature = "gpu-opencl"))]
impl GpuMiner {
    pub fn new() -> Result<Self> {
        anyhow::bail!("GPU mining is not available (gpu-opencl feature not enabled)")
    }

    pub fn mine_simple(
        &mut self,
        _algorithm: &str,
        _header: &[u8],
        _target: &[u8; 32],
        _start_nonce: u64,
        _nonce_count: u64,
        _block_height: u64,
    ) -> Result<Option<GpuFoundShare>> {
        anyhow::bail!("GPU mining is not available (gpu-opencl feature not enabled)")
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gpu_miner_types_compile() {
        let _ = std::any::type_name::<GpuFoundShare>();
        let _ = std::any::type_name::<DagManager>();
        let _ = std::any::type_name::<GpuMiner>();
        assert!(DagManager::new().is_err());
    }

    #[cfg(feature = "gpu-opencl")]
    #[test]
    #[ignore = "requires OpenCL GPU"]
    fn opencl_deeksha_nonce_zero_matches_cpu() {
        // Skip silently if no OpenCL device is present.
        let mut miner = match GpuMiner::new() {
            Ok(m) => m,
            Err(_) => return,
        };

        let header = b"ZION_OPENCL_DEEKSHA_TEST";
        let mut target = [0u8; 32];
        target.fill(0xFF); // maximally easy target: every hash meets it

        let result = miner
            .mine_simple("ekam_deeksha", header, &target, 0, 1, 0)
            .expect("mine_simple should not error");

        let share = result.expect("GPU should find a share with an all-0xFF target");
        assert_eq!(share.nonce, 0, "first nonce tested should be 0");

        let cpu_hash = zion_cosmic_harmony::algorithm::ekam_deeksha::EkamDeeksha::hash_bytes(header, 0);
        assert_eq!(
            share.hash, cpu_hash,
            "GPU hash for nonce 0 must match CPU EkamDeeksha"
        );
    }
}
