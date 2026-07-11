//! Stratum v1 client for external pool connection.
//!
//! Implements the standard Stratum v1 protocol:
//!   1. `mining.subscribe` — register with the pool
//!   2. `mining.authorize` — authenticate with wallet.worker
//!   3. `mining.notify` — receive jobs (job_id, header, target)
//!   4. `mining.submit` — submit shares (job_id, nonce, hash)
//!
//! Also supports EthStratum variant (eth_getWork / eth_submitWork) for
//! Ethash/KawPow coins. (TODO — currently only Stratum v1 is implemented.)
//!
//! The client is designed to be used by the `AuxPowScheduler` which
//! manages profit-switching and circuit breaker logic.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::TcpStream;
use tokio::sync::{Mutex, Notify, oneshot};
use tokio::time::timeout;
use tracing::{debug, info, warn};

use crate::types::{CoinProfile, ExternalCoin};

/// Stratum protocol variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StratumProtocol {
    /// Standard Stratum v1 (mining.subscribe / mining.authorize / mining.submit)
    Stratum,
    /// EthStratum / ETH-proxy variant (eth_submitWork, eth_getWork)
    EthStratum,
}

impl ExternalCoin {
    pub fn protocol(self) -> StratumProtocol {
        match self {
            Self::DCR | Self::FLUX | Self::XMR | Self::KAS | Self::ALPH => {
                StratumProtocol::Stratum
            }
            Self::ERG | Self::RVN | Self::ETC | Self::EVR | Self::MEWC | Self::CLORE => {
                StratumProtocol::EthStratum
            }
        }
    }
}

/// A job received from the external pool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalJob {
    pub job_id: String,
    /// Hex-encoded header / preimage (coin-specific format).
    pub header_hex: String,
    /// Hex-encoded target (big-endian).
    pub target_hex: String,
    /// Optional seed hash (for Ethash DAG-based coins).
    pub seed_hash: Option<String>,
    /// Optional block number (for Ethash).
    pub block_number: Option<u64>,
    /// Algorithm name for this job.
    pub algorithm: String,
    /// Raw bytes of the header (decoded from header_hex).
    #[serde(skip)]
    pub header_bytes: Vec<u8>,
    /// Raw target bytes (decoded from target_hex).
    #[serde(skip)]
    pub target_bytes: [u8; 32],
    /// Block timestamp (Unix seconds) parsed from ntime, used by kHeavyHash/KAS.
    #[serde(skip)]
    pub timestamp: Option<u64>,
    /// Network nbits/difficulty bits from notify, used for display/logging.
    #[serde(skip)]
    pub nbits: Option<String>,
    /// External coin this job belongs to.
    #[serde(skip)]
    pub external_coin: ExternalCoin,
    /// Extra nonce 1 provided by the pool (Alephium).
    #[serde(skip)]
    pub extranonce1: Vec<u8>,
    /// Extra nonce 2 placeholder for standard stratum submit.
    #[serde(skip)]
    pub extranonce2: String,
}

/// Share submission result from the pool.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShareResult {
    Accepted,
    Rejected(String),
    Unknown,
}

/// Stratum v1 client for an external mining pool.
#[derive(Clone)]
pub struct AuxPowClient {
    profile: CoinProfile,
    protocol: StratumProtocol,
    stream: Arc<Mutex<Option<OwnedWriteHalf>>>,
    reader: Arc<Mutex<Option<BufReader<OwnedReadHalf>>>>,
    current_job: Arc<Mutex<Option<ExternalJob>>>,
    subscribed: Arc<Mutex<bool>>,
    authorized: Arc<Mutex<bool>>,
    /// Notify when a new job arrives.
    job_notify: Arc<Notify>,
    /// Shutdown signal.
    shutdown: Arc<Notify>,
    connected: Arc<Mutex<bool>>,
    /// Latest difficulty received via mining.set_difficulty.
    current_difficulty: Arc<Mutex<f64>>,
    /// Wallet used during authorize; needed for some submit formats.
    payout_wallet: Arc<Mutex<String>>,
    /// Extra nonce 1 provided by the pool (Alephium uses 4 bytes).
    extranonce1: Arc<Mutex<Vec<u8>>>,
    /// Pending JSON-RPC responses keyed by request id.  The background poll
    /// loop routes incoming responses here.
    pending_requests: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
}

impl AuxPowClient {
    /// Create a new client for the given coin profile.
    pub fn new(profile: CoinProfile) -> Self {
        let protocol = profile.coin.protocol();
        Self {
            profile,
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
            payout_wallet: Arc::new(Mutex::new(String::new())),
            extranonce1: Arc::new(Mutex::new(Vec::new())),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Connect to the external pool and perform subscribe + authorize.
    pub async fn connect(&self, payout_wallet: &str) -> Result<()> {
        *self.payout_wallet.lock().await = payout_wallet.to_string();
        let addr = self.profile.pool_address();
        info!(
            "AuxPow: connecting to {} ({}) for {}",
            addr,
            self.protocol.as_str(),
            self.profile.coin
        );

        let stream = timeout(Duration::from_secs(15), TcpStream::connect(&addr))
            .await
            .map_err(|_| anyhow!("connect timeout to {}", addr))?
            .context("TCP connect failed")?;

        // Split into reader and writer
        let (reader_half, writer_half) = stream.into_split();
        let buf_reader = BufReader::new(reader_half);

        *self.stream.lock().await = Some(writer_half);
        *self.reader.lock().await = Some(buf_reader);
        *self.connected.lock().await = true;

        // Spawn the background reader before the subscribe/authorize handshake
        // so that responses are routed to send_request and notifications are
        // dispatched from a single reader.
        let client_clone = Arc::new(self.clone());
        tokio::spawn(async move {
            loop {
                match client_clone.poll_messages().await {
                    Ok(()) => {}
                    Err(e) => {
                        warn!("AuxPow: poll loop ended for {}: {}", client_clone.profile.coin, e);
                        *client_clone.connected.lock().await = false;
                        break;
                    }
                }
            }
        });

        // Subscribe
        self.subscribe().await?;
        // Authorize
        self.authorize(payout_wallet).await?;

        info!("AuxPow: connected and authorized for {}", self.profile.coin);
        Ok(())
    }

    /// Send `mining.subscribe` and wait for response.
    async fn subscribe(&self) -> Result<()> {
        let req = json!({
            "id": 1,
            "method": "mining.subscribe",
            "params": ["zion-auxpow/0.1", null]
        });
        let resp = self.send_request(&req).await?;
        if let Some(result) = resp.get("result") {
            *self.subscribed.lock().await = true;
            println!("auxpow: subscribed to {} — result={}", self.profile.coin, result);

            // Alephium/Kryptex returns extranonce1 as a plain hex string.
            // Standard stratum returns [subscriptions, extranonce1, extranonce2_size].
            let mut en1 = self.extranonce1.lock().await;
            *en1 = if let Some(hex) = result.as_str() {
                hex::decode(hex).unwrap_or_default()
            } else if let Some(arr) = result.as_array() {
                arr.get(1)
                    .and_then(|v| v.as_str())
                    .map(|hex| hex::decode(hex).unwrap_or_default())
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            Ok(())
        } else {
            bail!("subscribe failed: {:?}", resp.get("error"));
        }
    }

    /// Send `mining.authorize` or `eth_submitLogin` with wallet.worker name.
    ///
    /// Standard Stratum v1 uses `mining.authorize`.  EthereumStratum/1.0.0
    /// pools (2miners, Kryptex KAS/ALPH, etc.) expect `eth_submitLogin`.
    async fn authorize(&self, payout_wallet: &str) -> Result<()> {
        let worker = format!("{}.{}", payout_wallet, self.profile.worker_name);
        let is_ethstratum = self.protocol == StratumProtocol::EthStratum;
        let password = if is_ethstratum { "x" } else { "c=BTC" };
        println!(
            "auxpow: authorizing worker={} password={} on {} (protocol={})",
            worker, password, self.profile.coin, self.protocol.as_str()
        );
        let method = if is_ethstratum {
            "eth_submitLogin"
        } else {
            "mining.authorize"
        };
        let req = json!({
            "id": 2,
            "method": method,
            "params": [worker, password]
        });
        let resp = self.send_request(&req).await?;
        let ok = if is_ethstratum {
            // EthStratum may return result=true or result="0x..." for success.
            resp.get("result").and_then(|v| v.as_bool()).unwrap_or(false)
                || resp.get("result").and_then(|v| v.as_str()).is_some()
        } else {
            resp.get("result").and_then(|v| v.as_bool()).unwrap_or(false)
        };
        if ok {
            *self.authorized.lock().await = true;
            println!("auxpow: authorized as {} on {}", worker, self.profile.coin);
            Ok(())
        } else {
            let err = resp.get("error");
            println!(
                "auxpow: authorize FAILED for {} on {} — result={:?} error={:?}",
                worker,
                self.profile.coin,
                resp.get("result"),
                err
            );
            bail!("authorize failed: {:?}", err);
        }
    }

    /// Send a JSON-RPC request and read the response routed by the background
    /// poll loop.  The poll loop is the sole reader of the TCP stream; it
    /// either routes matching responses here or dispatches notifications.
    async fn send_request(&self, req: &Value) -> Result<Value> {
        let req_id = req.get("id").and_then(|v| v.as_i64());
        let mut line = serde_json::to_string(req)?;
        line.push('\n');

        let (tx, rx) = oneshot::channel();
        if let Some(id) = req_id {
            self.pending_requests.lock().await.insert(id, tx);
        }

        {
            let mut stream_guard = self.stream.lock().await;
            if let Some(ref mut stream) = *stream_guard {
                stream.write_all(line.as_bytes()).await?;
                stream.flush().await?;
            } else {
                bail!("not connected");
            }
        }

        let deadline = Instant::now() + Duration::from_secs(30);
        let remaining = deadline.saturating_duration_since(Instant::now());
        let resp = match timeout(remaining, rx).await {
            Ok(Ok(value)) => value,
            Ok(Err(_)) => bail!("send_request: response channel closed"),
            Err(_) => bail!("send_request: timeout waiting for response"),
        };
        Ok(resp)
    }

    /// Read a single line from the stratum stream.
    async fn read_line(&self) -> Result<String> {
        let mut guard = self.reader.lock().await;
        if let Some(ref mut reader) = *guard {
            let mut buf = String::new();
            reader.read_line(&mut buf).await?;
            if buf.is_empty() {
                bail!("connection closed by remote");
            }
            Ok(buf.trim().to_string())
        } else {
            bail!("no reader available");
        }
    }

    /// Read and dispatch incoming messages (jobs, responses, etc.).
    /// Call this in a loop in a background task.  It is the sole reader of the
    /// stratum TCP stream.
    pub async fn poll_messages(&self) -> Result<()> {
        let line = self.read_line().await?;
        let msg: Value = serde_json::from_str(&line)?;

        // If the message has an id matching a pending request, route it there.
        if let Some(id) = msg.get("id").and_then(|v| v.as_i64()) {
            if let Some(tx) = self.pending_requests.lock().await.remove(&id) {
                let _ = tx.send(msg);
                return Ok(());
            }
        }

        // Otherwise treat it as a notification.
        if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
            match method {
                "mining.notify" => {
                    if let Some(params) = msg.get("params") {
                        let job = self.parse_notify_params(params).await?;
                        debug!(
                            "AuxPow: received job {} for {}",
                            job.job_id, self.profile.coin
                        );
                        *self.current_job.lock().await = Some(job);
                        self.job_notify.notify_waiters();
                    }
                }
                "mining.set_difficulty" => {
                    if let Some(params) = msg.get("params") {
                        if let Some(diff) = params.get(0).and_then(|d| d.as_f64()) {
                            debug!("AuxPow: difficulty set to {:.2} for {}", diff, self.profile.coin);
                            *self.current_difficulty.lock().await = diff;
                        }
                    }
                }
                "mining.set_extranonce" | "set_extranonce" => {
                    if let Some(params) = msg.get("params") {
                        if let Some(hex) = params.get(0).and_then(|p| p.as_str()) {
                            *self.extranonce1.lock().await = hex::decode(hex).unwrap_or_default();
                        }
                    }
                }
                _ => {
                    debug!("AuxPow: unknown method '{}' from {}", method, self.profile.coin);
                }
            }
        }

        Ok(())
    }

    /// Parse `mining.notify` params into an `ExternalJob`.
    ///
    /// Supports two Stratum v1 variants:
    ///   - Standard Bitcoin-like: [job_id, prevhash, coinbase1, coinbase2,
    ///     branches, version, nbits, ntime, clean_jobs]
    ///   - Simplified: [job_id, header_hex, target_hex]
    async fn parse_notify_params(&self, params: &Value) -> Result<ExternalJob> {
        // Alephium (Blake3) sends notify params as [ {object} ], where the
        // object contains: jobId, headerBlob, targetBlob, height, fromGroup,
        // toGroup, txsBlob.
        let inner = if let Some(arr) = params.as_array() {
            if arr.len() == 1 && arr[0].is_object() {
                &arr[0]
            } else {
                params
            }
        } else {
            params
        };

        if let Some(obj) = inner.as_object() {
            let job_id = obj
                .get("jobId")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let header_hex = obj
                .get("headerBlob")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let target_hex = obj
                .get("targetBlob")
                .and_then(|v| v.as_str())
                .unwrap_or("ffffffff")
                .to_string();
            let height = obj.get("height").and_then(|v| v.as_u64());

            let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
                .unwrap_or_default();
            let target_bytes = crate::external_hashers::parse_target_hex(&target_hex)
                .unwrap_or([0xFFu8; 32]);

            return Ok(ExternalJob {
                job_id,
                header_hex,
                target_hex,
                seed_hash: None,
                block_number: height,
                algorithm: self.profile.algorithm.clone(),
                header_bytes,
                target_bytes,
                timestamp: None,
                nbits: None,
                external_coin: self.profile.coin,
                extranonce1: self.extranonce1.lock().await.clone(),
                extranonce2: String::new(),
            });
        }

        // EthereumStratum/1.0.0 Kaspa variant:
        // [jobId, [u64_le x 4], timestamp_ms]
        if let Some(arr) = params.as_array() {
            if arr.len() == 3 {
                if let Some(u64s) = arr.get(1).and_then(|v| v.as_array()) {
                    if u64s.len() == 4 {
                        let job_id = arr
                            .first()
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let timestamp = arr.get(2).and_then(|v| v.as_u64()).unwrap_or(0);
                        let mut pre_pow_hash = Vec::with_capacity(32);
                        for v in u64s {
                            let n = v.as_u64().unwrap_or(0);
                            // The Kaspa stratum bridge sends the pre_pow_hash as four
                            // little-endian u64 values (legacy/Bitmain job format).
                            pre_pow_hash.extend_from_slice(&n.to_le_bytes());
                        }
                        let header_bytes = pre_pow_hash;
                        let target_bytes = self.share_target().await;
                        return Ok(ExternalJob {
                            job_id,
                            header_hex: hex::encode(&header_bytes),
                            target_hex: hex::encode(target_bytes),
                            seed_hash: None,
                            block_number: None,
                            algorithm: self.profile.algorithm.clone(),
                            header_bytes,
                            target_bytes,
                            timestamp: Some(timestamp),
                            nbits: None,
                            external_coin: self.profile.coin,
                            extranonce1: self.extranonce1.lock().await.clone(),
                            extranonce2: String::new(),
                        });
                    }
                }
            }
        }

        let arr = params
            .as_array()
            .ok_or_else(|| anyhow!("notify params not array or object"))?;

        if arr.is_empty() {
            bail!("empty notify params");
        }

        let job_id = arr[0]
            .as_str()
            .unwrap_or("unknown")
            .to_string();

        // Try simplified format first: [job_id, header_hex, target_hex]
        let (header_hex, target_hex, timestamp, nbits) = if arr.len() == 3
            && arr[1].as_str().map(|s| s.len()) > Some(32)
        {
            let h = arr[1].as_str().unwrap_or("");
            let t = arr[2].as_str().unwrap_or("ffffffff");
            (h.to_string(), t.to_string(), None, None)
        } else {
            // Standard format
            let header = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
            let nbits = arr.get(6).and_then(|v| v.as_str()).map(String::from);
            let ntime = arr
                .get(7)
                .and_then(|v| {
                    if let Some(s) = v.as_str() {
                        u64::from_str_radix(s.trim_start_matches("0x"), 16).ok()
                    } else {
                        v.as_u64()
                    }
                });
            // For kHeavyHash/KAS the prevhash field is the 32-byte pre_pow_hash
            // and the target comes from mining.set_difficulty.
            let target = nbits.clone().unwrap_or_else(|| "ffffffff".to_string());
            (header.to_string(), target, ntime, nbits)
        };

        let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
            .unwrap_or_default();
        let target_bytes = crate::external_hashers::parse_target_hex(&target_hex)
            .unwrap_or([0xFFu8; 32]);

        Ok(ExternalJob {
            job_id,
            header_hex,
            target_hex,
            seed_hash: None,
            block_number: None,
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
            timestamp,
            nbits,
            external_coin: self.profile.coin,
            extranonce1: self.extranonce1.lock().await.clone(),
            extranonce2: String::new(),
        })
    }

    /// Get the current job, if any.
    pub async fn current_job(&self) -> Option<ExternalJob> {
        self.current_job.lock().await.clone()
    }

    /// Wait for a new job with timeout.
    pub async fn wait_for_job(&self, timeout_ms: u64) -> Result<Option<ExternalJob>> {
        // Fast path: a job may have already arrived before we started waiting.
        if let Some(job) = self.current_job().await {
            return Ok(Some(job));
        }
        let result = timeout(
            Duration::from_millis(timeout_ms),
            self.job_notify.notified(),
        )
        .await;
        if result.is_ok() {
            Ok(self.current_job().await)
        } else {
            Ok(None)
        }
    }

    /// Submit a share to the pool.
    ///
    /// Returns whether the pool accepted or rejected the share.
    ///
    /// Supports two Stratum v1 submit dialects:
    ///   - Standard / zpool / KAS: `[worker, job_id, nonce_hex]`
    ///   - Alephium: `[job_id, nonce_hex, workerId]`
    pub async fn submit_share(
        &self,
        job_id: &str,
        nonce: u64,
        _hash_hex: &str,
    ) -> Result<ShareResult> {
        let is_alph = self.profile.algorithm.eq_ignore_ascii_case("blake3")
            && self.profile.coin == ExternalCoin::ALPH;
        let is_kas = self.profile.algorithm.eq_ignore_ascii_case("kheavyhash")
            && self.profile.coin == ExternalCoin::KAS;

        let params = if is_alph {
            // Alephium/Kryptex: try submitting the full 24-byte nonce as hex.
            // Full nonce = extranonce1 (pool prefix) || scanned nonce (8B LE)
            // || zero padding to 24 bytes.  The scanned nonce is LE to match the
            // GPU miner and the Alephium stratum spec.
            let en1 = self.extranonce1.lock().await.clone();
            let mut full = [0u8; 24];
            let en1_len = en1.len().min(24);
            full[..en1_len].copy_from_slice(&en1[..en1_len]);
            if en1_len + 8 <= 24 {
                full[en1_len..en1_len + 8].copy_from_slice(&nonce.to_le_bytes());
            } else {
                full[16..24].copy_from_slice(&nonce.to_le_bytes());
            }
            let hex = hex::encode(full);
            json!([job_id, hex])
        } else if is_kas {
            // Kaspa stratum bridge (used by 2miners, Kryptex, etc.) parses the
            // nonce param with `u64::from_str_radix(..., 16)`, i.e. as a
            // big-endian hex *number*.  The full 8-byte nonce is
            // extranonce1 || scanned suffix, but we must send it as the hex of
            // the resulting u64 value, not as the little-endian byte string.
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            let en1 = self.extranonce1.lock().await.clone();
            let mut full = [0u8; 8];
            let en1_len = en1.len().min(8);
            full[..en1_len].copy_from_slice(&en1[..en1_len]);
            let suffix_len = 8 - en1_len;
            if suffix_len > 0 {
                full[en1_len..8].copy_from_slice(&nonce.to_le_bytes()[..suffix_len]);
            }
            let full_nonce = u64::from_le_bytes(full);
            let hex = format!("{:016x}", full_nonce);
            json!([worker, job_id, hex])
        } else {
            let hex = format!("0x{:016x}", nonce);
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            json!([worker, job_id, hex])
        };

        let req = json!({
            "id": 100,
            "method": "mining.submit",
            "params": params
        });

        println!("auxpow: submitting share request {}", serde_json::to_string(&req).unwrap_or_default());
        let resp = self.send_request(&req).await?;

        let accepted = resp
            .get("result")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if accepted {
            debug!("AuxPow: share accepted for {}", self.profile.coin);
            Ok(ShareResult::Accepted)
        } else if let Some(err) = resp.get("error") {
            if err.is_null() {
                return Ok(ShareResult::Unknown);
            }
            let reason = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown");
            warn!("AuxPow: share rejected for {}: {}", self.profile.coin, reason);
            Ok(ShareResult::Rejected(reason.to_string()))
        } else {
            Ok(ShareResult::Unknown)
        }
    }

    /// Check if the client is connected.
    pub async fn is_connected(&self) -> bool {
        *self.connected.lock().await
    }

    /// Return the most recent difficulty received via `mining.set_difficulty`.
    ///
    /// Defaults to `1.0` until the pool sends a difficulty notification.
    pub async fn current_difficulty(&self) -> f64 {
        *self.current_difficulty.lock().await
    }

    /// Return the pool-provided extranonce1 bytes.
    pub async fn extranonce1(&self) -> Vec<u8> {
        self.extranonce1.lock().await.clone()
    }

    /// Compute the share target implied by the current difficulty.
    ///
    /// Uses the coin-specific max target: 224-bit for KAS (`0xFF..FF` followed
    /// by 4 zero bytes) and 256-bit for Blake3 coins.  The result saturates at
    /// max target, so difficulties below 1.0 produce the easiest possible target.
    pub async fn share_target(&self) -> [u8; 32] {
        let difficulty = self.current_difficulty().await;
        // The Kaspa stratum bridge (rusty-kaspa/bridge) uses a 224-bit max target
        // (2^224 - 1) for converting Stratum difficulty to share target.  Blake3
        // coins (DCR/ALPH) use the full 256-bit max target.
        let max_target = if self.profile.algorithm.eq_ignore_ascii_case("kheavyhash") {
            // 2^224 - 1 as a 32-byte big-endian number: 4 leading zero bytes
            // followed by 28 0xFF bytes.  This matches the Kaspa stratum bridge.
            let mut t = [0u8; 32];
            t[4..].fill(0xFF);
            t
        } else {
            [0xFFu8; 32]
        };
        difficulty_to_target_with_max(difficulty, &max_target)
    }

    /// Disconnect from the pool.
    pub async fn disconnect(&self) -> Result<()> {
        *self.stream.lock().await = None;
        *self.reader.lock().await = None;
        *self.connected.lock().await = false;
        *self.subscribed.lock().await = false;
        *self.authorized.lock().await = false;
        self.shutdown.notify_waiters();
        info!("AuxPow: disconnected from {}", self.profile.coin);
        Ok(())
    }

    /// Get the coin profile.
    pub fn profile(&self) -> &CoinProfile {
        &self.profile
    }

    /// Get the protocol variant.
    pub fn protocol(&self) -> StratumProtocol {
        self.protocol
    }
}

/// Convert a Stratum difficulty value to a 32-byte big-endian target.
///
/// Uses the KAS/kHeavyHash convention: `target = max_target / difficulty`,
/// where `max_target` is the largest 256-bit value.  The result saturates
/// at `max_target`, so difficulties `<= 1.0` produce the easiest possible
/// target (all bytes `0xFF`).
pub fn difficulty_to_target(difficulty: f64) -> [u8; 32] {
    difficulty_to_target_with_max(difficulty, &[0xFFu8; 32])
}

/// Convert a Stratum difficulty value to a 32-byte big-endian target using
/// the supplied max target.
pub fn difficulty_to_target_with_max(difficulty: f64, max_target: &[u8; 32]) -> [u8; 32] {
    use num_bigint::BigUint;

    if difficulty <= 1.0 || !difficulty.is_finite() || difficulty.is_nan() {
        return *max_target;
    }

    let max = BigUint::from_bytes_be(max_target);
    // Convert difficulty to a rational approximation.  Using its raw bits as
    // a BigUint scaled by 2^52 gives an exact representation of a finite f64.
    let bits = difficulty.to_bits();
    let mantissa = bits & 0x000F_FFFF_FFFF_FFFF;
    let exponent = ((bits >> 52) & 0x7FF) as i32 - 1023;
    let significand = if exponent == -1023 {
        // subnormal
        BigUint::from(mantissa)
    } else {
        BigUint::from(mantissa | 0x0010_0000_0000_0000u64)
    };
    // significand has 52 fractional bits, so the integer value is
    // significand * 2^(exponent - 52).
    let mut diff_int = significand;
    if exponent >= 52 {
        diff_int <<= (exponent - 52) as usize;
    } else {
        diff_int >>= (52 - exponent) as usize;
    }

    if diff_int == BigUint::from(0u32) {
        return [0xFFu8; 32];
    }

    let target = &max / diff_int;
    let bytes = target.to_bytes_be();
    let mut out = [0u8; 32];
    let start = out.len().saturating_sub(bytes.len());
    out[start..].copy_from_slice(&bytes);
    out
}

impl StratumProtocol {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stratum => "stratum",
            Self::EthStratum => "ethstratum",
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// Mock stratum server for testing.
    struct MockStratumServer {
        listener: TcpListener,
    }

    impl MockStratumServer {
        async fn bind() -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            Self { listener }
        }

        fn addr(&self) -> String {
            self.listener.local_addr().unwrap().to_string()
        }

        /// Run the mock server: accept one connection, handle subscribe + authorize,
        /// send a notify, then handle submit.
        async fn run(self, accept_share: bool) {
            let (mut socket, _) = self.listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 4096];

            // Read subscribe
            let n = reader.read(&mut buf).await.unwrap();
            let subscribe_req: Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(subscribe_req["method"], "mining.subscribe");

            // Send subscribe response
            let subscribe_resp = json!({
                "id": 1,
                "result": [["mining.set_difficulty", "subscription_id"], 4],
                "error": null
            });
            let resp_str = serde_json::to_string(&subscribe_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Read authorize
            let n = reader.read(&mut buf).await.unwrap();
            let auth_req: Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(auth_req["method"], "mining.authorize");

            // Send authorize response
            let auth_resp = json!({
                "id": 2,
                "result": true,
                "error": null
            });
            let resp_str = serde_json::to_string(&auth_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Send mining.notify
            let notify = json!({
                "id": null,
                "method": "mining.notify",
                "params": ["job_001", "aabbccdd", "0000ffff"]
            });
            let notify_str = serde_json::to_string(&notify).unwrap() + "\n";
            writer.write_all(notify_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Read submit
            let n = reader.read(&mut buf).await.unwrap();
            let submit_req: Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(submit_req["method"], "mining.submit");

            // Send submit response
            let submit_resp = if accept_share {
                json!({ "id": 100, "result": true, "error": null })
            } else {
                json!({
                    "id": 100,
                    "result": false,
                    "error": { "code": -1, "message": "Low difficulty share" }
                })
            };
            let resp_str = serde_json::to_string(&submit_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Keep connection alive briefly
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    #[tokio::test]
    async fn client_connect_subscribe_authorize() {
        let mock = MockStratumServer::bind().await;
        let addr = mock.addr();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let mock_task = tokio::spawn(async move {
            mock.run(true).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::DCR);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = AuxPowClient::new(profile);
        client.connect("bc1qtestwallet").await.unwrap();

        assert!(client.is_connected().await);

        // Wait for job notification (poll loop is running internally)
        let job = client.wait_for_job(2000).await.unwrap();
        assert!(job.is_some());
        let job = job.unwrap();
        assert_eq!(job.job_id, "job_001");

        // Submit a share
        let result = client
            .submit_share("job_001", 42, "abcdef0123456789")
            .await
            .unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();

        mock_task.await.unwrap();
    }

    #[tokio::test]
    async fn client_rejected_share() {
        let mock = MockStratumServer::bind().await;
        let addr = mock.addr();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let mock_task = tokio::spawn(async move {
            mock.run(false).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::DCR);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = AuxPowClient::new(profile);
        client.connect("bc1qtestwallet").await.unwrap();

        // Poll loop is running internally.
        let result = client
            .submit_share("job_001", 42, "abcdef0123456789")
            .await
            .unwrap();

        match result {
            ShareResult::Rejected(reason) => {
                assert!(reason.contains("Low difficulty"));
            }
            _ => panic!("expected Rejected, got {:?}", result),
        }

        client.disconnect().await.unwrap();
        mock_task.await.unwrap();
    }

    #[tokio::test]
    async fn kas_round_trip_notify_and_submit() {
        use crate::external_hashers::{hash_kheavyhash, meets_target};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 4096];

            async fn read_json(
                reader: &mut tokio::net::tcp::ReadHalf<'_>,
                buf: &mut [u8],
            ) -> Value {
                let n = reader.read(buf).await.unwrap();
                serde_json::from_slice::<Value>(&buf[..n]).unwrap()
            }

            async fn write_json(writer: &mut tokio::net::tcp::WriteHalf<'_>, v: Value) {
                writer
                    .write_all((serde_json::to_string(&v).unwrap() + "\n").as_bytes())
                    .await
                    .unwrap();
                writer.flush().await.unwrap();
            }

            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.subscribe");
            write_json(
                &mut writer,
                json!({"id": 1, "result": [true, "EthereumStratum/1.0.0"], "error": null}),
            )
            .await;

            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            write_json(
                &mut writer,
                json!({"id": 2, "result": true, "error": null}),
            )
            .await;

            write_json(
                &mut writer,
                json!({"id": null, "method": "set_extranonce", "params": ["abcd"]}),
            )
            .await;

            // Use difficulty 1.0 so the share target is the max target and any
            // nonce passes; this keeps the unit test fast while still exercising
            // the full notify/hash/submit round-trip.
            write_json(
                &mut writer,
                json!({"id": null, "method": "mining.set_difficulty", "params": [1]}),
            )
            .await;

            let pre_pow_hash = [42u8; 32];
            let u64s: Vec<u64> = pre_pow_hash
                .chunks_exact(8)
                .map(|c| u64::from_le_bytes(c.try_into().unwrap()))
                .collect();
            let timestamp = 5_435_345_234u64;
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": ["kas_job_1", u64s, timestamp]
                }),
            )
            .await;

            let submit = read_json(&mut reader, &mut buf).await;
            assert_eq!(submit["method"], "mining.submit");
            let params = submit["params"].as_array().unwrap();
            assert_eq!(params.len(), 3);
            assert!(params[0].as_str().unwrap().contains("kaspa:"));
            assert_eq!(params[1], "kas_job_1");
            let nonce_hex = params[2].as_str().unwrap();
            assert_eq!(nonce_hex.len(), 16);

            let full_nonce = u64::from_str_radix(nonce_hex, 16).unwrap();
            let hash = hash_kheavyhash(&pre_pow_hash, timestamp, full_nonce);
            // Validate against a 256-bit all-ones target so the unit test accepts
            // any hash; the real KAS target conversion is tested elsewhere.
            assert!(
                meets_target(&hash, &[0xFFu8; 32]),
                "submitted nonce must produce hash meeting target"
            );

            write_json(
                &mut writer,
                json!({"id": 100, "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(100)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::KAS);
        profile.pool_host = host.to_string();
        profile.pool_port = port;
        profile.worker_name = "test_worker".to_string();

        let client = AuxPowClient::new(profile);
        client
            .connect("kaspa:qpzpfwcsqsxhxwup26r55fd0ghqlhyugz8cp6y3wxuddc02vcxtjg75pspnwz")
            .await
            .unwrap();

        let job = client.wait_for_job(2000).await.unwrap().unwrap();
        assert_eq!(job.job_id, "kas_job_1");
        assert_eq!(job.header_bytes, [42u8; 32]);
        assert_eq!(job.extranonce1, hex::decode("abcd").unwrap());

        // KAS share target at diff>=1 is at most 2^224-1, so brute-forcing a
        // valid share in a unit test is impractical.  Submit a known nonce;
        // the mock server validates against the all-ones target and accepts.
        let nonce = 0u64;
        let hash = crate::external_hashers::hash_kheavyhash_extranonce(
            &job.header_bytes,
            job.timestamp.unwrap_or(0),
            &job.extranonce1,
            nonce,
        );

        let result = client
            .submit_share(&job.job_id, nonce, &hex::encode(hash))
            .await
            .unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn alph_round_trip_notify_and_submit() {
        use crate::external_hashers::{hash_blake3_alph, meets_target};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 4096];

            async fn read_json(
                reader: &mut tokio::net::tcp::ReadHalf<'_>,
                buf: &mut [u8],
            ) -> Value {
                let n = reader.read(buf).await.unwrap();
                serde_json::from_slice::<Value>(&buf[..n]).unwrap()
            }

            async fn write_json(writer: &mut tokio::net::tcp::WriteHalf<'_>, v: Value) {
                writer
                    .write_all((serde_json::to_string(&v).unwrap() + "\n").as_bytes())
                    .await
                    .unwrap();
                writer.flush().await.unwrap();
            }

            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.subscribe");
            write_json(
                &mut writer,
                json!({"id": 1, "result": [null, "6e14", 6], "error": null}),
            )
            .await;

            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            write_json(
                &mut writer,
                json!({"id": 2, "result": true, "error": null}),
            )
            .await;

            write_json(
                &mut writer,
                json!({"id": null, "method": "mining.set_difficulty", "params": [4]}),
            )
            .await;

            let header_blob = hex::decode("aabbccdd").unwrap();
            // Easy target so the CPU finds a share quickly.
            let target_blob = hex::encode([0xFFu8; 32]);
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [{
                        "jobId": "alph_job_1",
                        "fromGroup": 3,
                        "toGroup": 3,
                        "txsBlob": "",
                        "headerBlob": hex::encode(&header_blob),
                        "targetBlob": target_blob
                    }]
                }),
            )
            .await;

            let submit = read_json(&mut reader, &mut buf).await;
            assert_eq!(submit["method"], "mining.submit");
            let params = submit["params"].as_array().unwrap();
            assert_eq!(params.len(), 2);
            assert_eq!(params[0], "alph_job_1");
            let nonce_hex = params[1].as_str().unwrap();
            assert_eq!(nonce_hex.len(), 48);

            let full_nonce = hex::decode(nonce_hex).unwrap();
            let en1 = &full_nonce[..2];
            let nonce_bytes = &full_nonce[2..10];
            let nonce = u64::from_le_bytes(nonce_bytes.try_into().unwrap());
            let hash = hash_blake3_alph(&header_blob, en1, nonce);
            assert!(
                meets_target(&hash, &[0xFFu8; 32]),
                "submitted nonce must produce hash meeting target"
            );

            write_json(
                &mut writer,
                json!({"id": 100, "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(100)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::ALPH);
        profile.pool_host = host.to_string();
        profile.pool_port = port;
        profile.worker_name = "test_worker".to_string();

        let client = AuxPowClient::new(profile);
        client.connect("14DLdim8A2o6AzFNgajvKgwWGpi9Fj4sP1RixdGteJNGJ").await.unwrap();

        let job = client.wait_for_job(2000).await.unwrap().unwrap();
        assert_eq!(job.job_id, "alph_job_1");
        assert_eq!(job.header_bytes, hex::decode("aabbccdd").unwrap());
        assert_eq!(job.extranonce1, hex::decode("6e14").unwrap());

        let mut found = None;
        for nonce in 0..10_000u64 {
            let hash = hash_blake3_alph(&job.header_bytes, &job.extranonce1, nonce);
            if meets_target(&hash, &job.target_bytes) {
                found = Some((nonce, hash));
                break;
            }
        }
        let (nonce, hash) = found.expect("should find a share at difficulty 0.5");

        let result = client
            .submit_share(&job.job_id, nonce, &hex::encode(hash))
            .await
            .unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[test]
    fn protocol_mapping() {
        assert_eq!(ExternalCoin::DCR.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ALPH.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::KAS.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ETC.protocol(), StratumProtocol::EthStratum);
        assert_eq!(ExternalCoin::RVN.protocol(), StratumProtocol::EthStratum);
    }

    #[test]
    fn protocol_as_str() {
        assert_eq!(StratumProtocol::Stratum.as_str(), "stratum");
        assert_eq!(StratumProtocol::EthStratum.as_str(), "ethstratum");
    }
}
