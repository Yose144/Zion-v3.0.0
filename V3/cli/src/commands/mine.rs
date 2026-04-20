use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::ui;

#[derive(Subcommand)]
pub enum MineCmd {
    /// Start mining (pool mode by default)
    Start {
        /// Pool address host:port
        #[arg(long)]
        pool: Option<String>,
        /// Wallet address
        #[arg(long)]
        wallet: Option<String>,
        /// Number of threads (default: auto)
        #[arg(long)]
        threads: Option<String>,
        /// Backend: auto | cpu | gpu | metal | opencl
        #[arg(long)]
        backend: Option<String>,
        /// Profile: pool | solo | benchmark | dual
        #[arg(long, default_value = "pool")]
        profile: String,
    },
    /// Stop the mining process
    Stop,
    /// CPU Blake3 benchmark
    Bench {
        #[arg(long)]
        gpu: bool,
        /// Cosmic Harmony Ekam Deeksha benchmark
        #[arg(long)]
        ekam: bool,
        /// Benchmark duration in seconds
        #[arg(long, default_value = "5")]
        secs: u64,
    },
    /// Show live mining status
    Status,
    /// DCR stealth worker control
    Dcr {
        #[command(subcommand)]
        cmd: DcrCmd,
    },
}

#[derive(Subcommand)]
pub enum DcrCmd {
    /// Start DCR stealth worker
    Start,
    /// Stop DCR stealth worker
    Stop,
    /// Show DCR stats
    Status,
}

pub async fn run(cfg: &Config, cmd: MineCmd) -> Result<()> {
    match cmd {
        MineCmd::Start { pool, wallet, threads, backend, profile } => {
            let pool_addr = pool.unwrap_or_else(|| {
                format!("{}:{}", cfg.pool.host, cfg.pool.port)
            });
            let wallet_addr = wallet.unwrap_or_else(|| cfg.miner.wallet.clone());
            let thread_count = threads.unwrap_or_else(|| cfg.miner.threads.clone());
            let be = backend.unwrap_or_else(|| cfg.miner.backend.clone());

            ui::print_header("Starting Miner");
            ui::print_row("Pool", &pool_addr);
            ui::print_row("Wallet", if wallet_addr.is_empty() { "(not set)" } else { &wallet_addr });
            ui::print_row("Backend", &be);
            ui::print_row("Threads", &thread_count);
            ui::print_row("Profile", &profile);
            println!();

            if wallet_addr.is_empty() {
                ui::print_warn("No wallet set. Run: zion config set miner.wallet <address>");
                ui::print_warn("Or: zion wallet new");
                return Ok(());
            }

            // Build env for miner binary
            let mut env_args = vec![
                ("ZION_POOL_ADDR", pool_addr.clone()),
                ("ZION_PROFILE", profile.clone()),
            ];
            if !wallet_addr.is_empty() {
                env_args.push(("ZION_BTC_WALLET", wallet_addr.clone()));
            }
            if thread_count != "auto" {
                env_args.push(("ZION_DETECT_THREADS", thread_count.clone()));
            }

            let miner_bin = find_miner_binary()?;
            ui::print_info(&format!("Running: {}", miner_bin));

            let mut cmd_proc = std::process::Command::new(&miner_bin);
            for (k, v) in &env_args {
                cmd_proc.env(k, v);
            }
            if be == "gpu" || be == "metal" || be == "opencl" {
                cmd_proc.arg("--gpu");
            }
            cmd_proc.status()?;
            Ok(())
        }

        MineCmd::Bench { gpu, ekam, secs } => {
            ui::print_header("Benchmark");
            let miner_bin = find_miner_binary()?;

            let mut cmd_proc = std::process::Command::new(&miner_bin);
            cmd_proc.env("ZION_BENCH_SECS", secs.to_string());

            if ekam {
                ui::print_info("Mode: Cosmic Harmony Ekam Deeksha v2");
                cmd_proc.env("ZION_PROFILE", "benchmark");
            } else if gpu {
                ui::print_info("Mode: GPU Blake3");
                cmd_proc.arg("--gpu-bench");
            } else {
                ui::print_info("Mode: CPU Blake3");
                cmd_proc.arg("--bench");
            }

            cmd_proc.status()?;
            Ok(())
        }

        MineCmd::Stop => {
            // Best-effort: kill any zion-miner process
            let _ = std::process::Command::new("pkill").arg("-f").arg("zion-miner").status();
            ui::print_ok("Sent stop signal to miner processes");
            Ok(())
        }

        MineCmd::Status => {
            ui::print_header("Miner Status");
            // Check if a miner process is running
            let output = std::process::Command::new("pgrep")
                .arg("-f")
                .arg("zion-miner")
                .output();
            match output {
                Ok(o) if o.status.success() => {
                    ui::print_ok("Miner is running");
                    let pids = String::from_utf8_lossy(&o.stdout);
                    ui::print_row("PIDs", pids.trim());
                }
                _ => ui::print_warn("No miner process detected"),
            }
            println!();
            Ok(())
        }

        MineCmd::Dcr { cmd } => match cmd {
            DcrCmd::Status => {
                ui::print_header("DCR Stealth Worker");
                ui::print_info("DCR worker runs inside the miner process.");
                ui::print_info("Start with: zion mine start --profile dual");
                println!();
                Ok(())
            }
            DcrCmd::Start => {
                ui::print_info("Starting DCR-only stealth miner...");
                let miner_bin = find_miner_binary()?;
                std::process::Command::new(&miner_bin)
                    .env("ZION_DCR_ONLY", "1")
                    .status()?;
                Ok(())
            }
            DcrCmd::Stop => {
                let _ = std::process::Command::new("pkill").arg("-f").arg("zion-miner").status();
                ui::print_ok("Sent stop signal");
                Ok(())
            }
        },
    }
}

fn find_miner_binary() -> Result<String> {
    // 1. Try PATH
    if let Ok(p) = which_bin("zion-miner") {
        return Ok(p);
    }
    // 2. Try workspace release build
    let release = "V3/target/release/zion-miner";
    if std::path::Path::new(release).exists() {
        return Ok(release.to_string());
    }
    // 3. Try debug build
    let debug = "V3/target/debug/zion-miner";
    if std::path::Path::new(debug).exists() {
        return Ok(debug.to_string());
    }
    anyhow::bail!(
        "zion-miner binary not found. Build with:\n  cd V3 && cargo build -p zion-miner --release"
    )
}

fn which_bin(name: &str) -> Result<String> {
    let out = std::process::Command::new("which").arg(name).output()?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        anyhow::bail!("not found")
    }
}
