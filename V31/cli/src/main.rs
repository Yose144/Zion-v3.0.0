use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, bail};
use clap::{Parser, Subcommand};
use tokio::sync::watch;

use std::net::SocketAddr;
use zion_l1_types::{Address, Amount, Asset, ChainId};

mod menu;

use zion_core::node::{Node, NodeConfig};
use zion_miner::config::MinerConfig;
use zion_miner::runtime::MinerRuntime;
use zion_multichain::config::MultichainConfig;
use zion_multichain::server::ApiServer;
use zion_multichain::types::{Transfer, TransferDirection, TransferEndpoint};
use zion_multichain::MultichainService;

#[derive(Parser)]
#[command(name = "zion")]
#[command(about = "ZION V31 Mainnet Alpha CLI")]
#[command(version)]
struct Cli {
    /// Path to the multichain TOML config.
    #[arg(short, long, global = true, value_name = "FILE")]
    config: Option<PathBuf>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Open the interactive operator menu (arrow-key navigation).
    Menu,
    /// Status of the Multi-Chain layer.
    Status,
    /// Wallet commands.
    Wallet(WalletArgs),
    /// Cross-chain bridge commands.
    Bridge(BridgeArgs),
    /// DEX swap commands.
    Swap(SwapArgs),
    /// Mining pool commands.
    Pool(PoolArgs),
    /// Miner commands.
    Miner(MinerArgs),
    /// Verify configuration and adapter connectivity.
    Doctor,
    /// Serve the V31 HTTP API gateway.
    Api,
    /// Start the ZION L1 node.
    Node(NodeArgs),
}

#[derive(Parser)]
struct WalletArgs {
    #[command(subcommand)]
    command: WalletCommand,
}

#[derive(Subcommand)]
enum WalletCommand {
    /// Query native balance for an address.
    Balance {
        /// Chain id, e.g. bitcoin, base, zion-l1.
        #[arg(short, long)]
        chain: String,
        /// Encoded address string.
        #[arg(short, long)]
        address: String,
    },
    /// Derive a wallet address from the service keyring.
    Address {
        /// Chain id.
        #[arg(short, long)]
        chain: String,
        /// BIP44 account.
        #[arg(short, long, default_value = "0")]
        account: u32,
        /// Address index.
        #[arg(short, long, default_value = "0")]
        index: u32,
    },
    /// Sign a message with the service keyring.
    Sign {
        /// Chain id.
        #[arg(short, long)]
        chain: String,
        /// Message to sign.
        #[arg(short, long)]
        message: String,
        /// BIP44 account.
        #[arg(short, long, default_value = "0")]
        account: u32,
        /// Address index.
        #[arg(short, long, default_value = "0")]
        index: u32,
    },
    /// Create a new ZION wallet file (Ed25519 keypair).
    Create {
        /// Output file path (default: ~/.zion/wallet.json).
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Overwrite if file exists.
        #[arg(long)]
        force: bool,
    },
    /// Load a wallet file and show its address.
    Load {
        /// Wallet file path (default: ~/.zion/wallet.json).
        #[arg(short, long)]
        path: Option<PathBuf>,
    },
    /// Send ZION from a wallet file to an address.
    Send {
        /// Wallet file path (default: ~/.zion/wallet.json).
        #[arg(short, long)]
        wallet: Option<PathBuf>,
        /// Recipient address (zion1...).
        #[arg(short, long)]
        to: String,
        /// Amount in ZION (not flowers).
        #[arg(short, long)]
        amount: f64,
        /// Transaction fee in ZION (default: 0.01).
        #[arg(short, long, default_value = "0.01")]
        fee: f64,
        /// Optional memo.
        #[arg(short, long)]
        memo: Option<String>,
        /// L1 RPC URL (default: 127.0.0.1:9445).
        #[arg(long, default_value = "127.0.0.1:9445")]
        rpc: String,
        /// Dry-run: build and sign but do not broadcast.
        #[arg(long)]
        dry_run: bool,
    },
}

#[derive(Parser)]
struct PoolArgs {
    #[command(subcommand)]
    command: PoolCommand,
}

#[derive(Subcommand)]
enum PoolCommand {
    /// Show pool status (accepted/rejected shares and config).
    Status,
    /// Show the latest computed PPLNS payouts.
    Payouts,
    /// Show pool share statistics (same as status).
    Shares,
}

#[derive(Parser)]
struct MinerArgs {
    #[command(subcommand)]
    command: MinerCommand,
}

#[derive(Subcommand)]
enum MinerCommand {
    /// Start the triple-stream miner (ZION + AuxPoW GPU + AuxPoW CPU).
    Start {
        /// ZION address that receives mining rewards.
        #[arg(short, long)]
        reward_address: Option<String>,
        /// ZION L1 node RPC URL for solo mining (template fetch + block submit).
        #[arg(long)]
        node_rpc_url: Option<String>,
        /// Stratum pool URL for ZION share mining.
        #[arg(long)]
        pool_url: Option<String>,
        /// Optional external stratum pool URL for AuxPoW shares.
        #[arg(short, long)]
        auxpow_pool: Option<String>,
        /// Worker name used on AuxPoW pools.
        #[arg(short, long, default_value = "zion_worker")]
        worker: String,
        /// Disable the ZION canonical mining stream.
        #[arg(long)]
        no_zion: bool,
        /// Disable the GPU AuxPoW stream.
        #[arg(long)]
        no_gpu: bool,
        /// Disable the CPU AuxPoW stream.
        #[arg(long)]
        no_cpu: bool,
    },
}

#[derive(Parser)]
struct NodeArgs {
    /// SQLite database path.
    #[arg(short, long, default_value = "zion-node.db")]
    db_path: String,
    /// RPC bind address.
    #[arg(short, long, default_value = "127.0.0.1:9443")]
    rpc: SocketAddr,
    /// P2P bind address.
    #[arg(short, long, default_value = "0.0.0.0:8333")]
    p2p: SocketAddr,
    /// Humanitarian coinbase recipient.
    #[arg(long, default_value = "zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7")]
    human: String,
    /// Issobella coinbase recipient.
    #[arg(long, default_value = "zion1f7y7l5k678y0v408e8s654d2282346k375526t2")]
    issobella: String,
    /// Skip seeding the genesis block (used when importing a migration snapshot).
    #[arg(long, default_value_t = false)]
    no_genesis: bool,
    /// Seed peer(s) for P2P block sync. Repeat for multiple peers.
    #[arg(long, short = 'P')]
    peer: Vec<SocketAddr>,
}

#[derive(Parser)]
struct BridgeArgs {
    #[command(subcommand)]
    command: BridgeCommand,
}

#[derive(Subcommand)]
enum BridgeCommand {
    /// Lock native asset on source chain and mint wrapped asset on target.
    Lock {
        /// Source chain id.
        #[arg(short, long)]
        from: String,
        /// Target chain id.
        #[arg(short, long)]
        to: String,
        /// Amount in smallest units.
        #[arg(short, long)]
        amount: u128,
        /// Source / vault address (defaults to keyring address on source chain).
        #[arg(long)]
        source_address: Option<String>,
        /// Destination address (defaults to keyring address on target chain).
        #[arg(long)]
        target_address: Option<String>,
    },
    /// Burn wrapped asset on source chain and release native asset on target.
    Burn {
        /// Source chain id.
        #[arg(short, long)]
        from: String,
        /// Target chain id.
        #[arg(short, long)]
        to: String,
        /// Amount in smallest units.
        #[arg(short, long)]
        amount: u128,
        /// Source address (defaults to keyring address on source chain).
        #[arg(long)]
        source_address: Option<String>,
        /// Destination address (defaults to keyring address on target chain).
        #[arg(long)]
        target_address: Option<String>,
    },
}

#[derive(Parser)]
struct SwapArgs {
    #[command(subcommand)]
    command: SwapCommand,
}

#[derive(Subcommand)]
enum SwapCommand {
    /// Get a DEX quote.
    Quote {
        /// From asset, e.g. `zion-l1:ZION` or `base:USDC:0x...`.
        #[arg(short, long)]
        from: String,
        /// To asset.
        #[arg(short, long)]
        to: String,
        /// Amount in smallest units.
        #[arg(short, long)]
        amount: u128,
        /// Decimals override (default 6).
        #[arg(long)]
        decimals: Option<u8>,
    },
    /// Execute a DEX swap against the service router.
    Execute {
        /// From asset.
        #[arg(short, long)]
        from: String,
        /// To asset.
        #[arg(short, long)]
        to: String,
        /// Amount in smallest units.
        #[arg(short, long)]
        amount: u128,
        /// Decimals override (default 6).
        #[arg(long)]
        decimals: Option<u8>,
    },
}

fn load_config(path: Option<PathBuf>) -> anyhow::Result<MultichainConfig> {
    let path = path.unwrap_or_else(|| PathBuf::from("multichain.toml"));
    if !path.exists() {
        return Ok(MultichainConfig::default());
    }
    let text = std::fs::read_to_string(&path)?;
    let config: MultichainConfig = toml::from_str(&text)?;
    Ok(config)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();

    let config = load_config(cli.config)?;
    let server_config = config.server.clone();
    let service = Arc::new(MultichainService::new(config)?);

    match cli.command {
        Command::Menu => {
            menu::run_menu(&service).await?;
        }
        Command::Status => {
            println!("Registered chains: {:?}", service.chains());
            let health = service.health().await;
            for (chain, ok) in &health {
                println!("  {chain}: {}", if *ok { "ok" } else { "unreachable" });
            }
            if health.is_empty() {
                println!("No adapters enabled. Create a multichain.toml to connect to chains.");
            }
        }
        Command::Wallet(wallet) => match wallet.command {
            WalletCommand::Balance { chain, address } => {
                let chain_id = chain_name_to_id(&chain)?;
                let bytes = address_bytes(&chain_id, &address)?;
                let addr = Address::new(chain_id, bytes, address)?;
                let balance = service.balance(&addr).await?;
                println!("{chain}: {balance}");
            }
            WalletCommand::Address {
                chain,
                account,
                index,
            } => {
                let chain_id = chain_name_to_id(&chain)?;
                let addr = service.wallet_address(chain_id, account, index)?;
                println!("{}", addr.encoded);
            }
            WalletCommand::Sign {
                chain,
                message,
                account,
                index,
            } => {
                let chain_id = chain_name_to_id(&chain)?;
                let sig = service.wallet_sign(chain_id, message.as_bytes(), account, index)?;
                println!("0x{}", hex::encode(sig));
            }
            WalletCommand::Create { output, force } => {
                let path = output.unwrap_or_else(|| {
                    dirs::home_dir()
                        .unwrap_or_else(|| PathBuf::from("."))
                        .join(".zion")
                        .join("wallet.json")
                });
                if path.exists() && !force {
                    bail!("wallet file already exists: {} (use --force to overwrite)", path.display());
                }
                let (sk, pk) = zion_core::crypto::generate_keypair();
                let address = zion_core::crypto::derive_address(&pk.to_bytes());
                let sk_hex = zion_core::crypto::to_hex(&sk.to_bytes());
                let pk_hex = zion_core::crypto::to_hex(&pk.to_bytes());

                let wallet_json = serde_json::json!({
                    "address": address,
                    "public_key": pk_hex,
                    "secret_key": sk_hex,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                });

                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(&path, serde_json::to_string_pretty(&wallet_json)?)?;
                println!("Wallet created: {}", path.display());
                println!("Address: {}", address);
                println!("\nWARNING: Keep this file safe. Anyone with the secret key can spend your ZION.");
            }
            WalletCommand::Load { path } => {
                let path = path.unwrap_or_else(|| {
                    dirs::home_dir()
                        .unwrap_or_else(|| PathBuf::from("."))
                        .join(".zion")
                        .join("wallet.json")
                });
                if !path.exists() {
                    bail!("wallet file not found: {}", path.display());
                }
                let raw = std::fs::read_to_string(&path)?;
                let wallet: serde_json::Value = serde_json::from_str(&raw)?;
                let address = wallet["address"]
                    .as_str()
                    .ok_or_else(|| anyhow!("wallet file missing 'address' field"))?;
                let public_key = wallet["public_key"]
                    .as_str()
                    .ok_or_else(|| anyhow!("wallet file missing 'public_key' field"))?;
                println!("Wallet loaded: {}", path.display());
                println!("Address:     {}", address);
                println!("Public key:  {}", public_key);
            }
            WalletCommand::Send { wallet, to, amount, fee, memo, rpc, dry_run } => {
                let wallet_path = wallet.unwrap_or_else(|| {
                    dirs::home_dir()
                        .unwrap_or_else(|| PathBuf::from("."))
                        .join(".zion")
                        .join("wallet.json")
                });
                if !wallet_path.exists() {
                    bail!("wallet file not found: {}", wallet_path.display());
                }
                let raw = std::fs::read_to_string(&wallet_path)?;
                let wallet_data: serde_json::Value = serde_json::from_str(&raw)?;
                let sk_hex = wallet_data["secret_key"]
                    .as_str()
                    .ok_or_else(|| anyhow!("wallet file missing 'secret_key' field"))?;
                let sender_address = wallet_data["address"]
                    .as_str()
                    .ok_or_else(|| anyhow!("wallet file missing 'address' field"))?;

                // Reconstruct signing key
                let sk_bytes = zion_core::crypto::from_hex(sk_hex)
                    .ok_or_else(|| anyhow!("invalid secret key hex"))?;
                if sk_bytes.len() != 32 {
                    bail!("secret key must be 32 bytes, got {}", sk_bytes.len());
                }
                let mut sk_arr = [0u8; 32];
                sk_arr.copy_from_slice(&sk_bytes);
                let signing_key = ed25519_dalek::SigningKey::from_bytes(&sk_arr);

                // Convert ZION to flowers (6 decimals)
                let amount_flowers = (amount * 1_000_000.0) as u64;
                let fee_flowers = (fee * 1_000_000.0) as u64;

                println!("Sending {} ZION to {} (fee: {} ZION)", amount, to, fee);
                println!("From: {}", sender_address);
                if let Some(ref m) = memo {
                    println!("Memo: {}", m);
                }

                if dry_run {
                    println!("\n[Dry-run] Would build and sign transaction, but not broadcast.");
                    println!("Amount: {} flowers", amount_flowers);
                    println!("Fee:    {} flowers", fee_flowers);
                    return Ok(());
                }

                // Fetch UTXOs from L1 RPC
                let utxos = fetch_utxos(&rpc, sender_address).await?;
                if utxos.is_empty() {
                    bail!("no spendable UTXOs found for address {}", sender_address);
                }

                let total_available: u64 = utxos.iter().map(|u| u.amount).sum();
                println!("Available: {} flowers ({} UTXOs)", total_available, utxos.len());

                // Build and sign transaction
                let params = zion_core::v3_wallet::SendParams {
                    to_address: to.clone(),
                    amount: amount_flowers,
                    fee: fee_flowers,
                    memo: memo.clone(),
                };

                let result = zion_core::v3_wallet::build_and_sign(
                    &signing_key,
                    sender_address,
                    &params,
                    &utxos,
                    0, // chain tip height — TODO: fetch from RPC
                ).map_err(|e| anyhow!("wallet error: {}", e))?;

                println!("Transaction built and signed:");
                println!("  Change: {} flowers", result.change_amount);
                println!("  Inputs: {}", result.transaction.inputs.len());
                println!("  Outputs: {}", result.transaction.outputs.len());

                // Serialize transaction as JSON for RPC submission
                let tx_json = serde_json::to_value(&result.transaction)
                    .map_err(|e| anyhow!("failed to serialize transaction: {e}"))?;
                let tx_id = hex::encode(result.transaction.calculate_hash());
                println!("  TX hash: {}", tx_id);

                // Submit to L1 RPC
                match submit_tx_json(&rpc, &tx_json).await {
                    Ok(result) => println!("Broadcast OK. Result: {}", result),
                    Err(e) => bail!("broadcast failed: {}", e),
                }
            }
        },
        Command::Bridge(bridge) => {
            let (direction, from, to, amount, source_addr, target_addr) = match bridge.command {
                BridgeCommand::Lock {
                    from,
                    to,
                    amount,
                    source_address,
                    target_address,
                } => (
                    TransferDirection::LockMint,
                    from,
                    to,
                    amount,
                    source_address,
                    target_address,
                ),
                BridgeCommand::Burn {
                    from,
                    to,
                    amount,
                    source_address,
                    target_address,
                } => (
                    TransferDirection::BurnRelease,
                    from,
                    to,
                    amount,
                    source_address,
                    target_address,
                ),
            };
            let from_id = chain_name_to_id(&from)?;
            let to_id = chain_name_to_id(&to)?;
            let source = endpoint_from_cli(
                &service,
                from_id,
                source_addr,
                amount,
                default_ticker(from_id),
            )?;
            let target =
                endpoint_from_cli(&service, to_id, target_addr, amount, default_ticker(to_id))?;
            let id = format!(
                "cli-{}-{}-{}",
                from,
                to,
                std::time::SystemTime::now().elapsed()?.as_secs()
            );
            let mut transfer = Transfer::new(id, direction, source, target);
            let hash = service.bridge_submit(&mut transfer).await?;
            println!(
                "bridge transfer 0x{} -> status {:?}",
                hash.to_hex(),
                transfer.status
            );
        }
        Command::Swap(swap) => match swap.command {
            SwapCommand::Quote {
                from,
                to,
                amount,
                decimals,
            } => {
                let from_asset = parse_asset(&from, decimals)?;
                let to_asset = parse_asset(&to, decimals)?;
                let quote = service
                    .dex_quote(&from_asset, &to_asset, Amount::new(amount))
                    .await?;
                println!("route: {:?}", quote.route);
                println!("expected_out: {}", quote.expected_out.0);
                println!("slippage_bps: {}", quote.slippage_bps);
            }
            SwapCommand::Execute {
                from,
                to,
                amount,
                decimals,
            } => {
                let from_asset = parse_asset(&from, decimals)?;
                let to_asset = parse_asset(&to, decimals)?;
                let out = service
                    .dex_swap(&from_asset, &to_asset, Amount::new(amount))
                    .await?;
                println!("executed swap: out = {}", out.0);
            }
        },
        Command::Pool(pool) => match pool.command {
            PoolCommand::Status | PoolCommand::Shares => match service.pool_stats() {
                Some(stats) => println!("{}", serde_json::to_string_pretty(&stats)?),
                None => println!("Pool not configured."),
            },
            PoolCommand::Payouts => match service.pool_payouts() {
                Some(payouts) => println!("{}", serde_json::to_string_pretty(&payouts)?),
                None => println!("No payouts computed yet or pool not configured."),
            },
        },
        Command::Miner(miner) => match miner.command {
            MinerCommand::Start {
                reward_address,
                node_rpc_url,
                pool_url,
                auxpow_pool,
                worker,
                no_zion,
                no_gpu,
                no_cpu,
            } => {
                let reward_address = match reward_address {
                    Some(encoded) => Address::new(ChainId::ZionL1, vec![], encoded)?,
                    None => service.wallet_address(ChainId::ZionL1, 0, 0)?,
                };
                let mut miner_config = MinerConfig::new(reward_address);
                miner_config.node_rpc_url = node_rpc_url;
                miner_config.pool_url = pool_url;
                miner_config.auxpow_pool = auxpow_pool;
                miner_config.worker = worker;
                miner_config.stream1_enabled = !no_zion;
                miner_config.stream2_enabled = !no_gpu;
                miner_config.stream3_enabled = !no_cpu;

                let runtime = MinerRuntime::new(miner_config);
                let (shutdown_tx, shutdown_rx) = watch::channel(false);
                tokio::spawn(async move {
                    let _ = tokio::signal::ctrl_c().await;
                    let _ = shutdown_tx.send(true);
                });
                println!("Starting triple-stream miner. Press Ctrl-C to stop.");
                runtime.run(shutdown_rx).await?;
            }
        },
        Command::Doctor => {
            let health = service.health().await;
            let mut all_ok = true;
            for (chain, ok) in &health {
                println!("  {chain}: {}", if *ok { "ok" } else { "unreachable" });
                if !ok {
                    all_ok = false;
                }
            }
            if health.is_empty() {
                println!("No adapters configured.");
            } else if all_ok {
                println!("All configured adapters are reachable.");
            } else {
                bail!("One or more adapters are unreachable.");
            }
        }
        Command::Api => {
            println!(
                "Starting V31 HTTP API on {}:{}",
                server_config.bind, server_config.port
            );
            ApiServer::new(server_config, Arc::clone(&service))
                .run()
                .await?;
        }
        Command::Node(node) => {
            let human = Address::new(ChainId::ZionL1, vec![], &node.human)
                .map_err(|e| anyhow!("invalid human address: {e}"))?;
            let issobella = Address::new(ChainId::ZionL1, vec![], &node.issobella)
                .map_err(|e| anyhow!("invalid issobella address: {e}"))?;

            let node_config = NodeConfig {
                db_path: node.db_path,
                rpc_addr: node.rpc,
                p2p_addr: node.p2p,
                v3_p2p_addr: "0.0.0.0:0".parse().unwrap(),
                human_address: human,
                issobella_address: issobella,
                no_genesis: node.no_genesis,
                seed_peers: node.peer,
                v3_miner_address: String::new(),
                v3_humanitarian_address: String::new(),
                v3_issobella_address: String::new(),
                v3_no_genesis: false,
                v3_checkpoint_path: None,
            };

            println!(
                "Starting ZION L1 node; RPC={} P2P={}. Press Ctrl-C to stop.",
                node_config.rpc_addr, node_config.p2p_addr
            );

            let node = Arc::new(Node::new(node_config).await?);
            let (shutdown_tx, shutdown_rx) = watch::channel(false);
            tokio::spawn(async move {
                let _ = tokio::signal::ctrl_c().await;
                let _ = shutdown_tx.send(true);
            });

            node.run(shutdown_rx).await?;
        }
    }

    Ok(())
}

fn chain_name_to_id(name: &str) -> anyhow::Result<ChainId> {
    match name.to_lowercase().as_str() {
        "bitcoin" | "btc" => Ok(ChainId::Bitcoin),
        "base" => Ok(ChainId::Base),
        "ethereum" | "eth" => Ok(ChainId::Ethereum),
        "zion-l1" | "zion" | "zionl1" => Ok(ChainId::ZionL1),
        _ => bail!("unknown chain: {name}"),
    }
}

fn parse_asset(s: &str, decimals: Option<u8>) -> anyhow::Result<Asset> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() < 2 {
        bail!("asset format: chain:TICKER[:contract]");
    }
    let chain = chain_name_to_id(parts[0])?;
    let ticker = parts[1].to_string();
    let contract = parts.get(2).map(|c| c.to_string());
    let decimals = decimals.unwrap_or(6);
    let name = ticker.clone();
    Ok(Asset {
        id: zion_l1_types::AssetId::new(chain, ticker, contract),
        decimals,
        name,
    })
}

fn default_ticker(chain: ChainId) -> &'static str {
    match chain {
        ChainId::ZionL1 => "ZION",
        ChainId::Base => "wZION",
        ChainId::Ethereum => "ETH",
        ChainId::Bitcoin => "BTC",
        _ => "ZION",
    }
}

fn endpoint_from_cli(
    service: &MultichainService,
    chain: ChainId,
    encoded: Option<String>,
    amount: u128,
    ticker: &str,
) -> anyhow::Result<TransferEndpoint> {
    let address = match encoded {
        Some(e) => Address::new(chain, address_bytes(&chain, &e)?, e)?,
        None => service.wallet_address(chain, 0, 0)?,
    };
    let asset = Asset::native(chain, ticker, 6, ticker);
    Ok(TransferEndpoint {
        address,
        asset,
        amount: Amount::new(amount),
    })
}

fn address_bytes(chain_id: &ChainId, encoded: &str) -> anyhow::Result<Vec<u8>> {
    use zion_l1_types::ChainFamily;
    match chain_id.family() {
        ChainFamily::Evm => {
            let hex = encoded.strip_prefix("0x").unwrap_or(encoded);
            let mut out = [0u8; 20];
            hex::decode_to_slice(hex, &mut out)
                .map_err(|e| anyhow!("invalid EVM address hex: {e}"))?;
            Ok(out.to_vec())
        }
        _ => Ok(vec![]),
    }
}

/// Fetch spendable UTXOs for an address from the L1 RPC.
async fn fetch_utxos(
    rpc_url: &str,
    address: &str,
) -> anyhow::Result<Vec<zion_core::v3_wallet::SpendableUtxo>> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    let mut stream = TcpStream::connect(rpc_url).await?;
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "get_utxos",
        "params": {"address": address},
        "id": 1
    });
    let request_str = serde_json::to_string(&request)?;
    stream.write_all(request_str.as_bytes()).await?;
    stream.write_all(b"\n").await?;
    stream.flush().await?;

    let mut buf = Vec::new();
    stream.read_to_end(&mut buf).await?;
    let response: serde_json::Value = serde_json::from_slice(&buf)?;

    let utxos = response["result"]["utxos"]
        .as_array()
        .ok_or_else(|| anyhow!("no utxos field in RPC response"))?;

    let result: Vec<zion_core::v3_wallet::SpendableUtxo> = utxos
        .iter()
        .filter_map(|u| {
            let tx_hash_hex = u["tx_hash"].as_str()?;
            let output_index = u["output_index"].as_u64()? as u32;
            let amount = u["amount"].as_u64()?;
            let tx_hash = hex::decode(tx_hash_hex).ok()?;
            if tx_hash.len() != 32 {
                return None;
            }
            let mut hash_arr = [0u8; 32];
            hash_arr.copy_from_slice(&tx_hash);
            Some(zion_core::v3_wallet::SpendableUtxo {
                tx_hash: hash_arr,
                output_index,
                amount,
                address: address.to_string(),
            })
        })
        .collect();

    Ok(result)
}

/// Submit a signed transaction (as JSON) to the L1 RPC.
async fn submit_tx_json(rpc_url: &str, tx_json: &serde_json::Value) -> anyhow::Result<String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    let mut stream = TcpStream::connect(rpc_url).await?;
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "submitTransaction",
        "params": tx_json,
        "id": 1
    });
    let request_str = serde_json::to_string(&request)?;
    stream.write_all(request_str.as_bytes()).await?;
    stream.write_all(b"\n").await?;
    stream.flush().await?;

    let mut buf = Vec::new();
    stream.read_to_end(&mut buf).await?;
    let response: serde_json::Value = serde_json::from_slice(&buf)?;

    if let Some(err) = response["error"].as_str() {
        bail!("RPC error: {}", err);
    }
    if let Some(err) = response["error"]["message"].as_str() {
        bail!("RPC error: {}", err);
    }

    let result = response["result"]
        .to_string();

    Ok(result)
}
