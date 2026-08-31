use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// DAO subcommands (backed by zion-dao L2 service).
#[derive(Subcommand)]
pub enum DaoCmd {
    /// DAO health + governance summary
    Status,
    /// List active proposals
    Proposals,
    /// Show proposal detail by ID
    Proposal { id: String },
    /// Vote on a proposal
    Vote {
        #[arg(long)]
        proposal_id: String,
        #[arg(long)]
        vote: String,
    },
    /// Treasury balance + allocation
    Treasury,
    /// Active DAO parameters
    Params,
}

pub async fn run(cmd: DaoCmd, dao_url: &str) -> Result<()> {
    use crate::rpc::agent_rpc;
    let url = format!("{}/api/dao", dao_url.trim_end_matches('/'));

    match cmd {
        DaoCmd::Status => {
            ui::print_header("ZION DAO (L2)");
            let alive = agent_rpc::health(&url).await.unwrap_or(false);
            if alive {
                ui::print_ok(&format!("DAO online at {}", url));
                let v = agent_rpc::get(&url, "status").await;
                if let Ok(v) = v {
                    if let Some(p) = v["active_proposals"].as_u64() {
                        ui::print_row("Active proposals", &p.to_string());
                    }
                    if let Some(voters) = v["total_voters"].as_u64() {
                        ui::print_row("Total voters", &voters.to_string());
                    }
                    if let Some(epoch) = v["current_epoch"].as_u64() {
                        ui::print_row("Epoch", &epoch.to_string());
                    }
                }
            } else {
                ui::print_err(&format!("DAO unreachable at {}", url));
                ui::print_info("Start with: zion service start dao");
            }
            println!();
        }
        DaoCmd::Proposals => {
            ui::print_header("Active Proposals");
            match agent_rpc::get(&url, "proposals?status=active").await {
                Ok(v) => {
                    if let Some(arr) = v.as_array() {
                        for p in arr {
                            let id = p["id"].as_str().unwrap_or("?");
                            let title = p["title"].as_str().unwrap_or("(no title)");
                            let votes = p["vote_count"].as_u64().unwrap_or(0);
                            println!("  [{id}] {title}  (votes: {votes})");
                        }
                        if arr.is_empty() {
                            ui::print_info("No active proposals.");
                        }
                    } else {
                        println!("{}", serde_json::to_string_pretty(&v)?);
                    }
                }
                Err(e) => ui::print_warn(&format!("DAO unavailable: {}", e)),
            }
            println!();
        }
        DaoCmd::Proposal { id } => {
            ui::print_header(&format!("Proposal {}", id));
            match agent_rpc::get(&url, &format!("proposals/{}", id)).await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Proposal not found: {}", e)),
            }
            println!();
        }
        DaoCmd::Vote { proposal_id, vote } => {
            ui::print_header("DAO Vote (dry-run)");
            ui::print_row("Proposal", &proposal_id);
            ui::print_row("Vote", &vote);
            ui::print_warn(
                "Full signing + submission coming in Phase 4. No transaction submitted.",
            );
            println!();
        }
        DaoCmd::Treasury => {
            ui::print_header("Treasury");
            match agent_rpc::get(&url, "treasury").await {
                Ok(v) => {
                    if let Some(bal) = v["balance"].as_f64() {
                        ui::print_row("Balance", &format!("{:.2} ZION", bal));
                    }
                    if let Some(alloc) = v["allocations"].as_array() {
                        ui::print_info("Allocations:");
                        for a in alloc {
                            let name = a["name"].as_str().unwrap_or("?");
                            let pct = a["percent"].as_f64().unwrap_or(0.0);
                            println!("    {:.1}%  {}", pct, name);
                        }
                    }
                    if v["balance"].is_null() && v["allocations"].is_null() {
                        println!("{}", serde_json::to_string_pretty(&v)?);
                    }
                }
                Err(e) => ui::print_warn(&format!("Treasury unavailable: {}", e)),
            }
            println!();
        }
        DaoCmd::Params => {
            ui::print_header("DAO Parameters");
            match agent_rpc::get(&url, "params").await {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("DAO unavailable: {}", e)),
            }
            println!();
        }
    }
    Ok(())
}
