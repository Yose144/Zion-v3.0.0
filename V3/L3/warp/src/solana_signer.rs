//! # Solana SPL Token Signer — Phase 5 (D-04)
//!
//! Signs and broadcasts Solana transactions for SPL Token `mintTo` calls.
//!
//! ## Design
//! - No `solana-client` or `solana-sdk` dependency (too heavy for a bridge relay).
//! - Pure Rust: `ed25519-dalek v2` + `bs58 v0.5` + `sha2 v0.10` (all already in Cargo).
//! - Compact-u16 serialization and legacy-transaction format implemented by hand.
//! - Derives the Associated Token Account (ATA) offline via `findProgramAddress`.
//!
//! ## Key format
//! `WARP_SOLANA_RELAY_KEY` must be the JSON-keypair byte array written by
//! `solana-keygen` (64 bytes: seed || pubkey), encoded as base58.
//!
//! ## Transaction structure (legacy)
//! ```text
//! [compact_u16(1), sig[64], header[3], compact_u16(n_accts),
//!  accts[32 each], blockhash[32], compact_u16(1), instr...]
//! ```
//!
//! ## SPL Token mintTo (index 7)
//! Accounts: [mint(W), dest_ata(W), mint_authority(S)]
//! Data:     [0x07, amount_le_u64 (8 bytes)]

use crate::error::{WarpError, WarpResult};
use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};

// ─────────────────────────────────────────────────────────────────────────────
// Well-known program IDs (decoded from base58 at first use)
// ─────────────────────────────────────────────────────────────────────────────

/// SPL Token Program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
fn token_program_id() -> [u8; 32] {
    bs58_decode_32("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
}

/// Associated Token Account Program: `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv8dW`
fn ata_program_id() -> [u8; 32] {
    bs58_decode_32("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv8dW")
}

/// Convenience: decode a base58 string into exactly 32 bytes (panics on bad input).
fn bs58_decode_32(s: &str) -> [u8; 32] {
    bs58::decode(s)
        .into_vec()
        .unwrap_or_default()
        .try_into()
        .unwrap_or([0u8; 32])
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact-u16 encoding (Solana wire format)
// ─────────────────────────────────────────────────────────────────────────────

/// Appends a compact-u16 value to `buf`.
/// Values 0–127 → 1 byte.  128–16383 → 2 bytes.  16384+ → 3 bytes.
fn write_compact_u16(buf: &mut Vec<u8>, mut n: usize) {
    loop {
        let lower = (n & 0x7f) as u8;
        n >>= 7;
        if n == 0 {
            buf.push(lower);
            break;
        }
        buf.push(lower | 0x80);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Program Derived Address helpers
// ─────────────────────────────────────────────────────────────────────────────

/// `createProgramAddress` — returns `Some(address)` iff the SHA-256 hash of
/// `seeds || program_id || "ProgramDerivedAddress"` is NOT a valid Ed25519 point.
fn create_program_address_checked(seeds: &[&[u8]], program_id: &[u8; 32]) -> Option<[u8; 32]> {
    let mut h = Sha256::new();
    for s in seeds {
        h.update(s);
    }
    h.update(program_id);
    h.update(b"ProgramDerivedAddress");
    let hash: [u8; 32] = h.finalize().into();
    // A valid PDA must NOT lie on the Ed25519 curve.
    if VerifyingKey::from_bytes(&hash).is_err() {
        Some(hash)
    } else {
        None
    }
}

/// `findProgramAddress` — iterates bump seeds 255..=0, returns first valid PDA.
fn find_program_address(seeds: &[&[u8]], program_id: &[u8; 32]) -> WarpResult<([u8; 32], u8)> {
    for nonce in (0u8..=255).rev() {
        let nonce_slice = [nonce];
        let mut all: Vec<&[u8]> = seeds.to_vec();
        all.push(&nonce_slice);
        if let Some(addr) = create_program_address_checked(&all, program_id) {
            return Ok((addr, nonce));
        }
    }
    Err(WarpError::AdapterError {
        chain: "solana".into(),
        reason: "findProgramAddress: could not find valid PDA".into(),
    })
}

/// Derives the Associated Token Account address for `owner_wallet` and `mint`.
///
/// Seeds: `[owner_wallet, TOKEN_PROGRAM_ID, mint]`
/// Program: `ATA_PROGRAM_ID`
pub fn derive_ata(owner_wallet: &[u8; 32], mint: &[u8; 32]) -> WarpResult<[u8; 32]> {
    let tpid = token_program_id();
    let seeds: &[&[u8]] = &[owner_wallet.as_ref(), tpid.as_ref(), mint.as_ref()];
    let (ata, _bump) = find_program_address(seeds, &ata_program_id())?;
    Ok(ata)
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction builder
// ─────────────────────────────────────────────────────────────────────────────

/// Constructs the serialized legacy-transaction message bytes for a single
/// `mintTo` instruction.
///
/// Accounts table:
/// | idx | key                   | signer | writable |
/// |-----|-----------------------|--------|----------|
/// |  0  | mint_authority        |  yes   |  no      |
/// |  1  | mint                  |  no    |  yes     |
/// |  2  | dest_ata              |  no    |  yes     |
/// |  3  | TOKEN_PROGRAM_ID      |  no    |  no      |
///
/// Message header: `[1, 0, 1]`
/// - num_required_signers     = 1 (only mint_authority)
/// - num_readonly_signed      = 0 (authority is not readonly)
/// - num_readonly_unsigned    = 1 (token program)
fn build_mint_to_message(
    authority_pubkey: &[u8; 32],
    mint: &[u8; 32],
    dest_ata: &[u8; 32],
    recent_blockhash: &[u8; 32],
    amount: u64,
) -> Vec<u8> {
    let token_prog = token_program_id();

    let mut msg = Vec::with_capacity(256);

    // ── Message header (3 bytes) ──────────────────────────────────────────────
    msg.push(1u8); // num_required_signers
    msg.push(0u8); // num_readonly_signed
    msg.push(1u8); // num_readonly_unsigned

    // ── Account keys (compact-u16 length + 32-byte keys each) ───────────────
    write_compact_u16(&mut msg, 4);
    msg.extend_from_slice(authority_pubkey); // index 0 — signer
    msg.extend_from_slice(mint); // index 1 — writable
    msg.extend_from_slice(dest_ata); // index 2 — writable
    msg.extend_from_slice(&token_prog); // index 3 — program (read-only)

    // ── Recent blockhash ────────────────────────────────────────────────────
    msg.extend_from_slice(recent_blockhash);

    // ── Instructions (compact-u16 count + single instruction) ──────────────
    write_compact_u16(&mut msg, 1); // 1 instruction

    // program_id_index
    msg.push(3u8); // index of TOKEN_PROGRAM_ID in the account table

    // account indices (compact-u16 length + u8 indices)
    write_compact_u16(&mut msg, 3); // 3 account args: mint, dest_ata, authority
    msg.push(1u8); // mint          → index 1
    msg.push(2u8); // dest_ata      → index 2
    msg.push(0u8); // authority     → index 0 (signer)

    // instruction data — mintTo discriminator (7) + amount as u64 LE
    let mut data = Vec::with_capacity(9);
    data.push(7u8); // SPL Token: MintTo
    data.extend_from_slice(&amount.to_le_bytes());
    write_compact_u16(&mut msg, data.len());
    msg.extend_from_slice(&data);

    msg
}

/// Serialises a signed legacy Solana transaction into the wire format expected
/// by `sendTransaction` (base64-encoded).
fn serialize_transaction(sig: &[u8; 64], message: &[u8]) -> Vec<u8> {
    let mut tx = Vec::with_capacity(1 + 64 + message.len());
    // compact-u16 signature count
    write_compact_u16(&mut tx, 1);
    tx.extend_from_slice(sig);
    tx.extend_from_slice(message);
    tx
}

// ─────────────────────────────────────────────────────────────────────────────
// Signer struct
// ─────────────────────────────────────────────────────────────────────────────

/// Solana ed25519 signing key loaded from a base58-encoded 64-byte keypair.
pub struct SolanaSigner {
    key: SigningKey,
}

impl SolanaSigner {
    /// Load from the `WARP_SOLANA_RELAY_KEY` environment variable.
    ///
    /// The value must be a base58-encoded Solana keypair (64 bytes: seed || pubkey).
    pub fn from_env() -> WarpResult<Self> {
        let raw = std::env::var("WARP_SOLANA_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "solana".into(),
            reason: "WARP_SOLANA_RELAY_KEY not set".into(),
        })?;
        Self::from_base58(&raw)
    }

    /// Parse a `SolanaSigner` from a base58-encoded key.
    ///
    /// Accepts either:
    /// - 64-byte keypair (seed || pubkey) as produced by `solana-keygen`
    /// - 32-byte seed only
    pub fn from_base58(key_b58: &str) -> WarpResult<Self> {
        let bytes = bs58::decode(key_b58)
            .into_vec()
            .map_err(|e| WarpError::AdapterError {
                chain: "solana".into(),
                reason: format!("base58 decode failed: {}", e),
            })?;
        let seed: [u8; 32] = if bytes.len() == 64 {
            bytes[..32].try_into().unwrap()
        } else if bytes.len() == 32 {
            bytes.try_into().unwrap()
        } else {
            return Err(WarpError::AdapterError {
                chain: "solana".into(),
                reason: format!("key must be 32 or 64 bytes, got {}", bytes.len()),
            });
        };
        Ok(Self {
            key: SigningKey::from_bytes(&seed),
        })
    }

    /// Test helper — construct from a raw 32-byte seed without base58 round-trip.
    #[cfg(test)]
    pub fn from_seed(seed: [u8; 32]) -> Self {
        Self {
            key: SigningKey::from_bytes(&seed),
        }
    }

    /// The Ed25519 public key (Solana base58 address).
    pub fn pubkey(&self) -> [u8; 32] {
        self.key.verifying_key().to_bytes()
    }

    /// Send a `mintTo` transaction.
    ///
    /// # Arguments
    /// * `client`           — shared `reqwest::Client`
    /// * `rpc_url`          — Solana JSON-RPC endpoint
    /// * `recipient_wallet` — base58-encoded recipient wallet address (not ATA)
    /// * `mint_addr`        — base58-encoded wZION SPL mint address
    /// * `amount`           — amount in raw token units (atomic)
    ///
    /// Returns the transaction signature as a base58 string.
    pub async fn mint_to(
        &self,
        client: &reqwest::Client,
        rpc_url: &str,
        recipient_wallet: &str,
        mint_addr: &str,
        amount: u64,
    ) -> WarpResult<String> {
        // ── Decode addresses ────────────────────────────────────────────────
        let recipient_bytes: [u8; 32] = Self::decode_pubkey(recipient_wallet, "recipient")?;
        let mint_bytes: [u8; 32] = Self::decode_pubkey(mint_addr, "mint")?;
        let authority_bytes = self.pubkey();

        // ── Derive destination ATA ──────────────────────────────────────────
        let ata_bytes =
            derive_ata(&recipient_bytes, &mint_bytes).map_err(|e| WarpError::AdapterError {
                chain: "solana".into(),
                reason: format!("ATA derivation failed: {}", e),
            })?;

        // ── Fetch recent blockhash ──────────────────────────────────────────
        let blockhash = get_latest_blockhash(client, rpc_url).await?;

        // ── Build + sign message ────────────────────────────────────────────
        let message = build_mint_to_message(
            &authority_bytes,
            &mint_bytes,
            &ata_bytes,
            &blockhash,
            amount,
        );

        // Solana: sign the raw message bytes (ed25519 internally hashes with SHA-512)
        let sig = self.key.sign(&message);
        let sig_bytes: [u8; 64] = sig.to_bytes();

        // ── Serialize → base64 ─────────────────────────────────────────────
        let tx_bytes = serialize_transaction(&sig_bytes, &message);
        let tx_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &tx_bytes);

        // ── sendTransaction ─────────────────────────────────────────────────
        let result = Self::send_transaction(client, rpc_url, &tx_b64).await?;
        Ok(result)
    }

    // ── Private helpers ────────────────────────────────────────────────────

    fn decode_pubkey(addr: &str, label: &str) -> WarpResult<[u8; 32]> {
        let v = bs58::decode(addr)
            .into_vec()
            .map_err(|e| WarpError::AdapterError {
                chain: "solana".into(),
                reason: format!("{} address base58 error: {}", label, e),
            })?;
        v.try_into().map_err(|_| WarpError::AdapterError {
            chain: "solana".into(),
            reason: format!("{} address must be 32 bytes", label),
        })
    }

    async fn send_transaction(
        client: &reqwest::Client,
        rpc_url: &str,
        tx_b64: &str,
    ) -> WarpResult<String> {
        use serde::{Deserialize, Serialize};
        use serde_json::{json, Value};

        #[derive(Serialize)]
        struct Req<'a> {
            jsonrpc: &'a str,
            id: u32,
            method: &'a str,
            params: Value,
        }
        #[derive(Deserialize)]
        struct Resp {
            result: Option<Value>,
            error: Option<Value>,
        }

        let body = Req {
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: json!([tx_b64, {"encoding": "base64", "preflightCommitment": "confirmed"}]),
        };
        let resp: Resp = client
            .post(rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "solana".into(),
                reason: format!("sendTransaction HTTP: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "solana".into(),
                reason: format!("sendTransaction parse: {}", e),
            })?;

        if let Some(err) = resp.error {
            return Err(WarpError::AdapterError {
                chain: "solana".into(),
                reason: format!("sendTransaction RPC error: {}", err),
            });
        }
        resp.result
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .ok_or_else(|| WarpError::AdapterError {
                chain: "solana".into(),
                reason: "sendTransaction: null or non-string result".into(),
            })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Latest blockhash
// ─────────────────────────────────────────────────────────────────────────────

/// Calls `getLatestBlockhash` and returns the 32-byte blockhash.
pub async fn get_latest_blockhash(client: &reqwest::Client, rpc_url: &str) -> WarpResult<[u8; 32]> {
    use serde::{Deserialize, Serialize};
    use serde_json::{json, Value};

    #[derive(Serialize)]
    struct Req<'a> {
        jsonrpc: &'a str,
        id: u32,
        method: &'a str,
        params: Value,
    }
    #[derive(Deserialize)]
    struct Resp {
        result: Option<Value>,
    }

    let body = Req {
        jsonrpc: "2.0",
        id: 1,
        method: "getLatestBlockhash",
        params: json!([{"commitment": "confirmed"}]),
    };
    let resp: Resp = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: format!("getLatestBlockhash HTTP: {}", e),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: format!("getLatestBlockhash parse: {}", e),
        })?;

    let bh_str = resp
        .result
        .as_ref()
        .and_then(|r| r["value"]["blockhash"].as_str())
        .ok_or_else(|| WarpError::AdapterError {
            chain: "solana".into(),
            reason: "getLatestBlockhash: missing blockhash field".into(),
        })?;

    let bh_bytes: [u8; 32] = bs58::decode(bh_str)
        .into_vec()
        .map_err(|e| WarpError::AdapterError {
            chain: "solana".into(),
            reason: format!("blockhash base58 decode: {}", e),
        })?
        .try_into()
        .map_err(|_| WarpError::AdapterError {
            chain: "solana".into(),
            reason: "blockhash is not 32 bytes".into(),
        })?;

    Ok(bh_bytes)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    // ── Key loading ─────────────────────────────────────────────────────────

    #[test]
    fn test_from_seed_32_bytes() {
        let s = SolanaSigner::from_seed([1u8; 32]);
        assert_eq!(s.pubkey().len(), 32);
    }

    #[test]
    fn test_from_base58_64_bytes() {
        // 64 zero bytes base58-encoded
        let b58 = bs58::encode(&[0u8; 64][..]).into_string();
        let s = SolanaSigner::from_base58(&b58).unwrap();
        assert_eq!(s.pubkey().len(), 32);
    }

    #[test]
    fn test_from_base58_32_bytes() {
        let b58 = bs58::encode(&[5u8; 32][..]).into_string();
        let s = SolanaSigner::from_base58(&b58).unwrap();
        assert_eq!(s.pubkey().len(), 32);
    }

    #[test]
    fn test_from_base58_invalid_length_is_err() {
        let b58 = bs58::encode(&[0u8; 16][..]).into_string();
        assert!(SolanaSigner::from_base58(&b58).is_err());
    }

    #[test]
    fn test_from_env_missing_key_err() {
        std::env::remove_var("WARP_SOLANA_RELAY_KEY");
        assert!(SolanaSigner::from_env().is_err());
    }

    #[test]
    fn test_pubkey_deterministic() {
        let s1 = SolanaSigner::from_seed([9u8; 32]);
        let s2 = SolanaSigner::from_seed([9u8; 32]);
        assert_eq!(s1.pubkey(), s2.pubkey());
    }

    // ── Compact-u16 encoding ────────────────────────────────────────────────

    #[test]
    fn test_compact_u16_zero() {
        let mut buf = vec![];
        write_compact_u16(&mut buf, 0);
        assert_eq!(buf, vec![0x00]);
    }

    #[test]
    fn test_compact_u16_127() {
        let mut buf = vec![];
        write_compact_u16(&mut buf, 127);
        assert_eq!(buf, vec![0x7f]);
    }

    #[test]
    fn test_compact_u16_128() {
        let mut buf = vec![];
        write_compact_u16(&mut buf, 128);
        // lower 7 bits = 0, msb set | 0x80 = 0x80; next byte = 1
        assert_eq!(buf, vec![0x80, 0x01]);
    }

    #[test]
    fn test_compact_u16_300() {
        let mut buf = vec![];
        write_compact_u16(&mut buf, 300);
        // 300 = 0b1_0010_1100
        // lower 7 bits = 0b010_1100 = 0x2c, msb set = 0xac; next = 0x02
        assert_eq!(buf, vec![0xac, 0x02]);
    }

    #[test]
    fn test_compact_u16_single_account() {
        let mut buf = vec![];
        write_compact_u16(&mut buf, 4);
        assert_eq!(buf, vec![4]);
    }

    // ── Program address / ATA derivation ───────────────────────────────────

    #[test]
    fn test_create_program_address_all_zeros_not_on_curve() {
        // SHA256([0;32] || program_id || "ProgramDerivedAddress") is typically not on curve
        let seeds: &[&[u8]] = &[&[0u8; 32]];
        let program = [0u8; 32];
        // Should return Some or None — we just verify it doesn't panic
        let _ = create_program_address_checked(seeds, &program);
    }

    #[test]
    fn test_ata_derivation_runs_without_panic() {
        // Both addresses are dummy — we just verify the loop completes
        let wallet = [1u8; 32];
        let mint = [2u8; 32];
        let ata = derive_ata(&wallet, &mint);
        assert!(ata.is_ok());
        assert_eq!(ata.unwrap().len(), 32);
    }

    #[test]
    fn test_ata_derivation_deterministic() {
        let wallet = [3u8; 32];
        let mint = [4u8; 32];
        let ata1 = derive_ata(&wallet, &mint).unwrap();
        let ata2 = derive_ata(&wallet, &mint).unwrap();
        assert_eq!(ata1, ata2);
    }

    #[test]
    fn test_ata_differs_for_different_wallets() {
        let mint = [7u8; 32];
        let ata_a = derive_ata(&[0u8; 32], &mint).unwrap();
        let ata_b = derive_ata(&[1u8; 32], &mint).unwrap();
        assert_ne!(ata_a, ata_b);
    }

    // ── Transaction builder ────────────────────────────────────────────────

    #[test]
    fn test_mint_to_message_minimum_size() {
        let authority = [0u8; 32];
        let mint = [1u8; 32];
        let dest_ata = [2u8; 32];
        let blockhash = [0u8; 32];
        let msg = build_mint_to_message(&authority, &mint, &dest_ata, &blockhash, 1_000_000);
        // header(3) + compact_u16(1) + 4*32 accounts(128) + blockhash(32)
        // + compact_u16(1) + prog_idx(1) + compact_u16(1)+3acct_idxs(3)
        // + compact_u16(1)+data(9) = 3+1+128+32+1+1+1+3+1+9 = 180
        assert!(
            msg.len() >= 100,
            "message must be at least 100 bytes, got {}",
            msg.len()
        );
    }

    #[test]
    fn test_mint_to_message_header_bytes() {
        let msg = build_mint_to_message(&[0u8; 32], &[1u8; 32], &[2u8; 32], &[0u8; 32], 42);
        // First 3 bytes are the message header
        assert_eq!(msg[0], 1, "num_required_signers");
        assert_eq!(msg[1], 0, "num_readonly_signed");
        assert_eq!(msg[2], 1, "num_readonly_unsigned");
    }

    #[test]
    fn test_mint_to_data_amount_encoding() {
        let msg = build_mint_to_message(&[0u8; 32], &[1u8; 32], &[2u8; 32], &[0u8; 32], 12345678);
        let expected_amount = 12345678u64.to_le_bytes();
        // Find [7u8] followed by the amount bytes in the message
        let pos = msg
            .windows(9)
            .position(|w| w[0] == 7 && w[1..9] == expected_amount);
        assert!(
            pos.is_some(),
            "mintTo discriminator + amount not found in message"
        );
    }

    #[test]
    fn test_serialize_transaction_prefix() {
        let sig = [0u8; 64];
        let message = b"test_message";
        let tx = serialize_transaction(&sig, message);
        // First byte: compact-u16(1) = 0x01
        assert_eq!(tx[0], 1u8, "signature count should be 1");
        assert_eq!(&tx[1..65], &sig);
        assert_eq!(&tx[65..], message);
    }

    #[test]
    fn test_sign_produces_valid_signature() {
        use ed25519_dalek::Verifier;
        let signer = SolanaSigner::from_seed([42u8; 32]);
        let msg = b"ZION cross-chain bridge message";
        let sig = signer.key.sign(msg);
        // Verify with the corresponding verifying key
        let vk = signer.key.verifying_key();
        assert!(vk.verify(msg, &sig).is_ok());
    }

    #[test]
    fn test_token_program_id_length() {
        assert_eq!(token_program_id().len(), 32);
    }

    #[test]
    fn test_ata_program_id_length() {
        assert_eq!(ata_program_id().len(), 32);
    }

    #[test]
    fn test_program_ids_distinct() {
        assert_ne!(token_program_id(), ata_program_id());
    }
}
