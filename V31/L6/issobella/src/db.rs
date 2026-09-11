//! SQLite persistence for zion-issobella.

use crate::error::{IssobellaError, IssobellaResult};
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
                satellite_count INTEGER DEFAULT 0,
                funding_address TEXT
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

            CREATE TABLE IF NOT EXISTS disbursements (
                id TEXT PRIMARY KEY,
                mission_id TEXT NOT NULL,
                amount_zion INTEGER NOT NULL,
                recipient TEXT,
                tx_hash TEXT,
                disbursed_at TEXT NOT NULL
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
            "INSERT INTO missions (id, name, description, mission_type, budget_zion, status, target_launch_date, started_at, orbit_altitude_km, satellite_count, funding_address)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            (&m.id, &m.name, &m.description, &m.mission_type, &m.budget_zion, &m.status,
             &m.target_launch_date, &m.started_at.map(|t| t.to_rfc3339()), &m.orbit_altitude_km, &m.satellite_count,
             &m.funding_address),
        )?;
        Ok(())
    }

    pub fn get_mission(&self, id: &str) -> IssobellaResult<MissionRecord> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, description, mission_type, budget_zion, spent_zion, status, target_launch_date, started_at, completed_at, orbit_altitude_km, satellite_count, funding_address FROM missions WHERE id = ?1"
        )?;
        let row = stmt.query_row([id], row_to_mission).optional()?;
        row.ok_or_else(|| IssobellaError::MissionNotFound(id.to_string()))
    }

    pub fn list_missions(&self, status: Option<&str>) -> IssobellaResult<Vec<MissionRecord>> {
        let sql = match status {
            Some(_s) => "SELECT id, name, description, mission_type, budget_zion, spent_zion, status, target_launch_date, started_at, completed_at, orbit_altitude_km, satellite_count, funding_address FROM missions WHERE status = ?1 ORDER BY started_at DESC",
            None => "SELECT id, name, description, mission_type, budget_zion, spent_zion, status, target_launch_date, started_at, completed_at, orbit_altitude_km, satellite_count, funding_address FROM missions ORDER BY started_at DESC",
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = match status {
            Some(s) => stmt.query_map([s], row_to_mission)?,
            None => stmt.query_map([], row_to_mission)?,
        };
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn update_mission_status(&self, id: &str, status: &str) -> IssobellaResult<MissionRecord> {
        let current = self.get_mission(id)?;
        if !is_valid_mission_transition(&current.status, status) {
            return Err(IssobellaError::InvalidMissionTransition {
                from: current.status,
                to: status.to_string(),
            });
        }

        let started_at = if status == "operational" || status == "launched" {
            Some(Utc::now().to_rfc3339())
        } else {
            None
        };
        let completed_at = if status == "completed" {
            Some(Utc::now().to_rfc3339())
        } else {
            None
        };

        self.conn.execute(
            "UPDATE missions SET status = ?1, started_at = COALESCE(started_at, ?2), completed_at = COALESCE(completed_at, ?3) WHERE id = ?4",
            (status, &started_at, &completed_at, id),
        )?;
        self.get_mission(id)
    }

    pub fn update_mission_spent_and_satellites(
        &self,
        id: &str,
        spent_delta: u64,
        satellite_count: Option<i64>,
    ) -> IssobellaResult<MissionRecord> {
        let mission = self.get_mission(id)?;
        let new_spent = mission.spent_zion.saturating_add(spent_delta);
        if new_spent > mission.budget_zion {
            return Err(IssobellaError::InsufficientFunds {
                required: new_spent,
                available: mission.budget_zion,
            });
        }
        let satellite_count = satellite_count.unwrap_or(mission.satellite_count);

        self.conn.execute(
            "UPDATE missions SET spent_zion = ?1, satellite_count = ?2 WHERE id = ?3",
            (new_spent, satellite_count, id),
        )?;
        self.get_mission(id)
    }

    // ── Observations ──

    pub fn insert_observation(&self, o: &ObservationRecord) -> IssobellaResult<()> {
        self.conn.execute(
            "INSERT INTO observations (id, mission_id, observation_type, data_url, metadata, recorded_at, published)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (&o.id, &o.mission_id, &o.observation_type, &o.data_url, &o.metadata, &o.recorded_at.to_rfc3339(), &o.published),
        )?;
        Ok(())
    }

    pub fn get_observation(&self, id: &str) -> IssobellaResult<ObservationRecord> {
        let mut stmt = self.conn.prepare(
            "SELECT id, mission_id, observation_type, data_url, metadata, recorded_at, published FROM observations WHERE id = ?1"
        )?;
        let row = stmt.query_row([id], row_to_observation).optional()?;
        row.ok_or_else(|| IssobellaError::ObservationNotFound(id.to_string()))
    }

    pub fn list_observations(
        &self,
        mission_id: Option<&str>,
    ) -> IssobellaResult<Vec<ObservationRecord>> {
        let sql = match mission_id {
            Some(_s) => "SELECT id, mission_id, observation_type, data_url, metadata, recorded_at, published FROM observations WHERE mission_id = ?1 ORDER BY recorded_at DESC",
            None => "SELECT id, mission_id, observation_type, data_url, metadata, recorded_at, published FROM observations ORDER BY recorded_at DESC",
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = match mission_id {
            Some(s) => stmt.query_map([s], row_to_observation)?,
            None => stmt.query_map([], row_to_observation)?,
        };
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn update_observation(&self, o: &ObservationRecord) -> IssobellaResult<()> {
        self.conn.execute(
            "UPDATE observations SET mission_id = ?1, observation_type = ?2, data_url = ?3, metadata = ?4, recorded_at = ?5, published = ?6 WHERE id = ?7",
            (&o.mission_id, &o.observation_type, &o.data_url, &o.metadata, &o.recorded_at.to_rfc3339(), &o.published, &o.id),
        )?;
        Ok(())
    }

    // ── Disbursements ──

    pub fn record_disbursement(&self, d: &DisbursementRecord) -> IssobellaResult<()> {
        self.conn.execute(
            "INSERT INTO disbursements (id, mission_id, amount_zion, recipient, tx_hash, disbursed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (&d.id, &d.mission_id, &d.amount_zion, &d.recipient, &d.tx_hash, &d.disbursed_at.to_rfc3339()),
        )?;
        Ok(())
    }

    pub fn get_disbursement(&self, id: &str) -> IssobellaResult<DisbursementRecord> {
        let mut stmt = self.conn.prepare(
            "SELECT id, mission_id, amount_zion, recipient, tx_hash, disbursed_at FROM disbursements WHERE id = ?1"
        )?;
        let row = stmt.query_row([id], row_to_disbursement).optional()?;
        row.ok_or_else(|| IssobellaError::DisbursementNotFound(id.to_string()))
    }

    pub fn list_disbursements(
        &self,
        mission_id: Option<&str>,
    ) -> IssobellaResult<Vec<DisbursementRecord>> {
        let sql = match mission_id {
            Some(_s) => "SELECT id, mission_id, amount_zion, recipient, tx_hash, disbursed_at FROM disbursements WHERE mission_id = ?1 ORDER BY disbursed_at DESC",
            None => "SELECT id, mission_id, amount_zion, recipient, tx_hash, disbursed_at FROM disbursements ORDER BY disbursed_at DESC",
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = match mission_id {
            Some(s) => stmt.query_map([s], row_to_disbursement)?,
            None => stmt.query_map([], row_to_disbursement)?,
        };
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn add_disbursement_to_fund_balance(&self, amount: u64) -> IssobellaResult<FundBalance> {
        let mut balance = self.get_fund_balance()?;
        balance.total_disbursed = balance.total_disbursed.saturating_add(amount);
        balance.updated_at = Utc::now().to_rfc3339();
        self.update_fund_balance(&balance)?;
        Ok(balance)
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

    pub fn get_proposal(&self, id: &str) -> IssobellaResult<ResearchProposal> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, researcher, institution, abstract_text, requested_budget, status, submitted_at, reviewed_at, reviewer_notes FROM research_proposals WHERE id = ?1"
        )?;
        let row = stmt.query_row([id], row_to_proposal).optional()?;
        row.ok_or_else(|| IssobellaError::ProposalNotFound(id.to_string()))
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

    pub fn update_proposal_status(
        &self,
        id: &str,
        status: &str,
        reviewer_notes: Option<&str>,
    ) -> IssobellaResult<ResearchProposal> {
        let current = self.get_proposal(id)?;
        if !is_valid_proposal_transition(&current.status, status) {
            return Err(IssobellaError::InvalidProposalTransition {
                from: current.status,
                to: status.to_string(),
            });
        }

        let reviewed_at = Some(Utc::now().to_rfc3339());
        let notes = reviewer_notes.map(|s| s.to_string());

        self.conn.execute(
            "UPDATE research_proposals SET status = ?1, reviewed_at = ?2, reviewer_notes = ?3 WHERE id = ?4",
            (status, &reviewed_at, &notes, id),
        )?;
        self.get_proposal(id)
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

fn is_valid_mission_transition(from: &str, to: &str) -> bool {
    let allowed: &[&str] = match from {
        "planning" => &["approved", "launched", "cancelled"],
        "approved" => &["operational", "cancelled"],
        "launched" => &["operational", "cancelled"],
        "operational" => &["completed", "cancelled"],
        _ => &[],
    };
    allowed.contains(&to)
}

fn is_valid_proposal_transition(from: &str, to: &str) -> bool {
    let allowed: &[&str] = match from {
        "submitted" => &["under_review", "approved", "rejected"],
        "under_review" => &["approved", "rejected"],
        "approved" => &["funded"],
        _ => &[],
    };
    allowed.contains(&to)
}

fn parse_utc(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}

fn parse_utc_opt(s: Option<&str>) -> Option<DateTime<Utc>> {
    s.and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
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
        started_at: parse_utc_opt(row.get::<_, Option<String>>(8)?.as_deref()),
        completed_at: parse_utc_opt(row.get::<_, Option<String>>(9)?.as_deref()),
        orbit_altitude_km: row.get(10)?,
        satellite_count: row.get(11)?,
        funding_address: row.get(12)?,
    })
}

fn row_to_observation(row: &rusqlite::Row) -> Result<ObservationRecord, rusqlite::Error> {
    Ok(ObservationRecord {
        id: row.get(0)?,
        mission_id: row.get(1)?,
        observation_type: row.get(2)?,
        data_url: row.get(3)?,
        metadata: row.get(4)?,
        recorded_at: parse_utc(&row.get::<_, String>(5)?),
        published: row.get(6)?,
    })
}

fn row_to_disbursement(row: &rusqlite::Row) -> Result<DisbursementRecord, rusqlite::Error> {
    Ok(DisbursementRecord {
        id: row.get(0)?,
        mission_id: row.get(1)?,
        amount_zion: row.get(2)?,
        recipient: row.get(3)?,
        tx_hash: row.get(4)?,
        disbursed_at: parse_utc(&row.get::<_, String>(5)?),
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
        submitted_at: parse_utc(&row.get::<_, String>(7)?),
        reviewed_at: parse_utc_opt(row.get::<_, Option<String>>(8)?.as_deref()),
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
    pub funding_address: Option<String>,
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
            funding_address: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservationRecord {
    pub id: String,
    pub mission_id: String,
    pub observation_type: String, // image | spectroscopy | telemetry | radar
    pub data_url: Option<String>,
    pub metadata: Option<String>,
    pub recorded_at: DateTime<Utc>,
    pub published: bool,
}

impl ObservationRecord {
    pub fn new(mission_id: &str, observation_type: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            mission_id: mission_id.to_string(),
            observation_type: observation_type.to_string(),
            data_url: None,
            metadata: None,
            recorded_at: Utc::now(),
            published: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisbursementRecord {
    pub id: String,
    pub mission_id: String,
    pub amount_zion: u64,
    pub recipient: Option<String>,
    pub tx_hash: Option<String>,
    pub disbursed_at: DateTime<Utc>,
}

impl DisbursementRecord {
    pub fn new(mission_id: &str, amount_zion: u64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            mission_id: mission_id.to_string(),
            amount_zion,
            recipient: None,
            tx_hash: None,
            disbursed_at: Utc::now(),
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
