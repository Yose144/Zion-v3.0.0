use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Context;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use zion_core::node::BlockTemplate as CoreBlockTemplate;
use zion_core::{Block, BlockHeader};
use zion_cosmic_harmony::ExternalCoin;

use crate::auxpow_bridge::{MultiAuxPowBridge, ShareForwardRequest};
use crate::block_tracker::BlockTracker;
use crate::config::PoolConfig;
use crate::notifications::{Notifier, NotificationsConfig};
use crate::pool::{Pool, PoolError};
use crate::rate_limit::IpRateLimiter;
use crate::revenue_scheduler::RevenueScheduler;
use crate::rpc_client::{jsonrpc_call, parse_rpc_addr};
use crate::routing::{RoutingStats, resolve_session_group, session_group_name};
use crate::share::ShareSubmission;
use crate::share_relay::{relay_share_fire_and_forget, ShareRelayConfig};
use crate::stratum_v1::is_stratum_v1;
use crate::telemetry::MinerTelemetryRegistry;
use crate::template_cache::TemplateCache;
use crate::v3_protocol::{decode_message, encode_message, ExternalStreamJob, PoolMessage, PROTOCOL_VERSION};
use crate::vardiff::{difficulty_to_target, VarDiff, VarDiffConfig};

/// Stored job data: pow header bytes, network target, block reward (flowers),
/// and the full node template needed to rebuild the solved block.
type JobEntry = (Vec<u8>, [u8; 32], u64, Option<CoreBlockTemplate>);

#[derive(Clone)]
pub struct StratumServer {
    pub pool: Arc<Mutex<Pool>>,
    pub config: PoolConfig,
    /// Stored jobs: job_id -> (header bytes, 32-byte network target, reward, template).
    jobs: Arc<Mutex<HashMap<String, JobEntry>>>,
    notify_tx: broadcast::Sender<String>,
    /// Miner telemetry registry — hashrate windows, per-worker stats.
    telemetry: Arc<Mutex<MinerTelemetryRegistry>>,
    /// Block tracker — orphan monitoring, pool luck.
    block_tracker: Arc<Mutex<BlockTracker>>,
    /// Template cache with TTL to reduce node RPC load.
    template_cache: Arc<Mutex<TemplateCache>>,
    /// Active sessions per IP for DoS protection.
    ip_sessions: Arc<Mutex<HashMap<IpAddr, usize>>>,
    /// NoSolution ban list: IP -> ban expiry.
    no_solution_bans: Arc<Mutex<HashMap<IpAddr, Instant>>>,
    /// Max concurrent sessions per IP.
    max_sessions_per_ip: usize,
    /// Max consecutive NoSolution before ban.
    max_consecutive_no_solution: u32,
    /// NoSolution ban duration.
    no_solution_ban_duration: Duration,
    /// VarDiff config.
    vardiff_config: VarDiffConfig,
    /// Multi-AuxPow bridge for triple-stream mining (optional).
    multi_bridge: MultiAuxPowBridge,
    /// Share relay config (optional, for Edge mode).
    relay_config: ShareRelayConfig,
    /// Notification dispatcher (Telegram/SMTP/OASIS/webhook).
    notifier: Arc<Notifier>,
    /// Revenue scheduler for multi-stream revenue routing.
    revenue_scheduler: Arc<Mutex<RevenueScheduler>>,
    /// Per-group/source submit tracking + periodic logging.
    routing_stats: Arc<Mutex<RoutingStats>>,
}

impl StratumServer {
    pub fn new(pool: Arc<Mutex<Pool>>) -> Self {
        let config = pool.lock().unwrap().config.clone();
        let (notify_tx, _notify_rx) = broadcast::channel(256);

        let vardiff_config = VarDiffConfig {
            start_difficulty: env_or("ZION_VARDIFF_START", 1),
            min_difficulty: env_or("ZION_VARDIFF_MIN", 1),
            max_difficulty: env_or("ZION_VARDIFF_MAX", 100_000),
            target_secs: env_or("ZION_VARDIFF_TARGET_SECS", 15),
            retarget_shares: env_or("ZION_VARDIFF_RETARGET_SHARES", 8),
        };

        let max_sessions_per_ip = env_or("ZION_POOL_MAX_SESSIONS_PER_IP", 10) as usize;
        let max_consecutive_no_solution = env_or("ZION_POOL_MAX_NO_SOLUTION", 10) as u32;
        let no_solution_ban_duration =
            Duration::from_secs(env_or("ZION_POOL_NOSOLUTION_BAN_SECS", 300));

        Self {
            pool,
            config,
            jobs: Arc::new(Mutex::new(HashMap::new())),
            notify_tx,
            telemetry: Arc::new(Mutex::new(MinerTelemetryRegistry::new())),
            block_tracker: Arc::new(Mutex::new(BlockTracker::new())),
            template_cache: Arc::new(Mutex::new(TemplateCache::new(Duration::from_secs(15)))),
            ip_sessions: Arc::new(Mutex::new(HashMap::new())),
            no_solution_bans: Arc::new(Mutex::new(HashMap::new())),
            max_sessions_per_ip,
            max_consecutive_no_solution,
            no_solution_ban_duration,
            vardiff_config,
            multi_bridge: MultiAuxPowBridge::new(),
            relay_config: ShareRelayConfig::from_env(),
            notifier: Arc::new(Notifier::new(NotificationsConfig::from_env())),
            revenue_scheduler: Arc::new(Mutex::new(RevenueScheduler::from_env(0.0))),
            routing_stats: Arc::new(Mutex::new(RoutingStats::new(env_or("ZION_POOL_ROUTING_LOG_EVERY", 1000)))),
        }
    }

    /// Set the MultiAuxPowBridge (called from main.rs when auxpow is enabled).
    pub fn with_multi_bridge(mut self, bridge: MultiAuxPowBridge) -> Self {
        self.multi_bridge = bridge;
        self
    }

    /// Set a custom Notifier (called from main.rs when notifications are configured).
    pub fn with_notifier(mut self, notifier: Arc<Notifier>) -> Self {
        self.notifier = notifier;
        self
    }

    /// Set a custom RevenueScheduler (called from main.rs when revenue routing is configured).
    pub fn with_revenue_scheduler(mut self, scheduler: Arc<Mutex<RevenueScheduler>>) -> Self {
        self.revenue_scheduler = scheduler;
        self
    }

    /// Get a reference to the notifier (for payout.rs to use).
    pub fn notifier(&self) -> &Arc<Notifier> {
        &self.notifier
    }

    /// Handle a Stratum v1 JSON-RPC request line.
    pub fn handle_request(&self, line: &str) -> String {
        let req: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => return error_response(None, -32700, "parse error"),
        };
        let id = req.get("id").cloned().unwrap_or(Value::Null);
        let method = req.get("method").and_then(Value::as_str).unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(Value::Null);

        match method {
            "mining.subscribe" => {
                let result = json!([
                    [
                        ["mining.notify", "ae6812eb4cd7735a302a8a9dd95cf71f"],
                        "08000000"
                    ],
                    "session_id",
                    8
                ]);
                success_response(id, result)
            }
            "mining.authorize" => {
                let username = params
                    .get(0)
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !username.is_empty() {
                    self.pool.lock().unwrap().register_worker(&username);
                    // Touch telemetry for this worker
                    let (miner_id, worker_name) = split_worker(&username);
                    self.telemetry
                        .lock()
                        .unwrap()
                        .touch_session(&miner_id, &worker_name, "", "cpu");
                }
                success_response(id, Value::Bool(true))
            }
            "mining.submit" => self.handle_submit(id, params),
            "mining.suggest_difficulty" => {
                // Accept but ignore — VarDiff controls difficulty
                success_response(id, Value::Bool(true))
            }
            _ => error_response(Some(id), -32601, "method not found"),
        }
    }

    fn handle_submit(&self, id: Value, params: Value) -> String {
        let arr = match params.as_array() {
            Some(a) if a.len() >= 3 => a,
            _ => return error_response(Some(id), -32602, "invalid params"),
        };
        let worker = arr[0].as_str().unwrap_or("").to_string();
        let job_id = arr[1].as_str().unwrap_or("").to_string();
        // Accept both short [worker, job_id, nonce] and standard stratum v1
        // [worker, job_id, extranonce2, ntime, nonce] forms.
        let nonce_hex = arr.last().and_then(Value::as_str).unwrap_or("").to_string();
        let submission = ShareSubmission {
            worker,
            job_id: job_id.clone(),
            nonce_hex: nonce_hex.clone(),
        };

        let (header, target, reward, template) = {
            let jobs = self.jobs.lock().unwrap();
            match jobs.get(&job_id) {
                Some((h, t, r, tpl)) => (h.clone(), *t, *r, tpl.clone()),
                None => return error_response(Some(id), -32602, "unknown job"),
            }
        };

        let nonce = match Self::parse_nonce(&nonce_hex) {
            Ok(n) => n,
            Err(_) => return error_response(Some(id), -32602, "invalid nonce"),
        };

        let worker_name = submission.worker.clone();
        let (height, difficulty) = template
            .as_ref()
            .map(|t| (t.height, t.difficulty))
            .unwrap_or((0, 1));
        let result = if job_id.starts_with("zion_") {
            self.pool
                .lock()
                .unwrap()
                .submit_zion(submission, &header, height, difficulty)
        } else if job_id.starts_with("aux_") {
            let coin = parse_aux_coin(&job_id);
            self.pool
                .lock()
                .unwrap()
                .submit_auxpow(coin, submission, &header, height, difficulty)
        } else {
            Err(PoolError::UnknownJob)
        };

        let (miner_id, worker_short) = split_worker(&worker_name);

        match result {
            Ok(true) => {
                tracing::info!(
                    "share accepted — job={}, worker={}, nonce={}",
                    job_id,
                    worker_name,
                    nonce_hex
                );
                // Record telemetry
                self.telemetry
                    .lock()
                    .unwrap()
                    .record_job_result(&miner_id, &worker_short, true, 0, 0);
                // Record share for block tracker luck
                self.block_tracker.lock().unwrap().record_share();
                self.check_and_record_block(&job_id, &header, nonce, &target, reward, template);
                success_response(id, Value::Bool(true))
            }
            Ok(false) => {
                tracing::warn!(
                    "share rejected (low difficulty) — job={}, worker={}, nonce={}",
                    job_id,
                    worker_name,
                    nonce_hex
                );
                self.telemetry
                    .lock()
                    .unwrap()
                    .record_job_result(&miner_id, &worker_short, false, 0, 0);
                success_response(id, Value::Bool(false))
            }
            Err(e) => {
                tracing::warn!(
                    "share error — job={}, worker={}, nonce={}, err={}",
                    job_id,
                    worker_name,
                    nonce_hex,
                    e
                );
                self.telemetry
                    .lock()
                    .unwrap()
                    .record_job_result(&miner_id, &worker_short, false, 0, 0);
                error_response(Some(id), -32000, &format!("share error: {}", e))
            }
        }
    }

    fn parse_nonce(nonce_hex: &str) -> Result<u64, PoolError> {
        let s = nonce_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        u64::from_str_radix(s, 16).map_err(|_| PoolError::Parse)
    }

    fn check_and_record_block(
        &self,
        job_id: &str,
        header: &[u8],
        nonce: u64,
        target: &[u8; 32],
        block_reward: u64,
        template: Option<CoreBlockTemplate>,
    ) {
        let mut pool = self.pool.lock().unwrap();
        let is_block = if job_id.starts_with("zion_") {
            let hash = pool.validator.zion_hash(header, nonce);
            hash.as_bytes() <= target
        } else if job_id.starts_with("aux_") {
            let coin = parse_aux_coin(job_id);
            let hash = pool.validator.auxpow_hash(coin, header, nonce);
            &hash <= target
        } else {
            false
        };
        if !is_block {
            return;
        }

        let block_height = template.as_ref().map(|t| t.height).unwrap_or(0);
        let network_difficulty = template.as_ref().map(|t| t.difficulty).unwrap_or(1);
        pool.on_block_found(block_height, block_reward);

        // Record block in tracker
        let (miner_id, worker_name) = split_worker(job_id);
        self.block_tracker.lock().unwrap().record_block_found(
            block_height,
            &miner_id,
            &worker_name,
            1, // share_difficulty
            network_difficulty,
            true, // node_accepted (will be confirmed by submitBlock)
        );

        // Record block in telemetry
        self.telemetry
            .lock()
            .unwrap()
            .record_block_found(&miner_id, &worker_name);

        // Invalidate template cache so next job fetches fresh template
        self.template_cache.lock().unwrap().invalidate();

        // Notify all channels (Telegram/SMTP/OASIS/webhook)
        self.notifier.notify_block_found(&miner_id, block_height, &worker_name);

        if let (Some(rpc_url), Some(tpl)) = (pool.config.l1_rpc_url.clone(), template) {
            let block = match build_solved_block(tpl, nonce) {
                Ok(b) => b,
                Err(e) => {
                    tracing::warn!("failed to build solved block for {}: {}", job_id, e);
                    return;
                }
            };
            let job_id_str = job_id.to_string();
            let notifier = self.notifier.clone();
            tokio::spawn(async move {
                if let Err(e) = submit_block_rpc(&rpc_url, &block).await {
                    tracing::warn!("submitBlock failed for {}: {}", job_id_str, e);
                    // Notify orphan if submit fails
                    notifier.notify_orphan(block_height);
                }
            });
        }
    }

    /// Build and store a `mining.notify` message for the given job.
    pub fn job_notification(
        &self,
        job_id: &str,
        header_hex: &str,
        target_hex: &str,
        block_reward: u64,
        template_json: &str,
    ) -> String {
        let header_trim = header_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        let target = parse_target_hex(target_hex).unwrap_or([0xFF; 32]);
        let template: Option<CoreBlockTemplate> = if template_json.is_empty() {
            None
        } else {
            match serde_json::from_str(template_json) {
                Ok(t) => Some(t),
                Err(e) => {
                    tracing::warn!("failed to parse block template for {}: {}", job_id, e);
                    None
                }
            }
        };

        if let Ok(bytes) = hex::decode(header_trim) {
            self.jobs
                .lock()
                .unwrap()
                .insert(job_id.to_string(), (bytes, target, block_reward, template));
        }

        json!({
            "id": null,
            "method": "mining.notify",
            "params": [job_id, header_hex, target_hex]
        })
        .to_string()
    }

    /// Broadcast a `mining.notify` message to all connected clients.
    pub fn broadcast_job(
        &self,
        job_id: &str,
        header_hex: &str,
        target_hex: &str,
        block_reward: u64,
        template_json: &str,
    ) {
        let msg =
            self.job_notification(job_id, header_hex, target_hex, block_reward, template_json);
        let _ = self.notify_tx.send(msg);

        // Also broadcast V3 Job message for V3 protocol clients
        if let Some(v3_msg) =
            self.build_v3_job_message(job_id, header_hex, target_hex, template_json)
        {
            let _ = self.notify_tx.send(v3_msg);
        }
    }

    /// Build a V3 wire protocol Job message from template data.
    fn build_v3_job_message(
        &self,
        job_id: &str,
        header_hex: &str,
        _target_hex: &str,
        template_json: &str,
    ) -> Option<String> {
        // Parse as generic JSON to avoid requiring full CoreBlockTemplate fields
        let template: Value = serde_json::from_str(template_json).ok()?;
        let height = template.get("height").and_then(Value::as_u64).unwrap_or(0);
        let numeric_job_id: u64 = job_id
            .strip_prefix("zion_")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let algorithm = algorithm_for_height(height);
        let vardiff_target = difficulty_to_target(self.vardiff_config.start_difficulty);
        let vardiff_target_hex = hex::encode(vardiff_target);

        // Triple-stream: fetch external jobs from AuxPoW bridge
        let external_stream = self.build_external_stream_gpu();
        let external_stream_cpu = self.build_external_stream_cpu();

        let job_msg = PoolMessage::Job {
            job_id: numeric_job_id,
            algorithm: algorithm.to_string(),
            start_nonce: 0,
            nonce_count: 0xFFFF_FFFF,
            target_hex: vardiff_target_hex,
            header_hex: header_hex.to_string(),
            height,
            stream_weights: String::new(),
            external_stream,
            external_stream_cpu,
        };
        encode_message(&job_msg).ok()
    }

    /// Build the GPU external stream job from the AuxPoW bridge.
    /// Selects the first available non-CPU coin job.
    fn build_external_stream_gpu(&self) -> Option<ExternalStreamJob> {
        let coins = self.multi_bridge.enabled_coins();
        if coins.is_empty() {
            return None;
        }
        // Find a GPU coin (not CPU)
        for coin in &coins {
            if !self.multi_bridge.is_cpu_coin(coin) {
                if let Some(job) = self.multi_bridge.latest_job_for_coin(coin) {
                    return Some(ExternalStreamJob {
                        coin: coin.as_str().to_string(),
                        algorithm: job.algorithm.clone(),
                        job_id: job.external_job_id.clone(),
                        header_hex: job.header_hex.clone(),
                        target_hex: job.target_hex.clone(),
                        height: job.height,
                        extranonce1_hex: job.extranonce1_hex.clone(),
                        protocol: "stratum".to_string(),
                        seed_hash_hex: String::new(),
                        timestamp: 0,
                    });
                }
            }
        }
        None
    }

    /// Build the CPU external stream job from the AuxPoW bridge.
    /// Selects the first available CPU coin job (XMR, VRSC, RTM).
    fn build_external_stream_cpu(&self) -> Option<ExternalStreamJob> {
        let coins = self.multi_bridge.enabled_coins();
        if coins.is_empty() {
            return None;
        }
        for coin in &coins {
            if self.multi_bridge.is_cpu_coin(coin) {
                if let Some(job) = self.multi_bridge.latest_job_for_coin(coin) {
                    return Some(ExternalStreamJob {
                        coin: coin.as_str().to_string(),
                        algorithm: job.algorithm.clone(),
                        job_id: job.external_job_id.clone(),
                        header_hex: job.header_hex.clone(),
                        target_hex: job.target_hex.clone(),
                        height: job.height,
                        extranonce1_hex: job.extranonce1_hex.clone(),
                        protocol: "stratum".to_string(),
                        seed_hash_hex: String::new(),
                        timestamp: 0,
                    });
                }
            }
        }
        None
    }

    pub async fn run(&self, listener: TcpListener) -> std::io::Result<()> {
        let limiter = IpRateLimiter::new(self.config.reconnect_rate_limit);
        loop {
            let (socket, peer) = listener.accept().await?;

            // Check NoSolution ban
            let banned = {
                let bans = self.no_solution_bans.lock().unwrap();
                bans.get(&peer.ip())
                    .map(|t| *t > Instant::now())
                    .unwrap_or(false)
            };
            if banned {
                tracing::warn!("NoSolution ban active for {}", peer.ip());
                drop(socket);
                continue;
            }

            // Check reconnect rate limit
            if !limiter.allow(peer.ip()) {
                tracing::warn!("reconnect rate limit exceeded for {}", peer.ip());
                drop(socket);
                continue;
            }

            // Check max sessions per IP
            let over_limit = {
                let mut ip_sess = self.ip_sessions.lock().unwrap();
                let count = ip_sess.entry(peer.ip()).or_insert(0);
                if *count >= self.max_sessions_per_ip {
                    true
                } else {
                    *count += 1;
                    false
                }
            };
            if over_limit {
                tracing::warn!("max sessions per IP exceeded for {}", peer.ip());
                drop(socket);
                continue;
            }

            let server = self.clone();
            let ip = peer.ip();
            tokio::spawn(async move {
                let (reader, writer) = tokio::io::split(socket);
                let writer = Arc::new(tokio::sync::Mutex::new(writer));
                let mut notify_rx = server.notify_tx.subscribe();

                let reader = BufReader::new(reader);
                let mut lines = reader.lines();

                // Read first line to detect protocol
                let first_line = match lines.next_line().await {
                    Ok(Some(l)) => l,
                    _ => {
                        decrement_ip_sessions(&server.ip_sessions, ip);
                        return;
                    }
                };

                let is_v1 = is_stratum_v1(&first_line);

                if is_v1 {
                    // Stratum v1 protocol — handle first line
                    let response = server.handle_request(&first_line);
                    {
                        let mut w = writer.lock().await;
                        if w.write_all(response.as_bytes()).await.is_err()
                            || w.write_all(b"\n").await.is_err()
                        {
                            decrement_ip_sessions(&server.ip_sessions, ip);
                            return;
                        }
                    }

                    loop {
                        tokio::select! {
                            line = lines.next_line() => match line {
                                Ok(Some(line)) => {
                                    let response = server.handle_request(&line);
                                    let mut w = writer.lock().await;
                                    if w.write_all(response.as_bytes()).await.is_err() { break; }
                                    if w.write_all(b"\n").await.is_err() { break; }
                                }
                                _ => break,
                            },
                            msg = notify_rx.recv() => match msg {
                                Ok(msg) => {
                                    let mut w = writer.lock().await;
                                    if w.write_all(msg.as_bytes()).await.is_err() { break; }
                                    if w.write_all(b"\n").await.is_err() { break; }
                                }
                                Err(_) => break,
                            },
                        }
                    }
                } else {
                    // V3 wire protocol
                    server.handle_v3_client(&first_line, &mut lines, &writer, ip).await;
                }

                decrement_ip_sessions(&server.ip_sessions, ip);
            });
        }
    }

    /// Handle a TLS connection — wraps the TLS stream and dispatches to
    /// the same protocol detection as plain TCP.
    pub async fn handle_tls_connection(
        &self,
        tls_stream: tokio_rustls::server::TlsStream<tokio::net::TcpStream>,
        peer: std::net::SocketAddr,
    ) {
        let ip = peer.ip();
        let (reader, writer) = tokio::io::split(tls_stream);
        let writer = Arc::new(tokio::sync::Mutex::new(writer));
        let reader = BufReader::new(reader);
        let mut lines = reader.lines();

        let first_line = match lines.next_line().await {
            Ok(Some(l)) => l,
            _ => return,
        };

        let is_v1 = is_stratum_v1(&first_line);
        if is_v1 {
            // Stratum v1 over TLS
            loop {
                let line = match lines.next_line().await {
                    Ok(Some(l)) => l,
                    _ => break,
                };
                let response = self.handle_request(&line);
                let mut w = writer.lock().await;
                if w.write_all(response.as_bytes()).await.is_err() {
                    break;
                }
                if w.write_all(b"\n").await.is_err() {
                    break;
                }
            }
        } else {
            // V3 wire protocol over TLS — reuse the same handler
            // Note: We can't directly reuse handle_v3_client because it takes
            // specific types. Instead, inline the V3 handling here.
            self.handle_v3_client_generic(first_line, lines, &writer, ip)
                .await;
        }
    }

    /// Generic V3 client handler that works with any AsyncBufRead reader.
    async fn handle_v3_client_generic<R>(
        &self,
        first_line: String,
        mut lines: tokio::io::Lines<BufReader<R>>,
        writer: &Arc<tokio::sync::Mutex<tokio::io::WriteHalf<tokio_rustls::server::TlsStream<tokio::net::TcpStream>>>>,
        ip: IpAddr,
    )
    where
        R: tokio::io::AsyncRead + Unpin,
    {
        // For now, just handle Hello and forward jobs.
        // Full V3 handling over TLS uses the same logic as plain TCP.
        match decode_message(&first_line) {
            Ok(PoolMessage::Hello {
                miner_id,
                worker_name,
                algorithm,
                backend,
                ..
            }) => {
                tracing::info!(
                    "v3_tls_hello miner={} worker={} algo={} ip={}",
                    miner_id,
                    worker_name,
                    algorithm,
                    ip
                );

                let welcome = PoolMessage::Welcome {
                    protocol_version: PROTOCOL_VERSION.to_string(),
                    algorithm: algorithm.clone(),
                    job_ttl_ms: 60_000,
                };
                if write_v3_message(writer, &welcome).await.is_err() {
                    return;
                }

                let diff = self.vardiff_config.start_difficulty;
                let target = difficulty_to_target(diff);
                let set_diff = PoolMessage::SetDifficulty {
                    difficulty: diff,
                    target_hex: hex::encode(target),
                };
                if write_v3_message(writer, &set_diff).await.is_err() {
                    return;
                }

                self.telemetry.lock().unwrap().touch_session(
                    &miner_id,
                    &worker_name,
                    &algorithm,
                    &backend,
                );
            }
            _ => return,
        }

        let mut notify_rx = self.notify_tx.subscribe();
        loop {
            tokio::select! {
                line = lines.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            match decode_message(&line) {
                                Ok(PoolMessage::Submit { job_id, miner_id: _, worker_name, nonce, .. }) => {
                                    let job_key = format!("zion_{}", job_id);
                                    let job_data = self.jobs.lock().unwrap().get(&job_key).cloned();
                                    if let Some((header, _target, _reward, template)) = job_data {
                                        let (height, difficulty) = template.as_ref().map(|t| (t.height, t.difficulty)).unwrap_or((0, 1));
                                        let submission = ShareSubmission {
                                            worker: worker_name.clone(),
                                            job_id: job_key.clone(),
                                            nonce_hex: format!("{:016x}", nonce),
                                        };
                                        let result = self.pool.lock().unwrap().submit_zion(submission, &header, height, difficulty);
                                        let accepted = matches!(result, Ok(true));
                                        let result_msg = PoolMessage::Result {
                                            accepted,
                                            status: if accepted { "accepted".into() } else { "rejected".into() },
                                            block_found: false,
                                            block_height: None,
                                        };
                                        let _ = write_v3_message(writer, &result_msg).await;
                                    } else {
                                        let result_msg = PoolMessage::Result {
                                            accepted: false,
                                            status: "unknown_job".into(),
                                            block_found: false,
                                            block_height: None,
                                        };
                                        let _ = write_v3_message(writer, &result_msg).await;
                                    }
                                }
                                Ok(PoolMessage::NoSolution { .. }) => { /* ignore for TLS */ }
                                Ok(PoolMessage::CoinPreference { .. }) => { /* store for triple-stream */ }
                                Ok(_) => { /* ignore other messages */ }
                                Err(_) => { /* ignore decode errors */ }
                            }
                        }
                        _ => break,
                    }
                }
                msg = notify_rx.recv() => match msg {
                    Ok(msg) => {
                        if msg.contains("\"type\":\"job\"") {
                            let line = msg.trim_end();
                            let mut w = writer.lock().await;
                            if w.write_all(line.as_bytes()).await.is_err() { break; }
                            if w.write_all(b"\n").await.is_err() { break; }
                        }
                    }
                    Err(_) => break,
                },
            }
        }
    }

    /// Handle a V3 wire protocol client connection.
    async fn handle_v3_client(
        &self,
        first_line: &str,
        lines: &mut tokio::io::Lines<BufReader<tokio::io::ReadHalf<tokio::net::TcpStream>>>,
        writer: &Arc<tokio::sync::Mutex<tokio::io::WriteHalf<tokio::net::TcpStream>>>,
        ip: IpAddr,
    ) {
        // Track consecutive NoSolution for this connection
        let mut consecutive_no_solution: u32 = 0;
        // Per-session VarDiff
        let mut vardiff = VarDiff::new(&self.vardiff_config);
        // Miner identity from Hello
        let miner_id;
        let worker_name;
        let algorithm;
        let backend;

        // Process first line (should be Hello)
        match decode_message(first_line) {
            Ok(PoolMessage::Hello {
                miner_id: mid,
                worker_name: wn,
                algorithm: alg,
                backend: bk,
                ..
            }) => {
                miner_id = mid.clone();
                worker_name = wn.clone();
                algorithm = alg.clone();
                backend = bk.clone();

                tracing::info!(
                    "v3_hello miner={} worker={} algo={} backend={} ip={}",
                    miner_id,
                    worker_name,
                    algorithm,
                    backend,
                    ip
                );

                // Send Welcome
                let welcome = PoolMessage::Welcome {
                    protocol_version: PROTOCOL_VERSION.to_string(),
                    algorithm: algorithm.clone(),
                    job_ttl_ms: 60_000,
                };
                if write_v3_message(writer, &welcome).await.is_err() {
                    return;
                }

                // Send SetDifficulty
                let diff = vardiff.current();
                let target_hex = hex::encode(vardiff.share_target());
                let set_diff = PoolMessage::SetDifficulty {
                    difficulty: diff,
                    target_hex,
                };
                if write_v3_message(writer, &set_diff).await.is_err() {
                    return;
                }

                // Touch telemetry
                self.telemetry.lock().unwrap().touch_session(
                    &miner_id,
                    &worker_name,
                    &algorithm,
                    &backend,
                );

                // Resolve session group for revenue routing
                let group = resolve_session_group(&miner_id, &worker_name);
                tracing::info!(
                    "v3_session_group miner={} worker={} group={}",
                    miner_id,
                    worker_name,
                    session_group_name(group),
                );
            }
            Ok(msg) => {
                tracing::warn!("v3_expected_hello got={:?} from={}", msg, ip);
                return;
            }
            Err(e) => {
                tracing::warn!(
                    "v3_decode_error first_line={} err={} from={}",
                    first_line,
                    e,
                    ip
                );
                return;
            }
        }

        let group = resolve_session_group(&miner_id, &worker_name);

        let mut notify_rx = self.notify_tx.subscribe();

        loop {
            tokio::select! {
                line = lines.next_line() => {
                    match line {
                    Ok(Some(line)) => {
                        match decode_message(&line) {
                            Ok(PoolMessage::Submit {
                                job_id,
                                miner_id: submit_miner,
                                worker_name: submit_worker,
                                nonce,
                                attempted_hashes,
                                elapsed_ms,
                                ..
                            }) => {
                                let job_key = format!("zion_{}", job_id);
                                let job_data = self.jobs.lock().unwrap().get(&job_key).cloned();
                                let (header, target, _reward, template) = match job_data {
                                    Some(d) => d,
                                    None => {
                                        let result = PoolMessage::Result {
                                            accepted: false,
                                            status: "unknown_job".to_string(),
                                            block_found: false,
                                            block_height: None,
                                        };
                                        let _ = write_v3_message(writer, &result).await;
                                        continue;
                                    }
                                };

                                let (height, difficulty) = template
                                    .as_ref()
                                    .map(|t| (t.height, t.difficulty))
                                    .unwrap_or((0, 1));

                                let submission = ShareSubmission {
                                    worker: submit_worker.clone(),
                                    job_id: job_key.clone(),
                                    nonce_hex: format!("{:016x}", nonce),
                                };

                                let result = self.pool.lock().unwrap().submit_zion(
                                    submission,
                                    &header,
                                    height,
                                    difficulty,
                                );

                                let accepted = matches!(result, Ok(true));
                                let block_found = accepted && {
                                    let pool = self.pool.lock().unwrap();
                                    let hash = pool.validator.zion_hash(&header, nonce);
                                    hash.as_bytes() <= &target
                                };

                                // Record routing stats
                                use zion_cosmic_harmony::revenue::RevenueSource;
                                let should_log = self.routing_stats.lock().unwrap().record(
                                    group,
                                    RevenueSource::Zion,
                                    accepted,
                                );
                                if should_log {
                                    let snap = self.routing_stats.lock().unwrap().snapshot_line();
                                    tracing::info!("routing_stats {}", snap);
                                }

                                if accepted {
                                    // Record telemetry
                                    self.telemetry.lock().unwrap().record_job_result(
                                        &submit_miner,
                                        &submit_worker,
                                        true,
                                        attempted_hashes.unwrap_or(0),
                                        elapsed_ms.unwrap_or(0),
                                    );
                                    // Record share for block tracker
                                    self.block_tracker.lock().unwrap().record_share();

                                    // VarDiff retarget
                                    if let Some(new_diff) = vardiff.record_submit() {
                                        let target_hex = hex::encode(vardiff.share_target());
                                        let set_diff = PoolMessage::SetDifficulty {
                                            difficulty: new_diff,
                                            target_hex,
                                        };
                                        let _ = write_v3_message(writer, &set_diff).await;
                                    }

                                    if block_found {
                                        let block_height = height;
                                        let network_diff = difficulty;
                                        self.block_tracker.lock().unwrap().record_block_found(
                                            block_height,
                                            &submit_miner,
                                            &submit_worker,
                                            vardiff.current(),
                                            network_diff,
                                            true,
                                        );
                                        self.telemetry.lock().unwrap().record_block_found(&submit_miner, &submit_worker);
                                        self.template_cache.lock().unwrap().invalidate();

                                        // Notify all channels (Telegram/SMTP/OASIS/webhook)
                                        self.notifier.notify_block_found(&submit_miner, block_height, &submit_worker);

                                        // Submit block to node
                                        let rpc_url = self.pool.lock().unwrap().config.l1_rpc_url.clone();
                                        if let (Some(rpc_url), Some(tpl)) = (rpc_url, template) {
                                            let block = match build_solved_block(tpl, nonce) {
                                                Ok(b) => b,
                                                Err(e) => {
                                                    tracing::warn!("v3_block_build_failed: {}", e);
                                                    return;
                                                }
                                            };
                                            let notifier = self.notifier.clone();
                                            tokio::spawn(async move {
                                                if let Err(e) = submit_block_rpc(&rpc_url, &block).await {
                                                    tracing::warn!("v3_submitBlock failed: {}", e);
                                                    notifier.notify_orphan(block_height);
                                                }
                                            });
                                        }
                                    }
                                } else {
                                    self.telemetry.lock().unwrap().record_job_result(
                                        &submit_miner,
                                        &submit_worker,
                                        false,
                                        attempted_hashes.unwrap_or(0),
                                        elapsed_ms.unwrap_or(0),
                                    );
                                }

                                let block_height_val = if block_found { Some(height) } else { None };

                                let result_msg = PoolMessage::Result {
                                    accepted,
                                    status: if accepted { "accepted".to_string() } else { "rejected".to_string() },
                                    block_found,
                                    block_height: block_height_val,
                                };
                                let _ = write_v3_message(writer, &result_msg).await;

                                tracing::info!(
                                    "v3_share job={} miner={} nonce={} accepted={}",
                                    job_id, submit_miner, nonce, accepted
                                );

                                // Share relay to upstream pool (Edge mode, fire-and-forget)
                                if accepted && self.relay_config.enabled() {
                                    if let Some(ref upstream) = self.relay_config.upstream_pool_addr {
                                        let relay = PoolMessage::ShareRelay {
                                            miner_id: submit_miner.clone(),
                                            worker_name: submit_worker.clone(),
                                            height,
                                            difficulty,
                                            relay_origin: self.config.pool_address.encoded.clone(),
                                        };
                                        let upstream = upstream.clone();
                                        tokio::spawn(async move {
                                            if let Err(e) = relay_share_fire_and_forget(&upstream, &relay).await {
                                                tracing::debug!("share_relay_failed: {}", e);
                                            }
                                        });
                                    }
                                }
                            }

                            Ok(PoolMessage::NoSolution {
                                job_id,
                                miner_id: ns_miner,
                                worker_name: ns_worker,
                                attempted_hashes,
                                elapsed_ms,
                            }) => {
                                consecutive_no_solution += 1;
                                tracing::debug!(
                                    "v3_no_solution job={} miner={} consecutive={}",
                                    job_id, ns_miner, consecutive_no_solution
                                );

                                self.telemetry.lock().unwrap().record_no_solution(
                                    &ns_miner,
                                    &ns_worker,
                                    attempted_hashes.unwrap_or(0),
                                    elapsed_ms.unwrap_or(0),
                                );

                                if consecutive_no_solution >= self.max_consecutive_no_solution {
                                    tracing::warn!(
                                        "v3_no_solution_ban ip={} miner={} consecutive={}",
                                        ip, ns_miner, consecutive_no_solution
                                    );
                                    self.no_solution_bans.lock().unwrap().insert(
                                        ip,
                                        Instant::now() + self.no_solution_ban_duration,
                                    );
                                    let bye = PoolMessage::Bye {
                                        accepted_shares: 0,
                                        rejected_shares: 0,
                                        revenue_total_usd: "0".to_string(),
                                    };
                                    let _ = write_v3_message(writer, &bye).await;
                                    return;
                                }
                            }

                            Ok(PoolMessage::CoinPreference {
                                miner_id: pref_miner,
                                gpu_coin,
                                cpu_coin,
                                gpu_profit_usd_day,
                                cpu_profit_usd_day,
                            }) => {
                                tracing::info!(
                                    "v3_coin_preference miner={} gpu={} cpu={} gpu_profit={:.2}/day cpu_profit={:.2}/day",
                                    pref_miner, gpu_coin, cpu_coin, gpu_profit_usd_day, cpu_profit_usd_day
                                );
                                // Preferences are stored per-session and will be used
                                // in future job construction for coin selection.
                                // For now, the pool-side profit switcher handles coin selection.
                            }

                            Ok(PoolMessage::ExternalSubmit {
                                miner_id: sub_miner_id,
                                worker_name: sub_worker_name,
                                coin,
                                algorithm: submit_algorithm,
                                external_job_id,
                                nonce,
                                hash_hex,
                                mix_hash_hex,
                                ..
                            }) => {
                                tracing::info!(
                                    "v3_external_submit miner={} coin={} job={} nonce={}",
                                    sub_miner_id, coin, external_job_id, nonce
                                );

                                // Forward to AuxPoW bridge
                                let req = ShareForwardRequest {
                                    job_id: external_job_id.clone(),
                                    nonce,
                                    hash_hex: hash_hex.clone(),
                                    mix_hash_hex: mix_hash_hex.clone(),
                                    algorithm: submit_algorithm.clone(),
                                    header_bytes: Vec::new(),
                                };

                                let bridge_result = self.multi_bridge.forward_by_ticker(&coin, req);

                                let (accepted, status) = match bridge_result {
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                                        crate::share_forwarder::ShareForwardResult::Accepted,
                                    )) => (true, "accepted".to_string()),
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                                        crate::share_forwarder::ShareForwardResult::BelowTarget,
                                    )) => (false, "below_target".to_string()),
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                                        crate::share_forwarder::ShareForwardResult::Rejected(reason),
                                    )) => (false, format!("rejected:{}", reason)),
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                                        crate::share_forwarder::ShareForwardResult::Unknown,
                                    )) => (false, "unknown".to_string()),
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                                        crate::share_forwarder::ShareForwardResult::NotConnected,
                                    )) => (false, "not_connected".to_string()),
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::NotEnabled) => {
                                        (false, "external_not_enabled".to_string())
                                    }
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::ChannelClosed) => {
                                        (false, "channel_closed".to_string())
                                    }
                                    None => (false, "unknown_coin".to_string()),
                                };

                                let result = PoolMessage::ExternalResult {
                                    accepted,
                                    status: status.clone(),
                                    coin: coin.clone(),
                                };
                                let _ = write_v3_message(writer, &result).await;

                                if accepted {
                                    // Record telemetry
                                    self.telemetry.lock().unwrap().record_job_result(
                                        &sub_miner_id,
                                        &sub_worker_name,
                                        true,
                                        0,
                                        0,
                                    );
                                }
                            }

                            Ok(PoolMessage::PearlSubmit { .. }) => {
                                tracing::debug!("v3_pearl_submit (not yet implemented)");
                            }

                            Ok(msg) => {
                                tracing::debug!("v3_unhandled_message {:?}", msg);
                            }

                            Err(e) => {
                                tracing::warn!("v3_decode_error line={} err={}", line, e);
                            }
                        }
                    }
                    _ => break,
                    }
                },
                msg = notify_rx.recv() => match msg {
                    Ok(msg) => {
                        // Only forward V3 Job messages to V3 clients
                        // (stratum v1 mining.notify messages are skipped)
                        if msg.contains("\"type\":\"job\"") {
                            let line = msg.trim_end();
                            let mut w = writer.lock().await;
                            if w.write_all(line.as_bytes()).await.is_err() { break; }
                            if w.write_all(b"\n").await.is_err() { break; }
                        }
                    }
                    Err(_) => break,
                },
            }
        }
    }

    /// Periodically fetch `getTemplate` from the node RPC and broadcast
    /// `mining.notify` to all connected miners. Runs until `shutdown` fires.
    pub async fn template_feed_loop(
        &self,
        rpc_url: String,
        miner_address: String,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) {
        if rpc_url.is_empty() {
            tracing::warn!("template_feed_loop: no l1_rpc_url configured, skipping");
            return;
        }

        let rpc_addr = match parse_rpc_addr(&rpc_url) {
            Ok(a) => a,
            Err(e) => {
                tracing::error!("invalid L1 RPC URL '{}': {}", rpc_url, e);
                return;
            }
        };

        let interval = Duration::from_secs(15);
        let mut job_counter: u64 = 0u64;
        let mut first = true;

        loop {
            let sleep_fut = if first {
                first = false;
                tokio::time::sleep(Duration::from_secs(2))
            } else {
                tokio::time::sleep(interval)
            };

            tokio::select! {
                _ = shutdown.changed() => break,
                _ = sleep_fut => {
                    job_counter += 1;
                    let job_id = format!("zion_{}", job_counter);

                    let payload = json!({
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getTemplate",
                        "params": { "miner_address": miner_address },
                    });

                    match jsonrpc_call(rpc_addr, &payload).await {
                        Ok(v) => {
                            if let Some(err) = v.get("error") {
                                if !err.is_null() {
                                    tracing::warn!("getTemplate error: {}", err);
                                    continue;
                                }
                            }
                            let result = v.get("result").unwrap_or(&Value::Null);
                            let header_hex = result.get("header_hex")
                                .and_then(Value::as_str)
                                .unwrap_or("");
                            let target_hex = result.get("target_hex")
                                .and_then(Value::as_str)
                                .unwrap_or("");
                            let reward = result.get("block_reward")
                                .and_then(Value::as_u64)
                                .unwrap_or(0);
                            let template_json = serde_json::to_string(result).unwrap_or_default();

                            if !header_hex.is_empty() {
                                tracing::info!(job = %job_id, "broadcasting mining.notify");
                                self.broadcast_job(&job_id, header_hex, target_hex, reward, &template_json);
                            }
                        }
                        Err(e) => tracing::warn!("getTemplate request failed: {}", e),
                    }
                }
            }
        }
    }
}

/// Write a V3 wire protocol message to the client.
async fn write_v3_message<W>(
    writer: &Arc<tokio::sync::Mutex<W>>,
    msg: &PoolMessage,
) -> std::io::Result<()>
where
    W: tokio::io::AsyncWrite + Unpin + Send,
{
    let line = encode_message(msg).map_err(std::io::Error::other)?;
    let mut w = writer.lock().await;
    w.write_all(line.as_bytes()).await?;
    w.write_all(b"\n").await?;
    w.flush().await?;
    Ok(())
}

/// Decrement IP session count on disconnect.
fn decrement_ip_sessions(ip_sessions: &Arc<Mutex<HashMap<IpAddr, usize>>>, ip: IpAddr) {
    let mut ip_sess = ip_sessions.lock().unwrap();
    if let Some(count) = ip_sess.get_mut(&ip) {
        if *count > 0 {
            *count -= 1;
        }
        if *count == 0 {
            ip_sess.remove(&ip);
        }
    }
}

/// Split "wallet.worker" or "wallet" into (miner_id, worker_name).
fn split_worker(username: &str) -> (String, String) {
    if let Some(dot) = username.find('.') {
        let (wallet, worker) = username.split_at(dot);
        (wallet.to_string(), worker[1..].to_string())
    } else {
        (username.to_string(), "default".to_string())
    }
}

/// Select algorithm based on block height.
///
/// V31 canonizes a single PoW algorithm — Ekam Deeksha — so the same name is
/// returned for all heights. The height parameter is retained for compatibility
/// with the Stratum v1 wire format.
fn algorithm_for_height(_height: u64) -> &'static str {
    "ekam_deeksha"
}

/// Read a u64 from env or return default.
fn env_or(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn build_solved_block(tpl: CoreBlockTemplate, nonce: u64) -> Result<Block, serde_json::Error> {
    let mut header: BlockHeader = serde_json::from_str(&tpl.header_json)?;
    header.nonce = nonce;
    Ok(Block::new(header, tpl.transactions))
}

fn parse_aux_coin(job_id: &str) -> ExternalCoin {
    let parts: Vec<&str> = job_id.split('_').collect();
    if parts.len() >= 2 {
        if let Ok(c) = ExternalCoin::from_str(parts[1]) {
            return c;
        }
    }
    ExternalCoin::Bitcoin
}

fn parse_target_hex(target_hex: &str) -> Option<[u8; 32]> {
    let hex = target_hex
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    if hex.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    hex::decode_to_slice(hex, &mut out).ok()?;
    Some(out)
}

async fn submit_block_rpc(rpc_url: &str, block: &Block) -> anyhow::Result<()> {
    let rpc_addr = parse_rpc_addr(rpc_url)
        .with_context(|| format!("invalid submitBlock RPC URL: {}", rpc_url))?;
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "submitBlock",
        "params": serde_json::to_value(block).expect("block serializes"),
    });
    let response: serde_json::Value = jsonrpc_call(rpc_addr, &payload).await?;
    tracing::info!("submitBlock response: {}", response);
    Ok(())
}

fn success_response(id: Value, result: Value) -> String {
    json!({"id": id, "result": result, "error": null}).to_string()
}

fn error_response(id: Option<Value>, code: i32, message: &str) -> String {
    json!({
        "id": id.unwrap_or(Value::Null),
        "result": null,
        "error": [code, message, null]
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr};
    use std::sync::Arc;
    use std::time::Duration;

    use crate::config::RateLimitConfig;
    use crate::rate_limit::IpRateLimiter;

    fn make_server() -> StratumServer {
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default())));
        StratumServer::new(pool)
    }

    #[test]
    fn handles_subscribe() {
        let server = make_server();
        let resp = server.handle_request(r#"{"id":1,"method":"mining.subscribe","params":[]}"#);
        assert!(resp.contains("mining.notify"));
        assert!(resp.contains("\"result\""));
    }

    #[test]
    fn handles_authorize() {
        let server = make_server();
        let resp =
            server.handle_request(r#"{"id":2,"method":"mining.authorize","params":["worker","x"]}"#);
        assert!(resp.contains("true"));
    }

    #[test]
    fn handles_zion_submit() {
        let server = make_server();
        let target = "f".repeat(64);
        let header = "00".repeat(80);
        server.job_notification("zion_1", &header, &target, 6_000_000, "");
        let resp = server.handle_request(
            r#"{"id":3,"method":"mining.submit","params":["worker","zion_1","0000000000000000"]}"#,
        );
        assert!(resp.contains("true"));
    }

    #[test]
    fn handles_auxpow_submit() {
        let server = make_server();
        let target = "f".repeat(64);
        let header = "00".repeat(80);
        server.job_notification("aux_bitcoin_1", &header, &target, 6_000_000, "");
        let resp = server.handle_request(
            r#"{"id":4,"method":"mining.submit","params":["worker","aux_bitcoin_1","0000000000000000"]}"#,
        );
        assert!(resp.contains("true"));
    }

    #[test]
    fn rejects_unknown_job() {
        let server = make_server();
        let resp = server.handle_request(
            r#"{"id":5,"method":"mining.submit","params":["worker","zion_99","0000000000000000"]}"#,
        );
        assert!(resp.contains("unknown job"));
    }

    #[test]
    fn algorithm_for_height_gates_correctly() {
        // V31 uses a single canonical algorithm for all heights.
        for height in [0, 4499, 4500, 4999, 5000, 99999] {
            assert_eq!(algorithm_for_height(height), "ekam_deeksha");
        }
    }

    #[test]
    fn split_worker_parses_dot() {
        let (miner, worker) = split_worker("zion1abc.rig1");
        assert_eq!(miner, "zion1abc");
        assert_eq!(worker, "rig1");
    }

    #[test]
    fn split_worker_no_dot_defaults() {
        let (miner, worker) = split_worker("zion1abc");
        assert_eq!(miner, "zion1abc");
        assert_eq!(worker, "default");
    }

    #[test]
    fn v3_hello_decodes_correctly() {
        let hello = r#"{"type":"hello","miner_id":"alice","worker_name":"rig1","algorithm":"ekam_deeksha","backend":"opencl"}"#;
        let msg = decode_message(hello).unwrap();
        match msg {
            PoolMessage::Hello {
                miner_id,
                worker_name,
                algorithm,
                backend,
                ..
            } => {
                assert_eq!(miner_id, "alice");
                assert_eq!(worker_name, "rig1");
                assert_eq!(algorithm, "ekam_deeksha");
                assert_eq!(backend, "opencl");
            }
            _ => panic!("expected Hello"),
        }
    }

    #[test]
    fn v3_protocol_detection_works() {
        // Stratum v1 has "method" field
        assert!(is_stratum_v1(
            r#"{"id":1,"method":"mining.subscribe","params":[]}"#
        ));
        // V3 wire has "type" field
        assert!(!is_stratum_v1(r#"{"type":"hello","miner_id":"abc"}"#));
    }

    #[tokio::test(start_paused = true)]
    async fn rate_limiter_accepts_first_rejects_second_then_accepts_after_window() {
        let config = RateLimitConfig {
            max_reconnects_per_minute: 1,
            window: Duration::from_secs(60),
        };
        let limiter = IpRateLimiter::new(config);
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        assert!(limiter.allow(ip));
        assert!(!limiter.allow(ip));

        tokio::time::advance(Duration::from_secs(61)).await;
        assert!(limiter.allow(ip));
    }
}
