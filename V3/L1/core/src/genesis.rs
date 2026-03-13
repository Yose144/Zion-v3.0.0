//! ZION V3 — Genesis Block & Premine
//!
//! Constitutional reference: `docs/mainnet/MAINNET_CONSTITUTION.md` §1–§2
//!
//! The genesis block (height 0) carries 12 premine outputs totalling
//! 16,280,000,000 ZION (11.31 % of the 144 B total supply).
//! Block subsidy at height 0 is 0 — the premine is the sole coinbase.
//!
//! Source: `PREMINE_ADDRESSES_PUBLIC.txt` + `L1/core/src/blockchain/premine.rs`

use crate::{difficulty, AcceptedBlock, MiningHeader, Transaction};
use zion_cosmic_harmony::cosmic_harmony_ekam_deeksha;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Block height at which DAO Treasury addresses unlock.
/// 525,600 blocks ≈ 1 year at 60 s/block.
pub const DAO_TREASURY_LOCK_HEIGHT: u64 = 525_600;

/// Genesis timestamp (seconds since UNIX epoch).
/// 2026-01-01 00:00:00 UTC — frozen, all nodes must agree.
pub const GENESIS_TIMESTAMP: u64 = 1_767_225_600;

/// Genesis message embedded in the coinbase (Bitcoin-style scriptSig heritage).
/// Short form used in tx hashing; full form with ASCII art available via `genesis_message_full()`.
pub const GENESIS_MESSAGE: &str = concat!(
    "ZION Mainet Launch v3 — ",
    "For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, ",
    "Freedom Humanity and all the children of this world: ZION is yours. ",
    "Build a better world where you reach for the Stars. The Golden Age begins. ",
    "Peace & One Love 4ever. ",
    "— Yose / Zion Creator"
);

/// Full genesis message including ASCII art, embedded at compile time.
pub const GENESIS_MESSAGE_FULL: &str = include_str!("GENESIS_MESSAGE.txt");

// ---------------------------------------------------------------------------
// Premine allocations — frozen data from PREMINE_ADDRESSES_PUBLIC.txt
// ---------------------------------------------------------------------------

/// A single premine output in the genesis block.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PremineOutput {
    pub address: &'static str,
    pub purpose: &'static str,
    pub amount_zion: u64,
    pub amount_flowers: u128,
    pub category: &'static str,
    pub unlock_height: Option<u64>,
}

/// All 12 premine allocations, ordered by category then slot.
/// Total: 16,280,000,000 ZION = 16,280,000,000,000,000,000,000 flowers.
pub const PREMINE_OUTPUTS: &[PremineOutput] = &[
    // --- OASIS + Golden Egg (5 × 1.65B = 8.25B) ---
    PremineOutput {
        address: "zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 1)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1l2h8h0e3h7m6p8e297m6n624c5m7r2k364v684a",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 2)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1e6r0q3g6t0r0v5f6h7k7c5f3v562j0v7e5e5d0a",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 3)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1l7e4c4c5x8l440t295a7m4k5p5x8v8z7r043s23",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 4)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1n8h2a8p386z274859833h7v6c5n687f7a6k523u",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 5)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    // --- DAO Treasury (3 slots = 4.0B) — locked until height 525,600 ---
    PremineOutput {
        address: "zion176u8r6w53768e2k04035d4d3c2z5g555n6l4r3s",
        purpose: "DAO Treasury — Community Governance (main)",
        amount_zion: 2_500_000_000,
        amount_flowers: 2_500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
    },
    PremineOutput {
        address: "zion12643n776r3m8f340484756q06485h5w4c2l405m",
        purpose: "DAO Treasury — Grants & Bounties",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
    },
    PremineOutput {
        address: "zion1k8w734x422f3t6t536r287k2c6n3z0e05257606",
        purpose: "DAO Treasury — Ecosystem Bootstrap",
        amount_zion: 500_000_000,
        amount_flowers: 500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
    },
    // --- Infrastructure (3 slots = 2.59B) ---
    PremineOutput {
        address: "zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c",
        purpose: "Core Development Fund",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1h4w39686t8w376g0x0y426e775q6p2q0v698v43",
        purpose: "Network Infrastructure — P2P Seed Nodes",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1x638z5x6d2d0y6u3f7y8g7j56054a4a2a2c7l8f",
        purpose: "Genesis Creator — Lifetime Rent",
        amount_zion: 590_000_000,
        amount_flowers: 590_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
    },
    // --- Humanitarian (1 slot = 1.44B) ---
    PremineOutput {
        address: "zion1m4v5z8z850u480c5c208z274e334369275n5y20",
        purpose: "Children Future Fund — Humanitarian DAO",
        amount_zion: 1_440_000_000,
        amount_flowers: 1_440_000_000_000_000_000_000,
        category: "humanitarian",
        unlock_height: None,
    },
];

// ---------------------------------------------------------------------------
// Genesis block construction
// ---------------------------------------------------------------------------

/// Build the canonical genesis `AcceptedBlock`.
///
/// The genesis block has:
/// - height 0, template_id 0, nonce 0
/// - timestamp = `GENESIS_TIMESTAMP`
/// - difficulty = `GENESIS_DIFFICULTY`
/// - 12 premine "transactions" (one per output) with special coinbase tx_ids
/// - subsidy = 0 (no mining reward at height 0)
/// - miner_reward = 0
pub fn genesis_block() -> AcceptedBlock {
    let transactions: Vec<Transaction> = PREMINE_OUTPUTS
        .iter()
        .enumerate()
        .map(|(i, output)| {
            // Deterministic tx_id: for tx 0, include genesis message in the hash
            // (Bitcoin-style coinbase scriptSig heritage)
            let tag = if i == 0 {
                format!("genesis-premine-{i:02}:{}", GENESIS_MESSAGE)
            } else {
                format!("genesis-premine-{i:02}")
            };
            let tx_id = genesis_tx_id(&tag);
            Transaction {
                tx_id,
                from: "genesis".to_string(),
                to: output.address.to_string(),
                amount_zion: output.amount_zion,
                fee_zion: 0,
                nonce: i as u64,
            }
        })
        .collect();

    let transaction_ids: Vec<String> = transactions.iter().map(|tx| tx.tx_id.clone()).collect();

    // Build the genesis header, hash it, and produce the canonical hash.
    let genesis_target = difficulty::difficulty_to_target(difficulty::GENESIS_DIFFICULTY);
    let genesis_bits = difficulty::target_to_compact(&genesis_target);
    let merkle_root = genesis_merkle_root(&transactions);

    let header = MiningHeader {
        version: 3,
        previous_hash: [0u8; 32],
        merkle_root,
        timestamp: GENESIS_TIMESTAMP,
        difficulty_bits: genesis_bits,
    };

    let hash = cosmic_harmony_ekam_deeksha(&header.to_bytes(), 0);
    let hash_hex = crate::hex(&hash.data);

    let body_hash = genesis_body_hash(&transactions);

    AcceptedBlock {
        template_id: 0,
        height: 0,
        timestamp: GENESIS_TIMESTAMP,
        difficulty: difficulty::GENESIS_DIFFICULTY,
        nonce: 0,
        hash_hex,
        transaction_ids,
        transactions,
        total_fees_zion: 0,
        body_hash_hex: crate::hex(&body_hash),
        subsidy_zion: 0,
        miner_reward_zion: 0,
    }
}

/// The frozen genesis block hash. Computed once, then hard-coded.
/// All nodes must agree on this value.
pub fn genesis_hash() -> String {
    genesis_block().hash_hex.clone()
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/// Validate premine totals at compile-time-like granularity.
pub fn validate_premine() -> Result<(), String> {
    let oasis: u128 = PREMINE_OUTPUTS
        .iter()
        .filter(|o| o.category == "oasis_golden_egg")
        .map(|o| o.amount_flowers)
        .sum();
    if oasis != 8_250_000_000_000_000_000_000 {
        return Err(format!("OASIS total {oasis} != 8.25B flowers"));
    }

    let dao: u128 = PREMINE_OUTPUTS
        .iter()
        .filter(|o| o.category == "dao_treasury")
        .map(|o| o.amount_flowers)
        .sum();
    if dao != 4_000_000_000_000_000_000_000 {
        return Err(format!("DAO Treasury total {dao} != 4.0B flowers"));
    }

    let infra: u128 = PREMINE_OUTPUTS
        .iter()
        .filter(|o| o.category == "infrastructure")
        .map(|o| o.amount_flowers)
        .sum();
    if infra != 2_590_000_000_000_000_000_000 {
        return Err(format!("Infrastructure total {infra} != 2.59B flowers"));
    }

    let humanitarian: u128 = PREMINE_OUTPUTS
        .iter()
        .filter(|o| o.category == "humanitarian")
        .map(|o| o.amount_flowers)
        .sum();
    if humanitarian != 1_440_000_000_000_000_000_000 {
        return Err(format!("Humanitarian total {humanitarian} != 1.44B flowers"));
    }

    let grand_total: u128 = PREMINE_OUTPUTS.iter().map(|o| o.amount_flowers).sum();
    if grand_total != crate::emission::GENESIS_PREMINE {
        return Err(format!(
            "Grand total {grand_total} != GENESIS_PREMINE {}",
            crate::emission::GENESIS_PREMINE
        ));
    }

    Ok(())
}

/// Check whether a transfer from a premine address is allowed at the given height.
pub fn is_premine_transfer_allowed(address: &str, current_height: u64) -> Result<(), String> {
    if let Some(output) = PREMINE_OUTPUTS.iter().find(|o| o.address == address) {
        if let Some(unlock) = output.unlock_height {
            if current_height < unlock {
                return Err(format!(
                    "premine address {} locked until block {} (current: {})",
                    address, unlock, current_height
                ));
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Deterministic tx_id from a tag string (64 hex chars).
fn genesis_tx_id(tag: &str) -> String {
    let hash = cosmic_harmony_ekam_deeksha(tag.as_bytes(), 0);
    crate::hex(&hash.data)
}

/// Merkle root for genesis transactions (same derivation as regular blocks).
fn genesis_merkle_root(transactions: &[Transaction]) -> [u8; 32] {
    let mut seed = [0u8; 32];
    for tx in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(tx.tx_id.as_bytes(), tx.nonce);
        for (slot, value) in seed.iter_mut().zip(tx_hash.data.iter()) {
            *slot ^= *value;
        }
    }
    cosmic_harmony_ekam_deeksha(&seed, transactions.len() as u64).data
}

/// Body hash for genesis (XOR-fold of tx hashes, then final hash).
fn genesis_body_hash(transactions: &[Transaction]) -> [u8; 32] {
    let mut seed = [0u8; 32];
    for tx in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(tx.tx_id.as_bytes(), tx.nonce);
        for (slot, value) in seed.iter_mut().zip(tx_hash.data.iter()) {
            *slot ^= *value;
        }
    }
    cosmic_harmony_ekam_deeksha(&seed, transactions.len() as u64).data
}

/// Verify flower amounts are consistent with ZION amounts.
#[cfg(test)]
fn amounts_consistent(zion: u64, flowers: u128) -> bool {
    flowers == zion as u128 * crate::emission::FLOWERS_PER_ZION as u128
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn premine_has_12_outputs() {
        assert_eq!(PREMINE_OUTPUTS.len(), 12);
    }

    #[test]
    fn premine_totals_validate() {
        validate_premine().expect("premine validation should pass");
    }

    #[test]
    fn premine_total_is_16_28b_zion() {
        let total_zion: u64 = PREMINE_OUTPUTS.iter().map(|o| o.amount_zion).sum();
        assert_eq!(total_zion, 16_280_000_000);
    }

    #[test]
    fn premine_total_flowers_matches_emission_constant() {
        let total_flowers: u128 = PREMINE_OUTPUTS.iter().map(|o| o.amount_flowers).sum();
        assert_eq!(total_flowers, crate::emission::GENESIS_PREMINE);
    }

    #[test]
    fn premine_zion_and_flowers_consistent() {
        for output in PREMINE_OUTPUTS {
            assert!(
                amounts_consistent(output.amount_zion, output.amount_flowers),
                "{}: {} ZION != {} flowers",
                output.address,
                output.amount_zion,
                output.amount_flowers
            );
        }
    }

    #[test]
    fn no_duplicate_premine_addresses() {
        let mut seen = std::collections::HashSet::new();
        for output in PREMINE_OUTPUTS {
            assert!(
                seen.insert(output.address),
                "duplicate premine address: {}",
                output.address
            );
        }
    }

    #[test]
    fn oasis_category_totals_8_25b() {
        let total: u64 = PREMINE_OUTPUTS
            .iter()
            .filter(|o| o.category == "oasis_golden_egg")
            .map(|o| o.amount_zion)
            .sum();
        assert_eq!(total, 8_250_000_000);
    }

    #[test]
    fn dao_treasury_locked_until_525600() {
        for output in PREMINE_OUTPUTS.iter().filter(|o| o.category == "dao_treasury") {
            assert_eq!(output.unlock_height, Some(DAO_TREASURY_LOCK_HEIGHT));
        }
    }

    #[test]
    fn non_dao_premine_unlocked() {
        for output in PREMINE_OUTPUTS.iter().filter(|o| o.category != "dao_treasury") {
            assert_eq!(output.unlock_height, None);
        }
    }

    #[test]
    fn dao_lock_enforced() {
        let dao_addr = PREMINE_OUTPUTS
            .iter()
            .find(|o| o.category == "dao_treasury")
            .unwrap()
            .address;
        assert!(is_premine_transfer_allowed(dao_addr, 0).is_err());
        assert!(is_premine_transfer_allowed(dao_addr, 525_599).is_err());
        assert!(is_premine_transfer_allowed(dao_addr, 525_600).is_ok());
    }

    #[test]
    fn non_dao_unlocked_immediately() {
        let addr = PREMINE_OUTPUTS
            .iter()
            .find(|o| o.category == "infrastructure")
            .unwrap()
            .address;
        assert!(is_premine_transfer_allowed(addr, 0).is_ok());
    }

    #[test]
    fn genesis_block_has_correct_structure() {
        let block = genesis_block();
        assert_eq!(block.height, 0);
        assert_eq!(block.template_id, 0);
        assert_eq!(block.nonce, 0);
        assert_eq!(block.timestamp, GENESIS_TIMESTAMP);
        assert_eq!(block.difficulty, difficulty::GENESIS_DIFFICULTY);
        assert_eq!(block.subsidy_zion, 0);
        assert_eq!(block.miner_reward_zion, 0);
        assert_eq!(block.total_fees_zion, 0);
        assert_eq!(block.transactions.len(), 12);
        assert_eq!(block.transaction_ids.len(), 12);
    }

    #[test]
    fn genesis_block_outputs_match_premine() {
        let block = genesis_block();
        for (i, output) in PREMINE_OUTPUTS.iter().enumerate() {
            let tx = &block.transactions[i];
            assert_eq!(tx.to, output.address);
            assert_eq!(tx.amount_zion, output.amount_zion);
            assert_eq!(tx.from, "genesis");
            assert_eq!(tx.fee_zion, 0);
        }
    }

    #[test]
    fn genesis_hash_is_deterministic() {
        let h1 = genesis_hash();
        let h2 = genesis_hash();
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn genesis_block_hash_is_nonzero() {
        let block = genesis_block();
        assert_ne!(block.hash_hex, crate::hex(&[0u8; 32]));
    }

    #[test]
    fn genesis_body_hash_is_deterministic() {
        let b1 = genesis_block();
        let b2 = genesis_block();
        assert_eq!(b1.body_hash_hex, b2.body_hash_hex);
    }

    #[test]
    fn genesis_tx_ids_are_unique() {
        let block = genesis_block();
        let mut seen = std::collections::HashSet::new();
        for tx in &block.transactions {
            assert!(seen.insert(&tx.tx_id), "duplicate genesis tx_id: {}", tx.tx_id);
        }
    }

    #[test]
    fn genesis_message_is_embedded() {
        assert!(GENESIS_MESSAGE.contains("ZION Mainet Launch v3"));
        assert!(GENESIS_MESSAGE.contains("Peace & One Love 4ever"));
        assert!(GENESIS_MESSAGE.contains("Yose / Zion Creator"));
    }

    #[test]
    fn genesis_message_full_contains_ascii_art() {
        assert!(GENESIS_MESSAGE_FULL.contains("ZION"));
        assert!(GENESIS_MESSAGE_FULL.contains("Mainet Launch v3"));
        assert!(GENESIS_MESSAGE_FULL.contains("Golden Age begins"));
    }

    #[test]
    fn genesis_coinbase_tx_includes_message() {
        // The first tx's tx_id should differ from a plain "genesis-premine-00" hash
        // because it includes GENESIS_MESSAGE in its tag
        let block = genesis_block();
        let plain_tag = "genesis-premine-00";
        let plain_hash = crate::hex(
            &cosmic_harmony_ekam_deeksha(plain_tag.as_bytes(), 0).data,
        );
        assert_ne!(
            block.transactions[0].tx_id, plain_hash,
            "coinbase tx_id must include genesis message"
        );
    }
}
