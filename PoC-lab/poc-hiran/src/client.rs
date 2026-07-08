//! HiranClient trait + implementace: LiveHiranClient (ureq) + StubHiranClient.

use std::time::{Duration, Instant};

use crate::types::{HiranError, HiranRequest, HiranResponse};

// ── Trait ─────────────────────────────────────────────────────────────────────

/// Abstrakce nad Hiran inference serverem.
///
/// Implementace:
/// - [`LiveHiranClient`] — skutečné HTTP volání (ureq, synchronní)
/// - [`StubHiranClient`] — offline stub pro testy (bez sítě)
pub trait HiranClient: Send + Sync {
    /// Odešle validaci proof Hiranu a vrátí odpověď.
    fn validate(&self, req: &HiranRequest) -> Result<HiranResponse, HiranError>;

    /// Zkontroluje dostupnost Hiran serveru (GET /health).
    /// Vrátí `Ok(true)` pokud server odpovídá, `Ok(false)` pokud je nedostupný.
    fn health_check(&self) -> bool {
        false // default: stub
    }

    /// Vrátí `true` pokud klient je stub (bez sítě).
    fn is_stub(&self) -> bool {
        true
    }

    /// Vrátí URL serveru nebo `"stub"`.
    fn server_url(&self) -> &str {
        "stub"
    }
}

// ── LiveHiranClient ───────────────────────────────────────────────────────────

/// HTTP klient pro živý Hiran inference server.
///
/// Odesílá OpenAI-kompatibilní POST na `/v1/hiran/validate` (PoC endpoint)
/// nebo na `/v1/chat/completions` (ollama/llama-server kompatibilita).
///
/// # Příklad
/// ```no_run
/// use poc_hiran::{HiranClient, LiveHiranClient, HiranRequest};
/// let client = LiveHiranClient::new("http://127.0.0.1:8002");
/// let req = HiranRequest::validate_proof("v1", "task-1", 80, 1);
/// match client.validate(&req) {
///     Ok(resp) => println!("accepted={} conf={:.2}", resp.accepted(), resp.confidence),
///     Err(e)   => eprintln!("Hiran error: {e}"),
/// }
/// ```
pub struct LiveHiranClient {
    base_url: String,
    timeout: Duration,
    agent: ureq::Agent,
}

impl LiveHiranClient {
    /// Vytvoří klienta s výchozím timeoutem 30 s.
    pub fn new(base_url: impl Into<String>) -> Self {
        let timeout = Duration::from_secs(30);
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(5))
            .timeout(timeout)
            .build();
        Self {
            base_url: base_url.into(),
            timeout,
            agent,
        }
    }

    /// Nastaví vlastní timeout pro HTTP volání.
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self.agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(5))
            .timeout(timeout)
            .build();
        self
    }

    /// Vrátí URL pro validate endpoint.
    fn validate_url(&self) -> String {
        format!("{}/v1/hiran/validate", self.base_url.trim_end_matches('/'))
    }

    /// Vrátí URL pro health endpoint.
    fn health_url(&self) -> String {
        format!("{}/health", self.base_url.trim_end_matches('/'))
    }
}

impl HiranClient for LiveHiranClient {
    fn validate(&self, req: &HiranRequest) -> Result<HiranResponse, HiranError> {
        let url = self.validate_url();
        let start = Instant::now();

        let body = serde_json::to_value(req).map_err(|e| HiranError::Json(e.to_string()))?;
        let resp: HiranResponse = self
            .agent
            .post(&url)
            .set("Content-Type", "application/json")
            .send_json(body)
            .map_err(HiranError::from)?
            .into_json()
            .map_err(|e| HiranError::Json(e.to_string()))?;

        Ok(HiranResponse {
            latency_ms: start.elapsed().as_millis() as u64,
            ..resp
        })
    }

    fn health_check(&self) -> bool {
        let url = self.health_url();
        self.agent
            .get(&url)
            .call()
            .map(|r| r.status() == 200)
            .unwrap_or(false)
    }

    fn is_stub(&self) -> bool {
        false
    }

    fn server_url(&self) -> &str {
        &self.base_url
    }
}

// ── StubHiranClient ───────────────────────────────────────────────────────────

/// Offline stub — přijme všechny proofs bez síťového volání.
///
/// Slouží jako fallback když `--hiran-url` není zadáno, a pro unit testy.
#[derive(Debug, Default, Clone)]
pub struct StubHiranClient {
    /// Pokud `Some(false)`, stub vrátí rejected pro každý proof.
    /// Výchozí (`None` nebo `Some(true)`) = vždy accept.
    pub force_reject: Option<bool>,
    /// Confidence vrácená stubem.
    pub confidence: Option<f64>,
}

impl StubHiranClient {
    /// Stub který vždy akceptuje s plnou jistotou.
    pub fn accepting() -> Self {
        Self::default()
    }

    /// Stub který vždy zamítá (pro testy slashing logiky).
    pub fn rejecting() -> Self {
        Self {
            force_reject: Some(true),
            confidence: None,
        }
    }

    /// Stub s nastavenou confidence hodnotou.
    pub fn with_confidence(confidence: f64) -> Self {
        Self {
            force_reject: None,
            confidence: Some(confidence),
        }
    }
}

impl HiranClient for StubHiranClient {
    fn validate(&self, req: &HiranRequest) -> Result<HiranResponse, HiranError> {
        if self.force_reject == Some(true) {
            return Ok(HiranResponse::stub_rejected(
                format!("stub-reject: validator={} task={}", req.validator_id, req.task_id),
            ));
        }
        Ok(HiranResponse {
            accepted: true,
            confidence: self.confidence.unwrap_or(1.0),
            care_score_adjustment: 0,
            flags: vec![],
            reasoning: format!(
                "stub: offline validation — validator={} task={} score={}",
                req.validator_id, req.task_id, req.care_score
            ),
            latency_ms: 0,
        })
    }

    fn health_check(&self) -> bool {
        true // stub je vždy "zdravý"
    }

    fn is_stub(&self) -> bool {
        true
    }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/// Vytvoří vhodný HiranClient podle URL.
///
/// - `Some(url)` → [`LiveHiranClient`]
/// - `None` → [`StubHiranClient`]
pub fn build_client(hiran_url: Option<&str>) -> Box<dyn HiranClient> {
    match hiran_url {
        Some(url) => Box::new(LiveHiranClient::new(url)),
        None => Box::new(StubHiranClient::accepting()),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stub_client_accepts_all_proofs() {
        let client = StubHiranClient::accepting();
        let req = HiranRequest::validate_proof("v1", "task-1", 80, 1);
        let resp = client.validate(&req).unwrap();
        assert!(resp.accepted());
        assert_eq!(resp.confidence, 1.0);
        assert!(resp.latency_ms == 0);
    }

    #[test]
    fn stub_client_rejecting_rejects_all() {
        let client = StubHiranClient::rejecting();
        let req = HiranRequest::validate_proof("v1", "task-bad", 10, 1);
        let resp = client.validate(&req).unwrap();
        assert!(!resp.accepted());
    }

    #[test]
    fn stub_client_with_confidence() {
        let client = StubHiranClient::with_confidence(0.5);
        let req = HiranRequest::validate_proof("v2", "task-2", 60, 2);
        let resp = client.validate(&req).unwrap();
        assert!(resp.accepted());
        assert!(resp.is_uncertain()); // 0.5 < 0.7
    }

    #[test]
    fn build_client_none_returns_stub() {
        let c = build_client(None);
        assert!(c.is_stub());
    }

    #[test]
    fn build_client_some_returns_live() {
        let c = build_client(Some("http://127.0.0.1:9999"));
        assert!(!c.is_stub());
        assert_eq!(c.server_url(), "http://127.0.0.1:9999");
    }

    #[test]
    fn live_client_health_check_fails_gracefully_when_offline() {
        let client = LiveHiranClient::new("http://127.0.0.1:19999");
        // Server neběží — health_check musí vrátit false, ne panic
        assert!(!client.health_check());
    }

    #[test]
    fn hiran_request_builder() {
        let req = HiranRequest::validate_proof("v1", "t1", 75, 3)
            .with_output_hash("deadbeef")
            .with_context("test context");
        assert_eq!(req.output_hash.as_deref(), Some("deadbeef"));
        assert_eq!(req.context.as_deref(), Some("test context"));
    }
}
