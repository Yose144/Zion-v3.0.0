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
    /// Cryptonote Stratum — JSON-RPC 2.0 for cryptonote-nodejs-pool based pools.
    ///
    /// Used by DNX (DynexSolve) pools like deepminerz.com, neuropool.net, etc.
    /// Protocol:
    ///   - `login` with {login, pass, agent} → returns {id, job, status}
    ///   - Server pushes `job` notifications with {blob, job_id, target, height, seed_hash, ...}
    ///   - `submit` with {id, job_id, nonce, result} — submit share
    ///   - `keepalived` for connection maintenance
    ///   - Error codes: -1 (invalid method/address), -2 (wrong job), -3 (low diff)
    CryptonoteStratum,
    /// IronFish Stratum — custom JSON-RPC for IronFish (IRON) fishhash mining.
    ///
    /// Used by herominers, grandpool, kryptex, etc.
    /// Protocol (v2):
    ///   - `mining.subscribe` with body {version:2, agent, publicAddress, name}
    ///     → response `mining.subscribed` with body {clientId, xn}
    ///   - `mining.set_target` notification with body {target}
    ///   - `mining.notify` notification with body {miningRequestId, header}
    ///   - `mining.submit` with body {miningRequestId, randomness, graffiti}
    ///     → response `mining.submitted` with body {id, result, message?}
    ///   - No separate authorize — subscribe IS the auth
    IronFishStratum,
}

impl ExternalCoin {
    pub fn protocol(self) -> StratumProtocol {
        match self {
            // 2miners ETC and RVN use standard Stratum v1 (mining.subscribe +
            // mining.authorize + mining.notify), NOT EthStratum.
            // ETC notify: [seed_hash, header_hash, boundary, target, clean]
            // RVN notify: [job_id, seed_hash, header_hash, target, clean, height, nbits]
            Self::DCR | Self::KAS | Self::ALPH
            | Self::ETC | Self::RVN | Self::QUAI => {
                StratumProtocol::Stratum
            }
            // XMR (Monero) uses CryptoNote stratum (login/getjob/submit) on
            // MoneroOcean. Standard stratum sends a 32-byte non-blob; CryptoNote
            // stratum sends the full 76-byte RandomX blob with seed_hash.
            Self::XMR => StratumProtocol::CryptonoteStratum,
            // FLUX uses ZcashStratum (Equihash 125,4 / ZelHash) with solution
            // field in mining.notify and 5-param mining.submit.
            Self::FLUX => {
                StratumProtocol::ZcashStratum
            }
            // ERG (Autolykos v2) uses standard Stratum v1 on 2miners.
            // CLORE uses Stratum v1 on NiceHash kawpow (same as RVN/QUAI).
            // EVR/MEWC use Stratum v1 on ZPool (kawpow ports) — same as RVN/CLORE.
            // Previously used EthStratum but zpool rejects eth_submitLogin with
            // error 20 "Not supported" — standard Stratum v1 is correct.
            Self::ERG | Self::CLORE | Self::EVR | Self::MEWC => StratumProtocol::Stratum,
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
            // ZANO uses ProgPoWZ (ProgPow 0.9.2 with permuted math ops) on
            // HeroMiners / open-ethereum-pool style EthStratum pools:
            //   eth_submitLogin -> eth_getWork / eth_submitWork
            Self::ZANO => StratumProtocol::EthStratum,
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
            // New coins — all use standard Stratum v1 except ZCL (Equihash),
            // DNX (cryptonote-nodejs-pool protocol), and IRON (IronFish stratum v2).
            Self::KLS | Self::QTC | Self::VTC
            | Self::NEXA | Self::RTM => {
                StratumProtocol::Stratum
            }
            Self::DNX => StratumProtocol::CryptonoteStratum,
            Self::IRON => StratumProtocol::IronFishStratum,
            Self::ZCL => StratumProtocol::ZcashStratum,
            // CKB (Eaglesong), CFX (Octopus), PHX (NeoScrypt) — standard Stratum v1.
            Self::CKB | Self::CFX | Self::PHX => StratumProtocol::Stratum,
            // ZEC (Equihash 200,9) — Zcash stratum with solution field.
            Self::ZEC => StratumProtocol::ZcashStratum,
            // KRX (KeryxHash / pre-PoM stratum) — standard stratum v1 protocol.
            Self::KRX => StratumProtocol::Stratum,
        }
    }

    /// Lowercase string name of the stratum protocol, for pool→miner job
    /// embedding (`ext_protocol` field in wire jobs).  This is the single
    /// source of truth — the pool server and any other callers should use
    /// this instead of hand-rolling match arms that can drift out of sync.
    pub fn protocol_name(self) -> &'static str {
        match self.protocol() {
            StratumProtocol::Stratum => "stratum",
            StratumProtocol::EthStratum => "ethstratum",
            StratumProtocol::ZcashStratum => "zcashstratum",
            StratumProtocol::PearlStratum => "pearlstratum",
            StratumProtocol::EpicStratum => "epicstratum",
            StratumProtocol::BeamStratum => "beamstratum",
            StratumProtocol::CryptonoteStratum => "cryptonotestratum",
            StratumProtocol::IronFishStratum => "ironfishstratum",
        }
    }

    /// Epoch length for DAG-based coins.
    /// Ethash/ETC: 30000 blocks per epoch.
    /// KawPow/RVN: 7500 blocks per epoch.
    /// ProgPow/EPIC: 30000 blocks per epoch (same as Ethash).
    /// EVR/MEWC: 12000 blocks per epoch (EvrProgPow/MeowPow).
    /// Pearl/PRL: no DAG (PEARL_EPOCH_LENGTH = 0).
    pub fn epoch_length(self) -> u32 {
        match self {
            Self::RVN | Self::CLORE => crate::external_hashers::KAWPOW_EPOCH_LENGTH,
            Self::EVR | Self::MEWC => 12000,
            Self::ETC => crate::external_hashers::ETHASH_EPOCH_LENGTH,
            Self::EPIC | Self::ZANO => crate::external_hashers::PROGPOW_EPOCH_LENGTH,
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
    /// Raw 32-byte target from `mining.set_target`, if the pool sent one.
    /// Used verbatim for ZcashStratum/Equihash-style coins so the miner
    /// searches against exactly the target the upstream validates with.
    current_target_bytes: Arc<Mutex<Option<[u8; 32]>>>,
    /// Wallet used during authorize; needed for some submit formats.
    payout_wallet: Arc<Mutex<String>>,
    /// Extra nonce 1 provided by the pool (Alephium uses 4 bytes).
    extranonce1: Arc<Mutex<Vec<u8>>>,
    /// Extra nonce 2 size from subscribe (default 4 bytes for standard Stratum v1).
    extranonce2_size: Arc<Mutex<Option<u32>>>,
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
    /// ZcashStratum (VRSC): per-job extranonce1 used to build the header.
    /// xnsub can change extranonce1 mid-session, so shares for an old job
    /// must be submitted with the extranonce1 that was active when the job
    /// was issued.
    job_extranonce1: Arc<Mutex<HashMap<String, Vec<u8>>>>,
    /// ZcashStratum (VRSC): latest job_id from upstream (for stale share detection).
    latest_job_id: Arc<Mutex<Option<String>>>,
    /// ZcashStratum (VRSC): per-job receive timestamp (Instant) for age-based
    /// stale detection.  LuckPool expires jobs ~30s after issuance; if a share
    /// arrives for a job older than the threshold, we skip forwarding to avoid
    /// "job not found" rejections (error 21).
    job_received_at: Arc<Mutex<HashMap<String, std::time::Instant>>>,
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
    /// CryptonoteStratum (DNX): session ID from login response.
    /// Used for submit and keepalived requests.
    cryptonote_session_id: Arc<Mutex<Option<String>>>,
    /// Server-side submitted nonce dedup: tracks (job_id, nonce) pairs
    /// already forwarded to the upstream pool.  ProgPoW/ethash coins
    /// (ZANO, ETC, RVN) use a 32-bit nonce — at 4 MH/s the entire 2^32
    /// nonce space is scanned in ~18 min, after which the GPU wraps
    /// around and re-finds nonces already submitted.  Without this dedup,
    /// the upstream pool (HeroMiners) rejects the re-submission as
    /// "Duplicate share".  Capped at 8192 entries with FIFO eviction.
    submitted_nonces: Arc<Mutex<std::collections::VecDeque<(String, u64)>>>,
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
            job_received_at: Arc::new(Mutex::new(HashMap::new())),
            #[cfg(feature = "gpu-metal")]
            gpu_backend: Arc::new(Mutex::new(None)),
            #[cfg(feature = "gpu-opencl")]
            gpu_opencl_backend: Arc::new(Mutex::new(None)),
            pearl_mining_params: Arc::new(Mutex::new(None)),
            cryptonote_session_id: Arc::new(Mutex::new(None)),
            submitted_nonces: Arc::new(Mutex::new(std::collections::VecDeque::new())),
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

        // For CryptonoteStratum (DNX/XMR), perform login BEFORE spawning the poll loop.
        if self.protocol == StratumProtocol::CryptonoteStratum {
            self.cryptonote_login(payout_wallet).await?;
            // MoneroOcean / xmrig-compatible pools explicitly disable keepalive
            // (`"keepalive": false`) and close the connection when keepalived is
            // sent. Send keepalived only for coins/pools that expect it (DNX).
            if self.profile.coin != ExternalCoin::XMR {
                self.start_cryptonote_keepalived().await;
            }
        }

        // For IronFishStratum (IRON), perform subscribe BEFORE spawning the poll loop.
        // IronFish subscribe IS the auth — no separate authorize step.
        if self.protocol == StratumProtocol::IronFishStratum {
            self.ironfish_subscribe(payout_wallet).await?;
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
                                let err_str = format!("{}", re_err);
                                // Detect MoneroOcean IP suspension and jump
                                // backoff to 660s (11 min) so the 10-min
                                // suspension timer can expire without being
                                // reset by another reconnect attempt.
                                if err_str.contains("temporarily suspended") {
                                    backoff_secs = 660;
                                } else {
                                    backoff_secs = (backoff_secs * 2).min(600);
                                }
                                println!(
                                    "auxpow_client: reconnect to {} failed: {} — retry in {}s",
                                    profile_clone.coin, re_err, backoff_secs
                                );
                                // Clean up stale reader/stream so poll_messages
                                // doesn't hang on a dead connection.
                                *client_clone.reader.lock().await = None;
                                *client_clone.stream.lock().await = None;
                                *client_clone.connected.lock().await = false;
                            }
                        }
                    }
                }
            }
        });

        // Subscribe + Authorize (non-EPIC/Beam/Cryptonote protocols — already handled above)
        if self.protocol != StratumProtocol::EpicStratum
            && self.protocol != StratumProtocol::BeamStratum
            && self.protocol != StratumProtocol::CryptonoteStratum
        {
            if self.protocol == StratumProtocol::PearlStratum {
                // Pearl plain stratum (port 5571): NO mining.subscribe or
                // mining.configure — go straight to mining.authorize with
                // object params.  The pool responds with an ack and pushes
                // mining.notify immediately.
                // See https://prl.suprnova.cc/stratum-spec.html §4.1
            } else if self.protocol != StratumProtocol::EthStratum {
                // EthStratum / ETH-proxy pools (HeroMiners Zano) do not use
                // mining.subscribe — login is also the subscription.
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
        } else if self.protocol == StratumProtocol::CryptonoteStratum {
            self.cryptonote_login(payout_wallet).await?;
        } else if self.protocol == StratumProtocol::IronFishStratum {
            self.ironfish_subscribe(payout_wallet).await?;
        } else {
            // PearlStratum: straight to mining.authorize (no subscribe/configure).
            // EthStratum / ETH-proxy pools (HeroMiners Zano) do not use
            // mining.subscribe — login is also the subscription.
            // See https://prl.suprnova.cc/stratum-spec.html §4.1
            if self.protocol != StratumProtocol::PearlStratum
                && self.protocol != StratumProtocol::EthStratum
            {
                self.subscribe_inline().await?;
            }
            self.authorize_inline(payout_wallet).await?;
        }
        // ── Clear per-job state on reconnect ──────────────────────────────
        // After reconnect, the upstream pool has a NEW session.  Old job_ids
        // are invalid — LuckPool will reject them with "Job not found".
        // Clearing these HashMaps ensures that shares for old job_ids are
        // pre-rejected by the job_solution lookup check in submit_share(),
        // rather than being forwarded upstream and wasting a round-trip.
        // This is critical for ZcashStratum (VRSC) where the pool issues a
        // client.reconnect every ~5-10 minutes.
        {
            self.job_solution.lock().await.clear();
            self.job_ntime.lock().await.clear();
            self.job_header_prefix.lock().await.clear();
            self.job_extranonce1.lock().await.clear();
            self.job_received_at.lock().await.clear();
            *self.latest_job_id.lock().await = None;
            // Cancel any pending share submission requests — the old
            // connection is gone and their responses will never arrive.
            // Without this, send_request waits the full 60s timeout.
            let cancelled = self.pending_requests.lock().await.drain().count();
            if cancelled > 0 {
                warn!("AuxPow: cancelled {} pending request(s) after reconnect for {}", cancelled, self.profile.coin);
            }
            warn!("AuxPow: cleared per-job state after reconnect for {}", self.profile.coin);
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
        let req_id_i64 = req.get("id").and_then(|v| v.as_i64());
        let req_id_str = req.get("id").and_then(|v| v.as_str());
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
            // Debug: log raw response for BEAM while validating BeamStratum
            if self.protocol == StratumProtocol::BeamStratum {
                println!("auxpow: BEAM raw response: {}", line_str);
            }
            // Check if this is a response (has "id" matching) or a notification.
            // EPIC pool sends ids as strings ("0", "1", etc.), Beam uses the
            // non-numeric string "login", so we match by normalized integer id
            // *or* exact string id. Messages with a "method" field are
            // notifications or EPIC method-tagged responses (handled below).
            let resp_id_i64 = parsed.get("id").and_then(|v| {
                v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
            });
            let resp_id_str = parsed.get("id").and_then(|v| v.as_str());
            if let Some(id) = resp_id_i64 {
                if req_id_i64 == Some(id) {
                    return Ok(parsed);
                }
            }
            if let (Some(r), Some(s)) = (req_id_str, resp_id_str) {
                if r == s {
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
                            let max_target = algorithm_max_target(&self.profile.algorithm);
                            let diff = target_to_difficulty_with_max(&target_bytes, &max_target);
                            println!(
                                "auxpow: {} set_target={} difficulty={:.2} parsed_bytes={}",
                                self.profile.coin, target_hex, diff, hex::encode(target_bytes)
                            );
                            *self.current_target_bytes.lock().await = Some(target_bytes);
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
        // BeamStratum (2miners) returns errors inline as code/description
        // instead of a standard JSON-RPC "error" object:
        //   {"id":"login","jsonrpc":"2.0","method":"result",
        //    "code":-32003,"description":"Invalid address",...}
        if let Some(code) = resp.get("code").and_then(|v| v.as_i64()) {
            if code < 0 {
                let desc = resp.get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error");
                bail!("BEAM login failed: code={} desc={}", code, desc);
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

    /// Cryptonote login — used by DNX (DynexSolve) pools based on
    /// cryptonote-nodejs-pool (deepminerz.com, neuropool.net, etc.).
    ///
    /// Sends `{"jsonrpc":"2.0","id":1,"method":"login","params":{"login","pass","agent"}}`
    /// The login response includes a session `id` and an initial `job`.
    async fn cryptonote_login(&self, payout_wallet: &str) -> Result<()> {
        let login = format!("{}.{}", payout_wallet, self.profile.worker_name);
        let password = if !self.profile.password.is_empty() {
            self.profile.password.as_str()
        } else {
            "x"
        };
        let req = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "login",
            "params": {
                "login": login,
                "pass": password,
                "agent": "zion-auxpow/0.1",
            }
        });
        println!(
            "auxpow: cryptonote login as {} on {} (protocol={})",
            login, self.profile.coin, self.protocol.as_str()
        );
        let resp = self.send_request_inline(&req).await?;
        if let Some(err) = resp.get("error") {
            if !err.is_null() {
                bail!("cryptonote login failed for {}: {:?}", self.profile.coin, err);
            }
        }

        // Extract session ID from login response.
        if let Some(id) = resp.get("result").and_then(|r| r.get("id")).and_then(|v| v.as_str()) {
            *self.cryptonote_session_id.lock().await = Some(id.to_string());
        }

        *self.authorized.lock().await = true;
        *self.subscribed.lock().await = true;
        println!("auxpow: cryptonote login successful for {}", self.profile.coin);

        // Debug: log raw login response for XMR
        if self.profile.coin == ExternalCoin::XMR {
            println!("auxpow: XMR RAW login response: {}", serde_json::to_string(&resp).unwrap_or_default());
        }

        // The login response may include an initial job.
        if let Some(job_obj) = resp.get("result").and_then(|r| r.get("job")) {
            if let Ok(job) = self.parse_cryptonote_job(job_obj).await {
                *self.current_job.lock().await = Some(job);
                self.job_notify.notify_waiters();
            }
        }
        Ok(())
    }

    /// Parse a cryptonote-nodejs-pool `job` notification.
    /// Format: {"blob":"<hex>", "job_id":"<hex>", "target":"<hex>",
    ///          "height":<num>, "seed_hash":"<hex>", "algo":"dynexsolve", ...}
    async fn parse_cryptonote_job(&self, msg: &Value) -> Result<ExternalJob> {
        let job = msg.get("params").unwrap_or(msg);

        let blob_hex = job.get("blob").and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("cryptonote job: missing 'blob' field"))?;
        let header_bytes = hex::decode(blob_hex)
            .context("cryptonote job: invalid hex in 'blob'")?;

        let job_id = job.get("job_id").and_then(|v| v.as_str())
            .unwrap_or("unknown").to_string();

        // Target is a compact hex string. In Monero/CryptoNote stratum,
        // the target hex string is raw hex-encoded bytes (NOT a big-endian
        // integer).  xmrig parses it as follows:
        //   - 4-byte target (8 hex chars): hex-decode to 4 bytes, interpret
        //     as LE u32, then convert to 64-bit target via:
        //       target_64 = u64::MAX / (u32::MAX / le_u32)
        //     This preserves the difficulty ratio when expanding from 32
        //     to 64 bits.
        //   - 8-byte target (16 hex chars): hex-decode to 8 bytes, interpret
        //     as LE u64 directly.
        // The 64-bit target is then stored as 32 bytes in little-endian
        // order for hash comparison (only first 8 bytes matter).
        let target_hex = job.get("target").and_then(|v| v.as_str())
            .unwrap_or("ffffffffffffffff");
        let target_u64: u64 = if target_hex.len() <= 8 {
            // 4-byte target: hex decode to raw bytes, interpret as LE u32,
            // then expand to 64-bit target (matching xmrig's formula).
            let raw = hex::decode(target_hex).unwrap_or_else(|_| vec![0xff; 4]);
            let mut buf = [0u8; 4];
            let len = raw.len().min(4);
            buf[..len].copy_from_slice(&raw[..len]);
            let le_u32 = u32::from_le_bytes(buf);
            if le_u32 == 0 {
                u64::MAX
            } else {
                u64::MAX / (u32::MAX as u64 / le_u32 as u64)
            }
        } else if target_hex.len() <= 16 {
            // 8-byte target: hex decode to raw bytes, interpret as LE u64.
            let raw = hex::decode(target_hex).unwrap_or_else(|_| vec![0xff; 8]);
            let mut buf = [0u8; 8];
            let len = raw.len().min(8);
            buf[..len].copy_from_slice(&raw[..len]);
            u64::from_le_bytes(buf)
        } else {
            // Full 32-byte target hex — take first 8 bytes as LE u64
            let raw = hex::decode(target_hex).unwrap_or_else(|_| vec![0xff; 32]);
            let mut buf = [0u8; 8];
            let len = raw.len().min(8);
            buf[..len].copy_from_slice(&raw[..len]);
            u64::from_le_bytes(buf)
        };
        // Convert u64 target to 32-byte LE target
        let mut target_bytes = [0u8; 32];
        target_bytes[..8].copy_from_slice(&target_u64.to_le_bytes());

        let height = job.get("height").and_then(|v| v.as_u64()).unwrap_or(0);
        let seed_hash = job.get("seed_hash").and_then(|v| v.as_str()).map(|s| s.to_string());

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        println!(
            "auxpow: {} cryptonote job parsed height={} job_id={} blob_len={} seed_hash={} target={}",
            self.profile.coin, height, job_id, header_bytes.len(),
            seed_hash.as_ref().map(|s| &s[..16.min(s.len())]).unwrap_or("none"),
            &target_hex[..target_hex.len().min(16)],
        );

        Ok(ExternalJob {
            job_id,
            header_hex: blob_hex.to_string(),
            target_hex: hex::encode(&target_bytes),
            seed_hash,
            block_number: Some(height),
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
            timestamp: Some(now),
            nbits: None,
            external_coin: self.profile.coin,
            from_group: 0,
            to_group: 0,
            extranonce1: Vec::new(),
            extranonce2: String::new(),
            epoch: None,
        })
    }

    /// IronFish stratum v2 subscribe — sends mining.subscribe with body
    /// containing version, agent, publicAddress, and name.
    /// The pool responds with mining.subscribed containing clientId and xn (extranonce).
    async fn ironfish_subscribe(&self, payout_wallet: &str) -> Result<()> {
        let req = json!({
            "id": 1,
            "method": "mining.subscribe",
            "body": {
                "version": 2,
                "agent": "rigel/1.4.2",
                "publicAddress": payout_wallet,
                "name": self.profile.worker_name,
            }
        });
        println!(
            "auxpow: IRON IronFish subscribe as {} on {} (protocol={})",
            payout_wallet, self.profile.coin, self.protocol.as_str()
        );
        let resp = self.send_request_inline(&req).await?;
        if let Some(err) = resp.get("error") {
            if !err.is_null() {
                bail!("IRON subscribe failed: {:?}", err);
            }
        }

        // Extract extranonce (xn) from mining.subscribed response.
        // The response method is "mining.subscribed" with body {clientId, xn}.
        if let Some(body) = resp.get("body").or_else(|| resp.get("result")) {
            if let Some(xn) = body.get("xn").and_then(|v| v.as_str()) {
                let xn_bytes = hex::decode(xn).unwrap_or_default();
                *self.extranonce1.lock().await = xn_bytes;
                println!("auxpow: IRON subscribed, xn={}", xn);
            }
            if let Some(client_id) = body.get("clientId") {
                println!("auxpow: IRON clientId={}", client_id);
            }
        }

        *self.authorized.lock().await = true;
        *self.subscribed.lock().await = true;
        println!("auxpow: IRON IronFish subscribe successful for {}", self.profile.coin);
        Ok(())
    }

    /// Parse an IronFish mining.notify body into an ExternalJob.
    /// Format: {"miningRequestId": <num>, "header": "<hex>"}
    async fn parse_ironfish_job(&self, body: &Value) -> Result<ExternalJob> {
        let header_hex = body.get("header").and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("IRON job: missing 'header' field"))?;
        let header_bytes = hex::decode(header_hex)
            .context("IRON job: invalid hex in 'header'")?;

        let mining_request_id = body.get("miningRequestId")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        // Target may come from a separate mining.set_target notification,
        // or we use a default. The target is stored in current_job's target.
        let target_hex = body.get("target").and_then(|v| v.as_str())
            .unwrap_or("00000000ffff0000000000000000000000000000000000000000000000000000");
        let mut target_vec = hex::decode(target_hex).unwrap_or_else(|_| vec![0xff; 32]);
        target_vec.resize(32, 0);
        let mut target_bytes = [0u8; 32];
        target_bytes.copy_from_slice(&target_vec);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // job_id = miningRequestId as string (used for submit)
        let job_id = mining_request_id.to_string();

        println!(
            "auxpow: IRON job parsed miningRequestId={} header_len={} target={}",
            mining_request_id, header_bytes.len(), &target_hex[..target_hex.len().min(16)],
        );

        Ok(ExternalJob {
            job_id,
            header_hex: header_hex.to_string(),
            target_hex: hex::encode(&target_bytes),
            seed_hash: None,
            block_number: Some(mining_request_id),
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
            timestamp: Some(now),
            nbits: None,
            external_coin: self.profile.coin,
            from_group: 0,
            to_group: 0,
            extranonce1: self.extranonce1.lock().await.clone(),
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
    /// EPIC uses a pull-based protocol — the server doesn't push jobs
    /// unsolicited. We periodically send `getjobtemplate` (fire-and-forget)
    /// which triggers the server to respond with a new job, resetting the
    /// poll_messages read timeout. A bare `keepalive` does NOT generate a
    /// response, so the poll loop would time out every 5 min.
    async fn start_epic_keepalive(&self) {
        let client = Arc::new(self.clone());
        tokio::spawn(async move {
            // Use 120s interval — EPIC block time is ~60s, so this gives
            // the server time to generate a new job template without
            // rate-limiting our requests.
            let mut interval = tokio::time::interval(Duration::from_secs(120));
            interval.tick().await; // skip first immediate tick
            println!("auxpow: EPIC keepalive task started for {} (interval=120s)", client.profile.coin);
            loop {
                interval.tick().await;
                if !*client.connected.lock().await {
                    println!("auxpow: EPIC keepalive task stopping for {} (disconnected)", client.profile.coin);
                    break;
                }
                // Send getjobtemplate (fire-and-forget) — server responds
                // with a job that the poll loop picks up, resetting the
                // read timeout.
                let req = json!({
                    "jsonrpc": "2.0",
                    "id": 10,
                    "method": "getjobtemplate",
                    "params": {"algorithm": "progpow"}
                });
                let req_line = format!("{}\n", serde_json::to_string(&req).unwrap());
                let mut stream = client.stream.lock().await;
                if let Some(w) = stream.as_mut() {
                    match w.write_all(req_line.as_bytes()).await {
                        Ok(_) => {
                            let _ = w.flush().await;
                            println!("auxpow: EPIC keepalive getjobtemplate sent for {}", client.profile.coin);
                        }
                        Err(e) => {
                            println!("auxpow: EPIC keepalive write failed for {}: {} — stopping", client.profile.coin, e);
                            break;
                        }
                    }
                }
            }
        });
    }

    /// Start a background keepalived timer for CryptonoteStratum (DNX/XMR).
    /// cryptonote-nodejs-pool expects `{"method":"keepalived","params":{"id":"<session_id>"}}`.
    async fn start_cryptonote_keepalived(&self) {
        let client = Arc::new(self.clone());
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            interval.tick().await; // skip first immediate tick
            loop {
                interval.tick().await;
                if !*client.connected.lock().await {
                    break;
                }
                let sid = client.cryptonote_session_id.lock().await.clone();
                let sid = sid.unwrap_or_else(|| "unknown".to_string());
                let req = json!({
                    "jsonrpc": "2.0",
                    "id": 0,
                    "method": "keepalived",
                    "params": { "id": sid }
                });
                let req_line = format!("{}\n", serde_json::to_string(&req).unwrap());
                let mut stream = client.stream.lock().await;
                if let Some(w) = stream.as_mut() {
                    if w.write_all(req_line.as_bytes()).await.is_err() {
                        break;
                    }
                    debug!("auxpow: cryptonote keepalived sent for {}", client.profile.coin);
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
    #[allow(dead_code)]
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

        // NiceHash KHeavyHash responds to mining.subscribe with a
        // set_extranonce notification instead of a standard result:
        //   {"id":1,"method":"set_extranonce","params":["79e0",6]}
        // Treat this as a successful subscribe with extranonce1 from params.
        if resp.get("method").and_then(|v| v.as_str()) == Some("set_extranonce") {
            *self.subscribed.lock().await = true;
            if let Some(params) = resp.get("params").and_then(|v| v.as_array()) {
                if let Some(en1_hex) = params.get(0).and_then(|v| v.as_str()) {
                    *self.extranonce1.lock().await = hex::decode(en1_hex).unwrap_or_default();
                }
                if let Some(en2_size) = params.get(1).and_then(|v| v.as_u64()) {
                    *self.extranonce2_size.lock().await = Some(en2_size as u32);
                }
            }
            println!("auxpow: subscribed to {} (NiceHash set_extranonce) — extranonce1={:?}",
                self.profile.coin, self.extranonce1.try_lock().map(|v| hex::encode(&*v)).unwrap_or_default());
            return Ok(());
        }

        if let Some(result) = resp.get("result") {
            *self.subscribed.lock().await = true;
            println!("auxpow: subscribed to {} — result={}", self.profile.coin, result);

            // Alephium/Kryptex returns extranonce1 as a plain hex string.
            // Standard stratum returns [subscriptions, extranonce1, extranonce2_size].
            let mut en1 = self.extranonce1.lock().await;
            *en1 = if let Some(hex) = result.as_str() {
                hex::decode(hex).unwrap_or_default()
            } else if let Some(arr) = result.as_array() {
                // Extract extranonce2_size (3rd element, index 2)
                if let Some(en2_size) = arr.get(2).and_then(|v| v.as_u64()) {
                    *self.extranonce2_size.lock().await = Some(en2_size as u32);
                }
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
            // EPIC uses a pull-based protocol (getjobtemplate) — the server
            // only pushes job updates when a new block is found. With no
            // active EPIC miner, pushes can be very infrequent. Use a long
            // timeout (1800s = 30min) for EPIC, 300s for push-based coins.
            // The keepalive task sends getjobtemplate every 120s; if the
            // server responds, the timeout is reset.
            let timeout_secs = if self.protocol == StratumProtocol::EpicStratum {
                1800
            } else {
                300
            };
            match timeout(Duration::from_secs(timeout_secs), reader.read_line(&mut buf)).await {
                Ok(Ok(_)) => {
                    if buf.is_empty() {
                        bail!("connection closed by remote");
                    }
                    Ok(buf.trim().to_string())
                }
                Ok(Err(e)) => bail!("read error: {e}"),
                Err(_) => bail!("read timeout ({}s, no data from pool)", timeout_secs),
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

        // Debug: log all EthStratum messages to troubleshoot job expiration
        if self.protocol == StratumProtocol::EthStratum {
            let method = msg.get("method").and_then(|m| m.as_str()).unwrap_or("");
            let id = msg.get("id");
            let has_result = msg.get("result").is_some();
            let result_preview = if has_result {
                let r = msg.get("result").unwrap();
                if let Some(arr) = r.as_array() {
                    // Log first 2 elements (seed_hash, header_hash) to see if
                    // the header_hash changes between push notifications.
                    let elem0 = arr.get(0).and_then(|v| v.as_str()).unwrap_or("?");
                    let elem1 = arr.get(1).and_then(|v| v.as_str()).unwrap_or("?");
                    let elem2 = arr.get(2).and_then(|v| v.as_str()).unwrap_or("?");
                    let elem3 = arr.get(3).and_then(|v| v.as_str()).unwrap_or("?");
                    format!(
                        "array[{}] seed={:.20} header={} target={:.20} height={}",
                        arr.len(),
                        elem0, elem1, elem2, elem3
                    )
                } else {
                    format!("{}", r)
                }
            } else { "none".to_string() };
            eprintln!(
                "auxpow: ZANO poll msg method={} id={:?} result={} (len={})",
                method, id, result_preview, line.len()
            );
        }

        // Debug: log RTM (standard stratum v1) messages that have an "id"
        // (potential responses) to diagnose share submission timeouts.
        if self.profile.coin == ExternalCoin::RTM && msg.get("id").is_some() {
            let pending_count = self.pending_requests.lock().await.len();
            println!(
                "auxpow: RTM poll msg id={:?} method={:?} result={:?} error={:?} pending={} (len={})",
                msg.get("id"),
                msg.get("method"),
                msg.get("result"),
                msg.get("error"),
                pending_count,
                line.len()
            );
        }

        // If the message has an id matching a pending request, route it there.
        // EPIC pool sends ids as strings ("0", "1", "20", etc.), so we check
        // both integer and string representations (same logic as
        // send_request_inline).
        if let Some(id) = msg.get("id").and_then(|v| {
            v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
        }) {
            if let Some(tx) = self.pending_requests.lock().await.remove(&id) {
                let _ = tx.send(msg);
                return Ok(());
            }
        }

        // Otherwise treat it as a notification.
        if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
            match method {
                "mining.notify" if self.protocol != StratumProtocol::IronFishStratum => {
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
                "mining.set_target" if self.protocol != StratumProtocol::IronFishStratum => {
                    // RVN/KawPow and VRSC/LuckPool pools send mining.set_target
                    // with a 32-byte hex target string instead of mining.set_difficulty.
                    if let Some(params) = msg.get("params") {
                        if let Some(target_hex) = params.get(0).and_then(|d| d.as_str()) {
                            println!("auxpow: RAW set_target full='{}' len={}", target_hex, target_hex.len());
                            let target_bytes = crate::external_hashers::parse_target_hex(
                                target_hex.trim_start_matches("0x"),
                            ).unwrap_or([0xFFu8; 32]);
                            let max_target = algorithm_max_target(&self.profile.algorithm);
                            let diff = target_to_difficulty_with_max(&target_bytes, &max_target);
                            println!(
                                "auxpow: {} set_target parsed={} difficulty={:.2}",
                                self.profile.coin,
                                hex::encode(target_bytes),
                                diff
                            );
                            *self.current_target_bytes.lock().await = Some(target_bytes);
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
                // EthStratum notify: params = [seed_hash, header_hash, boundary, height?]
                // where all values are 0x-prefixed hex strings.
                "eth_getWork" => {
                    if let Some(params) = msg.get("params") {
                        if let Some(arr) = params.as_array() {
                            if arr.len() >= 3 {
                                let job = self
                                    .parse_eth_getwork_params(
                                        arr[0].as_str().unwrap_or(""),
                                        arr[1].as_str().unwrap_or(""),
                                        arr[2].as_str().unwrap_or(""),
                                        arr.get(3).and_then(|v| v.as_str()),
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
                "job" if self.protocol == StratumProtocol::EpicStratum => {
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
                "job" if self.protocol == StratumProtocol::CryptonoteStratum => {
                    // CryptonoteStratum (DNX/XMR): server pushes `job` notifications
                    // with blob, job_id, target, height, seed_hash.
                    let job_val = msg.get("params").unwrap_or(&msg);
                    // Debug: log raw JSON for XMR to diagnose share rejection
                    if self.profile.coin == ExternalCoin::XMR {
                        println!("auxpow: XMR RAW job notification: {}", serde_json::to_string(job_val).unwrap_or_default());
                    }
                    match self.parse_cryptonote_job(job_val).await {
                        Ok(job) => {
                            debug!(
                                "AuxPow: received cryptonote job {} height={} for {}",
                                job.job_id, job.block_number.unwrap_or(0), self.profile.coin
                            );
                            *self.current_job.lock().await = Some(job);
                            self.job_notify.notify_waiters();
                        }
                        Err(e) => {
                            warn!("AuxPow: cryptonote job parse error for {}: {}", self.profile.coin, e);
                        }
                    }
                }
                "job" if self.protocol == StratumProtocol::BeamStratum => {
                    // BeamStratum: server pushes `job` notifications with input,
                    // id, height, difficulty, nonceprefix.
                    match self.parse_beam_job(&msg).await {
                        Ok(job) => {
                            debug!(
                                "AuxPow: received BEAM job {} height={} for {}",
                                job.job_id, job.block_number.unwrap_or(0), self.profile.coin
                            );
                            *self.current_job.lock().await = Some(job);
                            self.job_notify.notify_waiters();
                        }
                        Err(e) => {
                            warn!("AuxPow: BEAM job parse error for {}: {}", self.profile.coin, e);
                        }
                    }
                }
                "cancel" if self.protocol == StratumProtocol::BeamStratum => {
                    // Beam Stratum: server cancels a job by id.
                    if let Some(id) = msg.get("id").and_then(|v| v.as_str()) {
                        println!("auxpow: BEAM job cancelled: id={}", id);
                        *self.current_job.lock().await = None;
                    }
                }
                // IronFish stratum v2: mining.notify with body {miningRequestId, header}
                "mining.notify" if self.protocol == StratumProtocol::IronFishStratum => {
                    let body = msg.get("body").unwrap_or(&msg);
                    match self.parse_ironfish_job(body).await {
                        Ok(job) => {
                            debug!(
                                "AuxPow: received IRON job {} (miningRequestId={}) for {}",
                                job.job_id, job.block_number.unwrap_or(0), self.profile.coin
                            );
                            *self.current_job.lock().await = Some(job);
                            self.job_notify.notify_waiters();
                        }
                        Err(e) => {
                            warn!("AuxPow: IRON job parse error for {}: {}", self.profile.coin, e);
                        }
                    }
                }
                // IronFish stratum v2: mining.set_target with body {target}
                "mining.set_target" if self.protocol == StratumProtocol::IronFishStratum => {
                    if let Some(body) = msg.get("body") {
                        if let Some(target_hex) = body.get("target").and_then(|v| v.as_str()) {
                            println!("auxpow: IRON set_target target={}", &target_hex[..target_hex.len().min(16)]);
                            let target_bytes = crate::external_hashers::parse_target_hex(
                                target_hex.trim_start_matches("0x"),
                            ).unwrap_or([0xFFu8; 32]);
                            let max_target = algorithm_max_target(&self.profile.algorithm);
                            let diff = target_to_difficulty_with_max(&target_bytes, &max_target);
                            *self.current_target_bytes.lock().await = Some(target_bytes);
                            *self.current_difficulty.lock().await = diff;
                        }
                    }
                }
                _ => {
                    debug!("AuxPow: unknown method '{}' from {}", method, self.profile.coin);
                }
            }
        } else if self.protocol == StratumProtocol::EthStratum {
            // open-ethereum-pool style push notifications have no "method"
            // field — they are just a top-level "result" array:
            //   [seed_hash, header_hash, target, height?]
            // NOTE: ZANO HeroMiners returns [header_hash, seed_hash, ...] — swapped.
            if let Some(result) = msg.get("result") {
                if let Some(arr) = result.as_array() {
                    if arr.len() >= 3 {
                        let (seed_idx, header_idx) = if self.profile.coin == ExternalCoin::ZANO {
                            (1, 0) // ZANO: [header_hash, seed_hash, ...] — swapped
                        } else {
                            (0, 1) // Standard: [seed_hash, header_hash, ...]
                        };
                        let job = self
                            .parse_eth_getwork_params(
                                arr[seed_idx].as_str().unwrap_or(""),
                                arr[header_idx].as_str().unwrap_or(""),
                                arr[2].as_str().unwrap_or(""),
                                arr.get(3).and_then(|v| v.as_str()),
                            )
                            .await;
                        *self.current_job.lock().await = Some(job);
                        self.job_notify.notify_waiters();
                    }
                }
            }
        }

        Ok(())
    }

    // ── Block header builder for Stratum v1 (RTM, VTC, etc.) ────────────
}

/// Build an 80-byte block header from Stratum v1 notify params.
///
/// Header layout (Dash/Raptoreum style, same as Bitcoin):
///   version(4 LE) + prevhash(32) + merkle_root(32) + ntime(4 LE) + nbits(4 LE) + nonce(4 LE=0)
///
/// `prevhash` from stratum is in reversed byte order (display order).
/// We reverse it back to internal byte order for the header.
///
/// Merkle root is computed as:
///   1. coinbase_tx = coinbase1 + extranonce1 + extranonce2 + coinbase2
///   2. hash0 = double_sha256(coinbase_tx)
///   3. For each branch: hash0 = double_sha256(hash0 || branch)  (left-concatenation)
fn build_stratum_v1_header(
    version_hex: &str,
    prevhash_hex: &str,
    coinbase1_hex: &str,
    coinbase2_hex: &str,
    merkle_branches: &[String],
    ntime_hex: &str,
    nbits_hex: &str,
    extranonce1_hex: &str,
    extranonce2_hex: &str,
) -> Vec<u8> {
    use sha2::{Digest, Sha256};

    // Parse hex strings to bytes
    let parse_hex = |h: &str| -> Vec<u8> {
        hex::decode(h.trim_start_matches("0x")).unwrap_or_default()
    };

    let version_bytes = parse_hex(version_hex);
    let prevhash_bytes = parse_hex(prevhash_hex);
    let coinbase1 = parse_hex(coinbase1_hex);
    let coinbase2 = parse_hex(coinbase2_hex);
    let extranonce1 = parse_hex(extranonce1_hex);
    let extranonce2 = parse_hex(extranonce2_hex);
    let ntime_bytes = parse_hex(ntime_hex);
    let nbits_bytes = parse_hex(nbits_hex);

    // Build coinbase transaction: coinbase1 + extranonce1 + extranonce2 + coinbase2
    let mut coinbase_tx = Vec::with_capacity(
        coinbase1.len() + extranonce1.len() + extranonce2.len() + coinbase2.len()
    );
    coinbase_tx.extend_from_slice(&coinbase1);
    coinbase_tx.extend_from_slice(&extranonce1);
    coinbase_tx.extend_from_slice(&extranonce2);
    coinbase_tx.extend_from_slice(&coinbase2);

    // Compute merkle root: double_sha256(coinbase_tx), then combine with branches
    let mut merkle_root = {
        let h1 = Sha256::digest(&coinbase_tx);
        let h2 = Sha256::digest(&h1);
        h2.to_vec()
    };

    // Combine with merkle branches (left concatenation: hash = sha256d(hash || branch))
    // Branches are in display (reversed) order — use as-is, matching cpuminer.
    for branch_hex in merkle_branches {
        let branch = parse_hex(branch_hex);
        let mut combined = Vec::with_capacity(merkle_root.len() + branch.len());
        combined.extend_from_slice(&merkle_root);
        combined.extend_from_slice(&branch);
        let h1 = Sha256::digest(&combined);
        let h2 = Sha256::digest(&h1);
        merkle_root = h2.to_vec();
    }

    // yiimp's build_submit_values applies ser_string_be to the merkle root
    // TWICE: once standalone (ser_string_be(merkleroot, merkleroot_be, 8))
    // and once on the whole header (ser_string_be(header, header_be, 20)).
    // Double byte-reversal within each 4-byte word cancels out, so the final
    // merkle root in header_bin is in ORIGINAL sha256d output order (BE display).
    // We must NOT reverse it — placing it as-is matches yiimp exactly.
    //
    // prevhash: yiimp sends prevhash_be (ser_string_be2 = words reversed) in
    // mining.notify, then ser_string_be on the whole header reverses bytes
    // within each word.  Final = words reversed + LE per word = standard
    // bitcoin internal prevhash format.  We reverse bytes within each word
    // of the received prevhash_be to match.
    let mut prevhash_internal = prevhash_bytes.clone();
    for chunk in prevhash_internal.chunks_exact_mut(4) {
        chunk.reverse();
    }

    // Build 80-byte header
    let mut header = Vec::with_capacity(80);

    // version (4 bytes) — pool sends BE hex string like "20000000".
    // cpuminer parses as uint32_t (0x20000000) and stores as LE bytes.
    // We must reverse the hex bytes to get LE order.
    let mut ver = [0u8; 4];
    let vlen = version_bytes.len().min(4);
    ver[..vlen].copy_from_slice(&version_bytes[..vlen]);
    ver.reverse();
    header.extend_from_slice(&ver);

    // prevhash (32 bytes) — internal byte order (already reversed above)
    let mut prev = [0u8; 32];
    let plen = prevhash_internal.len().min(32);
    prev[..plen].copy_from_slice(&prevhash_internal[..plen]);
    header.extend_from_slice(&prev);

    // merkle_root (32 bytes) — original sha256d output (BE display order).
    // yiimp's double ser_string_be cancels out, so no reversal needed.
    let mut mr = [0u8; 32];
    let mlen = merkle_root.len().min(32);
    mr[..mlen].copy_from_slice(&merkle_root[..mlen]);
    header.extend_from_slice(&mr);

    // ntime (4 bytes) — pool sends BE hex, cpuminer stores as LE uint32
    let mut nt = [0u8; 4];
    let tlen = ntime_bytes.len().min(4);
    nt[..tlen].copy_from_slice(&ntime_bytes[..tlen]);
    nt.reverse();
    header.extend_from_slice(&nt);

    // nbits (4 bytes) — pool sends BE hex, cpuminer stores as LE uint32
    let mut nb = [0u8; 4];
    let blen = nbits_bytes.len().min(4);
    nb[..blen].copy_from_slice(&nbits_bytes[..blen]);
    nb.reverse();
    header.extend_from_slice(&nb);

    // nonce (4 bytes = 0, miner will fill)
    header.extend_from_slice(&[0u8; 4]);

    // Ensure exactly 80 bytes
    if header.len() < 80 {
        header.resize(80, 0);
    }
    header.truncate(80);
    header
}

impl AuxPowClient {
    /// Parse `mining.notify` params into an `ExternalJob`.
    ///
    /// Supports two Stratum v1 variants:
    ///   - Standard Bitcoin-like: [job_id, prevhash, coinbase1, coinbase2,
    ///     branches, version, nbits, ntime, clean_jobs]
    ///   - Simplified: [job_id, header_hex, target_hex]
    async fn parse_notify_params(&self, params: &Value, notify_height: Option<u64>) -> Result<ExternalJob> {
        // Debug: log raw notify params for KAS to diagnose timestamp issues.
        if self.profile.coin == ExternalCoin::KAS {
            println!(
                "auxpow: KAS raw notify params: {}",
                serde_json::to_string(params).unwrap_or_default()
            );
        }
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
        // This format is used by RVN, CLORE, EVR, MEWC, and QUAI on 2miners.
        if let Some(arr) = params.as_array() {
            if arr.len() >= 6
                && matches!(
                    self.profile.coin,
                    ExternalCoin::RVN | ExternalCoin::CLORE | ExternalCoin::EVR
                        | ExternalCoin::MEWC | ExternalCoin::QUAI
                )
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
                    "auxpow: KawPow notify — coin={} job={} seed={}.. header={}.. epoch={:?} height={:?}",
                    self.profile.coin.ticker(),
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

        // ProgPoWZ / Zano (HeroMiners) Stratum v1:
        // mining.notify params = [job_id, header_hash, seed_hash, target, clean_jobs, height?, ...]
        //   - job_id: short string
        //   - header_hash: 32-byte hex (the pre-hashed block header, no 0x prefix)
        //   - seed_hash: 32-byte hex (DAG seed, used for epoch derivation)
        //   - target: 32-byte hex (share boundary, big-endian)
        //   - height: optional block number (integer or 0x-prefixed hex) for epoch/period.
        if self.profile.coin == ExternalCoin::ZANO {
            if let Some(arr) = params.as_array() {
                if arr.len() >= 4
                    && arr[1].as_str().map(|s| s.trim_start_matches("0x").len() == 64).unwrap_or(false)
                    && arr[2].as_str().map(|s| s.trim_start_matches("0x").len() == 64).unwrap_or(false)
                    && arr[3].as_str().map(|s| s.trim_start_matches("0x").len() == 64).unwrap_or(false)
                {
                    let job_id = arr[0].as_str().unwrap_or("unknown").to_string();
                    let header_hex = arr[1].as_str().unwrap_or("").to_string();
                    let seed_hash = arr[2].as_str().unwrap_or("").to_string();
                    let target_hex = arr[3].as_str().unwrap_or("ffffffff").to_string();

                    let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
                        .unwrap_or_default();
                    let target_bytes = crate::external_hashers::parse_target_hex(
                        target_hex.trim_start_matches("0x"),
                    )
                    .unwrap_or([0xFFu8; 32]);

                    // Try to extract block height from the first integer/hex field after target.
                    let height = arr.get(4)
                        .and_then(|v| v.as_u64())
                        .or_else(|| {
                            arr.get(4).and_then(|v| v.as_str()).and_then(|s| {
                                if s.starts_with("0x") {
                                    u64::from_str_radix(s.trim_start_matches("0x"), 16).ok()
                                } else {
                                    s.parse().ok()
                                }
                            })
                        })
                        .or(notify_height);

                    let epoch = height.map(|h| (h / self.profile.coin.epoch_length() as u64) as u32);

                    println!(
                        "auxpow: ZANO notify — job={} header={}.. seed={}.. target={}.. height={:?} epoch={:?}",
                        job_id,
                        &header_hex[..16.min(header_hex.len())],
                        &seed_hash[..16.min(seed_hash.len())],
                        &target_hex[..16.min(target_hex.len())],
                        height,
                        epoch,
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
                    // Some VRSC/LuckPool stratum servers send the daemon's fixed
                    // block-header nonce as an extra param (index 9).  PBaaS v7+
                    // ignores the miner's nonce field and uses this daemon nonce,
                    // so we must hash with the same value the pool validates with.
                    let daemon_nonce_hex = as_s(9);

                    if !job_id.is_empty() {
                        *self.latest_job_id.lock().await = Some(job_id.clone());
                        self.job_received_at.lock().await.insert(job_id.clone(), std::time::Instant::now());
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
                        let mut en1m = self.job_extranonce1.lock().await;
                        let mut jra = self.job_received_at.lock().await;
                        if sol.len() > 64 {
                            let mut keys: Vec<String> = sol.keys().cloned().collect();
                            keys.sort();
                            let remove_count = keys.len() - 64;
                            for k in &keys[..remove_count] {
                                sol.remove(k);
                                nt.remove(k);
                                hp.remove(k);
                                en1m.remove(k);
                                jra.remove(k);
                            }
                        }
                    }

                    // Snapshot the extranonce1 active for this job so the miner
                    // hashes with the same value the submit path will later use.
                    let job_en1 = self.extranonce1.lock().await.clone();

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
                        self.job_extranonce1.lock().await.insert(job_id.clone(), job_en1.clone());
                    }

                    // Build the hashing blob:
                    // VerusCoin block header = version(4) + prevhash(32) + merkle(32)
                    //   + reserved(32) + ntime(4) + nbits(4) + nonce(32) + varint(3)
                    //   + solution(1344) = 1487 bytes total.
                    // The nonce field (32 bytes at offset 108) is fixed by the daemon
                    // for PBaaS v7+; the miner does NOT modify it.  The miner's unique
                    // work is in the solution nonceSpace (last 15 bytes).
                    let blob = if self.profile.algorithm.eq_ignore_ascii_case("verushash") {
                        let en1 = hex::encode(&job_en1);
                        // PBaaS v7+: use the daemon's nonce if the pool supplied it;
                        // otherwise fall back to extranonce1 + zeros so the header
                        // layout is still well-formed.
                        let nonce_field = if daemon_nonce_hex.len() == 64 {
                            daemon_nonce_hex.clone()
                        } else {
                            format!("{:0<64}", en1)
                        };
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
                    // Use the raw target from mining.set_target if available; fall back
                    // to deriving it from current_difficulty. This avoids precision
                    // loss when the pool sends an exact 32-byte boundary target.
                    let target_bytes = if let Some(raw) = *self.current_target_bytes.lock().await {
                        raw
                    } else {
                        self.share_target().await
                    };
                    let target_hex = hex::encode(target_bytes);

                    // Parse ntime as u64 for the timestamp field.
                    let timestamp = u64::from_str_radix(&ntime, 16).ok();

                    println!(
                        "auxpow: {} notify — job={} blob_len={} sol_len={} ntime={} clean={} target={}",
                        self.profile.coin,
                        job_id,
                        header_bytes.len(),
                        effective_solution.len() / 2,
                        ntime,
                        clean_jobs,
                        target_hex,
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

        // Standard Stratum v1 (zpool/suprnova) for RTM, VTC, QTC, KLS, DNX, NEXA:
        // mining.notify params = [job_id, prevhash, coinbase1, coinbase2,
        //   merkle_branches, version, nbits, ntime, clean_jobs]
        // ntime is at index [7], nbits at [6], version at [5].
        // We store ntime per job_id for submit reconstruction.
        if matches!(
            self.profile.coin,
            ExternalCoin::RTM | ExternalCoin::VTC | ExternalCoin::QTC
                | ExternalCoin::KLS | ExternalCoin::DNX
                | ExternalCoin::NEXA
        ) {
            if let Some(arr) = params.as_array() {
                if arr.len() >= 9 {
                    let job_id = arr[0].as_str().unwrap_or("").to_string();
                    let ntime = arr.get(7).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let nbits = arr.get(6).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let version = arr.get(5).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let prevhash = arr.get(1).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let coinbase1 = arr.get(2).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let coinbase2 = arr.get(3).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let merkle_branches: Vec<String> = arr.get(4)
                        .and_then(|v| v.as_array())
                        .map(|a| a.iter()
                            .filter_map(|b| b.as_str().map(|s| s.to_string()))
                            .collect())
                        .unwrap_or_default();

                    // Store ntime for submit reconstruction
                    if !job_id.is_empty() && !ntime.is_empty() {
                        self.job_ntime.lock().await.insert(job_id.clone(), ntime.clone());
                    }

                    let extranonce1 = self.extranonce1.lock().await.clone();
                    let extranonce1_hex = hex::encode(&extranonce1);
                    let extranonce2_hex = format!("{:08x}", 0u32); // placeholder, miner fills real value

                    // Build 80-byte block header for RTM/Dash-style coins:
                    // version(4) + prevhash(32) + merkle_root(32) + ntime(4) + nbits(4) + nonce(4)
                    let header_bytes = build_stratum_v1_header(
                        &version, &prevhash, &coinbase1, &coinbase2,
                        &merkle_branches, &ntime, &nbits, &extranonce1_hex, &extranonce2_hex,
                    );

                    let header_hex = hex::encode(&header_bytes);

                    // Target from current_difficulty (set by mining.set_difficulty)
                    // or from current_target_bytes (set by mining.set_target).
                    // For RTM (Dash fork), use RTM pow_limit instead of [0xFF; 32].
                    let (target_bytes, target_hex) = {
                        let cached_target = *self.current_target_bytes.lock().await;
                        let cached_diff = *self.current_difficulty.lock().await;
                        if let Some(t) = cached_target {
                            (t, hex::encode(&t))
                        } else if cached_diff > 0.0 {
                            let t = if self.profile.coin == ExternalCoin::RTM {
                                difficulty_to_target_rtm(cached_diff)
                            } else {
                                difficulty_to_target(cached_diff)
                            };
                            (t, hex::encode(&t))
                        } else {
                            // Default: difficulty 0.001 = very easy target
                            let t = if self.profile.coin == ExternalCoin::RTM {
                                difficulty_to_target_rtm(0.001)
                            } else {
                                difficulty_to_target(0.001)
                            };
                            (t, hex::encode(&t))
                        }
                    };

                    let ntime_u64 = u64::from_str_radix(ntime.trim_start_matches("0x"), 16).ok();

                    println!(
                        "auxpow: {} notify — job={} prevhash={}.. ntime={} nbits={} version={} header_len={} target={} difficulty={}",
                        self.profile.coin.ticker(), job_id, &prevhash[..16.min(prevhash.len())],
                        ntime, nbits, version, header_bytes.len(), &target_hex,
                        *self.current_difficulty.lock().await
                    );
                    // RTM debug: log full header + coinbase components for yiimp comparison
                    if self.profile.coin == ExternalCoin::RTM {
                        println!(
                            "auxpow: RTM_DEBUG job={} extranonce1={} coinbase1={}.. coinbase2={}.. branches={} header_hex={}",
                            job_id, extranonce1_hex,
                            &coinbase1[..32.min(coinbase1.len())],
                            &coinbase2[..32.min(coinbase2.len())],
                            merkle_branches.len(),
                            header_hex
                        );
                    }

                    return Ok(ExternalJob {
                        job_id,
                        header_hex,
                        target_hex,
                        seed_hash: None,
                        block_number: None,
                        algorithm: self.profile.algorithm.clone(),
                        header_bytes,
                        target_bytes,
                        timestamp: ntime_u64,
                        nbits: Some(nbits),
                        external_coin: self.profile.coin,
                        from_group: 0,
                        to_group: 0,
                        extranonce1,
                        extranonce2: extranonce2_hex,
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

    /// Refresh the freshness timestamp for a job.  This is used by the pool
    /// server to keep `job_received_at` current whenever it distributes a job
    /// to a miner, regardless of whether the upstream pool is still actively
    /// broadcasting it.  Prevents false "stale job" pre-rejections when the
    /// upstream pool goes silent (e.g. HeroMiners ZANO).
    pub async fn touch_job_timestamp(&self, job_id: &str) {
        self.job_received_at.lock().await.insert(job_id.to_string(), std::time::Instant::now());
    }

    /// Check if a VRSC job is stale and should not be forwarded upstream.
    ///
    /// A job is considered stale if it is older than `max_age_secs`.
    ///
    /// NOTE: We deliberately do NOT check `latest_job_id` here.  The pool
    /// receives new VRSC jobs from LuckPool BEFORE the miner gets them (the
    /// pool must embed the new job in the next wire_job).  If we rejected
    /// shares whenever `job_id != latest_job_id`, we would pre-reject valid
    /// shares that LuckPool would have accepted — the miner is legitimately
    /// still working on the previous job which is still valid upstream.
    /// Age-based detection is the only safe heuristic.
    pub async fn is_job_stale(&self, job_id: &str, max_age_secs: u64) -> bool {
        if max_age_secs == 0 {
            return false;
        }
        let jra = self.job_received_at.lock().await;
        if let Some(received_at) = jra.get(job_id) {
            received_at.elapsed().as_secs() >= max_age_secs
        } else {
            // Job not in our timestamp map — we can't determine age.
            // Don't reject (give the share a chance).
            false
        }
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

    /// Generate a unique JSON-RPC request id.
    async fn next_jsonrpc_id(&self) -> i64 {
        let mut next = self.next_rpc_id.lock().await;
        let id = *next;
        *next += 1;
        id
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
        let is_cryptonote = self.protocol == StratumProtocol::CryptonoteStratum;

        // ── Server-side nonce dedup ──────────────────────────────────────
        // ProgPoW/ethash coins (ZANO, ETC, RVN) use a 32-bit nonce.  At
        // 4 MH/s the entire 2^32 nonce space is exhausted in ~18 min, after
        // which the GPU wraps around and re-finds nonces already submitted
        // to the upstream pool.  HeroMiners tracks (header_hash, nonce)
        // pairs for the entire job lifetime and rejects re-submissions as
        // "Duplicate share".  Pre-check here to avoid the round-trip.
        //
        // The dedup is keyed on (job_id, nonce) and capped at 8192 entries
        // with FIFO eviction.  When a new ZANO block arrives the job_id
        // changes, so old entries are naturally irrelevant.
        //
        // Applied to: EthStratum (ZANO), KawPow/ProgPoW Stratum v1 coins
        // (RVN, ETC, CLORE, EVR, MEWC, QUAI, ZANO).  Not needed for
        // ZcashStratum (VRSC — nonce is in solution nonceSpace, not the
        // stratum nonce field), Beam, EPIC, or CryptonoteStratum.
        {
            let needs_dedup = is_ethstratum
                || matches!(
                    self.profile.coin,
                    ExternalCoin::RVN | ExternalCoin::CLORE | ExternalCoin::EVR
                        | ExternalCoin::MEWC | ExternalCoin::QUAI | ExternalCoin::ZANO
                        | ExternalCoin::ETC
                );
            if needs_dedup {
                let mut submitted = self.submitted_nonces.lock().await;
                let key = (job_id.to_string(), nonce);
                if submitted.iter().any(|(j, n)| j == &key.0 && *n == key.1) {
                    warn!(
                        "auxpow: {} server-side dedup skip job={}.. nonce={} — already forwarded to upstream",
                        self.profile.coin,
                        &job_id[..16.min(job_id.len())],
                        nonce
                    );
                    return Ok(ShareResult::Rejected(
                        "duplicate share — server-side dedup (nonce already forwarded)".to_string(),
                    ));
                }
                submitted.push_back(key);
                if submitted.len() > 8192 {
                    submitted.pop_front();
                }
            }
        }

        // EPIC submit format:
        //   {"id": N, "method": "submit", "params": {
        //     "height": N, "job_id": N, "nonce": N,
        //     "pow": {"ProgPow": [32 bytes mixHash as array of ints]}
        //   }}
        // The mix_hash is the ProgPow mix hash (32 bytes).
        if is_epic {
            // EPIC upstream pool closes the TLS connection every ~10-15s
            // (normal for EpicStratum). The poll loop owns the shared reader,
            // so send_request_inline races with both the poll loop AND the
            // connection-close timer, causing TLS EOF on every submit attempt.
            //
            // Fix: use a DEDICATED one-shot TLS connection for each share
            // submission. We open a fresh connection, login, submit, read
            // the response, and close — all within our own controlled
            // lifecycle. EPIC shares are ~14 min apart, so the extra TLS
            // handshake (~100ms) is negligible.
            return self.epic_submit_dedicated(job_id, nonce, mix_hash_hex, _hash_hex).await;
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

        // CryptonoteStratum (DNX) submit format:
        //   {"jsonrpc":"2.0","id":N,"method":"submit",
        //    "params":{"id":"<session_id>","job_id":"<job_id>",
        //              "nonce":"<nonce_hex>","result":"<hash_hex>"}}
        // nonce = 4-byte LE hex (cryptonote nonce in block header),
        // result = hash of the modified block blob (hex).
        if is_cryptonote {
            let session_id = self.cryptonote_session_id.lock().await.clone();
            let sid = session_id.unwrap_or_else(|| "unknown".to_string());
            // Cryptonote nonce is 4 bytes, little-endian hex.
            // xmrig submits nonce as hex::encode(&nonce.to_le_bytes()),
            // e.g. nonce=0x12345678 → "78563412" (not "12345678").
            let nonce_le = (nonce & 0xFFFF_FFFF) as u32;
            let nonce_hex = hex::encode(nonce_le.to_le_bytes());
            // result hash — use mix_hash_hex if provided, else _hash_hex.
            let result_hex = mix_hash_hex.unwrap_or(_hash_hex);
            println!(
                "auxpow: XMR submit_hash_check sid={} job_id={} nonce={} _hash_hex={} mix_hash_hex={:?} result_hex={}",
                sid, job_id, nonce, _hash_hex, mix_hash_hex, result_hex
            );
            let submit_req_id = self.next_jsonrpc_id().await;
            let req = json!({
                "jsonrpc": "2.0",
                "id": submit_req_id,
                "method": "submit",
                "params": {
                    "id": sid,
                    "job_id": job_id,
                    "nonce": nonce_hex,
                    "result": result_hex,
                }
            });
            // Debug: log the exact submit payload for XMR share diagnosis
            println!(
                "auxpow: XMR submit sid={} job_id={} nonce_hex={} result_hex={} full_req={}",
                sid, job_id, nonce_hex, result_hex, serde_json::to_string(&req).unwrap_or_default()
            );
            let resp = self.send_request(&req).await?;
            // Debug: log the response
            println!(
                "auxpow: XMR submit response job_id={} resp={}",
                job_id, serde_json::to_string(&resp).unwrap_or_default()
            );
            if let Some(err) = resp.get("error") {
                if !err.is_null() {
                    let msg = err.get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("unknown error");
                    return Ok(ShareResult::Rejected(msg.to_string()));
                }
            }
            let ok = resp.get("result")
                .and_then(|v| v.get("status"))
                .and_then(|s| s.as_str())
                .map(|s| s == "OK")
                .unwrap_or_else(|| {
                    resp.get("result")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true)
                });
            if ok {
                return Ok(ShareResult::Accepted);
            } else {
                return Ok(ShareResult::Rejected("submit rejected".to_string()));
            }
        }

        // IronFishStratum (IRON) submit format:
        //   {"id":N,"method":"mining.submit","body":{
        //     "miningRequestId":<id>, "randomness":"<hex>", "graffiti":"<hex>"}}
        // randomness = 8-byte LE hex (extranonce + scanned nonce)
        // graffiti = 32-byte hex (arbitrary, we use zeros)
        if self.protocol == StratumProtocol::IronFishStratum {
            let job = self.current_job().await;
            let mining_request_id: u64 = job
                .as_ref()
                .and_then(|j| j.block_number)
                .unwrap_or(0);
            // randomness: extranonce (xn) + scanned nonce, 8 bytes LE hex
            let xn = self.extranonce1.lock().await.clone();
            let mut randomness_bytes = [0u8; 8];
            let xn_len = xn.len().min(8);
            randomness_bytes[..xn_len].copy_from_slice(&xn[..xn_len]);
            // Fill remaining bytes with the nonce (LE)
            let nonce_bytes = nonce.to_le_bytes();
            let remaining = 8 - xn_len;
            randomness_bytes[xn_len..].copy_from_slice(&nonce_bytes[..remaining]);
            let randomness_hex = hex::encode(randomness_bytes);
            // graffiti: 32 bytes of zeros (printable chars preferred, but zeros work)
            let graffiti_hex = "0".repeat(64);

            let submit_req_id = self.next_jsonrpc_id().await;
            let req = json!({
                "id": submit_req_id,
                "method": "mining.submit",
                "body": {
                    "miningRequestId": mining_request_id,
                    "randomness": randomness_hex,
                    "graffiti": graffiti_hex,
                }
            });
            let resp = self.send_request(&req).await?;
            // IronFish pools respond with mining.submitted: {id, result, message?}
            // or generic error: {error: {id, message}}
            if let Some(err) = resp.get("error") {
                if !err.is_null() {
                    let msg = err.get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("unknown error");
                    return Ok(ShareResult::Rejected(msg.to_string()));
                }
            }
            // Check mining.submitted body
            let ok = resp.get("body")
                .and_then(|b| b.get("result"))
                .and_then(|v| v.as_bool())
                .unwrap_or_else(|| {
                    resp.get("result")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true)
                });
            if ok {
                return Ok(ShareResult::Accepted);
            } else {
                let msg = resp.get("body")
                    .and_then(|b| b.get("message"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("submit rejected");
                return Ok(ShareResult::Rejected(msg.to_string()));
            }
        }

        let (method, params) = if is_ethstratum {
            // Stale share pre-rejection for EthStratum (ZANO / HeroMiners).
            //
            // HeroMiners keeps sending the same header_hash (job_id) every 2-5s
            // via eth_getWork, but internally expires the job after ~30-60s.
            // Shares submitted after expiry are rejected with "Job expired".
            // Pre-rejecting stale shares locally avoids wasting a round-trip
            // and inflating the reject rate.
            //
            // The freshness timestamp is refreshed every time the pool server
            // distributes the job to a miner (see touch_job_timestamp), so the
            // default 120s threshold covers both normal wire_job cadence and
            // any upstream silent periods without false pre-rejections.
            // Set ZION_ZANO_STALE_SECS=0 to disable, or override to adjust.
            {
                let stale_secs = std::env::var("ZION_ZANO_STALE_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(120u64);
                if stale_secs > 0 && self.is_job_stale(job_id, stale_secs).await {
                    warn!(
                        "auxpow: {} stale job={}.. nonce={} — pre-rejected (age > {}s)",
                        self.profile.coin,
                        &job_id[..16.min(job_id.len())],
                        nonce,
                        stale_secs
                    );
                    return Ok(ShareResult::Rejected(
                        "stale job — pre-rejected (ZANO job expired)".to_string()
                    ));
                }
            }

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
        } else if matches!(
            self.profile.coin,
            ExternalCoin::RVN | ExternalCoin::CLORE | ExternalCoin::EVR
                | ExternalCoin::MEWC | ExternalCoin::QUAI | ExternalCoin::ZANO
        ) {
            // KawPow / ProgPoW coins on 2miners/NiceHash/HeroMiners use Stratum v1
            // mining.submit with 5 params:
            //   [worker, job_id, nonce_hex, header_hash_hex, mix_hash_hex]
            // job_id = short job_id from notify, nonce = 0x-prefixed 8-byte hex,
            // header_hash = 0x-prefixed 32-byte block header hash from notify,
            // mix_hash = 0x-prefixed 32-byte PoW mix hash from GPU kernel.
            //
            // NiceHash nonce format: extranonce1 || miner_nonce (big-endian).
            // The miner already embeds extranonce1 in the high bits of the
            // nonce, so we just send the full nonce value as hex.
            // For 2miners (no extranonce1), extranonce1 is empty and we send
            // just the miner nonce.
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

            // Stale share pre-rejection for VRSC.
            //
            // LuckPool expires VRSC jobs ~30s after issuance and returns
            // error 21 "job not found" for shares submitted after expiry.
            // Previously we forwarded stale shares anyway ("give the share
            // a chance"), but LuckPool always rejects them, wasting a
            // round-trip and inflating the reject rate from ~85% to ~96%.
            //
            // Stale share pre-rejection for VRSC.
            //
            // LuckPool expires VRSC jobs when a new VerusCoin block is found
            // (~12s average block time).  Due to the multi-hop forwarding
            // architecture (LuckPool → Edge pool → local miner → Edge pool →
            // LuckPool), there is an inherent 3-5s delay that causes some
            // shares to arrive after the job has expired.
            //
            // Age-based pre-rejection was tested with thresholds of 20s and
            // 25s but both REDUCED the accept rate because job validity varies
            // wildly (6-30s depending on block timing) — the threshold can't
            // distinguish "old but still valid" from "old and expired".
            //
            // The latest_job_id check was also tested but is broken because
            // the pool receives new jobs BEFORE the miner, causing false
            // pre-rejections of shares LuckPool would have accepted.
            //
            // Current approach: forward all shares and let LuckPool reject.
            // The ~15-17% reject rate is inherent to the multi-hop architecture.
            // Set ZION_VRSC_STALE_SECS > 0 to enable age-based pre-rejection.
            {
                let stale_secs = std::env::var("ZION_VRSC_STALE_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0u64);
                if stale_secs > 0 && self.is_job_stale(job_id, stale_secs).await {
                    warn!(
                        "auxpow: {} stale job={} nonce={} — pre-rejected (age threshold {}s)",
                        self.profile.coin, job_id, nonce, stale_secs
                    );
                    return Ok(ShareResult::Rejected(
                        "stale job — pre-rejected to avoid upstream job-not-found".to_string()
                    ));
                }
            }

            // ── Solution lookup pre-check ──────────────────────────────────
            // After a VRSC bridge reconnect (client.reconnect from LuckPool),
            // a NEW AuxPowClient is created with an EMPTY job_solution HashMap.
            // Shares for job_ids from BEFORE the reconnect would get an
            // all-zeros solution → LuckPool rejects with "Nonce not found in
            // solution vector".  Pre-reject these locally to avoid wasting
            // a round-trip and inflating the reject rate.
            //
            // Also catches shares for evicted job_ids (64-job rolling window).
            {
                let has_solution = self.job_solution.lock().await.contains_key(job_id);
                if !has_solution {
                    warn!(
                        "auxpow: {} stale job={} nonce={} — pre-rejected (job_id not in job_solution, likely post-reconnect)",
                        self.profile.coin, job_id, nonce
                    );
                    return Ok(ShareResult::Rejected(
                        "stale job — post-reconnect, solution unavailable".to_string()
                    ));
                }
            }

            // ── Latest-job grace period check ────────────────────────────────
            // LuckPool expires a VRSC job when a new VerusCoin block is found
            // (~12s average, sometimes 1-3s).  The multi-hop forwarding
            // architecture (LuckPool → Edge → miner → Edge → LuckPool) adds
            // 3-5s delay, so shares for recently-superseded jobs may still
            // be accepted if submitted quickly enough.
            //
            // Strategy: if the share's job_id is NOT the latest job_id, check
            // how long ago the latest job arrived.  If it arrived > GRACE_SECS
            // ago, the old job is definitely expired at LuckPool — pre-reject.
            // If it arrived < GRACE_SECS ago, forward the share (it might
            // still be valid — the miner found it before receiving the new
            // job, and LuckPool may still accept it).
            //
            // DISABLED by default (grace=0): the pool server receives new
            // jobs from LuckPool BEFORE the miner gets the old job, so
            // latest_job_id is always ahead of the miner's job.  This causes
            // false pre-rejections of shares LuckPool would have accepted.
            // The ~15-17% reject rate is inherent to the multi-hop architecture.
            // Set ZION_VRSC_JOB_GRACE_SECS > 0 to enable.
            {
                let grace_secs = std::env::var("ZION_VRSC_JOB_GRACE_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0u64);
                if grace_secs > 0 {
                    let latest = self.latest_job_id.lock().await.clone();
                    let latest_received_at = if let Some(ref lid) = latest {
                        self.job_received_at.lock().await.get(lid).copied()
                    } else {
                        None
                    };
                    if let (Some(latest_id), Some(received_at)) = (&latest, latest_received_at) {
                        if latest_id != job_id {
                            let age = received_at.elapsed().as_secs();
                            if age >= grace_secs {
                                warn!(
                                    "auxpow: {} stale job={} nonce={} — pre-rejected (latest job {} arrived {}s ago, grace={}s)",
                                    self.profile.coin, job_id, nonce, latest_id, age, grace_secs
                                );
                                return Ok(ShareResult::Rejected(
                                    "stale job — superseded by newer job (grace period expired)".to_string()
                                ));
                            }
                        }
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
            // Standard Zcash Stratum: nonce field = 32 bytes total.
            //   nonce2 = 32 - len(extranonce1) (miner_nonce at START).
            // Use the extranonce1 active for this job so xnsub updates don't
            // break in-flight share submissions.
            let job_en1_opt = self.job_extranonce1.lock().await.get(job_id).cloned();
            let current_en1 = self.extranonce1.lock().await.clone();
            let job_en1 = job_en1_opt.unwrap_or(current_en1);
            let en1_hex = hex::encode(job_en1);
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
                // Standard Zcash Stratum: nonce field = 32 bytes total.
                // nonce2 is the part after extranonce1.
                let nonce_field_total = 32usize;
                let nonce2_bytes = nonce_field_total.saturating_sub(en_bytes);
                let nonce2_hex_len = nonce2_bytes * 2;

                if self.profile.coin == ExternalCoin::ZCL {
                    // ZCL Equihash 192,7: the miner's nonce is encoded as
                    // little-endian bytes at the START of extranonce2, padded
                    // with zeros to fill the remaining nonce2 bytes.
                    // E.g. en1=4B → nonce2=28B → nonce_le(4B) + 24B zeros.
                    let nonce_le = (nonce & 0xFFFFFFFF) as u32;
                    let nonce_hex = hex::encode(nonce_le.to_le_bytes());
                    let padding = nonce2_hex_len.saturating_sub(nonce_hex.len());
                    format!("{}{}", nonce_hex, "0".repeat(padding))
                } else {
                    // PBaaS v7+ (VRSC) CRITICAL FIX:
                    // LuckPool's verusHashV2b2 checks a preHeaderHash (blake2b)
                    // stored in the solution against the header's non-canonical
                    // fields (including nNonce).  If the pool writes en1+nonce2
                    // into the nonce field, nNonce changes → preHeaderHash
                    // mismatch → pool returns 0xFF → "low difficulty share".
                    //
                    // Fix: send nonce2 = all zeros so the pool writes en1+zeros
                    // into the nonce field (same as the original job).  The
                    // preHeaderHash then matches, the pool clears non-canonical
                    // data and hashes normally.  The miner's actual nonce is in
                    // the solution nonceSpace, which is what determines the hash
                    // after clearing.
                    "0".repeat(nonce2_hex_len)
                }
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
            } else if self.profile.coin == ExternalCoin::ZCL {
                // ZCL Equihash 192,7 — solution is 400 bytes (800 hex chars).
                // Varint for 400 = fd9001 (Zcash compact: 0xfd + LE 2-byte len).
                // The solution comes from the GPU miner's GpuFoundShare.solution,
                // passed via mix_hash_hex as hex-encoded 400 bytes.
                //
                // Nonce2: 28 bytes = 32 (full nonce field) - 4 (extranonce1).
                // The miner's nonce is encoded as LE bytes at the start of
                // extranonce2, padded with zeros to 28 bytes.
                let sol_hex = mix_hash_hex.unwrap_or(_hash_hex);
                let sol_hex = sol_hex.trim_start_matches("0x");
                // Ensure solution is exactly 400 bytes (800 hex chars).
                let sol_padded = if sol_hex.len() == 800 {
                    sol_hex.to_string()
                } else if sol_hex.len() < 800 {
                    format!("{}{}", sol_hex, "0".repeat(800 - sol_hex.len()))
                } else {
                    sol_hex[..800].to_string()
                };
                // Prepend varint: fd9001 = 400 in Zcash compact varint.
                format!("fd9001{}", sol_padded)
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
                "auxpow: {} submit DETAIL — en1_len={} nonce2={} sol_first20={} sol_last30={}",
                self.profile.coin,
                en1_hex.len() / 2,
                nonce2_str,
                &solution_with_varint[..20.min(solution_with_varint.len())],
                &solution_with_varint[solution_with_varint.len().saturating_sub(30)..],
            );
            // Full reconstruction data for parity checks against the miner header.
            println!(
                "auxpow: {} submit FULL — job={} ntime={} en1={} nonce2={} solution={}",
                self.profile.coin, job_id, ntime, en1_hex, nonce2_str, solution_with_varint
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
            // The full 8-byte Autolykos nonce is en1 (from subscribe) followed
            // by extranonce2 (the miner's searched space). 2miners ERG uses
            // en1 = 2 bytes and nonce2 = 6 bytes, so nonce2 is the lower 6 bytes
            // of the full 64-bit nonce in big-endian hex.
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            let en1 = self.extranonce1.lock().await;
            let en1_hex = hex::encode(&*en1);
            let en1_len = en1.len();
            let nonce2_size = 8usize.saturating_sub(en1_len).max(1);
            let nonce_be = nonce.to_be_bytes();
            let nonce2 = hex::encode(&nonce_be[en1_len..en1_len + nonce2_size]);
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
        } else if matches!(
            self.profile.coin,
            ExternalCoin::RTM | ExternalCoin::VTC | ExternalCoin::QTC
                | ExternalCoin::KLS | ExternalCoin::DNX
                | ExternalCoin::NEXA
        ) {
            // Standard Stratum v1 with 5 params for zpool/suprnova/herominers:
            //   [worker, job_id, extranonce2, ntime, nonce]
            // extranonce2 = extranonce2_size bytes (from subscribe, default 4)
            //   miner nonce encoded as LE bytes, padded to extranonce2_size
            // ntime = from notify params[5] (must match pool's time window)
            // nonce = 4-byte LE hex (the PoW nonce scanned by the GPU kernel)
            //
            // Verified by E2E tests:
            //   RTM (zpool): 5p → "Invalid time rolling" (format correct)
            //   VTC (zpool): 5p → "Invalid time rolling" (format correct)
            //   QTC (suprnova): 5p → "ntime out of range" (format correct)
            //   3p/4p → "malformed submit params" (wrong param count)
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);

            // ntime from stored job data or notify params
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

            // extranonce2: for RTM CPU mining, extranonce2 is fixed at 0
            // (header is built with extranonce2=0 in build_stratum_v1_header).
            // For GPU coins (VTC, KLS, etc.), extranonce2 = miner nonce as LE bytes.
            let en2_size = self.extranonce2_size.lock().await.unwrap_or(4) as usize;
            let nonce_le = (nonce & 0xFFFFFFFF) as u32;
            let nonce_bytes = nonce_le.to_le_bytes();

            let en2 = if self.profile.coin == ExternalCoin::RTM {
                // RTM CPU mining: extranonce2 is fixed at 0 (header built with en2=0)
                "00000000".to_string()
            } else {
                // GPU coins: extranonce2 = miner nonce as LE bytes
                let mut e = hex::encode(&nonce_bytes);
                let needed = en2_size * 2;
                if e.len() < needed {
                    e.push_str(&"0".repeat(needed - e.len()));
                }
                if e.len() > needed {
                    e.truncate(needed);
                }
                e
            };

            // PoW nonce as BE hex string (cpuminer: sprintf "%08x", nonce)
            // Pool interprets this as a BE uint32 and stores as LE in header
            let nonce_hex = format!("{:08x}", nonce_le);

            println!(
                "auxpow: {} submit — job={} en2={} ntime={} nonce={}",
                self.profile.coin, job_id, en2, ntime, nonce_hex
            );

            ("mining.submit", json!([worker, job_id, en2, ntime, nonce_hex]))
        } else {
            let hex = format!("0x{:016x}", nonce);
            let wallet = self.payout_wallet.lock().await.clone();
            let worker = format!("{}.{}", wallet, self.profile.worker_name);
            ("mining.submit", json!([worker, job_id, hex]))
        };

        let submit_req_id = self.next_jsonrpc_id().await;
        let req = json!({
            "jsonrpc": "2.0",
            "id": submit_req_id,
            "method": method,
            "params": params
        });

        println!("auxpow: submitting share request {}", serde_json::to_string(&req).unwrap_or_default());
        let resp = self.send_request(&req).await?;

        let accepted = resp
            .get("result")
            .and_then(|v| v.as_bool())
            .unwrap_or_else(|| {
                // Some pools (e.g. ZANO HeroMiners) return result as an
                // object {"status":"OK"} instead of a boolean true.
                resp.get("result")
                    .and_then(|v| v.get("status"))
                    .and_then(|s| s.as_str())
                    .map(|s| s.eq_ignore_ascii_case("OK"))
                    .unwrap_or(false)
            });

        if accepted {
            debug!("AuxPow: share accepted for {}", self.profile.coin);
            Ok(ShareResult::Accepted)
        } else if let Some(err) = resp.get("error") {
            if err.is_null() {
                println!("auxpow: {} submit response (result=false, error=null): {}", self.profile.coin, resp);
                return Ok(ShareResult::Unknown);
            }
            // Log the raw error for debugging
            println!("auxpow: {} submit error raw: {}", self.profile.coin, err);
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

    /// EPIC ProgPow share submission via a DEDICATED one-shot TLS connection.
    ///
    /// The EPIC upstream pool aggressively closes TLS connections every
    /// ~10-15s. The shared poll-loop connection races with this close timer,
    /// causing TLS EOF on nearly every submit attempt. This method opens a
    /// fresh TLS connection, logs in, submits the share, reads the response,
    /// and closes — all within a controlled lifecycle that doesn't compete
    /// with the poll loop.
    ///
    /// Returns `ShareResult::Accepted` on success, `Rejected` on an explicit
    /// error response, or `Unknown` if we can't get a definitive response
    /// after 3 connection attempts.
    async fn epic_submit_dedicated(
        &self,
        job_id: &str,
        nonce: u64,
        mix_hash_hex: Option<&str>,
        _hash_hex: &str,
    ) -> Result<ShareResult> {
        let job = self.current_job().await;
        let height = job.as_ref().and_then(|j| j.block_number).unwrap_or(0);
        let job_id_num: u64 = job_id.parse().unwrap_or(0);

        // Convert mix_hash_hex to array of 32 bytes for ProgPow pow field.
        // EPIC expects the mix hash as a JSON array of integers [0, 255, ...].
        let mix_hex = mix_hash_hex.unwrap_or(_hash_hex);
        let mix_bytes = hex::decode(mix_hex.trim_start_matches("0x"))
            .unwrap_or_else(|_| vec![0u8; 32]);
        let mut mix_arr = [0u8; 32];
        let len = mix_bytes.len().min(32);
        mix_arr[..len].copy_from_slice(&mix_bytes[..len]);
        let mix_json: Vec<i64> = mix_arr.iter().map(|&b| b as i64).collect();

        let submit_req = json!({
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

        // Build the login request (same logic as epic_login, but using
        // local connection state instead of self.stream/self.reader).
        let worker = &self.profile.worker_name;
        let max_wallet_len = 20usize.saturating_sub(worker.len() + 1);
        let payout = self.payout_wallet.lock().await.clone();
        let wallet_short = if payout.len() <= max_wallet_len {
            payout.clone()
        } else {
            "ziontest".to_string()
        };
        let login_str = format!("{}.{}", wallet_short, worker);
        let password = if self.profile.password.len() >= 8 {
            self.profile.password.clone()
        } else {
            "zion1234567".to_string()
        };
        let login_req = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "login",
            "params": {
                "login": login_str,
                "pass": password,
                "agent": "zion-auxpow/0.1",
            }
        });

        let addr = self.profile.pool_address();

        for attempt in 0..3u32 {
            eprintln!(
                "auxpow: EPIC dedicated submit attempt={} (job_id={} nonce={} height={})",
                attempt + 1, job_id_num, nonce, height
            );

            // 1. Open fresh TCP+TLS connection
            let tcp_stream = match timeout(Duration::from_secs(15), TcpStream::connect(&addr)).await {
                Ok(Ok(s)) => s,
                Ok(Err(e)) => {
                    eprintln!("auxpow: EPIC dedicated submit attempt={} TCP connect failed: {e}", attempt + 1);
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    continue;
                }
                Err(_) => {
                    eprintln!("auxpow: EPIC dedicated submit attempt={} TCP connect timeout", attempt + 1);
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    continue;
                }
            };

            let provider = std::sync::Arc::new(
                tokio_rustls::rustls::crypto::ring::default_provider()
            );
            let roots = RootCertStore {
                roots: webpki_roots::TLS_SERVER_ROOTS.iter().cloned().collect(),
            };
            let config = match tokio_rustls::rustls::ClientConfig::builder_with_provider(provider)
                .with_safe_default_protocol_versions()
            {
                Ok(c) => c.with_root_certificates(roots).with_no_client_auth(),
                Err(e) => {
                    eprintln!("auxpow: EPIC dedicated submit TLS config failed: {e}");
                    return Ok(ShareResult::Unknown);
                }
            };
            let connector = tokio_rustls::TlsConnector::from(std::sync::Arc::new(config));
            let domain = match rustls_pki_types::ServerName::try_from(self.profile.pool_host.clone()) {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("auxpow: EPIC dedicated submit invalid TLS server name: {e}");
                    return Ok(ShareResult::Unknown);
                }
            };
            let tls_stream = match connector.connect(domain, tcp_stream).await {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("auxpow: EPIC dedicated submit attempt={} TLS handshake failed: {e}", attempt + 1);
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    continue;
                }
            };

            let (reader_half, writer_half) = tokio::io::split(tls_stream);
            let mut sock_writer: Box<dyn AsyncWrite + Unpin + Send> = Box::new(writer_half);
            let mut sock_reader = BufReader::new(Box::new(reader_half) as Box<dyn AsyncRead + Unpin + Send>);

            // 2. Login on the dedicated connection
            let login_resp = match epic_dedicated_request(&mut sock_writer, &mut sock_reader, &login_req, 1).await {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("auxpow: EPIC dedicated submit attempt={} login failed: {e}", attempt + 1);
                    let _ = sock_writer.shutdown().await;
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    continue;
                }
            };
            if let Some(err) = login_resp.get("error") {
                if !err.is_null() {
                    let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("login error");
                    eprintln!("auxpow: EPIC dedicated submit login rejected: {msg}");
                    let _ = sock_writer.shutdown().await;
                    return Ok(ShareResult::Rejected(format!("EPIC login: {msg}")));
                }
            }

            // 3. Submit the share on the dedicated connection
            match epic_dedicated_request(&mut sock_writer, &mut sock_reader, &submit_req, 20).await {
                Ok(resp) => {
                    let _ = sock_writer.shutdown().await;
                    if let Some(err) = resp.get("error") {
                        if !err.is_null() {
                            let msg = err.get("message")
                                .and_then(|m| m.as_str())
                                .unwrap_or("unknown error");
                            eprintln!("auxpow: EPIC dedicated submit rejected: {msg}");
                            return Ok(ShareResult::Rejected(msg.to_string()));
                        }
                    }
                    let ok = resp.get("result")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true);
                    eprintln!(
                        "auxpow: EPIC dedicated submit accepted={} (attempt={})",
                        ok, attempt + 1
                    );
                    if ok {
                        return Ok(ShareResult::Accepted);
                    } else {
                        return Ok(ShareResult::Rejected("submit rejected".to_string()));
                    }
                }
                Err(e) => {
                    eprintln!(
                        "auxpow: EPIC dedicated submit attempt={} submit failed: {e}",
                        attempt + 1
                    );
                    let _ = sock_writer.shutdown().await;
                    // If the submit write succeeded but the read failed (TLS
                    // EOF), the pool may have processed the share but closed
                    // before responding. Retry on a fresh connection.
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    continue;
                }
            }
        }

        eprintln!(
            "auxpow: EPIC dedicated submit exhausted 3 attempts — returning Unknown"
        );
        Ok(ShareResult::Unknown)
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
    ///   - VerusHash (VRSC) `0x0007ffff...` (~1/8192 of full max)
    ///   - 224-bit for KAS and DCR (`0x00 x4 || 0xFF x28`)
    ///   - 226-bit for ALPH (`0x00 x3 || 0x03 || 0xFF x28`)
    ///   - 256-bit for everything else.
    /// The result saturates at max target, so difficulties below 1.0 produce
    /// the easiest possible target.
    pub async fn share_target(&self) -> [u8; 32] {
        let difficulty = self.current_difficulty().await;
        // VerusHash/VerusPoW uses a coin-specific "difficulty 1" target that is
        // ~1/8192 of the full 2^256 - 1 maximum.  LuckPool's `mining.set_target`
        // and the `shareDiff` math in node-stratum-pool-verus are computed
        // against this base, so we must use it when deriving the share target.
        let max_target = if self.profile.algorithm.eq_ignore_ascii_case("verushash") {
            VERUS_HASH_DIFF1
        } else if self.profile.algorithm.eq_ignore_ascii_case("kheavyhash") {
            // 2^224 - 1 as a 32-byte big-endian number: 4 leading zero bytes
            // followed by 28 0xFF bytes.  This matches the Kaspa stratum bridge.
            let mut t = [0u8; 32];
            t[4..].fill(0xFF);
            t
        } else if self.profile.algorithm.eq_ignore_ascii_case("ghostrider")
            || self.profile.coin == ExternalCoin::RTM
        {
            // Raptoreum (Dash fork) uses a PoW limit of 0x00000FFFFF000...
            // Using the full 256-bit max would overflow for diff < 1.0,
            // producing an all-FF target that the upstream pool rejects.
            RTM_POW_LIMIT
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
        // Allow operator override of share target for coins that do not
        // receive mining.set_difficulty (e.g. ALPH on Herominers).
        if let Ok(target_hex) = std::env::var(format!("ZION_AUXPOW_{}_SHARE_TARGET_HEX", self.profile.coin.ticker())) {
            if let Some(t) = crate::external_hashers::parse_target_hex(&target_hex) {
                println!("auxpow: {} share_target override hex={} -> {}", self.profile.coin, target_hex, hex::encode(t));
                return t;
            }
        }
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
        *self.current_job.lock().await = None; // clear stale job
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
        let req = json!({
            "id": self.next_jsonrpc_id().await,
            "method": "eth_getWork",
            "params": []
        });
        let resp = self.send_request(&req).await?;
        // The response has "result" = [seed_hash, header_hash, target, height?]
        // (same format as the notification params).
        // NOTE: ZANO HeroMiners returns [header_hash, seed_hash, target, height]
        // — the first two elements are swapped vs standard Ethereum eth_getWork.
        // The header_hash changes every block; the seed_hash is constant per epoch.
        if let Some(result) = resp.get("result") {
            if let Some(arr) = result.as_array() {
                if arr.len() >= 3 {
                    let (seed_idx, header_idx) = if self.profile.coin == ExternalCoin::ZANO {
                        (1, 0) // ZANO: [header_hash, seed_hash, ...] — swapped
                    } else {
                        (0, 1) // Standard: [seed_hash, header_hash, ...]
                    };
                    let job = self
                        .parse_eth_getwork_params(
                            arr[seed_idx].as_str().unwrap_or(""),
                            arr[header_idx].as_str().unwrap_or(""),
                            arr[2].as_str().unwrap_or(""),
                            arr.get(3).and_then(|v| v.as_str()),
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

    /// Parse eth_getWork params (seed_hash, header_hex, target_hex,
    /// optional height_hex) into an `ExternalJob`.  Shared between
    /// notification and polling paths.
    async fn parse_eth_getwork_params(
        &self,
        seed_hash: &str,
        header_hex: &str,
        target_hex: &str,
        height_hex: Option<&str>,
    ) -> ExternalJob {
        let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
            .unwrap_or_default();
        let target_bytes = crate::external_hashers::parse_target_hex(
            target_hex.trim_start_matches("0x"),
        )
        .unwrap_or([0xFFu8; 32]);

        // Update the client's current target and difficulty from the
        // getWork target.  EthStratum pools (ZANO, ETC, etc.) provide the
        // share target directly in the getWork response — there is no
        // separate mining.set_difficulty message.  Without this, the
        // share_target() method would use the default difficulty=1.0
        // (target=0xffff...), causing us to submit shares that don't meet
        // the pool's actual target.
        let max_target = algorithm_max_target(&self.profile.algorithm);
        let diff = target_to_difficulty_with_max(&target_bytes, &max_target);
        *self.current_target_bytes.lock().await = Some(target_bytes);
        *self.current_difficulty.lock().await = diff;

        // open-ethereum-pool style eth_getWork returns an optional 4th
        // element: the block height as a 0x-prefixed big-endian hex u64.
        let block_number = height_hex.and_then(|h| {
            u64::from_str_radix(h.trim_start_matches("0x"), 16).ok()
        });

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

        // Track job age for stale share detection (EthStratum / ZANO).
        // UPDATE the timestamp on every re-send of the same header_hash.
        // EthStratum pools (HeroMiners ZANO) re-broadcast the same header_hash
        // every 2-5s for as long as the upstream job is valid, and stop only
        // when the job actually expires.  Therefore the most recent receive
        // time — not the first — is the correct anchor for staleness.  Using
        // the first sighting would pre-reject shares for any job that takes
        // longer than ZION_ZANO_STALE_SECS to find a share (which at ~7 MH/s
        // and ZANO's hard target is minutes, not seconds).
        {
            let mut jra = self.job_received_at.lock().await;
            jra.insert(header_hex.to_string(), std::time::Instant::now());
            // Evict entries older than 5 minutes to bound memory.
            if jra.len() > 64 {
                let cutoff = std::time::Instant::now()
                    .checked_sub(std::time::Duration::from_secs(300))
                    .unwrap_or_else(std::time::Instant::now);
                jra.retain(|_, ts| *ts > cutoff);
            }
        }

        ExternalJob {
            job_id: header_hex.to_string(),
            header_hex: header_hex.to_string(),
            target_hex: target_hex.to_string(),
            seed_hash: Some(seed_hash.to_string()),
            block_number,
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
            timestamp: block_number,
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
        // eth_submitHashrate params: [hashrate_hex, miner_id]
        // hashrate_hex is 0x-prefixed 32-byte hex of the hashrate value.
        let hashrate_hex = format!("0x{:064x}", hashrate_hps);
        let miner_id = format!(
            "{}-{}",
            self.profile.coin,
            self.profile.worker_name
        );
        let req = json!({
            "id": self.next_jsonrpc_id().await,
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

/// VerusHash/VerusPoW uses a coin-specific "difficulty 1" target:
/// `0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`.
/// LuckPool's `mining.set_target` and share difficulty math are computed
/// against this base, not the full 2^256 - 1 maximum used by most coins.
pub const VERUS_HASH_DIFF1: [u8; 32] = [
    0x00, 0x07, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
];

/// Return the base target used for difficulty↔target conversions for an
/// algorithm.  VerusHash uses [`VERUS_HASH_DIFF1`]; everything else uses the
/// full 256-bit maximum.
pub fn algorithm_max_target(algorithm: &str) -> [u8; 32] {
    if algorithm.eq_ignore_ascii_case("verushash") {
        VERUS_HASH_DIFF1
    } else {
        [0xFFu8; 32]
    }
}

/// Convert a 32-byte big-endian target to a difficulty value using the
/// full 2^256 - 1 maximum as the base difficulty 1.
pub fn target_to_difficulty(target: &[u8; 32]) -> f64 {
    target_to_difficulty_with_max(target, &[0xFFu8; 32])
}

/// Convert a 32-byte big-endian target to a difficulty value against a
/// supplied base target.  For VerusHash the base is [`VERUS_HASH_DIFF1`].
pub fn target_to_difficulty_with_max(target: &[u8; 32], max_target: &[u8; 32]) -> f64 {
    use num_bigint::BigUint;
    let target_big: BigUint = BigUint::from_bytes_be(target);
    if target_big == BigUint::from(0u32) {
        return f64::INFINITY;
    }
    let max_big: BigUint = BigUint::from_bytes_be(max_target);
    let diff_big: BigUint = &max_big / target_big;
    let bytes = diff_big.to_bytes_be();
    let mut result: f64 = 0.0;
    for &b in &bytes {
        result = result * 256.0 + b as f64;
    }
    result
}

pub fn difficulty_to_target(difficulty: f64) -> [u8; 32] {
    difficulty_to_target_with_max(difficulty, &[0xFFu8; 32])
}

/// RTM (Raptoreum) pow_limit target — same as Dash.
/// Dash pow_limit = 0x00000fffff000000000000000000000000000000000000000000000000000000
/// (from nbits 0x1e0fffff)
pub const RTM_POW_LIMIT: [u8; 32] = [
    0x00, 0x00, 0x0f, 0xff, 0xff, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

/// Convert a Stratum difficulty value to a 32-byte big-endian target
/// using RTM's pow_limit (Dash fork).
/// For share difficulties < 1.0, the target can exceed pow_limit (easier).
pub fn difficulty_to_target_rtm(difficulty: f64) -> [u8; 32] {
    use num_bigint::BigUint;

    if !difficulty.is_finite() || difficulty.is_nan() || difficulty <= 0.0 {
        return [0xFFu8; 32];
    }

    let max = BigUint::from_bytes_be(&RTM_POW_LIMIT);

    let bits = difficulty.to_bits();
    let mantissa = bits & 0x000F_FFFF_FFFF_FFFF;
    let exponent = ((bits >> 52) & 0x7FF) as i32 - 1023;
    let significand = if exponent == -1023 {
        BigUint::from(mantissa)
    } else {
        BigUint::from(mantissa | 0x0010_0000_0000_0000u64)
    };

    if significand == BigUint::from(0u32) {
        return [0xFFu8; 32];
    }

    let mut target = max;
    let shift = 52 - exponent;
    if shift >= 0 {
        target <<= shift as usize;
    } else {
        target >>= (-shift) as usize;
    }
    target /= significand;

    let bytes = target.to_bytes_be();

    if bytes.len() > 32 {
        return [0xFFu8; 32];
    }

    let mut out = [0u8; 32];
    let start = out.len().saturating_sub(bytes.len());
    out[start..].copy_from_slice(&bytes);
    out
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
            Self::CryptonoteStratum => "cryptonotestratum",
            Self::IronFishStratum => "ironfishstratum",
        }
    }
}

/// Free-standing helper for `epic_submit_dedicated`: send a JSON-RPC request
/// on a dedicated TLS connection and read the matching response (skipping
/// notifications). This avoids the shared `self.reader`/`self.stream` mutexes
/// that race with the poll loop.
async fn epic_dedicated_request(
    writer: &mut Box<dyn AsyncWrite + Unpin + Send>,
    reader: &mut BufReader<Box<dyn AsyncRead + Unpin + Send>>,
    req: &Value,
    req_id: i64,
) -> Result<Value> {
    let mut line = serde_json::to_string(req)?;
    line.push('\n');
    writer.write_all(line.as_bytes()).await?;
    writer.flush().await?;
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("dedicated submit: timeout waiting for response");
        }
        let mut buf = String::new();
        match timeout(remaining, reader.read_line(&mut buf)).await {
            Ok(Ok(0)) => bail!("dedicated submit: connection closed by remote"),
            Ok(Ok(_)) => {}
            Ok(Err(e)) => bail!("dedicated submit: read error: {e}"),
            Err(_) => bail!("dedicated submit: read timeout"),
        }
        let trimmed = buf.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parsed: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };
        // Check for matching response id
        let resp_id = parsed.get("id").and_then(|v| {
            v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
        });
        if let Some(id) = resp_id {
            if id == req_id {
                return Ok(parsed);
            }
        }
        // EPIC: accept error/result with matching method
        if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
            let req_method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");
            if method == req_method {
                if let Some(err) = parsed.get("error") {
                    if !err.is_null() {
                        return Ok(parsed);
                    }
                }
                if let Some(result) = parsed.get("result") {
                    if !result.is_null() {
                        return Ok(parsed);
                    }
                }
            }
        }
        // Otherwise it's a notification — skip it
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

    // NOTE: eth_submit_hashrate_test removed — no coin uses EthStratum protocol
    // anymore (CLORE/ERG switched to standard Stratum v1). submit_hashrate()
    // returns Ok(false) for non-EthStratum protocols. The method is retained
    // for future EthStratum coins but has no live consumer.

    #[tokio::test]
    async fn xmr_randomx_notify_and_submit() {
        // XMR uses CryptonoteStratum protocol (login/job/submit),
        // NOT Stratum v1 (mining.subscribe/mining.authorize/mining.notify).
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let blob_hex = "0d00".to_string() + &"00".repeat(74); // 152 hex chars / 76 bytes
        let seed_hash = "11".repeat(32);
        let target_hex = "00ffffff00000000"; // 8-byte LE target
        let height: u64 = 3334445;
        let job_id = "xmr_job_001";
        let session_id = "xmr_session_001";

        let server_blob_hex = blob_hex.clone();
        let server_seed_hash = seed_hash.clone();
        let server_job_id = job_id.to_string();
        let server_session_id = session_id.to_string();

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

            // CryptonoteStratum: login request
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "login");
            let login = req["params"]["login"].as_str().unwrap();
            assert!(login.starts_with("45zTKY3zei7ACSWrQAXeU7AsTwccCfN52Kt7odqWq9icYfB9zGTmfmd5fi28oFsktNHiguc2oHizZhfvhVqauXf6Q4CcUED"));
            // Respond with session ID + initial job
            write_json(
                &mut writer,
                json!({
                    "id": req["id"].as_i64().unwrap(),
                    "result": {
                        "id": server_session_id,
                        "job": {
                            "blob": server_blob_hex,
                            "job_id": server_job_id,
                            "target": target_hex,
                            "height": height,
                            "seed_hash": server_seed_hash,
                        }
                    },
                    "error": null
                }),
            )
            .await;

            // CryptonoteStratum: submit request
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "submit");
            let params = &req["params"];
            assert_eq!(params["id"].as_str().unwrap(), session_id);
            assert_eq!(params["job_id"].as_str().unwrap(), job_id);
            // Nonce 0x1234abcd → 4-byte LE hex = "cdab3412"
            let nonce_hex = params["nonce"].as_str().unwrap();
            assert_eq!(nonce_hex.len(), 8, "XMR nonce must be 8 hex chars (4-byte LE)");
            assert_eq!(nonce_hex, "cdab3412");

            write_json(
                &mut writer,
                json!({
                    "id": req["id"].as_i64().unwrap(),
                    "result": {"status": "OK"},
                    "error": null
                }),
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
        // target_hex in ExternalJob is 32-byte LE hex encoding of the
        // expanded target (8-byte LE input → u64 → 32-byte LE).
        // Input "00ffffff00000000" → LE u64 = 0x00000000ffffff00
        // → 32-byte LE = "00ffffff00000000" + "00".repeat(24)
        let expected_target_hex = format!("{}{}", target_hex, "00".repeat(24));
        assert_eq!(job.target_hex, expected_target_hex);
        // Target bytes: first 8 bytes match the raw input.
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
            // nonce2 = full 32-byte Zcash Stratum nonce field minus extranonce1(4 bytes) = 28 bytes = 56 hex chars
            let nonce2 = params[3].as_str().unwrap();
            assert_eq!(nonce2.len(), 56, "nonce2 must be 28 bytes (56 hex chars) with 4-byte extranonce1 (standard 32-byte Zcash Stratum nonce field)");
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

    #[tokio::test]
    async fn zcl_zcashstratum_notify_and_submit() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        // ZCL ZcashStratum notify params (Equihash 192,7):
        // [job_id, version, prevhash, merkle, reserved, ntime, nbits, clean_jobs, solution]
        let job_id = "zcl_job_001";
        let version = "20000000";
        let prevhash = "ab".repeat(32);
        let merkle = "cd".repeat(32);
        let reserved = "00".repeat(32);
        let ntime = "65a3f1c0";
        let nbits = "1d00ffff";
        // ZCL Equihash 192,7 solution: 400 bytes = 800 hex chars
        let solution_hex = "ee".repeat(400);

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
            write_json(
                &mut writer,
                json!({"id": 1, "result": [["mining.notify", "session"], "a1b2c3d4"], "error": null}),
            )
            .await;

            // mining.authorize
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            assert_eq!(req["params"][1].as_str().unwrap(), "d=0.01");
            write_json(&mut writer, json!({"id": 2, "result": true, "error": null})).await;

            // mining.extranonce.subscribe
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
            assert_eq!(params.len(), 5, "ZCL submit must have 5 params");
            assert_eq!(params[1].as_str().unwrap(), job_id);
            assert_eq!(params[2].as_str().unwrap(), ntime);

            // nonce2 = 32 bytes total - extranonce1(4 bytes) = 28 bytes = 56 hex chars
            let nonce2 = params[3].as_str().unwrap();
            assert_eq!(nonce2.len(), 56, "ZCL nonce2 must be 28 bytes (56 hex chars) with 4-byte extranonce1");

            // For nonce=0x1234abcd, nonce2 should start with LE-encoded nonce (cdab3412)
            assert_eq!(&nonce2[..8], "cdab3412", "ZCL nonce2 must start with LE-encoded miner nonce");

            // solution_with_varint should start with "fd9001" (varint for 400 bytes)
            let solution = params[4].as_str().unwrap();
            assert!(solution.starts_with("fd9001"), "ZCL solution must start with varint fd9001 (400 bytes)");
            // Total: 6 (varint) + 800 (400 bytes hex) = 806 hex chars
            assert_eq!(solution.len(), 806, "ZCL solution_with_varint must be 806 hex chars (6 varint + 800 solution)");

            write_json(
                &mut writer,
                json!({"id": req["id"].as_i64().unwrap(), "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::ZCL);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("t1ZCLtestWallet123").await.unwrap();

        let job = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job.job_id, job_id);
        assert_eq!(job.external_coin, ExternalCoin::ZCL);
        assert_eq!(job.algorithm, "equihashzero");

        // Submit a share with a mock 400-byte Equihash solution in mix_hash_hex
        let mock_solution = "ee".repeat(400); // 400-byte solution
        let result = client.submit_share(job_id, 0x1234abcd, "deadbeef", Some(&mock_solution)).await.unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn rtm_5param_submit_format() {
        // RTM (zpool) uses standard Stratum v1 with 5 params:
        //   [worker, job_id, extranonce2, ntime, nonce]
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let job_id = "rtm_job_001";
        let ntime = "65a3f1c0";

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

            // mining.subscribe — return extranonce1 + extranonce2_size=4
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.subscribe");
            write_json(
                &mut writer,
                json!({"id": 1, "result": [["mining.notify", "session"], "80004e68", 4], "error": null}),
            )
            .await;

            // mining.authorize
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            write_json(&mut writer, json!({"id": 2, "result": true, "error": null})).await;

            // mining.set_difficulty
            write_json(
                &mut writer,
                json!({"id": null, "method": "mining.set_difficulty", "params": [0.02]}),
            )
            .await;

            // mining.notify (standard Stratum v1, 9 params)
            // [job_id, prevhash, coinbase1, coinbase2, merkle, version, nbits, ntime, clean_jobs]
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [
                        job_id, "c9c08930", "03000500", "2f7a706f",
                        "e4c3e24c", "20000000", "1e02cbbe", ntime, true
                    ]
                }),
            )
            .await;

            // mining.submit — must have 5 params
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.submit");
            let params = req["params"].as_array().unwrap();
            assert_eq!(params.len(), 5, "RTM submit must have 5 params");
            assert_eq!(params[1].as_str().unwrap(), job_id);
            assert_eq!(params[2].as_str().unwrap().len(), 8, "extranonce2 must be 4 bytes (8 hex)");
            assert_eq!(params[3].as_str().unwrap(), ntime);
            // nonce = 4-byte LE hex
            assert_eq!(params[4].as_str().unwrap().len(), 8, "nonce must be 4 bytes (8 hex)");

            write_json(
                &mut writer,
                json!({"id": req["id"].as_i64().unwrap(), "result": true, "error": null}),
            )
            .await;

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::RTM);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("yose144").await.unwrap();

        let job = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job.job_id, job_id);
        assert_eq!(job.external_coin, ExternalCoin::RTM);

        let result = client.submit_share(job_id, 0x1234abcd, "deadbeef", None).await.unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();
        server_task.await.unwrap();
    }

    /// E2E test: RTM GhostRider mining with real hash + share acceptance.
    ///
    /// This test:
    /// 1. Starts a mock stratum server
    /// 2. Connects RTM client (subscribe + authorize)
    /// 3. Server sends mining.set_difficulty (very low = easy target)
    /// 4. Server sends mining.notify with a valid 80-byte header
    /// 5. Client builds header from notify params (build_stratum_v1_header)
    /// 6. Client mines with real GhostRider hash (native-ghostrider feature)
    /// 7. When hash meets target, client submits share
    /// 8. Server verifies submit format (5 params, en2=00000000, nonce=4-byte LE)
    /// 9. Server accepts share
    #[tokio::test]
    async fn rtm_e2e_ghostrider_mine_and_submit() {
        // This test requires native-ghostrider feature for real hashing.
        // Without it, blake3 fallback won't produce valid GhostRider hashes.
        #[cfg(not(feature = "native-ghostrider"))]
        {
            println!("Skipping RTM E2E test — requires native-ghostrider feature");
            return;
        }

        use std::sync::{Arc, Mutex as StdMutex};

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let job_id = "rtm_e2e_001";
        let ntime_hex = format!("{:08x}", chrono::Utc::now().timestamp() as u32);
        let nbits_hex = "1e02cbbe"; // low difficulty bits

        // Valid RTM block header components (from zpool-style notify)
        // version=20000000, prevhash=32 bytes, coinbase1/coinbase2 = coinbase tx parts
        let version_hex = "20000000";
        let prevhash_hex = "c9c08930a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8";
        let coinbase1_hex = "030005000100000000000000000000000000000000000000000000000000000000000000ffffffff0a4d696e6564206279205a494f4effffffff";
        let coinbase2_hex = "2f7a706f6f6c00000000";
        let extranonce1_hex = "80004e68"; // 4-byte extranonce1

        // Very easy target: difficulty 0.0001 → target = 2^256 / 0.0001 ≈ huge
        // Use a target that GhostRider can meet in a few hundred nonces
        let share_difficulty = 0.0001_f64;

        // Track whether share was submitted
        let share_submitted = Arc::new(StdMutex::new(false));
        let share_submitted_clone = share_submitted.clone();

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

            async fn write_json(
                writer: &mut tokio::net::tcp::WriteHalf<'_>,
                v: Value,
            ) {
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
                json!({
                    "id": req["id"],
                    "result": [["mining.notify", "session"], extranonce1_hex, 4],
                    "error": null
                }),
            )
            .await;

            // mining.authorize
            let req = read_json(&mut reader, &mut buf).await;
            assert_eq!(req["method"], "mining.authorize");
            write_json(&mut writer, json!({"id": req["id"], "result": true, "error": null})).await;

            // mining.set_difficulty — very low difficulty = easy target
            write_json(
                &mut writer,
                json!({"id": null, "method": "mining.set_difficulty", "params": [share_difficulty]}),
            )
            .await;

            // mining.notify — 9 params (standard Stratum v1)
            write_json(
                &mut writer,
                json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [
                        job_id,
                        prevhash_hex,
                        coinbase1_hex,
                        coinbase2_hex,
                        [], // no merkle branches
                        version_hex,
                        nbits_hex,
                        ntime_hex,
                        true
                    ]
                }),
            )
            .await;

            // Wait for mining.submit (with timeout)
            let submit_req = tokio::time::timeout(
                Duration::from_secs(60),
                read_json(&mut reader, &mut buf),
            )
            .await;

            match submit_req {
                Ok(req) => {
                    assert_eq!(req["method"], "mining.submit");
                    let params = req["params"].as_array().unwrap();
                    assert_eq!(params.len(), 5, "RTM submit must have 5 params");
                    assert_eq!(params[1].as_str().unwrap(), job_id);
                    // extranonce2 must be "00000000" (fixed for CPU mining)
                    assert_eq!(params[2].as_str().unwrap(), "00000000",
                        "extranonce2 must be 00000000 for RTM CPU mining");
                    // ntime must match notify
                    assert_eq!(params[3].as_str().unwrap(), ntime_hex);
                    // nonce must be 4-byte LE hex (8 chars)
                    assert_eq!(params[4].as_str().unwrap().len(), 8,
                        "nonce must be 4 bytes (8 hex chars)");

                    *share_submitted_clone.lock().unwrap() = true;

                    // Accept the share
                    write_json(
                        &mut writer,
                        json!({"id": req["id"], "result": true, "error": null}),
                    )
                    .await;
                }
                Err(_) => panic!("Timeout waiting for mining.submit (60s)"),
            }

            tokio::time::sleep(Duration::from_millis(200)).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::RTM);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("yose144").await.unwrap();

        // Wait for job
        let job = client.wait_for_job(5000).await.unwrap().unwrap();
        assert_eq!(job.job_id, job_id);
        assert_eq!(job.external_coin, ExternalCoin::RTM);
        assert_eq!(job.header_bytes.len(), 80, "Header must be 80 bytes");

        // Mine with real GhostRider hash
        // The header is built with extranonce2=0, so we just scan PoW nonces
        #[cfg(feature = "native-ghostrider")]
        {
            zion_native_ffi::ghostrider::init();

            let header = &job.header_bytes;
            let target = &job.target_bytes;
            let nonce_offset = 76usize;
            let mut work_blob = header.clone();

            println!("rtm_e2e: header={} target={}..",
                hex::encode(&header[..16.min(header.len())]),
                hex::encode(&target[..8.min(target.len())]));

            let mut found_nonce: Option<u64> = None;
            let start = std::time::Instant::now();

            for nonce in 0u64..1_000_000 {
                let nonce_le = (nonce as u32).to_le_bytes();
                work_blob[nonce_offset..nonce_offset + 4].copy_from_slice(&nonce_le);

                let hash = zion_native_ffi::ghostrider::hash(&work_blob, nonce);

                if (hash[30] | hash[31]) == 0
                    && crate::external_hashers::meets_target_little_endian(&hash, target)
                {
                    found_nonce = Some(nonce);
                    println!("rtm_e2e: Found valid nonce={} in {:?} hash={}",
                        nonce, start.elapsed(), hex::encode(&hash));
                    break;
                }

                if nonce % 10000 == 0 && nonce > 0 {
                    println!("rtm_e2e: scanned {} nonces in {:?}...", nonce, start.elapsed());
                }
            }

            assert!(found_nonce.is_some(), "Should find valid nonce within 1M attempts");

            // Submit the share
            let nonce = found_nonce.unwrap();
            let hash_hex = "deadbeef".to_string(); // pool doesn't verify hash in submit
            let result = client.submit_share(job_id, nonce, &hash_hex, None).await.unwrap();
            assert_eq!(result, ShareResult::Accepted, "Share should be accepted");
        }

        client.disconnect().await.unwrap();

        // Verify share was submitted
        assert!(*share_submitted.lock().unwrap(), "Share should have been submitted");

        // Don't await server_task — it may have already finished
        drop(server_task);
    }

    #[test]
    fn protocol_mapping() {
        assert_eq!(ExternalCoin::DCR.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ALPH.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::KAS.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ETC.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::RVN.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::FLUX.protocol(), StratumProtocol::ZcashStratum);
        assert_eq!(ExternalCoin::XMR.protocol(), StratumProtocol::CryptonoteStratum);
        assert_eq!(ExternalCoin::ERG.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::EVR.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::MEWC.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::CLORE.protocol(), StratumProtocol::Stratum);
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

    #[test]
    fn verus_hash_diff1_round_trip() {
        // VerusHash uses a coin-specific difficulty-1 target. Difficulty 1
        // should map to the base target, and converting that base target back
        // should return difficulty 1.
        let target1 = difficulty_to_target_with_max(1.0, &VERUS_HASH_DIFF1);
        assert_eq!(target1, VERUS_HASH_DIFF1);

        let diff1 = target_to_difficulty_with_max(&VERUS_HASH_DIFF1, &VERUS_HASH_DIFF1);
        assert!((diff1 - 1.0).abs() < 1e-6);

        // At difficulty 2 the high byte should halve to 0x03.
        let target2 = difficulty_to_target_with_max(2.0, &VERUS_HASH_DIFF1);
        assert_eq!(target2[1], 0x03);

        // Diagnostic: what target does difficulty 8192 produce with Verus base?
        let target8192 = difficulty_to_target_with_max(8192.0, &VERUS_HASH_DIFF1);
        eprintln!("VERUS target for diff 8192 = {}", hex::encode(target8192));
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
