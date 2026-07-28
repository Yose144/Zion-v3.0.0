use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use zion_core::node::BlockTemplate as CoreBlockTemplate;
use zion_core::{Block, BlockHeader};
use zion_cosmic_harmony::ExternalCoin;

use crate::config::PoolConfig;
use crate::pool::{Pool, PoolError};
use crate::share::ShareSubmission;

/// Stored job data: pow header bytes, network target, block reward (flowers),
/// and the full node template needed to rebuild the solved block.
type JobEntry = (Vec<u8>, [u8; 32], u64, Option<CoreBlockTemplate>);

#[derive(Clone)]
pub struct StratumServer {
    pub pool: Arc<Mutex<Pool>>,
    pub config: PoolConfig,
    /// Stored jobs: job_id -> (header bytes, 32-byte network target, reward, template).
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
            "mining.authorize" => {
                let username = params
                    .get(0)
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !username.is_empty() {
                    self.pool.lock().unwrap().register_worker(&username);
                }
                success_response(id, Value::Bool(true))
            }
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

        let (header, target, reward, template) = {
            let jobs = self.jobs.lock().unwrap();
            match jobs.get(&job_id) {
                Some((h, t, r, tpl)) => (h.clone(), *t, *r, tpl.clone()),
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
                self.check_and_record_block(&job_id, &header, nonce, &target, reward, template);
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

    fn check_and_record_block(
        &self,
        job_id: &str,
        header: &[u8],
        nonce: u64,
        target: &[u8; 32],
        block_reward: u64,
        template: Option<CoreBlockTemplate>,
    ) {
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
        if !is_block {
            return;
        }

        let block_height = template.as_ref().map(|t| t.height).unwrap_or(0);
        pool.on_block_found(block_height, block_reward);

        if let (Some(rpc_url), Some(tpl)) = (pool.config.l1_rpc_url.clone(), template) {
            let block = match build_solved_block(tpl, nonce) {
                Ok(b) => b,
                Err(e) => {
                    tracing::warn!("failed to build solved block for {}: {}", job_id, e);
                    return;
                }
            };
            let job_id = job_id.to_string();
            tokio::spawn(async move {
                if let Err(e) = submit_block_rpc(&rpc_url, &block).await {
                    tracing::warn!("submitBlock failed for {}: {}", job_id, e);
                }
            });
        }
    }

    /// Build and store a `mining.notify` message for the given job.
    pub fn job_notification(
        &self,
        job_id: &str,
        header_hex: &str,
        target_hex: &str,
        block_reward: u64,
        template_json: &str,
    ) -> String {
        let header_trim = header_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        let target = parse_target_hex(target_hex).unwrap_or([0xFF; 32]);
        let template: Option<CoreBlockTemplate> = if template_json.is_empty() {
            None
        } else {
            match serde_json::from_str(template_json) {
                Ok(t) => Some(t),
                Err(e) => {
                    tracing::warn!("failed to parse block template for {}: {}", job_id, e);
                    None
                }
            }
        };

        if let Ok(bytes) = hex::decode(header_trim) {
            self.jobs
                .lock()
                .unwrap()
                .insert(job_id.to_string(), (bytes, target, block_reward, template));
        }

        json!({
            "id": null,
            "method": "mining.notify",
            "params": [job_id, header_hex, target_hex, true]
        })
        .to_string()
    }

    /// Broadcast a `mining.notify` message to all connected clients.
    pub fn broadcast_job(
        &self,
        job_id: &str,
        header_hex: &str,
        target_hex: &str,
        block_reward: u64,
        template_json: &str,
    ) {
        let msg =
            self.job_notification(job_id, header_hex, target_hex, block_reward, template_json);
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

    /// Periodically fetch `getTemplate` from the node RPC and broadcast
    /// `mining.notify` to all connected miners. Runs until `shutdown` fires.
    pub async fn template_feed_loop(
        &self,
        rpc_url: String,
        miner_address: String,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) {
        if rpc_url.is_empty() {
            tracing::warn!("template_feed_loop: no l1_rpc_url configured, skipping");
            return;
        }

        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("failed to build HTTP client for template feed: {}", e);
                return;
            }
        };

        let interval = Duration::from_secs(15);
        let mut job_counter: u64 = 0u64;
        let mut first = true;

        loop {
            let sleep_fut = if first {
                first = false;
                tokio::time::sleep(Duration::from_secs(2))
            } else {
                tokio::time::sleep(interval)
            };

            tokio::select! {
                _ = shutdown.changed() => break,
                _ = sleep_fut => {
                    job_counter += 1;
                    let job_id = format!("zion_{}", job_counter);

                    let payload = json!({
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getTemplate",
                        "params": { "miner_address": miner_address },
                    });

                    match client.post(&rpc_url).json(&payload).send().await {
                        Ok(resp) => {
                            match resp.json::<Value>().await {
                                Ok(v) => {
                                    if let Some(err) = v.get("error") {
                                        if !err.is_null() {
                                            tracing::warn!("getTemplate error: {}", err);
                                            continue;
                                        }
                                    }
                                    let result = v.get("result").unwrap_or(&Value::Null);
                                    let header_hex = result.get("header_hex")
                                        .and_then(Value::as_str)
                                        .unwrap_or("");
                                    let target_hex = result.get("target_hex")
                                        .and_then(Value::as_str)
                                        .unwrap_or("");
                                    let reward = result.get("block_reward")
                                        .and_then(Value::as_u64)
                                        .unwrap_or(0);
                                    let template_json = serde_json::to_string(result).unwrap_or_default();

                                    if !header_hex.is_empty() {
                                        tracing::info!(job = %job_id, "broadcasting mining.notify");
                                        self.broadcast_job(&job_id, header_hex, target_hex, reward, &template_json);
                                    }
                                }
                                Err(e) => tracing::warn!("getTemplate JSON parse failed: {}", e),
                            }
                        }
                        Err(e) => tracing::warn!("getTemplate request failed: {}", e),
                    }
                }
            }
        }
    }
}

fn build_solved_block(tpl: CoreBlockTemplate, nonce: u64) -> Result<Block, serde_json::Error> {
    let mut header: BlockHeader = serde_json::from_str(&tpl.header_json)?;
    header.nonce = nonce;
    Ok(Block::new(header, tpl.transactions))
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

async fn submit_block_rpc(rpc_url: &str, block: &Block) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "submitBlock",
        "params": serde_json::to_value(block).expect("block serializes"),
    });
    let response: serde_json::Value = client
        .post(rpc_url)
        .json(&payload)
        .send()
        .await?
        .json()
        .await?;
    tracing::info!("submitBlock response: {}", response);
    Ok(())
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
        server.job_notification("zion_1", &header, &target, 6_000_000, "");
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
        server.job_notification("aux_bitcoin_1", &header, &target, 6_000_000, "");
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
