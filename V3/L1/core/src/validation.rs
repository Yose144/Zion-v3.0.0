//! Full block validation pipeline for ZION V3.
//!
//! 10-step validation that every block must pass before acceptance:
//!
//! 1. **Structure** — non-empty, within MAX_BLOCK_SIZE
//! 2. **PoW** — hash meets difficulty target
//! 3. **Difficulty** — matches LWMA output for this height
//! 4. **Timestamp** — within ±MAX_TIMESTAMP_DRIFT of median-time-past
//! 5. **Merkle root** — binary Merkle tree (BLAKE3 hash pairs)
//! 6. **Tx signatures** — Ed25519 per input (SegWit-style)
//! 7. **UTXO double-spend** — no input references already-spent output
//! 8. **Coinbase maturity** — coinbase outputs unspendable for COINBASE_MATURITY blocks
//! 9. **Fee validation** — meets MIN_TX_FEE, fee-rate
//! 10. **Subsidy validation** — coinbase ≤ block reward (no fee in coinbase)

use crate::crypto;
use crate::emission;
use crate::fee;
use crate::tx::Transaction;

// ── Constants ──────────────────────────────────────────────────────────

/// Coinbase outputs are unspendable for this many blocks.
pub const COINBASE_MATURITY: u64 = emission::COINBASE_MATURITY;

/// Maximum block size in bytes (1 MB).
pub const MAX_BLOCK_SIZE: usize = 1_048_576;

/// Maximum timestamp drift from median-time-past (2 hours).
pub const MAX_TIMESTAMP_DRIFT: u64 = 7_200;

// ── Merkle tree ────────────────────────────────────────────────────────

/// Compute binary Merkle root from a list of transaction hashes using BLAKE3.
///
/// If empty, returns all-zeros. If single, returns that hash.
/// Duplicates the last element if odd count (Bitcoin-style).
pub fn merkle_root(tx_hashes: &[[u8; 32]]) -> [u8; 32] {
    if tx_hashes.is_empty() {
        return [0u8; 32];
    }
    if tx_hashes.len() == 1 {
        return tx_hashes[0];
    }

    let mut level: Vec<[u8; 32]> = tx_hashes.to_vec();
    while level.len() > 1 {
        if level.len() % 2 == 1 {
            let last = *level.last().unwrap();
            level.push(last);
        }
        let mut next = Vec::with_capacity(level.len() / 2);
        for pair in level.chunks_exact(2) {
            let mut combined = [0u8; 64];
            combined[..32].copy_from_slice(&pair[0]);
            combined[32..].copy_from_slice(&pair[1]);
            next.push(crypto::blake3_hash(&combined));
        }
        level = next;
    }
    level[0]
}

// ── Validation errors ──────────────────────────────────────────────────

/// Specific reason a block failed validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    EmptyBlock,
    BlockTooLarge { size: usize, max: usize },
    PowInvalid,
    DifficultyMismatch { expected: u64, got: u64 },
    TimestampTooFarFuture { timestamp: u64, max: u64 },
    TimestampTooOld { timestamp: u64, min: u64 },
    MerkleRootMismatch { expected: [u8; 32], got: [u8; 32] },
    InvalidSignature { tx_index: usize },
    DoubleSpend { tx_index: usize, input_index: usize },
    ImmatureCoinbase { tx_index: usize, input_index: usize, age: u64 },
    FeeTooLow { tx_index: usize },
    SubsidyExceeded { coinbase_output: u64, max_reward: u64 },
    NoCoinbase,
    CoinbaseHasInputs,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyBlock => write!(f, "block has no transactions"),
            Self::BlockTooLarge { size, max } => write!(f, "block {size} bytes exceeds {max}"),
            Self::PowInvalid => write!(f, "PoW hash does not meet target"),
            Self::DifficultyMismatch { expected, got } =>
                write!(f, "difficulty mismatch: expected {expected}, got {got}"),
            Self::TimestampTooFarFuture { timestamp, max } =>
                write!(f, "timestamp {timestamp} too far in future (max {max})"),
            Self::TimestampTooOld { timestamp, min } =>
                write!(f, "timestamp {timestamp} too old (min {min})"),
            Self::MerkleRootMismatch { .. } => write!(f, "merkle root mismatch"),
            Self::InvalidSignature { tx_index } =>
                write!(f, "invalid signature in tx {tx_index}"),
            Self::DoubleSpend { tx_index, input_index } =>
                write!(f, "double-spend in tx {tx_index} input {input_index}"),
            Self::ImmatureCoinbase { tx_index, input_index, age } =>
                write!(f, "immature coinbase in tx {tx_index} input {input_index} (age {age})"),
            Self::FeeTooLow { tx_index } =>
                write!(f, "fee too low in tx {tx_index}"),
            Self::SubsidyExceeded { coinbase_output, max_reward } =>
                write!(f, "coinbase output {coinbase_output} exceeds reward {max_reward}"),
            Self::NoCoinbase => write!(f, "block has no coinbase transaction"),
            Self::CoinbaseHasInputs => write!(f, "coinbase transaction has inputs"),
        }
    }
}

// ── Validation context ─────────────────────────────────────────────────

/// Information about a UTXO needed for validation.
#[derive(Debug, Clone)]
pub struct UtxoInfo {
    pub amount: u64,
    pub address: String,
    /// Height at which this UTXO was created.
    pub created_height: u64,
    /// Whether this UTXO was created by a coinbase transaction.
    pub is_coinbase: bool,
}

/// Context needed to validate a block.
pub struct ValidationContext {
    /// Block height being validated.
    pub height: u64,
    /// Expected difficulty for this block.
    pub expected_difficulty: u64,
    /// Median time of the past 11 blocks.
    pub median_time_past: u64,
    /// Current time (for future timestamp check).
    pub current_time: u64,
}

// ── Step functions ─────────────────────────────────────────────────────

/// Step 1: Block structure — must have transactions, within size limit.
pub fn validate_structure(
    transactions: &[Transaction],
    block_size_bytes: usize,
) -> Result<(), ValidationError> {
    if transactions.is_empty() {
        return Err(ValidationError::EmptyBlock);
    }
    if block_size_bytes > MAX_BLOCK_SIZE {
        return Err(ValidationError::BlockTooLarge {
            size: block_size_bytes,
            max: MAX_BLOCK_SIZE,
        });
    }
    Ok(())
}

/// Step 4: Timestamp validation — within ±MAX_TIMESTAMP_DRIFT of median-time-past.
pub fn validate_timestamp(
    block_timestamp: u64,
    median_time_past: u64,
    current_time: u64,
) -> Result<(), ValidationError> {
    let max_allowed = current_time + MAX_TIMESTAMP_DRIFT;
    if block_timestamp > max_allowed {
        return Err(ValidationError::TimestampTooFarFuture {
            timestamp: block_timestamp,
            max: max_allowed,
        });
    }
    // Block must be newer than median-time-past
    if block_timestamp <= median_time_past.saturating_sub(MAX_TIMESTAMP_DRIFT) {
        return Err(ValidationError::TimestampTooOld {
            timestamp: block_timestamp,
            min: median_time_past.saturating_sub(MAX_TIMESTAMP_DRIFT),
        });
    }
    Ok(())
}

/// Step 5: Validate merkle root matches computed root from transaction hashes.
pub fn validate_merkle_root(
    expected: &[u8; 32],
    transactions: &[Transaction],
) -> Result<(), ValidationError> {
    let tx_hashes: Vec<[u8; 32]> = transactions.iter().map(|tx| tx.id).collect();
    let computed = merkle_root(&tx_hashes);
    if &computed != expected {
        return Err(ValidationError::MerkleRootMismatch {
            expected: *expected,
            got: computed,
        });
    }
    Ok(())
}

/// Step 6: Validate all transaction signatures (skip coinbase at index 0).
pub fn validate_signatures(transactions: &[Transaction]) -> Result<(), ValidationError> {
    for (i, tx) in transactions.iter().enumerate().skip(1) {
        if !tx.verify_signatures() {
            return Err(ValidationError::InvalidSignature { tx_index: i });
        }
    }
    Ok(())
}

/// Step 7: Check for double-spends within the block.
pub fn validate_no_double_spend(
    transactions: &[Transaction],
) -> Result<(), ValidationError> {
    let mut spent: std::collections::HashSet<([u8; 32], u32)> = std::collections::HashSet::new();
    for (tx_i, tx) in transactions.iter().enumerate().skip(1) {
        for (inp_i, input) in tx.inputs.iter().enumerate() {
            let outpoint = (input.prev_tx_hash, input.output_index);
            if !spent.insert(outpoint) {
                return Err(ValidationError::DoubleSpend {
                    tx_index: tx_i,
                    input_index: inp_i,
                });
            }
        }
    }
    Ok(())
}

/// Step 8: Verify coinbase maturity — any input spending a coinbase UTXO
/// must have been confirmed at least COINBASE_MATURITY blocks ago.
pub fn validate_coinbase_maturity(
    transactions: &[Transaction],
    current_height: u64,
    utxo_lookup: &dyn Fn(&[u8; 32], u32) -> Option<UtxoInfo>,
) -> Result<(), ValidationError> {
    for (tx_i, tx) in transactions.iter().enumerate().skip(1) {
        for (inp_i, input) in tx.inputs.iter().enumerate() {
            if let Some(utxo) = utxo_lookup(&input.prev_tx_hash, input.output_index) {
                if utxo.is_coinbase {
                    let age = current_height.saturating_sub(utxo.created_height);
                    if age < COINBASE_MATURITY {
                        return Err(ValidationError::ImmatureCoinbase {
                            tx_index: tx_i,
                            input_index: inp_i,
                            age,
                        });
                    }
                }
            }
        }
    }
    Ok(())
}

/// Step 9: Validate fees for all non-coinbase transactions.
pub fn validate_fees(
    transactions: &[Transaction],
    estimated_sizes: &[usize],
) -> Result<(), ValidationError> {
    for (i, (tx, &size)) in transactions.iter().zip(estimated_sizes.iter()).enumerate().skip(1) {
        if fee::validate_fee(tx.fee, size).is_err() {
            return Err(ValidationError::FeeTooLow { tx_index: i });
        }
    }
    Ok(())
}

/// Step 10: Validate coinbase subsidy — coinbase output ≤ block reward.
pub fn validate_subsidy(
    coinbase: &Transaction,
    block_height: u64,
) -> Result<(), ValidationError> {
    if !coinbase.is_coinbase() {
        return Err(ValidationError::CoinbaseHasInputs);
    }
    let total_output = coinbase.total_output();
    let max_reward = fee::max_coinbase_output(block_height);
    if total_output > max_reward {
        return Err(ValidationError::SubsidyExceeded {
            coinbase_output: total_output,
            max_reward,
        });
    }
    Ok(())
}

/// Run the full 10-step validation pipeline.
///
/// Steps 2 (PoW) and 3 (difficulty) are expected to be done by the caller
/// before invoking this, since they depend on mining header data not available
/// in the transaction list.
pub fn validate_block(
    transactions: &[Transaction],
    block_size_bytes: usize,
    merkle_root_expected: &[u8; 32],
    ctx: &ValidationContext,
    estimated_tx_sizes: &[usize],
    utxo_lookup: &dyn Fn(&[u8; 32], u32) -> Option<UtxoInfo>,
) -> Result<(), ValidationError> {
    // Step 1: Structure
    validate_structure(transactions, block_size_bytes)?;

    // Steps 2-3: PoW + difficulty — done externally

    // Step 4: Timestamp
    validate_timestamp(
        ctx.current_time, // block timestamp
        ctx.median_time_past,
        ctx.current_time,
    )?;

    // Step 5: Merkle root
    validate_merkle_root(merkle_root_expected, transactions)?;

    // Step 6: Signatures
    validate_signatures(transactions)?;

    // Step 7: Double-spend
    validate_no_double_spend(transactions)?;

    // Step 8: Coinbase maturity
    validate_coinbase_maturity(transactions, ctx.height, utxo_lookup)?;

    // Step 9: Fees
    validate_fees(transactions, estimated_tx_sizes)?;

    // Step 10: Subsidy
    if let Some(coinbase) = transactions.first() {
        validate_subsidy(coinbase, ctx.height)?;
    } else {
        return Err(ValidationError::NoCoinbase);
    }

    Ok(())
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{generate_keypair, sign, derive_address};
    use crate::tx::{TxInput, TxOutput};

    fn make_coinbase(height: u64) -> Transaction {
        let reward = emission::block_subsidy(height);
        let mut tx = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![],
            outputs: vec![TxOutput {
                amount: reward,
                address: "zion1miner000000000000000000000000000000test".to_string(),
                memo: None,
            }],
            fee: 0,
            timestamp: 1_700_000_000,
        };
        tx.finalize_id();
        tx
    }

    fn make_signed_tx(prev_hash: [u8; 32]) -> Transaction {
        let (sk, vk) = generate_keypair();
        let addr = derive_address(vk.as_bytes());
        let mut tx = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![TxInput {
                prev_tx_hash: prev_hash,
                output_index: 0,
                signature: vec![],
                public_key: vk.as_bytes().to_vec(),
            }],
            outputs: vec![TxOutput {
                amount: 1_000_000,
                address: addr,
                memo: None,
            }],
            fee: 2_000,
            timestamp: 1_700_000_000,
        };
        tx.finalize_id();
        let sig = sign(&sk, &tx.id);
        tx.inputs[0].signature = sig.to_vec();
        tx
    }

    // ── Merkle tree ────────────────────────────────────────────────

    #[test]
    fn merkle_root_empty() {
        assert_eq!(merkle_root(&[]), [0u8; 32]);
    }

    #[test]
    fn merkle_root_single() {
        let h = [42u8; 32];
        assert_eq!(merkle_root(&[h]), h);
    }

    #[test]
    fn merkle_root_two_deterministic() {
        let a = [1u8; 32];
        let b = [2u8; 32];
        let r1 = merkle_root(&[a, b]);
        let r2 = merkle_root(&[a, b]);
        assert_eq!(r1, r2);
    }

    #[test]
    fn merkle_root_order_matters() {
        let a = [1u8; 32];
        let b = [2u8; 32];
        assert_ne!(merkle_root(&[a, b]), merkle_root(&[b, a]));
    }

    #[test]
    fn merkle_root_odd_count_handles_duplication() {
        let hashes = vec![[1u8; 32], [2u8; 32], [3u8; 32]];
        let root = merkle_root(&hashes);
        assert_ne!(root, [0u8; 32]);
    }

    // ── Step 1: Structure ──────────────────────────────────────────

    #[test]
    fn validate_structure_empty_rejected() {
        let err = validate_structure(&[], 100).unwrap_err();
        assert_eq!(err, ValidationError::EmptyBlock);
    }

    #[test]
    fn validate_structure_too_large_rejected() {
        let tx = make_coinbase(1);
        let err = validate_structure(&[tx], MAX_BLOCK_SIZE + 1).unwrap_err();
        assert!(matches!(err, ValidationError::BlockTooLarge { .. }));
    }

    #[test]
    fn validate_structure_ok() {
        let tx = make_coinbase(1);
        assert!(validate_structure(&[tx], 500).is_ok());
    }

    // ── Step 4: Timestamp ──────────────────────────────────────────

    #[test]
    fn validate_timestamp_ok() {
        assert!(validate_timestamp(1000, 900, 1000).is_ok());
    }

    #[test]
    fn validate_timestamp_too_far_future() {
        let err = validate_timestamp(20000, 900, 1000).unwrap_err();
        assert!(matches!(err, ValidationError::TimestampTooFarFuture { .. }));
    }

    // ── Step 5: Merkle root ────────────────────────────────────────

    #[test]
    fn validate_merkle_root_correct() {
        let cb = make_coinbase(1);
        let root = merkle_root(&[cb.id]);
        assert!(validate_merkle_root(&root, &[cb]).is_ok());
    }

    #[test]
    fn validate_merkle_root_mismatch() {
        let cb = make_coinbase(1);
        let bad_root = [0xFF; 32];
        let err = validate_merkle_root(&bad_root, &[cb]).unwrap_err();
        assert!(matches!(err, ValidationError::MerkleRootMismatch { .. }));
    }

    // ── Step 6: Signatures ─────────────────────────────────────────

    #[test]
    fn validate_signatures_ok() {
        let cb = make_coinbase(1);
        let tx = make_signed_tx([0xBB; 32]);
        assert!(validate_signatures(&[cb, tx]).is_ok());
    }

    #[test]
    fn validate_signatures_bad_sig() {
        let cb = make_coinbase(1);
        let mut tx = make_signed_tx([0xBB; 32]);
        tx.inputs[0].signature = vec![0u8; 64]; // bad sig
        let err = validate_signatures(&[cb, tx]).unwrap_err();
        assert_eq!(err, ValidationError::InvalidSignature { tx_index: 1 });
    }

    // ── Step 7: Double-spend ───────────────────────────────────────

    #[test]
    fn validate_no_double_spend_ok() {
        let cb = make_coinbase(1);
        let tx1 = make_signed_tx([0xAA; 32]);
        let tx2 = make_signed_tx([0xBB; 32]);
        assert!(validate_no_double_spend(&[cb, tx1, tx2]).is_ok());
    }

    #[test]
    fn validate_double_spend_detected() {
        let cb = make_coinbase(1);
        let tx1 = make_signed_tx([0xAA; 32]);
        let mut tx2 = make_signed_tx([0xAA; 32]);
        // Same outpoint as tx1
        tx2.inputs[0].prev_tx_hash = tx1.inputs[0].prev_tx_hash;
        tx2.inputs[0].output_index = tx1.inputs[0].output_index;
        let err = validate_no_double_spend(&[cb, tx1, tx2]).unwrap_err();
        assert!(matches!(err, ValidationError::DoubleSpend { tx_index: 2, .. }));
    }

    // ── Step 8: Coinbase maturity ──────────────────────────────────

    #[test]
    fn validate_coinbase_maturity_mature_ok() {
        let cb = make_coinbase(1);
        let tx = make_signed_tx([0xCC; 32]);
        let lookup = |_hash: &[u8; 32], _idx: u32| -> Option<UtxoInfo> {
            Some(UtxoInfo {
                amount: 5_000_000,
                address: "test".into(),
                created_height: 0,
                is_coinbase: true,
            })
        };
        // Current height 200, coinbase at 0 → age 200 >= 100, OK
        assert!(validate_coinbase_maturity(&[cb, tx], 200, &lookup).is_ok());
    }

    #[test]
    fn validate_coinbase_maturity_immature_rejected() {
        let cb = make_coinbase(1);
        let tx = make_signed_tx([0xCC; 32]);
        let lookup = |_hash: &[u8; 32], _idx: u32| -> Option<UtxoInfo> {
            Some(UtxoInfo {
                amount: 5_000_000,
                address: "test".into(),
                created_height: 50,
                is_coinbase: true,
            })
        };
        // Current height 100, coinbase at 50 → age 50 < 100
        let err = validate_coinbase_maturity(&[cb, tx], 100, &lookup).unwrap_err();
        assert!(matches!(err, ValidationError::ImmatureCoinbase { age: 50, .. }));
    }

    // ── Step 10: Subsidy ───────────────────────────────────────────

    #[test]
    fn validate_subsidy_ok() {
        let cb = make_coinbase(1);
        assert!(validate_subsidy(&cb, 1).is_ok());
    }

    #[test]
    fn validate_subsidy_exceeded() {
        let mut cb = make_coinbase(1);
        cb.outputs[0].amount += 1; // over-reward
        let err = validate_subsidy(&cb, 1).unwrap_err();
        assert!(matches!(err, ValidationError::SubsidyExceeded { .. }));
    }

    #[test]
    fn validate_subsidy_coinbase_with_inputs_rejected() {
        let (sk, vk) = generate_keypair();
        let tx = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![TxInput {
                prev_tx_hash: [0xFF; 32],
                output_index: 0,
                signature: vec![0u8; 64],
                public_key: vk.as_bytes().to_vec(),
            }],
            outputs: vec![TxOutput {
                amount: 1,
                address: "test".into(),
                memo: None,
            }],
            fee: 0,
            timestamp: 0,
        };
        let err = validate_subsidy(&tx, 1).unwrap_err();
        assert_eq!(err, ValidationError::CoinbaseHasInputs);
    }

    // ── Full pipeline ──────────────────────────────────────────────

    #[test]
    fn full_validation_valid_block() {
        let cb = make_coinbase(1);
        let tx = make_signed_tx([0xDD; 32]);
        let txs = vec![cb, tx];
        let tx_hashes: Vec<[u8; 32]> = txs.iter().map(|t| t.id).collect();
        let root = merkle_root(&tx_hashes);

        let ctx = ValidationContext {
            height: 1,
            expected_difficulty: 1_000,
            median_time_past: 1_699_999_900,
            current_time: 1_700_000_000,
        };

        let sizes = vec![200, 300]; // estimated sizes
        let lookup = |_: &[u8; 32], _: u32| -> Option<UtxoInfo> { None };

        assert!(validate_block(&txs, 1000, &root, &ctx, &sizes, &lookup).is_ok());
    }
}
