//! Relayer — submits cross-chain proofs for bridge operations.
//!
//! - L1→EVM: After L1 lock is confirmed + finalized, submits `submitLockProof()` to ZIONBridge.sol
//! - EVM→L1: After wZION burn is confirmed, submits L1 unlock TX + `confirmBurnRelease()` to ZIONBridge.sol

use crate::config::BridgeConfig;
use crate::config::ValidatorConfig;
use crate::evm_rpc::EvmHttpClient;
use crate::evm_tx::{build_and_sign_eip1559_tx, derive_evm_address, encode_confirm_burn_release, encode_submit_lock_proof, hash_to_bytes32};
use crate::types::{EvmBurnEvent, L1LockEvent};
use anyhow::Result;
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tracing::{error, info, warn};
use zeroize::Zeroizing;

/// Gas limit safety margin (multiply estimate by this fraction numerator/denominator).
const GAS_MARGIN_NUM: u64 = 130; // 130%
const GAS_MARGIN_DEN: u64 = 100;

/// Maximum gas price override (10 gwei safety cap for testnet).
const MAX_GAS_GWEI: u64 = 10;

#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    #[serde(default)]
    error: Option<Value>,
}

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
            crate::types::conversion::flowers_to_zion_display(lock.amount_flowers),
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
            &lock.amount_wzion_wei,
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
            .effective_rpc_url(&self.config.ankr);
        let evm = EvmHttpClient::from_rpc_url(&rpc_url);

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
            burn.amount_wzion_wei, burn.l1_recipient, burn.evm_chain, burn.burn_id,
        );

        let l1_amount = burn.amount_flowers;
        info!(
            "   Step 1: Submitting L1 unlock TX for {} ZION ({} atomic) to {}",
            crate::types::conversion::flowers_to_zion_display(l1_amount),
            l1_amount,
            burn.l1_recipient,
        );

        let unlock_request = json!({
            "recipient": burn.l1_recipient,
            "amount_flowers": l1_amount,
            "burn_id": burn.burn_id,
            "evm_chain": burn.evm_chain,
            "evm_tx_hash": burn.evm_tx_hash,
            "validator_proofs": self.build_validator_proofs(),
        });

        warn!(
            "submitBridgeUnlock is still scaffolded in V3 core; relayer is using placeholder validator proofs only to align transport with canonical RPC"
        );

        let l1_result: Value = self
            .l1_rpc("submitBridgeUnlock", unlock_request)
            .await
            .map_err(|e| anyhow::anyhow!("submitBridgeUnlock failed: {}", e))?;
        let l1_tx_hash = l1_result
            .get("tx_hash")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        info!(
            "   ✅ L1 unlock TX submitted — L1 TX: {}, amount: {} ZION",
            l1_tx_hash,
            crate::types::conversion::flowers_to_zion_display(l1_amount),
        );

// ── Step 2: Confirm burn release on ZIONBridge EVM contract via Ankr ──
        let chain_config = self
            .config
            .evm_chains
            .iter()
            .find(|c| c.chain_id == burn.evm_chain && c.enabled)
            .ok_or_else(|| anyhow::anyhow!("Burn chain '{}' not configured", burn.evm_chain))?;

        let rpc_url = chain_config
            .effective_rpc_url(&self.config.ankr);
        let evm = EvmHttpClient::from_rpc_url(&rpc_url);

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

        // ── Step 3: Submit confirmBurnRelease() to ZIONBridge EVM contract ──
        let key = load_validator_key(&self.config.validator).map_err(|e| {
            anyhow::anyhow!("Failed to load validator key: {}", e)
        })?;
        let validator_address = derive_evm_address(key.as_str())?;
        info!("   Validator address: {}", validator_address);

        // ABI-encode confirmBurnRelease(bytes32 burnId, address evmBurner, uint256 amount, string l1Recipient)
        let burn_id_bytes = hash_to_bytes32(&burn.burn_id);
        let calldata = encode_confirm_burn_release(
            &burn_id_bytes,
            &burn.evm_burner,
            &burn.amount_wzion_wei,
            &burn.l1_recipient,
        )?;
        let calldata_hex = format!("0x{}", hex::encode(&calldata));

        info!(
            "   confirmBurnRelease calldata: {} bytes — bridge: {}",
            calldata.len(),
            chain_config.bridge_contract_address
        );

        // EVM HTTP client
        let rpc_url = chain_config
            .rpc_url
            .as_deref()
            .unwrap_or("https://base-sepolia.publicnode.com");
        let evm = EvmHttpClient::from_rpc_url(rpc_url);

        // Get nonce + gas params
        let nonce = evm.get_nonce(&validator_address).await
            .map_err(|e| anyhow::anyhow!("confirmBurnRelease: get_nonce failed: {}", e))?;
        let base_fee = evm.get_gas_price().await.unwrap_or(2_000_000_000);
        let priority_fee = evm.get_max_priority_fee().await.unwrap_or(1_500_000_000);
        let max_fee_cap = MAX_GAS_GWEI * 1_000_000_000;
        let max_fee = (2 * base_fee + priority_fee).min(max_fee_cap);
        let max_priority = priority_fee.min(max_fee);

        let gas_estimate = evm
            .estimate_gas(&validator_address, &chain_config.bridge_contract_address, &calldata_hex)
            .await
            .unwrap_or(150_000);
        let gas_limit = gas_estimate * GAS_MARGIN_NUM / GAS_MARGIN_DEN;

        info!(
            "   Gas: nonce={} base_fee={} gwei priority={} gwei estimate={} limit={}",
            nonce,
            base_fee / 1_000_000_000,
            priority_fee / 1_000_000_000,
            gas_estimate,
            gas_limit,
        );

        // Build + sign + submit EIP-1559 TX
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

        let cbr_tx_hash = evm.send_raw_transaction(&raw_tx).await
            .map_err(|e| anyhow::anyhow!("confirmBurnRelease TX submit failed: {}", e))?;

        info!(
            "   ✅ confirmBurnRelease TX submitted! hash: {} | chain: {} | burn_id: {} | L1 TX: {}",
            cbr_tx_hash,
            chain_config.name,
            burn.burn_id,
            l1_tx_hash,
        );

        // Poll for receipt in background
        tokio::spawn({
            let evm_url = rpc_url.to_string();
            let tx = cbr_tx_hash.clone();
            let chain_name = chain_config.name.clone();
            let burn_id = burn.burn_id.clone();
            async move {
                let evm2 = EvmHttpClient::from_rpc_url(&evm_url);
                for attempt in 1..=20 {
                    tokio::time::sleep(std::time::Duration::from_secs(6)).await;
                    match evm2.get_receipt(&tx).await {
                        Ok(Some(receipt)) => {
                            let status = receipt["status"].as_str().unwrap_or("0x0");
                            if status == "0x1" {
                                info!("   🟢 confirmBurnRelease CONFIRMED on {} (attempt {}) — burn_id: {} tx: {}",
                                    chain_name, attempt, burn_id, tx);
                            } else {
                                error!("   🔴 confirmBurnRelease REVERTED on {} (attempt {}) — burn_id: {} tx: {}",
                                    chain_name, attempt, burn_id, tx);
                            }
                            return;
                        }
                        Ok(None) => {
                            if attempt < 20 { continue; }
                            warn!("   ⏱️ confirmBurnRelease receipt not found after 20 attempts — tx: {}", tx);
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

    fn build_validator_proofs(&self) -> Vec<Value> {
        let threshold = usize::from(self.config.validator.threshold.max(3));
        let mut proofs = Vec::with_capacity(threshold);

        for index in 0..threshold {
            let fallback_id = format!("validator-{}", index + 1);
            let validator_id = if index == 0 && !self.config.validator.validator_id.is_empty() {
                self.config.validator.validator_id.clone()
            } else {
                fallback_id
            };
            let validator_address = self
                .config
                .validator
                .validator_addresses
                .get(index)
                .cloned();

            proofs.push(json!({
                "validator_id": validator_id,
                "validator_address": validator_address,
                "signature": "pending-core-unlock-validation",
            }));
        }

        proofs
    }

    async fn l1_rpc<T: DeserializeOwned>(&self, method: &str, params: Value) -> Result<T> {
        let address = normalize_rpc_addr(&self.config.l1.rpc_url);
        let mut stream = TcpStream::connect(&address)
            .await
            .map_err(|e| anyhow::anyhow!("RPC connect failed to {}: {}", address, e))?;

        let request = serde_json::to_string(&json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1,
        }))?;

        stream.write_all(request.as_bytes()).await?;
        stream.write_all(b"\n").await?;

        let mut reader = BufReader::new(stream);
        let mut line = String::new();
        reader.read_line(&mut line).await?;

        let response: RpcResponse<T> = serde_json::from_str(line.trim())?;
        if let Some(err) = response.error {
            return Err(anyhow::anyhow!("RPC error: {}", err));
        }

        response
            .result
            .ok_or_else(|| anyhow::anyhow!("RPC returned null result"))
    }
}

fn normalize_rpc_addr(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    let trimmed = trimmed.strip_suffix("/jsonrpc").unwrap_or(trimmed);
    trimmed
        .strip_prefix("tcp://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed)
        .to_string()
}
