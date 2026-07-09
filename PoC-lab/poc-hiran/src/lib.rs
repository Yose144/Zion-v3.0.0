//! # poc-hiran — Hiran HTTP client + mock server
//!
//! Tato crate zapouzdřuje veškerou komunikaci s Hiran inference serverem.
//!
//! ## Architektura
//!
//! ```text
//! ┌───────────────────────────────────────────────┐
//! │  HiranClient (trait)                          │
//! │  ┌─────────────────┐  ┌─────────────────────┐ │
//! │  │ LiveHiranClient  │  │ StubHiranClient     │ │
//! │  │ (ureq HTTP)      │  │ (no network)        │ │
//! │  └─────────────────┘  └─────────────────────┘ │
//! └───────────────────────────────────────────────┘
//!          ↕ HTTP (OpenAI-compatible)
//! ┌───────────────────────────────────────────────┐
//! │  MockHiranServer                              │
//! │  (tiny_http, test only)                       │
//! │  POST /v1/chat/completions → JSON verdict     │
//! │  GET  /health              → {"status":"ok"}  │
//! └───────────────────────────────────────────────┘
//! ```
//!
//! ## Použití
//!
//! ```rust
//! use poc_hiran::{HiranClient, LiveHiranClient, StubHiranClient, HiranRequest};
//!
//! // Offline testy:
//! let client = StubHiranClient::default();
//! let req = HiranRequest::validate_proof("v1", "task-1", 75, 0);
//! let resp = client.validate(&req).unwrap();
//! assert!(resp.accepted());
//!
//! // Live Hiran (llama-server / ollama):
//! // let client = LiveHiranClient::new("http://127.0.0.1:8002");
//! ```

pub mod client;
pub mod mock;
pub mod types;

pub use client::{HiranClient, LiveHiranClient, StubHiranClient};
pub use mock::MockHiranServer;
pub use types::{HiranRequest, HiranResponse, HiranError};
