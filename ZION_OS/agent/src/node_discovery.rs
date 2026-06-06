use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tokio::time::interval;
use tracing::{info, warn};

const DISCOVERY_INTERVAL_SEC: u64 = 60;
const RPC_TIMEOUT_SEC: u64 = 3;
const EDGE_SEED: &str = "77.42.71.94:8333";
const EDGE_RPC: &str = "http://77.42.71.94:8443";

/// Stav jednoho objeveného uzlu
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredNode {
    pub id: String,                    // rig-id nebo generované
    pub ip: String,
    pub rpc_port: u16,
    pub p2p_port: Option<u16>,
    pub chain_height: u64,
    pub peers: usize,
    pub version: Option<String>,
    pub platform: Option<String>,
    pub discovered_at: u64,          // unix timestamp
    pub last_seen: u64,
    pub synced_with_edge: bool,
    pub needs_help: bool,            // true pokud height==0 nebo peers==0
    pub reward_claimed: bool,
}

/// Reward záznam za adopci nového uzlu
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeReward {
    pub node_id: String,
    pub node_ip: String,
    pub adopted_at: u64,
    pub reward_points: u64,
    pub description: String,
}

/// Globální stav discovery
#[derive(Debug, Default)]
pub struct DiscoveryState {
    pub nodes: RwLock<HashMap<String, DiscoveredNode>>,
    pub rewards: RwLock<Vec<NodeReward>>,
}

impl DiscoveryState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            nodes: RwLock::new(HashMap::new()),
            rewards: RwLock::new(Vec::new()),
        })
    }
}

/// Hlavní discovery loop — spustí se jako background task
pub async fn discovery_loop(state: Arc<DiscoveryState>) {
    let mut tick = interval(Duration::from_secs(DISCOVERY_INTERVAL_SEC));
    info!("[node-discovery] Loop spusten, interval={}s", DISCOVERY_INTERVAL_SEC);

    loop {
        tick.tick().await;
        if let Err(e) = scan_and_adopt(state.clone()).await {
            warn!("[node-discovery] Scan selhal: {}", e);
        }
    }
}

/// Jedno kolo discovery + adopce
async fn scan_and_adopt(state: Arc<DiscoveryState>) -> anyhow::Result<()> {
    let local_subnets = discover_local_subnets();
    let candidates = scan_rpc_ports(&local_subnets).await;

    for candidate in candidates {
        let node_id = format!("{}:{}", candidate.ip, candidate.rpc_port);
        let mut nodes = state.nodes.write().await;

        // Aktualizace nebo vlozeni
        let now = now_sec();
        if let Some(existing) = nodes.get_mut(&node_id) {
            existing.chain_height = candidate.chain_height;
            existing.peers = candidate.peers;
            existing.last_seen = now;
            existing.needs_help = candidate.needs_help;
            existing.synced_with_edge = candidate.synced_with_edge;
        } else {
            info!(
                "[node-discovery] Novy uzel nalezen: {} (height={}, peers={})",
                node_id, candidate.chain_height, candidate.peers
            );
            let node: DiscoveredNode = candidate.clone().into();
            nodes.insert(node_id.clone(), node);

            // Pokud je novy a potrebuje pomoct, adoptujeme ho
            if candidate.needs_help {
                drop(nodes); // uvolnime zámek pred RPC volanim
                let node_for_adopt: DiscoveredNode = candidate.into();
                if let Err(e) = try_adopt_node(state.clone(), &node_for_adopt).await {
                    warn!("[node-discovery] Adopce {} selhala: {}", node_id, e);
                }
            }
        }
    }

    Ok(())
}

/// Pokusí se pomoci uzlu: nabídne Edge seed peer, případně jiné tipy
async fn try_adopt_node(
    state: Arc<DiscoveryState>,
    node: &DiscoveredNode,
) -> anyhow::Result<()> {
    info!(
        "[node-discovery] Adoptuji uzel {} — seed={}",
        node.ip, EDGE_SEED
    );

    // 1. Zkusime poslat RPC addpeer (pokud node podporuje)
    let rpc_url = format!("http://{}:{}", node.ip, node.rpc_port);
    let _ = add_peer_via_rpc(&rpc_url, EDGE_SEED).await;

    // 2. Ulozime reward
    let reward = NodeReward {
        node_id: format!("{}:{}", node.ip, node.rpc_port),
        node_ip: node.ip.clone(),
        adopted_at: now_sec(),
        reward_points: 10, // zakladni bod za adopci
        description: format!("Adoptovan novy uzel {} se seed {}", node.ip, EDGE_SEED),
    };

    let mut rewards = state.rewards.write().await;
    rewards.push(reward);
    info!("[node-discovery] Reward ulozen: {} bodu za {}", 10, node.ip);

    // 3. Označíme node jako synced (optimisticky)
    let node_id = format!("{}:{}", node.ip, node.rpc_port);
    if let Some(n) = state.nodes.write().await.get_mut(&node_id) {
        n.synced_with_edge = true;
        n.reward_claimed = true;
    }

    Ok(())
}

/// Jednoduchý RPC probe — vrátí height a peer count
#[derive(Debug, Clone)]
struct RpcProbeResult {
    ip: String,
    rpc_port: u16,
    chain_height: u64,
    peers: usize,
    needs_help: bool,
    synced_with_edge: bool,
}

impl From<RpcProbeResult> for DiscoveredNode {
    fn from(r: RpcProbeResult) -> Self {
        let now = now_sec();
        DiscoveredNode {
            id: format!("{}:{}", r.ip, r.rpc_port),
            ip: r.ip,
            rpc_port: r.rpc_port,
            p2p_port: Some(8333),
            chain_height: r.chain_height,
            peers: r.peers,
            version: None,
            platform: None,
            discovered_at: now,
            last_seen: now,
            synced_with_edge: r.synced_with_edge,
            needs_help: r.needs_help,
            reward_claimed: false,
        }
    }
}

async fn probe_rpc(ip: &str, port: u16) -> Option<RpcProbeResult> {
    let url = format!("http://{}:{}", ip, port);

    // Zkusime zavolat JSON-RPC: blockchain.height
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "blockchain.height",
        "params": []
    });

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(RPC_TIMEOUT_SEC))
        .build()
    {
        Ok(c) => c,
        Err(_) => return None,
    };

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    match resp {
        Ok(r) => {
            if let Ok(json) = r.json::<serde_json::Value>().await {
                let height = json["result"]["height"]
                    .as_u64()
                    .or_else(|| json["result"].as_u64())
                    .unwrap_or(0);

                // Zkusime ziskat i peer count pres net.peers nebo jinou metodu
                let peers = probe_peer_count(&client, &url).await.unwrap_or(0);
                let needs_help = height == 0 && peers == 0;

                Some(RpcProbeResult {
                    ip: ip.to_string(),
                    rpc_port: port,
                    chain_height: height,
                    peers,
                    needs_help,
                    synced_with_edge: false, // zjistime v scan_and_adopt
                })
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

async fn probe_peer_count(client: &reqwest::Client, url: &str) -> Option<usize> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "net.peers",
        "params": []
    });

    match client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => {
            if let Ok(json) = r.json::<serde_json::Value>().await {
                json["result"]
                    .as_array()
                    .map(|arr| arr.len())
                    .or_else(|| json["result"]["count"].as_u64().map(|n| n as usize))
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

async fn add_peer_via_rpc(rpc_url: &str, peer_addr: &str) -> anyhow::Result<()> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "net.addPeer",
        "params": [peer_addr]
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(RPC_TIMEOUT_SEC))
        .build()?;

    let resp = client
        .post(rpc_url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    if resp.status().is_success() {
        info!("[node-discovery] Peer {} pridan pres RPC {}", peer_addr, rpc_url);
    } else {
        warn!(
            "[node-discovery] net.addPeer vrátil status {}",
            resp.status()
        );
    }
    Ok(())
}

/// Scanuje běžné RPC porty na lokálních subnetech
async fn scan_rpc_ports(subnets: &[String]) -> Vec<RpcProbeResult> {
    let mut results = Vec::new();
    let ports = [8443u16, 8446, 8445, 8447];

    for subnet in subnets {
        // Zjednodusene: vezmeme první 3 oktety a scanujeme .1 az .254
        let base = subnet.trim_end_matches(".0/24");
        if base.is_empty() {
            continue;
        }

        let mut tasks = Vec::new();
        for i in 1..=254 {
            let ip = format!("{}.{}", base, i);
            for port in ports {
                let ip_clone = ip.clone();
                tasks.push(tokio::spawn(async move {
                    probe_rpc(&ip_clone, port).await
                }));
            }
        }

        for t in tasks {
            if let Ok(Some(res)) = t.await {
                results.push(res);
            }
        }
    }

    results
}

/// Zjistí lokální subnet(y) z aktivních interface
fn discover_local_subnets() -> Vec<String> {
    let mut subnets = Vec::new();

    // Windows: zkusime zjistit z hostname -I ekvivalentu nebo default gateway
    // Simplified fallback: scanujeme 192.168.x.0/24 a 10.x.x.0/24 pokud jsme v daném subnetu
    if let Ok(output) = std::process::Command::new("cmd")
        .args(["/c", "ipconfig"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains("IPv4 Address") || line.contains("IPv4 adresa") {
                if let Some(ip_str) = line.split(':').nth(1) {
                    let ip = ip_str.trim();
                    // Parsujeme IP a vezmeme první 3 oktety
                    let parts: Vec<&str> = ip.split('.').collect();
                    if parts.len() == 4 {
                        let subnet = format!("{}.{}.{}.0/24", parts[0], parts[1], parts[2]);
                        if !subnets.contains(&subnet) {
                            subnets.push(subnet);
                        }
                    }
                }
            }
        }
    }

    // Fallback pro unix
    #[cfg(unix)]
    {
        if let Ok(output) = std::process::Command::new("hostname").args(["-I"]).output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for ip in stdout.split_whitespace() {
                let parts: Vec<&str> = ip.split('.').collect();
                if parts.len() == 4 {
                    let subnet = format!("{}.{}.{}.0/24", parts[0], parts[1], parts[2]);
                    if !subnets.contains(&subnet) {
                        subnets.push(subnet);
                    }
                }
            }
        }
    }

    // Pokud nic nenajdeme, default local subnet
    if subnets.is_empty() {
        subnets.push("192.168.1.0/24".to_string());
    }

    subnets
}

fn now_sec() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
