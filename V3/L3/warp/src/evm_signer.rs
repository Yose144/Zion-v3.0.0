/// EVM Transaction Signing — EIP-155 Legacy Transactions
///
/// Implements SECP256k1 signing + RLP encoding for Ethereum-compatible chains.
/// No external ethers-rs dependency — uses k256 + sha3 + rlp directly.
///
/// Flow:
///   1. Build TX fields (nonce, gasPrice, gasLimit, to, value, data)
///   2. RLP-encode pre-sign tuple + chainId (EIP-155)
///   3. Keccak256 hash the encoded bytes
///   4. Sign with k256 ECDSA (secp256k1)
///   5. RLP-encode final TX with (v, r, s)
///   6. Broadcast via eth_sendRawTransaction
use hex;
use k256::ecdsa::{signature::hazmat::PrehashSigner, RecoveryId, SigningKey};
use rlp::RlpStream;
use sha3::{Digest, Keccak256};

use crate::error::{WarpError, WarpResult};

// ─────────────────────────────────────────────────────────────────────────────
// Nonce / gasPrice helpers (raw JSON-RPC)
// ─────────────────────────────────────────────────────────────────────────────

pub async fn eth_nonce(client: &reqwest::Client, rpc_url: &str, address: &str) -> WarpResult<u64> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getTransactionCount",
        "params": [address, "pending"],
        "id": 1
    });
    let resp: serde_json::Value = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: e.to_string(),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: e.to_string(),
        })?;
    let hex = resp["result"].as_str().unwrap_or("0x0");
    Ok(hex_to_u64(hex))
}

pub async fn eth_gas_price(client: &reqwest::Client, rpc_url: &str) -> WarpResult<u64> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_gasPrice",
        "params": [],
        "id": 1
    });
    let resp: serde_json::Value = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: e.to_string(),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: e.to_string(),
        })?;
    let hex = resp["result"].as_str().unwrap_or("0x1");
    Ok(hex_to_u64(hex))
}

pub async fn eth_send_raw_tx(
    client: &reqwest::Client,
    rpc_url: &str,
    raw_hex: &str,
) -> WarpResult<String> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_sendRawTransaction",
        "params": [format!("0x{}", raw_hex)],
        "id": 1
    });
    let resp: serde_json::Value = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: e.to_string(),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: e.to_string(),
        })?;

    if let Some(err) = resp.get("error") {
        return Err(WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("eth_sendRawTransaction error: {}", err),
        });
    }

    let tx_hash = resp["result"].as_str().unwrap_or("").to_string();

    if tx_hash.is_empty() {
        return Err(WarpError::AdapterError {
            chain: "evm".into(),
            reason: "eth_sendRawTransaction returned empty tx hash".into(),
        });
    }

    Ok(tx_hash)
}

// ─────────────────────────────────────────────────────────────────────────────
// EVM Signer
// ─────────────────────────────────────────────────────────────────────────────

/// Builds, signs, and broadcasts an EIP-155 legacy EVM transaction.
pub struct EvmSigner {
    signing_key: SigningKey,
    pub address: String,
}

impl EvmSigner {
    /// Load from a hex private key (with or without 0x prefix).
    /// Reads `WARP_EVM_RELAY_KEY` env var.
    pub fn from_env() -> WarpResult<Self> {
        let raw = std::env::var("WARP_EVM_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "evm".into(),
            reason: "WARP_EVM_RELAY_KEY not set — EVM signing disabled".into(),
        })?;
        Self::from_hex(&raw)
    }

    pub fn from_hex(private_key_hex: &str) -> WarpResult<Self> {
        let hex_str = private_key_hex.trim_start_matches("0x").trim();
        let bytes = hex::decode(hex_str).map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("Invalid private key hex: {}", e),
        })?;
        let signing_key = SigningKey::from_slice(&bytes).map_err(|e| WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("Invalid secp256k1 key: {}", e),
        })?;
        let address = public_key_to_address(signing_key.verifying_key());
        Ok(Self {
            signing_key,
            address,
        })
    }

    /// Sign and broadcast a call to `to` with `calldata`.
    /// `value` is ETH in wei (0 for contract calls).
    #[allow(clippy::too_many_arguments)]
    pub async fn send_tx(
        &self,
        client: &reqwest::Client,
        rpc_url: &str,
        chain_id: u64,
        to: &str,
        calldata: &[u8],
        value: u64,
        gas_limit: u64,
    ) -> WarpResult<String> {
        // 1. Fetch nonce + gas price
        let nonce = eth_nonce(client, rpc_url, &self.address).await?;
        let gas_price = eth_gas_price(client, rpc_url).await?;
        // Add 20% tip to avoid stuck TXs
        let gas_price = gas_price + gas_price / 5;

        // 2. Build and sign
        let raw =
            self.sign_legacy_tx(chain_id, nonce, gas_price, gas_limit, to, value, calldata)?;
        let raw_hex = hex::encode(&raw);

        // 3. Broadcast
        eth_send_raw_tx(client, rpc_url, &raw_hex).await
    }

    /// Produce raw signed transaction bytes (EIP-155 legacy).
    #[allow(clippy::too_many_arguments)]
    fn sign_legacy_tx(
        &self,
        chain_id: u64,
        nonce: u64,
        gas_price: u64,
        gas_limit: u64,
        to: &str,   // hex address "0x..."
        value: u64, // wei
        data: &[u8],
    ) -> WarpResult<Vec<u8>> {
        let to_bytes = decode_address(to)?;

        // ── Pre-sign RLP (includes chainId, 0, 0 per EIP-155) ──
        let pre_sign = encode_legacy_pre_sign(
            nonce, gas_price, gas_limit, &to_bytes, value, data, chain_id,
        );

        // ── Keccak256 hash ──
        let hash: [u8; 32] = Keccak256::digest(&pre_sign).into();

        // ── ECDSA sign ──
        let (signature, recid): (k256::ecdsa::Signature, RecoveryId) = self
            .signing_key
            .sign_prehash(&hash)
            .map_err(|e| WarpError::AdapterError {
                chain: "evm".into(),
                reason: format!("ECDSA sign error: {}", e),
            })?;

        let r_bytes: [u8; 32] = signature.r().to_bytes().into();
        let s_bytes: [u8; 32] = signature.s().to_bytes().into();
        // EIP-155: v = recovery_id + chain_id * 2 + 35
        let v: u64 = recid.to_byte() as u64 + chain_id * 2 + 35;

        // ── Final signed RLP ──
        Ok(encode_legacy_signed(
            nonce, gas_price, gas_limit, &to_bytes, value, data, v, &r_bytes, &s_bytes,
        ))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RLP helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Encode [nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0] for signing.
fn encode_legacy_pre_sign(
    nonce: u64,
    gas_price: u64,
    gas_limit: u64,
    to: &[u8; 20],
    value: u64,
    data: &[u8],
    chain_id: u64,
) -> Vec<u8> {
    let mut stream = RlpStream::new_list(9);
    stream.append(&int_to_minimal_bytes(nonce)); // nonce
    stream.append(&int_to_minimal_bytes(gas_price)); // gasPrice
    stream.append(&int_to_minimal_bytes(gas_limit)); // gasLimit
    stream.append(&to.to_vec()); // to (20 bytes, not stripped)
    stream.append(&int_to_minimal_bytes(value)); // value
    stream.append(&data.to_vec()); // data
    stream.append(&int_to_minimal_bytes(chain_id)); // chainId (EIP-155)
    stream.append(&int_to_minimal_bytes(0u64)); // 0
    stream.append(&int_to_minimal_bytes(0u64)); // 0
    stream.out().freeze().to_vec()
}

/// Encode [nonce, gasPrice, gasLimit, to, value, data, v, r, s] — final signed TX.
#[allow(clippy::too_many_arguments)]
fn encode_legacy_signed(
    nonce: u64,
    gas_price: u64,
    gas_limit: u64,
    to: &[u8; 20],
    value: u64,
    data: &[u8],
    v: u64,
    r: &[u8; 32],
    s: &[u8; 32],
) -> Vec<u8> {
    let mut stream = RlpStream::new_list(9);
    stream.append(&int_to_minimal_bytes(nonce));
    stream.append(&int_to_minimal_bytes(gas_price));
    stream.append(&int_to_minimal_bytes(gas_limit));
    stream.append(&to.to_vec());
    stream.append(&int_to_minimal_bytes(value));
    stream.append(&data.to_vec());
    stream.append(&int_to_minimal_bytes(v));
    stream.append(&strip_leading_zeros(r)); // r: minimal bytes
    stream.append(&strip_leading_zeros(s)); // s: minimal bytes
    stream.out().freeze().to_vec()
}

// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Derive Ethereum address from an uncompressed/compressed secp256k1 public key.
fn public_key_to_address(vk: &k256::ecdsa::VerifyingKey) -> String {
    let point = vk.to_encoded_point(false); // uncompressed: 65 bytes 04 X Y
    let pub_bytes = &point.as_bytes()[1..]; // strip 04 prefix → 64 bytes
    let hash: [u8; 32] = Keccak256::digest(pub_bytes).into();
    format!("0x{}", hex::encode(&hash[12..])) // last 20 bytes = address
}

/// Decode a "0x..." hex Ethereum address to 20 bytes.
fn decode_address(addr: &str) -> WarpResult<[u8; 20]> {
    let hex_str = addr.trim_start_matches("0x");
    if hex_str.len() != 40 {
        return Err(WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("Invalid EVM address length: {}", addr),
        });
    }
    let bytes = hex::decode(hex_str).map_err(|e| WarpError::AdapterError {
        chain: "evm".into(),
        reason: format!("Address decode error: {}", e),
    })?;
    let mut arr = [0u8; 20];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

/// Encode u64 as minimal big-endian bytes (empty for 0, no leading zeros).
pub fn int_to_minimal_bytes(n: u64) -> Vec<u8> {
    if n == 0 {
        return vec![];
    }
    let be = n.to_be_bytes();
    let leading = be.iter().take_while(|&&b| b == 0).count();
    be[leading..].to_vec()
}

fn strip_leading_zeros(bytes: &[u8]) -> Vec<u8> {
    let leading = bytes.iter().take_while(|&&b| b == 0).count();
    if leading == bytes.len() {
        return vec![]; // all zero
    }
    bytes[leading..].to_vec()
}

fn hex_to_u64(hex: &str) -> u64 {
    let s = hex.trim_start_matches("0x");
    u64::from_str_radix(s, 16).unwrap_or(0)
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI encoding helpers (manual, no ethers-abi)
// ─────────────────────────────────────────────────────────────────────────────

/// ABI-encode bridgeMint(address recipient, uint256 amount, bytes32 msgHash).
/// selector = keccak256("bridgeMint(address,uint256,bytes32)")[0..4]
pub fn abi_encode_bridge_mint(
    recipient: &str,
    amount: u128,
    msg_hash: &[u8; 32],
) -> WarpResult<Vec<u8>> {
    // selector = 0x9d6ca9f3  (pre-computed keccak256 of sig)
    let selector = &Keccak256::digest(b"bridgeMint(address,uint256,bytes32)")[..4];

    let addr_hex = recipient.trim_start_matches("0x");
    if addr_hex.len() != 40 {
        return Err(WarpError::AdapterError {
            chain: "evm".into(),
            reason: format!("Invalid recipient address: {}", recipient),
        });
    }
    let addr_bytes = hex::decode(addr_hex).map_err(|e| WarpError::AdapterError {
        chain: "evm".into(),
        reason: e.to_string(),
    })?;

    let mut calldata = Vec::with_capacity(4 + 96);
    calldata.extend_from_slice(selector);
    // address: left-padded to 32 bytes (12 zero bytes + 20 addr bytes)
    calldata.extend_from_slice(&[0u8; 12]);
    calldata.extend_from_slice(&addr_bytes);
    // uint256 amount: big-endian 32 bytes (u128 = 16 bytes, pad to 32)
    calldata.extend_from_slice(&[0u8; 16]); // 16 zeros for u128 → 32 bytes
    calldata.extend_from_slice(&amount.to_be_bytes());
    // bytes32 msg_hash
    calldata.extend_from_slice(msg_hash);

    Ok(calldata)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_int_to_minimal_bytes_zero() {
        assert_eq!(int_to_minimal_bytes(0), Vec::<u8>::new());
    }

    #[test]
    fn test_int_to_minimal_bytes_one() {
        assert_eq!(int_to_minimal_bytes(1), vec![0x01]);
    }

    #[test]
    fn test_int_to_minimal_bytes_256() {
        assert_eq!(int_to_minimal_bytes(256), vec![0x01, 0x00]);
    }

    #[test]
    fn test_decode_address_valid() {
        let addr = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186";
        let bytes = decode_address(addr).unwrap();
        assert_eq!(bytes.len(), 20);
        assert_eq!(
            hex::encode(bytes),
            "dde17506bc2d2dce1d594bd1d85b0babb389d186"
        );
    }

    #[test]
    fn test_decode_address_invalid() {
        assert!(decode_address("0x1234").is_err());
    }

    #[test]
    fn test_signer_from_hex_valid() {
        // Standard test vector private key (never use on mainnet)
        let key = "4c0883a69102937d6231471b5dbb6e538eba2ef1162e9c77b85e5afbc7dd85a0";
        let signer = EvmSigner::from_hex(key).unwrap();
        // Address derived from this key: 0x2c7536E3605D9C16a7a3D7b1898e529396a65c23
        assert!(signer.address.starts_with("0x"));
        assert_eq!(signer.address.len(), 42);
    }

    #[test]
    fn test_signer_from_hex_invalid() {
        assert!(EvmSigner::from_hex("nothex").is_err());
    }

    #[test]
    fn test_abi_encode_bridge_mint() {
        let msg_hash = [0u8; 32];
        let data = abi_encode_bridge_mint(
            "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186",
            1_000_000,
            &msg_hash,
        )
        .unwrap();
        // 4 (selector) + 32 (addr) + 32 (amount) + 32 (hash) = 100 bytes
        assert_eq!(data.len(), 100);
    }

    #[test]
    fn test_sign_legacy_tx_produces_bytes() {
        let key = "4c0883a69102937d6231471b5dbb6e538eba2ef1162e9c77b85e5afbc7dd85a0";
        let signer = EvmSigner::from_hex(key).unwrap();
        let to = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23";
        let data = b"test";
        let raw = signer
            .sign_legacy_tx(84532, 0, 1_000_000_000, 100_000, to, 0, data)
            .unwrap();
        // Raw tx is RLP-encoded — just check it's non-empty and decodable
        assert!(!raw.is_empty());
        // First byte should be >= 0xc0 (RLP list prefix)
        assert!(
            raw[0] >= 0xc0,
            "Expected RLP list prefix, got 0x{:02x}",
            raw[0]
        );
    }
}
