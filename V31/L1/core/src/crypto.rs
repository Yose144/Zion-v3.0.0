//! Cryptographic primitives for ZION V3/V31 compatibility.
//!
//! - **Ed25519** — key generation, signing, verification (`ed25519_dalek`)
//! - **BLAKE3**  — general-purpose hashing (tx hashes, merkle roots)
//! - **`zion1...`** — canonical address derivation with checksum
//!
//! PoW hashing uses Ekam Deeksha (cosmic_harmony), not this module.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::StdRng;
use rand::SeedableRng;
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};

// ── BLAKE3 general hash ────────────────────────────────────────────────

/// BLAKE3 hash of arbitrary data. Used for tx hashing, merkle roots, etc.
pub fn blake3_hash(data: &[u8]) -> [u8; 32] {
    *blake3::hash(data).as_bytes()
}

// ── Ed25519 ────────────────────────────────────────────────────────────

/// Generate a new Ed25519 keypair from OS random.
pub fn generate_keypair() -> (SigningKey, VerifyingKey) {
    let mut csprng = rand::rngs::OsRng;
    let signing = SigningKey::generate(&mut csprng);
    let verifying = signing.verifying_key();
    (signing, verifying)
}

/// Deterministic Ed25519 keypair from a domain-separated UTF-8 label.
pub fn keypair_from_canonical_label(label: &str) -> (SigningKey, VerifyingKey) {
    let seed = blake3_hash(label.as_bytes());
    let mut rng = StdRng::from_seed(seed);
    let signing_key = SigningKey::generate(&mut rng);
    let verifying_key = signing_key.verifying_key();
    (signing_key, verifying_key)
}

/// `zion1…` address for [`keypair_from_canonical_label`].
pub fn canonical_address_for_label(label: &str) -> String {
    let (_, vk) = keypair_from_canonical_label(label);
    derive_address(vk.as_bytes())
}

/// Sign `message` with an Ed25519 secret key. Returns 64-byte signature.
pub fn sign(signing_key: &SigningKey, message: &[u8]) -> [u8; 64] {
    signing_key.sign(message).to_bytes()
}

/// Verify an Ed25519 signature.
pub fn verify(public_key_bytes: &[u8], message: &[u8], signature_bytes: &[u8]) -> bool {
    let pk_array: [u8; 32] = match public_key_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => return false,
    };
    let public_key = match VerifyingKey::from_bytes(&pk_array) {
        Ok(pk) => pk,
        Err(_) => return false,
    };
    let sig_array: [u8; 64] = match signature_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => return false,
    };
    let signature = Signature::from_bytes(&sig_array);
    public_key.verify(message, &signature).is_ok()
}

// ── zion1 address derivation ───────────────────────────────────────────

/// Custom base32 alphabet (no `b`, `i`, `l`, `o`, `1` to avoid visual ambiguity)
const ZION_BASE32_ALPHABET: &[u8; 32] = b"023456789acdefghjklmnpqrstuvwxyz";

/// Compute 4-char checksum from `"zion1" + body[0..35]` via SHA-256.
fn compute_address_checksum(body_35: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"zion1");
    hasher.update(body_35.as_bytes());
    let hash = hasher.finalize();
    let mut ck = String::with_capacity(4);
    for &byte in &hash[..2] {
        ck.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        ck.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    ck
}

/// Derive `zion1...` address from raw 32-byte Ed25519 public key.
pub fn derive_address(public_key_bytes: &[u8]) -> String {
    let sha = Sha256::digest(public_key_bytes);
    let key_hash = Ripemd160::digest(sha);

    let mut data = String::with_capacity(40);
    for &byte in &key_hash[..] {
        data.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        data.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    data.truncate(35);

    let checksum = compute_address_checksum(&data);
    format!("zion1{data}{checksum}")
}

/// Derive address from hex-encoded public key.
pub fn derive_address_from_hex(pk_hex: &str) -> Option<String> {
    let pk_bytes = from_hex(pk_hex)?;
    Some(derive_address(&pk_bytes))
}

/// Validate a `zion1` address (format + checksum).
pub fn is_valid_address(address: &str) -> bool {
    if !address.starts_with("zion1") || address.len() != 44 {
        return false;
    }
    if !address
        .as_bytes()
        .iter()
        .skip(5)
        .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'z'))
    {
        return false;
    }
    let body = &address[5..40];
    let expected_ck = compute_address_checksum(body);
    let actual_ck = &address[40..44];
    expected_ck == actual_ck
}

// ── Keyless address derivation ─────────────────────────────────────────

/// Derive a deterministic keyless address from a well-known seed string.
pub fn derive_keyless_address(seed: &str) -> String {
    let synthetic_pubkey = Sha256::digest(seed.as_bytes());
    derive_address(&synthetic_pubkey)
}

/// The canonical seed string used to derive the ZION bridge vault address.
pub const BRIDGE_VAULT_SEED: &str = "ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET";

/// Derive the canonical bridge vault address.
pub fn bridge_vault_address() -> String {
    derive_keyless_address(BRIDGE_VAULT_SEED)
}

// ── hex helpers ────────────────────────────────────────────────────────

/// Encode bytes as lowercase hex string.
pub fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Decode hex string to bytes.
pub fn from_hex(s: &str) -> Option<Vec<u8>> {
    if !s.len().is_multiple_of(2) {
        return None;
    }
    let mut bytes = Vec::with_capacity(s.len() / 2);
    for i in (0..s.len()).step_by(2) {
        let pair = &s[i..i + 2];
        match u8::from_str_radix(pair, 16) {
            Ok(b) => bytes.push(b),
            Err(_) => return None,
        }
    }
    Some(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blake3_deterministic() {
        assert_eq!(blake3_hash(b"hello"), blake3_hash(b"hello"));
    }

    #[test]
    fn keypair_generate_sign_verify_roundtrip() {
        let (sk, vk) = generate_keypair();
        let sig = sign(&sk, b"test message");
        assert!(verify(vk.as_bytes(), b"test message", &sig));
    }

    #[test]
    fn bridge_vault_address_matches_constant() {
        assert_eq!(
            bridge_vault_address(),
            "zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7"
        );
    }

    #[test]
    fn burn_address_is_rejected_by_is_valid_address() {
        assert!(!is_valid_address(
            "zion1burn0000000000000000000000000000000dead"
        ));
    }
}
