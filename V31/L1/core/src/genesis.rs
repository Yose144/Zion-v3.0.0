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
        // OASIS + Golden Egg (8.25 B) — slot 1 address
        output(
            "zion172h3y7d6m7d7y7d8q2d4x363t0m55227n2rt2v2",
            8_250_000_000,
        ),
        // DAO Treasury (4.0 B) — slot 6 address (main)
        output(
            "zion1j5a327c7d3w7h4e474n5p4z0z827f8p874mr2p7",
            4_000_000_000,
        ),
        // Infrastructure (2.59 B) — slot 9 address (dev fund)
        output(
            "zion172k256y2f6y6k6r3q5e3j0v382f694e3q59e4w0",
            2_590_000_000,
        ),
        // Humanitarian (1.0 B) — slot 12 address
        output(
            "zion1f0t7e2y3t340g3j4h470q0z7e5j7w7y4q49u5t6",
            1_000_000_000,
        ),
        // Bridge Seed (0.4 B) — slot 13 address
        output("zion1j8c7h0a2r377v5n0y757n8j5w6y2n2d8005f750", 400_000_000),
        // Bridge Vault UTXO (0.1 B) — slot 14 address
        output("zion1x2f2u5p560a0e5a5u8g7m837m78856v5f8e45l7", 100_000_000),
        // Liquidity bootstrap (0.44 B) — humanitarian overflow
        output("zion1f0t7e2y3t340g3j4h470q0z7e5j7w7y4q49u5t6", 440_000_000),
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
