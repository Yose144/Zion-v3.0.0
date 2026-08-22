//! ZION L1 adapter — JSON-RPC over HTTP.
//!
//! Mainnet Alpha capabilities:
//! - read chain height, account balance, tx confirmations,
//! - watch bridge lock events via `getBridgeLocks`,
//! - submit `submitBridgeUnlock` with an EVM validator proof from the keyring.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

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

        if !resp.status().is_success() {
            return Err(MultichainError::Internal(format!(
                "zion rpc returned {}",
                resp.status()
            )));
        }

        let envelope = resp
            .json::<JsonRpcResponse<T>>()
            .await
            .map_err(|e| MultichainError::Internal(format!("zion rpc decode failed: {e}")))?;

        match (envelope.result, envelope.error) {
            (Some(result), _) => Ok(result),
            (None, Some(err)) => Err(MultichainError::Internal(format!(
                "zion rpc error {}: {}",
                err.code, err.message
            ))),
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
            });
        }

        Ok(events)
    }

    async fn execute_outbound(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        if transfer.direction != TransferDirection::BurnRelease {
            return Err(MultichainError::Unsupported(format!(
                "zion-l1 execute_outbound only supports BurnRelease, got {:?}",
                transfer.direction
            )));
        }

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
        let balance: serde_json::Value = self
            .call("getBalance", json!({"account": address.encoded}))
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
    #[serde(rename = "jsonrpc")]
    _jsonrpc: String,
    #[allow(dead_code)]
    #[serde(rename = "id")]
    _id: u64,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    code: i64,
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

#[derive(Serialize)]
struct _RpcParams(serde_json::Value);
