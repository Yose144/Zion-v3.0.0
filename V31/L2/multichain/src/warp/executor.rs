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

    /// Single poll iteration: find QuorumReached transfers and execute them
    async fn poll_once(&self) -> WarpResult<()> {
        // Collect transfer IDs that are ready for execution
        let to_execute: Vec<_> = {
            let router = self.router.lock().await;
            router
                .list_pending()
                .into_iter()
                .filter(|t| t.status == WarpStatus::QuorumReached)
                .map(|t| t.id)
                .collect()
        };

        if to_execute.is_empty() {
            debug!("[Executor] No transfers in QuorumReached state");
            return Ok(());
        }

        info!(
            "[Executor] Found {} transfer(s) ready for execution",
            to_execute.len()
        );

        for transfer_id in to_execute {
            if let Err(e) = self.execute_transfer(transfer_id).await {
                error!(
                    "[Executor] Failed to execute transfer {}: {}",
                    transfer_id, e
                );

                // Mark as failed
                let mut router = self.router.lock().await;
                let _ = router.advance_transfer(transfer_id, WarpStatus::Failed);
            }
        }

        Ok(())
    }

    /// Execute a single outbound transfer
    async fn execute_transfer(&self, transfer_id: uuid::Uuid) -> WarpResult<()> {
        // Get transfer details and sign the WarpMessage
        let (transfer, warp_message, signatures) = {
            let router = self.router.lock().await;
            let transfer = router
                .get_transfer(&transfer_id)
                .ok_or_else(|| WarpError::TransferNotFound(transfer_id.to_string()))?
                .clone();

            // Build WarpMessage for signing
            let warp_message = WarpMessage {
                transfer_id,
                source_chain: transfer.source_chain.name.clone(),
                dest_chain: transfer.dest_chain.name.clone(),
                recipient: transfer.recipient.clone(),
                amount_flowers: transfer.amount_flowers,
                fee_flowers: transfer.fee_flowers,
                nonce: 0, // Would be managed by validator set in production
                timestamp: chrono::Utc::now().timestamp() as u64,
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
        })? as u128;

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

        // Update transfer status to Executing
        {
            let mut router = self.router.lock().await;
            router.advance_transfer(transfer_id, WarpStatus::Executing)?;
            if let Some(t) = router.get_transfer_mut(&transfer_id) {
                t.dest_tx_hash = Some(tx_hash.clone());
            }
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
}
