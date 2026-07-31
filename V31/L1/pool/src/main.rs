//! ZION L1 stratum pool server.
//!
//! Stand-alone binary that binds a TCP stratum port, accepts miner
//! connections, fetches block templates from a `zion-node` RPC and
//! forwards solved blocks back to the node.

use std::sync::{Arc, Mutex};

use clap::Parser;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tracing::{info, warn};
use zion_l1_types::{Address, ChainId};

use zion_pool::{Pool, PoolConfig, StratumServer};

#[derive(Parser, Debug)]
#[command(name = "zion-pool")]
#[command(about = "ZION L1 stratum pool server")]
#[command(version)]
struct Args {
    /// Stratum bind address.
    #[arg(short, long, default_value = "0.0.0.0:8444")]
    bind: String,

    /// Zion L1 node RPC URL for getTemplate / submitBlock.
    #[arg(short, long)]
    l1_rpc_url: Option<String>,

    /// Pool/miner address for coinbase in block templates.
    #[arg(short, long, default_value = "zion1pool")]
    miner_address: String,

    /// PPLNS state persistence path.
    #[arg(long)]
    state_path: Option<String>,

    /// Pool fee in basis points.
    #[arg(long, default_value_t = 100)]
    pool_fee_bps: u16,

    /// PPLNS window in shares.
    #[arg(long, default_value_t = 10000)]
    pplns_window: usize,
}

fn parse_address(encoded: &str) -> anyhow::Result<Address> {
    Address::new(ChainId::ZionL1, vec![], encoded)
        .map_err(|e| anyhow::anyhow!("invalid ZION address {encoded}: {e}"))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    let pool_address = parse_address(&args.miner_address)?;
    let l1_rpc_url = args.l1_rpc_url.unwrap_or_default();

    let config = PoolConfig {
        port: 0,
        pool_fee_bps: args.pool_fee_bps,
        pplns_window_shares: args.pplns_window,
        pplns_window_blocks: 100,
        zion_target: [0xFF; 32],
        auxpow_target: [0xFF; 32],
        pool_address,
        worker: String::new(),
        password: String::new(),
        l1_rpc_url: if l1_rpc_url.is_empty() { None } else { Some(l1_rpc_url.clone()) },
        state_path: args.state_path,
        reconnect_rate_limit: Default::default(),
    };

    let pool = Arc::new(Mutex::new(Pool::new(config)));
    let server = StratumServer::new(pool);

    let listener = TcpListener::bind(&args.bind).await?;
    let local_addr = listener.local_addr()?;
    info!("zion-pool listening on {}", local_addr);

    if !l1_rpc_url.is_empty() {
        info!("template feed from L1 RPC: {}", l1_rpc_url);
    } else {
        warn!("no --l1-rpc-url configured; template feed disabled");
    }

    let (_shutdown_tx, shutdown_rx) = watch::channel(false);

    let feed_server = server.clone();
    let feed_handle = tokio::spawn(async move {
        feed_server
            .template_feed_loop(l1_rpc_url, args.miner_address, shutdown_rx)
            .await;
    });

    let run_handle = tokio::spawn(async move {
        let _ = server.run(listener).await;
    });

    tokio::select! {
        _ = feed_handle => {},
        _ = run_handle => {},
    }

    info!("zion-pool stopped");
    Ok(())
}
