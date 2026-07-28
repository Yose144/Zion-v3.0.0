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
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    let human = Address::new(ChainId::ZionL1, vec![], &args.human)
        .map_err(|e| format!("invalid human address: {e}"))?;
    let issobella = Address::new(ChainId::ZionL1, vec![], &args.issobella)
        .map_err(|e| format!("invalid issobella address: {e}"))?;

    let config = NodeConfig {
        db_path: args.db_path,
        rpc_addr: args.rpc,
        p2p_addr: args.p2p,
        human_address: human,
        issobella_address: issobella,
        no_genesis: args.no_genesis,
        seed_peers: args.peer,
    };

    let node = Arc::new(Node::new(config).await?);
    info!("ZION node starting; RPC={} P2P={}", args.rpc, args.p2p);

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.ok();
        let _ = shutdown_tx.send(true);
    });

    node.run(shutdown_rx).await?;
    info!("ZION node stopped");
    Ok(())
}
