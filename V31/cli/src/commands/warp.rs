use anyhow::Result;
use clap::Subcommand;

use crate::rpc::agent_rpc;
use crate::ui;

#[derive(Subcommand)]
pub enum WarpCmd {
    /// Warp bridge service health
    Status,
    /// List registered warp routes
    Routes,
    /// Show pending warp transfers
    Pending,
    /// Estimate warp fee for a transfer
    Estimate {
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long)]
        amount: u128,
    },
    /// WARP Beta — native ZION↔BTC atomic swaps (served on warp port + 1)
    BtcSwap {
        #[command(subcommand)]
        cmd: BtcSwapCmd,
    },
}

#[derive(Subcommand)]
pub enum BtcSwapCmd {
    /// Register a swap offer; returns the per-swap BTC HTLC address.
    Offer {
        /// `btc_to_zion` (you deposit BTC) or `zion_to_btc` (you deposit ZION).
        #[arg(long)]
        direction: String,
        /// 32-byte hashlock hex (SHA-256 of your preimage).
        #[arg(long)]
        hash: String,
        #[arg(long)]
        btc_sats: u64,
        #[arg(long)]
        zion_flowers: u64,
        /// Your compressed BTC pubkey (33-byte hex).
        #[arg(long)]
        btc_pubkey: String,
        /// Your ZION Ed25519 pubkey (32-byte hex).
        #[arg(long)]
        zion_pubkey: String,
        #[arg(long)]
        zion_address: String,
        /// ZION-leg timeout (UNIX seconds).
        #[arg(long)]
        zion_timeout: u64,
        /// Required for `zion_to_btc`: your ZION lock txid.
        #[arg(long)]
        zion_lock_txid: Option<String>,
        /// Operator approval key; prefer WARP_BTC_SWAP_OFFER_KEY over a CLI argument.
        #[arg(long, env = "WARP_BTC_SWAP_OFFER_KEY")]
        offer_key: String,
    },
    /// List all BTC swaps tracked by this warp node.
    List,
    /// Show one swap by id (hashlock hex).
    Status { id: String },
}

/// The BTC swap API lives on the DEX port (warp listen_port + 1).
fn dex_url(warp_url: &str) -> String {
    match reqwest::Url::parse(warp_url) {
        Ok(mut u) => {
            if let Some(p) = u.port() {
                let _ = u.set_port(Some(p.saturating_add(1)));
            }
            u.to_string().trim_end_matches('/').to_string()
        }
        Err(_) => warp_url.trim_end_matches('/').to_string(),
    }
}

pub async fn run(cmd: WarpCmd, warp_url: &str) -> Result<()> {
    let url = warp_url.trim_end_matches('/').to_string();

    match cmd {
        WarpCmd::Status => {
            ui::print_header("ZION Warp Bridge (L2)");
            match agent_rpc::health(&url).await {
                Ok(true) => ui::print_ok(&format!("Warp service online at {}", url)),
                _ => ui::print_err(&format!("Warp unreachable at {}", url)),
            }
            println!();
        }
        WarpCmd::Routes => {
            ui::print_header("Warp Routes");
            match agent_rpc::get(&url, "warp/routes").await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Failed: {}", e)),
            }
            println!();
        }
        WarpCmd::Pending => {
            ui::print_header("Pending Warp Transfers");
            match agent_rpc::get(&url, "warp/pending").await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Failed: {}", e)),
            }
            println!();
        }
        WarpCmd::Estimate { from, to, amount } => {
            ui::print_header("Warp Fee Estimate");
            let body = serde_json::json!({ "from": from, "to": to, "amount": amount });
            match agent_rpc::post(&url, "warp/estimate", body).await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Failed: {}", e)),
            }
            println!();
        }
        WarpCmd::BtcSwap { cmd } => {
            let dex = dex_url(&url);
            match cmd {
                BtcSwapCmd::Offer {
                    direction,
                    hash,
                    btc_sats,
                    zion_flowers,
                    btc_pubkey,
                    zion_pubkey,
                    zion_address,
                    zion_timeout,
                    zion_lock_txid,
                    offer_key,
                } => {
                    ui::print_header("WARP Beta — BTC↔ZION Swap Offer");
                    let body = serde_json::json!({
                        "direction": direction,
                        "hash_hex": hash,
                        "btc_sats": btc_sats,
                        "zion_flowers": zion_flowers,
                        "user_btc_pubkey_hex": btc_pubkey,
                        "user_zion_pubkey_hex": zion_pubkey,
                        "user_zion_address": zion_address,
                        "zion_timeout_ts": zion_timeout,
                        "user_zion_lock_txid": zion_lock_txid,
                    });
                    match agent_rpc::post_warp_auth(
                        &dex,
                        "v1/multichain/swaps/btc/offer",
                        body,
                        &offer_key,
                    )
                    .await
                    {
                        Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                        Err(e) => ui::print_warn(&format!("Failed: {}", e)),
                    }
                    println!();
                }
                BtcSwapCmd::List => {
                    ui::print_header("WARP Beta — BTC↔ZION Swaps");
                    match agent_rpc::get(&dex, "v1/multichain/swaps/btc/list").await {
                        Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                        Err(e) => ui::print_warn(&format!("Failed: {}", e)),
                    }
                    println!();
                }
                BtcSwapCmd::Status { id } => {
                    ui::print_header(&format!("BTC↔ZION Swap {}", id));
                    match agent_rpc::get(&dex, &format!("v1/multichain/swaps/btc/{}", id)).await {
                        Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                        Err(e) => ui::print_warn(&format!("Failed: {}", e)),
                    }
                    println!();
                }
            }
        }
    }
    Ok(())
}
