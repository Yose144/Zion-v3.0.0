//! SQLite persistence for zion-issobella.

use crate::error::IssobellaResult;
use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub struct IssobellaDb {
    conn: Connection,
}

impl IssobellaDb {
    pub fn open(path: &str) -> IssobellaResult<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> IssobellaResult<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS missions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                mission_type TEXT NOT NULL,
                budget_zion INTEGER NOT NULL,
                spent_zion INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'planning',
                target_launch_date TEXT,
                started_at TEXT,
                completed_at TEXT,
                orbit_altitude_km REAL,
                satellite_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS observations (
                id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                observation_type TEXT NOT NULL,
                data_url TEXT,
                metadata TEXT,
                recorded_at TEXT NOT NULL,
                published INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS research_proposals (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                researcher TEXT,
                institution TEXT,
                abstract_text TEXT,
                requested_budget INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'submitted',
                submitted_at TEXT NOT NULL,
                reviewed_at TEXT,
                reviewer_notes TEXT
            );

            CREATE TABLE IF NOT EXISTS fund_balance (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_accumulated INTEGER NOT NULL DEFAULT 0,
                total_disbursed INTEGER NOT NULL DEFAULT 0,
                last_block_height INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            INSERT OR IGNORE INTO fund_balance (id, total_accumulated, total_disbursed, last_block_height, updated_at)
            VALUES (1, 0, 0, 0, datetime('now'));"
        )?;
        Ok(())
    }

    // ── Missions ──

    pub fn insert_mission(&self, m: &MissionRecord) -> IssobellaResult<()> {
        self.conn.execute(
            "INSERT INTO missions (id, name, description, mission_type, budget_zion, status, target_launch_date, started_at, orbit_altitude_km, satellite_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (&m.id, &m.name, &m.description, &m.mission_type, &m.budget_zion, &m.status,
             &m.target_launch_date, &m.started_at.map(|t| t.to_rfc3339()), &m.orbit_altitude_km, &m.satellite_count),
        )?;
        Ok(())
    }

    pub fn list_missions(&self, status: Option<&str>) -> IssobellaResult<Vec<MissionRecord>> {
        let sql = match status {
            Some(_s) => "SELECT id, name, description, mission_type, budget_zion, spent_zion, status, target_launch_date, started_at, completed_at, orbit_altitude_km, satellite_count FROM missions WHERE status = ?1 ORDER BY started_at DESC",
            None => "SELECT id, name, description, mission_type, budget_zion, spent_zion, status, target_launch_date, started_at, completed_at, orbit_altitude_km, satellite_count FROM missions ORDER BY started_at DESC",
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = match status {
            Some(s) => stmt.query_map([s], row_to_mission)?,
            None => stmt.query_map([], row_to_mission)?,
        };
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn update_mission_status(&self, id: &str, status: &str) -> IssobellaResult<()> {
        let completed = if status == "completed" {
            Some(Utc::now().to_rfc3339())
        } else {
            None
        };
        self.conn.execute(
            "UPDATE missions SET status = ?1, completed_at = ?2 WHERE id = ?3",
            (status, &completed, id),
        )?;
        Ok(())
    }

    // ── Research proposals ──

    pub fn insert_proposal(&self, p: &ResearchProposal) -> IssobellaResult<()> {
        self.conn.execute(
            "INSERT INTO research_proposals (id, title, researcher, institution, abstract_text, requested_budget, status, submitted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (&p.id, &p.title, &p.researcher, &p.institution, &p.abstract_text, &p.requested_budget, &p.status, &p.submitted_at.to_rfc3339()),
        )?;
        Ok(())
    }

    pub fn list_proposals(&self, status: Option<&str>) -> IssobellaResult<Vec<ResearchProposal>> {
        let sql = match status {
            Some(_s) => "SELECT id, title, researcher, institution, abstract_text, requested_budget, status, submitted_at, reviewed_at, reviewer_notes FROM research_proposals WHERE status = ?1 ORDER BY submitted_at DESC",
            None => "SELECT id, title, researcher, institution, abstract_text, requested_budget, status, submitted_at, reviewed_at, reviewer_notes FROM research_proposals ORDER BY submitted_at DESC",
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = match status {
            Some(s) => stmt.query_map([s], row_to_proposal)?,
            None => stmt.query_map([], row_to_proposal)?,
        };
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    // ── Fund balance ──

    pub fn get_fund_balance(&self) -> IssobellaResult<FundBalance> {
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

    pub fn update_fund_balance(&self, balance: &FundBalance) -> IssobellaResult<()> {
        self.conn.execute(
            "UPDATE fund_balance SET total_accumulated = ?1, total_disbursed = ?2, last_block_height = ?3, updated_at = ?4 WHERE id = 1",
            (&balance.total_accumulated, &balance.total_disbursed, &balance.last_block_height, &balance.updated_at),
        )?;
        Ok(())
    }
}

fn row_to_mission(row: &rusqlite::Row) -> Result<MissionRecord, rusqlite::Error> {
    Ok(MissionRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        mission_type: row.get(3)?,
        budget_zion: row.get(4)?,
        spent_zion: row.get(5)?,
        status: row.get(6)?,
        target_launch_date: row.get(7)?,
        started_at: row
            .get::<_, Option<String>>(8)?
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        completed_at: row
            .get::<_, Option<String>>(9)?
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        orbit_altitude_km: row.get(10)?,
        satellite_count: row.get(11)?,
    })
}

fn row_to_proposal(row: &rusqlite::Row) -> Result<ResearchProposal, rusqlite::Error> {
    Ok(ResearchProposal {
        id: row.get(0)?,
        title: row.get(1)?,
        researcher: row.get(2)?,
        institution: row.get(3)?,
        abstract_text: row.get(4)?,
        requested_budget: row.get(5)?,
        status: row.get(6)?,
        submitted_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        reviewed_at: row
            .get::<_, Option<String>>(8)?
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        reviewer_notes: row.get(9)?,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionRecord {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub mission_type: String, // observatory | cubesat | research | mesh_network
    pub budget_zion: u64,
    pub spent_zion: u64,
    pub status: String, // planning | approved | launched | operational | completed | cancelled
    pub target_launch_date: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub orbit_altitude_km: Option<f64>,
    pub satellite_count: i64,
}

impl MissionRecord {
    pub fn new(name: &str, mission_type: &str, budget: u64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            description: None,
            mission_type: mission_type.to_string(),
            budget_zion: budget,
            spent_zion: 0,
            status: "planning".to_string(),
            target_launch_date: None,
            started_at: None,
            completed_at: None,
            orbit_altitude_km: None,
            satellite_count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchProposal {
    pub id: String,
    pub title: String,
    pub researcher: Option<String>,
    pub institution: Option<String>,
    pub abstract_text: Option<String>,
    pub requested_budget: u64,
    pub status: String, // submitted | under_review | approved | rejected | funded
    pub submitted_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewer_notes: Option<String>,
}

impl ResearchProposal {
    pub fn new(title: &str, budget: u64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            researcher: None,
            institution: None,
            abstract_text: None,
            requested_budget: budget,
            status: "submitted".to_string(),
            submitted_at: Utc::now(),
            reviewed_at: None,
            reviewer_notes: None,
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
