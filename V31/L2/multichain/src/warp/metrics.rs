use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};

/// Atomic counters for WARP metrics (thread-safe).
pub struct WarpMetrics {
    initiated: AtomicU64,
    completed: AtomicU64,
    failed: AtomicU64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MetricsSnapshot {
    pub transfers_initiated: u64,
    pub transfers_completed: u64,
    pub transfers_failed: u64,
    pub transfers_pending: u64,
    pub success_rate: f64,
}

impl WarpMetrics {
    pub fn new() -> Self {
        Self {
            initiated: AtomicU64::new(0),
            completed: AtomicU64::new(0),
            failed: AtomicU64::new(0),
        }
    }

    pub fn record_transfer_initiated(&self) {
        self.initiated.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_transfer_completed(&self) {
        self.completed.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_transfer_failed(&self) {
        self.failed.fetch_add(1, Ordering::Relaxed);
    }

    pub fn transfers_initiated(&self) -> u64 {
        self.initiated.load(Ordering::Relaxed)
    }

    pub fn transfers_completed(&self) -> u64 {
        self.completed.load(Ordering::Relaxed)
    }

    pub fn transfers_failed(&self) -> u64 {
        self.failed.load(Ordering::Relaxed)
    }

    /// Render counters and gauges in the Prometheus exposition format.
    pub fn prometheus_output(&self, node_id: &str) -> String {
        let s = self.snapshot();
        format!(
            "# HELP warp_transfers_initiated_total Total WARP transfers initiated.\n\
             # TYPE warp_transfers_initiated_total counter\n\
             warp_transfers_initiated_total{{node=\"{}\"}} {}\n\
             # HELP warp_transfers_completed_total Total WARP transfers completed.\n\
             # TYPE warp_transfers_completed_total counter\n\
             warp_transfers_completed_total{{node=\"{}\"}} {}\n\
             # HELP warp_transfers_failed_total Total WARP transfers failed.\n\
             # TYPE warp_transfers_failed_total counter\n\
             warp_transfers_failed_total{{node=\"{}\"}} {}\n\
             # HELP warp_transfers_pending Current WARP transfers pending completion.\n\
             # TYPE warp_transfers_pending gauge\n\
             warp_transfers_pending{{node=\"{}\"}} {}\n\
             # HELP warp_success_rate Ratio of completed to initiated transfers.\n\
             # TYPE warp_success_rate gauge\n\
             warp_success_rate{{node=\"{}\"}} {:.6}\n",
            node_id,
            s.transfers_initiated,
            node_id,
            s.transfers_completed,
            node_id,
            s.transfers_failed,
            node_id,
            s.transfers_pending,
            node_id,
            s.success_rate,
        )
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        let initiated = self.transfers_initiated();
        let completed = self.transfers_completed();
        let failed = self.transfers_failed();
        let pending = initiated.saturating_sub(completed).saturating_sub(failed);
        let success_rate = if initiated > 0 {
            completed as f64 / initiated as f64
        } else {
            0.0
        };

        MetricsSnapshot {
            transfers_initiated: initiated,
            transfers_completed: completed,
            transfers_failed: failed,
            transfers_pending: pending,
            success_rate,
        }
    }
}

impl Default for WarpMetrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_initial() {
        let m = WarpMetrics::new();
        assert_eq!(m.transfers_initiated(), 0);
        assert_eq!(m.transfers_completed(), 0);
        assert_eq!(m.transfers_failed(), 0);
    }

    #[test]
    fn test_metrics_increment() {
        let m = WarpMetrics::new();
        m.record_transfer_initiated();
        m.record_transfer_initiated();
        m.record_transfer_completed();
        assert_eq!(m.transfers_initiated(), 2);
        assert_eq!(m.transfers_completed(), 1);
    }

    #[test]
    fn test_metrics_snapshot() {
        let m = WarpMetrics::new();
        m.record_transfer_initiated();
        m.record_transfer_initiated();
        m.record_transfer_initiated();
        m.record_transfer_completed();
        m.record_transfer_failed();

        let snap = m.snapshot();
        assert_eq!(snap.transfers_initiated, 3);
        assert_eq!(snap.transfers_completed, 1);
        assert_eq!(snap.transfers_failed, 1);
        assert_eq!(snap.transfers_pending, 1);
        assert!((snap.success_rate - 1.0 / 3.0).abs() < 0.01);
    }

    #[test]
    fn test_metrics_snapshot_empty() {
        let m = WarpMetrics::new();
        let snap = m.snapshot();
        assert_eq!(snap.success_rate, 0.0);
        assert_eq!(snap.transfers_pending, 0);
    }

    #[test]
    fn test_metrics_serialization() {
        let m = WarpMetrics::new();
        m.record_transfer_initiated();
        let snap = m.snapshot();
        let json = serde_json::to_string(&snap).unwrap();
        assert!(json.contains("transfers_initiated"));
    }

    #[test]
    fn test_prometheus_output() {
        let m = WarpMetrics::new();
        m.record_transfer_initiated();
        m.record_transfer_completed();
        m.record_transfer_failed();
        let out = m.prometheus_output("warp-node-1");
        assert!(out.contains("# HELP warp_transfers_initiated_total"));
        assert!(out.contains("warp_transfers_initiated_total{node=\"warp-node-1\"} 1"));
        assert!(out.contains("# TYPE warp_success_rate gauge"));
    }
}
