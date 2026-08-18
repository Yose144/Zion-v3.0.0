//! Simple interactive setup menu for zion-miner.
//!
//! When the miner is launched without arguments (or with `--menu`) and no
//! required env vars are set, this menu asks the user for the basics and
//! writes them into environment variables so the normal `MinerConfig` parser
//! picks them up.  SMOS/HiveOS wrappers that pass `--pool`/`--wallet`/etc.
//! skip the menu automatically.

use std::io::{self, IsTerminal, Write};

fn prompt(default: &str, text: &str) -> String {
    let mut stdout = io::stdout();
    if default.is_empty() {
        let _ = write!(stdout, "{text}: ");
    } else {
        let _ = write!(stdout, "{text} [{default}]: ");
    }
    let _ = stdout.flush();
    let mut line = String::new();
    let _ = io::stdin().read_line(&mut line);
    let trimmed = line.trim();
    if trimmed.is_empty() {
        default.to_string()
    } else {
        trimmed.to_string()
    }
}

fn prompt_required(text: &str) -> String {
    loop {
        let mut stdout = io::stdout();
        let _ = write!(stdout, "{text} (required): ");
        let _ = stdout.flush();
        let mut line = String::new();
        let _ = io::stdin().read_line(&mut line);
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
        println!("  ! Input is required.");
    }
}

fn prompt_choice(default: &str, text: &str, choices: &[&str]) -> String {
    loop {
        let val = prompt(default, text);
        if choices.contains(&val.as_str()) {
            return val;
        }
        println!("  ! Invalid choice. Use one of: {}", choices.join(", "));
    }
}

/// Print a friendly header and ask the user for the minimum required options.
fn run_menu() {
    println!();
    println!("============================================================");
    println!("  ZION Miner v3.1.0 — Interactive Setup");
    println!("============================================================");
    println!();
    println!("Leave a field empty to accept the [default].");
    println!();

    // Defaults
    let default_pool = "62.171.141.136:8444";
    let default_worker = format!(
        "{}-rig",
        std::env::var("USER").unwrap_or_else(|_| "desktop".into())
    );
    let default_worker: &str = &default_worker;

    // Platform-specific GPU backend hint
    let gpu_hint = if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
        "auto/metal/opencl/cpu"
    } else if cfg!(target_os = "macos") {
        "auto/opencl/cpu"
    } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
        "auto/cuda/cpu"
    } else if cfg!(target_os = "linux") {
        "auto/opencl/cuda/cpu"
    } else if cfg!(target_os = "windows") {
        "auto/cuda/opencl/cpu"
    } else {
        "auto/cpu"
    };

    let gpu_choices = ["auto", "opencl", "cuda", "metal", "cpu"];
    let profile_choices = ["pool", "solo", "benchmark"];

    let pool = prompt(default_pool, "Pool address");
    let wallet = prompt_required("Wallet address");
    let worker = prompt(default_worker, "Worker name");
    let gpu = prompt_choice("auto", &format!("GPU backend ({gpu_hint})"), &gpu_choices);
    let threads = prompt("auto", "CPU threads (auto or number)");
    let algorithm = prompt("deeksha_lite_v1", "Algorithm");
    let profile = prompt_choice("pool", "Profile", &profile_choices);

    // Set env vars for the normal config parser
    std::env::set_var("ZION_POOL_ADDR", pool);
    std::env::set_var("ZION_PAYOUT_ADDRESS", wallet);
    std::env::set_var("ZION_WORKER_NAME", worker);
    std::env::set_var("ZION_GPU_BACKEND", gpu);
    std::env::set_var("ZION_MINER_ALGORITHM", algorithm);
    std::env::set_var("ZION_PROFILE", profile);
    if !threads.is_empty() && threads != "auto" {
        std::env::set_var("ZION_THREADS", threads);
    }

    println!();
    println!("Starting ZION miner...");
    println!(
        "  pool:    {}",
        std::env::var("ZION_POOL_ADDR").unwrap_or_default()
    );
    println!(
        "  wallet:  {}",
        std::env::var("ZION_PAYOUT_ADDRESS").unwrap_or_default()
    );
    println!(
        "  worker:  {}",
        std::env::var("ZION_WORKER_NAME").unwrap_or_default()
    );
    println!(
        "  gpu:     {}",
        std::env::var("ZION_GPU_BACKEND").unwrap_or_default()
    );
    println!(
        "  threads: {}",
        std::env::var("ZION_THREADS").unwrap_or_else(|_| "auto".into())
    );
    println!(
        "  algo:    {}",
        std::env::var("ZION_MINER_ALGORITHM").unwrap_or_default()
    );
    println!(
        "  profile: {}",
        std::env::var("ZION_PROFILE").unwrap_or_default()
    );
    println!();
}

/// Decide whether to show the interactive setup menu.
///
/// Show it when:
///   - `--menu` is explicitly passed, or
///   - no CLI args are given, stdin is a TTY, and neither `--pool` nor
///     `--wallet` nor the corresponding env vars are set.
///
/// Skip it when:
///   - `--no-menu` is passed,
///   - `ZION_NO_MENU` is set to `1`/`true`,
///   - stdin is not a TTY (SMOS/pipe mode),
///   - the user already provided `--pool` or `--wallet` as arguments.
pub fn maybe_run() {
    let args: Vec<String> = std::env::args().collect();

    // Explicit opt-out
    if args.iter().any(|a| a == "--no-menu")
        || std::env::var("ZION_NO_MENU")
            .map(|v| v == "1" || v == "true")
            .unwrap_or(false)
    {
        return;
    }

    // Explicit opt-in
    let explicit_menu = args.iter().any(|a| a == "--menu");

    // If any runtime args are supplied, skip the menu unless --menu is explicit.
    // Special benchmark/help/detect flags also skip the menu.
    let special_flags = [
        "--verus-bench",
        "--randomx-bench",
        "--ekam-bench",
        "--gpu-benchmark-all",
        "--gpu-bench",
        "--bench",
        "--test-cuda-kernel",
        "--detect-hardware",
        "--auto-tune",
        "--help",
        "-h",
    ];
    let has_runtime_args = args.len() > 1
        && !explicit_menu
        && (args.iter().any(|a| {
            a.starts_with("--pool")
                || a.starts_with("--wallet")
                || a.starts_with("--worker")
                || a.starts_with("--gpu")
                || a.starts_with("--threads")
                || a.starts_with("--algorithm")
                || a.starts_with("--profile")
        }) || args.iter().any(|a| special_flags.contains(&a.as_str())));

    if has_runtime_args {
        return;
    }

    // Auto menu only when stdin is a real terminal and we are missing required config.
    if !explicit_menu {
        if !io::stdin().is_terminal() {
            return;
        }
        let has_pool = std::env::var("ZION_POOL_ADDR")
            .map(|v| !v.is_empty())
            .unwrap_or(false)
            || std::env::var("ZION_POOL")
                .map(|v| !v.is_empty())
                .unwrap_or(false);
        let has_wallet = std::env::var("ZION_PAYOUT_ADDRESS")
            .map(|v| !v.is_empty())
            .unwrap_or(false)
            || std::env::var("ZION_WALLET")
                .map(|v| !v.is_empty())
                .unwrap_or(false)
            || std::env::var("ZION_MINER_ID")
                .map(|v| !v.is_empty())
                .unwrap_or(false);
        if has_pool && has_wallet {
            return;
        }
    }

    run_menu();
}
