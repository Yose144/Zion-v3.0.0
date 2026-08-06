use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Hiran AI layer commands (L4 — not yet migrated to V31).
#[derive(Subcommand)]
pub enum HiranCmd {
    /// Ask the Hiran oracle a question
    Ask {
        #[arg()]
        question: String,
    },
    /// Service status
    Status,
    /// List available AI models
    Models,
}

pub async fn run(cmd: HiranCmd) -> Result<()> {
    match cmd {
        HiranCmd::Ask { question } => {
            ui::print_header("Hiran Oracle");
            ui::print_warn("Hiran AI layer is not yet available in V31.");
            ui::print_info(&format!("Question: {}", question));
            println!();
        }
        HiranCmd::Status => {
            ui::print_header("Hiran AI Status");
            ui::print_warn("Hiran AI layer is not yet available in V31.");
            ui::print_info("Pending migration from archive/V3/L4/");
            println!();
        }
        HiranCmd::Models => {
            ui::print_header("Available AI Models");
            ui::print_warn("Hiran AI layer is not yet available in V31.");
            println!();
        }
    }
    Ok(())
}
