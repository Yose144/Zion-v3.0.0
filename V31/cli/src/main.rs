use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, bail, Context};
use clap::{Parser, Subcommand};
use tokio::sync::watch;

use std::net::SocketAddr;
use zion_l1_types::{Address, Amount, Asset, ChainId};

mod commands;
mod menu;
mod rpc;
mod ui;

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
pub struct Cli {
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
    /// Start / stop / status the ZION L1 node.
    Node(NodeArgs),
    /// Manage V31 systemd services (start/stop/status/restart/logs).
    Service(ServiceArgs),
    /// DAO governance commands.
    Dao(DaoArgs),
    /// Atomic swap (HTLC) commands.
    AtomicSwap(AtomicSwapArgs),
    /// Warp bridge commands.
    Warp(WarpArgs),
    /// Monitor service health.
    Monitor(MonitorArgs),
    /// Network topology — peers, chains, bridges.
    Topology(TopologyArgs),
    /// Block explorer — query blocks, transactions, addresses.
    Explorer(ExplorerArgs),
    /// First-run onboarding wizard.
    Onboard(OnboardArgs),
    /// Deploy smart contracts.
    Deploy(DeployArgs),
    /// Self-update the ZION CLI.
    Update(UpdateArgs),
    /// Docker Compose management.
    Compose(ComposeArgs),
    /// Shell completions.
    Completions {
        /// Shell (bash, zsh, fish, powershell, elvish)
        shell: clap_complete::Shell,
    },
    /// AI Agent commands (L4 — not yet migrated).
    Agent(AgentArgs),
    /// Hiran AI oracle commands (L4 — not yet migrated).
    Hiran(HiranArgs),
    /// Issobella layer commands (L5 — not yet migrated).
    Issobella(IssobellaArgs),
    /// Free World layer commands (L5 — not yet migrated).
    FreeWorld(FreeWorldArgs),
    /// NCL (Network Command Layer) commands (not yet migrated).
    Ncl(NclArgs),
    /// AuxPoW commands (integrated into miner).
    Auxpow(AuxpowArgs),
}

// ── Wrapper arg structs for subcommand modules ─────────────────────────────

#[derive(Parser)]
struct DaoArgs {
    #[command(subcommand)]
    command: commands::dao::DaoCmd,
}

#[derive(Parser)]
struct AtomicSwapArgs {
    #[command(subcommand)]
    command: commands::atomic_swap::AtomicSwapCmd,
}

#[derive(Parser)]
struct WarpArgs {
    #[command(subcommand)]
    command: commands::warp::WarpCmd,
}

#[derive(Parser)]
struct MonitorArgs {
    #[command(subcommand)]
    command: commands::monitor::MonitorCmd,
}

#[derive(Parser)]
struct TopologyArgs {
    #[command(subcommand)]
    command: commands::topology::TopologyCmd,
}

#[derive(Parser)]
struct ExplorerArgs {
    #[command(subcommand)]
    command: commands::explorer::ExplorerCmd,
}

#[derive(Parser)]
struct OnboardArgs {
    #[command(subcommand)]
    command: commands::onboard::OnboardCmd,
}

#[derive(Parser)]
struct DeployArgs {
    #[command(subcommand)]
    command: commands::deploy::DeployCmd,
}

#[derive(Parser)]
struct UpdateArgs {
    #[command(subcommand)]
    command: commands::update::UpdateCmd,
}

#[derive(Parser)]
struct ComposeArgs {
    #[command(subcommand)]
    command: commands::compose::ComposeCmd,
}

#[derive(Parser)]
struct AgentArgs {
    #[command(subcommand)]
    command: commands::agent::AgentCmd,
}

#[derive(Parser)]
struct HiranArgs {
    #[command(subcommand)]
    command: commands::hiran::HiranCmd,
}

#[derive(Parser)]
struct IssobellaArgs {
    #[command(subcommand)]
    command: commands::issobella::IssobellaCmd,
}

#[derive(Parser)]
struct FreeWorldArgs {
    #[command(subcommand)]
    command: commands::free_world::FreeWorldCmd,
}

#[derive(Parser)]
struct NclArgs {
    #[command(subcommand)]
    command: commands::ncl::NclCmd,
}

#[derive(Parser)]
struct AuxpowArgs {
    #[command(subcommand)]
    command: commands::auxpow::AuxpowCmd,
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
    /// Send ZION from a wallet file or raw secret key to an address.
    Send {
        /// Wallet file path (default: ~/.zion/wallet.json).
        #[arg(short, long)]
        wallet: Option<PathBuf>,
        /// Sender secret key as hex (64 characters). Derives sender address.
        #[arg(long)]
        secret_key_hex: Option<String>,
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
    /// Start the pool systemd service.
    Start,
    /// Stop the pool systemd service.
    Stop,
    /// Show the pool systemd service status.
    Status,
    /// Show pool statistics (accepted/rejected shares and config).
    Stats,
    /// Show the latest computed PPLNS payouts.
    Payouts,
    /// Show pool share statistics (same as stats).
    Shares,
}

#[derive(Parser)]
struct ServiceArgs {
    #[command(subcommand)]
    command: ServiceCommand,
}

#[derive(Subcommand)]
enum ServiceCommand {
    /// Start one or all V31 services.
    Start {
        /// Service name (node, pool, miner, multichain, dao, all). Default: all.
        #[arg(default_value = "all")]
        service: String,
    },
    /// Stop one or all V31 services.
    Stop {
        /// Service name (node, pool, miner, multichain, dao, all). Default: all.
        #[arg(default_value = "all")]
        service: String,
    },
    /// Restart one or all V31 services.
    Restart {
        /// Service name (node, pool, miner, multichain, dao, all). Default: all.
        #[arg(default_value = "all")]
        service: String,
    },
    /// Show status of one or all V31 services.
    Status {
        /// Service name (node, pool, miner, multichain, dao, all). Default: all.
        #[arg(default_value = "all")]
        service: String,
    },
    /// Show recent logs for a service.
    Logs {
        /// Service name (node, pool, miner, multichain, dao).
        #[arg()]
        service: String,
        /// Number of lines to show (default: 50).
        #[arg(short, long, default_value = "50")]
        lines: usize,
    },
}

#[derive(Parser)]
struct MinerArgs {
    #[command(subcommand)]
    command: MinerCommand,
}

#[derive(Subcommand)]
enum MinerCommand {
    /// Start the triple-stream miner (ZION + AuxPoW GPU + AuxPoW CPU).
    Start(MinerStartArgs),
    /// Stop the miner systemd service.
    Stop,
    /// Show the miner systemd service status.
    Status,
}

#[derive(Parser)]
struct MinerStartArgs {
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
}

#[derive(Parser)]
struct NodeArgs {
    #[command(subcommand)]
    command: NodeCommand,
}

#[derive(Subcommand)]
enum NodeCommand {
    /// Start the ZION L1 node in the foreground.
    Start(NodeStartArgs),
    /// Stop the ZION L1 node via systemctl.
    Stop,
    /// Show systemd status for the ZION L1 node.
    Status,
    /// Restart the ZION L1 node via systemctl.
    Restart,
}

#[derive(Parser)]
struct NodeStartArgs {
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
    #[arg(long, default_value = "zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8")]
    human: String,
    /// Issobella coinbase recipient.
    #[arg(long, default_value = "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0")]
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
            WalletCommand::Send { wallet, secret_key_hex, to, amount, fee, memo, rpc, dry_run } => {
                // Reconstruct signing key and determine sender address
                let (signing_key, sender_address) = if let Some(sk_hex) = secret_key_hex {
                    let sk_bytes = zion_core::crypto::from_hex(&sk_hex)
                        .ok_or_else(|| anyhow!("invalid secret key hex"))?;
                    if sk_bytes.len() != 32 {
                        bail!("secret key must be 32 bytes, got {}", sk_bytes.len());
                    }
                    let mut sk_arr = [0u8; 32];
                    sk_arr.copy_from_slice(&sk_bytes);
                    let signing_key = ed25519_dalek::SigningKey::from_bytes(&sk_arr);
                    let sender_address =
                        zion_core::crypto::derive_address(&signing_key.verifying_key().to_bytes());
                    (signing_key, sender_address)
                } else {
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
                    let sk_bytes = zion_core::crypto::from_hex(sk_hex)
                        .ok_or_else(|| anyhow!("invalid secret key hex"))?;
                    if sk_bytes.len() != 32 {
                        bail!("secret key must be 32 bytes, got {}", sk_bytes.len());
                    }
                    let mut sk_arr = [0u8; 32];
                    sk_arr.copy_from_slice(&sk_bytes);
                    let signing_key = ed25519_dalek::SigningKey::from_bytes(&sk_arr);
                    (signing_key, sender_address.to_string())
                };

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
                let utxos = fetch_utxos(&rpc, &sender_address).await?;
                if utxos.is_empty() {
                    bail!("no spendable UTXOs found for address {}", sender_address);
                }

                let total_available: u64 = utxos.iter().map(|u| u.amount).sum();
                println!("Available: {} flowers ({} UTXOs)", total_available, utxos.len());

                // Build and sign V31 native UTXO transaction. `--memo` is stored
                // as raw UTF-8 bytes in the transaction and is part of the
                // signed payload (Transaction::signing_hash includes memo).
                let memo_bytes = memo.as_deref().unwrap_or("").as_bytes();
                let result = zion_core::build_send_with_memo(
                    &signing_key,
                    &sender_address,
                    &to,
                    amount_flowers,
                    fee_flowers,
                    &utxos,
                    memo_bytes,
                )
                .map_err(|e| anyhow!("wallet error: {}", e))?;

                println!("Transaction built and signed:");
                println!("  Change: {} flowers", result.change_amount);
                println!("  Inputs: {}", result.transaction.inputs.len());
                println!("  Outputs: {}", result.transaction.outputs.len());

                // Serialize transaction as JSON for RPC submission
                let tx_json = serde_json::to_value(&result.transaction)
                    .map_err(|e| anyhow!("failed to serialize transaction: {e}"))?;
                let tx_id = hex::encode(result.transaction.hash().0);
                println!("  TX hash: {}", tx_id);

                // Submit to L1 RPC
                match submit_utxo_tx_json(&rpc, &tx_json).await {
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
            PoolCommand::Start => systemctl_all("start", "pool")?,
            PoolCommand::Stop => systemctl_all("stop", "pool")?,
            PoolCommand::Status => service_status("pool")?,
            PoolCommand::Stats | PoolCommand::Shares => match service.pool_stats() {
                Some(stats) => println!("{}", serde_json::to_string_pretty(&stats)?),
                None => println!("Pool not configured."),
            },
            PoolCommand::Payouts => match service.pool_payouts() {
                Some(payouts) => println!("{}", serde_json::to_string_pretty(&payouts)?),
                None => println!("No payouts computed yet or pool not configured."),
            },
        },
        Command::Miner(miner) => match miner.command {
            MinerCommand::Start(args) => {
                let reward_address = match args.reward_address {
                    Some(encoded) => Address::new(ChainId::ZionL1, vec![], &encoded)?,
                    None => service.wallet_address(ChainId::ZionL1, 0, 0)?,
                };
                let mut miner_config = MinerConfig::new(reward_address);
                miner_config.node_rpc_url = args.node_rpc_url;
                miner_config.pool_url = args.pool_url;
                miner_config.auxpow_pool = args.auxpow_pool;
                miner_config.worker = args.worker;
                miner_config.stream1_enabled = !args.no_zion;
                miner_config.stream2_enabled = !args.no_gpu;
                miner_config.stream3_enabled = !args.no_cpu;

                let runtime = MinerRuntime::new(miner_config);
                let (shutdown_tx, shutdown_rx) = watch::channel(false);
                tokio::spawn(async move {
                    let _ = tokio::signal::ctrl_c().await;
                    let _ = shutdown_tx.send(true);
                });
                println!("Starting triple-stream miner. Press Ctrl-C to stop.");
                runtime.run(shutdown_rx).await?;
            }
            MinerCommand::Stop => systemctl_all("stop", "miner")?,
            MinerCommand::Status => service_status("miner")?,
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
        Command::Node(node) => match node.command {
            NodeCommand::Start(args) => {
                let human = Address::new(ChainId::ZionL1, vec![], &args.human)
                    .map_err(|e| anyhow!("invalid human address: {e}"))?;
                let issobella = Address::new(ChainId::ZionL1, vec![], &args.issobella)
                    .map_err(|e| anyhow!("invalid issobella address: {e}"))?;

                let node_config = NodeConfig {
                    db_path: args.db_path,
                    rpc_addr: args.rpc,
                    p2p_addr: args.p2p,
                    v3_p2p_addr: "0.0.0.0:0".parse().unwrap(),
                    human_address: human,
                    issobella_address: issobella,
                    no_genesis: args.no_genesis,
                    seed_peers: args.peer,
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
            NodeCommand::Stop => systemctl_all("stop", "node")?,
            NodeCommand::Status => service_status("node")?,
            NodeCommand::Restart => systemctl_all("restart", "node")?,
        },
        Command::Service(svc) => handle_service_command(svc)?,
        Command::Dao(args) => commands::dao::run(args.command, "http://127.0.0.1:8092").await?,
        Command::AtomicSwap(args) => commands::atomic_swap::run(args.command, "http://127.0.0.1:8093").await?,
        Command::Warp(args) => commands::warp::run(args.command, "http://127.0.0.1:8453").await?,
        Command::Monitor(args) => {
            commands::monitor::run(args.command, "127.0.0.1:9445", "127.0.0.1:8444", "127.0.0.1:8453", "127.0.0.1:8092").await?;
        }
        Command::Topology(args) => commands::topology::run(args.command, "127.0.0.1:9445", "127.0.0.1:8453").await?,
        Command::Explorer(args) => commands::explorer::run(args.command, "127.0.0.1:9445").await?,
        Command::Onboard(args) => commands::onboard::run(args.command).await?,
        Command::Deploy(args) => commands::deploy::run(args.command).await?,
        Command::Update(args) => commands::update::run(args.command).await?,
        Command::Compose(args) => commands::compose::run(args.command).await?,
        Command::Completions { shell } => commands::completions::run(shell)?,
        Command::Agent(args) => commands::agent::run(args.command).await?,
        Command::Hiran(args) => commands::hiran::run(args.command).await?,
        Command::Issobella(args) => commands::issobella::run(args.command).await?,
        Command::FreeWorld(args) => commands::free_world::run(args.command).await?,
        Command::Ncl(args) => commands::ncl::run(args.command).await?,
        Command::Auxpow(args) => commands::auxpow::run(args.command).await?,
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

/// Strip any URL scheme/path from an RPC endpoint so it can be used
/// with `tokio::net::TcpStream::connect`.
fn clean_rpc_url(rpc_url: &str) -> &str {
    let s = rpc_url.trim();
    let s = s
        .strip_prefix("http://")
        .or(s.strip_prefix("https://"))
        .unwrap_or(s);
    s.split_once('/').map(|(h, _)| h).unwrap_or(s)
}

/// Send a single JSON-RPC request and read the first response line.
async fn rpc_call_line(rpc_url: &str, request: &serde_json::Value) -> anyhow::Result<serde_json::Value> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpStream;

    let url = clean_rpc_url(rpc_url);
    let mut stream = TcpStream::connect(url)
        .await
        .with_context(|| format!("failed to connect to RPC at {url}"))?;

    let payload = format!("{}\n", serde_json::to_string(request)?);
    stream.write_all(payload.as_bytes()).await?;
    stream.flush().await?;

    let (reader, _) = stream.split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .with_context(|| "failed to read RPC response")?;

    serde_json::from_str(&line).with_context(|| "failed to parse RPC response")
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
) -> anyhow::Result<Vec<zion_core::v31_wallet::SpendableUtxo>> {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "getUtxos",
        "params": {"address": address},
        "id": 1
    });
    let response = rpc_call_line(rpc_url, &request).await?;

    if let Some(err) = response["error"]["message"].as_str() {
        bail!("getUtxos error: {}", err);
    }

    let utxos = response["result"]["utxos"]
        .as_array()
        .ok_or_else(|| anyhow!("no utxos field in RPC response"))?;

    let result: Vec<zion_core::v31_wallet::SpendableUtxo> = utxos
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
            Some(zion_core::v31_wallet::SpendableUtxo {
                tx_hash: hash_arr,
                output_index,
                amount,
                address: address.to_string(),
            })
        })
        .collect();

    Ok(result)
}

/// Submit a signed V31 native UTXO transaction to the L1 RPC.
async fn submit_utxo_tx_json(rpc_url: &str, tx_json: &serde_json::Value) -> anyhow::Result<String> {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "submitUtxoTransaction",
        "params": {"transaction": tx_json},
        "id": 1
    });
    let response = rpc_call_line(rpc_url, &request).await?;

    if let Some(err) = response["error"]["message"].as_str() {
        bail!("submitUtxoTransaction error: {}", err);
    }

    let result = response["result"].to_string();
    Ok(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// Service lifecycle management (systemd)
// ─────────────────────────────────────────────────────────────────────────────

/// Map a service name to its systemd unit name.
fn service_unit(name: &str) -> anyhow::Result<String> {
    let unit = match name.to_lowercase().as_str() {
        "node" | "l1" => "zion-v31-node.service",
        "pool" => "zion-v31-pool.service",
        "miner" => "zion-v31-miner.service",
        "multichain" | "mc" => "zion-v31-multichain.service",
        "dao" => "zion-v31-dao.service",
        "all" => "all",
        other => bail!("unknown service: {} (valid: node, pool, miner, multichain, dao, all)", other),
    };
    Ok(unit.to_string())
}

/// All V31 service unit names.
const ALL_SERVICES: &[&str] = &[
    "zion-v31-node.service",
    "zion-v31-pool.service",
    "zion-v31-miner.service",
    "zion-v31-multichain.service",
    "zion-v31-dao.service",
];

/// Run systemctl on one or all services.
fn systemctl_all(action: &str, service: &str) -> anyhow::Result<()> {
    let unit = service_unit(service)?;
    if unit == "all" {
        for svc in ALL_SERVICES {
            println!("systemctl {} {}...", action, svc);
            let output = std::process::Command::new("systemctl")
                .arg(action)
                .arg(svc)
                .output();
            match output {
                Ok(o) if o.status.success() => println!("  ✓ {} — OK", svc),
                Ok(o) => {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    println!("  ✗ {} — {}", svc, stderr.trim());
                }
                Err(e) => println!("  ✗ {} — {}", svc, e),
            }
        }
    } else {
        println!("systemctl {} {}...", action, unit);
        let output = std::process::Command::new("systemctl")
            .arg(action)
            .arg(&unit)
            .output()
            .map_err(|e| anyhow!("failed to run systemctl: {e}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            bail!("systemctl {} {} failed: {}", action, unit, stderr.trim());
        }
        println!("  ✓ {} — OK", unit);
    }
    Ok(())
}

/// Show status of one or all services.
fn service_status(service: &str) -> anyhow::Result<()> {
    let unit = service_unit(service)?;
    if unit == "all" {
        for svc in ALL_SERVICES {
            let active = std::process::Command::new("systemctl")
                .args(["is-active", "--quiet", svc])
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            let status = if active { "active" } else { "inactive" };
            println!("  {:30} {}", svc, status);
        }
    } else {
        let output = std::process::Command::new("systemctl")
            .arg("status")
            .arg(&unit)
            .output()
            .map_err(|e| anyhow!("failed to run systemctl: {e}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("{}", stdout);
    }
    Ok(())
}

/// Show recent logs for a service.
fn service_logs(service: &str, lines: usize) -> anyhow::Result<()> {
    let unit = service_unit(service)?;
    if unit == "all" {
        bail!("logs requires a specific service name, not 'all'");
    }
    let output = std::process::Command::new("journalctl")
        .args(["-u", &unit, "--no-pager", "-n"])
        .arg(lines.to_string())
        .output()
        .map_err(|e| anyhow!("failed to run journalctl: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("{}", stdout);
    Ok(())
}

/// Handle the service subcommand.
fn handle_service_command(svc: ServiceArgs) -> anyhow::Result<()> {
    match svc.command {
        ServiceCommand::Start { service } => systemctl_all("start", &service),
        ServiceCommand::Stop { service } => systemctl_all("stop", &service),
        ServiceCommand::Restart { service } => systemctl_all("restart", &service),
        ServiceCommand::Status { service } => service_status(&service),
        ServiceCommand::Logs { service, lines } => service_logs(&service, lines),
    }
}
