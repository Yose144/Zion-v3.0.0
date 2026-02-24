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

pub mod consciousness;
pub mod consciousness_engine;
pub mod error;
pub mod memory;
pub mod orchestrator;
pub mod pool_optimizer;
pub mod task;
pub mod types;
pub mod warp_agent;

pub use consciousness::ConsciousnessLevel;
pub use consciousness_engine::{ConsciousnessEngine, ConsciousnessStatus};
pub use error::{AiError, AiResult};
pub use memory::{AgentMemory, MemoryEntry, MemoryEventKind};
pub use orchestrator::{weighted_majority, AgentVote, AgentWeights, Orchestrator, OrchestratorStatus};
pub use pool_optimizer::{PoolOptimizer, PoolRecommendation, PoolStats};
pub use task::{AiTask, AiTaskType, TaskQueue, TaskStatus};
pub use types::{Agent, AgentCapability, AgentMessage, AgentStatus};
pub use warp_agent::{FieldTopology, WarpField, WarpMode, WarpOptimizer, WarpStats};
