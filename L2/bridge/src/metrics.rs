//! Bridge metrics and monitoring.

use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Runtime metrics for the bridge relay.
#[derive(Debug)]
pub struct BridgeMetrics {
    start_time: Instant,

    // Counters
    pub l1_locks_detected: AtomicU64,
    pub l1_locks_finalized: AtomicU64,
    pub evm_mints_submitted: AtomicU64,
    pub evm_mints_confirmed: AtomicU64,

    pub evm_burns_detected: AtomicU64,
    pub l1_unlocks_submitted: AtomicU64,
    pub l1_unlocks_confirmed: AtomicU64,

    pub errors: AtomicU64,
    pub l1_poll_count: AtomicU64,
    pub evm_poll_count: AtomicU64,

    // Last processed heights
    pub last_l1_height: AtomicU64,
    pub last_evm_block: AtomicU64,
}

impl BridgeMetrics {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            start_time: Instant::now(),
            l1_locks_detected: AtomicU64::new(0),
            l1_locks_finalized: AtomicU64::new(0),
            evm_mints_submitted: AtomicU64::new(0),
            evm_mints_confirmed: AtomicU64::new(0),
            evm_burns_detected: AtomicU64::new(0),
            l1_unlocks_submitted: AtomicU64::new(0),
            l1_unlocks_confirmed: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            l1_poll_count: AtomicU64::new(0),
            evm_poll_count: AtomicU64::new(0),
            last_l1_height: AtomicU64::new(0),
            last_evm_block: AtomicU64::new(0),
        })
    }

    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            uptime_secs: self.uptime_secs(),
            l1_locks_detected: self.l1_locks_detected.load(Ordering::Relaxed),
            l1_locks_finalized: self.l1_locks_finalized.load(Ordering::Relaxed),
            evm_mints_submitted: self.evm_mints_submitted.load(Ordering::Relaxed),
            evm_mints_confirmed: self.evm_mints_confirmed.load(Ordering::Relaxed),
            evm_burns_detected: self.evm_burns_detected.load(Ordering::Relaxed),
            l1_unlocks_submitted: self.l1_unlocks_submitted.load(Ordering::Relaxed),
            l1_unlocks_confirmed: self.l1_unlocks_confirmed.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
            last_l1_height: self.last_l1_height.load(Ordering::Relaxed),
            last_evm_block: self.last_evm_block.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct MetricsSnapshot {
    pub uptime_secs: u64,
    pub l1_locks_detected: u64,
    pub l1_locks_finalized: u64,
    pub evm_mints_submitted: u64,
    pub evm_mints_confirmed: u64,
    pub evm_burns_detected: u64,
    pub l1_unlocks_submitted: u64,
    pub l1_unlocks_confirmed: u64,
    pub errors: u64,
    pub last_l1_height: u64,
    pub last_evm_block: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_initial_state() {
        let m = BridgeMetrics::new();
        let snap = m.snapshot();
        assert_eq!(snap.l1_locks_detected, 0);
        assert_eq!(snap.l1_locks_finalized, 0);
        assert_eq!(snap.evm_mints_submitted, 0);
        assert_eq!(snap.evm_burns_detected, 0);
        assert_eq!(snap.errors, 0);
        assert_eq!(snap.last_l1_height, 0);
        assert_eq!(snap.last_evm_block, 0);
    }

    #[test]
    fn test_metrics_counters() {
        let m = BridgeMetrics::new();

        m.l1_locks_detected.fetch_add(5, Ordering::Relaxed);
        m.l1_locks_finalized.fetch_add(3, Ordering::Relaxed);
        m.evm_mints_submitted.fetch_add(3, Ordering::Relaxed);
        m.evm_mints_confirmed.fetch_add(2, Ordering::Relaxed);
        m.evm_burns_detected.fetch_add(1, Ordering::Relaxed);
        m.errors.fetch_add(1, Ordering::Relaxed);
        m.last_l1_height.store(12345, Ordering::Relaxed);
        m.last_evm_block.store(99999, Ordering::Relaxed);

        let snap = m.snapshot();
        assert_eq!(snap.l1_locks_detected, 5);
        assert_eq!(snap.l1_locks_finalized, 3);
        assert_eq!(snap.evm_mints_submitted, 3);
        assert_eq!(snap.evm_mints_confirmed, 2);
        assert_eq!(snap.evm_burns_detected, 1);
        assert_eq!(snap.errors, 1);
        assert_eq!(snap.last_l1_height, 12345);
        assert_eq!(snap.last_evm_block, 99999);
    }

    #[test]
    fn test_metrics_uptime() {
        let m = BridgeMetrics::new();
        // Should be at least 0 seconds since creation
        assert!(m.uptime_secs() < 5);
    }

    #[test]
    fn test_metrics_snapshot_serialization() {
        let m = BridgeMetrics::new();
        m.l1_locks_detected.fetch_add(10, Ordering::Relaxed);
        let snap = m.snapshot();
        let json = serde_json::to_string(&snap).unwrap();
        assert!(json.contains("\"l1_locks_detected\":10"));
    }

    #[test]
    fn test_metrics_thread_safe() {
        use std::thread;
        let m = BridgeMetrics::new();
        let m2 = m.clone();

        let handle = thread::spawn(move || {
            for _ in 0..1000 {
                m2.l1_locks_detected.fetch_add(1, Ordering::Relaxed);
            }
        });

        for _ in 0..1000 {
            m.l1_locks_detected.fetch_add(1, Ordering::Relaxed);
        }

        handle.join().unwrap();
        assert_eq!(m.l1_locks_detected.load(Ordering::Relaxed), 2000);
    }
}
