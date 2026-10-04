//! In-memory UTXO set for the V31 native chain.
//!
//! Alpha implementation: the set is rebuilt from storage at startup and
//! updated on every accepted block. Mempool validation uses a clone of the
//! current set so invalid or double-spending transactions are rejected before
//! they reach a block template.

use std::collections::{BTreeSet, HashMap, HashSet};

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
    #[error("duplicate outpoint in cache snapshot: {0:?}")]
    DuplicateOutpoint(Outpoint),
}

/// In-memory UTXO set.
#[derive(Clone, Debug)]
pub struct UtxoSet {
    outputs: HashMap<Outpoint, UtxoOutput>,
    /// Premine addresses whose admin-lock has been released by an on-chain
    /// 3-of-3 admin unlock transaction. Rebuilt deterministically from stored
    /// blocks at startup, exactly like `outputs`.
    admin_unlocked: BTreeSet<String>,
    /// Admin L1 addresses that must all appear as spent inputs in an unlock
    /// transaction. Defaults to the canonical 3-of-3 set
    /// (`v3_compat::ADMIN_L1_ADDRESSES`).
    admin_addresses: Vec<String>,
}

impl Default for UtxoSet {
    fn default() -> Self {
        Self::new()
    }
}

impl UtxoSet {
    pub fn new() -> Self {
        Self {
            outputs: HashMap::new(),
            admin_unlocked: BTreeSet::new(),
            admin_addresses: crate::v3_compat::ADMIN_L1_ADDRESSES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        }
    }

    /// True if `address` is a premine slot released by an on-chain admin
    /// unlock authorization.
    pub fn is_admin_unlocked(&self, address: &str) -> bool {
        self.admin_unlocked.contains(address)
    }

    /// All premine addresses released by admin unlock transactions so far.
    pub fn admin_unlocked(&self) -> &BTreeSet<String> {
        &self.admin_unlocked
    }

    /// Test hook: replace the admin multisig set so tests can sign unlock
    /// transactions with freshly generated keys.
    #[cfg(test)]
    pub fn set_admin_addresses_for_test<I, S>(&mut self, addrs: I)
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.admin_addresses = addrs.into_iter().map(Into::into).collect();
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
        self.apply_transaction_inner(tx, block_height, block_timestamp, true)
    }

    /// Apply a transaction that was already fully validated when its block was
    /// accepted into our own block store.
    ///
    /// Identical to `apply_transaction` except that Ed25519 signature and HTLC
    /// script execution (`verify_input`) is skipped — every structural rule
    /// (input existence, output amounts/addresses, sums, minimum fee,
    /// admin-unlock detection) is still enforced. Only for replaying trusted
    /// on-disk blocks; never for mempool or live block acceptance.
    pub(crate) fn apply_transaction_trusted_replay(
        &mut self,
        tx: &Transaction,
        block_height: u64,
        block_timestamp: u64,
    ) -> Result<u128, UtxoError> {
        self.apply_transaction_inner(tx, block_height, block_timestamp, false)
    }

    fn apply_transaction_inner(
        &mut self,
        tx: &Transaction,
        block_height: u64,
        block_timestamp: u64,
        verify_scripts: bool,
    ) -> Result<u128, UtxoError> {
        if tx.is_coinbase() {
            return self.apply_coinbase(tx, block_height, block_timestamp);
        }

        // Collect the outputs being spent before we remove them, and verify
        // signatures / output scripts before mutating the set. The signing
        // hash is only needed for script verification, not trusted replay.
        let signing_hash = verify_scripts.then(|| tx.signing_hash());
        let mut inputs = Vec::with_capacity(tx.inputs.len());
        let mut seen = HashSet::with_capacity(tx.inputs.len());
        for (i, input) in tx.inputs.iter().enumerate() {
            let outpoint = Outpoint::from(input);
            if !seen.insert(outpoint) {
                return Err(UtxoError::AlreadySpent(outpoint));
            }
            let output = self
                .outputs
                .get(&outpoint)
                .ok_or(UtxoError::InputNotFound(outpoint))?
                .clone();

            if let Some(signing_hash) = &signing_hash {
                verify_input(
                    i,
                    input,
                    signing_hash,
                    &output,
                    block_timestamp,
                    &tx.outputs,
                )?;
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

        // Governance: a transaction that spent UTXOs owned by every admin
        // address (all inputs signature-verified above) and carries the
        // unlock memo releases the named premine address from this point in
        // the chain onward. The record is part of the applied state, so the
        // startup rebuild replays it identically on every node.
        let admins: Vec<&str> = self.admin_addresses.iter().map(String::as_str).collect();
        if let Some(target) = crate::v3_compat::admin_unlock_target(
            tx,
            inputs.iter().map(|(_, o)| o.address.encoded.as_str()),
            &admins,
        ) {
            self.admin_unlocked.insert(target);
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
            self.apply_transaction_trusted_replay(tx, block_height, block_timestamp)?;
        }
        Ok(())
    }

    /// Reverse `apply_block`: remove the outputs the block created and
    /// restore the outputs it spent. `spent` maps each consumed outpoint to
    /// its previous live entry (resolved by the caller from the block store).
    ///
    /// Transactions are un-applied in reverse order so intra-block spends
    /// restore correctly. Admin-unlock effects are reverted by re-deriving
    /// the unlock target from the restored input owners.
    pub fn unapply_block(
        &mut self,
        block: &Block,
        spent: &HashMap<Outpoint, UtxoOutput>,
    ) -> Result<(), UtxoError> {
        for tx in block.transactions.iter().rev() {
            let tx_hash = tx.hash();
            for (index, _output) in tx.outputs.iter().enumerate() {
                let outpoint = Outpoint::new(tx_hash, index as u32);
                if self.outputs.remove(&outpoint).is_none() {
                    // Every output the block created must be live (or have
                    // been restored by a descendant block's rollback). A
                    // missing entry means the set diverged from the stored
                    // chain — refuse to roll back into a corrupt state.
                    return Err(UtxoError::InputNotFound(outpoint));
                }
            }
            if tx.is_coinbase() {
                continue;
            }
            let mut restored_owners = Vec::with_capacity(tx.inputs.len());
            for input in &tx.inputs {
                let outpoint = Outpoint::from(input);
                let output = spent
                    .get(&outpoint)
                    .cloned()
                    .ok_or(UtxoError::InputNotFound(outpoint))?;
                self.outputs.insert(outpoint, output.clone());
                restored_owners.push(output.address.encoded);
            }
            let admins: Vec<&str> = self.admin_addresses.iter().map(String::as_str).collect();
            if let Some(target) = crate::v3_compat::admin_unlock_target(
                tx,
                restored_owners.iter().map(String::as_str),
                &admins,
            ) {
                self.admin_unlocked.remove(&target);
            }
        }
        Ok(())
    }

    /// Number of live outputs in the set (cache bookkeeping).
    pub(crate) fn output_count(&self) -> usize {
        self.outputs.len()
    }

    /// Iterate all live outputs for the discardable persistent cache without
    /// cloning the map.
    pub(crate) fn cache_entries(&self) -> impl Iterator<Item = (&Outpoint, &UtxoOutput)> {
        self.outputs.iter()
    }

    /// Snapshot of the admin-unlock set for the discardable persistent cache.
    pub(crate) fn admin_unlocks_for_cache(&self) -> Vec<String> {
        self.admin_unlocked.iter().cloned().collect()
    }

    /// Rebuild a set from cache entries previously produced by
    /// `cache_entries`/`admin_unlocks_for_cache`. Uses the canonical admin
    /// address config; duplicate outpoints are rejected.
    pub(crate) fn from_cache_entries(
        entries: Vec<(Outpoint, UtxoOutput)>,
        admin_unlocks: Vec<String>,
    ) -> Result<Self, UtxoError> {
        let mut set = Self::new();
        for (outpoint, output) in entries {
            if set.outputs.insert(outpoint, output).is_some() {
                return Err(UtxoError::DuplicateOutpoint(outpoint));
            }
        }
        set.admin_unlocked = admin_unlocks.into_iter().collect();
        Ok(set)
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
        build_htlc_claim, build_htlc_lock, build_htlc_refund, build_send, htlc_output_script,
        SpendableUtxo,
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

    #[test]
    fn trusted_replay_skips_signature_verification() {
        let (_owner_sk, owner_vk) = generate_keypair();
        let owner_addr = derive_address(owner_vk.as_bytes());
        let (_recipient_sk, recipient_vk) = generate_keypair();
        let recipient_addr = derive_address(recipient_vk.as_bytes());

        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &owner_addr, 10_000_000, 1);
        let utxo = spendable(&utxo_set, &owner_addr);

        // The transaction is signed by a key that does not own the spent
        // output: full validation must reject it, while trusted replay (used
        // only for blocks already accepted into our own block store) still
        // applies the structural state transition.
        let (wrong_sk, _) = generate_keypair();
        let tx = build_send(
            &wrong_sk,
            &owner_addr,
            &recipient_addr,
            1_000_000,
            10_000,
            &[utxo],
        )
        .unwrap()
        .transaction;

        let mut full = utxo_set.clone();
        assert!(full.apply_transaction(&tx, 2, 0).is_err());

        let mut replay = utxo_set.clone();
        replay.apply_transaction_trusted_replay(&tx, 2, 0).unwrap();
        let expected = utxo_set.output_count() - 1 + tx.outputs.len();
        assert_eq!(replay.output_count(), expected);
        assert!(!replay.get_utxos_for_address(&recipient_addr).is_empty());
    }

    #[test]
    fn trusted_replay_rejects_structurally_invalid_spends() {
        let (_sk, vk) = generate_keypair();
        let addr = derive_address(vk.as_bytes());
        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &addr, 10_000_000, 1);

        let missing = Transaction {
            version: 1,
            inputs: vec![TransactionInput {
                previous_output: Hash::new([9u8; 32]),
                index: 0,
                script: vec![],
            }],
            outputs: vec![TransactionOutput {
                amount: Amount::new(1_000),
                address: Address::new(ChainId::ZionL1, vec![], &addr).unwrap(),
                ..Default::default()
            }],
            memo: vec![],
        };
        let err = utxo_set
            .apply_transaction_trusted_replay(&missing, 2, 0)
            .unwrap_err();
        assert!(matches!(err, UtxoError::InputNotFound(_)));
    }

    #[test]
    fn trusted_replay_matches_full_validation() {
        let (sk, pk) = generate_keypair();
        let addr = derive_address(pk.as_bytes());
        let (_rsk, rpk) = generate_keypair();
        let recipient = derive_address(rpk.as_bytes());
        let (_csk, cpk) = generate_keypair();

        let coinbase_block = Block::new(
            crate::block::BlockHeader {
                previous_hash: Hash::default(),
                merkle_root: Hash::default(),
                height: 1,
                timestamp: 100,
                nonce: 0,
                difficulty: 1,
            },
            vec![Transaction {
                version: 1,
                inputs: vec![],
                outputs: vec![TransactionOutput {
                    amount: Amount::new(10_000_000),
                    address: Address::new(ChainId::ZionL1, vec![], &addr).unwrap(),
                    ..Default::default()
                }],
                memo: vec![],
            }],
        );

        let mut seed = UtxoSet::new();
        seed.apply_block_unchecked(&coinbase_block).unwrap();

        let send = build_send(
            &sk,
            &addr,
            &recipient,
            1_000_000,
            10_000,
            &[spendable(&seed, &addr)],
        )
        .unwrap()
        .transaction;

        let mut seed2 = seed.clone();
        seed2.apply_transaction(&send, 2, 200).unwrap();
        let lock = build_htlc_lock(
            &sk,
            &addr,
            500_000,
            10_000,
            &[spendable(&seed2, &addr)],
            &[7u8; 32],
            10_000,
            cpk.as_bytes(),
            pk.as_bytes(),
        )
        .unwrap()
        .transaction;

        let spend_block = Block::new(
            crate::block::BlockHeader {
                previous_hash: Hash::default(),
                merkle_root: Hash::default(),
                height: 2,
                timestamp: 200,
                nonce: 0,
                difficulty: 1,
            },
            vec![send, lock],
        );

        let mut full = seed.clone();
        full.apply_block(&spend_block).unwrap();
        let mut replay = seed;
        replay.apply_block_unchecked(&spend_block).unwrap();

        assert_eq!(full.outputs, replay.outputs);
        assert_eq!(full.admin_unlocked, replay.admin_unlocked);
    }

    #[test]
    fn duplicate_inputs_rejected_without_mutation() {
        let (sk, pk) = generate_keypair();
        let addr = derive_address(pk.as_bytes());
        let (_rsk, rpk) = generate_keypair();
        let recipient = derive_address(rpk.as_bytes());

        let mut utxo_set = UtxoSet::new();
        fund_coinbase(&mut utxo_set, &addr, 10_000_000, 1);
        let utxo = spendable(&utxo_set, &addr);

        let mut tx = build_send(&sk, &addr, &recipient, 1_000_000, 10_000, &[utxo])
            .unwrap()
            .transaction;
        let dup = tx.inputs[0].clone();
        tx.inputs.push(dup);
        let outpoint = Outpoint::from(&tx.inputs[0]);
        // Re-sign over the duplicated-input signing hash so input 0 passes
        // verification and the duplicate itself is what fails.
        let signing_hash = tx.signing_hash();
        for input in &mut tx.inputs {
            input.script = crypto::sign(&sk, &signing_hash.0).to_vec();
            input.script.extend_from_slice(pk.as_bytes());
        }

        // Full validation: repeated outpoint in one tx must not count twice.
        let mut full = utxo_set.clone();
        let err = full.apply_transaction(&tx, 2, 0).unwrap_err();
        assert!(matches!(err, UtxoError::AlreadySpent(op) if op == outpoint));
        assert_eq!(full.outputs, utxo_set.outputs);

        // Trusted replay enforces the same rule.
        let mut replay = utxo_set.clone();
        let err = replay
            .apply_transaction_trusted_replay(&tx, 2, 0)
            .unwrap_err();
        assert!(matches!(err, UtxoError::AlreadySpent(op) if op == outpoint));
        assert_eq!(replay.outputs, utxo_set.outputs);
    }

    #[test]
    fn cache_round_trip_rejects_duplicate_outpoints() {
        let addr = Address::new(ChainId::ZionL1, vec![], "zion1test").unwrap();
        let outpoint = Outpoint::new(Hash::new([1u8; 32]), 0);
        let output = UtxoOutput {
            amount: Amount::new(1),
            address: addr,
            script: vec![],
            block_height: 0,
            block_timestamp: 0,
            is_coinbase: true,
        };
        let dup = vec![(outpoint, output.clone()), (outpoint, output.clone())];
        assert!(matches!(
            UtxoSet::from_cache_entries(dup, vec![]),
            Err(UtxoError::DuplicateOutpoint(_))
        ));

        let unlock = "zion1unlockedaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string();
        let set =
            UtxoSet::from_cache_entries(vec![(outpoint, output)], vec![unlock.clone()]).unwrap();
        assert_eq!(set.output_count(), 1);
        assert!(set.is_admin_unlocked(&unlock));
        assert_eq!(set.admin_unlocks_for_cache(), vec![unlock]);
    }

    #[test]
    fn unapply_block_restores_spent_and_removes_created() {
        let (sk, pk) = generate_keypair();
        let addr = derive_address(pk.as_bytes());
        let (_rsk, rpk) = generate_keypair();
        let recipient = derive_address(rpk.as_bytes());

        let coinbase_block = Block::new(
            crate::block::BlockHeader {
                previous_hash: Hash::default(),
                merkle_root: Hash::default(),
                height: 1,
                timestamp: 100,
                nonce: 0,
                difficulty: 1,
            },
            vec![Transaction {
                version: 1,
                inputs: vec![],
                outputs: vec![TransactionOutput {
                    amount: Amount::new(10_000_000),
                    address: Address::new(ChainId::ZionL1, vec![], &addr).unwrap(),
                    ..Default::default()
                }],
                memo: vec![],
            }],
        );

        let mut set = UtxoSet::new();
        set.apply_block_unchecked(&coinbase_block).unwrap();
        let funded = spendable(&set, &addr);
        let funded_op = Outpoint::new(Hash::new(funded.tx_hash), funded.output_index);
        let funded_entry = set.get(&funded_op).unwrap().clone();

        // Block 2 spends the funded output into a new one.
        let send = build_send(&sk, &addr, &recipient, 1_000_000, 10_000, &[funded])
            .unwrap()
            .transaction;
        let spend_block = Block::new(
            crate::block::BlockHeader {
                previous_hash: Hash::default(),
                merkle_root: Hash::default(),
                height: 2,
                timestamp: 200,
                nonce: 0,
                difficulty: 1,
            },
            vec![send.clone()],
        );
        set.apply_block(&spend_block).unwrap();
        assert!(!set.contains(&funded_op));
        let created_op = Outpoint::new(send.hash(), 0);
        assert!(set.contains(&created_op));

        // Roll back block 2: spent input restored, created output removed.
        let spent = std::collections::HashMap::from([(funded_op, funded_entry.clone())]);
        set.unapply_block(&spend_block, &spent).unwrap();
        assert_eq!(set.get(&funded_op), Some(&funded_entry));
        assert!(!set.contains(&created_op));
    }
}
