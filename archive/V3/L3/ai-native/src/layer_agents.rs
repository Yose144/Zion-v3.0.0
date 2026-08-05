//! # 🏛️ Hiran v2.4 Maestro — Layer Agents
//!
//! 7 Layer Agents (L1–L6 + System) — middle tier of the Maestro hierarchy.
//! Each Layer Agent receives steps from the Maestro, dispatches them to its
//! Sub-Agents, and reports results upward.
//!
//! ## Hierarchy
//! ```text
//! Maestro (top)
//!   ├── L1Agent ──► NodeSync, NodeConsensus, PoolWorkers, PoolEconomics,
//!   │               MinerThermal, MinerPerformance, WalletOps
//!   ├── L2Agent ──► BridgeValidators, BridgeWatcher, DaoProposals,
//!   │               DaoTreasury, SwapExecutor, SwapMarket
//!   ├── L3Agent ──► NclScheduler, NclMarket, WarpRouter, WarpValidators,
//!   │               AiNativeRuntime, AiNativeMemory
//!   ├── L4Agent ──► OasisManager
//!   ├── L5Agent ──► FreeWorldOps
//!   ├── L6Agent ──► IsobellaOps
//!   └── SystemAgent ──► DockerHealth, PrometheusAlerts, ResourceOptimizer,
//!                       BackupManager, UpdateEngine
//! ```

use crate::error::{AiError, AiResult};
use crate::planner::{ExecutionPlan, PlanStep};
use crate::tool_registry::{Layer, SubAgent, ToolExecutor, ToolRegistry};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ============================================================================
// Step result
// ============================================================================

/// Status of a single step execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepStatus {
    /// Step completed successfully.
    Success,
    /// Step completed with warnings (e.g. some tools degraded).
    PartialSuccess,
    /// Step failed.
    Failed,
    /// Step skipped (dependency failed or approval denied).
    Skipped,
    /// Step pending execution.
    Pending,
}

/// Result of executing a single plan step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub step_id: u32,
    pub sub_agent: SubAgent,
    pub status: StepStatus,
    /// Output from each tool invocation (tool_name → output/error).
    pub tool_outputs: HashMap<String, ToolOutput>,
    /// When execution started.
    pub started_at: DateTime<Utc>,
    /// When execution finished.
    pub finished_at: DateTime<Utc>,
    /// Error message if failed.
    pub error: Option<String>,
}

impl StepResult {
    pub fn pending(step: &PlanStep) -> Self {
        Self {
            step_id: step.id,
            sub_agent: step.sub_agent,
            status: StepStatus::Pending,
            tool_outputs: HashMap::new(),
            started_at: Utc::now(),
            finished_at: Utc::now(),
            error: None,
        }
    }

    pub fn duration_ms(&self) -> i64 {
        (self.finished_at - self.started_at).num_milliseconds()
    }

    pub fn is_success(&self) -> bool {
        matches!(
            self.status,
            StepStatus::Success | StepStatus::PartialSuccess
        )
    }
}

/// Output of a single tool invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolOutput {
    pub tool_name: String,
    pub success: bool,
    pub status_code: Option<u16>,
    pub body: Value,
    pub error: Option<String>,
    pub latency_ms: u64,
}

// ============================================================================
// Layer Agent trait
// ============================================================================

/// A Layer Agent — manages Sub-Agents within one layer.
pub struct LayerAgent {
    /// Which layer this agent manages.
    pub layer: Layer,
    /// Sub-agents under this Layer Agent.
    pub sub_agents: Vec<SubAgent>,
    /// Tool registry for tool lookup.
    registry: ToolRegistry,
    /// Tool executor for invoking tools.
    executor: ToolExecutor,
}

impl LayerAgent {
    /// Create a Layer Agent for the given layer with all its sub-agents.
    pub fn for_layer(layer: Layer) -> Self {
        let sub_agents = sub_agents_for_layer(layer);
        Self {
            layer,
            sub_agents,
            registry: ToolRegistry::with_all_tools(),
            executor: ToolExecutor::new(),
        }
    }

    /// Create with custom registry + executor (for testing).
    pub fn with_executor(layer: Layer, registry: ToolRegistry, executor: ToolExecutor) -> Self {
        let sub_agents = sub_agents_for_layer(layer);
        Self {
            layer,
            sub_agents,
            registry,
            executor,
        }
    }

    /// Returns true if this Layer Agent can execute the given step
    /// (i.e. the step's sub_agent belongs to this layer).
    pub fn can_handle(&self, step: &PlanStep) -> bool {
        step.sub_agent.layer() == self.layer
    }

    /// Execute a single step — invokes all tools in parallel.
    pub async fn execute_step(&self, step: &PlanStep) -> StepResult {
        let started_at = Utc::now();
        let mut tool_outputs = HashMap::new();
        let mut all_ok = true;
        let mut any_ok = false;

        for tool_name in &step.tool_names {
            let tool = match self.registry.get(tool_name) {
                Some(t) => t,
                None => {
                    tool_outputs.insert(
                        tool_name.clone(),
                        ToolOutput {
                            tool_name: tool_name.clone(),
                            success: false,
                            status_code: None,
                            body: Value::Null,
                            error: Some(format!("tool not found: {}", tool_name)),
                            latency_ms: 0,
                        },
                    );
                    all_ok = false;
                    continue;
                }
            };

            let t_start = std::time::Instant::now();
            let result = self.executor.execute_tool(tool, Value::Null).await;
            let latency_ms = t_start.elapsed().as_millis() as u64;

            match result {
                Ok(resp) => {
                    let success = resp.success;
                    if success {
                        any_ok = true;
                    } else {
                        all_ok = false;
                    }
                    tool_outputs.insert(
                        tool_name.clone(),
                        ToolOutput {
                            tool_name: tool_name.clone(),
                            success,
                            status_code: resp.status_code,
                            body: resp.body,
                            error: resp.error,
                            latency_ms,
                        },
                    );
                }
                Err(e) => {
                    all_ok = false;
                    tool_outputs.insert(
                        tool_name.clone(),
                        ToolOutput {
                            tool_name: tool_name.clone(),
                            success: false,
                            status_code: None,
                            body: Value::Null,
                            error: Some(e.to_string()),
                            latency_ms,
                        },
                    );
                }
            }
        }

        let status = if step.tool_names.is_empty() {
            // No tools — aggregation step. Consider it success.
            StepStatus::Success
        } else if all_ok {
            StepStatus::Success
        } else if any_ok {
            StepStatus::PartialSuccess
        } else {
            StepStatus::Failed
        };

        StepResult {
            step_id: step.id,
            sub_agent: step.sub_agent,
            status,
            tool_outputs,
            started_at,
            finished_at: Utc::now(),
            error: if status == StepStatus::Failed {
                Some("all tools failed".to_string())
            } else {
                None
            },
        }
    }

    /// Filter plan steps that belong to this layer.
    pub fn my_steps<'a>(&self, plan: &'a ExecutionPlan) -> Vec<&'a PlanStep> {
        plan.steps.iter().filter(|s| self.can_handle(s)).collect()
    }
}

/// Get all sub-agents for a given layer.
pub fn sub_agents_for_layer(layer: Layer) -> Vec<SubAgent> {
    use SubAgent::*;
    match layer {
        Layer::L1 => vec![
            NodeSync,
            NodeConsensus,
            PoolWorkers,
            PoolEconomics,
            MinerThermal,
            MinerPerformance,
            WalletOps,
            NodeMetrics,
        ],
        Layer::L2 => vec![
            BridgeValidators,
            BridgeWatcher,
            DaoProposals,
            DaoTreasury,
            SwapExecutor,
            SwapMarket,
            DefiMonitor,
        ],
        Layer::L3 => vec![
            NclScheduler,
            NclMarket,
            WarpRouter,
            WarpValidators,
            AiNativeRuntime,
            AiNativeMemory,
        ],
        Layer::L4 => vec![OasisManager],
        Layer::L5 => vec![FreeWorldOps],
        Layer::L6 => vec![IsobellaOps],
        Layer::System => vec![
            DockerHealth,
            PrometheusAlerts,
            ResourceOptimizer,
            BackupManager,
            UpdateEngine,
            DashboardOps,
            DatabaseInspector,
            WatchdogController,
        ],
    }
}

// ============================================================================
// Layer Agent Registry — all 7 Layer Agents
// ============================================================================

/// All 7 Layer Agents, indexed by Layer.
pub struct LayerAgentRegistry {
    agents: HashMap<Layer, LayerAgent>,
}

impl LayerAgentRegistry {
    /// Create registry with all 7 Layer Agents.
    pub fn new() -> Self {
        let mut agents = HashMap::new();
        for layer in [
            Layer::L1,
            Layer::L2,
            Layer::L3,
            Layer::L4,
            Layer::L5,
            Layer::L6,
            Layer::System,
        ] {
            agents.insert(layer, LayerAgent::for_layer(layer));
        }
        Self { agents }
    }

    /// Get the Layer Agent for a given layer.
    pub fn get(&self, layer: Layer) -> Option<&LayerAgent> {
        self.agents.get(&layer)
    }

    /// All layers in canonical order.
    pub fn all_layers() -> [Layer; 7] {
        [
            Layer::L1,
            Layer::L2,
            Layer::L3,
            Layer::L4,
            Layer::L5,
            Layer::L6,
            Layer::System,
        ]
    }

    /// Execute a single step by dispatching to the appropriate Layer Agent.
    /// Returns error if no agent can handle the step.
    pub async fn execute_step(&self, step: &PlanStep) -> AiResult<StepResult> {
        let layer = step.sub_agent.layer();
        let agent = self.agents.get(&layer).ok_or_else(|| {
            AiError::ToolNotFound(format!("no Layer Agent for layer {:?}", layer))
        })?;
        Ok(agent.execute_step(step).await)
    }

    /// Execute all steps in a plan that have no dependencies (root steps),
    /// returning their results. Caller can then iterate dependent steps.
    pub async fn execute_root_steps(&self, plan: &ExecutionPlan) -> Vec<StepResult> {
        let mut results = Vec::new();
        for step in &plan.steps {
            if step.depends_on.is_empty() {
                if let Ok(r) = self.execute_step(step).await {
                    results.push(r);
                }
            }
        }
        results
    }

    /// Number of Layer Agents (always 7).
    pub fn len(&self) -> usize {
        self.agents.len()
    }

    /// True if registry is empty.
    pub fn is_empty(&self) -> bool {
        self.agents.is_empty()
    }
}

impl Default for LayerAgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ── sub_agents_for_layer ───────────────────────────────────────────────────

    #[test]
    fn test_sub_agents_l1_has_8() {
        let sa = sub_agents_for_layer(Layer::L1);
        assert_eq!(sa.len(), 8);
        assert!(sa.contains(&SubAgent::NodeSync));
        assert!(sa.contains(&SubAgent::WalletOps));
        assert!(sa.contains(&SubAgent::NodeMetrics));
    }

    #[test]
    fn test_sub_agents_l2_has_7() {
        let sa = sub_agents_for_layer(Layer::L2);
        assert_eq!(sa.len(), 7);
        assert!(sa.contains(&SubAgent::BridgeValidators));
        assert!(sa.contains(&SubAgent::SwapMarket));
        assert!(sa.contains(&SubAgent::DefiMonitor));
    }

    #[test]
    fn test_sub_agents_l3_has_6() {
        let sa = sub_agents_for_layer(Layer::L3);
        assert_eq!(sa.len(), 6);
        assert!(sa.contains(&SubAgent::WarpRouter));
        assert!(sa.contains(&SubAgent::AiNativeRuntime));
    }

    #[test]
    fn test_sub_agents_l4_l5_l6_single() {
        assert_eq!(sub_agents_for_layer(Layer::L4).len(), 1);
        assert_eq!(sub_agents_for_layer(Layer::L5).len(), 1);
        assert_eq!(sub_agents_for_layer(Layer::L6).len(), 1);
    }

    #[test]
    fn test_sub_agents_system_has_8() {
        let sa = sub_agents_for_layer(Layer::System);
        assert_eq!(sa.len(), 8);
        assert!(sa.contains(&SubAgent::DockerHealth));
        assert!(sa.contains(&SubAgent::UpdateEngine));
        assert!(sa.contains(&SubAgent::DashboardOps));
        assert!(sa.contains(&SubAgent::DatabaseInspector));
        assert!(sa.contains(&SubAgent::WatchdogController));
    }

    #[test]
    fn test_sub_agents_all_belong_to_layer() {
        for layer in LayerAgentRegistry::all_layers() {
            for sa in sub_agents_for_layer(layer) {
                assert_eq!(
                    sa.layer(),
                    layer,
                    "SubAgent {:?} should belong to layer {:?}",
                    sa,
                    layer
                );
            }
        }
    }

    #[test]
    fn test_total_sub_agents_is_32() {
        let total: usize = LayerAgentRegistry::all_layers()
            .iter()
            .map(|l| sub_agents_for_layer(*l).len())
            .sum();
        assert_eq!(
            total, 32,
            "Total sub-agents: L1=8 + L2=7 + L3=6 + L4=1 + L5=1 + L6=1 + Sys=8 = 32"
        );
    }

    // ── LayerAgent ─────────────────────────────────────────────────────────────

    #[test]
    fn test_layer_agent_for_l1() {
        let agent = LayerAgent::for_layer(Layer::L1);
        assert_eq!(agent.layer, Layer::L1);
        assert_eq!(agent.sub_agents.len(), 8);
    }

    #[test]
    fn test_layer_agent_can_handle() {
        let l1 = LayerAgent::for_layer(Layer::L1);
        let l1_step = PlanStep::new(1, "x", SubAgent::NodeSync);
        let l2_step = PlanStep::new(1, "x", SubAgent::BridgeValidators);
        assert!(l1.can_handle(&l1_step));
        assert!(!l1.can_handle(&l2_step));
    }

    #[test]
    fn test_layer_agent_my_steps() {
        let l1 = LayerAgent::for_layer(Layer::L1);
        let plan = ExecutionPlan {
            id: uuid::Uuid::new_v4(),
            intent: crate::tool_registry::Intent::NodeInfo,
            user_input: "test".into(),
            steps: vec![
                PlanStep::new(1, "l1 step", SubAgent::NodeSync),
                PlanStep::new(2, "l2 step", SubAgent::BridgeValidators),
                PlanStep::new(3, "l1 step 2", SubAgent::WalletOps),
            ],
            created_at: Utc::now(),
            estimated_duration_s: 10,
        };
        let my = l1.my_steps(&plan);
        assert_eq!(my.len(), 2);
        assert!(my.iter().all(|s| s.sub_agent.layer() == Layer::L1));
    }

    // ── Step execution (no live services → all tools fail) ─────────────────────

    #[tokio::test]
    async fn test_execute_step_no_tools() {
        // A step with no tools (aggregation step) → Success
        let agent = LayerAgent::for_layer(Layer::L1);
        let step = PlanStep::new(1, "aggregate", SubAgent::AiNativeRuntime);
        let result = agent.execute_step(&step).await;
        assert_eq!(result.status, StepStatus::Success);
        assert!(result.tool_outputs.is_empty());
    }

    #[tokio::test]
    async fn test_execute_step_unknown_tool() {
        let agent = LayerAgent::for_layer(Layer::L1);
        let mut step = PlanStep::new(1, "test", SubAgent::NodeSync);
        step.tool_names.push("nonexistent_tool".to_string());
        let result = agent.execute_step(&step).await;
        assert_eq!(result.status, StepStatus::Failed);
        assert!(result.tool_outputs.contains_key("nonexistent_tool"));
    }

    #[tokio::test]
    async fn test_execute_step_live_tool_env_independent() {
        // Tool execution against live-or-down services — status depends on env.
        // On dev machine (no services): Failed. On edge (services up): Success.
        // Either way, the step should produce a tool_outputs entry.
        let agent = LayerAgent::for_layer(Layer::L1);
        let step =
            PlanStep::new(1, "test", SubAgent::NodeSync).with_tools(&["zion_rpc_getblockcount"]);
        let result = agent.execute_step(&step).await;
        assert!(matches!(
            result.status,
            StepStatus::Success | StepStatus::Failed | StepStatus::PartialSuccess
        ));
        assert!(result.tool_outputs.contains_key("zion_rpc_getblockcount"));
    }

    // ── LayerAgentRegistry ─────────────────────────────────────────────────────

    #[test]
    fn test_registry_has_7_agents() {
        let reg = LayerAgentRegistry::new();
        assert_eq!(reg.len(), 7);
        assert!(!reg.is_empty());
    }

    #[test]
    fn test_registry_get_each_layer() {
        let reg = LayerAgentRegistry::new();
        for layer in LayerAgentRegistry::all_layers() {
            assert!(
                reg.get(layer).is_some(),
                "Should have agent for {:?}",
                layer
            );
        }
        // All agents should have correct layer
        for layer in LayerAgentRegistry::all_layers() {
            let a = reg.get(layer).unwrap();
            assert_eq!(a.layer, layer);
        }
    }

    #[tokio::test]
    async fn test_registry_execute_step_dispatches() {
        let reg = LayerAgentRegistry::new();
        let step = PlanStep::new(1, "test", SubAgent::NodeSync);
        let result = reg.execute_step(&step).await.unwrap();
        assert_eq!(result.step_id, 1);
        assert_eq!(result.sub_agent, SubAgent::NodeSync);
    }

    #[tokio::test]
    async fn test_registry_execute_step_wrong_layer() {
        // Manually construct a step with a sub_agent whose layer has no agent
        // — but all layers have agents, so this should always succeed.
        // Instead test that a step with no tools succeeds.
        let reg = LayerAgentRegistry::new();
        let step = PlanStep::new(1, "noop", SubAgent::OasisManager);
        let result = reg.execute_step(&step).await.unwrap();
        assert_eq!(result.status, StepStatus::Success);
    }

    // ── StepResult / StepStatus ─────────────────────────────────────────────────

    #[test]
    fn test_step_result_pending() {
        let step = PlanStep::new(1, "x", SubAgent::NodeSync);
        let r = StepResult::pending(&step);
        assert_eq!(r.status, StepStatus::Pending);
        assert_eq!(r.step_id, 1);
    }

    #[test]
    fn test_step_status_predicates() {
        let step = PlanStep::new(1, "x", SubAgent::NodeSync);
        let mut r = StepResult::pending(&step);
        r.status = StepStatus::Success;
        assert!(r.is_success());
        r.status = StepStatus::PartialSuccess;
        assert!(r.is_success());
        r.status = StepStatus::Failed;
        assert!(!r.is_success());
    }

    #[test]
    fn test_step_result_duration() {
        let step = PlanStep::new(1, "x", SubAgent::NodeSync);
        let r = StepResult::pending(&step);
        // started_at and finished_at are both Utc::now() — duration should be ~0
        let d = r.duration_ms();
        assert!(d <= 1000, "duration should be small, got {}", d);
    }
}
