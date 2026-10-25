//! Outbound Transfer Executor
//!
//! Monitors the WarpRouter for transfers that have reached quorum and executes
//! the mint instruction on the destination chain.

use crate::warp::adapter::{create_adapter, ChainAdapter};
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
                .map(|t| t.id)
                .collect();
            let to_resume: Vec<_> = pending
                .iter()
                .filter(|t| t.status == WarpStatus::Executing)
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
            (transfer.dest_chain.name.clone(), transfer.dest_tx_hash.clone())
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
        // Executing transfers go through resume_transfer).
        {
            let mut router = self.router.lock().await;
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
        {
            let mut router = self.router.lock().await;
            router.set_dest_tx(&transfer_id, tx_hash.clone());
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
        };

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
mod tests {
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
        assert_ne!(deterministic_nonce(id), deterministic_nonce(uuid::Uuid::new_v4()));
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
}
