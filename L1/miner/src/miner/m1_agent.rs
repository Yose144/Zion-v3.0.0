//! M1 Unified Mining Agent — Apple Silicon GPU / CPU / NPU
//!
//! Orchestruje tři výpočetní cesty na Apple Silicon M-series:
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────┐
//! │                   M1AgentMiner                                  │
//! │                                                                 │
//! │  1. Metal GPU  — primární path (výkon ~500-2000+ H/s na M2/M3) │
//! │     └─ MetalGpuMiner (batch dispatch, zion-cosmic-harmony-v3)  │
//! │                                                                 │
//! │  2. CPU Parallel — rayon (performance cores přednostně)         │
//! │     └─ cosmic_harmony_with_height (CHv4.1/CHv4.2 auto-dispatch)│
//! │                                                                 │
//! │  3. NPU/ANE — Apple Neural Engine via CoreML Python bridge      │
//! │     └─ cosmic_harmony_v42_ane_bridge.py (async subprocess)     │
//! └─────────────────────────────────────────────────────────────────┘
//! ```
//!
//! Strategie:
//!   - GPU je primární — maximální throughput per watt
//!   - CPU doplňuje GPU (n_performance_cores - 1 vláken)
//!   - NPU je experimentální (opt-in via ZION_M1_NPU=1)
//!
//! CHv4.2 dispatch: předává height z jobu, `cosmic_harmony_with_height` automaticky
//! přepíná CHv4.1 ↔ CHv4.2 dle `CHV4_2_FORK_HEIGHT` (nebo ZION_CHV4_2_FORK_HEIGHT env var).
//!
//! Env vars:
//!   ZION_M1_GPU=0             — vypne Metal GPU path
//!   ZION_M1_CPU=0             — vypne CPU path
//!   ZION_M1_NPU=1             — zapne NPU/ANE path (experimentální)
//!   ZION_M1_CPU_THREADS=N     — počet CPU vláken (default: perf_cores - 1)
//!   ZION_CHV4_2_FORK_HEIGHT=N — override fork height (testnet: 10000)
//!
//! Version: 2.9.7 — CHv4.2 Merkabah Dual-Spin

use anyhow::{anyhow, Result};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::Instant;

use super::gpu::metal::MetalGpuMiner;
use super::gpu::{GpuDevice, GpuMiner, GpuPlatform};

// ============================================================================
// Job — sdílená informace o aktuální práci
// ============================================================================

/// Aktuální job (předávaný z pool clienta do agenta)
#[derive(Debug, Clone)]
pub struct M1Job {
    /// Hlavička bloku (80 bajtů typicky)
    pub header: Vec<u8>,
    /// Difficulty target (32 bajtů, big-endian)
    pub target: [u8; 32],
    /// Výška bloku (pro CHv4.2 fork dispatch)
    pub height: u64,
    /// Job ID pro stratum submit
    pub job_id: String,
}

// ============================================================================
// M1 agent konfigurace
// ============================================================================

/// Konfigurace M1 agenta
#[derive(Debug, Clone)]
pub struct M1AgentConfig {
    /// Zapnout Metal GPU cestu (default: true)
    pub use_gpu: bool,
    /// Zapnout CPU parallel cestu (default: true)
    pub use_cpu: bool,
    /// Zapnout NPU/ANE cestu — experimentální (default: false)
    pub use_npu: bool,
    /// Počet CPU vláken (None = auto: perf_cores - 1)
    pub cpu_threads: Option<usize>,
    /// Metal batch size (None = auto z VRAM)
    pub gpu_batch_size: Option<usize>,
    /// Cesta k NPU bridge Python scriptu
    pub npu_script: Option<std::path::PathBuf>,
}

impl Default for M1AgentConfig {
    fn default() -> Self {
        Self {
            use_gpu: std::env::var("ZION_M1_GPU")
                .map(|v| v != "0")
                .unwrap_or(true),
            use_cpu: std::env::var("ZION_M1_CPU")
                .map(|v| v != "0")
                .unwrap_or(true),
            use_npu: std::env::var("ZION_M1_NPU")
                .map(|v| v == "1" || v == "true")
                .unwrap_or(false),
            cpu_threads: std::env::var("ZION_M1_CPU_THREADS")
                .ok()
                .and_then(|v| v.parse().ok()),
            gpu_batch_size: None,
            npu_script: None,
        }
    }
}

// ============================================================================
// Výsledek hash operace
// ============================================================================

#[derive(Debug)]
pub struct M1HashResult {
    pub nonce: u64,
    pub hash: [u8; 32],
    pub path: M1Path,
}

/// Která výpočetní cesta produkovala výsledek
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum M1Path {
    MetalGpu,
    CpuParallel,
    NpuAne,
}

impl std::fmt::Display for M1Path {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MetalGpu   => write!(f, "Metal GPU"),
            Self::CpuParallel => write!(f, "CPU parallel"),
            Self::NpuAne     => write!(f, "NPU/ANE"),
        }
    }
}

// ============================================================================
// M1 Agent stats
// ============================================================================

/// Provozní statistiky agenta
#[derive(Debug, Default)]
pub struct M1AgentStats {
    pub gpu_hashes:  AtomicU64,
    pub cpu_hashes:  AtomicU64,
    pub npu_hashes:  AtomicU64,
    pub gpu_shares:  AtomicU64,
    pub cpu_shares:  AtomicU64,
    pub npu_shares:  AtomicU64,
}

impl M1AgentStats {
    pub fn total_hashes(&self) -> u64 {
        self.gpu_hashes.load(Ordering::Relaxed)
            + self.cpu_hashes.load(Ordering::Relaxed)
            + self.npu_hashes.load(Ordering::Relaxed)
    }

    pub fn total_hashrate(&self, elapsed_secs: f64) -> f64 {
        if elapsed_secs > 0.0 {
            self.total_hashes() as f64 / elapsed_secs
        } else {
            0.0
        }
    }
}

// ============================================================================
// Detekce M1 hardware
// ============================================================================

/// Informace o Apple Silicon čipu
#[derive(Debug, Clone)]
pub struct M1HardwareInfo {
    pub chip_name: String,
    pub performance_cores: usize,
    pub efficiency_cores: usize,
    pub gpu_cores: usize,
    pub has_ane: bool,
    pub unified_memory_mb: u64,
}

/// Detekuje Apple Silicon hardware přes `sysctl` a `system_profiler`.
/// Vrací `None` na non-Apple platformách.
pub fn detect_m1_hardware() -> Option<M1HardwareInfo> {
    #[cfg(target_os = "macos")]
    {
        // Čip jméno z sysctl
        let chip = run_sysctl("machdep.cpu.brand_string")
            .or_else(|| run_sysctl("hw.model"))
            .unwrap_or_else(|| "Apple Silicon".to_string());

        let p_cores = run_sysctl("hw.perflevel0.logicalcpu")
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(4usize);

        let e_cores = run_sysctl("hw.perflevel1.logicalcpu")
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(4usize);

        let memsize_bytes: u64 = run_sysctl("hw.memsize")
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(8 * 1024 * 1024 * 1024);

        // GPU cores z chip name (hrubý odhad)
        let gpu_cores = if chip.contains("M3 Max") || chip.contains("M4 Max") {
            40
        } else if chip.contains("M3 Pro") || chip.contains("M4 Pro") {
            18
        } else if chip.contains("M2 Max") || chip.contains("M3") {
            30
        } else if chip.contains("M2 Pro") {
            19
        } else if chip.contains("M2") {
            10
        } else if chip.contains("M1 Max") {
            32
        } else if chip.contains("M1 Pro") {
            16
        } else {
            8 // M1 base nebo neznámý čip
        };

        // ANE je přítomno na všech M-series čipech (M1+)
        let has_ane = chip.contains("Apple M") || chip.contains("Apple A");

        Some(M1HardwareInfo {
            chip_name:        chip,
            performance_cores: p_cores,
            efficiency_cores: e_cores,
            gpu_cores,
            has_ane,
            unified_memory_mb: memsize_bytes / (1024 * 1024),
        })
    }

    #[cfg(not(target_os = "macos"))]
    None
}

#[cfg(target_os = "macos")]
fn run_sysctl(key: &str) -> Option<String> {
    Command::new("sysctl")
        .arg("-n")
        .arg(key)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
}

// ============================================================================
// M1 Mining Agent
// ============================================================================

/// M1 Unified Mining Agent — orchestruje GPU + CPU + NPU
pub struct M1AgentMiner {
    config: M1AgentConfig,
    pub hardware: Option<M1HardwareInfo>,
    pub stats: Arc<M1AgentStats>,
    start_time: Instant,

    // Job sdílený mezi vlákny
    job: Arc<RwLock<Option<M1Job>>>,

    // GPU miner (Metal)
    gpu_miner: Option<MetalGpuMiner>,
    gpu_device: Option<GpuDevice>,
}

impl M1AgentMiner {
    /// Vytvoří a inicializuje M1 agenta.
    ///
    /// Detekuje hardware, inicializuje Metal GPU, nastaví CPU a NPU cesty.
    pub fn new(config: M1AgentConfig) -> Result<Self> {
        let hardware = detect_m1_hardware();

        if let Some(hw) = &hardware {
            log::info!(
                "🍎 M1 Agent: {} | P-cores={} E-cores={} GPU={} ANE={}",
                hw.chip_name,
                hw.performance_cores,
                hw.efficiency_cores,
                hw.gpu_cores,
                if hw.has_ane { "✅" } else { "❌" },
            );
        } else {
            log::warn!("M1 Agent: hardware detection unavailable (non-macOS?)");
        }

        // Metal GPU init
        let (gpu_miner, gpu_device) = if config.use_gpu {
            match Self::init_metal_gpu(&config, &hardware) {
                Ok((g, d)) => {
                    log::info!("Metal GPU: {} | batch={}", d.name, g.get_batch_size());
                    (Some(g), Some(d))
                }
                Err(e) => {
                    log::warn!("Metal GPU init failed: {} — CPU-only mode", e);
                    (None, None)
                }
            }
        } else {
            log::info!("Metal GPU disabled (ZION_M1_GPU=0)");
            (None, None)
        };

        // NPU check
        if config.use_npu {
            log::info!(
                "NPU/ANE path: {} — {}",
                if hardware.as_ref().map(|h| h.has_ane).unwrap_or(false) {
                    "hardware available"
                } else {
                    "no ANE detected"
                },
                "experimental mode (ZION_M1_NPU=1)"
            );
            // Verify Python + coremltools
            if let Err(e) = Self::check_npu_requirements() {
                log::warn!("NPU requirements not met: {} — NPU path disabled", e);
            }
        }

        Ok(Self {
            config,
            hardware,
            stats: Arc::new(M1AgentStats::default()),
            start_time: Instant::now(),
            job: Arc::new(RwLock::new(None)),
            gpu_miner,
            gpu_device,
        })
    }

    fn init_metal_gpu(
        config: &M1AgentConfig,
        hardware: &Option<M1HardwareInfo>,
    ) -> Result<(MetalGpuMiner, GpuDevice)> {
        // Vypočítej batch size z VRAM
        let vram_mb = hardware
            .as_ref()
            .map(|hw| hw.unified_memory_mb)
            .unwrap_or(8192);
        let scratchpad_bytes: usize = 65_536; // 64 KiB per thread
        let safe_vram = (vram_mb as usize * 1024 * 1024) / 5; // 20% unified
        let batch = config.gpu_batch_size.unwrap_or_else(|| {
            (safe_vram / scratchpad_bytes).max(512).min(8192)
        });

        let miner = MetalGpuMiner::new(batch)?;

        let device = GpuDevice {
            id: 0,
            name: hardware
                .as_ref()
                .map(|hw| format!("{} GPU ({} cores)", hw.chip_name, hw.gpu_cores))
                .unwrap_or_else(|| "Apple Metal GPU".to_string()),
            platform: GpuPlatform::Metal,
            compute_units: hardware
                .as_ref()
                .map(|hw| hw.gpu_cores as u32)
                .unwrap_or(8),
            memory_mb: vram_mb,
        };

        Ok((miner, device))
    }

    fn check_npu_requirements() -> Result<()> {
        // Zkontroluj dostupnost coremltools/ane_tools
        let output = Command::new("python3")
            .args(["-c", "import coremltools; print(coremltools.__version__)"])
            .output();

        match output {
            Ok(o) if o.status.success() => {
                let ver = String::from_utf8_lossy(&o.stdout);
                log::info!("coremltools: {}", ver.trim());
                Ok(())
            }
            _ => Err(anyhow!(
                "coremltools not available. Install: pip install coremltools"
            )),
        }
    }

    /// Nastaví/aktualizuje aktuální job (volá pool client po přijetí nového jobu)
    pub fn update_job(&self, job: M1Job) {
        if let Ok(mut guard) = self.job.write() {
            *guard = Some(job);
        }
    }

    /// CPU thread count: preference coresponformance - 1 (neber efektivní jádra)
    pub fn cpu_thread_count(&self) -> usize {
        if let Some(n) = self.config.cpu_threads {
            return n.max(1);
        }
        if let Some(hw) = &self.hardware {
            // Nech 1 P-core volné pro OS + GPU dispatch
            return (hw.performance_cores.saturating_sub(1)).max(1);
        }
        // Fallback: polovina logických jader
        (num_cpus::get() / 2).max(1)
    }

    // -----------------------------------------------------------------------
    // Batch mining — volá se z mining loop pro jeden batch nonces
    // -----------------------------------------------------------------------

    /// Mine jednu dávku nonces přes GPU.
    ///
    /// Vrací `Some(result)` pokud byl nalezen nonce splňující target.
    pub fn mine_gpu_batch(
        &mut self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        height: u64,
    ) -> Result<Option<M1HashResult>> {
        let gpu = match self.gpu_miner.as_mut() {
            Some(g) => g,
            None => return Ok(None),
        };

        let batch = gpu.get_batch_size() as u64;
        let result = gpu.mine_batch(header, target, nonce_start, batch, height)?;

        self.stats
            .gpu_hashes
            .fetch_add(batch, Ordering::Relaxed);

        Ok(result.map(|(nonce, hash)| M1HashResult {
            nonce,
            hash,
            path: M1Path::MetalGpu,
        }))
    }

    /// Mine jednu dávku nonces přes CPU parallel (rayon).
    ///
    /// CHv4.2 dispatch: pokud `height >= CHV4_2_FORK_HEIGHT`, automaticky CHv4.2.
    #[cfg(feature = "parallel")]
    pub fn mine_cpu_batch(
        &self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        count: usize,
        height: u64,
    ) -> Option<M1HashResult> {
        use rayon::prelude::*;
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;

        let effective_height = Self::effective_height(height);
        let found_flag = Arc::new(AtomicBool::new(false));
        let found_clone = found_flag.clone();

        let header_vec = header.to_vec();
        let target_copy = *target;

        let result = (0..count as u64)
            .into_par_iter()
            .find_map_any(|i| {
                if found_clone.load(Ordering::Relaxed) {
                    return None;
                }
                let nonce = nonce_start.wrapping_add(i);
                let hash =
                    zion_cosmic_harmony_v3::algorithms_opt::cosmic_harmony_with_height(
                        &header_vec,
                        nonce,
                        effective_height,
                    );
                if zion_cosmic_harmony_v3::algorithms_opt::meets_difficulty(&hash, &target_copy) {
                    found_clone.store(true, Ordering::Relaxed);
                    Some((nonce, hash.data))
                } else {
                    None
                }
            });

        self.stats
            .cpu_hashes
            .fetch_add(count as u64, Ordering::Relaxed);

        result.map(|(nonce, hash)| M1HashResult {
            nonce,
            hash,
            path: M1Path::CpuParallel,
        })
    }

    /// Přepočítá height s ohledem na ZION_CHV4_2_FORK_HEIGHT env override
    fn effective_height(height: u64) -> u64 {
        if let Ok(env_h) = std::env::var("ZION_CHV4_2_FORK_HEIGHT") {
            if let Ok(fork_h) = env_h.trim().parse::<u64>() {
                if height >= fork_h {
                    return u64::MAX; // → CHv4.2 aktivní
                }
            }
        }
        height
    }

    // -----------------------------------------------------------------------
    // NPU/ANE path (experimentální, přes Python subprocess)
    // -----------------------------------------------------------------------

    /// Odešle batch do NPU bridge Python scriptu (async IPC).
    ///
    /// ANE path je experimentální — Apple Neural Engine je optimalizován pro
    /// matricové operace (inference), ne pro kryptografii. Praktické využití:
    /// INT8 matrix ops v brahma_jyoti finalize fázi (potenciálně 2-5× speedup
    /// oproti CPU pro tuto konkrétní fázi).
    ///
    /// Spouštěn jen pokud ZION_M1_NPU=1 a coremltools jsou nainstalovány.
    pub async fn mine_npu_batch(
        &self,
        header: &[u8],
        target: &[u8; 32],
        nonce_start: u64,
        count: u64,
        height: u64,
    ) -> Result<Option<M1HashResult>> {
        if !self.config.use_npu {
            return Ok(None);
        }

        let script = self.config.npu_script.as_ref()
            .map(|p| p.clone())
            .or_else(|| Self::find_npu_bridge_script())
            .ok_or_else(|| anyhow!("NPU bridge script not found (cosmic_harmony_v42_ane_bridge.py)"))?;

        // Předání parametrů přes env / stdin (JSON)
        let request = serde_json::json!({
            "header": hex::encode(header),
            "target": hex::encode(target),
            "nonce_start": nonce_start,
            "count": count,
            "height": height,
        });

        let output = tokio::process::Command::new("python3")
            .arg(&script)
            .arg("--batch-json")
            .arg(request.to_string())
            .output()
            .await?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("NPU bridge error: {}", err));
        }

        self.stats
            .npu_hashes
            .fetch_add(count, Ordering::Relaxed);

        // Parse výsledek
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(result) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
            if let (Some(nonce_val), Some(hash_val)) =
                (result.get("nonce"), result.get("hash"))
            {
                let nonce = nonce_val.as_u64().unwrap_or(0);
                let hash_hex = hash_val.as_str().unwrap_or("");
                if let Ok(hash_bytes) = hex::decode(hash_hex) {
                    if hash_bytes.len() == 32 {
                        let mut hash = [0u8; 32];
                        hash.copy_from_slice(&hash_bytes);
                        return Ok(Some(M1HashResult {
                            nonce,
                            hash,
                            path: M1Path::NpuAne,
                        }));
                    }
                }
            }
        }

        Ok(None)
    }

    fn find_npu_bridge_script() -> Option<std::path::PathBuf> {
        // Hledej cosmic_harmony_v42_ane_bridge.py vedle fallback scriptu
        let candidates = [
            "APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v42_ane_bridge.py",
            "resources/mining/cosmic_harmony_v42_ane_bridge.py",
            "mining/cosmic_harmony_v42_ane_bridge.py",
        ];
        for c in &candidates {
            let p = std::path::PathBuf::from(c);
            if p.exists() {
                return Some(p);
            }
        }
        None
    }

    // -----------------------------------------------------------------------
    // Status výpis
    // -----------------------------------------------------------------------

    /// Vypiš status agenta (volej periodicky z hlavní smyčky)
    pub fn log_status(&self) {
        let elapsed = self.start_time.elapsed().as_secs_f64();
        let total_hr = self.stats.total_hashrate(elapsed);
        let gpu_h   = self.stats.gpu_hashes.load(Ordering::Relaxed);
        let cpu_h   = self.stats.cpu_hashes.load(Ordering::Relaxed);
        let npu_h   = self.stats.npu_hashes.load(Ordering::Relaxed);

        let gpu_hr = if elapsed > 0.0 { gpu_h as f64 / elapsed } else { 0.0 };
        let cpu_hr = if elapsed > 0.0 { cpu_h as f64 / elapsed } else { 0.0 };
        let npu_hr = if elapsed > 0.0 { npu_h as f64 / elapsed } else { 0.0 };

        log::info!(
            "🍎 M1 Agent | Total: {:.1} H/s | GPU: {:.1} H/s | CPU: {:.1} H/s | NPU: {:.1} H/s",
            total_hr, gpu_hr, cpu_hr, npu_hr
        );
    }

    /// Je GPU k dispozici?
    pub fn has_gpu(&self) -> bool {
        self.gpu_miner.is_some()
    }

    /// Je NPU povoleno?
    pub fn has_npu(&self) -> bool {
        self.config.use_npu
    }

    /// Vrátí referenci na stats
    pub fn stats(&self) -> &Arc<M1AgentStats> {
        &self.stats
    }

    /// Vrátí natural batch size pro GPU dispatch
    pub fn gpu_batch_size(&self) -> Option<u64> {
        self.gpu_miner.as_ref().map(|g| g.get_batch_size() as u64)
    }
}

// ============================================================================
// Hlavní mining loop integrace (builder pattern)
// ============================================================================

/// Stavivač pro `M1AgentMiner` — zjednodušuje inicializaci z main.rs
pub struct M1AgentBuilder {
    config: M1AgentConfig,
}

impl M1AgentBuilder {
    pub fn new() -> Self {
        Self {
            config: M1AgentConfig::default(),
        }
    }

    pub fn gpu(mut self, enabled: bool) -> Self {
        self.config.use_gpu = enabled;
        self
    }

    pub fn cpu(mut self, enabled: bool) -> Self {
        self.config.use_cpu = enabled;
        self
    }

    pub fn npu(mut self, enabled: bool) -> Self {
        self.config.use_npu = enabled;
        self
    }

    pub fn cpu_threads(mut self, n: usize) -> Self {
        self.config.cpu_threads = Some(n);
        self
    }

    pub fn gpu_batch_size(mut self, n: usize) -> Self {
        self.config.gpu_batch_size = Some(n);
        self
    }

    pub fn npu_script(mut self, path: std::path::PathBuf) -> Self {
        self.config.npu_script = Some(path);
        self
    }

    pub fn build(self) -> Result<M1AgentMiner> {
        M1AgentMiner::new(self.config)
    }
}

impl Default for M1AgentBuilder {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_hardware() {
        // Mělo by proběhnout bez panicu na jakékoli platformě
        let hw = detect_m1_hardware();
        #[cfg(target_os = "macos")]
        {
            // Na macOS bychom měli dostat info
            if let Some(hw) = &hw {
                assert!(!hw.chip_name.is_empty());
                assert!(hw.performance_cores >= 1);
                assert!(hw.unified_memory_mb > 0);
                println!(
                    "✅ Detected: {} | P={} E={} GPU={} ANE={} RAM={}MiB",
                    hw.chip_name,
                    hw.performance_cores,
                    hw.efficiency_cores,
                    hw.gpu_cores,
                    hw.has_ane,
                    hw.unified_memory_mb,
                );
            }
        }
        #[cfg(not(target_os = "macos"))]
        assert!(hw.is_none());
    }

    #[test]
    fn test_m1_builder_default() {
        // Builder vytvoří config bez paniku
        let builder = M1AgentBuilder::new()
            .gpu(false)  // GPU off pro test (CI nemá Metal)
            .cpu(true)
            .npu(false)
            .cpu_threads(2);
        // Nebudeme volat .build() v testu (Metal init vyžaduje macOS + Metal feature)
        drop(builder);
    }

    #[test]
    fn test_effective_height_no_env() {
        // Bez env override se height vrací beze změny
        std::env::remove_var("ZION_CHV4_2_FORK_HEIGHT");
        assert_eq!(M1AgentMiner::effective_height(1000), 1000);
        assert_eq!(M1AgentMiner::effective_height(u64::MAX), u64::MAX);
    }

    #[test]
    fn test_effective_height_env_override() {
        // S env override: height >= fork → u64::MAX (CHv4.2 aktivní)
        std::env::set_var("ZION_CHV4_2_FORK_HEIGHT", "10000");
        assert_eq!(M1AgentMiner::effective_height(9999), 9999);  // pod fork → beze změny
        assert_eq!(M1AgentMiner::effective_height(10000), u64::MAX); // na fork → CHv4.2
        assert_eq!(M1AgentMiner::effective_height(50000), u64::MAX); // nad fork → CHv4.2
        std::env::remove_var("ZION_CHV4_2_FORK_HEIGHT");
        println!("✅ effective_height env override: OK");
    }

    #[test]
    fn test_m1_path_display() {
        assert_eq!(M1Path::MetalGpu.to_string(), "Metal GPU");
        assert_eq!(M1Path::CpuParallel.to_string(), "CPU parallel");
        assert_eq!(M1Path::NpuAne.to_string(), "NPU/ANE");
    }
}
