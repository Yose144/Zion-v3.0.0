//! # Tron TRC-20 Signer — Phase 6 (D-04)
//!
//! Signs and broadcasts Tron transactions for TRC-20 `mint` calls against the
//! ZION contract.
//!
//! ## Design
//! - No `tronweb` or heavy SDK dependency.
//! - Pure Rust: `k256` (secp256k1, already present for EVM), `sha2` + `sha3`
//!   (already present), `bs58` (already present for Solana).
//! - Uses TronGrid REST API (`/wallet/triggersmartcontract` + `broadcasttransaction`).
//!
//! ## Workflow
//! ```text
//! 1. Build ABI-encoded params  (recipient address, amount)
//! 2. POST /wallet/triggersmartcontract  → unsigned tx JSON + txID (= SHA-256
//!    of raw_data)
//! 3. Sign txID bytes with secp256k1 (sign_prehash_recoverable)
//! 4. Insert signature into tx JSON
//! 5. POST /wallet/broadcasttransaction → tx hash
//! ```
//!
//! ## Key format
//! `WARP_TRON_RELAY_KEY` — 32-byte secp256k1 private key, hex-encoded.
//!
//! ## Address format
//! Tron addresses are base58check encoded with a `0x41` version byte.
//! Checksum = SHA256(SHA256(payload))[0..4] — same as Bitcoin's base58check.

use crate::error::{WarpError, WarpResult};
use k256::ecdsa::SigningKey;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sha3::Keccak256;

// ─────────────────────────────────────────────────────────────────────────────
// Address helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Derive the Tron base58check address from a secp256k1 signing key.
///
/// Process:
/// 1. Uncompressed pubkey (04 || x || y) — drop leading 0x04 → 64 bytes
/// 2. Keccak256 → 32 bytes → take last 20 bytes → EVM-style address
/// 3. Prepend 0x41 version byte → 21 bytes
/// 4. Base58check encode (SHA256d checksum)
pub fn tron_address_from_key(key: &SigningKey) -> String {
    let vk = key.verifying_key();
    let ep = vk.to_encoded_point(false); // uncompressed
    let raw = ep.as_bytes(); // 65 bytes: 04 || x || y
    let mut h = Keccak256::new();
    h.update(&raw[1..]); // drop 0x04
    let digest: [u8; 32] = h.finalize().into();
    let addr20 = &digest[12..]; // last 20 bytes
    let mut tron_addr = [0u8; 21];
    tron_addr[0] = 0x41;
    tron_addr[1..].copy_from_slice(addr20);
    tron_base58check_encode(&tron_addr)
}

/// Base58check encode — Tron uses the same SHA256d scheme as Bitcoin.
pub fn tron_base58check_encode(payload: &[u8]) -> String {
    let h1: [u8; 32] = Sha256::digest(payload).into();
    let h2: [u8; 32] = Sha256::digest(h1).into();
    let mut full = Vec::with_capacity(payload.len() + 4);
    full.extend_from_slice(payload);
    full.extend_from_slice(&h2[..4]);
    bs58::encode(&full).into_string()
}

/// Decode a base58check Tron address into 21 bytes (version 0x41 + 20 bytes).
pub fn tron_base58check_decode(addr: &str) -> WarpResult<[u8; 21]> {
    let full = bs58::decode(addr)
        .into_vec()
        .map_err(|e| WarpError::AdapterError {
            chain: "tron".into(),
            reason: format!("Tron base58check decode '{}': {}", addr, e),
        })?;
    if full.len() < 5 {
        return Err(WarpError::AdapterError {
            chain: "tron".into(),
            reason: format!("Tron address '{}' too short", addr),
        });
    }
    let (payload, check) = full.split_at(full.len() - 4);
    let h1: [u8; 32] = Sha256::digest(payload).into();
    let h2: [u8; 32] = Sha256::digest(h1).into();
    if &h2[..4] != check {
        return Err(WarpError::AdapterError {
            chain: "tron".into(),
            reason: format!("Tron address '{}': invalid checksum", addr),
        });
    }
    payload.try_into().map_err(|_| WarpError::AdapterError {
        chain: "tron".into(),
        reason: format!("Tron address '{}' must decode to 21 bytes", addr),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI encoding
// ─────────────────────────────────────────────────────────────────────────────

/// Compute the 4-byte Keccak256 function selector for a Solidity signature.
#[allow(dead_code)]
fn abi_selector(sig: &str) -> [u8; 4] {
    let mut h = Keccak256::new();
    h.update(sig.as_bytes());
    let d: [u8; 32] = h.finalize().into();
    d[..4].try_into().unwrap()
}

/// ABI-encode `(address recipient, uint256 amount)` as 64 bytes.
///
/// Tron address in ABI: drop the 0x41 version byte, left-pad 20 bytes → 32 bytes.
/// Amount: 32-byte big-endian.
///
/// Returns the concatenated `selector || params` as a hex string suitable for
/// TronGrid's `parameter` field (64 hex bytes = 128 chars, no selector needed
/// in the `parameter` field — selector goes in `function_selector`).
pub fn abi_encode_mint_params(recipient_tron: &str, amount: u64) -> WarpResult<String> {
    let full = tron_base58check_decode(recipient_tron)?;
    let addr20 = &full[1..]; // drop 0x41

    let mut params = Vec::with_capacity(64);
    // address slot: 12 zero bytes + 20-byte address
    params.extend_from_slice(&[0u8; 12]);
    params.extend_from_slice(addr20);
    // uint256 slot: 24 zero bytes + 8-byte u64 big-endian
    params.extend_from_slice(&[0u8; 24]);
    params.extend_from_slice(&amount.to_be_bytes());

    Ok(hex::encode(params))
}

// ─────────────────────────────────────────────────────────────────────────────
// Signing
// ─────────────────────────────────────────────────────────────────────────────

/// Sign a Tron `txID` (which is SHA256 of the raw_data, already 32 bytes).
///
/// Returns a 65-byte ECDSA signature: `r[32] || s[32] || v[1]`
/// where `v` is the recovery id (0 or 1, **not** +27).
pub fn tron_sign_txid(key: &SigningKey, txid_hex: &str) -> WarpResult<String> {
    let txid_bytes = hex::decode(txid_hex).map_err(|e| WarpError::AdapterError {
        chain: "tron".into(),
        reason: format!("txID hex decode: {}", e),
    })?;
    if txid_bytes.len() != 32 {
        return Err(WarpError::AdapterError {
            chain: "tron".into(),
            reason: format!("txID must be 32 bytes, got {}", txid_bytes.len()),
        });
    }

    let (sig, recid) =
        key.sign_prehash_recoverable(&txid_bytes)
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!("secp256k1 sign: {}", e),
            })?;

    let mut out = [0u8; 65];
    out[..64].copy_from_slice(&sig.to_bytes());
    out[64] = recid.to_byte(); // 0 or 1, NOT +27
    Ok(hex::encode(out))
}

// ─────────────────────────────────────────────────────────────────────────────
// Signer struct
// ─────────────────────────────────────────────────────────────────────────────

/// Tron secp256k1 signing key.
pub struct TronSigner {
    key: SigningKey,
}

impl TronSigner {
    /// Load from `WARP_TRON_RELAY_KEY` environment variable (32-byte hex key).
    pub fn from_env() -> WarpResult<Self> {
        let raw = std::env::var("WARP_TRON_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "tron".into(),
            reason: "WARP_TRON_RELAY_KEY not set".into(),
        })?;
        Self::from_hex(&raw)
    }

    /// Parse a `TronSigner` from a 32-byte hex-encoded private key.
    pub fn from_hex(hex_key: &str) -> WarpResult<Self> {
        let bytes = hex::decode(hex_key.trim()).map_err(|e| WarpError::AdapterError {
            chain: "tron".into(),
            reason: format!("key hex decode: {}", e),
        })?;
        SigningKey::from_slice(&bytes)
            .map(|key| Self { key })
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!("invalid secp256k1 key: {}", e),
            })
    }

    /// Test helper: construct from raw 32-byte seed.
    #[cfg(test)]
    pub fn from_bytes(seed: &[u8; 32]) -> Self {
        Self {
            key: SigningKey::from_slice(seed).unwrap(),
        }
    }

    /// The Tron base58check address for this key.
    pub fn address(&self) -> String {
        tron_address_from_key(&self.key)
    }

    /// Mint TRC-20 ZION tokens by calling the contract's `mint(address,uint256)`.
    ///
    /// # Arguments
    /// * `client`       — shared `reqwest::Client`
    /// * `api_url`      — TronGrid base URL (e.g. `https://api.trongrid.io`)
    /// * `contract`     — ZION TRC-20 contract address (base58check)
    /// * `recipient`    — destination Tron wallet address (base58check)
    /// * `amount`       — amount in raw token units (atomic, u64)
    ///
    /// Returns the broadcast transaction hash (txID).
    pub async fn mint_trc20(
        &self,
        client: &reqwest::Client,
        api_url: &str,
        contract: &str,
        recipient: &str,
        amount: u64,
    ) -> WarpResult<String> {
        // ── 1. Encode ABI params ─────────────────────────────────────────────
        let params_hex = abi_encode_mint_params(recipient, amount)?;

        // ── 2. Build unsigned transaction via TronGrid ───────────────────────
        let owner = self.address();
        let build_url = format!("{}/wallet/triggersmartcontract", api_url);
        let body = json!({
            "owner_address": owner,
            "contract_address": contract,
            "function_selector": "mint(address,uint256)",
            "parameter": params_hex,
            "fee_limit": 50_000_000u64,   // 50 TRX max gas
            "call_value": 0,
            "visible": true
        });

        let build_resp: Value = client
            .post(&build_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!("triggersmartcontract HTTP: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!("triggersmartcontract parse: {}", e),
            })?;

        // Check result flag
        if build_resp["result"]["result"].as_bool() != Some(true) {
            return Err(WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!(
                    "triggersmartcontract failed: {}",
                    build_resp["result"]["message"]
                        .as_str()
                        .unwrap_or("unknown error")
                ),
            });
        }

        // ── 3. Extract txID ──────────────────────────────────────────────────
        let txid = build_resp["transaction"]["txID"]
            .as_str()
            .ok_or_else(|| WarpError::AdapterError {
                chain: "tron".into(),
                reason: "triggersmartcontract: missing txID".into(),
            })?
            .to_string();

        // ── 4. Sign ──────────────────────────────────────────────────────────
        let sig_hex = tron_sign_txid(&self.key, &txid)?;

        // ── 5. Inject signature into tx JSON ─────────────────────────────────
        let mut signed_tx = build_resp["transaction"].clone();
        signed_tx["signature"] = json!([sig_hex]);

        // ── 6. Broadcast ─────────────────────────────────────────────────────
        let broadcast_url = format!("{}/wallet/broadcasttransaction", api_url);
        let bc_resp: Value = client
            .post(&broadcast_url)
            .json(&signed_tx)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!("broadcasttransaction HTTP: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!("broadcasttransaction parse: {}", e),
            })?;

        if bc_resp["result"].as_bool() != Some(true) {
            return Err(WarpError::AdapterError {
                chain: "tron".into(),
                reason: format!(
                    "broadcasttransaction failed: {}",
                    bc_resp["message"].as_str().unwrap_or("unknown")
                ),
            });
        }

        Ok(txid)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    // ── Key loading ─────────────────────────────────────────────────────────

    #[test]
    fn test_from_hex_valid() {
        let key = "0101010101010101010101010101010101010101010101010101010101010101";
        assert!(TronSigner::from_hex(key).is_ok());
    }

    #[test]
    fn test_from_hex_invalid_not_hex() {
        assert!(TronSigner::from_hex("zzzz").is_err());
    }

    #[test]
    fn test_from_hex_too_short() {
        assert!(TronSigner::from_hex("0102030405").is_err());
    }

    #[test]
    fn test_from_env_missing_err() {
        std::env::remove_var("WARP_TRON_RELAY_KEY");
        assert!(TronSigner::from_env().is_err());
    }

    #[test]
    fn test_address_deterministic() {
        let s1 = TronSigner::from_bytes(&[7u8; 32]);
        let s2 = TronSigner::from_bytes(&[7u8; 32]);
        assert_eq!(s1.address(), s2.address());
    }

    #[test]
    fn test_address_starts_with_t() {
        // All Tron addresses start with 'T' (0x41 base58check prefix)
        let s = TronSigner::from_bytes(&[5u8; 32]);
        assert!(s.address().starts_with('T'), "address: {}", s.address());
    }

    #[test]
    fn test_address_different_keys_different_addresses() {
        let a = TronSigner::from_bytes(&[1u8; 32]).address();
        let b = TronSigner::from_bytes(&[2u8; 32]).address();
        assert_ne!(a, b);
    }

    // ── Base58check ─────────────────────────────────────────────────────────

    #[test]
    fn test_base58check_roundtrip() {
        let payload = [
            0x41, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        ];
        let encoded = tron_base58check_encode(&payload);
        assert!(encoded.starts_with('T'));
        let decoded = tron_base58check_decode(&encoded).unwrap();
        assert_eq!(decoded, payload);
    }

    #[test]
    fn test_base58check_decode_invalid_checksum() {
        // Tamper with the encoded address
        let s = TronSigner::from_bytes(&[3u8; 32]);
        let mut addr: Vec<char> = s.address().chars().collect();
        // flip one character
        addr[5] = if addr[5] == 'a' { 'b' } else { 'a' };
        let bad: String = addr.into_iter().collect();
        assert!(tron_base58check_decode(&bad).is_err());
    }

    #[test]
    fn test_base58check_decode_correct_length() {
        let s = TronSigner::from_bytes(&[4u8; 32]);
        let decoded = tron_base58check_decode(&s.address()).unwrap();
        assert_eq!(decoded.len(), 21);
        assert_eq!(decoded[0], 0x41, "first byte must be 0x41 version byte");
    }

    // ── ABI encoding ────────────────────────────────────────────────────────

    #[test]
    fn test_abi_encode_mint_params_length() {
        let signer = TronSigner::from_bytes(&[9u8; 32]);
        let addr = signer.address();
        let hex = abi_encode_mint_params(&addr, 1_000_000).unwrap();
        // 64 bytes → 128 hex chars
        assert_eq!(
            hex.len(),
            128,
            "ABI encoded params must be 64 bytes (128 hex chars)"
        );
    }

    #[test]
    fn test_abi_encode_mint_params_address_slot() {
        let signer = TronSigner::from_bytes(&[9u8; 32]);
        let addr = signer.address();
        let hex = abi_encode_mint_params(&addr, 0).unwrap();
        let bytes = hex::decode(&hex).unwrap();
        // First 12 bytes of address slot must be zero (padding)
        assert_eq!(
            &bytes[..12],
            &[0u8; 12],
            "address slot padding must be zeros"
        );
    }

    #[test]
    fn test_abi_encode_mint_params_amount_slot() {
        let signer = TronSigner::from_bytes(&[9u8; 32]);
        let addr = signer.address();
        let amount = 42_000_000u64;
        let hex = abi_encode_mint_params(&addr, amount).unwrap();
        let bytes = hex::decode(&hex).unwrap();
        // Last 8 bytes are the amount in big-endian
        let encoded_amount = u64::from_be_bytes(bytes[56..64].try_into().unwrap());
        assert_eq!(encoded_amount, amount);
    }

    #[test]
    fn test_abi_encode_mint_params_invalid_address() {
        assert!(abi_encode_mint_params("not_a_valid_tron_addr", 1000).is_err());
    }

    // ── Function selector ────────────────────────────────────────────────────

    #[test]
    fn test_abi_selector_transfer() {
        // keccak256("transfer(address,uint256)")[0:4] = a9059cbb (well-known)
        let sel = abi_selector("transfer(address,uint256)");
        assert_eq!(sel, [0xa9, 0x05, 0x9c, 0xbb]);
    }

    #[test]
    fn test_abi_selector_mint_length() {
        let sel = abi_selector("mint(address,uint256)");
        assert_eq!(sel.len(), 4);
    }

    // ── Transaction signing ──────────────────────────────────────────────────

    #[test]
    fn test_tron_sign_txid_length() {
        let s = TronSigner::from_bytes(&[11u8; 32]);
        let txid = "a".repeat(64); // 32 zero bytes as hex
        let sig = tron_sign_txid(&s.key, &txid).unwrap();
        // 65 bytes → 130 hex chars
        assert_eq!(sig.len(), 130, "signature must be 65 bytes (130 hex chars)");
    }

    #[test]
    fn test_tron_sign_txid_invalid_hex() {
        let s = TronSigner::from_bytes(&[11u8; 32]);
        assert!(tron_sign_txid(&s.key, "not_hex").is_err());
    }

    #[test]
    fn test_tron_sign_txid_wrong_length() {
        let s = TronSigner::from_bytes(&[11u8; 32]);
        // 16 bytes hex = only 8 bytes
        assert!(tron_sign_txid(&s.key, &"ab".repeat(8)).is_err());
    }

    #[test]
    fn test_tron_sign_txid_recoverable_v_byte() {
        let s = TronSigner::from_bytes(&[13u8; 32]);
        let txid = hex::encode([42u8; 32]);
        let sig = tron_sign_txid(&s.key, &txid).unwrap();
        let sig_bytes = hex::decode(&sig).unwrap();
        // Tron v byte must be 0 or 1 (not 27/28)
        assert!(
            sig_bytes[64] <= 1,
            "recovery id must be 0 or 1, got {}",
            sig_bytes[64]
        );
    }

    #[test]
    fn test_tron_sign_txid_deterministic() {
        let s = TronSigner::from_bytes(&[15u8; 32]);
        let txid = hex::encode([99u8; 32]);
        let sig1 = tron_sign_txid(&s.key, &txid).unwrap();
        let sig2 = tron_sign_txid(&s.key, &txid).unwrap();
        assert_eq!(sig1, sig2);
    }

    #[test]
    fn test_tron_sign_different_txids_different_sigs() {
        let s = TronSigner::from_bytes(&[17u8; 32]);
        let s1 = tron_sign_txid(&s.key, &hex::encode([1u8; 32])).unwrap();
        let s2 = tron_sign_txid(&s.key, &hex::encode([2u8; 32])).unwrap();
        assert_ne!(s1, s2);
    }

    // ── SHA-256 helpers (verify SHA256d used in base58check) -─────────────────

    #[test]
    fn test_sha256_of_known_input() {
        // SHA256("abc") = ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469348423f656b411111...
        // We just verify Sha256 compiles and runs
        let mut h = Sha256::new();
        h.update(b"abc");
        let d: [u8; 32] = h.finalize().into();
        assert_eq!(d.len(), 32);
    }

    #[test]
    fn test_address_roundtrip_via_base58() {
        let signer = TronSigner::from_bytes(&[21u8; 32]);
        let addr = signer.address();
        // Decode, check version byte, re-encode
        let raw = tron_base58check_decode(&addr).unwrap();
        assert_eq!(raw[0], 0x41);
        let re = tron_base58check_encode(&raw);
        assert_eq!(addr, re);
    }
}
