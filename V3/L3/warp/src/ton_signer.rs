//! # TON Signer — Ed25519 key loading + wallet address derivation
//!
//! Loads the WARP relay Ed25519 signing key for the TON adapter and derives
//! the wallet V2R2 address using proper TL-B Cell serialization.
//!
//! ## Key format
//! `WARP_TON_RELAY_KEY` must be a hex-encoded 32-byte Ed25519 seed.
//!
//! ## Address derivation
//! TON wallet V2R2 addresses are derived from a StateInit cell containing:
//! - code: ^Cell (wallet V2R2 code, hash known)
//! - data: ^Cell (pubkey:bits256 + seqno:uint32)
//!
//! The address hash = SHA-256 of the StateInit cell's representation.

use crate::error::{WarpError, WarpResult};
use crate::ton_cell::Cell;
use base64::Engine;
use ed25519_dalek::{SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};

/// TON workchain for the default relay wallet (masterchain = -1, base = 0).
const DEFAULT_WORKCHAIN: i32 = 0;

/// Default wallet V2R2 code hash (mainnet).
/// This is the SHA-256 hash of the standard wallet V2R2 code cell.
/// Can be overridden via `WARP_TON_WALLET_CODE_HASH` env var.
const DEFAULT_WALLET_V2R2_CODE_HASH: &str =
    "384da57506c5e59b8139b7370c5d7b9e1c41e2f7cdca4561f2f31b20d6c52cf5";

/// A loaded TON relay signing key.
pub struct TonSigner {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
    pub workchain: i32,
}

impl TonSigner {
    /// Load the relay key from `WARP_TON_RELAY_KEY` env var (hex, 32 bytes).
    pub fn from_env() -> WarpResult<Self> {
        let key_hex = std::env::var("WARP_TON_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "ton".into(),
            reason: "WARP_TON_RELAY_KEY env var not set".into(),
        })?;
        let workchain = std::env::var("WARP_TON_WORKCHAIN")
            .ok()
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(DEFAULT_WORKCHAIN);
        Self::from_hex(&key_hex, workchain)
    }

    /// Create from a hex-encoded 32-byte Ed25519 seed.
    pub fn from_hex(hex_str: &str, workchain: i32) -> WarpResult<Self> {
        let bytes = hex::decode(hex_str).map_err(|e| WarpError::AdapterError {
            chain: "ton".into(),
            reason: format!("WARP_TON_RELAY_KEY hex decode failed: {}", e),
        })?;
        if bytes.len() != 32 {
            return Err(WarpError::AdapterError {
                chain: "ton".into(),
                reason: format!(
                    "Ed25519 seed must be 32 bytes, got {}",
                    bytes.len()
                ),
            });
        }
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&bytes);
        Self::from_raw(seed, workchain)
    }

    /// Create directly from a raw 32-byte Ed25519 seed (test/internal use).
    pub fn from_raw(seed: [u8; 32], workchain: i32) -> WarpResult<Self> {
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();
        Ok(Self {
            signing_key,
            verifying_key,
            workchain,
        })
    }

    /// The 32-byte Ed25519 public key of the relay wallet.
    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }

    /// Hex-encoded public key (64 chars).
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public_key_bytes())
    }

    /// Derive the wallet V2R2 address hash using proper TL-B Cell serialization.
    ///
    /// The address is derived from a StateInit cell:
    /// ```text
    /// StateInit split_depth:(Maybe uint) special:(Maybe TickTock)
    ///   code:(Maybe ^Cell) data:(Maybe ^Cell) library:(Maybe ^Cell) = StateInit;
    /// ```
    ///
    /// For wallet V2R2:
    /// - split_depth: None (0 bit)
    /// - special: None (0 bit)
    /// - code: present (1 bit) + ref to wallet code cell
    /// - data: present (1 bit) + ref to wallet data cell (pubkey + seqno=0)
    /// - library: None (0 bit)
    ///
    /// The address hash = SHA-256 of the StateInit cell's representation.
    pub fn raw_address_hash(&self) -> [u8; 32] {
        // 1. Build wallet data cell: pubkey(256 bits) + seqno(32 bits)
        let mut data_cell = Cell::new();
        let data = data_cell.data_mut();
        data.write_bytes(&self.public_key_bytes());
        data.write_uint(0, 32); // seqno = 0 for new wallet
        let data_hash = data_cell.hash();

        // 2. Get wallet code hash (from env or default)
        let code_hash_hex =
            std::env::var("WARP_TON_WALLET_CODE_HASH").unwrap_or_else(|_| DEFAULT_WALLET_V2R2_CODE_HASH.to_string());
        let code_hash = hex::decode(&code_hash_hex).unwrap_or_else(|_| vec![0u8; 32]);
        let mut code_hash_arr = [0u8; 32];
        if code_hash.len() == 32 {
            code_hash_arr.copy_from_slice(&code_hash);
        }

        // 3. Build StateInit cell representation manually
        // (since we can't add a "phantom" ref with just a hash)
        //
        // StateInit data (5 bits):
        //   split_depth: None → 0
        //   special: None → 0
        //   code: present → 1
        //   data: present → 1
        //   library: None → 0
        // = 0b01100 = 5 bits
        //
        // Cell descriptor:
        //   d1 = 2 << 5 = 0x40 (2 refs, ordinary)
        //   d2 = (1 << 1) | 1 = 0x03 (1 byte data, partial)
        //   data = 0b01100_100 = 0x64 (5 bits + padding 1 + 2 zeros)
        //   then: code_hash(32) + data_hash(32)

        let mut repr = Vec::with_capacity(2 + 1 + 32 + 32);
        repr.push(0x40); // d1: 2 refs
        repr.push(0x03); // d2: 1 byte, partial
        repr.push(0x64); // data: 0b01100 + padding
        repr.extend_from_slice(&code_hash_arr); // ref 1: code hash
        repr.extend_from_slice(&data_hash); // ref 2: data hash

        Sha256::digest(&repr).into()
    }

    /// Derive the full TON address string (bounceable, mainnet).
    /// Format: EQ + base64url( tag(1) + workchain(1) + hash(32) + crc(2) )
    pub fn address_string(&self) -> String {
        let hash = self.raw_address_hash();
        let wc = self.workchain as i8;

        // Build address payload: tag + workchain + hash
        let mut payload = Vec::with_capacity(34);
        payload.push(0x11); // bounceable, mainnet
        payload.push(wc as u8);
        payload.extend_from_slice(&hash);

        // Compute CRC16-XMODEM
        let crc = crc16_xmodem(&payload);
        payload.push((crc >> 8) as u8);
        payload.push((crc & 0xff) as u8);

        // Base64url encode (no padding)
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&payload)
    }

    /// Workchain id for this wallet.
    pub fn workchain(&self) -> i32 {
        self.workchain
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRC16-XMODEM (used in TON address checksums)
// ─────────────────────────────────────────────────────────────────────────────

/// Compute CRC16-XMODEM checksum (used in TON address encoding).
fn crc16_xmodem(data: &[u8]) -> u16 {
    let mut crc: u16 = 0;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

// ─────────────────────────────────────────────────────────────────────────────
// TON address decoder (EQ.../UQ... base64url format)
// ─────────────────────────────────────────────────────────────────────────────

/// Decode a TON address string (EQ.../UQ.../kQ... format) into (workchain, hash).
/// Returns the workchain ID and 32-byte address hash.
pub fn decode_ton_address(addr: &str) -> Result<(i32, [u8; 32]), String> {
    use base64::Engine;

    // Try base64url (no pad) first, then base64url with pad
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(addr)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(addr))
        .map_err(|e| format!("base64 decode failed: {}", e))?;

    if decoded.len() != 36 {
        return Err(format!("address must be 36 bytes, got {}", decoded.len()));
    }

    // Verify CRC
    let payload = &decoded[..34];
    let crc_expected = ((decoded[34] as u16) << 8) | (decoded[35] as u16);
    let crc_actual = crc16_xmodem(payload);
    if crc_expected != crc_actual {
        return Err(format!(
            "CRC mismatch: expected {:#06x}, got {:#06x}",
            crc_expected, crc_actual
        ));
    }

    // Parse tag + workchain + hash
    let tag = decoded[0];
    let workchain = decoded[1] as i8 as i32;
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&decoded[2..34]);

    // Tag bits:
    // 0x11 = bounceable mainnet
    // 0x51 = non-bounceable mainnet
    // 0x80 | tag = testnet
    let _is_testnet = tag & 0x80 != 0;
    let _is_bounceable = tag & 0x40 == 0; // bit 6: 0=bounceable, 1=non-bounceable

    Ok((workchain, hash))
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_signer() -> TonSigner {
        TonSigner::from_raw([7u8; 32], 0).unwrap()
    }

    #[test]
    fn test_signer_public_key_length() {
        let s = test_signer();
        assert_eq!(s.public_key_bytes().len(), 32);
    }

    #[test]
    fn test_signer_public_key_hex_is_64_chars() {
        let s = test_signer();
        let pk = s.public_key_hex();
        assert_eq!(pk.len(), 64);
        assert!(pk.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_signer_from_hex_roundtrip() {
        let seed = [9u8; 32];
        let hex_str = hex::encode(seed);
        let s = TonSigner::from_hex(&hex_str, 0).unwrap();
        let expected_pk = SigningKey::from_bytes(&seed).verifying_key().to_bytes();
        assert_eq!(s.public_key_bytes(), expected_pk);
    }

    #[test]
    fn test_signer_from_hex_invalid_chars() {
        assert!(TonSigner::from_hex("not-hex!!", 0).is_err());
    }

    #[test]
    fn test_signer_from_hex_wrong_length() {
        // 16 bytes instead of 32
        let short = hex::encode([1u8; 16]);
        assert!(TonSigner::from_hex(&short, 0).is_err());
    }

    #[test]
    fn test_signer_raw_address_hash_is_32_bytes() {
        let s = test_signer();
        let h = s.raw_address_hash();
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn test_signer_workchain_default() {
        let s = test_signer();
        assert_eq!(s.workchain(), 0);
    }

    #[test]
    fn test_signer_workchain_masterchain() {
        let s = TonSigner::from_raw([3u8; 32], -1).unwrap();
        assert_eq!(s.workchain(), -1);
    }

    #[test]
    fn test_signer_deterministic_pubkey() {
        let s1 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        let s2 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        assert_eq!(s1.public_key_bytes(), s2.public_key_bytes());
    }

    #[test]
    fn test_signer_raw_address_hash_deterministic() {
        let s1 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        let s2 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        assert_eq!(s1.raw_address_hash(), s2.raw_address_hash());
    }

    #[test]
    fn test_signer_raw_address_hash_differs_for_different_keys() {
        let s1 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        let s2 = TonSigner::from_raw([8u8; 32], 0).unwrap();
        assert_ne!(s1.raw_address_hash(), s2.raw_address_hash());
    }

    #[test]
    fn test_signer_address_string_starts_with_eq() {
        let s = test_signer();
        let addr = s.address_string();
        assert!(addr.starts_with("EQ"), "address should start with EQ: {}", addr);
    }

    #[test]
    fn test_signer_address_string_deterministic() {
        let s1 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        let s2 = TonSigner::from_raw([7u8; 32], 0).unwrap();
        assert_eq!(s1.address_string(), s2.address_string());
    }

    #[test]
    fn test_crc16_xmodem_known_value() {
        // CRC16-XMODEM of "123456789" should be 0x31C3
        let data = b"123456789";
        let crc = crc16_xmodem(data);
        assert_eq!(crc, 0x31C3);
    }

    #[test]
    fn test_decode_ton_address_valid() {
        // Encode an address first, then decode it
        let s = test_signer();
        let addr = s.address_string();
        let (wc, hash) = decode_ton_address(&addr).expect("decode should succeed");
        assert_eq!(wc, 0); // base workchain
        assert_eq!(hash, s.raw_address_hash());
    }

    #[test]
    fn test_decode_ton_address_invalid_base64() {
        assert!(decode_ton_address("!!!not-base64!!!").is_err());
    }

    #[test]
    fn test_decode_ton_address_wrong_length() {
        // Too short
        assert!(decode_ton_address("EQAA").is_err());
    }

    #[test]
    fn test_decode_ton_address_crc_mismatch() {
        // Manually corrupt the CRC
        let s = test_signer();
        let addr = s.address_string();
        // Flip the last character to corrupt CRC
        let mut corrupted = addr.chars().collect::<Vec<_>>();
        let last = corrupted.last_mut().unwrap();
        *last = if *last == 'A' { 'B' } else { 'A' };
        let corrupted_addr: String = corrupted.into_iter().collect();
        assert!(decode_ton_address(&corrupted_addr).is_err());
    }

    #[test]
    fn test_address_roundtrip() {
        let s = test_signer();
        let addr = s.address_string();
        let (wc, hash) = decode_ton_address(&addr).unwrap();
        assert_eq!(wc, s.workchain());
        assert_eq!(hash, s.raw_address_hash());
    }
}
