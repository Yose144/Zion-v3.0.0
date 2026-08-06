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
    stream2_force_coin: Option<ExternalCoin>,
    stream3_force_coin: Option<ExternalCoin>,
    current: Option<ExternalCoin>,
    profile: Option<CoinProfile>,
    current_gpu: Option<ExternalCoin>,
    profile_gpu: Option<CoinProfile>,
    current_cpu: Option<ExternalCoin>,
    profile_cpu: Option<CoinProfile>,
}

impl AuxPoWScheduler {
    pub fn new(
        hashrate: f64,
        stream2_force_coin: Option<ExternalCoin>,
        stream3_force_coin: Option<ExternalCoin>,
    ) -> Self {
        Self {
            hashrate,
            router: ProfitRouter::default(),
            stream2_force_coin,
            stream3_force_coin,
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

        if let Some(coin) = self.stream2_force_coin {
            // Forced coins override the profit/device heuristic as long as the
            // coin exists in the active profile set.
            if let Some(profile) = profiles.iter().find(|p| p.coin == coin && p.enabled) {
                self.current_gpu = Some(coin);
                self.profile_gpu = Some(profile.clone());
            }
        }

        if self.current_gpu.is_none() {
            if let Some(best) = self.router.best_for(Device::Gpu) {
                self.current_gpu = Some(best.coin);
                self.profile_gpu = profiles.iter().find(|p| p.coin == best.coin).cloned();
            }
        }

        if let Some(coin) = self.stream3_force_coin {
            // Forced coins override the profit/device heuristic as long as the
            // coin exists in the active profile set.
            if let Some(profile) = profiles.iter().find(|p| p.coin == coin && p.enabled) {
                self.current_cpu = Some(coin);
                self.profile_cpu = Some(profile.clone());
            }
        }

        if self.current_cpu.is_none() {
            if let Some(best) = self.router.best_for(Device::Cpu) {
                self.current_cpu = Some(best.coin);
                self.profile_cpu = profiles.iter().find(|p| p.coin == best.coin).cloned();
            }
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

    /// Return the profile for the currently selected GPU coin.
    pub fn profile_gpu(&self) -> Option<&CoinProfile> {
        self.profile_gpu.as_ref()
    }

    /// Return the profile for the currently selected CPU coin.
    pub fn profile_cpu(&self) -> Option<&CoinProfile> {
        self.profile_cpu.as_ref()
    }

    /// Return the active profit entries for monitoring.
    pub fn entries(&self) -> &[ProfitEntry] {
        self.router.entries()
    }

    /// Set the active GPU coin and matching profile, if the coin is compatible.
    pub fn set_gpu(&mut self, coin: ExternalCoin, profiles: &[CoinProfile]) {
        if let Some(profile) = profiles
            .iter()
            .find(|p| p.coin == coin && p.enabled && p.device.is_compatible_with(Device::Gpu))
        {
            self.current_gpu = Some(coin);
            self.profile_gpu = Some(profile.clone());
        } else {
            self.current_gpu = None;
            self.profile_gpu = None;
        }
    }

    /// Set the active CPU coin and matching profile, if the coin is compatible.
    pub fn set_cpu(&mut self, coin: ExternalCoin, profiles: &[CoinProfile]) {
        if let Some(profile) = profiles
            .iter()
            .find(|p| p.coin == coin && p.enabled && p.device.is_compatible_with(Device::Cpu))
        {
            self.current_cpu = Some(coin);
            self.profile_cpu = Some(profile.clone());
        } else {
            self.current_cpu = None;
            self.profile_cpu = None;
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream2_force_coin_overrides_profit_router() {
        let mut scheduler = AuxPoWScheduler::new(1000.0, Some(ExternalCoin::Kaspa), None);
        let profiles = CoinProfile::defaults();
        scheduler.refresh(&profiles);

        assert_eq!(scheduler.current_gpu(), Some(ExternalCoin::Kaspa));
        assert!(scheduler.profile_gpu().is_some());
        assert!(scheduler.gpu_url().1.is_some());
    }

    #[test]
    fn stream3_force_coin_overrides_profit_router() {
        let mut scheduler = AuxPoWScheduler::new(1000.0, None, Some(ExternalCoin::Verus));
        let profiles = CoinProfile::defaults();
        scheduler.refresh(&profiles);

        assert_eq!(scheduler.current_cpu(), Some(ExternalCoin::Verus));
        assert!(scheduler.profile_cpu().is_some());
        assert!(scheduler.cpu_url().1.is_some());
    }

    #[test]
    fn stream3_force_coin_allows_gpu_coin_on_cpu() {
        // kHeavyHash (KAS) is a GPU coin by default, but the CPU scanner
        // supports it.  A forced stream3 coin should be accepted even if the
        // profile's device category is not CPU.
        let mut scheduler = AuxPoWScheduler::new(1000.0, None, Some(ExternalCoin::Kaspa));
        let profiles = CoinProfile::defaults();
        scheduler.refresh(&profiles);

        assert_eq!(scheduler.current_cpu(), Some(ExternalCoin::Kaspa));
        assert!(scheduler.profile_cpu().is_some());
        assert!(scheduler.cpu_url().1.is_some());
    }

    #[test]
    fn stream3_force_coin_falls_back_when_not_in_profiles() {
        let mut scheduler = AuxPoWScheduler::new(1000.0, None, Some(ExternalCoin::Verus));
        let profiles: Vec<_> = CoinProfile::defaults()
            .into_iter()
            .filter(|p| p.coin == ExternalCoin::Kaspa)
            .collect();
        scheduler.refresh(&profiles);

        assert_eq!(scheduler.current_cpu(), None);
    }
}
