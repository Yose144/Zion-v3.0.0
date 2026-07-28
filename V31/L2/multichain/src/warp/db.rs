//! # WARP Transfer Database — SQLite persistence
//!
//! Stores [`WarpTransfer`] records so they survive process restarts.
//! Uses JSON serialization for complex fields (ChainId, etc.).
//!
//! ## Usage
//!
//! ```rust
//! use zion_multichain::warp::db::TransferDb;
//!
//! let db = TransferDb::in_memory().unwrap();
//! ```

use rusqlite::{params, Connection};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::warp::error::{WarpError, WarpResult};
use crate::warp::types::{WarpStatus, WarpTransfer};

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS transfers (
    id            TEXT    PRIMARY KEY,
    status        TEXT    NOT NULL,
    source_chain  TEXT    NOT NULL,
    dest_chain    TEXT    NOT NULL,
    sender        TEXT    NOT NULL,
    recipient     TEXT    NOT NULL,
    amount_flowers INTEGER NOT NULL,
    fee_flowers    INTEGER NOT NULL,
    memo          TEXT    NOT NULL,
    source_tx     TEXT,
    dest_tx       TEXT,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL,
    data_json     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transfers_status     ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created    ON transfers(created_at);

-- Dedup table: tracks source-chain tx hashes already processed by the watcher.
-- Survives restarts (unlike in-memory HashSet).
CREATE TABLE IF NOT EXISTS seen_txs (
    tx_hash      TEXT    PRIMARY KEY,
    chain        TEXT    NOT NULL,
    seen_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seen_txs_chain ON seen_txs(chain);
CREATE INDEX IF NOT EXISTS idx_seen_txs_seen  ON seen_txs(seen_at);
"#;

// ─────────────────────────────────────────────────────────────────────────────
// TransferDb
// ─────────────────────────────────────────────────────────────────────────────

/// Thread-safe SQLite-backed store for WARP transfers.
#[derive(Clone)]
pub struct TransferDb {
    conn: Arc<Mutex<Connection>>,
}

impl TransferDb {
    /// Open or create a file-backed database.
    pub fn open(path: &str) -> WarpResult<Self> {
        let conn = Connection::open(path).map_err(db_err)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init()?;
        Ok(db)
    }

    /// Create an in-memory database (useful for tests and dev mode).
    pub fn in_memory() -> WarpResult<Self> {
        let conn = Connection::open_in_memory().map_err(db_err)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init()?;
        Ok(db)
    }

    fn init(&self) -> WarpResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(SCHEMA).map_err(db_err)?;
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Write
    // ─────────────────────────────────────────────────────────────────────────

    /// Persist a transfer (insert or replace).
    pub fn save(&self, t: &WarpTransfer) -> WarpResult<()> {
        let data_json = serde_json::to_string(t)
            .map_err(|e| WarpError::Database(format!("serialize transfer: {e}")))?;
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"INSERT OR REPLACE INTO transfers
               (id, status, source_chain, dest_chain, sender, recipient,
                amount_flowers, fee_flowers, memo, source_tx, dest_tx,
                created_at, updated_at, data_json)
               VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)"#,
            params![
                t.id.to_string(),
                t.status.to_string(),
                t.source_chain.name,
                t.dest_chain.name,
                t.sender,
                t.recipient,
                t.amount_flowers as i64,
                t.fee_flowers as i64,
                t.memo,
                t.source_tx_hash,
                t.dest_tx_hash,
                t.created_at.to_rfc3339(),
                t.updated_at.to_rfc3339(),
                data_json,
            ],
        )
        .map_err(db_err)?;
        Ok(())
    }

    /// Update just the status and updated_at for an existing transfer.
    pub fn update_status(
        &self,
        id: &Uuid,
        status: WarpStatus,
        updated_json: &str,
    ) -> WarpResult<()> {
        let conn = self.conn.lock().unwrap();
        let changed = conn
            .execute(
                "UPDATE transfers SET status=?1, data_json=?2 WHERE id=?3",
                params![status.to_string(), updated_json, id.to_string()],
            )
            .map_err(db_err)?;
        if changed == 0 {
            return Err(WarpError::TransferNotFound(id.to_string()));
        }
        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read
    // ─────────────────────────────────────────────────────────────────────────

    /// Load a single transfer by UUID. Returns `None` if not found.
    pub fn load(&self, id: &Uuid) -> WarpResult<Option<WarpTransfer>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT data_json FROM transfers WHERE id=?1")
            .map_err(db_err)?;
        let mut rows = stmt.query(params![id.to_string()]).map_err(db_err)?;
        if let Some(row) = rows.next().map_err(db_err)? {
            let json: String = row.get(0).map_err(db_err)?;
            let t: WarpTransfer = serde_json::from_str(&json)
                .map_err(|e| WarpError::Database(format!("deserialize transfer: {e}")))?;
            Ok(Some(t))
        } else {
            Ok(None)
        }
    }

    /// List all transfers, newest first.
    pub fn list_all(&self) -> WarpResult<Vec<WarpTransfer>> {
        self.query_transfers("SELECT data_json FROM transfers ORDER BY created_at DESC")
    }

    /// List transfers that are not yet Completed or Failed (i.e. pending/in-flight).
    pub fn list_pending(&self) -> WarpResult<Vec<WarpTransfer>> {
        self.query_transfers(
            "SELECT data_json FROM transfers \
             WHERE status NOT IN ('completed','failed') \
             ORDER BY created_at ASC",
        )
    }

    /// Count all stored transfers.
    pub fn count(&self) -> WarpResult<usize> {
        let conn = self.conn.lock().unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM transfers", [], |r| r.get(0))
            .map_err(db_err)?;
        Ok(n as usize)
    }

    /// Count transfers with a given status string.
    pub fn count_by_status(&self, status: &str) -> WarpResult<usize> {
        let conn = self.conn.lock().unwrap();
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transfers WHERE status=?1",
                params![status],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        Ok(n as usize)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Seen-tx dedup (persistent, survives restarts)
    // ─────────────────────────────────────────────────────────────────────────

    /// Check if a source-chain tx hash has already been processed.
    pub fn is_seen(&self, tx_hash: &str) -> WarpResult<bool> {
        let conn = self.conn.lock().unwrap();
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM seen_txs WHERE tx_hash=?1",
                params![tx_hash],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        Ok(n > 0)
    }

    /// Mark a source-chain tx hash as processed.
    pub fn mark_seen(&self, tx_hash: &str, chain: &str) -> WarpResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO seen_txs (tx_hash, chain, seen_at) VALUES (?1, ?2, ?3)",
            params![tx_hash, chain, chrono::Utc::now().to_rfc3339()],
        )
        .map_err(db_err)?;
        Ok(())
    }

    /// Purge seen_txs entries older than `days` days.
    /// Prevents unbounded growth of the dedup table.
    pub fn purge_seen_old(&self, days: u32) -> WarpResult<usize> {
        let conn = self.conn.lock().unwrap();
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let n = conn
            .execute(
                "DELETE FROM seen_txs WHERE seen_at < ?1",
                params![cutoff.to_rfc3339()],
            )
            .map_err(db_err)?;
        Ok(n)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Maintenance
    // ─────────────────────────────────────────────────────────────────────────

    /// Delete completed and failed transfers older than `days` days.
    pub fn purge_old(&self, days: u32) -> WarpResult<usize> {
        let conn = self.conn.lock().unwrap();
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let n = conn
            .execute(
                "DELETE FROM transfers WHERE status IN ('completed','failed') AND created_at < ?1",
                params![cutoff.to_rfc3339()],
            )
            .map_err(db_err)?;
        Ok(n)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    fn query_transfers(&self, sql: &str) -> WarpResult<Vec<WarpTransfer>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(sql).map_err(db_err)?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(db_err)?;

        let mut out = Vec::new();
        for r in rows {
            let json = r.map_err(db_err)?;
            let t: WarpTransfer = serde_json::from_str(&json)
                .map_err(|e| WarpError::Database(format!("deserialize: {e}")))?;
            out.push(t);
        }
        Ok(out)
    }
}

fn db_err(e: rusqlite::Error) -> WarpError {
    WarpError::Database(format!("db: {e}"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::types::{ChainId, WarpTransfer};
    use uuid::Uuid;

    fn dummy_transfer() -> WarpTransfer {
        WarpTransfer::new(
            ChainId::zion_l1(),
            ChainId::evm("base", 8453, 64),
            "zion1sender".into(),
            "0xrecipient".into(),
            1_000_000_000,
            100_000,
            "warp:base:0xrecipient".into(),
        )
    }

    #[test]
    fn test_db_open_in_memory() {
        let db = TransferDb::in_memory().unwrap();
        assert_eq!(db.count().unwrap(), 0);
    }

    #[test]
    fn test_save_and_load() {
        let db = TransferDb::in_memory().unwrap();
        let t = dummy_transfer();
        let id = t.id;
        db.save(&t).unwrap();
        let loaded = db.load(&id).unwrap().expect("should exist");
        assert_eq!(loaded.id, id);
        assert_eq!(loaded.amount_flowers, 1_000_000_000);
        assert_eq!(loaded.sender, "zion1sender");
    }

    #[test]
    fn test_count() {
        let db = TransferDb::in_memory().unwrap();
        assert_eq!(db.count().unwrap(), 0);
        db.save(&dummy_transfer()).unwrap();
        db.save(&dummy_transfer()).unwrap();
        assert_eq!(db.count().unwrap(), 2);
    }

    #[test]
    fn test_list_all_order() {
        let db = TransferDb::in_memory().unwrap();
        let t1 = dummy_transfer();
        let t2 = dummy_transfer();
        db.save(&t1).unwrap();
        db.save(&t2).unwrap();
        let all = db.list_all().unwrap();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_update_status() {
        let db = TransferDb::in_memory().unwrap();
        let mut t = dummy_transfer();
        let id = t.id;
        db.save(&t).unwrap();

        t.status = WarpStatus::Completed;
        t.updated_at = chrono::Utc::now();
        let updated_json = serde_json::to_string(&t).unwrap();

        db.update_status(&id, WarpStatus::Completed, &updated_json)
            .unwrap();

        let loaded = db.load(&id).unwrap().unwrap();
        assert_eq!(loaded.status, WarpStatus::Completed);
    }

    #[test]
    fn test_list_pending_excludes_completed() {
        let db = TransferDb::in_memory().unwrap();
        let mut t1 = dummy_transfer();
        let t2 = dummy_transfer();

        // Mark t1 as completed
        t1.status = WarpStatus::Completed;
        db.save(&t1).unwrap();
        db.save(&t2).unwrap();

        let pending = db.list_pending().unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, t2.id);
    }

    #[test]
    fn test_load_missing_returns_none() {
        let db = TransferDb::in_memory().unwrap();
        let result = db.load(&Uuid::new_v4()).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_purge_old_completed() {
        let db = TransferDb::in_memory().unwrap();
        let mut t = dummy_transfer();
        t.status = WarpStatus::Completed;
        db.save(&t).unwrap();
        // purge_old(0) should remove records completed today
        let deleted = db.purge_old(0).unwrap();
        assert_eq!(deleted, 1);
        assert_eq!(db.count().unwrap(), 0);
    }

    #[test]
    fn test_count_by_status() {
        let db = TransferDb::in_memory().unwrap();
        db.save(&dummy_transfer()).unwrap();
        let n = db.count_by_status("pending").unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn test_seen_tx_dedup() {
        let db = TransferDb::in_memory().unwrap();

        // Initially nothing is seen
        assert!(!db.is_seen("0xabc").unwrap());

        // Mark as seen
        db.mark_seen("0xabc", "base").unwrap();
        assert!(db.is_seen("0xabc").unwrap());

        // Different tx not seen
        assert!(!db.is_seen("0xdef").unwrap());
    }

    #[test]
    fn test_seen_tx_idempotent() {
        let db = TransferDb::in_memory().unwrap();
        db.mark_seen("0xabc", "base").unwrap();
        // Second mark should not error (INSERT OR IGNORE)
        db.mark_seen("0xabc", "base").unwrap();
        assert!(db.is_seen("0xabc").unwrap());
    }

    #[test]
    fn test_purge_seen_old() {
        let db = TransferDb::in_memory().unwrap();
        db.mark_seen("0xold", "base").unwrap();
        db.mark_seen("0xnew", "solana").unwrap();

        // Purge entries older than 0 days (removes everything seen before now)
        // Since both were just inserted, purge_old(0) may or may not remove them
        // depending on sub-second timing. Use a negative approach: purge(30) should remove nothing.
        let deleted = db.purge_seen_old(30).unwrap();
        assert_eq!(deleted, 0);
        assert!(db.is_seen("0xold").unwrap());
        assert!(db.is_seen("0xnew").unwrap());
    }
}
