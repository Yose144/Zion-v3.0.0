use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Free World layer commands (L5 — passive fund tracker for V31).
#[derive(Subcommand)]
pub enum FreeWorldCmd {
    /// Free World service status
    Status,
    /// Show Free World parameters
    Params,
}

pub async fn run(cmd: FreeWorldCmd) -> Result<()> {
    match cmd {
        FreeWorldCmd::Status => {
            ui::print_header("Free World (L5)");
            ui::print_info("Free World passive tracker is available in V31.");
            ui::print_info("HTTP API: http://127.0.0.1:8095");
            ui::print_info("Fund balance: GET /api/v1/fund/balance");
            ui::print_info("Canonical fund address: zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8");
            println!();
        }
        FreeWorldCmd::Params => {
            ui::print_header("Free World Parameters");
            ui::print_info("Default bind: 127.0.0.1:8095");
            ui::print_info("Default L1 RPC: http://127.0.0.1:9445/jsonrpc");
            ui::print_info("Default DB: ./free_world.db");
            ui::print_info("Canonical fund address: zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8");
            ui::print_info("DAO bridge: disabled unless ZION_DAO_PROPOSER is set");
            println!();
        }
    }
    Ok(())
}
