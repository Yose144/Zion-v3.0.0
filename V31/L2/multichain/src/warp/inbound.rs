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
        info!(
            "[inbound] Inbound releaser started — poll every {}s",
            POLL_SECS
        );
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
                            | WarpStatus::Executing
                    )
                })
                .collect()
        };

        for transfer in inbound {
            if let Err(e) = self.step(&transfer).await {
                error!("[inbound] transfer {} step failed: {}", transfer.id, e);
            }
        }
        Ok(())
    }

    /// Resume a transfer stuck in `Executing` after a restart. The unlock
    /// may already be accepted on L1 — with `dest_tx_hash` we simply finish
    /// confirmation watching; without it we cannot tell whether the release
    /// went out, so we refuse to re-submit (the L1 dedupes on burn_id, so a
    /// manual resubmit is safe — but an auto-resubmit that raced the first
    /// broadcast would only produce a replay rejection anyway).
    async fn resume_executing(
        &mut self,
        transfer: &crate::warp::types::WarpTransfer,
    ) -> WarpResult<()> {
        let id = transfer.id;
        match &transfer.dest_tx_hash {
            Some(tx_id) => {
                info!(
                    "[inbound] resuming Executing transfer {} (tx {})",
                    id, tx_id
                );
                let tx_id = tx_id.clone();
                self.confirm_l1(id, &tx_id).await
            }
            None => {
                self.warn_throttled(&format!(
                    "[inbound] {} stuck Executing with no dest_tx_hash — unlock may or may \
                     not have broadcast; operator recovery via zion-bridge-unlock",
                    id
                ));
                Ok(())
            }
        }
    }

    /// Advance one inbound transfer as far as possible this poll.
    async fn step(&mut self, transfer: &crate::warp::types::WarpTransfer) -> WarpResult<()> {
        let id = transfer.id;

        // Executing = already released (or possibly released) — resume, do
        // not re-drive the finality/quorum path.
        if transfer.status == WarpStatus::Executing {
            return self.resume_executing(transfer).await;
        }

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
            debug!(
                "[inbound] confirmations({}) failed: {}",
                &source_tx[..16.min(source_tx.len())],
                e
            );
            0
        });
        let required = transfer.source_chain.finality_blocks.max(1);
        if confs < required {
            // Not final yet — park in AwaitingFinality.
            if transfer.status == WarpStatus::Detected {
                self.advance(id, WarpStatus::AwaitingFinality).await?;
            }
            debug!(
                "[inbound] {} waiting finality {}/{} on {}",
                id, confs, required, source_name
            );
            return Ok(());
        }

        // 2. Burn authenticity gate — the on-chain burn event must
        //    authorize THIS transfer's stored recipient/amount/burn_id.
        //    Existence+finality of an arbitrary tx is not authorization.
        //    Adapters without `verify_burn` hold the transfer here (Err).
        adapter.verify_burn(transfer).await?;

        // 3. Finality reached — advance toward quorum.
        for status in [WarpStatus::AwaitingFinality, WarpStatus::Validating] {
            self.advance(id, status).await?;
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
        self.advance(id, WarpStatus::QuorumReached).await?;

        // 4. Build + submit the unlock.
        let burn_id = transfer
            .burn_id
            .clone()
            .unwrap_or_else(|| source_tx.clone());
        let net = transfer.net_amount();
        if net == 0 {
            self.advance(id, WarpStatus::Failed).await?;
            return Ok(());
        }
        // Executing is the irreversible claim on the release. Use the
        // STRICT router transition (not the idempotent helper): only a
        // real QuorumReached→Executing advance authorizes the submit — a
        // stale snapshot, an already-Executing transfer, or a persist
        // failure must never reach `releaser.release`.
        {
            let mut router = self.router.lock().await;
            router.advance_transfer(id, WarpStatus::Executing)?;
        }

        match releaser
            .release(&transfer.recipient, net, &source_name, &burn_id, &source_tx)
            .await
        {
            Ok(tx_id) => {
                info!(
                    "[inbound] {} L1 unlock accepted: tx_id={} ({} flowers → {})",
                    id, tx_id, net, transfer.recipient
                );
                {
                    let mut router = self.router.lock().await;
                    router.set_dest_tx(&id, tx_id.clone())?;
                }
                self.confirm_l1(id, &tx_id).await?;
            }
            Err(l1_release::ReleaseError::Rejected(reason)) => {
                // Permanent verdict (bad proofs, replay, invalid recipient)
                // — the manual zion-bridge-unlock path remains as fallback.
                error!("[inbound] {} release rejected: {}", id, reason);
                self.advance(id, WarpStatus::Failed).await?;
            }
            Err(l1_release::ReleaseError::Transport(e)) => {
                // Ambiguous: the unlock may already be broadcast. Stay in
                // Executing — resume_executing keeps warning; the operator
                // settles it via zion-bridge-unlock (L1 dedupes on burn_id,
                // so an eventual double-submit is impossible).
                warn!(
                    "[inbound] {} release transport error (outcome unknown, \
                     holding in Executing for operator recovery): {}",
                    id, e
                );
            }
        }
        Ok(())
    }

    /// Advance `id` to `status` only when it is a forward step from the
    /// transfer's current persisted status (duplicate/already-past moves
    /// are a no-op). Invalid transitions and persistence failures
    /// propagate — an unpersisted `Executing` must never reach
    /// `releaser.release`.
    async fn advance(&self, id: uuid::Uuid, status: WarpStatus) -> WarpResult<()> {
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
            return Ok(()); // already at/past this stage
        }
        router.advance_transfer(id, status)
    }

    /// Poll the L1 adapter until the unlock tx reaches the required depth
    /// (bounded: ~10 min), then mark Completed. Without an L1 confirmation
    /// adapter the transfer stays `Executing` — submit acceptance alone is
    /// not completion evidence.
    async fn confirm_l1(&mut self, id: uuid::Uuid, tx_id: &str) -> WarpResult<()> {
        if self.l1.is_none() {
            self.warn_throttled(&format!(
                "[inbound] {id} has no L1 confirmation adapter — holding Executing \
                 (not marking Completed on acceptance alone)"
            ));
            return Ok(());
        }
        let l1 = self.l1.as_deref().unwrap();
        for _ in 0..60 {
            tokio::time::sleep(Duration::from_secs(10)).await;
            match l1.confirmations(tx_id).await {
                Ok(c) if c >= L1_CONFIRMATIONS_REQUIRED => {
                    let mut router = self.router.lock().await;
                    router.advance_transfer(id, WarpStatus::Completed)?;
                    info!("[inbound] {} completed (tx {})", id, tx_id);
                    return Ok(());
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
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::warp::fees::FeeEngine;
    use crate::warp::protocol::{DepositProof, MintInstruction};
    use crate::warp::registry::ChainRegistry;
    use crate::warp::types::ChainFamily;
    use crate::warp::validator::WarpValidatorSet;

    /// Confirms deeply but cannot verify burns (default impl → Err hold).
    struct HoldAdapter;
    #[async_trait::async_trait]
    impl ChainAdapter for HoldAdapter {
        fn family(&self) -> ChainFamily {
            ChainFamily::Evm
        }
        fn name(&self) -> &str {
            "base"
        }
        async fn health_check(&self) -> WarpResult<bool> {
            Ok(true)
        }
        async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
            Ok(vec![])
        }
        async fn execute_mint(&self, _i: &MintInstruction) -> WarpResult<String> {
            Err(crate::warp::error::WarpError::AdapterNotImplemented(
                "mint".into(),
            ))
        }
        async fn current_height(&self) -> WarpResult<u64> {
            Ok(1_000_000)
        }
        async fn confirmations(&self, _tx: &str) -> WarpResult<u64> {
            Ok(10_000)
        }
    }

    pub(crate) fn router() -> Arc<Mutex<WarpRouter>> {
        Arc::new(Mutex::new(WarpRouter::new(
            ChainRegistry::with_defaults(),
            FeeEngine::with_defaults(),
            Arc::new(Mutex::new(WarpValidatorSet::new(3))),
        )))
    }

    fn releaser(r: Arc<Mutex<WarpRouter>>, l1: Option<Box<dyn ChainAdapter>>) -> InboundReleaser {
        let mut adapters: HashMap<String, Box<dyn ChainAdapter>> = HashMap::new();
        adapters.insert("base".into(), Box::new(HoldAdapter));
        InboundReleaser {
            router: r,
            releaser: None,
            adapters,
            l1,
            warned_no_keys: false,
            warned_below_quorum: false,
            last_warn: std::time::Instant::now(),
        }
    }

    pub(crate) fn proof() -> DepositProof {
        DepositProof {
            tx_hash: "0x".to_string() + &"a".repeat(64),
            block_height: 1,
            block_hash: "b".into(),
            sender: "0x".to_string() + &"1".repeat(40),
            amount_flowers: 1_000_000,
            memo: "x".into(),
            confirmations: 99,
            burn_id: None,
        }
    }

    /// A source adapter that confirms but cannot verify the burn must not
    /// let the transfer progress toward quorum/release.
    #[tokio::test]
    async fn step_holds_when_burn_verification_unsupported() {
        let r = router();
        let id = {
            let mut g = r.lock().await;
            g.initiate_inbound("base", proof(), "zion1r").unwrap()
        };
        let mut rel = releaser(r.clone(), None);
        let t = { r.lock().await.get_transfer(&id).unwrap().clone() };
        let res = rel.step(&t).await;
        assert!(res.is_err(), "verify_burn hold must propagate");
        let g = r.lock().await;
        assert_eq!(g.get_transfer(&id).unwrap().status, WarpStatus::Detected);
    }

    /// Executing with a dest tx but no L1 confirmation adapter: hold in
    /// Executing — never mark Completed on acceptance alone.
    #[tokio::test]
    async fn executing_holds_without_l1_adapter() {
        let r = router();
        let id = {
            let mut g = r.lock().await;
            let id = g.initiate_inbound("base", proof(), "zion1r").unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
                WarpStatus::Executing,
            ] {
                g.advance_transfer(id, s).unwrap();
            }
            g.set_dest_tx(&id, "l1tx".into()).unwrap();
            id
        };
        let mut rel = releaser(r.clone(), None);
        let t = { r.lock().await.get_transfer(&id).unwrap().clone() };
        rel.step(&t).await.unwrap();
        assert_eq!(
            r.lock().await.get_transfer(&id).unwrap().status,
            WarpStatus::Executing
        );
    }
}

#[cfg(test)]
mod audit_tests {
    use super::tests::*;
    use super::*;
    use crate::warp::fees::FeeEngine;
    use crate::warp::l1_release::L1Releaser;
    use crate::warp::protocol::{DepositProof, MintInstruction};
    use crate::warp::registry::ChainRegistry;
    use crate::warp::types::ChainFamily;
    use crate::warp::validator::WarpValidatorSet;
    use k256::ecdsa::SigningKey;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Confirms deeply AND accepts burn proofs — reaches the Executing claim.
    struct VerifyAdapter;
    #[async_trait::async_trait]
    impl ChainAdapter for VerifyAdapter {
        fn family(&self) -> ChainFamily {
            ChainFamily::Evm
        }
        fn name(&self) -> &str {
            "base"
        }
        async fn health_check(&self) -> WarpResult<bool> {
            Ok(true)
        }
        async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
            Ok(vec![])
        }
        async fn execute_mint(&self, _i: &MintInstruction) -> WarpResult<String> {
            Err(crate::warp::error::WarpError::AdapterNotImplemented(
                "mint".into(),
            ))
        }
        async fn current_height(&self) -> WarpResult<u64> {
            Ok(1_000_000)
        }
        async fn confirmations(&self, _tx: &str) -> WarpResult<u64> {
            Ok(10_000)
        }
        async fn verify_burn(&self, _t: &crate::warp::types::WarpTransfer) -> WarpResult<()> {
            Ok(())
        }
    }

    /// Line-delimited JSON-RPC listener that counts connections — if
    /// `release()` is ever called, the count goes up. Always rejects so
    /// a wrongly-issued release fails fast instead of hanging ~10 min.
    /// Async task scoped to the test runtime — torn down with it.
    fn counting_l1(counter: Arc<AtomicUsize>) -> String {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        l.set_nonblocking(true).unwrap();
        let port = l.local_addr().unwrap().port();
        let listener = tokio::net::TcpListener::from_std(l).unwrap();
        tokio::spawn(async move {
            loop {
                let Ok((mut s, _)) = listener.accept().await else {
                    break;
                };
                counter.fetch_add(1, Ordering::SeqCst);
                tokio::spawn(async move {
                    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
                    let (r, mut w) = s.split();
                    let mut line = String::new();
                    let mut reader = BufReader::new(r);
                    let _ = reader.read_line(&mut line).await;
                    let _ = w
                        .write_all(
                            b"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"accepted\":false,\"reason\":\"test reject\"}}\n",
                        )
                        .await;
                });
            }
        });
        format!("127.0.0.1:{port}")
    }

    fn releaser_with_verify(r: Arc<Mutex<WarpRouter>>, l1_addr: String) -> InboundReleaser {
        let keys: Vec<(String, SigningKey)> = (1u8..=3)
            .map(|b| (format!("v{b}"), SigningKey::from_slice(&[b; 32]).unwrap()))
            .collect();
        let mut adapters: HashMap<String, Box<dyn ChainAdapter>> = HashMap::new();
        adapters.insert("base".into(), Box::new(VerifyAdapter));
        InboundReleaser {
            router: r,
            releaser: Some(L1Releaser::new(l1_addr, keys)),
            adapters,
            l1: None,
            warned_no_keys: false,
            warned_below_quorum: false,
            last_warn: std::time::Instant::now(),
        }
    }

    /// A stale `QuorumReached` snapshot of a transfer that is already
    /// `Executing` must NOT drive a second release: the strict
    /// `advance_transfer(Executing)` transition fails before submit.
    #[tokio::test]
    async fn stale_quorum_snapshot_cannot_rerelease() {
        let r = router();
        let (id, stale) = {
            let mut g = r.lock().await;
            let id = g.initiate_inbound("base", proof(), "zion1r").unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
            ] {
                g.advance_transfer(id, s).unwrap();
            }
            let stale = g.get_transfer(&id).unwrap().clone();
            // "Another caller" claims the release first.
            g.advance_transfer(id, WarpStatus::Executing).unwrap();
            (id, stale)
        };
        let reqs = Arc::new(AtomicUsize::new(0));
        let addr = counting_l1(reqs.clone());
        let mut rel = releaser_with_verify(r.clone(), addr);
        let res = rel.step(&stale).await;
        assert!(res.is_err(), "stale snapshot must fail the strict claim");
        assert_eq!(reqs.load(Ordering::SeqCst), 0, "release must never fire");
        assert_eq!(
            r.lock().await.get_transfer(&id).unwrap().status,
            WarpStatus::Executing
        );
    }

    /// If persisting `Executing` fails, `releaser.release` must not run
    /// and the durable status stays `QuorumReached`.
    #[tokio::test]
    async fn failing_executing_save_blocks_release() {
        let path = std::env::temp_dir()
            .join(format!("warp-inb-{}.db", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        let tdb = crate::warp::db::TransferDb::open(&path).unwrap();
        let r = Arc::new(Mutex::new(
            WarpRouter::with_db(
                ChainRegistry::with_defaults(),
                FeeEngine::with_defaults(),
                Arc::new(Mutex::new(WarpValidatorSet::new(3))),
                tdb,
                Some("127.0.0.1:1".into()),
                1,
            )
            .unwrap(),
        ));
        let id = {
            let mut g = r.lock().await;
            let id = g.initiate_inbound("base", proof(), "zion1r").unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
            ] {
                g.advance_transfer(id, s).unwrap();
            }
            id
        };
        // Fail every future `transfers` INSERT.
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER fail_save BEFORE INSERT ON transfers BEGIN SELECT RAISE(FAIL,'x'); END;",
        )
        .unwrap();
        drop(conn);

        let reqs = Arc::new(AtomicUsize::new(0));
        let addr = counting_l1(reqs.clone());
        let mut rel = releaser_with_verify(r.clone(), addr);
        let snap = { r.lock().await.get_transfer(&id).unwrap().clone() };
        let res = rel.step(&snap).await;
        assert!(res.is_err());
        assert_eq!(reqs.load(Ordering::SeqCst), 0, "release must never fire");
        assert_eq!(
            r.lock().await.get_transfer(&id).unwrap().status,
            WarpStatus::QuorumReached
        );
        std::fs::remove_file(&path).ok();
    }
}
