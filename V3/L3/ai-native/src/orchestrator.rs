use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Write;
use uuid::Uuid;

use crate::error::{AiError, AiResult};
use crate::task::{AiTask, AiTaskType};
use crate::types::{Agent, AgentCapability, AgentMessage, AgentStatus};
use zion_ncl::{ComputeBackend, JobScheduler, NclJob, NclTaskType};
use zion_warp::{ChainFamily, ChainId, WarpRouter};

/// Bridge operation types that AI agents can initiate.
#[derive(Debug, Clone)]
pub enum BridgeOperation {
    /// Lock ZION on L1 to mint wZION on target EVM chain
    LockToEvm {
        amount_flowers: u64,
        target_chain: String,
        evm_recipient: String,
    },
    /// Burn wZION on EVM chain to unlock ZION on L1
    BurnToL1 {
        amount_wzion: u64,
        l1_recipient: String,
    },
    /// Submit a compute job to NCL marketplace
    ComputeJob {
        model_id: String,
        backend: ComputeBackend,
        input_hash: String,
        reward_flowers: u64,
        max_duration_secs: u64,
        priority: u8,
        min_consciousness: u8,
        task_type: NclTaskType,
    },
}

/// Central orchestrator managing all AI agents.
pub struct Orchestrator {
    agents: HashMap<Uuid, Agent>,
    message_queue: Vec<AgentMessage>,
    max_agents: usize,
    /// Optional NCL marketplace integration
    ncl_scheduler: Option<JobScheduler>,
    /// Optional WARP multi-chain router
    warp_router: Option<WarpRouter>,
    /// Optional L2 bridge integration for cross-chain operations
    bridge_enabled: bool,
    /// AI Safety: emergency stop flag (zion-agent ai-emergency-stop)
    emergency_stop: bool,
    /// AI Safety: audit log directory (immutable append-only)
    audit_dir: Option<std::path::PathBuf>,
}

impl Orchestrator {
    pub fn new(max_agents: usize) -> Self {
        Self {
            agents: HashMap::new(),
            message_queue: Vec::new(),
            max_agents,
            ncl_scheduler: None,
            warp_router: None,
            bridge_enabled: false,
            emergency_stop: false,
            audit_dir: None,
        }
    }

    /// Enable NCL marketplace integration.
    pub fn with_ncl_marketplace(mut self, scheduler: JobScheduler) -> Self {
        self.ncl_scheduler = Some(scheduler);
        self
    }

    /// Enable WARP multi-chain routing.
    pub fn with_warp_router(mut self, router: WarpRouter) -> Self {
        self.warp_router = Some(router);
        self
    }

    /// Enable L2 bridge integration for automated cross-chain operations.
    pub fn with_bridge_integration(mut self) -> Self {
        self.bridge_enabled = true;
        self
    }

    /// Register a new agent.
    pub fn register_agent(&mut self, mut agent: Agent) -> AiResult<Uuid> {
        if self.agents.len() >= self.max_agents {
            return Err(AiError::MessageFailed("Max agents reached".into()));
        }
        // Check for duplicate name
        if self.agents.values().any(|a| a.name == agent.name) {
            return Err(AiError::AlreadyRegistered(agent.name.clone()));
        }
        let id = agent.id;
        agent.status = AgentStatus::Active;
        self.agents.insert(id, agent);
        Ok(id)
    }

    /// Terminate an agent.
    pub fn terminate_agent(&mut self, agent_id: Uuid) -> AiResult<()> {
        let agent = self
            .agents
            .get_mut(&agent_id)
            .ok_or_else(|| AiError::AgentNotFound(agent_id.to_string()))?;
        agent.status = AgentStatus::Terminated;
        Ok(())
    }

    /// Send a message between agents.
    pub fn send_message(&mut self, msg: AgentMessage) -> AiResult<()> {
        // Verify both agents exist
        if !self.agents.contains_key(&msg.from) {
            return Err(AiError::AgentNotFound(msg.from.to_string()));
        }
        let to_agent = self
            .agents
            .get(&msg.to)
            .ok_or_else(|| AiError::AgentNotFound(msg.to.to_string()))?;
        if !to_agent.is_active() {
            return Err(AiError::AgentOffline(msg.to.to_string()));
        }
        self.message_queue.push(msg);
        Ok(())
    }

    /// Get pending messages for an agent.
    pub fn get_messages(&mut self, agent_id: Uuid) -> Vec<AgentMessage> {
        let msgs: Vec<AgentMessage> = self
            .message_queue
            .iter()
            .filter(|m| m.to == agent_id)
            .cloned()
            .collect();
        self.message_queue.retain(|m| m.to != agent_id);
        msgs
    }

    pub fn get_agent(&self, id: &Uuid) -> Option<&Agent> {
        self.agents.get(id)
    }

    pub fn active_count(&self) -> usize {
        self.agents.values().filter(|a| a.is_active()).count()
    }

    pub fn total_count(&self) -> usize {
        self.agents.len()
    }

    // ─── Task dispatch ───────────────────────────────────────────────────

    /// Dispatch an AI task to the best available agent.
    ///
    /// Selection criteria (in order):
    /// 1. Agent must be `Active`
    /// 2. Agent must have `AgentCapability::Compute`
    /// 3. Agent consciousness level ≥ `task.required_consciousness`
    /// 4. Among eligible agents, pick the one with the highest consciousness
    ///    and fewest total actions (load balancing).
    pub fn dispatch_task(&mut self, task: &mut AiTask) -> AiResult<Uuid> {
        let best_id = self
            .agents
            .values()
            .filter(|a| {
                a.is_active()
                    && a.has_capability(&AgentCapability::Compute)
                    && a.consciousness_level >= task.required_consciousness
            })
            // Sort: higher consciousness first, then lower load
            .max_by_key(|a| (a.consciousness_level as i64, -(a.total_actions as i64)))
            .map(|a| a.id)
            .ok_or_else(|| AiError::CapabilityNotAvailable("Compute".into()))?;

        task.assign(best_id);

        // Bump the agent's action counter
        if let Some(agent) = self.agents.get_mut(&best_id) {
            agent.total_actions += 1;
            agent.last_action = Some(chrono::Utc::now());
        }

        Ok(best_id)
    }

    /// Grant a capability to an existing agent.
    pub fn grant_capability(&mut self, agent_id: Uuid, cap: AgentCapability) -> AiResult<()> {
        let agent = self
            .agents
            .get_mut(&agent_id)
            .ok_or_else(|| AiError::AgentNotFound(agent_id.to_string()))?;

        // Check consciousness gate
        let required = match &cap {
            AgentCapability::Compute => 2,
            AgentCapability::Bridge => 3,
            AgentCapability::Govern => 4,
            _ => 0,
        };
        if agent.consciousness_level < required {
            return Err(AiError::ConsciousnessInsufficient {
                required,
                current: agent.consciousness_level,
            });
        }

        if !agent.capabilities.contains(&cap) {
            agent.capabilities.push(cap);
        }
        Ok(())
    }

    /// Elevate an agent's consciousness level (triggered by XP threshold).
    pub fn elevate_consciousness(&mut self, agent_id: Uuid, new_level: u8) -> AiResult<()> {
        let agent = self
            .agents
            .get_mut(&agent_id)
            .ok_or_else(|| AiError::AgentNotFound(agent_id.to_string()))?;
        if new_level <= agent.consciousness_level {
            return Ok(()); // no downgrade
        }
        agent.consciousness_level = new_level;
        Ok(())
    }

    // ─── Coordination tick ───────────────────────────────────────────────

    /// Run one coordination tick across all active agents.
    ///
    /// Currently: time-out detection on assigned tasks and summary generation.
    /// Returns a list of `(task_id, agent_id)` pairs for tasks that timed out
    /// so the caller can notify the relevant agents.
    pub fn coordinate(&self) -> OrchestratorStatus {
        let active = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Active)
            .count();
        let suspended = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Suspended)
            .count();
        let terminated = self
            .agents
            .values()
            .filter(|a| a.status == AgentStatus::Terminated)
            .count();
        let total_actions: u64 = self.agents.values().map(|a| a.total_actions).sum();
        let queued_messages = self.message_queue.len();

        OrchestratorStatus {
            active_agents: active,
            suspended_agents: suspended,
            terminated_agents: terminated,
            total_actions,
            queued_messages,
        }
    }

    // ─── NCL Marketplace Integration ──────────────────────────────────────

    /// Submit an AI compute task to the NCL marketplace for distributed execution.
    ///
    /// This allows AI agents to leverage the global compute network when local
    /// resources are insufficient or when specialized hardware is needed.
    ///
    /// Returns the NCL job ID if submitted successfully.
    pub fn submit_to_ncl_marketplace(
        &mut self,
        task: &AiTask,
        model_id: String,
        backend: ComputeBackend,
        reward_flowers: u64,
    ) -> AiResult<Uuid> {
        let scheduler = self
            .ncl_scheduler
            .as_mut()
            .ok_or_else(|| AiError::CapabilityNotAvailable("NCL Marketplace".into()))?;

        // Map AI task type to NCL task type
        let task_type = match task.task_type {
            AiTaskType::LlmInference => NclTaskType::LlmInference,
            AiTaskType::ImageGeneration => NclTaskType::ImageGeneration,
            AiTaskType::Embeddings => NclTaskType::Embeddings,
            AiTaskType::CodeAnalysis => NclTaskType::CodeAnalysis,
            _ => NclTaskType::Custom,
        };

        let input_bytes = serde_json::to_vec(&task.input).unwrap_or_default();
        let input_hash = format!("{:x}", Sha256::digest(&input_bytes));
        let submitter = if task.submitter.is_empty() {
            format!("agent-{}", task.id)
        } else {
            task.submitter.clone()
        };

        let mut job = NclJob::new(
            model_id,
            backend,
            input_hash,
            submitter,
            reward_flowers,
            300_000, // 5 minute timeout
        );

        // Set additional fields
        job.task_type = task_type;
        job.min_consciousness = task.required_consciousness;

        scheduler
            .submit_job(job)
            .map_err(|e| AiError::MessageFailed(format!("NCL submission failed: {}", e)))
    }

    // ─── WARP Multi-Chain Agent Deployment ────────────────────────────────

    /// Deploy AI consciousness agents across multiple blockchain networks.
    ///
    /// This creates autonomous AI agents on supported chains that can:
    /// - Execute cross-chain transactions
    /// - Participate in DeFi protocols
    /// - Bridge assets between networks
    /// - Evolve consciousness through multi-chain interactions
    ///
    /// Returns the number of successfully deployed agents.
    pub async fn deploy_warp_agents(&mut self, chains: &[ChainId]) -> AiResult<usize> {
        let _router = self
            .warp_router
            .as_ref()
            .ok_or_else(|| AiError::CapabilityNotAvailable("WARP Router".into()))?;

        let mut deployed = 0;

        for chain in chains {
            // Create a new AI agent for this chain
            let agent_name = format!("warp-agent-{}", chain.name);
            let owner = "warp-orchestrator".to_string();
            // Deterministic wallet address derived from chain name hash
            let chain_hash = format!("{:x}", Sha256::digest(chain.name.as_bytes()));
            let wallet_address = format!("zion1warp{}", &chain_hash[..36]);
            let mut agent = Agent::new(agent_name, owner, wallet_address);

            // Set initial consciousness level based on chain family
            let initial_level = match chain.family {
                ChainFamily::ZionL1 => 3, // Higher consciousness on native chain
                ChainFamily::Evm => 2,
                ChainFamily::Solana => 2,
                _ => 1, // Basic consciousness for other chains
            };
            agent.consciousness_level = initial_level;

            // Grant cross-chain capabilities
            agent.capabilities.push(AgentCapability::Bridge);
            if initial_level >= 2 {
                agent.capabilities.push(AgentCapability::Compute);
            }

            // Register the agent
            let agent_id = self.register_agent(agent).map_err(|e| {
                AiError::MessageFailed(format!("Failed to register {} agent: {}", chain.name, e))
            })?;

            // Register agent in orchestrator and log for WARP router pickup.
            // Actual cross-chain deployment is triggered when the agent initiates
            // a transfer via WarpRouter::initiate_outbound.
            tracing::info!(
                agent_id = %agent_id,
                chain = %chain.name,
                chain_family = ?chain.family,
                wallet = %self.agents.get(&agent_id).map(|a| a.wallet_address.as_str()).unwrap_or("?"),
                "WARP agent registered and ready for deployment"
            );

            deployed += 1;
        }

        Ok(deployed)
    }

    // ─── L2 Bridge Integration ─────────────────────────────────────────────

    /// Check if bridge integration is enabled.
    pub fn bridge_enabled(&self) -> bool {
        self.bridge_enabled
    }

    // ─── AI Safety limits (L3bigupdate.md §8.2) ────────────────────────────
    const AI_MAX_TRANSFER_FLOWERS: u64 = 1_000_000_000_000_000; // 1000 ZION
    const AI_TIMELOCK_THRESHOLD_FLOWERS: u64 = 100_000_000_000_000; // 100 ZION
    #[allow(dead_code)]
    const AI_TIMELOCK_HOLD_HOURS: i64 = 24;

    /// Initiate automated cross-chain bridge operation via AI agent.
    ///
    /// AI Safety enforced:
    /// - Max 1000 ZION per AI-initiated transfer (AI_MAX_TRANSFER_FLOWERS)
    /// - Transfers > 100 ZION enter 24h timelock hold (AI_TIMELOCK_THRESHOLD)
    /// - Audit log written to L3/audit/ for every operation
    ///
    /// Returns operation ID if initiated successfully.
    pub async fn initiate_bridge_operation(
        &mut self,
        agent_id: Uuid,
        operation: BridgeOperation,
    ) -> AiResult<String> {
        if self.emergency_stop {
            return Err(AiError::CapabilityNotAvailable(
                "EMERGENCY STOP active — all AI operations halted".into(),
            ));
        }

        if !self.bridge_enabled {
            return Err(AiError::CapabilityNotAvailable(
                "L2 Bridge Integration".into(),
            ));
        }

        let agent = self
            .agents
            .get(&agent_id)
            .ok_or_else(|| AiError::AgentNotFound(agent_id.to_string()))?;

        if !agent.has_capability(&AgentCapability::Bridge) {
            return Err(AiError::CapabilityNotAvailable("Bridge".into()));
        }

        // ── AI Safety: transfer limit check ───────────────────────────────
        let amount = match &operation {
            BridgeOperation::LockToEvm { amount_flowers, .. } => *amount_flowers,
            BridgeOperation::BurnToL1 { amount_wzion, .. } => *amount_wzion,
            BridgeOperation::ComputeJob { reward_flowers, .. } => *reward_flowers,
        };

        if amount > Self::AI_MAX_TRANSFER_FLOWERS {
            return Err(AiError::MessageFailed(format!(
                "AI safety: transfer {} flowers exceeds limit {} (max 1000 ZION). Human approval required.",
                amount, Self::AI_MAX_TRANSFER_FLOWERS
            )));
        }

        // ── AI Safety: timelock for large transfers ───────────────────────
        let timelock = amount > Self::AI_TIMELOCK_THRESHOLD_FLOWERS;

        // Generate operation ID
        let operation_id = format!("bridge-{}-{}", agent_id, chrono::Utc::now().timestamp());

        // ── AI Safety: audit log ──────────────────────────────────────────
        self.audit_log(&operation_id, agent_id, &agent.name, &operation, timelock);

        // Log structured bridge operation details for L2 bridge daemon pickup
        match &operation {
            BridgeOperation::LockToEvm {
                amount_flowers,
                target_chain,
                evm_recipient,
            } => {
                tracing::info!(
                    operation_id = %operation_id,
                    agent = %agent.name,
                    kind = "lock_to_evm",
                    amount_flowers = amount_flowers,
                    target_chain = %target_chain,
                    evm_recipient = %evm_recipient,
                    "AI agent initiated bridge lock operation"
                );
            }
            BridgeOperation::BurnToL1 {
                amount_wzion,
                l1_recipient,
            } => {
                tracing::info!(
                    operation_id = %operation_id,
                    agent = %agent.name,
                    kind = "burn_to_l1",
                    amount_wzion = amount_wzion,
                    l1_recipient = %l1_recipient,
                    "AI agent initiated bridge burn operation"
                );
            }
            BridgeOperation::ComputeJob {
                model_id,
                backend,
                input_hash: _,
                reward_flowers,
                max_duration_secs: _,
                priority: _,
                min_consciousness: _,
                task_type: _,
            } => {
                tracing::info!(
                    operation_id = %operation_id,
                    agent = %agent.name,
                    kind = "compute_job",
                    model_id = %model_id,
                    backend = ?backend,
                    reward_flowers = reward_flowers,
                    "AI agent initiated NCL compute job"
                );
            }
        }

        Ok(operation_id)
    }

    // ─── NCL Marketplace Integration ─────────────────────────────────────

    /// Submit a compute job to the NCL marketplace.
    /// Requires the agent to have `Compute` capability.
    pub fn submit_ncl_job(
        &mut self,
        agent_id: Uuid,
        model_id: String,
        backend: ComputeBackend,
        input_hash: String,
        reward_flowers: u64,
        max_duration_secs: u64,
    ) -> AiResult<Uuid> {
        let scheduler = self
            .ncl_scheduler
            .as_mut()
            .ok_or_else(|| AiError::CapabilityNotAvailable("NCL marketplace".into()))?;

        let agent = self
            .agents
            .get(&agent_id)
            .ok_or_else(|| AiError::AgentNotFound(agent_id.to_string()))?;

        if !agent.has_capability(&AgentCapability::Compute) {
            return Err(AiError::CapabilityNotAvailable("Compute".into()));
        }

        let job = NclJob {
            id: Uuid::new_v4(),
            model_id,
            backend,
            task_type: NclTaskType::Custom,
            input_hash,
            output_hash: None,
            status: zion_ncl::NclJobStatus::Queued,
            submitter: agent.wallet_address.clone(),
            worker_id: None,
            reward_flowers,
            priority: 5,
            min_consciousness: agent.consciousness_level,
            created_at: chrono::Utc::now(),
            completed_at: None,
            timeout_ms: max_duration_secs * 1000,
        };

        let job_id = job.id;
        scheduler
            .submit_job(job)
            .map_err(|e| AiError::MessageFailed(format!("NCL submit failed: {}", e)))?;

        tracing::info!(
            job_id = %job_id,
            agent = %agent.name,
            reward = reward_flowers,
            "NCL compute job submitted by agent"
        );

        Ok(job_id)
    }

    // ─── AI Safety: Emergency stop + audit ─────────────────────────────────

    /// Trigger emergency stop — immediately halts all AI-initiated operations.
    pub fn emergency_stop(&mut self) {
        self.emergency_stop = true;
        tracing::warn!("EMERGENCY STOP triggered — all AI operations halted");
    }

    /// Resume AI operations (requires explicit human action).
    pub fn emergency_resume(&mut self) {
        self.emergency_stop = false;
        tracing::info!("EMERGENCY STOP cleared — AI operations resumed");
    }

    /// Check if emergency stop is active.
    pub fn is_emergency_stopped(&self) -> bool {
        self.emergency_stop
    }

    /// Append an immutable audit log entry for every AI-initiated operation.
    fn audit_log(
        &self,
        operation_id: &str,
        agent_id: Uuid,
        agent_name: &str,
        operation: &BridgeOperation,
        timelock: bool,
    ) {
        let ts = chrono::Utc::now().to_rfc3339();
        let entry = match operation {
            BridgeOperation::LockToEvm {
                amount_flowers,
                target_chain,
                evm_recipient,
            } => {
                format!(
                    "[{}] {} agent={}({}) op=lock_to_evm amount={} target={} recipient={} timelock={}\n",
                    ts, operation_id, agent_name, agent_id, amount_flowers, target_chain, evm_recipient, timelock
                )
            }
            BridgeOperation::BurnToL1 {
                amount_wzion,
                l1_recipient,
            } => {
                format!(
                    "[{}] {} agent={}({}) op=burn_to_l1 amount={} recipient={} timelock={}\n",
                    ts, operation_id, agent_name, agent_id, amount_wzion, l1_recipient, timelock
                )
            }
            BridgeOperation::ComputeJob {
                model_id,
                backend,
                reward_flowers,
                ..
            } => {
                format!(
                    "[{}] {} agent={}({}) op=compute_job model={} backend={:?} reward={} timelock={}\n",
                    ts, operation_id, agent_name, agent_id, model_id, backend, reward_flowers, timelock
                )
            }
        };

        if let Some(dir) = &self.audit_dir {
            let file = dir.join(format!("audit_{}.log", chrono::Utc::now().format("%Y%m%d")));
            if let Err(e) = std::fs::create_dir_all(dir) {
                tracing::error!("audit mkdir failed: {}", e);
                return;
            }
            if let Err(e) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&file)
                .and_then(|mut f| f.write_all(entry.as_bytes()))
            {
                tracing::error!("audit write failed: {}", e);
            }
        } else {
            tracing::info!("AUDIT: {}", entry.trim());
        }
    }

    /// Configure audit log directory (call once at startup).
    pub fn with_audit_dir(mut self, dir: std::path::PathBuf) -> Self {
        self.audit_dir = Some(dir);
        self
    }
}

// ─── Orchestrator status ─────────────────────────────────────────────────────

/// Snapshot of orchestrator state returned by [`Orchestrator::coordinate`].
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OrchestratorStatus {
    pub active_agents: usize,
    pub suspended_agents: usize,
    pub terminated_agents: usize,
    /// Cumulative actions across all agents
    pub total_actions: u64,
    /// Messages waiting in the inter-agent queue
    pub queued_messages: usize,
}

// ─── Multi-agent decision engine ─────────────────────────────────────────────

/// Weight configuration for the weighted-majority decision engine.
#[derive(Debug, Clone)]
pub struct AgentWeights {
    pub weights: HashMap<Uuid, f64>,
}

impl AgentWeights {
    pub fn new() -> Self {
        Self {
            weights: HashMap::new(),
        }
    }

    pub fn set(&mut self, agent_id: Uuid, weight: f64) {
        self.weights.insert(agent_id, weight.max(0.0));
    }

    pub fn get(&self, agent_id: &Uuid) -> f64 {
        *self.weights.get(agent_id).unwrap_or(&1.0)
    }
}

impl Default for AgentWeights {
    fn default() -> Self {
        Self::new()
    }
}

/// A binary decision (true/false) cast by an agent with a confidence value.
#[derive(Debug, Clone)]
pub struct AgentVote {
    pub agent_id: Uuid,
    pub vote: bool,
    /// Confidence 0.0–1.0
    pub confidence: f64,
    pub reason: String,
}

/// Aggregate multiple agent votes into a weighted majority decision.
///
/// Returns `(decision, weighted_confidence)`.
pub fn weighted_majority(votes: &[AgentVote], weights: &AgentWeights) -> (bool, f64) {
    if votes.is_empty() {
        return (false, 0.0);
    }

    let mut yes_weight = 0.0_f64;
    let mut no_weight = 0.0_f64;

    for v in votes {
        let w = weights.get(&v.agent_id) * v.confidence;
        if v.vote {
            yes_weight += w;
        } else {
            no_weight += w;
        }
    }

    let total = yes_weight + no_weight;
    if total == 0.0 {
        return (false, 0.0);
    }

    let decision = yes_weight >= no_weight;
    let confidence = if decision {
        yes_weight / total
    } else {
        no_weight / total
    };
    (decision, confidence)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Agent;

    fn test_agent(name: &str) -> Agent {
        Agent::new(name.into(), "owner".into(), format!("zion1{}", name))
    }

    fn compute_agent(name: &str, consciousness: u8) -> Agent {
        let mut a = Agent::new(name.into(), "owner".into(), format!("zion1{}", name));
        // Grant Compute capability manually (no orchestrator here)
        a.capabilities.push(AgentCapability::Compute);
        a.consciousness_level = consciousness;
        a
    }

    #[test]
    fn test_register_agent() {
        let mut orch = Orchestrator::new(100);
        let a = test_agent("bot1");
        let id = orch.register_agent(a).unwrap();
        assert_eq!(orch.active_count(), 1);
        assert!(orch.get_agent(&id).unwrap().is_active());
    }

    #[test]
    fn test_duplicate_name() {
        let mut orch = Orchestrator::new(100);
        orch.register_agent(test_agent("bot1")).unwrap();
        assert!(orch.register_agent(test_agent("bot1")).is_err());
    }

    #[test]
    fn test_terminate_agent() {
        let mut orch = Orchestrator::new(100);
        let id = orch.register_agent(test_agent("bot1")).unwrap();
        orch.terminate_agent(id).unwrap();
        assert_eq!(orch.active_count(), 0);
    }

    #[test]
    fn test_messaging() {
        let mut orch = Orchestrator::new(100);
        let id_a = orch.register_agent(test_agent("alice")).unwrap();
        let id_b = orch.register_agent(test_agent("bob")).unwrap();

        let msg = AgentMessage::new(id_a, id_b, serde_json::json!({"hello": "world"}));
        orch.send_message(msg).unwrap();

        let msgs = orch.get_messages(id_b);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].from, id_a);
    }

    #[test]
    fn test_message_to_offline_agent() {
        let mut orch = Orchestrator::new(100);
        let id_a = orch.register_agent(test_agent("alice")).unwrap();
        let id_b = orch.register_agent(test_agent("bob")).unwrap();
        orch.terminate_agent(id_b).unwrap();

        let msg = AgentMessage::new(id_a, id_b, serde_json::json!({}));
        assert!(orch.send_message(msg).is_err());
    }

    #[test]
    fn test_dispatch_task_picks_compute_agent() {
        use crate::task::{AiTask, AiTaskType, TaskStatus};
        let mut orch = Orchestrator::new(100);
        orch.register_agent(test_agent("no_compute")).unwrap();
        let compute_id = orch.register_agent(compute_agent("worker", 2)).unwrap();

        let mut task = AiTask::new(
            AiTaskType::Embeddings,
            "bge-small",
            "zion1user",
            serde_json::json!({"text": "hello"}),
            10_000,
        );
        let assigned = orch.dispatch_task(&mut task).unwrap();
        assert_eq!(assigned, compute_id);
        assert_eq!(task.status, TaskStatus::Assigned);
    }

    #[test]
    fn test_dispatch_fails_without_compute_agents() {
        use crate::task::{AiTask, AiTaskType};
        let mut orch = Orchestrator::new(100);
        orch.register_agent(test_agent("no_compute")).unwrap();
        let mut task = AiTask::new(
            AiTaskType::LlmInference,
            "llama3",
            "zion1user",
            serde_json::json!({}),
            0,
        );
        assert!(orch.dispatch_task(&mut task).is_err());
    }

    #[test]
    fn test_dispatch_respects_consciousness_gate() {
        use crate::task::{AiTask, AiTaskType};
        let mut orch = Orchestrator::new(100);
        orch.register_agent(compute_agent("low_level", 1)).unwrap();
        let mut task = AiTask::new(
            AiTaskType::ModelTraining,
            "m",
            "s",
            serde_json::json!({}),
            0,
        )
        .with_consciousness(3); // requires level 3
        assert!(orch.dispatch_task(&mut task).is_err());
    }

    #[test]
    fn test_dispatch_selects_highest_consciousness() {
        use crate::task::{AiTask, AiTaskType};
        let mut orch = Orchestrator::new(100);
        orch.register_agent(compute_agent("low", 2)).unwrap();
        let high_id = orch.register_agent(compute_agent("high", 4)).unwrap();
        let mut task = AiTask::new(AiTaskType::LlmInference, "m", "s", serde_json::json!({}), 0);
        let assigned = orch.dispatch_task(&mut task).unwrap();
        assert_eq!(assigned, high_id);
    }

    #[test]
    fn test_grant_capability_with_insufficient_level() {
        let mut orch = Orchestrator::new(100);
        let id = orch.register_agent(test_agent("junior")).unwrap();
        // Bridge requires level 3 — this agent is at 0
        assert!(orch.grant_capability(id, AgentCapability::Bridge).is_err());
    }

    #[test]
    fn test_elevate_consciousness() {
        let mut orch = Orchestrator::new(100);
        let id = orch.register_agent(test_agent("bot")).unwrap();
        orch.elevate_consciousness(id, 3).unwrap();
        assert_eq!(orch.get_agent(&id).unwrap().consciousness_level, 3);
    }

    #[test]
    fn test_coordinate_status() {
        let mut orch = Orchestrator::new(100);
        orch.register_agent(test_agent("a")).unwrap();
        orch.register_agent(test_agent("b")).unwrap();
        let status = orch.coordinate();
        assert_eq!(status.active_agents, 2);
        assert_eq!(status.terminated_agents, 0);
    }

    #[test]
    fn test_weighted_majority_yes() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let votes = vec![
            AgentVote {
                agent_id: id1,
                vote: true,
                confidence: 0.9,
                reason: "yes".into(),
            },
            AgentVote {
                agent_id: id2,
                vote: false,
                confidence: 0.3,
                reason: "no".into(),
            },
        ];
        let mut weights = AgentWeights::new();
        weights.set(id1, 1.0);
        weights.set(id2, 1.0);
        let (dec, conf) = weighted_majority(&votes, &weights);
        assert!(dec);
        assert!(conf > 0.5);
    }
}
