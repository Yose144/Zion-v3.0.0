//! MockHiranServer — minimální HTTP server pro integrační testy.
//!
//! Implementuje dva endpointy:
//! - `GET  /health`                → `{"status":"ok","mode":"mock"}`
//! - `POST /v1/hiran/validate`     → `HiranResponse` JSON dle konfigurace
//!
//! # Příklad
//!
//! ```rust
//! use poc_hiran::{MockHiranServer, HiranClient, LiveHiranClient, HiranRequest};
//!
//! let server = MockHiranServer::spawn_accepting();
//! let url = server.url();
//!
//! let client = LiveHiranClient::new(&url);
//! assert!(client.health_check());
//!
//! let req = HiranRequest::validate_proof("v1", "task-1", 80, 1);
//! let resp = client.validate(&req).unwrap();
//! assert!(resp.accepted());
//!
//! server.shutdown();
//! ```

use std::io::Cursor;
use std::net::TcpListener;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::thread;

use crate::types::HiranResponse;

// ── Konfigurace mocku ──────────────────────────────────────────────────────────

/// Chování mock serveru při validaci.
#[derive(Debug, Clone)]
pub enum MockBehaviour {
    /// Vždy akceptovat s danou confidence.
    AlwaysAccept { confidence: f64 },
    /// Vždy odmítnout s daným důvodem.
    AlwaysReject { reason: String },
    /// Akceptovat proofs kde care_score ≥ threshold, ostatní odmítnout.
    ScoreThreshold { min_score: u32, confidence: f64 },
}

impl Default for MockBehaviour {
    fn default() -> Self {
        Self::AlwaysAccept { confidence: 0.95 }
    }
}

// ── MockHiranServer ────────────────────────────────────────────────────────────

/// Jednoduchý HTTP server pro integrační testy PoC-lab.
///
/// Spouští se v pozadí vlákně a naslouchá na náhodném portu.
/// Po dokončení testu zavolej [`shutdown()`].
pub struct MockHiranServer {
    port: u16,
    shutdown: Arc<AtomicBool>,
    handle: Option<thread::JoinHandle<()>>,
}

impl MockHiranServer {
    /// Spustí mock server, který vždy akceptuje proofs.
    pub fn spawn_accepting() -> Self {
        Self::spawn(MockBehaviour::AlwaysAccept { confidence: 0.95 })
    }

    /// Spustí mock server, který vždy odmítá proofs.
    pub fn spawn_rejecting() -> Self {
        Self::spawn(MockBehaviour::AlwaysReject {
            reason: "mock: always reject".into(),
        })
    }

    /// Spustí mock server s prahem care_score.
    pub fn spawn_with_threshold(min_score: u32) -> Self {
        Self::spawn(MockBehaviour::ScoreThreshold {
            min_score,
            confidence: 0.9,
        })
    }

    /// Spustí mock server s vlastním chováním.
    pub fn spawn(behaviour: MockBehaviour) -> Self {
        // Bind na port 0 → OS přidělí náhodný volný port
        let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind mock server");
        let port = listener.local_addr().unwrap().port();

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = Arc::clone(&shutdown);

        let handle = thread::spawn(move || {
            run_server(listener, behaviour, shutdown_clone);
        });

        // Krátká pauza aby server stihl nabindit port
        thread::sleep(std::time::Duration::from_millis(50));

        Self {
            port,
            shutdown,
            handle: Some(handle),
        }
    }

    /// Vrátí base URL mock serveru (např. `"http://127.0.0.1:12345"`).
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// Vrátí port mock serveru.
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Signalizuje serveru aby se ukončil.
    pub fn shutdown(mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        // Pošleme dummy request aby server "probudil" ze smyčky
        let _ = ureq::get(&format!("{}/shutdown", self.url()))
            .timeout(std::time::Duration::from_millis(200))
            .call();
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

impl Drop for MockHiranServer {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        // Pokus o probuzení — ignorujeme výsledek
        let _ = ureq::get(&format!("http://127.0.0.1:{}/shutdown", self.port))
            .timeout(std::time::Duration::from_millis(100))
            .call();
    }
}

// ── Server smyčka ─────────────────────────────────────────────────────────────

fn run_server(listener: TcpListener, behaviour: MockBehaviour, shutdown: Arc<AtomicBool>) {
    // Nastav timeout aby smyčka nebyla blokovaná navěky
    listener
        .set_nonblocking(false)
        .expect("set_nonblocking failed");

    let server = tiny_http::Server::from_listener(listener, None)
        .expect("failed to create tiny_http server");

    loop {
        if shutdown.load(Ordering::Relaxed) {
            break;
        }

        // recv_timeout s 200ms aby mohli zkontrolovat shutdown flag
        let mut request = match server.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(Some(req)) => req,
            Ok(None) => continue,  // timeout — zkontroluj shutdown
            Err(_) => break,
        };

        if shutdown.load(Ordering::Relaxed) {
            break;
        }

        let url = request.url().to_string();
        let method = request.method().as_str().to_uppercase();

        let (status, body) = if method == "GET" && url == "/health" {
            (200, r#"{"status":"ok","mode":"mock"}"#.to_string())
        } else if method == "POST" && (url == "/v1/chat/completions" || url == "/v1/hiran/validate") {
            // Accept both OpenAI-compatible and legacy endpoint
            handle_validate(request.as_reader(), &behaviour)
        } else {
            // Shutdown probe or unknown path
            (200, r#"{"status":"ok"}"#.to_string())
        };

        let response = tiny_http::Response::new(
            tiny_http::StatusCode(status),
            vec![
                tiny_http::Header::from_bytes("Content-Type", "application/json").unwrap(),
            ],
            Cursor::new(body.into_bytes()),
            None,
            None,
        );

        let _ = request.respond(response);
    }
}

fn handle_validate<R: std::io::Read>(mut reader: R, behaviour: &MockBehaviour) -> (u16, String) {
    let mut body = String::new();
    if std::io::Read::read_to_string(&mut reader, &mut body).is_err() {
        let resp = HiranResponse::stub_rejected("mock: failed to read request body");
        return (400, wrap_in_chat_response(&resp));
    }

    // Extract care_score from either direct JSON or chat completions user message.
    let care_score: u32 = extract_care_score_from_request(&body);

    let hiran_resp = match behaviour {
        MockBehaviour::AlwaysAccept { confidence } => HiranResponse {
            accepted: true,
            confidence: *confidence,
            care_score_adjustment: 0,
            flags: vec!["mock-accept".into()],
            reasoning: "mock: always accept".into(),
            latency_ms: 1,
        },
        MockBehaviour::AlwaysReject { reason } => HiranResponse {
            accepted: false,
            confidence: 0.99,
            care_score_adjustment: -10,
            flags: vec!["mock-reject".into()],
            reasoning: reason.clone(),
            latency_ms: 1,
        },
        MockBehaviour::ScoreThreshold { min_score, confidence } => {
            let pass = care_score >= *min_score;
            HiranResponse {
                accepted: pass,
                confidence: *confidence,
                care_score_adjustment: if pass { 0 } else { -5 },
                flags: if pass { vec![] } else { vec!["score_too_low".into()] },
                reasoning: if pass {
                    format!("mock: score {care_score} >= threshold {min_score}")
                } else {
                    format!("mock: score {care_score} < threshold {min_score}")
                },
                latency_ms: 1,
            }
        }
    };

    (200, wrap_in_chat_response(&hiran_resp))
}

/// Wraps a HiranResponse as an OpenAI /v1/chat/completions response body.
/// LiveHiranClient reads choices[0].message.content and parses it as JSON.
fn wrap_in_chat_response(resp: &HiranResponse) -> String {
    let inner = serde_json::to_string(resp).unwrap_or_default();
    serde_json::json!({
        "choices": [{"index": 0, "message": {"role": "assistant", "content": inner}, "finish_reason": "stop"}],
        "model": "mock-hiran",
        "object": "chat.completion"
    }).to_string()
}

/// Extracts care_score from a request body.
/// Handles direct {"care_score":N} and chat message "care_score=N" formats.
fn extract_care_score_from_request(body: &str) -> u32 {
    let v: serde_json::Value = serde_json::from_str(body).unwrap_or(serde_json::Value::Null);
    if let Some(n) = v["care_score"].as_u64() {
        return n as u32;
    }
    // Chat completions: search user message content for "care_score=NN"
    if let Some(msgs) = v["messages"].as_array() {
        for msg in msgs {
            if let Some(content) = msg["content"].as_str() {
                if let Some(pos) = content.find("care_score=") {
                    let rest = &content[pos + "care_score=".len()..];
                    let num: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                    if let Ok(n) = num.parse::<u32>() {
                        return n;
                    }
                }
            }
        }
    }
    0
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{HiranClient, LiveHiranClient, HiranRequest};

    #[test]
    fn mock_server_health_check_passes() {
        let server = MockHiranServer::spawn_accepting();
        let client = LiveHiranClient::new(server.url());
        assert!(client.health_check(), "mock server /health should return 200");
        server.shutdown();
    }

    #[test]
    fn mock_server_accepts_valid_proof() {
        let server = MockHiranServer::spawn_accepting();
        let client = LiveHiranClient::new(server.url());

        let req = HiranRequest::validate_proof("v1", "task-1", 80, 1);
        let resp = client.validate(&req).unwrap();
        assert!(resp.accepted(), "mock accepting server should accept proof");
        assert!(resp.confidence >= 0.9);
        // latency_ms může být 0 na rychlém HW, ale pole musí existovat
        let _ = resp.latency_ms;
        server.shutdown();
    }

    #[test]
    fn mock_server_rejecting_rejects_all() {
        let server = MockHiranServer::spawn_rejecting();
        let client = LiveHiranClient::new(server.url());

        let req = HiranRequest::validate_proof("v1", "task-1", 90, 1);
        let resp = client.validate(&req).unwrap();
        assert!(!resp.accepted(), "mock rejecting server should reject proof");
        server.shutdown();
    }

    #[test]
    fn mock_server_threshold_accepts_high_score() {
        let server = MockHiranServer::spawn_with_threshold(60);
        let client = LiveHiranClient::new(server.url());

        let req = HiranRequest::validate_proof("v1", "task-1", 75, 1);
        let resp = client.validate(&req).unwrap();
        assert!(resp.accepted(), "score 75 ≥ threshold 60 → should accept");
        server.shutdown();
    }

    #[test]
    fn mock_server_threshold_rejects_low_score() {
        let server = MockHiranServer::spawn_with_threshold(60);
        let client = LiveHiranClient::new(server.url());

        let req = HiranRequest::validate_proof("v1", "task-1", 40, 1);
        let resp = client.validate(&req).unwrap();
        assert!(!resp.accepted(), "score 40 < threshold 60 → should reject");
        assert!(resp.flags.contains(&"score_too_low".into()));
        server.shutdown();
    }

    #[test]
    fn multiple_sequential_requests_work() {
        let server = MockHiranServer::spawn_accepting();
        let client = LiveHiranClient::new(server.url());

        for i in 0..5u64 {
            let req = HiranRequest::validate_proof(
                format!("v{i}"),
                format!("task-{i}"),
                70 + i as u32,
                i,
            );
            let resp = client.validate(&req).unwrap();
            assert!(resp.accepted(), "request {i} should be accepted");
        }
        server.shutdown();
    }
}
