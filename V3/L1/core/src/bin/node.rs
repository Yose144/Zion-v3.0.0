use anyhow::{anyhow, Context, Result};
use std::collections::{HashSet, VecDeque};
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use zion_core::{
    decode_p2p_message, decode_rpc_request, encode_p2p_message, encode_rpc_response,
    node_protocol_version, propagation::{PropagationStats, SeenBlocks},
    AcceptedBlock, NodeConfig, NodeRuntime, P2pMessage, PeerEndpoint,
};

fn main() -> Result<()> {
    let config = NodeServerConfig::from_env()?;
    let runtime = Arc::new(Mutex::new(match config.state_path.as_deref() {
        Some(state_path) => NodeRuntime::with_chain_store(
            config.node_id.clone(),
            config.node_config.clone(),
            state_path,
        )
        .map_err(anyhow::Error::msg)?,
        None => NodeRuntime::new(config.node_id.clone(), config.node_config.clone()),
    }));

    println!("ZION v3 node");
    println!("node_id={}", config.node_id);
    println!("protocol_version={}", node_protocol_version());
    println!("p2p_bind={}", config.node_config.p2p_bind.address());
    println!("rpc_bind={}", config.node_config.rpc_bind.address());
    println!(
        "p2p_accept_limit={}",
        config
            .p2p_accept_limit
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unbounded".to_string())
    );
    println!(
        "rpc_accept_limit={}",
        config
            .rpc_accept_limit
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unbounded".to_string())
    );
    if let Some(state_path) = config.state_path.as_deref() {
        println!("state_path={state_path}");
    }

    bootstrap_peer_sync(&runtime, config.sync_batch_limit)?;

    // Shared propagation state
    let seen_blocks = Arc::new(Mutex::new(SeenBlocks::new()));
    let prop_stats = Arc::new(PropagationStats::new());

    let p2p_listener = TcpListener::bind(config.node_config.p2p_bind.address())
        .context("failed to bind P2P listener")?;
    let rpc_listener = TcpListener::bind(config.node_config.rpc_bind.address())
        .context("failed to bind RPC listener")?;

    let p2p_runtime = Arc::clone(&runtime);
    let p2p_seen = Arc::clone(&seen_blocks);
    let p2p_stats = Arc::clone(&prop_stats);
    let p2p_limit = config.p2p_accept_limit;
    let p2p_thread = thread::spawn(move || -> Result<()> {
        let mut handles = Vec::new();
        let mut accepted = 0u32;
        loop {
            if matches!(p2p_limit, Some(limit) if accepted >= limit) {
                break;
            }
            let (stream, peer_addr) = p2p_listener.accept().context("failed to accept P2P peer")?;
            println!("p2p_peer_addr={peer_addr}");
            let runtime = Arc::clone(&p2p_runtime);
            let seen = Arc::clone(&p2p_seen);
            let stats = Arc::clone(&p2p_stats);
            let source = peer_addr.to_string();
            handles.push(thread::spawn(move || {
                handle_p2p_stream(stream, &runtime, &seen, &stats, &source)
            }));
            accepted = accepted.saturating_add(1);
        }
        for handle in handles {
            handle.join().map_err(|_| anyhow!("P2P client thread panicked"))??;
        }
        Ok(())
    });

    let rpc_runtime = Arc::clone(&runtime);
    let rpc_seen = Arc::clone(&seen_blocks);
    let rpc_stats = Arc::clone(&prop_stats);
    let rpc_limit = config.rpc_accept_limit;
    let rpc_thread = thread::spawn(move || -> Result<()> {
        let mut handles = Vec::new();
        let mut accepted = 0u32;
        loop {
            if matches!(rpc_limit, Some(limit) if accepted >= limit) {
                break;
            }
            let (stream, peer_addr) = rpc_listener.accept().context("failed to accept RPC client")?;
            println!("rpc_client_addr={peer_addr}");
            let runtime = Arc::clone(&rpc_runtime);
            let seen = Arc::clone(&rpc_seen);
            let stats = Arc::clone(&rpc_stats);
            handles.push(thread::spawn(move || {
                handle_rpc_stream(stream, &runtime, &seen, &stats)
            }));
            accepted = accepted.saturating_add(1);
        }
        for handle in handles {
            handle.join().map_err(|_| anyhow!("RPC client thread panicked"))??;
        }
        Ok(())
    });

    p2p_thread.join().map_err(|_| anyhow!("P2P thread panicked"))??;
    rpc_thread.join().map_err(|_| anyhow!("RPC thread panicked"))??;

    let status = runtime.lock().expect("node runtime lock poisoned").status();
    let snap = prop_stats.snapshot();
    println!("known_peers={}", status.known_peers.len());
    println!("blocks_relayed={}", snap.blocks_relayed);
    println!("relay_successes={}", snap.relay_successes);
    println!("relay_failures={}", snap.relay_failures);
    println!("revenue_total_usd={:.2}", status.revenue.total_earnings_usd);
    Ok(())
}

fn handle_p2p_stream(
    stream: TcpStream,
    runtime: &Arc<Mutex<NodeRuntime>>,
    seen: &Arc<Mutex<SeenBlocks>>,
    stats: &Arc<PropagationStats>,
    source_addr: &str,
) -> Result<()> {
    let reader_stream = stream.try_clone().context("failed to clone P2P stream")?;
    let mut reader = BufReader::new(reader_stream);
    let mut writer = stream;

    let line = read_line(&mut reader)?;
    println!("p2p_in={line}");
    let message = decode_p2p_message(&line).context("failed to decode P2P message")?;

    // Detect AnnounceBlock for relay
    let is_announce = matches!(&message, P2pMessage::AnnounceBlock { .. });

    let response = runtime
        .lock()
        .expect("node runtime lock poisoned")
        .handle_p2p_message(message)
        .map_err(|reason| anyhow!(reason))?;
    let response_line = encode_p2p_message(&response).context("failed to encode P2P response")?;
    writer
        .write_all(response_line.as_bytes())
        .context("failed to write P2P response")?;
    writer.flush().context("failed to flush P2P response")?;
    println!("p2p_out={}", response_line.trim());

    // Relay newly accepted block to other peers (flood-fill)
    if is_announce {
        let rt = runtime.lock().expect("node runtime lock poisoned");
        if let Some(block) = rt.last_accepted_block().cloned() {
            let peers = rt.known_peers().to_vec();
            drop(rt);
            relay_block_to_peers(
                block,
                &peers,
                Some(source_addr),
                seen,
                stats,
            );
        }
    }

    Ok(())
}

fn handle_rpc_stream(
    stream: TcpStream,
    runtime: &Arc<Mutex<NodeRuntime>>,
    seen: &Arc<Mutex<SeenBlocks>>,
    stats: &Arc<PropagationStats>,
) -> Result<()> {
    let reader_stream = stream.try_clone().context("failed to clone RPC stream")?;
    let mut reader = BufReader::new(reader_stream);
    let mut writer = stream;

    let line = read_line(&mut reader)?;
    println!("rpc_in={line}");
    let request = decode_rpc_request(&line).context("failed to decode RPC request")?;

    // Check if this is a submit that might produce a new block
    let is_submit = matches!(&request, zion_core::RpcRequest::SubmitCandidate { .. });
    let height_before = runtime.lock().expect("lock").chain_height();

    let response = runtime
        .lock()
        .expect("node runtime lock poisoned")
        .handle_rpc_request(request);
    let response_line = encode_rpc_response(&response).context("failed to encode RPC response")?;
    writer
        .write_all(response_line.as_bytes())
        .context("failed to write RPC response")?;
    writer.flush().context("failed to flush RPC response")?;
    println!("rpc_out={}", response_line.trim());

    // Relay newly mined block to all peers
    if is_submit {
        let rt = runtime.lock().expect("lock");
        if rt.chain_height() > height_before {
            if let Some(block) = rt.last_accepted_block().cloned() {
                let peers = rt.known_peers().to_vec();
                drop(rt);
                relay_block_to_peers(block, &peers, None, seen, stats);
            }
        }
    }

    Ok(())
}

fn read_line(reader: &mut impl BufRead) -> Result<String> {
    let mut line = String::new();
    let read = reader.read_line(&mut line).context("failed to read line")?;
    if read == 0 {
        return Err(anyhow!("connection closed before message"));
    }
    Ok(line.trim().to_string())
}

#[derive(Debug, Clone)]
struct NodeServerConfig {
    node_id: String,
    p2p_accept_limit: Option<u32>,
    rpc_accept_limit: Option<u32>,
    sync_batch_limit: u16,
    state_path: Option<String>,
    node_config: NodeConfig,
}

impl NodeServerConfig {
    fn from_env() -> Result<Self> {
        let mut node_config = NodeConfig::mainnet();

        if let Ok(value) = std::env::var("ZION_P2P_BIND") {
            node_config.p2p_bind = parse_endpoint_env(&value, "ZION_P2P_BIND")?;
        }
        if let Ok(value) = std::env::var("ZION_RPC_BIND") {
            node_config.rpc_bind = parse_endpoint_env(&value, "ZION_RPC_BIND")?;
        }
        if let Ok(value) = std::env::var("ZION_POOL_BIND") {
            node_config.pool_bind = parse_endpoint_env(&value, "ZION_POOL_BIND")?;
        }
        if let Ok(value) = std::env::var("ZION_SEED_PEERS") {
            node_config.seed_peers = parse_seed_peers_env(&value)?;
        }

        let shared_accept_limit = parse_accept_limit_env("ZION_ACCEPT_LIMIT", None)?;

        Ok(Self {
            node_id: env_or_default("ZION_NODE_ID", "v3-node-0"),
            p2p_accept_limit: parse_accept_limit_env("ZION_P2P_ACCEPT_LIMIT", shared_accept_limit)?,
            rpc_accept_limit: parse_accept_limit_env("ZION_RPC_ACCEPT_LIMIT", shared_accept_limit)?,
            sync_batch_limit: parse_sync_batch_limit_env()?,
            state_path: std::env::var("ZION_NODE_STATE_PATH").ok(),
            node_config,
        })
    }
}

fn env_or_default(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn parse_endpoint_env(value: &str, key: &str) -> Result<PeerEndpoint> {
    PeerEndpoint::parse(value).map_err(|reason| anyhow!("{key}: {reason}"))
}

fn parse_accept_limit_env(key: &str, default: Option<u32>) -> Result<Option<u32>> {
    match std::env::var(key) {
        Ok(value) => value
            .parse::<u32>()
            .map(Some)
            .with_context(|| format!("invalid u32 in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn parse_sync_batch_limit_env() -> Result<u16> {
    match std::env::var("ZION_SYNC_BATCH_LIMIT") {
        Ok(value) => value
            .parse::<u16>()
            .with_context(|| format!("invalid u16 in ZION_SYNC_BATCH_LIMIT: {value}")),
        Err(_) => Ok(32),
    }
}

fn parse_seed_peers_env(value: &str) -> Result<Vec<PeerEndpoint>> {
    value
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| parse_endpoint_env(entry, "ZION_SEED_PEERS"))
        .collect::<Result<Vec<_>>>()
}

fn bootstrap_peer_sync(runtime: &Arc<Mutex<NodeRuntime>>, batch_limit: u16) -> Result<()> {
    let self_p2p_bind = {
        runtime
            .lock()
            .expect("node runtime lock poisoned")
            .config()
            .p2p_bind
            .address()
    };
    let mut pending = VecDeque::from(
        runtime
            .lock()
            .expect("node runtime lock poisoned")
            .known_peers()
            .to_vec(),
    );
    let mut seen = HashSet::new();

    while let Some(peer) = pending.pop_front() {
        let address = peer.address();
        if address == self_p2p_bind || !seen.insert(address.clone()) {
            continue;
        }
        match sync_from_peer(runtime, &peer, batch_limit.max(1)) {
            Ok(discovered) => {
                for peer in discovered {
                    let peer_address = peer.address();
                    if peer_address != self_p2p_bind && !seen.contains(&peer_address) {
                        pending.push_back(peer);
                    }
                }
            }
            Err(error) => {
                eprintln!("peer_sync_failed peer={address} reason={error}");
            }
        }
    }

    Ok(())
}

fn sync_from_peer(
    runtime: &Arc<Mutex<NodeRuntime>>,
    peer: &PeerEndpoint,
    batch_limit: u16,
) -> Result<Vec<PeerEndpoint>> {
    let hello = {
        runtime
            .lock()
            .expect("node runtime lock poisoned")
            .p2p_hello()
    };
    let welcome = p2p_roundtrip(peer, &hello)?;
    let discovered = match welcome {
        zion_core::P2pMessage::Welcome { peers, .. } => peers,
        other => return Err(anyhow!("unexpected hello response: {other:?}")),
    };

    {
        let mut runtime = runtime.lock().expect("node runtime lock poisoned");
        runtime.register_peer(peer.clone());
        runtime.register_peers(discovered.clone());
    }

    let status = match p2p_roundtrip(peer, &zion_core::P2pMessage::GetStatus)? {
        zion_core::P2pMessage::Status { status } => status,
        other => return Err(anyhow!("unexpected status response: {other:?}")),
    };

    {
        let mut runtime = runtime.lock().expect("node runtime lock poisoned");
        runtime.register_peers(status.known_peers.clone());
    }

    loop {
        let from_height = {
            let runtime = runtime.lock().expect("node runtime lock poisoned");
            if !runtime.needs_blocks_from(status.chain_height) {
                break;
            }
            runtime.chain_height()
        };

        let blocks = match p2p_roundtrip(
            peer,
            &zion_core::P2pMessage::GetBlocksSince {
                from_height,
                limit: batch_limit,
            },
        )? {
            zion_core::P2pMessage::Blocks { blocks } => blocks,
            other => return Err(anyhow!("unexpected block sync response: {other:?}")),
        };

        if blocks.is_empty() {
            return Err(anyhow!(
                "peer {} advertised height {} but returned no blocks after {}",
                peer.address(),
                status.chain_height,
                from_height
            ));
        }

        let imported = runtime
            .lock()
            .expect("node runtime lock poisoned")
            .import_peer_blocks(blocks)
            .map_err(anyhow::Error::msg)?;
        if imported == 0 {
            break;
        }
    }

    Ok(discovered)
}

fn p2p_roundtrip(peer: &PeerEndpoint, message: &zion_core::P2pMessage) -> Result<zion_core::P2pMessage> {
    let mut stream = TcpStream::connect(peer.address())
        .with_context(|| format!("failed to connect to peer {}", peer.address()))?;
    let line = encode_p2p_message(message).context("failed to encode outbound P2P message")?;
    stream
        .write_all(line.as_bytes())
        .context("failed to write outbound P2P message")?;
    stream
        .flush()
        .context("failed to flush outbound P2P message")?;

    let mut reader = BufReader::new(stream);
    let response = read_line(&mut reader)?;
    decode_p2p_message(&response).context("failed to decode inbound P2P response")
}

/// Relay a newly accepted block to all eligible peers via flood-fill.
/// Spawns a background thread per peer so the caller is not blocked.
fn relay_block_to_peers(
    block: AcceptedBlock,
    peers: &[PeerEndpoint],
    source_addr: Option<&str>,
    seen: &Arc<Mutex<SeenBlocks>>,
    stats: &Arc<PropagationStats>,
) {
    use zion_core::propagation::plan_relay;

    let plan = {
        let mut seen_guard = seen.lock().expect("seen lock poisoned");
        plan_relay(
            &block.hash_hex,
            block.height,
            peers,
            source_addr,
            &mut seen_guard,
        )
    };

    let plan = match plan {
        Some(p) => p,
        None => {
            stats.record_duplicate();
            return;
        }
    };

    let target_count = plan.targets.len() as u64;
    stats.record_relay(target_count);
    println!(
        "relay_block height={} hash={:.16}… targets={}",
        plan.block_height, plan.block_hash, target_count
    );

    for target in plan.targets {
        let block = block.clone();
        let stats = Arc::clone(stats);
        thread::spawn(move || {
            let msg = P2pMessage::AnnounceBlock { block };
            match p2p_roundtrip(&target.peer, &msg) {
                Ok(_) => {
                    println!("relay_ok peer={}", target.peer.address());
                    stats.record_success();
                }
                Err(e) => {
                    eprintln!("relay_err peer={} reason={e}", target.peer.address());
                    stats.record_failure();
                }
            }
        });
    }
}