use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::rpc::agent_rpc;
use crate::ui;

fn swap_url(cfg: &Config) -> String {
    format!("http://{}:{}/api/swap", cfg.swap_host(), cfg.swap.port)
}

#[derive(Subcommand)]
pub enum SwapCmd {
    /// Swap service health
    Status,
    /// Get a price quote (no execution)
    Quote {
        /// Input token (e.g. ZION, wZION, ETH, USDC)
        #[arg(long, default_value = "ZION")]
        from: String,
        /// Output token
        #[arg(long, default_value = "USDC")]
        to: String,
        /// Amount to swap (human-readable)
        #[arg(long)]
        amount: f64,
    },
    /// Execute a swap
    Execute {
        /// Quote ID from previous `quote` command
        #[arg(long)]
        quote_id: String,
        /// Confirm without prompt
        #[arg(long)]
        yes: bool,
    },
    /// List recent swaps
    History {
        #[arg(default_value = "10")]
        n: u64,
    },
    /// Get swap by ID
    Get { id: String },
}

pub async fn run(cfg: &Config, cmd: SwapCmd) -> Result<()> {
    let url = swap_url(cfg);

    match cmd {
        SwapCmd::Status => {
            ui::print_header("ZION Swap Aggregator (L2)");
            let alive = agent_rpc::health(&url).await.unwrap_or(false);
            if alive {
                ui::print_ok(&format!("Swap aggregator online at {}", url));
                let v = agent_rpc::get(&url, "health").await;
                if let Ok(v) = v {
                    if let Some(pairs) = v["supported_pairs"].as_array() {
                        let names: Vec<&str> = pairs.iter().filter_map(|c| c.as_str()).collect();
                        ui::print_row("Pairs", &names.join(", "));
                    }
                    if let Some(vol) = v["daily_volume"].as_f64() {
                        ui::print_row("24h volume", &format!("{:.2} ZION", vol));
                    }
                }
            } else {
                ui::print_err(&format!("Swap aggregator unreachable at {}", url));
                ui::print_info("Start with: zion start swap");
            }
            println!();
            Ok(())
        }
        SwapCmd::Quote { from, to, amount } => {
            ui::print_header("Swap Quote");
            ui::print_row("From", &format!("{} {}", amount, from));
            ui::print_row("To", &to);

            let body = serde_json::json!({
                "from_token": from,
                "to_token": to,
                "amount": amount,
            });
            let v = agent_rpc::post(&url, "quote", body).await;
            match v {
                Ok(v) => {
                    if let Some(out) = v["amount_out"].as_str() {
                        ui::print_row("Estimated out", out);
                    }
                    if let Some(impact) = v["price_impact_bps"].as_u64() {
                        ui::print_row("Price impact", &format!("{} bps", impact));
                    }
                    if let Some(route) = v["route"].as_str() {
                        ui::print_row("Route", route);
                    }
                    if let Some(slippage) = v["slippage_bps"].as_u64() {
                        ui::print_row("Slippage", &format!("{} bps", slippage));
                    }
                    if let Some(id) = v["quote_id"].as_str() {
                        ui::print_info(&format!("Quote ID: {}", id));
                        ui::print_info("Run `zion swap execute --quote-id <id>` to execute.");
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_warn(&format!("Quote failed: {}", e)),
            }
            println!();
            Ok(())
        }
        SwapCmd::Execute { quote_id, yes } => {
            ui::print_header("Swap Execution");
            if !yes {
                ui::print_warn("This will submit a real transaction. Use --yes to confirm.");
                return Ok(());
            }
            let body = serde_json::json!({ "quote_id": quote_id });
            let v = agent_rpc::post(&url, "execute", body).await;
            match v {
                Ok(v) => {
                    if let Some(tx) = v["tx_hash"].as_str() {
                        ui::print_ok(&format!("Swap submitted: {}", tx));
                    }
                    if let Some(id) = v["swap_id"].as_str() {
                        ui::print_info(&format!("Track with: zion swap get {}", id));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_err(&format!("Swap failed: {}", e)),
            }
            println!();
            Ok(())
        }
        SwapCmd::History { n } => {
            ui::print_header(&format!("Swap History (last {})", n));
            let v = agent_rpc::get(&url, &format!("history?limit={}", n)).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Swap service unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        SwapCmd::Get { id } => {
            ui::print_header(&format!("Swap {}", id));
            let v = agent_rpc::get(&url, &format!("swaps/{}", id)).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Swap not found: {}", e)),
            }
            println!();
            Ok(())
        }
    }
}
