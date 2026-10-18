use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Result;
use serde_json::json;
use tracing::{error, info};

use crate::auxpow_bridge::MultiAuxPowBridge;
use crate::pool::Pool;
use zion_cosmic_harmony::ExternalCoin;
use crate::store::ShareStore;
use crate::telemetry::now_unix_seconds;

/// Per-IP sliding-window counter for the unauthenticated `/public/v1`
/// tier — `PUBLIC_RATE_LIMIT` requests per `PUBLIC_RATE_WINDOW_S` seconds.
const PUBLIC_RATE_LIMIT: u32 = 120;
const PUBLIC_RATE_WINDOW_S: u64 = 60;
const PUBLIC_RATE_TABLE_MAX: usize = 4096;

pub struct PoolApi {
    pool: Arc<Mutex<Pool>>,
    share_store: Option<Arc<ShareStore>>,
    auxpow_bridge: Option<MultiAuxPowBridge>,
    routing_stats: Option<Arc<std::sync::Mutex<crate::routing::RoutingStats>>>,
    /// `(window_start_s, count)` per client IP for `/public/v1` requests.
    public_rate: Mutex<std::collections::HashMap<std::net::IpAddr, (u64, u32)>>,
    started_at: Instant,
}

impl PoolApi {
    pub fn new(
        pool: Arc<Mutex<Pool>>,
        share_store: Option<Arc<ShareStore>>,
        auxpow_bridge: Option<MultiAuxPowBridge>,
    ) -> Self {
        Self {
            pool,
            share_store,
            auxpow_bridge,
            routing_stats: None,
            public_rate: Mutex::new(std::collections::HashMap::new()),
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

    /// Serve HTTP requests. Each connection is handled on its own thread so a
    /// single stalled request (slow client, contended internal lock) can never
    /// freeze the whole API — the dashboard and Prometheus must keep working
    /// even when one handler is stuck.
    pub fn serve(self: Arc<Self>, bind_addr: &str) -> Result<()> {
        let listener = TcpListener::bind(bind_addr)?;
        info!("pool API listening on {bind_addr}");

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

    fn handle_request(&self, mut stream: TcpStream) -> Result<()> {
        // Bound all socket I/O so a connect-and-stall client cannot hold this
        // handler (and its thread) forever.
        let io_timeout = Duration::from_secs(10);
        let _ = stream.set_read_timeout(Some(io_timeout));
        let _ = stream.set_write_timeout(Some(io_timeout));
        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        if reader.read_line(&mut request_line).is_err() {
            return Ok(());
        }
        let parts: Vec<&str> = request_line.split_whitespace().collect();
        let method = *parts.first().unwrap_or(&"GET");
        let raw_path = *parts.get(1).unwrap_or(&"/stats");
        let path = raw_path.split('?').next().unwrap_or(raw_path);

        // Rate-limit the unauthenticated public tier per client IP.
        if path.starts_with("/public/v1") {
            let ip = stream
                .peer_addr()
                .map(|a| a.ip())
                .unwrap_or(std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED));
            if self.public_rate_limited(ip) {
                let body = "{\"ok\":false,\"error\":\"rate limited\"}";
                let _ = write!(stream,
                    "HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(), body);
                return Ok(());
            }
        }

        let mut content_length = 0usize;
        let mut api_key_header = None;
        let mut admin_key_header = None;
        let mut auth_bearer = None;
        loop {
            let mut header = String::new();
            if reader.read_line(&mut header).is_err() {
                break;
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
            }
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
                        let blocks = store
                            .query_blocks_for_coin(coin, limit)
                            .unwrap_or_default();
                        let body = format!(
                            "{{\"ok\":true,\"coin\":\"{}\",\"blocks\":{}}}",
                            coin,
                            serialize_public_blocks_json(&blocks)
                        );
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
                let parts: Vec<&str> =
                    p.trim_start_matches("/public/v1/miner/").split('/').collect();
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
                        let body = format!(
                            "{{\"ok\":true,\"coin\":\"{}\",\"wallet\":\"{}\",\"payouts\":{}}}",
                            coin,
                            wallet,
                            serialize_public_payouts_json(&payouts)
                        );
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
                let parts: Vec<&str> =
                    p.trim_start_matches("/public/v1/miner/").split('/').collect();
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
                        let body = format!(
                            "{{\"ok\":true,\"blocks\":{}}}",
                            serialize_public_blocks_json(&blocks)
                        );
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
                        let body = format!(
                            "{{\"ok\":true,\"payouts\":{}}}",
                            serialize_public_payouts_json(&payouts)
                        );
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
            // External-chain payout queue (QTC etc.).  GET previews without
            // consuming; POST drains — the multichain sweeper owns idempotent
            // redelivery from its own ledger after a successful drain.
            "/admin/external-payouts" => {
                let chain = parse_query_param(raw_path, "chain")
                    .unwrap_or_else(|| "quantus".to_string());
                if method == "POST" {
                    let drained = {
                        let mut pool = self.pool.lock().expect("pool lock poisoned");
                        pool.take_external_payouts(&chain)
                    };
                    let entries: Vec<String> = drained
                        .iter()
                        .map(|(h, p)| {
                            let coin = p
                                .coin
                                .as_deref()
                                .map(|c| format!(",\"coin\":\"{c}\""))
                                .unwrap_or_default();
                            let event = p
                                .revenue_event
                                .as_deref()
                                .map(|e| format!(",\"event\":\"{e}\""))
                                .unwrap_or_default();
                            format!(
                                "{{\"height\":{h},\"miner_id\":\"{}\",\"address\":\"{}\",\"amount_flowers\":{},\"share_count\":{},\"unit\":\"{}\"{}{}}}",
                                p.miner_id, p.address, p.amount, p.share_count,
                                p.unit(), coin, event
                            )
                        })
                        .collect();
                    let body = format!(
                        "{{\"ok\":true,\"chain\":\"{}\",\"count\":{},\"payouts\":[{}]}}",
                        chain,
                        entries.len(),
                        entries.join(",")
                    );
                    ("200 OK", "application/json", body)
                } else {
                    let pending = {
                        let pool = self.pool.lock().expect("pool lock poisoned");
                        pool.pending_external_payouts(&chain)
                            .iter()
                            .map(|p| {
                                format!(
                                    "{{\"miner_id\":\"{}\",\"address\":\"{}\",\"amount_flowers\":{}}}",
                                    p.miner_id, p.address, p.amount
                                )
                            })
                            .collect::<Vec<_>>()
                    };
                    let body = format!(
                        "{{\"ok\":true,\"chain\":\"{}\",\"pending\":{},\"payouts\":[{}]}}",
                        chain,
                        pending.len(),
                        pending.join(",")
                    );
                    ("200 OK", "application/json", body)
                }
            }
            // Native-coin revenue event intake (F3).  The multichain
            // treasury oracle POSTs {"coin","amount","ref_height","event"}
            // after observing a balance increase; the pool distributes the
            // amount across the coin's PPLNS slice and queues native-unit
            // payout entries (drained via /admin/external-payouts).
            "/admin/coin-revenue" => {
                if method != "POST" {
                    let body = "{\"ok\":false,\"error\":\"POST required\"}";
                    ("405 Method Not Allowed", "application/json", body.to_string())
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
                            format!("{{\"ok\":false,\"error\":\"bad json: {e}\"}}"),
                        ),
                        Ok(req) => {
                            // One critical section for dedup + distribute +
                            // audit record — a retry POST must never slip
                            // between the dedup check and the ledger write.
                            // Order matters for crash safety: distribute
                            // first, then record; a crash between the two
                            // loses the in-memory payout entries anyway
                            // (snapshot restore keeps unpaid_native intact),
                            // while a committed dedup row blocks any later
                            // re-post from double-paying.
                            let mut pool = self.pool.lock().expect("pool lock poisoned");
                            let known = self
                                .share_store
                                .as_ref()
                                .and_then(|s| s.coin_revenue_amount(&req.event).ok().flatten());
                            if let Some(recorded) = known {
                                (
                                    "200 OK",
                                    "application/json",
                                    format!(
                                        "{{\"ok\":true,\"duplicate\":true,\"amount\":{recorded}}}"
                                    ),
                                )
                            } else {
                                match pool.on_coin_revenue(
                                    &req.coin,
                                    req.amount,
                                    req.ref_height,
                                    &req.event,
                                ) {
                                    Ok(o) => {
                                        if let Some(ref store) = self.share_store {
                                            if let Err(e) = store.record_coin_revenue(
                                                &req.event,
                                                &o.coin,
                                                o.amount,
                                                req.ref_height,
                                                o.emitted,
                                                o.emitted_total,
                                            ) {
                                                tracing::warn!(
                                                    event = %req.event,
                                                    "coin_revenue audit write failed: {e}"
                                                );
                                            }
                                        }
                                        (
                                            "200 OK",
                                            "application/json",
                                            format!(
                                                "{{\"ok\":true,\"coin\":\"{}\",\"amount\":{},\"emitted\":{},\"emitted_total\":{}}}",
                                                o.coin, o.amount, o.emitted, o.emitted_total
                                            ),
                                        )
                                    }
                                    Err(crate::pool::PoolError::CoinNotNative) => (
                                        "400 Bad Request",
                                        "application/json",
                                        "{\"ok\":false,\"error\":\"coin not enabled for native payouts\"}"
                                            .to_string(),
                                    ),
                                    Err(crate::pool::PoolError::DuplicateRevenueEvent) => (
                                        "200 OK",
                                        "application/json",
                                        "{\"ok\":true,\"duplicate\":true}".to_string(),
                                    ),
                                    Err(e) => (
                                        "400 Bad Request",
                                        "application/json",
                                        format!("{{\"ok\":false,\"error\":\"{e}\"}}"),
                                    ),
                                }
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

        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes())?;
        Ok(())
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
                let coins: Vec<serde_json::Value> = enabled
                    .iter()
                    .map(|c| json!(c.as_str()))
                    .collect();
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
                            let (enabled, connected, pct, njid, nage) =
                                bridge.native_status();
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

    /// Build hashrate history payload (placeholder — returns empty array
    /// until a hashrate history store is wired in).
    fn build_hashrate_history_payload(&self, _limit: usize) -> String {
        json!({
            "ok": true,
            "history": [],
            "note": "hashrate history requires telemetry persistence"
        })
        .to_string()
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

        let coin_stats = pool
            .pplns
            .coin_stats()
            .into_iter()
            .find(|s| s.coin == coin);
        let (window_weight, active_miners, accepted_total) = coin_stats
            .map(|s| (s.window_weight.to_string(), s.active_miners, s.accepted_total))
            .unwrap_or_else(|| ("0".into(), 0, 0));

        // Hashrate is only meaningful for ZION (external shares don't feed
        // the estimator — different difficulty scales).
        let hashrate = if coin == "zion" {
            json!({"live": pool.telemetry.lock().expect("telemetry lock").pool_hashrate_live()})
        } else {
            serde_json::Value::Null
        };

        json!({
            "ok": true,
            "coin": coin,
            "miners_online": online,
            "active_miners": active_miners,
            "shares": {"accepted": valid, "rejected": invalid},
            "window_weight": window_weight,
            "accepted_total": accepted_total,
            "hashrate": hashrate,
        })
        .to_string()
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
                    serde_json::Value::Null
                },
            }));
        }
        drop(reg);

        // Unpaid balance — unified flowers or native coin units.
        let miner_ids = pool.pplns.miner_ids_for_address(wallet);
        let (unpaid, unpaid_unit) = if coin.is_empty() || coin == "zion" {
            let total: u64 = miner_ids
                .iter()
                .map(|m| pool.pplns.unpaid_balance(m))
                .sum();
            (total, "flowers")
        } else {
            let total: u64 = miner_ids
                .iter()
                .map(|m| pool.pplns.unpaid_native_balance(m, &coin))
                .sum();
            (total, "native")
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
            "last_seen_s": last_seen,
            "active": last_seen > 0 && now_s.saturating_sub(last_seen) < 600,
        })
        .to_string()
    }

    fn build_prometheus_payload(&self) -> String {
        let (accepted, rejected, telemetry, stats, fees, sessions) = {
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
                    id,
                    coin,
                    leg.enabled as u8
                ));
                body.push_str(&format!(
                    "zion_pool_leg_connected{{leg=\"{}\",coin=\"{}\"}} {}\n",
                    id,
                    coin,
                    leg.connected as u8
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
fn serialize_public_blocks_json(blocks: &[crate::store::DbBlockRow]) -> String {
    let mut out = String::from("[");
    for (i, b) in blocks.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"coin\":\"{}\",\"height\":{},\"hash\":\"{}\",\"miner\":\"{}\",\"share_difficulty\":{},\"network_difficulty\":{},\"status\":\"{}\",\"ts\":{},\"confirmed_at\":{}}}",
            b.coin, b.height, b.hash, public_miner_id(&b.miner_id),
            b.share_difficulty, b.network_difficulty, b.status, b.ts,
            b.confirmed_at.map(|t| t.to_string()).unwrap_or_else(|| "null".to_string())
        ));
    }
    out.push(']');
    out
}

/// Public payouts feed — bare array; `address` is authoritative, `miner_id`
/// (worker-suffixed) stays internal.
fn serialize_public_payouts_json(payouts: &[crate::store::PayoutRow]) -> String {
    let mut out = String::from("[");
    for (i, p) in payouts.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"ts\":{},\"address\":\"{}\",\"coin\":\"{}\",\"amount_flowers\":{},\"tx_id\":\"{}\",\"height\":{},\"block_hash\":\"{}\",\"confirmations\":{},\"confirmed\":{}}}",
            p.ts, p.address, p.coin, p.amount_flowers,
            p.tx_id, p.height, p.block_hash, p.confirmations, p.confirmed
        ));
    }
    out.push(']');
    out
}

fn serialize_blocks_json(blocks: &[crate::store::DbBlockRow]) -> String {
    let mut out = String::from("{\"ok\":true,\"blocks\":[");
    for (i, b) in blocks.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"coin\":\"{}\",\"height\":{},\"hash\":\"{}\",\"miner_id\":\"{}\",\"worker_name\":\"{}\",\"share_difficulty\":{},\"network_difficulty\":{},\"status\":\"{}\",\"ts\":{},\"confirmed_at\":{}}}",
            b.coin, b.height, b.hash, b.miner_id, b.worker_name,
            b.share_difficulty, b.network_difficulty, b.status, b.ts,
            b.confirmed_at.map(|t| t.to_string()).unwrap_or_else(|| "null".to_string())
        ));
    }
    out.push_str("]}");
    out
}

fn serialize_payouts_json(payouts: &[crate::store::PayoutRow]) -> String {
    let mut out = String::from("{\"ok\":true,\"payouts\":[");
    for (i, p) in payouts.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"ts\":{},\"miner_id\":\"{}\",\"address\":\"{}\",\"coin\":\"{}\",\"amount_flowers\":{},\"tx_id\":\"{}\",\"height\":{},\"block_hash\":\"{}\",\"confirmations\":{},\"confirmed\":{}}}",
            p.ts, p.miner_id, p.address, p.coin, p.amount_flowers,
            p.tx_id, p.height, p.block_hash, p.confirmations, p.confirmed
        ));
    }
    out.push_str("]}");
    out
}

fn serialize_miners_json(miners: &[crate::store::MinerStatsRow], total_count: u64) -> String {
    let mut out = format!("{{\"ok\":true,\"miner_count\":{total_count},\"miners\":[");
    for (i, m) in miners.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"miner_id\":\"{}\",\"first_seen\":{},\"last_seen\":{},\"total_shares\":{},\"accepted_shares\":{},\"rejected_shares\":{},\"total_paid_flowers\":{}}}",
            m.miner_id, m.first_seen, m.last_seen,
            m.total_shares, m.accepted_shares, m.rejected_shares, m.total_paid_flowers
        ));
    }
    out.push_str("]}");
    out
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

    fn test_pool() -> Arc<Mutex<Pool>> {
        let telemetry = Arc::new(Mutex::new(crate::telemetry::MinerTelemetryRegistry::new()));
        Arc::new(Mutex::new(Pool::new(
            crate::config::PoolConfig::default(),
            telemetry,
        )))
    }

    fn test_job(coin: zion_cosmic_harmony::ExternalCoin, job_id: &str, fresh: bool) -> crate::auxpow_bridge::JobPackage {
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

        let v2: serde_json::Value = serde_json::from_str(
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/tests/fixtures/pearl_cuda_live_share.json"
            )),
        )
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
        let up = crate::pearl_upstream::PearlUpstream::new(
            crate::pearl_upstream::PearlUpstreamConfig {
                endpoint: "127.0.0.1:9".to_string(),
                wallet: "prl1w".to_string(),
                worker: "w".to_string(),
                password: "x".to_string(),
                job_ttl: Duration::from_millis(90_000),
            fwd_max: Duration::from_millis(90_000),
            },
        );
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
        assert!(coins.len() >= 30, "expected full catalogue, got {}", coins.len());
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
        for forbidden in ["job_id", "upstream_url", "endpoint", "worker", "pool_address"] {
            assert!(!body.contains(forbidden), "leaked field: {forbidden}");
        }
    }

    #[test]
    fn public_coin_stats_aggregates_streams_per_coin() {
        let pool = test_pool();
        {
            let pool = pool.lock().unwrap();
            let mut reg = pool.telemetry.lock().unwrap();
            reg.record_external_share("miner-a", "w1", "qtu", true);
            reg.record_external_share("miner-b", "w2", "qtu", true);
            reg.record_external_share("miner-c", "w3", "vrsc", false);
        }
        let api = PoolApi::new(pool, None, None);
        let payload: serde_json::Value =
            serde_json::from_str(&api.build_public_coin_stats_payload("qtu")).unwrap();
        assert_eq!(payload["coin"], "qtu");
        assert_eq!(payload["shares"]["accepted"], 2);
        assert_eq!(payload["shares"]["rejected"], 0);
        assert_eq!(payload["miners_online"], 2);
        // Non-ZION coins report null hashrate (external shares don't feed
        // the ZION estimator — different difficulty scale).
        assert_eq!(payload["hashrate"], serde_json::Value::Null);

        let z = api.build_public_coin_stats_payload("zion");
        let zp: serde_json::Value = serde_json::from_str(&z).unwrap();
        assert!(zp["hashrate"].is_object());
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
            );
            reg.record_external_share("other-miner", "rig9", "qtu", true);
        }
        let api = PoolApi::new(pool, None, None);
        let payload: serde_json::Value = serde_json::from_str(&api.build_public_miner_payload(
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
        // Unknown wallet → zeroed payload, not an error.
        let unknown: serde_json::Value = serde_json::from_str(
            &api.build_public_miner_payload("qtu", "prl1qqqqqqqqqqqqqqqqqqqqqq"),
        )
        .unwrap();
        assert_eq!(unknown["worker_count"], 0);
        assert_eq!(unknown["shares"]["accepted"], 0);
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
        assert!(pool.wallet_is_valid(
            "prl1pzy8mjq96a0yhw6luuv2m55xqvsujw23u0mqsa2rw4jxsefd82chqca7a5m"
        ));
        // Garbage rejected — previously mined silently to the pool wallet.
        assert!(!pool.wallet_is_valid("garbage"));
        assert!(!pool.wallet_is_valid("rig1"));
        assert!(!pool.wallet_is_valid(""));
    }
}
