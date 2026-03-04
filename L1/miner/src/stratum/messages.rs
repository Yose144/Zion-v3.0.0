use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StratumRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jsonrpc: Option<String>,
    pub id: u64,
    pub method: String,
    pub params: Value,
}

impl StratumRequest {
    /// Create login request
    pub fn login(id: u64, wallet: &str, worker: &str, pass: &str, algorithm: &str) -> Self {
        Self {
            jsonrpc: Some("2.0".to_string()),
            id,
            method: "login".to_string(),
            params: serde_json::json!({
                "login": wallet,
                "pass": pass,
                "rigid": worker,
                "agent": "zion-universal-miner/2.9.6",
                "algo": algorithm
            }),
        }
    }

    /// Create subscribe request (Stratum)
    pub fn subscribe(id: u64) -> Self {
        Self {
            jsonrpc: Some("2.0".to_string()),
            id,
            method: "mining.subscribe".to_string(),
            params: serde_json::json!([]),
        }
    }

    /// Create authorize request (Stratum)
    pub fn authorize(id: u64, username: &str, password: &str) -> Self {
        Self {
            jsonrpc: Some("2.0".to_string()),
            id,
            method: "mining.authorize".to_string(),
            params: serde_json::json!([username, password]),
        }
    }

    /// Create submit request
    pub fn submit(id: u64, session_id: &str, job_id: &str, nonce: u32, result: &str) -> Self {
        Self {
            jsonrpc: Some("2.0".to_string()),
            id,
            method: "submit".to_string(),
            params: serde_json::json!({
                "id": session_id,
                "job_id": job_id,
                "nonce": format!("{:08x}", nonce),
                "result": result
            }),
        }
    }

    /// Create submit request (Stratum)
    pub fn submit_stratum(
        id: u64,
        worker: &str,
        job_id: &str,
        nonce_hex: &str,
        result: &str,
    ) -> Self {
        // Submit with result hash for CH v3 revenue stream forwarding.
        // Pool extracts result from params[5] and forwards it to external pools
        // (MoneroOcean/CryptoNote requires the result hash for share validation).
        Self {
            jsonrpc: Some("2.0".to_string()),
            id,
            method: "mining.submit".to_string(),
            params: serde_json::json!([worker, job_id, "00", "00000000", nonce_hex, result]),
        }
    }

    /// Create keepalive request
    pub fn keepalive(id: u64, session_id: &str) -> Self {
        Self {
            jsonrpc: Some("2.0".to_string()),
            id,
            method: "keepalived".to_string(),
            params: serde_json::json!({
                "id": session_id
            }),
        }
    }

    /// Create getjob request (XMRig protocol)
    pub fn getjob(id: u64) -> Self {
        Self {
            jsonrpc: Some("2.0".to_string()),
            id,
            method: "getjob".to_string(),
            params: serde_json::json!({}),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StratumResponse {
    pub id: Option<u64>,
    pub result: Option<Value>,
    pub error: Option<StratumError>,
    pub method: Option<String>,
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StratumError {
    pub code: i32,
    pub message: String,
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub job_id: String,
    pub blob: String,
    pub target: String,
    pub height: u64,
    pub seed_hash: Option<String>,
    pub algo: Option<String>,
    /// Coin being mined (e.g., "ZION", "ERG", "ETC") — set by StreamScheduler v2
    #[serde(default)]
    pub coin: Option<String>,
    #[serde(default)]
    pub cosmic_state0_endian: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_login_request_structure() {
        let req = StratumRequest::login(1, "zion1abc", "rig01", "x", "cosmic_harmony_v3");
        assert_eq!(req.method, "login");
        assert_eq!(req.id, 1);
        assert_eq!(req.jsonrpc, Some("2.0".to_string()));
        assert_eq!(req.params["login"], "zion1abc");
        assert_eq!(req.params["rigid"], "rig01");
        assert_eq!(req.params["pass"], "x");
        assert_eq!(req.params["algo"], "cosmic_harmony_v3");
        assert!(req.params["agent"].as_str().unwrap().contains("zion"));
    }

    #[test]
    fn test_subscribe_request() {
        let req = StratumRequest::subscribe(2);
        assert_eq!(req.method, "mining.subscribe");
        assert_eq!(req.id, 2);
        assert!(req.params.is_array());
        assert_eq!(req.params.as_array().unwrap().len(), 0);
    }

    #[test]
    fn test_authorize_request() {
        let req = StratumRequest::authorize(3, "wallet.worker", "pwd");
        assert_eq!(req.method, "mining.authorize");
        let params = req.params.as_array().unwrap();
        assert_eq!(params[0], "wallet.worker");
        assert_eq!(params[1], "pwd");
    }

    #[test]
    fn test_submit_request_nonce_format() {
        let req = StratumRequest::submit(4, "sess1", "job1", 255, "result_hash");
        assert_eq!(req.method, "submit");
        assert_eq!(req.params["nonce"], "000000ff");
        assert_eq!(req.params["job_id"], "job1");
        assert_eq!(req.params["result"], "result_hash");
    }

    #[test]
    fn test_submit_stratum_request() {
        let req = StratumRequest::submit_stratum(5, "w1", "j1", "deadbeef", "res");
        assert_eq!(req.method, "mining.submit");
        let params = req.params.as_array().unwrap();
        assert_eq!(params.len(), 6);
        assert_eq!(params[0], "w1");
        assert_eq!(params[1], "j1");
        assert_eq!(params[4], "deadbeef");
        assert_eq!(params[5], "res");
    }

    #[test]
    fn test_keepalive_request() {
        let req = StratumRequest::keepalive(6, "sess-abc");
        assert_eq!(req.method, "keepalived");
        assert_eq!(req.params["id"], "sess-abc");
    }

    #[test]
    fn test_getjob_request() {
        let req = StratumRequest::getjob(7);
        assert_eq!(req.method, "getjob");
        assert!(req.params.is_object());
        assert_eq!(req.params.as_object().unwrap().len(), 0);
    }

    #[test]
    fn test_all_requests_have_jsonrpc_2_0() {
        let requests = vec![
            StratumRequest::login(1, "w", "r", "p", "a"),
            StratumRequest::subscribe(2),
            StratumRequest::authorize(3, "u", "p"),
            StratumRequest::submit(4, "s", "j", 0, "r"),
            StratumRequest::submit_stratum(5, "w", "j", "n", "r"),
            StratumRequest::keepalive(6, "s"),
            StratumRequest::getjob(7),
        ];
        for req in requests {
            assert_eq!(
                req.jsonrpc,
                Some("2.0".to_string()),
                "Missing jsonrpc 2.0 on method: {}",
                req.method
            );
        }
    }

    #[test]
    fn test_stratum_request_serde_roundtrip() {
        let req = StratumRequest::login(1, "w", "r", "p", "a");
        let json = serde_json::to_string(&req).unwrap();
        let back: StratumRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(back.method, "login");
        assert_eq!(back.id, 1);
    }

    #[test]
    fn test_stratum_response_deserialization() {
        let json = r#"{"id": 1, "result": {"status": "OK"}, "error": null}"#;
        let resp: StratumResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.id, Some(1));
        assert!(resp.error.is_none());
        assert_eq!(resp.result.as_ref().unwrap()["status"], "OK");
    }

    #[test]
    fn test_stratum_error_deserialization() {
        let json =
            r#"{"id": 1, "result": null, "error": {"code": -1, "message": "invalid share"}}"#;
        let resp: StratumResponse = serde_json::from_str(json).unwrap();
        let err = resp.error.unwrap();
        assert_eq!(err.code, -1);
        assert_eq!(err.message, "invalid share");
    }

    #[test]
    fn test_job_deserialization_all_fields() {
        let json = r#"{
            "job_id": "j1", "blob": "aabb", "target": "ffff",
            "height": 42, "seed_hash": "00ff", "algo": "ethash",
            "coin": "ETC"
        }"#;
        let job: Job = serde_json::from_str(json).unwrap();
        assert_eq!(job.job_id, "j1");
        assert_eq!(job.height, 42);
        assert_eq!(job.algo.as_deref(), Some("ethash"));
        assert_eq!(job.coin.as_deref(), Some("ETC"));
    }

    #[test]
    fn test_job_deserialization_minimal() {
        let json = r#"{"job_id": "j1", "blob": "", "target": "", "height": 0}"#;
        let job: Job = serde_json::from_str(json).unwrap();
        assert!(job.seed_hash.is_none());
        assert!(job.algo.is_none());
        assert!(job.coin.is_none());
    }
}
