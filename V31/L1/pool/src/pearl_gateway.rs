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

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use num_bigint::BigUint;
use std::sync::{Mutex, RwLock};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::Semaphore;

use crate::pearl::{decode_plain_proof, verify_pearl_share, PearlJob, PearlShareOutcome};
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
    job_id: String,
    jackpots: HashSet<[u8; 32]>,
}

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
    latest: Arc<RwLock<Option<(PearlJob, Instant)>>>,
    share_ease: u64,
    job_ttl: Duration,
    poll_interval: Duration,
    started: Arc<AtomicBool>,
    verify_permits: Arc<Semaphore>,
    seen: Arc<Mutex<SeenJackpots>>,
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
                job_id: String::new(),
                jackpots: HashSet::new(),
            })),
        }
    }

    /// `Some` when `ZION_POOL_PEARL_GATEWAY` names a `host:port` endpoint.
    pub fn from_env() -> Option<Arc<Self>> {
        let addr = std::env::var("ZION_POOL_PEARL_GATEWAY")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())?;
        Some(Arc::new(Self::with_params(
            addr,
            env_u64("ZION_POOL_PEARL_SHARE_EASE", DEFAULT_SHARE_EASE as u64),
            Duration::from_millis(env_u64("ZION_POOL_PEARL_JOB_TTL_MS", DEFAULT_JOB_TTL_MS)),
            Duration::from_millis(env_u64("ZION_POOL_PEARL_POLL_MS", DEFAULT_POLL_MS)),
        )))
    }

    pub fn ensure_started(self: &Arc<Self>) -> bool {
        if self
            .started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            let rt = Arc::clone(self);
            tokio::spawn(async move { rt.run().await });
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

    fn claim_verified(
        &self,
        job_id: &str,
        expected: &PearlJob,
        jackpot: [u8; 32],
    ) -> std::result::Result<(), PearlSubmitError> {
        let guard = self.latest.read().unwrap();
        let current = match guard.as_ref() {
            Some((j, t)) if t.elapsed() <= self.job_ttl => j,
            _ => return Err(PearlSubmitError::Stale),
        };
        if Self::job_id(current) != job_id
            || current.header != expected.header
            || current.target != expected.target
            || current.cert_version != expected.cert_version
        {
            return Err(PearlSubmitError::Stale);
        }
        let mut seen = self.seen.lock().unwrap();
        if seen.job_id != job_id {
            seen.job_id = job_id.to_string();
            seen.jackpots.clear();
        }
        if seen.jackpots.contains(&jackpot) {
            return Err(PearlSubmitError::Duplicate);
        }
        if seen.jackpots.len() >= SEEN_JACKPOTS_CAP {
            return Err(PearlSubmitError::Busy);
        }
        seen.jackpots.insert(jackpot);
        Ok(())
    }

    #[cfg(test)]
    pub fn for_test(addr: &str, share_ease: u64, job_ttl_ms: u64, job: PearlJob) -> Arc<Self> {
        let rt = Arc::new(Self::with_params(
            addr.to_string(),
            share_ease,
            Duration::from_millis(job_ttl_ms),
            Duration::from_millis(2_000),
        ));
        rt.cache_job(job, Instant::now());
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
        *self.latest.write().unwrap() = Some((job, stamp));
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
        match self.latest.read().unwrap().as_ref() {
            Some((j, t)) if t.elapsed() <= self.job_ttl => Some(j.clone()),
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
        let job = self.latest_job()?;
        let target = self.share_target(&job);
        let target_bytes = target.to_bytes_be();
        let mut padded = [0u8; 32];
        padded[32 - target_bytes.len()..].copy_from_slice(&target_bytes);
        Some(ExternalStreamJob {
            coin: "PRL".to_string(),
            algorithm: "pearlhash".to_string(),
            job_id: Self::job_id(&job),
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
        })
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
                seen.jackpots.insert(k);
            }
            assert_eq!(seen.jackpots.len(), SEEN_JACKPOTS_CAP);
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
}
