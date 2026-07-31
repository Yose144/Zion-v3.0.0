use std::net::SocketAddr;

use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

/// Parse an RPC URL into a TCP socket address.
///
/// Accepts `http://host:port`, `host:port` or `host` (defaulting to 9443).
pub fn parse_rpc_addr(rpc_url: &str) -> Result<SocketAddr> {
    let s = rpc_url.trim();
    let s = s
        .strip_prefix("http://")
        .or(s.strip_prefix("https://"))
        .unwrap_or(s);
    let s = s.split_once('/').map(|(h, _)| h).unwrap_or(s);

    if let Ok(addr) = s.parse::<SocketAddr>() {
        return Ok(addr);
    }
    if !s.contains(':') {
        return format!("{}:9443", s)
            .parse::<SocketAddr>()
            .with_context(|| format!("invalid RPC address: {}", rpc_url));
    }
    Err(anyhow!("invalid RPC address: {}", rpc_url))
}

/// Send a single JSON-RPC request over TCP and return the parsed response.
pub async fn jsonrpc_call(addr: SocketAddr, request: &Value) -> Result<Value> {
    let mut stream = TcpStream::connect(addr)
        .await
        .with_context(|| format!("failed to connect to {}", addr))?;

    let payload = format!("{}\n", request);
    stream
        .write_all(payload.as_bytes())
        .await
        .with_context(|| "failed to write RPC request")?;
    stream.flush().await?;

    let (reader, _) = stream.split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .with_context(|| "failed to read RPC response")?;

    serde_json::from_str(&line).with_context(|| "failed to parse RPC response")
}
