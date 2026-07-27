//! ZION L1 adapter — JSON-RPC over HTTP.
//!
//! Reads chain height and account/UTXO balance from a local or remote ZION node.
//! Signing (Ed25519 account transactions / UTXO) is deferred to the keyring.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::error::{MultichainError, MultichainResult};

/// ZION L1 JSON-RPC adapter.
pub struct ZionL1Adapter {
    rpc_url: String,
    client: reqwest::Client,
    request_id: std::sync::atomic::AtomicU64,
}

impl ZionL1Adapter {
    pub fn new(rpc_url: impl Into<String>) -> Self {
        Self {
            rpc_url: rpc_url.into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .expect("valid reqwest client"),
            request_id: std::sync::atomic::AtomicU64::new(1),
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
        // Deposit watching needs account/bridge lock polling.
        // Returning empty is intentional for the scaffold stage.
        Ok(vec![])
    }

    async fn execute_outbound(&self, _transfer: &crate::types::Transfer) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "zion-l1 outbound signing not yet implemented in Mainnet Alpha scaffold".to_string(),
        ))
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

    async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
        Err(MultichainError::Unsupported(
            "zion-l1 send_payment requires a signer; not wired yet".to_string(),
        ))
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

#[derive(Serialize)]
struct _RpcParams(serde_json::Value);
