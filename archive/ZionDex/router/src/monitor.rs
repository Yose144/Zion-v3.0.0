use crate::types::*;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use crate::api::AppState;
use futures_util::{SinkExt, StreamExt};
use tracing::info;

/// WebSocket handler for real-time swap status updates
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> axum::response::Response {
    ws.on_upgrade(|socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: AppState) {
    info!("WebSocket client connected");

    let (mut sender, mut receiver) = socket.split();

    // Send initial connection message
    let hello = serde_json::json!({
        "type": "connected",
        "version": env!("CARGO_PKG_VERSION"),
    });
    let _ = sender.send(Message::Text(hello.to_string())).await;

    // Listen for messages
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // Parse the message — could be a subscription request
                if let Ok(req) = serde_json::from_str::<WsRequest>(&text) {
                    match req.action.as_str() {
                        "subscribe" => {
                            // Subscribe to swap updates
                            if let Some(swap_id) = req.swap_id {
                                // Poll swap status and send updates
                                let response = poll_swap_status(&state, &swap_id).await;
                                let _ = sender.send(Message::Text(response)).await;
                            }
                        }
                        "ping" => {
                            let pong = serde_json::json!({ "type": "pong" });
                            let _ = sender.send(Message::Text(pong.to_string())).await;
                        }
                        _ => {}
                    }
                }
            }
            Ok(Message::Close(_)) => {
                info!("WebSocket client disconnected");
                break;
            }
            Err(e) => {
                tracing::warn!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

/// Poll swap status from DB and return as JSON
async fn poll_swap_status(state: &AppState, swap_id: &str) -> String {
    let db = state.db.lock().await;
    match db.get_swap(swap_id) {
        Ok(Some(record)) => serde_json::json!({
            "type": "swap_update",
            "swap": record,
        }).to_string(),
        Ok(None) => serde_json::json!({
            "type": "error",
            "message": "Swap not found",
        }).to_string(),
        Err(e) => serde_json::json!({
            "type": "error",
            "message": e.to_string(),
        }).to_string(),
    }
}

/// WebSocket request from client
#[derive(serde::Deserialize)]
struct WsRequest {
    action: String,
    swap_id: Option<String>,
}

/// WebSocket message to client
#[derive(serde::Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    Connected { version: String },
    SwapUpdate { swap: SwapRecord },
    Pong,
    Error { message: String },
}
