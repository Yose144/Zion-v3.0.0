//! F4: Database backend for the ZION pool.
//!
//! SQLite-backed persistent store for shares, payouts, blocks, and miner
//! stats.  Uses `rusqlite` (sync) because the session handler runs on
//! `tokio::task::spawn_blocking` (sync context).  The in-memory PPLNS
//! window stays authoritative for share accounting; the DB is a
//! write-through persistence layer + query interface for historical data.
//!
//! Schema is versioned via the `schema_version` pragma user_version.
//! Migrations run automatically on `ShareStore::open()`.

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tracing::{debug, info};

/// Current schema version.  Increment when adding migrations.
const SCHEMA_VERSION: u32 = 1;

/// A thread-safe wrapper around a SQLite connection.  SQLite with
/// `serialized` mode (default for `bundled`) supports multi-thread access,
/// but we use a `Mutex` to avoid contention on the connection handle.
pub struct ShareStore {
    conn: Mutex<Connection>,
}

/// A share record for insertion.
#[derive(Debug, Clone)]
pub struct ShareRecord {
    pub miner_id: String,
    pub worker_name: String,
    pub job_id: u64,
    pub nonce: u64,
    pub hash_hex: String,
    pub height: u64,
    pub accepted: bool,
    pub share_difficulty: u64,
    pub network_difficulty: u64,
    pub is_block: bool,
    pub source: String,
}

/// A payout record for insertion.
#[derive(Debug, Clone)]
pub struct PayoutRecord {
    pub miner_id: String,
    pub address: String,
    pub amount_flowers: u64,
    pub tx_id: String,
    pub height: u64,
    pub block_hash: String,
}

/// A block record for insertion.
#[derive(Debug, Clone)]
pub struct BlockRecord {
    pub height: u64,
    pub hash: String,
    pub miner_id: String,
    pub worker_name: String,
    pub share_difficulty: u64,
    pub network_difficulty: u64,
    pub status: String,
}

impl ShareStore {
    /// Open (or create) the SQLite database at `path` and run migrations.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)
            .context("failed to open share store sqlite database")?;
        // Performance pragmas — WAL mode for concurrent reads during writes,
        // busy timeout for contention, normal sync for durability.
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        let store = Self {
            conn: Mutex::new(conn),
        };
        store.run_migrations()?;
        Ok(store)
    }

    /// Open an in-memory database (for tests).
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.run_migrations()?;
        Ok(store)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let current: u32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap_or(0);
        if current >= SCHEMA_VERSION {
            debug!("share_store: schema already at v{current}");
            return Ok(());
        }
        info!(
            "share_store: migrating schema v{current} → v{SCHEMA_VERSION}"
        );

        if current < 1 {
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS shares (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts           INTEGER NOT NULL DEFAULT (unixepoch()),
                    miner_id     TEXT NOT NULL,
                    worker_name  TEXT NOT NULL,
                    job_id       INTEGER NOT NULL,
                    nonce        INTEGER NOT NULL,
                    hash_hex     TEXT NOT NULL,
                    height       INTEGER NOT NULL,
                    accepted     INTEGER NOT NULL DEFAULT 0,
                    share_difficulty  INTEGER NOT NULL DEFAULT 0,
                    network_difficulty INTEGER NOT NULL DEFAULT 0,
                    is_block     INTEGER NOT NULL DEFAULT 0,
                    source       TEXT NOT NULL DEFAULT 'zion'
                );
                CREATE INDEX IF NOT EXISTS idx_shares_ts ON shares(ts);
                CREATE INDEX IF NOT EXISTS idx_shares_miner ON shares(miner_id, worker_name);
                CREATE INDEX IF NOT EXISTS idx_shares_height ON shares(height);

                CREATE TABLE IF NOT EXISTS payouts (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts            INTEGER NOT NULL DEFAULT (unixepoch()),
                    miner_id      TEXT NOT NULL,
                    address       TEXT NOT NULL,
                    amount_flowers INTEGER NOT NULL,
                    tx_id         TEXT NOT NULL,
                    height        INTEGER NOT NULL,
                    block_hash    TEXT NOT NULL,
                    confirmations INTEGER NOT NULL DEFAULT 0,
                    confirmed     INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_payouts_miner ON payouts(miner_id);
                CREATE INDEX IF NOT EXISTS idx_payouts_height ON payouts(height);
                CREATE INDEX IF NOT EXISTS idx_payouts_tx ON payouts(tx_id);

                CREATE TABLE IF NOT EXISTS blocks (
                    height            INTEGER PRIMARY KEY,
                    hash              TEXT NOT NULL,
                    miner_id          TEXT NOT NULL,
                    worker_name       TEXT NOT NULL,
                    share_difficulty  INTEGER NOT NULL DEFAULT 0,
                    network_difficulty INTEGER NOT NULL DEFAULT 0,
                    status            TEXT NOT NULL DEFAULT 'pending',
                    ts                INTEGER NOT NULL DEFAULT (unixepoch()),
                    confirmed_at      INTEGER
                );

                CREATE TABLE IF NOT EXISTS miners (
                    miner_id      TEXT PRIMARY KEY,
                    first_seen    INTEGER NOT NULL DEFAULT (unixepoch()),
                    last_seen     INTEGER NOT NULL DEFAULT (unixepoch()),
                    total_shares  INTEGER NOT NULL DEFAULT 0,
                    accepted_shares INTEGER NOT NULL DEFAULT 0,
                    rejected_shares INTEGER NOT NULL DEFAULT 0,
                    total_paid_flowers INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS worker_stats (
                    miner_id      TEXT NOT NULL,
                    worker_name   TEXT NOT NULL,
                    algorithm     TEXT NOT NULL DEFAULT 'unknown',
                    last_hashrate REAL NOT NULL DEFAULT 0,
                    last_seen     INTEGER NOT NULL DEFAULT (unixepoch()),
                    total_shares  INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (miner_id, worker_name)
                );
                "#,
            )
            .context("failed to create F4 schema")?;
        }

        conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        info!("share_store: schema migration complete v{SCHEMA_VERSION}");
        Ok(())
    }

    /// Record a share.  Also upserts the miner and worker_stats rows.
    pub fn record_share(&self, rec: &ShareRecord) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT INTO shares (miner_id, worker_name, job_id, nonce, hash_hex, height, accepted, share_difficulty, network_difficulty, is_block, source)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                rec.miner_id,
                rec.worker_name,
                rec.job_id as i64,
                rec.nonce as i64,
                rec.hash_hex,
                rec.height as i64,
                rec.accepted as i32,
                rec.share_difficulty as i64,
                rec.network_difficulty as i64,
                rec.is_block as i32,
                rec.source,
            ],
        )?;
        // Upsert miner.
        conn.execute(
            "INSERT INTO miners (miner_id, first_seen, last_seen, total_shares, accepted_shares, rejected_shares, total_paid_flowers)
             VALUES (?1, unixepoch(), unixepoch(), 1, ?2, ?3, 0)
             ON CONFLICT(miner_id) DO UPDATE SET
                last_seen = unixepoch(),
                total_shares = total_shares + 1,
                accepted_shares = accepted_shares + ?2,
                rejected_shares = rejected_shares + ?3",
            params![
                rec.miner_id,
                rec.accepted as i64,
                (!rec.accepted) as i64,
            ],
        )?;
        // Upsert worker_stats.
        conn.execute(
            "INSERT INTO worker_stats (miner_id, worker_name, last_seen, total_shares)
             VALUES (?1, ?2, unixepoch(), 1)
             ON CONFLICT(miner_id, worker_name) DO UPDATE SET
                last_seen = unixepoch(),
                total_shares = total_shares + 1",
            params![rec.miner_id, rec.worker_name],
        )?;
        Ok(())
    }

    /// Count accepted shares in the last `window_secs` seconds.
    pub fn share_count_window(&self, window_secs: u64) -> Result<u64> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let count: u64 = conn.query_row(
            "SELECT COUNT(*) FROM shares WHERE accepted = 1 AND ts >= unixepoch() - ?1",
            params![window_secs as i64],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    /// Query recent shares for a miner.
    pub fn query_shares(&self, miner_id: &str, limit: u32) -> Result<Vec<ShareRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, worker_name, job_id, nonce, hash_hex, height, accepted, share_difficulty, network_difficulty, is_block, source
             FROM shares WHERE miner_id = ?1 ORDER BY ts DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![miner_id, limit as i64], |row| {
            Ok(ShareRow {
                ts: row.get(0)?,
                miner_id: row.get(1)?,
                worker_name: row.get(2)?,
                job_id: row.get::<_, i64>(3)? as u64,
                nonce: row.get::<_, i64>(4)? as u64,
                hash_hex: row.get(5)?,
                height: row.get::<_, i64>(6)? as u64,
                accepted: row.get::<_, i32>(7)? != 0,
                share_difficulty: row.get::<_, i64>(8)? as u64,
                network_difficulty: row.get::<_, i64>(9)? as u64,
                is_block: row.get::<_, i32>(10)? != 0,
                source: row.get(11)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Record a payout.
    pub fn record_payout(&self, rec: &PayoutRecord) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT INTO payouts (miner_id, address, amount_flowers, tx_id, height, block_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                rec.miner_id,
                rec.address,
                rec.amount_flowers as i64,
                rec.tx_id,
                rec.height as i64,
                rec.block_hash,
            ],
        )?;
        // Update miner's total_paid.  Payouts are keyed by the composite
        // "miner_id/worker_name", but the miners table is keyed by the base
        // miner id (the payout address / worker prefix).
        let base_miner_id = rec
            .miner_id
            .split_once('/')
            .map(|(base, _)| base)
            .unwrap_or(&rec.miner_id);
        conn.execute(
            "INSERT INTO miners (miner_id, first_seen, last_seen, total_shares, accepted_shares, rejected_shares, total_paid_flowers)
             VALUES (?2, unixepoch(), unixepoch(), 0, 0, 0, ?1)
             ON CONFLICT(miner_id) DO UPDATE SET total_paid_flowers = total_paid_flowers + excluded.total_paid_flowers",
            params![rec.amount_flowers as i64, base_miner_id],
        )?;
        Ok(())
    }

    /// Mark a payout as confirmed with N confirmations.
    pub fn confirm_payout(&self, tx_id: &str, confirmations: u32) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "UPDATE payouts SET confirmations = ?1, confirmed = 1 WHERE tx_id = ?2",
            params![confirmations as i64, tx_id],
        )?;
        Ok(())
    }

    /// Mark a payout as confirmed, also recording the block hash it was mined in.
    pub fn confirm_payout_with_block(
        &self,
        tx_id: &str,
        confirmations: u32,
        block_hash: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "UPDATE payouts SET confirmations = ?1, confirmed = 1, block_hash = ?2 WHERE tx_id = ?3",
            params![confirmations as i64, block_hash, tx_id],
        )?;
        Ok(())
    }

    /// Record a block (or update status if already present).
    pub fn record_block(&self, rec: &BlockRecord) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT INTO blocks (height, hash, miner_id, worker_name, share_difficulty, network_difficulty, status, ts)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, unixepoch())
             ON CONFLICT(height) DO UPDATE SET status = ?7",
            params![
                rec.height as i64,
                rec.hash,
                rec.miner_id,
                rec.worker_name,
                rec.share_difficulty as i64,
                rec.network_difficulty as i64,
                rec.status,
            ],
        )?;
        Ok(())
    }

    /// Update block status (e.g. pending → confirmed / orphaned).
    pub fn update_block_status(&self, height: u64, status: &str) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "UPDATE blocks SET status = ?1, confirmed_at = CASE WHEN ?1 IN ('confirmed','orphaned') THEN unixepoch() ELSE confirmed_at END WHERE height = ?2",
            params![status, height as i64],
        )?;
        Ok(())
    }

    /// Get a block record by height (for orphan monitor).
    pub fn get_block(&self, height: u64) -> Result<Option<DbBlockRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let row = conn
            .query_row(
                "SELECT height, hash, miner_id, worker_name, share_difficulty, network_difficulty, status, ts, confirmed_at
                 FROM blocks WHERE height = ?1",
                params![height as i64],
                |row| {
                    Ok(DbBlockRow {
                        height: row.get::<_, i64>(0)? as u64,
                        hash: row.get(1)?,
                        miner_id: row.get(2)?,
                        worker_name: row.get(3)?,
                        share_difficulty: row.get::<_, i64>(4)? as u64,
                        network_difficulty: row.get::<_, i64>(5)? as u64,
                        status: row.get(6)?,
                        ts: row.get(7)?,
                        confirmed_at: row.get::<_, Option<i64>>(8)?,
                    })
                },
            )
            .optional()?;
        Ok(row)
    }

    /// Query recent blocks.
    pub fn query_blocks(&self, limit: u32) -> Result<Vec<DbBlockRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT height, hash, miner_id, worker_name, share_difficulty, network_difficulty, status, ts, confirmed_at
             FROM blocks ORDER BY height DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(DbBlockRow {
                height: row.get::<_, i64>(0)? as u64,
                hash: row.get(1)?,
                miner_id: row.get(2)?,
                worker_name: row.get(3)?,
                share_difficulty: row.get::<_, i64>(4)? as u64,
                network_difficulty: row.get::<_, i64>(5)? as u64,
                status: row.get(6)?,
                ts: row.get(7)?,
                confirmed_at: row.get::<_, Option<i64>>(8)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Query recent payouts for a miner.
    pub fn query_payouts(&self, miner_id: &str, limit: u32) -> Result<Vec<PayoutRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed
             FROM payouts WHERE miner_id = ?1 ORDER BY ts DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![miner_id, limit as i64], |row| {
            Ok(PayoutRow {
                ts: row.get(0)?,
                miner_id: row.get(1)?,
                address: row.get(2)?,
                amount_flowers: row.get::<_, i64>(3)? as u64,
                tx_id: row.get(4)?,
                height: row.get::<_, i64>(5)? as u64,
                block_hash: row.get(6)?,
                confirmations: row.get::<_, i64>(7)? as u32,
                confirmed: row.get::<_, i32>(8)? != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Query recent payouts for a payout address (used by the miner detail API
    /// so the returned list matches the full historical paid total).
    pub fn query_payouts_by_address(&self, address: &str, limit: u32) -> Result<Vec<PayoutRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed
             FROM payouts WHERE address = ?1 ORDER BY ts DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![address, limit as i64], |row| {
            Ok(PayoutRow {
                ts: row.get(0)?,
                miner_id: row.get(1)?,
                address: row.get(2)?,
                amount_flowers: row.get::<_, i64>(3)? as u64,
                tx_id: row.get(4)?,
                height: row.get::<_, i64>(5)? as u64,
                block_hash: row.get(6)?,
                confirmations: row.get::<_, i64>(7)? as u32,
                confirmed: row.get::<_, i32>(8)? != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Query recent payouts for all miners (F7.1 — for REST API endpoint).
    pub fn query_all_payouts(&self, limit: u32) -> Result<Vec<PayoutRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed
             FROM payouts ORDER BY ts DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(PayoutRow {
                ts: row.get(0)?,
                miner_id: row.get(1)?,
                address: row.get(2)?,
                amount_flowers: row.get::<_, i64>(3)? as u64,
                tx_id: row.get(4)?,
                height: row.get::<_, i64>(5)? as u64,
                block_hash: row.get(6)?,
                confirmations: row.get::<_, i64>(7)? as u32,
                confirmed: row.get::<_, i32>(8)? != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Query all payouts in ascending time order for telemetry restore.
    pub fn query_all_payouts_asc(&self) -> Result<Vec<PayoutRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed
             FROM payouts ORDER BY ts ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PayoutRow {
                ts: row.get(0)?,
                miner_id: row.get(1)?,
                address: row.get(2)?,
                amount_flowers: row.get::<_, i64>(3)? as u64,
                tx_id: row.get(4)?,
                height: row.get::<_, i64>(5)? as u64,
                block_hash: row.get(6)?,
                confirmations: row.get::<_, i64>(7)? as u32,
                confirmed: row.get::<_, i32>(8)? != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Query payouts that have not yet been marked confirmed.
    pub fn query_unconfirmed_payouts(&self) -> Result<Vec<PayoutRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed
             FROM payouts WHERE confirmed = 0",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PayoutRow {
                ts: row.get(0)?,
                miner_id: row.get(1)?,
                address: row.get(2)?,
                amount_flowers: row.get::<_, i64>(3)? as u64,
                tx_id: row.get(4)?,
                height: row.get::<_, i64>(5)? as u64,
                block_hash: row.get(6)?,
                confirmations: row.get::<_, i64>(7)? as u32,
                confirmed: row.get::<_, i32>(8)? != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Return the lifetime paid total (flowers) for a payout address.
    pub fn payout_total_by_address(&self, address: &str) -> Result<u64> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let total: i64 = conn.query_row(
            "SELECT COALESCE(SUM(amount_flowers),0) FROM payouts WHERE address = ?1",
            params![address],
            |row| row.get(0),
        )?;
        Ok(total as u64)
    }

    /// Return total paid flowers per composite miner_id.
    pub fn payout_totals_by_miner(&self) -> Result<HashMap<String, u64>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT miner_id, COALESCE(SUM(amount_flowers),0) FROM payouts GROUP BY miner_id",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u64))
        })?;
        let mut out = HashMap::new();
        for r in rows {
            let (miner_id, total) = r?;
            out.insert(miner_id, total);
        }
        Ok(out)
    }

    /// Query all miner stats (F7.1 — for REST API endpoint).
    pub fn query_all_miners(&self, limit: u32) -> Result<Vec<MinerStatsRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT miner_id, first_seen, last_seen, total_shares, accepted_shares, rejected_shares, total_paid_flowers
             FROM miners ORDER BY last_seen DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(MinerStatsRow {
                miner_id: row.get(0)?,
                first_seen: row.get(1)?,
                last_seen: row.get(2)?,
                total_shares: row.get::<_, i64>(3)? as u64,
                accepted_shares: row.get::<_, i64>(4)? as u64,
                rejected_shares: row.get::<_, i64>(5)? as u64,
                total_paid_flowers: row.get::<_, i64>(6)? as u64,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Get miner stats.
    pub fn get_miner_stats(&self, miner_id: &str) -> Result<Option<MinerStatsRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let row = conn
            .query_row(
                "SELECT miner_id, first_seen, last_seen, total_shares, accepted_shares, rejected_shares, total_paid_flowers
                 FROM miners WHERE miner_id = ?1",
                params![miner_id],
                |row| {
                    Ok(MinerStatsRow {
                        miner_id: row.get(0)?,
                        first_seen: row.get(1)?,
                        last_seen: row.get(2)?,
                        total_shares: row.get::<_, i64>(3)? as u64,
                        accepted_shares: row.get::<_, i64>(4)? as u64,
                        rejected_shares: row.get::<_, i64>(5)? as u64,
                        total_paid_flowers: row.get::<_, i64>(6)? as u64,
                    })
                },
            )
            .optional()?;
        Ok(row)
    }

    /// Update worker hashrate (called periodically from telemetry).
    /// Also upserts the miner row so worker_stats is consistent.
    pub fn update_worker_hashrate(
        &self,
        miner_id: &str,
        worker_name: &str,
        algorithm: &str,
        hashrate: f64,
    ) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        // Upsert miner first.
        conn.execute(
            "INSERT INTO miners (miner_id, first_seen, last_seen, total_shares, accepted_shares, rejected_shares, total_paid_flowers)
             VALUES (?1, unixepoch(), unixepoch(), 0, 0, 0, 0)
             ON CONFLICT(miner_id) DO UPDATE SET last_seen = unixepoch()",
            params![miner_id],
        )?;
        conn.execute(
            "INSERT INTO worker_stats (miner_id, worker_name, algorithm, last_hashrate, last_seen, total_shares)
             VALUES (?1, ?2, ?3, ?4, unixepoch(), 0)
             ON CONFLICT(miner_id, worker_name) DO UPDATE SET
                algorithm = ?3,
                last_hashrate = ?4,
                last_seen = unixepoch()",
            params![miner_id, worker_name, algorithm, hashrate],
        )?;
        Ok(())
    }

    /// Count all miners.
    pub fn miner_count(&self) -> Result<u64> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let count: u64 = conn.query_row("SELECT COUNT(*) FROM miners", [], |row| row.get(0))?;
        Ok(count)
    }
}

// ── Row types for queries ──────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ShareRow {
    pub ts: i64,
    pub miner_id: String,
    pub worker_name: String,
    pub job_id: u64,
    pub nonce: u64,
    pub hash_hex: String,
    pub height: u64,
    pub accepted: bool,
    pub share_difficulty: u64,
    pub network_difficulty: u64,
    pub is_block: bool,
    pub source: String,
}

#[derive(Debug, Clone)]
pub struct PayoutRow {
    pub ts: i64,
    pub miner_id: String,
    pub address: String,
    pub amount_flowers: u64,
    pub tx_id: String,
    pub height: u64,
    pub block_hash: String,
    pub confirmations: u32,
    pub confirmed: bool,
}

#[derive(Debug, Clone)]
pub struct DbBlockRow {
    pub height: u64,
    pub hash: String,
    pub miner_id: String,
    pub worker_name: String,
    pub share_difficulty: u64,
    pub network_difficulty: u64,
    pub status: String,
    pub ts: i64,
    pub confirmed_at: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct MinerStatsRow {
    pub miner_id: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub total_shares: u64,
    pub accepted_shares: u64,
    pub rejected_shares: u64,
    pub total_paid_flowers: u64,
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_in_memory_creates_schema() {
        let store = ShareStore::open_in_memory().unwrap();
        assert_eq!(store.miner_count().unwrap(), 0);
    }

    #[test]
    fn record_share_and_query() {
        let store = ShareStore::open_in_memory().unwrap();
        let rec = ShareRecord {
            miner_id: "zion1abc".to_string(),
            worker_name: "worker1".to_string(),
            job_id: 42,
            nonce: 12345,
            hash_hex: "deadbeef".to_string(),
            height: 100,
            accepted: true,
            share_difficulty: 1000,
            network_difficulty: 1000000,
            is_block: false,
            source: "zion".to_string(),
        };
        store.record_share(&rec).unwrap();
        store.record_share(&rec).unwrap();

        let shares = store.query_shares("zion1abc", 10).unwrap();
        assert_eq!(shares.len(), 2);
        assert!(shares[0].accepted);
        assert_eq!(shares[0].miner_id, "zion1abc");

        let stats = store.get_miner_stats("zion1abc").unwrap().unwrap();
        assert_eq!(stats.total_shares, 2);
        assert_eq!(stats.accepted_shares, 2);
        assert_eq!(stats.rejected_shares, 0);
    }

    #[test]
    fn share_count_window_counts_accepted() {
        let store = ShareStore::open_in_memory().unwrap();
        let rec = ShareRecord {
            miner_id: "m1".to_string(),
            worker_name: "w1".to_string(),
            job_id: 1,
            nonce: 1,
            hash_hex: "h".to_string(),
            height: 1,
            accepted: true,
            share_difficulty: 1,
            network_difficulty: 1,
            is_block: false,
            source: "zion".to_string(),
        };
        store.record_share(&rec).unwrap();
        // Rejected share should not count.
        let mut rec2 = rec.clone();
        rec2.accepted = false;
        store.record_share(&rec2).unwrap();

        let count = store.share_count_window(3600).unwrap();
        assert_eq!(count, 1, "only accepted shares should be counted");
    }

    #[test]
    fn record_and_query_payout() {
        let store = ShareStore::open_in_memory().unwrap();
        // First record a share so the miner exists.
        let share = ShareRecord {
            miner_id: "m1".to_string(),
            worker_name: "w1".to_string(),
            job_id: 1,
            nonce: 1,
            hash_hex: "h".to_string(),
            height: 100,
            accepted: true,
            share_difficulty: 1,
            network_difficulty: 1,
            is_block: true,
            source: "zion".to_string(),
        };
        store.record_share(&share).unwrap();

        let payout = PayoutRecord {
            miner_id: "m1".to_string(),
            address: "zion1abc".to_string(),
            amount_flowers: 1_000_000,
            tx_id: "tx123".to_string(),
            height: 100,
            block_hash: "hash123".to_string(),
        };
        store.record_payout(&payout).unwrap();
        store.confirm_payout("tx123", 10).unwrap();

        let payouts = store.query_payouts("m1", 10).unwrap();
        assert_eq!(payouts.len(), 1);
        assert!(payouts[0].confirmed);
        assert_eq!(payouts[0].confirmations, 10);

        let stats = store.get_miner_stats("m1").unwrap().unwrap();
        assert_eq!(stats.total_paid_flowers, 1_000_000);
    }

    #[test]
    fn record_and_update_block_status() {
        let store = ShareStore::open_in_memory().unwrap();
        let block = BlockRecord {
            height: 200,
            hash: "blockhash".to_string(),
            miner_id: "m1".to_string(),
            worker_name: "w1".to_string(),
            share_difficulty: 5000,
            network_difficulty: 1_000_000,
            status: "pending".to_string(),
        };
        store.record_block(&block).unwrap();
        store.update_block_status(200, "confirmed").unwrap();

        let row = store.get_block(200).unwrap().unwrap();
        assert_eq!(row.status, "confirmed");
        assert!(row.confirmed_at.is_some());

        let blocks = store.query_blocks(10).unwrap();
        assert_eq!(blocks.len(), 1);
    }

    #[test]
    fn update_worker_hashrate_upserts() {
        let store = ShareStore::open_in_memory().unwrap();
        store
            .update_worker_hashrate("m1", "w1", "deeksha", 125.5)
            .unwrap();
        // Second call should update, not insert.
        store
            .update_worker_hashrate("m1", "w1", "deeksha", 250.0)
            .unwrap();
        // No direct query for hashrate, but no error means upsert worked.
    }
}
