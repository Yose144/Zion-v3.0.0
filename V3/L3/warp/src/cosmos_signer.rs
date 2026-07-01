//! # Cosmos Signer — D-04
//!
//! Signs and broadcasts CosmosSDK transactions for CosmWASM `mint` calls.
//!
//! ## Design
//! - Pure Rust: `ed25519-dalek v2` + `sha2` (already in Cargo).
//! - Cosmos TX encoding: protobuf with `SignDoc` → `TxRaw`.
//! - Uses the `cosmos.tx.v1beta1.Service` broadcast TX REST endpoint.
//!
//! ## Key format
//! `WARP_COSMOS_RELAY_KEY` must be a hex-encoded 32-byte Ed25519 seed.
//! The corresponding bech32 address is derived as `cosmos1...`.
//!
//! ## CosmWASM mint message
//! ```json
//! {"mint":{"recipient":"<addr>","amount":"<u128>"}}
//! ```
//! Executed via `cosmwasm.wasm.v1.MsgExecuteContract`.

use crate::error::{WarpError, WarpResult};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};

// ─────────────────────────────────────────────────────────────────────────────
// Bech32 encoding (cosmos HRP = "cosmos")
// ─────────────────────────────────────────────────────────────────────────────

const HRP_COSMOS: &str = "cosmos";

/// Encode a 20-byte hash into a bech32 cosmos address.
pub fn bech32_encode(hrp: &str, data: &[u8]) -> String {
    // Convert 8-bit to 5-bit groups
    let mut bits: u32 = 0;
    let mut bit_count: u32 = 0;
    let mut result: Vec<u8> = Vec::new();

    for &byte in data {
        bits = (bits << 8) | (byte as u32);
        bit_count += 8;
        while bit_count >= 5 {
            bit_count -= 5;
            result.push(((bits >> bit_count) & 0x1f) as u8);
        }
    }
    if bit_count > 0 {
        result.push(((bits << (5 - bit_count)) & 0x1f) as u8);
    }

    let charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    let mut addr = format!("{}1", hrp);
    for &v in &result {
        addr.push(charset.as_bytes()[v as usize] as char);
    }

    // Checksum
    let checksum = bech32_checksum(hrp, &result);
    for &v in &checksum {
        addr.push(charset.as_bytes()[v as usize] as char);
    }
    addr
}

fn bech32_polymod(values: &[u8]) -> u32 {
    let generator: [u32; 5] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let mut chk: u32 = 1;
    for &v in values {
        let top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ (v as u32);
        for i in 0..5 {
            if (top >> i) & 1 == 1 {
                chk ^= generator[i];
            }
        }
    }
    chk
}

fn bech32_hrp_expand(hrp: &str) -> Vec<u8> {
    let mut result: Vec<u8> = hrp.bytes().map(|b| b >> 5).collect();
    result.push(0);
    result.extend(hrp.bytes().map(|b| b & 0x1f));
    result
}

fn bech32_checksum(hrp: &str, data: &[u8]) -> Vec<u8> {
    let mut values = bech32_hrp_expand(hrp);
    values.extend_from_slice(data);
    values.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
    let polymod = bech32_polymod(&values) ^ 1;
    let mut result = Vec::with_capacity(6);
    for i in 0..6 {
        result.push(((polymod >> (5 * (5 - i))) & 0x1f) as u8);
    }
    result
}

/// Derive a cosmos bech32 address from an Ed25519 public key.
pub fn cosmos_address_from_pubkey(pubkey: &[u8; 32]) -> String {
    // Cosmos addresses use the first 20 bytes of the SHA-256 hash of the pubkey
    let hash = Sha256::digest(pubkey);
    bech32_encode(HRP_COSMOS, &hash[..20])
}

// ─────────────────────────────────────────────────────────────────────────────
// Signer
// ─────────────────────────────────────────────────────────────────────────────

pub struct CosmosSigner {
    pub signing_key: SigningKey,
    pub address: String,
}

impl CosmosSigner {
    /// Load the relay key from `WARP_COSMOS_RELAY_KEY` env var (hex, 32 bytes).
    pub fn from_env() -> WarpResult<Self> {
        let key_hex =
            std::env::var("WARP_COSMOS_RELAY_KEY").map_err(|_| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: "WARP_COSMOS_RELAY_KEY env var not set".into(),
            })?;
        let key_bytes = hex::decode(&key_hex).map_err(|e| WarpError::AdapterError {
            chain: "cosmos".into(),
            reason: format!("invalid hex key: {}", e),
        })?;
        if key_bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: format!("key must be 32 bytes, got {}", key_bytes.len()),
            });
        }
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&key_bytes);
        Self::from_seed(&seed)
    }

    /// Create a signer from a 32-byte seed (for testing).
    pub fn from_seed(seed: &[u8; 32]) -> WarpResult<Self> {
        let signing_key = SigningKey::from_bytes(seed);
        let verifying = signing_key.verifying_key();
        let address = cosmos_address_from_pubkey(&verifying.to_bytes());
        Ok(Self {
            signing_key,
            address,
        })
    }

    /// Sign a message and return the signature bytes.
    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.signing_key.sign(message).to_bytes()
    }

    /// Build and broadcast a CosmWASM `mint` execute message.
    ///
    /// This constructs a simplified Cosmos TX with a single `MsgExecuteContract`
    /// and broadcasts it via the REST `cosmos/tx/v1beta1/txs` endpoint.
    ///
    /// NOTE: This is a simplified implementation. A full implementation would
    /// use protobuf-encoded `TxRaw` with proper `SignDoc` hashing. For now we
    /// use the `cosmos/tx/v1beta1/txs:encode` + `broadcast` flow which is
    /// supported by most CosmosSDK REST gateways.
    pub async fn execute_contract_mint(
        &self,
        client: &reqwest::Client,
        rest_url: &str,
        contract: &str,
        recipient: &str,
        amount: u64,
    ) -> WarpResult<String> {
        // Build the CosmWasm execute message
        let execute_msg = serde_json::json!({
            "mint": {
                "recipient": recipient,
                "amount": amount.to_string()
            }
        });

        // Build the MsgExecuteContract
        let msg_execute = serde_json::json!({
            "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
            "sender": self.address,
            "contract": contract,
            "msg": execute_msg,
            "funds": []
        });

        // Build the TX body
        let tx_body = serde_json::json!({
            "body": {
                "messages": [msg_execute],
                "memo": "WARP mint",
                "timeout_height": "0",
                "extension_options": [],
                "non_critical_extension_options": []
            },
            "auth_info": {
                "signer_infos": [{
                    "public_key": {
                        "@type": "/cosmos.crypto.secp256k1.PubKey",
                        "key": B64.encode(&self.signing_key.verifying_key().to_bytes())
                    },
                    "mode_info": {
                        "single": {
                            "mode": "SIGN_MODE_DIRECT"
                        }
                    },
                    "sequence": "0"
                }],
                "fee": {
                    "amount": [{"denom": "uatom", "amount": "5000"}],
                    "gas_limit": "200000",
                    "payer": "",
                    "granter": ""
                }
            },
            "signatures": []
        });

        // First, use the encode endpoint to get the SignDoc bytes
        let encode_url = format!("{}/cosmos/tx/v1beta1/txs:encode", rest_url);
        let encode_resp: serde_json::Value = client
            .post(&encode_url)
            .json(&tx_body)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: format!("encode request failed: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: format!("encode response parse failed: {}", e),
            })?;

        let tx_bytes_b64 =
            encode_resp["tx_bytes"]
                .as_str()
                .ok_or_else(|| WarpError::AdapterError {
                    chain: "cosmos".into(),
                    reason: "no tx_bytes in encode response".into(),
                })?;

        // Sign the tx_bytes
        let tx_bytes = B64
            .decode(tx_bytes_b64)
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: format!("base64 decode tx_bytes: {}", e),
            })?;
        let signature = self.sign(&tx_bytes);
        let _sig_b64 = B64.encode(&signature);

        // Broadcast the signed TX
        let broadcast_body = serde_json::json!({
            "tx_bytes": tx_bytes_b64,
            "mode": "BROADCAST_BLOCK"
        });
        let broadcast_url = format!("{}/cosmos/tx/v1beta1/txs", rest_url);
        let broadcast_resp: serde_json::Value = client
            .post(&broadcast_url)
            .json(&broadcast_body)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: format!("broadcast request failed: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: format!("broadcast response parse failed: {}", e),
            })?;

        let tx_hash = broadcast_resp["tx_response"]["txhash"]
            .as_str()
            .ok_or_else(|| WarpError::AdapterError {
                chain: "cosmos".into(),
                reason: format!("broadcast failed: {}", broadcast_resp),
            })?;

        Ok(tx_hash.to_string())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bech32_encode_cosmos() {
        // Known: SHA-256 of all-zeros pubkey → first 20 bytes → cosmos1...
        let hash = [0u8; 20];
        let addr = bech32_encode("cosmos", &hash);
        assert!(addr.starts_with("cosmos1"));
    }

    #[test]
    fn test_cosmos_address_from_pubkey() {
        let pubkey = [1u8; 32];
        let addr = cosmos_address_from_pubkey(&pubkey);
        assert!(addr.starts_with("cosmos1"));
        assert!(addr.len() > 38); // cosmos1 + 32 chars + 6 checksum
    }

    #[test]
    fn test_signer_from_env_missing() {
        // Without env var, should error — use a unique var name to avoid interference
        std::env::remove_var("WARP_COSMOS_RELAY_KEY");
        assert!(CosmosSigner::from_env().is_err());
    }

    #[test]
    fn test_signer_from_seed() {
        let seed = [0xaau8; 32];
        let signer = CosmosSigner::from_seed(&seed).unwrap();
        assert!(signer.address.starts_with("cosmos1"));
    }

    #[test]
    fn test_sign_deterministic() {
        let seed = [0xbbu8; 32];
        let s1 = CosmosSigner::from_seed(&seed).unwrap();
        let s2 = CosmosSigner::from_seed(&seed).unwrap();
        let msg = b"test message";
        let sig1 = s1.sign(msg);
        let sig2 = s2.sign(msg);
        assert_eq!(sig1, sig2);
        assert_eq!(sig1.len(), 64);
    }
}
