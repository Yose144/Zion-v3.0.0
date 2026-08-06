//! ZION genesis block and premine allocations.
//!
//! V31 keeps the same launch timestamp and constitutional supply constants as V3.
//! The merkle hashing and block layout are the V31-canonical model.
//!
//! V3 mainnet genesis hash (v3.2 One Love reset 2026-08-06):
//! `b0e95b135b736373430a3ff25d773329a3a3bd4b72ee66bb02d5a1583a77ecff`.
//! V31 native genesis hash: `065eaf8e85e2808bda876db360c6d4ec1092d6048ab48b30c8a40e468bc10dd6`.
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

/// Genesis message embedded in the coinbase (short form).
pub const GENESIS_MESSAGE: &str = concat!(
    "ZION Mainnet Launch v3.2 — One Love — ",
    "For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, ",
    "Freedom Humanity and all the children of this world: ZION is yours. ",
    "Build a better world where you reach for the Stars. The Golden Age begins. ",
    "Peace & One Love 4ever. One Earth. One Love. One Network. ",
    "— Yose / Zion Creator"
);

/// Full genesis message including ASCII art tree, embedded at compile time.
pub const GENESIS_MESSAGE_FULL: &str = include_str!("GENESIS_MESSAGE.txt");

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
        memo: GENESIS_MESSAGE_FULL.as_bytes().to_vec(),
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
        // OASIS + Golden Egg (8.25 B) — slot 1 address (consolidates slots 1-5)
        output(
            "zion1c5h8r0m7h3c853n6w0p397k0q6e896f2f5266n3",
            8_250_000_000,
        ),
        // DAO Treasury (4.0 B) — slot 6 address (consolidates slots 6-8)
        output(
            "zion1x8g2z2v3v5n08542a5u7v7q365l4852048qv6w6",
            4_000_000_000,
        ),
        // Infrastructure (2.59 B) — slot 9 address (consolidates slots 9-11)
        output(
            "zion1a8p47253k7q3j35327f3j3v0u0g5r774s3wg5e3",
            2_590_000_000,
        ),
        // Humanitarian (1.0 B) — slot 12 address
        output(
            "zion194h4f524x6p498w560u5q3j638f7s806a0fe8l5",
            1_000_000_000,
        ),
        // Bridge Seed (0.4 B) — slot 13 address
        output("zion1y6d8d547s3y7y302n4d7u497x0p3q3m878q52v2", 400_000_000),
        // Bridge Vault UTXO (0.1 B) — slot 14 address
        output("zion1d0d0656456f62394p2w8x59762g6e538t47q548", 100_000_000),
        // Liquidity bootstrap (0.44 B) — humanitarian overflow
        output("zion194h4f524x6p498w560u5q3j638f7s806a0fe8l5", 440_000_000),
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

    #[test]
    fn genesis_message_full_contains_ascii_art() {
        assert!(GENESIS_MESSAGE_FULL.contains("ZION"));
        assert!(GENESIS_MESSAGE_FULL.contains("Mainnet Launch v3.2"));
        assert!(GENESIS_MESSAGE_FULL.contains("Golden Age begins"));
        assert!(GENESIS_MESSAGE_FULL.contains("One Love"));
        assert!(GENESIS_MESSAGE_FULL.contains("Yose / Zion Creator"));
    }

    #[test]
    fn genesis_block_memo_contains_full_message() {
        let block = genesis_block();
        let memo = std::str::from_utf8(&block.transactions[0].memo).unwrap();
        assert!(memo.contains("ZION"));
        assert!(memo.contains("Mainnet Launch v3.2"));
        assert!(memo.contains("Yose / Zion Creator"));
    }
}
