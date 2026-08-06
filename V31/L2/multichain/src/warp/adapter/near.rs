//! # NEAR Adapter — WARP Cross-Chain Bridge
//!
//! Connects ZION L1 to the NEAR Protocol via the NEAR JSON-RPC API.
//!
//! ## Configuration (env vars)
//! - `WARP_NEAR_RPC`     — JSON-RPC endpoint (default `https://rpc.mainnet.near.org`)
//! - `WARP_NEAR_ACCOUNT` — relay account id (e.g. `warp.near`)
//! - `WARP_NEAR_RELAY_KEY` — hex-encoded 32-byte Ed25519 seed
//! - `WARP_NEAR_BRIDGE_CONTRACT` — ZION NEP-141 token contract address
//!   (default `warp.near`)
//!
//! Contract source: V31/L2/multichain/contracts/non-evm/near/zion_token.rs
//! Deployment steps: V31/L2/multichain/contracts/non-evm/near/README.md
//!
//! After deploying the NEP-141 contract (zion_token.rs), set
//! WARP_NEAR_BRIDGE_CONTRACT to the contract account ID (e.g. `zion.near`).
//!
//! ## JSON-RPC methods used
//! | Method                | Params                          | Purpose                  |
//! |-----------------------|---------------------------------|--------------------------|
//! | `status`              | `[]` (none)                     | Health check + height    |
//! | `block`               | `{"finality":"final"}`          | Latest final block       |
//! | `chunk`               | `{"chunk_hash":"..."}`          | TXs + receipts in chunk  |
//! | `tx`                  | `[tx_hash, sender_account]`     | TX finality / status     |
//! | `broadcast_tx_async`  | `[base64_signed_tx]`            | Submit signed TX         |

use crate::warp::adapter::ChainAdapter;
use crate::warp::config::ChainConfig;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::near_signer::NearSigner;
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC helpers
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct RpcReq<'a> {
    jsonrpc: &'a str,
    id: u32,
    method: &'a str,
    params: Value,
}

#[derive(Deserialize)]
struct RpcResp {
    #[allow(dead_code)]
    jsonrpc: Option<String>,
    #[allow(dead_code)]
    id: Option<Value>,
    result: Option<Value>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

/// Issue a JSON-RPC call and return the `result` field.
async fn rpc(
    client: &reqwest::Client,
    url: &str,
    method: &str,
    params: Value,
) -> WarpResult<Value> {
    let body = RpcReq {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
    };
    let resp: RpcResp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: e.to_string(),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: e.to_string(),
        })?;

    if let Some(err) = resp.error {
        return Err(WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("RPC error {}: {}", err.code, err.message),
        });
    }
    resp.result.ok_or_else(|| WarpError::AdapterError {
        chain: "near".into(),
        reason: "null result".into(),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Serde response structs
// ─────────────────────────────────────────────────────────────────────────────

/// `status` response — we only need `sync_info.latest_block_height`.
#[derive(Deserialize)]
#[allow(dead_code)]
struct StatusResp {
    sync_info: SyncInfo,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct SyncInfo {
    latest_block_height: u64,
    latest_block_hash: String,
}

/// `block` response — we need the header (height + hash) and chunk headers.
#[derive(Deserialize)]
#[allow(dead_code)]
struct BlockResp {
    header: BlockHeader,
    chunks: Vec<ChunkHeader>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct BlockHeader {
    height: u64,
    hash: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct ChunkHeader {
    chunk_hash: String,
}

/// `chunk` response — contains transactions and receipts (with logs).
#[derive(Deserialize)]
#[allow(dead_code)]
struct ChunkResp {
    transactions: Vec<NearTx>,
    receipts: Vec<NearReceipt>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct NearTx {
    hash: String,
    signer_id: String,
    receiver_id: String,
    actions: Vec<Value>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct NearReceipt {
    receipt_id: String,
    receiver_id: String,
    logs: Vec<String>,
}

/// `tx` response — used for finality / confirmations.
#[derive(Deserialize)]
#[allow(dead_code)]
struct TxStatusResp {
    transaction: Option<NearTx>,
    status: Value,
    receipts: Vec<NearReceipt>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// NEAR adapter — JSON-RPC + Ed25519 signing for ZION minting.
pub struct NearAdapter {
    rpc_url: String,
    bridge_contract: String,
    client: reqwest::Client,
}

impl Default for NearAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl NearAdapter {
    /// Construct from env vars (falls back to NEAR mainnet defaults).
    pub fn new() -> Self {
        Self::from_env()
    }

    /// Build from env vars.
    pub fn from_env() -> Self {
        let rpc_url = std::env::var("WARP_NEAR_RPC")
            .unwrap_or_else(|_| "https://rpc.mainnet.near.org".into());
        let bridge_contract =
            std::env::var("WARP_NEAR_BRIDGE_CONTRACT").unwrap_or_else(|_| "warp.near".into());
        // TODO: After deploying zion_token.rs (NEP-141), set this to the
        // real contract account ID (e.g. "zion.near"). See:
        // V31/L2/multichain/contracts/non-evm/near/README.md
        Self {
            rpc_url,
            bridge_contract,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
        }
    }

    /// Build with an explicit RPC URL (for testing).
    pub fn with_rpc(rpc_url: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            bridge_contract: std::env::var("WARP_NEAR_BRIDGE_CONTRACT")
                .unwrap_or_else(|_| "warp.near".into()),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
        }
    }

    /// Build from a `ChainConfig`.
    pub fn from_config(cfg: &ChainConfig) -> Self {
        let rpc_url = if cfg.rpc_url.is_empty() {
            std::env::var("WARP_NEAR_RPC").unwrap_or_else(|_| "https://rpc.mainnet.near.org".into())
        } else {
            cfg.rpc_url.clone()
        };
        let bridge_contract = cfg
            .contract_address
            .as_ref()
            .and_then(|a| if a.is_empty() { None } else { Some(a.clone()) })
            .or_else(|| std::env::var("WARP_NEAR_BRIDGE_CONTRACT").ok())
            .unwrap_or_else(|| "warp.near".into());
        Self {
            rpc_url,
            bridge_contract,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
        }
    }

    /// Call `status` and return the parsed response.
    async fn get_status(&self) -> WarpResult<StatusResp> {
        let v = rpc(&self.client, &self.rpc_url, "status", json!({})).await?;
        serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("status parse: {}", e),
        })
    }

    /// Call `block` with `{"finality":"final"}` and return the parsed response.
    async fn get_final_block(&self) -> WarpResult<BlockResp> {
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "block",
            json!({"finality": "final"}),
        )
        .await?;
        serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("block parse: {}", e),
        })
    }

    /// Fetch a chunk by hash (contains transactions + receipts with logs).
    async fn get_chunk(&self, chunk_hash: &str) -> WarpResult<ChunkResp> {
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "chunk",
            json!({"chunk_hash": chunk_hash}),
        )
        .await?;
        serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("chunk parse: {}", e),
        })
    }

    /// Query a TX status by hash + sender account id.
    async fn get_tx_status(&self, tx_hash: &str, sender: &str) -> WarpResult<TxStatusResp> {
        let v = rpc(&self.client, &self.rpc_url, "tx", json!([tx_hash, sender])).await?;
        serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("tx parse: {}", e),
        })
    }

    /// Parse a `DepositProof` from a receipt log line.
    ///
    /// Expected log format (emitted by the WARP bridge contract):
    /// `WARP_DEPOSIT amount=<u64> dest=<zion_addr> sender=<near_account>`
    fn parse_bridge_deposit_log(
        &self,
        log: &str,
        receipt_id: &str,
        receiver_id: &str,
        block_height: u64,
        block_hash: &str,
    ) -> Option<DepositProof> {
        if !log.contains("WARP_DEPOSIT") {
            return None;
        }
        let amount = log
            .split_once("amount=")
            .and_then(|(_, rest)| rest.split_whitespace().next())
            .and_then(|s| s.parse::<u64>().ok())?;
        let dest = log
            .split_once("dest=")
            .and_then(|(_, rest)| rest.split_whitespace().next())
            .unwrap_or("zion1unknown")
            .to_string();

        Some(DepositProof {
            tx_hash: receipt_id.to_string(),
            block_height,
            block_hash: block_hash.to_string(),
            sender: receiver_id.to_string(),
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:near:{}", dest),
            confirmations: 0,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainAdapter impl
// ─────────────────────────────────────────────────────────────────────────────
#[async_trait]
impl ChainAdapter for NearAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Near
    }

    fn name(&self) -> &str {
        "near"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.get_status().await {
            Ok(status) => {
                info!(
                    "[WARP][near] Health OK — height {}",
                    status.sync_info.latest_block_height
                );
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][near] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let block = self.get_final_block().await?;
        let height = block.header.height;
        let block_hash = block.header.hash.clone();
        debug!(
            "[WARP][near] Scanning final block {} ({} chunks)",
            height,
            block.chunks.len()
        );

        let mut proofs = Vec::new();
        for chunk_hdr in &block.chunks {
            match self.get_chunk(&chunk_hdr.chunk_hash).await {
                Ok(chunk) => {
                    // Scan receipt logs for WARP_DEPOSIT events
                    for receipt in &chunk.receipts {
                        for log in &receipt.logs {
                            if let Some(proof) = self.parse_bridge_deposit_log(
                                log,
                                &receipt.receipt_id,
                                &receipt.receiver_id,
                                height,
                                &block_hash,
                            ) {
                                debug!(
                                    "[WARP][near] Found WARP_DEPOSIT: {} flowers → {}",
                                    proof.amount_flowers, proof.memo
                                );
                                proofs.push(proof);
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("[WARP][near] chunk fetch error: {}", e);
                }
            }
        }
        info!(
            "[WARP][near] {} WARP_DEPOSIT proofs found in block {}",
            proofs.len(),
            height
        );
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        // Load the relay signer
        let signer = NearSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "near".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;

        let amount = instruction.amount_dest_atomic as u64;

        // Fetch a recent block hash for the transaction
        let block = self.get_final_block().await?;
        let block_hash_bytes: [u8; 32] = bs58::decode(&block.header.hash)
            .into_vec()
            .map_err(|e| WarpError::AdapterError {
                chain: "near".into(),
                reason: format!("block_hash base58 decode: {}", e),
            })?
            .try_into()
            .map_err(|_| WarpError::AdapterError {
                chain: "near".into(),
                reason: "block_hash is not 32 bytes".into(),
            })?;

        // Use block height + 1 as a simple nonce (real relay would track
        // the account's access key nonce via `query`/`view_access_key`).
        let nonce = block.header.height + 1;

        info!(
            "[WARP][near] minting {} ZION to {} via {} (nonce {})",
            amount, instruction.recipient, self.bridge_contract, nonce
        );

        // Build + sign the function-call transaction
        let signed_b64 = signer
            .build_signed_function_call_b64(
                &self.bridge_contract,
                "mint",
                serde_json::json!({
                    "recipient": instruction.recipient,
                    "amount": amount.to_string(),
                }),
                30_000_000_000_000, // 30 Tgas
                0,                  // no deposit
                nonce,
                block_hash_bytes,
            )
            .map_err(|e| WarpError::AdapterError {
                chain: "near".into(),
                reason: format!("signing: {}", e),
            })?;

        // Broadcast via `broadcast_tx_async`
        let result = rpc(
            &self.client,
            &self.rpc_url,
            "broadcast_tx_async",
            json!([signed_b64]),
        )
        .await?;

        // `broadcast_tx_async` returns the tx hash as a base58 string
        let tx_hash =
            result
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| WarpError::AdapterError {
                    chain: "near".into(),
                    reason: "broadcast_tx_async: non-string result".into(),
                })?;

        info!("[WARP][near] TX broadcast: {}", tx_hash);
        Ok(tx_hash)
    }

    async fn current_height(&self) -> WarpResult<u64> {
        let status = self.get_status().await?;
        Ok(status.sync_info.latest_block_height)
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        // NEAR finality: a TX is final once the block it's in is finalized.
        // We query the TX status; if `status` is `FinalExecutionStatus` with
        // `SuccessValue` or `Failure`, the TX has been included and finalized.
        // The sender account id is required by the `tx` RPC method — we read
        // it from env (the relay account) as a best-effort.
        let sender = std::env::var("WARP_NEAR_ACCOUNT").unwrap_or_else(|_| "warp.near".into());

        let tx_status = self.get_tx_status(tx_hash, &sender).await?;

        // Check the execution status.  If the status object indicates
        // success/failure (i.e. the TX has been executed), we treat it as
        // finalized (NEAR finality ≈ 2 blocks, so 1 confirmation = final).
        let is_final = match &tx_status.status {
            Value::Object(map) => map.contains_key("SuccessValue") || map.contains_key("Failure"),
            Value::String(s) => s == "SuccessValue" || s == "Failure",
            _ => false,
        };

        if is_final {
            Ok(1)
        } else {
            Ok(0)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::protocol::MintInstruction;

    // ── Metadata ─────────────────────────────────────────────────────────────

    #[test]
    fn test_near_adapter_meta() {
        let a = NearAdapter::new();
        assert_eq!(a.name(), "near");
        assert_eq!(a.family(), ChainFamily::Near);
    }

    #[test]
    fn test_default_equals_new() {
        let a = NearAdapter::default();
        assert_eq!(a.name(), "near");
    }

    #[test]
    fn test_from_env_uses_default_rpc() {
        std::env::remove_var("WARP_NEAR_RPC");
        let a = NearAdapter::from_env();
        assert_eq!(a.rpc_url, "https://rpc.mainnet.near.org");
    }

    #[test]
    fn test_from_env_respects_override() {
        std::env::set_var("WARP_NEAR_RPC", "https://rpc.testnet.near.org");
        let a = NearAdapter::from_env();
        assert_eq!(a.rpc_url, "https://rpc.testnet.near.org");
        std::env::remove_var("WARP_NEAR_RPC");
    }

    // ── Health check (no network → returns false, not error) ─────────────────

    #[tokio::test]
    async fn test_health_check_no_network_returns_false() {
        // Point at a non-routable address so the request fails quickly.
        let a = NearAdapter::with_rpc("http://127.0.0.1:1");
        let ok = a.health_check().await.unwrap();
        // health_check catches errors and returns Ok(false)
        assert!(!ok);
    }

    // ── current_height (no network → error) ──────────────────────────────────

    #[tokio::test]
    async fn test_current_height_no_network_is_err() {
        let a = NearAdapter::with_rpc("http://127.0.0.1:1");
        assert!(a.current_height().await.is_err());
    }

    // ── execute_mint (no key → error) ────────────────────────────────────────

    #[tokio::test]
    async fn test_execute_mint_no_key_is_err() {
        std::env::remove_var("WARP_NEAR_RELAY_KEY");
        std::env::remove_var("WARP_NEAR_ACCOUNT");
        let a = NearAdapter::with_rpc("http://127.0.0.1:1");
        let inst = MintInstruction {
            dest_chain: "near".into(),
            recipient: "alice.near".into(),
            amount_dest_atomic: 1_000_000,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        let res = a.execute_mint(&inst).await;
        assert!(res.is_err());
        let msg = format!("{}", res.unwrap_err());
        assert!(msg.contains("near"));
    }

    // ── confirmations (no network → error) ───────────────────────────────────

    #[tokio::test]
    async fn test_confirmations_no_network_is_err() {
        let a = NearAdapter::with_rpc("http://127.0.0.1:1");
        assert!(a.confirmations("dummyhash").await.is_err());
    }

    // ── JSON-RPC request serialization ───────────────────────────────────────

    #[test]
    fn test_rpc_request_serialization() {
        let req = RpcReq {
            jsonrpc: "2.0",
            id: 1,
            method: "status",
            params: json!({}),
        };
        let body = serde_json::to_value(&req).unwrap();
        assert_eq!(body["jsonrpc"], "2.0");
        assert_eq!(body["id"], 1);
        assert_eq!(body["method"], "status");
        assert!(body["params"].is_object());
    }

    #[test]
    fn test_rpc_request_block_params() {
        let req = RpcReq {
            jsonrpc: "2.0",
            id: 1,
            method: "block",
            params: json!({"finality": "final"}),
        };
        let body = serde_json::to_value(&req).unwrap();
        assert_eq!(body["params"]["finality"], "final");
    }

    #[test]
    fn test_rpc_request_tx_params() {
        let req = RpcReq {
            jsonrpc: "2.0",
            id: 1,
            method: "tx",
            params: json!(["abc123", "warp.near"]),
        };
        let body = serde_json::to_value(&req).unwrap();
        assert_eq!(body["params"][0], "abc123");
        assert_eq!(body["params"][1], "warp.near");
    }

    #[test]
    fn test_rpc_request_broadcast_params() {
        let req = RpcReq {
            jsonrpc: "2.0",
            id: 1,
            method: "broadcast_tx_async",
            params: json!(["dGVzdA=="]),
        };
        let body = serde_json::to_value(&req).unwrap();
        assert_eq!(body["params"][0], "dGVzdA==");
    }

    // ── Log parsing ──────────────────────────────────────────────────────────

    #[test]
    fn test_parse_bridge_deposit_log_valid() {
        let a = NearAdapter::new();
        let proof = a
            .parse_bridge_deposit_log(
                "WARP_DEPOSIT amount=5000000 dest=zion1abcde sender=alice.near",
                "receipt_123",
                "warp.near",
                100_000_000,
                "blockhashxyz",
            )
            .unwrap();
        assert_eq!(proof.amount_flowers, 5_000_000);
        assert_eq!(proof.memo, "WARP_INBOUND:near:zion1abcde");
        assert_eq!(proof.sender, "warp.near");
        assert_eq!(proof.tx_hash, "receipt_123");
        assert_eq!(proof.block_height, 100_000_000);
    }

    #[test]
    fn test_parse_bridge_deposit_log_no_warp_returns_none() {
        let a = NearAdapter::new();
        let res = a.parse_bridge_deposit_log(
            "Transfer 5 NEAR from alice to bob",
            "r1",
            "warp.near",
            1,
            "h",
        );
        assert!(res.is_none());
    }

    #[test]
    fn test_parse_bridge_deposit_log_missing_amount_returns_none() {
        let a = NearAdapter::new();
        let res =
            a.parse_bridge_deposit_log("WARP_DEPOSIT dest=zion1abc", "r1", "warp.near", 1, "h");
        assert!(res.is_none());
    }

    #[test]
    fn test_parse_bridge_deposit_log_default_dest() {
        let a = NearAdapter::new();
        let proof = a
            .parse_bridge_deposit_log("WARP_DEPOSIT amount=1000", "r1", "warp.near", 1, "h")
            .unwrap();
        assert_eq!(proof.amount_flowers, 1000);
        assert!(proof.memo.contains("zion1unknown"));
    }

    // ── Response parsing ─────────────────────────────────────────────────────

    #[test]
    fn test_status_resp_parse() {
        let json = json!({
            "sync_info": {
                "latest_block_height": 123_456_789,
                "latest_block_hash": "AbCdEf123"
            }
        });
        let s: StatusResp = serde_json::from_value(json).unwrap();
        assert_eq!(s.sync_info.latest_block_height, 123_456_789);
    }

    #[test]
    fn test_block_resp_parse() {
        let json = json!({
            "header": {"height": 100, "hash": "blockhash1"},
            "chunks": [{"chunk_hash": "chunk1"}, {"chunk_hash": "chunk2"}]
        });
        let b: BlockResp = serde_json::from_value(json).unwrap();
        assert_eq!(b.header.height, 100);
        assert_eq!(b.chunks.len(), 2);
    }

    #[test]
    fn test_chunk_resp_parse_with_logs() {
        let json = json!({
            "transactions": [],
            "receipts": [{
                "receipt_id": "r1",
                "receiver_id": "warp.near",
                "logs": ["WARP_DEPOSIT amount=42 dest=zion1test"]
            }]
        });
        let c: ChunkResp = serde_json::from_value(json).unwrap();
        assert_eq!(c.receipts.len(), 1);
        assert_eq!(
            c.receipts[0].logs[0],
            "WARP_DEPOSIT amount=42 dest=zion1test"
        );
    }

    #[test]
    fn test_rpc_resp_error_parse() {
        let json = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "error": {"code": -32000, "message": "server error"}
        });
        let r: RpcResp = serde_json::from_value(json).unwrap();
        assert!(r.error.is_some());
        assert!(r.result.is_none());
    }

    #[test]
    fn test_rpc_resp_result_parse() {
        let json = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"height": 100}
        });
        let r: RpcResp = serde_json::from_value(json).unwrap();
        assert!(r.result.is_some());
        assert!(r.error.is_none());
    }
}
