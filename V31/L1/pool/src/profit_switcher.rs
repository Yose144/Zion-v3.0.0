//! Pool-side profit switcher — selects the most profitable external coin
//! for the GPU and CPU triple-stream slots, with hysteresis to prevent flapping.
//!
//! Ported from V3/L1/pool/src/bin/server.rs `PoolProfitSwitchState` (lines 870-916).
//! Uses `ProfitRouter` from `zion-cosmic-harmony` for profit estimates.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use zion_cosmic_harmony::{CoinProfile, Device, ExternalCoin, ProfitEntry, ProfitRouter};

/// State for the pool-side profit switcher.
pub struct PoolProfitSwitchState {
    /// Current GPU coin selection.
    current_gpu_coin: Option<ExternalCoin>,
    /// Current CPU coin selection.
    current_cpu_coin: Option<ExternalCoin>,
    /// Last profit estimate for GPU coin (USD/day).
    last_gpu_profit: f64,
    /// Last profit estimate for CPU coin (USD/day).
    last_cpu_profit: f64,
    /// Hysteresis percentage (0.0-100.0). A new coin must be at least
    /// `hysteresis_pct`% more profitable than the current coin to switch.
    hysteresis_pct: f64,
    /// Check interval.
    check_interval: Duration,
    /// Last check time.
    last_check: Instant,
    /// Profit router with current estimates.
    router: ProfitRouter,
}

impl PoolProfitSwitchState {
    /// Create a new profit switcher with the given hysteresis and interval.
    pub fn new(hysteresis_pct: f64, check_interval_secs: u64) -> Self {
        Self {
            current_gpu_coin: None,
            current_cpu_coin: None,
            last_gpu_profit: 0.0,
            last_cpu_profit: 0.0,
            hysteresis_pct,
            check_interval: Duration::from_secs(check_interval_secs),
            last_check: Instant::now() - Duration::from_secs(3600), // Force first check
            router: ProfitRouter::new(ProfitRouter::default_estimates()),
        }
    }

    /// Create from env vars.
    pub fn from_env() -> Self {
        let hysteresis = std::env::var("ZION_POOL_PROFIT_HYSTERESIS")
            .ok()
            .and_then(|s| s.trim().parse().ok())
            .unwrap_or(15.0);
        let interval = std::env::var("ZION_POOL_PROFIT_INTERVAL")
            .ok()
            .and_then(|s| s.trim().parse().ok())
            .unwrap_or(300);
        Self::new(hysteresis, interval)
    }

    /// Update profit estimates from CoinProfile defaults.
    /// In the future, this would fetch live estimates from an oracle.
    pub fn update_estimates(&mut self, profiles: &[CoinProfile]) {
        let entries: Vec<ProfitEntry> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, 1.0))
            .collect();
        self.router.update(entries);
    }

    /// Check if it's time to re-evaluate coin selection.
    pub fn should_check(&self) -> bool {
        Instant::now().duration_since(self.last_check) >= self.check_interval
    }

    /// Run a profit check and potentially switch coins.
    /// Returns true if the selection changed.
    pub fn check_and_switch(&mut self) -> bool {
        self.last_check = Instant::now();

        // Update estimates from defaults (placeholder for live oracle)
        let profiles = CoinProfile::defaults();
        self.update_estimates(&profiles);

        let mut changed = false;

        // GPU coin selection
        if let Some(best_gpu) = self.router.best_for(Device::Gpu) {
            let should_switch = match self.current_gpu_coin {
                None => true,
                Some(current) => {
                    if current == best_gpu.coin {
                        false
                    } else {
                        // Hysteresis: new coin must be hysteresis_pct% more profitable
                        let threshold = self.last_gpu_profit * (1.0 + self.hysteresis_pct / 100.0);
                        best_gpu.profit_usd_per_day > threshold
                    }
                }
            };

            if should_switch {
                tracing::info!(
                    "profit_switch: GPU {} → {} (profit: {:.2} → {:.2} USD/day, hysteresis: {:.0}%)",
                    self.current_gpu_coin.map(|c| c.as_str().to_string()).unwrap_or_else(|| "none".into()),
                    best_gpu.coin.as_str(),
                    self.last_gpu_profit,
                    best_gpu.profit_usd_per_day,
                    self.hysteresis_pct
                );
                self.current_gpu_coin = Some(best_gpu.coin);
                self.last_gpu_profit = best_gpu.profit_usd_per_day;
                changed = true;
            }
        }

        // CPU coin selection
        if let Some(best_cpu) = self.router.best_for(Device::Cpu) {
            let should_switch = match self.current_cpu_coin {
                None => true,
                Some(current) => {
                    if current == best_cpu.coin {
                        false
                    } else {
                        let threshold = self.last_cpu_profit * (1.0 + self.hysteresis_pct / 100.0);
                        best_cpu.profit_usd_per_day > threshold
                    }
                }
            };

            if should_switch {
                tracing::info!(
                    "profit_switch: CPU {} → {} (profit: {:.2} → {:.2} USD/day)",
                    self.current_cpu_coin.map(|c| c.as_str().to_string()).unwrap_or_else(|| "none".into()),
                    best_cpu.coin.as_str(),
                    self.last_cpu_profit,
                    best_cpu.profit_usd_per_day
                );
                self.current_cpu_coin = Some(best_cpu.coin);
                self.last_cpu_profit = best_cpu.profit_usd_per_day;
                changed = true;
            }
        }

        changed
    }

    /// Get the current GPU coin selection.
    pub fn current_gpu_coin(&self) -> Option<ExternalCoin> {
        self.current_gpu_coin
    }

    /// Get the current CPU coin selection.
    pub fn current_cpu_coin(&self) -> Option<ExternalCoin> {
        self.current_cpu_coin
    }

    /// Get the current GPU profit estimate.
    pub fn last_gpu_profit(&self) -> f64 {
        self.last_gpu_profit
    }

    /// Get the current CPU profit estimate.
    pub fn last_cpu_profit(&self) -> f64 {
        self.last_cpu_profit
    }

    /// Get the check interval.
    pub fn check_interval(&self) -> Duration {
        self.check_interval
    }

    /// Get the hysteresis percentage.
    pub fn hysteresis_pct(&self) -> f64 {
        self.hysteresis_pct
    }
}

/// Shared profit switcher state (Arc<Mutex> for thread-safe access).
pub type SharedProfitSwitchState = Arc<Mutex<PoolProfitSwitchState>>;

/// Spawn a background task that periodically checks and switches coins.
pub fn spawn_profit_switcher(state: SharedProfitSwitchState) {
    let interval = {
        let s = state.lock().unwrap();
        s.check_interval()
    };

    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .thread_name("profit-switcher")
            .build()
        {
            Ok(rt) => rt,
            Err(e) => {
                tracing::error!("profit_switcher: failed to create runtime: {}", e);
                return;
            }
        };
        rt.block_on(async move {
            loop {
                tokio::time::sleep(interval).await;
                let mut s = state.lock().unwrap();
                s.check_and_switch();
            }
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profit_switcher_initializes() {
        let state = PoolProfitSwitchState::new(15.0, 300);
        assert!(state.current_gpu_coin().is_none());
        assert!(state.current_cpu_coin().is_none());
        assert!((state.hysteresis_pct() - 15.0).abs() < 0.01);
    }

    #[test]
    fn profit_switcher_selects_best_on_first_check() {
        let mut state = PoolProfitSwitchState::new(15.0, 300);
        let changed = state.check_and_switch();
        assert!(changed);
        assert!(state.current_gpu_coin().is_some());
        assert!(state.current_cpu_coin().is_some());
    }

    #[test]
    fn profit_switcher_hysteresis_prevents_flapping() {
        let mut state = PoolProfitSwitchState::new(50.0, 300);
        // First check selects best coins
        state.check_and_switch();
        let first_gpu = state.current_gpu_coin();
        let first_gpu_profit = state.last_gpu_profit();

        // Second check — with 50% hysteresis, should not switch unless
        // a coin is 50% more profitable. With placeholder estimates,
        // the same coins should remain selected.
        state.check_and_switch();
        assert_eq!(state.current_gpu_coin(), first_gpu);
        // Profit should be the same (same coin selected)
        assert!((state.last_gpu_profit() - first_gpu_profit).abs() < 0.001);
    }

    #[test]
    fn profit_switcher_should_check_after_interval() {
        let state = PoolProfitSwitchState::new(15.0, 0); // 0 second interval
        // Should always be ready to check with 0 interval
        assert!(state.should_check());
    }

    #[test]
    fn profit_switcher_from_env() {
        std::env::set_var("ZION_POOL_PROFIT_HYSTERESIS", "20");
        std::env::set_var("ZION_POOL_PROFIT_INTERVAL", "60");
        let state = PoolProfitSwitchState::from_env();
        assert!((state.hysteresis_pct() - 20.0).abs() < 0.01);
        assert_eq!(state.check_interval(), Duration::from_secs(60));
        std::env::remove_var("ZION_POOL_PROFIT_HYSTERESIS");
        std::env::remove_var("ZION_POOL_PROFIT_INTERVAL");
    }
}
