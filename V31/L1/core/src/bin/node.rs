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
        v3_p2p_addr: "0.0.0.0:0".parse().unwrap(),
        human_address: human,
        issobella_address: issobella,
        no_genesis: args.no_genesis,
        seed_peers: args.peer,
        v3_miner_address: args.v3_miner,
        v3_humanitarian_address: args
            .v3_human
            .unwrap_or_else(|| MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET.to_string()),
        v3_issobella_address: args
            .v3_issobella
            .unwrap_or_else(|| MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET.to_string()),
        v3_no_genesis: args.v3_no_genesis,
        v3_checkpoint_path: args.v3_checkpoint,
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
