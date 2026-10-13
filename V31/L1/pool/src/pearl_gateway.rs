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
    latest: Arc<RwLock<Option<PearlJob>>>,
    job_stamp: Arc<RwLock<Option<Instant>>>,
    share_ease: u32,
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
            job_stamp: Arc::new(RwLock::new(None)),
            share_ease: env_u64("ZION_POOL_PEARL_SHARE_EASE", DEFAULT_SHARE_EASE as u64) as u32,
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

    /// Poll `getMiningInfo` forever; update `latest` when the header changes.
    pub async fn run(self: Arc<Self>) {
        let mut last_header: Option<String> = None;
        loop {
            match self.rpc("getMiningInfo", serde_json::json!({})).await {
                Ok(result) => match PearlJob::from_rpc_result(&result) {
                    Ok(job) => {
                        let changed = last_header.as_deref() != Some(job.header_b64.as_str());
                        if changed {
                            tracing::info!(
                                "pearl_gateway: new job cert_version={} header={}",
                                job.cert_version,
                                &job.header_b64[..16.min(job.header_b64.len())]
                            );
                            last_header = Some(job.header_b64.clone());
                            *self.latest.write().unwrap() = Some(job);
                            *self.job_stamp.write().unwrap() = Some(Instant::now());
                        }
                    }
                    Err(e) => tracing::warn!("pearl_gateway: bad getMiningInfo result: {e:#}"),
                },
                Err(e) => tracing::debug!("pearl_gateway: getMiningInfo failed: {e:#}"),
            }
            tokio::time::sleep(self.poll_interval).await;
        }
    }

    /// Fresh latest job, if any.
    pub fn latest_job(&self) -> Option<PearlJob> {
        let stamp = *self.job_stamp.read().unwrap();
        match (self.latest.read().unwrap().clone(), stamp) {
            (Some(j), Some(t)) if t.elapsed() <= self.job_ttl => Some(j),
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
        &job.target * BigUint::from(self.share_ease)
    }

    /// V3 `external_stream` encoding of the current job.
    /// `target_hex` carries the *share* target (32B BE); `eq_params` carries
    /// `cert_version` so the miner can reconstruct the gateway `mining_job`
    /// object for `submitPlainProof`.
    pub fn ext_stream_job(&self) -> Option<ExternalStreamJob> {
        let job = self.latest_job()?;
        let target = self.share_target(&job);
        let mut target_bytes = target.to_bytes_be();
        if target_bytes.len() > 32 {
            target_bytes = target_bytes[target_bytes.len() - 32..].to_vec();
        }
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
