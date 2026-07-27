use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use zion_cosmic_harmony::ExternalCoin;

use crate::config::PoolConfig;
use crate::pool::{Pool, PoolError};
use crate::share::ShareSubmission;

#[derive(Clone)]
pub struct StratumServer {
    pub pool: Arc<Mutex<Pool>>,
    pub config: PoolConfig,
    jobs: Arc<Mutex<HashMap<String, Vec<u8>>>>,
}

impl StratumServer {
    pub fn new(pool: Arc<Mutex<Pool>>) -> Self {
        let config = pool.lock().unwrap().config.clone();
        Self {
            pool,
            config,
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn handle_request(&self, line: &str) -> String {
        let req: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => return error_response(None, -32700, "parse error"),
        };
        let id = req.get("id").cloned().unwrap_or(Value::Null);
        let method = req.get("method").and_then(Value::as_str).unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(Value::Null);

        match method {
            "mining.subscribe" => {
                let result = json!([
                    [
                        ["mining.notify", "ae6812eb4cd7735a302a8a9dd95cf71f"],
                        "08000000"
                    ],
                    "session_id",
                    8
                ]);
                success_response(id, result)
            }
            "mining.authorize" => success_response(id, Value::Bool(true)),
            "mining.submit" => self.handle_submit(id, params),
            _ => error_response(Some(id), -32601, "method not found"),
        }
    }

    fn handle_submit(&self, id: Value, params: Value) -> String {
        let arr = match params.as_array() {
            Some(a) if a.len() >= 3 => a,
            _ => return error_response(Some(id), -32602, "invalid params"),
        };
        let worker = arr[0].as_str().unwrap_or("").to_string();
        let job_id = arr[1].as_str().unwrap_or("").to_string();
        let nonce_hex = arr[2].as_str().unwrap_or("").to_string();
        let submission = ShareSubmission {
            worker,
            job_id: job_id.clone(),
            nonce_hex,
        };

        let header = {
            let jobs = self.jobs.lock().unwrap();
            match jobs.get(&job_id) {
                Some(h) => h.clone(),
                None => return error_response(Some(id), -32602, "unknown job"),
            }
        };

        let result = if job_id.starts_with("zion_") {
            self.pool.lock().unwrap().submit_zion(submission, &header)
        } else if job_id.starts_with("aux_") {
            let coin = parse_aux_coin(&job_id);
            self.pool
                .lock()
                .unwrap()
                .submit_auxpow(coin, submission, &header)
        } else {
            Err(PoolError::UnknownJob)
        };

        match result {
            Ok(true) => success_response(id, Value::Bool(true)),
            _ => success_response(id, Value::Bool(false)),
        }
    }

    pub fn job_notification(&self, job_id: &str, header_hex: &str, target_hex: &str) -> String {
        let trimmed = header_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        if let Ok(bytes) = hex::decode(trimmed) {
            self.jobs.lock().unwrap().insert(job_id.to_string(), bytes);
        }
        json!({
            "id": null,
            "method": "mining.notify",
            "params": [job_id, header_hex, target_hex]
        })
        .to_string()
    }

    pub async fn run(&self, listener: TcpListener) -> std::io::Result<()> {
        loop {
            let (socket, _) = listener.accept().await?;
            let server = self.clone();
            tokio::spawn(async move {
                let (reader, mut writer) = tokio::io::split(socket);
                let reader = BufReader::new(reader);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let response = server.handle_request(&line);
                    if writer.write_all(response.as_bytes()).await.is_err() {
                        break;
                    }
                    if writer.write_all(b"\n").await.is_err() {
                        break;
                    }
                }
            });
        }
    }
}

fn parse_aux_coin(job_id: &str) -> ExternalCoin {
    let parts: Vec<&str> = job_id.split('_').collect();
    if parts.len() >= 2 {
        if let Ok(c) = ExternalCoin::from_str(parts[1]) {
            return c;
        }
    }
    ExternalCoin::Bitcoin
}

fn success_response(id: Value, result: Value) -> String {
    json!({"id": id, "result": result, "error": null}).to_string()
}

fn error_response(id: Option<Value>, code: i32, message: &str) -> String {
    json!({
        "id": id.unwrap_or(Value::Null),
        "result": null,
        "error": [code, message, null]
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_server() -> StratumServer {
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default())));
        StratumServer::new(pool)
    }

    #[test]
    fn handles_subscribe() {
        let server = make_server();
        let req = r#"{"id":1,"method":"mining.subscribe","params":[]}"#;
        let resp = server.handle_request(req);
        assert!(resp.contains("\"result\""));
        assert!(resp.contains("session_id"));
        assert!(resp.contains("\"error\":null"));
    }

    #[test]
    fn handles_authorize() {
        let server = make_server();
        let req = r#"{"id":2,"method":"mining.authorize","params":["worker","x"]}"#;
        let resp = server.handle_request(req);
        assert!(resp.contains("\"result\":true"));
    }

    #[test]
    fn handles_zion_submit() {
        let server = make_server();
        let header = b"zion_test_header";
        server.job_notification("zion_1", &hex::encode(header), "f");
        let nonce_hex = format!("{:016x}", 0u64);
        let req = format!(
            "{{\"id\":3,\"method\":\"mining.submit\",\"params\":[\"worker1\",\"zion_1\",\"{}\"]}}",
            nonce_hex
        );
        let resp = server.handle_request(&req);
        assert!(resp.contains("\"result\":true"), "resp={}", resp);
    }

    #[test]
    fn rejects_submit_for_unknown_job() {
        let server = make_server();
        let req =
            r#"{"id":4,"method":"mining.submit","params":["worker","zion_99","0000000000000000"]}"#;
        let resp = server.handle_request(req);
        assert!(resp.contains("error"));
    }
}
