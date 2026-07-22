mod cpu;
pub mod dual_stream;
pub mod external_pool;
pub mod gpu;
/// M1 Unified Agent — Apple Silicon GPU/CPU/NPU orchestrátor
#[cfg(target_os = "macos")]
pub mod m1_agent;
pub mod multichain;
pub mod native_algos;
pub mod python_fallback;
mod stats;
pub mod stream_aware;

use anyhow::{anyhow, Result};
use hex::FromHex;
use log::debug;
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tokio::sync::RwLock as AsyncRwLock;

use self::stats::MinerStats;
use crate::ncl::NCLClient;
use crate::stratum::StratumClient;
pub use native_algos::NativeAlgorithm;

// Local Algorithm enum - independent from zion_core
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Algorithm {
    CosmicHarmony,       // Pool-canonical ZION name; resolves through the current height-aware canonical dispatch.
    CosmicHarmonyV42,    // Historical explicit V4.2 alias kept only for compatibility/testing.
    CosmicHarmonyDeeksha, // Explicit Ekam Deeksha alias for the same canonical runtime.
    RandomX,
    VerusHash,
    Yescrypt,
    Blake3,
    Blake3Dcr, // Decred Blake3 (DCP-0011) — same hash as Blake3 but DCR-specific pool protocol
    Ethash,
    KawPow,
    Autolykos,
    KHeavyHash,
    Equihash,
    ProgPow,
    ProgPowEpic, // Epic Cash ProgPow variant
    Argon2d,
    Octopus, // Conflux (CFX) — SHA3-based DAG algorithm
}

impl Algorithm {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            // Historical CosmicHarmony aliases kept for config/pool compatibility.
            // Canonical hash source-of-truth lives in L1/cosmic-harmony Deeksha dispatch.
            "cosmic_harmony" | "cosmic_harmony_v4" | "chv4" | "ch4"
            | "cosmicharmony" | "cosmic-harmony" | "cosmic_harmony_v3"
            | "cosmic-harmony-v3" | "chv3" | "ch3" | "cosmic_harmony_v2" | "cosmicharmonyv2"
            | "cosmic-harmony-v2" | "cosmic-harmony_v2" => Some(Self::CosmicHarmony),
            // Historical explicit V4.2 override retained for compatibility.
            "cosmic_harmony_v4_2" | "chv4_2" | "ch4_2" | "chv4.2"
            | "cosmic_harmony_v42" | "ch42" | "merkabah" => Some(Self::CosmicHarmonyV42),
            // Explicit canonical aliases — same Ekam Deeksha runtime as the pool-canonical name.
            "deeksha" | "chv_deeksha" | "cosmic_harmony_deeksha" | "cosmic_deeksha"
            | "chdeeksha" | "deeksha_canonical"
            | "ekam" | "ekam_deeksha" | "cosmic_harmony_ekam" | "ch_ekam" | "che" => Some(Self::CosmicHarmonyDeeksha),
            "randomx" | "random-x" | "rx/0" => Some(Self::RandomX),
            "verushash" | "verushash2" | "verushash2.2" | "vrsc" => Some(Self::VerusHash),
            "yescrypt" => Some(Self::Yescrypt),
            "blake3" => Some(Self::Blake3),
            "blake3-dcr" | "blake3dcr" | "decred" | "dcr" => Some(Self::Blake3Dcr),
            "ethash" | "etchash" => Some(Self::Ethash),
            "kawpow" => Some(Self::KawPow),
            "autolykos" | "autolykos2" => Some(Self::Autolykos),
            "kheavyhash" | "heavyhash" => Some(Self::KHeavyHash),
            "equihash" => Some(Self::Equihash),
            "progpow" => Some(Self::ProgPow),
            "progpow-epic" | "progpow_epic" | "epicpow" => Some(Self::ProgPowEpic),
            "argon2d" => Some(Self::Argon2d),
            "octopus" | "cfx" | "conflux" => Some(Self::Octopus),
            _ => None,
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            // "cosmic_harmony" is the pool-canonical public name for the current ZION runtime.
            Self::CosmicHarmony => "cosmic_harmony",
            Self::CosmicHarmonyV42 => "cosmic_harmony_v4_2",
            Self::CosmicHarmonyDeeksha => "cosmic_harmony_deeksha",
            Self::RandomX => "randomx",
            Self::VerusHash => "verushash",
            Self::Yescrypt => "yescrypt",
            Self::Blake3 => "blake3",
            Self::Blake3Dcr => "blake3-dcr",
            Self::Ethash => "ethash",
            Self::KawPow => "kawpow",
            Self::Autolykos => "autolykos",
            Self::KHeavyHash => "kheavyhash",
            Self::Equihash => "equihash",
            Self::ProgPow => "progpow",
            Self::ProgPowEpic => "progpow-epic",
            Self::Argon2d => "argon2d",
            Self::Octopus => "octopus",
        }
    }

    pub fn is_zion_runtime(self) -> bool {
        matches!(
            self,
            Self::CosmicHarmony | Self::CosmicHarmonyV42 | Self::CosmicHarmonyDeeksha
        )
    }

    pub fn pool_name(&self) -> &'static str {
        if self.is_zion_runtime() {
            "cosmic_harmony"
        } else {
            self.name()
        }
    }

    pub fn to_native(self) -> NativeAlgorithm {
        match self {
            Self::CosmicHarmony => NativeAlgorithm::CosmicHarmony,
            Self::CosmicHarmonyV42 => NativeAlgorithm::CosmicHarmonyV42,
            Self::CosmicHarmonyDeeksha => NativeAlgorithm::CosmicHarmonyDeeksha,
            Self::RandomX => NativeAlgorithm::RandomX,
            Self::VerusHash => NativeAlgorithm::VerusHash,
            Self::Yescrypt => NativeAlgorithm::Yescrypt,
            Self::Blake3 => NativeAlgorithm::Blake3,
            Self::Blake3Dcr => NativeAlgorithm::Blake3Dcr,
            Self::Ethash => NativeAlgorithm::Ethash,
            Self::KawPow => NativeAlgorithm::KawPow,
            Self::Autolykos => NativeAlgorithm::Autolykos,
            Self::KHeavyHash => NativeAlgorithm::KHeavyHash,
            Self::Equihash => NativeAlgorithm::Equihash,
            Self::ProgPow => NativeAlgorithm::ProgPow,
            Self::ProgPowEpic => NativeAlgorithm::ProgPowEpic,
            Self::Argon2d => NativeAlgorithm::Argon2d,
            Self::Octopus => NativeAlgorithm::Octopus,
        }
    }
}

pub use gpu::detect_gpus;

/// Detect if the system has a usable GPU.
/// Checks: 1) ZION_HAS_GPU env var, 2) nvidia-smi, 3) rocm-smi, 4) Metal (macOS)
/// Returns true if any GPU is available for mining.
pub fn detect_gpu_available() -> bool {
    // 1. Manual override via environment variable
    if let Ok(val) = std::env::var("ZION_HAS_GPU") {
        let v = val.to_lowercase();
        if v == "1" || v == "true" || v == "yes" {
            debug!("🎮 GPU override: ZION_HAS_GPU={} → GPU mode", val);
            return true;
        } else if v == "0" || v == "false" || v == "no" {
            debug!("🎮 GPU override: ZION_HAS_GPU={} → CPU-only mode", val);
            return false;
        }
    }

    // 2. Try native GPU detection (Metal/CUDA/OpenCL)
    match detect_gpus() {
        Ok(gpus) if !gpus.is_empty() => {
            debug!("🎮 GPU detected via native probe: {} device(s)", gpus.len());
            for g in &gpus {
                debug!(
                    "   • {} ({:?}, {} CUs, {} MB)",
                    g.name, g.platform, g.compute_units, g.memory_mb
                );
            }
            return true;
        }
        _ => {}
    }

    // 3. Try nvidia-smi (headless Linux servers)
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .arg("--query-gpu=name")
        .arg("--format=csv,noheader")
        .output()
    {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout);
            let name = name.trim();
            if !name.is_empty() {
                debug!("🎮 NVIDIA GPU detected via nvidia-smi: {}", name);
                return true;
            }
        }
    }

    // 4. Try rocm-smi (AMD GPUs on Linux)
    if let Ok(output) = std::process::Command::new("rocm-smi")
        .arg("--showproductname")
        .output()
    {
        if output.status.success() {
            let out = String::from_utf8_lossy(&output.stdout);
            if out.contains("GPU") || out.contains("Radeon") || out.contains("Instinct") {
                debug!("🎮 AMD GPU detected via rocm-smi");
                return true;
            }
        }
    }

    debug!("🖥️ No GPU detected → CPU-only mode (Revenue 25% locked to XMR/RandomX)");
    false
}

#[derive(Debug, Clone)]
pub struct MinerConfig {
    pub pool_url: String,
    pub wallet_address: String,
    pub worker_name: String,
    pub algorithm: Algorithm,
    pub difficulty: Option<u64>,
    /// Optional pool-side scheduler hint (zion|revenue|ncl|dual). Encoded as `g=`.
    pub group_hint: Option<String>,
    pub cpu_threads: usize,
    pub gpu_enabled: bool,
    pub gpu_devices: Vec<usize>,
    pub stats_file: Option<PathBuf>,
    pub stats_interval_secs: u64,
    /// Dual-stream secondary mining config (LolMiner --dualmode style).
    /// When set, a second stratum connection is opened to an external pool
    /// and GPU idle cycles are used to mine the secondary coin.
    pub dual_stream: Option<dual_stream::DualStreamConfig>,
    /// Triple-stream tertiary mining config (LolMiner-style triple mining).
    /// When set, a third stratum connection is opened to a third external pool.
    /// Requires --dualmode to also be set for the secondary coin.
    pub trinity: Option<dual_stream::DualStreamConfig>,
}

pub struct UniversalMiner {
    config: MinerConfig,
    stats: Arc<AsyncRwLock<MinerStats>>,
    running: Arc<AsyncRwLock<bool>>,
    ncl_client: Option<Arc<NCLClient>>,
    /// CPU-only mode: no GPU available, Revenue stream locked to XMR/RandomX
    cpu_only_mode: bool,
}

impl UniversalMiner {
    pub fn new(config: MinerConfig) -> Result<Self> {
        let cpu_only = !config.gpu_enabled && !detect_gpu_available();
        if cpu_only {
            log::debug!("CPU-ONLY MODE — No GPU detected");
        }
        Ok(Self {
            config,
            stats: Arc::new(AsyncRwLock::new(MinerStats::new())),
            running: Arc::new(AsyncRwLock::new(false)),
            ncl_client: None,
            cpu_only_mode: cpu_only,
        })
    }

    pub fn new_with_ncl(config: MinerConfig, ncl_client: Option<Arc<NCLClient>>) -> Result<Self> {
        let cpu_only = !config.gpu_enabled && !detect_gpu_available();
        if cpu_only {
            log::debug!("CPU-ONLY MODE — No GPU detected");
        }
        Ok(Self {
            config,
            stats: Arc::new(AsyncRwLock::new(MinerStats::new())),
            running: Arc::new(AsyncRwLock::new(false)),
            ncl_client,
            cpu_only_mode: cpu_only,
        })
    }

    /// Returns true if miner is in CPU-only mode (no GPU detected)
    pub fn is_cpu_only(&self) -> bool {
        self.cpu_only_mode
    }

    pub async fn start(&self) -> Result<()> {
        *self.running.write().await = true;

        // Inject config metadata into stats engine for XMRig-style display
        {
            let mut stats = self.stats.write().await;
            stats.set_config(
                self.config.algorithm.name(),
                &self.config.worker_name,
                &self.config.pool_url,
                self.config.cpu_threads,
            );
        }

        log::debug!("net use pool → {}", self.config.pool_url);
        log::debug!(
            "cpu {} threads {} algo",
            self.config.cpu_threads,
            self.config.algorithm.name()
        );

        // Create stratum client (reused across reconnections)
        log::debug!("Creating stratum client for pool: {}", self.config.pool_url);
        let stratum = StratumClient::new(
            &self.config.pool_url,
            &self.config.wallet_address,
            &self.config.worker_name,
            self.config.algorithm.pool_name(),
            self.config.difficulty,
            self.config.group_hint.as_deref(),
        )?;

        // ═══════════════════════════════════════════════════════
        // RECONNECT LOOP — survives pool restarts, network drops
        // ═══════════════════════════════════════════════════════
        let mut reconnect_count: u32 = 0;
        loop {
            if reconnect_count > 0 {
                log::debug!("reconnect #{}", reconnect_count);
                let mut stats = self.stats.write().await;
                stats.increment_connections();
            }

            // Connect (with retry on first connect, direct reconnect after)
            if reconnect_count == 0 {
                stratum.connect_with_retry(5).await?;
            } else {
                stratum.reconnect().await?;
            }
            log::debug!("net connected");

            if reconnect_count == 0 {
                if let Err(e) = self.init_ncl(&stratum).await {
                    log::debug!("NCL init failed: {}", e);
                }
                self.spawn_ncl_loop(stratum.clone()).await;
            }

            // Subscribe to jobs and wait for initial job
            let job_state: Arc<RwLock<Option<crate::stratum::Job>>> = Arc::new(RwLock::new(None));

            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            let mut job_rx = stratum.subscribe_jobs().await;

            // Check if job is already available (from login response)
            {
                let current = job_rx.borrow_and_update();
                log::debug!("Job state after subscribe: {:?}", current.is_some());
                if let Some(ref j) = *current {
                    log::warn!(
                        "✅ Initial job: id={} height={} target={:.8}… algo={:?}",
                        j.job_id,
                        j.height,
                        j.target,
                        j.algo,
                    );
                    if let Ok(mut state) = job_state.write() {
                        *state = Some(j.clone());
                    }
                    // Update stats with initial job (borrow_and_update consumes the
                    // changed event so the stats watcher below never fires for it).
                    let target_str = j.target.trim();
                    let algo_str = j.algo.as_deref().unwrap_or("").to_lowercase();
                    let is_cosmic = algo_str.contains("cosmic");
                    if let Ok(mut stats) = self.stats.try_write() {
                        stats.set_pool_height(j.height);
                        if !target_str.is_empty() {
                            let display_diff: u64 = if target_str.len() <= 8 || is_cosmic {
                                let t8 = &target_str[..target_str.len().min(8)];
                                u32::from_str_radix(t8, 16).ok().filter(|&t| t > 0)
                                    .map(|t| 0xFFFF_FFFFu64 / t as u64).unwrap_or(0)
                            } else {
                                u64::from_str_radix(&target_str[target_str.len().saturating_sub(16)..], 16)
                                    .ok().filter(|&t| t > 0).map(|t| u64::MAX / t).unwrap_or(0)
                            };
                            if display_diff > 0 {
                                stats.set_difficulty(display_diff as f64);
                            }
                        }
                    }
                }
            }

            // If no job yet, wait for one
            if job_state.read().unwrap().is_none() {
                log::debug!("Waiting for initial job...");
                match tokio::time::timeout(tokio::time::Duration::from_secs(5), job_rx.changed())
                    .await
                {
                    Ok(Ok(())) => {
                        let job = job_rx.borrow().clone();
                        if let Some(ref j) = job {
                            log::warn!(
                                "✅ Initial job (waited): id={} height={} target={:.8}… algo={:?}",
                                j.job_id,
                                j.height,
                                j.target,
                                j.algo,
                            );
                            if let Ok(mut state) = job_state.write() {
                                *state = Some(j.clone());
                            }
                            // Update stats for initial job received via wait.
                            let target_str = j.target.trim();
                            let algo_str = j.algo.as_deref().unwrap_or("").to_lowercase();
                            let is_cosmic = algo_str.contains("cosmic");
                            if let Ok(mut stats) = self.stats.try_write() {
                                stats.set_pool_height(j.height);
                                if !target_str.is_empty() {
                                    let display_diff: u64 = if target_str.len() <= 8 || is_cosmic {
                                        let t8 = &target_str[..target_str.len().min(8)];
                                        u32::from_str_radix(t8, 16).ok().filter(|&t| t > 0)
                                            .map(|t| 0xFFFF_FFFFu64 / t as u64).unwrap_or(0)
                                    } else {
                                        u64::from_str_radix(&target_str[target_str.len().saturating_sub(16)..], 16)
                                            .ok().filter(|&t| t > 0).map(|t| u64::MAX / t).unwrap_or(0)
                                    };
                                    if display_diff > 0 {
                                        stats.set_difficulty(display_diff as f64);
                                    }
                                }
                            }
                        }
                    }
                    Ok(Err(_)) => {
                        log::debug!("Job channel closed");
                    }
                    Err(_) => {
                        log::debug!("Timeout waiting for initial job, requesting explicitly...");
                        let _ = stratum.request_job().await;
                    }
                }
            }

            // Job update task (monitors connection too)
            let connection_lost = Arc::new(std::sync::atomic::AtomicBool::new(false));
            {
                let job_state = Arc::clone(&job_state);
                let lost = connection_lost.clone();
                let stats_job = Arc::clone(&self.stats);
                tokio::spawn(async move {
                    loop {
                        if job_rx.changed().await.is_err() {
                            lost.store(true, std::sync::atomic::Ordering::Relaxed);
                            break;
                        }
                        let job = job_rx.borrow().clone();
                        if let Some(ref j) = job {
                            // XMRig-style new job notification (printed by stats)
                            let mut stats = stats_job.write().await;
                            stats.set_pool_height(j.height);
                            // Derive display difficulty from target hex (for stats DIFF line).
                            // cosmic_harmony: target is 8-char hex u32 OR 64-char hex 256-bit big-endian.
                            //   For 64-char, first 8 hex chars = the u32 state0 comparison target.
                            //   diff = 0xFFFFFFFF / target_u32
                            // randomx: 16-char hex u64 target.  diff = 0xFFFFFFFFFFFFFFFF / target.
                            // If target absent / parse fails, leave existing difficulty unchanged.
                            let target_str = j.target.trim();
                            let algo_str = j.algo.as_deref().unwrap_or("").to_lowercase();
                            let is_cosmic = algo_str.contains("cosmic");
                            if !target_str.is_empty() {
                                let display_diff: u64 = if target_str.len() <= 8 || is_cosmic {
                                    // Cosmic harmony (8 or 64 char): first 8 chars = u32 target
                                    let t8 = &target_str[..target_str.len().min(8)];
                                    u32::from_str_radix(t8, 16)
                                        .ok()
                                        .filter(|&t| t > 0)
                                        .map(|t| 0xFFFF_FFFFu64 / t as u64)
                                        .unwrap_or(0)
                                } else {
                                    // RandomX/Blake3: last 16 chars = u64 target
                                    u64::from_str_radix(&target_str[target_str.len().saturating_sub(16)..], 16)
                                        .ok()
                                        .filter(|&t| t > 0)
                                        .map(|t| u64::MAX / t)
                                        .unwrap_or(0)
                                };
                                if display_diff > 0 {
                                    stats.set_difficulty(display_diff as f64);
                                }
                            }
                            stats.print_new_job();
                        }
                        if let Ok(mut state) = job_state.write() {
                            *state = job;
                        }
                    }
                });
            }

            // Poll getjob only for XMRig protocol *and* only for our internal pool.
            // External RandomX pools (e.g. MoneroOcean) already push `job` notifications.
            // Sending `getjob` can cause disconnects / rate limits / temporary IP suspensions.
            let poll_getjob = self.config.pool_url.starts_with("pool:")
                || self.config.pool_url.starts_with("localhost:")
                || self.config.pool_url.starts_with("127.0.0.1:");
            if poll_getjob {
                let stratum_poll = stratum.clone();
                tokio::spawn(async move {
                    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
                    loop {
                        interval.tick().await;
                        if !stratum_poll.is_connected() {
                            break;
                        }
                        if stratum_poll.is_xmrig().await {
                            let _ = stratum_poll.request_job().await;
                        }
                    }
                });
            } else {
                log::debug!(
                    "getjob polling disabled for external pool: {}",
                    self.config.pool_url
                );
            }

            // Start CPU mining threads
            let mut cpu_alive_flag: Option<Arc<std::sync::atomic::AtomicBool>> = None;
            if self.config.cpu_threads > 0 {
                log::debug!("cpu {} threads ready", self.config.cpu_threads);
                cpu_alive_flag = Some(self.start_cpu_mining(&stratum, job_state.clone()).await?);
            }

            // Start GPU mining (if enabled)
            let mut gpu_alive_flag: Option<Arc<std::sync::atomic::AtomicBool>> = None;
            if self.config.gpu_enabled {
                gpu_alive_flag = self.start_gpu_mining(&stratum, job_state.clone()).await?;
            }

            // ═══════════════════════════════════════════════════
            // CONNECTION MONITOR — detects disconnect, triggers reconnect
            // Also prints stats periodically
            // ═══════════════════════════════════════════════════
            log::debug!("Connection monitor active");
            let stats_interval = self.config.stats_interval_secs.max(1);
            let mut stats_ticks = 0u64;
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                stats_ticks += 3;

                // Print stats every stats_interval seconds
                if stats_ticks >= stats_interval {
                    stats_ticks = 0;
                    let mut stats = self.stats.write().await;
                    stats.print();
                    if let Some(ref path) = self.config.stats_file {
                        let payload = stats.to_json();

                        if let Some(parent) = path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }

                        let tmp = path.with_extension("tmp");
                        if std::fs::write(&tmp, payload.to_string()).is_ok() {
                            let _ = std::fs::remove_file(path);
                            let _ = std::fs::rename(&tmp, path);
                        }
                    }
                }

                // Bug fix: also detect when submit loop died (cpu/gpu alive flag went false)
                // Previously only stratum disconnect was detected, causing 7h+ dead mining
                let cpu_submit_dead = cpu_alive_flag
                    .as_ref()
                    .map(|f| !f.load(std::sync::atomic::Ordering::Relaxed))
                    .unwrap_or(false);
                let gpu_submit_dead = gpu_alive_flag
                    .as_ref()
                    .map(|f| !f.load(std::sync::atomic::Ordering::Relaxed))
                    .unwrap_or(false);

                if !stratum.is_connected()
                    || connection_lost.load(std::sync::atomic::Ordering::Relaxed)
                    || cpu_submit_dead
                    || gpu_submit_dead
                {
                    if cpu_submit_dead || gpu_submit_dead {
                        log::debug!(
                            "submit loop died — reconnecting (cpu={}, gpu={})",
                            cpu_submit_dead,
                            gpu_submit_dead
                        );
                    } else {
                        log::debug!("pool connection lost");
                    }
                    if let Ok(mut st) = self.stats.try_write() {
                        st.set_event("connection lost — reconnecting...".to_string());
                    }
                    // Signal CPU miner to stop
                    if let Some(ref flag) = cpu_alive_flag {
                        flag.store(false, std::sync::atomic::Ordering::Relaxed);
                    }
                    // Signal GPU miner to stop
                    if let Some(ref flag) = gpu_alive_flag {
                        flag.store(false, std::sync::atomic::Ordering::Relaxed);
                    }
                    break;
                }
            }

            // Connection lost — clean up and reconnect
            reconnect_count += 1;
            let backoff = std::cmp::min(reconnect_count as u64 * 2, 30);
            log::debug!("reconnecting in {}s #{}", backoff, reconnect_count);
            if let Ok(mut st) = self.stats.try_write() {
                st.set_event(format!("reconnecting in {}s #{}", backoff, reconnect_count));
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(backoff)).await;

            // Reset stats for fresh session
            if let Ok(mut stats) = self.stats.try_write() {
                stats.reset_shares();
            }
        } // end reconnect loop
    }

    async fn spawn_ncl_loop(&self, stratum: StratumClient) {
        let Some(ncl) = self.ncl_client.clone() else {
            return;
        };

        let running = Arc::clone(&self.running);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(
                ncl.min_task_interval_ms(),
            ));
            let mut status_tick: u64 = 0;

            loop {
                interval.tick().await;

                if !*running.read().await {
                    break;
                }

                // Fetch a task
                let get_id = stratum.next_request_id();
                let resp = match stratum
                    .send_custom_value(ncl.build_get_task_message(get_id))
                    .await
                {
                    Ok(r) => r,
                    Err(e) => {
                        debug!("⚠️  NCL get_task failed: {}", e);
                        continue;
                    }
                };

                let Some(result) = resp.result else {
                    continue;
                };
                let Some(task) = result.get("task") else {
                    continue;
                };

                let task_id = task
                    .get("task_id")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if task_id.is_empty() {
                    continue;
                }

                let task_type = task.get("task_type").and_then(Value::as_str).unwrap_or("");
                if task_type != "hash_chaining_v1" {
                    continue;
                }

                let seed_hex = match task
                    .get("verification")
                    .and_then(|v| v.get("seed"))
                    .and_then(Value::as_str)
                {
                    Some(s) => s,
                    None => continue,
                };

                let rounds = task
                    .get("payload")
                    .and_then(|v| v.get("rounds"))
                    .and_then(Value::as_u64)
                    .unwrap_or(0);
                if rounds == 0 || rounds > (u32::MAX as u64) {
                    continue;
                }

                let result_hex = match ncl.compute_blake3_chain(seed_hex, rounds as u32).await {
                    Ok(v) => v,
                    Err(e) => {
                        debug!("⚠️  NCL compute failed: {}", e);
                        continue;
                    }
                };

                let submit_id = stratum.next_request_id();
                let submit_resp = match stratum
                    .send_custom_value(ncl.build_submit_hash_chain_message(
                        submit_id,
                        &task_id,
                        &result_hex,
                    ))
                    .await
                {
                    Ok(r) => r,
                    Err(e) => {
                        debug!("⚠️  NCL submit failed: {}", e);
                        continue;
                    }
                };

                let accepted = submit_resp
                    .result
                    .as_ref()
                    .and_then(|v| v.get("accepted"))
                    .and_then(Value::as_bool)
                    .unwrap_or(false);

                if accepted {
                    debug!("✅ NCL task accepted: {}", task_id);
                } else {
                    debug!("❌ NCL task rejected: {}", task_id);
                }

                // Occasionally fetch status snapshot for visibility.
                status_tick = status_tick.wrapping_add(1);
                if status_tick % 30 == 0 {
                    let status_id = stratum.next_request_id();
                    if let Ok(status_resp) = stratum
                        .send_custom_value(ncl.build_status_message(status_id))
                        .await
                    {
                        if let Some(ncl_status) =
                            status_resp.result.as_ref().and_then(|v| v.get("ncl"))
                        {
                            debug!("📊 NCL status: {}", ncl_status);
                        }
                    }
                }
            }
        });
    }

    async fn init_ncl(&self, stratum: &StratumClient) -> Result<()> {
        let Some(ncl) = &self.ncl_client else {
            return Ok(());
        };

        if let Some(session_id) = stratum.get_session_id().await {
            ncl.set_session_id(session_id).await;
        }

        let id = stratum.next_request_id();
        let _ = stratum
            .send_custom_value(ncl.build_register_message(id))
            .await?;
        ncl.set_registered(true).await;

        Ok(())
    }

    async fn start_cpu_mining(
        &self,
        stratum: &StratumClient,
        job_state: Arc<RwLock<Option<crate::stratum::Job>>>,
    ) -> Result<Arc<std::sync::atomic::AtomicBool>> {
        let cpu_miner = cpu::CpuMiner::new(
            self.config.algorithm,
            self.config.cpu_threads,
            Arc::clone(&self.stats),
            job_state,
            Arc::new(stratum.clone()),
        );

        let alive_flag = cpu_miner.connection_alive_flag();
        cpu_miner.start().await?;

        Ok(alive_flag)
    }

    async fn start_gpu_mining(
        &self,
        stratum: &StratumClient,
        job_state: Arc<RwLock<Option<crate::stratum::Job>>>,
    ) -> Result<Option<Arc<std::sync::atomic::AtomicBool>>> {
        // GPU mining: primary CHv3 (Metal/OpenCL/CUDA), stream-aware for algo switching
        let devices = gpu::detect_gpus()?;
        if devices.is_empty() {
            debug!("No GPU devices found. Build with --features metal (macOS) or --features gpu (OpenCL).");
            return Ok(None);
        }

        let selected: Vec<_> = if self.config.gpu_devices.is_empty() {
            devices
        } else {
            devices
                .into_iter()
                .filter(|d| self.config.gpu_devices.contains(&d.id))
                .collect()
        };

        if selected.is_empty() {
            debug!("No matching GPU devices selected.");
            return Ok(None);
        }

        let gpu_alive_flag = Arc::new(std::sync::atomic::AtomicBool::new(true));

        for device in selected {
            let miner = gpu::create_miner(&device)?;

            let stats = Arc::clone(&self.stats);
            let job_state = Arc::clone(&job_state);
            let stratum = Arc::new(stratum.clone());
            let initial_algo = self.config.algorithm;
            let device_name = device.name.clone();
            let device_platform = device.platform;

            let gpu_alive = Arc::clone(&gpu_alive_flag);

            tokio::task::spawn_blocking(move || {
                let mut miner = miner;
                if let Err(e) = miner.init() {
                    log::error!("GPU init failed on {} [{:?}]: {}", device_name, device_platform, e);
                    if let Ok(mut st) = stats.try_write() {
                        st.set_event(format!("gpu-init-failed {}", device_name));
                    }
                    return;
                }

                if let Ok(mut st) = stats.try_write() {
                    st.set_gpu_name(&device_name);
                }

                Self::gpu_mining_loop(
                    miner,
                    initial_algo,
                    device_name,
                    device_platform,
                    stats,
                    job_state,
                    stratum,
                    gpu_alive,
                );
            });
        }

        Ok(Some(gpu_alive_flag))
    }

    /// GPU mining loop — stream-aware, dynamically switches algorithms
    ///
    /// When pool StreamScheduler v2 assigns this miner to Revenue group,
    /// the job's `algo` field changes. GPU loop responds:
    /// - CosmicHarmony → use GPU mine_batch() (Metal/CUDA/OpenCL shader)
    /// - Ethash/Autolykos/KawPow → use GPU if supported, else CPU fallback  
    /// - RandomX/Yescrypt → CPU-only fallback (GPU can't mine these)
    fn gpu_mining_loop(
        mut miner: Box<dyn gpu::GpuMiner>,
        initial_algo: Algorithm,
        device_name: String,
        device_platform: gpu::GpuPlatform,
        stats: Arc<AsyncRwLock<MinerStats>>,
        job_state: Arc<RwLock<Option<crate::stratum::Job>>>,
        stratum: Arc<StratumClient>,
        connection_alive: Arc<std::sync::atomic::AtomicBool>,
    ) {
        let stream_switch_enabled = std::env::var("ZION_ENABLE_STREAM_SWITCH")
            .map(|v| {
                let v = v.trim().to_ascii_lowercase();
                v == "1" || v == "true" || v == "yes"
            })
            .unwrap_or(false);

        let session_nonce_base = std::env::var("ZION_NONCE_BASE")
            .ok()
            .and_then(|v| v.trim().parse::<u64>().ok())
            .map(|v| v & (u32::MAX as u64))
            .unwrap_or(0);
        let device_nonce_salt = {
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            device_name.hash(&mut hasher);
            (hasher.finish() as u32) as u64
        };
        let nonce_seed = ((session_nonce_base as u32).wrapping_add(device_nonce_salt as u32)) as u64;
        let mut nonce_start = nonce_seed;
        // GPU batch size: per-device auto tuning by backend + VRAM.
        // Can be overridden globally via ZION_GPU_BATCH_SIZE.
        let device_info = miner.device_info().clone();
        let mut batch_size: u64 = std::env::var("ZION_GPU_BATCH_SIZE")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .filter(|v: &u64| *v >= 100_000)
            .unwrap_or_else(|| {
                let vram = device_info.memory_mb;
                match device_platform {
                    gpu::GpuPlatform::Cuda => {
                        if vram >= 20_000 {
                            24_000_000
                        } else if vram >= 12_000 {
                            20_000_000
                        } else if vram >= 8_000 {
                            16_000_000
                        } else if vram >= 6_000 {
                            12_000_000
                        } else {
                            8_000_000
                        }
                    }
                    gpu::GpuPlatform::Metal => {
                        if vram >= 12_000 {
                            8_000_000
                        } else if vram >= 8_000 {
                            6_000_000
                        } else {
                            4_000_000
                        }
                    }
                    gpu::GpuPlatform::OpenCL => {
                        if vram >= 16_000 {
                            12_000_000
                        } else if vram >= 8_000 {
                            8_000_000
                        } else if vram >= 6_000 {
                            6_000_000
                        } else {
                            4_000_000
                        }
                    }
                }
            })
            .clamp(100_000, 32_000_000);

        // For backends with a fixed chip dispatch size (e.g. Metal ~2184 threads),
        // override batch_size so each mine_batch call = exactly ONE GPU kernel dispatch.
        // This keeps job-switching latency to ~one dispatch duration (seconds, not hours).
        if let Some(chip_batch) = miner.natural_batch_size() {
            batch_size = chip_batch;
            log::debug!(
                "GPU [{:?}]: using natural_batch_size {} (chip dispatch granularity)",
                device_platform,
                chip_batch
            );
        }

        let mut last_job_id: Option<String> = None;
        let mut nonce_bookmarks: HashMap<String, u32> = HashMap::new();
        let mut submit_dedup_seen: HashSet<u64> = HashSet::new();
        let mut submit_dedup_order: VecDeque<u64> = VecDeque::new();
        const SUBMIT_DEDUP_MAX: usize = 300_000;
        let mut gpu_total_hashes: u64 = 0;
        let gpu_start_time = std::time::Instant::now();
        let mut gpu_shares_found: u64 = 0;
        let mut batch_count: u64 = 0;
        let mut active_algo = initial_algo;
        let gpu_verify_enabled = std::env::var("ZION_GPU_VERIFY")
            .map(|v| {
                let value = v.trim().to_ascii_lowercase();
                value == "1" || value == "true" || value == "yes"
            })
            .unwrap_or(false);

        log::debug!(
            "GPU mining loop: {} [{:?}] batch={} vram={}MB",
            device_name,
            device_platform,
            batch_size,
            device_info.memory_mb
        );

        loop {
            let job = {
                let guard = job_state.read().unwrap();
                guard.clone()
            };

            let job = match job {
                Some(j) => j,
                None => {
                    std::thread::sleep(std::time::Duration::from_millis(250));
                    continue;
                }
            };

            if last_job_id.as_deref() != Some(job.job_id.as_str()) {
                if let Some(old_id) = last_job_id.take() {
                    nonce_bookmarks.insert(old_id, nonce_start as u32);
                }

                let mut hasher = std::collections::hash_map::DefaultHasher::new();
                job.job_id.hash(&mut hasher);
                job.height.hash(&mut hasher);
                let job_nonce_seed = ((hasher.finish() as u32)
                    .wrapping_add(session_nonce_base as u32)
                    .wrapping_add(device_nonce_salt as u32)) as u64;

                nonce_start = nonce_bookmarks
                    .get(job.job_id.as_str())
                    .copied()
                    .map(|v| v as u64)
                    .unwrap_or(job_nonce_seed);
                last_job_id = Some(job.job_id.clone());

                // ═══ Stream Scheduler v2: Dynamic algorithm detection (opt-in) ═══
                // Desktop default: pin configured algorithm (CHv3) for stable hashrate.
                // Set ZION_ENABLE_STREAM_SWITCH=1 to allow runtime algo switches.
                if stream_switch_enabled {
                    let job_algo = job
                        .algo
                        .as_deref()
                        .and_then(Algorithm::from_str)
                        .unwrap_or(initial_algo);

                    if job_algo != active_algo {
                        let coin = job.coin.as_deref().unwrap_or("unknown");
                        log::debug!(
                            "gpu:switch {} → {} coin={}",
                            active_algo.name(),
                            job_algo.name(),
                            coin
                        );
                        if let Ok(mut st) = stats.try_write() {
                            st.set_event(format!(
                                "gpu:switch {} → {}",
                                active_algo.name(),
                                job_algo.name()
                            ));
                        }
                        active_algo = job_algo;

                        // Adjust batch size for the new algorithm.
                        // If this backend has a fixed chip dispatch size, keep using it
                        // across algo switches so responsiveness stays consistent.
                        batch_size = miner.natural_batch_size().unwrap_or(match active_algo {
                            Algorithm::CosmicHarmony
                            | Algorithm::CosmicHarmonyV42
                            | Algorithm::CosmicHarmonyDeeksha => 14_000_000,
                            Algorithm::Ethash | Algorithm::Autolykos | Algorithm::KawPow => 100_000,
                            Algorithm::RandomX | Algorithm::Yescrypt => 5_000,
                            _ => 250_000,
                        });
                    }
                }

                log::debug!(
                    "GPU: New job height={}, algo={}, target={}",
                    job.height,
                    active_algo.name(),
                    job.target
                );
            }

            let blob_bytes = match Vec::from_hex(job.blob.trim_start_matches("0x")) {
                Ok(b) => b,
                Err(e) => {
                    log::debug!("🎮 GPU: Failed to parse blob: {}", e);
                    std::thread::sleep(std::time::Duration::from_millis(250));
                    continue;
                }
            };

            let target_bytes = match parse_target_bytes(&job.target) {
                Ok(t) => t,
                Err(e) => {
                    log::debug!("🎮 GPU: Failed to parse target: {}", e);
                    std::thread::sleep(std::time::Duration::from_millis(250));
                    continue;
                }
            };

            // ═══ Algorithm dispatch: GPU shader vs CPU fallback ═══
            // NOTE: CosmicHarmony Ekam Deeksha is consensus-critical from height 0.
            // GPU kernels (OpenCL/CUDA) implement the full Ekam Deeksha pipeline.
            let _batch_start = std::time::Instant::now();
            let use_gpu_path = Self::is_gpu_mineable(active_algo, device_platform, job.height as u32);
            let attempted_batch_size = if use_gpu_path {
                batch_size
            } else {
                // CPU fallback must stay responsive on GPU thread.
                // Keep small chunks to avoid long stalls and stale submissions.
                batch_size.min(100)
            };

            let processed_batch_size = if use_gpu_path {
                miner.effective_batch_size(attempted_batch_size, job.height)
            } else {
                attempted_batch_size
            };

            let result = if use_gpu_path {
                // Use GPU shader (fast path). For CosmicHarmony, the kernel handles both
                // legacy (height < 100k) and memory-hard scratchpad (height >= 100k).
                miner.mine_batch(&blob_bytes, &target_bytes, nonce_start, attempted_batch_size, job.height)
            } else {
                // CPU fallback for algos GPU can't mine (RandomX, Yescrypt, etc.)
                Self::cpu_fallback_batch(
                    active_algo,
                    &blob_bytes,
                    &job.target,
                    job.cosmic_state0_endian.as_deref(),
                    nonce_start,
                    attempted_batch_size,
                    job.height as u32,
                )
            };

            gpu_total_hashes += processed_batch_size;
            batch_count += 1;

            // Report GPU hashrate every 10 batches (debug only)
            if batch_count % 10 == 0 {
                let elapsed = gpu_start_time.elapsed().as_secs_f64();
                let gpu_hashrate = gpu_total_hashes as f64 / elapsed;
                log::debug!(
                    "GPU: {} {:.2} kH/s {} shares algo {}",
                    device_name,
                    gpu_hashrate / 1_000.0,
                    gpu_shares_found,
                    active_algo.name()
                );
            }

            // Update shared stats with GPU hashes
            if let Ok(mut stats) = stats.try_write() {
                stats.add_gpu_hashes(processed_batch_size);
            }

            match result {
                Ok(Some((nonce, hash))) => {
                    gpu_shares_found += 1;
                    let result_hex = hex::encode(hash);
                    let job_id = job.job_id.clone();

                    // If job switched while we were hashing this batch, drop stale share.
                    let current_job_id = {
                        let guard = job_state.read().unwrap();
                        guard.as_ref().map(|j| j.job_id.clone())
                    };
                    if current_job_id.as_deref() != Some(job_id.as_str()) {
                        log::debug!(
                            "GPU stale share dropped: solved_job={} current_job={}",
                            job_id,
                            current_job_id.unwrap_or_default()
                        );
                        continue;
                    }

                    // ═══ GPU→CPU verification: re-hash on CPU and compare (debug opt-in) ═══
                    if gpu_verify_enabled {
                        let cpu_hash = match native_algos::compute_hash(
                            active_algo.to_native(),
                            &blob_bytes,
                            nonce,
                            job.height as u32,
                        ) {
                            Ok(hash) => hash,
                            Err(error) => {
                                log::error!(
                                    "GPU verify CPU re-hash failed for algo {}: {}",
                                    active_algo.name(),
                                    error
                                );
                                continue;
                            }
                        };
                        let cpu_hex = hex::encode(&cpu_hash);
                        let gpu_state0 = u32::from_le_bytes([
                            hash[0], hash[1], hash[2], hash[3],
                        ]);
                        let cpu_state0 = u32::from_le_bytes([
                            cpu_hash[0], cpu_hash[1], cpu_hash[2], cpu_hash[3],
                        ]);
                        // Parse target for comparison (first 4 bytes = pool's target_int)
                        let target_val = u32::from_be_bytes([
                            target_bytes[0], target_bytes[1],
                            target_bytes[2], target_bytes[3],
                        ]);
                        let hash_match = result_hex == cpu_hex;
                        let cpu_meets_target = cpu_state0 <= target_val;
                        let nonce_u32 = nonce as u32;
                        let nonce_overflow = nonce > u32::MAX as u64;
                        log::warn!(
                            "🔬 GPU→CPU VERIFY:\n  nonce_u64={} nonce_as_u32={} overflow={}\n  gpu_hash={}\n  cpu_hash={}\n  MATCH={}\n  gpu_state0={:#010x} cpu_state0={:#010x} target={:#010x}\n  cpu_meets_target={} blob_len={} height={}",
                            nonce, nonce_u32, nonce_overflow,
                            result_hex, cpu_hex, hash_match,
                            gpu_state0, cpu_state0, target_val,
                            cpu_meets_target, blob_bytes.len(), job.height,
                        );
                        if !hash_match {
                            // Log first bytes of blob for debugging
                            let blob_preview = hex::encode(&blob_bytes[..blob_bytes.len().min(20)]);
                            log::error!(
                                "❌ GPU≠CPU HASH MISMATCH! blob_first20={} target_hex={}",
                                blob_preview, job.target,
                            );
                        }
                        if nonce_overflow {
                            log::error!(
                                "❌ NONCE OVERFLOW! GPU nonce {} > u32::MAX — SKIPPING submission",
                                nonce,
                            );
                        }
                    }

                    // Skip submission if nonce overflows u32 (pool expects u32 nonce)
                    if nonce > u32::MAX as u64 {
                        log::warn!("Skipping GPU share: nonce {} > u32::MAX", nonce);
                        // Don't submit — pool would get wrong nonce
                    } else {
                    let nonce_u32 = nonce as u32;
                    let dedup_key = {
                        let mut hasher = std::collections::hash_map::DefaultHasher::new();
                        job_id.hash(&mut hasher);
                        ((hasher.finish() as u32) as u64) << 32 | (nonce_u32 as u64)
                    };
                    if submit_dedup_seen.contains(&dedup_key) {
                        log::debug!(
                            "GPU dedup skip: job={} nonce={:08x}",
                            job_id,
                            nonce_u32
                        );
                        continue;
                    }
                    submit_dedup_seen.insert(dedup_key);
                    submit_dedup_order.push_back(dedup_key);
                    while submit_dedup_order.len() > SUBMIT_DEDUP_MAX {
                        if let Some(old_key) = submit_dedup_order.pop_front() {
                            submit_dedup_seen.remove(&old_key);
                        }
                    }

                    log::debug!(
                        "GPU SHARE algo {} nonce {} hash {}...{}",
                        active_algo.name(),
                        nonce,
                        &result_hex[..8],
                        &result_hex[56..]
                    );

                    // Submit share ASYNC — don't block GPU thread!
                    let submit_stratum = Arc::clone(&stratum);
                    let submit_stats = Arc::clone(&stats);
                    let submit_job_state = Arc::clone(&job_state);
                    let submit_job_id = job_id.clone();
                    tokio::runtime::Handle::current().spawn(async move {
                        let current_job_id = {
                            let guard = submit_job_state.read().unwrap();
                            guard.as_ref().map(|j| j.job_id.clone())
                        };
                        if current_job_id.as_deref() != Some(submit_job_id.as_str()) {
                            log::debug!(
                                "GPU async stale submit dropped: solved_job={} current_job={}",
                                submit_job_id,
                                current_job_id.unwrap_or_default()
                            );
                            return;
                        }

                        match submit_stratum
                            .submit_share(&job_id, nonce as u32, &result_hex)
                            .await
                        {
                            Ok(accepted) => {
                                if let Ok(mut stats) = submit_stats.try_write() {
                                    if accepted {
                                        stats.share_accepted();
                                        stats.print_accepted();
                                    } else {
                                        stats.share_rejected();
                                        stats.print_rejected("GPU share rejected");
                                    }
                                }
                            }
                            Err(e) => {
                                log::debug!("GPU submit error: {}", e);
                            }
                        }
                    });

                    } // end else (nonce not overflowed)
                }
                Ok(None) => {
                    // No solution in this batch — normal, continue
                }
                Err(e) => {
                    log::error!(
                        "🎮 GPU mine_batch error (algo={}): {}",
                        active_algo.name(),
                        e
                    );
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                }
            }

            // Advance nonce, wrap to 0 if it would exceed u32 range
            let next = nonce_start.wrapping_add(processed_batch_size);
            nonce_start = if next > u32::MAX as u64 {
                nonce_seed
            } else {
                next
            };

            // Check if connection is still alive
            if !connection_alive.load(std::sync::atomic::Ordering::Relaxed) {
                log::debug!("GPU: Connection lost — stopping");
                break;
            }
        }
        log::debug!("GPU mining loop exited ({})", device_name);
    }

    /// Check if an algorithm can run on GPU shader
    fn is_gpu_mineable(algo: Algorithm, platform: gpu::GpuPlatform, height: u32) -> bool {
        let _ = height;
        match algo {
            // All ZION aliases resolve to the same canonical Ekam Deeksha runtime.
            // GPU kernels: Metal (macOS), OpenCL (AMD/Intel), CUDA (NVIDIA).
            Algorithm::CosmicHarmony
            | Algorithm::CosmicHarmonyV42
            | Algorithm::CosmicHarmonyDeeksha => matches!(
                platform,
                gpu::GpuPlatform::Metal | gpu::GpuPlatform::OpenCL | gpu::GpuPlatform::Cuda
            ),
            // Ethash/Autolykos — Metal has shaders, CUDA/OpenCL planned
            Algorithm::Ethash | Algorithm::Autolykos => {
                matches!(platform, gpu::GpuPlatform::Metal)
            }
            // KawPow — Metal shader available
            Algorithm::KawPow => {
                matches!(platform, gpu::GpuPlatform::Metal)
            }
            // CPU-only algorithms — no GPU shader exists
            Algorithm::RandomX | Algorithm::Yescrypt => false,
            // Default: no GPU support
            _ => false,
        }
    }

    /// CPU fallback for algorithms that GPU can't mine
    /// Runs on the GPU thread so the thread isn't idle during Revenue group
    fn cpu_fallback_batch(
        algo: Algorithm,
        blob_bytes: &[u8],
        target_hex: &str,
        cosmic_endian: Option<&str>,
        nonce_start: u64,
        batch_size: u64,
        height: u32,
    ) -> Result<Option<(u64, [u8; 32])>> {
        let native_algo = algo.to_native();

        for n in 0..batch_size {
            let nonce = nonce_start + n;
            let hash_vec = match native_algos::compute_hash(native_algo, blob_bytes, nonce, height)
            {
                Ok(h) => h,
                Err(e) => {
                    if n == 0 {
                        log::debug!("🎮 CPU-fallback hash error: {} (algo={:?})", e, native_algo);
                        let msg = e.to_string();
                        if msg.contains("not compiled") || msg.contains("not supported") {
                            return Ok(None);
                        }
                    }
                    continue;
                }
            };

            if hash_vec.len() < 32 {
                continue;
            }

            let mut hash = [0u8; 32];
            hash.copy_from_slice(&hash_vec[..32]);

            if cpu::CpuMiner::meets_target_static(algo, &hash, target_hex, cosmic_endian) {
                return Ok(Some((nonce, hash)));
            }
        }

        Ok(None)
    }

    async fn stats_loop(&self) {
        let interval_secs = self.config.stats_interval_secs.max(1);
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));

        loop {
            interval.tick().await;

            if !*self.running.read().await {
                break;
            }

            let mut stats = self.stats.write().await;
            stats.print();

            if let Some(ref path) = self.config.stats_file {
                // Desktop Agent reads this JSON file to update UI stats.
                // Best-effort: failures should never crash mining.
                let payload = stats.to_json();

                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }

                let tmp = path.with_extension("tmp");
                if std::fs::write(&tmp, payload.to_string()).is_ok() {
                    let _ = std::fs::remove_file(path);
                    let _ = std::fs::rename(&tmp, path);
                }
            }
        }
    }

    pub async fn stop(&self) {
        *self.running.write().await = false;
        log::debug!("miner stopped");
    }
}

fn parse_target_bytes(target_hex: &str) -> Result<[u8; 32]> {
    let target_hex = target_hex.trim_start_matches("0x");
    if target_hex.is_empty() {
        return Err(anyhow!("Empty target"));
    }

    let mut target_bytes = [0u8; 32];
    if let Ok(mut tbytes) = Vec::from_hex(target_hex) {
        if tbytes.len() > 32 {
            tbytes = tbytes.split_off(tbytes.len() - 32);
        }
        let start = 32 - tbytes.len();
        target_bytes[start..].copy_from_slice(&tbytes);
    }

    Ok(target_bytes)
}

/// Check if hash meets target difficulty
pub fn check_target32(hash: &[u8; 32], target: u32) -> bool {
    if target == 0 {
        return true;
    }
    let hash_val = u32::from_be_bytes([hash[28], hash[29], hash[30], hash[31]]);
    hash_val <= target
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_algorithm_from_str_cosmic_aliases() {
        let aliases = [
            "cosmic_harmony",
            "cosmicharmony",
            "cosmic-harmony",
            "cosmic_harmony_v3",
            "cosmic-harmony-v3",
            "chv3",
            "ch3",
        ];
        for alias in aliases {
            assert_eq!(
                Algorithm::from_str(alias),
                Some(Algorithm::CosmicHarmony),
                "Failed for alias: {}",
                alias
            );
        }
    }

    #[test]
    fn test_algorithm_from_str_all_variants() {
        assert_eq!(Algorithm::from_str("randomx"), Some(Algorithm::RandomX));
        assert_eq!(Algorithm::from_str("rx/0"), Some(Algorithm::RandomX));
        assert_eq!(Algorithm::from_str("verushash"), Some(Algorithm::VerusHash));
        assert_eq!(Algorithm::from_str("blake3"), Some(Algorithm::Blake3));
        assert_eq!(Algorithm::from_str("ethash"), Some(Algorithm::Ethash));
        assert_eq!(Algorithm::from_str("etchash"), Some(Algorithm::Ethash));
        assert_eq!(Algorithm::from_str("kawpow"), Some(Algorithm::KawPow));
        assert_eq!(Algorithm::from_str("autolykos"), Some(Algorithm::Autolykos));
        assert_eq!(
            Algorithm::from_str("autolykos2"),
            Some(Algorithm::Autolykos)
        );
        assert_eq!(
            Algorithm::from_str("kheavyhash"),
            Some(Algorithm::KHeavyHash)
        );
        assert_eq!(Algorithm::from_str("equihash"), Some(Algorithm::Equihash));
        assert_eq!(Algorithm::from_str("progpow"), Some(Algorithm::ProgPow));
        assert_eq!(Algorithm::from_str("argon2d"), Some(Algorithm::Argon2d));
    }

    #[test]
    fn test_algorithm_from_str_unknown() {
        assert_eq!(Algorithm::from_str("unknown"), None);
        assert_eq!(Algorithm::from_str(""), None);
        assert_eq!(Algorithm::from_str("scrypt"), None);
    }

    #[test]
    fn test_algorithm_name_roundtrip() {
        let algorithms = [
            Algorithm::CosmicHarmony,
            Algorithm::CosmicHarmonyV42,
            Algorithm::CosmicHarmonyDeeksha,
            Algorithm::RandomX,
            Algorithm::VerusHash,
            Algorithm::Yescrypt,
            Algorithm::Blake3,
            Algorithm::Ethash,
            Algorithm::KawPow,
            Algorithm::Autolykos,
            Algorithm::KHeavyHash,
            Algorithm::Equihash,
            Algorithm::ProgPow,
            Algorithm::Argon2d,
        ];
        for algo in algorithms {
            let name = algo.name();
            assert!(!name.is_empty(), "Empty name for {:?}", algo);
            // name should parse back to the same algo
            assert_eq!(
                Algorithm::from_str(name),
                Some(algo),
                "Round-trip failed for {:?} (name={})",
                algo,
                name
            );
        }
    }

    #[test]
    fn test_check_target32_zero_always_passes() {
        let hash = [0u8; 32];
        assert!(check_target32(&hash, 0));
        let hash2 = [0xFFu8; 32];
        assert!(check_target32(&hash2, 0));
    }

    #[test]
    fn test_check_target32_values() {
        let mut hash = [0u8; 32];
        // Set last 4 bytes to 0x00000100 = 256
        hash[28] = 0;
        hash[29] = 0;
        hash[30] = 1;
        hash[31] = 0;
        assert!(check_target32(&hash, 256)); // 256 <= 256
        assert!(check_target32(&hash, 257)); // 256 <= 257
        assert!(!check_target32(&hash, 255)); // 256 > 255
    }

    #[test]
    fn cosmic_harmony_gpu_mineable_on_all_platforms() {
        let genesis_height = 0;
        let high_height = 1_000_000;

        // Metal
        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmony,
            gpu::GpuPlatform::Metal,
            genesis_height
        ));

        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmonyV42,
            gpu::GpuPlatform::Metal,
            genesis_height
        ));

        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmony,
            gpu::GpuPlatform::Metal,
            high_height
        ));

        // OpenCL + CUDA — now enabled for Ekam Deeksha
        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmony,
            gpu::GpuPlatform::OpenCL,
            high_height
        ));

        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmony,
            gpu::GpuPlatform::Cuda,
            high_height
        ));

        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmonyDeeksha,
            gpu::GpuPlatform::Metal,
            high_height
        ));

        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmonyDeeksha,
            gpu::GpuPlatform::OpenCL,
            genesis_height
        ));

        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::CosmicHarmonyDeeksha,
            gpu::GpuPlatform::Cuda,
            genesis_height
        ));
    }

    #[test]
    fn zion_algorithms_use_pool_canonical_name() {
        assert_eq!(Algorithm::CosmicHarmony.pool_name(), "cosmic_harmony");
        assert_eq!(Algorithm::CosmicHarmonyV42.pool_name(), "cosmic_harmony");
        assert_eq!(Algorithm::CosmicHarmonyDeeksha.pool_name(), "cosmic_harmony");
        assert_eq!(Algorithm::RandomX.pool_name(), "randomx");
    }

    #[test]
    fn non_ch_algorithms_keep_original_gpu_rules() {
        // Ethash/KawPow/Autolykos zůstávají GPU-mineable jen na Metal backendu.
        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::Ethash,
            gpu::GpuPlatform::Metal,
            1
        ));
        assert!(!UniversalMiner::is_gpu_mineable(
            Algorithm::Ethash,
            gpu::GpuPlatform::OpenCL,
            1
        ));

        assert!(UniversalMiner::is_gpu_mineable(
            Algorithm::KawPow,
            gpu::GpuPlatform::Metal,
            1
        ));
        assert!(!UniversalMiner::is_gpu_mineable(
            Algorithm::Autolykos,
            gpu::GpuPlatform::Cuda,
            1
        ));

        // CPU-only algos vždy false.
        assert!(!UniversalMiner::is_gpu_mineable(
            Algorithm::RandomX,
            gpu::GpuPlatform::Metal,
            1
        ));
    }
}
