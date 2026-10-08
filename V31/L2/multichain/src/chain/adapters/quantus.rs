//! Quantus Network adapter — Substrate JSON-RPC over HTTPS.
//!
//! Planck mainnet (market ticker QTC, on-chain symbol PLK), ss58 prefix 189,
//! 12 decimals. Signatures ML-DSA-87 (Dilithium) via `qp-rusty-crystals`.
//!
//! Wire format verified against live metadata V14 spec153
//! (see `docs/quantus-spike.md`):
//!   extrinsic v4 signed, custom extensions (ReversibleTransaction,
//!   WormholeProofRecorder) are unit types → 0 bytes on the wire.
//!   Signature enum: variant 0x00 + sig(4627)‖pubkey(2592).
//!   AccountId32 = poseidon2_squeeze_twice(dilithium_pubkey)[0..32].

use async_trait::async_trait;
use serde_json::json;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};

use crate::chain::adapter::{ChainAdapter, DepositEvent};
use crate::error::{MultichainError, MultichainResult};
use crate::types::Transfer;

// ---------------------------------------------------------------------------
// SS58 (Substrate address format, prefix 189 for Quantus)
// ---------------------------------------------------------------------------

pub const QUANTUS_SS58_PREFIX: u16 = 189;
/// Public Planck mainnet RPC — plain HTTPS JSON-RPC works (no WS needed).
pub const DEFAULT_RPC_URL: &str = "https://a1-planck.quantus.cat";
/// `Balances` pallet index on Quantus runtime (V14 metadata spec153).
pub const PALLET_BALANCES: u8 = 2;
/// `System` pallet index.
pub const PALLET_SYSTEM: u8 = 0;
/// `Utility` pallet index.
pub const PALLET_UTILITY: u8 = 9;

/// ss58 address = base58(prefix || account32 || checksum[0..2]).
/// Prefix <64 is one byte; 189 >= 64 → two-byte encoding.
pub fn ss58_encode(account32: &[u8; 32], prefix: u16) -> String {
    debug_assert!(prefix < 16384);
    let mut payload = Vec::with_capacity(35);
    if prefix < 64 {
        payload.push(prefix as u8);
    } else {
        // SS58 spec two-byte form: byte0 = ((p & 0x00FC) >> 2) | 0x40,
        // byte1 = (p >> 8) | ((p & 0x0003) << 6)
        payload.push((((prefix & 0x00FC) >> 2) as u8) | 0b0100_0000);
        payload.push(((prefix >> 8) as u8) | (((prefix & 0x0003) << 6) as u8));
    }
    payload.extend_from_slice(account32);
    let mut ctx_input = b"SS58PRE".to_vec();
    ctx_input.extend_from_slice(&payload);
    let checksum = blake2_512(&ctx_input);
    payload.extend_from_slice(&checksum[..2]);
    bs58::encode(payload).into_string()
}

/// Decode ss58 → (prefix, account32). Validates checksum.
pub fn ss58_decode(addr: &str) -> MultichainResult<([u8; 32], u16)> {
    let raw = bs58::decode(addr)
        .into_vec()
        .map_err(|e| MultichainError::Validation(format!("invalid ss58 base58: {e}")))?;
    if raw.len() != 35 && raw.len() != 36 {
        return Err(MultichainError::Validation(format!(
            "invalid ss58 length {} (expected 35/36)",
            raw.len()
        )));
    }
    // determine prefix length — inverse of the two-byte encode above
    let (prefix, plen) = if raw[0] & 0b0100_0000 == 0 {
        (raw[0] as u16, 1)
    } else {
        (
            (((raw[0] & 0b0011_1111) as u16) << 2)
                | ((raw[1] as u16) >> 6)
                | (((raw[1] & 0b0011_1111) as u16) << 8),
            2,
        )
    };
    let body_len = raw.len() - plen - 2;
    if body_len != 32 {
        return Err(MultichainError::Validation(format!(
            "ss58 body length {} != 32",
            body_len
        )));
    }
    let mut ctx_input = b"SS58PRE".to_vec();
    ctx_input.extend_from_slice(&raw[..plen + 32]);
    let checksum = blake2_512(&ctx_input);
    if raw[plen + 32..plen + 34] != checksum[..2] {
        return Err(MultichainError::Validation(
            "ss58 checksum mismatch".to_string(),
        ));
    }
    let mut account = [0u8; 32];
    account.copy_from_slice(&raw[plen..plen + 32]);
    Ok((account, prefix))
}

fn blake2_512(data: &[u8]) -> [u8; 64] {
    use blake2::Digest;
    let mut h = blake2::Blake2b512::new();
    h.update(data);
    let out = h.finalize();
    let mut arr = [0u8; 64];
    arr.copy_from_slice(&out);
    arr
}

fn blake2_256(data: &[u8]) -> [u8; 32] {
    use blake2::Digest;
    let mut h = blake2::Blake2b512::new();
    h.update(data);
    let out = h.finalize();
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&out[..32]);
    arr
}

/// Blake2b with 16-byte digest — Substrate `blake2_128` for storage keys.
fn blake2_128(data: &[u8]) -> [u8; 16] {
    use blake2::Digest;
    let mut h = blake2::Blake2b512::new();
    h.update(data);
    let out = h.finalize();
    let mut arr = [0u8; 16];
    arr.copy_from_slice(&out[..16]);
    arr
}

// ---------------------------------------------------------------------------
// SCALE helpers (hand-rolled — minimal surface)
// ---------------------------------------------------------------------------

fn compact_encode(v: u128) -> Vec<u8> {
    if v < 64 {
        vec![(v as u8) << 2]
    } else if v < 1 << 14 {
        (((v as u16) << 2) | 0b01).to_le_bytes().to_vec()
    } else if v < 1 << 30 {
        (((v as u32) << 2) | 0b10).to_le_bytes().to_vec()
    } else {
        let bytes = v.to_le_bytes();
        let mut len = 4;
        while len < 16 && bytes[len] == 0 {
            len += 1;
        }
        let mut out = vec![(((len - 4) << 2) | 0b11) as u8];
        out.extend_from_slice(&bytes[..len]);
        out
    }
}

fn compact_decode(b: &[u8]) -> MultichainResult<(u128, usize)> {
    if b.is_empty() {
        return Err(MultichainError::Validation("compact decode: empty".into()));
    }
    match b[0] & 0b11 {
        0 => Ok(((b[0] >> 2) as u128, 1)),
        1 => Ok((
            (u16::from_le_bytes([b[0], b[1]]) >> 2) as u128,
            2,
        )),
        2 => Ok((
            (u32::from_le_bytes([b[0], b[1], b[2], b[3]]) >> 2) as u128,
            4,
        )),
        _ => {
            let len = ((b[0] >> 2) + 4) as usize;
            let mut v = 0u128;
            for i in 0..len {
                v |= (b[1 + i] as u128) << (8 * i);
            }
            Ok((v, 1 + len))
        }
    }
}

/// Mortal era encoding (period 64, anchored at `current` block).
fn mortal_era(period: u64, current: u64) -> [u8; 2] {
    let period = period.max(4).next_power_of_two();
    let quantize = (period / 16).max(1);
    let phase = (current % period) / quantize * quantize;
    let encoded = ((period.trailing_zeros() as u16 - 1) | ((phase / quantize) as u16) << 4)
        .min(0xffff);
    encoded.to_le_bytes()
}

// ---------------------------------------------------------------------------
// Quantus keypair (ML-DSA-87)
// ---------------------------------------------------------------------------

/// Deterministic Dilithium keypair from a 32-byte seed.
pub struct QuantusKeypair {
    inner: qp_rusty_crystals_dilithium::ml_dsa_87::Keypair,
}

impl QuantusKeypair {
    pub fn from_seed(seed: [u8; 32]) -> Self {
        let mut e = seed;
        Self {
            inner: qp_rusty_crystals_dilithium::ml_dsa_87::Keypair::generate(
                (&mut e).into(),
            ),
        }
    }

    /// 2592-byte ML-DSA-87 public key.
    pub fn public_key(&self) -> Vec<u8> {
        self.inner.public.to_bytes().to_vec()
    }

    /// AccountId32 = poseidon2(pubkey)[0..32] — verified vs qp-dilithium-crypto
    /// `IdentifyAccount::into_account`.
    pub fn account_id(&self) -> [u8; 32] {
        let hash64 = qp_poseidon_core::hash_squeeze_twice(&self.public_key());
        let mut out = [0u8; 32];
        out.copy_from_slice(&hash64[..32]);
        out
    }

    pub fn ss58_address(&self) -> String {
        ss58_encode(&self.account_id(), QUANTUS_SS58_PREFIX)
    }

    /// Sign payload. Returns the 4627-byte ML-DSA-87 signature.
    pub fn sign(&self, payload: &[u8]) -> MultichainResult<Vec<u8>> {
        self.inner
            .sign(payload, None, None)
            .map(|s| s.as_ref().to_vec())
            .map_err(|e| MultichainError::Internal(format!("dilithium sign: {e}")))
    }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/// Quantus adapter speaking JSON-RPC over HTTPS.
pub struct QuantusAdapter {
    rpc_url: String,
    http: reqwest::Client,
    request_id: std::sync::atomic::AtomicU64,
    /// Last finalized block we scanned (watch cursor).
    cursor: std::sync::Mutex<u64>,
}

impl QuantusAdapter {
    /// `rpc_url` empty → `QUANTUS_RPC` env → default public HTTPS RPC.
    pub fn new(rpc_url: impl Into<String>) -> Self {
        let url = rpc_url.into();
        let rpc_url = if url.is_empty() {
            std::env::var("QUANTUS_RPC").unwrap_or_else(|_| DEFAULT_RPC_URL.into())
        } else {
            url
        };
        Self {
            rpc_url,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            request_id: std::sync::atomic::AtomicU64::new(1),
            cursor: std::sync::Mutex::new(0),
        }
    }

    async fn rpc<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> MultichainResult<T> {
        let id = self
            .request_id
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let body = json!({
            "id": id,
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        let resp = self
            .http
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| MultichainError::Internal(format!("quantus rpc {method}: {e}")))?;
        let v: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| MultichainError::Internal(format!("quantus rpc parse: {e}")))?;
        if let Some(err) = v.get("error") {
            return Err(MultichainError::Internal(format!(
                "quantus rpc {method} error: {err}"
            )));
        }
        serde_json::from_value(v["result"].clone())
            .map_err(|e| MultichainError::Internal(format!("quantus rpc decode {method}: {e}")))
    }

    /// ss58 → AccountId32 bytes.
    fn decode_address(to: &Address) -> MultichainResult<[u8; 32]> {
        let (acct, _prefix) = ss58_decode(&to.encoded)?;
        Ok(acct)
    }

    /// Storage key for `System.Account` map:
    /// `twox128("System") ++ twox128("Account") ++ blake2_128_concat(acct32)`.
    fn system_account_key(account32: &[u8; 32]) -> Vec<u8> {
        // twox128("System")/twox128("Account") are string-hash constants —
        // identical on every Substrate chain.
        const SYS: [u8; 16] = [
            0x26, 0xaa, 0x39, 0x4e, 0xea, 0x56, 0x30, 0xe0, 0x7c, 0x48, 0xae, 0x0c, 0x95, 0x58,
            0xce, 0xf7,
        ];
        const ACC: [u8; 16] = [
            0xb9, 0x9d, 0x88, 0x0e, 0xc6, 0x81, 0x79, 0x9c, 0x0c, 0xf3, 0x0e, 0x88, 0x8f, 0xb1,
            0xcb, 0x00,
        ];
        let mut key = Vec::with_capacity(80);
        key.extend_from_slice(&SYS);
        key.extend_from_slice(&ACC);
        key.extend_from_slice(&blake2_128(account32));
        key.extend_from_slice(account32);
        key
    }

    /// Decode `AccountInfo` SCALE: nonce u32, consumers u32, providers u32,
    /// sufficients u32, data { free u128, reserved u128, frozen u128, flags u128 }.
    fn decode_account_info(raw: &[u8]) -> Option<(u32, u128)> {
        if raw.len() < 80 {
            return None;
        }
        let nonce = u32::from_le_bytes(raw[0..4].try_into().ok()?);
        let free = u128::from_le_bytes(raw[16..32].try_into().ok()?);
        Some((nonce, free))
    }

    /// Fetch (spec_version, tx_version, genesis_hash, finalized_head_hash,
    /// finalized_height) needed for a mortal extrinsic.
    async fn signing_context(&self) -> MultichainResult<(u32, u32, [u8; 32], [u8; 32], u64)> {
        let rv: serde_json::Value = self.rpc("state_getRuntimeVersion", json!([])).await?;
        let spec = rv["specVersion"].as_u64().unwrap_or(0) as u32;
        let txv = rv["transactionVersion"].as_u64().unwrap_or(0) as u32;

        let genesis_hex: Option<String> = self.rpc("chain_getBlockHash", json!([0])).await?;
        let genesis_hex = genesis_hex
            .ok_or_else(|| MultichainError::Internal("no genesis hash".into()))?;
        let genesis = decode_hex32(&genesis_hex)?;

        let fin_hex: Option<String> = self.rpc("chain_getFinalizedHead", json!([])).await?;
        let fin_hex = fin_hex.ok_or_else(|| MultichainError::Internal("no finalized".into()))?;
        let fin_hash = decode_hex32(&fin_hex)?;

        let hdr: serde_json::Value = self
            .rpc("chain_getHeader", json!([fin_hex]))
            .await?;
        let height = parse_block_number(&hdr)?;

        Ok((spec, txv, genesis, fin_hash, height))
    }

    /// nonce for an account via `system_accountNextIndex`.
    async fn account_nonce(&self, account32: &[u8; 32]) -> MultichainResult<u32> {
        // system_accountNextIndex takes the SS58 address in older nodes, or
        // the AccountId hex — Planck accepts ss58 string.
        let addr = ss58_encode(account32, QUANTUS_SS58_PREFIX);
        let n: serde_json::Value = self
            .rpc("system_accountNextIndex", json!([addr]))
            .await?;
        n.as_u64()
            .or_else(|| n.as_str().and_then(|s| s.parse().ok()))
            .map(|v| v as u32)
            .ok_or_else(|| MultichainError::Internal(format!("bad nonce resp: {n}")))
    }

    /// Build a signed `balances.transfer_keep_alive` extrinsic.
    ///
    /// Wire layout (spec153):
    ///   body = 0x84 ‖ MultiAddress::Id(from) ‖ SigScheme::Dilithium87 ‖ extra ‖ call
    ///   extra = era ‖ compact(nonce) ‖ compact(tip=0) ‖ metadata_mode(0x00)
    ///   call  = [0x02, 0x03] ‖ MultiAddress::Id(to) ‖ compact(amount)
    ///   sig_payload = call ‖ extra ‖ additional_signed
    ///   additional_signed = spec_ver ‖ tx_ver ‖ genesis ‖ era_checkpoint ‖ 0x00
    ///   (>256B payload → blake2_256 before signing)
    fn build_transfer_extrinsic(
        sender: &QuantusKeypair,
        dest32: &[u8; 32],
        amount: u128,
        nonce: u32,
        spec_ver: u32,
        tx_ver: u32,
        genesis: &[u8; 32],
        checkpoint: &[u8; 32],
        era_anchor_height: u64,
    ) -> MultichainResult<Vec<u8>> {
        // --- call ---
        let mut call = Vec::with_capacity(48);
        call.push(PALLET_BALANCES);
        call.push(3); // transfer_keep_alive
        call.push(0x00); // MultiAddress::Id
        call.extend_from_slice(dest32);
        call.extend_from_slice(&compact_encode(amount));

        // --- extra (tuple order per metadata) ---
        let mut extra = Vec::with_capacity(16);
        // CheckMortality → Era
        extra.extend_from_slice(&mortal_era(64, era_anchor_height));
        // CheckNonce → Compact(u32)
        extra.extend_from_slice(&compact_encode(nonce as u128));
        // ChargeTransactionPayment → tip
        extra.extend_from_slice(&compact_encode(0));
        // CheckMetadataHash → mode Disabled
        extra.push(0x00);

        // --- additional_signed ---
        let mut additional = Vec::with_capacity(80);
        additional.extend_from_slice(&spec_ver.to_le_bytes());
        additional.extend_from_slice(&tx_ver.to_le_bytes());
        additional.extend_from_slice(genesis);
        additional.extend_from_slice(checkpoint);
        additional.push(0x00); // CheckMetadataHash additional = None

        // --- payload to sign ---
        let mut payload = Vec::with_capacity(64 + 16 + 80);
        payload.extend_from_slice(&call);
        payload.extend_from_slice(&extra);
        payload.extend_from_slice(&additional);
        let sig_input = if payload.len() > 256 {
            blake2_256(&payload).to_vec()
        } else {
            payload
        };
        let sig = sender.sign(&sig_input)?;
        let pubkey = sender.public_key();
        let mut sig_with_pub = Vec::with_capacity(7219);
        sig_with_pub.extend_from_slice(&sig);
        sig_with_pub.extend_from_slice(&pubkey);

        // --- extrinsic body ---
        let from_acct = sender.account_id();
        let mut body = Vec::with_capacity(7300);
        body.push(0x84); // v4 + signed bit
        body.push(0x00); // MultiAddress::Id
        body.extend_from_slice(&from_acct);
        body.push(0x00); // DilithiumSignatureScheme::Dilithium variant
        body.extend_from_slice(&sig_with_pub);
        body.extend_from_slice(&extra);
        body.extend_from_slice(&call);

        // --- outer: compact_len(body) ‖ body ---
        let mut ext = Vec::with_capacity(body.len() + 4);
        ext.extend_from_slice(&compact_encode(body.len() as u128));
        ext.extend_from_slice(&body);
        Ok(ext)
    }

    /// Parse one extrinsic blob → (pallet, call, args-offset, signed, sender).
    /// Returns None for unsigned/broken extrinsics.
    fn parse_extrinsic(body: &[u8]) -> Option<ParsedExtrinsic> {
        if body.is_empty() {
            return None;
        }
        let mut pos = 0usize;
        let ver = *body.get(pos)?; // version byte
        pos += 1;
        let signed = ver & 0x80 != 0;
        if signed {
            // MultiAddress
            let addr_variant = *body.get(pos)?;
            pos += 1;
            match addr_variant {
                0x00 => pos += 32,
                0x01 => {
                    // Index → compact
                    let (_, n) = compact_decode(&body[pos..]).ok()?;
                    pos += n;
                }
                0x02 => {
                    let (l, n) = compact_decode(&body[pos..]).ok()?;
                    pos += n + l as usize;
                }
                0x03 => pos += 32,
                0x04 => pos += 20,
                _ => return None,
            }
            // signature: DilithiumSignatureScheme enum — variant byte + payload
            let sig_variant = *body.get(pos)?;
            pos += 1;
            // Dilithium87 = variant 0 → 7219B; Dilithium65 = variant 1 → ~5261B
            let sig_len = match sig_variant {
                0x00 => 7219,
                0x01 => 5261,
                _ => return None,
            };
            pos += sig_len;
            // extra
            // Era: first byte 0x00 → immortal (1B), else mortal (2B)
            let era_len = if *body.get(pos)? == 0x00 { 1 } else { 2 };
            pos += era_len;
            // nonce compact
            let (_, n) = compact_decode(&body[pos..]).ok()?;
            pos += n;
            // tip compact
            let (_, n) = compact_decode(&body[pos..]).ok()?;
            pos += n;
            // CheckMetadataHash mode byte
            pos += 1;
        }
        let pallet = *body.get(pos)?;
        let call_idx = *body.get(pos + 1)?;
        Some(ParsedExtrinsic {
            pallet,
            call_idx,
            args_offset: pos + 2,
            signed,
        })
    }

    /// Decode a `balances.transfer_*` call args → (dest32, amount).
    fn parse_transfer_args(args: &[u8], call_idx: u8) -> Option<([u8; 32], u128)> {
        match call_idx {
            // transfer_allow_death { dest, value }, transfer_keep_alive { dest, value }
            0 | 3 => {
                // MultiAddress dest
                if args.is_empty() || args[0] != 0x00 {
                    return None;
                }
                let dest: [u8; 32] = args.get(1..33)?.try_into().ok()?;
                let (amount, _) = compact_decode(&args[33..]).ok()?;
                Some((dest, amount))
            }
            // transfer_all { dest, keep_alive } — amount must come from events;
            // skip for now (rare in bridge deposits)
            4 => None,
            _ => None,
        }
    }
}

struct ParsedExtrinsic {
    pallet: u8,
    call_idx: u8,
    args_offset: usize,
    signed: bool,
}

#[async_trait]
impl ChainAdapter for QuantusAdapter {
    fn name(&self) -> &str {
        "quantus"
    }

    fn family(&self) -> ChainFamily {
        ChainFamily::Substrate
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        let h: serde_json::Value = self.rpc("system_health", json!([])).await?;
        Ok(h["isSyncing"].as_bool() == Some(false))
    }

    /// Watch the bridge deposit addresses configured via
    /// `QUANTUS_DEPOSIT_ADDRESSES` (comma-separated ss58).
    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        let list = std::env::var("QUANTUS_DEPOSIT_ADDRESSES").unwrap_or_default();
        let mut addrs = Vec::new();
        for s in list.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
            let (acct, _prefix) = ss58_decode(s)?;
            addrs.push(Address::new(ChainId::Quantus, acct.to_vec(), s)?);
        }
        if addrs.is_empty() {
            return Ok(Vec::new());
        }
        self.watch_addresses(&addrs).await
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        let head: String = self.rpc("chain_getFinalizedHead", json!([])).await?;
        let hdr: serde_json::Value = self.rpc("chain_getHeader", json!([head])).await?;
        parse_block_number(&hdr)
    }

    async fn confirmations(&self, tx_hash: &Hash) -> MultichainResult<u64> {
        // Substrate doesn't index tx→block; scan a bounded finalized range
        // backwards. For bridge use-cases we only confirm deposits we watched,
        // so a 128-block lookback is plenty.
        let target = format!("0x{}", hex::encode(tx_hash.0));
        let mut head_hex: String = self.rpc("chain_getFinalizedHead", json!([])).await?;
        let head_hdr: serde_json::Value =
            self.rpc("chain_getHeader", json!([head_hex])).await?;
        let mut num = parse_block_number(&head_hdr)?;
        for _ in 0..128u64 {
            let block: serde_json::Value =
                self.rpc("chain_getBlock", json!([head_hex])).await?;
            let exts = block["block"]["extrinsics"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            for ext in &exts {
                if let Some(hexstr) = ext.as_str() {
                    if let Ok(raw) = hex::decode(hexstr.trim_start_matches("0x")) {
                        if format!("0x{}", hex::encode(blake2_256(&raw))) == target {
                            let fin = self.current_height().await?;
                            return Ok(fin.saturating_sub(num) + 1);
                        }
                    }
                }
            }
            // step to parent
            let parent = block["block"]["header"]["parentHash"]
                .as_str()
                .ok_or_else(|| MultichainError::Internal("no parentHash".into()))?;
            if num == 0 {
                break;
            }
            head_hex = parent.to_string();
            num -= 1;
        }
        Ok(0)
    }

    async fn watch_addresses(&self, addresses: &[Address]) -> MultichainResult<Vec<DepositEvent>> {
        let mut wanted: std::collections::HashMap<[u8; 32], &Address> =
            std::collections::HashMap::new();
        for a in addresses {
            if let Ok((acct, _)) = ss58_decode(&a.encoded) {
                wanted.insert(acct, a);
            }
        }
        if wanted.is_empty() {
            return Ok(Vec::new());
        }

        let finalized = self.current_height().await?;
        let from = {
            let mut c = self.cursor.lock().unwrap();
            let start = if *c == 0 {
                finalized.saturating_sub(64)
            } else {
                *c + 1
            };
            *c = finalized;
            start
        };

        let mut events = Vec::new();
        for num in from..=finalized {
            let hash_hex: Option<String> =
                self.rpc("chain_getBlockHash", json!([num])).await?;
            let Some(hash_hex) = hash_hex else { continue };
            let block: serde_json::Value =
                self.rpc("chain_getBlock", json!([hash_hex])).await?;
            let exts = block["block"]["extrinsics"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            for ext_hex in &exts {
                let Some(hexstr) = ext_hex.as_str() else { continue };
                let Ok(raw) = hex::decode(hexstr.trim_start_matches("0x")) else {
                    continue;
                };
                // strip outer compact length
                let (_decl_len, hdr) = compact_decode(&raw).unwrap_or((0, 0));
                if hdr == 0 {
                    continue;
                }
                let body = &raw[hdr..];
                let Some(parsed) = Self::parse_extrinsic(body) else {
                    continue;
                };
                if !parsed.signed || parsed.pallet != PALLET_BALANCES {
                    continue;
                }
                let args = &body[parsed.args_offset..];
                if let Some((dest, amount)) = Self::parse_transfer_args(args, parsed.call_idx) {
                    if let Some(addr) = wanted.get(&dest) {
                        events.push(DepositEvent {
                            chain: ChainId::Quantus,
                            tx_hash: Hash(blake2_256(&raw)),
                            recipient: (*addr).clone(),
                            amount: Amount(amount),
                            memo: None,
                            confirmations: finalized - num + 1,
                            asset: None,
                        });
                    }
                }
            }
        }
        Ok(events)
    }

    async fn send_payment(&self, to: &Address, amount: Amount) -> MultichainResult<Hash> {
        let dest32 = Self::decode_address(to)?;
        // Signing key from env: QUANTUS_SEED hex (32B) — operator hot wallet.
        let seed_hex = std::env::var("QUANTUS_SEED")
            .map_err(|_| MultichainError::Config("QUANTUS_SEED not set".into()))?;
        let seed_raw = seed_hex.trim_start_matches("0x");
        let seed_bytes = hex::decode(seed_raw)
            .map_err(|e| MultichainError::Config(format!("bad QUANTUS_SEED hex: {e}")))?;
        if seed_bytes.len() != 32 {
            return Err(MultichainError::Config(format!(
                "QUANTUS_SEED must be 32 bytes, got {}",
                seed_bytes.len()
            )));
        }
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&seed_bytes);
        let keypair = QuantusKeypair::from_seed(seed);

        let sender_acct = keypair.account_id();
        let nonce = self.account_nonce(&sender_acct).await?;
        let (spec, txv, genesis, fin_hash, fin_height) = self.signing_context().await?;

        let ext = Self::build_transfer_extrinsic(
            &keypair, &dest32, amount.0, nonce, spec, txv, &genesis, &fin_hash, fin_height,
        )?;
        let ext_hex = format!("0x{}", hex::encode(&ext));
        let tx_hash: String = self
            .rpc("author_submitExtrinsic", json!([ext_hex]))
            .await
            .map_err(|e| MultichainError::Internal(format!("submit: {e}")))?;
        let hash_bytes = decode_hex32(&tx_hash)?;
        Ok(Hash(hash_bytes))
    }

    async fn execute_outbound(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        self.send_payment(&transfer.target.address, transfer.target.amount)
            .await
    }

    async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        let acct32 = Self::decode_address(address)?;
        let key = Self::system_account_key(&acct32);
        let key_hex = format!("0x{}", hex::encode(key));
        let storage: Option<String> = self
            .rpc("state_getStorage", json!([key_hex]))
            .await?;
        match storage {
            Some(hexstr) => {
                let raw = hex::decode(hexstr.trim_start_matches("0x"))
                    .map_err(|e| MultichainError::Internal(format!("account decode: {e}")))?;
                let (_nonce, free) = Self::decode_account_info(&raw)
                    .ok_or_else(|| MultichainError::Internal("account info decode".into()))?;
                Ok(Amount(free))
            }
            None => Ok(Amount(0)),
        }
    }
}

fn decode_hex32(s: &str) -> MultichainResult<[u8; 32]> {
    let raw = hex::decode(s.trim_start_matches("0x"))
        .map_err(|e| MultichainError::Validation(format!("hex: {e}")))?;
    raw.try_into()
        .map_err(|_| MultichainError::Validation("expected 32 bytes".into()))
}

fn parse_block_number(hdr: &serde_json::Value) -> MultichainResult<u64> {
    let hex_num = hdr["number"]
        .as_str()
        .ok_or_else(|| MultichainError::Internal("no block number".into()))?;
    u64::from_str_radix(hex_num.trim_start_matches("0x"), 16)
        .map_err(|e| MultichainError::Internal(format!("block number: {e}")))
}



#[cfg(test)]
mod tests {
    use super::*;

    /// Spike-verified: seed [7u8;32] → account32 `4b728e…52707` on live chain.
    #[test]
    fn quantus_account_derivation_matches_spike() {
        let kp = QuantusKeypair::from_seed([7u8; 32]);
        let acct = kp.account_id();
        assert_eq!(
            hex::encode(acct),
            "4b728ed7de0932a1efedca8fd5919fcf5a672ce2d23aa3a83f5944bb15752707"
        );
    }

    #[test]
    fn ss58_roundtrip() {
        let acct = [42u8; 32];
        let addr = ss58_encode(&acct, QUANTUS_SS58_PREFIX);
        let (decoded, prefix) = ss58_decode(&addr).unwrap();
        assert_eq!(decoded, acct);
        assert_eq!(prefix, QUANTUS_SS58_PREFIX);
    }

    #[test]
    fn ss58_decode_rejects_bad_checksum() {
        let acct = [42u8; 32];
        let mut addr = ss58_encode(&acct, QUANTUS_SS58_PREFIX);
        // flip last char
        let last = addr.pop().unwrap();
        addr.push(if last == 'a' { 'b' } else { 'a' });
        assert!(ss58_decode(&addr).is_err());
    }

    #[test]
    fn compact_encoding_boundaries() {
        assert_eq!(compact_encode(0), vec![0x00]);
        assert_eq!(compact_encode(63), vec![0xfc]);
        assert_eq!(compact_encode(64), vec![0x01, 0x01]);
        assert_eq!(compact_encode(16383), vec![0xfd, 0xff]);
        assert_eq!(compact_encode(16384), vec![0x02, 0x00, 0x01, 0x00]);
    }

    #[test]
    fn extrinsic_has_dilithium_signature_layout() {
        let kp = QuantusKeypair::from_seed([9u8; 32]);
        let dest = [3u8; 32];
        let genesis = [0u8; 32];
        let ckpt = [0u8; 32];
        let ext = QuantusAdapter::build_transfer_extrinsic(
            &kp, &dest, 1_000_000_000_000, 0, 153, 6, &genesis, &ckpt, 100,
        )
        .unwrap();
        // outer: compact len (2-3B) + 0x84 + addr(33) + sig_variant(1) + 7219 + extra + call
        let (_l, hdr) = compact_decode(&ext).unwrap();
        let body = &ext[hdr..];
        assert_eq!(body[0], 0x84);
        assert_eq!(body[1], 0x00); // MultiAddress::Id
        assert_eq!(&body[2..34], kp.account_id().as_slice());
        assert_eq!(body[34], 0x00); // Dilithium variant
        // sig at body[35..35+7219]; body = 1+33+1+7219+extra(5)+call(~40)
        assert_eq!(body.len(), 1 + 33 + 1 + 7219 + 5 + 40);
    }

    /// Live read-only probe against Planck mainnet (or `QUANTUS_RPC`).
    /// Run: `QUANTUS_LIVE=1 cargo test -p zion-multichain --lib quantus_live -- --ignored --nocapture`
    #[tokio::test]
    #[ignore = "requires network + QUANTUS_LIVE=1"]
    async fn quantus_live_readonly() {
        if std::env::var("QUANTUS_LIVE").ok().as_deref() != Some("1") {
            return;
        }
        let adapter = QuantusAdapter::new("");
        assert!(adapter.health_check().await.unwrap());
        let h = adapter.current_height().await.unwrap();
        eprintln!("finalized height: {h}");
        assert!(h > 1_000_000);

        // balance() on a spike-derived account (may be 0 — exercises the
        // full ss58→storage-key→AccountInfo decode path on live chain)
        let kp = QuantusKeypair::from_seed([7u8; 32]);
        let addr = Address::new(ChainId::Quantus, kp.account_id().to_vec(), kp.ss58_address())
            .unwrap();
        let bal = adapter.balance(&addr).await.unwrap();
        eprintln!("balance({}): {} planks", kp.ss58_address(), bal.0);
    }
}
