use crate::types::*;
use anyhow::Result;
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Arc;
use tokio::sync::Mutex;

/// SQLite database for swap state tracking
pub struct SwapDb {
    conn: Connection,
}

impl SwapDb {
    /// Open a database file
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::init_schema(&conn)?;
        Ok(Self { conn })
    }

    /// Open an in-memory database (for tests)
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::init_schema(&conn)?;
        Ok(Self { conn })
    }

    fn init_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS swaps (
                id TEXT PRIMARY KEY,
                quote_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                recipient TEXT NOT NULL,
                src_chain TEXT NOT NULL,
                dest_chain TEXT NOT NULL,
                amount_in TEXT NOT NULL,
                amount_out TEXT,
                status TEXT NOT NULL,
                steps_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS quotes (
                id TEXT PRIMARY KEY,
                request_json TEXT NOT NULL,
                response_json TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status);
            CREATE INDEX IF NOT EXISTS idx_swaps_sender ON swaps(sender);
            CREATE INDEX IF NOT EXISTS idx_quotes_expires ON quotes(expires_at);
            "#,
        )?;
        Ok(())
    }

    /// Insert a new swap record
    pub fn insert_swap(&self, record: &SwapRecord) -> Result<()> {
        self.conn.execute(
            r#"INSERT INTO swaps (id, quote_id, sender, recipient, src_chain, dest_chain,
               amount_in, amount_out, status, steps_json, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"#,
            rusqlite::params![
                record.id,
                record.quote_id,
                record.sender,
                record.recipient,
                record.src_chain.name(),
                record.dest_chain.name(),
                record.amount_in,
                record.amount_out,
                status_str(record.status),
                serde_json::to_string(&record.steps)?,
                record.created_at.to_rfc3339(),
                record.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// Get a swap by ID
    pub fn get_swap(&self, id: &str) -> Result<Option<SwapRecord>> {
        let mut stmt = self.conn.prepare(
            r#"SELECT id, quote_id, sender, recipient, src_chain, dest_chain,
               amount_in, amount_out, status, steps_json, created_at, updated_at
               FROM swaps WHERE id = ?1"#,
        )?;

        let row = stmt.query_row(rusqlite::params![id], |row| {
            Ok(SwapRow {
                id: row.get(0)?,
                quote_id: row.get(1)?,
                sender: row.get(2)?,
                recipient: row.get(3)?,
                src_chain: row.get(4)?,
                dest_chain: row.get(5)?,
                amount_in: row.get(6)?,
                amount_out: row.get(7)?,
                status: row.get(8)?,
                steps_json: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        });

        match row {
            Ok(r) => Ok(Some(r.into_record()?)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// List recent swaps
    pub fn list_swaps(&self, limit: usize) -> Result<Vec<SwapRecord>> {
        let mut stmt = self.conn.prepare(
            r#"SELECT id, quote_id, sender, recipient, src_chain, dest_chain,
               amount_in, amount_out, status, steps_json, created_at, updated_at
               FROM swaps ORDER BY created_at DESC LIMIT ?1"#,
        )?;

        let rows = stmt.query_map(rusqlite::params![limit as i64], |row| {
            Ok(SwapRow {
                id: row.get(0)?,
                quote_id: row.get(1)?,
                sender: row.get(2)?,
                recipient: row.get(3)?,
                src_chain: row.get(4)?,
                dest_chain: row.get(5)?,
                amount_in: row.get(6)?,
                amount_out: row.get(7)?,
                status: row.get(8)?,
                steps_json: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut records = Vec::new();
        for row in rows {
            let r = row?;
            records.push(r.into_record()?);
        }
        Ok(records)
    }

    /// Update swap status
    pub fn update_status(&self, id: &str, status: SwapStatus) -> Result<()> {
        self.conn.execute(
            r#"UPDATE swaps SET status = ?1, updated_at = ?2 WHERE id = ?3"#,
            rusqlite::params![status_str(status), Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    /// Update swap amount_out and steps
    pub fn update_swap(&self, id: &str, amount_out: Option<&str>, steps: &[StepStatus]) -> Result<()> {
        self.conn.execute(
            r#"UPDATE swaps SET amount_out = ?1, steps_json = ?2, updated_at = ?3 WHERE id = ?4"#,
            rusqlite::params![
                amount_out,
                serde_json::to_string(steps)?,
                Utc::now().to_rfc3339(),
                id,
            ],
        )?;
        Ok(())
    }

    /// Store a quote
    pub fn insert_quote(&self, quote_id: &str, request: &QuoteRequest, response: &QuoteResponse) -> Result<()> {
        self.conn.execute(
            r#"INSERT INTO quotes (id, request_json, response_json, expires_at, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5)"#,
            rusqlite::params![
                quote_id,
                serde_json::to_string(request)?,
                serde_json::to_string(response)?,
                response.expires_at.to_rfc3339(),
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// Get a quote by ID
    pub fn get_quote(&self, quote_id: &str) -> Result<Option<QuoteResponse>> {
        let mut stmt = self.conn.prepare(
            r#"SELECT response_json FROM quotes WHERE id = ?1 AND expires_at > ?2"#,
        )?;

        let row = stmt.query_row(
            rusqlite::params![quote_id, Utc::now().to_rfc3339()],
            |row| row.get::<_, String>(0),
        );

        match row {
            Ok(json) => {
                let response: QuoteResponse = serde_json::from_str(&json)?;
                Ok(Some(response))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Clean up expired quotes
    pub fn cleanup_expired_quotes(&self) -> Result<()> {
        self.conn.execute(
            r#"DELETE FROM quotes WHERE expires_at < ?1"#,
            rusqlite::params![Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }
}

/// Internal row representation
struct SwapRow {
    id: String,
    quote_id: String,
    sender: String,
    recipient: String,
    src_chain: String,
    dest_chain: String,
    amount_in: String,
    amount_out: Option<String>,
    status: String,
    steps_json: String,
    created_at: String,
    updated_at: String,
}

impl SwapRow {
    fn into_record(self) -> Result<SwapRecord> {
        let src_chain: ChainId = self.src_chain.parse()?;
        let dest_chain: ChainId = self.dest_chain.parse()?;
        let status = parse_status(&self.status);
        let steps: Vec<StepStatus> = serde_json::from_str(&self.steps_json)?;

        Ok(SwapRecord {
            id: self.id,
            quote_id: self.quote_id,
            sender: self.sender,
            recipient: self.recipient,
            src_chain,
            dest_chain,
            amount_in: self.amount_in,
            amount_out: self.amount_out,
            status,
            steps,
            created_at: chrono::DateTime::parse_from_rfc3339(&self.created_at)?.with_timezone(&Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&self.updated_at)?.with_timezone(&Utc),
        })
    }
}

fn status_str(s: SwapStatus) -> &'static str {
    match s {
        SwapStatus::Pending => "pending",
        SwapStatus::Executing => "executing",
        SwapStatus::Completed => "completed",
        SwapStatus::Failed => "failed",
        SwapStatus::Refunded => "refunded",
    }
}

fn parse_status(s: &str) -> SwapStatus {
    match s {
        "pending" => SwapStatus::Pending,
        "executing" => SwapStatus::Executing,
        "completed" => SwapStatus::Completed,
        "failed" => SwapStatus::Failed,
        "refunded" => SwapStatus::Refunded,
        _ => SwapStatus::Pending,
    }
}

/// Thread-safe wrapper for the database
pub type SharedDb = Arc<Mutex<SwapDb>>;

pub fn shared_db(path: &str) -> Result<SharedDb> {
    Ok(Arc::new(Mutex::new(SwapDb::open(path)?)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_create_and_get_swap() {
        let db = SwapDb::open_in_memory().unwrap();
        let record = SwapRecord {
            id: "swap_test1".into(),
            quote_id: "q_test1".into(),
            sender: "zion1test".into(),
            recipient: "0x1234".into(),
            src_chain: ChainId::Zion,
            dest_chain: ChainId::Base,
            amount_in: "1000".into(),
            amount_out: Some("995".into()),
            status: SwapStatus::Pending,
            steps: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        db.insert_swap(&record).unwrap();
        let fetched = db.get_swap("swap_test1").unwrap();
        assert!(fetched.is_some());
        let fetched = fetched.unwrap();
        assert_eq!(fetched.amount_in, "1000");
        assert_eq!(fetched.amount_out, Some("995".into()));
    }

    #[test]
    fn test_db_list_swaps() {
        let db = SwapDb::open_in_memory().unwrap();
        for i in 0..5 {
            let record = SwapRecord {
                id: format!("swap_{}", i),
                quote_id: format!("q_{}", i),
                sender: "zion1test".into(),
                recipient: "0x1234".into(),
                src_chain: ChainId::Zion,
                dest_chain: ChainId::Base,
                amount_in: "1000".into(),
                amount_out: None,
                status: SwapStatus::Pending,
                steps: vec![],
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            db.insert_swap(&record).unwrap();
        }
        let list = db.list_swaps(3).unwrap();
        assert_eq!(list.len(), 3);
    }

    #[test]
    fn test_db_update_status() {
        let db = SwapDb::open_in_memory().unwrap();
        let record = SwapRecord {
            id: "swap_status".into(),
            quote_id: "q_1".into(),
            sender: "zion1test".into(),
            recipient: "0x1234".into(),
            src_chain: ChainId::Zion,
            dest_chain: ChainId::Base,
            amount_in: "1000".into(),
            amount_out: None,
            status: SwapStatus::Pending,
            steps: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        db.insert_swap(&record).unwrap();
        db.update_status("swap_status", SwapStatus::Completed).unwrap();
        let fetched = db.get_swap("swap_status").unwrap().unwrap();
        assert_eq!(fetched.status, SwapStatus::Completed);
    }
}
