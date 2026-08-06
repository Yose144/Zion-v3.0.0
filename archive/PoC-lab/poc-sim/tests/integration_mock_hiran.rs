//! Integrační testy poc-sim × MockHiranServer (Fáze 3d)
//!
//! Tyto testy spustí skutečný HTTP server (`MockHiranServer`) na náhodném portu,
//! nakonfigurují `NetworkSimulator` s `hiran_url`, provedou simulaci a ověří,
//! že `hiran[live]` cesta funguje end-to-end bez živého llama-serveru.

use poc_core::CareScoreComponents;
use poc_hiran::MockHiranServer;
use poc_sim::{NetworkSimulator, SimulatedValidator};

// ── Pomocné funkce ────────────────────────────────────────────────────────────

fn honest_validator(byte: u8, name: &str) -> SimulatedValidator {
    SimulatedValidator {
        id: [byte; 32],
        name: name.into(),
        stake: 5000,
        quality: CareScoreComponents {
            accuracy_bps: 9500,
            timeliness_bps: 9000,
            coverage_bps: 8500,
        },
        is_guardian: false,
        ceremony_location: None,
    }
}

fn lazy_validator(byte: u8, name: &str) -> SimulatedValidator {
    SimulatedValidator {
        id: [byte; 32],
        name: name.into(),
        stake: 5000,
        quality: CareScoreComponents {
            accuracy_bps: 500,
            timeliness_bps: 500,
            coverage_bps: 500,
        },
        is_guardian: false,
        ceremony_location: None,
    }
}

fn guardian_validator(byte: u8, name: &str) -> SimulatedValidator {
    SimulatedValidator {
        id: [byte; 32],
        name: name.into(),
        stake: 5000,
        quality: CareScoreComponents {
            accuracy_bps: 9500,
            timeliness_bps: 9000,
            coverage_bps: 8500,
        },
        is_guardian: true,
        ceremony_location: Some("Genesis Garden".into()),
    }
}

// ── Testy ─────────────────────────────────────────────────────────────────────

/// Základní test: MockServer (AlwaysAccept) + 2 validátoři → oba přijati,
/// hiran_stats.stub_mode == false.
#[test]
fn mock_hiran_server_integration_basic() {
    let server = MockHiranServer::spawn_accepting();
    let url = server.url();

    let mut sim = NetworkSimulator::new([0xA0u8; 32], 1_000_000, 1000, 1_000_000)
        .with_hiran_url(&url);

    sim.add_validator(honest_validator(0x01, "alice")).unwrap();
    sim.add_validator(honest_validator(0x02, "bob")).unwrap();

    let report = sim.run_epoch(0).unwrap();

    // Oba validátoři jsou přijati
    assert_eq!(report.accepted_count(), 2, "oba honest validátoři musí být přijati");
    assert_eq!(report.rejected_count(), 0);

    // live mode: stub_mode musí být false
    assert!(
        !report.hiran_stats.stub_mode,
        "po nastavení hiran_url musí být stub_mode=false"
    );

    // Hiran zvalidoval proofs
    assert!(
        report.hiran_stats.proofs_validated >= 2,
        "hiran musí zvalidovat alespoň 2 proofs, got={}",
        report.hiran_stats.proofs_validated
    );

    // Každý přijatý validátor má hiran_verdict
    for v in &report.validators {
        if v.accepted {
            assert!(
                v.hiran_verdict.is_some(),
                "přijatý validátor {} musí mít hiran_verdict",
                v.name
            );
        }
    }

    server.shutdown();
}

/// Líný validátor je odmítnut kvůli nízkému care score PŘED Hiranem,
/// ale síť je stále zdravá.
#[test]
fn mock_hiran_server_lazy_validator_rejected_by_score() {
    let server = MockHiranServer::spawn_accepting();
    let url = server.url();

    let mut sim = NetworkSimulator::new([0xA1u8; 32], 1_000_000, 1000, 1_000_000)
        .with_hiran_url(&url);

    sim.add_validator(honest_validator(0x01, "alice")).unwrap();
    sim.add_validator(lazy_validator(0x02, "lazy-bob")).unwrap();

    let report = sim.run_epoch(0).unwrap();

    assert_eq!(report.accepted_count(), 1);
    assert_eq!(report.rejected_count(), 1);

    let lazy = report.validators.iter().find(|v| v.name == "lazy-bob").unwrap();
    assert!(!lazy.accepted);
    assert_eq!(lazy.payout, 0);

    server.shutdown();
}

/// Multiple epochs s MockServerem — konzistence výsledků.
#[test]
fn mock_hiran_server_multiple_epochs_consistent() {
    let server = MockHiranServer::spawn_accepting();
    let url = server.url();

    let mut sim = NetworkSimulator::new([0xA2u8; 32], 1_000_000, 1000, 1_000_000)
        .with_hiran_url(&url);

    sim.add_validator(honest_validator(0x01, "alice")).unwrap();
    sim.add_validator(honest_validator(0x02, "bob")).unwrap();
    sim.add_validator(honest_validator(0x03, "charlie")).unwrap();

    for epoch in 0..3u64 {
        let report = sim.run_epoch(epoch).unwrap();
        assert_eq!(
            report.accepted_count(),
            3,
            "epoch {epoch}: všichni 3 honest validátoři musí být přijati"
        );
        assert!(
            !report.hiran_stats.stub_mode,
            "epoch {epoch}: stub_mode musí být false"
        );
    }

    server.shutdown();
}

/// Guardian (dual-vow) dostane vyšší care score než regular validátor,
/// i při live MockServeru.
#[test]
fn mock_hiran_server_guardian_gets_higher_care_score() {
    let server = MockHiranServer::spawn_accepting();
    let url = server.url();

    let mut sim = NetworkSimulator::new([0xA3u8; 32], 1_000_000, 1000, 1_000_000)
        .with_hiran_url(&url);

    sim.add_validator(honest_validator(0x01, "regular-alice")).unwrap();
    sim.add_validator(guardian_validator(0x02, "guardian-bob")).unwrap();

    let report = sim.run_epoch(0).unwrap();
    assert_eq!(report.accepted_count(), 2);

    let regular = report.validators.iter().find(|v| v.name == "regular-alice").unwrap();
    let guardian = report.validators.iter().find(|v| v.name == "guardian-bob").unwrap();

    assert!(!regular.dual_vow_bonus_applied);
    assert!(guardian.dual_vow_bonus_applied);
    assert!(
        guardian.care_score > regular.care_score,
        "guardian={} musí > regular={}",
        guardian.care_score, regular.care_score
    );

    server.shutdown();
}

/// MockServer spawning a shutdown neblokují — server se korektně vypne.
#[test]
fn mock_hiran_server_spawns_and_shuts_down_cleanly() {
    let server = MockHiranServer::spawn_accepting();
    let url = server.url();
    // Ověříme že URL vypadá správně
    assert!(url.starts_with("http://127.0.0.1:"), "URL musí být localhost: {url}");
    server.shutdown();
    // Pokud jsme tady, shutdown proběhl bez panicu
}

/// Hiran stats: po 1 epoše s 1 validátorem jsou čítače správné.
#[test]
fn mock_hiran_server_stats_correct_after_one_epoch() {
    let server = MockHiranServer::spawn_accepting();
    let url = server.url();

    let mut sim = NetworkSimulator::new([0xA4u8; 32], 1_000_000, 1000, 1_000_000)
        .with_hiran_url(&url);
    sim.add_validator(honest_validator(0x01, "alice")).unwrap();

    let report = sim.run_epoch(0).unwrap();

    // proofs_validated >= 1, accepted >= 1, rejected == 0
    assert!(report.hiran_stats.proofs_validated >= 1);
    assert!(report.hiran_stats.accepted >= 1);
    assert_eq!(report.hiran_stats.rejected, 0);
    assert!(!report.hiran_stats.stub_mode);

    server.shutdown();
}
