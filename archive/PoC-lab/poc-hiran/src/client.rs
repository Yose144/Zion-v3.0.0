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

    /// Vrátí URL pro OpenAI-compatible chat endpoint (llama-server / ollama).
    fn chat_url(&self) -> String {
        format!("{}/v1/chat/completions", self.base_url.trim_end_matches('/'))
    }

    /// Vrátí URL pro health endpoint.
    fn health_url(&self) -> String {
        format!("{}/health", self.base_url.trim_end_matches('/'))
    }

    /// Sestaví system prompt pro Dharma validaci.
    fn build_system_prompt() -> &'static str {
        "You are Hiran, a Dharma validator for the ZION Proof-of-Care system. \
         Your role: evaluate care proofs submitted by validators. \
         Respond ONLY with a JSON object (no markdown, no explanation) in this exact format: \
         {\"accepted\":true|false,\"confidence\":0.0-1.0,\"care_score_adjustment\":-10 to 10,\"flags\":[],\"reasoning\":\"short text\"}"
    }

    /// Sestaví user prompt z HiranRequest.
    fn build_user_prompt(req: &HiranRequest) -> String {
        format!(
            "Validate care proof: validator_id={} task_id={} care_score={} epoch={}{}{}",
            req.validator_id,
            req.task_id,
            req.care_score,
            req.epoch,
            req.output_hash.as_deref().map(|h| format!(" output_hash={h}")).unwrap_or_default(),
            req.context.as_deref().map(|c| format!(" context={c}")).unwrap_or_default(),
        )
    }
}

impl HiranClient for LiveHiranClient {
    fn validate(&self, req: &HiranRequest) -> Result<HiranResponse, HiranError> {
        let url = self.chat_url();
        let start = Instant::now();

        let body = serde_json::json!({
            "model": "hiran",
            "messages": [
                {"role": "system", "content": LiveHiranClient::build_system_prompt()},
                {"role": "user",   "content": LiveHiranClient::build_user_prompt(req)}
            ],
            "max_tokens": 128,
            "temperature": 0.1
        });

        let raw: serde_json::Value = self
            .agent
            .post(&url)
            .set("Content-Type", "application/json")
            .send_json(body)
            .map_err(HiranError::from)?
            .into_json()
            .map_err(|e| HiranError::Json(e.to_string()))?;

        let latency_ms = start.elapsed().as_millis() as u64;

        // Extract content from choices[0].message.content
        let content = raw["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .trim();

        // Try to parse as HiranResponse JSON; fall back to heuristic
        let resp = parse_hiran_response(content, latency_ms);
        Ok(resp)
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

// ── Response parser ───────────────────────────────────────────────────────────

/// Parsuje text odpovedi Hiranu jako HiranResponse.
///
/// Pokusi se najit JSON blok v textu (model muze pridat markdown obaleni).
/// Pokud parsovani selze, pouzije heuristiku na zaklade klicovych slov.
fn parse_hiran_response(content: &str, latency_ms: u64) -> HiranResponse {
    // Zkusime najit JSON objekt v obsahu (muze byt obaleny v ```json ... ```)
    let json_str = extract_json(content);

    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json_str) {
        let accepted = v["accepted"].as_bool().unwrap_or(true);
        let confidence = v["confidence"].as_f64().unwrap_or(0.85).clamp(0.0, 1.0);
        let adj = v["care_score_adjustment"].as_i64().unwrap_or(0).clamp(-20, 20);
        let flags: Vec<String> = v["flags"]
            .as_array()
            .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let reasoning = v["reasoning"].as_str().unwrap_or("hiran: ok").to_string();
        return HiranResponse { accepted, confidence, care_score_adjustment: adj, flags, reasoning, latency_ms };
    }

    // Heuristika: hledame klicova slova v textu
    let lower = content.to_lowercase();
    let accepted = !lower.contains("reject") && !lower.contains("false") && !lower.contains("invalid");
    HiranResponse {
        accepted,
        confidence: if accepted { 0.75 } else { 0.80 },
        care_score_adjustment: 0,
        flags: vec!["hiran-parse-fallback".into()],
        reasoning: format!("hiran: {}", &content[..content.len().min(120)]),
        latency_ms,
    }
}

/// Extrahuje prvni JSON objekt z textu (preskoci markdown obaleni).
fn extract_json(text: &str) -> String {
    // Zkusime primy parse
    let trimmed = text.trim();
    if trimmed.starts_with('{') {
        return trimmed.to_string();
    }
    // Hledame { ... } blok
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if end > start {
                return trimmed[start..=end].to_string();
            }
        }
    }
    trimmed.to_string()
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
