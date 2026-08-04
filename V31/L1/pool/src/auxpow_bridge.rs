use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{mpsc, Arc, Mutex};

use zion_cosmic_harmony::ExternalCoin;

use crate::share_forwarder::ShareForwardResult;

#[derive(Clone, Debug)]
pub struct JobPackage {
    pub external_job_id: String,
    pub coin: ExternalCoin,
    pub header_hex: String,
    pub target_hex: String,
    pub height: u64,
    pub algorithm: String,
    pub extranonce1_hex: String,
    pub ntime: String,
}

#[derive(Clone, Debug)]
pub struct ShareForwardRequest {
    pub job_id: String,
    pub nonce: u64,
    pub hash_hex: String,
    pub mix_hash_hex: Option<String>,
    pub algorithm: String,
    pub header_bytes: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ShareForwardOutcome {
    Result(ShareForwardResult),
    NotEnabled,
    ChannelClosed,
}

pub struct AuxPowBridge {
    pub enabled: bool,
    pub job_queue: Arc<Mutex<VecDeque<JobPackage>>>,
    share_tx: mpsc::Sender<(ShareForwardRequest, mpsc::Sender<ShareForwardOutcome>)>,
    touch_tx: mpsc::Sender<String>,
}

impl AuxPowBridge {
    #[allow(clippy::type_complexity)]
    pub fn new(enabled: bool) -> (
        Self,
        mpsc::Receiver<(ShareForwardRequest, mpsc::Sender<ShareForwardOutcome>)>,
        mpsc::Receiver<String>,
    ) {
        let (share_tx, share_rx) = mpsc::channel();
        let (touch_tx, touch_rx) = mpsc::channel();
        let bridge = Self {
            enabled,
            job_queue: Arc::new(Mutex::new(VecDeque::new())),
            share_tx,
            touch_tx,
        };
        (bridge, share_rx, touch_rx)
    }

    pub fn touch_job_timestamp(&self, job_id: &str) {
        if !self.enabled {
            return;
        }
        let _ = self.touch_tx.send(job_id.to_string());
    }

    pub fn pop_job(&self) -> Option<JobPackage> {
        if !self.enabled {
            return None;
        }
        let q = self.job_queue.lock().expect("auxpow job queue lock poisoned");
        q.front().cloned()
    }

    pub fn get_job_by_id(&self, job_id: &str) -> Option<JobPackage> {
        if !self.enabled {
            return None;
        }
        let q = self.job_queue.lock().expect("auxpow job queue lock poisoned");
        q.iter().find(|j| j.external_job_id == job_id).cloned()
    }

    pub fn push_job(&self, job: JobPackage) {
        if !self.enabled {
            return;
        }
        let mut q = self.job_queue.lock().expect("auxpow job queue lock poisoned");
        if q.len() >= 5 {
            q.pop_front();
        }
        q.push_back(job);
    }

    pub fn forward(&self, req: ShareForwardRequest) -> Option<ShareForwardOutcome> {
        if !self.enabled {
            return Some(ShareForwardOutcome::NotEnabled);
        }
        let (tx, rx) = mpsc::channel();
        if self.share_tx.send((req, tx)).is_err() {
            return Some(ShareForwardOutcome::ChannelClosed);
        }
        rx.recv().ok()
    }
}

pub struct MultiAuxPowBridge {
    bridges: Arc<Mutex<HashMap<ExternalCoin, AuxPowBridge>>>,
    cpu_coins: HashSet<ExternalCoin>,
}

impl Clone for MultiAuxPowBridge {
    fn clone(&self) -> Self {
        Self {
            bridges: Arc::clone(&self.bridges),
            cpu_coins: self.cpu_coins.clone(),
        }
    }
}

impl MultiAuxPowBridge {
    pub fn new() -> Self {
        Self {
            bridges: Arc::new(Mutex::new(HashMap::new())),
            cpu_coins: Self::default_cpu_coins(),
        }
    }

    fn default_cpu_coins() -> HashSet<ExternalCoin> {
        let mut s = HashSet::new();
        s.insert(ExternalCoin::Monero);
        s.insert(ExternalCoin::Verus);
        s
    }

    pub fn is_cpu_coin(&self, coin: &ExternalCoin) -> bool {
        self.cpu_coins.contains(coin)
    }

    pub fn insert(&self, coin: ExternalCoin, bridge: AuxPowBridge) {
        self.bridges
            .lock()
            .expect("multi_bridge lock poisoned")
            .insert(coin, bridge);
    }

    pub fn contains(&self, coin: &ExternalCoin) -> bool {
        self.bridges
            .lock()
            .expect("multi_bridge lock poisoned")
            .contains_key(coin)
    }

    pub fn enabled_coins(&self) -> Vec<ExternalCoin> {
        self.bridges
            .lock()
            .expect("multi_bridge lock poisoned")
            .keys()
            .copied()
            .collect()
    }

    pub fn touch_job_timestamp(&self, coin: &ExternalCoin, job_id: &str) {
        if let Some(bridge) = self
            .bridges
            .lock()
            .expect("multi_bridge lock poisoned")
            .get(coin)
        {
            bridge.touch_job_timestamp(job_id);
        }
    }

    pub fn pop_job_for_coin(&self, coin: &ExternalCoin) -> Option<JobPackage> {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        bridges.get(coin).and_then(|b| b.pop_job())
    }

    pub fn pop_any_gpu_job(&self) -> Option<JobPackage> {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        for (coin, bridge) in bridges.iter() {
            if !self.is_cpu_coin(coin) {
                if let Some(job) = bridge.pop_job() {
                    return Some(job);
                }
            }
        }
        None
    }

    pub fn pop_any_cpu_job(&self) -> Option<JobPackage> {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        for (coin, bridge) in bridges.iter() {
            if self.is_cpu_coin(coin) {
                if let Some(job) = bridge.pop_job() {
                    return Some(job);
                }
            }
        }
        None
    }

    pub fn job_ids_for_coin(&self, coin: &ExternalCoin) -> Vec<String> {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        bridges.get(coin).map(|b| {
            let q = b.job_queue.lock().expect("auxpow job queue lock poisoned");
            q.iter().map(|j| j.external_job_id.clone()).collect()
        }).unwrap_or_default()
    }

    pub fn forward(
        &self,
        coin: &ExternalCoin,
        req: ShareForwardRequest,
    ) -> Option<ShareForwardOutcome> {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        bridges.get(coin).and_then(|b| b.forward(req))
    }

    /// Push a job to the bridge for a specific coin.
    pub fn push_job_for_coin(&self, coin: &ExternalCoin, job: JobPackage) {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        if let Some(bridge) = bridges.get(coin) {
            bridge.push_job(job);
        }
    }

    /// Get the latest job for a specific coin.
    pub fn latest_job_for_coin(&self, coin: &ExternalCoin) -> Option<JobPackage> {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        bridges.get(coin).and_then(|b| b.pop_job())
    }

    /// Get a job by coin and external job ID.
    pub fn job_for_coin_and_id(&self, coin: &ExternalCoin, job_id: &str) -> Option<JobPackage> {
        let bridges = self.bridges.lock().expect("multi_bridge lock poisoned");
        bridges.get(coin).and_then(|b| b.get_job_by_id(job_id))
    }

    /// Forward a share by coin ticker string.
    pub fn forward_by_ticker(
        &self,
        ticker: &str,
        req: ShareForwardRequest,
    ) -> Option<ShareForwardOutcome> {
        let coin = ExternalCoin::from_str_loose(ticker)?;
        self.forward(&coin, req)
    }
}

impl Default for MultiAuxPowBridge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_disabled_returns_none() {
        let (bridge, _rx, _touch) = AuxPowBridge::new(false);
        assert!(bridge.pop_job().is_none());
        assert_eq!(
            bridge.forward(ShareForwardRequest {
                job_id: "test".into(),
                nonce: 0,
                hash_hex: "00".into(),
                mix_hash_hex: None,
                algorithm: "blake3".into(),
                header_bytes: vec![],
            }),
            Some(ShareForwardOutcome::NotEnabled)
        );
    }

    #[test]
    fn bridge_enabled_push_pop() {
        let (bridge, _rx, _touch) = AuxPowBridge::new(true);
        let job = JobPackage {
            external_job_id: "job1".into(),
            coin: ExternalCoin::Decred,
            header_hex: "deadbeef".into(),
            target_hex: "ffff".into(),
            height: 100,
            algorithm: "blake3".into(),
            extranonce1_hex: "00".into(),
            ntime: "00000000".into(),
        };
        bridge.push_job(job.clone());
        let popped = bridge.pop_job().unwrap();
        assert_eq!(popped.external_job_id, "job1");
        assert_eq!(popped.coin, ExternalCoin::Decred);
    }

    #[test]
    fn bridge_queue_caps_at_five() {
        let (bridge, _rx, _touch) = AuxPowBridge::new(true);
        for i in 0..7 {
            bridge.push_job(JobPackage {
                external_job_id: format!("job{i}"),
                coin: ExternalCoin::Decred,
                header_hex: String::new(),
                target_hex: String::new(),
                height: 0,
                algorithm: "blake3".into(),
                extranonce1_hex: String::new(),
                ntime: String::new(),
            });
        }
        let q = bridge.job_queue.lock().unwrap();
        assert_eq!(q.len(), 5);
        assert_eq!(q.front().unwrap().external_job_id, "job2");
    }

    #[test]
    fn multi_bridge_cpu_classification() {
        let multi = MultiAuxPowBridge::new();
        assert!(multi.is_cpu_coin(&ExternalCoin::Monero));
        assert!(multi.is_cpu_coin(&ExternalCoin::Verus));
        assert!(!multi.is_cpu_coin(&ExternalCoin::Decred));
        assert!(!multi.is_cpu_coin(&ExternalCoin::Kaspa));
    }

    #[test]
    fn multi_bridge_insert_and_pop() {
        let multi = MultiAuxPowBridge::new();
        let (bridge, _rx, _touch) = AuxPowBridge::new(true);
        bridge.push_job(JobPackage {
            external_job_id: "ext1".into(),
            coin: ExternalCoin::Kaspa,
            header_hex: "abc".into(),
            target_hex: "fff".into(),
            height: 200,
            algorithm: "kheavyhash".into(),
            extranonce1_hex: String::new(),
            ntime: String::new(),
        });
        multi.insert(ExternalCoin::Kaspa, bridge);
        assert!(multi.contains(&ExternalCoin::Kaspa));
        let job = multi.pop_job_for_coin(&ExternalCoin::Kaspa).unwrap();
        assert_eq!(job.external_job_id, "ext1");
        assert!(multi.pop_any_cpu_job().is_none());
    }

    #[test]
    fn multi_bridge_get_job_by_id() {
        let (bridge, _rx, _touch) = AuxPowBridge::new(true);
        bridge.push_job(JobPackage {
            external_job_id: "findme".into(),
            coin: ExternalCoin::Ravencoin,
            header_hex: String::new(),
            target_hex: String::new(),
            height: 0,
            algorithm: "kawpow".into(),
            extranonce1_hex: String::new(),
            ntime: String::new(),
        });
        let job = bridge.get_job_by_id("findme").unwrap();
        assert_eq!(job.coin, ExternalCoin::Ravencoin);
        assert!(bridge.get_job_by_id("nonexistent").is_none());
    }
}
