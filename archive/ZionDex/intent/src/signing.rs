//! Intent signing and verification.
//!
//! Two signing schemes are supported:
//!
//! - **EVM (EIP-712)** for EVM-family chains (Base, Arbitrum, BSC, ...).
//!   The EIP-712 domain is `name="ZionDex", version="1", chainId=8453 (Base)`.
//! - **Ed25519** for Solana (and other ed25519-based chains).
//!
//! The signed payload is a canonical digest derived from the intent fields.

use crate::errors::{Error, Result};
use crate::types::SwapIntent;
use ed25519_dalek::{Signature as Ed25519Signature, Signer as EdSigner, SigningKey, Verifier, VerifyingKey};
use ethers::signers::LocalWallet;
use ethers::types::{Address, Signature as EthersSignature, U256};
use ethers::utils::keccak256;

/// EIP-712 domain name used for all ZionDex intents.
pub const EIP712_DOMAIN_NAME: &str = "ZionDex";
/// EIP-712 domain version.
pub const EIP712_DOMAIN_VERSION: &str = "1";
/// EIP-712 domain chain id (Base mainnet = 8453).
pub const EIP712_DOMAIN_CHAIN_ID: u64 = 8453;

/// EIP-712 primary type name.
const PRIMARY_TYPE: &str = "SwapIntent";

/// EIP-712 type string for the `SwapIntent` struct.
const SWAP_INTENT_TYPE_STRING: &str = "SwapIntent(uint256 nonce,address user,string fromChain,string toChain,string fromToken,string toToken,uint256 amountIn,uint256 minAmountOut,uint256 deadline)";

/// EIP-712 type hash for the `SwapIntent` struct.
fn swap_intent_type_hash() -> [u8; 32] {
    keccak256(SWAP_INTENT_TYPE_STRING.as_bytes())
}

/// Convert a U256 to a 32-byte big-endian array.
fn u256_to_be_bytes(value: U256) -> [u8; 32] {
    let mut out = [0u8; 32];
    value.to_big_endian(&mut out);
    out
}

/// Build the EIP-712 domain separator.
fn domain_separator() -> [u8; 32] {
    let type_hash = keccak256(b"EIP712Domain(string name,string version,uint256 chainId)");
    let mut buffer = Vec::with_capacity(32 * 4);
    buffer.extend_from_slice(&type_hash);
    buffer.extend_from_slice(&keccak256(EIP712_DOMAIN_NAME.as_bytes()));
    buffer.extend_from_slice(&keccak256(EIP712_DOMAIN_VERSION.as_bytes()));
    buffer.extend_from_slice(&u256_to_be_bytes(U256::from(EIP712_DOMAIN_CHAIN_ID)));
    keccak256(&buffer)
}

/// Hash a string field the EIP-712 way (keccak256 of the UTF-8 bytes).
fn hash_string(s: &str) -> [u8; 32] {
    keccak256(s.as_bytes())
}

/// Compute the EIP-712 struct hash for a swap intent.
pub fn intent_struct_hash(intent: &SwapIntent) -> [u8; 32] {
    let user_addr = parse_address(&intent.user).unwrap_or(Address::zero());

    let mut buffer = Vec::with_capacity(32 * 9);
    buffer.extend_from_slice(&swap_intent_type_hash());
    buffer.extend_from_slice(&u256_to_be_bytes(U256::from(intent.nonce)));
    buffer.extend_from_slice(user_addr.as_bytes());
    buffer.extend_from_slice(&hash_string(&intent.from_chain.to_string()));
    buffer.extend_from_slice(&hash_string(&intent.to_chain.to_string()));
    buffer.extend_from_slice(&hash_string(&intent.from_token));
    buffer.extend_from_slice(&hash_string(&intent.to_token));
    buffer.extend_from_slice(&u256_to_be_bytes(intent.amount_in));
    buffer.extend_from_slice(&u256_to_be_bytes(intent.min_amount_out));
    buffer.extend_from_slice(&u256_to_be_bytes(U256::from(intent.deadline)));
    keccak256(&buffer)
}

/// Compute the final EIP-712 digest that the user signs.
pub fn intent_eip712_digest(intent: &SwapIntent) -> [u8; 32] {
    let struct_hash = intent_struct_hash(intent);
    let domain = domain_separator();
    let mut digest_input = Vec::with_capacity(2 + 32 + 32);
    digest_input.extend_from_slice(&[0x19u8, 0x01u8]);
    digest_input.extend_from_slice(&domain);
    digest_input.extend_from_slice(&struct_hash);
    keccak256(&digest_input)
}

/// Parse a hex EVM address (with or without `0x` prefix).
fn parse_address(s: &str) -> Result<Address> {
    let s = s.trim_start_matches("0x");
    let bytes = hex::decode(s).map_err(|e| Error::BadSignature(format!("bad address: {e}")))?;
    if bytes.len() != 20 {
        return Err(Error::BadSignature(format!(
            "address must be 20 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 20];
    arr.copy_from_slice(&bytes);
    Ok(Address::from(arr))
}

/// Sign a swap intent using EIP-712 with an EVM private key.
///
/// `private_key` may be hex with or without a `0x` prefix.
pub fn sign_intent_evm(intent: &SwapIntent, private_key: &str) -> Result<Vec<u8>> {
    let wallet = parse_evm_wallet(private_key)?;
    let digest = intent_eip712_digest(intent);
    let sig = wallet
        .sign_hash(digest.into())
        .map_err(|e| Error::BadSignature(e.to_string()))?;
    let mut out = Vec::with_capacity(65);
    out.extend_from_slice(&u256_to_be_bytes(sig.r));
    out.extend_from_slice(&u256_to_be_bytes(sig.s));
    out.push(sig.v as u8);
    Ok(out)
}

/// Verify an EIP-712 signature over a swap intent.
///
/// Returns true iff the signature was produced by `expected_address`.
pub fn verify_intent_evm(intent: &SwapIntent, signature: &[u8], expected_address: &str) -> bool {
    if signature.len() != 65 {
        return false;
    }
    let expected = match parse_address(expected_address) {
        Ok(a) => a,
        Err(_) => return false,
    };
    let digest = intent_eip712_digest(intent);

    let mut r_bytes = [0u8; 32];
    r_bytes.copy_from_slice(&signature[0..32]);
    let mut s_bytes = [0u8; 32];
    s_bytes.copy_from_slice(&signature[32..64]);
    let v = signature[64];

    let r = U256::from_big_endian(&r_bytes);
    let s = U256::from_big_endian(&s_bytes);

    let sig = EthersSignature { r, s, v: v.into() };
    match sig.recover(digest) {
        Ok(recovered) => recovered == expected,
        Err(_) => false,
    }
}

fn parse_evm_wallet(private_key: &str) -> Result<LocalWallet> {
    let key = private_key.trim_start_matches("0x");
    let bytes = hex::decode(key).map_err(|e| Error::InvalidKey(format!("bad hex key: {e}")))?;
    if bytes.len() != 32 {
        return Err(Error::InvalidKey(format!(
            "private key must be 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    LocalWallet::from_bytes(&arr).map_err(|e| Error::InvalidKey(format!("invalid evm key: {e}")))
}

/// Build the canonical message bytes that Solana (Ed25519) signs.
///
/// We sign the EIP-712 digest prefixed with a domain tag so the two schemes
/// cannot be confused with each other.
pub fn solana_intent_message(intent: &SwapIntent) -> [u8; 32] {
    let digest = intent_eip712_digest(intent);
    let mut msg = Vec::with_capacity(16 + 32);
    msg.extend_from_slice(b"ZionDex-Solana\x00");
    msg.extend_from_slice(&digest);
    keccak256(&msg)
}

/// Sign a swap intent using Ed25519 (Solana-style).
///
/// `secret_key` is 64-byte hex (32-byte seed + 32-byte public key) or just the
/// 32-byte seed hex.
pub fn sign_intent_solana(intent: &SwapIntent, secret_key: &str) -> Result<Vec<u8>> {
    let signing_key = parse_ed25519_signing_key(secret_key)?;
    let message = solana_intent_message(intent);
    let signature = signing_key.sign(&message);
    Ok(signature.to_bytes().to_vec())
}

/// Verify an Ed25519 signature over a swap intent.
///
/// `public_key` is the 32-byte hex public key of the signer.
pub fn verify_intent_solana(
    intent: &SwapIntent,
    signature: &[u8],
    public_key: &str,
) -> bool {
    let verifying_key = match parse_ed25519_verifying_key(public_key) {
        Ok(k) => k,
        Err(_) => return false,
    };
    if signature.len() != 64 {
        return false;
    }
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(signature);
    let sig = Ed25519Signature::from(sig_bytes);
    let message = solana_intent_message(intent);
    verifying_key.verify(&message, &sig).is_ok()
}

fn parse_ed25519_signing_key(secret_key: &str) -> Result<SigningKey> {
    let key = secret_key.trim_start_matches("0x");
    let bytes = hex::decode(key).map_err(|e| Error::InvalidKey(format!("bad hex key: {e}")))?;
    let seed = if bytes.len() == 64 {
        &bytes[..32]
    } else if bytes.len() == 32 {
        &bytes[..]
    } else {
        return Err(Error::InvalidKey(format!(
            "ed25519 secret key must be 32 or 64 bytes, got {}",
            bytes.len()
        )));
    };
    let mut seed_arr = [0u8; 32];
    seed_arr.copy_from_slice(seed);
    Ok(SigningKey::from_bytes(&seed_arr))
}

fn parse_ed25519_verifying_key(public_key: &str) -> Result<VerifyingKey> {
    let key = public_key.trim_start_matches("0x");
    let bytes = hex::decode(key).map_err(|e| Error::InvalidKey(format!("bad hex pubkey: {e}")))?;
    if bytes.len() != 32 {
        return Err(Error::InvalidKey(format!(
            "ed25519 public key must be 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    VerifyingKey::from_bytes(&arr).map_err(|e| Error::InvalidKey(e.to_string()))
}

// Keep the primary type name reachable for downstream users/tests.
#[allow(dead_code)]
pub(crate) fn primary_type() -> &'static str {
    PRIMARY_TYPE
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ChainId;
    use ethers::signers::Signer;

    fn sample_intent(user: &str) -> SwapIntent {
        SwapIntent::new(
            user,
            ChainId::Base,
            ChainId::Solana,
            "USDC",
            "wSOL",
            U256::from(1_000_000u64),
            U256::from(5_000_000u64),
            9_999_999_999,
            1,
        )
    }

    #[test]
    fn eip712_digest_is_deterministic() {
        let a = sample_intent("0x1111111111111111111111111111111111111111");
        let b = sample_intent("0x1111111111111111111111111111111111111111");
        assert_eq!(intent_eip712_digest(&a), intent_eip712_digest(&b));
    }

    #[test]
    fn sign_and_verify_evm_roundtrip() {
        // Deterministic test private key (do NOT use on mainnet).
        let sk = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let wallet = parse_evm_wallet(sk).unwrap();
        let user = format!("{:?}", wallet.address());
        let mut intent = sample_intent(&user);
        let sig = sign_intent_evm(&intent, sk).unwrap();
        intent.signature = sig.clone();
        assert!(verify_intent_evm(&intent, &sig, &user));
        // Wrong address must fail.
        assert!(!verify_intent_evm(
            &intent,
            &sig,
            "0x2222222222222222222222222222222222222222"
        ));
    }

    #[test]
    fn sign_and_verify_solana_roundtrip() {
        let mut seed = [0u8; 32];
        // A 32-byte hex seed (zeros are not accepted; use a non-zero pattern).
        let seed_hex = "9d61b19de0105f3c1c4d6b1a8e7b8b9b8b9b8b9b8b9b8b9b8b9b8b9b8b9b8b9b";
        hex::decode_to_slice(seed_hex, &mut seed).unwrap();
        let sk = SigningKey::from_bytes(&seed);
        let pk = hex::encode(sk.verifying_key().to_bytes());
        let sk_hex = hex::encode(seed);
        let intent = sample_intent(&pk);
        let sig = sign_intent_solana(&intent, &sk_hex).unwrap();
        assert!(verify_intent_solana(&intent, &sig, &pk));
        // Wrong pubkey must fail.
        assert!(!verify_intent_solana(&intent, &sig, &hex::encode([1u8; 32])));
    }
}
