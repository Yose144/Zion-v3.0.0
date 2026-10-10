//! Devfee scheduler — SRBMiner-style periodic dev-window mining.
//!
//! Every `period`, the affected stream reconnects its upstream stratum
//! session under the developer payout wallet for `window` seconds, then
//! returns to the user's wallet.  Shares found inside the window are
//! credited to the dev wallet — the standard fee mechanism used by
//! SRBMiner / lolMiner / GMiner.
//!
//! Configuration (runtime env, or baked at build time via the same vars):
//!   - `ZION_DEVFEE_WALLET`  — developer payout address. Required; without
//!     it the scheduler is disabled. Commercial builds bake the address in
//!     with `ZION_DEVFEE_WALLET=… cargo build` (see `option_env!` below);
//!     the runtime env var overrides the baked value.
//!   - `ZION_DEVFEE_PCT`     — fee percent of mining time (default `1.0`,
//!     `0` disables). Window length = pct% of the period.
//!   - `ZION_DEVFEE_PERIOD_SEC` — full cycle length (default `7200` = 2 h).
//!     At 1% the dev window is 72 s every 2 hours, like SRBMiner.
//!
//! Currently applies to the QTU/QPoW stream only (`ExternalCoin::Quantus`,
//! Stream 2) — the only external coin where a dev payout address exists.
//! The window switch happens on the stream's next stratum-client refresh,
//! so boundary timing is approximate by one auxpow round (~seconds).

use std::time::{Duration, Instant};

/// Devfee schedule state. `epoch` anchors the cycle so the dev window
/// sits at the *end* of each period — the miner earns for the user first
/// and only swaps to the dev wallet after a full period of user mining.
#[derive(Debug, Clone)]
pub struct DevFee {
    /// Developer payout wallet (e.g. `qz…` for Quantus).
    pub wallet: String,
    /// Fee percent of total mining time (e.g. 1.0).
    pub pct: f64,
    /// Full cycle length.
    pub period: Duration,
    /// Dev-mining slice inside each period (`pct/100 * period`, min 30 s).
    pub window: Duration,
    /// Cycle anchor — set at scheduler construction.
    pub epoch: Instant,
}

impl DevFee {
    /// Pure constructor used by `from_env` and tests.
    pub fn new(wallet: impl Into<String>, pct: f64, period: Duration) -> Option<Self> {
        let wallet = wallet.into();
        if wallet.is_empty() || pct <= 0.0 || period.is_zero() {
            return None;
        }
        let window = Duration::from_secs_f64(period.as_secs_f64() * pct / 100.0)
            .max(Duration::from_secs(30))
            .min(period);
        Some(Self {
            wallet,
            pct,
            period,
            window,
            epoch: Instant::now(),
        })
    }

    /// Build from environment. Runtime `ZION_DEVFEE_WALLET` wins; otherwise
    /// falls back to the value baked at compile time (commercial builds
    /// set it in the build environment). Returns `None` when disabled.
    pub fn from_env() -> Option<Self> {
        let wallet = std::env::var("ZION_DEVFEE_WALLET")
            .ok()
            .map(|w| w.trim().to_string())
            .filter(|w| !w.is_empty())
            .or_else(|| option_env!("ZION_DEVFEE_WALLET").map(|w| w.to_string()))?;
        let pct = std::env::var("ZION_DEVFEE_PCT")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(1.0);
        let period = std::env::var("ZION_DEVFEE_PERIOD_SEC")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .map(Duration::from_secs)
            .unwrap_or_else(|| Duration::from_secs(7200));
        Self::new(wallet, pct, period)
    }

    /// Devfee currently only has a Quantus payout address. Per-coin dev
    /// wallets for other external coins land here when they exist.
    pub fn applies_to(coin: zion_cosmic_harmony::ExternalCoin) -> bool {
        coin == zion_cosmic_harmony::ExternalCoin::Quantus
    }

    /// True while inside the dev window (end of each period).
    pub fn in_window(&self) -> bool {
        self.in_window_at(Instant::now())
    }

    fn in_window_at(&self, now: Instant) -> bool {
        let elapsed = now.saturating_duration_since(self.epoch).as_secs();
        let phase = elapsed % self.period.as_secs();
        phase >= self.period.as_secs() - self.window.as_secs()
    }

    /// The payout wallet that should be authorized on the upstream session
    /// right now — the dev wallet inside a window, the user's otherwise.
    pub fn effective_wallet<'a>(&'a self, user_wallet: &'a str) -> &'a str {
        if self.in_window() {
            &self.wallet
        } else {
            user_wallet
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_without_wallet_or_pct() {
        assert!(DevFee::new("", 1.0, Duration::from_secs(7200)).is_none());
        assert!(DevFee::new("qz123", 0.0, Duration::from_secs(7200)).is_none());
        assert!(DevFee::new("qz123", -1.0, Duration::from_secs(7200)).is_none());
        assert!(DevFee::new("qz123", 1.0, Duration::ZERO).is_none());
    }

    #[test]
    fn window_is_pct_of_period_with_floor() {
        let d = DevFee::new("qz123", 1.0, Duration::from_secs(7200)).unwrap();
        assert_eq!(d.window, Duration::from_secs(72));
        // Tiny periods still get a 30 s minimum window.
        let d = DevFee::new("qz123", 0.1, Duration::from_secs(600)).unwrap();
        assert_eq!(d.window, Duration::from_secs(30));
        // Window can never exceed the period.
        let d = DevFee::new("qz123", 200.0, Duration::from_secs(60)).unwrap();
        assert_eq!(d.window, Duration::from_secs(60));
    }

    #[test]
    fn window_sits_at_period_end() {
        let mut d = DevFee::new("qz123", 50.0, Duration::from_secs(100)).unwrap();
        d.epoch = Instant::now() - Duration::from_secs(75);
        // phase = 75 of 100 → inside the trailing 50 s window.
        assert!(d.in_window());
        d.epoch = Instant::now() - Duration::from_secs(10);
        assert!(!d.in_window());
        // Wraps across periods: 175 % 100 = 75 → window again.
        d.epoch = Instant::now() - Duration::from_secs(175);
        assert!(d.in_window());
    }

    #[test]
    fn effective_wallet_swaps_only_in_window() {
        let mut d = DevFee::new("qz_dev", 50.0, Duration::from_secs(100)).unwrap();
        d.epoch = Instant::now() - Duration::from_secs(75);
        assert_eq!(d.effective_wallet("zion1user"), "qz_dev");
        d.epoch = Instant::now() - Duration::from_secs(10);
        assert_eq!(d.effective_wallet("zion1user"), "zion1user");
    }

    #[test]
    fn applies_only_to_quantus() {
        assert!(DevFee::applies_to(zion_cosmic_harmony::ExternalCoin::Quantus));
        assert!(!DevFee::applies_to(zion_cosmic_harmony::ExternalCoin::Verus));
        assert!(!DevFee::applies_to(zion_cosmic_harmony::ExternalCoin::Kaspa));
    }
}
