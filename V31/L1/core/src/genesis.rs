//! ZION genesis block and premine allocations.
//!
//! V31 keeps the same launch timestamp and constitutional supply constants as V3.
//! The merkle hashing and block layout are the V31-canonical model.
//!
//! V3 mainnet genesis hash (current beta, 2026-07-20 hard reset):
//! `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`.
//! V31 still uses a different canonical block layout, so the computed
//! `genesis_hash()` below intentionally differs. See `V31/V3_SYNC_ASSESSMENT.md`.

use zion_l1_types::{Address, Amount, ChainId, Hash};

use crate::block::{Block, BlockHeader};
use crate::difficulty::GENESIS_DIFFICULTY as DIFFICULTY;
use crate::transaction::{Transaction, TransactionOutput};

/// Frozen V3 mainnet beta genesis hash. Used as the trusted root for any
/// V31 → V3 checkpoint/cutover mode.
pub use crate::v3_compat::V3_GENESIS_HASH;
pub use crate::v3_compat::{PremineOutput, PREMINE_OUTPUTS};

/// Genesis timestamp (seconds since UNIX epoch): 2026-01-01 00:00:00 UTC.
pub const GENESIS_TIMESTAMP: u64 = 1_767_225_600;

/// Genesis message embedded in the coinbase.
pub const GENESIS_MESSAGE: &str = concat!(
    "ZION Mainnet Launch v3 — ",
    "For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, ",
    "Freedom Humanity and all the children of this world: ZION is yours. ",
    "One Earth. One Love. One Network."
);

/// Genesis difficulty used for the first block.
pub use crate::difficulty::GENESIS_DIFFICULTY;

/// The canonical genesis block.
///
/// Height 0 is the premine block: 16.78 billion ZION issued to ecosystem wallets,
/// no mining reward, and no inputs.
pub fn genesis_block() -> Block {
    let outputs = premine_outputs();
    let transactions = vec![Transaction {
        version: 1,
        inputs: vec![],
        outputs,
        memo: GENESIS_MESSAGE.as_bytes().to_vec(),
    }];
    let merkle_root = merkle_root(&transactions);

    let header = BlockHeader {
        previous_hash: Hash::default(),
        merkle_root,
        height: 0,
        timestamp: GENESIS_TIMESTAMP,
        nonce: 0,
        difficulty: DIFFICULTY,
    };

    Block::new(header, transactions)
}

/// Compute the deterministic genesis block hash.
pub fn genesis_hash() -> Hash {
    use sha3::{Digest, Keccak256};
    let header = genesis_block().header;
    let pow_header = header.pow_header();
    let mut bytes = [0u8; 80 + 8];
    bytes[..80].copy_from_slice(&pow_header);
    bytes[80..].copy_from_slice(&header.nonce.to_le_bytes());
    Hash::new(Keccak256::digest(bytes).into())
}

/// Premine allocations in V31 canonical form.
/// Total: 16,780,000,000 ZION.
fn premine_outputs() -> Vec<TransactionOutput> {
    vec![
        // OASIS + Golden Egg (8.25 B)
        output(
            "zion172h3y7d6m7d7y7d8q2d4x363t0m55227n2rt2v2",
            8_250_000_000,
        ),
        // DAO Treasury (4.0 B)
        output(
            "zion1d4o9q2w3e4r5t6y7u8i9o0p1a2s3d4f5g6h7j8k9",
            4_000_000_000,
        ),
        // Infrastructure (2.59 B)
        output(
            "zion1i2f3r4a5c6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l1",
            2_590_000_000,
        ),
        // Humanitarian (1.0 B)
        output(
            "zion1h3u4m5a6n7i8t9a0r1i2a3n4s5h6i7p8e9r0o1r2",
            1_000_000_000,
        ),
        // Bridge Seed (0.4 B)
        output("zion1b4r5i6d7g8e9s0e1d2s3e4e5d6f7g8h9i0j1k2l3", 400_000_000),
        // Bridge Vault UTXO (0.1 B)
        output("zion1v5a6u7l8t9u0t1o2p3i4u5t6s7p8u9t0a1b2c3d4", 100_000_000),
        // Liquidity bootstrap (0.44 B)
        output("zion1l6i7q8u9i0d1i2t3y4b5o6o7t8s9t0r1a2p3i4d5", 440_000_000),
    ]
}

fn output(encoded: &str, zion: u64) -> TransactionOutput {
    let address =
        Address::new(ChainId::ZionL1, vec![], encoded).expect("genesis address must be valid");
    TransactionOutput {
        amount: Amount::new(zion as u128 * 1_000_000),
        address,
    }
}

/// Simple merkle root: BLAKE3 of concatenated transaction hashes.
pub fn merkle_root(transactions: &[Transaction]) -> Hash {
    use blake3::Hasher;
    let mut hasher = Hasher::new();
    for tx in transactions {
        hasher.update(&tx.hash().0);
    }
    Hash::new(hasher.finalize().into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genesis_block_is_deterministic() {
        let b1 = genesis_block();
        let b2 = genesis_block();
        assert_eq!(b1.header.merkle_root, b2.header.merkle_root);
        assert_eq!(genesis_hash(), genesis_hash());
    }

    #[test]
    fn genesis_has_correct_height_and_difficulty() {
        let block = genesis_block();
        assert_eq!(block.header.height, 0);
        assert_eq!(block.header.difficulty, GENESIS_DIFFICULTY);
        assert_eq!(block.header.timestamp, GENESIS_TIMESTAMP);
        assert_eq!(block.header.previous_hash, Hash::default());
    }

    #[test]
    fn genesis_premine_sums_to_16_78_billion_zion() {
        let block = genesis_block();
        let tx = &block.transactions[0];
        let total: u128 = tx.outputs.iter().map(|o| o.amount.0).sum();
        assert_eq!(total, 16_780_000_000u128 * 1_000_000);
    }
}
