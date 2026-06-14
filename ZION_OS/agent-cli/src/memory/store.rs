use crate::config::AgentConfig;
use crate::llm::{Message, ToolCall};
use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::path::PathBuf;

/// Persistent SQLite store for agent sessions
pub struct SessionStore {
    conn: Connection,
}

impl SessionStore {
    pub fn new(cfg: &AgentConfig) -> Result<Self> {
        let db_path = cfg
            .paths
            .repo_root
            .join(".zion")
            .join("agent-sessions.db");
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(&db_path)
            .with_context(|| format!("Cannot open session DB: {}", db_path.display()))?;
        Self::init_schema(&conn)?;
        Ok(Self { conn })
    }

    fn init_schema(conn: &Connection) -> Result<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                task TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                step_count INTEGER NOT NULL DEFAULT 0,
                max_steps INTEGER NOT NULL DEFAULT 50,
                error_count INTEGER NOT NULL DEFAULT 0,
                retry_count INTEGER NOT NULL DEFAULT 0
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_name TEXT,
                tool_args TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)",
            [],
        )?;
        Ok(())
    }

    pub fn create_session(&self, id: &str, task: &str, max_steps: u32) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "INSERT INTO sessions (id, task, status, created_at, updated_at, max_steps)
             VALUES (?1, ?2, 'running', ?3, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
                task = excluded.task,
                status = 'resumed',
                updated_at = excluded.updated_at",
            params![id, task, now, max_steps],
        )?;
        Ok(())
    }

    pub fn save_messages(&self, session_id: &str, messages: &[Message]) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let tx = self.conn.unchecked_transaction()?;
        for msg in messages {
            tx.execute(
                "INSERT INTO messages (session_id, role, content, created_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![session_id, msg.role, msg.content, now],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn load_messages(&self, session_id: &str) -> Result<Vec<Message>> {
        let mut stmt = self.conn.prepare(
            "SELECT role, content FROM messages WHERE session_id = ?1 ORDER BY id ASC",
        )?;
        let rows = stmt.query_map([session_id], |row| {
            Ok(Message {
                role: row.get(0)?,
                content: row.get(1)?,
            })
        })?;
        let mut messages = Vec::new();
        for row in rows {
            messages.push(row?);
        }
        Ok(messages)
    }

    pub fn increment_step(&self, session_id: &str) -> Result<u32> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "UPDATE sessions SET step_count = step_count + 1, updated_at = ?2 WHERE id = ?1",
            params![session_id, now],
        )?;
        let count: u32 = self.conn.query_row(
            "SELECT step_count FROM sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_step_count(&self, session_id: &str) -> Result<u32> {
        let count: u32 = self.conn.query_row(
            "SELECT step_count FROM sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn increment_error(&self, session_id: &str) -> Result<u32> {
        self.conn.execute(
            "UPDATE sessions SET error_count = error_count + 1 WHERE id = ?1",
            [session_id],
        )?;
        let count: u32 = self.conn.query_row(
            "SELECT error_count FROM sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn increment_retry(&self, session_id: &str) -> Result<u32> {
        self.conn.execute(
            "UPDATE sessions SET retry_count = retry_count + 1 WHERE id = ?1",
            [session_id],
        )?;
        let count: u32 = self.conn.query_row(
            "SELECT retry_count FROM sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn set_status(&self, session_id: &str, status: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "UPDATE sessions SET status = ?2, updated_at = ?3 WHERE id = ?1",
            params![session_id, status, now],
        )?;
        Ok(())
    }

    pub fn list_sessions(&self, limit: usize) -> Result<Vec<SessionSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task, status, step_count, max_steps, error_count, updated_at
             FROM sessions ORDER BY updated_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit], |row| {
            Ok(SessionSummary {
                id: row.get(0)?,
                task: row.get(1)?,
                status: row.get(2)?,
                step_count: row.get(3)?,
                max_steps: row.get(4)?,
                error_count: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    pub fn delete_session(&self, session_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM sessions WHERE id = ?1",
            [session_id],
        )?;
        Ok(())
    }

    pub fn get_last_session(&self) -> Result<Option<SessionSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task, status, step_count, max_steps, error_count, updated_at
             FROM sessions ORDER BY updated_at DESC LIMIT 1",
        )?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SessionSummary {
                id: row.get(0)?,
                task: row.get(1)?,
                status: row.get(2)?,
                step_count: row.get(3)?,
                max_steps: row.get(4)?,
                error_count: row.get(5)?,
                updated_at: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug, Clone)]
pub struct SessionSummary {
    pub id: String,
    pub task: String,
    pub status: String,
    pub step_count: u32,
    pub max_steps: u32,
    pub error_count: u32,
    pub updated_at: i64,
}
