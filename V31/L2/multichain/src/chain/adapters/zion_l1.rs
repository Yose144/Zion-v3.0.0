//! ZION L1 adapter — JSON-RPC over HTTP.
//!
//! Mainnet Alpha capabilities:
//! - read chain height, account balance, tx confirmations,
//! - watch bridge lock events via `getBridgeLocks`,
//! - submit `submitBridgeUnlock` with an EVM validator proof from the keyring.

use async_trait::async_trait;
use ed25519_dalek::SigningKey;
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};

use zion_core::v31_wallet::{build_htlc_claim, build_htlc_lock, build_htlc_refund, SpendableUtxo};
use zion_l1_types::{Address, Amount, Asset, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{BlockTemplate, ChainAdapter, DepositEvent};
use crate::error::{MultichainError, MultichainResult};
use crate::types::{Transfer, TransferDirection};
use crate::wallet::Keyring;

/// ZION L1 JSON-RPC adapter.
pub struct ZionL1Adapter {
    rpc_url: String,
    client: reqwest::Client,
    request_id: std::sync::atomic::AtomicU64,
    nonce: std::sync::atomic::AtomicU64,
    keyring: Keyring,
}

impl ZionL1Adapter {
    pub fn new(rpc_url: impl Into<String>, keyring: Keyring) -> Self {
        Self {
            rpc_url: rpc_url.into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .expect("valid reqwest client"),
            request_id: std::sync::atomic::AtomicU64::new(1),
            nonce: std::sync::atomic::AtomicU64::new(1),
            keyring,
        }
    }

    async fn call<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> MultichainResult<T> {
        let id = self
            .request_id
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let resp = self
            .client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(format!("zion rpc request failed: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            return Err(MultichainError::Internal(format!(
                "zion rpc returned {}",
                status
            )));
        }

        // Read the body as text first so we can diagnose malformed responses
        // and (for `serde_json::Value` targets) fall back to a bare payload.
        let text = resp
            .text()
            .await
            .map_err(|e| MultichainError::Internal(format!("zion rpc body read failed: {e}")))?;

        let envelope = serde_json::from_str::<JsonRpcResponse<T>>(&text).or_else(|e| {
            // Some node responses are bare JSON values instead of a full
            // JSON-RPC envelope. Try that as a fallback before giving up.
            if let Ok(bare) = serde_json::from_str::<T>(&text) {
                return Ok(JsonRpcResponse {
                    result: Some(bare),
                    error: None,
                    _jsonrpc: None,
                    _id: None,
                });
            }
            let preview = if text.len() > 500 {
                &text[..500]
            } else {
                &text
            };
            Err(MultichainError::Internal(format!(
                "zion rpc decode failed for method {} (status {}): {}. body preview: {}",
                method, status, e, preview
            )))
        })?;

        match (envelope.result, envelope.error) {
            (Some(result), _) => Ok(result),
            (None, Some(err)) => {
                let code = err.code.unwrap_or(0);
                Err(MultichainError::Internal(format!(
                    "zion rpc error {}: {}",
                    code, err.message
                )))
            }
            (None, None) => Err(MultichainError::Internal(
                "zion rpc empty response".to_string(),
            )),
        }
    }

    fn validate_address(&self, addr: &Address) -> MultichainResult<()> {
        if addr.chain != ChainId::ZionL1 {
            return Err(MultichainError::Validation(format!(
                "expected zion-l1 address, got {}",
                addr.chain.as_str()
            )));
        }
        Ok(())
    }

    fn chain_name(chain: ChainId) -> &'static str {
        match chain {
            ChainId::Base => "base",
            ChainId::Ethereum => "ethereum",
            _ => "unknown",
        }
    }

    pub(crate) fn adapter_address(&self) -> MultichainResult<Address> {
        self.keyring.address(ChainId::ZionL1, 0, 0)
    }

    pub(crate) async fn get_spendable_utxos(&self, address: &str) -> MultichainResult<Vec<SpendableUtxo>> {
        let resp: serde_json::Value = self.call("getUtxos", json!({"address": address})).await?;
        let utxos = resp
            .get("utxos")
            .and_then(|v| v.as_array())
            .ok_or_else(|| MultichainError::Internal("zion getUtxos missing utxos array".to_string()))?;

        let mut out = Vec::with_capacity(utxos.len());
        for u in utxos {
            let tx_hash_hex = u
                .get("tx_hash")
                .and_then(|v| v.as_str())
                .ok_or_else(|| MultichainError::Internal("utxo missing tx_hash".to_string()))?;
            let tx_hash = hex::decode(tx_hash_hex)
                .map_err(|e| MultichainError::Internal(format!("invalid utxo tx_hash hex: {e}")))?
                .try_into()
                .map_err(|_| MultichainError::Internal("utxo tx_hash must be 32 bytes".to_string()))?;

            let output_index = u
                .get("output_index")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| MultichainError::Internal("utxo missing output_index".to_string()))? as u32;

            let amount = u
                .get("amount")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| MultichainError::Internal("utxo missing amount".to_string()))?;

            let block_height = u.get("block_height").and_then(|v| v.as_u64()).unwrap_or(0);
            let is_coinbase = u.get("is_coinbase").and_then(|v| v.as_bool()).unwrap_or(false);

            out.push(SpendableUtxo {
                tx_hash,
                output_index,
                amount,
                address: address.to_string(),
                script: hex::decode(u.get("script_hex").and_then(|v| v.as_str()).unwrap_or(""))
                    .unwrap_or_default(),
                block_height,
                is_coinbase,
            });
        }
        Ok(out)
    }

    pub(crate) async fn submit_utxo_transaction(
        &self,
        tx: zion_core::Transaction,
    ) -> MultichainResult<Hash> {
        let tx_json = serde_json::to_value(&tx)
            .map_err(|e| MultichainError::Internal(format!("serialize utxo tx: {e}")))?;
        let resp: serde_json::Value = self
            .call("submitUtxoTransaction", json!({"transaction": tx_json}))
            .await?;

        let accepted = resp.get("accepted").and_then(|v| v.as_bool()).unwrap_or(false);
        if !accepted {
            let reason = resp
                .get("reason")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            return Err(MultichainError::Internal(format!(
                "submitUtxoTransaction rejected: {reason}"
            )));
        }

        let tx_id = resp
            .get("tx_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| MultichainError::Internal("submitUtxoTransaction missing tx_id".to_string()))?;
        Hash::from_hex(tx_id)
            .ok_or_else(|| MultichainError::Internal("invalid tx_id hex from submitUtxoTransaction".to_string()))
    }

    pub(crate) fn zion_signing_key(&self) -> MultichainResult<SigningKey> {
        self.keyring.zion_signing_key(0, 0)
    }

    fn htlc_hashlock(transfer: &Transfer) -> MultichainResult<[u8; 32]> {
        let hash = transfer.hashlock.ok_or_else(|| {
            MultichainError::Validation("HTLC transfer missing hashlock".to_string())
        })?;
        Ok(hash.0)
    }

    fn htlc_timelock(transfer: &Transfer) -> MultichainResult<u64> {
        transfer
            .timelock
            .ok_or_else(|| MultichainError::Validation("HTLC transfer missing timelock".to_string()))
    }

    async fn htlc_lock(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        let hashlock = Self::htlc_hashlock(transfer)?;
        let timeout = Self::htlc_timelock(transfer)?;
        let refund_pk = transfer.source_pubkey.ok_or_else(|| {
            MultichainError::Validation(
                "HTLC lock missing source_pubkey (refund key) for native L1 script".to_string(),
            )
        })?;
        let claimant_pk = transfer.target_pubkey.ok_or_else(|| {
            MultichainError::Validation(
                "HTLC lock missing target_pubkey (claimant key) for native L1 script".to_string(),
            )
        })?;

        let from = self.adapter_address()?.encoded;
        let utxos = self.get_spendable_utxos(&from).await?;
        if utxos.is_empty() {
            return Err(MultichainError::Internal(
                "no spendable UTXOs for zion-l1 adapter".to_string(),
            ));
        }

        let amount = transfer.source.amount.0 as u64;
        const FEE_ZION: u64 = 1_000_000; // 1 ZION in flowers
        let signing_key = self.zion_signing_key()?;
        let build = build_htlc_lock(
            &signing_key,
            &from,
            amount,
            FEE_ZION,
            &utxos,
            &hashlock,
            timeout,
            &claimant_pk,
            &refund_pk,
        )
        .map_err(|e| MultichainError::Internal(format!("build zion htlc lock: {e}")))?;

        self.submit_utxo_transaction(build.transaction).await
    }

    async fn htlc_claim(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        let hashlock = Self::htlc_hashlock(transfer)?;
        let timeout = Self::htlc_timelock(transfer)?;
        let preimage = transfer
            .preimage
            .ok_or_else(|| MultichainError::Validation("HTLC claim missing preimage".to_string()))?;
        let claimant_pk = transfer.target_pubkey.ok_or_else(|| {
            MultichainError::Validation(
                "HTLC claim missing target_pubkey (claimant key)".to_string(),
            )
        })?;
        let refund_pk = transfer.source_pubkey.ok_or_else(|| {
            MultichainError::Validation("HTLC claim missing source_pubkey (refund key)".to_string())
        })?;

        let lock_utxo = self.lock_utxo_for_transfer(transfer).await?;
        const FEE_ZION: u64 = 1_000_000;
        let signing_key = self.zion_signing_key()?;
        let tx = build_htlc_claim(
            &signing_key,
            FEE_ZION,
            &lock_utxo,
            &hashlock,
            timeout,
            &claimant_pk,
            &refund_pk,
            &preimage.0,
        )
        .map_err(|e| MultichainError::Internal(format!("build zion htlc claim: {e}")))?;

        self.submit_utxo_transaction(tx).await
    }

    async fn htlc_refund(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        let hashlock = Self::htlc_hashlock(transfer)?;
        let timeout = Self::htlc_timelock(transfer)?;
        let claimant_pk = transfer.target_pubkey.ok_or_else(|| {
            MultichainError::Validation(
                "HTLC refund missing target_pubkey (claimant key)".to_string(),
            )
        })?;
        let refund_pk = transfer.source_pubkey.ok_or_else(|| {
            MultichainError::Validation(
                "HTLC refund missing source_pubkey (refund key)".to_string(),
            )
        })?;

        let lock_utxo = self.lock_utxo_for_transfer(transfer).await?;
        const FEE_ZION: u64 = 1_000_000;
        let signing_key = self.zion_signing_key()?;
        let tx = build_htlc_refund(
            &signing_key,
            FEE_ZION,
            &lock_utxo,
            &hashlock,
            timeout,
            &claimant_pk,
            &refund_pk,
        )
        .map_err(|e| MultichainError::Internal(format!("build zion htlc refund: {e}")))?;

        self.submit_utxo_transaction(tx).await
    }

    async fn lock_utxo_for_transfer(&self, transfer: &Transfer) -> MultichainResult<SpendableUtxo> {
        let lock_id = transfer
            .lock_tx_id
            .as_deref()
            .ok_or_else(|| MultichainError::Validation("HTLC missing lock_tx_id".to_string()))?;
        let bytes = hex::decode(lock_id)
            .map_err(|e| MultichainError::Validation(format!("invalid lock_tx_id hex: {e}")))?;
        let lock_hash: [u8; 32] = bytes
            .try_into()
            .map_err(|_| MultichainError::Validation("lock_tx_id must be 32 bytes".to_string()))?;

        let from = self.adapter_address()?.encoded;
        let utxos = self.get_spendable_utxos(&from).await?;
        let mut matches: Vec<_> = utxos.into_iter().filter(|u| u.tx_hash == lock_hash).collect();
        matches.sort_by_key(|a| a.output_index);
        matches
            .into_iter()
            .next()
            .ok_or_else(|| MultichainError::Validation(format!("no UTXO found for lock tx {lock_id}")))
    }

    async fn execute_burn_release(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        let source_chain = Self::chain_name(transfer.source.address.chain);
        if source_chain == "unknown" {
            return Err(MultichainError::Validation(format!(
                "unsupported source chain for bridge unlock: {}",
                transfer.source.address.chain.as_str()
            )));
        }

        // Convert wZION wei (18 decimals) to ZION flowers (6 decimals).
        let amount_flowers = (transfer.target.amount.0 / 1_000_000_000_000u128) as u64;
        let burn_id = &transfer.id;
        let evm_tx_hash = &transfer.id;
        let recipient = transfer.target.address.encoded.clone();

        let wallet = crate::wallet::evm_relay_wallet()
            .or_else(|_| self.keyring.evm_wallet(0, 0))
            .map_err(|e| MultichainError::Internal(format!("derive evm wallet: {e}")))?;

        let message = format!(
            "unlock|recipient={}|amount={}|chain={}|burn_id={}|evm_tx={}",
            recipient, amount_flowers, source_chain, burn_id, evm_tx_hash
        );
        let digest = Sha256::digest(message.as_bytes());
        let sig = wallet
            .sign_hash(ethers::types::H256::from_slice(&digest))
            .map_err(|e| MultichainError::Internal(format!("sign bridge unlock: {e}")))?;

        let mut r = [0u8; 32];
        let mut s = [0u8; 32];
        sig.r.to_big_endian(&mut r);
        sig.s.to_big_endian(&mut s);

        let mut sig_bytes = Vec::with_capacity(64);
        sig_bytes.extend_from_slice(&r);
        sig_bytes.extend_from_slice(&s);

        let pubkey = wallet.signer().verifying_key().to_sec1_bytes();
        let proof = json!({
            "validator_id": "zion-multichain-0",
            "pubkey_hex": hex::encode(&pubkey),
            "signature_hex": hex::encode(sig_bytes),
        });

        let params = json!({
            "recipient": recipient,
            "amount_flowers": amount_flowers,
            "burn_id": burn_id,
            "evm_chain": source_chain,
            "evm_tx_hash": evm_tx_hash,
            "validator_proofs": [proof],
        });

        let resp: serde_json::Value = self.call("submitBridgeUnlock", params).await?;
        let tx_id = resp.get("tx_id").and_then(|v| v.as_str()).ok_or_else(|| {
            MultichainError::Internal("submitBridgeUnlock missing tx_id".to_string())
        })?;

        Hash::from_hex(tx_id).ok_or_else(|| {
            MultichainError::Internal("invalid tx_id hex from submitBridgeUnlock".to_string())
        })
    }
}

#[async_trait]
impl ChainAdapter for ZionL1Adapter {
    fn name(&self) -> &str {
        "zion-l1"
    }

    fn family(&self) -> ChainFamily {
        ChainFamily::Zion
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        match self.current_height().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        let tip = self.current_height().await?;
        let from = tip.saturating_sub(100);

        let resp: BridgeLocksResponse = self
            .call(
                "getBridgeLocks",
                json!({"from_height": from, "to_height": tip}),
            )
            .await?;

        let mut events = Vec::new();
        for lock in resp.locks {
            let tx_hash = Hash::from_hex(&lock.txid).unwrap_or_default();
            let recipient = Address::new(
                ChainId::ZionL1,
                lock.sender.as_bytes().to_vec(),
                lock.sender,
            )?;
            let confirmations = tip.saturating_sub(lock.block_height) + 1;
            events.push(DepositEvent {
                chain: ChainId::ZionL1,
                tx_hash,
                recipient,
                amount: Amount::new(lock.amount_flowers as u128),
                memo: Some(lock.memo),
                confirmations,
                asset: Some(Asset::native(ChainId::ZionL1, "ZION", 8, "ZION")),
            });
        }

        Ok(events)
    }

    async fn execute_outbound(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        match transfer.direction {
            TransferDirection::BurnRelease => self.execute_burn_release(transfer).await,
            TransferDirection::Htlc => {
                if transfer.id.starts_with("htlc-lock-") {
                    self.htlc_lock(transfer).await
                } else if transfer.id.starts_with("htlc-claim-") {
                    self.htlc_claim(transfer).await
                } else if transfer.id.starts_with("htlc-refund-") {
                    self.htlc_refund(transfer).await
                } else {
                    Err(MultichainError::Validation(format!(
                        "unknown HTLC transfer id prefix: {}",
                        transfer.id
                    )))
                }
            }
            _ => Err(MultichainError::Unsupported(format!(
                "zion-l1 execute_outbound only supports BurnRelease and Htlc, got {:?}",
                transfer.direction
            ))),
        }
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        let info: ChainInfo = self.call("getChainInfo", json!([])).await?;
        Ok(info.chain_height)
    }

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64> {
        let tx: TransactionInfo = self
            .call("getTransaction", json!({"hash": tx_hash.to_hex()}))
            .await?;
        if !tx.confirmed {
            return Ok(0);
        }
        let tx_block = tx
            .block_height
            .ok_or_else(|| MultichainError::Internal("zion tx missing block_height".to_string()))?;
        let tip = self.current_height().await?;
        Ok(tip.saturating_sub(tx_block) + 1)
    }

    async fn send_payment(&self, to: &Address, amount: Amount) -> MultichainResult<Hash> {
        self.validate_address(to)?;
        if !to.encoded.starts_with("zion1") || to.encoded.len() != 44 {
            return Err(MultichainError::Validation(
                "recipient must be a valid zion1 address".to_string(),
            ));
        }
        if amount.0 == 0 {
            return Err(MultichainError::Validation(
                "cannot send zero zion amount".to_string(),
            ));
        }

        const FEE_ZION: u64 = 1;
        if amount.0 < FEE_ZION as u128 {
            return Err(MultichainError::Validation(
                "amount is smaller than the transaction fee".to_string(),
            ));
        }

        let from = self.keyring.address(ChainId::ZionL1, 0, 0)?;
        let public_key = self.keyring.zion_public_key(0, 0)?;
        let nonce = self
            .nonce
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let tx_id = generate_account_tx_id(&from.encoded, &to.encoded, amount.0, nonce);
        let signature = self.keyring.sign(ChainId::ZionL1, tx_id.as_bytes(), 0, 0)?;

        let transaction = json!({
            "tx_id": tx_id,
            "from": from.encoded,
            "to": to.encoded,
            "amount_zion": amount.0.to_string(),
            "fee_zion": FEE_ZION,
            "nonce": nonce,
            "signature": hex::encode(&signature),
            "public_key": public_key,
        });

        let resp: serde_json::Value = self
            .call("submitTransaction", json!({ "transaction": transaction }))
            .await?;

        let accepted = resp
            .get("accepted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !accepted {
            let reason = resp
                .get("reason")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            return Err(MultichainError::Internal(format!(
                "submitTransaction rejected: {reason}"
            )));
        }

        let tx_id_resp = resp.get("tx_id").and_then(|v| v.as_str()).ok_or_else(|| {
            MultichainError::Internal("submitTransaction missing tx_id".to_string())
        })?;
        Hash::from_hex(tx_id_resp)
            .ok_or_else(|| MultichainError::Internal("invalid tx_id hex returned".to_string()))
    }

    async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        self.validate_address(address)?;
        // getAddressInfo returns both balance_flowers and balance_zion.
        let balance: serde_json::Value = self
            .call("getAddressInfo", json!({"address": address.encoded}))
            .await?;
        let flowers = balance
            .get("balance_flowers")
            .and_then(|v| v.as_str())
            .or_else(|| balance.get("balance_zion").and_then(|v| v.as_str()))
            .ok_or_else(|| {
                MultichainError::Internal("zion getBalance missing balance field".to_string())
            })?;
        flowers
            .parse::<u128>()
            .map(Amount::new)
            .map_err(|e| MultichainError::Internal(format!("zion balance parse failed: {e}")))
    }

    async fn block_template(&self) -> MultichainResult<Option<BlockTemplate>> {
        let tpl: serde_json::Value = self.call("getBlockTemplate", json!(null)).await?;
        let template_id = tpl.get("template_id").and_then(|v| v.as_u64()).unwrap_or(0);
        let height = tpl.get("height").and_then(|v| v.as_u64()).unwrap_or(0);
        let header_hex = tpl
            .get("header_hex")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let target_hex = tpl
            .get("target_hex")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let block_reward = tpl
            .get("block_reward")
            .or_else(|| tpl.get("estimated_miner_reward_zion"))
            .or_else(|| tpl.get("reward_zion"))
            .and_then(|v| v.as_u64())
            .unwrap_or(6_000_000);
        if header_hex.is_empty() || target_hex.is_empty() {
            return Ok(None);
        }
        Ok(Some(BlockTemplate {
            template_id,
            height,
            header_hex,
            target_hex,
            block_reward,
            raw: tpl,
        }))
    }
}

fn generate_account_tx_id(from: &str, to: &str, amount: u128, nonce: u64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(from.as_bytes());
    hasher.update(to.as_bytes());
    hasher.update(amount.to_le_bytes());
    hasher.update(nonce.to_le_bytes());
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    hasher.update(ts.to_le_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse<T> {
    result: Option<T>,
    error: Option<JsonRpcError>,
    #[allow(dead_code)]
    #[serde(rename = "jsonrpc", default)]
    _jsonrpc: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "id", default)]
    _id: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    // V3 node error responses may omit the code field.
    code: Option<i64>,
    message: String,
}

#[derive(Debug, Deserialize)]
struct ChainInfo {
    chain_height: u64,
}

#[derive(Debug, Deserialize)]
struct TransactionInfo {
    confirmed: bool,
    block_height: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct BridgeLocksResponse {
    #[allow(dead_code)]
    from_height: u64,
    #[allow(dead_code)]
    to_height: u64,
    locks: Vec<BridgeLock>,
}

#[derive(Debug, Deserialize)]
struct BridgeLock {
    txid: String,
    block_height: u64,
    sender: String,
    #[allow(dead_code)]
    recipient_chain: String,
    #[allow(dead_code)]
    recipient: String,
    amount_flowers: u64,
    memo: String,
    #[allow(dead_code)]
    confirmed: bool,
}

