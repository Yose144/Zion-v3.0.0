//! Minimal P2P gossip + IBD module for the ZION L1 node.
//!
//! Alpha scope: listen for inbound connections, accept `Block` gossip, respond to
//! `GetStatus`/`GetBlocks` requests and peer discovery (`GetPeers`/`Peers`).

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::{sleep, timeout};
use tracing::{info, warn};

use crate::block::Block;
use crate::node::Node;
use crate::peer_manager::{PeerGuard, PeerManager, PeerSource};

/// Wire message types exchanged between Alpha nodes.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum Message {
    Block { block: Block },
    GetStatus,
    Status { height: u64, tip_hash: String },
    GetBlocks { start_height: u64, end_height: u64 },
    Blocks { blocks: Vec<Block> },
    GetPeers,
    Peers { peers: Vec<SocketAddr> },
}

/// P2P listener.
pub struct P2P {
    node: Arc<Node>,
    peers: Arc<PeerManager>,
}

impl P2P {
    pub fn new(node: Arc<Node>, peers: Arc<PeerManager>) -> Self {
        Self { node, peers }
    }

    /// Listen for inbound peers until shutdown is signalled.
    pub async fn listen(
        &self,
        addr: SocketAddr,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), crate::node::NodeError> {
        let listener = TcpListener::bind(addr).await?;
        self.peers.set_local_addr(addr).await;
        info!("P2P listening on {}", addr);

        loop {
            tokio::select! {
                _ = shutdown.changed() => break,
                accept = listener.accept() => {
                    let (socket, peer) = accept?;
                    let peers = Arc::clone(&self.peers);
                    let node = Arc::clone(&self.node);
                    tokio::spawn(async move {
                        if !peers.can_accept(peer).await {
                            warn!("P2P peer {} rejected", peer);
                            return;
                        }
                        if let Err(e) = handle_peer(socket, &peers, node).await {
                            warn!("P2P peer {} disconnected: {}", peer, e);
                        }
                    });
                }
            }
        }
        Ok(())
    }
}

async fn handle_peer(
    mut socket: TcpStream,
    peers: &PeerManager,
    node: Arc<Node>,
) -> Result<(), crate::node::NodeError> {
    let peer_addr = socket.peer_addr()?;
    let (reader, mut writer) = socket.split();
    let mut lines = BufReader::new(reader).lines();
    let mut guard: Option<PeerGuard> = None;
    let read_timeout = Duration::from_secs(60);
    let write_timeout = Duration::from_secs(30);

    loop {
        let line = match timeout(read_timeout, lines.next_line()).await {
            Ok(Ok(Some(line))) => line,
            Ok(Ok(None)) => break,
            Ok(Err(e)) => return Err(e.into()),
            Err(_) => {
                warn!("P2P peer {} read timeout, closing", peer_addr);
                break;
            }
        };

        let msg: Message = match serde_json::from_str(&line) {
            Ok(m) => m,
            Err(e) => {
                warn!("invalid P2P message from {}: {}", peer_addr, e);
                peers.record_bad(peer_addr, 1).await;
                continue;
            }
        };

        if guard.is_none() {
            guard = peers.acquire(peer_addr).await;
            if guard.is_none() {
                warn!("P2P peer {} rejected after first message", peer_addr);
                return Ok(());
            }
            peers.add_known(peer_addr, PeerSource::Inbound).await;
        }

        match msg {
            Message::Block { block } => {
                if let Err(e) = node.submit_block(block).await {
                    warn!("rejected gossiped block: {}", e);
                }
            }
            Message::GetStatus => {
                let status = node.status().await?;
                let reply = Message::Status {
                    height: status.height,
                    tip_hash: status.tip_hash.to_hex(),
                };
                if timeout(write_timeout, write_message(&mut writer, &reply))
                    .await
                    .is_err()
                {
                    warn!("P2P peer {} write timeout on Status", peer_addr);
                    break;
                }
            }
            Message::GetBlocks {
                start_height,
                end_height,
            } => {
                let blocks = node
                    .storage
                    .get_blocks_range(start_height, end_height)
                    .await?;
                let reply = Message::Blocks { blocks };
                if timeout(write_timeout, write_message(&mut writer, &reply))
                    .await
                    .is_err()
                {
                    warn!("P2P peer {} write timeout on Blocks", peer_addr);
                    break;
                }
            }
            Message::GetPeers => {
                let peers = peers.random_peers(8).await;
                let reply = Message::Peers { peers };
                if timeout(write_timeout, write_message(&mut writer, &reply))
                    .await
                    .is_err()
                {
                    warn!("P2P peer {} write timeout on Peers", peer_addr);
                    break;
                }
            }
            Message::Status { .. } | Message::Blocks { .. } | Message::Peers { .. } => {}
        }
    }
    if guard.is_some() {
        peers.record_good(peer_addr).await;
    }
    Ok(())
}

async fn write_message(
    writer: &mut tokio::net::tcp::WriteHalf<'_>,
    msg: &Message,
) -> Result<(), crate::node::NodeError> {
    let body = serde_json::to_string(msg)?;
    writer.write_all(body.as_bytes()).await?;
    writer.write_all(b"\n").await?;
    writer.flush().await?;
    Ok(())
}

/// Gossip a block to a remote peer (best-effort).
pub async fn gossip(addr: SocketAddr, block: &Block) -> Result<(), crate::node::NodeError> {
    let mut stream = TcpStream::connect(addr).await?;
    let (_reader, mut writer) = stream.split();
    let msg = Message::Block {
        block: block.clone(),
    };
    write_message(&mut writer, &msg).await?;
    let _ = writer.shutdown().await;
    Ok(())
}

/// Ask a peer for its current chain status.
pub async fn get_status(addr: SocketAddr) -> Result<(u64, String), crate::node::NodeError> {
    let mut stream = TcpStream::connect(addr).await?;
    let (reader, mut writer) = stream.split();
    write_message(&mut writer, &Message::GetStatus).await?;

    let mut lines = BufReader::new(reader).lines();
    if let Some(line) = lines.next_line().await? {
        if let Message::Status { height, tip_hash } = serde_json::from_str::<Message>(&line)? {
            // Graceful half-close so the peer's read loop ends immediately.
            let _ = writer.shutdown().await;
            return Ok((height, tip_hash));
        }
    }
    Err(crate::node::NodeError::Task(format!(
        "no status response from {}",
        addr
    )))
}

/// Ask a peer for a range of blocks.
pub async fn get_blocks(
    addr: SocketAddr,
    start_height: u64,
    end_height: u64,
) -> Result<Vec<Block>, crate::node::NodeError> {
    let mut stream = TcpStream::connect(addr).await?;
    let (reader, mut writer) = stream.split();
    let req = Message::GetBlocks {
        start_height,
        end_height,
    };
    write_message(&mut writer, &req).await?;

    let mut lines = BufReader::new(reader).lines();
    if let Some(line) = lines.next_line().await? {
        if let Message::Blocks { blocks } = serde_json::from_str::<Message>(&line)? {
            let _ = writer.shutdown().await;
            return Ok(blocks);
        }
    }
    Err(crate::node::NodeError::Task(format!(
        "no blocks response from {}",
        addr
    )))
}

/// Periodically sync missing blocks from a set of seed peers.
pub async fn sync_loop(
    node: Arc<Node>,
    manager: Arc<PeerManager>,
    peers: Vec<SocketAddr>,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) {
    let interval = Duration::from_secs(30);
    let mut first = true;

    loop {
        let sleep_fut = if first {
            first = false;
            sleep(Duration::from_secs(1))
        } else {
            sleep(interval)
        };

        tokio::select! {
            _ = shutdown.changed() => break,
            _ = sleep_fut => {
                for peer in &peers {
                    manager.add_known(*peer, PeerSource::Seed).await;
                    if let Err(e) = sync_peer(&node, &manager, *peer).await {
                        warn!("P2P sync from {} failed: {}", peer, e);
                        manager.record_bad(*peer, 1).await;
                    } else {
                        manager.record_good(*peer).await;
                    }
                }
            }
        }
    }
}

async fn sync_peer(
    node: &Node,
    manager: &PeerManager,
    peer: SocketAddr,
) -> Result<(), crate::node::NodeError> {
    manager.add_known(peer, PeerSource::Seed).await;
    let (peer_height, peer_tip_hash) = get_status(peer).await?;
    let our_height = node.storage.height().await?;

    // ── Genesis verification ─────────────────────────────────────────────
    // If our DB has a genesis block, compare its hash against the canonical
    // genesis.  A mismatch means the local DB is from an older chain and
    // cannot sync — operator must delete the DB and restart.
    if our_height > 0 {
        if let Ok(Some(our_genesis)) = node.storage.get_by_height(0).await {
            let our_genesis_hash = our_genesis.header.header_hash().to_hex();
            let canonical = crate::genesis::genesis_hash().to_hex();
            if our_genesis_hash != canonical {
                warn!(
                    "local genesis {} != canonical {}; local DB is stale — \
                     delete the DB file and restart to sync from peer {}",
                    our_genesis_hash, canonical, peer
                );
                return Err(crate::node::NodeError::Task(format!(
                    "stale local DB: genesis {} != canonical {}",
                    our_genesis_hash, canonical
                )));
            }
        }
    }

    // ── Tip comparison ───────────────────────────────────────────────────
    // If we have a tip, compare its hash with the peer's tip.  Matching tips
    // mean we are fully synced — no action needed.
    let mut our_height = our_height;
    if let Ok(Some((_our_tip_header, our_tip_hash))) = node.storage.tip().await {
        let our_tip_hex = our_tip_hash.to_hex();
        if our_tip_hex == peer_tip_hash {
            return Ok(()); // already on the same tip
        }

        // Tips differ: we may sit on a side fork the linear sync below can
        // never attach to (the first forked block fails the prev-hash check
        // forever).  Walk back to the common ancestor and roll the forked
        // suffix back, then resume normal sync on the peer's branch.
        match find_common_ancestor(node, peer, our_height).await {
            Ok(Some(fork_height)) => {
                let depth = our_height.saturating_sub(fork_height);
                if depth > MAX_REORG_DEPTH {
                    warn!(
                        "chain divergence: reorg depth {} exceeds max {}; \
                         local chain may be stale — consider deleting the DB to re-sync",
                        depth, MAX_REORG_DEPTH
                    );
                    return Ok(());
                }
                info!(
                    "reorg: our tip {} (h={}) != peer tip {} (h={}); \
                     rolling back {} block(s) to common ancestor h={}",
                    our_tip_hex, our_height, peer_tip_hash, peer_height, depth, fork_height
                );
                node.rollback_to_height(fork_height).await?;
                our_height = node.storage.height().await?;
            }
            Ok(None) => {
                warn!(
                    "chain divergence: no common ancestor within {} blocks; \
                     local chain may be stale — consider deleting the DB to re-sync",
                    MAX_REORG_DEPTH
                );
                return Ok(());
            }
            Err(e) => {
                warn!("common ancestor search failed: {e}");
                return Ok(());
            }
        }
    }

    if peer_height > our_height {
        info!(
            "syncing blocks {}..{} from {}",
            our_height + 1,
            peer_height,
            peer
        );
        let blocks = get_blocks(peer, our_height + 1, peer_height).await?;
        for block in blocks {
            if let Err(e) = node.submit_block(block).await {
                warn!("sync rejected block: {}", e);
                break;
            }
        }
    }
    Ok(())
}

/// Maximum blocks we are willing to roll back during a reorg. Anything
/// deeper indicates a genuinely stale or alternate-history DB — the
/// operator wipes and re-syncs instead.
const MAX_REORG_DEPTH: u64 = 64;

/// Walk our chain backwards alongside the peer's, returning the highest
/// height at which both nodes store the same block hash. `None` when no
/// common ancestor exists within `MAX_REORG_DEPTH` of our tip.
async fn find_common_ancestor(
    node: &Node,
    peer: SocketAddr,
    our_height: u64,
) -> Result<Option<u64>, crate::node::NodeError> {
    let mut h = our_height;
    let floor = our_height.saturating_sub(MAX_REORG_DEPTH);
    loop {
        let peer_blocks = get_blocks(peer, h, h).await?;
        let peer_hash = peer_blocks
            .first()
            .map(|b| b.header.header_hash().to_hex());
        let our_hash = match node.storage.get_by_height(h).await? {
            Some(b) => Some(b.header.header_hash().to_hex()),
            None => None,
        };
        match (our_hash, peer_hash) {
            (Some(a), Some(p)) if a == p => return Ok(Some(h)),
            _ => {
                if h <= floor || h == 0 {
                    return Ok(None);
                }
                h -= 1;
            }
        }
    }
}
