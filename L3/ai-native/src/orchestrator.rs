use std::collections::HashMap;
use uuid::Uuid;

use crate::error::{AiError, AiResult};
use crate::task::AiTask;
use crate::types::{Agent, AgentCapability, AgentMessage, AgentStatus};

/// Central orchestrator managing all AI agents.
pub struct Orchestrator {
    agents: HashMap<Uuid, Agent>,
    message_queue: Vec<AgentMessage>,
    max_agents: usize,
}

impl Orchestrator {
    pub fn new(max_agents: usize) -> Self {
        Self {
            agents: HashMap::new(),
            message_queue: Vec::new(),
            max_agents,
        }
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
            .max_by_key(|a| {
                (a.consciousness_level as i64, -(a.total_actions as i64))
            })
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
    pub fn grant_capability(
        &mut self,
        agent_id: Uuid,
        cap: AgentCapability,
    ) -> AiResult<()> {
        let agent = self
            .agents
            .get_mut(&agent_id)
            .ok_or_else(|| AiError::AgentNotFound(agent_id.to_string()))?;

        // Check consciousness gate
        let required = match &cap {
            AgentCapability::Compute  => 2,
            AgentCapability::Bridge   => 3,
            AgentCapability::Govern   => 4,
            _                         => 0,
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
        let active   = self.agents.values().filter(|a| a.status == AgentStatus::Active).count();
        let suspended = self.agents.values().filter(|a| a.status == AgentStatus::Suspended).count();
        let terminated = self.agents.values().filter(|a| a.status == AgentStatus::Terminated).count();
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
        Self { weights: HashMap::new() }
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
pub fn weighted_majority(
    votes: &[AgentVote],
    weights: &AgentWeights,
) -> (bool, f64) {
    if votes.is_empty() {
        return (false, 0.0);
    }

    let mut yes_weight = 0.0_f64;
    let mut no_weight  = 0.0_f64;

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
    let confidence = if decision { yes_weight / total } else { no_weight / total };
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
            AiTaskType::LlmInference, "llama3", "zion1user",
            serde_json::json!({}), 0,
        );
        assert!(orch.dispatch_task(&mut task).is_err());
    }

    #[test]
    fn test_dispatch_respects_consciousness_gate() {
        use crate::task::{AiTask, AiTaskType};
        let mut orch = Orchestrator::new(100);
        orch.register_agent(compute_agent("low_level", 1)).unwrap();
        let mut task = AiTask::new(
            AiTaskType::ModelTraining, "m", "s", serde_json::json!({}), 0,
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
        let mut task = AiTask::new(
            AiTaskType::LlmInference, "m", "s", serde_json::json!({}), 0,
        );
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
            AgentVote { agent_id: id1, vote: true,  confidence: 0.9, reason: "yes".into() },
            AgentVote { agent_id: id2, vote: false, confidence: 0.3, reason: "no".into()  },
        ];
        let mut weights = AgentWeights::new();
        weights.set(id1, 1.0);
        weights.set(id2, 1.0);
        let (dec, conf) = weighted_majority(&votes, &weights);
        assert!(dec);
        assert!(conf > 0.5);
    }
}
