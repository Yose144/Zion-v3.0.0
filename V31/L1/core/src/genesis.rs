//! ZION genesis block and premine allocations.
//!
//! V31 keeps the same launch timestamp and constitutional supply constants as V3.
//! The merkle hashing and block layout are the V31-canonical model.
//!
//! V3-compatible mainnet genesis hash (v3.2 One Love reset 2026-08-06):
//! `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`.
//! V31 native genesis hash: `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`.
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
        output("zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5", 1650000000_u64),
        output("zion1s7x735r6v86485k7t36008l682g777g3q8pu3q0", 1650000000_u64),
        output("zion1e0f4h6w3w394d4p355z2r440k4s2f6v5h4rl8f4", 1650000000_u64),
        output("zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708", 1650000000_u64),
        output("zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388", 1650000000_u64),
        output("zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5", 2500000000_u64),
        output("zion1s27490u7n823g098w42077h8f2n824w0y75w0s3", 1000000000_u64),
        output("zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238", 500000000_u64),
        output("zion1k752909323x66062k5j7074096f003z095ax8m7", 1000000000_u64),
        output("zion1z3a4w726w5u4r4s4z644s8p897v4a2k045rt706", 1000000000_u64),
        output("zion122v8f8g55398f4g884k7j482h3z845j6c6ta4f8", 590000000_u64),
        output("zion1h6644748u5x6p4p784n6g2l7j77625w6a0k80s8", 1440000000_u64),
        output("zion1t6z3c0f0p3h0v233a3h432k5h764j0r3n5ml756", 400000000_u64),
        output("zion1j3w3h7k8m635h734y786j5804305m822t5uk546", 100000000_u64),
    ]
}


fn output(encoded: &str, zion: u64) -> TransactionOutput {
    let address =
        Address::new(ChainId::ZionL1, vec![], encoded).expect("genesis address must be valid");
    TransactionOutput {
        amount: Amount::new(zion as u128 * 1_000_000),
        address,
        script: vec![],
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
