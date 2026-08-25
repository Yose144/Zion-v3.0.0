//! Immutable audit log for multichain wallet, swap and auth operations.
//!
//! All user-facing mutating operations (swap, withdraw, HTLC, auth) should
//! record an `AuditLog` entry. Logs are append-only in SQLite and are keyed
//! by actor (`user_id`) and resource for fast forensics.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::db::Db;
use crate::error::MultichainResult;

/// Result of an auditable action.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditResult {
    Success,
    Failure,
    Rejected,
}

impl std::fmt::Display for AuditResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Success => write!(f, "success"),
            Self::Failure => write!(f, "failure"),
            Self::Rejected => write!(f, "rejected"),
        }
    }
}

impl std::str::FromStr for AuditResult {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "success" => Ok(Self::Success),
            "failure" => Ok(Self::Failure),
            "rejected" => Ok(Self::Rejected),
            _ => Err(format!("unknown audit result: {s}")),
        }
    }
}

/// A single immutable audit log entry.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub details: serde_json::Value,
    pub result: AuditResult,
    pub error_message: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

impl AuditLog {
    /// Create a new audit log with the current timestamp.
    pub fn new(
        user_id: Option<String>,
        action: impl Into<String>,
        resource_type: impl Into<String>,
        resource_id: Option<String>,
        details: serde_json::Value,
        result: AuditResult,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            user_id,
            action: action.into(),
            resource_type: resource_type.into(),
            resource_id,
            details,
            result,
            error_message: None,
            ip_address: None,
            user_agent: None,
        }
    }

    pub fn with_error(mut self, message: impl Into<String>) -> Self {
        self.error_message = Some(message.into());
        self
    }

    pub fn with_ip(mut self, ip: impl Into<String>) -> Self {
        self.ip_address = Some(ip.into());
        self
    }

    pub fn with_user_agent(mut self, ua: impl Into<String>) -> Self {
        self.user_agent = Some(ua.into());
        self
    }
}

/// Async logger backed by the shared SQLite `Db`.
#[derive(Clone)]
pub struct AuditLogger {
    db: Arc<Mutex<Db>>,
}

impl AuditLogger {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }

    /// Append an audit log entry.
    pub async fn record(&self, log: AuditLog) -> MultichainResult<()> {
        let db = self.db.lock().await;
        db.record_audit_log(&log)
    }

    /// Query recent logs for a user, newest first.
    pub async fn for_user(&self, user_id: &str, limit: usize) -> MultichainResult<Vec<AuditLog>> {
        let db = self.db.lock().await;
        db.load_audit_logs_for_user(user_id, limit)
    }

    /// Record a simple success/failure event in one call.
    #[allow(clippy::too_many_arguments)]
    pub async fn log(
        &self,
        user_id: Option<&str>,
        action: &str,
        resource_type: &str,
        resource_id: Option<&str>,
        details: serde_json::Value,
        result: AuditResult,
        error: Option<&str>,
    ) -> MultichainResult<()> {
        let mut log = AuditLog::new(
            user_id.map(String::from),
            action,
            resource_type,
            resource_id.map(String::from),
            details,
            result,
        );
        if let Some(e) = error {
            log.error_message = Some(e.to_string());
        }
        self.record(log).await
    }
}
