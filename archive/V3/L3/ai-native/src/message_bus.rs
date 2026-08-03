//! # Message Bus — L3-E
//!
//! Typed inter-agent communication via `tokio::sync::broadcast`.
//!
//! ## Design
//! ```text
//!   Agent A ──publish──► MessageBus ──fan-out──► [Subscriber A]
//!                                              └──► [Subscriber B]
//!                                              └──► [Subscriber C]
//! ```
//!
//! Every message is either:
//! - **Direct** — addressed to a specific agent UUID
//! - **Broadcast** — delivered to every subscriber
//! - **System** — infrastructure events (connect/disconnect/shutdown)
//!
//! # Example
//! ```
//! use zion_ai_native::message_bus::{MessageBus, BusMessage, SystemEvent};
//! use uuid::Uuid;
//!
//! let bus = MessageBus::new(64);
//! let mut sub = bus.subscribe();
//! bus.broadcast_system(SystemEvent::OrchestratorStarted);
//! // sub.recv() would yield the system event
//! ```

use crate::types::AgentMessage;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

// ─── Public types ─────────────────────────────────────────────────────────────

/// Infrastructure-level events emitted by the bus.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SystemEvent {
    /// An agent came online.
    AgentConnected(Uuid),
    /// An agent went offline or was terminated.
    AgentDisconnected(Uuid),
    /// Orchestrator finished initialisation.
    OrchestratorStarted,
    /// Graceful shutdown signal.
    Shutdown,
    /// Custom string event (e.g. "pool_switched", "warp_activated").
    Custom(String),
}

/// Top-level message routed through the bus.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BusMessage {
    /// Point-to-point: only the agent with `.to` should act on it.
    Direct { to: Uuid, msg: AgentMessage },
    /// Fan-out to every connected subscriber.
    Broadcast { msg: AgentMessage },
    /// System / infrastructure event.
    System(SystemEvent),
}

impl BusMessage {
    /// Returns the sender UUID when applicable.
    pub fn from_id(&self) -> Option<Uuid> {
        match self {
            BusMessage::Direct { msg, .. } => Some(msg.from),
            BusMessage::Broadcast { msg } => Some(msg.from),
            BusMessage::System(_) => None,
        }
    }

    /// Returns true if this message is addressed to `agent_id` or is a
    /// broadcast / system event.
    pub fn is_relevant_for(&self, agent_id: Uuid) -> bool {
        match self {
            BusMessage::Direct { to, .. } => *to == agent_id,
            BusMessage::Broadcast { .. } => true,
            BusMessage::System(_) => true,
        }
    }
}

// ─── MessageBus ───────────────────────────────────────────────────────────────

/// Shared message bus.  Clone freely — all clones share the same channel.
#[derive(Clone)]
pub struct MessageBus {
    tx: Arc<broadcast::Sender<BusMessage>>,
    capacity: usize,
}

impl MessageBus {
    /// Create a new bus with the given broadcast channel capacity.
    /// `capacity` is the maximum number of messages buffered before
    /// the slowest subscriber starts missing messages.
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self {
            tx: Arc::new(tx),
            capacity,
        }
    }

    /// Returns the channel capacity.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Returns the number of active subscribers.
    pub fn receiver_count(&self) -> usize {
        self.tx.receiver_count()
    }

    /// Subscribe to all messages on the bus.
    pub fn subscribe(&self) -> broadcast::Receiver<BusMessage> {
        self.tx.subscribe()
    }

    /// Subscribe and wrap in an [`AgentSubscriber`] that filters
    /// messages relevant only to `agent_id`.
    pub fn subscribe_for(&self, agent_id: Uuid) -> AgentSubscriber {
        AgentSubscriber {
            agent_id,
            rx: self.tx.subscribe(),
        }
    }

    // ── Publish helpers ──────────────────────────────────────────────────────

    /// Publish any `BusMessage` as-is.  Returns the number of active
    /// receivers the message was sent to (0 if no subscribers).
    pub fn publish(&self, message: BusMessage) -> usize {
        self.tx.send(message).unwrap_or(0)
    }

    /// Send a direct message from one agent to another.
    pub fn send_direct(&self, from: Uuid, to: Uuid, payload: serde_json::Value) -> usize {
        let msg = AgentMessage {
            id: Uuid::new_v4(),
            from,
            to,
            payload,
            timestamp: Utc::now(),
        };
        self.publish(BusMessage::Direct { to, msg })
    }

    /// Broadcast a message from `from` to all subscribers.
    pub fn broadcast(&self, from: Uuid, to: Uuid, payload: serde_json::Value) -> usize {
        let msg = AgentMessage {
            id: Uuid::new_v4(),
            from,
            to,
            payload,
            timestamp: Utc::now(),
        };
        self.publish(BusMessage::Broadcast { msg })
    }

    /// Emit a system event.
    pub fn broadcast_system(&self, event: SystemEvent) -> usize {
        self.publish(BusMessage::System(event))
    }
}

// ─── AgentSubscriber ─────────────────────────────────────────────────────────

/// A filtered subscriber: only yields messages relevant to `agent_id`
/// (direct messages to it + broadcasts + system events).
pub struct AgentSubscriber {
    pub agent_id: Uuid,
    rx: broadcast::Receiver<BusMessage>,
}

impl AgentSubscriber {
    /// Receive the next message relevant to this agent.
    /// Skips messages addressed to other agents.
    /// Returns `None` when the channel is closed.
    pub async fn next(&mut self) -> Option<BusMessage> {
        loop {
            match self.rx.recv().await {
                Ok(msg) => {
                    if msg.is_relevant_for(self.agent_id) {
                        return Some(msg);
                    }
                    // not for us — skip
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    // Log and continue (caller may want to handle this)
                    tracing::warn!(
                        agent = %self.agent_id,
                        skipped = n,
                        "MessageBus: subscriber lagged, {} messages dropped",
                        n
                    );
                }
                Err(broadcast::error::RecvError::Closed) => return None,
            }
        }
    }

    /// Try to receive without blocking. Returns `None` immediately if
    /// nothing is ready.
    pub fn try_next(&mut self) -> Option<BusMessage> {
        loop {
            match self.rx.try_recv() {
                Ok(msg) => {
                    if msg.is_relevant_for(self.agent_id) {
                        return Some(msg);
                    }
                }
                Err(_) => return None,
            }
        }
    }
}

// ─── BusStats ────────────────────────────────────────────────────────────────

/// Runtime statistics snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusStats {
    pub receiver_count: usize,
    pub capacity: usize,
    pub snapshot_at: DateTime<Utc>,
}

impl MessageBus {
    pub fn stats(&self) -> BusStats {
        BusStats {
            receiver_count: self.receiver_count(),
            capacity: self.capacity,
            snapshot_at: Utc::now(),
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn agent_id() -> Uuid {
        Uuid::new_v4()
    }

    #[tokio::test]
    async fn test_direct_message_received_by_target() {
        let bus = MessageBus::new(32);
        let a = agent_id();
        let b = agent_id();
        let mut sub_b = bus.subscribe_for(b);

        bus.send_direct(a, b, json!({"hello": "world"}));

        let msg = sub_b.next().await.expect("should receive message");
        match msg {
            BusMessage::Direct { to, msg: m } => {
                assert_eq!(to, b);
                assert_eq!(m.from, a);
            }
            _ => panic!("expected Direct"),
        }
    }

    #[tokio::test]
    async fn test_direct_message_filtered_for_wrong_agent() {
        let bus = MessageBus::new(32);
        let a = agent_id();
        let b = agent_id();
        let c = agent_id();
        let mut sub_c = bus.subscribe_for(c);

        bus.send_direct(a, b, json!({"hello": "world"}));

        // Nothing for C
        let result = sub_c.try_next();
        assert!(result.is_none(), "C should not see D→B message");
    }

    #[tokio::test]
    async fn test_broadcast_received_by_all() {
        let bus = MessageBus::new(32);
        let a = agent_id();
        let b = agent_id();
        let c = agent_id();
        let mut sub_b = bus.subscribe_for(b);
        let mut sub_c = bus.subscribe_for(c);

        bus.broadcast(a, Uuid::nil(), json!({"event": "tick"}));

        let mb = sub_b.try_next();
        let mc = sub_c.try_next();
        assert!(mb.is_some(), "B should receive broadcast");
        assert!(mc.is_some(), "C should receive broadcast");
    }

    #[tokio::test]
    async fn test_system_event_received_by_all() {
        let bus = MessageBus::new(32);
        let a = agent_id();
        let mut sub_a = bus.subscribe_for(a);

        bus.broadcast_system(SystemEvent::OrchestratorStarted);

        let msg = sub_a.try_next().expect("should receive system event");
        assert!(matches!(
            msg,
            BusMessage::System(SystemEvent::OrchestratorStarted)
        ));
    }

    #[tokio::test]
    async fn test_receiver_count() {
        let bus = MessageBus::new(32);
        assert_eq!(bus.receiver_count(), 0);

        let _sub1 = bus.subscribe();
        let _sub2 = bus.subscribe();
        assert_eq!(bus.receiver_count(), 2);
    }

    #[tokio::test]
    async fn test_bus_clone_shares_channel() {
        let bus = MessageBus::new(32);
        let bus2 = bus.clone();
        let a = agent_id();
        let b = agent_id();
        let mut sub = bus.subscribe_for(b);

        // Send via clone
        bus2.send_direct(a, b, json!({"via": "clone"}));

        let msg = sub.next().await.expect("message via clone");
        assert!(matches!(msg, BusMessage::Direct { .. }));
    }

    #[test]
    fn test_is_relevant_for() {
        let target = agent_id();
        let other = agent_id();
        let irrelevant_msg = BusMessage::Direct {
            to: other,
            msg: AgentMessage {
                id: Uuid::new_v4(),
                from: agent_id(),
                to: other,
                payload: json!({}),
                timestamp: Utc::now(),
            },
        };
        assert!(!irrelevant_msg.is_relevant_for(target));
        assert!(irrelevant_msg.is_relevant_for(other));

        let system = BusMessage::System(SystemEvent::Shutdown);
        assert!(system.is_relevant_for(target));
        assert!(system.is_relevant_for(other));
    }

    #[test]
    fn test_stats() {
        let bus = MessageBus::new(16);
        let stats = bus.stats();
        assert_eq!(stats.capacity, 16);
        assert_eq!(stats.receiver_count, 0);
    }
}
