use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Issobella layer commands (L5 — not yet migrated to V31).
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
            ui::print_header("Issobella (L5)");
            ui::print_warn("Issobella layer is not yet available in V31.");
            ui::print_info("Pending migration from archive/V3/L5/issobella/");
            println!();
        }
        IssobellaCmd::Params => {
            ui::print_header("Issobella Parameters");
            ui::print_warn("Issobella layer is not yet available in V31.");
            println!();
        }
    }
    Ok(())
}
