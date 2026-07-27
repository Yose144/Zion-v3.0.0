//! AuxPoW profit-switching scheduler.

use zion_cosmic_harmony::{CoinProfile, ExternalCoin, ProfitEntry, ProfitRouter};

use super::StratumClient;

/// Manages the active AuxPoW coin selection for a mining rig.
#[derive(Clone, Debug)]
pub struct AuxPoWScheduler {
    hashrate: f64,
    router: ProfitRouter,
    current: Option<ExternalCoin>,
    profile: Option<CoinProfile>,
}

impl AuxPoWScheduler {
    pub fn new(hashrate: f64) -> Self {
        Self {
            hashrate,
            router: ProfitRouter::default(),
            current: None,
            profile: None,
        }
    }

    /// Refresh profit estimates from `profiles` and optionally switch coins.
    pub fn refresh(&mut self, profiles: &[CoinProfile]) {
        let entries: Vec<_> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, self.hashrate))
            .collect();
        self.router.update(entries);

        if let Some(best) = self.router.best() {
            self.current = Some(best.coin);
            self.profile = profiles.iter().find(|p| p.coin == best.coin).cloned();
        }
    }

    /// Return the currently selected coin, if any.
    pub fn current(&self) -> Option<ExternalCoin> {
        self.current
    }

    /// Return the profile for the currently selected coin.
    pub fn profile(&self) -> Option<&CoinProfile> {
        self.profile.as_ref()
    }

    /// Construct a stratum client for the currently selected coin.
    pub fn client(&self, worker: &str, password: &str) -> Option<StratumClient> {
        let profile = self.profile.as_ref()?;
        let url = profile.stratum_urls.first()?;
        Some(StratumClient::new(url, worker, password))
    }

    /// Return the active profit entries for monitoring.
    pub fn entries(&self) -> &[ProfitEntry] {
        self.router.entries()
    }
}
