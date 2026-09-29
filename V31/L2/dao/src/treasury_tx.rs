//! # Treasury transaction pipeline — real L1 execution
//!
//! Upgrades treasury operations from approval-records to a verifiable
//! pipeline:
//!
//! ```text
//! guardian signs  `dao:treasury:v1|<op_id>|<sha256(op_json)>`
//!        │         (Ed25519 — verified against configured guardian pubkey)
//!        ▼
//! ≥ threshold verified sigs  →  executor builds a real UTXO tx from live
//!        │                     treasury UTXOs (getUtxos), signs each input
//!        │                     with ZION_DAO_TREASURY_KEY (if configured)
//!        ▼
//! submitUtxoTransaction → mined → executed (tx_id recorded)
//! ```
//!
//! If no treasury key is configured the op still completes the governance
//! stage (`signed` → `awaiting_broadcast`) and the unsigned tx spec is
//! stored on the op row so an operator can broadcast it externally.
//!
//! ## Threat model
//!
//! * Guardians sign the **operation content hash**, not a tx — so the proof
//!   bundle stays valid even if UTXO selection changes between signing and
//!   execution. The executor derives `(recipient, amount)` from the stored
//!   operation and refuses to build a tx that deviates.
//! * `ZION_DAO_TREASURY_KEY` is the single custody key for the treasury
//!   address UTXOs (L1 has no m-of-n script type). Guardian sigs are the
//!   authorization; the key is the execution credential. Both are required.
//! * Replay: L1 UTXO double-spend protection + `executed` status + tx_id.

use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::net::TcpStream;
use std::time::Duration;

use crate::error::{DaoError, DaoResult};
use crate::treasury::TreasuryOperation;

/// Domain separator for guardian treasury signatures.
pub const TREASURY_SIG_DOMAIN: &str = "dao:treasury:v1";

/// Fixed protocol fee for a treasury spend transaction (1 ZION, same as
/// `zion_l1` adapter payments).
pub const TREASURY_TX_FEE_FLOWERS: u64 = 1_000_000;

// ─────────────────────────────────────────────────────────────────────────────
// Canonical signing payload
// ─────────────────────────────────────────────────────────────────────────────

/// Canonical bytes a guardian signs: `dao:treasury:v1|<op_id>|<sha256(op_json)>`.
/// `operation_json` is the exact stored `treasury_ops.operation` blob.
pub fn signing_message(op_id: &str, operation_json: &str) -> String {
    let digest = Sha256::digest(operation_json.as_bytes());
    format!("{}|{}|{}", TREASURY_SIG_DOMAIN, op_id, hex::encode(digest))
}

/// Verify an Ed25519 guardian signature over `signing_message`.
/// `pubkey_hex`/`sig_hex` are lowercase or 0x-prefixed hex.
pub fn verify_guardian_signature(pubkey_hex: &str, message: &str, sig_hex: &str) -> DaoResult<()> {
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};

    let pk_bytes = hex::decode(pubkey_hex.trim_start_matches("0x"))
        .map_err(|_| DaoError::Unauthorized("guardian pubkey is not valid hex".into()))?;
    let pk_array: [u8; 32] = pk_bytes
        .try_into()
        .map_err(|_| DaoError::Unauthorized("guardian pubkey must be 32 bytes".into()))?;
    let vk = VerifyingKey::from_bytes(&pk_array)
        .map_err(|_| DaoError::Unauthorized("guardian pubkey is not an Ed25519 point".into()))?;

    let sig_bytes = hex::decode(sig_hex.trim_start_matches("0x"))
        .map_err(|_| DaoError::Unauthorized("signature is not valid hex".into()))?;
    let sig_array: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| DaoError::Unauthorized("signature must be 64 bytes".into()))?;
    let sig = Signature::from_bytes(&sig_array);

    vk.verify(message.as_bytes(), &sig)
        .map_err(|_| DaoError::Unauthorized("guardian signature verification failed".into()))
}

// ─────────────────────────────────────────────────────────────────────────────
// Unsigned tx construction
// ─────────────────────────────────────────────────────────────────────────────

/// `(recipient, amount_flowers)` extracted from an approved operation.
/// `Rebalance` stays inside the treasury — `to` is the effective recipient.
pub fn op_recipient_amount(op: &TreasuryOperation) -> (String, u64) {
    match op {
        TreasuryOperation::Spend {
            recipient, amount, ..
        } => (recipient.clone(), *amount),
        TreasuryOperation::HumanitarianGrant {
            recipient, amount, ..
        } => (recipient.clone(), *amount),
        TreasuryOperation::GoldenEggPrize {
            recipient, amount, ..
        } => (recipient.clone(), *amount),
        TreasuryOperation::Rebalance { to, amount, .. } => (to.clone(), *amount),
    }
}

/// Source treasury address for an operation (`Rebalance.from`, else the
/// first configured treasury address).
pub fn op_source_address(op: &TreasuryOperation, treasury_addresses: &[String]) -> Option<String> {
    match op {
        TreasuryOperation::Rebalance { from, .. } => Some(from.clone()),
        _ => treasury_addresses.first().cloned(),
    }
}

/// A UTXO row as returned by `getUtxos` (subset we need).
#[derive(Debug, Clone)]
pub struct TreasuryUtxo {
    pub tx_hash: String,
    pub output_index: u32,
    pub amount: u64,
    pub is_coinbase: bool,
    pub block_height: u64,
}

/// Fetch live UTXOs for `address` via line-delimited TCP JSON-RPC.
pub fn fetch_utxos(rpc_addr: &str, address: &str) -> DaoResult<Vec<TreasuryUtxo>> {
    let resp = l1_rpc_blocking(
        rpc_addr,
        "getUtxos",
        serde_json::json!({ "address": address }),
    )?;
    let utxos = resp
        .get("utxos")
        .and_then(|v| v.as_array())
        .ok_or_else(|| DaoError::Internal("getUtxos missing utxos".into()))?;
    let mut out = Vec::new();
    for u in utxos {
        out.push(TreasuryUtxo {
            tx_hash: u
                .get("tx_hash")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            output_index: u
                .get("output_index")
                .or_else(|| u.get("vout"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            amount: u.get("amount").and_then(|v| v.as_u64()).unwrap_or(0),
            is_coinbase: u
                .get("is_coinbase")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            block_height: u.get("block_height").and_then(|v| v.as_u64()).unwrap_or(0),
        });
    }
    Ok(out)
}

/// Spec for an unsigned treasury spend — stored on the op row so an
/// operator can inspect/broadcast it even without a configured key.
#[derive(Debug, Clone, serde::Serialize)]
pub struct UnsignedTreasuryTx {
    pub from_address: String,
    pub to_address: String,
    pub amount_flowers: u64,
    pub fee_flowers: u64,
    pub input_count: usize,
    pub input_total_flowers: u64,
    pub change_flowers: u64,
    pub memo: String,
}

/// Deterministically select treasury UTXOs (sorted by hash,index) covering
/// `amount + fee`. Returns the chosen set + total. Does **not** skip
/// coinbase maturity — treasury UTXOs are genesis-era.
pub fn select_utxos(
    utxos: &[TreasuryUtxo],
    amount: u64,
    fee: u64,
) -> DaoResult<(Vec<TreasuryUtxo>, u64)> {
    let mut sorted = utxos.to_vec();
    sorted.sort_by(|a, b| {
        a.tx_hash
            .cmp(&b.tx_hash)
            .then(a.output_index.cmp(&b.output_index))
    });
    let target = amount
        .checked_add(fee)
        .ok_or_else(|| DaoError::Internal("amount+fee overflow".into()))?;
    let mut picked = Vec::new();
    let mut total = 0u64;
    for u in sorted {
        picked.push(u.clone());
        total = total
            .checked_add(u.amount)
            .ok_or_else(|| DaoError::Internal("utxo sum overflow".into()))?;
        if total >= target {
            break;
        }
    }
    if total < target {
        return Err(DaoError::InsufficientTreasuryBalance {
            needed: target,
            available: total,
        });
    }
    Ok((picked, total))
}

/// Build the unsigned-tx spec for an op. Errors when the treasury UTXOs
/// cannot cover amount+fee (fail-closed — never half-builds).
pub fn build_unsigned_spec(
    op_id: &str,
    op: &TreasuryOperation,
    treasury_addresses: &[String],
    utxos: &[TreasuryUtxo],
) -> DaoResult<UnsignedTreasuryTx> {
    let (to, amount) = op_recipient_amount(op);
    if to.is_empty() || amount == 0 {
        return Err(DaoError::Internal(
            "operation has no spendable recipient/amount".into(),
        ));
    }
    let from = op_source_address(op, treasury_addresses)
        .ok_or_else(|| DaoError::Internal("no treasury address configured".into()))?;
    let (picked, total) = select_utxos(utxos, amount, TREASURY_TX_FEE_FLOWERS)?;
    Ok(UnsignedTreasuryTx {
        from_address: from.clone(),
        to_address: to,
        amount_flowers: amount,
        fee_flowers: TREASURY_TX_FEE_FLOWERS,
        input_count: picked.len(),
        input_total_flowers: total,
        change_flowers: total.saturating_sub(amount + TREASURY_TX_FEE_FLOWERS),
        memo: format!("DAO:treasury:{op_id}"),
    })
}

/// Build + sign + broadcast the spend via `zion_core::v31_wallet` and
/// `submitUtxoTransaction`. `treasury_key` is the Ed25519 private key of
/// the treasury address (hex). Returns the accepted tx_id.
pub fn sign_and_broadcast(
    rpc_addr: &str,
    spec: &UnsignedTreasuryTx,
    picked_utxos: &[TreasuryUtxo],
    treasury_key: &ed25519_dalek::SigningKey,
) -> DaoResult<String> {
    use zion_core::v31_wallet::{build_batch_payout, BatchRecipient, SpendableUtxo};

    let available: Vec<SpendableUtxo> = picked_utxos
        .iter()
        .filter_map(|u| {
            let hash_bytes = hex::decode(&u.tx_hash).ok()?;
            let arr: [u8; 32] = hash_bytes.try_into().ok()?;
            Some(SpendableUtxo {
                tx_hash: arr,
                output_index: u.output_index,
                amount: u.amount,
                address: spec.from_address.clone(),
                script: vec![],
                block_height: u.block_height,
                is_coinbase: u.is_coinbase,
            })
        })
        .collect();
    if available.len() != picked_utxos.len() {
        return Err(DaoError::Internal("malformed utxo tx_hash".into()));
    }

    let recipients = vec![BatchRecipient {
        address: spec.to_address.clone(),
        amount: spec.amount_flowers,
    }];
    let built = build_batch_payout(
        treasury_key,
        &spec.from_address,
        &recipients,
        spec.fee_flowers,
        &available,
    )
    .map_err(|e| DaoError::Internal(format!("tx build failed: {e:?}")))?;

    let tx_json = serde_json::to_value(&built.transaction)
        .map_err(|e| DaoError::Internal(format!("tx serialize: {e}")))?;
    let resp = l1_rpc_blocking(
        rpc_addr,
        "submitUtxoTransaction",
        serde_json::json!({ "transaction": tx_json }),
    )?;
    let tx_id = resp
        .get("tx_id")
        .or_else(|| resp.get("txid"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| built.transaction.hash().to_hex());
    Ok(tx_id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal blocking JSON-RPC (line-delimited TCP — same as api.rs `l1_rpc`)
// ─────────────────────────────────────────────────────────────────────────────

fn l1_rpc_blocking(rpc_addr: &str, method: &str, params: Value) -> DaoResult<Value> {
    let addr = zion_l1_types::normalize_rpc_addr(rpc_addr);
    let mut stream = TcpStream::connect(&addr)
        .map_err(|e| DaoError::Internal(format!("L1 connect {addr}: {e}")))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(15)))
        .and_then(|_| stream.set_write_timeout(Some(Duration::from_secs(15))))
        .map_err(|e| DaoError::Internal(format!("L1 sockopts: {e}")))?;

    let req = serde_json::json!({
        "jsonrpc": "2.0", "id": 1, "method": method, "params": params
    });
    stream
        .write_all(serde_json::to_string(&req).unwrap().as_bytes())
        .and_then(|_| stream.write_all(b"\n"))
        .map_err(|e| DaoError::Internal(format!("L1 write: {e}")))?;

    use std::io::{BufRead, BufReader};
    let mut line = String::new();
    BufReader::new(stream)
        .read_line(&mut line)
        .map_err(|e| DaoError::Internal(format!("L1 read: {e}")))?;
    let resp: Value = serde_json::from_str(line.trim())
        .map_err(|e| DaoError::Internal(format!("L1 parse: {e}")))?;
    if let Some(err) = resp.get("error").filter(|e| !e.is_null()) {
        let msg = err
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("rpc error");
        return Err(DaoError::Internal(format!("L1 {method}: {msg}")));
    }
    resp.get("result")
        .cloned()
        .ok_or_else(|| DaoError::Internal("L1 null result".into()))
}

/// Read the treasury signing key from `ZION_DAO_TREASURY_KEY` (hex Ed25519
/// secret). Absent → `Ok(None)` = governance-only mode.
pub fn treasury_key_from_env() -> DaoResult<Option<ed25519_dalek::SigningKey>> {
    match std::env::var("ZION_DAO_TREASURY_KEY") {
        Ok(raw) => {
            let bytes = hex::decode(raw.trim().trim_start_matches("0x"))
                .map_err(|e| DaoError::Internal(format!("treasury key hex: {e}")))?;
            let arr: [u8; 32] = bytes
                .try_into()
                .map_err(|_| DaoError::Internal("treasury key must be 32 bytes".into()))?;
            Ok(Some(ed25519_dalek::SigningKey::from_bytes(&arr)))
        }
        Err(_) => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn op_json() -> String {
        serde_json::to_string(&TreasuryOperation::Spend {
            recipient: "zion1dest".into(),
            amount: 5_000_000,
            purpose: "grant".into(),
            proposal_id: 1,
        })
        .unwrap()
    }

    #[test]
    fn signing_message_is_deterministic() {
        let m1 = signing_message("op-1", &op_json());
        let m2 = signing_message("op-1", &op_json());
        assert_eq!(m1, m2);
        assert!(m1.starts_with("dao:treasury:v1|op-1|"));
        // Different op → different message.
        assert_ne!(m1, signing_message("op-2", &op_json()));
    }

    #[test]
    fn guardian_signature_roundtrip() {
        let sk = SigningKey::from_bytes(&[7u8; 32]);
        let pk = hex::encode(sk.verifying_key().to_bytes());
        let msg = signing_message("op-9", &op_json());
        let sig = sk.sign(msg.as_bytes());
        verify_guardian_signature(&pk, &msg, &hex::encode(sig.to_bytes())).unwrap();

        // Wrong message / wrong key must fail.
        assert!(verify_guardian_signature(
            &pk,
            "dao:treasury:v1|op-9|00",
            &hex::encode(sig.to_bytes())
        )
        .is_err());
        let other = SigningKey::from_bytes(&[8u8; 32]);
        assert!(verify_guardian_signature(
            &hex::encode(other.verifying_key().to_bytes()),
            &msg,
            &hex::encode(sig.to_bytes())
        )
        .is_err());
    }

    #[test]
    fn utxo_selection_is_deterministic_and_covers_fee() {
        let utxos = vec![
            TreasuryUtxo {
                tx_hash: "bb".into(),
                output_index: 0,
                amount: 3_000_000,
                is_coinbase: false,
                block_height: 1,
            },
            TreasuryUtxo {
                tx_hash: "aa".into(),
                output_index: 1,
                amount: 4_000_000,
                is_coinbase: false,
                block_height: 1,
            },
            TreasuryUtxo {
                tx_hash: "cc".into(),
                output_index: 0,
                amount: 9_000_000,
                is_coinbase: false,
                block_height: 1,
            },
        ];
        let (picked, total) = select_utxos(&utxos, 5_000_000, TREASURY_TX_FEE_FLOWERS).unwrap();
        // sorted: aa(4M) then bb(3M) → total 7M ≥ 6M
        assert_eq!(picked.len(), 2);
        assert_eq!(total, 7_000_000);

        // Insufficient → error
        assert!(select_utxos(&utxos, 100_000_000, TREASURY_TX_FEE_FLOWERS).is_err());
    }

    #[test]
    fn unsigned_spec_binds_op_fields() {
        let op = TreasuryOperation::Spend {
            recipient: "zion1dest".into(),
            amount: 5_000_000,
            purpose: "x".into(),
            proposal_id: 1,
        };
        let utxos = vec![TreasuryUtxo {
            tx_hash: "aa".into(),
            output_index: 0,
            amount: 10_000_000,
            is_coinbase: false,
            block_height: 1,
        }];
        let spec = build_unsigned_spec("op-7", &op, &["zion1treasury".into()], &utxos).unwrap();
        assert_eq!(spec.to_address, "zion1dest");
        assert_eq!(spec.amount_flowers, 5_000_000);
        assert_eq!(spec.memo, "DAO:treasury:op-7");
        assert_eq!(
            spec.change_flowers,
            10_000_000 - 5_000_000 - TREASURY_TX_FEE_FLOWERS
        );
    }
}
