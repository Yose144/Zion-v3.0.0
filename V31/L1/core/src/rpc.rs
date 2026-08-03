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
        "getBlock",
        "submitAccountTransaction",
        "submitUtxoTransaction",
        "sendRawTransaction",
        "submitTransaction",
        "getBalance",
        "getAccountBalance",
        "getUtxos",
        "getTransaction",
        "getAccountTransaction",
        "getTransactionHistory",
        "getAddressInfo",
        "getBalanceAtHeight",
        "getMempoolInfo",
        "getSupplyInfo",
        "getBlockRange",
        "getNetworkStats",
        "getBridgeLocks",
        "getBridgeVaultBalance",
        "estimateFee",
        "getTokenInfo",
        "submitBridgeUnlock",
    ];
    if v3_methods.contains(&method) {
        let result = node.v3_rpc.dispatch(method, params).await;
        return wrap_v3_response(id, result);
    }

    // Node-level methods that need the V31 Node (not V3RpcHandler).
    let result = match method {
        "getChainInfo" => get_chain_info(node).await,
        "getNodeInfo" => get_node_info(node).await,
        "getPeerInfo" => get_peer_info(node).await,
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

async fn get_chain_info(node: &Node) -> Result<Value, NodeError> {
    let v3_tip = node.storage.v3_tip().await?;
    let (v3_height, v3_hash) = match &v3_tip {
        Some(b) => (b.height, crate::v3_compat::hex(&b.header_hash())),
        None => (0u64, crate::v3_compat::hex(&[0u8; 32])),
    };
    let native_status = node.status().await?;
    let mempool_size = node.mempool.len().await;
    Ok(json!({
        "network": "mainnet",
        "consensus_profile": "cosmic_harmony_v3",
        "chain_height": v3_height,
        "native_chain_height": native_status.height,
        "tip_hash": v3_hash,
        "accepted_blocks": v3_height + 1,
        "mempool_transactions": mempool_size,
        "protocol_version": "3.1.0-alpha",
        "transaction_model": "hybrid",
        "utxo_validation_available": true,
    }))
}

async fn get_node_info(node: &Node) -> Result<Value, NodeError> {
    let v3_tip = node.storage.v3_tip().await?;
    let v3_height = v3_tip.as_ref().map_or(0, |b| b.height);
    let native_status = node.status().await?;
    let mempool_size = node.mempool.len().await;
    Ok(json!({
        "node_id": "zion-v31-node",
        "protocol_version": "3.1.0-alpha",
        "protocol_version_numeric": 2,
        "flowers_per_zion": crate::emission::FLOWERS_PER_ZION,
        "network": "mainnet",
        "chain_height": v3_height,
        "native_chain_height": native_status.height,
        "rpc_bind": node.config.rpc_addr.to_string(),
        "p2p_bind": node.config.p2p_addr.to_string(),
        "v3_p2p_bind": node.config.v3_p2p_addr.to_string(),
        "accepted_blocks": v3_height + 1,
        "mempool_transactions": mempool_size,
        "transaction_model": "hybrid",
        "balance_lookup": "account_id_or_zion1_address",
    }))
}

async fn get_peer_info(node: &Node) -> Result<Value, NodeError> {
    let peers: Vec<Value> = node
        .config
        .seed_peers
        .iter()
        .map(|p| json!({ "address": p.to_string() }))
        .collect();
    Ok(json!({ "peers": peers, "count": peers.len() }))
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

    /// V3-compatible alias for `ok`.
    pub fn success(id: Value, result: Value) -> Self {
        Self::ok(id, result)
    }

    /// V3-compatible alias for `err`.
    pub fn error(id: Value, code: i64, message: impl Into<String>) -> Self {
        Self::err(id, code, message)
    }

    /// V3-compatible alias for `err_with_data`.
    pub fn error_with_data(id: Value, code: i64, message: impl Into<String>, data: Value) -> Self {
        Self::err_with_data(id, code, message, data)
    }
}

/// Type alias for handler results.
pub type HandlerResult = Result<Value, (i64, String)>;

/// A handler function signature: takes params, returns result or error.
pub type HandlerFn = Box<dyn Fn(&Value) -> HandlerResult + Send + Sync>;

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
        let mut router = Self::new();
        let stub = |method_name: &'static str| -> HandlerFn {
            Box::new(move |_params: &Value| {
                Err((
                    INTERNAL_ERROR,
                    format!("{method_name}: not yet bound to node state"),
                ))
            })
        };
        for method in [
            "getBalance",
            "getAccountBalance",
            "getBlock",
            "getBlockByHeight",
            "getTransaction",
            "getAccountTransaction",
            "sendRawTransaction",
            "submitTransaction",
            "submitAccountTransaction",
            "getBlockTemplate",
            "getMempoolInfo",
            "getPeerInfo",
            "getChainInfo",
            "getNodeInfo",
            "submitBlock",
            "getUtxos",
            "getSupplyInfo",
            "getBalanceAtHeight",
            "getBridgeLocks",
            "getBridgeVaultBalance",
            "submitBridgeUnlock",
            "getTransactionHistory",
            "getAddressInfo",
            "getBlockRange",
            "getNetworkStats",
            "estimateFee",
            "getTokenInfo",
        ] {
            router.register(method, stub(method));
        }
        router
    }

    /// How many methods are registered.
    pub fn method_count(&self) -> usize {
        self.handlers.len()
    }

    /// Check if a method is registered.
    pub fn has_method(&self, method: &str) -> bool {
        self.handlers.contains_key(method)
    }

    /// List all registered method names.
    pub fn methods(&self) -> Vec<&str> {
        self.handlers.keys().map(|s| s.as_str()).collect()
    }

    /// Parse raw JSON bytes into a request, route to handler, return response bytes.
    pub fn handle_raw(&self, input: &[u8]) -> Vec<u8> {
        let response = match serde_json::from_slice::<Value>(input) {
            Err(_) => RpcResponse::err(Value::Null, PARSE_ERROR, "Parse error"),
            Ok(val) => {
                if let Some(arr) = val.as_array() {
                    if arr.is_empty() {
                        RpcResponse::err(Value::Null, INVALID_REQUEST, "Empty batch")
                    } else {
                        let responses: Vec<RpcResponse> =
                            arr.iter().map(|v| self.handle_value(v)).collect();
                        return serde_json::to_vec(&responses).unwrap_or_default();
                    }
                } else {
                    self.handle_value(&val)
                }
            }
        };
        serde_json::to_vec(&response).unwrap_or_default()
    }

    /// Handle a parsed JSON value as an RPC request.
    pub fn handle_value(&self, val: &Value) -> RpcResponse {
        let req: RpcRequest = match serde_json::from_value(val.clone()) {
            Ok(r) => r,
            Err(_) => return RpcResponse::err(Value::Null, INVALID_REQUEST, "Invalid Request"),
        };
        self.handle_request(&req)
    }

    /// Handle a parsed RPC request.
    pub fn handle_request(&self, req: &RpcRequest) -> RpcResponse {
        if req.jsonrpc != JSONRPC_VERSION {
            return RpcResponse::err(req.id.clone(), INVALID_REQUEST, "Invalid jsonrpc version");
        }
        match self.handlers.get(&req.method) {
            None => RpcResponse::err(
                req.id.clone(),
                METHOD_NOT_FOUND,
                format!("Method not found: {}", req.method),
            ),
            Some(handler) => match handler(&req.params) {
                Ok(result) => RpcResponse::ok(req.id.clone(), result),
                Err((code, msg)) => RpcResponse::err(req.id.clone(), code, msg),
            },
        }
    }
}

impl Default for RpcRouter {
    fn default() -> Self {
        Self::new()
    }
}
