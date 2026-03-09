pub mod checkpoint;
pub mod discovery;
pub mod heartbeat;
pub mod messages;
pub mod peers;
pub mod persistence;
pub mod security;
pub mod seeds;
pub mod sync;

use crate::state::State;
use anyhow::Result;
use messages::Message;
use peers::{PeerInfo, PeerManager};
use security::{Blacklist, ConnectionLimiter, MessageRateLimiter, RateLimiter};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashSet;
use sync::SyncStatus;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;

static GLOBAL_BROADCAST_TX: OnceLock<mpsc::UnboundedSender<Message>> = OnceLock::new();
static GLOBAL_SYNC_STATUS: OnceLock<SyncStatus> = OnceLock::new();
/// P1-11: Random nonce generated once at startup — used to detect self-connections.
/// If a peer sends back the same nonce in their Handshake, we are connecting to ourselves.
static LOCAL_NODE_NONCE: OnceLock<u64> = OnceLock::new();

/// Get this node's random nonce (generated once per process lifetime).
fn node_nonce() -> u64 {
    *LOCAL_NODE_NONCE.get_or_init(rand::random::<u64>)
}

/// Get global sync status (for RPC/metrics).
pub fn get_sync_status() -> &'static SyncStatus {
    GLOBAL_SYNC_STATUS.get_or_init(SyncStatus::new)
}

pub async fn start(state: State, port: u16, mut initial_peers: Vec<String>) -> Result<()> {
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;
    println!("P2P Node listening on {}", addr);

    let peers = Arc::new(PeerManager::new());

    // ── Tree-node discovery ───────────────────────────────────────────────
    // Start peer-exchange loop (GetPeers every 5 min)
    discovery::start_peer_exchange(peers.clone());
    // Start DNS seed refresh loop (every 30 min)
    discovery::start_dns_refresh(peers.clone());

    // Register PeerManager in State so JSON-RPC can access peer list
    {
        let mut pm = state.peer_manager.lock().unwrap();
        *pm = Some(peers.clone());
    }

    // Compatibility bridge for older call-sites using p2p::broadcast(Value).
    // Messages are forwarded into the peer broadcast pipeline.
    let (compat_tx, mut compat_rx) = mpsc::unbounded_channel::<Message>();
    let _ = GLOBAL_BROADCAST_TX.set(compat_tx);
    {
        let peers_compat = peers.clone();
        tokio::spawn(async move {
            while let Some(msg) = compat_rx.recv().await {
                peers_compat.broadcast(msg).await;
            }
        });
    }

    // Initialize security components
    let rate_limiter = Arc::new(RateLimiter::new(
        50, // max 50 connections per IP
        60, // per 60 seconds
        10, // max 10 attempts per window
    ));
    let blacklist = Arc::new(Blacklist::new());
    let connection_limiter = ConnectionLimiter::new(128); // max 128 total connections (96 inbound + 32 outbound)
    let msg_rate_limiter = Arc::new(MessageRateLimiter::new(
        200, // max 200 messages per peer
        60,  // per 60 seconds
        3,   // auto-ban after 3 violations
    ));

    // Start security cleanup task
    let rate_limiter_cleanup = rate_limiter.clone();
    let blacklist_cleanup = blacklist.clone();
    let msg_rate_cleanup = msg_rate_limiter.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            rate_limiter_cleanup.cleanup();
            blacklist_cleanup.cleanup();
            msg_rate_cleanup.cleanup();
        }
    });

    // Load saved peers from previous run
    // Persist under ZION_DATA_DIR (volume-mounted in Docker), defaulting to ./data.
    let data_dir = std::env::var("ZION_DATA_DIR").unwrap_or_else(|_| "data".to_string());
    let peers_file = PathBuf::from(&data_dir).join("peers.json");
    if let Some(parent) = peers_file.parent() {
        // Best-effort: do not fail startup if we cannot create this directory.
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    if let Ok(saved_peers) = peers.load_from_disk(&peers_file).await {
        if !saved_peers.is_empty() {
            // P2P-BUG-02 fix: skip saved peers whose IP is already covered by
            // an explicitly configured seed (--peers flag). Prevents the node
            // from preferring a saved ephemeral-port entry over the canonical
            // seed port, and avoids duplicate connections to the same host.
            let seed_ips: std::collections::HashSet<std::net::IpAddr> = initial_peers
                .iter()
                .filter_map(|p| p.parse::<std::net::SocketAddr>().ok().map(|sa| sa.ip()))
                .collect();
            let new_peers: Vec<String> = saved_peers
                .into_iter()
                .filter(|p| {
                    p.parse::<std::net::SocketAddr>()
                        .ok()
                        .map(|sa| !seed_ips.contains(&sa.ip()))
                        .unwrap_or(false)
                })
                .collect();
            if !new_peers.is_empty() {
                println!(
                    "[P2P] Adding {} saved peers to initial_peers",
                    new_peers.len()
                );
                initial_peers.extend(new_peers);
            }
        }
    }

    // 0. Connect to initial peers
    for peer_addr in &initial_peers {
        let state_conn = state.clone();
        let peers_conn = peers.clone();
        let blacklist_conn = blacklist.clone();
        let msg_rate_conn = msg_rate_limiter.clone();
        let peer_addr_owned = peer_addr.clone();
        println!("Connecting to initial peer: {}", peer_addr);

        tokio::spawn(async move {
            // Simple retry loop or one-off? One-off for now.
            if let Ok(stream) = TcpStream::connect(&peer_addr_owned).await {
                if let Ok(socket_addr) = peer_addr_owned.parse::<SocketAddr>() {
                    println!("Connected to {}", peer_addr_owned);
                    if let Err(e) = handle_connection(
                        stream,
                        socket_addr,
                        state_conn,
                        peers_conn,
                        blacklist_conn,
                        msg_rate_conn,
                        peers::PeerDirection::Outbound,
                    )
                    .await
                    {
                        println!("Connection to {} closed: {}", peer_addr_owned, e);
                    }
                }
            } else {
                println!("Failed to connect to {}", peer_addr_owned);
            }
        });
    }

    // 0.5. Start Heartbeat Monitor
    let state_heartbeat = state.clone();
    let peers_heartbeat = peers.clone();
    let blacklist_heartbeat = blacklist.clone();
    let msg_rate_heartbeat = msg_rate_limiter.clone();
    let initial_peers_clone = initial_peers.clone();
    tokio::spawn(async move {
        heartbeat::start_heartbeat(
            state_heartbeat,
            peers_heartbeat,
            blacklist_heartbeat,
            msg_rate_heartbeat,
            initial_peers_clone,
        )
        .await;
    });

    // 0.6. Start Peer Persistence Task (save every 5 minutes)
    let peers_persist = peers.clone();
    let peers_file_persist = peers_file.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 min
        loop {
            interval.tick().await;
            if let Some(parent) = peers_file_persist.parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }
            if let Err(e) = peers_persist.save_to_disk(&peers_file_persist).await {
                eprintln!("[P2P] Failed to save peers: {}", e);
            }
        }
    });

    // 1. Broadcaster Loop (Events -> Network)
    let state_clone = state.clone();
    let peers_broadcast = peers.clone();

    tokio::spawn(async move {
        // Broadcaster subscribes to local changes (Mined blocks, RPC submitted txs)
        let mut rx_block = state_clone.block_broadcaster.subscribe();
        let mut rx_tx = state_clone.tx_broadcaster.subscribe();

        loop {
            tokio::select! {
                Ok((h, hash)) = rx_block.recv() => {
                    // Don't broadcast during IBD — we'd spam about every downloaded block
                    if !get_sync_status().is_ibd() {
                        peers_broadcast.broadcast(Message::NewBlock { height: h, hash }).await;
                        let sent = peers_broadcast.active_count() as u64;
                        state_clone.metrics.messages_sent.fetch_add(sent, std::sync::atomic::Ordering::Relaxed);
                    }
                }
                Ok(tx) = rx_tx.recv() => {
                    peers_broadcast.broadcast(Message::NewTx { id: tx.id }).await;
                    let sent = peers_broadcast.active_count() as u64;
                    state_clone.metrics.messages_sent.fetch_add(sent, std::sync::atomic::Ordering::Relaxed);
                }
            }
        }
    });

    // 2. Listener Loop with Security Checks
    loop {
        let (socket, remote_addr) = listener.accept().await?;
        let ip = remote_addr.ip();

        // Security check: blacklist
        if blacklist.is_blacklisted(&ip) {
            println!("[P2P Security] Blocked blacklisted IP: {}", ip);
            drop(socket);
            continue;
        }

        // Security check: rate limit
        if !rate_limiter.allow_connection(ip) {
            println!("[P2P Security] Rate limit exceeded for: {}", ip);
            // Temporary ban for 2 minutes (reduced from 5 min for testnet)
            blacklist.ban_temporary(ip, 120);
            drop(socket);
            continue;
        }

        // Security check: connection limit
        let current_connections = peers.active_count();
        if !connection_limiter.allow_connection(current_connections) {
            println!(
                "[P2P Security] Connection limit reached, rejecting {}",
                remote_addr
            );
            drop(socket);
            continue;
        }

        // P1-07: Inbound/outbound slot separation — reserve 32 slots for outbound
        // (96 inbound max + 32 outbound = 128 total) to prevent eclipse attacks.
        if !peers.allow_inbound(128, 32) {
            println!(
                "[P2P Security] Inbound slot limit reached (outbound reserved), rejecting {}",
                remote_addr
            );
            drop(socket);
            continue;
        }

        println!(
            "New peer connected: {} (total: {})",
            remote_addr,
            current_connections + 1
        );

        let state_peer = state.clone();
        let peers_peer = peers.clone();
        let blacklist_peer = blacklist.clone();
        let msg_rate_peer = msg_rate_limiter.clone();

        tokio::spawn(async move {
            if let Err(e) = handle_connection(
                socket,
                remote_addr,
                state_peer,
                peers_peer,
                blacklist_peer,
                msg_rate_peer,
                peers::PeerDirection::Inbound,
            )
            .await
            {
                println!("Peer {} disconnected: {}", remote_addr, e);
            }
        });
    }
}

/// RAII guard: automatically cleans up peer state when connection ends,
/// regardless of whether it ends normally or via early return/bail.
/// Fixes P2P-BUG-01: `peers_connected` was only decremented at the normal
/// loop-exit path, causing the counter to leak on every early return.
struct ConnectionGuard {
    peers: Arc<PeerManager>,
    state: State,
    addr: SocketAddr,
}

impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        self.peers.remove_peer(&self.addr);
        self.state
            .metrics
            .peers_connected
            .fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
        self.state.metrics.peers_total.store(
            self.peers.get_peers().len(),
            std::sync::atomic::Ordering::Relaxed,
        );
    }
}

pub async fn handle_connection(
    socket: TcpStream,
    addr: SocketAddr,
    state: State,
    peers: Arc<PeerManager>,
    blacklist: Arc<Blacklist>,
    msg_rate_limiter: Arc<MessageRateLimiter>,
    direction: peers::PeerDirection,
) -> Result<()> {
    let scalar_addr = addr;

    // Split socket for full duplex (Read/Write independently)
    // Use into_split for owned halves suitable for separate tasks
    let (reader, mut writer) = socket.into_split();

    // Create channel for sending messages to this peer (from broadcast or logic)
    let (tx, mut rx) = mpsc::channel::<Message>(100);
    // P1-07: Register with direction tracking for inbound/outbound slot separation
    peers.register_connection_with_direction(addr, tx.clone(), direction);
    state
        .metrics
        .peers_connected
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    // P2P-BUG-01 fix: RAII guard ensures cleanup on every return path
    let _conn_guard = ConnectionGuard {
        peers: peers.clone(),
        state: state.clone(),
        addr: scalar_addr,
    };

    // Spawn Writer Task
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let json = match serde_json::to_string(&msg) {
                Ok(j) => j,
                Err(_) => continue,
            };
            // Add newline
            if writer.write_all((json + "\n").as_bytes()).await.is_err() {
                break;
            }
        }
    });

    let mut buf_reader = BufReader::new(reader);
    let mut line = String::new();
    let mut misbehavior_count = 0;
    const MAX_MISBEHAVIOR: u32 = 5;

    // Handshake
    let my_height = state.height.load(std::sync::atomic::Ordering::Relaxed);
    let net = crate::network::get_network();
    let handshake = Message::Handshake {
        version: 1,
        agent: "ZionCore/0.2.0".to_string(),
        height: my_height,
        network: net.magic().to_string(),
        nonce: node_nonce(),
    };

    // Send Handshake immediately via channel
    if tx.send(handshake).await.is_err() {
        return Err(anyhow::anyhow!("Failed to send handshake"));
    }

    loop {
        line.clear();
        let bytes_read = buf_reader.read_line(&mut line).await?;
        if bytes_read == 0 {
            break;
        } // EOF

        // Security: Check line length (prevent memory exhaustion)
        // During IBD, allow larger messages (blocks can be big)
        let max_size = if get_sync_status().is_ibd() {
            sync::IBD_MAX_MESSAGE_SIZE
        } else {
            1_000_000
        };
        if line.len() > max_size {
            println!(
                "[P2P Security] Oversized message from {}: {} bytes",
                scalar_addr,
                line.len()
            );
            misbehavior_count += 1;
            if misbehavior_count >= MAX_MISBEHAVIOR {
                blacklist.ban_temporary(scalar_addr.ip(), 600); // 10 min
                return Err(anyhow::anyhow!("Banned for misbehavior"));
            }
            continue;
        }

        let msg: Message = match serde_json::from_str(&line) {
            Ok(m) => m,
            Err(e) => {
                println!("Invalid message from {}: {}", scalar_addr, e);
                misbehavior_count += 1;
                if misbehavior_count >= MAX_MISBEHAVIOR {
                    blacklist.ban_temporary(scalar_addr.ip(), 300); // 5 min
                    return Err(anyhow::anyhow!("Banned for repeated invalid messages"));
                }
                continue;
            }
        };

        state
            .metrics
            .messages_received
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        // Sprint 1.7: Per-peer message rate limiting
        // During IBD, peers legitimately exchange hundreds of block messages per minute.
        // Skip rate limiting entirely during IBD to prevent false-positive bans on
        // honest peers that are serving us the chain.
        if !get_sync_status().is_ibd() {
            if let Err(score) = msg_rate_limiter.allow_message(scalar_addr.ip()) {
                if msg_rate_limiter.should_ban(&scalar_addr.ip()) {
                    let ban_secs = msg_rate_limiter.ban_duration_secs(&scalar_addr.ip());
                    println!(
                        "[P2P Security] Message flood from {} (score={}), banning for {}s",
                        scalar_addr, score, ban_secs
                    );
                    blacklist.ban_temporary(scalar_addr.ip(), ban_secs);
                    return Err(anyhow::anyhow!("Banned for message flooding"));
                }
                // Below ban threshold — just skip this message
                continue;
            }
        }

        // Update last seen on any message
        peers.update_last_seen(&scalar_addr);

        match msg {
            Message::Handshake {
                version,
                agent,
                height,
                network,
                nonce,
            } => {
                // P1-11: Self-connection detection — if peer's nonce matches ours, we're
                // connecting to ourselves. Drop immediately.
                if nonce != 0 && nonce == node_nonce() {
                    println!(
                        "[P2P] Self-connection detected (nonce match) from {} — disconnecting",
                        scalar_addr
                    );
                    return Err(anyhow::anyhow!(
                        "Self-connection detected (same node nonce)"
                    ));
                }

                // Validate network magic — reject cross-network peers
                // P1-09: Also reject empty network magic (prevents eclipse via omission)
                let my_net = crate::network::get_network();
                if network.is_empty() {
                    println!(
                        "[P2P] Rejecting peer {} — empty network magic (pre-v2.9.5 node?)",
                        scalar_addr
                    );
                    return Err(anyhow::anyhow!("Empty network magic — handshake rejected"));
                }
                if network != my_net.magic() {
                    println!(
                        "[P2P] Rejecting peer {} — network mismatch: {} vs {}",
                        scalar_addr,
                        network,
                        my_net.magic()
                    );
                    return Err(anyhow::anyhow!(
                        "Network mismatch: peer={} local={}",
                        network,
                        my_net.magic()
                    ));
                }
                println!(
                    "Peer {} Handshake: {} v{} height={} net={}",
                    scalar_addr, agent, version, height, &network
                );
                peers.add_peer(
                    scalar_addr,
                    PeerInfo {
                        addr: scalar_addr,
                        height,
                        sub_version: agent,
                        last_seen: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs(),
                        failed_attempts: 0,
                    },
                );
                state.metrics.peers_total.store(
                    peers.get_peers().len(),
                    std::sync::atomic::Ordering::Relaxed,
                );

                // Send HandshakeAck back
                let my_h = state.height.load(std::sync::atomic::Ordering::Relaxed);
                let _ = tx
                    .send(Message::HandshakeAck {
                        version: 1,
                        height: my_h,
                        nonce: node_nonce(),
                    })
                    .await;

                // If peer is ahead, decide: IBD or normal sync
                if height > my_h {
                    let sync_status = get_sync_status();
                    if sync_status.should_enter_ibd(my_h, height) {
                        // Enter IBD mode — large batch sync
                        sync_status.enter_ibd(height, &scalar_addr.to_string());
                        println!(
                            "📥 IBD: requesting blocks {}-{} from {}",
                            my_h + 1,
                            my_h + sync::IBD_BATCH_SIZE as u64,
                            scalar_addr
                        );
                        let _ = tx
                            .send(Message::GetBlocksIBD {
                                from_height: my_h + 1,
                                limit: sync::IBD_BATCH_SIZE,
                            })
                            .await;
                    } else if !sync_status.is_ibd() {
                        // Normal sync — small batch (but NOT during IBD)
                        println!("Sync: Requesting blocks from {}", scalar_addr);
                        let _ = tx
                            .send(Message::GetBlocks {
                                from_height: my_h + 1,
                                limit: 10,
                            })
                            .await;
                    } else {
                        println!(
                            "[P2P] Skipping sync from {} — IBD already in progress",
                            scalar_addr
                        );
                    }
                }
            }

            Message::HandshakeAck {
                version: _,
                height,
                nonce,
            } => {
                // P1-11: Self-connection detection on HandshakeAck too
                if nonce != 0 && nonce == node_nonce() {
                    println!("[P2P] Self-connection detected (HandshakeAck nonce) from {} — disconnecting", scalar_addr);
                    return Err(anyhow::anyhow!(
                        "Self-connection detected (same node nonce)"
                    ));
                }
                // Peer confirmed handshake — update their height
                peers.update_peer_height(&scalar_addr, height);
                println!("Peer {} HandshakeAck height={}", scalar_addr, height);
            }

            Message::NewBlock { height, hash: _ } => {
                // During IBD, skip gossip blocks (we'll get them in batch)
                if get_sync_status().is_ibd() {
                    continue;
                }
                // If we don't have this block, request it
                let my_h = state.height.load(std::sync::atomic::Ordering::Relaxed);
                if height > my_h {
                    // println!("Gossip: New block {} from {}. Requesting.", height, scalar_addr);
                    let _ = tx
                        .send(Message::GetBlocks {
                            from_height: my_h + 1,
                            limit: 1,
                        })
                        .await;
                }
            }

            Message::GetTip => {
                let (h, hash) = state.storage.get_tip()?;
                let _ = tx.send(Message::Tip { height: h, hash }).await;
            }

            Message::Tip { height, hash: _ } => {
                peers.update_peer_height(&scalar_addr, height);
                let my_h = state.height.load(std::sync::atomic::Ordering::Relaxed);
                if height > my_h {
                    let sync_status = get_sync_status();
                    if sync_status.should_enter_ibd(my_h, height) {
                        sync_status.enter_ibd(height, &scalar_addr.to_string());
                        let _ = tx
                            .send(Message::GetBlocksIBD {
                                from_height: my_h + 1,
                                limit: sync::IBD_BATCH_SIZE,
                            })
                            .await;
                    } else if !sync_status.is_ibd() {
                        let _ = tx
                            .send(Message::GetBlocks {
                                from_height: my_h + 1,
                                limit: 10,
                            })
                            .await;
                    }
                }
            }

            Message::GetBlocks { from_height, limit } => {
                let mut blocks = Vec::new();
                let safe_limit = limit.min(50);
                for h in from_height..(from_height + safe_limit as u64) {
                    if let Ok(Some(b)) = state.storage.get_block_by_height(h) {
                        blocks.push(b);
                    } else {
                        break;
                    }
                }
                let _ = tx.send(Message::Blocks { blocks }).await;
            }

            Message::GetBlocksIBD { from_height, limit } => {
                // IBD handler — serve up to 500 blocks per request
                let mut blocks = Vec::new();
                let safe_limit = limit.min(500);
                let my_h = state.height.load(std::sync::atomic::Ordering::Relaxed);
                for h in from_height..(from_height + safe_limit as u64) {
                    if h > my_h {
                        break;
                    }
                    if let Ok(Some(b)) = state.storage.get_block_by_height(h) {
                        blocks.push(b);
                    } else {
                        break;
                    }
                }
                let remaining = my_h.saturating_sub(from_height + blocks.len() as u64);
                let count = blocks.len();
                let _ = tx.send(Message::BlocksIBD { blocks, remaining }).await;
                if count > 0 {
                    println!(
                        "📤 IBD: Served {} blocks (from={}, remaining={})",
                        count, from_height, remaining
                    );
                }
            }

            Message::Blocks { blocks } => {
                // Skip normal block sync during IBD — let BlocksIBD handler manage it
                let sync_status = get_sync_status();
                if sync_status.is_ibd() {
                    println!(
                        "[P2P] Ignoring {} normal blocks from {} during IBD",
                        blocks.len(),
                        scalar_addr
                    );
                    continue;
                }

                // Skip if a reorg is already in progress
                if state.reorging.load(std::sync::atomic::Ordering::Relaxed) {
                    println!(
                        "[P2P] Ignoring {} blocks from {} — reorg in progress",
                        blocks.len(),
                        scalar_addr
                    );
                    continue;
                }

                println!("Received {} blocks from {}", blocks.len(), scalar_addr);

                // Security: Limit block batch size
                if blocks.len() > 100 {
                    println!(
                        "[P2P Security] Oversized block batch from {}: {}",
                        scalar_addr,
                        blocks.len()
                    );
                    blacklist.ban_temporary(scalar_addr.ip(), 600); // 10 min
                    return Err(anyhow::anyhow!("Banned for oversized batch"));
                }

                let mut fork_detected = false;
                for b in &blocks {
                    if let Err(e) = state.process_block(b.clone()) {
                        if e.contains("Invalid prev_hash") || e.contains("Previous block") {
                            // Fork detected — don't ban, attempt reorg
                            fork_detected = true;
                            println!(
                                "🔀 Fork detected from {} at height {} — attempting reorg",
                                scalar_addr,
                                b.height()
                            );
                            break;
                        }
                        println!("Sync Error from {}: {}", scalar_addr, e);
                        misbehavior_count += 1;

                        // Ban if repeatedly sending invalid blocks
                        if misbehavior_count >= MAX_MISBEHAVIOR {
                            blacklist.ban_temporary(scalar_addr.ip(), 900); // 15 min
                            return Err(anyhow::anyhow!("Banned for invalid blocks"));
                        }
                        break;
                    }
                }

                // Fork resolution: request the peer's full fork chain
                if fork_detected {
                    // Set reorging flag to prevent duplicate fork requests from other peers
                    if state
                        .reorging
                        .compare_exchange(
                            false,
                            true,
                            std::sync::atomic::Ordering::SeqCst,
                            std::sync::atomic::Ordering::SeqCst,
                        )
                        .is_err()
                    {
                        println!("[P2P] Skipping fork request — reorg already in progress");
                        continue;
                    }

                    use crate::blockchain::reorg;

                    // Find fork point by checking incoming blocks against our chain
                    match reorg::find_fork_point(&state.storage, &blocks) {
                        Ok(fork_point) => {
                            let my_height = state.height.load(std::sync::atomic::Ordering::Relaxed);
                            let peer_tip_height = blocks.last().map(|b| b.height()).unwrap_or(0);

                            println!(
                                "🔀 Fork point at height {}, our tip={}, peer tip={}",
                                fork_point, my_height, peer_tip_height
                            );

                            // Request fork chain from fork_point (inclusive) so that
                            // the BlocksIBD handler can re-verify the fork point using
                            // find_fork_point() on the incoming blocks.
                            let request_from = fork_point;
                            let blocks_needed = peer_tip_height.saturating_sub(fork_point) + 1;
                            println!(
                                "🔀 Requesting full fork chain: {} blocks from height {}",
                                blocks_needed, request_from
                            );

                            let _ = tx
                                .send(Message::GetBlocksIBD {
                                    from_height: request_from,
                                    limit: 500u32.min(blocks_needed as u32 + 10),
                                })
                                .await;
                        }
                        Err(e) => {
                            println!("🔀 Could not find fork point: {}", e);
                            state
                                .reorging
                                .store(false, std::sync::atomic::Ordering::Relaxed);
                            misbehavior_count += 1;
                        }
                    }
                }
            }

            Message::BlocksIBD { blocks, remaining } => {
                // IBD block batch received
                let batch_len = blocks.len();
                if batch_len == 0 {
                    // No more blocks — IBD complete
                    let sync_status = get_sync_status();
                    if sync_status.is_ibd() {
                        sync_status.exit_ibd();
                    }
                    // Clear reorging flag if set
                    state
                        .reorging
                        .store(false, std::sync::atomic::Ordering::Relaxed);
                } else {
                    // Security: IBD batches can be large but not unlimited
                    if batch_len > 600 {
                        println!(
                            "[P2P Security] IBD batch too large from {}: {}",
                            scalar_addr, batch_len
                        );
                        blacklist.ban_temporary(scalar_addr.ip(), 600);
                        state
                            .reorging
                            .store(false, std::sync::atomic::Ordering::Relaxed);
                        return Err(anyhow::anyhow!("Banned for oversized IBD batch"));
                    }

                    let mut processed = 0u64;
                    let mut last_height = 0u64;

                    let my_h = state.height.load(std::sync::atomic::Ordering::Relaxed);

                    // Check if this batch is a fork chain (contains blocks at heights <= our tip
                    // with different hashes). This happens when fork handler requests
                    // the full competing chain via GetBlocksIBD.
                    let _first_block_height = blocks.first().map(|b| b.height()).unwrap_or(0);

                    let is_fork_chain = {
                        // Check if ANY block in the batch (at a height we already have)
                        // differs from our stored block at the same height.
                        // The first block may be the fork_point itself (identical to ours),
                        // but subsequent blocks will diverge.
                        let mut found_fork = false;
                        for b in &blocks {
                            if b.height() > my_h {
                                break; // Above our tip — not a fork indicator
                            }
                            if let Ok(Some(local)) = state.storage.get_block_by_height(b.height()) {
                                let local_hash = local.calculate_hash();
                                let incoming_hash = b.calculate_hash();
                                if local_hash != incoming_hash {
                                    found_fork = true;
                                    break;
                                }
                            }
                        }
                        found_fork
                    };

                    if is_fork_chain {
                        // This is a fork chain — perform reorg with exclusive lock
                        use crate::blockchain::reorg;

                        // Acquire reorg lock to prevent concurrent reorgs
                        let _reorg_guard = state.reorg_lock.lock().await;

                        // Re-read our height after acquiring lock (might have changed)
                        let my_h_locked = state.height.load(std::sync::atomic::Ordering::Relaxed);

                        // Use find_fork_point on the incoming IBD blocks to find the
                        // common ancestor with our current chain. This is more reliable
                        // than deriving fork_point from block heights, because our chain
                        // may have changed between the Blocks and BlocksIBD messages.
                        match reorg::find_fork_point(&state.storage, &blocks) {
                            Ok(fork_point) => {
                                let mut fork_blocks: Vec<_> = blocks
                                    .iter()
                                    .filter(|b| b.height() > fork_point)
                                    .cloned()
                                    .collect();
                                fork_blocks.sort_by_key(|b| b.height());

                                // Validate contiguity: fork_blocks must start at
                                // fork_point+1 with no gaps.  If the batch is
                                // incomplete (peer didn't send the full range),
                                // skip the reorg to avoid "Previous block not found".
                                let contiguous = if let Some(first) = fork_blocks.first() {
                                    first.height() == fork_point + 1
                                        && fork_blocks
                                            .windows(2)
                                            .all(|w| w[1].height() == w[0].height() + 1)
                                } else {
                                    false
                                };

                                if fork_blocks.is_empty() || !contiguous {
                                    if !fork_blocks.is_empty() {
                                        println!("🔀 IBD fork: non-contiguous blocks (fork_point={}, first_block={}), re-requesting",
                                            fork_point, fork_blocks.first().map(|b| b.height()).unwrap_or(0));
                                        // Re-request from fork_point to get full range
                                        let peer_tip =
                                            fork_blocks.last().map(|b| b.height()).unwrap_or(0);
                                        let _ = tx
                                            .send(Message::GetBlocksIBD {
                                                from_height: fork_point,
                                                limit: 500u32
                                                    .min((peer_tip - fork_point + 10) as u32),
                                            })
                                            .await;
                                    } else {
                                        println!(
                                            "🔀 IBD fork: no blocks above fork_point {}, skipping",
                                            fork_point
                                        );
                                    }
                                    state
                                        .reorging
                                        .store(false, std::sync::atomic::Ordering::Relaxed);
                                } else {
                                    println!("🔀 IBD fork chain: fork_point={}, applying {} blocks ({}..{}), our tip={}",
                                        fork_point, fork_blocks.len(),
                                        fork_blocks.first().map(|b| b.height()).unwrap_or(0),
                                        fork_blocks.last().map(|b| b.height()).unwrap_or(0),
                                        my_h_locked);

                                    match reorg::is_stronger_chain(
                                        &state.storage,
                                        fork_point,
                                        &fork_blocks,
                                    ) {
                                        Ok(true) => {
                                            // force_allow=true: IBD handler — is_ibd() may already
                                            // be false by now, but we know this is an IBD fork chain.
                                            match state.reorg_to_fork(fork_point, fork_blocks, true)
                                            {
                                                Ok((new_h, new_hash)) => {
                                                    println!("✅ IBD Reorg SUCCESS: new tip height={} hash={}",
                                                new_h, &new_hash[..16.min(new_hash.len())]);
                                                    processed = (new_h - fork_point) as u64;
                                                    last_height = new_h;
                                                    // Broadcast new tip
                                                    let _ = state
                                                        .block_broadcaster
                                                        .send((new_h, new_hash));
                                                }
                                                Err(e) => {
                                                    println!("❌ IBD Reorg FAILED: {}", e);
                                                }
                                            }
                                        }
                                        Ok(false) => {
                                            println!("🔀 IBD: our chain is stronger, keeping it");
                                        }
                                        Err(e) => {
                                            println!("🔀 IBD: chain comparison error: {}", e);
                                        }
                                    }
                                    // Clear reorging flag after completion
                                    state
                                        .reorging
                                        .store(false, std::sync::atomic::Ordering::Relaxed);
                                }
                            }
                            Err(e) => {
                                println!("🔀 IBD: could not find fork point: {}", e);
                                state
                                    .reorging
                                    .store(false, std::sync::atomic::Ordering::Relaxed);
                            }
                        }
                        // _reorg_guard drops here, releasing the lock
                    } else {
                        // Normal IBD: skip already-have blocks, process new ones
                        for b in &blocks {
                            last_height = b.height();

                            // Skip blocks we already have (from overlapping batches)
                            if b.height() <= my_h {
                                continue;
                            }

                            match state.process_block(b.clone()) {
                                Ok(_) => {
                                    processed += 1;
                                    let sync_status = get_sync_status();
                                    sync_status.update_progress(last_height);
                                }
                                Err(e) => {
                                    // During IBD, log but try to continue (might be duplicate)
                                    if e.contains("already exists") || e.contains("not found") {
                                        continue;
                                    }
                                    if e.contains("Invalid prev_hash")
                                        || e.contains("Previous block")
                                    {
                                        println!("⚠️ IBD: block {} has invalid prev_hash — skipping (our tip={})",
                                            last_height, state.height.load(std::sync::atomic::Ordering::Relaxed));
                                        continue;
                                    }
                                    println!("⚠️ IBD block {} error: {}", last_height, e);
                                    misbehavior_count += 1;
                                    if misbehavior_count >= MAX_MISBEHAVIOR {
                                        blacklist.ban_temporary(scalar_addr.ip(), 900);
                                        return Err(anyhow::anyhow!(
                                            "Banned for invalid IBD blocks"
                                        ));
                                    }
                                    break;
                                }
                            }
                        }
                    } // end else (normal IBD)

                    // Normal IBD progress
                    let sync_status = get_sync_status();
                    println!("{}", sync_status.progress_report());

                    // Pipeline: immediately request next batch if more blocks remain
                    if remaining > 0 && processed > 0 {
                        let next_from = last_height + 1;
                        let _ = tx
                            .send(Message::GetBlocksIBD {
                                from_height: next_from,
                                limit: sync::IBD_BATCH_SIZE,
                            })
                            .await;
                    } else if remaining == 0 {
                        // IBD complete
                        sync_status.exit_ibd();
                        state
                            .reorging
                            .store(false, std::sync::atomic::Ordering::Relaxed);
                    } else if processed == 0 && remaining > 0 {
                        // No blocks processed but more remain — request from our tip
                        let current = state.height.load(std::sync::atomic::Ordering::Relaxed);
                        println!(
                            "⚠️ IBD: no blocks processed from batch, re-requesting from height {}",
                            current + 1
                        );
                        let _ = tx
                            .send(Message::GetBlocksIBD {
                                from_height: current + 1,
                                limit: sync::IBD_BATCH_SIZE,
                            })
                            .await;
                    }
                }
            }

            // --- Peer Exchange (Tree-nodes Discovery) ---
            Message::GetPeers => {
                // Respond with our list of active peer addresses
                let peer_list = peers.get_active_addrs();
                let _ = tx.send(Message::Peers { peers: peer_list }).await;
            }

            Message::Peers { peers: new_peers } => {
                // Merge newly learned peers into our known pool
                // Use a per-connection seen-set stored locally in handle_connection.
                // We pass a thread-local set here; for production use a proper
                // per-peer dedup set (handled in discovery module).
                let mut seen: HashSet<String> = HashSet::new();
                discovery::handle_peers_response(&peers, new_peers, &mut seen);
            }

            // --- Keepalive ---
            Message::Ping { nonce } => {
                let _ = tx.send(Message::Pong { nonce }).await;
            }

            Message::Pong { nonce: _ } => {
                // Update last_seen — handled generically above
            }

            // --- Transaction Logic ---
            Message::NewTx { id } => {
                if state.mempool.get_transaction(&id).is_none() {
                    // We don't have it, request it
                    let _ = tx.send(Message::GetTx { id }).await;
                }
            }

            Message::GetTx { id } => {
                // Check Mempool
                if let Some(trx) = state.mempool.get_transaction(&id) {
                    let _ = tx.send(Message::Tx { transaction: trx }).await;
                }
            }

            Message::Tx { transaction } => {
                // Validate and add to mempool
                if let Err(e) = state.process_transaction(transaction) {
                    println!("Tx Reject from {}: {}", scalar_addr, e);
                }
            }
        }
    }

    // Cleanup is handled by `_conn_guard` (ConnectionGuard Drop impl) — no
    // need to repeat it here. The guard fires on this Ok(()) return too.
    Ok(())
}

pub fn broadcast(_msg: serde_json::Value) {
    if let Some(tx) = GLOBAL_BROADCAST_TX.get() {
        if let Ok(msg) = serde_json::from_value::<Message>(_msg) {
            let _ = tx.send(msg);
        }
    }
}
