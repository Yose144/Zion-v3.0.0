//! # Cardano Signer — D-04
//!
//! Signs and submits Cardano transactions for wZION native token minting.
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

use crate::error::{WarpError, WarpResult};
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};

// ─────────────────────────────────────────────────────────────────────────────
// Cardano address derivation (simplified)
// ─────────────────────────────────────────────────────────────────────────────

/// Derive a Cardano payment key hash from an Ed25519 public key.
/// Cardano uses Blake2b-224 for payment key hashes, but we approximate with
/// SHA-256 truncated to 28 bytes for this simplified implementation.
pub fn payment_key_hash(pubkey: &[u8; 32]) -> [u8; 28] {
    let hash = Sha256::digest(pubkey);
    let mut pkh = [0u8; 28];
    pkh.copy_from_slice(&hash[..28]);
    pkh
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

    /// Derive the policy ID (hash of the policy script).
    pub fn policy_id(&self) -> String {
        // Policy ID = Blake2b-224 hash of the policy script
        // Simplified: use SHA-256 truncated to 28 bytes
        let policy_script = self.policy_key.verifying_key().to_bytes();
        let hash = Sha256::digest(&policy_script);
        hex::encode(&hash[..28])
    }

    /// Submit a signed TX via Blockfrost REST API.
    ///
    /// This builds a minimal Cardano TX that:
    /// 1. Mints `amount` of the wZION native token (policy_id + asset_name)
    /// 2. Sends the minted tokens to the recipient address
    /// 3. Includes metadata label 674 with WARP transfer info
    ///
    /// NOTE: This is a simplified implementation. A full implementation would
    /// use CBOR-encoded TX bodies per CIP-0025. For production, use
    /// `cardano-serialization-lib` or `pallas` crate.
    pub async fn submit_mint_tx(
        &self,
        _client: &reqwest::Client,
        _api_url: &str,
        recipient: &str,
        asset_name_hex: &str,
        amount: u64,
    ) -> WarpResult<String> {
        // Build the TX CBOR (simplified — in production use pallas/CSL)
        // For now, we log the intent and return an error indicating
        // that a full CBOR TX builder is needed.
        //
        // The actual flow would be:
        // 1. Query UTXOs at our address via Blockfrost
        // 2. Build TX body with mint + output to recipient
        // 3. Compute TX hash (Blake2b-256)
        // 4. Sign with payment key
        // 5. Build witness set (payment sig + policy sig)
        // 6. CBOR-encode the final TX
        // 7. Submit via POST /tx/submit

        let policy_id = self.policy_id();
        tracing::info!(
            "[WARP][cardano] Would mint {} of asset {} (policy {}) to {}",
            amount,
            asset_name_hex,
            policy_id,
            recipient
        );

        // Attempt Blockfrost TX submission
        // POST {api_url}/tx/submit with Content-Type: application/cbor
        // Body: CBOR-encoded signed TX

        // For now, return an error indicating the CBOR builder is needed
        Err(WarpError::AdapterError {
            chain: "cardano".into(),
            reason: format!(
                "Cardano TX CBOR builder not yet implemented — \
                 would mint {} of policy:{}:{} to {} via Blockfrost. \
                 Need pallas or cardano-serialization-lib for full CBOR TX construction.",
                amount, policy_id, asset_name_hex, recipient
            ),
        })
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
