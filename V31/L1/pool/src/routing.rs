//! Routing stats + session group resolution for the V31 pool.
//!
//! Ports `RoutingStats`, `resolve_session_group`, `extract_group_hint`,
//! `session_group_name`, `group_index`, and `source_index` from the V3 pool
//! server (`archive/V3/L1/pool/src/bin/server.rs`).

use std::fmt::Write;

use zion_cosmic_harmony::revenue::RevenueSource;

use crate::revenue_scheduler::{SessionGroup, revenue_source_name};

// ── RoutingStats ───────────────────────────────────────────────────

/// Per-group and per-source submit tracking with periodic logging.
///
/// Shared across all stratum sessions via `Arc<Mutex<RoutingStats>>`.
/// `record()` returns `true` every `log_every` submits so the caller can
/// emit a log line.
pub struct RoutingStats {
    log_every: u64,
    pub total_submits: u64,
    pub total_accepted: u64,
    pub total_stale: u64,
    group_submits: [u64; 4],
    group_accepted: [u64; 4],
    source_submits: [u64; 26],
    source_accepted: [u64; 26],
}

impl RoutingStats {
    pub fn new(log_every: u64) -> Self {
        Self {
            log_every,
            total_submits: 0,
            total_accepted: 0,
            total_stale: 0,
            group_submits: [0; 4],
            group_accepted: [0; 4],
            source_submits: [0; 26],
            source_accepted: [0; 26],
        }
    }

    pub fn record_stale(&mut self) {
        self.total_stale = self.total_stale.saturating_add(1);
    }

    /// Record a submit. Returns `true` if it's time to log a snapshot.
    pub fn record(&mut self, group: SessionGroup, source: RevenueSource, accepted: bool) -> bool {
        self.total_submits = self.total_submits.saturating_add(1);
        let gi = group_index(group);
        let si = source_index(source);
        self.group_submits[gi] = self.group_submits[gi].saturating_add(1);
        self.source_submits[si] = self.source_submits[si].saturating_add(1);

        if accepted {
            self.total_accepted = self.total_accepted.saturating_add(1);
            self.group_accepted[gi] = self.group_accepted[gi].saturating_add(1);
            self.source_accepted[si] = self.source_accepted[si].saturating_add(1);
        }

        self.log_every > 0 && self.total_submits.is_multiple_of(self.log_every)
    }

    /// Format a one-line snapshot for logging.
    pub fn snapshot_line(&self) -> String {
        let total = self.total_submits.max(1);
        let total_rejected = self
            .total_submits
            .saturating_sub(self.total_accepted)
            .saturating_sub(self.total_stale);
        let total_accept_rate = self.total_accepted as f64 * 100.0 / total as f64;

        let mut out = String::new();
        let _ = write!(
            out,
            "submits={} accepted={} rejected={} stale={} accept_rate={:.2}%",
            self.total_submits,
            self.total_accepted,
            total_rejected,
            self.total_stale,
            total_accept_rate
        );

        for group in [
            SessionGroup::Zion,
            SessionGroup::Revenue,
            SessionGroup::Ncl,
            SessionGroup::Auto,
        ] {
            let idx = group_index(group);
            let submits = self.group_submits[idx];
            let accepted = self.group_accepted[idx];
            let pct = submits as f64 * 100.0 / total as f64;
            let _ = write!(
                out,
                " {}={{submits:{},accepted:{},pct:{:.1}%}}",
                session_group_name(group),
                submits,
                accepted,
                pct
            );
        }

        out
    }

    /// JSON snapshot for the /api/v1/revenue-stats endpoint.
    pub fn snapshot_json(&self) -> serde_json::Value {
        let total = self.total_submits.max(1);
        let total_rejected = self
            .total_submits
            .saturating_sub(self.total_accepted)
            .saturating_sub(self.total_stale);

        let groups: Vec<_> = [
            SessionGroup::Zion,
            SessionGroup::Revenue,
            SessionGroup::Ncl,
            SessionGroup::Auto,
        ]
        .iter()
        .map(|&g| {
            let idx = group_index(g);
            let submits = self.group_submits[idx];
            let accepted = self.group_accepted[idx];
            serde_json::json!({
                "group": session_group_name(g),
                "submits": submits,
                "accepted": accepted,
                "pct": (submits as f64 * 100.0 / total as f64 * 10.0).round() / 10.0,
            })
        })
        .collect();

        let sources: Vec<_> = ALL_REVENUE_SOURCES
            .iter()
            .map(|&src| {
                let idx = source_index(src);
                let submits = self.source_submits[idx];
                let accepted = self.source_accepted[idx];
                let accept_rate = if submits == 0 {
                    0.0
                } else {
                    accepted as f64 * 100.0 / submits as f64
                };
                serde_json::json!({
                    "source": revenue_source_name(src),
                    "submits": submits,
                    "accepted": accepted,
                    "accept_rate_pct": (accept_rate * 10.0).round() / 10.0,
                })
            })
            .collect();

        serde_json::json!({
            "total_submits": self.total_submits,
            "total_accepted": self.total_accepted,
            "total_rejected": total_rejected,
            "total_stale": self.total_stale,
            "total_accept_rate_pct": (self.total_accepted as f64 * 100.0 / total as f64 * 10.0).round() / 10.0,
            "groups": groups,
            "sources": sources,
        })
    }
}

// ── Session group helpers ──────────────────────────────────────────

/// Map a SessionGroup to a usize index for array storage.
pub fn group_index(group: SessionGroup) -> usize {
    match group {
        SessionGroup::Zion => 0,
        SessionGroup::Revenue => 1,
        SessionGroup::Ncl => 2,
        SessionGroup::Auto => 3,
    }
}

/// Map a RevenueSource to a usize index for array storage.
pub fn source_index(source: RevenueSource) -> usize {
    use RevenueSource::*;
    match source {
        Zion => 0,
        Blake3External => 1,
        KHeavyHashExternal => 2,
        EthashExternal => 3,
        KawPowExternal => 4,
        AutolykosExternal => 5,
        RandomXExternal => 6,
        ZelHashExternal => 7,
        NclAi => 8,
        DeekshaLite => 9,
        ThermalBonus => 10,
        VerusHashExternal => 11,
        ProgPowExternal => 12,
        PearlExternal => 13,
        BeamHashExternal => 14,
        KarlsenHashExternal => 15,
        EquihashZeroExternal => 16,
        QhashExternal => 17,
        VerthashExternal => 18,
        FishHashExternal => 19,
        NexaPowExternal => 20,
        GhostRiderExternal => 21,
        DynexSolveExternal => 22,
        _ => 25,
    }
}

/// All revenue sources for iteration (used by API payloads).
pub const ALL_REVENUE_SOURCES: &[RevenueSource] = &[
    RevenueSource::Zion,
    RevenueSource::Blake3External,
    RevenueSource::KHeavyHashExternal,
    RevenueSource::EthashExternal,
    RevenueSource::KawPowExternal,
    RevenueSource::AutolykosExternal,
    RevenueSource::RandomXExternal,
    RevenueSource::ZelHashExternal,
    RevenueSource::NclAi,
    RevenueSource::DeekshaLite,
    RevenueSource::ThermalBonus,
    RevenueSource::VerusHashExternal,
    RevenueSource::ProgPowExternal,
    RevenueSource::PearlExternal,
    RevenueSource::BeamHashExternal,
    RevenueSource::KarlsenHashExternal,
    RevenueSource::EquihashZeroExternal,
    RevenueSource::QhashExternal,
    RevenueSource::VerthashExternal,
    RevenueSource::FishHashExternal,
    RevenueSource::NexaPowExternal,
    RevenueSource::GhostRiderExternal,
    RevenueSource::DynexSolveExternal,
];

/// Resolve which session group a miner belongs to.
///
/// Priority:
/// 1. Explicit `g=zion` / `g=revenue` / `g=ncl` / `g=auto` hint in worker name or miner ID
/// 2. Backend miner ID match (env `ZION_POOL_BACKEND_MINER_IDS`)
/// 3. Backend worker hint match (env `ZION_POOL_BACKEND_WORKER_HINTS`)
/// 4. Default group (env `ZION_POOL_DEFAULT_GROUP`, default: Zion)
pub fn resolve_session_group(miner_id: &str, worker_name: &str) -> SessionGroup {
    if let Some(group) = extract_group_hint(worker_name).or_else(|| extract_group_hint(miner_id)) {
        return group;
    }

    let miner_id_lc = miner_id.trim().to_ascii_lowercase();
    if !miner_id_lc.is_empty() {
        let backend_ids: Vec<String> = std::env::var("ZION_POOL_BACKEND_MINER_IDS")
            .unwrap_or_default()
            .split(',')
            .filter(|s| !s.is_empty())
            .map(|s| s.trim().to_ascii_lowercase())
            .collect();
        if backend_ids.iter().any(|id| id == &miner_id_lc) {
            return SessionGroup::Auto;
        }
    }

    let worker_name_lc = worker_name.to_ascii_lowercase();
    let backend_hints: Vec<String> = std::env::var("ZION_POOL_BACKEND_WORKER_HINTS")
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.trim().to_ascii_lowercase())
        .collect();
    if backend_hints
        .iter()
        .any(|hint| !hint.is_empty() && worker_name_lc.contains(hint.as_str()))
    {
        return SessionGroup::Auto;
    }

    let default_str = std::env::var("ZION_POOL_DEFAULT_GROUP")
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    match default_str.as_str() {
        "revenue" => SessionGroup::Revenue,
        "ncl" => SessionGroup::Ncl,
        "auto" => SessionGroup::Auto,
        _ => SessionGroup::Zion,
    }
}

/// Extract a `g=xxx` or `group=xxx` hint from a string.
pub fn extract_group_hint(raw: &str) -> Option<SessionGroup> {
    let lower = raw.to_ascii_lowercase();
    if lower.contains("g=zion") || lower.contains("group=zion") {
        return Some(SessionGroup::Zion);
    }
    if lower.contains("g=revenue") || lower.contains("group=revenue") {
        return Some(SessionGroup::Revenue);
    }
    if lower.contains("g=ncl") || lower.contains("group=ncl") {
        return Some(SessionGroup::Ncl);
    }
    if lower.contains("g=auto") || lower.contains("group=auto") {
        return Some(SessionGroup::Auto);
    }
    None
}

/// Human-readable name for a session group.
pub fn session_group_name(group: SessionGroup) -> &'static str {
    match group {
        SessionGroup::Zion => "zion",
        SessionGroup::Revenue => "revenue",
        SessionGroup::Ncl => "ncl",
        SessionGroup::Auto => "auto",
    }
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routing_stats_record_and_snapshot() {
        let mut stats = RoutingStats::new(1); // log every 1 submit
        assert!(stats.record(SessionGroup::Zion, RevenueSource::Zion, true));
        assert!(stats.record(SessionGroup::Zion, RevenueSource::Zion, true));
        assert_eq!(stats.total_submits, 2);
        assert_eq!(stats.total_accepted, 2);
        let snap = stats.snapshot_line();
        assert!(snap.contains("submits=2"));
        assert!(snap.contains("accept_rate=100.00%"));
    }

    #[test]
    fn routing_stats_rejected() {
        let mut stats = RoutingStats::new(0);
        stats.record(SessionGroup::Revenue, RevenueSource::Blake3External, false);
        assert_eq!(stats.total_submits, 1);
        assert_eq!(stats.total_accepted, 0);
    }

    #[test]
    fn routing_stats_stale() {
        let mut stats = RoutingStats::new(0);
        stats.record_stale();
        assert_eq!(stats.total_stale, 1);
    }

    #[test]
    fn routing_stats_json_snapshot() {
        let mut stats = RoutingStats::new(0);
        stats.record(SessionGroup::Zion, RevenueSource::Zion, true);
        stats.record(SessionGroup::Revenue, RevenueSource::Blake3External, false);
        let json = stats.snapshot_json();
        assert_eq!(json["total_submits"], 2);
        assert_eq!(json["total_accepted"], 1);
        assert!(json["groups"].is_array());
        assert!(json["sources"].is_array());
    }

    #[test]
    fn extract_group_hint_works() {
        assert_eq!(extract_group_hint("worker_1/g=zion"), Some(SessionGroup::Zion));
        assert_eq!(extract_group_hint("group=revenue"), Some(SessionGroup::Revenue));
        assert_eq!(extract_group_hint("g=ncl"), Some(SessionGroup::Ncl));
        assert_eq!(extract_group_hint("g=auto"), Some(SessionGroup::Auto));
        assert_eq!(extract_group_hint("plain_worker"), None);
    }

    #[test]
    fn resolve_session_group_default_zion() {
        std::env::remove_var("ZION_POOL_BACKEND_MINER_IDS");
        std::env::remove_var("ZION_POOL_BACKEND_WORKER_HINTS");
        std::env::remove_var("ZION_POOL_DEFAULT_GROUP");
        assert_eq!(resolve_session_group("miner1", "worker1"), SessionGroup::Zion);
    }

    #[test]
    fn resolve_session_group_hint_in_worker() {
        assert_eq!(
            resolve_session_group("miner1", "worker1/g=revenue"),
            SessionGroup::Revenue
        );
    }

    #[test]
    fn resolve_session_group_hint_in_miner_id() {
        assert_eq!(
            resolve_session_group("miner1/g=ncl", "worker1"),
            SessionGroup::Ncl
        );
    }

    #[test]
    fn group_index_consistent() {
        assert_eq!(group_index(SessionGroup::Zion), 0);
        assert_eq!(group_index(SessionGroup::Revenue), 1);
        assert_eq!(group_index(SessionGroup::Ncl), 2);
        assert_eq!(group_index(SessionGroup::Auto), 3);
    }

    #[test]
    fn source_index_zion_is_zero() {
        assert_eq!(source_index(RevenueSource::Zion), 0);
        assert_eq!(source_index(RevenueSource::Blake3External), 1);
        assert_eq!(source_index(RevenueSource::NclAi), 8);
    }

    #[test]
    fn session_group_name_works() {
        assert_eq!(session_group_name(SessionGroup::Zion), "zion");
        assert_eq!(session_group_name(SessionGroup::Revenue), "revenue");
        assert_eq!(session_group_name(SessionGroup::Ncl), "ncl");
        assert_eq!(session_group_name(SessionGroup::Auto), "auto");
    }
}
