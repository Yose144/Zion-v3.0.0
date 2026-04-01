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
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use crate::NodeRuntime;
use crate::crypto;
use crate::emission;
use crate::fee;

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

const ACTIVE_TRANSACTION_MODEL: &str = "account";

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

fn looks_like_utxo_address(value: &str) -> bool {
    value.starts_with("zion1")
}

fn format_flowers_as_zion(amount: u64) -> String {
    format!(
        "{}.{:012}",
        amount / emission::FLOWERS_PER_ZION,
        amount % emission::FLOWERS_PER_ZION
    )
}

fn parse_bridge_memo(memo: &str) -> Option<(&str, &str)> {
    let rest = memo.strip_prefix("BRIDGE:")?;
    let (chain, recipient) = rest.split_once(':')?;
    if chain.is_empty() || recipient.is_empty() {
        return None;
    }
    Some((chain, recipient))
}

fn utxo_balance_at_height(rt: &NodeRuntime, address: &str, height: u64) -> u64 {
    let mut utxos: HashMap<(String, u32), u64> = HashMap::new();
    for block in rt.accepted_blocks().iter().filter(|block| block.height <= height) {
        for utxo_tx in &block.utxo_transactions {
            for input in &utxo_tx.inputs {
                utxos.remove(&(crypto::to_hex(&input.prev_tx_hash), input.output_index));
            }
        }
        for utxo_tx in &block.utxo_transactions {
            let tx_hash = crypto::to_hex(&utxo_tx.id);
            for (index, output) in utxo_tx.outputs.iter().enumerate() {
                utxos.insert((tx_hash.clone(), index as u32), output.amount);
            }
        }
    }

    let mut balance = 0u64;
    for block in rt.accepted_blocks().iter().filter(|block| block.height <= height) {
        for utxo_tx in &block.utxo_transactions {
            let tx_hash = crypto::to_hex(&utxo_tx.id);
            for (index, output) in utxo_tx.outputs.iter().enumerate() {
                if output.address == address
                    && utxos.contains_key(&(tx_hash.clone(), index as u32))
                {
                    balance = balance.saturating_add(output.amount);
                }
            }
        }
    }
    balance
}

// ── Helper: build a router with standard node methods ──────────────────

/// Create a stub router with all method names registered but no live state.
/// Used by node_builder and other modules that don't have a NodeRuntime.
pub fn build_stub_router() -> RpcRouter {
    let mut router = RpcRouter::new();
    let stub = |method_name: &'static str| -> HandlerFn {
        Box::new(move |_params: &Value| {
            Err((INTERNAL_ERROR, format!("{method_name}: not yet bound to node state")))
        })
    };
    for method in [
        "getBalance", "getAccountBalance", "getBlock", "getBlockByHeight", "getTransaction",
        "getAccountTransaction", "sendRawTransaction", "submitTransaction", "submitAccountTransaction", "getBlockTemplate", "getMempoolInfo",
        "getPeerInfo", "getChainInfo", "getNodeInfo", "submitBlock", "getUtxos", "getSupplyInfo",
        "getBalanceAtHeight", "getBridgeLocks", "getBridgeVaultBalance", "submitBridgeUnlock",
    ] {
        router.register(method, stub(method));
    }
    router
}

/// Create a router pre-seeded with the priority RPC methods.
/// Each handler captures an `Arc<Mutex<NodeRuntime>>` for live state access.
pub fn build_node_router(runtime: Arc<Mutex<NodeRuntime>>) -> RpcRouter {
    let mut router = RpcRouter::new();

    // ── getChainInfo ───────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getChainInfo", Box::new(move |_params: &Value| {
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let status = rt.status();
            Ok(json!({
                "network": status.network,
                "consensus_profile": status.consensus_profile,
                "chain_height": status.chain_height,
                "tip_hash": status.tip_hash_hex,
                "accepted_blocks": status.accepted_blocks,
                "mempool_transactions": status.mempool_transactions,
                "protocol_version": status.protocol_version,
                "transaction_model": ACTIVE_TRANSACTION_MODEL,
                "utxo_validation_available": true,
            }))
        }));
    }

    // ── getNodeInfo ────────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getNodeInfo", Box::new(move |_params: &Value| {
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let status = rt.status();
            Ok(json!({
                "node_id": status.node_id,
                "protocol_version": status.protocol_version,
                "network": status.network,
                "chain_height": status.chain_height,
                "p2p_bind": status.p2p_bind.address(),
                "rpc_bind": status.rpc_bind.address(),
                "pool_bind": status.pool_bind.address(),
                "known_peers": status.known_peers.len(),
                "accepted_blocks": status.accepted_blocks,
                "mempool_transactions": status.mempool_transactions,
                "transaction_model": ACTIVE_TRANSACTION_MODEL,
                "balance_lookup": "account_id",
            }))
        }));
    }

    // ── getBlockByHeight ───────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getBlockByHeight", Box::new(move |params: &Value| {
            let height = params.get("height")
                .or_else(|| params.get(0))
                .and_then(|v| v.as_u64())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'height' param".into()))?;
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            match rt.accepted_block_by_height(height) {
                Some(block) => Ok(serde_json::to_value(block).unwrap_or(Value::Null)),
                None => Err((BLOCK_NOT_FOUND, format!("no block at height {height}"))),
            }
        }));
    }

    // ── getBlock (by hash) ─────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getBlock", Box::new(move |params: &Value| {
            let hash = params.get("hash")
                .or_else(|| params.get(0))
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'hash' param".into()))?;
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            for block in rt.accepted_blocks() {
                if block.hash_hex == hash {
                    return Ok(serde_json::to_value(block).unwrap_or(Value::Null));
                }
            }
            Err((BLOCK_NOT_FOUND, format!("no block with hash {hash}")))
        }));
    }

    // ── getTransaction / getAccountTransaction ───────────────────────
    let register_get_transaction = |router: &mut RpcRouter, method_name: &'static str| {
        let rt = Arc::clone(&runtime);
        router.register(method_name, Box::new(move |params: &Value| {
            let txid = params.get("txid")
                .or_else(|| params.get(0))
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'txid' param".into()))?;
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            for block in rt.accepted_blocks() {
                for tx in &block.transactions {
                    if tx.tx_id == txid {
                        return Ok(json!({
                            "transaction_model": ACTIVE_TRANSACTION_MODEL,
                            "transaction": tx,
                            "block_height": block.height,
                            "block_hash": block.hash_hex,
                            "confirmed": true,
                            "source": "confirmed",
                        }));
                    }
                }
            }
            Err((TX_NOT_FOUND, format!("transaction {txid} not found")))
        }));
    };
    register_get_transaction(&mut router, "getTransaction");
    register_get_transaction(&mut router, "getAccountTransaction");

    // ── getBalance / getAccountBalance ────────────────────────────────
    let register_get_balance = |router: &mut RpcRouter, method_name: &'static str| {
        let rt = Arc::clone(&runtime);
        router.register(method_name, Box::new(move |params: &Value| {
            let account_id = params.get("account")
                .or_else(|| params.get("address"))
                .or_else(|| params.get(0))
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'account' param".into()))?;
            if account_id.is_empty() {
                return Err((INVALID_ADDRESS, "empty account id".into()));
            }
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            if looks_like_utxo_address(account_id) {
                let balance = rt.utxo_balance(account_id);
                return Ok(json!({
                    "address": account_id,
                    "balance_flowers": balance,
                    "chain_height": rt.chain_height(),
                    "transaction_model": "utxo",
                    "balance_scope": "confirmed_chain_only",
                }));
            }
            let mut balance: i128 = 0;
            for block in rt.accepted_blocks() {
                for tx in &block.transactions {
                    if tx.to == account_id {
                        balance += tx.amount_zion as i128;
                    }
                    if tx.from == account_id {
                        balance -= (tx.amount_zion + tx.fee_zion) as i128;
                    }
                }
            }
            Ok(json!({
                "account_id": account_id,
                "balance_zion": balance.max(0) as u64,
                "chain_height": rt.chain_height(),
                "transaction_model": ACTIVE_TRANSACTION_MODEL,
                "balance_scope": "confirmed_chain_only",
            }))
        }));
    };
    register_get_balance(&mut router, "getBalance");
    register_get_balance(&mut router, "getAccountBalance");

    // ── getBalanceAtHeight ────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getBalanceAtHeight", Box::new(move |params: &Value| {
            let account_id = params.get("account")
                .or_else(|| params.get("address"))
                .or_else(|| params.get(0))
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'account' param".into()))?;
            let height = params.get("height")
                .or_else(|| params.get(1))
                .and_then(|v| v.as_u64())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'height' param".into()))?;
            if account_id.is_empty() {
                return Err((INVALID_ADDRESS, "empty account id".into()));
            }
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let effective_height = height.min(rt.chain_height());
            if looks_like_utxo_address(account_id) {
                let balance = utxo_balance_at_height(&rt, account_id, effective_height);
                return Ok(json!({
                    "address": account_id,
                    "height": effective_height,
                    "balance_flowers": balance,
                    "balance_zion": format_flowers_as_zion(balance),
                    "transaction_model": "utxo",
                    "balance_scope": "confirmed_chain_only",
                }));
            }
            let mut balance: i128 = 0;
            for block in rt.accepted_blocks().iter().filter(|block| block.height <= effective_height) {
                for tx in &block.transactions {
                    if tx.to == account_id {
                        balance += tx.amount_zion as i128;
                    }
                    if tx.from == account_id {
                        balance -= (tx.amount_zion + tx.fee_zion) as i128;
                    }
                }
            }
            Ok(json!({
                "account_id": account_id,
                "height": effective_height,
                "balance_zion": balance.max(0) as u64,
                "transaction_model": ACTIVE_TRANSACTION_MODEL,
                "balance_scope": "confirmed_chain_only",
            }))
        }));
    }

    // ── getUtxos ───────────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getUtxos", Box::new(move |params: &Value| {
            let address = params.get("address")
                .or_else(|| params.get(0))
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'address' param".into()))?;
            if address.is_empty() {
                return Err((INVALID_ADDRESS, "empty address".into()));
            }
            if !looks_like_utxo_address(address) {
                return Err((INVALID_ADDRESS, "getUtxos requires a zion1 UTXO address".into()));
            }
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let utxos = rt.spendable_utxos(address);
            let utxo_list: Vec<Value> = utxos.iter().map(|u| json!({
                "tx_hash": u.tx_hash,
                "output_index": u.output_index,
                "amount": u.amount,
                "address": u.address,
                "height": u.height,
            })).collect();
            Ok(json!({
                "address": address,
                "utxos": utxo_list,
                "count": utxo_list.len(),
                "total_amount": utxos.iter().map(|u| u.amount).sum::<u64>(),
                "chain_height": rt.chain_height(),
            }))
        }));
    }

    // ── getBridgeLocks ────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getBridgeLocks", Box::new(move |params: &Value| {
            let from_height = params.get("from_height")
                .or_else(|| params.get(0))
                .and_then(|v| v.as_u64())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'from_height' param".into()))?;
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let to_height = params.get("to_height")
                .or_else(|| params.get(1))
                .and_then(|v| v.as_u64())
                .unwrap_or_else(|| rt.chain_height())
                .min(rt.chain_height());
            if from_height > to_height {
                return Err((INVALID_PARAMS, "from_height cannot be greater than to_height".into()));
            }

            let mut locks = Vec::new();
            for block in rt.accepted_blocks().iter().filter(|block| block.height >= from_height && block.height <= to_height) {
                for utxo_tx in &block.utxo_transactions {
                    let sender = utxo_tx.inputs.first()
                        .map(|input| crypto::derive_address(&input.public_key))
                        .unwrap_or_default();
                    let txid = crypto::to_hex(&utxo_tx.id);
                    for output in &utxo_tx.outputs {
                        if output.address != fee::BRIDGE_VAULT_ADDRESS {
                            continue;
                        }
                        let Some(memo) = output.memo.as_deref() else {
                            continue;
                        };
                        let Some((recipient_chain, recipient)) = parse_bridge_memo(memo) else {
                            continue;
                        };
                        locks.push(json!({
                            "txid": txid,
                            "block_height": block.height,
                            "sender": sender,
                            "recipient_chain": recipient_chain,
                            "recipient": recipient,
                            "amount_flowers": output.amount,
                            "amount_zion": format_flowers_as_zion(output.amount),
                            "memo": memo,
                            "confirmed": true,
                        }));
                    }
                }
            }

            Ok(json!({
                "from_height": from_height,
                "to_height": to_height,
                "locks": locks,
                "count": locks.len(),
            }))
        }));
    }

    // ── getBridgeVaultBalance ─────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getBridgeVaultBalance", Box::new(move |_params: &Value| {
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let balance = rt.utxo_balance(fee::BRIDGE_VAULT_ADDRESS);
            Ok(json!({
                "address": fee::BRIDGE_VAULT_ADDRESS,
                "balance_flowers": balance,
                "balance_zion": format_flowers_as_zion(balance),
                "chain_height": rt.chain_height(),
            }))
        }));
    }

    // ── submitBridgeUnlock ────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("submitBridgeUnlock", Box::new(move |params: &Value| {
            let recipient = params.get("recipient")
                .or_else(|| params.get("l1_recipient"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'recipient' param".into()))?;
            let amount_flowers = params.get("amount_flowers")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'amount_flowers' param".into()))?;
            let burn_id = params.get("burn_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'burn_id' param".into()))?;
            let source_chain = params.get("evm_chain")
                .or_else(|| params.get("source_chain"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'evm_chain' param".into()))?;
            let evm_tx_hash = params.get("evm_tx_hash")
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'evm_tx_hash' param".into()))?;
            let validator_proofs = params.get("validator_proofs")
                .or_else(|| params.get("validators"))
                .and_then(|v| v.as_array())
                .ok_or_else(|| (INVALID_PARAMS, "missing or invalid 'validator_proofs' param".into()))?;

            if !crypto::is_valid_address(recipient) {
                return Err((INVALID_ADDRESS, "recipient must be a valid zion1 address".into()));
            }
            if amount_flowers == 0 {
                return Err((INVALID_PARAMS, "amount_flowers must be > 0".into()));
            }
            if validator_proofs.len() < 3 {
                return Err((INVALID_PARAMS, "submitBridgeUnlock requires at least 3 validator proofs".into()));
            }
            if burn_id.trim().is_empty() || source_chain.trim().is_empty() || evm_tx_hash.trim().is_empty() {
                return Err((INVALID_PARAMS, "bridge unlock metadata must not be empty".into()));
            }

            let mut validator_ids = HashSet::new();
            let mut non_synthetic_signed = 0usize;
            for proof in validator_proofs {
                let validator_id = proof.get("validator_id")
                    .or_else(|| proof.get("id"))
                    .and_then(|value| value.as_str())
                    .ok_or_else(|| (INVALID_PARAMS, "each validator proof requires a string validator_id".into()))?;
                if !validator_ids.insert(validator_id.to_string()) {
                    return Err((INVALID_PARAMS, format!("duplicate validator_id in validator_proofs: {validator_id}")));
                }

                let signature = proof
                    .get("signature")
                    .and_then(|value| value.as_str())
                    .ok_or_else(|| (INVALID_PARAMS, format!("validator proof {validator_id} is missing string signature")))?;
                let synthetic = proof
                    .get("synthetic")
                    .and_then(|value| value.as_bool())
                    .unwrap_or(false);

                if !synthetic {
                    let sig_hex = signature.strip_prefix("0x").unwrap_or(signature);
                    let sig_ok = sig_hex.len() == 128
                        && sig_hex.chars().all(|c| c.is_ascii_hexdigit());
                    if !sig_ok {
                        return Err((
                            INVALID_PARAMS,
                            format!(
                                "validator proof {validator_id} must contain a 64-byte secp256k1 signature hex"
                            ),
                        ));
                    }
                    non_synthetic_signed += 1;
                }
            }

            if non_synthetic_signed == 0 {
                return Err((
                    INVALID_PARAMS,
                    "submitBridgeUnlock requires at least one non-synthetic signed validator proof".into(),
                ));
            }

            let mut rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let response = rt.submit_bridge_unlock(crate::BridgeUnlockRequest {
                recipient: recipient.to_string(),
                amount_flowers,
                source_chain: source_chain.to_string(),
                burn_id: burn_id.to_string(),
                evm_tx_hash: evm_tx_hash.to_string(),
            });
            match response {
                crate::RpcResponse::TransactionResult { accepted, tx_id, reason } => {
                    if accepted {
                        Ok(json!({ "accepted": true, "tx_id": tx_id }))
                    } else {
                        Err((TX_REJECTED, reason.unwrap_or_else(|| "bridge unlock rejected".into())))
                    }
                }
                _ => Err((INTERNAL_ERROR, "unexpected response".into())),
            }
        }));
    }

    // ── getBlockTemplate ───────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getBlockTemplate", Box::new(move |_params: &Value| {
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let template = rt.active_template();
            Ok(serde_json::to_value(&template).unwrap_or(Value::Null))
        }));
    }

    // ── getMempoolInfo ─────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getMempoolInfo", Box::new(move |_params: &Value| {
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let status = rt.status();
            Ok(json!({
                "size": status.mempool_transactions,
                "template_transactions": status.active_template_transactions,
                "template_total_fees_zion": status.active_template_total_fees_zion,
                "transaction_model": ACTIVE_TRANSACTION_MODEL,
            }))
        }));
    }

    // ── getPeerInfo ────────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getPeerInfo", Box::new(move |_params: &Value| {
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let peers: Vec<Value> = rt.known_peers().iter().map(|peer| {
                json!({ "host": peer.host, "port": peer.port, "address": peer.address() })
            }).collect();
            Ok(json!({ "peers": peers, "count": peers.len() }))
        }));
    }

    // ── sendRawTransaction / submitTransaction ────────────────────────
    let register_submit_transaction = |router: &mut RpcRouter, method_name: &'static str| {
        let rt = Arc::clone(&runtime);
        router.register(method_name, Box::new(move |params: &Value| {
            let tx_value = params
                .get("transaction")
                .cloned()
                .unwrap_or_else(|| params.clone());
            let submitted = match crate::SubmittedTransaction::parse_value(tx_value) {
                Ok(transaction) => transaction,
                Err(message) => return Err((INVALID_PARAMS, message)),
            };
            let mut rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let resp = rt.submit_submitted_transaction(submitted);
            match resp {
                crate::RpcResponse::TransactionResult { accepted, tx_id, reason } => {
                    if accepted {
                        Ok(json!({ "accepted": true, "tx_id": tx_id }))
                    } else {
                        Err((TX_REJECTED, reason.unwrap_or_else(|| "rejected".into())))
                    }
                }
                _ => Err((INTERNAL_ERROR, "unexpected response".into())),
            }
        }));
    };
    register_submit_transaction(&mut router, "sendRawTransaction");
    register_submit_transaction(&mut router, "submitTransaction");
    register_submit_transaction(&mut router, "submitAccountTransaction");

    // ── getSupplyInfo ───────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("getSupplyInfo", Box::new(move |_params: &Value| {
            let rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let height = rt.chain_height();
            let block_reward = emission::block_subsidy(height.max(1));

            // Cumulative mined supply in flowers (walk decade boundaries)
            let mined_flowers: u128 = {
                let mut sum: u128 = 0;
                let mut h: u64 = 1;
                while h <= height {
                    let decade_end =
                        ((h - 1) / emission::BLOCKS_PER_DECADE + 1) * emission::BLOCKS_PER_DECADE;
                    let blocks_in_range = decade_end.min(height) - h + 1;
                    sum += emission::block_subsidy(h) as u128 * blocks_in_range as u128;
                    h = decade_end + 1;
                }
                sum
            };

            let circulating_flowers = emission::GENESIS_PREMINE + mined_flowers;
            let remaining_flowers = emission::TOTAL_SUPPLY.saturating_sub(circulating_flowers);

            let supply_mined_pct = if emission::MINING_EMISSION > 0 {
                (mined_flowers as f64 / emission::MINING_EMISSION as f64) * 100.0
            } else {
                0.0
            };

            Ok(json!({
                "total_supply_atomic": emission::TOTAL_SUPPLY.to_string(),
                "total_supply_zion": (emission::TOTAL_SUPPLY / emission::FLOWERS_PER_ZION as u128) as u64,
                "premine_atomic": emission::GENESIS_PREMINE.to_string(),
                "premine_zion": (emission::GENESIS_PREMINE / emission::FLOWERS_PER_ZION as u128) as u64,
                "mining_emission_atomic": emission::MINING_EMISSION.to_string(),
                "mining_emission_zion": (emission::MINING_EMISSION / emission::FLOWERS_PER_ZION as u128) as u64,
                "mined_so_far_atomic": mined_flowers.to_string(),
                "mined_so_far_zion": (mined_flowers / emission::FLOWERS_PER_ZION as u128) as u64,
                "supply_mined_percent": format!("{:.6}", supply_mined_pct),
                "circulating_supply_atomic": circulating_flowers.to_string(),
                "circulating_supply_zion": (circulating_flowers / emission::FLOWERS_PER_ZION as u128) as u64,
                "remaining_supply_atomic": remaining_flowers.to_string(),
                "remaining_supply_zion": (remaining_flowers / emission::FLOWERS_PER_ZION as u128) as u64,
                "block_reward_atomic": block_reward,
                "block_reward_zion": block_reward as f64 / emission::FLOWERS_PER_ZION as f64,
                "height": height,
            }))
        }));
    }

    // ── submitBlock ────────────────────────────────────────────────────
    {
        let rt = Arc::clone(&runtime);
        router.register("submitBlock", Box::new(move |params: &Value| {
            let template_id = params.get("template_id")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| (INVALID_PARAMS, "missing 'template_id'".into()))?;
            let header_hex = params.get("header_hex")
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing 'header_hex'".into()))?
                .to_string();
            let nonce = params.get("nonce")
                .and_then(|v| v.as_u64())
                .ok_or_else(|| (INVALID_PARAMS, "missing 'nonce'".into()))?;
            let target_hex = params.get("target_hex")
                .and_then(|v| v.as_str())
                .ok_or_else(|| (INVALID_PARAMS, "missing 'target_hex'".into()))?
                .to_string();
            let mut rt = rt.lock().map_err(|_| (INTERNAL_ERROR, "runtime lock poisoned".into()))?;
            let resp = rt.handle_rpc_request(crate::RpcRequest::SubmitCandidate {
                template_id,
                header_hex,
                nonce,
                target_hex,
            });
            match resp {
                crate::RpcResponse::SubmitResult { accepted, template_id, block_height, hash_hex, reason } => {
                    Ok(json!({
                        "accepted": accepted,
                        "template_id": template_id,
                        "block_height": block_height,
                        "hash_hex": hash_hex,
                        "reason": reason,
                    }))
                }
                _ => Err((INTERNAL_ERROR, "unexpected response".into())),
            }
        }));
    }

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

    /// Create a stub router for tests that don't need real node state.
    fn stub_node_router() -> RpcRouter {
        let mut router = RpcRouter::new();
        let stub = |method_name: &'static str| -> HandlerFn {
            Box::new(move |_params: &Value| {
                Err((INTERNAL_ERROR, format!("{method_name}: stub")))
            })
        };
        for method in [
            "getBalance", "getAccountBalance", "getBlock", "getBlockByHeight", "getTransaction",
            "getAccountTransaction", "sendRawTransaction", "submitTransaction", "submitAccountTransaction", "getBlockTemplate", "getMempoolInfo",
            "getPeerInfo", "getChainInfo", "getNodeInfo", "submitBlock", "getUtxos", "getSupplyInfo",
            "getBalanceAtHeight", "getBridgeLocks", "getBridgeVaultBalance", "submitBridgeUnlock",
        ] {
            router.register(method, stub(method));
        }
        router
    }

    #[test]
    fn node_router_has_priority_methods() {
        let router = stub_node_router();
        assert!(router.has_method("getBalance"));
        assert!(router.has_method("getAccountBalance"));
        assert!(router.has_method("getBlock"));
        assert!(router.has_method("getBlockByHeight"));
        assert!(router.has_method("getTransaction"));
        assert!(router.has_method("getAccountTransaction"));
        assert!(router.has_method("sendRawTransaction"));
        assert!(router.has_method("submitTransaction"));
        assert!(router.has_method("submitAccountTransaction"));
        assert!(router.has_method("getBlockTemplate"));
        assert!(router.has_method("getMempoolInfo"));
        assert!(router.has_method("getPeerInfo"));
        assert!(router.has_method("getChainInfo"));
        assert!(router.has_method("getNodeInfo"));
        assert!(router.has_method("submitBlock"));
        assert!(router.has_method("getUtxos"));
        assert!(router.has_method("getSupplyInfo"));
        assert!(router.has_method("getBalanceAtHeight"));
        assert!(router.has_method("getBridgeLocks"));
        assert!(router.has_method("getBridgeVaultBalance"));
        assert!(router.has_method("submitBridgeUnlock"));
        assert_eq!(router.method_count(), 21);
    }

    #[test]
    fn node_router_stubs_return_error() {
        let router = stub_node_router();
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

    // ── Live router integration tests ──────────────────────────────────

    fn live_router() -> RpcRouter {
        use std::sync::{Arc, Mutex};
        let runtime = Arc::new(Mutex::new(
            crate::NodeRuntime::new("rpc-test", crate::NodeConfig::mainnet()),
        ));
        build_node_router(runtime)
    }

    fn bridge_unlock_ready_router(amount: u64) -> RpcRouter {
        use std::sync::{Arc, Mutex};

        let mut runtime = crate::NodeRuntime::new("rpc-test", crate::NodeConfig::mainnet());
        let funding = {
            let mut transaction = crate::tx::Transaction {
                id: [0u8; 32],
                version: 1,
                inputs: vec![],
                outputs: vec![crate::tx::TxOutput {
                    amount,
                    address: fee::BRIDGE_VAULT_ADDRESS.to_string(),
                    memo: None,
                }],
                fee: 0,
                timestamp: 1_700_000_000,
            };
            transaction.finalize_id();
            transaction
        };

        let funding_block = crate::AcceptedBlock {
            template_id: 1,
            height: 1,
            timestamp: crate::now_secs(),
            difficulty: crate::difficulty::GENESIS_DIFFICULTY,
            nonce: 0,
            hash_hex: crate::hex(&[0x11; 32]),
            header_hex: String::new(),
            previous_hash_hex: runtime.accepted_blocks()[0].hash_hex.clone(),
            transaction_ids: vec![],
            transactions: vec![],
            total_fees_zion: 0,
            body_hash_hex: crate::body_hash_hex(&[]),
            subsidy_zion: crate::emission::block_subsidy(1),
            miner_reward_zion: crate::emission::block_subsidy(1),
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            utxo_transaction_ids: vec![crate::hex(&funding.id)],
            utxo_transactions: vec![funding],
        };

        let imported = runtime.import_peer_blocks(vec![funding_block]);
        assert!(matches!(imported, Ok(1)));

        build_node_router(Arc::new(Mutex::new(runtime)))
    }

    fn rpc_call(router: &RpcRouter, method: &str, params: Value) -> RpcResponse {
        router.handle_request(&RpcRequest {
            jsonrpc: "2.0".into(),
            method: method.into(),
            params,
            id: json!(1),
        })
    }

    #[test]
    fn live_get_chain_info() {
        let router = live_router();
        let resp = rpc_call(&router, "getChainInfo", json!(null));
        assert!(resp.error.is_none(), "getChainInfo failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["chain_height"], 0);
        assert!(result["network"].is_string());
        assert!(result["consensus_profile"].is_string());
        assert_eq!(result["transaction_model"], ACTIVE_TRANSACTION_MODEL);
    }

    #[test]
    fn live_get_node_info() {
        let router = live_router();
        let resp = rpc_call(&router, "getNodeInfo", json!(null));
        assert!(resp.error.is_none(), "getNodeInfo failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["node_id"], "rpc-test");
        assert!(result["protocol_version"].is_string());
        assert!(result["known_peers"].is_number());
        assert_eq!(result["transaction_model"], ACTIVE_TRANSACTION_MODEL);
    }

    #[test]
    fn live_get_block_by_height_genesis() {
        let router = live_router();
        let resp = rpc_call(&router, "getBlockByHeight", json!({"height": 0}));
        assert!(resp.error.is_none(), "getBlockByHeight(0) failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["height"], 0);
        assert!(result["hash_hex"].is_string());
    }

    #[test]
    fn live_get_block_by_height_not_found() {
        let router = live_router();
        let resp = rpc_call(&router, "getBlockByHeight", json!({"height": 9999}));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, BLOCK_NOT_FOUND);
    }

    #[test]
    fn live_get_block_by_hash() {
        let router = live_router();
        // First get genesis block hash
        let resp = rpc_call(&router, "getBlockByHeight", json!({"height": 0}));
        let genesis_hash = resp.result.unwrap()["hash_hex"].as_str().unwrap().to_string();
        // Now fetch by hash
        let resp = rpc_call(&router, "getBlock", json!({"hash": genesis_hash}));
        assert!(resp.error.is_none(), "getBlock by hash failed: {:?}", resp.error);
        assert_eq!(resp.result.unwrap()["height"], 0);
    }

    #[test]
    fn live_get_balance_empty() {
        let router = live_router();
        let resp = rpc_call(&router, "getBalance", json!({"account": "wallet.alpha"}));
        assert!(resp.error.is_none());
        let result = resp.result.unwrap();
        assert_eq!(result["balance_zion"], 0);
        assert_eq!(result["transaction_model"], ACTIVE_TRANSACTION_MODEL);
    }

    #[test]
    fn live_get_balance_returns_zero_for_unknown_utxo_address() {
        let router = live_router();
        let resp = rpc_call(&router, "getBalance", json!({"address": "zion1nobody000000000000000000000000000000000"}));
        assert!(resp.error.is_none(), "getBalance for zion1 failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["balance_flowers"], 0);
        assert_eq!(result["transaction_model"], "utxo");
    }

    #[test]
    fn live_get_account_balance_alias_works() {
        let router = live_router();
        let resp = rpc_call(&router, "getAccountBalance", json!({"account": "wallet.alpha"}));
        assert!(resp.error.is_none(), "getAccountBalance failed: {:?}", resp.error);
        assert_eq!(resp.result.unwrap()["account_id"], "wallet.alpha");
    }

    #[test]
    fn live_get_block_template() {
        let router = live_router();
        let resp = rpc_call(&router, "getBlockTemplate", json!(null));
        assert!(resp.error.is_none(), "getBlockTemplate failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert!(result["template_id"].is_number());
        assert!(result["height"].is_number());
        assert!(result["header_hex"].is_string());
    }

    #[test]
    fn live_get_mempool_info() {
        let router = live_router();
        let resp = rpc_call(&router, "getMempoolInfo", json!(null));
        assert!(resp.error.is_none());
        let result = resp.result.unwrap();
        assert_eq!(result["size"], 0);
    }

    #[test]
    fn live_get_peer_info() {
        let router = live_router();
        let resp = rpc_call(&router, "getPeerInfo", json!(null));
        assert!(resp.error.is_none());
        let result = resp.result.unwrap();
        assert!(result["count"].is_number());
        assert!(result["peers"].is_array());
    }

    #[test]
    fn live_get_transaction_not_found() {
        let router = live_router();
        let resp = rpc_call(&router, "getTransaction", json!({"txid": "nonexistent"}));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, TX_NOT_FOUND);
    }

    #[test]
    fn live_get_account_transaction_alias_not_found() {
        let router = live_router();
        let resp = rpc_call(&router, "getAccountTransaction", json!({"txid": "nonexistent"}));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, TX_NOT_FOUND);
    }

    #[test]
    fn live_send_raw_transaction_invalid() {
        let router = live_router();
        let resp = rpc_call(&router, "sendRawTransaction", json!({"bad": true}));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, INVALID_PARAMS);
    }

    #[test]
    fn live_send_raw_transaction_rejects_hex_string_payload() {
        let router = live_router();
        let resp = rpc_call(&router, "sendRawTransaction", json!("deadbeef"));
        assert!(resp.error.is_some());
        let err = resp.error.unwrap();
        assert_eq!(err.code, INVALID_PARAMS);
        assert!(err.message.contains("transaction object"));
    }

    #[test]
    fn live_submit_transaction_rejects_utxo_payload() {
        let router = live_router();
        let resp = rpc_call(&router, "submitTransaction", json!({
            "id": vec![0u8; 32],
            "version": 1,
            "inputs": [{
                "prev_tx_hash": vec![1u8; 32],
                "output_index": 0,
                "signature": vec![2u8; 64],
                "public_key": vec![3u8; 32]
            }],
            "outputs": [{
                "amount": 1000,
                "address": "zion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"
            }],
            "fee": 100,
            "timestamp": 1700000000
        }));
        assert!(resp.error.is_some());
        let err = resp.error.unwrap();
        assert_eq!(err.code, TX_REJECTED);
        assert!(err.message.contains("UTXO transaction"));
    }

    #[test]
    fn live_submit_transaction_alias_accepts_object_payload() {
        let router = live_router();
        let resp = rpc_call(&router, "submitTransaction", json!({
            "tx_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "from": "wallet.alpha",
            "to": "wallet.beta",
            "amount_zion": 25,
            "fee_zion": 5,
            "nonce": 1
        }));
        assert!(resp.error.is_none(), "submitTransaction failed: {:?}", resp.error);
        assert_eq!(resp.result.unwrap()["accepted"], true);
    }

    #[test]
    fn live_submit_account_transaction_alias_accepts_object_payload() {
        let router = live_router();
        let resp = rpc_call(&router, "submitAccountTransaction", json!({
            "tx_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "from": "wallet.alpha",
            "to": "wallet.beta",
            "amount_zion": 30,
            "fee_zion": 5,
            "nonce": 1
        }));
        assert!(resp.error.is_none(), "submitAccountTransaction failed: {:?}", resp.error);
        assert_eq!(resp.result.unwrap()["accepted"], true);
    }

    #[test]
    fn live_router_method_count() {
        let router = live_router();
        assert_eq!(router.method_count(), 21);
    }

    #[test]
    fn live_get_supply_info() {
        let router = live_router();
        let resp = rpc_call(&router, "getSupplyInfo", json!(null));
        assert!(resp.error.is_none(), "getSupplyInfo failed: {:?}", resp.error);
        let r = resp.result.unwrap();
        assert_eq!(r["total_supply_zion"], 144_000_000_000u64);
        assert_eq!(r["premine_zion"], 16_280_000_000u64);
        assert_eq!(r["mining_emission_zion"], 127_720_000_000u64);
        assert_eq!(r["height"], 0);
        assert!(r["block_reward_atomic"].as_u64().unwrap() > 0);
        assert!(r["total_supply_atomic"].is_string());
        assert!(r["circulating_supply_atomic"].is_string());
    }

    #[test]
    fn live_supply_emission_invariant() {
        let router = live_router();
        let resp = rpc_call(&router, "getSupplyInfo", json!(null));
        let r = resp.result.unwrap();
        let total: u128 = r["total_supply_atomic"].as_str().unwrap().parse().unwrap();
        let premine: u128 = r["premine_atomic"].as_str().unwrap().parse().unwrap();
        let emission: u128 = r["mining_emission_atomic"].as_str().unwrap().parse().unwrap();
        assert_eq!(emission, total - premine);
    }

    #[test]
    fn live_get_utxos_returns_empty_for_unknown_address() {
        let router = live_router();
        let resp = rpc_call(&router, "getUtxos", json!({"address": "zion1nobody000000000000000000000000000000000"}));
        assert!(resp.error.is_none(), "getUtxos failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["count"], 0);
        assert_eq!(result["total_amount"], 0);
        assert!(result["utxos"].as_array().unwrap().is_empty());
    }

    #[test]
    fn live_get_utxos_rejects_account_address() {
        let router = live_router();
        let resp = rpc_call(&router, "getUtxos", json!({"address": "wallet.alpha"}));
        assert!(resp.error.is_some());
        let err = resp.error.unwrap();
        assert_eq!(err.code, INVALID_ADDRESS);
    }

    #[test]
    fn live_get_balance_at_height_genesis() {
        let router = live_router();
        let resp = rpc_call(&router, "getBalanceAtHeight", json!({
            "account": "wallet.alpha",
            "height": 0
        }));
        assert!(resp.error.is_none(), "getBalanceAtHeight failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["height"], 0);
        assert_eq!(result["balance_zion"], 0);
    }

    #[test]
    fn live_get_bridge_locks_empty_at_genesis() {
        let router = live_router();
        let resp = rpc_call(&router, "getBridgeLocks", json!({
            "from_height": 0,
            "to_height": 0
        }));
        assert!(resp.error.is_none(), "getBridgeLocks failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["count"], 0);
        assert!(result["locks"].as_array().unwrap().is_empty());
    }

    #[test]
    fn live_get_bridge_vault_balance_defaults_to_zero() {
        let router = live_router();
        let resp = rpc_call(&router, "getBridgeVaultBalance", json!(null));
        assert!(resp.error.is_none(), "getBridgeVaultBalance failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["address"], fee::BRIDGE_VAULT_ADDRESS);
        assert_eq!(result["balance_flowers"], 0);
    }

    #[test]
    fn live_submit_bridge_unlock_rejects_when_vault_is_empty() {
        let router = live_router();
        let recipient = crate::crypto::derive_address(&[7u8; 32]);
        let resp = rpc_call(&router, "submitBridgeUnlock", json!({
            "recipient": recipient,
            "amount_flowers": 1_000_000_000_000u64,
            "burn_id": "burn-empty",
            "evm_chain": "base-sepolia",
            "evm_tx_hash": "0xempty",
            "validator_proofs": [
                {"validator_id": "v1", "signature": "0x11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111", "synthetic": false},
                {"validator_id": "v2", "signature": "synthetic-proof-slot", "synthetic": true},
                {"validator_id": "v3", "signature": "synthetic-proof-slot", "synthetic": true}
            ]
        }));
        assert!(resp.error.is_some());
        let err = resp.error.unwrap();
        assert_eq!(err.code, TX_REJECTED);
        assert!(err.message.contains("insufficient"));
    }

    #[test]
    fn live_submit_bridge_unlock_accepts_funded_vault_request() {
        let router = bridge_unlock_ready_router(2_000_000_000_000);
        let recipient = crate::crypto::derive_address(&[9u8; 32]);
        let resp = rpc_call(&router, "submitBridgeUnlock", json!({
            "recipient": recipient,
            "amount_flowers": 1_000_000_000_000u64,
            "burn_id": "burn-1",
            "evm_chain": "base-sepolia",
            "evm_tx_hash": "0xabc123",
            "validator_proofs": [
                {"validator_id": "v1", "signature": "0x11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111", "synthetic": false},
                {"validator_id": "v2", "signature": "synthetic-proof-slot", "synthetic": true},
                {"validator_id": "v3", "signature": "synthetic-proof-slot", "synthetic": true}
            ]
        }));
        assert!(resp.error.is_none(), "submitBridgeUnlock failed: {:?}", resp.error);
        let result = resp.result.unwrap();
        assert_eq!(result["accepted"], true);
        assert!(result["tx_id"].as_str().is_some());
    }

    #[test]
    fn live_submit_bridge_unlock_rejects_replay_key_reuse() {
        let router = bridge_unlock_ready_router(3_000_000_000_000);
        let recipient = crate::crypto::derive_address(&[11u8; 32]);
        let params = json!({
            "recipient": recipient,
            "amount_flowers": 1_000_000_000_000u64,
            "burn_id": "burn-replay",
            "evm_chain": "base-sepolia",
            "evm_tx_hash": "0xreplay",
            "validator_proofs": [
                {"validator_id": "v1", "signature": "0x11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111", "synthetic": false},
                {"validator_id": "v2", "signature": "synthetic-proof-slot", "synthetic": true},
                {"validator_id": "v3", "signature": "synthetic-proof-slot", "synthetic": true}
            ]
        });

        let first = rpc_call(&router, "submitBridgeUnlock", params.clone());
        assert!(first.error.is_none(), "initial unlock failed: {:?}", first.error);

        let second = rpc_call(&router, "submitBridgeUnlock", params);
        assert!(second.error.is_some());
        let err = second.error.unwrap();
        assert_eq!(err.code, TX_REJECTED);
        assert!(err.message.contains("replay key"));
    }
}
