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
pub mod ekam_field;
pub mod error;
pub mod hiranyagarbha;
pub mod in_context;
pub mod knowledge_base;
pub mod llm_backend;
pub mod memory;
pub mod message_bus;
pub mod oasis_bridge;
pub mod orchestrator;
pub mod pool_optimizer;
pub mod rag;
pub mod task;
pub mod telemetry;
pub mod types;
pub mod warp_agent;

pub use consciousness::ConsciousnessLevel;
pub use consciousness_engine::{ConsciousnessEngine, ConsciousnessStatus};
pub use error::{AiError, AiResult};
pub use hiranyagarbha::{HiranyagarbhaAgent, HiranyagarbhaIdentity, MmlInput, MmlModality, MmlOutput};
pub use in_context::{ContextAssembler, ContextSnapshot, InContextBackend};
pub use llm_backend::{ConsciousnessAwareBackend, EchoBackend, LlmBackend, LlmError, LlmRequest, LlmResponse};
pub use memory::{AgentMemory, MemoryEntry, MemoryEventKind};
pub use orchestrator::{weighted_majority, AgentVote, AgentWeights, Orchestrator, OrchestratorStatus};
pub use pool_optimizer::{PoolOptimizer, PoolRecommendation, PoolStats};
pub use rag::{EmbeddingBackend, MockEmbeddingBackend, RagBackend, RagDocument, RagRetriever, VectorStore};
pub use task::{AiTask, AiTaskType, TaskQueue, TaskStatus};
pub use types::{Agent, AgentCapability, AgentMessage, AgentStatus};
pub use message_bus::{AgentSubscriber, BusMessage, BusStats, MessageBus, SystemEvent};
pub use oasis_bridge::{AgentOasisProfile, OasisBridge, OasisLevel, XpSyncRequest, l3_to_oasis_level, scale_xp_to_oasis};
pub use telemetry::{NodeConfig, PoolRawStats, TelemetryFeed, TelemetryStats};
pub use warp_agent::{FieldTopology, WarpField, WarpMode, WarpOptimizer, WarpStats};
