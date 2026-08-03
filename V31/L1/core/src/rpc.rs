//! Minimal JSON-RPC server for the ZION L1 node.
//!
//! The Alpha RPC speaks line-delimited JSON over plain TCP. This avoids a heavy
//! HTTP stack while covering the essential node operations.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::watch;
use tracing::{info, warn};

use crate::node::{Node, NodeError};
use crate::transaction::Transaction;

/// Simple JSON-RPC server.
pub struct RpcServer {
    node: Arc<Node>,
}

impl RpcServer {
    pub fn new(node: Arc<Node>) -> Self {
        Self { node }
    }

    /// Run the RPC listener until shutdown is signalled.
    pub async fn run(
        &self,
        addr: SocketAddr,
        mut shutdown: watch::Receiver<bool>,
    ) -> Result<(), NodeError> {
        let listener = TcpListener::bind(addr).await?;
        info!("RPC listening on {}", addr);

        loop {
            tokio::select! {
                _ = shutdown.changed() => break,
                accept = listener.accept() => {
                    let (socket, peer) = accept?;
                    let node = Arc::clone(&self.node);
                    tokio::spawn(async move {
                        if let Err(e) = handle_socket(socket, node).await {
                            warn!("RPC peer {} disconnected: {}", peer, e);
                        }
                    });
                }
            }
        }
        Ok(())
    }
}

async fn handle_socket(mut socket: TcpStream, node: Arc<Node>) -> Result<(), NodeError> {
    let (reader, mut writer) = socket.split();
    let mut lines = BufReader::new(reader).lines();

    while let Some(line) = lines.next_line().await? {
        let response = dispatch_request(&line, &node).await;
        let body = serde_json::to_string(&response)?;
        writer.write_all(body.as_bytes()).await?;
        writer.write_all(b"\n").await?;
        writer.flush().await?;
    }
    Ok(())
}

async fn dispatch_request(line: &str, node: &Node) -> Value {
    let Ok(req) = serde_json::from_str::<Value>(line) else {
        return error_response(None, -32700, "parse error");
    };
    let id = req.get("id").cloned();
    let method = req.get("method").and_then(Value::as_str).unwrap_or("");
    let params = req.get("params").cloned().unwrap_or(Value::Null);

    // New-chain template and block submission methods.
    if method == "getTemplate" || method == "getBlockTemplate" {
        return match block_template(node, &params).await {
            Ok(v) => success_response(id, v),
            Err(e) => error_response(id, -32000, &e.to_string()),
        };
    }

    if method == "submitBlock" {
        return match submit_block_rpc(node, &params).await {
            Ok(v) => success_response(id, v),
            Err(e) => error_response(id, -32000, &e.to_string()),
        };
    }

    // V3 methods are dispatched to the V3 RPC handler.
    let v3_methods = [
        "getStatus",
        "getBlockByHeight",
        "getBlockByHash",
        "submitAccountTransaction",
        "submitUtxoTransaction",
        "getBalance",
        "getUtxos",
    ];
    if v3_methods.contains(&method) {
        let result = node.v3_rpc.dispatch(method, params).await;
        return wrap_v3_response(id, result);
    }

    // Legacy transaction submission.
    let result = match method {
        "submitTransaction" => submit_transaction(node, &params).await,
        _ => Ok(error_response(
            id.clone(),
            -32601,
            &format!("method not found: {method}"),
        )),
    };

    match result {
        Ok(v) => success_response(id, v),
        Err(e) => error_response(id, -32000, &e.to_string()),
    }
}

/// Wrap a V3 RPC handler result into a JSON-RPC 2.0 response.
fn wrap_v3_response(id: Option<Value>, result: Value) -> Value {
    if let Some(err) = result.get("error") {
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": err,
        })
    } else {
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": result["result"],
        })
    }
}

async fn block_template(node: &Node, params: &Value) -> Result<Value, NodeError> {
    let miner = params
        .get("miner_address")
        .or(params.get("miner"))
        .and_then(Value::as_str)
        .unwrap_or("zion1test");
    let miner_addr = zion_l1_types::Address::new(zion_l1_types::ChainId::ZionL1, vec![], miner)
        .map_err(|e| NodeError::Address(e.to_string()))?;
    let template = node.block_template(miner_addr).await?;
    Ok(serde_json::to_value(template)?)
}

async fn submit_block_rpc(node: &Node, params: &Value) -> Result<Value, NodeError> {
    // Try the new-chain Block first.
    if let Ok(block) = serde_json::from_value::<crate::Block>(params.clone()) {
        node.submit_block(block).await?;
        return Ok(json!({"accepted": true}));
    }
    // Fall back to V3 handlers.
    let result = node.v3_rpc.dispatch("submitBlock", params.clone()).await;
    if let Some(err) = result.get("error").filter(|v| !v.is_null()) {
        return Err(NodeError::Task(err.to_string()));
    }
    Ok(result.get("result").cloned().unwrap_or(Value::Null))
}

async fn submit_transaction(node: &Node, params: &Value) -> Result<Value, NodeError> {
    let tx: Transaction = serde_json::from_value(params.clone())?;
    node.submit_transaction(tx).await;
    Ok(json!("ok"))
}

fn success_response(id: Option<Value>, result: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result,
    })
}

fn error_response(id: Option<Value>, code: i32, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message },
    })
}

// ── V3-compatible JSON-RPC types and error codes ──────────────────────
//
// These constants and types match the V3 RPC protocol so that V31 can
// speak the same wire format as V3 nodes and existing tooling (dashboard,
// CLI, pool) works without modification.

/// JSON-RPC protocol version string.
pub const JSONRPC_VERSION: &str = "2.0";

// Standard JSON-RPC error codes.
pub const PARSE_ERROR: i64 = -32700;
pub const INVALID_REQUEST: i64 = -32600;
pub const METHOD_NOT_FOUND: i64 = -32601;
pub const INVALID_PARAMS: i64 = -32602;
pub const INTERNAL_ERROR: i64 = -32603;

// ZION-specific error codes.
pub const BLOCK_NOT_FOUND: i64 = -32001;
pub const TX_NOT_FOUND: i64 = -32002;
pub const INVALID_ADDRESS: i64 = -32003;
pub const TX_REJECTED: i64 = -32004;
pub const NOT_SYNCED: i64 = -32005;

/// A JSON-RPC request (V3-compatible).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub jsonrpc: String,
    pub id: Value,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

/// A JSON-RPC error object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// A JSON-RPC response (V3-compatible).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

impl RpcResponse {
    /// Build a success response.
    pub fn ok(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }

    /// Build an error response.
    pub fn err(id: Value, code: i64, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            result: None,
            error: Some(RpcError {
                code,
                message: message.into(),
                data: None,
            }),
        }
    }

    /// Build an error response with extra data.
    pub fn err_with_data(id: Value, code: i64, message: impl Into<String>, data: Value) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            result: None,
            error: Some(RpcError {
                code,
                message: message.into(),
                data: Some(data),
            }),
        }
    }
}

/// Type alias for handler results.
pub type HandlerResult = Result<Value, (i64, String)>;

/// A simple JSON-RPC method dispatcher (V3-compatible).
///
/// Maps method names to handler closures. Used by the node runtime to
/// route incoming RPC calls.
pub struct RpcRouter {
    #[allow(clippy::type_complexity)]
    handlers: HashMap<String, Box<dyn Fn(&Value) -> HandlerResult + Send + Sync>>,
}

impl RpcRouter {
    /// Create an empty router.
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    /// Register a handler for a method name.
    pub fn register<F>(&mut self, method: &str, handler: F)
    where
        F: Fn(&Value) -> HandlerResult + Send + Sync + 'static,
    {
        self.handlers.insert(method.to_string(), Box::new(handler));
    }

    /// Dispatch a request, returning a response.
    pub fn dispatch(&self, request: &RpcRequest) -> RpcResponse {
        match self.handlers.get(&request.method) {
            Some(handler) => match handler(&request.params) {
                Ok(result) => RpcResponse::ok(request.id.clone(), result),
                Err((code, msg)) => RpcResponse::err(request.id.clone(), code, msg),
            },
            None => RpcResponse::err(
                request.id.clone(),
                METHOD_NOT_FOUND,
                format!("method '{}' not found", request.method),
            ),
        }
    }

    /// Build a stub router with no handlers (placeholder for NodeRuntime integration).
    pub fn build_stub_router() -> Self {
        Self::new()
    }
}

impl Default for RpcRouter {
    fn default() -> Self {
        Self::new()
    }
}
