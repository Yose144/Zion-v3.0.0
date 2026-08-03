use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use anyhow::Result;
use tracing::{error, info};

use crate::auxpow_bridge::MultiAuxPowBridge;
use crate::pool::Pool;
use crate::store::ShareStore;

pub struct PoolApi {
    pool: Arc<Mutex<Pool>>,
    share_store: Option<Arc<ShareStore>>,
    auxpow_bridge: Option<MultiAuxPowBridge>,
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
            started_at: Instant::now(),
            active_sessions: Arc::new(AtomicU64::new(0)),
            total_connections: Arc::new(AtomicU64::new(0)),
        }
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
        loop {
            let mut header = String::new();
            if reader.read_line(&mut header).is_err() {
                break;
            }
            if header.trim().is_empty() {
                break;
            }
            if let Some(val) = header
                .strip_prefix("Content-Length:")
                .or_else(|| header.strip_prefix("content-length:"))
            {
                content_length = val.trim().parse().unwrap_or(0);
            }
        }
        if method == "POST" && content_length > 0 {
            let mut buf = vec![0u8; content_length];
            let _ = reader.read_exact(&mut buf);
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
                        ("503 Service Unavailable", "application/json", body.to_string())
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
                        ("503 Service Unavailable", "application/json", body.to_string())
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
                        ("503 Service Unavailable", "application/json", body.to_string())
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
        let pplns = &pool.pplns;

        let auxpow_json = if let Some(ref bridge) = self.auxpow_bridge {
            let coins: Vec<String> = bridge.enabled_coins().iter().map(|c| c.as_str().to_string()).collect();
            format!(
                "{{\"enabled\":true,\"coins\":{:?}}}",
                coins
            )
        } else {
            "{\"enabled\":false}".to_string()
        };

        format!(
            "{{
  \"ok\":true,
  \"uptime_s\":{uptime_s},
  \"sessions\":{sessions},
  \"total_connections\":{total_conn},
  \"shares\":{{
    \"accepted\":{accepted},
    \"rejected\":{rejected},
    \"total\":{}
  }},
  \"pplns\":{{
    \"window_size\":{},
    \"window_used\":{},
    \"total\":{}
  }},
  \"pool\":{{
    \"fee_bps\":{},
    \"port\":{}
  }},
  \"auxpow\":{auxpow_json},
  \"api\":{{
    \"stats\":\"/stats\",
    \"miners\":\"/miners?limit=200\",
    \"blocks\":\"/api/v1/blocks?limit=50\",
    \"payouts\":\"/api/v1/payouts?limit=50\",
    \"all_miners\":\"/api/v1/miners?limit=100\",
    \"pplns\":\"/api/v1/pplns\",
    \"auxpow\":\"/api/v1/auxpow\",
    \"health\":\"/health\",
    \"metrics\":\"/metrics\"
  }}
}}",
            accepted + rejected,
            pplns.window_size,
            pplns.window.len(),
            pplns.total,
            pool.config.pool_fee_bps,
            pool.config.port,
        )
    }

    fn build_pplns_payload(&self) -> String {
        let pool = self.pool.lock().expect("pool lock poisoned");
        let pplns = &pool.pplns;
        format!(
            "{{
  \"ok\":true,
  \"window_size\":{},
  \"window_used\":{},
  \"total\":{},
  \"fee_bps\":{}
}}",
            pplns.window_size,
            pplns.window.len(),
            pplns.total,
            pplns.fee_bps,
        )
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

    fn build_miners_payload(&self, limit: usize) -> String {
        let pool = self.pool.lock().expect("pool lock poisoned");
        let workers: Vec<String> = pool
            .worker_addresses
            .iter()
            .take(limit)
            .map(|(name, addr)| {
                format!(
                    "{{\"worker\":\"{}\",\"address\":\"{}\"}}",
                    name, addr.encoded
                )
            })
            .collect();
        format!(
            "{{\"ok\":true,\"count\":{},\"miners\":[{}]}}",
            pool.worker_addresses.len(),
            workers.join(",")
        )
    }

    fn build_prometheus_payload(&self) -> String {
        let pool = self.pool.lock().expect("pool lock poisoned");
        let (accepted, rejected) = pool.stats();
        let sessions = self.active_sessions.load(Ordering::Relaxed);
        let uptime_s = self.started_at.elapsed().as_secs();
        let mut body = String::new();
        body.push_str(&format!("zion_pool_uptime_s {uptime_s}\n"));
        body.push_str(&format!("zion_pool_active_sessions {sessions}\n"));
        body.push_str(&format!("zion_pool_shares_accepted {accepted}\n"));
        body.push_str(&format!("zion_pool_shares_rejected {rejected}\n"));
        body.push_str(&format!("zion_pool_pplns_window_size {}\n", pool.pplns.window_size));
        body.push_str(&format!("zion_pool_pplns_window_used {}\n", pool.pplns.window.len()));
        body.push_str(&format!("zion_pool_pplns_total {}\n", pool.pplns.total));
        body
    }
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
