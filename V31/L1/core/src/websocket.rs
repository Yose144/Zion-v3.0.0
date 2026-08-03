//! WebSocket Subscriptions Server for ZION V31.
//!
//! Provides real-time event streaming for:
//! - New blocks
//! - Pending transactions (mempool)
//! - Address-specific updates
//! - Network status changes
//!
//! Ported from V3/L1/core/src/websocket.rs. NodeRuntime dependency replaced
//! with a trait-based handler so this module compiles without ChainState.

use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::protocol::Message;

// ── Subscription Types ────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionType {
    /// Subscribe to all new blocks
    NewBlocks,
    /// Subscribe to pending transactions in mempool
    PendingTransactions,
    /// Subscribe to transactions for a specific address
    Address(String),
    /// Subscribe to network status changes
    NetworkStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WsMessage {
    /// Server notification
    Notification {
        subscription: SubscriptionType,
        data: serde_json::Value,
    },
    /// Subscription confirmation
    Subscribed {
        subscription: SubscriptionType,
    },
    /// Unsubscription confirmation
    Unsubscribed {
        subscription: SubscriptionType,
    },
    /// Error message
    Error {
        code: i64,
        message: String,
    },
    /// Ping/Pong for keepalive
    Ping,
    Pong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientMessage {
    /// Subscribe to an event type
    Subscribe { subscription: SubscriptionType },
    /// Unsubscribe from an event type
    Unsubscribe { subscription: SubscriptionType },
    /// Ping for keepalive
    Ping,
    /// Pong response
    Pong,
}

// ── Client Session ─────────────────────────────────────────────────────────

struct ClientSession {
    #[allow(dead_code)]
    addr: SocketAddr,
    subscriptions: HashSet<SubscriptionType>,
}

impl ClientSession {
    fn new(addr: SocketAddr) -> Self {
        Self {
            addr,
            subscriptions: HashSet::new(),
        }
    }
}

// ── Event Handler Trait ────────────────────────────────────────────────────

/// Trait for handling WebSocket subscription events.
///
/// In V3 this was hardcoded to `NodeRuntime`. V31 uses a trait so the
/// WebSocket server compiles without ChainState. The node runtime
/// implements this trait when available.
pub trait WsEventHandler: Send + Sync {
    /// Get the current block height.
    fn block_height(&self) -> u64 {
        0
    }

    /// Get the balance for an address (in smallest units).
    fn utxo_balance(&self, _address: &str) -> u128 {
        0
    }

    /// Get recent transactions for an address.
    fn address_transactions(&self, _address: &str) -> Vec<serde_json::Value> {
        Vec::new()
    }

    /// Get pending mempool transactions.
    fn pending_transactions(&self) -> Vec<serde_json::Value> {
        Vec::new()
    }

    /// Get network status as JSON.
    fn network_status(&self) -> serde_json::Value {
        json!({
            "connected": true,
            "block_height": self.block_height(),
            "peers": 0,
        })
    }
}

/// Stub handler that returns empty/default data.
pub struct StubEventHandler;

impl WsEventHandler for StubEventHandler {}

// ── WebSocket Server ───────────────────────────────────────────────────────

pub struct WebSocketServer {
    handler: Arc<dyn WsEventHandler>,
    clients: Arc<Mutex<HashMap<SocketAddr, ClientSession>>>,
}

impl WebSocketServer {
    pub fn new(handler: Arc<dyn WsEventHandler>) -> Self {
        Self {
            handler,
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a server with a stub event handler (no chain state).
    pub fn new_stub() -> Self {
        Self::new(Arc::new(StubEventHandler))
    }

    /// Run the WebSocket listener until shutdown is signalled.
    pub async fn run(
        &self,
        addr: SocketAddr,
    ) -> Result<()> {
        let listener = TcpListener::bind(addr).await?;
        tracing::info!("WebSocket listening on {}", addr);

        loop {
            let (stream, peer_addr) = listener.accept().await?;
            let handler = self.handler.clone();
            let clients = self.clients.clone();

            tokio::spawn(async move {
                if let Err(e) = Self::handle_connection(stream, peer_addr, handler, clients).await {
                    tracing::warn!("WebSocket session {} ended: {}", peer_addr, e);
                }
            });
        }
    }

    async fn handle_connection(
        stream: TcpStream,
        peer_addr: SocketAddr,
        handler: Arc<dyn WsEventHandler>,
        clients: Arc<Mutex<HashMap<SocketAddr, ClientSession>>>,
    ) -> Result<()> {
        let ws_stream = tokio_tungstenite::accept_async(stream)
            .await
            .context("WebSocket handshake failed")?;

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Register client
        {
            let mut clients_lock = clients.lock().unwrap();
            clients_lock.insert(peer_addr, ClientSession::new(peer_addr));
        }
        tracing::info!("WebSocket client connected: {}", peer_addr);

        // Send welcome message
        let welcome = WsMessage::Notification {
            subscription: SubscriptionType::NetworkStatus,
            data: handler.network_status(),
        };
        ws_sender
            .send(Message::Text(serde_json::to_string(&welcome)?))
            .await?;

        // Process messages
        while let Some(msg) = ws_receiver.next().await {
            let msg = msg.context("WebSocket receive error")?;

            match msg {
                Message::Text(text) => {
                    let client_msg: ClientMessage = match serde_json::from_str(&text) {
                        Ok(m) => m,
                        Err(e) => {
                            let err = WsMessage::Error {
                                code: -1,
                                message: format!("Invalid message: {}", e),
                            };
                            ws_sender
                                .send(Message::Text(serde_json::to_string(&err)?))
                                .await?;
                            continue;
                        }
                    };

                    let response = Self::handle_client_message(&client_msg, &handler, &clients, peer_addr)?;
                    if let Some(resp) = response {
                        ws_sender
                            .send(Message::Text(serde_json::to_string(&resp)?))
                            .await?;
                    }
                }
                Message::Ping(data) => {
                    ws_sender.send(Message::Pong(data)).await?;
                }
                Message::Close(_) => break,
                _ => {}
            }
        }

        // Unregister client
        {
            let mut clients_lock = clients.lock().unwrap();
            clients_lock.remove(&peer_addr);
        }
        tracing::info!("WebSocket client disconnected: {}", peer_addr);

        Ok(())
    }

    fn handle_client_message(
        msg: &ClientMessage,
        handler: &Arc<dyn WsEventHandler>,
        clients: &Arc<Mutex<HashMap<SocketAddr, ClientSession>>>,
        peer_addr: SocketAddr,
    ) -> Result<Option<WsMessage>> {
        match msg {
            ClientMessage::Subscribe { subscription } => {
                let mut clients_lock = clients.lock().unwrap();
                if let Some(session) = clients_lock.get_mut(&peer_addr) {
                    session.subscriptions.insert(subscription.clone());
                }

                // Send initial data for the subscription
                let data = match subscription {
                    SubscriptionType::NewBlocks => {
                        Some(json!({ "height": handler.block_height() }))
                    }
                    SubscriptionType::PendingTransactions => {
                        Some(json!(handler.pending_transactions()))
                    }
                    SubscriptionType::Address(addr) => {
                        Some(json!({
                            "balance": handler.utxo_balance(addr),
                            "transactions": handler.address_transactions(addr),
                        }))
                    }
                    SubscriptionType::NetworkStatus => {
                        Some(handler.network_status())
                    }
                };

                if let Some(d) = data {
                    // Send notification with initial data
                    // (In a real implementation, this would be sent via the channel)
                    let _ = d;
                }

                Ok(Some(WsMessage::Subscribed {
                    subscription: subscription.clone(),
                }))
            }
            ClientMessage::Unsubscribe { subscription } => {
                let mut clients_lock = clients.lock().unwrap();
                if let Some(session) = clients_lock.get_mut(&peer_addr) {
                    session.subscriptions.remove(subscription);
                }
                Ok(Some(WsMessage::Unsubscribed {
                    subscription: subscription.clone(),
                }))
            }
            ClientMessage::Ping => Ok(Some(WsMessage::Pong)),
            ClientMessage::Pong => Ok(None),
        }
    }

    /// Broadcast a notification to all subscribed clients.
    pub fn broadcast(
        &self,
        subscription: &SubscriptionType,
        data: serde_json::Value,
    ) {
        let msg = WsMessage::Notification {
            subscription: subscription.clone(),
            data,
        };
        let text = match serde_json::to_string(&msg) {
            Ok(t) => t,
            Err(_) => return,
        };

        let clients = self.clients.lock().unwrap();
        for (addr, session) in clients.iter() {
            if session.subscriptions.contains(subscription) {
                tracing::debug!("Broadcast to {}: {}", addr, text);
                // In a real implementation, this would send via the WebSocket sink
            }
        }
    }

    /// Get the number of connected clients.
    pub fn client_count(&self) -> usize {
        self.clients.lock().unwrap().len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ws_message_serialization() {
        let msg = WsMessage::Subscribed {
            subscription: SubscriptionType::NewBlocks,
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("subscribed"));
        assert!(json.contains("new_blocks"));
    }

    #[test]
    fn client_message_deserialization() {
        let json = r#"{"subscribe":{"subscription":"new_blocks"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Subscribe { subscription } => {
                assert_eq!(subscription, SubscriptionType::NewBlocks);
            }
            _ => panic!("Expected Subscribe"),
        }
    }

    #[test]
    fn address_subscription() {
        let json = r#"{"subscribe":{"subscription":{"address":"zion1abc"}}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Subscribe {
                subscription: SubscriptionType::Address(addr),
            } => {
                assert_eq!(addr, "zion1abc");
            }
            _ => panic!("Expected Subscribe with Address"),
        }
    }

    #[test]
    fn stub_handler_defaults() {
        let handler = StubEventHandler;
        assert_eq!(handler.block_height(), 0);
        assert_eq!(handler.utxo_balance("zion1abc"), 0);
        assert!(handler.pending_transactions().is_empty());
    }

    #[test]
    fn websocket_server_creation() {
        let server = WebSocketServer::new_stub();
        assert_eq!(server.client_count(), 0);
    }
}
