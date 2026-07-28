//! AuxPoW profit-switching scheduler.

use zion_cosmic_harmony::{CoinProfile, Device, ExternalCoin, ProfitEntry, ProfitRouter};

/// Manages the active AuxPoW coin selection for a mining rig.
///
/// The scheduler does not keep open stratum connections. It only selects the
/// most profitable coin/profile for the GPU and CPU streams. The `runtime`
/// creates and owns the `StratumClient` instances based on the URLs returned
/// here.
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

    /// Return the selected GPU coin and the primary stratum URL, if any.
    pub fn gpu_url(&self) -> (Option<ExternalCoin>, Option<&str>) {
        (
            self.current_gpu,
            self.profile_gpu
                .as_ref()
                .and_then(|p| p.stratum_urls.first().map(|s| s.as_str())),
        )
    }

    /// Return the selected CPU coin and the primary stratum URL, if any.
    pub fn cpu_url(&self) -> (Option<ExternalCoin>, Option<&str>) {
        (
            self.current_cpu,
            self.profile_cpu
                .as_ref()
                .and_then(|p| p.stratum_urls.first().map(|s| s.as_str())),
        )
    }
}
