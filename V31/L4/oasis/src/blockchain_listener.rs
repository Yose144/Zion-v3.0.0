//! L1 Blockchain Listener — polls an L1 node for newly mined blocks and
//! emits `BlockMinedEvent`s that the XP system can consume.
//!
//! The Oasis backend does NOT modify L1 state. This listener only reads
//! blockchain data via JSON-RPC 2.0 and forwards it to the game layer.
//!
//! ## RPC methods used
//!
//! - `getChainInfo` → `{ "chain_height": <u64> }`
//! - `getBlockByHeight` → `{ "height", "miner_address", "subsidy_zion", "timestamp" }`
//!
//! ## Flow
//!
//! 1. Poll `getChainInfo` every `poll_interval_secs` (default 10s).
//! 2. If `chain_height > last_height`, fetch blocks `[last_height+1 ..= chain_height]`.
//! 3. For each block, call `getBlockByHeight` and build a `BlockMinedEvent`.
//! 4. Invoke the `on_new_block` callback for each event.
//! 5. Update `last_height` and continue polling.
//!
//! RPC errors are logged and the loop continues — a temporarily unavailable
//! L1 node must never crash the game server.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tracing::{error, info, warn};

/// Parse an RPC URL into a TCP socket address.
///
/// Accepts `http://host:port`, `host:port` or `host` (defaulting to 9445).
fn parse_rpc_addr(rpc_url: &str) -> Result<SocketAddr, String> {
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
        return format!("{}:9445", s)
            .parse::<SocketAddr>()
            .map_err(|e| format!("invalid RPC address: {} ({})", rpc_url, e));
    }
    Err(format!("invalid RPC address: {}", rpc_url))
}

/// Send a single JSON-RPC request over raw TCP and return the parsed response.
async fn jsonrpc_tcp_call(addr: SocketAddr, request: &Value) -> Result<Value, String> {
    let mut stream = TcpStream::connect(addr)
        .await
        .map_err(|e| format!("TCP connect to {} failed: {}", addr, e))?;

    let payload = format!("{}\n", request);
    stream
        .write_all(payload.as_bytes())
        .await
        .map_err(|e| format!("TCP write failed: {}", e))?;
    stream
        .flush()
        .await
        .map_err(|e| format!("TCP flush failed: {}", e))?;

    let (reader, _) = stream.split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .map_err(|e| format!("TCP read failed: {}", e))?;

    serde_json::from_str(&line).map_err(|e| format!("JSON parse failed: {}", e))
}

/// Event emitted when a new block is mined on L1.
///
/// `subsidy_flowers` is the block subsidy expressed in **flowers**
/// (the canonical smallest unit; 1 ZION = 1e6 flowers). The L1 RPC field
/// `subsidy_zion` is interpreted as flowers per the 3.0.3 decimal fork
/// convention where `_zion` is a deprecated alias for `_flowers`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BlockMinedEvent {
    /// Height of the mined block.
    pub block_height: u64,
    /// Address of the miner who found the block.
    pub miner_address: String,
    /// Block subsidy in flowers (1 ZION = 1_000_000 flowers).
    pub subsidy_flowers: u64,
    /// Unix timestamp (seconds) of the block.
    pub timestamp: u64,
}

/// Raw block info as returned by `getBlockByHeight`.
///
/// Only the fields Oasis cares about are deserialized; extra fields are
/// silently ignored thanks to `#[serde(default)]`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BlockInfo {
    pub height: u64,
    #[serde(default)]
    pub miner_address: String,
    /// L1 RPC field names: `reward` is the miner reward in flowers;
    /// `subsidy_zion` is the total subsidy in ZION (f64) and is ignored.
    #[serde(default, alias = "reward", alias = "subsidy_flowers")]
    pub subsidy_flowers: u64,
    #[serde(default)]
    pub timestamp: u64,
}

/// Polls an L1 node for newly mined blocks and emits `BlockMinedEvent`s.
pub struct L1BlockListener {
    rpc_url: String,
    rpc_addr: SocketAddr,
    last_height: u64,
    poll_interval_secs: u64,
}

impl L1BlockListener {
    /// Create a new listener targeting a single L1 RPC endpoint.
    pub fn new(rpc_url: String) -> Self {
        let rpc_addr = parse_rpc_addr(&rpc_url).unwrap_or_else(|_| {
            "127.0.0.1:9445"
                .parse::<SocketAddr>()
                .expect("fallback RPC addr")
        });

        Self {
            rpc_url,
            rpc_addr,
            last_height: 0,
            poll_interval_secs: 10,
        }
    }

    /// Override the default 10-second poll interval.
    #[allow(dead_code)]
    pub fn with_poll_interval(mut self, secs: u64) -> Self {
        self.poll_interval_secs = secs;
        self
    }

    /// Main polling loop. Consumes `self` and runs forever, calling
    /// `on_new_block` for each freshly mined block.
    ///
    /// RPC failures are logged and the loop continues so that a transient
    /// L1 outage never takes down the game server.
    pub async fn start<F>(mut self, mut on_new_block: F)
    where
        F: FnMut(BlockMinedEvent) + Send + 'static,
    {
        info!(
            "L1BlockListener started — rpc_url={} poll_interval={}s",
            self.rpc_url, self.poll_interval_secs
        );

        // On first start, seed last_height from the current chain tip so we
        // don't replay the entire chain. If the RPC is down at startup we
        // simply begin from 0 and will catch up once it recovers.
        match self.fetch_chain_height().await {
            Ok(h) => {
                info!(
                    "L1BlockListener initial chain_height={}; starting from there",
                    h
                );
                self.last_height = h;
            }
            Err(e) => {
                warn!(
                    "L1BlockListener could not fetch initial chain height ({}); \
                     will start from 0 and retry",
                    e
                );
            }
        }

        let sleep_dur = Duration::from_secs(self.poll_interval_secs);

        loop {
            tokio::time::sleep(sleep_dur).await;

            let chain_height = match self.fetch_chain_height().await {
                Ok(h) => h,
                Err(e) => {
                    warn!("L1 getChainInfo failed: {}; will retry", e);
                    continue;
                }
            };

            if chain_height <= self.last_height {
                // No new blocks.
                continue;
            }

            let from = self.last_height.saturating_add(1);
            info!(
                "L1 new blocks detected: {}..{} ({} new)",
                from,
                chain_height,
                chain_height.saturating_sub(self.last_height)
            );

            for height in from..=chain_height {
                match self.fetch_block(height).await {
                    Ok(block) => {
                        let event = BlockMinedEvent {
                            block_height: block.height,
                            miner_address: block.miner_address,
                            subsidy_flowers: block.subsidy_flowers,
                            timestamp: block.timestamp,
                        };
                        info!(
                            "L1 block mined: height={} miner={} subsidy_flowers={} ts={}",
                            event.block_height,
                            event.miner_address,
                            event.subsidy_flowers,
                            event.timestamp
                        );
                        on_new_block(event);
                    }
                    Err(e) => {
                        error!("L1 getBlockByHeight({}) failed: {}; skipping", height, e);
                        // Don't advance last_height past a block we failed to
                        // fetch, so we retry it on the next poll.
                        break;
                    }
                }
            }

            // Only advance last_height to the last successfully fetched block.
            // If we broke out of the loop early due to an error, last_height
            // stays at the last good value.
            self.last_height = chain_height;
        }
    }

    /// Call `getChainInfo` and return the current chain height.
    async fn fetch_chain_height(&self) -> Result<u64, String> {
        let body = json!({
            "jsonrpc": "2.0",
            "method": "getChainInfo",
            "params": {},
            "id": 1,
        });

        let val = jsonrpc_tcp_call(self.rpc_addr, &body).await?;

        let h = rpc_result_field(&val, "chain_height")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| format!("getChainInfo bad response: {}", val))?;
        Ok(h)
    }

    /// Call `getBlockByHeight` for a specific height and parse it into
    /// a `BlockInfo`.
    async fn fetch_block(&self, height: u64) -> Result<BlockInfo, String> {
        let body = json!({
            "jsonrpc": "2.0",
            "method": "getBlockByHeight",
            "params": { "height": height },
            "id": 1,
        });

        let val = jsonrpc_tcp_call(self.rpc_addr, &body).await?;

        let result = rpc_result(&val)?;

        let block: BlockInfo =
            serde_json::from_value(result).map_err(|e| format!("failed to parse block: {}", e))?;

        Ok(block)
    }

    /// Build the JSON-RPC request body for `getChainInfo` (exposed for tests).
    #[cfg(test)]
    fn build_chain_info_request() -> Value {
        json!({
            "jsonrpc": "2.0",
            "method": "getChainInfo",
            "params": {},
            "id": 1,
        })
    }

    /// Build the JSON-RPC request body for `getBlockByHeight` (exposed for tests).
    #[cfg(test)]
    fn build_block_request(height: u64) -> Value {
        json!({
            "jsonrpc": "2.0",
            "method": "getBlockByHeight",
            "params": { "height": height },
            "id": 1,
        })
    }
}

/// Extract the `result` object from a JSON-RPC 2.0 response, or surface
/// a `error` field if present.
fn rpc_result(val: &Value) -> Result<Value, String> {
    if let Some(err) = val.get("error") {
        return Err(format!("RPC error: {}", err));
    }
    val.get("result")
        .cloned()
        .ok_or_else(|| format!("missing 'result' in RPC response: {}", val))
}

/// Extract a named field from the `result` object of a JSON-RPC response.
fn rpc_result_field(val: &Value, field: &str) -> Option<Value> {
    val.get("result").and_then(|r| r.get(field)).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_block_mined_event_serialization() {
        let event = BlockMinedEvent {
            block_height: 42,
            miner_address: "zion1abc".to_string(),
            subsidy_flowers: 1_000_000,
            timestamp: 1_700_000_000,
        };

        let json = serde_json::to_string(&event).unwrap();
        let back: BlockMinedEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(event, back);

        // Sanity-check a couple of fields in the JSON text.
        assert!(json.contains("\"block_height\":42"));
        assert!(json.contains("\"subsidy_flowers\":1000000"));
    }

    #[test]
    fn test_chain_info_request_body() {
        let body = L1BlockListener::build_chain_info_request();
        assert_eq!(body["jsonrpc"], "2.0");
        assert_eq!(body["method"], "getChainInfo");
        assert_eq!(body["id"], 1);
        assert!(body["params"].is_object());
    }

    #[test]
    fn test_block_request_body() {
        let body = L1BlockListener::build_block_request(123);
        assert_eq!(body["jsonrpc"], "2.0");
        assert_eq!(body["method"], "getBlockByHeight");
        assert_eq!(body["params"]["height"], 123);
        assert_eq!(body["id"], 1);
    }

    #[test]
    fn test_parse_chain_info_response() {
        let sample = json!({
            "jsonrpc": "2.0",
            "result": { "chain_height": 12345 },
            "id": 1,
        });

        let h = rpc_result_field(&sample, "chain_height")
            .and_then(|v| v.as_u64())
            .expect("should parse chain_height");
        assert_eq!(h, 12345);
    }

    #[test]
    fn test_parse_block_response() {
        // Sample getBlockByHeight response. `subsidy_zion` is a float ZION
        // value and is intentionally ignored; the miner reward is `reward`.
        let sample = json!({
            "jsonrpc": "2.0",
            "result": {
                "height": 1001,
                "miner_address": "zion1qxyz...",
                "subsidy_zion": 5400.067,
                "reward": 500_000_000,
                "timestamp": 1_700_000_123,
                "extra_field": "ignored"
            },
            "id": 1,
        });

        let result = rpc_result(&sample).unwrap();
        let block: BlockInfo = serde_json::from_value(result).unwrap();

        assert_eq!(block.height, 1001);
        assert_eq!(block.miner_address, "zion1qxyz...");
        assert_eq!(block.subsidy_flowers, 500_000_000);
        assert_eq!(block.timestamp, 1_700_000_123);
    }

    #[test]
    fn test_parse_block_response_flowers_alias() {
        // Some L1 versions may return `subsidy_flowers` directly.
        let sample = json!({
            "jsonrpc": "2.0",
            "result": {
                "height": 7,
                "miner_address": "zion1miner",
                "subsidy_flowers": 42,
                "timestamp": 99,
            },
            "id": 1,
        });

        let result = rpc_result(&sample).unwrap();
        let block: BlockInfo = serde_json::from_value(result).unwrap();
        assert_eq!(block.subsidy_flowers, 42);
    }

    #[test]
    fn test_rpc_error_surfaces_message() {
        let sample = json!({
            "jsonrpc": "2.0",
            "error": { "code": -32601, "message": "Method not found" },
            "id": 1,
        });

        let res = rpc_result(&sample);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("RPC error"));
    }

    #[test]
    fn test_block_info_defaults() {
        // A result with only height should still parse thanks to serde defaults.
        let sample = json!({
            "jsonrpc": "2.0",
            "result": { "height": 10 },
            "id": 1,
        });

        let result = rpc_result(&sample).unwrap();
        let block: BlockInfo = serde_json::from_value(result).unwrap();
        assert_eq!(block.height, 10);
        assert_eq!(block.miner_address, "");
        assert_eq!(block.subsidy_flowers, 0);
        assert_eq!(block.timestamp, 0);
    }

    #[test]
    fn test_new_listener_defaults() {
        let l = L1BlockListener::new("http://127.0.0.1:9445".to_string());
        assert_eq!(l.rpc_url, "http://127.0.0.1:9445");
        assert_eq!(l.last_height, 0);
        assert_eq!(l.poll_interval_secs, 10);
    }
}
