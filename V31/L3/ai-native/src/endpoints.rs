//! # Service Endpoints — single source of truth
//!
//! Every Hiran/L3 component (tool registry, health poller, Maestro) resolves
//! service addresses through this module. Defaults match the live Edge
//! topology documented in `Hiran/2.4/service-map.json` (audit 2026-10-10);
//! each value can be overridden by env var without a rebuild.
//!
//! ```text
//! ZION_NODE1_RPC     http://127.0.0.1:9445   (JSON-RPC POST to "/")
//! ZION_POOL_API      http://127.0.0.1:8080
//! ZION_DAO_API       http://127.0.0.1:8456
//! ZION_WARP_API      http://127.0.0.1:8453   (bridge+swap folded into warpd)
//! ZION_DEX_API       http://127.0.0.1:8454
//! ZION_NCL_API       http://127.0.0.1:8001/ncl  (mounted under ai-native API)
//! ZION_OASIS_API     http://127.0.0.1:8094
//! ZION_FREE_WORLD_API http://127.0.0.1:8095
//! ZION_ISOBELLA_API  http://127.0.0.1:8097   (8096 is ZIS identity now)
//! ZION_ZIS_API       http://127.0.0.1:8096
//! ZION_DASHBOARD_API http://127.0.0.1:8766
//! ZION_PROMETHEUS_API http://127.0.0.1:9090
//! ZION_NODE_EXPORTER http://127.0.0.1:9100   (host metrics)
//! HIRAN_API          http://127.0.0.1:8001
//! HIRAN_INFERENCE_URL http://127.0.0.1:8002  (OpenAI-compatible, tunnel)
//! HIRAN_ORCHESTRATOR http://127.0.0.1:8004   (reserved standalone Maestro)
//! ```

use std::env;

fn env_or(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_string())
}

/// Like [`env_or`] but returns `'static` — for probe tables built once.
pub(crate) fn env_or_leaked(key: &'static str, default: &'static str) -> &'static str {
    match env::var(key) {
        Ok(v) if !v.is_empty() => Box::leak(v.into_boxed_str()),
        _ => default,
    }
}

macro_rules! ep {
    ($name:ident, $key:literal, $default:literal) => {
        pub fn $name() -> String { env_or($key, $default) }
    };
}

ep!(node1_rpc, "ZION_NODE1_RPC", "http://127.0.0.1:9445");
ep!(node2_rpc, "ZION_NODE2_RPC", "http://127.0.0.1:9446");
ep!(node3_rpc, "ZION_NODE3_RPC", "http://127.0.0.1:9447");
ep!(pool_api, "ZION_POOL_API", "http://127.0.0.1:8080");
ep!(dao_api, "ZION_DAO_API", "http://127.0.0.1:8456");
ep!(warp_api, "ZION_WARP_API", "http://127.0.0.1:8453");
ep!(dex_api, "ZION_DEX_API", "http://127.0.0.1:8454");
ep!(ncl_api, "ZION_NCL_API", "http://127.0.0.1:8001/ncl");
ep!(oasis_api, "ZION_OASIS_API", "http://127.0.0.1:8094");
ep!(free_world_api, "ZION_FREE_WORLD_API", "http://127.0.0.1:8095");
ep!(issobella_api, "ZION_ISOBELLA_API", "http://127.0.0.1:8097");
ep!(zis_api, "ZION_ZIS_API", "http://127.0.0.1:8096");
ep!(quantus_rpc, "ZION_QUANTUS_RPC", "http://127.0.0.1:9944");
ep!(dashboard_api, "ZION_DASHBOARD_API", "http://127.0.0.1:8766");
ep!(prometheus_api, "ZION_PROMETHEUS_API", "http://127.0.0.1:9090");
ep!(node_exporter, "ZION_NODE_EXPORTER", "http://127.0.0.1:9100");
ep!(hiran_api, "HIRAN_API", "http://127.0.0.1:8001");
ep!(hiran_inference, "HIRAN_INFERENCE_URL", "http://127.0.0.1:8002");
ep!(hiran_orchestrator, "HIRAN_ORCHESTRATOR", "http://127.0.0.1:8004");

/// Whether Maestro may execute mutating (approval-flagged) tools.
/// Default 0 = read-only. `HIRAN_MAESTRO_MUTATIONS=1` enables the gate.
pub fn mutations_enabled() -> bool {
    env::var("HIRAN_MAESTRO_MUTATIONS").ok().as_deref() == Some("1")
}

/// Approval token expected in `X-Maestro-Approve` header (if configured).
pub fn approval_token() -> Option<String> {
    env::var("MAESTRO_APPROVAL_TOKEN").ok().filter(|v| !v.is_empty())
}

/// Directory for append-only Maestro audit JSONL.
pub fn audit_dir() -> String {
    env_or("ZION_L3_AUDIT_DIR", "/opt/zion/data/l3-audit")
}

/// Constant-time-ish token compare (length-stable XOR fold).
pub fn token_matches(given: &str, expected: &str) -> bool {
    let (a, b) = (given.as_bytes(), expected.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_service_map() {
        assert_eq!(node1_rpc(), "http://127.0.0.1:9445");
        assert_eq!(dao_api(), "http://127.0.0.1:8456");
        assert_eq!(issobella_api(), "http://127.0.0.1:8097");
        assert_eq!(zis_api(), "http://127.0.0.1:8096");
        assert_eq!(hiran_inference(), "http://127.0.0.1:8002");
    }

    #[test]
    fn mutations_off_by_default() {
        env::remove_var("HIRAN_MAESTRO_MUTATIONS");
        assert!(!mutations_enabled());
    }

    #[test]
    fn token_compare() {
        assert!(token_matches("abc", "abc"));
        assert!(!token_matches("abc", "abd"));
        assert!(!token_matches("abc", "abcd"));
    }
}
