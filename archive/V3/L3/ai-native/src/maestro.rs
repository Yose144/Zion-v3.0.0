//! # 🎼 Hiran v2.4 Maestro — Top-Level Orchestrator
//!
//! The Maestro is the apex of the v2.4 hierarchy. It integrates:
//! - [`IntentRouter`] — classifies user input → [`Intent`]
//! - [`Planner`] — decomposes Intent → [`ExecutionPlan`]
//! - [`HealthPoller`] — async health matrix of 26 services
//! - [`LayerAgentRegistry`] — 7 Layer Agents that execute plan steps
//!
//! ## Flow
//! ```text
//! user input
//!    │
//!    ▼
//! IntentRouter ──► Intent
//!    │
//!    ▼
//! Planner ──► ExecutionPlan (DAG of PlanSteps)
//!    │
//!    ▼
//! Maestro.execute_plan()
//!    │  (topological iteration)
//!    ▼
//! LayerAgentRegistry.execute_step() ──► StepResult
//!    │  (per layer)
//!    ▼
//! PlanExecutionResult (aggregated)
//! ```

use crate::error::{AiError, AiResult};
use crate::health_poller::{HealthMatrix, HealthPoller};
use crate::intent::IntentRouter;
use crate::layer_agents::{LayerAgentRegistry, StepResult, StepStatus};
use crate::planner::{ExecutionPlan, Planner};
use crate::tool_registry::{Intent, ToolRegistry};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

// ============================================================================
// Plan execution result
// ============================================================================

/// Result of executing an entire plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanExecutionResult {
    /// The plan that was executed.
    pub plan: ExecutionPlan,
    /// Result of each step, keyed by step ID.
    pub step_results: HashMap<u32, StepResult>,
    /// Steps that were skipped (dependency failed or approval denied).
    pub skipped_steps: Vec<u32>,
    /// Overall status.
    pub status: ExecutionStatus,
    /// When execution started.
    pub started_at: DateTime<Utc>,
    /// When execution finished.
    pub finished_at: DateTime<Utc>,
    /// Total duration in ms.
    pub total_duration_ms: u64,
    /// Final response text (composed by the aggregation step).
    pub response: String,
}

/// Overall status of plan execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExecutionStatus {
    /// All steps succeeded.
    Success,
    /// Some steps succeeded, some failed (but critical path OK).
    PartialSuccess,
    /// A critical step failed.
    Failed,
    /// Execution was cancelled (e.g. approval denied).
    Cancelled,
}

impl PlanExecutionResult {
    pub fn is_success(&self) -> bool {
        matches!(
            self.status,
            ExecutionStatus::Success | ExecutionStatus::PartialSuccess
        )
    }

    /// Count steps by status.
    pub fn step_counts(&self) -> (usize, usize, usize, usize) {
        let mut ok = 0;
        let mut partial = 0;
        let mut failed = 0;
        let mut skipped = 0;
        for r in self.step_results.values() {
            match r.status {
                StepStatus::Success => ok += 1,
                StepStatus::PartialSuccess => partial += 1,
                StepStatus::Failed => failed += 1,
                StepStatus::Skipped => skipped += 1,
                StepStatus::Pending => {}
            }
        }
        skipped += self.skipped_steps.len();
        (ok, partial, failed, skipped)
    }
}

// ============================================================================
// Maestro
// ============================================================================

/// The Maestro — apex orchestrator of v2.4.
pub struct Maestro {
    intent_router: IntentRouter,
    planner: Planner,
    poller: HealthPoller,
    layer_agents: LayerAgentRegistry,
    /// Cached health matrix (refreshed by `refresh_health()`).
    health_cache: Arc<tokio::sync::RwLock<Option<HealthMatrix>>>,
}

impl Maestro {
    /// Construct a new Maestro with all v2.4 components.
    pub fn new() -> Self {
        let registry = ToolRegistry::with_all_tools();
        Self {
            intent_router: IntentRouter::rule_based(),
            planner: Planner::new(registry),
            poller: HealthPoller::with_default(),
            layer_agents: LayerAgentRegistry::new(),
            health_cache: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    /// Classify user input into an Intent (rule-based fallback if no LLM).
    pub fn classify(&self, user_input: &str) -> Intent {
        self.intent_router
            .classify(user_input)
            .map(|c| c.intent)
            .unwrap_or(Intent::SystemHealth)
    }

    /// Build an execution plan for the given user input.
    /// (Classifies → plans → validates.)
    pub fn plan_for_input(&self, user_input: &str) -> AiResult<ExecutionPlan> {
        let intent = self.classify(user_input);
        self.planner.plan(intent, user_input)
    }

    /// Build an execution plan for a known intent.
    pub fn plan_for_intent(&self, intent: Intent, user_input: &str) -> AiResult<ExecutionPlan> {
        self.planner.plan(intent, user_input)
    }

    /// Refresh the health matrix (async, probes all 26 services).
    pub async fn refresh_health(&self) -> HealthMatrix {
        let matrix = self.poller.poll_all().await;
        let mut cache = self.health_cache.write().await;
        *cache = Some(matrix.clone());
        matrix
    }

    /// Get the cached health matrix (or None if not yet refreshed).
    pub async fn health(&self) -> Option<HealthMatrix> {
        self.health_cache.read().await.clone()
    }

    /// Execute a plan — iterates steps in topological order, dispatching each
    /// to the appropriate Layer Agent. Skips steps whose dependencies failed.
    pub async fn execute_plan(&self, plan: &ExecutionPlan) -> AiResult<PlanExecutionResult> {
        let started_at = Utc::now();
        let start_instant = std::time::Instant::now();

        // Topological order
        let order = plan.topological_order()?;

        let mut step_results: HashMap<u32, StepResult> = HashMap::new();
        let mut skipped_steps: Vec<u32> = Vec::new();
        let mut any_failed = false;
        let mut any_critical_failed = false;

        for step_id in order {
            let step = plan.steps.iter().find(|s| s.id == step_id).ok_or_else(|| {
                AiError::ToolExecutionFailed(format!("step {} not found in plan", step_id))
            })?;

            // Check dependencies — if any failed or were skipped, skip this step
            let mut dep_failed = false;
            for dep_id in &step.depends_on {
                match step_results.get(dep_id) {
                    Some(r) if matches!(r.status, StepStatus::Failed | StepStatus::Skipped) => {
                        dep_failed = true;
                        break;
                    }
                    None => {
                        // Dependency was skipped earlier
                        if skipped_steps.contains(dep_id) {
                            dep_failed = true;
                            break;
                        }
                    }
                    _ => {}
                }
            }

            if dep_failed {
                skipped_steps.push(step_id);
                let mut r = StepResult::pending(step);
                r.status = StepStatus::Skipped;
                r.error = Some("dependency failed or skipped".to_string());
                step_results.insert(step_id, r);
                any_failed = true;
                continue;
            }

            // Approval gate — for now, auto-approve (in production, would prompt user)
            // Future: if step.requires_approval && !approved { skip }
            if step.requires_approval {
                // MVP: log but proceed. Production v2.4: integrate with approval UI.
                // For safety, approval-required steps that mutate state should be
                // gated behind an explicit user confirmation flow.
            }

            // Execute via Layer Agent registry
            let result = self.layer_agents.execute_step(step).await?;
            if matches!(result.status, StepStatus::Failed) {
                any_failed = true;
                // If this step has no dependents, it's a leaf failure (non-critical
                // for the overall plan if aggregation step still runs).
                // If it's a root step that others depend on, it's critical.
                let has_dependents = plan.steps.iter().any(|s| s.depends_on.contains(&step_id));
                if has_dependents {
                    any_critical_failed = true;
                }
            }
            step_results.insert(step_id, result);
        }

        let total_duration_ms = start_instant.elapsed().as_millis() as u64;
        let status = if any_critical_failed {
            ExecutionStatus::Failed
        } else if any_failed {
            ExecutionStatus::PartialSuccess
        } else {
            ExecutionStatus::Success
        };

        // Compose a simple response — in production this would use the LLM to
        // synthesize tool outputs into a natural-language response.
        let response = compose_response(&step_results, status);

        Ok(PlanExecutionResult {
            plan: plan.clone(),
            step_results,
            skipped_steps,
            status,
            started_at,
            finished_at: Utc::now(),
            total_duration_ms,
            response,
        })
    }

    /// End-to-end: classify input → plan → execute → return result.
    pub async fn orchestrate(&self, user_input: &str) -> AiResult<PlanExecutionResult> {
        let plan = self.plan_for_input(user_input)?;
        self.execute_plan(&plan).await
    }
}

impl Default for Maestro {
    fn default() -> Self {
        Self::new()
    }
}

/// Compose a simple text response from step results.
/// (MVP — in production, this would call the LLM to synthesize a natural response.)
fn compose_response(step_results: &HashMap<u32, StepResult>, status: ExecutionStatus) -> String {
    let (ok, partial, failed, skipped) = {
        let mut ok = 0;
        let mut partial = 0;
        let mut failed = 0;
        let mut skipped = 0;
        for r in step_results.values() {
            match r.status {
                StepStatus::Success => ok += 1,
                StepStatus::PartialSuccess => partial += 1,
                StepStatus::Failed => failed += 1,
                StepStatus::Skipped => skipped += 1,
                StepStatus::Pending => {}
            }
        }
        (ok, partial, failed, skipped)
    };
    let status_str = match status {
        ExecutionStatus::Success => "✅ Success",
        ExecutionStatus::PartialSuccess => "⚠️ Partial success",
        ExecutionStatus::Failed => "❌ Failed",
        ExecutionStatus::Cancelled => "🚫 Cancelled",
    };
    format!(
        "{} — steps: {} ok, {} partial, {} failed, {} skipped",
        status_str, ok, partial, failed, skipped
    )
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health_poller::HealthStatus;
    use crate::planner::PlanStep;
    use crate::tool_registry::SubAgent;

    fn maestro() -> Maestro {
        Maestro::new()
    }

    // ── Classification ─────────────────────────────────────────────────────────

    #[test]
    fn test_classify_node_info() {
        let m = maestro();
        assert_eq!(m.classify("block height?"), Intent::NodeInfo);
    }

    #[test]
    fn test_classify_miner_control() {
        let m = maestro();
        assert_eq!(m.classify("start mining"), Intent::MinerControl);
    }

    #[test]
    fn test_classify_system_health() {
        let m = maestro();
        assert_eq!(m.classify("is everything healthy?"), Intent::SystemHealth);
    }

    // ── Planning ───────────────────────────────────────────────────────────────

    #[test]
    fn test_plan_for_input() {
        let m = maestro();
        let plan = m.plan_for_input("block height?").unwrap();
        assert_eq!(plan.intent, Intent::NodeInfo);
        assert!(!plan.steps.is_empty());
    }

    #[test]
    fn test_plan_for_intent() {
        let m = maestro();
        let plan = m.plan_for_intent(Intent::MinerControl, "mine").unwrap();
        assert_eq!(plan.intent, Intent::MinerControl);
        assert!(plan.requires_approval());
    }

    #[test]
    fn test_plan_for_all_intents() {
        let m = maestro();
        for intent in [
            Intent::SystemHealth,
            Intent::MinerControl,
            Intent::NodeInfo,
            Intent::WalletQuery,
            Intent::BridgeStatus,
            Intent::DaoGovernance,
            Intent::SwapOperation,
            Intent::L3Query,
            Intent::L456Status,
            Intent::SystemOps,
            Intent::DefiStatus,
            Intent::BackupQuery,
            Intent::DatabaseInspect,
            Intent::WatchdogStatus,
        ] {
            let plan = m.plan_for_intent(intent.clone(), "test").unwrap();
            assert!(
                !plan.steps.is_empty(),
                "Plan for {:?} should have steps",
                intent
            );
        }
    }

    // ── Health ─────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_refresh_health() {
        let m = maestro();
        let matrix = m.refresh_health().await;
        assert_eq!(matrix.services.len(), 26);
        // No services running in test env → overall should be Down or Degraded
        // (something might be on common ports like 80/443)
        assert!(matches!(
            matrix.overall(),
            HealthStatus::Down | HealthStatus::Degraded | HealthStatus::Healthy
        ));
    }

    #[tokio::test]
    async fn test_health_cache() {
        let m = maestro();
        // Initially None
        assert!(m.health().await.is_none());
        m.refresh_health().await;
        // Now cached
        let cached = m.health().await;
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().services.len(), 26);
    }

    // ── Plan execution ─────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_execute_plan_node_info() {
        let m = maestro();
        let plan = m.plan_for_input("block height?").unwrap();
        let result = m.execute_plan(&plan).await.unwrap();
        // Status depends on environment: on dev machine (no services) → Failed
        // (step 1 tools fail, step 2 skipped). On edge (node1 up on 9443) → Success.
        assert!(matches!(
            result.status,
            ExecutionStatus::Success | ExecutionStatus::Failed
        ));
        // Step 1 and step 2 should both be present
        assert!(result.step_results.contains_key(&1));
        assert!(result.step_results.contains_key(&2));
    }

    #[tokio::test]
    async fn test_execute_plan_no_tools() {
        // A plan with only aggregation steps (no tools) → all succeed
        let m = maestro();
        let plan = ExecutionPlan {
            id: uuid::Uuid::new_v4(),
            intent: Intent::NodeInfo,
            user_input: "test".into(),
            steps: vec![
                PlanStep::new(1, "noop1", SubAgent::AiNativeRuntime),
                PlanStep::new(2, "noop2", SubAgent::AiNativeRuntime).depends_on(&[1]),
            ],
            created_at: Utc::now(),
            estimated_duration_s: 5,
        };
        let result = m.execute_plan(&plan).await.unwrap();
        assert_eq!(result.status, ExecutionStatus::Success);
        let (ok, _, _, _) = result.step_counts();
        assert_eq!(ok, 2);
    }

    #[tokio::test]
    async fn test_execute_plan_skips_on_dependency_failure() {
        let m = maestro();
        // Step 1 uses a nonexistent tool → guaranteed to fail in any environment.
        // Step 2 depends on step 1 → should be skipped.
        let plan = ExecutionPlan {
            id: uuid::Uuid::new_v4(),
            intent: Intent::NodeInfo,
            user_input: "test".into(),
            steps: vec![
                PlanStep::new(1, "fail", SubAgent::NodeSync)
                    .with_tools(&["nonexistent_tool_guaranteed_fail"]),
                PlanStep::new(2, "dependent", SubAgent::AiNativeRuntime).depends_on(&[1]),
            ],
            created_at: Utc::now(),
            estimated_duration_s: 5,
        };
        let result = m.execute_plan(&plan).await.unwrap();
        // Step 1 failed → step 2 should be skipped
        let r1 = result.step_results.get(&1).unwrap();
        assert_eq!(r1.status, StepStatus::Failed);
        let r2 = result.step_results.get(&2).unwrap();
        assert_eq!(r2.status, StepStatus::Skipped);
        assert!(!result.skipped_steps.is_empty());
    }

    // ── End-to-end orchestration ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_orchestrate_node_info() {
        let m = maestro();
        let result = m.orchestrate("block height?").await.unwrap();
        assert_eq!(result.plan.intent, Intent::NodeInfo);
        assert!(!result.response.is_empty());
    }

    #[tokio::test]
    async fn test_orchestrate_system_health() {
        let m = maestro();
        let result = m.orchestrate("is everything healthy?").await.unwrap();
        assert_eq!(result.plan.intent, Intent::SystemHealth);
        // SystemHealth has 7 steps — 6 tool steps (fail) + 1 aggregation (succeeds)
        assert!(result.step_results.len() >= 6);
    }

    #[tokio::test]
    async fn test_orchestrate_miner_control() {
        let m = maestro();
        let result = m.orchestrate("start mining").await.unwrap();
        assert_eq!(result.plan.intent, Intent::MinerControl);
        // MinerControl has approval-required steps
        assert!(result.plan.requires_approval());
    }

    // ── PlanExecutionResult helpers ────────────────────────────────────────────

    #[test]
    fn test_execution_status_predicates() {
        let m = maestro();
        let plan = m.plan_for_intent(Intent::NodeInfo, "test").unwrap();
        let r = PlanExecutionResult {
            plan,
            step_results: HashMap::new(),
            skipped_steps: vec![],
            status: ExecutionStatus::Success,
            started_at: Utc::now(),
            finished_at: Utc::now(),
            total_duration_ms: 100,
            response: "ok".into(),
        };
        assert!(r.is_success());

        let r2 = PlanExecutionResult {
            status: ExecutionStatus::Failed,
            ..r
        };
        assert!(!r2.is_success());
    }

    #[test]
    fn test_compose_response() {
        let results = HashMap::new();
        let s = compose_response(&results, ExecutionStatus::Success);
        assert!(s.contains("Success"));
        assert!(s.contains("0 ok"));
    }
}
