//! # 📋 Hiran v2.4 Maestro — Planner Engine
//!
//! Decomposes a classified [`Intent`] into a structured [`ExecutionPlan`] —
//! a DAG of [`PlanStep`]s with dependencies, each step mapping to one or more
//! tools from the [`ToolRegistry`].
//!
//! ## Architecture
//! ```text
//! Intent ──► Planner ──► ExecutionPlan
//!                          ├── PlanStep 1 (no deps)    → tools: [zion_rpc_getblockcount, ...]
//!                          ├── PlanStep 2 (no deps)    → tools: [zion_bridge_get_validators, ...]
//!                          └── PlanStep 3 (deps: 1,2)  → tools: [aggregate, format response]
//! ```
//!
//! ## Two modes
//! 1. **Template-based** (default, no LLM) — pre-defined plan templates per Intent.
//!    Fast, deterministic, suitable for dev + MVP.
//! 2. **LLM-based** (future, v2.4 production) — uses LLM to decompose novel intents.

use crate::error::{AiError, AiResult};
use crate::tool_registry::{Intent, SubAgent, ToolRegistry};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

// ============================================================================
// Plan structures
// ============================================================================

/// A single step in an execution plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    /// Unique step ID within the plan.
    pub id: u32,
    /// Human-readable description of what this step does.
    pub description: String,
    /// Sub-agent responsible for executing this step.
    pub sub_agent: SubAgent,
    /// Tool names to invoke in this step (executed in parallel within the step).
    pub tool_names: Vec<String>,
    /// Step IDs that must complete before this step can start.
    pub depends_on: Vec<u32>,
    /// Whether this step requires human approval before execution.
    pub requires_approval: bool,
    /// Maximum duration for this step (seconds). 0 = no limit.
    pub timeout_s: u64,
}

impl PlanStep {
    pub fn new(id: u32, description: impl Into<String>, sub_agent: SubAgent) -> Self {
        Self {
            id,
            description: description.into(),
            sub_agent,
            tool_names: Vec::new(),
            depends_on: Vec::new(),
            requires_approval: false,
            timeout_s: 30,
        }
    }

    pub fn with_tools(mut self, tools: &[&str]) -> Self {
        self.tool_names = tools.iter().map(|s| s.to_string()).collect();
        self
    }

    pub fn depends_on(mut self, ids: &[u32]) -> Self {
        self.depends_on = ids.to_vec();
        self
    }

    pub fn requires_approval(mut self) -> Self {
        self.requires_approval = true;
        self
    }

    pub fn with_timeout(mut self, seconds: u64) -> Self {
        self.timeout_s = seconds;
        self
    }
}

/// An execution plan — DAG of steps to fulfill an Intent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlan {
    /// Plan ID.
    pub id: Uuid,
    /// Intent this plan fulfills.
    pub intent: Intent,
    /// Original user input (for context / logging).
    pub user_input: String,
    /// All steps in the plan (unordered — use `depends_on` for ordering).
    pub steps: Vec<PlanStep>,
    /// When the plan was created.
    pub created_at: DateTime<Utc>,
    /// Estimated total duration (seconds) — sum of critical path.
    pub estimated_duration_s: u64,
}

impl ExecutionPlan {
    /// Steps with no dependencies (can start immediately).
    pub fn root_steps(&self) -> Vec<&PlanStep> {
        self.steps
            .iter()
            .filter(|s| s.depends_on.is_empty())
            .collect()
    }

    /// Steps that depend on the given step ID.
    pub fn dependents_of(&self, step_id: u32) -> Vec<&PlanStep> {
        self.steps
            .iter()
            .filter(|s| s.depends_on.contains(&step_id))
            .collect()
    }

    /// All tool names referenced in the plan.
    pub fn all_tool_names(&self) -> HashSet<String> {
        self.steps
            .iter()
            .flat_map(|s| s.tool_names.iter().cloned())
            .collect()
    }

    /// True if any step requires human approval.
    pub fn requires_approval(&self) -> bool {
        self.steps.iter().any(|s| s.requires_approval)
    }

    /// Validate that all tool names exist in the registry and all dependencies
    /// point to existing step IDs.
    pub fn validate(&self, registry: &ToolRegistry) -> AiResult<()> {
        // Check tool names
        for step in &self.steps {
            for name in &step.tool_names {
                if registry.get(name).is_none() {
                    return Err(AiError::ToolNotFound(format!(
                        "Plan step {} references unknown tool: {}",
                        step.id, name
                    )));
                }
            }
        }
        // Check dependencies
        let ids: HashSet<u32> = self.steps.iter().map(|s| s.id).collect();
        for step in &self.steps {
            for dep in &step.depends_on {
                if !ids.contains(dep) {
                    return Err(AiError::ToolExecutionFailed(format!(
                        "Plan step {} depends on unknown step: {}",
                        step.id, dep
                    )));
                }
            }
        }
        // Check for cycles (simple DFS)
        if self.has_cycle() {
            return Err(AiError::ToolExecutionFailed(
                "Plan has a dependency cycle".to_string(),
            ));
        }
        Ok(())
    }

    /// Detect cycles via DFS.
    fn has_cycle(&self) -> bool {
        use std::collections::HashMap;
        let mut visited: HashMap<u32, bool> = HashMap::new();
        let mut stack: HashMap<u32, bool> = HashMap::new();
        for step in &self.steps {
            if !visited.get(&step.id).copied().unwrap_or(false)
                && self.dfs_cycle(step.id, &mut visited, &mut stack)
            {
                return true;
            }
        }
        false
    }

    fn dfs_cycle(
        &self,
        node: u32,
        visited: &mut std::collections::HashMap<u32, bool>,
        stack: &mut std::collections::HashMap<u32, bool>,
    ) -> bool {
        if *stack.get(&node).unwrap_or(&false) {
            return true;
        }
        if *visited.get(&node).unwrap_or(&false) {
            return false;
        }
        visited.insert(node, true);
        stack.insert(node, true);
        for dep in self.dependents_of(node) {
            if self.dfs_cycle(dep.id, visited, stack) {
                return true;
            }
        }
        stack.insert(node, false);
        false
    }

    /// Topological order of steps (BFS-based).
    pub fn topological_order(&self) -> AiResult<Vec<u32>> {
        let mut order = Vec::with_capacity(self.steps.len());
        let mut done: HashSet<u32> = HashSet::new();
        let mut remaining: Vec<PlanStep> = self.steps.clone();
        while !remaining.is_empty() {
            let mut progress = false;
            let mut next = Vec::new();
            for step in remaining.drain(..) {
                if step.depends_on.iter().all(|d| done.contains(d)) {
                    order.push(step.id);
                    done.insert(step.id);
                    progress = true;
                    // Don't add to next — it's been processed
                } else {
                    next.push(step);
                }
            }
            remaining = next;
            if !progress {
                return Err(AiError::ToolExecutionFailed(
                    "Plan has a cycle — cannot topologically sort".to_string(),
                ));
            }
        }
        Ok(order)
    }
}

// ============================================================================
// Planner
// ============================================================================

/// Planner Engine — builds ExecutionPlan from Intent.
pub struct Planner {
    /// Tool registry for validation + tool lookup.
    registry: ToolRegistry,
}

impl Planner {
    pub fn new(registry: ToolRegistry) -> Self {
        Self { registry }
    }

    /// Build an execution plan for the given intent + user input.
    pub fn plan(&self, intent: Intent, user_input: &str) -> AiResult<ExecutionPlan> {
        let steps = template_for_intent(&intent);
        let plan = ExecutionPlan {
            id: Uuid::new_v4(),
            intent,
            user_input: user_input.to_string(),
            steps,
            created_at: Utc::now(),
            estimated_duration_s: 10,
        };
        plan.validate(&self.registry)?;
        Ok(plan)
    }

    /// Reference to the tool registry.
    pub fn registry(&self) -> &ToolRegistry {
        &self.registry
    }
}

// ============================================================================
// Plan templates per Intent
// ============================================================================

/// Template-based plan generation (no LLM). Returns steps for the given intent.
fn template_for_intent(intent: &Intent) -> Vec<PlanStep> {
    match intent {
        // ── SystemHealth: aggregate health across all layers ──────────────────
        Intent::SystemHealth => vec![
            PlanStep::new(1, "L1 node health (primary)", SubAgent::NodeSync)
                .with_tools(&[
                    "zion_rpc_getblockcount",
                    "zion_rpc_getnetworkinfo",
                    "zion_rpc_getpeerinfo",
                ])
                .with_timeout(10),
            PlanStep::new(2, "L1 pool health", SubAgent::PoolWorkers)
                .with_tools(&["zion_pool_get_sessions"])
                .with_timeout(10),
            PlanStep::new(3, "L2 bridge + DAO health", SubAgent::BridgeValidators)
                .with_tools(&["zion_bridge_get_validators", "zion_dao_get_proposals"])
                .with_timeout(10),
            PlanStep::new(4, "L3 WARP + NCL health", SubAgent::WarpRouter)
                .with_tools(&["zion_warp_status", "zion_ncl_list_providers"])
                .with_timeout(10),
            PlanStep::new(5, "L4-L6 health", SubAgent::OasisManager)
                .with_tools(&[
                    "zion_oasis_economy_status",
                    "zion_free_world_donation_status",
                    "zion_issobella_link_status",
                ])
                .with_timeout(10),
            PlanStep::new(
                6,
                "System health (Docker + Prometheus)",
                SubAgent::DockerHealth,
            )
            .with_tools(&["docker_list_containers", "prometheus_alerts"])
            .with_timeout(10),
            PlanStep::new(7, "Aggregate + format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2, 3, 4, 5, 6])
                .with_timeout(5),
        ],

        // ── MinerControl: benchmark + optimize + start ────────────────────────
        Intent::MinerControl => vec![
            PlanStep::new(
                1,
                "Benchmark all 3 algorithms (30s each)",
                SubAgent::MinerPerformance,
            )
            .with_tools(&["zion_miner_benchmark"])
            .with_timeout(120),
            PlanStep::new(2, "Check GPU thermal status", SubAgent::MinerThermal)
                .with_tools(&["zion_miner_get_temps"])
                .with_timeout(10),
            PlanStep::new(
                3,
                "Check pool economics (profitability)",
                SubAgent::PoolEconomics,
            )
            .with_tools(&["zion_rpc_getmininginfo", "zion_pool_get_sessions"])
            .with_timeout(10),
            // Step 4 depends on 1,2,3 — selects best algorithm
            PlanStep::new(
                4,
                "Select optimal algorithm + report",
                SubAgent::MinerPerformance,
            )
            .depends_on(&[1, 2, 3])
            .with_timeout(5),
            // Step 5: actually start miner (requires approval)
            PlanStep::new(
                5,
                "Start miner with optimal algorithm",
                SubAgent::MinerPerformance,
            )
            .depends_on(&[4])
            .with_tools(&["zion_miner_ctrl"])
            .requires_approval()
            .with_timeout(15),
        ],

        // ── NodeInfo: simple parallel queries ─────────────────────────────────
        Intent::NodeInfo => vec![
            PlanStep::new(1, "Query node info", SubAgent::NodeSync)
                .with_tools(&[
                    "zion_rpc_getblockcount",
                    "zion_rpc_getnetworkinfo",
                    "zion_rpc_getpeerinfo",
                    "zion_rpc_getmininginfo",
                ])
                .with_timeout(10),
            PlanStep::new(2, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1])
                .with_timeout(5),
        ],

        // ── WalletQuery ───────────────────────────────────────────────────────
        Intent::WalletQuery => vec![
            PlanStep::new(1, "Query balance + supply", SubAgent::WalletOps)
                .with_tools(&["zion_rpc_getaccountbalance", "zion_rpc_getsupplyinfo"])
                .with_timeout(10),
            PlanStep::new(2, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1])
                .with_timeout(5),
        ],

        // ── BridgeStatus ──────────────────────────────────────────────────────
        Intent::BridgeStatus => vec![
            PlanStep::new(1, "Query bridge validators", SubAgent::BridgeValidators)
                .with_tools(&["zion_bridge_get_validators"])
                .with_timeout(10),
            PlanStep::new(2, "Query active cross-chain txs", SubAgent::BridgeWatcher)
                .with_tools(&["zion_bridge_track_tx"])
                .with_timeout(10),
            PlanStep::new(3, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2])
                .with_timeout(5),
        ],

        // ── DaoGovernance ─────────────────────────────────────────────────────
        Intent::DaoGovernance => vec![
            PlanStep::new(1, "Query active proposals", SubAgent::DaoProposals)
                .with_tools(&["zion_dao_get_proposals"])
                .with_timeout(10),
            PlanStep::new(2, "Query treasury", SubAgent::DaoTreasury)
                .with_tools(&["zion_dao_get_treasury"])
                .with_timeout(10),
            // Step 3: vote (only if user requested, requires approval)
            PlanStep::new(3, "Vote on proposal (if requested)", SubAgent::DaoProposals)
                .depends_on(&[1])
                .with_tools(&["zion_dao_vote"])
                .requires_approval()
                .with_timeout(15),
            PlanStep::new(4, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2])
                .with_timeout(5),
        ],

        // ── SwapOperation ─────────────────────────────────────────────────────
        Intent::SwapOperation => vec![
            PlanStep::new(1, "Query swap market rates", SubAgent::SwapMarket)
                .with_tools(&["zion_swap_market_rates"])
                .with_timeout(10),
            PlanStep::new(
                2,
                "Query swap status (if swap_id given)",
                SubAgent::SwapExecutor,
            )
            .with_tools(&["zion_swap_status"])
            .with_timeout(10),
            // Step 3: execute swap (requires approval)
            PlanStep::new(3, "Execute swap (if requested)", SubAgent::SwapExecutor)
                .depends_on(&[1, 2])
                .with_tools(&["zion_swap_execute"])
                .requires_approval()
                .with_timeout(20),
            PlanStep::new(4, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2])
                .with_timeout(5),
        ],

        // ── L3Query: WARP + NCL ───────────────────────────────────────────────
        Intent::L3Query => vec![
            PlanStep::new(1, "Query WARP routes + status", SubAgent::WarpRouter)
                .with_tools(&["zion_warp_get_routes", "zion_warp_status"])
                .with_timeout(10),
            PlanStep::new(2, "Query NCL providers", SubAgent::NclMarket)
                .with_tools(&["zion_ncl_list_providers"])
                .with_timeout(10),
            PlanStep::new(3, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2])
                .with_timeout(5),
        ],

        // ── L456Status: Oasis + Free World + Issobella ────────────────────────
        Intent::L456Status => vec![
            PlanStep::new(
                1,
                "Query Oasis economy + NPC quality",
                SubAgent::OasisManager,
            )
            .with_tools(&["zion_oasis_economy_status", "zion_oasis_npc_quality"])
            .with_timeout(10),
            PlanStep::new(
                2,
                "Query Free World donations + impact",
                SubAgent::FreeWorldOps,
            )
            .with_tools(&[
                "zion_free_world_donation_status",
                "zion_free_world_impact_report",
            ])
            .with_timeout(10),
            PlanStep::new(
                3,
                "Query Issobella links + data quality",
                SubAgent::IsobellaOps,
            )
            .with_tools(&["zion_issobella_link_status", "zion_issobella_data_quality"])
            .with_timeout(10),
            PlanStep::new(4, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2, 3])
                .with_timeout(5),
        ],

        // ── SystemOps: docker + backup + prometheus ───────────────────────────
        Intent::SystemOps => vec![
            PlanStep::new(1, "List Docker containers", SubAgent::DockerHealth)
                .with_tools(&["docker_list_containers"])
                .with_timeout(10),
            PlanStep::new(2, "Query Prometheus alerts", SubAgent::PrometheusAlerts)
                .with_tools(&["prometheus_alerts"])
                .with_timeout(10),
            // Step 3: restart container (requires approval)
            PlanStep::new(
                3,
                "Restart container (if requested)",
                SubAgent::DockerHealth,
            )
            .depends_on(&[1])
            .with_tools(&["docker_restart_container"])
            .requires_approval()
            .with_timeout(20),
            // Step 4: backup (requires approval)
            PlanStep::new(4, "Trigger backup (if requested)", SubAgent::BackupManager)
                .with_tools(&["backup_trigger"])
                .requires_approval()
                .with_timeout(60),
            PlanStep::new(5, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2])
                .with_timeout(5),
        ],

        // ── DefiStatus: Base Mainnet DeFi contracts ───────────────────────────
        Intent::DefiStatus => vec![
            PlanStep::new(1, "Query staking status (12% APR)", SubAgent::DefiMonitor)
                .with_tools(&["zion_defi_staking_status"])
                .with_timeout(10),
            PlanStep::new(2, "Query farm status (1 wZION/s)", SubAgent::DefiMonitor)
                .with_tools(&["zion_defi_farm_status"])
                .with_timeout(10),
            PlanStep::new(3, "Query DAO treasury", SubAgent::DaoTreasury)
                .with_tools(&["zion_dao_get_treasury"])
                .with_timeout(10),
            PlanStep::new(4, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2, 3])
                .with_timeout(5),
        ],

        // ── BackupQuery: backup status + list ──────────────────────────────────
        Intent::BackupQuery => vec![
            PlanStep::new(1, "Query backup timer status", SubAgent::BackupManager)
                .with_tools(&["backup_status"])
                .with_timeout(10),
            PlanStep::new(2, "List all backups", SubAgent::BackupManager)
                .with_tools(&["backup_list"])
                .with_timeout(10),
            // Step 3: trigger backup (only if requested, requires approval)
            PlanStep::new(3, "Trigger backup (if requested)", SubAgent::BackupManager)
                .depends_on(&[1, 2])
                .with_tools(&["backup_trigger"])
                .requires_approval()
                .with_timeout(60),
            PlanStep::new(4, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2])
                .with_timeout(5),
        ],

        // ── DatabaseInspect: list + inspect databases ──────────────────────────
        Intent::DatabaseInspect => vec![
            PlanStep::new(1, "List all 9 databases", SubAgent::DatabaseInspector)
                .with_tools(&["db_list"])
                .with_timeout(10),
            // Step 2: inspect specific DB (if path given)
            PlanStep::new(
                2,
                "Inspect specific database (if requested)",
                SubAgent::DatabaseInspector,
            )
            .depends_on(&[1])
            .with_tools(&["db_inspect"])
            .with_timeout(15),
            PlanStep::new(3, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2])
                .with_timeout(5),
        ],

        // ── WatchdogStatus: watchdog + alerts ──────────────────────────────────
        Intent::WatchdogStatus => vec![
            PlanStep::new(1, "Query watchdog status", SubAgent::WatchdogController)
                .with_tools(&["watchdog_status"])
                .with_timeout(10),
            PlanStep::new(2, "Query Prometheus alerts", SubAgent::PrometheusAlerts)
                .with_tools(&["prometheus_alerts"])
                .with_timeout(10),
            PlanStep::new(3, "Query dashboard alert history", SubAgent::DashboardOps)
                .with_tools(&["dashboard_alerts"])
                .with_timeout(10),
            // Step 4: trigger watchdog check (requires approval)
            PlanStep::new(
                4,
                "Trigger watchdog check (if requested)",
                SubAgent::WatchdogController,
            )
            .depends_on(&[1])
            .with_tools(&["watchdog_run"])
            .requires_approval()
            .with_timeout(30),
            PlanStep::new(5, "Format response", SubAgent::AiNativeRuntime)
                .depends_on(&[1, 2, 3])
                .with_timeout(5),
        ],
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn planner() -> Planner {
        Planner::new(ToolRegistry::with_all_tools())
    }

    // ── Plan generation ───────────────────────────────────────────────────────

    #[test]
    fn test_plan_system_health() {
        let p = planner();
        let plan = p.plan(Intent::SystemHealth, "je vše zdravé?").unwrap();
        assert_eq!(plan.intent, Intent::SystemHealth);
        assert!(
            plan.steps.len() >= 6,
            "SystemHealth plan should have 6+ steps"
        );
        // All root steps should have no dependencies
        let roots = plan.root_steps();
        assert!(!roots.is_empty(), "Should have at least one root step");
        assert!(roots.iter().all(|s| s.depends_on.is_empty()));
    }

    #[test]
    fn test_plan_miner_control() {
        let p = planner();
        let plan = p.plan(Intent::MinerControl, "start mining").unwrap();
        assert!(plan.steps.len() >= 4);
        // Should have an approval-required step (miner_ctrl)
        assert!(
            plan.requires_approval(),
            "MinerControl plan should require approval"
        );
    }

    #[test]
    fn test_plan_node_info() {
        let p = planner();
        let plan = p.plan(Intent::NodeInfo, "block height?").unwrap();
        assert!(plan.steps.len() >= 2);
        assert!(
            !plan.requires_approval(),
            "NodeInfo should not require approval"
        );
    }

    #[test]
    fn test_plan_dao_governance() {
        let p = planner();
        let plan = p.plan(Intent::DaoGovernance, "show proposals").unwrap();
        assert!(
            plan.requires_approval(),
            "DaoGovernance plan should require approval (vote step)"
        );
    }

    #[test]
    fn test_plan_all_intents() {
        // Every intent should produce a valid, non-empty plan
        let p = planner();
        let intents = [
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
        ];
        for intent in &intents {
            let plan = p
                .plan(intent.clone(), "test")
                .unwrap_or_else(|e| panic!("Plan for {:?} failed: {}", intent, e));
            assert!(
                !plan.steps.is_empty(),
                "Plan for {:?} should have steps",
                intent
            );
        }
    }

    // ── Validation ────────────────────────────────────────────────────────────

    #[test]
    fn test_plan_validates_tools_exist() {
        let p = planner();
        let plan = p.plan(Intent::SystemHealth, "test").unwrap();
        // All tools in the plan should exist in the registry
        for name in plan.all_tool_names() {
            assert!(
                p.registry().get(&name).is_some(),
                "Tool {} should exist",
                name
            );
        }
    }

    #[test]
    fn test_plan_validation_rejects_unknown_tool() {
        let p = planner();
        let mut plan = p.plan(Intent::NodeInfo, "test").unwrap();
        // Inject an invalid tool name
        plan.steps[0]
            .tool_names
            .push("nonexistent_tool".to_string());
        assert!(plan.validate(&p.registry()).is_err());
    }

    #[test]
    fn test_plan_validation_rejects_unknown_dependency() {
        let p = planner();
        let mut plan = p.plan(Intent::NodeInfo, "test").unwrap();
        // Inject an invalid dependency
        plan.steps[1].depends_on.push(999);
        assert!(plan.validate(&p.registry()).is_err());
    }

    // ── Topological order ─────────────────────────────────────────────────────

    #[test]
    fn test_topological_order_ok() {
        let p = planner();
        let plan = p.plan(Intent::SystemHealth, "test").unwrap();
        let order = plan.topological_order().unwrap();
        assert_eq!(order.len(), plan.steps.len());
        // Each step should come after its dependencies
        let mut position = std::collections::HashMap::new();
        for (i, &id) in order.iter().enumerate() {
            position.insert(id, i);
        }
        for step in &plan.steps {
            for dep in &step.depends_on {
                let dep_pos = position[dep];
                let step_pos = position[&step.id];
                assert!(
                    dep_pos < step_pos,
                    "Step {} should come after dependency {}",
                    step.id,
                    dep
                );
            }
        }
    }

    #[test]
    fn test_topological_order_detects_cycle() {
        let mut plan = ExecutionPlan {
            id: Uuid::new_v4(),
            intent: Intent::NodeInfo,
            user_input: "test".to_string(),
            steps: vec![
                PlanStep::new(0, "a", SubAgent::NodeSync).depends_on(&[1]),
                PlanStep::new(1, "b", SubAgent::NodeSync).depends_on(&[0]),
            ],
            created_at: Utc::now(),
            estimated_duration_s: 10,
        };
        // has_cycle should detect it
        assert!(plan.has_cycle());
        // topological_order should error
        let result = plan.topological_order();
        assert!(result.is_err());
        let _ = &mut plan; // suppress unused mut warning
    }

    // ── PlanStep builder ──────────────────────────────────────────────────────

    #[test]
    fn test_plan_step_builder() {
        let step = PlanStep::new(1, "test", SubAgent::NodeSync)
            .with_tools(&["zion_rpc_getblockcount"])
            .depends_on(&[0])
            .requires_approval()
            .with_timeout(60);
        assert_eq!(step.id, 1);
        assert_eq!(step.tool_names, vec!["zion_rpc_getblockcount"]);
        assert_eq!(step.depends_on, vec![0]);
        assert!(step.requires_approval);
        assert_eq!(step.timeout_s, 60);
    }

    // ── ExecutionPlan helpers ─────────────────────────────────────────────────

    #[test]
    fn test_root_steps() {
        let p = planner();
        let plan = p.plan(Intent::SystemHealth, "test").unwrap();
        let roots = plan.root_steps();
        // SystemHealth template has steps 1-6 as roots, step 7 depends on all
        assert!(
            roots.len() >= 5,
            "SystemHealth should have multiple root steps"
        );
    }

    #[test]
    fn test_dependents_of() {
        let p = planner();
        let plan = p.plan(Intent::MinerControl, "test").unwrap();
        // Step 4 depends on 1,2,3 → dependents_of(1) should include 4
        let deps = plan.dependents_of(1);
        assert!(
            deps.iter().any(|s| s.id == 4),
            "Step 4 should depend on step 1"
        );
    }

    #[test]
    fn test_all_tool_names() {
        let p = planner();
        let plan = p.plan(Intent::NodeInfo, "test").unwrap();
        let names = plan.all_tool_names();
        assert!(names.contains("zion_rpc_getblockcount"));
        assert!(names.contains("zion_rpc_getnetworkinfo"));
    }

    #[test]
    fn test_requires_approval() {
        let p = planner();
        let health = p.plan(Intent::SystemHealth, "test").unwrap();
        assert!(
            !health.requires_approval(),
            "SystemHealth should not require approval"
        );
        let miner = p.plan(Intent::MinerControl, "test").unwrap();
        assert!(
            miner.requires_approval(),
            "MinerControl should require approval"
        );
    }
}
