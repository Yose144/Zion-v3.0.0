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
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tracing::{debug, info};

use crate::v3_pplns::PayoutEntry;

/// Current schema version.  Increment when adding migrations.
/// v2 (F2): `coin` columns on shares/payouts/blocks + composite
/// `(coin, height)` primary key on blocks (heights collide across chains).
/// v3 (F3): `coin_revenue` audit table — each native-coin revenue event
/// posted by the treasury oracle, keyed by event id for restart-safe
/// dedup.
/// v4: persistent pool history samples.
/// v5: revenue event prepare/commit journal and durable native payout outbox.
/// v6: per-coin pool hashrate in history samples + per-miner hashrate
/// history table (wallet-scoped timeseries for the public miner dashboard).
/// v7: persisted share-dedup marks — the in-memory (job → nonce) seen-set
/// evaporates on restart; upstream-keyed `ext:` job ids outlive it, so a
/// replayed external share could double-credit PPLNS after a bounce.
/// v8: `blocks.shares_since_prev` — per-block share count at find time.
/// The in-memory BlockTracker loses its luck window on restart; with the
/// column persisted, boot restores the full luck_100/luck_500 view.
/// v9: `pool_state` kv — the running shares-since-last-block counter is
/// flushed here periodically (the `shares` table is not populated by the
/// production submit path, so there is no per-share trail to recount).
const SCHEMA_VERSION: u32 = 13;

/// A thread-safe wrapper around a SQLite connection.  SQLite with
/// `serialized` mode (default for `bundled`) supports multi-thread access,
/// but we use a `Mutex` to avoid contention on the connection handle.
pub struct ShareStore {
    conn: Mutex<Connection>,
}

impl std::fmt::Debug for ShareStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ShareStore").finish_non_exhaustive()
    }
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
    /// Coin the share was mined for — lowercase ticker (F2; `"zion"`,
    /// `"qtu"`, `"prl"`, bridged coin ids).
    pub coin: String,
}

/// An offline-worker alert subscription row (schema v10, A2.2).
/// `worker` empty = wallet-wide watch (alert when NO worker of the wallet
/// is online); otherwise that exact worker name. `channel` ∈
/// {`webhook`, `telegram`}; `target` = URL or chat_id. `state` dedups
/// transitions — alerts fire only on online↔offline flips.
#[derive(Debug, Clone)]
pub struct AlertSub {
    pub id: i64,
    pub miner_id: String,
    pub worker: String,
    pub channel: String,
    pub target: String,
    pub offline_secs: u64,
    pub state: String,
    pub last_alert_ts: u64,
}

/// A payout record for insertion.
#[derive(Debug, Clone)]
pub struct PayoutRecord {
    pub miner_id: String,
    pub address: String,
    /// Amount in the coin's native base units (flowers for ZION,
    /// 12-decimal units for QTU, satoshi-like units elsewhere — F2:
    /// the unit is coin-dependent; `coin` disambiguates).
    pub amount_flowers: u64,
    pub tx_id: String,
    pub height: u64,
    pub block_hash: String,
    /// Payout coin — `"zion"` for on-chain sends, `"qtu"`/`"prl"` for
    /// node-wallet batches, coin id for bridged payouts (F2).
    pub coin: String,
}

/// A block record for insertion.
#[derive(Debug, Clone)]
pub struct BlockRecord {
    /// Coin the block was mined on (F2) — part of the primary key since
    /// heights collide across chains.
    pub coin: String,
    pub height: u64,
    pub hash: String,
    pub miner_id: String,
    pub worker_name: String,
    pub share_difficulty: u64,
    pub network_difficulty: u64,
    /// Accepted shares counted since the previous block — the luck input
    /// (v8). Zero for records predating the column.
    pub shares_since_prev: u64,
    pub status: String,
}

impl ShareStore {
    /// Open (or create) the SQLite database at `path` and run migrations.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path).context("failed to open share store sqlite database")?;
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

    /// Write a consistent snapshot of the whole database to `dest` via
    /// `VACUUM INTO`. WAL mode lets writers keep working during the vacuum —
    /// the snapshot is the DB state at vacuum start, suitable for the HA
    /// standby state export (A4.2). Overwrites `dest` if it exists.
    pub fn vacuum_into<P: AsRef<Path>>(&self, dest: P) -> Result<()> {
        let dest = dest.as_ref();
        // VACUUM INTO does not accept bound parameters for the target; the
        // path is always generated by us (tempdir + fixed name), and we
        // still escape quotes defensively.
        let dest_str = dest.to_string_lossy().replace('\'', "''");
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(&format!("VACUUM INTO '{dest_str}'"))
            .context("VACUUM INTO snapshot failed")?;
        Ok(())
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

    /// Wrap a caller-prepared connection (tests seed an older schema, then
    /// run the migration path end-to-end).
    #[cfg(test)]
    fn from_connection_for_test(conn: Connection) -> Result<Self> {
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
        info!("share_store: migrating schema v{current} → v{SCHEMA_VERSION}");

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

        if current < 2 {
            // v2: coin columns.  SQLite cannot ALTER a PRIMARY KEY, so the
            // blocks table is rebuilt with composite (coin, height).
            conn.execute_batch(
                r#"
                ALTER TABLE shares ADD COLUMN coin TEXT NOT NULL DEFAULT 'zion';
                ALTER TABLE payouts ADD COLUMN coin TEXT NOT NULL DEFAULT 'zion';
                ALTER TABLE blocks RENAME TO blocks_v1;
                CREATE TABLE blocks (
                    coin              TEXT NOT NULL DEFAULT 'zion',
                    height            INTEGER NOT NULL,
                    hash              TEXT NOT NULL,
                    miner_id          TEXT NOT NULL,
                    worker_name       TEXT NOT NULL,
                    share_difficulty  INTEGER NOT NULL DEFAULT 0,
                    network_difficulty INTEGER NOT NULL DEFAULT 0,
                    status            TEXT NOT NULL DEFAULT 'pending',
                    ts                INTEGER NOT NULL DEFAULT (unixepoch()),
                    confirmed_at      INTEGER,
                    PRIMARY KEY (coin, height)
                );
                INSERT INTO blocks (coin, height, hash, miner_id, worker_name, share_difficulty, network_difficulty, status, ts, confirmed_at)
                    SELECT 'zion', height, hash, miner_id, worker_name, share_difficulty, network_difficulty, status, ts, confirmed_at
                    FROM blocks_v1;
                DROP TABLE blocks_v1;
                CREATE INDEX IF NOT EXISTS idx_shares_coin ON shares(coin, ts);
                CREATE INDEX IF NOT EXISTS idx_payouts_coin ON payouts(coin, ts);
                CREATE INDEX IF NOT EXISTS idx_blocks_coin ON blocks(coin, height);
                "#,
            )
            .context("failed to migrate schema to v2")?;
        }

        if current < 3 {
            // v3: per-coin revenue audit (F3).  `id` = oracle event key
            // (e.g. "qtu:rev:42"); UNIQUE + has_coin_revenue() make revenue
            // POST retries idempotent across pool restarts.
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS coin_revenue (
                    id            TEXT PRIMARY KEY,
                    coin          TEXT NOT NULL,
                    amount_native TEXT NOT NULL,
                    ref_height    INTEGER NOT NULL DEFAULT 0,
                    emitted       INTEGER NOT NULL DEFAULT 0,
                    emitted_total TEXT NOT NULL DEFAULT '0',
                    ts            INTEGER NOT NULL DEFAULT (unixepoch())
                );
                CREATE INDEX IF NOT EXISTS idx_coin_revenue_coin ON coin_revenue(coin, ts);
                "#,
            )
            .context("failed to migrate schema to v3")?;
        }

        if current < 4 {
            // v4: periodic pool snapshots for the hashrate-history API —
            // survives restarts so `/public/v1/history` keeps the last 24h
            // instead of starting empty after every pool bounce.
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS history (
                    ts             INTEGER PRIMARY KEY,
                    hashrate       REAL NOT NULL,
                    miners_online  INTEGER NOT NULL,
                    online_by_coin TEXT NOT NULL DEFAULT '{}',
                    accepted       INTEGER NOT NULL DEFAULT 0,
                    rejected       INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_history_ts ON history(ts);
                "#,
            )
            .context("failed to migrate schema to v4")?;
        }

        if current < 5 {
            let has_status = {
                let mut stmt = conn.prepare("PRAGMA table_info(coin_revenue)")?;
                let columns = stmt
                    .query_map([], |row| row.get::<_, String>(1))?
                    .collect::<rusqlite::Result<Vec<_>>>()?
                    .iter()
                    .any(|column| column == "status");
                columns
            };
            conn.execute_batch(if has_status {
                r#"
                CREATE TABLE IF NOT EXISTS coin_revenue_outbox (
                    id          TEXT PRIMARY KEY,
                    event_id    TEXT NOT NULL,
                    chain       TEXT NOT NULL,
                    height      INTEGER NOT NULL,
                    payout_json TEXT NOT NULL,
                    status      TEXT NOT NULL DEFAULT 'pending',
                    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
                    acked_at    INTEGER
                );
                CREATE INDEX IF NOT EXISTS idx_coin_revenue_outbox_pending
                    ON coin_revenue_outbox(chain, status, created_at);
                "#
            } else {
                r#"
                ALTER TABLE coin_revenue
                    ADD COLUMN status TEXT NOT NULL DEFAULT 'committed';
                CREATE TABLE IF NOT EXISTS coin_revenue_outbox (
                    id          TEXT PRIMARY KEY,
                    event_id    TEXT NOT NULL,
                    chain       TEXT NOT NULL,
                    height      INTEGER NOT NULL,
                    payout_json TEXT NOT NULL,
                    status      TEXT NOT NULL DEFAULT 'pending',
                    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
                    acked_at    INTEGER
                );
                CREATE INDEX IF NOT EXISTS idx_coin_revenue_outbox_pending
                    ON coin_revenue_outbox(chain, status, created_at);
                "#
            })
            .context("failed to migrate schema to v5")?;
        }

        if current < 6 {
            // v6: per-coin pool hashrate column on the existing pool
            // snapshots, plus a per-miner hashrate history table so the
            // public miner dashboard can render wallet timeseries that
            // survive restarts (same 60s cadence / 24h retention as the
            // pool history feed). The history table is probed first —
            // hand-built fixtures may not carry it.
            let history_exists = conn.query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='history'",
                [],
                |r| r.get::<_, i64>(0),
            )? > 0;
            if history_exists {
                let has_hbc = {
                    let mut stmt = conn.prepare("PRAGMA table_info(history)")?;
                    let cols = stmt
                        .query_map([], |row| row.get::<_, String>(1))?
                        .collect::<rusqlite::Result<Vec<_>>>()?;
                    cols.iter().any(|c| c == "hashrate_by_coin")
                };
                if !has_hbc {
                    conn.execute_batch(
                        "ALTER TABLE history ADD COLUMN hashrate_by_coin TEXT NOT NULL DEFAULT '{}'",
                    )
                    .context("failed to add history.hashrate_by_coin")?;
                }
            }
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS miner_history (
                    miner_id  TEXT NOT NULL,
                    worker    TEXT NOT NULL,
                    ts        INTEGER NOT NULL,
                    hps       TEXT NOT NULL DEFAULT '{}',
                    accepted  INTEGER NOT NULL DEFAULT 0,
                    rejected  INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (miner_id, worker, ts)
                );
                CREATE INDEX IF NOT EXISTS idx_miner_history_ts ON miner_history(ts);
                "#,
            )
            .context("failed to migrate schema to v6")?;
        }

        if current < 7 {
            // v7: persisted share-dedup marks keyed (bucket, tag). Rows
            // churn with job turnover — buckets are deleted on evict and
            // the ts index supports cheap age pruning.
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS share_dedup (
                    bucket TEXT NOT NULL,
                    tag    INTEGER NOT NULL,
                    ts     INTEGER NOT NULL,
                    PRIMARY KEY (bucket, tag)
                );
                CREATE INDEX IF NOT EXISTS idx_share_dedup_ts ON share_dedup(ts);
                "#,
            )
            .context("failed to migrate schema to v7")?;
        }

        if current < 8 {
            // v8: per-block share count at find time — restores the
            // in-memory luck window (luck_100/luck_500) after restart.
            conn.execute_batch(
                "ALTER TABLE blocks ADD COLUMN shares_since_prev INTEGER NOT NULL DEFAULT 0;",
            )
            .context("failed to migrate schema to v8")?;
        }

        if current < 9 {
            // v9: kv store for the shares-since-last-block counter —
            // production never INSERTs into `shares`, so the counter
            // cannot be rebuilt from per-share rows.
            conn.execute_batch(
                "CREATE TABLE pool_state (
                    key   TEXT PRIMARY KEY,
                    value INTEGER NOT NULL,
                    ts    INTEGER NOT NULL DEFAULT (unixepoch())
                );",
            )
            .context("failed to migrate schema to v9")?;
        }

        if current < 10 {
            // v10: ZIS-account miner settings (per-wallet payout threshold
            // override — 0 = inherit global) + offline-worker alert
            // subscriptions (A2.2/A2.3). `state`/`last_alert_ts` dedup the
            // offline→online transition alerts.
            conn.execute_batch(
                "CREATE TABLE miner_settings (
                    miner_id           TEXT PRIMARY KEY,
                    min_payout_flowers INTEGER NOT NULL DEFAULT 0,
                    updated_ts         INTEGER NOT NULL DEFAULT (unixepoch())
                );
                CREATE TABLE alert_subscriptions (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    miner_id      TEXT NOT NULL,
                    worker        TEXT NOT NULL DEFAULT '',
                    channel       TEXT NOT NULL,
                    target        TEXT NOT NULL,
                    offline_secs  INTEGER NOT NULL DEFAULT 600,
                    state         TEXT NOT NULL DEFAULT 'online',
                    last_alert_ts INTEGER NOT NULL DEFAULT 0,
                    created_ts    INTEGER NOT NULL DEFAULT (unixepoch())
                );
                CREATE INDEX alert_subs_miner ON alert_subscriptions(miner_id);",
            )
            .context("failed to migrate schema to v10")?;
        }

        if current < 11 {
            // v11: `superseded_tx_id` marks unconfirmed payout rows whose
            // broadcast tx provably never landed (absent from chain AND
            // mempool past the stuck age). The rows stay in the ledger as
            // evidence but are excluded from the unconfirmed backlog and
            // the entry is re-queued so a fresh tx pays the miner.
            let has_payouts: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'payouts'",
                    [],
                    |r| r.get::<_, i64>(0),
                )
                .map(|c| c > 0)
                .unwrap_or(false);
            if has_payouts {
                conn.execute_batch(
                    "ALTER TABLE payouts
                        ADD COLUMN superseded_tx_id TEXT NOT NULL DEFAULT '';
                     CREATE INDEX payouts_superseded ON payouts(superseded_tx_id);",
                )
                .context("failed to migrate schema to v11")?;
            }
        }

        if current < 12 {
            // v12: `miner_zis_bindings` records which miner identity has a
            // ZIS-bound session (claim observability, not authorization —
            // auth decisions stay in the session layer). Written on each
            // successful ZIS login across all stratum dialects; the public
            // identity endpoint serves a masked view.
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS miner_zis_bindings (
                    miner_id      TEXT PRIMARY KEY,
                    zis_sub       TEXT NOT NULL,
                    first_seen_ts INTEGER NOT NULL,
                    last_seen_ts  INTEGER NOT NULL
                );",
            )
            .context("failed to migrate schema to v12")?;
        }

        if current < 13 {
            // v13: `inclusion_height` records which block a payout tx was
            // mined in. Previously `confirm_payout_with_block` overwrote the
            // row's `height` (the rewarded block height) with the inclusion
            // height — different debts of the same amount confirmed in one
            // block then became indistinguishable, so the exact-amount
            // duplicate-detection query produced phantom pairs (2026-10-29
            // 2.S2 re-count). `height` keeps its original meaning (rewarded
            // height); legacy confirmed rows backfill inclusion_height from
            // the overwritten value (their rewarded height is unrecoverable).
            let has_payouts: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'payouts'",
                    [],
                    |r| r.get::<_, i64>(0),
                )
                .map(|c| c > 0)
                .unwrap_or(false);
            if has_payouts {
                conn.execute_batch(
                    "ALTER TABLE payouts
                        ADD COLUMN inclusion_height INTEGER;
                     UPDATE payouts SET inclusion_height = height
                        WHERE confirmed = 1;",
                )
                .context("failed to migrate schema to v13")?;
            }
        }

        conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        info!("share_store: schema migration complete v{SCHEMA_VERSION}");
        Ok(())
    }

    /// Record a share.  Also upserts the miner and worker_stats rows.
    pub fn record_share(&self, rec: &ShareRecord) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT INTO shares (miner_id, worker_name, job_id, nonce, hash_hex, height, accepted, share_difficulty, network_difficulty, is_block, source, coin)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
                rec.coin,
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

    /// Upsert a miner↔ZIS binding after a successful ZIS-authenticated
    /// stratum login. `miner_id` is the wallet/key the session mines under
    /// (v3 miner id or legacy wallet login); `first_seen_ts` is preserved
    /// on conflict so the identity endpoint can report when binding began.
    pub fn record_zis_binding(&self, miner_id: &str, zis_sub: &str) -> Result<()> {
        if miner_id.is_empty() || zis_sub.is_empty() {
            return Ok(());
        }
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT INTO miner_zis_bindings (miner_id, zis_sub, first_seen_ts, last_seen_ts)
             VALUES (?1, ?2, unixepoch(), unixepoch())
             ON CONFLICT(miner_id) DO UPDATE SET
                zis_sub = excluded.zis_sub,
                last_seen_ts = excluded.last_seen_ts",
            params![miner_id, zis_sub],
        )?;
        Ok(())
    }

    /// Fetch `(zis_sub, first_seen_ts)` for a miner id, if bound.
    pub fn query_zis_binding(&self, miner_id: &str) -> Result<Option<(String, i64)>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.query_row(
            "SELECT zis_sub, first_seen_ts FROM miner_zis_bindings WHERE miner_id = ?1",
            params![miner_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)),
        )
        .optional()
        .map_err(Into::into)
    }

    /// Number of distinct miner ids with an observed ZIS binding.
    pub fn count_zis_bindings(&self) -> Result<i64> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.query_row("SELECT COUNT(*) FROM miner_zis_bindings", [], |r| r.get(0))
            .map_err(Into::into)
    }

    /// Query recent shares for a miner.
    pub fn query_shares(&self, miner_id: &str, limit: u32) -> Result<Vec<ShareRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, worker_name, job_id, nonce, hash_hex, height, accepted, share_difficulty, network_difficulty, is_block, source, coin
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
                coin: row.get(12)?,
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
            "INSERT INTO payouts (miner_id, address, amount_flowers, tx_id, height, block_hash, coin)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                rec.miner_id,
                rec.address,
                rec.amount_flowers as i64,
                rec.tx_id,
                rec.height as i64,
                rec.block_hash,
                rec.coin,
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

    /// Mark unconfirmed payout rows of `tx_id` as voided (`superseded_tx_id`)
    /// because the broadcast provably never landed (absent from chain and
    /// mempool past the stuck age). Rows stay in the ledger as evidence but
    /// leave the unconfirmed backlog; `miners.total_paid_flowers` is rolled
    /// back so the re-queued payment doesn't double-count. Returns the
    /// number of rows voided.
    pub fn void_payout_rows(&self, tx_id: &str) -> Result<usize> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT miner_id, amount_flowers FROM payouts
             WHERE tx_id = ?1 AND confirmed = 0 AND superseded_tx_id = ''",
        )?;
        let rows: Vec<(String, i64)> = stmt
            .query_map(params![tx_id], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<std::result::Result<_, _>>()?;
        drop(stmt);
        if rows.is_empty() {
            return Ok(0);
        }
        let n = conn.execute(
            "UPDATE payouts SET superseded_tx_id = 'voided:stuck'
             WHERE tx_id = ?1 AND confirmed = 0 AND superseded_tx_id = ''",
            params![tx_id],
        )?;
        for (miner_id, amount) in &rows {
            let base = miner_id
                .split_once('/')
                .map(|(b, _)| b)
                .unwrap_or(miner_id.as_str());
            conn.execute(
                "UPDATE miners SET total_paid_flowers = MAX(0, total_paid_flowers - ?1)
                 WHERE miner_id = ?2",
                params![amount, base],
            )?;
        }
        Ok(n)
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

    /// Mark a payout as confirmed, also recording the block hash and the
    /// inclusion height it was mined in. The row's `height` stays the
    /// rewarded block height (schema v13 — previously it was overwritten,
    /// which made same-amount debts confirmed in one block collide in the
    /// duplicate-detection query).
    pub fn confirm_payout_with_block(
        &self,
        tx_id: &str,
        confirmations: u32,
        block_hash: &str,
        height: u64,
    ) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "UPDATE payouts SET confirmations = ?1, confirmed = 1, block_hash = ?2, inclusion_height = ?3 WHERE tx_id = ?4",
            params![confirmations as i64, block_hash, height as i64, tx_id],
        )?;
        Ok(())
    }

    /// Record a block (or update status if already present).
    ///
    /// One row per (coin, height): several pool candidates can race for the
    /// same height — a losing submission (`orphaned`) typically lands *after*
    /// the winner's `confirmed` write (2026-10-26 RCA: ~21 % of candidates).
    /// `confirmed` is therefore sticky and a late confirmed write refreshes
    /// hash/miner to the winning candidate.
    pub fn record_block(&self, rec: &BlockRecord) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT INTO blocks (coin, height, hash, miner_id, worker_name, share_difficulty, network_difficulty, shares_since_prev, status, ts)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, unixepoch())
             ON CONFLICT(coin, height) DO UPDATE SET
                status = CASE WHEN blocks.status = 'confirmed' THEN 'confirmed' ELSE excluded.status END,
                hash = CASE WHEN excluded.status = 'confirmed' THEN excluded.hash ELSE blocks.hash END,
                miner_id = CASE WHEN excluded.status = 'confirmed' THEN excluded.miner_id ELSE blocks.miner_id END,
                worker_name = CASE WHEN excluded.status = 'confirmed' THEN excluded.worker_name ELSE blocks.worker_name END,
                shares_since_prev = CASE WHEN excluded.shares_since_prev > 0 THEN excluded.shares_since_prev ELSE blocks.shares_since_prev END,
                confirmed_at = CASE WHEN excluded.status = 'confirmed' THEN unixepoch() ELSE blocks.confirmed_at END",
            params![
                rec.coin,
                rec.height as i64,
                rec.hash,
                rec.miner_id,
                rec.worker_name,
                rec.share_difficulty as i64,
                rec.network_difficulty as i64,
                rec.shares_since_prev as i64,
                rec.status,
            ],
        )?;
        Ok(())
    }

    /// Update block status (e.g. pending → confirmed / orphaned).
    /// `coin` scopes the height lookup (F2 — heights collide across chains).
    pub fn update_block_status(&self, coin: &str, height: u64, status: &str) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "UPDATE blocks SET status = ?1, confirmed_at = CASE WHEN ?1 IN ('confirmed','orphaned') THEN unixepoch() ELSE confirmed_at END WHERE coin = ?2 AND height = ?3",
            params![status, coin, height as i64],
        )?;
        Ok(())
    }

    /// Whether a coin revenue event was already recorded (idempotency
    /// check for `POST /admin/coin-revenue` retries after restarts).
    pub fn has_coin_revenue(&self, event_id: &str) -> Result<bool> {
        Ok(self.coin_revenue_amount(event_id)?.is_some())
    }

    /// Native amount recorded for a revenue event id, if any.  The oracle
    /// uses this on `duplicate` responses to converge when its observed
    /// delta grew between the original POST and the retry.
    pub fn coin_revenue_amount(&self, event_id: &str) -> Result<Option<u64>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let row = conn
            .query_row(
                "SELECT amount_native FROM coin_revenue WHERE id = ?1",
                params![event_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        row.map(|s| {
            s.parse::<u64>()
                .context("invalid amount_native in coin_revenue")
        })
        .transpose()
    }

    /// Durably create or retrieve a native revenue journal event.
    /// Existing ids keep their original payload so retries cannot mutate an
    /// event that may already have been applied.
    pub fn begin_coin_revenue(
        &self,
        event_id: &str,
        coin: &str,
        amount_native: u64,
        ref_height: u64,
    ) -> Result<CoinRevenueEvent> {
        let ref_height = i64::try_from(ref_height).context("revenue ref_height exceeds i64")?;
        let mut conn = self.conn.lock().expect("share store lock poisoned");
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT OR IGNORE INTO coin_revenue \
             (id, coin, amount_native, ref_height, emitted, emitted_total, status) \
             VALUES (?1, ?2, ?3, ?4, 0, '0', 'pending')",
            params![event_id, coin, amount_native.to_string(), ref_height],
        )?;
        let event = tx.query_row(
            "SELECT id, coin, amount_native, ref_height, emitted, emitted_total, status \
             FROM coin_revenue WHERE id = ?1",
            params![event_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            },
        )?;
        tx.commit()?;
        Ok(CoinRevenueEvent {
            event_id: event.0,
            coin: event.1,
            amount_native: event
                .2
                .parse()
                .context("invalid amount_native in coin_revenue")?,
            ref_height: u64::try_from(event.3).context("negative ref_height in coin_revenue")?,
            emitted: usize::try_from(event.4).context("negative emitted count in coin_revenue")?,
            emitted_total: event
                .5
                .parse()
                .context("invalid emitted_total in coin_revenue")?,
            status: event.6,
        })
    }

    /// Persist the result and payout entries for a prepared journal event.
    /// This is idempotent so startup replay can safely reconstruct an event
    /// if the process stopped before the PPLNS snapshot was written.
    pub fn prepare_coin_revenue(
        &self,
        event_id: &str,
        emitted: usize,
        emitted_total: u64,
        payouts: &[(u64, PayoutEntry)],
    ) -> Result<()> {
        let mut conn = self.conn.lock().expect("share store lock poisoned");
        let tx = conn.transaction()?;
        let status = tx
            .query_row(
                "SELECT status FROM coin_revenue WHERE id = ?1",
                params![event_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .context("coin revenue journal event does not exist")?;
        if status == "committed" {
            tx.commit()?;
            return Ok(());
        }
        if !matches!(status.as_str(), "pending" | "prepared") {
            anyhow::bail!("invalid coin revenue journal status: {status}");
        }

        for (height, payout) in payouts {
            let height_i64 = i64::try_from(*height).context("payout height exceeds i64")?;
            let chain = payout.chain();
            let id = format!("{event_id}:{chain}:{}", payout.miner_id);
            let payout_json = serde_json::to_string(payout)?;
            tx.execute(
                "INSERT OR IGNORE INTO coin_revenue_outbox \
                 (id, event_id, chain, height, payout_json, status) \
                 VALUES (?1, ?2, ?3, ?4, ?5, 'pending')",
                params![id, event_id, chain, height_i64, payout_json],
            )?;
        }
        tx.execute(
            "UPDATE coin_revenue SET emitted = ?2, emitted_total = ?3, status = 'prepared' \
             WHERE id = ?1 AND status IN ('pending', 'prepared')",
            params![
                event_id,
                i64::try_from(emitted).context("emitted count exceeds i64")?,
                emitted_total.to_string()
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// Commit a prepared revenue event after its result has been durably snapshotted.
    pub fn complete_coin_revenue(&self, event_id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let changed = conn.execute(
            "UPDATE coin_revenue SET status = 'committed' \
             WHERE id = ?1 AND status = 'prepared'",
            params![event_id],
        )?;
        if changed == 0 {
            let status = conn
                .query_row(
                    "SELECT status FROM coin_revenue WHERE id = ?1",
                    params![event_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            if status.as_deref() != Some("committed") {
                anyhow::bail!("coin revenue event is missing or not prepared");
            }
        }
        Ok(())
    }

    pub fn pending_coin_revenue(&self) -> Result<Vec<CoinRevenueEvent>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, coin, amount_native, ref_height, emitted, emitted_total, status \
             FROM coin_revenue WHERE status IN ('pending', 'prepared') ORDER BY ts, id",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })?;
        rows.map(|row| {
            let row = row?;
            Ok(CoinRevenueEvent {
                event_id: row.0,
                coin: row.1,
                amount_native: row
                    .2
                    .parse()
                    .context("invalid amount_native in coin_revenue")?,
                ref_height: u64::try_from(row.3).context("negative ref_height in coin_revenue")?,
                emitted: usize::try_from(row.4)
                    .context("negative emitted count in coin_revenue")?,
                emitted_total: row
                    .5
                    .parse()
                    .context("invalid emitted_total in coin_revenue")?,
                status: row.6,
            })
        })
        .collect()
    }

    /// Return pending durable payouts for one chain. Consumers ACK only after
    /// their own idempotent payout ledger has recorded each outbox id.
    pub fn pending_coin_revenue_payouts(&self, chain: &str) -> Result<Vec<CoinRevenuePayout>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT outbox.id, outbox.height, outbox.payout_json \
             FROM coin_revenue_outbox AS outbox \
             JOIN coin_revenue AS event ON event.id = outbox.event_id \
             WHERE outbox.chain = ?1 AND outbox.status = 'pending' \
             AND event.status = 'committed' ORDER BY outbox.created_at, outbox.id",
        )?;
        let rows = stmt.query_map(params![chain], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        rows.map(|row| {
            let row = row?;
            Ok(CoinRevenuePayout {
                id: row.0,
                height: u64::try_from(row.1).context("negative payout height in outbox")?,
                payout: serde_json::from_str(&row.2).context("invalid payout in revenue outbox")?,
            })
        })
        .collect()
    }

    pub fn coin_revenue_outbox_count(&self, event_id: &str) -> Result<usize> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM coin_revenue_outbox WHERE event_id = ?1",
            params![event_id],
            |row| row.get(0),
        )?;
        usize::try_from(count).context("negative outbox row count")
    }

    /// Acknowledge payouts after the downstream ledger has durably recorded
    /// them. Repeated acknowledgements are harmless.
    pub fn ack_coin_revenue_payouts(&self, chain: &str, ids: &[String]) -> Result<usize> {
        let mut conn = self.conn.lock().expect("share store lock poisoned");
        let tx = conn.transaction()?;
        let mut acked = 0;
        for id in ids {
            acked += tx.execute(
                "UPDATE coin_revenue_outbox SET status = 'acked', acked_at = unixepoch() \
                 WHERE id = ?1 AND chain = ?2 AND status = 'pending' \
                 AND EXISTS (SELECT 1 FROM coin_revenue AS event \
                     WHERE event.id = coin_revenue_outbox.event_id \
                     AND event.status = 'committed')",
                params![id, chain],
            )?;
        }
        tx.commit()?;
        Ok(acked)
    }

    /// Record an already-applied legacy revenue event (F3 audit + dedup).
    /// New requests use `begin_coin_revenue` and its prepare/commit lifecycle.
    pub fn record_coin_revenue(
        &self,
        event_id: &str,
        coin: &str,
        amount_native: u64,
        ref_height: u64,
        emitted: usize,
        emitted_total: u64,
    ) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT OR IGNORE INTO coin_revenue \
             (id, coin, amount_native, ref_height, emitted, emitted_total, status) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'committed')",
            params![
                event_id,
                coin,
                amount_native.to_string(),
                ref_height as i64,
                emitted as i64,
                emitted_total.to_string(),
            ],
        )?;
        Ok(())
    }

    /// Get a block record by (coin, height) — the composite key (F2).
    pub fn get_block(&self, coin: &str, height: u64) -> Result<Option<DbBlockRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let row = conn
            .query_row(
                "SELECT coin, height, hash, miner_id, worker_name, share_difficulty, network_difficulty, shares_since_prev, status, ts, confirmed_at
                 FROM blocks WHERE coin = ?1 AND height = ?2",
                params![coin, height as i64],
                |row| {
                    Ok(DbBlockRow {
                        coin: row.get(0)?,
                        height: row.get::<_, i64>(1)? as u64,
                        hash: row.get(2)?,
                        miner_id: row.get(3)?,
                        worker_name: row.get(4)?,
                        share_difficulty: row.get::<_, i64>(5)? as u64,
                        network_difficulty: row.get::<_, i64>(6)? as u64,
                        shares_since_prev: row.get::<_, i64>(7)? as u64,
                        status: row.get(8)?,
                        ts: row.get(9)?,
                        confirmed_at: row.get::<_, Option<i64>>(10)?,
                    })
                },
            )
            .optional()?;
        Ok(row)
    }

    /// Query recent blocks (all coins, newest first).
    pub fn query_blocks(&self, limit: u32) -> Result<Vec<DbBlockRow>> {
        self.query_blocks_inner(None, limit)
    }

    /// Query recent blocks for a single coin (F2 — `/public/v1/blocks?coin=`).
    pub fn query_blocks_for_coin(&self, coin: &str, limit: u32) -> Result<Vec<DbBlockRow>> {
        self.query_blocks_inner(Some(coin), limit)
    }

    fn query_blocks_inner(&self, coin: Option<&str>, limit: u32) -> Result<Vec<DbBlockRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT coin, height, hash, miner_id, worker_name, share_difficulty, network_difficulty, shares_since_prev, status, ts, confirmed_at
             FROM blocks WHERE (?1 IS NULL OR coin = ?1) ORDER BY height DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![coin, limit as i64], |row| {
            Ok(DbBlockRow {
                coin: row.get(0)?,
                height: row.get::<_, i64>(1)? as u64,
                hash: row.get(2)?,
                miner_id: row.get(3)?,
                worker_name: row.get(4)?,
                share_difficulty: row.get::<_, i64>(5)? as u64,
                network_difficulty: row.get::<_, i64>(6)? as u64,
                shares_since_prev: row.get::<_, i64>(7)? as u64,
                status: row.get(8)?,
                ts: row.get(9)?,
                confirmed_at: row.get::<_, Option<i64>>(10)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Read a `pool_state` counter — `None` before the first flush.
    pub fn get_state(&self, key: &str) -> Result<Option<u64>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let v = conn
            .query_row(
                "SELECT value FROM pool_state WHERE key = ?1",
                params![key],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        Ok(v.map(|n| n.max(0) as u64))
    }

    /// Upsert a `pool_state` counter — single-row write, cheap enough to
    /// flush on a short interval (kept off the per-share path).
    pub fn set_state(&self, key: &str, value: u64) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT INTO pool_state (key, value, ts) VALUES (?1, ?2, unixepoch())
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, ts = excluded.ts",
            params![key, value as i64],
        )?;
        Ok(())
    }

    /// Query recent payouts for a miner.
    pub fn query_payouts(&self, miner_id: &str, limit: u32) -> Result<Vec<PayoutRow>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed, coin, superseded_tx_id, inclusion_height
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
                coin: row.get(9)?,
                superseded_tx_id: row.get(10)?,
                inclusion_height: row.get::<_, Option<i64>>(11)?.map(|v| v as u64),
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
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed, coin, superseded_tx_id, inclusion_height
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
                coin: row.get(9)?,
                superseded_tx_id: row.get(10)?,
                inclusion_height: row.get::<_, Option<i64>>(11)?.map(|v| v as u64),
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
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed, coin, superseded_tx_id, inclusion_height
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
                coin: row.get(9)?,
                superseded_tx_id: row.get(10)?,
                inclusion_height: row.get::<_, Option<i64>>(11)?.map(|v| v as u64),
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
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed, coin, superseded_tx_id, inclusion_height
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
                coin: row.get(9)?,
                superseded_tx_id: row.get(10)?,
                inclusion_height: row.get::<_, Option<i64>>(11)?.map(|v| v as u64),
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
            "SELECT ts, miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed, coin, superseded_tx_id, inclusion_height
             FROM payouts WHERE confirmed = 0 AND superseded_tx_id = ''",
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
                coin: row.get(9)?,
                superseded_tx_id: row.get(10)?,
                inclusion_height: row.get::<_, Option<i64>>(11)?.map(|v| v as u64),
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Total payout amount emitted for `coin` since `since_ts` (unix
    /// seconds). Units follow the coin (flowers for zion, native base
    /// units otherwise — same convention as `PayoutRow.amount_flowers`).
    pub fn payouts_amount_sum_since(&self, coin: &str, since_ts: i64) -> Result<u64> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let total: i64 = conn.query_row(
            "SELECT COALESCE(SUM(amount_flowers),0) FROM payouts WHERE coin = ?1 AND ts >= ?2",
            params![coin, since_ts],
            |row| row.get(0),
        )?;
        Ok(total as u64)
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

    // ── Pool history snapshots (schema v4) ─────────────────────────────

    /// Append one history sample. Rows older than `retain_secs` are pruned
    /// in the same call so the table stays bounded at ~24h of 60s samples.
    /// `hashrate_by_coin_json` carries the per-coin pool hashrate map
    /// (`{"zion": 685000.0, "qtu": 3.8e7}`) introduced in schema v6 —
    /// older rows read back as `"{}"`.
    #[allow(clippy::too_many_arguments)]
    pub fn record_history_sample(
        &self,
        ts: u64,
        hashrate: f64,
        miners_online: u64,
        online_by_coin_json: &str,
        hashrate_by_coin_json: &str,
        accepted: u64,
        rejected: u64,
        retain_secs: u64,
    ) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT OR REPLACE INTO history (ts, hashrate, miners_online, online_by_coin, hashrate_by_coin, accepted, rejected)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![ts as i64, hashrate, miners_online as i64, online_by_coin_json, hashrate_by_coin_json, accepted as i64, rejected as i64],
        )?;
        conn.execute(
            "DELETE FROM history WHERE ts < ?1",
            params![ts.saturating_sub(retain_secs) as i64],
        )?;
        Ok(())
    }

    /// Load the newest `limit` history samples, ascending by ts.
    /// Returns `(ts, hashrate, miners_online, online_by_coin_json,
    /// hashrate_by_coin_json, accepted, rejected)`.
    pub fn load_history(
        &self,
        limit: u32,
    ) -> Result<Vec<(u64, f64, u64, String, String, u64, u64)>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT ts, hashrate, miners_online, online_by_coin, hashrate_by_coin, accepted, rejected
             FROM (SELECT * FROM history ORDER BY ts DESC LIMIT ?1) ORDER BY ts ASC",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok((
                row.get::<_, i64>(0)? as u64,
                row.get::<_, f64>(1)?,
                row.get::<_, i64>(2)? as u64,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)? as u64,
                row.get::<_, i64>(6)? as u64,
            ))
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    // ── Per-miner history snapshots (schema v6) ────────────────────────

    /// Append one per-miner hashrate sample. `hps_json` is the miner's
    /// expected-hashes/sec per coin stream (`{"zion": 685e3, "qtu": 38e6}`).
    /// Rows older than `retain_secs` are pruned in the same call.
    pub fn record_miner_history_sample(
        &self,
        miner_id: &str,
        worker: &str,
        ts: u64,
        hps_json: &str,
        accepted: u64,
        rejected: u64,
        retain_secs: u64,
    ) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT OR REPLACE INTO miner_history (miner_id, worker, ts, hps, accepted, rejected)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                miner_id,
                worker,
                ts as i64,
                hps_json,
                accepted as i64,
                rejected as i64
            ],
        )?;
        conn.execute(
            "DELETE FROM miner_history WHERE ts < ?1",
            params![ts.saturating_sub(retain_secs) as i64],
        )?;
        Ok(())
    }

    /// Load per-miner history rows for wallet-scoped aggregation, ascending
    /// by ts. Matches `miner_id` exactly, dotted `miner_id` suffixes
    /// (`wallet.worker` login names), and any extra linked miner ids the
    /// caller resolved (e.g. PPLNS address bindings).
    /// Returns `(miner_id, worker, ts, hps_json, accepted, rejected)`.
    pub fn load_miner_history(
        &self,
        wallet: &str,
        extra_miner_ids: &[String],
        since_ts: u64,
        limit: u32,
    ) -> Result<Vec<(String, String, u64, String, u64, u64)>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        // miner_id = wallet, or starts with "wallet." (login-name workers),
        // or is one of the resolved linked ids. LIKE specials in the wallet
        // are escaped so `w_…` ids can't widen the prefix match.
        let like_prefix = wallet
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_");
        let mut sql = String::from(
            "SELECT miner_id, worker, ts, hps, accepted, rejected FROM miner_history
             WHERE ts >= ?1 AND (miner_id = ?2 OR miner_id LIKE (?3 || '.%') ESCAPE '\\'",
        );
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
            Box::new(since_ts as i64),
            Box::new(wallet.to_string()),
            Box::new(like_prefix),
        ];
        for id in extra_miner_ids {
            sql.push_str(&format!(" OR miner_id = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(id.clone()));
        }
        sql.push_str(") ORDER BY ts ASC LIMIT ?");
        sql.push_str(&(params_vec.len() + 1).to_string());
        params_vec.push(Box::new(limit as i64));

        let params_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)? as u64,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)? as u64,
                row.get::<_, i64>(5)? as u64,
            ))
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    // ── Miner settings + alert subscriptions (schema v10, A2.2/A2.3) ───

    /// Upsert a per-wallet payout threshold override (flowers). `0` clears
    /// the override → the global coin threshold applies again.
    pub fn set_min_payout_override(&self, miner_id: &str, flowers: u64) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        if flowers == 0 {
            conn.execute(
                "DELETE FROM miner_settings WHERE miner_id = ?1",
                params![miner_id],
            )?;
        } else {
            conn.execute(
                "INSERT INTO miner_settings (miner_id, min_payout_flowers, updated_ts)
                 VALUES (?1, ?2, unixepoch())
                 ON CONFLICT(miner_id) DO UPDATE SET
                   min_payout_flowers = excluded.min_payout_flowers,
                   updated_ts = excluded.updated_ts",
                params![miner_id, flowers as i64],
            )?;
        }
        Ok(())
    }

    /// All configured threshold overrides (`miner_id → flowers`), for boot
    /// restore and the public miner payload.
    pub fn load_payout_overrides(&self) -> Result<HashMap<String, u64>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT miner_id, min_payout_flowers FROM miner_settings WHERE min_payout_flowers > 0",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u64))
        })?;
        let mut out = HashMap::new();
        for r in rows {
            let (k, v) = r?;
            out.insert(k, v);
        }
        Ok(out)
    }

    /// Insert or replace an offline-alert subscription. Unique per
    /// (miner_id, worker, channel) — a repeated POST updates target/cadence
    /// in place and keeps the dedup state. Returns the row id.
    pub fn upsert_alert_subscription(
        &self,
        miner_id: &str,
        worker: &str,
        channel: &str,
        target: &str,
        offline_secs: u64,
    ) -> Result<i64> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        // Manual upsert — alert_subscriptions has an AUTOINCREMENT id, so
        // ON CONFLICT would need a UNIQUE index on the triple; a delete+
        // insert inside one lock hold is equally atomic and keeps `state`.
        conn.execute(
            "UPDATE alert_subscriptions SET target = ?4, offline_secs = ?5
             WHERE miner_id = ?1 AND worker = ?2 AND channel = ?3",
            params![miner_id, worker, channel, target, offline_secs as i64],
        )?;
        let mut stmt = conn.prepare(
            "SELECT id FROM alert_subscriptions
             WHERE miner_id = ?1 AND worker = ?2 AND channel = ?3",
        )?;
        if let Some(id) = stmt
            .query_map(params![miner_id, worker, channel], |r| r.get::<_, i64>(0))?
            .next()
        {
            return id.map_err(Into::into);
        }
        drop(stmt);
        conn.execute(
            "INSERT INTO alert_subscriptions (miner_id, worker, channel, target, offline_secs)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![miner_id, worker, channel, target, offline_secs as i64],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Delete a subscription owned by `miner_id` — returns rows removed.
    pub fn delete_alert_subscription(&self, id: i64, miner_id: &str) -> Result<usize> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let n = conn.execute(
            "DELETE FROM alert_subscriptions WHERE id = ?1 AND miner_id = ?2",
            params![id, miner_id],
        )?;
        Ok(n)
    }

    /// Subscriptions for one wallet (account view).
    pub fn list_alert_subscriptions(&self, miner_id: &str) -> Result<Vec<AlertSub>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, miner_id, worker, channel, target, offline_secs, state, last_alert_ts
             FROM alert_subscriptions WHERE miner_id = ?1 ORDER BY id",
        )?;
        let rows = stmt.query_map(params![miner_id], |row| {
            Ok(AlertSub {
                id: row.get(0)?,
                miner_id: row.get(1)?,
                worker: row.get(2)?,
                channel: row.get(3)?,
                target: row.get(4)?,
                offline_secs: row.get::<_, i64>(5)? as u64,
                state: row.get(6)?,
                last_alert_ts: row.get::<_, i64>(7)? as u64,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// All subscriptions — the offline watcher scans these every tick.
    pub fn load_all_alert_subscriptions(&self) -> Result<Vec<AlertSub>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, miner_id, worker, channel, target, offline_secs, state, last_alert_ts
             FROM alert_subscriptions ORDER BY id",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(AlertSub {
                id: row.get(0)?,
                miner_id: row.get(1)?,
                worker: row.get(2)?,
                channel: row.get(3)?,
                target: row.get(4)?,
                offline_secs: row.get::<_, i64>(5)? as u64,
                state: row.get(6)?,
                last_alert_ts: row.get::<_, i64>(7)? as u64,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Mark an alert transition (dedup) — `state` is "offline" or "online".
    pub fn set_alert_state(&self, id: i64, state: &str, ts: u64) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "UPDATE alert_subscriptions SET state = ?2, last_alert_ts = ?3 WHERE id = ?1",
            params![id, state, ts as i64],
        )?;
        Ok(())
    }

    // ── Share dedup marks (schema v7) ──────────────────────────────────

    /// Persist one dedup mark `(bucket, tag)` and prune marks older than
    /// `retain_secs` in the same call. `INSERT OR IGNORE` — a mark that is
    /// already persisted is a no-op.
    ///
    /// Note: hot-path callers should use the [`DedupOp`] queue instead —
    /// two fsync-bound commits per share under `pool.lock()` is what
    /// wedged the API on 2026-10-26. This stays for tests and low-rate
    /// callers.
    pub fn record_dedup_mark(
        &self,
        bucket: &str,
        tag: u64,
        ts: u64,
        retain_secs: u64,
    ) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute(
            "INSERT OR IGNORE INTO share_dedup (bucket, tag, ts) VALUES (?1, ?2, ?3)",
            params![bucket, tag as i64, ts as i64],
        )?;
        conn.execute(
            "DELETE FROM share_dedup WHERE ts < ?1",
            params![ts.saturating_sub(retain_secs) as i64],
        )?;
        Ok(())
    }

    /// Drop every mark in one bucket — called when the in-memory job
    /// bucket is evicted so the table stays proportional to the live set.
    pub fn delete_dedup_bucket(&self, bucket: &str) -> Result<()> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        conn.execute("DELETE FROM share_dedup WHERE bucket = ?1", params![bucket])?;
        Ok(())
    }

    /// Apply a batch of dedup ops in ONE transaction: insert marks +
    /// delete evicted buckets. One commit per batch — called by the
    /// dedup writer thread, never from the share hot path.
    pub fn apply_dedup_ops(
        &self,
        marks: &[(String, u64, u64)],
        delete_buckets: &[String],
    ) -> Result<()> {
        let mut conn = self.conn.lock().expect("share store lock poisoned");
        let tx = conn.transaction()?;
        {
            let mut ins = tx.prepare(
                "INSERT OR IGNORE INTO share_dedup (bucket, tag, ts) VALUES (?1, ?2, ?3)",
            )?;
            for (bucket, tag, ts) in marks {
                ins.execute(params![bucket, *tag as i64, *ts as i64])?;
            }
            let mut del = tx.prepare("DELETE FROM share_dedup WHERE bucket = ?1")?;
            for bucket in delete_buckets {
                del.execute(params![bucket])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Prune marks older than `retain_secs`. The writer thread runs this
    /// on an interval — per-mark pruning inside every insert was wasted
    /// work on the hot path.
    pub fn prune_dedup_marks(&self, retain_secs: u64) -> Result<usize> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let cutoff = crate::telemetry::now_unix_seconds().saturating_sub(retain_secs);
        Ok(conn.execute(
            "DELETE FROM share_dedup WHERE ts < ?1",
            params![cutoff as i64],
        )?)
    }

    /// Load persisted marks for the newest `bucket_limit` buckets (by
    /// newest mark ts), ordered oldest-first within so the caller's FIFO
    /// order survives restore. Returns `(bucket, tag)` rows.
    pub fn load_dedup_marks(
        &self,
        bucket_limit: usize,
        retain_secs: u64,
    ) -> Result<Vec<(String, u64)>> {
        let conn = self.conn.lock().expect("share store lock poisoned");
        let now = crate::telemetry::now_unix_seconds();
        let mut stmt = conn.prepare(
            "SELECT bucket, tag FROM share_dedup
             WHERE ts >= ?1 AND bucket IN (
                 SELECT bucket FROM share_dedup WHERE ts >= ?1
                 GROUP BY bucket ORDER BY MAX(ts) DESC LIMIT ?2
             )
             ORDER BY ts ASC",
        )?;
        let rows = stmt.query_map(
            params![now.saturating_sub(retain_secs) as i64, bucket_limit as i64],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u64)),
        )?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }
}

// ── Async dedup writer ────────────────────────────────────────────────
// 2026-10-26 incident: `record_dedup_mark` ran 2 synchronous commits per
// share INSIDE `pool.lock()` — under disk contention the lock was held
// nearly continuously, /stats starved for ~1h and the wedged process
// needed SIGKILL on shutdown. The queue below moves every dedup write
// off the lock: the share path does a non-blocking try_send; this writer
// batches ops into one transaction and prunes on an interval.

/// One dedup persistence operation queued from the share hot path.
#[derive(Debug)]
pub enum DedupOp {
    /// Fresh `(bucket, tag, ts)` mark accepted by the in-memory set.
    Mark { bucket: String, tag: u64, ts: u64 },
    /// In-memory bucket evicted — drop its persisted marks.
    DeleteBucket { bucket: String },
}

/// Drain `rx` and persist dedup ops in batches. Runs on its own thread;
/// owns an `Arc<ShareStore>` clone so the store outlives the pool.
/// Exits when every sender is dropped (i.e., pool teardown).
pub fn dedup_writer_loop(
    store: std::sync::Arc<ShareStore>,
    rx: std::sync::mpsc::Receiver<DedupOp>,
    retain_secs: u64,
) {
    use std::sync::mpsc::RecvTimeoutError;
    use std::time::{Duration, Instant};

    const FLUSH_MS: u64 = 250;
    const BATCH_CAP: usize = 4096;
    const PRUNE_EVERY: Duration = Duration::from_secs(60);

    let mut last_prune = Instant::now();
    loop {
        // Wait for at least one op, then drain everything queued.
        let first = match rx.recv_timeout(Duration::from_millis(FLUSH_MS)) {
            Ok(op) => Some(op),
            Err(RecvTimeoutError::Timeout) => None,
            Err(RecvTimeoutError::Disconnected) => return,
        };
        let mut marks: Vec<(String, u64, u64)> = Vec::new();
        let mut deletes: Vec<String> = Vec::new();
        if let Some(op) = first {
            match op {
                DedupOp::Mark { bucket, tag, ts } => marks.push((bucket, tag, ts)),
                DedupOp::DeleteBucket { bucket } => deletes.push(bucket),
            }
        }
        while marks.len() + deletes.len() < BATCH_CAP {
            match rx.try_recv() {
                Ok(DedupOp::Mark { bucket, tag, ts }) => marks.push((bucket, tag, ts)),
                Ok(DedupOp::DeleteBucket { bucket }) => deletes.push(bucket),
                Err(_) => break,
            }
        }
        if !marks.is_empty() || !deletes.is_empty() {
            if let Err(e) = store.apply_dedup_ops(&marks, &deletes) {
                tracing::warn!("dedup writer: batch persist failed: {e}");
            }
        }
        if last_prune.elapsed() >= PRUNE_EVERY {
            match store.prune_dedup_marks(retain_secs) {
                Ok(n) if n > 0 => tracing::debug!("dedup writer: pruned {n} marks"),
                Ok(_) => {}
                Err(e) => tracing::warn!("dedup writer: prune failed: {e}"),
            }
            last_prune = Instant::now();
        }
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
    /// Coin the share was mined for (F2).
    pub coin: String,
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
    /// Payout coin — amount units are coin-dependent (F2).
    pub coin: String,
    /// Schema v11: non-empty when this row was voided as a dead/stuck tx
    /// and requeued under a fresh payout (evidence, never resubmitted).
    pub superseded_tx_id: String,
    /// Schema v13: the block the payout tx was mined in (None until
    /// confirmed). `height` stays the rewarded block height.
    pub inclusion_height: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct DbBlockRow {
    /// Coin the block was mined on (F2) — composite key with height.
    pub coin: String,
    pub height: u64,
    pub hash: String,
    pub miner_id: String,
    pub worker_name: String,
    pub share_difficulty: u64,
    pub network_difficulty: u64,
    /// Accepted shares counted since the previous block — luck input
    /// (v8; zero for rows predating the column).
    pub shares_since_prev: u64,
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

#[derive(Debug, Clone)]
pub struct CoinRevenueEvent {
    pub event_id: String,
    pub coin: String,
    pub amount_native: u64,
    pub ref_height: u64,
    pub emitted: usize,
    pub emitted_total: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinRevenuePayout {
    pub id: String,
    pub height: u64,
    pub payout: PayoutEntry,
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
    fn vacuum_into_writes_reopenable_snapshot() {
        let base = std::env::temp_dir().join(format!(
            "zion_pool_vacuum_{}_{}",
            std::process::id(),
            crate::telemetry::now_unix_seconds()
        ));
        let live_path = base.with_extension("db");
        let snap_path = base.with_extension("snapshot.db");
        let _ = std::fs::remove_file(&live_path);
        let _ = std::fs::remove_file(&snap_path);

        let store = ShareStore::open(&live_path).unwrap();
        store
            .record_coin_revenue("qtu:bal:0:100", "qtu", 100, 42, 2, 95)
            .unwrap();

        // Snapshot must reflect committed rows…
        store.vacuum_into(&snap_path).unwrap();
        let snap = ShareStore::open(&snap_path).unwrap();
        assert_eq!(
            snap.coin_revenue_amount("qtu:bal:0:100").unwrap(),
            Some(100)
        );
        drop(snap);

        // …while the live DB keeps accepting writes (WAL not blocked).
        store
            .record_coin_revenue("qtu:bal:0:101", "qtu", 101, 43, 3, 96)
            .unwrap();

        let _ = std::fs::remove_file(&live_path);
        let _ = std::fs::remove_file(live_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(live_path.with_extension("db-shm"));
        let _ = std::fs::remove_file(&snap_path);
        let _ = std::fs::remove_file(snap_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(snap_path.with_extension("db-shm"));
    }

    #[test]
    fn coin_revenue_dedup_is_persistent() {
        let store = ShareStore::open_in_memory().unwrap();
        assert!(!store.has_coin_revenue("qtu:bal:0:100").unwrap());
        assert_eq!(store.coin_revenue_amount("qtu:bal:0:100").unwrap(), None);

        store
            .record_coin_revenue("qtu:bal:0:100", "qtu", 100, 42, 2, 95)
            .unwrap();
        assert!(store.has_coin_revenue("qtu:bal:0:100").unwrap());
        assert_eq!(
            store.coin_revenue_amount("qtu:bal:0:100").unwrap(),
            Some(100)
        );

        // Re-recording the same id is a no-op (INSERT OR IGNORE) — the
        // first distribution's audit row wins.
        store
            .record_coin_revenue("qtu:bal:0:100", "qtu", 999, 43, 9, 999)
            .unwrap();
        assert_eq!(
            store.coin_revenue_amount("qtu:bal:0:100").unwrap(),
            Some(100)
        );
    }

    #[test]
    fn coin_revenue_journal_outbox_and_ack_are_idempotent() {
        let store = ShareStore::open_in_memory().unwrap();
        let event = store
            .begin_coin_revenue("qtu:event:1", "qtu", 500, 42)
            .unwrap();
        assert_eq!(event.status, "pending");
        assert!(store.complete_coin_revenue("qtu:event:1").is_err());

        let payout = PayoutEntry {
            miner_id: "alice/rig".into(),
            address: "qz1alice".into(),
            amount: 500,
            share_count: 4,
            payout_chain: Some("quantus".into()),
            native_units: true,
            coin: Some("qtu".into()),
            revenue_event: Some("qtu:event:1".into()),
        };
        store
            .prepare_coin_revenue("qtu:event:1", 1, 500, &[(42, payout.clone())])
            .unwrap();
        assert_eq!(store.pending_coin_revenue().unwrap()[0].status, "prepared");
        assert!(store
            .pending_coin_revenue_payouts("quantus")
            .unwrap()
            .is_empty());
        store.complete_coin_revenue("qtu:event:1").unwrap();
        let pending = store.pending_coin_revenue_payouts("quantus").unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].height, 42);
        assert_eq!(pending[0].payout, payout);
        assert_eq!(store.coin_revenue_outbox_count("qtu:event:1").unwrap(), 1);

        assert_eq!(
            store
                .ack_coin_revenue_payouts("pearl", std::slice::from_ref(&pending[0].id))
                .unwrap(),
            0
        );
        assert_eq!(
            store
                .ack_coin_revenue_payouts("quantus", std::slice::from_ref(&pending[0].id))
                .unwrap(),
            1
        );
        assert_eq!(
            store
                .ack_coin_revenue_payouts("quantus", std::slice::from_ref(&pending[0].id))
                .unwrap(),
            0
        );
        assert!(store
            .pending_coin_revenue_payouts("quantus")
            .unwrap()
            .is_empty());

        let duplicate = store
            .begin_coin_revenue("qtu:event:1", "prl", 999, 99)
            .unwrap();
        assert_eq!(duplicate.status, "committed");
        assert_eq!(duplicate.coin, "qtu");
        assert_eq!(duplicate.amount_native, 500);
        assert_eq!(duplicate.ref_height, 42);
    }

    #[test]
    fn schema_v4_revenue_rows_migrate_as_committed() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE coin_revenue (
                id TEXT PRIMARY KEY,
                coin TEXT NOT NULL,
                amount_native TEXT NOT NULL,
                ref_height INTEGER NOT NULL DEFAULT 0,
                emitted INTEGER NOT NULL DEFAULT 0,
                emitted_total TEXT NOT NULL DEFAULT '0',
                ts INTEGER NOT NULL DEFAULT (unixepoch())
            );
            CREATE TABLE blocks (
                coin TEXT NOT NULL DEFAULT 'zion',
                height INTEGER NOT NULL,
                hash TEXT NOT NULL,
                miner_id TEXT NOT NULL,
                worker_name TEXT NOT NULL,
                share_difficulty INTEGER NOT NULL DEFAULT 0,
                network_difficulty INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                ts INTEGER NOT NULL DEFAULT (unixepoch()),
                confirmed_at INTEGER,
                PRIMARY KEY (coin, height)
            );
            INSERT INTO coin_revenue (id, coin, amount_native, ref_height)
                VALUES ('qtu:legacy:1', 'qtu', '77', 9);
            PRAGMA user_version = 4;",
        )
        .unwrap();
        let store = ShareStore {
            conn: Mutex::new(conn),
        };

        store.run_migrations().unwrap();
        let legacy = store
            .begin_coin_revenue("qtu:legacy:1", "prl", 999, 100)
            .unwrap();
        assert_eq!(legacy.status, "committed");
        assert_eq!(legacy.coin, "qtu");
        assert_eq!(legacy.amount_native, 77);
        assert!(store
            .pending_coin_revenue_payouts("quantus")
            .unwrap()
            .is_empty());
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
            coin: "zion".to_string(),
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
            coin: "zion".to_string(),
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
            coin: "zion".to_string(),
        };
        store.record_share(&share).unwrap();

        let payout = PayoutRecord {
            miner_id: "m1".to_string(),
            address: "zion1abc".to_string(),
            amount_flowers: 1_000_000,
            tx_id: "tx123".to_string(),
            height: 100,
            block_hash: "hash123".to_string(),
            coin: "zion".to_string(),
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
    fn confirm_payout_with_block_keeps_reward_height() {
        let store = ShareStore::open_in_memory().unwrap();
        let payout = PayoutRecord {
            miner_id: "m1".to_string(),
            address: "zion1abc".to_string(),
            amount_flowers: 1_000_000,
            tx_id: "tx123".to_string(),
            height: 100,
            block_hash: String::new(),
            coin: "zion".to_string(),
        };
        store.record_payout(&payout).unwrap();
        store
            .confirm_payout_with_block("tx123", 12, "blockhash456", 150)
            .unwrap();

        let payouts = store.query_payouts("m1", 10).unwrap();
        assert_eq!(payouts.len(), 1);
        assert!(payouts[0].confirmed);
        assert_eq!(payouts[0].confirmations, 12);
        assert_eq!(payouts[0].block_hash, "blockhash456");
        // v13: `height` stays the rewarded height; the inclusion block goes
        // to `inclusion_height` (previously the two were conflated, which
        // produced phantom duplicate pairs in the exact-amount query).
        assert_eq!(payouts[0].height, 100);
        assert_eq!(payouts[0].inclusion_height, Some(150));
    }

    /// v12→v13: `inclusion_height` is added and backfilled from `height` on
    /// confirmed rows (their original rewarded height was overwritten by the
    /// pre-v13 confirm path and is unrecoverable); pending rows stay NULL.
    #[test]
    fn schema_v13_backfills_inclusion_height() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE payouts (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                ts            INTEGER NOT NULL DEFAULT (unixepoch()),
                miner_id      TEXT NOT NULL,
                address       TEXT NOT NULL,
                amount_flowers INTEGER NOT NULL,
                tx_id         TEXT NOT NULL,
                height        INTEGER NOT NULL,
                block_hash    TEXT NOT NULL,
                confirmations INTEGER NOT NULL DEFAULT 0,
                confirmed     INTEGER NOT NULL DEFAULT 0,
                coin          TEXT NOT NULL DEFAULT 'zion',
                superseded_tx_id TEXT NOT NULL DEFAULT ''
            );
            -- legacy confirmed row: `height` already holds the overwritten
            -- inclusion height (rewarded height lost pre-v13)
            INSERT INTO payouts (miner_id, address, amount_flowers, tx_id, height, block_hash, confirmations, confirmed)
            VALUES ('m1', 'zion1abc', 100, 'tx_confirmed', 99917, 'bh1', 50, 1);
            -- still-pending row keeps its rewarded height, no inclusion yet
            INSERT INTO payouts (miner_id, address, amount_flowers, tx_id, height, block_hash)
            VALUES ('m1', 'zion1abc', 200, 'tx_pending', 69500, '');
            -- voided/superseded pending row
            INSERT INTO payouts (miner_id, address, amount_flowers, tx_id, height, block_hash, superseded_tx_id)
            VALUES ('m1', 'zion1abc', 300, 'tx_voided', 77000, '', 'voided:stuck');
            PRAGMA user_version = 12;",
        )
        .unwrap();
        let store = ShareStore::from_connection_for_test(conn).unwrap();

        let version: u32 = store
            .conn
            .lock()
            .unwrap()
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);

        let rows = store.query_all_payouts(10).unwrap();
        let by_tx = |tx: &str| rows.iter().find(|r| r.tx_id == tx).unwrap();
        let confirmed = by_tx("tx_confirmed");
        assert_eq!(confirmed.height, 99917);
        assert_eq!(confirmed.inclusion_height, Some(99917));
        assert_eq!(by_tx("tx_pending").inclusion_height, None);
        assert_eq!(by_tx("tx_voided").inclusion_height, None);

        // Post-migration confirms keep writing the split fields.
        store
            .confirm_payout_with_block("tx_pending", 10, "bh2", 70001)
            .unwrap();
        let rows = store.query_all_payouts(10).unwrap();
        let pending = rows.iter().find(|r| r.tx_id == "tx_pending").unwrap();
        assert_eq!(pending.height, 69500);
        assert_eq!(pending.inclusion_height, Some(70001));
    }

    /// Regression for the 2.S2 phantom-duplicate finding: two payouts to the
    /// same address for the same amount rewarded at *different* heights and
    /// confirmed in the *same* block must remain distinguishable.
    #[test]
    fn same_amount_payouts_confirmed_in_one_block_stay_distinct() {
        let store = ShareStore::open_in_memory().unwrap();
        for (tx, height) in [("tx_a", 100u64), ("tx_b", 69500)] {
            store
                .record_payout(&PayoutRecord {
                    miner_id: "m1".to_string(),
                    address: "zion1abc".to_string(),
                    amount_flowers: 4_806_059_630,
                    tx_id: tx.to_string(),
                    height,
                    block_hash: String::new(),
                    coin: "zion".to_string(),
                })
                .unwrap();
        }
        store
            .confirm_payout_with_block("tx_a", 5, "bhX", 99917)
            .unwrap();
        store
            .confirm_payout_with_block("tx_b", 5, "bhX", 99917)
            .unwrap();

        let rows = store.query_all_payouts(10).unwrap();
        let a = rows.iter().find(|r| r.tx_id == "tx_a").unwrap();
        let b = rows.iter().find(|r| r.tx_id == "tx_b").unwrap();
        assert_eq!(a.height, 100);
        assert_eq!(b.height, 69500);
        assert_eq!(a.inclusion_height, Some(99917));
        assert_eq!(b.inclusion_height, Some(99917));
    }

    #[test]
    fn void_payout_rows_exits_backlog_and_rolls_back_total_paid() {
        let store = ShareStore::open_in_memory().unwrap();
        let payout = PayoutRecord {
            miner_id: "m1".to_string(),
            address: "zion1abc".to_string(),
            amount_flowers: 1_000_000,
            tx_id: "deadbeef".to_string(),
            height: 100,
            block_hash: String::new(),
            coin: "zion".to_string(),
        };
        store.record_payout(&payout).unwrap();
        assert_eq!(store.query_unconfirmed_payouts().unwrap().len(), 1);

        // Voiding marks the rows superseded: out of the unconfirmed backlog
        // but still present in the ledger as evidence.
        assert_eq!(store.void_payout_rows("deadbeef").unwrap(), 1);
        assert_eq!(store.query_unconfirmed_payouts().unwrap().len(), 0);
        let payouts = store.query_payouts("m1", 10).unwrap();
        assert_eq!(payouts.len(), 1);
        assert!(!payouts[0].confirmed);

        // Miner total_paid is rolled back so the re-queued payment doesn't
        // double-count.
        let miner = store.get_miner_stats("m1").unwrap().unwrap();
        assert_eq!(miner.total_paid_flowers, 0);

        // Idempotent: a second void is a no-op.
        assert_eq!(store.void_payout_rows("deadbeef").unwrap(), 0);
    }

    #[test]
    fn zis_binding_upsert_query_count() {
        let store = ShareStore::open_in_memory().unwrap();
        assert!(store.query_zis_binding("m1").unwrap().is_none());
        assert_eq!(store.count_zis_bindings().unwrap(), 0);

        store.record_zis_binding("m1", "u42").unwrap();
        let (sub, first) = store.query_zis_binding("m1").unwrap().unwrap();
        assert_eq!(sub, "u42");
        assert!(first > 0);
        assert_eq!(store.count_zis_bindings().unwrap(), 1);

        // Rebind keeps first_seen and updates the sub.
        store.record_zis_binding("m1", "u99").unwrap();
        let (sub2, first2) = store.query_zis_binding("m1").unwrap().unwrap();
        assert_eq!(sub2, "u99");
        assert_eq!(first2, first);

        // Empty inputs are a no-op (defensive — never break a login).
        store.record_zis_binding("", "u1").unwrap();
        store.record_zis_binding("m2", "").unwrap();
        assert_eq!(store.count_zis_bindings().unwrap(), 1);
    }

    #[test]
    fn record_and_update_block_status() {
        let store = ShareStore::open_in_memory().unwrap();
        let block = BlockRecord {
            coin: "zion".to_string(),
            height: 200,
            hash: "blockhash".to_string(),
            miner_id: "m1".to_string(),
            worker_name: "w1".to_string(),
            share_difficulty: 5000,
            network_difficulty: 1_000_000,
            shares_since_prev: 42,
            status: "pending".to_string(),
        };
        store.record_block(&block).unwrap();
        store.update_block_status("zion", 200, "confirmed").unwrap();

        let row = store.get_block("zion", 200).unwrap().unwrap();
        assert_eq!(row.status, "confirmed");
        assert!(row.confirmed_at.is_some());

        let blocks = store.query_blocks(10).unwrap();
        assert_eq!(blocks.len(), 1);
    }

    /// 2026-10-26 orphan-race RCA: a losing candidate's `orphaned` write
    /// must never downgrade an already `confirmed` row for the same height,
    /// and a late `confirmed` write must still win (and record the winner's
    /// hash/miner).
    #[test]
    fn block_orphan_write_does_not_downgrade_confirmed() {
        let store = ShareStore::open_in_memory().unwrap();
        let winner = BlockRecord {
            coin: "zion".to_string(),
            height: 300,
            hash: "winner".to_string(),
            miner_id: "m1".to_string(),
            worker_name: "w1".to_string(),
            share_difficulty: 1,
            network_difficulty: 1,
            shares_since_prev: 0,
            status: "confirmed".to_string(),
        };
        store.record_block(&winner).unwrap();
        store
            .record_block(&BlockRecord {
                hash: "loser".to_string(),
                status: "orphaned".to_string(),
                ..winner.clone()
            })
            .unwrap();
        let row = store.get_block("zion", 300).unwrap().unwrap();
        assert_eq!(row.status, "confirmed");
        assert_eq!(row.hash, "winner");

        // Reverse order: orphan first, late confirmed still wins the row.
        store
            .record_block(&BlockRecord {
                height: 301,
                hash: "loser".to_string(),
                status: "orphaned".to_string(),
                ..winner.clone()
            })
            .unwrap();
        store
            .record_block(&BlockRecord {
                height: 301,
                hash: "winner".to_string(),
                miner_id: "m2".to_string(),
                status: "confirmed".to_string(),
                ..winner.clone()
            })
            .unwrap();
        let row = store.get_block("zion", 301).unwrap().unwrap();
        assert_eq!(row.status, "confirmed");
        assert_eq!(row.hash, "winner");
        assert_eq!(row.miner_id, "m2");
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

    /// F2b: a v1-schema database migrates to v2 — existing blocks keep
    /// their data under `coin='zion'` and the rebuilt table's composite
    /// `(coin, height)` key lets other chains reuse the same height.
    #[test]
    fn schema_v1_to_v2_migration_preserves_blocks() {
        let conn = Connection::open_in_memory().unwrap();
        // Build the v1 schema by hand (pre-F2 layout: no coin columns,
        // blocks keyed by height alone).
        conn.execute_batch(
            r#"
            CREATE TABLE shares (
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
            CREATE TABLE payouts (
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
            CREATE TABLE blocks (
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
            CREATE TABLE miners (
                miner_id      TEXT PRIMARY KEY,
                first_seen    INTEGER NOT NULL DEFAULT (unixepoch()),
                last_seen     INTEGER NOT NULL DEFAULT (unixepoch()),
                total_shares  INTEGER NOT NULL DEFAULT 0,
                accepted_shares INTEGER NOT NULL DEFAULT 0,
                rejected_shares INTEGER NOT NULL DEFAULT 0,
                total_paid_flowers INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE worker_stats (
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
        .unwrap();
        conn.execute(
            "INSERT INTO blocks (height, hash, miner_id, worker_name, share_difficulty, network_difficulty, status)
             VALUES (42, 'v1hash', 'm1', 'w1', 100, 200, 'confirmed')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO shares (miner_id, worker_name, job_id, nonce, hash_hex, height, accepted, share_difficulty, network_difficulty, is_block, source)
             VALUES ('m1', 'w1', 1, 7, 'hh', 42, 1, 5, 9, 0, 'zion')",
            [],
        )
        .unwrap();
        conn.pragma_update(None, "user_version", 1u32).unwrap();

        let store = ShareStore {
            conn: Mutex::new(conn),
        };
        store.run_migrations().unwrap();

        // Version bumped to current schema.
        let version: u32 = store
            .conn
            .lock()
            .unwrap()
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);

        // Legacy block migrated under coin='zion'.
        let row = store.get_block("zion", 42).unwrap().unwrap();
        assert_eq!(row.hash, "v1hash");
        assert_eq!(row.status, "confirmed");

        // Legacy share carries the default coin tag.
        let shares = store.query_shares("m1", 10).unwrap();
        assert_eq!(shares.len(), 1);
        assert_eq!(shares[0].coin, "zion");

        // Same height on a different coin coexists (composite PK).
        store
            .record_block(&BlockRecord {
                coin: "qtu".to_string(),
                height: 42,
                hash: "qtuh".to_string(),
                miner_id: "m2".to_string(),
                worker_name: "w2".to_string(),
                share_difficulty: 1,
                network_difficulty: 1,
                shares_since_prev: 0,
                status: "pending".to_string(),
            })
            .unwrap();
        assert_eq!(store.get_block("qtu", 42).unwrap().unwrap().hash, "qtuh");
        // ZION-side lookup unaffected.
        store.update_block_status("zion", 42, "orphaned").unwrap();
        assert_eq!(
            store.get_block("zion", 42).unwrap().unwrap().status,
            "orphaned"
        );
        assert_eq!(
            store.get_block("qtu", 42).unwrap().unwrap().status,
            "pending"
        );
    }
}

#[cfg(test)]
mod history_tests {
    use super::{BlockRecord, ShareStore};
    use rusqlite::Connection;

    #[test]
    fn history_sample_roundtrip_and_retention() {
        let store = ShareStore::open_in_memory().unwrap();
        store
            .record_history_sample(
                1000,
                250.5,
                3,
                r#"{"zion":3}"#,
                r#"{"zion":2.5e5}"#,
                10,
                1,
                86400,
            )
            .unwrap();
        store
            .record_history_sample(
                2000,
                300.0,
                4,
                r#"{"zion":4,"qtu":1}"#,
                r#"{"zion":3e5,"qtu":1e7}"#,
                20,
                2,
                86400,
            )
            .unwrap();
        let rows = store.load_history(10).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].0, 1000);
        assert_eq!(rows[1].0, 2000);
        assert_eq!(rows[1].2, 4);
        assert!(rows[1].3.contains("qtu"));
        assert!(rows[1].4.contains("qtu"), "hashrate_by_coin roundtrip");

        // Retention: a new sample at ts=90000 prunes rows older than 3600s.
        store
            .record_history_sample(90000, 1.0, 1, "{}", "{}", 30, 3, 3600)
            .unwrap();
        let rows = store.load_history(10).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, 90000);
    }

    #[test]
    fn miner_history_wallet_scoped_roundtrip() {
        let store = ShareStore::open_in_memory().unwrap();
        // Two workers on the wallet + one foreign miner + one linked-id row.
        store
            .record_miner_history_sample("w_wallet", "rig1", 1000, r#"{"qtu":1e6}"#, 5, 0, 86400)
            .unwrap();
        store
            .record_miner_history_sample(
                "w_wallet.rig2",
                "rig2",
                1000,
                r#"{"qtu":2e6}"#,
                3,
                1,
                86400,
            )
            .unwrap();
        store
            .record_miner_history_sample("other_miner", "rig9", 1000, r#"{"qtu":9e9}"#, 7, 0, 86400)
            .unwrap();
        store
            .record_miner_history_sample(
                "linked-login",
                "rig3",
                1000,
                r#"{"qtu":4e6}"#,
                2,
                0,
                86400,
            )
            .unwrap();

        // Wallet match: own rows + dotted login + explicit linked id.
        let rows = store
            .load_miner_history("w_wallet", &["linked-login".to_string()], 0, 100)
            .unwrap();
        assert_eq!(rows.len(), 3, "foreign miner excluded");
        assert!(rows.iter().all(|r| r.0 != "other_miner"));

        // Prefix match alone (no linked id) — "other_miner" still out.
        let rows = store.load_miner_history("w_wallet", &[], 0, 100).unwrap();
        assert_eq!(rows.len(), 2);

        // since_ts filter.
        let rows = store
            .load_miner_history("w_wallet", &[], 1001, 100)
            .unwrap();
        assert_eq!(rows.len(), 0);

        // Retention: ts=90000 prunes everything older than 3600s back.
        store
            .record_miner_history_sample("w_wallet", "rig1", 90000, "{}", 9, 0, 3600)
            .unwrap();
        let rows = store.load_miner_history("w_wallet", &[], 0, 100).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].2, 90000);
    }

    #[test]
    fn share_dedup_roundtrip_evict_and_prune() {
        let store = ShareStore::open_in_memory().unwrap();
        let now = crate::telemetry::now_unix_seconds();
        store.record_dedup_mark("zion_1", 11, now, 86400).unwrap();
        store.record_dedup_mark("zion_1", 22, now, 86400).unwrap();
        store
            .record_dedup_mark("ext:qtu:job-9", 33, now, 86400)
            .unwrap();
        // Duplicate insert is a no-op.
        store.record_dedup_mark("zion_1", 11, now, 86400).unwrap();

        let rows = store.load_dedup_marks(512, 86400).unwrap();
        assert_eq!(rows.len(), 3);
        assert!(rows.contains(&("zion_1".to_string(), 11)));
        assert!(rows.contains(&("ext:qtu:job-9".to_string(), 33)));

        // Bucket evict drops only that bucket's marks.
        store.delete_dedup_bucket("zion_1").unwrap();
        let rows = store.load_dedup_marks(512, 86400).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, "ext:qtu:job-9");

        // Retention: marks older than retain are neither restored nor kept.
        store
            .record_dedup_mark("old", 99, now.saturating_sub(90000), 3600)
            .unwrap();
        store.record_dedup_mark("fresh", 1, now, 3600).unwrap();
        let rows = store.load_dedup_marks(512, 3600).unwrap();
        assert!(rows.iter().all(|(b, _)| b != "old"));
    }

    /// v8: `shares_since_prev` round-trips through `record_block` /
    /// `query_blocks`, and an existing row keeps its value when a status
    /// update lands with the zero default (sticky-confirmed path).
    #[test]
    fn block_shares_since_prev_persists() {
        let store = ShareStore::open_in_memory().unwrap();
        store
            .record_block(&BlockRecord {
                coin: "zion".to_string(),
                height: 500,
                hash: "h".to_string(),
                miner_id: "m1".to_string(),
                worker_name: "w1".to_string(),
                share_difficulty: 1,
                network_difficulty: 1,
                shares_since_prev: 777,
                status: "confirmed".to_string(),
            })
            .unwrap();
        let row = store.query_blocks_for_coin("zion", 1).unwrap()[0].clone();
        assert_eq!(row.shares_since_prev, 777);
    }

    /// v8 migration: a pre-v8 blocks table gains `shares_since_prev`
    /// without data loss.
    #[test]
    fn schema_v8_migration_adds_shares_since_prev() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE blocks (
                coin TEXT NOT NULL DEFAULT 'zion',
                height INTEGER NOT NULL,
                hash TEXT NOT NULL,
                miner_id TEXT NOT NULL,
                worker_name TEXT NOT NULL,
                share_difficulty INTEGER NOT NULL DEFAULT 0,
                network_difficulty INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                ts INTEGER NOT NULL DEFAULT (unixepoch()),
                confirmed_at INTEGER,
                PRIMARY KEY (coin, height)
            );
            INSERT INTO blocks (coin, height, hash, miner_id, worker_name, status)
            VALUES ('zion', 42, 'old', 'm', 'w', 'confirmed');
            PRAGMA user_version = 7;",
        )
        .unwrap();
        let store = ShareStore::from_connection_for_test(conn).unwrap();
        let row = store.query_blocks_for_coin("zion", 1).unwrap()[0].clone();
        assert_eq!(row.shares_since_prev, 0);
        assert_eq!(row.status, "confirmed");
        assert_eq!(row.height, 42);
    }

    /// v9 `pool_state` kv: round-trip, overwrite, missing-key.
    #[test]
    fn pool_state_counter_roundtrips() {
        let store = ShareStore::open_in_memory().unwrap();
        assert_eq!(store.get_state("shares_since_last_block").unwrap(), None);
        store.set_state("shares_since_last_block", 55).unwrap();
        assert_eq!(
            store.get_state("shares_since_last_block").unwrap(),
            Some(55)
        );
        store.set_state("shares_since_last_block", 0).unwrap();
        assert_eq!(store.get_state("shares_since_last_block").unwrap(), Some(0));
        assert_eq!(store.get_state("other_key").unwrap(), None);
    }

    /// v9→v10: migration must create `miner_settings` +
    /// `alert_subscriptions` on an existing v9 database (A2.2/A2.3).
    #[test]
    fn v10_migration_creates_settings_and_alert_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE pool_state (
                key TEXT PRIMARY KEY,
                value INTEGER NOT NULL
            );
            PRAGMA user_version = 9;",
        )
        .unwrap();
        let store = ShareStore::from_connection_for_test(conn).unwrap();
        // Tables usable → migration ran (methods would fail otherwise).
        store.set_min_payout_override("w1", 42).unwrap();
        store
            .upsert_alert_subscription("w1", "rig", "webhook", "https://h.ex/x", 60)
            .unwrap();
    }

    /// A2.3: per-wallet payout override round-trip — set, load, clear.
    #[test]
    fn payout_override_crud_roundtrip() {
        let store = ShareStore::open_in_memory().unwrap();
        assert!(store.load_payout_overrides().unwrap().is_empty());
        store.set_min_payout_override("zion1a", 5_000_000).unwrap();
        store.set_min_payout_override("zion1b", 7_000_000).unwrap();
        let m = store.load_payout_overrides().unwrap();
        assert_eq!(m.get("zion1a"), Some(&5_000_000));
        assert_eq!(m.get("zion1b"), Some(&7_000_000));
        // Overwrite + clear (0 deletes the row).
        store.set_min_payout_override("zion1a", 9).unwrap();
        store.set_min_payout_override("zion1b", 0).unwrap();
        let m = store.load_payout_overrides().unwrap();
        assert_eq!(m.get("zion1a"), Some(&9));
        assert!(!m.contains_key("zion1b"));
    }

    /// A2.2: alert subscription upsert (keyed by wallet+worker+channel),
    /// scoped delete, and persisted state transitions for dedup.
    #[test]
    fn alert_subscription_crud_and_state() {
        let store = ShareStore::open_in_memory().unwrap();
        let id1 = store
            .upsert_alert_subscription("w1", "rigA", "webhook", "https://a", 120)
            .unwrap();
        let id2 = store
            .upsert_alert_subscription("w1", "", "telegram", "-123", 600)
            .unwrap();
        store
            .upsert_alert_subscription("w2", "rigA", "webhook", "https://b", 300)
            .unwrap();
        // Re-upsert same key → same id, updated fields.
        let again = store
            .upsert_alert_subscription("w1", "rigA", "webhook", "https://a2", 90)
            .unwrap();
        assert_eq!(again, id1);

        let subs = store.list_alert_subscriptions("w1").unwrap();
        assert_eq!(subs.len(), 2);
        let s1 = subs.iter().find(|s| s.id == id1).unwrap();
        assert_eq!(s1.target, "https://a2");
        assert_eq!(s1.offline_secs, 90);
        assert_eq!(s1.state, "online");

        // All-subs load (watcher path) sees every wallet.
        assert_eq!(store.load_all_alert_subscriptions().unwrap().len(), 3);

        // State transition persists (dedup key).
        store.set_alert_state(id1, "offline", 111).unwrap();
        let s1 = store
            .list_alert_subscriptions("w1")
            .unwrap()
            .into_iter()
            .find(|s| s.id == id1)
            .unwrap();
        assert_eq!(s1.state, "offline");
        assert_eq!(s1.last_alert_ts, 111);

        // Scoped delete — wrong wallet cannot remove the row.
        assert_eq!(store.delete_alert_subscription(id2, "w2").unwrap(), 0);
        assert_eq!(store.delete_alert_subscription(id2, "w1").unwrap(), 1);
        assert_eq!(store.list_alert_subscriptions("w1").unwrap().len(), 1);
    }
}
