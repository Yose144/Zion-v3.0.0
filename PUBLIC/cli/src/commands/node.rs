//! Read-only node queries — chain info, peers, supply, node info.
//!
//! All queries go through `zion_sdk::NodeClient` (TCP JSON-RPC, same wire format
//! as the operator CLI). No write operations, no admin commands.

use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::ui;

#[derive(Subcommand)]
pub enum NodeCmd {
    /// Show node info (version, network, bind addresses, peer count)
    Info,
    /// Show chain info (height, tip hash, mempool size)
    Chain,
    /// Show connected peers
    Peers,
    /// Show supply info (total supply, mined, remaining, block reward)
    Supply,
    /// Show mempool info
    Mempool,
}

pub async fn run(cfg: &Config, cmd: NodeCmd) -> Result<()> {
    let client = zion_sdk::node::NodeClient::builder(&cfg.node.rpc_host, cfg.node.rpc_port)
        .build();

    match cmd {
        NodeCmd::Info => {
            ui::print_header("Node Info");
            match client.node_info().await {
                Ok(info) => {
                    ui::print_row("Node ID", &info.node_id);
                    ui::print_row("Protocol", &info.protocol_version);
                    ui::print_row("Network", &info.network);
                    ui::print_row("Chain height", &info.chain_height.to_string());
                    ui::print_row("P2P bind", &info.p2p_bind);
                    ui::print_row("RPC bind", &info.rpc_bind);
                    ui::print_row("Pool bind", &info.pool_bind);
                    ui::print_row("Known peers", &info.known_peers.to_string());
                    ui::print_row("Accepted blocks", &info.accepted_blocks.to_string());
                    ui::print_row("Mempool txs", &info.mempool_transactions.to_string());
                    ui::print_row("TX model", &info.transaction_model);
                }
                Err(e) => ui::print_err(&format!("Cannot reach node: {}", e)),
            }
            println!();
            Ok(())
        }
        NodeCmd::Chain => {
            ui::print_header("Chain Info");
            match client.chain_info().await {
                Ok(chain) => {
                    ui::print_row("Network", &chain.network);
                    ui::print_row("Consensus", &chain.consensus_profile);
                    ui::print_row("Height", &chain.chain_height.to_string());
                    ui::print_row("Tip hash", &chain.tip_hash_hex);
                    ui::print_row("Accepted blocks", &chain.accepted_blocks.to_string());
                    ui::print_row("Mempool txs", &chain.mempool_transactions.to_string());
                    ui::print_row("Protocol", &chain.protocol_version);
                    ui::print_row("TX model", &chain.transaction_model);
                }
                Err(e) => ui::print_err(&format!("Cannot reach node: {}", e)),
            }
            println!();
            Ok(())
        }
        NodeCmd::Peers => {
            ui::print_header("Connected Peers");
            match client.peer_info().await {
                Ok(peer_info) => {
                    ui::print_row("Peer count", &peer_info.count.to_string());
                    println!();
                    for (i, peer) in peer_info.peers.iter().enumerate() {
                        println!(
                            "  {:>3}. {}:{} — {}",
                            i + 1,
                            peer.host,
                            peer.port,
                            peer.address
                        );
                    }
                    if peer_info.peers.is_empty() {
                        ui::print_warn("No peers connected.");
                    }
                }
                Err(e) => ui::print_err(&format!("Cannot reach node: {}", e)),
            }
            println!();
            Ok(())
        }
        NodeCmd::Supply => {
            ui::print_header("Supply Info");
            match client.supply_info().await {
                Ok(supply) => {
                    ui::print_row("Total supply", &format!("{} ZION", supply.total_supply_zion));
                    ui::print_row("Premine", &format!("{} ZION", supply.premine_zion));
                    ui::print_row("Mining emission", &format!("{} ZION", supply.mining_emission_zion));
                    ui::print_row("Mined so far", &format!("{} ZION", supply.mined_so_far_zion));
                    ui::print_row("Mined %", &supply.supply_mined_percent);
                    ui::print_row("Circulating", &format!("{} ZION", supply.circulating_supply_zion));
                    ui::print_row("Remaining", &format!("{} ZION", supply.remaining_supply_zion));
                    ui::print_row("Block reward", &format!("{:.6} ZION", supply.block_reward_zion));
                    ui::print_row("Height", &supply.height.to_string());
                }
                Err(e) => ui::print_err(&format!("Cannot reach node: {}", e)),
            }
            println!();
            Ok(())
        }
        NodeCmd::Mempool => {
            ui::print_header("Mempool");
            match client.mempool_info().await {
                Ok(mp) => {
                    ui::print_row("Size", &mp.size.to_string());
                    ui::print_row("Template txs", &mp.template_transactions.to_string());
                    ui::print_row("Template fees", &format!("{} ZION", mp.template_total_fees_zion));
                    ui::print_row("TX model", &mp.transaction_model);
                }
                Err(e) => ui::print_err(&format!("Cannot reach node: {}", e)),
            }
            println!();
            Ok(())
        }
    }
}
