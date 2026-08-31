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

        // ── Native V31 transaction / address indexes ──────────────────────
        // `tx_index` gives O(1) height lookups for a given tx hash, instead
        // of the previous full-chain linear scan in `Node::find_transaction`.
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tx_index (
                tx_hash BLOB PRIMARY KEY,
                height INTEGER NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tx_index_height ON tx_index(height)",
            [],
        )?;
        // `output_index` permanently records the owning address of every
        // output ever created (unlike the in-memory `UtxoSet`, which removes
        // an entry the moment it is spent). This lets us resolve a
        // transaction input's spender address in O(1) without needing to
        // fetch and deserialize the entire ancestor block.
        conn.execute(
            "CREATE TABLE IF NOT EXISTS output_index (
                tx_hash BLOB NOT NULL,
                output_index INTEGER NOT NULL,
                address TEXT NOT NULL,
                amount TEXT NOT NULL,
                PRIMARY KEY (tx_hash, output_index)
            )",
            [],
        )?;
        // `address_tx_index` is the address -> transaction history index used
        // by `getTransactionHistory` for native V31 UTXO addresses. A single
        // transaction can involve the same address twice (once as sender,
        // once as receiver, e.g. change outputs); `direction` records which
        // side was seen first, but is intentionally *not* part of the primary
        // key so each (address, tx) pair appears at most once in history
        // results (self-transfers are recorded once, not duplicated).
        conn.execute(
            "CREATE TABLE IF NOT EXISTS address_tx_index (
                address TEXT NOT NULL,
                tx_hash BLOB NOT NULL,
                height INTEGER NOT NULL,
                direction TEXT NOT NULL,
                PRIMARY KEY (address, tx_hash)
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_address_tx_index_lookup
             ON address_tx_index(address, height DESC)",
            [],
        )?;
        Ok(())
    }

    /// Index a block's transactions into `tx_index`, `output_index`, and
    /// `address_tx_index`. Must be called with the same connection used to
    /// persist the block (see `put`), after the block row has been written,
    /// and only once per block height (ancestor blocks must already be
    /// indexed so that input addresses can be resolved via `output_index`).
    fn index_block_transactions(
        &self,
        conn: &Connection,
        block: &Block,
    ) -> Result<(), StorageError> {
        let height = block.header.height as i64;
        for tx in &block.transactions {
            let tx_hash = tx.hash();
            let tx_hash_bytes = tx_hash.0.as_slice();

            conn.execute(
                "INSERT OR REPLACE INTO tx_index (tx_hash, height) VALUES (?1, ?2)",
                params![tx_hash_bytes, height],
            )?;

            // Resolve the spender address for each input via output_index.
            // Coinbase transactions have no inputs to resolve.
            if !tx.is_coinbase() {
                for input in &tx.inputs {
                    let prev_bytes = input.previous_output.0.as_slice();
                    let owner: Option<String> = conn
                        .query_row(
                            "SELECT address FROM output_index
                             WHERE tx_hash = ?1 AND output_index = ?2",
                            params![prev_bytes, input.index as i64],
                            |row| row.get(0),
                        )
                        .optional()?;
                    if let Some(address) = owner {
                        conn.execute(
                            "INSERT OR IGNORE INTO address_tx_index
                             (address, tx_hash, height, direction)
                             VALUES (?1, ?2, ?3, 'out')",
                            params![address, tx_hash_bytes, height],
                        )?;
                    }
                }
            }

            // Record each output's owning address (both for future input
            // resolution and for the receiver-side address history).
            for (idx, output) in tx.outputs.iter().enumerate() {
                let address = &output.address.encoded;
                conn.execute(
                    "INSERT OR REPLACE INTO output_index
                     (tx_hash, output_index, address, amount)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![
                        tx_hash_bytes,
                        idx as i64,
                        address,
                        output.amount.0.to_string()
                    ],
                )?;
                conn.execute(
                    "INSERT OR IGNORE INTO address_tx_index
                     (address, tx_hash, height, direction)
                     VALUES (?1, ?2, ?3, 'in')",
                    params![address, tx_hash_bytes, height],
                )?;
            }
        }
        Ok(())
    }

    /// Height of a native V31 transaction, resolved in O(1) via `tx_index`.
    pub async fn find_tx_height(&self, tx_hash: &Hash) -> Result<Option<u64>, StorageError> {
        let conn = self.conn.lock().await;
        let height: Option<i64> = conn
            .query_row(
                "SELECT height FROM tx_index WHERE tx_hash = ?1",
                [tx_hash.0.as_slice()],
                |row| row.get(0),
            )
            .optional()?;
        Ok(height.map(|h| h as u64))
    }

    /// Owning address and amount of a specific output, resolved in O(1) via
    /// `output_index`. Returns `None` if the output was never indexed
    /// (e.g. belongs to a block stored before the index existed — see
    /// `backfill_tx_index`).
    pub async fn get_output_owner(
        &self,
        tx_hash: &Hash,
        output_index: u32,
    ) -> Result<Option<(String, u128)>, StorageError> {
        let conn = self.conn.lock().await;
        let row: Option<(String, String)> = conn
            .query_row(
                "SELECT address, amount FROM output_index
                 WHERE tx_hash = ?1 AND output_index = ?2",
                params![tx_hash.0.as_slice(), output_index as i64],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        Ok(row.and_then(|(addr, amt)| amt.parse::<u128>().ok().map(|a| (addr, a))))
    }

    /// Paginated transaction history for a native V31 UTXO address, newest
    /// first. Returns `(tx_hash, height, direction)` tuples plus the total
    /// number of matching rows (for pagination).
    pub async fn get_address_tx_history(
        &self,
        address: &str,
        limit: usize,
        offset: usize,
    ) -> Result<(Vec<(Hash, u64, String)>, usize), StorageError> {
        let conn = self.conn.lock().await;
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM address_tx_index WHERE address = ?1",
            [address],
            |row| row.get(0),
        )?;

        let mut stmt = conn.prepare(
            "SELECT tx_hash, height, direction FROM address_tx_index
             WHERE address = ?1
             ORDER BY height DESC
             LIMIT ?2 OFFSET ?3",
        )?;
        let rows = stmt.query_map(params![address, limit as i64, offset as i64], |row| {
            let hash_bytes: Vec<u8> = row.get(0)?;
            let height: i64 = row.get(1)?;
            let direction: String = row.get(2)?;
            Ok((hash_bytes, height as u64, direction))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (hash_bytes, height, direction) = row?;
            out.push((bytes_to_hash(&hash_bytes)?, height, direction));
        }
        Ok((out, total.max(0) as usize))
    }

    /// True if the tx/address indexes have never been populated (e.g. a
    /// pre-existing database predating this feature). Used to decide whether
    /// a one-time backfill is needed at startup.
    pub async fn tx_index_is_empty(&self) -> Result<bool, StorageError> {
        let conn = self.conn.lock().await;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM tx_index", [], |row| row.get(0))?;
        Ok(count == 0)
    }

    /// Rebuild `tx_index`, `output_index`, and `address_tx_index` from the
    /// full stored block range. Safe to call on every startup: all inserts
    /// are idempotent (`INSERT OR REPLACE` / `INSERT OR IGNORE`), and callers
    /// should gate the (potentially expensive) full scan on
    /// `tx_index_is_empty()` to avoid redoing it once the index is warm.
    pub async fn backfill_tx_index(&self) -> Result<u64, StorageError> {
        let tip_height = self.height().await?;
        let mut indexed = 0u64;
        for h in 0..=tip_height {
            let block = {
                let conn = self.conn.lock().await;
                let hash: Option<Vec<u8>> = conn
                    .query_row(
                        "SELECT hash FROM blocks WHERE height = ?1",
                        [h as i64],
                        |row| row.get(0),
                    )
                    .optional()?;
                match hash {
                    Some(hb) => self.get_by_hash_internal(&bytes_to_hash(&hb)?, &conn)?,
                    None => None,
                }
            };
            if let Some(block) = block {
                let conn = self.conn.lock().await;
                self.index_block_transactions(&conn, &block)?;
                indexed += 1;
            }
        }
        Ok(indexed)
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
        self.index_block_transactions(&conn, block)?;
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

    /// Build a simple block spending `genesis`'s first output to two new
    /// addresses, for exercising the tx/address index.
    fn build_spend_block(genesis: &Block) -> (Block, Hash) {
        use crate::transaction::{Transaction, TransactionInput, TransactionOutput};
        use zion_l1_types::{Address, Amount, ChainId};

        let genesis_tx = &genesis.transactions[0];
        let genesis_tx_hash = genesis_tx.hash();

        let addr = |s: &str| Address::new(ChainId::ZionL1, vec![], s).unwrap();
        let spend_tx = Transaction::new(
            1,
            vec![TransactionInput {
                previous_output: genesis_tx_hash,
                index: 0,
                script: vec![0u8; 96],
            }],
            vec![
                TransactionOutput {
                    amount: Amount::new(1_000_000_000_000),
                    address: addr("zion1recipientaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                    ..Default::default()
                },
                TransactionOutput {
                    amount: Amount::new(500_000_000_000),
                    address: addr("zion1changeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                    ..Default::default()
                },
            ],
            vec![],
        );
        let spend_tx_hash = spend_tx.hash();

        let header = BlockHeader {
            previous_hash: genesis.header.header_hash(),
            merkle_root: Hash::default(),
            height: 1,
            timestamp: genesis.header.timestamp + 60,
            nonce: 0,
            difficulty: genesis.header.difficulty,
        };
        (Block::new(header, vec![spend_tx]), spend_tx_hash)
    }

    #[tokio::test]
    async fn put_indexes_tx_and_address_history() {
        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        let genesis_tx_hash = genesis.transactions[0].hash();
        storage.put(&genesis).await.unwrap();

        let (block1, spend_tx_hash) = build_spend_block(&genesis);
        storage.put(&block1).await.unwrap();

        // O(1) tx height lookup.
        assert_eq!(
            storage.find_tx_height(&spend_tx_hash).await.unwrap(),
            Some(1)
        );
        assert_eq!(
            storage.find_tx_height(&genesis_tx_hash).await.unwrap(),
            Some(0)
        );

        // Output ownership resolution (used to enrich tx inputs server-side).
        let (owner, amount) = storage
            .get_output_owner(&genesis_tx_hash, 0)
            .await
            .unwrap()
            .expect("genesis output 0 must be indexed");
        assert_eq!(owner, "zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5");
        assert_eq!(amount, 1650000000_u128 * 1_000_000);

        // Sender-side history: the spent genesis address should show an 'out'
        // entry for the spend transaction alongside its original 'in' entry.
        let (rows, total) = storage
            .get_address_tx_history("zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5", 10, 0)
            .await
            .unwrap();
        assert_eq!(total, 2);
        assert!(rows
            .iter()
            .any(|(h, height, dir)| *h == genesis_tx_hash && *height == 0 && dir == "in"));
        assert!(rows
            .iter()
            .any(|(h, height, dir)| *h == spend_tx_hash && *height == 1 && dir == "out"));

        // Receiver-side history: the new recipient address should show an
        // 'in' entry at height 1.
        let (rows, total) = storage
            .get_address_tx_history("zion1recipientaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 10, 0)
            .await
            .unwrap();
        assert_eq!(total, 1);
        assert_eq!(rows[0], (spend_tx_hash, 1, "in".to_string()));
    }

    #[tokio::test]
    async fn address_tx_history_dedupes_self_transfers() {
        use crate::transaction::{Transaction, TransactionInput, TransactionOutput};
        use zion_l1_types::{Address, Amount, ChainId};

        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        let genesis_tx_hash = genesis.transactions[0].hash();
        storage.put(&genesis).await.unwrap();

        // A "self-transfer" transaction: the same address both spends an
        // input (sender) and receives a change output (receiver). Before
        // the fix, this produced two rows (one 'in', one 'out') for the same
        // (address, tx_hash) pair, double-counting the tx in history totals.
        let sender = "zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5";
        let addr = |s: &str| Address::new(ChainId::ZionL1, vec![], s).unwrap();
        let self_tx = Transaction::new(
            1,
            vec![TransactionInput {
                previous_output: genesis_tx_hash,
                index: 0,
                script: vec![0u8; 96],
            }],
            vec![
                TransactionOutput {
                    amount: Amount::new(1_000_000_000_000),
                    address: addr("zion1otherrecipientbbbbbbbbbbbbbbbbbbbbbbbbb"),
                    ..Default::default()
                },
                TransactionOutput {
                    amount: Amount::new(649_000_000_000_000),
                    address: addr(sender), // change back to the sender
                    ..Default::default()
                },
            ],
            vec![],
        );
        let self_tx_hash = self_tx.hash();
        let header = BlockHeader {
            previous_hash: genesis.header.header_hash(),
            merkle_root: Hash::default(),
            height: 1,
            timestamp: genesis.header.timestamp + 60,
            nonce: 0,
            difficulty: genesis.header.difficulty,
        };
        storage
            .put(&Block::new(header, vec![self_tx]))
            .await
            .unwrap();

        let (rows, total) = storage.get_address_tx_history(sender, 10, 0).await.unwrap();
        // Exactly 2 distinct transactions touch `sender`: the genesis receipt
        // and the self-transfer — NOT 3 (which would happen if the
        // self-transfer's 'in' and 'out' legs were counted separately).
        assert_eq!(total, 2, "self-transfer must not be double-counted");
        assert_eq!(rows.iter().filter(|(h, ..)| *h == self_tx_hash).count(), 1);
    }

    #[tokio::test]
    async fn backfill_tx_index_rebuilds_from_scratch() {
        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();
        let (block1, spend_tx_hash) = build_spend_block(&genesis);
        storage.put(&block1).await.unwrap();

        // Simulate a pre-existing database that predates the index feature.
        {
            let conn = storage.conn.lock().await;
            conn.execute("DELETE FROM tx_index", []).unwrap();
            conn.execute("DELETE FROM output_index", []).unwrap();
            conn.execute("DELETE FROM address_tx_index", []).unwrap();
        }
        assert!(storage.tx_index_is_empty().await.unwrap());
        assert!(storage
            .find_tx_height(&spend_tx_hash)
            .await
            .unwrap()
            .is_none());

        let indexed = storage.backfill_tx_index().await.unwrap();
        assert_eq!(indexed, 2);
        assert!(!storage.tx_index_is_empty().await.unwrap());
        assert_eq!(
            storage.find_tx_height(&spend_tx_hash).await.unwrap(),
            Some(1)
        );

        let (rows, total) = storage
            .get_address_tx_history("zion1recipientaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 10, 0)
            .await
            .unwrap();
        assert_eq!(total, 1);
        assert_eq!(rows[0], (spend_tx_hash, 1, "in".to_string()));
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
