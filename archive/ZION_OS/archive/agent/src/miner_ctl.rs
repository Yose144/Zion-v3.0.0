use crate::{AgentState, miner_parser};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use tokio::process::Command;
use tracing::{error, info, warn};

pub async fn start_miner(
    state: Arc<AgentState>,
    req: Option<crate::StartMinerRequest>,
) -> anyhow::Result<u32> {
    let cfg = state.config.read().await;

    // Pokud uz bezi, ukonci ho
    if let Some(pid) = *state.miner_pid.read().await {
        warn!("Miner uz bezi (PID {}), restartuji...", pid);
        stop_miner(state.clone()).await.ok();
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    let pool = req
        .as_ref()
        .and_then(|r| r.pool.clone())
        .unwrap_or_else(|| cfg.miner.default_pool.clone());
    let wallet = req
        .as_ref()
        .and_then(|r| r.wallet.clone())
        .unwrap_or_else(|| cfg.miner.default_wallet.clone());
    let worker = req
        .as_ref()
        .and_then(|r| r.worker.clone())
        .unwrap_or_else(|| cfg.miner.default_worker.clone());
    let backend = req
        .as_ref()
        .and_then(|r| r.gpu_backend.clone())
        .unwrap_or_else(|| cfg.miner.default_gpu_backend.clone());

    let mut cmd = Command::new(&cfg.miner.binary_path);
    cmd.arg("--pool").arg(&pool);
    if !wallet.is_empty() {
        cmd.arg("--wallet").arg(&wallet);
    }
    cmd.arg("--worker").arg(&worker);

    match backend.as_str() {
        "opencl" => { cmd.arg("--gpu").arg("opencl"); }
        "cuda" => { cmd.arg("--gpu").arg("cuda"); }
        "metal" => { cmd.arg("--gpu").arg("metal"); }
        "cpu" => { cmd.arg("--cpu"); }
        _ => {}
    }

    for arg in &cfg.miner.extra_args {
        cmd.arg(arg);
    }

    // Env vars pro loop count (dulezite pro pool)
    cmd.env("ZION_LOOP_COUNT", "1000000");
    cmd.env("ZION_NONCE_COUNT", "4096");

    // Capture stdout/stderr pro parsing
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    info!("Spoustim miner: {:?}", cmd);

    let mut child = cmd.spawn()?;
    let pid = child
        .id()
        .ok_or_else(|| anyhow::anyhow!("Nepodarilo se ziskat PID"))?;

    *state.miner_pid.write().await = Some(pid);

    // Spawn stdout parser
    if let Some(stdout) = child.stdout.take() {
        crate::miner_parser::spawn_stdout_parser(stdout, state.miner_stats.clone());
    }

    // Spawn stderr logger (forward to agent log)
    if let Some(stderr) = child.stderr.take() {
        let stats_clone = state.miner_stats.clone();
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains("error") || line.contains("ERROR") || line.contains("panic") {
                    error!("miner stderr: {}", line);
                } else {
                    info!("miner stderr: {}", line);
                }
                // Parsovat i stderr pro share status
                crate::miner_parser::parse_line(&line, &stats_clone).await;
            }
        });
    }

    // Spawn process monitor
    let state_clone = state.clone();
    tokio::spawn(async move {
        let status = child.wait().await;
        match status {
            Ok(s) => {
                info!("Miner proces skoncil: {}", s);
                *state_clone.miner_pid.write().await = None;
            }
            Err(e) => {
                error!("Chyba pri cekani na miner: {}", e);
                *state_clone.miner_pid.write().await = None;
            }
        }
    });

    Ok(pid)
}

pub async fn stop_miner(state: Arc<AgentState>) -> anyhow::Result<()> {
    let pid_opt = *state.miner_pid.read().await;
    if let Some(pid) = pid_opt {
        info!("Zastavuji miner (PID {})...", pid);
        #[cfg(unix)]
        {
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;
            let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            let _ = kill(Pid::from_raw(pid as i32), Signal::SIGKILL);
        }
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .arg("/PID")
                .arg(pid.to_string())
                .arg("/F")
                .output()
                .await;
        }
        *state.miner_pid.write().await = None;
        // Reset stats
        *state.miner_stats.write().await = miner_parser::MinerStats::default();
    } else {
        warn!("Miner nebezi, neni co zastavit");
    }
    Ok(())
}

pub async fn restart_miner(
    state: Arc<AgentState>,
    req: Option<crate::StartMinerRequest>,
) -> anyhow::Result<u32> {
    stop_miner(state.clone()).await.ok();
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    start_miner(state, req).await
}
