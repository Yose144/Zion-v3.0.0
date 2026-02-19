use std::collections::HashMap;
use uuid::Uuid;

use crate::error::{AiError, AiResult};
use crate::types::{Agent, AgentMessage, AgentStatus};

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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Agent;

    fn test_agent(name: &str) -> Agent {
        Agent::new(name.into(), "owner".into(), format!("zion1{}", name))
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
}
