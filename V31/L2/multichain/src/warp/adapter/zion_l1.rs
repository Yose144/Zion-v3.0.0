//! Zion L1 Adapter for WARP Bridge
//!
//! This adapter monitors the Zion L1 blockchain for burn transactions
//! sent to the WARP vault address with WARP memos, which signal outbound
//! cross-chain transfers.

#![allow(dead_code)]

use crate::warp::adapter::ChainAdapter;
use crate::warp::config::WarpConfig;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::DepositProof;
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tracing::{debug, info, warn};

const RPC_TIMEOUT_SECS: u64 = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RpcRequest<'a> {
    jsonrpc: &'a str,
    method: &'a str,
    params: Value,
    id: u32,
}

#[derive(Debug, Deserialize)]
struct RpcResponse {
    result: Option<Value>,
    error: Option<RpcError>,
}

#[derive(Debug, Deserialize)]
struct RpcError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct L1Block {
    height: u64,
    #[serde(rename = "blockHash")]
    #[allow(dead_code)]
    block_hash: String,
    #[serde(rename = "hashHex")]
    hash_hex: String,
    transactions: Vec<L1Transaction>,
}

#[derive(Debug, Deserialize)]
struct L1Transaction {
    #[serde(rename = "txId")]
    tx_id: String,
    from: String,
    to: String,
    #[serde(rename = "amountZion")]
    amount_zion: u128,
    memo: Option<String>,
}

/// Zion L1 Adapter — watches for WARP burn transactions on Zion L1
pub struct ZionL1Adapter {
    rpc_url: String,
    vault_address: String,
    last_polled_height: std::sync::atomic::AtomicU64,
}

impl ZionL1Adapter {
    /// Strip any URL scheme/path from an RPC endpoint so it can be used
    /// with `tokio::net::TcpStream::connect`.
    fn clean_rpc_url(rpc_url: &str) -> &str {
        let s = rpc_url.trim();
        let s = s
            .strip_prefix("http://")
            .or(s.strip_prefix("https://"))
            .unwrap_or(s);
        s.split_once('/').map(|(h, _)| h).unwrap_or(s)
    }

    /// Create a new adapter with explicit RPC URL and vault address
    pub fn new(rpc_url: String, vault_address: String) -> Self {
        Self {
            rpc_url,
            vault_address,
            last_polled_height: std::sync::atomic::AtomicU64::new(0),
        }
    }

    /// Create adapter from WARP config
    pub fn from_config(config: &WarpConfig) -> Self {
        Self::new(config.l1_rpc_url.clone(), config.l1_vault_address.clone())
    }

    /// Create adapter from environment variables
    pub fn from_env() -> Self {
        let rpc_url =
            std::env::var("WARP_L1_RPC_URL").unwrap_or_else(|_| "127.0.0.1:9445".to_string());
        let vault_address = std::env::var("WARP_L1_VAULT_ADDRESS")
            .unwrap_or_else(|_| "zion1warpvaultaddress".to_string());
        Self::new(rpc_url, vault_address)
    }

    async fn rpc_call(&self, method: &str, params: Value) -> WarpResult<Value> {
        let request = RpcRequest {
            jsonrpc: "2.0",
            method,
            params,
            id: 1,
        };

        let addr = Self::clean_rpc_url(&self.rpc_url);
        let mut stream = TcpStream::connect(addr)
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("connect error: {e}"),
            })?;

        let payload = serde_json::to_string(&request).map_err(|e| WarpError::AdapterError {
            chain: "zion-l1".into(),
            reason: format!("serialize error: {e}"),
        })?;
        let payload = format!("{payload}\n");
        let text = tokio::time::timeout(Duration::from_secs(RPC_TIMEOUT_SECS), async {
            stream.write_all(payload.as_bytes()).await?;
            stream.flush().await?;
            let (reader, _) = stream.split();
            let mut reader = BufReader::new(reader);
            let mut line = String::new();
            AsyncBufReadExt::read_line(&mut reader, &mut line).await?;
            Ok::<_, std::io::Error>(line)
        })
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "zion-l1".into(),
            reason: format!("RPC timeout: {e}"),
        })?
        .map_err(|e| WarpError::AdapterError {
            chain: "zion-l1".into(),
            reason: format!("RPC read failed: {e}"),
        })?;

        let response: RpcResponse =
            serde_json::from_str(&text).map_err(|e| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("JSON parse error: {e}"),
            })?;

        if let Some(err) = response.error {
            return Err(WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("RPC error: {}", err.message),
            });
        }

        response.result.ok_or_else(|| WarpError::AdapterError {
            chain: "zion-l1".into(),
            reason: "RPC returned null result".into(),
        })
    }

    /// Get current tip height
    async fn get_tip_height(&self) -> WarpResult<u64> {
        let result = self.rpc_call("getBlockTemplate", Value::Null).await?;
        let height = result
            .get("height")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: "getBlockTemplate missing height".into(),
            })?;
        Ok(height)
    }

    /// Get block by height
    async fn get_block(&self, height: u64) -> WarpResult<L1Block> {
        let result = self
            .rpc_call("getBlockByHeight", serde_json::json!({"height": height}))
            .await?;

        let block: L1Block =
            serde_json::from_value(result).map_err(|e| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("Block parse error: {}", e),
            })?;
        Ok(block)
    }

    /// Check if a transaction is a WARP burn (to vault with WARP memo)
    fn is_warp_burn(&self, tx: &L1Transaction) -> bool {
        if tx.to != self.vault_address {
            return false;
        }
        if let Some(memo) = &tx.memo {
            if memo.starts_with("WARP:") {
                return true;
            }
        }
        false
    }

    /// Parse WARP memo to extract destination chain and address
    /// Format: WARP:1:chain:address (address may contain colons)
    fn parse_warp_memo(&self, memo: &str) -> Option<(String, String)> {
        let parts: Vec<&str> = memo.split(':').collect();
        if parts.len() >= 4 && parts[0] == "WARP" && parts[1] == "1" {
            let chain = parts[2].to_string();
            let address = parts[3..].join(":");
            return Some((chain, address));
        }
        None
    }
}

#[async_trait]
impl ChainAdapter for ZionL1Adapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::ZionL1
    }

    fn name(&self) -> &str {
        "zion-l1"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.get_tip_height().await {
            Ok(h) => {
                info!("[WARP][zion-l1] Health OK — tip height {}", h);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][zion-l1] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let tip = self.get_tip_height().await?;
        let last = self.last_polled_height.load(std::sync::atomic::Ordering::Relaxed);
        // Scan a wider window (last 200 blocks) for bridge locks.
        let from = last.max(1).max(tip.saturating_sub(200));
        let to = tip;

        if from > to {
            debug!("[WARP][zion-l1] No new blocks to scan ({} to {})", from, to);
            return Ok(vec![]);
        }

        // Use getBridgeLocks RPC (V31 native) instead of scanning V3 blocks.
        let locks_result = self
            .rpc_call(
                "getBridgeLocks",
                serde_json::json!([from, to]),
            )
            .await?;

        let empty = Vec::new();
        let locks = locks_result
            .get("locks")
            .and_then(|v| v.as_array())
            .unwrap_or(&empty);

        let mut proofs = Vec::new();
        for lock in locks {
            let txid = lock.get("txid").and_then(|v| v.as_str()).unwrap_or("");
            let sender = lock.get("sender").and_then(|v| v.as_str()).unwrap_or("");
            let amount_flowers = lock.get("amount_flowers").and_then(|v| v.as_u64()).unwrap_or(0);
            let memo = lock.get("memo").and_then(|v| v.as_str()).unwrap_or("");
            let block_height = lock.get("block_height").and_then(|v| v.as_u64()).unwrap_or(0);

            // Parse BRIDGE:<chain>:<recipient> memo
            if let Some(rest) = memo.strip_prefix("BRIDGE:") {
                if let Some((dest_chain, dest_addr)) = rest.split_once(':') {
                    if !dest_chain.is_empty() && !dest_addr.is_empty() {
                        let proof = DepositProof {
                            tx_hash: txid.to_string(),
                            block_height,
                            block_hash: String::new(),
                            sender: sender.to_string(),
                            amount_flowers,
                            memo: format!("WARP:1:{}:{}", dest_chain, dest_addr),
                            confirmations: tip.saturating_sub(block_height) + 1,
                        };
                        proofs.push(proof);
                        info!(
                            "[WARP][zion-l1] Found bridge lock: tx={} amount={} chain={} addr={}",
                            txid, amount_flowers, dest_chain, dest_addr
                        );
                    }
                }
            }
        }

        // Update last polled height
        self.last_polled_height.store(to + 1, std::sync::atomic::Ordering::Relaxed);

        Ok(proofs)
    }

    async fn execute_mint(
        &self,
        _instruction: &crate::warp::protocol::MintInstruction,
    ) -> WarpResult<String> {
        // Zion L1 is the source chain for outbound transfers
        // Mint happens on destination chain via other adapters
        Err(WarpError::AdapterError {
            chain: "zion-l1".into(),
            reason: "execute_mint not supported on Zion L1 (source chain only)".into(),
        })
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.get_tip_height().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let result = self
            .rpc_call("getTransaction", serde_json::json!({"txid": tx_hash}))
            .await?;

        let tx_height = result
            .get("block_height")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if tx_height == 0 {
            return Ok(0);
        }

        let tip = self.get_tip_height().await?;
        Ok(tip.saturating_sub(tx_height))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_warp_memo() {
        let adapter = ZionL1Adapter::new("http://test".into(), "zion1vault".into());
        let (chain, addr) = adapter.parse_warp_memo("WARP:1:base:0xabc123").unwrap();
        assert_eq!(chain, "base");
        assert_eq!(addr, "0xabc123");
    }

    #[test]
    fn test_parse_warp_memo_with_colons() {
        let adapter = ZionL1Adapter::new("http://test".into(), "zion1vault".into());
        let (chain, addr) = adapter.parse_warp_memo("WARP:1:bitcoin:bc1q:test").unwrap();
        assert_eq!(chain, "bitcoin");
        assert_eq!(addr, "bc1q:test");
    }

    #[test]
    fn test_parse_warp_memo_invalid() {
        let adapter = ZionL1Adapter::new("http://test".into(), "zion1vault".into());
        assert!(adapter.parse_warp_memo("BRIDGE:1:base:0xabc").is_none());
        assert!(adapter.parse_warp_memo("WARP:2:base:0xabc").is_none());
        assert!(adapter.parse_warp_memo("WARP:1:base").is_none());
    }
}
