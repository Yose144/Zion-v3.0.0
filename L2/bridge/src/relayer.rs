//! Relayer — submits cross-chain proofs for bridge operations.
//!
//! - L1→EVM: After L1 lock is confirmed + finalized, submits `submitLockProof()` to ZIONBridge.sol
//! - EVM→L1: After wZION burn is confirmed, submits L1 unlock TX + `confirmBurnRelease()` to ZIONBridge.sol

use crate::config::BridgeConfig;
use crate::config::ValidatorConfig;
use crate::evm_rpc::EvmHttpClient;
use crate::evm_tx::{build_and_sign_eip1559_tx, derive_evm_address, encode_submit_lock_proof, hash_to_bytes32};
use crate::types::{EvmBurnEvent, L1LockEvent};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};
use zeroize::Zeroizing;

/// Gas limit safety margin (multiply estimate by this fraction numerator/denominator).
const GAS_MARGIN_NUM: u64 = 130; // 130%
const GAS_MARGIN_DEN: u64 = 100;

/// Maximum gas price override (10 gwei safety cap for testnet).
const MAX_GAS_GWEI: u64 = 10;

/// Load the validator private key securely.
///
/// Priority:
///   1. `ZION_VALIDATOR_PRIVATE_KEY` env var (preferred for containers/CI)
///   2. File at `config.validator.private_key_file`
///
/// The returned `Zeroizing<String>` is automatically wiped from memory when dropped.
fn load_validator_key(config: &ValidatorConfig) -> anyhow::Result<Zeroizing<String>> {
    if let Ok(key) = std::env::var("ZION_VALIDATOR_PRIVATE_KEY") {
        if !key.trim().is_empty() {
            tracing::info!("🔑 Validator key loaded from ZION_VALIDATOR_PRIVATE_KEY env var");
            return Ok(Zeroizing::new(key.trim().to_string()));
        }
    }

    let path = &config.private_key_file;

    // Unix: enforce 0o600 file permissions
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let meta = std::fs::metadata(path)
            .map_err(|e| anyhow::anyhow!("Cannot stat key file {:?}: {}", path, e))?;
        let mode = meta.mode() & 0o777;
        if mode != 0o600 {
            anyhow::bail!(
                "🚨 Key file {:?} has insecure permissions {:o} — expected 0o600. \
                 Run: chmod 600 {:?}",
                path,
                mode,
                path
            );
        }
    }

    let raw = std::fs::read_to_string(path)
        .map_err(|e| anyhow::anyhow!("Cannot read key file {:?}: {}", path, e))?;
    tracing::info!("🔑 Validator key loaded from file {:?}", path);
    Ok(Zeroizing::new(raw.trim().to_string()))
}

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

    /// Handle an L1 lock event: encode + sign + submit `submitLockProof()` to ZIONBridge.
    async fn handle_l1_lock(&self, lock: L1LockEvent) -> Result<()> {
        info!(
            "📤 Processing L1→EVM lock: {} ZION → {} on {} (TX: {})",
            crate::types::conversion::atomic_to_zion_display(lock.amount_atomic),
            lock.evm_recipient,
            lock.target_chain,
            lock.l1_tx_hash,
        );

        // ── Find EVM chain config ─────────────────────────────────────
        let chain_config = self
            .config
            .evm_chains
            .iter()
            .find(|c| c.chain_id == lock.target_chain && c.enabled)
            .ok_or_else(|| anyhow::anyhow!("Target chain '{}' not configured or disabled", lock.target_chain))?;

        // ── Load validator key ────────────────────────────────────────
        let key = load_validator_key(&self.config.validator)?;
        let validator_address = derive_evm_address(key.as_str())?;
        info!("   Validator address: {}", validator_address);

        // ── Build calldata ────────────────────────────────────────────
        let l1_tx_hash_bytes = hash_to_bytes32(&lock.l1_tx_hash);
        let calldata = encode_submit_lock_proof(
            &l1_tx_hash_bytes,
            &lock.evm_recipient,
            &lock.amount_wzion,
            lock.l1_block_height,
            &lock.l1_sender,
        )?;
        let calldata_hex = format!("0x{}", hex::encode(&calldata));

        info!(
            "   Calldata: {} bytes — bridge: {}",
            calldata.len(),
            chain_config.bridge_contract_address
        );

        // ── Setup EVM HTTP client ─────────────────────────────────────
        let rpc_url = chain_config
            .rpc_url
            .as_deref()
            .unwrap_or("https://base-sepolia.publicnode.com");
        let evm = EvmHttpClient::from_rpc_url(rpc_url);

        // ── Get nonce ─────────────────────────────────────────────────
        let nonce = evm.get_nonce(&validator_address).await
            .map_err(|e| anyhow::anyhow!("Failed to get nonce: {}", e))?;
        info!("   Nonce: {}", nonce);

        // ── Get gas params ────────────────────────────────────────────
        let base_fee = evm.get_gas_price().await.unwrap_or(2_000_000_000); // 2 gwei default
        let priority_fee = evm.get_max_priority_fee().await.unwrap_or(1_500_000_000); // 1.5 gwei default
        // max_fee = 2 * base_fee + priority_fee (common formula), capped at MAX_GAS_GWEI
        let max_fee_cap = MAX_GAS_GWEI * 1_000_000_000;
        let max_fee = (2 * base_fee + priority_fee).min(max_fee_cap);
        let max_priority = priority_fee.min(max_fee);
        info!("   Gas: base_fee={} gwei, priority={} gwei, max_fee={} gwei",
            base_fee / 1_000_000_000, priority_fee / 1_000_000_000, max_fee / 1_000_000_000);

        // ── Estimate gas ──────────────────────────────────────────────
        let gas_estimate = evm
            .estimate_gas(&validator_address, &chain_config.bridge_contract_address, &calldata_hex)
            .await
            .unwrap_or(200_000); // fallback to 200k gas if estimation fails
        let gas_limit = gas_estimate * GAS_MARGIN_NUM / GAS_MARGIN_DEN;
        info!("   Gas estimate: {} → limit with margin: {}", gas_estimate, gas_limit);

        // ── Build + sign EIP-1559 TX ──────────────────────────────────
        let raw_tx = build_and_sign_eip1559_tx(
            chain_config.evm_chain_id,
            nonce,
            max_priority,
            max_fee,
            gas_limit,
            &chain_config.bridge_contract_address,
            &calldata,
            key.as_str(),
        )?;
        info!("   Signed TX: {} bytes (0x02...)", raw_tx.len() / 2);

        // ── Submit TX ─────────────────────────────────────────────────
        let tx_hash = evm.send_raw_transaction(&raw_tx).await
            .map_err(|e| anyhow::anyhow!("Failed to submit submitLockProof TX: {}", e))?;

        info!(
            "   ✅ submitLockProof TX submitted! hash: {} | chain: {} | bridge: {}",
            tx_hash,
            chain_config.name,
            chain_config.bridge_contract_address,
        );

        // ── Poll for receipt ──────────────────────────────────────────
        tokio::spawn({
            let evm_url = rpc_url.to_string();
            let tx = tx_hash.clone();
            let chain_name = chain_config.name.clone();
            async move {
                let evm2 = EvmHttpClient::from_rpc_url(&evm_url);
                for attempt in 1..=20 {
                    tokio::time::sleep(std::time::Duration::from_secs(6)).await;
                    match evm2.get_receipt(&tx).await {
                        Ok(Some(receipt)) => {
                            let status = receipt["status"].as_str().unwrap_or("0x0");
                            if status == "0x1" {
                                info!("   🟢 submitLockProof CONFIRMED on {} (attempt {}) — tx: {}", chain_name, attempt, tx);
                            } else {
                                error!("   🔴 submitLockProof REVERTED on {} (attempt {}) — tx: {}", chain_name, attempt, tx);
                            }
                            return;
                        }
                        Ok(None) => {
                            if attempt < 20 {
                                continue; // not mined yet
                            }
                            warn!("   ⏱️ submitLockProof receipt not found after 20 attempts — tx: {}", tx);
                        }
                        Err(e) => {
                            warn!("   Receipt poll error (attempt {}): {}", attempt, e);
                        }
                    }
                }
            }
        });

        Ok(())
    }

    /// Handle an EVM burn event: submit L1 unlock TX and confirm on ZIONBridge.
    async fn handle_evm_burn(&self, burn: EvmBurnEvent) -> Result<()> {
        info!(
            "📤 Processing EVM→L1 burn: {} wZION → {} on L1 (chain: {}, burn_id: {})",
            burn.amount_wzion, burn.l1_recipient, burn.evm_chain, burn.burn_id,
        );

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

// ── Step 2: Confirm burn release on ZIONBridge EVM contract via Ankr ──
        let chain_config = self
            .config
            .evm_chains
            .iter()
            .find(|c| c.chain_id == burn.evm_chain && c.enabled)
            .ok_or_else(|| anyhow::anyhow!("Burn chain '{}' not configured", burn.evm_chain))?;

        let rpc_url = chain_config
            .rpc_url
            .as_deref()
            .unwrap_or("https://base-sepolia.publicnode.com");
        let evm = EvmHttpClient::from_rpc_url(rpc_url);

        // Verify burn tx receipt exists on EVM
        match evm.get_receipt(&burn.evm_tx_hash).await {
            Ok(Some(receipt)) => {
                let status = receipt["status"].as_str().unwrap_or("0x0");
                if status == "0x1" {
                    info!(
                        "   ✅ Burn TX confirmed on {} — tx: {}",
                        chain_config.name, burn.evm_tx_hash
                    );
                } else {
                    warn!(
                        "   ⚠️ Burn TX {} reverted on {} — skipping confirmBurnRelease",
                        burn.evm_tx_hash, chain_config.name
                    );
                    return Ok(());
                }
            }
            Ok(None) => {
                warn!(
                    "   ⚠️ Burn TX {} not yet mined on {} — deferring",
                    burn.evm_tx_hash, chain_config.name
                );
                return Ok(());
            }
            Err(e) => {
                warn!("   ⚠️ Failed to fetch burn receipt: {}", e);
            }
        }

        // Load validator key (kept in Zeroizing memory, wiped on drop)
        let _key = load_validator_key(&self.config.validator).map_err(|e| {
            anyhow::anyhow!("Failed to load validator key: {}", e)
        })?;

        // TODO[L2-ankr]: Encode and submit confirmBurnRelease() via eth_sendRawTransaction.
        //
        // Full implementation steps:
        //   1. ABI-encode: confirmBurnRelease(burnId, evmBurner, amount, l1Recipient)
        //   2. Sign transaction with validator key (secp256k1 + RLP encoding)
        //   3. ankr.send_raw_transaction(&burn.evm_chain, &raw_tx).await?
        info!(
            "   ✅ Burn release logged — burn_id: {}, L1 TX: {}",
            burn.burn_id, l1_tx_hash,
        );

        Ok(())
    }
}
