use anyhow::Result;
use clap::Subcommand;

use crate::config::{self, Config};
use crate::ui;

#[derive(Subcommand)]
pub enum DeployCmd {
    /// Deploy full stack to configured server
    Server {
        #[arg(long)]
        host: Option<String>,
    },
    /// Deploy website only
    Website,
    /// Pull latest images + recreate containers
    Update,
    /// docker system prune -f on server
    Prune,
    /// Open SSH session to server
    Ssh,
    /// Remote container health status
    Status,
}

pub async fn run(cfg: &Config, cmd: DeployCmd) -> Result<()> {
    match cmd {
        DeployCmd::Server { host } => {
            let h = host.unwrap_or_else(|| cfg.node.rpc_host.clone());
            ui::print_header(&format!("Deploying to {}", h));
            run_local_script("scripts/deploy.sh", &cfg)
        }
        DeployCmd::Website => {
            ui::print_header("Deploying Website");
            run_local_script("APP&WEB/website-v2.9/scripts/deploy.sh", &cfg)
        }
        DeployCmd::Update => {
            let host = &cfg.node.rpc_host;
            let key = config::expand_path(&cfg.deploy.ssh_key);
            let user = &cfg.deploy.ssh_user;
            ui::print_header(&format!("Update containers on {}", host));
            ssh_exec(host, &key, user, "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml pull && docker compose -f docker-compose.v3-mainnet.yml up -d")
        }
        DeployCmd::Prune => {
            let host = &cfg.node.rpc_host;
            let key = config::expand_path(&cfg.deploy.ssh_key);
            let user = &cfg.deploy.ssh_user;
            ui::print_header(&format!("docker system prune -f on {}", host));
            ssh_exec(host, &key, user, "docker system prune -f")
        }
        DeployCmd::Ssh => {
            let host = &cfg.node.rpc_host;
            let key = config::expand_path(&cfg.deploy.ssh_key);
            let user = &cfg.deploy.ssh_user;
            ui::print_info(&format!("Opening SSH session to {}@{}", user, host));
            std::process::Command::new("ssh")
                .args(["-i", &key, &format!("{}@{}", user, host)])
                .status()?;
            Ok(())
        }
        DeployCmd::Status => remote_status(cfg).await,
    }
}

pub async fn start_service(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = map_service(service);
    let host = &cfg.node.rpc_host;
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
    ssh_exec(host, &key, user, &cmd)
}

pub async fn stop_service(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = map_service(service);
    let host = &cfg.node.rpc_host;
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
    ssh_exec(host, &key, user, &cmd)
}

pub async fn restart_service(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = map_service(service);
    let host = &cfg.node.rpc_host;
    let key = config::expand_path(&cfg.deploy.ssh_key);
    let user = &cfg.deploy.ssh_user;

    ui::print_header(&format!("Restarting {}", service));
    let cmd = format!(
        "cd /root/zion-2.9.6/docker && docker compose -f docker-compose.v3-mainnet.yml restart {}",
        if compose_svc == "all" { "".into() } else { compose_svc }
    );
    ssh_exec(host, &key, user, &cmd)
}

pub async fn tail_logs(cfg: &Config, service: &str) -> Result<()> {
    let compose_svc = map_service(service);
    let host = &cfg.node.rpc_host;
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

async fn remote_status(cfg: &Config) -> Result<()> {
    let host = &cfg.node.rpc_host;
    let key = config::expand_path(&cfg.deploy.ssh_key);
    let user = &cfg.deploy.ssh_user;

    ui::print_header(&format!("Container Status on {}", host));
    ssh_exec(
        host,
        &key,
        user,
        "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
    )
}

fn run_local_script(script: &str, _cfg: &Config) -> Result<()> {
    if !std::path::Path::new(script).exists() {
        anyhow::bail!("Script not found: {}", script);
    }
    std::process::Command::new("bash")
        .arg(script)
        .status()?;
    Ok(())
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
        "website" => "website".into(),
        "redis" => "redis".into(),
        "bridge" => "bridge".into(),
        "dao" => "dao".into(),
        "monitoring" => "prometheus grafana node-exporter redis-exporter alertmanager".into(),
        _ => service.into(), // "all" passes through, docker compose handles it
    }
}
