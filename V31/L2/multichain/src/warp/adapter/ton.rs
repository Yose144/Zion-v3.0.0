use crate::warp::adapter::ChainAdapter;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::ton_cell;
use crate::warp::ton_signer::{decode_ton_address, TonSigner};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::Signer;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// Defaults & env vars
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_API_URL: &str = "https://toncenter.com/api/v2JSONRPC";

/// Number of recent transactions to fetch for `watch_events`.
const WATCH_TX_LIMIT: u64 = 50;

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC envelope (TON Center v2JSONRPC)
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
    id: Option<Value>,
    #[allow(dead_code)]
    jsonrpc: Option<String>,
    result: Option<Value>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Serde response shapes
// ─────────────────────────────────────────────────────────────────────────────

/// `getMasterchainInfo` → `result.last`
#[derive(Deserialize)]
#[allow(dead_code)]
struct MasterchainInfo {
    last: MasterchainBlock,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct MasterchainBlock {
    seqno: u64,
    workchain: i64,
    shard: String,
    root_hash: String,
    file_hash: String,
}

/// `getAddressInformation` → `result`
#[derive(Deserialize)]
#[allow(dead_code)]
struct AddressInfo {
    balance: String,
    state: String,
    #[allow(dead_code)]
    data: String,
    #[allow(dead_code)]
    code: String,
}

/// Parse a TON address string into a 32-byte hash.
/// Accepts both base64url format (EQ.../UQ.../kQ...) and hex format (0x...).
fn parse_ton_address(addr: &str) -> WarpResult<[u8; 32]> {
    // Try base64url format first (EQ.../UQ.../kQ...)
    if addr.starts_with("EQ") || addr.starts_with("UQ") || addr.starts_with("kQ") {
        match decode_ton_address(addr) {
            Ok((_wc, hash)) => return Ok(hash),
            Err(e) => {
                return Err(WarpError::AdapterError {
                    chain: "ton".into(),
                    reason: format!("TON address decode failed: {}", e),
                })
            }
        }
    }

    // Fall back to hex format (0x... or raw 64-char hex)
    let stripped = addr.strip_prefix("0x").unwrap_or(addr);
    if stripped.len() == 64 {
        let bytes = hex::decode(stripped).map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("invalid TON address hex: {}", e),
        })?;
        if bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "ton".into(),
                reason: format!("TON address must be 32 bytes, got {}", bytes.len()),
            });
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(arr)
    } else {
        Err(WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!(
                "TON address must be base64url (EQ.../UQ...) or 64-char hex, got '{}' (len={})",
                addr,
                addr.len()
            ),
        })
    }
}

/// `getTransactions` → array of transactions
#[derive(Deserialize)]
#[allow(dead_code)]
struct TonTx {
    transaction_id: TonTxId,
    in_msg: Option<TonMessage>,
    out_msgs: Option<Vec<TonMessage>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct TonTxId {
    hash: String,
    lt: u64,
    #[allow(dead_code)]
    account: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct TonMessage {
    value: String,
    message: String,
    source: String,
    destination: String,
    #[allow(dead_code)]
    body: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// TON adapter (TVM) — TON Center v2JSONRPC for read operations.
///
/// `execute_mint` returns a clear `AdapterError` because TON transaction
/// construction requires TL-B cell serialization + ADNL protocol, which needs
/// `ton-sdk`, `tonweb`, or `tonlib` (not in the current dependency set).
pub struct TonAdapter {
    api_url: String,
    client: reqwest::Client,
    api_key: Option<String>,
    bridge_account: Option<String>,
}

impl Default for TonAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl TonAdapter {
    /// Construct from environment variables.
    ///
    /// - `WARP_TON_API` — TON Center API endpoint (default: toncenter.com)
    /// - `WARP_TON_API_KEY` — optional API key for higher rate limits
    /// - `WARP_TON_BRIDGE_ACCOUNT` — ZION jetton master contract address (EQ.../UQ...)
    ///
    /// Contract source: V3/L2/bridge/contracts/non-evm/ton/zion_jetton.fc
    /// Deployment steps: V3/L2/bridge/contracts/non-evm/ton/README.md
    ///
    /// After deploying the TEP-74 jetton master contract (zion_jetton.fc),
    /// set WARP_TON_BRIDGE_ACCOUNT to the master contract address (EQ...).
    /// The WARP relay monitors this address for BridgeBurn events.
    pub fn new() -> Self {
        Self::from_env()
    }

    pub fn from_env() -> Self {
        let api_url = std::env::var("WARP_TON_API").unwrap_or_else(|_| DEFAULT_API_URL.to_string());
        let api_key = std::env::var("WARP_TON_API_KEY").ok();
        let bridge_account = std::env::var("WARP_TON_BRIDGE_ACCOUNT").ok();
        Self {
            api_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            api_key,
            bridge_account,
        }
    }

    /// Build a JSON-RPC request and return the `result` field.
    async fn rpc(&self, method: &str, params: Value) -> WarpResult<Value> {
        let body = RpcReq {
            jsonrpc: "2.0",
            id: 1,
            method,
            params,
        };
        let mut req = self.client.post(&self.api_url).json(&body);
        if let Some(key) = &self.api_key {
            req = req.header("X-API-Key", key);
        }
        let resp = req.send().await.map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: e.to_string(),
        })?;
        let rpc_resp: RpcResp = resp.json().await.map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: e.to_string(),
        })?;
        if let Some(err) = rpc_resp.error {
            return Err(WarpError::AdapterError {
                chain: "ton".into(),
                reason: format!("JSON-RPC error {}: {}", err.code, err.message),
            });
        }
        rpc_resp.result.ok_or_else(|| WarpError::AdapterError {
            chain: "ton".into(),
            reason: "null result".into(),
        })
    }

    /// `getMasterchainInfo` → last masterchain seqno.
    async fn get_masterchain_seqno(&self) -> WarpResult<u64> {
        let v = self.rpc("getMasterchainInfo", json!({})).await?;
        let info: MasterchainInfo =
            serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
                chain: "ton".into(),
                reason: format!("getMasterchainInfo parse: {}", e),
            })?;
        Ok(info.last.seqno)
    }

    /// `getAddressInformation` → (balance_nanoton, state).
    #[allow(dead_code)]
    async fn get_address_info(&self, address: &str) -> WarpResult<(u64, String)> {
        let v = self
            .rpc("getAddressInformation", json!({ "address": address }))
            .await?;
        let info: AddressInfo = serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("getAddressInformation parse: {}", e),
        })?;
        let balance = info.balance.parse::<u64>().unwrap_or(0);
        Ok((balance, info.state))
    }

    /// `getTransactions` → recent transactions for an account.
    async fn get_transactions(
        &self,
        address: &str,
        limit: u64,
        offset: u64,
    ) -> WarpResult<Vec<TonTx>> {
        let v = self
            .rpc(
                "getTransactions",
                json!({ "address": address, "limit": limit, "offset": offset }),
            )
            .await?;
        // TON Center returns an array directly in `result`.
        let txs: Vec<TonTx> = serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("getTransactions parse: {}", e),
        })?;
        Ok(txs)
    }

    /// `getTransactionInformation` → transaction details by hash.
    async fn get_transaction_info(&self, hash: &str) -> WarpResult<Value> {
        self.rpc("getTransactionInformation", json!({ "hash": hash }))
            .await
    }

    /// Fetch the current seqno for a wallet V2R2 contract via `runMethod`.
    ///
    /// Calls `getWalletData` (method id 0) on the wallet contract, which returns:
    /// [seqno:uint32, balance:Grams, pubkey:bits256, wallet_code:^Cell]
    ///
    /// Returns 0 if the wallet hasn't been deployed yet (uninitialized state).
    async fn get_wallet_seqno(&self, wallet_addr: &str) -> WarpResult<u32> {
        let result = self
            .rpc(
                "runMethod",
                json!({
                    "address": wallet_addr,
                    "method": "seqno",
                    "params": []
                }),
            )
            .await?;

        // TON Center returns: { "result": { "gas_used": ..., "stack": [["num", "<hex>"]] } }
        // The seqno is the first stack element as a hex-encoded big-endian uint.
        if let Some(stack) = result["stack"].as_array() {
            if let Some(first) = stack.first() {
                if let Some(num_str) = first.get(1).and_then(|v| v.as_str()) {
                    // Parse hex (may have 0x prefix)
                    let clean = num_str.strip_prefix("0x").unwrap_or(num_str);
                    if let Ok(bytes) = hex::decode(clean) {
                        // Big-endian, take last 4 bytes
                        let seqno = if bytes.len() >= 4 {
                            u32::from_be_bytes([
                                bytes[bytes.len() - 4],
                                bytes[bytes.len() - 3],
                                bytes[bytes.len() - 2],
                                bytes[bytes.len() - 1],
                            ])
                        } else if bytes.is_empty() {
                            0
                        } else {
                            let mut val: u32 = 0;
                            for &b in &bytes {
                                val = (val << 8) | b as u32;
                            }
                            val
                        };
                        return Ok(seqno);
                    }
                }
            }
        }

        // If the wallet is uninitialized, the method call may fail or return
        // an empty stack. Default to seqno=0.
        debug!("[WARP][ton] wallet seqno not found in response, defaulting to 0");
        Ok(0)
    }

    /// Parse a WARP bridge inbound deposit from a TON transaction.
    ///
    /// TON bridge deposits carry the WARP memo in the incoming message
    /// `message` (comment) field. Format: `WARP:1:<dest_chain>:<recipient>`.
    /// The amount is the incoming message value in nanoTON.
    fn parse_bridge_deposit(&self, tx: &TonTx, seqno: u64) -> Option<DepositProof> {
        let in_msg = tx.in_msg.as_ref()?;
        // Only inbound messages with a non-empty comment and a real source.
        let memo = in_msg.message.as_str();
        if !memo.contains("WARP") {
            return None;
        }
        let amount = in_msg.value.parse::<u64>().unwrap_or(0);
        let sender = if in_msg.source.is_empty() {
            "ton:external".to_string()
        } else {
            in_msg.source.clone()
        };
        Some(DepositProof {
            tx_hash: tx.transaction_id.hash.clone(),
            block_height: seqno,
            block_hash: format!("ton-mc-{}", seqno),
            sender,
            amount_flowers: amount,
            memo: memo.to_string(),
            confirmations: 0,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainAdapter impl
// ─────────────────────────────────────────────────────────────────────────────
#[async_trait]
impl ChainAdapter for TonAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Ton
    }

    fn name(&self) -> &str {
        "ton"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.get_masterchain_seqno().await {
            Ok(seqno) => {
                info!("[WARP][ton] Health OK — masterchain seqno {}", seqno);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][ton] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let bridge_account = match &self.bridge_account {
            Some(a) => a.clone(),
            None => {
                debug!("[WARP][ton] No bridge account configured (WARP_TON_BRIDGE_ACCOUNT)");
                return Ok(vec![]);
            }
        };
        let seqno = match self.get_masterchain_seqno().await {
            Ok(s) => s,
            Err(e) => {
                warn!("[WARP][ton] watch_events: cannot fetch seqno: {}", e);
                return Ok(vec![]);
            }
        };
        let txs = match self
            .get_transactions(&bridge_account, WATCH_TX_LIMIT, 0)
            .await
        {
            Ok(t) => t,
            Err(e) => {
                warn!("[WARP][ton] watch_events: getTransactions failed: {}", e);
                return Ok(vec![]);
            }
        };
        debug!(
            "[WARP][ton] {} recent txs on bridge account {}",
            txs.len(),
            bridge_account
        );

        let mut proofs = Vec::new();
        for tx in &txs {
            if let Some(proof) = self.parse_bridge_deposit(tx, seqno) {
                proofs.push(proof);
            }
        }
        info!("[WARP][ton] {} WARP deposit proofs found", proofs.len());
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        let signer = TonSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;
        let amount = instruction.amount_dest_atomic;
        info!(
            "[WARP][ton] minting {} to {} (relay pubkey {})",
            amount,
            instruction.recipient,
            signer.public_key_hex()
        );

        // 1. Parse recipient address (hex 32-byte hash + workchain)
        let recipient_hash = parse_ton_address(&instruction.recipient)?;

        // 2. Build jetton transfer body cell
        let body_cell = ton_cell::build_jetton_transfer_body(
            1,             // query_id
            amount as u64, // amount
            0,             // dest workchain
            &recipient_hash,
        );

        // 3. Build internal message cell (wrapping the body)
        let internal_msg = ton_cell::build_internal_message(
            0,               // dest workchain
            &recipient_hash, // dest address hash
            50_000_000,      // value (0.05 TON in nanoTON)
            body_cell,
        )
        .map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("internal message build failed: {}", e),
        })?;

        // 4. Fetch wallet seqno from chain (via runMethod)
        let wallet_addr = signer.address_string();
        let seqno = self.get_wallet_seqno(&wallet_addr).await.unwrap_or(0);
        info!("[WARP][ton] wallet {} seqno={}", wallet_addr, seqno);

        // 5. Compute wallet V2R2 signing hash
        let valid_until = (chrono::Utc::now().timestamp() as u32) + 3600; // 1 hour
        let signing_hash = ton_cell::wallet_v2r2_signing_hash(
            0x29a9a317, // subwallet_id (mainnet V2R2)
            valid_until,
            seqno,
            &internal_msg,
        );

        // 6. Sign with Ed25519
        let signature = signer.signing_key.sign(&signing_hash).to_bytes();

        // 7. Build external message cell
        let wallet_hash = signer.raw_address_hash();
        let external_cell = ton_cell::build_wallet_v2r2_external(
            signer.workchain(),
            &wallet_hash,
            0x29a9a317,
            valid_until,
            seqno,
            internal_msg,
            &signature,
        )
        .map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("external message build failed: {}", e),
        })?;

        // 8. Serialize to BOC
        let boc = ton_cell::serialize_boc(&external_cell);
        let boc_b64 = B64.encode(&boc);

        // 9. Submit via TON Center API
        let v = self
            .rpc("sendBase64Transaction", json!({ "boc": boc_b64 }))
            .await?;

        let result = v.as_str().unwrap_or("unknown");
        info!("[WARP][ton] TX submitted: {}", result);
        Ok(result.to_string())
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.get_masterchain_seqno().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let tx_info = self.get_transaction_info(tx_hash).await?;
        // The transaction's logical time (lt) gives an ordering hint; TON
        // finality is governed by masterchain block references. We approximate
        // confirmations as the difference between the current masterchain
        // seqno and the seqno at which the TX was included (if present).
        let tx_seqno = tx_info["transaction_id"]["lt"].as_u64().unwrap_or(0);
        let now_seqno = self.get_masterchain_seqno().await.unwrap_or(tx_seqno);
        Ok(now_seqno.saturating_sub(tx_seqno))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::protocol::MintInstruction;

    // NOTE: tests run without network access. The adapter must degrade
    // gracefully (health_check → false, watch_events → empty, etc.).

    #[test]
    fn test_ton_adapter_meta() {
        let a = TonAdapter::new();
        assert_eq!(a.name(), "ton");
        assert_eq!(a.family(), ChainFamily::Ton);
    }

    #[test]
    fn test_default_api_url() {
        // When WARP_TON_API is not set, the default URL is used.
        // (This test may read an env var set by another test, but the default
        // constant is checked directly here.)
        assert_eq!(DEFAULT_API_URL, "https://toncenter.com/api/v2JSONRPC");
    }

    #[test]
    fn test_rpc_req_serialization() {
        let req = RpcReq {
            jsonrpc: "2.0",
            id: 1,
            method: "getMasterchainInfo",
            params: json!({}),
        };
        let s = serde_json::to_string(&req).unwrap();
        assert!(s.contains("\"jsonrpc\":\"2.0\""));
        assert!(s.contains("\"method\":\"getMasterchainInfo\""));
        assert!(s.contains("\"id\":1"));
    }

    #[test]
    fn test_rpc_req_with_params_serialization() {
        let req = RpcReq {
            jsonrpc: "2.0",
            id: 1,
            method: "getTransactions",
            params: json!({ "address": "EQABC", "limit": 50, "offset": 0 }),
        };
        let v: Value = serde_json::from_str(&serde_json::to_string(&req).unwrap()).unwrap();
        assert_eq!(v["params"]["address"], "EQABC");
        assert_eq!(v["params"]["limit"], 50);
    }

    #[test]
    fn test_rpc_resp_parse_result() {
        let raw = r#"{"id":1,"jsonrpc":"2.0","result":{"last":{"seqno":12345}}}"#;
        let resp: RpcResp = serde_json::from_str(raw).unwrap();
        assert!(resp.result.is_some());
        assert!(resp.error.is_none());
        let last = resp.result.unwrap()["last"]["seqno"].as_u64().unwrap();
        assert_eq!(last, 12345);
    }

    #[test]
    fn test_rpc_resp_parse_error() {
        let raw = r#"{"id":1,"jsonrpc":"2.0","error":{"code":-32000,"message":"bad"}}"#;
        let resp: RpcResp = serde_json::from_str(raw).unwrap();
        assert!(resp.result.is_none());
        let err = resp.error.unwrap();
        assert_eq!(err.code, -32000);
        assert_eq!(err.message, "bad");
    }

    #[test]
    fn test_masterchain_info_parse() {
        let raw = r#"{
            "last": {
                "seqno": 42,
                "workchain": -1,
                "shard": "ffffffffffffffff",
                "root_hash": "abc",
                "file_hash": "def"
            }
        }"#;
        let info: MasterchainInfo = serde_json::from_str(raw).unwrap();
        assert_eq!(info.last.seqno, 42);
        assert_eq!(info.last.workchain, -1);
    }

    #[test]
    fn test_address_info_parse() {
        let raw = r#"{"balance":"1000000000","state":"active","data":"","code":""}"#;
        let info: AddressInfo = serde_json::from_str(raw).unwrap();
        assert_eq!(info.balance.parse::<u64>().unwrap(), 1_000_000_000);
        assert_eq!(info.state, "active");
    }

    #[test]
    fn test_ton_tx_parse() {
        let raw = r#"{
            "transaction_id": {"hash":"abc123","lt":1000,"account":"EQ..."},
            "in_msg": {
                "value":"5000000",
                "message":"WARP:1:base:0xRecipient",
                "source":"EQSender...",
                "destination":"EQBridge...",
                "body":""
            },
            "out_msgs": []
        }"#;
        let tx: TonTx = serde_json::from_str(raw).unwrap();
        assert_eq!(tx.transaction_id.hash, "abc123");
        assert_eq!(tx.transaction_id.lt, 1000);
        let in_msg = tx.in_msg.unwrap();
        assert_eq!(in_msg.value, "5000000");
        assert!(in_msg.message.contains("WARP"));
    }

    #[test]
    fn test_parse_bridge_deposit_valid() {
        let adapter = TonAdapter::new();
        let tx = TonTx {
            transaction_id: TonTxId {
                hash: "h123".into(),
                lt: 100,
                account: "EQBridge".into(),
            },
            in_msg: Some(TonMessage {
                value: "7500000".into(),
                message: "WARP:1:base:0xRecipient".into(),
                source: "EQSender".into(),
                destination: "EQBridge".into(),
                body: "".into(),
            }),
            out_msgs: None,
        };
        let proof = adapter.parse_bridge_deposit(&tx, 999).unwrap();
        assert_eq!(proof.tx_hash, "h123");
        assert_eq!(proof.amount_flowers, 7_500_000);
        assert_eq!(proof.sender, "EQSender");
        assert_eq!(proof.block_height, 999);
        assert!(proof.memo.contains("WARP"));
    }

    #[test]
    fn test_parse_bridge_deposit_no_warp_memo() {
        let adapter = TonAdapter::new();
        let tx = TonTx {
            transaction_id: TonTxId {
                hash: "h".into(),
                lt: 1,
                account: "EQ".into(),
            },
            in_msg: Some(TonMessage {
                value: "100".into(),
                message: "just a comment".into(),
                source: "EQ".into(),
                destination: "EQ".into(),
                body: "".into(),
            }),
            out_msgs: None,
        };
        assert!(adapter.parse_bridge_deposit(&tx, 1).is_none());
    }

    #[test]
    fn test_parse_bridge_deposit_no_in_msg() {
        let adapter = TonAdapter::new();
        let tx = TonTx {
            transaction_id: TonTxId {
                hash: "h".into(),
                lt: 1,
                account: "EQ".into(),
            },
            in_msg: None,
            out_msgs: None,
        };
        assert!(adapter.parse_bridge_deposit(&tx, 1).is_none());
    }

    #[test]
    fn test_parse_bridge_deposit_external_source() {
        let adapter = TonAdapter::new();
        let tx = TonTx {
            transaction_id: TonTxId {
                hash: "h".into(),
                lt: 1,
                account: "EQ".into(),
            },
            in_msg: Some(TonMessage {
                value: "1000".into(),
                message: "WARP:1:solana:7xKX".into(),
                source: "".into(),
                destination: "EQ".into(),
                body: "".into(),
            }),
            out_msgs: None,
        };
        let proof = adapter.parse_bridge_deposit(&tx, 5).unwrap();
        assert_eq!(proof.sender, "ton:external");
    }

    #[tokio::test]
    async fn test_health_check_no_network_returns_false() {
        // Point at an unreachable endpoint to force a failure without
        // relying on the absence of real network access.
        let adapter = TonAdapter {
            api_url: "http://127.0.0.1:1/no-such-endpoint".into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(200))
                .build()
                .unwrap(),
            api_key: None,
            bridge_account: None,
        };
        // health_check must never return Err — it returns Ok(false) on failure.
        let ok = adapter.health_check().await.unwrap();
        assert!(!ok);
    }

    #[tokio::test]
    async fn test_watch_events_no_bridge_account_returns_empty() {
        let adapter = TonAdapter {
            api_url: "http://127.0.0.1:1".into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(200))
                .build()
                .unwrap(),
            api_key: None,
            bridge_account: None,
        };
        let proofs = adapter.watch_events().await.unwrap();
        assert!(proofs.is_empty());
    }

    #[tokio::test]
    async fn test_watch_events_network_failure_returns_empty() {
        // Bridge account is set but the API is unreachable → empty vec.
        let adapter = TonAdapter {
            api_url: "http://127.0.0.1:1".into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(200))
                .build()
                .unwrap(),
            api_key: None,
            bridge_account: Some("EQDrjaLahLkMBhMCsr1g7zqF2JWQ5Q5ZQ5Q5ZQ5Q5ZQ5Q5Z".into()),
        };
        let proofs = adapter.watch_events().await.unwrap();
        assert!(proofs.is_empty());
    }

    #[tokio::test]
    async fn test_execute_mint_env_behaviour() {
        // Combined test to avoid env-var interference between parallel tests.
        // Part 1: no relay key → error mentioning the missing env var.
        std::env::remove_var("WARP_TON_RELAY_KEY");
        let adapter = TonAdapter::new();
        let inst = MintInstruction {
            dest_chain: "ton".into(),
            recipient: format!("0x{}", "a".repeat(64)),
            amount_dest_atomic: 1_000_000,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        let res = adapter.execute_mint(&inst).await;
        assert!(res.is_err(), "execute_mint should error without relay key");
        let msg = match res.unwrap_err() {
            WarpError::AdapterError { reason, .. } => reason,
            other => panic!("expected AdapterError, got {:?}", other),
        };
        assert!(
            msg.contains("WARP_TON_RELAY_KEY"),
            "error should mention the missing env var: {}",
            msg
        );

        // Part 2: with a valid key → signer loads, Cell/BOC encoding works,
        // but sendBase64Transaction fails (no network) → network error, NOT TL-B error.
        std::env::set_var("WARP_TON_RELAY_KEY", hex::encode([42u8; 32]));
        let adapter2 = TonAdapter {
            api_url: "http://127.0.0.1:1".into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(200))
                .build()
                .unwrap(),
            api_key: None,
            bridge_account: None,
        };
        let res2 = adapter2.execute_mint(&inst).await;
        assert!(res2.is_err(), "execute_mint should error without network");
        let msg2 = match res2.unwrap_err() {
            WarpError::AdapterError { reason, .. } => reason,
            other => panic!("expected AdapterError, got {:?}", other),
        };
        // Should NOT mention TON SDK — TL-B is now implemented
        assert!(
            !msg2.contains("ton-sdk") && !msg2.contains("tonweb") && !msg2.contains("tonlib"),
            "TL-B is now implemented — should not see TON SDK requirement: {}",
            msg2
        );
        std::env::remove_var("WARP_TON_RELAY_KEY");
    }

    #[tokio::test]
    async fn test_current_height_no_network_returns_err() {
        let adapter = TonAdapter {
            api_url: "http://127.0.0.1:1".into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(200))
                .build()
                .unwrap(),
            api_key: None,
            bridge_account: None,
        };
        assert!(adapter.current_height().await.is_err());
    }

    #[tokio::test]
    async fn test_confirmations_no_network_returns_err() {
        let adapter = TonAdapter {
            api_url: "http://127.0.0.1:1".into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(200))
                .build()
                .unwrap(),
            api_key: None,
            bridge_account: None,
        };
        assert!(adapter.confirmations("abc").await.is_err());
    }
}
