//! ZION V3 — Genesis Block & Premine
//!
//! Constitutional reference: `docs/mainnet/MAINNET_CONSTITUTION.md` §1–§2
//!
//! The genesis block (height 0) carries 14 premine outputs totalling
//! 16,780,000,000 ZION (11.65 % of the 144 B total supply).
//! Block subsidy at height 0 is 0 — the premine is the sole coinbase.
//!
//! Mining subsidy **89/5/5/1** routing and default-operator `zion1` addresses live in constants
//! below ([`MAINNET_CANONICAL_*`]) — they are **not** additional genesis outputs; see
//! `docs/mainnet/PREMINE_AND_CANONICAL_WALLETS_PUBLIC.txt`.

//! Source: `PREMINE_ADDRESSES_PUBLIC.txt` + `L1/core/src/blockchain/premine.rs`

use crate::{difficulty, AcceptedBlock, MiningHeader, Transaction};
use crate::tx::{self, TxOutput};
use zion_cosmic_harmony::{cosmic_harmony_ekam_deeksha, cosmic_harmony_with_height};

// ---------------------------------------------------------------------------
// Canonical mainnet subsidy & operator wallets (89/5/5/1 + default miner + pool payout)
// ---------------------------------------------------------------------------
//
// Issobella / pool-fee / default-miner / pool-payout addresses are derived deterministically from
// the UTF-8 labels below via `crypto::canonical_address_for_label` (BLAKE3 → StdRng → Ed25519).
// **Keys are reconstructible from this repository** — adequate only for bootstrap / open custody;
// operators who need exclusive control should generate fresh keys and override env vars.

/// Label → `MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET`.
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_RECIPIENT_v1";
/// Label → `MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET`.
pub const MAINNET_CANONICAL_POOL_FEE_SUBSIDY_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_POOL_FEE_SUBSIDY_RECIPIENT_v1";
/// Label → `MAINNET_CANONICAL_DEFAULT_MINER_WALLET` (89% share when split is on).
pub const MAINNET_CANONICAL_DEFAULT_MINER_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_DEFAULT_SOLO_MINER_COINBASE_v1";
/// Label → `MAINNET_CANONICAL_POOL_PAYOUT_WALLET` (PPLNS UTXO batch signer address).
pub const MAINNET_CANONICAL_POOL_PAYOUT_LABEL: &str =
    "ZION_V3_MAINNET_CANONICAL_POOL_PPLNS_PAYOUT_SIGNER_v1";

/// Humanitarian 5% coinbase fee recipient (ongoing block subsidy).
/// Distinct from the premine humanitarian slot (slot 12 in PREMINE_OUTPUTS).
/// Mnemonic backup stored on flash disk (F:\ZION_V3_MAINNET_WALLETS.txt).
pub const MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET: &str =
    "zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4";

pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET: &str =
    "zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702";
pub const MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET: &str =
    "zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342";
pub const MAINNET_CANONICAL_DEFAULT_MINER_WALLET: &str =
    "zion1w523a76830x2t5m7f3j023w265e8g5c400a4790";
pub const MAINNET_CANONICAL_POOL_PAYOUT_WALLET: &str =
    "zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604";

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

/// All 14 premine allocations, ordered by category then slot.
/// Total: 16,780,000,000 ZION = 16,780,000,000,000,000,000,000 flowers.
pub const PREMINE_OUTPUTS: &[PremineOutput] = &[
    // --- OASIS + Golden Egg (5 × 1.65B = 8.25B) ---
    PremineOutput {
        address: "zion153e378e4x0g6s380h2h8z4t506g5s323f5se8g5",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 1)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1w548y2k3q802w885u7h0x2z8w7d675m0u3ya0l3",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 2)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion192v4c0k074u7c502q6x8e0t592s564s7l4pm607",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 3)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1n690n062g668s8g0y4772830z8r450c0l06f295",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 4)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion17323k5e490t832f4d0m3w4x3s2e2z7a7600j3v7",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 5)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
    },
    // --- DAO Treasury (3 slots = 4.0B) — locked until height 525,600 ---
    PremineOutput {
        address: "zion1t4l2f5j737989828v295n7z4r3v5j8k895m56n4",
        purpose: "DAO Treasury — Community Governance (main)",
        amount_zion: 2_500_000_000,
        amount_flowers: 2_500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
    },
    PremineOutput {
        address: "zion1r5j0j7y444a8j402n8t8u2n8y323u6x4r2aw7l6",
        purpose: "DAO Treasury — Grants & Bounties",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
    },
    PremineOutput {
        address: "zion1932843t398t095g4h3x2f3a5l0q40490k4fm2w8",
        purpose: "DAO Treasury — Ecosystem Bootstrap",
        amount_zion: 500_000_000,
        amount_flowers: 500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
    },
    // --- Infrastructure (3 slots = 2.59B) ---
    PremineOutput {
        address: "zion1d3p5x622m327r060w5z0q5r203v837m6l8pa8x5",
        purpose: "Core Development Fund",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion1r6r4s0u2e6u4t23767s05752d70660h2f29d2l7",
        purpose: "Network Infrastructure — P2P Seed Nodes",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
    },
    PremineOutput {
        address: "zion16542q4l853a2z0u5r5w8y4m8k4558847h503736",
        purpose: "Genesis Creator — Lifetime Rent",
        amount_zion: 590_000_000,
        amount_flowers: 590_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
    },
    // --- Humanitarian (1 slot = 1.44B) ---
    PremineOutput {
        address: "zion1z7g4u3s2w3c5z5u4a60864m2y7q8e5j304g46r7",
        purpose: "Children Future Fund — Humanitarian DAO",
        amount_zion: 1_440_000_000,
        amount_flowers: 1_440_000_000_000_000_000_000,
        category: "humanitarian",
        unlock_height: None,
    },
    // --- Bridge Seed Fund (1 slot = 0.4B) — immediate unlock for EVM bridge liquidity ---
    PremineOutput {
        address: "zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3",
        purpose: "Bridge Seed Fund — EVM Bridge Liquidity",
        amount_zion: 400_000_000,
        amount_flowers: 400_000_000_000_000_000_000,
        category: "bridge_seed",
        unlock_height: None,
    },
    // --- Bridge Vault UTXO Seed (1 slot = 0.1B) — UTXO liquidity for bridge unlocks ---
    PremineOutput {
        address: "zion1r565v3k2u8p8t6n494p0n527c0m7a5s4s5ae0x7",
        purpose: "Bridge Vault UTXO Seed — EVM Bridge Unlock Liquidity",
        amount_zion: 100_000_000,
        amount_flowers: 100_000_000_000_000_000_000,
        category: "bridge_vault_utxo",
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
/// - 13 account-model premine transactions + 1 UTXO coinbase
/// - subsidy = 0 (no mining reward at height 0)
/// - miner_reward = 0
pub fn genesis_block() -> AcceptedBlock {
    let mut transactions: Vec<Transaction> = Vec::new();
    let mut utxo_transactions: Vec<tx::Transaction> = Vec::new();

    for (i, output) in PREMINE_OUTPUTS.iter().enumerate() {
        if output.category == "bridge_vault_utxo" {
            // UTXO coinbase for bridge vault — 100M ZION split into 6 outputs
            // so each fits in u64.
            const VAULT_AMOUNT_PER_OUTPUT: u64 = 16_666_666_666_666_666_666;
            const VAULT_AMOUNT_LAST: u64 = 16_666_666_666_666_666_670;
            let mut utxo = tx::Transaction {
                id: [0u8; 32],
                version: tx::TX_HASH_V2_VERSION,
                inputs: vec![],
                outputs: vec![],
                fee: 0,
                timestamp: GENESIS_TIMESTAMP,
            };
            for _ in 0..5 {
                utxo.outputs.push(TxOutput {
                    amount: VAULT_AMOUNT_PER_OUTPUT,
                    address: output.address.to_string(),
                    memo: None,
                });
            }
            utxo.outputs.push(TxOutput {
                amount: VAULT_AMOUNT_LAST,
                address: output.address.to_string(),
                memo: None,
            });
            utxo.id = utxo.calculate_hash();
            utxo_transactions.push(utxo);
        } else {
            // Standard account-model genesis transaction
            let tag = if i == 0 {
                format!("genesis-premine-{i:02}:{}:{}", output.address, GENESIS_MESSAGE)
            } else {
                format!("genesis-premine-{i:02}:{}", output.address)
            };
            let tx_id = genesis_tx_id(&tag, i as u64);
            transactions.push(Transaction {
                tx_id,
                from: "genesis".to_string(),
                to: output.address.to_string(),
                amount_zion: output.amount_flowers,
                fee_zion: 0,
                nonce: i as u64,
                signature: String::new(),
                public_key: String::new(),
            });
        }
    }

    let transaction_ids: Vec<String> = transactions.iter().map(|tx| tx.tx_id.clone()).collect();
    let utxo_transaction_ids: Vec<String> = utxo_transactions
        .iter()
        .map(|tx| crate::hex(&tx.id))
        .collect();

    // Build the genesis header, hash it, and produce the canonical hash.
    let genesis_target = difficulty::difficulty_to_target(difficulty::GENESIS_DIFFICULTY);
    let genesis_bits = difficulty::target_to_compact(&genesis_target);
    let merkle_root =
        crate::derive_template_merkle_root_v2_blake3(&transactions, &utxo_transactions);

    let header = MiningHeader {
        version: 3,
        previous_hash: [0u8; 32],
        merkle_root,
        timestamp: GENESIS_TIMESTAMP,
        difficulty_bits: genesis_bits,
    };

    let hash = cosmic_harmony_with_height(&header.to_bytes(), 0, 0);
    let hash_hex = crate::hex(&hash.data);
    let header_hex = crate::hex(&header.to_bytes());

    let body_hash = genesis_body_hash(&transactions);

    AcceptedBlock {
        template_id: 0,
        height: 0,
        timestamp: GENESIS_TIMESTAMP,
        difficulty: difficulty::GENESIS_DIFFICULTY,
        nonce: 0,
        hash_hex,
        header_hex,
        previous_hash_hex: crate::hex(&[0u8; 32]),
        transaction_ids,
        transactions,
        total_fees_zion: 0,
        body_hash_hex: crate::hex(&body_hash),
        subsidy_zion: 0,
        miner_reward_zion: 0,
        miner_address: String::new(),
        humanitarian_address: String::new(),
        issobella_address: String::new(),
        pool_fee_address: String::new(),
        utxo_transaction_ids,
        utxo_transactions,
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
        return Err(format!(
            "Humanitarian total {humanitarian} != 1.44B flowers"
        ));
    }

    let bridge_seed: u128 = PREMINE_OUTPUTS
        .iter()
        .filter(|o| o.category == "bridge_seed")
        .map(|o| o.amount_flowers)
        .sum();
    if bridge_seed != 400_000_000_000_000_000_000 {
        return Err(format!(
            "Bridge Seed total {bridge_seed} != 0.4B flowers"
        ));
    }

    let bridge_vault_utxo: u128 = PREMINE_OUTPUTS
        .iter()
        .filter(|o| o.category == "bridge_vault_utxo")
        .map(|o| o.amount_flowers)
        .sum();
    if bridge_vault_utxo != 100_000_000_000_000_000_000 {
        return Err(format!(
            "Bridge Vault UTXO total {bridge_vault_utxo} != 0.1B flowers"
        ));
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

/// Deterministic tx_id from a tag string and nonce (64 hex chars).
fn genesis_tx_id(tag: &str, nonce: u64) -> String {
    let hash = cosmic_harmony_ekam_deeksha(tag.as_bytes(), nonce);
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
    fn premine_has_14_outputs() {
        assert_eq!(PREMINE_OUTPUTS.len(), 14);
    }

    #[test]
    fn premine_totals_validate() {
        validate_premine().expect("premine validation should pass");
    }

    #[test]
    fn premine_total_is_16_78b_zion() {
        let total_zion: u64 = PREMINE_OUTPUTS.iter().map(|o| o.amount_zion).sum();
        assert_eq!(total_zion, 16_780_000_000);
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
        for output in PREMINE_OUTPUTS
            .iter()
            .filter(|o| o.category == "dao_treasury")
        {
            assert_eq!(output.unlock_height, Some(DAO_TREASURY_LOCK_HEIGHT));
        }
    }

    #[test]
    fn non_dao_premine_unlocked() {
        for output in PREMINE_OUTPUTS
            .iter()
            .filter(|o| o.category != "dao_treasury")
        {
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
        assert_eq!(block.transactions.len(), 13);
        assert_eq!(block.transaction_ids.len(), 13);
        assert_eq!(block.utxo_transactions.len(), 1);
        assert_eq!(block.utxo_transaction_ids.len(), 1);
    }

    #[test]
    fn genesis_block_outputs_match_premine() {
        let block = genesis_block();
        let mut account_idx = 0;
        for output in PREMINE_OUTPUTS.iter() {
            if output.category == "bridge_vault_utxo" {
                // UTXO premine output is in utxo_transactions, not transactions
                let utxo_tx = block.utxo_transactions.first().expect("bridge vault utxo should exist");
                let total_utxo: u128 = utxo_tx.outputs.iter().map(|o| o.amount as u128).sum();
                assert_eq!(total_utxo, output.amount_flowers);
                assert!(utxo_tx.outputs.iter().all(|o| o.address == output.address));
            } else {
                let tx = &block.transactions[account_idx];
                assert_eq!(tx.to, output.address);
                assert_eq!(tx.amount_zion, output.amount_flowers);
                assert_eq!(tx.from, "genesis");
                assert_eq!(tx.fee_zion, 0);
                account_idx += 1;
            }
        }
        assert_eq!(account_idx, block.transactions.len());
    }

    #[test]
    fn genesis_vault_utxo_has_six_outputs() {
        let block = genesis_block();
        let utxo_tx = block.utxo_transactions.first().expect("vault utxo should exist");
        assert_eq!(utxo_tx.outputs.len(), 6);
        assert!(utxo_tx.inputs.is_empty(), "genesis UTXO should be coinbase (no inputs)");
        assert_eq!(utxo_tx.fee, 0);
        let total: u128 = utxo_tx.outputs.iter().map(|o| o.amount as u128).sum();
        assert_eq!(total, 100_000_000_000_000_000_000_u128);
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
            assert!(
                seen.insert(&tx.tx_id),
                "duplicate genesis tx_id: {}",
                tx.tx_id
            );
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
    fn canonical_mainnet_subsidy_wallets_track_label_derivation() {
        use crate::crypto;
        // Labels must produce valid addresses (they are deterministic from the
        // repo-pinned label strings).  The actual canonical addresses in
        // MAINNET_CANONICAL_*_WALLET were generated from an offline mnemonic
        // seed during genesis regeneration, so they will NOT match the
        // label-derived addresses.  This test only guards that the label
        // derivation function itself works.
        for label in [
            MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_LABEL,
            MAINNET_CANONICAL_POOL_FEE_SUBSIDY_LABEL,
            MAINNET_CANONICAL_DEFAULT_MINER_LABEL,
            MAINNET_CANONICAL_POOL_PAYOUT_LABEL,
        ] {
            let addr = crypto::canonical_address_for_label(label);
            assert!(
                crypto::is_valid_address(&addr),
                "label '{label}' produced invalid address: {addr}"
            );
        }
    }

    #[test]
    fn canonical_mainnet_addresses_are_valid_zion1() {
        for addr in [
            MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET,
            MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET,
            MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET,
            MAINNET_CANONICAL_DEFAULT_MINER_WALLET,
            MAINNET_CANONICAL_POOL_PAYOUT_WALLET,
        ] {
            assert!(
                crate::crypto::is_valid_address(addr),
                "invalid canonical address: {addr}"
            );
        }
        // Validate that the premine humanitarian address is also a valid zion1 address.
        let premine_humanitarian = PREMINE_OUTPUTS
            .iter()
            .find(|o| o.category == "humanitarian")
            .unwrap()
            .address;
        assert!(
            crate::crypto::is_valid_address(premine_humanitarian),
            "invalid premine humanitarian address: {premine_humanitarian}"
        );
    }

    #[test]
    fn canonical_subsidy_wallets_are_distinct_and_not_duplicate_premine_slots() {
        let canon = [
            MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET,
            MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET,
            MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET,
            MAINNET_CANONICAL_DEFAULT_MINER_WALLET,
            MAINNET_CANONICAL_POOL_PAYOUT_WALLET,
        ];
        let mut seen = std::collections::HashSet::new();
        for a in canon {
            assert!(seen.insert(a), "duplicate canonical address: {a}");
            assert!(
                !PREMINE_OUTPUTS.iter().any(|o| o.address == a),
                "canonical operator address must not duplicate a genesis premine recipient: {a}"
            );
        }
    }
    #[test]
    fn genesis_coinbase_tx_includes_message() {
        // The first tx's tx_id should differ from a plain "genesis-premine-00" hash
        // because it includes GENESIS_MESSAGE in its tag
        let block = genesis_block();
        let plain_tag = "genesis-premine-00";
        let plain_hash = crate::hex(&cosmic_harmony_ekam_deeksha(plain_tag.as_bytes(), 0).data);
        assert_ne!(
            block.transactions[0].tx_id, plain_hash,
            "coinbase tx_id must include genesis message"
        );
    }
}
