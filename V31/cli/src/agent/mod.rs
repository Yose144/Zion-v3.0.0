//! Hiran coding agent (B2B-3b) — OpenAI-compatible tool loop against the
//! public Hiran gateway (`market.zionterranova.com/v1`).

pub mod client;
pub mod config;
pub mod r#loop;
pub mod policy;
pub mod prompt;
pub mod tools;

pub use client::HiranClient;
pub use config::{market_base_url, AgentConfig};
pub use r#loop::{run_agent_loop, run_repl};
