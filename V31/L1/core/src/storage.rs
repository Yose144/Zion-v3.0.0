//! Persistent storage for the ZION L1 node.
//!
//! SQLite is used because it ships with zero external server setup, supports
//! full ACID semantics, and has a tiny resource footprint — all useful for an
//! Alpha deployment.

use std::path::Path;
use std::sync::Arc;

use rusqlite::{params, Connection, OptionalExtension};
use tokio::sync::Mutex;
use zion_l1_types::Hash;

use crate::block::{Block, BlockHeader};
use crate::difficulty::BlockInfo;
use crate::v3_compat::V3Block;

/// 32-byte hash used for V3 UTXO outpoints and block hashes.
type TxHash = [u8; 32];

/// Storage-layer error.
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("missing genesis")]
    MissingGenesis,
    #[error("missing parent block {0:?}")]
    MissingParent(Hash),
    #[error("corrupt hash bytes")]
    CorruptHash,
}

/// SQLite-backed block store.
#[derive(Clone)]
pub struct Storage {
    conn: Arc<Mutex<Connection>>,
}

impl Storage {
    /// Open (or create) the node database at `path`.
    pub async fn open<P: AsRef<Path>>(path: P) -> Result<Self, StorageError> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;",
        )?;
        let storage = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        storage.init_schema().await?;
        Ok(storage)
    }

    /// Open an in-memory store (useful for tests).
    pub async fn open_in_memory() -> Result<Self, StorageError> {
        let conn = Connection::open_in_memory()?;
        let storage = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        storage.init_schema().await?;
        Ok(storage)
    }

    async fn init_schema(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().await;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS blocks (
                hash BLOB PRIMARY KEY,
                height INTEGER NOT NULL UNIQUE,
                previous_hash BLOB NOT NULL,
                merkle_root BLOB NOT NULL,
                timestamp INTEGER NOT NULL,
                nonce INTEGER NOT NULL,
                difficulty INTEGER NOT NULL,
                body_json TEXT NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height)",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS chain_state (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                tip_hash BLOB NOT NULL,
                tip_height INTEGER NOT NULL,
                tip_difficulty INTEGER NOT NULL,
                tip_timestamp INTEGER NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS v3_blocks (
                hash BLOB PRIMARY KEY,
                height INTEGER NOT NULL UNIQUE,
                previous_hash BLOB NOT NULL,
                timestamp INTEGER NOT NULL,
                difficulty INTEGER NOT NULL,
                body_json TEXT NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_v3_blocks_height ON v3_blocks(height)",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS v3_chain_state (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                tip_hash BLOB NOT NULL,
                tip_height INTEGER NOT NULL,
                tip_difficulty INTEGER NOT NULL,
                tip_timestamp INTEGER NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS v3_utxos (
                tx_hash BLOB NOT NULL,
                output_index INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                address TEXT NOT NULL,
                spent INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (tx_hash, output_index)
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_v3_utxos_address ON v3_utxos(address)",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS v3_accounts (
                address TEXT PRIMARY KEY,
                balance TEXT NOT NULL,
                nonce INTEGER NOT NULL DEFAULT 0
            )",
            [],
        )?;
        Ok(())
    }

    /// Store a block and update the chain tip.
    pub async fn put(&self, block: &Block) -> Result<(), StorageError> {
        let header = &block.header;
        let hash = header.header_hash();
        let body_json = serde_json::to_string(&block.transactions)?;

        // Parent must exist unless this is genesis.
        if header.height > 0 {
            let conn = self.conn.lock().await;
            let parent = self.get_by_hash_internal(&header.previous_hash, &conn)?;
            if parent.is_none() {
                return Err(StorageError::MissingParent(header.previous_hash));
            }
        }

        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT OR REPLACE INTO blocks
             (hash, height, previous_hash, merkle_root, timestamp, nonce, difficulty, body_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                hash.0.as_slice(),
                header.height as i64,
                header.previous_hash.0.as_slice(),
                header.merkle_root.0.as_slice(),
                header.timestamp as i64,
                header.nonce as i64,
                header.difficulty as i64,
                body_json,
            ],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO chain_state
             (singleton, tip_hash, tip_height, tip_difficulty, tip_timestamp)
             VALUES (1, ?1, ?2, ?3, ?4)",
            params![
                hash.0.as_slice(),
                header.height as i64,
                header.difficulty as i64,
                header.timestamp as i64,
            ],
        )?;
        Ok(())
    }

    /// Retrieve a block by its hash.
    pub async fn get_by_hash(&self, hash: &Hash) -> Result<Option<Block>, StorageError> {
        let conn = self.conn.lock().await;
        self.get_by_hash_internal(hash, &conn)
    }

    fn get_by_hash_internal(
        &self,
        hash: &Hash,
        conn: &Connection,
    ) -> Result<Option<Block>, StorageError> {
        let row = conn
            .query_row(
                "SELECT height, previous_hash, merkle_root, timestamp, nonce, difficulty, body_json
                 FROM blocks WHERE hash = ?1",
                [hash.0.as_slice()],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)? as u64,
                        row.get::<_, Vec<u8>>(1)?,
                        row.get::<_, Vec<u8>>(2)?,
                        row.get::<_, i64>(3)? as u64,
                        row.get::<_, i64>(4)? as u64,
                        row.get::<_, i64>(5)? as u64,
                        row.get::<_, String>(6)?,
                    ))
                },
            )
            .optional()?;

        match row {
            Some((height, prev, merkle, ts, nonce, difficulty, body_json)) => {
                let transactions = serde_json::from_str(&body_json)?;
                let header = BlockHeader {
                    previous_hash: bytes_to_hash(&prev)?,
                    merkle_root: bytes_to_hash(&merkle)?,
                    height,
                    timestamp: ts,
                    nonce,
                    difficulty,
                };
                Ok(Some(Block::new(header, transactions)))
            }
            None => Ok(None),
        }
    }

    /// Retrieve a block by height.
    pub async fn get_by_height(&self, height: u64) -> Result<Option<Block>, StorageError> {
        let conn = self.conn.lock().await;
        let hash: Option<Vec<u8>> = conn
            .query_row(
                "SELECT hash FROM blocks WHERE height = ?1",
                [height as i64],
                |row| row.get(0),
            )
            .optional()?;
        match hash {
            Some(h) => self.get_by_hash_internal(&bytes_to_hash(&h)?, &conn),
            None => Ok(None),
        }
    }

    /// Return the current chain tip, if any.
    pub async fn tip(&self) -> Result<Option<(BlockHeader, Hash)>, StorageError> {
        let conn = self.conn.lock().await;
        let row = conn
            .query_row(
                "SELECT tip_hash, tip_height, tip_difficulty, tip_timestamp
                 FROM chain_state WHERE singleton = 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, Vec<u8>>(0)?,
                        row.get::<_, i64>(1)? as u64,
                        row.get::<_, i64>(2)? as u64,
                        row.get::<_, i64>(3)? as u64,
                    ))
                },
            )
            .optional()?;

        match row {
            Some((hash_bytes, height, difficulty, timestamp)) => {
                let hash = bytes_to_hash(&hash_bytes)?;
                let block = self
                    .get_by_hash_internal(&hash, &conn)?
                    .ok_or(StorageError::MissingGenesis)?;
                // Sanity check that the stored header matches the block row.
                assert_eq!(block.header.height, height);
                assert_eq!(block.header.difficulty, difficulty);
                assert_eq!(block.header.timestamp, timestamp);
                Ok(Some((block.header, hash)))
            }
            None => Ok(None),
        }
    }

    /// Return the most recent `count` blocks as `BlockInfo` for LWMA.
    pub async fn difficulty_window(&self, count: usize) -> Result<Vec<BlockInfo>, StorageError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT timestamp, difficulty FROM blocks
             ORDER BY height DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([count as i64], |row| {
            let timestamp: i64 = row.get(0)?;
            let difficulty: i64 = row.get(1)?;
            Ok(BlockInfo {
                timestamp: timestamp as u64,
                difficulty: difficulty as u64,
            })
        })?;

        let mut out = Vec::with_capacity(count);
        for row in rows {
            out.push(row?);
        }
        // LWMA expects oldest-first.
        out.reverse();
        Ok(out)
    }

    /// Number of blocks stored.
    pub async fn height(&self) -> Result<u64, StorageError> {
        let conn = self.conn.lock().await;
        let height: i64 =
            conn.query_row("SELECT COALESCE(MAX(height), -1) FROM blocks", [], |row| {
                row.get(0)
            })?;
        Ok(if height < 0 { 0 } else { height as u64 })
    }

    /// Retrieve a contiguous range of blocks by height (inclusive).
    pub async fn get_blocks_range(&self, start: u64, end: u64) -> Result<Vec<Block>, StorageError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT hash FROM blocks
             WHERE height >= ?1 AND height <= ?2
             ORDER BY height ASC",
        )?;
        let rows = stmt.query_map([start as i64, end as i64], |row| {
            let h: Vec<u8> = row.get(0)?;
            Ok(h)
        })?;

        let mut out = Vec::new();
        for r in rows {
            let h = r?;
            let block = self
                .get_by_hash_internal(&bytes_to_hash(&h)?, &conn)?
                .ok_or(StorageError::MissingGenesis)?;
            out.push(block);
        }
        Ok(out)
    }

    // ------------------------------------------------------------------
    // V3 block storage (checkpoint sync)
    // ------------------------------------------------------------------

    /// Store a V3 block and update the V3 chain tip.
    pub async fn put_v3_block(&self, block: &V3Block) -> Result<(), StorageError> {
        let hash = block.header_hash();
        let body_json = serde_json::to_string(block)?;

        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT OR REPLACE INTO v3_blocks
             (hash, height, previous_hash, timestamp, difficulty, body_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                hash.as_slice(),
                block.height as i64,
                block.header.previous_hash.as_slice(),
                block.header.timestamp as i64,
                block.difficulty as i64,
                body_json,
            ],
        )?;

        // Update tip if this block extends the current best height.
        let current_tip: i64 = conn
            .query_row(
                "SELECT COALESCE(tip_height, -1) FROM v3_chain_state WHERE singleton = 1",
                [],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or(-1);
        if block.height as i64 > current_tip {
            self.set_v3_tip_internal(&hash, block, &conn)?;
        }
        Ok(())
    }

    fn set_v3_tip_internal(
        &self,
        hash: &[u8; 32],
        block: &V3Block,
        conn: &rusqlite::Connection,
    ) -> Result<(), StorageError> {
        conn.execute(
            "INSERT OR REPLACE INTO v3_chain_state
             (singleton, tip_hash, tip_height, tip_difficulty, tip_timestamp)
             VALUES (1, ?1, ?2, ?3, ?4)",
            params![
                hash.as_slice(),
                block.height as i64,
                block.difficulty as i64,
                block.header.timestamp as i64,
            ],
        )?;
        Ok(())
    }

    /// Set the V3 chain tip to a specific block.
    pub async fn set_v3_tip(&self, block: &V3Block) -> Result<(), StorageError> {
        let hash = block.header_hash();
        let conn = self.conn.lock().await;
        self.set_v3_tip_internal(&hash, block, &conn)
    }

    /// Clear the V3 account and UTXO state. Used before replaying a chain
    /// during a reorg.
    pub async fn clear_v3_state(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().await;
        conn.execute("DELETE FROM v3_accounts", [])?;
        conn.execute("DELETE FROM v3_utxos", [])?;
        Ok(())
    }

    /// Retrieve a V3 block by its PoW hash.
    pub async fn get_v3_block_by_hash(
        &self,
        hash: &[u8; 32],
    ) -> Result<Option<V3Block>, StorageError> {
        let conn = self.conn.lock().await;
        self.get_v3_block_by_hash_internal(hash, &conn)
    }

    fn get_v3_block_by_hash_internal(
        &self,
        hash: &[u8; 32],
        conn: &Connection,
    ) -> Result<Option<V3Block>, StorageError> {
        let row = conn
            .query_row(
                "SELECT body_json FROM v3_blocks WHERE hash = ?1",
                [hash.as_slice()],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        match row {
            Some(body_json) => Ok(Some(serde_json::from_str(&body_json)?)),
            None => Ok(None),
        }
    }

    /// Retrieve a V3 block by height.
    pub async fn get_v3_block_by_height(
        &self,
        height: u64,
    ) -> Result<Option<V3Block>, StorageError> {
        let conn = self.conn.lock().await;
        let hash: Option<Vec<u8>> = conn
            .query_row(
                "SELECT hash FROM v3_blocks WHERE height = ?1",
                [height as i64],
                |row| row.get(0),
            )
            .optional()?;
        match hash {
            Some(h) => {
                let h: [u8; 32] = h.try_into().map_err(|_| StorageError::CorruptHash)?;
                self.get_v3_block_by_hash_internal(&h, &conn)
            }
            None => Ok(None),
        }
    }

    /// Return the current V3 chain tip, if any.
    pub async fn v3_tip(&self) -> Result<Option<V3Block>, StorageError> {
        let conn = self.conn.lock().await;
        let hash: Option<Vec<u8>> = conn
            .query_row(
                "SELECT tip_hash FROM v3_chain_state WHERE singleton = 1",
                [],
                |row| row.get(0),
            )
            .optional()?;
        match hash {
            Some(h) => {
                let h: [u8; 32] = h.try_into().map_err(|_| StorageError::CorruptHash)?;
                self.get_v3_block_by_hash_internal(&h, &conn)
            }
            None => Ok(None),
        }
    }

    /// Return the most recent `count` V3 blocks as `BlockInfo` for LWMA.
    pub async fn v3_difficulty_window(&self, count: usize) -> Result<Vec<BlockInfo>, StorageError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT timestamp, difficulty FROM v3_blocks
             ORDER BY height DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([count as i64], |row| {
            let timestamp: i64 = row.get(0)?;
            let difficulty: i64 = row.get(1)?;
            Ok(BlockInfo {
                timestamp: timestamp as u64,
                difficulty: difficulty as u64,
            })
        })?;

        let mut out = Vec::with_capacity(count);
        for row in rows {
            out.push(row?);
        }
        out.reverse();
        Ok(out)
    }

    /// Height of the highest stored V3 block (or 0 if none).
    pub async fn v3_height(&self) -> Result<u64, StorageError> {
        let conn = self.conn.lock().await;
        let height: i64 = conn.query_row(
            "SELECT COALESCE(MAX(height), -1) FROM v3_blocks",
            [],
            |row| row.get(0),
        )?;
        Ok(if height < 0 { 0 } else { height as u64 })
    }

    // ------------------------------------------------------------------
    // V3 state (UTXO + account) storage
    // ------------------------------------------------------------------

    /// Bulk-insert checkpoint UTXOs. Existing rows with the same outpoint are
    /// replaced, but `spent` is preserved if already present.
    pub async fn put_v3_utxos(
        &self,
        utxos: &[(TxHash, u32, u64, String)],
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "INSERT OR REPLACE INTO v3_utxos
             (tx_hash, output_index, amount, address, spent)
             VALUES (?1, ?2, ?3, ?4,
                COALESCE((SELECT spent FROM v3_utxos WHERE tx_hash = ?1 AND output_index = ?2), 0)
             )",
        )?;
        for (tx_hash, output_index, amount, address) in utxos {
            stmt.execute(params![
                tx_hash.as_slice(),
                *output_index as i64,
                *amount as i64,
                address,
            ])?;
        }
        Ok(())
    }

    /// Bulk-insert checkpoint account balances.
    pub async fn put_v3_accounts(
        &self,
        accounts: &[(String, u128, u64)],
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "INSERT OR REPLACE INTO v3_accounts
             (address, balance, nonce)
             VALUES (?1, ?2, ?3)",
        )?;
        for (address, balance, nonce) in accounts {
            stmt.execute(params![address, balance.to_string(), *nonce as i64])?;
        }
        Ok(())
    }

    /// Look up an unspent V3 UTXO. Returns `(amount, address, spent)`.
    pub async fn v3_utxo(
        &self,
        tx_hash: &TxHash,
        output_index: u32,
    ) -> Result<Option<(u64, String, bool)>, StorageError> {
        let conn = self.conn.lock().await;
        let row = conn
            .query_row(
                "SELECT amount, address, spent FROM v3_utxos
                 WHERE tx_hash = ?1 AND output_index = ?2",
                params![tx_hash.as_slice(), output_index as i64],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)? as u64,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)? != 0,
                    ))
                },
            )
            .optional()?;
        Ok(row)
    }

    /// Mark an existing UTXO as spent.
    pub async fn spend_v3_utxo(
        &self,
        tx_hash: &TxHash,
        output_index: u32,
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().await;
        conn.execute(
            "UPDATE v3_utxos SET spent = 1 WHERE tx_hash = ?1 AND output_index = ?2",
            params![tx_hash.as_slice(), output_index as i64],
        )?;
        Ok(())
    }

    /// Create a new UTXO output.
    pub async fn create_v3_utxo(
        &self,
        tx_hash: &TxHash,
        output_index: u32,
        amount: u64,
        address: &str,
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT OR REPLACE INTO v3_utxos
             (tx_hash, output_index, amount, address, spent)
             VALUES (?1, ?2, ?3, ?4, 0)",
            params![
                tx_hash.as_slice(),
                output_index as i64,
                amount as i64,
                address
            ],
        )?;
        Ok(())
    }

    /// Return unspent V3 UTXOs for an address as `(tx_hash, output_index, amount)`.
    pub async fn v3_utxos_by_address(
        &self,
        address: &str,
    ) -> Result<Vec<(TxHash, u32, u64)>, StorageError> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT tx_hash, output_index, amount FROM v3_utxos
             WHERE address = ?1 AND spent = 0
             ORDER BY tx_hash, output_index",
        )?;
        let rows = stmt.query_map([address], |row| {
            let hash: Vec<u8> = row.get(0)?;
            let hash: TxHash = hash.try_into().map_err(|_| rusqlite::Error::InvalidQuery)?;
            Ok((
                hash,
                row.get::<_, i64>(1)? as u32,
                row.get::<_, i64>(2)? as u64,
            ))
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Look up a V3 account balance and nonce.
    pub async fn v3_account(&self, address: &str) -> Result<Option<(u128, u64)>, StorageError> {
        let conn = self.conn.lock().await;
        let row = conn
            .query_row(
                "SELECT balance, nonce FROM v3_accounts WHERE address = ?1",
                [address],
                |row| {
                    let balance: String = row.get(0)?;
                    let nonce: i64 = row.get(1)?;
                    Ok((balance.parse::<u128>().unwrap_or(0), nonce as u64))
                },
            )
            .optional()?;
        Ok(row)
    }

    /// Set a V3 account balance and nonce.
    pub async fn set_v3_account(
        &self,
        address: &str,
        balance: u128,
        nonce: u64,
    ) -> Result<(), StorageError> {
        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT OR REPLACE INTO v3_accounts
             (address, balance, nonce)
             VALUES (?1, ?2, ?3)",
            params![address, balance.to_string(), nonce as i64],
        )?;
        Ok(())
    }
}

fn bytes_to_hash(bytes: &[u8]) -> Result<Hash, StorageError> {
    bytes
        .try_into()
        .map(Hash::new)
        .map_err(|_| StorageError::CorruptHash)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::genesis;
    use crate::v3_compat;

    #[tokio::test]
    async fn round_trip_genesis() {
        let storage = Storage::open_in_memory().await.unwrap();
        let block = genesis::genesis_block();
        storage.put(&block).await.unwrap();

        let (tip_header, tip_hash) = storage.tip().await.unwrap().unwrap();
        assert_eq!(tip_header.height, 0);

        let by_hash = storage.get_by_hash(&tip_hash).await.unwrap().unwrap();
        assert_eq!(by_hash.header.height, 0);

        let by_height = storage.get_by_height(0).await.unwrap().unwrap();
        assert_eq!(by_height.header.merkle_root, block.header.merkle_root);
    }

    #[tokio::test]
    async fn v3_genesis_storage_roundtrip() {
        let storage = Storage::open_in_memory().await.unwrap();
        let block = v3_compat::build_v3_genesis_block();
        let hash = block.header_hash();
        storage.put_v3_block(&block).await.unwrap();

        let tip = storage.v3_tip().await.unwrap().unwrap();
        assert_eq!(tip.height, 0);

        let by_hash = storage.get_v3_block_by_hash(&hash).await.unwrap().unwrap();
        assert_eq!(by_hash.header.merkle_root, block.header.merkle_root);

        let by_height = storage.get_v3_block_by_height(0).await.unwrap().unwrap();
        assert_eq!(by_height.header_hash(), hash);

        let window = storage.v3_difficulty_window(10).await.unwrap();
        assert_eq!(window.len(), 1);
    }
}
