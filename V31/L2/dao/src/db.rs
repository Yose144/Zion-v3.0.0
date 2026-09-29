//! DAO SQLite Persistence Layer
//!
//! Stores all DAO state to disk — proposals, votes, treasury operations, scanner
//! cursor. Designed for single-writer, multi-reader access (Tokio + rusqlite).
//!
//! ## Schema
//!
//! ```text
//! proposals  — canonical proposal state (JSON blob for flexible ProposalType)
//! votes      — one row per (proposal_id, voter_address), deduplicated
//! treasury   — pending + executed treasury operations
//! scan_state — last scanned L1 block height (singleton row)
//! ```

use std::collections::BTreeMap;
use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json;

use crate::error::{DaoError, DaoResult};
use crate::proposal::{Proposal, ProposalStatus, ProposalType};
use crate::treasury::TreasuryOperation;
use crate::types::VoteChoice;
use crate::voting::Vote;

// ─────────────────────────────────────────────────────────────────────────────

pub struct DaoDb {
    conn: Connection,
}

/// A persisted treasury multisig operation.
#[derive(Debug, Clone)]
pub struct TreasuryOpRow {
    pub op_id: String,
    pub proposal_id: Option<u64>,
    pub operation: String, // JSON-encoded TreasuryOperation
    pub submitted_by: String,
    pub status: String,
    pub created_at: String,
    pub executed_at: Option<String>,
    pub unsigned_tx: Option<String>,
    pub signing_hash: Option<String>,
    pub tx_id: Option<String>,
}

/// A guardian signature row — may be a verified crypto signature or a
/// legacy audit-only record (`signature`/`pubkey` NULL, `verified=false`).
#[derive(Debug, Clone)]
pub struct TreasurySigRow {
    pub guardian: String,
    pub signature: Option<String>,
    pub pubkey: Option<String>,
    pub verified: bool,
    pub created_at: String,
}

/// One immutable audit-log row from `dao_events`.
#[derive(Debug, Clone)]
pub struct DaoEventRow {
    pub id: i64,
    pub subject: String,
    pub event_type: String,
    pub actor: Option<String>,
    pub data_json: String,
    pub created_at: String,
}

impl DaoDb {
    /// Open (or create) the SQLite database at `path`.
    pub fn open<P: AsRef<Path>>(path: P) -> DaoResult<Self> {
        let conn = Connection::open(path).map_err(|e| DaoError::Internal(e.to_string()))?;

        // WAL mode — better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// In-memory database for tests.
    pub fn in_memory() -> DaoResult<Self> {
        let conn = Connection::open_in_memory().map_err(|e| DaoError::Internal(e.to_string()))?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    // ── Schema ────────────────────────────────────────────────────────────────

    fn init_schema(&self) -> DaoResult<()> {
        self.conn
            .execute_batch(
                r#"
            CREATE TABLE IF NOT EXISTS proposals (
                id              INTEGER PRIMARY KEY,
                uuid            TEXT    NOT NULL UNIQUE,
                status          TEXT    NOT NULL DEFAULT 'Draft',
                proposal_type   TEXT    NOT NULL,  -- JSON
                title           TEXT    NOT NULL,
                description     TEXT    NOT NULL,
                proposer        TEXT    NOT NULL,
                proposer_balance INTEGER NOT NULL DEFAULT 0,
                snapshot_block  INTEGER NOT NULL DEFAULT 0,
                votes_yes       INTEGER NOT NULL DEFAULT 0,
                votes_no        INTEGER NOT NULL DEFAULT 0,
                votes_abstain   INTEGER NOT NULL DEFAULT 0,
                election_tallies TEXT    NOT NULL DEFAULT '{}',
                voter_count     INTEGER NOT NULL DEFAULT 0,
                created_at      TEXT    NOT NULL,
                voting_ends_at  TEXT    NOT NULL,
                timelock_ends_at TEXT,
                executed_at     TEXT,
                execution_tx    TEXT
            );

            CREATE TABLE IF NOT EXISTS votes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                proposal_id INTEGER NOT NULL REFERENCES proposals(id),
                voter       TEXT    NOT NULL,
                choice      TEXT    NOT NULL,   -- 'yes' | 'no' | 'abstain'
                weight      INTEGER NOT NULL,   -- ZION balance at snapshot
                l1_tx_hash  TEXT,               -- TX hash on L1 (optional, from memo)
                voted_at    TEXT    NOT NULL,
                UNIQUE(proposal_id, voter)
            );

            CREATE TABLE IF NOT EXISTS treasury_ops (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                op_id         TEXT NOT NULL UNIQUE,
                proposal_id   INTEGER     REFERENCES proposals(id),
                operation     TEXT NOT NULL,  -- JSON (TreasuryOperation variant)
                submitted_by  TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'pending',  -- pending|signed|awaiting_broadcast|executed|rejected|failed
                created_at    TEXT NOT NULL,
                executed_at   TEXT,
                unsigned_tx   TEXT,  -- JSON UnsignedTreasuryTx spec
                signing_hash  TEXT,  -- canonical guardian signing message
                tx_id         TEXT   -- L1 transaction hash after broadcast
            );

            CREATE TABLE IF NOT EXISTS treasury_sigs (
                op_id      TEXT NOT NULL REFERENCES treasury_ops(op_id),
                guardian   TEXT NOT NULL,
                signature  TEXT,      -- Ed25519 hex over signing_hash (NULL = legacy audit row)
                pubkey     TEXT,      -- Ed25519 hex pubkey used for verification
                verified   INTEGER NOT NULL DEFAULT 0,  -- 1 = cryptographically verified
                created_at TEXT NOT NULL,
                UNIQUE(op_id, guardian)
            );

            CREATE TABLE IF NOT EXISTS scan_state (
                id            INTEGER PRIMARY KEY CHECK(id = 1),  -- singleton
                last_block    INTEGER NOT NULL DEFAULT 0,
                updated_at    TEXT    NOT NULL
            );

            -- Append-only audit/event log (D4). subject scopes the feed:
            -- 'proposal:<id>' for governance lifecycle, 'op:<op_id>' for
            -- treasury operations. Events are never updated or deleted.
            CREATE TABLE IF NOT EXISTS dao_events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                subject     TEXT    NOT NULL,
                event_type  TEXT    NOT NULL,
                actor       TEXT,
                data_json   TEXT    NOT NULL DEFAULT '{}',
                created_at  TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_dao_events_subject
                ON dao_events(subject);

            -- Runtime-applied governance parameters (D5): executed Parameter
            -- proposals persist here and are replayed at startup so an
            -- approved parameter change survives a daemon restart.
            CREATE TABLE IF NOT EXISTS dao_params (
                name         TEXT PRIMARY KEY,
                value        TEXT    NOT NULL,
                proposal_id  INTEGER NOT NULL,
                applied_at   TEXT    NOT NULL
            );

            -- Guardian registry (D3). Candidates self-register on L1 via
            -- `DAO:guardian:register:<pubkey>` memo; governance mutations
            -- (admission adds, expulsion removes) persist as active flags
            -- and are replayed onto config.guardians at startup.
            CREATE TABLE IF NOT EXISTS guardian_candidates (
                address     TEXT PRIMARY KEY,
                pubkey      TEXT NOT NULL,
                txid        TEXT,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dao_guardians (
                address      TEXT PRIMARY KEY,
                pubkey       TEXT NOT NULL,
                active       INTEGER NOT NULL DEFAULT 1,
                proposal_id  INTEGER NOT NULL,
                applied_at   TEXT NOT NULL
            );

            -- Vote delegation (D6). `DAO:delegate:<addr>` memo sets the
            -- mapping, `DAO:delegate:none` removes the row. Delegation is
            -- non-transitive and consumed per-proposal: once a delegate's
            -- vote counts a delegator's weight, that delegator can no
            -- longer cast a direct vote on the same proposal — recorded in
            -- dao_delegated_votes so the rule survives restarts.
            CREATE TABLE IF NOT EXISTS dao_delegations (
                delegator   TEXT PRIMARY KEY,
                delegate    TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dao_delegated_votes (
                proposal_id INTEGER NOT NULL,
                delegator   TEXT NOT NULL,
                delegate    TEXT NOT NULL,
                weight      INTEGER NOT NULL,
                created_at  TEXT NOT NULL,
                PRIMARY KEY (proposal_id, delegator)
            );

            INSERT OR IGNORE INTO scan_state(id, last_block, updated_at)
            VALUES (1, 0, datetime('now'));
            "#,
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        // Migration: add any columns that may be missing in older DBs.
        self.ensure_columns(
            "proposals",
            &[
                ("proposer_balance", "INTEGER NOT NULL DEFAULT 0"),
                ("snapshot_block", "INTEGER NOT NULL DEFAULT 0"),
                ("election_tallies", "TEXT NOT NULL DEFAULT '{}'"),
                ("voter_count", "INTEGER NOT NULL DEFAULT 0"),
                ("timelock_ends_at", "TEXT"),
                ("execution_tx", "TEXT"),
            ],
        )?;
        self.ensure_columns(
            "treasury_ops",
            &[
                ("unsigned_tx", "TEXT"),
                ("signing_hash", "TEXT"),
                ("tx_id", "TEXT"),
            ],
        )?;
        self.ensure_columns(
            "treasury_sigs",
            &[
                ("signature", "TEXT"),
                ("pubkey", "TEXT"),
                ("verified", "INTEGER NOT NULL DEFAULT 0"),
            ],
        )?;

        Ok(())
    }

    /// Add `cols` to `table` if missing (each entry: `(name, sql_type)`).
    fn ensure_columns(&self, table: &str, cols: &[(&str, &str)]) -> DaoResult<()> {
        let existing: Vec<String> = self
            .conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        for (name, ty) in cols {
            if !existing.iter().any(|c| c == name) {
                self.conn
                    .execute(&format!("ALTER TABLE {table} ADD COLUMN {name} {ty}"), [])
                    .map_err(|e| DaoError::Internal(e.to_string()))?;
            }
        }
        Ok(())
    }

    // ── Proposals ─────────────────────────────────────────────────────────────

    /// Insert a new proposal. Returns the auto-incremented row id.
    pub fn insert_proposal(&self, p: &Proposal) -> DaoResult<i64> {
        let type_json = serde_json::to_string(&p.proposal_type)
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let tallies_json = serde_json::to_string(&p.election_tallies)
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let status = format!("{:?}", p.status);
        let timelock = p.timelock_ends_at.as_ref().map(|dt| dt.to_rfc3339());

        self.conn
            .execute(
                r#"INSERT INTO proposals
                    (id, uuid, status, proposal_type, title, description, proposer,
                     proposer_balance, snapshot_block,
                     votes_yes, votes_no, votes_abstain, election_tallies, voter_count,
                     created_at, voting_ends_at, timelock_ends_at, executed_at, execution_tx)
                   VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)"#,
                params![
                    p.id,
                    p.uuid.clone(),
                    status,
                    type_json,
                    p.title,
                    p.description,
                    p.proposer,
                    p.proposer_balance,
                    p.snapshot_block,
                    p.votes_for,
                    p.votes_against,
                    p.votes_abstain,
                    tallies_json,
                    p.voter_count,
                    p.created_at.to_rfc3339(),
                    p.voting_ends_at.to_rfc3339(),
                    timelock,
                    p.executed_at.as_ref().map(|dt| dt.to_rfc3339()),
                    p.execution_tx,
                ],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Update proposal status + vote counts from a live `Proposal` object.
    pub fn update_proposal_status(&self, p: &Proposal) -> DaoResult<()> {
        let status = format!("{:?}", p.status);
        let executed_at = p.executed_at.as_ref().map(|dt| dt.to_rfc3339());
        let timelock = p.timelock_ends_at.as_ref().map(|dt| dt.to_rfc3339());
        let tallies_json = serde_json::to_string(&p.election_tallies)
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        self.conn
            .execute(
                r#"UPDATE proposals SET status=?1, proposer_balance=?2, snapshot_block=?3,
                       votes_yes=?4, votes_no=?5, votes_abstain=?6, election_tallies=?7,
                       voter_count=?8, timelock_ends_at=?9, executed_at=?10, execution_tx=?11
                   WHERE id=?12"#,
                params![
                    status,
                    p.proposer_balance,
                    p.snapshot_block,
                    p.votes_for,
                    p.votes_against,
                    p.votes_abstain,
                    tallies_json,
                    p.voter_count,
                    timelock,
                    executed_at,
                    p.execution_tx,
                    p.id,
                ],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Update proposal status from a `ProposalRow` (used after loading from DB and modifying status).
    pub fn update_proposal_row(&self, row: &ProposalRow) -> DaoResult<()> {
        self.conn
            .execute(
                r#"UPDATE proposals SET status=?1, proposer_balance=?2, snapshot_block=?3,
                       votes_yes=?4, votes_no=?5, votes_abstain=?6, election_tallies=?7,
                       voter_count=?8, timelock_ends_at=?9, executed_at=?10, execution_tx=?11
                   WHERE id=?12"#,
                params![
                    row.status,
                    row.proposer_balance,
                    row.snapshot_block,
                    row.votes_yes,
                    row.votes_no,
                    row.votes_abstain,
                    row.election_tallies,
                    row.voter_count,
                    row.timelock_ends_at,
                    row.executed_at,
                    row.execution_tx,
                    row.id,
                ],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Load all proposals (for in-memory reload at startup).
    pub fn load_all_proposals(&self) -> DaoResult<Vec<ProposalRow>> {
        let mut stmt = self
            .conn
            .prepare(
                r#"SELECT id, uuid, status, proposal_type, title, description, proposer,
                          proposer_balance, snapshot_block,
                          votes_yes, votes_no, votes_abstain, election_tallies, voter_count,
                          created_at, voting_ends_at, timelock_ends_at, executed_at, execution_tx
                   FROM proposals ORDER BY id"#,
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(ProposalRow {
                    id: row.get(0)?,
                    uuid: row.get(1)?,
                    status: row.get(2)?,
                    proposal_type_json: row.get(3)?,
                    title: row.get(4)?,
                    description: row.get(5)?,
                    proposer: row.get(6)?,
                    proposer_balance: row.get(7)?,
                    snapshot_block: row.get(8)?,
                    votes_yes: row.get(9)?,
                    votes_no: row.get(10)?,
                    votes_abstain: row.get(11)?,
                    election_tallies: row.get(12)?,
                    voter_count: row.get(13)?,
                    created_at: row.get(14)?,
                    voting_ends_at: row.get(15)?,
                    timelock_ends_at: row.get(16)?,
                    executed_at: row.get(17)?,
                    execution_tx: row.get(18)?,
                })
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        Ok(rows)
    }

    /// Get a single proposal by id (returns None if not found).
    pub fn get_proposal(&self, id: u64) -> DaoResult<Option<ProposalRow>> {
        let mut stmt = self
            .conn
            .prepare(
                r#"SELECT id, uuid, status, proposal_type, title, description, proposer,
                          proposer_balance, snapshot_block,
                          votes_yes, votes_no, votes_abstain, election_tallies, voter_count,
                          created_at, voting_ends_at, timelock_ends_at, executed_at, execution_tx
                   FROM proposals WHERE id=?1"#,
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        let mut rows = stmt
            .query_map(params![id], |row| {
                Ok(ProposalRow {
                    id: row.get(0)?,
                    uuid: row.get(1)?,
                    status: row.get(2)?,
                    proposal_type_json: row.get(3)?,
                    title: row.get(4)?,
                    description: row.get(5)?,
                    proposer: row.get(6)?,
                    proposer_balance: row.get(7)?,
                    snapshot_block: row.get(8)?,
                    votes_yes: row.get(9)?,
                    votes_no: row.get(10)?,
                    votes_abstain: row.get(11)?,
                    election_tallies: row.get(12)?,
                    voter_count: row.get(13)?,
                    created_at: row.get(14)?,
                    voting_ends_at: row.get(15)?,
                    timelock_ends_at: row.get(16)?,
                    executed_at: row.get(17)?,
                    execution_tx: row.get(18)?,
                })
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        match rows.next() {
            Some(Ok(row)) => Ok(Some(row)),
            Some(Err(e)) => Err(DaoError::Internal(e.to_string())),
            None => Ok(None),
        }
    }

    // ── Votes ─────────────────────────────────────────────────────────────────

    /// Record a vote. Returns `false` if duplicate (same voter, same proposal).
    pub fn record_vote(
        &self,
        proposal_id: u64,
        voter: &str,
        choice: VoteChoice,
        weight: u64,
        l1_tx_hash: Option<&str>,
    ) -> DaoResult<bool> {
        let choice_str = match &choice {
            VoteChoice::Yes => "yes",
            VoteChoice::No => "no",
            VoteChoice::Abstain => "abstain",
            VoteChoice::Candidate(party) => party.as_str(),
        };

        let voted_at = Utc::now().to_rfc3339();
        let tx = self.conn.unchecked_transaction()?;
        let result = tx.execute(
            r#"INSERT OR IGNORE INTO votes
               (proposal_id, voter, choice, weight, l1_tx_hash, voted_at)
               VALUES (?1,?2,?3,?4,?5,?6)"#,
            params![proposal_id, voter, choice_str, weight, l1_tx_hash, voted_at],
        );

        let inserted = match result {
            Ok(0) => false, // OR IGNORE hit — duplicate
            Ok(_) => true,
            Err(e) => return Err(DaoError::Internal(e.to_string())),
        };

        if inserted {
            match choice {
                VoteChoice::Yes => tx.execute(
                    "UPDATE proposals SET votes_yes = votes_yes + ?1 WHERE id = ?2",
                    params![weight, proposal_id],
                )?,
                VoteChoice::No => tx.execute(
                    "UPDATE proposals SET votes_no = votes_no + ?1 WHERE id = ?2",
                    params![weight, proposal_id],
                )?,
                VoteChoice::Abstain => tx.execute(
                    "UPDATE proposals SET votes_abstain = votes_abstain + ?1 WHERE id = ?2",
                    params![weight, proposal_id],
                )?,
                VoteChoice::Candidate(ref party) => {
                    // Update per-party tally stored as JSON
                    let tallies_json: String = tx.query_row(
                        "SELECT election_tallies FROM proposals WHERE id=?1",
                        params![proposal_id],
                        |row| row.get(0),
                    )?;
                    let mut tallies: BTreeMap<String, u64> =
                        serde_json::from_str(&tallies_json).unwrap_or_default();
                    *tallies.entry(party.clone()).or_insert(0) += weight;
                    let updated = serde_json::to_string(&tallies)
                        .map_err(|e| DaoError::Internal(e.to_string()))?;
                    tx.execute(
                        "UPDATE proposals SET election_tallies=?1, votes_yes = votes_yes + ?2 WHERE id = ?3",
                        params![updated, weight, proposal_id],
                    )?
                }
            };
        }

        tx.commit().map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(inserted)
    }

    /// Load all recorded votes for a proposal (for runtime reload).
    pub fn get_votes(&self, proposal_id: u64) -> DaoResult<Vec<Vote>> {
        let mut stmt = self
            .conn
            .prepare(
                r#"SELECT voter, choice, weight, l1_tx_hash, voted_at
                   FROM votes WHERE proposal_id=?1 ORDER BY voted_at"#,
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![proposal_id], |row| {
                let voter: String = row.get(0)?;
                let choice_str: String = row.get(1)?;
                let weight: i64 = row.get(2)?;
                let l1_tx_hash: Option<String> = row.get(3)?;
                let voted_at_str: String = row.get(4)?;

                let choice = match choice_str.as_str() {
                    "yes" => VoteChoice::Yes,
                    "no" => VoteChoice::No,
                    "abstain" => VoteChoice::Abstain,
                    party => VoteChoice::Candidate(party.to_string()),
                };

                let voted_at = chrono::DateTime::parse_from_rfc3339(&voted_at_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .map_err(|e| {
                        rusqlite::Error::FromSqlConversionFailure(
                            4,
                            rusqlite::types::Type::Text,
                            Box::new(e),
                        )
                    })?;

                Ok(Vote {
                    proposal_id,
                    voter,
                    choice,
                    weight: weight as u64,
                    tx_hash: l1_tx_hash,
                    voted_at,
                })
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        Ok(rows)
    }

    /// Count votes for a proposal (by choice).
    pub fn vote_totals(&self, proposal_id: u64) -> DaoResult<(u64, u64, u64)> {
        let mut stmt = self
            .conn
            .prepare(
                r#"SELECT
                    COALESCE(SUM(CASE WHEN choice='yes'     THEN weight ELSE 0 END), 0) AS yes_w,
                    COALESCE(SUM(CASE WHEN choice='no'      THEN weight ELSE 0 END), 0) AS no_w,
                    COALESCE(SUM(CASE WHEN choice='abstain' THEN weight ELSE 0 END), 0) AS abs_w
                   FROM votes WHERE proposal_id=?1"#,
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        let (yes, no, abstain): (i64, i64, i64) = stmt
            .query_row(params![proposal_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        Ok((yes as u64, no as u64, abstain as u64))
    }

    /// Per-candidate/party tallies for an election proposal.
    pub fn election_tallies(&self, proposal_id: u64) -> DaoResult<BTreeMap<String, u64>> {
        let mut stmt = self
            .conn
            .prepare(
                r#"SELECT choice, SUM(weight) FROM votes
                   WHERE proposal_id=?1 AND choice NOT IN ('yes','no','abstain')
                   GROUP BY choice"#,
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![proposal_id], |row| {
                let choice: String = row.get(0)?;
                let weight: i64 = row.get(1)?;
                Ok((choice, weight as u64))
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<BTreeMap<_, _>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;

        Ok(rows)
    }

    /// Check if a voter already voted on a proposal.
    pub fn has_voted(&self, proposal_id: u64, voter: &str) -> DaoResult<bool> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM votes WHERE proposal_id=?1 AND voter=?2",
                params![proposal_id, voter],
                |row| row.get(0),
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(count > 0)
    }

    // ── Treasury ──────────────────────────────────────────────────────────────

    pub fn insert_treasury_op(
        &self,
        op_id: &str,
        proposal_id: Option<u64>,
        operation: &TreasuryOperation,
        submitted_by: &str,
        signing_hash: Option<&str>,
    ) -> DaoResult<()> {
        let op_json =
            serde_json::to_string(operation).map_err(|e| DaoError::Internal(e.to_string()))?;

        self.conn
            .execute(
                r#"INSERT OR IGNORE INTO treasury_ops
                   (op_id, proposal_id, operation, submitted_by, status, created_at, signing_hash)
                   VALUES (?1,?2,?3,?4,'pending',datetime('now'),?5)"#,
                params![op_id, proposal_id, op_json, submitted_by, signing_hash],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Persist the unsigned-tx spec (JSON) once threshold is reached.
    pub fn set_treasury_op_unsigned_tx(&self, op_id: &str, unsigned_tx: &str) -> DaoResult<()> {
        self.conn
            .execute(
                "UPDATE treasury_ops SET unsigned_tx=?1 WHERE op_id=?2",
                params![unsigned_tx, op_id],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Persist the L1 tx_id after broadcast (status handled separately).
    pub fn set_treasury_op_tx_id(&self, op_id: &str, tx_id: &str) -> DaoResult<()> {
        self.conn
            .execute(
                "UPDATE treasury_ops SET tx_id=?1 WHERE op_id=?2",
                params![tx_id, op_id],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn update_treasury_op_status(&self, op_id: &str, status: &str) -> DaoResult<()> {
        let executed_at = if status == "executed" {
            Some(Utc::now().to_rfc3339())
        } else {
            None
        };
        self.conn
            .execute(
                "UPDATE treasury_ops SET status=?1, executed_at=?2 WHERE op_id=?3",
                params![status, executed_at, op_id],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Load a single treasury operation row.
    pub fn get_treasury_op(&self, op_id: &str) -> DaoResult<Option<TreasuryOpRow>> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT op_id, proposal_id, operation, submitted_by, status, created_at, executed_at,
                        unsigned_tx, signing_hash, tx_id
                 FROM treasury_ops WHERE op_id=?1",
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let mut rows = stmt
            .query_map(params![op_id], |row| {
                Ok(TreasuryOpRow {
                    op_id: row.get(0)?,
                    proposal_id: row.get(1)?,
                    operation: row.get(2)?,
                    submitted_by: row.get(3)?,
                    status: row.get(4)?,
                    created_at: row.get(5)?,
                    executed_at: row.get(6)?,
                    unsigned_tx: row.get(7)?,
                    signing_hash: row.get(8)?,
                    tx_id: row.get(9)?,
                })
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        match rows.next() {
            Some(Ok(r)) => Ok(Some(r)),
            Some(Err(e)) => Err(DaoError::Internal(e.to_string())),
            None => Ok(None),
        }
    }

    /// List treasury operations, optionally filtered by status, newest first.
    pub fn list_treasury_ops(&self, status: Option<&str>) -> DaoResult<Vec<TreasuryOpRow>> {
        let (sql, param): (&str, Option<String>) = match status {
            Some(s) => (
                "SELECT op_id, proposal_id, operation, submitted_by, status, created_at, executed_at,
                        unsigned_tx, signing_hash, tx_id
                 FROM treasury_ops WHERE status=?1 ORDER BY created_at DESC",
                Some(s.to_string()),
            ),
            None => (
                "SELECT op_id, proposal_id, operation, submitted_by, status, created_at, executed_at,
                        unsigned_tx, signing_hash, tx_id
                 FROM treasury_ops ORDER BY created_at DESC",
                None,
            ),
        };
        let mut stmt = self
            .conn
            .prepare(sql)
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<TreasuryOpRow> {
            Ok(TreasuryOpRow {
                op_id: row.get(0)?,
                proposal_id: row.get(1)?,
                operation: row.get(2)?,
                submitted_by: row.get(3)?,
                status: row.get(4)?,
                created_at: row.get(5)?,
                executed_at: row.get(6)?,
                unsigned_tx: row.get(7)?,
                signing_hash: row.get(8)?,
                tx_id: row.get(9)?,
            })
        };
        let rows = match &param {
            Some(p) => stmt.query_map(params![p], map_row),
            None => stmt.query_map([], map_row),
        }
        .map_err(|e| DaoError::Internal(e.to_string()))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| DaoError::Internal(e.to_string()))?);
        }
        Ok(out)
    }

    /// Count treasury operations, optionally filtered by status.
    pub fn count_treasury_ops(&self, status: &str) -> DaoResult<usize> {
        let n: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM treasury_ops WHERE status=?1",
                params![status],
                |row| row.get(0),
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(n as usize)
    }

    /// Record a guardian signature on a treasury operation (idempotent).
    /// `signature`/`pubkey` are hex; `verified` is set only after successful
    /// Ed25519 verification — legacy audit rows keep NULL/0.
    pub fn add_treasury_sig(
        &self,
        op_id: &str,
        guardian: &str,
        signature: Option<&str>,
        pubkey: Option<&str>,
        verified: bool,
    ) -> DaoResult<()> {
        self.conn
            .execute(
                "INSERT OR IGNORE INTO treasury_sigs
                 (op_id, guardian, signature, pubkey, verified, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
                params![op_id, guardian, signature, pubkey, verified as i64],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// List guardian addresses that signed a treasury operation.
    pub fn list_treasury_sigs(&self, op_id: &str) -> DaoResult<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT guardian FROM treasury_sigs WHERE op_id=?1 ORDER BY created_at")
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map(params![op_id], |row| row.get(0))
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| DaoError::Internal(e.to_string()))?);
        }
        Ok(out)
    }

    /// Detailed signature rows for an op — guardian, sig, pubkey, verified.
    pub fn list_treasury_sigs_detailed(&self, op_id: &str) -> DaoResult<Vec<TreasurySigRow>> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT guardian, signature, pubkey, verified, created_at
                 FROM treasury_sigs WHERE op_id=?1 ORDER BY created_at",
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map(params![op_id], |row| {
                Ok(TreasurySigRow {
                    guardian: row.get(0)?,
                    signature: row.get(1)?,
                    pubkey: row.get(2)?,
                    verified: row.get::<_, i64>(3)? != 0,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| DaoError::Internal(e.to_string()))?);
        }
        Ok(out)
    }

    /// Count *cryptographically verified* signatures on an op.
    pub fn count_verified_treasury_sigs(&self, op_id: &str) -> DaoResult<usize> {
        let n: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM treasury_sigs WHERE op_id=?1 AND verified=1",
                params![op_id],
                |row| row.get(0),
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(n as usize)
    }

    // ── L1 Scan State ─────────────────────────────────────────────────────────

    /// Return last scanned L1 block height.
    pub fn last_scanned_block(&self) -> DaoResult<u64> {
        let h: i64 = self
            .conn
            .query_row("SELECT last_block FROM scan_state WHERE id=1", [], |row| {
                row.get(0)
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(h as u64)
    }

    /// Update the last scanned block cursor.
    pub fn set_last_scanned_block(&self, height: u64) -> DaoResult<()> {
        self.conn
            .execute(
                "UPDATE scan_state SET last_block=?1, updated_at=datetime('now') WHERE id=1",
                params![height as i64],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    // ── Event / audit log (D4) ────────────────────────────────────────────────

    /// Append an immutable event. `subject` scopes the feed —
    /// `proposal:<id>` for governance lifecycle, `op:<op_id>` for treasury.
    /// Callers must not mutate or delete rows; failures are logged by the
    /// caller, not fatal to governance flow.
    pub fn insert_event(
        &self,
        subject: &str,
        event_type: &str,
        actor: Option<&str>,
        data_json: &str,
    ) -> DaoResult<()> {
        self.conn
            .execute(
                r#"INSERT INTO dao_events (subject, event_type, actor, data_json, created_at)
                   VALUES (?1, ?2, ?3, ?4, datetime('now'))"#,
                params![subject, event_type, actor, data_json],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Persist an executed Parameter proposal's applied value (D5).
    /// Upsert by name — the latest executed proposal wins.
    pub fn set_gov_param(&self, name: &str, value: &str, proposal_id: u64) -> DaoResult<()> {
        self.conn
            .execute(
                r#"INSERT INTO dao_params (name, value, proposal_id, applied_at)
                   VALUES (?1, ?2, ?3, datetime('now'))
                   ON CONFLICT(name) DO UPDATE SET
                     value = excluded.value,
                     proposal_id = excluded.proposal_id,
                     applied_at = excluded.applied_at"#,
                params![name, value, proposal_id],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// All applied governance parameters as (name, value) pairs — replayed
    /// into the runtime config at startup (D5).
    pub fn gov_params(&self) -> DaoResult<Vec<(String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT name, value FROM dao_params ORDER BY name")
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(rows)
    }

    /// Record a `DAO:guardian:register` memo — maps sender address → pubkey.
    /// Re-registration rotates the claimed pubkey (the sender address is the
    /// identity; the newest on-chain registration wins).
    pub fn register_guardian_candidate(
        &self,
        address: &str,
        pubkey: &str,
        txid: &str,
    ) -> DaoResult<()> {
        self.conn
            .execute(
                r#"INSERT INTO guardian_candidates (address, pubkey, txid, created_at)
                   VALUES (?1, ?2, ?3, datetime('now'))
                   ON CONFLICT(address) DO UPDATE SET
                     pubkey = excluded.pubkey,
                     txid = excluded.txid,
                     created_at = excluded.created_at"#,
                params![address, pubkey, txid],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// All registered guardian candidates as (address, pubkey) pairs.
    pub fn list_guardian_candidates(&self) -> DaoResult<Vec<(String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT address, pubkey FROM guardian_candidates ORDER BY created_at")
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(rows)
    }

    /// Pubkey a candidate registered on L1 (None = never registered).
    pub fn guardian_candidate_pubkey(&self, address: &str) -> DaoResult<Option<String>> {
        self.conn
            .query_row(
                "SELECT pubkey FROM guardian_candidates WHERE address = ?1",
                params![address],
                |row| row.get(0),
            )
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(DaoError::Internal(other.to_string())),
            })
    }

    /// Persist a governance guardian mutation: `active=true` admits,
    /// `active=false` expels (tombstone — overrides a config-file guardian).
    pub fn set_gov_guardian(
        &self,
        address: &str,
        pubkey: &str,
        active: bool,
        proposal_id: u64,
    ) -> DaoResult<()> {
        self.conn
            .execute(
                r#"INSERT INTO dao_guardians (address, pubkey, active, proposal_id, applied_at)
                   VALUES (?1, ?2, ?3, ?4, datetime('now'))
                   ON CONFLICT(address) DO UPDATE SET
                     pubkey = excluded.pubkey,
                     active = excluded.active,
                     proposal_id = excluded.proposal_id,
                     applied_at = excluded.applied_at"#,
                params![address, pubkey, active as i64, proposal_id],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// All governance guardian mutations (address, pubkey, active) — replayed
    /// onto `config.guardians` at startup (D3).
    pub fn gov_guardians(&self) -> DaoResult<Vec<(String, String, bool)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT address, pubkey, active FROM dao_guardians ORDER BY proposal_id")
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)? != 0,
                ))
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(rows)
    }

    // ── Delegation (D6) ───────────────────────────────────────────────────────

    /// Set or replace a delegation: `delegator` assigns voting weight to
    /// `delegate` (`DAO:delegate:<addr>` memo).
    pub fn set_delegation(&self, delegator: &str, delegate: &str) -> DaoResult<()> {
        self.conn
            .execute(
                r#"INSERT INTO dao_delegations (delegator, delegate, updated_at)
                   VALUES (?1, ?2, datetime('now'))
                   ON CONFLICT(delegator) DO UPDATE SET
                     delegate = excluded.delegate,
                     updated_at = excluded.updated_at"#,
                params![delegator, delegate],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Revoke a delegation (`DAO:delegate:none` memo).
    pub fn remove_delegation(&self, delegator: &str) -> DaoResult<()> {
        self.conn
            .execute(
                "DELETE FROM dao_delegations WHERE delegator = ?1",
                params![delegator],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// All active delegations as (delegator, delegate, updated_at) rows —
    /// replayed into the runtime map at startup.
    pub fn list_delegations(&self) -> DaoResult<Vec<(String, String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT delegator, delegate, updated_at FROM dao_delegations")
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(rows)
    }

    /// Record which delegators' weights were consumed by a delegate's vote.
    /// Rows are (proposal_id, delegator)-unique — a replayed/double process
    /// cannot insert the same consumption twice.
    pub fn record_delegated_votes(
        &self,
        proposal_id: u64,
        delegate: &str,
        delegators: &[(String, u64)],
    ) -> DaoResult<()> {
        let tx = self
            .conn
            .unchecked_transaction()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        for (delegator, weight) in delegators {
            tx.execute(
                r#"INSERT OR IGNORE INTO dao_delegated_votes
                   (proposal_id, delegator, delegate, weight, created_at)
                   VALUES (?1, ?2, ?3, ?4, datetime('now'))"#,
                params![proposal_id, delegator, delegate, *weight as i64],
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        }
        tx.commit().map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Whether `delegator`'s weight was already consumed by a delegate's
    /// vote on this proposal (blocks a later direct vote — D6 no-double-count).
    pub fn has_delegated_vote(&self, proposal_id: u64, delegator: &str) -> DaoResult<bool> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM dao_delegated_votes WHERE proposal_id=?1 AND delegator=?2",
                params![proposal_id, delegator],
                |row| row.get(0),
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(count > 0)
    }

    /// All delegated-vote consumptions as (proposal_id, delegator, delegate,
    /// weight) rows — replayed at startup so the no-double-count rule
    /// survives a restart.
    pub fn list_delegated_votes(&self) -> DaoResult<Vec<(u64, String, String, u64)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT proposal_id, delegator, delegate, weight FROM dao_delegated_votes")
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, u64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)? as u64,
                ))
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(rows)
    }

    /// Events for one subject, oldest first (append order = audit order).
    pub fn list_events(&self, subject: &str, limit: u32) -> DaoResult<Vec<DaoEventRow>> {
        let mut stmt = self
            .conn
            .prepare(
                r#"SELECT id, subject, event_type, actor, data_json, created_at
                   FROM dao_events WHERE subject = ?1
                   ORDER BY id ASC LIMIT ?2"#,
            )
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        let rows = stmt
            .query_map(params![subject, limit], |row| {
                Ok(DaoEventRow {
                    id: row.get(0)?,
                    subject: row.get(1)?,
                    event_type: row.get(2)?,
                    actor: row.get(3)?,
                    data_json: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| DaoError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DaoError::Internal(e.to_string()))?;
        Ok(rows)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Row types (plain struct for easy JSON serialisation in API)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProposalRow {
    pub id: u64,
    pub uuid: String,
    pub status: String,
    pub proposal_type_json: String,
    pub title: String,
    pub description: String,
    pub proposer: String,
    pub proposer_balance: i64,
    pub snapshot_block: i64,
    pub votes_yes: i64,
    pub votes_no: i64,
    pub votes_abstain: i64,
    pub election_tallies: String,
    pub voter_count: i64,
    pub created_at: String,
    pub voting_ends_at: String,
    pub timelock_ends_at: Option<String>,
    pub executed_at: Option<String>,
    pub execution_tx: Option<String>,
}

impl ProposalRow {
    /// Convert a DB row back into the in-memory `Proposal` type.
    pub fn to_proposal(&self) -> DaoResult<Proposal> {
        let status = match self.status.as_str() {
            "Draft" => ProposalStatus::Draft,
            "Active" => ProposalStatus::Active,
            "Passed" => ProposalStatus::Passed,
            "Failed" => ProposalStatus::Failed,
            "Timelocked" => ProposalStatus::Timelocked,
            "Executed" => ProposalStatus::Executed,
            "Cancelled" => ProposalStatus::Cancelled,
            "Expired" => ProposalStatus::Expired,
            other => {
                return Err(DaoError::Internal(format!(
                    "Unknown proposal status: {other}"
                )))
            }
        };

        let proposal_type: ProposalType = serde_json::from_str(&self.proposal_type_json)
            .map_err(|e| DaoError::Internal(format!("invalid proposal_type json: {e}")))?;

        let election_tallies: std::collections::BTreeMap<String, u64> =
            serde_json::from_str(&self.election_tallies)
                .map_err(|e| DaoError::Internal(format!("invalid election_tallies json: {e}")))?;

        let parse_dt = |s: &str| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .map_err(|e| DaoError::Internal(format!("invalid datetime {s}: {e}")))
        };

        let created_at = parse_dt(&self.created_at)?;
        let voting_ends_at = parse_dt(&self.voting_ends_at)?;
        let timelock_ends_at = self
            .timelock_ends_at
            .as_ref()
            .map(|s| parse_dt(s))
            .transpose()?;
        let executed_at = self.executed_at.as_ref().map(|s| parse_dt(s)).transpose()?;

        Ok(Proposal {
            id: self.id,
            uuid: self.uuid.clone(),
            title: self.title.clone(),
            description: self.description.clone(),
            proposal_type,
            status,
            proposer: self.proposer.clone(),
            proposer_balance: self.proposer_balance as u64,
            snapshot_block: self.snapshot_block as u64,
            votes_for: self.votes_yes as u64,
            votes_against: self.votes_no as u64,
            votes_abstain: self.votes_abstain as u64,
            election_tallies,
            voter_count: self.voter_count as u32,
            created_at,
            voting_ends_at,
            timelock_ends_at,
            executed_at,
            execution_tx: self.execution_tx.clone(),
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::VoteChoice;

    fn make_db() -> DaoDb {
        DaoDb::in_memory().unwrap()
    }

    #[test]
    fn test_schema_init() {
        let db = make_db();
        let h = db.last_scanned_block().unwrap();
        assert_eq!(h, 0);
    }

    #[test]
    fn test_scan_cursor() {
        let db = make_db();
        db.set_last_scanned_block(12345).unwrap();
        assert_eq!(db.last_scanned_block().unwrap(), 12345);
        db.set_last_scanned_block(99999).unwrap();
        assert_eq!(db.last_scanned_block().unwrap(), 99999);
    }

    #[test]
    fn test_event_log_append_and_scope() {
        let db = make_db();
        db.insert_event(
            "proposal:1",
            "proposal_created",
            Some("zion1a"),
            "{\"title\":\"T\"}",
        )
        .unwrap();
        db.insert_event(
            "proposal:1",
            "vote_cast",
            Some("zion1b"),
            "{\"choice\":\"Yes\"}",
        )
        .unwrap();
        db.insert_event("op:abc", "treasury_op_submitted", Some("zion1g"), "{}")
            .unwrap();
        db.insert_event("proposal:2", "proposal_created", None, "{}")
            .unwrap();

        let feed = db.list_events("proposal:1", 500).unwrap();
        assert_eq!(feed.len(), 2);
        assert_eq!(feed[0].event_type, "proposal_created");
        assert_eq!(feed[1].event_type, "vote_cast");
        assert_eq!(feed[0].actor.as_deref(), Some("zion1a"));
        // Append order preserved (ascending id).
        assert!(feed[0].id < feed[1].id);
        // Scoping: op: and other proposals are excluded.
        assert_eq!(db.list_events("op:abc", 500).unwrap().len(), 1);
        assert_eq!(db.list_events("proposal:2", 500).unwrap().len(), 1);
        assert!(db.list_events("proposal:9", 500).unwrap().is_empty());
        // Limit respected.
        assert_eq!(db.list_events("proposal:1", 1).unwrap().len(), 1);
    }

    #[test]
    fn test_vote_deduplication() {
        let db = make_db();
        // We need a proposal row first (minimal insert)
        db.conn.execute(
            r#"INSERT INTO proposals (id,uuid,status,proposal_type,title,description,
               proposer,proposer_balance,snapshot_block,
               votes_yes,votes_no,votes_abstain,election_tallies,voter_count,created_at,voting_ends_at,timelock_ends_at,executed_at,execution_tx)
               VALUES (1,'1','Active','{}','Test','desc','zion1test',0,0,0,0,0,'{}',0,datetime('now'),datetime('now'),NULL,NULL,NULL)"#,
            [],
        ).unwrap();

        let first = db
            .record_vote(1, "zion1voter1", VoteChoice::Yes, 1_000_000, None)
            .unwrap();
        assert!(first, "First vote should succeed");

        let dup = db
            .record_vote(1, "zion1voter1", VoteChoice::No, 1_000_000, None)
            .unwrap();
        assert!(!dup, "Duplicate vote should be ignored");
    }

    #[test]
    fn test_vote_totals() {
        let db = make_db();
        db.conn.execute(
            r#"INSERT INTO proposals (id,uuid,status,proposal_type,title,description,
               proposer,proposer_balance,snapshot_block,
               votes_yes,votes_no,votes_abstain,election_tallies,voter_count,created_at,voting_ends_at,timelock_ends_at,executed_at,execution_tx)
               VALUES (2,'2','Active','{}','Test2','d','zion1test',0,0,0,0,0,'{}',0,datetime('now'),datetime('now'),NULL,NULL,NULL)"#,
            [],
        ).unwrap();

        db.record_vote(2, "zion1a", VoteChoice::Yes, 5_000_000, None)
            .unwrap();
        db.record_vote(2, "zion1b", VoteChoice::No, 2_000_000, None)
            .unwrap();
        db.record_vote(2, "zion1c", VoteChoice::Abstain, 1_000_000, None)
            .unwrap();

        let (yes, no, abs) = db.vote_totals(2).unwrap();
        assert_eq!(yes, 5_000_000);
        assert_eq!(no, 2_000_000);
        assert_eq!(abs, 1_000_000);
    }

    #[test]
    fn test_has_voted() {
        let db = make_db();
        db.conn.execute(
            r#"INSERT INTO proposals (id,uuid,status,proposal_type,title,description,
               proposer,proposer_balance,snapshot_block,
               votes_yes,votes_no,votes_abstain,election_tallies,voter_count,created_at,voting_ends_at,timelock_ends_at,executed_at,execution_tx)
               VALUES (3,'3','Active','{}','Test3','d','zion1test',0,0,0,0,0,'{}',0,datetime('now'),datetime('now'),NULL,NULL,NULL)"#,
            [],
        ).unwrap();

        assert!(!db.has_voted(3, "zion1voter").unwrap());
        db.record_vote(3, "zion1voter", VoteChoice::Yes, 100, None)
            .unwrap();
        assert!(db.has_voted(3, "zion1voter").unwrap());
    }

    #[test]
    fn test_treasury_ops_and_sigs() {
        let db = make_db();
        let op = TreasuryOperation::Spend {
            recipient: "zion1abc".into(),
            amount: 5_000_000,
            purpose: "test grant".into(),
            proposal_id: 7,
        };

        db.insert_treasury_op("op-1", None, &op, "guardian-1", Some("hash-1"))
            .unwrap();
        db.add_treasury_sig("op-1", "guardian-1", Some("sig"), Some("pk"), true)
            .unwrap();
        db.add_treasury_sig("op-1", "guardian-2", None, None, false)
            .unwrap();
        db.add_treasury_sig("op-1", "guardian-2", None, None, false)
            .unwrap(); // duplicate ignored

        let row = db.get_treasury_op("op-1").unwrap().unwrap();
        assert_eq!(row.status, "pending");
        assert_eq!(row.proposal_id, None);
        assert_eq!(row.submitted_by, "guardian-1");

        let parsed: TreasuryOperation = serde_json::from_str(&row.operation).unwrap();
        assert_eq!(parsed, op);

        assert_eq!(db.list_treasury_sigs("op-1").unwrap().len(), 2);
        assert_eq!(db.count_verified_treasury_sigs("op-1").unwrap(), 1);
        assert_eq!(db.list_treasury_sigs_detailed("op-1").unwrap().len(), 2);
        assert_eq!(db.count_treasury_ops("pending").unwrap(), 1);
        assert_eq!(db.count_treasury_ops("executed").unwrap(), 0);

        // unsigned spec + tx_id round-trip
        db.set_treasury_op_unsigned_tx("op-1", "{\"x\":1}").unwrap();
        db.set_treasury_op_tx_id("op-1", "abcd").unwrap();
        let row = db.get_treasury_op("op-1").unwrap().unwrap();
        assert_eq!(row.unsigned_tx.as_deref(), Some("{\"x\":1}"));
        assert_eq!(row.tx_id.as_deref(), Some("abcd"));
        assert_eq!(row.signing_hash.as_deref(), Some("hash-1"));

        db.update_treasury_op_status("op-1", "executed").unwrap();
        let row = db.get_treasury_op("op-1").unwrap().unwrap();
        assert_eq!(row.status, "executed");
        assert!(row.executed_at.is_some());

        assert!(db.get_treasury_op("op-missing").unwrap().is_none());
    }
}
