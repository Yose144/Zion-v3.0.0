//! F2: Stratum v1 protocol support.
//!
//! Implements a minimal Stratum v1 listener that runs alongside the native
//! ZION wire protocol on the same TCP port.  Protocol detection happens on
//! the first line: JSON with a `"method"` field is Stratum v1, JSON with a
//! `"type"` field is the native ZION protocol.
//!
//! ## Supported messages
//!
//! Miner → Pool:
//! - `mining.subscribe`  → returns subscription + extranonce1
//! - `mining.authorize`  → username = `WALLET.worker` (anonymous mining)
//! - `mining.submit`     → share submission
//! - `mining.suggest_difficulty` (optional) → vardiff hint
//!
//! Pool → Miner:
//! - `mining.set_difficulty` → share difficulty target
//! - `mining.notify`         → job dispatch (simplified 5-param format)
//!
//! ## Simplified `mining.notify` format
//!
//! Standard Stratum v1 notify uses 9 params (coinbase1/coinbase2/merkle).
//! We use a **simplified 5-param format** because the pool already assembles
//! the full block header:
//!
//! ```json
//! {"method":"mining.notify","params":[job_id, header_hex, target_hex, height, clean_jobs]}
//! ```
//!
//! This is NOT compatible with unmodified external miners (ccminer/xmrig).
//! It is designed for:
//! 1. Our own `zion-miner` in Stratum v1 mode
//! 2. Future AuxPow proxy mode (F2.5+) where upstream notify params are
//!    forwarded verbatim
//! 3. Miner developers who want to add ZION support

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, Write};
use std::time::Instant;

use anyhow::{anyhow, Context, Result};

use zion_core::MiningJob;

// ---------------------------------------------------------------------------
// JSON-RPC framing
// ---------------------------------------------------------------------------

/// A Stratum v1 JSON-RPC request (miner → pool).
#[derive(Debug, Clone, Deserialize)]
pub struct StratumRequest {
    /// Request id (number or null for notifications).
    pub id: Value,
    /// Method name: `mining.subscribe`, `mining.authorize`, `mining.submit`, etc.
    pub method: String,
    /// Method parameters (array or object).
    #[serde(default)]
    pub params: Value,
}

/// A Stratum v1 JSON-RPC response (pool → miner).
#[derive(Debug, Clone, Serialize)]
pub struct StratumResponse {
    pub id: Value,
    pub result: Value,
    pub error: Option<Value>,
}

/// A Stratum v1 notification (pool → miner, id = null).
#[derive(Debug, Clone, Serialize)]
pub struct StratumNotification {
    /// Always null for server-pushed notifications.
    pub id: Option<Value>,
    pub method: String,
    pub params: Value,
}

// ---------------------------------------------------------------------------
// Protocol detection
// ---------------------------------------------------------------------------

/// Detect whether the first line is Stratum v1 or native ZION wire protocol.
///
/// Stratum v1: `{"id":1,"method":"mining.subscribe","params":[...]}`
/// ZION wire:  `{"type":"Hello","miner_id":"...","algorithm":"..."}`
///
/// Returns `true` if the line looks like Stratum v1 (has a `"method"` field).
pub fn is_stratum_v1(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return false;
    }
    // Quick substring check before full JSON parse (perf).
    if !trimmed.contains("\"method\"") {
        return false;
    }
    // Verify it's valid JSON with a method field.
    match serde_json::from_str::<Value>(trimmed) {
        Ok(v) => v.get("method").and_then(|m| m.as_str()).is_some(),
        Err(_) => false,
    }
}

// ---------------------------------------------------------------------------
// Codec — read/write Stratum v1 JSON-RPC lines
// ---------------------------------------------------------------------------

/// Read a single Stratum v1 request line from the reader.
pub fn read_stratum_request(reader: &mut impl BufRead) -> Result<StratumRequest> {
    let mut line = String::new();
    let n = reader.read_line(&mut line).context("stratum read failed")?;
    if n == 0 {
        return Err(anyhow!("peer closed connection"));
    }
    let req: StratumRequest =
        serde_json::from_str(line.trim()).context("failed to parse stratum request")?;
    Ok(req)
}

/// Write a JSON-RPC response to the writer.
pub fn write_stratum_response(writer: &mut impl Write, resp: &StratumResponse) -> Result<()> {
    let mut line = serde_json::to_string(resp)?;
    line.push('\n');
    writer
        .write_all(line.as_bytes())
        .context("stratum write failed")?;
    writer.flush().context("stratum flush failed")?;
    Ok(())
}

/// Write a JSON-RPC notification (server push) to the writer.
pub fn write_stratum_notification(
    writer: &mut impl Write,
    notif: &StratumNotification,
) -> Result<()> {
    let mut line = serde_json::to_string(notif)?;
    line.push('\n');
    writer
        .write_all(line.as_bytes())
        .context("stratum notify write failed")?;
    writer.flush().context("stratum notify flush failed")?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

/// Per-session state for a Stratum v1 connection.
pub struct StratumV1Session {
    /// Extranonce1 = session id as hex (8 chars = 4 bytes).
    pub extranonce1_hex: String,
    /// Extranonce2 size in bytes (default 4).
    pub extranonce2_size: u32,
    /// Whether the miner has authorized.
    pub authorized: bool,
    /// Miner id (wallet address) from mining.authorize username.
    pub miner_id: String,
    /// Worker name (suffix after `.` in username).
    pub worker_name: String,
    /// Algorithm advertised by the miner (from subscribe params, optional).
    pub algorithm: String,
    /// Backend type for telemetry: "cpu", "opencl", "cuda", "metal".
    pub backend: String,
    /// Current share difficulty (set by mining.set_difficulty).
    pub share_difficulty: u64,
    /// Map of Stratum job_id (string) → ZION job_id (u64) for submit translation.
    pub job_id_map: std::collections::HashMap<String, u64>,
    /// Session start time.
    pub started_at: Instant,
}

impl StratumV1Session {
    pub fn new(session_id: u64) -> Self {
        Self {
            extranonce1_hex: format!("{:08x}", session_id & 0xFFFFFFFF),
            extranonce2_size: 4,
            authorized: false,
            miner_id: String::new(),
            worker_name: String::new(),
            algorithm: String::new(),
            backend: String::new(),
            share_difficulty: 1,
            job_id_map: std::collections::HashMap::new(),
            started_at: Instant::now(),
        }
    }

    /// Parse username `WALLET.worker` or just `WALLET` into (miner_id, worker_name).
    pub fn parse_username(username: &str) -> (String, String) {
        if let Some(dot) = username.find('.') {
            let (wallet, worker) = username.split_at(dot);
            (wallet.to_string(), worker[1..].to_string())
        } else {
            (username.to_string(), "default".to_string())
        }
    }

    /// Register a job mapping and return the Stratum job_id string.
    pub fn register_job(&mut self, zion_job_id: u64, height: u64) -> String {
        // Use height as the Stratum job_id string (stable across reconnects).
        let stratum_id = format!("j{}", height);
        self.job_id_map.insert(stratum_id.clone(), zion_job_id);
        // Prune old mappings (keep last 32).
        if self.job_id_map.len() > 32 {
            // HashMap doesn't have order — just clear if too large.
            // In practice jobs are replaced by new height IDs.
            let keys: Vec<String> = self.job_id_map.keys().take(16).cloned().collect();
            for k in keys {
                self.job_id_map.remove(&k);
            }
            self.job_id_map.insert(stratum_id.clone(), zion_job_id);
        }
        stratum_id
    }

    /// Resolve a Stratum job_id string back to ZION job_id.
    pub fn resolve_job(&self, stratum_id: &str) -> Option<u64> {
        self.job_id_map.get(stratum_id).copied()
    }
}

// ---------------------------------------------------------------------------
// Notify builder — convert ZION MiningJob to Stratum v1 mining.notify
// ---------------------------------------------------------------------------

/// Build a simplified `mining.notify` notification from a ZION MiningJob.
///
/// Format: `[job_id, header_hex, target_hex, height, clean_jobs]`
pub fn build_mining_notify(
    job: &MiningJob,
    stratum_job_id: &str,
    clean_jobs: bool,
) -> StratumNotification {
    let header_hex = hex::encode(&job.header.to_bytes());
    let target_hex = hex::encode(&job.target.bytes);
    StratumNotification {
        id: None,
        method: "mining.notify".to_string(),
        params: json!([
            stratum_job_id,
            header_hex,
            target_hex,
            job.height,
            clean_jobs
        ]),
    }
}

/// Build a `mining.set_difficulty` notification.
pub fn build_set_difficulty(difficulty: u64) -> StratumNotification {
    StratumNotification {
        id: None,
        method: "mining.set_difficulty".to_string(),
        params: json!([difficulty]),
    }
}

// ---------------------------------------------------------------------------
// Submit parser — convert mining.submit to PoolMessage::Submit
// ---------------------------------------------------------------------------

/// Parse `mining.submit` params into a ZION share submission.
///
/// Expected params (simplified 4-param format):
/// `[worker_name, job_id, nonce_hex, hash_hex]`
///
/// Also accepts standard 5-param format (with extranonce2 + time):
/// `[worker_name, job_id, extranonce2, time, nonce_hex, ...]`
pub fn parse_mining_submit(
    params: &Value,
    session: &StratumV1Session,
) -> Result<(u64, u64, String)> {
    let arr = params
        .as_array()
        .ok_or_else(|| anyhow!("mining.submit params must be an array"))?;

    if arr.len() < 4 {
        return Err(anyhow!(
            "mining.submit requires at least 4 params, got {}",
            arr.len()
        ));
    }

    // worker_name (arr[0]) — ignored, we use session identity
    let job_id_str = arr[1]
        .as_str()
        .ok_or_else(|| anyhow!("mining.submit job_id must be a string"))?;

    // For our simplified format: [worker, job_id, nonce_hex, hash_hex]
    // For standard format: [worker, job_id, extranonce2, time, nonce, ...]
    // Detect by checking if arr[2] is a hex nonce (our format) or extranonce2 (theirs).
    let (nonce, hash_hex) = if arr.len() == 4 {
        // Simplified: [worker, job_id, nonce_hex, hash_hex]
        let nonce_hex = arr[2]
            .as_str()
            .ok_or_else(|| anyhow!("mining.submit nonce must be a string"))?;
        let hash = arr[3]
            .as_str()
            .ok_or_else(|| anyhow!("mining.submit hash must be a string"))?;
        let nonce = u64::from_str_radix(nonce_hex.trim_start_matches("0x"), 16)
            .context("failed to parse nonce hex")?;
        (nonce, hash.to_string())
    } else {
        // Standard 5+ param: [worker, job_id, extranonce2, time, nonce, ...]
        // nonce is arr[4] in standard format
        let nonce_hex = arr
            .get(4)
            .and_then(|v| v.as_str())
            .or_else(|| arr.get(2).and_then(|v| v.as_str())) // fallback to arr[2]
            .ok_or_else(|| anyhow!("mining.submit: cannot find nonce param"))?;
        let nonce = u64::from_str_radix(nonce_hex.trim_start_matches("0x"), 16)
            .context("failed to parse nonce hex")?;
        // hash_hex — some protocols don't send it; use empty string
        let hash = arr.get(5).and_then(|v| v.as_str()).unwrap_or("");
        (nonce, hash.to_string())
    };

    let zion_job_id = session
        .resolve_job(job_id_str)
        .ok_or_else(|| anyhow!("unknown stratum job_id: {}", job_id_str))?;

    Ok((zion_job_id, nonce, hash_hex))
}

// ---------------------------------------------------------------------------
// Hex encoding helper (avoid pulling in hex crate dependency)
// ---------------------------------------------------------------------------

mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        let mut s = String::with_capacity(bytes.len() * 2);
        for b in bytes {
            s.push_str(&format!("{:02x}", b));
        }
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_stratum_v1_detects_method_field() {
        assert!(is_stratum_v1(
            r#"{"id":1,"method":"mining.subscribe","params":[]}"#
        ));
        assert!(!is_stratum_v1(r#"{"type":"Hello","miner_id":"abc"}"#));
        assert!(!is_stratum_v1(""));
        assert!(!is_stratum_v1("not json at all"));
    }

    #[test]
    fn parse_username_splits_wallet_and_worker() {
        let (wallet, worker) = StratumV1Session::parse_username("zion1abc.rig1");
        assert_eq!(wallet, "zion1abc");
        assert_eq!(worker, "rig1");
    }

    #[test]
    fn parse_username_no_dot_defaults_worker() {
        let (wallet, worker) = StratumV1Session::parse_username("zion1abc");
        assert_eq!(wallet, "zion1abc");
        assert_eq!(worker, "default");
    }

    #[test]
    fn job_id_map_roundtrip() {
        let mut sess = StratumV1Session::new(42);
        let sid = sess.register_job(100, 10920);
        assert_eq!(sid, "j10920");
        assert_eq!(sess.resolve_job("j10920"), Some(100));
        assert_eq!(sess.resolve_job("j9999"), None);
    }

    #[test]
    fn parse_mining_submit_simplified_format() {
        let mut sess = StratumV1Session::new(1);
        sess.register_job(100, 10920);
        let params = json!(["rig1", "j10920", "ff00aabb", "abcd1234"]);
        let (job_id, nonce, hash) = parse_mining_submit(&params, &sess).unwrap();
        assert_eq!(job_id, 100);
        assert_eq!(nonce, 0xff00aabb);
        assert_eq!(hash, "abcd1234");
    }

    #[test]
    fn parse_mining_submit_standard_format() {
        let mut sess = StratumV1Session::new(1);
        sess.register_job(100, 10920);
        let params = json!(["rig1", "j10920", "00000001", "5f3a1b2c", "ff00aabb", "abcd"]);
        let (job_id, nonce, _hash) = parse_mining_submit(&params, &sess).unwrap();
        assert_eq!(job_id, 100);
        assert_eq!(nonce, 0xff00aabb);
    }

    #[test]
    fn read_stratum_request_parses_json() {
        let input = b"{\"id\":1,\"method\":\"mining.subscribe\",\"params\":[\"agent/1.0\"]}\n";
        let mut reader = std::io::BufReader::new(&input[..]);
        let req = read_stratum_request(&mut reader).unwrap();
        assert_eq!(req.method, "mining.subscribe");
        assert_eq!(req.id, json!(1));
    }
}
