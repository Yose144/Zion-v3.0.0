use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use anyhow::Result;
use serde_json::json;
use tracing::{error, info};

use crate::auxpow_bridge::MultiAuxPowBridge;
use crate::pool::Pool;
use crate::store::ShareStore;
use crate::telemetry::now_unix_seconds;

pub struct PoolApi {
    pool: Arc<Mutex<Pool>>,
    share_store: Option<Arc<ShareStore>>,
    auxpow_bridge: Option<MultiAuxPowBridge>,
    routing_stats: Option<Arc<std::sync::Mutex<crate::routing::RoutingStats>>>,
    started_at: Instant,
    active_sessions: Arc<AtomicU64>,
    total_connections: Arc<AtomicU64>,
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
            started_at: Instant::now(),
            active_sessions: Arc::new(AtomicU64::new(0)),
            total_connections: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn with_routing_stats(
        mut self,
        stats: Arc<std::sync::Mutex<crate::routing::RoutingStats>>,
    ) -> Self {
        self.routing_stats = Some(stats);
        self
    }

    pub fn active_sessions(&self) -> &Arc<AtomicU64> {
        &self.active_sessions
    }

    pub fn total_connections(&self) -> &Arc<AtomicU64> {
        &self.total_connections
    }

    pub fn serve(&self, bind_addr: &str) -> Result<()> {
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
            if let Err(e) = self.handle_request(stream) {
                error!("pool_api_handle_error={e}");
            }
        }
        Ok(())
    }

    fn handle_request(&self, mut stream: TcpStream) -> Result<()> {
        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        if reader.read_line(&mut request_line).is_err() {
            return Ok(());
        }
        let parts: Vec<&str> = request_line.split_whitespace().collect();
        let method = *parts.first().unwrap_or(&"GET");
        let raw_path = *parts.get(1).unwrap_or(&"/stats");
        let path = raw_path.split('?').next().unwrap_or(raw_path);

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
        if method == "POST" && content_length > 0 {
            let mut buf = vec![0u8; content_length];
            let _ = reader.read_exact(&mut buf);
        }

        // API key authorization for /api/* and admin endpoints.
        let (api_key, admin_key) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            (pool.config.api_key.clone(), pool.config.admin_key.clone())
        };

        if path.starts_with("/admin") {
            let admin_ok = admin_key.as_deref().is_some()
                && (admin_key_header.as_deref() == admin_key.as_deref()
                    || auth_bearer.as_deref() == admin_key.as_deref());
            if !admin_ok {
                let body = "{\"ok\":false,\"error\":\"unauthorized\"}";
                let response = format!(
                    "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                stream.write_all(response.as_bytes())?;
                return Ok(());
            }
        } else if path.starts_with("/api")
            && api_key.is_some()
            && api_key_header.as_deref() != api_key.as_deref()
            && auth_bearer.as_deref() != api_key.as_deref()
        {
            let body = "{\"ok\":false,\"error\":\"unauthorized\"}";
            let response = format!(
                "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes())?;
            return Ok(());
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
        let sessions = self.active_sessions.load(Ordering::Relaxed);
        let total_conn = self.total_connections.load(Ordering::Relaxed);
        let stats = pool.pplns.stats();
        let fees = pool.pplns.fee_stats();

        let auxpow_json = if let Some(ref bridge) = self.auxpow_bridge {
            let coins: Vec<String> = bridge
                .enabled_coins()
                .iter()
                .map(|c| c.as_str().to_string())
                .collect();
            json!({"enabled":true,"coins":coins})
        } else {
            json!({"enabled":false})
        };

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

    fn build_auxpow_payload(&self) -> String {
        match &self.auxpow_bridge {
            Some(bridge) => {
                let coins: Vec<String> = bridge
                    .enabled_coins()
                    .iter()
                    .map(|c| format!("\"{}\"", c.as_str()))
                    .collect();
                format!(
                    "{{\"ok\":true,\"enabled\":true,\"coins\":[{}]}}",
                    coins.join(",")
                )
            }
            None => "{\"ok\":true,\"enabled\":false}".to_string(),
        }
    }

    /// Build the profit switcher status payload.
    fn build_profit_switch_payload(&self) -> String {
        let profiles = zion_cosmic_harmony::CoinProfile::defaults();
        let entries: Vec<serde_json::Value> = profiles
            .iter()
            .map(|p| {
                json!({
                    "coin": p.coin.as_str(),
                    "device": format!("{:?}", p.device),
                    "profit_usd_day": p.estimate_profit(1.0),
                    "enabled": p.enabled && !p.disabled,
                    "disabled_reason": p.disabled_reason,
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
        let sessions = self.active_sessions.load(Ordering::Relaxed);
        let total_conn = self.total_connections.load(Ordering::Relaxed);

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

    fn build_prometheus_payload(&self) -> String {
        let (accepted, rejected, telemetry, stats, fees) = {
            let pool = self.pool.lock().expect("pool lock poisoned");
            (
                pool.stats().0,
                pool.stats().1,
                pool.telemetry.clone(),
                pool.pplns.stats(),
                pool.pplns.fee_stats(),
            )
        };
        let sessions = self.active_sessions.load(Ordering::Relaxed);
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

fn serialize_blocks_json(blocks: &[crate::store::DbBlockRow]) -> String {
    let mut out = String::from("{\"ok\":true,\"blocks\":[");
    for (i, b) in blocks.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"height\":{},\"hash\":\"{}\",\"miner_id\":\"{}\",\"worker_name\":\"{}\",\"share_difficulty\":{},\"network_difficulty\":{},\"status\":\"{}\",\"ts\":{},\"confirmed_at\":{}}}",
            b.height, b.hash, b.miner_id, b.worker_name,
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
            "{{\"ts\":{},\"miner_id\":\"{}\",\"address\":\"{}\",\"amount_flowers\":{},\"tx_id\":\"{}\",\"height\":{},\"block_hash\":\"{}\",\"confirmations\":{},\"confirmed\":{}}}",
            p.ts, p.miner_id, p.address, p.amount_flowers,
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
}
