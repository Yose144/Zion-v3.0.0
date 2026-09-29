//! # Inbound Releaser
//!
//! Background task that drives inbound transfers (external chain → ZION L1)
//! to completion. Previously inbound transfers were created by the watcher
//! but never advanced — the L1 unlock required a manual
//! `zion-bridge-unlock` run with operator-held validator keys.
//!
//! Pipeline per inbound transfer:
//!
//! ```text
//! Detected ──(burn visible)──▶ AwaitingFinality ──(source confs ≥
//! finality_blocks)──▶ Validating ──(release keys present, ≥3)──▶
//! QuorumReached ──▶ Executing ──(submitBridgeUnlock accepted)──▶
//! poll L1 confirmations ──▶ Completed
//! ```
//!
//! Safety properties:
//! * Source-chain finality is re-verified at execution time via
//!   `adapter.confirmations()` — a reorged burn never releases.
//! * Without `WARP_L1_RELEASE_KEYS` (or < `BRIDGE_MIN_VALIDATOR_PROOFS`
//!   keys) transfers stay in `AwaitingFinality`/`Validating` — nothing is
//!   submitted that L1 consensus would reject anyway.
//! * Permanent L1 rejections (proof verification, replay) mark the
//!   transfer `Failed`; transient RPC errors are retried every poll.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

use crate::warp::adapter::{create_adapter_from_config, ChainAdapter};
use crate::warp::config::WarpConfig;
use crate::warp::error::WarpResult;
use crate::warp::l1_release::{self, L1Releaser};
use crate::warp::router::WarpRouter;
use crate::warp::types::WarpStatus;

const POLL_SECS: u64 = 15;
/// L1 confirmations to wait for after `submitBridgeUnlock` is accepted.
/// The unlock lands in the next native block; 2 blocks is a pragmatic
/// settlement bar for display purposes (the spend itself is consensus-final
/// once mined).
const L1_CONFIRMATIONS_REQUIRED: u64 = 2;
/// Warn at most this often when release keys are missing (seconds).
const WARN_THROTTLE_SECS: u64 = 300;

pub struct InboundReleaser {
    router: Arc<Mutex<WarpRouter>>,
    releaser: Option<L1Releaser>,
    /// Source-chain adapters for finality checks (enabled chains only).
    adapters: HashMap<String, Box<dyn ChainAdapter>>,
    /// L1 adapter for post-submit confirmations.
    l1: Option<Box<dyn ChainAdapter>>,
    /// One-shot flags so repeated polls don't spam logs.
    warned_no_keys: bool,
    warned_below_quorum: bool,
    last_warn: std::time::Instant,
}

impl InboundReleaser {
    /// Build from config: releaser from `WARP_L1_RELEASE_KEYS`, adapters for
    /// every enabled chain (source finality) plus the L1 adapter.
    pub fn from_config(config: &WarpConfig, router: Arc<Mutex<WarpRouter>>) -> Self {
        let l1_addr = config
            .l1_rpc_url
            .trim_start_matches("http://")
            .trim_start_matches("https://")
            .trim_end_matches('/')
            .split('/')
            .next()
            .unwrap_or("127.0.0.1:9445")
            .to_string();
        let releaser = match L1Releaser::from_env(l1_addr) {
            Ok(r) => r,
            Err(e) => {
                error!("[inbound] WARP_L1_RELEASE_KEYS parse failed: {}", e);
                None
            }
        };

        if let Some(r) = &releaser {
            if let Err(e) = l1_release::self_check(r) {
                error!("[inbound] release key self-check failed: {}", e);
            }
            info!(
                "[inbound] L1 release: {} key(s) configured ({} needed for quorum)",
                r.key_count(),
                l1_release::BRIDGE_MIN_VALIDATOR_PROOFS
            );
        } else {
            info!(
                "[inbound] L1 release: no WARP_L1_RELEASE_KEYS — inbound \
                 transfers will hold in AwaitingFinality for manual release"
            );
        }

        let mut adapters: HashMap<String, Box<dyn ChainAdapter>> = HashMap::new();
        let mut l1 = None;
        for chain in &config.chains {
            if !chain.enabled {
                continue;
            }
            match create_adapter_from_config(chain, config) {
                Some(a) if chain.name == "zion-l1" => l1 = Some(a),
                Some(a) => {
                    adapters.insert(chain.name.clone(), a);
                }
                None => warn!("[inbound] no adapter for enabled chain '{}'", chain.name),
            }
        }
        if l1.is_none() {
            // zion-l1 may not be listed as a chain entry — always ensure we
            // have an L1 adapter for post-submit confirmation.
            let cfg = crate::warp::config::ChainConfig {
                name: "zion-l1".into(),
                family: "zion-l1".into(),
                enabled: true,
                rpc_url: config.l1_rpc_url.clone(),
                contract_address: None,
                finality_blocks: 60,
                disabled_reason: None,
            };
            l1 = create_adapter_from_config(&cfg, config);
        }

        Self {
            router,
            releaser,
            adapters,
            l1,
            warned_no_keys: false,
            warned_below_quorum: false,
            last_warn: std::time::Instant::now()
                .checked_sub(Duration::from_secs(WARN_THROTTLE_SECS))
                .unwrap_or_else(std::time::Instant::now),
        }
    }

    /// Run the release loop forever (call via `tokio::spawn`).
    pub async fn run(mut self) {
        info!("[inbound] Inbound releaser started — poll every {}s", POLL_SECS);
        let mut interval = tokio::time::interval(Duration::from_secs(POLL_SECS));
        loop {
            interval.tick().await;
            if let Err(e) = self.poll_once().await {
                error!("[inbound] poll error: {}", e);
            }
        }
    }

    fn warn_throttled(&mut self, msg: &str) {
        if self.last_warn.elapsed() >= Duration::from_secs(WARN_THROTTLE_SECS) {
            warn!("{}", msg);
            self.last_warn = std::time::Instant::now();
        } else {
            debug!("{}", msg);
        }
    }

    async fn poll_once(&mut self) -> WarpResult<()> {
        let inbound: Vec<crate::warp::types::WarpTransfer> = {
            let router = self.router.lock().await;
            router
                .list_pending()
                .into_iter()
                .filter(|t| t.dest_chain.name == "zion-l1")
                .filter(|t| {
                    matches!(
                        t.status,
                        WarpStatus::Detected
                            | WarpStatus::AwaitingFinality
                            | WarpStatus::Validating
                            | WarpStatus::QuorumReached
                    )
                })
                .collect()
        };

        for transfer in inbound {
            if let Err(e) = self.step(&transfer).await {
                error!(
                    "[inbound] transfer {} step failed: {}",
                    transfer.id, e
                );
            }
        }
        Ok(())
    }

    /// Advance one inbound transfer as far as possible this poll.
    async fn step(&mut self, transfer: &crate::warp::types::WarpTransfer) -> WarpResult<()> {
        let id = transfer.id;
        let source_tx = match &transfer.source_tx_hash {
            Some(h) => h.clone(),
            None => {
                debug!("[inbound] {} has no source tx hash — skipping", id);
                return Ok(());
            }
        };

        // 1. Re-verify source-chain finality every pass.
        let source_name = transfer.source_chain.name.clone();
        let adapter = match self.adapters.get(&source_name) {
            Some(a) => a,
            None => {
                self.warn_throttled(&format!(
                    "[inbound] no adapter for source chain '{source_name}' — {} stays {:?}",
                    id, transfer.status
                ));
                return Ok(());
            }
        };
        let confs = adapter.confirmations(&source_tx).await.unwrap_or_else(|e| {
            debug!("[inbound] confirmations({}) failed: {}", &source_tx[..16.min(source_tx.len())], e);
            0
        });
        let required = transfer.source_chain.finality_blocks.max(1);
        if confs < required {
            // Not final yet — park in AwaitingFinality.
            if transfer.status == WarpStatus::Detected {
                self.advance(id, WarpStatus::AwaitingFinality).await;
            }
            debug!(
                "[inbound] {} waiting finality {}/{} on {}",
                id, confs, required, source_name
            );
            return Ok(());
        }

        // 2. Finality reached — advance toward quorum.
        for status in [WarpStatus::AwaitingFinality, WarpStatus::Validating] {
            self.advance(id, status).await;
        }

        // 3. Quorum = enough local release keys (L1 enforces ≥3 distinct
        //    allow-listed pubkeys at consensus level).
        let Some(releaser) = &self.releaser else {
            if !self.warned_no_keys {
                self.warned_no_keys = true;
                self.warn_throttled(
                    "[inbound] WARP_L1_RELEASE_KEYS not set — transfers will wait \
                     for manual release (zion-bridge-unlock)",
                );
            }
            return Ok(());
        };
        if !releaser.has_min_proofs() {
            if !self.warned_below_quorum {
                self.warned_below_quorum = true;
                self.warn_throttled(&format!(
                    "[inbound] only {} release key(s) configured, L1 requires ≥{} \
                     distinct validator proofs — holding at Validating",
                    releaser.key_count(),
                    l1_release::BRIDGE_MIN_VALIDATOR_PROOFS
                ));
            }
            return Ok(());
        }
        self.advance(id, WarpStatus::QuorumReached).await;

        // 4. Build + submit the unlock.
        let burn_id = transfer
            .burn_id
            .clone()
            .unwrap_or_else(|| source_tx.clone());
        let net = transfer.net_amount();
        if net == 0 {
            self.advance(id, WarpStatus::Failed).await;
            return Ok(());
        }
        self.advance(id, WarpStatus::Executing).await;

        match releaser
            .release(
                &transfer.recipient,
                net,
                &source_name,
                &burn_id,
                &source_tx,
            )
            .await
        {
            Ok(tx_id) => {
                info!(
                    "[inbound] {} L1 unlock accepted: tx_id={} ({} flowers → {})",
                    id, tx_id, net, transfer.recipient
                );
                {
                    let mut router = self.router.lock().await;
                    router.set_dest_tx(&id, tx_id.clone());
                }
                self.confirm_l1(id, &tx_id).await;
            }
            Err(e) => {
                // Permanent rejections (bad proofs, replay) → Failed; the
                // manual zion-bridge-unlock path remains as fallback.
                error!("[inbound] {} release failed: {}", id, e);
                self.advance(id, WarpStatus::Failed).await;
            }
        }
        Ok(())
    }

    /// Advance `id` to `status` only when it is a forward step from the
    /// transfer's current persisted status (ignores stale/duplicate moves).
    async fn advance(&self, id: uuid::Uuid, status: WarpStatus) {
        let mut router = self.router.lock().await;
        let current = router.get_transfer(&id).map(|t| t.status);
        let order = |s: WarpStatus| match s {
            WarpStatus::Pending => 0,
            WarpStatus::Detected => 1,
            WarpStatus::AwaitingFinality => 2,
            WarpStatus::Validating => 3,
            WarpStatus::QuorumReached => 4,
            WarpStatus::Executing => 5,
            WarpStatus::Completed | WarpStatus::Failed => 6,
            WarpStatus::TimelockHold => 1,
        };
        if current.map(order).unwrap_or(0) >= order(status) {
            return; // already at/past this stage
        }
        if let Err(e) = router.advance_transfer(id, status) {
            debug!("[inbound] advance {}→{:?} rejected: {}", id, status, e);
        }
    }

    /// Poll the L1 adapter until the unlock tx reaches the required depth
    /// (bounded: ~10 min), then mark Completed.
    async fn confirm_l1(&mut self, id: uuid::Uuid, tx_id: &str) {
        let Some(l1) = &self.l1 else {
            // No L1 adapter — trust the node's acceptance and complete.
            let mut router = self.router.lock().await;
            let _ = router.advance_transfer(id, WarpStatus::Completed);
            return;
        };
        for _ in 0..60 {
            tokio::time::sleep(Duration::from_secs(10)).await;
            match l1.confirmations(tx_id).await {
                Ok(c) if c >= L1_CONFIRMATIONS_REQUIRED => {
                    let mut router = self.router.lock().await;
                    if let Err(e) = router.advance_transfer(id, WarpStatus::Completed) {
                        error!("[inbound] {} completion transition failed: {}", id, e);
                    } else {
                        info!("[inbound] {} completed (tx {})", id, tx_id);
                    }
                    return;
                }
                Ok(_) => continue,
                Err(e) => {
                    debug!("[inbound] L1 confirmations({}) error: {}", tx_id, e);
                    continue;
                }
            }
        }
        warn!(
            "[inbound] {} unlock tx {} not confirmed after ~10min — left Executing",
            id, tx_id
        );
    }
}
