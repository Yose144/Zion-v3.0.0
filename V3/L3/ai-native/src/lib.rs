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

pub mod autotuner;
pub mod consciousness;
pub mod consciousness_engine;
pub mod ekam_field;
pub mod error;
pub mod hiran_inference;
pub mod hiranyagarbha;
pub mod in_context;
pub mod health_poller;
pub mod intent;
pub mod layer_agents;
pub mod maestro;
pub mod planner;
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
pub mod tool_registry;
pub mod types;
pub mod warp_agent;

pub use consciousness::ConsciousnessLevel;
pub use consciousness_engine::{ConsciousnessEngine, ConsciousnessStatus};
pub use error::{AiError, AiResult};
pub use hiran_inference::{HiranInferenceClient, HiranStatus, HybridInferenceBackend};
pub use hiranyagarbha::{HiranyagarbhaAgent, MmlModality};
pub use intent::{
    classify_rule_based, ClassifierSource, IntentClassification, IntentRouter, IntentRouterConfig,
};
pub use knowledge_base::{
    chunk_document_text, collect_markdown_chunks_from_relative_roots, RagTextChunk,
    AI_NATIVE_CANONICAL_CORPUS_ROOTS, BUDDHISM_CLASSICAL_CORPUS_ROOTS, BUDDHISM_RAG_CORPUS_ROOTS,
    BUDDHISM_TIBETAN_CORPUS_ROOTS, V2_BOOKS_PROXY_CORPUS_ROOTS, ZION_OASIS_GAME_CORPUS_ROOTS,
};
pub use llm_backend::{EchoBackend, LlmBackend, LlmRequest, RemoteHttpBackend};
pub use memory::{AgentMemory, MemoryEntry, MemoryEventKind};
pub use message_bus::{AgentSubscriber, BusMessage, BusStats, MessageBus, SystemEvent};
pub use oasis_bridge::{
    l3_to_oasis_level, scale_xp_to_oasis, AgentOasisProfile, OasisBridge, OasisLevel, XpSyncRequest,
};
pub use orchestrator::{
    weighted_majority, AgentVote, AgentWeights, Orchestrator, OrchestratorStatus,
};
pub use pool_optimizer::{PoolOptimizer, PoolRecommendation, PoolStats};
pub use rag::{EmbeddingBackend, MockEmbeddingBackend, RagDocument, VectorStore};
pub use task::{AiTask, AiTaskType, TaskQueue, TaskStatus};
pub use telemetry::{NodeConfig, PoolRawStats, TelemetryFeed, TelemetryStats};
pub use tool_registry::{
    all_tools, HttpMethod, Intent, Layer, SubAgent, Tool, ToolExecutor, ToolRegistry, ToolResult,
};
pub use types::{Agent, AgentCapability, AgentMessage, AgentStatus};
pub use warp_agent::{FieldTopology, WarpField, WarpMode, WarpOptimizer, WarpStats};
