//! CLI demo: runs a simulated PoC network and prints per-epoch reports.
//!
//! ```bash
//! cargo run -p poc-sim
//! cargo run -p poc-sim -- --epochs 20 --validators 8
//! cargo run -p poc-sim -- --hiran-url http://127.0.0.1:9000 --epochs 3
//! ```

use clap::Parser;
use poc_core::CareScoreComponents;
use poc_sim::{EpochReport, NetworkSimulator, SimulatedValidator};

/// PoC-lab network simulator — ZION Proof-of-Care demonstration
#[derive(Parser, Debug)]
#[command(name = "poc-sim", about = "ZION Proof-of-Care network simulator", version)]
struct Cli {
    /// Number of epochs to simulate
    #[arg(short, long, default_value_t = 5)]
    epochs: u64,

    /// Number of auto-generated validators (1–64)
    #[arg(short, long, default_value_t = 4)]
    validators: u8,

    /// Optional URL for a live Hiran AI inference server
    #[arg(long)]
    hiran_url: Option<String>,

    /// Block reward in flower units
    #[arg(long, default_value_t = 1_000_000)]
    block_reward: u64,

    /// Minimum stake required
    #[arg(long, default_value_t = 1_000)]
    min_stake: u64,

    /// Minimum care score needed to be accepted
    #[arg(long, default_value_t = 1_000_000)]
    min_care_score: u64,

    /// Show extended Hiran stats
    #[arg(long, default_value_t = false)]
    verbose: bool,

    /// Output results as JSON (for dashboard/API consumption)
    #[arg(long, default_value_t = false)]
    json: bool,
}

fn main() {
    let cli = Cli::parse();

    let seed = *blake3::hash(b"poc-lab-demo-genesis-seed").as_bytes();
    let mut sim = NetworkSimulator::new(seed, cli.block_reward, cli.min_stake, cli.min_care_score);

    if let Some(ref url) = cli.hiran_url {
        sim = sim.with_hiran_url(url.clone());
    }

    let count = cli.validators.clamp(1, 64);
    if count <= 4 {
        add_classic_validators(&mut sim);
    } else {
        add_auto_validators(&mut sim, count);
    }

    let (reports, errors) = sim.run_epochs(0, cli.epochs);

    if cli.json {
        let json_output = serde_json::json!({
            "config": {
                "epochs": cli.epochs,
                "validators": count,
                "block_reward": cli.block_reward,
                "min_stake": cli.min_stake,
                "min_care_score": cli.min_care_score,
                "hiran_url": cli.hiran_url,
                "hiran_stub_mode": cli.hiran_url.is_none(),
                "reward_split": {
                    "care_validators_bps": sim.reward_split.care_validators_bps,
                    "humanitarian_bps": sim.reward_split.humanitarian_bps,
                    "dao_treasury_bps": sim.reward_split.dao_treasury_bps,
                    "warp_maintenance_bps": sim.reward_split.warp_maintenance_bps,
                    "hiran_research_bps": sim.reward_split.hiran_research_bps,
                },
            },
            "reports": &reports,
            "errors": errors.iter().map(|e| e.to_string()).collect::<Vec<_>>(),
            "summary": {
                "total_accepted": reports.iter().map(|r| r.accepted_count()).sum::<usize>(),
                "total_rejected": reports.iter().map(|r| r.rejected_count()).sum::<usize>(),
                "total_payout": reports.iter().map(|r| r.total_payout()).sum::<u64>(),
            },
        });
        println!("{}", serde_json::to_string_pretty(&json_output).unwrap());
        return;
    }

    println!("=== PoC-lab network simulation ===");
    println!(
        "epochs={} validators={} block_reward={} min_stake={} min_care_score={}",
        cli.epochs, count, cli.block_reward, cli.min_stake, cli.min_care_score
    );
    if let Some(ref url) = cli.hiran_url {
        println!("hiran_url={url}");
    } else {
        println!("hiran=stub (no --hiran-url provided)");
    }
    println!("reward_split={:?}", sim.reward_split);
    println!();
    println!("Vow legend:");
    println!("  [S]  = Sefirot Vow only");
    println!("  [S+B]= Sefirot + Bodhisattva Vow (Guardian, +5% care bonus)");
    println!();

    for report in &reports {
        print_epoch_report(report, cli.verbose);
    }

    if !errors.is_empty() {
        println!("=== {} epoch error(s) ===", errors.len());
        for e in &errors {
            println!("  ERROR: {e}");
        }
    }

    let total_accepted: usize = reports.iter().map(|r| r.accepted_count()).sum();
    let total_rejected: usize = reports.iter().map(|r| r.rejected_count()).sum();
    let total_payout: u64 = reports.iter().map(|r| r.total_payout()).sum();
    println!("=== Summary: {} epochs ===", reports.len());
    println!("  total accepted proofs : {total_accepted}");
    println!("  total rejected proofs : {total_rejected}");
    println!("  total payout (flowers): {total_payout}");
}

fn add_classic_validators(sim: &mut NetworkSimulator) {
    let validators = vec![
        SimulatedValidator {
            id: [1u8; 32],
            name: "alice (honest, high-quality)".into(),
            stake: 10_000,
            quality: CareScoreComponents { accuracy_bps: 9800, timeliness_bps: 9500, coverage_bps: 9000 },
            is_guardian: false,
            ceremony_location: None,
        },
        SimulatedValidator {
            id: [2u8; 32],
            name: "bob (honest, average)".into(),
            stake: 8_000,
            quality: CareScoreComponents { accuracy_bps: 8000, timeliness_bps: 7500, coverage_bps: 7000 },
            is_guardian: false,
            ceremony_location: None,
        },
        SimulatedValidator {
            id: [4u8; 32],
            name: "diana (Guardian, dual-vow)".into(),
            stake: 9_000,
            quality: CareScoreComponents { accuracy_bps: 9800, timeliness_bps: 9500, coverage_bps: 9000 },
            is_guardian: true,
            ceremony_location: Some("Genesis Garden — under the oldest olive tree".into()),
        },
        SimulatedValidator {
            id: [3u8; 32],
            name: "carol (lazy, low-quality)".into(),
            stake: 5_000,
            quality: CareScoreComponents { accuracy_bps: 500, timeliness_bps: 500, coverage_bps: 500 },
            is_guardian: false,
            ceremony_location: None,
        },
    ];
    for v in validators {
        sim.add_validator(v).expect("validator setup should succeed");
    }
}

fn add_auto_validators(sim: &mut NetworkSimulator, count: u8) {
    for i in 0..count {
        let byte = i + 1;
        let (quality, is_guardian, ceremony_location) = if i == count - 1 {
            (CareScoreComponents { accuracy_bps: 500, timeliness_bps: 500, coverage_bps: 500 }, false, None)
        } else if i == count - 2 {
            (CareScoreComponents { accuracy_bps: 9500, timeliness_bps: 9000, coverage_bps: 8500 }, true, Some(format!("Ceremony Site {i}")))
        } else {
            let q = 7000u16 + (i as u16 * 100).min(2500);
            (CareScoreComponents { accuracy_bps: q, timeliness_bps: q.saturating_sub(300), coverage_bps: q.saturating_sub(600) }, false, None)
        };
        sim.add_validator(SimulatedValidator {
            id: [byte; 32],
            name: format!("v{i:02}"),
            stake: 5_000 + i as u64 * 100,
            quality,
            is_guardian,
            ceremony_location,
        }).expect("validator setup should succeed");
    }
}

fn print_epoch_report(report: &EpochReport, verbose: bool) {
    println!("--- Epoch {} (model_hash={}) ---", report.epoch, hex_prefix(&report.model_hash));
    println!(
        "  reward split: care={} humanitarian={} dao={} warp={} hiran={}",
        report.reward_distribution.care_validators,
        report.reward_distribution.humanitarian,
        report.reward_distribution.dao_treasury,
        report.reward_distribution.warp_maintenance,
        report.reward_distribution.hiran_research,
    );
    for v in &report.validators {
        let vow_tag = if v.dual_vow_bonus_applied { "[S+B]" } else { "[S]  " };
        if v.accepted {
            let hiran_tag = match v.hiran_verdict.as_ref() {
                Some(h) => format!(" hiran_conf={:.2}", h.confidence),
                None => String::new(),
            };
            let ncl_tag = if v.ncl_bonus > 0 { format!(" ncl_bonus={}", v.ncl_bonus) } else { String::new() };
            println!(
                "  [ACCEPTED] {} {:<36} care_score={:<10} payout={}{}{}",
                vow_tag, v.name, v.care_score, v.payout, hiran_tag, ncl_tag
            );
        } else {
            println!(
                "  [REJECTED] {}  {:<36} reason={}",
                vow_tag, v.name, v.rejection_reason.as_deref().unwrap_or("unknown")
            );
        }
    }
    let h = &report.hiran_stats;
    let mode = if h.stub_mode { "stub" } else { "live" };
    if verbose || h.proofs_validated > 0 {
        println!(
            "  hiran[{}]: validated={} accepted={} warned={} rejected={} uncertain={} avg_conf={:.3}",
            mode, h.proofs_validated, h.accepted, h.accepted_with_warning,
            h.rejected, h.uncertain, h.avg_confidence
        );
    }
    for alert in &report.anomaly_alerts {
        println!("  [ANOMALY] severity={} type={} — {}", alert.severity, alert.anomaly_type, alert.description);
    }
    println!(
        "  network_health={} | totals: accepted={} rejected={} total_payout={}\n",
        report.network_health, report.accepted_count(), report.rejected_count(), report.total_payout()
    );
}

fn hex_prefix(bytes: &[u8; 32]) -> String {
    bytes[..8].iter().map(|b| format!("{b:02x}")).collect()
}
