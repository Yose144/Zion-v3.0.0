use anyhow::Result;
use clap::Subcommand;

use crate::ui;
use crate::rpc::agent_rpc;

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
    }
    Ok(())
}
