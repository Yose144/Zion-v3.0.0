//! SQLite persistence for zion-free-world.

use crate::error::FreeWorldResult;
use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub struct FreeWorldDb {
    conn: Connection,
}

impl FreeWorldDb {
    pub fn open(path: &str) -> FreeWorldResult<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> FreeWorldResult<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS grants (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                applicant_name TEXT,
                applicant_address TEXT,
                category TEXT NOT NULL,
                amount_zion INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                reviewed_at TEXT,
                reviewer_notes TEXT,
                dao_proposal_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                location TEXT,
                category TEXT NOT NULL,
                budget_zion INTEGER NOT NULL,
                spent_zion INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'planning',
                started_at TEXT,
                completed_at TEXT,
                impact_metrics TEXT
            );

            CREATE TABLE IF NOT EXISTS communities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT,
                population INTEGER,
                energy_source TEXT,
                zion_address TEXT,
                status TEXT NOT NULL DEFAULT 'forming',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS fund_balance (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_accumulated INTEGER NOT NULL DEFAULT 0,
                total_disbursed INTEGER NOT NULL DEFAULT 0,
                last_block_height INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            INSERT OR IGNORE INTO fund_balance (id, total_accumulated, total_disbursed, last_block_height, updated_at)
            VALUES (1, 0, 0, 0, datetime('now'));

            CREATE TABLE IF NOT EXISTS qv_rounds (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                credits_per_voter INTEGER NOT NULL,
                matching_pool_zion INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL,
                opened_at TEXT,
                closed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS qv_round_grants (
                round_id TEXT NOT NULL,
                grant_id TEXT NOT NULL,
                PRIMARY KEY(round_id, grant_id)
            );

            CREATE TABLE IF NOT EXISTS qv_ballots (
                round_id TEXT NOT NULL,
                voter_id TEXT NOT NULL,
                votes_json TEXT NOT NULL,
                credits_spent INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(round_id, voter_id)
            );

            CREATE TABLE IF NOT EXISTS qv_results (
                round_id TEXT PRIMARY KEY,
                results_json TEXT NOT NULL,
                closed_at TEXT NOT NULL
            );"
        )?;

        // Migration: older DBs lack grants.dao_proposal_id — add it.
        self.ensure_column(
            "grants",
            "dao_proposal_id",
            "ALTER TABLE grants ADD COLUMN dao_proposal_id INTEGER",
        )?;
        Ok(())
    }

    /// Idempotent column add: runs `alter_sql` only when `column` is absent
    /// from `PRAGMA table_info(table)`.
    fn ensure_column(&self, table: &str, column: &str, alter_sql: &str) -> FreeWorldResult<()> {
        let mut stmt = self.conn.prepare(&format!("PRAGMA table_info({table})"))?;
        let exists = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .any(|name| name.map(|n| n == column).unwrap_or(false));
        if !exists {
            self.conn.execute_batch(alter_sql)?;
        }
        Ok(())
    }

    // ── Grants ──

    pub fn insert_grant(&self, g: &GrantRecord) -> FreeWorldResult<()> {
        self.conn.execute(
            "INSERT INTO grants (id, title, description, applicant_name, applicant_address, category, amount_zion, status, created_at, dao_proposal_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (&g.id, &g.title, &g.description, &g.applicant_name, &g.applicant_address,
             &g.category, &g.amount_zion, &g.status, &g.created_at.to_rfc3339(), &g.dao_proposal_id),
        )?;
        Ok(())
    }

    pub fn list_grants(&self, status: Option<&str>) -> FreeWorldResult<Vec<GrantRecord>> {
        let sql = match status {
            Some(_s) => "SELECT id, title, description, applicant_name, applicant_address, category, amount_zion, status, created_at, reviewed_at, reviewer_notes, dao_proposal_id FROM grants WHERE status = ?1 ORDER BY created_at DESC",
            None => "SELECT id, title, description, applicant_name, applicant_address, category, amount_zion, status, created_at, reviewed_at, reviewer_notes, dao_proposal_id FROM grants ORDER BY created_at DESC",
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = match status {
            Some(s) => stmt.query_map([s], row_to_grant)?,
            None => stmt.query_map([], row_to_grant)?,
        };
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn update_grant_status(
        &self,
        id: &str,
        status: &str,
        notes: Option<&str>,
    ) -> FreeWorldResult<()> {
        let reviewed = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE grants SET status = ?1, reviewed_at = ?2, reviewer_notes = ?3 WHERE id = ?4",
            (status, &reviewed, notes, id),
        )?;
        Ok(())
    }

    /// Record the DAO proposal a grant was submitted as and move it to
    /// `on_dao`. Returns the number of rows updated (0 = unknown grant).
    pub fn set_grant_dao_proposal(&self, id: &str, proposal_id: u64) -> FreeWorldResult<usize> {
        let reviewed = Utc::now().to_rfc3339();
        let n = self.conn.execute(
            "UPDATE grants SET status = 'on_dao', dao_proposal_id = ?1, reviewed_at = ?2 WHERE id = ?3",
            (proposal_id, &reviewed, id),
        )?;
        Ok(n)
    }

    /// Grant counts grouped by status — used to hydrate the Prometheus
    /// gauges so they reflect the DB, not just in-process events.
    pub fn grant_status_counts(&self) -> FreeWorldResult<Vec<(String, u64)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT status, COUNT(*) FROM grants GROUP BY status")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u64>(1)?))
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn project_status_counts(&self) -> FreeWorldResult<Vec<(String, u64)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT status, COUNT(*) FROM projects GROUP BY status")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u64>(1)?))
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn get_grant(&self, id: &str) -> FreeWorldResult<Option<GrantRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, description, applicant_name, applicant_address, category, amount_zion, status, created_at, reviewed_at, reviewer_notes, dao_proposal_id FROM grants WHERE id = ?1",
        )?;
        let row = stmt.query_row([id], row_to_grant).optional()?;
        Ok(row)
    }

    // ── Projects ──

    pub fn insert_project(&self, p: &ProjectRecord) -> FreeWorldResult<()> {
        self.conn.execute(
            "INSERT INTO projects (id, name, description, location, category, budget_zion, status, started_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (&p.id, &p.name, &p.description, &p.location, &p.category, &p.budget_zion, &p.status, &p.started_at.map(|t| t.to_rfc3339())),
        )?;
        Ok(())
    }

    pub fn list_projects(&self, status: Option<&str>) -> FreeWorldResult<Vec<ProjectRecord>> {
        let sql = match status {
            Some(_s) => "SELECT id, name, description, location, category, budget_zion, spent_zion, status, started_at, completed_at, impact_metrics FROM projects WHERE status = ?1 ORDER BY started_at DESC",
            None => "SELECT id, name, description, location, category, budget_zion, spent_zion, status, started_at, completed_at, impact_metrics FROM projects ORDER BY started_at DESC",
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = match status {
            Some(s) => stmt.query_map([s], row_to_project)?,
            None => stmt.query_map([], row_to_project)?,
        };
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    // ── Fund balance ──

    pub fn get_fund_balance(&self) -> FreeWorldResult<FundBalance> {
        let mut stmt = self.conn.prepare(
            "SELECT total_accumulated, total_disbursed, last_block_height, updated_at FROM fund_balance WHERE id = 1"
        )?;
        let row = stmt
            .query_row([], |row| {
                Ok(FundBalance {
                    total_accumulated: row.get(0)?,
                    total_disbursed: row.get(1)?,
                    last_block_height: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .optional()?;
        Ok(row.unwrap_or_default())
    }

    pub fn update_fund_balance(&self, balance: &FundBalance) -> FreeWorldResult<()> {
        self.conn.execute(
            "UPDATE fund_balance SET total_accumulated = ?1, total_disbursed = ?2, last_block_height = ?3, updated_at = ?4 WHERE id = 1",
            (&balance.total_accumulated, &balance.total_disbursed, &balance.last_block_height, &balance.updated_at),
        )?;
        Ok(())
    }

    // ── Quadratic voting rounds ──
    //
    // Status check + write always run inside ONE SQLite transaction so a
    // ballot upsert can never interleave with a close (and close writes
    // status + results together).

    pub fn qv_create_round(
        &mut self,
        round: &QvRoundRecord,
        grant_ids: &[String],
    ) -> FreeWorldResult<()> {
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO qv_rounds (id, title, credits_per_voter, matching_pool_zion, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                &round.id,
                &round.title,
                round.credits_per_voter,
                round.matching_pool_zion,
                &round.status,
                &round.created_at,
            ),
        )?;
        for gid in grant_ids {
            tx.execute(
                "INSERT INTO qv_round_grants (round_id, grant_id) VALUES (?1, ?2)",
                (&round.id, gid),
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn qv_get_round(&self, id: &str) -> FreeWorldResult<Option<QvRoundRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, credits_per_voter, matching_pool_zion, status, created_at, opened_at, closed_at
             FROM qv_rounds WHERE id = ?1",
        )?;
        let row = stmt.query_row([id], row_to_qv_round).optional()?;
        Ok(row)
    }

    /// All rounds with their ballot counts, newest first.
    pub fn qv_list_rounds(&self) -> FreeWorldResult<Vec<(QvRoundRecord, u64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT r.id, r.title, r.credits_per_voter, r.matching_pool_zion, r.status,
                    r.created_at, r.opened_at, r.closed_at,
                    (SELECT COUNT(*) FROM qv_ballots b WHERE b.round_id = r.id) AS ballot_count
             FROM qv_rounds r ORDER BY r.created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| Ok((row_to_qv_round(row)?, row.get::<_, u64>(8)?)))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Grant ids participating in a round (sorted).
    pub fn qv_round_grant_ids(&self, round_id: &str) -> FreeWorldResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT grant_id FROM qv_round_grants WHERE round_id = ?1 ORDER BY grant_id",
        )?;
        let rows = stmt.query_map([round_id], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn qv_ballot_count(&self, round_id: &str) -> FreeWorldResult<u64> {
        let count = self.conn.query_row(
            "SELECT COUNT(*) FROM qv_ballots WHERE round_id = ?1",
            [round_id],
            |row| row.get::<_, u64>(0),
        )?;
        Ok(count)
    }

    /// All stored ballots for a round (voter_id, votes_json, credits_spent).
    /// Callers must not expose voter_ids publicly.
    pub fn qv_ballots(&self, round_id: &str) -> FreeWorldResult<Vec<QvBallotRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT voter_id, votes_json, credits_spent FROM qv_ballots
             WHERE round_id = ?1 ORDER BY voter_id",
        )?;
        let rows = stmt.query_map([round_id], |row| {
            Ok(QvBallotRow {
                voter_id: row.get(0)?,
                votes_json: row.get(1)?,
                credits_spent: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Transition a round draft → open. The status check and the write
    /// happen inside one transaction.
    pub fn qv_open_round(&mut self, id: &str, opened_at: &str) -> FreeWorldResult<QvTransition> {
        let tx = self.conn.transaction()?;
        let outcome = match qv_round_status(&tx, id)? {
            None => QvTransition::NotFound,
            Some(status) if status == "draft" => {
                tx.execute(
                    "UPDATE qv_rounds SET status = 'open', opened_at = ?1 WHERE id = ?2 AND status = 'draft'",
                    (opened_at, id),
                )?;
                QvTransition::Done
            }
            Some(_) => QvTransition::Conflict,
        };
        tx.commit()?;
        Ok(outcome)
    }

    /// Insert or replace a voter's ballot iff the round is currently open.
    /// Status check + upsert happen inside one transaction.
    pub fn qv_upsert_ballot(
        &mut self,
        round_id: &str,
        voter_id: &str,
        votes_json: &str,
        credits_spent: u64,
        updated_at: &str,
    ) -> FreeWorldResult<QvBallotStore> {
        let tx = self.conn.transaction()?;
        let outcome = match qv_round_status(&tx, round_id)? {
            None => QvBallotStore::NotFound,
            Some(status) if status == "open" => {
                tx.execute(
                    "INSERT INTO qv_ballots (round_id, voter_id, votes_json, credits_spent, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(round_id, voter_id) DO UPDATE SET
                        votes_json = excluded.votes_json,
                        credits_spent = excluded.credits_spent,
                        updated_at = excluded.updated_at",
                    (round_id, voter_id, votes_json, credits_spent, updated_at),
                )?;
                QvBallotStore::Stored
            }
            Some(_) => QvBallotStore::NotOpen,
        };
        tx.commit()?;
        Ok(outcome)
    }

    /// Transition a round open → closed and persist the frozen results in
    /// the same transaction.
    pub fn qv_close_round(
        &mut self,
        round_id: &str,
        results_json: &str,
        closed_at: &str,
    ) -> FreeWorldResult<QvTransition> {
        let tx = self.conn.transaction()?;
        let outcome = match qv_round_status(&tx, round_id)? {
            None => QvTransition::NotFound,
            Some(status) if status == "open" => {
                tx.execute(
                    "UPDATE qv_rounds SET status = 'closed', closed_at = ?1 WHERE id = ?2 AND status = 'open'",
                    (closed_at, round_id),
                )?;
                tx.execute(
                    "INSERT INTO qv_results (round_id, results_json, closed_at) VALUES (?1, ?2, ?3)",
                    (round_id, results_json, closed_at),
                )?;
                QvTransition::Done
            }
            Some(_) => QvTransition::Conflict,
        };
        tx.commit()?;
        Ok(outcome)
    }

    /// Frozen results JSON for a closed round.
    pub fn qv_results(&self, round_id: &str) -> FreeWorldResult<Option<String>> {
        let row = self
            .conn
            .query_row(
                "SELECT results_json FROM qv_results WHERE round_id = ?1",
                [round_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        Ok(row)
    }
}

fn qv_round_status(conn: &Connection, id: &str) -> FreeWorldResult<Option<String>> {
    let status = conn
        .query_row("SELECT status FROM qv_rounds WHERE id = ?1", [id], |row| {
            row.get::<_, String>(0)
        })
        .optional()?;
    Ok(status)
}

fn row_to_qv_round(row: &rusqlite::Row) -> Result<QvRoundRecord, rusqlite::Error> {
    Ok(QvRoundRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        credits_per_voter: row.get(2)?,
        matching_pool_zion: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
        opened_at: row.get(6)?,
        closed_at: row.get(7)?,
    })
}

/// A quadratic voting round. Status: draft | open | closed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QvRoundRecord {
    pub id: String,
    pub title: String,
    pub credits_per_voter: u64,
    pub matching_pool_zion: u64,
    pub status: String,
    pub created_at: String,
    pub opened_at: Option<String>,
    pub closed_at: Option<String>,
}

/// A stored ballot row (internal — never serialize voter_id publicly).
#[derive(Debug, Clone)]
pub struct QvBallotRow {
    pub voter_id: String,
    pub votes_json: String,
    pub credits_spent: u64,
}

/// Result of a guarded status transition (open / close).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QvTransition {
    Done,
    NotFound,
    Conflict,
}

/// Result of an atomic ballot upsert.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QvBallotStore {
    Stored,
    NotOpen,
    NotFound,
}

fn row_to_grant(row: &rusqlite::Row) -> Result<GrantRecord, rusqlite::Error> {
    Ok(GrantRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        applicant_name: row.get(3)?,
        applicant_address: row.get(4)?,
        category: row.get(5)?,
        amount_zion: row.get(6)?,
        status: row.get(7)?,
        created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        reviewed_at: row
            .get::<_, Option<String>>(9)?
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        reviewer_notes: row.get(10)?,
        dao_proposal_id: row.get(11)?,
    })
}

fn row_to_project(row: &rusqlite::Row) -> Result<ProjectRecord, rusqlite::Error> {
    Ok(ProjectRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        location: row.get(3)?,
        category: row.get(4)?,
        budget_zion: row.get(5)?,
        spent_zion: row.get(6)?,
        status: row.get(7)?,
        started_at: row
            .get::<_, Option<String>>(8)?
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        completed_at: row
            .get::<_, Option<String>>(9)?
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        impact_metrics: row.get(10)?,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantRecord {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub applicant_name: Option<String>,
    pub applicant_address: Option<String>,
    pub category: String, // humanitarian | energy | education | community
    /// Requested amount in flowers (1e-6 ZION) — L5 `*_zion` convention.
    pub amount_zion: u64,
    pub status: String, // pending | under_review | approved | on_dao | rejected | disbursed
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewer_notes: Option<String>,
    /// DAO proposal id once the grant was submitted to governance.
    pub dao_proposal_id: Option<u64>,
}

impl GrantRecord {
    pub fn new(title: &str, category: &str, amount: u64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            description: None,
            applicant_name: None,
            applicant_address: None,
            category: category.to_string(),
            amount_zion: amount,
            status: "pending".to_string(),
            created_at: Utc::now(),
            reviewed_at: None,
            reviewer_notes: None,
            dao_proposal_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub category: String,
    pub budget_zion: u64,
    pub spent_zion: u64,
    pub status: String, // planning | active | completed | cancelled
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub impact_metrics: Option<String>,
}

impl ProjectRecord {
    pub fn new(name: &str, category: &str, budget: u64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            description: None,
            location: None,
            category: category.to_string(),
            budget_zion: budget,
            spent_zion: 0,
            status: "planning".to_string(),
            started_at: None,
            completed_at: None,
            impact_metrics: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FundBalance {
    pub total_accumulated: u64,
    pub total_disbursed: u64,
    pub last_block_height: u64,
    pub updated_at: String,
}
