//! Local miner control — start, stop, status.
//!
//! The public CLI does NOT bundle a miner binary. Instead it manages a
//! `zion-miner` process that the user downloads separately from the download page.
//! If the miner binary is not found, the user gets a clear download link.
//!
//! PID tracking file: ~/.zion/miner.pid

use anyhow::Result;
use clap::Subcommand;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::config::Config;
use crate::ui;

#[derive(Subcommand)]
pub enum MineCmd {
    /// Start mining (connects to the configured pool)
    Start {
        /// Override pool address (host:port)
        #[arg(long)]
        pool: Option<String>,
        /// Override wallet address
        #[arg(long)]
        wallet: Option<String>,
        /// Override algorithm: deeksha_lite_v1 | cosmic_harmony_ekam_deeksha_v2 | deeksha_lite_fire
        #[arg(long)]
        algorithm: Option<String>,
        /// Override backend: cpu | opencl | cuda | metal
        #[arg(long)]
        backend: Option<String>,
        /// Override worker name
        #[arg(long)]
        worker: Option<String>,
    },
    /// Stop the running miner
    Stop,
    /// Show miner process status
    Status,
}

pub async fn run(cfg: &Config, cmd: MineCmd) -> Result<()> {
    match cmd {
        MineCmd::Start {
            pool, wallet, algorithm, backend, worker,
        } => start_mining(cfg, pool, wallet, algorithm, backend, worker).await,
        MineCmd::Stop => stop_mining(),
        MineCmd::Status => miner_status(),
    }
}

async fn start_mining(
    cfg: &Config,
    pool_override: Option<String>,
    wallet_override: Option<String>,
    algo_override: Option<String>,
    backend_override: Option<String>,
    worker_override: Option<String>,
) -> Result<()> {
    ui::print_header("Start Mining");

    let wallet = wallet_override.unwrap_or_else(|| cfg.miner.wallet.clone());
    if wallet.is_empty() {
        ui::print_err("No wallet address configured.");
        ui::print_info("Run: zion wallet new --mnemonic --set-default");
        ui::print_info("Or:  zion config set miner.wallet <your_address>");
        return Ok(());
    }

    let pool_addr = pool_override.unwrap_or_else(|| format!("{}:{}", cfg.pool.host, cfg.pool.port));
    let algorithm = algo_override.unwrap_or_else(|| cfg.miner.algorithm.clone());
    let backend = backend_override.unwrap_or_else(|| cfg.miner.backend.clone());
    let worker = worker_override.unwrap_or_else(|| cfg.miner.worker_name.clone());

    // Check if already running
    if let Some(pid) = read_pid() {
        if is_process_alive(pid) {
            ui::print_warn(&format!("Miner already running (PID {}). Run 'zion mine stop' first.", pid));
            return Ok(());
        }
    }

    // Find the miner binary
    let miner_bin = find_miner_binary();
    let miner_bin = match miner_bin {
        Some(p) => p,
        None => {
            ui::print_err("zion-miner binary not found.");
            ui::print_info("Download it from: https://zionterranova.com/download");
            ui::print_info("Or build from source: cargo build --release -p zion-miner (in V3/)");
            return Ok(());
        }
    };

    ui::print_row("Miner binary", &miner_bin.display().to_string());
    ui::print_row("Pool", &pool_addr);
    ui::print_row("Wallet", &wallet);
    ui::print_row("Worker", &worker);
    ui::print_row("Algorithm", &algorithm);
    ui::print_row("Backend", &backend);
    println!();

    let mut cmd = Command::new(&miner_bin);
    cmd.env("ZION_POOL_ADDR", &pool_addr);
    cmd.env("ZION_WORKER_NAME", &worker);
    cmd.env("ZION_MINER_ALGORITHM", &algorithm);
    cmd.env("ZION_PAYOUT_ADDRESS", &wallet);
    cmd.env("ZION_LOOP_COUNT", "1000000");

    match backend.as_str() {
        "opencl" => {
            cmd.env("ZION_GPU_BACKEND", "opencl");
            cmd.env("ZION_NONCE_COUNT_GPU", "262144");
        }
        "cuda" => {
            cmd.env("ZION_GPU_BACKEND", "cuda");
            cmd.env("ZION_NONCE_COUNT_GPU", "262144");
        }
        "metal" => {
            cmd.env("ZION_GPU_BACKEND", "metal");
            cmd.env("ZION_NONCE_COUNT_GPU", "262144");
        }
        _ => {
            cmd.env("ZION_NONCE_COUNT", "4096");
        }
    }

    // Spawn in background
    let child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            ui::print_err(&format!("Failed to start miner: {}", e));
            return Ok(());
        }
    };

    let pid = child.id();
    write_pid(pid)?;

    ui::print_ok(&format!("Miner started (PID {})", pid));
    ui::print_info("Watch output: the miner prints to its own console window.");
    ui::print_info("Stop with: zion mine stop");
    ui::print_info("Check status: zion mine status");
    println!();

    // Detach: we don't wait for the child
    std::mem::forget(child);

    Ok(())
}

fn stop_mining() -> Result<()> {
    ui::print_header("Stop Mining");

    let pid = match read_pid() {
        Some(p) => p,
        None => {
            ui::print_warn("No miner PID file found. Is the miner running?");
            return Ok(());
        }
    };

    if !is_process_alive(pid) {
        ui::print_warn(&format!("Process {} is not running (stale PID file).", pid));
        clear_pid();
        return Ok(());
    }

    #[cfg(windows)]
    {
        let result = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
        match result {
            Ok(_) => {
                ui::print_ok(&format!("Miner stopped (PID {})", pid));
                clear_pid();
            }
            Err(e) => ui::print_err(&format!("Failed to kill process: {}", e)),
        }
    }
    #[cfg(unix)]
    {
        let result = Command::new("kill").arg(pid.to_string()).output();
        match result {
            Ok(_) => {
                ui::print_ok(&format!("Miner stopped (PID {})", pid));
                clear_pid();
            }
            Err(e) => ui::print_err(&format!("Failed to kill process: {}", e)),
        }
    }

    println!();
    Ok(())
}

fn miner_status() -> Result<()> {
    ui::print_header("Miner Status");

    let pid = match read_pid() {
        Some(p) => p,
        None => {
            ui::print_warn("No miner running (no PID file).");
            ui::print_info("Start with: zion mine start");
            return Ok(());
        }
    };

    if is_process_alive(pid) {
        ui::print_ok(&format!("Miner is running (PID {})", pid));
    } else {
        ui::print_warn(&format!("Miner PID {} is not running (stale PID file).", pid));
        clear_pid();
    }

    println!();
    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn pid_file_path() -> Result<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| anyhow::anyhow!("cannot determine home directory"))?;
    let dir = PathBuf::from(home).join(".zion");
    Ok(dir.join("miner.pid"))
}

fn read_pid() -> Option<u32> {
    let path = pid_file_path().ok()?;
    let raw = fs::read_to_string(&path).ok()?;
    raw.trim().parse::<u32>().ok()
}

fn write_pid(pid: u32) -> Result<()> {
    let path = pid_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, pid.to_string())?;
    Ok(())
}

fn clear_pid() {
    if let Ok(path) = pid_file_path() {
        let _ = fs::remove_file(&path);
    }
}

fn is_process_alive(pid: u32) -> bool {
    #[cfg(windows)]
    {
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output();
        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.contains(&pid.to_string())
            }
            Err(_) => false,
        }
    }
    #[cfg(unix)]
    {
        Command::new("kill")
            .arg("-0")
            .arg(pid.to_string())
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

fn find_miner_binary() -> Option<PathBuf> {
    // 1. Check PATH
    let bin_name = if cfg!(windows) { "zion-miner.exe" } else { "zion-miner" };
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in path_var.split(if cfg!(windows) { ';' } else { ':' }) {
            let candidate = PathBuf::from(dir).join(bin_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // 2. Check ~/.zion/
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        let candidate = PathBuf::from(home).join(".zion").join(bin_name);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // 3. Check current directory
    let candidate = PathBuf::from(".").join(bin_name);
    if candidate.exists() {
        return Some(candidate);
    }

    None
}
