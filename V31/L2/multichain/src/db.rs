use rusqlite::Connection;

use crate::error::MultichainError;
use crate::error::MultichainResult;
use crate::swap::dex::intent::{SolverBid, SwapIntent};
use crate::swap::dex::Pool;
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

            CREATE TABLE IF NOT EXISTS pools (
                pool_id TEXT PRIMARY KEY,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS intents (
                intent_id TEXT PRIMARY KEY,
                data_json TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bids (
                intent_id TEXT NOT NULL,
                solver TEXT NOT NULL,
                data_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (intent_id, solver)
            );

            CREATE TABLE IF NOT EXISTS solvers (
                solver TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );
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

    // ------------------------------------------------------------------------
    // Intent persistence
    // ------------------------------------------------------------------------

    /// Persist an intent (insert or replace).
    pub fn save_intent(&self, intent: &SwapIntent) -> MultichainResult<()> {
        let data_json = serde_json::to_string(intent)
            .map_err(|e| MultichainError::Internal(format!("serialize intent: {e}")))?;
        let updated_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO intents
            (intent_id, data_json, status, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            rusqlite::params![
                intent.id.to_string(),
                data_json,
                intent.status.to_string(),
                updated_at,
            ],
        )?;
        Ok(())
    }

    /// Load all persisted intents.
    pub fn load_intents(&self) -> MultichainResult<Vec<SwapIntent>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM intents ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let intent: SwapIntent = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize intent: {e}")))?;
            out.push(intent);
        }
        Ok(out)
    }

    /// Persist a solver bid (insert or replace).
    pub fn save_bid(&self, bid: &SolverBid) -> MultichainResult<()> {
        let data_json = serde_json::to_string(bid)
            .map_err(|e| MultichainError::Internal(format!("serialize bid: {e}")))?;
        let created_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO bids
            (intent_id, solver, data_json, created_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            rusqlite::params![
                bid.intent_id.to_string(),
                bid.solver,
                data_json,
                created_at,
            ],
        )?;
        Ok(())
    }

    /// Load all persisted bids for an intent.
    pub fn load_bids_for_intent(&self, intent_id: &uuid::Uuid) -> MultichainResult<Vec<SolverBid>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM bids WHERE intent_id = ?1 ORDER BY created_at DESC")?;
        let rows =
            stmt.query_map(rusqlite::params![intent_id.to_string()], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let bid: SolverBid = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize bid: {e}")))?;
            out.push(bid);
        }
        Ok(out)
    }

    /// Persist a registered solver.
    pub fn save_solver(&self, solver: &str) -> MultichainResult<()> {
        let created_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR IGNORE INTO solvers
            (solver, created_at)
            VALUES (?1, ?2)
            "#,
            rusqlite::params![solver, created_at],
        )?;
        Ok(())
    }

    /// Load all registered solvers.
    pub fn load_solvers(&self) -> MultichainResult<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT solver FROM solvers ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    // ------------------------------------------------------------------------
    // AMM pool persistence
    // ------------------------------------------------------------------------

    /// Persist an AMM pool (insert or replace).
    pub fn save_pool(&self, pool: &Pool) -> MultichainResult<()> {
        let data_json = serde_json::to_string(pool)
            .map_err(|e| MultichainError::Internal(format!("serialize pool: {e}")))?;
        let created_at = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO pools
            (pool_id, data_json, created_at)
            VALUES (?1, ?2, ?3)
            "#,
            rusqlite::params![pool.id.to_string(), data_json, created_at],
        )?;
        Ok(())
    }

    /// Load all persisted AMM pools.
    pub fn load_pools(&self) -> MultichainResult<Vec<Pool>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data_json FROM pools ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            let json = r?;
            let pool: Pool = serde_json::from_str(&json)
                .map_err(|e| MultichainError::Internal(format!("deserialize pool: {e}")))?;
            out.push(pool);
        }
        Ok(out)
    }

    /// Delete an AMM pool by id.
    pub fn delete_pool(&self, pool_id: u64) -> MultichainResult<usize> {
        let n = self
            .conn
            .execute("DELETE FROM pools WHERE pool_id = ?1", rusqlite::params![pool_id.to_string()])?;
        Ok(n)
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

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::{Amount, Asset, AssetId, ChainId};

    fn test_asset(chain: ChainId, ticker: &str) -> Asset {
        Asset {
            id: AssetId::new(chain, ticker, None),
            decimals: 6,
            name: ticker.to_string(),
        }
    }

    #[test]
    fn pool_persists_and_reloads() {
        let db = Db::open_in_memory().unwrap();
        let zion = test_asset(ChainId::ZionL1, "ZION");
        let usdc = test_asset(ChainId::Base, "USDC");
        let pool = Pool {
            id: 1,
            asset_a: zion,
            asset_b: usdc,
            reserve_a: Amount::new(100_000_000),
            reserve_b: Amount::new(1_000_000_000),
            fee_bps: 30,
        };

        db.save_pool(&pool).unwrap();
        let loaded = db.load_pools().unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, 1);
        assert_eq!(loaded[0].reserve_a.0, 100_000_000);
        assert_eq!(loaded[0].fee_bps, 30);

        db.delete_pool(1).unwrap();
        assert!(db.load_pools().unwrap().is_empty());
    }

    #[test]
    fn intent_and_bid_persist_and_reload() {
        use crate::swap::dex::intent::{PathHop, SolverBid, SwapIntent};

        let db = Db::open_in_memory().unwrap();

        let zion = AssetId::new(ChainId::ZionL1, "ZION", None);
        let usdc = AssetId::new(ChainId::ZionL1, "USDC", None);

        let intent = SwapIntent::new(
            "user1",
            zion.clone(),
            usdc.clone(),
            Amount::new(1_000_000),
            Amount::new(900_000),
            u64::MAX,
            1,
        );
        db.save_intent(&intent).unwrap();

        let bid = SolverBid::new(
            intent.id,
            "solver-a",
            Amount::new(1_100_000),
            vec![PathHop {
                chain: "zion".into(),
                dex: "amm".into(),
                from_token: zion.clone(),
                to_token: usdc.clone(),
                is_bridge: false,
            }],
            10,
            0,
        );
        db.save_bid(&bid).unwrap();

        let loaded_intents = db.load_intents().unwrap();
        assert_eq!(loaded_intents.len(), 1);
        assert_eq!(loaded_intents[0].id, intent.id);

        let loaded_bids = db.load_bids_for_intent(&intent.id).unwrap();
        assert_eq!(loaded_bids.len(), 1);
        assert_eq!(loaded_bids[0].solver, "solver-a");
    }
}
