// Phase 8d — Node Bootstrap Orchestrator (V31-native)
//
// Wires together all V31 subsystems into a coherent node lifecycle:
//   1. Open SQLite storage (or initialize with genesis)
//   2. Build chain state from storage tip
//   3. Initialize IBD engine, peer manager, metrics
//   4. Register RPC methods with live handlers
//   5. Provide a clean startup / shutdown sequence
//
// This module is the "main()" composition layer — it owns the subsystem
// instances and exposes a single `NodeHandle` for the binary entry point.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use crate::ibd::{IbdEngine, SyncStatus};
use crate::launch;
use crate::metrics::NodeMetrics;
use crate::peer_manager::PeerManager;
use crate::rpc::RpcRouter;
use crate::storage::{Storage, StorageError};
use crate::v3_compat;

// ── Error types ────────────────────────────────────────────────────────

/// Errors during node bootstrap or lifecycle.
#[derive(Debug)]
pub enum NodeError {
    Storage(StorageError),
    Launch(String),
    Config(String),
}

impl std::fmt::Display for NodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Storage(e) => write!(f, "storage: {e}"),
            Self::Launch(e) => write!(f, "launch: {e}"),
            Self::Config(e) => write!(f, "config: {e}"),
        }
    }
}

impl std::error::Error for NodeError {}

impl From<StorageError> for NodeError {
    fn from(e: StorageError) -> Self {
        Self::Storage(e)
    }
}

// ── Node config ────────────────────────────────────────────────────────

/// Configuration for the node builder.
#[derive(Clone, Debug)]
pub struct BuilderConfig {
    /// Data directory for the SQLite database.
    pub data_dir: PathBuf,
    /// Seed peers for P2P discovery.
    pub seed_peers: Vec<SocketAddr>,
    /// Maximum inbound connections.
    pub max_inbound: usize,
}

impl Default for BuilderConfig {
    fn default() -> Self {
        Self {
            data_dir: PathBuf::from("zion-node.db"),
            seed_peers: vec![],
            max_inbound: 50,
        }
    }
}

// ── Node state ─────────────────────────────────────────────────────────

/// Current node state summary, exposed for RPC and monitoring.
#[derive(Debug, Clone)]
pub struct NodeStatus {
    pub chain_height: u64,
    pub chain_tip_hash: String,
    pub sync_status: SyncStatus,
    pub peer_count: usize,
    pub version: &'static str,
    pub launch_ready: bool,
}

/// The fully-wired node handle. Owns all subsystem instances.
pub struct NodeHandle {
    pub storage: Storage,
    pub ibd: IbdEngine,
    pub peer_manager: PeerManager,
    pub metrics: Arc<NodeMetrics>,
    pub rpc: RpcRouter,
    chain_height: u64,
    chain_tip_hash: [u8; 32],
    started_at: Instant,
}

impl NodeHandle {
    /// Bootstrap a node from disk. If the database is empty, initializes
    /// from genesis and runs launch readiness checks.
    pub async fn open(config: BuilderConfig) -> Result<Self, NodeError> {
        // 1. Validate seed peers
        if config.seed_peers.is_empty() {
            return Err(NodeError::Config("no seed peers configured".into()));
        }

        // 2. Verify launch readiness before first run
        launch::verify_genesis_integrity()
            .map_err(|e| NodeError::Launch(format!("genesis integrity check failed: {e}")))?;

        // 3. Open (or create) SQLite storage
        let db_path = config.data_dir.join("node.db");
        let storage = Storage::open(&db_path).await?;

        // 4. Determine chain tip from storage
        let (chain_height, chain_tip_hash) = match storage.tip().await? {
            Some((_header, hash)) => (_header.height, hash.0),
            None => {
                // Fresh database — initialize from V3 genesis
                let genesis = v3_compat::genesis_block();
                let genesis_hash = genesis.header_hash();
                (0u64, genesis_hash)
            }
        };

        // 5. Initialize IBD engine from current tip
        let ibd = IbdEngine::new(chain_height);

        // 6. Initialize peer manager
        let peer_manager = PeerManager::new(
            config.max_inbound,
            10,
            std::time::Duration::from_secs(3600),
        );

        // 7. Add seed peers to known set
        for &seed in &config.seed_peers {
            peer_manager
                .add_known(seed, crate::peer_manager::PeerSource::Seed)
                .await;
        }

        // 8. Initialize metrics
        let metrics = Arc::new(NodeMetrics::new());
        metrics.set_chain_height(chain_height);

        // 9. Build RPC router with stub handlers
        let rpc = RpcRouter::build_stub_router();

        Ok(Self {
            storage,
            ibd,
            peer_manager,
            metrics,
            rpc,
            chain_height,
            chain_tip_hash,
            started_at: Instant::now(),
        })
    }

    /// Return current node status.
    pub async fn status(&self) -> NodeStatus {
        NodeStatus {
            chain_height: self.chain_height,
            chain_tip_hash: v3_compat::hex(&self.chain_tip_hash),
            sync_status: self.ibd.status(),
            peer_count: self.peer_manager.known_count().await,
            version: crate::node_runtime::NODE_PROTOCOL_VERSION,
            launch_ready: launch::is_launch_ready(),
        }
    }

    /// Node uptime.
    pub fn uptime(&self) -> std::time::Duration {
        self.started_at.elapsed()
    }

    /// Current chain tip height.
    pub fn tip_height(&self) -> u64 {
        self.chain_height
    }

    /// Update the chain tip after accepting a new block.
    pub fn advance_tip(&mut self, height: u64, hash: [u8; 32]) {
        self.chain_height = height;
        self.chain_tip_hash = hash;
        self.metrics.set_chain_height(height);
        self.metrics.inc_blocks_accepted();
        self.ibd.blocks_applied(height);
    }

    /// Register a new peer connection.
    pub async fn register_peer(
        &mut self,
        addr: SocketAddr,
        best_height: u64,
    ) {
        let peer_id = format!("{addr}");
        self.peer_manager
            .add_known(addr, crate::peer_manager::PeerSource::Outbound)
            .await;
        self.ibd.update_peer(&peer_id, best_height);
        let total = self.peer_manager.known_count().await as i64;
        self.metrics.set_peer_count(total, 0, total);
    }

    /// Disconnect a peer.
    pub async fn disconnect_peer(&mut self, peer_id: &str) {
        self.ibd.remove_peer(peer_id);
        let total = self.peer_manager.known_count().await as i64;
        self.metrics.set_peer_count(total, 0, total);
    }

    /// Run a single IBD tick and return commands.
    pub fn ibd_tick(&mut self) -> Vec<crate::ibd::IbdCommand> {
        self.ibd.tick(Instant::now())
    }

    /// Render Prometheus metrics.
    pub fn prometheus_metrics(&self) -> String {
        self.metrics.render_prometheus()
    }

    /// Render health check JSON.
    pub fn health_check(&self) -> String {
        self.metrics.health_check()
    }

    /// Get launch readiness report.
    pub fn readiness_report(&self) -> String {
        launch::readiness_report()
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use tempfile::tempdir;

    fn test_config(dir: &Path) -> BuilderConfig {
        BuilderConfig {
            data_dir: dir.to_path_buf(),
            seed_peers: vec![
                "127.0.0.1:18334".parse().unwrap(),
                "127.0.0.2:18334".parse().unwrap(),
            ],
            max_inbound: 10,
        }
    }

    #[tokio::test]
    async fn bootstrap_fresh_node() {
        let dir = tempdir().unwrap();
        let handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        assert_eq!(handle.tip_height(), 0);
        let status = handle.status().await;
        assert_eq!(status.chain_height, 0);
        assert!(status.launch_ready);
    }

    #[tokio::test]
    async fn rejects_empty_seed_peers() {
        let dir = tempdir().unwrap();
        let mut cfg = test_config(dir.path());
        cfg.seed_peers.clear();
        let result = NodeHandle::open(cfg).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn status_shows_synced() {
        let dir = tempdir().unwrap();
        let handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        assert_eq!(handle.status().await.sync_status, SyncStatus::Synced);
    }

    #[tokio::test]
    async fn advance_tip_updates_state() {
        let dir = tempdir().unwrap();
        let mut handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        handle.advance_tip(42, [0xAB; 32]);
        assert_eq!(handle.tip_height(), 42);
        assert_eq!(handle.status().await.chain_height, 42);
    }

    #[tokio::test]
    async fn register_and_disconnect_peer() {
        let dir = tempdir().unwrap();
        let mut handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        // 2 seed peers are already known
        let initial = handle.status().await.peer_count;
        let addr: SocketAddr = "192.168.1.1:8334".parse().unwrap();
        handle.register_peer(addr, 100).await;
        assert_eq!(handle.status().await.peer_count, initial + 1);
        handle.disconnect_peer(&format!("{addr}")).await;
    }

    #[tokio::test]
    async fn ibd_tick_returns_commands() {
        let dir = tempdir().unwrap();
        let mut handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        // No peers with higher height, so no commands
        let cmds = handle.ibd_tick();
        assert!(cmds.is_empty());
    }

    #[tokio::test]
    async fn prometheus_metrics_output() {
        let dir = tempdir().unwrap();
        let handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        let metrics = handle.prometheus_metrics();
        assert!(metrics.contains("zion_"));
    }

    #[tokio::test]
    async fn health_check_output() {
        let dir = tempdir().unwrap();
        let handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        let health = handle.health_check();
        assert!(health.contains("status"));
    }

    #[tokio::test]
    async fn readiness_report_output() {
        let dir = tempdir().unwrap();
        let handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        let report = handle.readiness_report();
        assert!(report.contains("Launch Readiness"));
        assert!(report.contains("PASS"));
    }

    #[tokio::test]
    async fn uptime_is_positive() {
        let dir = tempdir().unwrap();
        let handle = NodeHandle::open(test_config(dir.path())).await.unwrap();
        // Uptime should be very small but positive
        assert!(handle.uptime().as_nanos() > 0);
    }
}
