use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};

use anyhow::Result;
use serde_json::json;
use tracing::{error, info, warn};

use crate::auxpow_bridge::MultiAuxPowBridge;
use crate::notifications::{NotificationsConfig, Notifier};
use crate::pool::Pool;
use crate::store::ShareStore;
use crate::telemetry::now_unix_seconds;
use zion_cosmic_harmony::ExternalCoin;

/// Per-IP sliding-window counter for the unauthenticated `/public/v1`
/// tier — `PUBLIC_RATE_LIMIT` requests per `PUBLIC_RATE_WINDOW_S` seconds.
const PUBLIC_RATE_LIMIT: u32 = 120;
const PUBLIC_RATE_WINDOW_S: u64 = 60;
const PUBLIC_RATE_TABLE_MAX: usize = 4096;
/// Auth-failure throttle for `/api` + `/admin`: repeated bad keys from one
/// client IP get the connection dropped rather than another 401.
const AUTH_FAIL_LIMIT: u32 = 20;
const AUTH_FAIL_WINDOW_S: u64 = 60;
/// Request-line and per-header caps — a peer that never sends '\n' must not
/// grow `read_line`'s buffer unboundedly.
const MAX_HTTP_LINE: u64 = 8 * 1024;
const MAX_HTTP_HEADERS: usize = 64;

/// History sampler cadence + retention: one sample per minute, 24h kept.
const HISTORY_INTERVAL_S: u64 = 60;
const HISTORY_CAP: usize = 24 * 60;
/// A miner counts as online for a coin when its last share is younger.
const ONLINE_WINDOW_S: u64 = 600;

/// Hard cap on concurrent API requests. Each connection is served on its
/// own OS thread — without a bound, a stalled backend piles up threads
/// until the process suffocates (seen live: 437 threads on a hung lock).
/// The accept loop sheds excess load with a fast 503 instead.
const API_MAX_IN_FLIGHT: usize = 64;
static API_IN_FLIGHT: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

/// RAII decrement for `API_IN_FLIGHT` — released when the handler thread
/// exits, on success or panic alike.
struct ApiPermit;
impl Drop for ApiPermit {
    fn drop(&mut self) {
        API_IN_FLIGHT.fetch_sub(1, Ordering::Relaxed);
    }
}

/// Periodic snapshot cache for the heavy read-only payloads. One refresher
/// thread rebuilds them; readers always get the last good build, so a
/// `pool`-starved build cycle can never park request threads (2026-10-28
/// wedge: a submit storm kept the mutex effectively held — /stats queued
/// behind it until every permit was gone). Readers clone an `Arc`, never
/// wait on `pool`.
#[derive(Default)]
struct PayloadSnapshots {
    stats: RwLock<Option<Arc<str>>>,
    metrics: RwLock<Option<Arc<str>>>,
    public_coins: RwLock<Option<Arc<str>>>,
}

/// Snapshot refresh cadence — `ZION_POOL_API_SNAPSHOT_MS` overrides.
const SNAPSHOT_INTERVAL_MS: u64 = 2_000;

fn write_http_response(
    stream: &mut TcpStream,
    status: &str,
    content_type: &str,
    body: &str,
) -> Result<()> {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes())?;
    Ok(())
}

/// One periodic pool snapshot for `/public/v1/history` and the
/// authenticated `/api/v1/hashrate-history` alias.
#[derive(Clone, serde::Serialize)]
struct HistorySample {
    ts: u64,
    /// Pool-wide live (10-minute trailing) hashrate — ZION leg only,
    /// external coins do not feed the estimator.
    hashrate: f64,
    /// Miners with a share on any stream inside the online window.
    miners_online: u64,
    /// Miners online per coin stream (e.g. {"zion": 3, "qtu": 1}).
    online_by_coin: std::collections::HashMap<String, u64>,
    /// Pool-wide live (10-minute trailing) hashrate per coin stream —
    /// external coins finally got a real series once shares started
    /// carrying expected-work samples (A1.1).
    #[serde(default)]
    hashrate_by_coin: std::collections::HashMap<String, f64>,
    /// Cumulative accepted/rejected share counters at sample time —
    /// per-interval deltas are derived client-side.
    accepted: u64,
    rejected: u64,
}

/// Per-miner history row drained to the store alongside each pool sample —
/// the persisted wallet-scoped hashrate timeseries behind
/// `/public/v1/miner/{coin}/{wallet}/history`.
struct MinerHistoryRow {
    miner_id: String,
    worker: String,
    /// `{coin: expected-hashes/sec}` for streams with recent work.
    hps: std::collections::HashMap<String, f64>,
    accepted: u64,
    rejected: u64,
}

pub struct PoolApi {
    pool: Arc<Mutex<Pool>>,
    share_store: Option<Arc<ShareStore>>,
    auxpow_bridge: Option<MultiAuxPowBridge>,
    routing_stats: Option<Arc<std::sync::Mutex<crate::routing::RoutingStats>>>,
    /// Shared block tracker (luck, pending, orphans) — same instance the
    /// stratum listeners write to.
    block_tracker: Option<Arc<std::sync::Mutex<crate::block_tracker::BlockTracker>>>,
    /// Latest broadcast ZION template height — for `est_per_block`.
    current_height: Option<Arc<std::sync::atomic::AtomicU64>>,
    /// Ring buffer of periodic pool snapshots (60s cadence, 24h cap).
    history: Arc<Mutex<std::collections::VecDeque<HistorySample>>>,
    /// `(window_start_s, count)` per client IP for `/public/v1` requests.
    public_rate: Mutex<std::collections::HashMap<std::net::IpAddr, (u64, u32)>>,
    /// `(window_start_s, failures)` per client IP for `/api` + `/admin`
    /// authentication failures.
    auth_fail_rate: Mutex<std::collections::HashMap<std::net::IpAddr, (u64, u32)>>,
    /// ZIS verifier for the `/public/v1/account/*` endpoints (A2.2/A2.3) —
    /// `verify_blocking` variant; shares the env config with the stratum's
    /// own verifier but keeps an independent cache.
    zis: crate::zis::ZisVerifier,
    /// Refreshed heavy-payload cache — `/stats`, `/metrics`,
    /// `/public/v1/coins` are served from it so a `pool`-lock starvation
    /// storm cannot park request threads.
    snapshots: PayloadSnapshots,
    started_at: Instant,
}

impl PoolApi {
    pub fn new(
        pool: Arc<Mutex<Pool>>,
        share_store: Option<Arc<ShareStore>>,
        auxpow_bridge: Option<MultiAuxPowBridge>,
    ) -> Self {
        // Restore persisted samples so a pool restart does not wipe the
        // public hashrate history series.
        let mut h = std::collections::VecDeque::with_capacity(HISTORY_CAP);
        if let Some(store) = &share_store {
            match store.load_history(HISTORY_CAP as u32) {
                Ok(rows) => {
                    for (ts, hashrate, miners_online, json, hbc_json, accepted, rejected) in rows {
                        let online_by_coin = serde_json::from_str(&json).unwrap_or_default();
                        let hashrate_by_coin = serde_json::from_str(&hbc_json).unwrap_or_default();
                        h.push_back(HistorySample {
                            ts,
                            hashrate,
                            miners_online,
                            online_by_coin,
                            hashrate_by_coin,
                            accepted,
                            rejected,
                        });
                    }
                    if !h.is_empty() {
                        info!("history: restored {} persisted samples", h.len());
                    }
                }
                Err(e) => warn!("history: restore failed: {e}"),
            }
        }
        // A2.3: restore persisted per-wallet payout threshold overrides into
        // the engine — the share store is the source of truth across restarts.
        if let Some(store) = &share_store {
            match store.load_payout_overrides() {
                Ok(overrides) if !overrides.is_empty() => {
                    let n = overrides.len();
                    pool.lock()
                        .expect("pool lock poisoned")
                        .pplns
                        .set_payout_overrides(overrides);
                    info!("miner_settings: restored {n} payout overrides");
                }
                Ok(_) => {}
                Err(e) => warn!("miner_settings: restore failed: {e}"),
            }
        }
        Self {
            pool,
            share_store,
            auxpow_bridge,
            routing_stats: None,
            block_tracker: None,
            current_height: None,
            history: Arc::new(Mutex::new(h)),
            public_rate: Mutex::new(std::collections::HashMap::new()),
            auth_fail_rate: Mutex::new(std::collections::HashMap::new()),
            zis: crate::zis::ZisVerifier::from_env(),
            snapshots: PayloadSnapshots::default(),
            started_at: Instant::now(),
        }
    }

    /// `true` when the IP is over the public-tier rate limit.  The table is
    /// bounded — a flood of spoofed sources stops tracking rather than
    /// growing memory without limit.
    fn public_rate_limited(&self, ip: std::net::IpAddr) -> bool {
        let now_s = now_unix_seconds();
        let mut table = self.public_rate.lock().expect("rate lock poisoned");
        if table.len() >= PUBLIC_RATE_TABLE_MAX && !table.contains_key(&ip) {
            return true; // table full — fail closed for new IPs
        }
        let entry = table.entry(ip).or_insert((now_s, 0));
        if now_s.saturating_sub(entry.0) >= PUBLIC_RATE_WINDOW_S {
            *entry = (now_s, 0);
        }
        entry.1 = entry.1.saturating_add(1);
        let over = entry.1 > PUBLIC_RATE_LIMIT;
        if table.len() > PUBLIC_RATE_TABLE_MAX / 2 {
            // Opportunistic GC — drop expired windows so the cap rarely binds.
            table.retain(|_, (start, _)| now_s.saturating_sub(*start) < PUBLIC_RATE_WINDOW_S);
        }
        over
    }

    pub fn with_routing_stats(
        mut self,
        stats: Arc<std::sync::Mutex<crate::routing::RoutingStats>>,
    ) -> Self {
        self.routing_stats = Some(stats);
        self
    }

    /// Attach the shared `BlockTracker` (luck, pending, orphans).
    pub fn with_block_tracker(
        mut self,
        tracker: Arc<std::sync::Mutex<crate::block_tracker::BlockTracker>>,
    ) -> Self {
        self.block_tracker = Some(tracker);
        self
    }

    /// Attach the shared template-height counter for `est_per_block`.
    pub fn with_current_height(mut self, height: Arc<std::sync::atomic::AtomicU64>) -> Self {
        self.current_height = Some(height);
        self
    }

    /// Snapshot of luck/orphan counters shared with the stratum listeners.
    fn block_tracker_json(&self) -> serde_json::Value {
        let Some(ref t) = self.block_tracker else {
            return serde_json::Value::Null;
        };
        let s = match t.try_lock() {
            Ok(g) => g.stats(),
            Err(_) => return serde_json::Value::Null,
        };
        json!({
            "found": s.total_blocks,
            "confirmed": s.total_confirmed,
            "orphaned": s.total_orphans,
            "pending": s.pending_count,
            "luck_100": s.pool_luck_100,
            "luck_500": s.pool_luck_500,
        })
    }

    /// Serve HTTP requests. Each connection is handled on its own thread so a
    /// single stalled request (slow client, contended internal lock) can never
    /// freeze the whole API — the dashboard and Prometheus must keep working
    /// even when one handler is stuck.
    pub fn serve(self: Arc<Self>, bind_addr: &str) -> Result<()> {
        let listener = TcpListener::bind(bind_addr)?;
        info!("pool API listening on {bind_addr}");

        // History sampler — one snapshot per HISTORY_INTERVAL_S, ring
        // buffer capped at HISTORY_CAP (24h).  Persisted to the share store
        // when available so a restart keeps the last day of samples.
        {
            let pool = Arc::clone(&self.pool);
            let history = Arc::clone(&self.history);
            let store = self.share_store.clone();
            std::thread::spawn(move || loop {
                let (sample, miner_rows) = sample_history(&pool);
                if let Some(store) = &store {
                    let json = serde_json::to_string(&sample.online_by_coin)
                        .unwrap_or_else(|_| "{}".to_string());
                    let hbc_json = serde_json::to_string(&sample.hashrate_by_coin)
                        .unwrap_or_else(|_| "{}".to_string());
                    let retain = HISTORY_INTERVAL_S * HISTORY_CAP as u64;
                    if let Err(e) = store.record_history_sample(
                        sample.ts,
                        sample.hashrate,
                        sample.miners_online,
                        &json,
                        &hbc_json,
                        sample.accepted,
                        sample.rejected,
                        retain,
                    ) {
                        warn!("history: persist failed: {e}");
                    }
                    for row in &miner_rows {
                        let hps_json =
                            serde_json::to_string(&row.hps).unwrap_or_else(|_| "{}".to_string());
                        if let Err(e) = store.record_miner_history_sample(
                            &row.miner_id,
                            &row.worker,
                            sample.ts,
                            &hps_json,
                            row.accepted,
                            row.rejected,
                            retain,
                        ) {
                            warn!("miner_history: persist failed: {e}");
                            break; // one store error → stop hammering this round
                        }
                    }
                }
                let mut h = history.lock().expect("history lock poisoned");
                if h.len() >= HISTORY_CAP {
                    h.pop_front();
                }
                h.push_back(sample);
                drop(h);
                std::thread::sleep(Duration::from_secs(HISTORY_INTERVAL_S));
            });
        }

        // A2.2 offline-worker watcher — evaluate persisted alert
        // subscriptions against live last-seen data once a minute and emit
        // transition notifications (dedup via `alert_subscriptions.state`).
        {
            let pool = Arc::clone(&self.pool);
            let store = self.share_store.clone();
            std::thread::spawn(move || {
                let notifier = Notifier::new(NotificationsConfig::from_env());
                // Boot grace — miners need a moment to reconnect before any
                // subscription can be judged offline.
                std::thread::sleep(Duration::from_secs(60));
                loop {
                    if let Some(store) = &store {
                        check_alert_subscriptions(&pool, store, &notifier);
                    }
                    std::thread::sleep(Duration::from_secs(60));
                }
            });
        }

        // Snapshot refresher — rebuilds the heavy read-only payloads on a
        // fixed cadence so request threads never build them inline. If the
        // `pool` mutex starves under a share storm, this one thread simply
        // produces staler snapshots; `/stats`, `/metrics` and
        // `/public/v1/coins` keep answering from the last good build.
        {
            let api = Arc::clone(&self);
            let interval_ms = std::env::var("ZION_POOL_API_SNAPSHOT_MS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(SNAPSHOT_INTERVAL_MS)
                .max(250);
            std::thread::Builder::new()
                .name("api-snapshot".to_string())
                .spawn(move || loop {
                    api.refresh_snapshots();
                    std::thread::sleep(Duration::from_millis(interval_ms));
                })
                .map_err(|e| {
                    error!("api-snapshot thread spawn failed: {e}");
                    e
                })?;
        }

        for stream in listener.incoming() {
            let stream = match stream {
                Ok(s) => s,
                Err(e) => {
                    error!("pool_api_accept_error={e}");
                    continue;
                }
            };
            let prev = API_IN_FLIGHT.fetch_add(1, Ordering::Relaxed);
            if prev >= API_MAX_IN_FLIGHT {
                API_IN_FLIGHT.fetch_sub(1, Ordering::Relaxed);
                warn!("pool_api_shed_load in_flight={prev}");
                let mut s = stream;
                let _ = s.write_all(
                    b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
                );
                continue;
            }
            let api = Arc::clone(&self);
            std::thread::spawn(move || {
                let _permit = ApiPermit;
                if let Err(e) = api.handle_request(stream) {
                    error!("pool_api_handle_error={e}");
                }
            });
        }
        Ok(())
    }

    /// Resolve the effective client IP.  Pool API traffic arrives through
    /// the edge2→edge SSH tunnel and nginx, so `peer_addr` is always
    /// loopback — for a loopback peer the first `X-Forwarded-For` hop (or
    /// `X-Real-IP`) is the real client; a non-loopback peer is keyed on its
    /// own address and XFF is ignored (untrusted when directly connected).
    fn client_ip(
        &self,
        stream: &TcpStream,
        xff: Option<&str>,
        x_real_ip: Option<&str>,
    ) -> std::net::IpAddr {
        let peer = stream
            .peer_addr()
            .map(|a| a.ip())
            .unwrap_or(std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED));
        if !peer.is_loopback() {
            return peer;
        }
        xff.and_then(|v| v.split(',').next())
            .map(str::trim)
            .or(x_real_ip.map(str::trim))
            .and_then(|s| s.parse::<std::net::IpAddr>().ok())
            .unwrap_or(peer)
    }

    /// `true` when this IP exhausted its auth-failure budget — the caller
    /// then drops the connection without another response.
    fn auth_fail_limited(&self, ip: std::net::IpAddr) -> bool {
        let now_s = now_unix_seconds();
        let mut table = self.auth_fail_rate.lock().expect("auth-fail lock poisoned");
        if let Some((start, count)) = table.get(&ip) {
            if now_s.saturating_sub(*start) < AUTH_FAIL_WINDOW_S && *count >= AUTH_FAIL_LIMIT {
                return true;
            }
        }
        if table.len() > PUBLIC_RATE_TABLE_MAX / 2 {
            table.retain(|_, (start, _)| now_s.saturating_sub(*start) < AUTH_FAIL_WINDOW_S);
        }
        false
    }

    fn note_auth_failure(&self, ip: std::net::IpAddr) {
        let now_s = now_unix_seconds();
        let mut table = self.auth_fail_rate.lock().expect("auth-fail lock poisoned");
        let entry = table.entry(ip).or_insert((now_s, 0));
        if now_s.saturating_sub(entry.0) >= AUTH_FAIL_WINDOW_S {
            *entry = (now_s, 0);
        }
        entry.1 = entry.1.saturating_add(1);
    }

    fn handle_request(&self, mut stream: TcpStream) -> Result<()> {
        // Bound all socket I/O so a connect-and-stall client cannot hold this
        // handler (and its thread) forever.
        let io_timeout = Duration::from_secs(10);
        let _ = stream.set_read_timeout(Some(io_timeout));
        let _ = stream.set_write_timeout(Some(io_timeout));
        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        // Bounded line read — an over-long or never-terminated request line
        // is truncated rather than growing the buffer without limit.
        match reader
            .by_ref()
            .take(MAX_HTTP_LINE)
            .read_line(&mut request_line)
        {
            Ok(0) | Err(_) => return Ok(()),
            Ok(_) => {}
        }
        let parts: Vec<&str> = request_line.split_whitespace().collect();
        let method = *parts.first().unwrap_or(&"GET");
        let raw_path = *parts.get(1).unwrap_or(&"/stats");
        let path = raw_path.split('?').next().unwrap_or(raw_path);

        let mut content_length = 0usize;
        let mut api_key_header = None;
        let mut admin_key_header = None;
        let mut auth_bearer = None;
        let mut xff: Option<String> = None;
        let mut x_real_ip: Option<String> = None;
        for _ in 0..MAX_HTTP_HEADERS {
            let mut header = String::new();
            match reader.by_ref().take(MAX_HTTP_LINE).read_line(&mut header) {
                Ok(0) | Err(_) => break,
                Ok(_) => {}
            }
            if header.trim().is_empty() {
                break;
            }
            let trimmed = header.trim();
            if let Some(val) = trimmed
                .strip_prefix("Content-Length:")
                .or_else(|| trimmed.strip_prefix("content-length:"))
            {
                content_length = val.trim().parse().unwrap_or(0);
            } else if let Some(val) = trimmed
                .strip_prefix("X-API-Key:")
                .or_else(|| trimmed.strip_prefix("x-api-key:"))
            {
                api_key_header = Some(val.trim().to_string());
            } else if let Some(val) = trimmed
                .strip_prefix("X-Admin-Key:")
                .or_else(|| trimmed.strip_prefix("x-admin-key:"))
            {
                admin_key_header = Some(val.trim().to_string());
            } else if let Some(val) = trimmed
                .strip_prefix("Authorization:")
                .or_else(|| trimmed.strip_prefix("authorization:"))
            {
                if let Some(token) = val.trim().strip_prefix("Bearer ") {
                    auth_bearer = Some(token.to_string());
                }
            } else if let Some(val) = trimmed
                .strip_prefix("X-Forwarded-For:")
                .or_else(|| trimmed.strip_prefix("x-forwarded-for:"))
            {
                xff = Some(val.trim().to_string());
            } else if let Some(val) = trimmed
                .strip_prefix("X-Real-IP:")
                .or_else(|| trimmed.strip_prefix("x-real-ip:"))
            {
                x_real_ip = Some(val.trim().to_string());
            }
        }

        let client_ip = self.client_ip(&stream, xff.as_deref(), x_real_ip.as_deref());

        // Throttled auth abusers get dropped before any further processing —
        // avoids handing them unlimited oracle 401s forever.
        if self.auth_fail_limited(client_ip) {
            return Ok(());
        }

        // Rate-limit the unauthenticated public tier per real client IP.
        if path.starts_with("/public/v1") && self.public_rate_limited(client_ip) {
            let body = "{\"ok\":false,\"error\":\"rate limited\"}";
            let _ = write!(stream,
                "HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                body.len(), body);
            return Ok(());
        }
        let mut request_body = String::new();
        if method == "POST" && content_length > 0 {
            // Cap body size — the API only needs small JSON payloads and an
            // unbounded allocation here is an easy OOM footgun.
            let mut buf = vec![0u8; content_length.min(1 << 20)];
            if reader.read_exact(&mut buf).is_ok() {
                request_body = String::from_utf8_lossy(&buf).into_owned();
            }
        }

        // API key authorization for /api/* and admin endpoints. Only paths
        // that actually require auth take the pool lock — /health and other
        // public endpoints must stay reachable even when a lock is contended.
        if path.starts_with("/admin") || path.starts_with("/api") {
            let (api_key, admin_key) = {
                let pool = self.pool.lock().expect("pool lock poisoned");
                (pool.config.api_key.clone(), pool.config.admin_key.clone())
            };

            let ok = if path.starts_with("/admin") {
                admin_key.as_deref().is_some()
                    && (admin_key_header.as_deref() == admin_key.as_deref()
                        || auth_bearer.as_deref() == admin_key.as_deref())
            } else {
                // POL-004 fix: default-deny. If no API key is configured, reject
                // all /api/* requests rather than leaving them open.
                api_key.as_deref().is_some()
                    && (api_key_header.as_deref() == api_key.as_deref()
                        || auth_bearer.as_deref() == api_key.as_deref())
            };
            if !ok {
                self.note_auth_failure(client_ip);
                let body = "{\"ok\":false,\"error\":\"unauthorized\"}";
                let response = format!(
                    "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                stream.write_all(response.as_bytes())?;
                return Ok(());
            }
        }

        // ---- /api/v1/state/* — authenticated HA state export (A4.2) ----
        // Raw byte streams (not JSON) so the EDGE2 standby can pull
        // byte-identical state files. /api auth already ran above.
        if path.starts_with("/api/v1/state/") {
            self.respond_state_export(&mut stream, path)?;
            return Ok(());
        }

        // ---- /public/v1/account — ZIS-authed miner settings (A2.2/A2.3) ----
        // Write-capable public tier: the zis token IS the auth (verified
        // against the identity service); wallet must be a linked address.
        if path.starts_with("/public/v1/account") {
            let (status, body) = if method != "POST" {
                (
                    "405 Method Not Allowed",
                    "{\"ok\":false,\"error\":\"POST required\"}".to_string(),
                )
            } else {
                self.handle_account_request(path, &request_body, client_ip)
            };
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes())?;
            return Ok(());
        }

        let (status, content_type, body) = match path {
            "/health" => {
                let uptime_s = self.started_at.elapsed().as_secs();
                let body = format!(
                    "{{\"status\":\"ok\",\"uptime_s\":{uptime_s},\"build\":\"{}\"}}",
                    env!("ZION_BUILD_ID")
                );
                ("200 OK", "application/json", body)
            }
            "/metrics" => {
                let body = Self::snapshot_or(&self.snapshots.metrics, || {
                    self.build_prometheus_payload()
                });
                ("200 OK", "text/plain; version=0.0.4", body)
            }
            p if p == "/stats" || p == "/" || p == "/pool" => {
                let body = Self::snapshot_or(&self.snapshots.stats, || self.build_stats_payload());
                ("200 OK", "application/json", body)
            }
            p if p.starts_with("/miners") => {
                let limit = parse_query_limit(raw_path, 200);
                let body = self.build_miners_payload(limit as usize);
                ("200 OK", "application/json", body)
            }
            // ---- /public/v1 — unauthenticated public read tier (F4) ----
            // No key required; exposes only wallet-scoped public data.
            // Never leak: internal leg addresses/ports, upstream worker
            // names, wallet-key existence, anything admin.
            "/public/v1/coins" => {
                let body = Self::snapshot_or(&self.snapshots.public_coins, || {
                    self.build_public_coins_payload()
                });
                ("200 OK", "application/json", body)
            }
            "/public/v1/history" => {
                let limit = parse_query_limit(raw_path, HISTORY_CAP as u32) as usize;
                let body = self.build_history_payload(limit);
                ("200 OK", "application/json", body)
            }
            p if p.starts_with("/public/v1/coins/") && p.ends_with("/stats") => {
                let coin = p
                    .trim_start_matches("/public/v1/coins/")
                    .trim_end_matches("/stats")
                    .trim_matches('/');
                let body = self.build_public_coin_stats_payload(coin);
                ("200 OK", "application/json", body)
            }
            p if p.starts_with("/public/v1/coins/") && p.ends_with("/blocks") => {
                let coin = p
                    .trim_start_matches("/public/v1/coins/")
                    .trim_end_matches("/blocks")
                    .trim_matches('/');
                let limit = parse_query_limit(raw_path, 50);
                match &self.share_store {
                    Some(store) => {
                        let blocks = store.query_blocks_for_coin(coin, limit).unwrap_or_default();
                        let body = json!({
                            "ok": true,
                            "coin": coin,
                            "tip": self.current_height.as_ref()
                                .map(|h| h.load(Ordering::Relaxed)),
                            "blocks": serialize_public_blocks_json(&blocks),
                        })
                        .to_string();
                        ("200 OK", "application/json", body)
                    }
                    None => (
                        "503 Service Unavailable",
                        "application/json",
                        "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
                    ),
                }
            }
            p if p.starts_with("/public/v1/miner/") && p.ends_with("/payouts") => {
                let parts: Vec<&str> = p
                    .trim_start_matches("/public/v1/miner/")
                    .split('/')
                    .collect();
                let (coin, wallet) = (
                    parts.first().copied().unwrap_or(""),
                    parts.get(1).copied().unwrap_or(""),
                );
                let limit = parse_query_limit(raw_path, 50);
                match &self.share_store {
                    Some(store) => {
                        let payouts: Vec<_> = store
                            .query_payouts_by_address(wallet, limit * 4)
                            .unwrap_or_default()
                            .into_iter()
                            .filter(|r| r.coin == coin || coin.is_empty())
                            .take(limit as usize)
                            .collect();
                        let mut rows = queued_payouts_snapshot(&self.pool, coin, Some(wallet));
                        if let serde_json::Value::Array(db) =
                            serialize_public_payouts_json(&payouts)
                        {
                            rows.extend(db);
                        }
                        rows.truncate(limit as usize);
                        let body = json!({
                            "ok": true,
                            "coin": coin,
                            "wallet": wallet,
                            "payouts": rows,
                        })
                        .to_string();
                        ("200 OK", "application/json", body)
                    }
                    None => (
                        "503 Service Unavailable",
                        "application/json",
                        "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
                    ),
                }
            }
            p if p.starts_with("/public/v1/miner/") && p.ends_with("/history") => {
                let parts: Vec<&str> = p
                    .trim_start_matches("/public/v1/miner/")
                    .trim_end_matches("/history")
                    .split('/')
                    .collect();
                let (coin, wallet) = (
                    parts.first().copied().unwrap_or(""),
                    parts.get(1).copied().unwrap_or(""),
                );
                let limit = parse_query_limit(raw_path, HISTORY_CAP as u32) as usize;
                let worker = parse_query_param(raw_path, "worker");
                match &self.share_store {
                    Some(_) => {
                        let body = self.build_public_miner_history(coin, wallet, limit, worker);
                        ("200 OK", "application/json", body)
                    }
                    None => (
                        "503 Service Unavailable",
                        "application/json",
                        "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
                    ),
                }
            }
            p if p.starts_with("/public/v1/miner/") => {
                let parts: Vec<&str> = p
                    .trim_start_matches("/public/v1/miner/")
                    .split('/')
                    .collect();
                let (coin, wallet) = (
                    parts.first().copied().unwrap_or(""),
                    parts.get(1).copied().unwrap_or(""),
                );
                let body = self.build_public_miner_payload(coin, wallet);
                ("200 OK", "application/json", body)
            }
            "/public/v1/blocks" => {
                let coin = parse_query_param(raw_path, "coin").unwrap_or_default();
                let limit = parse_query_limit(raw_path, 50);
                match &self.share_store {
                    Some(store) => {
                        let blocks = if coin.is_empty() {
                            store.query_blocks(limit).unwrap_or_default()
                        } else {
                            store
                                .query_blocks_for_coin(&coin, limit)
                                .unwrap_or_default()
                        };
                        let body = json!({
                            "ok": true,
                            "tip": self.current_height.as_ref()
                                .map(|h| h.load(Ordering::Relaxed)),
                            "blocks": serialize_public_blocks_json(&blocks),
                        })
                        .to_string();
                        ("200 OK", "application/json", body)
                    }
                    None => (
                        "503 Service Unavailable",
                        "application/json",
                        "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
                    ),
                }
            }
            "/public/v1/payouts" => {
                let coin = parse_query_param(raw_path, "coin").unwrap_or_default();
                let limit = parse_query_limit(raw_path, 50);
                match &self.share_store {
                    Some(store) => {
                        let payouts: Vec<_> = store
                            .query_all_payouts(limit * 4)
                            .unwrap_or_default()
                            .into_iter()
                            .filter(|r| coin.is_empty() || r.coin == coin)
                            .take(limit as usize)
                            .collect();
                        let mut rows = queued_payouts_snapshot(&self.pool, &coin, None);
                        if let serde_json::Value::Array(db) =
                            serialize_public_payouts_json(&payouts)
                        {
                            rows.extend(db);
                        }
                        rows.truncate(limit as usize);
                        let body = json!({
                            "ok": true,
                            "payouts": rows,
                        })
                        .to_string();
                        ("200 OK", "application/json", body)
                    }
                    None => (
                        "503 Service Unavailable",
                        "application/json",
                        "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
                    ),
                }
            }
            "/api/v1/blocks" => {
                let limit = parse_query_limit(raw_path, 50);
                match &self.share_store {
                    Some(store) => {
                        let blocks = store.query_blocks(limit).unwrap_or_default();
                        let body = serialize_blocks_json(&blocks);
                        ("200 OK", "application/json", body)
                    }
                    None => {
                        let body = "{\"ok\":false,\"error\":\"database not configured\"}";
                        (
                            "503 Service Unavailable",
                            "application/json",
                            body.to_string(),
                        )
                    }
                }
            }
            "/api/v1/payouts" => {
                let (miner_filter, limit) = parse_query_miner_limit(raw_path, 50);
                match &self.share_store {
                    Some(store) => {
                        let payouts = if let Some(miner) = miner_filter.as_deref() {
                            store.query_payouts(miner, limit).unwrap_or_default()
                        } else {
                            store.query_all_payouts(limit).unwrap_or_default()
                        };
                        let body = serialize_payouts_json(&payouts);
                        ("200 OK", "application/json", body)
                    }
                    None => {
                        let body = "{\"ok\":false,\"error\":\"database not configured\"}";
                        (
                            "503 Service Unavailable",
                            "application/json",
                            body.to_string(),
                        )
                    }
                }
            }
            "/api/v1/miners" => {
                let limit = parse_query_limit(raw_path, 100);
                match &self.share_store {
                    Some(store) => {
                        let miners = store.query_all_miners(limit).unwrap_or_default();
                        let count = store.miner_count().unwrap_or(0);
                        let body = serialize_miners_json(&miners, count);
                        ("200 OK", "application/json", body)
                    }
                    None => {
                        let body = "{\"ok\":false,\"error\":\"database not configured\"}";
                        (
                            "503 Service Unavailable",
                            "application/json",
                            body.to_string(),
                        )
                    }
                }
            }
            "/api/v1/pplns" => {
                let body = self.build_pplns_payload();
                ("200 OK", "application/json", body)
            }
            "/api/v1/auxpow" => {
                let body = self.build_auxpow_payload();
                ("200 OK", "application/json", body)
            }
            "/api/v1/profit-switch" => {
                let body = self.build_profit_switch_payload();
                ("200 OK", "application/json", body)
            }
            "/api/v1/stream-profit" => {
                let body = self.build_stream_profit_payload();
                ("200 OK", "application/json", body)
            }
            "/api/v1/hashrate-history" => {
                let limit = parse_query_limit(raw_path, 168) as usize;
                let body = self.build_hashrate_history_payload(limit);
                ("200 OK", "application/json", body)
            }
            "/api/v1/revenue-stats" => {
                let body = self.build_revenue_stats_payload();
                ("200 OK", "application/json", body)
            }
            "/api/v1/revenue-streams" => {
                let body = self.build_revenue_streams_payload();
                ("200 OK", "application/json", body)
            }
            "/api/v1/routing-metrics" => {
                let body = self.build_routing_metrics_payload();
                ("200 OK", "application/json", body)
            }
            // External-chain payout queue (QTC etc.). Revenue payouts remain
            // in SQLite until the downstream ledger acknowledges their ids.
            "/admin/external-payouts" => {
                let chain =
                    parse_query_param(raw_path, "chain").unwrap_or_else(|| "quantus".to_string());
                let durable = match self.share_store.as_ref() {
                    Some(store) => match store.pending_coin_revenue_payouts(&chain) {
                        Ok(rows) => Ok(rows),
                        Err(e) => Err(e),
                    },
                    None => Ok(Vec::new()),
                };
                match durable {
                    Err(e) => (
                        "503 Service Unavailable",
                        "application/json",
                        serde_json::json!({"ok": false, "error": e.to_string()}).to_string(),
                    ),
                    Ok(durable) if method == "POST" => {
                        let drained = {
                            let mut pool = self.pool.lock().expect("pool lock poisoned");
                            pool.take_external_payouts(&chain)
                                .into_iter()
                                .filter(|(_, payout)| payout.revenue_event.is_none())
                                .collect::<Vec<_>>()
                        };
                        let mut entries: Vec<serde_json::Value> = durable
                            .iter()
                            .map(|row| {
                                let p = &row.payout;
                                serde_json::json!({
                                    "outbox_id": row.id,
                                    "height": row.height,
                                    "miner_id": &p.miner_id,
                                    "address": &p.address,
                                    "amount_flowers": p.amount,
                                    "share_count": p.share_count,
                                    "unit": p.unit(),
                                    "coin": p.coin.as_deref(),
                                    "event": p.revenue_event.as_deref(),
                                })
                            })
                            .collect();
                        entries.extend(drained.iter().map(|(height, p)| {
                            serde_json::json!({
                                "height": height,
                                "miner_id": &p.miner_id,
                                "address": &p.address,
                                "amount_flowers": p.amount,
                                "share_count": p.share_count,
                                "unit": p.unit(),
                                "coin": p.coin.as_deref(),
                                "event": p.revenue_event.as_deref(),
                            })
                        }));
                        let body = serde_json::json!({
                            "ok": true,
                            "chain": chain,
                            "count": entries.len(),
                            "payouts": entries,
                        })
                        .to_string();
                        ("200 OK", "application/json", body)
                    }
                    Ok(durable) => {
                        let mut entries: Vec<serde_json::Value> = durable
                            .iter()
                            .map(|row| {
                                let p = &row.payout;
                                serde_json::json!({
                                    "outbox_id": row.id,
                                    "height": row.height,
                                    "miner_id": &p.miner_id,
                                    "address": &p.address,
                                    "amount_flowers": p.amount,
                                    "share_count": p.share_count,
                                    "unit": p.unit(),
                                    "coin": p.coin.as_deref(),
                                    "event": p.revenue_event.as_deref(),
                                })
                            })
                            .collect();
                        let pending = {
                            let pool = self.pool.lock().expect("pool lock poisoned");
                            pool.pending_external_payouts(&chain)
                                .into_iter()
                                .filter(|p| p.revenue_event.is_none())
                                .map(|p| {
                                    serde_json::json!({
                                        "miner_id": &p.miner_id,
                                        "address": &p.address,
                                        "amount_flowers": p.amount,
                                        "unit": p.unit(),
                                        "coin": p.coin.as_deref(),
                                        "event": p.revenue_event.as_deref(),
                                    })
                                })
                                .collect::<Vec<_>>()
                        };
                        entries.extend(pending);
                        let body = serde_json::json!({
                            "ok": true,
                            "chain": chain,
                            "pending": entries.len(),
                            "payouts": entries,
                        })
                        .to_string();
                        ("200 OK", "application/json", body)
                    }
                }
            }
            "/admin/external-payouts/ack" => {
                if method != "POST" {
                    (
                        "405 Method Not Allowed",
                        "application/json",
                        "{\"ok\":false,\"error\":\"POST required\"}".to_string(),
                    )
                } else {
                    #[derive(serde::Deserialize)]
                    struct AckRequest {
                        chain: String,
                        ids: Vec<String>,
                    }
                    match serde_json::from_str::<AckRequest>(&request_body) {
                        Err(e) => (
                            "400 Bad Request",
                            "application/json",
                            serde_json::json!({"ok": false, "error": e.to_string()})
                                .to_string(),
                        ),
                        Ok(req) => match self.share_store.as_ref() {
                            Some(store) => match store.ack_coin_revenue_payouts(&req.chain, &req.ids)
                            {
                                Ok(acked) => (
                                    "200 OK",
                                    "application/json",
                                    serde_json::json!({"ok": true, "acked": acked}).to_string(),
                                ),
                                Err(e) => (
                                    "503 Service Unavailable",
                                    "application/json",
                                    serde_json::json!({"ok": false, "error": e.to_string()})
                                        .to_string(),
                                ),
                            },
                            None => (
                                "503 Service Unavailable",
                                "application/json",
                                "{\"ok\":false,\"error\":\"durable payout store is not configured\"}"
                                    .to_string(),
                            ),
                        },
                    }
                }
            }
            // Native-coin revenue intake uses a durable journal, outbox, and
            // PPLNS snapshot commit so retries and process crashes cannot
            // lose or double-apply payouts.
            "/admin/coin-revenue" => {
                if method != "POST" {
                    let body = "{\"ok\":false,\"error\":\"POST required\"}";
                    (
                        "405 Method Not Allowed",
                        "application/json",
                        body.to_string(),
                    )
                } else {
                    #[derive(serde::Deserialize)]
                    struct RevenueReq {
                        coin: String,
                        #[serde(deserialize_with = "de_u64_str_or_num")]
                        amount: u64,
                        #[serde(default)]
                        ref_height: u64,
                        event: String,
                    }
                    match serde_json::from_str::<RevenueReq>(&request_body) {
                        Err(e) => (
                            "400 Bad Request",
                            "application/json",
                            serde_json::json!({"ok": false, "error": format!("bad json: {e}")})
                                .to_string(),
                        ),
                        Ok(req) => {
                            let event_id = req.event.trim();
                            if event_id.is_empty() {
                                (
                                    "400 Bad Request",
                                    "application/json",
                                    "{\"ok\":false,\"error\":\"event must not be empty\"}"
                                        .to_string(),
                                )
                            } else if let Some(store) = self.share_store.as_ref() {
                                let mut pool = self.pool.lock().expect("pool lock poisoned");
                                let state_path: Option<String> =
                                    pool.config.state_path.as_deref().map(|p| p.to_string());
                                let coin = req.coin.trim().to_ascii_lowercase();
                                if !pool.pplns.is_native_payout_coin(&coin) {
                                    (
                                        "400 Bad Request",
                                        "application/json",
                                        "{\"ok\":false,\"error\":\"coin not enabled for native payouts\"}"
                                            .to_string(),
                                    )
                                } else {
                                    let journal = match store.begin_coin_revenue(
                                        event_id,
                                        &coin,
                                        req.amount,
                                        req.ref_height,
                                    ) {
                                        Ok(event) => event,
                                        Err(e) => {
                                            tracing::error!(
                                                event = %event_id,
                                                "failed to begin native revenue journal: {e}"
                                            );
                                            return write_http_response(
                                                &mut stream,
                                                "503 Service Unavailable",
                                                "application/json",
                                                &serde_json::json!({"ok": false, "error": e.to_string()})
                                                    .to_string(),
                                            );
                                        }
                                    };
                                    if journal.status == "committed" {
                                        (
                                            "200 OK",
                                            "application/json",
                                            serde_json::json!({
                                                "ok": true,
                                                "duplicate": true,
                                                "amount": journal.amount_native,
                                            })
                                            .to_string(),
                                        )
                                    } else {
                                        let (emitted, emitted_total, payouts) = if pool
                                            .pplns
                                            .has_applied_revenue_event(event_id)
                                        {
                                            let payouts = pool.pending_revenue_payouts(event_id);
                                            let emitted = journal.emitted.max(payouts.len());
                                            let emitted_total = if journal.emitted > 0 {
                                                journal.emitted_total
                                            } else {
                                                payouts
                                                    .iter()
                                                    .map(|(_, payout)| payout.amount)
                                                    .fold(0u64, u64::saturating_add)
                                            };
                                            (emitted, emitted_total, payouts)
                                        } else {
                                            match pool.on_coin_revenue(
                                                &journal.coin,
                                                journal.amount_native,
                                                journal.ref_height,
                                                event_id,
                                            ) {
                                                Ok(outcome) => (
                                                    outcome.emitted,
                                                    outcome.emitted_total,
                                                    outcome.payouts,
                                                ),
                                                Err(e) => {
                                                    tracing::error!(
                                                        event = %event_id,
                                                        "failed to apply native revenue event: {e}"
                                                    );
                                                    return write_http_response(
                                                        &mut stream,
                                                        "503 Service Unavailable",
                                                        "application/json",
                                                        &serde_json::json!({"ok": false, "error": e.to_string()})
                                                            .to_string(),
                                                    );
                                                }
                                            }
                                        };
                                        if let Err(e) = store.prepare_coin_revenue(
                                            event_id,
                                            emitted,
                                            emitted_total,
                                            &payouts,
                                        ) {
                                            tracing::error!(
                                                event = %event_id,
                                                "failed to persist native revenue outbox: {e}"
                                            );
                                            return write_http_response(
                                                &mut stream,
                                                "503 Service Unavailable",
                                                "application/json",
                                                &serde_json::json!({"ok": false, "error": e.to_string()})
                                                    .to_string(),
                                            );
                                        }
                                        let Some(ref sp) = state_path else {
                                            return write_http_response(
                                                &mut stream,
                                                "503 Service Unavailable",
                                                "application/json",
                                                "{\"ok\":false,\"error\":\"PPLNS state persistence is required for native revenue\"}",
                                            );
                                        };
                                        if let Err(e) = pool.pplns.save_if_dirty(sp) {
                                            tracing::error!(
                                                event = %event_id,
                                                "failed to persist PPLNS revenue snapshot: {e}"
                                            );
                                            return write_http_response(
                                                &mut stream,
                                                "503 Service Unavailable",
                                                "application/json",
                                                &serde_json::json!({"ok": false, "error": e.to_string()})
                                                    .to_string(),
                                            );
                                        }
                                        if let Err(e) = store.complete_coin_revenue(event_id) {
                                            tracing::error!(
                                                event = %event_id,
                                                "failed to commit native revenue journal: {e}"
                                            );
                                            return write_http_response(
                                                &mut stream,
                                                "503 Service Unavailable",
                                                "application/json",
                                                &serde_json::json!({"ok": false, "error": e.to_string()})
                                                    .to_string(),
                                            );
                                        }
                                        (
                                            "200 OK",
                                            "application/json",
                                            serde_json::json!({
                                                "ok": true,
                                                "coin": journal.coin,
                                                "amount": journal.amount_native,
                                                "emitted": emitted,
                                                "emitted_total": emitted_total,
                                            })
                                            .to_string(),
                                        )
                                    }
                                }
                            } else {
                                (
                                    "503 Service Unavailable",
                                    "application/json",
                                    "{\"ok\":false,\"error\":\"durable revenue store is not configured\"}"
                                        .to_string(),
                                )
                            }
                        }
                    }
                }
            }
            p if p.starts_with("/api/v1/miners/") => {
                let miner_id = p.strip_prefix("/api/v1/miners/").unwrap_or("");
                let body = self.build_miner_detail_payload(miner_id);
                ("200 OK", "application/json", body)
            }
            "/admin/profit-switch" => {
                let body = self.build_profit_switch_payload();
                ("200 OK", "application/json", body)
            }
            "/admin/auxpow-status" => {
                let body = self.build_auxpow_payload();
                ("200 OK", "application/json", body)
            }
            "/admin/ops" => {
                let body = self.build_ops_payload();
                ("200 OK", "application/json", body)
            }
            _ => {
                let body = "{\"ok\":false,\"error\":\"not found\"}";
                ("404 Not Found", "application/json", body.to_string())
            }
        };

        write_http_response(&mut stream, status, content_type, &body)
    }

    /// Rebuild every cached payload once — called only by the
    /// `api-snapshot` refresher thread. A panic in any single builder must
    /// not kill the refresher (frozen snapshots would look like a wedge).
    fn refresh_snapshots(&self) {
        let builds: [(&RwLock<Option<Arc<str>>>, &dyn Fn(&Self) -> String); 3] = [
            (&self.snapshots.stats, &Self::build_stats_payload),
            (&self.snapshots.metrics, &Self::build_prometheus_payload),
            (&self.snapshots.public_coins, &Self::build_public_coins_payload),
        ];
        for (slot, build) in builds {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| build(self))) {
                Ok(body) => *slot.write().expect("snapshot lock poisoned") = Some(body.into()),
                Err(_) => error!("api-snapshot: payload build panicked — keeping last good"),
            }
        }
    }

    /// Serve the cached payload, building inline only while the refresher
    /// has not produced its first copy yet (first seconds after boot).
    fn snapshot_or(slot: &RwLock<Option<Arc<str>>>, build: impl Fn() -> String) -> String {
        if let Some(body) = slot.read().expect("snapshot lock poisoned").as_ref() {
            return body.to_string();
        }
        build()
    }

    fn build_stats_payload(&self) -> String {
        let uptime_s = self.started_at.elapsed().as_secs();
        let (
            accepted,
            rejected,
            sessions,
            total_conn,
            stats,
            fees,
            pearl,
            pool_port,
            quantus_pending,
            pearl_pending,
        ) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            let (accepted, rejected) = pool.stats();
            (
                accepted,
                rejected,
                pool.session_counters
                    .active_sessions
                    .load(Ordering::Relaxed),
                pool.session_counters
                    .total_connections
                    .load(Ordering::Relaxed),
                pool.pplns.stats(),
                pool.pplns.fee_stats(),
                pool.pearl.clone(),
                pool.config.port,
                pool.pending_external_payouts("quantus").len(),
                pool.pending_external_payouts("pearl").len(),
            )
        };

        // Leg state lives behind per-leg mutexes — gathered only after the
        // pool guard is released so a leg stuck on a stalled upstream can
        // never wedge share accounting through this payload.
        let auxpow_json = self.auxpow_summary_inner(pearl);

        // Routing stats (sources + groups) for dashboard Trinity Mining panel
        let routing_json = if let Some(ref rs) = self.routing_stats {
            match rs.try_lock() {
                Ok(guard) => guard.snapshot_json(),
                Err(_) => serde_json::json!({}),
            }
        } else {
            serde_json::json!({})
        };

        json!({
            "ok": true,
            "uptime_s": uptime_s,
            "sessions": sessions,
            "total_connections": total_conn,
            "shares": {
                "accepted": accepted,
                "rejected": rejected,
                "total": accepted + rejected
            },
            "pplns": {
                "window_size": stats.window_size,
                "window_used": stats.window_used,
                "window_total_difficulty": stats.window_total_difficulty.to_string(),
                "registered_miners": stats.registered_miners,
                "miners_with_unpaid": stats.miners_with_unpaid,
                "total_unpaid_flowers": stats.total_unpaid_flowers.to_string(),
                "total_paid_flowers": stats.total_paid_flowers.to_string(),
                "payout_rounds": stats.payout_rounds
            },
            "pool": {
                "fee_bps": fees.pool_fee_pct * 100,
                "miner_pct": fees.miner_pct,
                "humanitarian_pct": fees.humanitarian_pct,
                "issobella_pct": fees.issobella_pct,
                "port": pool_port
            },
            "blocks": self.block_tracker_json(),
            "external_payouts": {
                "quantus": {
                    "pending": quantus_pending
                },
                "pearl": {
                    "pending": pearl_pending
                }
            },
            "auxpow": auxpow_json,
            "routing": routing_json,
            "api": {
                "stats": "/stats",
                "miners": "/miners?limit=200",
                "blocks": "/api/v1/blocks?limit=50",
                "payouts": "/api/v1/payouts?limit=50",
                "all_miners": "/api/v1/miners?limit=100",
                "pplns": "/api/v1/pplns",
                "auxpow": "/api/v1/auxpow",
                "health": "/health",
                "metrics": "/metrics"
            }
        })
        .to_string()
    }

    fn build_pplns_payload(&self) -> String {
        let pool = self.pool.lock().expect("pool lock poisoned");
        let stats = pool.pplns.stats();
        let fees = pool.pplns.fee_stats();

        json!({
            "ok": true,
            "window_size": stats.window_size,
            "window_used": stats.window_used,
            "window_total_difficulty": stats.window_total_difficulty.to_string(),
            "registered_miners": stats.registered_miners,
            "miners_with_unpaid": stats.miners_with_unpaid,
            "total_unpaid_flowers": stats.total_unpaid_flowers.to_string(),
            "total_paid_flowers": stats.total_paid_flowers.to_string(),
            "payout_rounds": stats.payout_rounds,
            "fee_bps": fees.pool_fee_pct * 100,
            "humanitarian_pct": fees.humanitarian_pct,
            "issobella_pct": fees.issobella_pct,
            "miner_pct": fees.miner_pct
        })
        .to_string()
    }

    /// Shared auxpow summary used by both `/stats` (folded into the big
    /// payload) and `/api/v1/auxpow` (standalone). Shape:
    /// `{enabled, coins:[ticker], coin_details:[{ticker,algorithm,device,
    /// upstream,job_id,job_age_ms,job_fresh}]}`.
    fn auxpow_summary_json(&self) -> serde_json::Value {
        let pearl = self.pool.lock().expect("pool lock poisoned").pearl.clone();
        self.auxpow_summary_inner(pearl)
    }

    fn auxpow_summary_inner(
        &self,
        pearl: Option<Arc<crate::pearl_gateway::PearlRuntime>>,
    ) -> serde_json::Value {
        let mut summary = match &self.auxpow_bridge {
            Some(bridge) => {
                let enabled = bridge.enabled_coins();
                let coins: Vec<serde_json::Value> =
                    enabled.iter().map(|c| json!(c.as_str())).collect();
                // Per-coin details for pool dashboards and the desktop agent:
                // ticker, consensus algorithm, upstream stratum endpoint, and
                // whether the bridge currently holds a fresh job to serve.
                let details: Vec<serde_json::Value> = enabled
                    .iter()
                    .map(|c| {
                        let upstream = std::env::var(format!(
                            "ZION_POOL_AUXPOW_POOL_{}",
                            c.as_str().to_uppercase()
                        ))
                        .ok()
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| {
                            zion_cosmic_harmony::CoinProfile::for_coin(*c).pool_address()
                        })
                        .trim_start_matches("stratum+tcp://")
                        .to_string();
                        let job = bridge.latest_job_for_coin(c);
                        let (job_id, job_age_ms) = match &job {
                            Some(j) => {
                                let age = j
                                    .received_at
                                    .map(|t| t.elapsed().as_millis() as u64)
                                    .unwrap_or(0);
                                (Some(j.external_job_id.clone()), Some(age))
                            }
                            None => (None, None),
                        };
                        let mut entry = json!({
                            "ticker": c.as_str(),
                            "algorithm": c.algorithm(),
                            "device": if bridge.is_cpu_coin(c) { "cpu" } else { "gpu" },
                            "upstream": upstream,
                            "job_id": job_id,
                            "job_age_ms": job_age_ms,
                            "job_fresh": job_age_ms.map(|a| a < 120_000).unwrap_or(false),
                        });
                        // Hybrid native leg: expose connect status, configured
                        // split and the freshest node-sourced job for QTU.
                        if *c == ExternalCoin::Quantus {
                            let (enabled, connected, pct, njid, nage) = bridge.native_status();
                            entry["native"] = json!({
                                "enabled": enabled,
                                "connected": connected,
                                "share_pct": pct,
                                "job_id": njid,
                                "job_age_ms": nage,
                            });
                        }
                        entry
                    })
                    .collect();
                json!({
                    "enabled": true,
                    "coins": coins,
                    "coin_details": details,
                })
            }
            None => json!({"enabled": false}),
        };
        if let Some(pearl) = pearl {
            let (n_en, njid, nage, npct, u_en, u_conn, ujid, uage, _upend, s_native, s_upstream) =
                pearl.status();
            summary["pearl"] = json!({
                "native": {
                    "enabled": n_en,
                    "job_id": njid,
                    "job_age_ms": nage,
                    "share_pct": npct,
                },
                "upstream": pearl.upstream_status_json(),
                "served_native": s_native,
                "served_upstream": s_upstream,
            });
            // Surface PRL in the served-coins list when a live job source
            // exists (native gateway stratum or upstream bridge). The desktop
            // agent's coin picker reads `coins` to mark selectable options —
            // Pearl bypasses the auxpow bridge so it never appears there
            // unless we add it explicitly.
            let served = (n_en && nage.map(|a| a < 120_000).unwrap_or(false))
                || (u_en && u_conn && uage.map(|a| a < 120_000).unwrap_or(false));
            if served {
                let coins = summary["coins"].as_array_mut().cloned().unwrap_or_default();
                let mut coins = coins;
                if !coins.iter().any(|c| c.as_str() == Some("PRL")) {
                    coins.push(json!("PRL"));
                }
                summary["coins"] = json!(coins);
                let details = summary["coin_details"]
                    .as_array_mut()
                    .cloned()
                    .unwrap_or_default();
                let mut details = details;
                details.push(json!({
                    "ticker": "PRL",
                    "algorithm": "pearlhash",
                    "device": "gpu",
                    "upstream": if u_en && u_conn { "bridge+gateway" } else { "native" },
                    "job_id": njid.or(ujid),
                    "job_age_ms": nage.or(uage),
                    "job_fresh": true,
                }));
                summary["coin_details"] = json!(details);
            }
        }
        summary
    }

    fn build_auxpow_payload(&self) -> String {
        let mut v = self.auxpow_summary_json();
        v["ok"] = json!(true);
        v.to_string()
    }

    /// Build the profit switcher status payload.
    ///
    /// Lists every known external coin (CoinProfile::all) — professional
    /// pools expose the full algorithm catalogue with per-coin
    /// enabled/disabled state, not only the enabled subset. `served`
    /// marks coins with a live AuxPoW bridge; `algorithm` uses the
    /// canonical kernel name so dashboards can group by PoW family.
    fn build_profit_switch_payload(&self) -> String {
        let served: std::collections::HashSet<String> = self
            .auxpow_bridge
            .as_ref()
            .map(|b| {
                b.enabled_coins()
                    .iter()
                    .map(|c| c.as_str().to_string())
                    .collect()
            })
            .unwrap_or_default();
        let profiles = zion_cosmic_harmony::CoinProfile::all();
        let entries: Vec<serde_json::Value> = profiles
            .iter()
            .map(|p| {
                let ticker = p.coin.as_str();
                json!({
                    "coin": ticker,
                    "algorithm": p.coin.algorithm(),
                    "device": format!("{:?}", p.device),
                    "profit_usd_day": p.estimate_profit(1.0),
                    "enabled": p.enabled && !p.disabled,
                    "disabled_reason": p.disabled_reason,
                    "served": served.contains(ticker),
                })
            })
            .collect();

        json!({
            "ok": true,
            "hysteresis_pct": std::env::var("ZION_POOL_PROFIT_HYSTERESIS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(15.0),
            "check_interval_secs": std::env::var("ZION_POOL_PROFIT_INTERVAL")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(300u64),
            "coins": entries,
        })
        .to_string()
    }

    /// Build the stream profit weights payload.
    fn build_stream_profit_payload(&self) -> String {
        let profiles = zion_cosmic_harmony::CoinProfile::defaults();
        let gpu_coins: Vec<serde_json::Value> = profiles
            .iter()
            .filter(|p| {
                matches!(
                    p.device,
                    zion_cosmic_harmony::Device::Gpu | zion_cosmic_harmony::Device::Both
                )
            })
            .map(|p| {
                json!({
                    "coin": p.coin.as_str(),
                    "profit_usd_day": p.estimate_profit(1.0),
                })
            })
            .collect();
        let cpu_coins: Vec<serde_json::Value> = profiles
            .iter()
            .filter(|p| {
                matches!(
                    p.device,
                    zion_cosmic_harmony::Device::Cpu | zion_cosmic_harmony::Device::Both
                )
            })
            .map(|p| {
                json!({
                    "coin": p.coin.as_str(),
                    "profit_usd_day": p.estimate_profit(1.0),
                })
            })
            .collect();

        json!({
            "ok": true,
            "gpu_streams": gpu_coins,
            "cpu_streams": cpu_coins,
        })
        .to_string()
    }

    /// Serialize up to `limit` most recent history samples (ascending ts).
    fn build_history_payload(&self, limit: usize) -> String {
        let samples: Vec<HistorySample> = {
            let h = self.history.lock().expect("history lock poisoned");
            let skip = h.len().saturating_sub(limit.min(h.len()));
            h.iter().skip(skip).cloned().collect()
        };
        json!({
            "ok": true,
            "interval_s": HISTORY_INTERVAL_S,
            "samples": samples,
        })
        .to_string()
    }

    /// Authenticated alias for the public history feed — same data,
    /// kept on the admin tier for dashboard compatibility.
    fn build_hashrate_history_payload(&self, limit: usize) -> String {
        self.build_history_payload(limit)
    }

    /// Build per-miner detail payload.
    fn build_miner_detail_payload(&self, miner_id: &str) -> String {
        let (worker_addresses, telemetry) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            (pool.worker_addresses.clone(), pool.telemetry.clone())
        };

        let (full_worker, address) = worker_addresses
            .get(miner_id)
            .map(|addr| (miner_id.to_string(), addr.encoded.clone()))
            .or_else(|| {
                let (m, w) = split_worker(miner_id);
                let full = if w == "default" || w.is_empty() {
                    m.clone()
                } else {
                    format!("{m}.{w}")
                };
                worker_addresses
                    .get(&full)
                    .map(|addr| (full, addr.encoded.clone()))
            })
            .unwrap_or_else(|| {
                let (m, w) = split_worker(miner_id);
                let full = if w == "default" || w.is_empty() {
                    m.clone()
                } else {
                    format!("{m}.{w}")
                };
                (full, m)
            });

        let (miner_id_parsed, worker_short) = split_worker(&full_worker);
        let key = format!("{miner_id_parsed}/{worker_short}");
        let now_s = now_unix_seconds();
        let reg = telemetry.lock().expect("telemetry lock poisoned");
        let miner = reg.get_miner(&key);

        json!({
            "ok": true,
            "miner_id": miner_id,
            "worker": full_worker,
            "address": address,
            "miner": miner_to_json(&full_worker, &address, miner, now_s),
        })
        .to_string()
    }

    /// Build admin ops payload — pool operational status.
    fn build_ops_payload(&self) -> String {
        let pool = self.pool.lock().expect("pool lock poisoned");
        let (accepted, rejected) = pool.stats();
        let uptime_s = self.started_at.elapsed().as_secs();
        let sessions = pool
            .session_counters
            .active_sessions
            .load(Ordering::Relaxed);
        let total_conn = pool
            .session_counters
            .total_connections
            .load(Ordering::Relaxed);

        json!({
            "ok": true,
            "uptime_s": uptime_s,
            "active_sessions": sessions,
            "total_connections": total_conn,
            "shares_accepted": accepted,
            "shares_rejected": rejected,
            "l1_rpc_url": pool.config.l1_rpc_url,
            "pool_fee_bps": pool.config.pool_fee_bps,
            "pplns_window_size": pool.config.pplns_window_size,
            "min_payout_flowers": pool.config.min_payout_flowers,
            "auxpow_enabled": self.auxpow_bridge.is_some(),
            "tls_enabled": std::env::var("ZION_POOL_TLS_BIND").is_ok(),
            "share_relay_enabled": std::env::var("ZION_UPSTREAM_POOL_ADDR").is_ok(),
        })
        .to_string()
    }

    // ── /public/v1/account — ZIS-authed miner settings (A2.2/A2.3) ──────

    /// Dispatch one authenticated account request. The zis token is the
    /// credential — verified against the identity service via
    /// `verify_blocking`; the wallet argument must be a linked address of
    /// the resolved identity (`owns`) before any read or write happens.
    /// Failed tokens count against the shared auth-failure limiter.
    fn handle_account_request(
        &self,
        path: &str,
        body: &str,
        client_ip: std::net::IpAddr,
    ) -> (&'static str, String) {
        let json: serde_json::Value = match serde_json::from_str(body) {
            Ok(v) => v,
            Err(_) => {
                return (
                    "400 Bad Request",
                    "{\"ok\":false,\"error\":\"invalid json\"}".to_string(),
                )
            }
        };
        let token = json["token"].as_str().unwrap_or("");
        if !token.starts_with("zis_") {
            self.note_auth_failure(client_ip);
            return (
                "401 Unauthorized",
                "{\"ok\":false,\"error\":\"invalid token\"}".to_string(),
            );
        }
        let Some(idn) = self.zis.verify_blocking(token) else {
            self.note_auth_failure(client_ip);
            return (
                "401 Unauthorized",
                "{\"ok\":false,\"error\":\"invalid token\"}".to_string(),
            );
        };
        if self.zis.is_banned(&idn.sub) {
            return (
                "403 Forbidden",
                "{\"ok\":false,\"error\":\"account banned\"}".to_string(),
            );
        }
        match path {
            "/public/v1/account" => ("200 OK", self.account_view(&idn)),
            "/public/v1/account/threshold" => self.account_set_threshold(&idn, &json),
            "/public/v1/account/alert" => self.account_upsert_alert(&idn, &json),
            "/public/v1/account/alert/delete" => self.account_delete_alert(&idn, &json),
            _ => (
                "404 Not Found",
                "{\"ok\":false,\"error\":\"unknown endpoint\"}".to_string(),
            ),
        }
    }

    /// `POST /public/v1/account` — read: linked wallets, their payout
    /// threshold overrides and alert subscriptions.
    fn account_view(&self, idn: &crate::zis::ZisIdentity) -> String {
        let Some(store) = &self.share_store else {
            return json!({"ok": false, "error": "database not configured"}).to_string();
        };
        let overrides = store.load_payout_overrides().unwrap_or_default();
        let mut settings = serde_json::Map::new();
        let mut alerts = serde_json::Map::new();
        for w in &idn.addresses {
            if let Some(v) = overrides.get(w) {
                settings.insert(w.clone(), json!({"min_payout_flowers": v}));
            }
            let subs = store.list_alert_subscriptions(w).unwrap_or_default();
            if !subs.is_empty() {
                alerts.insert(
                    w.clone(),
                    json!(subs
                        .iter()
                        .map(|s| json!({
                            "id": s.id,
                            "worker": s.worker,
                            "channel": s.channel,
                            "target": s.target,
                            "offline_secs": s.offline_secs,
                            "state": s.state,
                        }))
                        .collect::<Vec<_>>()),
                );
            }
        }
        json!({
            "ok": true,
            "sub": idn.sub,
            "wallets": idn.addresses,
            "settings": settings,
            "alerts": alerts,
        })
        .to_string()
    }

    /// `POST /public/v1/account/threshold` — `{token, wallet, min_payout}`.
    /// `min_payout` in flowers; 0 clears the override. Floor = the global
    /// coin minimum (a user cannot push below pool dust protection), cap =
    /// 1000× to keep accidental typos from freezing payouts forever.
    fn account_set_threshold(
        &self,
        idn: &crate::zis::ZisIdentity,
        json: &serde_json::Value,
    ) -> (&'static str, String) {
        let Some(store) = &self.share_store else {
            return (
                "503 Service Unavailable",
                "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
            );
        };
        let wallet = json["wallet"].as_str().unwrap_or("");
        if !idn.owns(wallet) {
            return (
                "403 Forbidden",
                "{\"ok\":false,\"error\":\"wallet not linked to account\"}".to_string(),
            );
        }
        let v = json["min_payout"]
            .as_u64()
            .or_else(|| json["min_payout"].as_str().and_then(|s| s.parse().ok()));
        let Some(v) = v else {
            return (
                "400 Bad Request",
                "{\"ok\":false,\"error\":\"min_payout required (flowers)\"}".to_string(),
            );
        };
        let floor = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            pool.config.min_payout_flowers
        };
        let cap = floor.saturating_mul(1000);
        if v != 0 && (v < floor || v > cap) {
            return (
                "400 Bad Request",
                json!({"ok": false, "error": format!("min_payout out of range [{floor}, {cap}] or 0 to clear")})
                    .to_string(),
            );
        }
        if let Err(e) = store.set_min_payout_override(wallet, v) {
            warn!("miner_settings: override write failed: {e}");
            return (
                "500 Internal Server Error",
                "{\"ok\":false,\"error\":\"store failed\"}".to_string(),
            );
        }
        self.pool
            .lock()
            .expect("pool lock poisoned")
            .pplns
            .set_payout_override(wallet, if v > 0 { Some(v) } else { None });
        (
            "200 OK",
            json!({"ok": true, "wallet": wallet, "min_payout": v.to_string()}).to_string(),
        )
    }

    /// `POST /public/v1/account/alert` — `{token, wallet, worker?, channel,
    /// target, offline_secs?}`. `worker` empty = wallet-wide watch. Channel
    /// `webhook` → https target (`webhook_url_allowed`), `telegram` → a
    /// numeric chat id. Unique per (wallet, worker, channel) — repeat POST
    /// updates in place.
    fn account_upsert_alert(
        &self,
        idn: &crate::zis::ZisIdentity,
        json: &serde_json::Value,
    ) -> (&'static str, String) {
        let Some(store) = &self.share_store else {
            return (
                "503 Service Unavailable",
                "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
            );
        };
        let wallet = json["wallet"].as_str().unwrap_or("");
        if !idn.owns(wallet) {
            return (
                "403 Forbidden",
                "{\"ok\":false,\"error\":\"wallet not linked to account\"}".to_string(),
            );
        }
        let worker: String = json["worker"]
            .as_str()
            .unwrap_or("")
            .chars()
            .take(64)
            .collect();
        let channel = json["channel"].as_str().unwrap_or("");
        let target: String = json["target"]
            .as_str()
            .unwrap_or("")
            .chars()
            .take(512)
            .collect();
        let target_ok = match channel {
            "webhook" => crate::notifications::webhook_url_allowed(&target),
            // chat ids are signed decimal integers.
            "telegram" => {
                !target.is_empty()
                    && target
                        .strip_prefix('-')
                        .unwrap_or(&target)
                        .chars()
                        .all(|c| c.is_ascii_digit())
            }
            _ => false,
        };
        if !target_ok {
            return (
                "400 Bad Request",
                "{\"ok\":false,\"error\":\"invalid channel/target (webhook=https url, telegram=chat id)\"}"
                    .to_string(),
            );
        }
        let offline_secs = json["offline_secs"]
            .as_u64()
            .unwrap_or(600)
            .clamp(60, 86_400);
        match store.upsert_alert_subscription(wallet, &worker, channel, &target, offline_secs) {
            Ok(id) => (
                "200 OK",
                json!({"ok": true, "id": id, "wallet": wallet, "worker": worker,
                       "channel": channel, "offline_secs": offline_secs})
                .to_string(),
            ),
            Err(e) => {
                warn!("alert_subscriptions: upsert failed: {e}");
                (
                    "500 Internal Server Error",
                    "{\"ok\":false,\"error\":\"store failed\"}".to_string(),
                )
            }
        }
    }

    /// `POST /public/v1/account/alert/delete` — `{token, wallet, id}`.
    /// Scoped delete: the row must belong to `wallet` (which the identity
    /// must own), so one account cannot delete another's subscriptions.
    fn account_delete_alert(
        &self,
        idn: &crate::zis::ZisIdentity,
        json: &serde_json::Value,
    ) -> (&'static str, String) {
        let Some(store) = &self.share_store else {
            return (
                "503 Service Unavailable",
                "{\"ok\":false,\"error\":\"database not configured\"}".to_string(),
            );
        };
        let wallet = json["wallet"].as_str().unwrap_or("");
        if !idn.owns(wallet) {
            return (
                "403 Forbidden",
                "{\"ok\":false,\"error\":\"wallet not linked to account\"}".to_string(),
            );
        }
        let Some(id) = json["id"].as_i64() else {
            return (
                "400 Bad Request",
                "{\"ok\":false,\"error\":\"id required\"}".to_string(),
            );
        };
        let deleted = store
            .delete_alert_subscription(id, wallet)
            .unwrap_or_default();
        (
            "200 OK",
            json!({"ok": true, "deleted": deleted > 0}).to_string(),
        )
    }

    fn build_miners_payload(&self, limit: usize) -> String {
        let (worker_addresses, telemetry) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            (pool.worker_addresses.clone(), pool.telemetry.clone())
        };

        let now_s = now_unix_seconds();
        let reg = telemetry.lock().expect("telemetry lock poisoned");

        let mut miners = Vec::new();
        let mut count = 0usize;

        // Prefer telemetry registry for live data, but fall back to worker_addresses
        // for workers that have not submitted yet.
        for (key, miner) in reg.all_miners() {
            let (miner_id, worker_short) = split_worker_key(key);
            let full_worker = if worker_short == "default" || worker_short.is_empty() {
                miner_id.clone()
            } else {
                format!("{miner_id}.{worker_short}")
            };
            let address = worker_addresses
                .get(&full_worker)
                .map(|a| a.encoded.clone())
                .unwrap_or_else(|| miner_id.clone());

            if count < limit {
                miners.push(miner_to_json(&full_worker, &address, Some(miner), now_s));
            }
            count = count.saturating_add(1);
        }

        for (full_worker, addr) in worker_addresses.iter() {
            let (miner_id, worker_short) = split_worker(full_worker);
            let key = format!("{miner_id}/{worker_short}");
            if reg.get_miner(&key).is_some() {
                continue; // already emitted from telemetry
            }
            if count < limit {
                miners.push(miner_to_json(full_worker, &addr.encoded, None, now_s));
            }
            count = count.saturating_add(1);
        }

        json!({
            "ok": true,
            "count": count,
            "miners": miners,
        })
        .to_string()
    }

    /// `/public/v1/coins` — coin registry + live leg health, public-safe.
    fn build_public_coins_payload(&self) -> String {
        // Leg state is gathered behind per-leg mutexes — take only the two
        // pool-owned inputs under the guard, then release it (see
        // `leg_statuses_detached`): a stuck leg must not wedge the pool.
        let legs = match &self.auxpow_bridge {
            Some(b) => {
                let (l1_cfg, pearl) = {
                    let pool = self.pool.lock().expect("pool lock poisoned");
                    pool.leg_inputs()
                };
                Pool::leg_statuses_detached(l1_cfg, pearl.as_ref(), b)
            }
            None => Vec::new(),
        };
        let pool = self.pool.lock().expect("pool lock poisoned");
        let fees = pool.pplns.fee_stats();

        // One row per coin — legs folded in.  Public-safe fields only:
        // no internal ports, upstream endpoints, or worker names.
        let mut coins: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
        for leg in &legs {
            let key = leg.coin.to_ascii_lowercase();
            let entry = coins.entry(key.clone()).or_insert_with(|| {
                json!({
                    "coin": key,
                    "payout_mode": if pool.pplns.is_native_payout_coin(&key) {
                        "native"
                    } else {
                        "unified"
                    },
                    "min_payout": pool.pplns.min_payout_for(&key).to_string(),
                    "fee_bps": fees.pool_fee_pct * 100,
                    "legs": []
                })
            });
            entry["legs"].as_array_mut().unwrap().push(json!({
                "id": leg.leg_id,
                "kind": match leg.kind {
                    crate::coin_leg::LegKind::Native => "native",
                    crate::coin_leg::LegKind::Upstream => "upstream",
                },
                "enabled": leg.enabled,
                "connected": leg.connected,
                "job_age_ms": leg.job_age_ms,
            }));
        }
        // Advertised vardiff policy — same source as the stratum server
        // (VarDiffConfig::from_env) so public docs never drift from what is
        // actually enforced.
        let vd = crate::vardiff::VarDiffConfig::from_env();
        json!({
            "ok": true,
            // Protocol reward split (emission 89/5/5/1) — global, applies to
            // every coin's ZION-reward distribution. Pool fee is the pool
            // operator slice inside it.
            "fees": {
                "miner_pct": fees.miner_pct,
                "humanitarian_pct": fees.humanitarian_pct,
                "issobella_pct": fees.issobella_pct,
                "pool_fee_pct": fees.pool_fee_pct
            },
            "vardiff": {
                "start": vd.start_difficulty,
                "min": vd.min_difficulty,
                "max": if vd.max_difficulty == 0 {
                    serde_json::Value::Null
                } else {
                    json!(vd.max_difficulty)
                },
                "target_secs": vd.target_secs,
                "retarget_shares": vd.retarget_shares
            },
            "coins": coins.values().collect::<Vec<_>>()
        })
        .to_string()
    }

    /// `/api/v1/state/{pplns|payouts|db}` — authenticated raw-byte state
    /// export for the EDGE2 warm standby (A4.2).
    ///
    /// - `pplns`   → `state_path` file bytes (atomically replaced on save)
    /// - `payouts` → `state_path + ".payouts.json"` idempotency ledger
    /// - `db`      → `VACUUM INTO` snapshot of `pool-store.db` — consistent
    ///               under WAL while writers keep working
    ///
    /// Files are read OUTSIDE the pool lock — only the config paths are
    /// taken under it.
    fn respond_state_export(&self, stream: &mut TcpStream, path: &str) -> Result<()> {
        let name = path.trim_start_matches("/api/v1/state/");
        let bytes = match name {
            "pplns" | "payouts" => {
                let state_path = {
                    let pool = self.pool.lock().expect("pool lock poisoned");
                    pool.config.state_path.clone()
                };
                let file = state_path.map(|p| {
                    if name == "payouts" {
                        std::path::PathBuf::from(format!("{p}.payouts.json"))
                    } else {
                        std::path::PathBuf::from(p)
                    }
                });
                file.and_then(|p| std::fs::read(&p).ok())
            }
            "db" => self.share_store.as_ref().and_then(|store| {
                let tmp = std::env::temp_dir()
                    .join(format!("pool-store-export-{}.db", std::process::id()));
                let out = store
                    .vacuum_into(&tmp)
                    .ok()
                    .and_then(|_| std::fs::read(&tmp).ok());
                let _ = std::fs::remove_file(&tmp);
                out
            }),
            _ => None,
        };

        match bytes {
            Some(b) => {
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    b.len()
                );
                stream.write_all(head.as_bytes())?;
                stream.write_all(&b)?;
            }
            None => {
                let body = "{\"ok\":false,\"error\":\"not found\"}";
                let response = format!(
                    "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                stream.write_all(response.as_bytes())?;
            }
        }
        Ok(())
    }

    /// `/public/v1/coins/{coin}/stats` — per-coin telemetry + window stats.
    fn build_public_coin_stats_payload(&self, coin: &str) -> String {
        let coin = coin.to_ascii_lowercase();
        // Served-job difficulty comes from per-leg job rings — gather it
        // BEFORE the pool mutex so a slow leg read can never wedge share
        // processing (the leg_inputs/detached pattern used elsewhere).
        let served_diff = self.served_share_difficulty(&coin);
        let pool = self.pool.lock().expect("pool lock poisoned");
        let now_s = now_unix_seconds();
        let reg = pool.telemetry.lock().expect("telemetry lock poisoned");

        // Aggregate the per-miner coin streams: a miner counts as online
        // when it submitted a share on this coin within the live window.
        let mut online = 0u64;
        let mut valid = 0u64;
        let mut invalid = 0u64;
        for (_, miner) in reg.all_miners() {
            if let Some(s) = miner.streams.get(&coin) {
                valid += s.valid_shares;
                invalid += s.invalid_shares;
                if s.last_share_time_s > 0 && now_s.saturating_sub(s.last_share_time_s) < 600 {
                    online += 1;
                }
            }
        }
        drop(reg);

        let coin_stats = pool.pplns.coin_stats().into_iter().find(|s| s.coin == coin);
        let (window_weight, active_miners, accepted_total) = coin_stats
            .map(|s| {
                (
                    s.window_weight.to_string(),
                    s.active_miners,
                    s.accepted_total,
                )
            })
            .unwrap_or_else(|| ("0".into(), 0, 0));

        // ZION uses the job-work estimator; external coins sum their
        // per-stream expected-work samples (each share carries its own
        // difficulty — see telemetry::record_external_share).
        let hashrate = {
            let reg = pool.telemetry.lock().expect("telemetry lock");
            if coin == "zion" {
                json!({
                    "live": reg.pool_hashrate_live(),
                    "1h": reg.pool_hashrate_1h(),
                })
            } else {
                let live: f64 = reg
                    .all_miners()
                    .map(|(_, m)| {
                        m.stream_hashrate(&coin, crate::telemetry::HASHRATE_WINDOW_LIVE_S, now_s)
                    })
                    .sum();
                let h1: f64 = reg
                    .all_miners()
                    .map(|(_, m)| {
                        m.stream_hashrate(&coin, crate::telemetry::HASHRATE_WINDOW_1H_S, now_s)
                    })
                    .sum();
                json!({"live": live, "1h": h1})
            }
        };

        // Luck/orphan counters only apply to the coin whose blocks this
        // pool actually finds — ZION. External legs never produce blocks
        // here, so their payload omits the field entirely.
        let mut out = json!({
            "ok": true,
            "coin": coin,
            "miners_online": online,
            "active_miners": active_miners,
            "shares": {"accepted": valid, "rejected": invalid},
            "window_weight": window_weight,
            "accepted_total": accepted_total,
            "hashrate": hashrate,
        });
        if let Some(d) = served_diff {
            out["served_difficulty"] = json!(d);
        }
        if coin == "zion" {
            out["blocks"] = self.block_tracker_json();
        }
        out.to_string()
    }

    /// Difficulty of the job a miner on `coin` would be served right now —
    /// expected hashes of the freshest leg job target. This is the "diff"
    /// miners see in their client (upstream pools set it per job); for ZION
    /// it's the latest found block's network difficulty until a template
    /// source is wired in. `None` when no leg holds a job.
    fn served_share_difficulty(&self, coin: &str) -> Option<f64> {
        if coin == "zion" {
            let store = self.share_store.as_ref()?;
            let rows = store.query_blocks_for_coin("zion", 1).ok()?;
            return rows.first().and_then(|b| {
                let d = b.network_difficulty;
                (d > 0).then_some(d as f64)
            });
        }
        if coin == "prl" {
            let pearl = {
                let pool = self.pool.lock().expect("pool lock poisoned");
                pool.leg_inputs().1
            }?;
            return pearl.served_share_difficulty();
        }
        let bridge = self.auxpow_bridge.as_ref()?;
        let ec = ExternalCoin::from_ticker(coin)?;
        let job = if ec == ExternalCoin::Quantus {
            bridge
                .native_latest_job()
                .or_else(|| bridge.latest_job_for_coin(&ec))
        } else {
            bridge.latest_job_for_coin(&ec)
        }?;
        let d = crate::telemetry::expected_hashes_for_target_hex(&job.target_hex);
        (d > 0.0).then_some(d)
    }

    /// `/public/v1/miner/{coin}/{wallet}` — wallet-scoped dashboard data.
    /// Miners are keyed `miner_id/worker`; the wallet matches the miner id
    /// prefix or a registered payout address.
    fn build_public_miner_payload(&self, coin: &str, wallet: &str) -> String {
        let coin = coin.to_ascii_lowercase();
        let pool = self.pool.lock().expect("pool lock poisoned");
        let now_s = now_unix_seconds();
        let reg = pool.telemetry.lock().expect("telemetry lock poisoned");

        let mut valid = 0u64;
        let mut invalid = 0u64;
        let mut workers: Vec<serde_json::Value> = Vec::new();
        let mut last_seen = 0u64;
        for (key, miner) in reg.all_miners() {
            let (miner_id, worker_short) = split_worker_key(key);
            let matches = miner_id == wallet
                || miner_id.starts_with(&format!("{wallet}."))
                || pool
                    .pplns
                    .address_for(&miner_id)
                    .map(|a| a == wallet)
                    .unwrap_or(false);
            if !matches {
                continue;
            }
            last_seen = last_seen.max(miner.last_seen_s);
            let (w_valid, w_invalid) = if coin.is_empty() {
                (miner.valid_shares, miner.invalid_shares)
            } else if let Some(s) = miner.streams.get(&coin) {
                (s.valid_shares, s.invalid_shares)
            } else {
                (0, 0)
            };
            valid += w_valid;
            invalid += w_invalid;
            // worker_short is "wallet.worker@group" — show just the worker
            // part so the dashboard doesn't echo the wallet back.
            let worker_name = worker_display_name(&miner_id, &worker_short);
            workers.push(json!({
                "name": worker_name,
                "worker": worker_name,
                "accepted": w_valid,
                "rejected": w_invalid,
                "last_seen_s": miner.last_seen_s,
                "hashrate": if coin.is_empty() || coin == "zion" {
                    json!(miner.hashrate_live(now_s))
                } else {
                    json!(miner.stream_hashrate(
                        &coin,
                        crate::telemetry::HASHRATE_WINDOW_LIVE_S,
                        now_s
                    ))
                },
            }));
        }
        drop(reg);

        // Unpaid balance — unified flowers or native coin units.
        let miner_ids = pool.pplns.miner_ids_for_address(wallet);
        let (unpaid, unpaid_unit) = if coin.is_empty() || coin == "zion" {
            let total: u64 = miner_ids.iter().map(|m| pool.pplns.unpaid_balance(m)).sum();
            (total, "flowers")
        } else {
            let total: u64 = miner_ids
                .iter()
                .map(|m| pool.pplns.unpaid_native_balance(m, &coin))
                .sum();
            (total, "native")
        };

        // Estimated earnings — the miner's weight fraction of the coin's
        // PPLNS slice, scaled by the pool's empirical daily emission
        // (24h payout sum from the store) and, for zion, by the
        // deterministic next-block miner subsidy. `window_share` is 0 when
        // the wallet has no weight in that coin's slice; `est_daily` is
        // null without a store; `est_per_block` is zion-only because
        // external legs pay from oracle revenue events, not block subsidy.
        let coin_key = if coin.is_empty() {
            "zion"
        } else {
            coin.as_str()
        };
        let miner_weight: u128 = miner_ids
            .iter()
            .map(|m| pool.pplns.window_weight_for_miner(m, coin_key))
            .sum();
        let coin_weight = pool.pplns.window_weight_for_coin(coin_key);
        let window_share = if coin_weight > 0 {
            miner_weight as f64 / coin_weight as f64
        } else {
            0.0
        };
        let est_daily = self
            .share_store
            .as_ref()
            .and_then(|s| {
                s.payouts_amount_sum_since(coin_key, now_s.saturating_sub(86_400) as i64)
                    .ok()
            })
            .map(|sum| (sum as f64 * window_share).min(u64::MAX as f64) as u64);
        let est_per_block = if coin_key == "zion" {
            self.current_height.as_ref().map(|h| {
                let next_h = h.load(Ordering::Relaxed).saturating_add(1);
                let miner_reward =
                    zion_core::emission::fee_split(zion_core::emission::block_subsidy(next_h)).0;
                (miner_reward as f64 * window_share).min(u64::MAX as f64) as u64
            })
        } else {
            None
        };

        // Payout ETA — seconds until `unpaid` crosses the coin's min-payout
        // threshold at the estimated accrual rate (est_daily). `0` = at or
        // above threshold (eligible for the next batch); `null` = the rate
        // can't be estimated (no store history yet).
        // A2.3: effective threshold incl. the per-wallet override (unified
        // path only — native-payout coins ignore the flowers override).
        let min_payout = pool.pplns.min_payout_for_miner(wallet, coin_key);
        let payout_eta_s = if unpaid >= min_payout {
            Some(0u64)
        } else {
            est_daily.and_then(|d| {
                (d > 0).then(|| {
                    ((min_payout - unpaid) as f64 * 86_400.0 / d as f64).min(u64::MAX as f64) as u64
                })
            })
        };

        json!({
            "ok": true,
            "coin": coin,
            "wallet": wallet,
            "worker_count": workers.len(),
            "workers": workers,
            "shares": {"accepted": valid, "rejected": invalid},
            "unpaid": unpaid.to_string(),
            "unpaid_unit": unpaid_unit,
            "min_payout": min_payout.to_string(),
            "payout_eta_s": payout_eta_s,
            "window_share": window_share,
            "est_daily": est_daily,
            "est_per_block": est_per_block,
            "last_seen_s": last_seen,
            "active": last_seen > 0 && now_s.saturating_sub(last_seen) < 600,
        })
        .to_string()
    }

    /// Persisted per-wallet hashrate timeseries —
    /// `/public/v1/miner/{coin}/{wallet}/history`. Aggregates the
    /// `miner_history` rows of every worker/login bound to the wallet
    /// (dotted login names + PPLNS address bindings), so a restart or
    /// worker rename doesn't fragment the series. `hps` is the
    /// expected-hashes/sec sum for the requested coin; `accepted`/`rejected`
    /// are the wallet's summed cumulative counters at sample time
    /// (per-interval deltas derived client-side; counters reset on pool
    /// restart, so the series may dip once per bounce).
    /// `worker` (A2.1) — when Some, only that worker's rows are aggregated;
    /// None keeps the wallet-wide rollup. Worker names are miner-supplied
    /// free text — equality filter only, never interpolated into SQL.
    fn build_public_miner_history(
        &self,
        coin: &str,
        wallet: &str,
        limit: usize,
        worker: Option<String>,
    ) -> String {
        let coin_key = if coin.is_empty() { "zion" } else { coin };
        let now_s = now_unix_seconds();
        let (extra_ids, store) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            (
                pool.pplns
                    .miner_ids_for_address(wallet)
                    .into_iter()
                    .map(str::to_string)
                    .collect::<Vec<String>>(),
                self.share_store.clone(),
            )
        };
        let Some(store) = store else {
            return json!({"ok": false, "error": "database not configured"}).to_string();
        };
        let since = now_s.saturating_sub(HISTORY_INTERVAL_S * HISTORY_CAP as u64);
        // limit applies to aggregated ts points; fetch up to 4× rows so
        // multi-worker wallets don't truncate early.
        let rows = store
            .load_miner_history(wallet, &extra_ids, since, (limit.saturating_mul(4)) as u32)
            .unwrap_or_default();
        let mut by_ts: std::collections::BTreeMap<u64, (f64, u64, u64)> =
            std::collections::BTreeMap::new();
        for (miner_id, row_worker, ts, hps_json, accepted, rejected) in rows {
            if let Some(w) = &worker {
                if worker_display_name(&miner_id, &row_worker) != w.as_str() {
                    continue;
                }
            }
            let hps_map: std::collections::HashMap<String, f64> =
                serde_json::from_str(&hps_json).unwrap_or_default();
            let entry = by_ts.entry(ts).or_default();
            entry.0 += hps_map.get(coin_key).copied().unwrap_or(0.0);
            entry.1 = entry.1.saturating_add(accepted);
            entry.2 = entry.2.saturating_add(rejected);
        }
        let skip = by_ts.len().saturating_sub(limit.min(by_ts.len()));
        let samples: Vec<serde_json::Value> = by_ts
            .into_iter()
            .skip(skip)
            .map(|(ts, (hps, accepted, rejected))| {
                json!({"ts": ts, "hps": hps, "accepted": accepted, "rejected": rejected})
            })
            .collect();
        json!({
            "ok": true,
            "coin": coin,
            "wallet": wallet,
            "interval_s": HISTORY_INTERVAL_S,
            "samples": samples,
        })
        .to_string()
    }

    fn build_prometheus_payload(&self) -> String {
        let (
            accepted,
            rejected,
            telemetry,
            stats,
            fees,
            sessions,
            dedup_dropped,
            persistence_configured,
            persist_success_timestamp_s,
            persist_failures_total,
        ) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            (
                pool.stats().0,
                pool.stats().1,
                pool.telemetry.clone(),
                pool.pplns.stats(),
                pool.pplns.fee_stats(),
                pool.session_counters
                    .active_sessions
                    .load(Ordering::Relaxed),
                pool.session_counters
                    .dedup_marks_dropped
                    .load(Ordering::Relaxed),
                pool.config.state_path.is_some(),
                pool.pplns_persist_success_timestamp_s,
                pool.pplns_persist_failures_total,
            )
        };
        let uptime_s = self.started_at.elapsed().as_secs();
        let now_s = now_unix_seconds();

        let reg = telemetry.lock().expect("telemetry lock poisoned");
        let hashrate_hps = reg.pool_hashrate_live();
        let hashrate_1h_hps = reg.pool_hashrate_1h();
        let miners_tracked = reg.miner_count();
        let blocks_found_total = reg.total_blocks_found();

        let mut body = String::new();
        body.push_str(&format!("zion_pool_uptime_s {uptime_s}\n"));
        body.push_str(&format!("zion_pool_active_sessions {sessions}\n"));
        body.push_str(&format!("zion_pool_miners_tracked {miners_tracked}\n"));
        body.push_str(&format!("zion_pool_hashrate_hps {hashrate_hps}\n"));
        body.push_str(&format!("zion_pool_hashrate_1h_hps {hashrate_1h_hps}\n"));
        body.push_str(&format!("zion_pool_dedup_marks_dropped {dedup_dropped}\n"));
        body.push_str(&format!("zion_pool_shares_accepted {accepted}\n"));
        body.push_str(&format!("zion_pool_shares_rejected {rejected}\n"));
        body.push_str(&format!(
            "zion_pool_blocks_found_total {blocks_found_total}\n"
        ));
        body.push_str(&format!(
            "zion_pool_pplns_window_size {}\n",
            stats.window_size
        ));
        body.push_str(&format!(
            "zion_pool_pplns_window_used {}\n",
            stats.window_used
        ));
        body.push_str(&format!(
            "zion_pool_pplns_window_total_difficulty {}\n",
            stats.window_total_difficulty
        ));
        body.push_str(&format!(
            "zion_pool_pplns_registered_miners {}\n",
            stats.registered_miners
        ));
        body.push_str(&format!(
            "zion_pool_pplns_total_paid_flowers {}\n",
            stats.total_paid_flowers
        ));
        body.push_str(&format!(
            "zion_pool_pplns_payout_rounds {}\n",
            stats.payout_rounds
        ));
        body.push_str(&format!(
            "zion_pool_pplns_persistence_configured {}\n",
            persistence_configured as u8
        ));
        body.push_str(&format!(
            "zion_pool_pplns_persist_success_timestamp_seconds {}\n",
            persist_success_timestamp_s
        ));
        body.push_str(&format!(
            "zion_pool_pplns_persist_failures_total {}\n",
            persist_failures_total
        ));
        body.push_str(&format!(
            "zion_pool_share_store_configured {}\n",
            self.share_store.is_some() as u8
        ));
        body.push_str(&format!(
            "zion_fee_humanitarian_pct {}\n",
            fees.humanitarian_pct
        ));
        body.push_str(&format!("zion_fee_issobella_pct {}\n", fees.issobella_pct));
        body.push_str(&format!("zion_fee_pool_pct {}\n", fees.pool_fee_pct));
        body.push_str(&format!("zion_fee_miner_pct {}\n", fees.miner_pct));

        // Per-worker metrics
        for (key, miner) in reg.all_miners() {
            let (miner_id, worker_short) = split_worker_key(key);
            let full_worker = if worker_short == "default" || worker_short.is_empty() {
                miner_id.clone()
            } else {
                format!("{miner_id}.{worker_short}")
            };
            let worker_label = sanitize_prometheus_label(&full_worker);
            let hashrate = miner.hashrate_live(now_s);
            let hashrate_1h = miner.hashrate_1h(now_s);

            body.push_str(&format!(
                "zion_pool_worker_hashrate_hps{{worker=\"{}\"}} {}\n",
                worker_label, hashrate
            ));
            body.push_str(&format!(
                "zion_pool_worker_hashrate_1h_hps{{worker=\"{}\"}} {}\n",
                worker_label, hashrate_1h
            ));
            body.push_str(&format!(
                "zion_pool_worker_valid_shares{{worker=\"{}\"}} {}\n",
                worker_label, miner.valid_shares
            ));
            body.push_str(&format!(
                "zion_pool_worker_invalid_shares{{worker=\"{}\"}} {}\n",
                worker_label, miner.invalid_shares
            ));
            body.push_str(&format!(
                "zion_pool_worker_blocks_found{{worker=\"{}\"}} {}\n",
                worker_label, miner.blocks_found
            ));
            body.push_str(&format!(
                "zion_pool_worker_last_share_time{{worker=\"{}\"}} {}\n",
                worker_label, miner.last_share_time_s
            ));
        }

        // F4-B: per-coin stream aggregates + leg health.  Shares are
        // keyed by telemetry `streams[coin]` — the same source the
        // /public/v1 tier reports.
        {
            let mut coin_valid: std::collections::HashMap<String, u64> =
                std::collections::HashMap::new();
            let mut coin_invalid: std::collections::HashMap<String, u64> =
                std::collections::HashMap::new();
            let mut coin_online: std::collections::HashMap<String, u64> =
                std::collections::HashMap::new();
            let mut coin_unverified: std::collections::HashMap<String, u64> =
                std::collections::HashMap::new();
            for (_, miner) in reg.all_miners() {
                for (coin, s) in &miner.streams {
                    *coin_valid.entry(coin.clone()).or_default() += s.valid_shares;
                    *coin_invalid.entry(coin.clone()).or_default() += s.invalid_shares;
                    *coin_unverified.entry(coin.clone()).or_default() += s.unverified_shares;
                    if s.last_share_time_s > 0 && now_s.saturating_sub(s.last_share_time_s) < 600 {
                        *coin_online.entry(coin.clone()).or_default() += 1;
                    }
                }
            }
            for coin in coin_valid.keys().chain(coin_invalid.keys()) {
                body.push_str(&format!(
                    "zion_pool_coin_shares_accepted{{coin=\"{}\"}} {}\n",
                    sanitize_prometheus_label(coin),
                    coin_valid.get(coin).copied().unwrap_or(0)
                ));
                body.push_str(&format!(
                    "zion_pool_coin_shares_rejected{{coin=\"{}\"}} {}\n",
                    sanitize_prometheus_label(coin),
                    coin_invalid.get(coin).copied().unwrap_or(0)
                ));
                body.push_str(&format!(
                    "zion_pool_coin_miners_online{{coin=\"{}\"}} {}\n",
                    sanitize_prometheus_label(coin),
                    coin_online.get(coin).copied().unwrap_or(0)
                ));
                // P-05 audit residual: accepts credited on unverifiable
                // upstream replies (accepted_unknown/stale) — upstream-
                // quality gauge, 0 in healthy operation.
                body.push_str(&format!(
                    "zion_pool_coin_shares_unverified{{coin=\"{}\"}} {}\n",
                    sanitize_prometheus_label(coin),
                    coin_unverified.get(coin).copied().unwrap_or(0)
                ));
            }
        }

        // F4-B: leg health gauges — alert on enabled-but-disconnected or
        // stale legs (job_age_ms > threshold). Leg state is gathered with
        // the pool guard released — a stuck leg mutex must not wedge this
        // scrape (Prometheus hits /metrics every interval).
        if let Some(ref bridge) = self.auxpow_bridge {
            let (l1_cfg, pearl) = {
                let pool = self.pool.lock().expect("pool lock poisoned");
                pool.leg_inputs()
            };
            for leg in Pool::leg_statuses_detached(l1_cfg, pearl.as_ref(), bridge) {
                let id = sanitize_prometheus_label(&leg.leg_id);
                let coin = sanitize_prometheus_label(&leg.coin.to_ascii_lowercase());
                body.push_str(&format!(
                    "zion_pool_leg_enabled{{leg=\"{}\",coin=\"{}\"}} {}\n",
                    id, coin, leg.enabled as u8
                ));
                body.push_str(&format!(
                    "zion_pool_leg_connected{{leg=\"{}\",coin=\"{}\"}} {}\n",
                    id, coin, leg.connected as u8
                ));
                if let Some(age) = leg.job_age_ms {
                    body.push_str(&format!(
                        "zion_pool_leg_job_age_ms{{leg=\"{}\",coin=\"{}\"}} {}\n",
                        id, coin, age
                    ));
                }
            }
        }

        // AuxPoW bridge metrics
        if let Some(ref bridge) = self.auxpow_bridge {
            let coins = bridge.enabled_coins();
            body.push_str(&format!("zion_auxpow_enabled_coins {}\n", coins.len()));
            for coin in &coins {
                let label = coin.as_str().to_lowercase();
                body.push_str(&format!(
                    "zion_auxpow_coin_enabled{{coin=\"{}\"}} 1\n",
                    label
                ));
                // Job queue depth
                let queue_depth = bridge.latest_job_for_coin(coin).map(|_| 1).unwrap_or(0);
                body.push_str(&format!(
                    "zion_auxpow_job_available{{coin=\"{}\"}} {}\n",
                    label, queue_depth
                ));
            }
        } else {
            body.push_str("zion_auxpow_enabled_coins 0\n");
        }

        // Payout backlog (2.B5 residual / 2.B7 visibility): unconfirmed
        // payout rows in the store — the deferred-queue depth an operator
        // watches when the treasury runs dry. One indexed scan per scrape.
        if let Some(ref store) = self.share_store {
            match store.query_unconfirmed_payouts() {
                Ok(rows) => {
                    let total: u64 = rows
                        .iter()
                        .map(|r| r.amount_flowers)
                        .fold(0u64, |a, v| a.saturating_add(v));
                    let mut by_coin: std::collections::HashMap<String, (u64, u64)> =
                        std::collections::HashMap::new();
                    for r in &rows {
                        let e = by_coin.entry(r.coin.clone()).or_default();
                        e.0 += 1;
                        e.1 = e.1.saturating_add(r.amount_flowers);
                    }
                    body.push_str(&format!("zion_pool_payouts_unconfirmed {}\n", rows.len()));
                    body.push_str(&format!(
                        "zion_pool_payouts_unconfirmed_flowers {}\n",
                        total
                    ));
                    for (coin, (n, amt)) in &by_coin {
                        body.push_str(&format!(
                            "zion_pool_payouts_unconfirmed_coin{{coin=\"{}\"}} {}\n",
                            sanitize_prometheus_label(coin),
                            n
                        ));
                        body.push_str(&format!(
                            "zion_pool_payouts_unconfirmed_coin_flowers{{coin=\"{}\"}} {}\n",
                            sanitize_prometheus_label(coin),
                            amt
                        ));
                    }
                }
                Err(e) => {
                    body.push_str(&format!("# payout backlog query failed: {}\n", e));
                }
            }
        }

        // TLS status
        let tls_enabled = std::env::var("ZION_POOL_TLS_BIND").is_ok();
        body.push_str(&format!(
            "zion_pool_tls_enabled {}\n",
            if tls_enabled { 1 } else { 0 }
        ));

        // Share relay status
        let relay_enabled = std::env::var("ZION_UPSTREAM_POOL_ADDR").is_ok();
        body.push_str(&format!(
            "zion_pool_share_relay_enabled {}\n",
            if relay_enabled { 1 } else { 0 }
        ));

        body
    }

    /// `/api/v1/revenue-stats` — per-group and per-source submit tracking.
    fn build_revenue_stats_payload(&self) -> String {
        let pool = self.pool.lock().expect("pool lock poisoned");
        let (accepted, rejected) = pool.stats();
        let uptime_s = self.started_at.elapsed().as_secs();

        let json = json!({
            "ok": true,
            "uptime_s": uptime_s,
            "total_accepted": accepted,
            "total_rejected": rejected,
            "groups": [
                {"group": "zion", "submits": accepted, "accepted": accepted, "pct": 100.0},
            ],
            "sources": [
                {"source": "zion", "submits": accepted, "accepted": accepted, "accept_rate_pct": if accepted + rejected > 0 { accepted as f64 * 100.0 / (accepted + rejected) as f64 } else { 0.0 }},
            ],
        });
        json.to_string()
    }

    /// `/api/v1/revenue-streams` — stream weights and per-source work units.
    fn build_revenue_streams_payload(&self) -> String {
        let json = json!({
            "ok": true,
            "multistream_enabled": false,
            "streams": [
                {"source": "zion", "weight_pct": 100.0, "submits": 0, "accepted": 0, "fee_rate_pct": 1.0},
            ],
            "weights_string": "zion:100.0",
            "description": "single-stream:zion:100.0",
        });
        json.to_string()
    }

    /// `/api/v1/routing-metrics` — routing stats snapshot.
    fn build_routing_metrics_payload(&self) -> String {
        // Use try_lock to avoid blocking the API thread
        let (accepted, rejected) = match self.pool.try_lock() {
            Ok(pool) => pool.stats(),
            Err(_) => (0, 0),
        };
        let uptime_s = self.started_at.elapsed().as_secs();

        // Get detailed routing stats from the stratum server's routing_stats
        let sources = if let Some(ref rs) = self.routing_stats {
            match rs.try_lock() {
                Ok(guard) => {
                    let routing = guard.snapshot_json();
                    routing.get("sources").cloned().unwrap_or(json!([]))
                }
                Err(_) => json!([]),
            }
        } else {
            json!([])
        };

        let json = json!({
            "ok": true,
            "uptime_s": uptime_s,
            "total_submits": accepted + rejected,
            "total_accepted": accepted,
            "total_rejected": rejected,
            "total_stale": 0,
            "groups": [
                {"group": "zion", "submits": accepted + rejected, "accepted": accepted, "pct": 100.0},
            ],
            "sources": sources,
        });
        json.to_string()
    }
}

/// Split "wallet.worker" or "wallet" into (wallet, worker_name).
fn split_worker(username: &str) -> (String, String) {
    if let Some(dot) = username.find('.') {
        let (wallet, worker) = username.split_at(dot);
        (wallet.to_string(), worker[1..].to_string())
    } else {
        (username.to_string(), "default".to_string())
    }
}

/// Take one periodic pool snapshot for the history ring buffer.
/// Mirrors the online-share logic in `build_public_coin_stats_payload`:
/// a miner is online for a coin when its stream's last share is inside
/// `ONLINE_WINDOW_S`.
/// Snapshot the pool history sample plus per-miner rows in one registry
/// lock — the per-miner rows feed `miner_history` for wallet timeseries.
fn sample_history(pool: &Arc<Mutex<Pool>>) -> (HistorySample, Vec<MinerHistoryRow>) {
    let now_s = now_unix_seconds();
    let pool = pool.lock().expect("pool lock poisoned");
    let (accepted, rejected) = pool.stats();
    let reg = pool.telemetry.lock().expect("telemetry lock poisoned");
    let hashrate = reg.pool_hashrate_live();
    let mut online_by_coin: std::collections::HashMap<String, u64> =
        std::collections::HashMap::new();
    let mut hashrate_by_coin: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();
    let mut miners_online = 0u64;
    let mut miner_rows = Vec::new();
    for (key, miner) in reg.all_miners() {
        let mut any_online = false;
        let mut hps: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
        for (coin, s) in miner.streams.iter() {
            if s.last_share_time_s > 0
                && now_s.saturating_sub(s.last_share_time_s) < ONLINE_WINDOW_S
            {
                *online_by_coin.entry(coin.clone()).or_insert(0) += 1;
                any_online = true;
            }
            let rate = miner.stream_hashrate(coin, crate::telemetry::HASHRATE_WINDOW_LIVE_S, now_s);
            if rate > 0.0 {
                *hashrate_by_coin.entry(coin.clone()).or_insert(0.0) += rate;
                hps.insert(coin.clone(), rate);
            }
        }
        if any_online {
            miners_online += 1;
        }
        // Only persist miners seen inside the retention window — sampling
        // long-dead entries would just rewrite rows the pruner deletes.
        if !hps.is_empty()
            || now_s.saturating_sub(miner.last_seen_s) < HISTORY_INTERVAL_S * HISTORY_CAP as u64
        {
            let (miner_id, worker) = split_worker_key(key);
            miner_rows.push(MinerHistoryRow {
                miner_id,
                worker,
                hps,
                accepted: miner.valid_shares,
                rejected: miner.invalid_shares,
            });
        }
    }
    (
        HistorySample {
            ts: now_s,
            hashrate,
            miners_online,
            online_by_coin,
            hashrate_by_coin,
            accepted,
            rejected,
        },
        miner_rows,
    )
}

/// Split a telemetry registry key "{miner_id}/{worker_name}".
fn split_worker_key(key: &str) -> (String, String) {
    if let Some(slash) = key.find('/') {
        let (miner, worker) = key.split_at(slash);
        (miner.to_string(), worker[1..].to_string())
    } else {
        (key.to_string(), "default".to_string())
    }
}

/// Render a miner telemetry record as a JSON value.
fn miner_to_json(
    worker: &str,
    address: &str,
    miner: Option<&crate::telemetry::MinerTelemetry>,
    now_s: u64,
) -> serde_json::Value {
    match miner {
        Some(m) => {
            let mut streams = serde_json::Map::new();
            for (stream, stats) in &m.streams {
                let mut obj = serde_json::Map::new();
                obj.insert("valid_shares".to_string(), json!(stats.valid_shares));
                obj.insert("invalid_shares".to_string(), json!(stats.invalid_shares));
                obj.insert(
                    "last_share_time".to_string(),
                    json!(stats.last_share_time_s),
                );
                let total = stats.valid_shares.saturating_add(stats.invalid_shares);
                if total > 0 {
                    obj.insert(
                        "accept_rate".to_string(),
                        json!(stats.valid_shares as f64 / total as f64),
                    );
                }
                if !stats.reject_reasons.is_empty() {
                    obj.insert("reject_reasons".to_string(), json!(stats.reject_reasons));
                }
                if stats.unverified_shares > 0 {
                    obj.insert(
                        "unverified_shares".to_string(),
                        json!(stats.unverified_shares),
                    );
                }
                if !stats.work.is_empty() {
                    obj.insert(
                        "hps_live".to_string(),
                        json!(m.stream_hashrate(
                            stream,
                            crate::telemetry::HASHRATE_WINDOW_LIVE_S,
                            now_s
                        )),
                    );
                    obj.insert(
                        "hps_1h".to_string(),
                        json!(m.stream_hashrate(
                            stream,
                            crate::telemetry::HASHRATE_WINDOW_1H_S,
                            now_s
                        )),
                    );
                }
                streams.insert(stream.clone(), serde_json::Value::Object(obj));
            }
            json!({
                "worker": worker,
                "address": address,
                "hashrate_hps": m.hashrate_live(now_s),
                "hashrate_1h_hps": m.hashrate_1h(now_s),
                "hashrate_24h_hps": m.hashrate_for_window(crate::telemetry::HASHRATE_WINDOW_24H_S, now_s),
                "valid_shares": m.valid_shares,
                "invalid_shares": m.invalid_shares,
                "blocks_found": m.blocks_found,
                "completed_jobs": m.completed_jobs,
                "last_share_time": m.last_share_time_s,
                "first_seen_s": m.first_seen_s,
                "last_seen_s": m.last_seen_s,
                "algorithm": m.algorithm,
                "backend": m.backend,
                "zis_user": m.zis_user,
                "paid_total_atomic": m.paid_total_atomic,
                "streams": serde_json::Value::Object(streams),
            })
        }
        None => {
            json!({
                "worker": worker,
                "address": address,
                "hashrate_hps": 0.0,
                "hashrate_1h_hps": 0.0,
                "hashrate_24h_hps": 0.0,
                "valid_shares": 0u64,
                "invalid_shares": 0u64,
                "blocks_found": 0u64,
                "completed_jobs": 0u64,
                "last_share_time": 0u64,
                "first_seen_s": 0u64,
                "last_seen_s": 0u64,
                "algorithm": "",
                "backend": "",
                "zis_user": "",
                "paid_total_atomic": 0u64,
                "streams": serde_json::Value::Object(serde_json::Map::new()),
            })
        }
    }
}

/// Escape a Prometheus label value: backslash and double-quote must be escaped.
fn sanitize_prometheus_label(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Deserialize a u64 that may arrive as a JSON number or a decimal string
/// (native base units on 12-decimal chains overflow JS-safe integers, so
/// oracle clients may quote them).
fn de_u64_str_or_num<'de, D>(d: D) -> Result<u64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(serde::Deserialize)]
    #[serde(untagged)]
    enum NumOrStr {
        N(u64),
        S(String),
    }
    match <NumOrStr as serde::Deserialize>::deserialize(d)? {
        NumOrStr::N(n) => Ok(n),
        NumOrStr::S(s) => s.trim().parse::<u64>().map_err(serde::de::Error::custom),
    }
}

fn parse_query_param(path: &str, key: &str) -> Option<String> {
    let q = path.split('?').nth(1)?;
    for pair in q.split('&') {
        if let Some(val) = pair.strip_prefix(&format!("{key}=")) {
            return Some(percent_decode(val));
        }
    }
    None
}

/// Minimal percent-decoder for query params (worker names are miner-supplied
/// free text — `encodeURIComponent` on the frontend produces `%XX`, `+` reads
/// as space per form convention). Malformed sequences pass through verbatim.
fn percent_decode(s: &str) -> String {
    if !s.contains('%') && !s.contains('+') {
        return s.to_string();
    }
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hex = |b: u8| -> Option<u8> {
                    match b {
                        b'0'..=b'9' => Some(b - b'0'),
                        b'a'..=b'f' => Some(b - b'a' + 10),
                        b'A'..=b'F' => Some(b - b'A' + 10),
                        _ => None,
                    }
                };
                match (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                    (Some(h), Some(l)) => {
                        out.push(h * 16 + l);
                        i += 3;
                    }
                    _ => {
                        out.push(b'%');
                        i += 1;
                    }
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_query_limit(path: &str, default: u32) -> u32 {
    if let Some(q) = path.split('?').nth(1) {
        for pair in q.split('&') {
            if let Some(val) = pair.strip_prefix("limit=") {
                if let Ok(n) = val.parse::<u32>() {
                    return n.clamp(1, 500);
                }
            }
        }
    }
    default
}

fn parse_query_miner_limit(path: &str, default_limit: u32) -> (Option<String>, u32) {
    let mut miner = None;
    let mut limit = default_limit;
    if let Some(q) = path.split('?').nth(1) {
        for pair in q.split('&') {
            if let Some(val) = pair.strip_prefix("miner=") {
                miner = Some(val.to_string());
            } else if let Some(val) = pair.strip_prefix("limit=") {
                if let Ok(n) = val.parse::<u32>() {
                    limit = n.clamp(1, 500);
                }
            }
        }
    }
    (miner, limit)
}

/// Normalize a stored worker identifier to the public worker name shown in
/// miner payloads. Stored rows use "{miner_id}.{worker}[@{group}]" (or a
/// free-form name); miners also see bare names for legacy/login variants.
/// Miner-supplied free text — equality comparisons only, never SQL.
fn worker_display_name<'a>(miner_id: &str, worker_short: &'a str) -> &'a str {
    let name = worker_short
        .strip_prefix(&format!("{miner_id}."))
        .unwrap_or(worker_short)
        .split('@')
        .next()
        .unwrap_or(worker_short);
    if name.is_empty() {
        "default"
    } else {
        name
    }
}

/// A2.2 offline-worker alerts — one pass over persisted subscriptions.
/// A worker (or the whole wallet when `worker == ""`) counts as online
/// while any matching telemetry entry was seen within `offline_secs`.
/// Transition dedup lives in `alert_subscriptions.state`; notifications
/// are best-effort — failures log, never propagate.
fn check_alert_subscriptions(pool: &Arc<Mutex<Pool>>, store: &ShareStore, notifier: &Notifier) {
    let subs = match store.load_all_alert_subscriptions() {
        Ok(s) => s,
        Err(e) => {
            warn!("alert watcher: subscription load failed: {e}");
            return;
        }
    };
    if subs.is_empty() {
        return;
    }
    let now = now_unix_seconds();
    // (miner_id, display_worker, last_seen_s) snapshot for live sessions.
    let live: Vec<(String, String, u64)> = {
        let pool = pool.lock().expect("pool lock poisoned");
        let reg = pool.telemetry.lock().expect("telemetry lock poisoned");
        reg.all_miners()
            .map(|(key, m)| {
                let (mid, wshort) = split_worker_key(key);
                let wname = worker_display_name(&mid, &wshort).to_string();
                (mid, wname, m.last_seen_s)
            })
            .collect()
    };
    for sub in subs {
        let wallet_prefix = format!("{}.", sub.miner_id);
        let online = live.iter().any(|(mid, w, last)| {
            (mid == &sub.miner_id || mid.starts_with(&wallet_prefix))
                && (sub.worker.is_empty() || w == &sub.worker)
                && now.saturating_sub(*last) <= sub.offline_secs
        });
        let want = if online { "online" } else { "offline" };
        if want == sub.state {
            continue;
        }
        let scope = if sub.worker.is_empty() {
            format!("wallet {}", sub.miner_id)
        } else {
            format!("worker {}", sub.worker)
        };
        let (event, text) = if online {
            ("worker_online", format!("{scope} is back online"))
        } else {
            (
                "worker_offline",
                format!("{scope} offline for >{} s", sub.offline_secs),
            )
        };
        info!("alert: {event} {scope} → {} {}", sub.channel, sub.target);
        match sub.channel.as_str() {
            "webhook" => notifier.send_webhook(
                &sub.target,
                &json!({
                    "event": event,
                    "miner_id": sub.miner_id,
                    "worker": sub.worker,
                    "offline_secs": sub.offline_secs,
                    "ts": now,
                }),
            ),
            "telegram" => notifier.send_telegram_to(&sub.target, &text),
            _ => {}
        }
        if let Err(e) = store.set_alert_state(sub.id, want, now) {
            warn!("alert watcher: state update failed: {e}");
        }
    }
}

/// Strip ".worker" and "@group" suffixes so the public feed only exposes the
/// wallet/address part of a miner id.
fn public_miner_id(miner_id: &str) -> &str {
    let end = miner_id
        .find(['.', '@'])
        .unwrap_or(miner_id.len());
    &miner_id[..end]
}

/// Public blocks feed — bare array (the route adds the {"ok":..} envelope) and
/// no worker names / raw miner ids.
fn serialize_public_blocks_json(blocks: &[crate::store::DbBlockRow]) -> serde_json::Value {
    // serde_json escapes all DB-controlled strings — worker/miner names are
    // miner-supplied and must never be interpolated raw.
    serde_json::Value::Array(
        blocks
            .iter()
            .map(|b| {
                // Per-block luck (A2.6): same formula as pool_luck_pct —
                // expected/actual = (net_diff/share_diff)/shares * 100.
                // >100% = lucky (fewer shares than statistically expected),
                // <100% = unlucky. null when the inputs are missing
                // (pre-v8 rows, or a block found before any share landed).
                let luck_pct = if b.share_difficulty > 0 && b.shares_since_prev > 0 {
                    let expected = b.network_difficulty as f64 / b.share_difficulty as f64;
                    Some(expected / b.shares_since_prev as f64 * 100.0)
                } else {
                    None
                };
                json!({
                    "coin": b.coin,
                    "height": b.height,
                    "hash": b.hash,
                    "miner": public_miner_id(&b.miner_id),
                    "share_difficulty": b.share_difficulty,
                    "network_difficulty": b.network_difficulty,
                    "shares_since_prev": b.shares_since_prev,
                    "luck_pct": luck_pct,
                    "status": b.status,
                    "ts": b.ts,
                    "confirmed_at": b.confirmed_at,
                })
            })
            .collect(),
    )
}

/// Lifecycle label for one payout row: queued (computed, awaiting
/// broadcast — lives in `pool.pplns.pending_payouts`), sent (tx broadcast,
/// awaiting confirmations), confirmed (chain-confirmed), superseded
/// (dead tx voided and requeued under a fresh payout — evidence row).
fn payout_lifecycle(confirmed: bool, tx_id: &str, superseded_tx_id: &str) -> &'static str {
    if !superseded_tx_id.is_empty() {
        "superseded"
    } else if confirmed {
        "confirmed"
    } else if tx_id.is_empty() {
        "queued"
    } else {
        "sent"
    }
}

/// Queued (not-yet-broadcast) payouts from the in-memory PPLNS queue,
/// serialized in the same shape as DB rows so clients can render one
/// feed. `payout_chain` maps to the public coin id.
fn queued_payout_json(height: u64, e: &crate::v3_pplns::PayoutEntry) -> serde_json::Value {
    let coin = match e.coin.as_deref() {
        Some(c) => c.to_ascii_lowercase(),
        None => match e.payout_chain.as_deref() {
            None | Some("") | Some("zion") => "zion".to_string(),
            Some("quantus") => "qtu".to_string(),
            Some(c) => c.to_ascii_lowercase(),
        },
    };
    json!({
        "ts": null,
        "height": height,
        "address": e.address,
        "coin": coin,
        "amount_flowers": e.amount,
        "tx_id": null,
        "confirmations": 0,
        "confirmed": false,
        "status": "queued",
    })
}

/// Snapshot of queued (not-yet-broadcast) payouts as public JSON rows.
/// Short pool lock — only clones the pending vec, no I/O under lock.
fn queued_payouts_snapshot(
    pool: &Arc<Mutex<crate::pool::Pool>>,
    coin_filter: &str,
    address_filter: Option<&str>,
) -> Vec<serde_json::Value> {
    let pending = match pool.lock() {
        Ok(guard) => guard.pending_payouts.clone(),
        Err(_) => return Vec::new(),
    };
    pending
        .iter()
        .map(|(h, e)| queued_payout_json(*h, e))
        .filter(|row| {
            let c = row["coin"].as_str().unwrap_or_default();
            let a = row["address"].as_str().unwrap_or_default();
            (coin_filter.is_empty() || c == coin_filter)
                && address_filter.map(|w| a == w).unwrap_or(true)
        })
        .collect()
}

/// Public payouts feed — bare array; `address` is authoritative, `miner_id`
/// (worker-suffixed) stays internal.
fn serialize_public_payouts_json(payouts: &[crate::store::PayoutRow]) -> serde_json::Value {
    serde_json::Value::Array(
        payouts
            .iter()
            .map(|p| {
                json!({
                    "ts": p.ts,
                    "address": p.address,
                    "coin": p.coin,
                    "amount_flowers": p.amount_flowers,
                    "tx_id": p.tx_id,
                    "height": p.height,
                    "block_hash": p.block_hash,
                    "confirmations": p.confirmations,
                    "confirmed": p.confirmed,
                    "superseded_tx_id": p.superseded_tx_id,
                    "status": payout_lifecycle(p.confirmed, &p.tx_id, &p.superseded_tx_id),
                })
            })
            .collect(),
    )
}

fn serialize_blocks_json(blocks: &[crate::store::DbBlockRow]) -> String {
    json!({
        "ok": true,
        "blocks": blocks.iter().map(|b| json!({
            "coin": b.coin,
            "height": b.height,
            "hash": b.hash,
            "miner_id": b.miner_id,
            "worker_name": b.worker_name,
            "share_difficulty": b.share_difficulty,
            "network_difficulty": b.network_difficulty,
            "status": b.status,
            "ts": b.ts,
            "confirmed_at": b.confirmed_at,
        })).collect::<Vec<_>>(),
    })
    .to_string()
}

fn serialize_payouts_json(payouts: &[crate::store::PayoutRow]) -> String {
    json!({
        "ok": true,
        "payouts": payouts.iter().map(|p| json!({
            "ts": p.ts,
            "miner_id": p.miner_id,
            "address": p.address,
            "coin": p.coin,
            "amount_flowers": p.amount_flowers,
            "tx_id": p.tx_id,
            "height": p.height,
            "block_hash": p.block_hash,
            "confirmations": p.confirmations,
            "confirmed": p.confirmed,
            "superseded_tx_id": p.superseded_tx_id,
            "status": payout_lifecycle(p.confirmed, &p.tx_id, &p.superseded_tx_id),
        })).collect::<Vec<_>>(),
    })
    .to_string()
}

fn serialize_miners_json(miners: &[crate::store::MinerStatsRow], total_count: u64) -> String {
    json!({
        "ok": true,
        "miner_count": total_count,
        "miners": miners.iter().map(|m| json!({
            "miner_id": m.miner_id,
            "first_seen": m.first_seen,
            "last_seen": m.last_seen,
            "total_shares": m.total_shares,
            "accepted_shares": m.accepted_shares,
            "rejected_shares": m.rejected_shares,
            "total_paid_flowers": m.total_paid_flowers,
        })).collect::<Vec<_>>(),
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_limit_default() {
        assert_eq!(parse_query_limit("/blocks", 50), 50);
        assert_eq!(parse_query_limit("/blocks?limit=10", 50), 10);
        assert_eq!(parse_query_limit("/blocks?limit=999", 50), 500);
        assert_eq!(parse_query_limit("/blocks?limit=0", 50), 1);
    }

    #[test]
    fn parse_miner_limit() {
        let (miner, limit) = parse_query_miner_limit("/payouts?miner=abc&limit=20", 50);
        assert_eq!(miner, Some("abc".to_string()));
        assert_eq!(limit, 20);
    }

    #[test]
    fn public_payouts_report_queued_sent_confirmed_lifecycle() {
        let pool = test_pool();
        {
            let mut p = pool.lock().unwrap();
            p.pending_payouts.push((
                97_500,
                crate::v3_pplns::PayoutEntry {
                    miner_id: "alice".into(),
                    address: "zion1alice".into(),
                    amount: 1_500_000,
                    share_count: 12,
                    payout_chain: None,
                    native_units: false,
                    coin: None,
                    revenue_event: None,
                },
            ));
        }
        let store = Arc::new(ShareStore::open_in_memory().unwrap());
        store
            .record_payout(&crate::store::PayoutRecord {
                miner_id: "bob".into(),
                address: "zion1bob".into(),
                amount_flowers: 2_000_000,
                tx_id: "tx_sent".into(),
                height: 97_400,
                block_hash: "bh".into(),
                coin: "zion".into(),
            })
            .unwrap();
        store
            .record_payout(&crate::store::PayoutRecord {
                miner_id: "carol".into(),
                address: "zion1carol".into(),
                amount_flowers: 3_000_000,
                tx_id: "tx_conf".into(),
                height: 97_300,
                block_hash: "bh2".into(),
                coin: "zion".into(),
            })
            .unwrap();
        store.confirm_payout("tx_conf", 30).unwrap();
        let api = PoolApi::new(pool, Some(store), None);

        let resp = request(&api, "GET", "/public/v1/payouts?limit=50", "");
        assert!(resp.starts_with("HTTP/1.1 200 OK"), "{resp}");
        let body: serde_json::Value =
            serde_json::from_str(resp.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        let rows = body["payouts"].as_array().unwrap();
        assert_eq!(rows.len(), 3, "{body}");

        let queued = rows
            .iter()
            .find(|r| r["address"] == "zion1alice")
            .expect("queued row present");
        assert_eq!(queued["status"], "queued");
        assert!(queued["tx_id"].is_null());
        assert_eq!(queued["coin"], "zion");
        assert_eq!(queued["height"], 97_500);

        let sent = rows
            .iter()
            .find(|r| r["tx_id"] == "tx_sent")
            .expect("sent row present");
        assert_eq!(sent["status"], "sent");
        assert_eq!(sent["confirmed"], false);

        let conf = rows
            .iter()
            .find(|r| r["tx_id"] == "tx_conf")
            .expect("confirmed row present");
        assert_eq!(conf["status"], "confirmed");
        assert_eq!(conf["confirmed"], true);
    }

    #[test]
    fn stats_payload_reports_shared_counters_and_port() {
        let telemetry = Arc::new(Mutex::new(crate::telemetry::MinerTelemetryRegistry::new()));
        let config = crate::config::PoolConfig {
            port: 8444,
            ..Default::default()
        };
        let pool = Arc::new(Mutex::new(Pool::new(config, telemetry)));
        {
            let pool = pool.lock().unwrap();
            pool.session_counters
                .total_connections
                .store(7, Ordering::Relaxed);
            pool.session_counters
                .active_sessions
                .store(3, Ordering::Relaxed);
        }
        let api = PoolApi::new(pool, None, None);
        let payload: serde_json::Value = serde_json::from_str(&api.build_stats_payload()).unwrap();
        assert_eq!(payload["sessions"], 3);
        assert_eq!(payload["total_connections"], 7);
        assert_eq!(payload["pool"]["port"], 8444);
    }

    #[test]
    fn prometheus_payload_exposes_persistence_health() {
        let api = PoolApi::new(test_pool(), None, None);
        let payload = api.build_prometheus_payload();

        assert!(payload.contains("zion_pool_pplns_persistence_configured 0\n"));
        assert!(payload.contains("zion_pool_pplns_persist_success_timestamp_seconds 0\n"));
        assert!(payload.contains("zion_pool_pplns_persist_failures_total 0\n"));
        assert!(payload.contains("zion_pool_share_store_configured 0\n"));
    }

    fn test_pool() -> Arc<Mutex<Pool>> {
        let telemetry = Arc::new(Mutex::new(crate::telemetry::MinerTelemetryRegistry::new()));
        Arc::new(Mutex::new(Pool::new(
            crate::config::PoolConfig::default(),
            telemetry,
        )))
    }

    fn request(api: &PoolApi, method: &str, path: &str, body: &str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let mut client = TcpStream::connect(addr).unwrap();
        let (server, _) = listener.accept().unwrap();
        std::thread::scope(|scope| {
            let handler = scope.spawn(move || api.handle_request(server).unwrap());
            let request = format!(
                "{method} {path} HTTP/1.1\r\nHost: localhost\r\nX-Admin-Key: test-admin\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            client.write_all(request.as_bytes()).unwrap();
            client.shutdown(std::net::Shutdown::Write).unwrap();
            let mut response = String::new();
            client.read_to_string(&mut response).unwrap();
            handler.join().unwrap();
            response
        })
    }

    /// Raw request helper with an explicit `X-API-Key` header value — needed
    /// for the binary state-export endpoints whose body is not UTF-8 JSON.
    fn request_raw(api: &PoolApi, path: &str, api_key: Option<&str>) -> (String, Vec<u8>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let mut client = TcpStream::connect(addr).unwrap();
        let (server, _) = listener.accept().unwrap();
        std::thread::scope(|scope| {
            let handler = scope.spawn(move || api.handle_request(server).unwrap());
            let key_line = api_key
                .map(|k| format!("X-API-Key: {k}\r\n"))
                .unwrap_or_default();
            let request = format!(
                "GET {path} HTTP/1.1\r\nHost: localhost\r\n{key_line}Connection: close\r\n\r\n"
            );
            client.write_all(request.as_bytes()).unwrap();
            client.shutdown(std::net::Shutdown::Write).unwrap();
            let mut response = Vec::new();
            client.read_to_end(&mut response).unwrap();
            handler.join().unwrap();
            let split = response
                .windows(4)
                .position(|w| w == b"\r\n\r\n")
                .expect("HTTP response has header/body split");
            let head = String::from_utf8_lossy(&response[..split]).into_owned();
            (head, response[split + 4..].to_vec())
        })
    }

    #[test]
    fn state_export_serves_authenticated_binary_snapshots() {
        let dir = std::env::temp_dir().join(format!(
            "zion_pool_state_export_{}_{}",
            std::process::id(),
            crate::telemetry::now_unix_seconds()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let state_path = dir.join("pool-pplns.json");
        let payouts_path = dir.join("pool-pplns.json.payouts.json");
        let db_path = dir.join("pool-store.db");
        std::fs::write(&state_path, br#"{"shares":[]}"#).unwrap();
        std::fs::write(&payouts_path, br#"{"paid_block_heights":[1]}"#).unwrap();

        let telemetry = Arc::new(Mutex::new(crate::telemetry::MinerTelemetryRegistry::new()));
        let pool = Pool::new(
            crate::config::PoolConfig {
                api_key: Some("test-api".into()),
                ..Default::default()
            },
            telemetry,
        );
        let pool = Arc::new(Mutex::new(pool));
        // Point at the export files after construction — Pool::new would
        // try to *parse* the snapshot at startup, while the export path
        // only reads the raw bytes.
        pool.lock().unwrap().config.state_path = Some(state_path.to_string_lossy().into_owned());
        let store = Arc::new(ShareStore::open(&db_path).unwrap());
        store
            .record_coin_revenue("qtu:bal:0:100", "qtu", 100, 42, 2, 95)
            .unwrap();
        let api = PoolApi::new(pool, Some(store), None);

        // Unauthorized: no key and wrong key → 401 before any export work.
        let (head, _) = request_raw(&api, "/api/v1/state/pplns", None);
        assert!(head.starts_with("HTTP/1.1 401"), "{head}");
        let (head, _) = request_raw(&api, "/api/v1/state/pplns", Some("wrong"));
        assert!(head.starts_with("HTTP/1.1 401"), "{head}");

        // Authorized: byte-identical file bodies, octet-stream content type.
        let (head, body) = request_raw(&api, "/api/v1/state/pplns", Some("test-api"));
        assert!(head.starts_with("HTTP/1.1 200 OK"), "{head}");
        assert!(head.contains("application/octet-stream"), "{head}");
        assert_eq!(body, br#"{"shares":[]}"#);

        let (head, body) = request_raw(&api, "/api/v1/state/payouts", Some("test-api"));
        assert!(head.starts_with("HTTP/1.1 200 OK"), "{head}");
        assert_eq!(body, br#"{"paid_block_heights":[1]}"#);

        // DB snapshot is a valid, reopenable SQLite file containing live rows.
        let (head, body) = request_raw(&api, "/api/v1/state/db", Some("test-api"));
        assert!(head.starts_with("HTTP/1.1 200 OK"), "{head}");
        assert_eq!(&body[..16], b"SQLite format 3\0");
        let snap_path = dir.join("snapshot-check.db");
        std::fs::write(&snap_path, &body).unwrap();
        let snap = ShareStore::open(&snap_path).unwrap();
        assert_eq!(
            snap.coin_revenue_amount("qtu:bal:0:100").unwrap(),
            Some(100)
        );
        drop(snap);

        // Unknown state resource → 404.
        let (head, _) = request_raw(&api, "/api/v1/state/nope", Some("test-api"));
        assert!(head.starts_with("HTTP/1.1 404"), "{head}");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn coin_revenue_endpoint_commits_snapshot_and_repeats_outbox_until_ack() {
        let state_path = std::env::temp_dir().join(format!(
            "zion_pool_api_revenue_{}_{}.json",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let telemetry = Arc::new(Mutex::new(crate::telemetry::MinerTelemetryRegistry::new()));
        let mut config = crate::config::PoolConfig {
            admin_key: Some("test-admin".into()),
            native_payout_coins: vec!["qtu".into()],
            state_path: Some(state_path.to_string_lossy().into_owned()),
            ..Default::default()
        };
        config.min_payout_native.insert("qtu".into(), 1);
        let mut pool = Pool::new(config, telemetry);
        pool.pplns
            .register_address_with_chain("alice", "qz1alice", "quantus");
        pool.pplns
            .record_share_with_diff_for_coin("alice", "rig", 1, 100, "qtu");
        let pool = Arc::new(Mutex::new(pool));
        let store = Arc::new(ShareStore::open_in_memory().unwrap());
        let api = PoolApi::new(pool, Some(store.clone()), None);

        let revenue = request(
            &api,
            "POST",
            "/admin/coin-revenue",
            r#"{"coin":"qtu","amount":5000000,"ref_height":42,"event":"qtu:event:42"}"#,
        );
        assert!(revenue.starts_with("HTTP/1.1 200 OK"), "{revenue}");
        let revenue_body = revenue.split("\r\n\r\n").nth(1).unwrap();
        let revenue_json: serde_json::Value = serde_json::from_str(revenue_body).unwrap();
        assert_eq!(revenue_json["emitted"], 1);

        let payout_path = "/admin/external-payouts?chain=quantus";
        let first = request(&api, "POST", payout_path, "");
        let second = request(&api, "POST", payout_path, "");
        let first_json: serde_json::Value =
            serde_json::from_str(first.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        let second_json: serde_json::Value =
            serde_json::from_str(second.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        let outbox_id = first_json["payouts"][0]["outbox_id"]
            .as_str()
            .expect("durable payout has an outbox id");
        assert_eq!(second_json["payouts"][0]["outbox_id"], outbox_id);

        let ack = request(
            &api,
            "POST",
            "/admin/external-payouts/ack",
            &serde_json::json!({"chain": "quantus", "ids": [outbox_id]}).to_string(),
        );
        assert!(ack.starts_with("HTTP/1.1 200 OK"), "{ack}");
        let after_ack = request(&api, "POST", payout_path, "");
        let after_ack_json: serde_json::Value =
            serde_json::from_str(after_ack.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        assert_eq!(after_ack_json["count"], 0);

        std::fs::remove_file(state_path).unwrap();
    }

    fn test_job(
        coin: zion_cosmic_harmony::ExternalCoin,
        job_id: &str,
        fresh: bool,
    ) -> crate::auxpow_bridge::JobPackage {
        crate::auxpow_bridge::JobPackage {
            external_job_id: job_id.into(),
            coin,
            header_hex: "deadbeef".into(),
            target_hex: "ffff".into(),
            height: 1,
            algorithm: coin.algorithm().into(),
            extranonce1_hex: "00".into(),
            ntime: "00000000".into(),
            seed_hash_hex: String::new(),
            eq_params: String::new(),
            eq_pers: String::new(),
            received_at: if fresh {
                Some(Instant::now())
            } else {
                Some(Instant::now() - Duration::from_secs(600))
            },
        }
    }

    #[test]
    fn auxpow_summary_disabled_when_no_bridge() {
        let api = PoolApi::new(test_pool(), None, None);
        let v = api.auxpow_summary_json();
        assert_eq!(v["enabled"], false);
        assert!(v.get("coins").is_none());
    }

    #[test]
    fn auxpow_summary_lists_coins_and_freshness() {
        use zion_cosmic_harmony::ExternalCoin;

        let bridge = crate::auxpow_bridge::MultiAuxPowBridge::new();
        let (gpu_bridge, _rx1) = crate::auxpow_bridge::AuxPowBridge::new(true);
        let (cpu_bridge, _rx2) = crate::auxpow_bridge::AuxPowBridge::new(true);
        bridge.insert(ExternalCoin::Quantus, gpu_bridge.clone());
        bridge.insert(ExternalCoin::Verus, cpu_bridge.clone());

        gpu_bridge.push_job(test_job(ExternalCoin::Quantus, "qtu-job-1", true));
        cpu_bridge.push_job(test_job(ExternalCoin::Verus, "vrsc-job-1", false));

        std::env::set_var("ZION_POOL_AUXPOW_POOL_QTU", "eu.quantus.k1pool.com:5660");
        let api = PoolApi::new(test_pool(), None, Some(bridge));
        let v = api.auxpow_summary_json();
        std::env::remove_var("ZION_POOL_AUXPOW_POOL_QTU");

        assert_eq!(v["enabled"], true);
        let coins: Vec<&str> = v["coins"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c.as_str().unwrap())
            .collect();
        assert_eq!(coins, ["QTU", "VRSC"]); // deterministic ticker order

        let details = v["coin_details"].as_array().unwrap();
        assert_eq!(details.len(), 2);

        let qtu = &details[0];
        assert_eq!(qtu["ticker"], "QTU");
        assert_eq!(qtu["algorithm"], "qpow-poseidon2");
        assert_eq!(qtu["device"], "gpu");
        assert_eq!(qtu["upstream"], "eu.quantus.k1pool.com:5660");
        assert_eq!(qtu["job_id"], "qtu-job-1");
        assert_eq!(qtu["job_fresh"], true);

        let vrsc = &details[1];
        assert_eq!(vrsc["ticker"], "VRSC");
        assert_eq!(vrsc["algorithm"], "verushash");
        assert_eq!(vrsc["device"], "cpu");
        // 10-minute-old job is stale → not fresh
        assert_eq!(vrsc["job_fresh"], false);
        assert_eq!(vrsc["job_id"], "vrsc-job-1");
        // native block is QTU-only
        assert!(vrsc.get("native").is_none());

        // QTU exposes the native-leg status even when not configured
        assert_eq!(qtu["native"]["enabled"], false);
        assert_eq!(qtu["native"]["connected"], false);
        assert_eq!(qtu["native"]["share_pct"], 0);
    }

    #[test]
    fn auxpow_summary_qtu_native_status() {
        use zion_cosmic_harmony::ExternalCoin;

        let bridge = crate::auxpow_bridge::MultiAuxPowBridge::new();
        let (gpu_bridge, _rx) = crate::auxpow_bridge::AuxPowBridge::new(true);
        bridge.insert(ExternalCoin::Quantus, gpu_bridge);

        // Configure native leg at 25% and mark the QUIC link as connected.
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        bridge.configure_native(tx, 25);
        bridge.set_native_connected(true);

        let api = PoolApi::new(test_pool(), None, Some(bridge));
        let v = api.auxpow_summary_json();
        let qtu = &v["coin_details"][0];

        assert_eq!(qtu["native"]["enabled"], true);
        assert_eq!(qtu["native"]["connected"], true);
        assert_eq!(qtu["native"]["share_pct"], 25);
        assert_eq!(qtu["native"]["job_id"], serde_json::Value::Null);
    }

    #[test]
    fn auxpow_summary_pearl_block() {
        let pool = test_pool();
        pool.lock().unwrap().pearl = None;
        let api = PoolApi::new(pool.clone(), None, None);
        let v = api.auxpow_summary_json();
        assert!(v.get("pearl").is_none());

        let v2: serde_json::Value = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/pearl_cuda_live_share.json"
        )))
        .unwrap();
        let header: [u8; 76] = hex::decode(v2["header_hex"].as_str().unwrap())
            .unwrap()
            .try_into()
            .unwrap();
        let job = crate::pearl::PearlJob {
            header,
            target: "11576915460202502748112183870099358720600496688251011072"
                .parse()
                .unwrap(),
            cert_version: 3,
            header_b64: String::new(),
            target_dec: String::new(),
        };
        let up =
            crate::pearl_upstream::PearlUpstream::new(crate::pearl_upstream::PearlUpstreamConfig {
                endpoint: "127.0.0.1:9".to_string(),
                wallet: "prl1w".to_string(),
                worker: "w".to_string(),
                password: "x".to_string(),
                job_ttl: Duration::from_millis(90_000),
                fwd_max: Duration::from_millis(90_000),
                fwd_grace: None,
                ring_cap: crate::pearl_upstream::DEFAULT_JOB_RING_CAP,
            });
        let rt = crate::pearl_gateway::PearlRuntime::for_test_hybrid(
            "127.0.0.1:1",
            256,
            30_000,
            Some(job),
            Some(up),
            100,
        );
        pool.lock().unwrap().pearl = Some(rt);
        let api = PoolApi::new(pool, None, None);
        let v = api.auxpow_summary_json();
        let pearl = &v["pearl"];
        assert_eq!(pearl["native"]["enabled"], true);
        assert_eq!(pearl["native"]["share_pct"], 100);
        assert!(pearl["native"]["job_id"].is_string());
        assert!(pearl["native"]["job_age_ms"].is_number());
        assert_eq!(pearl["upstream"]["enabled"], true);
        assert_eq!(pearl["upstream"]["connected"], false);
        assert_eq!(pearl["upstream"]["job_id"], serde_json::Value::Null);
        assert_eq!(pearl["upstream"]["pending_submits"], 0);
        assert_eq!(pearl["upstream"]["submits"], 0);
        assert_eq!(pearl["upstream"]["accepted"], 0);
        assert_eq!(pearl["upstream"]["rejected"], 0);
        assert_eq!(pearl["upstream"]["unknown"], 0);
        assert_eq!(pearl["upstream"]["busy"], 0);
        assert_eq!(pearl["served_native"], 0);
        assert_eq!(pearl["served_upstream"], 0);
    }

    #[test]
    fn profit_switch_lists_full_coin_catalogue() {
        let api = PoolApi::new(test_pool(), None, None);
        let payload: serde_json::Value =
            serde_json::from_str(&api.build_profit_switch_payload()).unwrap();
        let coins = payload["coins"].as_array().unwrap();
        // CoinProfile::all() exposes every known ExternalCoin, not just the
        // enabled defaults() subset — professional catalogue exposure.
        assert!(
            coins.len() >= 30,
            "expected full catalogue, got {}",
            coins.len()
        );
        assert!(coins.iter().all(|c| c.get("served").is_some()));
        // Pearl is registered but deliberately disabled.
        let prl = coins.iter().find(|c| c["coin"] == "PRL").unwrap();
        assert_eq!(prl["enabled"], false);
        assert!(prl["disabled_reason"].is_string());
    }

    // ---- F4: /public/v1 tier -------------------------------------------

    #[test]
    fn public_coins_lists_legs_without_internal_fields() {
        use zion_cosmic_harmony::ExternalCoin;

        let bridge = crate::auxpow_bridge::MultiAuxPowBridge::new();
        let (gpu_bridge, _rx) = crate::auxpow_bridge::AuxPowBridge::new(true);
        bridge.insert(ExternalCoin::Quantus, gpu_bridge.clone());
        gpu_bridge.push_job(test_job(ExternalCoin::Quantus, "qtu-job-x", true));

        let api = PoolApi::new(test_pool(), None, Some(bridge));
        let payload: serde_json::Value =
            serde_json::from_str(&api.build_public_coins_payload()).unwrap();
        assert_eq!(payload["ok"], true);
        let coins = payload["coins"].as_array().unwrap();

        // ZION always present even without bridge legs.
        let zion = coins.iter().find(|c| c["coin"] == "zion").unwrap();
        assert!(!zion["legs"].as_array().unwrap().is_empty());
        assert!(zion["fee_bps"].is_number());
        assert!(zion["min_payout"].is_string());

        // QTU has both native and upstream legs folded under one coin.
        let qtu = coins.iter().find(|c| c["coin"] == "qtu").unwrap();
        let kinds: Vec<&str> = qtu["legs"]
            .as_array()
            .unwrap()
            .iter()
            .map(|l| l["kind"].as_str().unwrap())
            .collect();
        assert!(kinds.contains(&"native"));
        assert!(kinds.contains(&"upstream"));

        // Public-safe shape: no raw job ids, endpoints, or worker names.
        let body = payload.to_string();
        for forbidden in [
            "job_id",
            "upstream_url",
            "endpoint",
            "worker",
            "pool_address",
        ] {
            assert!(!body.contains(forbidden), "leaked field: {forbidden}");
        }

        // A3.4: the protocol reward split is public on /coins.
        let fees = &payload["fees"];
        assert_eq!(fees["miner_pct"], 89);
        assert_eq!(fees["humanitarian_pct"], 5);
        assert_eq!(fees["issobella_pct"], 5);
        assert_eq!(fees["pool_fee_pct"], 1);

        // A2.4: advertised vardiff policy matches what the stratum enforces
        // (same VarDiffConfig::from_env source, no env → defaults).
        let vd = &payload["vardiff"];
        assert_eq!(vd["start"], 1000);
        assert_eq!(vd["min"], 1000);
        assert_eq!(vd["max"], 100_000);
        assert_eq!(vd["target_secs"], 15);
        assert_eq!(vd["retarget_shares"], 8);
    }

    // ---- snapshot cache (starvation wedge fix) --------------------------

    #[test]
    fn snapshots_serve_last_good_build() {
        let api = PoolApi::new(test_pool(), None, None);
        // Empty cache falls back to the inline build.
        let fresh = api.build_stats_payload();
        assert_eq!(
            PoolApi::snapshot_or(&api.snapshots.stats, || api.build_stats_payload()),
            fresh
        );
        // After a refresh the cached body is served verbatim — the inline
        // fallback must not fire once a snapshot exists.
        api.refresh_snapshots();
        let cached = api
            .snapshots
            .stats
            .read()
            .unwrap()
            .as_ref()
            .unwrap()
            .to_string();
        assert!(!cached.is_empty());
        assert_eq!(
            PoolApi::snapshot_or(&api.snapshots.stats, || "SHOULD-NOT-BUILD".to_string()),
            cached
        );
        // Metrics + public coins snapshots were populated by the same pass.
        assert!(api.snapshots.metrics.read().unwrap().is_some());
        assert!(api.snapshots.public_coins.read().unwrap().is_some());
    }

    #[test]
    fn snapshot_slots_refresh_independently() {
        // A stale slot is replaced wholesale, never appended — the served
        // body always matches the latest successful build.
        let api = PoolApi::new(test_pool(), None, None);
        *api.snapshots.stats.write().unwrap() = Some("STALE-MARKER".into());
        api.refresh_snapshots();
        let cached = api
            .snapshots
            .stats
            .read()
            .unwrap()
            .as_ref()
            .unwrap()
            .to_string();
        assert_ne!(cached, "STALE-MARKER");
        assert!(cached.contains("\"ok\":true") || cached.contains("ok"));
    }

    #[test]
    fn public_blocks_carry_luck_shares_and_tip() {
        let pool = test_pool();
        let store = Arc::new(ShareStore::open_in_memory().unwrap());
        let height = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(500));
        let api = PoolApi::new(pool, Some(store.clone()), None).with_current_height(height);

        // One confirmed block: net_diff 100_000, share_diff 1_000 → expected
        // 100 shares; actually took 50 → luck 200% (lucky).
        store
            .record_block(&crate::store::BlockRecord {
                coin: "zion".to_string(),
                height: 450,
                hash: "aa".repeat(32),
                miner_id: "miner-a".to_string(),
                worker_name: "w".to_string(),
                share_difficulty: 1_000,
                network_difficulty: 100_000,
                shares_since_prev: 50,
                status: "confirmed".to_string(),
            })
            .unwrap();
        // Pre-v8 row without shares_since_prev → luck must be null.
        store
            .record_block(&crate::store::BlockRecord {
                coin: "zion".to_string(),
                height: 440,
                hash: "bb".repeat(32),
                miner_id: "miner-b".to_string(),
                worker_name: "w".to_string(),
                share_difficulty: 1_000,
                network_difficulty: 100_000,
                shares_since_prev: 0,
                status: "orphaned".to_string(),
            })
            .unwrap();

        let resp = request(&api, "GET", "/public/v1/blocks", "");
        assert!(resp.starts_with("HTTP/1.1 200"), "{resp}");
        let json_start = resp.find("\r\n\r\n").unwrap() + 4;
        let body: serde_json::Value = serde_json::from_str(&resp[json_start..]).unwrap();
        assert_eq!(body["tip"], 500);

        let blocks = body["blocks"].as_array().unwrap();
        let lucky = blocks.iter().find(|b| b["height"] == 450).unwrap();
        assert_eq!(lucky["shares_since_prev"], 50);
        let luck = lucky["luck_pct"].as_f64().unwrap();
        assert!((luck - 200.0).abs() < 0.01, "luck was {luck}");

        let legacy = blocks.iter().find(|b| b["height"] == 440).unwrap();
        assert_eq!(legacy["shares_since_prev"], 0);
        assert!(legacy["luck_pct"].is_null());
    }

    #[test]
    fn public_coin_stats_aggregates_streams_per_coin() {
        let pool = test_pool();
        {
            let pool = pool.lock().unwrap();
            let mut reg = pool.telemetry.lock().unwrap();
            reg.record_external_share("miner-a", "w1", "qtu", true, 5e6);
            reg.record_external_share("miner-b", "w2", "qtu", true, 5e6);
            reg.record_external_share("miner-c", "w3", "vrsc", false, 0.0);
        }
        let api = PoolApi::new(pool, None, None);
        let payload: serde_json::Value =
            serde_json::from_str(&api.build_public_coin_stats_payload("qtu")).unwrap();
        assert_eq!(payload["coin"], "qtu");
        assert_eq!(payload["shares"]["accepted"], 2);
        assert_eq!(payload["shares"]["rejected"], 0);
        assert_eq!(payload["miners_online"], 2);
        // External coins now report an honest expected-hashes/sec rate
        // (each share carries its own work — two 5e6-hash shares inside
        // the live window ≈ 16.7 kH/s).
        let hr = payload["hashrate"].as_object().expect("hashrate object");
        assert!(hr["live"].as_f64().unwrap() > 0.0);

        let z = api.build_public_coin_stats_payload("zion");
        let zp: serde_json::Value = serde_json::from_str(&z).unwrap();
        assert!(zp["hashrate"].is_object());
        // No tracker attached → the zion blocks field is null.
        assert!(zp["blocks"].is_null());
    }

    #[test]
    fn public_coin_stats_zion_reports_luck_and_orphans() {
        let pool = test_pool();
        let tracker = std::sync::Arc::new(std::sync::Mutex::new(
            crate::block_tracker::BlockTracker::new(),
        ));
        {
            let mut t = tracker.lock().unwrap();
            t.record_share();
            t.record_share();
            // net_diff/share_diff = 100 expected shares, 2 actual → very lucky.
            t.record_block_found(50, "m", "w", 1000, 100_000, true);
            t.record_block_found(51, "m", "w", 1000, 100_000, false);
        }
        let api = PoolApi::new(pool, None, None).with_block_tracker(tracker);
        let zp: serde_json::Value =
            serde_json::from_str(&api.build_public_coin_stats_payload("zion")).unwrap();
        let blocks = zp["blocks"].as_object().expect("blocks object");
        assert_eq!(blocks["found"], 2);
        assert_eq!(blocks["orphaned"], 1);
        let luck = blocks["luck_100"].as_f64().expect("luck_100");
        assert!(luck > 1000.0, "expected huge luck, got {luck}");
        // External coins never expose the blocks field.
        let q: serde_json::Value =
            serde_json::from_str(&api.build_public_coin_stats_payload("qtu")).unwrap();
        assert!(q.get("blocks").is_none());
    }

    #[test]
    fn public_miner_payload_wallet_scoped() {
        let pool = test_pool();
        {
            let pool = pool.lock().unwrap();
            let mut reg = pool.telemetry.lock().unwrap();
            reg.record_external_share(
                "qzABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234567890ab",
                "rig1",
                "qtu",
                true,
                5e6,
            );
            reg.record_external_share("other-miner", "rig9", "qtu", true, 5e6);
        }
        let api = PoolApi::new(pool, None, None);
        let payload: serde_json::Value =
            serde_json::from_str(&api.build_public_miner_payload(
                "qtu",
                "qzABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234567890ab",
            ))
            .unwrap();
        assert_eq!(payload["shares"]["accepted"], 1);
        assert_eq!(payload["worker_count"], 1);
        assert_eq!(
            payload["workers"][0]["worker"], "rig1",
            "worker row carries the short name"
        );
        assert_eq!(payload["unpaid_unit"], "native");
        // Earnings estimate fields are always present: the wallet holds no
        // qtu window weight in this fixture → share 0; no store/height
        // handles → nulls, not errors.
        assert_eq!(payload["window_share"], 0.0);
        assert!(payload["est_daily"].is_null());
        assert!(payload["est_per_block"].is_null()); // qtu — no subsidy path
                                                     // Unknown wallet → zeroed payload, not an error.
        let unknown: serde_json::Value = serde_json::from_str(
            &api.build_public_miner_payload("qtu", "prl1qqqqqqqqqqqqqqqqqqqqqq"),
        )
        .unwrap();
        assert_eq!(unknown["worker_count"], 0);
        assert_eq!(unknown["shares"]["accepted"], 0);
    }

    #[test]
    fn public_miner_payload_reports_min_payout_and_eta() {
        let telemetry = Arc::new(Mutex::new(crate::telemetry::MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(
            crate::config::PoolConfig {
                min_payout_flowers: 1_000_000,
                ..Default::default()
            },
            telemetry,
        )));
        const WALLET: &str = "zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2";
        {
            let mut p = pool.lock().unwrap();
            p.pplns.register_address("miner1", WALLET);
            p.pplns.record_share_at("miner1", "rig", 1, 1000);
            // 400k reward → 89% miner share = 356k, below the 1M
            // threshold → stays in unpaid balance.
            let payouts = p.pplns.compute_payouts(400_000);
            assert!(payouts.is_empty());
        }
        // Store history: 100k paid in 24h; sole-weight miner → est_daily 100k.
        let store = Arc::new(ShareStore::open_in_memory().unwrap());
        store
            .record_payout(&crate::store::PayoutRecord {
                miner_id: "miner1".into(),
                address: WALLET.into(),
                amount_flowers: 100_000,
                tx_id: "tx_hist".into(),
                height: 97_000,
                block_hash: "bh".into(),
                coin: "zion".into(),
            })
            .unwrap();
        let api = PoolApi::new(pool, Some(store), None);

        let payload: serde_json::Value =
            serde_json::from_str(&api.build_public_miner_payload("zion", WALLET)).unwrap();
        assert_eq!(payload["unpaid"], "356000");
        assert_eq!(payload["min_payout"], "1000000");
        assert_eq!(payload["est_daily"], 100_000);
        // (1_000_000 - 356_000) / 100_000 = 6.44 days → 556_416 s.
        assert_eq!(payload["payout_eta_s"], 556_416);

        // Zero-balance wallet is still eligible → eta 0 (0 >= 0 short-circuit
        // means threshold met only when unpaid reaches it; unpaid 0 < 1M
        // threshold → falls to the est_daily branch which is present).
        let store2 = Arc::new(ShareStore::open_in_memory().unwrap());
        let api2 = PoolApi::new(test_pool(), Some(store2), None);
        let unknown: serde_json::Value = serde_json::from_str(
            &api2
                .build_public_miner_payload("zion", "zion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"),
        )
        .unwrap();
        assert_eq!(unknown["unpaid"], "0");
        // No payout history → est_daily null → eta null.
        assert!(unknown["payout_eta_s"].is_null());
        assert!(unknown["min_payout"].as_str().is_some());
    }

    #[test]
    fn miners_payload_serializes_reject_reasons() {
        let pool = test_pool();
        {
            let pool = pool.lock().unwrap();
            let mut reg = pool.telemetry.lock().unwrap();
            reg.record_external_share("miner-a", "w1", "qtu", false, 0.0);
            reg.record_external_share("miner-a", "w1", "qtu", true, 5e6);
            reg.record_reject_reason("miner-a", "w1", "qtu", "rejected:low difficulty");
            reg.record_reject_reason("miner-a", "w1", "qtu", "duplicate");
            reg.record_reject_reason("miner-a", "w1", "zion", "stale");
        }
        let api = PoolApi::new(pool, None, None);
        let payload: serde_json::Value =
            serde_json::from_str(&api.build_miners_payload(50)).unwrap();
        let miner = &payload["miners"][0];
        let streams = miner["streams"].as_object().expect("streams object");
        let qtu = streams["qtu"].as_object().expect("qtu stream");
        let reasons = qtu["reject_reasons"].as_object().expect("reject_reasons");
        assert_eq!(reasons["low_difficulty"], 1);
        assert_eq!(reasons["duplicate"], 1);
        assert_eq!(reasons.len(), 2);
        // The zion stream got a reject reason even with no recorded shares —
        // bucket map lives on the stream entry.
        let zion = streams["zion"].as_object().expect("zion stream");
        assert_eq!(zion["reject_reasons"]["stale"], 1);
        // accept_rate still present alongside reasons.
        assert!(qtu["accept_rate"].as_f64().unwrap() > 0.0);
    }

    #[test]
    fn public_miner_history_aggregates_wallet_workers() {
        let store = std::sync::Arc::new(ShareStore::open_in_memory().unwrap());
        let now = crate::telemetry::now_unix_seconds();
        // Two workers under one wallet — series merges per ts. Stored worker
        // values use the production shape "{miner_id}.{worker}[@{group}]".
        store
            .record_miner_history_sample("w1", "w1.rigA", now - 120, r#"{"qtu":1e6}"#, 5, 0, 86400)
            .unwrap();
        store
            .record_miner_history_sample(
                "w1",
                "w1.rigB@g=qtu",
                now - 120,
                r#"{"qtu":2e6}"#,
                3,
                1,
                86400,
            )
            .unwrap();
        store
            .record_miner_history_sample("w1", "w1.rigA", now - 60, r#"{"qtu":1.5e6}"#, 8, 0, 86400)
            .unwrap();
        // Foreign miner excluded; old row pruned by since filter.
        store
            .record_miner_history_sample("w9", "w9.rigZ", now - 60, r#"{"qtu":9e9}"#, 1, 0, 86400)
            .unwrap();

        let api = PoolApi::new(test_pool(), Some(store), None);
        let payload: serde_json::Value =
            serde_json::from_str(&api.build_public_miner_history("qtu", "w1", 100, None)).unwrap();
        assert_eq!(payload["ok"], true);
        assert_eq!(payload["coin"], "qtu");
        let samples = payload["samples"].as_array().unwrap();
        assert_eq!(samples.len(), 2, "one point per ts across workers");
        // First point merges both workers' qtu hps + share counters.
        assert_eq!(samples[0]["hps"].as_f64().unwrap(), 3e6);
        assert_eq!(samples[0]["accepted"], 8);
        assert_eq!(samples[0]["rejected"], 1);
        assert_eq!(samples[1]["hps"].as_f64().unwrap(), 1.5e6);

        // A2.1: worker filter isolates a single worker's series — matched on
        // the display name, so "rigB" resolves stored "w1.rigB@g=qtu" and
        // "rigA" resolves both "w1.rigA" rows.
        let only_rigb: serde_json::Value = serde_json::from_str(&api.build_public_miner_history(
            "qtu",
            "w1",
            100,
            Some("rigB".to_string()),
        ))
        .unwrap();
        let wb = only_rigb["samples"].as_array().unwrap();
        assert_eq!(wb.len(), 1, "rigB has one ts point");
        assert_eq!(wb[0]["hps"].as_f64().unwrap(), 2e6);
        assert_eq!(wb[0]["accepted"], 3);
        assert_eq!(wb[0]["rejected"], 1);
        let only_riga: serde_json::Value = serde_json::from_str(&api.build_public_miner_history(
            "qtu",
            "w1",
            100,
            Some("rigA".to_string()),
        ))
        .unwrap();
        let wa = only_riga["samples"].as_array().unwrap();
        assert_eq!(wa.len(), 2, "rigA has two ts points");
        assert_eq!(wa[0]["hps"].as_f64().unwrap(), 1e6);
        assert_eq!(wa[1]["hps"].as_f64().unwrap(), 1.5e6);
        // Unknown worker → empty series (not an error).
        let ghost: serde_json::Value = serde_json::from_str(&api.build_public_miner_history(
            "qtu",
            "w1",
            100,
            Some("nobody".to_string()),
        ))
        .unwrap();
        assert_eq!(ghost["samples"].as_array().unwrap().len(), 0);

        // Unknown wallet → empty series, still ok:true.
        let empty: serde_json::Value =
            serde_json::from_str(&api.build_public_miner_history("qtu", "nobody", 100, None))
                .unwrap();
        assert_eq!(empty["samples"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn worker_display_name_normalizes_stored_shapes() {
        // Production shape: "{miner_id}.{worker}[@{group}]".
        assert_eq!(worker_display_name("w1", "w1.rigA"), "rigA");
        assert_eq!(worker_display_name("w1", "w1.rigB@g=qtu"), "rigB");
        // Free-form / legacy rows pass through.
        assert_eq!(worker_display_name("probe", "health-check"), "health-check");
        // A different miner_id prefix is NOT stripped — passes through whole.
        assert_eq!(worker_display_name("w1", "w2.rigA"), "w2.rigA");
        // Empty remainder falls back to "default" (matches the miners payload).
        assert_eq!(worker_display_name("w1", "w1."), "default");
    }

    #[test]
    fn percent_decode_handles_query_encoding() {
        assert_eq!(percent_decode("rig%201"), "rig 1");
        assert_eq!(percent_decode("rig+1"), "rig 1");
        assert_eq!(percent_decode("plain"), "plain");
        assert_eq!(percent_decode("a%2Fb"), "a/b");
        // Malformed sequences pass through verbatim.
        assert_eq!(percent_decode("rig%2"), "rig%2");
        assert_eq!(percent_decode("rig%zz"), "rig%zz");
        // Route-level: encoded worker name lands decoded in the filter.
        assert_eq!(
            parse_query_param("/x?limit=10&worker=my%20rig", "worker"),
            Some("my rig".to_string())
        );
    }

    #[test]
    fn public_rate_limit_enforced_per_ip() {
        let api = PoolApi::new(test_pool(), None, None);
        let ip: std::net::IpAddr = "1.2.3.4".parse().unwrap();
        for _ in 0..PUBLIC_RATE_LIMIT {
            assert!(!api.public_rate_limited(ip));
        }
        assert!(api.public_rate_limited(ip));
        // A different IP is unaffected.
        assert!(!api.public_rate_limited("5.6.7.8".parse().unwrap()));
    }

    #[test]
    fn wallet_is_valid_accepts_known_formats() {
        let pool = test_pool();
        let pool = pool.lock().unwrap();
        // ZION bech32.
        assert!(pool.wallet_is_valid("zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2"));
        // QTU bare qz-SS58 + chain-tagged.
        assert!(pool.wallet_is_valid("qzABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234567890ab"));
        assert!(pool.wallet_is_valid("qtu:qzABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234567890ab"));
        // PRL bech32.
        assert!(
            pool.wallet_is_valid("prl1pzy8mjq96a0yhw6luuv2m55xqvsujw23u0mqsa2rw4jxsefd82chqca7a5m")
        );
        // Garbage rejected — previously mined silently to the pool wallet.
        assert!(!pool.wallet_is_valid("garbage"));
        assert!(!pool.wallet_is_valid("rig1"));
        assert!(!pool.wallet_is_valid(""));
    }

    // ── A2.2/A2.3 — account endpoints + offline-alert watcher ──────────

    /// Canned ZIS for account tests: `zis_good` → identity u9 owning
    /// `zion1mine`; anything else is invalid. Runs until the test ends.
    fn account_zis_url() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || loop {
            let Ok((mut sock, _)) = listener.accept() else {
                break;
            };
            let mut buf = vec![0u8; 8192];
            let n = sock.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]).into_owned();
            let body = if req.contains("zis_good") {
                r#"{"valid":true,"user":{"id":"u9","linkedAddresses":[
                    {"address":"zion1mine","chainType":"zion-l1"}]}}"#
            } else {
                r#"{"valid":false}"#
            }
            .to_string();
            let resp = format!(
                "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = sock.write_all(resp.as_bytes());
        });
        format!("http://{addr}")
    }

    fn account_api() -> (PoolApi, Arc<Mutex<Pool>>, Arc<ShareStore>) {
        let pool = test_pool();
        let store = Arc::new(ShareStore::open_in_memory().unwrap());
        let mut api = PoolApi::new(pool.clone(), Some(store.clone()), None);
        api.zis = crate::zis::ZisVerifier::for_test(account_zis_url());
        (api, pool, store)
    }

    fn body_json(resp: &str) -> serde_json::Value {
        serde_json::from_str(resp.split("\r\n\r\n").nth(1).unwrap()).unwrap()
    }

    /// Auth gate: unauthenticated and unowned writes are rejected before
    /// any store/engine mutation happens.
    #[test]
    fn account_endpoints_enforce_zis_auth_and_ownership() {
        let (api, _pool, _store) = account_api();
        let post = |path: &str, body: &str| request(&api, "POST", path, body);

        assert!(post("/public/v1/account", "{}").starts_with("HTTP/1.1 401"));
        assert!(post("/public/v1/account", r#"{"token":"zis_bad"}"#).starts_with("HTTP/1.1 401"));
        assert!(request(&api, "GET", "/public/v1/account", "").starts_with("HTTP/1.1 405"));

        // Owned-wallet check fires on every write path.
        for path in [
            "/public/v1/account/threshold",
            "/public/v1/account/alert",
            "/public/v1/account/alert/delete",
        ] {
            let resp = post(
                path,
                r#"{"token":"zis_good","wallet":"zion1other","min_payout":1,"id":1,"channel":"telegram","target":"1"}"#,
            );
            assert!(resp.starts_with("HTTP/1.1 403"), "{path}: {resp}");
        }

        // Read view works for the owner.
        let resp = post("/public/v1/account", r#"{"token":"zis_good"}"#);
        assert!(resp.starts_with("HTTP/1.1 200"), "{resp}");
        let body = body_json(&resp);
        assert_eq!(body["sub"], "u9");
        assert_eq!(body["wallets"][0], "zion1mine");
    }

    /// A2.3 end-to-end: threshold write persists, reaches the engine, and
    /// shows up in the public miner payload; `0` clears back to global.
    #[test]
    fn account_threshold_roundtrip_updates_engine_and_payload() {
        let (api, pool, store) = account_api();
        let global = pool.lock().unwrap().config.min_payout_flowers;
        let post = |path: &str, body: &str| request(&api, "POST", path, body);

        // Below floor rejected; floor = global minimum.
        let resp = post(
            "/public/v1/account/threshold",
            &r#"{"token":"zis_good","wallet":"zion1mine","min_payout":1}"#.to_string(),
        );
        assert!(resp.starts_with("HTTP/1.1 400"), "{resp}");

        let raised = global * 3;
        let resp = post(
            "/public/v1/account/threshold",
            &format!(r#"{{"token":"zis_good","wallet":"zion1mine","min_payout":{raised}}}"#),
        );
        assert!(resp.starts_with("HTTP/1.1 200"), "{resp}");
        assert_eq!(
            store.load_payout_overrides().unwrap().get("zion1mine"),
            Some(&raised)
        );
        assert_eq!(
            pool.lock()
                .unwrap()
                .pplns
                .min_payout_for_miner("zion1mine", "zion"),
            raised
        );

        // Public miner payload advertises the override.
        let resp = request(&api, "GET", "/public/v1/miner/zion/zion1mine", "");
        let body = body_json(&resp);
        assert_eq!(body["min_payout"], raised.to_string(), "{body}");

        // Account view surfaces it; clear with 0 → global restored.
        let resp = post("/public/v1/account", r#"{"token":"zis_good"}"#);
        let body = body_json(&resp);
        assert_eq!(
            body["settings"]["zion1mine"]["min_payout_flowers"],
            serde_json::json!(raised)
        );
        let resp = post(
            "/public/v1/account/threshold",
            r#"{"token":"zis_good","wallet":"zion1mine","min_payout":0}"#,
        );
        assert!(resp.starts_with("HTTP/1.1 200"), "{resp}");
        assert!(store
            .load_payout_overrides()
            .unwrap()
            .get("zion1mine")
            .is_none());
        assert_eq!(
            pool.lock()
                .unwrap()
                .pplns
                .min_payout_for_miner("zion1mine", "zion"),
            global
        );
    }

    /// A2.2: alert subscription upsert validation (https webhook / numeric
    /// telegram chat id), wallet-scoped delete.
    #[test]
    fn account_alert_upsert_validates_targets_and_deletes() {
        let (api, _pool, store) = account_api();
        let post = |path: &str, body: &str| request(&api, "POST", path, body);

        // http (not https) webhook → 400; ip-literal host → 400.
        for target in ["http://hooks.example.com/x", "https://127.0.0.1/x"] {
            let resp = post(
                "/public/v1/account/alert",
                &format!(
                    r#"{{"token":"zis_good","wallet":"zion1mine","worker":"rigA","channel":"webhook","target":"{target}"}}"#
                ),
            );
            assert!(resp.starts_with("HTTP/1.1 400"), "{target}: {resp}");
        }
        // Non-numeric telegram target → 400.
        let resp = post(
            "/public/v1/account/alert",
            r#"{"token":"zis_good","wallet":"zion1mine","channel":"telegram","target":"@chan"}"#,
        );
        assert!(resp.starts_with("HTTP/1.1 400"), "{resp}");

        // Valid webhook sub → id; account view lists it.
        let resp = post(
            "/public/v1/account/alert",
            r#"{"token":"zis_good","wallet":"zion1mine","worker":"rigA","channel":"webhook","target":"https://hooks.example.com/x","offline_secs":120}"#,
        );
        assert!(resp.starts_with("HTTP/1.1 200"), "{resp}");
        let id = body_json(&resp)["id"].as_i64().unwrap();
        let subs = store.list_alert_subscriptions("zion1mine").unwrap();
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].offline_secs, 120);

        // Scoped delete.
        let resp = post(
            "/public/v1/account/alert/delete",
            &format!(r#"{{"token":"zis_good","wallet":"zion1mine","id":{id}}}"#),
        );
        assert!(resp.starts_with("HTTP/1.1 200"), "{resp}");
        assert_eq!(body_json(&resp)["deleted"], true);
        assert!(store
            .list_alert_subscriptions("zion1mine")
            .unwrap()
            .is_empty());
    }

    /// A2.2 watcher: offline→online transitions flip `state` exactly once
    /// each (dedup); wallet-wide subs match any worker of the wallet.
    #[test]
    fn alert_watcher_transitions_and_dedups() {
        let telemetry = Arc::new(Mutex::new(crate::telemetry::MinerTelemetryRegistry::new()));
        let pool = Arc::new(Mutex::new(Pool::new(
            crate::config::PoolConfig::default(),
            telemetry.clone(),
        )));
        let store = ShareStore::open_in_memory().unwrap();
        let notifier = Notifier::new(NotificationsConfig::default()); // all off

        store
            .upsert_alert_subscription("w1", "rigA", "telegram", "123", 60)
            .unwrap();

        // No live workers → offline transition fires once.
        check_alert_subscriptions(&pool, &store, &notifier);
        let s = &store.list_alert_subscriptions("w1").unwrap()[0];
        assert_eq!(s.state, "offline");
        let ts1 = s.last_alert_ts;
        assert!(ts1 > 0);
        // Second pass → dedup: state and timestamp unchanged.
        check_alert_subscriptions(&pool, &store, &notifier);
        let s = &store.list_alert_subscriptions("w1").unwrap()[0];
        assert_eq!(s.state, "offline");
        assert_eq!(s.last_alert_ts, ts1);

        // Worker connects (prefixed stored shape `w1.w1.rigA`-style:
        // miner_id w1, worker "rigA" after display normalization).
        telemetry
            .lock()
            .unwrap()
            .touch_session("w1", "w1.rigA", "algo", "gpu", "");
        check_alert_subscriptions(&pool, &store, &notifier);
        let s = &store.list_alert_subscriptions("w1").unwrap()[0];
        assert_eq!(s.state, "online");
        // Recovery stamped its own alert ts (may share the same second).
        assert!(s.last_alert_ts >= ts1);

        // Wallet-wide subscription sees the same worker online → no alert.
        let id2 = store
            .upsert_alert_subscription("w1", "", "telegram", "123", 60)
            .unwrap();
        check_alert_subscriptions(&pool, &store, &notifier);
        let subs = store.list_alert_subscriptions("w1").unwrap();
        let s2 = subs.iter().find(|s| s.id == id2).unwrap();
        assert_eq!(s2.state, "online");
        assert_eq!(s2.last_alert_ts, 0);
    }
}
