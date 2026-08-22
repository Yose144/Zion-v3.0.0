//! V31-native wallet — UTXO coin selection, batch payout building, and signing.
//!
//! This is the canonical wallet logic for the V31 mainnet chain. It builds
//! [`crate::transaction::Transaction`] values and signs them with the
//! Ed25519 `signing_hash` scheme used by `UtxoSet` validation.

use ed25519_dalek::SigningKey;
use zion_l1_types::{Address, Amount, ChainId, Hash};

use crate::crypto;
use crate::transaction::{Transaction, TransactionInput, TransactionOutput};

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
        }
    }
}

impl std::error::Error for WalletError {}

/// Select UTXOs using largest-first strategy.
///
/// Returns selected UTXOs and total selected amount, or error if insufficient.
fn select_utxos(
    available: &[SpendableUtxo],
    target: u64,
) -> Result<(Vec<&SpendableUtxo>, u64), WalletError> {
    if available.is_empty() {
        return Err(WalletError::NoUtxos);
    }

    let mut sorted: Vec<&SpendableUtxo> = available.iter().collect();
    sorted.sort_by(|a, b| b.amount.cmp(&a.amount).then(a.tx_hash.cmp(&b.tx_hash)));

    let mut selected = Vec::new();
    let mut total: u64 = 0;
    for utxo in sorted {
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

/// Validate and normalize a `zion1...` destination address.
fn parse_address(encoded: &str) -> Result<Address, WalletError> {
    if !crypto::is_valid_address(encoded) {
        return Err(WalletError::InvalidAddress(encoded.to_string()));
    }
    Address::new(ChainId::ZionL1, vec![], encoded).map_err(|_| WalletError::InvalidAddress(encoded.to_string()))
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

    // If we don't have enough UTXOs to cover payouts + fee, but we DO have
    // enough to cover just the payouts, reduce the last recipient's amount
    // by the fee shortfall. This avoids "insufficient funds" when the pool
    // has exactly the right amount for payouts but no reserve for the fee.
    let (selected, total) = match select_utxos(available_utxos, target) {
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
            let new_target = new_total_payout.checked_add(fee).unwrap_or(u64::MAX);
            // If still not enough, try with zero fee (dust tx)
            if new_target > available {
                // Last resort: absorb fee entirely into last recipient
                if !adjusted_recipients.is_empty() {
                    let last = adjusted_recipients.len() - 1;
                    adjusted_recipients[last].amount =
                        adjusted_recipients[last].amount.saturating_sub(fee);
                }
                let final_total: u64 = adjusted_recipients.iter().map(|r| r.amount).sum();
                let (sel, tot) = select_utxos(available_utxos, final_total)?;
                return build_batch_payout_inner(
                    signing_key, change_address, &adjusted_recipients, 0, &sel, tot, MIN_PAYOUT_AMOUNT, &[],
                );
            }
            let (sel, tot) = select_utxos(available_utxos, new_target)?;
            return build_batch_payout_inner(
                signing_key, change_address, &adjusted_recipients, fee, &sel, tot, MIN_PAYOUT_AMOUNT, &[],
            );
        }
        Err(e) => return Err(e),
    };

    build_batch_payout_inner(
        signing_key,
        change_address,
        recipients,
        fee,
        &selected,
        total,
        MIN_PAYOUT_AMOUNT,
        &[],
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
    build_send_with_memo(signing_key, change_address, to_address, amount, fee, available_utxos, &[])
}

/// Same as [`build_send`], but attaches an arbitrary memo (e.g. a note or
/// reference id) to the transaction. Memo bytes are stored as-is in
/// `Transaction::memo` and are not validated against any charset/length
/// beyond what the network's max transaction size otherwise permits.
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
        return Err(WalletError::FeeTooLow {
            fee: 0,
            minimum: 1,
        });
    }

    let target = amount
        .checked_add(fee)
        .ok_or(WalletError::InsufficientFunds {
            available: 0,
            needed: u64::MAX,
        })?;

    let (selected, total) = select_utxos(available_utxos, target)?;

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
    )
}

fn total_payout_inner(recipients: &[BatchRecipient], fee: u64) -> u64 {
    let total_payout: u64 = recipients.iter().map(|r| r.amount).sum();
    total_payout.saturating_add(fee)
}

fn build_batch_payout_inner(
    signing_key: &SigningKey,
    change_address: &str,
    recipients: &[BatchRecipient],
    fee: u64,
    selected: &[&SpendableUtxo],
    total: u64,
    min_payout: u64,
    memo: &[u8],
) -> Result<BuildResult, WalletError> {
    let target = total_payout_inner(recipients, fee);
    let change = total - target;

    let mut outputs: Vec<TransactionOutput> = Vec::with_capacity(recipients.len() + 1);
    for r in recipients {
        if r.amount < min_payout {
            // Skip dust outputs; they would fail validation anyway.
            return Err(WalletError::FeeTooLow {
                fee: r.amount,
                minimum: min_payout,
            });
        }
        outputs.push(TransactionOutput {
            amount: Amount::new(r.amount as u128),
            address: parse_address(&r.address)?,
        });
    }
    if change > 0 {
        outputs.push(TransactionOutput {
            amount: Amount::new(change as u128),
            address: parse_address(change_address)?,
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

    Ok(BuildResult {
        transaction: tx,
        change_amount: change,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{derive_address, generate_keypair};
    use crate::utxo::UtxoSet;

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
    fn build_send_with_memo_attaches_and_signs_memo() {
        let (sk, vk) = generate_keypair();
        let sender_addr = derive_address(vk.as_bytes());

        let coinbase = Transaction {
            version: 1,
            inputs: vec![],
            outputs: vec![TransactionOutput {
                amount: Amount::new(10_000_000_000),
                address: Address::new(ChainId::ZionL1, vec![], &sender_addr).unwrap(),
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
        let build_no_memo =
            build_send(&sk, &sender_addr, &recipient_addr, 1_000_000, 10_000, &utxos).unwrap();
        assert!(build_no_memo.transaction.memo.is_empty());
    }
}
