use crate::ui;
use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::process::Command;

#[derive(Parser)]
pub struct ComposeCmd {
    #[command(subcommand)]
    pub command: ComposeSubcommand,
}

#[derive(Subcommand)]
pub enum ComposeSubcommand {
    /// Start services (default: mainnet profile)
    Up {
        /// Docker Compose profile to use (mainnet, dev, monitoring)
        #[arg(long, default_value = "mainnet")]
        profile: String,

        /// Build images before starting
        #[arg(long)]
        build: bool,
    },

    /// Stop and remove containers
    Down {
        /// Remove volumes as well
        #[arg(long)]
        volumes: bool,
    },

    /// Show status of services
    Ps,

    /// Follow logs of a service (default: node)
    Logs {
        #[arg(default_value = "node")]
        service: String,

        /// Number of lines to show from the end
        #[arg(short, long, default_value = "100")]
        tail: u32,
    },

    /// Restart services
    Restart {
        #[arg(default_value = "all")]
        service: String,
    },

    /// Run doctor check on Docker stack
    Doctor,
}

pub async fn run(cmd: ComposeCmd) -> Result<()> {
    ui::print_header("Docker Compose");

    match cmd.command {
        ComposeSubcommand::Up { profile, build } => {
            run_compose_up(&profile, build).await?;
        }
        ComposeSubcommand::Down { volumes } => {
            run_compose_down(volumes).await?;
        }
        ComposeSubcommand::Ps => {
            run_compose_ps().await?;
        }
        ComposeSubcommand::Logs { service, tail } => {
            run_compose_logs(&service, tail).await?;
        }
        ComposeSubcommand::Restart { service } => {
            run_compose_restart(&service).await?;
        }
        ComposeSubcommand::Doctor => {
            run_compose_doctor().await?;
        }
    }

    Ok(())
}

async fn run_compose_up(profile: &str, build: bool) -> Result<()> {
    ui::print_info(&format!("Starting services with profile: {}", profile));

    let mut args = vec![
        "compose",
        "-f",
        "V3/docker/docker-compose.yml",
        "--profile",
        profile,
    ];

    if build {
        args.push("--build");
    }

    args.push("up");
    args.push("-d");

    let status = Command::new("docker")
        .args(&args)
        .status()
        .context("Failed to run docker compose up")?;

    if status.success() {
        ui::print_ok(&format!(
            "Stack with profile '{}' started successfully",
            profile
        ));
        ui::print_info("Use 'zion compose logs node' to follow logs");
    } else {
        ui::print_err("Failed to start stack");
    }

    Ok(())
}

async fn run_compose_down(volumes: bool) -> Result<()> {
    let mut args = vec!["compose", "-f", "V3/docker/docker-compose.yml", "down"];

    if volumes {
        args.push("--volumes");
    }

    let status = Command::new("docker")
        .args(&args)
        .status()
        .context("Failed to run docker compose down")?;

    if status.success() {
        ui::print_ok("Stack stopped and removed");
    } else {
        ui::print_err("Failed to stop stack");
    }

    Ok(())
}

async fn run_compose_ps() -> Result<()> {
    let output = Command::new("docker")
        .args(["compose", "-f", "V3/docker/docker-compose.yml", "ps"])
        .output()
        .context("Failed to run docker compose ps")?;

    println!("{}", String::from_utf8_lossy(&output.stdout));
    Ok(())
}

async fn run_compose_logs(service: &str, tail: u32) -> Result<()> {
    let _status = Command::new("docker")
        .args([
            "compose",
            "-f",
            "V3/docker/docker-compose.yml",
            "logs",
            "--tail",
            &tail.to_string(),
            "-f",
            service,
        ])
        .status()
        .context("Failed to run docker compose logs")?;

    Ok(())
}

async fn run_compose_restart(service: &str) -> Result<()> {
    ui::print_info(&format!("Restarting service: {}", service));

    let args = if service == "all" {
        vec!["compose", "-f", "V3/docker/docker-compose.yml", "restart"]
    } else {
        vec![
            "compose",
            "-f",
            "V3/docker/docker-compose.yml",
            "restart",
            service,
        ]
    };

    let status = Command::new("docker")
        .args(&args)
        .status()
        .context("Failed to restart services")?;

    if status.success() {
        ui::print_ok("Services restarted");
    }

    Ok(())
}

pub async fn run_compose_doctor() -> Result<()> {
    ui::print_header("Docker Doctor");

    // Check if docker is available
    match Command::new("docker").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            ui::print_ok(&format!("Docker available: {}", version));
        }
        _ => {
            ui::print_err("Docker is not installed or not in PATH");
            return Ok(());
        }
    }

    // Check compose file
    if std::path::Path::new("V3/docker/docker-compose.yml").exists() {
        ui::print_ok("Modern docker-compose.yml found");
    } else {
        ui::print_warn("Modern docker-compose.yml not found (using legacy?)");
    }

    // Check running containers
    let ps_output = Command::new("docker")
        .args([
            "compose",
            "-f",
            "V3/docker/docker-compose.yml",
            "ps",
            "--format",
            "table {{.Name}}\t{{.Status}}",
        ])
        .output();

    if let Ok(output) = ps_output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("zion-v3") {
                ui::print_ok("ZION V3 containers detected");
                println!("{}", stdout);
            } else {
                ui::print_info("No ZION V3 containers running. Use 'zion compose up' to start.");
            }
        }
    }

    ui::print_info("\nTip: Use 'zion compose up --profile mainnet' to start the full stack.");
    ui::print_info("Use 'zion compose doctor' or 'zion doctor' for full system check.");

    Ok(())
}
