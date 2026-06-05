//! ZionOS Agent — rig daemon that manages miner process, collects GPU telemetry,
//! and communicates with the ZionOS dashboard.
//!
//! Usage:
//!   zionos-agent --dashboard <url> --miner <binary> --pool <addr> --wallet <addr>
//!                [--worker <name>] [--threads N] [--telemetry-interval N]

mod gpu;
mod process;

use anyhow::{anyhow, Result};
use std::sync::mpsc;
use std::time::{Duration, Instant};

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("[FATAL] {e:#}");
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let args = parse_args()?;

    println!("╔══════════════════════════════════════════╗");
    println!("║   ZionOS Agent v{}                ║", env!("CARGO_PKG_VERSION"));
    println!("║   Rig Management Daemon                  ║");
    println!("╚══════════════════════════════════════════╝");
    println!();
    println!("  dashboard:  {}", args.dashboard_url);
    println!("  miner:      {}", args.miner_binary);
    println!("  pool:       {}", args.pool);
    println!("  wallet:     {}", args.wallet);
    println!("  worker:     {}", args.worker);
    println!("  threads:    {}", args.threads);
    println!("  interval:   {}s", args.telemetry_interval);
    println!();

    let rig_id = format!("rig-{}", args.worker);

    // Register with dashboard
    register_rig(&args, &rig_id).await;

    // Spawn the miner process
    let mut miner = process::MinerProcess::spawn(
        &args.miner_binary,
        &args.pool,
        &args.wallet,
        &args.worker,
        args.threads,
        Some(&args.dashboard_url),
    )?;

    println!("[AGENT] miner started (pid={})", miner.pid());
    push_log(&args.dashboard_url, &rig_id, "info", &format!("Agent started miner (pid={})", miner.pid())).await;

    let http = reqwest::Client::new();
    let interval = Duration::from_secs(args.telemetry_interval);
    let mut last_telemetry = Instant::now();
    let mut miner_running = true;
    let mut restart_count = 0u32;

    loop {
        // Drain miner events
        loop {
            match miner.event_rx.try_recv() {
                Ok(process::MinerEvent::Stdout(line)) => {
                    println!("[MINER] {line}");

                    // Forward important lines to dashboard
                    let level = if line.contains("[ACCEPTED]") || line.contains("[CONNECTED]") {
                        "info"
                    } else if line.contains("[REJECTED]") || line.contains("[WARN]") {
                        "warn"
                    } else if line.contains("[ERROR]") || line.contains("[FATAL]") {
                        "error"
                    } else if line.contains("[STATS]") || line.contains("[JOB]") || line.contains("[FOUND]") {
                        "info"
                    } else {
                        continue; // Skip noisy lines
                    };

                    push_log(&args.dashboard_url, &rig_id, level, &line).await;
                }
                Ok(process::MinerEvent::Stderr(line)) => {
                    eprintln!("[MINER:ERR] {line}");
                    if line.contains("[pool]") || line.contains("[TELEMETRY]") || line.contains("[INFO]") {
                        push_log(&args.dashboard_url, &rig_id, "info", &line).await;
                    } else {
                        push_log(&args.dashboard_url, &rig_id, "warn", &line).await;
                    }
                }
                Ok(process::MinerEvent::Exit(code)) => {
                    eprintln!("[AGENT] miner exited with code {code}");
                    push_log(&args.dashboard_url, &rig_id, "error", &format!("Miner exited (code={code})")).await;
                    miner_running = false;
                }
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => {
                    miner_running = false;
                    break;
                }
            }
        }

        // Check if miner is still running
        if miner_running && !miner.is_running() {
            let code = miner.exit_code().unwrap_or(-1);
            eprintln!("[AGENT] miner exited (code={code})");
            push_log(&args.dashboard_url, &rig_id, "error", &format!("Miner exited (code={code})")).await;
            miner_running = false;
        }

        // Auto-restart on crash
        if !miner_running {
            restart_count += 1;
            let delay = (restart_count as u64 * 5).min(60);
            eprintln!("[AGENT] restarting miner in {delay}s (attempt #{restart_count})");
            push_log(&args.dashboard_url, &rig_id, "warn", &format!("Restarting miner in {delay}s (attempt #{restart_count})")).await;

            tokio::time::sleep(Duration::from_secs(delay)).await;

            match process::MinerProcess::spawn(
                &args.miner_binary,
                &args.pool,
                &args.wallet,
                &args.worker,
                args.threads,
                Some(&args.dashboard_url),
            ) {
                Ok(new_miner) => {
                    miner = new_miner;
                    miner_running = true;
                    println!("[AGENT] miner restarted (pid={})", miner.pid());
                    push_log(&args.dashboard_url, &rig_id, "info", &format!("Miner restarted (pid={})", miner.pid())).await;
                }
                Err(e) => {
                    eprintln!("[AGENT] failed to restart miner: {e}");
                    push_log(&args.dashboard_url, &rig_id, "error", &format!("Restart failed: {e}")).await;
                }
            }
        } else {
            restart_count = 0;
        }

        // Periodic GPU telemetry
        if last_telemetry.elapsed() >= interval {
            last_telemetry = Instant::now();

            let gpus = gpu::read_gpu_sensors();
            let gpu_data = gpus.first().cloned();

            let payload = serde_json::json!({
                "gpu_temp_c": gpu_data.as_ref().and_then(|g| g.temp_c),
                "gpu_power_w": gpu_data.as_ref().and_then(|g| g.power_w),
                "gpu_fan_pct": gpu_data.as_ref().and_then(|g| g.fan_pct),
                // hashrate/accepted/rejected come from miner's own telemetry
                "hashrate": 0,
                "accepted": 0,
                "rejected": 0,
                "uptime_s": 0,
                "difficulty": 0,
                "total_hashes": 0,
            });

            let url = format!("{}/api/rigs/{}/telemetry", args.dashboard_url, rig_id);
            let _ = http.put(&url)
                .json(&payload)
                .send()
                .await;

            // Also update GPU info on the rig
            if let Some(gpu) = gpu_data {
                let gpu_payload = serde_json::json!({
                    "name": gpu.name,
                    "vendor": gpu.vendor,
                    "vram_mb": gpu.vram_mb,
                    "driver": gpu.driver,
                    "temp_c": gpu.temp_c,
                    "power_w": gpu.power_w,
                    "fan_pct": gpu.fan_pct,
                    "core_mhz": gpu.core_mhz,
                    "mem_mhz": gpu.mem_mhz,
                });
                let url = format!("{}/api/rigs/{}/gpu", args.dashboard_url, rig_id);
                let _ = http.put(&url)
                    .json(&gpu_payload)
                    .send()
                    .await;
            }
        }

        // Poll dashboard command queue
        if let Some(cmd) = poll_next_command(&http, &args.dashboard_url, &rig_id).await {
            let command_id = cmd
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let command_name = cmd
                .get("command")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();

            if !command_id.is_empty() && !command_name.is_empty() {
                let (ok, msg): (bool, String) = match command_name.as_str() {
                    "stop" => {
                        if miner_running {
                            miner.stop();
                            miner_running = false;
                            (true, "miner stopped".to_string())
                        } else {
                            (true, "miner already stopped".to_string())
                        }
                    }
                    "start" => {
                        if miner_running {
                            (true, "miner already running".to_string())
                        } else {
                            match process::MinerProcess::spawn(
                                &args.miner_binary,
                                &args.pool,
                                &args.wallet,
                                &args.worker,
                                args.threads,
                                Some(&args.dashboard_url),
                            ) {
                                Ok(new_miner) => {
                                    miner = new_miner;
                                    miner_running = true;
                                    (true, "miner started".to_string())
                                }
                                Err(e) => (false, format!("start failed: {e}")),
                            }
                        }
                    }
                    "restart" => {
                        if miner_running {
                            miner.stop();
                            miner_running = false;
                        }
                        match process::MinerProcess::spawn(
                            &args.miner_binary,
                            &args.pool,
                            &args.wallet,
                            &args.worker,
                            args.threads,
                            Some(&args.dashboard_url),
                        ) {
                            Ok(new_miner) => {
                                miner = new_miner;
                                miner_running = true;
                                (true, "miner restarted".to_string())
                            }
                            Err(e) => (false, format!("restart failed: {e}")),
                        }
                    }
                    "reboot" => {
                        // Agent cannot hard reboot host in this baseline implementation.
                        (false, "reboot not implemented in agent baseline".to_string())
                    }
                    other => {
                        (false, format!("unknown command: {other}"))
                    }
                };

                let status = if ok { "acked" } else { "failed" };
                push_log(&args.dashboard_url, &rig_id, if ok { "info" } else { "error" }, &format!("command {} -> {} ({msg})", command_name, status)).await;
                ack_command(&http, &args.dashboard_url, &rig_id, &command_id, status, &msg).await;
            }
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

async fn register_rig(args: &Args, rig_id: &str) {
    let gpus = gpu::read_gpu_sensors();
    let gpu_data = gpus.first().map(|g| serde_json::json!({
        "name": g.name,
        "vendor": g.vendor,
        "vram_mb": g.vram_mb,
        "driver": g.driver,
        "temp_c": g.temp_c,
        "power_w": g.power_w,
        "fan_pct": g.fan_pct,
        "core_mhz": g.core_mhz,
        "mem_mhz": g.mem_mhz,
    }));

    let payload = serde_json::json!({
        "id": rig_id,
        "name": format!("ZionRig-{}", args.worker),
        "wallet": args.wallet,
        "worker": args.worker,
        "pool_addr": args.pool,
        "status": "online",
        "gpu": gpu_data,
        "stats": {
            "hashrate": 0, "hashrate_1h": 0, "hashrate_24h": 0,
            "accepted": 0, "rejected": 0, "stale": 0,
            "uptime_s": 0, "difficulty": 0, "last_share_time": null,
            "total_hashes": 0
        },
        "config": {
            "threads": args.threads,
            "gpu_mode": "cpu",
            "intensity": null
        },
        "last_seen": 0
    });

    let http = reqwest::Client::new();
    let url = format!("{}/api/rigs", args.dashboard_url);
    match http.post(&url).json(&payload).send().await {
        Ok(resp) if resp.status().is_success() => {
            println!("[AGENT] rig registered: {rig_id}");
        }
        Ok(resp) if resp.status().as_u16() == 409 => {
            println!("[AGENT] rig already registered: {rig_id}");
        }
        Ok(resp) => {
            eprintln!("[AGENT] registration returned {}", resp.status());
        }
        Err(e) => {
            eprintln!("[AGENT] registration failed: {e}");
        }
    }
}

async fn push_log(dashboard_url: &str, rig_id: &str, level: &str, message: &str) {
    let payload = serde_json::json!({
        "rig_id": rig_id,
        "level": level,
        "message": message,
    });
    let http = reqwest::Client::new();
    let url = format!("{}/api/logs", dashboard_url);
    let _ = http.post(&url).json(&payload).send().await;
}

async fn poll_next_command(http: &reqwest::Client, dashboard_url: &str, rig_id: &str) -> Option<serde_json::Value> {
    let url = format!("{}/api/rigs/{}/commands/next", dashboard_url, rig_id);
    let resp = http.get(&url).send().await.ok()?;
    let json = resp.json::<serde_json::Value>().await.ok()?;
    json.get("command").cloned().filter(|v| !v.is_null())
}

async fn ack_command(
    http: &reqwest::Client,
    dashboard_url: &str,
    rig_id: &str,
    command_id: &str,
    status: &str,
    message: &str,
) {
    let url = format!("{}/api/rigs/{}/commands/{}/ack", dashboard_url, rig_id, command_id);
    let payload = serde_json::json!({
        "status": status,
        "message": message,
    });
    let _ = http.post(&url).json(&payload).send().await;
}

// ── CLI argument parsing ──

struct Args {
    dashboard_url: String,
    miner_binary: String,
    pool: String,
    wallet: String,
    worker: String,
    threads: u32,
    telemetry_interval: u64,
}

fn parse_args() -> Result<Args> {
    let args: Vec<String> = std::env::args().collect();

    let dashboard_url = get_arg(&args, "--dashboard")
        .or_else(|| std::env::var("ZIONOS_DASHBOARD_URL").ok())
        .ok_or_else(|| anyhow!("--dashboard <url> required (e.g. http://localhost:8888)"))?;

    let miner_binary = get_arg(&args, "--miner")
        .or_else(|| std::env::var("ZIONOS_MINER_BIN").ok())
        .unwrap_or_else(|| "zionos-miner".to_string());

    let pool = get_arg(&args, "--pool")
        .or_else(|| std::env::var("ZION_POOL_ADDR").ok())
        .ok_or_else(|| anyhow!("--pool <host:port> required"))?;

    let wallet = get_arg(&args, "--wallet")
        .or_else(|| std::env::var("ZION_MINER_ID").ok())
        .ok_or_else(|| anyhow!("--wallet <zion1…> required"))?;

    let worker = get_arg(&args, "--worker")
        .or_else(|| std::env::var("ZION_WORKER_NAME").ok())
        .unwrap_or_else(|| {
            hostname().unwrap_or_else(|| "zionos-rig".to_string())
        });

    let threads = get_arg(&args, "--threads")
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(|| {
            let cpus = std::thread::available_parallelism()
                .map(|n| n.get() as u32)
                .unwrap_or(4);
            if cpus > 2 { cpus - 1 } else { 1 }
        });

    let telemetry_interval = get_arg(&args, "--telemetry-interval")
        .and_then(|s| s.parse().ok())
        .unwrap_or(15);

    Ok(Args {
        dashboard_url,
        miner_binary,
        pool,
        wallet,
        worker,
        threads,
        telemetry_interval,
    })
}

fn get_arg(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn hostname() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/etc/hostname")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }
    #[cfg(not(target_os = "linux"))]
    {
        std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .ok()
    }
}
