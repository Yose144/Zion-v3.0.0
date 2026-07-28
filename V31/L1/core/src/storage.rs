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
}
