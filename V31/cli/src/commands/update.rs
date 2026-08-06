use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Self-update the ZION CLI binary from GitHub releases.
#[derive(Subcommand)]
pub enum UpdateCmd {
    /// Check for the latest release
    Check,
    /// Download and install the latest version
    Now {
        /// Specific version to install (default: latest)
        #[arg(long)]
        version: Option<String>,
        /// Dry-run: show what would be done
        #[arg(long)]
        dry_run: bool,
    },
    /// Show current version
    Version,
}

const GITHUB_RELEASES_URL: &str = "https://api.github.com/repos/Zion-TerraNova/v3-Mainnet/releases/latest";

pub async fn run(cmd: UpdateCmd) -> Result<()> {
    match cmd {
        UpdateCmd::Check => {
            ui::print_header("Checking for updates...");
            let client = reqwest::Client::builder()
                .user_agent("zion-cli")
                .build()?;
            match client.get(GITHUB_RELEASES_URL).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let v: serde_json::Value = resp.json().await?;
                        let tag = v["tag_name"].as_str().unwrap_or("unknown");
                        let name = v["name"].as_str().unwrap_or("unknown");
                        ui::print_row("Latest release", tag);
                        ui::print_row("Name", name);
                        let current = env!("CARGO_PKG_VERSION");
                        ui::print_row("Current", current);
                        if tag.trim_start_matches('v') != current {
                            ui::print_info("Update available! Run 'zion update now' to install.");
                        } else {
                            ui::print_ok("You are running the latest version.");
                        }
                    } else {
                        ui::print_warn(&format!("GitHub API returned: {}", resp.status()));
                    }
                }
                Err(e) => ui::print_warn(&format!("Failed to check: {}", e)),
            }
            println!();
        }
        UpdateCmd::Now { version, dry_run } => {
            ui::print_header("Update ZION CLI");
            let target_version = version.unwrap_or_else(|| "latest".to_string());
            ui::print_row("Target", &target_version);

            if dry_run {
                ui::print_info("Dry-run: would download and install.");
                return Ok(());
            }

            ui::print_warn("Self-update not yet fully implemented.");
            ui::print_info("To update manually:");
            println!("    git pull origin main");
            println!("    cd V31 && cargo build --release -p zion-cli");
            println!("    sudo cp target/release/zion /usr/local/bin/");
            println!();
        }
        UpdateCmd::Version => {
            let version = env!("CARGO_PKG_VERSION");
            println!("zion v{}", version);
        }
    }
    Ok(())
}
