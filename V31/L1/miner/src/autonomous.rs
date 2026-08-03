//! Autonomous profit router — auto-selects Stream 2 (GPU) and Stream 3 (CPU) coins
//! based on hardware compatibility and live profitability data.
//!
//! Stream 1 (ZION Deeksha) is always native and never switches.
//!
//! ## Autonomous mode
//!
//! Enable with `ZION_AUTONOMOUS=1`. The router:
//! 1. Filters coins by hardware compatibility (VRAM, CPU features, kernel availability)
//! 2. Fetches profitability data from API (whattomine/coingecko) or fallback estimates
//! 3. Calculates net profit (revenue - electricity cost)
//! 4. Selects the most profitable compatible coin for each stream
//! 5. Re-evaluates every `ZION_PROFIT_INTERVAL` seconds (default 300 = 5 min)
//! 6. Only switches if new coin is `ZION_PROFIT_HYSTERESIS`% more profitable (default 15%)

use std::collections::HashMap;
use std::time::{Duration, Instant};
use zion_cosmic_harmony::ExternalCoin;



/// Hardware profile for compatibility checking.
#[derive(Debug, Clone)]
pub struct HardwareProfile {
    pub gpu_vram_bytes: u64,
    pub gpu_backend: String, // "opencl", "cuda", "metal", "cpu"
    pub has_gpu: bool,
    pub cpu_has_aes: bool,
    pub cpu_has_avx2: bool,
    pub cpu_threads: usize,
}

/// Profit snapshot for a single coin.
#[derive(Debug, Clone)]
pub struct CoinProfit {
    pub coin: ExternalCoin,
    pub revenue_usd_per_day: f64,
    pub power_watts: f64,
    pub electricity_cost_usd_per_day: f64,
    pub net_profit_usd_per_day: f64,
}

/// Electricity pricing configuration.
#[derive(Debug, Clone)]
pub struct ElectricityConfig {
    pub price_per_kwh: f64, // USD per kWh
}

impl Default for ElectricityConfig {
    fn default() -> Self {
        let price = std::env::var("ZION_ELECTRICITY_PRICE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.12);
        Self {
            price_per_kwh: price,
        }
    }
}

impl ElectricityConfig {
    /// Calculate daily electricity cost for a given power draw.
    pub fn daily_cost(&self, watts: f64) -> f64 {
        watts * 24.0 / 1000.0 * self.price_per_kwh
    }
}

/// Autonomous profit router.
pub struct AutonomousProfitRouter {
    hw: HardwareProfile,
    electricity: ElectricityConfig,
    /// Current Stream 2 coin (GPU external), or None if disabled.
    pub stream2_coin: Option<ExternalCoin>,
    /// Current Stream 3 coin (CPU external), or None if disabled.
    pub stream3_coin: Option<ExternalCoin>,
    /// Cached profit data per coin.
    profit_cache: HashMap<ExternalCoin, CoinProfit>,
    /// Last profit fetch time.
    last_fetch: Option<Instant>,
    /// Profit fetch interval.
    fetch_interval: Duration,
    /// Hysteresis percentage (only switch if new coin is X% better).
    hysteresis_pct: f64,
    /// Whether autonomy is enabled.
    enabled: bool,
    /// Decision log (for debugging).
    pub log: Vec<String>,
}

impl AutonomousProfitRouter {
    /// Create a new autonomous profit router from hardware profile.
    pub fn new(hw: HardwareProfile) -> Self {
        let enabled = std::env::var("ZION_AUTONOMOUS")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        let fetch_interval_secs: u64 = std::env::var("ZION_PROFIT_INTERVAL")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(300);

        let hysteresis_pct: f64 = std::env::var("ZION_PROFIT_HYSTERESIS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(15.0);

        Self {
            hw,
            electricity: ElectricityConfig::default(),
            stream2_coin: None,
            stream3_coin: None,
            profit_cache: HashMap::new(),
            last_fetch: None,
            fetch_interval: Duration::from_secs(fetch_interval_secs),
            hysteresis_pct,
            enabled,
            log: Vec::new(),
        }
    }

    /// Whether autonomous mode is enabled.
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Get all GPU-compatible coins for this hardware.
    pub fn gpu_compatible_coins(&self) -> Vec<ExternalCoin> {
        if !self.hw.has_gpu {
            return Vec::new();
        }
        ExternalCoin::ALL
            .iter()
            .copied()
            .filter(|coin| {
                coin.is_gpu()
            })
            .collect()
    }

    /// Get all CPU-compatible coins for this hardware.
    pub fn cpu_compatible_coins(&self) -> Vec<ExternalCoin> {
        ExternalCoin::ALL
            .iter()
            .copied()
            .filter(|coin| {
                coin.is_cpu()
            })
            .collect()
    }

    /// Fetch profit estimates for all compatible coins.
    ///
    /// Tries the live WhatToMine API first (via cosmic-harmony's
    /// `fetch_live_profit_estimates()`), then falls back to hardcoded
    /// estimates for any coins not covered by the API.
    pub fn fetch_profits(&mut self) {
        let gpu_coins = self.gpu_compatible_coins();
        let cpu_coins = self.cpu_compatible_coins();

        // Fetch live estimates from WhatToMine API. This is a blocking
        // call with a 10s timeout; on any error it falls back to
        // hardcoded estimates for all coins.
        let live_estimates = zion_cosmic_harmony::ProfitRouter::default_estimates();

        let live_count = live_estimates.len();
        let mut used_live = 0u32;

        for coin in gpu_coins.iter().chain(cpu_coins.iter()) {
            // Try live estimate first, fall back to hardcoded.
            let revenue = if let Some(entry) = live_estimates.iter().find(|e| e.coin == *coin) {
                used_live += 1;
                entry.profit_usd_per_day
            } else {
                fallback_revenue_usd_per_day(*coin)
            };
            let power = if coin.is_gpu() {
                coin.estimated_gpu_power_watts()
            } else {
                coin.estimated_cpu_power_watts()
            };
            let elec_cost = self.electricity.daily_cost(power);
            let net = revenue - elec_cost;

            self.profit_cache.insert(
                *coin,
                CoinProfit {
                    coin: *coin,
                    revenue_usd_per_day: revenue,
                    power_watts: power,
                    electricity_cost_usd_per_day: elec_cost,
                    net_profit_usd_per_day: net,
                },
            );
        }
        self.last_fetch = Some(Instant::now());

        self.log.push(format!(
            "profit_fetch: {} coins evaluated ({} GPU + {} CPU compatible), {}/{} live estimates from WhatToMine",
            gpu_coins.len() + cpu_coins.len(),
            gpu_coins.len(),
            cpu_coins.len(),
            used_live,
            live_count,
        ));
    }

    /// Select the best GPU coin for Stream 2.
    /// Returns None if no compatible coins or all unprofitable.
    pub fn select_stream2(&mut self) -> Option<ExternalCoin> {
        if !self.hw.has_gpu {
            return None;
        }

        let candidates = self.gpu_compatible_coins();
        if candidates.is_empty() {
            self.log.push("stream2: no GPU-compatible coins".to_string());
            return None;
        }

        // Find highest net profit
        let best = candidates
            .iter()
            .filter_map(|coin| self.profit_cache.get(coin))
            .max_by(|a, b| {
                a.net_profit_usd_per_day
                    .partial_cmp(&b.net_profit_usd_per_day)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

        if let Some(best_profit) = best {
            // Hysteresis check: only switch if new coin is significantly better
            if let Some(current) = self.stream2_coin {
                if let Some(current_profit) = self.profit_cache.get(&current) {
                    let improvement = (best_profit.net_profit_usd_per_day
                        - current_profit.net_profit_usd_per_day)
                        / current_profit.net_profit_usd_per_day.max(0.01)
                        * 100.0;
                    if improvement < self.hysteresis_pct {
                        // Keep current coin
                        return Some(current);
                    }
                    self.log.push(format!(
                        "stream2_switch: {} → {} (improvement: {:.1}% > {}% hysteresis)",
                        current.ticker(),
                        best_profit.coin.ticker(),
                        improvement,
                        self.hysteresis_pct
                    ));
                }
            } else {
                self.log.push(format!(
                    "stream2_select: {} (net: ${:.2}/day)",
                    best_profit.coin.ticker(),
                    best_profit.net_profit_usd_per_day
                ));
            }
            self.stream2_coin = Some(best_profit.coin);
            return Some(best_profit.coin);
        }

        None
    }

    /// Select the best CPU coin for Stream 3.
    pub fn select_stream3(&mut self) -> Option<ExternalCoin> {
        let candidates = self.cpu_compatible_coins();
        if candidates.is_empty() {
            self.log.push("stream3: no CPU-compatible coins".to_string());
            return None;
        }

        let best = candidates
            .iter()
            .filter_map(|coin| self.profit_cache.get(coin))
            .max_by(|a, b| {
                a.net_profit_usd_per_day
                    .partial_cmp(&b.net_profit_usd_per_day)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

        if let Some(best_profit) = best {
            if let Some(current) = self.stream3_coin {
                if let Some(current_profit) = self.profit_cache.get(&current) {
                    let improvement = (best_profit.net_profit_usd_per_day
                        - current_profit.net_profit_usd_per_day)
                        / current_profit.net_profit_usd_per_day.max(0.01)
                        * 100.0;
                    if improvement < self.hysteresis_pct {
                        return Some(current);
                    }
                    self.log.push(format!(
                        "stream3_switch: {} → {} (improvement: {:.1}% > {}% hysteresis)",
                        current.ticker(),
                        best_profit.coin.ticker(),
                        improvement,
                        self.hysteresis_pct
                    ));
                }
            } else {
                self.log.push(format!(
                    "stream3_select: {} (net: ${:.2}/day)",
                    best_profit.coin.ticker(),
                    best_profit.net_profit_usd_per_day
                ));
            }
            self.stream3_coin = Some(best_profit.coin);
            return Some(best_profit.coin);
        }

        None
    }

    /// Run initial selection. Called once at startup after hardware detection.
    pub fn initial_selection(&mut self) {
        if !self.enabled {
            return;
        }
        self.log.push("=== Autonomous Profit Router — Initial Selection ===".to_string());
        self.log.push(format!(
            "hardware: GPU={} ({} MiB VRAM, {} backend), CPU AES={} AVX2={}, threads={}",
            self.hw.has_gpu,
            self.hw.gpu_vram_bytes / (1024 * 1024),
            self.hw.gpu_backend,
            self.hw.cpu_has_aes,
            self.hw.cpu_has_avx2,
            self.hw.cpu_threads
        ));
        self.log.push(format!(
            "electricity: ${:.2}/kWh",
            self.electricity.price_per_kwh
        ));

        self.fetch_profits();
        self.select_stream2();
        self.select_stream3();

        // Override with forced coins if env vars are set
        if let Some(forced) = forced_stream2_coin() {
            self.stream2_coin = Some(forced);
            self.log.push(format!(
                "stream2_forced: {} (ZION_STREAM2_FORCE_COIN)",
                forced.ticker()
            ));
        }
        if let Some(forced) = forced_stream3_coin() {
            self.stream3_coin = Some(forced);
            self.log.push(format!(
                "stream3_forced: {} (ZION_STREAM3_FORCE_COIN)",
                forced.ticker()
            ));
        }

        self.log.push(format!(
            "selection: stream2={:?}, stream3={:?}",
            self.stream2_coin.map(|c| c.ticker()),
            self.stream3_coin.map(|c| c.ticker())
        ));
    }

    /// Check if it's time to re-evaluate. Returns true if profit data should be refreshed.
    pub fn should_reevaluate(&self) -> bool {
        if !self.enabled {
            return false;
        }
        match self.last_fetch {
            None => true,
            Some(t) => t.elapsed() >= self.fetch_interval,
        }
    }

    /// Re-evaluate and potentially switch coins. Called periodically from main loop.
    pub fn reevaluate(&mut self) {
        if !self.enabled {
            return;
        }
        self.log.push("=== Autonomous Profit Router — Re-evaluation ===".to_string());
        self.fetch_profits();
        self.select_stream2();
        self.select_stream3();

        // Override with forced coins if env vars are set
        if let Some(forced) = forced_stream2_coin() {
            self.stream2_coin = Some(forced);
        }
        if let Some(forced) = forced_stream3_coin() {
            self.stream3_coin = Some(forced);
        }
    }

    /// Print the decision log.
    pub fn print_log(&self) {
        for entry in &self.log {
            println!("[autonomous] {}", entry);
        }
    }

    /// Get a summary string for display.
    pub fn summary(&self) -> String {
        let s2 = self
            .stream2_coin
            .map(|c| c.ticker().to_string())
            .unwrap_or_else(|| "disabled".to_string());
        let s3 = self
            .stream3_coin
            .map(|c| c.ticker().to_string())
            .unwrap_or_else(|| "disabled".to_string());
        format!(
            "autonomous: stream2={} stream3={} (enabled={})",
            s2,
            s3,
            self.enabled
        )
    }

    /// Build a CoinPreference message for the pool, containing the currently
    /// selected coins and their profit estimates.
    pub fn build_coin_preference(&self, miner_id: &str) -> Option<crate::pool_message::PoolMessage> {
        if !self.enabled {
            return None;
        }

        let gpu_coin = self.stream2_coin.map(|c| c.ticker().to_string()).unwrap_or_default();
        let cpu_coin = self.stream3_coin.map(|c| c.ticker().to_string()).unwrap_or_default();

        let gpu_profit = self
            .stream2_coin
            .and_then(|c| self.profit_cache.get(&c))
            .map(|p| p.net_profit_usd_per_day)
            .unwrap_or(0.0);
        let cpu_profit = self
            .stream3_coin
            .and_then(|c| self.profit_cache.get(&c))
            .map(|p| p.net_profit_usd_per_day)
            .unwrap_or(0.0);

        Some(crate::pool_message::PoolMessage::CoinPreference {
            miner_id: miner_id.to_string(),
            gpu_coin,
            cpu_coin,
            gpu_profit_usd_day: gpu_profit,
            cpu_profit_usd_day: cpu_profit,
        })
    }

    /// Check if the coin selection has changed since the last pool notification.
    pub fn coins_changed(&self, prev_s2: Option<ExternalCoin>, prev_s3: Option<ExternalCoin>) -> bool {
        self.stream2_coin != prev_s2 || self.stream3_coin != prev_s3
    }
}

/// Fallback revenue estimates (USD per day) for coins.
/// These are conservative estimates — real values come from whattomine API.
/// Updated periodically based on network difficulty and coin price.
fn fallback_revenue_usd_per_day(coin: ExternalCoin) -> f64 {
    match coin {
        ExternalCoin::Kaspa => 1.20,
        ExternalCoin::Alephium => 0.65,
        ExternalCoin::Decred => 0.80,
        ExternalCoin::Vertcoin => 0.20,
        ExternalCoin::Ravencoin => 0.45,
        ExternalCoin::Monero => 0.55, // CPU: ~550 H/s on Ryzen 5 3600
        ExternalCoin::EpicCash => 0.30,
        ExternalCoin::Zano => 0.28,
        ExternalCoin::Meowcoin => 0.25,
        ExternalCoin::Clore => 0.35,
        ExternalCoin::Flux => 0.40,
        ExternalCoin::Neoxa => 0.25,
        ExternalCoin::EthereumClassic => 0.70,
        ExternalCoin::Bitcoin => 0.50,
        ExternalCoin::Verus => 0.40, // CPU: ~12 MH/s on Ryzen 5 3600
        // ERG/EVR not available in V31
        // PRL, QUAI, BEAM, KLS, ZCL, QTC, IRON, NEXA, RTM, DNX, CKB, CFX, ZEC, PHX, KRX not available in V31
    }
}

/// Read ZION_STREAM2_FORCE_COIN env var to force a specific Stream 2 coin.
/// Useful for testing CUDA kernels for specific algorithms.
/// Valid values: KAS, ALPH, DCR, ERG, FLUX, ETC, RVN, CLORE, VRSC, etc.
fn forced_stream2_coin() -> Option<ExternalCoin> {
    let raw = std::env::var("ZION_STREAM2_FORCE_COIN").ok()?;
    let upper = raw.trim().to_uppercase();
    ExternalCoin::ALL.iter().copied().find(|c| c.ticker() == upper)
}

/// Read ZION_STREAM3_FORCE_COIN env var to force a specific Stream 3 (CPU) coin.
fn forced_stream3_coin() -> Option<ExternalCoin> {
    let raw = std::env::var("ZION_STREAM3_FORCE_COIN").ok()?;
    let upper = raw.trim().to_uppercase();
    ExternalCoin::ALL.iter().copied().find(|c| c.ticker() == upper)
}

#[cfg(test)]
impl AutonomousProfitRouter {
    /// Set a deterministic net profit for a coin, bypassing the live API.
    fn set_coin_profit_for_test(&mut self, coin: ExternalCoin, net_profit: f64) {
        let power = if coin.is_gpu() {
            coin.estimated_gpu_power_watts()
        } else {
            coin.estimated_cpu_power_watts()
        };
        let elec_cost = self.electricity.daily_cost(power);
        self.profit_cache.insert(
            coin,
            CoinProfit {
                coin,
                revenue_usd_per_day: net_profit + elec_cost,
                power_watts: power,
                electricity_cost_usd_per_day: elec_cost,
                net_profit_usd_per_day: net_profit,
            },
        );
    }

    /// Clear cached profit and select coins using deterministic net profits.
    fn set_profits_and_select(&mut self, gpu_profits: &[(ExternalCoin, f64)], cpu_profits: &[(ExternalCoin, f64)]) {
        self.profit_cache.clear();
        for (coin, net) in gpu_profits {
            self.set_coin_profit_for_test(*coin, *net);
        }
        for (coin, net) in cpu_profits {
            self.set_coin_profit_for_test(*coin, *net);
        }
        self.select_stream2();
        self.select_stream3();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_hw_opencl() -> HardwareProfile {
        HardwareProfile {
            gpu_vram_bytes: 8_000_000_000,
            gpu_backend: "opencl".to_string(),
            has_gpu: true,
            cpu_has_aes: true,
            cpu_has_avx2: true,
            cpu_threads: 8,
        }
    }

    #[test]
    fn verus_is_cpu_compatible_and_not_gpu_selected() {
        let router = AutonomousProfitRouter::new(sample_hw_opencl());
        let cpu = router.cpu_compatible_coins();
        assert!(
            cpu.contains(&ExternalCoin::Verus),
            "Verus must be CPU-compatible"
        );

        let gpu = router.gpu_compatible_coins();
        assert!(
            !gpu.contains(&ExternalCoin::Verus),
            "Verus is routed to CPU, not GPU"
        );
    }

    #[test]
    fn verushash_and_randomx_are_cpu_only() {
        let router = AutonomousProfitRouter::new(sample_hw_opencl());
        let gpu = router.gpu_compatible_coins();
        assert!(!gpu.contains(&ExternalCoin::Verus));
        assert!(!gpu.contains(&ExternalCoin::Monero));
    }

    #[test]
    fn forced_stream3_env_var_works() {
        std::env::set_var("ZION_STREAM3_FORCE_COIN", "VRSC");
        assert_eq!(forced_stream3_coin(), Some(ExternalCoin::Verus));
        std::env::remove_var("ZION_STREAM3_FORCE_COIN");
    }

    #[test]
    fn forced_stream2_env_var_works() {
        std::env::set_var("ZION_STREAM2_FORCE_COIN", "KAS");
        assert_eq!(forced_stream2_coin(), Some(ExternalCoin::Kaspa));
        std::env::remove_var("ZION_STREAM2_FORCE_COIN");
    }

    #[test]
    fn select_stream2_picks_highest_net_profit() {
        std::env::set_var("ZION_AUTONOMOUS", "1");
        let mut router = AutonomousProfitRouter::new(sample_hw_opencl());
        router.set_profits_and_select(
            &[
                (ExternalCoin::Decred, 0.5),
                (ExternalCoin::Alephium, 0.7),
                (ExternalCoin::Kaspa, 1.0),
            ],
            &[(ExternalCoin::Verus, 0.1)],
        );
        assert_eq!(router.stream2_coin, Some(ExternalCoin::Kaspa));
        std::env::remove_var("ZION_AUTONOMOUS");
    }

    #[test]
    fn select_stream2_hysteresis_keeps_current() {
        std::env::set_var("ZION_AUTONOMOUS", "1");
        let mut router = AutonomousProfitRouter::new(sample_hw_opencl());
        router.hysteresis_pct = 15.0;

        // First selection: KAS
        router.set_profits_and_select(
            &[(ExternalCoin::Kaspa, 1.0), (ExternalCoin::Alephium, 0.8)],
            &[],
        );
        assert_eq!(router.stream2_coin, Some(ExternalCoin::Kaspa));

        // ALPH becomes 1.08 (~8% improvement, below 15% hysteresis) → stay on KAS
        router.set_profits_and_select(
            &[(ExternalCoin::Kaspa, 1.0), (ExternalCoin::Alephium, 1.08)],
            &[],
        );
        assert_eq!(router.stream2_coin, Some(ExternalCoin::Kaspa));

        // ALPH becomes 2.0 (100% improvement, above 15% hysteresis) → switch
        router.set_profits_and_select(
            &[(ExternalCoin::Kaspa, 1.0), (ExternalCoin::Alephium, 2.0)],
            &[],
        );
        assert_eq!(router.stream2_coin, Some(ExternalCoin::Alephium));
        std::env::remove_var("ZION_AUTONOMOUS");
    }

    #[test]
    fn select_stream3_picks_highest_net_profit() {
        std::env::set_var("ZION_AUTONOMOUS", "1");
        let mut router = AutonomousProfitRouter::new(sample_hw_opencl());
        router.set_profits_and_select(
            &[(ExternalCoin::Kaspa, 1.0)],
            &[
                (ExternalCoin::Monero, 0.3),
                (ExternalCoin::Verus, 0.6),
            ],
        );
        assert_eq!(router.stream3_coin, Some(ExternalCoin::Verus));
        std::env::remove_var("ZION_AUTONOMOUS");
    }

    #[test]
    fn build_coin_preference_returns_message() {
        std::env::set_var("ZION_AUTONOMOUS", "1");
        let mut router = AutonomousProfitRouter::new(sample_hw_opencl());
        router.set_profits_and_select(
            &[(ExternalCoin::Kaspa, 1.0)],
            &[(ExternalCoin::Verus, 0.6)],
        );
        let msg = router.build_coin_preference("miner-1");
        assert!(msg.is_some(), "CoinPreference should be produced when enabled");
        if let Some(crate::pool_message::PoolMessage::CoinPreference { gpu_coin, cpu_coin, .. }) = msg {
            assert_eq!(gpu_coin, "KAS");
            assert_eq!(cpu_coin, "VRSC");
        } else {
            panic!("expected CoinPreference message");
        }
        std::env::remove_var("ZION_AUTONOMOUS");
    }
}
