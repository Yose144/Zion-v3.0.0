//! Quantus (QTC) native stratum dialect — miningcore/XMRig-style JSON-RPC.
//!
//! External QPoW miners (SRBMiner-MULTI `--algorithm quantus`, upstream
//! pools such as lproute/k1pool) do NOT speak classic bitcoin Stratum V1 —
//! they use the CryptoNote-style line-delimited JSON-RPC protocol:
//!
//! ```text
//!   miner → pool : {"id":N,"method":"login","params":{"login":"wallet.worker",
//!                     "pass":"x","agent":"SRBMiner-MULTI/x.y.z"}}
//!   pool → miner : {"id":N,"result":{"extensions":["keepalive"],
//!                     "id":"<session>","job":{...},"status":"OK"},"error":null}
//!   pool → miner : {"jsonrpc":"2.0","method":"job","params":{
//!                     "clean_jobs":true,"job":{...}}}
//!   miner → pool : {"id":N,"method":"submit","params":{"id":"<session>",
//!                     "job_id":"...","nonce":"<128-hex>","result":"<128-hex>"}}
//!   pool → miner : {"id":N,"result":{"status":"OK"}}
//!                | {"id":N,"error":{"code":-1,"message":"<reason>"}}
//!   miner → pool : {"id":N,"method":"keepalive","params":{"id":"<session>"}}
//!   pool → miner : {"id":N,"result":{"status":"KEEPALIVED"}}
//! ```
//!
//! Job object fields (observed live on lproute + implemented in
//! `zion_miner::auxpow::client::QuantusStratum`):
//!   `algo`        "qpow-poseidon2"
//!   `difficulty`  numeric — display-only (target is authoritative)
//!   `extranonce`  hex prefix embedded in the miner's 64-byte nonce space
//!   `job_id`      opaque string echoed back on submit
//!   `mining_hash` 32-byte header hash (64 hex)
//!   `seq`         monotonically increasing job sequence
//!   `target`      64-byte big-endian U512 share target (128 hex)
//!
//! Shares: `nonce`/`result` are each 64 bytes hex (128 chars). The pool
//! validates `get_nonce_hash(header, nonce) < target` for native jobs and
//! forwards upstream jobs to the upstream pool — exactly like the V3
//! `external_submit` path.
//!
//! Wire compatibility is deliberately kept to upstream semantics — the same
//! messages unmodified SRBMiner exchanges with lproute/k1pool work here.

use serde_json::{json, Value};

use crate::auxpow_bridge::JobPackage;

/// Detect the XMRig/CryptoNote `login` handshake.
///
/// IMPORTANT: `is_stratum_v1` matches ANY message with a `"method"` field,
/// so this check must run BEFORE it — a `login` line currently falls into
/// the V1 handler and dies on "method not found".
pub fn is_qtu_stratum(line: &str) -> bool {
    let trimmed = line.trim();
    // Cheap substring gate before the full parse.
    if !trimmed.contains("\"login\"") {
        return false;
    }
    match serde_json::from_str::<Value>(trimmed) {
        Ok(v) => v.get("method").and_then(|m| m.as_str()) == Some("login"),
        Err(_) => false,
    }
}

/// Parsed `login` params.
#[derive(Debug, Clone, PartialEq)]
pub struct QtuLogin {
    /// Raw `login` string — `wallet.worker` (upstream convention; the
    /// wallet may itself contain no dots).
    pub login: String,
    /// Payout identity — substring before the LAST '.', else the whole
    /// login when no worker suffix is present.
    pub wallet: String,
    /// Worker label after the last '.', empty when absent.
    pub worker: String,
    pub pass: String,
    pub agent: String,
}

pub fn parse_login(line: &str) -> Option<(Value, QtuLogin)> {
    let v: Value = serde_json::from_str(line.trim()).ok()?;
    if v.get("method").and_then(|m| m.as_str()) != Some("login") {
        return None;
    }
    let id = v.get("id").cloned().unwrap_or(Value::Null);
    let params = v.get("params").cloned().unwrap_or_else(|| json!({}));
    let login = params
        .get("login")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if login.is_empty() {
        return None;
    }
    // wallet.worker — split at the LAST dot so wallets/workers containing
    // dots keep the longest sensible prefix as wallet.
    let (wallet, worker) = match login.rfind('.') {
        Some(i) => (login[..i].to_string(), login[i + 1..].to_string()),
        None => (login.clone(), String::new()),
    };
    Some((
        id,
        QtuLogin {
            login,
            wallet,
            worker,
            pass: params
                .get("pass")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            agent: params
                .get("agent")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        },
    ))
}

/// Parsed `submit` params — the QPoW share fields.
#[derive(Debug, Clone, PartialEq)]
pub struct QtuSubmit {
    /// RPC id to echo in the response.
    pub id: Value,
    pub session_id: String,
    pub job_id: String,
    /// 64-byte nonce, 128 hex chars (extranonce prefix included).
    pub nonce_hex: String,
    /// 64-byte QPoW output hash, 128 hex chars.
    pub result_hex: String,
}

/// Parse one client line. Returns `(id, parsed)` — `id` is needed even for
/// malformed submits so the response can echo it.
pub fn parse_submit(line: &str) -> Option<(Value, Option<QtuSubmit>)> {
    let v: Value = serde_json::from_str(line.trim()).ok()?;
    let id = v.get("id").cloned().unwrap_or(Value::Null);
    match v.get("method").and_then(|m| m.as_str()) {
        Some("submit") => {
            let p = v.get("params").cloned().unwrap_or_else(|| json!({}));
            let sub = QtuSubmit {
                id: id.clone(),
                session_id: p
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                job_id: p
                    .get("job_id")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                nonce_hex: p
                    .get("nonce")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                result_hex: p
                    .get("result")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
            };
            Some((id, Some(sub)))
        }
        Some(_) => Some((id, None)),
        None => None,
    }
}

/// JobPackage → wire `job` object. `extranonce` is per-session (upstream
/// model: session-scoped prefix; shares echo the full 64-byte nonce so the
/// prefix needs no pool-side bookkeeping).
pub fn job_wire(pkg: &JobPackage, extranonce: &str, seq: u64) -> Value {
    json!({
        "algo": "qpow-poseidon2",
        "difficulty": target_to_difficulty(&pkg.target_hex),
        "extranonce": extranonce,
        "job_id": pkg.external_job_id,
        "mining_hash": pkg.header_hex,
        "seq": seq,
        "target": pkg.target_hex,
    })
}

/// Login response: `{"id":N,"result":{extensions,id,[job],status},"error":null}`
pub fn login_ok(id: &Value, session_id: &str, job: Option<Value>) -> String {
    let mut result = json!({
        "extensions": ["keepalive"],
        "id": session_id,
        "status": "OK",
    });
    if let Some(j) = job {
        result["job"] = j;
    }
    json!({"id": id, "result": result, "error": Value::Null}).to_string()
}

/// Async job push — upstream sends `clean_jobs: true` on every notification
/// (each job supersedes the previous; miners discard stale work).
pub fn job_notify(job: Value) -> String {
    json!({
        "jsonrpc": "2.0",
        "method": "job",
        "params": {"clean_jobs": true, "job": job},
    })
    .to_string()
}

pub fn submit_ok(id: &Value) -> String {
    json!({"id": id, "result": {"status": "OK"}, "error": Value::Null}).to_string()
}

pub fn submit_err(id: &Value, message: &str) -> String {
    json!({
        "id": id,
        "result": Value::Null,
        "error": {"code": -1, "message": message},
    })
    .to_string()
}

pub fn keepalive_ok(id: &Value) -> String {
    json!({"id": id, "result": {"status": "KEEPALIVED"}, "error": Value::Null}).to_string()
}

pub fn rpc_error(id: &Value, message: &str) -> String {
    json!({
        "id": id,
        "result": Value::Null,
        "error": {"code": -1, "message": message},
    })
    .to_string()
}

/// `difficulty` exposed to the miner = floor(U512_MAX / target).
///
/// Display-only (upstream sends 1e10 at a similar-shaped target) — the
/// `target` field is authoritative for share validation. Falls back to 1
/// when the target cannot be parsed so the field is never absent.
pub fn target_to_difficulty(target_hex: &str) -> f64 {
    use num_bigint::BigUint;
    let bytes = match hex::decode(target_hex.trim_start_matches("0x")) {
        Ok(b) if !b.is_empty() && b.len() <= 64 => b,
        _ => return 1.0,
    };
    let target = BigUint::from_bytes_be(&bytes);
    if target == BigUint::from(0u8) {
        return 1.0;
    }
    let max = BigUint::from_bytes_be(&[0xFFu8; 64]);
    let diff = max / target;
    // f64 has 53-bit mantissa — difficulty this size only needs ~15 sig
    // digits for the miner's display.
    diff.iter_u64_digits()
        .rev()
        .fold(0.0f64, |acc, d| acc * 18446744073709551616.0 + d as f64)
        .max(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOGIN: &str = r#"{"id":1,"method":"login","params":{"login":"qzABC123.wallet1","pass":"x","agent":"SRBMiner-MULTI/3.6.9"}}"#;

    #[test]
    fn detects_login_as_qtu_stratum() {
        assert!(is_qtu_stratum(LOGIN));
        assert!(!is_qtu_stratum(
            r#"{"id":1,"method":"mining.subscribe","params":[]}"#
        ));
        assert!(!is_qtu_stratum(r#"{"type":"hello","miner_id":"x"}"#));
        assert!(!is_qtu_stratum("not json"));
        assert!(!is_qtu_stratum(r#"{"method":"job","params":{}}"#));
    }

    #[test]
    fn parses_login_wallet_worker() {
        let (id, l) = parse_login(LOGIN).expect("login parses");
        assert_eq!(id, json!(1));
        assert_eq!(l.wallet, "qzABC123");
        assert_eq!(l.worker, "wallet1");
        assert_eq!(l.agent, "SRBMiner-MULTI/3.6.9");
        // No worker suffix
        let (_, l2) = parse_login(
            r#"{"id":1,"method":"login","params":{"login":"qzSOLO","pass":""}}"#,
        )
        .unwrap();
        assert_eq!(l2.wallet, "qzSOLO");
        assert_eq!(l2.worker, "");
    }

    #[test]
    fn parses_submit_fields() {
        let line = format!(
            r#"{{"id":7,"method":"submit","params":{{"id":"sess-1","job_id":"qtun:42","nonce":"{}","result":"{}"}}}}"#,
            "ab".repeat(64),
            "cd".repeat(64)
        );
        let (id, sub) = parse_submit(&line).expect("submit parses");
        let sub = sub.expect("submit params");
        assert_eq!(id, json!(7));
        assert_eq!(sub.job_id, "qtun:42");
        assert_eq!(sub.nonce_hex.len(), 128);
        assert_eq!(sub.result_hex.len(), 128);
    }

    #[test]
    fn job_wire_shape_matches_upstream() {
        let pkg = JobPackage {
            external_job_id: "qtun:98765".into(),
            coin: zion_cosmic_harmony::ExternalCoin::Quantus,
            header_hex: "aa".repeat(32),
            target_hex: format!("{:0128x}", 1_000_000u64) ,
            height: 98765,
            algorithm: "qpow-poseidon2".into(),
            extranonce1_hex: "00a1d265".into(),
            ntime: String::new(),
            seed_hash_hex: String::new(),
            eq_params: String::new(),
            eq_pers: String::new(),
            received_at: None,
        };
        let j = job_wire(&pkg, "deadbeee", 3);
        assert_eq!(j["algo"], "qpow-poseidon2");
        assert_eq!(j["job_id"], "qtun:98765");
        assert_eq!(j["mining_hash"], "aa".repeat(32));
        assert_eq!(j["extranonce"], "deadbeee");
        assert_eq!(j["seq"], 3);
        assert_eq!(j["target"], pkg.target_hex);
        // diff = U512_MAX / 1e6 ≈ 1.3e148 — just check it's a big number
        assert!(j["difficulty"].as_f64().unwrap() > 1e100);
    }

    #[test]
    fn responses_match_upstream_shapes() {
        let ok = login_ok(&json!(1), "sess-1", Some(json!({"job_id":"j1"})));
        let v: Value = serde_json::from_str(&ok).unwrap();
        assert_eq!(v["result"]["status"], "OK");
        assert_eq!(v["result"]["id"], "sess-1");
        assert_eq!(v["result"]["extensions"], json!(["keepalive"]));
        assert_eq!(v["result"]["job"]["job_id"], "j1");
        assert!(v["error"].is_null());

        let n = job_notify(json!({"job_id":"j2"}));
        let v: Value = serde_json::from_str(&n).unwrap();
        assert_eq!(v["method"], "job");
        assert_eq!(v["params"]["clean_jobs"], true);

        assert!(serde_json::from_str::<Value>(&submit_ok(&json!(2))).unwrap()["result"]["status"] == "OK");
        let e: Value = serde_json::from_str(&submit_err(&json!(3), "low difficulty")).unwrap();
        assert_eq!(e["error"]["message"], "low difficulty");
        assert!(serde_json::from_str::<Value>(&keepalive_ok(&json!(4))).unwrap()["result"]["status"] == "KEEPALIVED");
    }

    #[test]
    fn difficulty_from_target_math() {
        // target = U512_MAX → diff ≈ 1
        let t = "ff".repeat(64);
        let d = target_to_difficulty(&t);
        assert!((d - 1.0).abs() < 0.01);
        // garbage → 1.0 fallback
        assert_eq!(target_to_difficulty("zz"), 1.0);
        assert_eq!(target_to_difficulty(""), 1.0);
        // Realistic: share_target_from_diff(1e9) → back-computes ~1e9
        let st = crate::qtc_native::share_target_from_diff(1_000_000_000);
        let d = target_to_difficulty(&hex::encode(st));
        assert!((d / 1e9 - 1.0).abs() < 0.001, "d={d}");
    }
}
