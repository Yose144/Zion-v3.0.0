use anyhow::{Context, Result};
use clap::Subcommand;
use std::io::Write;

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
const GITHUB_TAGGED_URL: &str = "https://api.github.com/repos/Zion-TerraNova/v3-Mainnet/releases/tags/";

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

            let client = reqwest::Client::builder()
                .user_agent("zion-cli")
                .build()?;

            // Fetch release info
            let url = if target_version == "latest" {
                GITHUB_RELEASES_URL.to_string()
            } else {
                format!("{}{}", GITHUB_TAGGED_URL, target_version)
            };

            let resp = client.get(&url).send().await
                .context("Failed to fetch release info from GitHub")?;

            if !resp.status().is_success() {
                anyhow::bail!("GitHub API returned: {}", resp.status());
            }

            let release: serde_json::Value = resp.json().await
                .context("Failed to parse release JSON")?;

            let tag = release["tag_name"].as_str().unwrap_or("unknown");
            ui::print_row("Release", tag);

            // Determine platform asset name
            let platform = if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
                "linux-amd64"
            } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
                "linux-arm64"
            } else if cfg!(target_os = "macos") && cfg!(target_arch = "x86_64") {
                "darwin-amd64"
            } else if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
                "darwin-arm64"
            } else if cfg!(target_os = "windows") {
                "windows-amd64"
            } else {
                "unknown"
            };

            // Find matching asset
            let assets = release["assets"].as_array().context("No assets in release")?;
            let asset = assets.iter().find(|a| {
                a["name"].as_str()
                    .map(|n| n.contains(platform))
                    .unwrap_or(false)
            });

            let asset = match asset {
                Some(a) => a,
                None => {
                    // List available assets
                    ui::print_warn(&format!("No pre-built binary found for platform '{}'.", platform));
                    ui::print_info("Available assets:");
                    for a in assets {
                        if let Some(name) = a["name"].as_str() {
                            println!("    {}", name);
                        }
                    }
                    ui::print_info("To update manually:");
                    println!("    git pull origin main");
                    println!("    cd V31 && cargo build --release -p zion-cli");
                    println!("    sudo cp target/release/zion /usr/local/bin/");
                    return Ok(());
                }
            };

            let asset_name = asset["name"].as_str().context("Asset has no name")?;
            let download_url = asset["browser_download_url"].as_str()
                .context("Asset has no download URL")?;
            let size = asset["size"].as_u64().unwrap_or(0);

            ui::print_row("Asset", asset_name);
            ui::print_row("Size", &format!("{} bytes", size));
            ui::print_row("URL", download_url);

            if dry_run {
                ui::print_info("Dry-run: would download and install.");
                return Ok(());
            }

            // Download
            ui::print_info("Downloading...");
            let dl_resp = client.get(download_url).send().await
                .context("Failed to start download")?;

            if !dl_resp.status().is_success() {
                anyhow::bail!("Download failed: HTTP {}", dl_resp.status());
            }

            let bytes = dl_resp.bytes().await
                .context("Failed to read download body")?;

            // Write to temp file
            let tmp = std::env::temp_dir().join("zion-update-download");
            {
                let mut file = std::fs::File::create(&tmp)
                    .context("Failed to create temp file")?;
                file.write_all(&bytes)
                    .context("Failed to write download to temp file")?;
            }

            // Make executable
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&tmp)?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&tmp, perms)?;
            }

            // Determine install path
            let current_exe = std::env::current_exe()
                .context("Failed to determine current executable path")?;
            let install_path = current_exe.clone();

            ui::print_row("Install path", &install_path.display().to_string());

            // Backup current binary
            let backup = install_path.with_extension("bak");
            if install_path.exists() {
                std::fs::copy(&install_path, &backup)
                    .context("Failed to backup current binary")?;
                ui::print_info(&format!("Backed up to {}", backup.display()));
            }

            // Install
            std::fs::rename(&tmp, &install_path)
                .or_else(|_| {
                    // rename may fail across filesystems — try copy + remove
                    std::fs::copy(&tmp, &install_path)?;
                    std::fs::remove_file(&tmp)?;
                    Ok::<(), std::io::Error>(())
                })
                .context("Failed to install new binary")?;

            ui::print_ok("✅ Update installed successfully!");
            ui::print_info("Run 'zion update version' to verify.");
            println!();
        }
        UpdateCmd::Version => {
            let version = env!("CARGO_PKG_VERSION");
            println!("zion v{}", version);
        }
    }
    Ok(())
}
