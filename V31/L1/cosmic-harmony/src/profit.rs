//! Profit routing data for AuxPoW merged mining.
//!
//! `ExternalCoin` and `CoinProfile` are canonical here so `zion-miner`
//! (and any future consumer) uses the same definitions as the profit layer.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use zion_l1_types::Amount;

/// Mining device category for a coin / algorithm.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub enum Device {
    Cpu,
    Gpu,
    Both,
}

impl Device {
    pub fn is_compatible_with(&self, required: Device) -> bool {
        required == Device::Both || *self == required || *self == Device::Both
    }
}

/// External coin mined through AuxPoW / merged mining.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Default, serde::Serialize, serde::Deserialize)]
pub enum ExternalCoin {
    #[default]
    Kaspa,
    Alephium,
    Decred,
    Vertcoin,
    Ravencoin,
    Monero,
    EpicCash,
    Zano,
    Meowcoin,
    Clore,
    Flux,
    Neoxa,
    EthereumClassic,
    Bitcoin,
    Verus,
}

impl ExternalCoin {
    pub const ALL: &[ExternalCoin] = &[
        ExternalCoin::Kaspa,
        ExternalCoin::Alephium,
        ExternalCoin::Decred,
        ExternalCoin::Vertcoin,
        ExternalCoin::Ravencoin,
        ExternalCoin::Monero,
        ExternalCoin::EpicCash,
        ExternalCoin::Zano,
        ExternalCoin::Meowcoin,
        ExternalCoin::Clore,
        ExternalCoin::Flux,
        ExternalCoin::Neoxa,
        ExternalCoin::EthereumClassic,
        ExternalCoin::Bitcoin,
        ExternalCoin::Verus,
    ];

    pub fn as_str(&self) -> &'static str {
        match self {
            ExternalCoin::Kaspa => "KAS",
            ExternalCoin::Alephium => "ALPH",
            ExternalCoin::Decred => "DCR",
            ExternalCoin::Vertcoin => "VTC",
            ExternalCoin::Ravencoin => "RVN",
            ExternalCoin::Monero => "XMR",
            ExternalCoin::EpicCash => "EPIC",
            ExternalCoin::Zano => "ZANO",
            ExternalCoin::Meowcoin => "MEWC",
            ExternalCoin::Clore => "CLORE",
            ExternalCoin::Flux => "FLUX",
            ExternalCoin::Neoxa => "NEOX",
            ExternalCoin::EthereumClassic => "ETC",
            ExternalCoin::Bitcoin => "BTC",
            ExternalCoin::Verus => "VRSC",
        }
    }

    pub fn algorithm(&self) -> &'static str {
        match self {
            ExternalCoin::Kaspa => "kheavyhash",
            ExternalCoin::Alephium => "blake3_alph",
            ExternalCoin::Decred => "blake3_dcr",
            ExternalCoin::Vertcoin => "verthash",
            ExternalCoin::Ravencoin => "kawpow",
            ExternalCoin::Monero => "randomx",
            ExternalCoin::EpicCash => "progpow",
            ExternalCoin::Zano => "progpowz",
            ExternalCoin::Meowcoin => "meowpow",
            ExternalCoin::Clore => "kawpow",
            ExternalCoin::Flux => "zelhash",
            ExternalCoin::Neoxa => "kawpow",
            ExternalCoin::EthereumClassic => "etchash",
            ExternalCoin::Bitcoin => "sha256d",
            ExternalCoin::Verus => "verushash",
        }
    }

    /// Ticker symbol (alias for `as_str`).
    pub fn ticker(&self) -> &'static str {
        self.as_str()
    }

    /// Returns true if this coin is best mined on GPU.
    pub fn is_gpu(&self) -> bool {
        matches!(
            self,
            ExternalCoin::Kaspa
                | ExternalCoin::Alephium
                | ExternalCoin::Decred
                | ExternalCoin::Ravencoin
                | ExternalCoin::EpicCash
                | ExternalCoin::Zano
                | ExternalCoin::Meowcoin
                | ExternalCoin::Clore
                | ExternalCoin::Flux
                | ExternalCoin::Neoxa
                | ExternalCoin::EthereumClassic
                | ExternalCoin::Bitcoin
        )
    }

    /// Returns true if this coin is best mined on CPU.
    pub fn is_cpu(&self) -> bool {
        matches!(self, ExternalCoin::Monero | ExternalCoin::Verus)
    }

    /// Estimated GPU power draw in watts for this coin's algorithm.
    pub fn estimated_gpu_power_watts(&self) -> f64 {
        match self {
            ExternalCoin::Kaspa => 180.0,
            ExternalCoin::Alephium => 200.0,
            ExternalCoin::Decred => 150.0,
            ExternalCoin::Ravencoin => 170.0,
            ExternalCoin::EpicCash => 220.0,
            ExternalCoin::Zano => 220.0,
            ExternalCoin::Meowcoin => 170.0,
            ExternalCoin::Clore => 170.0,
            ExternalCoin::Flux => 160.0,
            ExternalCoin::Neoxa => 170.0,
            ExternalCoin::EthereumClassic => 200.0,
            ExternalCoin::Bitcoin => 250.0,
            _ => 0.0,
        }
    }

    /// Estimated CPU power draw in watts for this coin's algorithm.
    pub fn estimated_cpu_power_watts(&self) -> f64 {
        match self {
            ExternalCoin::Monero => 120.0,
            ExternalCoin::Verus => 90.0,
            _ => 0.0,
        }
    }
}

impl fmt::Display for ExternalCoin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for ExternalCoin {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.to_uppercase();
        for coin in Self::ALL {
            if coin.as_str() == s {
                return Ok(*coin);
            }
        }
        Err(format!("unknown external coin: {s}"))
    }
}

/// Static mining profile for an external coin.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CoinProfile {
    pub coin: ExternalCoin,
    /// Normalized hashrate unit for this algorithm (MH/s).
    pub hashrate_unit_mhs: f64,
    /// USD value of one unit of `hashrate_unit_mhs` over 24h.
    /// This is a placeholder for live profit estimates; it can be updated from an oracle.
    pub profit_per_unit_usd: f64,
    pub fee_bps: u16,
    pub enabled: bool,
    /// If true, the coin is excluded from profit switching.
    pub disabled: bool,
    /// Optional human-readable reason the coin is disabled.
    pub disabled_reason: Option<String>,
    pub stratum_urls: Vec<String>,
    /// Block reward in the coin's smallest unit.
    pub block_reward: Amount,
    /// Approximate network difficulty at 1 TH/s normalized to the unit.
    pub network_difficulty: f64,
    /// Device category this coin is mined with.
    pub device: Device,
    /// Worker name for stratum authorization.
    pub worker_name: String,
    /// Password for stratum authorization.
    pub password: String,
}

impl CoinProfile {
    /// Estimated 24h USD profit for `hashrate` units of this algorithm.
    pub fn estimate_profit(&self, hashrate: f64) -> f64 {
        if self.fee_bps >= 10_000 || !self.enabled || self.disabled {
            return 0.0;
        }
        let gross = hashrate * self.profit_per_unit_usd;
        gross * (1.0 - self.fee_bps as f64 / 10_000.0)
    }

    /// Return the coin's ticker symbol (delegates to `ExternalCoin::as_str`).
    pub fn ticker(&self) -> &'static str {
        self.coin.as_str()
    }

    /// Return the first stratum URL for this coin, or empty string if none.
    pub fn pool_address(&self) -> String {
        self.stratum_urls.first().cloned().unwrap_or_default()
    }

    /// Mark this profile as disabled with an optional reason.
    pub fn with_disabled(mut self, reason: impl Into<String>) -> Self {
        self.disabled = true;
        self.disabled_reason = Some(reason.into());
        self.enabled = false;
        self
    }

    /// Placeholder defaults for Mainnet Alpha. These are not live quotes.
    pub fn defaults() -> Vec<Self> {
        vec![
            Self::new(ExternalCoin::Kaspa, 1000.0, 0.05, Device::Gpu),
            Self::new(ExternalCoin::Alephium, 1000.0, 0.03, Device::Gpu),
            Self::new(ExternalCoin::Ravencoin, 1000.0, 0.015, Device::Gpu),
            Self::new(ExternalCoin::Zano, 1000.0, 0.012, Device::Gpu),
            Self::new(ExternalCoin::Flux, 1000.0, 0.011, Device::Gpu),
            Self::new(ExternalCoin::Monero, 1000.0, 0.025, Device::Cpu),
            Self::new(ExternalCoin::EpicCash, 1000.0, 0.020, Device::Both),
            Self::new(ExternalCoin::Verus, 1000.0, 0.018, Device::Cpu),
            Self::new(ExternalCoin::Decred, 1000.0, 0.02, Device::Gpu),
            Self::new(ExternalCoin::Vertcoin, 1000.0, 0.01, Device::Gpu),
        ]
    }

    fn new(
        coin: ExternalCoin,
        hashrate_unit_mhs: f64,
        profit_per_unit_usd: f64,
        device: Device,
    ) -> Self {
        Self {
            coin,
            hashrate_unit_mhs,
            profit_per_unit_usd,
            fee_bps: 100,
            enabled: true,
            disabled: false,
            disabled_reason: None,
            stratum_urls: vec![format!(
                "stratum+tcp://{}.pool.example:3333",
                coin.as_str().to_lowercase()
            )],
            block_reward: Amount::new(0),
            network_difficulty: 1.0,
            device,
            worker_name: String::new(),
            password: String::new(),
        }
    }
}

/// One profit entry produced for a specific rig configuration.
#[derive(Clone, Debug)]
pub struct ProfitEntry {
    pub coin: ExternalCoin,
    pub device: Device,
    pub hashrate: f64,
    pub profit_usd_per_day: f64,
    /// Whether the coin is disabled and should be skipped by the router.
    pub is_disabled: bool,
}

impl ProfitEntry {
    pub fn from_profile(profile: &CoinProfile, hashrate: f64) -> Self {
        Self {
            coin: profile.coin,
            device: profile.device,
            hashrate,
            profit_usd_per_day: profile.estimate_profit(hashrate),
            is_disabled: profile.disabled,
        }
    }
}

/// Profit-switching router for AuxPoW mining.
#[derive(Clone, Debug, Default)]
pub struct ProfitRouter {
    entries: Vec<ProfitEntry>,
}

impl ProfitRouter {
    pub fn new(entries: Vec<ProfitEntry>) -> Self {
        Self { entries }
    }

    pub fn update(&mut self, entries: Vec<ProfitEntry>) {
        self.entries = entries;
    }

    /// Return placeholder default estimates for all coins (V3 compatibility).
    ///
    /// In V3 this was `fetch_live_profit_estimates()` which called an oracle.
    /// V31 returns hardcoded placeholder estimates until a live oracle is wired.
    pub fn default_estimates() -> Vec<ProfitEntry> {
        CoinProfile::defaults()
            .into_iter()
            .map(|p| ProfitEntry::from_profile(&p, 1.0))
            .collect()
    }

    /// Return the most profitable active coin, if any.
    pub fn best(&self) -> Option<&ProfitEntry> {
        self.entries
            .iter()
            .filter(|e| !e.is_disabled)
            .max_by(|a, b| a.profit_usd_per_day.total_cmp(&b.profit_usd_per_day))
    }

    /// Return the most profitable active coin compatible with `device`.
    pub fn best_for(&self, device: Device) -> Option<&ProfitEntry> {
        self.entries
            .iter()
            .filter(|e| !e.is_disabled && e.device.is_compatible_with(device))
            .max_by(|a, b| a.profit_usd_per_day.total_cmp(&b.profit_usd_per_day))
    }

    pub fn entries(&self) -> &[ProfitEntry] {
        &self.entries
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coin_from_str() {
        assert_eq!("KAS".parse::<ExternalCoin>().unwrap(), ExternalCoin::Kaspa);
        assert!("unknown".parse::<ExternalCoin>().is_err());
    }

    #[test]
    fn router_picks_highest_profit() {
        let profiles = CoinProfile::defaults();
        let entries: Vec<_> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, 100.0))
            .collect();
        let router = ProfitRouter::new(entries);
        let best = router.best().expect("has best");
        assert_eq!(best.coin, ExternalCoin::Kaspa); // highest profit_per_unit in defaults
    }

    #[test]
    fn router_filters_by_device() {
        let profiles = CoinProfile::defaults();
        let entries: Vec<_> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, 100.0))
            .collect();
        let router = ProfitRouter::new(entries);
        let gpu = router.best_for(Device::Gpu).expect("has gpu");
        let cpu = router.best_for(Device::Cpu).expect("has cpu");
        assert_eq!(gpu.coin, ExternalCoin::Kaspa);
        assert_eq!(cpu.coin, ExternalCoin::Monero);
    }

    #[test]
    fn router_skips_disabled_coin() {
        let mut profiles = CoinProfile::defaults();
        profiles[0] = profiles[0].clone().with_disabled("test");
        let entries: Vec<_> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, 100.0))
            .collect();
        let router = ProfitRouter::new(entries);
        let best = router.best().expect("has best");
        assert_ne!(best.coin, ExternalCoin::Kaspa);
    }
}
