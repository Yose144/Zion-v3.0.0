use rusqlite::Connection;

use crate::error::MultichainError;
use crate::error::MultichainResult;
use crate::swap::htlc::{HtlcRecord, SwapState};

/// SQLite connection manager for `zion-multichain`.
pub struct Db {
    conn: Connection,
}

impl Db {
    /// Open or create the SQLite database at `path`.
    pub fn open(path: impl AsRef<std::path::Path>) -> MultichainResult<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Open an in-memory database (useful for tests).
    pub fn open_in_memory() -> MultichainResult<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> MultichainResult<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS transfers (
                id TEXT PRIMARY KEY,
                direction TEXT NOT NULL,
                source_address TEXT NOT NULL,
                source_asset TEXT NOT NULL,
                source_amount TEXT NOT NULL,
                target_address TEXT NOT NULL,
                target_asset TEXT NOT NULL,
                target_amount TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS credits (
                address TEXT PRIMARY KEY,
                balance TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS htlc_records (
                hash_hex TEXT PRIMARY KEY,
                locker_address TEXT NOT NULL,
                amount INTEGER NOT NULL,
                lock_tx_id TEXT NOT NULL,
                lock_block_height INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                counterparty_chain TEXT NOT NULL,
                counterparty_addr TEXT NOT NULL,
                claimant_address TEXT,
                state TEXT NOT NULL,
                release_tx_id TEXT,
                release_recipient TEXT,
                preimage_hex TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                data_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_htlc_state ON htlc_records(state);
            "#,
        )?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // HTLC persistence
    // ------------------------------------------------------------------------

    /// Persist an HTLC record (insert or replace).
    pub fn save_htlc(&self, record: &HtlcRecord) -> MultichainResult<()> {
        let data_json = serde_json::to_string(record)
            .map_err(|e| MultichainError::Internal(format!("serialize HTLC record: {e}")))?;
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO htlc_records
            (hash_hex, locker_address, amount, lock_tx_id, lock_block_height,
             expires_at, counterparty_chain, counterparty_addr, claimant_address,
             state, release_tx_id, release_recipient, preimage_hex,
             created_at, updated_at, data_json)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            "#,
            rusqlite::params![
                record.hash_hex,
                record.locker_address,
                record.amount as i64,
                record.lock_tx_id,
                record.lock_block_height as i64,
                record.expires_at,
                record.counterparty_chain,
                record.counterparty_addr,
                record.claimant_address,
                record.state.to_string(),
                record.release_tx_id,
                record.release_recipient,
                record.preimage_hex,
                record.created_at.to_rfc3339(),
                record.updated_at.to_rfc3339(),
                data_json,
            ],
        )?;
        Ok(())
    }

    /// Load a single HTLC record by hash_hex.
    pub fn load_htlc(&self, hash_hex: &str) -> MultichainResult<Option<HtlcRecord>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM htlc_records WHERE hash_hex = ?1")?;
        let mut rows = stmt.query(rusqlite::params![hash_hex])?;
        if let Some(row) = rows.next()? {
            let json: String = row.get(0)?;
            let record: HtlcRecord = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize HTLC record: {e}")))?;
            Ok(Some(record))
        } else {
            Ok(None)
        }
    }

    /// List all HTLC records, newest first.
    pub fn list_htlc(&self) -> MultichainResult<Vec<HtlcRecord>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM htlc_records ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let record: HtlcRecord = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize HTLC record: {e}")))?;
            out.push(record);
        }
        Ok(out)
    }

    /// List HTLC records filtered by state.
    pub fn list_htlc_by_state(&self, state: SwapState) -> MultichainResult<Vec<HtlcRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT data_json FROM htlc_records WHERE state = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![state.to_string()], |row| {
            row.get::<_, String>(0)
        })?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let record: HtlcRecord = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize HTLC record: {e}")))?;
            out.push(record);
        }
        Ok(out)
    }

    /// Delete HTLC records in terminal states older than `days` days.
    pub fn purge_old_htlc(&self, days: u32) -> MultichainResult<usize> {
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let n = self.conn.execute(
            "DELETE FROM htlc_records WHERE state IN ('claimed','refunded') AND updated_at < ?1",
            rusqlite::params![cutoff.to_rfc3339()],
        )?;
        Ok(n)
    }
}
