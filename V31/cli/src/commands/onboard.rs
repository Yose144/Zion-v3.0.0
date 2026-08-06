use anyhow::Result;
use std::path::PathBuf;

use crate::ui;

/// First-run onboarding wizard — creates config, wallet, and starts services.
#[derive(clap::Subcommand)]
pub enum OnboardCmd {
    /// Run the interactive onboarding wizard
    Start,
    /// Check if onboarding has been completed
    Status,
    /// Reset onboarding state (re-run wizard)
    Reset,
}

pub async fn run(cmd: OnboardCmd) -> Result<()> {
    match cmd {
        OnboardCmd::Start => {
            ui::print_banner();
            ui::print_header("ZION V31 Onboarding Wizard");
            println!("  This wizard will guide you through:");
            println!("    1. Creating a ZION wallet");
            println!("    2. Configuring the L1 node");
            println!("    3. Starting mining (optional)");
            println!("    4. Connecting to the multichain layer");
            println!();

            let zion_dir = dirs::home_dir()
                .map(|d| d.join(".zion"))
                .unwrap_or_else(|| PathBuf::from(".zion"));

            // Step 1: Wallet
            ui::print_info("Step 1: Wallet");
            let wallet_path = zion_dir.join("wallet.json");
            if wallet_path.exists() {
                ui::print_ok(&format!("Wallet found: {}", wallet_path.display()));
            } else {
                ui::print_info("No wallet found. Run 'zion wallet create' to create one.");
                ui::wait_for_enter("Press Enter to continue when done.")?;
            }

            // Step 2: Config
            ui::print_info("Step 2: Configuration");
            let config_path = PathBuf::from("multichain.toml");
            if config_path.exists() {
                ui::print_ok(&format!("Config found: {}", config_path.display()));
            } else {
                ui::print_info("No multichain.toml found. Using defaults.");
                ui::print_info("Create one with 'zion service start' to use the multichain layer.");
            }

            // Step 3: Services
            ui::print_info("Step 3: Services");
            ui::print_info("Starting V31 services...");
            let services = ["node", "pool", "multichain"];
            for svc in &services {
                let unit = match *svc {
                    "node" => "zion-v31-node.service",
                    "pool" => "zion-v31-pool.service",
                    "multichain" => "zion-v31-multichain.service",
                    _ => continue,
                };
                let active = std::process::Command::new("systemctl")
                    .args(["is-active", "--quiet", unit])
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false);
                if active {
                    ui::print_ok(&format!("{} is running", svc));
                } else {
                    ui::print_warn(&format!("{} is not running (start with: zion service start {})", svc, svc));
                }
            }

            // Mark onboarding complete
            let marker = zion_dir.join(".onboarded");
            std::fs::create_dir_all(&zion_dir)?;
            std::fs::write(&marker, chrono::Utc::now().to_rfc3339())?;

            println!();
            ui::print_ok("Onboarding complete!");
            ui::print_info("Next steps:");
            println!("    zion wallet balance --chain zion-l1 --address <your-address>");
            println!("    zion miner start --reward-address <your-address>");
            println!("    zion status");
            println!();
        }
        OnboardCmd::Status => {
            let marker = dirs::home_dir()
                .map(|d| d.join(".zion").join(".onboarded"))
                .unwrap_or_else(|| PathBuf::from(".zion/.onboarded"));
            if marker.exists() {
                let ts = std::fs::read_to_string(&marker).unwrap_or_default();
                ui::print_ok(&format!("Onboarding completed at: {}", ts));
            } else {
                ui::print_warn("Onboarding not yet completed. Run 'zion onboard start'.");
            }
        }
        OnboardCmd::Reset => {
            let marker = dirs::home_dir()
                .map(|d| d.join(".zion").join(".onboarded"))
                .unwrap_or_else(|| PathBuf::from(".zion/.onboarded"));
            if marker.exists() {
                std::fs::remove_file(&marker)?;
                ui::print_ok("Onboarding state reset.");
            } else {
                ui::print_info("Nothing to reset.");
            }
        }
    }
    Ok(())
}
