use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// AI Agent commands (L4 — not yet migrated to V31).
#[derive(Subcommand)]
pub enum AgentCmd {
    /// Chat with the ZION AI agent
    Chat {
        #[arg()]
        message: String,
    },
    /// Agent service status
    Status,
}

pub async fn run(cmd: AgentCmd) -> Result<()> {
    match cmd {
        AgentCmd::Chat { message } => {
            ui::print_header("ZION AI Agent");
            ui::print_warn("AI Agent (L4) is not yet available in V31.");
            ui::print_info("The Hiran/AI-Native layer is being migrated from V3.");
            ui::print_info(&format!("Your message: {}", message));
            println!();
        }
        AgentCmd::Status => {
            ui::print_header("AI Agent Status");
            ui::print_warn("AI Agent (L4) is not yet available in V31.");
            ui::print_info("Pending migration from archive/V3/L4/ai-native/");
            println!();
        }
    }
    Ok(())
}
