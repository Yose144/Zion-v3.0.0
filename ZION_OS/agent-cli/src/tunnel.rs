use crate::{config::AgentConfig, ui};
use anyhow::{Context, Result};
use std::sync::Arc;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

pub struct TunnelHandle {
    child: Arc<Mutex<Child>>,
    pub local_port: u16,
    pub remote_port: u16,
    pub host: String,
}

pub struct TunnelStatus {
    pub active: bool,
    pub local_port: u16,
    pub remote_host: String,
    pub latency_ms: Option<u64>,
    pub model_healthy: bool,
}

/// Start SSH local-forward tunnel: localhost:local_port → remote:remote_port
pub async fn start(cfg: &AgentConfig) -> Result<TunnelHandle> {
    let host = cfg.hiran.remote_host.clone();
    let ssh_port = cfg.hiran.remote_port;
    let local_port = cfg.hiran.tunnel_local_port;
    let remote_port = cfg.hiran.tunnel_remote_port;
    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw).to_string();
    let ssh_user = cfg.hiran.ssh_user.clone();

    if host.is_empty() {
        anyhow::bail!("No remote host configured. Set hiran.remote_host in config.");
    }

    ui::print_info(&format!(
        "Starting SSH tunnel: localhost:{} → {}:{}  (via {}:{} as {})",
        local_port, host, remote_port, host, ssh_port, ssh_user
    ));

    let child = Command::new("ssh")
        .args([
            "-N",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ServerAliveInterval=30",
            "-o", "ServerAliveCountMax=3",
            "-o", "ExitOnForwardFailure=yes",
            "-i", &ssh_key,
            "-p", &ssh_port.to_string(),
            "-L", &format!("{}:localhost:{}", local_port, remote_port),
            &format!("{}@{}", ssh_user, host),
        ])
        .spawn()
        .context("Failed to spawn SSH process. Make sure ssh is in PATH.")?;

    let handle = TunnelHandle {
        child: Arc::new(Mutex::new(child)),
        local_port,
        remote_port,
        host,
    };

    // Wait briefly for tunnel to establish
    sleep(Duration::from_millis(1500)).await;

    if !health_check(local_port).await {
        ui::print_warn("Tunnel established but llama-server not responding yet. The server may still be starting.");
    } else {
        ui::print_ok(&format!("Tunnel active — http://localhost:{}/health OK", local_port));
    }

    Ok(handle)
}

/// Stop SSH tunnel by killing the child process
pub async fn stop(handle: TunnelHandle) -> Result<()> {
    let mut child = handle.child.lock().await;
    child.kill().await.context("Failed to kill SSH tunnel process")?;
    ui::print_ok("SSH tunnel stopped.");
    Ok(())
}

/// Check if the tunnel + llama-server is healthy
pub async fn health_check(port: u16) -> bool {
    let url = format!("http://localhost:{}/health", port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build();

    match client {
        Ok(c) => c.get(&url).send().await.map(|r| r.status().is_success()).unwrap_or(false),
        Err(_) => false,
    }
}

/// Get latency to the local tunnel endpoint in ms
async fn measure_latency(port: u16) -> Option<u64> {
    let url = format!("http://localhost:{}/health", port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .ok()?;

    let start = std::time::Instant::now();
    client.get(&url).send().await.ok()?;
    Some(start.elapsed().as_millis() as u64)
}

/// Report tunnel + server status
pub async fn status(cfg: &AgentConfig) -> Result<()> {
    let local_port = cfg.hiran.tunnel_local_port;

    let latency = measure_latency(local_port).await;
    let active = latency.is_some();
    let model_healthy = if active {
        probe_model_loaded(local_port, &cfg.llm.model).await
    } else {
        false
    };

    let s = TunnelStatus {
        active,
        local_port,
        remote_host: cfg.hiran.remote_host.clone(),
        latency_ms: latency,
        model_healthy,
    };

    println!();
    println!("  Tunnel:       {}", if s.active { "ACTIVE" } else { "OFFLINE" });
    println!("  Endpoint:     http://localhost:{}/v1", s.local_port);
    println!("  Remote:       {}:{} → localhost:{}", s.remote_host, cfg.hiran.remote_port, cfg.hiran.tunnel_remote_port);
    if let Some(ms) = s.latency_ms {
        println!("  Latency:      {}ms", ms);
    }
    println!("  Model:        {}", if s.model_healthy { "LOADED" } else { "not responding" });
    println!();

    Ok(())
}

/// Check if a model is loaded in the llama-server
async fn probe_model_loaded(port: u16, model_hint: &str) -> bool {
    let url = format!("http://localhost:{}/v1/models", port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build();

    match client {
        Ok(c) => {
            if let Ok(resp) = c.get(&url).send().await {
                if let Ok(text) = resp.text().await {
                    return text.to_lowercase().contains("hiran")
                        || text.to_lowercase().contains("gguf")
                        || text.to_lowercase().contains(model_hint);
                }
            }
            false
        }
        Err(_) => false,
    }
}

/// Start llama-server on the remote instance via SSH, serving the GGUF model
pub async fn serve_remote(cfg: &AgentConfig) -> Result<()> {
    let host = &cfg.hiran.remote_host;
    let ssh_port = cfg.hiran.remote_port;
    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw).to_string();
    let ssh_user = &cfg.hiran.ssh_user;
    let gguf = &cfg.hiran.gguf_path;
    let llama_bin = &cfg.hiran.llama_server_bin;
    let remote_port = cfg.hiran.tunnel_remote_port;

    if gguf.is_empty() {
        anyhow::bail!("hiran.gguf_path is not configured. Set it to the remote GGUF file path.");
    }

    let start_cmd = format!(
        "nohup {} --model {} --host 0.0.0.0 --port {} --n-gpu-layers 99 --ctx-size 32768 \
         --n-predict 4096 --threads 8 --parallel 2 --flash-attn \
         --batch-size 512 --ubatch-size 512 \
         > /tmp/llama-server.log 2>&1 &\necho \"STARTED PID=$!\"",
        llama_bin, gguf, remote_port
    );

    ui::print_info(&format!(
        "Starting llama-server on {}:{} serving {}",
        host, remote_port, gguf
    ));

    let output = Command::new("ssh")
        .args([
            "-p", &ssh_port.to_string(),
            "-i", &ssh_key,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", ssh_user, host),
            &start_cmd,
        ])
        .output()
        .await?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if stdout.contains("STARTED") {
        ui::print_ok(&format!("llama-server started: {}", stdout.trim()));
    } else {
        ui::print_warn(&format!("stdout: {}", stdout));
        if !stderr.is_empty() {
            ui::print_warn(&format!("stderr: {}", stderr));
        }
    }

    // Wait for server to be ready
    ui::print_info("Waiting for llama-server to load model...");
    for i in 0..60 {
        sleep(Duration::from_secs(5)).await;
        let check_cmd = format!(
            "curl -s http://localhost:{}/health 2>/dev/null || echo 'not_ready'",
            remote_port
        );
        let check = Command::new("ssh")
            .args([
                "-p", &ssh_port.to_string(),
                "-i", &ssh_key,
                "-o", "StrictHostKeyChecking=no",
                "-o", "UserKnownHostsFile=/dev/null",
                &format!("{}@{}", ssh_user, host),
                &check_cmd,
            ])
            .output()
            .await?;

        let result = String::from_utf8_lossy(&check.stdout);
        if result.contains("ok") || result.contains("\"status\"") {
            ui::print_ok(&format!("llama-server ready after {}s", (i + 1) * 5));
            return Ok(());
        }
        if i % 6 == 5 {
            ui::print_info(&format!("Still loading... ({}s elapsed)", (i + 1) * 5));
        }
    }

    ui::print_warn("llama-server did not respond within 5 minutes. Check logs: ssh ... 'cat /tmp/llama-server.log'");
    Ok(())
}

/// Kill llama-server on remote
pub async fn stop_remote(cfg: &AgentConfig) -> Result<()> {
    let host = &cfg.hiran.remote_host;
    let ssh_port = cfg.hiran.remote_port;
    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw).to_string();
    let ssh_user = &cfg.hiran.ssh_user;
    let remote_port = cfg.hiran.tunnel_remote_port;

    let kill_cmd = format!(
        "pkill -f 'llama-server.*{}' && echo KILLED || echo 'No server found'",
        remote_port
    );

    let output = Command::new("ssh")
        .args([
            "-p", &ssh_port.to_string(),
            "-i", &ssh_key,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", ssh_user, host),
            &kill_cmd,
        ])
        .output()
        .await?;

    println!("{}", String::from_utf8_lossy(&output.stdout).trim());
    Ok(())
}

/// Watch tunnel health and auto-reconnect if it drops
pub async fn watch_and_reconnect(cfg: Arc<AgentConfig>) {
    let mut fail_count = 0u32;
    loop {
        sleep(Duration::from_secs(30)).await;
        let port = cfg.hiran.tunnel_local_port;
        if health_check(port).await {
            fail_count = 0;
        } else {
            fail_count += 1;
            ui::print_warn(&format!("Tunnel health check failed ({}/3)", fail_count));
            if fail_count >= 3 {
                ui::print_warn("Tunnel appears down. Reconnecting...");
                if let Ok(handle) = start(&cfg).await {
                    ui::print_ok("Tunnel reconnected.");
                    // Keep watching — drop old handle, new one takes over
                    let _ = handle;
                    fail_count = 0;
                }
            }
        }
    }
}
