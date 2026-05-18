//! OASIS WebSocket server — real-time leaderboard & event broadcasting.
//!
//! ## Endpoints
//!
//! ```text
//! WS /api/v1/oasis/ws/leaderboard
//! WS /api/v1/oasis/ws/events
//! ```
//!
//! Messages are JSON:
//!   { "type": "leaderboard", "data": [...] }
//!   { "type": "xp_award", "address": "...", "amount": 500 }
//!   { "type": "quest_complete", "address": "...", "quest_id": "..." }

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    response::IntoResponse,
};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::info;

use crate::server::OasisState;

/// Channel capacity for broadcast events.
const BROADCAST_CAP: usize = 256;

/// Real-time event types pushed to connected clients.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum WsEvent {
    Leaderboard(Vec<LeaderboardEntry>),
    XpAward {
        address: String,
        amount: u64,
        total_xp: u64,
    },
    QuestComplete {
        address: String,
        quest_id: String,
    },
    GuildCreate {
        guild_id: String,
        name: String,
    },
    System {
        msg: String,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct LeaderboardEntry {
    pub rank: usize,
    pub address: String,
    pub total_xp: u64,
    pub level: String,
}

/// Broadcast hub shared across all WebSocket handlers.
#[derive(Debug, Clone)]
pub struct WsHub {
    pub tx: broadcast::Sender<WsEvent>,
}

impl WsHub {
    pub fn new() -> Arc<Self> {
        let (tx, _rx) = broadcast::channel(BROADCAST_CAP);
        Arc::new(Self { tx })
    }

    pub fn broadcast(&self, event: WsEvent) {
        let _ = self.tx.send(event);
    }
}

/// Handler: upgrade HTTP to WebSocket for leaderboard feed.
///
/// Route: `GET /api/v1/oasis/ws/leaderboard`
pub async fn ws_leaderboard_handler(
    State(state): State<OasisState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_leaderboard_socket(socket, state))
}

/// Handler: upgrade HTTP to WebSocket for general events.
///
/// Route: `GET /api/v1/oasis/ws/events`
pub async fn ws_events_handler(
    State(state): State<OasisState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_events_socket(socket, state))
}

async fn handle_leaderboard_socket(mut socket: WebSocket, state: OasisState) {
    info!("New leaderboard WebSocket connection");

    // Send initial leaderboard snapshot
    match state.db.top_players(100) {
        Ok(rows) => {
            let entries: Vec<LeaderboardEntry> = rows
                .into_iter()
                .enumerate()
                .map(|(i, p)| LeaderboardEntry {
                    rank: i + 1,
                    address: p.address,
                    total_xp: p.total_xp,
                    level: p.level.name().to_string(),
                })
                .collect();
            let ev = WsEvent::Leaderboard(entries);
            if let Ok(json) = serde_json::to_string(&ev) {
                let _ = socket.send(Message::Text(json)).await;
            }
        }
        Err(e) => {
            tracing::warn!("Leaderboard ws init failed: {}", e);
        }
    }

    // Keep connection alive (ping every 30s)
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                let ping: Result<(), axum::Error> = socket.send(Message::Ping(Vec::new())).await;
                if ping.is_err() {
                    break;
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Text(txt))) => {
                        // Echo back pong or handle client commands
                        if let Ok(_cmd) = serde_json::from_str::<serde_json::Value>(&txt) {
                            // Client can request refresh; ignored for now
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    info!("Leaderboard WebSocket connection closed");
}

async fn handle_events_socket(mut socket: WebSocket, state: OasisState) {
    info!("New events WebSocket connection");

    let mut rx = state
        .ws_hub
        .as_ref()
        .map(|h| h.tx.subscribe())
        .unwrap_or_else(|| {
            let (tx, rx) = broadcast::channel(1);
            let _ = tx.send(WsEvent::System {
                msg: "OASIS events feed active".into(),
            });
            rx
        });

    // Keep connection alive and broadcast events
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                let ping: Result<(), axum::Error> = socket.send(Message::Ping(Vec::new())).await;
                if ping.is_err() {
                    break;
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
            ev = rx.recv() => {
                match ev {
                    Ok(event) => {
                        if let Ok(json) = serde_json::to_string(&event) {
                            let send: Result<(), axum::Error> = socket.send(Message::Text(json)).await;
                            if send.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        // Client too slow; skip lagged messages
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }
    info!("Events WebSocket connection closed");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ws_hub_broadcast() {
        let hub = WsHub::new();
        hub.broadcast(WsEvent::System {
            msg: "hello".into(),
        });
        // Should not panic
    }

    #[test]
    fn test_ws_event_serialization() {
        let ev = WsEvent::XpAward {
            address: "zion1test".into(),
            amount: 500,
            total_xp: 1500,
        };
        let json = serde_json::to_string(&ev).unwrap();
        assert!(json.contains("xp_award"));
        assert!(json.contains("zion1test"));
    }
}
