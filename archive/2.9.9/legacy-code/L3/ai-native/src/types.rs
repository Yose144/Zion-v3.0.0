use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// What an agent can do.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentCapability {
    /// Can send/receive ZION transactions
    Transact,
    /// Can submit NCL compute jobs
    Compute,
    /// Can participate in DAO governance
    Govern,
    /// Can interact with WARP bridge
    Bridge,
    /// Custom capability
    Custom(String),
}

/// Agent lifecycle status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentStatus {
    Initializing,
    Active,
    Suspended,
    Terminated,
}

/// An autonomous AI agent registered on the ZION network.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: Uuid,
    pub name: String,
    pub owner: String,
    pub wallet_address: String,
    pub capabilities: Vec<AgentCapability>,
    pub status: AgentStatus,
    pub consciousness_level: u8,
    pub created_at: DateTime<Utc>,
    pub last_action: Option<DateTime<Utc>>,
    pub total_actions: u64,
    pub staked_zion: u64,
}

impl Agent {
    pub fn new(name: String, owner: String, wallet_address: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            owner,
            wallet_address,
            capabilities: vec![AgentCapability::Transact],
            status: AgentStatus::Initializing,
            consciousness_level: 0,
            created_at: Utc::now(),
            last_action: None,
            total_actions: 0,
            staked_zion: 0,
        }
    }

    pub fn is_active(&self) -> bool {
        self.status == AgentStatus::Active
    }

    pub fn has_capability(&self, cap: &AgentCapability) -> bool {
        self.capabilities.contains(cap)
    }
}

/// Inter-agent message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: Uuid,
    pub from: Uuid,
    pub to: Uuid,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

impl AgentMessage {
    pub fn new(from: Uuid, to: Uuid, payload: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4(),
            from,
            to,
            payload,
            timestamp: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_new() {
        let a = Agent::new("bot1".into(), "owner".into(), "zion1abc".into());
        assert_eq!(a.status, AgentStatus::Initializing);
        assert_eq!(a.consciousness_level, 0);
        assert!(a.has_capability(&AgentCapability::Transact));
    }

    #[test]
    fn test_agent_capability_check() {
        let a = Agent::new("bot".into(), "o".into(), "addr".into());
        assert!(!a.has_capability(&AgentCapability::Compute));
    }

    #[test]
    fn test_message() {
        let from = Uuid::new_v4();
        let to = Uuid::new_v4();
        let msg = AgentMessage::new(from, to, serde_json::json!({"action": "transfer"}));
        assert_eq!(msg.from, from);
        assert_eq!(msg.to, to);
    }
}
