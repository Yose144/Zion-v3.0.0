use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::coin_leg::{self, JobRoute};
use anyhow::Context;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use zion_core::node::BlockTemplate as CoreBlockTemplate;
use zion_core::{Block, BlockHeader};
use zion_cosmic_harmony::ExternalCoin;

/// POL-005 fix: sanitize attacker-controlled fields before logging.
/// Strips CRLF and other control characters to prevent log injection.
#[allow(dead_code)]
fn sanitize_log_field(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_control() || c == '\r' || c == '\n' {
                '_'
            } else {
                c
            }
        })
        .collect()
}

use crate::auxpow_bridge::{MultiAuxPowBridge, ShareForwardRequest};
use crate::block_tracker::BlockTracker;
use crate::config::PoolConfig;
use crate::notifications::{NotificationsConfig, Notifier};
use crate::pool::{Pool, PoolError, SessionCounters};
use crate::rate_limit::{IpRateLimiter, ShareRateLimiter};
use crate::revenue_scheduler::RevenueScheduler;
use crate::routing::{resolve_session_group, session_group_name, RoutingStats};
use crate::rpc_client::L1Endpoints;
use crate::share::ShareSubmission;
use crate::share_relay::{relay_share_fire_and_forget, ShareRelayConfig};
use crate::stratum_pearl::{self, is_pearl_stratum};
use crate::stratum_qtu::{self, is_qtu_stratum};
use crate::stratum_v1::{build_set_target, is_stratum_v1, StratumV1Session};
use crate::telemetry::MinerTelemetryRegistry;
use crate::template_cache::TemplateCache;
use crate::v3_protocol::{
    decode_message, encode_message, ExternalStreamJob, PoolMessage, PROTOCOL_VERSION,
};
use crate::vardiff::{difficulty_to_target, VarDiff, VarDiffConfig};

/// Stored job data:
/// - pow header bytes
/// - share target (what the miner must meet for a valid share)
/// - block/network target (what the hash must meet to be a full block)
/// - block reward (flowers)
/// - full node template needed to rebuild the solved block.
type JobEntry = (Vec<u8>, [u8; 32], [u8; 32], u64, Option<CoreBlockTemplate>);

/// Outcome of [`StratumServer::zis_password_auth`] (F2d).
enum ZisPasswordOutcome {
    /// Session continues; `Some(identity)` when bound to a ZIS user.
    Allow(Option<crate::zis::ZisIdentity>),
    /// Session must be rejected (`zis_required` + absent/invalid token).
    Reject,
}

/// Per-connection state for a Stratum v1 miner session.
pub struct StratumV1Ctx {
    pub session: StratumV1Session,
    pub vardiff: VarDiff,
    pub share_rate: ShareRateLimiter,
    pub authorized: bool,
    /// Notification to send to the client after the current response (e.g. set_difficulty).
    pub pending_notification: Option<String>,
    /// ZIS outcome computed asynchronously for the in-flight
    /// `mining.authorize` (F2d — `handle_request_with_ctx` is sync, so
    /// `flush_stratum_response` verifies first and the handler consumes
    /// this).  `Some(Reject)` fails the authorize.
    zis_auth: Option<ZisPasswordOutcome>,
    /// ZIS user bound at authorize ("" = anonymous).
    zis_user: String,
    /// F4-B: peer IP for the invalid-share ban path.
    peer_ip: Option<IpAddr>,
    /// F4-B: consecutive rejected submits — mirrors the V3
    /// `max_consecutive_no_solution` ban semantics for V1 sessions.
    consecutive_invalid: u32,
    /// F4-B: set when the session crossed the ban threshold — the flush
    /// loop closes after sending the last error response.
    banned: bool,
}

impl StratumV1Ctx {
    pub fn new(session_id: u64, vardiff_config: &VarDiffConfig) -> Self {
        let share_rate_per_sec = env_or_f64("ZION_POOL_SHARE_RATE_PER_SEC", 10.0).max(1.0);
        Self {
            session: StratumV1Session::new(session_id),
            vardiff: VarDiff::new(vardiff_config),
            share_rate: ShareRateLimiter::new(share_rate_per_sec),
            authorized: false,
            pending_notification: None,
            zis_auth: None,
            zis_user: String::new(),
            peer_ip: None,
            consecutive_invalid: 0,
            banned: false,
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
    /// Last V3 Job message broadcasted, so we can push it to new V3 clients
    /// immediately on connect instead of waiting for the next template change.
    last_v3_job: Arc<Mutex<Option<String>>>,
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
    /// Per-session V3 nonce-space allocator — every session mines a
    /// disjoint 2^32 window (`start_nonce = base`) so two sessions on the
    /// same job can never produce identical (job, nonce) shares → the
    /// "duplicate" rejects seen on colliding sessions. Seeded from the
    /// clock so a restart skips to a fresh era (persisted dedup would
    /// otherwise replay-reject the first scans at base 0).
    v3_nonce_alloc: Arc<AtomicU64>,
    /// Max concurrent sessions per IP.
    max_sessions_per_ip: usize,
    /// Global concurrent-session cap (F4-B).
    max_sessions_total: usize,
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
    /// Connection/session counters shared with the HTTP API via `Pool`.
    session_counters: SessionCounters,
    /// Default GPU AuxPoW coin embedded in broadcast Job messages —
    /// `ZION_POOL_AUXPOW_COIN` when it names a GPU coin, else the first
    /// enabled GPU coin by ticker. Per-session routes or a miner's
    /// CoinPreference message can override it for that session only.
    gpu_coin_default: Option<ExternalCoin>,
    /// Default CPU AuxPoW coin — `ZION_POOL_AUXPOW_CPU_COIN` when it names
    /// a CPU coin, else the first enabled CPU coin by ticker.
    cpu_coin_default: Option<ExternalCoin>,
    /// Default second GPU AuxPoW coin (Quad mode) —
    /// `ZION_POOL_AUXPOW_COIN2` when it names a GPU coin, else the first
    /// enabled GPU coin by ticker different from `gpu_coin_default`.
    gpu_coin_default_2: Option<ExternalCoin>,
    /// Per-miner GPU coin routes from `ZION_POOL_AUXPOW_GPU_COIN_ROUTE`
    /// (`pattern=COIN,...` — `*` glob, case-insensitive; matched against
    /// the worker tail, full worker_name, miner_id and "miner/worker").
    gpu_coin_routes: Vec<(String, ExternalCoin)>,
    /// Per-miner second-GPU coin routes (`ZION_POOL_AUXPOW_GPU_COIN2_ROUTE`)
    /// — same glob syntax as the first-slot routes; seeds
    /// `session_gpu2_pref` at Hello so sessions that never send a
    /// CoinPreference still get a pinned gpu2 coin instead of the global
    /// `ZION_POOL_AUXPOW_COIN2` default.
    gpu2_coin_routes: Vec<(String, ExternalCoin)>,
    /// Per-miner CPU coin routes (`ZION_POOL_AUXPOW_CPU_COIN_ROUTE`).
    cpu_coin_routes: Vec<(String, ExternalCoin)>,
    /// ZIS session verifier — `Some` when `ZION_POOL_ZIS_AUTH` is
    /// optional/required, `None` in the default off mode.
    zis: Option<Arc<crate::zis::ZisVerifier>>,
    /// Whether an invalid/absent auth_token rejects the session
    /// (`ZION_POOL_ZIS_AUTH=required`).
    zis_required: bool,
    /// Latest ZION template height broadcast — used as the bookkeeping
    /// height when crediting external-stream shares into PPLNS.
    current_height: Arc<AtomicU64>,
    /// Native Quantus stratum dialect (`login`/`job`/`submit`,
    /// miningcore-style) for external QPoW miners like SRBMiner.
    /// `ZION_POOL_QTU_STRATUM=0` disables; default enabled — the `login`
    /// method was previously a dead path anyway, so this only adds
    /// capability, it cannot regress V1/V3 traffic.
    qtu_stratum_enabled: bool,
    pearl_stratum_enabled: bool,
    /// Pearl PoUW bridge: polls `pearl-gateway` miner_rpc for jobs and
    /// verifies/forwards `PearlSubmit` shares. `None` unless
    /// `ZION_POOL_PEARL_GATEWAY` is set.
    pearl: Option<Arc<crate::pearl_gateway::PearlRuntime>>,
    /// `true` on the dedicated SOLO listener — sessions get normal job
    /// feeds and share validation, but their shares never weight the
    /// PPLNS window and a found block pays winner-take-all to the finder.
    solo_mode: bool,
    /// Share validator copied out of the Pool at construction so submit
    /// paths can run the PoW hash without holding `pool.lock()` —
    /// `ShareValidator` is `Copy` + stateless, the copy is free.
    validator: crate::validator::ShareValidator,
}

/// Decrements the shared active-session counter when the session task
/// exits, regardless of which return path it takes.
struct ActiveSessionGuard(Arc<AtomicU64>);

impl Drop for ActiveSessionGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::Relaxed);
    }
}

/// Stable fingerprint of the ZION template + external streams.
/// We compare these instead of the full V3 job message because the ZION
/// header timestamp/nonce are updated every second, which would otherwise
/// force a broadcast every poll cycle.
///
/// For the external streams we also include ntime and target. Some upstream
/// pools (e.g. LuckPool/VRSC) may keep the same job_id while rolling ntime
/// or retargeting, and the miner must receive the updated ntime/target to
/// avoid "job not found" / "Job expired" / "low difficulty" rejects.
#[derive(Clone, Debug, PartialEq, Eq)]
struct JobFingerprint {
    zion_height: u64,
    zion_previous_hash: String,
    zion_merkle_root: Vec<u8>,
    gpu_external_job_id: Option<String>,
    gpu_external_ntime: Option<String>,
    gpu_external_target: Option<String>,
    cpu_external_job_id: Option<String>,
    cpu_external_ntime: Option<String>,
    cpu_external_target: Option<String>,
    /// Latest job id of EVERY enabled external coin ("TICKER:jobid", sorted
    /// by ticker). With per-session coin routing a rotation of a non-default
    /// coin must still trigger a broadcast, or pinned sessions would keep
    /// mining a job the upstream pool already replaced.
    external_job_ids: Vec<String>,
}

impl StratumServer {
    /// Get a reference to the routing stats for the HTTP API.
    pub fn routing_stats_handle(&self) -> Arc<Mutex<RoutingStats>> {
        Arc::clone(&self.routing_stats)
    }

    pub fn new(pool: Arc<Mutex<Pool>>) -> Self {
        let (config, telemetry, session_counters, pearl, validator) = {
            let pool = pool.lock().unwrap();
            (
                pool.config.clone(),
                pool.telemetry.clone(),
                pool.session_counters.clone(),
                pool.pearl.clone(),
                pool.validator,
            )
        };
        let (notify_tx, _notify_rx) = broadcast::channel(256);

        let vardiff_config = VarDiffConfig::from_env();

        let max_sessions_per_ip = env_or("ZION_POOL_MAX_SESSIONS_PER_IP", 10) as usize;
        // F4-B: global concurrent-session cap — bounds accept-loop work
        // under a connect storm regardless of source-IP diversity.
        let max_sessions_total = env_or("ZION_POOL_MAX_SESSIONS", 2048) as usize;
        let max_consecutive_no_solution = env_or("ZION_POOL_MAX_NO_SOLUTION", 10) as u32;
        let no_solution_ban_duration =
            Duration::from_secs(env_or("ZION_POOL_NOSOLUTION_BAN_SECS", 300));

        Self {
            pool,
            config,
            jobs: Arc::new(Mutex::new(HashMap::new())),
            notify_tx,
            last_v3_job: Arc::new(Mutex::new(None)),
            telemetry,
            block_tracker: Arc::new(Mutex::new(BlockTracker::new())),
            template_cache: Arc::new(Mutex::new(TemplateCache::new(Duration::from_secs(15)))),
            ip_sessions: Arc::new(Mutex::new(HashMap::new())),
            no_solution_bans: Arc::new(Mutex::new(HashMap::new())),
            max_sessions_per_ip,
            max_sessions_total,
            max_consecutive_no_solution,
            no_solution_ban_duration,
            vardiff_config,
            multi_bridge: MultiAuxPowBridge::new(),
            v3_nonce_alloc: Arc::new(AtomicU64::new(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos() as u64)
                    .unwrap_or(0)
                    & 0xFFFF_FFFF_0000_0000,
            )),
            relay_config: ShareRelayConfig::from_env(),
            notifier: Arc::new(Notifier::new(NotificationsConfig::from_env())),
            revenue_scheduler: Arc::new(Mutex::new(RevenueScheduler::from_env(0.0))),
            routing_stats: Arc::new(Mutex::new(RoutingStats::new(env_or(
                "ZION_POOL_ROUTING_LOG_EVERY",
                1000,
            )))),
            share_store: None,
            session_counters,
            gpu_coin_default: std::env::var("ZION_POOL_AUXPOW_COIN")
                .ok()
                .and_then(|s| ExternalCoin::from_str_loose(s.trim()))
                .filter(|c| c.is_gpu()),
            cpu_coin_default: std::env::var("ZION_POOL_AUXPOW_CPU_COIN")
                .ok()
                .and_then(|s| ExternalCoin::from_str_loose(s.trim()))
                .filter(|c| c.is_cpu()),
            gpu_coin_default_2: std::env::var("ZION_POOL_AUXPOW_COIN2")
                .ok()
                .and_then(|s| ExternalCoin::from_str_loose(s.trim()))
                .filter(|c| c.is_gpu()),
            gpu_coin_routes: parse_coin_routes("ZION_POOL_AUXPOW_GPU_COIN_ROUTE"),
            gpu2_coin_routes: parse_coin_routes("ZION_POOL_AUXPOW_GPU_COIN2_ROUTE"),
            cpu_coin_routes: parse_coin_routes("ZION_POOL_AUXPOW_CPU_COIN_ROUTE"),
            zis: {
                let mode = crate::zis::ZisVerifier::auth_mode();
                match mode {
                    crate::zis::ZisAuthMode::Off => None,
                    _ => Some(Arc::new(crate::zis::ZisVerifier::from_env())),
                }
            },
            zis_required: crate::zis::ZisVerifier::auth_mode() == crate::zis::ZisAuthMode::Required,
            current_height: Arc::new(AtomicU64::new(0)),
            qtu_stratum_enabled: std::env::var("ZION_POOL_QTU_STRATUM")
                .map(|v| v.trim() != "0")
                .unwrap_or(true),
            pearl_stratum_enabled: std::env::var("ZION_POOL_PEARL_STRATUM")
                .map(|v| v.trim() == "1")
                .unwrap_or(false),
            pearl,
            solo_mode: false,
            validator,
        }
    }

    /// Mark this listener as the dedicated SOLO port: shares still validate
    /// and feed telemetry/dedup, but they never weight the PPLNS window and
    /// an accepted block pays winner-take-all to the submitter.
    pub fn with_solo_mode(mut self) -> Self {
        self.solo_mode = true;
        self
    }

    /// Whether this listener is the SOLO port.
    pub fn solo_mode(&self) -> bool {
        self.solo_mode
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

    /// Share one `BlockTracker` across all listeners (plain/TLS/extra
    /// ports) and the HTTP API — otherwise each listener keeps its own
    /// luck/shares-since-block counters and the reported luck fragments.
    pub fn with_block_tracker(mut self, tracker: Arc<Mutex<BlockTracker>>) -> Self {
        self.block_tracker = tracker;
        self
    }

    /// Handle to the shared block tracker (luck, pending, orphans).
    pub fn block_tracker(&self) -> Arc<Mutex<BlockTracker>> {
        Arc::clone(&self.block_tracker)
    }

    /// Latest broadcast ZION template height — lets the HTTP API compute
    /// the next block's subsidy for est. earnings.
    pub fn current_height(&self) -> Arc<AtomicU64> {
        Arc::clone(&self.current_height)
    }

    /// Share the template-height counter across listeners — otherwise a
    /// miner submitting to a listener that hasn't broadcast yet gets
    /// external-share credit booked at height 0.
    pub fn with_current_height(mut self, height: Arc<AtomicU64>) -> Self {
        self.current_height = height;
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

    /// ZIS auth via the password field (F2d) — shared by stratum dialects
    /// that have no `auth_token` field: QTU `login.pass`, PRL
    /// `authorize.pass`, V1 `mining.authorize` password.
    ///
    /// Semantics mirror the V3 Hello path: `pass` not starting with
    /// `zis_` is anonymous; a `zis_`-prefixed pass is verified against
    /// the identity service and a valid, unbanned key binds the session.
    /// `required` mode rejects absent/invalid tokens; `optional` logs
    /// and continues anonymous.
    async fn zis_password_auth(
        &self,
        pass: &str,
        dialect: &str,
        miner_id: &str,
        ip: IpAddr,
    ) -> ZisPasswordOutcome {
        let Some(verifier) = &self.zis else {
            return ZisPasswordOutcome::Allow(None);
        };
        let token = pass.strip_prefix("zis_");
        let identity = match token {
            Some(_) => verifier.verify(pass).await,
            None => None,
        };
        match identity {
            Some(idn) if !verifier.is_banned(&idn.sub) => {
                tracing::info!(
                    "{}_zis_auth miner={} sub={} ip={}",
                    dialect,
                    miner_id,
                    idn.sub,
                    ip
                );
                ZisPasswordOutcome::Allow(Some(idn))
            }
            _ => {
                if self.zis_required {
                    let reason = if token.is_none() {
                        "no_token"
                    } else {
                        "invalid_or_banned"
                    };
                    tracing::warn!(
                        "{}_zis_reject miner={} ip={} reason={}",
                        dialect,
                        miner_id,
                        ip,
                        reason
                    );
                    return ZisPasswordOutcome::Reject;
                }
                if token.is_some() {
                    tracing::warn!(
                        "{}_zis_invalid miner={} — continuing anonymous",
                        dialect,
                        miner_id
                    );
                }
                ZisPasswordOutcome::Allow(None)
            }
        }
    }

    /// Persist a successful ZIS bind so the public identity endpoint can
    /// report `bound` after the session closes. Best-effort — a store
    /// failure must never break a login.
    fn record_zis_binding(&self, key: &str, sub: &str) {
        if let Some(store) = &self.share_store {
            if let Err(e) = store.record_zis_binding(key, sub) {
                tracing::warn!("zis_binding record failed key={}: {e}", key);
            }
        }
    }

    /// Register a ZIS-linked payout address for `key` (wallet or miner
    /// id), mirroring the V3 Hello auto-resolve.  No-op without a
    /// matching linked address for `chain` (`"quantus"`, `"pearl"`,
    /// `"zion"`).
    fn zis_register_linked_payout(&self, idn: &crate::zis::ZisIdentity, chain: &str, key: &str) {
        let addr = match chain {
            "quantus" => idn.quantus_address.as_deref(),
            "pearl" => idn.pearl_address.as_deref(),
            _ => idn.zion_address.as_deref(),
        };
        if let Some(a) = addr {
            if let Some((c, registered)) = self.pool.lock().unwrap().register_payout_address(key, a)
            {
                tracing::info!(
                    "pool_payout miner={} chain={} addr={} (zis-linked)",
                    key,
                    c,
                    registered
                );
            }
        }
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
                    [["mining.set_difficulty", "sv1"], ["mining.notify", "sv1"]],
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
                // F2d: consume the ZIS outcome pre-verified by
                // `flush_stratum_response` (async) — Reject fails the
                // authorize without touching session state.
                if let Some(outcome) = ctx.zis_auth.take() {
                    match outcome {
                        ZisPasswordOutcome::Reject => {
                            return error_response(Some(id), -33000, "unauthorized");
                        }
                        ZisPasswordOutcome::Allow(idn) => {
                            if let Some(idn) = idn {
                                ctx.zis_user = idn.sub.clone();
                                let (miner_id, _) = StratumV1Session::parse_username(&username);
                                self.record_zis_binding(&miner_id, &idn.sub);
                                self.zis_register_linked_payout(&idn, "zion", &miner_id);
                            }
                        }
                    }
                }
                if !username.is_empty() {
                    let (miner_id, worker_name) = StratumV1Session::parse_username(&username);
                    // F4 public hardening: reject garbage wallet identities —
                    // an unparsable wallet would silently mine toward the
                    // pool's own address.  ZIS sessions may legitimately use
                    // a non-address miner id (payout via linked address).
                    if ctx.zis_user.is_empty()
                        && !self.pool.lock().unwrap().wallet_is_valid(&miner_id)
                    {
                        return error_response(Some(id), -33000, "invalid wallet");
                    }
                    ctx.session.miner_id = miner_id.clone();
                    ctx.session.worker_name = worker_name.clone();
                    ctx.authorized = true;

                    self.pool.lock().unwrap().register_worker(&username);
                    self.telemetry.lock().unwrap().touch_session(
                        &miner_id,
                        &worker_name,
                        &ctx.session.algorithm,
                        &ctx.session.backend,
                        &ctx.zis_user,
                    );
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

    /// F2d: when `line` is `mining.authorize`, run the async ZIS password
    /// check and stage the outcome in `ctx.zis_auth` for the sync handler.
    async fn v1_zis_precheck(&self, ctx: &mut StratumV1Ctx, line: &str, ip: IpAddr) {
        if !line.contains("\"mining.authorize\"") {
            return;
        }
        if let Ok(v) = serde_json::from_str::<Value>(line) {
            let pass = v
                .get("params")
                .and_then(|p| p.get(1))
                .and_then(Value::as_str)
                .unwrap_or("");
            let miner = v
                .get("params")
                .and_then(|p| p.get(0))
                .and_then(Value::as_str)
                .unwrap_or("");
            ctx.zis_auth = Some(self.zis_password_auth(pass, "v1", miner, ip).await);
        }
    }

    /// Write the response for a Stratum v1 request plus any queued notification.
    async fn flush_stratum_response<W>(
        &self,
        writer: &Arc<tokio::sync::Mutex<W>>,
        ctx: &mut StratumV1Ctx,
        line: &str,
        ip: IpAddr,
    ) -> std::io::Result<()>
    where
        W: AsyncWrite + Unpin + Send,
    {
        // F2d: `mining.authorize` password may carry `zis_<token>` — verify
        // here at the async boundary; the sync handler consumes
        // `ctx.zis_auth` to accept/reject the authorize.
        self.v1_zis_precheck(ctx, line, ip).await;
        let response = self.handle_request_with_ctx(line, ctx);
        let mut w = writer.lock().await;
        w.write_all(response.as_bytes()).await?;
        w.write_all(b"\n").await?;
        if let Some(notif) = ctx.pending_notification.take() {
            w.write_all(notif.as_bytes()).await?;
            w.write_all(b"\n").await?;
        }
        w.flush().await?;
        drop(w);
        // F4-B: the invalid-share ban fires after its error response is
        // on the wire — the session loop then drops the connection.
        if ctx.banned {
            return Err(std::io::Error::new(
                std::io::ErrorKind::ConnectionAborted,
                "banned",
            ));
        }
        Ok(())
    }

    fn handle_submit(&self, id: Value, params: Value, ctx: &mut StratumV1Ctx) -> String {
        // Enforce per-session share rate limit.
        if !ctx.share_rate.allow() {
            tracing::warn!(
                "share rate limited — session={}",
                ctx.session.extranonce1_hex
            );
            return rejected_response(id, "share rate limited");
        }

        // P-02: submits must be bound to an authorized identity — an
        // unauthorized session gets no validation work or telemetry.
        if !ctx.authorized {
            return error_response(Some(id), -33000, "unauthorized");
        }

        let (worker, job_id, nonce_hex, _hash_hex) = match Self::parse_submit_params(&params) {
            Ok(v) => v,
            Err(msg) => return error_response(Some(id), -32602, msg),
        };

        // P-02: the submitted worker must belong to the authorized username —
        // `worker` is the credit key, so a foreign wallet here would only
        // donate hashrate, but a mismatched miner id still poisons telemetry
        // (rejected counters, worker names) under someone else's identity.
        if split_worker(&worker).0 != ctx.session.miner_id {
            return error_response(Some(id), -33000, "worker not authorized");
        }

        let (header, job_share_target, block_target, reward, template) = {
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

        // Validate against the target issued WITH this job — validating
        // against the live session vardiff rejects honest work whenever a
        // retarget lands between job issue and submit (~50% rejects seen
        // in production). Replay protection is handled by share_seen dedup,
        // and credit is recorded at the job's own difficulty.
        let share_target = job_share_target;
        let share_difficulty =
            crate::telemetry::expected_hashes_for_target(&job_share_target).max(1.0) as u64;

        let submission = ShareSubmission {
            worker,
            job_id: job_id.clone(),
            nonce_hex: nonce_hex.clone(),
            difficulty: share_difficulty,
            solo: self.solo_mode,
        };

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

        let height = template.as_ref().map(|t| t.height).unwrap_or(0);

        let (result, share_hash) = match coin_leg::route_job_id(&job_id) {
            JobRoute::ZionV1 => self.submit_share_two_phase(
                &submission,
                nonce,
                &header,
                height,
                &share_target,
                None,
            ),
            JobRoute::Auxpow(coin) => self.submit_share_two_phase(
                &submission,
                nonce,
                &header,
                height,
                &share_target,
                Some(coin),
            ),
            _ => (Err(PoolError::UnknownJob), None),
        };

        match result {
            Ok(true) => {
                ctx.consecutive_invalid = 0;
                tracing::info!(
                    "share accepted — job={}, worker={}, nonce={}",
                    job_id,
                    worker_name,
                    nonce_hex
                );
                self.telemetry.lock().unwrap().record_job_result(
                    &miner_id,
                    &worker_short,
                    true,
                    attempted_hashes,
                    elapsed_ms,
                );
                // Record share for block tracker luck.
                self.block_tracker.lock().unwrap().record_share();
                // Check whether the share is also a full block — the hash
                // already computed by the submit phase is reused here, so
                // no second PoW hash runs under a lock.
                self.check_and_record_block(
                    &job_id,
                    &worker_name,
                    nonce,
                    &block_target,
                    share_hash,
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
                {
                    let mut t = self.telemetry.lock().unwrap();
                    t.record_job_result(
                        &miner_id,
                        &worker_short,
                        false,
                        attempted_hashes,
                        elapsed_ms,
                    );
                    t.record_reject_reason(&miner_id, &worker_short, "zion", "low_difficulty");
                }
                if self.v1_invalid_share_ban(ctx) {
                    return rejected_response(id, "banned: too many invalid shares");
                }
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
                {
                    let mut t = self.telemetry.lock().unwrap();
                    t.record_job_result(
                        &miner_id,
                        &worker_short,
                        false,
                        attempted_hashes,
                        elapsed_ms,
                    );
                    t.record_reject_reason(&miner_id, &worker_short, "zion", &e.to_string());
                }
                if self.v1_invalid_share_ban(ctx) {
                    return rejected_response(id, "banned: too many invalid shares");
                }
                error_response(Some(id), -32000, &format!("share error: {}", e))
            }
        }
    }

    /// F4-B: V1 invalid-share ban — mirrors the V3 consecutive-NoSolution
    /// rule.  `true` when the session just crossed the threshold (response
    /// is still sent, then the flush loop drops the connection).
    fn v1_invalid_share_ban(&self, ctx: &mut StratumV1Ctx) -> bool {
        ctx.consecutive_invalid = ctx.consecutive_invalid.saturating_add(1);
        if ctx.consecutive_invalid >= self.max_consecutive_no_solution && !ctx.banned {
            ctx.banned = true;
            if let Some(ip) = ctx.peer_ip {
                tracing::warn!(
                    "v1_invalid_share_ban ip={} miner={} consecutive={}",
                    ip,
                    ctx.session.miner_id,
                    ctx.consecutive_invalid,
                );
                self.no_solution_bans
                    .lock()
                    .unwrap()
                    .insert(ip, Instant::now() + self.no_solution_ban_duration);
            }
            return true;
        }
        false
    }

    /// Parse Stratum v1 `mining.submit` params.
    ///
    /// Supported forms:
    /// - `[worker, job_id, nonce]`
    /// - `[worker, job_id, nonce, hash]`
    /// - `[worker, job_id, extranonce2, ntime, nonce]`
    /// - `[worker, job_id, extranonce2, ntime, nonce, hash, ...]`
    fn parse_submit_params(
        params: &Value,
    ) -> Result<(String, String, String, String), &'static str> {
        let arr = params.as_array().ok_or("invalid params")?;
        if arr.len() < 3 {
            return Err("invalid params");
        }

        let worker = arr[0].as_str().unwrap_or("anonymous").to_string();
        let job_id = arr[1]
            .as_str()
            .ok_or("job_id must be a string")?
            .to_string();

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

    /// Two-phase share admission. Dedup probe and PPLNS credit take
    /// short `pool.lock()` holds; the PoW hash runs unlocked on this
    /// task's own validator copy. Under submit storms the per-share
    /// lock hold drops by the full validation cost instead of convoying
    /// hashing into the global mutex — the 2026-10-28 wedge RCA showed
    /// exactly that starvation pattern.
    ///
    /// Returns the admission result plus the computed share hash so the
    /// caller can reuse it for the block-target check (accepted shares
    /// previously paid a second identical hash under the lock).
    fn submit_share_two_phase(
        &self,
        submission: &ShareSubmission,
        nonce: u64,
        header: &[u8],
        height: u64,
        share_target: &[u8; 32],
        aux: Option<ExternalCoin>,
    ) -> (Result<bool, PoolError>, Option<[u8; 32]>) {
        let dedup_bucket = match aux {
            Some(coin) => format!("aux:{}:{coin}", submission.job_id),
            None => submission.job_id.clone(),
        };
        // Phase 1 — replay probe. No mark is taken so an invalid share
        // keeps its tag for a later legit resubmit.
        {
            let pool = self.pool.lock().unwrap();
            if pool.share_replay_probe(&dedup_bucket, nonce) {
                pool.note_rejected_share();
                return (Err(PoolError::DuplicateShare), None);
            }
        }
        // Phase 2 — PoW hash with no lock held.
        let hash: [u8; 32] = match aux {
            Some(coin) => self.validator.auxpow_hash(coin, header, nonce),
            None => *self.validator.zion_hash(header, nonce).as_bytes(),
        };
        if !zion_miner::auxpow::hasher::meets_target(&hash, share_target) {
            self.pool.lock().unwrap().note_rejected_share();
            return (Err(PoolError::Invalid), Some(hash));
        }
        // Phase 3 — atomic dedup claim + PPLNS credit.
        let coin_key = aux.map(|c| c.as_str()).unwrap_or("zion");
        let result = self.pool.lock().unwrap().credit_validated_share(
            submission,
            nonce,
            &dedup_bucket,
            coin_key,
            height,
        );
        (result, Some(hash))
    }

    #[allow(clippy::too_many_arguments)]
    fn check_and_record_block(
        &self,
        job_id: &str,
        worker_full: &str,
        nonce: u64,
        block_target: &[u8; 32],
        share_hash: Option<[u8; 32]>,
        share_difficulty: u64,
        block_reward: u64,
        template: Option<CoreBlockTemplate>,
    ) {
        // The submit phase already computed the share hash unlocked —
        // the block check is a pure comparison, no `pool.lock()` needed.
        // `rpc_url` comes from the server's own config clone (l1_rpc_url
        // is static after boot).
        let is_block = share_hash.is_some_and(|h| h <= *block_target);
        if !is_block {
            return;
        }
        let rpc_url = self.config.l1_rpc_url.clone();

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
            let mut jobs = self.jobs.lock().unwrap();
            // POL-007 fix: evict old jobs when the map grows too large.
            // Keep only the most recent 256 entries to bound memory.
            if jobs.len() > 256 {
                let keys_to_remove: Vec<String> = jobs
                    .keys()
                    .take(jobs.len().saturating_sub(200))
                    .cloned()
                    .collect();
                for k in keys_to_remove {
                    jobs.remove(&k);
                }
            }
            jobs.insert(
                job_id.to_string(),
                (
                    bytes,
                    share_target,
                    block_target,
                    block_reward,
                    template.clone(),
                ),
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
            *self.last_v3_job.lock().unwrap() = Some(v3_msg.clone());
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
        self.current_height.store(height, Ordering::Relaxed);
        let network_difficulty = template
            .get("difficulty")
            .and_then(Value::as_u64)
            .unwrap_or(1)
            .max(1);
        let numeric_job_id: u64 = job_id
            .strip_prefix("zion_")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let algorithm = algorithm_for_height(height);
        // Never ask for shares harder than the current network difficulty.
        let share_difficulty = self.vardiff_config.start_difficulty.min(network_difficulty);
        let vardiff_target = difficulty_to_target(share_difficulty);
        let vardiff_target_hex = hex::encode(vardiff_target);

        // Quad-stream: fetch external jobs from AuxPoW bridge. The second
        // GPU slot excludes whatever coin stream 1 picked so the two GPU
        // streams never duplicate.
        let external_stream = self.build_external_stream_gpu(None);
        let stream1_coin = external_stream
            .as_ref()
            .and_then(|j| ExternalCoin::from_ticker(&j.coin));
        let external_stream_2 = self.build_external_stream_gpu2(None, stream1_coin);
        let external_stream_cpu = self.build_external_stream_cpu(None);

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
            external_stream_2,
        };
        encode_message(&job_msg).ok()
    }

    /// Build the GPU external stream job from the AuxPoW bridge.
    /// `prefer` pins the coin (per-session route / CoinPreference); the env
    /// default is tried next, then the remaining enabled GPU coins in
    /// ticker order — deterministic regardless of HashMap order.
    fn build_external_stream_gpu(&self, prefer: Option<ExternalCoin>) -> Option<ExternalStreamJob> {
        self.build_external_stream(prefer, false, self.gpu_coin_default, None)
    }

    /// Build the second GPU external stream (Quad mode). `exclude` drops
    /// the coin already embedded in `external_stream` so the two slots
    /// never carry the same coin.
    fn build_external_stream_gpu2(
        &self,
        prefer: Option<ExternalCoin>,
        exclude: Option<ExternalCoin>,
    ) -> Option<ExternalStreamJob> {
        self.build_external_stream(prefer, false, self.gpu_coin_default_2, exclude)
    }

    /// Build the CPU external stream job from the AuxPoW bridge.
    /// Same selection order as the GPU variant, restricted to CPU coins.
    ///
    /// V3 philosophy: use the upstream pool's target as-is (no override).
    /// V3 didn't override VRSC difficulty and achieved 95% accept rate.
    fn build_external_stream_cpu(&self, prefer: Option<ExternalCoin>) -> Option<ExternalStreamJob> {
        self.build_external_stream(prefer, true, self.cpu_coin_default, None)
    }

    /// Pick the freshest external job among enabled coins of the given
    /// device class. Candidate order: `prefer`, then the env default coin,
    /// then the rest sorted by ticker (see `enabled_coins`).
    fn build_external_stream(
        &self,
        prefer: Option<ExternalCoin>,
        cpu: bool,
        env_default: Option<ExternalCoin>,
        exclude: Option<ExternalCoin>,
    ) -> Option<ExternalStreamJob> {
        let mut coins = self.multi_bridge.enabled_coins();
        coins.retain(|c| self.multi_bridge.is_cpu_coin(c) == cpu);
        // Pearl rides the GPU external stream from our own gateway bridge —
        // it never arrives via upstream pool connections.
        if !cpu {
            if let Some(pearl) = &self.pearl {
                if pearl.pick_served_job().is_some() && !coins.contains(&ExternalCoin::Pearl) {
                    coins.push(ExternalCoin::Pearl);
                }
            }
        }
        if let Some(ex) = exclude {
            coins.retain(|c| *c != ex);
        }
        if coins.is_empty() {
            return None;
        }
        let mut order: Vec<ExternalCoin> = Vec::with_capacity(coins.len());
        for c in [prefer, env_default].into_iter().flatten() {
            if coins.contains(&c) && !order.contains(&c) {
                order.push(c);
            }
        }
        for c in coins {
            if !order.contains(&c) {
                order.push(c);
            }
        }
        for coin in &order {
            // Pearl leg: served from our own pearl-gateway poll, verified
            // locally on submit (see PearlSubmit handler).
            if *coin == ExternalCoin::Pearl {
                if let Some(pearl) = &self.pearl {
                    if let Some(job) = pearl.pick_served_job() {
                        return Some(job);
                    }
                }
                continue;
            }
            // Hybrid native Quantus leg: when enabled, a share of broadcasts
            // is served from our own quantus-node job queue (fresh jobs
            // only — stale native automatically falls back to upstream).
            if *coin == ExternalCoin::Quantus {
                if let Some(job) = self.multi_bridge.native_pick_job() {
                    return Some(Self::job_to_ext_stream(coin, &job));
                }
            }
            if let Some(job) = self.multi_bridge.latest_job_for_coin(coin) {
                if !Self::job_is_fresh(&job) {
                    tracing::debug!(
                        "build_external_stream: dropping stale {} job {}",
                        coin.as_str(),
                        job.external_job_id
                    );
                    continue;
                }
                return Some(Self::job_to_ext_stream(coin, &job));
            }
        }
        None
    }

    fn job_to_ext_stream(
        coin: &ExternalCoin,
        job: &crate::auxpow_bridge::JobPackage,
    ) -> ExternalStreamJob {
        ExternalStreamJob {
            coin: coin.as_str().to_string(),
            algorithm: job.algorithm.clone(),
            job_id: job.external_job_id.clone(),
            header_hex: job.header_hex.clone(),
            target_hex: job.target_hex.clone(),
            height: job.height,
            extranonce1_hex: job.extranonce1_hex.clone(),
            protocol: "stratum".to_string(),
            seed_hash_hex: job.seed_hash_hex.clone(),
            timestamp: 0,
            ntime_hex: job.ntime.clone(),
            eq_params: job.eq_params.clone(),
            eq_pers: job.eq_pers.clone(),
        }
    }

    /// Rewrite the `external_stream` / `external_stream_cpu` fields of a
    /// broadcast Job line for a session with explicit coin preferences,
    /// and pin `start_nonce` to the session's own 2^32 nonce window.
    /// Returns the original line unchanged when no preference applies and
    /// `nonce_base` is 0 — the common path stays cheap.
    fn session_job_line(
        &self,
        line: &str,
        gpu_pref: Option<ExternalCoin>,
        cpu_pref: Option<ExternalCoin>,
        gpu2_pref: Option<ExternalCoin>,
        nonce_base: u64,
    ) -> String {
        if nonce_base == 0 && gpu_pref.is_none() && cpu_pref.is_none() && gpu2_pref.is_none() {
            return line.to_string();
        }
        let mut v: serde_json::Value = match serde_json::from_str(line.trim()) {
            Ok(v) => v,
            Err(_) => return line.to_string(),
        };
        if v.get("type").and_then(|t| t.as_str()) != Some("job") {
            return line.to_string();
        }
        let mut changed = false;
        if nonce_base != 0 && v.get("start_nonce").and_then(|n| n.as_u64()) == Some(0) {
            v["start_nonce"] = serde_json::json!(nonce_base);
            changed = true;
        }
        if let Some(coin) = gpu_pref {
            changed |= self.rewrite_ext_field(&mut v, "external_stream", coin);
        }
        if let Some(coin) = cpu_pref {
            changed |= self.rewrite_ext_field(&mut v, "external_stream_cpu", coin);
        }
        if let Some(coin) = gpu2_pref {
            // Never serve the same coin on both GPU slots — a duplicate
            // stream would waste the miner's GPU time on identical jobs.
            let stream1_coin = v
                .get("external_stream")
                .and_then(|f| f.get("coin"))
                .and_then(|c| c.as_str())
                .map(|s| s.to_string());
            let collides = stream1_coin
                .as_deref()
                .map(|c| {
                    c.eq_ignore_ascii_case(coin.ticker()) || c.eq_ignore_ascii_case(coin.as_str())
                })
                .unwrap_or(false);
            if collides {
                if v.get("external_stream_2").is_some_and(|f| !f.is_null()) {
                    v["external_stream_2"] = serde_json::Value::Null;
                    changed = true;
                }
            } else {
                changed |= self.rewrite_ext_field(&mut v, "external_stream_2", coin);
            }
        }
        if !changed {
            return line.to_string();
        }
        serde_json::to_string(&v).unwrap_or_else(|_| line.to_string())
    }

    /// Swap the `field` external-stream object for the session's `coin`.
    /// Writes `null` when the preferred coin has no fresh job — a
    /// wrong-algorithm job would only produce error spam on a miner that
    /// cannot run it.
    fn rewrite_ext_field(
        &self,
        v: &mut serde_json::Value,
        field: &str,
        coin: ExternalCoin,
    ) -> bool {
        let embedded_matches = v
            .get(field)
            .and_then(|f| f.get("coin"))
            .and_then(|c| c.as_str())
            .map(|c| c.eq_ignore_ascii_case(coin.ticker()) || c.eq_ignore_ascii_case(coin.as_str()))
            .unwrap_or(false);
        if embedded_matches {
            return false;
        }
        let new_val = if coin == ExternalCoin::Pearl {
            self.pearl
                .as_ref()
                .and_then(|p| p.pick_served_job())
                .and_then(|job| serde_json::to_value(job).ok())
        } else {
            let fresh = self
                .multi_bridge
                .latest_job_for_coin(&coin)
                .filter(Self::job_is_fresh);
            fresh
                .as_ref()
                .and_then(|job| serde_json::to_value(Self::job_to_ext_stream(&coin, job)).ok())
        };
        match new_val {
            Some(val) => {
                v[field] = val;
                true
            }
            None => match v.get(field) {
                Some(existing) if !existing.is_null() => {
                    v[field] = serde_json::Value::Null;
                    true
                }
                _ => false,
            },
        }
    }

    /// Resolve a session's preferred coin against `routes` — first matching
    /// pattern wins. Patterns are tested against the worker tail
    /// ("wallet.worker" → "worker"), the full worker_name, the miner_id and
    /// the "miner_id/worker_name" composite.
    fn session_coin_pref(
        routes: &[(String, ExternalCoin)],
        miner_id: &str,
        worker_name: &str,
    ) -> Option<ExternalCoin> {
        if routes.is_empty() {
            return None;
        }
        let short = worker_name.rsplit('.').next().unwrap_or(worker_name);
        let composite = format!("{miner_id}/{worker_name}");
        for (pat, coin) in routes {
            if glob_match(pat, short)
                || glob_match(pat, worker_name)
                || glob_match(pat, miner_id)
                || glob_match(pat, &composite)
            {
                return Some(*coin);
            }
        }
        None
    }

    /// Fold a miner's CoinPreference into the session prefs. Fields are
    /// slotted by coin class rather than by field name — a miner sending
    /// `gpu_coin=VRSC` still lands on the CPU stream where it belongs.
    fn apply_coin_preference(
        gpu_pref: &mut Option<ExternalCoin>,
        cpu_pref: &mut Option<ExternalCoin>,
        gpu2_pref: &mut Option<ExternalCoin>,
        gpu_coin: &str,
        cpu_coin: &str,
        gpu_coin_2: &str,
    ) {
        for (raw, is_gpu2) in [(gpu_coin, false), (cpu_coin, false), (gpu_coin_2, true)] {
            let raw = raw.trim();
            if raw.is_empty() {
                continue;
            }
            let Some(coin) =
                ExternalCoin::from_str_loose(raw).or_else(|| ExternalCoin::from_ticker(raw))
            else {
                tracing::warn!("v3_coin_preference: unknown coin {:?}", raw);
                continue;
            };
            if coin.is_cpu() {
                *cpu_pref = Some(coin);
            } else if is_gpu2 {
                *gpu2_pref = Some(coin);
            } else {
                *gpu_pref = Some(coin);
            }
        }
    }

    /// Build a fingerprint from the current template and external streams.
    fn build_job_fingerprint(&self, template_json: &str) -> Option<JobFingerprint> {
        let template: Value = serde_json::from_str(template_json).ok()?;
        let height = template.get("height").and_then(Value::as_u64).unwrap_or(0);
        let previous_hash = template
            .get("previous_hash")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        // merkle_root lives inside header_json (a JSON string) on V31 nodes.
        let mut merkle_root = Vec::new();
        if let Some(header_json_str) = template.get("header_json").and_then(Value::as_str) {
            if let Ok(header_json) = serde_json::from_str::<Value>(header_json_str) {
                if let Some(merkle) = header_json.get("merkle_root") {
                    if let Some(arr) = merkle.as_array() {
                        merkle_root = arr
                            .iter()
                            .filter_map(|v| v.as_u64().map(|n| n as u8))
                            .collect();
                    } else if let Some(s) = merkle.as_str() {
                        merkle_root = hex::decode(s).unwrap_or_default();
                    }
                }
            }
        }

        let (gpu_external_job_id, gpu_external_ntime, gpu_external_target) = self
            .build_external_stream_gpu(None)
            .map(|j| (Some(j.job_id), Some(j.ntime_hex), Some(j.target_hex)))
            .unwrap_or((None, None, None));
        let (cpu_external_job_id, cpu_external_ntime, cpu_external_target) = self
            .build_external_stream_cpu(None)
            .map(|j| (Some(j.job_id), Some(j.ntime_hex), Some(j.target_hex)))
            .unwrap_or((None, None, None));
        let external_job_ids = self.all_external_job_ids();

        Some(JobFingerprint {
            zion_height: height,
            zion_previous_hash: previous_hash,
            zion_merkle_root: merkle_root,
            gpu_external_job_id,
            gpu_external_ntime,
            gpu_external_target,
            cpu_external_job_id,
            cpu_external_ntime,
            cpu_external_target,
            external_job_ids,
        })
    }

    /// Latest external job id for every enabled coin ("TICKER:jobid"),
    /// sorted by ticker — part of the broadcast fingerprint so a job
    /// rotation on ANY coin (not just the embedded default) refreshes
    /// sessions pinned to a different coin via route/CoinPreference.
    fn all_external_job_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self
            .multi_bridge
            .enabled_coins()
            .into_iter()
            .filter_map(|c| {
                self.multi_bridge
                    .latest_job_for_coin(&c)
                    .map(|j| format!("{}:{}", c.ticker(), j.external_job_id))
            })
            .collect();
        // Pearl jobs come from the pearl-gateway poller, not multi_bridge —
        // without this a PRL template rotation would never trigger a
        // broadcast and miners would hash a stale seed until the next ZION
        // or aux-coin change.
        if let Some(pearl) = &self.pearl {
            if let Some(job) = pearl.pick_served_job() {
                ids.push(format!(
                    "{}{}",
                    coin_leg::PRL_FINGERPRINT_PREFIX,
                    job.job_id
                ));
            }
        }
        ids
    }

    /// Live snapshot of every coin leg — delegates to
    /// [`Pool::leg_statuses_detached`] so per-leg mutexes are never taken
    /// while the shared pool mutex is held.
    pub fn leg_statuses(&self) -> Vec<coin_leg::LegStatus> {
        let (l1_cfg, pearl) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            pool.leg_inputs()
        };
        Pool::leg_statuses_detached(l1_cfg, pearl.as_ref(), &self.multi_bridge)
    }

    /// Return true if an external job is fresh enough to send to a miner.
    /// Thresholds match the previous V3 stale-share tunings.
    fn job_is_fresh(job: &crate::auxpow_bridge::JobPackage) -> bool {
        let max_age_secs: u64 = match job.coin {
            ExternalCoin::Zano => 28,
            ExternalCoin::Verus => 50,
            _ => 120,
        };
        job.received_at
            .is_none_or(|t| t.elapsed().as_secs() <= max_age_secs)
    }

    /// Latest QTU job for the Quantus stratum — native leg first (it only
    /// returns jobs marked `serve_native` by the share-pct selector at push
    /// time), then the upstream Quantus bridge queue.
    fn qtu_current_job(&self) -> Option<crate::auxpow_bridge::JobPackage> {
        let job = self.multi_bridge.native_pick_job().or_else(|| {
            self.multi_bridge
                .latest_job_for_coin(&ExternalCoin::Quantus)
        })?;
        Self::job_is_fresh(&job).then_some(job)
    }

    /// Extranonce to advertise for a QTU job — for upstream jobs the
    /// pool's upstream extranonce EXTENDED by the per-session tag so each
    /// downstream session mines a disjoint nonce subspace (all sessions
    /// otherwise share one upstream extranonce and collide on identical
    /// shares → upstream "duplicate share" rejects). Native jobs carry
    /// their own random per-job prefix; the bare session tag is the
    /// fallback when a job has none.
    fn qtu_job_en1<'a>(
        pkg: &'a crate::auxpow_bridge::JobPackage,
        session: &'a str,
    ) -> std::borrow::Cow<'a, str> {
        if pkg.extranonce1_hex.is_empty() {
            std::borrow::Cow::Borrowed(session)
        } else {
            std::borrow::Cow::Owned(format!("{}{}", pkg.extranonce1_hex, session))
        }
    }

    async fn qtu_send<W: tokio::io::AsyncWrite + Unpin>(
        writer: &Arc<tokio::sync::Mutex<W>>,
        line: &str,
    ) -> std::io::Result<()> {
        let mut w = writer.lock().await;
        w.write_all(line.as_bytes()).await?;
        w.write_all(b"\n").await?;
        w.flush().await
    }

    /// Quantus stratum session — miningcore/XMRig-style `login`/`job`/
    /// `submit` dialect for external QPoW miners (SRBMiner-MULTI
    /// `--algorithm quantus`). See `stratum_qtu.rs` for the wire spec.
    ///
    /// Jobs come from the same sources as the V3 `external_stream` QTU leg
    /// (native quantus-node via `native_pick_job`, else the upstream bridge)
    /// and shares flow through `forward_by_ticker("QTU", ..)` — identical
    /// validation, upstream forwarding and PPLNS accounting.
    async fn handle_qtu_session<R, W>(
        &self,
        first_line: String,
        lines: &mut tokio::io::Lines<BufReader<R>>,
        writer: &Arc<tokio::sync::Mutex<W>>,
        ip: IpAddr,
    ) where
        R: tokio::io::AsyncRead + Unpin,
        W: tokio::io::AsyncWrite + Unpin,
    {
        let Some((rpc_id, login)) = stratum_qtu::parse_login(&first_line) else {
            tracing::debug!("qtu_stratum: {} malformed first line — closing", ip);
            return;
        };
        // F2d: `pass` may carry `zis_<token>` — required mode rejects the
        // session before login_ok; optional binds the identity + linked
        // Quantus payout address.
        let mut zis_user = String::new();
        match self
            .zis_password_auth(&login.pass, "qtu", &login.wallet, ip)
            .await
        {
            ZisPasswordOutcome::Reject => {
                let _ =
                    Self::qtu_send(writer, &stratum_qtu::rpc_error(&rpc_id, "unauthorized")).await;
                return;
            }
            ZisPasswordOutcome::Allow(idn) => {
                if let Some(idn) = idn {
                    zis_user = idn.sub.clone();
                    self.record_zis_binding(&login.wallet, &idn.sub);
                    self.zis_register_linked_payout(&idn, "quantus", &login.wallet);
                }
            }
        }
        // F4: reject garbage wallet identities — an unparsable wallet would
        // silently mine toward the pool's own payout address.
        if zis_user.is_empty() && !self.pool.lock().unwrap().wallet_is_valid(&login.wallet) {
            let _ =
                Self::qtu_send(writer, &stratum_qtu::rpc_error(&rpc_id, "invalid wallet")).await;
            return;
        }
        // Session id: unique-ish hex (upstream uses UUIDs; any opaque string
        // is valid — miners echo it in submit `id`).
        let session_id = format!(
            "qtu-{:016x}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos() as u64)
                .unwrap_or_default()
                ^ (std::process::id() as u64) << 32
        );
        // Session-scoped extranonce prefix (4B) — same model as upstream.
        // IMPORTANT: use *low* LE bytes of nanos (change every ns). The old
        // BE high-4-byte form was constant for ~4.3s, so two SRB logins in
        // the same window (dual-GPU workers) shared one EN1 → overlapping
        // nonce space → local_dedup rejects (~25–30%).
        let extranonce = {
            static EN1_SEQ: std::sync::atomic::AtomicU64 =
                std::sync::atomic::AtomicU64::new(1);
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos() as u64)
                .unwrap_or_default();
            let seq = EN1_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let mixed = nanos
                .wrapping_mul(0x9E37_79B9_7F4A_7C15)
                .wrapping_add((std::process::id() as u64).rotate_left(17))
                .wrapping_add(seq.wrapping_mul(0xC2B2_AE3D_27D4_EB4F));
            // 4-byte EN1 (8 hex chars) — keep wire size matching upstream.
            hex::encode(&mixed.to_le_bytes()[..4])
        };

        let mut seq: u64 = 0;
        let mut last_job_id = String::new();
        let initial = self.qtu_current_job();
        if let Some(pkg) = &initial {
            seq += 1;
            last_job_id = pkg.external_job_id.clone();
        }
        let resp = stratum_qtu::login_ok(
            &rpc_id,
            &session_id,
            initial
                .as_ref()
                .map(|p| stratum_qtu::job_wire(p, Self::qtu_job_en1(p, &extranonce).as_ref(), seq)),
        );
        if Self::qtu_send(writer, &resp).await.is_err() {
            return;
        }
        tracing::info!(
            "qtu_stratum: {} login wallet={} worker={} agent={} zis={} initial_job={}",
            ip,
            login.wallet,
            login.worker,
            login.agent,
            if zis_user.is_empty() { "-" } else { &zis_user },
            if last_job_id.is_empty() {
                "(none)"
            } else {
                &last_job_id
            }
        );
        self.telemetry.lock().unwrap().touch_session(
            &login.wallet,
            &login.login,
            "qpow",
            &login.agent,
            &zis_user,
        );

        // Poll for job rotation — QTU jobs arrive on the quantus-node/bridge
        // cadence, decoupled from ZION template broadcasts.
        let mut poll = tokio::time::interval(Duration::from_millis(1500));
        poll.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                line = lines.next_line() => match line {
                    Ok(Some(l)) => {
                        let Ok(v) = serde_json::from_str::<Value>(l.trim()) else {
                            continue;
                        };
                        let id = v.get("id").cloned().unwrap_or(Value::Null);
                        match v.get("method").and_then(|m| m.as_str()) {
                            Some("submit") => {
                                let p = v.get("params").cloned().unwrap_or_else(|| json!({}));
                                let outcome = self
                                    .qtu_handle_submit(&p, &login, ip)
                                    .await;
                                match outcome {
                                    Ok(status) => {
                                        if Self::qtu_send(writer, &stratum_qtu::submit_ok(&id)).await.is_err() { break; }
                                        tracing::debug!("qtu_stratum: {} share ok ({})", ip, status);
                                    }
                                    Err(reason) => {
                                        if Self::qtu_send(writer, &stratum_qtu::submit_err(&id, &reason)).await.is_err() { break; }
                                        // Resync only when the served job actually
                                        // rotated — a stale submit means the miner
                                        // missed the new job. Re-pushing the SAME
                                        // job after e.g. a duplicate reject just
                                        // provokes an immediate resubmit.
                                        if let Some(pkg) = self.qtu_current_job() {
                                            if pkg.external_job_id != last_job_id {
                                                seq += 1;
                                                last_job_id = pkg.external_job_id.clone();
                                                let n = stratum_qtu::job_notify(
                                                    stratum_qtu::job_wire(&pkg, Self::qtu_job_en1(&pkg, &extranonce).as_ref(), seq),
                                                );
                                                if Self::qtu_send(writer, &n).await.is_err() { break; }
                                            }
                                        }
                                    }
                                }
                            }
                            Some("keepalive") => {
                                if Self::qtu_send(writer, &stratum_qtu::keepalive_ok(&id)).await.is_err() { break; }
                            }
                            Some(_) => {
                                if Self::qtu_send(writer, &stratum_qtu::rpc_error(&id, "method not found")).await.is_err() { break; }
                            }
                            None => {}
                        }
                    }
                    _ => break,
                },
                _ = poll.tick() => {
                    if let Some(pkg) = self.qtu_current_job() {
                        if pkg.external_job_id != last_job_id {
                            seq += 1;
                            last_job_id = pkg.external_job_id.clone();
                            let n = stratum_qtu::job_notify(
                                stratum_qtu::job_wire(&pkg, Self::qtu_job_en1(&pkg, &extranonce).as_ref(), seq),
                            );
                            if Self::qtu_send(writer, &n).await.is_err() { break; }
                            tracing::debug!("qtu_stratum: {} job push {}", ip, last_job_id);
                        }
                    }
                },
            }
        }
        tracing::info!(
            "qtu_stratum: {} session closed (worker={})",
            ip,
            login.login
        );
    }

    /// Validate + forward one QPoW share and record accounting — mirrors
    /// the V3 `ExternalSubmit` path (`forward_by_ticker` handles the
    /// native-vs-upstream routing by job id).
    ///
    /// Returns `Ok(status)` for accepted work, `Err(reason)` for rejects.
    async fn qtu_handle_submit(
        &self,
        params: &Value,
        login: &stratum_qtu::QtuLogin,
        ip: IpAddr,
    ) -> Result<&'static str, String> {
        let job_id = params
            .get("job_id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let nonce_hex = params
            .get("nonce")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let result_hex = params
            .get("result")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        if job_id.is_empty() || nonce_hex.is_empty() {
            return Err("missing job_id/nonce".to_string());
        }

        // Look up the exact job the miner claims to have solved — same
        // discipline as the V3 path (native first by id, then upstream).
        let pkg_opt = if coin_leg::route_job_id(&job_id) == JobRoute::QtcNative {
            self.multi_bridge.native_job_by_id(&job_id)
        } else {
            self.multi_bridge
                .job_for_coin_and_id(&ExternalCoin::Quantus, &job_id)
                .or_else(|| self.multi_bridge.native_job_by_id(&job_id))
        };
        let Some(pkg) = pkg_opt else {
            tracing::info!(
                "qtu_stratum: {} stale submit worker={} job={} reason=unknown_or_stale_job",
                ip,
                login.login,
                job_id
            );
            {
                let mut t = self.telemetry.lock().unwrap();
                t.record_external_share(&login.wallet, &login.login, "QTU", false, 0.0);
                t.record_reject_reason(&login.wallet, &login.login, "qtu", "stale");
            }
            return Err("stale".to_string());
        };

        // Legacy u64 view of the 64-byte nonce (low bits) — full precision
        // travels in `nonce_hex` which both validators consume.
        let nonce_u64 = nonce_hex
            .get(nonce_hex.len().saturating_sub(16)..)
            .and_then(|s| u64::from_str_radix(s, 16).ok())
            .unwrap_or(0);
        // Reserve the dedup slot BEFORE forwarding — repeated submits of
        // the same share (miner retries, concurrent sessions mining the
        // same nonce space) must never round-trip upstream; they fail
        // locally as "duplicate" without a second upstream submit.
        let dedup_tag = format!("{nonce_hex}:{result_hex}");
        {
            let claimed = self
                .pool
                .lock()
                .unwrap()
                .reserve_external_share("qtu", &job_id, &dedup_tag);
            if !claimed {
                // Local dedup reject — must count in /miners + reject_reasons.
                // Previously this returned silently: SRB showed ~30% duplicate
                // while pool gauges stayed at invalid=0 (dest-zion 2026-10-29).
                tracing::info!(
                    "qtu_stratum: {} share worker={} job={} status=duplicate (local_dedup)",
                    ip,
                    login.login,
                    job_id
                );
                {
                    let mut t = self.telemetry.lock().unwrap();
                    t.record_external_share(&login.wallet, &login.login, "QTU", false, 0.0);
                    t.record_reject_reason(&login.wallet, &login.login, "qtu", "duplicate");
                }
                let rev_source =
                    zion_cosmic_harmony::revenue::RevenueSource::from_str_ci("qpow-poseidon2")
                        .unwrap_or(zion_cosmic_harmony::revenue::RevenueSource::Zion);
                let group = resolve_session_group(&login.wallet, &login.login);
                self.routing_stats
                    .lock()
                    .unwrap()
                    .record(group, rev_source, false);
                return Err("duplicate".to_string());
            }
        }
        let req = ShareForwardRequest {
            job_id: pkg.external_job_id.clone(),
            nonce: nonce_u64,
            nonce_hex: Some(nonce_hex.clone()),
            hash_hex: result_hex.clone(),
            mix_hash_hex: None,
            algorithm: "qpow-poseidon2".to_string(),
            header_bytes: Vec::new(),
            ntime: pkg.ntime.clone(),
            solution_hex: String::new(),
            extranonce1_hex: pkg.extranonce1_hex.clone(),
        };
        let bridge = self.multi_bridge.clone();
        let bridge_result =
            tokio::task::spawn_blocking(move || bridge.forward_by_ticker("QTU", req))
                .await
                .unwrap_or(None);

        let (accepted, status) = match bridge_result {
            Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                crate::share_forwarder::ShareForwardResult::Accepted,
            )) => (true, "accepted".to_string()),
            Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                crate::share_forwarder::ShareForwardResult::Unknown,
            )) => (true, "accepted_unknown".to_string()),
            Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                crate::share_forwarder::ShareForwardResult::BelowTarget,
            )) => (false, "below_target".to_string()),
            Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                crate::share_forwarder::ShareForwardResult::Rejected(reason),
            )) => (false, format!("rejected:{reason}")),
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

        tracing::info!(
            "qtu_stratum: {} share worker={} job={} status={}",
            ip,
            login.login,
            job_id,
            status
        );

        if accepted {
            // Same accounting as the V3 external-submit path: PPLNS credit
            // at the QTU weight, coin-scoped telemetry, routing stats. The
            // dedup slot was already reserved before forwarding — credit
            // unconditionally.
            let h = self.current_height.load(Ordering::Relaxed);
            let w = if is_unverified_credit(&status) {
                auxpow_share_weight("QTU") * unverified_credit_weight_pct() / 100
            } else {
                auxpow_share_weight("QTU")
            };
            self.pool
                .lock()
                .unwrap()
                .credit_reserved_external_share(&login.login, h, w, "qtu");
        }
        {
            let mut t = self.telemetry.lock().unwrap();
            t.record_external_share(
                &login.wallet,
                &login.login,
                "QTU",
                accepted,
                crate::telemetry::expected_hashes_for_target_hex(&pkg.target_hex),
            );
            if is_unverified_credit(&status) {
                t.record_unverified_credit(&login.wallet, &login.login, "qtu");
            }
            if !accepted {
                t.record_reject_reason(&login.wallet, &login.login, "qtu", &status);
            }
        }
        let rev_source = zion_cosmic_harmony::revenue::RevenueSource::from_str_ci("qpow-poseidon2")
            .unwrap_or(zion_cosmic_harmony::revenue::RevenueSource::Zion);
        let group = resolve_session_group(&login.wallet, &login.login);
        self.routing_stats
            .lock()
            .unwrap()
            .record(group, rev_source, accepted);

        if accepted {
            Ok(if status == "accepted_unknown" {
                "accepted_unknown"
            } else {
                "accepted"
            })
        } else {
            Err(status)
        }
    }

    async fn process_pearl_submission(
        &self,
        miner_id: &str,
        worker_name: &str,
        external_job_id: &str,
        proof_b64: &str,
        hs: Option<u64>,
    ) -> (bool, String) {
        let Some(pearl) = &self.pearl else {
            let mut t = self.telemetry.lock().unwrap();
            t.record_external_share(miner_id, worker_name, "PRL", false, 0.0);
            t.record_reject_reason(miner_id, worker_name, "prl", "external_not_enabled");
            return (false, "pearl_not_enabled".to_string());
        };
        fn map_upstream_reply(reply: crate::pearl_upstream::UpstreamSubmitReply) -> (bool, String) {
            match reply {
                crate::pearl_upstream::UpstreamSubmitReply::Accepted => {
                    (true, "accepted".to_string())
                }
                crate::pearl_upstream::UpstreamSubmitReply::Rejected(m) => {
                    (false, format!("rejected:{m}"))
                }
                crate::pearl_upstream::UpstreamSubmitReply::Unknown => {
                    (true, "accepted_unknown".to_string())
                }
                crate::pearl_upstream::UpstreamSubmitReply::Busy => (false, "busy".to_string()),
                crate::pearl_upstream::UpstreamSubmitReply::StaleForward => {
                    // Locally valid share on a retired upstream job —
                    // credited, but never sent upstream.
                    (true, "accepted_stale_upstream".to_string())
                }
            }
        }
        // Expected work per accepted share — resolved job target drives
        // the per-coin hashrate estimator (upstream = served target_be,
        // native = eased share target).
        let mut share_eh = 0f64;
        let (mut accepted, mut status) = if coin_leg::route_job_id(external_job_id)
            == JobRoute::PearlUpstream
        {
            match pearl
                .verify_upstream_submission(external_job_id, proof_b64)
                .await
            {
                Ok((ujob, _outcome)) => {
                    share_eh = crate::telemetry::expected_hashes_for_target(&ujob.target_be);
                    map_upstream_reply(pearl.upstream_submit(&ujob, proof_b64, hs).await)
                }
                // Proof in a serialization we cannot decode (e.g. SRBMiner):
                // forward it opaque — the upstream pool is authoritative.
                // `share_eh` must still be charged from the resolved job
                // target, otherwise PRL hashrate reads 0 on every stat.
                Err(crate::pearl_gateway::PearlSubmitError::Invalid(_)) => {
                    match pearl
                        .submit_upstream_opaque(external_job_id, proof_b64, hs)
                        .await
                    {
                        Ok((ujob, reply)) => {
                            share_eh =
                                crate::telemetry::expected_hashes_for_target(&ujob.target_be);
                            map_upstream_reply(reply)
                        }
                        Err(e) => (false, e.status()),
                    }
                }
                Err(e) => (false, e.status()),
            }
        } else {
            match pearl.verify_submission(external_job_id, proof_b64).await {
                Ok((job, outcome)) => {
                    share_eh =
                        crate::telemetry::expected_hashes_for_u256(&pearl.share_target(&job));
                    if outcome.is_block {
                        tracing::info!(
                            "pearl_block_candidate miner={} job={} jackpot={} forwarding",
                            miner_id,
                            external_job_id,
                            hex::encode(outcome.jackpot_hash)
                        );
                        let pearl = pearl.clone();
                        let proof_b64 = proof_b64.to_string();
                        tokio::spawn(async move {
                            if let Err(e) = pearl.submit_proof(&proof_b64, &job).await {
                                tracing::warn!("pearl_gateway submit_plain_proof failed: {e:#}");
                            }
                        });
                    }
                    (true, "accepted".to_string())
                }
                Err(e) => (false, e.status()),
            }
        };

        tracing::info!(
            "pearl_submit miner={} worker={} job={} accepted={} status={}",
            miner_id,
            worker_name,
            external_job_id,
            accepted,
            status
        );
        if accepted {
            let h = self.current_height.load(Ordering::Relaxed);
            let w = if is_unverified_credit(&status) {
                auxpow_share_weight("PRL") * unverified_credit_weight_pct() / 100
            } else {
                auxpow_share_weight("PRL")
            };
            let credited = self.pool.lock().unwrap().record_external_share(
                miner_id,
                worker_name,
                h,
                w,
                "prl",
                external_job_id,
                proof_b64,
            );
            if !credited {
                // Fall through to telemetry as a duplicate reject — early
                // return used to hide these from /miners reject_reasons.
                accepted = false;
                status = "duplicate".to_string();
            }
        }
        {
            let mut t = self.telemetry.lock().unwrap();
            t.record_external_share(miner_id, worker_name, "PRL", accepted, share_eh);
            if is_unverified_credit(&status) {
                t.record_unverified_credit(miner_id, worker_name, "prl");
            }
            if !accepted {
                t.record_reject_reason(miner_id, worker_name, "prl", &status);
            }
        }
        let group = resolve_session_group(miner_id, worker_name);
        self.routing_stats.lock().unwrap().record(
            group,
            zion_cosmic_harmony::revenue::RevenueSource::PearlExternal,
            accepted,
        );
        (accepted, status)
    }

    async fn pearl_send<W>(writer: &Arc<tokio::sync::Mutex<W>>, line: &str) -> std::io::Result<()>
    where
        W: tokio::io::AsyncWrite + Unpin,
    {
        // Pearl frame builders already terminate with '\n'; trim so the
        // wire carries exactly one newline — SRBMiner's line parser rejects
        // the blank line a double '\n' produces (Exception[15] on connect).
        tokio::time::timeout(
            Duration::from_secs(10),
            Self::qtu_send(writer, line.trim_end()),
        )
        .await
        .map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::TimedOut, "pearl stratum write timeout")
        })?
    }

    async fn handle_pearl_session<R, W>(
        &self,
        first_line: String,
        lines: &mut tokio::io::Lines<BufReader<R>>,
        writer: &Arc<tokio::sync::Mutex<W>>,
        ip: IpAddr,
    ) where
        R: tokio::io::AsyncRead + Unpin,
        W: tokio::io::AsyncWrite + Unpin,
    {
        let Some((rpc_id, auth)) = stratum_pearl::parse_authorize(&first_line) else {
            tracing::debug!("pearl_stratum: {} malformed first line — closing", ip);
            return;
        };
        let auth = match auth {
            Ok(a) => a,
            Err(reason) => {
                let _ = Self::pearl_send(writer, &stratum_pearl::auth_err(&rpc_id, &reason)).await;
                tracing::debug!("pearl_stratum: {} authorize rejected: {}", ip, reason);
                return;
            }
        };
        if self.pearl.is_none() {
            let _ = Self::pearl_send(
                writer,
                &stratum_pearl::auth_err(&rpc_id, "pearl_not_enabled"),
            )
            .await;
            return;
        }
        // F2d: `pass` may carry `zis_<token>` — required mode rejects the
        // session before auth_ok; optional binds the identity + linked
        // Pearl payout address.
        let mut zis_user = String::new();
        match self
            .zis_password_auth(&auth.pass, "prl", &auth.wallet, ip)
            .await
        {
            ZisPasswordOutcome::Reject => {
                let _ = Self::pearl_send(writer, &stratum_pearl::auth_err(&rpc_id, "unauthorized"))
                    .await;
                return;
            }
            ZisPasswordOutcome::Allow(idn) => {
                if let Some(idn) = idn {
                    zis_user = idn.sub.clone();
                    self.record_zis_binding(&auth.wallet, &idn.sub);
                    self.zis_register_linked_payout(&idn, "pearl", &auth.wallet);
                }
            }
        }
        // F4: reject garbage wallet identities — same rule as QTU login.
        if zis_user.is_empty() && !self.pool.lock().unwrap().wallet_is_valid(&auth.wallet) {
            let _ =
                Self::pearl_send(writer, &stratum_pearl::auth_err(&rpc_id, "invalid wallet")).await;
            return;
        }
        if Self::pearl_send(writer, &stratum_pearl::auth_ok(&rpc_id))
            .await
            .is_err()
        {
            return;
        }
        let miner_id = auth.wallet.clone();
        let worker_name = stratum_pearl::worker_name(&auth);
        self.pool.lock().unwrap().register_worker(&worker_name);
        self.telemetry.lock().unwrap().touch_session(
            &miner_id,
            &worker_name,
            "pearlhash",
            "pearl-stratum",
            &zis_user,
        );
        tracing::info!(
            "pearl_stratum: {} authorize wallet={} worker={} agent={}",
            ip,
            auth.wallet,
            auth.worker,
            auth.agent
        );

        let current_params = || {
            self.pearl
                .as_ref()
                .and_then(|p| p.pick_served_upstream_job())
                .map(|j| stratum_pearl::notify_params(&j))
        };
        let mut last_params = current_params();
        if let Some(p) = &last_params {
            if Self::pearl_send(writer, &stratum_pearl::notify_frame(p))
                .await
                .is_err()
            {
                return;
            }
        }

        let mut poll = tokio::time::interval(Duration::from_millis(250));
        poll.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut pending: Vec<u8> = Vec::new();

        loop {
            tokio::select! {
                frame = stratum_pearl::read_frame(lines.get_mut(), &mut pending) => match frame {
                    Ok(Some(line)) => {
                        let Ok(v) = serde_json::from_str::<Value>(line.trim()) else {
                            continue;
                        };
                        let id = v.get("id").cloned().unwrap_or(Value::Null);
                        match v.get("method").and_then(|m| m.as_str()) {
                            Some("mining.submit") => {
                                match stratum_pearl::parse_submit(&line) {
                                    Some((_, Ok(sub))) => {
                                        let (accepted, status) = self
                                            .process_pearl_submission(
                                                &miner_id,
                                                &worker_name,
                                                &sub.job_id,
                                                &sub.plain_proof,
                                                sub.hs,
                                            )
                                            .await;
                                        let resp = if accepted {
                                            stratum_pearl::submit_ok(&id)
                                        } else {
                                            stratum_pearl::submit_err(&id, &status)
                                        };
                                        if Self::pearl_send(writer, &resp).await.is_err() { break; }
                                        if !accepted && status == "stale" {
                                            if let Some(p) = current_params() {
                                                last_params = Some(p.clone());
                                                if Self::pearl_send(writer, &stratum_pearl::notify_frame(&p)).await.is_err() { break; }
                                            }
                                        }
                                    }
                                    Some((_, Err(reason))) => {
                                        if Self::pearl_send(writer, &stratum_pearl::submit_err(&id, &reason)).await.is_err() { break; }
                                    }
                                    None => {}
                                }
                            }
                            Some("mining.authorize") => {
                                if Self::pearl_send(writer, &stratum_pearl::auth_err(&id, "already authorized")).await.is_err() { break; }
                            }
                            Some(_) => {
                                if Self::pearl_send(writer, &stratum_pearl::method_err(&id)).await.is_err() { break; }
                            }
                            None => {}
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        tracing::debug!("pearl_stratum: {} read closed: {}", ip, e);
                        break;
                    }
                },
                _ = poll.tick() => {
                    let params = current_params();
                    if params.is_some() && params != last_params {
                        last_params = params;
                        if let Some(p) = &last_params {
                            if Self::pearl_send(writer, &stratum_pearl::notify_frame(p)).await.is_err() { break; }
                        }
                    }
                },
            }
        }
        tracing::info!(
            "pearl_stratum: {} session closed (worker={})",
            ip,
            worker_name
        );
    }

    pub async fn run(&self, listener: TcpListener) -> std::io::Result<()> {
        let (_tx, rx) = tokio::sync::watch::channel(false);
        self.run_with_shutdown(listener, rx).await
    }

    /// Accept loop with a graceful-stop channel: when `shutdown` fires the
    /// listener stops accepting new sessions and returns. Existing session
    /// tasks are left running — the caller's drain grace window covers
    /// in-flight submits before the process exits.
    pub async fn run_with_shutdown(
        &self,
        listener: TcpListener,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> std::io::Result<()> {
        if let Some(pearl) = &self.pearl {
            pearl.ensure_started();
        }
        let limiter = IpRateLimiter::new(self.config.reconnect_rate_limit);
        let session_id_counter = Arc::new(AtomicU64::new(1));
        loop {
            let (socket, peer) = tokio::select! {
                res = listener.accept() => res?,
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        tracing::info!("stratum: drain — listener stopped accepting");
                        return Ok(());
                    }
                    continue;
                }
            };

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

            // F4-B: global session cap — refuse before spawning work.
            if self
                .session_counters
                .active_sessions
                .load(Ordering::Relaxed)
                >= self.max_sessions_total as u64
            {
                tracing::warn!("global session cap reached — dropping {}", peer.ip());
                decrement_ip_sessions(&self.ip_sessions, peer.ip());
                drop(socket);
                continue;
            }

            self.session_counters
                .total_connections
                .fetch_add(1, Ordering::Relaxed);
            self.session_counters
                .active_sessions
                .fetch_add(1, Ordering::Relaxed);

            let server = self.clone();
            let ip = peer.ip();
            let counter = Arc::clone(&session_id_counter);
            tokio::spawn(async move {
                let _active_guard =
                    ActiveSessionGuard(server.session_counters.active_sessions.clone());
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

                // Quantus stratum (`login`) must be checked BEFORE the
                // generic `method`-field V1 detection — `is_stratum_v1`
                // matches any JSON-RPC and would swallow `login`.
                if server.qtu_stratum_enabled && is_qtu_stratum(&first_line) {
                    server
                        .handle_qtu_session(first_line, &mut lines, &writer, ip)
                        .await;
                    decrement_ip_sessions(&server.ip_sessions, ip);
                    return;
                }

                if server.pearl_stratum_enabled && is_pearl_stratum(&first_line) {
                    server
                        .handle_pearl_session(first_line, &mut lines, &writer, ip)
                        .await;
                    decrement_ip_sessions(&server.ip_sessions, ip);
                    return;
                }

                let is_v1 = is_stratum_v1(&first_line);

                if is_v1 {
                    // Stratum v1 protocol — handle with per-session state.
                    let session_id = counter.fetch_add(1, Ordering::Relaxed);
                    let mut ctx = StratumV1Ctx::new(session_id, &server.vardiff_config);
                    ctx.peer_ip = Some(ip);

                    if server
                        .flush_stratum_response(&writer, &mut ctx, &first_line, ip)
                        .await
                        .is_err()
                    {
                        decrement_ip_sessions(&server.ip_sessions, ip);
                        return;
                    }

                    loop {
                        tokio::select! {
                            line = lines.next_line() => match line {
                                Ok(Some(line)) => {
                                    if server.flush_stratum_response(&writer, &mut ctx, &line, ip).await.is_err() { break; }
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
                                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                                Err(_) => break,
                            },
                        }
                    }
                } else {
                    // V3 wire protocol
                    server
                        .handle_v3_client(&first_line, &mut lines, &writer, ip)
                        .await;
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
        self.session_counters
            .total_connections
            .fetch_add(1, Ordering::Relaxed);
        self.session_counters
            .active_sessions
            .fetch_add(1, Ordering::Relaxed);
        let _active_guard = ActiveSessionGuard(self.session_counters.active_sessions.clone());
        let (reader, writer) = tokio::io::split(tls_stream);
        let writer = Arc::new(tokio::sync::Mutex::new(writer));
        let reader = BufReader::new(reader);
        let mut lines = reader.lines();

        let first_line = match lines.next_line().await {
            Ok(Some(l)) => l,
            _ => return,
        };

        if self.qtu_stratum_enabled && is_qtu_stratum(&first_line) {
            self.handle_qtu_session(first_line, &mut lines, &writer, ip)
                .await;
            return;
        }

        if self.pearl_stratum_enabled && is_pearl_stratum(&first_line) {
            self.handle_pearl_session(first_line, &mut lines, &writer, ip)
                .await;
            return;
        }

        let is_v1 = is_stratum_v1(&first_line);
        if is_v1 {
            // Stratum v1 over TLS — persistent ctx + ZIS precheck (F2d).
            let mut ctx = StratumV1Ctx::new(0, &self.vardiff_config);
            ctx.peer_ip = Some(ip);
            self.v1_zis_precheck(&mut ctx, &first_line, ip).await;
            let response = self.handle_request_with_ctx(&first_line, &mut ctx);
            {
                let mut w = writer.lock().await;
                if w.write_all(response.as_bytes()).await.is_err() {
                    return;
                }
                if w.write_all(b"\n").await.is_err() {
                    return;
                }
            }
            loop {
                let line = match lines.next_line().await {
                    Ok(Some(l)) => l,
                    _ => break,
                };
                self.v1_zis_precheck(&mut ctx, &line, ip).await;
                let response = self.handle_request_with_ctx(&line, &mut ctx);
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
        writer: &Arc<
            tokio::sync::Mutex<
                tokio::io::WriteHalf<tokio_rustls::server::TlsStream<tokio::net::TcpStream>>,
            >,
        >,
        ip: IpAddr,
    ) where
        R: tokio::io::AsyncRead + Unpin,
    {
        // Per-session coin preferences — set from worker-name routes on
        // Hello and updated by CoinPreference messages.
        let mut session_gpu_pref: Option<ExternalCoin>;
        let mut session_cpu_pref: Option<ExternalCoin>;
        let mut session_gpu2_pref: Option<ExternalCoin>;
        // This session's private 2^32 nonce window — see handle_v3_client.
        let nonce_base = self
            .v3_nonce_alloc
            .fetch_add(0x1_0000_0000, Ordering::Relaxed);
        // Per-session vardiff + share rate limit + Hello-bound identity —
        // same submit contract as the plain-TCP path.
        let mut vardiff = VarDiff::new(&self.vardiff_config);
        let mut share_rate =
            ShareRateLimiter::new(env_or_f64("ZION_POOL_SHARE_RATE_PER_SEC", 10.0).max(1.0));
        let session_miner_id: String;
        let session_worker_name: String;

        // For now, just handle Hello and forward jobs.
        // Full V3 handling over TLS uses the same logic as plain TCP.
        match decode_message(&first_line) {
            Ok(PoolMessage::Hello {
                miner_id,
                worker_name,
                algorithm,
                backend,
                payout_address,
                auth_token,
                ..
            }) => {
                session_miner_id = miner_id.clone();
                session_worker_name = worker_name.clone();
                tracing::info!(
                    "v3_tls_hello miner={} worker={} algo={} ip={}",
                    miner_id,
                    worker_name,
                    algorithm,
                    ip
                );

                // Same ZIS auth contract as the plain-TCP path (phase C):
                // required mode must not be bypassable over TLS.
                let mut zis_user = String::new();
                if let Some(verifier) = &self.zis {
                    let identity = if auth_token.is_empty() {
                        None
                    } else {
                        verifier.verify(&auth_token).await
                    };
                    match identity {
                        Some(idn) if !verifier.is_banned(&idn.sub) => {
                            zis_user = idn.sub.clone();
                            self.record_zis_binding(&miner_id, &idn.sub);
                            tracing::info!(
                                "v3_zis_auth miner={} worker={} sub={} (tls)",
                                miner_id,
                                worker_name,
                                idn.sub
                            );
                            if payout_address.is_empty() {
                                if let Some(zaddr) = &idn.zion_address {
                                    if let Some((chain, addr)) = self
                                        .pool
                                        .lock()
                                        .unwrap()
                                        .register_payout_address(&miner_id, zaddr)
                                    {
                                        tracing::info!(
                                            "v3_payout miner={} chain={} addr={} (zis-linked)",
                                            miner_id,
                                            chain,
                                            addr
                                        );
                                    }
                                }
                            }
                        }
                        _ => {
                            if self.zis_required {
                                tracing::warn!(
                                    "v3_zis_reject miner={} ip={} reason={} (tls)",
                                    miner_id,
                                    ip,
                                    if auth_token.is_empty() {
                                        "no_token"
                                    } else {
                                        "invalid_or_banned"
                                    }
                                );
                                return;
                            }
                        }
                    }
                }

                session_gpu_pref =
                    Self::session_coin_pref(&self.gpu_coin_routes, &miner_id, &worker_name);
                session_cpu_pref =
                    Self::session_coin_pref(&self.cpu_coin_routes, &miner_id, &worker_name);
                session_gpu2_pref =
                    Self::session_coin_pref(&self.gpu2_coin_routes, &miner_id, &worker_name);
                if session_gpu_pref.is_some()
                    || session_cpu_pref.is_some()
                    || session_gpu2_pref.is_some()
                {
                    tracing::info!(
                        "v3_coin_route miner={} worker={} gpu={:?} cpu={:?} gpu2={:?}",
                        miner_id,
                        worker_name,
                        session_gpu_pref.map(|c| c.ticker()),
                        session_cpu_pref.map(|c| c.ticker()),
                        session_gpu2_pref.map(|c| c.ticker()),
                    );
                }

                let welcome = PoolMessage::Welcome {
                    protocol_version: PROTOCOL_VERSION.to_string(),
                    algorithm: algorithm.clone(),
                    job_ttl_ms: 60_000,
                    zis_user: zis_user.clone(),
                };
                if write_v3_message(writer, &welcome).await.is_err() {
                    return;
                }

                let diff = vardiff.current();
                let target = vardiff.share_target();
                let set_diff = PoolMessage::SetDifficulty {
                    difficulty: diff,
                    target_hex: hex::encode(target),
                };
                if write_v3_message(writer, &set_diff).await.is_err() {
                    return;
                }

                // Push the most recent V3 Job immediately so the miner can start
                // even when the template fingerprint has not changed since the last broadcast.
                let last_job = self.last_v3_job.lock().unwrap().clone();
                if let Some(job) = last_job {
                    let job = self.session_job_line(
                        &job,
                        session_gpu_pref,
                        session_cpu_pref,
                        session_gpu2_pref,
                        nonce_base,
                    );
                    let mut w = writer.lock().await;
                    if w.write_all(job.as_bytes()).await.is_err() {
                        return;
                    }
                    if w.write_all(b"\n").await.is_err() {
                        return;
                    }
                    if w.flush().await.is_err() {
                        return;
                    }
                }

                self.telemetry.lock().unwrap().touch_session(
                    &miner_id,
                    &worker_name,
                    &algorithm,
                    &backend,
                    &zis_user,
                );
            }
            _ => return,
        }

        let mut notify_rx = self.notify_tx.subscribe();
        // POL-006 fix: track consecutive NoSolution for TLS handler too.
        let mut tls_consecutive_no_solution: u32 = 0;
        loop {
            tokio::select! {
                line = lines.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            match decode_message(&line) {
                                Ok(PoolMessage::Submit { job_id, miner_id: submit_miner, worker_name: submit_worker, nonce, attempted_hashes, elapsed_ms, .. }) => {
                                    // P-01 hardening: per-session share rate limit.
                                    if !share_rate.allow() {
                                        let result_msg = PoolMessage::Result {
                                            accepted: false,
                                            status: "rate_limited".into(),
                                            block_found: false,
                                            block_height: None,
                                        };
                                        let _ = write_v3_message(writer, &result_msg).await;
                                        continue;
                                    }

                                    // P-02: bind submit identity to the Hello session.
                                    if !submit_miner.is_empty() && submit_miner != session_miner_id {
                                        let result_msg = PoolMessage::Result {
                                            accepted: false,
                                            status: "unauthorized_miner".into(),
                                            block_found: false,
                                            block_height: None,
                                        };
                                        let _ = write_v3_message(writer, &result_msg).await;
                                        continue;
                                    }
                                    let submit_worker = if submit_worker.is_empty() {
                                        session_worker_name.clone()
                                    } else if submit_worker != session_worker_name
                                        && !submit_worker.starts_with(&format!("{session_miner_id}."))
                                    {
                                        let result_msg = PoolMessage::Result {
                                            accepted: false,
                                            status: "unauthorized_worker".into(),
                                            block_found: false,
                                            block_height: None,
                                        };
                                        let _ = write_v3_message(writer, &result_msg).await;
                                        continue;
                                    } else {
                                        submit_worker
                                    };
                                    let submit_miner = if submit_miner.is_empty() {
                                        session_miner_id.clone()
                                    } else {
                                        submit_miner
                                    };

                                    let job_key = format!("zion_{}", job_id);
                                    let job_data = self.jobs.lock().unwrap().get(&job_key).cloned();
                                    if let Some((header, job_share_target, block_target, reward, template)) = job_data {
                                        let (height, difficulty) = template.as_ref().map(|t| (t.height, t.difficulty)).unwrap_or((0, 1));
                                        // Validate at the target issued WITH
                                        // the job — session vardiff ratchets
                                        // between issue and submit and was
                                        // rejecting ~50% of honest shares.
                                        let share_target = job_share_target;
                                        let share_diff = crate::telemetry::expected_hashes_for_target(&job_share_target).max(1.0) as u64;
                                        let submission = ShareSubmission {
                                            worker: submit_worker.clone(),
                                            job_id: job_key.clone(),
                                            nonce_hex: format!("{:016x}", nonce),
                                            difficulty: share_diff,
                                            solo: self.solo_mode,
                                        };
                                        let (result, share_hash) = self.submit_share_two_phase(
                                            &submission,
                                            nonce,
                                            &header,
                                            height,
                                            &share_target,
                                            None,
                                        );
                                        let accepted = matches!(result, Ok(true));

                                        // Estimate hashes/elapsed for TLS clients (no per-session vardiff here).
                                        let (attempted_h, elapsed_ms) = self.fallback_work_sample(
                                            &submit_miner,
                                            &submit_worker,
                                            self.vardiff_config.start_difficulty.max(1),
                                            attempted_hashes,
                                            elapsed_ms,
                                        );

                                        // Check if share meets the network block
                                        // target — reuses the hash the submit
                                        // phase already computed unlocked.
                                        let block_found = accepted
                                            && share_hash
                                                .is_some_and(|h| h <= block_target);

                                        if accepted {
                                            self.telemetry.lock().unwrap().record_job_result(
                                                &submit_miner,
                                                &submit_worker,
                                                true,
                                                attempted_h,
                                                elapsed_ms,
                                            );
                                            self.block_tracker.lock().unwrap().record_share();
                                            // Per-session VarDiff retarget —
                                            // push a new target when the
                                            // share rate warrants it.
                                            if let Some(new_diff) = vardiff.record_submit() {
                                                let set_diff = PoolMessage::SetDifficulty {
                                                    difficulty: new_diff,
                                                    target_hex: hex::encode(vardiff.share_target()),
                                                };
                                                let _ = write_v3_message(writer, &set_diff).await;
                                            }
                                        } else {
                                            let reason = match &result {
                                                Err(e) => e.to_string(),
                                                Ok(false) => "low_difficulty".to_string(),
                                                Ok(true) => "rejected".to_string(),
                                            };
                                            let mut t = self.telemetry.lock().unwrap();
                                            t.record_job_result(
                                                &submit_miner,
                                                &submit_worker,
                                                false,
                                                attempted_h,
                                                elapsed_ms,
                                            );
                                            t.record_reject_reason(
                                                &submit_miner,
                                                &submit_worker,
                                                "zion",
                                                &reason,
                                            );
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
                                            status: if accepted {
                                                "accepted".into()
                                            } else if matches!(result, Err(PoolError::DuplicateShare)) {
                                                "duplicate".into()
                                            } else {
                                                "rejected".into()
                                            },
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
                                Ok(PoolMessage::NoSolution { job_id, miner_id: ns_miner, worker_name: ns_worker, attempted_hashes, elapsed_ms, .. }) => {
                                    // POL-006 fix: apply NoSolution ban in TLS handler too.
                                    tls_consecutive_no_solution += 1;
                                    tracing::debug!(
                                        "v3_tls_no_solution job={} miner={} consecutive={}",
                                        job_id, ns_miner, tls_consecutive_no_solution
                                    );
                                    let (attempted_h, elapsed_ms) = self.fallback_work_sample(
                                        &ns_miner,
                                        &ns_worker,
                                        self.vardiff_config.start_difficulty,
                                        attempted_hashes,
                                        elapsed_ms,
                                    );
                                    self.telemetry.lock().unwrap().record_no_solution(
                                        &ns_miner,
                                        &ns_worker,
                                        attempted_h,
                                        elapsed_ms,
                                    );
                                    if tls_consecutive_no_solution >= self.max_consecutive_no_solution {
                                        tracing::warn!(
                                            "v3_tls_no_solution_ban ip={} miner={} consecutive={}",
                                            ip, ns_miner, tls_consecutive_no_solution
                                        );
                                        self.no_solution_bans.lock().unwrap().insert(
                                            ip,
                                            Instant::now() + self.no_solution_ban_duration,
                                        );
                                        return;
                                    }
                                }
                                Ok(PoolMessage::CoinPreference {
                                    gpu_coin, cpu_coin, gpu_coin_2, ..
                                }) => {
                                    Self::apply_coin_preference(
                                        &mut session_gpu_pref,
                                        &mut session_cpu_pref,
                                        &mut session_gpu2_pref,
                                        &gpu_coin,
                                        &cpu_coin,
                                        &gpu_coin_2,
                                    );
                                }
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
                            let line = self.session_job_line(
                                msg.trim_end(),
                                session_gpu_pref,
                                session_cpu_pref,
                                session_gpu2_pref,
                                nonce_base,
                            );
                            let mut w = writer.lock().await;
                            if w.write_all(line.as_bytes()).await.is_err() { break; }
                            if w.write_all(b"\n").await.is_err() { break; }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!("v3 tls session lagged {} broadcasts ip={}, resyncing", n, ip);
                        let resync_job = self.last_v3_job.lock().unwrap().clone();
                        if let Some(job) = resync_job {
                            let job = self.session_job_line(
                                &job,
                                session_gpu_pref,
                                session_cpu_pref,
                                session_gpu2_pref,
                                nonce_base,
                            );
                            let mut w = writer.lock().await;
                            if w.write_all(job.as_bytes()).await.is_err() { break; }
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
        // This session's private 2^32 nonce window — `session_job_line`
        // stamps it into every served Job so concurrent sessions never
        // scan the same space (shared window = guaranteed duplicates).
        let nonce_base = self
            .v3_nonce_alloc
            .fetch_add(0x1_0000_0000, Ordering::Relaxed);
        // Per-session VarDiff
        let mut vardiff = VarDiff::new(&self.vardiff_config);
        // Per-session share rate limit (same contract as the v1 path).
        let mut share_rate =
            ShareRateLimiter::new(env_or_f64("ZION_POOL_SHARE_RATE_PER_SEC", 10.0).max(1.0));
        // Miner identity from Hello
        let miner_id;
        let worker_name;
        let algorithm;
        let backend;
        // Per-session coin preferences — worker-name routes on Hello,
        // updated by CoinPreference messages.
        let mut session_gpu_pref: Option<ExternalCoin>;
        let mut session_cpu_pref: Option<ExternalCoin>;
        let mut session_gpu2_pref: Option<ExternalCoin>;

        // ZIS user bound at Hello ("" = anonymous session).
        let mut zis_user = String::new();

        // Process first line (should be Hello)
        match decode_message(first_line) {
            Ok(PoolMessage::Hello {
                miner_id: mid,
                worker_name: wn,
                algorithm: alg,
                backend: bk,
                payout_address: pa,
                auth_token: at,
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

                // ZIS session auth (multi-algo phase C): verify the API key
                // against the identity service; a valid, unbanned key binds
                // the session to the ZIS user (per-user accounting) and can
                // auto-resolve the linked payout address.  Required mode
                // rejects absent/invalid tokens.
                if let Some(verifier) = &self.zis {
                    let identity = if at.is_empty() {
                        None
                    } else {
                        verifier.verify(&at).await
                    };
                    match identity {
                        Some(idn) if !verifier.is_banned(&idn.sub) => {
                            zis_user = idn.sub.clone();
                            self.record_zis_binding(&miner_id, &idn.sub);
                            tracing::info!(
                                "v3_zis_auth miner={} worker={} sub={}",
                                miner_id,
                                worker_name,
                                idn.sub
                            );
                            if pa.is_empty() {
                                if let Some(zaddr) = &idn.zion_address {
                                    if let Some((chain, addr)) = self
                                        .pool
                                        .lock()
                                        .unwrap()
                                        .register_payout_address(&miner_id, zaddr)
                                    {
                                        tracing::info!(
                                            "v3_payout miner={} chain={} addr={} (zis-linked)",
                                            miner_id,
                                            chain,
                                            addr
                                        );
                                    }
                                }
                            }
                        }
                        _ => {
                            if self.zis_required {
                                tracing::warn!(
                                    "v3_zis_reject miner={} ip={} reason={}",
                                    miner_id,
                                    ip,
                                    if at.is_empty() {
                                        "no_token"
                                    } else {
                                        "invalid_or_banned"
                                    }
                                );
                                return;
                            }
                            if !at.is_empty() {
                                tracing::warn!(
                                    "v3_zis_invalid miner={} — continuing anonymous",
                                    miner_id
                                );
                            }
                        }
                    }
                }

                // Explicit payout address (e.g. `qtc:<ss58>` for Quantus
                // payouts or `zion1…`) — registered once per miner_id.
                if !pa.is_empty() {
                    if let Some((chain, addr)) = self
                        .pool
                        .lock()
                        .unwrap()
                        .register_payout_address(&miner_id, &pa)
                    {
                        tracing::info!(
                            "v3_payout miner={} chain={} addr={}",
                            miner_id,
                            chain,
                            addr
                        );
                    }
                }

                session_gpu_pref =
                    Self::session_coin_pref(&self.gpu_coin_routes, &miner_id, &worker_name);
                session_cpu_pref =
                    Self::session_coin_pref(&self.cpu_coin_routes, &miner_id, &worker_name);
                session_gpu2_pref =
                    Self::session_coin_pref(&self.gpu2_coin_routes, &miner_id, &worker_name);
                if session_gpu_pref.is_some()
                    || session_cpu_pref.is_some()
                    || session_gpu2_pref.is_some()
                {
                    tracing::info!(
                        "v3_coin_route miner={} worker={} gpu={:?} cpu={:?} gpu2={:?}",
                        miner_id,
                        worker_name,
                        session_gpu_pref.map(|c| c.ticker()),
                        session_cpu_pref.map(|c| c.ticker()),
                        session_gpu2_pref.map(|c| c.ticker()),
                    );
                }

                // Send Welcome
                let welcome = PoolMessage::Welcome {
                    protocol_version: PROTOCOL_VERSION.to_string(),
                    algorithm: algorithm.clone(),
                    job_ttl_ms: 60_000,
                    zis_user: zis_user.clone(),
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

                // Push the most recent V3 Job immediately so the miner can start
                // even when the template fingerprint has not changed since the last broadcast.
                let last_job = self.last_v3_job.lock().unwrap().clone();
                if let Some(job) = last_job {
                    let job = self.session_job_line(
                        &job,
                        session_gpu_pref,
                        session_cpu_pref,
                        session_gpu2_pref,
                        nonce_base,
                    );
                    let mut w = writer.lock().await;
                    if w.write_all(job.as_bytes()).await.is_err() {
                        return;
                    }
                    if w.write_all(b"\n").await.is_err() {
                        return;
                    }
                    if w.flush().await.is_err() {
                        return;
                    }
                }

                // Touch telemetry
                self.telemetry.lock().unwrap().touch_session(
                    &miner_id,
                    &worker_name,
                    &algorithm,
                    &backend,
                    &zis_user,
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
                                // P-01 hardening: per-session share rate limit.
                                if !share_rate.allow() {
                                    let result = PoolMessage::Result {
                                        accepted: false,
                                        status: "rate_limited".to_string(),
                                        block_found: false,
                                        block_height: None,
                                    };
                                    let _ = write_v3_message(writer, &result).await;
                                    continue;
                                }

                                // P-02: bind the submit identity to the Hello
                                // session — an empty field defaults to the
                                // bound identity, a foreign one is rejected.
                                if !submit_miner.is_empty() && submit_miner != miner_id {
                                    let result = PoolMessage::Result {
                                        accepted: false,
                                        status: "unauthorized_miner".to_string(),
                                        block_found: false,
                                        block_height: None,
                                    };
                                    let _ = write_v3_message(writer, &result).await;
                                    continue;
                                }
                                let submit_worker = if submit_worker.is_empty() {
                                    worker_name.clone()
                                } else if submit_worker != worker_name
                                    && !submit_worker.starts_with(&format!("{miner_id}."))
                                {
                                    let result = PoolMessage::Result {
                                        accepted: false,
                                        status: "unauthorized_worker".to_string(),
                                        block_found: false,
                                        block_height: None,
                                    };
                                    let _ = write_v3_message(writer, &result).await;
                                    continue;
                                } else {
                                    submit_worker
                                };
                                let submit_miner = if submit_miner.is_empty() {
                                    miner_id.clone()
                                } else {
                                    submit_miner
                                };

                                let job_key = format!("zion_{}", job_id);
                                let job_data = self.jobs.lock().unwrap().get(&job_key).cloned();
                                let (header, job_share_target, block_target, reward, template) = match job_data {
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

                                // Validate against the target issued WITH
                                // this job — the live session vardiff target
                                // ratchets between issue and submit and was
                                // rejecting ~50% of honest shares. Replay is
                                // covered by share_seen dedup; credit uses
                                // the job's own difficulty.
                                let share_target = job_share_target;
                                let share_difficulty = crate::telemetry::expected_hashes_for_target(&job_share_target).max(1.0) as u64;
                                let submission = ShareSubmission {
                                    worker: submit_worker.clone(),
                                    job_id: job_key.clone(),
                                    nonce_hex: format!("{:016x}", nonce),
                                    difficulty: share_difficulty,
                                    solo: self.solo_mode,
                                };

                                let (result, share_hash) = self.submit_share_two_phase(
                                    &submission,
                                    nonce,
                                    &header,
                                    height,
                                    &share_target,
                                    None,
                                );

                                let accepted = matches!(result, Ok(true));
                                // Reuses the hash the submit phase already
                                // computed unlocked — no second hash under
                                // `pool.lock()`.
                                let block_found =
                                    accepted && share_hash.is_some_and(|h| h <= block_target);

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
                                    let reason = match &result {
                                        Err(e) => e.to_string(),
                                        _ => "low_difficulty".to_string(),
                                    };
                                    let mut t = self.telemetry.lock().unwrap();
                                    t.record_job_result(
                                        &submit_miner,
                                        &submit_worker,
                                        false,
                                        attempted_h,
                                        elapsed_ms,
                                    );
                                    t.record_reject_reason(
                                        &submit_miner,
                                        &submit_worker,
                                        "zion",
                                        &reason,
                                    );
                                }

                                let block_height_val = if block_found { Some(height) } else { None };

                                let result_msg = PoolMessage::Result {
                                    accepted,
                                    status: if accepted {
                                        "accepted".to_string()
                                    } else if matches!(result, Err(PoolError::DuplicateShare)) {
                                        "duplicate".to_string()
                                    } else {
                                        "rejected".to_string()
                                    },
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
                                gpu_coin_2,
                                gpu_profit_usd_day,
                                cpu_profit_usd_day,
                            }) => {
                                tracing::info!(
                                    "v3_coin_preference miner={} gpu={} gpu2={} cpu={} gpu_profit={:.2}/day cpu_profit={:.2}/day",
                                    pref_miner, gpu_coin, gpu_coin_2, cpu_coin, gpu_profit_usd_day, cpu_profit_usd_day
                                );
                                // Pin this session's external streams to the
                                // miner's declared coins — the broadcast embeds
                                // only the default coin, so sessions routed to
                                // another coin get theirs via session_job_line.
                                Self::apply_coin_preference(
                                    &mut session_gpu_pref,
                                    &mut session_cpu_pref,
                                    &mut session_gpu2_pref,
                                    &gpu_coin,
                                    &cpu_coin,
                                    &gpu_coin_2,
                                );
                            }

                            Ok(PoolMessage::ExternalSubmit {
                                miner_id: sub_miner_id,
                                worker_name: sub_worker_name,
                                coin,
                                algorithm: submit_algorithm,
                                external_job_id,
                                nonce,
                                nonce_hex,
                                hash_hex,
                                mix_hash_hex,
                                extranonce1_hex,
                                solution_hex,
                                ntime_hex: submit_ntime_hex,
                                ..
                            }) => {
                                tracing::info!(
                                    "v3_external_submit miner={} worker={} ip={} coin={} job={} nonce={}",
                                    sub_miner_id, sub_worker_name, ip, coin, external_job_id, nonce
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
                                // Look up the exact upstream job the miner claims to have solved.
                                // Using the latest bridge job (latest_job_for_coin) caused the pool
                                // to forward a share for job A with the ntime/solution of the current
                                // job B, producing "job not found" / invalid-solution rejects.
                                let coin_enum = zion_cosmic_harmony::profit::ExternalCoin::from_ticker(&coin);
                                let job_pkg_opt = if external_job_id.is_empty() {
                                    // Old/stratum-style submissions may not include an upstream job
                                    // id; fall back to the most recent bridge job.
                                    coin_enum.as_ref().and_then(|c| self.multi_bridge.latest_job_for_coin(c))
                                } else {
                                    coin_enum.as_ref().and_then(|c| self.multi_bridge.job_for_coin_and_id(c, &external_job_id))
                                        .or_else(|| self.multi_bridge.native_job_by_id(&external_job_id))
                                };

                                // Expected work per accepted share — the
                                // resolved job's target drives the per-coin
                                // hashrate estimator.
                                let mut share_eh = 0f64;
                                let bridge_result = match job_pkg_opt {
                                    Some(job_pkg) => {
                                        share_eh = crate::telemetry::expected_hashes_for_target_hex(
                                            &job_pkg.target_hex,
                                        );
                                        // Build ntime/solution/extranonce1 from the matching bridge job.
                                        let ntime_hex = if !submit_ntime_hex.is_empty() {
                                            submit_ntime_hex
                                        } else {
                                            job_pkg.ntime.clone()
                                        };

                                        // Use the extranonce1 from the JobPackage (authoritative,
                                        // from LuckPool subscribe) if available. Fall back to the
                                        // miner's extranonce1_hex only if the job_pkg is unavailable.
                                        let en1_hex_final = if !job_pkg.extranonce1_hex.is_empty() {
                                            job_pkg.extranonce1_hex.clone()
                                        } else {
                                            extranonce1_hex.clone()
                                        };

                                        let is_verushash = submit_algorithm.contains("verushash")
                                            || coin.eq_ignore_ascii_case("VRSC");

                                        let solution_hex_final = if is_verushash {
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

                                            let en1_bytes = hex::decode(&en1_hex_final).unwrap_or_default();

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
                                                    let header_hex_stripped = job_pkg.header_hex.strip_prefix("0x").unwrap_or(&job_pkg.header_hex);
                                                    if let Ok(header) = hex::decode(header_hex_stripped) {
                                                        if header.len() >= VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE {
                                                            header[VERUS_SOLUTION_OFFSET_IN_HEADER..VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE].to_vec()
                                                        } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                                    } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                                }
                                            } else {
                                                // Extract solution from header_hex
                                                let header_hex_stripped = job_pkg.header_hex.strip_prefix("0x").unwrap_or(&job_pkg.header_hex);
                                                if let Ok(header) = hex::decode(header_hex_stripped) {
                                                    if header.len() >= VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE {
                                                        header[VERUS_SOLUTION_OFFSET_IN_HEADER..VERUS_SOLUTION_OFFSET_IN_HEADER + VERUS_SOLUTION_SIZE].to_vec()
                                                    } else { vec![0u8; VERUS_SOLUTION_SIZE] }
                                                } else { vec![0u8; VERUS_SOLUTION_SIZE] }
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
                                        } else {
                                            // Extract solution (WITH varint prefix) from header_hex
                                            // for ZcashStratum (VRSC).
                                            // Header: version(4)+prevhash(32)+merkle(32)+reserved(32)+
                                            //         ntime(4)+nbits(4)+nonce(32)+varint+solution
                                            // Varint starts at offset 140. LuckPool expects the
                                            // full solution including the CompactSize varint prefix.
                                            let is_vrsc = coin == "VRSC";
                                            let header_hex_stripped = job_pkg.header_hex.strip_prefix("0x").unwrap_or(&job_pkg.header_hex);
                                            if let Ok(header) = hex::decode(header_hex_stripped) {
                                                if header.len() > 141 && is_vrsc {
                                                    // Include varint prefix in the solution
                                                    hex::encode(&header[140..])
                                                } else { String::new() }
                                            } else { String::new() }
                                        };

                                        tracing::debug!(
                                            target: "en1_trace",
                                            final_en1 = %en1_hex_final,
                                            miner_en1 = %extranonce1_hex,
                                            sol_hex_len = solution_hex_final.len(),
                                            coin = %coin,
                                            "en1_trace pool-side final extranonce1 for forwarding"
                                        );

                                        let req = ShareForwardRequest {
                                            job_id: job_pkg.external_job_id.clone(),
                                            nonce,
                                            nonce_hex: nonce_hex.clone(),
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
                                        tokio::task::spawn_blocking(move || {
                                            bridge.forward_by_ticker(&coin_clone, req)
                                        }).await.unwrap_or(None)
                                    }
                                    None => {
                                        tracing::info!(
                                            "v3_external_stale miner={} worker={} ip={} coin={} job={} nonce={} reason=unknown_or_stale_bridge_job",
                                            sub_miner_id, sub_worker_name, ip, coin, external_job_id, nonce
                                        );
                                        Some(crate::auxpow_bridge::ShareForwardOutcome::Result(
                                            crate::share_forwarder::ShareForwardResult::Rejected("stale".to_string()),
                                        ))
                                    }
                                };

                                tracing::info!(
                                    "v3_external_forward miner={} worker={} ip={} coin={} job={} nonce={} result={:?} status={}",
                                    sub_miner_id, sub_worker_name, ip, coin, external_job_id, nonce,
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

                                if !accepted {
                                    // Resync: a miner submitting shares for a retired
                                    // upstream job likely missed the job broadcast (or
                                    // runs a build without external-job refresh). Push
                                    // the latest bundled job so it stops hashing dead work.
                                    // Must apply session coin preferences — a raw
                                    // broadcast would stomp a forced-coin stream and
                                    // trigger a reject↔resync churn loop.
                                    let resync_job = self.last_v3_job.lock().unwrap().clone();
                                    if let Some(job) = resync_job {
                                        let job = self.session_job_line(
                                            &job,
                                            session_gpu_pref,
                                            session_cpu_pref,
                                            session_gpu2_pref,
                                            nonce_base,
                                        );
                                        let mut w = writer.lock().await;
                                        let _ = w.write_all(job.as_bytes()).await;
                                        let _ = w.write_all(b"\n").await;
                                        let _ = w.flush().await;
                                    }
                                }

                                // Credit upstream-accepted external shares
                                // into PPLNS at their configured weight so
                                // the miner earns ZION for verified work
                                // (multi-algo phase C).
                                if accepted {
                                    let h = self
                                        .current_height
                                        .load(Ordering::Relaxed);
                                    let w = if is_unverified_credit(&status) {
                                        auxpow_share_weight(&coin)
                                            * unverified_credit_weight_pct()
                                            / 100
                                    } else {
                                        auxpow_share_weight(&coin)
                                    };
                                    let credited = self
                                        .pool
                                        .lock()
                                        .unwrap()
                                        .record_external_share(
                                            &sub_miner_id,
                                            &sub_worker_name,
                                            h,
                                            w,
                                            &coin,
                                            &external_job_id,
                                            &format!(
                                                "{nonce}:{nonce_hex:?}:{hash_hex:?}"
                                            ),
                                        );
                                    if !credited {
                                        // Upstream accepted but PPLNS dedup already
                                        // claimed the slot — surface as duplicate so
                                        // /miners reject_reasons matches the miner UI.
                                        tracing::info!(
                                            "v3_external_duplicate miner={} worker={} ip={} coin={} job={} nonce={}",
                                            sub_miner_id,
                                            sub_worker_name,
                                            ip,
                                            coin,
                                            external_job_id,
                                            nonce
                                        );
                                        {
                                            let mut t = self.telemetry.lock().unwrap();
                                            t.record_external_share(
                                                &sub_miner_id,
                                                &sub_worker_name,
                                                &coin,
                                                false,
                                                share_eh,
                                            );
                                            t.record_reject_reason(
                                                &sub_miner_id,
                                                &sub_worker_name,
                                                &coin,
                                                "duplicate",
                                            );
                                        }
                                        let rev_source = zion_cosmic_harmony::revenue::RevenueSource::from_str_ci(
                                            &submit_algorithm
                                        ).unwrap_or(zion_cosmic_harmony::revenue::RevenueSource::Zion);
                                        let group = crate::routing::resolve_session_group(
                                            &sub_miner_id,
                                            &sub_worker_name,
                                        );
                                        self.routing_stats.lock().unwrap().record(
                                            group,
                                            rev_source,
                                            false,
                                        );
                                        let result = PoolMessage::ExternalResult {
                                            accepted: false,
                                            status: "duplicate".to_string(),
                                            coin: coin.clone(),
                                        };
                                        let _ = write_v3_message(writer, &result).await;
                                        continue;
                                    }
                                }

                                // Route external shares to the coin's own telemetry
                                // stream so they appear under `streams` in /miners
                                // without polluting ZION share/hashrate stats.
                                {
                                    let mut t = self.telemetry.lock().unwrap();
                                    t.record_external_share(
                                        &sub_miner_id,
                                        &sub_worker_name,
                                        &coin,
                                        accepted,
                                        share_eh,
                                    );
                                    if is_unverified_credit(&status) {
                                        t.record_unverified_credit(
                                            &sub_miner_id,
                                            &sub_worker_name,
                                            &coin,
                                        );
                                    }
                                    if !accepted {
                                        t.record_reject_reason(
                                            &sub_miner_id,
                                            &sub_worker_name,
                                            &coin,
                                            &status,
                                        );
                                    }
                                }
                                let rev_source = zion_cosmic_harmony::revenue::RevenueSource::from_str_ci(
                                    &submit_algorithm
                                ).unwrap_or(zion_cosmic_harmony::revenue::RevenueSource::Zion);
                                let group = crate::routing::resolve_session_group(&sub_miner_id, &sub_worker_name);
                                self.routing_stats.lock().unwrap().record(group, rev_source, accepted);
                            }

                            Ok(PoolMessage::PearlSubmit {
                                miner_id: sub_miner_id,
                                worker_name: sub_worker_name,
                                coin,
                                algorithm,
                                external_job_id,
                                plain_proof_b64,
                                ..
                            }) => {
                                tracing::info!(
                                    "v3_pearl_submit miner={} worker={} ip={} job={} proof_b64_len={}",
                                    sub_miner_id, sub_worker_name, ip, external_job_id,
                                    plain_proof_b64.len()
                                );

                                // Verify the share locally against the pool's
                                // own gateway job (server-authoritative — the
                                // miner's echoed mining_job is advisory only).
                                let (accepted, status) = if !coin.eq_ignore_ascii_case("prl")
                                    || !algorithm.eq_ignore_ascii_case("pearlhash")
                                {
                                    (false, "unsupported_coin_or_algorithm".to_string())
                                } else {
                                    self.process_pearl_submission(
                                        &sub_miner_id,
                                        &sub_worker_name,
                                        &external_job_id,
                                        &plain_proof_b64,
                                        None,
                                    )
                                    .await
                                };

                                let result = PoolMessage::ExternalResult {
                                    accepted,
                                    status: status.clone(),
                                    coin: coin.clone(),
                                };
                                let _ = write_v3_message(writer, &result).await;
                                tracing::info!(
                                    "v3_pearl_result miner={} worker={} ip={} job={} accepted={} status={}",
                                    sub_miner_id, sub_worker_name, ip, external_job_id, accepted, status
                                );

                                if !accepted {
                                    // Same resync semantics as ExternalSubmit:
                                    // push the freshest job so the miner stops
                                    // hashing a retired template.
                                    let resync_job = self.last_v3_job.lock().unwrap().clone();
                                    if let Some(job) = resync_job {
                                        let job = self.session_job_line(
                                            &job,
                                            session_gpu_pref,
                                            session_cpu_pref,
                                            session_gpu2_pref,
                                            nonce_base,
                                        );
                                        let mut w = writer.lock().await;
                                        let _ = w.write_all(job.as_bytes()).await;
                                        let _ = w.write_all(b"\n").await;
                                        let _ = w.flush().await;
                                    }
                                }
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
                            let line = self.session_job_line(
                                msg.trim_end(),
                                session_gpu_pref,
                                session_cpu_pref,
                                session_gpu2_pref,
                                nonce_base,
                            );
                            let mut w = writer.lock().await;
                            if w.write_all(line.as_bytes()).await.is_err() { break; }
                            if w.write_all(b"\n").await.is_err() { break; }
                        }
                    }
                    // Lagged receivers miss broadcasts but stay subscribed —
                    // resync with the latest job instead of killing the session.
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!("v3 session lagged {} broadcasts ip={}, resyncing", n, ip);
                        let resync_job = self.last_v3_job.lock().unwrap().clone();
                        if let Some(job) = resync_job {
                            let job = self.session_job_line(
                                &job,
                                session_gpu_pref,
                                session_cpu_pref,
                                session_gpu2_pref,
                                nonce_base,
                            );
                            let mut w = writer.lock().await;
                            if w.write_all(job.as_bytes()).await.is_err() { break; }
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

        let endpoints = match L1Endpoints::from_urls(&rpc_url) {
            Some(e) => e,
            None => {
                tracing::error!("invalid L1 RPC URL '{}'", rpc_url);
                return;
            }
        };
        tracing::info!("template_feed_loop: L1 endpoints {}", endpoints.describe());

        // Poll the L1 node every second. VRSC/LuckPool jobs can switch on a
        // 60s block boundary, so a 5s polling interval leaves miners working
        // on a stale external job for up to ~5s. 1s keeps the external stream
        // fresh and matches the pool-side "touch job timestamp" cadence.
        let interval = Duration::from_secs(1);
        let mut job_counter: u64 = 0u64;
        let mut first = true;
        // Track the last template/external-stream fingerprint we broadcast.
        // The ZION header timestamp/nonce are updated every second, so we
        // compare height, previous_hash, merkle_root and external job ids
        // instead of the full message.
        let mut last_fingerprint: Option<JobFingerprint> = None;
        // Last successfully fetched template — reused when `getTemplate`
        // fails or times out so external-stream job updates keep flowing.
        let mut last_template_json: Option<String> = None;

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
                    let payload = json!({
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getTemplate",
                        "params": { "miner_address": miner_address },
                    });

                    // Bound the RPC call: a wedged node `getTemplate` must not
                    // stall this loop — it also carries external (AuxPoW)
                    // job broadcasts to miners.
                    let fetched: Option<Value> = match tokio::time::timeout(
                        Duration::from_secs(5),
                        endpoints.call(&payload),
                    )
                    .await
                    {
                        Ok(Ok(v)) => {
                            if let Some(err) = v.get("error") {
                                if !err.is_null() {
                                    tracing::warn!("getTemplate error: {}", err);
                                    continue;
                                }
                            }
                            v.get("result").cloned()
                        }
                        Ok(Err(e)) => {
                            tracing::warn!("getTemplate request failed: {}", e);
                            None
                        }
                        Err(_) => {
                            tracing::warn!("getTemplate request timed out after 5s");
                            None
                        }
                    };

                    // On RPC failure/timeout reuse the last good template so
                    // external (AuxPoW) job rotations still reach miners while
                    // the L1 node is stalled.
                    let (result, template_json) = match fetched {
                        Some(r) => {
                            let tj = serde_json::to_string(&r).unwrap_or_default();
                            last_template_json = Some(tj.clone());
                            (r, tj)
                        }
                        None => match &last_template_json {
                            Some(tj) => (
                                serde_json::from_str::<Value>(tj).unwrap_or(Value::Null),
                                tj.clone(),
                            ),
                            None => continue,
                        },
                    };

                    {
                            let header_hex = result.get("header_hex")
                                .and_then(Value::as_str)
                                .unwrap_or("");
                            let block_target_hex = result.get("target_hex")
                                .and_then(Value::as_str)
                                .unwrap_or("");
                            let reward = result.get("block_reward")
                                .and_then(Value::as_u64)
                                .unwrap_or(0);
                            let network_difficulty = result.get("difficulty")
                                .and_then(Value::as_u64)
                                .unwrap_or(1)
                                .max(1);

                            // The full block target is too hard for frequent shares.
                            // Broadcast a share target derived from the configured starting
                            // difficulty, but never harder than the current network difficulty.
                            // On a fresh low-difficulty chain this lets CPU miners find shares
                            // before the V3 job TTL expires.
                            let share_difficulty = self.vardiff_config.start_difficulty.min(network_difficulty);
                            let share_target = difficulty_to_target(share_difficulty);
                            let share_target_hex = hex::encode(share_target);

                            if !header_hex.is_empty() {
                                let fingerprint = self.build_job_fingerprint(&template_json);

                                let changed = match (&last_fingerprint, &fingerprint) {
                                    (None, Some(_)) => true,
                                    (Some(last), Some(cur)) => last != cur,
                                    _ => false,
                                };

                                if changed {
                                    job_counter += 1;
                                    let job_id = format!("zion_{}", job_counter);
                                    tracing::info!(job = %job_id, "broadcasting mining.notify");
                                    self.broadcast_job(
                                        &job_id,
                                        header_hex,
                                        &share_target_hex,
                                        block_target_hex,
                                        reward,
                                        &template_json,
                                    );
                                    last_fingerprint = fingerprint;
                                } else {
                                    tracing::debug!("template_feed_loop: ZION/external stream unchanged, skipping broadcast");
                                }
                            } else {
                                last_fingerprint = None;
                            }
                    }
                }
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
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
        self.pool.lock().unwrap().on_block_found(
            block_height,
            block_reward,
            self.solo_mode.then_some(miner_id),
        );
        let shares_since_prev = self.block_tracker.lock().unwrap().record_block_found(
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
        self.notifier
            .notify_block_found(miner_id, block_height, worker_name);

        if let Some(ref store) = self.share_store {
            let rec = crate::store::BlockRecord {
                coin: "zion".to_string(),
                height: block_height,
                hash: block_hash.to_string(),
                miner_id: miner_id.to_string(),
                worker_name: worker_name.to_string(),
                share_difficulty,
                network_difficulty,
                shares_since_prev,
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
        let shares_since_prev = self.block_tracker.lock().unwrap().record_block_found(
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
                coin: "zion".to_string(),
                height: block_height,
                hash: block_hash.to_string(),
                miner_id: miner_id.to_string(),
                worker_name: worker_name.to_string(),
                share_difficulty,
                network_difficulty,
                shares_since_prev,
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

        let endpoints = L1Endpoints::from_urls(&rpc_url)
            .with_context(|| format!("invalid submitBlock RPC URL: {}", rpc_url))?;

        if let Some(tip) = current_chain_height(&endpoints).await {
            if block.header.height != tip.saturating_add(1) {
                // Do NOT pre-orphan here: the tip query may be stale (follower
                // lag) or the node's tip may move between this query and the
                // submit. The node's own submitBlock performs the real
                // consensus check (prev-hash / height) — a genuine orphan is
                // rejected there with "previous hash mismatch" and recorded
                // via the Err arm below. Pre-rejecting here discarded real
                // PoW blocks during the 2026-10-21 stall (tip 89952 while
                // tip+2 work was legitimately in flight).
                tracing::info!(
                    "block height={} vs queried tip={} — submitting anyway, node decides",
                    block.header.height,
                    tip
                );
            }
        }

        match submit_block_to_node(&endpoints, &block).await {
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

/// Parse a `PATTERN=COIN,PATTERN=COIN` route map from an env var into
/// `(pattern, coin)` pairs. Unknown coins and malformed entries are
/// skipped with a warning — a typo must not kill the whole route table.
fn parse_coin_routes(var: &str) -> Vec<(String, ExternalCoin)> {
    let raw = match std::env::var(var) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let mut routes = Vec::new();
    for pair in raw.split(',') {
        let pair = pair.trim();
        if pair.is_empty() {
            continue;
        }
        let Some((pat, ticker)) = pair.split_once('=') else {
            tracing::warn!("{}: skipping malformed route entry {:?}", var, pair);
            continue;
        };
        match ExternalCoin::from_str_loose(ticker.trim()) {
            Some(coin) => routes.push((pat.trim().to_string(), coin)),
            None => tracing::warn!("{}: skipping route with unknown coin {:?}", var, pair),
        }
    }
    routes
}

/// PPLNS work-weight credited for one upstream-accepted external share of
/// `coin` (multi-algo phase C): per-coin override
/// `ZION_POOL_AUXPOW_WEIGHT_<TICKER>`, else `ZION_POOL_AUXPOW_PPLNS_WEIGHT`
/// (default 500 ≈ the vardiff floor).  Upstream share targets are
/// coin-specific and not comparable to ZION difficulty, so the credit is
/// an explicit policy knob rather than a derived quantity.
fn auxpow_share_weight(coin: &str) -> u64 {
    let per_coin = format!("ZION_POOL_AUXPOW_WEIGHT_{}", coin.to_uppercase());
    std::env::var(&per_coin)
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .or_else(|| {
            std::env::var("ZION_POOL_AUXPOW_PPLNS_WEIGHT")
                .ok()
                .and_then(|s| s.trim().parse().ok())
        })
        .unwrap_or(500u64)
        .max(1)
}

/// Weight multiplier (percent) for shares credited on an unverifiable
/// upstream outcome (`accepted_unknown`/`accepted_stale_upstream`) —
/// P-05 residual from the 2026-10-26 pool audit. Default 100 keeps the
/// established economics; the operator drops it (e.g. 50) when upstream
/// quality degrades. `ZION_POOL_UNVERIFIED_CREDIT_PCT`, clamped 0..=100.
fn unverified_credit_weight_pct() -> u64 {
    std::env::var("ZION_POOL_UNVERIFIED_CREDIT_PCT")
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(100u64)
        .min(100)
}

/// A share status is "unverified credit" when the local proof passed but
/// the upstream answer cannot confirm acceptance — `accepted_unknown`
/// (unparsable/absent reply) and `accepted_stale_upstream` (retired job,
/// never forwarded). Plain `accepted` is fully verified.
fn is_unverified_credit(status: &str) -> bool {
    status != "accepted" && status.starts_with("accepted_")
}

/// Case-insensitive `*` glob: `vega*`, `*smos`, `vega-*-rig`, plain
/// equality when no `*` is present.
fn glob_match(pattern: &str, text: &str) -> bool {
    let p = pattern.to_ascii_lowercase();
    let t = text.to_ascii_lowercase();
    if !p.contains('*') {
        return p == t;
    }
    let anchored_start = !p.starts_with('*');
    let anchored_end = !p.ends_with('*');
    let segments: Vec<&str> = p.split('*').collect();
    let mut rest: &str = &t;
    for (i, seg) in segments.iter().enumerate() {
        if seg.is_empty() {
            continue;
        }
        match rest.find(seg) {
            Some(pos) => {
                if i == 0 && anchored_start && pos != 0 {
                    return false;
                }
                rest = &rest[pos + seg.len()..];
            }
            None => return false,
        }
    }
    if anchored_end {
        if let Some(last_seg) = segments.iter().rev().find(|s| !s.is_empty()) {
            return t.ends_with(last_seg);
        }
    }
    true
}

fn build_solved_block(tpl: CoreBlockTemplate, nonce: u64) -> Result<Block, serde_json::Error> {
    let mut header: BlockHeader = serde_json::from_str(&tpl.header_json)?;
    header.nonce = nonce;
    Ok(Block::new(header, tpl.transactions))
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
async fn current_chain_height(endpoints: &L1Endpoints) -> Option<u64> {
    let request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getChainInfo",
        "params": [],
    });
    let response = endpoints.call(&request).await.ok()?;
    // Prefer native_chain_height; fall back to chain_height for older nodes.
    response.get("result").and_then(|r| {
        r.get("native_chain_height")
            .and_then(|v| v.as_u64())
            .or_else(|| r.get("chain_height").and_then(|v| v.as_u64()))
    })
}

/// Submit a solved block to the node RPC.
///
/// Tip-affinity: follower nodes can lag the primary tip — a block built on
/// node A's template submitted to lagging node B is rejected with
/// "previous hash mismatch" (and `call()` treats an in-result error as
/// success, so it never tries the other endpoints). Probe each endpoint's
/// tip and submit to the one whose tip IS our prev_hash; fall back to the
/// last_good route when no node advertises it (tip already advanced — let
/// the node decide).
async fn submit_block_to_node(endpoints: &L1Endpoints, block: &Block) -> anyhow::Result<()> {
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "submitBlock",
        "params": serde_json::to_value(block).expect("block serializes"),
    });
    let prev_hex = hex::encode(block.header.previous_hash);
    let probe = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getChainInfo",
        "params": [],
    });
    for idx in 0..endpoints.len() {
        let Ok(resp) = endpoints
            .call_addr(idx, &probe, Duration::from_secs(3))
            .await
        else {
            continue;
        };
        let matches = resp
            .get("result")
            .map(|r| {
                [r.get("tip_hash"), r.get("native_tip_hash")]
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .any(|h| h.eq_ignore_ascii_case(&prev_hex))
            })
            .unwrap_or(false);
        if !matches {
            continue;
        }
        tracing::info!(
            "submitBlock tip-affinity: endpoint #{} tip == prev_hash {}",
            idx,
            &prev_hex[..12]
        );
        let response = endpoints
            .call_addr(idx, &payload, crate::rpc_client::attempt_timeout())
            .await?;
        if let Some(err) = response.get("error") {
            if !err.is_null() {
                return Err(anyhow::anyhow!("submitBlock returned error: {}", err));
            }
        }
        tracing::info!("submitBlock response: {}", response);
        return Ok(());
    }
    tracing::warn!(
        "submitBlock: no endpoint advertises tip {} — falling back to last_good",
        &prev_hex[..12]
    );
    let response: serde_json::Value = endpoints.call(&payload).await?;

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
        std::env::set_var("ZION_VARDIFF_MIN_DIFF", "1000");
        std::env::set_var("ZION_VARDIFF_START_DIFF", "1000");
        let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default(), telemetry)));
        StratumServer::new(pool)
    }

    /// Full QTU stratum session over a real TCP listener — mirrors the
    /// SRBMiner ↔ lproute wire exchange captured on the desktop rig:
    /// `login` → `result.job` → `job` pushes → `submit` → OK / error.
    ///
    /// `StratumServer` is built on the SYNC test thread — `Notifier` inside
    /// it owns a `reqwest::blocking::Client` which must be neither created
    /// nor dropped inside an async context (same pattern as the V3 ZIS
    /// session tests below). Only a `server.clone()` enters the runtime;
    /// the original server (and its notifier ref) never leaves the sync
    /// thread, so the reqwest client is dropped legally.
    #[test]
    fn qtu_stratum_end_to_end() {
        use crate::auxpow_bridge::{JobPackage, MultiAuxPowBridge};
        use crate::qtc_native::{share_target_from_diff, NativeJobCtx};

        let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(
            PoolConfig::default(),
            telemetry.clone(),
        )));

        // Native QTU leg at 100% — share validation runs fully local, no
        // upstream pool needed.
        let bridge = MultiAuxPowBridge::new();
        let (result_tx, _result_rx) = tokio::sync::mpsc::unbounded_channel();
        bridge.configure_native(result_tx, 100);

        let header = [0x11u8; 32];
        // diff=4 → share_target = U512_MAX/4 → ~1 in 4 nonces passes.
        let share_target = share_target_from_diff(4);
        let pkg = JobPackage {
            external_job_id: "qtun:testjob".to_string(),
            coin: ExternalCoin::Quantus,
            header_hex: hex::encode(header),
            target_hex: hex::encode(share_target),
            height: 1,
            algorithm: "qpow-poseidon2".to_string(),
            extranonce1_hex: "aabbccdd".to_string(),
            ntime: String::new(),
            seed_hash_hex: String::new(),
            eq_params: String::new(),
            eq_pers: String::new(),
            received_at: Some(Instant::now()),
        };
        let ctx = NativeJobCtx {
            raw_job_id: "testjob".to_string(),
            header,
            // net_target zero → no share ever wins a block (PPLNS only).
            net_target: [0u8; 64],
            share_target,
            serve_native: true,
            received_at: Instant::now(),
            shares_forwarded: 0,
        };
        bridge.push_native_job(pkg.clone(), ctx);

        // `Notifier` (reqwest::blocking::Client) is created HERE in sync
        // context — `StratumServer::new` would panic inside `block_on`.
        let server = StratumServer::new(pool).with_multi_bridge(bridge.clone());
        let telemetry_for_test = telemetry.clone();
        let bridge_for_push = bridge.clone();

        let server_for_thread = server.clone();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(qtu_stratum_session_body(server_for_thread, bridge_for_push));
        })
        .join()
        .expect("qtu e2e thread panicked");

        // The accepted share landed in QTU telemetry under the wallet.
        let tele = telemetry_for_test.lock().unwrap();
        let (key, m) = tele
            .miners
            .iter()
            .find(|(k, _)| k.contains("qzTEST"))
            .map(|(k, m)| (k.clone(), m.clone()))
            .unwrap_or_else(|| panic!("qtu miner present in telemetry: {:?}", tele.miners.keys()));
        assert_eq!(
            m.streams.get("qtu").map(|s| s.valid_shares).unwrap_or(0),
            1,
            "telemetry key={key} streams={:?}",
            m.streams.keys().collect::<Vec<_>>()
        );
    }

    async fn qtu_stratum_session_body(
        server: StratumServer,
        bridge: crate::auxpow_bridge::MultiAuxPowBridge,
    ) {
        use crate::auxpow_bridge::JobPackage;
        use crate::qtc_native::NativeJobCtx;
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        use tokio::net::{TcpListener, TcpStream};

        let share_target = crate::qtc_native::share_target_from_diff(4);
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server_for_run = server.clone();
        tokio::spawn(async move {
            let _ = server_for_run.run(listener).await;
        });

        let stream = TcpStream::connect(addr).await.unwrap();
        let (r, mut w) = stream.into_split();
        let mut reader = BufReader::new(r);
        let mut line = String::new();

        let header = [0x11u8; 32];
        // 1) login — verbatim SRBMiner wire format.
        w.write_all(
            br#"{"id":1,"method":"login","params":{"login":"qzTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTTT.w1","pass":"x","agent":"SRBMiner-MULTI/3.6.9"}}"#
                .as_slice(),
        )
        .await
        .unwrap();
        w.write_all(b"\n").await.unwrap();
        reader.read_line(&mut line).await.unwrap();
        let v: Value = serde_json::from_str(&line).unwrap();
        assert_eq!(v["id"], json!(1), "login resp={line}");
        assert_eq!(v["result"]["status"], "OK", "login resp={line}");
        assert_eq!(v["result"]["extensions"], json!(["keepalive"]));
        let session_id = v["result"]["id"].as_str().unwrap().to_string();
        let job = &v["result"]["job"];
        assert_eq!(job["algo"], "qpow-poseidon2");
        assert_eq!(job["job_id"], "qtun:testjob");
        assert_eq!(job["mining_hash"], hex::encode(header));
        assert_eq!(job["target"].as_str().unwrap().len(), 128);
        // upstream en1 ("aabbccdd") extended by the 4B session tag —
        // each session mines a disjoint upstream nonce subspace.
        let en = job["extranonce"].as_str().unwrap();
        assert_eq!(en.len(), 16);
        assert!(en.starts_with("aabbccdd"), "extranonce={en}");

        // 2) job push on rotation — feed a fresh native job, expect the
        //    `job` notification within the poll interval.
        let pkg2 = JobPackage {
            external_job_id: "qtun:job2".to_string(),
            coin: ExternalCoin::Quantus,
            header_hex: hex::encode([0x22u8; 32]),
            target_hex: hex::encode(share_target),
            height: 2,
            algorithm: "qpow-poseidon2".to_string(),
            extranonce1_hex: "aabbccdd".to_string(),
            ntime: String::new(),
            seed_hash_hex: String::new(),
            eq_params: String::new(),
            eq_pers: String::new(),
            received_at: Some(Instant::now()),
        };
        let ctx2 = NativeJobCtx {
            raw_job_id: "job2".to_string(),
            header: [0x22u8; 32],
            net_target: [0u8; 64],
            share_target,
            serve_native: true,
            received_at: Instant::now(),
            shares_forwarded: 0,
        };
        bridge.push_native_job(pkg2, ctx2);
        let pushed = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                line.clear();
                if reader.read_line(&mut line).await.unwrap() == 0 {
                    panic!("connection closed before job push");
                }
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if v.get("method").and_then(|m| m.as_str()) == Some("job") {
                        break v;
                    }
                }
            }
        })
        .await
        .expect("job push within 5s");
        assert_eq!(pushed["params"]["clean_jobs"], true);
        assert_eq!(pushed["params"]["job"]["job_id"], "qtun:job2");
        assert_eq!(pushed["params"]["job"]["algo"], "qpow-poseidon2");

        // 3) submit a REAL valid share on job2 — nonce where
        //    get_nonce_hash(header, nonce) < share_target.
        let header2 = [0x22u8; 32];
        let mut nonce = [0u8; 64];
        let mut found: Option<([u8; 64], [u8; 64])> = None;
        for n in 0..2_000_000u64 {
            nonce[56..].copy_from_slice(&n.to_be_bytes());
            let h = zion_miner::auxpow::qpow::get_nonce_hash(&header2, &nonce);
            if h.as_slice() < share_target.as_slice() {
                found = Some((nonce, h));
                break;
            }
        }
        let (nonce, hash) = found.expect("a passing nonce within 2M tries");
        let submit = format!(
            r#"{{"id":7,"method":"submit","params":{{"id":"{session_id}","job_id":"qtun:job2","nonce":"{}","result":"{}"}}}}"#,
            hex::encode(nonce),
            hex::encode(hash)
        );
        w.write_all(submit.as_bytes()).await.unwrap();
        w.write_all(b"\n").await.unwrap();
        let resp = tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                line.clear();
                reader.read_line(&mut line).await.unwrap();
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if v.get("id") == Some(&json!(7)) {
                        break v;
                    }
                }
            }
        })
        .await
        .expect("submit response within 10s");
        assert_eq!(resp["result"]["status"], "OK", "submit resp={resp}");
        assert!(resp["error"].is_null());

        // 4) stale job submit → error response.
        let bad = format!(
            r#"{{"id":8,"method":"submit","params":{{"id":"{session_id}","job_id":"qtun:gone","nonce":"{}","result":"{}"}}}}"#,
            hex::encode(nonce),
            hex::encode(hash)
        );
        w.write_all(bad.as_bytes()).await.unwrap();
        w.write_all(b"\n").await.unwrap();
        let resp = tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                line.clear();
                reader.read_line(&mut line).await.unwrap();
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if v.get("id") == Some(&json!(8)) {
                        break v;
                    }
                }
            }
        })
        .await
        .expect("stale submit response within 10s");
        assert!(resp["error"]["message"].as_str().is_some(), "resp={resp}");

        // 5) keepalive.
        w.write_all(
            format!(r#"{{"id":9,"method":"keepalive","params":{{"id":"{session_id}"}}}}"#)
                .as_bytes(),
        )
        .await
        .unwrap();
        w.write_all(b"\n").await.unwrap();
        let resp = tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                line.clear();
                reader.read_line(&mut line).await.unwrap();
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if v.get("id") == Some(&json!(9)) {
                        break v;
                    }
                }
            }
        })
        .await
        .expect("keepalive response within 10s");
        assert_eq!(resp["result"]["status"], "KEEPALIVED");

        // `server` is dropped inside this async body but the ORIGINAL
        // server (built on the sync test thread) still holds a Notifier
        // ref — this clone drop decrements 2→1, never drops the client.
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
        let resp = server
            .handle_request(r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","x"]}"#);
        assert!(resp.contains("true"));
    }

    /// F4: anonymous authorize with a garbage wallet is rejected — it would
    /// otherwise silently mine toward the pool's own payout address.
    #[test]
    fn authorize_rejects_invalid_wallet() {
        let server = make_server();
        let resp = server.handle_request(
            r#"{"id":2,"method":"mining.authorize","params":["notawallet.rig1","x"]}"#,
        );
        assert!(resp.contains("invalid wallet"), "resp={resp}");
    }

    /// F4-B: consecutive invalid submits trigger the same ban as the V3
    /// no-solution rule — `banned` flag set + IP ban recorded.
    #[test]
    fn v1_invalid_share_ban_fires_at_threshold() {
        let server = make_server();
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        ctx.peer_ip = Some("9.9.9.9".parse().unwrap());
        ctx.session.miner_id = "bad".into();

        // Below threshold — no ban.
        for _ in 0..server.max_consecutive_no_solution - 1 {
            assert!(!server.v1_invalid_share_ban(&mut ctx));
        }
        // Threshold crossing fires exactly once.
        assert!(server.v1_invalid_share_ban(&mut ctx));
        assert!(ctx.banned);
        assert!(!server.v1_invalid_share_ban(&mut ctx), "ban fires once");
        let bans = server.no_solution_bans.lock().unwrap();
        assert!(bans.contains_key(&"9.9.9.9".parse::<IpAddr>().unwrap()));
        drop(bans);

        // A clean accept resets the counter.
        ctx.banned = false;
        ctx.consecutive_invalid = 0;
        assert!(!server.v1_invalid_share_ban(&mut ctx));
    }

    /// F2d: stage a `ZisPasswordOutcome` in `ctx.zis_auth` — the sync
    /// `mining.authorize` handler must consume it exactly once.
    #[test]
    fn v1_authorize_consumes_staged_zis_reject() {
        let server = make_server();
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        ctx.zis_auth = Some(ZisPasswordOutcome::Reject);
        let resp = server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","zis_tok"]}"#,
            &mut ctx,
        );
        assert!(resp.contains("unauthorized"), "resp={resp}");
        assert!(!ctx.authorized);
        assert!(ctx.zis_auth.is_none(), "staged outcome must be consumed");
        assert!(ctx.zis_user.is_empty());
    }

    #[test]
    fn v1_authorize_consumes_staged_zis_allow_binds_user() {
        let server = make_server();
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        ctx.zis_auth = Some(ZisPasswordOutcome::Allow(Some(crate::zis::ZisIdentity {
            sub: "u7".to_string(),
            zion_address: None,
            quantus_address: None,
            pearl_address: None,
            addresses: Vec::new(),
        })));
        let resp = server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","zis_tok"]}"#,
            &mut ctx,
        );
        assert!(resp.contains("true"), "resp={resp}");
        assert!(ctx.authorized);
        assert_eq!(ctx.zis_user, "u7");
        assert!(ctx.zis_auth.is_none());
    }

    #[test]
    fn v1_authorize_without_staged_outcome_is_anonymous() {
        let server = make_server();
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        let resp = server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","x"]}"#,
            &mut ctx,
        );
        assert!(resp.contains("true"));
        assert!(ctx.authorized);
        assert!(ctx.zis_user.is_empty());
    }

    /// F2d: `zis_password_auth` verdicts across auth modes.  The server is
    /// built on the sync test thread (reqwest::blocking `Notifier`); only
    /// the verifier + async call enter the runtime.
    fn zis_auth_outcome(
        pass: &str,
        zis_body: Option<&'static str>,
        required: bool,
    ) -> ZisPasswordOutcome {
        let mut server = make_server();
        server.zis_required = required;
        let listener = zis_body.map(|body| {
            let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let url = format!("http://{}", l.local_addr().unwrap());
            (l, url, body)
        });
        if let Some((_, url, _)) = &listener {
            server.zis = Some(Arc::new(crate::zis::ZisVerifier::for_test(url.clone())));
        } else {
            server.zis = None;
        }
        let pass = pass.to_string();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                if let Some((l, _, body)) = listener {
                    l.set_nonblocking(true).unwrap();
                    let zl = tokio::net::TcpListener::from_std(l).unwrap();
                    tokio::spawn(async move {
                        use tokio::io::{AsyncReadExt, AsyncWriteExt};
                        while let Ok((mut s, _)) = zl.accept().await {
                            let mut buf = vec![0u8; 8192];
                            let _ = s.read(&mut buf).await;
                            let resp = format!(
                                "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                                body.len(),
                                body
                            );
                            let _ = s.write_all(resp.as_bytes()).await;
                        }
                    });
                }
                server
                    .zis_password_auth(&pass, "v1", "miner1", IpAddr::V4(Ipv4Addr::LOCALHOST))
                    .await
            })
        })
        .join()
        .expect("zis auth thread panicked")
    }

    #[test]
    fn zis_password_auth_off_mode_ignores_tokens() {
        // Off mode: no verifier — even a `zis_` pass is anonymous.
        assert!(matches!(
            zis_auth_outcome("zis_whatever", None, false),
            ZisPasswordOutcome::Allow(None)
        ));
        assert!(matches!(
            zis_auth_outcome("x", None, false),
            ZisPasswordOutcome::Allow(None)
        ));
    }

    #[test]
    fn zis_password_auth_optional_anonymous_and_invalid() {
        // Plain "x" is anonymous — verifier is never consulted.
        assert!(matches!(
            zis_auth_outcome("x", Some(r#"{"valid":false}"#), false),
            ZisPasswordOutcome::Allow(None)
        ));
        // Invalid `zis_` token in optional mode → anonymous, not reject.
        assert!(matches!(
            zis_auth_outcome(
                "zis_badbadbadbadbadb",
                Some(r#"{"error":"UNAUTHORIZED","message":"Invalid API key"}"#),
                false
            ),
            ZisPasswordOutcome::Allow(None)
        ));
    }

    #[test]
    fn zis_password_auth_optional_binds_identity() {
        let outcome = zis_auth_outcome(
            "zis_goodgoodgoodgood",
            Some(r#"{"valid":true,"user":{"id":"u33","linkedAddresses":[]}}"#),
            false,
        );
        match outcome {
            ZisPasswordOutcome::Allow(Some(idn)) => assert_eq!(idn.sub, "u33"),
            _ => panic!("expected bound identity"),
        }
    }

    #[test]
    fn zis_password_auth_required_rejects_absent_and_invalid() {
        // Missing token → reject before contacting ZIS.
        assert!(matches!(
            zis_auth_outcome("x", Some(r#"{"valid":false}"#), true),
            ZisPasswordOutcome::Reject
        ));
        // Invalid token → reject.
        assert!(matches!(
            zis_auth_outcome(
                "zis_badbadbadbadbadb",
                Some(r#"{"error":"UNAUTHORIZED","message":"Invalid API key"}"#),
                true
            ),
            ZisPasswordOutcome::Reject
        ));
    }

    #[test]
    fn zis_password_auth_required_accepts_valid() {
        match zis_auth_outcome(
            "zis_goodgoodgoodgood",
            Some(r#"{"valid":true,"user":{"id":"u8","linkedAddresses":[]}}"#),
            true,
        ) {
            ZisPasswordOutcome::Allow(Some(idn)) => assert_eq!(idn.sub, "u8"),
            _ => panic!("expected bound identity"),
        }
    }

    /// F2d: `v1_zis_precheck` parses the authorize password and stages the
    /// verdict; the sync handler then binds the identity.  Covers the full
    /// async→sync handoff without a pool socket.
    #[test]
    fn v1_zis_precheck_stages_and_authorize_binds() {
        let mut server = make_server();
        server.zis_required = false;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        server.zis = Some(Arc::new(crate::zis::ZisVerifier::for_test(url)));
        let line = r#"{"id":9,"method":"mining.authorize","params":["zion1m.w","zis_validtok"]}"#
            .to_string();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
            rt.block_on(async {
                listener.set_nonblocking(true).unwrap();
                let zl = tokio::net::TcpListener::from_std(listener).unwrap();
                tokio::spawn(async move {
                    use tokio::io::{AsyncReadExt, AsyncWriteExt};
                    while let Ok((mut s, _)) = zl.accept().await {
                        let mut buf = vec![0u8; 8192];
                        let _ = s.read(&mut buf).await;
                        let body =
                            r#"{"valid":true,"user":{"id":"u99","linkedAddresses":[]}}"#;
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        let _ = s.write_all(resp.as_bytes()).await;
                    }
                });
                server
                    .v1_zis_precheck(&mut ctx, &line, IpAddr::V4(Ipv4Addr::LOCALHOST))
                    .await;
            });
            // Precheck must have staged an Allow(Some(_)) verdict.
            match ctx.zis_auth.take() {
                Some(ZisPasswordOutcome::Allow(Some(idn))) => assert_eq!(idn.sub, "u99"),
                other => panic!("expected staged Allow(Some(u99)), got {:?}", other.is_some()),
            }
            // Non-authorize lines stage nothing.
            ctx.zis_auth = None;
            rt.block_on(server.v1_zis_precheck(
                &mut ctx,
                r#"{"id":1,"method":"mining.subscribe","params":[]}"#,
                IpAddr::V4(Ipv4Addr::LOCALHOST),
            ));
            assert!(ctx.zis_auth.is_none());
            // server drops here — sync context of the dedicated thread.
        })
        .join()
        .expect("precheck thread panicked");
    }

    #[test]
    fn handles_zion_submit() {
        let server = make_server();
        let share_target = crate::vardiff::difficulty_to_target(1000);
        let share_target_hex = hex::encode(share_target);
        let header_bytes = vec![0u8; 80];
        let algo = zion_cosmic_harmony::EkamDeeksha::new();
        let nonce = zion_cosmic_harmony::PowAlgorithm::find_nonce(
            &algo,
            &header_bytes,
            0,
            100_000,
            &share_target,
        )
        .expect("should find a nonce meeting difficulty 1000");
        let nonce_hex = format!("{:016x}", nonce.0);
        let header = hex::encode(&header_bytes);
        server.job_notification(
            "zion_1",
            &header,
            &share_target_hex,
            &share_target_hex,
            6_000_000,
            "",
        );
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","x"]}"#,
            &mut ctx,
        );
        let resp = server.handle_request_with_ctx(
            &format!(
                r#"{{"id":3,"method":"mining.submit","params":["zion1x.w1","zion_1","{}"]}}"#,
                nonce_hex
            ),
            &mut ctx,
        );
        assert!(resp.contains("true"), "resp={resp}");
    }

    #[test]
    fn handles_auxpow_submit() {
        let server = make_server();
        let share_target = crate::vardiff::difficulty_to_target(1000);
        let share_target_hex = hex::encode(share_target);
        let header_bytes = vec![0u8; 80];
        let coin = zion_cosmic_harmony::ExternalCoin::Bitcoin;
        let nonce = (0..100_000u64)
            .find(|&n| {
                let hash = zion_miner::auxpow::hasher::hash_for_coin(coin, &header_bytes, n);
                zion_miner::auxpow::hasher::meets_target(&hash, &share_target)
            })
            .expect("should find a nonce meeting difficulty 1000 for Bitcoin");
        let nonce_hex = format!("{:016x}", nonce);
        let header = hex::encode(&header_bytes);
        server.job_notification(
            "aux_bitcoin_1",
            &header,
            &share_target_hex,
            &share_target_hex,
            6_000_000,
            "",
        );
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","x"]}"#,
            &mut ctx,
        );
        let resp = server.handle_request_with_ctx(
            &format!(
                r#"{{"id":4,"method":"mining.submit","params":["zion1x.w1","aux_bitcoin_1","{}"]}}"#,
                nonce_hex
            ),
            &mut ctx,
        );
        assert!(resp.contains("true"), "resp={resp}");
    }

    #[test]
    fn rejects_unknown_job() {
        let server = make_server();
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","x"]}"#,
            &mut ctx,
        );
        let resp = server.handle_request_with_ctx(
            r#"{"id":5,"method":"mining.submit","params":["zion1x.w1","zion_99","0000000000000000"]}"#,
            &mut ctx,
        );
        assert!(resp.contains("unknown job"), "resp={resp}");
    }

    /// P-01: resubmitting an identical (job, nonce) must not double-credit.
    #[test]
    fn rejects_replayed_share() {
        let server = make_server();
        let share_target = crate::vardiff::difficulty_to_target(1000);
        let share_target_hex = hex::encode(share_target);
        let header_bytes = vec![0u8; 80];
        let algo = zion_cosmic_harmony::EkamDeeksha::new();
        let nonce = zion_cosmic_harmony::PowAlgorithm::find_nonce(
            &algo,
            &header_bytes,
            0,
            100_000,
            &share_target,
        )
        .expect("nonce for difficulty 1000");
        let nonce_hex = format!("{:016x}", nonce.0);
        let header = hex::encode(&header_bytes);
        server.job_notification(
            "zion_1",
            &header,
            &share_target_hex,
            &share_target_hex,
            6_000_000,
            "",
        );
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","x"]}"#,
            &mut ctx,
        );
        let submit = format!(
            r#"{{"id":3,"method":"mining.submit","params":["zion1x.w1","zion_1","{}"]}}"#,
            nonce_hex
        );
        let resp = server.handle_request_with_ctx(&submit, &mut ctx);
        assert!(resp.contains("true"), "first submit: {resp}");
        let resp = server.handle_request_with_ctx(&submit, &mut ctx);
        assert!(
            resp.contains("duplicate") || resp.contains("share error"),
            "replay: {resp}"
        );
    }

    /// P-02: submits without authorize are rejected outright.
    #[test]
    fn rejects_unauthorized_submit() {
        let server = make_server();
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        let resp = server.handle_request_with_ctx(
            r#"{"id":3,"method":"mining.submit","params":["zion1x.w1","zion_1","00"]}"#,
            &mut ctx,
        );
        assert!(resp.contains("unauthorized"), "resp={resp}");
    }

    /// P-02: a submit carrying a different wallet than the authorized one is
    /// rejected — telemetry and credit must stay bound to the session.
    #[test]
    fn rejects_foreign_worker_submit() {
        let server = make_server();
        let mut ctx = StratumV1Ctx::new(0, &server.vardiff_config);
        server.handle_request_with_ctx(
            r#"{"id":2,"method":"mining.authorize","params":["zion1x.w1","x"]}"#,
            &mut ctx,
        );
        let resp = server.handle_request_with_ctx(
            r#"{"id":3,"method":"mining.submit","params":["zion1y.w1","zion_1","00"]}"#,
            &mut ctx,
        );
        assert!(resp.contains("worker not authorized"), "resp={resp}");
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

    // ── Phase C E2E: real TCP session + mock ZIS HTTP ──────────────────
    // NOTE: sync tests — `Notifier` inside `StratumServer` owns a
    // `reqwest::blocking::Client` whose internal runtime must not be
    // dropped inside an async context (see session_counters test), so
    // all async work runs inside `rt.block_on` on a dedicated thread and
    // the server is dropped there afterwards.

    /// Drive one full V3 session against `handle_v3_client`: spawn a mock
    /// ZIS when `zis_body` is Some, wire a StratumServer with a verifier,
    /// accept one TCP connection, send `hello_json` as the client, and
    /// return the first line the server sends back ("" on close).
    fn run_v3_zis_session(
        hello_json: &str,
        zis_body: Option<&'static str>,
        required: bool,
    ) -> String {
        let mut server = make_server();
        server.zis_required = required;
        let hello = hello_json.to_string();
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};

                if let Some(body) = zis_body {
                    let zl = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
                    let zaddr = zl.local_addr().unwrap();
                    let body = body.to_string();
                    tokio::spawn(async move {
                        if let Ok((mut s, _)) = zl.accept().await {
                            let mut buf = vec![0u8; 8192];
                            let _ = s.read(&mut buf).await;
                            let resp = format!(
                                "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                                body.len(),
                                body
                            );
                            let _ = s.write_all(resp.as_bytes()).await;
                        }
                    });
                    server.zis = Some(Arc::new(crate::zis::ZisVerifier::for_test(
                        format!("http://{zaddr}"),
                    )));
                }

                let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
                let addr = listener.local_addr().unwrap();
                let srv = Arc::new(server);
                let srv2 = srv.clone();
                let session = tokio::spawn(async move {
                    let Ok((sock, _)) = listener.accept().await else { return };
                    let (rd, wr) = tokio::io::split(sock);
                    let mut lines = BufReader::new(rd).lines();
                    let Ok(Some(first)) = lines.next_line().await else { return };
                    let writer = Arc::new(tokio::sync::Mutex::new(wr));
                    srv2.handle_v3_client(
                        &first,
                        &mut lines,
                        &writer,
                        "127.0.0.1".parse().unwrap(),
                    )
                    .await;
                });

                let mut client = tokio::net::TcpStream::connect(addr).await.unwrap();
                client
                    .write_all(format!("{hello}\n").as_bytes())
                    .await
                    .unwrap();
                let (crd, _cwr) = client.split();
                let mut reader = BufReader::new(crd);
                let mut line = String::new();
                let _ = tokio::time::timeout(
                    Duration::from_secs(5),
                    reader.read_line(&mut line),
                )
                .await;
                let _ = tx.send(line);
                drop(client);
                let _ = tokio::time::timeout(Duration::from_secs(3), session).await;
            });
            // `server` (Arc inside srv) drops here — dedicated thread,
            // outside any async context.
        });
        rx.recv_timeout(Duration::from_secs(10))
            .expect("v3 session produced no response")
    }

    #[test]
    fn v3_hello_zis_optional_binds_user() {
        let line = run_v3_zis_session(
            "{\"type\":\"hello\",\"miner_id\":\"zion1t\",\"worker_name\":\"zion1t.rig\",\"algorithm\":\"ekam_deeksha\",\"backend\":\"cpu\",\"auth_token\":\"zis_0123456789abcdef\"}",
            Some(r#"{"valid":true,"user":{"id":"u77","linkedAddresses":[{"address":"zion1linked","chainType":"zion-l1"}]}}"#),
            false,
        );
        let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(v["type"], "welcome");
        assert_eq!(v["zis_user"], "u77");
    }

    #[test]
    fn v3_hello_zis_optional_allows_anonymous() {
        // Mock ZIS is never contacted for tokenless sessions.
        let line = run_v3_zis_session(
            "{\"type\":\"hello\",\"miner_id\":\"zion1t\",\"worker_name\":\"zion1t.rig\",\"algorithm\":\"ekam_deeksha\",\"backend\":\"cpu\"}",
            Some(r#"{"valid":false}"#),
            false,
        );
        let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(v["type"], "welcome");
        assert_eq!(v["zis_user"], "");
    }

    #[test]
    fn v3_hello_zis_required_rejects_anonymous() {
        let line = run_v3_zis_session(
            "{\"type\":\"hello\",\"miner_id\":\"zion1t\",\"worker_name\":\"zion1t.rig\",\"algorithm\":\"ekam_deeksha\",\"backend\":\"cpu\"}",
            Some(r#"{"valid":false}"#),
            true,
        );
        assert!(line.is_empty(), "expected connection close, got {line:?}");
    }

    #[test]
    fn v3_hello_zis_required_rejects_invalid_token() {
        let line = run_v3_zis_session(
            "{\"type\":\"hello\",\"miner_id\":\"zion1t\",\"worker_name\":\"zion1t.rig\",\"algorithm\":\"ekam_deeksha\",\"backend\":\"cpu\",\"auth_token\":\"zis_badbadbadbadbadb\"}",
            Some(r#"{"error":"UNAUTHORIZED","message":"Invalid API key"}"#),
            true,
        );
        assert!(line.is_empty(), "expected connection close, got {line:?}");
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

    #[tokio::test]
    async fn run_with_shutdown_stops_accepting_on_signal() {
        let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default(), telemetry)));
        let server = StratumServer::new(pool);
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let (tx, rx) = tokio::sync::watch::channel(false);
        let task = tokio::spawn(async move { server.run_with_shutdown(listener, rx).await });

        // Connection is accepted while running.
        let sock = tokio::net::TcpStream::connect(addr).await.unwrap();
        assert!(sock.peer_addr().is_ok());
        drop(sock);

        // Fire the drain signal — the accept loop must return Ok.
        tx.send(true).unwrap();
        let res = tokio::time::timeout(Duration::from_secs(5), task)
            .await
            .expect("listener did not drain within 5s")
            .unwrap();
        assert!(res.is_ok());

        // And the port is closed for new sessions.
        assert!(tokio::net::TcpStream::connect(addr).await.is_err());
    }

    #[test]
    fn session_counters_shared_across_listeners() {
        // Primary port, extra ports and TLS each build their own
        // `StratumServer` — all must share the pool's counters so the HTTP
        // API sees the combined session/connection totals.
        let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default(), telemetry)));
        let primary = StratumServer::new(pool.clone());
        let extra = StratumServer::new(pool.clone());
        let tls = StratumServer::new(pool.clone());

        for server in [&primary, &extra, &tls] {
            assert!(Arc::ptr_eq(
                &server.session_counters.active_sessions,
                &pool.lock().unwrap().session_counters.active_sessions
            ));
            assert!(Arc::ptr_eq(
                &server.session_counters.total_connections,
                &pool.lock().unwrap().session_counters.total_connections
            ));
        }

        // A connection accepted by any listener is visible through the
        // shared pool counters.
        extra
            .session_counters
            .total_connections
            .fetch_add(1, Ordering::Relaxed);
        assert_eq!(
            pool.lock()
                .unwrap()
                .session_counters
                .total_connections
                .load(Ordering::Relaxed),
            1
        );
    }

    // NOTE: sync test — `Notifier` inside `StratumServer` owns a
    // `reqwest::blocking::Client` whose internal runtime must not be dropped
    // inside an async context, so the server runs on a dedicated thread.
    #[test]
    fn session_counters_track_connections() {
        use std::io::Write as _;

        let server = make_server();
        let counters = server.pool.lock().unwrap().session_counters.clone();
        let (addr_tx, addr_rx) = std::sync::mpsc::channel();
        let srv = server.clone();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
                addr_tx.send(listener.local_addr().unwrap()).unwrap();
                let _ = srv.run(listener).await;
            });
        });
        let addr = addr_rx.recv_timeout(Duration::from_secs(5)).unwrap();

        let mut stream = std::net::TcpStream::connect(addr).unwrap();
        stream
            .write_all(b"{\"id\":1,\"method\":\"mining.subscribe\",\"params\":[]}\n")
            .unwrap();

        let deadline = Instant::now() + Duration::from_secs(5);
        while counters.active_sessions.load(Ordering::Relaxed) == 0 {
            assert!(Instant::now() < deadline, "session not registered");
            std::thread::sleep(Duration::from_millis(10));
        }
        assert_eq!(counters.total_connections.load(Ordering::Relaxed), 1);
        assert_eq!(counters.active_sessions.load(Ordering::Relaxed), 1);

        drop(stream);
        let deadline = Instant::now() + Duration::from_secs(5);
        while counters.active_sessions.load(Ordering::Relaxed) != 0 {
            assert!(Instant::now() < deadline, "session not released");
            std::thread::sleep(Duration::from_millis(10));
        }
        assert_eq!(counters.total_connections.load(Ordering::Relaxed), 1);
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
                panic!(
                    "failed to parse template: {} at line {} col {}",
                    e,
                    e.line(),
                    e.column()
                );
            }
        }
    }

    fn push_ext_job(server: &StratumServer, coin: ExternalCoin, job_id: &str) {
        let (bridge, _rx) = crate::auxpow_bridge::AuxPowBridge::new(true);
        if !server.multi_bridge.contains(&coin) {
            server.multi_bridge.insert(coin, bridge.clone());
        }
        server.multi_bridge.push_job_for_coin(
            &coin,
            crate::auxpow_bridge::JobPackage {
                external_job_id: job_id.to_string(),
                coin,
                header_hex: "aabb".to_string(),
                target_hex: "00ff".to_string(),
                height: 1,
                algorithm: coin.algorithm().to_string(),
                extranonce1_hex: String::new(),
                ntime: "00000000".to_string(),
                seed_hash_hex: String::new(),
                eq_params: String::new(),
                eq_pers: String::new(),
                received_at: Some(Instant::now()),
            },
        );
    }

    fn broadcast_job_line(ext: Option<ExternalStreamJob>) -> String {
        encode_message(&PoolMessage::Job {
            job_id: 1,
            algorithm: "ekam_deeksha".into(),
            start_nonce: 0,
            nonce_count: 100,
            target_hex: "ff".repeat(64),
            header_hex: "00".repeat(64),
            height: 1,
            stream_weights: String::new(),
            external_stream: ext,
            external_stream_cpu: None,
            external_stream_2: None,
        })
        .unwrap()
    }

    #[test]
    fn glob_match_patterns() {
        assert!(glob_match("vega*", "vega-smos"));
        assert!(glob_match("*smos", "vega-smos"));
        assert!(glob_match("vega*smos", "vega-x-smos"));
        assert!(glob_match("vega-smos", "vega-smos"));
        assert!(glob_match("VEGA-SMOS", "vega-smos"));
        assert!(glob_match("*", "anything"));
        assert!(!glob_match("vega*", "rx5600"));
        assert!(!glob_match("*smos", "smos-rig"));
        assert!(!glob_match("vega", "vega-smos"));
        assert!(!glob_match("vega*smos", "vega-smo"));
    }

    #[test]
    fn coin_route_pref_resolution() {
        let routes = vec![
            ("vega*".to_string(), ExternalCoin::Zano),
            ("dest-zion*".to_string(), ExternalCoin::Quantus),
        ];
        // worker tail match: "wallet.vega-smos" → "vega-smos" → vega*
        assert_eq!(
            StratumServer::session_coin_pref(&routes, "wallet1", "wallet1.vega-smos"),
            Some(ExternalCoin::Zano)
        );
        assert_eq!(
            StratumServer::session_coin_pref(&routes, "wallet2", "wallet2.dest-zion"),
            Some(ExternalCoin::Quantus)
        );
        // miner_id match
        assert_eq!(
            StratumServer::session_coin_pref(&routes, "vega-farm", "other"),
            Some(ExternalCoin::Zano)
        );
        assert_eq!(
            StratumServer::session_coin_pref(&routes, "w", "unmatched"),
            None
        );
        assert_eq!(StratumServer::session_coin_pref(&[], "a", "b"), None);
    }

    #[test]
    fn external_stream_prefers_session_coin() {
        let server = make_server();
        push_ext_job(&server, ExternalCoin::Quantus, "qtu_job_1");
        push_ext_job(&server, ExternalCoin::Zano, "zano_job_1");
        push_ext_job(&server, ExternalCoin::Verus, "vrsc_job_1");

        // No preference: env default (unset in test) → first by ticker = QTU.
        let gpu = server.build_external_stream_gpu(None).unwrap();
        assert_eq!(gpu.coin, "QTU");
        assert_eq!(gpu.job_id, "qtu_job_1");
        // Session pinned to ZANO gets the ZANO job.
        let gpu = server
            .build_external_stream_gpu(Some(ExternalCoin::Zano))
            .unwrap();
        assert_eq!(gpu.coin, "ZANO");
        assert_eq!(gpu.job_id, "zano_job_1");
        // CPU stream picks the CPU coin; a GPU-coin pref is ignored there.
        let cpu = server
            .build_external_stream_cpu(Some(ExternalCoin::Zano))
            .unwrap();
        assert_eq!(cpu.coin, "VRSC");
        assert_eq!(cpu.job_id, "vrsc_job_1");
    }

    #[test]
    fn session_job_line_rewrites_external_stream() {
        let server = make_server();
        push_ext_job(&server, ExternalCoin::Quantus, "qtu_job_9");
        push_ext_job(&server, ExternalCoin::Zano, "zano_job_9");

        let line = broadcast_job_line(Some(ExternalStreamJob {
            coin: "QTU".into(),
            algorithm: "qpow-poseidon2".into(),
            job_id: "qtu_job_9".into(),
            header_hex: "aabb".into(),
            target_hex: "00ff".into(),
            height: 1,
            extranonce1_hex: String::new(),
            protocol: "stratum".into(),
            seed_hash_hex: String::new(),
            eq_params: String::new(),
            eq_pers: String::new(),
            timestamp: 0,
            ntime_hex: "00000000".into(),
        }));

        // Session pinned to ZANO: broadcast carries QTU → rewritten to ZANO.
        let out = server.session_job_line(&line, Some(ExternalCoin::Zano), None, None, 0);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["external_stream"]["coin"], "ZANO");
        assert_eq!(v["external_stream"]["job_id"], "zano_job_9");
        assert_eq!(v["external_stream"]["algorithm"], "progpow_zano");

        // Session pinned to the embedded coin: identical line passes through.
        let out = server.session_job_line(&line, Some(ExternalCoin::Quantus), None, None, 0);
        assert_eq!(out, line);

        // No prefs at all: byte-identical passthrough.
        let out = server.session_job_line(&line, None, None, None, 0);
        assert_eq!(out, line);

        // gpu2_pref=ZANO rewrites external_stream_2; gpu2_pref=QTU collides
        // with the embedded stream-1 coin → stream_2 nulled.
        let out = server.session_job_line(&line, None, None, Some(ExternalCoin::Zano), 0);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["external_stream_2"]["coin"], "ZANO");
        assert_eq!(v["external_stream_2"]["job_id"], "zano_job_9");
        let out = server.session_job_line(&line, None, None, Some(ExternalCoin::Quantus), 0);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert!(v["external_stream_2"].is_null());
    }

    #[test]
    fn session_job_line_stamps_nonce_window() {
        let server = make_server();
        let line = broadcast_job_line(None);
        // Nonzero base rewrites the broadcast's start_nonce=0 → each
        // session scans its own 2^32 window, never colliding shares.
        let out = server.session_job_line(&line, None, None, None, 0x1_0000_0000);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["start_nonce"].as_u64().unwrap(), 0x1_0000_0000);
        assert_eq!(v["nonce_count"].as_u64().unwrap(), 100);
        // Base 0 keeps the passthrough fast path byte-identical.
        assert_eq!(server.session_job_line(&line, None, None, None, 0), line);
    }

    #[test]
    fn session_job_line_nulls_stream_when_pref_coin_has_no_job() {
        let server = make_server();
        push_ext_job(&server, ExternalCoin::Quantus, "qtu_job_1");
        // ZANO routed but no ZANO bridge/job → stream nulled, not left as QTU.
        let line = broadcast_job_line(Some(ExternalStreamJob {
            coin: "QTU".into(),
            algorithm: "qpow-poseidon2".into(),
            job_id: "qtu_job_1".into(),
            header_hex: "aabb".into(),
            target_hex: "00ff".into(),
            height: 1,
            extranonce1_hex: String::new(),
            protocol: "stratum".into(),
            seed_hash_hex: String::new(),
            eq_params: String::new(),
            eq_pers: String::new(),
            timestamp: 0,
            ntime_hex: "00000000".into(),
        }));
        let out = server.session_job_line(&line, Some(ExternalCoin::Zano), None, None, 0);
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert!(v["external_stream"].is_null());
    }

    #[test]
    fn apply_coin_preference_slots_by_class() {
        let mut gpu = None;
        let mut cpu = None;
        let mut gpu2 = None;
        // A miner sending gpu_coin=VRSC (a CPU coin) lands on the CPU stream.
        StratumServer::apply_coin_preference(&mut gpu, &mut cpu, &mut gpu2, "VRSC", "QTU", "");
        assert_eq!(gpu, Some(ExternalCoin::Quantus));
        assert_eq!(cpu, Some(ExternalCoin::Verus));
        assert_eq!(gpu2, None);
        // gpu_coin_2 goes to the second GPU slot; a CPU coin there reroutes
        // to the CPU slot by class.
        StratumServer::apply_coin_preference(&mut gpu, &mut cpu, &mut gpu2, "", "", "ZANO");
        assert_eq!(gpu2, Some(ExternalCoin::Zano));
        // Unknown coins are ignored, prefs untouched.
        StratumServer::apply_coin_preference(&mut gpu, &mut cpu, &mut gpu2, "NOPE", "", "");
        assert_eq!(gpu, Some(ExternalCoin::Quantus));
        assert_eq!(cpu, Some(ExternalCoin::Verus));
        assert_eq!(gpu2, Some(ExternalCoin::Zano));
    }

    use crate::pearl::PearlJob;
    use crate::pearl_gateway::PearlRuntime;
    use std::thread;
    use tokio::net::TcpStream;
    use zion_miner::auxpow::pearl_pool::{PearlPoolClient, PearlPoolEvent};

    const PEARL_FIXTURE: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/pearl_cuda_live_share.json"
    ));
    const PEARL_BLOCK_TARGET: &str = "11576915460202502748112183870099358720600496688251011072";
    const PEARL_ISSUED_TARGET: &str =
        "22085588309729804119791218759286481447843548710945236976520077516157";
    const PEARL_SHARE_EASE: u64 = 1_907_726_491_192;
    const PEARL_SHARE_TARGET_HEX: &str =
        "00000000d1b71758e1a3c6c80000000000000000000000000000000000000000";

    fn pearl_fixture_parts() -> ([u8; 76], String) {
        let v: serde_json::Value = serde_json::from_str(PEARL_FIXTURE).unwrap();
        (
            hex::decode(v["header_hex"].as_str().unwrap())
                .unwrap()
                .try_into()
                .unwrap(),
            v["plain_proof_b64"].as_str().unwrap().to_string(),
        )
    }

    fn pearl_job(header: [u8; 76], target_dec: &str) -> (PearlJob, String) {
        use base64::Engine;
        let header_b64 = base64::engine::general_purpose::STANDARD.encode(header);
        (
            PearlJob {
                header,
                target: target_dec.parse().unwrap(),
                cert_version: 3,
                header_b64: header_b64.clone(),
                target_dec: target_dec.to_string(),
            },
            header_b64,
        )
    }

    fn pool_with_pearl(rt: Option<Arc<PearlRuntime>>) -> Arc<Mutex<Pool>> {
        let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(PoolConfig::default(), telemetry)));
        pool.lock().unwrap().pearl = rt;
        pool
    }

    fn spawn_pearl_mock_gateway(
        std_listener: std::net::TcpListener,
        header_b64: String,
        target_dec: String,
    ) -> Arc<std::sync::Mutex<Vec<String>>> {
        let calls = Arc::new(std::sync::Mutex::new(Vec::new()));
        let calls2 = calls.clone();
        tokio::spawn(async move {
            let gw = tokio::net::TcpListener::from_std(std_listener).unwrap();
            loop {
                let Ok((mut s, _)) = gw.accept().await else {
                    break;
                };
                let (r, mut w) = s.split();
                let mut br = BufReader::new(r);
                let mut line = String::new();
                if br.read_line(&mut line).await.is_err() {
                    continue;
                }
                let v: Value = serde_json::from_str(line.trim()).unwrap_or_default();
                calls2.lock().unwrap().push(line.trim().to_string());
                let resp = match v["method"].as_str() {
                    Some("getMiningInfo") => serde_json::json!({
                        "jsonrpc": "2.0", "id": v["id"],
                        "result": {"incomplete_header_bytes": header_b64, "target": target_dec, "cert_version": 3}
                    }),
                    Some("submitPlainProof") => {
                        serde_json::json!({"jsonrpc":"2.0","id":v["id"],"result":"submitted"})
                    }
                    _ => {
                        serde_json::json!({"jsonrpc":"2.0","id":v["id"],"error":{"code":-1,"message":"unknown"}})
                    }
                };
                let mut out = serde_json::to_string(&resp).unwrap();
                out.push('\n');
                if w.write_all(out.as_bytes()).await.is_err() {
                    break;
                }
            }
        });
        calls
    }

    #[test]
    fn pearl_stratum_end_to_end() {
        let (header, proof_b64) = pearl_fixture_parts();
        let (job, header_b64) = pearl_job(header, PEARL_BLOCK_TARGET);
        let job_id = PearlRuntime::job_id(&job);

        let gw_std = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        gw_std.set_nonblocking(true).unwrap();
        let gw_addr = gw_std.local_addr().unwrap().to_string();

        let rt = PearlRuntime::for_test(&gw_addr, PEARL_SHARE_EASE, 30_000, job);
        let pool = pool_with_pearl(Some(rt));
        let server1 = StratumServer::new(pool.clone());
        let server2 = StratumServer::new(pool.clone());
        assert!(
            Arc::ptr_eq(
                server1.pearl.as_ref().unwrap(),
                server2.pearl.as_ref().unwrap()
            ),
            "all StratumServer listeners on one Pool share one PearlRuntime"
        );
        let mut server = server1;
        server.pearl_stratum_enabled = true;

        let pool2 = pool.clone();
        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let gw_calls = spawn_pearl_mock_gateway(
                    gw_std,
                    header_b64.clone(),
                    PEARL_BLOCK_TARGET.to_string(),
                );

                let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
                let addr = listener.local_addr().unwrap();
                tokio::spawn(async move {
                    let _ = server.run(listener).await;
                });

                let mut client = PearlPoolClient::connect(
                    &addr.to_string(),
                    "prl1pzqqqqqqqqqqqqqqqqqqqqqqqq",
                    "rig0",
                    "x",
                )
                .await
                .unwrap();
                {
                    let pool = pool2.lock().unwrap();
                    let telemetry = pool.telemetry.lock().unwrap();
                    let entry = &telemetry.miners
                        ["prl1pzqqqqqqqqqqqqqqqqqqqqqqqq/prl1pzqqqqqqqqqqqqqqqqqqqqqqqq.rig0"];
                    assert_eq!(entry.algorithm, "pearlhash");
                    assert_eq!(entry.backend, "pearl-stratum");
                }

                let job = tokio::time::timeout(Duration::from_secs(5), async {
                    loop {
                        if let Some(j) = client.latest_job() {
                            break j;
                        }
                        client.next_event().await.unwrap();
                    }
                })
                .await
                .expect("mining.notify arrives");
                assert_eq!(job.job_id, job_id);
                assert_eq!(hex::encode(job.target_be), PEARL_SHARE_TARGET_HEX);
                assert_eq!(job.header, header);
                assert_eq!(job.cert_version, 3);
                assert_eq!(job.height, 0);

                let resp = client
                    .submit_proof(&job_id, &proof_b64, None)
                    .await
                    .unwrap();
                assert!(resp.accepted, "resp={:?}", resp.raw);
                assert_eq!(resp.id, 2);
                assert_eq!(pool2.lock().unwrap().pplns.stats().window_used, 1);

                let mut client2 = PearlPoolClient::connect(
                    &addr.to_string(),
                    "prl1pzqqqqqqqqqqqqqqqqqqqqqqq2",
                    "rig1",
                    "x",
                )
                .await
                .unwrap();
                let resp2 = client2
                    .submit_proof(&job_id, &proof_b64, None)
                    .await
                    .unwrap();
                assert!(!resp2.accepted, "resp={:?}", resp2.raw);
                assert_eq!(resp2.raw["error"]["message"], "duplicate");
                assert_eq!(pool2.lock().unwrap().pplns.stats().window_used, 1);

                let resp3 = client2
                    .submit_proof("stale-job", &proof_b64, None)
                    .await
                    .unwrap();
                assert!(!resp3.accepted);
                assert_eq!(resp3.raw["error"]["message"], "stale");
                let fresh = tokio::time::timeout(Duration::from_secs(5), async {
                    loop {
                        if let PearlPoolEvent::Job(j) = client2.next_event().await.unwrap() {
                            break j;
                        }
                    }
                })
                .await
                .expect("stale rejection pushes fresh notify");
                assert_eq!(fresh.job_id, job_id);

                let resp4 = client2.submit_proof(&job_id, "%%%", None).await.unwrap();
                assert!(!resp4.accepted);
                assert!(resp4.raw["error"]["message"]
                    .as_str()
                    .unwrap()
                    .starts_with("rejected:"));
                assert_eq!(pool2.lock().unwrap().pplns.stats().window_used, 1);

                let server3 = StratumServer::new(pool2.clone());
                let (ok3, status3) = server3
                    .process_pearl_submission(
                        "prl1pzqqqqqqqqqqqqqqqqqqqqqqqq",
                        "prl1pzqqqqqqqqqqqqqqqqqqqqqqqq.rig0",
                        &job_id,
                        &proof_b64,
                        None,
                    )
                    .await;
                assert!(!ok3);
                assert_eq!(status3, "duplicate");
                assert_eq!(pool2.lock().unwrap().pplns.stats().window_used, 1);

                tokio::time::sleep(Duration::from_millis(200)).await;
                let calls = gw_calls.lock().unwrap();
                assert!(
                    !calls.iter().any(|l| l.contains("submitPlainProof")),
                    "non-block share must not be forwarded: {calls:?}"
                );
            });
        });
        handle.join().unwrap();
    }

    #[test]
    fn pearl_block_candidate_forwards_to_gateway() {
        let (header, proof_b64) = pearl_fixture_parts();
        let (job, header_b64) = pearl_job(header, PEARL_ISSUED_TARGET);
        let job_id = PearlRuntime::job_id(&job);

        let gw_std = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        gw_std.set_nonblocking(true).unwrap();
        let gw_addr = gw_std.local_addr().unwrap().to_string();

        let rt = PearlRuntime::for_test(&gw_addr, 1, 30_000, job);
        let pool = pool_with_pearl(Some(rt));
        let server = StratumServer::new(pool.clone());

        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let gw_calls = spawn_pearl_mock_gateway(
                    gw_std,
                    header_b64.clone(),
                    PEARL_ISSUED_TARGET.to_string(),
                );

                let (ok, status) = server
                    .process_pearl_submission("miner", "miner.w", &job_id, &proof_b64, None)
                    .await;
                assert!(ok, "status={status}");
                assert_eq!(status, "accepted");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);

                let forwarded = tokio::time::timeout(Duration::from_secs(10), async {
                    loop {
                        if let Some(l) = gw_calls
                            .lock()
                            .unwrap()
                            .iter()
                            .find(|l| l.contains("submitPlainProof"))
                            .cloned()
                        {
                            break l;
                        }
                        tokio::time::sleep(Duration::from_millis(25)).await;
                    }
                })
                .await
                .expect("submitPlainProof forwarded");
                assert!(forwarded.contains(&proof_b64));
                assert!(forwarded.contains(&header_b64));
                assert!(
                    forwarded.contains(&format!("\"target\":{PEARL_ISSUED_TARGET}")),
                    "verbatim target digits in {forwarded}"
                );
                assert!(forwarded.contains("\"cert_version\":3"));

                let (ok2, status2) = server
                    .process_pearl_submission("miner2", "miner2.w", &job_id, &proof_b64, None)
                    .await;
                assert!(!ok2);
                assert_eq!(status2, "duplicate");
                tokio::time::sleep(Duration::from_millis(200)).await;
                let calls = gw_calls.lock().unwrap();
                assert_eq!(
                    calls
                        .iter()
                        .filter(|l| l.contains("submitPlainProof"))
                        .count(),
                    1
                );
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);
            });
        });
        handle.join().unwrap();
    }

    #[test]
    fn pearl_stratum_disabled_by_default_falls_to_v1() {
        let (header, _proof) = pearl_fixture_parts();
        let (job, _hb64) = pearl_job(header, PEARL_BLOCK_TARGET);
        let rt = PearlRuntime::for_test("127.0.0.1:1", PEARL_SHARE_EASE, 30_000, job);
        let pool = pool_with_pearl(Some(rt));
        let server = StratumServer::new(pool);
        assert!(!server.pearl_stratum_enabled);

        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
                let addr = listener.local_addr().unwrap();
                tokio::spawn(async move {
                    let _ = server.run(listener).await;
                });
                let stream = TcpStream::connect(addr).await.unwrap();
                let (r, mut w) = stream.into_split();
                let mut reader = BufReader::new(r);
                w.write_all(
                    br#"{"id":1,"method":"mining.authorize","params":{"wallet":"prl1X","worker":"r","agent":"a"}}"#
                        .as_slice(),
                )
                .await
                .unwrap();
                w.write_all(b"\n").await.unwrap();
                let mut line = String::new();
                tokio::time::timeout(Duration::from_secs(5), reader.read_line(&mut line))
                    .await
                    .unwrap()
                    .unwrap();
                let v: Value = serde_json::from_str(line.trim()).unwrap();
                assert_eq!(v["result"], json!(true), "V1 registers: {line}");

                w.write_all(
                    br#"{"id":2,"method":"mining.submit","params":{"job_id":"j","plain_proof":"AAAA"}}"#
                        .as_slice(),
                )
                .await
                .unwrap();
                w.write_all(b"\n").await.unwrap();
                line.clear();
                tokio::time::timeout(Duration::from_secs(5), reader.read_line(&mut line))
                    .await
                    .unwrap()
                    .unwrap();
                let v: Value = serde_json::from_str(line.trim()).unwrap();
                assert_ne!(v["result"], json!(true), "gate-off submit resp={line}");
                let err_text = v["error"].to_string();
                assert!(
                    !err_text.contains("pearl_not_enabled"),
                    "Pearl adapter must not run when gated off: {line}"
                );
            });
        });
        handle.join().unwrap();
    }

    #[test]
    fn pearl_stratum_without_runtime_rejects_cleanly() {
        let pool = pool_with_pearl(None);
        let mut server = StratumServer::new(pool);
        server.pearl_stratum_enabled = true;

        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
                let addr = listener.local_addr().unwrap();
                tokio::spawn(async move {
                    let _ = server.run(listener).await;
                });
                let err = PearlPoolClient::connect(
                    &addr.to_string(),
                    "prl1pzqqqqqqqqqqqqqqqqqqqqqqqq",
                    "rig0",
                    "x",
                )
                .await
                .err()
                .unwrap();
                assert!(
                    err.to_string().contains("pearl_not_enabled"),
                    "authorize error: {err:#}"
                );
            });
        });
        handle.join().unwrap();
    }

    #[tokio::test(start_paused = true)]
    async fn pearl_send_times_out_on_stalled_writer() {
        let (_read, write) = tokio::io::duplex(8);
        let writer = Arc::new(tokio::sync::Mutex::new(write));
        let line = "x".repeat(64 * 1024);
        let err = StratumServer::pearl_send(&writer, &line).await.unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::TimedOut);
    }

    #[test]
    fn pearl_v3_submit_shared_admission_and_coin_gate() {
        let (header, proof_b64) = pearl_fixture_parts();
        let (job, _hb64) = pearl_job(header, PEARL_BLOCK_TARGET);
        let job_id = PearlRuntime::job_id(&job);
        let rt = PearlRuntime::for_test("127.0.0.1:1", PEARL_SHARE_EASE, 30_000, job);
        let pool = pool_with_pearl(Some(rt));
        let server = StratumServer::new(pool.clone());

        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
                let addr = listener.local_addr().unwrap();
                tokio::spawn(async move {
                    while let Ok((socket, _)) = listener.accept().await {
                        let s = server.clone();
                        tokio::spawn(async move {
                            let (r, w) = tokio::io::split(socket);
                            let mut lines = BufReader::new(r).lines();
                            let writer = Arc::new(tokio::sync::Mutex::new(w));
                            let Ok(Some(first)) = lines.next_line().await else {
                                return;
                            };
                            s.handle_v3_client(
                                &first,
                                &mut lines,
                                &writer,
                                IpAddr::V4(std::net::Ipv4Addr::LOCALHOST),
                            )
                            .await;
                        });
                    }
                });

                let stream = TcpStream::connect(addr).await.unwrap();
                let (r, mut w) = stream.into_split();
                let mut reader = BufReader::new(r);
                let mut line = String::new();
                w.write_all(
                    br#"{"type":"hello","miner_id":"pearl-m","worker_name":"pearl-m.w1","algorithm":"ekam_deeksha","backend":"cpu"}"#
                        .as_slice(),
                )
                .await
                .unwrap();
                w.write_all(b"\n").await.unwrap();
                reader.read_line(&mut line).await.unwrap();
                assert!(line.contains("welcome"), "hello resp={line}");

                let submit = |coin: &str| {
                    crate::v3_protocol::encode_message(&PoolMessage::PearlSubmit {
                        miner_id: "pearl-m".to_string(),
                        worker_name: "pearl-m.w1".to_string(),
                        coin: coin.to_string(),
                        algorithm: "pearlhash".to_string(),
                        external_job_id: job_id.clone(),
                        hash_hex: String::new(),
                        plain_proof_b64: proof_b64.clone(),
                        mining_job_b64: String::new(),
                    })
                    .unwrap()
                };

                w.write_all(submit("QTU").as_bytes()).await.unwrap();
                line.clear();
                let got_ext = tokio::time::timeout(Duration::from_secs(10), async {
                    loop {
                        reader.read_line(&mut line).await.unwrap();
                        let v: Value = serde_json::from_str(line.trim()).unwrap();
                        if v["type"] == "external_result" {
                            break v;
                        }
                        line.clear();
                    }
                })
                .await
                .unwrap();
                assert_eq!(got_ext["accepted"], json!(false), "resp={got_ext}");
                assert_eq!(got_ext["status"], "unsupported_coin_or_algorithm");

                w.write_all(submit("PRL").as_bytes()).await.unwrap();
                let ok_ext = tokio::time::timeout(Duration::from_secs(10), async {
                    loop {
                        line.clear();
                        reader.read_line(&mut line).await.unwrap();
                        let v: Value = serde_json::from_str(line.trim()).unwrap();
                        if v["type"] == "external_result" {
                            break v;
                        }
                    }
                })
                .await
                .unwrap();
                assert_eq!(ok_ext["accepted"], json!(true), "resp={ok_ext}");
                assert_eq!(ok_ext["status"], "accepted");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);

                w.write_all(submit("PRL").as_bytes()).await.unwrap();
                let dup_ext = tokio::time::timeout(Duration::from_secs(10), async {
                    loop {
                        line.clear();
                        reader.read_line(&mut line).await.unwrap();
                        let v: Value = serde_json::from_str(line.trim()).unwrap();
                        if v["type"] == "external_result" {
                            break v;
                        }
                    }
                })
                .await
                .unwrap();
                assert_eq!(dup_ext["accepted"], json!(false), "resp={dup_ext}");
                assert_eq!(dup_ext["status"], "duplicate");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);
            });
        });
        handle.join().unwrap();
    }

    #[derive(Clone, Copy)]
    enum PearlUpVerdict {
        Accept,
        Reject(&'static str),
        Drop,
    }

    fn spawn_pearl_mock_upstream(
        std_listener: std::net::TcpListener,
        header: [u8; 76],
        verdict: PearlUpVerdict,
    ) -> Arc<std::sync::Mutex<Vec<String>>> {
        let calls = Arc::new(std::sync::Mutex::new(Vec::new()));
        let calls2 = calls.clone();
        tokio::spawn(async move {
            let listener = tokio::net::TcpListener::from_std(std_listener).unwrap();
            while let Ok((socket, _)) = listener.accept().await {
                let calls = calls2.clone();
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
                    let notify = format!(
                        "{}\n",
                        serde_json::json!({"jsonrpc":"2.0","method":"mining.notify","params":{
                            "job_id":"u-1",
                            "header":hex::encode(header),
                            "target":PEARL_SHARE_TARGET_HEX,
                            "height":7u64,
                            "cert_version":3u64,
                        }})
                    );
                    if w.write_all(notify.as_bytes()).await.is_err() {
                        return;
                    }
                    loop {
                        line.clear();
                        match br.read_line(&mut line).await {
                            Ok(0) | Err(_) => return,
                            Ok(_) => {
                                let v: Value =
                                    serde_json::from_str(line.trim()).unwrap_or_default();
                                if v["method"].as_str() != Some("mining.submit") {
                                    continue;
                                }
                                calls.lock().unwrap().push(line.trim().to_string());
                                let resp = match verdict {
                                    PearlUpVerdict::Accept => format!(
                                        "{{\"id\":{},\"result\":true,\"error\":null}}\n",
                                        v["id"]
                                    ),
                                    PearlUpVerdict::Reject(m) => format!(
                                        "{{\"id\":{},\"result\":false,\"error\":{{\"code\":-1,\"message\":\"{m}\"}}}}\n",
                                        v["id"]
                                    ),
                                    PearlUpVerdict::Drop => return,
                                };
                                if w.write_all(resp.as_bytes()).await.is_err() {
                                    return;
                                }
                            }
                        }
                    }
                });
            }
        });
        calls
    }

    async fn connected_pearl_upstream(
        header: [u8; 76],
        verdict: PearlUpVerdict,
    ) -> (
        Arc<crate::pearl_upstream::PearlUpstream>,
        Arc<std::sync::Mutex<Vec<String>>>,
    ) {
        let std_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        std_listener.set_nonblocking(true).unwrap();
        let addr = std_listener.local_addr().unwrap().to_string();
        let calls = spawn_pearl_mock_upstream(std_listener, header, verdict);
        let up =
            crate::pearl_upstream::PearlUpstream::new(crate::pearl_upstream::PearlUpstreamConfig {
                endpoint: addr,
                wallet: "prl1POOL".to_string(),
                worker: "zion-pool".to_string(),
                password: "x".to_string(),
                job_ttl: Duration::from_millis(90_000),
                fwd_max: Duration::from_millis(90_000),
                fwd_grace: None,
                ring_cap: crate::pearl_upstream::DEFAULT_JOB_RING_CAP,
            });
        assert!(up.ensure_started());
        tokio::time::timeout(Duration::from_secs(5), async {
            while up.latest_fresh().is_none() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("upstream notify arrives");
        (up, calls)
    }

    #[test]
    fn pearl_upstream_submit_accept_and_dedup() {
        let (header, proof_b64) = pearl_fixture_parts();
        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let (up, calls) = connected_pearl_upstream(header, PearlUpVerdict::Accept).await;
                let pearl = PearlRuntime::for_test_hybrid("", 256, 30_000, None, Some(up), 100);
                let pool = pool_with_pearl(Some(pearl));
                let server = StratumServer::new(pool.clone());

                let (ok0, status0) = server
                    .process_pearl_submission("miner", "miner.w", "prlu:ghost", &proof_b64, None)
                    .await;
                assert!(!ok0);
                assert_eq!(status0, "stale");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 0);

                let (ok, status) = server
                    .process_pearl_submission("miner", "miner.w", "prlu:u-1", &proof_b64, None)
                    .await;
                assert!(ok, "status={status}");
                assert_eq!(status, "accepted");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);

                let submits: Vec<String> = calls
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|l| l.contains("mining.submit"))
                    .cloned()
                    .collect();
                assert_eq!(submits.len(), 1);
                assert!(submits[0].contains("\"job_id\":\"u-1\""));
                assert!(!submits[0].contains("prlu:"));

                let (ok2, status2) = server
                    .process_pearl_submission("miner2", "miner2.w", "prlu:u-1", &proof_b64, None)
                    .await;
                assert!(!ok2);
                assert_eq!(status2, "duplicate");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);
            });
        });
        handle.join().unwrap();
    }

    #[test]
    fn pearl_upstream_submit_reject_no_credit() {
        let (header, proof_b64) = pearl_fixture_parts();
        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let (up, _calls) =
                    connected_pearl_upstream(header, PearlUpVerdict::Reject("low difficulty"))
                        .await;
                let pearl = PearlRuntime::for_test_hybrid("", 256, 30_000, None, Some(up), 100);
                let pool = pool_with_pearl(Some(pearl));
                let server = StratumServer::new(pool.clone());
                let (ok, status) = server
                    .process_pearl_submission("miner", "miner.w", "prlu:u-1", &proof_b64, None)
                    .await;
                assert!(!ok);
                assert_eq!(status, "rejected:low difficulty");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 0);
            });
        });
        handle.join().unwrap();
    }

    #[test]
    fn pearl_upstream_submit_drop_unknown_credits_once() {
        let (header, proof_b64) = pearl_fixture_parts();
        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let (up, _calls) = connected_pearl_upstream(header, PearlUpVerdict::Drop).await;
                let pearl = PearlRuntime::for_test_hybrid("", 256, 30_000, None, Some(up), 100);
                let pool = pool_with_pearl(Some(pearl));
                let server = StratumServer::new(pool.clone());
                let (ok, status) = server
                    .process_pearl_submission("miner", "miner.w", "prlu:u-1", &proof_b64, None)
                    .await;
                assert!(ok, "status={status}");
                assert_eq!(status, "accepted_unknown");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);
            });
        });
        handle.join().unwrap();
    }

    #[test]
    fn pearl_v3_submit_upstream_routes() {
        let (header, proof_b64) = pearl_fixture_parts();
        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            rt.block_on(async move {
                let (up, calls) = connected_pearl_upstream(header, PearlUpVerdict::Accept).await;
                let pearl = PearlRuntime::for_test_hybrid("", 256, 30_000, None, Some(up), 100);
                let pool = pool_with_pearl(Some(pearl));
                let server = StratumServer::new(pool.clone());

                let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
                let addr = listener.local_addr().unwrap();
                let srv = server.clone();
                tokio::spawn(async move {
                    while let Ok((socket, _)) = listener.accept().await {
                        let s = srv.clone();
                        tokio::spawn(async move {
                            let (r, w) = tokio::io::split(socket);
                            let mut lines = BufReader::new(r).lines();
                            let writer = Arc::new(tokio::sync::Mutex::new(w));
                            let Ok(Some(first)) = lines.next_line().await else {
                                return;
                            };
                            s.handle_v3_client(
                                &first,
                                &mut lines,
                                &writer,
                                IpAddr::V4(std::net::Ipv4Addr::LOCALHOST),
                            )
                            .await;
                        });
                    }
                });

                let stream = TcpStream::connect(addr).await.unwrap();
                let (r, mut w) = stream.into_split();
                let mut reader = BufReader::new(r);
                let mut line = String::new();
                w.write_all(
                    br#"{"type":"hello","miner_id":"pearl-u","worker_name":"pearl-u.w1","algorithm":"ekam_deeksha","backend":"cpu"}"#
                        .as_slice(),
                )
                .await
                .unwrap();
                w.write_all(b"\n").await.unwrap();
                reader.read_line(&mut line).await.unwrap();
                assert!(line.contains("welcome"), "hello resp={line}");

                let submit = crate::v3_protocol::encode_message(&PoolMessage::PearlSubmit {
                    miner_id: "pearl-u".to_string(),
                    worker_name: "pearl-u.w1".to_string(),
                    coin: "PRL".to_string(),
                    algorithm: "pearlhash".to_string(),
                    external_job_id: "prlu:u-1".to_string(),
                    hash_hex: String::new(),
                    plain_proof_b64: proof_b64.clone(),
                    mining_job_b64: String::new(),
                })
                .unwrap();
                w.write_all(submit.as_bytes()).await.unwrap();
                let got = tokio::time::timeout(Duration::from_secs(10), async {
                    loop {
                        line.clear();
                        reader.read_line(&mut line).await.unwrap();
                        let v: Value = serde_json::from_str(line.trim()).unwrap();
                        if v["type"] == "external_result" {
                            break v;
                        }
                    }
                })
                .await
                .unwrap();
                assert_eq!(got["accepted"], json!(true), "resp={got}");
                assert_eq!(got["status"], "accepted");
                assert_eq!(pool.lock().unwrap().pplns.stats().window_used, 1);
                let submits: Vec<String> = calls
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|l| l.contains("mining.submit"))
                    .cloned()
                    .collect();
                assert_eq!(submits.len(), 1);
                assert!(submits[0].contains("\"job_id\":\"u-1\""));
            });
        });
        handle.join().unwrap();
    }

    /// P-05 residual: only the two unverifiable accept statuses get the
    /// reduced credit weight; every other status is classified plainly.
    #[test]
    fn unverified_credit_classification() {
        assert!(!is_unverified_credit("accepted"));
        assert!(is_unverified_credit("accepted_unknown"));
        assert!(is_unverified_credit("accepted_stale_upstream"));
        // Rejects and protocol noise never classify as unverified credit.
        for s in [
            "duplicate",
            "below_target",
            "rejected:low difficulty",
            "not_connected",
            "timeout",
            "busy",
        ] {
            assert!(!is_unverified_credit(s), "{s} must not be unverified");
        }
    }

    #[test]
    fn unverified_credit_weight_pct_defaults_to_100() {
        // Env unset (tests run in the ambient suite env) → full weight.
        std::env::remove_var("ZION_POOL_UNVERIFIED_CREDIT_PCT");
        assert_eq!(unverified_credit_weight_pct(), 100);
        std::env::set_var("ZION_POOL_UNVERIFIED_CREDIT_PCT", "50");
        assert_eq!(unverified_credit_weight_pct(), 50);
        // Over-100 input clamps to 100 — never amplifies credit.
        std::env::set_var("ZION_POOL_UNVERIFIED_CREDIT_PCT", "140");
        assert_eq!(unverified_credit_weight_pct(), 100);
        std::env::set_var("ZION_POOL_UNVERIFIED_CREDIT_PCT", "junk");
        assert_eq!(unverified_credit_weight_pct(), 100);
        std::env::remove_var("ZION_POOL_UNVERIFIED_CREDIT_PCT");
    }
}
