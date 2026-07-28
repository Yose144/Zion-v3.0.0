//! Minimal JSON-RPC server for the ZION L1 node.
//!
//! The Alpha RPC speaks line-delimited JSON over plain TCP. This avoids a heavy
//! HTTP stack while covering the essential node operations.

use std::net::SocketAddr;
use std::sync::Arc;

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

    // V3 methods are dispatched to the V3 RPC handler.
    let v3_methods = [
        "getStatus",
        "getBlockByHeight",
        "getBlockByHash",
        "getTemplate",
        "submitBlock",
        "submitAccountTransaction",
        "submitUtxoTransaction",
        "getBalance",
        "getUtxos",
    ];
    if v3_methods.contains(&method) {
        let result = node.v3_rpc.dispatch(method, params).await;
        return wrap_v3_response(id, result);
    }

    // Legacy methods (getBlockTemplate, submitTransaction) use the old path.
    let result = match method {
        "getBlockTemplate" => block_template(node, &params).await,
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
        .get("miner")
        .and_then(Value::as_str)
        .unwrap_or("zion1test");
    let miner_addr = zion_l1_types::Address::new(zion_l1_types::ChainId::ZionL1, vec![], miner)
        .map_err(|e| NodeError::Address(e.to_string()))?;
    let template = node.block_template(miner_addr).await?;
    Ok(serde_json::to_value(template)?)
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
