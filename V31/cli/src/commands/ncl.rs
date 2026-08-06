use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// NCL (Network Command Layer) commands (not yet migrated to V31).
#[derive(Subcommand)]
pub enum NclCmd {
    /// NCL service status
    Status,
    /// List registered NCL commands
    List,
    /// Execute an NCL command
    Exec {
        #[arg()]
        command: String,
    },
}

pub async fn run(cmd: NclCmd) -> Result<()> {
    match cmd {
        NclCmd::Status => {
            ui::print_header("NCL (Network Command Layer)");
            ui::print_warn("NCL is not yet available in V31.");
            ui::print_info("Pending migration from archive/V3/L3/ncl/");
            println!();
        }
        NclCmd::List => {
            ui::print_header("NCL Commands");
            ui::print_warn("NCL is not yet available in V31.");
            println!();
        }
        NclCmd::Exec { command } => {
            ui::print_header("NCL Execute");
            ui::print_warn("NCL is not yet available in V31.");
            ui::print_info(&format!("Command: {}", command));
            println!();
        }
    }
    Ok(())
}
