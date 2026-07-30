//! Minimal P2P gossip + IBD module for the ZION L1 node.
//!
//! Alpha scope: listen for inbound connections, accept `Block` gossip, and
//! respond to `GetStatus`/`GetBlocks` requests for Initial Block Download (IBD).
//! Full handshake, peer discovery, and robust sync are future work.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::sleep;
use tracing::{info, warn};

use crate::block::Block;
use crate::node::Node;

/// Wire message types exchanged between Alpha nodes.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum Message {
    Block { block: Block },
    GetStatus,
    Status { height: u64, tip_hash: String },
    GetBlocks { start_height: u64, end_height: u64 },
    Blocks { blocks: Vec<Block> },
}

/// P2P listener.
pub struct P2P {
    node: Arc<Node>,
}

impl P2P {
    pub fn new(node: Arc<Node>) -> Self {
        Self { node }
    }

    /// Listen for inbound peers until shutdown is signalled.
    pub async fn listen(
        &self,
        addr: SocketAddr,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), crate::node::NodeError> {
        let listener = TcpListener::bind(addr).await?;
        info!("P2P listening on {}", addr);

        loop {
            tokio::select! {
                _ = shutdown.changed() => break,
                accept = listener.accept() => {
                    let (socket, peer) = accept?;
                    let node = Arc::clone(&self.node);
                    tokio::spawn(async move {
                        if let Err(e) = handle_peer(socket, node).await {
                            warn!("P2P peer {} disconnected: {}", peer, e);
                        }
                    });
                }
            }
        }
        Ok(())
    }
}

async fn handle_peer(mut socket: TcpStream, node: Arc<Node>) -> Result<(), crate::node::NodeError> {
    let (reader, mut writer) = socket.split();
    let mut lines = BufReader::new(reader).lines();

    while let Some(line) = lines.next_line().await? {
        let msg: Message = match serde_json::from_str(&line) {
            Ok(m) => m,
            Err(e) => {
                warn!("invalid P2P message: {}", e);
                continue;
            }
        };

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
                write_message(&mut writer, &reply).await?;
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
                write_message(&mut writer, &reply).await?;
            }
            Message::Status { .. } | Message::Blocks { .. } => {}
        }
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
                    if let Err(e) = sync_peer(&node, *peer).await {
                        warn!("P2P sync from {} failed: {}", peer, e);
                    }
                }
            }
        }
    }
}

async fn sync_peer(node: &Node, peer: SocketAddr) -> Result<(), crate::node::NodeError> {
    let (peer_height, _peer_hash) = get_status(peer).await?;
    let our_height = node.storage.height().await?;

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
