/// Stellar Transaction Signing — Classic Payment (ed25519 + manual XDR)
///
/// Signs and broadcasts Stellar Payment transactions for the WARP relay wallet.
/// No external stellar-sdk required — uses stellar-strkey + ed25519-dalek + sha2 + base64.
/// XDR encoding is hand-written for the exact structure of a single-Payment transaction.
///
/// Flow:
///   1. Parse relay secret key (S... StrKey) → 32-byte seed → ed25519 SigningKey
///   2. Fetch account sequence number via Horizon GET /accounts/{G...}
///   3. Build XDR for TransactionV1 (sourceAccount, fee, seqNum+1, Payment op)
///   4. Compute sig hash = SHA-256(SHA-256(passphrase) || u32be(2) || tx_xdr)
///   5. ed25519_dalek sign the hash
///   6. Append DecoratedSignature → complete TransactionEnvelope XDR → base64
///   7. POST /transactions tx=<base64>
///
/// Environment Variables:
///   WARP_STELLAR_RELAY_KEY     — Stellar secret key (S... 56-char StrKey, required)
///   WARP_STELLAR_WZION_ISSUER  — G... account issuing the wZION asset (required)
///   WARP_STELLAR_ASSET_CODE    — asset code (default: "wZION")
///   STELLAR_NETWORK            — "mainnet" | "testnet" | "futurenet" (default: mainnet)
///   WARP_STELLAR_FEE           — base fee in stroops (default: 100)
use crate::error::{WarpError, WarpResult};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signer, SigningKey};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use stellar_strkey::ed25519::{PrivateKey as StellarPrivKey, PublicKey as StellarPubKey};
use tracing::info;

// ─────────────────────────────────────────────────────────────────────────────
// Network passphrases
// ─────────────────────────────────────────────────────────────────────────────

fn network_passphrase(network: &str) -> &'static str {
    match network {
        "testnet" => "Test SDF Network ; September 2015",
        "futurenet" => "Test SDF Future Network ; October 2022",
        _ => "Public Global Stellar Network ; September 2015",
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// XDR discriminant constants (Stellar Protocol 19)
// ─────────────────────────────────────────────────────────────────────────────

const ENVELOPE_TYPE_TX: u32 = 2;
const KEY_TYPE_ED25519: u32 = 0;
const PUBLIC_KEY_ED25519: u32 = 0;
const PRECOND_NONE: u32 = 0;
const MEMO_NONE: u32 = 0;
const OP_PAYMENT: u32 = 1;
const ASSET_TYPE_ALPHANUM4: u32 = 1;
const ASSET_TYPE_ALPHANUM12: u32 = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal XDR serializer
// ─────────────────────────────────────────────────────────────────────────────

struct Xdr(Vec<u8>);

impl Xdr {
    fn new() -> Self {
        Xdr(Vec::new())
    }

    /// big-endian uint32
    fn u32(&mut self, v: u32) {
        self.0.extend_from_slice(&v.to_be_bytes());
    }

    /// big-endian int64
    fn i64(&mut self, v: i64) {
        self.0.extend_from_slice(&v.to_be_bytes());
    }

    /// raw bytes (must already be a multiple of 4, or caller handles padding)
    fn raw(&mut self, b: &[u8]) {
        self.0.extend_from_slice(b);
    }

    /// fixed-length opaque[n] — appends b then pads to multiple of 4
    fn fixed(&mut self, b: &[u8], n: usize) {
        self.0.extend_from_slice(b);
        let pad = (4 - (n % 4)) % 4;
        self.0.resize(self.0.len() + pad, 0);
    }

    /// variable-length opaque — u32 length + bytes + padding
    fn var(&mut self, b: &[u8]) {
        self.u32(b.len() as u32);
        self.fixed(b, b.len());
    }

    fn into_bytes(self) -> Vec<u8> {
        self.0
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stellar Account (Horizon REST)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct HorizonAccount {
    sequence: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// StellarSigner
// ─────────────────────────────────────────────────────────────────────────────

pub struct StellarSigner {
    signing_key: SigningKey,
    pub_key_bytes: [u8; 32],
    network: String,
}

impl StellarSigner {
    /// Load from `WARP_STELLAR_RELAY_KEY` env var (S... StrKey format).
    pub fn from_env() -> WarpResult<Self> {
        let s = std::env::var("WARP_STELLAR_RELAY_KEY").map_err(|_| WarpError::AdapterError {
            chain: "stellar".into(),
            reason: "WARP_STELLAR_RELAY_KEY env var not set".into(),
        })?;
        let network = std::env::var("STELLAR_NETWORK").unwrap_or_else(|_| "mainnet".into());
        Self::from_str_key(&s, network)
    }

    /// Create from a Stellar secret key string (S...).
    pub fn from_str_key(secret: &str, network: String) -> WarpResult<Self> {
        let priv_key =
            StellarPrivKey::from_string(secret).map_err(|e| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: format!("Stellar StrKey parse error: {:?}", e),
            })?;
        // ed25519-dalek SigningKey takes a 32-byte seed
        let signing_key = SigningKey::from_bytes(&priv_key.0);
        let pub_key_bytes = signing_key.verifying_key().to_bytes();
        Ok(Self {
            signing_key,
            pub_key_bytes,
            network,
        })
    }

    /// Create directly from a raw 32-byte ed25519 seed (test/internal use).
    pub fn from_raw(seed: [u8; 32], network: String) -> Self {
        let signing_key = SigningKey::from_bytes(&seed);
        let pub_key_bytes = signing_key.verifying_key().to_bytes();
        Self {
            signing_key,
            pub_key_bytes,
            network,
        }
    }

    /// The relay wallet's G... Stellar address.
    pub fn address(&self) -> String {
        let pk = StellarPubKey(self.pub_key_bytes);
        pk.to_string()
    }

    /// Sign and broadcast a classic Payment to send `amount_stroops` of Asset
    /// (wZION) to `recipient` (G... address).
    pub async fn send_payment(
        &self,
        client: &reqwest::Client,
        horizon_url: &str,
        recipient: &str,
        amount_stroops: i64,
    ) -> WarpResult<String> {
        let asset_code =
            std::env::var("WARP_STELLAR_ASSET_CODE").unwrap_or_else(|_| "wZION".to_string());
        let issuer_str =
            std::env::var("WARP_STELLAR_WZION_ISSUER").map_err(|_| WarpError::AdapterError {
                chain: "stellar".into(),
                reason: "WARP_STELLAR_WZION_ISSUER env var not set".into(),
            })?;
        let fee = std::env::var("WARP_STELLAR_FEE")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(100);

        // 1. Fetch sequence number for relay wallet's G... address
        let relay_address = self.address();
        let seq = fetch_sequence(client, horizon_url, &relay_address).await?;

        // 2. Decode recipient + issuer public keys
        let dest_bytes = g_addr_to_bytes(recipient)?;
        let issuer_bytes = g_addr_to_bytes(&issuer_str)?;
        let asset_type = if asset_code.len() <= 4 {
            ASSET_TYPE_ALPHANUM4
        } else {
            ASSET_TYPE_ALPHANUM12
        };
        let asset_code_len = if asset_type == ASSET_TYPE_ALPHANUM4 {
            4usize
        } else {
            12usize
        };

        // Pad asset code to fixed length
        let mut code_bytes = [0u8; 12];
        let src = asset_code.as_bytes();
        let copy_len = src.len().min(asset_code_len);
        code_bytes[..copy_len].copy_from_slice(&src[..copy_len]);

        // 3. Build Transaction XDR
        let tx_xdr = build_payment_tx(
            &self.pub_key_bytes,
            &dest_bytes,
            asset_type,
            &code_bytes[..asset_code_len],
            &issuer_bytes,
            amount_stroops,
            seq + 1,
            fee,
        );

        // 4. Compute signature hash
        let passphrase = network_passphrase(&self.network);
        let network_id: [u8; 32] = Sha256::digest(passphrase.as_bytes()).into();
        let mut sig_payload = Xdr::new();
        sig_payload.raw(&network_id);
        sig_payload.u32(ENVELOPE_TYPE_TX);
        sig_payload.raw(&tx_xdr);
        let sig_hash: [u8; 32] = Sha256::digest(sig_payload.into_bytes()).into();

        // 5. Sign
        let signature = self.signing_key.sign(&sig_hash);
        let sig_bytes = signature.to_bytes(); // 64 bytes

        // 6. Assemble TransactionEnvelope XDR
        let mut env = Xdr::new();
        env.u32(ENVELOPE_TYPE_TX); // TransactionEnvelope discriminant
        env.raw(&tx_xdr); // Transaction
        env.u32(1); // signatures array count = 1
                    // DecoratedSignature:
                    // hint = 4 fixed bytes (last 4 of pubkey)
        env.raw(&self.pub_key_bytes[28..32]); // fixed opaque[4] — no length prefix
        env.var(&sig_bytes); // variable opaque sig

        let envelope_b64 = B64.encode(env.into_bytes());

        info!(
            "[WARP][stellar] Submitting payment: {} stroops → {} (relay: {})",
            amount_stroops, recipient, relay_address
        );

        // 7. Submit to Horizon
        let tx_hash = submit_transaction(client, horizon_url, &envelope_b64).await?;

        info!("[WARP][stellar] TX submitted OK: {}", tx_hash);
        Ok(tx_hash)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// XDR builder for Transaction (no signatures yet)
// ─────────────────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn build_payment_tx(
    source_pk: &[u8; 32],
    dest_pk: &[u8; 32],
    asset_type: u32,
    asset_code: &[u8], // 4 or 12 bytes
    issuer_pk: &[u8; 32],
    amount_stroops: i64,
    seq_num: i64,
    fee: u32,
) -> Vec<u8> {
    let mut tx = Xdr::new();

    // sourceAccount MuxedAccount::KeyTypeEd25519
    tx.u32(KEY_TYPE_ED25519);
    tx.raw(source_pk);

    // fee
    tx.u32(fee);

    // seqNum (int64)
    tx.i64(seq_num);

    // Preconditions::PRECOND_NONE
    tx.u32(PRECOND_NONE);

    // Memo::MEMO_NONE
    tx.u32(MEMO_NONE);

    // operations: array of 1
    tx.u32(1); // count

    // Operation:
    tx.u32(0); // optional source absent = 0

    // OperationBody::PAYMENT
    tx.u32(OP_PAYMENT);

    // PaymentOp.destination MuxedAccount::KeyTypeEd25519
    tx.u32(KEY_TYPE_ED25519);
    tx.raw(dest_pk);

    // PaymentOp.asset
    tx.u32(asset_type);
    // AlphaNum4 or AlphaNum12: assetCode (fixed 4 or 12 bytes) + issuer AccountID
    let asset_code_len = asset_code.len(); // 4 or 12
    tx.fixed(asset_code, asset_code_len); // no padding needed (4,12 are multiples of 4)
                                          // issuer AccountID::PUBLIC_KEY_TYPE_ED25519
    tx.u32(PUBLIC_KEY_ED25519);
    tx.raw(issuer_pk);

    // PaymentOp.amount (int64)
    tx.i64(amount_stroops);

    // TransactionExt::V0
    tx.u32(0);

    tx.into_bytes()
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizon helpers
// ─────────────────────────────────────────────────────────────────────────────

async fn fetch_sequence(
    client: &reqwest::Client,
    horizon_url: &str,
    address: &str,
) -> WarpResult<i64> {
    let url = format!("{}/accounts/{}", horizon_url, address);
    let acc: HorizonAccount = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "stellar".into(),
            reason: e.to_string(),
        })?
        .json()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "stellar".into(),
            reason: e.to_string(),
        })?;
    acc.sequence
        .parse::<i64>()
        .map_err(|_| WarpError::AdapterError {
            chain: "stellar".into(),
            reason: format!("Cannot parse sequence number: '{}'", acc.sequence),
        })
}

async fn submit_transaction(
    client: &reqwest::Client,
    horizon_url: &str,
    envelope_b64: &str,
) -> WarpResult<String> {
    let url = format!("{}/transactions", horizon_url);
    let resp = client
        .post(&url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!(
            "tx={}",
            envelope_b64
                .replace('+', "%2B")
                .replace('/', "%2F")
                .replace('=', "%3D")
        ))
        .send()
        .await
        .map_err(|e| WarpError::AdapterError {
            chain: "stellar".into(),
            reason: e.to_string(),
        })?;

    let status = resp.status();
    let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::json!({}));

    if !status.is_success() {
        let reason = body["extras"]["result_codes"].to_string();
        return Err(WarpError::AdapterError {
            chain: "stellar".into(),
            reason: format!("Horizon submit failed HTTP {}: {}", status, reason),
        });
    }

    body["hash"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| WarpError::AdapterError {
            chain: "stellar".into(),
            reason: "Missing hash in Horizon response".into(),
        })
}

/// Decode a G... Stellar address to 32 raw ed25519 bytes.
pub fn g_addr_to_bytes(addr: &str) -> WarpResult<[u8; 32]> {
    let pk = StellarPubKey::from_string(addr).map_err(|e| WarpError::AdapterError {
        chain: "stellar".into(),
        reason: format!("Invalid Stellar address '{}': {:?}", addr, e),
    })?;
    Ok(pk.0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use stellar_strkey::ed25519::PrivateKey as StellarPrivKeyTest;

    /// Build a test signer from a known seed — avoids StrKey roundtrip in most tests.
    fn test_signer() -> StellarSigner {
        StellarSigner::from_raw([7u8; 32], "testnet".into())
    }

    #[test]
    fn test_signer_address_format() {
        let s = test_signer();
        let addr = s.address();
        assert!(
            addr.starts_with('G'),
            "Expected G... address, got: {}",
            addr
        );
        assert_eq!(addr.len(), 56);
    }

    #[test]
    fn test_signer_from_str_key_roundtrip() {
        let seed = [7u8; 32];
        let sk_str = StellarPrivKeyTest(seed).to_string();
        let s = StellarSigner::from_str_key(&sk_str, "testnet".into()).unwrap();
        assert_eq!(s.pub_key_bytes, test_signer().pub_key_bytes);
    }

    #[test]
    fn test_signer_from_str_key_invalid() {
        assert!(StellarSigner::from_str_key("NOTAKEY", "testnet".into()).is_err());
    }

    #[test]
    fn test_g_addr_to_bytes_invalid() {
        assert!(g_addr_to_bytes("NOTANADDR").is_err());
    }

    #[test]
    fn test_network_passphrase_mainnet() {
        assert!(network_passphrase("mainnet").contains("Public Global Stellar"));
    }

    #[test]
    fn test_network_passphrase_testnet() {
        assert!(network_passphrase("testnet").contains("Test SDF Network"));
    }

    #[test]
    fn test_xdr_u32_encoding() {
        let mut x = Xdr::new();
        x.u32(0x00000001);
        assert_eq!(x.into_bytes(), vec![0, 0, 0, 1]);
    }

    #[test]
    fn test_xdr_i64_encoding() {
        let mut x = Xdr::new();
        x.i64(1_000_000);
        let bytes = x.into_bytes();
        assert_eq!(bytes.len(), 8);
        assert_eq!(i64::from_be_bytes(bytes.try_into().unwrap()), 1_000_000);
    }

    #[test]
    fn test_xdr_var_opaque_pads_to_4() {
        let mut x = Xdr::new();
        x.var(b"ABC"); // 3 bytes → 4 bytes padded
        let b = x.into_bytes();
        assert_eq!(b.len(), 4 + 4); // u32 length + 4 bytes (3 + 1 pad)
    }

    #[test]
    fn test_build_payment_tx_alphanum12_length() {
        let src = [1u8; 32];
        let dst = [2u8; 32];
        let iss = [3u8; 32];
        let code = b"wZION\0\0\0\0\0\0\0"; // 12 bytes
        let tx = build_payment_tx(
            &src,
            &dst,
            ASSET_TYPE_ALPHANUM12,
            code,
            &iss,
            1_000_000,
            42,
            100,
        );
        // sourceAccount(36) + fee(4) + seqNum(8) + cond(4) + memo(4) + n_ops(4)
        // + op_src(4) + op_type(4) + dest(36) + asset_disc(4) + code(12)
        // + issuer(36) + amount(8) + ext(4) = 168
        assert_eq!(tx.len(), 168, "Unexpected TX size: {}", tx.len());
    }

    #[test]
    fn test_build_payment_tx_alphanum4_length() {
        let src = [1u8; 32];
        let dst = [2u8; 32];
        let iss = [3u8; 32];
        let code = b"ZION"; // 4 bytes
        let tx = build_payment_tx(
            &src,
            &dst,
            ASSET_TYPE_ALPHANUM4,
            code,
            &iss,
            1_000_000,
            42,
            100,
        );
        // AlphaNum4 code = 4 bytes instead of 12 → 168 - 8 = 160
        assert_eq!(
            tx.len(),
            160,
            "Unexpected TX size for AlphaNum4: {}",
            tx.len()
        );
    }

    #[test]
    fn test_sig_hash_deterministic() {
        let s1 = test_signer();
        let s2 = test_signer();

        let tx = build_payment_tx(
            &s1.pub_key_bytes,
            &[2u8; 32],
            ASSET_TYPE_ALPHANUM12,
            b"wZION\0\0\0\0\0\0\0",
            &[3u8; 32],
            100_000,
            5,
            100,
        );

        let passphrase = network_passphrase("testnet");
        let network_id: [u8; 32] = Sha256::digest(passphrase.as_bytes()).into();

        let hash1 = {
            let mut p = Xdr::new();
            p.raw(&network_id);
            p.u32(ENVELOPE_TYPE_TX);
            p.raw(&tx);
            Sha256::digest(p.into_bytes())
        };
        let hash2 = {
            let mut p = Xdr::new();
            p.raw(&network_id);
            p.u32(ENVELOPE_TYPE_TX);
            p.raw(&tx);
            Sha256::digest(p.into_bytes())
        };
        assert_eq!(hash1, hash2);

        // Deterministic ed25519 — same key + same message → same sig
        let sig1 = s1.signing_key.sign(hash1.as_slice());
        let sig2 = s2.signing_key.sign(hash2.as_slice());
        assert_eq!(sig1.to_bytes(), sig2.to_bytes());
    }

    #[test]
    fn test_envelope_base64_is_valid_base64() {
        let s = test_signer();
        let tx = build_payment_tx(
            &s.pub_key_bytes,
            &[2u8; 32],
            ASSET_TYPE_ALPHANUM12,
            b"wZION\0\0\0\0\0\0\0",
            &[3u8; 32],
            100_000,
            5,
            100,
        );

        let passphrase = network_passphrase("testnet");
        let network_id: [u8; 32] = Sha256::digest(passphrase.as_bytes()).into();
        let mut p = Xdr::new();
        p.raw(&network_id);
        p.u32(ENVELOPE_TYPE_TX);
        p.raw(&tx);
        let sig_hash = Sha256::digest(p.into_bytes());
        let sig = s.signing_key.sign(sig_hash.as_slice());

        let mut env = Xdr::new();
        env.u32(ENVELOPE_TYPE_TX);
        env.raw(&tx);
        env.u32(1);
        env.raw(&s.pub_key_bytes[28..32]);
        env.var(&sig.to_bytes());

        let b64 = B64.encode(env.into_bytes());
        assert!(!b64.is_empty());
        assert!(B64.decode(&b64).is_ok());
    }
}
