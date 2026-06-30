//! # Sui Adapter (MoveVM)
//!
//! Connects the WARP bridge to Sui mainnet via the JSON-RPC gateway.
//!
//! ## Supported calls
//! - `health_check` — `sui_getLatestCheckpointSequenceNumber`
//! - `current_height` — latest checkpoint sequence number
//! - `watch_events` — `sui_queryEvents` filtered for WARP bridge deposits
//! - `execute_mint` — loads the Ed25519 relay key, derives the Sui address,
//!   and builds the signature envelope, then returns a clear error because
//!   BCS `TransactionData` construction is not yet implemented
//! - `confirmations` — `sui_getTransactionBlock` finality status
//!
//! ## Configuration
//! - `WARP_SUI_RPC` — override the default `https://fullnode.mainnet.sui.io`
//! - `WARP_SUI_RELAY_KEY` — hex-encoded 32-byte Ed25519 seed (for `execute_mint`)

use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::sui_signer::SuiSigner;
use crate::types::ChainFamily;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{debug, info, warn};

/// Default Sui mainnet JSON-RPC endpoint.
const DEFAULT_SUI_RPC: &str = "https://fullnode.mainnet.sui.io";

/// Substring used to recognise WARP bridge deposit events emitted by the
/// Move bridge module. The fully-qualified event type looks like
/// `0x<pkg>::bridge::DepositEvent` — we match on the module/event name.
const WARP_EVENT_TYPE_HINT: &str = "::bridge::DepositEvent";

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
    result: Option<Value>,
    #[allow(dead_code)]
    error: Option<Value>,
}

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
            chain: "sui".into(),
            reason: e.to_string(),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "sui".into(),
            reason: e.to_string(),
        })?;
    resp.result.ok_or_else(|| WarpError::AdapterError {
        chain: "sui".into(),
        reason: "null result".into(),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Serde structs for Sui RPC responses
// ─────────────────────────────────────────────────────────────────────────────

/// `sui_queryEvents` result envelope.
#[derive(Deserialize)]
#[allow(non_snake_case, dead_code)]
struct EventPage {
    data: Vec<SuiEvent>,
    #[serde(default)]
    nextCursor: Option<Value>,
    #[serde(default)]
    hasNextPage: bool,
}

/// A single Sui event.
#[derive(Deserialize)]
#[allow(non_snake_case, dead_code)]
struct SuiEvent {
    /// `{ "txDigest": "0x...", "eventSeq": "..." }`
    id: SuiEventId,
    /// Fully-qualified Move event type, e.g. `0x..::bridge::DepositEvent`.
    #[serde(rename = "type")]
    event_type: String,
    /// Milliseconds since epoch (string in Sui JSON-RPC).
    #[serde(default)]
    timestampMs: Option<String>,
    /// Decoded JSON payload of the event fields.
    #[serde(default)]
    parsedJson: Option<Value>,
    /// BCS-encoded event bytes (base64).
    #[serde(default)]
    bcs: Option<String>,
}

#[derive(Deserialize)]
#[allow(non_snake_case, dead_code)]
struct SuiEventId {
    txDigest: String,
    eventSeq: String,
}

/// `sui_getTransactionBlock` response (subset).
#[derive(Deserialize)]
#[allow(non_snake_case, dead_code)]
struct SuiTxBlock {
    digest: String,
    /// Finality: `EXECUTED` / `CHECKPOINTED` / `CONFIRMED` / `FINAL`.
    #[serde(default)]
    status: Option<String>,
    /// Checkpoint sequence number the TX was included in (string).
    #[serde(default)]
    checkpoint: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Sui adapter — JSON-RPC gateway to Sui mainnet.
pub struct SuiAdapter {
    rpc_url: String,
    client: reqwest::Client,
}

impl Default for SuiAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SuiAdapter {
    /// Construct with defaults (mainnet RPC, 15s timeout).
    pub fn new() -> Self {
        Self::from_env()
    }

    /// Read configuration from env vars.
    /// - `WARP_SUI_RPC` overrides the default mainnet endpoint.
    pub fn from_env() -> Self {
        let rpc_url =
            std::env::var("WARP_SUI_RPC").unwrap_or_else(|_| DEFAULT_SUI_RPC.to_string());
        Self {
            rpc_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
        }
    }

    /// `sui_getLatestCheckpointSequenceNumber` → latest checkpoint number.
    async fn get_latest_checkpoint(&self) -> WarpResult<u64> {
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "sui_getLatestCheckpointSequenceNumber",
            json!([]),
        )
        .await?;
        parse_seq_string(&v)
    }

    /// `sui_getCheckpoint` → checkpoint details (unused fields allowed).
    async fn _get_checkpoint(&self, seq: u64) -> WarpResult<Value> {
        rpc(
            &self.client,
            &self.rpc_url,
            "sui_getCheckpoint",
            json!([seq.to_string()]),
        )
        .await
    }

    /// `sui_queryEvents` with a MoveModule filter, returning up to `limit` events.
    async fn query_events(&self, limit: u64) -> WarpResult<Vec<SuiEvent>> {
        // Filter for Move events emitted by a `bridge` module. The package ID
        // is intentionally broad (`0x2` is the Sui framework namespace placeholder)
        // — we further filter client-side by event type hint. A production relay
        // would pin the exact deployed package object ID.
        let filter = json!({"MoveModule": {"module": "bridge", "package": "0x2"}});
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "sui_queryEvents",
            json!([filter, Value::Null, limit, false]),
        )
        .await?;
        let page: EventPage = serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
            chain: "sui".into(),
            reason: format!("queryEvents parse: {}", e),
        })?;
        Ok(page.data)
    }

    /// `sui_getTransactionBlock` → TX status + checkpoint.
    async fn get_transaction_block(&self, digest: &str) -> WarpResult<Option<SuiTxBlock>> {
        let options = json!({"showEffects": true});
        let v = rpc(
            &self.client,
            &self.rpc_url,
            "sui_getTransactionBlock",
            json!([digest, options]),
        )
        .await?;
        if v.is_null() {
            return Ok(None);
        }
        let tx: SuiTxBlock =
            serde_json::from_value(v).map_err(|e| WarpError::AdapterError {
                chain: "sui".into(),
                reason: format!("tx block parse: {}", e),
            })?;
        Ok(Some(tx))
    }

    /// Convert a raw Sui event into a WARP `DepositProof` when it looks like a
    /// bridge deposit. Returns `None` for non-WARP events.
    fn parse_deposit_event(&self, ev: &SuiEvent, latest_checkpoint: u64) -> Option<DepositProof> {
        if !ev.event_type.contains(WARP_EVENT_TYPE_HINT) {
            return None;
        }
        let parsed = ev.parsedJson.as_ref()?;

        // Field names are best-effort — the Move struct may use `amount`,
        // `amount_flowers`, `recipient`, `dest`, `sender`, etc.
        let amount = parsed
            .get("amount")
            .or_else(|| parsed.get("amount_flowers"))
            .and_then(|a| a.as_u64().or_else(|| a.as_str().and_then(|s| s.parse().ok())))
            .unwrap_or(0);

        let recipient = parsed
            .get("recipient")
            .or_else(|| parsed.get("dest"))
            .and_then(|v| v.as_str())
            .unwrap_or("zion1unknown")
            .to_string();

        let sender = parsed
            .get("sender")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let checkpoint = parsed
            .get("checkpoint")
            .and_then(|c| c.as_u64().or_else(|| c.as_str().and_then(|s| s.parse().ok())))
            .unwrap_or(latest_checkpoint);

        Some(DepositProof {
            tx_hash: ev.id.txDigest.clone(),
            block_height: checkpoint,
            block_hash: format!("sui-checkpoint-{}", checkpoint),
            sender,
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:sui:{}", recipient),
            confirmations: latest_checkpoint.saturating_sub(checkpoint),
        })
    }
}

/// Parse a Sui sequence-number value (returned as a JSON string) into u64.
fn parse_seq_string(v: &Value) -> WarpResult<u64> {
    let s = v.as_str().ok_or_else(|| WarpError::AdapterError {
        chain: "sui".into(),
        reason: "expected checkpoint sequence number as string".into(),
    })?;
    s.parse::<u64>().map_err(|e| WarpError::AdapterError {
        chain: "sui".into(),
        reason: format!("invalid checkpoint sequence number: {}", e),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainAdapter impl
// ─────────────────────────────────────────────────────────────────────────────
#[async_trait]
impl ChainAdapter for SuiAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Sui
    }

    fn name(&self) -> &str {
        "sui"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.get_latest_checkpoint().await {
            Ok(seq) => {
                info!("[WARP][sui] Health OK — checkpoint {}", seq);
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][sui] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let latest = self.get_latest_checkpoint().await?;
        let events = self.query_events(50).await?;
        debug!(
            "[WARP][sui] {} recent events at checkpoint {}",
            events.len(),
            latest
        );

        let mut proofs = Vec::new();
        for ev in &events {
            if let Some(proof) = self.parse_deposit_event(ev, latest) {
                proofs.push(proof);
            }
        }
        info!("[WARP][sui] {} WARP deposit proofs found", proofs.len());
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        // Load the Ed25519 relay key and derive the Sui address + signature
        // envelope. This validates the signing path even though the BCS
        // transaction body is not yet constructed.
        let signer = SuiSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "sui".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;
        let _address = signer.address();
        let _amount = instruction.amount_dest_atomic;

        info!(
            "[WARP][sui] execute_mint for {} (amount {}) — signer address {}",
            instruction.recipient,
            instruction.amount_dest_atomic,
            _address
        );

        // BCS-encoded `TransactionData` (kind + gas + sponsor + sender + gas_price +
        // gas_budget + expiration) is required to build the tx_bytes that the
        // signature covers. This is not yet implemented — return a clear error.
        Err(WarpError::AdapterError {
            chain: "sui".into(),
            reason: "BCS TransactionData construction not yet implemented — \
                     Ed25519 key loaded and address derived, but tx_bytes cannot \
                     be built without a BCS encoder for the Sui transaction kind"
                .into(),
        })
    }

    async fn current_height(&self) -> WarpResult<u64> {
        self.get_latest_checkpoint().await
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let tx = self.get_transaction_block(tx_hash).await?.ok_or_else(|| {
            WarpError::AdapterError {
                chain: "sui".into(),
                reason: format!("transaction {} not found", tx_hash),
            }
        })?;

        // Sui finality ladder: EXECUTED → CHECKPOINTED → CONFIRMED → FINAL.
        // Treat CHECKPOINTED+ as having a checkpoint number we can diff against
        // the latest checkpoint to report "confirmations".
        let tx_checkpoint = tx
            .checkpoint
            .as_deref()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        let latest = self.get_latest_checkpoint().await.unwrap_or(tx_checkpoint);
        let confs = latest.saturating_sub(tx_checkpoint);

        // If the TX has not yet reached a checkpoint, surface 0 confirmations
        // (the caller can retry). A `FINAL` status is the strongest signal but
        // we still report the checkpoint delta for observability.
        match tx.status.as_deref() {
            Some("EXECUTED") => Ok(0),
            _ => Ok(confs),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::MintInstruction;
    use crate::sui_signer::{sui_address_from_pubkey, sui_signature_b64, ED25519_FLAG};
    use base64::{engine::general_purpose::STANDARD as B64, Engine};
    use sha2::Digest;

    #[test]
    fn test_sui_adapter_meta() {
        std::env::remove_var("WARP_SUI_RPC");
        let a = SuiAdapter::new();
        assert_eq!(a.name(), "sui");
        assert_eq!(a.family(), ChainFamily::Sui);
        assert_eq!(a.rpc_url, DEFAULT_SUI_RPC);
    }

    #[test]
    fn test_from_env_overrides_rpc_url() {
        std::env::set_var("WARP_SUI_RPC", "https://example.test/sui");
        let a = SuiAdapter::from_env();
        assert_eq!(a.rpc_url, "https://example.test/sui");
        std::env::remove_var("WARP_SUI_RPC");
    }

    #[test]
    fn test_address_derivation_format() {
        let pk = [0xabu8; 32];
        let addr = sui_address_from_pubkey(&pk);
        assert!(addr.starts_with("0x"));
        assert_eq!(addr.len(), 66); // 0x + 64 hex chars
        // Hex body must decode to 32 bytes.
        let body = &addr[2..];
        assert_eq!(hex::decode(body).unwrap().len(), 32);
    }

    #[test]
    fn test_address_derivation_uses_flag_byte() {
        // SHA-256(0x00 || pk) must differ from SHA-256(pk).
        let pk = [0x11u8; 32];
        let with_flag = sui_address_from_pubkey(&pk);
        let plain = sha2::Sha256::digest(&pk);
        let plain_addr = format!("0x{}", hex::encode(plain));
        assert_ne!(with_flag, plain_addr);
    }

    #[test]
    fn test_signature_format_length_and_flag() {
        let sig = [0x01u8; 64];
        let pk = [0x02u8; 32];
        let b64 = sui_signature_b64(&sig, &pk);
        let decoded = B64.decode(&b64).unwrap();
        assert_eq!(decoded.len(), 97); // 1 + 64 + 32
        assert_eq!(decoded[0], ED25519_FLAG);
        assert_eq!(&decoded[1..65], &sig[..]);
        assert_eq!(&decoded[65..97], &pk[..]);
    }

    #[test]
    fn test_signature_format_is_base64() {
        let sig = [0u8; 64];
        let pk = [0u8; 32];
        let b64 = sui_signature_b64(&sig, &pk);
        // 97 bytes → 130 base64 chars (no padding because 97 % 3 == 1 → 2 padding).
        // base64 of 97 bytes = ceil(97/3)*4 = 33*4 = 132 chars (with padding).
        assert!(B64.decode(&b64).is_ok());
    }

    #[tokio::test]
    async fn test_health_check_no_network_returns_false() {
        // Point at a non-routable endpoint so the request fails fast.
        std::env::set_var("WARP_SUI_RPC", "http://127.0.0.1:1/sui");
        let a = SuiAdapter::from_env();
        std::env::remove_var("WARP_SUI_RPC");
        let ok = a.health_check().await.unwrap();
        // No network → health_check returns Ok(false), never errors.
        assert!(!ok);
    }

    #[tokio::test]
    async fn test_execute_mint_no_key_returns_error() {
        std::env::remove_var("WARP_SUI_RELAY_KEY");
        let a = SuiAdapter::new();
        let inst = MintInstruction {
            dest_chain: "sui".into(),
            recipient: "0xabc".into(),
            amount_dest_atomic: 1_000_000,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        let res = a.execute_mint(&inst).await;
        assert!(res.is_err());
        let msg = res.unwrap_err().to_string();
        assert!(msg.contains("relay key unavailable") || msg.contains("WARP_SUI_RELAY_KEY"));
    }

    #[tokio::test]
    async fn test_execute_mint_with_key_returns_bcs_error() {
        // Provide a valid key so the signer loads; we expect the BCS error.
        std::env::set_var("WARP_SUI_RELAY_KEY", hex::encode(&[0x42u8; 32]));
        let a = SuiAdapter::new();
        let inst = MintInstruction {
            dest_chain: "sui".into(),
            recipient: "0xabc".into(),
            amount_dest_atomic: 1_000_000,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        let res = a.execute_mint(&inst).await;
        std::env::remove_var("WARP_SUI_RELAY_KEY");
        assert!(res.is_err());
        let msg = res.unwrap_err().to_string();
        assert!(msg.contains("BCS"), "expected BCS error, got: {}", msg);
    }

    #[test]
    fn test_parse_seq_string_valid() {
        let v = json!("12345");
        assert_eq!(parse_seq_string(&v).unwrap(), 12345);
    }

    #[test]
    fn test_parse_seq_string_invalid() {
        let v = json!("not-a-number");
        assert!(parse_seq_string(&v).is_err());
    }

    #[test]
    fn test_parse_seq_string_non_string() {
        let v = json!(12345u64);
        assert!(parse_seq_string(&v).is_err());
    }

    #[test]
    fn test_parse_deposit_event_non_warp_returns_none() {
        std::env::remove_var("WARP_SUI_RPC");
        let a = SuiAdapter::new();
        let ev = SuiEvent {
            id: SuiEventId {
                txDigest: "0xabc".into(),
                eventSeq: "1".into(),
            },
            event_type: "0x2::transfer::Transfer".into(),
            timestampMs: None,
            parsedJson: Some(json!({})),
            bcs: None,
        };
        assert!(a.parse_deposit_event(&ev, 100).is_none());
    }

    #[test]
    fn test_parse_deposit_event_warp_with_fields() {
        std::env::remove_var("WARP_SUI_RPC");
        let a = SuiAdapter::new();
        let ev = SuiEvent {
            id: SuiEventId {
                txDigest: "0xdeadbeef".into(),
                eventSeq: "42".into(),
            },
            event_type: "0xpkg::bridge::DepositEvent".into(),
            timestampMs: Some("1700000000000".into()),
            parsedJson: Some(json!({
                "amount": 5_000_000,
                "recipient": "zion1abc",
                "sender": "0xsender",
                "checkpoint": 90,
            })),
            bcs: None,
        };
        let proof = a.parse_deposit_event(&ev, 100).unwrap();
        assert_eq!(proof.tx_hash, "0xdeadbeef");
        assert_eq!(proof.amount_flowers, 5_000_000);
        assert_eq!(proof.sender, "0xsender");
        assert_eq!(proof.memo, "WARP_INBOUND:sui:zion1abc");
        assert_eq!(proof.confirmations, 10);
        assert_eq!(proof.block_height, 90);
    }

    #[test]
    fn test_parse_deposit_event_warp_string_amount() {
        std::env::remove_var("WARP_SUI_RPC");
        let a = SuiAdapter::new();
        let ev = SuiEvent {
            id: SuiEventId {
                txDigest: "0xtx".into(),
                eventSeq: "0".into(),
            },
            event_type: "0xpkg::bridge::DepositEvent".into(),
            timestampMs: None,
            parsedJson: Some(json!({
                "amount": "123456",
                "dest": "zion1dest",
            })),
            bcs: None,
        };
        let proof = a.parse_deposit_event(&ev, 50).unwrap();
        assert_eq!(proof.amount_flowers, 123_456);
        assert_eq!(proof.memo, "WARP_INBOUND:sui:zion1dest");
    }

    #[test]
    fn test_parse_deposit_event_warp_no_parsed_json_returns_none() {
        std::env::remove_var("WARP_SUI_RPC");
        let a = SuiAdapter::new();
        let ev = SuiEvent {
            id: SuiEventId {
                txDigest: "0xtx".into(),
                eventSeq: "0".into(),
            },
            event_type: "0xpkg::bridge::DepositEvent".into(),
            timestampMs: None,
            parsedJson: None,
            bcs: None,
        };
        assert!(a.parse_deposit_event(&ev, 50).is_none());
    }
}
