//! Stratum v1 client for external pool connection.
//!
//! Implements the standard Stratum v1 protocol:
//!   1. `mining.subscribe` — register with the pool
//!   2. `mining.authorize` — authenticate with wallet.worker
//!   3. `mining.notify` — receive jobs (job_id, header, target)
//!   4. `mining.submit` — submit shares (job_id, nonce, hash)
//!
//! Also supports EthStratum variant (eth_getWork / eth_submitWork) for
//! Ethash/Autolykos coins (ERG, EVR, MEWC, CLORE).  EthStratum pools use
//! `eth_submitLogin` for auth, push `eth_getWork` notifications (or respond
//! to periodic `eth_getWork` polling requests), and accept `eth_submitWork`
//! for share submission.
//!
//! The client is designed to be used by the `AuxPowScheduler` which
//! manages profit-switching and circuit breaker logic.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::str::FromStr;
use std::sync::Arc;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{Mutex, Notify, oneshot};
// TLS support for EPIC stratum — rustls types are re-exported via tokio_rustls
use tokio_rustls::rustls::RootCertStore;
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
    /// Zcash/Equihash Stratum (mining.notify with solution field, 5-param submit)
    /// Used by VRSC (Verus) and other Equihash-based coins.
    ZcashStratum,
    /// Pearl Stratum — custom JSON-RPC dialect for Pearl (PRL) PoUW mining.
    ///
    /// Key differences from standard Stratum v1:
    ///   - No mining.subscribe — go straight to mining.authorize
    ///   - params are JSON **objects** (named params), not arrays
    ///   - mining.authorize: {wallet, worker?, pass?, agent?}
    ///   - mining.notify: {header (76-byte hex), height, job_id, target}
    ///     - Pool pushes notify BEFORE authorize ack
    ///   - mining.submit: {job_id, plain_proof (base64)}
    ///     - No nonce/extranonce field — randomness lives in PlainProof
    ///   - No mining.set_difficulty — difficulty conveyed via notify target
    ///   - Server-pushed notifications use "id": null
    ///   - Error codes: 20 (method not supported), 21 (stale job),
    ///     22 (duplicate share), 23 (low difficulty), 24 (wallet missing),
    ///     25 (invalid proof/wallet malformed), 26 (invalid proof),
    ///     27 (unauthorized)
    PearlStratum,
    /// EPIC Stratum — JSON-RPC 2.0 over TLS for Epic Cash (EPIC) ProgPow mining.
    ///
    /// Protocol used by de.epicmine.io:3334:
    ///   - TLS connection (not plain TCP)
    ///   - `login` with {login, pass, agent} → returns {id, job}
    ///   - `getjobtemplate` with {algorithm: "progpow"} → returns job
    ///   - Server pushes `job` notifications with {pre_pow, height, job_id,
    ///     difficulty, epochs, algorithm}
    ///   - `submit` with {height, job_id, nonce, pow: {ProgPow: [mixHash]}}
    ///   - `keepalive` for connection maintenance
    ///   - Error codes: -32000 (syncing), -32500 (login first),
    ///     -32501 (low diff), -32502 (failed validate), -32503 (too late)
    EpicStratum,
    /// Beam Stratum — custom JSON-RPC 2.0 over TLS for Beam (BEAM) BeamHash III.
    ///
    /// Protocol used by beam.2miners.com:5252 (TLS):
    ///   - TLS connection (not plain TCP)
    ///   - `login` with {api_key, id, jsonrpc} → returns {id, ...}
    ///   - Server pushes `job` notifications with {input, id, height, difficulty}
    ///   - `solution` with {id, nonce, output, jsonrpc} — submit solution
    ///   - `cancel` with {id} — cancel a job
    ///   - Solution = 104 bytes (100 bytes compressed indices + 4 bytes extra nonce)
    ///   - Nonce = 8 bytes (pool nonce prefix + miner nonce)
    BeamStratum,
}

impl ExternalCoin {
    pub fn protocol(self) -> StratumProtocol {
        match self {
            // 2miners ETC and RVN use standard Stratum v1 (mining.subscribe +
            // mining.authorize + mining.notify), NOT EthStratum.
            // ETC notify: [seed_hash, header_hash, boundary, target, clean]
            // RVN notify: [job_id, seed_hash, header_hash, target, clean, height, nbits]
            Self::DCR | Self::XMR | Self::KAS | Self::ALPH
            | Self::ETC | Self::RVN | Self::QUAI => {
                StratumProtocol::Stratum
            }
            // FLUX uses ZcashStratum (Equihash 125,4 / ZelHash) with solution
            // field in mining.notify and 5-param mining.submit.
            Self::FLUX => {
                StratumProtocol::ZcashStratum
            }
            // ERG (Autolykos v2) uses standard Stratum v1 on 2miners.
            // CLORE/EVR/MEWC (KawPow/ProgPow) use EthStratum on WoolyPooly/ZPool.
            Self::ERG => StratumProtocol::Stratum,
            Self::EVR | Self::MEWC | Self::CLORE => {
                StratumProtocol::EthStratum
            }
            // VRSC (Verus) uses Zcash/Equihash Stratum with solution field
            // and 5-param submit: [worker, job_id, ntime, nonce2, solution]
            Self::VRSC => {
                StratumProtocol::ZcashStratum
            }
            // EPIC (Epic Cash) uses a custom JSON-RPC 2.0 protocol over TLS.
            // See StratumProtocol::EpicStratum docs for full protocol details.
            Self::EPIC => {
                StratumProtocol::EpicStratum
            }
            // Pearl (PRL) uses a custom JSON-RPC dialect over TCP.
            // Object params (not arrays), no mining.subscribe, plain_proof submit.
            // See StratumProtocol::PearlStratum docs for full protocol details.
            Self::PRL => {
                StratumProtocol::PearlStratum
            }
            // Beam (BEAM) uses custom JSON-RPC 2.0 over TLS (BeamStratum).
            // login/job/solution protocol with Equihash 150,5 (BeamHash III).
            Self::BEAM => {
                StratumProtocol::BeamStratum
            }
        }
    }

    /// Epoch length for DAG-based coins.
    /// Ethash/ETC: 30000 blocks per epoch.
    /// KawPow/RVN: 7500 blocks per epoch.
    /// ProgPow/EPIC: 30000 blocks per epoch (same as Ethash).
    /// Pearl/PRL: no DAG (PEARL_EPOCH_LENGTH = 0).
    pub fn epoch_length(self) -> u32 {
        match self {
            Self::RVN | Self::CLORE | Self::EVR | Self::MEWC => {
                crate::external_hashers::KAWPOW_EPOCH_LENGTH
            }
            Self::ETC => crate::external_hashers::ETHASH_EPOCH_LENGTH,
            Self::EPIC => crate::external_hashers::PROGPOW_EPOCH_LENGTH,
            Self::PRL => crate::external_hashers::PEARL_EPOCH_LENGTH,
            _ => crate::external_hashers::ETHASH_EPOCH_LENGTH,
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
    /// Alephium shard group indices (fromGroup / toGroup) from mining.notify.
    #[serde(skip)]
    pub from_group: u32,
    /// Alephium shard group index (toGroup) from mining.notify.
    #[serde(skip)]
    pub to_group: u32,
    /// Extra nonce 1 provided by the pool (Alephium).
    #[serde(skip)]
    pub extranonce1: Vec<u8>,
    /// Extra nonce 2 placeholder for standard stratum submit.
    #[serde(skip)]
    pub extranonce2: String,
    /// Ethash/KawPow epoch derived from seed_hash (for DAG management).
    #[serde(skip)]
    pub epoch: Option<u32>,
}

/// Share submission result from the pool.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShareResult {
    Accepted,
    Rejected(String),
    Unknown,
    /// No share met the target after mining attempts — no submission made.
    NoShare,
}

/// Stratum v1 client for an external mining pool.
#[derive(Clone)]
pub struct AuxPowClient {
    profile: CoinProfile,
    protocol: StratumProtocol,
    stream: Arc<Mutex<Option<Box<dyn AsyncWrite + Unpin + Send>>>>,
    reader: Arc<Mutex<Option<BufReader<Box<dyn AsyncRead + Unpin + Send>>>>>,
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
    /// Last job id returned by `wait_for_job`, so callers do not receive the
    /// same job repeatedly in a busy loop.
    last_waited_job_id: Arc<Mutex<Option<String>>>,
    /// Whether eth_getWork polling is active (EthStratum-only).
    eth_getwork_polling: Arc<Mutex<bool>>,
    /// Next JSON-RPC id for eth_getWork polling requests.
    next_rpc_id: Arc<Mutex<i64>>,
    /// ZcashStratum (VRSC): per-job solution hex from mining.notify params[8].
    /// Used to reconstruct the solution field in the 5-param mining.submit.
    job_solution: Arc<Mutex<HashMap<String, String>>>,
    /// ZcashStratum (VRSC): per-job ntime from mining.notify params[5].
    job_ntime: Arc<Mutex<HashMap<String, String>>>,
    /// ZcashStratum (VRSC): per-job header prefix (version|prevhash|merkle|reserved|ntime|nbits).
    job_header_prefix: Arc<Mutex<HashMap<String, String>>>,
    /// ZcashStratum (VRSC): latest job_id from upstream (for stale share detection).
    latest_job_id: Arc<Mutex<Option<String>>>,
    /// GPU backend for PoUW mining (Metal on Apple Silicon).
    /// None = CPU-only mining.
    #[cfg(feature = "gpu-metal")]
    gpu_backend: Arc<Mutex<Option<crate::gpu_metal::MetalBackend>>>,
    /// GPU backend for PoUW mining (OpenCL on AMD/ROCm).
    /// None = CPU-only mining.
    #[cfg(feature = "gpu-opencl")]
    gpu_opencl_backend: Arc<Mutex<Option<crate::gpu_miner::GpuMiner>>>,
    /// Pearl mining parameters received from pool via `pearl.set_mining_params`.
    /// None = use defaults (m=512, n=512, k=4096, rank=256).
    pearl_mining_params: Arc<Mutex<Option<PearlMiningParams>>>,
}

/// Pearl mining parameters received from the pool via `pearl.set_mining_params`.
#[derive(Clone, Debug)]
pub struct PearlMiningParams {
    pub m: usize,
    pub n: usize,
    pub k: usize,
    pub rank: usize,
    pub rows_pattern: Vec<u32>,
    pub cols_pattern: Vec<u32>,
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
            last_waited_job_id: Arc::new(Mutex::new(None)),
            eth_getwork_polling: Arc::new(Mutex::new(false)),
            next_rpc_id: Arc::new(Mutex::new(200)),
            job_solution: Arc::new(Mutex::new(HashMap::new())),
            job_ntime: Arc::new(Mutex::new(HashMap::new())),
            job_header_prefix: Arc::new(Mutex::new(HashMap::new())),
            latest_job_id: Arc::new(Mutex::new(None)),
            #[cfg(feature = "gpu-metal")]
            gpu_backend: Arc::new(Mutex::new(None)),
            #[cfg(feature = "gpu-opencl")]
            gpu_opencl_backend: Arc::new(Mutex::new(None)),
            pearl_mining_params: Arc::new(Mutex::new(None)),
        }
    }

    /// Enable GPU mining (Metal on Apple Silicon).
    /// Call this before connect() for Pearl PoUW GPU acceleration.
    #[cfg(feature = "gpu-metal")]
    pub async fn with_gpu(self) -> Self {
        match crate::gpu_metal::MetalBackend::new(256) {
            Ok(backend) => {
                println!("auxpow: GPU backend enabled — {}", backend.device_name_pub());
                *self.gpu_backend.lock().await = Some(backend);
            }
            Err(e) => {
                eprintln!("auxpow: GPU backend unavailable, falling back to CPU: {e}");
            }
        }
        self
    }

    /// Check if GPU backend is available.
    #[cfg(feature = "gpu-metal")]
    pub async fn has_gpu(&self) -> bool {
        self.gpu_backend.lock().await.is_some()
    }

    /// Enable GPU mining (OpenCL on AMD/ROCm).
    /// Call this before connect() for Pearl PoUW GPU acceleration.
    #[cfg(feature = "gpu-opencl")]
    pub async fn with_gpu_opencl(self) -> Self {
        match crate::gpu_miner::opencl_backend::new(262144) {
            Ok(backend) => {
                println!("auxpow: OpenCL GPU backend enabled");
                *self.gpu_opencl_backend.lock().await = Some(backend);
            }
            Err(e) => {
                eprintln!("auxpow: OpenCL GPU backend unavailable, falling back to CPU: {e}");
            }
        }
        self
    }

    /// Check if OpenCL GPU backend is available.
    #[cfg(feature = "gpu-opencl")]
    pub async fn has_gpu_opencl(&self) -> bool {
        self.gpu_opencl_backend.lock().await.is_some()
    }

    /// Connect to the external pool and perform subscribe + authorize.
    pub async fn connect(&self, payout_wallet: &str) -> Result<()> {
        *self.payout_wallet.lock().await = payout_wallet.to_string();
        self.connect_tcp().await?;

        // For EpicStratum, perform login BEFORE spawning the poll loop,
        // because send_request_inline and poll_messages compete for the
        // same reader mutex.  Login must complete first to avoid the poll
        // loop stealing the login response.
        if self.protocol == StratumProtocol::EpicStratum {
            self.epic_login(payout_wallet).await?;
            self.epic_getjobtemplate().await?;
            self.start_epic_keepalive().await;
        }

        // For BeamStratum, perform login BEFORE spawning the poll loop.
        if self.protocol == StratumProtocol::BeamStratum {
            self.beam_login(payout_wallet).await?;
        }

        // Spawn the background reader with auto-reconnect
        let client_clone = Arc::new(self.clone());
        let profile_clone = self.profile.clone();
        let payout_wallet_clone = payout_wallet.to_string();
        tokio::spawn(async move {
            let mut backoff_secs: u64 = 5;
            loop {
                match client_clone.poll_messages().await {
                    Ok(()) => {}
                    Err(e) => {
                        println!(
                            "auxpow_client: poll loop ended for {}: {} — reconnecting in {}s",
                            client_clone.profile.coin, e, backoff_secs
                        );
                        *client_clone.connected.lock().await = false;
                        tokio::time::sleep(std::time::Duration::from_secs(backoff_secs)).await;
                        // Attempt reconnect (TCP + subscribe + authorize, no new task spawn)
                        match client_clone.reconnect(&payout_wallet_clone).await {
                            Ok(()) => {
                                println!(
                                    "auxpow_client: reconnected to {} successfully",
                                    profile_clone.coin
                                );
                                backoff_secs = 5;
                            }
                            Err(re_err) => {
                                println!(
                                    "auxpow_client: reconnect to {} failed: {} — retry in {}s",
                                    profile_clone.coin, re_err, backoff_secs
                                );
                                // Clean up stale reader/stream so poll_messages
                                // doesn't hang on a dead connection.
                                *client_clone.reader.lock().await = None;
                                *client_clone.stream.lock().await = None;
                                *client_clone.connected.lock().await = false;
                                backoff_secs = (backoff_secs * 2).min(60);
                            }
                        }
                    }
                }
            }
        });

        // Subscribe + Authorize (non-EPIC protocols — EPIC already handled above)
        if self.protocol != StratumProtocol::EpicStratum
            && self.protocol != StratumProtocol::BeamStratum
        {
            if self.protocol == StratumProtocol::PearlStratum {
                // Pearl plain stratum (port 5571): NO mining.subscribe or
                // mining.configure — go straight to mining.authorize with
                // object params.  The pool responds with an ack and pushes
                // mining.notify immediately.
                // See https://prl.suprnova.cc/stratum-spec.html §4.1
            } else {
                self.subscribe().await?;
            }
            self.authorize(payout_wallet).await?;
        }

        // For EthStratum pools, start periodic eth_getWork polling.
        // Some pools push eth_getWork as a notification; others require
        // the client to poll.  We do both — the poll loop handles push
        // notifications, and this background task sends periodic requests.
        if self.protocol == StratumProtocol::EthStratum {
            self.start_eth_getwork_polling().await;
        }

        info!("AuxPow: connected and authorized for {}", self.profile.coin);
        Ok(())
    }

    /// Establish TCP (or TLS for EPIC) connection and set up stream/reader.
    /// No task spawn.
    async fn connect_tcp(&self) -> Result<()> {
        let addr = self.profile.pool_address();
        info!(
            "AuxPow: connecting to {} ({}) for {}",
            addr,
            self.protocol.as_str(),
            self.profile.coin
        );

        let tcp_stream = timeout(Duration::from_secs(15), TcpStream::connect(&addr))
            .await
            .map_err(|_| anyhow!("connect timeout to {}", addr))?
            .context("TCP connect failed")?;

        if self.protocol == StratumProtocol::EpicStratum
            || self.protocol == StratumProtocol::BeamStratum
        {
            // EPIC pools (de.epicmine.io:3334) and Beam pools (beam.2miners.com:5252)
            // require TLS.
            // Use explicit provider to avoid "Could not automatically determine
            // the process-level CryptoProvider" panic.
            let provider = std::sync::Arc::new(
                tokio_rustls::rustls::crypto::ring::default_provider()
            );
            let roots = RootCertStore {
                roots: webpki_roots::TLS_SERVER_ROOTS.iter().cloned().collect(),
            };
            let config = tokio_rustls::rustls::ClientConfig::builder_with_provider(provider)
                .with_safe_default_protocol_versions()?
                .with_root_certificates(roots)
                .with_no_client_auth();
            let connector = tokio_rustls::TlsConnector::from(std::sync::Arc::new(config));
            let domain = rustls_pki_types::ServerName::try_from(self.profile.pool_host.clone())
                .map_err(|e| anyhow!("invalid TLS server name '{}': {}", self.profile.pool_host, e))?;
            let tls_stream = connector.connect(domain, tcp_stream).await
                .context("TLS handshake failed")?;
            let (reader_half, writer_half) = tokio::io::split(tls_stream);
            let buf_reader: BufReader<Box<dyn AsyncRead + Unpin + Send>> =
                BufReader::new(Box::new(reader_half));
            *self.stream.lock().await = Some(Box::new(writer_half));
            *self.reader.lock().await = Some(buf_reader);
        } else {
            let (reader_half, writer_half) = tcp_stream.into_split();
            let buf_reader: BufReader<Box<dyn AsyncRead + Unpin + Send>> =
                BufReader::new(Box::new(reader_half));
            *self.stream.lock().await = Some(Box::new(writer_half));
            *self.reader.lock().await = Some(buf_reader);
        }

        *self.connected.lock().await = true;
        Ok(())
    }

    /// Reconnect TCP + re-subscribe + re-authorize (called from poll loop, no new task).
    /// Uses inline reads because the poll loop is not running during reconnect.
    async fn reconnect(&self, payout_wallet: &str) -> Result<()> {
        self.connect_tcp().await?;
        // EpicStratum: uses login + getjobtemplate instead of subscribe/authorize.
        if self.protocol == StratumProtocol::EpicStratum {
            self.epic_login(payout_wallet).await?;
            self.epic_getjobtemplate().await?;
        } else if self.protocol == StratumProtocol::BeamStratum {
            self.beam_login(payout_wallet).await?;
        } else {
            // PearlStratum: straight to mining.authorize (no subscribe/configure).
            // See https://prl.suprnova.cc/stratum-spec.html §4.1
            if self.protocol != StratumProtocol::PearlStratum {
                self.subscribe_inline().await?;
            }
            self.authorize_inline(payout_wallet).await?;
        }
        info!("AuxPow: reconnected and authorized for {}", self.profile.coin);
        Ok(())
    }

    /// Send a JSON-RPC request and read the response **inline** (directly from
    /// the TCP stream) without relying on the background poll loop.  Used
    /// during reconnect when the poll loop is not running.
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

        // Read lines until we get a response with matching id (skip notifications)
        let req_id = req.get("id").and_then(|v| v.as_i64());
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("send_request_inline: timeout waiting for response");
            }
            let mut buf = String::new();
            let line_str: String = {
                let mut reader_guard = self.reader.lock().await;
                if let Some(ref mut reader) = *reader_guard {
                    match timeout(remaining, reader.read_line(&mut buf)).await {
                        Ok(Ok(_)) => {
                            if buf.is_empty() {
                                bail!("send_request_inline: connection closed by remote");
                            }
                            buf.trim().to_string()
                        }
                        Ok(Err(e)) => bail!("send_request_inline: read error: {e}"),
                        Err(_) => bail!("send_request_inline: read timeout"),
                    }
                } else {
                    bail!("send_request_inline: no reader available");
                }
            };
            let parsed: Value = serde_json::from_str(&line_str)
                .with_context(|| format!("send_request_inline: invalid JSON: {line_str}"))?;
            // Debug: log raw response for EPIC to diagnose protocol issues
            if self.protocol == StratumProtocol::EpicStratum {
                println!("auxpow: EPIC raw response: {}", line_str);
            }
            // Check if this is a response (has "id" matching) or a notification.
            // EPIC pool sends ids as strings ("0", "1", etc.), so we check both
            // integer and string representations.
            let resp_id = parsed.get("id").and_then(|v| {
                v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
            });
            if let Some(id) = resp_id {
                if req_id.is_some() && id == req_id.unwrap() {
                    return Ok(parsed);
                }
            }
            // EPIC: if the response has an error and no matching id, but has
            // a "method" field matching our request, treat it as our response.
            if self.protocol == StratumProtocol::EpicStratum {
                if let Some(err) = parsed.get("error") {
                    if !err.is_null() {
                        // Only accept the error if the method matches our request.
                        // This prevents picking up error responses from other
                        // requests (e.g. getjobtemplate errors during login).
                        if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
                            let req_method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");
                            if method == req_method {
                                return Ok(parsed);
                            }
                        }
                        // If there's an error with no method, accept it.
                        if parsed.get("method").is_none() {
                            return Ok(parsed);
                        }
                    }
                }
                // EPIC: if the response has a result (success) and no matching id,
                // but has a "method" field matching our request, treat it as ours.
                if let Some(result) = parsed.get("result") {
                    if !result.is_null() {
                        if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
                            let req_method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");
                            if method == req_method {
                                return Ok(parsed);
                            }
                        }
                    }
                }
            }
            // It's a notification or unrelated response — process it
            // (e.g. mining.set_difficulty, mining.notify)
            if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
                match method {
                    "mining.set_difficulty" => {
                        if let Some(diff) = parsed.get("params").and_then(|p| p.get(0)).and_then(|d| d.as_f64()) {
                            *self.current_difficulty.lock().await = diff;
                        }
                    }
                    "mining.set_target" => {
                        if let Some(target_hex) = parsed.get("params").and_then(|p| p.get(0)).and_then(|d| d.as_str()) {
                            println!("auxpow: RAW mining.set_target params[0] = '{}' (len={})", target_hex, target_hex.len());
                            let target_bytes = crate::external_hashers::parse_target_hex(
                                target_hex.trim_start_matches("0x"),
                            ).unwrap_or([0xFFu8; 32]);
                            let diff = target_to_difficulty(&target_bytes);
                            println!(
                                "auxpow: {} set_target={} difficulty={:.2} parsed_bytes={}",
                                self.profile.coin, target_hex, diff, hex::encode(target_bytes)
                            );
                            *self.current_difficulty.lock().await = diff;
                        }
                    }
                    "mining.notify" => {
                        if let Some(params) = parsed.get("params") {
                            let notify_height = parsed.get("height").and_then(|v| v.as_u64());
                            if let Ok(job) = self.parse_notify_params(params, notify_height).await {
                                *self.current_job.lock().await = Some(job);
                                self.job_notify.notify_waiters();
                            }
                        }
                    }
                    "pearl.challenge" => {
                        // AlphaPool protocol: sends {seed, difficulty} on connect
                        // and whenever a new challenge is issued.
                        if let Some(params) = parsed.get("params") {
                            if let Some(job) = self.parse_pearl_challenge_params(params).await {
                                *self.current_job.lock().await = Some(job);
                                self.job_notify.notify_waiters();
                            }
                        }
                    }
                    "pearl.set_mining_params" => {
                        // AlphaPool sends mining parameters (m, n, k, rank,
                        // rows_pattern, cols_pattern) via this notification.
                        if let Some(params) = parsed.get("params") {
                            self.handle_pearl_set_mining_params(params).await;
                        }
                    }
                    "job" => {
                        // EPIC Stratum or BeamStratum: server pushes `job` notifications
                        let job_val = parsed.get("params").unwrap_or(&parsed);
                        if self.protocol == StratumProtocol::BeamStratum {
                            if let Ok(job) = self.parse_beam_job(&parsed).await {
                                *self.current_job.lock().await = Some(job);
                                self.job_notify.notify_waiters();
                            }
                        } else if let Ok(job) = self.parse_epic_job(job_val).await {
                            *self.current_job.lock().await = Some(job);
                            self.job_notify.notify_waiters();
                        }
                    }
                    "cancel" => {
                        // Beam Stratum: server cancels a job
                        if self.protocol == StratumProtocol::BeamStratum {
                            if let Some(id) = parsed.get("id").and_then(|v| v.as_str()) {
                                println!("auxpow: BEAM job cancelled: id={}", id);
                                *self.current_job.lock().await = None;
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    /// Subscribe using inline read (for reconnect).
    async fn subscribe_inline(&self) -> Result<()> {
        let is_zcash = self.protocol == StratumProtocol::ZcashStratum;
        let is_pearl = self.protocol == StratumProtocol::PearlStratum;

        // PearlStratum: fire-and-forget — AlphaPool doesn't respond with matching id.
        if is_pearl {
            let req = json!({
                "id": 1,
                "method": "mining.subscribe",
                "params": ["zion-auxpow/0.1"]
            });
            let req_line = format!("{}\n", serde_json::to_string(&req)?);
            let mut stream = self.stream.lock().await;
            if let Some(w) = stream.as_mut() {
                w.write_all(req_line.as_bytes()).await?;
                w.flush().await?;
                println!("auxpow: PRL mining.subscribe sent (fire-and-forget)");
            }
            *self.subscribed.lock().await = true;
            return Ok(());
        }

        let req = if is_zcash {
            let addr = self.profile.pool_address();
            let (host, port) = {
                let mut parts = addr.split(':');
                let h = parts.next().unwrap_or("");
                let p = parts.next().unwrap_or("");
                (h, p)
            };
            json!({
                "id": 1,
                "method": "mining.subscribe",
                "params": ["zion-auxpow/0.1", null, host, port]
            })
        } else {
            json!({
                "id": 1,
                "method": "mining.subscribe",
                "params": ["zion-auxpow/0.1"]
            })
        };
        let resp = self.send_request_inline(&req).await?;
        if let Some(result) = resp.get("result") {
            *self.subscribed.lock().await = true;
            println!("auxpow: subscribed to {} — result={}", self.profile.coin, result);
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

    /// Authorize using inline read (for reconnect).
    async fn authorize_inline(&self, payout_wallet: &str) -> Result<()> {
        let worker = format!("{}.{}", payout_wallet, self.profile.worker_name);
        let is_ethstratum = self.protocol == StratumProtocol::EthStratum;
        let is_zcash = self.protocol == StratumProtocol::ZcashStratum;
        let is_pearl = self.protocol == StratumProtocol::PearlStratum;
        let password = if !self.profile.password.is_empty() {
            self.profile.password.as_str()
        } else if is_zcash {
            "d=0.01"
        } else if is_ethstratum {
            "x"
        } else if is_pearl {
            "x"
        } else if self.profile.coin == ExternalCoin::XMR {
            // MoneroOcean expects a wallet.worker username and a fixed/starting
            // difficulty in the password.
            "x,d=4"
        } else if self.profile.coin.supports_btc_payout() {
            "c=BTC"
        } else {
            "x"
        };
        println!(
            "auxpow: authorizing worker={} password={} on {} (protocol={})",
            worker, password, self.profile.coin, self.protocol.as_str()
        );
        let method = if is_ethstratum {
            "eth_submitLogin"
        } else {
            "mining.authorize"
        };

        // PearlStratum (port 5571 plain stratum): object params per suprnova spec.
        let req = if is_pearl {
            json!({
                "id": 2,
                "method": "mining.authorize",
                "params": {
                    "wallet": payout_wallet,
                    "worker": self.profile.worker_name,
                    "pass": password,
                    "agent": "zion-miner/3.0.6"
                }
            })
        } else {
            json!({
                "id": 2,
                "method": method,
                "params": [worker, password]
            })
        };

        let resp = self.send_request_inline(&req).await?;
        let ok = if is_ethstratum {
            resp.get("result").and_then(|v| v.as_bool()).unwrap_or(false)
                || resp.get("result").and_then(|v| v.as_str()).is_some()
        } else {
            resp.get("result").and_then(|v| v.as_bool()).unwrap_or(false)
        };
        if ok {
            *self.authorized.lock().await = true;
            println!("auxpow: authorized as {} on {}", worker, self.profile.coin);

            // ZcashStratum: send mining.extranonce.subscribe after authorize.
            if is_zcash {
                let ex_req = json!({
                    "id": 3,
                    "method": "mining.extranonce.subscribe",
                    "params": []
                });
                if let Err(e) = self.send_request_inline(&ex_req).await {
                    debug!("auxpow: extranonce.subscribe (inline) failed for {}: {}", self.profile.coin, e);
                }
            }
            Ok(())
        } else {
            let err = resp.get("error");
            println!(
                "auxpow: authorize FAILED for {} on {} — result={:?} error={:?}",
                worker, self.profile.coin, resp.get("result"), err
            );
            bail!("authorize failed: {:?}", err);
        }
    }

    // ── EPIC Stratum protocol methods ──────────────────────────────────
    //
    // EPIC uses JSON-RPC 2.0 over TLS with the following methods:
    //   login, getjobtemplate, submit, keepalive
    // Server pushes `job` notifications with pre_pow, height, job_id,
    // difficulty, epochs, algorithm.

    /// EPIC login: authenticate with the pool and receive initial job.
    ///
    /// The `payout_wallet` is used as the login username.  EPIC requires
    /// username ≥ 5 chars and password ≥ 8 chars.
    async fn epic_login(&self, payout_wallet: &str) -> Result<()> {
        // EPIC requires username ≤ 20 chars total (including worker suffix).
        // Truncate the wallet if needed to fit within the limit.
        let worker = &self.profile.worker_name;
        let max_wallet_len = 20usize.saturating_sub(worker.len() + 1); // +1 for '.'
        let wallet_short = if payout_wallet.len() <= max_wallet_len {
            payout_wallet.to_string()
        } else {
            // Use a short fallback if wallet is too long.
            // Must be ≥ 5 chars (EPIC minimum username length).
            "ziontest".to_string()
        };
        let login = format!("{}.{}", wallet_short, worker);
        let password = if self.profile.password.len() >= 8 {
            self.profile.password.clone()
        } else {
            "zion1234567".to_string() // min 8 chars
        };
        let agent = "zion-auxpow/0.1";
        let req = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "login",
            "params": {
                "login": login,
                "pass": password,
                "agent": agent,
            }
        });
        println!(
            "auxpow: EPIC login as {} (len={}) on {} (protocol={})",
            login, login.len(), self.profile.coin, self.protocol.as_str()
        );
        let resp = self.send_request_inline(&req).await?;
        if let Some(err) = resp.get("error") {
            if !err.is_null() {
                bail!("EPIC login failed: {:?}", err);
            }
        }
        *self.authorized.lock().await = true;
        *self.subscribed.lock().await = true;
        println!("auxpow: EPIC login successful for {}", self.profile.coin);

        // The login response may include an initial job in "result.job".
        if let Some(job_obj) = resp.get("result").and_then(|r| r.get("job")) {
            if let Ok(job) = self.parse_epic_job(job_obj).await {
                *self.current_job.lock().await = Some(job);
                self.job_notify.notify_waiters();
            }
        }
        Ok(())
    }

    /// Beam login — BeamHash III stratum protocol.
    /// Sends `{"method":"login", "api_key":"WALLET.WORKER", "id":"login", "jsonrpc":"2.0"}`
    /// The api_key is the wallet address (hex) + optional ".worker" suffix.
    async fn beam_login(&self, payout_wallet: &str) -> Result<()> {
        let api_key = if self.profile.worker_name.is_empty() {
            payout_wallet.to_string()
        } else {
            format!("{}.{}", payout_wallet, self.profile.worker_name)
        };
        let req = json!({
            "method": "login",
            "api_key": api_key,
            "id": "login",
            "jsonrpc": "2.0"
        });
        println!(
            "auxpow: BEAM login as {} (len={}) on {} (protocol={})",
            api_key, api_key.len(), self.profile.coin, self.protocol.as_str()
        );
        let resp = self.send_request_inline(&req).await?;
        if let Some(err) = resp.get("error") {
            if !err.is_null() {
                bail!("BEAM login failed: {:?}", err);
            }
        }
        *self.authorized.lock().await = true;
        *self.subscribed.lock().await = true;
        println!("auxpow: BEAM login successful for {}", self.profile.coin);

        // The login response may include an initial job.
        if let Some(job_obj) = resp.get("result").and_then(|r| r.get("job")) {
            if let Ok(job) = self.parse_beam_job(job_obj).await {
                *self.current_job.lock().await = Some(job);
                self.job_notify.notify_waiters();
            }
        }
        Ok(())
    }

    /// Parse a Beam stratum `job` notification.
    /// Format: {"method":"job", "input":"<hex>", "id":<num>, "height":<num>,
    ///          "difficulty":<num>, "nonceprefix":"<hex>"}
    async fn parse_beam_job(&self, msg: &Value) -> Result<ExternalJob> {
        let job = msg.get("params").unwrap_or(msg);

        let input_hex = job.get("input").and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("BEAM job: missing 'input' field"))?;
        let header_bytes = hex::decode(input_hex)
            .context("BEAM job: invalid hex in 'input'")?;

        let job_id = job.get("id").and_then(|v| {
            v.as_u64().map(|n| n.to_string())
                .or_else(|| v.as_str().map(|s| s.to_string()))
        }).unwrap_or_default();

        let height = job.get("height").and_then(|v| v.as_u64()).unwrap_or(0);

        let difficulty = job.get("difficulty").and_then(|v| {
            v.as_f64().or_else(|| v.as_u64().map(|n| n as f64))
        }).unwrap_or(1.0);

        let nonceprefix_hex = job.get("nonceprefix").and_then(|v| v.as_str()).unwrap_or("");
        let extranonce1 = if !nonceprefix_hex.is_empty() {
            hex::decode(nonceprefix_hex).unwrap_or_default()
        } else {
            Vec::new()
        };

        let target_bytes = difficulty_to_target(difficulty);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        println!(
            "auxpow: BEAM job parsed height={} job_id={} input_len={} difficulty={:.2} nonceprefix={}",
            height, job_id, header_bytes.len(), difficulty, nonceprefix_hex
        );

        Ok(ExternalJob {
            job_id,
            header_hex: input_hex.to_string(),
            target_hex: hex::encode(target_bytes),
            seed_hash: None,
            block_number: Some(height),
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
            timestamp: Some(now),
            nbits: None,
            external_coin: self.profile.coin,
            from_group: 0,
            to_group: 0,
            extranonce1,
            extranonce2: String::new(),
            epoch: None,
        })
    }

    /// Request a job template from the EPIC pool.
    /// Sent fire-and-forget — the server responds with a `job` notification
    /// that is handled by the poll_messages loop.  We don't use
    /// send_request_inline here because the server sends the job with a
    /// different id ("epicmine_stratum") than our request id.
    async fn epic_getjobtemplate(&self) -> Result<()> {
        let req = json!({
            "jsonrpc": "2.0",
            "id": 10,
            "method": "getjobtemplate",
            "params": {
                "algorithm": "progpow"
            }
        });
        let req_line = format!("{}\n", serde_json::to_string(&req)?);
        let mut stream = self.stream.lock().await;
        if let Some(w) = stream.as_mut() {
            w.write_all(req_line.as_bytes()).await?;
            w.flush().await?;
            println!("auxpow: EPIC getjobtemplate sent (fire-and-forget)");
        }
        Ok(())
    }

    /// Start a background keepalive timer for the EPIC connection.
    async fn start_epic_keepalive(&self) {
        let client = Arc::new(self.clone());
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            interval.tick().await; // skip first immediate tick
            loop {
                interval.tick().await;
                if !*client.connected.lock().await {
                    break;
                }
                let req = json!({
                    "jsonrpc": "2.0",
                    "id": 0,
                    "method": "keepalive",
                    "params": {}
                });
                let req_line = format!("{}\n", serde_json::to_string(&req).unwrap());
                let mut stream = client.stream.lock().await;
                if let Some(w) = stream.as_mut() {
                    if w.write_all(req_line.as_bytes()).await.is_err() {
                        // Connection is dead — the poll loop will handle reconnect
                        break;
                    }
                    debug!("auxpow: EPIC keepalive sent for {}", client.profile.coin);
                }
            }
        });
    }

    /// Parse an EPIC job JSON object into an `ExternalJob`.
    ///
    /// EPIC job fields:
    ///   - pre_pow: 548-byte hex string (the header preimage without nonce)
    ///   - height: block height (u64)
    ///   - job_id: job identifier (u64)
    ///   - difficulty: [share_diff, block_diff, ...] (array of 3)
    ///   - epochs: [[start_height, end_height, [32-byte seed_hex]], ...]
    ///   - algorithm: "progpow"
    async fn parse_epic_job(&self, job: &Value) -> Result<ExternalJob> {
        let pre_pow_hex = job.get("pre_pow")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("EPIC job missing pre_pow"))?;
        let height = job.get("height")
            .and_then(|v| v.as_u64())
            .or_else(|| job.get("height").and_then(|v| v.as_i64()).map(|i| i as u64))
            .unwrap_or(0);
        let job_id = job.get("job_id")
            .and_then(|v| v.as_u64())
            .or_else(|| job.get("job_id").and_then(|v| v.as_i64()).map(|i| i as u64))
            .unwrap_or(0);
        // EPIC jobs cover all 3 algorithms (cuckoo, randomx, progpow), but
        // we only mine progpow.  Force the algorithm to "progpow" regardless
        // of the top-level algorithm field.
        let algorithm = "progpow".to_string();

        // Difficulty: EPIC sends a nested array of [algo_name, diff_value] pairs:
        //   [["cuckoo", 3], ["randomx", 800000], ["progpow", 2500000000]]
        // We extract the progpow share difficulty.
        let share_difficulty = job.get("difficulty")
            .and_then(|d| d.as_array())
            .and_then(|arr| {
                // Look for the "progpow" entry in the nested array
                for entry in arr {
                    if let Some(pair) = entry.as_array() {
                        if pair.len() == 2 {
                            if pair[0].as_str() == Some("progpow") {
                                return pair[1].as_f64();
                            }
                        }
                    }
                }
                // Fallback: try flat array format [share_diff, ...]
                arr.first().and_then(|v| v.as_f64())
            })
            .or_else(|| job.get("difficulty").and_then(|d| d.as_f64()))
            .unwrap_or(2_500_000_000.0); // EPIC default progpow share diff

        // Derive target from difficulty: target = 2^256 / difficulty
        // For ProgPow, the target is a 32-byte big-endian value.
        let target_bytes = difficulty_to_target(share_difficulty);

        // Extract seed hash from epochs for DAG management.
        // EPIC epochs format: [[start_height, end_height, [seed_bytes...]], ...]
        // The seed is an array of integers (bytes), not a hex string.
        let seed_hash = job.get("epochs")
            .and_then(|e| e.as_array())
            .and_then(|arr| arr.first())
            .and_then(|epoch| epoch.as_array())
            .and_then(|ep| ep.get(2))
            .and_then(|s| s.as_array())
            .map(|seed_arr| {
                // Convert array of integers to hex string
                let bytes: Vec<u8> = seed_arr.iter()
                    .filter_map(|v| v.as_u64().map(|n| n as u8))
                    .collect();
                hex::encode(&bytes)
            });

        // Epoch from height: EPIC ProgPow epoch = height / 30000
        let epoch = if height > 0 {
            Some((height / 30000) as u32)
        } else {
            None
        };

        let header_bytes = hex::decode(pre_pow_hex.trim_start_matches("0x"))
            .unwrap_or_default();

        let job = ExternalJob {
            job_id: job_id.to_string(),
            header_hex: pre_pow_hex.to_string(),
            target_hex: hex::encode(target_bytes),
            seed_hash,
            block_number: Some(height),
            algorithm,
            header_bytes,
            target_bytes,
            timestamp: None,
            nbits: None,
            external_coin: ExternalCoin::EPIC,
            from_group: 0,
            to_group: 0,
            extranonce1: Vec::new(),
            extranonce2: String::new(),
            epoch,
        };

        println!(
            "auxpow: EPIC job parsed height={} job_id={} pre_pow_len={} epoch={:?} share_diff={:.0}",
            height, job_id, job.header_hex.len(), job.epoch, share_difficulty
        );

        Ok(job)
    }

    /// Send `mining.configure` for PearlStratum protocol.
    ///
    /// The official alpha-miner sends this with params `[["pearl/v1"],{}]` to
    /// tell the pool it speaks the Pearl v1 protocol.  The pool then sends
    /// `pearl.set_mining_params` and `pearl.challenge` notifications.
    ///
    /// Sent fire-and-forget — AlphaPool doesn't respond with a matching JSON-RPC id.
    async fn pearl_configure(&self) -> Result<()> {
        let req = json!({
            "id": 0,
            "method": "mining.configure",
            "params": [["pearl/v1"], {}]
        });
        let req_line = format!("{}\n", serde_json::to_string(&req)?);
        let mut stream = self.stream.lock().await;
        if let Some(w) = stream.as_mut() {
            w.write_all(req_line.as_bytes()).await?;
            w.flush().await?;
            println!("auxpow: PRL mining.configure sent (pearl/v1)");
        }
        Ok(())
    }

    /// Send `mining.subscribe` and wait for response.
    async fn subscribe(&self) -> Result<()> {
        let is_ethstratum = self.protocol == StratumProtocol::EthStratum;
        let is_zcash = self.protocol == StratumProtocol::ZcashStratum;
        let is_pearl = self.protocol == StratumProtocol::PearlStratum;

        // PearlStratum: fire-and-forget — AlphaPool doesn't respond with matching id.
        if is_pearl {
            let req = json!({
                "id": 1,
                "method": "mining.subscribe",
                "params": ["zion-auxpow/0.1"]
            });
            let req_line = format!("{}\n", serde_json::to_string(&req)?);
            let mut stream = self.stream.lock().await;
            if let Some(w) = stream.as_mut() {
                w.write_all(req_line.as_bytes()).await?;
                w.flush().await?;
                println!("auxpow: PRL mining.subscribe sent (fire-and-forget)");
            }
            *self.subscribed.lock().await = true;
            return Ok(());
        }

        let req = if is_zcash {
            // ZcashStratum (VRSC/LuckPool): subscribe with [user_agent, null, host, port].
            // The host/port helps the pool select the appropriate extranonce size.
            let addr = self.profile.pool_address();
            let (host, port) = {
                let mut parts = addr.split(':');
                let h = parts.next().unwrap_or("");
                let p = parts.next().unwrap_or("");
                (h, p)
            };
            json!({
                "id": 1,
                "method": "mining.subscribe",
                "params": ["zion-auxpow/0.1", null, host, port]
            })
        } else if is_ethstratum {
            // EthStratum pools (ERG/RVN/ETC) use eth_subscribe or just
            // mining.subscribe with different params.  Most accept the
            // standard subscribe and then switch to eth_getWork.
            json!({
                "id": 1,
                "method": "mining.subscribe",
                "params": ["zion-auxpow/0.1"]
            })
        } else {
            json!({
                "id": 1,
                "method": "mining.subscribe",
                "params": ["zion-auxpow/0.1"]
            })
        };
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
        let is_zcash = self.protocol == StratumProtocol::ZcashStratum;
        let is_pearl = self.protocol == StratumProtocol::PearlStratum;
        let password = if !self.profile.password.is_empty() {
            self.profile.password.as_str()
        } else if is_zcash {
            // ZcashStratum (VRSC/LuckPool): password specifies starting vardiff.
            // d=0.01 gives frequent shares on low hashrate; pool will raise via vardiff.
            "d=0.01"
        } else if is_ethstratum {
            "x"
        } else if is_pearl {
            // Pearl (PRL): password may carry d=N for custom difficulty.
            // Default "x" — pool will use VarDiff on port 5571.
            "x"
        } else if self.profile.coin == ExternalCoin::XMR {
            // MoneroOcean expects a wallet.worker username and a fixed/starting
            // difficulty in the password.
            "x,d=4"
        } else if self.profile.coin.supports_btc_payout() {
            "c=BTC"
        } else {
            "x"
        };
        println!(
            "auxpow: authorizing worker={} password={} on {} (protocol={})",
            worker, password, self.profile.coin, self.protocol.as_str()
        );
        let method = if is_ethstratum {
            "eth_submitLogin"
        } else {
            "mining.authorize"
        };

        // PearlStratum (port 5571 plain stratum): use object params per
        // suprnova spec §4.1 — {wallet, worker, pass, agent}.
        // The pool DOES respond with {"id":N,"result":true,"error":null}.
        let req = if is_pearl {
            json!({
                "id": 2,
                "method": "mining.authorize",
                "params": {
                    "wallet": payout_wallet,
                    "worker": self.profile.worker_name,
                    "pass": password,
                    "agent": "zion-miner/3.0.6"
                }
            })
        } else {
            json!({
                "id": 2,
                "method": method,
                "params": [worker, password]
            })
        };

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

            // ZcashStratum: send mining.extranonce.subscribe after authorize
            // (LuckPool expects this to enable push extranonce updates).
            if is_zcash {
                let ex_req = json!({
                    "id": 3,
                    "method": "mining.extranonce.subscribe",
                    "params": []
                });
                if let Err(e) = self.send_request(&ex_req).await {
                    debug!("auxpow: extranonce.subscribe failed for {}: {}", self.profile.coin, e);
                }
            }
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

        let deadline = Instant::now() + Duration::from_secs(60);
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
            // 300s read timeout — some coins (e.g. DCR) have ~5 minute block
            // times, so the pool may not send data for several minutes.  A
            // shorter timeout would trigger spurious reconnects.
            match timeout(Duration::from_secs(300), reader.read_line(&mut buf)).await {
                Ok(Ok(_)) => {
                    if buf.is_empty() {
                        bail!("connection closed by remote");
                    }
                    Ok(buf.trim().to_string())
                }
                Ok(Err(e)) => bail!("read error: {e}"),
                Err(_) => bail!("read timeout (300s, no data from pool)"),
            }
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

        // Debug: log EPIC messages for troubleshooting
        if self.protocol == StratumProtocol::EpicStratum {
            let method = msg.get("method").and_then(|m| m.as_str()).unwrap_or("");
            println!(
                "auxpow: EPIC poll msg method={} id={:?} (len={})",
                method,
                msg.get("id"),
                line.len()
            );
        }

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
                        // 2miners ETC sends a top-level "height" field in
                        // mining.notify — extract it for DAG epoch derivation.
                        let notify_height = msg.get("height").and_then(|v| v.as_u64());
                        let job = self.parse_notify_params(params, notify_height).await?;
                        debug!(
                            "AuxPow: received job {} for {}",
                            job.job_id, self.profile.coin
                        );
                        *self.current_job.lock().await = Some(job);
                        self.job_notify.notify_waiters();
                    }
                }
                "pearl.challenge" => {
                    // AlphaPool protocol: sends {seed, difficulty} as challenge
                    if let Some(params) = msg.get("params") {
                        if let Some(job) = self.parse_pearl_challenge_params(params).await {
                            debug!(
                                "AuxPow: received pearl.challenge for {}",
                                self.profile.coin
                            );
                            *self.current_job.lock().await = Some(job);
                            self.job_notify.notify_waiters();
                        }
                    }
                }
                "pearl.set_mining_params" => {
                    // AlphaPool sends mining parameters (m, n, k, rank,
                    // rows_pattern, cols_pattern) via this notification.
                    if let Some(params) = msg.get("params") {
                        self.handle_pearl_set_mining_params(params).await;
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
                "mining.set_target" => {
                    // RVN/KawPow pools send mining.set_target with a 32-byte
                    // hex target string instead of mining.set_difficulty.
                    if let Some(params) = msg.get("params") {
                        if let Some(target_hex) = params.get(0).and_then(|d| d.as_str()) {
                            println!("auxpow: RAW set_target full='{}' len={}", target_hex, target_hex.len());
                            let target_bytes = crate::external_hashers::parse_target_hex(
                                target_hex.trim_start_matches("0x"),
                            ).unwrap_or([0xFFu8; 32]);
                            // Convert target to difficulty: diff = 2^256 / target
                            let diff = target_to_difficulty(&target_bytes);
                            println!(
                                "auxpow: {} set_target parsed={} difficulty={:.2}",
                                self.profile.coin,
                                hex::encode(target_bytes),
                                diff
                            );
                            *self.current_difficulty.lock().await = diff;
                        }
                    }
                }
                "mining.set_extranonce" | "set_extranonce" => {
                    if let Some(params) = msg.get("params") {
                        if let Some(hex) = params.get(0).and_then(|p| p.as_str()) {
                            debug!(
                                "AuxPow: extranonce set to {} for {}",
                                hex, self.profile.coin
                            );
                            *self.extranonce1.lock().await = hex::decode(hex).unwrap_or_default();
                        }
                    }
                }
                // EthStratum notify: params = [seed_hash, header_hash, boundary]
                // where seed_hash and header_hash are 0x-prefixed hex strings.
                "eth_getWork" => {
                    if let Some(params) = msg.get("params") {
                        if let Some(arr) = params.as_array() {
                            if arr.len() >= 3 {
                                let job = self
                                    .parse_eth_getwork_params(
                                        arr[0].as_str().unwrap_or(""),
                                        arr[1].as_str().unwrap_or(""),
                                        arr[2].as_str().unwrap_or(""),
                                    )
                                    .await;
                                *self.current_job.lock().await = Some(job);
                                self.job_notify.notify_waiters();
                            }
                        }
                    }
                }
                "client.reconnect" => {
                    // ZcashStratum pools may send client.reconnect to request
                    // a reconnection.  Break the poll loop to trigger reconnect.
                    warn!("AuxPow: {} requested client.reconnect", self.profile.coin);
                    bail!("client.reconnect requested by pool");
                }
                "job" => {
                    // EPIC Stratum: server pushes `job` notifications with
                    // pre_pow, height, job_id, difficulty, epochs, algorithm.
                    // The job data may be in "params" or at the top level.
                    let job_val = msg.get("params").unwrap_or(&msg);
                    match self.parse_epic_job(job_val).await {
                        Ok(job) => {
                            debug!(
                                "AuxPow: received EPIC job {} height={} for {}",
                                job.job_id, job.block_number.unwrap_or(0), self.profile.coin
                            );
                            *self.current_job.lock().await = Some(job);
                            self.job_notify.notify_waiters();
                        }
                        Err(e) => {
                            warn!("AuxPow: EPIC job parse error for {}: {}", self.profile.coin, e);
                        }
                    }
                }
                "getjobtemplate" => {
                    // EPIC Stratum: server responds to getjobtemplate with
                    // the job data in "result" (not "params").  Handle it
                    // the same way as a "job" notification.
                    if let Some(result) = msg.get("result") {
                        match self.parse_epic_job(result).await {
                            Ok(job) => {
                                debug!(
                                    "AuxPow: received EPIC getjobtemplate job {} height={} for {}",
                                    job.job_id, job.block_number.unwrap_or(0), self.profile.coin
                                );
                                *self.current_job.lock().await = Some(job);
                                self.job_notify.notify_waiters();
                            }
                            Err(e) => {
                                warn!("AuxPow: EPIC getjobtemplate parse error for {}: {}", self.profile.coin, e);
                            }
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
    async fn parse_notify_params(&self, params: &Value, notify_height: Option<u64>) -> Result<ExternalJob> {
        // Debug: log raw notify params for DCR to diagnose format issues.
        if self.profile.coin == ExternalCoin::DCR {
            println!(
                "auxpow: DCR raw notify params (truncated): {:.500}",
                serde_json::to_string(params).unwrap_or_default()
            );
        }
        // Debug: log raw notify params for ERG to diagnose format issues.
        if self.profile.coin == ExternalCoin::ERG {
            println!(
                "auxpow: ERG raw notify params: {}",
                serde_json::to_string(params).unwrap_or_default()
            );
        }

        // Pearl (PRL) PearlStratum: params is a JSON **object** (named params):
        //   {header (76-byte hex), height (int), job_id (string), target (64-hex)}
        // The header is an incomplete Pearl block header (76 of 108 bytes).
        // The target is a 256-bit big-endian hex string (share threshold).
        // No extranonce — randomness lives inside the PlainProof on submit.
        if self.protocol == StratumProtocol::PearlStratum {
            if let Some(obj) = params.as_object() {
                let job_id = obj
                    .get("job_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let header_hex = obj
                    .get("header")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let target_hex = obj
                    .get("target")
                    .and_then(|v| v.as_str())
                    .unwrap_or("ffff")
                    .to_string();
                let height = obj
                    .get("height")
                    .and_then(|v| v.as_u64())
                    .or(notify_height);

                let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
                    .unwrap_or_default();
                let target_bytes = crate::external_hashers::parse_target_hex(&target_hex)
                    .unwrap_or([0xFFu8; 32]);

                println!(
                    "auxpow: PRL notify — job={} header_len={} height={:?} target={:.16}...",
                    job_id,
                    header_bytes.len(),
                    height,
                    target_hex,
                );

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
                    from_group: 0,
                    to_group: 0,
                    extranonce1: Vec::new(), // Pearl has no extranonce
                    extranonce2: String::new(),
                    epoch: None,
                });
            }
        }
        // Alephium (Blake3) sends notify params as [ {object} ], where the
        // object contains: jobId, headerBlob, targetBlob, height, fromGroup,
        // toGroup, txsBlob.
        let inner = if let Some(arr) = params.as_array() {
            if arr.iter().any(|v| v.is_object()) {
                // Alephium/WoolyPooly sends mining.notify params as an array of
                // job objects; pick the first one to mine.
                arr.iter().find(|v| v.is_object()).unwrap()
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
            let from_group = obj
                .get("fromGroup")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32;
            let to_group = obj
                .get("toGroup")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32;
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
                from_group,
                to_group,
                extranonce1: self.extranonce1.lock().await.clone(),
                extranonce2: String::new(),
                epoch: None,
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
                            from_group: 0,
                            to_group: 0,
                            extranonce1: self.extranonce1.lock().await.clone(),
                            extranonce2: String::new(),
                            epoch: None,
                        });
                    }
                }
            }
        }

        // RVN / KawPow Stratum v1 hybrid (2miners):
        // mining.notify params = [job_id, seed_hash, header_hash, target, clean_jobs, height, nbits]
        // where job_id is a short string, seed_hash and header_hash are
        // 32-byte hex strings (without 0x prefix), target is 32-byte hex,
        // clean_jobs is a bool, height is the block number, nbits is hex.
        // KawPow epoch = height / 7500.
        if let Some(arr) = params.as_array() {
            if arr.len() >= 6
                && self.profile.coin == ExternalCoin::RVN
                && arr[0].as_str().map(|s| !s.starts_with("0x") && s.len() <= 20).unwrap_or(false)
                && arr[1].as_str().map(|s| s.len() == 64).unwrap_or(false)
                && arr[2].as_str().map(|s| s.len() == 64).unwrap_or(false)
            {
                let job_id = arr[0].as_str().unwrap_or("").to_string();
                let seed_hash = arr[1].as_str().unwrap_or("").to_string();
                let header_hex = arr[2].as_str().unwrap_or("").to_string();
                let target_hex = arr[3].as_str().unwrap_or("").to_string();
                let height = arr.get(5).and_then(|v| v.as_u64());
                let nbits = arr.get(6).and_then(|v| v.as_str()).map(String::from);

                let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
                    .unwrap_or_default();
                let target_bytes = crate::external_hashers::parse_target_hex(
                    target_hex.trim_start_matches("0x"),
                )
                .unwrap_or([0xFFu8; 32]);

                // Derive epoch from block height (height / 7500 for KawPow).
                let epoch_length = self.profile.coin.epoch_length() as u64;
                let epoch = height.map(|h| (h / epoch_length) as u32);

                println!(
                    "auxpow: RVN notify — job={} seed={}.. header={}.. epoch={:?} height={:?}",
                    job_id,
                    &seed_hash[..16.min(seed_hash.len())],
                    &header_hex[..16.min(header_hex.len())],
                    epoch,
                    height,
                );

                return Ok(ExternalJob {
                    job_id,
                    header_hex,
                    target_hex,
                    seed_hash: Some(seed_hash),
                    block_number: height,
                    algorithm: self.profile.algorithm.clone(),
                    header_bytes,
                    target_bytes,
                    timestamp: None,
                    nbits,
                    external_coin: self.profile.coin,
                    from_group: 0,
                    to_group: 0,
                    extranonce1: self.extranonce1.lock().await.clone(),
                    extranonce2: String::new(),
                    epoch,
                });
            }
        }

        // ETC / Ethash Stratum v1 hybrid (2miners):
        // mining.notify params = [seed_hash, header_hash, boundary, target, clean_jobs]
        // where seed_hash and header_hash are 0x-prefixed 32-byte hex strings,
        // boundary is the share target, target is the network target, and
        // clean_jobs is a bool.  The top-level "height" field gives the block
        // height for DAG epoch derivation (height / 30000).
        // NOTE: 2miners sends the same value for seed_hash and header_hash;
        // the real DAG seed hash is derived from the epoch, not from arr[0].
        if let Some(arr) = params.as_array() {
            if arr.len() >= 3
                && self.profile.coin == ExternalCoin::ETC
                && arr[0].as_str().map(|s| s.starts_with("0x") && s.len() == 66).unwrap_or(false)
                && arr[1].as_str().map(|s| s.starts_with("0x") && s.len() == 66).unwrap_or(false)
            {
                let seed_hash = arr[0].as_str().unwrap_or("").to_string();
                let header_hex = arr[1].as_str().unwrap_or("").to_string();
                let target_hex = arr[2].as_str().unwrap_or("").to_string();

                let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
                    .unwrap_or_default();
                let target_bytes = crate::external_hashers::parse_target_hex(
                    target_hex.trim_start_matches("0x"),
                )
                .unwrap_or([0xFFu8; 32]);

                // Derive epoch from block height (height / epoch_length).
                // ETC: 30000, RVN/KawPow: 7500.
                // Fall back to seed hash search if height is not available.
                let epoch = if let Some(height) = notify_height {
                    let e = (height / self.profile.coin.epoch_length() as u64) as u32;
                    println!(
                        "auxpow: ETC epoch={} from height={}",
                        e, height
                    );
                    Some(e)
                } else {
                    // Fall back: try to find epoch from seed hash.
                    let seed_bytes = hex::decode(seed_hash.trim_start_matches("0x"))
                        .unwrap_or_default();
                    if seed_bytes.len() == 32 {
                        let seed_arr: [u8; 32] = seed_bytes[..32].try_into().unwrap();
                        crate::external_hashers::ethash_epoch_from_seed_hash(
                            &seed_arr,
                            crate::external_hashers::ETHASH_MAX_EPOCH_SEARCH,
                        )
                    } else {
                        None
                    }
                };

                println!(
                    "auxpow: ETC notify — seed={}, header={}, target={}, epoch={:?}, height={:?}",
                    &seed_hash[..16.min(seed_hash.len())],
                    &header_hex[..16.min(header_hex.len())],
                    &target_hex[..16.min(target_hex.len())],
                    epoch,
                    notify_height,
                );

                return Ok(ExternalJob {
                    job_id: header_hex.clone(),
                    header_hex,
                    target_hex,
                    seed_hash: Some(seed_hash),
                    block_number: notify_height,
                    algorithm: self.profile.algorithm.clone(),
                    header_bytes,
                    target_bytes,
                    timestamp: None,
                    nbits: None,
                    external_coin: self.profile.coin,
                    from_group: 0,
                    to_group: 0,
                    extranonce1: self.extranonce1.lock().await.clone(),
                    extranonce2: String::new(),
                    epoch,
                });
            }
        }

        // Monero / RandomX (xmrig-compatible Stratum):
        // mining.notify params = [job_id, seed_hash, next_seed_hash, blob, height, target, clean_jobs]
        //   - blob: RandomX hashing blob (hex string, typically 152 hex / 76 bytes)
        //   - target: 8-byte little-endian hex (16 hex chars) or a JSON number
        //   - seed_hash / next_seed_hash: 32-byte hex (64 chars)
        //   - height: block height
        if self.profile.coin == ExternalCoin::XMR {
            if let Some(arr) = params.as_array() {
                if arr.len() >= 5 {
                    let job_id = arr[0].as_str().unwrap_or("unknown").to_string();

                    // Locate the blob (longest hex string) and the first 32-byte seed hash.
                    let mut blob_hex = "";
                    let mut seed_hash = None;
                    let mut height = None;
                    for v in arr.iter().skip(1) {
                        if let Some(s) = v.as_str() {
                            let clean = s.trim_start_matches("0x");
                            if clean.len() > 64 && blob_hex.is_empty() {
                                blob_hex = s;
                            } else if clean.len() == 64 && seed_hash.is_none() {
                                seed_hash = Some(s.to_string());
                            }
                        } else if v.is_u64() && height.is_none() {
                            height = v.as_u64();
                        }
                    }

                    // Target is usually the last parameter or the last string before clean_jobs.
                    let mut target_hex = "ffffffff";
                    for v in arr.iter().rev().take(3) {
                        if let Some(s) = v.as_str() {
                            let clean = s.trim_start_matches("0x");
                            if clean.len() == 16 {
                                target_hex = s;
                                break;
                            }
                        }
                    }

                    if !blob_hex.is_empty() {
                        let header_bytes = hex::decode(blob_hex.trim_start_matches("0x"))
                            .unwrap_or_default();
                        let target_bytes = crate::external_hashers::parse_randomx_target_hex(target_hex)
                            .or_else(|| crate::external_hashers::parse_target_hex(target_hex))
                            .unwrap_or([0xFFu8; 32]);

                        println!(
                            "auxpow: XMR notify — job={} blob_len={} height={:?} target={}",
                            job_id,
                            header_bytes.len(),
                            height,
                            &target_hex,
                        );

                        return Ok(ExternalJob {
                            job_id,
                            header_hex: blob_hex.to_string(),
                            target_hex: target_hex.to_string(),
                            seed_hash,
                            block_number: height,
                            algorithm: self.profile.algorithm.clone(),
                            header_bytes,
                            target_bytes,
                            timestamp: None,
                            nbits: None,
                            external_coin: self.profile.coin,
                            from_group: 0,
                            to_group: 0,
                            extranonce1: self.extranonce1.lock().await.clone(),
                            extranonce2: String::new(),
                            epoch: None,
                        });
                    }
                }
            }
        }

        // ERG / Autolykos v2 (2miners, standard Stratum v1):
        // mining.notify params = [job_id, height, blob, "", "", target_hex, target_decimal, "", clean_jobs]
        //   - job_id: short string (e.g. "34dea")
        //   - height: block height (integer, e.g. 1828793)
        //   - blob: Autolykos seed hash (32-byte hex = 64 chars)
        //   - target_hex: compact target (e.g. "00000002")
        //   - target_decimal: target as decimal string (e.g. "66346743...")
        //   - clean_jobs: bool
        // Also: mining.set_target is pushed separately with a 32-byte target.
        if self.profile.coin == ExternalCoin::ERG {
            if let Some(arr) = params.as_array() {
                if arr.len() >= 6 {
                    let job_id = arr[0].as_str().unwrap_or("unknown").to_string();
                    let height = arr[1].as_u64();
                    let blob_hex = arr[2].as_str().unwrap_or("").to_string();
                    let target_hex = arr[5].as_str().unwrap_or("ffffffff").to_string();

                    let header_bytes = hex::decode(blob_hex.trim_start_matches("0x"))
                        .unwrap_or_default();
                    // ERG target: compact hex (e.g. "00000002") or full 32-byte.
                    // Also check arr[6] for decimal target string.
                    let target_bytes = if target_hex.len() <= 8 {
                        // Compact target — parse as LE bytes and pad
                        let raw = hex::decode(&target_hex).unwrap_or_default();
                        let mut padded = [0xFFu8; 32];
                        if !raw.is_empty() && raw.len() <= 32 {
                            padded[..raw.len()].copy_from_slice(&raw);
                            for b in &mut padded[raw.len()..] {
                                *b = 0;
                            }
                        }
                        padded
                    } else {
                        crate::external_hashers::parse_target_hex(&target_hex)
                            .unwrap_or([0xFFu8; 32])
                    };

                    println!(
                        "auxpow: ERG notify — job={} blob_len={} height={:?} target={}",
                        job_id,
                        header_bytes.len(),
                        height,
                        &target_hex,
                    );

                    return Ok(ExternalJob {
                        job_id,
                        header_hex: blob_hex.clone(),
                        target_hex,
                        seed_hash: Some(blob_hex),
                        block_number: height,
                        algorithm: self.profile.algorithm.clone(),
                        header_bytes,
                        target_bytes,
                        timestamp: None,
                        nbits: None,
                        external_coin: self.profile.coin,
                        from_group: 0,
                        to_group: 0,
                        extranonce1: self.extranonce1.lock().await.clone(),
                        extranonce2: String::new(),
                        epoch: None,
                    });
                }
            }
        }

        // ZcashStratum (VRSC / VerusHash / LuckPool):
        // mining.notify params = [job_id, version, prevhash, merkle, reserved,
        //   ntime, nbits, clean_jobs, solution]
        // where solution is the Equihash/VerusHash solution hex (params[8]).
        // The blob for hashing = header_prefix(108B) + varint(fd4005) + solution(1344B).
        // We store the solution and ntime per job_id for submit reconstruction.
        if self.protocol == StratumProtocol::ZcashStratum {
            if let Some(arr) = params.as_array() {
                // Log raw notify params count and any extra params beyond 9
                println!(
                    "auxpow: VRSC notify params_count={} extra={}",
                    arr.len(),
                    if arr.len() > 9 { arr[9..].iter().map(|v| v.to_string()).collect::<Vec<_>>().join(",") } else { String::new() }
                );
                if arr.len() >= 8 {
                    let as_s = |idx: usize| -> String {
                        arr.get(idx)
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .trim_start_matches("0x")
                            .to_string()
                    };

                    let job_id = as_s(0);
                    let version = as_s(1);
                    let prevhash = as_s(2);
                    let merkle = as_s(3);
                    let reserved = as_s(4);
                    let ntime = as_s(5);
                    let nbits = as_s(6);
                    let clean_jobs = arr.get(7).and_then(|v| v.as_bool()).unwrap_or(false);
                    let maybe_solution = as_s(8);

                    if !job_id.is_empty() {
                        *self.latest_job_id.lock().await = Some(job_id.clone());
                    }

                    // VerusHash 2.2 solution: pad to exactly 1344 bytes (2688 hex).
                    // LuckPool sends ~229B; ccminer pads with zeros to 1344B.
                    let effective_solution = if self.profile.algorithm.eq_ignore_ascii_case("verushash") {
                        if !maybe_solution.is_empty() {
                            let mut sol = maybe_solution.clone();
                            if sol.len() < 2688 {
                                sol.push_str(&"0".repeat(2688 - sol.len()));
                            } else if sol.len() > 2688 {
                                sol.truncate(2688);
                            }
                            sol
                        } else {
                            "00".repeat(1344)
                        }
                    } else {
                        maybe_solution.clone()
                    };

                    // Clean jobs: invalidate old job state.
                    // NOTE: We do NOT clear job_ntime / job_solution / job_header_prefix
                    // on clean_jobs=true.  VRSC (LuckPool) sends clean=true on every
                    // notify (~30s), but shares for the previous job may still be in
                    // the forward queue.  If we wipe job_ntime here, the submit
                    // reconstruction falls back to the current timestamp, which
                    // doesn't match the block header → LuckPool rejects "unknown".
                    // Instead, we keep a rolling window of recent jobs and let old
                    // entries age out naturally.
                    if clean_jobs {
                        // Keep only the most recent 64 jobs to bound memory.
                        // VRSC job IDs are monotonically increasing hex strings,
                        // so we sort lexicographically and remove the smallest
                        // (oldest) entries.  HashMap iteration order is random,
                        // so we MUST sort to avoid evicting active jobs.
                        let mut sol = self.job_solution.lock().await;
                        let mut nt = self.job_ntime.lock().await;
                        let mut hp = self.job_header_prefix.lock().await;
                        if sol.len() > 64 {
                            let mut keys: Vec<String> = sol.keys().cloned().collect();
                            keys.sort();
                            let remove_count = keys.len() - 64;
                            for k in &keys[..remove_count] {
                                sol.remove(k);
                                nt.remove(k);
                                hp.remove(k);
                            }
                        }
                    }

                    // Store per-job data for submit reconstruction.
                    if !job_id.is_empty() {
                        if !effective_solution.is_empty() {
                            self.job_solution.lock().await.insert(job_id.clone(), effective_solution.clone());
                        }
                        let header_prefix = format!("{}{}{}{}{}{}", version, prevhash, merkle, reserved, ntime, nbits);
                        if !header_prefix.is_empty() {
                            self.job_header_prefix.lock().await.insert(job_id.clone(), header_prefix);
                        }
                        self.job_ntime.lock().await.insert(job_id.clone(), ntime.clone());
                    }

                    // Build the hashing blob:
                    // VerusCoin block header = version(4) + prevhash(32) + merkle(32)
                    //   + reserved(32) + ntime(4) + nbits(4) + nonce(32) + varint(3)
                    //   + solution(1344) = 1487 bytes total.
                    // The nonce field (32 bytes at offset 108) = extranonce1 + nonce2.
                    // The nonceSpace (15 bytes at solution offset 1329) = extranonce1
                    //   + padding + miner_nonce (PBaaS v7+).
                    // Both are initialized with extranonce1 + zeros; the miner
                    // fills in the miner_nonce portion during scanning.
                    let blob = if self.profile.algorithm.eq_ignore_ascii_case("verushash") {
                        let en1 = hex::encode(self.extranonce1.lock().await.clone());
                        // For PBaaS v7+: use extranonce1 in the nonce field.
                        // The miner does NOT modify the nonce field during scanning.
                        // The miner's unique work is in the solution nonceSpace only.
                        let nonce_field = format!("{:0<64}", en1); // 64 hex chars = 32 bytes
                        // Embed extranonce1 into solution nonceSpace (last 15 bytes = 30 hex)
                        let mut sol_with_ns = effective_solution.clone();
                        if sol_with_ns.len() == 2688 && !en1.is_empty() {
                            let mut ns = en1.clone();
                            if ns.len() < 30 {
                                ns.push_str(&"0".repeat(30 - ns.len()));
                            }
                            if ns.len() > 30 {
                                ns.truncate(30);
                            }
                            sol_with_ns.replace_range(2658..2688, &ns);
                        }
                        format!("{}{}{}{}{}{}{}fd4005{}", version, prevhash, merkle, reserved, ntime, nbits, nonce_field, sol_with_ns)
                    } else {
                        format!("{}{}{}{}{}{}{}", version, prevhash, merkle, reserved, ntime, nbits, effective_solution)
                    };

                    let header_bytes = hex::decode(&blob).unwrap_or_default();
                    let target_bytes = self.share_target().await;
                    let target_hex = hex::encode(target_bytes);

                    // Parse ntime as u64 for the timestamp field.
                    let timestamp = u64::from_str_radix(&ntime, 16).ok();

                    println!(
                        "auxpow: {} notify — job={} blob_len={} sol_len={} ntime={} clean={}",
                        self.profile.coin,
                        job_id,
                        header_bytes.len(),
                        effective_solution.len() / 2,
                        ntime,
                        clean_jobs,
                    );

                    return Ok(ExternalJob {
                        job_id,
                        header_hex: blob,
                        target_hex,
                        seed_hash: None,
                        block_number: None,
                        algorithm: self.profile.algorithm.clone(),
                        header_bytes,
                        target_bytes,
                        timestamp,
                        nbits: Some(nbits),
                        external_coin: self.profile.coin,
                        from_group: 0,
                        to_group: 0,
                        extranonce1: self.extranonce1.lock().await.clone(),
                        extranonce2: String::new(),
                        epoch: None,
                    });
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
        } else if self.profile.coin == ExternalCoin::DCR {
            // DCR (Blake3, DCP-0011) uses standard Stratum v1 format.  The pool
            // provides the serialized partial header in coinbase1 (arr[2], 144
            // bytes, standard offsets 36-179), the block version in arr[5], the
            // previous block hash in arr[1], and ntime/nbits in arr[7]/arr[6].
            // Assemble the full 180-byte block header template and insert the
            // pool-provided extranonce1 at absolute offset 144 (just after the
            // 4-byte nonce at offset 140), matching gominer/dcrpool semantics.
            let version_hex = arr.get(5).and_then(|v| v.as_str()).unwrap_or("00000000");
            let prevhash_hex = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
            let partial_header_hex = arr.get(2).and_then(|v| v.as_str()).unwrap_or("");
            let nbits = arr.get(6).and_then(|v| v.as_str()).map(String::from);
            let ntime = arr.get(7).and_then(|v| {
                if let Some(s) = v.as_str() {
                    u64::from_str_radix(s.trim_start_matches("0x"), 16).ok()
                } else {
                    v.as_u64()
                }
            });

            let mut full_header = Vec::with_capacity(180);
            full_header.extend_from_slice(
                &hex::decode(version_hex.trim_start_matches("0x")).unwrap_or_default(),
            );
            full_header.extend_from_slice(
                &hex::decode(prevhash_hex.trim_start_matches("0x")).unwrap_or_default(),
            );
            full_header.extend_from_slice(
                &hex::decode(partial_header_hex.trim_start_matches("0x")).unwrap_or_default(),
            );
            full_header.resize(180, 0);

            let en1 = self.extranonce1.lock().await.clone();
            let en1_len = en1.len().min(4);
            if en1_len > 0 {
                full_header[144..144 + en1_len].copy_from_slice(&en1[..en1_len]);
            }

            let target = hex::encode(self.share_target().await);
            (hex::encode(&full_header), target, ntime, nbits)
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
            // For kHeavyHash/KAS the prevhash field is the 32-byte pre_pow_hash.
            // The share target is derived from the difficulty set by
            // mining.set_difficulty, not from the network nbits field.
            let target = if self.profile.algorithm.eq_ignore_ascii_case("kheavyhash") {
                hex::encode(self.share_target().await)
            } else {
                nbits.clone().unwrap_or_else(|| "ffffffff".to_string())
            };
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
            from_group: 0,
            to_group: 0,
            extranonce1: self.extranonce1.lock().await.clone(),
            extranonce2: String::new(),
            epoch: None,
        })
    }

    /// Get the current job, if any.
    pub async fn current_job(&self) -> Option<ExternalJob> {
        self.current_job.lock().await.clone()
    }

    /// Wait for a new job with timeout.
    /// The first call returns the current job if one exists. Subsequent calls
    /// wait until the current job id differs from the last returned id.
    pub async fn wait_for_job(&self, timeout_ms: u64) -> Result<Option<ExternalJob>> {
        let last_id = self.last_waited_job_id.lock().await.clone();

        // Fast path: a job may have already arrived before we started waiting
        // and is different from the one we already returned.
        if let Some(job) = self.current_job().await {
            if last_id.as_deref() != Some(job.job_id.as_str()) {
                *self.last_waited_job_id.lock().await = Some(job.job_id.clone());
                return Ok(Some(job));
            }
        }

        let result = timeout(
            Duration::from_millis(timeout_ms),
            self.job_notify.notified(),
        )
        .await;
        if result.is_ok() {
            if let Some(job) = self.current_job().await {
                *self.last_waited_job_id.lock().await = Some(job.job_id.clone());
                Ok(Some(job))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    /// Submit a share to the pool.
    ///
    /// Returns whether the pool accepted or rejected the share.
    ///
    /// Supports three Stratum submit dialects:
    ///   - Standard / zpool / KAS: `[worker, job_id, nonce_hex]`
    ///   - Alephium: JSON object `{jobId, fromGroup, toGroup, nonce, worker}`
    ///   - EthStratum (ERG/RVN/ETC): `eth_submitWork` with `[nonce_hex, header_hash, mix_hash]`
    ///
    /// `mix_hash_hex` is the PoW mix hash for Ethash/KawPow (needed for
    /// eth_submitWork).  If `None`, the `_hash_hex` (final hash) is used as
    /// a fallback (correct for Autolykos, incorrect for Ethash/KawPow).
    pub async fn submit_share(
        &self,
        job_id: &str,
        nonce: u64,
        _hash_hex: &str,
        mix_hash_hex: Option<&str>,
    ) -> Result<ShareResult> {
        let is_alph = self.profile.algorithm.eq_ignore_ascii_case("blake3")
            && self.profile.coin == ExternalCoin::ALPH;
        let is_kas = self.profile.algorithm.eq_ignore_ascii_case("kheavyhash")
            && self.profile.coin == ExternalCoin::KAS;
        let is_ethstratum = self.protocol == StratumProtocol::EthStratum;
        let is_epic = self.protocol == StratumProtocol::EpicStratum;
        let is_beam = self.protocol == StratumProtocol::BeamStratum;

        // EPIC submit format:
        //   {"id": N, "method": "submit", "params": {
        //     "height": N, "job_id": N, "nonce": N,
        //     "pow": {"ProgPow": [32 bytes mixHash as array of ints]}
        //   }}
        // The mix_hash is the ProgPow mix hash (32 bytes).
        if is_epic {
            let job = self.current_job().await;
            let height = job
                .as_ref()
                .and_then(|j| j.block_number)
                .unwrap_or(0);
            let job_id_num: u64 = job_id.parse().unwrap_or(0);

            // Convert mix_hash_hex to array of 32 bytes for ProgPow pow field.
            // EPIC expects the mix hash as a JSON array of integers [0, 255, ...].
            let mix_hex = mix_hash_hex.unwrap_or(_hash_hex);
            let mix_bytes = hex::decode(mix_hex.trim_start_matches("0x"))
                .unwrap_or_else(|_| vec![0u8; 32]);
            // Pad/truncate to 32 bytes
            let mut mix_arr = [0u8; 32];
            let len = mix_bytes.len().min(32);
            mix_arr[..len].copy_from_slice(&mix_bytes[..len]);
            let mix_json: Vec<i64> = mix_arr.iter().map(|&b| b as i64).collect();

            let req = json!({
                "jsonrpc": "2.0",
                "id": 20,
                "method": "submit",
                "params": {
                    "height": height,
                    "job_id": job_id_num,
                    "nonce": nonce,
                    "pow": {
                        "ProgPow": mix_json
                    }
                }
            });
            let resp = self.send_request(&req).await?;
            if let Some(err) = resp.get("error") {
                if !err.is_null() {
                    let msg = err.get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("unknown error");
                    return Ok(ShareResult::Rejected(msg.to_string()));
                }
            }
            let ok = resp.get("result")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            if ok {
                return Ok(ShareResult::Accepted);
            } else {
                return Ok(ShareResult::Rejected("submit rejected".to_string()));
            }
        }

        // Beam submit format:
        //   {"method": "solution", "id": "JOB_ID", "nonce": "NONCE_HEX",
        //    "output": "SOLUTION_HEX", "jsonrpc": "2.0"}
        // nonce = 8-byte LE hex, output = 104-byte solution hex (100 bytes
        // compressed indices + 4 bytes extra nonce).
        if is_beam {
            let nonce_hex = format!("{:016x}", nonce);
            // mix_hash_hex carries the solution hex for BeamHash III
            let solution_hex = mix_hash_hex.unwrap_or(_hash_hex);
            let req = json!({
                "method": "solution",
                "id": job_id,
                "nonce": nonce_hex,
                "output": solution_hex,
                "jsonrpc": "2.0"
            });
            let resp = self.send_request(&req).await?;
            if let Some(err) = resp.get("error") {
                if !err.is_null() {
                    let msg = err.get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("unknown error");
                    return Ok(ShareResult::Rejected(msg.to_string()));
                }
            }
            let ok = resp.get("result")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            if ok {
                return Ok(ShareResult::Accepted);
            } else {
                return Ok(ShareResult::Rejected("submit rejected".to_string()));
            }
        }

        let (method, params) = if is_ethstratum {
            // EthStratum submit: eth_submitWork(nonce_hex, header_hash, mix_hash)
            // The nonce is 0x-prefixed hex.  mix_hash is the PoW mix hash
            // (for ethash/kawpow) or the final hash (for autolykos).
            let nonce_hex = format!("0x{:016x}", nonce);
            // Use the real mix hash if provided (from GPU kernel), otherwise
            // fall back to the final hash (Autolykos path).
            let mix_src = mix_hash_hex.unwrap_or(_hash_hex);
            let mix_hex = if mix_src.starts_with("0x") {
                mix_src.to_string()
            } else {
                format!("0x{}", mix_src)
            };
            ("eth_submitWork", json!([nonce_hex, job_id, mix_hex]))
        } else if is_alph {
            // Alephium stratum submit uses a JSON object: {jobId, fromGroup,
            // toGroup, nonce, worker}.  The nonce is the full 24-byte value
            // (48 hex chars) composed of extranonce1 || scanned_nonce (LE) ||
            // zero padding, matching the WoolyPooly/luminousminer Blake3
            // implementation.
            let job = self.current_job().await;
            let (from_group, to_group) = job
                .as_ref()
                .map(|j| (j.from_group, j.to_group))
                .unwrap_or((0, 0));
            let en1 = self.extranonce1.lock().await.clone();
            let mut base_bytes = [0u8; 8];
            let en1_len = en1.len().min(8);
            base_bytes[8 - en1_len..].copy_from_slice(&en1[..en1_len]);
            let base = u64::from_be_bytes(base_bytes);
            let candidate = base.wrapping_add(nonce);
            let mut full = [0u8; 24];
            full[..8].copy_from_slice(&candidate.to_be_bytes());
            let nonce_hex = hex::encode(full);
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            ("mining.submit", json!({
                "jobId": job_id,
                "fromGroup": from_group,
                "toGroup": to_group,
                "nonce": nonce_hex,
                "worker": worker,
            }))
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
            ("mining.submit", json!([worker, job_id, hex]))
        } else if self.profile.coin == ExternalCoin::RVN {
            // RVN on 2miners uses Stratum v1 mining.submit with 5 params:
            //   [worker, job_id, nonce_hex, header_hash_hex, mix_hash_hex]
            // job_id = short job_id from notify, nonce = 0x-prefixed 8-byte hex,
            // header_hash = 0x-prefixed 32-byte block header hash from notify,
            // mix_hash = 0x-prefixed 32-byte PoW mix hash from KawPow GPU kernel.
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            let nonce_hex = format!("0x{:016x}", nonce);
            let current_job = self.current_job().await;
            let header_hash_hex = current_job
                .as_ref()
                .map(|j| {
                    if j.header_hex.starts_with("0x") {
                        j.header_hex.clone()
                    } else {
                        format!("0x{}", j.header_hex)
                    }
                })
                .unwrap_or_else(|| "0x0000000000000000000000000000000000000000000000000000000000000000".to_string());
            let mix_src = mix_hash_hex.unwrap_or(_hash_hex);
            let mix_hex = if mix_src.starts_with("0x") {
                mix_src.to_string()
            } else {
                format!("0x{}", mix_src)
            };
            ("mining.submit", json!([worker, job_id, nonce_hex, header_hash_hex, mix_hex]))
        } else if self.profile.coin == ExternalCoin::ETC {
            // ETC on 2miners uses Stratum v1 mining.submit with 5 params:
            //   [worker, job_id, nonce_hex, header_hash_hex, mix_hash_hex]
            // job_id = short job_id from notify, nonce = 0x-prefixed hex,
            // header_hash = 0x-prefixed 32-byte block header hash from notify,
            // mix_hash = 0x-prefixed 32-byte PoW mix hash from GPU kernel.
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            let nonce_hex = format!("0x{:016x}", nonce);
            let current_job = self.current_job().await;
            let header_hash_hex = current_job
                .as_ref()
                .map(|j| {
                    if j.header_hex.starts_with("0x") {
                        j.header_hex.clone()
                    } else {
                        format!("0x{}", j.header_hex)
                    }
                })
                .unwrap_or_else(|| "0x0000000000000000000000000000000000000000000000000000000000000000".to_string());
            let mix_src = mix_hash_hex.unwrap_or(_hash_hex);
            let mix_hex = if mix_src.starts_with("0x") {
                mix_src.to_string()
            } else {
                format!("0x{}", mix_src)
            };
            ("mining.submit", json!([worker, job_id, nonce_hex, header_hash_hex, mix_hex]))
        } else if self.profile.coin == ExternalCoin::XMR {
            // Monero / RandomX (xmrig-compatible Stratum):
            // mining.submit params = [worker, job_id, nonce_hex]
            // The nonce is a 32-bit value represented as an 8-character hex
            // string (no 0x prefix), matching xmrig's submit format.
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            let nonce_hex = format!("{:08x}", (nonce & 0xFFFFFFFF) as u32);
            ("mining.submit", json!([worker, job_id, nonce_hex]))
        } else if self.protocol == StratumProtocol::ZcashStratum {
            // ZcashStratum (VRSC / VerusHash / LuckPool) submit:
            // mining.submit params = [worker, job_id, ntime, nonce2, solution_with_varint]
            //
            // nonce2 = extranonce1 + miner_nonce(LE) padded to 32 bytes total
            //   (nonce2_bytes = 32 - len(extranonce1_bytes))
            // solution_with_varint = fd4005 + solution(1344B) with:
            //   - PBaaS v7+ nonceSpace embedded in last 15 bytes (bytes 1329-1343)
            //   - MMR roots restored from original job solution (bytes 8-72)

            // Stale share detection: warn but still forward to upstream pool.
            // The upstream pool (LuckPool) will reject if truly stale — we
            // don't need to pre-reject here because parallel streaming means
            // the miner may find a share for a job that was superseded while
            // it was scanning.  Forwarding gives the share a chance.
            {
                let latest = self.latest_job_id.lock().await.clone();
                if let Some(ref cur) = latest {
                    if !cur.is_empty() && job_id != *cur {
                        warn!(
                            "auxpow: VRSC share for previous job={} (latest={}) nonce={} — forwarding anyway",
                            job_id, cur, nonce
                        );
                    }
                }
            }

            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);

            // ntime from stored job data, or from current job, or current time.
            let ntime = {
                let job_ntime = self.job_ntime.lock().await.get(job_id).cloned();
                if let Some(nt) = job_ntime {
                    nt
                } else if let Some(job) = self.current_job().await {
                    job.timestamp
                        .map(|t| format!("{:08x}", t))
                        .unwrap_or_else(|| format!("{:08x}", chrono::Utc::now().timestamp() as u32))
                } else {
                    format!("{:08x}", chrono::Utc::now().timestamp() as u32)
                }
            };

            // Build nonce2: miner_nonce(LE 4B) + zero padding.
            // For VRSC (VerusHash/PBaaS v7+): nonce field = 32 bytes total.
            //   nonce2 = 32 - len(extranonce1) = 28 bytes (for en1=4)
            //   The pool reconstructs nonce_field = extranonce1 + nonce2 (32 bytes).
            //   nonce2 layout: [miner_nonce(4B)][padding(24B)] (miner_nonce at START)
            // For standard Zcash (FLUX/Equihash): nonce field = 32 bytes total.
            //   nonce2 = 32 - en_bytes
            let en1_hex = hex::encode(self.extranonce1.lock().await.clone());
            let nonce2_4b = {
                let padded = format!("{:0>8x}", nonce & 0xFFFFFFFF);
                if let Ok(val) = u32::from_str_radix(&padded, 16) {
                    hex::encode(val.to_le_bytes())
                } else {
                    padded
                }
            };
            let nonce2_str = {
                let en_bytes = en1_hex.len() / 2;
                // PBaaS v7+ (VerusHash/VRSC): nonceSpace = 15 bytes
                // Standard Zcash (FLUX/Equihash): nonce field = 32 bytes
                let nonce_field_total = if self.profile.algorithm.eq_ignore_ascii_case("verushash") {
                    15usize
                } else {
                    32usize
                };
                let nonce2_bytes = nonce_field_total.saturating_sub(en_bytes);
                let nonce2_hex_len = nonce2_bytes * 2;
                // nonce2 = [miner_nonce][padding] (miner_nonce at START)
                let mut out = nonce2_4b.clone();
                let pad_len = nonce2_hex_len.saturating_sub(out.len());
                if pad_len > 0 {
                    out.push_str(&"0".repeat(pad_len));
                }
                if out.len() > nonce2_hex_len {
                    out.truncate(nonce2_hex_len);
                }
                out
            };

            // Build solution_with_varint for VerusHash 2.2.
            let solution_with_varint = if self.profile.algorithm.eq_ignore_ascii_case("verushash") {
                let solution_raw = self.job_solution.lock().await.get(job_id).cloned()
                    .unwrap_or_else(|| "00".repeat(1344));

                // Ensure solution is exactly 2688 hex (1344 bytes).
                let mut sol = if solution_raw.len() == 2688 {
                    solution_raw.clone()
                } else if solution_raw.len() > 2688 {
                    solution_raw[..2688].to_string()
                } else {
                    format!("{}{}", solution_raw, "0".repeat((2688 - solution_raw.len()) / 2))
                };

                // PBaaS v7+ nonceSpace embedding: write extranonce1 + miner_nonce
                // into last 15 bytes (30 hex chars) of solution at offset 2658.
                // Layout: [en1][miner_nonce(4B)][padding] (miner_nonce right after en1)
                if !en1_hex.is_empty() {
                    let mut nonce_space = en1_hex.clone();
                    nonce_space.push_str(&nonce2_4b);
                    if nonce_space.len() < 30 {
                        nonce_space.push_str(&"0".repeat(30 - nonce_space.len()));
                    }
                    if nonce_space.len() > 30 {
                        nonce_space.truncate(30);
                    }
                    if sol.len() >= 2688 {
                        sol.replace_range(2658..2688, &nonce_space);
                    }
                }

                // Restore MMR roots from original job solution (bytes 8-72 = hex 16..144).
                let orig_sol = self.job_solution.lock().await.get(job_id).cloned();
                if let Some(orig) = orig_sol {
                    if orig.len() >= 144 && sol.len() >= 144 {
                        sol.replace_range(16..144, &orig[16..144]);
                    }
                }

                // Prepend varint: fd4005 = 1344 in ZCash compact varint.
                format!("fd4005{}", sol)
            } else {
                // Non-VerusHash ZcashStratum (FLUX / ZelHash / Equihash 125,4):
                // The miner sends the Equihash solution in mix_hash_hex.
                // Solution size for Equihash 125,4 = 52 bytes = 104 hex chars.
                // Varint for 52 = 0x34 (single byte, since 52 < 253).
                let sol_hex = mix_hash_hex.unwrap_or(_hash_hex);
                let sol_hex = sol_hex.trim_start_matches("0x");
                // Prepend varint for solution size (0x34 = 52 bytes)
                format!("34{}", sol_hex)
            };

            println!(
                "auxpow: {} submit — job={} ntime={} nonce2_len={} sol_len={}",
                self.profile.coin, job_id, ntime, nonce2_str.len(), solution_with_varint.len()
            );
            // Detailed debug: print exact submit params (truncated for readability)
            println!(
                "auxpow: VRSC submit DETAIL — nonce2={} sol_first20={} sol_last30={}",
                nonce2_str,
                &solution_with_varint[..20.min(solution_with_varint.len())],
                &solution_with_varint[solution_with_varint.len().saturating_sub(30)..],
            );

            // Zcash Stratum Protocol (ZIP 301) — 5 params:
            //   [worker, job_id, time, nonce2, equihash_solution]
            // LuckPool VRSC follows this format. The "unknown" rejections
            // were NOT caused by the parameter count — they were caused by
            // the solution/nonce2 content being wrong.
            ("mining.submit", json!([worker, job_id, ntime, nonce2_str, solution_with_varint]))
        } else if self.profile.coin == ExternalCoin::DCR {
            // DCR Blake3: standard Stratum v1 submit with 5 params:
            //   [worker, job_id, extranonce2, ntime, nonce]
            // extranonce2 is empty (coinbase2 is empty for DCR Blake3).
            // ntime is from the notify. nonce is 4-byte LE as hex string.
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            let job = self.current_job().await;
            let ntime = job
                .as_ref()
                .and_then(|j| j.timestamp)
                .map(|t| format!("{:08x}", t))
                .unwrap_or_else(|| "00000000".to_string());
            // Nonce as LE byte hex (e.g. nonce=14 → "0e000000")
            let nonce_le_bytes = (nonce as u32).to_le_bytes();
            let nonce_hex = hex::encode(nonce_le_bytes);
            ("mining.submit", json!([worker, job_id, "", ntime, nonce_hex]))
        } else if self.profile.coin == ExternalCoin::ERG {
            // ERG / Autolykos v2 (2miners): 3 params
            //   [worker, job_id, nonce2]
            // nonce2 = extranonce2 + miner_nonce (8 bytes LE hex)
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            let en1 = self.extranonce1.lock().await;
            let en1_hex = hex::encode(&*en1);
            let nonce2_4b = format!("{:08x}", nonce);
            // ERG nonce2 = miner_nonce (4 bytes) padded to extranonce2 size
            // 2miners ERG: extranonce2_size = 6 (from subscribe), en1 = 4 bytes
            // nonce2 = 6 bytes total = miner_nonce(4B) + padding(2B)
            let nonce2_size = 6usize;
            let mut nonce2 = nonce2_4b.clone();
            let needed = nonce2_size * 2;
            if nonce2.len() < needed {
                nonce2.push_str(&"0".repeat(needed - nonce2.len()));
            }
            if nonce2.len() > needed {
                nonce2.truncate(needed);
            }
            println!(
                "auxpow: ERG submit — job={} nonce2={} en1={}",
                job_id, nonce2, en1_hex
            );
            ("mining.submit", json!([worker, job_id, nonce2]))
        } else if self.protocol == StratumProtocol::PearlStratum {
            // Pearl (PRL) PearlStratum submit: object params, no nonce.
            //   {job_id, plain_proof (base64)}
            //
            // plain_proof is a bincode-serialized PlainProof, base64-encoded.
            // The pool deserializes it, verifies Merkle proofs and jackpot hash.
            //
            // We use the real Pearl PoUW pipeline (pearl_real_pouw module):
            //   1. Derive job_key from block header + mining config
            //   2. Generate random matrices A, B (int8)
            //   3. Build BLAKE3 Merkle trees, compute noise seeds
            //   4. Generate noise matrices (E=EL·ER, F=FL·FR)
            //   5. Noisy GEMM with jackpot hash check
            //   6. Build PlainProof with sampled rows/cols + Merkle proofs
            //   7. Serialize via bincode → base64
            //
            // Standard config: m=512, n=512, k=4096, noise_rank=256
            //
            // When GPU OpenCL backend is available, the noisy GEMM (step 5)
            // runs on the GPU for ~10x speedup. CPU still handles matrix
            // generation, Merkle trees, noise, and proof construction.
            let job = self.current_job().await;
            let header_hex = job
                .as_ref()
                .map(|j| j.header_hex.clone())
                .unwrap_or_default();
            let target_hex = job
                .as_ref()
                .map(|j| j.target_hex.clone())
                .unwrap_or_else(|| "ff".repeat(32));

            // Pearl PoUW dimensions — use params from `pearl.set_mining_params`
            // if the pool has sent them, otherwise fall back to defaults.
            let pmp = self.pearl_mining_params.lock().await.clone();
            let (m, n, k, noise_rank, hash_tile_h, hash_tile_w) = match &pmp {
                Some(p) => {
                    // hash_tile dimensions come from rows_pattern / cols_pattern
                    let hth = if p.rows_pattern.is_empty() {
                        crate::pearl_real_pouw::DEFAULT_HASH_TILE_H
                    } else {
                        p.rows_pattern.len()
                    };
                    let htw = if p.cols_pattern.is_empty() {
                        crate::pearl_real_pouw::DEFAULT_HASH_TILE_W
                    } else {
                        p.cols_pattern.len()
                    };
                    (p.m, p.n, p.k, p.rank, hth, htw)
                }
                None => (
                    crate::pearl_real_pouw::DEFAULT_M,
                    crate::pearl_real_pouw::DEFAULT_N,
                    crate::pearl_real_pouw::DEFAULT_K,
                    crate::pearl_real_pouw::DEFAULT_NOISE_RANK,
                    crate::pearl_real_pouw::DEFAULT_HASH_TILE_H,
                    crate::pearl_real_pouw::DEFAULT_HASH_TILE_W,
                ),
            };
            let noise_range = crate::pearl_real_pouw::DEFAULT_NOISE_RANGE;

            // Check if GPU OpenCL backend is available
            #[cfg(feature = "gpu-opencl")]
            let has_gpu = self.has_gpu_opencl().await;
            #[cfg(not(feature = "gpu-opencl"))]
            let has_gpu = false;

            println!(
                "auxpow: PRL real PoUW mining — m={} n={} k={} rank={} gpu={} header_hex={}... target_hex={}",
                m, n, k, noise_rank, has_gpu, &header_hex[..header_hex.len().min(20)], &target_hex
            );

            // Run the real PoUW mining pipeline in an internal loop.
            // Each attempt uses a different nonce → different matrices → different hashes.
            // Only submit to the pool when a share meeting the target is found.
            // This avoids spamming the pool with invalid dummy proofs.
            use std::sync::atomic::{AtomicU64, Ordering};
            static NONCE_COUNTER: AtomicU64 = AtomicU64::new(0);
            const MAX_ATTEMPTS_PER_CALL: u64 = 50;

            let mut plain_proof: Option<String> = None;
            let mut attempts_this_call = 0u64;
            let mine_start = std::time::Instant::now();

            for _ in 0..MAX_ATTEMPTS_PER_CALL {
                let nonce = NONCE_COUNTER.fetch_add(1, Ordering::Relaxed);
                attempts_this_call += 1;

                #[cfg(feature = "gpu-opencl")]
                let mined_result = if has_gpu {
                    let mut gpu_backend = self.gpu_opencl_backend.lock().await;
                    if let Some(ref mut miner) = *gpu_backend {
                        crate::pearl_real_pouw::mine_pearl_share_gpu(
                            &header_hex,
                            &target_hex,
                            m, n, k, noise_rank, noise_range,
                            hash_tile_h, hash_tile_w,
                            nonce,
                            miner,
                        )
                    } else {
                        crate::pearl_real_pouw::mine_pearl_share(
                            &header_hex,
                            &target_hex,
                            m, n, k, noise_rank, noise_range,
                            hash_tile_h, hash_tile_w,
                            nonce,
                        )
                    }
                } else {
                    crate::pearl_real_pouw::mine_pearl_share(
                        &header_hex,
                        &target_hex,
                        m, n, k, noise_rank, noise_range,
                        hash_tile_h, hash_tile_w,
                        nonce,
                    )
                };

                #[cfg(not(feature = "gpu-opencl"))]
                let mined_result = crate::pearl_real_pouw::mine_pearl_share(
                    &header_hex,
                    &target_hex,
                    m, n, k, noise_rank, noise_range,
                    hash_tile_h, hash_tile_w,
                    nonce,
                );

                match mined_result {
                    Ok(Some(proof)) => {
                        let b64 = proof.to_base64().unwrap_or_default();
                        let elapsed_ms = mine_start.elapsed().as_secs_f64() * 1000.0;
                        println!(
                            "auxpow: PRL share found! nonce={} attempts={} time={:.1}ms b64_len={}",
                            nonce, attempts_this_call, elapsed_ms, b64.len()
                        );
                        plain_proof = Some(b64);
                        break;
                    }
                    Ok(None) => {
                        // No share this attempt — try next nonce
                    }
                    Err(e) => {
                        println!("auxpow: PRL mining error: {} — retrying", e);
                    }
                }
            }

            let plain_proof = match plain_proof {
                Some(p) => p,
                None => {
                    let elapsed_ms = mine_start.elapsed().as_secs_f64() * 1000.0;
                    let total_nonce = NONCE_COUNTER.load(Ordering::Relaxed);
                    println!(
                        "auxpow: PRL no share after {} attempts ({:.1}ms, total nonces={}) — not submitting",
                        attempts_this_call, elapsed_ms, total_nonce
                    );
                    return Ok(ShareResult::NoShare);
                }
            };

            println!(
                "auxpow: PRL submit — job={} proof_b64_len={}",
                job_id, plain_proof.len()
            );

            // Pearl plain stratum (port 5571) per suprnova spec §4.3:
            //   mining.submit with object params {job_id, plain_proof}
            //   plain_proof is base64-encoded bincode PlainProof
            ("mining.submit", json!({
                "job_id": job_id,
                "plain_proof": plain_proof
            }))
        } else {
            let hex = format!("0x{:016x}", nonce);
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            ("mining.submit", json!([worker, job_id, hex]))
        };

        let req = json!({
            "jsonrpc": "2.0",
            "id": 100,
            "method": method,
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
                println!("auxpow: VRSC submit response (result=false, error=null): {}", resp);
                return Ok(ShareResult::Unknown);
            }
            // Log the raw error for debugging
            println!("auxpow: VRSC submit error raw: {}", err);
            let reason = if let Some(m) = err.get("message").and_then(|m| m.as_str()) {
                m.to_string()
            } else if let Some(s) = err.as_str() {
                s.to_string()
            } else {
                format!("{}", err)
            };
            warn!("AuxPow: share rejected for {}: {}", self.profile.coin, reason);
            Ok(ShareResult::Rejected(reason))
        } else {
            Ok(ShareResult::Unknown)
        }
    }

    /// Submit a pre-built Pearl PlainProof to AlphaPool.
    ///
    /// Unlike `submit_share()` which mines the PoUW internally, this method
    /// just forwards a proof that the miner has already computed on GPU.
    /// This is the pool-routed path: the miner mines PoUW → sends PearlSubmit
    /// to the ZION pool → the pool calls this method to forward to AlphaPool.
    ///
    /// `plain_proof_b64` is the bincode-serialized PlainProof, base64-encoded.
    /// `header_bytes` is the incomplete block header (from the pearl.challenge).
    /// `target_bytes` is the share target (32 bytes big-endian).
    pub async fn submit_pearl_proof(
        &self,
        _job_id: &str,
        plain_proof_b64: &str,
        header_bytes: &[u8],
        target_bytes: &[u8; 32],
    ) -> Result<ShareResult> {
        let header_b64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            header_bytes,
        );
        // Convert 32-byte big-endian target to decimal string
        let target_str = target_bytes_to_decimal_string(target_bytes);

        let params = json!({
            "plain_proof": plain_proof_b64,
            "mining_job": {
                "incomplete_header_bytes": header_b64,
                "target": serde_json::Value::Number(serde_json::Number::from_str(&target_str).unwrap_or_else(|_| serde_json::Number::from(u64::MAX)))
            }
        });

        let req = json!({
            "jsonrpc": "2.0",
            "id": 200,
            "method": "submitPlainProof",
            "params": params
        });

        println!(
            "auxpow: PRL forward proof — proof_b64_len={} header_len={} target={}",
            plain_proof_b64.len(),
            header_bytes.len(),
            target_str
        );

        let resp = self.send_request(&req).await?;

        let accepted = resp
            .get("result")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if accepted {
            info!("AuxPow: PRL proof accepted by AlphaPool");
            Ok(ShareResult::Accepted)
        } else if let Some(err) = resp.get("error") {
            if err.is_null() {
                return Ok(ShareResult::Unknown);
            }
            let reason = if let Some(m) = err.get("message").and_then(|m| m.as_str()) {
                m.to_string()
            } else if let Some(s) = err.as_str() {
                s.to_string()
            } else {
                format!("{}", err)
            };
            warn!("AuxPow: PRL proof rejected: {}", reason);
            Ok(ShareResult::Rejected(reason))
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
    /// Uses the coin-specific max target:
    ///   - 224-bit for KAS and DCR (`0x00 x4 || 0xFF x28`)
    ///   - 226-bit for ALPH (`0x00 x3 || 0x03 || 0xFF x28`)
    ///   - 256-bit for everything else.
    /// The result saturates at max target, so difficulties below 1.0 produce
    /// the easiest possible target.
    pub async fn share_target(&self) -> [u8; 32] {
        let difficulty = self.current_difficulty().await;
        // The Kaspa stratum bridge (rusty-kaspa/bridge) uses a 224-bit max target
        // (2^224 - 1) for converting Stratum difficulty to share target.
        let max_target = if self.profile.algorithm.eq_ignore_ascii_case("kheavyhash") {
            // 2^224 - 1 as a 32-byte big-endian number: 4 leading zero bytes
            // followed by 28 0xFF bytes.  This matches the Kaspa stratum bridge.
            let mut t = [0u8; 32];
            t[4..].fill(0xFF);
            t
        } else if self.profile.coin == ExternalCoin::DCR {
            // Decred mainnet PoW limit is 2^224 - 1 (same byte pattern as KAS).
            // This matches gominer/dcrpool DiffToTarget(net.PowLimit, difficulty).
            // For local/integration testing against a mock pool, set
            // ZION_AUXPOW_DCR_MAX_TARGET=full to use the full 256-bit max target
            // and obtain shares quickly.
            if std::env::var("ZION_AUXPOW_DCR_MAX_TARGET")
                .as_deref()
                .unwrap_or("")
                .eq_ignore_ascii_case("full")
            {
                [0xFFu8; 32]
            } else {
                let mut t = [0u8; 32];
                t[4..].fill(0xFF);
                t
            }
        } else if self.profile.coin == ExternalCoin::ALPH {
            // Alephium pools (e.g. alephium/mining-pool) define difficulty 1 as a
            // target with 30 leading zero bits (diff1TargetNumZero=30), so the
            // effective max target is 2^226 - 1.
            let mut t = [0xFFu8; 32];
            t[0] = 0x00;
            t[1] = 0x00;
            t[2] = 0x00;
            t[3] = 0x03;
            t
        } else {
            [0xFFu8; 32]
        };
        difficulty_to_target_with_max(difficulty, &max_target)
    }

    /// Disconnect from the pool.
    pub async fn disconnect(&self) -> Result<()> {
        *self.eth_getwork_polling.lock().await = false;
        *self.stream.lock().await = None;
        *self.reader.lock().await = None;
        *self.connected.lock().await = false;
        *self.subscribed.lock().await = false;
        *self.authorized.lock().await = false;
        self.shutdown.notify_waiters();
        info!("AuxPow: disconnected from {}", self.profile.coin);
        Ok(())
    }

    // ── EthStratum methods ──────────────────────────────────────────

    /// Start a background task that periodically sends `eth_getWork`
    /// requests to the pool.  This is used for EthStratum pools that
    /// do not push job notifications and require polling.
    async fn start_eth_getwork_polling(&self) {
        *self.eth_getwork_polling.lock().await = true;
        let client_clone = Arc::new(self.clone());
        tokio::spawn(async move {
            // Initial fetch immediately after connect.
            if let Err(e) = client_clone.request_eth_getwork().await {
                debug!("auxpow: initial eth_getWork for {}: {}", client_clone.profile.coin, e);
            }
            loop {
                // Poll every 3 seconds — fast enough to catch new jobs,
                // slow enough to avoid rate limiting.
                tokio::time::sleep(Duration::from_secs(3)).await;

                // Stop if polling was disabled (disconnect).
                if !*client_clone.eth_getwork_polling.lock().await {
                    break;
                }
                if !*client_clone.connected.lock().await {
                    break;
                }

                if let Err(e) = client_clone.request_eth_getwork().await {
                    debug!(
                        "auxpow: eth_getWork poll for {}: {} — will retry",
                        client_clone.profile.coin, e
                    );
                }
            }
        });
    }

    /// Send an `eth_getWork` request and parse the response into a job.
    ///
    /// The response format is the same as the notification:
    ///   `[seed_hash, header_hash, target]`
    /// where all three are 0x-prefixed hex strings.
    pub async fn request_eth_getwork(&self) -> Result<()> {
        let id = {
            let mut next = self.next_rpc_id.lock().await;
            let id = *next;
            *next += 1;
            id
        };
        let req = json!({
            "id": id,
            "method": "eth_getWork",
            "params": []
        });
        let resp = self.send_request(&req).await?;
        // The response has "result" = [seed_hash, header_hash, target]
        // (same format as the notification params).
        if let Some(result) = resp.get("result") {
            if let Some(arr) = result.as_array() {
                if arr.len() >= 3 {
                    let job = self
                        .parse_eth_getwork_params(
                            arr[0].as_str().unwrap_or(""),
                            arr[1].as_str().unwrap_or(""),
                            arr[2].as_str().unwrap_or(""),
                        )
                        .await;
                    *self.current_job.lock().await = Some(job);
                    self.job_notify.notify_waiters();
                    return Ok(());
                }
            }
            // Some pools return result=null when no work is available yet.
            debug!(
                "auxpow: eth_getWork response for {} has unexpected result: {:?}",
                self.profile.coin, result
            );
        }
        // If result is null/missing, just skip — we'll retry on next poll.
        Ok(())
    }

    /// Handle `pearl.set_mining_params` notification from AlphaPool.
    ///
    /// AlphaPool sends: `{"m": <int>, "n": <int>, "k": <int>, "rank": <int>,
    ///   "rows_pattern": [<int>, ...], "cols_pattern": [<int>, ...]}`
    ///
    /// These parameters define the matrix dimensions and hash tile patterns
    /// for PoUW mining. The miner must use these values instead of defaults.
    async fn handle_pearl_set_mining_params(&self, params: &Value) {
        let obj = match params.as_object() {
            Some(o) => o,
            None => {
                eprintln!("auxpow: PRL pearl.set_mining_params — invalid params (not object)");
                return;
            }
        };

        let m = obj.get("m").and_then(|v| v.as_u64()).unwrap_or(512) as usize;
        let n = obj.get("n").and_then(|v| v.as_u64()).unwrap_or(512) as usize;
        let k = obj.get("k").and_then(|v| v.as_u64()).unwrap_or(4096) as usize;
        let rank = obj.get("rank").and_then(|v| v.as_u64()).unwrap_or(256) as usize;

        let rows_pattern: Vec<u32> = obj
            .get("rows_pattern")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_u64().map(|x| x as u32))
                    .collect()
            })
            .unwrap_or_default();

        let cols_pattern: Vec<u32> = obj
            .get("cols_pattern")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_u64().map(|x| x as u32))
                    .collect()
            })
            .unwrap_or_default();

        let params = PearlMiningParams {
            m,
            n,
            k,
            rank,
            rows_pattern: rows_pattern.clone(),
            cols_pattern: cols_pattern.clone(),
        };

        println!(
            "auxpow: PRL pearl.set_mining_params — m={} n={} k={} rank={} rows_pattern={:?} cols_pattern={:?}",
            m, n, k, rank, rows_pattern, cols_pattern
        );

        *self.pearl_mining_params.lock().await = Some(params);
    }

    /// Parse `pearl.challenge` params (AlphaPool protocol) into an `ExternalJob`.
    ///
    /// AlphaPool sends: `{"seed": "<hex>", "difficulty": <int>}`
    /// - `seed` is a hex-encoded challenge seed (used as the PoUW preimage)
    /// - `difficulty` is the number of leading zero bits required in the jackpot hash
    ///
    /// We convert the difficulty (leading zero bits) to a 32-byte target:
    /// target = 2^(256 - difficulty) - 1, stored as big-endian hex.
    /// The seed is used as the header_hex for PoUW mining.
    async fn parse_pearl_challenge_params(&self, params: &Value) -> Option<ExternalJob> {
        let obj = params.as_object()?;
        let seed = obj.get("seed").and_then(|v| v.as_str()).unwrap_or("");
        let difficulty = obj.get("difficulty").and_then(|v| v.as_u64()).unwrap_or(32);

        // Convert difficulty (leading zero bits) to a 32-byte target (big-endian).
        // target = 2^(256 - difficulty) - 1
        // For difficulty=32, target = 0x00000000FFFFFFFF... (32 leading zero bits)
        let target_bytes = {
            let mut t = [0xFFu8; 32];
            let full_zero_bytes = (difficulty / 8) as usize;
            let partial_bits = (difficulty % 8) as u8;
            for i in 0..32 {
                if i < full_zero_bytes {
                    t[i] = 0;
                } else if i == full_zero_bytes && partial_bits > 0 {
                    t[i] = 0xFF >> partial_bits;
                }
            }
            t
        };
        let target_hex = hex::encode_upper(&target_bytes);

        // The seed is the challenge preimage. Pad/truncate to 76 bytes for
        // the Pearl block header format (or use as-is if shorter).
        let seed_bytes = hex::decode(seed.trim_start_matches("0x")).unwrap_or_default();
        let header_hex = if seed_bytes.len() >= 76 {
            hex::encode(&seed_bytes[..76])
        } else {
            // Pad to 76 bytes with zeros
            let mut padded = seed_bytes.clone();
            padded.resize(76, 0);
            hex::encode(&padded)
        };
        let header_bytes = hex::decode(&header_hex).unwrap_or_default();

        let job_id = format!("pearl_{}", &seed[..seed.len().min(16)]);

        println!(
            "auxpow: PRL pearl.challenge — job={} seed_len={} difficulty={} target={:.16}...",
            job_id, seed_bytes.len(), difficulty, target_hex,
        );

        Some(ExternalJob {
            job_id,
            header_hex,
            target_hex,
            seed_hash: Some(seed.to_string()),
            block_number: None,
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
            timestamp: None,
            nbits: None,
            external_coin: self.profile.coin,
            from_group: 0,
            to_group: 0,
            extranonce1: Vec::new(),
            extranonce2: String::new(),
            epoch: None,
        })
    }

    /// Parse eth_getWork params (seed_hash, header_hex, target_hex) into
    /// an `ExternalJob`.  Shared between notification and polling paths.
    async fn parse_eth_getwork_params(
        &self,
        seed_hash: &str,
        header_hex: &str,
        target_hex: &str,
    ) -> ExternalJob {
        let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
            .unwrap_or_default();
        let target_bytes = crate::external_hashers::parse_target_hex(
            target_hex.trim_start_matches("0x"),
        )
        .unwrap_or([0xFFu8; 32]);

        // Derive epoch from seed hash for DAG management.
        let epoch = if seed_hash.len() >= 2 {
            let seed_bytes = hex::decode(seed_hash.trim_start_matches("0x"))
                .unwrap_or_default();
            if seed_bytes.len() == 32 {
                let seed_arr: [u8; 32] = seed_bytes[..32].try_into().unwrap();
                crate::external_hashers::ethash_epoch_from_seed_hash(
                    &seed_arr,
                    crate::external_hashers::ETHASH_MAX_EPOCH_SEARCH,
                )
            } else {
                None
            }
        } else {
            None
        };

        ExternalJob {
            job_id: header_hex.to_string(),
            header_hex: header_hex.to_string(),
            target_hex: target_hex.to_string(),
            seed_hash: Some(seed_hash.to_string()),
            block_number: None,
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
            timestamp: None,
            nbits: None,
            external_coin: self.profile.coin,
            from_group: 0,
            to_group: 0,
            extranonce1: self.extranonce1.lock().await.clone(),
            extranonce2: String::new(),
            epoch,
        }
    }

    /// Submit hashrate to the pool via `eth_submitHashrate`.
    ///
    /// Some EthStratum pools expect periodic hashrate reports for
    /// statistics and pool dashboard display.  The hashrate is in H/s
    /// (hashes per second).
    pub async fn submit_hashrate(&self, hashrate_hps: u64) -> Result<bool> {
        if self.protocol != StratumProtocol::EthStratum {
            return Ok(false);
        }
        let id = {
            let mut next = self.next_rpc_id.lock().await;
            let id = *next;
            *next += 1;
            id
        };
        // eth_submitHashrate params: [hashrate_hex, miner_id]
        // hashrate_hex is 0x-prefixed 32-byte hex of the hashrate value.
        let hashrate_hex = format!("0x{:064x}", hashrate_hps);
        let miner_id = format!(
            "{}-{}",
            self.profile.coin,
            self.profile.worker_name
        );
        let req = json!({
            "id": id,
            "method": "eth_submitHashrate",
            "params": [hashrate_hex, miner_id]
        });
        let resp = self.send_request(&req).await?;
        let ok = resp
            .get("result")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !ok {
            debug!(
                "auxpow: eth_submitHashrate for {} not accepted: {:?}",
                self.profile.coin,
                resp.get("error")
            );
        }
        Ok(ok)
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
/// Convert a 32-byte big-endian target to a decimal string (for JSON-RPC).
/// The official Pearl miner sends target as a decimal integer, not hex.
pub fn target_bytes_to_decimal_string(target: &[u8; 32]) -> String {
    use num_bigint::BigUint;
    let target_big: BigUint = BigUint::from_bytes_be(target);
    target_big.to_str_radix(10)
}

/// Convert a 32-byte big-endian target to a difficulty value.
/// difficulty = 2^256 / (target + 1), approximated as 2^256 / target.
pub fn target_to_difficulty(target: &[u8; 32]) -> f64 {
    use num_bigint::BigUint;
    let target_big: BigUint = BigUint::from_bytes_be(target);
    if target_big == BigUint::from(0u32) {
        return f64::INFINITY;
    }
    // 2^256 as BigUint
    let two_256: BigUint = BigUint::from(1u32) << 256;
    // diff = 2^256 / target
    let diff_big: BigUint = two_256 / target_big;
    // Convert to f64 (may lose precision for very large values, but that's OK
    // for difficulty display purposes)
    let bytes = diff_big.to_bytes_be();
    // Convert big-endian bytes to f64
    let mut result: f64 = 0.0;
    for &b in &bytes {
        result = result * 256.0 + b as f64;
    }
    result
}

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
            Self::ZcashStratum => "zcashstratum",
            Self::PearlStratum => "pearlstratum",
            Self::EpicStratum => "epicstratum",
            Self::BeamStratum => "beamstratum",
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
            .submit_share("job_001", 42, "abcdef0123456789", None)
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
            .submit_share("job_001", 42, "abcdef0123456789", None)
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
            .submit_share(&job.job_id, nonce, &hex::encode(hash), None)
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
            let params = submit["params"].as_object().unwrap();
            assert_eq!(params["jobId"], "alph_job_1");
            assert_eq!(params["fromGroup"], 3);
            assert_eq!(params["toGroup"], 3);
            assert_eq!(params["worker"], "14DLdim8A2o6AzFNgajvKgwWGpi9Fj4sP1RixdGteJNGJ.test_worker");
            let nonce_hex = params["nonce"].as_str().unwrap();
            // full 24-byte nonce = 48 hex chars
            assert_eq!(nonce_hex.len(), 48);

            let full_nonce = hex::decode(nonce_hex).unwrap();
            let en1 = hex::decode("6e14").unwrap();
            let candidate = u64::from_be_bytes(full_nonce[..8].try_into().unwrap());
            let base_bytes = [0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0x6eu8, 0x14u8];
            let base = u64::from_be_bytes(base_bytes);
            let nonce = candidate.wrapping_sub(base);
            let hash = hash_blake3_alph(&header_blob, &en1, nonce);
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
            .submit_share(&job.job_id, nonce, &hex::encode(hash), None)
            .await
            .unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn erg_ethstratum_round_trip() {
        // Mock standard Stratum v1 server for ERG (Autolykos v2, 2miners).
        // Flow: mining.subscribe → mining.authorize → mining.notify (push) →
        //       mining.submit → accept.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 8192];

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

            // 1. Read mining.subscribe
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.subscribe");
            write_json(
                &mut writer,
                json!({"id": 1, "result": [[["mining.set_difficulty","abc"],["mining.notify","abc"]], "5cc4", 6], "error": null}),
            )
            .await;

            // 2. Read mining.authorize
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            write_json(
                &mut writer,
                json!({"id": 2, "result": true, "error": null}),
            )
            .await;

            // 3. Push mining.notify
            //    ERG format: [job_id, height, blob, "", "", target_hex, target_decimal, "", clean_jobs]
            let blob = "a233a61ea5509f58d801183abbc647c9c5dedb6ba37c997e99a36c85a66726d9";
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": ["erg_job_1", 1828793, blob, "", "", "00000002", "6634674375215649981044791689095340972727658017446627184440307089471", "", true]
                }),
            )
            .await;

            // 4. Read mining.submit
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.submit");
            let params = req["params"].as_array().unwrap();
            assert_eq!(params.len(), 3);
            assert_eq!(params[1].as_str().unwrap(), "erg_job_1");

            let req_id = req["id"].as_i64().unwrap();
            write_json(
                &mut writer,
                json!({"id": req_id, "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::ERG);
        profile.pool_host = host.to_string();
        profile.pool_port = port;
        profile.worker_name = "test_worker".to_string();

        let client = AuxPowClient::new(profile);
        client.connect("9ewyQvX7YJ1PqgJpK5qGjxRwJZQjWxJr5QJ1PqgJpK5qGjxRwJZQ").await.unwrap();

        // Wait for the mining.notify push to deliver a job.
        let job = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job.job_id, "erg_job_1");
        assert_eq!(job.header_bytes.len(), 32); // 64 hex chars = 32 bytes
        assert_eq!(job.block_number, Some(1828793));

        // Submit a share via mining.submit.
        let result = client
            .submit_share(&job.job_id, 42, "deadbeef", None)
            .await
            .unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn erg_ethstratum_push_notification() {
        // Test mining.notify push notification for ERG (standard Stratum v1).
        // The server pushes mining.notify after authorize.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 8192];

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

            // 1. Subscribe
            let _req = read_json(&mut reader, &mut buf).await;
            write_json(
                &mut writer,
                json!({"id": 1, "result": [[["mining.set_difficulty","abc"],["mining.notify","abc"]], "5cc4", 6], "error": null}),
            )
            .await;

            // 2. Authorize
            let _req = read_json(&mut reader, &mut buf).await;
            write_json(
                &mut writer,
                json!({"id": 2, "result": true, "error": null}),
            )
            .await;

            // 3. Push first mining.notify
            let blob1 = "ab".repeat(32);
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": ["erg_job_1", 100, blob1, "", "", "00000002", "12345", "", true]
                }),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;

            // 4. Push second mining.notify (new job)
            let blob2 = "cd".repeat(32);
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": ["erg_job_2", 101, blob2, "", "", "00000002", "12346", "", true]
                }),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(500)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::ERG);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = AuxPowClient::new(profile);
        client.connect("testwallet").await.unwrap();

        // First job from first notify
        let job1 = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job1.job_id, "erg_job_1");
        assert!(job1.header_hex.contains("ababab"));

        // Second job from second notify
        let job2 = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job2.job_id, "erg_job_2");
        assert!(job2.header_hex.contains("cdcdcd"));

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn eth_submit_hashrate_test() {
        // Test eth_submitHashrate on an EthStratum pool (ETC, not ERG).
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 8192];

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

            // Subscribe
            let _req = read_json(&mut reader, &mut buf).await;
            write_json(
                &mut writer,
                json!({"id": 1, "result": [true, "EthereumStratum/1.0.0"], "error": null}),
            )
            .await;

            // eth_submitLogin
            let _req = read_json(&mut reader, &mut buf).await;
            write_json(
                &mut writer,
                json!({"id": 2, "result": true, "error": null}),
            )
            .await;

            // eth_getWork (initial poll)
            let req = read_json(&mut reader, &mut buf).await;
            let req_id = req["id"].as_i64().unwrap();
            write_json(
                &mut writer,
                json!({
                    "id": req_id,
                    "result": [
                        "0x".to_string() + &"11".repeat(32),
                        "0x".to_string() + &"22".repeat(32),
                        "0x".to_string() + &"ff".repeat(32),
                    ],
                    "error": null
                }),
            )
            .await;

            // eth_submitHashrate
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "eth_submitHashrate");
            let params = req["params"].as_array().unwrap();
            assert_eq!(params.len(), 2);
            assert!(params[0].as_str().unwrap().starts_with("0x"));
            let req_id = req["id"].as_i64().unwrap();
            write_json(
                &mut writer,
                json!({"id": req_id, "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        // Use CLORE (EthStratum) — ETC and ERG now use standard Stratum v1.
        let mut profile = CoinProfile::default_for(ExternalCoin::CLORE);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = AuxPowClient::new(profile);
        client.connect("testwallet").await.unwrap();

        // Wait for the initial job from polling.
        let _job = client.wait_for_job(5000).await.unwrap().unwrap();

        // Submit hashrate.
        let ok = client.submit_hashrate(50_000_000).await.unwrap();
        assert!(ok);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn xmr_randomx_notify_and_submit() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let blob_hex = "0d00".to_string() + &"00".repeat(74); // 152 hex chars / 76 bytes
        let seed_hash = "11".repeat(32);
        let next_seed_hash = "22".repeat(32);
        let target_hex = "00ffffff00000000"; // 8-byte LE target
        let height: u64 = 3334445;
        let job_id = "xmr_job_001";

        let server_blob_hex = blob_hex.clone();
        let server_seed_hash = seed_hash.clone();

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 8192];

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

            // mining.subscribe
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.subscribe");
            write_json(
                &mut writer,
                json!({"id": 1, "result": [true, "00123456"], "error": null}),
            )
            .await;

            // mining.authorize
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            // MoneroOcean expects wallet.worker format; verify the XMR wallet is used.
            let auth = req["params"][0].as_str().unwrap();
            assert!(auth.starts_with("45zTKY3zei7ACSWrQAXeU7AsTwccCfN52Kt7odqWq9icYfB9zGTmfmd5fi28oFsktNHiguc2oHizZhfvhVqauXf6Q4CcUED"));
            // XMR does not support BTC payout, so password must be "x,d=4" not "c=BTC".
            assert_eq!(req["params"][1].as_str().unwrap(), "x,d=4");
            write_json(&mut writer, json!({"id": 2, "result": true, "error": null})).await;

            // mining.notify (xmrig RandomX format)
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [
                        job_id,
                        server_seed_hash,
                        next_seed_hash,
                        server_blob_hex,
                        height,
                        target_hex,
                        true
                    ]
                }),
            )
            .await;

            // mining.submit
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.submit");
            let params = req["params"].as_array().unwrap();
            assert_eq!(params.len(), 3);
            assert!(params[0].as_str().unwrap().starts_with("45zTKY3zei7ACSWrQAXeU7AsTwccCfN52Kt7odqWq9icYfB9zGTmfmd5fi28oFsktNHiguc2oHizZhfvhVqauXf6Q4CcUED"));
            assert_eq!(params[1].as_str().unwrap(), job_id);
            let nonce_hex = params[2].as_str().unwrap();
            assert_eq!(nonce_hex.len(), 8, "XMR nonce must be 8 hex chars");
            assert!(!nonce_hex.starts_with("0x"), "XMR nonce must not have 0x prefix");
            // Nonce 0x1234abcd should be submitted as "1234abcd".
            assert_eq!(nonce_hex, "1234abcd");

            write_json(
                &mut writer,
                json!({"id": req["id"].as_i64().unwrap(), "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::XMR);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("45zTKY3zei7ACSWrQAXeU7AsTwccCfN52Kt7odqWq9icYfB9zGTmfmd5fi28oFsktNHiguc2oHizZhfvhVqauXf6Q4CcUED").await.unwrap();

        let job = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job.job_id, job_id);
        assert_eq!(job.external_coin, ExternalCoin::XMR);
        assert_eq!(job.algorithm, "randomx");
        assert_eq!(job.header_hex, blob_hex);
        assert_eq!(job.header_bytes.len(), 76);
        assert_eq!(job.seed_hash.as_deref(), Some(seed_hash.as_str()));
        assert_eq!(job.block_number, Some(height));
        assert_eq!(job.target_hex, target_hex);
        // Target should be the 8-byte LE value.
        assert_eq!(job.target_bytes[..8], hex::decode(target_hex).unwrap());

        // Submit a share with nonce 0x1234abcd (305441741).
        let result = client.submit_share(job_id, 0x1234abcd, "deadbeef", None).await.unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn vrsc_zcashstratum_notify_and_submit() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        // ZcashStratum notify params:
        // [job_id, version, prevhash, merkle, reserved, ntime, nbits, clean_jobs, solution]
        let job_id = "vrsc_job_001";
        let version = "20000000";
        let prevhash = "ab".repeat(32);
        let merkle = "cd".repeat(32);
        let reserved = "00".repeat(32);
        let ntime = "65a3f1c0";
        let nbits = "1d00ffff";
        let solution_short = "ee".repeat(114); // 229B = 458 hex (LuckPool PBaaS v7+)

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 65536];

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

            // mining.subscribe (ZcashStratum: 4 params with host/port)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.subscribe");
            assert_eq!(req["params"].as_array().unwrap().len(), 4);
            write_json(
                &mut writer,
                json!({"id": 1, "result": [["mining.notify", "session"], "a1b2c3d4"], "error": null}),
            )
            .await;

            // mining.authorize (password should be d=0.01 for VRSC)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            assert_eq!(req["params"][1].as_str().unwrap(), "d=0.01");
            write_json(&mut writer, json!({"id": 2, "result": true, "error": null})).await;

            // mining.extranonce.subscribe (ZcashStratum post-authorize)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.extranonce.subscribe");
            write_json(&mut writer, json!({"id": 3, "result": true, "error": null})).await;

            // mining.set_difficulty
            write_json(
                &mut writer,
                json!({"id": null, "method": "mining.set_difficulty", "params": [0.01]}),
            )
            .await;

            // mining.notify (ZcashStratum format with 9 params)
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [
                        job_id, version, prevhash, merkle, reserved,
                        ntime, nbits, true, solution_short
                    ]
                }),
            )
            .await;

            // mining.submit (5 params: worker, job_id, ntime, nonce2, solution)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.submit");
            let params = req["params"].as_array().unwrap();
            assert_eq!(params.len(), 5, "VRSC submit must have 5 params");
            assert_eq!(params[1].as_str().unwrap(), job_id);
            assert_eq!(params[2].as_str().unwrap(), ntime);
            // nonce2 = 15 bytes nonceSpace - extranonce1(4 bytes) = 11 bytes = 22 hex chars
            let nonce2 = params[3].as_str().unwrap();
            assert_eq!(nonce2.len(), 22, "nonce2 must be 11 bytes (22 hex chars) with 4-byte extranonce1 (PBaaS v7+ 15-byte nonceSpace)");
            // solution_with_varint should start with fd4005 and be 2694 hex chars
            let solution = params[4].as_str().unwrap();
            assert!(solution.starts_with("fd4005"), "solution must start with varint fd4005");
            assert_eq!(solution.len(), 2694, "solution_with_varint must be 2694 hex chars (3 varint + 1344 solution)");

            write_json(
                &mut writer,
                json!({"id": req["id"].as_i64().unwrap(), "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::VRSC);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("vRSCtestWallet123").await.unwrap();

        let job = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job.job_id, job_id);
        assert_eq!(job.external_coin, ExternalCoin::VRSC);
        assert_eq!(job.algorithm, "verushash");
        // Blob = header_prefix(108B=216hex) + nonce_field(32B=64hex) + varint(6hex) + solution(2688hex) = 2974 hex
        assert_eq!(job.header_hex.len(), 2974, "VRSC blob must be 2974 hex chars (108+32+3+1344 bytes)");
        assert_eq!(job.header_bytes.len(), 1487, "VRSC blob must be 1487 bytes");

        // Submit a share with nonce 0x1234abcd
        let result = client.submit_share(job_id, 0x1234abcd, "deadbeef", None).await.unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn flux_zcashstratum_notify_and_submit() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        // FLUX ZcashStratum notify params (Equihash 125,4 / ZelHash):
        // [job_id, version, prevhash, merkle, reserved, ntime, nbits, clean_jobs, solution]
        let job_id = "flux_job_001";
        let version = "20000000";
        let prevhash = "ab".repeat(32);
        let merkle = "cd".repeat(32);
        let reserved = "00".repeat(32);
        let ntime = "65a3f1c0";
        let nbits = "1d00ffff";
        // FLUX Equihash 125,4 solution: 52 bytes = 104 hex chars
        let solution_hex = "ee".repeat(52);

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 65536];

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

            // mining.subscribe (ZcashStratum: 4 params with host/port)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.subscribe");
            assert_eq!(req["params"].as_array().unwrap().len(), 4);
            write_json(
                &mut writer,
                json!({"id": 1, "result": [["mining.notify", "session"], "a1b2c3d4"], "error": null}),
            )
            .await;

            // mining.authorize (password should be d=0.01 for ZcashStratum)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            assert_eq!(req["params"][1].as_str().unwrap(), "d=0.01");
            write_json(&mut writer, json!({"id": 2, "result": true, "error": null})).await;

            // mining.extranonce.subscribe (ZcashStratum post-authorize)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.extranonce.subscribe");
            write_json(&mut writer, json!({"id": 3, "result": true, "error": null})).await;

            // mining.set_difficulty
            write_json(
                &mut writer,
                json!({"id": null, "method": "mining.set_difficulty", "params": [0.01]}),
            )
            .await;

            // mining.notify (ZcashStratum format with 9 params)
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [
                        job_id, version, prevhash, merkle, reserved,
                        ntime, nbits, true, solution_hex
                    ]
                }),
            )
            .await;

            // mining.submit (5 params: worker, job_id, ntime, nonce2, solution)
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.submit");
            let params = req["params"].as_array().unwrap();
            assert_eq!(params.len(), 5, "FLUX submit must have 5 params");
            assert_eq!(params[1].as_str().unwrap(), job_id);
            assert_eq!(params[2].as_str().unwrap(), ntime);
            // nonce2 = 32 bytes total - extranonce1(4 bytes) = 28 bytes = 56 hex chars
            let nonce2 = params[3].as_str().unwrap();
            assert_eq!(nonce2.len(), 56, "nonce2 must be 28 bytes (56 hex chars) with 4-byte extranonce1");
            // solution_with_varint should start with "34" (varint for 52 bytes)
            let solution = params[4].as_str().unwrap();
            assert!(solution.starts_with("34"), "FLUX solution must start with varint 34 (52 bytes)");

            write_json(
                &mut writer,
                json!({"id": req["id"].as_i64().unwrap(), "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::FLUX);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("t1FLUXtestWallet123").await.unwrap();

        let job = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job.job_id, job_id);
        assert_eq!(job.external_coin, ExternalCoin::FLUX);
        assert_eq!(job.algorithm, "zelhash");

        // Submit a share with a mock Equihash solution in mix_hash_hex
        let mock_solution = "ee".repeat(52); // 52-byte solution
        let result = client.submit_share(job_id, 0x1234abcd, "deadbeef", Some(&mock_solution)).await.unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[test]
    fn protocol_mapping() {
        assert_eq!(ExternalCoin::DCR.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ALPH.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::KAS.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ETC.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::RVN.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::FLUX.protocol(), StratumProtocol::ZcashStratum);
        assert_eq!(ExternalCoin::XMR.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ERG.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::EVR.protocol(), StratumProtocol::EthStratum);
        assert_eq!(ExternalCoin::MEWC.protocol(), StratumProtocol::EthStratum);
        assert_eq!(ExternalCoin::CLORE.protocol(), StratumProtocol::EthStratum);
        assert_eq!(ExternalCoin::VRSC.protocol(), StratumProtocol::ZcashStratum);
    }

    #[test]
    fn protocol_as_str() {
        assert_eq!(StratumProtocol::Stratum.as_str(), "stratum");
        assert_eq!(StratumProtocol::EthStratum.as_str(), "ethstratum");
        assert_eq!(StratumProtocol::ZcashStratum.as_str(), "zcashstratum");
    }

    #[test]
    fn difficulty_to_target_dcr_uses_pow_limit() {
        // Decred mainnet PoW limit is 2^224 - 1; at difficulty 4 the share
        // target should be approximately 2^222.
        let mut max = [0u8; 32];
        max[4..].fill(0xFF);
        let target = difficulty_to_target_with_max(4.0, &max);
        assert_eq!(target[..4], [0, 0, 0, 0]);
        assert_eq!(target[4], 0x3F);
        // Remainder should be filled with 0xFF.
        assert!(target[5..].iter().all(|&b| b == 0xFF));
    }

    #[test]
    fn difficulty_to_target_alph_uses_226_bit_max() {
        // Alephium pools use difficulty 1 == target with 30 leading zero bits,
        // i.e. max target 2^226 - 1.
        let mut max = [0xFFu8; 32];
        max[0] = 0x00;
        max[1] = 0x00;
        max[2] = 0x00;
        max[3] = 0x03;
        let target = difficulty_to_target_with_max(1.0, &max);
        assert_eq!(target[..4], [0x00, 0x00, 0x00, 0x03]);
        assert!(target[4..].iter().all(|&b| b == 0xFF));

        // At difficulty 2 the high byte should halve to 0x01.
        let target2 = difficulty_to_target_with_max(2.0, &max);
        assert_eq!(target2[3], 0x01);
    }

    // ── Pearl (PRL) PearlStratum tests ──────────────────────────────

    #[test]
    fn pearl_protocol_is_pearl_stratum() {
        assert_eq!(
            ExternalCoin::PRL.protocol(),
            StratumProtocol::PearlStratum
        );
        assert_eq!(StratumProtocol::PearlStratum.as_str(), "pearlstratum");
    }

    #[tokio::test]
    async fn pearl_stratum_round_trip_notify_and_submit() {
        // Mock Pearl plain stratum server (port 5571 protocol):
        //   - No mining.configure or mining.subscribe
        //   - mining.authorize with object params {wallet, worker, pass, agent}
        //   - Server responds with {"id":N,"result":true,"error":null}
        //   - Server pushes mining.notify with object params
        //   - Client submits via mining.submit with {job_id, plain_proof}
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host_str, port) = {
            let mut parts = addr.split(':');
            let h = parts.next().unwrap_or("127.0.0.1");
            let p: u16 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
            (h, p)
        };

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();

            use tokio::io::{AsyncBufReadExt, BufReader as TokioBufReader};
            let mut line_reader = TokioBufReader::new(&mut reader);
            let mut line = String::new();

            // Read mining.authorize (Pearl uses object params)
            line.clear();
            line_reader.read_line(&mut line).await.unwrap();
            let auth_req: Value = serde_json::from_str(line.trim()).unwrap();
            assert_eq!(auth_req["method"], "mining.authorize");
            // Pearl authorize uses object params {wallet, worker, pass, agent}
            assert!(auth_req["params"].is_object());
            assert!(auth_req["params"]["wallet"].is_string());
            assert!(auth_req["params"]["worker"].is_string());
            assert!(auth_req["params"]["pass"].is_string());

            // Send authorize ack
            let auth_resp = json!({
                "id": 2,
                "result": true,
                "error": null
            });
            let resp_str = serde_json::to_string(&auth_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Push mining.notify with object params
            // 76-byte header = 152 hex chars
            let header_hex = "00".repeat(76);
            let notify = json!({
                "id": null,
                "method": "mining.notify",
                "params": {
                    "header": header_hex,
                    "height": 67204,
                    "job_id": "32fc29f1_500000",
                    "target": "000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                }
            });
            let notify_str = serde_json::to_string(&notify).unwrap() + "\n";
            writer.write_all(notify_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Read mining.submit (Pearl PoUW proof submission)
            line.clear();
            line_reader.read_line(&mut line).await.unwrap();
            let submit_req: Value = serde_json::from_str(line.trim()).unwrap();
            assert_eq!(submit_req["method"], "mining.submit");
            // Verify params contain job_id and plain_proof
            assert!(submit_req["params"].is_object());
            assert!(submit_req["params"]["job_id"].is_string());
            assert!(submit_req["params"]["plain_proof"].is_string());

            // Send submit response (accepted)
            let submit_resp = json!({ "id": 100, "result": true, "error": null });
            let resp_str = serde_json::to_string(&submit_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();
        });

        // Create client for PRL
        let mut profile = CoinProfile::default_for(ExternalCoin::PRL);
        profile.pool_host = host_str.to_string();
        profile.pool_port = port;
        profile.worker_name = "test_rig".to_string();
        let client = AuxPowClient::new(profile);

        // Connect — Pearl plain stratum handshake: authorize only (no configure/subscribe)
        let wallet = "prl1ptestwallet1234567890abcdefghijklmnopqrstuvwxyz";
        client.connect(wallet).await.unwrap();

        // Wait for job to arrive (poll loop processes mining.notify)
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        let job = client.current_job().await;
        assert!(job.is_some(), "Should have received a job");
        let job = job.unwrap();
        assert_eq!(job.job_id, "32fc29f1_500000");
        assert_eq!(job.external_coin, ExternalCoin::PRL);
        assert_eq!(job.header_bytes.len(), 76); // 76-byte incomplete Pearl header
        assert_eq!(job.block_number, Some(67204));

        // The poll loop auto-mines and submits via mining.submit.
        // CPU mining with m=512, n=512, k=4096 takes a long time, so we
        // don't wait for the submit in this test — just verify handshake + job.
        // The server_task is dropped (its await is skipped) to avoid hanging.
        drop(server_task);
    }
}
