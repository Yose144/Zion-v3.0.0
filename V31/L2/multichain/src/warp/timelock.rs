//! Timelock Monitor
//!
//! Background task that automatically releases transfers from TimelockHold
//! after the configured hold period (default 24 hours).

use crate::warp::error::WarpResult;
use crate::warp::router::WarpRouter;
use crate::warp::types::WarpStatus;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time;
use tracing::{debug, info, warn};

/// Default timelock hold duration: 24 hours
const DEFAULT_TIMELOCK_SECS: u64 = 24 * 60 * 60;

/// How often to check for expired timelocks (seconds)
const CHECK_INTERVAL_SECS: u64 = 60 * 60; // 1 hour

/// Monitor that automatically releases timed-out transfers from TimelockHold
pub struct TimelockMonitor {
    router: Arc<Mutex<WarpRouter>>,
    hold_duration_secs: u64,
}

impl TimelockMonitor {
    pub fn new(router: Arc<Mutex<WarpRouter>>, hold_duration_secs: u64) -> Self {
        Self {
            router,
            hold_duration_secs,
        }
    }

    pub fn default(router: Arc<Mutex<WarpRouter>>) -> Self {
        Self::new(router, DEFAULT_TIMELOCK_SECS)
    }

    /// Run the monitor loop forever
    pub async fn run(self) {
        info!(
            "[Timelock] Starting timelock monitor (hold: {}s, check interval: {}s)",
            self.hold_duration_secs, CHECK_INTERVAL_SECS
        );

        let mut interval = time::interval(Duration::from_secs(CHECK_INTERVAL_SECS));

        loop {
            interval.tick().await;
            if let Err(e) = self.check_and_release().await {
                warn!("[Timelock] Check failed: {}", e);
            }
        }
    }

    /// Check all transfers in TimelockHold and release expired ones
    async fn check_and_release(&self) -> WarpResult<()> {
        let now = chrono::Utc::now().timestamp() as u64;

        // First, collect IDs of transfers that need to be released
        let to_release: Vec<_> = {
            let router = self.router.lock().await;
            router
                .list_pending()
                .into_iter()
                .filter(|t| t.status == WarpStatus::TimelockHold)
                .filter(|t| {
                    let hold_start = t.created_at.timestamp() as u64;
                    now.saturating_sub(hold_start) >= self.hold_duration_secs
                })
                .map(|t| t.id)
                .collect()
        };

        if to_release.is_empty() {
            debug!("[Timelock] No expired timelocks");
            return Ok(());
        }

        info!(
            "[Timelock] Releasing {} expired timelock(s)",
            to_release.len()
        );

        for transfer_id in to_release {
            let mut router = self.router.lock().await;
            if let Err(e) = router.advance_transfer(transfer_id, WarpStatus::Detected) {
                warn!(
                    "[Timelock] Failed to release transfer {}: {}",
                    transfer_id, e
                );
            } else {
                info!("[Timelock] Released transfer {} from timelock", transfer_id);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::fees::FeeEngine;
    use crate::warp::registry::ChainRegistry;
    use crate::warp::router::WarpRouter;
    use crate::warp::validator::WarpValidatorSet;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    #[test]
    fn test_timelock_monitor_creation() {
        // Just verify it can be constructed
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let _monitor = TimelockMonitor::default(Arc::new(Mutex::new(WarpRouter::new(
            ChainRegistry::with_defaults(),
            FeeEngine::with_defaults(),
            validator_set,
        ))));
    }
}
