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
use tracing::{debug, info, warn};

use crate::block::Block;
use crate::node::Node;
use crate::node::NodeError;
use zion_l1_types::Hash;
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

        // A peer at or below our height can never offer a longer chain —
        // nothing to gain from walking back.  Without this guard a lagging
        // peer would make us discard our newer blocks: get_blocks beyond its
        // tip returns empty and the walk-back lands at the peer's height.
        if peer_height <= our_height {
            debug!(
                "peer {} tip differs but peer height {} <= our height {}; \
                 keeping local tip {} (h={})",
                peer, peer_height, our_height, our_tip_hex, our_height
            );
            return Ok(());
        }

        // The peer claims a longer chain on a different tip.  Walk back to
        // the common ancestor; depth 0 means we are simply behind — skip
        // straight to the linear sync below without touching our chain.
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
                if depth > 0 {
                    // Fetch and validate the peer's replacement branch BEFORE
                    // discarding any of our blocks.
                    let branch = get_blocks(
                        peer,
                        fork_height + 1,
                        peer_height.min(our_height + 1),
                    )
                    .await?;
                    let our_fork_block = node
                        .storage
                        .get_by_height(fork_height)
                        .await?
                        .ok_or_else(|| {
                            NodeError::Task(format!(
                                "missing local block at fork height {fork_height}"
                            ))
                        })?;
                    validate_peer_branch(
                        &our_fork_block.header.header_hash(),
                        fork_height,
                        our_height,
                        &branch,
                    )?;

                    info!(
                        "reorg: our tip {} (h={}) != peer tip {} (h={}); \
                         rolling back {} block(s) to common ancestor h={}",
                        our_tip_hex, our_height, peer_tip_hash, peer_height, depth,
                        fork_height
                    );

                    // Save our forked suffix so we can restore it if the
                    // peer's branch fails to submit mid-way.
                    let our_suffix = node
                        .storage
                        .get_blocks_range(fork_height + 1, our_height)
                        .await?;
                    node.rollback_to_height(fork_height).await?;
                    for block in &branch {
                        if let Err(e) = node.submit_block(block.clone()).await {
                            warn!(
                                "reorg branch rejected at h={} ({}); restoring local fork",
                                block.header.height, e
                            );
                            node.rollback_to_height(fork_height).await?;
                            for ours in &our_suffix {
                                node.submit_block(ours.clone()).await.map_err(|re| {
                                    NodeError::Task(format!(
                                        "reorg restore failed at h={}: {re} \
                                         (original error: {e})",
                                        ours.header.height
                                    ))
                                })?;
                            }
                            return Err(NodeError::Task(format!(
                                "reorg branch from {peer} failed at h={}: {e}",
                                block.header.height
                            )));
                        }
                    }
                    our_height = node.storage.height().await?;
                }
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

/// Validate a peer-supplied replacement branch before we roll back.
///
/// The branch must be non-empty, start at `fork_height + 1`, link to our
/// block at `fork_height`, be height- and hash-contiguous, and end strictly
/// above our current tip — otherwise the peer gains us nothing (or worse).
fn validate_peer_branch(
    our_fork_hash: &Hash,
    fork_height: u64,
    our_height: u64,
    branch: &[Block],
) -> Result<(), NodeError> {
    let first = branch
        .first()
        .ok_or_else(|| NodeError::Task("peer branch is empty".to_string()))?;
    if first.header.height != fork_height + 1 {
        return Err(NodeError::Task(format!(
            "peer branch starts at h={} expected h={}",
            first.header.height,
            fork_height + 1
        )));
    }
    if first.header.previous_hash != *our_fork_hash {
        return Err(NodeError::Task(
            "peer branch does not link to our common ancestor".to_string(),
        ));
    }
    for pair in branch.windows(2) {
        let (prev, next) = (&pair[0], &pair[1]);
        if next.header.height != prev.header.height + 1 {
            return Err(NodeError::Task(format!(
                "peer branch not height-contiguous at h={}",
                next.header.height
            )));
        }
        if next.header.previous_hash != prev.header.header_hash() {
            return Err(NodeError::Task(format!(
                "peer branch not hash-contiguous at h={}",
                next.header.height
            )));
        }
    }
    let last = branch.last().expect("non-empty");
    if last.header.height <= our_height {
        return Err(NodeError::Task(format!(
            "peer branch ends at h={} — not longer than our tip h={}",
            last.header.height, our_height
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::BlockHeader;
    use crate::genesis;
    use crate::node::NodeConfig;
    use zion_l1_types::Address;

    fn miner(tag: &str) -> Address {
        Address::new(zion_l1_types::ChainId::ZionL1, vec![], tag).unwrap()
    }

    async fn new_node() -> Node {
        Node::new(NodeConfig {
            db_path: ":memory:".into(),
            ..Default::default()
        })
        .await
        .unwrap()
    }

    /// Mine one real block (difficulty 1 => trivially satisfiable target)
    /// through the node's own template machinery so consensus checks pass.
    async fn mine_next(node: &Node, m: &Address) -> Block {
        let template = node.block_template(m.clone()).await.unwrap();
        let mut header: BlockHeader = serde_json::from_str(&template.header_json).unwrap();
        header.difficulty = 1;
        node.consensus
            .mine(&mut header, &[0xff; 32], 0, 1_000)
            .expect("difficulty-1 block is mineable");
        let block = Block::new(header, template.transactions);
        node.submit_block(block.clone()).await.unwrap();
        block
    }

    /// A stub peer speaking the newline-JSON protocol, serving a fixed
    /// status and a fixed set of blocks.
    async fn spawn_stub_peer(height: u64, tip_hash: Hash, blocks: Vec<Block>) -> SocketAddr {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                let blocks = blocks.clone();
                tokio::spawn(async move {
                    let (reader, mut writer) = stream.split();
                    let mut lines = BufReader::new(reader).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let Ok(msg) = serde_json::from_str::<Message>(&line) else {
                            continue;
                        };
                        let reply = match msg {
                            Message::GetStatus => Some(Message::Status {
                                height,
                                tip_hash: tip_hash.to_hex(),
                            }),
                            Message::GetBlocks {
                                start_height,
                                end_height,
                            } => Some(Message::Blocks {
                                blocks: blocks
                                    .iter()
                                    .filter(|b| {
                                        b.header.height >= start_height
                                            && b.header.height <= end_height
                                    })
                                    .cloned()
                                    .collect(),
                            }),
                            _ => None,
                        };
                        if let Some(reply) = reply {
                            if write_message(&mut writer, &reply).await.is_err() {
                                return;
                            }
                        }
                    }
                });
            }
        });
        addr
    }

    fn test_manager() -> PeerManager {
        PeerManager::new(4, 3, Duration::from_secs(60))
    }

    async fn our_tip_hash(node: &Node) -> Hash {
        node.storage.tip().await.unwrap().unwrap().1
    }

    /// A hand-crafted block whose header links correctly but whose body
    /// fails consensus validation (merkle/coinbase) on submit.
    fn bogus_block(previous_hash: Hash, height: u64, timestamp: u64) -> Block {
        Block::new(
            BlockHeader {
                previous_hash,
                merkle_root: Hash::new([0xee; 32]),
                height,
                timestamp,
                nonce: 0,
                difficulty: 1,
            },
            vec![],
        )
    }

    // ── validate_peer_branch unit tests ─────────────────────────────────

    #[test]
    fn validate_peer_branch_rejects_empty() {
        assert!(validate_peer_branch(&Hash::default(), 0, 2, &[]).is_err());
    }

    #[test]
    fn validate_peer_branch_accepts_longer_linked_chain() {
        let fork = Hash::new([1; 32]);
        let b3 = bogus_block(fork, 3, 100);
        let b4 = bogus_block(b3.header.header_hash(), 4, 160);
        assert!(validate_peer_branch(&fork, 2, 3, &[b3, b4]).is_ok());
    }

    #[test]
    fn validate_peer_branch_rejects_wrong_start_height() {
        let fork = Hash::new([1; 32]);
        let b4 = bogus_block(fork, 4, 100);
        assert!(validate_peer_branch(&fork, 2, 3, &[b4]).is_err());
    }

    #[test]
    fn validate_peer_branch_rejects_bad_link() {
        let fork = Hash::new([1; 32]);
        let b3 = bogus_block(Hash::new([9; 32]), 3, 100); // prev != fork hash
        let b4 = bogus_block(b3.header.header_hash(), 4, 160);
        assert!(validate_peer_branch(&fork, 2, 3, &[b3, b4]).is_err());
    }

    #[test]
    fn validate_peer_branch_rejects_non_contiguous() {
        let fork = Hash::new([1; 32]);
        let b3 = bogus_block(fork, 3, 100);
        let b5 = bogus_block(b3.header.header_hash(), 5, 160); // skips h=4
        assert!(validate_peer_branch(&fork, 2, 3, &[b3, b5]).is_err());
    }

    #[test]
    fn validate_peer_branch_rejects_broken_hash_chain() {
        let fork = Hash::new([1; 32]);
        let b3 = bogus_block(fork, 3, 100);
        let b4 = bogus_block(Hash::new([7; 32]), 4, 160); // prev != hash(b3)
        assert!(validate_peer_branch(&fork, 2, 3, &[b3, b4]).is_err());
    }

    #[test]
    fn validate_peer_branch_rejects_not_longer() {
        let fork = Hash::new([1; 32]);
        let b3 = bogus_block(fork, 3, 100); // ends at our_height
        assert!(validate_peer_branch(&fork, 2, 3, &[b3]).is_err());
    }

    // ── sync_peer fork-choice tests ─────────────────────────────────────

    #[tokio::test]
    async fn sync_peer_lagging_peer_keeps_our_chain() {
        let node = new_node().await;
        let m = miner("zion1ours");
        let _b1 = mine_next(&node, &m).await;
        let b2 = mine_next(&node, &m).await;
        assert_eq!(node.storage.height().await.unwrap(), 2);

        // Lagging peer at height 1 with a different tip: must not roll back.
        let peer = spawn_stub_peer(1, Hash::new([7; 32]), vec![]).await;
        let manager = test_manager();
        sync_peer(&node, &manager, peer).await.unwrap();

        assert_eq!(node.storage.height().await.unwrap(), 2);
        assert_eq!(our_tip_hash(&node).await, b2.header.header_hash());
    }

    #[tokio::test]
    async fn sync_peer_equal_height_different_tip_keeps_our_chain() {
        let node = new_node().await;
        let m = miner("zion1ours");
        let _b1 = mine_next(&node, &m).await;
        let b2 = mine_next(&node, &m).await;

        // Same height, different tip hash — still nothing to gain.
        let peer = spawn_stub_peer(2, Hash::new([8; 32]), vec![]).await;
        let manager = test_manager();
        sync_peer(&node, &manager, peer).await.unwrap();

        assert_eq!(node.storage.height().await.unwrap(), 2);
        assert_eq!(our_tip_hash(&node).await, b2.header.header_hash());
    }

    #[tokio::test]
    async fn sync_peer_adopts_longer_valid_fork() {
        // Our chain: genesis + A1 + A2.
        let ours = new_node().await;
        let m = miner("zion1ours");
        let _a1 = mine_next(&ours, &m).await;
        let _a2 = mine_next(&ours, &m).await;
        assert_eq!(ours.storage.height().await.unwrap(), 2);

        // Peer chain: genesis + B1..B4 (different coinbase => diverges at h1).
        let theirs = new_node().await;
        let pm = miner("zion1theirs");
        let mut peer_blocks = vec![genesis::genesis_block()];
        for _ in 0..4 {
            peer_blocks.push(mine_next(&theirs, &pm).await);
        }
        assert_ne!(
            peer_blocks[1].header.header_hash(),
            ours.storage
                .get_by_height(1)
                .await
                .unwrap()
                .unwrap()
                .header
                .header_hash()
        );

        let peer = spawn_stub_peer(4, peer_blocks[4].header.header_hash(), peer_blocks.clone())
            .await;
        let manager = test_manager();
        sync_peer(&ours, &manager, peer).await.unwrap();

        assert_eq!(ours.storage.height().await.unwrap(), 4);
        assert_eq!(
            our_tip_hash(&ours).await,
            peer_blocks[4].header.header_hash()
        );
    }

    #[tokio::test]
    async fn sync_peer_restores_chain_when_branch_fails_midway() {
        // Our chain: genesis + A1 + A2.
        let ours = new_node().await;
        let m = miner("zion1ours");
        let _a1 = mine_next(&ours, &m).await;
        let a2 = mine_next(&ours, &m).await;

        // Peer serves a branch that LINKS correctly (B1 is a real valid
        // block) but whose second block fails consensus on submit.
        let theirs = new_node().await;
        let pm = miner("zion1theirs");
        let b1 = mine_next(&theirs, &pm).await;
        let c2 = bogus_block(b1.header.header_hash(), 2, b1.header.timestamp + 60);
        let c3 = bogus_block(c2.header.header_hash(), 3, c2.header.timestamp + 60);

        let peer_blocks = vec![genesis::genesis_block(), b1, c2, c3];
        let peer = spawn_stub_peer(4, peer_blocks[3].header.header_hash(), peer_blocks).await;
        let manager = test_manager();

        // The mid-branch submit failure must surface as an error AND leave
        // our original fork restored.
        assert!(sync_peer(&ours, &manager, peer).await.is_err());
        assert_eq!(ours.storage.height().await.unwrap(), 2);
        assert_eq!(our_tip_hash(&ours).await, a2.header.header_hash());
    }

    #[tokio::test]
    async fn sync_peer_rejects_non_linking_branch() {
        let ours = new_node().await;
        let m = miner("zion1ours");
        let _a1 = mine_next(&ours, &m).await;
        let a2 = mine_next(&ours, &m).await;

        // Peer claims a longer chain but its branch does not link to our
        // common ancestor (first block's prev_hash is garbage).
        let x1 = bogus_block(Hash::new([0xab; 32]), 1, 1000);
        let x2 = bogus_block(x1.header.header_hash(), 2, 2000);
        let x3 = bogus_block(x2.header.header_hash(), 3, 3000);
        let peer_blocks = vec![genesis::genesis_block(), x1, x2, x3];
        let peer = spawn_stub_peer(4, peer_blocks[3].header.header_hash(), peer_blocks).await;
        let manager = test_manager();

        assert!(sync_peer(&ours, &manager, peer).await.is_err());
        assert_eq!(ours.storage.height().await.unwrap(), 2);
        assert_eq!(our_tip_hash(&ours).await, a2.header.header_hash());
    }

    #[tokio::test]
    async fn sync_peer_simple_behind_still_syncs() {
        // Depth-0 case: same history, we are just behind — linear sync fills
        // the gap without any rollback.
        let ours = new_node().await;
        let theirs = new_node().await;
        let pm = miner("zion1theirs");
        let mut peer_blocks = vec![genesis::genesis_block()];
        for _ in 0..3 {
            peer_blocks.push(mine_next(&theirs, &pm).await);
        }

        let peer = spawn_stub_peer(3, peer_blocks[3].header.header_hash(), peer_blocks.clone())
            .await;
        let manager = test_manager();
        sync_peer(&ours, &manager, peer).await.unwrap();

        assert_eq!(ours.storage.height().await.unwrap(), 3);
        assert_eq!(
            our_tip_hash(&ours).await,
            peer_blocks[3].header.header_hash()
        );
    }
}
