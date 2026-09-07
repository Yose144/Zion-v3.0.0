//! In-memory UTXO set for the V31 native chain.
//!
//! Alpha implementation: the set is rebuilt from storage at startup and
//! updated on every accepted block. Mempool validation uses a clone of the
//! current set so invalid or double-spending transactions are rejected before
//! they reach a block template.

use std::collections::HashMap;

use sha2::{Digest, Sha256 as Sha2};
use zion_l1_types::{Address, Amount, Hash};

use crate::block::Block;
use crate::crypto;
use crate::fee;
use crate::transaction::{Transaction, TransactionInput, TransactionOutput};

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
    /// Output script. Empty = plain P2PKH output owned by `address`.
    pub script: Vec<u8>,
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
    ImmatureCoinbase {
        outpoint: Outpoint,
        age: u64,
        required: u64,
    },
    #[error("premine output is locked: {address} ({reason})")]
    PremineLocked { address: String, reason: String },
    #[error("HTLC output script is invalid for input {0}")]
    InvalidHtlcScript(usize),
    #[error("HTLC preimage does not match hashlock for input {0}")]
    HtlcPreimageMismatch(usize),
    #[error("HTLC timelock expired for claim on input {0}")]
    HtlcClaimExpired(usize),
    #[error("HTLC timelock not yet expired for refund on input {0}")]
    HtlcRefundNotExpired(usize),
    #[error("HTLC public key not authorized for input {0}")]
    HtlcUnauthorizedKey(usize),
    #[error("HTLC spend output must go to the authorized address for input {0}")]
    HtlcInvalidDestination(usize),
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
    /// is_coinbase, script)`.
    #[allow(clippy::type_complexity)]
    pub fn get_utxos_for_address(
        &self,
        address: &str,
    ) -> Vec<(Hash, u32, u64, u64, u64, bool, Vec<u8>)> {
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
                        output.script.clone(),
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
        // Use the current wall-clock time as the block timestamp so HTLC
        // refund transactions can pass mempool validation after their
        // timelock expires.
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        self.clone().apply_transaction(tx, 0, now)
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
        // signatures / output scripts before mutating the set.
        let signing_hash = tx.signing_hash();
        let mut inputs = Vec::with_capacity(tx.inputs.len());
        for (i, input) in tx.inputs.iter().enumerate() {
            let outpoint = Outpoint::from(input);
            let output = self
                .outputs
                .get(&outpoint)
                .ok_or(UtxoError::InputNotFound(outpoint))?
                .clone();

            verify_input(
                i,
                input,
                &signing_hash,
                &output,
                block_timestamp,
                &tx.outputs,
            )?;

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
            output_sum =
                output_sum
                    .checked_add(output.amount.0)
                    .ok_or(UtxoError::InsufficientFunds {
                        have: 0,
                        need: u128::MAX,
                    })?;
        }

        // Remove inputs after all signatures check out.
        let mut input_sum: u128 = 0;
        for (outpoint, output) in &inputs {
            input_sum =
                input_sum
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
        let min_fee =
            fee::minimum_fee_for_size(fee::estimate_tx_size(tx.inputs.len(), tx.outputs.len()))
                as u128;
        if fee < min_fee {
            return Err(UtxoError::FeeTooLow {
                fee,
                minimum: min_fee,
            });
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
                    script: output.script.clone(),
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
                    script: output.script.clone(),
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

    /// Apply an entire block to the set in-place, without cloning.
    /// Used for the one-time UTXO rebuild at startup, where every block is
    /// already known to be valid and stored in our own database.
    pub fn apply_block_unchecked(&mut self, block: &Block) -> Result<(), UtxoError> {
        let block_height = block.header.height;
        let block_timestamp = block.header.timestamp;
        for tx in &block.transactions {
            self.apply_transaction(tx, block_height, block_timestamp)?;
        }
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

/// Verify an input script against the output it spends.
///
/// Empty output script = P2PKH:
///   input script: <signature bytes> || <32-byte public key>
///   The public key must derive to the output address.
///
/// HTLC output script (0x01 prefix):
///   [1B 0x01] [32B hashlock] [8B timeout] [32B claimant pubkey] [32B refund pubkey]
///
/// HTLC claim input:
///   <32B preimage> <64B signature> <32B pubkey>
/// HTLC refund input:
///   <64B signature> <32B pubkey>
fn verify_input(
    index: usize,
    input: &TransactionInput,
    signing_hash: &Hash,
    output: &UtxoOutput,
    block_timestamp: u64,
    tx_outputs: &[TransactionOutput],
) -> Result<(), UtxoError> {
    if output.script.is_empty() {
        // Standard P2PKH.
        if input.script.len() < 96 {
            return Err(UtxoError::InvalidSignature(index));
        }
        let (sig, pk) = input.script.split_at(input.script.len() - 32);
        if !crypto::verify(pk, &signing_hash.0, sig) {
            return Err(UtxoError::InvalidSignature(index));
        }
        if crypto::derive_address(pk) != output.address.encoded {
            return Err(UtxoError::AddressMismatch(index));
        }
        return Ok(());
    }

    if output.script[0] != 0x01 {
        return Err(UtxoError::InvalidHtlcScript(index));
    }
    if output.script.len() != 1 + 32 + 8 + 32 + 32 {
        return Err(UtxoError::InvalidHtlcScript(index));
    }

    let hashlock = &output.script[1..33];
    let timeout = u64::from_le_bytes(output.script[33..41].try_into().unwrap());
    let claimant_pk = &output.script[41..73];
    let refund_pk = &output.script[73..105];

    // Distinguish claim (has preimage) from refund (no preimage) by length.
    if input.script.len() == 96 {
        // Refund path.
        if block_timestamp < timeout {
            return Err(UtxoError::HtlcRefundNotExpired(index));
        }
        return htlc_verify_spender(input, signing_hash, refund_pk, tx_outputs, index);
    }

    if input.script.len() == 128 {
        // Claim path.
        if block_timestamp >= timeout {
            return Err(UtxoError::HtlcClaimExpired(index));
        }
        let preimage = &input.script[0..32];
        let mut hasher = Sha2::new();
        hasher.update(preimage);
        let actual = hasher.finalize();
        if &actual[..] != hashlock {
            return Err(UtxoError::HtlcPreimageMismatch(index));
        }
        return htlc_verify_spender(input, signing_hash, claimant_pk, tx_outputs, index);
    }

    Err(UtxoError::InvalidHtlcScript(index))
}

/// Verify that the HTLC spender's signature is valid and that the transaction
/// sends the funds to the address derived from the authorized public key.
fn htlc_verify_spender(
    input: &TransactionInput,
    signing_hash: &Hash,
    authorized_pk: &[u8],
    tx_outputs: &[TransactionOutput],
    index: usize,
) -> Result<(), UtxoError> {
    if input.script.len() < 96 {
        return Err(UtxoError::InvalidHtlcScript(index));
    }
    let (payload, sig_and_pk) = if input.script.len() == 128 {
        input.script.split_at(32)
    } else {
        (&[] as &[u8], input.script.as_slice())
    };
    let _ = payload;
    if sig_and_pk.len() != 96 {
        return Err(UtxoError::InvalidHtlcScript(index));
    }
    let (sig, pk) = sig_and_pk.split_at(64);
    if pk != authorized_pk {
        return Err(UtxoError::HtlcUnauthorizedKey(index));
    }
    if !crypto::verify(pk, &signing_hash.0, sig) {
        return Err(UtxoError::InvalidSignature(index));
    }
    let expected_address = crypto::derive_address(pk);
    if tx_outputs.len() != 1 || tx_outputs[0].address.encoded != expected_address {
        return Err(UtxoError::HtlcInvalidDestination(index));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{derive_address, generate_keypair};
    use crate::transaction::{Transaction, TransactionOutput};
    use crate::v31_wallet::{
        build_htlc_claim, build_htlc_lock, build_htlc_refund, htlc_output_script, SpendableUtxo,
    };
    use sha2::{Digest, Sha256};
    use zion_l1_types::{Address, Amount, ChainId};

    fn fund_coinbase(utxo_set: &mut UtxoSet, address: &str, amount: u64, height: u64) {
        let coinbase = Transaction {
            version: 1,
            inputs: vec![],
            outputs: vec![TransactionOutput {
                amount: Amount::new(amount as u128),
                address: Address::new(ChainId::ZionL1, vec![], address).unwrap(),
                ..Default::default()
            }],
            memo: vec![],
        };
        utxo_set.apply_transaction(&coinbase, height, 0).unwrap();
    }

    fn spendable(utxo_set: &UtxoSet, address: &str) -> SpendableUtxo {
        let (tx_hash, index, amount, height, _ts, _cb, script) = utxo_set
            .get_utxos_for_address(address)
            .into_iter()
            .find(|u| u.6.is_empty())
            .expect("no plain P2PKH UTXO found");
        SpendableUtxo {
            tx_hash: tx_hash.0,
            output_index: index,
            amount,
            address: address.to_string(),
            script,
            block_height: height,
            is_coinbase: false,
        }
    }

    fn htlc_spendable(utxo_set: &UtxoSet, address: &str) -> SpendableUtxo {
        let (tx_hash, index, amount, height, _ts, _cb, script) = utxo_set
            .get_utxos_for_address(address)
            .into_iter()
            .find(|u| !u.6.is_empty())
            .expect("no HTLC UTXO found");
        SpendableUtxo {
            tx_hash: tx_hash.0,
            output_index: index,
            amount,
            address: address.to_string(),
            script,
            block_height: height,
            is_coinbase: false,
        }
    }

    #[test]
    fn htlc_lock_claim_native_succeeds() {
        let (locker_sk, locker_pk) = generate_keypair();
        let (claimant_sk, claimant_pk) = generate_keypair();
        let (_refund_sk, refund_pk) = (locker_sk.clone(), locker_pk);

        let locker_addr = derive_address(locker_pk.as_bytes());
        let claimant_addr = derive_address(claimant_pk.as_bytes());

        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &locker_addr, 10_000_000_000, 1);

        let preimage = b"preimagepreimagepreimagepreimage".as_slice();
        let mut hasher = Sha256::new();
        hasher.update(preimage);
        let hashlock: [u8; 32] = hasher.finalize().into();
        let timeout = 1000u64;

        let utxo = spendable(&utxo_set, &locker_addr);
        let build = build_htlc_lock(
            &locker_sk,
            &locker_addr,
            1_000_000_000,
            10_000,
            &[utxo],
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
        )
        .unwrap();

        let lock_tx = build.transaction;
        utxo_set.apply_transaction(&lock_tx, 2, 100).unwrap();

        let refund_addr = derive_address(refund_pk.as_bytes());
        let lock_utxo = htlc_spendable(&utxo_set, &refund_addr);

        // Claim before timeout.
        let claim_tx = build_htlc_claim(
            &claimant_sk,
            10_000,
            &lock_utxo,
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
            &preimage.try_into().unwrap(),
        )
        .unwrap();

        utxo_set.apply_transaction(&claim_tx, 3, 200).unwrap();
        assert_eq!(utxo_set.get_utxos_for_address(&claimant_addr).len(), 1);
    }

    #[test]
    fn htlc_refund_native_succeeds_after_timeout() {
        let (locker_sk, locker_pk) = generate_keypair();
        let (_claimant_sk, claimant_pk) = generate_keypair();
        let (refund_sk, refund_pk) = (locker_sk.clone(), locker_pk);

        let locker_addr = derive_address(locker_pk.as_bytes());
        let refund_addr = derive_address(refund_pk.as_bytes());

        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &locker_addr, 10_000_000_000, 1);

        let hashlock = [42u8; 32];
        let timeout = 1000u64;

        let utxo = spendable(&utxo_set, &locker_addr);
        let build = build_htlc_lock(
            &locker_sk,
            &locker_addr,
            1_000_000_000,
            10_000,
            &[utxo],
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
        )
        .unwrap();

        utxo_set
            .apply_transaction(&build.transaction, 2, 100)
            .unwrap();

        let lock_utxo = htlc_spendable(&utxo_set, &refund_addr);
        let refund_tx = build_htlc_refund(
            &refund_sk,
            10_000,
            &lock_utxo,
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
        )
        .unwrap();

        // Timeout has passed.
        utxo_set.apply_transaction(&refund_tx, 3, 1001).unwrap();
        let total: u64 = utxo_set
            .get_utxos_for_address(&refund_addr)
            .iter()
            .map(|u| u.2)
            .sum();
        assert_eq!(total, 9_999_980_000);
    }

    #[test]
    fn htlc_claim_fails_after_timeout() {
        let (locker_sk, locker_pk) = generate_keypair();
        let (claimant_sk, claimant_pk) = generate_keypair();
        let (_refund_sk, refund_pk) = (locker_sk.clone(), locker_pk);

        let locker_addr = derive_address(locker_pk.as_bytes());

        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &locker_addr, 10_000_000_000, 1);

        let preimage = b"preimagepreimagepreimagepreimage";
        let mut hasher = Sha256::new();
        hasher.update(preimage);
        let hashlock: [u8; 32] = hasher.finalize().into();
        let timeout = 1000u64;

        let utxo = spendable(&utxo_set, &locker_addr);
        let build = build_htlc_lock(
            &locker_sk,
            &locker_addr,
            1_000_000_000,
            10_000,
            &[utxo],
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
        )
        .unwrap();

        utxo_set
            .apply_transaction(&build.transaction, 2, 100)
            .unwrap();
        let refund_addr = derive_address(refund_pk.as_bytes());
        let lock_utxo = htlc_spendable(&utxo_set, &refund_addr);

        let claim_tx = build_htlc_claim(
            &claimant_sk,
            10_000,
            &lock_utxo,
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
            &preimage.as_slice().try_into().unwrap(),
        )
        .unwrap();

        let err = utxo_set.apply_transaction(&claim_tx, 3, 1001).unwrap_err();
        assert!(matches!(err, UtxoError::HtlcClaimExpired(0)));
    }

    #[test]
    fn htlc_refund_fails_before_timeout() {
        let (locker_sk, locker_pk) = generate_keypair();
        let (_claimant_sk, claimant_pk) = generate_keypair();
        let (refund_sk, refund_pk) = (locker_sk.clone(), locker_pk);

        let locker_addr = derive_address(locker_pk.as_bytes());

        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &locker_addr, 10_000_000_000, 1);

        let hashlock = [42u8; 32];
        let timeout = 1000u64;

        let utxo = spendable(&utxo_set, &locker_addr);
        let build = build_htlc_lock(
            &locker_sk,
            &locker_addr,
            1_000_000_000,
            10_000,
            &[utxo],
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
        )
        .unwrap();

        utxo_set
            .apply_transaction(&build.transaction, 2, 100)
            .unwrap();
        let refund_addr = derive_address(refund_pk.as_bytes());
        let lock_utxo = htlc_spendable(&utxo_set, &refund_addr);

        let refund_tx = build_htlc_refund(
            &refund_sk,
            10_000,
            &lock_utxo,
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            refund_pk.as_bytes(),
        )
        .unwrap();

        let err = utxo_set.apply_transaction(&refund_tx, 3, 999).unwrap_err();
        assert!(matches!(err, UtxoError::HtlcRefundNotExpired(0)));
    }

    #[test]
    fn htlc_output_script_is_preserved_in_utxo() {
        let (locker_sk, locker_pk) = generate_keypair();
        let (_claimant_sk, claimant_pk) = generate_keypair();

        let locker_addr = derive_address(locker_pk.as_bytes());
        let refund_addr = derive_address(locker_pk.as_bytes());
        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &locker_addr, 10_000_000_000, 1);

        let hashlock = [7u8; 32];
        let timeout = 5000u64;
        let script = htlc_output_script(
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            locker_pk.as_bytes(),
        );

        let utxo = spendable(&utxo_set, &locker_addr);
        let build = build_htlc_lock(
            &locker_sk,
            &locker_addr,
            1_000_000_000,
            10_000,
            &[utxo],
            &hashlock,
            timeout,
            claimant_pk.as_bytes(),
            locker_pk.as_bytes(),
        )
        .unwrap();

        utxo_set
            .apply_transaction(&build.transaction, 2, 100)
            .unwrap();
        let lock_utxo = htlc_spendable(&utxo_set, &refund_addr);
        assert_eq!(lock_utxo.script, script);
    }
}
