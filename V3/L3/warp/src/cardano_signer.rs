//! # Cardano Signer — D-04
//!
//! Signs and submits Cardano transactions for ZION native token minting.
//!
//! ## Design
//! - Uses Blockfrost REST API for TX submission (no local cardano-cli needed).
//! - Ed25519 signing for Cardano payment keys (same curve as Cosmos/Solana).
//! - Builds a minimal Conway-era TX with a minted native asset + metadata.
//!
//! ## Key format
//! `WARP_CARDANO_PAYMENT_KEY` must be a hex-encoded 32-byte Ed25519 payment key seed.
//! The corresponding Cardano address is derived as `addr1...` (bech32 with HRP "addr").
//!
//! ## Native token mint
//! Cardano native tokens are minted by including a `mint` field in the TX body
//! with the policy ID + asset name. The policy must be signed by the policy key.
//!
//! NOTE: This is a simplified implementation. A full Cardano TX builder would
//! use CIP-0025 or CIP-0026 with proper CBOR encoding. For production, consider
//! using the `cardano-serialization-lib` or `pallas` crate. This implementation
//! provides the signing infrastructure and Blockfrost submission path.

use crate::cbor;
use crate::error::{WarpError, WarpResult};
use blake2::digest::consts::{U28, U32};
use blake2::{Blake2b, Digest};
use ed25519_dalek::{Signer, SigningKey};

/// Blake2b-224 (for Cardano payment key hashes + policy IDs)
type Blake2b224 = Blake2b<U28>;
/// Blake2b-256 (for Cardano TX body hashes)
type Blake2b256 = Blake2b<U32>;

// ─────────────────────────────────────────────────────────────────────────────
// Cardano address derivation (simplified)
// ─────────────────────────────────────────────────────────────────────────────

/// Derive a Cardano payment key hash from an Ed25519 public key.
/// Cardano uses Blake2b-224 for payment key hashes.
pub fn payment_key_hash(pubkey: &[u8; 32]) -> [u8; 28] {
    let hash = Blake2b224::digest(pubkey);
    hash.into()
}

/// Build a Cardano enterprise address (payment-only, no stake key).
/// Format: header byte (0x60 for mainnet enterprise) + 28-byte payment key hash.
/// This is then bech32-encoded with HRP "addr".
pub fn enterprise_address(pubkey: &[u8; 32]) -> String {
    let pkh = payment_key_hash(pubkey);
    let mut addr_bytes = vec![0x60]; // mainnet enterprise address header
    addr_bytes.extend_from_slice(&pkh);
    bech32_encode_addr("addr", &addr_bytes)
}

/// Bech32 encode with Cardano's variant (uses different charset than cosmos).
fn bech32_encode_addr(hrp: &str, data: &[u8]) -> String {
    // Cardano uses bech32 (BIP-173) — same as cosmos
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

/// Decode a bech32 address string back to raw bytes (strips HRP + checksum).
fn decode_bech32_address(addr: &str) -> Result<Vec<u8>, String> {
    let charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    // Find the last '1' separator
    let pos = addr.rfind('1').ok_or("no separator in bech32")?;
    if pos == 0 {
        return Err("empty HRP in bech32".into());
    }
    let _hrp = &addr[..pos];
    let data = &addr[pos + 1..];

    // Convert characters to 5-bit values
    let mut values: Vec<u8> = Vec::new();
    for c in data.chars() {
        let idx = charset.find(c).ok_or_else(|| format!("invalid char '{}' in bech32", c))?;
        values.push(idx as u8);
    }

    // Strip 6-byte checksum
    if values.len() < 6 {
        return Err("bech32 data too short".into());
    }
    let data_values = &values[..values.len() - 6];

    // Convert 5-bit groups back to 8-bit bytes
    let mut bits: u32 = 0;
    let mut bit_count: u32 = 0;
    let mut result: Vec<u8> = Vec::new();
    for &v in data_values {
        bits = (bits << 5) | (v as u32);
        bit_count += 5;
        while bit_count >= 8 {
            bit_count -= 8;
            result.push(((bits >> bit_count) & 0xff) as u8);
        }
    }
    // Ignore remaining bits (padding)
    Ok(result)
}

fn bech32_polymod(values: &[u8]) -> u32 {
    let generator: [u32; 5] =
        [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
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

// ─────────────────────────────────────────────────────────────────────────────
// Signer
// ─────────────────────────────────────────────────────────────────────────────

pub struct CardanoSigner {
    pub signing_key: SigningKey,
    pub address: String,
    pub policy_key: SigningKey,
}

impl CardanoSigner {
    /// Load the relay payment key from `WARP_CARDANO_PAYMENT_KEY` (hex, 32 bytes).
    /// The policy key is loaded from `WARP_CARDANO_POLICY_KEY` (hex, 32 bytes).
    pub fn from_env() -> WarpResult<Self> {
        let payment_hex = std::env::var("WARP_CARDANO_PAYMENT_KEY").map_err(|_| {
            WarpError::AdapterError {
                chain: "cardano".into(),
                reason: "WARP_CARDANO_PAYMENT_KEY env var not set".into(),
            }
        })?;
        let policy_hex = std::env::var("WARP_CARDANO_POLICY_KEY").map_err(|_| {
            WarpError::AdapterError {
                chain: "cardano".into(),
                reason: "WARP_CARDANO_POLICY_KEY env var not set".into(),
            }
        })?;

        let payment_bytes = hex::decode(&payment_hex).map_err(|e| WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!("invalid payment key hex: {}", e),
        })?;
        let policy_bytes = hex::decode(&policy_hex).map_err(|e| WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!("invalid policy key hex: {}", e),
        })?;

        if payment_bytes.len() != 32 || policy_bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!(
                    "keys must be 32 bytes each (payment: {}, policy: {})",
                    payment_bytes.len(),
                    policy_bytes.len()
                ),
            });
        }

        let mut payment_seed = [0u8; 32];
        payment_seed.copy_from_slice(&payment_bytes);
        let mut policy_seed = [0u8; 32];
        policy_seed.copy_from_slice(&policy_bytes);

        Self::from_seeds(&payment_seed, &policy_seed)
    }

    /// Create a signer from seed bytes (for testing).
    pub fn from_seeds(payment_seed: &[u8; 32], policy_seed: &[u8; 32]) -> WarpResult<Self> {
        let signing_key = SigningKey::from_bytes(payment_seed);
        let policy_key = SigningKey::from_bytes(policy_seed);
        let address = enterprise_address(&signing_key.verifying_key().to_bytes());
        Ok(Self {
            signing_key,
            address,
            policy_key,
        })
    }

    /// Sign a TX hash with the payment key.
    pub fn sign_tx(&self, tx_hash: &[u8]) -> [u8; 64] {
        self.signing_key.sign(tx_hash).to_bytes()
    }

    /// Sign a policy script with the policy key.
    pub fn sign_policy(&self, data: &[u8]) -> [u8; 64] {
        self.policy_key.sign(data).to_bytes()
    }

    /// Derive the policy ID (Blake2b-224 hash of the policy script).
    pub fn policy_id(&self) -> String {
        let policy_script = self.policy_key.verifying_key().to_bytes();
        let hash = Blake2b224::digest(&policy_script);
        hex::encode(hash)
    }

    /// Derive the policy ID as raw 28 bytes (for CBOR encoding).
    pub fn policy_id_bytes(&self) -> [u8; 28] {
        let policy_script = self.policy_key.verifying_key().to_bytes();
        Blake2b224::digest(&policy_script).into()
    }

    /// Submit a signed TX via Blockfrost REST API.
    ///
    /// This builds a Cardano TX that:
    /// 1. Mints `amount` of the ZION native token (policy_id + asset_name)
    /// 2. Sends the minted tokens to the recipient address
    /// 3. Pays the fee from the relay's UTXO
    ///
    /// Flow:
    /// 1. Query UTXOs at our address via Blockfrost
    /// 2. Build TX body with mint + output to recipient (CBOR)
    /// 3. Compute TX body hash (Blake2b-256)
    /// 4. Sign with payment key
    /// 5. Build witness set (payment vkey + sig)
    /// 6. CBOR-encode the final TX
    /// 7. Submit via POST /tx/submit
    pub async fn submit_mint_tx(
        &self,
        client: &reqwest::Client,
        api_url: &str,
        recipient: &str,
        asset_name_hex: &str,
        amount: u64,
    ) -> WarpResult<String> {
        let policy_id = self.policy_id();
        let policy_id_bytes = self.policy_id_bytes();
        let asset_name = hex::decode(asset_name_hex).map_err(|e| WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!("invalid asset_name hex: {}", e),
        })?;

        tracing::info!(
            "[WARP][cardano] Minting {} of policy:{}:{} to {}",
            amount, policy_id, asset_name_hex, recipient
        );

        // 1. Query UTXOs at our address via Blockfrost
        // GET /addresses/{address}/utxos?limit=1
        let utxo_url = format!("{}/addresses/{}/utxos?limit=1", api_url, self.address);
        let utxo_resp = client
            .get(&utxo_url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!("UTXO query failed: {}", e),
            })?;

        if !utxo_resp.status().is_success() {
            let status = utxo_resp.status();
            let body = utxo_resp.text().await.unwrap_or_default();
            return Err(WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!("UTXO query HTTP {}: {}", status, body),
            });
        }

        let utxos: serde_json::Value = utxo_resp.json().await.map_err(|e| WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!("UTXO parse: {}", e),
        })?;

        // Extract first UTXO: tx_hash + tx_index + amount (lovelace)
        let first_utxo = utxos.as_array().and_then(|a| a.first()).ok_or_else(|| {
            WarpError::AdapterError {
                chain: "cardano".into(),
                reason: "no UTXOs available at relay address — fund the relay first".into(),
            }
        })?;

        let utxo_tx_hash_hex = first_utxo
            .get("tx_hash")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let utxo_index = first_utxo
            .get("output_index")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let utxo_lovelace = first_utxo
            .get("amount")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|v| v.get("quantity"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        // Parse UTXO tx_hash into 32 bytes
        let utxo_tx_hash = hex::decode(utxo_tx_hash_hex).map_err(|e| WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!("invalid UTXO tx_hash hex: {}", e),
        })?;
        if utxo_tx_hash.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!("UTXO tx_hash must be 32 bytes, got {}", utxo_tx_hash.len()),
            });
        }
        let mut utxo_tx_hash_arr = [0u8; 32];
        utxo_tx_hash_arr.copy_from_slice(&utxo_tx_hash);

        // 2. Build TX body CBOR
        let fee = 170_000u64; // estimated fee
        let ttl = chrono::Utc::now().timestamp() as u64 + 3600; // 1 hour TTL
        let change = utxo_lovelace.saturating_sub(fee);

        // Build inputs array (1 input)
        let input_cbor = cbor::cardano_tx_input(&utxo_tx_hash_arr, utxo_index as u32);
        let inputs_arr = {
            let mut e = cbor::CborEncoder::new();
            e.array_mut(1);
            e.raw_mut(&input_cbor);
            e.finish()
        };

        // Build outputs array (2 outputs: recipient + change)
        // Decode recipient address from bech32 to bytes
        let recipient_addr_bytes = decode_bech32_address(recipient)
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!("invalid recipient address: {}", e),
            })?;

        let output1 = cbor::cardano_tx_output_multiasset(
            &recipient_addr_bytes,
            1_000_000, // minimum lovelace for multi-asset output
            &policy_id_bytes,
            &asset_name,
            amount,
        );
        let change_addr_bytes = decode_bech32_address(&self.address)
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!("invalid change address: {}", e),
            })?;
        let output2 = cbor::cardano_tx_output_simple(&change_addr_bytes, change);

        let outputs_arr = {
            let mut e = cbor::CborEncoder::new();
            e.array_mut(2);
            e.raw_mut(&output1);
            e.raw_mut(&output2);
            e.finish()
        };

        let body_cbor = cbor::cardano_tx_body(
            &inputs_arr,
            &outputs_arr,
            fee,
            ttl,
            &policy_id_bytes,
            &asset_name,
            amount,
        );

        // 3. Compute TX body hash (Blake2b-256)
        let body_hash = Blake2b256::digest(&body_cbor);

        // 4. Sign with payment key
        let payment_sig = self.sign_tx(&body_hash);

        // 5. Build witness set (payment vkey + sig)
        let payment_vkey = self.signing_key.verifying_key().to_bytes();
        let witness_cbor = cbor::cardano_witness_set(&payment_vkey, &payment_sig);

        // 6. CBOR-encode the final TX
        let tx_cbor = cbor::cardano_transaction(&body_cbor, &witness_cbor);

        // 7. Submit via POST /tx/submit
        let submit_url = format!("{}/tx/submit", api_url);
        let resp = client
            .post(&submit_url)
            .header("Content-Type", "application/cbor")
            .body(tx_cbor)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!("TX submit request failed: {}", e),
            })?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if status.is_success() {
            // Blockfrost returns the TX hash as a JSON string
            let tx_hash = body.trim_matches('"').to_string();
            tracing::info!("[WARP][cardano] TX submitted: {}", tx_hash);
            Ok(tx_hash)
        } else {
            Err(WarpError::AdapterError {
                chain: "cardano".into(),
                reason: format!("TX submit HTTP {}: {}", status, body),
            })
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enterprise_address_format() {
        let pubkey = [1u8; 32];
        let addr = enterprise_address(&pubkey);
        assert!(addr.starts_with("addr1"));
    }

    #[test]
    fn test_payment_key_hash_length() {
        let pubkey = [2u8; 32];
        let pkh = payment_key_hash(&pubkey);
        assert_eq!(pkh.len(), 28);
    }

    #[test]
    fn test_signer_from_env_missing() {
        std::env::remove_var("WARP_CARDANO_PAYMENT_KEY");
        std::env::remove_var("WARP_CARDANO_POLICY_KEY");
        assert!(CardanoSigner::from_env().is_err());
    }

    #[test]
    fn test_signer_from_seeds() {
        let seed = [0xccu8; 32];
        let signer = CardanoSigner::from_seeds(&seed, &seed).unwrap();
        assert!(signer.address.starts_with("addr1"));
    }

    #[test]
    fn test_policy_id_hex_length() {
        let seed = [0xddu8; 32];
        let signer = CardanoSigner::from_seeds(&seed, &seed).unwrap();
        let pid = signer.policy_id();
        assert_eq!(pid.len(), 56); // 28 bytes hex = 56 chars
    }

    #[test]
    fn test_sign_tx_deterministic() {
        let seed = [0xeeu8; 32];
        let s1 = CardanoSigner::from_seeds(&seed, &seed).unwrap();
        let s2 = CardanoSigner::from_seeds(&seed, &seed).unwrap();
        let msg = b"test tx hash";
        let sig1 = s1.sign_tx(msg);
        let sig2 = s2.sign_tx(msg);
        assert_eq!(sig1, sig2);
        assert_eq!(sig1.len(), 64);
    }
}
