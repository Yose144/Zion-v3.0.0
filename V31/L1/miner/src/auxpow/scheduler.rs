//! AuxPoW profit-switching scheduler.

use zion_cosmic_harmony::{CoinProfile, Device, ExternalCoin, ProfitEntry, ProfitRouter};

use super::StratumClient;

/// Manages the active AuxPoW coin selection for a mining rig.
#[derive(Clone, Debug)]
pub struct AuxPoWScheduler {
    hashrate: f64,
    router: ProfitRouter,
    current: Option<ExternalCoin>,
    profile: Option<CoinProfile>,
    current_gpu: Option<ExternalCoin>,
    profile_gpu: Option<CoinProfile>,
    current_cpu: Option<ExternalCoin>,
    profile_cpu: Option<CoinProfile>,
}

impl AuxPoWScheduler {
    pub fn new(hashrate: f64) -> Self {
        Self {
            hashrate,
            router: ProfitRouter::default(),
            current: None,
            profile: None,
            current_gpu: None,
            profile_gpu: None,
            current_cpu: None,
            profile_cpu: None,
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

        if let Some(best) = self.router.best_for(Device::Gpu) {
            self.current_gpu = Some(best.coin);
            self.profile_gpu = profiles.iter().find(|p| p.coin == best.coin).cloned();
        }

        if let Some(best) = self.router.best_for(Device::Cpu) {
            self.current_cpu = Some(best.coin);
            self.profile_cpu = profiles.iter().find(|p| p.coin == best.coin).cloned();
        }
    }

    /// Return the currently selected overall coin, if any.
    pub fn current(&self) -> Option<ExternalCoin> {
        self.current
    }

    /// Return the currently selected GPU coin, if any.
    pub fn current_gpu(&self) -> Option<ExternalCoin> {
        self.current_gpu
    }

    /// Return the currently selected CPU coin, if any.
    pub fn current_cpu(&self) -> Option<ExternalCoin> {
        self.current_cpu
    }

    /// Return the profile for the currently selected coin.
    pub fn profile(&self) -> Option<&CoinProfile> {
        self.profile.as_ref()
    }

    /// Return the active profit entries for monitoring.
    pub fn entries(&self) -> &[ProfitEntry] {
        self.router.entries()
    }

    /// Construct a stratum client for the currently selected coin.
    pub fn client(&self, worker: &str, password: &str) -> Option<StratumClient> {
        self.client_for(self.profile.as_ref(), worker, password)
    }

    /// Construct a stratum client for the currently selected GPU coin.
    pub fn gpu_client(&self, worker: &str, password: &str) -> Option<StratumClient> {
        self.client_for(self.profile_gpu.as_ref(), worker, password)
    }

    /// Construct a stratum client for the currently selected CPU coin.
    pub fn cpu_client(&self, worker: &str, password: &str) -> Option<StratumClient> {
        self.client_for(self.profile_cpu.as_ref(), worker, password)
    }

    fn client_for(
        &self,
        profile: Option<&CoinProfile>,
        worker: &str,
        password: &str,
    ) -> Option<StratumClient> {
        let profile = profile?;
        let url = profile.stratum_urls.first()?;
        Some(StratumClient::new(url, worker, password))
    }
}
