//! In-memory UTXO set for the V31 native chain.
//!
//! Alpha implementation: the set is rebuilt from storage at startup and
//! updated on every accepted block. Mempool validation uses a clone of the
//! current set so invalid or double-spending transactions are rejected before
//! they reach a block template.

use std::collections::HashMap;

use zion_l1_types::{Address, Amount, Hash};

use crate::block::Block;
use crate::crypto;
use crate::fee;
use crate::transaction::{Transaction, TransactionInput};

/// An unspent transaction output identifier.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct Outpoint {
    pub tx_hash: Hash,
    pub index: u32,
}

impl Outpoint {
    pub fn new(tx_hash: Hash, index: u32) -> Self {
        Self { tx_hash, index }
    }
}

impl From<&TransactionInput> for Outpoint {
    fn from(input: &TransactionInput) -> Self {
        Self::new(input.previous_output, input.index)
    }
}

/// Unspent output data.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UtxoOutput {
    pub amount: Amount,
    pub address: Address,
    pub block_height: u64,
    pub block_timestamp: u64,
    /// Whether this output was created by a coinbase transaction.
    pub is_coinbase: bool,
}

/// UTXO validation / application error.
#[derive(Debug, thiserror::Error)]
pub enum UtxoError {
    #[error("input not found: {0:?}")]
    InputNotFound(Outpoint),
    #[error("input {0:?} is already spent")]
    AlreadySpent(Outpoint),
    #[error("insufficient funds: have {have}, need {need}")]
    InsufficientFunds { have: u128, need: u128 },
    #[error("output {0} has zero amount")]
    ZeroOutput(usize),
    #[error("fee {fee} below minimum {minimum}")]
    FeeTooLow { fee: u128, minimum: u128 },
    #[error("invalid signature for input {0}")]
    InvalidSignature(usize),
    #[error("output address mismatch for input {0}")]
    AddressMismatch(usize),
    #[error("invalid destination address: {0}")]
    InvalidAddress(String),
    #[error("transaction is already in the UTXO set")]
    DuplicateTransaction,
    #[error("coinbase output {outpoint:?} is immature: age {age} < {required}")]
    ImmatureCoinbase { outpoint: Outpoint, age: u64, required: u64 },
    #[error("premine output is locked: {address} ({reason})")]
    PremineLocked { address: String, reason: String },
}

/// In-memory UTXO set.
#[derive(Clone, Debug, Default)]
pub struct UtxoSet {
    outputs: HashMap<Outpoint, UtxoOutput>,
}

impl UtxoSet {
    pub fn new() -> Self {
        Self {
            outputs: HashMap::new(),
        }
    }

    /// Return unspent outputs for the given encoded address.
    ///
    /// Tuple: `(tx_hash, output_index, amount, block_height, block_timestamp,
    /// is_coinbase)`.
    pub fn get_utxos_for_address(&self, address: &str) -> Vec<(Hash, u32, u64, u64, u64, bool)> {
        let mut out = Vec::new();
        for (outpoint, output) in &self.outputs {
            if output.address.encoded == address {
                let amount = output.amount.0;
                if amount <= u64::MAX as u128 {
                    out.push((
                        outpoint.tx_hash,
                        outpoint.index,
                        amount as u64,
                        output.block_height,
                        output.block_timestamp,
                        output.is_coinbase,
                    ));
                }
            }
        }
        // Deterministic ordering for callers that rely on stable results.
        out.sort_by(|a, b| a.0 .0.cmp(&b.0 .0).then(a.1.cmp(&b.1)));
        out
    }

    /// True if the outpoint is currently unspent.
    pub fn contains(&self, outpoint: &Outpoint) -> bool {
        self.outputs.contains_key(outpoint)
    }

    /// Look up an unspent output.
    pub fn get(&self, outpoint: &Outpoint) -> Option<&UtxoOutput> {
        self.outputs.get(outpoint)
    }

    /// Validate a transaction against this UTXO set and return the fee.
    pub fn validate_transaction(&self, tx: &Transaction) -> Result<u128, UtxoError> {
        // Validate against a disposable clone so the real set is untouched.
        self.clone().apply_transaction(tx, 0, 0)
    }

    /// Apply a transaction to the set, validating it first.
    ///
    /// Returns the fee (input sum - output sum) for non-coinbase transactions
    /// and 0 for coinbase transactions.
    pub fn apply_transaction(
        &mut self,
        tx: &Transaction,
        block_height: u64,
        block_timestamp: u64,
    ) -> Result<u128, UtxoError> {
        if tx.is_coinbase() {
            return self.apply_coinbase(tx, block_height, block_timestamp);
        }

        // Collect the outputs being spent before we remove them, and verify
        // signatures before mutating the set.
        let signing_hash = tx.signing_hash();
        let mut inputs = Vec::with_capacity(tx.inputs.len());
        for (i, input) in tx.inputs.iter().enumerate() {
            let outpoint = Outpoint::from(input);
            let output = self
                .outputs
                .get(&outpoint)
                .ok_or(UtxoError::InputNotFound(outpoint))?
                .clone();

            if !verify_input(input, &signing_hash, &output.address.encoded) {
                return Err(if input.script.len() < 96 {
                    UtxoError::InvalidSignature(i)
                } else {
                    UtxoError::AddressMismatch(i)
                });
            }

            inputs.push((outpoint, output));
        }

        // Validate output amounts and total.
        let mut output_sum: u128 = 0;
        for (i, output) in tx.outputs.iter().enumerate() {
            if output.amount.0 == 0 {
                return Err(UtxoError::ZeroOutput(i));
            }
            if !crypto::is_valid_address(&output.address.encoded) {
                return Err(UtxoError::InvalidAddress(output.address.encoded.clone()));
            }
            output_sum = output_sum
                .checked_add(output.amount.0)
                .ok_or(UtxoError::InsufficientFunds {
                    have: 0,
                    need: u128::MAX,
                })?;
        }

        // Remove inputs after all signatures check out.
        let mut input_sum: u128 = 0;
        for (outpoint, output) in &inputs {
            input_sum = input_sum
                .checked_add(output.amount.0)
                .ok_or(UtxoError::InsufficientFunds {
                    have: u128::MAX,
                    need: output_sum,
                })?;
            self.outputs.remove(outpoint);
        }

        if output_sum > input_sum {
            return Err(UtxoError::InsufficientFunds {
                have: input_sum,
                need: output_sum,
            });
        }

        let fee = input_sum - output_sum;
        let min_fee = fee::minimum_fee_for_size(fee::estimate_tx_size(tx.inputs.len(), tx.outputs.len())) as u128;
        if fee < min_fee {
            return Err(UtxoError::FeeTooLow { fee, minimum: min_fee });
        }

        // Add the new outputs.
        let tx_hash = tx.hash();
        for (index, output) in tx.outputs.iter().enumerate() {
            let outpoint = Outpoint::new(tx_hash, index as u32);
            self.outputs.insert(
                outpoint,
                UtxoOutput {
                    amount: output.amount,
                    address: output.address.clone(),
                    block_height,
                    block_timestamp,
                    is_coinbase: false,
                },
            );
        }

        Ok(fee)
    }

    fn apply_coinbase(
        &mut self,
        tx: &Transaction,
        block_height: u64,
        block_timestamp: u64,
    ) -> Result<u128, UtxoError> {
        for (i, output) in tx.outputs.iter().enumerate() {
            if output.amount.0 == 0 {
                return Err(UtxoError::ZeroOutput(i));
            }
            let outpoint = Outpoint::new(tx.hash(), i as u32);
            self.outputs.insert(
                outpoint,
                UtxoOutput {
                    amount: output.amount,
                    address: output.address.clone(),
                    block_height,
                    block_timestamp,
                    is_coinbase: true,
                },
            );
        }
        Ok(0)
    }

    /// Apply an entire block to the set, atomically.
    pub fn apply_block(&mut self, block: &Block) -> Result<(), UtxoError> {
        let mut next = self.clone();
        let block_height = block.header.height;
        let block_timestamp = block.header.timestamp;
        for tx in &block.transactions {
            next.apply_transaction(tx, block_height, block_timestamp)?;
        }
        *self = next;
        Ok(())
    }

    /// True if the transaction hash is already present as an unspent output.
    ///
    /// This catches exact transaction duplicates; it does not detect
    /// malleability because the UTXO ID includes the signatures.
    pub fn has_transaction(&self, tx_hash: &Hash) -> bool {
        self.outputs.keys().any(|o| &o.tx_hash == tx_hash)
    }
}

/// Verify an input script.
///
/// Script format: <signature bytes> || <32-byte public key>.
/// The public key is taken from the last 32 bytes, the signature from the
/// preceding bytes. The signature must be valid over `signing_hash` and the
/// public key must derive to the expected address.
fn verify_input(input: &TransactionInput, signing_hash: &Hash, expected_address: &str) -> bool {
    if input.script.len() < 96 {
        return false;
    }
    let (sig, pk) = input.script.split_at(input.script.len() - 32);
    if !crypto::verify(pk, &signing_hash.0, sig) {
        return false;
    }
    crypto::derive_address(pk) == expected_address
}
