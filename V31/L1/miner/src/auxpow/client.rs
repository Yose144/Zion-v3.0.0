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
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{oneshot, Mutex, Notify};
use tokio::time::timeout;

use super::hasher;
use crate::{ext_debug, ext_info, ext_warn};
use zion_cosmic_harmony::{CoinProfile, ExternalCoin};

/// JSON-RPC id used for `eth_getWork` polls.
const ETH_GETWORK_ID: i64 = 10;

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
    /// ntime hex string from upstream pool notify (e.g. "62d12345").
    /// Used for ZcashStratum (VRSC) submit format.
    #[serde(skip)]
    pub ntime: String,
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
            ntime: String::new(),
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
    /// Timestamp when the latest job was received — used for time-based
    /// staleness detection on fast-block coins (VRSC ~60s, ZANO ~30s).
    latest_job_time: Arc<Mutex<Option<Instant>>>,
    cryptonote_session_id: Arc<Mutex<Option<String>>>,
    submitted_nonces: Arc<Mutex<std::collections::VecDeque<(String, u64)>>>,
    /// Guard to ensure only one background poll/reconnect task is ever spawned.
    poll_task_running: Arc<AtomicBool>,
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
            latest_job_time: Arc::new(Mutex::new(None)),
            cryptonote_session_id: Arc::new(Mutex::new(None)),
            submitted_nonces: Arc::new(Mutex::new(std::collections::VecDeque::new())),
            poll_task_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn connect(&self, payout_wallet: &str) -> Result<()> {
        *self.payout_wallet.lock().await = payout_wallet.to_string();

        // Only one background poll/reconnect task is ever needed. If one is
        // already running, leave it alone and let it handle reconnection.
        if self.poll_task_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.connect_tcp().await?;

        if self.protocol == StratumProtocol::CryptonoteStratum {
            self.cryptonote_login(payout_wallet).await?;
        }

        // Mark the poll loop as running before spawning so concurrent
        // connect() calls never create a second reader task.
        self.poll_task_running.store(true, Ordering::SeqCst);

        let client_clone = Arc::new(self.clone());
        let profile_clone = self.config.clone();
        let payout_wallet_clone = payout_wallet.to_string();
        tokio::spawn(async move {
            let mut backoff_secs: u64 = 5;
            loop {
                match client_clone.poll_messages().await {
                    Ok(()) => {}
                    Err(e) => {
                        ext_warn!(
                            "auxpow_client: poll loop ended for {}: {} — reconnecting in {}s",
                            profile_clone.coin,
                            e,
                            backoff_secs
                        );
                        *client_clone.connected.lock().await = false;
                        tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                        match client_clone.reconnect(&payout_wallet_clone).await {
                            Ok(()) => {
                                ext_info!("auxpow_client: reconnected to {}", profile_clone.coin);
                                backoff_secs = 5;
                            }
                            Err(re_err) => {
                                backoff_secs = (backoff_secs * 2).min(600);
                                ext_warn!(
                                    "auxpow_client: reconnect failed: {} — retry in {}s",
                                    re_err,
                                    backoff_secs
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

        ext_info!("AuxPow: connected and authorized for {}", self.config.coin);
        Ok(())
    }

    async fn connect_tcp(&self) -> Result<()> {
        let raw = self.config.pool_address.clone();
        // Strip the stratum+tcp:// prefix so tokio gets a plain host:port.
        let addr = raw
            .trim_start_matches("stratum+tcp://")
            .trim_start_matches("stratum2+tcp://");
        ext_info!(
            "AuxPow: connecting to {} ({}) for {}",
            addr,
            self.protocol.as_str(),
            self.config.coin
        );

        let tcp_stream = timeout(Duration::from_secs(15), TcpStream::connect(addr))
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
            *self.latest_job_time.lock().await = None;
            let cancelled = self.pending_requests.lock().await.drain().count();
            if cancelled > 0 {
                ext_warn!(
                    "AuxPow: cancelled {} pending request(s) after reconnect",
                    cancelled
                );
            }
        }
        ext_info!("AuxPow: reconnected for {}", self.config.coin);

        // For EthStratum, ensure getWork polling is active after reconnect.
        // The polling task should survive across reconnects (it doesn't break
        // on error), but this is a safety net in case it was stopped.
        if self.protocol == StratumProtocol::EthStratum {
            let already_polling = *self.eth_getwork_polling.lock().await;
            if !already_polling {
                self.start_eth_getwork_polling().await;
            }
        }

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
                self.handle_notification(method, &parsed).await?;
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
                let en1_hex = hex::encode(&e1);
                let en1_len = e1.len();
                *self.extranonce1.lock().await = e1;
                *self.extranonce2_size.lock().await = Some(size);
                ext_info!(extranonce2_size = size, "stratum subscribed");
                crate::ext_debug!(
                    target: "en1_trace",
                    en1_hex = %en1_hex,
                    en1_len = en1_len,
                    coin = %self.config.coin,
                    "en1_trace subscribe_response set extranonce1 (3-field)"
                );
            } else if arr.len() == 2 {
                // Some pools (e.g. eu.luckpool.net for VRSC) return only
                // [session_id, extranonce1] with no extranonce2_size. Fall back
                // to a sensible default of 4 bytes for VerusHash.
                let e1 = parse_hex_value(&arr[1]).unwrap_or_default();
                let en1_hex = hex::encode(&e1);
                let en1_len = e1.len();
                *self.extranonce1.lock().await = e1;
                *self.extranonce2_size.lock().await = Some(4);
                ext_info!(
                    extranonce2_size = 4,
                    "stratum subscribed (2-field response)"
                );
                crate::ext_debug!(
                    target: "en1_trace",
                    en1_hex = %en1_hex,
                    en1_len = en1_len,
                    coin = %self.config.coin,
                    "en1_trace subscribe_response set extranonce1 (2-field)"
                );
            } else {
                crate::ext_warn!(
                    target: "en1_trace",
                    arr_len = arr.len(),
                    coin = %self.config.coin,
                    "en1_trace subscribe_response UNEXPECTED array length — extranonce1 NOT set"
                );
            }
        } else {
            crate::ext_warn!(
                target: "en1_trace",
                coin = %self.config.coin,
                "en1_trace subscribe_response no result array — extranonce1 NOT set"
            );
        }
        Ok(())
    }

    /// Return the stratum password for authorize/eth_submitLogin.
    /// ZcashStratum (VRSC/LuckPool) uses a starting vardiff of d=0.01 when no
    /// explicit password is configured. EthStratum and others default to "x".
    fn authorize_password(&self) -> &str {
        if !self.config.password.is_empty() {
            self.config.password.as_str()
        } else if self.protocol == StratumProtocol::ZcashStratum {
            "d=0.01"
        } else {
            "x"
        }
    }

    async fn authorize(&self, payout_wallet: &str) -> Result<()> {
        // EthStratum (e.g. HeroMiners ZANO) uses eth_submitLogin with
        // wallet.worker and a password ("x").
        if self.protocol == StratumProtocol::EthStratum {
            return self.eth_submit_login(payout_wallet).await;
        }
        let worker = format!("{}.{}", payout_wallet, self.config.worker_name);
        let password = self.authorize_password();
        let req = json!({
            "id": 2,
            "method": "mining.authorize",
            "params": [worker, password]
        });
        let resp = self.send_request(&req).await?;
        if !is_authorize_ok(&resp) {
            bail!("stratum authorize failed");
        }
        *self.authorized.lock().await = true;
        ext_info!("stratum authorized for {}", self.config.coin);

        // ZcashStratum (VRSC/LuckPool): send mining.extranonce.subscribe after
        // authorize to enable push extranonce updates. Fire-and-forget; the
        // background poll loop will handle any set_extranonce notification.
        if self.protocol == StratumProtocol::ZcashStratum {
            let ex_req = json!({
                "id": 3,
                "method": "mining.extranonce.subscribe",
                "params": []
            });
            if let Err(e) = self.send_notification(&ex_req).await {
                ext_warn!(
                    "mining.extranonce.subscribe failed for {}: {}",
                    self.config.coin,
                    e
                );
            }
        }
        Ok(())
    }

    /// EthStratum login: sends `eth_submitLogin` with wallet.worker and password.
    async fn eth_submit_login(&self, payout_wallet: &str) -> Result<()> {
        let worker = format!("{}.{}", payout_wallet, self.config.worker_name);
        let password = self.authorize_password();
        let req = json!({
            "id": 2,
            "method": "eth_submitLogin",
            "params": [worker, password]
        });
        let resp = self.send_request(&req).await?;
        if !is_authorize_ok(&resp) {
            bail!("eth_submitLogin failed");
        }
        *self.authorized.lock().await = true;
        ext_info!("eth_submitLogin authorized for {}", self.config.coin);
        Ok(())
    }

    async fn authorize_inline(&self, payout_wallet: &str) -> Result<()> {
        // EthStratum uses eth_submitLogin with wallet.worker and password.
        if self.protocol == StratumProtocol::EthStratum {
            let worker = format!("{}.{}", payout_wallet, self.config.worker_name);
            let password = self.authorize_password();
            let req = json!({
                "id": 2,
                "method": "eth_submitLogin",
                "params": [worker, password]
            });
            let resp = self.send_request_inline(&req).await?;
            if !is_authorize_ok(&resp) {
                bail!("eth_submitLogin failed");
            }
            *self.authorized.lock().await = true;
            ext_info!("eth_submitLogin authorized for {}", self.config.coin);
            return Ok(());
        }
        let worker = format!("{}.{}", payout_wallet, self.config.worker_name);
        let password = self.authorize_password();
        let req = json!({
            "id": 2,
            "method": "mining.authorize",
            "params": [worker, password]
        });
        let resp = self.send_request_inline(&req).await?;
        if !is_authorize_ok(&resp) {
            bail!("stratum authorize failed");
        }
        *self.authorized.lock().await = true;

        // ZcashStratum (VRSC/LuckPool): send mining.extranonce.subscribe after
        // authorize to enable push extranonce updates. Fire-and-forget.
        if self.protocol == StratumProtocol::ZcashStratum {
            let ex_req = json!({
                "id": 3,
                "method": "mining.extranonce.subscribe",
                "params": []
            });
            if let Err(e) = self.send_notification(&ex_req).await {
                ext_warn!(
                    "mining.extranonce.subscribe (inline) failed for {}: {}",
                    self.config.coin,
                    e
                );
            }
        }
        Ok(())
    }

    async fn cryptonote_login(&self, payout_wallet: &str) -> Result<()> {
        let login = format!("{}.{}", payout_wallet, self.config.worker_name);
        let req = json!({
            "id": 1,
            "method": "login",
            "params": {
                "login": login,
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
        ext_info!("cryptonote login for {}", self.config.coin);
        Ok(())
    }

    async fn parse_cryptonote_job(&self, job: &Value) {
        let job_id = job
            .get("job_id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let blob_hex = job.get("blob").and_then(Value::as_str).unwrap_or("");
        let target_hex = job.get("target").and_then(Value::as_str).unwrap_or("");
        let height = job.get("height").and_then(Value::as_u64);

        let header_bytes = hex::decode(blob_hex).unwrap_or_default();
        let target_bytes = hasher::parse_cryptonote_target(target_hex)
            .or_else(|| hasher::parse_target_hex(target_hex))
            .unwrap_or([0xFF; 32]);

        let max_target = hasher::algorithm_max_target(&self.config.algorithm);
        let difficulty = hasher::target_to_difficulty_with_max(&target_bytes, &max_target);
        *self.current_difficulty.lock().await = difficulty;
        *self.current_target_bytes.lock().await = Some(target_bytes);

        let ext_job = ExternalJob {
            job_id: job_id.clone(),
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
        *self.latest_job_id.lock().await = Some(job_id);
        *self.latest_job_time.lock().await = Some(Instant::now());
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
                    // Don't break — the connection might be reconnecting.
                    // Just log and continue; the next tick will retry.
                    ext_debug!("eth_getWork poll skipped (reconnecting?): {}", e);
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
                    ext_warn!("invalid JSON from pool: {} — {}", e, line_str);
                    continue;
                }
            };

            if let Some(id) = parsed.get("id").and_then(|v| v.as_i64()) {
                if let Some(sender) = self.pending_requests.lock().await.remove(&id) {
                    let _ = sender.send(parsed.clone());
                } else if id == ETH_GETWORK_ID {
                    // eth_getWork poll response (sent via send_notification,
                    // so no pending request entry).  Process it as a job.
                    if let Some(job) = self.parse_getwork_response(&parsed).await {
                        *self.current_job.lock().await = Some(job);
                        self.job_notify.notify_waiters();
                    }
                }
            }

            if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
                self.handle_notification(method, &parsed).await?;
            }
        }
    }

    async fn handle_notification(&self, method: &str, msg: &Value) -> Result<()> {
        match method {
            "mining.notify" => {
                if let Some(job) = self.parse_notify(msg).await {
                    *self.current_job.lock().await = Some(job);
                    self.job_notify.notify_waiters();
                }
            }
            "mining.set_difficulty" => {
                if let Some(d) = msg
                    .get("params")
                    .and_then(|p| p.get(0))
                    .and_then(Value::as_f64)
                {
                    *self.current_difficulty.lock().await = d;
                    ext_debug!(difficulty = d, "stratum set difficulty");
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
                        // Also update current_difficulty so other code paths
                        // (stats, vardiff) see a consistent value.
                        let max_target = hasher::algorithm_max_target(&self.config.algorithm);
                        let diff = hasher::target_to_difficulty_with_max(&target, &max_target);
                        *self.current_difficulty.lock().await = diff;
                        ext_debug!(difficulty = diff, target = %target_hex, "stratum set_target");
                    }
                }
            }
            "mining.set_extranonce" | "set_extranonce" => {
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
                if self.protocol == StratumProtocol::CryptonoteStratum {
                    if let Some(params) = msg.get("params").filter(|v| v.is_object()) {
                        self.parse_cryptonote_job(params).await;
                    }
                } else if let Some(job) = self.parse_getwork_response(msg).await {
                    *self.current_job.lock().await = Some(job);
                    self.job_notify.notify_waiters();
                }
            }
            "client.reconnect" | "mining.reconnect" => {
                // Stratum V1 pool-directed reconnect (used by ZcashStratum/
                // LuckPool). Bail out of the poll loop so the auto-reconnect
                // task can start a fresh TCP + subscribe + authorize cycle.
                ext_warn!(coin = %self.config.coin, "pool requested reconnect");
                bail!("pool requested reconnect");
            }
            _ => {
                ext_debug!(method = method, "unhandled stratum notification");
            }
        }
        Ok(())
    }

    async fn parse_notify(&self, msg: &Value) -> Option<ExternalJob> {
        let params = msg.get("params").and_then(Value::as_array)?;

        if params.len() >= 9 {
            let job_id = params[0].as_str().unwrap_or("").to_string();

            // Detect ZcashStratum (VRSC/FLUX/ZEC) format:
            //   [job_id, version, prevhash, merkle, reserved, ntime, nbits, clean_jobs, solution]
            // The first field after job_id is version (4 bytes = 8 hex chars).
            // Standard stratum (BTC/LTC): [job_id, prevhash, coinb1, coinb2, merkle, version, nbits, ntime, clean]
            // where params[1] is a 64-char hex (32-byte prevhash).
            let first_hex = params[1].as_str().unwrap_or("");
            let first_len = first_hex.trim_start_matches("0x").len();

            if first_len == 8 && self.protocol == StratumProtocol::ZcashStratum {
                // ── ZcashStratum (VRSC) full header construction ──
                let version = parse_hex_value(&params[1]).unwrap_or_default();
                let prevhash = parse_hex_value(&params[2]).unwrap_or_default();
                let merkle = parse_hex_value(&params[3]).unwrap_or_default();
                let reserved = parse_hex_value(&params[4]).unwrap_or_default();
                let ntime = params[5].as_str().unwrap_or("00000000").to_string();
                // nbits may be sent as a hex string ("1d00ffff") or as a JSON
                // number. Handle both cases to avoid falling back to 0xFF target.
                let nbits = params[6]
                    .as_str()
                    .map(|s| s.to_string())
                    .or_else(|| params[6].as_u64().map(|n| format!("{:08x}", n)))
                    .or_else(|| params[6].as_i64().map(|n| format!("{:08x}", n)))
                    .unwrap_or_default();
                let mut solution = parse_hex_value(&params[8]).unwrap_or_default();
                // Pad solution to VERUS_SOLUTION_SIZE (1344 bytes) — the pool
                // may send an empty or partial solution; the miner fills the
                // nonceSpace during mining, but the header must be full-size.
                const VERUS_SOLUTION_SIZE: usize = 1344;
                if solution.len() < VERUS_SOLUTION_SIZE {
                    solution.resize(VERUS_SOLUTION_SIZE, 0);
                }

                let target = {
                    // LuckPool (VRSC) sends mining.set_target with the share
                    // target directly.  If we received it, use it as-is — this
                    // is the authoritative share target the pool will check
                    // against.  Falling back to difficulty_to_target would
                    // produce a different (easier) target and shares would be
                    // rejected as "low difficulty share".
                    let set_target = *self.current_target_bytes.lock().await;
                    if let Some(t) = set_target {
                        t
                    } else {
                        // Fallback: compute from mining.set_difficulty, or use
                        // a reasonable minimum if the pool hasn't set either.
                        let diff = *self.current_difficulty.lock().await;
                        let effective_diff = if diff > 1.0 && diff.is_finite() {
                            diff
                        } else {
                            let min_diff = 10000.0f64;
                            if diff != min_diff {
                                ext_warn!(
                                    "vrsc_min_difficulty_applied diff={} min={} — pool did not set difficulty or target",
                                    diff, min_diff
                                );
                            }
                            min_diff
                        };
                        let max_target = hasher::algorithm_max_target(&self.config.algorithm);
                        hasher::difficulty_to_target_with_max(effective_diff, &max_target)
                    }
                };

                let en1 = self.extranonce1.lock().await.clone();
                crate::ext_debug!(
                    target: "en1_trace",
                    en1_hex = %hex::encode(&en1),
                    en1_len = en1.len(),
                    job_id = %job_id,
                    coin = %self.config.coin,
                    "en1_trace parse_notify read extranonce1 for job"
                );
                if en1.is_empty() {
                    crate::ext_warn!(
                        target: "en1_trace",
                        job_id = %job_id,
                        coin = %self.config.coin,
                        "en1_trace parse_notify EMPTY extranonce1 — race condition? subscribe response may not have been processed yet"
                    );
                }
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

                let timestamp = u32::from_str_radix(ntime.trim_start_matches("0x"), 16)
                    .ok()
                    .map(|t| t as u64);
                let block_number = timestamp.unwrap_or(0);

                let job = ExternalJob {
                    job_id,
                    header_hex: hex::encode(&header),
                    target_hex: hex::encode(target),
                    header_bytes: header,
                    target_bytes: target,
                    timestamp,
                    nbits: Some(nbits.to_string()),
                    algorithm: self.config.algorithm.clone(),
                    external_coin: self.config.coin,
                    extranonce1: en1,
                    block_number: Some(block_number),
                    ntime: ntime.clone(),
                    ..Default::default()
                };
                *self.latest_job_id.lock().await = Some(job.job_id.clone());
                *self.latest_job_time.lock().await = Some(Instant::now());
                return Some(job);
            }

            // ── Standard stratum (BTC/LTC/VRSC-legacy) ──
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

            let timestamp = u32::from_str_radix(ntime.trim_start_matches("0x"), 16)
                .ok()
                .map(|t| t as u64);

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
            *self.latest_job_time.lock().await = Some(Instant::now());
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
            *self.latest_job_time.lock().await = Some(Instant::now());
            return Some(job);
        }

        ext_warn!(len = params.len(), "unsupported mining.notify param count");
        None
    }

    /// Parse an `eth_getWork` JSON-RPC response or notification.
    ///
    /// Standard EthStratum (ETC/ERG) uses `[seed_hash, header_hash, target, height]`.
    /// ZANO HeroMiners poll responses swap the first two fields:
    /// `[header_hash, seed_hash, target, height]`.
    /// open-ethereum-pool notifications carry the array in `params`; JSON-RPC
    /// responses carry it in `result`.
    async fn parse_getwork_response(&self, msg: &Value) -> Option<ExternalJob> {
        // Prefer `result` for responses, fall back to `params` for notifications.
        let is_response = msg.get("result").is_some();
        let arr = msg
            .get("result")
            .or_else(|| msg.get("params"))
            .and_then(Value::as_array)?;
        if arr.len() < 3 {
            return None;
        }

        // ZANO poll responses have header/seed swapped vs the standard
        // notification order. Only swap when we are reading a `result` field.
        let is_zano = self.config.coin == ExternalCoin::Zano;
        let (seed_idx, header_idx) = if is_response && is_zano {
            (1, 0)
        } else {
            (0, 1)
        };

        let seed_hex = arr[seed_idx].as_str().unwrap_or("");
        let header_hex = arr[header_idx].as_str().unwrap_or("");
        let target_hex = arr[2].as_str().unwrap_or("");
        let height_hex = arr.get(3).and_then(|v| v.as_str());

        let block_number =
            height_hex.and_then(|h| u64::from_str_radix(h.trim_start_matches("0x"), 16).ok());

        let header = hex::decode(header_hex.trim_start_matches("0x")).unwrap_or_default();
        let target = hasher::parse_target_hex(target_hex).unwrap_or([0xFF; 32]);

        // EthStratum pools provide the share target directly in getWork;
        // update the client's current target so share difficulty checks
        // don't default to difficulty=1.0.
        let difficulty = hasher::target_to_difficulty_with_max(
            &target,
            &hasher::algorithm_max_target(&self.config.algorithm),
        );
        *self.current_target_bytes.lock().await = Some(target);
        *self.current_difficulty.lock().await = difficulty;

        // Use the header hash as the job id; it uniquely identifies the
        // EthStratum job and is needed for eth_submitWork submissions.
        let job_id = header_hex.to_string();

        let job = ExternalJob {
            job_id: job_id.clone(),
            header_hex: header_hex.to_string(),
            target_hex: target_hex.to_string(),
            header_bytes: header,
            target_bytes: target,
            seed_hash: Some(seed_hex.to_string()),
            block_number,
            algorithm: self.config.algorithm.clone(),
            external_coin: self.config.coin,
            extranonce1: self.extranonce1.lock().await.clone(),
            ..Default::default()
        };
        *self.latest_job_id.lock().await = Some(job_id);
        *self.latest_job_time.lock().await = Some(Instant::now());
        Some(job)
    }

    /// Content key for detecting any meaningful job change (not just job_id).
    /// Upstream pools may re-use the same job_id for a rolling job update
    /// (ntime/target/header), so we compare the full visible job content.
    fn external_job_key(job: &ExternalJob) -> String {
        format!(
            "{}|{}|{}|{}",
            job.job_id, job.ntime, job.target_hex, job.header_hex
        )
    }

    /// Wait for the next job from the pool.
    pub async fn wait_for_job(&self, timeout_dur: Duration) -> Result<ExternalJob> {
        loop {
            let current = self.current_job.lock().await.clone();
            if let Some(job) = current {
                let key = Self::external_job_key(&job);
                let last = self.last_waited_job_id.lock().await.clone();
                if last.as_deref() != Some(&key) {
                    *self.last_waited_job_id.lock().await = Some(key);
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
    ///
    /// `mix_hash` and `header_hash` are optional and used by EthStratum /
    /// ProgPoW-style `eth_submitWork` submissions. If not provided, the
    /// EthStratum path falls back to the `job_id` (expected to be the header
    /// hash) and a zero mix hash.
    #[allow(clippy::too_many_arguments)]
    pub async fn submit_share(
        &self,
        job_id: &str,
        nonce: u64,
        extranonce2: &str,
        ntime: &str,
        mix_hash: Option<&str>,
        header_hash: Option<&str>,
        solution_hex: &str,
    ) -> Result<ShareResult> {
        {
            let mut submitted = self.submitted_nonces.lock().await;
            if submitted
                .iter()
                .any(|(jid, n)| jid == job_id && *n == nonce)
            {
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

        let header_hex = header_hash
            .map(|h| {
                if h.starts_with("0x") {
                    h.to_string()
                } else {
                    format!("0x{}", h)
                }
            })
            .unwrap_or_else(|| {
                if job_id.starts_with("0x") {
                    job_id.to_string()
                } else {
                    format!("0x{}", job_id)
                }
            });

        let mix_hex = mix_hash
            .map(|m| {
                if m.starts_with("0x") {
                    m.to_string()
                } else {
                    format!("0x{}", m)
                }
            })
            .unwrap_or_else(|| format!("0x{}", "0".repeat(64)));

        let req = match self.protocol {
            StratumProtocol::EthStratum => json!({
                "id": self.next_rpc_id(),
                "method": "eth_submitWork",
                "params": [nonce_hex(nonce), header_hex, mix_hex]
            }),
            StratumProtocol::CryptonoteStratum => {
                let session_id = self.cryptonote_session_id.lock().await.clone();
                json!({
                    "id": self.next_rpc_id(),
                    "method": "submit",
                    "params": {
                        "id": session_id.unwrap_or_default(),
                        "job_id": job_id,
                        "nonce": cryptonote_nonce_hex(nonce),
                        "result": cryptonote_result_hex(&mix_hex)
                    }
                })
            }
            StratumProtocol::ZcashStratum => {
                // ZcashStratum (VRSC/LuckPool): [worker, job_id, ntime, extranonce2, solution]
                // ntime is 4-byte hex (8 chars), extranonce2 is the 28-byte suffix
                // after extranonce1, solution is the equihash solution hex.
                // If solution_hex is provided, use it; otherwise fall back to nonce.
                let sol = if !solution_hex.is_empty() {
                    solution_hex.to_string()
                } else {
                    format!("{:08x}", (nonce & 0xFFFFFFFF) as u32)
                };
                json!({
                    "id": self.next_rpc_id(),
                    "method": "mining.submit",
                    "params": [worker, job_id, ntime, extranonce2, sol]
                })
            }
            _ => json!({
                "id": self.next_rpc_id(),
                "method": "mining.submit",
                "params": [worker, job_id, extranonce2, ntime, nonce_hex(nonce)]
            }),
        };

        match self.send_request(&req).await {
            Ok(resp) => Ok(parse_submit_response(&resp)),
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

    /// Return the latest job_id received from the upstream pool.
    /// Used by the runtime to detect stale shares before forwarding.
    pub async fn latest_job_id(&self) -> Option<String> {
        self.latest_job_id.lock().await.clone()
    }

    /// Return the elapsed time since the latest job was received.
    /// Returns `None` if no job has been received yet.
    /// Used for time-based staleness detection on fast-block coins.
    pub async fn latest_job_age(&self) -> Option<Duration> {
        self.latest_job_time.lock().await.map(|t| t.elapsed())
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

/// CryptonoteStratum (XMR) 32-bit nonce as an 8-char lowercase hex string.
fn cryptonote_nonce_hex(nonce: u64) -> String {
    format!("{:08x}", (nonce & 0xFFFFFFFF) as u32)
}

/// CryptonoteStratum (XMR) PoW result: 64-char lowercase hex string, no 0x prefix.
fn cryptonote_result_hex(hex: &str) -> String {
    hex.trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X")
        .to_lowercase()
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

/// Parse a standard JSON-RPC `mining.submit` or `eth_submitWork` response and
/// map it to a `ShareResult`.
fn parse_submit_response(value: &Value) -> ShareResult {
    let result = value.get("result");
    let error = value.get("error");

    match result {
        Some(v) if v.is_boolean() => {
            if v.as_bool() == Some(true) {
                ShareResult::Accepted
            } else {
                ShareResult::Rejected(error_message(value))
            }
        }
        Some(v) if v.is_null() => {
            if error.is_none_or(|e| e.is_null()) {
                ShareResult::Accepted
            } else {
                ShareResult::Rejected(error_message(value))
            }
        }
        _ => {
            if error.is_none_or(|e| e.is_null()) {
                ShareResult::Accepted
            } else {
                ShareResult::Rejected(error_message(value))
            }
        }
    }
}

/// Extract a human-readable error message from a JSON-RPC `error` field.
/// Pools may return errors as a string, an array `[code, message, ...]`, or
/// an object with a `message` key.
fn error_message(value: &Value) -> String {
    match value.get("error") {
        None | Some(Value::Null) => "rejected".to_string(),
        Some(v) if v.is_string() => v.as_str().unwrap_or("rejected").to_string(),
        Some(v @ Value::Array(arr)) => {
            if let Some(msg) = arr.get(1).and_then(Value::as_str) {
                msg.to_string()
            } else if let Some(msg) = arr.first().and_then(Value::as_str) {
                msg.to_string()
            } else if let Some(code) = arr.first().and_then(Value::as_i64) {
                format!("rejected (code {code})")
            } else {
                format!(
                    "rejected: {}",
                    v.to_string().chars().take(128).collect::<String>()
                )
            }
        }
        Some(v @ Value::Object(_)) => v
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("rejected")
            .to_string(),
        Some(v) => format!(
            "rejected: {}",
            v.to_string().chars().take(128).collect::<String>()
        ),
    }
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
    /// Block height / block number from the external pool (for DAG/epoch derivation).
    pub height: u64,
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
            height: j.height,
        }
    }
}

/// Share submission envelope used to pair a share with its response channel.
struct ShareSubmit {
    id: i64,
    share: super::Share,
    response: tokio::sync::oneshot::Sender<ShareResult>,
}

/// Simple Stratum v1 client for an external (AuxPoW) pool.
pub struct StratumClient {
    pub url: String,
    pub worker: String,
    pub password: String,
    /// External coin this client is mining (used for EthStratum polling).
    pub coin: zion_cosmic_harmony::ExternalCoin,
    job_rx: tokio::sync::mpsc::Receiver<StratumJob>,
    submit_tx: tokio::sync::mpsc::Sender<ShareSubmit>,
    next_id: Arc<Mutex<i64>>,
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
        coin: zion_cosmic_harmony::ExternalCoin,
    ) -> Self {
        let (job_tx, job_rx) = tokio::sync::mpsc::channel(8);
        let (submit_tx, submit_rx) = tokio::sync::mpsc::channel(256);
        let url = url.into();
        let worker = worker.into();
        let password = password.into();
        let next_id = Arc::new(Mutex::new(100i64));

        if !url.is_empty() {
            let pending = Arc::new(Mutex::new(HashMap::<
                i64,
                tokio::sync::oneshot::Sender<ShareResult>,
            >::new()));
            tokio::spawn(run_stratum_loop(
                url.clone(),
                worker.clone(),
                password.clone(),
                coin,
                job_tx,
                submit_rx,
                StratumState::new(),
                pending,
            ));
        }

        Self {
            url,
            worker,
            password,
            coin,
            job_rx,
            submit_tx,
            next_id,
        }
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

    /// Submit a share and wait for the pool's accepted/rejected response.
    pub async fn submit_share(&self, share: &super::Share) -> Result<ShareResult> {
        let id = {
            let mut id = self.next_id.lock().await;
            let current = *id;
            *id = id.wrapping_add(1);
            if *id <= 2 {
                *id = 3;
            }
            current
        };

        let (tx, rx) = tokio::sync::oneshot::channel();
        let submit = ShareSubmit {
            id,
            share: share.clone(),
            response: tx,
        };

        if let Err(e) = self.submit_tx.try_send(submit) {
            let (reason, submit) = match e {
                tokio::sync::mpsc::error::TrySendError::Full(s) => ("submit queue full", s),
                tokio::sync::mpsc::error::TrySendError::Closed(s) => ("submit channel closed", s),
            };
            let _ = submit
                .response
                .send(ShareResult::Rejected(reason.to_string()));
            return Ok(ShareResult::Rejected(reason.to_string()));
        }

        match tokio::time::timeout(Duration::from_secs(30), rx).await {
            Ok(Ok(result)) => Ok(result),
            Ok(Err(_)) => Ok(ShareResult::Rejected("response channel closed".to_string())),
            Err(_) => Ok(ShareResult::Rejected("response timeout".to_string())),
        }
    }
}

fn parse_url(url: &str) -> Result<(&str, u16)> {
    let trimmed = url
        .trim()
        .trim_start_matches("stratum+tcp://")
        .trim_start_matches("stratum://")
        .trim_start_matches("tcp://");
    let (host, port) = trimmed
        .rsplit_once(':')
        .ok_or_else(|| anyhow!("stratum url must be host:port or stratum+tcp://host:port"))?;
    let port = port.parse()?;
    Ok((host, port))
}

#[derive(Clone)]
struct StratumState {
    extranonce1: Arc<Mutex<Vec<u8>>>,
    extranonce2_size: Arc<Mutex<usize>>,
    difficulty: Arc<Mutex<f64>>,
    ntime: Arc<Mutex<String>>,
    /// Optional explicit target override sent by mining.set_target (2miners).
    target_bytes: Arc<Mutex<Option<[u8; 32]>>>,
}

impl StratumState {
    fn new() -> Self {
        Self {
            extranonce1: Arc::new(Mutex::new(Vec::new())),
            extranonce2_size: Arc::new(Mutex::new(0usize)),
            difficulty: Arc::new(Mutex::new(1.0f64)),
            ntime: Arc::new(Mutex::new("00000000".to_string())),
            target_bytes: Arc::new(Mutex::new(None)),
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_stratum_loop(
    url: String,
    worker: String,
    password: String,
    coin: zion_cosmic_harmony::ExternalCoin,
    job_tx: tokio::sync::mpsc::Sender<StratumJob>,
    mut submit_rx: tokio::sync::mpsc::Receiver<ShareSubmit>,
    state: StratumState,
    pending: Arc<Mutex<HashMap<i64, tokio::sync::oneshot::Sender<ShareResult>>>>,
) {
    loop {
        if let Err(e) = stratum_session(
            &url,
            &worker,
            &password,
            coin,
            &job_tx,
            &mut submit_rx,
            &state,
            &pending,
        )
        .await
        {
            ext_warn!(url = %url, error = %e, "stratum session failed, reconnecting in 5s");
        } else {
            ext_warn!(url = %url, "stratum session ended, reconnecting in 5s");
        }

        // Reject any outstanding submissions before reconnecting.
        let mut p = pending.lock().await;
        for (_, sender) in p.drain() {
            let _ = sender.send(ShareResult::Rejected(
                "stratum connection reset".to_string(),
            ));
        }

        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

#[allow(clippy::too_many_arguments)]
async fn stratum_session(
    url: &str,
    worker: &str,
    password: &str,
    coin: zion_cosmic_harmony::ExternalCoin,
    job_tx: &tokio::sync::mpsc::Sender<StratumJob>,
    submit_rx: &mut tokio::sync::mpsc::Receiver<ShareSubmit>,
    state: &StratumState,
    pending: &Mutex<HashMap<i64, tokio::sync::oneshot::Sender<ShareResult>>>,
) -> Result<()> {
    let (host, port) = parse_url(url)?;
    ext_info!(host = %host, port = port, "connecting to stratum pool");
    let mut stream = TcpStream::connect((host, port)).await?;
    let (reader, mut writer) = stream.split();
    let mut lines = BufReader::new(reader).lines();

    let subscribe =
        json!({"id": 1, "method": "mining.subscribe", "params": ["zion-miner/3.1.0", null]});
    send_line(&mut writer, &subscribe).await?;
    let auth = json!({"id": 2, "method": "mining.authorize", "params": [worker, password]});
    send_line(&mut writer, &auth).await?;

    // EthStratum (EthereumStratum / 2miners) uses `eth_getWork` instead of
    // `mining.notify`. Poll the pool for new work every few seconds.
    let is_ethstratum = coin_protocol(coin) == StratumProtocol::EthStratum;
    let mut eth_getwork_interval = tokio::time::interval_at(
        tokio::time::Instant::now() + Duration::from_secs(3),
        Duration::from_secs(3),
    );
    eth_getwork_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    let mut pending_submits: std::collections::VecDeque<ShareSubmit> =
        std::collections::VecDeque::new();

    loop {
        tokio::select! {
            _tick = eth_getwork_interval.tick(), if is_ethstratum => {
                let req = json!({"id": ETH_GETWORK_ID, "method": "eth_getWork", "params": []});
                if let Err(e) = send_line(&mut writer, &req).await {
                    ext_warn!(error = %e, "failed to send eth_getWork poll");
                }
            }
            line = lines.next_line() => match line {
                Ok(Some(line)) => {
                    if line.trim().is_empty() {
                        continue;
                    }
                    if let Err(e) = handle_line(&line, job_tx, state, pending).await {
                        ext_warn!(line = %line, error = %e, "stratum line parse failed");
                    }
                }
                Ok(None) => {
                    ext_warn!("stratum server closed connection");
                    return Ok(());
                }
                Err(e) => return Err(e.into()),
            },
            submit = submit_rx.recv() => match submit {
                Some(req) => {
                    pending_submits.push_back(req);
                    while let Some(req) = pending_submits.pop_front() {
                        match send_submit(&mut writer, worker, req.id, &req.share).await {
                            Ok(()) => {
                                pending.lock().await.insert(req.id, req.response);
                            }
                            Err(e) => {
                                ext_warn!(error = %e, "failed to send share");
                                let _ = req.response.send(ShareResult::Rejected("failed to send share".to_string()));
                            }
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
    pending: &Mutex<HashMap<i64, tokio::sync::oneshot::Sender<ShareResult>>>,
) -> Result<()> {
    let value: Value = serde_json::from_str(line)?;
    if let Some(id) = value.get("id").and_then(Value::as_i64) {
        match id {
            1 => {
                parse_subscribe_response(&value, state).await?;
                return Ok(());
            }
            2 => {
                if !is_authorize_ok(&value) {
                    bail!("stratum authorize failed");
                }
                ext_info!("stratum authorized");
                return Ok(());
            }
            ETH_GETWORK_ID => {
                if let Some(job) = parse_eth_getwork(&value) {
                    let _ = job_tx.send(job).await;
                }
                return Ok(());
            }
            _ => {
                if let Some(sender) = pending.lock().await.remove(&id) {
                    let _ = sender.send(parse_submit_response(&value));
                    return Ok(());
                }
            }
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
                ext_info!(difficulty = d, "stratum set difficulty");
            }
        }
        "mining.set_extranonce" | "set_extranonce" => {
            if let Some((en1, en2_size)) = params_extranonce(&value) {
                let mut e1 = state.extranonce1.lock().await;
                *e1 = en1;
                let mut e2 = state.extranonce2_size.lock().await;
                *e2 = en2_size;
                ext_info!(extranonce1 = %hex::encode(&*e1), extranonce2_size = en2_size, "stratum set extranonce");
            }
        }
        "mining.set_target" | "set_target" => {
            if let Some(params) = value.get("params").and_then(Value::as_array) {
                if let Some(target_hex) = params.first().and_then(Value::as_str) {
                    if let Some(target) = hasher::parse_target_hex(target_hex) {
                        *state.target_bytes.lock().await = Some(target);
                        // Also update difficulty for consistency.
                        let max_target = [0xFFu8; 32];
                        let diff = hasher::target_to_difficulty_with_max(&target, &max_target);
                        *state.difficulty.lock().await = diff;
                        ext_info!(target = %hex::encode(target), difficulty = diff, "stratum set target");
                    }
                }
            }
        }
        "eth_getWork" | "job" => {
            if let Some(job) = parse_eth_getwork(&value) {
                let _ = job_tx.send(job).await;
            }
        }
        _ => {}
    }
    Ok(())
}

async fn parse_subscribe_response(value: &Value, state: &StratumState) -> Result<()> {
    if let Some(arr) = value.get("result").and_then(Value::as_array) {
        if arr.len() >= 3 && arr[1].is_string() && arr[2].is_u64() {
            // Standard Stratum v1 subscribe: [session_id, extranonce1, extranonce2_size]
            let e1 = parse_hex_value(&arr[1]).unwrap_or_default();
            let size = arr[2].as_u64().unwrap_or(0) as usize;
            let mut e1_lock = state.extranonce1.lock().await;
            *e1_lock = e1;
            let mut size_lock = state.extranonce2_size.lock().await;
            *size_lock = size;
            ext_info!(extranonce2_size = size, "stratum subscribed");
        } else if arr.len() >= 2 && arr[0].as_bool() == Some(true) && arr[1].is_string() {
            // EthereumStratum/1.0.0 subscribe: [true, "EthereumStratum/1.0.0"]
            // The pool sends the real extranonce1 via a later set_extranonce
            // notification (e.g. 2miners KAS/ALPH).
            ext_info!(result = %arr[1], "stratum subscribed (EthereumStratum/1.0.0)");
        } else if !arr.is_empty() && arr[0].as_bool() == Some(true) {
            ext_info!("stratum subscribed");
        }
    }
    Ok(())
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

/// Parse an `eth_getWork` JSON-RPC response or notification.
///
/// Standard format is `[header_hash, seed_hash, target, block_number]`
/// where header_hash and target are 64-character (32-byte) hex strings.
fn parse_eth_getwork(value: &Value) -> Option<StratumJob> {
    let params = value
        .get("result")
        .and_then(Value::as_array)
        .or_else(|| value.get("params").and_then(Value::as_array))?
        .clone();
    if params.len() < 3 {
        return None;
    }

    let header = parse_hex_value(&params[0]).unwrap_or_default();
    let target = hasher::parse_target_hex(params[2].as_str().unwrap_or("")).unwrap_or([0xFF; 32]);
    let height = params
        .get(3)
        .and_then(|v| {
            v.as_u64().or_else(|| {
                v.as_str()
                    .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok())
            })
        })
        .unwrap_or(0);

    Some(StratumJob {
        job_id: height.to_string(),
        header,
        target,
        extranonce1: Vec::new(),
        extranonce2_size: 0,
        ntime: "00000000".to_string(),
        difficulty: 1.0,
        coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
        height,
    })
}

async fn parse_notify(params: &[Value], state: &StratumState) -> Option<StratumJob> {
    // KaspaStratum / EthereumStratum/1.0.0 variant:
    //   [job_id, [u64_le x 4], timestamp_ms]
    // The four u64s are the 32-byte pre_pow_hash in little-endian u64s.
    // The timestamp is the block timestamp in milliseconds.
    if params.len() == 3 {
        if let Some(u64s) = params[1].as_array() {
            if u64s.len() == 4 {
                let job_id = params[0].as_str().unwrap_or("").to_string();
                let timestamp = params[2].as_u64().unwrap_or(0);
                let mut pre_pow_hash = Vec::with_capacity(32);
                for v in u64s {
                    let n = v.as_u64().unwrap_or(0);
                    pre_pow_hash.extend_from_slice(&n.to_le_bytes());
                }

                // The GPU/CPU kheavyhash path needs the 32-byte pre_pow_hash
                // and the timestamp.  Pack them into the header so both paths
                // can extract what they need (first 32 bytes for the hash,
                // bytes 32..40 for the timestamp on the GPU path).
                let mut header = pre_pow_hash;
                header.extend_from_slice(&timestamp.to_le_bytes());

                let difficulty = *state.difficulty.lock().await;
                let target = if let Some(target) = *state.target_bytes.lock().await {
                    target
                } else {
                    let max_target = hasher::algorithm_max_target("kheavyhash");
                    hasher::difficulty_to_target_with_max(difficulty, &max_target)
                };

                return Some(StratumJob {
                    job_id,
                    header,
                    target,
                    extranonce1: state.extranonce1.lock().await.clone(),
                    extranonce2_size: *state.extranonce2_size.lock().await,
                    ntime: format!("{:016x}", timestamp),
                    difficulty,
                    coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
                    height: timestamp,
                });
            }
        }
    }

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
        // Honor an explicit mining.set_target override (used by the ZION pool's
        // per-session vardiff). If none was sent, fall back to the target in the
        // mining.notify message.
        let target = if let Some(tb) = *state.target_bytes.lock().await {
            tb
        } else {
            hasher::parse_target_hex(target_hex).unwrap_or([0xFF; 32])
        };
        let height = params.get(3).and_then(Value::as_u64).unwrap_or(0);
        return Some(StratumJob {
            job_id,
            header,
            target,
            extranonce1: state.extranonce1.lock().await.clone(),
            extranonce2_size: *state.extranonce2_size.lock().await,
            ntime: "00000000".to_string(),
            difficulty: *state.difficulty.lock().await,
            coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
            height,
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

            // Honor an explicit mining.set_target override (used by the ZION pool's
            // per-session vardiff and mock pools). If none was sent, fall back to
            // the target encoded in nbits.
            let target = if let Some(tb) = *state.target_bytes.lock().await {
                tb
            } else {
                hasher::parse_target_hex(nbits)
                    .or_else(|| hasher::nbits_to_target(nbits))
                    .unwrap_or([0xFF; 32])
            };

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

            let height = params.get(9).and_then(Value::as_u64).unwrap_or(0);
            return Some(StratumJob {
                job_id,
                header,
                target,
                extranonce1: en1,
                extranonce2_size: *state.extranonce2_size.lock().await,
                ntime,
                difficulty: *state.difficulty.lock().await,
                coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
                height,
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
        let header = if prevhash.is_empty() {
            vec![0u8; 32]
        } else {
            prevhash
        };
        let height = params.get(9).and_then(Value::as_u64).unwrap_or(0);
        return Some(StratumJob {
            job_id,
            header,
            target,
            extranonce1: state.extranonce1.lock().await.clone(),
            extranonce2_size: *state.extranonce2_size.lock().await,
            ntime,
            difficulty: *state.difficulty.lock().await,
            coin: zion_cosmic_harmony::ExternalCoin::Bitcoin,
            height,
        });
    }

    ext_warn!(len = params.len(), "unsupported mining.notify param count");
    None
}

/// Build the `mining.submit` / `eth_submitWork` params for a given share,
/// taking into account the coin/algorithm-specific requirements.
fn build_submit_params(worker: &str, share: &super::Share, id: i64) -> Value {
    let algo = share.coin.algorithm();
    let nonce = share.nonce_hex();
    let mix = share.mix_hash_hex();
    let sol = share.solution_hex();

    // Kaspa / kHeavyHash (KaspaStratum / 2miners):
    //   mining.submit params = [worker, job_id, full_nonce_hex]
    // The nonce is the full 8-byte value (extranonce1 prefix + scanned suffix)
    // rendered as a 16-character big-endian hex number.
    if algo.contains("kheavyhash") {
        return json!({"id": id, "method": "mining.submit", "params": [worker, share.job_id, nonce]});
    }

    // DAG-based Ethash / ProgPoW variants: EthereumStratum uses eth_submitWork
    // with [nonce, header_hash, mix_hash]. The original 32-byte header hash is
    // required, not the final PoW hash; the pool recomputes the final hash.
    if algo.contains("ethash") || algo == "etchash" || algo == "progpowz" || algo == "epic" {
        let nonce = format!("0x{nonce}");
        let header = format!("0x{}", hex::encode(share.header_hash));
        let mix = mix.unwrap_or_else(|| format!("0x{}", hex::encode([0u8; 32])));
        return json!({"id": id, "method": "eth_submitWork", "params": [nonce, header, mix]});
    }

    // KawPow / ProgPow variants: many pools expect mix_hash as a 6th param.
    if algo.contains("kawpow")
        || algo.contains("progpow")
        || algo == "evrprogpow"
        || algo == "meowpow"
    {
        let mut params = json!([worker, share.job_id, share.extranonce2, share.ntime, nonce]);
        if let Some(mix) = mix {
            params
                .as_array_mut()
                .unwrap()
                .push(json!(format!("0x{mix}")));
        }
        return json!({"id": id, "method": "mining.submit", "params": params});
    }

    // VerusHash (VRSC / ZcashStratum): submit the 5-param Zcash format
    // [worker, job_id, ntime, nonce2, solution_with_varint]. The nonce2 field
    // is all zeros because the found nonce lives in the solution nonceSpace.
    if algo.contains("verushash") {
        if let Some(sol) = sol {
            return json!({"id": id, "method": "mining.submit", "params": [worker, share.job_id, share.ntime, share.extranonce2, sol]});
        }
    }

    // Equihash / BeamHash / ZelHash: the actual solution is the proof.
    if algo.contains("equihash") || algo.contains("zelhash") || algo.contains("beamhash") {
        if let Some(sol) = sol {
            return json!({"id": id, "method": "mining.submit", "params": [worker, share.job_id, share.ntime, share.extranonce2, sol]});
        }
    }

    // Default Bitcoin-style / kHeavyHash / blake3 stratum submit.
    json!({"id": id, "method": "mining.submit", "params": [worker, share.job_id, share.extranonce2, share.ntime, nonce]})
}

async fn send_submit(
    writer: &mut tokio::net::tcp::WriteHalf<'_>,
    worker: &str,
    id: i64,
    share: &super::Share,
) -> Result<()> {
    send_line(writer, &build_submit_params(worker, share, id)).await
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
        assert_eq!(
            coin_protocol(ExternalCoin::Monero),
            StratumProtocol::CryptonoteStratum
        );
        assert_eq!(
            coin_protocol(ExternalCoin::Verus),
            StratumProtocol::ZcashStratum
        );
        assert_eq!(
            coin_protocol(ExternalCoin::EpicCash),
            StratumProtocol::EpicStratum
        );
        assert_eq!(
            coin_protocol(ExternalCoin::Zano),
            StratumProtocol::EthStratum
        );
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

        let mut client = StratumClient::new(
            format!("127.0.0.1:{}", port),
            "worker",
            "x",
            ExternalCoin::Kaspa,
        );
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

        let client = StratumClient::new(
            format!("127.0.0.1:{}", port),
            "worker",
            "x",
            ExternalCoin::Kaspa,
        );
        let share = super::super::Share {
            job_id: "mock_job".to_string(),
            coin: ExternalCoin::Kaspa,
            nonce: 42,
            hash: [0u8; 32],
            header_hash: [0u8; 32],
            mix_hash: None,
            solution: None,
            extranonce2: "00".to_string(),
            ntime: "00000000".to_string(),
        };
        let result = client.submit_share(&share).await.unwrap();
        assert_eq!(result, ShareResult::Accepted);
        server.abort();
    }

    #[tokio::test]
    async fn auxpow_client_honors_client_reconnect_and_is_idempotent() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::Arc;
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let request_count = Arc::new(AtomicUsize::new(0));
        let request_count_clone = Arc::clone(&request_count);

        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.split();
            let mut lines = BufReader::new(reader).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains("mining.subscribe") {
                    request_count_clone.fetch_add(1, Ordering::SeqCst);
                    let resp = r#"{"id":1,"result":["s1","0011"],"error":null}"#;
                    let _ = writer.write_all(resp.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;
                } else if line.contains("mining.authorize") {
                    request_count_clone.fetch_add(1, Ordering::SeqCst);
                    let resp = r#"{"id":2,"result":true,"error":null}"#;
                    let _ = writer.write_all(resp.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;

                    // LuckPool-style client.reconnect request.
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    let reconnect = r#"{"id":null,"method":"client.reconnect","params":[]}"#;
                    let _ = writer.write_all(reconnect.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.flush().await;
                    break;
                }
            }
        });

        let cfg = AuxPowClientConfig::new(
            ExternalCoin::Verus,
            format!("127.0.0.1:{}", port),
            "worker",
            "x",
        );
        let client = AuxPowClient::new(cfg);

        // Initial connect + handshake.
        tokio::time::timeout(Duration::from_secs(2), client.connect("RRRR"))
            .await
            .unwrap()
            .unwrap();
        assert!(client.is_connected().await);
        assert_eq!(request_count.load(Ordering::SeqCst), 2);

        // A second connect() call must be a no-op now that the poll task is
        // running — this is what prevents the reconnect storm.
        tokio::time::timeout(Duration::from_secs(2), client.connect("RRRR"))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(request_count.load(Ordering::SeqCst), 2);

        // After client.reconnect is processed the client should disconnect and
        // let its background reconnect task take over.
        tokio::time::timeout(Duration::from_secs(2), async {
            while client.is_connected().await {
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        })
        .await
        .unwrap();

        server.abort();
    }

    #[test]
    fn cryptonote_nonce_and_result_format() {
        assert_eq!(cryptonote_nonce_hex(0x1234abcd), "1234abcd");
        assert_eq!(cryptonote_nonce_hex(0x1), "00000001");
        // Nonce is masked to 32 bits.
        assert_eq!(cryptonote_nonce_hex(0x1_1234abcd), "1234abcd");

        assert_eq!(cryptonote_result_hex("0xABCD1234"), "abcd1234");
        assert_eq!(cryptonote_result_hex("  0xABCD1234  "), "abcd1234");
    }
}
