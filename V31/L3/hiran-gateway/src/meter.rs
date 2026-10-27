//! Usage metering + plan tiers (SQLite via rusqlite — sync, tiny ops).

use anyhow::Result;
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::sync::Mutex;

/// sha256(key) — raw API keys are never stored by the gateway either.
pub fn key_hash(key: &str) -> String {
    hex::encode(Sha256::digest(key.as_bytes()))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Plan {
    Free,
    Pro,
    Team,
}

impl Plan {
    pub fn as_str(&self) -> &'static str {
        match self {
            Plan::Free => "free",
            Plan::Pro => "pro",
            Plan::Team => "team",
        }
    }
    pub fn parse(s: &str) -> Self {
        match s {
            "pro" => Plan::Pro,
            "team" => Plan::Team,
            _ => Plan::Free,
        }
    }
    /// (requests per minute, tokens per day)
    pub fn limits(&self) -> (u32, u64) {
        match self {
            Plan::Free => (20, 200_000),
            Plan::Pro => (120, 5_000_000),
            Plan::Team => (600, 25_000_000),
        }
    }
}

#[derive(Debug, Clone)]
pub struct UsageRow {
    pub day: String,
    pub requests: i64,
    pub total_tok: i64,
}

pub struct Meter {
    conn: Mutex<Connection>,
}

impl Meter {
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS usage_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_hash TEXT NOT NULL,
                user_id TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_tok INTEGER NOT NULL,
                completion_tok INTEGER NOT NULL,
                total_tok INTEGER NOT NULL,
                upstream TEXT NOT NULL,
                latency_ms INTEGER NOT NULL,
                estimated INTEGER NOT NULL DEFAULT 0,
                ts INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_usage_key_ts ON usage_records(key_hash, ts);
            CREATE TABLE IF NOT EXISTS usage_daily (
                key_hash TEXT NOT NULL,
                day TEXT NOT NULL,
                tokens INTEGER NOT NULL,
                requests INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(key_hash, day)
            );
            CREATE TABLE IF NOT EXISTS plans (
                key_hash TEXT PRIMARY KEY,
                plan TEXT NOT NULL,
                updated INTEGER NOT NULL
            );",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_plan(&self, kh: &str) -> Plan {
        self.conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT plan FROM plans WHERE key_hash = ?1",
                params![kh],
                |r| r.get::<_, String>(0),
            )
            .map(|p| Plan::parse(&p))
            .unwrap_or(Plan::Free)
    }

    pub fn set_plan(&self, kh: &str, plan: Plan) -> Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO plans(key_hash, plan, updated) VALUES(?1, ?2, ?3)
             ON CONFLICT(key_hash) DO UPDATE SET plan = excluded.plan, updated = excluded.updated",
            params![kh, plan.as_str(), chrono::Utc::now().timestamp()],
        )?;
        Ok(())
    }

    pub fn list_plans(&self) -> Result<Vec<(String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut st = conn.prepare("SELECT key_hash, plan FROM plans ORDER BY updated DESC")?;
        let rows = st
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record(
        &self,
        kh: &str,
        user_id: &str,
        model: &str,
        prompt_tok: u64,
        completion_tok: u64,
        upstream: &str,
        latency_ms: u64,
        estimated: bool,
    ) -> Result<()> {
        let total = prompt_tok + completion_tok;
        let now = chrono::Utc::now();
        let day = now.format("%Y-%m-%d").to_string();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO usage_records
             (key_hash, user_id, model, prompt_tok, completion_tok, total_tok,
              upstream, latency_ms, estimated, ts)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                kh,
                user_id,
                model,
                prompt_tok as i64,
                completion_tok as i64,
                total as i64,
                upstream,
                latency_ms as i64,
                estimated as i64,
                now.timestamp()
            ],
        )?;
        conn.execute(
            "INSERT INTO usage_daily(key_hash, day, tokens, requests) VALUES(?1,?2,?3,1)
             ON CONFLICT(key_hash, day) DO UPDATE SET
               tokens = tokens + excluded.tokens,
               requests = requests + 1",
            params![kh, day, total as i64],
        )?;
        Ok(())
    }

    /// Today's token usage for a key (daily-quota enforcement).
    pub fn tokens_today(&self, kh: &str) -> u64 {
        let day = chrono::Utc::now().format("%Y-%m-%d").to_string();
        self.conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT tokens FROM usage_daily WHERE key_hash = ?1 AND day = ?2",
                params![kh, day],
                |r| r.get::<_, i64>(0),
            )
            .unwrap_or(0) as u64
    }

    /// Per-day usage for the key over the last N days.
    pub fn usage_for_key(&self, kh: &str, days: u32) -> Result<Vec<UsageRow>> {
        let conn = self.conn.lock().unwrap();
        let mut st = conn.prepare(
            "SELECT day, requests, tokens
             FROM usage_daily WHERE key_hash = ?1
             ORDER BY day DESC LIMIT ?2",
        )?;
        let rows = st
            .query_map(params![kh, days as i64], |r| {
                Ok(UsageRow {
                    day: r.get(0)?,
                    requests: r.get(1)?,
                    total_tok: r.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_limits() {
        assert_eq!(Plan::Free.limits(), (20, 200_000));
        assert_eq!(Plan::parse("pro").limits(), (120, 5_000_000));
        assert_eq!(Plan::parse("garbage"), Plan::Free);
    }

    #[test]
    fn meter_roundtrip() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let m = Meter::open(tmp.path().to_str().unwrap()).unwrap();
        let kh = key_hash("zis_testkey");
        assert_eq!(m.get_plan(&kh), Plan::Free);
        m.set_plan(&kh, Plan::Pro).unwrap();
        assert_eq!(m.get_plan(&kh), Plan::Pro);
        m.record(&kh, "u1", "hiran-mini", 10, 20, "u1", 500, false)
            .unwrap();
        m.record(&kh, "u1", "hiran-mini", 5, 5, "u1", 300, true)
            .unwrap();
        assert_eq!(m.tokens_today(&kh), 40);
        let rows = m.usage_for_key(&kh, 30).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].requests, 2);
        assert_eq!(rows[0].total_tok, 40);
    }

    #[test]
    fn key_hash_is_sha256() {
        // never store raw keys
        assert_eq!(key_hash("zis_abc").len(), 64);
        assert_ne!(key_hash("a"), key_hash("b"));
    }
}
