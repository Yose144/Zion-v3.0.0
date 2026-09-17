//! Bitcoin-side HTLC (P2WSH) for WARP Beta ZION↔BTC atomic swaps.
//!
//! Witness script:
//! ```text
//! OP_IF
//!     OP_SHA256 <H> OP_EQUALVERIFY <claimant_pk> OP_CHECKSIG
//! OP_ELSE
//!     <cltv_timeout> OP_CHECKLOCKTIMEVERIFY OP_DROP <refund_pk> OP_CHECKSIG
//! OP_ENDIF
//! ```
//!
//! The hashlock `H` is `SHA-256(preimage)` — identical to the ZION L1 native
//! HTLC (`zion_core::utxo`), so a single 32-byte preimage opens both legs.
//!
//! Witness layout:
//!   claim:  [sig, preimage, OP_TRUE, witness_script]
//!   refund: [sig, <empty>,   witness_script]
//!
//! Timeout on the BTC side is a CLTV **block height**; the ZION side uses a
//! UNIX timestamp. `cltv_from_zion_timeout` converts between the two with a
//! configurable safety margin so the BTC leg always expires *later*.

use crate::warp::btc_signer::BtcSigner;
use crate::warp::error::{WarpError, WarpResult};

use bitcoin::blockdata::opcodes::all as opcodes;
use bitcoin::blockdata::script::{Builder, Instruction, PushBytesBuf};
use bitcoin::secp256k1::{Message, Secp256k1};
use bitcoin::sighash::{EcdsaSighashType, SighashCache};
use bitcoin::{
    absolute::LockTime, consensus::encode::serialize, transaction::Version, Address, Amount,
    Network, OutPoint, PrivateKey, PublicKey, ScriptBuf, Sequence, Transaction, TxIn, TxOut, Txid,
    Witness,
};
use std::str::FromStr;
use tracing::info;

fn err(reason: impl Into<String>) -> WarpError {
    WarpError::AdapterError {
        chain: "bitcoin".into(),
        reason: reason.into(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BtcHtlc — script + derived P2WSH address
// ─────────────────────────────────────────────────────────────────────────────

/// A single Bitcoin HTLC instance (one swap leg).
#[derive(Debug, Clone)]
pub struct BtcHtlc {
    /// The full witness script (never revealed on-chain until spend).
    pub witness_script: ScriptBuf,
    /// P2WSH address receiving the locked funds.
    pub address: Address,
    /// SHA-256 hashlock shared with the ZION leg.
    pub hashlock: [u8; 32],
    /// Compressed secp256k1 pubkey allowed to claim with the preimage.
    pub claimant: PublicKey,
    /// Compressed secp256k1 pubkey allowed to refund after `cltv_timeout`.
    pub refund: PublicKey,
    /// CLTV expiry as **block height**.
    pub cltv_timeout: u32,
}

impl BtcHtlc {
    /// Build a new HTLC for `network` from swap parameters.
    pub fn new(
        hashlock: [u8; 32],
        claimant: PublicKey,
        refund: PublicKey,
        cltv_timeout: u32,
        network: Network,
    ) -> WarpResult<Self> {
        if !claimant.compressed || !refund.compressed {
            return Err(err("HTLC pubkeys must be compressed"));
        }
        if cltv_timeout == 0 {
            return Err(err("cltv_timeout must be > 0"));
        }
        let witness_script = build_witness_script(&hashlock, &claimant, &refund, cltv_timeout);
        let address = Address::p2wsh(&witness_script, network);
        Ok(Self {
            witness_script,
            address,
            hashlock,
            claimant,
            refund,
            cltv_timeout,
        })
    }

    /// Parse a counterparty-provided witness script and re-derive the P2WSH
    /// address. Rejects any script that does not match the canonical layout.
    pub fn from_witness_script(script: &[u8], network: Network) -> WarpResult<Self> {
        let script_buf = ScriptBuf::from_bytes(script.to_vec());
        let ins: Vec<Instruction> = script_buf
            .instructions_minimal()
            .collect::<Result<_, _>>()
            .map_err(|e| err(format!("script decode: {e}")))?;

        // Canonical layout — see module doc.
        if ins.len() != 13 {
            return Err(err(format!("HTLC script has {} ops, expected 13", ins.len())));
        }

        fn op(ins: &Instruction) -> Option<bitcoin::blockdata::opcodes::Opcode> {
            match ins {
                Instruction::Op(o) => Some(*o),
                _ => None,
            }
        }
        fn push<'a>(ins: &Instruction<'a>) -> Option<&'a [u8]> {
            match ins {
                Instruction::PushBytes(b) => Some(b.as_bytes()),
                _ => None,
            }
        }

        if op(&ins[0]) != Some(opcodes::OP_IF)
            || op(&ins[1]) != Some(opcodes::OP_SHA256)
            || op(&ins[3]) != Some(opcodes::OP_EQUALVERIFY)
            || op(&ins[5]) != Some(opcodes::OP_CHECKSIG)
            || op(&ins[6]) != Some(opcodes::OP_ELSE)
            || op(&ins[8]) != Some(opcodes::OP_CLTV)
            || op(&ins[9]) != Some(opcodes::OP_DROP)
            || op(&ins[11]) != Some(opcodes::OP_CHECKSIG)
            || op(&ins[12]) != Some(opcodes::OP_ENDIF)
        {
            return Err(err("script is not a canonical WARP HTLC"));
        }

        let hashlock: [u8; 32] = push(&ins[2])
            .and_then(|b| b.try_into().ok())
            .ok_or_else(|| err("hashlock must be 32 bytes"))?;
        let claimant = PublicKey::from_slice(
            push(&ins[4]).ok_or_else(|| err("missing claimant pubkey"))?,
        )
        .map_err(|e| err(format!("claimant pubkey: {e}")))?;
        let refund = PublicKey::from_slice(
            push(&ins[10]).ok_or_else(|| err("missing refund pubkey"))?,
        )
        .map_err(|e| err(format!("refund pubkey: {e}")))?;

        // Timeout is a minimally-encoded script number (ins[7]).
        let timeout_bytes = push(&ins[7]).ok_or_else(|| err("missing cltv timeout"))?;
        let cltv_timeout = script_num_to_u32(timeout_bytes)
            .ok_or_else(|| err("cltv timeout out of range"))?;

        let htlc = Self::new(hashlock, claimant, refund, cltv_timeout, network)?;
        // Round-trip guard: rebuilt script must be byte-identical to the input.
        if htlc.witness_script.as_bytes() != script {
            return Err(err("non-canonical HTLC script encoding"));
        }
        Ok(htlc)
    }
}

/// Build the canonical WARP HTLC witness script.
pub fn build_witness_script(
    hashlock: &[u8; 32],
    claimant: &PublicKey,
    refund: &PublicKey,
    cltv_timeout: u32,
) -> ScriptBuf {
    let h = PushBytesBuf::try_from(hashlock.to_vec())
        .expect("32-byte hashlock always fits PushBytes");
    Builder::new()
        .push_opcode(opcodes::OP_IF)
        .push_opcode(opcodes::OP_SHA256)
        .push_slice(h)
        .push_opcode(opcodes::OP_EQUALVERIFY)
        .push_key(claimant)
        .push_opcode(opcodes::OP_CHECKSIG)
        .push_opcode(opcodes::OP_ELSE)
        .push_int(cltv_timeout as i64)
        .push_opcode(opcodes::OP_CLTV)
        .push_opcode(opcodes::OP_DROP)
        .push_key(refund)
        .push_opcode(opcodes::OP_CHECKSIG)
        .push_opcode(opcodes::OP_ENDIF)
        .into_script()
}

/// Decode a minimally-encoded script number (CLTV timeout) to u32.
/// Script numbers are little-endian with the sign bit in the MSB of the last
/// byte; timeouts are positive by construction, so the sign bit is masked off.
fn script_num_to_u32(b: &[u8]) -> Option<u32> {
    if b.is_empty() || b.len() > 5 {
        return None;
    }
    let mut v: u64 = 0;
    for (i, &byte) in b.iter().enumerate() {
        v |= (byte as u64) << (8 * i);
    }
    // Mask the sign bit of the last byte.
    v &= !(0x80u64 << (8 * (b.len() - 1)));
    u32::try_from(v).ok()
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeout conversion — ZION timestamp → BTC CLTV height
// ─────────────────────────────────────────────────────────────────────────────

/// Default safety margin between the two legs: 6 h ≈ 36 BTC blocks.
pub const DEFAULT_MARGIN_BLOCKS: u32 = 36;
/// Assumed BTC block interval for timestamp→height conversion.
pub const BTC_BLOCK_SECS: u64 = 600;

/// Convert a ZION HTLC timeout (UNIX seconds) to a BTC CLTV block height such
/// that the **BTC leg expires later** than the ZION leg.
///
/// `zion_timeout_ts` — ZION HTLC timeout (u64 UNIX secs, as in `utxo.rs`)
/// `now_ts`          — current UNIX time
/// `btc_tip`         — current BTC tip height
/// `margin_blocks`   — extra BTC blocks of safety on top
pub fn cltv_from_zion_timeout(
    zion_timeout_ts: u64,
    now_ts: u64,
    btc_tip: u64,
    margin_blocks: u32,
) -> u32 {
    let remaining = zion_timeout_ts.saturating_sub(now_ts);
    let zion_blocks = remaining.div_ceil(BTC_BLOCK_SECS) as u32;
    let target = btc_tip.saturating_add(zion_blocks as u64 + margin_blocks as u64);
    target.min(u32::MAX as u64) as u32
}

// ─────────────────────────────────────────────────────────────────────────────
// Spending
// ─────────────────────────────────────────────────────────────────────────────

/// Which script branch to spend through.
#[derive(Debug, Clone)]
pub enum HtlcPath {
    /// Claim branch — requires the 32-byte preimage (SHA-256 == hashlock).
    Claim([u8; 32]),
    /// Refund branch — requires tx.lock_time >= cltv_timeout.
    Refund,
}

/// An HTLC UTXO to spend: the funding outpoint plus its value.
#[derive(Debug, Clone)]
pub struct HtlcUtxo {
    pub outpoint: OutPoint,
    pub value_sats: u64,
}

/// Estimated vsize of a 1-in/1-out HTLC spend (conservative upper bound).
/// witness ≈ sig(73) + preimage(33) + selector(1) + script(~110) + overhead.
fn spend_vbytes(path: &HtlcPath) -> u64 {
    let wit = match path {
        HtlcPath::Claim(_) => 225u64,
        HtlcPath::Refund => 195u64,
    };
    10 + 41 + 31 + wit.div_ceil(4)
}

/// Build and sign a transaction spending an HTLC output to `dest`.
///
/// `signing_key` must be the claimant key for `Claim` and the refund key for
/// `Refund`. The BTC network is taken from `dest` (already network-checked).
pub fn spend_htlc_tx(
    utxo: &HtlcUtxo,
    htlc: &BtcHtlc,
    path: HtlcPath,
    dest: &Address,
    signing_key: &PrivateKey,
    feerate_sats_vb: u64,
) -> WarpResult<Transaction> {
    let fee = feerate_sats_vb.saturating_mul(spend_vbytes(&path));
    if utxo.value_sats <= fee + 546 {
        return Err(err(format!(
            "HTLC value {} sats too small to spend (fee {fee})",
            utxo.value_sats
        )));
    }

    let (lock_time, sequence) = match path {
        HtlcPath::Claim(_) => (LockTime::ZERO, Sequence::MAX),
        HtlcPath::Refund => (
            LockTime::from_consensus(htlc.cltv_timeout),
            // non-final sequence required for CLTV evaluation
            Sequence::ENABLE_LOCKTIME_NO_RBF,
        ),
    };

    let mut tx = Transaction {
        version: Version::TWO,
        lock_time,
        input: vec![TxIn {
            previous_output: utxo.outpoint,
            script_sig: ScriptBuf::default(),
            sequence,
            witness: Witness::default(),
        }],
        output: vec![TxOut {
            value: Amount::from_sat(utxo.value_sats - fee),
            script_pubkey: dest.script_pubkey(),
        }],
    };

    // BIP143 segwit-v0 sighash over the witness script.
    let sighash = SighashCache::new(&tx)
        .p2wsh_signature_hash(
            0,
            &htlc.witness_script,
            Amount::from_sat(utxo.value_sats),
            EcdsaSighashType::All,
        )
        .map_err(|e| err(format!("p2wsh sighash: {e}")))?;

    let secp = Secp256k1::new();
    let msg =
        Message::from_digest_slice(sighash.as_ref()).map_err(|e| err(format!("sighash msg: {e}")))?;
    let sig = secp.sign_ecdsa(&msg, &signing_key.inner);
    let mut sig_bytes = sig.serialize_der().to_vec();
    sig_bytes.push(EcdsaSighashType::All.to_u32() as u8);

    let witness_items: Vec<Vec<u8>> = match &path {
        HtlcPath::Claim(preimage) => vec![
            sig_bytes,
            preimage.to_vec(),
            vec![0x01], // OP_TRUE → IF branch
            htlc.witness_script.as_bytes().to_vec(),
        ],
        HtlcPath::Refund => vec![
            sig_bytes,
            Vec::new(), // OP_FALSE → ELSE branch
            htlc.witness_script.as_bytes().to_vec(),
        ],
    };
    tx.input[0].witness = Witness::from_slice(&witness_items);

    Ok(tx)
}

/// Extract the preimage from a claim-path witness of a spend tx.
/// Returns `Some(preimage)` only if the last witness item parses as a
/// canonical WARP HTLC and the branch selector is truthy.
pub fn extract_preimage(witness: &Witness) -> Option<[u8; 32]> {
    let items: Vec<&[u8]> = witness.iter().collect();
    if items.len() != 4 {
        return None;
    }
    let script = items[3];
    // selector must be OP_TRUE (single 0x01 byte)
    if items[2] != [0x01] {
        return None;
    }
    // verify script shape (any network — script parse is network-independent)
    BtcHtlc::from_witness_script(script, Network::Bitcoin).ok()?;
    items[1].try_into().ok()
}

// ─────────────────────────────────────────────────────────────────────────────
// BtcSigner extension — lock + spend convenience methods
// ─────────────────────────────────────────────────────────────────────────────

impl BtcSigner {
    /// Lock `amount_sats` into the HTLC address. Returns (txid, vout, value).
    pub async fn lock_htlc(
        &self,
        client: &reqwest::Client,
        api_url: &str,
        htlc: &BtcHtlc,
        amount_sats: u64,
    ) -> WarpResult<(String, u32, u64)> {
        let feerate = std::env::var("WARP_BTC_FEERATE")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(5);

        let utxos =
            crate::warp::btc_signer::fetch_utxos(client, api_url, &self.address().to_string())
                .await?;
        let confirmed: Vec<_> = utxos.into_iter().filter(|u| u.is_confirmed()).collect();
        if confirmed.is_empty() {
            return Err(err("no confirmed UTXOs for relay wallet"));
        }
        let (selected, fee) =
            crate::warp::btc_signer::select_utxos(&confirmed, amount_sats, feerate)?;
        let total_in: u64 = selected.iter().map(|u| u.value).sum();
        let change = total_in - amount_sats - fee;

        // Build funding tx: P2WPKH inputs → [P2WSH htlc out, change].
        let inputs: Vec<TxIn> = selected
            .iter()
            .map(|u| {
                let txid = Txid::from_str(&u.txid).expect("valid txid");
                TxIn {
                    previous_output: OutPoint::new(txid, u.vout),
                    script_sig: ScriptBuf::default(),
                    sequence: Sequence::MAX,
                    witness: Witness::default(),
                }
            })
            .collect();
        let mut outputs = vec![TxOut {
            value: Amount::from_sat(amount_sats),
            script_pubkey: htlc.address.script_pubkey(),
        }];
        if change >= 546 {
            outputs.push(TxOut {
                value: Amount::from_sat(change),
                script_pubkey: self.address().script_pubkey(),
            });
        }
        let mut tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output: outputs,
        };

        // Sign each P2WPKH input with the relay key.
        let secp = Secp256k1::new();
        let relay_spk = self.address().script_pubkey();
        for (i, u) in selected.iter().enumerate() {
            let sighash = SighashCache::new(&tx)
                .p2wpkh_signature_hash(
                    i,
                    &relay_spk,
                    Amount::from_sat(u.value),
                    EcdsaSighashType::All,
                )
                .map_err(|e| err(format!("sighash input {i}: {e}")))?;
            let msg = Message::from_digest_slice(sighash.as_ref())
                .map_err(|e| err(format!("msg {i}: {e}")))?;
            let sig = secp.sign_ecdsa(&msg, &self.private_key_inner().inner);
            let mut sig_bytes = sig.serialize_der().to_vec();
            sig_bytes.push(EcdsaSighashType::All.to_u32() as u8);
            tx.input[i].witness =
                Witness::from_slice(&[sig_bytes.as_slice(), self.public_key_bytes().as_slice()]);
        }

        let raw_hex = hex::encode(serialize(&tx));
        let txid = crate::warp::btc_signer::broadcast_tx(client, api_url, &raw_hex).await?;
        info!("[WARP][bitcoin] HTLC lock broadcast: {} ({} sats)", txid, amount_sats);
        Ok((txid, 0, amount_sats))
    }

    /// Claim an HTLC output with the preimage (signer must be the claimant key).
    pub async fn claim_htlc(
        &self,
        client: &reqwest::Client,
        api_url: &str,
        utxo: &HtlcUtxo,
        htlc: &BtcHtlc,
        preimage: [u8; 32],
        dest: &Address,
    ) -> WarpResult<String> {
        let feerate = std::env::var("WARP_BTC_FEERATE")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(5);
        let tx = spend_htlc_tx(
            utxo,
            htlc,
            HtlcPath::Claim(preimage),
            dest,
            self.private_key_inner(),
            feerate,
        )?;
        let raw_hex = hex::encode(serialize(&tx));
        let txid = crate::warp::btc_signer::broadcast_tx(client, api_url, &raw_hex).await?;
        info!("[WARP][bitcoin] HTLC claim broadcast: {}", txid);
        Ok(txid)
    }

    /// Refund an HTLC output after CLTV expiry (signer must be the refund key).
    pub async fn refund_htlc(
        &self,
        client: &reqwest::Client,
        api_url: &str,
        utxo: &HtlcUtxo,
        htlc: &BtcHtlc,
        dest: &Address,
    ) -> WarpResult<String> {
        let feerate = std::env::var("WARP_BTC_FEERATE")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(5);
        let tx = spend_htlc_tx(
            utxo,
            htlc,
            HtlcPath::Refund,
            dest,
            self.private_key_inner(),
            feerate,
        )?;
        let raw_hex = hex::encode(serialize(&tx));
        let txid = crate::warp::btc_signer::broadcast_tx(client, api_url, &raw_hex).await?;
        info!("[WARP][bitcoin] HTLC refund broadcast: {}", txid);
        Ok(txid)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use rand::RngCore;
    use sha2::{Digest as _, Sha256};

    fn test_signer() -> BtcSigner {
        BtcSigner::from_wif("KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn", Network::Bitcoin)
            .unwrap()
    }

    fn other_key() -> PrivateKey {
        // Deterministic second key (secret = 0x02..02), compressed.
        let sk = bitcoin::secp256k1::SecretKey::from_slice(&[0x02u8; 32]).unwrap();
        PrivateKey::new(sk, Network::Bitcoin)
    }

    fn sample_htlc() -> (BtcHtlc, [u8; 32]) {
        let mut preimage = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut preimage);
        let hashlock: [u8; 32] = Sha256::digest(preimage).into();
        let signer = test_signer();
        let other = other_key();
        let secp = Secp256k1::new();
        let htlc = BtcHtlc::new(
            hashlock,
            other.public_key(&secp),       // claimant = counterparty
            *signer.public_key_btc(),      // refund = us
            850_000,
            Network::Bitcoin,
        )
        .unwrap();
        (htlc, preimage)
    }

    #[test]
    fn script_build_parse_roundtrip() {
        let (htlc, _) = sample_htlc();
        let parsed = BtcHtlc::from_witness_script(&htlc.witness_script.as_bytes().to_vec(), Network::Bitcoin)
            .unwrap();
        assert_eq!(parsed.hashlock, htlc.hashlock);
        assert_eq!(parsed.claimant, htlc.claimant);
        assert_eq!(parsed.refund, htlc.refund);
        assert_eq!(parsed.cltv_timeout, 850_000);
        assert_eq!(parsed.address, htlc.address);
    }

    #[test]
    fn p2wsh_address_is_bech32() {
        let (htlc, _) = sample_htlc();
        let addr = htlc.address.to_string();
        assert!(addr.starts_with("bc1q"), "addr={addr}");
        // P2WSH addresses are 62 chars (32-byte program)
        assert_eq!(addr.len(), 62);
    }

    #[test]
    fn script_num_decodes_height() {
        // 850000 = 0x0CF850 → LE bytes 50 F8 0C
        assert_eq!(script_num_to_u32(&[0x50, 0xF8, 0x0C]), Some(850_000));
        assert_eq!(script_num_to_u32(&[0x01]), Some(1));
        assert_eq!(script_num_to_u32(&[]), None);
    }

    #[test]
    fn cltv_conversion_expires_later() {
        // zion timeout in 24h → btc height should be tip + 144 + margin
        let now = 1_800_000_000u64;
        let zion_t = now + 86_400;
        let h = cltv_from_zion_timeout(zion_t, now, 850_000, DEFAULT_MARGIN_BLOCKS);
        assert_eq!(h, 850_000 + 144 + 36);
    }

    #[test]
    fn claim_tx_structure() {
        let (htlc, preimage) = sample_htlc();
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(Txid::from_str(&"ab".repeat(32)).unwrap(), 0),
            value_sats: 100_000,
        };
        let dest = test_signer().address().clone();
        let tx = spend_htlc_tx(
            &utxo,
            &htlc,
            HtlcPath::Claim(preimage),
            &dest,
            test_signer().private_key_inner(),
            5,
        )
        .unwrap();
        assert_eq!(tx.input.len(), 1);
        assert_eq!(tx.output.len(), 1);
        assert_eq!(tx.lock_time, LockTime::ZERO);
        let wit: Vec<Vec<u8>> = tx.input[0].witness.iter().map(|b| b.to_vec()).collect();
        assert_eq!(wit.len(), 4);
        assert_eq!(wit[1], preimage.to_vec());
        assert_eq!(wit[2], vec![0x01]);
        assert_eq!(wit[3], htlc.witness_script.as_bytes().to_vec());
    }

    #[test]
    fn refund_tx_has_cltv_locktime() {
        let (htlc, _) = sample_htlc();
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(Txid::from_str(&"cd".repeat(32)).unwrap(), 0),
            value_sats: 100_000,
        };
        let dest = test_signer().address().clone();
        let tx = spend_htlc_tx(
            &utxo,
            &htlc,
            HtlcPath::Refund,
            &dest,
            test_signer().private_key_inner(),
            5,
        )
        .unwrap();
        assert_eq!(tx.lock_time.to_consensus_u32(), 850_000);
        assert_eq!(tx.input[0].sequence, Sequence::ENABLE_LOCKTIME_NO_RBF);
        let wit: Vec<Vec<u8>> = tx.input[0].witness.iter().map(|b| b.to_vec()).collect();
        assert_eq!(wit.len(), 3);
        assert!(wit[1].is_empty());
    }

    #[test]
    fn extract_preimage_roundtrip() {
        let (htlc, preimage) = sample_htlc();
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(Txid::from_str(&"ef".repeat(32)).unwrap(), 0),
            value_sats: 100_000,
        };
        let dest = test_signer().address().clone();
        let tx = spend_htlc_tx(
            &utxo,
            &htlc,
            HtlcPath::Claim(preimage),
            &dest,
            test_signer().private_key_inner(),
            5,
        )
        .unwrap();
        let got = extract_preimage(&tx.input[0].witness).unwrap();
        assert_eq!(got, preimage);
    }

    #[test]
    fn extract_preimage_rejects_refund_witness() {
        let (htlc, _) = sample_htlc();
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(Txid::from_str(&"12".repeat(32)).unwrap(), 0),
            value_sats: 100_000,
        };
        let dest = test_signer().address().clone();
        let tx = spend_htlc_tx(
            &utxo,
            &htlc,
            HtlcPath::Refund,
            &dest,
            test_signer().private_key_inner(),
            5,
        )
        .unwrap();
        assert!(extract_preimage(&tx.input[0].witness).is_none());
    }

    #[test]
    fn spend_rejects_dust() {
        let (htlc, preimage) = sample_htlc();
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(Txid::from_str(&"34".repeat(32)).unwrap(), 0),
            value_sats: 1_000, // too small for fee
        };
        let dest = test_signer().address().clone();
        assert!(spend_htlc_tx(
            &utxo,
            &htlc,
            HtlcPath::Claim(preimage),
            &dest,
            test_signer().private_key_inner(),
            5,
        )
        .is_err());
    }

    #[test]
    fn claim_sig_verifies_against_sighash() {
        let (htlc, preimage) = sample_htlc();
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(Txid::from_str(&"56".repeat(32)).unwrap(), 0),
            value_sats: 100_000,
        };
        let dest = test_signer().address().clone();
        let tx = spend_htlc_tx(
            &utxo,
            &htlc,
            HtlcPath::Claim(preimage),
            &dest,
            test_signer().private_key_inner(),
            5,
        )
        .unwrap();
        // Recompute the sighash and verify the DER sig in the witness.
        let sighash = SighashCache::new(&tx)
            .p2wsh_signature_hash(
                0,
                &htlc.witness_script,
                Amount::from_sat(100_000),
                EcdsaSighashType::All,
            )
            .unwrap();
        let sig_raw = tx.input[0].witness.iter().next().unwrap();
        let sig = bitcoin::secp256k1::ecdsa::Signature::from_der(&sig_raw[..sig_raw.len() - 1])
            .unwrap();
        let msg = Message::from_digest_slice(sighash.as_ref()).unwrap();
        let secp = Secp256k1::new();
        let pk = secp256k1_pubkey();
        secp.verify_ecdsa(&msg, &sig, &pk).unwrap();
    }

    fn secp256k1_pubkey() -> bitcoin::secp256k1::PublicKey {
        test_signer().public_key_btc().inner
    }
}
