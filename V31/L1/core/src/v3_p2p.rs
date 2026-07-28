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
use tokio::net::TcpStream;
use tracing::{info, warn};

use crate::difficulty::{self, lwma_next_difficulty};
use crate::storage::{Storage, StorageError};
use crate::v3_compat::{validate_v3_block, V3AcceptedBlock};

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/// V3 network identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
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
    pub async fn sync_from(&self, peer: SocketAddr) -> Result<u64, V3P2PError> {
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
        let mut from_height = match self.storage.v3_tip().await? {
            None => 0,
            Some(tip) => tip.height + 1,
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
                            .map_err(|e| V3P2PError::InvalidMessage(e))?;

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

                            let window = self
                                .storage
                                .v3_difficulty_window(difficulty::LWMA_WINDOW + 1)
                                .await?;
                            let expected_difficulty = lwma_next_difficulty(&window);

                            validate_v3_block(
                                &block,
                                prev.header_hash(),
                                prev.header.timestamp,
                                prev.height,
                                expected_difficulty,
                            )
                            .map_err(|e| V3P2PError::Validation(e.to_string()))?;
                        }

                        let height = block.height;
                        self.storage.put_v3_block(&block).await?;
                        synced += 1;
                        from_height = height + 1;
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

            // Expect GetBlocksSince { from_height: 1 }
            let req = lines.next_line().await.unwrap().unwrap();
            let req: P2pMessage = serde_json::from_str(&req).unwrap();
            assert!(matches!(
                req,
                P2pMessage::GetBlocksSince { from_height: 1, .. }
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

        let synced = sync.sync_from(addr).await.unwrap();
        assert_eq!(synced, 1);

        let tip = storage.v3_tip().await.unwrap().unwrap();
        assert_eq!(tip.height, 0);

        server.await.unwrap();
    }
}
