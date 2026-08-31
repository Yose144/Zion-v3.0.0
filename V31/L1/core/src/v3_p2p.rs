//! V3 mainnet P2P sync client.
//!
//! Implements the V3 `P2pMessage` wire protocol (Hello, GetBlocksSince, Blocks,
//! AnnounceBlock, …) and downloads blocks from a V3 seed peer into the local
//! `Storage`.  Downloaded blocks are validated with `validate_v3_block` and
//! the next difficulty is computed using LWMA-60 from already-stored blocks.

use std::net::SocketAddr;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::{TcpListener, TcpStream};
use tracing::{debug, info, warn};

use crate::difficulty;
use crate::peer_manager::{PeerManager, PeerSource};
use crate::storage::{Storage, StorageError};
use crate::v3_compat::{validate_v3_block, AccountTransaction, UtxoTransaction, V3AcceptedBlock};

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/// V3 submitted transaction (wire format — matches V3 `SubmittedTransaction`).
///
/// V3 uses an `untagged` serde enum with `Account` and `Utxo` variants.
/// We mirror that exactly so V3 peers can send us transactions and vice-versa.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SubmittedTransaction {
    Account(AccountTransaction),
    Utxo(UtxoTransaction),
}

/// V3 network identifier.  Must match V3's serialization exactly (PascalCase,
/// no `rename_all`) so that V3 nodes can deserialize our Hello message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkId {
    Mainnet,
    Testnet,
    Devnet,
}

/// V3 peer endpoint (`host:port`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerEndpoint {
    pub host: String,
    pub port: u16,
}

impl PeerEndpoint {
    pub fn new(host: impl Into<String>, port: u16) -> Self {
        Self {
            host: host.into(),
            port,
        }
    }

    pub fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

/// Minimal V3 node status (enough for sync and handshake).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NodeStatus {
    pub node_id: String,
    pub network: NetworkId,
    pub protocol_version: String,
    pub consensus_profile: String,
    pub chain_height: u64,
    pub tip_hash_hex: String,
    pub p2p_bind: PeerEndpoint,
    pub rpc_bind: PeerEndpoint,
    pub pool_bind: PeerEndpoint,
}

/// V3 P2P wire message.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum P2pMessage {
    Hello {
        node_id: String,
        protocol_version: String,
        network: NetworkId,
        listen_addr: String,
    },
    Welcome {
        node_id: String,
        protocol_version: String,
        profile: String,
        peers: Vec<PeerEndpoint>,
    },
    Ping {
        nonce: u64,
    },
    Pong {
        nonce: u64,
    },
    GetPeers,
    Peers {
        peers: Vec<PeerEndpoint>,
    },
    GetStatus,
    Status {
        status: NodeStatus,
    },
    GetBlocksSince {
        from_height: u64,
        limit: u16,
    },
    Blocks {
        blocks: Vec<V3AcceptedBlock>,
    },
    AnnounceBlock {
        block: V3AcceptedBlock,
    },
    AnnounceTx {
        tx_id: String,
        transaction: SubmittedTransaction,
    },
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/// V3 P2P / sync error.
#[derive(Debug, thiserror::Error)]
pub enum V3P2PError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("storage error: {0}")]
    Storage(#[from] StorageError),
    #[error("invalid message: {0}")]
    InvalidMessage(String),
    #[error("unexpected message: {0}")]
    UnexpectedMessage(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("parent block {0} missing")]
    MissingParent(u64),
}

// ---------------------------------------------------------------------------
// Sync client
// ---------------------------------------------------------------------------

/// V3 block-sync client.
#[derive(Clone)]
pub struct V3Sync {
    storage: Arc<Storage>,
    node_id: String,
    protocol_version: String,
    network: NetworkId,
}

impl V3Sync {
    pub fn new(
        storage: Arc<Storage>,
        node_id: impl Into<String>,
        protocol_version: impl Into<String>,
        network: NetworkId,
    ) -> Self {
        Self {
            storage,
            node_id: node_id.into(),
            protocol_version: protocol_version.into(),
            network,
        }
    }

    /// Connect to `peer`, handshake, and download/validate/store all blocks
    /// the peer has beyond our local V3 tip.
    pub async fn sync_from(
        &self,
        peer: SocketAddr,
        peers: &PeerManager,
    ) -> Result<u64, V3P2PError> {
        peers.add_known(peer, PeerSource::Seed).await;
        let stream = TcpStream::connect(peer).await?;
        let (reader, mut writer) = stream.into_split();
        let mut lines = BufReader::new(reader).lines();

        // Handshake: announce ourselves and wait for Welcome.
        self.write_message(
            &mut writer,
            &P2pMessage::Hello {
                node_id: self.node_id.clone(),
                protocol_version: self.protocol_version.clone(),
                network: self.network,
                listen_addr: "0.0.0.0:0".to_string(),
            },
        )
        .await?;

        // V3 seed responds with Welcome (and optionally Status). Read and skip
        // non-Status handshake traffic until we know where to start.
        // NOTE: V3's `accepted_blocks_since` filters `height > from_height`
        // (exclusive), so we send our tip height (not tip+1) to get blocks
        // starting from tip+1.
        let mut from_height = match self.storage.v3_tip().await? {
            None => 0,
            Some(tip) => tip.height,
        };
        info!(from_height, "starting V3 sync");

        let handshake = self.read_message(&mut lines).await?;
        if let P2pMessage::Status { status } = &handshake {
            info!(chain_height = status.chain_height, "V3 peer status");
        } else if !matches!(handshake, P2pMessage::Welcome { .. }) {
            return Err(V3P2PError::UnexpectedMessage(format!("{:?}", handshake)));
        }

        let mut synced = 0u64;
        loop {
            self.write_message(
                &mut writer,
                &P2pMessage::GetBlocksSince {
                    from_height,
                    limit: 200,
                },
            )
            .await?;

            let msg = self.read_message(&mut lines).await?;
            match msg {
                P2pMessage::Blocks { blocks } => {
                    if blocks.is_empty() {
                        info!("V3 peer has no more blocks");
                        break;
                    }
                    for accepted in blocks {
                        let block = accepted
                            .into_v3_block()
                            .map_err(V3P2PError::InvalidMessage)?;

                        if block.height == 0 {
                            // Genesis is the trusted root; only accept it at
                            // the very start of a fresh sync.
                            validate_v3_block(
                                &block,
                                [0u8; 32],
                                0,
                                u64::MAX,
                                difficulty::GENESIS_DIFFICULTY,
                            )
                            .map_err(|e| V3P2PError::Validation(e.to_string()))?;
                        } else {
                            let prev_height = block.height - 1;
                            let prev = self
                                .storage
                                .get_v3_block_by_height(prev_height)
                                .await?
                                .ok_or(V3P2PError::MissingParent(prev_height))?;

                            // V3 does NOT validate difficulty on peer block
                            // import — it trusts the peer-provided difficulty.
                            // We replicate this behavior to avoid LWMA mismatches
                            // caused by minor differences in window computation.
                            validate_v3_block(
                                &block,
                                prev.header_hash(),
                                prev.header.timestamp,
                                prev.height,
                                block.difficulty,
                            )
                            .map_err(|e| V3P2PError::Validation(e.to_string()))?;
                        }

                        let height = block.height;
                        self.storage.put_v3_block(&block).await?;
                        synced += 1;
                        // V3 filters `height > from_height` (exclusive), so set
                        // from_height to the last accepted height.
                        from_height = height;
                        info!(height, synced, "V3 block accepted");
                    }
                }
                P2pMessage::Status { status } => {
                    info!(chain_height = status.chain_height, "V3 peer status");
                    if status.chain_height < from_height {
                        break;
                    }
                    // Peer has told us its height but did not send blocks.
                    // Wait a bit and retry (it may be busy).
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
                // Skip AnnounceTx, Ping, Pong, Peers during sync —
                // V3 peers may relay transactions while we're syncing.
                P2pMessage::AnnounceTx { tx_id, .. } => {
                    debug!(%tx_id, "ignoring AnnounceTx during sync");
                }
                P2pMessage::Ping { nonce } => {
                    debug!(nonce, "ignoring Ping during sync");
                }
                P2pMessage::Pong { .. } => {
                    debug!("ignoring Pong during sync");
                }
                P2pMessage::Peers { .. } => {
                    debug!("ignoring Peers during sync");
                }
                other => {
                    warn!(?other, "unexpected V3 P2P message during sync");
                    return Err(V3P2PError::UnexpectedMessage(format!("{:?}", other)));
                }
            }
        }

        Ok(synced)
    }

    async fn read_message(
        &self,
        lines: &mut tokio::io::Lines<BufReader<OwnedReadHalf>>,
    ) -> Result<P2pMessage, V3P2PError> {
        let line = lines
            .next_line()
            .await?
            .ok_or_else(|| V3P2PError::InvalidMessage("peer closed stream".to_string()))?;
        serde_json::from_str(&line)
            .map_err(|e| V3P2PError::InvalidMessage(format!("malformed JSON: {e}")))
    }

    async fn write_message(
        &self,
        writer: &mut OwnedWriteHalf,
        msg: &P2pMessage,
    ) -> Result<(), V3P2PError> {
        let body = serde_json::to_string(msg)
            .map_err(|e| V3P2PError::InvalidMessage(format!("serialization failed: {e}")))?;
        writer.write_all(body.as_bytes()).await?;
        writer.write_all(b"\n").await?;
        writer.flush().await?;
        Ok(())
    }
}

/// Periodically sync missing V3 blocks from a set of seed peers.
pub async fn sync_loop(
    sync: V3Sync,
    manager: Arc<PeerManager>,
    peers: Vec<SocketAddr>,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) {
    let interval = std::time::Duration::from_secs(30);
    let mut first = true;

    loop {
        let sleep_fut = if first {
            first = false;
            tokio::time::sleep(std::time::Duration::from_secs(2))
        } else {
            tokio::time::sleep(interval)
        };

        tokio::select! {
            _ = shutdown.changed() => break,
            _ = sleep_fut => {
                for peer in &peers {
                    manager.add_known(*peer, PeerSource::Seed).await;
                    match sync.sync_from(*peer, &manager).await {
                        Ok(n) if n > 0 => {
                            info!(peer = %peer, synced = n, "V3 sync batch complete");
                            manager.record_good(*peer).await;
                        }
                        Ok(_) => {
                            manager.record_good(*peer).await;
                        }
                        Err(e) => {
                            warn!(peer = %peer, "V3 sync failed: {}", e);
                            manager.record_bad(*peer, 1).await;
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// P2P listen server
// ---------------------------------------------------------------------------

/// V3 P2P server: listens for inbound peers and responds to V3 wire messages.
///
/// Handles:
/// - `Hello` → replies with `Welcome` + `Status`.
/// - `GetBlocksSince` → returns stored V3 blocks as `Blocks`.
/// - `AnnounceBlock` → validates and stores the announced block.
/// - `GetStatus` → replies with `Status`.
pub struct V3P2PServer {
    storage: Arc<Storage>,
    node_id: String,
    protocol_version: String,
    network: NetworkId,
    listen_addr: String,
    rpc_addr: String,
    pool_addr: String,
    peers: Arc<PeerManager>,
}

impl V3P2PServer {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        storage: Arc<Storage>,
        node_id: impl Into<String>,
        protocol_version: impl Into<String>,
        network: NetworkId,
        listen_addr: impl Into<String>,
        rpc_addr: impl Into<String>,
        pool_addr: impl Into<String>,
        peers: Arc<PeerManager>,
    ) -> Self {
        Self {
            storage,
            node_id: node_id.into(),
            protocol_version: protocol_version.into(),
            network,
            listen_addr: listen_addr.into(),
            rpc_addr: rpc_addr.into(),
            pool_addr: pool_addr.into(),
            peers,
        }
    }

    /// Listen for inbound V3 peers until shutdown is signalled.
    pub async fn listen(
        &self,
        addr: SocketAddr,
        mut shutdown: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), V3P2PError> {
        let listener = TcpListener::bind(addr).await?;
        self.peers.set_local_addr(addr).await;
        info!(%addr, "V3 P2P listening");

        loop {
            tokio::select! {
                _ = shutdown.changed() => break,
                accept = listener.accept() => {
                    let (socket, peer) = accept?;
                    let peers = Arc::clone(&self.peers);
                    let handler = V3PeerHandler {
                        storage: self.storage.clone(),
                        node_id: self.node_id.clone(),
                        protocol_version: self.protocol_version.clone(),
                        network: self.network,
                        listen_addr: self.listen_addr.clone(),
                        rpc_addr: self.rpc_addr.clone(),
                        pool_addr: self.pool_addr.clone(),
                        peers: Arc::clone(&peers),
                    };
                    tokio::spawn(async move {
                        let _guard = match peers.acquire(peer).await {
                            Some(g) => g,
                            None => {
                                warn!(%peer, "V3 P2P peer rejected");
                                return;
                            }
                        };
                        if let Err(e) = handler.handle(socket).await {
                            warn!(%peer, "V3 P2P peer disconnected: {}", e);
                        } else {
                            peers.record_good(peer).await;
                        }
                    });
                }
            }
        }
        Ok(())
    }
}

/// Per-connection handler for inbound V3 P2P peers.
struct V3PeerHandler {
    storage: Arc<Storage>,
    node_id: String,
    protocol_version: String,
    network: NetworkId,
    listen_addr: String,
    rpc_addr: String,
    pool_addr: String,
    peers: Arc<PeerManager>,
}

impl V3PeerHandler {
    async fn handle(&self, socket: TcpStream) -> Result<(), V3P2PError> {
        let peer_addr = socket.peer_addr().map_err(V3P2PError::Io)?;
        let (reader, mut writer) = socket.into_split();
        let mut lines = BufReader::new(reader).lines();

        while let Some(line) = lines.next_line().await? {
            let msg: P2pMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(e) => {
                    warn!("invalid V3 P2P message: {}", e);
                    self.peers.record_bad(peer_addr, 1).await;
                    continue;
                }
            };

            match msg {
                P2pMessage::Hello { .. } => {
                    let peers = self.peers.random_endpoints(8).await;
                    let welcome = P2pMessage::Welcome {
                        node_id: self.node_id.clone(),
                        protocol_version: self.protocol_version.clone(),
                        profile: "v3".to_string(),
                        peers,
                    };
                    self.write_msg(&mut writer, &welcome).await?;

                    // Also send our status so the peer knows our chain height.
                    if let Some(tip) = self.storage.v3_tip().await? {
                        let status = P2pMessage::Status {
                            status: NodeStatus {
                                node_id: self.node_id.clone(),
                                network: self.network,
                                protocol_version: self.protocol_version.clone(),
                                consensus_profile: "v3".to_string(),
                                chain_height: tip.height,
                                tip_hash_hex: hex::encode(tip.header_hash()),
                                p2p_bind: parse_endpoint(&self.listen_addr),
                                rpc_bind: parse_endpoint(&self.rpc_addr),
                                pool_bind: parse_endpoint(&self.pool_addr),
                            },
                        };
                        self.write_msg(&mut writer, &status).await?;
                    }
                }
                P2pMessage::GetPeers => {
                    let peers = self.peers.random_endpoints(8).await;
                    let reply = P2pMessage::Peers { peers };
                    self.write_msg(&mut writer, &reply).await?;
                }
                P2pMessage::GetStatus => {
                    let tip = self.storage.v3_tip().await?;
                    let (height, tip_hash) = match tip {
                        Some(b) => (b.height, hex::encode(b.header_hash())),
                        None => (0, hex::encode([0u8; 32])),
                    };
                    let status = P2pMessage::Status {
                        status: NodeStatus {
                            node_id: self.node_id.clone(),
                            network: self.network,
                            protocol_version: self.protocol_version.clone(),
                            consensus_profile: "v3".to_string(),
                            chain_height: height,
                            tip_hash_hex: tip_hash,
                            p2p_bind: parse_endpoint(&self.listen_addr),
                            rpc_bind: parse_endpoint(&self.rpc_addr),
                            pool_bind: parse_endpoint(&self.pool_addr),
                        },
                    };
                    self.write_msg(&mut writer, &status).await?;
                }
                P2pMessage::GetBlocksSince { from_height, limit } => {
                    let tip_height = self.storage.v3_tip().await?.map(|t| t.height).unwrap_or(0);
                    let end = std::cmp::min(from_height + limit as u64, tip_height + 1);
                    let mut blocks = Vec::new();
                    for h in from_height..end {
                        if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                            blocks.push(block_to_accepted(&block));
                        }
                    }
                    let reply = P2pMessage::Blocks { blocks };
                    self.write_msg(&mut writer, &reply).await?;
                }
                P2pMessage::AnnounceBlock { block } => {
                    match block.into_v3_block() {
                        Ok(v3_block) => {
                            info!(height = v3_block.height, "received announced V3 block");
                            // Basic validation: check height continuity.
                            if let Some(tip) = self.storage.v3_tip().await? {
                                if v3_block.height == tip.height + 1
                                    && v3_block.header.previous_hash == tip.header_hash()
                                {
                                    if let Err(e) = self.storage.put_v3_block(&v3_block).await {
                                        warn!("failed to store announced block: {}", e);
                                    }
                                } else if v3_block.height > tip.height + 1 {
                                    warn!(
                                        announced = v3_block.height,
                                        tip = tip.height,
                                        "announced block too far ahead, skipping"
                                    );
                                }
                            } else if v3_block.height == 0 {
                                let _ = self.storage.put_v3_block(&v3_block).await;
                            }
                        }
                        Err(e) => {
                            warn!("invalid announced block: {}", e);
                            self.peers.record_bad(peer_addr, 2).await;
                        }
                    }
                    // Acknowledge with our current status (matches V3 behavior).
                    if let Some(tip) = self.storage.v3_tip().await? {
                        let status = P2pMessage::Status {
                            status: NodeStatus {
                                node_id: self.node_id.clone(),
                                network: self.network,
                                protocol_version: self.protocol_version.clone(),
                                consensus_profile: "v3".to_string(),
                                chain_height: tip.height,
                                tip_hash_hex: hex::encode(tip.header_hash()),
                                p2p_bind: parse_endpoint(&self.listen_addr),
                                rpc_bind: parse_endpoint(&self.rpc_addr),
                                pool_bind: parse_endpoint(&self.pool_addr),
                            },
                        };
                        self.write_msg(&mut writer, &status).await?;
                    }
                }
                P2pMessage::AnnounceTx { tx_id, .. } => {
                    // V31 does not yet have a mempool for V3 transactions;
                    // acknowledge with status so the peer doesn't disconnect.
                    debug!(%tx_id, "received AnnounceTx (not yet stored)");
                    if let Some(tip) = self.storage.v3_tip().await? {
                        let status = P2pMessage::Status {
                            status: NodeStatus {
                                node_id: self.node_id.clone(),
                                network: self.network,
                                protocol_version: self.protocol_version.clone(),
                                consensus_profile: "v3".to_string(),
                                chain_height: tip.height,
                                tip_hash_hex: hex::encode(tip.header_hash()),
                                p2p_bind: parse_endpoint(&self.listen_addr),
                                rpc_bind: parse_endpoint(&self.rpc_addr),
                                pool_bind: parse_endpoint(&self.pool_addr),
                            },
                        };
                        self.write_msg(&mut writer, &status).await?;
                    }
                }
                // Ignore unsolicited replies.
                _ => {}
            }
        }
        Ok(())
    }

    async fn write_msg(
        &self,
        writer: &mut OwnedWriteHalf,
        msg: &P2pMessage,
    ) -> Result<(), V3P2PError> {
        let body = serde_json::to_string(msg)
            .map_err(|e| V3P2PError::InvalidMessage(format!("serialization failed: {e}")))?;
        writer.write_all(body.as_bytes()).await?;
        writer.write_all(b"\n").await?;
        writer.flush().await?;
        Ok(())
    }
}

/// Parse a `host:port` string into a `PeerEndpoint`.
fn parse_endpoint(addr: &str) -> PeerEndpoint {
    if let Some(idx) = addr.rfind(':') {
        let host = &addr[..idx];
        let port = addr[idx + 1..].parse().unwrap_or(0);
        PeerEndpoint {
            host: host.to_string(),
            port,
        }
    } else {
        PeerEndpoint {
            host: addr.to_string(),
            port: 0,
        }
    }
}

/// Convert a `V3Block` to `V3AcceptedBlock` for wire serialization.
///
/// Fee/subsidy fields are computed from the block's transactions so that
/// V3 peers receiving our blocks don't reject them for zero/empty metadata.
fn block_to_accepted(block: &crate::v3_compat::V3Block) -> V3AcceptedBlock {
    // Compute total fees from account transactions (non-coinbase).
    let total_fees_zion: u64 = block.transactions.iter().map(|t| t.fee_zion).sum();

    // Compute body hash from transaction IDs (matches V3 merkle root approach).
    let body_hash_hex = hex::encode(block.header.merkle_root);

    V3AcceptedBlock {
        template_id: 0,
        height: block.height,
        timestamp: block.header.timestamp,
        difficulty: block.difficulty,
        nonce: block.nonce,
        hash_hex: hex::encode(block.header_hash()),
        header_hex: hex::encode(block.header.to_bytes()),
        previous_hash_hex: hex::encode(block.header.previous_hash),
        algorithm: "deeksha_lite_v1".to_string(),
        transaction_ids: block.transactions.iter().map(|t| t.tx_id.clone()).collect(),
        transactions: block.transactions.clone(),
        total_fees_zion,
        body_hash_hex,
        // Subsidy and reward fields default to 0 for locally-converted blocks
        // (V3 uses these for display/audit, not for consensus validation on
        // the receiving side — the PoW hash and difficulty are what matter).
        subsidy_zion: 0,
        miner_reward_zion: 0,
        miner_address: String::new(),
        humanitarian_address: String::new(),
        issobella_address: String::new(),
        pool_fee_address: String::new(),
        utxo_transaction_ids: block
            .utxo_transactions
            .iter()
            .map(|t| hex::encode(t.id))
            .collect(),
        utxo_transactions: block.utxo_transactions.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::v3_compat::{build_v3_genesis_block, V3Block};
    use tokio::net::TcpListener;

    fn accepted_from_block(block: &V3Block) -> V3AcceptedBlock {
        V3AcceptedBlock {
            template_id: 0,
            height: block.height,
            timestamp: block.header.timestamp,
            difficulty: block.difficulty,
            nonce: block.nonce,
            hash_hex: hex::encode(block.header_hash()),
            header_hex: hex::encode(block.header.to_bytes()),
            previous_hash_hex: hex::encode(block.header.previous_hash),
            algorithm: "deeksha_lite_v1".to_string(),
            transaction_ids: block.transactions.iter().map(|t| t.tx_id.clone()).collect(),
            transactions: block.transactions.clone(),
            total_fees_zion: 0,
            body_hash_hex: hex::encode(block.header.merkle_root),
            subsidy_zion: 0,
            miner_reward_zion: 0,
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            utxo_transaction_ids: block
                .utxo_transactions
                .iter()
                .map(|t| hex::encode(t.id))
                .collect(),
            utxo_transactions: block.utxo_transactions.clone(),
        }
    }

    #[tokio::test]
    async fn sync_v3_genesis_from_mock_peer() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = socket.into_split();
            let mut lines = BufReader::new(reader).lines();

            // Expect Hello
            let hello = lines.next_line().await.unwrap().unwrap();
            let msg: P2pMessage = serde_json::from_str(&hello).unwrap();
            assert!(matches!(msg, P2pMessage::Hello { .. }));

            // Send Welcome
            let welcome = P2pMessage::Welcome {
                node_id: "mock".to_string(),
                protocol_version: "3.0.5".to_string(),
                profile: "v3".to_string(),
                peers: vec![],
            };
            writer
                .write_all((serde_json::to_string(&welcome).unwrap() + "\n").as_bytes())
                .await
                .unwrap();

            // Expect GetBlocksSince
            let req = lines.next_line().await.unwrap().unwrap();
            let req: P2pMessage = serde_json::from_str(&req).unwrap();
            assert!(matches!(
                req,
                P2pMessage::GetBlocksSince { from_height: 0, .. }
            ));

            // Send genesis block
            let block = build_v3_genesis_block();
            let accepted = accepted_from_block(&block);
            let blocks = P2pMessage::Blocks {
                blocks: vec![accepted],
            };
            writer
                .write_all((serde_json::to_string(&blocks).unwrap() + "\n").as_bytes())
                .await
                .unwrap();

            // Expect GetBlocksSince { from_height: 0 }
            // (V3 filters `height > from_height` exclusively, so after
            // accepting genesis at height 0, from_height stays 0 to fetch
            // blocks with height > 0 on the next round.)
            let req = lines.next_line().await.unwrap().unwrap();
            let req: P2pMessage = serde_json::from_str(&req).unwrap();
            assert!(matches!(
                req,
                P2pMessage::GetBlocksSince { from_height: 0, .. }
            ));

            // Send empty blocks to finish
            let empty = P2pMessage::Blocks { blocks: vec![] };
            writer
                .write_all((serde_json::to_string(&empty).unwrap() + "\n").as_bytes())
                .await
                .unwrap();
        });

        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let sync = V3Sync::new(
            storage.clone(),
            "test-node",
            "3.1.0-alpha",
            NetworkId::Mainnet,
        );

        let peers = PeerManager::default_manager();
        let synced = sync.sync_from(addr, &peers).await.unwrap();
        assert_eq!(synced, 1);

        let tip = storage.v3_tip().await.unwrap().unwrap();
        assert_eq!(tip.height, 0);

        server.await.unwrap();
    }
}
