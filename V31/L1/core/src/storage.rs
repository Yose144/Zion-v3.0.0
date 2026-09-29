//! Persistent storage for the ZION L1 node.
//!
//! SQLite is used because it ships with zero external server setup, supports
//! full ACID semantics, and has a tiny resource footprint — all useful for an
//! Alpha deployment.

use std::path::Path;
use std::sync::Arc;

use rusqlite::types::Value;
use rusqlite::{params, Connection, OptionalExtension};
use tokio::sync::Mutex;
use tracing::warn;
use zion_l1_types::{Address, Hash};

use crate::block::{Block, BlockHeader};
use crate::difficulty::BlockInfo;
use crate::utxo::{Outpoint, UtxoOutput, UtxoSet};
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

        // ── Discardable native UTXO cache ────────────────────────────────
        // A snapshot of the in-memory `UtxoSet` taken at a known chain tip so
        // node startup can skip the full trusted-block replay. The cache is
        // derived data: any inconsistency with `chain_state` or malformed row
        // turns a load into a cache miss and the set is rebuilt from blocks.
        conn.execute(
            "CREATE TABLE IF NOT EXISTS native_utxo_cache (
                tx_hash BLOB NOT NULL,
                output_index INTEGER NOT NULL,
                amount TEXT NOT NULL,
                address_json TEXT NOT NULL,
                script BLOB NOT NULL,
                block_height INTEGER NOT NULL,
                block_timestamp INTEGER NOT NULL,
                is_coinbase INTEGER NOT NULL CHECK (is_coinbase IN (0,1)),
                PRIMARY KEY (tx_hash, output_index)
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS native_utxo_admin_unlocks (
                address TEXT PRIMARY KEY
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS native_utxo_cache_state (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                tip_hash BLOB NOT NULL,
                tip_height INTEGER NOT NULL,
                output_count INTEGER NOT NULL,
                admin_unlock_count INTEGER NOT NULL
            )",
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

    // ------------------------------------------------------------------
    // Discardable native UTXO cache
    // ------------------------------------------------------------------
    //
    // The cache mirrors the in-memory `UtxoSet` at a recorded chain tip. It is
    // never authoritative: any tip mismatch, count mismatch, or malformed row
    // is treated as a cache miss (`Ok(None)`) and the caller rebuilds the set
    // by replaying stored blocks. Only genuine SQLite I/O errors propagate.

    /// Load the cached native UTXO set if it exactly matches the current
    /// chain tip and passes row-level validation. Returns `None` on any
    /// staleness or corruption — this is a derived, discardable acceleration.
    pub async fn load_native_utxo_cache(&self) -> Result<Option<UtxoSet>, StorageError> {
        let conn = self.conn.lock().await;

        let chain_tip: Option<(Vec<u8>, i64)> = conn
            .query_row(
                "SELECT tip_hash, tip_height FROM chain_state WHERE singleton = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let Some((tip_hash, tip_height)) = chain_tip else {
            return Ok(None);
        };

        let state = conn
            .query_row(
                "SELECT tip_hash, tip_height, output_count, admin_unlock_count
                 FROM native_utxo_cache_state WHERE singleton = 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, Value>(0)?,
                        row.get::<_, Value>(1)?,
                        row.get::<_, Value>(2)?,
                        row.get::<_, Value>(3)?,
                    ))
                },
            )
            .optional()?;
        let (output_count, admin_count) = match state {
            Some((
                Value::Blob(hash),
                Value::Integer(height),
                Value::Integer(outputs),
                Value::Integer(admins),
            )) if hash == tip_hash
                && height == tip_height
                && height >= 0
                && outputs >= 0
                && admins >= 0 =>
            {
                (outputs, admins)
            }
            _ => return Ok(None),
        };

        let mut stmt = conn.prepare(
            "SELECT tx_hash, output_index, amount, address_json, script,
                    block_height, block_timestamp, is_coinbase
             FROM native_utxo_cache",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, Value>(0)?,
                row.get::<_, Value>(1)?,
                row.get::<_, Value>(2)?,
                row.get::<_, Value>(3)?,
                row.get::<_, Value>(4)?,
                row.get::<_, Value>(5)?,
                row.get::<_, Value>(6)?,
                row.get::<_, Value>(7)?,
            ))
        })?;
        let mut entries = Vec::new();
        for row in rows {
            match parse_utxo_cache_row(row?) {
                Some(entry) => entries.push(entry),
                None => return Ok(None),
            }
        }
        if entries.len() as i64 != output_count {
            return Ok(None);
        }

        let mut unlocks = Vec::new();
        let mut stmt = conn.prepare("SELECT address FROM native_utxo_admin_unlocks")?;
        let rows = stmt.query_map([], |row| row.get::<_, Value>(0))?;
        for row in rows {
            match row? {
                Value::Text(address) => unlocks.push(address),
                _ => return Ok(None),
            }
        }
        if unlocks.len() as i64 != admin_count {
            return Ok(None);
        }

        Ok(UtxoSet::from_cache_entries(entries, unlocks).ok())
    }

    /// Replace the entire cached UTXO snapshot with `set`, tagged with the
    /// current chain tip. Runs in one transaction so the cache is never
    /// persisted half-written.
    pub async fn replace_native_utxo_cache(&self, set: &UtxoSet) -> Result<(), StorageError> {
        let mut conn = self.conn.lock().await;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM native_utxo_cache", [])?;
        tx.execute("DELETE FROM native_utxo_admin_unlocks", [])?;
        tx.execute("DELETE FROM native_utxo_cache_state", [])?;

        // Without a chain tip there is nothing to pin the snapshot to; leave
        // the cache empty and let the rebuild rerun after genesis is stored.
        let chain_tip: Option<(Vec<u8>, i64)> = tx
            .query_row(
                "SELECT tip_hash, tip_height FROM chain_state WHERE singleton = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((tip_hash, tip_height)) = chain_tip {
            {
                let mut stmt = tx.prepare(
                    "INSERT INTO native_utxo_cache
                     (tx_hash, output_index, amount, address_json, script,
                      block_height, block_timestamp, is_coinbase)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                )?;
                for (outpoint, output) in set.cache_entries() {
                    let address_json = serde_json::to_string(&output.address)?;
                    stmt.execute(params![
                        outpoint.tx_hash.0.as_slice(),
                        outpoint.index as i64,
                        output.amount.0.to_string(),
                        address_json,
                        output.script.as_slice(),
                        output.block_height as i64,
                        output.block_timestamp as i64,
                        output.is_coinbase as i64,
                    ])?;
                }
            }
            let unlocks = set.admin_unlocks_for_cache();
            {
                let mut stmt = tx.prepare(
                    "INSERT OR IGNORE INTO native_utxo_admin_unlocks (address)
                     VALUES (?1)",
                )?;
                for address in &unlocks {
                    stmt.execute([address])?;
                }
            }
            tx.execute(
                "INSERT OR REPLACE INTO native_utxo_cache_state
                 (singleton, tip_hash, tip_height, output_count, admin_unlock_count)
                 VALUES (1, ?1, ?2, ?3, ?4)",
                params![
                    tip_hash,
                    tip_height,
                    set.output_count() as i64,
                    unlocks.len() as i64
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Incrementally apply `block` to the UTXO cache inside the same
    /// transaction that stores the block. The cache is only usable when its
    /// recorded tip is exactly this block's parent; any divergence or
    /// malformed row invalidates the cache state (block storage itself always
    /// proceeds — the cache is discarded and rebuilt on next startup).
    fn update_native_utxo_cache(
        &self,
        conn: &Connection,
        block: &Block,
        block_hash: &Hash,
    ) -> Result<(), StorageError> {
        let state = conn
            .query_row(
                "SELECT tip_hash, tip_height, output_count, admin_unlock_count
                 FROM native_utxo_cache_state WHERE singleton = 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, Value>(0)?,
                        row.get::<_, Value>(1)?,
                        row.get::<_, Value>(2)?,
                        row.get::<_, Value>(3)?,
                    ))
                },
            )
            .optional()?;

        let (mut output_count, mut admin_count) = match state {
            Some((
                Value::Blob(hash),
                Value::Integer(height),
                Value::Integer(outputs),
                Value::Integer(admins),
            )) if block.header.height > 0
                && hash.as_slice() == block.header.previous_hash.0.as_slice()
                && height >= 0
                && (height as u64) == block.header.height - 1
                && outputs >= 0
                && admins >= 0 =>
            {
                (outputs, admins)
            }
            _ => {
                conn.execute("DELETE FROM native_utxo_cache_state", [])?;
                return Ok(());
            }
        };

        let admins = crate::v3_compat::ADMIN_L1_ADDRESSES;
        let mut invalidate = false;
        'block: for tx in &block.transactions {
            if !tx.is_coinbase() {
                let mut spent_owners = Vec::with_capacity(tx.inputs.len());
                for input in &tx.inputs {
                    let owner: Option<Value> = conn
                        .query_row(
                            "SELECT address_json FROM native_utxo_cache
                             WHERE tx_hash = ?1 AND output_index = ?2",
                            params![input.previous_output.0.as_slice(), input.index as i64],
                            |row| row.get(0),
                        )
                        .optional()?;
                    let owner = owner.and_then(|v| match v {
                        Value::Text(s) => {
                            serde_json::from_str::<Address>(&s).ok().map(|a| a.encoded)
                        }
                        _ => None,
                    });
                    match owner {
                        Some(address) => spent_owners.push(address),
                        None => {
                            invalidate = true;
                            break 'block;
                        }
                    }
                    let deleted = conn.execute(
                        "DELETE FROM native_utxo_cache
                         WHERE tx_hash = ?1 AND output_index = ?2",
                        params![input.previous_output.0.as_slice(), input.index as i64],
                    )?;
                    if deleted != 1 {
                        invalidate = true;
                        break 'block;
                    }
                    match output_count.checked_sub(1) {
                        Some(n) => output_count = n,
                        None => {
                            invalidate = true;
                            break 'block;
                        }
                    }
                }
                if let Some(target) = crate::v3_compat::admin_unlock_target(
                    tx,
                    spent_owners.iter().map(String::as_str),
                    &admins,
                ) {
                    let inserted = conn.execute(
                        "INSERT OR IGNORE INTO native_utxo_admin_unlocks (address)
                         VALUES (?1)",
                        [target],
                    )?;
                    admin_count += inserted as i64;
                }
            }
            let is_coinbase = tx.is_coinbase() as i64;
            for (index, output) in tx.outputs.iter().enumerate() {
                let address_json = serde_json::to_string(&output.address)?;
                conn.execute(
                    "INSERT OR REPLACE INTO native_utxo_cache
                     (tx_hash, output_index, amount, address_json, script,
                      block_height, block_timestamp, is_coinbase)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        tx.hash().0.as_slice(),
                        index as i64,
                        output.amount.0.to_string(),
                        address_json,
                        output.script.as_slice(),
                        block.header.height as i64,
                        block.header.timestamp as i64,
                        is_coinbase,
                    ],
                )?;
                output_count += 1;
            }
        }

        if invalidate {
            // A spent input was missing or unreadable in the cache: the rows
            // can no longer be trusted, so drop the state marker (the stale
            // rows are ignored until the next full rebuild). The block itself
            // is still committed normally by the caller.
            conn.execute("DELETE FROM native_utxo_cache_state", [])?;
            warn!("native UTXO cache diverged on block apply; invalidated until rebuild");
            return Ok(());
        }

        conn.execute(
            "INSERT OR REPLACE INTO native_utxo_cache_state
             (singleton, tip_hash, tip_height, output_count, admin_unlock_count)
             VALUES (1, ?1, ?2, ?3, ?4)",
            params![
                block_hash.0.as_slice(),
                block.header.height as i64,
                output_count,
                admin_count
            ],
        )?;
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

    /// Store a block, update the chain tip, populate the tx/address indexes,
    /// and advance the UTXO cache — all in one SQLite transaction.
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

        let mut conn = self.conn.lock().await;
        let tx = conn.transaction()?;
        tx.execute(
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
        tx.execute(
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
        self.index_block_transactions(&tx, block)?;
        self.update_native_utxo_cache(&tx, block, &hash)?;
        tx.commit()?;
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

/// Parse one `native_utxo_cache` row into a `(Outpoint, UtxoOutput)` pair.
/// `None` marks the row malformed; the caller treats it as a cache miss.
fn parse_utxo_cache_row(
    row: (Value, Value, Value, Value, Value, Value, Value, Value),
) -> Option<(Outpoint, UtxoOutput)> {
    let (
        Value::Blob(tx_hash),
        Value::Integer(output_index),
        Value::Text(amount),
        Value::Text(address_json),
        Value::Blob(script),
        Value::Integer(block_height),
        Value::Integer(block_timestamp),
        Value::Integer(is_coinbase),
    ) = row
    else {
        return None;
    };
    let tx_hash: [u8; 32] = tx_hash.as_slice().try_into().ok()?;
    let output_index = u32::try_from(output_index).ok()?;
    let amount = amount.parse::<u128>().ok()?;
    let address: Address = serde_json::from_str(&address_json).ok()?;
    let block_height = u64::try_from(block_height).ok()?;
    let block_timestamp = u64::try_from(block_timestamp).ok()?;
    let is_coinbase = match is_coinbase {
        0 => false,
        1 => true,
        _ => return None,
    };
    Some((
        Outpoint::new(Hash::new(tx_hash), output_index),
        UtxoOutput {
            amount: zion_l1_types::Amount::new(amount),
            address,
            script,
            block_height,
            block_timestamp,
            is_coinbase,
        },
    ))
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

    // ── Native UTXO cache tests ─────────────────────────────────────────

    fn sorted_cache_entries(set: &UtxoSet) -> Vec<(Outpoint, UtxoOutput)> {
        let mut entries: Vec<_> = set.cache_entries().map(|(o, u)| (*o, u.clone())).collect();
        entries.sort_by(|a, b| {
            a.0.tx_hash
                .0
                .cmp(&b.0.tx_hash.0)
                .then(a.0.index.cmp(&b.0.index))
        });
        entries
    }

    fn coinbase_block(prev: &Block, height: u64, payouts: Vec<(String, u64)>) -> Block {
        use crate::transaction::{Transaction, TransactionOutput};
        use zion_l1_types::{Address, Amount, ChainId};
        let outputs = payouts
            .into_iter()
            .map(|(address, amount)| TransactionOutput {
                amount: Amount::new(amount as u128),
                address: Address::new(ChainId::ZionL1, vec![], address).unwrap(),
                ..Default::default()
            })
            .collect();
        let header = BlockHeader {
            previous_hash: prev.header.header_hash(),
            merkle_root: Hash::default(),
            height,
            timestamp: prev.header.timestamp + 60,
            nonce: 0,
            difficulty: prev.header.difficulty,
        };
        Block::new(
            header,
            vec![Transaction {
                version: 1,
                inputs: vec![],
                outputs,
                memo: vec![],
            }],
        )
    }

    /// Like `build_spend_block`, but pays to checksummed addresses so the
    /// transaction is also structurally valid for trusted UTXO replay (the
    /// input signature is still a dummy).
    fn build_valid_spend_block(genesis: &Block) -> Block {
        use crate::crypto::derive_keyless_address;
        use crate::transaction::{Transaction, TransactionInput, TransactionOutput};
        use zion_l1_types::{Address, Amount, ChainId};

        let genesis_tx_hash = genesis.transactions[0].hash();
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
                    address: addr(&derive_keyless_address("cache-test-recipient")),
                    ..Default::default()
                },
                TransactionOutput {
                    amount: Amount::new(500_000_000_000),
                    address: addr(&derive_keyless_address("cache-test-change")),
                    ..Default::default()
                },
            ],
            vec![],
        );
        let header = BlockHeader {
            previous_hash: genesis.header.header_hash(),
            merkle_root: Hash::default(),
            height: 1,
            timestamp: genesis.header.timestamp + 60,
            nonce: 0,
            difficulty: genesis.header.difficulty,
        };
        Block::new(header, vec![spend_tx])
    }

    #[tokio::test]
    async fn native_utxo_cache_round_trip() {
        use zion_l1_types::{Address, Amount, ChainId};

        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();

        let addr = |s: &str| Address::new(ChainId::ZionL1, vec![], s).unwrap();
        let htlc_script =
            crate::v31_wallet::htlc_output_script(&[1u8; 32], 1000, &[2u8; 32], &[3u8; 32]);
        let out1 = (
            Outpoint::new(Hash::new([0x11; 32]), 0),
            UtxoOutput {
                amount: Amount::new(42_000_000),
                address: addr("zion1cachetest1aaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                script: vec![],
                block_height: 0,
                block_timestamp: 1_234,
                is_coinbase: true,
            },
        );
        let out2 = (
            Outpoint::new(Hash::new([0x22; 32]), 3),
            UtxoOutput {
                amount: Amount::new(5),
                address: addr("zion1cachetest2bbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
                script: htlc_script,
                block_height: 7,
                block_timestamp: 777,
                is_coinbase: false,
            },
        );
        let unlock = "zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5".to_string();
        let set =
            UtxoSet::from_cache_entries(vec![out1.clone(), out2.clone()], vec![unlock.clone()])
                .unwrap();

        storage.replace_native_utxo_cache(&set).await.unwrap();
        let loaded = storage
            .load_native_utxo_cache()
            .await
            .unwrap()
            .expect("cache at matching tip must load");

        assert_eq!(loaded.output_count(), 2);
        let mut expected = vec![out1, out2];
        expected.sort_by(|a, b| {
            a.0.tx_hash
                .0
                .cmp(&b.0.tx_hash.0)
                .then(a.0.index.cmp(&b.0.index))
        });
        assert_eq!(sorted_cache_entries(&loaded), expected);
        assert!(loaded.is_admin_unlocked(&unlock));
        assert_eq!(loaded.admin_unlocks_for_cache(), vec![unlock]);
    }

    #[tokio::test]
    async fn native_utxo_cache_stale_tip_is_miss() {
        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();

        let mut set = UtxoSet::new();
        set.apply_block_unchecked(&genesis).unwrap();
        storage.replace_native_utxo_cache(&set).await.unwrap();
        assert!(storage.load_native_utxo_cache().await.unwrap().is_some());

        {
            let conn = storage.conn.lock().await;
            conn.execute(
                "UPDATE native_utxo_cache_state SET tip_height = tip_height + 1",
                [],
            )
            .unwrap();
        }
        assert!(storage.load_native_utxo_cache().await.unwrap().is_none());

        storage.replace_native_utxo_cache(&set).await.unwrap();
        {
            let conn = storage.conn.lock().await;
            conn.execute("UPDATE native_utxo_cache_state SET tip_hash = X'00'", [])
                .unwrap();
        }
        assert!(storage.load_native_utxo_cache().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn native_utxo_cache_corruption_is_miss() {
        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();

        let mut set = UtxoSet::new();
        set.apply_block_unchecked(&genesis).unwrap();
        let genesis_tx_hash = genesis.transactions[0].hash();

        // Row count mismatch: a missing output row while the recorded count
        // still expects it.
        storage.replace_native_utxo_cache(&set).await.unwrap();
        {
            let conn = storage.conn.lock().await;
            conn.execute(
                "DELETE FROM native_utxo_cache WHERE tx_hash = ?1 AND output_index = 0",
                [genesis_tx_hash.0.as_slice()],
            )
            .unwrap();
        }
        assert!(storage.load_native_utxo_cache().await.unwrap().is_none());

        // Malformed amount string.
        storage.replace_native_utxo_cache(&set).await.unwrap();
        {
            let conn = storage.conn.lock().await;
            conn.execute(
                "UPDATE native_utxo_cache SET amount = 'not-a-number'
                 WHERE tx_hash = ?1 AND output_index = 0",
                [genesis_tx_hash.0.as_slice()],
            )
            .unwrap();
        }
        assert!(storage.load_native_utxo_cache().await.unwrap().is_none());

        // Truncated tx hash.
        storage.replace_native_utxo_cache(&set).await.unwrap();
        {
            let conn = storage.conn.lock().await;
            conn.execute(
                "UPDATE native_utxo_cache SET tx_hash = X'0102'
                 WHERE tx_hash = ?1 AND output_index = 0",
                [genesis_tx_hash.0.as_slice()],
            )
            .unwrap();
        }
        assert!(storage.load_native_utxo_cache().await.unwrap().is_none());

        // Malformed address JSON.
        storage.replace_native_utxo_cache(&set).await.unwrap();
        {
            let conn = storage.conn.lock().await;
            conn.execute(
                "UPDATE native_utxo_cache SET address_json = '{bad'
                 WHERE tx_hash = ?1 AND output_index = 0",
                [genesis_tx_hash.0.as_slice()],
            )
            .unwrap();
        }
        assert!(storage.load_native_utxo_cache().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn put_advances_utxo_cache_incrementally() {
        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();

        let mut set = UtxoSet::new();
        set.apply_block_unchecked(&genesis).unwrap();
        storage.replace_native_utxo_cache(&set).await.unwrap();

        let block1 = build_valid_spend_block(&genesis);
        storage.put(&block1).await.unwrap();

        let mut expected = UtxoSet::new();
        expected.apply_block_unchecked(&genesis).unwrap();
        expected.apply_block_unchecked(&block1).unwrap();

        let loaded = storage
            .load_native_utxo_cache()
            .await
            .unwrap()
            .expect("delta-updated cache must load at the new tip");
        assert_eq!(
            sorted_cache_entries(&loaded),
            sorted_cache_entries(&expected)
        );
    }

    #[tokio::test]
    async fn put_missing_cached_input_invalidates_cache() {
        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();

        let mut set = UtxoSet::new();
        set.apply_block_unchecked(&genesis).unwrap();
        storage.replace_native_utxo_cache(&set).await.unwrap();

        // Drop the cache row for the output block1 spends — the delta cannot
        // apply, so the cache is invalidated while the block still commits.
        let genesis_tx_hash = genesis.transactions[0].hash();
        {
            let conn = storage.conn.lock().await;
            conn.execute(
                "DELETE FROM native_utxo_cache WHERE tx_hash = ?1 AND output_index = 0",
                [genesis_tx_hash.0.as_slice()],
            )
            .unwrap();
        }

        let block1 = build_valid_spend_block(&genesis);
        storage.put(&block1).await.unwrap();

        assert!(storage.get_by_height(1).await.unwrap().is_some());
        let (tip_header, _) = storage.tip().await.unwrap().unwrap();
        assert_eq!(tip_header.height, 1);
        assert!(storage.load_native_utxo_cache().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn put_delta_records_admin_unlock() {
        use crate::transaction::{Transaction, TransactionInput, TransactionOutput};
        use zion_l1_types::{Address, Amount, ChainId};

        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();

        let mut set = UtxoSet::new();
        set.apply_block_unchecked(&genesis).unwrap();
        storage.replace_native_utxo_cache(&set).await.unwrap();

        // Block 1 funds each canonical admin address via a coinbase.
        let admins = crate::v3_compat::ADMIN_L1_ADDRESSES;
        let block1 = coinbase_block(
            &genesis,
            1,
            admins.iter().map(|a| (a.to_string(), 1_000_000)).collect(),
        );
        storage.put(&block1).await.unwrap();

        // Block 2 spends one output per admin with the unlock memo.
        let unlock_tx_hash = block1.transactions[0].hash();
        let inputs = (0..admins.len())
            .map(|i| TransactionInput {
                previous_output: unlock_tx_hash,
                index: i as u32,
                script: vec![0u8; 96],
            })
            .collect();
        let spend = Transaction {
            version: 1,
            inputs,
            outputs: vec![TransactionOutput {
                amount: Amount::new(1_000),
                address: Address::new(ChainId::ZionL1, vec![], admins[0]).unwrap(),
                ..Default::default()
            }],
            memo: format!(
                "{}{}:test-ref",
                crate::v3_compat::ADMIN_UNLOCK_MEMO_PREFIX,
                "zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5"
            )
            .into_bytes(),
        };
        let block2 = Block::new(
            BlockHeader {
                previous_hash: block1.header.header_hash(),
                merkle_root: Hash::default(),
                height: 2,
                timestamp: block1.header.timestamp + 60,
                nonce: 0,
                difficulty: block1.header.difficulty,
            },
            vec![spend],
        );
        storage.put(&block2).await.unwrap();

        let loaded = storage
            .load_native_utxo_cache()
            .await
            .unwrap()
            .expect("cache must still be valid after the delta");
        assert!(loaded.is_admin_unlocked("zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5"));
    }

    #[tokio::test]
    async fn put_rolls_back_all_writes_on_index_failure() {
        let storage = Storage::open_in_memory().await.unwrap();
        let genesis = genesis::genesis_block();
        storage.put(&genesis).await.unwrap();

        let mut set = UtxoSet::new();
        set.apply_block_unchecked(&genesis).unwrap();
        storage.replace_native_utxo_cache(&set).await.unwrap();

        // Deterministic failure seam: a trigger that aborts every tx_index
        // insert, fired inside `put`'s transaction.
        {
            let conn = storage.conn.lock().await;
            conn.execute(
                "CREATE TRIGGER fail_tx_index BEFORE INSERT ON tx_index
                 BEGIN SELECT RAISE(ABORT, 'boom'); END",
                [],
            )
            .unwrap();
        }

        let (block1, _) = build_spend_block(&genesis);
        assert!(storage.put(&block1).await.is_err());

        // Nothing advanced: no block row, tip unchanged, cache state intact.
        assert!(storage.get_by_height(1).await.unwrap().is_none());
        let (tip_header, _) = storage.tip().await.unwrap().unwrap();
        assert_eq!(tip_header.height, 0);
        let loaded = storage
            .load_native_utxo_cache()
            .await
            .unwrap()
            .expect("cache state must be unchanged after rollback");
        assert_eq!(sorted_cache_entries(&loaded), sorted_cache_entries(&set));

        {
            let conn = storage.conn.lock().await;
            conn.execute("DROP TRIGGER fail_tx_index", []).unwrap();
        }
        storage.put(&block1).await.unwrap();
        let (tip_header, _) = storage.tip().await.unwrap().unwrap();
        assert_eq!(tip_header.height, 1);
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
