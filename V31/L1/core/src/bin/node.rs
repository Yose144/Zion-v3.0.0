//! ZION L1 node binary for Mainnet Alpha.
//!
//! Usage:
//!   zion-node --db-path zion-node.db --rpc 127.0.0.1:9443 --p2p 0.0.0.0:8333

use std::net::SocketAddr;
use std::sync::Arc;

use clap::Parser;
use tokio::sync::watch;
use tracing::info;
use zion_core::node::{Node, NodeConfig};
use zion_core::v3_compat::{
    MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET, MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET,
};
use zion_l1_types::{Address, ChainId};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// SQLite database path.
    #[arg(long, default_value = "zion-node.db", env = "ZION_NODE_DB")]
    db_path: String,

    /// RPC bind address.
    #[arg(long, default_value = "127.0.0.1:9443", env = "ZION_NODE_RPC")]
    rpc: SocketAddr,

    /// P2P bind address.
    #[arg(long, default_value = "0.0.0.0:8333", env = "ZION_NODE_P2P")]
    p2p: SocketAddr,

    /// V3-compatible P2P bind address (for V3 peer sync).
    #[arg(long, default_value = "0.0.0.0:0", env = "ZION_V3_P2P_BIND")]
    v3_p2p: SocketAddr,

    /// Humanitarian coinbase recipient.
    #[arg(long, default_value = MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET)]
    human: String,

    /// Issobella coinbase recipient.
    #[arg(long, default_value = MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET)]
    issobella: String,

    /// Skip seeding the genesis block (used when importing a migration snapshot).
    #[arg(long, default_value_t = false)]
    no_genesis: bool,

    /// Seed peer(s) for P2P block sync. Repeat for multiple peers.
    #[arg(long, short = 'P')]
    peer: Vec<SocketAddr>,

    /// V3 miner coinbase payout address (empty = no coinbase).
    #[arg(long, env = "ZION_V3_MINER_ADDRESS", default_value = "")]
    v3_miner: String,

    /// V3 humanitarian fund address.
    #[arg(long, env = "ZION_V3_HUMAN_ADDRESS")]
    v3_human: Option<String>,

    /// V3 issobella fund address.
    #[arg(long, env = "ZION_V3_ISSOBELLA_ADDRESS")]
    v3_issobella: Option<String>,

    /// Skip V3 genesis seeding.
    #[arg(long, default_value_t = false)]
    v3_no_genesis: bool,

    /// Optional V3 checkpoint snapshot JSON file for startup import.
    #[arg(long, env = "ZION_V3_CHECKPOINT")]
    v3_checkpoint: Option<std::path::PathBuf>,

    /// Node ID (for P2P identification).
    #[arg(long, env = "ZION_NODE_ID", default_value = "zion-v31-node-0")]
    node_id: String,

    /// Block retention (0 = unlimited).
    #[arg(long, env = "ZION_BLOCK_RETENTION", default_value_t = 0)]
    block_retention: usize,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    // Migration height from env (V3 compat: pre-fork blocks use legacy 1e12 scale).
    if let Ok(mh_str) = std::env::var("ZION_MIGRATION_HEIGHT") {
        if let Ok(mh) = mh_str.parse::<u64>() {
            if mh > 0 {
                info!(migration_height = mh, "pre-fork blocks use legacy 1e12 scale");
            }
        }
    }

    let human = Address::new(ChainId::ZionL1, vec![], &args.human)
        .map_err(|e| format!("invalid human address: {e}"))?;
    let issobella = Address::new(ChainId::ZionL1, vec![], &args.issobella)
        .map_err(|e| format!("invalid issobella address: {e}"))?;

    // Build seed peers: CLI --peer args + ZION_SEED_PEERS env.
    let mut seed_peers = args.peer.clone();
    if let Ok(env_peers) = std::env::var("ZION_SEED_PEERS") {
        for entry in env_peers.split(',') {
            let entry = entry.trim();
            if !entry.is_empty() && entry != "none" && entry != "empty" {
                if let Ok(addr) = entry.parse::<SocketAddr>() {
                    if !seed_peers.contains(&addr) {
                        seed_peers.push(addr);
                    }
                }
            }
        }
    }

    let v3_human = args
        .v3_human
        .unwrap_or_else(|| MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET.to_string());
    let v3_issobella = args
        .v3_issobella
        .unwrap_or_else(|| MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET.to_string());

    let config = NodeConfig {
        db_path: args.db_path.clone(),
        rpc_addr: args.rpc,
        p2p_addr: args.p2p,
        v3_p2p_addr: args.v3_p2p,
        human_address: human,
        issobella_address: issobella,
        no_genesis: args.no_genesis,
        seed_peers,
        v3_miner_address: args.v3_miner.clone(),
        v3_humanitarian_address: v3_human.clone(),
        v3_issobella_address: v3_issobella.clone(),
        v3_no_genesis: args.v3_no_genesis,
        v3_checkpoint_path: args.v3_checkpoint,
    };

    info!("ZION v3.1 node");
    info!("node_id={}", args.node_id);
    if !args.v3_miner.is_empty() {
        info!("v3_miner_address={}", args.v3_miner);
    }
    info!("v3_humanitarian_address={}", v3_human);
    info!("v3_issobella_address={}", v3_issobella);
    info!("protocol_version=3.1.0-alpha");
    info!("p2p_bind={}", args.p2p);
    info!("v3_p2p_bind={}", args.v3_p2p);
    info!("rpc_bind={}", args.rpc);
    info!(
        "block_retention={}",
        if args.block_retention == 0 {
            "unlimited".to_string()
        } else {
            args.block_retention.to_string()
        }
    );
    info!("db_path={}", args.db_path);
    if !config.seed_peers.is_empty() {
        info!(
            "seed_peers={}",
            config
                .seed_peers
                .iter()
                .map(|p| p.to_string())
                .collect::<Vec<_>>()
                .join(",")
        );
    }

    let node = Arc::new(Node::new(config).await?);

    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    // Signal handling: Ctrl-C (SIGINT) + SIGTERM on Unix.
    tokio::spawn(async move {
        let ctrl_c = tokio::signal::ctrl_c();
        #[cfg(unix)]
        let sigterm = async {
            use tokio::signal::unix::{signal, SignalKind};
            match signal(SignalKind::terminate()) {
                Ok(mut s) => {
                    s.recv().await;
                }
                Err(_) => {
                    std::future::pending::<()>().await;
                }
            }
        };
        #[cfg(not(unix))]
        let sigterm = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {
                info!("received SIGINT, shutting down");
            }
            _ = sigterm => {
                info!("received SIGTERM, shutting down");
            }
        }
        let _ = shutdown_tx.send(true);
    });

    node.run(shutdown_rx).await?;
    info!("ZION node stopped");
    Ok(())
}
