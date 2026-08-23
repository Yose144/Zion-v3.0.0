use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Issobella layer commands (L6 — passive fund tracker for V31).
#[derive(Subcommand)]
pub enum IssobellaCmd {
    /// Issobella service status
    Status,
    /// Show Issobella parameters
    Params,
}

pub async fn run(cmd: IssobellaCmd) -> Result<()> {
    match cmd {
        IssobellaCmd::Status => {
            ui::print_header("Issobella (L6)");
            ui::print_info("Issobella passive tracker is available in V31.");
            ui::print_info("HTTP API: http://127.0.0.1:8096");
            ui::print_info("Fund balance: GET /api/v1/fund/balance");
            ui::print_info("Canonical fund address: zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0");
            println!();
        }
        IssobellaCmd::Params => {
            ui::print_header("Issobella Parameters");
            ui::print_info("Default bind: 127.0.0.1:8096");
            ui::print_info("Default L1 RPC: http://127.0.0.1:9445/jsonrpc");
            ui::print_info("Default DB: ./issobella.db");
            ui::print_info("Canonical fund address: zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0");
            ui::print_info("DAO bridge: disabled unless ZION_DAO_PROPOSER is set");
            println!();
        }
    }
    Ok(())
}
