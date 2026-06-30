//! # Aptos Adapter (MoveVM)
//!
//! Connects the WARP bridge to an Aptos fullnode via the REST API.
//!
//! ## Endpoints used
//! - `GET /v1` — node info (chain id, ledger version, epoch, timestamp)
//! - `GET /v1/accounts/{address}/events/{event_handle}/{field}?limit=50` — bridge deposits
//! - `GET /v1/transactions/by_hash/{hash}` — TX confirmation status
//! - `POST /v1/transactions` — submit a BCS-encoded signed transaction
//!
//! ## Signing
//! The relay key is loaded from `WARP_APTOS_RELAY_KEY` (hex, 32-byte Ed25519 seed).
//! Account address = `SHA-256(0x00 || public_key)`. See [`crate::aptos_signer`].
//!
//! `execute_mint` loads the signer and derives the account address, but returns
//! a clear error for the BCS TX submission step — BCS encoding of
//! `RawTransaction`/`SignedTransaction` requires the `aptos-sdk` crate or a
//! manual BCS implementation, which is not yet wired in.

use crate::adapter::ChainAdapter;
use crate::aptos_signer::AptosSigner;
use crate::bcs::BcsEncoder;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use serde::Deserialize;
use tracing::{debug, info, warn};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_APTOS_RPC: &str = "https://fullnode.mainnet.aptoslabs.com";

/// Bridge module event handle on Aptos (Move resource path).
/// Override with `WARP_APTOS_EVENT_HANDLE` env var.
const DEFAULT_EVENT_HANDLE: &str = "warp_bridge";
/// Event field name for bridge deposit events.
const DEFAULT_EVENT_FIELD: &str = "deposit_events";
/// Bridge module account that hosts the event handle.
/// Override with `WARP_APTOS_BRIDGE_ACCOUNT` env var.
const DEFAULT_BRIDGE_ACCOUNT: &str =
    "0x0000000000000000000000000000000000000000000000000000000000000001";

// ─────────────────────────────────────────────────────────────────────────────
// Serde response types
// ─────────────────────────────────────────────────────────────────────────────

/// `GET /v1` response.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct NodeInfo {
    chain_id: u32,
    ledger_version: String,
    epoch: String,
    ledger_timestamp: String,
}

/// A single entry from the account events endpoint.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AptosEvent {
    /// Monotonic event sequence number (string per Aptos REST API).
    sequence_number: String,
    /// Event type tag (e.g. `0x1::warp_bridge::DepositEvent`).
    #[serde(rename = "type")]
    event_type: String,
    /// Event payload (arbitrary JSON).
    data: serde_json::Value,
}

/// `GET /v1/transactions/by_hash/{hash}` response (subset of fields).
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AptosTx {
    hash: String,
    #[serde(rename = "type")]
    tx_type: String,
    success: Option<bool>,
    version: Option<String>,
    vm_status: Option<String>,
}

/// `GET /v1/accounts/{address}` response — only the fields we need.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AccountResource {
    sequence_number: String,
    #[allow(dead_code)]
    authentication_key: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

/// Aptos adapter — REST-based bridge to an Aptos fullnode.
pub struct AptosAdapter {
    rpc_url: String,
    bridge_account: String,
    event_handle: String,
    event_field: String,
    client: reqwest::Client,
}

impl Default for AptosAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AptosAdapter {
    /// Construct from environment variables with sensible defaults.
    pub fn new() -> Self {
        Self::from_env()
    }

    /// Read configuration from env vars.
    pub fn from_env() -> Self {
        let rpc_url = std::env::var("WARP_APTOS_RPC")
            .unwrap_or_else(|_| DEFAULT_APTOS_RPC.to_string());
        let bridge_account = std::env::var("WARP_APTOS_BRIDGE_ACCOUNT")
            .unwrap_or_else(|_| DEFAULT_BRIDGE_ACCOUNT.to_string());
        let event_handle = std::env::var("WARP_APTOS_EVENT_HANDLE")
            .unwrap_or_else(|_| DEFAULT_EVENT_HANDLE.to_string());
        let event_field = std::env::var("WARP_APTOS_EVENT_FIELD")
            .unwrap_or_else(|_| DEFAULT_EVENT_FIELD.to_string());
        Self {
            rpc_url,
            bridge_account,
            event_handle,
            event_field,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap(),
        }
    }

    /// Construct with a specific RPC URL (for testing).
    pub fn with_rpc(rpc_url: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            bridge_account: DEFAULT_BRIDGE_ACCOUNT.to_string(),
            event_handle: DEFAULT_EVENT_HANDLE.to_string(),
            event_field: DEFAULT_EVENT_FIELD.to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(200))
                .build()
                .unwrap(),
        }
    }

    /// `GET /v1` → node info. Returns the parsed [`NodeInfo`].
    async fn node_info(&self) -> WarpResult<NodeInfo> {
        let url = format!("{}/v1", self.rpc_url);
        let info: NodeInfo = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("node_info request failed: {}", e),
            })?
            .error_for_status()
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("node_info HTTP status: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("node_info parse: {}", e),
            })?;
        Ok(info)
    }

    /// Query recent bridge deposit events for the configured bridge account.
    async fn get_bridge_events(&self, limit: u64) -> WarpResult<Vec<AptosEvent>> {
        let url = format!(
            "{}/v1/accounts/{}/events/{}/{}?limit={}",
            self.rpc_url, self.bridge_account, self.event_handle, self.event_field, limit
        );
        let events: Vec<AptosEvent> = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("events request failed: {}", e),
            })?
            .error_for_status()
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("events HTTP status: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("events parse: {}", e),
            })?;
        Ok(events)
    }

    /// `GET /v1/transactions/by_hash/{hash}` → TX status.
    async fn get_transaction(&self, tx_hash: &str) -> WarpResult<Option<AptosTx>> {
        let url = format!("{}/v1/transactions/by_hash/{}", self.rpc_url, tx_hash);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("tx lookup request failed: {}", e),
            })?;
        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let resp = resp.error_for_status().map_err(|e| WarpError::AdapterError {
            chain: "aptos".into(),
            reason: format!("tx lookup HTTP status: {}", e),
        })?;
        let tx: AptosTx = resp.json().await.map_err(|e| WarpError::AdapterError {
            chain: "aptos".into(),
            reason: format!("tx lookup parse: {}", e),
        })?;
        Ok(Some(tx))
    }

    /// Convert a raw Aptos event into a WARP [`DepositProof`].
    ///
    /// Expected event `data` fields (Move struct):
    /// `{ sender: address, amount: u64, dest_chain: string, dest_address: string }`
    fn parse_deposit_event(&self, event: &AptosEvent, ledger_version: u64) -> Option<DepositProof> {
        let data = &event.data;
        let sender = data
            .get("sender")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0")
            .to_string();
        let amount = data.get("amount").and_then(|v| v.as_u64()).unwrap_or(0);
        let dest_chain = data
            .get("dest_chain")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let dest_address = data
            .get("dest_address")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Only treat events whose type mentions the warp bridge module.
        if !event.event_type.contains("warp_bridge") {
            return None;
        }

        Some(DepositProof {
            tx_hash: format!("aptos-event-{}-{}", ledger_version, event.sequence_number),
            block_height: ledger_version,
            block_hash: format!("aptos-ledger-{}", ledger_version),
            sender,
            amount_flowers: amount,
            memo: format!("WARP_INBOUND:aptos:{}:{}", dest_chain, dest_address),
            confirmations: 0,
        })
    }

    /// `GET /v1/accounts/{address}` → account resource (sequence_number).
    async fn get_account(&self, address: &str) -> WarpResult<AccountResource> {
        let url = format!("{}/v1/accounts/{}", self.rpc_url, address);
        let acct: AccountResource = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("account request failed: {}", e),
            })?
            .error_for_status()
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("account HTTP status: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("account parse: {}", e),
            })?;
        Ok(acct)
    }

    /// Parse a hex Aptos address string (e.g. "0xabc...") into 32 bytes.
    fn parse_address_hex(hex_addr: &str) -> WarpResult<[u8; 32]> {
        let stripped = hex_addr.strip_prefix("0x").unwrap_or(hex_addr);
        // Aptos addresses can be shorter than 64 hex chars; left-pad to 32 bytes.
        let padded = format!("{:0>64}", stripped);
        let bytes = hex::decode(&padded).map_err(|e| WarpError::AdapterError {
            chain: "aptos".into(),
            reason: format!("invalid address hex '{}': {}", hex_addr, e),
        })?;
        if bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("address must be 32 bytes, got {}", bytes.len()),
            });
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(arr)
    }

    /// BCS-encode a `RawTransaction` for a `mint` entry function call.
    ///
    /// Aptos `RawTransaction` BCS layout:
    /// ```text
    /// sender: AccountAddress (32 bytes)
    /// sequence_number: u64
    /// payload: TransactionPayload::ScriptFunction (variant 2)
    ///   module.address: AccountAddress (32 bytes)
    ///   module.name: Identifier (string)
    ///   function: Identifier (string)
    ///   ty_args: Vec<TypeTag> (empty)
    ///   args: Vec<Vec<u8>> (BCS-encoded function args)
    /// max_gas_amount: u64
    /// gas_unit_price: u64
    /// expiration_timestamp_secs: u64
    /// chain_id: u8
    /// ```
    fn encode_raw_transaction(
        sender: &[u8; 32],
        sequence_number: u64,
        module_addr: &[u8; 32],
        module_name: &str,
        function_name: &str,
        args: Vec<Vec<u8>>,
        max_gas: u64,
        gas_price: u64,
        expiration: u64,
        chain_id: u8,
    ) -> Vec<u8> {
        let mut enc = BcsEncoder::new();
        // sender
        enc.address_32_mut(sender);
        // sequence_number
        enc.u64_mut(sequence_number);
        // payload: TransactionPayload::ScriptFunction = variant 2
        enc.enum_variant(2, |e| {
            // ModuleId: address + name
            e.address_32_mut(module_addr);
            e.string_mut(module_name);
            // function name
            e.string_mut(function_name);
            // ty_args: empty Vec<TypeTag>
            e.uleb128_mut(0);
            // args: Vec<Vec<u8>>
            e.seq(&args, |e2, arg| { e2.bytes_mut(arg); });
        });
        // max_gas_amount
        enc.u64_mut(max_gas);
        // gas_unit_price
        enc.u64_mut(gas_price);
        // expiration_timestamp_secs
        enc.u64_mut(expiration);
        // chain_id
        enc.u8_mut(chain_id);
        enc.take_bytes()
    }

    /// BCS-encode a `SignedTransaction` (Ed25519 authenticator).
    ///
    /// Layout:
    /// ```text
    /// raw_txn_bytes: Vec<u8> (the BCS-encoded RawTransaction)
    /// authenticator: TransactionAuthenticator::Ed25519 = variant 0
    ///   public_key: [u8; 32]
    ///   signature: [u8; 64]
    /// ```
    fn encode_signed_transaction(
        raw_txn_bytes: &[u8],
        public_key: &[u8; 32],
        signature: &[u8; 64],
    ) -> Vec<u8> {
        let mut enc = BcsEncoder::new();
        // RawTransaction is not a Vec<u8> in BCS — it's a struct serialized inline.
        // The SignedTransaction BCS is: raw_txn (struct, inline) + authenticator (enum).
        // We append the raw bytes directly since BCS structs have no length prefix.
        enc.raw_mut(raw_txn_bytes);
        // authenticator: Ed25519 = variant 0
        enc.enum_variant(0, |e| {
            e.address_32_mut(public_key);
            // signature: [u8; 64] — BCS serializes fixed arrays as sequences
            e.uleb128_mut(64);
            for b in signature.iter() {
                e.u8_mut(*b);
            }
        });
        enc.take_bytes()
    }

    /// Submit a BCS-encoded signed transaction to `POST /v1/transactions`.
    async fn submit_transaction(&self, signed_tx_bcs: &[u8]) -> WarpResult<String> {
        let url = format!("{}/v1/transactions", self.rpc_url);
        let resp = self
            .client
            .post(&url)
            .header("Content-Type", "application/x.aptos.signed_transaction+bcs")
            .body(signed_tx_bcs.to_vec())
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("submit TX request failed: {}", e),
            })?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if status.is_success() {
            // Parse the hash from the JSON response.
            let v: serde_json::Value = serde_json::from_str(&body).map_err(|e| {
                WarpError::AdapterError {
                    chain: "aptos".into(),
                    reason: format!("submit TX response parse: {}", e),
                }
            })?;
            let hash = v
                .get("hash")
                .and_then(|h| h.as_str())
                .ok_or_else(|| WarpError::AdapterError {
                    chain: "aptos".into(),
                    reason: format!("submit TX response missing hash: {}", body),
                })?;
            Ok(hash.to_string())
        } else {
            Err(WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("submit TX HTTP {}: {}", status, body),
            })
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainAdapter impl
// ─────────────────────────────────────────────────────────────────────────────
#[async_trait]
impl ChainAdapter for AptosAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Aptos
    }

    fn name(&self) -> &str {
        "aptos"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        match self.node_info().await {
            Ok(info) => {
                info!(
                    "[WARP][aptos] Health OK — chain_id {} ledger_version {}",
                    info.chain_id, info.ledger_version
                );
                Ok(true)
            }
            Err(e) => {
                warn!("[WARP][aptos] Health FAIL: {}", e);
                Ok(false)
            }
        }
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        let info = self.node_info().await?;
        let ledger_version: u64 = info.ledger_version.parse().unwrap_or(0);
        let events = self.get_bridge_events(50).await?;
        debug!(
            "[WARP][aptos] {} recent events on {}/{}",
            events.len(),
            self.event_handle,
            self.event_field
        );

        let mut proofs = Vec::new();
        for event in &events {
            if let Some(proof) = self.parse_deposit_event(event, ledger_version) {
                proofs.push(proof);
            }
        }
        info!("[WARP][aptos] {} bridge deposit proofs found", proofs.len());
        Ok(proofs)
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        // Load the Ed25519 relay key and derive the Aptos account address.
        let signer = AptosSigner::from_env().map_err(|e| WarpError::AdapterError {
            chain: "aptos".into(),
            reason: format!("relay key unavailable: {}", e),
        })?;

        let amount = instruction.amount_dest_atomic as u64;
        info!(
            "[WARP][aptos] minting {} wZION to {} from account {}",
            amount, instruction.recipient, signer.address
        );

        // 1. Get chain_id from node info
        let node_info = self.node_info().await?;
        let chain_id = node_info.chain_id as u8;

        // 2. Get the sender account's current sequence_number
        let account = self.get_account(&signer.address).await?;
        let sequence_number: u64 = account
            .sequence_number
            .parse()
            .map_err(|e| WarpError::AdapterError {
                chain: "aptos".into(),
                reason: format!("sequence_number parse: {}", e),
            })?;

        // 3. Parse the recipient address
        let recipient_addr = Self::parse_address_hex(&instruction.recipient)?;

        // 4. BCS-encode the function arguments:
        //    mint(address recipient, u64 amount)
        //    Each arg is BCS-encoded independently.
        let arg_recipient = {
            let mut e = BcsEncoder::new();
            e.address_32_mut(&recipient_addr);
            e.take_bytes()
        };
        let arg_amount = {
            let mut e = BcsEncoder::new();
            e.u64_mut(amount);
            e.take_bytes()
        };

        // 5. Parse the bridge module address
        let module_addr = Self::parse_address_hex(&self.bridge_account)?;

        // 6. BCS-encode the RawTransaction
        let expiration = chrono::Utc::now().timestamp() as u64 + 300; // 5 min expiry
        let raw_txn = Self::encode_raw_transaction(
            &signer.auth_key(),
            sequence_number,
            &module_addr,
            "warp_bridge",
            "mint",
            vec![arg_recipient, arg_amount],
            2000,    // max_gas_amount
            100,     // gas_unit_price (octas)
            expiration,
            chain_id,
        );

        // 7. Sign the raw transaction
        let signature = signer.sign(&raw_txn);
        let pubkey = signer.public_key();

        // 8. BCS-encode the SignedTransaction
        let signed_tx = Self::encode_signed_transaction(&raw_txn, &pubkey, &signature);

        // 9. Submit to the fullnode
        let tx_hash = self.submit_transaction(&signed_tx).await?;
        info!(
            "[WARP][aptos] mint TX submitted: hash={} (seq={})",
            tx_hash, sequence_number
        );
        Ok(tx_hash)
    }

    async fn current_height(&self) -> WarpResult<u64> {
        let info = self.node_info().await?;
        info.ledger_version.parse().map_err(|e| WarpError::AdapterError {
            chain: "aptos".into(),
            reason: format!("ledger_version parse: {}", e),
        })
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        let tx = self.get_transaction(tx_hash).await?;
        let tx_version: u64 = match tx.as_ref().and_then(|t| t.version.as_deref()) {
            Some(v) => v.parse().unwrap_or(0),
            None => 0,
        };
        // Confirmations = current ledger version - tx version (Aptos finality
        // is single-slot; any positive diff means confirmed).
        let current = self.current_height().await.unwrap_or(tx_version);
        Ok(current.saturating_sub(tx_version))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::aptos_signer::aptos_address_from_pubkey;
    use crate::protocol::MintInstruction;

    #[test]
    fn test_aptos_adapter_meta() {
        let a = AptosAdapter::new();
        assert_eq!(a.name(), "aptos");
        assert_eq!(a.family(), ChainFamily::Aptos);
    }

    #[test]
    fn test_adapter_env_behaviour() {
        // Part 1: env override
        std::env::set_var("WARP_APTOS_RPC", "https://example.test/v1");
        let a = AptosAdapter::from_env();
        assert_eq!(a.rpc_url, "https://example.test/v1");
        std::env::remove_var("WARP_APTOS_RPC");

        // Part 2: defaults when env unset
        std::env::remove_var("WARP_APTOS_RPC");
        std::env::remove_var("WARP_APTOS_BRIDGE_ACCOUNT");
        std::env::remove_var("WARP_APTOS_EVENT_HANDLE");
        std::env::remove_var("WARP_APTOS_EVENT_FIELD");
        let a = AptosAdapter::from_env();
        assert_eq!(a.rpc_url, DEFAULT_APTOS_RPC);
        assert_eq!(a.bridge_account, DEFAULT_BRIDGE_ACCOUNT);
        assert_eq!(a.event_handle, DEFAULT_EVENT_HANDLE);
        assert_eq!(a.event_field, DEFAULT_EVENT_FIELD);
    }

    // ── Address derivation ──────────────────────────────────────────────────

    #[test]
    fn test_address_derivation_starts_with_0x() {
        let pubkey = [0x77u8; 32];
        let addr = aptos_address_from_pubkey(&pubkey);
        assert!(addr.starts_with("0x"));
        assert_eq!(addr.len(), 66);
    }

    #[test]
    fn test_address_derivation_deterministic() {
        let pubkey = [0x33u8; 32];
        let a1 = aptos_address_from_pubkey(&pubkey);
        let a2 = aptos_address_from_pubkey(&pubkey);
        assert_eq!(a1, a2);
    }

    #[test]
    fn test_address_derivation_differs_for_different_pubkeys() {
        let a1 = aptos_address_from_pubkey(&[0x01u8; 32]);
        let a2 = aptos_address_from_pubkey(&[0x02u8; 32]);
        assert_ne!(a1, a2);
    }

    // ── Health check (no network → returns false, not error) ────────────────

    #[tokio::test]
    async fn test_health_check_no_network_returns_false() {
        // Point at an unreachable endpoint with a very short timeout.
        let a = AptosAdapter {
            rpc_url: "http://127.0.0.1:1".into(),
            bridge_account: DEFAULT_BRIDGE_ACCOUNT.into(),
            event_handle: DEFAULT_EVENT_HANDLE.into(),
            event_field: DEFAULT_EVENT_FIELD.into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(50))
                .build()
                .unwrap(),
        };
        // Must return Ok(false), not an Err — graceful degradation.
        let result = a.health_check().await;
        assert!(result.is_ok(), "health_check should not error on network failure");
        assert_eq!(result.unwrap(), false);
    }

    // ── execute_mint (no key → error) ───────────────────────────────────────

    #[tokio::test]
    async fn test_execute_mint_env_behaviour() {
        // Combined test to avoid env-var interference between parallel tests.
        // Part 1: no relay key → error mentioning the missing env var.
        std::env::remove_var("WARP_APTOS_RELAY_KEY");
        let a = AptosAdapter::new();
        let inst = MintInstruction {
            dest_chain: "aptos".into(),
            recipient: "0xabc".into(),
            amount_dest_atomic: 1_000_000,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        let result = a.execute_mint(&inst).await;
        assert!(result.is_err(), "execute_mint should error without relay key");
        let err = result.unwrap_err();
        match err {
            WarpError::AdapterError { chain, reason } => {
                assert_eq!(chain, "aptos");
                assert!(
                    reason.contains("relay key unavailable")
                        || reason.contains("WARP_APTOS_RELAY_KEY"),
                    "reason should mention the missing relay key, got: {}",
                    reason
                );
            }
            other => panic!("expected AdapterError, got {:?}", other),
        }

        // Part 2: with a valid key → signer loads, BCS encoding works,
        // but node_info() fails (no network) → network error, NOT BCS error.
        std::env::set_var("WARP_APTOS_RELAY_KEY", hex::encode(&[0x42u8; 32]));
        let a2 = AptosAdapter::with_rpc("http://127.0.0.1:1");
        let result2 = a2.execute_mint(&inst).await;
        assert!(result2.is_err(), "execute_mint should error without network");
        let err2 = result2.unwrap_err();
        match err2 {
            WarpError::AdapterError { chain, reason } => {
                assert_eq!(chain, "aptos");
                assert!(
                    !reason.contains("BCS"),
                    "BCS is now implemented — should not see BCS error, got: {}",
                    reason
                );
            }
            other => panic!("expected AdapterError, got {:?}", other),
        }
        std::env::remove_var("WARP_APTOS_RELAY_KEY");
    }

    #[test]
    fn test_bcs_encode_raw_transaction_deterministic() {
        let sender = [0x01u8; 32];
        let module_addr = [0x02u8; 32];
        let args = vec![vec![0xaa; 32], vec![0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]];
        let raw1 = AptosAdapter::encode_raw_transaction(
            &sender, 5, &module_addr, "warp_bridge", "mint",
            args.clone(), 2000, 100, 99999, 1,
        );
        let raw2 = AptosAdapter::encode_raw_transaction(
            &sender, 5, &module_addr, "warp_bridge", "mint",
            args, 2000, 100, 99999, 1,
        );
        assert_eq!(raw1, raw2);
        // Verify structure:
        // 32 (sender) + 8 (seq) + 1 (variant) + 32 (module addr) +
        // 12 ("warp_bridge": ULEB128(11)+11) + 5 ("mint": ULEB128(4)+4) +
        // 1 (ty_args empty) + 1 (args len=2) + 33 (arg1: ULEB128(32)+32) + 9 (arg2: ULEB128(8)+8) +
        // 8 (gas) + 8 (price) + 8 (expiry) + 1 (chain_id) = 159
        assert_eq!(raw1.len(), 159);
    }

    #[test]
    fn test_bcs_encode_signed_transaction() {
        let raw = vec![0xde, 0xad, 0xbe, 0xef];
        let pubkey = [0x42u8; 32];
        let sig = [0x55u8; 64];
        let signed = AptosAdapter::encode_signed_transaction(&raw, &pubkey, &sig);
        // raw (4 bytes inline) + variant(1) + pubkey(32) + ULEB128(64) + 64 bytes
        assert_eq!(signed.len(), 4 + 1 + 32 + 1 + 64);
        // First 4 bytes should be the raw txn
        assert_eq!(&signed[0..4], &[0xde, 0xad, 0xbe, 0xef]);
        // Variant 0 (Ed25519)
        assert_eq!(signed[4], 0);
    }

    #[test]
    fn test_parse_address_hex_short() {
        // "0x1" should be left-padded to 32 bytes
        let addr = AptosAdapter::parse_address_hex("0x1").unwrap();
        assert_eq!(addr[31], 1);
        assert_eq!(addr[0], 0);
    }

    #[test]
    fn test_parse_address_hex_full() {
        let hex_str = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let addr = AptosAdapter::parse_address_hex(hex_str).unwrap();
        assert_eq!(addr[0], 0x12);
        assert_eq!(addr[31], 0xef);
    }

    #[test]
    fn test_parse_address_hex_invalid() {
        assert!(AptosAdapter::parse_address_hex("not-hex").is_err());
    }

    // ── Event parsing ───────────────────────────────────────────────────────

    #[test]
    fn test_parse_deposit_event_valid() {
        let a = AptosAdapter::new();
        let event = AptosEvent {
            sequence_number: "5".into(),
            event_type: "0x1::warp_bridge::DepositEvent".into(),
            data: serde_json::json!({
                "sender": "0xdeadbeef",
                "amount": 7_500_000,
                "dest_chain": "zion-l1",
                "dest_address": "zion1abc"
            }),
        };
        let proof = a.parse_deposit_event(&event, 123_456).unwrap();
        assert_eq!(proof.amount_flowers, 7_500_000);
        assert_eq!(proof.sender, "0xdeadbeef");
        assert_eq!(proof.block_height, 123_456);
        assert_eq!(proof.memo, "WARP_INBOUND:aptos:zion-l1:zion1abc");
        assert!(proof.tx_hash.contains("123456"));
    }

    #[test]
    fn test_parse_deposit_event_ignores_non_warp_type() {
        let a = AptosAdapter::new();
        let event = AptosEvent {
            sequence_number: "1".into(),
            event_type: "0x1::coin::DepositEvent".into(),
            data: serde_json::json!({"amount": 100}),
        };
        assert!(a.parse_deposit_event(&event, 1).is_none());
    }

    #[test]
    fn test_parse_deposit_event_missing_amount_defaults_zero() {
        let a = AptosAdapter::new();
        let event = AptosEvent {
            sequence_number: "2".into(),
            event_type: "0x1::warp_bridge::DepositEvent".into(),
            data: serde_json::json!({"sender": "0x1"}),
        };
        let proof = a.parse_deposit_event(&event, 99).unwrap();
        assert_eq!(proof.amount_flowers, 0);
    }

    // ── current_height (no network → error, not panic) ──────────────────────

    #[tokio::test]
    async fn test_current_height_no_network_errors_gracefully() {
        let a = AptosAdapter {
            rpc_url: "http://127.0.0.1:1".into(),
            bridge_account: DEFAULT_BRIDGE_ACCOUNT.into(),
            event_handle: DEFAULT_EVENT_HANDLE.into(),
            event_field: DEFAULT_EVENT_FIELD.into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(50))
                .build()
                .unwrap(),
        };
        let result = a.current_height().await;
        assert!(result.is_err());
    }
}
