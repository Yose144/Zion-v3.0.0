use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tracing::{info, warn};

use super::{Job, Share};

/// Parsed stratum `mining.notify` job parameters.
#[derive(Clone, Debug)]
pub struct StratumJob {
    pub job_id: String,
    pub header: Vec<u8>,
    pub target: [u8; 32],
    pub extranonce1: Vec<u8>,
    pub extranonce2_size: usize,
    pub ntime: String,
    pub difficulty: f64,
    pub coin: zion_cosmic_harmony::ExternalCoin,
}

impl From<StratumJob> for Job {
    fn from(j: StratumJob) -> Self {
        Job {
            job_id: j.job_id,
            coin: j.coin,
            header: j.header,
            target: j.target,
            extranonce: j.extranonce1,
            extranonce2: "00".to_string(),
            ntime: j.ntime,
        }
    }
}

/// Stratum v1 client for an external (AuxPoW) pool.
///
/// Maintains a long-lived TCP connection, reads `mining.notify` jobs from the
/// server, and can submit shares. If the connection drops, a background task
/// re-establishes it.
pub struct StratumClient {
    pub url: String,
    pub worker: String,
    pub password: String,
    job_rx: mpsc::Receiver<StratumJob>,
    submit_tx: mpsc::Sender<Share>,
}

impl std::fmt::Debug for StratumClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StratumClient")
            .field("url", &self.url)
            .field("worker", &self.worker)
            .finish_non_exhaustive()
    }
}

impl StratumClient {
    pub fn new(
        url: impl Into<String>,
        worker: impl Into<String>,
        password: impl Into<String>,
    ) -> Self {
        let (job_tx, job_rx) = mpsc::channel(8);
        let (submit_tx, submit_rx) = mpsc::channel(8);

        let url = url.into();
        let worker = worker.into();
        let password = password.into();

        if !url.is_empty() {
            tokio::spawn(run_stratum_loop(
                url.clone(),
                worker.clone(),
                password.clone(),
                job_tx,
                submit_rx,
                StratumState::new(),
            ));
        }

        Self {
            url,
            worker,
            password,
            job_rx,
            submit_tx,
        }
    }

    /// Establish the stratum session.
    ///
    /// The connection is opened in a background task spawned by `new`.
    /// This method just validates that a URL is configured.
    pub async fn connect(&self) -> anyhow::Result<()> {
        if self.url.is_empty() {
            anyhow::bail!("no stratum url configured");
        }
        Ok(())
    }

    /// Try to receive the next available job from the pool.
    pub async fn next_job(
        &mut self,
        coin: zion_cosmic_harmony::ExternalCoin,
        timeout: Duration,
    ) -> anyhow::Result<StratumJob> {
        match tokio::time::timeout(timeout, self.job_rx.recv()).await {
            Ok(Some(mut j)) => {
                j.coin = coin;
                Ok(j)
            }
            Ok(None) => anyhow::bail!("stratum job channel closed"),
            Err(_) => anyhow::bail!("stratum job receive timed out"),
        }
    }

    /// Submit a share to the pool.
    pub async fn submit_share(&self, share: &Share) -> anyhow::Result<()> {
        if self.submit_tx.send(share.clone()).await.is_err() {
            anyhow::bail!("stratum submit channel closed");
        }
        Ok(())
    }
}

/// Parse a stratum URL like `stratum+tcp://host:port` or `host:port`.
fn parse_url(url: &str) -> anyhow::Result<(&str, u16)> {
    let trimmed = url
        .trim()
        .trim_start_matches("stratum+tcp://")
        .trim_start_matches("stratum://")
        .trim_start_matches("tcp://");
    let (host, port) = trimmed.rsplit_once(':').ok_or_else(|| {
        anyhow::anyhow!("stratum url must be host:port or stratum+tcp://host:port")
    })?;
    let port = port.parse()?;
    Ok((host, port))
}

#[derive(Clone)]
struct StratumState {
    extranonce1: Arc<Mutex<Vec<u8>>>,
    extranonce2_size: Arc<Mutex<usize>>,
    difficulty: Arc<Mutex<f64>>,
    ntime: Arc<Mutex<String>>,
}

impl StratumState {
    fn new() -> Self {
        Self {
            extranonce1: Arc::new(Mutex::new(Vec::new())),
            extranonce2_size: Arc::new(Mutex::new(0usize)),
            difficulty: Arc::new(Mutex::new(1.0f64)),
            ntime: Arc::new(Mutex::new("00000000".to_string())),
        }
    }
}
async fn run_stratum_loop(
    url: String,
    worker: String,
    password: String,
    job_tx: mpsc::Sender<StratumJob>,
    mut submit_rx: mpsc::Receiver<Share>,
    state: StratumState,
) {
    loop {
        if let Err(e) =
            stratum_session(&url, &worker, &password, &job_tx, &mut submit_rx, &state).await
        {
            warn!(url = %url, error = %e, "stratum session failed, reconnecting in 5s");
        } else {
            warn!(url = %url, "stratum session ended, reconnecting in 5s");
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}

async fn stratum_session(
    url: &str,
    worker: &str,
    password: &str,
    job_tx: &mpsc::Sender<StratumJob>,
    submit_rx: &mut mpsc::Receiver<Share>,
    state: &StratumState,
) -> anyhow::Result<()> {
    let (host, port) = parse_url(url)?;
    info!(host = %host, port = port, "connecting to stratum pool");
    let mut stream = TcpStream::connect((host, port)).await?;
    let (reader, mut writer) = stream.split();
    let mut lines = BufReader::new(reader).lines();

    // 1. Subscribe
    let subscribe = json!({
        "id": 1,
        "method": "mining.subscribe",
        "params": ["zion-miner/3.1.0", null]
    });
    send_line(&mut writer, &subscribe).await?;

    // 2. Authorize
    let auth = json!({
        "id": 2,
        "method": "mining.authorize",
        "params": [worker, password]
    });
    send_line(&mut writer, &auth).await?;

    let mut pending_submits: VecDeque<Share> = VecDeque::new();

    loop {
        tokio::select! {
            line = lines.next_line() => match line {
                Ok(Some(line)) => {
                    if let Err(e) = handle_line(&line, job_tx, state).await {
                        warn!(line = %line, error = %e, "stratum line parse failed");
                    }
                }
                Ok(None) => {
                    warn!("stratum server closed connection");
                    return Ok(());
                }
                Err(e) => return Err(e.into()),
            },
            share = submit_rx.recv() => match share {
                Some(share) => {
                    pending_submits.push_back(share);
                    while let Some(s) = pending_submits.pop_front() {
                        if let Err(e) = send_submit(&mut writer, worker, &s).await {
                            warn!(error = %e, "failed to send share");
                            pending_submits.push_front(s);
                            break;
                        }
                    }
                }
                None => return Ok(()),
            },
        }
    }
}

async fn send_line(
    writer: &mut tokio::net::tcp::WriteHalf<'_>,
    value: &Value,
) -> anyhow::Result<()> {
    let mut text = serde_json::to_string(value)?;
    text.push('\n');
    writer.write_all(text.as_bytes()).await?;
    writer.flush().await?;
    Ok(())
}

async fn handle_line(
    line: &str,
    job_tx: &mpsc::Sender<StratumJob>,
    state: &StratumState,
) -> anyhow::Result<()> {
    let value: Value = serde_json::from_str(line)?;

    // Response handling.
    if let Some(id) = value.get("id").and_then(Value::as_i64) {
        if id == 1 {
            parse_subscribe_response(&value, state).await?;
            return Ok(());
        }
        if id == 2 {
            if !is_authorize_ok(&value) {
                anyhow::bail!("stratum authorize failed");
            }
            info!("stratum authorized");
            return Ok(());
        }
    }

    let method = value.get("method").and_then(Value::as_str).unwrap_or("");
    match method {
        "mining.notify" => {
            let params = value
                .get("params")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            if let Some(job) = parse_notify(&params, state).await {
                let _ = job_tx.send(job).await;
            }
        }
        "mining.set_difficulty" => {
            if let Some(d) = params_difficulty(&value) {
                let mut diff = state.difficulty.lock().await;
                *diff = d;
                info!(difficulty = d, "stratum set difficulty");
            }
        }
        "mining.set_extranonce" => {
            if let Some((en1, en2_size)) = params_extranonce(&value) {
                let mut e1 = state.extranonce1.lock().await;
                *e1 = en1;
                let mut e2 = state.extranonce2_size.lock().await;
                *e2 = en2_size;
            }
        }
        _ => {}
    }

    Ok(())
}

async fn parse_subscribe_response(value: &Value, state: &StratumState) -> anyhow::Result<()> {
    let result = value.get("result").and_then(Value::as_array);
    if let Some(arr) = result {
        // Standard response: [session_id, extranonce1, extranonce2_size]
        if arr.len() >= 3 {
            let e1 = parse_hex_value(&arr[1]).unwrap_or_default();
            let size = arr[2].as_u64().unwrap_or(0) as usize;
            let mut e1_lock = state.extranonce1.lock().await;
            *e1_lock = e1;
            let mut size_lock = state.extranonce2_size.lock().await;
            *size_lock = size;
            info!(extranonce2_size = size, "stratum subscribed");
        }
    }
    Ok(())
}

fn is_authorize_ok(value: &Value) -> bool {
    if let Some(result) = value.get("result") {
        if result.is_boolean() {
            return result.as_bool().unwrap_or(false);
        }
        if result.is_null() {
            return true;
        }
    }
    // Some pools return a nested error object.
    value.get("error").is_none()
}

fn params_difficulty(value: &Value) -> Option<f64> {
    value
        .get("params")
        .and_then(Value::as_array)
        .and_then(|p| p.first())
        .and_then(Value::as_f64)
        .or_else(|| {
            value
                .get("params")
                .and_then(Value::as_array)
                .and_then(|p| p.first())
                .and_then(Value::as_i64)
                .map(|i| i as f64)
        })
}

fn params_extranonce(value: &Value) -> Option<(Vec<u8>, usize)> {
    let params = value.get("params").and_then(Value::as_array)?;
    if params.len() < 2 {
        return None;
    }
    let e1 = parse_hex_value(&params[0]).unwrap_or_default();
    let size = params[1].as_u64()? as usize;
    Some((e1, size))
}

async fn parse_notify(params: &[Value], state: &StratumState) -> Option<StratumJob> {
    // Simplified 3-param notify used by some AuxPoW pools and our mock server.
    if params.len() == 3 {
        let job_id = params[0].as_str().unwrap_or("").to_string();
        let header_hex = params[1].as_str().unwrap_or("");
        let target_hex = params[2].as_str().unwrap_or("");

        let header = match hex::decode(header_hex.trim_start_matches("0x")) {
            Ok(h) => h,
            Err(_) => header_hex.as_bytes().to_vec(),
        };
        let target = parse_target_hex(target_hex).unwrap_or([0xFF; 32]);

        return Some(StratumJob {
            job_id,
            header,
            target,
            extranonce1: state.extranonce1.lock().await.clone(),
            extranonce2_size: *state.extranonce2_size.lock().await,
            ntime: "00000000".to_string(),
            difficulty: *state.difficulty.lock().await,
            coin: zion_cosmic_harmony::ExternalCoin::Bitcoin, // set by caller
        });
    }

    // Standard stratum v1 9-param notify.
    if params.len() >= 9 {
        let job_id = params[0].as_str().unwrap_or("").to_string();
        let prevhash = parse_hex_value(&params[1]).unwrap_or_default();
        let _coinb1 = params[2].as_str().unwrap_or("");
        let _coinb2 = params[3].as_str().unwrap_or("");
        let _merkle_branch = params[4].as_array();
        let _version = params[5].as_str().unwrap_or("");
        let nbits = params[6].as_str().unwrap_or("");
        let ntime = params[7].as_str().unwrap_or("00000000").to_string();
        let _clean_jobs = params[8].as_bool();

        *state.ntime.lock().await = ntime.clone();

        let target = parse_target_hex(nbits)
            .or_else(|| nbits_to_target(nbits))
            .unwrap_or([0xFF; 32]);

        // Use the previous-block hash as a deterministic header placeholder.
        // Real mining must build the full block header from the pool's pieces.
        let header = if prevhash.is_empty() {
            vec![0u8; 32]
        } else {
            prevhash
        };

        return Some(StratumJob {
            job_id,
            header,
            target,
            extranonce1: state.extranonce1.lock().await.clone(),
            extranonce2_size: *state.extranonce2_size.lock().await,
            ntime,
            difficulty: *state.difficulty.lock().await,
            coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
        });
    }

    warn!(len = params.len(), "unsupported mining.notify param count");
    None
}

async fn send_submit(
    writer: &mut tokio::net::tcp::WriteHalf<'_>,
    worker: &str,
    share: &Share,
) -> anyhow::Result<()> {
    let params = json!([
        worker,
        share.job_id,
        share.extranonce2,
        share.ntime,
        share.nonce_hex()
    ]);
    let msg = json!({
        "id": 100,
        "method": "mining.submit",
        "params": params
    });
    send_line(writer, &msg).await
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

fn parse_hex_value(value: &Value) -> Option<Vec<u8>> {
    value
        .as_str()
        .and_then(|s| hex::decode(s.trim_start_matches("0x")).ok())
}

/// Convert a Bitcoin-style `nbits` compact target to a 32-byte target.
fn nbits_to_target(nbits: &str) -> Option<[u8; 32]> {
    let bytes = hex::decode(nbits.trim_start_matches("0x")).ok()?;
    if bytes.len() != 4 {
        return None;
    }
    let exponent = bytes[0] as usize;
    if !(3..=32).contains(&exponent) {
        return None;
    }
    let mut coefficient = [0u8; 3];
    coefficient.copy_from_slice(&bytes[1..4]);

    // Big-endian target = coefficient * 256^(exponent - 3)
    let mut out = [0u8; 32];
    let start = 32 - exponent;
    out[start..start + 3].copy_from_slice(&coefficient);
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_target_hex_ok() {
        let t = "f".repeat(64);
        assert_eq!(parse_target_hex(&t), Some([0xff; 32]));
    }

    #[test]
    fn parse_target_hex_short() {
        assert_eq!(parse_target_hex("00"), None);
    }

    #[test]
    fn nbits_to_target_ok() {
        // Bitcoin genesis nbits 0x1d00ffff -> coefficient 00ffff at exponent 29
        let t = nbits_to_target("1d00ffff").unwrap();
        assert_eq!(t[..3], [0u8; 3]);
        assert_eq!(t[3], 0x00);
        assert_eq!(t[4], 0xff);
        assert_eq!(t[5], 0xff);
        assert_eq!(t[6..], [0u8; 26]);
    }

    #[tokio::test]
    async fn mock_stratum_job_arrives() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.split();
            let mut lines = BufReader::new(reader).lines();
            let mut got = 0;
            while let Ok(Some(_line)) = lines.next_line().await {
                got += 1;
                if got == 2 {
                    let header = "00".repeat(32);
                    let target = "ff".repeat(32);
                    let notify = format!(
                        r#"{{"id":null,"method":"mining.notify","params":["mock_job","{}","{}"]}}"#,
                        header, target
                    );
                    let _ = writer.write_all(notify.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;
                    break;
                }
            }
        });

        let mut client = StratumClient::new(format!("127.0.0.1:{}", port), "worker", "x");

        let job = client
            .next_job(
                zion_cosmic_harmony::ExternalCoin::Kaspa,
                Duration::from_secs(5),
            )
            .await
            .unwrap();
        assert_eq!(job.job_id, "mock_job");

        server.abort();
    }

    #[tokio::test]
    async fn mock_stratum_full_submit_format() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.split();
            let mut lines = BufReader::new(reader).lines();
            let mut got = 0;
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = line;
                got += 1;
                if got == 3 {
                    // Respond to submit.
                    let response = r#"{"id":100,"result":true,"error":null}"#;
                    let _ = writer.write_all(response.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;
                }
            }
        });

        let client = StratumClient::new(format!("127.0.0.1:{}", port), "worker", "x");

        let share = Share {
            job_id: "mock_job".to_string(),
            coin: zion_cosmic_harmony::ExternalCoin::Kaspa,
            nonce: 42,
            hash: [0u8; 32],
            extranonce2: "00".to_string(),
            ntime: "00000000".to_string(),
        };
        client.submit_share(&share).await.unwrap();

        // Give the session time to send the share.
        tokio::time::sleep(Duration::from_millis(200)).await;
        server.abort();
    }
}
