// Phase 7c — JSON-RPC 2.0 protocol handler
//
// Audit reference: #12
//
// Pure protocol layer: parses JSON-RPC 2.0 requests, routes to handler
// functions, and builds spec-compliant responses. Transport-agnostic —
// the node can plug this into HTTP (Axum), TCP, or any byte stream.
//
// Spec: https://www.jsonrpc.org/specification

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ── Constants ──────────────────────────────────────────────────────────

pub const JSONRPC_VERSION: &str = "2.0";

// Standard error codes (JSON-RPC 2.0 spec)
pub const PARSE_ERROR: i64 = -32700;
pub const INVALID_REQUEST: i64 = -32600;
pub const METHOD_NOT_FOUND: i64 = -32601;
pub const INVALID_PARAMS: i64 = -32602;
pub const INTERNAL_ERROR: i64 = -32603;

// Application-specific error codes (-32000 to -32099)
pub const BLOCK_NOT_FOUND: i64 = -32001;
pub const TX_NOT_FOUND: i64 = -32002;
pub const INVALID_ADDRESS: i64 = -32003;
pub const TX_REJECTED: i64 = -32004;
pub const NOT_SYNCED: i64 = -32005;

// ── Request / Response types ───────────────────────────────────────────

/// A parsed JSON-RPC 2.0 request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub jsonrpc: String,
    pub method: String,
    #[serde(default)]
    pub params: Value,
    #[serde(default)]
    pub id: Value,
}

/// A JSON-RPC 2.0 response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
    pub id: Value,
}

/// A JSON-RPC 2.0 error object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl RpcResponse {
    /// Build a success response.
    pub fn success(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            result: Some(result),
            error: None,
            id,
        }
    }

    /// Build an error response.
    pub fn error(id: Value, code: i64, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            result: None,
            error: Some(RpcError {
                code,
                message: message.into(),
                data: None,
            }),
            id,
        }
    }

    /// Build an error response with extra data.
    pub fn error_with_data(id: Value, code: i64, message: impl Into<String>, data: Value) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            result: None,
            error: Some(RpcError {
                code,
                message: message.into(),
                data: Some(data),
            }),
            id,
        }
    }
}

// ── Handler trait ──────────────────────────────────────────────────────

/// Result type returned by RPC method handlers.
pub type HandlerResult = Result<Value, (i64, String)>;

/// A handler function signature: takes params, returns result or error.
pub type HandlerFn = Box<dyn Fn(&Value) -> HandlerResult + Send + Sync>;

// ── Router ─────────────────────────────────────────────────────────────

/// JSON-RPC 2.0 router. Maps method names to handler functions.
pub struct RpcRouter {
    handlers: HashMap<String, HandlerFn>,
}

impl RpcRouter {
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    /// Register a method handler.
    pub fn register(&mut self, method: &str, handler: HandlerFn) {
        self.handlers.insert(method.to_string(), handler);
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
            Err(_) => RpcResponse::error(Value::Null, PARSE_ERROR, "Parse error"),
            Ok(val) => {
                // Check for batch request
                if let Some(arr) = val.as_array() {
                    if arr.is_empty() {
                        RpcResponse::error(Value::Null, INVALID_REQUEST, "Empty batch")
                    } else {
                        // Batch: process each, return array
                        let responses: Vec<RpcResponse> = arr.iter()
                            .map(|v| self.handle_value(v))
                            .collect();
                        // Serialize as array
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
            Err(_) => return RpcResponse::error(Value::Null, INVALID_REQUEST, "Invalid Request"),
        };
        self.handle_request(&req)
    }

    /// Handle a parsed RPC request.
    pub fn handle_request(&self, req: &RpcRequest) -> RpcResponse {
        if req.jsonrpc != JSONRPC_VERSION {
            return RpcResponse::error(req.id.clone(), INVALID_REQUEST, "Invalid jsonrpc version");
        }

        match self.handlers.get(&req.method) {
            None => RpcResponse::error(
                req.id.clone(),
                METHOD_NOT_FOUND,
                format!("Method not found: {}", req.method),
            ),
            Some(handler) => match handler(&req.params) {
                Ok(result) => RpcResponse::success(req.id.clone(), result),
                Err((code, msg)) => RpcResponse::error(req.id.clone(), code, msg),
            },
        }
    }
}

impl Default for RpcRouter {
    fn default() -> Self {
        Self::new()
    }
}

// ── Helper: build a router with standard node methods ──────────────────

/// Create a router pre-seeded with the priority RPC methods.
/// The caller must provide closures that access real node state.
pub fn build_node_router() -> RpcRouter {
    let mut router = RpcRouter::new();

    // Placeholder stubs — real implementations plug in via `register()`
    // These return descriptive errors so callers know the method exists
    // but needs a real implementation bound.
    let stub = |method_name: &'static str| -> HandlerFn {
        Box::new(move |_params: &Value| {
            Err((INTERNAL_ERROR, format!("{method_name}: not yet bound to node state")))
        })
    };

    // Priority methods from roadmap spec
    router.register("getBalance", stub("getBalance"));
    router.register("getBlock", stub("getBlock"));
    router.register("getBlockByHeight", stub("getBlockByHeight"));
    router.register("getTransaction", stub("getTransaction"));
    router.register("sendRawTransaction", stub("sendRawTransaction"));
    router.register("getBlockTemplate", stub("getBlockTemplate"));
    router.register("getMempoolInfo", stub("getMempoolInfo"));
    router.register("getPeerInfo", stub("getPeerInfo"));
    router.register("getChainInfo", stub("getChainInfo"));
    router.register("getNodeInfo", stub("getNodeInfo"));
    router.register("submitBlock", stub("submitBlock"));

    router
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_router() -> RpcRouter {
        let mut router = RpcRouter::new();
        router.register("echo", Box::new(|params: &Value| {
            Ok(params.clone())
        }));
        router.register("add", Box::new(|params: &Value| {
            let a = params.get("a").and_then(|v| v.as_i64()).unwrap_or(0);
            let b = params.get("b").and_then(|v| v.as_i64()).unwrap_or(0);
            Ok(json!(a + b))
        }));
        router.register("fail", Box::new(|_params: &Value| {
            Err((TX_REJECTED, "transaction rejected".to_string()))
        }));
        router
    }

    #[test]
    fn success_response() {
        let router = test_router();
        let req = RpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "echo".to_string(),
            params: json!({"hello": "world"}),
            id: json!(1),
        };
        let resp = router.handle_request(&req);
        assert!(resp.error.is_none());
        assert_eq!(resp.result.unwrap(), json!({"hello": "world"}));
        assert_eq!(resp.id, json!(1));
    }

    #[test]
    fn error_response() {
        let router = test_router();
        let req = RpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "fail".to_string(),
            params: json!(null),
            id: json!(2),
        };
        let resp = router.handle_request(&req);
        assert!(resp.result.is_none());
        let err = resp.error.unwrap();
        assert_eq!(err.code, TX_REJECTED);
    }

    #[test]
    fn method_not_found() {
        let router = test_router();
        let req = RpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "nonexistent".to_string(),
            params: json!(null),
            id: json!(3),
        };
        let resp = router.handle_request(&req);
        let err = resp.error.unwrap();
        assert_eq!(err.code, METHOD_NOT_FOUND);
    }

    #[test]
    fn parse_error_on_garbage() {
        let router = test_router();
        let resp_bytes = router.handle_raw(b"this is not json");
        let resp: RpcResponse = serde_json::from_slice(&resp_bytes).unwrap();
        let err = resp.error.unwrap();
        assert_eq!(err.code, PARSE_ERROR);
    }

    #[test]
    fn invalid_request_on_bad_structure() {
        let router = test_router();
        let input = serde_json::to_vec(&json!({"foo": "bar"})).unwrap();
        let resp_bytes = router.handle_raw(&input);
        let resp: RpcResponse = serde_json::from_slice(&resp_bytes).unwrap();
        let err = resp.error.unwrap();
        assert_eq!(err.code, INVALID_REQUEST);
    }

    #[test]
    fn invalid_jsonrpc_version() {
        let router = test_router();
        let req = RpcRequest {
            jsonrpc: "1.0".to_string(),
            method: "echo".to_string(),
            params: json!(null),
            id: json!(4),
        };
        let resp = router.handle_request(&req);
        let err = resp.error.unwrap();
        assert_eq!(err.code, INVALID_REQUEST);
    }

    #[test]
    fn handle_raw_roundtrip() {
        let router = test_router();
        let input = serde_json::to_vec(&json!({
            "jsonrpc": "2.0",
            "method": "add",
            "params": {"a": 3, "b": 4},
            "id": 5
        })).unwrap();

        let resp_bytes = router.handle_raw(&input);
        let resp: RpcResponse = serde_json::from_slice(&resp_bytes).unwrap();
        assert_eq!(resp.result.unwrap(), json!(7));
        assert_eq!(resp.id, json!(5));
    }

    #[test]
    fn batch_request() {
        let router = test_router();
        let input = serde_json::to_vec(&json!([
            {"jsonrpc": "2.0", "method": "echo", "params": "a", "id": 1},
            {"jsonrpc": "2.0", "method": "echo", "params": "b", "id": 2}
        ])).unwrap();

        let resp_bytes = router.handle_raw(&input);
        let responses: Vec<RpcResponse> = serde_json::from_slice(&resp_bytes).unwrap();
        assert_eq!(responses.len(), 2);
        assert_eq!(responses[0].result.as_ref().unwrap(), &json!("a"));
        assert_eq!(responses[1].result.as_ref().unwrap(), &json!("b"));
    }

    #[test]
    fn empty_batch_error() {
        let router = test_router();
        let input = serde_json::to_vec(&json!([])).unwrap();
        let resp_bytes = router.handle_raw(&input);
        let resp: RpcResponse = serde_json::from_slice(&resp_bytes).unwrap();
        let err = resp.error.unwrap();
        assert_eq!(err.code, INVALID_REQUEST);
    }

    #[test]
    fn node_router_has_priority_methods() {
        let router = build_node_router();
        assert!(router.has_method("getBalance"));
        assert!(router.has_method("getBlock"));
        assert!(router.has_method("getBlockByHeight"));
        assert!(router.has_method("getTransaction"));
        assert!(router.has_method("sendRawTransaction"));
        assert!(router.has_method("getBlockTemplate"));
        assert!(router.has_method("getMempoolInfo"));
        assert!(router.has_method("getPeerInfo"));
        assert!(router.has_method("getChainInfo"));
        assert!(router.has_method("getNodeInfo"));
        assert!(router.has_method("submitBlock"));
        assert_eq!(router.method_count(), 11);
    }

    #[test]
    fn node_router_stubs_return_error() {
        let router = build_node_router();
        let req = RpcRequest {
            jsonrpc: "2.0".to_string(),
            method: "getBalance".to_string(),
            params: json!({"address": "zion1test"}),
            id: json!(1),
        };
        let resp = router.handle_request(&req);
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, INTERNAL_ERROR);
    }

    #[test]
    fn method_listing() {
        let router = test_router();
        let methods = router.methods();
        assert!(methods.contains(&"echo"));
        assert!(methods.contains(&"add"));
        assert!(methods.contains(&"fail"));
    }

    #[test]
    fn error_with_data() {
        let resp = RpcResponse::error_with_data(
            json!(1),
            TX_REJECTED,
            "rejected",
            json!({"reason": "double-spend"}),
        );
        let err = resp.error.unwrap();
        assert_eq!(err.data.unwrap(), json!({"reason": "double-spend"}));
    }
}
