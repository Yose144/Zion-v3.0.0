//! Dual-Stream Mining — Parallel secondary coin alongside primary ZION stream
//!
//! Inspired by LolMiner's `--dualmode` flag (see docs/Miners/LolMiner1.93/):
//!
//!   ```bat
//!   lolMiner --algo ETCHASH --pool <ZION_OR_ETC_POOL> --user <WALLET>
//!             --dualmode ALEPHDUAL --dualpool alph.2miners.com:2020 --dualuser <ALPH_WALLET>
//!   ```
//!
//! Usage in zion-miner:
//!
//!   ```sh
//!   zion-miner \
//!     --pool stratum+tcp://91.98.122.165:3333 --wallet zion1... \
//!     --dualmode ALEPHDUAL \
//!     --dualpool alph.2miners.com:2020 \
//!     --dualuser 1mmHfNEEWgDLbEUqqxkSjzgJjDt7AqgkutD64AnBUeXz \
//!     --dual-alloc 0.30
//!   ```
//!
//! Supported dual modes (LolMiner-compatible names):
//!
//! | --dualmode    | Coin | Algorithm       | Default pool             |
//! |---------------|------|-----------------|--------------------------|
//! | ALEPHDUAL     | ALPH | Blake3          | alph.2miners.com:1199    |
//! | KASPADUAL     | KAS  | kHeavyHash      | kas.2miners.com:1111     |
//! | ETCHDUAL      | ETC  | Etchash/Ethash  | etc.2miners.com:1010     |
//! | ERGDUAL       | ERG  | Autolykos2      | erg.2miners.com:8888     |
//! | RVNDUAL       | RVN  | KawPow          | rvn.2miners.com:6060     |
//! | FLUXDUAL      | FLUX | ZelHash         | flux.2miners.com:9090    |
//! | DCRDUAL       | DCR  | Blake3 (DCP-11) | dcr.2miners.com:3333     |
//! | EPICDUAL      | EPIC | ProgPow         | epic.2miners.com:20595   |
//! | CFXDUAL       | CFX  | Octopus         | cfx.2miners.com:6060     |
//! | ZANODUAL      | ZANO | ProgPowZ        | zano.herominers.com:1110 |
//!
//! ## Architecture
//!
//! - Primary stream  : Ekam Deeksha → ZION pool  (CPU primary + GPU at ~70% default)
//! - Secondary stream: DualMode coin → external pool (GPU at ~30% idle cycles)
//!
//! Both streams run concurrently via `tokio::spawn`. The dual stream only uses
//! GPU idle cycles that would otherwise be wasted, similar to ZIL/ALPH dual
//! mining in LolMiner.
//!
//! The pool-side `g=dual` group hint tells the ZION pool StreamScheduler that
//! this miner is self-routing the secondary stream, so it always receives ZION
//! jobs (not Revenue pool-routed jobs).

use anyhow::Result;
use log::{info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::external_pool::{ExternalMiner, ExternalPoolConfig};
use crate::stratum::ethstratum::ExternalCoin;

// ─────────────────────────────────────────────────────────────────────────────
// DualMode enum — LolMiner-compatible mode names
// ─────────────────────────────────────────────────────────────────────────────

/// Dual mining mode — maps 1:1 to LolMiner `--dualmode` argument names
#[allow(clippy::enum_variant_names)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DualMode {
    /// ALPH (Blake3) — most popular GPU dual partner, uses DAG-idle cycles
    AlephDual,
    /// KAS (kHeavyHash) — Kaspa, highest profit GPU coin
    KasDual,
    /// ETC (Etchash) — classic secondary fallback
    EtchDual,
    /// ERG (Autolykos2) — Ergo
    ErgDual,
    /// RVN (KawPow) — Ravencoin
    RvnDual,
    /// FLUX (ZelHash/Equihash125,4)
    FluxDual,
    /// DCR (Blake3/DCP-0011) — Decred, high-profit Blake3 coin
    DcrDual,
    /// EPIC (ProgPow) — Epic Cash GPU primary
    EpicDual,
    /// CFX (Octopus) — Conflux, SHA3-based memory-hard algorithm
    CfxDual,
    /// ZANO (ProgPowZ) — Zano coin, identical ProgPow 0.9.2 constants
    ZanoDual,
    /// EVR (EvrProgPow) — Evrmore, ProgPow variant, on ZPool port 1330
    EVRDual,
    /// MEWC (MeowPoW) — MeowCoin, ProgPow variant, on ZPool port 1327
    MEWCDual,
}

impl DualMode {
    /// Parse from LolMiner-compatible string (case-insensitive)
    ///
    /// Accepts both long form (`ALEPHDUAL`) and short form (`ALPH`, `alph`).
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "ALEPHDUAL" | "ALPH" | "ALEPHIUM" => Some(Self::AlephDual),
            "KASPADUAL" | "KASDUAL" | "KAS" | "KASPA" => Some(Self::KasDual),
            "ETCHDUAL" | "ETCDUAL" | "ETC" | "ETCHASH" => Some(Self::EtchDual),
            "ERGDUAL" | "ERG" | "ERGO" | "AUTOLYKOS" | "AUTOLYKOS2" => Some(Self::ErgDual),
            "RVNDUAL" | "RVN" | "RAVENCOIN" | "KAWPOW" => Some(Self::RvnDual),
            "FLUXDUAL" | "FLUX" | "ZELCASH" | "ZELHASH" => Some(Self::FluxDual),
            "DCRDUAL" | "DCR" | "DECRED" | "BLAKE3DCR" | "BLAKE3-DCR" => Some(Self::DcrDual),
            "EPICDUAL" | "EPIC" | "EPICCASH" | "EPIC-CASH" | "PROGPOW-EPIC" => Some(Self::EpicDual),
            "CFXDUAL" | "CFX" | "CONFLUX" | "OCTOPUS" => Some(Self::CfxDual),
            "ZANODUAL" | "ZANO" | "ZAN" | "PROGPOWZ" | "PROGPOW-ZANO" => Some(Self::ZanoDual),
            "EVRDUAL" | "EVR" | "EVRMORE" | "EVRPROGPOW" | "EVR-PROGPOW" => Some(Self::EVRDual),
            "MEWCDUAL" | "MEOWDUAL" | "MEWC" | "MEOWCOIN" | "MEOWPOW" => Some(Self::MEWCDual),
            _ => None,
        }
    }

    /// LolMiner-compatible mode name (what --dualmode expects/produces)
    pub fn name(&self) -> &'static str {
        match self {
            Self::AlephDual => "ALEPHDUAL",
            Self::KasDual   => "KASPADUAL",
            Self::EtchDual  => "ETCHDUAL",
            Self::ErgDual   => "ERGDUAL",
            Self::RvnDual   => "RVNDUAL",
            Self::FluxDual  => "FLUXDUAL",
            Self::DcrDual   => "DCRDUAL",
            Self::EpicDual  => "EPICDUAL",
            Self::CfxDual   => "CFXDUAL",
            Self::ZanoDual  => "ZANODUAL",
            Self::EVRDual   => "EVRDUAL",
            Self::MEWCDual  => "MEWCDUAL",
        }
    }

    /// Human-readable coin ticker
    pub fn coin_ticker(&self) -> &'static str {
        match self {
            Self::AlephDual => "ALPH",
            Self::KasDual   => "KAS",
            Self::EtchDual  => "ETC",
            Self::ErgDual   => "ERG",
            Self::RvnDual   => "RVN",
            Self::FluxDual  => "FLUX",
            Self::DcrDual   => "DCR",
            Self::EpicDual  => "EPIC",
            Self::CfxDual   => "CFX",
            Self::ZanoDual  => "ZANO",
            Self::EVRDual   => "EVR",
            Self::MEWCDual  => "MEWC",
        }
    }

    /// Default 2miners-compatible pool URL (no auth required for standard miners)
    pub fn default_pool_url(&self) -> &'static str {
        match self {
            Self::AlephDual => "alph.2miners.com:1199",
            Self::KasDual   => "kas.2miners.com:1111",
            Self::EtchDual  => "etc.2miners.com:1010",
            Self::ErgDual   => "erg.2miners.com:8888",
            Self::RvnDual   => "rvn.2miners.com:6060",
            Self::FluxDual  => "flux.2miners.com:9090",
            Self::DcrDual   => "dcr.2miners.com:3333",
            Self::EpicDual  => "epic.2miners.com:20595",
            Self::CfxDual   => "cfx.2miners.com:6060",
            Self::ZanoDual  => "zano.herominers.com:1110",  // HeroMiners ZANO ProgPowZ
            Self::EVRDual   => "evrprogpow.eu.mine.zpool.ca:1330",  // ZPool EVR (EvrProgPow)
            Self::MEWCDual  => "meowpow.eu.mine.zpool.ca:1327",     // ZPool MEWC (MeowPoW)
        }
    }

    /// ZPool.ca stratum URL pro těto dual-mode coin (deleguje na `ExternalCoin::zpool_url`).
    ///
    /// ZPool auto-přepíná coiny v rámci algoritmu a vyplácí v BTC.
    /// Heslo k pool URL musí obsahovat `c=BTC` (např. `--dual-pass c=BTC` nebo `c=BTC,zap=RVN`).
    /// Vrací `None` pokud ZPool tento algoritmus nepodporuje (FLUX, CFX, ZANO).
    pub fn zpool_url(&self, region: &str) -> Option<String> {
        self.to_external_coin().zpool_url(region)
    }

    /// HeroMiners stratum URL (deleguje na `ExternalCoin::herominers_url`).
    /// Vrací `None` pro coiny které HeroMiners nepodporuje (EPIC, FLUX, DCR, EVR, MEWC).
    pub fn herominers_url(&self, region: &str) -> Option<String> {
        self.to_external_coin().herominers_url(region)
    }

    /// NiceHash stratum URL (deleguje na `ExternalCoin::nicehash_url`).
    /// Výplata vždy v BTC — uživatelské jméno = BTC adresa, heslo = `x`.
    /// Vrací `None` pro coiny které NiceHash nepodporuje (ALPH, FLUX, DCR, ZANO, EPIC, EVR, MEWC).
    pub fn nicehash_url(&self, region: &str) -> Option<String> {
        self.to_external_coin().nicehash_url(region)
    }

    /// Best pool URL based on preference hierarchy (deleguje na `ExternalCoin::best_pool_url`).
    ///
    /// `preference` — "nicehash" | "herominers" (default) | "zpool" | "default"
    /// `region`     — "eu" | "na" | "hk"
    /// `nh_btc_addr`— BTC address for NiceHash payout
    ///
    /// Priority: NiceHash → HeroMiners → ZPool → 2miners default
    pub fn best_pool_url(&self, preference: &str, region: &str, nh_btc_addr: Option<&str>) -> String {
        self.to_external_coin().best_pool_url(preference, region, nh_btc_addr)
    }

    /// Map to `ExternalCoin` (used by `ExternalMiner` / `EthStratumClient`)
    pub fn to_external_coin(self) -> ExternalCoin {
        match self {
            Self::AlephDual => ExternalCoin::ALPH,
            Self::KasDual   => ExternalCoin::KAS,
            Self::EtchDual  => ExternalCoin::ETC,
            Self::ErgDual   => ExternalCoin::ERG,
            Self::RvnDual   => ExternalCoin::RVN,
            Self::FluxDual  => ExternalCoin::FLUX,
            Self::DcrDual   => ExternalCoin::DCR,
            Self::EpicDual  => ExternalCoin::EPIC,
            Self::CfxDual   => ExternalCoin::CFX,
            Self::ZanoDual  => ExternalCoin::ZANO,
            Self::EVRDual   => ExternalCoin::EVR,
            Self::MEWCDual  => ExternalCoin::MEWC,
        }
    }

    /// Whether the algorithm uses GPU memory/DAG (affects gpu_alloc behaviour)
    pub fn is_dag_algo(&self) -> bool {
        matches!(self, Self::EtchDual | Self::CfxDual | Self::ZanoDual)
    }
}

impl std::fmt::Display for DualMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DualStreamConfig
// ─────────────────────────────────────────────────────────────────────────────

/// Configuration for dual/trinity mining
#[derive(Debug, Clone)]
pub struct DualStreamConfig {
    /// Dual mining mode (secondary coin)
    pub mode: DualMode,
    /// Secondary pool URL (host:port — no stratum+tcp:// prefix needed)
    pub pool_url: String,
    /// Wallet/user for secondary pool login
    pub wallet: String,
    /// Worker name for this stream
    pub worker: String,
    /// GPU allocation fraction for this stream (0.05 – 0.90, default 0.30)
    ///
    /// 0.30 = 30% of GPU goes to secondary coin (ALPH/KAS/etc.),
    ///        remaining % stays on primary ZION Ekam Deeksha mining.
    pub gpu_alloc: f32,
    /// Stream label used in log output: "dual" or "triple"
    pub stream_label: String,
}

impl DualStreamConfig {
    /// Create dual-stream config from CLI args (stream label = "dual")
    pub fn from_cli(
        mode: DualMode,
        pool_url: Option<String>,
        wallet: String,
        worker: &str,
        gpu_alloc: f32,
    ) -> Self {
        Self::from_cli_with_label(mode, pool_url, wallet, worker, gpu_alloc, "dual")
    }

    /// Create config with explicit stream label ("dual" or "triple")
    pub fn from_cli_with_label(
        mode: DualMode,
        pool_url: Option<String>,
        wallet: String,
        worker: &str,
        gpu_alloc: f32,
        label: &str,
    ) -> Self {
        Self {
            pool_url: pool_url.unwrap_or_else(|| mode.default_pool_url().to_string()),
            mode,
            wallet,
            worker: format!("{}-{}", worker, label),
            gpu_alloc: gpu_alloc.clamp(0.05, 0.90),
            stream_label: label.to_string(),
        }
    }

    /// Return a human-readable summary for banner printing
    pub fn summary(&self) -> String {
        format!(
            "{} → {} ({:.0}% GPU alloc, worker={})",
            self.mode.name(),
            self.pool_url,
            self.gpu_alloc * 100.0,
            self.worker,
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DualStreamMiner
// ─────────────────────────────────────────────────────────────────────────────

/// Dual-stream miner — runs the secondary coin stream concurrently with primary.
///
/// Lifecycle:
/// 1. Caller creates `DualStreamMiner::new(config)`
/// 2. Wrap in `Arc` and `tokio::spawn(async move { miner.start().await })`
/// 3. The miner auto-reconnects on errors (15 s backoff)
/// 4. Call `miner.stop()` to halt all activity
pub struct DualStreamMiner {
    config: DualStreamConfig,
    running: Arc<AtomicBool>,
}

impl DualStreamMiner {
    /// Create a new dual-stream miner
    pub fn new(config: DualStreamConfig) -> Self {
        Self {
            config,
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start the dual-stream miner.
    ///
    /// Internally wraps `ExternalMiner` for the selected secondary coin.
    /// Reconnects automatically on pool disconnect or error.
    pub async fn start(&self) -> Result<()> {
        self.running.store(true, Ordering::SeqCst);

        let coin = self.config.mode.to_external_coin();
        let alloc_pct = (self.config.gpu_alloc * 100.0) as u8;
        let label = self.config.stream_label.to_uppercase();

        let ext_config = ExternalPoolConfig {
            coin,
            pool_url: self.config.pool_url.clone(),
            wallet: self.config.wallet.clone(),
            worker: self.config.worker.clone(),
            cpu_threads: 0,  // dual/triple streams are GPU-only
            gpu_enabled: true,
            hashpower_percent: alloc_pct,
        };

        info!(
            "[{}] {} stream starting → pool={} wallet={}...{} alloc={}% worker={}",
            label,
            self.config.mode.coin_ticker(),
            self.config.pool_url,
            &self.config.wallet[..self.config.wallet.len().min(8)],
            &self.config.wallet[self.config.wallet.len().saturating_sub(4)..],
            alloc_pct,
            self.config.worker,
        );

        let miner = ExternalMiner::new(ext_config);
        let running = Arc::clone(&self.running);

        while running.load(Ordering::SeqCst) {
            match miner.start().await {
                Ok(_) => {
                    info!(
                        "[{}] {} stream ended cleanly",
                        label,
                        self.config.mode.coin_ticker()
                    );
                    break;
                }
                Err(e) => {
                    warn!(
                        "[{}] {} stream error: {} — reconnecting in 15s",
                        label,
                        self.config.mode.coin_ticker(),
                        e
                    );
                    if running.load(Ordering::SeqCst) {
                        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
                    }
                }
            }
        }

        info!("[{}] {} stream stopped", label, self.config.mode.coin_ticker());
        Ok(())
    }

    /// Stop the dual-stream miner
    pub fn stop(&self) {
        info!(
            "[DUAL] Stopping {} stream...",
            self.config.mode.coin_ticker()
        );
        self.running.store(false, Ordering::SeqCst);
    }

    /// Whether the miner is currently running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Current dual mode
    pub fn mode(&self) -> DualMode {
        self.config.mode
    }

    /// Current pool URL
    pub fn pool_url(&self) -> &str {
        &self.config.pool_url
    }

    /// GPU allocation fraction
    pub fn gpu_alloc(&self) -> f32 {
        self.config.gpu_alloc
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Triple-stream support (ZIL epoch + primary + dual)
// ─────────────────────────────────────────────────────────────────────────────
// Future: LolMiner triple mining (ZIL+ETC+ALPH) uses ZIL epoch windows to
// inject a third stratum connection. We reserve this for a future milestone
// once dual is stable. CLI: --triplemode ZILDUAL --triplepool ...

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dualmode_from_str() {
        assert_eq!(DualMode::from_str("ALEPHDUAL"), Some(DualMode::AlephDual));
        assert_eq!(DualMode::from_str("alph"), Some(DualMode::AlephDual));
        assert_eq!(DualMode::from_str("kaspadual"), Some(DualMode::KasDual));
        assert_eq!(DualMode::from_str("KAS"), Some(DualMode::KasDual));
        assert_eq!(DualMode::from_str("ETCHDUAL"), Some(DualMode::EtchDual));
        assert_eq!(DualMode::from_str("etc"), Some(DualMode::EtchDual));
        assert_eq!(DualMode::from_str("ERGDUAL"), Some(DualMode::ErgDual));
        assert_eq!(DualMode::from_str("RVNDUAL"), Some(DualMode::RvnDual));
        assert_eq!(DualMode::from_str("FLUXDUAL"), Some(DualMode::FluxDual));
        // New coins
        assert_eq!(DualMode::from_str("DCRDUAL"), Some(DualMode::DcrDual));
        assert_eq!(DualMode::from_str("dcr"), Some(DualMode::DcrDual));
        assert_eq!(DualMode::from_str("EPICDUAL"), Some(DualMode::EpicDual));
        assert_eq!(DualMode::from_str("epic"), Some(DualMode::EpicDual));
        assert_eq!(DualMode::from_str("CFXDUAL"), Some(DualMode::CfxDual));
        assert_eq!(DualMode::from_str("octopus"), Some(DualMode::CfxDual));
        assert_eq!(DualMode::from_str("UNKNOWN"), None);
    }

    #[test]
    fn test_dualmode_coin_tickers() {
        assert_eq!(DualMode::AlephDual.coin_ticker(), "ALPH");
        assert_eq!(DualMode::KasDual.coin_ticker(), "KAS");
        assert_eq!(DualMode::EtchDual.coin_ticker(), "ETC");
        assert_eq!(DualMode::DcrDual.coin_ticker(), "DCR");
        assert_eq!(DualMode::EpicDual.coin_ticker(), "EPIC");
        assert_eq!(DualMode::CfxDual.coin_ticker(), "CFX");
    }

    #[test]
    fn test_default_pool_urls() {
        assert_eq!(DualMode::AlephDual.default_pool_url(), "alph.2miners.com:1199");
        assert_eq!(DualMode::KasDual.default_pool_url(), "kas.2miners.com:1111");
        assert_eq!(DualMode::DcrDual.default_pool_url(), "dcr.2miners.com:3333");
        assert_eq!(DualMode::EpicDual.default_pool_url(), "epic.2miners.com:20595");
        assert_eq!(DualMode::CfxDual.default_pool_url(), "cfx.2miners.com:6060");
    }

    #[test]
    fn test_config_from_cli_defaults() {
        let cfg = DualStreamConfig::from_cli(
            DualMode::AlephDual,
            None,
            "1mmHfTestWallet".to_string(),
            "my-worker",
            0.30,
        );
        assert_eq!(cfg.pool_url, "alph.2miners.com:1199");
        assert_eq!(cfg.worker, "my-worker-dual");
        assert!((cfg.gpu_alloc - 0.30).abs() < 0.001);
    }

    #[test]
    fn test_gpu_alloc_clamp() {
        let cfg = DualStreamConfig::from_cli(
            DualMode::KasDual,
            None,
            "wallet".to_string(),
            "w",
            1.5, // should clamp to 0.90
        );
        assert!((cfg.gpu_alloc - 0.90).abs() < 0.001);
    }
}
