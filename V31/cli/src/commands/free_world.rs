use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Free World layer commands (L5 — not yet migrated to V31).
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
            ui::print_warn("Free World layer is not yet available in V31.");
            ui::print_info("Pending migration from archive/V3/L5/free-world/");
            println!();
        }
        FreeWorldCmd::Params => {
            ui::print_header("Free World Parameters");
            ui::print_warn("Free World layer is not yet available in V31.");
            println!();
        }
    }
    Ok(())
}
