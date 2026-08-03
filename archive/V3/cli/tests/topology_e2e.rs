//! End-to-end tests for core+edge topology support in zion-cli.
//!
//! These tests verify:
//! - Default topology values match canonical v3.0.0 operational settings
//! - Config parsing with topology.core / topology.edge sections
//! - target_rpc / target_pool resolution logic
//! - Topology validation rules

use zion_cli::config::{self, Config, TopologyConfig, TopologyHostConfig};

#[test]
fn default_topology_matches_canonical_operational_settings() {
    let cfg = Config::default();

    // Core defaults: local node
    assert_eq!(cfg.topology.core.rpc_host, "127.0.0.1");
    assert_eq!(cfg.topology.core.rpc_port, 8443);
    assert_eq!(cfg.topology.core.p2p_port, 8333);
    assert_eq!(cfg.topology.core.pool_host, "127.0.0.1");
    assert_eq!(cfg.topology.core.pool_port, 8444);
    assert_eq!(cfg.topology.core.vpn_ip.as_deref(), Some("100.86.102.5"));

    // Edge defaults: 3.0.4 canonical server (old Edge decommissioned)
    assert_eq!(cfg.topology.edge.rpc_host, "62.171.141.136");
    assert_eq!(cfg.topology.edge.rpc_port, 8443);
    assert_eq!(cfg.topology.edge.p2p_port, 8333);
    assert_eq!(cfg.topology.edge.pool_host, "62.171.141.136");
    assert_eq!(cfg.topology.edge.pool_port, 8444);
    assert_eq!(cfg.topology.edge.vpn_ip.as_deref(), None);
}

#[test]
fn legacy_node_and_pool_defaults_alias_to_core_and_edge() {
    let cfg = Config::default();
    // node.rpc_host should point to core (local)
    assert_eq!(cfg.node.rpc_host, "127.0.0.1");
    assert_eq!(cfg.node.rpc_port, 8443);
    // pool should default to edge public pool
    assert_eq!(cfg.pool.host, "62.171.141.136");
    assert_eq!(cfg.pool.port, 8444);
}

#[test]
fn target_rpc_resolves_core_aliases() {
    let cfg = Config::default();
    let (host, port) = cfg.target_rpc("core");
    assert_eq!(host, "127.0.0.1");
    assert_eq!(port, 8443);

    let (host, port) = cfg.target_rpc("local");
    assert_eq!(host, "127.0.0.1");
    assert_eq!(port, 8443);

    let (host, port) = cfg.target_rpc("master");
    assert_eq!(host, "127.0.0.1");
    assert_eq!(port, 8443);
}

#[test]
fn target_rpc_resolves_edge_aliases() {
    let cfg = Config::default();
    let (host, port) = cfg.target_rpc("edge");
    assert_eq!(host, "62.171.141.136");
    assert_eq!(port, 8443);

    let (host, port) = cfg.target_rpc("vpn");
    assert_eq!(host, "62.171.141.136");
    assert_eq!(port, 8443);

    let (host, port) = cfg.target_rpc("relay");
    assert_eq!(host, "62.171.141.136");
    assert_eq!(port, 8443);
}

#[test]
fn target_rpc_parses_host_port_literal() {
    let cfg = Config::default();
    let (host, port) = cfg.target_rpc("192.168.1.100:9999");
    assert_eq!(host, "192.168.1.100");
    assert_eq!(port, 9999);
}

#[test]
fn target_rpc_fallback_to_core_for_unknown_target() {
    let cfg = Config::default();
    let (host, port) = cfg.target_rpc("unknown-target");
    assert_eq!(host, "127.0.0.1");
    assert_eq!(port, 8443);
}

#[test]
fn target_pool_resolves_core_and_edge() {
    let cfg = Config::default();
    let (host, port) = cfg.target_pool("core");
    assert_eq!(host, "127.0.0.1");
    assert_eq!(port, 8444);

    let (host, port) = cfg.target_pool("edge");
    assert_eq!(host, "62.171.141.136");
    assert_eq!(port, 8444);
}

#[test]
fn target_pool_parses_host_port_literal() {
    let cfg = Config::default();
    let (host, port) = cfg.target_pool("pool.example.com:3333");
    assert_eq!(host, "pool.example.com");
    assert_eq!(port, 3333);
}

#[test]
fn config_roundtrip_with_topology_sections() {
    let original = Config {
        topology: TopologyConfig {
            core: TopologyHostConfig {
                rpc_host: "10.0.0.1".into(),
                rpc_port: 9000,
                p2p_port: 9001,
                pool_host: "10.0.0.1".into(),
                pool_port: 9002,
                vpn_ip: Some("100.100.100.1".into()),
            },
            edge: TopologyHostConfig {
                rpc_host: "edge.zion.dev".into(),
                rpc_port: 8443,
                p2p_port: 8333,
                pool_host: "pool.zion.dev".into(),
                pool_port: 8444,
                vpn_ip: None,
            },
        },
        ..Config::default()
    };

    let serialized = toml::to_string(&original).expect("serialize config");
    let parsed: Config = toml::from_str(&serialized).expect("parse config");

    assert_eq!(parsed.topology.core.rpc_host, "10.0.0.1");
    assert_eq!(parsed.topology.core.rpc_port, 9000);
    assert_eq!(
        parsed.topology.core.vpn_ip.as_deref(),
        Some("100.100.100.1")
    );

    assert_eq!(parsed.topology.edge.rpc_host, "edge.zion.dev");
    assert_eq!(parsed.topology.edge.pool_host, "pool.zion.dev");
    assert_eq!(parsed.topology.edge.vpn_ip, None);
}

#[test]
fn topology_validation_accepts_valid_config() {
    let cfg = Config::default();
    let report = config::validate(&cfg);
    assert!(
        report.is_ok(),
        "Default config should validate: {:?}",
        report.errors
    );
}

#[test]
fn topology_validation_rejects_empty_rpc_host() {
    let mut cfg = Config::default();
    cfg.topology.core.rpc_host = "   ".into();
    let report = config::validate(&cfg);
    assert!(!report.is_ok());
    assert!(report
        .errors
        .iter()
        .any(|e| e.contains("topology.core.rpc_host")));
}

#[test]
fn topology_validation_rejects_zero_port() {
    let mut cfg = Config::default();
    cfg.topology.edge.rpc_port = 0;
    let report = config::validate(&cfg);
    assert!(!report.is_ok());
    assert!(report
        .errors
        .iter()
        .any(|e| e.contains("topology.edge.rpc_port")));
}

#[test]
fn topology_validation_warns_empty_vpn_ip() {
    let mut cfg = Config::default();
    cfg.topology.core.vpn_ip = Some("   ".into());
    let report = config::validate(&cfg);
    assert!(report.is_ok());
    assert!(report
        .warnings
        .iter()
        .any(|w| w.contains("topology.core.vpn_ip")));
}

#[test]
fn agent_url_defaults_to_localhost_hiran_v2_2() {
    let cfg = Config::default();
    assert_eq!(cfg.agent.url, "http://127.0.0.1:8002");
    assert_eq!(cfg.agent.model, "hiranyagarbha-v2.2");
}

#[test]
fn deploy_defaults_to_edge_with_canonical_ssh_key() {
    let cfg = Config::default();
    assert_eq!(cfg.deploy.default_server, "edge");
    assert_eq!(cfg.deploy.ssh_key, "~/.ssh/zion-edge-post-wipe-2026-07-29");
}
