//! Native Quantus (QTC) mining source — hybrid leg next to the upstream
//! stratum bridge.
//!
//! Quantus mining is an *inverted* protocol: the node is the block author
//! (it builds the block, including the reward destination) and distributes
//! work to miners over a persistent QUIC stream on `--miner-listen-port`
//! (default 9833):
//!
//! ```text
//!   miner → node : Ready
//!   node → miner : NewJob { job_id, mining_hash, difficulty(U512 decimal) }
//!   miner → node : JobResult { status, job_id, nonce, work, hash_count, ... }
//! ```
//!
//! Wire format: 4-byte big-endian length + JSON payload on a single
//! bidirectional QUIC stream (ALPN `quantus-miner`, self-signed node cert —
//! custom verifier accepts anything, SNI "localhost").
//!
//! This module plays the *miner* role toward our own quantus-node: it turns
//! each `NewJob` into a `JobPackage` (share-difficulty target for miners) and
//! returns winning nonces as `JobResult` when a submitted share beats the
//! network target. Shares that meet the pool share target but not the
//! network target are credited in PPLNS only — the node only wants the
//! winning nonce.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use num_bigint::BigUint;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;

use zion_cosmic_harmony::ExternalCoin;
use zion_miner::auxpow::qpow;

use crate::auxpow_bridge::{JobPackage, MultiAuxPowBridge, ShareForwardOutcome};
use crate::share_forwarder::ShareForwardResult;

/// Prefix on `external_job_id` marking a job as served from the native node
/// (vs an upstream pool). Used by the share-forward path to route submissions.
pub const NATIVE_JOB_PREFIX: &str = "qtun:";

/// QUIC ALPN required by the quantus node miner protocol.
/// ALPN is versioned with the wire protocol in quantus-node ≥ v1.0.2-Qm:
/// `/2` = authenticated `Ready { token }` (bare `quantus-miner` = legacy).
const MINER_ALPN: &[u8] = b"quantus-miner/2";

/// Default share difficulty when `QTC_NATIVE_SHARE_DIFF` is unset. Chosen to
/// roughly match upstream k1pool QPoW share rates (~3e9) so existing miner
/// submit cadence is preserved.
const DEFAULT_SHARE_DIFF: u64 = 1_000_000_000;

/// Native jobs older than this are treated as stale (auto-fallback to the
/// upstream bridge). QPoW targets ~60s blocks; 90s covers one missed job.
const NATIVE_JOB_MAX_AGE: Duration = Duration::from_secs(90);

// ---------------------------------------------------------------------------
// Vendored protocol types (quantus `miner-api` crate — kept verbatim so the
// wire format stays compatible; ~80 lines vs a git dependency).
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum MinerMessage {
    /// Current protocol (miner-api v1.0.x): shared-secret token read from
    /// the node's `<base>/chains/<chain>/miner-auth-token` file.
    Ready { token: String },
    NewJob(MiningRequest),
    JobResult(MiningResult),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MiningRequest {
    pub job_id: String,
    /// Hex encoded header hash (32 bytes -> 64 chars, no 0x prefix).
    pub mining_hash: String,
    /// Network target (U512 decimal string — upstream calls it "difficulty").
    pub difficulty: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApiResponseStatus {
    Accepted,
    Running,
    Completed,
    Failed,
    Cancelled,
    NotFound,
    Error,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MiningResult {
    pub status: ApiResponseStatus,
    pub job_id: String,
    /// U512 nonce as hex (no 0x, leading zeros stripped).
    pub nonce: Option<String>,
    /// Winning nonce as 64-byte hex (128 chars, no 0x) — primary verify field.
    pub work: Option<String>,
    pub hash_count: u64,
    pub elapsed_time: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub miner_id: Option<u64>,
}

const MAX_MESSAGE_SIZE: u32 = 16 * 1024 * 1024;

async fn write_message(
    w: &mut (impl tokio::io::AsyncWrite + Unpin),
    msg: &MinerMessage,
) -> std::io::Result<()> {
    let json = serde_json::to_vec(msg)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    w.write_all(&(json.len() as u32).to_be_bytes()).await?;
    w.write_all(&json).await?;
    w.flush().await
}

async fn read_message(
    r: &mut (impl tokio::io::AsyncRead + Unpin),
) -> std::io::Result<MinerMessage> {
    use tokio::io::AsyncReadExt;
    let mut len_buf = [0u8; 4];
    r.read_exact(&mut len_buf).await?;
    let len = u32::from_be_bytes(len_buf);
    if len > MAX_MESSAGE_SIZE {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("message size {len} exceeds maximum"),
        ));
    }
    let mut buf = vec![0u8; len as usize];
    r.read_exact(&mut buf).await?;
    serde_json::from_slice(&buf)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct QtcNativeConfig {
    /// `host:port` of the quantus-node miner listener (QUIC server).
    pub node_addr: SocketAddr,
    /// Miner auth token — required by miner-api ≥ v1.0 (`Ready { token }`).
    /// Read from `QTC_NATIVE_TOKEN` or `QTC_NATIVE_TOKEN_FILE` (the node's
    /// `<base>/chains/mainnet/miner-auth-token` file, mode 0600).
    pub token: String,
    /// Percentage of QTU external-job broadcasts served from the native leg
    /// (0–100). The rest fall back to the upstream bridge (k1pool/qelvhash).
    pub share_pct: u8,
    /// Share difficulty for native jobs → share target = (2^512-1)/diff.
    pub share_diff: u64,
}

impl QtcNativeConfig {
    /// Enabled only when explicitly configured:
    ///   QTC_NATIVE_ENABLED=1
    ///   QTC_NATIVE_NODE_ADDR=<host:port>          (e.g. 127.0.0.1:9833)
    ///   QTC_NATIVE_TOKEN=<token>                  (or _FILE path)
    ///   QTC_NATIVE_TOKEN_FILE=<path>              (node miner-auth-token)
    ///   QTC_NATIVE_SHARE_PCT=<0-100>              (default 0)
    ///   QTC_NATIVE_SHARE_DIFF=<n>                 (default 1e9)
    pub fn from_env() -> Option<Self> {
        if std::env::var("QTC_NATIVE_ENABLED").ok().as_deref() != Some("1") {
            return None;
        }
        let node_addr: SocketAddr = std::env::var("QTC_NATIVE_NODE_ADDR")
            .ok()?
            .parse()
            .ok()?;
        let token = std::env::var("QTC_NATIVE_TOKEN")
            .ok()
            .or_else(|| {
                std::env::var("QTC_NATIVE_TOKEN_FILE").ok().and_then(|p| {
                    match std::fs::read_to_string(&p) {
                        Ok(s) => Some(s.trim().to_string()),
                        Err(e) => {
                            tracing::warn!("qtc_native: cannot read token file {p}: {e}");
                            None
                        }
                    }
                })
            })
            .unwrap_or_default();
        let share_pct = std::env::var("QTC_NATIVE_SHARE_PCT")
            .ok()
            .and_then(|v| v.parse::<u8>().ok())
            .unwrap_or(0)
            .min(100);
        let share_diff = std::env::var("QTC_NATIVE_SHARE_DIFF")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|d| *d > 0)
            .unwrap_or(DEFAULT_SHARE_DIFF);
        Some(Self {
            node_addr,
            token,
            share_pct,
            share_diff,
        })
    }
}

// ---------------------------------------------------------------------------
// Native job verification context (kept per served job for share validation)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct NativeJobCtx {
    /// Raw node job id (without `qtun:` prefix) — echoed back in JobResult.
    pub raw_job_id: String,
    pub header: [u8; 32],
    /// Network target from the node (`difficulty` field) as 64B BE.
    pub net_target: [u8; 64],
    /// Share target served to miners (64B BE).
    pub share_target: [u8; 64],
    /// Whether this job is served to miners (decided once at push time:
    /// `job_seq % 100 < share_pct` — every miner gets the same source per
    /// block, so `share_pct` is the share of blocks mined natively).
    pub serve_native: bool,
    pub received_at: Instant,
    pub shares_forwarded: u64,
}

/// Shared mutable state owned by `MultiAuxPowBridge`.
pub struct NativeQtcState {
    pub enabled: bool,
    pub share_pct: u8,
    /// Monotonic counter of native jobs seen — decides `serve_native` per
    /// job (`seq % 100 < share_pct`), so the split is per-block, not per
    /// request (keeps the broadcast fingerprint stable).
    job_seq: u64,
    jobs: std::collections::VecDeque<JobPackage>,
    ctx: HashMap<String, NativeJobCtx>,
    result_tx: Option<mpsc::UnboundedSender<MiningResult>>,
    connected: bool,
}

impl Default for NativeQtcState {
    fn default() -> Self {
        Self {
            enabled: false,
            share_pct: 0,
            job_seq: 0,
            jobs: std::collections::VecDeque::new(),
            ctx: HashMap::new(),
            result_tx: None,
            connected: false,
        }
    }
}

impl NativeQtcState {
    pub fn configure(&mut self, tx: mpsc::UnboundedSender<MiningResult>, share_pct: u8) {
        self.result_tx = Some(tx);
        self.share_pct = share_pct;
        self.enabled = true;
    }

    pub fn push_job(&mut self, pkg: JobPackage, mut ctx: NativeJobCtx) {
        if self.jobs.len() >= 20 {
            if let Some(old) = self.jobs.pop_front() {
                self.ctx.remove(&old.external_job_id);
            }
        }
        ctx.serve_native = self.job_seq % 100 < self.share_pct as u64;
        self.job_seq = self.job_seq.wrapping_add(1);
        self.ctx.insert(pkg.external_job_id.clone(), ctx);
        self.jobs.push_back(pkg);
    }

    pub fn latest_job(&self) -> Option<JobPackage> {
        self.jobs.back().cloned()
    }

    /// Native job for the current broadcast — only when the latest job is
    /// fresh AND was selected at push time (`seq % 100 < share_pct`). Stale
    /// native or unselected jobs return None → upstream fallback.
    pub fn pick_job(&self) -> Option<JobPackage> {
        if !self.enabled {
            return None;
        }
        let job = self.jobs.back()?;
        let fresh = job
            .received_at
            .map(|t| t.elapsed() <= NATIVE_JOB_MAX_AGE)
            .unwrap_or(false);
        if !fresh {
            return None;
        }
        self.ctx
            .get(&job.external_job_id)
            .filter(|c| c.serve_native)
            .map(|_| job.clone())
    }

    pub fn job_ctx(&self, job_id: &str) -> Option<NativeJobCtx> {
        self.ctx.get(job_id).cloned()
    }

    /// Set by the QUIC task on connect/disconnect — dashboard signal only.
    pub fn set_connected(&mut self, v: bool) {
        self.connected = v;
    }

    /// `(enabled, connected, share_pct, latest_job_id, latest_job_age_ms)` —
    /// condensed status for `/stats`/`auxpow` coin_details.
    pub fn status(&self) -> (bool, bool, u8, Option<String>, Option<u64>) {
        let (job_id, age_ms) = match self.jobs.back() {
            Some(j) => (
                Some(j.external_job_id.clone()),
                j.received_at.map(|t| t.elapsed().as_millis() as u64),
            ),
            None => (None, None),
        };
        (self.enabled, self.connected, self.share_pct, job_id, age_ms)
    }

    pub fn job_by_id(&self, job_id: &str) -> Option<JobPackage> {
        self.jobs
            .iter()
            .find(|j| j.external_job_id == job_id)
            .cloned()
    }

    /// Validate a miner submission against a native job: the full 64B nonce
    /// is hashed and compared to the share target (PPLNS credit) and, when
    /// it also beats the network target, a `JobResult` is queued for the node.
    pub fn submit_share(&mut self, job_id: &str, nonce_hex: &str) -> ShareForwardOutcome {
        let Some(ctx) = self.ctx.get_mut(job_id) else {
            return ShareForwardOutcome::Result(ShareForwardResult::Rejected(
                "unknown native job".to_string(),
            ));
        };
        let Some(nonce) = parse_nonce64(nonce_hex) else {
            return ShareForwardOutcome::Result(ShareForwardResult::Rejected(
                "bad nonce".to_string(),
            ));
        };
        let hash = qpow::get_nonce_hash(&ctx.header, &nonce);
        if hash.as_slice() >= ctx.share_target.as_slice() {
            return ShareForwardOutcome::Result(ShareForwardResult::BelowTarget);
        }
        ctx.shares_forwarded += 1;
        let tx = self.result_tx.clone();
        if hash.as_slice() < ctx.net_target.as_slice() {
            let nonce_u512_hex = format!("{:x}", BigUint::from_bytes_be(&nonce));
            let result = MiningResult {
                status: ApiResponseStatus::Completed,
                job_id: ctx.raw_job_id.clone(),
                nonce: Some(nonce_u512_hex),
                work: Some(hex::encode(nonce)),
                hash_count: ctx.shares_forwarded,
                elapsed_time: ctx.received_at.elapsed().as_secs_f64(),
                miner_id: None,
            };
            match tx {
                Some(tx) if tx.send(result).is_ok() => {
                    tracing::info!(
                        "qtc_native: job {} block nonce submitted to node",
                        ctx.raw_job_id
                    );
                }
                _ => {
                    tracing::warn!(
                        "qtc_native: winning nonce for job {} — result channel closed",
                        ctx.raw_job_id
                    );
                }
            }
        }
        ShareForwardOutcome::Result(ShareForwardResult::Accepted)
    }
}

// ---------------------------------------------------------------------------
// QUIC client task
// ---------------------------------------------------------------------------

/// Spawn the native Quantus source when `QTC_NATIVE_ENABLED=1`. Returns the
/// `JoinHandle` so callers can keep it; registers the result channel on the
/// bridge so share submissions can reach the node.
pub fn maybe_spawn(bridge: &MultiAuxPowBridge) -> Option<tokio::task::JoinHandle<()>> {
    let cfg = QtcNativeConfig::from_env()?;
    let (result_tx, result_rx) = mpsc::unbounded_channel();
    bridge.configure_native(result_tx, cfg.share_pct);
    let bridge = bridge.clone();
    Some(tokio::spawn(async move {
        run(cfg, bridge, result_rx).await;
    }))
}

async fn run(
    cfg: QtcNativeConfig,
    bridge: MultiAuxPowBridge,
    mut result_rx: mpsc::UnboundedReceiver<MiningResult>,
) {
    let mut backoff = Duration::from_secs(1);
    const MAX_BACKOFF: Duration = Duration::from_secs(60);
    loop {
        match run_connection(&cfg, &bridge, &mut result_rx).await {
            Ok(()) => tracing::warn!("qtc_native: connection ended — reconnecting"),
            Err(e) => tracing::warn!("qtc_native: {e} — reconnecting in {backoff:?}"),
        }
        bridge.set_native_connected(false);
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
}

async fn run_connection(
    cfg: &QtcNativeConfig,
    bridge: &MultiAuxPowBridge,
    result_rx: &mut mpsc::UnboundedReceiver<MiningResult>,
) -> anyhow::Result<()> {
    let connection = connect(cfg.node_addr).await?;
    let (mut send, mut recv) = connection.open_bi().await?;
    write_message(
        &mut send,
        &MinerMessage::Ready {
            token: cfg.token.clone(),
        },
    )
    .await?;
    tracing::info!("qtc_native: connected to {}", cfg.node_addr);
    bridge.set_native_connected(true);

    loop {
        tokio::select! {
            biased;
            reason = connection.closed() => {
                anyhow::bail!("connection closed: {reason}");
            }
            msg = read_message(&mut recv) => {
                match msg? {
                    MinerMessage::NewJob(req) => handle_new_job(bridge, &req, cfg.share_diff),
                    _ => {}
                }
            }
            Some(result) = result_rx.recv() => {
                write_message(&mut send, &MinerMessage::JobResult(result)).await?;
            }
        }
    }
}

fn handle_new_job(bridge: &MultiAuxPowBridge, req: &MiningRequest, share_diff: u64) {
    let Some(header) = decode_hex32(&req.mining_hash) else {
        tracing::warn!("qtc_native: bad mining_hash in job {}", req.job_id);
        return;
    };
    let Some(net_target) = dec_to_be64(&req.difficulty) else {
        tracing::warn!("qtc_native: bad difficulty in job {}", req.job_id);
        return;
    };
    let share_target = share_target_from_diff(share_diff);
    let external_job_id = format!("{NATIVE_JOB_PREFIX}{}", req.job_id);
    let pkg = JobPackage {
        external_job_id: external_job_id.clone(),
        coin: ExternalCoin::Quantus,
        header_hex: req.mining_hash.clone(),
        target_hex: hex::encode(share_target),
        height: 0,
        algorithm: "qpow-poseidon2".to_string(),
        // One random extranonce per job — same model as upstream (all miners
        // on this job share the prefix and scan the low nonce bits).
        extranonce1_hex: hex::encode(rand_bytes()),
        ntime: String::new(),
        seed_hash_hex: String::new(),
        received_at: Some(Instant::now()),
    };
    let ctx = NativeJobCtx {
        raw_job_id: req.job_id.clone(),
        header,
        net_target,
        share_target,
        serve_native: false, // decided in push_job
        received_at: Instant::now(),
        shares_forwarded: 0,
    };
    tracing::info!(
        "qtc_native: new job {} (net_target {}…{})",
        external_job_id,
        &hex::encode(&net_target[..4]),
        &hex::encode(&net_target[60..]),
    );
    bridge.push_native_job(pkg, ctx);
}

// ---------------------------------------------------------------------------
// QUIC plumbing
// ---------------------------------------------------------------------------

async fn connect(addr: SocketAddr) -> anyhow::Result<quinn::Connection> {
    // Explicit provider: quinn pulls aws-lc-rs while the pool pins ring —
    // ClientConfig::builder() panics when both are compiled in.
    let mut crypto = rustls::ClientConfig::builder_with_provider(Arc::new(
        rustls::crypto::ring::default_provider(),
    ))
    .with_safe_default_protocol_versions()?
    .dangerous()
    .with_custom_certificate_verifier(Arc::new(InsecureCertVerifier))
    .with_no_client_auth();
    crypto.alpn_protocols = vec![MINER_ALPN.to_vec()];

    let mut client_config = quinn::ClientConfig::new(Arc::new(
        quinn::crypto::rustls::QuicClientConfig::try_from(crypto)?,
    ));
    let mut transport = quinn::TransportConfig::default();
    transport.keep_alive_interval(Some(Duration::from_secs(5)));
    transport.max_idle_timeout(Some(Duration::from_secs(15).try_into()?));
    client_config.transport_config(Arc::new(transport));

    let mut endpoint = quinn::Endpoint::client("0.0.0.0:0".parse()?)?;
    endpoint.set_default_client_config(client_config);
    Ok(endpoint.connect(addr, "localhost")?.await?)
}

#[derive(Debug)]
struct InsecureCertVerifier;

impl rustls::client::danger::ServerCertVerifier for InsecureCertVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ED25519,
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA256,
        ]
    }
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/// Decimal string → 64-byte big-endian (U512). Returns None on overflow.
pub fn dec_to_be64(dec: &str) -> Option<[u8; 64]> {
    let v = BigUint::parse_bytes(dec.as_bytes(), 10)?;
    let bytes = v.to_bytes_be();
    if bytes.len() > 64 {
        return None;
    }
    let mut out = [0u8; 64];
    out[64 - bytes.len()..].copy_from_slice(&bytes);
    Some(out)
}

/// Share target = (2^512 − 1) / diff, as 64B BE.
pub fn share_target_from_diff(diff: u64) -> [u8; 64] {
    let max = BigUint::from_bytes_be(&[0xFFu8; 64]);
    let t = max / BigUint::from(diff.max(1));
    let bytes = t.to_bytes_be();
    let mut out = [0u8; 64];
    out[64 - bytes.len().min(64)..].copy_from_slice(&bytes[..bytes.len().min(64)]);
    out
}

/// Miner nonce hex → 64B BE. Accepts 128-char full-width hex; shorter hex is
/// right-aligned (low nonce bits).
fn parse_nonce64(nonce_hex: &str) -> Option<[u8; 64]> {
    qpow::biguint_from_hex::<64>(nonce_hex)
}

fn decode_hex32(s: &str) -> Option<[u8; 32]> {
    qpow::biguint_from_hex::<32>(s)
}

fn rand_bytes() -> [u8; 4] {
    use std::time::{SystemTime, UNIX_EPOCH};
    // Extranonces only need uniqueness per job, not secrecy — time+pid mix
    // avoids a new RNG dependency.
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or_default();
    let v = nanos ^ (std::process::id() as u64) << 32;
    v.to_be_bytes()[..4].try_into().unwrap_or([0; 4])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dec_to_be64_parses_u512_decimal() {
        // 2^512 - 1
        let max_dec = BigUint::from_bytes_be(&[0xFFu8; 64]).to_string();
        assert_eq!(dec_to_be64(&max_dec), Some([0xFFu8; 64]));
        assert_eq!(dec_to_be64("0"), Some([0u8; 64]));
        assert_eq!(dec_to_be64("1").unwrap()[63], 1);
        // Overflow (2^512) → None
        let too_big = (BigUint::from_bytes_be(&[0xFFu8; 64]) + 1u32).to_string();
        assert_eq!(dec_to_be64(&too_big), None);
    }

    #[test]
    fn share_target_scales_with_diff() {
        let t1 = share_target_from_diff(1);
        assert_eq!(t1, [0xFFu8; 64]);
        let t2 = share_target_from_diff(2);
        // (2^512-1)/2 = 0x7FFF...FF
        assert_eq!(t2[0], 0x7F);
        let t_big = share_target_from_diff(1_000_000_000);
        assert!(t_big.as_slice() < t2.as_slice());
    }

    #[test]
    fn submit_share_validates_and_forwards_block() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut st = NativeQtcState::default();
        st.configure(tx, 100);
        // Zero header, nonce 0 → KAT hash; craft targets around it.
        let header = [0u8; 32];
        let nonce = [0u8; 64];
        let hash = qpow::get_nonce_hash(&header, &nonce);
        let mut share_target = [0u8; 64];
        share_target.copy_from_slice(&hash);
        // share_target = hash → hash < target fails (strict less-than); bump by 1.
        share_target[63] = share_target[63].wrapping_add(1);
        let mut net_target = share_target;
        net_target[63] = net_target[63].wrapping_sub(1); // net_target = hash
        st.push_job(
            JobPackage {
                external_job_id: "qtun:7".into(),
                coin: ExternalCoin::Quantus,
                header_hex: hex::encode(header),
                target_hex: hex::encode(share_target),
                height: 0,
                algorithm: "qpow-poseidon2".into(),
                extranonce1_hex: "01020304".into(),
                ntime: String::new(),
                seed_hash_hex: String::new(),
                received_at: Some(Instant::now()),
            },
            NativeJobCtx {
                raw_job_id: "7".into(),
                header,
                net_target,
                share_target,
                serve_native: true,
                received_at: Instant::now(),
                shares_forwarded: 0,
            },
        );
        // hash == net_target → accepted as share, but NOT forwarded (strict <).
        match st.submit_share("qtun:7", &hex::encode(nonce)) {
            ShareForwardOutcome::Result(ShareForwardResult::Accepted) => {}
            other => panic!("expected Accepted, got {other:?}"),
        }
        assert!(rx.try_recv().is_err());
        // Below share target → reject.
        st.ctx.get_mut("qtun:7").unwrap().share_target = [0u8; 64];
        match st.submit_share("qtun:7", &hex::encode(nonce)) {
            ShareForwardOutcome::Result(ShareForwardResult::BelowTarget) => {}
            other => panic!("expected BelowTarget, got {other:?}"),
        }
    }

    #[test]
    fn submit_share_forwards_winning_nonce() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let mut st = NativeQtcState::default();
        st.configure(tx, 100);
        let ctx = NativeJobCtx {
            raw_job_id: "42".into(),
            header: [0u8; 32],
            net_target: [0xFFu8; 64], // everything wins
            share_target: [0xFFu8; 64],
            serve_native: true,
            received_at: Instant::now(),
            shares_forwarded: 0,
        };
        st.push_job(
            JobPackage {
                external_job_id: "qtun:42".into(),
                coin: ExternalCoin::Quantus,
                header_hex: String::new(),
                target_hex: String::new(),
                height: 0,
                algorithm: "qpow-poseidon2".into(),
                extranonce1_hex: String::new(),
                ntime: String::new(),
                seed_hash_hex: String::new(),
                received_at: None,
            },
            ctx,
        );
        match st.submit_share("qtun:42", &hex::encode([7u8; 64])) {
            ShareForwardOutcome::Result(ShareForwardResult::Accepted) => {}
            other => panic!("expected Accepted, got {other:?}"),
        }
        let res = rx.try_recv().expect("JobResult expected");
        assert_eq!(res.job_id, "42");
        assert_eq!(res.status, ApiResponseStatus::Completed);
        assert_eq!(res.work.as_deref(), Some(hex::encode([7u8; 64]).as_str()));
    }

    #[test]
    fn pick_job_respects_pct_and_freshness() {
        let mut st = NativeQtcState::default();
        st.enabled = true;
        st.share_pct = 25;
        let pkg = |id: &str, age: Option<Duration>| JobPackage {
            external_job_id: id.into(),
            coin: ExternalCoin::Quantus,
            header_hex: String::new(),
            target_hex: String::new(),
            height: 0,
            algorithm: String::new(),
            extranonce1_hex: String::new(),
            ntime: String::new(),
            seed_hash_hex: String::new(),
            received_at: age.map(|a| Instant::now() - a),
        };
        let ctx = |id: &str| NativeJobCtx {
            raw_job_id: id.into(),
            header: [0u8; 32],
            net_target: [0u8; 64],
            share_target: [0u8; 64],
            serve_native: false,
            received_at: Instant::now(),
            shares_forwarded: 0,
        };
        // No job → None even at pct>0.
        assert!(st.pick_job().is_none());
        // Stale job → None (auto-fallback path).
        st.push_job(pkg("qtun:old", Some(Duration::from_secs(300))), ctx("old"));
        assert!(st.pick_job().is_none());
        // job_seq=1 → 1 % 100 < 25 → serve_native; the same fresh job picked
        // consistently on every call (fingerprint-safe).
        st.push_job(pkg("qtun:new", Some(Duration::from_secs(1))), ctx("new"));
        for _ in 0..10 {
            assert_eq!(st.pick_job().unwrap().external_job_id, "qtun:new");
        }
        // Pushing jobs until seq % 100 == 25 → unselected → upstream fallback.
        for i in 2..=25 {
            st.push_job(pkg(&format!("qtun:{i}"), Some(Duration::from_secs(1))), ctx("x"));
        }
        assert!(st.pick_job().is_none());
        // Disabled → None.
        st.enabled = false;
        st.job_seq = 0;
        st.push_job(pkg("qtun:z", Some(Duration::from_secs(1))), ctx("z"));
        assert!(st.pick_job().is_none());
    }
}
