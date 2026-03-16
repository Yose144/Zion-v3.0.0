//! GPU DCR Blake3 mining via OpenCL.
//!
//! Uses the precomputed-CV approach:
//! - Host computes chaining value through first 128 bytes (2 compression blocks)
//! - GPU only processes the 52-byte tail (containing the nonce) per work-item
//! - Each work-item does 1 root compression + target comparison
//!
//! Requires `--features gpu` to compile.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::time::Instant;

use ocl::{Buffer, Device, Kernel, Platform, ProQue};
use serde_json::Value;

/// Blake3 IV constants (matching the standard).
const BLAKE3_IV: [u32; 8] = [
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
];

const BLAKE3_MSG_PERM: [usize; 16] = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];
const CHUNK_START: u32 = 1;

/// Max results the GPU kernel can write per dispatch.
const MAX_RESULTS: u32 = 256;

fn profile_path() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("zion").join("miner_gpu_profiles.json")
}

pub fn load_saved_work_size(device: &str) -> Option<usize> {
    let path = profile_path();
    let text = std::fs::read_to_string(path).ok()?;
    let parsed: Value = serde_json::from_str(&text).ok()?;
    let obj = parsed.as_object()?;
    let v = obj.get(device)?.as_u64()?;
    Some(v as usize)
}

pub fn save_work_size(device: &str, work_size: usize) -> Result<(), String> {
    let path = profile_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create profile dir: {e}"))?;
    }

    let mut map: BTreeMap<String, usize> = if path.exists() {
        let text = std::fs::read_to_string(&path).map_err(|e| format!("read profiles: {e}"))?;
        serde_json::from_str(&text).unwrap_or_default()
    } else {
        BTreeMap::new()
    };

    map.insert(device.to_string(), work_size);
    let payload = serde_json::to_string_pretty(&map).map_err(|e| format!("encode profiles: {e}"))?;
    std::fs::write(&path, payload).map_err(|e| format!("write profiles: {e}"))
}

pub fn autotune_best_work_size(candidates: &[usize], secs: f64) -> Result<(String, usize, f64), String> {
    if candidates.is_empty() {
        return Err("no autotune candidates".to_string());
    }

    let mut best_ws = candidates[0];
    let mut best_mhps = 0.0;
    let mut best_device = String::new();

    for &ws in candidates {
        let mut gpu = GpuDcrMiner::new(ws)?;
        let device = gpu.device_name();
        let (_, _, mhps) = gpu.benchmark(secs)?;
        if mhps > best_mhps {
            best_mhps = mhps;
            best_ws = ws;
            best_device = device;
        }
    }

    Ok((best_device, best_ws, best_mhps))
}

// ─── Blake3 compression (CPU-side precomputation) ───────────────────────────

#[inline]
fn rotr32(x: u32, n: u32) -> u32 {
    x.rotate_right(n)
}

fn g(st: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize, mx: u32, my: u32) {
    st[a] = st[a].wrapping_add(st[b]).wrapping_add(mx);
    st[d] = rotr32(st[d] ^ st[a], 16);
    st[c] = st[c].wrapping_add(st[d]);
    st[b] = rotr32(st[b] ^ st[c], 12);
    st[a] = st[a].wrapping_add(st[b]).wrapping_add(my);
    st[d] = rotr32(st[d] ^ st[a], 8);
    st[c] = st[c].wrapping_add(st[d]);
    st[b] = rotr32(st[b] ^ st[c], 7);
}

fn b3_round(st: &mut [u32; 16], msg: &[u32; 16]) {
    g(st, 0, 4,  8, 12, msg[0],  msg[1]);
    g(st, 1, 5,  9, 13, msg[2],  msg[3]);
    g(st, 2, 6, 10, 14, msg[4],  msg[5]);
    g(st, 3, 7, 11, 15, msg[6],  msg[7]);
    g(st, 0, 5, 10, 15, msg[8],  msg[9]);
    g(st, 1, 6, 11, 12, msg[10], msg[11]);
    g(st, 2, 7,  8, 13, msg[12], msg[13]);
    g(st, 3, 4,  9, 14, msg[14], msg[15]);
}

fn b3_permute(msg: &mut [u32; 16]) {
    let tmp = *msg;
    for i in 0..16 {
        msg[i] = tmp[BLAKE3_MSG_PERM[i]];
    }
}

/// Blake3 compress: returns all 16 state words.
fn b3_compress(cv: &[u32; 8], bw: &[u32; 16], counter: u64, block_len: u32, flags: u32) -> [u32; 16] {
    let mut st: [u32; 16] = [
        cv[0], cv[1], cv[2], cv[3],
        cv[4], cv[5], cv[6], cv[7],
        BLAKE3_IV[0], BLAKE3_IV[1], BLAKE3_IV[2], BLAKE3_IV[3],
        counter as u32,
        (counter >> 32) as u32,
        block_len,
        flags,
    ];
    let mut msg = *bw;
    for _ in 0..7 {
        b3_round(&mut st, &msg);
        b3_permute(&mut msg);
    }
    st
}

/// Compress and extract chaining value (XOR of upper and lower halves).
fn b3_compress_cv(cv: &[u32; 8], bw: &[u32; 16], counter: u64, block_len: u32, flags: u32) -> [u32; 8] {
    let full = b3_compress(cv, bw, counter, block_len, flags);
    let mut out = [0u32; 8];
    for i in 0..8 {
        out[i] = full[i] ^ full[i + 8];
    }
    out
}

/// Load bytes into 16 LE uint32 words (zero-padded).
fn load_words(data: &[u8]) -> [u32; 16] {
    let mut words = [0u32; 16];
    for i in 0..data.len().min(64) / 4 {
        words[i] = u32::from_le_bytes([
            data[i * 4],
            data[i * 4 + 1],
            data[i * 4 + 2],
            data[i * 4 + 3],
        ]);
    }
    // Handle trailing bytes
    let full_words = data.len().min(64) / 4;
    let remaining = data.len().min(64) - full_words * 4;
    if remaining > 0 {
        let mut w = 0u32;
        for j in 0..remaining {
            w |= (data[full_words * 4 + j] as u32) << (j * 8);
        }
        words[full_words] = w;
    }
    words
}

/// Precompute Blake3 chaining value after the first 128 bytes.
/// This is the CPU-side work that enables the GPU to only process 52 bytes per nonce.
pub fn precompute_cv(header: &[u8; 180]) -> [u32; 8] {
    // Block 0 (bytes 0-63): CHUNK_START, counter=0
    let block0 = load_words(&header[0..64]);
    let cv = b3_compress_cv(&BLAKE3_IV, &block0, 0, 64, CHUNK_START);

    // Block 1 (bytes 64-127): no special flags, counter=0
    let block1 = load_words(&header[64..128]);
    b3_compress_cv(&cv, &block1, 0, 64, 0)
}

/// Verify precomputed approach matches blake3::hash() for a given header.
pub fn verify_precompute(header: &[u8; 180]) -> bool {
    let expected = *blake3::hash(header).as_bytes();

    let cv = precompute_cv(header);
    let tail_words = load_words(&header[128..180]);
    // Root compress: counter=0, block_len=52, CHUNK_END | ROOT
    let st = b3_compress(&cv, &tail_words, 0, 52, 2 | 8); // CHUNK_END=2, ROOT=8

    // Root hash = XOR of upper and lower halves of compress state
    let mut hash = [0u8; 32];
    for i in 0..8 {
        let w = st[i] ^ st[i + 8];
        hash[i * 4..i * 4 + 4].copy_from_slice(&w.to_le_bytes());
    }

    if hash != expected {
        eprintln!("precompute: mismatch (expected {:02x?}, got {:02x?})", &expected[..8], &hash[..8]);
    }

    hash == expected
}

/// Convert target bytes (32 bytes, big-endian 256-bit) to 8 big-endian uint32 words.
fn target_to_be_words(target: &[u8; 32]) -> [u32; 8] {
    let mut words = [0u32; 8];
    for i in 0..8 {
        words[i] = u32::from_be_bytes([
            target[i * 4],
            target[i * 4 + 1],
            target[i * 4 + 2],
            target[i * 4 + 3],
        ]);
    }
    words
}

/// GPU DCR miner instance.
pub struct GpuDcrMiner {
    pro_que: ProQue,
    kernel: Kernel,
    cv_buf: Buffer<u32>,
    tail_buf: Buffer<u8>,
    target_buf: Buffer<u32>,
    results_buf: Buffer<u32>,
    global_work_size: usize,
}

impl GpuDcrMiner {
    /// Initialize GPU miner. Returns None if no OpenCL GPU is found.
    pub fn new(global_work_size: usize) -> Result<Self, String> {
        let kernel_src = include_str!("dcr_blake3_mine.cl");

        // Find first available GPU
        let platform = Platform::default();
        let device = Device::list(platform, Some(ocl::flags::DeviceType::GPU))
            .map_err(|e| format!("OpenCL device list: {e}"))?
            .into_iter()
            .next()
            .ok_or("no OpenCL GPU found")?;

        let pro_que = ProQue::builder()
            .platform(platform)
            .device(device)
            .src(kernel_src)
            .dims(global_work_size)
            .build()
            .map_err(|e| format!("OpenCL build: {e}"))?;

        let cv_buf = Buffer::<u32>::builder()
            .queue(pro_que.queue().clone())
            .len(8)
            .build()
            .map_err(|e| format!("cv buffer: {e}"))?;

        let tail_buf = Buffer::<u8>::builder()
            .queue(pro_que.queue().clone())
            .len(52)
            .build()
            .map_err(|e| format!("tail buffer: {e}"))?;

        let target_buf = Buffer::<u32>::builder()
            .queue(pro_que.queue().clone())
            .len(8)
            .build()
            .map_err(|e| format!("target buffer: {e}"))?;

        let results_buf = Buffer::<u32>::builder()
            .queue(pro_que.queue().clone())
            .len(1 + MAX_RESULTS as usize)
            .build()
            .map_err(|e| format!("results buffer: {e}"))?;

        let kernel = pro_que
            .kernel_builder("dcr_blake3_mine")
            .arg(&cv_buf)
            .arg(&tail_buf)
            .arg(&target_buf)
            .arg(0u32) // nonce_start — updated per dispatch
            .arg(&results_buf)
            .arg(MAX_RESULTS)
            .build()
            .map_err(|e| format!("kernel build: {e}"))?;

        Ok(Self {
            pro_que,
            kernel,
            cv_buf,
            tail_buf,
            target_buf,
            results_buf,
            global_work_size,
        })
    }

    /// Get GPU device name.
    pub fn device_name(&self) -> String {
        self.pro_que
            .device()
            .name()
            .unwrap_or_else(|_| "unknown".to_string())
    }

    pub fn batch_size(&self) -> u32 {
        self.global_work_size as u32
    }

    /// Run a benchmark returning (total_hashes, elapsed_secs, megahashes_per_sec).
    pub fn benchmark(&mut self, seconds: f64) -> Result<(u64, f64, f64), String> {
        let header = [0u8; 180];
        let target = [0u8; 32]; // impossible target — pure throughput measurement

        let cv = precompute_cv(&header);
        let tail: Vec<u8> = header[128..180].to_vec();
        let target_be = target_to_be_words(&target);

        // Upload static buffers
        self.cv_buf.write(&cv as &[u32]).enq().map_err(|e| format!("{e}"))?;
        self.tail_buf.write(&tail).enq().map_err(|e| format!("{e}"))?;
        self.target_buf.write(&target_be as &[u32]).enq().map_err(|e| format!("{e}"))?;

        let start = Instant::now();
        let mut total_hashes: u64 = 0;
        let mut nonce_start: u32 = 0;
        let batch = self.global_work_size as u32;

        loop {
            // Clear results
            let zeros = vec![0u32; 1 + MAX_RESULTS as usize];
            self.results_buf.write(&zeros).enq().map_err(|e| format!("{e}"))?;

            // Update nonce_start
            self.kernel
                .set_arg(3, nonce_start)
                .map_err(|e| format!("{e}"))?;

            // Dispatch
            unsafe {
                self.kernel
                    .enq()
                    .map_err(|e| format!("kernel enq: {e}"))?;
            }

            // Wait for completion
            self.pro_que.queue().finish().map_err(|e| format!("{e}"))?;

            total_hashes += batch as u64;
            nonce_start = nonce_start.wrapping_add(batch);

            let elapsed = start.elapsed().as_secs_f64();
            if elapsed >= seconds {
                let mhps = total_hashes as f64 / elapsed / 1_000_000.0;
                return Ok((total_hashes, elapsed, mhps));
            }
        }
    }

    /// Mine a batch of nonces. Returns found nonces (if any meet target).
    #[allow(dead_code)]
    pub fn mine_batch(
        &mut self,
        header: &[u8; 180],
        target: &[u8; 32],
        nonce_start: u32,
    ) -> Result<Vec<u32>, String> {
        let cv = precompute_cv(header);
        let tail: Vec<u8> = header[128..180].to_vec();
        let target_be = target_to_be_words(target);

        self.cv_buf.write(&cv as &[u32]).enq().map_err(|e| format!("{e}"))?;
        self.tail_buf.write(&tail).enq().map_err(|e| format!("{e}"))?;
        self.target_buf.write(&target_be as &[u32]).enq().map_err(|e| format!("{e}"))?;

        let zeros = vec![0u32; 1 + MAX_RESULTS as usize];
        self.results_buf.write(&zeros).enq().map_err(|e| format!("{e}"))?;

        self.kernel
            .set_arg(3, nonce_start)
            .map_err(|e| format!("{e}"))?;

        unsafe {
            self.kernel
                .enq()
                .map_err(|e| format!("kernel enq: {e}"))?;
        }

        self.pro_que.queue().finish().map_err(|e| format!("{e}"))?;

        // Read results
        let mut results = vec![0u32; 1 + MAX_RESULTS as usize];
        self.results_buf.read(&mut results).enq().map_err(|e| format!("{e}"))?;

        let count = results[0].min(MAX_RESULTS) as usize;
        Ok(results[1..1 + count].to_vec())
    }
}
