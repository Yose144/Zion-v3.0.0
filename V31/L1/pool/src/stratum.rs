use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use zion_cosmic_harmony::ExternalCoin;

use crate::config::PoolConfig;
use crate::pool::{Pool, PoolError};
use crate::share::ShareSubmission;

/// Header bytes together with the 32-byte network target for a stratum job.
type JobEntry = (Vec<u8>, [u8; 32]);

#[derive(Clone)]
pub struct StratumServer {
    pub pool: Arc<Mutex<Pool>>,
    pub config: PoolConfig,
    /// Stored jobs: job_id -> (header bytes, 32-byte network target).
    jobs: Arc<Mutex<HashMap<String, JobEntry>>>,
    notify_tx: broadcast::Sender<String>,
}

impl StratumServer {
    pub fn new(pool: Arc<Mutex<Pool>>) -> Self {
        let config = pool.lock().unwrap().config.clone();
        let (notify_tx, _notify_rx) = broadcast::channel(16);
        Self {
            pool,
            config,
            jobs: Arc::new(Mutex::new(HashMap::new())),
            notify_tx,
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
            nonce_hex: nonce_hex.clone(),
        };

        let (header, target) = {
            let jobs = self.jobs.lock().unwrap();
            match jobs.get(&job_id) {
                Some((h, t)) => (h.clone(), *t),
                None => return error_response(Some(id), -32602, "unknown job"),
            }
        };

        let nonce = match Self::parse_nonce(&nonce_hex) {
            Ok(n) => n,
            Err(_) => return error_response(Some(id), -32602, "invalid nonce"),
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
            Ok(true) => {
                self.check_and_record_block(&job_id, &header, nonce, &target);
                success_response(id, Value::Bool(true))
            }
            _ => success_response(id, Value::Bool(false)),
        }
    }

    fn parse_nonce(nonce_hex: &str) -> Result<u64, PoolError> {
        let s = nonce_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        u64::from_str_radix(s, 16).map_err(|_| PoolError::Parse)
    }

    fn check_and_record_block(&self, job_id: &str, header: &[u8], nonce: u64, target: &[u8; 32]) {
        let mut pool = self.pool.lock().unwrap();
        let is_block = if job_id.starts_with("zion_") {
            let hash = pool.validator.zion_hash(header, nonce);
            hash.as_bytes() <= target
        } else if job_id.starts_with("aux_") {
            let coin = parse_aux_coin(job_id);
            let hash = pool.validator.auxpow_hash(coin, header, nonce);
            &hash <= target
        } else {
            false
        };
        if is_block {
            pool.on_block_found(0);
        }
    }

    /// Build and store a `mining.notify` message for the given job.
    pub fn job_notification(&self, job_id: &str, header_hex: &str, target_hex: &str) -> String {
        let header_trim = header_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        let target = parse_target_hex(target_hex).unwrap_or([0xFF; 32]);
        if let Ok(bytes) = hex::decode(header_trim) {
            self.jobs
                .lock()
                .unwrap()
                .insert(job_id.to_string(), (bytes, target));
        }
        json!({
            "id": null,
            "method": "mining.notify",
            "params": [job_id, header_hex, target_hex]
        })
        .to_string()
    }

    /// Broadcast a `mining.notify` message to all connected clients.
    pub fn broadcast_job(&self, job_id: &str, header_hex: &str, target_hex: &str) {
        let msg = self.job_notification(job_id, header_hex, target_hex);
        let _ = self.notify_tx.send(msg);
    }

    pub async fn run(&self, listener: TcpListener) -> std::io::Result<()> {
        loop {
            let (socket, _) = listener.accept().await?;
            let server = self.clone();
            tokio::spawn(async move {
                let (reader, writer) = tokio::io::split(socket);
                let writer = Arc::new(tokio::sync::Mutex::new(writer));
                let mut notify_rx = server.notify_tx.subscribe();

                let reader = BufReader::new(reader);
                let mut lines = reader.lines();

                loop {
                    tokio::select! {
                        line = lines.next_line() => match line {
                            Ok(Some(line)) => {
                                let response = server.handle_request(&line);
                                let mut w = writer.lock().await;
                                if w.write_all(response.as_bytes()).await.is_err() { break; }
                                if w.write_all(b"\n").await.is_err() { break; }
                            }
                            _ => break,
                        },
                        msg = notify_rx.recv() => match msg {
                            Ok(msg) => {
                                let mut w = writer.lock().await;
                                if w.write_all(msg.as_bytes()).await.is_err() { break; }
                                if w.write_all(b"\n").await.is_err() { break; }
                            }
                            Err(_) => break,
                        },
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

fn parse_target_hex(target_hex: &str) -> Option<[u8; 32]> {
    let hex = target_hex
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    if hex.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    hex::decode_to_slice(hex, &mut out).ok()?;
    Some(out)
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
    use std::sync::Arc;

    fn make_server() -> StratumServer {
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default())));
        StratumServer::new(pool)
    }

    #[test]
    fn handles_subscribe() {
        let server = make_server();
        let resp = server.handle_request(r#"{"id":1,"method":"mining.subscribe","params":[]}"#);
        assert!(resp.contains("mining.notify"));
        assert!(resp.contains("\"result\""));
    }

    #[test]
    fn handles_authorize() {
        let server = make_server();
        let resp = server
            .handle_request(r#"{"id":2,"method":"mining.authorize","params":["worker","x"]}"#);
        assert!(resp.contains("true"));
    }

    #[test]
    fn handles_zion_submit() {
        let server = make_server();
        let target = "f".repeat(64);
        let header = "00".repeat(80);
        server.job_notification("zion_1", &header, &target);
        let resp = server.handle_request(
            r#"{"id":3,"method":"mining.submit","params":["worker","zion_1","0000000000000000"]}"#,
        );
        assert!(resp.contains("true"));
    }

    #[test]
    fn handles_auxpow_submit() {
        let server = make_server();
        let target = "f".repeat(64);
        let header = "00".repeat(80);
        server.job_notification("aux_bitcoin_1", &header, &target);
        let resp = server.handle_request(
            r#"{"id":4,"method":"mining.submit","params":["worker","aux_bitcoin_1","0000000000000000"]}"#,
        );
        assert!(resp.contains("true"));
    }

    #[test]
    fn rejects_unknown_job() {
        let server = make_server();
        let resp = server.handle_request(
            r#"{"id":5,"method":"mining.submit","params":["worker","zion_99","0000000000000000"]}"#,
        );
        assert!(resp.contains("unknown job"));
    }
}
