//! Outbound Transfer Executor
//!
//! Monitors the WarpRouter for transfers that have reached quorum and executes
//! the mint instruction on the destination chain.

use crate::warp::adapter::{create_adapter, create_adapter_from_config, ChainAdapter};
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::{MintInstruction, ValidatorSignature, WarpMessage};
use crate::warp::router::WarpRouter;
use crate::warp::types::WarpStatus;
use crate::warp::validator::WarpValidatorSet;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, error, info};

/// How often to check for executable transfers (seconds)
const EXECUTOR_POLL_SECS: u64 = 10;

/// Deterministic per-transfer nonce: first 8 bytes of the transfer UUID.
/// Re-issuing the same mint (resume/retry) must produce an identical
/// WarpMessage — a process-counter nonce would give every attempt a
/// different msg_hash and defeat on-chain dedup.
fn deterministic_nonce(transfer_id: uuid::Uuid) -> u64 {
    u64::from_le_bytes(transfer_id.as_bytes()[..8].try_into().unwrap())
}

/// An outbound transfer originates on ZION L1 and pays out on an external
/// chain. Inbound transfers (external → zion-l1) are driven by
/// `InboundReleaser` — the outbound executor must never touch them,
/// whatever state they are in.
fn is_outbound(t: &crate::warp::types::WarpTransfer) -> bool {
    t.source_chain.name == "zion-l1" && t.dest_chain.name != "zion-l1"
}

/// Outbound executor that processes transfers ready for execution
pub struct OutboundExecutor {
    router: Arc<Mutex<WarpRouter>>,
    validators: Arc<Mutex<WarpValidatorSet>>,
    adapters: HashMap<String, Box<dyn ChainAdapter>>,
}

impl OutboundExecutor {
    /// Create a new executor with the given router and validator set
    pub fn new(router: Arc<Mutex<WarpRouter>>, validators: Arc<Mutex<WarpValidatorSet>>) -> Self {
        // Pre-create adapters for all supported destination chains
        let mut adapters = HashMap::new();
        for chain_name in &[
            "base",
            "arbitrum",
            "optimism",
            "bsc",
            "polygon",
            "avalanche",
            "zksync",
            "linea",
            "robinhood",
            "ethereum",
            "solana",
            "tron",
            "stellar",
            "cardano",
            "cosmos",
            "bitcoin",
            "sui",
            "aptos",
            "near",
            "ton",
            "lightning",
        ] {
            if let Some(adapter) = create_adapter(chain_name) {
                adapters.insert(chain_name.to_string(), adapter);
            }
        }

        Self {
            router,
            validators,
            adapters,
        }
    }

    /// Build from the runtime `WarpConfig` — adapters only for `enabled`
    /// chains other than `zion-l1`, honoring per-chain RPC/contract
    /// overrides via `create_adapter_from_config`. An empty or
    /// all-disabled config yields NO adapters (a safe hold), unlike `new`
    /// which always wires every default chain.
    pub fn from_config(
        config: &crate::warp::config::WarpConfig,
        router: Arc<Mutex<WarpRouter>>,
        validators: Arc<Mutex<WarpValidatorSet>>,
    ) -> Self {
        let mut adapters = HashMap::new();
        for chain in &config.chains {
            if !chain.enabled || chain.name == "zion-l1" {
                continue;
            }
            if let Some(adapter) = create_adapter_from_config(chain, config) {
                adapters.insert(chain.name.clone(), adapter);
            }
        }
        Self {
            router,
            validators,
            adapters,
        }
    }

    /// Run the executor loop forever
    pub async fn run(self) {
        info!("[Executor] Starting outbound transfer executor");
        let mut interval = tokio::time::interval(Duration::from_secs(EXECUTOR_POLL_SECS));

        loop {
            interval.tick().await;
            if let Err(e) = self.poll_once().await {
                error!("[Executor] Poll error: {}", e);
            }
        }
    }

    /// Single poll iteration: execute QuorumReached transfers and resume
    /// Executing transfers stranded by a restart (a mint already broadcast
    /// still needs its confirmations watched).
    async fn poll_once(&self) -> WarpResult<()> {
        let (to_execute, to_resume) = {
            let router = self.router.lock().await;
            let pending = router.list_pending();
            let to_execute: Vec<_> = pending
                .iter()
                .filter(|t| t.status == WarpStatus::QuorumReached)
                .filter(|t| is_outbound(t))
                .map(|t| t.id)
                .collect();
            let to_resume: Vec<_> = pending
                .iter()
                .filter(|t| t.status == WarpStatus::Executing)
                .filter(|t| is_outbound(t))
                .map(|t| t.id)
                .collect();
            (to_execute, to_resume)
        };

        for transfer_id in to_execute {
            if let Err(e) = self.execute_transfer(transfer_id).await {
                error!(
                    "[Executor] Failed to execute transfer {}: {}",
                    transfer_id, e
                );
                // Leave the transfer in Executing for operator recovery —
                // a mint may already be on-chain, and marking Failed would
                // record a false terminal state.
            }
        }

        for transfer_id in to_resume {
            if let Err(e) = self.resume_transfer(transfer_id).await {
                error!(
                    "[Executor] Failed to resume transfer {}: {}",
                    transfer_id, e
                );
            }
        }

        Ok(())
    }

    /// Resume a transfer stuck in `Executing` (crash after the state was
    /// persisted). If `dest_tx_hash` is set, the mint was broadcast — just
    /// finish watching confirmations. If it is not set we cannot tell
    /// whether the mint went out, so we refuse to re-issue it (a stranded
    /// transfer is operator-recoverable; a double-mint is not).
    async fn resume_transfer(&self, transfer_id: uuid::Uuid) -> WarpResult<()> {
        let (dest_chain_name, tx_hash) = {
            let router = self.router.lock().await;
            let transfer = router
                .get_transfer(&transfer_id)
                .ok_or_else(|| WarpError::TransferNotFound(transfer_id.to_string()))?;
            if !is_outbound(transfer) {
                return Err(WarpError::Validation(format!(
                    "transfer {transfer_id} is not outbound ({} → {}) — \
                     refusing outbound resume",
                    transfer.source_chain.name, transfer.dest_chain.name
                )));
            }
            (
                transfer.dest_chain.name.clone(),
                transfer.dest_tx_hash.clone(),
            )
        };

        let Some(tx_hash) = tx_hash else {
            error!(
                "[Executor] Transfer {} stuck in Executing with no dest_tx_hash — \
                 mint may or may not have broadcast; requires operator recovery",
                transfer_id
            );
            return Ok(());
        };

        let adapter = self
            .adapters
            .get(&dest_chain_name)
            .ok_or_else(|| WarpError::UnsupportedChain(dest_chain_name.clone()))?;

        self.wait_for_confirmations(transfer_id, adapter.as_ref(), &tx_hash)
            .await?;

        let mut router = self.router.lock().await;
        router.advance_transfer(transfer_id, WarpStatus::Completed)?;
        info!(
            "[Executor] Resumed transfer {} completed on {}",
            transfer_id, dest_chain_name
        );
        Ok(())
    }

    /// Execute a single outbound transfer
    async fn execute_transfer(&self, transfer_id: uuid::Uuid) -> WarpResult<()> {
        // Claim the transfer BEFORE the irreversible mint: persist the
        // QuorumReached->Executing transition first so a crash can never
        // re-enter this path (poll_once only re-drives QuorumReached, and
        // Executing transfers go through resume_transfer). The direction
        // check runs inside the same lock — no transition on an inbound
        // transfer even if poll_once's filter is ever bypassed.
        {
            let mut router = self.router.lock().await;
            let direction = router
                .get_transfer(&transfer_id)
                .map(|t| (t.source_chain.name.clone(), t.dest_chain.name.clone()))
                .ok_or_else(|| WarpError::TransferNotFound(transfer_id.to_string()))?;
            if direction.0 != "zion-l1" || direction.1 == "zion-l1" {
                return Err(WarpError::Validation(format!(
                    "transfer {transfer_id} is not outbound ({} → {}) — \
                     refusing outbound execution",
                    direction.0, direction.1
                )));
            }
            router.advance_transfer(transfer_id, WarpStatus::Executing)?;
        }

        // Get transfer details and sign the WarpMessage
        let (transfer, warp_message, signatures) = {
            let router = self.router.lock().await;
            let transfer = router
                .get_transfer(&transfer_id)
                .ok_or_else(|| WarpError::TransferNotFound(transfer_id.to_string()))?
                .clone();

            // Deterministic message per transfer: nonce and timestamp are
            // derived from the transfer itself (not a process counter or
            // wall clock) so any re-issued mint produces the SAME
            // warp_message_hash — the destination contract's dedup on
            // msg_hash is the last line of defense against double-mint.
            let warp_message = WarpMessage {
                transfer_id,
                source_chain: transfer.source_chain.name.clone(),
                dest_chain: transfer.dest_chain.name.clone(),
                recipient: transfer.recipient.clone(),
                amount_flowers: transfer.amount_flowers,
                fee_flowers: transfer.fee_flowers,
                nonce: deterministic_nonce(transfer_id),
                timestamp: transfer.created_at.timestamp() as u64,
                deposit_proof_hash: transfer.source_tx_hash.clone().unwrap_or_default(),
            };

            // Sign the message with locally-held validator keys.
            // In single-node Alpha mode, all validator keys are loaded from
            // WARP_VALIDATOR_KEYS env var. In multi-node mode, signatures
            // would be collected via P2P gossip from other validators.
            let validators = self.validators.lock().await;
            let sigs = validators.sign_locally(&warp_message);

            if sigs.is_empty() {
                return Err(WarpError::QuorumNotReached {
                    signatures: 0,
                    required: validators.quorum,
                });
            }

            // Verify quorum of the locally-produced signatures
            validators.verify_quorum(&warp_message, &sigs)?;

            // Convert to ValidatorSignature for mint instruction
            let validator_signatures: Vec<ValidatorSignature> = sigs
                .into_iter()
                .map(|(id, sig)| ValidatorSignature {
                    validator_id: id,
                    public_key: vec![],
                    signature: sig,
                    warp_message_hash: hex::encode(warp_message.signing_hash()),
                })
                .collect();

            (transfer, warp_message, validator_signatures)
        };

        // Get destination chain adapter
        let dest_chain_name = &transfer.dest_chain.name;
        let adapter = self
            .adapters
            .get(dest_chain_name)
            .ok_or_else(|| WarpError::UnsupportedChain(dest_chain_name.clone()))?;

        // Convert amount to destination chain atomic units
        let amount_dest_atomic = crate::warp::types::convert_decimals(
            transfer.amount_flowers.saturating_sub(transfer.fee_flowers),
            6, // ZION L1 = 6 decimals (flowers)
            transfer.dest_chain.decimals,
        )
        .ok_or(WarpError::DecimalOverflow {
            from_decimals: 6,
            to_decimals: transfer.dest_chain.decimals,
        })?;

        // Build mint instruction
        let mint_instruction = MintInstruction {
            dest_chain: dest_chain_name.clone(),
            recipient: transfer.recipient.clone(),
            amount_dest_atomic,
            signatures,
            warp_message_hash: hex::encode(warp_message.signing_hash()),
        };

        // Execute mint on destination chain
        info!(
            "[Executor] Executing mint on {} for transfer {}: {} -> {}",
            dest_chain_name, transfer_id, transfer.sender, transfer.recipient
        );

        let tx_hash = adapter.execute_mint(&mint_instruction).await?;

        // Persist the broadcast tx hash (Executing was already set before
        // the mint — resume_transfer picks up from here after a restart).
        // A failure here must abort: the transfer stays Executing with no
        // resubmission rather than minting again on a later poll.
        {
            let mut router = self.router.lock().await;
            router.set_dest_tx(&transfer_id, tx_hash.clone())?;
        }

        // Wait for confirmations on destination chain
        self.wait_for_confirmations(transfer_id, adapter.as_ref(), &tx_hash)
            .await?;

        // Mark as completed
        {
            let mut router = self.router.lock().await;
            router.advance_transfer(transfer_id, WarpStatus::Completed)?;
        }

        info!(
            "[Executor] Transfer {} completed on {}",
            transfer_id, dest_chain_name
        );
        Ok(())
    }

    /// Wait for destination chain confirmations
    async fn wait_for_confirmations(
        &self,
        transfer_id: uuid::Uuid,
        adapter: &dyn ChainAdapter,
        tx_hash: &str,
    ) -> WarpResult<()> {
        let required = {
            let router = self.router.lock().await;
            router
                .get_transfer(&transfer_id)
                .map(|t| t.dest_chain.finality_blocks)
                .unwrap_or(1)
        }
        .max(1);

        for _ in 0..60 {
            // Max 60 attempts (10 min at 10s intervals)
            tokio::time::sleep(Duration::from_secs(10)).await;

            let confirmations = adapter.confirmations(tx_hash).await.unwrap_or(0);
            if confirmations >= required {
                debug!(
                    "[Executor] Transfer {} confirmed on dest chain: {} >= {}",
                    transfer_id, confirmations, required
                );
                return Ok(());
            }
        }

        Err(WarpError::FinalityNotReached {
            chain: adapter.name().to_string(),
            confirmations: 0,
            required,
        })
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    #[test]
    fn test_executor_creation() {
        // Just verify it can be constructed
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let _executor = OutboundExecutor::new(
            Arc::new(Mutex::new(WarpRouter::new(
                crate::warp::registry::ChainRegistry::with_defaults(),
                crate::warp::fees::FeeEngine::with_defaults(),
                validator_set.clone(),
            ))),
            validator_set,
        );
    }

    #[test]
    fn deterministic_nonce_is_stable_per_transfer() {
        let id = uuid::Uuid::new_v4();
        assert_eq!(deterministic_nonce(id), deterministic_nonce(id));
        assert_ne!(
            deterministic_nonce(id),
            deterministic_nonce(uuid::Uuid::new_v4())
        );
    }

    /// A transfer stuck in `Executing` with no dest_tx_hash (crash between
    /// the state transition and the mint broadcast) must NOT be re-issued —
    /// the mint may already be on-chain. It stays Executing for the
    /// operator instead of risking a double-mint.
    #[tokio::test]
    async fn resume_executing_without_tx_hash_stays_for_operator() {
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let router = Arc::new(Mutex::new(WarpRouter::new(
            crate::warp::registry::ChainRegistry::with_defaults(),
            crate::warp::fees::FeeEngine::with_defaults(),
            validator_set.clone(),
        )));

        let id = {
            let mut r = router.lock().await;
            let proof = crate::warp::protocol::DepositProof {
                tx_hash: "tx_resume".into(),
                block_height: 1,
                block_hash: "b".into(),
                sender: "zion1sender".into(),
                amount_flowers: 1_000_000,
                memo: "WARP:1:base:0xRecipient".into(),
                confirmations: 60,
                burn_id: None,
            };
            let id = r.initiate_outbound(proof).unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
                WarpStatus::Executing,
            ] {
                r.advance_transfer(id, s).unwrap();
            }
            id
        };

        let executor = OutboundExecutor::new(router.clone(), validator_set);
        executor.resume_transfer(id).await.unwrap();

        let r = router.lock().await;
        assert_eq!(
            r.get_transfer(&id).unwrap().status,
            WarpStatus::Executing,
            "no-tx-hash Executing transfer must remain for operator recovery"
        );
    }

    /// Mock destination adapter that only counts `execute_mint` calls.
    struct CountingMintAdapter {
        mint_calls: Arc<std::sync::atomic::AtomicUsize>,
    }

    #[async_trait::async_trait]
    impl ChainAdapter for CountingMintAdapter {
        fn family(&self) -> crate::warp::types::ChainFamily {
            crate::warp::types::ChainFamily::Evm
        }
        fn name(&self) -> &str {
            "base"
        }
        async fn health_check(&self) -> WarpResult<bool> {
            Ok(true)
        }
        async fn watch_events(&self) -> WarpResult<Vec<crate::warp::protocol::DepositProof>> {
            Ok(vec![])
        }
        async fn execute_mint(
            &self,
            _instruction: &crate::warp::protocol::MintInstruction,
        ) -> WarpResult<String> {
            self.mint_calls
                .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            Ok("0xmockmint".into())
        }
        async fn current_height(&self) -> WarpResult<u64> {
            Ok(1)
        }
        async fn confirmations(&self, _tx_hash: &str) -> WarpResult<u64> {
            Ok(0)
        }
    }

    fn test_deposit(tx_hash: &str) -> crate::warp::protocol::DepositProof {
        crate::warp::protocol::DepositProof {
            tx_hash: tx_hash.into(),
            block_height: 1,
            block_hash: "b".into(),
            sender: "zion1sender".into(),
            amount_flowers: 1_000_000,
            memo: "WARP:1:base:0xRecipient".into(),
            confirmations: 60,
            burn_id: None,
        }
    }

    pub(crate) fn test_router(
        validator_set: &Arc<Mutex<WarpValidatorSet>>,
    ) -> Arc<Mutex<WarpRouter>> {
        Arc::new(Mutex::new(WarpRouter::new(
            crate::warp::registry::ChainRegistry::with_defaults(),
            crate::warp::fees::FeeEngine::with_defaults(),
            validator_set.clone(),
        )))
    }

    /// Inbound transfers (external → zion-l1) must be ignored by the
    /// outbound poll in every state — they belong to `InboundReleaser`.
    /// The `Executing` one carries a dest tx hash: unfiltered, the resume
    /// path would drive it into a long confirmation wait.
    #[tokio::test]
    async fn poll_once_leaves_inbound_transfers_untouched() {
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let router = test_router(&validator_set);

        let (quorum_id, exec_id) = {
            let mut r = router.lock().await;
            let quorum_id = r
                .initiate_inbound("base", test_deposit("burn_a"), "zion1r")
                .unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
            ] {
                r.advance_transfer(quorum_id, s).unwrap();
            }

            let exec_id = r
                .initiate_inbound("base", test_deposit("burn_b"), "zion1r")
                .unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
                WarpStatus::Executing,
            ] {
                r.advance_transfer(exec_id, s).unwrap();
            }
            r.set_dest_tx(&exec_id, "l1_unlock_tx".into()).unwrap();
            (quorum_id, exec_id)
        };

        let mint_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let mut adapters: HashMap<String, Box<dyn ChainAdapter>> = HashMap::new();
        adapters.insert(
            "base".to_string(),
            Box::new(CountingMintAdapter {
                mint_calls: mint_calls.clone(),
            }),
        );
        let executor = OutboundExecutor {
            router: router.clone(),
            validators: validator_set,
            adapters,
        };

        executor.poll_once().await.unwrap();

        let r = router.lock().await;
        assert_eq!(
            r.get_transfer(&quorum_id).unwrap().status,
            WarpStatus::QuorumReached
        );
        assert_eq!(
            r.get_transfer(&exec_id).unwrap().status,
            WarpStatus::Executing
        );
        assert_eq!(mint_calls.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    /// Direct calls on an inbound transfer are rejected before any
    /// transition or adapter call.
    #[tokio::test]
    async fn execute_and_resume_reject_inbound_transfer() {
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let router = test_router(&validator_set);
        let id = {
            let mut r = router.lock().await;
            let id = r
                .initiate_inbound("base", test_deposit("burn_c"), "zion1r")
                .unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
            ] {
                r.advance_transfer(id, s).unwrap();
            }
            id
        };

        let mint_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let mut adapters: HashMap<String, Box<dyn ChainAdapter>> = HashMap::new();
        adapters.insert(
            "base".to_string(),
            Box::new(CountingMintAdapter {
                mint_calls: mint_calls.clone(),
            }),
        );
        let executor = OutboundExecutor {
            router: router.clone(),
            validators: validator_set,
            adapters,
        };

        assert!(executor.execute_transfer(id).await.is_err());
        assert!(executor.resume_transfer(id).await.is_err());
        assert_eq!(mint_calls.load(std::sync::atomic::Ordering::SeqCst), 0);
        let r = router.lock().await;
        assert_eq!(
            r.get_transfer(&id).unwrap().status,
            WarpStatus::QuorumReached,
            "rejected inbound transfer must not be transitioned"
        );
    }

    /// If the QuorumReached→Executing save fails, execution aborts before
    /// signing/broadcast — the mint counter must stay at zero (no keys are
    /// needed: the failure happens before signing).
    #[tokio::test]
    async fn execute_fails_closed_when_executing_save_fails() {
        let path = std::env::temp_dir()
            .join(format!(
                "zion-warp-executor-test-{}.db",
                uuid::Uuid::new_v4()
            ))
            .to_string_lossy()
            .into_owned();
        let db = crate::warp::db::TransferDb::open(&path).unwrap();
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let router = Arc::new(Mutex::new(
            WarpRouter::with_db(
                crate::warp::registry::ChainRegistry::with_defaults(),
                crate::warp::fees::FeeEngine::with_defaults(),
                validator_set.clone(),
                db.clone(),
                None,
                12,
            )
            .unwrap(),
        ));

        let id = {
            let mut r = router.lock().await;
            let id = r.initiate_outbound(test_deposit("dep_1")).unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
            ] {
                r.advance_transfer(id, s).unwrap();
            }
            id
        };

        // Independent connection: fail every transfer save from now on.
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER fail_transfer_save BEFORE INSERT ON transfers \
             BEGIN SELECT RAISE(FAIL, 'forced save failure'); END;",
        )
        .unwrap();

        let mint_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let mut adapters: HashMap<String, Box<dyn ChainAdapter>> = HashMap::new();
        adapters.insert(
            "base".to_string(),
            Box::new(CountingMintAdapter {
                mint_calls: mint_calls.clone(),
            }),
        );
        let executor = OutboundExecutor {
            router: router.clone(),
            validators: validator_set,
            adapters,
        };

        let err = executor.execute_transfer(id).await.unwrap_err();
        assert!(
            matches!(err, WarpError::Database(_)),
            "expected persistence failure, got {err:?}"
        );
        assert_eq!(
            mint_calls.load(std::sync::atomic::Ordering::SeqCst),
            0,
            "mint must not be attempted when Executing could not be persisted"
        );

        // Transfer stays QuorumReached in memory and on disk.
        {
            let r = router.lock().await;
            assert_eq!(
                r.get_transfer(&id).unwrap().status,
                WarpStatus::QuorumReached
            );
        }
        assert_eq!(
            db.load(&id).unwrap().unwrap().status,
            WarpStatus::QuorumReached
        );

        drop(conn);
        std::fs::remove_file(&path).ok();
    }
}

#[cfg(test)]
mod audit_tests {
    use super::tests::test_router;
    use super::*;
    use crate::warp::adapter::evm::audit_tests as evmfx;
    use crate::warp::config::{ChainConfig, WarpConfig};

    fn cfg_with(chains: Vec<ChainConfig>) -> WarpConfig {
        let mut c = WarpConfig::default();
        c.chains = chains;
        c
    }
    fn chain(
        name: &str,
        family: &str,
        enabled: bool,
        rpc: &str,
        contract: Option<&str>,
    ) -> ChainConfig {
        ChainConfig {
            name: name.into(),
            family: family.into(),
            enabled,
            rpc_url: rpc.into(),
            contract_address: contract.map(|s| s.into()),
            finality_blocks: 1,
            disabled_reason: (!enabled).then(|| "test-disabled".to_string()),
        }
    }

    #[test]
    fn from_config_wires_only_enabled_non_l1_chains() {
        let cfg = cfg_with(vec![
            chain("base", "evm", true, "http://127.0.0.1:9", None),
            chain("solana", "solana", false, "", None),
            chain("zion-l1", "zion", true, "", None),
        ]);
        let vs = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let exec = OutboundExecutor::from_config(&cfg, test_router(&vs), vs);
        assert!(exec.adapters.contains_key("base"));
        assert!(!exec.adapters.contains_key("solana"));
        assert!(!exec.adapters.contains_key("zion-l1"));
    }

    #[test]
    fn from_config_empty_config_yields_no_adapters() {
        let cfg = cfg_with(vec![]);
        let vs = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let exec = OutboundExecutor::from_config(&cfg, test_router(&vs), vs);
        assert!(exec.adapters.is_empty());
    }

    /// The adapter built by `from_config` must hit the configured RPC
    /// URL — a local mock proves both wiring and honor of `rpc_url`.
    #[tokio::test]
    async fn from_config_adapter_uses_configured_rpc() {
        let receipt = r#"{"jsonrpc":"2.0","id":1,"result":{"status":"0x1","blockNumber":"0x5f","transactionHash":"0xabc"}}"#.to_string();
        let tip = r#"{"jsonrpc":"2.0","id":1,"result":"0x64"}"#.to_string();
        let url = evmfx::spawn_rpc(receipt, tip).await;
        let cfg = cfg_with(vec![chain("base", "evm", true, &url, None)]);
        let vs = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let exec = OutboundExecutor::from_config(&cfg, test_router(&vs), vs);
        let confs = exec.adapters["base"].confirmations("0xabc").await.unwrap();
        assert_eq!(confs, 5); // 0x64 - 0x5f — only possible via the local URL
    }

    /// An explicit `contract_address` override must be honored — a
    /// receipt whose burn log is emitted by the CUSTOM contract is
    /// accepted; with the default wZION it would be rejected.
    #[tokio::test]
    async fn from_config_honors_contract_override() {
        let custom = "0x0000000000000000000000000000000000001234";
        let txh = format!("0x{}", "a".repeat(64));
        let from_topic = format!("0x{}{}", "0".repeat(24), "1".repeat(40));
        let log = evmfx::burn_log_json(
            &txh,
            "0x64",
            custom,
            false,
            &from_topic,
            evmfx::BURN,
            &evmfx::burn_data(1_000_000_000_000_000_000, "zion1dest", 9),
        );
        let receipt = evmfx::receipt_json(&txh, "0x64", "0x1", &[log]);
        let tip = r#"{"jsonrpc":"2.0","id":1,"result":"0x70"}"#.to_string();
        let url = evmfx::spawn_rpc(receipt, tip).await;
        let cfg = cfg_with(vec![chain("base", "evm", true, &url, Some(custom))]);
        let vs = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        let exec = OutboundExecutor::from_config(&cfg, test_router(&vs), vs);
        let sender = format!("0x{}", "1".repeat(40));
        let t = evmfx::inbound_transfer(&txh, &sender, evmfx::BURN, 1_000_000, "zion1dest");
        assert!(exec.adapters["base"].verify_burn(&t).await.is_ok());
    }
}
