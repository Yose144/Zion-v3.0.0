use anyhow::{Context, Result};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::{Command, Output};
use std::time::Duration;

use crate::commands::{compose, deploy, mine};
use crate::config::{self, Config};
use crate::rpc::{agent_rpc, node_rpc};
use crate::ui;

const SSH_PORT: u16 = 22;
const REMOTE_COMPOSE_FILE: &str = "/root/zion-2.9.6/docker/docker-compose.v3-mainnet.yml";

pub async fn run(cfg: &Config) -> Result<()> {
    ui::print_banner();
    ui::print_header("Doctor");

    let mut hard_failures = 0usize;

    ui::print_header("Config");
    let report = config::validate(cfg);
    for warning in &report.warnings {
        ui::print_warn(warning);
    }
    for error in &report.errors {
        ui::print_err(error);
    }
    if report.is_ok() {
        ui::print_ok("Config schema and value checks passed");
    } else {
        hard_failures += report.errors.len();
    }

    ui::print_header("Local Runtime");
    let config_path = config::config_path()?;
    if config_path.exists() {
        ui::print_ok(&format!("Config file    {}", config_path.display()));
    } else {
        ui::print_warn(&format!(
            "Config file    missing at {}; using built-in defaults",
            config_path.display()
        ));
    }

    match mine::discover_miner_binary() {
        Some(path) => ui::print_ok(&format!("Miner binary  {}", path.display())),
        None => ui::print_warn("Miner binary  zion-miner not found locally; build with `cd V3 && cargo build -p zion-miner --release`")
    }

    ui::print_header("Mining Environment");
    if cfg.miner.wallet.trim().is_empty() {
        ui::print_warn(
            "Mining wallet  not configured; set with `zion config set miner.wallet <address>`",
        );
    } else {
        ui::print_ok("Mining wallet  configured");
    }

    match validate_threads_setting(&cfg.miner.threads) {
        Ok(message) => ui::print_ok(&format!("Miner threads  {}", message)),
        Err(message) => {
            hard_failures += 1;
            ui::print_err(&format!("Miner threads  {}", message));
        }
    }

    match backend_runtime_note(&cfg.miner.backend) {
        BackendDoctorNote::Ok(message) => ui::print_ok(&format!("Miner backend  {}", message)),
        BackendDoctorNote::Warn(message) => ui::print_warn(&format!("Miner backend  {}", message)),
    }

    match validate_algorithm_setting(&cfg.miner.algorithm) {
        Ok(message) => ui::print_ok(&format!("Miner algorithm {}", message)),
        Err(message) => ui::print_warn(&format!("Miner algorithm {}", message)),
    }

    if cfg.miner.profile.trim().eq_ignore_ascii_case("dual") {
        if cfg.miner.btc_wallet.trim().is_empty() {
            ui::print_warn("Dual profile   miner.btc_wallet is empty; DCR sidecar payout is not fully configured");
        } else {
            ui::print_ok("Dual profile   BTC payout wallet configured");
        }
    }

    match tcp_probe(&cfg.pool.host, cfg.pool.port, Duration::from_secs(3)) {
        Ok(()) => ui::print_ok(&format!(
            "Pool target    {}:{} reachable",
            cfg.pool.host, cfg.pool.port
        )),
        Err(err) => ui::print_warn(&format!(
            "Pool target    {}:{} — {}",
            cfg.pool.host, cfg.pool.port, err
        )),
    }

    ui::print_header("Docker Stack");
    if command_exists("docker") {
        match Command::new("docker").arg("--version").output() {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                ui::print_ok(&format!("Docker          {}", version));
            }
            _ => ui::print_warn("Docker found in PATH but version check failed"),
        }

        // Run compose doctor logic
        if let Err(e) = compose::run_compose_doctor().await {
            ui::print_warn(&format!("Compose doctor encountered issue: {}", e));
        }
    } else {
        ui::print_warn("Docker          not found in PATH. Install Docker Desktop or docker CLI.");
        hard_failures += 1;
    }

    ui::print_header("Deploy Readiness");
    match deploy::resolve_local_path(deploy::SERVER_DEPLOY_SCRIPT) {
        Some(path) => ui::print_ok(&format!("Deploy script  {}", path.display())),
        None => ui::print_warn("Deploy script  scripts/deploy-v3-mainnet.sh not found from current working directory upward"),
    }

    match find_upward_path("docker/docker-compose.v3-mainnet.yml") {
        Some(path) => ui::print_ok(&format!("Compose file   {}", path.display())),
        None => ui::print_warn("Compose file   docker/docker-compose.v3-mainnet.yml not found from current working directory upward"),
    }

    let ssh_key = config::expand_path(&cfg.deploy.ssh_key);
    if command_exists("ssh") {
        ui::print_ok("SSH client     ssh available in PATH");
    } else {
        hard_failures += 1;
        ui::print_err("SSH client     ssh not found in PATH");
    }

    if std::path::Path::new(&ssh_key).exists() {
        ui::print_ok(&format!("SSH key        {}", ssh_key));
    } else {
        ui::print_warn(&format!("SSH key        missing at {}", ssh_key));
    }

    let edge_ssh_host = &cfg.topology.edge.rpc_host;
    match tcp_probe(edge_ssh_host, SSH_PORT, Duration::from_secs(3)) {
        Ok(()) => ui::print_ok(&format!(
            "SSH port       {}:{} reachable",
            edge_ssh_host, SSH_PORT
        )),
        Err(err) => {
            hard_failures += 1;
            ui::print_err(&format!(
                "SSH port       {}:{} — {}",
                edge_ssh_host, SSH_PORT, err
            ));
        }
    }

    if command_exists("ssh") && std::path::Path::new(&ssh_key).exists() {
        match ssh_probe(edge_ssh_host, &ssh_key, &cfg.deploy.ssh_user, "true") {
            Ok(None) => ui::print_ok(&format!(
                "SSH auth       {}@{}",
                cfg.deploy.ssh_user, edge_ssh_host
            )),
            Ok(Some(detail)) => {
                hard_failures += 1;
                ui::print_err(&format!("SSH auth       {}", detail));
            }
            Err(err) => {
                hard_failures += 1;
                ui::print_err(&format!("SSH auth       {}", err));
            }
        }

        match ssh_probe(
            edge_ssh_host,
            &ssh_key,
            &cfg.deploy.ssh_user,
            &format!(
                "sh -lc 'command -v docker >/dev/null && docker compose version >/dev/null 2>&1 && test -f {}'",
                REMOTE_COMPOSE_FILE
            ),
        ) {
            Ok(None) => ui::print_ok("Remote compose docker + compose available and V3 compose file present"),
            Ok(Some(detail)) => {
                hard_failures += 1;
                ui::print_err(&format!("Remote compose  {}", detail));
            }
            Err(err) => {
                hard_failures += 1;
                ui::print_err(&format!("Remote compose  {}", err));
            }
        }
    }

    ui::print_header("Core Endpoints");
    let (core_host, core_rpc_port) = cfg.core_rpc();
    match node_rpc::call0(core_host, core_rpc_port, "getChainInfo").await {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "Core RPC      {}:{} height={} tip={}...",
                core_host, core_rpc_port, height, short
            ));
        }
        Err(err) => {
            ui::print_warn(&format!(
                "Core RPC      {}:{} — {}",
                core_host, core_rpc_port, err
            ));
        }
    }
    let (_, core_pool_port) = cfg.core_pool();
    match tcp_probe(core_host, core_pool_port, Duration::from_secs(3)) {
        Ok(()) => ui::print_ok(&format!(
            "Core pool     {}:{} reachable",
            core_host, core_pool_port
        )),
        Err(err) => ui::print_warn(&format!(
            "Core pool     {}:{} — {}",
            core_host, core_pool_port, err
        )),
    }

    ui::print_header("Edge Endpoints");
    let (edge_host, edge_rpc_port) = cfg.edge_rpc();
    match node_rpc::call0(edge_host, edge_rpc_port, "getChainInfo").await {
        Ok(v) => {
            let height = v["chain_height"].as_u64().unwrap_or(0);
            let hash = v["tip_hash"].as_str().unwrap_or("?");
            let short = if hash.len() > 12 { &hash[..12] } else { hash };
            ui::print_ok(&format!(
                "Edge RPC      {}:{} height={} tip={}...",
                edge_host, edge_rpc_port, height, short
            ));
        }
        Err(err) => {
            ui::print_warn(&format!(
                "Edge RPC      {}:{} — {}",
                edge_host, edge_rpc_port, err
            ));
        }
    }
    let (edge_pool_host, edge_pool_port) = cfg.edge_pool();
    match tcp_probe(edge_pool_host, edge_pool_port, Duration::from_secs(3)) {
        Ok(()) => ui::print_ok(&format!(
            "Edge pool     {}:{} reachable",
            edge_pool_host, edge_pool_port
        )),
        Err(err) => ui::print_warn(&format!(
            "Edge pool     {}:{} — {}",
            edge_pool_host, edge_pool_port, err
        )),
    }

    ui::print_header("VPN / Tailscale");
    if let (Some(core_vpn), Some(edge_vpn)) = (&cfg.topology.core.vpn_ip, &cfg.topology.edge.vpn_ip) {
        match tcp_probe(core_vpn, core_rpc_port, Duration::from_secs(5)) {
            Ok(()) => ui::print_ok(&format!("Core VPN      {}:{} reachable", core_vpn, core_rpc_port)),
            Err(err) => ui::print_warn(&format!("Core VPN      {}:{} — {}", core_vpn, core_rpc_port, err)),
        }
        match tcp_probe(edge_vpn, edge_rpc_port, Duration::from_secs(5)) {
            Ok(()) => ui::print_ok(&format!("Edge VPN      {}:{} reachable", edge_vpn, edge_rpc_port)),
            Err(err) => ui::print_warn(&format!("Edge VPN      {}:{} — {}", edge_vpn, edge_rpc_port, err)),
        }
    } else {
        ui::print_warn("VPN IPs not configured; skipping VPN probe");
    }

    match agent_rpc::health(&cfg.agent.url).await {
        Ok(true) => ui::print_ok(&format!("AI Native     {}", cfg.agent.url)),
        Ok(false) => ui::print_warn(&format!("AI Native     unreachable at {}", cfg.agent.url)),
        Err(err) => ui::print_warn(&format!("AI Native     {} — {}", cfg.agent.url, err)),
    }

    println!();
    if hard_failures == 0 {
        ui::print_ok("Doctor passed");
        Ok(())
    } else {
        anyhow::bail!("Doctor found {} hard failure(s)", hard_failures)
    }
}

enum BackendDoctorNote {
    Ok(String),
    Warn(String),
}

fn validate_algorithm_setting(algorithm: &str) -> Result<String, String> {
    let trimmed = algorithm.trim();
    if trimmed.is_empty() {
        return Ok("deeksha_lite_v1 (default)".to_string());
    }
    match trimmed.to_ascii_lowercase().as_str() {
        "deeksha_lite_v1" | "lite" | "dl" | "dlv1" => Ok("deeksha_lite_v1".to_string()),
        "deeksha_lite_fire" | "fire" | "dlfire" => Ok("deeksha_lite_fire (thermal-intensive)".to_string()),
        "cosmic_harmony_ekam_deeksha_v2" | "ekam" | "ekam_v2" | "full" => Ok("cosmic_harmony_ekam_deeksha_v2".to_string()),
        other => Err(format!("has unsupported value '{}'; use: deeksha_lite_v1, deeksha_lite_fire, cosmic_harmony_ekam_deeksha_v2", other)),
    }
}

fn validate_threads_setting(threads: &str) -> Result<String, String> {
    let trimmed = threads.trim();
    if trimmed.eq_ignore_ascii_case("auto") {
        return Ok("auto".to_string());
    }

    match trimmed.parse::<usize>() {
        Ok(0) => Err("must be greater than 0 or `auto`".to_string()),
        Ok(value) => Ok(value.to_string()),
        Err(_) => Err(format!(
            "has unsupported value '{}'; use a positive integer or `auto`",
            trimmed
        )),
    }
}

fn backend_runtime_note(backend: &str) -> BackendDoctorNote {
    match backend.trim().to_ascii_lowercase().as_str() {
        "auto" | "cpu" => BackendDoctorNote::Ok(backend.trim().to_string()),
        "gpu" => BackendDoctorNote::Warn(
            "generic gpu selected; runtime support depends on the actual miner host".to_string(),
        ),
        "metal" => {
            if cfg!(target_os = "macos") {
                BackendDoctorNote::Ok("metal requested on macOS host".to_string())
            } else {
                BackendDoctorNote::Warn(
                    "metal is configured but this host is not macOS".to_string(),
                )
            }
        }
        "opencl" | "ocl" => {
            if command_exists("clinfo") || cfg!(target_os = "macos") {
                BackendDoctorNote::Ok("opencl runtime probe passed".to_string())
            } else {
                BackendDoctorNote::Warn("opencl selected but `clinfo` was not found; verify OpenCL runtime on the miner host".to_string())
            }
        }
        "cuda" => {
            if command_exists("nvidia-smi") {
                BackendDoctorNote::Ok("cuda runtime probe passed via nvidia-smi".to_string())
            } else {
                BackendDoctorNote::Warn("cuda selected but `nvidia-smi` was not found; verify NVIDIA runtime on the miner host".to_string())
            }
        }
        other => {
            BackendDoctorNote::Warn(format!("unsupported backend '{}' in runtime probe", other))
        }
    }
}

fn command_exists(name: &str) -> bool {
    Command::new("which")
        .arg(name)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn tcp_probe(host: &str, port: u16, timeout: Duration) -> Result<()> {
    let address = (host, port)
        .to_socket_addrs()
        .with_context(|| format!("could not resolve {}:{}", host, port))?
        .next()
        .with_context(|| format!("no socket address resolved for {}:{}", host, port))?;

    TcpStream::connect_timeout(&address, timeout)
        .with_context(|| format!("connect failed to {}:{}", host, port))?;
    Ok(())
}

fn find_upward_path(relative: &str) -> Option<PathBuf> {
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

fn ssh_probe(host: &str, key: &str, user: &str, remote_cmd: &str) -> Result<Option<String>> {
    let output = Command::new("ssh")
        .args([
            "-i",
            key,
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=5",
            "-o",
            "NumberOfPasswordPrompts=0",
            "-o",
            "StrictHostKeyChecking=accept-new",
            &format!("{}@{}", user, host),
            remote_cmd,
        ])
        .output()
        .with_context(|| format!("could not execute ssh probe against {}@{}", user, host))?;

    if output.status.success() {
        Ok(None)
    } else {
        Ok(Some(summarize_process_failure(&output)))
    }
}

fn summarize_process_failure(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr)
        .trim()
        .replace('\n', " ");
    if !stderr.is_empty() {
        return stderr;
    }

    let stdout = String::from_utf8_lossy(&output.stdout)
        .trim()
        .replace('\n', " ");
    if !stdout.is_empty() {
        return stdout;
    }

    match output.status.code() {
        Some(code) => format!("process exited with status {}", code),
        None => "process terminated by signal".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{summarize_process_failure, validate_threads_setting};
    #[cfg(unix)]
    use std::os::unix::process::ExitStatusExt;
    #[cfg(windows)]
    use std::os::windows::process::ExitStatusExt;
    use std::process::Output;

    #[test]
    fn thread_setting_accepts_auto_and_positive_values() {
        assert_eq!(
            validate_threads_setting("auto").expect("auto should pass"),
            "auto"
        );
        assert_eq!(validate_threads_setting("8").expect("8 should pass"), "8");
    }

    #[test]
    fn thread_setting_rejects_zero_and_garbage() {
        assert!(validate_threads_setting("0").is_err());
        assert!(validate_threads_setting("many").is_err());
    }

    #[test]
    fn summarize_process_failure_prefers_stderr() {
        let output = Output {
            status: std::process::ExitStatus::from_raw(256),
            stdout: b"stdout detail".to_vec(),
            stderr: b"stderr detail".to_vec(),
        };

        assert_eq!(summarize_process_failure(&output), "stderr detail");
    }
}
