//! GPU-Algorithm Mining — ETC (Ethash) + ERG (Autolykos v2) native stratum clients
//!
//! Architecture
//! ────────────
//! Each coin has an independent tokio task:
//!
//!   GpuMiner::start() ──┬── EthStratumTask (ETC → etc.2miners.com:1010)
//!                        └── ErgStratumTask  (ERG → erg.2miners.com:2012)
//!
//! Both tasks:
//!   1. Connect and authenticate with the upstream pool
//!   2. Parse incoming jobs
//!   3. Run a native CPU miner loop (via FFI) on a Rayon thread pool
//!   4. Submit valid shares back to the upstream pool
//!
//! Native FFI is enabled when the pool is compiled with:
//!   --features native-ethash      (ETC)
//!   --features native-autolykos   (ERG)
//!
//! Without those features the module is still active — it keeps the stratum
//! connection alive and logs jobs, but mining is skipped (GPU-only workload).
//!
//! EthStratum v1 (ETC / etc.2miners.com)
//! ──────────────────────────────────────
//! C→S  {"id":1,"method":"eth_submitLogin","params":["<wallet>","<worker>"],"worker":"<worker>"}
//! S→C  {"id":1,"result":true,"error":null}
//! S→C  {"id":0,"method":"eth_getWork","params":["<header>","<seed>","<target>","<height>"]}
//! C→S  {"id":1,"method":"eth_submitWork","params":["<nonce>","<header>","<mix_hash>"]}
//!
//! Nicehash / ErgStratum (ERG / erg.2miners.com)
//! ───────────────────────────────────────────────
//! C→S  {"id":1,"method":"mining.login","params":["<wallet>","<worker>","x"]}
//! S→C  {"id":1,"result":{"id":"<session>"},"error":null}
//! S→C  {"id":0,"method":"mining.notify","params":["<job_id>","<msg_hex>","<nBits>","<height>"]}
//! C→S  {"id":1,"method":"mining.submit","params":["<session>","<job_id>","<nonce_hex>"]}

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

// ============================  CONFIG  ======================================

/// Configuration for the GPU mining bridge
#[derive(Debug, Clone)]
pub struct GpuMiningConfig {
    pub enabled: bool,
    /// BTC/ETC payout wallet
    pub wallet: String,
    /// Worker name shown at upstream pool
    pub worker: String,
    /// Number of CPU threads for native mining (0 = disable mining, just connect)
    pub cpu_threads: usize,

    // ETC
    pub etc_enabled: bool,
    pub etc_pool: String,   // host:port, e.g. "etc.2miners.com:1010"

    // ERG
    pub erg_enabled: bool,
    pub erg_pool: String,   // host:port, e.g. "erg.2miners.com:2012"
}

impl Default for GpuMiningConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            wallet: std::env::var("GPU_WALLET")
                .unwrap_or_else(|_| "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw".to_string()),
            worker: std::env::var("GPU_WORKER").unwrap_or_else(|_| "zion-pool".to_string()),
            cpu_threads: std::env::var("GPU_CPU_THREADS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1),
            etc_enabled: !matches!(
                std::env::var("ETC_ENABLED").as_deref(),
                Ok("0") | Ok("false") | Ok("no") | Ok("off")
            ),
            etc_pool: std::env::var("ETC_POOL")
                .unwrap_or_else(|_| "etc.2miners.com:1010".to_string()),
            erg_enabled: !matches!(
                std::env::var("ERG_ENABLED").as_deref(),
                Ok("0") | Ok("false") | Ok("no") | Ok("off")
            ),
            erg_pool: std::env::var("ERG_POOL")
                .unwrap_or_else(|_| "erg.2miners.com:8888".to_string()),
        }
    }
}

// ============================  STATS  =======================================

#[derive(Debug, Default)]
pub struct GpuMiningStats {
    pub etc_hashes: AtomicU64,
    pub etc_shares_submitted: AtomicU64,
    pub etc_shares_accepted: AtomicU64,
    pub etc_current_job: Mutex<String>,

    pub erg_hashes: AtomicU64,
    pub erg_shares_submitted: AtomicU64,
    pub erg_shares_accepted: AtomicU64,
    pub erg_current_job: Mutex<String>,
}

impl GpuMiningStats {
    pub fn to_json(&self) -> Value {
        json!({
            "etc": {
                "hashes": self.etc_hashes.load(Ordering::Relaxed),
                "shares_submitted": self.etc_shares_submitted.load(Ordering::Relaxed),
                "shares_accepted": self.etc_shares_accepted.load(Ordering::Relaxed),
            },
            "erg": {
                "hashes": self.erg_hashes.load(Ordering::Relaxed),
                "shares_submitted": self.erg_shares_submitted.load(Ordering::Relaxed),
                "shares_accepted": self.erg_shares_accepted.load(Ordering::Relaxed),
            },
        })
    }
}

// ============================  MANAGER  =====================================

/// Top-level GPU mining manager spawned by the pool
pub struct GpuMiner {
    config: GpuMiningConfig,
    pub stats: Arc<GpuMiningStats>,
    running: Arc<AtomicBool>,
}

impl GpuMiner {
    pub fn from_env() -> Arc<Self> {
        let cfg = GpuMiningConfig::default();
        Arc::new(Self {
            config: cfg,
            stats: Arc::new(GpuMiningStats::default()),
            running: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Start all enabled mining tasks
    pub async fn start(self: Arc<Self>) {
        if self.running.swap(true, Ordering::SeqCst) {
            warn!("[GpuMiner] Already running");
            return;
        }

        info!(
            "[GpuMiner] Starting — ETC:{} ERG:{} wallet={} threads={}",
            self.config.etc_enabled,
            self.config.erg_enabled,
            &self.config.wallet[..16.min(self.config.wallet.len())],
            self.config.cpu_threads,
        );

        if self.config.etc_enabled {
            let m = Arc::clone(&self);
            tokio::spawn(async move { m.run_etc_loop().await });
        }

        if self.config.erg_enabled {
            let m = Arc::clone(&self);
            tokio::spawn(async move { m.run_erg_loop().await });
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    pub fn stats_json(&self) -> Value {
        self.stats.to_json()
    }
}

// ============================  ETC / ETHASH  ================================

/// Current ETC job
#[derive(Clone, Debug, Default)]
struct EtcJob {
    header_hash: Vec<u8>,   // 32 bytes
    seed_hash: Vec<u8>,     // 32 bytes (epoch seed)
    target: Vec<u8>,        // 32 bytes boundary
    height: u32,
}

impl GpuMiner {
    async fn run_etc_loop(self: Arc<Self>) {
        let reconnect_delay = Duration::from_secs(15);
        loop {
            info!("[ETC] Connecting to {}", self.config.etc_pool);
            match TcpStream::connect(&self.config.etc_pool).await {
                Err(e) => {
                    warn!("[ETC] Connect failed: {e} — retrying in 15s");
                    sleep(reconnect_delay).await;
                }
                Ok(stream) => {
                    if let Err(e) = self.clone().etc_session(stream).await {
                        warn!("[ETC] Session error: {e} — reconnecting in 15s");
                    }
                    sleep(reconnect_delay).await;
                }
            }
        }
    }

    async fn etc_session(self: Arc<Self>, stream: TcpStream) -> anyhow::Result<()> {
        let (read_half, write_half) = stream.into_split();
        let mut lines = BufReader::new(read_half).lines();
        let write_half = Arc::new(Mutex::new(write_half));

        // --- Login ---
        let login = json!({
            "id": 1,
            "method": "eth_submitLogin",
            "params": [&self.config.wallet, &self.config.worker],
            "worker": &self.config.worker
        });
        Self::send_line(&write_half, &login.to_string()).await?;
        info!("[ETC] Login sent as {}", self.config.worker);

        // Local state shared between reader and miner thread
        let current_job: Arc<Mutex<Option<EtcJob>>> = Arc::new(Mutex::new(None));
        let new_job_flag = Arc::new(AtomicBool::new(false));

        // Start mining thread
        if self.config.cpu_threads > 0 {
            let stats = Arc::clone(&self.stats);
            let job_ref = Arc::clone(&current_job);
            let flag = Arc::clone(&new_job_flag);
            let wh = Arc::clone(&write_half);
            let wallet = self.config.wallet.clone();
            let threads = self.config.cpu_threads;

            tokio::task::spawn_blocking(move || {
                etc_mine_loop(job_ref, flag, stats, wh, wallet, threads);
            });
        }

        // --- Read loop ---
        let _id_counter: u64 = 2; // reserved for future request ID sequencing
        while let Some(line) = lines.next_line().await? {
            debug!("[ETC] ← {}", line);
            let msg: Value = serde_json::from_str(&line).unwrap_or(Value::Null);
            if msg.is_null() {
                continue;
            }

            let method = msg["method"].as_str().unwrap_or("");

            match method {
                "eth_getWork" => {
                    if let Some(params) = msg["params"].as_array() {
                        let job = EtcJob {
                            header_hash: hex_to_bytes(params.get(0).and_then(|v| v.as_str()).unwrap_or("")),
                            seed_hash: hex_to_bytes(params.get(1).and_then(|v| v.as_str()).unwrap_or("")),
                            target: hex_to_bytes(params.get(2).and_then(|v| v.as_str()).unwrap_or("")),
                            height: params.get(3)
                                .and_then(|v| v.as_str())
                                .and_then(|s| u32::from_str_radix(s.trim_start_matches("0x"), 16).ok())
                                .unwrap_or(0),
                        };
                        info!(
                            "[ETC] New job h={} header={}...",
                            job.height,
                            hex::encode(&job.header_hash[..4.min(job.header_hash.len())])
                        );
                        *current_job.lock().await = Some(job);
                        new_job_flag.store(true, Ordering::Release);

                        // Update stats job string
                        *self.stats.etc_current_job.lock().await =
                            params.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    }
                }
                _ => {
                    // Check for result messages (login ack, share ack)
                    if let Some(result) = msg.get("result") {
                        let req_id = msg["id"].as_u64().unwrap_or(0);
                        if result.as_bool() == Some(true) {
                            if req_id == 1 {
                                info!("[ETC] Login accepted ✅");
                            } else {
                                info!("[ETC] Share #{req_id} accepted ✅");
                                self.stats.etc_shares_accepted.fetch_add(1, Ordering::Relaxed);
                            }
                        } else {
                            let err = msg.get("error").cloned().unwrap_or(Value::Null);
                            warn!("[ETC] Share #{req_id} rejected: {err}");
                        }
                    }
                    // Ping / pong
                    if let Some("eth_ping") = msg["method"].as_str() {
                        let pong_id = msg["id"].as_u64().unwrap_or(0) + 1;
                        let pong = json!({"id": pong_id, "method": "eth_pong", "params": []});
                        Self::send_line(&write_half, &pong.to_string()).await?;
                    }
                }
            }
        }

        Ok(())
    }

    async fn send_line(wh: &Arc<Mutex<tokio::net::tcp::OwnedWriteHalf>>, line: &str) -> anyhow::Result<()> {
        let mut guard = wh.lock().await;
        guard.write_all(line.as_bytes()).await?;
        guard.write_all(b"\n").await?;
        guard.flush().await?;
        Ok(())
    }
}

// ──── ETC mining thread (runs outside tokio) ─────────────────────────────────

fn etc_mine_loop(
    job_ref: Arc<Mutex<Option<EtcJob>>>,
    new_job_flag: Arc<AtomicBool>,
    stats: Arc<GpuMiningStats>,
    write_half: Arc<Mutex<tokio::net::tcp::OwnedWriteHalf>>,
    #[allow(dead_code)] _wallet: String,
    #[allow(dead_code)] _threads: usize,
) {
    #[cfg(not(feature = "native-ethash"))]
    {
        info!("[ETC] native-ethash feature not enabled — mining disabled, connection only");
        return;
    }

    #[cfg(feature = "native-ethash")]
    {
        use zion_cosmic_harmony_v3::native_ffi as ffi;

        // Initialize ethash context
        ffi::ethash_init();
        info!("[ETC] Ethash native init OK — starting CPU miner");

        let rt = tokio::runtime::Handle::try_current().ok();
        let mut nonce: u64 = rand_nonce();
        let mut current: Option<EtcJob> = None;

        loop {
            // Check for new job
            if new_job_flag.swap(false, Ordering::AcqRel) {
                // Non-blocking lock attempt
                if let Ok(guard) = job_ref.try_lock() {
                    current = guard.clone();
                }
            }

            let job = match &current {
                Some(j) if !j.header_hash.is_empty() => j.clone(),
                _ => {
                    std::thread::sleep(Duration::from_millis(100));
                    continue;
                }
            };

            // Compute one hash
            let hash = ffi::ethash_hash(&job.header_hash, nonce, job.height)
                .map(|h| h.hash)
                .unwrap_or_else(|_| vec![0xff; 32]);

            stats.etc_hashes.fetch_add(1, Ordering::Relaxed);

            // Check if hash < target (both 32 bytes, big-endian comparison)
            if !job.target.is_empty() && hash_lt(&hash, &job.target) {
                info!("[ETC] 🎉 Share found! nonce={:#018x} height={}", nonce, job.height);
                stats.etc_shares_submitted.fetch_add(1, Ordering::Relaxed);

                // Compute mix hash (we store it separately; for light evaluation we use hash as mix)
                // For a full Ethash proof we need the actual mix_hash — use header hash as placeholder
                // TODO: extend native_ffi to return mix_hash separately
                let mix_hash = hash.clone();

                let submit = json!({
                    "id": stats.etc_shares_submitted.load(Ordering::Relaxed),
                    "method": "eth_submitWork",
                    "params": [
                        format!("0x{:016x}", nonce),
                        format!("0x{}", hex::encode(&job.header_hash)),
                        format!("0x{}", hex::encode(&mix_hash)),
                    ]
                });

                let line = submit.to_string();
                if let Some(handle) = rt.as_ref() {
                    let wh = Arc::clone(&write_half);
                    handle.spawn(async move {
                        let mut guard = wh.lock().await;
                        let _ = guard.write_all(line.as_bytes()).await;
                        let _ = guard.write_all(b"\n").await;
                        let _ = guard.flush().await;
                    });
                }
            }

            nonce = nonce.wrapping_add(1);

            // Prevent 100% CPU spin — yield every 100 iterations
            if nonce % 100 == 0 {
                std::thread::sleep(Duration::from_micros(100));
            }
        }
    }
}

// ============================  ERG / AUTOLYKOS  ==============================

/// Current ERG job (Nicehash-stratum style)
#[derive(Clone, Debug, Default)]
struct ErgJob {
    job_id: String,
    msg: Vec<u8>,   // header blob / message for autolykos
    n_bits: u32,    // compact target
    height: u32,
    session_id: String,
    extranonce1: String,       // hex string, assigned by pool (e.g. "93d9")
    worker_nonce_size: usize,  // hex chars worker must send (e.g. 6)
}

impl GpuMiner {
    async fn run_erg_loop(self: Arc<Self>) {
        let reconnect_delay = Duration::from_secs(15);
        loop {
            info!("[ERG] Connecting to {}", self.config.erg_pool);
            match TcpStream::connect(&self.config.erg_pool).await {
                Err(e) => {
                    warn!("[ERG] Connect failed: {e} — retrying in 15s");
                    sleep(reconnect_delay).await;
                }
                Ok(stream) => {
                    if let Err(e) = self.clone().erg_session(stream).await {
                        warn!("[ERG] Session error: {e} — reconnecting in 15s");
                    }
                    sleep(reconnect_delay).await;
                }
            }
        }
    }

    async fn erg_session(self: Arc<Self>, stream: TcpStream) -> anyhow::Result<()> {
        let (read_half, write_half) = stream.into_split();
        let mut lines = BufReader::new(read_half).lines();
        let write_half = Arc::new(Mutex::new(write_half));

        // --- Subscribe (required by most Ergo pools before authorize) ---
        let subscribe = json!({
            "id": 1,
            "method": "mining.subscribe",
            "params": ["zion-pool/2.9.6", "EthereumStratum/1.0.0"]
        });
        Self::send_line(&write_half, &subscribe.to_string()).await?;

        // --- Authorize (wallet.worker format) ---
        let login_str = format!("{}.{}", &self.config.wallet, &self.config.worker);
        let login = json!({
            "id": 2,
            "method": "mining.authorize",
            "params": [login_str, "x"]
        });
        Self::send_line(&write_half, &login.to_string()).await?;
        info!("[ERG] Login sent as {}", self.config.worker);

        let current_job: Arc<Mutex<Option<ErgJob>>> = Arc::new(Mutex::new(None));
        let new_job_flag = Arc::new(AtomicBool::new(false));

        if self.config.cpu_threads > 0 {
            let stats = Arc::clone(&self.stats);
            let job_ref = Arc::clone(&current_job);
            let flag = Arc::clone(&new_job_flag);
            let wh = Arc::clone(&write_half);

            tokio::task::spawn_blocking(move || {
                erg_mine_loop(job_ref, flag, stats, wh);
            });
        }

        let mut session_id = String::new();
        let mut extranonce1 = String::new();
        let mut worker_nonce_size: usize = 6; // default 6 hex chars = 3 bytes

        while let Some(line) = lines.next_line().await? {
            debug!("[ERG] ← {}", line);
            let msg: Value = serde_json::from_str(&line).unwrap_or(Value::Null);
            if msg.is_null() {
                continue;
            }

            let method = msg["method"].as_str().unwrap_or("");

            match method {
                "mining.notify" => {
                    if let Some(params) = msg["params"].as_array() {
                        // 2miners ERG (9 params): [job_id, height, header_hex, "", "", nbits, target_hex, "", clean]
                        // 4 params fallback: [job_id, msg_hex, nbits, height]
                        let (job_id, header_hex, height, n_bits) = if params.len() >= 7 {
                            (
                                params.get(0).and_then(|v| v.as_str()).unwrap_or(""),
                                params.get(2).and_then(|v| v.as_str()).unwrap_or(""),
                                params.get(1).and_then(|v| v.as_u64()).map(|n| n as u32).unwrap_or(0),
                                params.get(5)
                                    .and_then(|v| v.as_str())
                                    .and_then(|s| u32::from_str_radix(s.trim_start_matches("0x"), 16).ok())
                                    .or_else(|| params.get(5).and_then(|v| v.as_u64()).map(|n| n as u32))
                                    .unwrap_or(0),
                            )
                        } else {
                            (
                                params.get(0).and_then(|v| v.as_str()).unwrap_or(""),
                                params.get(1).and_then(|v| v.as_str()).unwrap_or(""),
                                params.get(3).and_then(|v| v.as_u64()).map(|n| n as u32).unwrap_or(0),
                                params.get(2)
                                    .and_then(|v| v.as_str())
                                    .and_then(|s| u32::from_str_radix(s.trim_start_matches("0x"), 16).ok())
                                    .or_else(|| params.get(2).and_then(|v| v.as_u64()).map(|n| n as u32))
                                    .unwrap_or(0),
                            )
                        };
                        let job = ErgJob {
                            job_id: job_id.to_string(),
                            msg: hex_to_bytes(header_hex),
                            n_bits,
                            height,
                            session_id: session_id.clone(),
                            extranonce1: extranonce1.clone(),
                            worker_nonce_size,
                        };
                        info!("[ERG] New job id={} h={} en1={} ns={}", job.job_id, job.height, job.extranonce1, job.worker_nonce_size);
                        *self.stats.erg_current_job.lock().await = job.job_id.clone();
                        *current_job.lock().await = Some(job);
                        new_job_flag.store(true, Ordering::Release);
                    }
                }
                _ => {
                    let req_id = msg["id"].as_u64().unwrap_or(0);
                    if let Some(result) = msg.get("result") {
                        if req_id == 1 {
                            // subscribe response: [[methods], extranonce1, nonce_size]
                            if let Some(arr) = result.as_array() {
                                if let Some(en1) = arr.get(1).and_then(|v| v.as_str()) {
                                    extranonce1 = en1.to_string();
                                    session_id = en1.to_string();
                                }
                                if let Some(ns) = arr.get(2).and_then(|v| v.as_u64()) {
                                    worker_nonce_size = ns as usize;
                                }
                            }
                            info!("[ERG] ✅ Subscribed successfully");
                            info!("[ERG] 🔑 Extranonce: '{}' ({} hex chars)", extranonce1, extranonce1.len());
                            info!("[ERG] 📋 Subscribe response result: {:?}", result);
                        } else if req_id == 2 {
                            // authorize response
                            if result.as_bool() == Some(true) {
                                info!("[ERG] Login authorized ✅");
                            } else {
                                let err = msg.get("error").cloned().unwrap_or(Value::Null);
                                warn!("[ERG] Auth rejected: {err}");
                            }
                        } else if result.as_bool() == Some(true) {
                            info!("[ERG] Share #{req_id} accepted ✅");
                            self.stats.erg_shares_accepted.fetch_add(1, Ordering::Relaxed);
                        } else {
                            let err = msg.get("error").cloned().unwrap_or(Value::Null);
                            warn!("[ERG] Response rejected: {err}");
                        }
                    } else if let Some(err) = msg.get("error") {
                        warn!("[ERG] Error from pool: {err}");
                    }
                }
            }
        }
        Ok(())
    }
}

// ──── ERG mining thread ───────────────────────────────────────────────────────

fn erg_mine_loop(
    job_ref: Arc<Mutex<Option<ErgJob>>>,
    new_job_flag: Arc<AtomicBool>,
    stats: Arc<GpuMiningStats>,
    write_half: Arc<Mutex<tokio::net::tcp::OwnedWriteHalf>>,
) {
    #[cfg(not(feature = "native-autolykos"))]
    {
        info!("[ERG] native-autolykos feature not enabled — mining disabled, connection only");
        return;
    }

    #[cfg(feature = "native-autolykos")]
    {
        use zion_cosmic_harmony_v3::native_ffi as ffi;
        info!("[ERG] Autolykos v2 native miner starting");

        let rt = tokio::runtime::Handle::try_current().ok();
        let mut nonce: u64 = rand_nonce();
        let mut current: Option<ErgJob> = None;

        loop {
            if new_job_flag.swap(false, Ordering::AcqRel) {
                if let Ok(guard) = job_ref.try_lock() {
                    current = guard.clone();
                }
            }

            let job = match &current {
                Some(j) if !j.msg.is_empty() => j.clone(),
                _ => {
                    std::thread::sleep(Duration::from_millis(100));
                    continue;
                }
            };

            // Compute Autolykos v2 hash
            let hash = ffi::autolykos_hash(&job.msg, nonce, job.height)
                .map(|h| h.hash)
                .unwrap_or_else(|_| vec![0xff; 32]);

            stats.erg_hashes.fetch_add(1, Ordering::Relaxed);

            // Check target: nbits compact → target bytes
            let target = nbits_to_target(job.n_bits);
            if hash_lt(&hash, &target) {
                info!("[ERG] 🎉 Share found! nonce={:#018x} height={}", nonce, job.height);
                stats.erg_shares_submitted.fetch_add(1, Ordering::Relaxed);

                let ns = job.worker_nonce_size.max(1).min(16);
                let worker_nonce = if ns >= 16 {
                    nonce
                } else {
                    nonce & ((1u64 << (ns * 4)) - 1)
                };
                let submit = json!({
                    "id": stats.erg_shares_submitted.load(Ordering::Relaxed),
                    "method": "mining.submit",
                    "params": [
                        &job.session_id,
                        &job.job_id,
                        // Only send the worker portion: ns hex chars
                        format!("{:0>width$x}", worker_nonce, width = ns),
                    ]
                });
                let line = submit.to_string();
                if let Some(handle) = rt.as_ref() {
                    let wh = Arc::clone(&write_half);
                    handle.spawn(async move {
                        let mut guard = wh.lock().await;
                        let _ = guard.write_all(line.as_bytes()).await;
                        let _ = guard.write_all(b"\n").await;
                        let _ = guard.flush().await;
                    });
                }
            }

            nonce = nonce.wrapping_add(1);
            if nonce % 100 == 0 {
                std::thread::sleep(Duration::from_micros(100));
            }
        }
    }
}

// ============================  UTILITIES  ====================================

fn hex_to_bytes(s: &str) -> Vec<u8> {
    let s = s.trim_start_matches("0x");
    hex::decode(s).unwrap_or_default()
}

/// Return true if a < b (32-byte big-endian comparison)
fn hash_lt(a: &[u8], b: &[u8]) -> bool {
    let a = if a.len() >= 32 { &a[..32] } else { return false };
    let b = if b.len() >= 32 { &b[..32] } else { return false };
    for i in 0..32 {
        if a[i] < b[i] { return true; }
        if a[i] > b[i] { return false; }
    }
    false
}

/// Convert nBits compact format to 32-byte target (big-endian)
fn nbits_to_target(nbits: u32) -> Vec<u8> {
    let exp = (nbits >> 24) as usize;
    let mantissa = (nbits & 0x7fffff) as u64;
    let mut target = vec![0u8; 32];
    if exp == 0 || exp > 32 {
        return target;
    }
    // mantissa * 256^(exp-3)
    let byte_pos = 32 - exp;
    if byte_pos + 2 < 32 {
        target[byte_pos]     = ((mantissa >> 16) & 0xff) as u8;
        target[byte_pos + 1] = ((mantissa >> 8)  & 0xff) as u8;
        target[byte_pos + 2] = (mantissa         & 0xff) as u8;
    }
    target
}

/// Random starting nonce (using simple XOR-shift for no-std compatibility)
fn rand_nonce() -> u64 {
    // Use process ID + addr of stack variable as entropy seed
    let mut x: u64 = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as u64;
    x ^= std::process::id() as u64 * 0x9e3779b97f4a7c15;
    x ^= x >> 30;
    x *= 0xbf58476d1ce4e5b9;
    x ^= x >> 27;
    x *= 0x94d049bb133111eb;
    x ^ (x >> 31)
}
