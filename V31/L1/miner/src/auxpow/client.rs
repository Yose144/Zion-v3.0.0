//! Stratum v1 client for external pool connection.
//!
//! Implements the standard Stratum v1 protocol:
//!   1. `mining.subscribe` — register with the pool
//!   2. `mining.authorize` — authenticate with wallet.worker
//!   3. `mining.notify` — receive jobs (job_id, header, target)
//!   4. `mining.submit` — submit shares (job_id, nonce, hash)
//!
//! Also supports EthStratum variant (eth_getWork / eth_submitWork) for
//! Ethash/Autolykos coins. Exotic protocols (EpicStratum, BeamStratum,
//! CryptonoteStratum, IronFishStratum, PearlStratum) are stubbed.

#![allow(clippy::type_complexity)]

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{Mutex, Notify, oneshot};
use tokio::time::timeout;
use tracing::{debug, info, warn};

use super::hasher;
use zion_cosmic_harmony::{CoinProfile, ExternalCoin};

/// Configuration for the AuxPowClient — extracts fields needed for stratum
/// connection from V31's CoinProfile plus worker credentials.
#[derive(Clone, Debug)]
pub struct AuxPowClientConfig {
    pub coin: ExternalCoin,
    pub algorithm: String,
    pub pool_address: String,
    pub worker_name: String,
    pub password: String,
}

impl AuxPowClientConfig {
    pub fn from_profile(profile: &CoinProfile, worker_name: &str, password: &str) -> Self {
        Self {
            coin: profile.coin,
            algorithm: profile.coin.algorithm().to_string(),
            pool_address: profile.pool_address(),
            worker_name: worker_name.to_string(),
            password: password.to_string(),
        }
    }

    pub fn new(
        coin: ExternalCoin,
        pool_address: impl Into<String>,
        worker_name: impl Into<String>,
        password: impl Into<String>,
    ) -> Self {
        Self {
            coin,
            algorithm: coin.algorithm().to_string(),
            pool_address: pool_address.into(),
            worker_name: worker_name.into(),
            password: password.into(),
        }
    }
}

/// Stratum protocol variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StratumProtocol {
    Stratum,
    EthStratum,
    ZcashStratum,
    PearlStratum,
    EpicStratum,
    BeamStratum,
    CryptonoteStratum,
    IronFishStratum,
}

impl StratumProtocol {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stratum => "stratum",
            Self::EthStratum => "ethstratum",
            Self::ZcashStratum => "zcashstratum",
            Self::PearlStratum => "pearlstratum",
            Self::EpicStratum => "epicstratum",
            Self::BeamStratum => "beamstratum",
            Self::CryptonoteStratum => "cryptonotestratum",
            Self::IronFishStratum => "ironfishstratum",
        }
    }
}

/// Map V31 ExternalCoin to StratumProtocol.
pub fn coin_protocol(coin: ExternalCoin) -> StratumProtocol {
    match coin {
        ExternalCoin::Monero => StratumProtocol::CryptonoteStratum,
        ExternalCoin::Flux | ExternalCoin::Verus => StratumProtocol::ZcashStratum,
        ExternalCoin::EpicCash => StratumProtocol::EpicStratum,
        ExternalCoin::Zano => StratumProtocol::EthStratum,
        _ => StratumProtocol::Stratum,
    }
}

/// A job received from the external pool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalJob {
    pub job_id: String,
    pub header_hex: String,
    pub target_hex: String,
    pub seed_hash: Option<String>,
    pub block_number: Option<u64>,
    pub algorithm: String,
    #[serde(skip)]
    pub header_bytes: Vec<u8>,
    #[serde(skip)]
    pub target_bytes: [u8; 32],
    #[serde(skip)]
    pub timestamp: Option<u64>,
    #[serde(skip)]
    pub nbits: Option<String>,
    #[serde(skip)]
    pub external_coin: ExternalCoin,
    #[serde(skip)]
    pub from_group: u32,
    #[serde(skip)]
    pub to_group: u32,
    #[serde(skip)]
    pub extranonce1: Vec<u8>,
    #[serde(skip)]
    pub extranonce2: String,
    #[serde(skip)]
    pub epoch: Option<u32>,
}

impl Default for ExternalJob {
    fn default() -> Self {
        Self {
            job_id: String::new(),
            header_hex: String::new(),
            target_hex: String::new(),
            seed_hash: None,
            block_number: None,
            algorithm: String::new(),
            header_bytes: Vec::new(),
            target_bytes: [0u8; 32],
            timestamp: None,
            nbits: None,
            external_coin: ExternalCoin::Bitcoin,
            from_group: 0,
            to_group: 0,
            extranonce1: Vec::new(),
            extranonce2: String::new(),
            epoch: None,
        }
    }
}

/// Share submission result from the pool.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShareResult {
    Accepted,
    Rejected(String),
    Unknown,
    NoShare,
}

/// Stratum v1 client for an external mining pool.
#[derive(Clone)]
pub struct AuxPowClient {
    config: AuxPowClientConfig,
    protocol: StratumProtocol,
    stream: Arc<Mutex<Option<Box<dyn AsyncWrite + Unpin + Send>>>>,
    reader: Arc<Mutex<Option<BufReader<Box<dyn AsyncRead + Unpin + Send>>>>>,
    current_job: Arc<Mutex<Option<ExternalJob>>>,
    subscribed: Arc<Mutex<bool>>,
    authorized: Arc<Mutex<bool>>,
    job_notify: Arc<Notify>,
    shutdown: Arc<Notify>,
    connected: Arc<Mutex<bool>>,
    current_difficulty: Arc<Mutex<f64>>,
    current_target_bytes: Arc<Mutex<Option<[u8; 32]>>>,
    payout_wallet: Arc<Mutex<String>>,
    extranonce1: Arc<Mutex<Vec<u8>>>,
    extranonce2_size: Arc<Mutex<Option<u32>>>,
    pending_requests: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    last_waited_job_id: Arc<Mutex<Option<String>>>,
    eth_getwork_polling: Arc<Mutex<bool>>,
    next_rpc_id: Arc<Mutex<i64>>,
    job_solution: Arc<Mutex<HashMap<String, String>>>,
    job_ntime: Arc<Mutex<HashMap<String, String>>>,
    job_header_prefix: Arc<Mutex<HashMap<String, String>>>,
    job_extranonce1: Arc<Mutex<HashMap<String, Vec<u8>>>>,
    latest_job_id: Arc<Mutex<Option<String>>>,
    cryptonote_session_id: Arc<Mutex<Option<String>>>,
    submitted_nonces: Arc<Mutex<std::collections::VecDeque<(String, u64)>>>,
}

impl std::fmt::Debug for AuxPowClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AuxPowClient")
            .field("coin", &self.config.coin)
            .field("protocol", &self.protocol)
            .field("connected", &self.connected)
            .finish_non_exhaustive()
    }
}

impl AuxPowClient {
    pub fn new(config: AuxPowClientConfig) -> Self {
        let protocol = coin_protocol(config.coin);
        Self {
            config,
            protocol,
            stream: Arc::new(Mutex::new(None)),
            reader: Arc::new(Mutex::new(None)),
            current_job: Arc::new(Mutex::new(None)),
            subscribed: Arc::new(Mutex::new(false)),
            authorized: Arc::new(Mutex::new(false)),
            job_notify: Arc::new(Notify::new()),
            shutdown: Arc::new(Notify::new()),
            connected: Arc::new(Mutex::new(false)),
            current_difficulty: Arc::new(Mutex::new(1.0)),
            current_target_bytes: Arc::new(Mutex::new(None)),
            payout_wallet: Arc::new(Mutex::new(String::new())),
            extranonce1: Arc::new(Mutex::new(Vec::new())),
            extranonce2_size: Arc::new(Mutex::new(None)),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            last_waited_job_id: Arc::new(Mutex::new(None)),
            eth_getwork_polling: Arc::new(Mutex::new(false)),
            next_rpc_id: Arc::new(Mutex::new(200)),
            job_solution: Arc::new(Mutex::new(HashMap::new())),
            job_ntime: Arc::new(Mutex::new(HashMap::new())),
            job_header_prefix: Arc::new(Mutex::new(HashMap::new())),
            job_extranonce1: Arc::new(Mutex::new(HashMap::new())),
            latest_job_id: Arc::new(Mutex::new(None)),
            cryptonote_session_id: Arc::new(Mutex::new(None)),
            submitted_nonces: Arc::new(Mutex::new(std::collections::VecDeque::new())),
        }
    }

    pub async fn connect(&self, payout_wallet: &str) -> Result<()> {
        *self.payout_wallet.lock().await = payout_wallet.to_string();
        self.connect_tcp().await?;

        if self.protocol == StratumProtocol::CryptonoteStratum {
            self.cryptonote_login(payout_wallet).await?;
        }

        let client_clone = Arc::new(self.clone());
        let profile_clone = self.config.clone();
        let payout_wallet_clone = payout_wallet.to_string();
        tokio::spawn(async move {
            let mut backoff_secs: u64 = 5;
            loop {
                match client_clone.poll_messages().await {
                    Ok(()) => {}
                    Err(e) => {
                        warn!(
                            "auxpow_client: poll loop ended for {}: {} — reconnecting in {}s",
                            profile_clone.coin, e, backoff_secs
                        );
                        *client_clone.connected.lock().await = false;
                        tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                        match client_clone.reconnect(&payout_wallet_clone).await {
                            Ok(()) => {
                                info!("auxpow_client: reconnected to {}", profile_clone.coin);
                                backoff_secs = 5;
                            }
                            Err(re_err) => {
                                backoff_secs = (backoff_secs * 2).min(600);
                                warn!(
                                    "auxpow_client: reconnect failed: {} — retry in {}s",
                                    re_err, backoff_secs
                                );
                                *client_clone.reader.lock().await = None;
                                *client_clone.stream.lock().await = None;
                                *client_clone.connected.lock().await = false;
                            }
                        }
                    }
                }
            }
        });

        if self.protocol != StratumProtocol::CryptonoteStratum
            && self.protocol != StratumProtocol::EpicStratum
            && self.protocol != StratumProtocol::BeamStratum
            && self.protocol != StratumProtocol::IronFishStratum
        {
            if self.protocol != StratumProtocol::EthStratum
                && self.protocol != StratumProtocol::PearlStratum
            {
                self.subscribe().await?;
            }
            self.authorize(payout_wallet).await?;
        }

        if self.protocol == StratumProtocol::EthStratum {
            self.start_eth_getwork_polling().await;
        }

        info!("AuxPow: connected and authorized for {}", self.config.coin);
        Ok(())
    }

    async fn connect_tcp(&self) -> Result<()> {
        let addr = self.config.pool_address.clone();
        info!(
            "AuxPow: connecting to {} ({}) for {}",
            addr,
            self.protocol.as_str(),
            self.config.coin
        );

        let tcp_stream = timeout(Duration::from_secs(15), TcpStream::connect(&addr))
            .await
            .map_err(|_| anyhow!("connect timeout to {}", addr))?
            .context("TCP connect failed")?;

        let (reader_half, writer_half) = tcp_stream.into_split();
        let buf_reader: BufReader<Box<dyn AsyncRead + Unpin + Send>> =
            BufReader::new(Box::new(reader_half));
        *self.stream.lock().await = Some(Box::new(writer_half));
        *self.reader.lock().await = Some(buf_reader);
        *self.connected.lock().await = true;
        Ok(())
    }

    async fn reconnect(&self, payout_wallet: &str) -> Result<()> {
        self.connect_tcp().await?;
        if self.protocol == StratumProtocol::CryptonoteStratum {
            self.cryptonote_login(payout_wallet).await?;
        } else {
            if self.protocol != StratumProtocol::PearlStratum
                && self.protocol != StratumProtocol::EthStratum
            {
                self.subscribe_inline().await?;
            }
            self.authorize_inline(payout_wallet).await?;
        }
        {
            self.job_solution.lock().await.clear();
            self.job_ntime.lock().await.clear();
            self.job_header_prefix.lock().await.clear();
            self.job_extranonce1.lock().await.clear();
            *self.latest_job_id.lock().await = None;
            let cancelled = self.pending_requests.lock().await.drain().count();
            if cancelled > 0 {
                warn!("AuxPow: cancelled {} pending request(s) after reconnect", cancelled);
            }
        }
        info!("AuxPow: reconnected for {}", self.config.coin);
        Ok(())
    }

    async fn send_request_inline(&self, req: &Value) -> Result<Value> {
        let mut line = serde_json::to_string(req)?;
        line.push('\n');
        {
            let mut stream_guard = self.stream.lock().await;
            if let Some(ref mut stream) = *stream_guard {
                stream.write_all(line.as_bytes()).await?;
                stream.flush().await?;
            } else {
                bail!("not connected");
            }
        }

        let req_id_i64 = req.get("id").and_then(|v| v.as_i64());
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("send_request_inline: timeout");
            }
            let mut buf = String::new();
            let line_str: String = {
                let mut reader_guard = self.reader.lock().await;
                if let Some(ref mut reader) = *reader_guard {
                    match timeout(remaining, reader.read_line(&mut buf)).await {
                        Ok(Ok(_)) => {
                            if buf.is_empty() {
                                bail!("connection closed by remote");
                            }
                            buf.trim().to_string()
                        }
                        Ok(Err(e)) => bail!("read error: {e}"),
                        Err(_) => bail!("read timeout"),
                    }
                } else {
                    bail!("no reader available");
                }
            };
            let parsed: Value = serde_json::from_str(&line_str)
                .with_context(|| format!("invalid JSON: {line_str}"))?;
            let resp_id_i64 = parsed.get("id").and_then(|v| {
                v.as_i64()
                    .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
            });
            if let Some(id) = resp_id_i64 {
                if req_id_i64 == Some(id) {
                    return Ok(parsed);
                }
            }
            if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
                self.handle_notification(method, &parsed).await;
            }
        }
    }

    async fn send_request(&self, req: &Value) -> Result<Value> {
        let req_id = req.get("id").and_then(|v| v.as_i64());
        let (tx, rx) = oneshot::channel();
        if let Some(id) = req_id {
            self.pending_requests.lock().await.insert(id, tx);
        } else {
            bail!("request must have an id");
        }

        let mut line = serde_json::to_string(req)?;
        line.push('\n');
        {
            let mut stream_guard = self.stream.lock().await;
            if let Some(ref mut stream) = *stream_guard {
                stream.write_all(line.as_bytes()).await?;
                stream.flush().await?;
            } else {
                bail!("not connected");
            }
        }

        match timeout(Duration::from_secs(60), rx).await {
            Ok(Ok(resp)) => Ok(resp),
            Ok(Err(_)) => bail!("request cancelled"),
            Err(_) => {
                if let Some(id) = req_id {
                    self.pending_requests.lock().await.remove(&id);
                }
                bail!("request timeout")
            }
        }
    }

    async fn send_notification(&self, req: &Value) -> Result<()> {
        let mut line = serde_json::to_string(req)?;
        line.push('\n');
        let mut stream_guard = self.stream.lock().await;
        if let Some(ref mut stream) = *stream_guard {
            stream.write_all(line.as_bytes()).await?;
            stream.flush().await?;
        } else {
            bail!("not connected");
        }
        Ok(())
    }

    async fn subscribe(&self) -> Result<()> {
        let req = json!({
            "id": 1,
            "method": "mining.subscribe",
            "params": ["zion-miner/3.1.0", null]
        });
        let resp = self.send_request(&req).await?;
        self.parse_subscribe_response(&resp).await?;
        *self.subscribed.lock().await = true;
        Ok(())
    }

    async fn subscribe_inline(&self) -> Result<()> {
        let req = json!({
            "id": 1,
            "method": "mining.subscribe",
            "params": ["zion-miner/3.1.0", null]
        });
        let resp = self.send_request_inline(&req).await?;
        self.parse_subscribe_response(&resp).await?;
        *self.subscribed.lock().await = true;
        Ok(())
    }

    async fn parse_subscribe_response(&self, resp: &Value) -> Result<()> {
        if let Some(arr) = resp.get("result").and_then(Value::as_array) {
            if arr.len() >= 3 {
                let e1 = parse_hex_value(&arr[1]).unwrap_or_default();
                let size = arr[2].as_u64().unwrap_or(0) as u32;
                *self.extranonce1.lock().await = e1;
                *self.extranonce2_size.lock().await = Some(size);
                info!(extranonce2_size = size, "stratum subscribed");
            }
        }
        Ok(())
    }

    async fn authorize(&self, payout_wallet: &str) -> Result<()> {
        let worker = format!("{}.{}", payout_wallet, self.config.worker_name);
        let req = json!({
            "id": 2,
            "method": "mining.authorize",
            "params": [worker, self.config.password]
        });
        let resp = self.send_request(&req).await?;
        if !is_authorize_ok(&resp) {
            bail!("stratum authorize failed");
        }
        *self.authorized.lock().await = true;
        info!("stratum authorized for {}", self.config.coin);
        Ok(())
    }

    async fn authorize_inline(&self, payout_wallet: &str) -> Result<()> {
        let worker = format!("{}.{}", payout_wallet, self.config.worker_name);
        let req = json!({
            "id": 2,
            "method": "mining.authorize",
            "params": [worker, self.config.password]
        });
        let resp = self.send_request_inline(&req).await?;
        if !is_authorize_ok(&resp) {
            bail!("stratum authorize failed");
        }
        *self.authorized.lock().await = true;
        Ok(())
    }

    async fn cryptonote_login(&self, payout_wallet: &str) -> Result<()> {
        let req = json!({
            "id": 1,
            "method": "login",
            "params": {
                "login": payout_wallet,
                "pass": self.config.password,
                "agent": "zion-miner/3.1.0"
            }
        });
        let resp = self.send_request_inline(&req).await?;
        if let Some(result) = resp.get("result") {
            if let Some(id) = result.get("id").and_then(Value::as_str) {
                *self.cryptonote_session_id.lock().await = Some(id.to_string());
            }
            if let Some(job) = result.get("job") {
                self.parse_cryptonote_job(job).await;
            }
        }
        *self.authorized.lock().await = true;
        info!("cryptonote login for {}", self.config.coin);
        Ok(())
    }

    async fn parse_cryptonote_job(&self, job: &Value) {
        let job_id = job.get("job_id").and_then(Value::as_str).unwrap_or("").to_string();
        let blob_hex = job.get("blob").and_then(Value::as_str).unwrap_or("");
        let target_hex = job.get("target").and_then(Value::as_str).unwrap_or("");
        let height = job.get("height").and_then(Value::as_u64);

        let header_bytes = hex::decode(blob_hex).unwrap_or_default();
        let target_bytes = hasher::parse_target_hex(target_hex).unwrap_or([0xFF; 32]);

        let ext_job = ExternalJob {
            job_id,
            header_hex: blob_hex.to_string(),
            target_hex: target_hex.to_string(),
            header_bytes,
            target_bytes,
            block_number: height,
            algorithm: self.config.algorithm.clone(),
            external_coin: self.config.coin,
            ..Default::default()
        };
        *self.current_job.lock().await = Some(ext_job);
        self.job_notify.notify_waiters();
    }

    async fn start_eth_getwork_polling(&self) {
        *self.eth_getwork_polling.lock().await = true;
        let self_clone = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(3));
            loop {
                interval.tick().await;
                if !*self_clone.eth_getwork_polling.lock().await {
                    break;
                }
                let req = json!({"id": 10, "method": "eth_getWork", "params": []});
                if let Err(e) = self_clone.send_notification(&req).await {
                    warn!("eth_getWork poll failed: {}", e);
                    break;
                }
            }
        });
    }

    async fn poll_messages(&self) -> Result<()> {
        loop {
            let mut buf = String::new();
            let line_str: String = {
                let mut reader_guard = self.reader.lock().await;
                if let Some(ref mut reader) = *reader_guard {
                    match reader.read_line(&mut buf).await {
                        Ok(0) => bail!("connection closed"),
                        Ok(_) => buf.trim().to_string(),
                        Err(e) => bail!("read error: {e}"),
                    }
                } else {
                    bail!("no reader");
                }
            };
            if line_str.is_empty() {
                continue;
            }
            let parsed: Value = match serde_json::from_str(&line_str) {
                Ok(v) => v,
                Err(e) => {
                    warn!("invalid JSON from pool: {} — {}", e, line_str);
                    continue;
                }
            };

            if let Some(id) = parsed.get("id").and_then(|v| v.as_i64()) {
                if let Some(sender) = self.pending_requests.lock().await.remove(&id) {
                    let _ = sender.send(parsed.clone());
                }
            }

            if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
                self.handle_notification(method, &parsed).await;
            }
        }
    }

    async fn handle_notification(&self, method: &str, msg: &Value) {
        match method {
            "mining.notify" => {
                if let Some(job) = self.parse_notify(msg).await {
                    *self.current_job.lock().await = Some(job);
                    self.job_notify.notify_waiters();
                }
            }
            "mining.set_difficulty" => {
                if let Some(d) = msg.get("params").and_then(|p| p.get(0)).and_then(Value::as_f64) {
                    *self.current_difficulty.lock().await = d;
                    debug!(difficulty = d, "stratum set difficulty");
                }
            }
            "mining.set_target" => {
                if let Some(target_hex) = msg
                    .get("params")
                    .and_then(|p| p.get(0))
                    .and_then(Value::as_str)
                {
                    if let Some(target) = hasher::parse_target_hex(target_hex) {
                        *self.current_target_bytes.lock().await = Some(target);
                    }
                }
            }
            "mining.set_extranonce" => {
                if let Some(params) = msg.get("params").and_then(Value::as_array) {
                    if params.len() >= 2 {
                        let e1 = parse_hex_value(&params[0]).unwrap_or_default();
                        let size = params[1].as_u64().unwrap_or(0) as u32;
                        *self.extranonce1.lock().await = e1;
                        *self.extranonce2_size.lock().await = Some(size);
                    }
                }
            }
            "eth_getWork" | "job" => {
                if let Some(job) = self.parse_notify(msg).await {
                    *self.current_job.lock().await = Some(job);
                    self.job_notify.notify_waiters();
                }
            }
            _ => {
                debug!(method = method, "unhandled stratum notification");
            }
        }
    }

    async fn parse_notify(&self, msg: &Value) -> Option<ExternalJob> {
        let params = msg.get("params").and_then(Value::as_array)?;

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

            let target = hasher::parse_target_hex(nbits)
                .or_else(|| hasher::nbits_to_target(nbits))
                .unwrap_or([0xFF; 32]);

            let header = if prevhash.is_empty() {
                vec![0u8; 32]
            } else {
                prevhash
            };

            let timestamp = u32::from_str_radix(ntime.trim_start_matches("0x"), 16).ok().map(|t| t as u64);

            let job = ExternalJob {
                job_id,
                header_hex: hex::encode(&header),
                target_hex: nbits.to_string(),
                header_bytes: header,
                target_bytes: target,
                timestamp,
                nbits: Some(nbits.to_string()),
                algorithm: self.config.algorithm.clone(),
                external_coin: self.config.coin,
                extranonce1: self.extranonce1.lock().await.clone(),
                ..Default::default()
            };
            *self.latest_job_id.lock().await = Some(job.job_id.clone());
            return Some(job);
        }

        if params.len() == 3 || params.len() == 5 {
            // 3-param: [job_id, header_hex, target_hex]
            // 5-param (ZION simplified): [job_id, header_hex, target_hex, height, clean_jobs]
            let job_id = params[0].as_str().unwrap_or("").to_string();
            let header_hex = params[1].as_str().unwrap_or("");
            let target_hex = params[2].as_str().unwrap_or("");

            let header = hex::decode(header_hex.trim_start_matches("0x")).unwrap_or_default();
            let target = hasher::parse_target_hex(target_hex).unwrap_or([0xFF; 32]);

            let job = ExternalJob {
                job_id,
                header_hex: header_hex.to_string(),
                target_hex: target_hex.to_string(),
                header_bytes: header,
                target_bytes: target,
                algorithm: self.config.algorithm.clone(),
                external_coin: self.config.coin,
                extranonce1: self.extranonce1.lock().await.clone(),
                ..Default::default()
            };
            *self.latest_job_id.lock().await = Some(job.job_id.clone());
            return Some(job);
        }

        warn!(len = params.len(), "unsupported mining.notify param count");
        None
    }

    /// Wait for the next job from the pool.
    pub async fn wait_for_job(&self, timeout_dur: Duration) -> Result<ExternalJob> {
        loop {
            let current = self.current_job.lock().await.clone();
            if let Some(job) = current {
                let last = self.last_waited_job_id.lock().await.clone();
                if last.as_deref() != Some(&job.job_id) {
                    *self.last_waited_job_id.lock().await = Some(job.job_id.clone());
                    return Ok(job);
                }
            }
            match timeout(timeout_dur, self.job_notify.notified()).await {
                Ok(_) => continue,
                Err(_) => bail!("wait_for_job timeout"),
            }
        }
    }

    /// Submit a share to the pool.
    pub async fn submit_share(
        &self,
        job_id: &str,
        nonce: u64,
        extranonce2: &str,
        ntime: &str,
    ) -> Result<ShareResult> {
        {
            let mut submitted = self.submitted_nonces.lock().await;
            if submitted.iter().any(|(jid, n)| jid == job_id && *n == nonce) {
                return Ok(ShareResult::Rejected("duplicate share".to_string()));
            }
            submitted.push_back((job_id.to_string(), nonce));
            if submitted.len() > 8192 {
                submitted.pop_front();
            }
        }

        let worker = {
            let wallet = self.payout_wallet.lock().await.clone();
            format!("{}.{}", wallet, self.config.worker_name)
        };

        let req = match self.protocol {
            StratumProtocol::EthStratum => json!({
                "id": self.next_rpc_id(),
                "method": "eth_submitWork",
                "params": [nonce_hex(nonce), format!("0x{}", hex::encode([0u8; 32])), format!("0x{}", hex::encode([0u8; 32]))]
            }),
            StratumProtocol::CryptonoteStratum => {
                let session_id = self.cryptonote_session_id.lock().await.clone();
                json!({
                    "id": self.next_rpc_id(),
                    "method": "submit",
                    "params": {
                        "id": session_id.unwrap_or_default(),
                        "job_id": job_id,
                        "nonce": nonce_hex(nonce),
                        "result": format!("0x{}", hex::encode([0u8; 32]))
                    }
                })
            }
            _ => json!({
                "id": self.next_rpc_id(),
                "method": "mining.submit",
                "params": [worker, job_id, extranonce2, ntime, nonce_hex(nonce)]
            }),
        };

        match self.send_request(&req).await {
            Ok(resp) => {
                if let Some(result) = resp.get("result").and_then(Value::as_bool) {
                    if result {
                        Ok(ShareResult::Accepted)
                    } else {
                        let err = resp
                            .get("error")
                            .and_then(|e| e.as_str())
                            .unwrap_or("rejected")
                            .to_string();
                        Ok(ShareResult::Rejected(err))
                    }
                } else if resp.get("error").is_none_or(|e| e.is_null()) {
                    Ok(ShareResult::Accepted)
                } else {
                    let err = resp
                        .get("error")
                        .and_then(|e| e.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    Ok(ShareResult::Rejected(err))
                }
            }
            Err(e) => Ok(ShareResult::Rejected(e.to_string())),
        }
    }

    pub fn next_rpc_id(&self) -> i64 {
        let mut id = self.next_rpc_id.try_lock();
        if let Ok(ref mut id) = id {
            **id += 1;
            **id
        } else {
            200
        }
    }

    pub async fn is_connected(&self) -> bool {
        *self.connected.lock().await
    }

    pub async fn current_job(&self) -> Option<ExternalJob> {
        self.current_job.lock().await.clone()
    }

    pub async fn current_difficulty(&self) -> f64 {
        *self.current_difficulty.lock().await
    }

    pub async fn extranonce1(&self) -> Vec<u8> {
        self.extranonce1.lock().await.clone()
    }

    pub async fn extranonce2_size(&self) -> Option<u32> {
        *self.extranonce2_size.lock().await
    }

    pub fn config(&self) -> &AuxPowClientConfig {
        &self.config
    }

    pub fn protocol(&self) -> StratumProtocol {
        self.protocol
    }

    pub async fn shutdown(&self) {
        self.shutdown.notify_waiters();
    }
}

fn nonce_hex(nonce: u64) -> String {
    format!("0x{:016x}", nonce)
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
    value.get("error").is_none()
}

fn parse_hex_value(value: &Value) -> Option<Vec<u8>> {
    value
        .as_str()
        .and_then(|s| hex::decode(s.trim_start_matches("0x")).ok())
}

// ── Legacy StratumClient (kept for backward compat) ──────────────────

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

impl From<StratumJob> for super::Job {
    fn from(j: StratumJob) -> Self {
        super::Job {
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

/// Simple Stratum v1 client for an external (AuxPoW) pool.
pub struct StratumClient {
    pub url: String,
    pub worker: String,
    pub password: String,
    job_rx: tokio::sync::mpsc::Receiver<StratumJob>,
    submit_tx: tokio::sync::mpsc::Sender<super::Share>,
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
        let (job_tx, job_rx) = tokio::sync::mpsc::channel(8);
        let (submit_tx, submit_rx) = tokio::sync::mpsc::channel(8);
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

        Self { url, worker, password, job_rx, submit_tx }
    }

    pub async fn connect(&self) -> Result<()> {
        if self.url.is_empty() {
            bail!("no stratum url configured");
        }
        Ok(())
    }

    pub async fn next_job(
        &mut self,
        coin: zion_cosmic_harmony::ExternalCoin,
        timeout_dur: Duration,
    ) -> Result<StratumJob> {
        match tokio::time::timeout(timeout_dur, self.job_rx.recv()).await {
            Ok(Some(mut j)) => {
                j.coin = coin;
                Ok(j)
            }
            Ok(None) => bail!("stratum job channel closed"),
            Err(_) => bail!("stratum job receive timed out"),
        }
    }

    pub async fn submit_share(&self, share: &super::Share) -> Result<()> {
        if self.submit_tx.send(share.clone()).await.is_err() {
            bail!("stratum submit channel closed");
        }
        Ok(())
    }
}

fn parse_url(url: &str) -> Result<(&str, u16)> {
    let trimmed = url
        .trim()
        .trim_start_matches("stratum+tcp://")
        .trim_start_matches("stratum://")
        .trim_start_matches("tcp://");
    let (host, port) = trimmed.rsplit_once(':').ok_or_else(|| {
        anyhow!("stratum url must be host:port or stratum+tcp://host:port")
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
    job_tx: tokio::sync::mpsc::Sender<StratumJob>,
    mut submit_rx: tokio::sync::mpsc::Receiver<super::Share>,
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
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn stratum_session(
    url: &str,
    worker: &str,
    password: &str,
    job_tx: &tokio::sync::mpsc::Sender<StratumJob>,
    submit_rx: &mut tokio::sync::mpsc::Receiver<super::Share>,
    state: &StratumState,
) -> Result<()> {
    let (host, port) = parse_url(url)?;
    info!(host = %host, port = port, "connecting to stratum pool");
    let mut stream = TcpStream::connect((host, port)).await?;
    let (reader, mut writer) = stream.split();
    let mut lines = BufReader::new(reader).lines();

    let subscribe = json!({"id": 1, "method": "mining.subscribe", "params": ["zion-miner/3.1.0", null]});
    send_line(&mut writer, &subscribe).await?;
    let auth = json!({"id": 2, "method": "mining.authorize", "params": [worker, password]});
    send_line(&mut writer, &auth).await?;

    let mut pending_submits: std::collections::VecDeque<super::Share> = std::collections::VecDeque::new();

    loop {
        tokio::select! {
            line = lines.next_line() => match line {
                Ok(Some(line)) => {
                    if line.trim().is_empty() {
                        continue;
                    }
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

async fn send_line(writer: &mut tokio::net::tcp::WriteHalf<'_>, value: &Value) -> Result<()> {
    let mut text = serde_json::to_string(value)?;
    text.push('\n');
    writer.write_all(text.as_bytes()).await?;
    writer.flush().await?;
    Ok(())
}

async fn handle_line(
    line: &str,
    job_tx: &tokio::sync::mpsc::Sender<StratumJob>,
    state: &StratumState,
) -> Result<()> {
    let value: Value = serde_json::from_str(line)?;
    if let Some(id) = value.get("id").and_then(Value::as_i64) {
        if id == 1 {
            parse_subscribe_response(&value, state).await?;
            return Ok(());
        }
        if id == 2 {
            if !is_authorize_ok(&value) {
                bail!("stratum authorize failed");
            }
            info!("stratum authorized");
            return Ok(());
        }
    }

    let method = value.get("method").and_then(Value::as_str).unwrap_or("");
    match method {
        "mining.notify" => {
            let params = value.get("params").and_then(Value::as_array).cloned().unwrap_or_default();
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

async fn parse_subscribe_response(value: &Value, state: &StratumState) -> Result<()> {
    if let Some(arr) = value.get("result").and_then(Value::as_array) {
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

fn params_difficulty(value: &Value) -> Option<f64> {
    value.get("params").and_then(Value::as_array).and_then(|p| p.first()).and_then(Value::as_f64)
        .or_else(|| {
            value.get("params").and_then(Value::as_array).and_then(|p| p.first())
                .and_then(Value::as_i64).map(|i| i as f64)
        })
}

fn params_extranonce(value: &Value) -> Option<(Vec<u8>, usize)> {
    let params = value.get("params").and_then(Value::as_array)?;
    if params.len() < 2 { return None; }
    let e1 = parse_hex_value(&params[0]).unwrap_or_default();
    let size = params[1].as_u64()? as usize;
    Some((e1, size))
}

async fn parse_notify(params: &[Value], state: &StratumState) -> Option<StratumJob> {
    if params.len() == 3 || params.len() == 5 {
        // 3-param: [job_id, header_hex, target_hex]
        // 5-param (ZION simplified): [job_id, header_hex, target_hex, height, clean_jobs]
        let job_id = params[0].as_str().unwrap_or("").to_string();
        let header_hex = params[1].as_str().unwrap_or("");
        let target_hex = params[2].as_str().unwrap_or("");
        let header = match hex::decode(header_hex.trim_start_matches("0x")) {
            Ok(h) => h,
            Err(_) => header_hex.as_bytes().to_vec(),
        };
        let target = hasher::parse_target_hex(target_hex).unwrap_or([0xFF; 32]);
        return Some(StratumJob {
            job_id, header, target,
            extranonce1: state.extranonce1.lock().await.clone(),
            extranonce2_size: *state.extranonce2_size.lock().await,
            ntime: "00000000".to_string(),
            difficulty: *state.difficulty.lock().await,
            coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
        });
    }

    if params.len() >= 9 {
        let job_id = params[0].as_str().unwrap_or("").to_string();

        // ZcashStratum (VRSC / FLUX / ZEC): params are
        //   [job_id, version, prevhash, merkle, reserved, ntime, nbits, clean_jobs, solution]
        // The first field after job_id is version (4 bytes = 8 hex chars).
        let first_hex = params[1].as_str().unwrap_or("");
        let first_len = first_hex.trim_start_matches("0x").len();
        if first_len == 8 {
            let version = parse_hex_value(&params[1]).unwrap_or_default();
            let prevhash = parse_hex_value(&params[2]).unwrap_or_default();
            let merkle = parse_hex_value(&params[3]).unwrap_or_default();
            let reserved = parse_hex_value(&params[4]).unwrap_or_default();
            let ntime = params[5].as_str().unwrap_or("00000000").to_string();
            *state.ntime.lock().await = ntime.clone();
            let nbits = params[6].as_str().unwrap_or("");
            let solution = parse_hex_value(&params[8]).unwrap_or_default();

            let target = hasher::parse_target_hex(nbits)
                .or_else(|| hasher::nbits_to_target(nbits))
                .unwrap_or([0xFF; 32]);

            let en1 = state.extranonce1.lock().await.clone();
            let mut nonce_field = [0u8; 32];
            let en1_len = en1.len().min(32);
            nonce_field[..en1_len].copy_from_slice(&en1[..en1_len]);

            let ntime_bytes = parse_hex_value(&params[5]).unwrap_or_else(|| vec![0u8; 4]);
            let nbits_bytes = parse_hex_value(&params[6]).unwrap_or_else(|| vec![0u8; 4]);

            let varint = hasher::zcash_varint_for_len(solution.len());
            let mut header = Vec::with_capacity(
                version.len()
                    + prevhash.len()
                    + merkle.len()
                    + reserved.len()
                    + ntime_bytes.len()
                    + nbits_bytes.len()
                    + nonce_field.len()
                    + varint.len()
                    + solution.len(),
            );
            header.extend_from_slice(&version);
            header.extend_from_slice(&prevhash);
            header.extend_from_slice(&merkle);
            header.extend_from_slice(&reserved);
            header.extend_from_slice(&ntime_bytes);
            header.extend_from_slice(&nbits_bytes);
            header.extend_from_slice(&nonce_field);
            header.extend_from_slice(&varint);
            header.extend_from_slice(&solution);

            return Some(StratumJob {
                job_id,
                header,
                target,
                extranonce1: en1,
                extranonce2_size: *state.extranonce2_size.lock().await,
                ntime,
                difficulty: *state.difficulty.lock().await,
                coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
            });
        }

        // Standard Stratum v1 9-param path: [job_id, prevhash, coinb1, coinb2,
        // merkle_branch, version, nbits, ntime, clean_jobs]. We keep only the
        // prevhash for algorithms that hash the block header directly.
        let prevhash = parse_hex_value(&params[1]).unwrap_or_default();
        let nbits = params[6].as_str().unwrap_or("");
        let ntime = params[7].as_str().unwrap_or("00000000").to_string();
        *state.ntime.lock().await = ntime.clone();
        let target = hasher::parse_target_hex(nbits)
            .or_else(|| hasher::nbits_to_target(nbits))
            .unwrap_or([0xFF; 32]);
        let header = if prevhash.is_empty() { vec![0u8; 32] } else { prevhash };
        return Some(StratumJob {
            job_id, header, target,
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

/// Build the `mining.submit` / `eth_submitWork` params for a given share,
/// taking into account the coin/algorithm-specific requirements.
fn build_submit_params(worker: &str, share: &super::Share) -> Value {
    let algo = share.coin.algorithm();
    let nonce = share.nonce_hex();
    let mix = share.mix_hash_hex();
    let sol = share.solution_hex();

    // DAG-based Ethash variants: EthereumStratum uses eth_submitWork with
    // [nonce, header_hash, mix_hash]. We use the found hash as the header hash
    // and the mix hash as the third parameter; pools recompute the final hash.
    if algo.contains("ethash") || algo == "etchash" {
        let header = format!("0x{}", hex::encode(&share.hash));
        let mix = mix.unwrap_or_else(|| format!("0x{}", hex::encode([0u8; 32])));
        return json!({"id": 100, "method": "eth_submitWork", "params": [nonce, header, mix]});
    }

    // KawPow / ProgPow variants: many pools expect mix_hash as a 6th param.
    if algo.contains("kawpow")
        || algo.contains("progpow")
        || algo == "evrprogpow"
        || algo == "meowpow"
    {
        let mut params =
            json!([worker, share.job_id, share.extranonce2, share.ntime, nonce]);
        if let Some(mix) = mix {
            params.as_array_mut().unwrap().push(json!(format!("0x{mix}")));
        }
        return json!({"id": 100, "method": "mining.submit", "params": params});
    }

    // VerusHash (VRSC / ZcashStratum): submit the 5-param Zcash format
    // [worker, job_id, ntime, nonce2, solution_with_varint]. The nonce2 field
    // is all zeros because the found nonce lives in the solution nonceSpace.
    if algo.contains("verushash") {
        if let Some(sol) = sol {
            return json!({"id": 100, "method": "mining.submit", "params": [worker, share.job_id, share.ntime, share.extranonce2, sol]});
        }
    }

    // Equihash / BeamHash / ZelHash: the actual solution is the proof.
    if algo.contains("equihash") || algo.contains("zelhash") || algo.contains("beamhash") {
        if let Some(sol) = sol {
            return json!({"id": 100, "method": "mining.submit", "params": [worker, share.job_id, share.ntime, share.extranonce2, sol]});
        }
    }

    // Default Bitcoin-style / kHeavyHash / blake3 stratum submit.
    json!({"id": 100, "method": "mining.submit", "params": [worker, share.job_id, share.extranonce2, share.ntime, nonce]})
}

async fn send_submit(
    writer: &mut tokio::net::tcp::WriteHalf<'_>,
    worker: &str,
    share: &super::Share,
) -> Result<()> {
    send_line(writer, &build_submit_params(worker, share)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_target_hex_ok() {
        let t = "f".repeat(64);
        assert_eq!(hasher::parse_target_hex(&t), Some([0xff; 32]));
    }

    #[test]
    fn parse_target_hex_short() {
        assert_eq!(hasher::parse_target_hex("00"), None);
    }

    #[test]
    fn nbits_to_target_ok() {
        let t = hasher::nbits_to_target("1d00ffff").unwrap();
        assert_eq!(t[..3], [0u8; 3]);
        assert_eq!(t[4], 0xff);
        assert_eq!(t[5], 0xff);
    }

    #[test]
    fn coin_protocol_mapping() {
        assert_eq!(coin_protocol(ExternalCoin::Kaspa), StratumProtocol::Stratum);
        assert_eq!(coin_protocol(ExternalCoin::Monero), StratumProtocol::CryptonoteStratum);
        assert_eq!(coin_protocol(ExternalCoin::Verus), StratumProtocol::ZcashStratum);
        assert_eq!(coin_protocol(ExternalCoin::EpicCash), StratumProtocol::EpicStratum);
        assert_eq!(coin_protocol(ExternalCoin::Zano), StratumProtocol::EthStratum);
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
            .next_job(ExternalCoin::Kaspa, Duration::from_secs(5))
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
                    let response = r#"{"id":100,"result":true,"error":null}"#;
                    let _ = writer.write_all(response.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;
                }
            }
        });

        let client = StratumClient::new(format!("127.0.0.1:{}", port), "worker", "x");
        let share = super::super::Share {
            job_id: "mock_job".to_string(),
            coin: ExternalCoin::Kaspa,
            nonce: 42,
            hash: [0u8; 32],
            mix_hash: None,
            solution: None,
            extranonce2: "00".to_string(),
            ntime: "00000000".to_string(),
        };
        client.submit_share(&share).await.unwrap();
        tokio::time::sleep(Duration::from_millis(200)).await;
        server.abort();
    }
}
