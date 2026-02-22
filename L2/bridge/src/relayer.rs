//! Relayer — submits cross-chain proofs for bridge operations.
//!
//! - L1→EVM: After L1 lock is confirmed + finalized, submits `submitLockProof()` to ZIONBridge.sol
//! - EVM→L1: After wZION burn is confirmed, submits L1 unlock TX + `confirmBurnRelease()` to ZIONBridge.sol

use crate::config::{BridgeConfig, ValidatorConfig};
use crate::types::{EvmBurnEvent, L1LockEvent};
use anyhow::Result;
use ethers::prelude::*;
use serde_json;
use zeroize::Zeroizing;

/// Load the validator private key securely.
///
/// Priority:
///   1. `ZION_VALIDATOR_PRIVATE_KEY` env var (preferred for containers/CI)
///   2. File at `config.validator.private_key_file`
///
/// On Unix the file must have mode 0o600 (owner-only read/write) or startup aborts.
/// The returned `Zeroizing<String>` is automatically wiped from memory when dropped.
fn load_validator_key(config: &ValidatorConfig) -> anyhow::Result<Zeroizing<String>> {
    // --- Env var ---
    if let Ok(key) = std::env::var("ZION_VALIDATOR_PRIVATE_KEY") {
        if !key.trim().is_empty() {
            tracing::info!("🔑 Validator key loaded from ZION_VALIDATOR_PRIVATE_KEY env var");
            return Ok(Zeroizing::new(key.trim().to_string()));
        }
    }

    // --- File ---
    let path = &config.private_key_file;

    // Unix: enforce 0o600 file permissions
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let meta = std::fs::metadata(path).map_err(|e| {
            anyhow::anyhow!("Cannot stat key file {:?}: {}", path, e)
        })?;
        let mode = meta.mode() & 0o777;
        if mode != 0o600 {
            anyhow::bail!(
                "🚨 Key file {:?} has insecure permissions {:o} — expected 0o600. \
                 Run: chmod 600 {:?}",
                path, mode, path
            );
        }
    }

    let raw = std::fs::read_to_string(path)
        .map_err(|e| anyhow::anyhow!("Cannot read key file {:?}: {}", path, e))?;
    tracing::info!("🔑 Validator key loaded from file {:?}", path);
    Ok(Zeroizing::new(raw.trim().to_string()))
}
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

// ABI for the ZIONBridge contract
abigen!(
    ZIONBridgeContract,
    r#"[
        function submitLockProof(bytes32 l1TxHash, address recipient, uint256 amount, uint256 l1BlockHeight, string l1Sender) external
        function confirmBurnRelease(bytes32 burnId, address evmBurner, uint256 amount, string l1Recipient) external
        function getLockProofStatus(bytes32 l1TxHash) external view returns (uint8 confirmations, bool executed, bool timelocked, uint256 timelockExpiry, address recipient, uint256 amount)
        function getBurnReleaseStatus(bytes32 burnId) external view returns (uint8 confirmations, bool released, address evmBurner, uint256 amount, string l1Recipient)
    ]"#
);

/// Bridge relayer that processes lock and burn events.
pub struct Relayer {
    config: Arc<BridgeConfig>,
}

impl Relayer {
    pub fn new(config: Arc<BridgeConfig>) -> Self {
        Self { config }
    }

    /// Start the relayer — listens for events from both watchers and submits proofs.
    pub async fn run(
        &self,
        mut lock_rx: mpsc::Receiver<L1LockEvent>,
        mut burn_rx: mpsc::Receiver<EvmBurnEvent>,
    ) -> Result<()> {
        info!("🔗 Bridge Relayer started — processing lock and burn events");

        loop {
            tokio::select! {
                // Process L1 lock events → submit mint proof to EVM
                Some(lock) = lock_rx.recv() => {
                    match self.handle_l1_lock(lock).await {
                        Ok(()) => {}
                        Err(e) => error!("Failed to handle L1 lock: {:?}", e),
                    }
                }

                // Process EVM burn events → submit unlock to L1
                Some(burn) = burn_rx.recv() => {
                    match self.handle_evm_burn(burn).await {
                        Ok(()) => {}
                        Err(e) => error!("Failed to handle EVM burn: {:?}", e),
                    }
                }

                else => {
                    warn!("Relayer: all channels closed, shutting down");
                    break;
                }
            }
        }

        Ok(())
    }

    /// Handle an L1 lock event: submit proof to ZIONBridge on EVM.
    async fn handle_l1_lock(&self, lock: L1LockEvent) -> Result<()> {
        info!(
            "📤 Processing L1→EVM lock: {} ZION → {} on {} (TX: {})",
            crate::types::conversion::atomic_to_zion_display(lock.amount_atomic),
            lock.evm_recipient,
            lock.target_chain,
            lock.l1_tx_hash,
        );

        // Find the target EVM chain config
        let chain_config = self
            .config
            .evm_chains
            .iter()
            .find(|c| c.chain_id == lock.target_chain && c.enabled)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Target chain '{}' not configured or disabled",
                    lock.target_chain
                )
            })?;

        // Connect to EVM chain
        let provider = Provider::<Http>::try_from(&chain_config.rpc_url)?;
        let chain_id = chain_config.evm_chain_id;

        // Load validator private key securely (env var or file, zeroized after use)
        let key_secret = load_validator_key(&self.config.validator)?;
        let wallet: LocalWallet = key_secret
            .as_str()
            .parse::<LocalWallet>()?
            .with_chain_id(chain_id);

        let client = SignerMiddleware::new(provider, wallet);
        let client = Arc::new(client);

        // Connect to ZIONBridge contract
        let bridge_addr: Address = chain_config.bridge_contract_address.parse()?;
        let bridge = ZIONBridgeContract::new(bridge_addr, client);

        // Prepare parameters
        let l1_tx_hash: [u8; 32] = hex::decode(&lock.l1_tx_hash)?
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid L1 TX hash length"))?;

        let recipient: Address = lock.evm_recipient.parse()?;
        let amount = U256::from_dec_str(&lock.amount_wzion)?;

        // Submit lock proof
        info!(
            "   Submitting lock proof to ZIONBridge on {} (bridge: {})",
            chain_config.name, chain_config.bridge_contract_address
        );

        let tx = bridge.submit_lock_proof(
            l1_tx_hash,
            recipient,
            amount,
            U256::from(lock.l1_block_height),
            lock.l1_sender.clone(),
        );

        let pending = tx.send().await?;
        let receipt = pending.await?;

        match receipt {
            Some(r) => {
                info!(
                    "   ✅ Lock proof submitted — EVM TX: {:?}, gas: {:?}",
                    r.transaction_hash, r.gas_used,
                );
            }
            None => {
                warn!("   ⚠️ Lock proof TX sent but no receipt");
            }
        }

        Ok(())
    }

    /// Handle an EVM burn event: submit unlock on L1 + confirm on ZIONBridge.
    async fn handle_evm_burn(&self, burn: EvmBurnEvent) -> Result<()> {
        info!(
            "📤 Processing EVM→L1 burn: {} wZION → {} on L1 (chain: {}, burn_id: {})",
            burn.amount_wzion, burn.l1_recipient, burn.evm_chain, burn.burn_id,
        );

        // ── Step 1: Submit L1 unlock transaction via L1 RPC ──────────
        //
        // POST to L1 node RPC: /api/bridge/unlock
        // The L1 node has a bridge vault that holds locked ZION.
        // When the bridge relay requests an unlock, the node creates
        // a TX from the vault to l1_recipient for the specified amount.
        //
        // L1 RPC format:
        //   POST /api/bridge/unlock
        //   { "recipient": "zion1q...", "amount_atomic": 1000000000, "burn_id": "0x...", "evm_chain": "base" }
        //   Response: { "tx_hash": "abc123...", "status": "submitted" }

        let l1_amount = burn.amount_l1_atomic;
        info!(
            "   Step 1: Submitting L1 unlock TX for {} ZION ({} atomic) to {}",
            crate::types::conversion::atomic_to_zion_display(l1_amount),
            l1_amount,
            burn.l1_recipient,
        );

        let l1_rpc_url = format!(
            "{}/api/bridge/unlock",
            self.config.l1.rpc_url.trim_end_matches('/')
        );

        let unlock_request = serde_json::json!({
            "recipient": burn.l1_recipient,
            "amount_atomic": l1_amount,
            "burn_id": burn.burn_id,
            "evm_chain": burn.evm_chain,
            "evm_tx_hash": burn.evm_tx_hash,
            "validator_id": self.config.validator.validator_id,
        });

        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let mut request_builder = http_client
            .post(&l1_rpc_url)
            .json(&unlock_request);

        // Attach Bearer token if configured (ZION_RPC_TOKEN on L1 node)
        if let Some(token) = &self.config.l1.l1_rpc_token {
            request_builder = request_builder
                .header("Authorization", format!("Bearer {}", token));
        }

        let l1_response = request_builder
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("L1 unlock RPC failed: {}", e))?;

        if !l1_response.status().is_success() {
            let status = l1_response.status();
            let body = l1_response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "L1 unlock RPC returned {}: {}",
                status,
                body
            ));
        }

        let l1_result: serde_json::Value = l1_response.json().await?;
        let l1_tx_hash = l1_result
            .get("tx_hash")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        info!(
            "   ✅ L1 unlock TX submitted — L1 TX: {}, amount: {} ZION",
            l1_tx_hash,
            crate::types::conversion::atomic_to_zion_display(l1_amount),
        );

        // ── Step 2: Confirm burn release on ZIONBridge EVM contract ──
        let chain_config = self
            .config
            .evm_chains
            .iter()
            .find(|c| c.chain_id == burn.evm_chain && c.enabled)
            .ok_or_else(|| anyhow::anyhow!("Burn chain '{}' not configured", burn.evm_chain))?;

        let provider = Provider::<Http>::try_from(&chain_config.rpc_url)?;
        // Load validator private key securely (env var or file, zeroized after use)
        let key_secret = load_validator_key(&self.config.validator)?;
        let wallet: LocalWallet = key_secret
            .as_str()
            .parse::<LocalWallet>()?
            .with_chain_id(chain_config.evm_chain_id);

        let client = SignerMiddleware::new(provider, wallet);
        let client = Arc::new(client);

        let bridge_addr: Address = chain_config.bridge_contract_address.parse()?;
        let bridge = ZIONBridgeContract::new(bridge_addr, client);

        let burn_id: [u8; 32] = hex::decode(burn.burn_id.trim_start_matches("0x"))?
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid burn ID length"))?;

        let evm_burner: Address = burn.evm_burner.parse()?;
        let amount = U256::from_dec_str(&burn.amount_wzion)?;

        let tx =
            bridge.confirm_burn_release(burn_id, evm_burner, amount, burn.l1_recipient.clone());

        let pending = tx.send().await?;
        let receipt = pending.await?;

        match receipt {
            Some(r) => {
                info!(
                    "   ✅ Burn release confirmed — EVM TX: {:?}, L1 TX: {}",
                    r.transaction_hash, l1_tx_hash,
                );
            }
            None => {
                warn!("   ⚠️ Burn release TX sent but no receipt");
            }
        }

        Ok(())
    }
}
