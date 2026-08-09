use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::str::FromStr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Context;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWrite, AsyncWriteExt, BufReader};
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
use crate::rate_limit::{IpRateLimiter, ShareRateLimiter};
use crate::revenue_scheduler::RevenueScheduler;
use crate::rpc_client::{jsonrpc_call, parse_rpc_addr};
use crate::routing::{RoutingStats, resolve_session_group, session_group_name};
use crate::share::ShareSubmission;
use crate::share_relay::{relay_share_fire_and_forget, ShareRelayConfig};
use crate::stratum_v1::{is_stratum_v1, build_set_target, StratumV1Session};
use crate::telemetry::MinerTelemetryRegistry;
use crate::template_cache::TemplateCache;
use crate::v3_protocol::{decode_message, encode_message, ExternalStreamJob, PoolMessage, PROTOCOL_VERSION};
use crate::vardiff::{difficulty_to_target, VarDiff, VarDiffConfig};

/// Stored job data:
/// - pow header bytes
/// - share target (what the miner must meet for a valid share)
/// - block/network target (what the hash must meet to be a full block)
/// - block reward (flowers)
/// - full node template needed to rebuild the solved block.
type JobEntry = (Vec<u8>, [u8; 32], [u8; 32], u64, Option<CoreBlockTemplate>);

/// Per-connection state for a Stratum v1 miner session.
pub struct StratumV1Ctx {
    pub session: StratumV1Session,
    pub vardiff: VarDiff,
    pub share_rate: ShareRateLimiter,
    pub authorized: bool,
    /// Notification to send to the client after the current response (e.g. set_difficulty).
    pub pending_notification: Option<String>,
}

impl StratumV1Ctx {
    pub fn new(session_id: u64, vardiff_config: &VarDiffConfig) -> Self {
        let share_rate_per_sec = env_or_f64("ZION_POOL_SHARE_RATE_PER_SEC", 10.0)
            .max(1.0);
        Self {
            session: StratumV1Session::new(session_id),
            vardiff: VarDiff::new(vardiff_config),
            share_rate: ShareRateLimiter::new(share_rate_per_sec),
            authorized: false,
            pending_notification: None,
        }
    }

    /// Build a `mining.set_target` notification for the current vardiff.
    ///
    /// We send the explicit 256-bit share target rather than a difficulty value
    /// so the miner can use it directly without guessing the target encoding.
    pub fn set_target_notification(&self) -> String {
        let notif = build_set_target(&self.vardiff.share_target());
        serde_json::to_string(&notif).unwrap_or_default()
    }
}

#[derive(Clone)]
pub struct StratumServer {
    pub pool: Arc<Mutex<Pool>>,
    pub config: PoolConfig,
    /// Stored jobs: job_id -> (header bytes, 32-byte network target, reward, template).
    jobs: Arc<Mutex<HashMap<String, JobEntry>>>,
    notify_tx: broadcast::Sender<String>,
    /// Miner telemetry registry — shared with the Pool so the HTTP API can
    /// expose per-worker hashrate and shares.
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
    /// Optional persistent store for blocks and payouts.
    share_store: Option<Arc<crate::store::ShareStore>>,
}

impl StratumServer {
    /// Get a reference to the routing stats for the HTTP API.
    pub fn routing_stats_handle(&self) -> Arc<Mutex<RoutingStats>> {
        Arc::clone(&self.routing_stats)
    }

    pub fn new(pool: Arc<Mutex<Pool>>) -> Self {
        let (config, telemetry) = {
            let pool = pool.lock().unwrap();
            (pool.config.clone(), pool.telemetry.clone())
        };
        let (notify_tx, _notify_rx) = broadcast::channel(256);

        let vardiff_config = VarDiffConfig {
            start_difficulty: env_or("ZION_VARDIFF_START_DIFF", env_or("ZION_VARDIFF_START", 1)),
            min_difficulty: env_or("ZION_VARDIFF_MIN_DIFF", env_or("ZION_VARDIFF_MIN", 1)),
            max_difficulty: env_or("ZION_VARDIFF_MAX_DIFF", env_or("ZION_VARDIFF_MAX", 100_000)),
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
            telemetry,
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
            share_store: None,
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

    /// Attach an optional `ShareStore` to record found blocks.
    pub fn with_share_store(mut self, store: Option<Arc<crate::store::ShareStore>>) -> Self {
        self.share_store = store;
        self
    }

    /// Get a reference to the notifier (for payout.rs to use).
    pub fn notifier(&self) -> &Arc<Notifier> {
        &self.notifier
    }

    /// Fallback hashrate sample estimate for miners that do not report
    /// `attempted_hashes` / `elapsed_ms` (e.g. older V3 Trinity clients).
    /// Uses the current share difficulty as the expected work and the time
    /// since the worker's previous accepted share as the elapsed time.
    fn fallback_work_sample(
        &self,
        miner_id: &str,
        worker_name: &str,
        share_difficulty: u64,
        attempted: Option<u64>,
        elapsed: Option<u64>,
    ) -> (u64, u64) {
        let now_s = crate::telemetry::now_unix_seconds();
        let attempted_h = attempted.unwrap_or(0);
        let elapsed_ms = elapsed.unwrap_or(0);
        if attempted_h > 0 && elapsed_ms > 0 {
            return (attempted_h, elapsed_ms);
        }
        let mut out_attempted = attempted_h;
        let mut out_elapsed = elapsed_ms;
        if out_attempted == 0 {
            out_attempted = share_difficulty.max(1);
        }
        if out_elapsed == 0 {
            let key = format!("{miner_id}/{worker_name}");
            let reg = self.telemetry.lock().unwrap();
            if let Some(miner) = reg.get_miner(&key) {
                if miner.last_share_time_s > 0 && now_s > miner.last_share_time_s {
                    out_elapsed = (now_s - miner.last_share_time_s).saturating_mul(1000);
                }
            }
        }
        (out_attempted, out_elapsed)
    }

    /// Handle a Stratum v1 JSON-RPC request line (stateless convenience wrapper).
    pub fn handle_request(&self, line: &str) -> String {
        let mut ctx = StratumV1Ctx::new(0, &self.vardiff_config);
        self.handle_request_with_ctx(line, &mut ctx)
    }

    /// Handle a Stratum v1 JSON-RPC request line with per-session state.
    pub fn handle_request_with_ctx(&self, line: &str, ctx: &mut StratumV1Ctx) -> String {
        let req: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => return error_response(None, -32700, "parse error"),
        };
        let id = req.get("id").cloned().unwrap_or(Value::Null);
        let method = req.get("method").and_then(Value::as_str).unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(Value::Null);

        match method {
            "mining.subscribe" => {
                // Capture the miner's advertised agent/algorithm if provided.
                if let Some(agent) = params
                    .as_array()
                    .and_then(|a| a.first())
                    .and_then(Value::as_str)
                {
                    ctx.session.algorithm = "ekam_deeksha".to_string();
                    ctx.session.backend = agent.to_string();
                }

                let result = json!([
                    [
                        ["mining.set_difficulty", "sv1"],
                        ["mining.notify", "sv1"]
                    ],
                    ctx.session.extranonce1_hex,
                    ctx.session.extranonce2_size
                ]);
                // Queue a set_target notification so the client gets its
                // initial share target before the first job.
                ctx.pending_notification = Some(ctx.set_target_notification());
                success_response(id, result)
            }
            "mining.authorize" => {
                let username = params
                    .get(0)
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !username.is_empty() {
                    let (miner_id, worker_name) = StratumV1Session::parse_username(&username);
                    ctx.session.miner_id = miner_id.clone();
                    ctx.session.worker_name = worker_name.clone();
                    ctx.authorized = true;

                    self.pool.lock().unwrap().register_worker(&username);
                    self.telemetry
                        .lock()
                        .unwrap()
                        .touch_session(&miner_id, &worker_name, &ctx.session.algorithm, &ctx.session.backend);
                }
                success_response(id, Value::Bool(true))
            }
            "mining.submit" => self.handle_submit(id, params, ctx),
            "mining.suggest_difficulty" => {
                // Accept the hint but let VarDiff remain in control.
                success_response(id, Value::Bool(true))
            }
            _ => error_response(Some(id), -32601, "method not found"),
        }
    }

    /// Write the response for a Stratum v1 request plus any queued notification.
    async fn flush_stratum_response<W>(
        &self,
        writer: &Arc<tokio::sync::Mutex<W>>,
        ctx: &mut StratumV1Ctx,
        line: &str,
    ) -> std::io::Result<()>
    where
        W: AsyncWrite + Unpin + Send,
    {
        let response = self.handle_request_with_ctx(line, ctx);
        let mut w = writer.lock().await;
        w.write_all(response.as_bytes()).await?;
        w.write_all(b"\n").await?;
        if let Some(notif) = ctx.pending_notification.take() {
            w.write_all(notif.as_bytes()).await?;
            w.write_all(b"\n").await?;
        }
        w.flush().await?;
        Ok(())
    }

    fn handle_submit(&self, id: Value, params: Value, ctx: &mut StratumV1Ctx) -> String {
        // Enforce per-session share rate limit.
        if !ctx.share_rate.allow() {
            tracing::warn!("share rate limited — session={}", ctx.session.extranonce1_hex);
            return rejected_response(id, "share rate limited");
        }

        let (worker, job_id, nonce_hex, _hash_hex) = match Self::parse_submit_params(&params) {
            Ok(v) => v,
            Err(msg) => return error_response(Some(id), -32602, msg),
        };

        let submission = ShareSubmission {
            worker,
            job_id: job_id.clone(),
            nonce_hex: nonce_hex.clone(),
        };

        let (header, _share_target, block_target, reward, template) = {
            let jobs = self.jobs.lock().unwrap();
            match jobs.get(&job_id) {
                Some((h, st, bt, r, tpl)) => (h.clone(), *st, *bt, *r, tpl.clone()),
                None => return error_response(Some(id), -32602, "unknown job"),
            }
        };

        let nonce = match Self::parse_nonce(&nonce_hex) {
            Ok(n) => n,
            Err(_) => return error_response(Some(id), -32602, "invalid nonce"),
        };

        // Use the session's current vardiff target for share validation.
        // (Stratum v1 jobs are broadcast with the global start difficulty, and
        // per-session vardiff retarget is queued via mining.set_difficulty.)
        let share_target = ctx.vardiff.share_target();
        let share_difficulty = ctx.vardiff.current();

        let worker_name = submission.worker.clone();
        let (miner_id, worker_short) = split_worker(&worker_name);
        let telemetry_key = format!("{miner_id}/{worker_short}");
        let now_s = crate::telemetry::now_unix_seconds();
        let (attempted_hashes, elapsed_ms) = {
            let reg = self.telemetry.lock().unwrap();
            if let Some(miner) = reg.get_miner(&telemetry_key) {
                if miner.last_share_time_s > 0 && now_s > miner.last_share_time_s {
                    (
                        share_difficulty,
                        (now_s - miner.last_share_time_s).saturating_mul(1000),
                    )
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        };

        let (height, difficulty) = template
            .as_ref()
            .map(|t| (t.height, t.difficulty))
            .unwrap_or((0, 1));

        let result = if job_id.starts_with("zion_") || job_id.starts_with("j") {
            self.pool
                .lock()
                .unwrap()
                .submit_zion_with_target(submission, &header, height, difficulty, &share_target)
        } else if job_id.starts_with("aux_") {
            let coin = parse_aux_coin(&job_id);
            self.pool
                .lock()
                .unwrap()
                .submit_auxpow_with_target(coin, submission, &header, height, difficulty, &share_target)
        } else {
            Err(PoolError::UnknownJob)
        };

        match result {
            Ok(true) => {
                tracing::info!(
                    "share accepted — job={}, worker={}, nonce={}",
                    job_id,
                    worker_name,
                    nonce_hex
                );
                self.telemetry
                    .lock()
                    .unwrap()
                    .record_job_result(
                        &miner_id,
                        &worker_short,
                        true,
                        attempted_hashes,
                        elapsed_ms,
                    );
                // Record share for block tracker luck.
                self.block_tracker.lock().unwrap().record_share();
                // Check whether the share is also a full block.
                self.check_and_record_block(
                    &job_id,
                    &worker_name,
                    &header,
                    nonce,
                    &block_target,
                    share_difficulty,
                    reward,
                    template,
                );
                // VarDiff retarget: if the difficulty changed, queue a new
                // mining.set_target notification for the client.
                if let Some(_new_diff) = ctx.vardiff.record_submit() {
                    ctx.pending_notification = Some(ctx.set_target_notification());
                }
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
                    .record_job_result(
                        &miner_id,
                        &worker_short,
                        false,
                        attempted_hashes,
                        elapsed_ms,
                    );
                rejected_response(id, "low difficulty")
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
                    .record_job_result(
                        &miner_id,
                        &worker_short,
                        false,
                        attempted_hashes,
                        elapsed_ms,
                    );
                error_response(Some(id), -32000, &format!("share error: {}", e))
            }
        }
    }

    /// Parse Stratum v1 `mining.submit` params.
    ///
    /// Supported forms:
    /// - `[worker, job_id, nonce]`
    /// - `[worker, job_id, nonce, hash]`
    /// - `[worker, job_id, extranonce2, ntime, nonce]`
    /// - `[worker, job_id, extranonce2, ntime, nonce, hash, ...]`
    fn parse_submit_params(params: &Value) -> Result<(String, String, String, String), &'static str> {
        let arr = params
            .as_array()
            .ok_or("invalid params")?;
        if arr.len() < 3 {
            return Err("invalid params");
        }

        let worker = arr[0].as_str().unwrap_or("anonymous").to_string();
        let job_id = arr[1].as_str().ok_or("job_id must be a string")?.to_string();

        let (nonce_hex, hash_hex) = if arr.len() == 4 {
            // Simplified [worker, job_id, nonce, hash]
            (
                arr[2].as_str().ok_or("nonce must be a string")?.to_string(),
                arr[3].as_str().unwrap_or("").to_string(),
            )
        } else {
            // Standard 5+ params: nonce is index 4 (or last as a fallback).
            let nonce = arr
                .get(4)
                .and_then(Value::as_str)
                .or_else(|| arr.last().and_then(Value::as_str))
                .ok_or("nonce must be a string")?
                .to_string();
            let hash = arr.get(5).and_then(Value::as_str).unwrap_or("").to_string();
            (nonce, hash)
        };

        Ok((worker, job_id, nonce_hex, hash_hex))
    }

    fn parse_nonce(nonce_hex: &str) -> Result<u64, PoolError> {
        let s = nonce_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        u64::from_str_radix(s, 16).map_err(|_| PoolError::Parse)
    }

    #[allow(clippy::too_many_arguments)]
    fn check_and_record_block(
        &self,
        job_id: &str,
        worker_full: &str,
        header: &[u8],
        nonce: u64,
        block_target: &[u8; 32],
        share_difficulty: u64,
        block_reward: u64,
        template: Option<CoreBlockTemplate>,
    ) {
        let (is_block, rpc_url) = {
            let pool = self.pool.lock().unwrap();
            let is_block = if job_id.starts_with("zion_") || job_id.starts_with("j") {
                let hash = pool.validator.zion_hash(header, nonce);
                hash.as_bytes() <= block_target
            } else if job_id.starts_with("aux_") {
                let coin = parse_aux_coin(job_id);
                let hash = pool.validator.auxpow_hash(coin, header, nonce);
                &hash <= block_target
            } else {
                false
            };
            (is_block, pool.config.l1_rpc_url.clone())
        };
        if !is_block {
            return;
        }

        let block_height = template.as_ref().map(|t| t.height).unwrap_or(0);
        let network_difficulty = template.as_ref().map(|t| t.difficulty).unwrap_or(1);
        let (miner_id, worker_name) = split_worker(worker_full);

        let rpc_url = rpc_url.unwrap_or_default();
        match (rpc_url.is_empty(), template) {
            (false, Some(tpl)) => {
                let block = match build_solved_block(tpl, nonce) {
                    Ok(b) => b,
                    Err(e) => {
                        tracing::warn!("failed to build solved block for {}: {}", job_id, e);
                        return;
                    }
                };
                let job_id = job_id.to_string();
                let job_id_log = job_id.clone();
                let server = self.clone();
                tokio::spawn(async move {
                    if let Err(e) = server
                        .submit_found_block(
                            job_id,
                            miner_id,
                            worker_name,
                            block,
                            block_height,
                            block_reward,
                            share_difficulty,
                            network_difficulty,
                        )
                        .await
                    {
                        tracing::warn!("full block submission failed for {}: {}", job_id_log, e);
                    }
                });
            }
            _ => {
                // No node RPC or no template data — record the block as accepted locally.
                self.record_block_accepted(
                    block_height,
                    block_reward,
                    &miner_id,
                    &worker_name,
                    share_difficulty,
                    network_difficulty,
                    "",
                );
            }
        }
    }

    /// Build and store a `mining.notify` message for the given job.
    ///
    /// `share_target_hex` is what the miner must meet for a valid share.
    /// `block_target_hex` is the network full-block target used for block detection.
    pub fn job_notification(
        &self,
        job_id: &str,
        header_hex: &str,
        share_target_hex: &str,
        block_target_hex: &str,
        block_reward: u64,
        template_json: &str,
    ) -> String {
        let header_trim = header_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        let share_target = parse_target_hex(share_target_hex).unwrap_or([0xFF; 32]);
        let block_target = parse_target_hex(block_target_hex).unwrap_or([0xFF; 32]);
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

        // Stratum v1 ZION simplified notify: [job_id, header, target, height, clean_jobs].
        // The target we send is the share target, never the full block target.
        let height = template.as_ref().map(|t| t.height).unwrap_or(0);
        let clean_jobs = true;

        if let Ok(bytes) = hex::decode(header_trim) {
            self.jobs.lock().unwrap().insert(
                job_id.to_string(),
                (bytes, share_target, block_target, block_reward, template.clone()),
            );
        }

        json!({
            "id": null,
            "method": "mining.notify",
            "params": [job_id, header_hex, share_target_hex, height, clean_jobs]
        })
        .to_string()
    }

    /// Broadcast a `mining.notify` message to all connected clients.
    pub fn broadcast_job(
        &self,
        job_id: &str,
        header_hex: &str,
        share_target_hex: &str,
        block_target_hex: &str,
        block_reward: u64,
        template_json: &str,
    ) {
        let msg = self.job_notification(
            job_id,
            header_hex,
            share_target_hex,
            block_target_hex,
            block_reward,
            template_json,
        );
        let _ = self.notify_tx.send(msg);

        // Also broadcast V3 Job message for V3 protocol clients
        if let Some(v3_msg) = self.build_v3_job_message(job_id, header_hex, template_json) {
            let _ = self.notify_tx.send(v3_msg);
        }
    }

    /// Build a V3 wire protocol Job message from template data.
    fn build_v3_job_message(
        &self,
        job_id: &str,
        header_hex: &str,
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
                        ntime_hex: job.ntime.clone(),
                    });
                }
            }
        }
        None
    }

    /// Build the CPU external stream job from the AuxPoW bridge.
    /// Selects the first available CPU coin job (XMR, VRSC, RTM).
    ///
    /// For VRSC (VerusHash), we override the share target to a fixed
    /// difficulty of 180M (180 million) so the miner finds ~1 share per
    /// 30s at 6 MH/s — matching the VRSC block time for optimal accept
    /// rate.  LuckPool's default vardiff can be too high for a single
    /// CPU stream, causing very few shares and high stale rate.
    /// Env: ZION_VRSC_MIN_DIFF=180000000 (default 180M)
    fn build_external_stream_cpu(&self) -> Option<ExternalStreamJob> {
        let coins = self.multi_bridge.enabled_coins();
        if coins.is_empty() {
            return None;
        }
        for coin in &coins {
            if self.multi_bridge.is_cpu_coin(coin) {
                if let Some(job) = self.multi_bridge.latest_job_for_coin(coin) {
                    // VRSC min difficulty override: compute a relaxed share
                    // target so the miner finds shares at ~10T difficulty.
                    // target = 2^256 / difficulty  (big-endian 32 bytes)
                    let target_hex = if coin.as_str().eq_ignore_ascii_case("VRSC") {
                        let min_diff: u128 = std::env::var("ZION_VRSC_MIN_DIFF")
                            .ok()
                            .and_then(|v| v.parse::<u128>().ok())
                            .unwrap_or(180_000_000); // 180M default
                        // target = 2^256 / diff ≈ (2^128 / diff) << 128
                        // For diff >= 2^128 this would be zero, but 10T << 2^128.
                        // Compute: target_hi = 2^128 / diff (floor), target_lo = 0
                        let target_hi = if min_diff > 0 {
                            (u128::MAX / min_diff).max(1) // 2^128-1 / diff ≈ 2^128/diff
                        } else {
                            u128::MAX
                        };
                        // Pack as 32-byte big-endian: [target_hi(16 bytes)][0(16 bytes)]
                        let mut target_bytes = [0u8; 32];
                        target_bytes[0..16].copy_from_slice(&target_hi.to_be_bytes());
                        hex::encode(&target_bytes)
                    } else {
                        job.target_hex.clone()
                    };
                    return Some(ExternalStreamJob {
                        coin: coin.as_str().to_string(),
                        algorithm: job.algorithm.clone(),
                        job_id: job.external_job_id.clone(),
                        header_hex: job.header_hex.clone(),
                        target_hex,
                        height: job.height,
                        extranonce1_hex: job.extranonce1_hex.clone(),
                        protocol: "stratum".to_string(),
                        seed_hash_hex: String::new(),
                        timestamp: 0,
                        ntime_hex: job.ntime.clone(),
                    });
                }
            }
        }
        None
    }

    pub async fn run(&self, listener: TcpListener) -> std::io::Result<()> {
        let limiter = IpRateLimiter::new(self.config.reconnect_rate_limit);
        let session_id_counter = Arc::new(AtomicU64::new(1));
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
            let counter = Arc::clone(&session_id_counter);
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
                    // Stratum v1 protocol — handle with per-session state.
                    let session_id = counter.fetch_add(1, Ordering::Relaxed);
                    let mut ctx = StratumV1Ctx::new(session_id, &server.vardiff_config);

                    if server.flush_stratum_response(&writer, &mut ctx, &first_line).await.is_err() {
                        decrement_ip_sessions(&server.ip_sessions, ip);
                        return;
                    }

                    loop {
                        tokio::select! {
                            line = lines.next_line() => match line {
                                Ok(Some(line)) => {
                                    if server.flush_stratum_response(&writer, &mut ctx, &line).await.is_err() { break; }
                                }
                                _ => break,
                            },
                            msg = notify_rx.recv() => match msg {
                                Ok(msg) => {
                                    // encode_message already appends '\n' — trim and add one
                                    let line = msg.trim_end();
                                    let mut w = writer.lock().await;
                                    if w.write_all(line.as_bytes()).await.is_err() { break; }
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
                                Ok(PoolMessage::Submit { job_id, miner_id: submit_miner, worker_name: submit_worker, nonce, attempted_hashes, elapsed_ms, .. }) => {
                                    let job_key = format!("zion_{}", job_id);
                                    let job_data = self.jobs.lock().unwrap().get(&job_key).cloned();
                                    if let Some((header, share_target, block_target, reward, template)) = job_data {
                                        let (height, difficulty) = template.as_ref().map(|t| (t.height, t.difficulty)).unwrap_or((0, 1));
                                        let submission = ShareSubmission {
                                            worker: submit_worker.clone(),
                                            job_id: job_key.clone(),
                                            nonce_hex: format!("{:016x}", nonce),
                                        };
                                        let result = self.pool.lock().unwrap().submit_zion_with_target(submission, &header, height, difficulty, &share_target);
                                        let accepted = matches!(result, Ok(true));

                                        // Estimate hashes/elapsed for TLS clients (no per-session vardiff here).
                                        let (attempted_h, elapsed_ms) = self.fallback_work_sample(
                                            &submit_miner,
                                            &submit_worker,
                                            self.vardiff_config.start_difficulty.max(1),
                                            attempted_hashes,
                                            elapsed_ms,
                                        );

                                        // Check if share meets the network block target
                                        let block_found = accepted && {
                                            let pool = self.pool.lock().unwrap();
                                            let hash = pool.validator.zion_hash(&header, nonce);
                                            hash.as_bytes() <= &block_target
                                        };

                                        if accepted {
                                            self.telemetry.lock().unwrap().record_job_result(
                                                &submit_miner,
                                                &submit_worker,
                                                true,
                                                attempted_h,
                                                elapsed_ms,
                                            );
                                            self.block_tracker.lock().unwrap().record_share();
                                        }

                                        // If block found, submit to node
                                        if block_found {
                                            let has_rpc = self.pool.lock().unwrap().config.l1_rpc_url.as_deref().is_some_and(|s| !s.is_empty());
                                            match (has_rpc, template) {
                                                (true, Some(tpl)) => {
                                                    let block = match build_solved_block(tpl, nonce) {
                                                        Ok(b) => b,
                                                        Err(e) => {
                                                            tracing::warn!("v3_tls_block_build_failed: {}", e);
                                                            let result_msg = PoolMessage::Result {
                                                                accepted,
                                                                status: "accepted".into(),
                                                                block_found: false,
                                                                block_height: Some(height),
                                                            };
                                                            let _ = write_v3_message(writer, &result_msg).await;
                                                            continue;
                                                        }
                                                    };
                                                    let job_id_log = job_key.clone();
                                                    let server = self.clone();
                                                    let miner_for_block = submit_miner.clone();
                                                    let worker_for_block = submit_worker.clone();
                                                    let share_diff = difficulty;
                                                    let network_diff = difficulty;
                                                    tokio::spawn(async move {
                                                        if let Err(e) = server.submit_found_block(
                                                            job_id_log, miner_for_block, worker_for_block,
                                                            block, height, reward, share_diff, network_diff,
                                                        ).await {
                                                            tracing::warn!("v3_tls block submission failed: {}", e);
                                                        }
                                                    });
                                                    tracing::info!(
                                                        "v3_share job={} miner={} nonce={} accepted=true block_found=true height={}",
                                                        job_id, submit_miner, nonce, height
                                                    );
                                                }
                                                _ => {
                                                    self.record_block_accepted(height, reward, &submit_miner, &submit_worker, difficulty, difficulty, "");
                                                    tracing::info!(
                                                        "v3_share job={} miner={} nonce={} accepted=true block_found=true (no RPC) height={}",
                                                        job_id, submit_miner, nonce, height
                                                    );
                                                }
                                            }
                                        } else if accepted {
                                            tracing::info!(
                                                "v3_share job={} miner={} nonce={} accepted={}",
                                                job_id, submit_miner, nonce, accepted
                                            );
                                        }

                                        let result_msg = PoolMessage::Result {
                                            accepted,
                                            status: if accepted { "accepted".into() } else { "rejected".into() },
                                            block_found,
                                            block_height: if block_found { Some(height) } else { None },
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
                                let (header, share_target, block_target, reward, template) = match job_data {
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

                                let result = self.pool.lock().unwrap().submit_zion_with_target(
                                    submission,
                                    &header,
                                    height,
                                    difficulty,
                                    &share_target,
                                );

                                let accepted = matches!(result, Ok(true));
                                let block_found = accepted && {
                                    let pool = self.pool.lock().unwrap();
                                    let hash = pool.validator.zion_hash(&header, nonce);
                                    hash.as_bytes() <= &block_target
                                };

                                // Estimate hashes/elapsed for clients that don't report them.
                                let (attempted_h, elapsed_ms) = self.fallback_work_sample(
                                    &submit_miner,
                                    &submit_worker,
                                    vardiff.current(),
                                    attempted_hashes,
                                    elapsed_ms,
                                );

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
                                        attempted_h,
                                        elapsed_ms,
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
                                        let share_diff = vardiff.current();
                                        let miner_for_block = submit_miner.clone();
                                        let worker_for_block = submit_worker.clone();

                                        let has_rpc = self
                                            .pool
                                            .lock()
                                            .unwrap()
                                            .config
                                            .l1_rpc_url
                                            .as_deref()
                                            .is_some_and(|s| !s.is_empty());
                                        match (has_rpc, template) {
                                            (true, Some(tpl)) => {
                                                let block = match build_solved_block(tpl, nonce) {
                                                    Ok(b) => b,
                                                    Err(e) => {
                                                        tracing::warn!("v3_block_build_failed: {}", e);
                                                        return;
                                                    }
                                                };
                                                let job_id = format!("v3_{}", job_id);
                                                let job_id_log = job_id.clone();
                                                let server = self.clone();
                                                tokio::spawn(async move {
                                                    if let Err(e) = server
                                                        .submit_found_block(
                                                            job_id,
                                                            miner_for_block,
                                                            worker_for_block,
                                                            block,
                                                            block_height,
                                                            reward,
                                                            share_diff,
                                                            network_diff,
                                                        )
                                                        .await
                                                    {
                                                        tracing::warn!("v3 full block submission failed for {}: {}", job_id_log, e);
                                                    }
                                                });
                                            }
                                            _ => {
                                                self.record_block_accepted(
                                                    block_height,
                                                    reward,
                                                    &miner_for_block,
                                                    &worker_for_block,
                                                    share_diff,
                                                    network_diff,
                                                    "",
                                                );
                                            }
                                        }
                                    }
                                } else {
                                    self.telemetry.lock().unwrap().record_job_result(
                                        &submit_miner,
                                        &submit_worker,
                                        false,
                                        attempted_h,
                                        elapsed_ms,
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

                                let (attempted_h, elapsed_ms) = self.fallback_work_sample(
                                    &ns_miner,
                                    &ns_worker,
                                    vardiff.current(),
                                    attempted_hashes,
                                    elapsed_ms,
                                );

                                self.telemetry.lock().unwrap().record_no_solution(
                                    &ns_miner,
                                    &ns_worker,
                                    attempted_h,
                                    elapsed_ms,
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
                                extranonce1_hex,
                                solution_hex,
                                ntime_hex: submit_ntime_hex,
                                ..
                            }) => {
                                tracing::info!(
                                    "v3_external_submit miner={} coin={} job={} nonce={}",
                                    sub_miner_id, coin, external_job_id, nonce
                                );
                                tracing::debug!(
                                    target: "en1_trace",
                                    miner_en1 = %extranonce1_hex,
                                    miner_sol_hex_len = solution_hex.len(),
                                    coin = %coin,
                                    "en1_trace external_submit received from miner"
                                );

                                // Forward to AuxPoW bridge
                                // Get ntime + solution from the submit message (from miner) or
                                // fall back to the bridge job_queue for this coin.
                                // Old miners (barker rig, etc.) don't send solution_hex/ntime_hex,
                                // so we extract them from the job_queue header_hex.
                                //
                                // VRSC CRITICAL FIX: For VerusHash (VRSC/LuckPool), the solution's
                                // nonceSpace (last 15 bytes of the 1344-byte solution) MUST contain
                                // the extranonce1 (pool nonce) at the beginning, otherwise LuckPool
                                // rejects with "invalid solution, pool nonce missing".
                                //
                                // The miner may receive an empty extranonce1 due to a race
                                // condition between the poll task (processing mining.notify) and
                                // the subscribe() call (setting self.extranonce1). To fix this,
                                // we ALWAYS rebuild the solution nonceSpace at the pool side using
                                // the extranonce1 from the JobPackage (which comes directly from
                                // LuckPool's subscribe response), not from the miner's submit.
                                // This matches the V3 reference implementation which builds the
                                // solution at submit time, not at mining time.
                                let (ntime_hex, solution_hex_final, en1_hex_final) = {
                                    let coin_enum = zion_cosmic_harmony::profit::ExternalCoin::from_ticker(&coin);
                                    let job_pkg = coin_enum
                                        .as_ref()
                                        .and_then(|c| self.multi_bridge.latest_job_for_coin(c));

                                    let ntime = if !submit_ntime_hex.is_empty() {
                                        submit_ntime_hex
                                    } else if let Some(ref pkg) = job_pkg {
                                        pkg.ntime.clone()
                                    } else { String::new() };

                                    // Use the extranonce1 from the JobPackage (authoritative,
                                    // from LuckPool subscribe) if available. Fall back to the
                                    // miner's extranonce1_hex only if the job_pkg is unavailable.
                                    let en1_hex = if let Some(ref pkg) = job_pkg {
                                        if !pkg.extranonce1_hex.is_empty() {
                                            pkg.extranonce1_hex.clone()
                                        } else {
                                            extranonce1_hex.clone()
                                        }
                                    } else {
                                        extranonce1_hex.clone()
                                    };

                                    let is_verushash = submit_algorithm.contains("verushash")
                                        || coin.to_ascii_uppercase() == "VRSC";

                                    let sol = if is_verushash {
                                        // Rebuild the solution at the pool side for VRSC.
                                        // 1. Get the original solution (with MMR roots) from the
                                        //    job_pkg header_hex, or from the miner's solution_hex.
                                        // 2. Overwrite the nonceSpace (solution bytes 1329-1343)
                                        //    with [en1][miner_nonce(4B LE)][padding].
                                        // 3. Prepend the varint prefix (fd4005 for 1344 bytes).
                                        const VERUS_SOLUTION_SIZE: usize = 1344;
                                        const VERUS_NONCE_SPACE_SIZE: usize = 15;
                                        const VERUS_NONCE_SPACE_OFFSET: usize = 1329; // within solution
                                        const VERUS_SOLUTION_OFFSET_IN_HEADER: usize = 143;

                                        let en1_bytes = hex::decode(&en1_hex).unwrap_or_default();

                                        // Get the original 1344-byte solution (without varint)
                                        let mut sol_1344: Vec<u8> = if !solution_hex.is_empty() {
                                            // Miner sent a solution with varint prefix (1347 bytes = 2694 hex)
                                            let sol_bytes = hex::decode(&solution_hex).unwrap_or_default();
                                            if sol_bytes.len() == 3 + VERUS_SOLUTION_SIZE {
                                                sol_bytes[3..].to_vec()
                                            } else if sol_bytes.len() == VERUS_SOLUTION_SIZE {
                                                sol_bytes
                                            } else {
                                                // Fallback: extract from job_pkg header
                                                if let Some(ref pkg) = job_pkg {
                                                    let header_hex_stripped = pkg.header_hex.strip_prefix("0x").unwrap_or(&pkg.header_hex);
                                                    if let Ok(header) = hex::decode(header_hex_stripped) {
                                                        if header.len() >= VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE {
                                                            header[VERUS_SOLUTION_OFFSET_IN_HEADER..VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE].to_vec()
                                                        } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                                    } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                                } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                            }
                                        } else if let Some(ref pkg) = job_pkg {
                                            // Extract solution from header_hex
                                            let header_hex_stripped = pkg.header_hex.strip_prefix("0x").unwrap_or(&pkg.header_hex);
                                            if let Ok(header) = hex::decode(header_hex_stripped) {
                                                if header.len() >= VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE {
                                                    header[VERUS_SOLUTION_OFFSET_IN_HEADER..VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE].to_vec()
                                                } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                            } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                        } else {
                                            vec![0u8; VERUS_SOLUTION_SIZE]
                                        };

                                        // Ensure solution is exactly 1344 bytes
                                        if sol_1344.len() < VERUS_SOLUTION_SIZE {
                                            sol_1344.resize(VERUS_SOLUTION_SIZE, 0);
                                        } else if sol_1344.len() > VERUS_SOLUTION_SIZE {
                                            sol_1344.truncate(VERUS_SOLUTION_SIZE);
                                        }

                                        // Overwrite nonceSpace: [en1][miner_nonce(4B LE)][padding]
                                        let en1_len = en1_bytes.len().min(VERUS_NONCE_SPACE_SIZE - 4);
                                        let nonce_le = (nonce as u32).to_le_bytes();
                                        let mut nonce_space = [0u8; VERUS_NONCE_SPACE_SIZE];
                                        if en1_len > 0 {
                                            nonce_space[..en1_len].copy_from_slice(&en1_bytes[..en1_len]);
                                        }
                                        nonce_space[en1_len..en1_len + 4].copy_from_slice(&nonce_le);
                                        sol_1344[VERUS_NONCE_SPACE_OFFSET..VERUS_NONCE_SPACE_OFFSET + VERUS_NONCE_SPACE_SIZE]
                                            .copy_from_slice(&nonce_space);

                                        // Prepend varint: fd4005 = 1344 in Zcash compact varint
                                        let mut solution_with_varint = vec![0xfd, 0x40, 0x05];
                                        solution_with_varint.extend_from_slice(&sol_1344);
                                        hex::encode(&solution_with_varint)
                                    } else if !solution_hex.is_empty() {
                                        solution_hex
                                    } else if let Some(ref pkg) = job_pkg {
                                        // Extract solution (WITH varint prefix) from header_hex
                                        // for ZcashStratum (VRSC).
                                        // Header: version(4)+prevhash(32)+merkle(32)+reserved(32)+
                                        //         ntime(4)+nbits(4)+nonce(32)+varint+solution
                                        // Varint starts at offset 140. LuckPool expects the
                                        // full solution including the CompactSize varint prefix.
                                        // Check coin == VRSC (not algorithm — rigs may report
                                        // deeksha_lite_v1 as their algo but still mine VRSC).
                                        let is_vrsc = coin == "VRSC";
                                        let header_hex_stripped = pkg.header_hex.strip_prefix("0x").unwrap_or(&pkg.header_hex);
                                        if let Ok(header) = hex::decode(header_hex_stripped) {
                                            if header.len() > 141 && is_vrsc {
                                                // Include varint prefix in the solution
                                                hex::encode(&header[140..])
                                            } else { String::new() }
                                        } else { String::new() }
                                    } else { String::new() };
                                    (ntime, sol, en1_hex)
                                };

                                tracing::debug!(
                                    target: "en1_trace",
                                    final_en1 = %en1_hex_final,
                                    miner_en1 = %extranonce1_hex,
                                    sol_hex_len = solution_hex_final.len(),
                                    coin = %coin,
                                    "en1_trace pool-side final extranonce1 for forwarding"
                                );

                                // ── VRSC latest-job-only check ─────────────────────
                                // LuckPool expires VRSC jobs IMMEDIATELY when a new
                                // VerusCoin block is found (clean=true).  The multi-hop
                                // delay (LuckPool→Edge→miner→Edge→LuckPool, 1-2s) means
                                // the miner sometimes finds shares for a job that has
                                // already been superseded.  Forwarding these to LuckPool
                                // always results in "job not found" rejects.
                                //
                                // Fix: for VRSC only, only forward shares for the
                                // LATEST job_id (front of the queue).  Shares for older
                                // job_ids are silently skipped — they would be rejected
                                // by LuckPool anyway.
                                //
                                // Env: ZION_VRSC_LATEST_ONLY=0 to disable (default: 1).
                                if coin.to_ascii_uppercase() == "VRSC" {
                                    let vrsc_latest_only = std::env::var("ZION_VRSC_LATEST_ONLY")
                                        .ok()
                                        .and_then(|v| v.parse::<u32>().ok())
                                        .unwrap_or(1);
                                    if vrsc_latest_only > 0 {
                                        let coin_enum = zion_cosmic_harmony::profit::ExternalCoin::from_ticker(&coin);
                                        if let Some(ref c) = coin_enum {
                                            let job_ids = self.multi_bridge.job_ids_for_coin(c);
                                            if !job_ids.is_empty() {
                                                if let Some(latest_id) = job_ids.last() {
                                                    if latest_id != &external_job_id {
                                                        tracing::info!(
                                                            "external_share_vrsc_skip miner={} coin=VRSC share_job_id={} latest_job_id={} — skipping (not latest, LuckPool will reject)",
                                                            sub_miner_id, external_job_id, latest_id
                                                        );
                                                        let ext_result = PoolMessage::ExternalResult {
                                                            accepted: false,
                                                            status: "stale_skip".to_string(),
                                                            coin: coin.clone(),
                                                        };
                                                        let _ = write_v3_message(writer, &ext_result).await;
                                                        // Record reject in routing stats
                                                        let ext_source = zion_cosmic_harmony::revenue::RevenueSource::VerusHashExternal;
                                                        let group = crate::routing::resolve_session_group(&sub_miner_id, &sub_worker_name);
                                                        self.routing_stats.lock().unwrap().record(group, ext_source, false);
                                                        continue;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                let req = ShareForwardRequest {
                                    job_id: external_job_id.clone(),
                                    nonce,
                                    hash_hex: hash_hex.clone(),
                                    mix_hash_hex: mix_hash_hex.clone(),
                                    algorithm: submit_algorithm.clone(),
                                    header_bytes: Vec::new(),
                                    ntime: ntime_hex,
                                    solution_hex: solution_hex_final,
                                    extranonce1_hex: en1_hex_final,
                                };

                                let bridge = self.multi_bridge.clone();
                                let coin_clone = coin.clone();
                                let bridge_result = tokio::task::spawn_blocking(move || {
                                    bridge.forward_by_ticker(&coin_clone, req)
                                }).await.unwrap_or(None);

                                tracing::info!(
                                    "v3_external_forward miner={} coin={} job={} nonce={} result={:?} status={}",
                                    sub_miner_id, coin, external_job_id, nonce,
                                    bridge_result.as_ref().map(|_| "result"),
                                    match &bridge_result {
                                        Some(crate::auxpow_bridge::ShareForwardOutcome::Result(r)) => format!("{:?}", r),
                                        Some(o) => format!("{:?}", o),
                                        None => "timeout".to_string(),
                                    }
                                );

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
                                    )) => (true, "accepted_unknown".to_string()),
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                                        crate::share_forwarder::ShareForwardResult::NotConnected,
                                    )) => (false, "not_connected".to_string()),
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::NotEnabled) => {
                                        (false, "external_not_enabled".to_string())
                                    }
                                    Some(crate::auxpow_bridge::ShareForwardOutcome::ChannelClosed) => {
                                        (false, "channel_closed".to_string())
                                    }
                                    None => (false, "timeout".to_string()),
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
                                    // Record routing stats for external shares
                                    // Map coin algorithm to RevenueSource
                                    let rev_source = zion_cosmic_harmony::revenue::RevenueSource::from_str_ci(
                                        &submit_algorithm
                                    ).unwrap_or(zion_cosmic_harmony::revenue::RevenueSource::Zion);
                                    let group = crate::routing::resolve_session_group(&sub_miner_id, &sub_worker_name);
                                    self.routing_stats.lock().unwrap().record(group, rev_source, true);
                                } else {
                                    // Record rejected external share
                                    let rev_source = zion_cosmic_harmony::revenue::RevenueSource::from_str_ci(
                                        &submit_algorithm
                                    ).unwrap_or(zion_cosmic_harmony::revenue::RevenueSource::Zion);
                                    let group = crate::routing::resolve_session_group(&sub_miner_id, &sub_worker_name);
                                    self.routing_stats.lock().unwrap().record(group, rev_source, false);
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

        let interval = Duration::from_secs(5);
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
                            let block_target_hex = result.get("target_hex")
                                .and_then(Value::as_str)
                                .unwrap_or("");
                            let reward = result.get("block_reward")
                                .and_then(Value::as_u64)
                                .unwrap_or(0);
                            let template_json = serde_json::to_string(result).unwrap_or_default();

                            // The full block target is too hard for frequent shares.
                            // Broadcast a share target derived from the configured starting
                            // difficulty; the pool keeps the block target for block detection.
                            let share_target = difficulty_to_target(self.vardiff_config.start_difficulty);
                            let share_target_hex = hex::encode(share_target);

                            if !header_hex.is_empty() {
                                tracing::info!(job = %job_id, "broadcasting mining.notify");
                                self.broadcast_job(
                                    &job_id,
                                    header_hex,
                                    &share_target_hex,
                                    block_target_hex,
                                    reward,
                                    &template_json,
                                );
                            }
                        }
                        Err(e) => tracing::warn!("getTemplate request failed: {}", e),
                    }
                }
            }
        }
    }

    fn record_block_accepted(
        &self,
        block_height: u64,
        block_reward: u64,
        miner_id: &str,
        worker_name: &str,
        share_difficulty: u64,
        network_difficulty: u64,
        block_hash: &str,
    ) {
        self.pool.lock().unwrap().on_block_found(block_height, block_reward);
        self.block_tracker.lock().unwrap().record_block_found(
            block_height,
            miner_id,
            worker_name,
            share_difficulty,
            network_difficulty,
            true,
        );
        self.telemetry
            .lock()
            .unwrap()
            .record_block_found(miner_id, worker_name);
        self.template_cache.lock().unwrap().invalidate();
        self.notifier.notify_block_found(miner_id, block_height, worker_name);

        if let Some(ref store) = self.share_store {
            let rec = crate::store::BlockRecord {
                height: block_height,
                hash: block_hash.to_string(),
                miner_id: miner_id.to_string(),
                worker_name: worker_name.to_string(),
                share_difficulty,
                network_difficulty,
                status: "confirmed".to_string(),
            };
            if let Err(e) = store.record_block(&rec) {
                tracing::warn!("share_store record_block failed: {}", e);
            }
        }
    }

    fn record_block_orphaned(
        &self,
        block_height: u64,
        miner_id: &str,
        worker_name: &str,
        share_difficulty: u64,
        network_difficulty: u64,
        block_hash: &str,
    ) {
        self.block_tracker.lock().unwrap().record_block_found(
            block_height,
            miner_id,
            worker_name,
            share_difficulty,
            network_difficulty,
            false,
        );
        self.template_cache.lock().unwrap().invalidate();

        if let Some(ref store) = self.share_store {
            let rec = crate::store::BlockRecord {
                height: block_height,
                hash: block_hash.to_string(),
                miner_id: miner_id.to_string(),
                worker_name: worker_name.to_string(),
                share_difficulty,
                network_difficulty,
                status: "orphaned".to_string(),
            };
            if let Err(e) = store.record_block(&rec) {
                tracing::warn!("share_store record_block (orphan) failed: {}", e);
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    async fn submit_found_block(
        &self,
        job_id: String,
        miner_id: String,
        worker_name: String,
        block: Block,
        block_height: u64,
        block_reward: u64,
        share_difficulty: u64,
        network_difficulty: u64,
    ) -> anyhow::Result<()> {
        let rpc_url = self
            .pool
            .lock()
            .unwrap()
            .config
            .l1_rpc_url
            .clone()
            .unwrap_or_default();
        if rpc_url.is_empty() {
            self.record_block_accepted(
                block_height,
                block_reward,
                &miner_id,
                &worker_name,
                share_difficulty,
                network_difficulty,
                &block.header.header_hash().to_hex(),
            );
            return Ok(());
        }

        let rpc_addr = parse_rpc_addr(&rpc_url)
            .with_context(|| format!("invalid submitBlock RPC URL: {}", rpc_url))?;

        if let Some(tip) = current_chain_height(rpc_addr).await {
            if block.header.height != tip.saturating_add(1) {
                tracing::warn!(
                    "stale block height={} (tip={}), treating as orphan",
                    block.header.height,
                    tip
                );
                self.record_block_orphaned(
                    block_height,
                    &miner_id,
                    &worker_name,
                    share_difficulty,
                    network_difficulty,
                    &block.header.header_hash().to_hex(),
                );
                self.notifier.notify_orphan(block_height);
                return Ok(());
            }
        }

        match submit_block_to_node(rpc_addr, &block).await {
            Ok(()) => {
                self.record_block_accepted(
                    block_height,
                    block_reward,
                    &miner_id,
                    &worker_name,
                    share_difficulty,
                    network_difficulty,
                    &block.header.header_hash().to_hex(),
                );
                Ok(())
            }
            Err(e) => {
                tracing::warn!("submitBlock failed for {}: {}", job_id, e);
                self.record_block_orphaned(
                    block_height,
                    &miner_id,
                    &worker_name,
                    share_difficulty,
                    network_difficulty,
                    &block.header.header_hash().to_hex(),
                );
                self.notifier.notify_orphan(block_height);
                Err(e)
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
    // encode_message already appends '\n', so we must NOT add another one
    // (double newline causes empty-line decode errors on the miner side)
    let line = encode_message(msg).map_err(std::io::Error::other)?;
    let mut w = writer.lock().await;
    w.write_all(line.as_bytes()).await?;
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

fn env_or_f64(key: &str, default: f64) -> f64 {
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
    // Pad short hex to 64 chars (32 bytes) with leading zeros.
    // The node may return a truncated target (e.g. 40 chars = 20 bytes).
    let padded = if hex.len() < 64 {
        format!("{:0>64}", hex)
    } else if hex.len() > 64 {
        hex[..64].to_string()
    } else {
        hex.to_string()
    };
    let mut out = [0u8; 32];
    hex::decode_to_slice(&padded, &mut out).ok()?;
    Some(out)
}

/// Query the node RPC for the current native chain tip height.
///
/// We use `getChainInfo` (not `getStatus`) because `getStatus` returns the V3
/// chain height which is 0 when running with `--v3-no-genesis`.  The pool
/// submits native L1 blocks, so we need the native chain height.
async fn current_chain_height(rpc_addr: SocketAddr) -> Option<u64> {
    let request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getChainInfo",
        "params": [],
    });
    let response = jsonrpc_call(rpc_addr, &request).await.ok()?;
    // Prefer native_chain_height; fall back to chain_height for older nodes.
    response
        .get("result")
        .and_then(|r| {
            r.get("native_chain_height")
                .and_then(|v| v.as_u64())
                .or_else(|| r.get("chain_height").and_then(|v| v.as_u64()))
        })
}

/// Submit a solved block to the node RPC.
async fn submit_block_to_node(rpc_addr: SocketAddr, block: &Block) -> anyhow::Result<()> {
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "submitBlock",
        "params": serde_json::to_value(block).expect("block serializes"),
    });
    let response: serde_json::Value = jsonrpc_call(rpc_addr, &payload).await?;

    if let Some(err) = response.get("error") {
        if !err.is_null() {
            return Err(anyhow::anyhow!("submitBlock returned error: {}", err));
        }
    }

    tracing::info!("submitBlock response: {}", response);
    Ok(())
}

fn success_response(id: Value, result: Value) -> String {
    json!({"id": id, "result": result, "error": null}).to_string()
}

fn rejected_response(id: Value, message: &str) -> String {
    json!({
        "id": id,
        "result": false,
        "error": [23, message, null]
    })
    .to_string()
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
        let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default(), telemetry)));
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
        server.job_notification("zion_1", &header, &target, &target, 6_000_000, "");
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
        server.job_notification("aux_bitcoin_1", &header, &target, &target, 6_000_000, "");
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
        // Loopback is always allowed, so use a non-loopback address.
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1));

        assert!(limiter.allow(ip));
        assert!(!limiter.allow(ip));

        tokio::time::advance(Duration::from_secs(61)).await;
        assert!(limiter.allow(ip));
    }

    #[test]
    fn parse_real_edge_block_template() {
        let template_json = r#"{"block_reward":5400067000,"difficulty":10,"header_hex":"874a54ccfa860f9aee5273dfd99cc6f897946e3c4fab40aa7421f2ae4225eda55aa25269fdfcfa052d7cd0aa34b5140b1a78299f2f9572b915a62ba35a9759b902000000000000003230756a00000000","header_json":"{\"previous_hash\":[135,74,84,204,250,134,15,154,238,82,115,223,217,156,198,248,151,148,110,60,79,171,64,170,116,33,242,174,66,37,237,165],\"merkle_root\":[90,162,82,105,253,252,250,5,45,124,208,170,52,181,20,11,26,120,41,159,47,149,114,185,21,166,43,163,90,151,89,185],\"height\":2,\"timestamp\":1786064946,\"nonce\":0,\"difficulty\":10}","height":2,"previous_hash":"874a54ccfa860f9aee5273dfd99cc6f897946e3c4fab40aa7421f2ae4225eda5","target":"1999999999999999999999999999999999999999999999999999999999999999","target_hex":"1999999999999999999999999999999999999999999999999999999999999999","template_id":253,"transactions":[{"inputs":[],"memo":[99,111,105,110,98,97,115,101],"outputs":[{"address":{"bytes":[],"chain":"zion_l1","encoded":"zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6"},"amount":"4806059630"},{"address":{"bytes":[],"chain":"zion_l1","encoded":"zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8"},"amount":"270003350"},{"address":{"bytes":[],"chain":"zion_l1","encoded":"zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0"},"amount":"270003350"}],"version":1}]}"#;
        match serde_json::from_str::<zion_core::node::BlockTemplate>(template_json) {
            Ok(t) => {
                assert_eq!(t.height, 2);
                assert_eq!(t.transactions.len(), 1);
                assert_eq!(t.transactions[0].outputs.len(), 3);
            }
            Err(e) => {
                panic!("failed to parse template: {} at line {} col {}", e, e.line(), e.column());
            }
        }
    }
}
