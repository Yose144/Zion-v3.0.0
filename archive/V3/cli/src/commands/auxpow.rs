use anyhow::Result;
use clap::Subcommand;
use std::env;

use crate::ui;

#[derive(Subcommand)]
pub enum AuxPowCmd {
    /// Show effective AuxPow configuration from environment variables.
    ///
    /// The pool server reads these env vars on startup; the CLI only
    /// displays the values that would currently apply.
    Status,
    /// List supported external coins and their per-coin wallet env vars.
    Coins,
    /// Print a short guide for configuring AuxPow on the pool server.
    Explain,
}

const EXTERNAL_COINS: &[&str] = &[
    "DCR", "ALPH", "KAS", "ERG", "RVN", "ETC", "EVR", "MEWC", "FLUX", "CLORE", "XMR", "VRSC",
];

pub async fn run(_cmd: AuxPowCmd) -> Result<()> {
    match _cmd {
        AuxPowCmd::Status => print_status(),
        AuxPowCmd::Coins => print_coins(),
        AuxPowCmd::Explain => print_explain(),
    }
}

fn env_or_missing(key: &str) -> String {
    env::var(key).unwrap_or_else(|_| "(not set)".to_string())
}

fn print_status() -> Result<()> {
    ui::print_header("AuxPow Configuration (from environment)");

    ui::print_header("Scheduler (external merge mining revenue)");
    ui::print_row("ZION_AUXPOW_ENABLED", &env_or_missing("ZION_AUXPOW_ENABLED"));
    ui::print_row("ZION_AUXPOW_WALLET", &env_or_missing("ZION_AUXPOW_WALLET"));
    ui::print_row("ZION_AUXPOW_WORKER_NAME", &env_or_missing("ZION_AUXPOW_WORKER_NAME"));
    ui::print_row("ZION_AUXPOW_COIN", &env_or_missing("ZION_AUXPOW_COIN"));
    ui::print_row(
        "ZION_AUXPOW_PROFIT_CHECK_INTERVAL",
        &env_or_missing("ZION_AUXPOW_PROFIT_CHECK_INTERVAL"),
    );
    ui::print_row(
        "ZION_AUXPOW_HYSTERESIS_PCT",
        &env_or_missing("ZION_AUXPOW_HYSTERESIS_PCT"),
    );
    ui::print_row("ZION_AUXPOW_EASY_TARGET", &env_or_missing("ZION_AUXPOW_EASY_TARGET"));

    println!();
    ui::print_header("Pool B2B Bridge (external Stratum job multiplexing)");
    ui::print_row(
        "ZION_POOL_AUXPOW_ENABLED",
        &env_or_missing("ZION_POOL_AUXPOW_ENABLED"),
    );
    ui::print_row("ZION_POOL_AUXPOW_COIN", &env_or_missing("ZION_POOL_AUXPOW_COIN"));
    ui::print_row(
        "ZION_POOL_AUXPOW_SPLIT_ZION",
        &env_or_missing("ZION_POOL_AUXPOW_SPLIT_ZION"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_SPLIT_EXTERNAL",
        &env_or_missing("ZION_POOL_AUXPOW_SPLIT_EXTERNAL"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_WALLET",
        &env_or_missing("ZION_POOL_AUXPOW_WALLET"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_WORKER_NAME",
        &env_or_missing("ZION_POOL_AUXPOW_WORKER_NAME"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_POOL_PREFERENCE",
        &env_or_missing("ZION_POOL_AUXPOW_POOL_PREFERENCE"),
    );
    ui::print_row("ZION_POOL_AUXPOW_REGION", &env_or_missing("ZION_POOL_AUXPOW_REGION"));
    ui::print_row(
        "ZION_POOL_AUXPOW_PROFIT_CHECK_INTERVAL",
        &env_or_missing("ZION_POOL_AUXPOW_PROFIT_CHECK_INTERVAL"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_HYSTERESIS_PCT",
        &env_or_missing("ZION_POOL_AUXPOW_HYSTERESIS_PCT"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_CPU_COIN",
        &env_or_missing("ZION_POOL_AUXPOW_CPU_COIN"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_CPU_WALLET",
        &env_or_missing("ZION_POOL_AUXPOW_CPU_WALLET"),
    );
    ui::print_row(
        "ZION_POOL_AUXPOW_CPU_WORKER_NAME",
        &env_or_missing("ZION_POOL_AUXPOW_CPU_WORKER_NAME"),
    );

    println!();
    ui::print_info("Note: These values are read by the pool server at startup.");
    ui::print_info("Change them in the pool systemd service EnvironmentFile, then restart the pool.");
    Ok(())
}

fn print_coins() -> Result<()> {
    ui::print_header("Supported External Coins");
    for coin in EXTERNAL_COINS {
        ui::print_row(coin, &format!("ZION_POOL_AUXPOW_WALLET_{}", coin));
    }
    println!();
    ui::print_info("Set the wallet env var for each coin you want to mine.");
    Ok(())
}

fn print_explain() -> Result<()> {
    println!();
    println!("AuxPow lets the ZION pool merge-mine external coins in two ways:");
    println!();
    println!("1. Scheduler revenue mode (ZION_AUXPOW_ENABLED=1)");
    println!("   The pool runs its own mining rigs on an external Stratum pool and");
    println!("   tracks the USD revenue for PPLNS distribution to ZION miners.");
    println!();
    println!("2. B2B bridge mode (ZION_POOL_AUXPOW_ENABLED=1)");
    println!("   ZION miners receive external jobs alongside ZION jobs. When they");
    println!("   find an external share, the pool forwards it to the chosen external");
    println!("   pool. Payouts go to ZION_POOL_AUXPOW_WALLET_<COIN>.");
    println!();
    println!("Common workflow:");
    println!("  export ZION_POOL_AUXPOW_ENABLED=1");
    println!("  export ZION_POOL_AUXPOW_COIN=RVN");
    println!("  export ZION_POOL_AUXPOW_WALLET_RVN=<your-rvn-address>");
    println!("  export ZION_POOL_AUXPOW_WALLET=<fallback-address>");
    println!("  export ZION_POOL_AUXPOW_WORKER_NAME=zion-pool");
    println!("  # then restart zion-edge-pool.service");
    println!();
    ui::print_info("Run `zion auxpow status` to see current env values.");
    ui::print_info("Run `zion auxpow coins` to see per-coin wallet env var names.");
    Ok(())
}
