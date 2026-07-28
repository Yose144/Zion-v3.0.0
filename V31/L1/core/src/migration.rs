//! V3 -> V31 chain state migration.
//!
//! Reads a V3 `zion-node-state.db` JSON export and produces a V31 migration
//! block (height 0) that snapshot-imports the final account balances and
//! unspent UTXO outputs.
//!
//! The migration is intentionally a **state snapshot**, not a block-for-block
//! import: V31 and V3 use different block header layouts, transaction models,
//! and block-identity hashes. Carrying the final UTXO/account state forward
//! lets V31 start from a clean genesis that preserves total supply.

use std::collections::HashMap;
use std::path::Path;

use serde::Deserialize;
use zion_l1_types::{Address, Amount, ChainId, Hash};

use crate::block::{Block, BlockHeader};
use crate::genesis;
use crate::storage::Storage;
use crate::transaction::{Transaction, TransactionOutput};

/// V3 genesis values were stored with `1 ZION = 1_000_000_000_000 flowers`.
/// Post-3.0.3 (and V31) use `1 ZION = 1_000_000 flowers`.
const V3_LEGACY_FLOWERS_PER_ZION: u128 = 1_000_000_000_000;
const V31_FLOWERS_PER_ZION: u128 = 1_000_000;
const LEGACY_SCALE_FACTOR: u128 = V3_LEGACY_FLOWERS_PER_ZION / V31_FLOWERS_PER_ZION;

/// Errors that can occur while migrating V3 state.
#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json parse error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
    #[error("invalid amount string: {0}")]
    InvalidAmount(String),
    #[error("no accepted blocks in V3 state")]
    EmptyState,
}

/// Summary of a completed migration.
#[derive(Clone, Debug)]
pub struct MigrationSummary {
    pub v3_height: u64,
    pub v3_tip_hash: String,
    pub migration_height: u64,
    pub output_count: usize,
    pub total_flowers: u128,
    pub timestamp: u64,
    pub difficulty: u64,
}

/// Top-level V3 node state export.
#[derive(Debug, Deserialize)]
struct V3State {
    #[serde(rename = "height")]
    v3_height: u64,
    accepted_blocks: Vec<V3Block>,
}

#[derive(Debug, Deserialize)]
struct V3Block {
    height: u64,
    timestamp: u64,
    difficulty: u64,
    nonce: u64,
    hash_hex: String,
    #[serde(default)]
    transactions: Vec<V3AccountTx>,
    #[serde(default, rename = "utxo_transactions")]
    utxo_transactions: Vec<V3UtxoTx>,
}

#[derive(Debug, Deserialize)]
struct V3AccountTx {
    from: String,
    to: String,
    amount_zion: String,
    fee_zion: u64,
}

#[derive(Debug, Deserialize)]
struct V3UtxoTx {
    id: [u8; 32],
    #[serde(default)]
    inputs: Vec<V3UtxoInput>,
    #[serde(default)]
    outputs: Vec<V3UtxoOutput>,
}

#[derive(Debug, Deserialize)]
struct V3UtxoInput {
    prev_tx_hash: [u8; 32],
    output_index: u32,
}

#[derive(Debug, Deserialize)]
struct V3UtxoOutput {
    amount: u64,
    address: String,
}

/// Read a V3 state JSON export and import the final balances as a single V31
/// migration block at height 0.
pub async fn migrate_v3_state<P: AsRef<Path>>(
    state_path: P,
    storage: &Storage,
) -> Result<MigrationSummary, MigrationError> {
    let json = tokio::fs::read_to_string(state_path).await?;
    let state: V3State = serde_json::from_str(&json)?;

    if state.accepted_blocks.is_empty() {
        return Err(MigrationError::EmptyState);
    }

    let tip = state
        .accepted_blocks
        .last()
        .expect("accepted_blocks is non-empty");

    let mut account_balances: HashMap<String, u128> = HashMap::new();
    // Per-address, per-scale unspent UTXO raw totals.
    let mut utxo_unspent_raw: HashMap<(String, u128), u128> = HashMap::new();
    // UTXO pool keyed by outpoint: (address, raw_amount, scale_factor).
    let mut utxo_pool: HashMap<(Hash, u32), (String, u128, u128)> = HashMap::new();

    for block in &state.accepted_blocks {
        let factor = scale_factor(block.height);

        for tx in &block.transactions {
            let amount = parse_amount(&tx.amount_zion)? / factor;
            let fee = tx.fee_zion as u128 / factor;

            if tx.from == "genesis" || tx.from == "coinbase" {
                *account_balances.entry(tx.to.clone()).or_insert(0) += amount;
            } else {
                let sender = account_balances.entry(tx.from.clone()).or_insert(0);
                *sender = sender.saturating_sub(amount + fee);
                *account_balances.entry(tx.to.clone()).or_insert(0) += amount;
            }
        }

        for tx in &block.utxo_transactions {
            let tx_hash = Hash::new(tx.id);

            for input in &tx.inputs {
                let key = (Hash::new(input.prev_tx_hash), input.output_index);
                if let Some((addr, raw, f)) = utxo_pool.remove(&key) {
                    *utxo_unspent_raw.entry((addr, f)).or_insert(0) = utxo_unspent_raw
                        .get(&(addr.clone(), f))
                        .copied()
                        .unwrap_or(0)
                        .saturating_sub(raw);
                }
            }

            for (i, output) in tx.outputs.iter().enumerate() {
                let raw = output.amount as u128;
                utxo_pool.insert((tx_hash, i as u32), (output.address.clone(), raw, factor));
                *utxo_unspent_raw
                    .entry((output.address.clone(), factor))
                    .or_insert(0) += raw;
            }
        }
    }

    // Convert UTXO raw totals to V31 flowers and merge with account balances.
    for ((addr, factor), raw) in utxo_unspent_raw {
        let converted = raw / factor;
        if converted == 0 {
            continue;
        }
        *account_balances.entry(addr).or_insert(0) += converted;
    }

    // Build one coinbase-like migration transaction containing all final
    // balances. This is a state snapshot, so a single no-input transaction is
    // acceptable for the migration block.
    let mut outputs: Vec<TransactionOutput> = account_balances
        .into_iter()
        .filter(|(_, amount)| *amount > 0)
        .map(|(addr, amount)| {
            let address = Address::new(ChainId::ZionL1, Vec::new(), addr)
                .expect("V3 address must be valid encoded string");
            TransactionOutput {
                amount: Amount::new(amount),
                address,
            }
        })
        .collect();
    outputs.sort_by(|a, b| a.address.encoded.cmp(&b.address.encoded));

    let memo = format!("V3 migration snapshot at height {}", tip.height).into_bytes();
    let migration_tx = Transaction {
        version: 1,
        inputs: Vec::new(),
        outputs,
        memo,
    };

    let merkle_root = genesis::merkle_root(std::slice::from_ref(&migration_tx));
    let previous_hash = Hash::default();

    let header = BlockHeader {
        previous_hash,
        merkle_root,
        height: 0,
        timestamp: tip.timestamp,
        nonce: tip.nonce,
        difficulty: tip.difficulty,
    };

    let block = Block::new(header, vec![migration_tx]);
    storage.put(&block).await?;

    let total_flowers = block.transactions[0]
        .outputs
        .iter()
        .map(|o| o.amount.0)
        .sum();

    Ok(MigrationSummary {
        v3_height: state.v3_height,
        v3_tip_hash: tip.hash_hex.clone(),
        migration_height: 0,
        output_count: block.transactions[0].outputs.len(),
        total_flowers,
        timestamp: tip.timestamp,
        difficulty: tip.difficulty,
    })
}

fn parse_amount(s: &str) -> Result<u128, MigrationError> {
    s.parse::<u128>()
        .map_err(|_| MigrationError::InvalidAmount(s.to_string()))
}

fn scale_factor(height: u64) -> u128 {
    if height == 0 {
        LEGACY_SCALE_FACTOR
    } else {
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn migrates_minimal_v3_state() {
        let json = r#"{
            "height": 1,
            "tip_hash_hex": "0000abcd",
            "accepted_blocks": [
                {
                    "template_id": 0,
                    "height": 0,
                    "timestamp": 1000,
                    "difficulty": 1000,
                    "nonce": 0,
                    "hash_hex": "00",
                    "header_hex": "",
                    "previous_hash_hex": "0000000000000000000000000000000000000000000000000000000000000000",
                    "algorithm": "deeksha_lite_v1",
                    "transaction_ids": [],
                    "transactions": [
                        {"tx_id":"a","from":"genesis","to":"zion1premine","amount_zion":"1000000000000","fee_zion":0,"nonce":0}
                    ],
                    "total_fees_zion": 0,
                    "body_hash_hex": "",
                    "subsidy_zion": 0,
                    "miner_reward_zion": 0,
                    "utxo_transaction_ids": [],
                    "utxo_transactions": []
                },
                {
                    "template_id": 1,
                    "height": 1,
                    "timestamp": 1060,
                    "difficulty": 1000,
                    "nonce": 123,
                    "hash_hex": "01",
                    "header_hex": "",
                    "previous_hash_hex": "00",
                    "algorithm": "deeksha_lite_v1",
                    "transaction_ids": [],
                    "transactions": [
                        {"tx_id":"b","from":"coinbase","to":"zion1miner","amount_zion":"5400067000","fee_zion":0,"nonce":1}
                    ],
                    "total_fees_zion": 0,
                    "body_hash_hex": "",
                    "subsidy_zion": 5400067000,
                    "miner_reward_zion": 5400067000,
                    "utxo_transaction_ids": [],
                    "utxo_transactions": []
                }
            ]
        }"#;

        let state_path =
            std::env::temp_dir().join(format!("zion-migration-test-{}.json", std::process::id()));
        tokio::fs::write(&state_path, json).await.unwrap();

        let storage = Storage::open_in_memory().await.unwrap();
        let summary = migrate_v3_state(&state_path, &storage).await.unwrap();

        assert_eq!(summary.v3_height, 1);
        assert_eq!(summary.migration_height, 0);
        assert_eq!(summary.output_count, 2);
        // 1 ZION legacy = 1e12 legacy flowers -> 1e6 V31 flowers
        // 1000000000000 legacy flowers = 1_000_000 V31 flowers = 1 ZION
        // miner 5400067000 new flowers = 5400.0067 ZION
        assert_eq!(summary.total_flowers, 1_000_000 + 5_400_067_000);

        let _ = tokio::fs::remove_file(&state_path).await;
    }
}
