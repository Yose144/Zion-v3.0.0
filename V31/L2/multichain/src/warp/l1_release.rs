//! # L1 Release — automated inbound unlock path
//!
//! When a burn is detected on an external chain (inbound transfer), the
//! locked ZION sitting in the L1 bridge vault must be released back to the
//! user. The L1 node builds and mines the unlock transaction itself via
//! `submitBridgeUnlock`; this module produces the validator proof bundle the
//! node requires.
//!
//! ## Consensus contract (enforced by `zion-core::v3_bridge`)
//!
//! * Canonical message:
//!   `unlock|recipient={addr}|amount={flowers}|chain={src}|burn_id={id}|evm_tx={hash}`
//! * Each proof is a secp256k1 ECDSA signature over that message (k256
//!   `Signer`/`Verifier`, SHA-256 digest internally).
//! * ≥ `BRIDGE_MIN_VALIDATOR_PROOFS` (3) proofs from distinct, allow-listed
//!   compressed pubkeys (`ZION_BRIDGE_VALIDATOR_PUBKEYS` on the L1 node).
//!
//! ## Key custody
//!
//! Release keys come from `WARP_L1_RELEASE_KEYS` (comma-separated hex
//! secp256k1 private keys). For meaningful security these keys belong to
//! distinct operators/nodes; in single-node Alpha mode an operator may
//! co-locate them, which trades the multisig guarantee for automation — the
//! L1 still enforces the ≥3 distinct-pubkey rule.

use std::time::Duration;

use k256::ecdsa::signature::{Signer, Verifier};
use k256::ecdsa::{Signature, SigningKey, VerifyingKey};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tracing::info;

use crate::warp::error::{WarpError, WarpResult};

/// Mirrors `zion_core::v3_bridge::BRIDGE_MIN_VALIDATOR_PROOFS`.
pub const BRIDGE_MIN_VALIDATOR_PROOFS: usize = 3;

const RPC_TIMEOUT_SECS: u64 = 15;

/// Builds + submits `submitBridgeUnlock` requests against the L1 node.
pub struct L1Releaser {
    rpc_addr: String,
    keys: Vec<(String, SigningKey)>, // (validator_id, key)
}

impl L1Releaser {
    /// Create a releaser bound to `l1_rpc_addr` with the given keys.
    pub fn new(rpc_addr: String, keys: Vec<(String, SigningKey)>) -> Self {
        Self {
            rpc_addr,
            keys,
        }
    }

    /// Load release keys from `WARP_L1_RELEASE_KEYS` (comma-separated hex,
    /// optional `0x` prefix). Validator ids default to `warp-release-1..n`.
    ///
    /// Returns `Ok(None)` when the variable is unset/empty — the inbound
    /// releaser task treats that as "manual release mode" (transfers stay in
    /// `Detected` and a periodic warn is emitted).
    pub fn from_env(l1_rpc_addr: String) -> WarpResult<Option<Self>> {
        let raw = match std::env::var("WARP_L1_RELEASE_KEYS") {
            Ok(v) => v,
            Err(_) => return Ok(None),
        };
        let mut keys = Vec::new();
        for (i, part) in raw.split(',').enumerate() {
            let pk_hex = part.trim().trim_start_matches("0x");
            if pk_hex.is_empty() {
                continue;
            }
            let bytes = hex::decode(pk_hex).map_err(|e| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("WARP_L1_RELEASE_KEYS[{i}] invalid hex: {e}"),
            })?;
            let key = SigningKey::from_slice(&bytes).map_err(|e| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("WARP_L1_RELEASE_KEYS[{i}] invalid secp256k1 key: {e}"),
            })?;
            let id = std::env::var("WARP_L1_RELEASE_IDS")
                .ok()
                .and_then(|ids| {
                    ids.split(',')
                        .nth(i)
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                })
                .unwrap_or_else(|| format!("warp-release-{}", i + 1));
            keys.push((id, key));
        }
        if keys.is_empty() {
            return Ok(None);
        }
        Ok(Some(Self::new(l1_rpc_addr, keys)))
    }

    /// Number of local release keys (= max proofs this node can produce).
    pub fn key_count(&self) -> usize {
        self.keys.len()
    }

    /// Whether this node can produce the L1 consensus minimum of proofs.
    pub fn has_min_proofs(&self) -> bool {
        self.keys.len() >= BRIDGE_MIN_VALIDATOR_PROOFS
    }

    /// Compressed SEC1 public keys (lowercase hex) of the local keys —
    /// these are the strings that must appear in the L1 node's
    /// `ZION_BRIDGE_VALIDATOR_PUBKEYS` allowlist.
    pub fn public_keys(&self) -> Vec<String> {
        self.keys
            .iter()
            .map(|(_, k)| {
                hex::encode(VerifyingKey::from(k).to_encoded_point(true).as_bytes())
            })
            .collect()
    }

    /// Canonical operation message — byte-for-byte identical to
    /// `zion_core::v3_bridge::bridge_operation_message`.
    pub fn operation_message(
        recipient: &str,
        amount_flowers: u64,
        source_chain: &str,
        burn_id: &str,
        evm_tx_hash: &str,
    ) -> String {
        format!(
            "unlock|recipient={}|amount={}|chain={}|burn_id={}|evm_tx={}",
            recipient, amount_flowers, source_chain, burn_id, evm_tx_hash
        )
    }

    /// Sign the operation message with every local key → proof objects in
    /// the relay JSON shape (`validator_public_key`, `signature`, …).
    fn build_proofs(&self, operation_message: &str) -> Vec<Value> {
        let mut proofs = Vec::new();
        for (id, key) in &self.keys {
            let signature: Signature = key.sign(operation_message.as_bytes());
            let pubkey_hex = hex::encode(
                VerifyingKey::from(key)
                    .to_encoded_point(true)
                    .as_bytes(),
            );
            proofs.push(json!({
                "validator_id": id,
                "validator_address": Value::Null,
                "validator_public_key": pubkey_hex,
                "signature": hex::encode(signature.to_bytes()),
                "signature_scheme": "secp256k1-ecdsa",
                "operation_message": operation_message,
                "synthetic": false,
            }));
        }
        proofs
    }

    /// Submit a bridge unlock to the L1 node. Returns the accepted L1 tx_id.
    ///
    /// `burn_id` is the source-chain burn identifier (EVM `burnId` topic, or
    /// the source tx hash for chains without a dedicated id).
    pub async fn release(
        &self,
        recipient: &str,
        amount_flowers: u64,
        source_chain: &str,
        burn_id: &str,
        source_tx_hash: &str,
    ) -> WarpResult<String> {
        if self.keys.is_empty() {
            return Err(WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: "no WARP_L1_RELEASE_KEYS configured".into(),
            });
        }

        let operation_message = Self::operation_message(
            recipient,
            amount_flowers,
            source_chain,
            burn_id,
            source_tx_hash,
        );
        let proofs = self.build_proofs(&operation_message);

        let request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "submitBridgeUnlock",
            "params": {
                "recipient": recipient,
                "amount_flowers": amount_flowers,
                "burn_id": burn_id,
                "evm_chain": source_chain,
                "evm_tx_hash": source_tx_hash,
                "validator_proofs": proofs,
            }
        });

        let result = self.rpc_call("submitBridgeUnlock", request["params"].clone()).await?;

        // Node returns { accepted, tx_id, reason? } (TransactionResult).
        let accepted = result
            .get("accepted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !accepted {
            let reason = result
                .get("reason")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown rejection");
            return Err(WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("submitBridgeUnlock rejected: {reason}"),
            });
        }
        let tx_id = result
            .get("tx_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: "submitBridgeUnlock accepted but missing tx_id".into(),
            })?;
        Ok(tx_id.to_string())
    }

    /// Line-delimited JSON-RPC over TCP (same transport as the zion-l1
    /// adapter and the `zion-bridge-unlock` binary).
    async fn rpc_call(&self, method: &str, params: Value) -> WarpResult<Value> {
        let addr = Self::clean_addr(&self.rpc_addr);
        let request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        let work = async {
            let mut stream = TcpStream::connect(&addr).await.map_err(|e| {
                WarpError::AdapterError {
                    chain: "zion-l1".into(),
                    reason: format!("connect {addr}: {e}"),
                }
            })?;
            let payload = serde_json::to_string(&request).unwrap() + "\n";
            stream.write_all(payload.as_bytes()).await.map_err(|e| {
                WarpError::AdapterError {
                    chain: "zion-l1".into(),
                    reason: format!("write: {e}"),
                }
            })?;
            let (reader, _) = stream.split();
            let mut line = String::new();
            BufReader::new(reader)
                .read_line(&mut line)
                .await
                .map_err(|e| WarpError::AdapterError {
                    chain: "zion-l1".into(),
                    reason: format!("read: {e}"),
                })?;
            Ok::<_, WarpError>(line)
        };

        let line = tokio::time::timeout(Duration::from_secs(RPC_TIMEOUT_SECS), work)
            .await
            .map_err(|_| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("RPC timeout after {RPC_TIMEOUT_SECS}s"),
            })??;

        let resp: Value = serde_json::from_str(line.trim()).map_err(|e| {
            WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("response parse: {e}"),
            }
        })?;
        if let Some(err) = resp.get("error").filter(|e| !e.is_null()) {
            let msg = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown RPC error");
            return Err(WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("RPC error: {msg}"),
            });
        }
        resp.get("result").cloned().ok_or_else(|| WarpError::AdapterError {
            chain: "zion-l1".into(),
            reason: "RPC returned null result".into(),
        })
    }

    /// Strip `http(s)://` — the L1 RPC is raw TCP, not HTTP.
    fn clean_addr(url: &str) -> String {
        let s = url
            .trim_start_matches("http://")
            .trim_start_matches("https://")
            .trim_end_matches('/');
        s.split('/').next().unwrap_or(s).to_string()
    }
}

/// Local self-check: every key's signature must verify against its pubkey
/// before we ever hit the network. Used at startup to fail fast on key
/// mismatches.
pub fn self_check(releaser: &L1Releaser) -> WarpResult<()> {
    for (id, key) in &releaser.keys {
        let msg = b"warp-release-selfcheck";
        let sig: Signature = key.sign(msg);
        VerifyingKey::from(key)
            .verify(msg, &sig)
            .map_err(|e| WarpError::AdapterError {
                chain: "zion-l1".into(),
                reason: format!("release key {id} failed self-verify: {e}"),
            })?;
    }
    info!(
        "[l1-release] {} release key(s) self-verified (need {} for quorum)",
        releaser.keys.len(),
        BRIDGE_MIN_VALIDATOR_PROOFS
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key(byte: u8) -> SigningKey {
        SigningKey::from_slice(&[byte; 32]).unwrap()
    }

    fn make_releaser(n: u8) -> L1Releaser {
        let keys = (1..=n)
            .map(|i| (format!("validator-{i}"), test_key(i)))
            .collect();
        L1Releaser::new("127.0.0.1:9445".into(), keys)
    }

    #[test]
    fn operation_message_matches_l1_format() {
        // Must be byte-identical to v3_bridge::bridge_operation_message.
        let msg = L1Releaser::operation_message(
            "zion1abc",
            100_000_000,
            "base",
            "0xdeadbeef",
            "0xtxhash",
        );
        assert_eq!(
            msg,
            "unlock|recipient=zion1abc|amount=100000000|chain=base|burn_id=0xdeadbeef|evm_tx=0xtxhash"
        );
    }

    #[test]
    fn proofs_verify_and_normalize() {
        let r = make_releaser(3);
        let msg = L1Releaser::operation_message("zion1x", 1, "base", "b1", "t1");
        let proofs = r.build_proofs(&msg);
        assert_eq!(proofs.len(), 3);

        let mut seen = std::collections::HashSet::new();
        for p in &proofs {
            let pk_hex = p["validator_public_key"].as_str().unwrap();
            assert_eq!(pk_hex.len(), 66);
            assert!(!pk_hex.starts_with("0x"));
            assert!(seen.insert(pk_hex.to_string()));

            let vk = VerifyingKey::from_sec1_bytes(&hex::decode(pk_hex).unwrap()).unwrap();
            let sig_hex = p["signature"].as_str().unwrap();
            assert_eq!(sig_hex.len(), 128);
            let sig = Signature::from_slice(&hex::decode(sig_hex).unwrap()).unwrap();
            vk.verify(msg.as_bytes(), &sig).unwrap();
        }
    }

    #[test]
    fn min_proofs_gate() {
        assert!(!make_releaser(2).has_min_proofs());
        assert!(make_releaser(3).has_min_proofs());
        assert!(make_releaser(5).has_min_proofs());
    }

    #[test]
    fn clean_addr_strips_scheme() {
        assert_eq!(
            L1Releaser::clean_addr("http://127.0.0.1:9445/"),
            "127.0.0.1:9445"
        );
        assert_eq!(L1Releaser::clean_addr("127.0.0.1:9445"), "127.0.0.1:9445");
    }

    #[test]
    fn self_check_passes() {
        self_check(&make_releaser(2)).unwrap();
    }
}
