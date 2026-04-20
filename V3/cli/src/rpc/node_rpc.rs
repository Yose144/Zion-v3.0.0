use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

/// Send one JSON-RPC request over raw TCP to the V3 core node (port 8443).
/// The wire format is: JSON object + newline → JSON object + newline.
pub async fn call(host: &str, port: u16, method: &str, params: Value) -> Result<Value> {
    let addr = format!("{}:{}", host, port);
    let stream = TcpStream::connect(&addr)
        .await
        .with_context(|| format!("Cannot connect to node at {}", addr))?;

    let (reader, mut writer) = stream.into_split();

    let request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    });
    let mut line = serde_json::to_string(&request)?;
    line.push('\n');
    writer.write_all(line.as_bytes()).await?;
    writer.flush().await?;

    let mut buf_reader = BufReader::new(reader);
    let mut response_line = String::new();
    buf_reader.read_line(&mut response_line).await?;

    let response: Value = serde_json::from_str(response_line.trim())
        .context("Invalid JSON response from node")?;

    if let Some(err) = response.get("error") {
        if !err.is_null() {
            bail!("Node RPC error: {}", err);
        }
    }

    Ok(response["result"].clone())
}

/// Convenience: call with empty params
pub async fn call0(host: &str, port: u16, method: &str) -> Result<Value> {
    call(host, port, method, json!({})).await
}
