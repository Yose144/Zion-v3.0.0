use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Result;
use serde_json::json;
use tracing::{error, info, warn};

use crate::auxpow_bridge::MultiAuxPowBridge;
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
    /// Cumulative accepted/rejected share counters at sample time —
    /// per-interval deltas are derived client-side.
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
                    for (ts, hashrate, miners_online, json, accepted, rejected) in rows {
                        let online_by_coin = serde_json::from_str(&json).unwrap_or_default();
                        h.push_back(HistorySample {
                            ts,
                            hashrate,
                            miners_online,
                            online_by_coin,
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
                let sample = sample_history(&pool);
                if let Some(store) = &store {
                    let json = serde_json::to_string(&sample.online_by_coin)
                        .unwrap_or_else(|_| "{}".to_string());
                    if let Err(e) = store.record_history_sample(
                        sample.ts,
                        sample.hashrate,
                        sample.miners_online,
                        &json,
                        sample.accepted,
                        sample.rejected,
                        HISTORY_INTERVAL_S * HISTORY_CAP as u64,
                    ) {
                        warn!("history: persist failed: {e}");
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

        for stream in listener.incoming() {
            let stream = match stream {
                Ok(s) => s,
                Err(e) => {
                    error!("pool_api_accept_error={e}");
                    continue;
                }
            };
            let api = Arc::clone(&self);
            std::thread::spawn(move || {
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

        let (status, content_type, body) = match path {
            "/health" => {
                let uptime_s = self.started_at.elapsed().as_secs();
                let body = format!("{{\"status\":\"ok\",\"uptime_s\":{uptime_s}}}");
                ("200 OK", "application/json", body)
            }
            "/metrics" => {
                let body = self.build_prometheus_payload();
                ("200 OK", "text/plain; version=0.0.4", body)
            }
            p if p == "/stats" || p == "/" || p == "/pool" => {
                let body = self.build_stats_payload();
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
                let body = self.build_public_coins_payload();
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
                        let body = json!({
                            "ok": true,
                            "coin": coin,
                            "wallet": wallet,
                            "payouts": serialize_public_payouts_json(&payouts),
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
                        let body = json!({
                            "ok": true,
                            "payouts": serialize_public_payouts_json(&payouts),
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

    fn build_stats_payload(&self) -> String {
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
        let stats = pool.pplns.stats();
        let fees = pool.pplns.fee_stats();

        let auxpow_json = self.auxpow_summary_inner(pool.pearl.clone());

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
                "port": pool.config.port
            },
            "blocks": self.block_tracker_json(),
            "external_payouts": {
                "quantus": {
                    "pending": pool.pending_external_payouts("quantus").len()
                },
                "pearl": {
                    "pending": pool.pending_external_payouts("pearl").len()
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
        let pool = self.pool.lock().expect("pool lock poisoned");
        let legs = match &self.auxpow_bridge {
            Some(b) => pool.leg_statuses(b),
            None => Vec::new(),
        };
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
        json!({
            "ok": true,
            "coins": coins.values().collect::<Vec<_>>()
        })
        .to_string()
    }

    /// `/public/v1/coins/{coin}/stats` — per-coin telemetry + window stats.
    fn build_public_coin_stats_payload(&self, coin: &str) -> String {
        let coin = coin.to_ascii_lowercase();
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
        if coin == "zion" {
            out["blocks"] = self.block_tracker_json();
        }
        out.to_string()
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
            let worker_name = worker_short
                .strip_prefix(&format!("{miner_id}."))
                .unwrap_or(&worker_short)
                .split('@')
                .next()
                .unwrap_or(&worker_short);
            let worker_name = if worker_name.is_empty() {
                "default"
            } else {
                worker_name
            };
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

        json!({
            "ok": true,
            "coin": coin,
            "wallet": wallet,
            "worker_count": workers.len(),
            "workers": workers,
            "shares": {"accepted": valid, "rejected": invalid},
            "unpaid": unpaid.to_string(),
            "unpaid_unit": unpaid_unit,
            "window_share": window_share,
            "est_daily": est_daily,
            "est_per_block": est_per_block,
            "last_seen_s": last_seen,
            "active": last_seen > 0 && now_s.saturating_sub(last_seen) < 600,
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
            for (_, miner) in reg.all_miners() {
                for (coin, s) in &miner.streams {
                    *coin_valid.entry(coin.clone()).or_default() += s.valid_shares;
                    *coin_invalid.entry(coin.clone()).or_default() += s.invalid_shares;
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
            }
        }

        // F4-B: leg health gauges — alert on enabled-but-disconnected or
        // stale legs (job_age_ms > threshold).
        if let Some(ref bridge) = self.auxpow_bridge {
            let pool = self.pool.lock().expect("pool lock poisoned");
            for leg in pool.leg_statuses(bridge) {
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
fn sample_history(pool: &Arc<Mutex<Pool>>) -> HistorySample {
    let now_s = now_unix_seconds();
    let pool = pool.lock().expect("pool lock poisoned");
    let (accepted, rejected) = pool.stats();
    let reg = pool.telemetry.lock().expect("telemetry lock poisoned");
    let hashrate = reg.pool_hashrate_live();
    let mut online_by_coin: std::collections::HashMap<String, u64> =
        std::collections::HashMap::new();
    let mut miners_online = 0u64;
    for (_, miner) in reg.all_miners() {
        let mut any_online = false;
        for (coin, s) in miner.streams.iter() {
            if s.last_share_time_s > 0
                && now_s.saturating_sub(s.last_share_time_s) < ONLINE_WINDOW_S
            {
                *online_by_coin.entry(coin.clone()).or_insert(0) += 1;
                any_online = true;
            }
        }
        if any_online {
            miners_online += 1;
        }
    }
    HistorySample {
        ts: now_s,
        hashrate,
        miners_online,
        online_by_coin,
        accepted,
        rejected,
    }
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
            return Some(val.to_string());
        }
    }
    None
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

/// Strip ".worker" and "@group" suffixes so the public feed only exposes the
/// wallet/address part of a miner id.
fn public_miner_id(miner_id: &str) -> &str {
    let end = miner_id
        .find(|c| c == '.' || c == '@')
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
                json!({
                    "coin": b.coin,
                    "height": b.height,
                    "hash": b.hash,
                    "miner": public_miner_id(&b.miner_id),
                    "share_difficulty": b.share_difficulty,
                    "network_difficulty": b.network_difficulty,
                    "status": b.status,
                    "ts": b.ts,
                    "confirmed_at": b.confirmed_at,
                })
            })
            .collect(),
    )
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
        assert!(zion["legs"].as_array().unwrap().len() >= 1);
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
}
