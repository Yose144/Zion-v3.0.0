//! V31-native wallet — UTXO coin selection, batch payout building, and signing.
//!
//! This is the canonical wallet logic for the V31 mainnet chain. It builds
//! [`crate::transaction::Transaction`] values and signs them with the
//! Ed25519 `signing_hash` scheme used by `UtxoSet` validation.

use ed25519_dalek::SigningKey;
use zion_l1_types::{Address, Amount, ChainId, Hash};

use crate::crypto;
use crate::transaction::{Transaction, TransactionInput, TransactionOutput};
use crate::{fee, v3_compat};

/// Maximum recipients in a single batch payout transaction.
pub const MAX_BATCH_RECIPIENTS: usize = 200;

/// Minimum payout amount: 10 ZION in flowers (post-3.0.3: 6-decimal).
pub const MIN_PAYOUT_AMOUNT: u64 = 10_000_000;

/// A spendable UTXO known to the wallet.
#[derive(Debug, Clone)]
pub struct SpendableUtxo {
    pub tx_hash: [u8; 32],
    pub output_index: u32,
    pub amount: u64,
    pub address: String,
    /// Output script. Empty = P2PKH; non-empty = contract (e.g. HTLC).
    pub script: Vec<u8>,
    /// Height of the block that created this output.
    pub block_height: u64,
    /// True if the output was created by a coinbase transaction.
    pub is_coinbase: bool,
}

/// Recipient for a batch payout.
#[derive(Debug, Clone)]
pub struct BatchRecipient {
    pub address: String,
    pub amount: u64,
}

/// Result of building a transaction.
#[derive(Debug, Clone)]
pub struct BuildResult {
    pub transaction: Transaction,
    pub change_amount: u64,
}

/// Wallet errors.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WalletError {
    InsufficientFunds { available: u64, needed: u64 },
    NoUtxos,
    InvalidAddress(String),
    FeeTooLow { fee: u64, minimum: u64 },
    TooManyRecipients(usize),
    SigningFailed,
    /// The funding amount is spread over more UTXOs than fit under the
    /// [`fee::MAX_TX_SIZE`] serialized-size cap. `covered` is what the
    /// `max_inputs` largest UTXOs sum to, `needed` is amount + fee.
    TooManyInputs {
        max_inputs: usize,
        covered: u64,
        needed: u64,
    },
    /// The built transaction exceeds the network serialized-size limit.
    TxTooLarge { size: usize, max: usize },
}

impl std::fmt::Display for WalletError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InsufficientFunds { available, needed } => {
                write!(f, "insufficient funds: have {available}, need {needed}")
            }
            Self::NoUtxos => write!(f, "no spendable UTXOs"),
            Self::InvalidAddress(a) => write!(f, "invalid address: {a}"),
            Self::FeeTooLow { fee, minimum } => write!(f, "fee {fee} below minimum {minimum}"),
            Self::TooManyRecipients(n) => {
                write!(f, "too many recipients: {n} (max {MAX_BATCH_RECIPIENTS})")
            }
            Self::SigningFailed => write!(f, "signing failed"),
            Self::TooManyInputs {
                max_inputs,
                covered,
                needed,
            } => write!(
                f,
                "largest {max_inputs} UTXOs cover only {covered} of {needed} flowers — \
                 transaction would exceed max size; consolidate the wallet UTXO set first"
            ),
            Self::TxTooLarge { size, max } => {
                write!(f, "transaction too large: {size} bytes exceeds max {max}")
            }
        }
    }
}

impl std::error::Error for WalletError {}

// ── Serialized-size budget ─────────────────────────────────────────────
//
// The node bounds transactions by `serde_json::to_vec(tx).len()`
// (`Node::check_tx_size`, `fee::MAX_TX_SIZE` = 100 KB). `Hash` ([u8; 32])
// and `script`/`memo` (`Vec<u8>`) serialize as JSON number arrays — ~4
// chars per byte worst case — so one signed input costs ~560 bytes on the
// wire, not the ~132 bytes `fee::estimate_tx_size` uses for the fee market.
// Coin selection must therefore cap input count by the JSON budget, or the
// built transaction is rejected at broadcast ("transaction too large").

/// Conservative upper bound on the JSON-serialized size of one signed
/// input: 32-byte hash array ≈ 129 chars, 96-byte sig‖pk script ≈ 385,
/// field names, index and punctuation ≈ 40.
const JSON_BYTES_PER_INPUT_UPPER: usize = 560;

/// Conservative upper bound on the JSON-serialized size of one output:
/// amount string + `Address` object (~110 chars) + empty script + names.
const JSON_BYTES_PER_OUTPUT_UPPER: usize = 220;

/// JSON cost of one memo byte inside a `Vec<u8>` number array.
const JSON_BYTES_PER_MEMO_BYTE: usize = 4;

/// Reserved headroom for the transaction envelope (`{"version":…,"inputs":…}`)
/// plus safety margin for digit-length variance.
const JSON_BASE_BYTES: usize = 300;

/// Maximum number of inputs whose signed JSON encoding fits under
/// [`fee::MAX_TX_SIZE`] for a transaction with `num_outputs` outputs and a
/// `memo_len`-byte memo.
pub fn max_tx_inputs_for(num_outputs: usize, memo_len: usize) -> usize {
    let reserved = JSON_BASE_BYTES
        + num_outputs * JSON_BYTES_PER_OUTPUT_UPPER
        + memo_len * JSON_BYTES_PER_MEMO_BYTE;
    (fee::MAX_TX_SIZE.saturating_sub(reserved) / JSON_BYTES_PER_INPUT_UPPER)
        .min(fee::MAX_TX_INPUTS)
}

/// Select UTXOs using largest-first strategy, bounded by `max_inputs`.
///
/// Returns selected UTXOs and total selected amount, or error if insufficient.
/// When the input cap is hit before `target` is reached the error is
/// [`WalletError::TooManyInputs`] — the funds exist but are too fragmented
/// for a single transaction and the wallet needs UTXO consolidation.
fn select_utxos(
    available: &[SpendableUtxo],
    target: u64,
    max_inputs: usize,
) -> Result<(Vec<&SpendableUtxo>, u64), WalletError> {
    if available.is_empty() {
        return Err(WalletError::NoUtxos);
    }

    let mut sorted: Vec<&SpendableUtxo> = available.iter().collect();
    sorted.sort_by(|a, b| b.amount.cmp(&a.amount).then(a.tx_hash.cmp(&b.tx_hash)));

    let mut selected = Vec::new();
    let mut total: u64 = 0;
    for utxo in sorted {
        if selected.len() >= max_inputs {
            return Err(WalletError::TooManyInputs {
                max_inputs,
                covered: total,
                needed: target,
            });
        }
        total = total
            .checked_add(utxo.amount)
            .ok_or(WalletError::InsufficientFunds {
                available: 0,
                needed: u64::MAX,
            })?;
        selected.push(utxo);
        if total >= target {
            return Ok((selected, total));
        }
    }

    Err(WalletError::InsufficientFunds {
        available: total,
        needed: target,
    })
}

/// Minimum fee (in flowers) required to send `amount` given the wallet's
/// current UTXO set. Coin selection depends on the fee (it is part of the
/// target) while the fee depends on the selected input count — iterate a
/// few times until stable. Used by `zion wallet send --fee auto`.
pub fn estimate_send_fee(
    amount: u64,
    available_utxos: &[SpendableUtxo],
) -> Result<u64, WalletError> {
    let mut fee = fee::MIN_TX_FEE;
    for _ in 0..6 {
        let target = amount
            .checked_add(fee)
            .ok_or(WalletError::InsufficientFunds {
                available: 0,
                needed: u64::MAX,
            })?;
        let (selected, _) = select_utxos(available_utxos, target, max_tx_inputs_for(2, 0))?;
        let required = fee::minimum_fee_for_size(fee::estimate_tx_size(selected.len(), 2));
        if required <= fee {
            return Ok(fee);
        }
        fee = required;
    }
    Ok(fee)
}

/// Plan one consolidation round: the `max_inputs` largest spendable UTXOs.
/// Merging the top of the set produces the biggest possible merged output
/// per round, which unblocks large sends (the input cap is what rejects
/// them) in the fewest transactions. Returns the batch and its total, or
/// `None` when fewer than `min_batch` UTXOs remain — spending a single
/// UTXO to self would not reduce the set.
pub fn plan_consolidation(
    available: &[SpendableUtxo],
    max_inputs: usize,
    min_batch: usize,
) -> Option<(Vec<SpendableUtxo>, u64)> {
    let mut sorted: Vec<&SpendableUtxo> = available.iter().collect();
    sorted.sort_by(|a, b| b.amount.cmp(&a.amount).then(a.tx_hash.cmp(&b.tx_hash)));
    let batch: Vec<SpendableUtxo> = sorted
        .into_iter()
        .take(max_inputs)
        .cloned()
        .collect();
    if batch.len() < min_batch {
        return None;
    }
    let total = batch
        .iter()
        .try_fold(0u64, |acc, u| acc.checked_add(u.amount))?;
    Some((batch, total))
}

/// Validate and normalize a `zion1...` destination address.
fn parse_address(encoded: &str) -> Result<Address, WalletError> {
    if !crypto::is_valid_address(encoded) {
        return Err(WalletError::InvalidAddress(encoded.to_string()));
    }
    Address::new(ChainId::ZionL1, vec![], encoded)
        .map_err(|_| WalletError::InvalidAddress(encoded.to_string()))
}

/// Build and sign a multi-recipient batch payout transaction for V31.
///
/// `signing_key` is the pool's Ed25519 secret key. `change_address` receives
/// any unspent portion of the selected UTXOs. `fee` must be at least the
/// minimum required for the serialized transaction size.
pub fn build_batch_payout(
    signing_key: &SigningKey,
    change_address: &str,
    recipients: &[BatchRecipient],
    fee: u64,
    available_utxos: &[SpendableUtxo],
) -> Result<BuildResult, WalletError> {
    if recipients.len() > MAX_BATCH_RECIPIENTS {
        return Err(WalletError::TooManyRecipients(recipients.len()));
    }

    let total_payout: u64 = recipients.iter().map(|r| r.amount).sum();
    let target = total_payout
        .checked_add(fee)
        .ok_or(WalletError::InsufficientFunds {
            available: 0,
            needed: u64::MAX,
        })?;

    // Bound inputs by the serialized-size budget: one recipient output is
    // reserved for change, so the tx carries recipients.len() + 1 outputs.
    let max_inputs = max_tx_inputs_for(recipients.len() + 1, 0);

    // If we don't have enough UTXOs to cover payouts + fee, but we DO have
    // enough to cover just the payouts, reduce the last recipient's amount
    // by the fee shortfall. This avoids "insufficient funds" when the pool
    // has exactly the right amount for payouts but no reserve for the fee.
    let (selected, total) = match select_utxos(available_utxos, target, max_inputs) {
        Ok(result) => result,
        Err(WalletError::InsufficientFunds { available, .. }) if available >= total_payout => {
            // Recompute with fee absorbed into payouts
            let shortfall = target.saturating_sub(available);
            let mut adjusted_recipients: Vec<BatchRecipient> = recipients.to_vec();
            if !adjusted_recipients.is_empty() {
                let last = adjusted_recipients.len() - 1;
                adjusted_recipients[last].amount =
                    adjusted_recipients[last].amount.saturating_sub(shortfall);
            }
            let new_total_payout: u64 = adjusted_recipients.iter().map(|r| r.amount).sum();
            let new_target = new_total_payout.saturating_add(fee);
            // If still not enough, try with zero fee (dust tx)
            if new_target > available {
                // Last resort: absorb fee entirely into last recipient
                if !adjusted_recipients.is_empty() {
                    let last = adjusted_recipients.len() - 1;
                    adjusted_recipients[last].amount =
                        adjusted_recipients[last].amount.saturating_sub(fee);
                }
                let final_total: u64 = adjusted_recipients.iter().map(|r| r.amount).sum();
                let (sel, tot) = select_utxos(available_utxos, final_total, max_inputs)?;
                return build_batch_payout_inner(
                    signing_key,
                    change_address,
                    &adjusted_recipients,
                    0,
                    &sel,
                    tot,
                    MIN_PAYOUT_AMOUNT,
                    &[],
                    None,
                );
            }
            let (sel, tot) = select_utxos(available_utxos, new_target, max_inputs)?;
            return build_batch_payout_inner(
                signing_key,
                change_address,
                &adjusted_recipients,
                fee,
                &sel,
                tot,
                MIN_PAYOUT_AMOUNT,
                &[],
                None,
            );
        }
        Err(e) => return Err(e),
    };

    // The node prices fees off `estimate_tx_size` — check against the real
    // selected input count so the tx is not built just to be rejected.
    let min_fee =
        fee::minimum_fee_for_size(fee::estimate_tx_size(selected.len(), recipients.len() + 1));
    if fee < min_fee {
        return Err(WalletError::FeeTooLow {
            fee,
            minimum: min_fee,
        });
    }

    build_batch_payout_inner(
        signing_key,
        change_address,
        recipients,
        fee,
        &selected,
        total,
        MIN_PAYOUT_AMOUNT,
        &[],
        None,
    )
}

/// Build and sign a single-recipient V31 UTXO transaction.
///
/// `amount` and `fee` are in flowers. The change returns to
/// `change_address` (usually the sender). Dust outputs are allowed,
/// so this is suitable for small customer bonuses.
pub fn build_send(
    signing_key: &SigningKey,
    change_address: &str,
    to_address: &str,
    amount: u64,
    fee: u64,
    available_utxos: &[SpendableUtxo],
) -> Result<BuildResult, WalletError> {
    build_send_with_memo(
        signing_key,
        change_address,
        to_address,
        amount,
        fee,
        available_utxos,
        &[],
    )
}

/// Same as [`build_send`], but attaches an arbitrary memo (e.g. a note or
/// reference id) to the transaction. Memo bytes are stored as-is in
/// `Transaction::memo` and are not validated against any charset/length
/// beyond what the network's max transaction size otherwise permits.
///
/// If `script` is non-empty it is attached to the single recipient output,
/// producing an HTLC or other contract output.
pub fn build_send_with_memo(
    signing_key: &SigningKey,
    change_address: &str,
    to_address: &str,
    amount: u64,
    fee: u64,
    available_utxos: &[SpendableUtxo],
    memo: &[u8],
) -> Result<BuildResult, WalletError> {
    if amount == 0 {
        return Err(WalletError::FeeTooLow { fee: 0, minimum: 1 });
    }

    let target = amount
        .checked_add(fee)
        .ok_or(WalletError::InsufficientFunds {
            available: 0,
            needed: u64::MAX,
        })?;

    // One recipient output plus a possible change output.
    let max_inputs = max_tx_inputs_for(2, memo.len());
    let (selected, total) = select_utxos(available_utxos, target, max_inputs)?;

    let min_fee = fee::minimum_fee_for_size(fee::estimate_tx_size(selected.len(), 2));
    if fee < min_fee {
        return Err(WalletError::FeeTooLow {
            fee,
            minimum: min_fee,
        });
    }

    build_batch_payout_inner(
        signing_key,
        change_address,
        &[BatchRecipient {
            address: to_address.to_string(),
            amount,
        }],
        fee,
        &selected,
        total,
        1,
        memo,
        None,
    )
}

/// Build a premine admin-unlock authorization transaction.
///
/// The transaction spends one funded UTXO from each canonical admin address
/// (`v3_compat::ADMIN_L1_ADDRESSES`), carries the
/// `ZION:ADMIN_UNLOCK:v1:<target>[:<ref>]` memo, and returns the input total
/// minus `fee` to `refund_address` (typically an admin or treasury wallet).
///
/// Every input is signed with its own admin key over the same
/// `Transaction::signing_hash`, so the keys never need to co-locate: the
/// coordinator can collect the funded outpoints, build the unsigned tx, let
/// each admin sign the hash offline, and assemble `sig || pk` input scripts.
///
/// `admin_inputs` is a list of `(admin_signing_key, funded_utxo)` pairs that
/// must cover all three canonical admin addresses. `reference` is an optional
/// audit tag (e.g. the DAO proposal id) embedded in the memo.
pub fn build_admin_unlock_tx(
    admin_inputs: &[(SigningKey, SpendableUtxo)],
    refund_address: &str,
    target: &str,
    reference: Option<&str>,
    fee: u64,
) -> Result<BuildResult, WalletError> {
    // The unlock memo is consensus-parsed; build it first and verify it
    // round-trips through the parser so a malformed target/ref can never be
    // broadcast as a valid-looking transaction.
    let memo = match reference {
        Some(r) => format!("{}{target}:{r}", v3_compat::ADMIN_UNLOCK_MEMO_PREFIX),
        None => format!("{}{target}", v3_compat::ADMIN_UNLOCK_MEMO_PREFIX),
    };
    let parsed = v3_compat::parse_admin_unlock_memo(memo.as_bytes())
        .ok_or_else(|| WalletError::InvalidAddress(target.to_string()))?;
    debug_assert_eq!(parsed.target, target);

    // Every canonical admin address must contribute exactly one signed input.
    let mut covered = std::collections::BTreeSet::new();
    let mut total: u64 = 0;
    let mut inputs: Vec<TransactionInput> = Vec::with_capacity(admin_inputs.len());
    for (key, utxo) in admin_inputs {
        if !v3_compat::ADMIN_L1_ADDRESSES.contains(&utxo.address.as_str()) {
            return Err(WalletError::InvalidAddress(utxo.address.clone()));
        }
        if !utxo.script.is_empty() {
            return Err(WalletError::InvalidAddress(utxo.address.clone()));
        }
        if crypto::derive_address(key.verifying_key().as_bytes()) != utxo.address {
            return Err(WalletError::SigningFailed);
        }
        covered.insert(utxo.address.clone());
        total = total
            .checked_add(utxo.amount)
            .ok_or(WalletError::InsufficientFunds {
                available: u64::MAX,
                needed: fee,
            })?;
        inputs.push(TransactionInput {
            previous_output: Hash::new(utxo.tx_hash),
            index: utxo.output_index,
            script: Vec::new(),
        });
    }
    if covered.len() != v3_compat::ADMIN_L1_ADDRESSES.len() {
        return Err(WalletError::InvalidAddress(format!(
            "admin unlock needs {} distinct admin inputs, got {}",
            v3_compat::ADMIN_L1_ADDRESSES.len(),
            covered.len()
        )));
    }

    let min_fee = fee::minimum_fee_for_size(fee::estimate_tx_size(inputs.len(), 1));
    if fee < min_fee {
        return Err(WalletError::FeeTooLow {
            fee,
            minimum: min_fee,
        });
    }
    let refund =
        total
            .checked_sub(fee)
            .filter(|r| *r > 0)
            .ok_or(WalletError::InsufficientFunds {
                available: total,
                needed: fee + 1,
            })?;

    let mut tx = Transaction {
        version: 1,
        inputs,
        outputs: vec![TransactionOutput {
            amount: Amount::new(refund as u128),
            address: parse_address(refund_address)?,
            script: vec![],
        }],
        memo: memo.into_bytes(),
    };

    let signing_hash = tx.signing_hash();
    for (input, (key, _)) in tx.inputs.iter_mut().zip(admin_inputs.iter()) {
        let signature = crypto::sign(key, &signing_hash.0);
        input.script = signature.to_vec();
        input
            .script
            .extend_from_slice(key.verifying_key().as_bytes());
    }

    Ok(BuildResult {
        transaction: tx,
        change_amount: refund,
    })
}

fn total_payout_inner(recipients: &[BatchRecipient], fee: u64) -> u64 {
    let total_payout: u64 = recipients.iter().map(|r| r.amount).sum();
    total_payout.saturating_add(fee)
}

#[allow(clippy::too_many_arguments)]
fn build_batch_payout_inner(
    signing_key: &SigningKey,
    change_address: &str,
    recipients: &[BatchRecipient],
    fee: u64,
    selected: &[&SpendableUtxo],
    total: u64,
    min_payout: u64,
    memo: &[u8],
    output_script: Option<Vec<u8>>,
) -> Result<BuildResult, WalletError> {
    let target = total_payout_inner(recipients, fee);
    let change = total - target;

    let mut outputs: Vec<TransactionOutput> = Vec::with_capacity(recipients.len() + 1);
    for (i, r) in recipients.iter().enumerate() {
        if r.amount < min_payout {
            // Skip dust outputs; they would fail validation anyway.
            return Err(WalletError::FeeTooLow {
                fee: r.amount,
                minimum: min_payout,
            });
        }
        let script = if i == 0 {
            output_script.clone().unwrap_or_default()
        } else {
            vec![]
        };
        outputs.push(TransactionOutput {
            amount: Amount::new(r.amount as u128),
            address: parse_address(&r.address)?,
            script,
        });
    }
    if change > 0 {
        outputs.push(TransactionOutput {
            amount: Amount::new(change as u128),
            address: parse_address(change_address)?,
            script: vec![],
        });
    }

    let mut inputs: Vec<TransactionInput> = Vec::with_capacity(selected.len());
    for utxo in selected {
        inputs.push(TransactionInput {
            previous_output: Hash::new(utxo.tx_hash),
            index: utxo.output_index,
            script: Vec::new(),
        });
    }

    let mut tx = Transaction {
        version: 1,
        inputs,
        outputs,
        memo: memo.to_vec(),
    };

    let signing_hash = tx.signing_hash();
    let public_key = signing_key.verifying_key().as_bytes().to_vec();
    for input in &mut tx.inputs {
        let signature = crypto::sign(signing_key, &signing_hash.0);
        input.script = signature.to_vec();
        input.script.extend_from_slice(&public_key);
    }

    // Exact check against the node's wire-size bound (`serde_json::to_vec`
    // is what `Node::check_tx_size` measures). The input cap above is a
    // conservative estimate; this is the authoritative backstop.
    let json_size = serde_json::to_vec(&tx)
        .map(|bytes| bytes.len())
        .unwrap_or(usize::MAX);
    if json_size > fee::MAX_TX_SIZE {
        return Err(WalletError::TxTooLarge {
            size: json_size,
            max: fee::MAX_TX_SIZE,
        });
    }

    Ok(BuildResult {
        transaction: tx,
        change_amount: change,
    })
}

/// Build a native V31 HTLC lock output script.
///
/// Script layout:
/// `[0x01] [32B hashlock] [8B timeout] [32B claimant pubkey] [32B refund pubkey]`
pub fn htlc_output_script(
    hashlock: &[u8; 32],
    timeout: u64,
    claimant_pk: &[u8; 32],
    refund_pk: &[u8; 32],
) -> Vec<u8> {
    let mut script = Vec::with_capacity(1 + 32 + 8 + 32 + 32);
    script.push(0x01);
    script.extend_from_slice(hashlock);
    script.extend_from_slice(&timeout.to_le_bytes());
    script.extend_from_slice(claimant_pk);
    script.extend_from_slice(refund_pk);
    script
}

/// Build and sign an HTLC lock transaction.
///
/// `signing_key` must be the locker/refund key. `change_address` receives any
/// change. The locked output is sent to the refund address (so the UTXO is
/// discoverable by the locker) and carries the HTLC script.
#[allow(clippy::too_many_arguments)]
pub fn build_htlc_lock(
    signing_key: &SigningKey,
    change_address: &str,
    lock_amount: u64,
    fee: u64,
    available_utxos: &[SpendableUtxo],
    hashlock: &[u8; 32],
    timeout: u64,
    claimant_pk: &[u8; 32],
    refund_pk: &[u8; 32],
) -> Result<BuildResult, WalletError> {
    let target = lock_amount
        .checked_add(fee)
        .ok_or(WalletError::InsufficientFunds {
            available: 0,
            needed: u64::MAX,
        })?;

    let (selected, total) = select_utxos(available_utxos, target, max_tx_inputs_for(2, 0))?;

    let refund_address = crypto::derive_address(refund_pk);
    let script = htlc_output_script(hashlock, timeout, claimant_pk, refund_pk);

    build_batch_payout_inner(
        signing_key,
        change_address,
        &[BatchRecipient {
            address: refund_address,
            amount: lock_amount,
        }],
        fee,
        &selected,
        total,
        1,
        &[],
        Some(script),
    )
}

/// Build and sign an HTLC claim transaction spending a single HTLC UTXO.
#[allow(clippy::too_many_arguments)]
pub fn build_htlc_claim(
    claimant_signing_key: &SigningKey,
    fee: u64,
    lock_utxo: &SpendableUtxo,
    hashlock: &[u8; 32],
    timeout: u64,
    claimant_pk: &[u8; 32],
    refund_pk: &[u8; 32],
    preimage: &[u8; 32],
) -> Result<Transaction, WalletError> {
    if lock_utxo.amount <= fee {
        return Err(WalletError::FeeTooLow {
            fee,
            minimum: lock_utxo.amount,
        });
    }
    let amount = lock_utxo.amount - fee;
    let to = crypto::derive_address(claimant_pk);
    build_htlc_spend(
        claimant_signing_key,
        fee,
        lock_utxo,
        hashlock,
        timeout,
        claimant_pk,
        refund_pk,
        Some(preimage),
        &to,
        amount,
    )
}

/// Build and sign an HTLC refund transaction spending a single HTLC UTXO.
pub fn build_htlc_refund(
    refund_signing_key: &SigningKey,
    fee: u64,
    lock_utxo: &SpendableUtxo,
    hashlock: &[u8; 32],
    timeout: u64,
    claimant_pk: &[u8; 32],
    refund_pk: &[u8; 32],
) -> Result<Transaction, WalletError> {
    if lock_utxo.amount <= fee {
        return Err(WalletError::FeeTooLow {
            fee,
            minimum: lock_utxo.amount,
        });
    }
    let amount = lock_utxo.amount - fee;
    let to = crypto::derive_address(refund_pk);
    build_htlc_spend(
        refund_signing_key,
        fee,
        lock_utxo,
        hashlock,
        timeout,
        claimant_pk,
        refund_pk,
        None,
        &to,
        amount,
    )
}

#[allow(clippy::too_many_arguments)]
fn build_htlc_spend(
    signing_key: &SigningKey,
    _fee: u64,
    lock_utxo: &SpendableUtxo,
    hashlock: &[u8; 32],
    timeout: u64,
    claimant_pk: &[u8; 32],
    refund_pk: &[u8; 32],
    preimage: Option<&[u8; 32]>,
    to: &str,
    amount: u64,
) -> Result<Transaction, WalletError> {
    // Reconstruct the expected HTLC script and verify it matches the UTXO.
    let expected_script = htlc_output_script(hashlock, timeout, claimant_pk, refund_pk);
    if lock_utxo.script != expected_script {
        return Err(WalletError::SigningFailed);
    }

    let output = TransactionOutput {
        amount: Amount::new(amount as u128),
        address: parse_address(to)?,
        script: vec![],
    };

    let mut tx = Transaction {
        version: 1,
        inputs: vec![TransactionInput {
            previous_output: Hash::new(lock_utxo.tx_hash),
            index: lock_utxo.output_index,
            script: Vec::new(),
        }],
        outputs: vec![output],
        memo: vec![],
    };

    let signing_hash = tx.signing_hash();
    let signature = crypto::sign(signing_key, &signing_hash.0);
    let public_key = signing_key.verifying_key().as_bytes().to_vec();

    tx.inputs[0].script = match preimage {
        Some(p) => {
            let mut script = p.to_vec();
            script.extend_from_slice(&signature);
            script.extend_from_slice(&public_key);
            script
        }
        None => {
            let mut script = signature.to_vec();
            script.extend_from_slice(&public_key);
            script
        }
    };

    Ok(tx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{derive_address, generate_keypair};
    use crate::utxo::UtxoSet;

    fn dust_utxos(count: usize, amount_each: u64, address: &str) -> Vec<SpendableUtxo> {
        (0..count)
            .map(|i| {
                let mut tx_hash = [0u8; 32];
                tx_hash[..8].copy_from_slice(&(i as u64).to_le_bytes());
                SpendableUtxo {
                    tx_hash,
                    output_index: 0,
                    amount: amount_each,
                    address: address.to_string(),
                    script: vec![],
                    block_height: 1,
                    is_coinbase: false,
                }
            })
            .collect()
    }

    #[test]
    fn send_caps_inputs_under_json_size_budget() {
        let (sk, vk) = generate_keypair();
        let addr = derive_address(vk.as_bytes());
        let to = derive_address(&[9u8; 32]);
        // 400 tiny UTXOs — the balance is enough, but covering 200 ZION
        // needs more inputs than fit under the 100 KB serialized-size cap.
        let utxos = dust_utxos(400, 1_000_000, &addr);
        let err = build_send_with_memo(&sk, &addr, &to, 200_000_000, 10_000_000, &utxos, b"")
            .unwrap_err();
        match err {
            WalletError::TooManyInputs {
                max_inputs,
                covered,
                needed,
            } => {
                assert!(max_inputs < 400);
                assert!(covered < needed);
            }
            other => panic!("expected TooManyInputs, got {other}"),
        }
    }

    #[test]
    fn send_under_input_cap_builds_tx_that_fits() {
        let (sk, vk) = generate_keypair();
        let addr = derive_address(vk.as_bytes());
        let to = derive_address(&[9u8; 32]);
        // Boundary: 170 ZION across 1-ZION UTXOs needs ~170 inputs — inside
        // the cap but large enough that the serde check actually matters.
        let utxos = dust_utxos(200, 1_000_000, &addr);
        let fee = 100_000;
        let build =
            build_send_with_memo(&sk, &addr, &to, 170_000_000, fee, &utxos, b"ok").unwrap();
        assert!(build.transaction.inputs.len() >= 170);
        let size = serde_json::to_vec(&build.transaction).unwrap().len();
        assert!(size <= fee::MAX_TX_SIZE, "built tx {size} exceeds cap");
    }

    #[test]
    fn send_rejects_fee_below_size_minimum() {
        let (sk, vk) = generate_keypair();
        let addr = derive_address(vk.as_bytes());
        let to = derive_address(&[9u8; 32]);
        // 150 ZION across 1-ZION UTXOs needs 16 inputs → min fee 2284 > 1.
        let utxos = dust_utxos(80, 10_000_000, &addr);
        let err = build_send_with_memo(&sk, &addr, &to, 150_000_000, 1, &utxos, b"").unwrap_err();
        assert!(matches!(err, WalletError::FeeTooLow { fee: 1, .. }));
    }

    #[test]
    fn batch_inner_backstops_oversized_tx() {
        let (sk, vk) = generate_keypair();
        let addr = derive_address(vk.as_bytes());
        let to = derive_address(&[9u8; 32]);
        // Bypass the selection cap by calling the inner builder directly —
        // the post-build serde check must still refuse the tx.
        let dust = dust_utxos(300, 10_000_000, &addr);
        let selected: Vec<&SpendableUtxo> = dust.iter().collect();
        let total: u64 = selected.iter().map(|u| u.amount).sum();
        let err = build_batch_payout_inner(
            &sk,
            &addr,
            &[BatchRecipient {
                address: to,
                amount: 10_000_000,
            }],
            10_000_000,
            &selected,
            total,
            1,
            b"",
            None,
        )
        .unwrap_err();
        assert!(matches!(err, WalletError::TxTooLarge { .. }));
    }

    #[test]
    fn estimate_send_fee_converges() {
        let addr = derive_address(&[5u8; 32]);
        let utxos = dust_utxos(60, 10_000_000, &addr);
        let fee = estimate_send_fee(150_000_000, &utxos).unwrap();
        // 16 inputs → est size 52 + 16*132 + 2*60 = 2284 → fee must cover it.
        let min = fee::minimum_fee_for_size(fee::estimate_tx_size(16, 2));
        assert!(fee >= min, "estimated fee {fee} below {min}");
    }

    #[test]
    fn plan_consolidation_picks_largest_first() {
        let addr = derive_address(&[5u8; 32]);
        let mut utxos = dust_utxos(10, 1_000, &addr);
        utxos.push(SpendableUtxo {
            tx_hash: [9u8; 32],
            output_index: 0,
            amount: 9_000_000,
            address: addr,
            script: vec![],
            block_height: 1,
            is_coinbase: false,
        });
        let (batch, total) = plan_consolidation(&utxos, 5, 2).unwrap();
        assert_eq!(batch.len(), 5);
        // Largest-first: the 9M utxo plus the four 1k ones.
        assert_eq!(total, 9_000_000 + 4_000);
        assert_eq!(batch[0].amount, 9_000_000);
        // Below min_batch → no plan.
        assert!(plan_consolidation(&utxos[..1], 5, 2).is_none());
    }

    #[test]
    fn build_and_validate_payout() {
        let (sk, vk) = generate_keypair();
        let pool_addr = derive_address(vk.as_bytes());

        // Fund the pool with a coinbase-like output.
        let coinbase = Transaction {
            version: 1,
            inputs: vec![],
            outputs: vec![TransactionOutput {
                amount: Amount::new(10_000_000_000),
                address: Address::new(ChainId::ZionL1, vec![], &pool_addr).unwrap(),
                ..Default::default()
            }],
            memo: vec![],
        };

        let mut utxo_set = UtxoSet::new();
        utxo_set.apply_transaction(&coinbase, 1, 0).unwrap();

        let tx_hash = coinbase.hash().0;
        let utxos = vec![SpendableUtxo {
            tx_hash,
            output_index: 0,
            amount: 10_000_000_000,
            address: pool_addr.clone(),
            script: vec![],
            block_height: 1,
            is_coinbase: true,
        }];

        let (_miner_vk, miner_pk) = generate_keypair();
        let miner_addr = derive_address(miner_pk.as_bytes());

        let recipients = vec![BatchRecipient {
            address: miner_addr,
            amount: 1_000_000_000,
        }];

        let build = build_batch_payout(&sk, &pool_addr, &recipients, 1000, &utxos).unwrap();
        let tx = build.transaction;

        // The transaction must pass the node's UTXO validation.
        utxo_set.validate_transaction(&tx).unwrap();
    }

    #[test]
    fn build_admin_unlock_rejects_non_admin_inputs() {
        let (sk, vk) = generate_keypair();
        let not_admin = derive_address(vk.as_bytes());
        let utxo = SpendableUtxo {
            tx_hash: [1u8; 32],
            output_index: 0,
            amount: 1_000_000,
            address: not_admin.clone(),
            script: vec![],
            block_height: 1,
            is_coinbase: false,
        };
        let inputs = vec![(sk, utxo)];
        let err = build_admin_unlock_tx(
            &inputs,
            &not_admin,
            v3_compat::ADMIN_L1_ADDRESSES[0],
            None,
            10_000,
        )
        .unwrap_err();
        assert!(matches!(err, WalletError::InvalidAddress(_)));
    }

    #[test]
    fn build_admin_unlock_rejects_unknown_target_and_thin_quorum() {
        // Even with structurally admin-shaped inputs, an unknown premine
        // target is rejected before any signature work happens.
        let inputs: Vec<(SigningKey, SpendableUtxo)> = v3_compat::ADMIN_L1_ADDRESSES
            .iter()
            .map(|addr| {
                let (sk, _vk) = generate_keypair();
                (
                    sk,
                    SpendableUtxo {
                        tx_hash: [7u8; 32],
                        output_index: 0,
                        amount: 1_000_000,
                        address: addr.to_string(),
                        script: vec![],
                        block_height: 1,
                        is_coinbase: false,
                    },
                )
            })
            .collect();
        let err = build_admin_unlock_tx(&inputs, "zion1test", "zion1notpremine", None, 10_000)
            .unwrap_err();
        assert!(matches!(err, WalletError::InvalidAddress(_)));
        // Keys that do not derive to the claimed admin address are rejected.
        let err = build_admin_unlock_tx(
            &inputs,
            "zion1test",
            v3_compat::PREMINE_OUTPUTS[0].address,
            None,
            10_000,
        )
        .unwrap_err();
        assert_eq!(err, WalletError::SigningFailed);
    }

    #[test]
    fn build_send_with_memo_attaches_and_signs_memo() {
        let (sk, vk) = generate_keypair();
        let sender_addr = derive_address(vk.as_bytes());

        let coinbase = Transaction {
            version: 1,
            inputs: vec![],
            outputs: vec![TransactionOutput {
                amount: Amount::new(10_000_000_000),
                address: Address::new(ChainId::ZionL1, vec![], &sender_addr).unwrap(),
                ..Default::default()
            }],
            memo: vec![],
        };

        let mut utxo_set = UtxoSet::new();
        utxo_set.apply_transaction(&coinbase, 1, 0).unwrap();

        let utxos = vec![SpendableUtxo {
            tx_hash: coinbase.hash().0,
            output_index: 0,
            amount: 10_000_000_000,
            address: sender_addr.clone(),
            script: vec![],
            block_height: 1,
            is_coinbase: true,
        }];

        let (_recipient_vk, recipient_pk) = generate_keypair();
        let recipient_addr = derive_address(recipient_pk.as_bytes());

        let memo = b"e2e-test-devin";
        let build = build_send_with_memo(
            &sk,
            &sender_addr,
            &recipient_addr,
            1_000_000,
            10_000,
            &utxos,
            memo,
        )
        .unwrap();
        let tx = build.transaction;

        // Memo must be stored verbatim and included in the signed payload.
        assert_eq!(tx.memo, memo);
        utxo_set.validate_transaction(&tx).unwrap();

        // build_send() (no memo) must still produce an empty memo — this is
        // the pre-existing behavior callers without a memo rely on.
        let build_no_memo = build_send(
            &sk,
            &sender_addr,
            &recipient_addr,
            1_000_000,
            10_000,
            &utxos,
        )
        .unwrap();
        assert!(build_no_memo.transaction.memo.is_empty());
    }
}
