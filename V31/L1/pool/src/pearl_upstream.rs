use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};

use anyhow::Result;
use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

use zion_miner::auxpow::pearl_pool::{PearlPoolClient, PearlPoolEvent, PearlPoolJob};

use crate::v3_protocol::ExternalStreamJob;

pub const UPSTREAM_JOB_PREFIX: &str = "prlu:";

const SUBMIT_CHANNEL_CAP: usize = 32;
const READ_TIMEOUT: Duration = Duration::from_secs(30);
const DEFAULT_JOB_TTL_MS: u64 = 90_000;
const BACKOFF_BASE: Duration = Duration::from_secs(5);
const BACKOFF_MAX: Duration = Duration::from_secs(60);
/// Upstream pearl pools only notify on template changes; gaps well over
/// READ_TIMEOUT are normal (see auxpow_runtime, which polls through
/// thousands of timeouts per session). Treat the connection as dead only
/// after this many consecutive silent windows.
const MAX_CONSECUTIVE_TIMEOUTS: u32 = 10;
/// Recent upstream jobs kept for `job_by_served_id` matching. Upstream pools
/// rotate templates; a share built on the previous job must still resolve
/// (and forward) inside the staleness window instead of dying `Stale`.
const JOB_RING_CAP: usize = 4;

#[derive(Clone)]
pub struct PearlUpstreamConfig {
    pub endpoint: String,
    pub wallet: String,
    pub worker: String,
    pub password: String,
    pub job_ttl: Duration,
}

impl PearlUpstreamConfig {
    pub fn from_env() -> Option<Self> {
        let endpoint = std::env::var("ZION_POOL_PEARL_UPSTREAM")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())?;
        if endpoint.contains("://") {
            tracing::warn!("pearl_upstream: ZION_POOL_PEARL_UPSTREAM must be a plain host:port endpoint");
            return None;
        }
        let wallet = match std::env::var("ZION_POOL_PEARL_UPSTREAM_WALLET")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            Some(w) => w,
            None => {
                tracing::warn!(
                    "pearl_upstream: ZION_POOL_PEARL_UPSTREAM set but ZION_POOL_PEARL_UPSTREAM_WALLET missing — upstream leg disabled"
                );
                return None;
            }
        };
        let worker = std::env::var("ZION_POOL_PEARL_UPSTREAM_WORKER")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "zion-pool".to_string());
        let password = std::env::var("ZION_POOL_PEARL_UPSTREAM_PASSWORD")
            .unwrap_or_else(|_| "x".to_string());
        let job_ttl = Duration::from_millis(
            std::env::var("ZION_POOL_PEARL_UPSTREAM_JOB_TTL_MS")
                .ok()
                .and_then(|v| v.trim().parse().ok())
                .unwrap_or(DEFAULT_JOB_TTL_MS),
        );
        Some(Self {
            endpoint,
            wallet,
            worker,
            password,
            job_ttl,
        })
    }
}

#[derive(Clone, Debug)]
pub struct UpstreamPearlJob {
    pub served_id: String,
    pub raw_id: String,
    pub header: [u8; 76],
    pub target_be: [u8; 32],
    pub height: u64,
    pub cert_version: u32,
    pub received_at: Instant,
}

impl UpstreamPearlJob {
    pub fn ext_stream_job(&self) -> ExternalStreamJob {
        ExternalStreamJob {
            coin: "PRL".to_string(),
            algorithm: "pearlhash".to_string(),
            job_id: self.served_id.clone(),
            header_hex: hex::encode(self.header),
            target_hex: hex::encode(self.target_be),
            height: self.height,
            extranonce1_hex: String::new(),
            protocol: "pearlpool".to_string(),
            seed_hash_hex: String::new(),
            timestamp: 0,
            ntime_hex: String::new(),
            eq_params: self.cert_version.to_string(),
            eq_pers: String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpstreamSubmitReply {
    Accepted,
    Rejected(String),
    Unknown,
    Busy,
}

struct SubmitReq {
    served_id: String,
    job_id: String,
    proof_b64: String,
    reply: oneshot::Sender<UpstreamSubmitReply>,
}

fn reject_reason(raw: &Value) -> String {
    let msg = raw
        .get("error")
        .and_then(|e| e.get("message").or_else(|| e.get("msg")))
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| serde_json::to_string(raw).unwrap_or_default());
    msg.chars().take(80).collect()
}

#[derive(Clone)]
pub struct PearlUpstream {
    endpoint: String,
    wallet: String,
    worker: String,
    password: String,
    job_ttl: Duration,
    jobs: Arc<RwLock<VecDeque<UpstreamPearlJob>>>,
    connected: Arc<AtomicBool>,
    submit_tx: mpsc::Sender<SubmitReq>,
    submit_rx: Arc<Mutex<Option<mpsc::Receiver<SubmitReq>>>>,
    pending: Arc<AtomicUsize>,
    submits: Arc<AtomicUsize>,
    accepted: Arc<AtomicUsize>,
    rejected: Arc<AtomicUsize>,
    unknown: Arc<AtomicUsize>,
    busy: Arc<AtomicUsize>,
    started: Arc<AtomicBool>,
}

impl PearlUpstream {
    pub fn new(cfg: PearlUpstreamConfig) -> Arc<Self> {
        let (submit_tx, submit_rx) = mpsc::channel(SUBMIT_CHANNEL_CAP);
        Arc::new(Self {
            endpoint: cfg.endpoint,
            wallet: cfg.wallet,
            worker: cfg.worker,
            password: cfg.password,
            job_ttl: cfg.job_ttl,
            jobs: Arc::new(RwLock::new(VecDeque::new())),
            connected: Arc::new(AtomicBool::new(false)),
            submit_tx,
            submit_rx: Arc::new(Mutex::new(Some(submit_rx))),
            pending: Arc::new(AtomicUsize::new(0)),
            submits: Arc::new(AtomicUsize::new(0)),
            accepted: Arc::new(AtomicUsize::new(0)),
            rejected: Arc::new(AtomicUsize::new(0)),
            unknown: Arc::new(AtomicUsize::new(0)),
            busy: Arc::new(AtomicUsize::new(0)),
            started: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn from_env() -> Option<Arc<Self>> {
        PearlUpstreamConfig::from_env().map(Self::new)
    }

    pub fn ensure_started(self: &Arc<Self>) -> bool {
        if self
            .started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            if let Some(rx) = self.submit_rx.lock().unwrap().take() {
                let up = Arc::clone(self);
                tokio::spawn(async move { up.run(rx).await });
            }
            true
        } else {
            false
        }
    }

    pub fn latest_fresh(&self) -> Option<UpstreamPearlJob> {
        match self.jobs.read().unwrap().back() {
            Some(j) if j.received_at.elapsed() <= self.job_ttl => Some(j.clone()),
            _ => None,
        }
    }

    /// Resolve a served `prlu:` id against the recent-job ring — newest
    /// first. Entries past `job_ttl` never match, so only the staleness
    /// window around a template rotation is covered.
    pub fn job_by_served_id(&self, served_id: &str) -> Option<UpstreamPearlJob> {
        self.jobs
            .read()
            .unwrap()
            .iter()
            .rev()
            .find(|j| j.served_id == served_id && j.received_at.elapsed() <= self.job_ttl)
            .cloned()
    }

    pub async fn submit(
        &self,
        served_id: &str,
        raw_id: &str,
        proof_b64: &str,
    ) -> UpstreamSubmitReply {
        self.submits.fetch_add(1, Ordering::Relaxed);
        let (reply, rx) = oneshot::channel();
        let req = SubmitReq {
            served_id: served_id.to_string(),
            job_id: raw_id.to_string(),
            proof_b64: proof_b64.to_string(),
            reply,
        };
        tracing::debug!("pearl_upstream: submit served={} raw={}", served_id, raw_id);
        self.pending.fetch_add(1, Ordering::Relaxed);
        if self.submit_tx.try_send(req).is_err() {
            self.pending.fetch_sub(1, Ordering::Relaxed);
            self.busy.fetch_add(1, Ordering::Relaxed);
            tracing::warn!(
                "pearl_upstream: submit {served_id} rejected — submit queue full ({SUBMIT_CHANNEL_CAP})"
            );
            return UpstreamSubmitReply::Busy;
        }
        match rx.await {
            Ok(r) => r,
            Err(_) => {
                self.pending.fetch_sub(1, Ordering::Relaxed);
                self.unknown.fetch_add(1, Ordering::Relaxed);
                tracing::warn!(
                    "pearl_upstream: submit {served_id} verdict=unknown — upstream task dropped the reply"
                );
                UpstreamSubmitReply::Unknown
            }
        }
    }

    pub fn status(&self) -> (bool, bool, Option<String>, Option<u64>, usize) {
        let (job_id, age_ms) = match self.jobs.read().unwrap().back() {
            Some(j) => (
                Some(j.served_id.clone()),
                Some(j.received_at.elapsed().as_millis() as u64),
            ),
            None => (None, None),
        };
        (
            true,
            self.connected.load(Ordering::Relaxed),
            job_id,
            age_ms,
            self.pending.load(Ordering::Relaxed),
        )
    }

    /// JSON status block for `/stats` — everything `status()` reports plus
    /// lifetime submit-verdict counters.
    pub fn status_json(&self) -> Value {
        let (enabled, connected, job_id, age_ms, pending) = self.status();
        serde_json::json!({
            "enabled": enabled,
            "connected": connected,
            "job_id": job_id,
            "job_age_ms": age_ms,
            "pending_submits": pending,
            "submits": self.submits.load(Ordering::Relaxed),
            "accepted": self.accepted.load(Ordering::Relaxed),
            "rejected": self.rejected.load(Ordering::Relaxed),
            "unknown": self.unknown.load(Ordering::Relaxed),
            "busy": self.busy.load(Ordering::Relaxed),
        })
    }

    fn cache_job(&self, j: PearlPoolJob) {
        let cached = UpstreamPearlJob {
            served_id: format!("{UPSTREAM_JOB_PREFIX}{}", j.job_id),
            raw_id: j.job_id,
            header: j.header,
            target_be: j.target_be,
            height: j.height,
            cert_version: j.cert_version,
            received_at: Instant::now(),
        };
        let mut ring = self.jobs.write().unwrap();
        if ring
            .back()
            .map(|cur| cur.raw_id == cached.raw_id)
            .unwrap_or(false)
        {
            // Same template re-seen (post-submit `latest_job` refresh or a
            // duplicate notify): replace in place to renew the TTL without
            // growing the ring or re-logging.
            *ring.back_mut().unwrap() = cached;
            return;
        }
        tracing::info!(
            "pearl_upstream: new job {} height={} cert_version={} target={}",
            cached.served_id,
            cached.height,
            cached.cert_version,
            &hex::encode(cached.target_be)[..16]
        );
        if ring.len() >= JOB_RING_CAP {
            ring.pop_front();
        }
        ring.push_back(cached);
    }

    async fn run(self: Arc<Self>, mut submit_rx: mpsc::Receiver<SubmitReq>) {
        let mut backoff = BACKOFF_BASE;
        loop {
            match self.run_connection(&mut submit_rx).await {
                Ok(()) => tracing::warn!(
                    "pearl_upstream: {} session ended — reconnecting",
                    self.endpoint
                ),
                Err(e) => {
                    tracing::warn!("pearl_upstream: {}: {e:#} — reconnecting", self.endpoint)
                }
            }
            // Queued SubmitReqs stay in the channel: each carries its own
            // reply oneshot, so they resolve with a real verdict on the next
            // session instead of being silently drained to `Unknown` here.
            // Keep the job ring cached through the reconnect — upstream jobs
            // stay valid until the pool replaces them, and latest_fresh()
            // still bounds staleness via job_ttl.
            self.connected.store(false, Ordering::SeqCst);
            if submit_rx.is_closed() {
                return;
            }
            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(BACKOFF_MAX);
        }
    }

    async fn run_connection(
        &self,
        submit_rx: &mut mpsc::Receiver<SubmitReq>,
    ) -> Result<()> {
        let mut client = PearlPoolClient::connect(
            &self.endpoint,
            &self.wallet,
            &self.worker,
            &self.password,
        )
        .await?;
        self.connected.store(true, Ordering::SeqCst);
        if let Some(j) = client.latest_job() {
            self.cache_job(j);
        }
        tracing::info!("pearl_upstream: connected to {}", self.endpoint);
        let mut consecutive_timeouts = 0u32;
        loop {
            tokio::select! {
                ev = tokio::time::timeout(READ_TIMEOUT, client.next_event()) => match ev {
                    Ok(Ok(PearlPoolEvent::Job(j))) => {
                        consecutive_timeouts = 0;
                        self.connected.store(true, Ordering::SeqCst);
                        self.cache_job(j);
                    }
                    Ok(Ok(PearlPoolEvent::Response(r))) => {
                        consecutive_timeouts = 0;
                        tracing::debug!(
                            "pearl_upstream: stray response id={} accepted={}",
                            r.id,
                            r.accepted
                        );
                    }
                    Ok(Ok(PearlPoolEvent::Other(_))) => {
                        consecutive_timeouts = 0;
                    }
                    Ok(Err(e)) => return Err(e),
                    Err(_) => {
                        consecutive_timeouts += 1;
                        if consecutive_timeouts >= MAX_CONSECUTIVE_TIMEOUTS {
                            anyhow::bail!(
                                "read timeout x{consecutive_timeouts} — upstream silent"
                            );
                        }
                        tracing::debug!(
                            "pearl_upstream: {} quiet {consecutive_timeouts}/{MAX_CONSECUTIVE_TIMEOUTS}",
                            self.endpoint
                        );
                    }
                },
                req = submit_rx.recv() => {
                    let Some(req) = req else { return Ok(()) };
                    let res = client.submit_proof(&req.job_id, &req.proof_b64).await;
                    self.pending.fetch_sub(1, Ordering::Relaxed);
                    let reply = match res {
                        Ok(r) if r.accepted => {
                            self.accepted.fetch_add(1, Ordering::Relaxed);
                            tracing::info!(
                                "pearl_upstream: submit {} verdict=accepted",
                                req.served_id
                            );
                            UpstreamSubmitReply::Accepted
                        }
                        Ok(r) => {
                            self.rejected.fetch_add(1, Ordering::Relaxed);
                            let reason = reject_reason(&r.raw);
                            tracing::info!(
                                "pearl_upstream: submit {} verdict=rejected reason={reason}",
                                req.served_id
                            );
                            UpstreamSubmitReply::Rejected(reason)
                        }
                        Err(e) => {
                            self.unknown.fetch_add(1, Ordering::Relaxed);
                            tracing::warn!(
                                "pearl_upstream: submit {} verdict=unknown: {e:#}",
                                req.served_id
                            );
                            UpstreamSubmitReply::Unknown
                        }
                    };
                    let _ = req.reply.send(reply);
                    if let Some(j) = client.latest_job() {
                        self.cache_job(j);
                    }
                }
            }
        }
    }

    #[cfg(test)]
    pub fn seed_job(&self, job: UpstreamPearlJob) {
        let mut ring = self.jobs.write().unwrap();
        if ring.len() >= JOB_RING_CAP {
            ring.pop_front();
        }
        ring.push_back(job);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    const ENV_VARS: [&str; 5] = [
        "ZION_POOL_PEARL_UPSTREAM",
        "ZION_POOL_PEARL_UPSTREAM_WALLET",
        "ZION_POOL_PEARL_UPSTREAM_WORKER",
        "ZION_POOL_PEARL_UPSTREAM_PASSWORD",
        "ZION_POOL_PEARL_UPSTREAM_JOB_TTL_MS",
    ];

    fn test_cfg(endpoint: &str) -> PearlUpstreamConfig {
        PearlUpstreamConfig {
            endpoint: endpoint.to_string(),
            wallet: "prl1poolwallet".to_string(),
            worker: "zion-pool".to_string(),
            password: "x".to_string(),
            job_ttl: Duration::from_millis(90_000),
        }
    }

    fn ujob(raw_id: &str, age: Duration) -> UpstreamPearlJob {
        UpstreamPearlJob {
            served_id: format!("{UPSTREAM_JOB_PREFIX}{raw_id}"),
            raw_id: raw_id.to_string(),
            header: [0xabu8; 76],
            target_be: [0x11u8; 32],
            height: 42,
            cert_version: 3,
            received_at: Instant::now() - age,
        }
    }

    #[test]
    fn from_env_requires_endpoint_and_wallet() {
        static LOCK: Mutex<()> = Mutex::new(());
        let _g = LOCK.lock().unwrap();
        for k in ENV_VARS {
            std::env::remove_var(k);
        }
        assert!(PearlUpstreamConfig::from_env().is_none());
        std::env::set_var("ZION_POOL_PEARL_UPSTREAM", "127.0.0.1:9");
        assert!(PearlUpstreamConfig::from_env().is_none());
        std::env::set_var("ZION_POOL_PEARL_UPSTREAM_WALLET", "prl1w");
        let c = PearlUpstreamConfig::from_env().unwrap();
        assert_eq!(c.endpoint, "127.0.0.1:9");
        assert_eq!(c.wallet, "prl1w");
        assert_eq!(c.worker, "zion-pool");
        assert_eq!(c.job_ttl, Duration::from_millis(90_000));
        std::env::set_var("ZION_POOL_PEARL_UPSTREAM_WORKER", "w2");
        std::env::set_var("ZION_POOL_PEARL_UPSTREAM_JOB_TTL_MS", "5000");
        let c = PearlUpstreamConfig::from_env().unwrap();
        assert_eq!(c.worker, "w2");
        assert_eq!(c.job_ttl, Duration::from_millis(5_000));
        std::env::set_var("ZION_POOL_PEARL_UPSTREAM", "stratum+tcp://x:1");
        assert!(PearlUpstreamConfig::from_env().is_none());
        for k in ENV_VARS {
            std::env::remove_var(k);
        }
    }

    #[tokio::test]
    async fn latest_fresh_and_served_id_lookup() {
        let up = PearlUpstream::new(test_cfg("127.0.0.1:1"));
        assert!(up.latest_fresh().is_none());
        up.seed_job(ujob("job-a", Duration::ZERO));
        assert_eq!(up.latest_fresh().unwrap().served_id, "prlu:job-a");
        assert!(up.job_by_served_id("prlu:job-a").is_some());
        assert!(up.job_by_served_id("job-a").is_none());
        assert!(up.job_by_served_id("prlu:other").is_none());
        up.seed_job(ujob("job-b", Duration::from_millis(91_000)));
        assert!(up.latest_fresh().is_none());
        assert!(up.job_by_served_id("prlu:job-b").is_none());
        // The ring keeps older entries: the pre-rotation job still matches
        // while fresh, so stale-window submits forward instead of dying Stale.
        assert_eq!(
            up.job_by_served_id("prlu:job-a").unwrap().raw_id,
            "job-a"
        );
    }

    #[tokio::test]
    async fn served_id_ring_covers_rotation_window_and_caps() {
        let up = PearlUpstream::new(test_cfg("127.0.0.1:1"));
        for i in 0..JOB_RING_CAP {
            up.seed_job(ujob(&format!("job-{i}"), Duration::ZERO));
        }
        assert_eq!(
            up.latest_fresh().unwrap().served_id,
            format!("prlu:job-{}", JOB_RING_CAP - 1)
        );
        // Every job in the ring resolves, not just the newest.
        for i in 0..JOB_RING_CAP {
            assert!(up.job_by_served_id(&format!("prlu:job-{i}")).is_some());
        }
        // Pushing past the cap evicts the oldest entry.
        up.seed_job(ujob("job-new", Duration::ZERO));
        assert!(up.job_by_served_id("prlu:job-0").is_none());
        assert!(up.job_by_served_id("prlu:job-new").is_some());
        // A stale ring entry never matches even when the id is still cached.
        up.seed_job(ujob("job-old", Duration::from_millis(91_000)));
        assert!(up.job_by_served_id("prlu:job-old").is_none());
        assert!(up.latest_fresh().is_none());
    }

    #[tokio::test]
    async fn submit_busy_when_channel_full() {
        let up = PearlUpstream::new(test_cfg("127.0.0.1:1"));
        for _ in 0..SUBMIT_CHANNEL_CAP {
            let (tx, _rx) = oneshot::channel();
            up.pending.fetch_add(1, Ordering::Relaxed);
            up.submit_tx
                .try_send(SubmitReq {
                    served_id: "prlu:j".to_string(),
                    job_id: "j".to_string(),
                    proof_b64: "QUJD".to_string(),
                    reply: tx,
                })
                .unwrap();
        }
        assert_eq!(
            up.submit("prlu:j", "j", "QUJD").await,
            UpstreamSubmitReply::Busy
        );
        assert_eq!(up.pending.load(Ordering::Relaxed), SUBMIT_CHANNEL_CAP);
        assert_eq!(up.submits.load(Ordering::Relaxed), 1);
        assert_eq!(up.busy.load(Ordering::Relaxed), 1);
        let (en, conn, jid, age, pend) = up.status();
        assert!(en);
        assert!(!conn);
        assert_eq!(jid.as_deref(), None);
        assert_eq!(age, None);
        assert_eq!(pend, SUBMIT_CHANNEL_CAP);
        let sj = up.status_json();
        assert_eq!(sj["submits"], 1);
        assert_eq!(sj["busy"], 1);
        assert_eq!(sj["pending_submits"], SUBMIT_CHANNEL_CAP);
    }

    #[derive(Clone, Copy)]
    enum Verdict {
        Accept,
        Reject(&'static str),
        Drop,
        CloseAfterNotify,
    }

    fn spawn_mock_upstream(
        listener: std::net::TcpListener,
        notify: Option<Value>,
        verdict: Verdict,
    ) -> Arc<Mutex<Vec<String>>> {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let calls2 = calls.clone();
        tokio::spawn(async move {
            let listener = TcpListener::from_std(listener).unwrap();
            while let Ok((socket, _)) = listener.accept().await {
                let calls = calls2.clone();
                let notify = notify.clone();
                tokio::spawn(async move {
                    let (r, mut w) = socket.into_split();
                    let mut br = BufReader::new(r);
                    let mut line = String::new();
                    if br.read_line(&mut line).await.is_err() {
                        return;
                    }
                    calls.lock().unwrap().push(line.trim().to_string());
                    if w.write_all(b"{\"id\":1,\"result\":true,\"error\":null}\n")
                        .await
                        .is_err()
                    {
                        return;
                    }
                    if let Some(p) = &notify {
                        let frame = format!(
                            "{}\n",
                            serde_json::json!({"jsonrpc":"2.0","method":"mining.notify","params":p})
                        );
                        if w.write_all(frame.as_bytes()).await.is_err() {
                            return;
                        }
                    }
                    if matches!(verdict, Verdict::CloseAfterNotify) {
                        return;
                    }
                    loop {
                        line.clear();
                        match br.read_line(&mut line).await {
                            Ok(0) | Err(_) => return,
                            Ok(_) => {
                                let v: Value =
                                    serde_json::from_str(line.trim()).unwrap_or_default();
                                if v["method"].as_str() == Some("mining.submit") {
                                    calls.lock().unwrap().push(line.trim().to_string());
                                    match verdict {
                                        Verdict::Accept => {
                                            let resp = format!(
                                                "{{\"id\":{},\"result\":true,\"error\":null}}\n",
                                                v["id"]
                                            );
                                            if w.write_all(resp.as_bytes()).await.is_err() {
                                                return;
                                            }
                                        }
                                        Verdict::Reject(m) => {
                                            let resp = format!(
                                                "{{\"id\":{},\"result\":false,\"error\":{{\"code\":-1,\"message\":\"{m}\"}}}}\n",
                                                v["id"]
                                            );
                                            if w.write_all(resp.as_bytes()).await.is_err() {
                                                return;
                                            }
                                        }
                                        Verdict::Drop | Verdict::CloseAfterNotify => return,
                                    }
                                }
                            }
                        }
                    }
                });
            }
        });
        calls
    }

    fn notify_params(raw_id: &str) -> Value {
        serde_json::json!({
            "job_id": raw_id,
            "header": hex::encode([0xabu8; 76]),
            "target": hex::encode([0x11u8; 32]),
            "height": 99u64,
            "cert_version": 3u64,
        })
    }

    async fn connected_upstream(verdict: Verdict) -> (Arc<PearlUpstream>, Arc<Mutex<Vec<String>>>) {
        let std_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        std_listener.set_nonblocking(true).unwrap();
        let addr = std_listener.local_addr().unwrap().to_string();
        let calls = spawn_mock_upstream(std_listener, Some(notify_params("up-job-1")), verdict);
        let up = PearlUpstream::new(test_cfg(&addr));
        assert!(up.ensure_started());
        tokio::time::timeout(Duration::from_secs(5), async {
            while up.latest_fresh().is_none() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("upstream job arrives");
        (up, calls)
    }

    #[tokio::test]
    async fn upstream_connects_caches_job_and_accepts() {
        let (up, calls) = connected_upstream(Verdict::Accept).await;
        let job = up.latest_fresh().unwrap();
        assert_eq!(job.served_id, "prlu:up-job-1");
        assert_eq!(job.raw_id, "up-job-1");
        assert_eq!(job.cert_version, 3);
        let ext = job.ext_stream_job();
        assert_eq!(ext.coin, "PRL");
        assert_eq!(ext.algorithm, "pearlhash");
        assert_eq!(ext.protocol, "pearlpool");
        assert_eq!(ext.job_id, "prlu:up-job-1");
        assert_eq!(ext.target_hex, hex::encode([0x11u8; 32]));
        assert_eq!(ext.eq_params, "3");

        let reply = up.submit("prlu:up-job-1", "up-job-1", "QUJD").await;
        assert_eq!(reply, UpstreamSubmitReply::Accepted);
        let submits: Vec<String> = calls
            .lock()
            .unwrap()
            .iter()
            .filter(|l| l.contains("mining.submit"))
            .cloned()
            .collect();
        assert_eq!(submits.len(), 1);
        assert!(submits[0].contains("\"job_id\":\"up-job-1\""));
        assert!(!submits[0].contains("prlu:"));
        assert_eq!(up.pending.load(Ordering::Relaxed), 0);
        assert_eq!(up.submits.load(Ordering::Relaxed), 1);
        assert_eq!(up.accepted.load(Ordering::Relaxed), 1);
        let (en, conn, jid, _age, pend) = up.status();
        assert!(en && conn);
        assert_eq!(jid.as_deref(), Some("prlu:up-job-1"));
        assert_eq!(pend, 0);
        let sj = up.status_json();
        assert_eq!(sj["connected"], true);
        assert_eq!(sj["job_id"], "prlu:up-job-1");
        assert_eq!(sj["submits"], 1);
        assert_eq!(sj["accepted"], 1);
    }

    #[tokio::test]
    async fn upstream_reject_maps_message() {
        let (up, _calls) = connected_upstream(Verdict::Reject("low difficulty")).await;
        let reply = up.submit("prlu:up-job-1", "up-job-1", "QUJD").await;
        match reply {
            UpstreamSubmitReply::Rejected(m) => assert_eq!(m, "low difficulty"),
            other => panic!("expected Rejected, got {other:?}"),
        }
        assert_eq!(up.rejected.load(Ordering::Relaxed), 1);
        assert_eq!(up.status_json()["rejected"], 1);
    }

    #[tokio::test]
    async fn upstream_drop_maps_unknown() {
        let (up, _calls) = connected_upstream(Verdict::Drop).await;
        let reply = up.submit("prlu:up-job-1", "up-job-1", "QUJD").await;
        assert_eq!(reply, UpstreamSubmitReply::Unknown);
        assert_eq!(up.unknown.load(Ordering::Relaxed), 1);
        assert_eq!(up.status_json()["unknown"], 1);
    }

    #[tokio::test]
    async fn disconnect_keeps_job_and_resolves_queued_submits() {
        let std_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        std_listener.set_nonblocking(true).unwrap();
        let addr = std_listener.local_addr().unwrap().to_string();
        let _calls = spawn_mock_upstream(
            std_listener,
            Some(notify_params("up-job-9")),
            Verdict::CloseAfterNotify,
        );
        let up = PearlUpstream::new(test_cfg(&addr));
        let mut waiters = Vec::new();
        for _ in 0..2 {
            let (tx, rx) = oneshot::channel();
            up.pending.fetch_add(1, Ordering::Relaxed);
            up.submit_tx
                .try_send(SubmitReq {
                    served_id: "prlu:up-job-9".to_string(),
                    job_id: "up-job-9".to_string(),
                    proof_b64: "QUJD".to_string(),
                    reply: tx,
                })
                .unwrap();
            waiters.push(rx);
        }
        assert!(up.ensure_started());
        // Queued submits are NOT drained on session end: each one rides the
        // next reconnect (~BACKOFF_BASE apart) and resolves with a real
        // verdict — `Unknown` here because the mock drops every session
        // right after the notify.
        for rx in waiters {
            let reply = tokio::time::timeout(Duration::from_secs(30), rx)
                .await
                .unwrap()
                .unwrap();
            assert_eq!(reply, UpstreamSubmitReply::Unknown);
        }
        assert_eq!(up.pending.load(Ordering::Relaxed), 0);
        assert!(up.unknown.load(Ordering::Relaxed) >= 2);
        // The job ring is kept through reconnects (freshness is bounded by
        // job_ttl, not by session state) — and the mock keeps re-notifying
        // the same template on every reconnect.
        assert!(up.latest_fresh().is_some());
        assert!(up.job_by_served_id("prlu:up-job-9").is_some());
    }

    #[tokio::test]
    async fn queued_submit_resolves_on_reconnect() {
        // First session dies right after the notify; later sessions accept
        // submits. A share queued while disconnected must wait for the next
        // session and come back Accepted — not drained to Unknown.
        let std_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        std_listener.set_nonblocking(true).unwrap();
        let addr = std_listener.local_addr().unwrap().to_string();
        let conn_count = Arc::new(AtomicUsize::new(0));
        let cc = conn_count.clone();
        tokio::spawn(async move {
            let listener = TcpListener::from_std(std_listener).unwrap();
            while let Ok((socket, _)) = listener.accept().await {
                let n = cc.fetch_add(1, Ordering::SeqCst);
                tokio::spawn(async move {
                    let (r, mut w) = socket.into_split();
                    let mut br = BufReader::new(r);
                    let mut line = String::new();
                    if br.read_line(&mut line).await.is_err() {
                        return;
                    }
                    if w
                        .write_all(b"{\"id\":1,\"result\":true,\"error\":null}\n")
                        .await
                        .is_err()
                    {
                        return;
                    }
                    let frame = format!(
                        "{}\n",
                        serde_json::json!({"jsonrpc":"2.0","method":"mining.notify","params": notify_params("up-job-1")})
                    );
                    if w.write_all(frame.as_bytes()).await.is_err() || n == 0 {
                        return; // first session ends immediately after notify
                    }
                    loop {
                        line.clear();
                        match br.read_line(&mut line).await {
                            Ok(0) | Err(_) => return,
                            Ok(_) => {
                                let v: Value =
                                    serde_json::from_str(line.trim()).unwrap_or_default();
                                if v["method"].as_str() == Some("mining.submit") {
                                    let resp = format!(
                                        "{{\"id\":{},\"result\":true,\"error\":null}}\n",
                                        v["id"]
                                    );
                                    if w.write_all(resp.as_bytes()).await.is_err() {
                                        return;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        });
        let up = PearlUpstream::new(test_cfg(&addr));
        assert!(up.ensure_started());
        tokio::time::timeout(Duration::from_secs(5), async {
            while up.latest_fresh().is_none() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("first notify arrives");
        tokio::time::timeout(Duration::from_secs(5), async {
            while up.connected.load(Ordering::Relaxed) {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("first session ends");
        // Submitted while disconnected — rides the next session (≤ BACKOFF).
        let reply = tokio::time::timeout(
            Duration::from_secs(30),
            up.submit("prlu:up-job-1", "up-job-1", "QUJD"),
        )
        .await
        .expect("queued submit resolves");
        assert_eq!(reply, UpstreamSubmitReply::Accepted);
        assert_eq!(up.accepted.load(Ordering::Relaxed), 1);
        assert!(conn_count.load(Ordering::SeqCst) >= 2);
    }
}
