use anyhow::Result;
use clap::Subcommand;

use crate::ui;

/// Docker Compose management for ZION services.
#[derive(Subcommand)]
pub enum ComposeCmd {
    /// Show docker-compose status
    Status,
    /// Start all services via docker-compose
    Up {
        /// Detach (run in background)
        #[arg(short, long)]
        detach: bool,
    },
    /// Stop all services
    Down,
    /// Restart services
    Restart,
    /// Show logs
    Logs {
        /// Service name (default: all)
        #[arg()]
        service: Option<String>,
        /// Number of lines
        #[arg(short, long, default_value_t = 50)]
        lines: usize,
    },
    /// Pull latest images
    Pull,
}

pub async fn run(cmd: ComposeCmd) -> Result<()> {
    let compose_files = find_compose_files();

    if compose_files.is_empty() {
        ui::print_warn("No docker-compose files found in V31/ or repo root.");
        ui::print_info("Create a docker-compose.yml or use 'zion service start' for systemd.");
        return Ok(());
    }

    let compose_args: Vec<String> = compose_files
        .iter()
        .flat_map(|f| vec!["-f".to_string(), f.clone()])
        .collect();

    match cmd {
        ComposeCmd::Status => {
            ui::print_header("Docker Compose Status");
            let mut args = compose_args.clone();
            args.extend_from_slice(&["ps".to_string()]);
            run_docker_compose(&args)?;
        }
        ComposeCmd::Up { detach } => {
            ui::print_header("Starting Services (docker-compose up)");
            let mut args = compose_args.clone();
            args.extend_from_slice(&["up".to_string()]);
            if detach {
                args.push("-d".to_string());
            }
            run_docker_compose(&args)?;
        }
        ComposeCmd::Down => {
            ui::print_header("Stopping Services (docker-compose down)");
            let mut args = compose_args.clone();
            args.extend_from_slice(&["down".to_string()]);
            run_docker_compose(&args)?;
        }
        ComposeCmd::Restart => {
            ui::print_header("Restarting Services");
            let mut args = compose_args.clone();
            args.extend_from_slice(&["restart".to_string()]);
            run_docker_compose(&args)?;
        }
        ComposeCmd::Logs { service, lines } => {
            ui::print_header("Docker Compose Logs");
            let mut args = compose_args.clone();
            args.extend_from_slice(&["logs".to_string(), "--tail".to_string(), lines.to_string()]);
            if let Some(svc) = service {
                args.push(svc);
            }
            run_docker_compose(&args)?;
        }
        ComposeCmd::Pull => {
            ui::print_header("Pulling Docker Images");
            let mut args = compose_args.clone();
            args.extend_from_slice(&["pull".to_string()]);
            run_docker_compose(&args)?;
        }
    }
    Ok(())
}

fn find_compose_files() -> Vec<String> {
    let mut files = Vec::new();
    for path in &["docker-compose.yml", "docker-compose.yaml", "V31/docker-compose.yml"] {
        if std::path::Path::new(path).exists() {
            files.push(path.to_string());
        }
    }
    files
}

fn run_docker_compose(args: &[String]) -> Result<()> {
    let status = std::process::Command::new("docker")
        .arg("compose")
        .args(args)
        .status()
        .map_err(|e| anyhow::anyhow!("failed to run docker compose: {e}"))?;
    if !status.success() {
        anyhow::bail!("docker compose failed with exit code: {:?}", status.code());
    }
    Ok(())
}
