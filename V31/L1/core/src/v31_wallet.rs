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

    let (selected, total) = select_utxos(available_utxos, target)?;
    let change = total - target;

    let mut outputs: Vec<TransactionOutput> = Vec::with_capacity(recipients.len() + 1);
    for r in recipients {
        if r.amount < MIN_PAYOUT_AMOUNT {
            // Skip dust outputs; they would fail validation anyway.
            return Err(WalletError::FeeTooLow {
                fee: r.amount,
                minimum: MIN_PAYOUT_AMOUNT,
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
    for utxo in &selected {
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
        memo: Vec::new(),
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
        utxo_set.apply_transaction(&coinbase).unwrap();

        let tx_hash = coinbase.hash().0;
        let utxos = vec![SpendableUtxo {
            tx_hash,
            output_index: 0,
            amount: 10_000_000_000,
            address: pool_addr.clone(),
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
}
