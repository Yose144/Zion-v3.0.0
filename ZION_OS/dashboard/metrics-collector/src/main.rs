use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CONFIG_PATH: &str = "../config.json";
const OUTPUT_PATH: &str = "../data/metrics.json";
const INTERVAL_SECS: u64 = 5;

#[derive(Serialize, Deserialize, Default)]
struct MetricsSnapshot {
    timestamp: u64,
    topology: String,
    edge_node: Option<NodeMetrics>,
    local_node: Option<NodeMetrics>,
    pool: Option<PoolMetrics>,
    tailscale_ok: bool,
}

#[derive(Serialize, Deserialize, Default)]
struct NodeMetrics {
    running: bool,
    chain_height: Option<u64>,
    tip_hash: Option<String>,
    known_peers: u32,
    mempool_size: u32,
    network: Option<String>,
    protocol_version: Option<u32>,
    consensus_profile: Option<String>,
    accepted_blocks: Option<u64>,
}

#[derive(Serialize, Deserialize, Default)]
struct PoolMetrics {
    running: bool,
    active_miners: Option<u32>,
    hashrate_khs: Option<f64>,
    blocks_found: Option<u64>,
    total_hashes: Option<u64>,
    total_shares: Option<u64>,
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn load_config() -> serde_json::Value {
    let path = PathBuf::from(CONFIG_PATH);
    if !path.exists() {
        return serde_json::json!({"topology": "edge-primary"});
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({"topology": "edge-primary"}))
}

fn rpc_get_chain_info(host: &str, port: u16) -> Option<serde_json::Value> {
    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getChainInfo",
        "params": serde_json::Value::Null
    });
    let url = format!("http://{}:{}/jsonrpc", host, port);
    let resp = ureq::post(&url)
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(3))
        .send_json(payload)
        .ok()?;
    let json: serde_json::Value = resp.into_json().ok()?;
    json.get("result").cloned()
}

fn scrape_prometheus(host: &str, port: u16) -> Option<PoolMetrics> {
    let url = format!("http://{}:{}/metrics", host, port);
    let resp = ureq::get(&url)
        .timeout(Duration::from_secs(2))
        .call()
        .ok()?;
    let body = resp.into_string().ok()?;

    let mut pm = PoolMetrics {
        running: true,
        ..Default::default()
    };

    for line in body.lines() {
        let line = line.trim();
        if line.starts_with("zion_pool_active_sessions ") {
            pm.active_miners = line.split_whitespace().last().and_then(|s| s.parse().ok());
        } else if line.starts_with("zion_pool_hashrate_khs ") {
            pm.hashrate_khs = line.split_whitespace().last().and_then(|s| s.parse().ok());
        } else if line.starts_with("zion_pool_blocks_found ") {
            pm.blocks_found = line.split_whitespace().last().and_then(|s| s.parse().ok());
        } else if line.starts_with("zion_pool_total_hashes ") {
            pm.total_hashes = line.split_whitespace().last().and_then(|s| s.parse().ok());
        } else if line.starts_with("zion_pool_total_shares ") {
            pm.total_shares = line.split_whitespace().last().and_then(|s| s.parse().ok());
        }
    }
    Some(pm)
}

fn tailscale_ping(target: &str) -> bool {
    let output = std::process::Command::new("tailscale")
        .args(&["ping", "-c", "1", "-timeout", "3s", target])
        .output();
    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

fn collect_metrics(topology: &str) -> MetricsSnapshot {
    let mut snap = MetricsSnapshot {
        timestamp: now_ts(),
        topology: topology.to_string(),
        ..Default::default()
    };

    if topology == "edge-primary" {
        // Edge Node
        if let Some(info) = rpc_get_chain_info("100.76.16.108", 8443) {
            snap.edge_node = Some(NodeMetrics {
                running: true,
                chain_height: info.get("chain_height").and_then(|v| v.as_u64()),
                tip_hash: info.get("tip_hash").and_then(|v| v.as_str().map(|s| s.to_string())),
                known_peers: info.get("known_peers").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                mempool_size: info.get("mempool_transactions").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                network: info.get("network").and_then(|v| v.as_str().map(|s| s.to_string())),
                protocol_version: info.get("protocol_version").and_then(|v| v.as_u64()).map(|v| v as u32),
                consensus_profile: info.get("consensus_profile").and_then(|v| v.as_str().map(|s| s.to_string())),
                accepted_blocks: info.get("accepted_blocks").and_then(|v| v.as_u64()),
            });
        }

        // Local Backup Node
        if let Some(info) = rpc_get_chain_info("127.0.0.1", 8443) {
            snap.local_node = Some(NodeMetrics {
                running: true,
                chain_height: info.get("chain_height").and_then(|v| v.as_u64()),
                tip_hash: info.get("tip_hash").and_then(|v| v.as_str().map(|s| s.to_string())),
                known_peers: info.get("known_peers").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                mempool_size: info.get("mempool_transactions").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                network: info.get("network").and_then(|v| v.as_str().map(|s| s.to_string())),
                protocol_version: info.get("protocol_version").and_then(|v| v.as_u64()).map(|v| v as u32),
                consensus_profile: info.get("consensus_profile").and_then(|v| v.as_str().map(|s| s.to_string())),
                accepted_blocks: info.get("accepted_blocks").and_then(|v| v.as_u64()),
            });
        }

        // Edge Pool Metrics
        snap.pool = scrape_prometheus("100.76.16.108", 8455);

        // Tailscale
        snap.tailscale_ok = tailscale_ping("100.76.16.108");
    } else {
        // Local-dev: only local services
        if let Some(info) = rpc_get_chain_info("127.0.0.1", 8443) {
            snap.local_node = Some(NodeMetrics {
                running: true,
                chain_height: info.get("chain_height").and_then(|v| v.as_u64()),
                tip_hash: info.get("tip_hash").and_then(|v| v.as_str().map(|s| s.to_string())),
                known_peers: info.get("known_peers").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                mempool_size: info.get("mempool_transactions").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                network: info.get("network").and_then(|v| v.as_str().map(|s| s.to_string())),
                protocol_version: info.get("protocol_version").and_then(|v| v.as_u64()).map(|v| v as u32),
                consensus_profile: info.get("consensus_profile").and_then(|v| v.as_str().map(|s| s.to_string())),
                accepted_blocks: info.get("accepted_blocks").and_then(|v| v.as_u64()),
            });
        }
        snap.pool = scrape_prometheus("127.0.0.1", 9550);
    }

    snap
}

fn main() {
    println!("ZION Dashboard Metrics Collector v3.0.0");
    println!("Interval: {}s  |  Output: {}", INTERVAL_SECS, OUTPUT_PATH);

    // Ensure output directory exists
    if let Some(parent) = PathBuf::from(OUTPUT_PATH).parent() {
        let _ = fs::create_dir_all(parent);
    }

    loop {
        let config = load_config();
        let topology = config.get("topology").and_then(|v| v.as_str()).unwrap_or("edge-primary");

        let snap = collect_metrics(topology);

        match serde_json::to_string_pretty(&snap) {
            Ok(json) => {
                if let Err(e) = fs::write(OUTPUT_PATH, json) {
                    eprintln!("Failed to write metrics: {}", e);
                } else {
                    println!("[{}] Metrics collected — Edge height: {:?}, Local height: {:?}, Pool miners: {:?}",
                        snap.timestamp,
                        snap.edge_node.as_ref().and_then(|n| n.chain_height),
                        snap.local_node.as_ref().and_then(|n| n.chain_height),
                        snap.pool.as_ref().and_then(|p| p.active_miners));
                }
            }
            Err(e) => eprintln!("JSON serialize error: {}", e),
        }

        thread::sleep(Duration::from_secs(INTERVAL_SECS));
    }
}
