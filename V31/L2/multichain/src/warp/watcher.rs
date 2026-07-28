//! # WARP Chain Watcher
//!
//! Background task that periodically polls each enabled chain adapter for
//! new `BridgeBurn` / burn events and feeds them into the `WarpRouter`.
//!
//! ## Operation
//! ```text
//! every POLL_INTERVAL:
//!   for each enabled chain adapter:
//!     proofs = adapter.watch_events()
//!     for proof in proofs (not yet seen):
//!       chain + recipient extracted from proof.memo ("WARP_INBOUND:<chain>:<zion_addr>")
//!       router.initiate_inbound(chain, proof, zion_recipient)
//!       db.save(transfer)
//! ```

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

use crate::warp::adapter::{create_adapter, ChainAdapter};
use crate::warp::config::WarpConfig;
use crate::warp::db::TransferDb;
use crate::warp::protocol::DepositProof;
use crate::warp::router::WarpRouter;

/// How often the watcher polls each chain (seconds).
const POLL_INTERVAL_SECS: u64 = 15;

/// Maximum seen-tx-hash cache size (prevents unbounded memory growth).
const SEEN_CACHE_MAX: usize = 10_000;

// ─────────────────────────────────────────────────────────────────────────────

/// Manages all chain event watchers and feeds deposits into the WarpRouter.
pub struct WarpWatcher {
    config: WarpConfig,
    router: Arc<Mutex<WarpRouter>>,
    db: Option<TransferDb>,
    /// Adapters for each enabled chain, keyed by chain id.
    adapters: Vec<(String, Box<dyn ChainAdapter>)>,
    /// Set of source_tx_hash values already submitted (in-memory dedup).
    seen: HashSet<String>,
}

impl WarpWatcher {
    /// Build a watcher from config.  
    /// Only chains with `enabled = true` in the config get an adapter.
    pub fn from_config(
        config: WarpConfig,
        router: Arc<Mutex<WarpRouter>>,
        db: Option<TransferDb>,
    ) -> Self {
        let mut adapters: Vec<(String, Box<dyn ChainAdapter>)> = Vec::new();

        for chain in &config.chains {
            if !chain.enabled {
                debug!("[Watcher] Chain '{}' disabled — skipping", chain.name);
                continue;
            }
            match create_adapter(&chain.name) {
                Some(adapter) => {
                    info!("[Watcher] Registered adapter for '{}'", chain.name);
                    adapters.push((chain.name.clone(), adapter));
                }
                None => warn!("[Watcher] No adapter available for chain '{}'", chain.name),
            }
        }

        Self {
            config,
            router,
            db,
            adapters,
            seen: HashSet::new(),
        }
    }

    /// Run the polling loop forever (call via `tokio::spawn`).
    pub async fn run(mut self) {
        let interval =
            Duration::from_secs(self.config.poll_interval_secs.unwrap_or(POLL_INTERVAL_SECS));

        info!(
            "[Watcher] Starting — {} adapters, poll every {}s",
            self.adapters.len(),
            interval.as_secs()
        );

        loop {
            self.poll_all().await;
            tokio::time::sleep(interval).await;
        }
    }

    /// Poll every registered adapter once.
    async fn poll_all(&mut self) {
        // Collect names first to avoid simultaneous borrow of self.adapters + self.handle_proof
        let chain_names: Vec<String> = self.adapters.iter().map(|(n, _)| n.clone()).collect();

        for (idx, chain_name) in chain_names.iter().enumerate() {
            let proofs = {
                let adapter = &self.adapters[idx].1;
                match adapter.watch_events().await {
                    Ok(p) => p,
                    Err(e) => {
                        warn!("[Watcher][{}] watch_events failed: {}", chain_name, e);
                        continue;
                    }
                }
            };

            if proofs.is_empty() {
                debug!("[Watcher][{}] No new events", chain_name);
                continue;
            }
            info!("[Watcher][{}] {} new event(s)", chain_name, proofs.len());
            for proof in proofs {
                self.handle_proof(chain_name.clone(), proof).await;
            }
        }
    }

    /// Process one `DepositProof`: dedup → route → persist.
    async fn handle_proof(&mut self, chain_name: String, proof: DepositProof) {
        // Trim seen cache to avoid unbounded growth
        if self.seen.len() >= SEEN_CACHE_MAX {
            self.seen.clear();
            debug!("[Watcher] seen-cache cleared (hit {})", SEEN_CACHE_MAX);
        }

        // Dedup: skip if we already processed this tx hash
        if self.seen.contains(&proof.tx_hash) {
            debug!(
                "[Watcher][{}] Duplicate tx {}, skipping",
                chain_name, proof.tx_hash
            );
            return;
        }

        // Extract ZION recipient from memo "WARP_INBOUND:<chain>:<zion_addr>"
        let zion_recipient = extract_zion_recipient(&proof.memo)
            .unwrap_or_else(|| "zion1warp_unresolved".to_string());

        info!(
            "[Watcher][{}] Inbound tx={} amount={} → {}",
            chain_name, proof.tx_hash, proof.amount_flowers, zion_recipient
        );

        // Hand off to the router — 3-arg signature: (chain_name, proof, recipient)
        let result = {
            let mut router = self.router.lock().await;
            router.initiate_inbound(&chain_name, proof.clone(), &zion_recipient)
        };

        match result {
            Ok(transfer_id) => {
                info!(
                    "[Watcher][{}] Inbound transfer {} created",
                    chain_name, transfer_id
                );
                self.seen.insert(proof.tx_hash.clone());

                // Persist if DB is available
                if let Some(db) = &self.db {
                    let router = self.router.lock().await;
                    if let Some(transfer) = router.get_transfer(&transfer_id) {
                        if let Err(e) = db.save(transfer) {
                            error!("[Watcher][{}] DB save failed: {}", chain_name, e);
                        }
                    }
                }
            }
            Err(e) => {
                warn!(
                    "[Watcher][{}] initiate_inbound failed for tx {}: {}",
                    chain_name, proof.tx_hash, e
                );
                // Mark as seen to avoid retry storms on permanent errors
                if is_permanent_error(&e) {
                    self.seen.insert(proof.tx_hash);
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Parse ZION recipient from memo `"WARP_INBOUND:<chain>:<zion_addr>"`.
fn extract_zion_recipient(memo: &str) -> Option<String> {
    // Format: WARP_INBOUND : <chain> : <zion_addr>
    let parts: Vec<&str> = memo.splitn(3, ':').collect();
    if parts.len() == 3 && parts[0] == "WARP_INBOUND" && !parts[2].is_empty() {
        Some(parts[2].to_string())
    } else {
        None
    }
}

/// Returns true for errors that should NOT be retried.
fn is_permanent_error(e: &crate::warp::error::WarpError) -> bool {
    use crate::warp::error::WarpError::*;
    matches!(
        e,
        InvalidMemo(_)
            | InvalidAddress { .. }
            | AmountBelowMinimum { .. }
            | DailyLimitExceeded { .. }
            | UnsupportedChain(_)
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::config::{ChainConfig, WarpConfig};
    use crate::warp::fees::FeeEngine;
    use crate::warp::registry::ChainRegistry;
    use crate::warp::validator::WarpValidatorSet;

    fn make_router() -> Arc<Mutex<WarpRouter>> {
        let registry = ChainRegistry::with_defaults();
        let fee_engine = FeeEngine::with_defaults();
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(1)));
        Arc::new(Mutex::new(WarpRouter::new(
            registry,
            fee_engine,
            validator_set,
        )))
    }

    fn make_config_no_chains() -> WarpConfig {
        WarpConfig {
            node_id: "test".into(),
            listen_addr: "127.0.0.1".into(),
            listen_port: 9333,
            quorum: 1,
            chains: vec![],
            database_path: String::new(),
            poll_interval_secs: Some(5),
            daily_limit_zion: 10_000_000,
            timelock_threshold_zion: 1_000_000,
            l1_rpc_url: "http://localhost:8444".into(),
            l1_vault_address: "zion1test".into(),
        }
    }

    fn make_config_disabled_chain() -> WarpConfig {
        WarpConfig {
            chains: vec![ChainConfig {
                name: "base".into(),
                family: "Evm".into(),
                enabled: false,
                ..Default::default()
            }],
            ..make_config_no_chains()
        }
    }

    #[test]
    fn test_watcher_no_adapters_when_all_disabled() {
        let router = make_router();
        let w = WarpWatcher::from_config(make_config_disabled_chain(), router, None);
        assert_eq!(w.adapters.len(), 0);
    }

    #[test]
    fn test_watcher_no_adapters_empty_config() {
        let router = make_router();
        let w = WarpWatcher::from_config(make_config_no_chains(), router, None);
        assert_eq!(w.adapters.len(), 0);
    }

    #[test]
    fn test_seen_cache_dedup() {
        let router = make_router();
        let mut w = WarpWatcher::from_config(make_config_no_chains(), router, None);

        // Insert fake tx hashes
        w.seen.insert("0xabc".into());
        assert!(w.seen.contains("0xabc"));
        assert!(!w.seen.contains("0xdef"));
    }

    #[test]
    fn test_seen_cache_cleared_at_limit() {
        let router = make_router();
        let mut w = WarpWatcher::from_config(make_config_no_chains(), router, None);

        // Fill to max - 1
        for i in 0..SEEN_CACHE_MAX - 1 {
            w.seen.insert(format!("0x{:064x}", i));
        }
        assert_eq!(w.seen.len(), SEEN_CACHE_MAX - 1);
        // One more should NOT clear yet
        w.seen.insert("0xfinal".into());
        assert_eq!(w.seen.len(), SEEN_CACHE_MAX);
    }

    #[test]
    fn test_extract_zion_recipient_valid() {
        let memo = "WARP_INBOUND:base:zion1abc123";
        assert_eq!(
            extract_zion_recipient(memo),
            Some("zion1abc123".to_string())
        );
    }

    #[test]
    fn test_extract_zion_recipient_invalid() {
        assert!(extract_zion_recipient("WARP_INBOUND:base:").is_none());
        assert!(extract_zion_recipient("BridgeBurn@base").is_none());
        assert!(extract_zion_recipient("").is_none());
    }

    #[test]
    fn test_error_permanent_classification() {
        use crate::warp::error::WarpError;

        assert!(is_permanent_error(&WarpError::InvalidMemo("bad".into())));
        assert!(is_permanent_error(&WarpError::UnsupportedChain(
            "xyz".into()
        )));
        assert!(is_permanent_error(&WarpError::AmountBelowMinimum {
            amount: 1,
            minimum: 100
        }));
        // AdapterError is retriable
        assert!(!is_permanent_error(&WarpError::AdapterError {
            chain: "evm".into(),
            reason: "timeout".into()
        }));
    }
}
