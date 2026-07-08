//! CLI demo: runs a small simulated PoC network across several epochs and
//! prints a per-epoch, per-validator report to stdout.
//!
//! ```bash
//! cargo run -p poc-sim
//! ```

use poc_core::CareScoreComponents;
use poc_sim::{EpochReport, NetworkSimulator, SimulatedValidator};

fn main() {
    let mut sim = NetworkSimulator::new(
        *blake3::hash(b"poc-lab-demo-genesis-seed").as_bytes(),
        1_000_000, // block reward (arbitrary flower units)
        1_000,     // min stake for Sybil resistance
        1_000_000, // min care score to be accepted
    );

    // Three validators:
    //   alice  — protocol-only validator (Sefirot Vow only)
    //   bob    — average validator, no guardian status
    //   diana  — L5 Guardian (Genesis Garden) with dual Sefirot + Bodhisattva Vow
    //            → receives +5 % dual-vow care score bonus each epoch
    //   carol  — lazy validator, will be rejected (care score below threshold)
    let validators = vec![
        SimulatedValidator {
            id: [1u8; 32],
            name: "alice (honest, high-quality)".into(),
            stake: 10_000,
            quality: CareScoreComponents {
                accuracy_bps: 9800,
                timeliness_bps: 9500,
                coverage_bps: 9000,
            },
            is_guardian: false,
            ceremony_location: None,
        },
        SimulatedValidator {
            id: [2u8; 32],
            name: "bob (honest, average)".into(),
            stake: 8_000,
            quality: CareScoreComponents {
                accuracy_bps: 8000,
                timeliness_bps: 7500,
                coverage_bps: 7000,
            },
            is_guardian: false,
            ceremony_location: None,
        },
        SimulatedValidator {
            id: [4u8; 32],
            name: "diana (Guardian, dual-vow)".into(),
            stake: 9_000,
            quality: CareScoreComponents {
                // Same quality as alice — difference is the +5% dual-vow bonus
                accuracy_bps: 9800,
                timeliness_bps: 9500,
                coverage_bps: 9000,
            },
            is_guardian: true,
            ceremony_location: Some("Genesis Garden — under the oldest olive tree".into()),
        },
        SimulatedValidator {
            id: [3u8; 32],
            name: "carol (lazy, low-quality)".into(),
            stake: 5_000,
            quality: CareScoreComponents {
                accuracy_bps: 500,
                timeliness_bps: 500,
                coverage_bps: 500,
            },
            is_guardian: false,
            ceremony_location: None,
        },
    ];

    for v in validators {
        sim.add_validator(v).expect("validator setup should succeed");
    }

    println!("=== PoC-lab network simulation ===");
    println!(
        "block_reward=1,000,000 min_stake=1,000 min_care_score=1,000,000 reward_split={:?}",
        sim.reward_split
    );
    println!();
    println!("Vow legend:");
    println!("  [S]  = Sefirot Vow only (technical validator pledge)");
    println!("  [S+B]= Sefirot + Bodhisattva Vow (Guardian dual-vow, +5% care bonus)");
    println!();

    for epoch in 0..5u64 {
        let report = sim.run_epoch(epoch).expect("epoch should run without fatal errors");
        print_epoch_report(&report);
    }
}

fn print_epoch_report(report: &EpochReport) {
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
            let ncl_tag = if v.ncl_bonus > 0 {
                format!(" ncl_bonus={}", v.ncl_bonus)
            } else {
                String::new()
            };
            println!(
                "  [ACCEPTED] {} {:<32} care_score={:<10} payout={}{}{}",
                vow_tag, v.name, v.care_score, v.payout, hiran_tag, ncl_tag
            );
        } else {
            println!(
                "  [REJECTED] {}  {:<32} reason={}",
                vow_tag,
                v.name,
                v.rejection_reason.as_deref().unwrap_or("unknown")
            );
        }
    }

    // Hiran stats
    let h = &report.hiran_stats;
    let mode = if h.stub_mode { "stub" } else { "live" };
    println!(
        "  hiran[{}]: validated={} accepted={} warned={} rejected={} uncertain={} avg_conf={:.3}",
        mode, h.proofs_validated, h.accepted, h.accepted_with_warning,
        h.rejected, h.uncertain, h.avg_confidence
    );

    // Anomaly alerts
    if !report.anomaly_alerts.is_empty() {
        for alert in &report.anomaly_alerts {
            println!(
                "  [ANOMALY] severity={} type={} action={:?} — {}",
                alert.severity, alert.anomaly_type, alert.recommended_action, alert.description
            );
        }
    }

    println!(
        "  network_health={} | totals: accepted={} rejected={} total_payout={}\n",
        report.network_health,
        report.accepted_count(),
        report.rejected_count(),
        report.total_payout()
    );
}

fn hex_prefix(bytes: &[u8; 32]) -> String {
    bytes[..8].iter().map(|b| format!("{b:02x}")).collect()
}
