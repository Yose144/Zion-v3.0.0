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

use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use num_bigint::BigUint;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use std::sync::RwLock;

use crate::pearl::PearlJob;
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

#[derive(Clone)]
pub struct PearlRuntime {
    addr: String,
    latest: Arc<RwLock<Option<(PearlJob, Instant)>>>,
    share_ease: u64,
    job_ttl: Duration,
    poll_interval: Duration,
}

impl PearlRuntime {
    /// `Some` when `ZION_POOL_PEARL_GATEWAY` names a `host:port` endpoint.
    pub fn from_env() -> Option<Arc<Self>> {
        let addr = std::env::var("ZION_POOL_PEARL_GATEWAY")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())?;
        Some(Arc::new(Self {
            addr,
            latest: Arc::new(RwLock::new(None)),
            share_ease: env_u64("ZION_POOL_PEARL_SHARE_EASE", DEFAULT_SHARE_EASE as u64),
            job_ttl: Duration::from_millis(env_u64("ZION_POOL_PEARL_JOB_TTL_MS", DEFAULT_JOB_TTL_MS)),
            poll_interval: Duration::from_millis(env_u64("ZION_POOL_PEARL_POLL_MS", DEFAULT_POLL_MS)),
        }))
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
        PearlRuntime {
            addr: addr.to_string(),
            latest: Arc::new(RwLock::new(None)),
            share_ease,
            job_ttl: Duration::from_millis(ttl_ms),
            poll_interval: Duration::from_millis(2_000),
        }
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
}
