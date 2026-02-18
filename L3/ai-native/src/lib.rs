//! # 🤖 ZION AI-Native — Autonomous Agent Framework
//!
//! On-chain AI agents that can:
//! - Own wallets and transact autonomously
//! - Execute multi-step workflows
//! - Communicate via typed messages
//! - Evolve through consciousness levels (L4/Oasis integration)
//!
//! ## Architecture
//! ```text
//! ┌─────────────────┐
//! │   Orchestrator   │  manages agent lifecycle
//! ├─────────────────┤
//! │  Agent Registry  │  registered agents + capabilities
//! ├─────────────────┤
//! │  Message Bus     │  typed inter-agent communication
//! ├─────────────────┤
//! │  Consciousness   │  agent evolution & self-awareness
//! └─────────────────┘
//! ```

pub mod error;
pub mod types;
pub mod orchestrator;
pub mod consciousness;

pub use error::{AiError, AiResult};
pub use types::{Agent, AgentCapability, AgentMessage, AgentStatus};
pub use orchestrator::Orchestrator;
pub use consciousness::ConsciousnessLevel;
