use anyhow::Result;
use clap::Subcommand;
use std::path::{Path, PathBuf};

use crate::config::{self, Config};
use crate::ui;

pub const SERVER_DEPLOY_SCRIPT: &str = "scripts/deploy-v3-mainnet.sh";

#[derive(Subcommand)]
pub enum DeployCmd {
    /// Deploy full stack to configured server
    Server {
        #[arg(long)]
        host: Option<String>,
        /// Target host key: core | edge (default: edge)
        #[arg(long, default_value = "edge")]
        target: String,
    },
    /// Deploy website only
    Website,
    /// Pull latest images + recreate containers
    Update {
        /// Target host key: core | edge (default: edge)
        #[arg(long, default_value = "edge")]
        target: String,
    },
    /// docker system prune -f on server
    Prune {
        /// Target host key: core | edge (default: edge)
        #[arg(long, default_value = "edge")]
        target: String,
    },
    /// Open SSH session to server
    Ssh {
        /// Target host key: core | edge (default: edge)
        #[arg(long, default_value = "edge")]
        target: String,
    },
    /// Remote container health status
    Status {
        /// Target host key: core | edge (default: edge)
        #[arg(long, default_value = "edge")]
        target: String,
    },
}

fn resolve_deploy_host(cfg: &Config, target: &str) -> String {
    match target.trim().to_ascii_lowercase().as_str() {
        "core" | "local" | "master" => cfg.topology.core.rpc_host.clone(),
        "edge" | "vpn" | "relay" => cfg.topology.edge.rpc_host.clone(),
        other => other.to_string(),
    }
}

pub async fn run(cfg: &Config, cmd: DeployCmd) -> Result<()> {
    match cmd {
        DeployCmd::Server { host, target } => {
            let h = host.unwrap_or_else(|| resolve_deploy_host(cfg, &target));
            ui::print_header(&format!("Deploying to {}", h));
            run_local_script(SERVER_DEPLOY_SCRIPT, cfg)
        }
        DeployCmd::Website => {
            ui::print_header("Deploying Website");
            run_local_script("APP&WEB/website-v2.9/scripts/deploy.sh", cfg)
        }
        DeployCmd::Update { target } => {
            let host = resolve_deploy_host(cfg, &target);
            let key = config::expand_path(&cfg.deploy.ssh_key);
            let user = &cfg.deploy.ssh_user;
            ui::print_header(&format!("Update containers on {}", host));
            ssh_exec(&host, &key, user, "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml pull && docker compose -f docker-compose.v3-mainnet.yml up -d")
        }
        DeployCmd::Prune { target } => {
            let host = resolve_deploy_host(cfg, &target);
            let key = config::expand_path(&cfg.deploy.ssh_key);
            let user = &cfg.deploy.ssh_user;
            ui::print_header(&format!("docker system prune -f on {}", host));
            ssh_exec(&host, &key, user, "docker system prune -f")
        }
        DeployCmd::Ssh { target } => {
            let host = resolve_deploy_host(cfg, &target);
            let key = config::expand_path(&cfg.deploy.ssh_key);
            let user = &cfg.deploy.ssh_user;
            ui::print_info(&format!("Opening SSH session to {}@{}", user, host));
            std::process::Command::new("ssh")
                .args(["-i", &key, &format!("{}@{}", user, host)])
                .status()?;
            Ok(())
        }
        DeployCmd::Status { target } => remote_status(cfg, &target).await,
    }
}

pub async fn start_service(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = validate_service_target(service)?;
    let host = resolve_deploy_host(cfg, "edge");
    let key = config::expand_path(&cfg.deploy.ssh_key);
    let user = &cfg.deploy.ssh_user;

    ui::print_header(&format!("Starting {}", service));
    let cmd = if compose_svc == "all" {
        "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml up -d".into()
    } else {
        format!(
            "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml up -d {}",
            compose_svc
        )
    };
    ssh_exec(&host, &key, user, &cmd)
}

pub async fn stop_service(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = validate_service_target(service)?;
    let host = resolve_deploy_host(cfg, "edge");
    let key = config::expand_path(&cfg.deploy.ssh_key);
    let user = &cfg.deploy.ssh_user;

    ui::print_header(&format!("Stopping {}", service));
    let cmd = if compose_svc == "all" {
        "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml down".into()
    } else {
        format!(
            "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml stop {}",
            compose_svc
        )
    };
    ssh_exec(&host, &key, user, &cmd)
}

pub async fn restart_service(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = validate_service_target(service)?;
    let host = resolve_deploy_host(cfg, "edge");
    let key = config::expand_path(&cfg.deploy.ssh_key);
    let user = &cfg.deploy.ssh_user;

    ui::print_header(&format!("Restarting {}", service));
    let cmd =
        format!(
        "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml restart {}",
        if compose_svc == "all" { "".into() } else { compose_svc }
    );
    ssh_exec(&host, &key, user, &cmd)
}

pub async fn tail_logs(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = validate_service_target(service)?;
    let host = resolve_deploy_host(cfg, "edge");
    let key = config::expand_path(&cfg.deploy.ssh_key);
    let user = &cfg.deploy.ssh_user;

    ui::print_info(&format!("Tailing logs for {} (Ctrl+C to stop)", service));
    let cmd = format!(
        "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml logs -f --tail=50 {}",
        if compose_svc == "all" { "".into() } else { compose_svc }
    );
    std::process::Command::new("ssh")
        .args(["-i", &key, "-t", &format!("{}@{}", user, host), &cmd])
        .status()?;
    Ok(())
}

async fn remote_status(cfg: &Config, target: &str) -> Result<()> {
    let host = resolve_deploy_host(cfg, target);
    let key = config::expand_path(&cfg.deploy.ssh_key);
    let user = &cfg.deploy.ssh_user;

    ui::print_header(&format!("Container Status on {}", host));
    ssh_exec(
        &host,
        &key,
        user,
        "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
    )
}

fn run_local_script(script: &str, _cfg: &Config) -> Result<()> {
    let resolved = resolve_local_path(script).ok_or_else(|| {
        anyhow::anyhow!(
            "Script not found from current working directory upward: {}",
            script
        )
    })?;
    std::process::Command::new("bash").arg(&resolved).status()?;
    Ok(())
}

pub fn resolve_local_path(relative: &str) -> Option<PathBuf> {
    let direct = Path::new(relative);
    if direct.exists() {
        return Some(direct.to_path_buf());
    }

    let mut current = std::env::current_dir().ok()?;
    loop {
        let candidate = current.join(relative);
        if candidate.exists() {
            return Some(candidate);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn ssh_exec(host: &str, key: &str, user: &str, remote_cmd: &str) -> Result<()> {
    std::process::Command::new("ssh")
        .args(["-i", key, &format!("{}@{}", user, host), remote_cmd])
        .status()?;
    Ok(())
}

fn map_service(service: &str) -> String {
    match service {
        "node" | "core" => "core".into(),
        "pool" => "pool".into(),
        "miner" => "miner".into(),
        "agent" | "ai-native" => "ai-native".into(),
        "hiran" | "inference" => "hiran-inference".into(),
        "website" => "website".into(),
        "redis" => "redis".into(),
        "bridge" => "bridge".into(),
        "dao" => "dao".into(),
        "monitoring" => "prometheus grafana node-exporter redis-exporter alertmanager".into(),
        _ => service.into(), // "all" passes through, docker compose handles it
    }
}

fn validate_service_target(service: &str) -> Result<String> {
    if is_supported_service_target(service) {
        return Ok(map_service(service));
    }

    anyhow::bail!(
        "Unsupported service target '{}'. Supported targets: all, node, core, pool, miner, agent, ai-native, hiran, inference, bridge, dao, website, redis, monitoring",
        service
    )
}

fn is_supported_service_target(service: &str) -> bool {
    matches!(
        service,
        "all"
            | "node"
            | "core"
            | "pool"
            | "miner"
            | "agent"
            | "ai-native"
            | "hiran"
            | "inference"
            | "bridge"
            | "dao"
            | "website"
            | "redis"
            | "monitoring"
    )
}
