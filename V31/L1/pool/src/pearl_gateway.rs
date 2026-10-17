//! Pearl gateway JSON-RPC client + job poller.
//!
//! `pearl-gateway`'s miner_rpc server speaks line-delimited JSON-RPC 2.0 over
//! TCP (`getMiningInfo`, `submitPlainProof`). The pool polls `getMiningInfo`,
//! re-serves jobs to V3 miners as `external_stream` entries (coin `PRL`), and
//! forwards block-meeting proofs back via `submitPlainProof`.
//!
//! Env:
//!   `ZION_POOL_PEARL_GATEWAY`      — `host:port` of the gateway miner_rpc
//!                                    (e.g. `127.0.0.1:8787`). Unset = disabled.
//!   `ZION_POOL_PEARL_POLL_MS`      — poll interval (default 2000).
//!   `ZION_POOL_PEARL_SHARE_EASE`   — share-target multiplier over the block
//!                                    target (default 256 — shares are 256x
//!                                    easier than a Pearl block).
//!   `ZION_POOL_PEARL_JOB_TTL_MS`   — drop served jobs older than this
//!                                    (default 30000).

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use num_bigint::BigUint;
use std::sync::{Mutex, RwLock};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::Semaphore;

use crate::pearl::{decode_plain_proof, verify_pearl_share, PearlJob, PearlShareOutcome};
use crate::pearl_upstream::{PearlUpstream, UpstreamPearlJob, UpstreamSubmitReply};
use crate::v3_protocol::ExternalStreamJob;

const DEFAULT_POLL_MS: u64 = 2_000;
const DEFAULT_JOB_TTL_MS: u64 = 30_000;
const DEFAULT_SHARE_EASE: u32 = 256;

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(default)
}

struct SeenJackpots {
    order: VecDeque<String>,
    jackpots: HashMap<String, HashSet<[u8; 32]>>,
}

impl SeenJackpots {
    fn claim(&mut self, served_id: &str, jackpot: [u8; 32]) -> std::result::Result<(), PearlSubmitError> {
        let set = match self.jackpots.get_mut(served_id) {
            Some(s) => s,
            None => {
                if self.order.len() >= SEEN_JOB_IDS_CAP {
                    if let Some(old) = self.order.pop_front() {
                        self.jackpots.remove(&old);
                    }
                }
                self.order.push_back(served_id.to_string());
                self.jackpots.entry(served_id.to_string()).or_default()
            }
        };
        if set.contains(&jackpot) {
            return Err(PearlSubmitError::Duplicate);
        }
        if set.len() >= SEEN_JACKPOTS_CAP {
            return Err(PearlSubmitError::Busy);
        }
        set.insert(jackpot);
        Ok(())
    }
}

const SEEN_JOB_IDS_CAP: usize = 8;
const SEEN_JACKPOTS_CAP: usize = 65_536;
const VERIFY_PERMITS: usize = 2;
const MAX_PROOF_B64_CHARS: usize = 2_500_000;

#[derive(Debug)]
pub enum PearlSubmitError {
    Stale,
    Busy,
    Duplicate,
    Invalid(String),
    Internal(String),
}

impl PearlSubmitError {
    pub fn status(&self) -> String {
        match self {
            Self::Stale => "stale".to_string(),
            Self::Busy => "busy".to_string(),
            Self::Duplicate => "duplicate".to_string(),
            Self::Invalid(msg) => {
                format!("rejected:{}", msg.chars().take(80).collect::<String>())
            }
            Self::Internal(msg) => {
                tracing::warn!("pearl verify internal failure: {msg}");
                "verify_failed".to_string()
            }
        }
    }
}

#[derive(Clone)]
pub struct PearlRuntime {
    addr: String,
    latest: Arc<RwLock<Option<(PearlJob, Instant, bool)>>>,
    share_ease: u64,
    job_ttl: Duration,
    poll_interval: Duration,
    started: Arc<AtomicBool>,
    verify_permits: Arc<Semaphore>,
    seen: Arc<Mutex<SeenJackpots>>,
    upstream: Option<Arc<PearlUpstream>>,
    native_pct: u8,
    job_seq: Arc<AtomicU64>,
    served_native: Arc<AtomicUsize>,
    served_upstream: Arc<AtomicUsize>,
}

impl std::fmt::Debug for PearlRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PearlRuntime")
            .field("addr", &self.addr)
            .field("share_ease", &self.share_ease)
            .finish_non_exhaustive()
    }
}

impl PearlRuntime {
    fn with_params(
        addr: String,
        share_ease: u64,
        job_ttl: Duration,
        poll_interval: Duration,
        upstream: Option<Arc<PearlUpstream>>,
        native_pct: u8,
    ) -> Self {
        Self {
            addr,
            latest: Arc::new(RwLock::new(None)),
            share_ease,
            job_ttl,
            poll_interval,
            started: Arc::new(AtomicBool::new(false)),
            verify_permits: Arc::new(Semaphore::new(VERIFY_PERMITS)),
            seen: Arc::new(Mutex::new(SeenJackpots {
                order: VecDeque::new(),
                jackpots: HashMap::new(),
            })),
            upstream,
            native_pct,
            // Seed from the clock: starting at 0 would flag the first template
            // after every pool restart as native whenever native_pct > 0.
            job_seq: Arc::new(AtomicU64::new(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.subsec_nanos() as u64)
                    .unwrap_or(0),
            )),
            served_native: Arc::new(AtomicUsize::new(0)),
            served_upstream: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// `Some` when `ZION_POOL_PEARL_GATEWAY` names a `host:port` endpoint.
    pub fn from_env() -> Option<Arc<Self>> {
        let addr = std::env::var("ZION_POOL_PEARL_GATEWAY")
            .ok()
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        let upstream = PearlUpstream::from_env();
        if addr.is_empty() && upstream.is_none() {
            return None;
        }
        let native_pct = std::env::var("ZION_POOL_PEARL_NATIVE_PCT")
            .ok()
            .and_then(|v| v.trim().parse::<u8>().ok())
            .unwrap_or(100)
            .min(100);
        Some(Arc::new(Self::with_params(
            addr,
            env_u64("ZION_POOL_PEARL_SHARE_EASE", DEFAULT_SHARE_EASE as u64),
            Duration::from_millis(env_u64("ZION_POOL_PEARL_JOB_TTL_MS", DEFAULT_JOB_TTL_MS)),
            Duration::from_millis(env_u64("ZION_POOL_PEARL_POLL_MS", DEFAULT_POLL_MS)),
            upstream,
            native_pct,
        )))
    }

    pub fn ensure_started(self: &Arc<Self>) -> bool {
        if self
            .started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            if !self.addr.is_empty() {
                let rt = Arc::clone(self);
                tokio::spawn(async move { rt.run().await });
            }
            if let Some(up) = &self.upstream {
                up.ensure_started();
            }
            true
        } else {
            false
        }
    }

    pub async fn verify_submission(
        self: &Arc<Self>,
        job_id: &str,
        proof_b64: &str,
    ) -> std::result::Result<(PearlJob, PearlShareOutcome), PearlSubmitError> {
        let Some(job) = self.job_for_submit(job_id) else {
            return Err(PearlSubmitError::Stale);
        };
        if proof_b64.len() > MAX_PROOF_B64_CHARS {
            return Err(PearlSubmitError::Invalid(format!(
                "plain_proof exceeds {MAX_PROOF_B64_CHARS} base64 chars"
            )));
        }
        let permit = self
            .verify_permits
            .clone()
            .try_acquire_owned()
            .map_err(|_| PearlSubmitError::Busy)?;
        let job_verify = job.clone();
        let share_target = self.share_target(&job);
        let proof_b64 = proof_b64.to_string();
        let outcome = tokio::task::spawn_blocking(move || {
            use base64::Engine as _;
            let _permit = permit;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&proof_b64)
                .context("plain_proof base64")?;
            let proof = decode_plain_proof(&bytes).context("plain_proof decode")?;
            verify_pearl_share(&proof, &job_verify, &share_target)
        })
        .await
        .map_err(|e| PearlSubmitError::Internal(format!("verify task join: {e:#}")))?
        .map_err(|e| PearlSubmitError::Invalid(format!("{e:#}")))?;

        self.claim_verified(job_id, &job, outcome.jackpot_hash)?;
        Ok((job, outcome))
    }

    fn claim(&self, served_id: &str, jackpot: [u8; 32]) -> std::result::Result<(), PearlSubmitError> {
        self.seen.lock().unwrap().claim(served_id, jackpot)
    }

    fn claim_verified(
        &self,
        job_id: &str,
        expected: &PearlJob,
        jackpot: [u8; 32],
    ) -> std::result::Result<(), PearlSubmitError> {
        let guard = self.latest.read().unwrap();
        let current = match guard.as_ref() {
            Some((j, t, _)) if t.elapsed() <= self.job_ttl => j,
            _ => return Err(PearlSubmitError::Stale),
        };
        if Self::job_id(current) != job_id
            || current.header != expected.header
            || current.target != expected.target
            || current.cert_version != expected.cert_version
        {
            return Err(PearlSubmitError::Stale);
        }
        self.claim(job_id, jackpot)
    }

    fn claim_upstream_verified(
        &self,
        served_id: &str,
        jackpot: [u8; 32],
    ) -> std::result::Result<(), PearlSubmitError> {
        let Some(upstream) = &self.upstream else {
            return Err(PearlSubmitError::Stale);
        };
        if upstream.job_by_served_id(served_id).is_none() {
            return Err(PearlSubmitError::Stale);
        }
        self.claim(served_id, jackpot)
    }

    pub async fn verify_upstream_submission(
        self: &Arc<Self>,
        served_id: &str,
        proof_b64: &str,
    ) -> std::result::Result<(UpstreamPearlJob, PearlShareOutcome), PearlSubmitError> {
        let Some(upstream) = &self.upstream else {
            return Err(PearlSubmitError::Stale);
        };
        let Some(ujob) = upstream.job_by_served_id(served_id) else {
            return Err(PearlSubmitError::Stale);
        };
        if proof_b64.len() > MAX_PROOF_B64_CHARS {
            return Err(PearlSubmitError::Invalid(format!(
                "plain_proof exceeds {MAX_PROOF_B64_CHARS} base64 chars"
            )));
        }
        let permit = self
            .verify_permits
            .clone()
            .try_acquire_owned()
            .map_err(|_| PearlSubmitError::Busy)?;
        let target = BigUint::from_bytes_be(&ujob.target_be);
        let job_verify = PearlJob {
            header: ujob.header,
            target: target.clone(),
            cert_version: ujob.cert_version,
            header_b64: {
                use base64::Engine as _;
                base64::engine::general_purpose::STANDARD.encode(ujob.header)
            },
            target_dec: target.to_string(),
        };
        let proof_b64 = proof_b64.to_string();
        let outcome = tokio::task::spawn_blocking(move || {
            use base64::Engine as _;
            let _permit = permit;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&proof_b64)
                .context("plain_proof base64")?;
            let proof = decode_plain_proof(&bytes).context("plain_proof decode")?;
            verify_pearl_share(&proof, &job_verify, &target)
        })
        .await
        .map_err(|e| PearlSubmitError::Internal(format!("verify task join: {e:#}")))?
        .map_err(|e| PearlSubmitError::Invalid(format!("{e:#}")))?;

        self.claim_upstream_verified(served_id, outcome.jackpot_hash)?;
        Ok((ujob, outcome))
    }

    pub async fn upstream_submit(
        &self,
        ujob: &UpstreamPearlJob,
        proof_b64: &str,
        hs: Option<u64>,
    ) -> UpstreamSubmitReply {
        match &self.upstream {
            Some(up) => up.submit(&ujob.served_id, &ujob.raw_id, proof_b64, hs).await,
            None => UpstreamSubmitReply::Unknown,
        }
    }

    /// Forward an upstream share whose `plain_proof` we cannot decode locally
    /// (e.g. SRBMiner's LP-native serialization differs from zion-miner's).
    /// For `prlu:` jobs LuckyPool is the authoritative verifier — an
    /// undecodable blob earns a normal error reply upstream, not a session
    /// kill (verified on the wire). Dedup falls back to a hash of the raw
    /// payload since the jackpot is buried in the undecodable proof.
    pub async fn submit_upstream_opaque(
        &self,
        served_id: &str,
        proof_b64: &str,
        hs: Option<u64>,
    ) -> std::result::Result<UpstreamSubmitReply, PearlSubmitError> {
        let Some(upstream) = &self.upstream else {
            return Err(PearlSubmitError::Stale);
        };
        let Some(ujob) = upstream.job_by_served_id(served_id) else {
            return Err(PearlSubmitError::Stale);
        };
        if proof_b64.len() > MAX_PROOF_B64_CHARS {
            return Err(PearlSubmitError::Invalid(format!(
                "plain_proof exceeds {MAX_PROOF_B64_CHARS} base64 chars"
            )));
        }
        use base64::Engine as _;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(proof_b64)
            .map_err(|e| PearlSubmitError::Invalid(format!("plain_proof base64: {e}")))?;
        if bytes.is_empty() {
            return Err(PearlSubmitError::Invalid("plain_proof empty".to_string()));
        }
        self.claim_upstream_verified(served_id, *blake3::hash(&bytes).as_bytes())?;
        Ok(upstream
            .submit(&ujob.served_id, &ujob.raw_id, proof_b64, hs)
            .await)
    }

    #[cfg(test)]
    pub fn for_test(addr: &str, share_ease: u64, job_ttl_ms: u64, job: PearlJob) -> Arc<Self> {
        Self::for_test_hybrid(addr, share_ease, job_ttl_ms, Some(job), None, 100)
    }

    #[cfg(test)]
    pub fn for_test_hybrid(
        addr: &str,
        share_ease: u64,
        job_ttl_ms: u64,
        job: Option<PearlJob>,
        upstream: Option<Arc<PearlUpstream>>,
        native_pct: u8,
    ) -> Arc<Self> {
        let rt = Arc::new(Self::with_params(
            addr.to_string(),
            share_ease,
            Duration::from_millis(job_ttl_ms),
            Duration::from_millis(2_000),
            upstream,
            native_pct,
        ));
        if let Some(job) = job {
            rt.cache_job(job, Instant::now());
        }
        rt
    }

    /// One JSON-RPC round-trip: connect, write one line, read one line.
    async fn rpc_raw(&self, request_line: &str) -> Result<serde_json::Value> {
        let stream = TcpStream::connect(&self.addr)
            .await
            .with_context(|| format!("pearl gateway connect {}", self.addr))?;
        let (read, mut write) = stream.into_split();
        write.write_all(request_line.as_bytes()).await?;
        write.write_all(b"\n").await?;
        write.shutdown().await.ok();

        let mut reader = BufReader::new(read);
        let mut line = String::new();
        reader.read_line(&mut line).await?;
        // `target` is a U256 that overflows serde_json::Number (parses as f64
        // → scientific notation on to_string). Rewrite `"target":NNN` to a
        // string literal before parsing so digits survive exactly.
        let line = quote_target_digits(&line);
        let resp: serde_json::Value =
            serde_json::from_str(line.trim()).context("pearl gateway: bad JSON response")?;
        if let Some(err) = resp.get("error") {
            anyhow::bail!("pearl gateway error: {err}");
        }
        Ok(resp.get("result").cloned().unwrap_or(serde_json::Value::Null))
    }

    async fn rpc(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value> {
        let req = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1,
        });
        self.rpc_raw(&serde_json::to_string(&req)?).await
    }

    async fn poll_once(&self) -> Result<PearlJob> {
        let result = self.rpc("getMiningInfo", serde_json::json!({})).await?;
        let job = PearlJob::from_rpc_result(&result).map_err(|e| {
            tracing::warn!("pearl_gateway: bad getMiningInfo result: {e:#}");
            e
        })?;
        self.cache_job(job.clone(), Instant::now());
        Ok(job)
    }

    fn cache_job(&self, job: PearlJob, stamp: Instant) {
        let new_id = Self::job_id(&job);
        let mut guard = self.latest.write().unwrap();
        let serve_native = match guard.as_ref() {
            Some((cur, _, flag)) if Self::job_id(cur) == new_id => *flag,
            _ => self.job_seq.fetch_add(1, Ordering::Relaxed) % 100 < u64::from(self.native_pct),
        };
        *guard = Some((job, stamp, serve_native));
    }

    /// Poll `getMiningInfo` forever; update `latest` when the header changes.
    pub async fn run(self: Arc<Self>) {
        let mut last_header: Option<String> = None;
        loop {
            match self.poll_once().await {
                Ok(job) => {
                    let changed = last_header.as_deref() != Some(job.header_b64.as_str());
                    if changed {
                        tracing::info!(
                            "pearl_gateway: new job cert_version={} header={}",
                            job.cert_version,
                            &job.header_b64[..16.min(job.header_b64.len())]
                        );
                        last_header = Some(job.header_b64.clone());
                    }
                }
                Err(e) => tracing::debug!("pearl_gateway: getMiningInfo failed: {e:#}"),
            }
            tokio::time::sleep(self.poll_interval).await;
        }
    }

    /// Fresh latest job, if any.
    pub fn latest_job(&self) -> Option<PearlJob> {
        self.latest_with_flag().map(|(j, _)| j)
    }

    fn latest_with_flag(&self) -> Option<(PearlJob, bool)> {
        match self.latest.read().unwrap().as_ref() {
            Some((j, t, serve)) if t.elapsed() <= self.job_ttl => Some((j.clone(), *serve)),
            _ => None,
        }
    }

    /// Job id used in the V3 `external_stream` — blake3(header) hex; unique
    /// per template and stable across polls.
    pub fn job_id(job: &PearlJob) -> String {
        hex::encode(blake3::hash(&job.header).as_bytes())
    }

    /// Share target for this job: `block_target * share_ease` (the verifier
    /// applies the rank-penalty factor on top).
    pub fn share_target(&self, job: &PearlJob) -> BigUint {
        let u256_max = (BigUint::from(1u8) << 256) - BigUint::from(1u8);
        (&job.target * BigUint::from(self.share_ease)).min(u256_max)
    }

    /// V3 `external_stream` encoding of the current job.
    /// `target_hex` carries the *share* target (32B BE); `eq_params` carries
    /// `cert_version` so the miner can reconstruct the gateway `mining_job`
    /// object for `submitPlainProof`.
    pub fn ext_stream_job(&self) -> Option<ExternalStreamJob> {
        self.latest_job().map(|j| self.ext_stream_for(&j))
    }

    fn ext_stream_for(&self, job: &PearlJob) -> ExternalStreamJob {
        let target = self.share_target(job);
        let target_bytes = target.to_bytes_be();
        let mut padded = [0u8; 32];
        padded[32 - target_bytes.len()..].copy_from_slice(&target_bytes);
        ExternalStreamJob {
            coin: "PRL".to_string(),
            algorithm: "pearlhash".to_string(),
            job_id: Self::job_id(job),
            header_hex: hex::encode(job.header),
            target_hex: hex::encode(padded),
            height: 0,
            extranonce1_hex: String::new(),
            protocol: "pearlgw".to_string(),
            seed_hash_hex: String::new(),
            timestamp: 0,
            ntime_hex: String::new(),
            eq_params: job.cert_version.to_string(),
            eq_pers: String::new(),
        }
    }

    pub fn pick_served_job(&self) -> Option<ExternalStreamJob> {
        let native = self.latest_with_flag();
        if let Some((job, true)) = native {
            self.served_native.fetch_add(1, Ordering::Relaxed);
            return Some(self.ext_stream_for(&job));
        }
        if let Some(job) = self.upstream.as_ref().and_then(|u| u.latest_fresh()) {
            self.served_upstream.fetch_add(1, Ordering::Relaxed);
            return Some(job.ext_stream_job());
        }
        // Upstream gap: fall back to the native leg so miners always hold a
        // PRL job instead of starving until the next upstream notify.
        if native.is_some() {
            self.served_native.fetch_add(1, Ordering::Relaxed);
        }
        native.map(|(job, _)| self.ext_stream_for(&job))
    }

    #[allow(clippy::type_complexity)]
    pub fn status(
        &self,
    ) -> (
        bool,
        Option<String>,
        Option<u64>,
        u8,
        bool,
        bool,
        Option<String>,
        Option<u64>,
        usize,
        usize,
        usize,
    ) {
        let (native_job_id, native_age_ms) = match self.latest.read().unwrap().as_ref() {
            Some((j, t, _)) => (
                Some(Self::job_id(j)),
                Some(t.elapsed().as_millis() as u64),
            ),
            None => (None, None),
        };
        let (up_enabled, up_connected, up_job_id, up_age_ms, up_pending) = match &self.upstream {
            Some(u) => u.status(),
            None => (false, false, None, None, 0),
        };
        (
            !self.addr.is_empty(),
            native_job_id,
            native_age_ms,
            self.native_pct,
            up_enabled,
            up_connected,
            up_job_id,
            up_age_ms,
            up_pending,
            self.served_native.load(Ordering::Relaxed),
            self.served_upstream.load(Ordering::Relaxed),
        )
    }

    /// Upstream-leg status as a JSON object for `/stats`. Emits the same
    /// disabled-shaped object as `status()` reports when no upstream leg is
    /// configured so the API schema stays stable.
    pub fn upstream_status_json(&self) -> serde_json::Value {
        match &self.upstream {
            Some(u) => u.status_json(),
            None => serde_json::json!({
                "enabled": false,
                "connected": false,
                "job_id": null,
                "job_age_ms": null,
                "pending_submits": 0,
                "submits": 0,
                "accepted": 0,
                "rejected": 0,
                "unknown": 0,
                "busy": 0,
            }),
        }
    }

    /// `PearlSubmit` job-id lookup — returns the job iff it is still fresh
    /// and the id matches.
    pub fn job_for_submit(&self, external_job_id: &str) -> Option<PearlJob> {
        let job = self.latest_job()?;
        (Self::job_id(&job) == external_job_id).then_some(job)
    }

    /// Forward a block-meeting proof: `submitPlainProof` with the original
    /// `mining_job` object so the gateway can match its template.
    ///
    /// The request is assembled as raw text: `target` is a U256 integer that
    /// exceeds `serde_json::Number` range and must appear as a JSON number
    /// (the gateway schema rejects strings). Base64/hex fields need no
    /// escaping.
    pub async fn submit_proof(&self, plain_proof_b64: &str, job: &PearlJob) -> Result<()> {
        let req = format!(
            concat!(
                "{{\"jsonrpc\":\"2.0\",\"method\":\"submitPlainProof\",\"params\":{{",
                "\"plain_proof\":\"{proof}\",",
                "\"mining_job\":{{\"incomplete_header_bytes\":\"{hdr}\",\"target\":{target},\"cert_version\":{cert}}}",
                "}},\"id\":1}}"
            ),
            proof = plain_proof_b64,
            hdr = job.header_b64,
            target = job.target_dec,
            cert = job.cert_version,
        );
        self.rpc_raw(&req).await?;
        Ok(())
    }
}

/// Rewrite `"target":NNN` (bare JSON number) as `"target":"NNN"` so a U256
/// target survives `serde_json` parsing with all digits intact. Only digit
/// runs longer than 15 chars are quoted — small numbers stay numeric.
/// Applied to the raw response line before `serde_json::from_str`.
fn quote_target_digits(line: &str) -> String {
    let mut out = String::with_capacity(line.len() + 4);
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if line[i..].starts_with("\"target\"") {
            out.push_str("\"target\"");
            i += 8;
            // copy `:` and whitespace
            while i < bytes.len() && (bytes[i] == b':' || bytes[i].is_ascii_whitespace()) {
                out.push(bytes[i] as char);
                i += 1;
            }
            // if a bare numeric token follows, read it
            if i < bytes.len() && (bytes[i] == b'-' || bytes[i].is_ascii_digit()) {
                let start = i;
                while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'-') {
                    i += 1;
                }
                let tok = &line[start..i];
                if tok.len() > 15 {
                    out.push('"');
                    out.push_str(tok);
                    out.push('"');
                } else {
                    out.push_str(tok);
                }
            }
            continue;
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn runtime(addr: &str, share_ease: u64, ttl_ms: u64) -> PearlRuntime {
        PearlRuntime::with_params(
            addr.to_string(),
            share_ease,
            Duration::from_millis(ttl_ms),
            Duration::from_millis(2_000),
            None,
            100,
        )
    }

    fn job(header: [u8; 76], target: BigUint, cert_version: u32) -> PearlJob {
        use base64::Engine;
        PearlJob {
            header,
            target,
            cert_version,
            header_b64: base64::engine::general_purpose::STANDARD.encode(header),
            target_dec: String::new(),
        }
    }

    #[test]
    fn expired_job_is_invisible_and_recovered_by_recache() {
        let rt = runtime("127.0.0.1:1", 256, 30_000);
        let j = job([0xABu8; 76], BigUint::from(1u8), 3);
        let stamp = Instant::now().checked_sub(2 * rt.job_ttl).unwrap();
        rt.cache_job(j.clone(), stamp);
        assert!(rt.latest_job().is_none());
        assert!(rt.ext_stream_job().is_none());
        assert!(rt.job_for_submit(&PearlRuntime::job_id(&j)).is_none());

        rt.cache_job(j.clone(), Instant::now());
        assert!(rt.latest_job().is_some());
        let ext = rt.ext_stream_job().unwrap();
        assert_eq!(ext.job_id, PearlRuntime::job_id(&j));
        assert!(rt.job_for_submit(&ext.job_id).is_some());
    }

    #[test]
    fn same_header_new_target_cert_replaces_cache() {
        let rt = runtime("127.0.0.1:1", 256, 30_000);
        let j1 = job([0x11u8; 76], BigUint::from(10u8), 3);
        rt.cache_job(j1, Instant::now());
        let j2 = job([0x11u8; 76], BigUint::from(20u8), 2);
        rt.cache_job(j2, Instant::now());
        let ext = rt.ext_stream_job().unwrap();
        assert_eq!(ext.eq_params, "2");
        let expect = BigUint::from(20u8) * BigUint::from(256u64);
        let b = expect.to_bytes_be();
        let mut padded = [0u8; 32];
        padded[32 - b.len()..].copy_from_slice(&b);
        assert_eq!(ext.target_hex, hex::encode(padded));
    }

    #[tokio::test]
    async fn failed_poll_does_not_refresh_expired_job() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.into_split();
            let mut line = String::new();
            BufReader::new(reader).read_line(&mut line).await.unwrap();
            writer
                .write_all(b"{\"jsonrpc\":\"2.0\",\"result\":{\"bogus\":1},\"id\":1}\n")
                .await
                .unwrap();
        });
        let rt = runtime(&format!("127.0.0.1:{port}"), 256, 30_000);
        let j = job([0x22u8; 76], BigUint::from(1u8), 3);
        let stamp = Instant::now().checked_sub(2 * rt.job_ttl).unwrap();
        rt.cache_job(j, stamp);
        assert!(rt.poll_once().await.is_err());
        assert!(rt.latest_job().is_none());
    }

    #[tokio::test]
    async fn rpc_error_poll_does_not_refresh_expired_job() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.into_split();
            let mut line = String::new();
            BufReader::new(reader).read_line(&mut line).await.unwrap();
            writer
                .write_all(
                    b"{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32601,\"message\":\"method not found\"},\"id\":1}\n",
                )
                .await
                .unwrap();
        });
        let rt = runtime(&format!("127.0.0.1:{port}"), 256, 30_000);
        let j = job([0x66u8; 76], BigUint::from(1u8), 3);
        let stamp = Instant::now().checked_sub(2 * rt.job_ttl).unwrap();
        rt.cache_job(j, stamp);
        assert!(rt.poll_once().await.is_err());
        assert!(rt.latest_job().is_none());
    }

    #[tokio::test]
    async fn successful_poll_refreshes_same_header_job() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.into_split();
            let mut line = String::new();
            BufReader::new(reader).read_line(&mut line).await.unwrap();
            let j = job([0x55u8; 76], BigUint::from(7u8), 3);
            let resp = format!(
                "{{\"jsonrpc\":\"2.0\",\"result\":{{\"incomplete_header_bytes\":\"{}\",\"target\":\"{}\",\"cert_version\":3}},\"id\":1}}\n",
                j.header_b64,
                j.target.to_str_radix(10)
            );
            writer.write_all(resp.as_bytes()).await.unwrap();
        });
        let rt = runtime(&format!("127.0.0.1:{port}"), 256, 30_000);
        let j = job([0x55u8; 76], BigUint::from(7u8), 3);
        let stamp = Instant::now().checked_sub(2 * rt.job_ttl).unwrap();
        rt.cache_job(j.clone(), stamp);
        assert!(rt.latest_job().is_none());
        rt.poll_once().await.unwrap();
        let fresh = rt.latest_job().unwrap();
        assert_eq!(PearlRuntime::job_id(&fresh), PearlRuntime::job_id(&j));
    }

    #[test]
    fn share_ease_u64_target_multiplication() {
        let rt = runtime("127.0.0.1:1", 100_000_000_000_000_000u64, 30_000);
        let j = job([0x33u8; 76], BigUint::from(123u32), 3);
        assert_eq!(
            rt.share_target(&j),
            BigUint::from(123u32) * BigUint::from(100_000_000_000_000_000u64)
        );
    }

    #[test]
    fn share_target_saturates_at_u256_max() {
        let rt = runtime("127.0.0.1:1", 3, 30_000);
        let j = job([0x44u8; 76], BigUint::from(1u8) << 255, 3);
        rt.cache_job(j, Instant::now());
        let u256_max = (BigUint::from(1u8) << 256) - BigUint::from(1u8);
        let j2 = rt.latest_job().unwrap();
        assert_eq!(rt.share_target(&j2), u256_max);
        let ext = rt.ext_stream_job().unwrap();
        assert_eq!(ext.target_hex, hex::encode([0xffu8; 32]));
    }

    const FIXTURE: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/pearl_cuda_live_share.json"
    ));
    const FIXTURE_BLOCK_TARGET: &str = "11576915460202502748112183870099358720600496688251011072";
    const FIXTURE_SHARE_EASE: u64 = 1_907_726_491_192;
    const FIXTURE_SHARE_TARGET_HEX: &str =
        "00000000d1b71758e1a3c6c80000000000000000000000000000000000000000";
    const FIXTURE_JACKPOT_HEX: &str =
        "e176bd9940d2557799321b87396cb0fcc64e0215c3b5d162d3f7a60e9bbe0000";

    fn fixture() -> (PearlJob, String) {
        use base64::Engine;
        let v: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
        let header: [u8; 76] = hex::decode(v["header_hex"].as_str().unwrap())
            .unwrap()
            .try_into()
            .unwrap();
        let job = PearlJob {
            header,
            target: FIXTURE_BLOCK_TARGET.parse().unwrap(),
            cert_version: 3,
            header_b64: base64::engine::general_purpose::STANDARD.encode(header),
            target_dec: FIXTURE_BLOCK_TARGET.to_string(),
        };
        (job, v["plain_proof_b64"].as_str().unwrap().to_string())
    }

    fn fixture_runtime() -> (Arc<PearlRuntime>, PearlJob, String) {
        let (job, proof_b64) = fixture();
        let rt = PearlRuntime::for_test("127.0.0.1:1", FIXTURE_SHARE_EASE, 30_000, job.clone());
        (rt, job, proof_b64)
    }

    #[tokio::test]
    async fn verify_submission_real_cuda_fixture() {
        let (rt, job, proof_b64) = fixture_runtime();
        let st = rt.share_target(&job);
        let mut padded = [0u8; 32];
        let b = st.to_bytes_be();
        padded[32 - b.len()..].copy_from_slice(&b);
        assert_eq!(hex::encode(padded), FIXTURE_SHARE_TARGET_HEX);

        let job_id = PearlRuntime::job_id(&job);
        let (job_out, outcome) = rt
            .verify_submission(&job_id, &proof_b64)
            .await
            .expect("frozen live proof verifies");
        assert_eq!(PearlRuntime::job_id(&job_out), job_id);
        assert_eq!(hex::encode(outcome.jackpot_hash), FIXTURE_JACKPOT_HEX);
        assert_eq!(outcome.adjustment_factor, BigUint::from(65536u64));
        assert!(!outcome.is_block);
    }

    #[tokio::test]
    async fn verify_submission_duplicate_and_concurrent() {
        let (rt, job, proof_b64) = fixture_runtime();
        let job_id = PearlRuntime::job_id(&job);
        rt.verify_submission(&job_id, &proof_b64).await.unwrap();
        match rt.verify_submission(&job_id, &proof_b64).await {
            Err(PearlSubmitError::Duplicate) => {}
            other => panic!("expected Duplicate, got {other:?}"),
        }

        let (rt2, job2, proof2) = fixture_runtime();
        let job_id2 = PearlRuntime::job_id(&job2);
        let a = {
            let rt = rt2.clone();
            let job_id = job_id2.clone();
            let proof = proof2.clone();
            async move { rt.verify_submission(&job_id, &proof).await }
        };
        let b = {
            let rt = rt2.clone();
            let job_id = job_id2.clone();
            let proof = proof2.clone();
            async move { rt.verify_submission(&job_id, &proof).await }
        };
        let (ra, rb) = tokio::join!(a, b);
        let accepted = [ra.is_ok(), rb.is_ok()].into_iter().filter(|x| *x).count();
        assert_eq!(accepted, 1, "exactly one concurrent submit is credited");
        match (ra, rb) {
            (Err(e), _) if matches!(e, PearlSubmitError::Duplicate) => {}
            (_, Err(e)) if matches!(e, PearlSubmitError::Duplicate) => {}
            (a2, b2) => panic!("the losing submit must be Duplicate: {a2:?} {b2:?}"),
        }
    }

    #[tokio::test]
    async fn verify_submission_rejects_mutated_and_stale() {
        let (rt, job, proof_b64) = fixture_runtime();
        let job_id = PearlRuntime::job_id(&job);
        use base64::Engine;
        let mut bytes = base64::engine::general_purpose::STANDARD
            .decode(&proof_b64)
            .unwrap();
        bytes[48] ^= 1;
        let mutated = base64::engine::general_purpose::STANDARD.encode(&bytes);
        match rt.verify_submission(&job_id, &mutated).await {
            Err(PearlSubmitError::Invalid(_)) => {}
            other => panic!("expected Invalid, got {other:?}"),
        }
        match rt.verify_submission("no-such-job", &proof_b64).await {
            Err(PearlSubmitError::Stale) => {}
            other => panic!("expected Stale, got {other:?}"),
        }
        match rt.verify_submission(&job_id, "!!!").await {
            Err(PearlSubmitError::Invalid(_)) => {}
            other => panic!("expected Invalid, got {other:?}"),
        }

        let rt_exp = PearlRuntime::for_test("127.0.0.1:1", FIXTURE_SHARE_EASE, 1, job.clone());
        tokio::time::sleep(Duration::from_millis(5)).await;
        match rt_exp.verify_submission(&job_id, &proof_b64).await {
            Err(PearlSubmitError::Stale) => {}
            other => panic!("expected Stale after TTL, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn verify_submission_busy_when_permits_exhausted() {
        let (rt, job, proof_b64) = fixture_runtime();
        let job_id = PearlRuntime::job_id(&job);
        let _p1 = rt.verify_permits.clone().try_acquire_owned().unwrap();
        let _p2 = rt.verify_permits.clone().try_acquire_owned().unwrap();
        match rt.verify_submission(&job_id, &proof_b64).await {
            Err(PearlSubmitError::Busy) => {}
            other => panic!("expected Busy, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn ensure_started_spawns_poller_only_once() {
        let (job, _) = fixture();
        let rt = PearlRuntime::for_test("127.0.0.1:1", 256, 30_000, job);
        assert!(rt.ensure_started());
        assert!(!rt.ensure_started());
        assert!(!rt.ensure_started());
    }

    #[test]
    fn claim_verified_rejects_changed_job_metadata() {
        let (rt, job, _) = fixture_runtime();
        let job_id = PearlRuntime::job_id(&job);
        rt.claim_verified(&job_id, &job, [7u8; 32]).unwrap();

        let (rt2, job2, _) = fixture_runtime();
        let job_id2 = PearlRuntime::job_id(&job2);
        let mut j2 = job2.clone();
        j2.target = j2.target.clone() + BigUint::from(1u8);
        rt2.cache_job(j2, Instant::now());
        match rt2.claim_verified(&job_id2, &job2, [7u8; 32]) {
            Err(PearlSubmitError::Stale) => {}
            other => panic!("expected Stale on changed target, got {other:?}"),
        }

        let (rt3, job3, _) = fixture_runtime();
        let job_id3 = PearlRuntime::job_id(&job3);
        let mut j3 = job3.clone();
        j3.cert_version = 2;
        rt3.cache_job(j3, Instant::now());
        match rt3.claim_verified(&job_id3, &job3, [7u8; 32]) {
            Err(PearlSubmitError::Stale) => {}
            other => panic!("expected Stale on changed cert, got {other:?}"),
        }
    }

    #[test]
    fn claim_verified_duplicate_beats_capacity() {
        let (rt, job, _) = fixture_runtime();
        let job_id = PearlRuntime::job_id(&job);
        let known = [9u8; 32];
        rt.claim_verified(&job_id, &job, known).unwrap();
        {
            let mut seen = rt.seen.lock().unwrap();
            for i in 0..SEEN_JACKPOTS_CAP - 1 {
                let mut k = [0u8; 32];
                k[..8].copy_from_slice(&(i as u64).to_le_bytes());
                seen.jackpots.get_mut(&job_id).unwrap().insert(k);
            }
            assert_eq!(seen.jackpots.get(&job_id).unwrap().len(), SEEN_JACKPOTS_CAP);
        }
        match rt.claim_verified(&job_id, &job, known) {
            Err(PearlSubmitError::Duplicate) => {}
            other => panic!("expected Duplicate at cap, got {other:?}"),
        }
        match rt.claim_verified(&job_id, &job, [0xeeu8; 32]) {
            Err(PearlSubmitError::Busy) => {}
            other => panic!("expected Busy at cap, got {other:?}"),
        }
    }

    fn upstream_seeded(
        header: [u8; 76],
        raw_id: &str,
        target_be: [u8; 32],
        age: Duration,
    ) -> Arc<PearlUpstream> {
        let up = PearlUpstream::new(crate::pearl_upstream::PearlUpstreamConfig {
            endpoint: "127.0.0.1:1".to_string(),
            wallet: "prl1w".to_string(),
            worker: "w".to_string(),
            password: "x".to_string(),
            job_ttl: Duration::from_millis(90_000),
            fwd_max: Duration::from_millis(90_000),
        });
        up.seed_job(UpstreamPearlJob {
            served_id: format!("{}{raw_id}", crate::pearl_upstream::UPSTREAM_JOB_PREFIX),
            raw_id: raw_id.to_string(),
            header,
            target_be,
            height: 0,
            cert_version: 3,
            received_at: Instant::now() - age,
        });
        up
    }

    #[test]
    fn pick_served_job_native_only() {
        let rt = runtime("127.0.0.1:1", 256, 30_000);
        let j = job([0xaau8; 76], BigUint::from(10u8), 3);
        let id = PearlRuntime::job_id(&j);
        rt.cache_job(j, Instant::now());
        let ext = rt.pick_served_job().unwrap();
        assert_eq!(ext.job_id, id);
        assert_eq!(ext.protocol, "pearlgw");
    }

    #[test]
    fn pick_served_job_upstream_only() {
        let up = upstream_seeded([0xaau8; 76], "u1", [0x11u8; 32], Duration::ZERO);
        let rt = PearlRuntime::for_test_hybrid("", 256, 30_000, None, Some(up), 100);
        let ext = rt.pick_served_job().unwrap();
        assert_eq!(ext.job_id, "prlu:u1");
        assert_eq!(ext.protocol, "pearlpool");
        assert_eq!(ext.coin, "PRL");
        assert_eq!(ext.algorithm, "pearlhash");
        assert_eq!(ext.target_hex, hex::encode([0x11u8; 32]));
        assert_eq!(ext.eq_params, "3");
    }

    #[test]
    fn pick_served_job_hybrid_pct_selection() {
        let j = job([0xaau8; 76], BigUint::from(10u8), 3);
        let id = PearlRuntime::job_id(&j);
        let up = upstream_seeded([0xaau8; 76], "u1", [0x11u8; 32], Duration::ZERO);
        let rt100 =
            PearlRuntime::for_test_hybrid("127.0.0.1:1", 256, 30_000, Some(j.clone()), Some(up.clone()), 100);
        assert_eq!(rt100.pick_served_job().unwrap().job_id, id);
        let rt0 =
            PearlRuntime::for_test_hybrid("127.0.0.1:1", 256, 30_000, Some(j.clone()), Some(up), 0);
        assert_eq!(rt0.pick_served_job().unwrap().job_id, "prlu:u1");
    }

    #[test]
    fn pick_served_job_stale_upstream_and_unselected_native() {
        let stale_up =
            upstream_seeded([0xaau8; 76], "u1", [0x11u8; 32], Duration::from_millis(91_000));
        let rt = PearlRuntime::for_test_hybrid("", 256, 30_000, None, Some(stale_up.clone()), 100);
        assert!(rt.pick_served_job().is_none());
        let j = job([0xaau8; 76], BigUint::from(10u8), 3);
        let id = PearlRuntime::job_id(&j);
        let rt0 =
            PearlRuntime::for_test_hybrid("127.0.0.1:1", 256, 30_000, Some(j), Some(stale_up), 0);
        // Native fallback: unselected native job still serves when upstream
        // has nothing fresh — miners never starve during upstream gaps.
        assert_eq!(rt0.pick_served_job().unwrap().job_id, id);
    }

    #[test]
    fn cache_job_keeps_serve_flag_per_job_id() {
        let mut rt = runtime("127.0.0.1:1", 256, 30_000);
        let ja = job([0xaau8; 76], BigUint::from(10u8), 3);
        rt.cache_job(ja.clone(), Instant::now());
        assert!(rt.latest_with_flag().unwrap().1);
        rt.native_pct = 0;
        rt.cache_job(ja, Instant::now());
        assert!(rt.latest_with_flag().unwrap().1);
        rt.cache_job(job([0xbbu8; 76], BigUint::from(10u8), 3), Instant::now());
        assert!(!rt.latest_with_flag().unwrap().1);
        // No upstream leg: the unselected native job still serves as fallback.
        assert!(rt.pick_served_job().is_some());
    }

    #[test]
    fn claim_distinct_job_ids_evicts_oldest_beyond_cap() {
        let rt = runtime("127.0.0.1:1", 256, 30_000);
        for i in 0..SEEN_JOB_IDS_CAP {
            rt.claim(&format!("job-{i}"), [i as u8; 32]).unwrap();
        }
        rt.claim("job-new", [0xffu8; 32]).unwrap();
        {
            let seen = rt.seen.lock().unwrap();
            assert_eq!(seen.jackpots.len(), SEEN_JOB_IDS_CAP);
            assert!(!seen.jackpots.contains_key("job-0"));
            assert!(seen.jackpots.contains_key("job-new"));
        }
        rt.claim("job-0", [0u8; 32]).unwrap();
        match rt.claim("job-new", [0xffu8; 32]) {
            Err(PearlSubmitError::Duplicate) => {}
            other => panic!("expected Duplicate, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn verify_upstream_submission_fixture_and_dedup() {
        let (job, proof_b64) = fixture();
        let target_be: [u8; 32] = hex::decode(FIXTURE_SHARE_TARGET_HEX)
            .unwrap()
            .try_into()
            .unwrap();
        let up = upstream_seeded(job.header, "u-fix", target_be, Duration::ZERO);
        let rt = PearlRuntime::for_test_hybrid("", 256, 30_000, None, Some(up), 100);
        let (ujob, outcome) = rt
            .verify_upstream_submission("prlu:u-fix", &proof_b64)
            .await
            .expect("fixture share verifies against upstream-issued target");
        assert_eq!(ujob.raw_id, "u-fix");
        assert_eq!(hex::encode(outcome.jackpot_hash), FIXTURE_JACKPOT_HEX);
        match rt.verify_upstream_submission("prlu:u-fix", &proof_b64).await {
            Err(PearlSubmitError::Duplicate) => {}
            other => panic!("expected Duplicate, got {other:?}"),
        }
        match rt.verify_upstream_submission("prlu:nope", &proof_b64).await {
            Err(PearlSubmitError::Stale) => {}
            other => panic!("expected Stale, got {other:?}"),
        }
        let rt_no_up = PearlRuntime::for_test_hybrid("127.0.0.1:1", 256, 30_000, Some(job), None, 100);
        match rt_no_up.verify_upstream_submission("prlu:u-fix", &proof_b64).await {
            Err(PearlSubmitError::Stale) => {}
            other => panic!("expected Stale without upstream, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn cross_source_dedup_namespaces() {
        let (job, proof_b64) = fixture();
        let target_be: [u8; 32] = hex::decode(FIXTURE_SHARE_TARGET_HEX)
            .unwrap()
            .try_into()
            .unwrap();
        let up = upstream_seeded(job.header, "u-fix", target_be, Duration::ZERO);
        let rt = PearlRuntime::for_test_hybrid(
            "127.0.0.1:1",
            FIXTURE_SHARE_EASE,
            30_000,
            Some(job.clone()),
            Some(up),
            100,
        );
        let nid = PearlRuntime::job_id(&job);
        rt.verify_submission(&nid, &proof_b64).await.unwrap();
        rt.verify_upstream_submission("prlu:u-fix", &proof_b64)
            .await
            .unwrap();
        match rt.verify_submission(&nid, &proof_b64).await {
            Err(PearlSubmitError::Duplicate) => {}
            other => panic!("expected native Duplicate, got {other:?}"),
        }
        match rt.verify_upstream_submission("prlu:u-fix", &proof_b64).await {
            Err(PearlSubmitError::Duplicate) => {}
            other => panic!("expected upstream Duplicate, got {other:?}"),
        }
    }

    #[test]
    fn status_reports_both_legs() {
        let (j, _) = fixture();
        let nid = PearlRuntime::job_id(&j);
        let up = upstream_seeded(j.header, "u1", [0x11u8; 32], Duration::ZERO);
        let rt = PearlRuntime::for_test_hybrid("127.0.0.1:1", 256, 30_000, Some(j), Some(up), 37);
        let (n_en, njid, nage, pct, u_en, u_conn, ujid, uage, pend, s_native, s_upstream) =
            rt.status();
        assert!(n_en);
        assert_eq!(njid.as_deref(), Some(nid.as_str()));
        assert!(nage.is_some());
        assert_eq!(pct, 37);
        assert!(u_en);
        assert!(!u_conn);
        assert_eq!(ujid.as_deref(), Some("prlu:u1"));
        assert!(uage.is_some());
        assert_eq!(pend, 0);
        assert_eq!(s_native, 0);
        assert_eq!(s_upstream, 0);
        // Every pick lands on exactly one leg — native flag decides which.
        rt.pick_served_job().unwrap();
        rt.pick_served_job().unwrap();
        let (_, _, _, _, _, _, _, _, _, s_native, s_upstream) = rt.status();
        assert_eq!(s_native + s_upstream, 2);
    }

    #[test]
    fn pick_served_job_counts_each_leg() {
        let j = job([0xaau8; 76], BigUint::from(10u8), 3);
        let up = upstream_seeded([0xaau8; 76], "u1", [0x11u8; 32], Duration::ZERO);
        // native_pct=100 always serves the native leg.
        let rt100 = PearlRuntime::for_test_hybrid(
            "127.0.0.1:1",
            256,
            30_000,
            Some(j.clone()),
            Some(up.clone()),
            100,
        );
        rt100.pick_served_job().unwrap();
        rt100.pick_served_job().unwrap();
        let (_, _, _, _, _, _, _, _, _, sn, su) = rt100.status();
        assert_eq!((sn, su), (2, 0));
        // native_pct=0 with a fresh upstream job serves the upstream leg.
        let rt0 =
            PearlRuntime::for_test_hybrid("127.0.0.1:1", 256, 30_000, Some(j.clone()), Some(up), 0);
        rt0.pick_served_job().unwrap();
        let (_, _, _, _, _, _, _, _, _, sn, su) = rt0.status();
        assert_eq!((sn, su), (0, 1));
        // Upstream gap: the unselected native leg still serves as fallback —
        // counted as native, not upstream.
        let stale_up =
            upstream_seeded([0xaau8; 76], "u1", [0x11u8; 32], Duration::from_millis(91_000));
        let rt_stale = PearlRuntime::for_test_hybrid(
            "127.0.0.1:1",
            256,
            30_000,
            Some(j),
            Some(stale_up),
            0,
        );
        rt_stale.pick_served_job().unwrap();
        let (_, _, _, _, _, _, _, _, _, sn, su) = rt_stale.status();
        assert_eq!((sn, su), (1, 0));
        // Nothing to serve: no counters move.
        let rt_empty = PearlRuntime::for_test_hybrid("127.0.0.1:1", 256, 30_000, None, None, 0);
        assert!(rt_empty.pick_served_job().is_none());
        let (_, _, _, _, _, _, _, _, _, sn, su) = rt_empty.status();
        assert_eq!((sn, su), (0, 0));
    }
}
