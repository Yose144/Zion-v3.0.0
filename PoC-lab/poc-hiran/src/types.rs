//! Datové typy pro Hiran HTTP API.

use serde::{Deserialize, Serialize};
use thiserror::Error;

// ── Request ──────────────────────────────────────────────────────────────────

/// Žádost odeslaná Hiranu pro validaci care proof.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiranRequest {
    /// ID validátora, který proof submittoval.
    pub validator_id: String,
    /// ID přiřazeného tasku.
    pub task_id: String,
    /// Naměřené care_score (0–100).
    pub care_score: u32,
    /// Číslo epochy.
    pub epoch: u64,
    /// Volitelný hex output hash NPU inference.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_hash: Option<String>,
    /// Volitelný textový kontext pro Dharma validaci.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
}

impl HiranRequest {
    /// Jednoduchý konstruktor pro validaci proof.
    pub fn validate_proof(
        validator_id: impl Into<String>,
        task_id: impl Into<String>,
        care_score: u32,
        epoch: u64,
    ) -> Self {
        Self {
            validator_id: validator_id.into(),
            task_id: task_id.into(),
            care_score,
            epoch,
            output_hash: None,
            context: None,
        }
    }

    /// Přidá output_hash k requestu (builder pattern).
    pub fn with_output_hash(mut self, hash: impl Into<String>) -> Self {
        self.output_hash = Some(hash.into());
        self
    }

    /// Přidá textový kontext k requestu (builder pattern).
    pub fn with_context(mut self, ctx: impl Into<String>) -> Self {
        self.context = Some(ctx.into());
        self
    }
}

// ── Response ─────────────────────────────────────────────────────────────────

/// Odpověď Hiran serveru na validaci proof.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiranResponse {
    /// `true` = proof přijat, `false` = zamítnut.
    pub accepted: bool,
    /// Bayesovská jistota 0.0–1.0. Pod 0.7 → Uncertain.
    pub confidence: f64,
    /// Volitelná signed korekce care_score. Záporná = penalizace.
    #[serde(default)]
    pub care_score_adjustment: i64,
    /// Lidsky čitelné flagy detekované Hiranem.
    #[serde(default)]
    pub flags: Vec<String>,
    /// Krátký reasoning řetězec pro audit log.
    pub reasoning: String,
    /// Latence inference volání v ms (měřeno klientem).
    #[serde(default)]
    pub latency_ms: u64,
}

impl HiranResponse {
    /// Vrátí `true` pokud proof byl přijat.
    pub fn accepted(&self) -> bool {
        self.accepted
    }

    /// Vrátí `true` pokud je jistota pod prahem (0.7).
    pub fn is_uncertain(&self) -> bool {
        self.confidence < 0.7
    }

    /// Konstruktor pro stub accepted odpověď.
    pub fn stub_accepted() -> Self {
        Self {
            accepted: true,
            confidence: 1.0,
            care_score_adjustment: 0,
            flags: vec![],
            reasoning: "stub: Hiran not reachable — structural check only".into(),
            latency_ms: 0,
        }
    }

    /// Konstruktor pro stub rejected odpověď.
    pub fn stub_rejected(reason: impl Into<String>) -> Self {
        Self {
            accepted: false,
            confidence: 1.0,
            care_score_adjustment: 0,
            flags: vec!["structural_check_failed".into()],
            reasoning: reason.into(),
            latency_ms: 0,
        }
    }
}

// ── Error ─────────────────────────────────────────────────────────────────────

/// Chyby při komunikaci s Hiran serverem.
#[derive(Debug, Error)]
pub enum HiranError {
    #[error("HTTP request failed: {0}")]
    Http(String),

    #[error("JSON parse error: {0}")]
    Json(String),

    #[error("Hiran server returned status {status}: {body}")]
    ServerError { status: u16, body: String },

    #[error("Connection refused — is Hiran running at {url}?")]
    ConnectionRefused { url: String },

    #[error("Request timed out after {ms}ms")]
    Timeout { ms: u64 },
}

impl From<ureq::Error> for HiranError {
    fn from(e: ureq::Error) -> Self {
        match e {
            ureq::Error::Status(code, resp) => {
                let body = resp.into_string().unwrap_or_default();
                HiranError::ServerError { status: code, body }
            }
            ureq::Error::Transport(t) => {
                let msg = t.to_string();
                if msg.contains("Connection refused") || msg.contains("connect") {
                    // Extract URL from the error message if possible
                    HiranError::Http(format!("connection failed: {msg}"))
                } else if msg.contains("timed out") || msg.contains("timeout") {
                    HiranError::Timeout { ms: 30_000 }
                } else {
                    HiranError::Http(msg)
                }
            }
        }
    }
}
