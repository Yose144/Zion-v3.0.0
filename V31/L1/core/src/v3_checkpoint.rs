//! V3 checkpoint import.
//!
//! A checkpoint is a trusted snapshot of the V3 chain at a particular height.
//! It carries the last validated block header (so V3 P2P sync can resume
//! immediately after the snapshot) and the UTXO / account state at that point
//! (so transaction validation can be bootstrapped without replaying the entire
//! chain from genesis).

use serde::Deserialize;

use crate::storage::{Storage, StorageError};
use crate::v3_compat::{MiningHeader, V3Block};

/// Serde helper for u128 values that may be represented as strings in JSON.
mod u128_str {
    use serde::{Deserialize, Deserializer};

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNum {
        Str(String),
        Num(u64),
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u128, D::Error> {
        match StringOrNum::deserialize(deserializer)? {
            StringOrNum::Str(s) => s.parse::<u128>().map_err(serde::de::Error::custom),
            StringOrNum::Num(n) => Ok(n as u128),
        }
    }
}

/// UTXO output captured by a checkpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct CheckpointUtxo {
    pub tx_hash_hex: String,
    pub output_index: u32,
    pub amount: u64,
    pub address: String,
}

/// Account balance captured by a checkpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct CheckpointAccount {
    pub address: String,
    #[serde(with = "u128_str")]
    pub balance: u128,
    pub nonce: u64,
}

/// Trusted V3 snapshot used to bootstrap a checkpoint-synced node.
#[derive(Debug, Clone, Deserialize)]
pub struct Checkpoint {
    pub block_height: u64,
    pub block_hash_hex: String,
    pub header_hex: String,
    pub nonce: u64,
    pub difficulty: u64,
    #[serde(with = "u128_str")]
    pub total_zion: u128,
    pub utxos: Vec<CheckpointUtxo>,
    pub accounts: Vec<CheckpointAccount>,
}

impl Checkpoint {
    /// Load a checkpoint from a JSON string.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Decode the block hash into raw bytes.
    pub fn block_hash(&self) -> Result<[u8; 32], String> {
        hex_to_array32(&self.block_hash_hex)
    }

    /// Decode the 80-byte `MiningHeader`.
    pub fn header(&self) -> Result<MiningHeader, String> {
        let bytes =
            hex::decode(&self.header_hex).map_err(|e| format!("invalid header hex: {e}"))?;
        if bytes.len() != MiningHeader::HEADER_SIZE {
            return Err(format!(
                "header length {} != {} expected",
                bytes.len(),
                MiningHeader::HEADER_SIZE
            ));
        }
        let bytes: [u8; MiningHeader::HEADER_SIZE] = bytes
            .try_into()
            .map_err(|_| "header length mismatch".to_string())?;
        Ok(MiningHeader::from_bytes(bytes))
    }

    /// Convert the checkpoint header into a synthetic `V3Block`.
    ///
    /// This block has no transactions (the state is stored separately in the
    /// `v3_utxos` / `v3_accounts` tables), but its header is enough to resume
    /// P2P sync and validate the next block's `previous_hash`.
    pub fn to_v3_block(&self) -> Result<V3Block, String> {
        let header = self.header()?;
        let block = V3Block {
            height: self.block_height,
            nonce: self.nonce,
            difficulty: self.difficulty,
            header,
            transactions: Vec::new(),
            utxo_transactions: Vec::new(),
        };
        let expected_hash = self.block_hash()?;
        if block.header_hash() != expected_hash {
            return Err(format!(
                "checkpoint block hash mismatch: computed {} vs expected {}",
                hex::encode(block.header_hash()),
                hex::encode(expected_hash)
            ));
        }
        Ok(block)
    }
}

/// Import a checkpoint into storage.
///
/// Stores the synthetic block, the UTXO set and the account balances.  This
/// operation trusts the snapshot — it performs no transaction replay or
/// signature verification.
pub async fn import_checkpoint(
    storage: &Storage,
    checkpoint: &Checkpoint,
) -> Result<(), CheckpointError> {
    let block = checkpoint
        .to_v3_block()
        .map_err(CheckpointError::InvalidCheckpoint)?;
    storage.put_v3_block(&block).await?;

    let mut utxos = Vec::with_capacity(checkpoint.utxos.len());
    for u in &checkpoint.utxos {
        let tx_hash =
            hex_to_array32(&u.tx_hash_hex).map_err(|e| CheckpointError::InvalidCheckpoint(e))?;
        utxos.push((tx_hash, u.output_index, u.amount, u.address.clone()));
    }
    storage.put_v3_utxos(&utxos).await?;

    let mut accounts = Vec::with_capacity(checkpoint.accounts.len());
    for a in &checkpoint.accounts {
        accounts.push((a.address.clone(), a.balance, a.nonce));
    }
    storage.put_v3_accounts(&accounts).await?;

    Ok(())
}

/// Checkpoint error.
#[derive(Debug, thiserror::Error)]
pub enum CheckpointError {
    #[error("invalid checkpoint: {0}")]
    InvalidCheckpoint(String),
    #[error("storage error: {0}")]
    Storage(#[from] StorageError),
}

fn hex_to_array32(s: &str) -> Result<[u8; 32], String> {
    let bytes = hex::decode(s).map_err(|e| format!("invalid hex: {e}"))?;
    bytes
        .try_into()
        .map_err(|_| "hash length mismatch".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::v3_compat::build_v3_genesis_block;

    #[tokio::test]
    async fn import_genesis_checkpoint() {
        let block = build_v3_genesis_block();
        let checkpoint = Checkpoint {
            block_height: block.height,
            block_hash_hex: hex::encode(block.header_hash()),
            header_hex: hex::encode(block.header.to_bytes()),
            nonce: block.nonce,
            difficulty: block.difficulty,
            total_zion: 16_780_000_000_000_000_000_000u128,
            utxos: vec![CheckpointUtxo {
                tx_hash_hex: "00".repeat(32),
                output_index: 0,
                amount: 1000,
                address: "zion1test".to_string(),
            }],
            accounts: vec![CheckpointAccount {
                address: "zion1burn0000000000000000000000000000000dead".to_string(),
                balance: 0,
                nonce: 0,
            }],
        };

        let storage = Storage::open_in_memory().await.unwrap();
        import_checkpoint(&storage, &checkpoint).await.unwrap();

        let tip = storage.v3_tip().await.unwrap().unwrap();
        assert_eq!(tip.height, 0);

        let utxo = storage.v3_utxo(&[0u8; 32], 0).await.unwrap().unwrap();
        assert_eq!(utxo.0, 1000);

        let account = storage
            .v3_account("zion1burn0000000000000000000000000000000dead")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(account.0, 0);
    }
}
