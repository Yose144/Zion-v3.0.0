//! Revenue Scheduler — multi-stream revenue lane assignment for the V31 pool.
//!
//! Ports the `RevenueScheduler`, `SessionGroup`, `RevenueLane`, and
//! `RevenueSource` helper logic from the V3 pool server
//! (`archive/V3/L1/pool/src/bin/server.rs` lines 7000-7420).
//!
//! The scheduler supports two modes:
//! - **Single-lane** — all revenue goes to one `RevenueSource` (default Zion).
//! - **Multi-stream** — revenue is split across weighted lanes (Zion 50 %,
//!   Blake3External 25 %, NclAi 25 % by default), configurable via env vars.

use zion_cosmic_harmony::revenue::RevenueSource;

// ── Env helpers ────────────────────────────────────────────────────

/// Parse a boolean env var. Anything that is not `0`/`false`/`no`/`off`
/// (case-insensitive) is treated as `true`. Returns `default` when unset.
fn parse_env_bool(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            !(normalized == "0"
                || normalized == "false"
                || normalized == "no"
                || normalized == "off")
        }
        Err(_) => default,
    }
}

/// Parse a `u32` env var, returning `default` when unset.
fn parse_env_u32(key: &str, default: u32) -> u32 {
    match std::env::var(key) {
        Ok(value) => value.parse::<u32>().unwrap_or(default),
        Err(_) => default,
    }
}

/// Parse an `f64` env var, returning `default` when unset.
fn parse_env_f64(key: &str, default: f64) -> f64 {
    match std::env::var(key) {
        Ok(value) => value.parse::<f64>().unwrap_or(default),
        Err(_) => default,
    }
}

// ── Types ──────────────────────────────────────────────────────────

/// A single weighted revenue lane.
#[derive(Debug, Clone, Copy)]
pub struct RevenueLane {
    pub source: RevenueSource,
    pub value_usd: f64,
    pub weight: u32,
}

/// Session grouping for routing miners to revenue lanes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionGroup {
    Zion,
    Revenue,
    Ncl,
    Auto,
}

/// Weighted round-robin scheduler for multi-stream revenue assignment.
#[derive(Debug)]
pub struct RevenueScheduler {
    pub lanes: Vec<RevenueLane>,
    pub total_weight: u32,
    pub cursor: u32,
    pub auto_assign_cursor: u32,
    pub auto_assign_include_zion: bool,
    pub default_value_usd: f64,
    pub multistream_enabled: bool,
}

impl RevenueScheduler {
    /// Create a single-lane scheduler using `default_source` at 100 % weight.
    pub fn new(default_source: RevenueSource, default_value_usd: f64) -> Self {
        Self {
            lanes: vec![RevenueLane {
                source: default_source,
                value_usd: default_value_usd,
                weight: 100,
            }],
            total_weight: 100,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: parse_env_bool("ZION_BACKEND_AUTO_INCLUDE_ZION", false),
            default_value_usd,
            multistream_enabled: false,
        }
    }

    /// Build a scheduler from environment variables.
    ///
    /// Env vars:
    /// - `ZION_REVENUE_MULTISTREAM` — enable multi-stream mode.
    /// - `ZION_STREAM_<NAME>_PCT` — lane weight (percentage points).
    /// - `ZION_STREAM_<NAME>_USD` — lane USD value override.
    /// - `ZION_BACKEND_AUTO_INCLUDE_ZION` — include Zion in auto-assign rotation.
    ///
    /// Canonical split when multistream is enabled: Zion 50 %, Blake3External
    /// 25 %, NclAi 25 %. Additional external-algo lanes default to 0 %
    /// (disabled) until explicitly set via env.
    pub fn from_env(default_value_usd: f64) -> Self {
        let enabled = parse_env_bool("ZION_REVENUE_MULTISTREAM", false);
        if !enabled {
            // Single-lane Zion mode.
            return Self::new(RevenueSource::Zion, default_value_usd);
        }

        let mut lanes = Vec::new();

        // Canonical pool-side 50/25/25 distribution.
        push_lane_from_env(
            &mut lanes,
            RevenueSource::Zion,
            "ZION_STREAM_ZION_PCT",
            "ZION_STREAM_ZION_USD",
            50,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::Blake3External,
            "ZION_STREAM_BLAKE3_PCT",
            "ZION_STREAM_BLAKE3_USD",
            25,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::NclAi,
            "ZION_STREAM_NCL_PCT",
            "ZION_STREAM_NCL_USD",
            25,
            default_value_usd,
        );

        // Optional per-algorithm external lanes (default 0 -> disabled).
        push_lane_from_env(
            &mut lanes,
            RevenueSource::KHeavyHashExternal,
            "ZION_STREAM_KHEAVYHASH_PCT",
            "ZION_STREAM_KHEAVYHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::EthashExternal,
            "ZION_STREAM_ETHASH_PCT",
            "ZION_STREAM_ETHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::KawPowExternal,
            "ZION_STREAM_KAWPOW_PCT",
            "ZION_STREAM_KAWPOW_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::AutolykosExternal,
            "ZION_STREAM_AUTOLYKOS_PCT",
            "ZION_STREAM_AUTOLYKOS_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::RandomXExternal,
            "ZION_STREAM_RANDOMX_PCT",
            "ZION_STREAM_RANDOMX_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::ZelHashExternal,
            "ZION_STREAM_ZELHASH_PCT",
            "ZION_STREAM_ZELHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::VerusHashExternal,
            "ZION_STREAM_VERUSHASH_PCT",
            "ZION_STREAM_VERUSHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::ProgPowExternal,
            "ZION_STREAM_PROGPOW_PCT",
            "ZION_STREAM_PROGPOW_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::PearlExternal,
            "ZION_STREAM_PEARL_PCT",
            "ZION_STREAM_PEARL_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::BeamHashExternal,
            "ZION_STREAM_BEAMHASH_PCT",
            "ZION_STREAM_BEAMHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::KarlsenHashExternal,
            "ZION_STREAM_KARLSENHASH_PCT",
            "ZION_STREAM_KARLSENHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::EquihashZeroExternal,
            "ZION_STREAM_EQUIHASHZERO_PCT",
            "ZION_STREAM_EQUIHASHZERO_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::QhashExternal,
            "ZION_STREAM_QHASH_PCT",
            "ZION_STREAM_QHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::VerthashExternal,
            "ZION_STREAM_VERTHASH_PCT",
            "ZION_STREAM_VERTHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::FishHashExternal,
            "ZION_STREAM_FISHHASH_PCT",
            "ZION_STREAM_FISHHASH_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::NexaPowExternal,
            "ZION_STREAM_NEXAPOW_PCT",
            "ZION_STREAM_NEXAPOW_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::GhostRiderExternal,
            "ZION_STREAM_GHOSTRIDER_PCT",
            "ZION_STREAM_GHOSTRIDER_USD",
            0,
            default_value_usd,
        );
        push_lane_from_env(
            &mut lanes,
            RevenueSource::DynexSolveExternal,
            "ZION_STREAM_DYNEXSOLVE_PCT",
            "ZION_STREAM_DYNEXSOLVE_USD",
            0,
            default_value_usd,
        );

        let total_weight: u32 = lanes.iter().map(|l| l.weight).sum();
        if total_weight == 0 {
            // All weights zero — fall back to single Zion lane.
            return Self::new(RevenueSource::Zion, default_value_usd);
        }

        Self {
            lanes,
            total_weight,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: parse_env_bool("ZION_BACKEND_AUTO_INCLUDE_ZION", false),
            default_value_usd,
            multistream_enabled: true,
        }
    }

    /// Weighted round-robin auto-assignment of a session group.
    ///
    /// Maps each lane to its corresponding `SessionGroup` and selects one
    /// proportionally to lane weights. Falls back to `SessionGroup::Zion`
    /// when no lanes are eligible.
    pub fn assign_auto_group(&mut self) -> SessionGroup {
        let mut choices: Vec<(SessionGroup, u32)> = Vec::new();
        for lane in &self.lanes {
            if lane.weight == 0 {
                continue;
            }
            match lane.source {
                RevenueSource::Zion if self.auto_assign_include_zion => {
                    choices.push((SessionGroup::Zion, lane.weight));
                }
                RevenueSource::Blake3External
                | RevenueSource::KHeavyHashExternal
                | RevenueSource::EthashExternal
                | RevenueSource::KawPowExternal
                | RevenueSource::AutolykosExternal
                | RevenueSource::RandomXExternal
                | RevenueSource::ZelHashExternal
                | RevenueSource::VerusHashExternal
                | RevenueSource::ProgPowExternal
                | RevenueSource::PearlExternal
                | RevenueSource::BeamHashExternal
                | RevenueSource::KarlsenHashExternal
                | RevenueSource::EquihashZeroExternal
                | RevenueSource::QhashExternal
                | RevenueSource::VerthashExternal
                | RevenueSource::FishHashExternal
                | RevenueSource::NexaPowExternal
                | RevenueSource::GhostRiderExternal
                | RevenueSource::DynexSolveExternal => {
                    choices.push((SessionGroup::Revenue, lane.weight))
                }
                RevenueSource::NclAi => choices.push((SessionGroup::Ncl, lane.weight)),
                _ => {}
            }
        }

        if choices.is_empty() {
            return SessionGroup::Zion;
        }

        let total: u32 = choices.iter().map(|(_, w)| *w).sum();
        if total == 0 {
            return SessionGroup::Zion;
        }

        let mut position = self.auto_assign_cursor % total;
        self.auto_assign_cursor = self.auto_assign_cursor.wrapping_add(1);
        for (group, weight) in choices {
            if position < weight {
                return group;
            }
            position -= weight;
        }

        SessionGroup::Zion
    }

    /// Weighted round-robin lane selection.
    ///
    /// Returns the next `(RevenueSource, value_usd)` pair based on lane
    /// weights. In single-lane mode always returns the sole lane.
    pub fn next_lane(&mut self) -> (RevenueSource, f64) {
        if self.lanes.len() == 1 {
            let lane = self.lanes[0];
            return (lane.source, lane.value_usd);
        }

        let mut position = self.cursor % self.total_weight;
        self.cursor = self.cursor.wrapping_add(1);
        for lane in &self.lanes {
            if position < lane.weight {
                return (lane.source, lane.value_usd);
            }
            position -= lane.weight;
        }

        let lane = self.lanes[0];
        (lane.source, lane.value_usd)
    }

    /// Select a lane appropriate for the given session group.
    ///
    /// - `Zion` → always the Zion lane.
    /// - `Revenue` → rotate through enabled external-algo lanes.
    /// - `Ncl` → always the NclAi lane.
    /// - `Auto` → delegates to [`next_lane`](Self::next_lane).
    pub fn next_lane_for_group(&mut self, group: SessionGroup) -> (RevenueSource, f64) {
        match group {
            SessionGroup::Zion => (
                RevenueSource::Zion,
                self.value_for_source(RevenueSource::Zion)
                    .unwrap_or(self.default_value_usd),
            ),
            SessionGroup::Revenue => {
                // Rotate through enabled external-algo lanes.
                let external_lanes: Vec<_> = self
                    .lanes
                    .iter()
                    .filter(|l| {
                        l.weight > 0
                            && matches!(
                                l.source,
                                RevenueSource::Blake3External
                                    | RevenueSource::KHeavyHashExternal
                                    | RevenueSource::EthashExternal
                                    | RevenueSource::KawPowExternal
                                    | RevenueSource::AutolykosExternal
                                    | RevenueSource::RandomXExternal
                                    | RevenueSource::ZelHashExternal
                                    | RevenueSource::VerusHashExternal
                                    | RevenueSource::ProgPowExternal
                                    | RevenueSource::PearlExternal
                                    | RevenueSource::BeamHashExternal
                                    | RevenueSource::KarlsenHashExternal
                                    | RevenueSource::EquihashZeroExternal
                                    | RevenueSource::QhashExternal
                                    | RevenueSource::VerthashExternal
                                    | RevenueSource::FishHashExternal
                                    | RevenueSource::NexaPowExternal
                                    | RevenueSource::GhostRiderExternal
                                    | RevenueSource::DynexSolveExternal
                            )
                    })
                    .copied()
                    .collect();
                if external_lanes.is_empty() {
                    return (
                        RevenueSource::Blake3External,
                        self.value_for_source(RevenueSource::Blake3External)
                            .unwrap_or(self.default_value_usd),
                    );
                }
                // Use a stable sub-cursor for external rotation.
                let idx = self.cursor as usize % external_lanes.len();
                self.cursor = self.cursor.wrapping_add(1);
                let lane = external_lanes[idx];
                (lane.source, lane.value_usd)
            }
            SessionGroup::Ncl => (
                RevenueSource::NclAi,
                self.value_for_source(RevenueSource::NclAi)
                    .unwrap_or(self.default_value_usd),
            ),
            SessionGroup::Auto => self.next_lane(),
        }
    }

    /// Look up the USD value configured for a specific revenue source.
    pub fn value_for_source(&self, source: RevenueSource) -> Option<f64> {
        self.lanes
            .iter()
            .find(|lane| lane.source == source)
            .map(|lane| lane.value_usd)
    }

    /// Human-readable description of the current lane plan.
    ///
    /// Format: `source:weight%:$value,source:weight%:$value,...`
    pub fn describe_plan(&self) -> String {
        self.lanes
            .iter()
            .map(|lane| {
                format!(
                    "{}:{}%:${:.2}",
                    revenue_source_name(lane.source),
                    lane.weight,
                    lane.value_usd
                )
            })
            .collect::<Vec<_>>()
            .join(",")
    }

    /// Compact stream-weights string for job messages.
    ///
    /// Format: `source:weight_pct,source:weight_pct,...`
    /// Only includes lanes with non-zero weight.
    pub fn stream_weights_string(&self) -> String {
        let total: u32 = self.lanes.iter().map(|l| l.weight).sum();
        if total == 0 {
            return String::new();
        }
        self.lanes
            .iter()
            .filter(|l| l.weight > 0)
            .map(|l| {
                let pct = (l.weight as f64 / total as f64) * 100.0;
                format!("{}:{:.1}", revenue_source_name(l.source), pct)
            })
            .collect::<Vec<_>>()
            .join(",")
    }

    /// Whether multi-stream mode is enabled.
    pub fn is_multistream(&self) -> bool {
        self.multistream_enabled
    }
}

// ── Helpers ────────────────────────────────────────────────────────

/// Return the canonical short name for a `RevenueSource`.
///
/// Delegates to `RevenueSource::as_str()` from the cosmic-harmony crate.
pub fn revenue_source_name(source: RevenueSource) -> &'static str {
    source.as_str()
}

/// Push a lane parsed from env vars into the lanes vector.
///
/// If the weight env var resolves to 0 the lane is skipped (disabled).
fn push_lane_from_env(
    lanes: &mut Vec<RevenueLane>,
    source: RevenueSource,
    weight_key: &str,
    value_key: &str,
    default_weight: u32,
    default_value_usd: f64,
) {
    let weight = parse_env_u32(weight_key, default_weight);
    if weight == 0 {
        return;
    }
    let value_usd = parse_env_f64(value_key, default_value_usd);
    lanes.push(RevenueLane {
        source,
        value_usd,
        weight,
    });
}

// ── Unit tests ─────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_lane_mode() {
        let mut sched = RevenueScheduler::new(RevenueSource::Zion, 0.001);
        assert!(!sched.is_multistream());
        assert_eq!(sched.lanes.len(), 1);
        assert_eq!(sched.lanes[0].source, RevenueSource::Zion);
        assert_eq!(sched.lanes[0].weight, 100);
        assert_eq!(sched.total_weight, 100);

        // next_lane always returns the single lane.
        let (src, val) = sched.next_lane();
        assert_eq!(src, RevenueSource::Zion);
        assert!((val - 0.001).abs() < f64::EPSILON);
    }

    #[test]
    fn test_multistream_from_env() {
        // Ensure no env vars leak from the environment.
        std::env::remove_var("ZION_REVENUE_MULTISTREAM");
        std::env::remove_var("ZION_STREAM_ZION_PCT");
        std::env::remove_var("ZION_STREAM_BLAKE3_PCT");
        std::env::remove_var("ZION_STREAM_NCL_PCT");

        let sched = RevenueScheduler::from_env(0.001);
        // Without ZION_REVENUE_MULTISTREAM=true, defaults to single-lane.
        assert!(!sched.is_multistream());
        assert_eq!(sched.lanes.len(), 1);

        // Now enable multistream with canonical defaults.
        std::env::set_var("ZION_REVENUE_MULTISTREAM", "true");
        let sched = RevenueScheduler::from_env(0.001);
        std::env::remove_var("ZION_REVENUE_MULTISTREAM");
        assert!(sched.is_multistream());
        // Canonical: Zion 50, Blake3 25, Ncl 25.
        assert_eq!(sched.lanes.len(), 3);
        assert_eq!(sched.total_weight, 100);
        assert_eq!(sched.lanes[0].source, RevenueSource::Zion);
        assert_eq!(sched.lanes[0].weight, 50);
        assert_eq!(sched.lanes[1].source, RevenueSource::Blake3External);
        assert_eq!(sched.lanes[1].weight, 25);
        assert_eq!(sched.lanes[2].source, RevenueSource::NclAi);
        assert_eq!(sched.lanes[2].weight, 25);
    }

    #[test]
    fn test_next_lane_round_robin() {
        let sched = RevenueScheduler {
            lanes: vec![
                RevenueLane {
                    source: RevenueSource::Zion,
                    value_usd: 0.001,
                    weight: 50,
                },
                RevenueLane {
                    source: RevenueSource::Blake3External,
                    value_usd: 0.002,
                    weight: 25,
                },
                RevenueLane {
                    source: RevenueSource::NclAi,
                    value_usd: 0.003,
                    weight: 25,
                },
            ],
            total_weight: 100,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: false,
            default_value_usd: 0.001,
            multistream_enabled: true,
        };
        let mut sched = sched;

        // With weights 50/25/25 and cursor starting at 0:
        // positions 0-49 → Zion, 50-74 → Blake3, 75-99 → Ncl.
        let mut results = Vec::new();
        for _ in 0..100 {
            results.push(sched.next_lane());
        }

        let zion_count = results
            .iter()
            .filter(|(s, _)| *s == RevenueSource::Zion)
            .count();
        let blake_count = results
            .iter()
            .filter(|(s, _)| *s == RevenueSource::Blake3External)
            .count();
        let ncl_count = results
            .iter()
            .filter(|(s, _)| *s == RevenueSource::NclAi)
            .count();

        assert_eq!(zion_count, 50);
        assert_eq!(blake_count, 25);
        assert_eq!(ncl_count, 25);
    }

    #[test]
    fn test_assign_auto_group() {
        let mut sched = RevenueScheduler {
            lanes: vec![
                RevenueLane {
                    source: RevenueSource::Zion,
                    value_usd: 0.001,
                    weight: 50,
                },
                RevenueLane {
                    source: RevenueSource::Blake3External,
                    value_usd: 0.002,
                    weight: 25,
                },
                RevenueLane {
                    source: RevenueSource::NclAi,
                    value_usd: 0.003,
                    weight: 25,
                },
            ],
            total_weight: 100,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: false,
            default_value_usd: 0.001,
            multistream_enabled: true,
        };

        // With auto_assign_include_zion=false, only Revenue (25) and Ncl (25)
        // participate → 50/50 split between Revenue and Ncl.
        let mut revenue = 0;
        let mut ncl = 0;
        for _ in 0..100 {
            match sched.assign_auto_group() {
                SessionGroup::Revenue => revenue += 1,
                SessionGroup::Ncl => ncl += 1,
                _ => {}
            }
        }
        assert_eq!(revenue, 50);
        assert_eq!(ncl, 50);
    }

    #[test]
    fn test_next_lane_for_zion_group() {
        let mut sched = RevenueScheduler {
            lanes: vec![
                RevenueLane {
                    source: RevenueSource::Zion,
                    value_usd: 0.005,
                    weight: 50,
                },
                RevenueLane {
                    source: RevenueSource::Blake3External,
                    value_usd: 0.002,
                    weight: 25,
                },
                RevenueLane {
                    source: RevenueSource::NclAi,
                    value_usd: 0.003,
                    weight: 25,
                },
            ],
            total_weight: 100,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: false,
            default_value_usd: 0.001,
            multistream_enabled: true,
        };

        // Zion group always maps to the Zion lane.
        let (src, val) = sched.next_lane_for_group(SessionGroup::Zion);
        assert_eq!(src, RevenueSource::Zion);
        assert!((val - 0.005).abs() < f64::EPSILON);

        // Ncl group always maps to the NclAi lane.
        let (src, val) = sched.next_lane_for_group(SessionGroup::Ncl);
        assert_eq!(src, RevenueSource::NclAi);
        assert!((val - 0.003).abs() < f64::EPSILON);
    }

    #[test]
    fn test_stream_weights_string() {
        let sched = RevenueScheduler {
            lanes: vec![
                RevenueLane {
                    source: RevenueSource::Zion,
                    value_usd: 0.001,
                    weight: 50,
                },
                RevenueLane {
                    source: RevenueSource::Blake3External,
                    value_usd: 0.002,
                    weight: 25,
                },
                RevenueLane {
                    source: RevenueSource::NclAi,
                    value_usd: 0.003,
                    weight: 25,
                },
            ],
            total_weight: 100,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: false,
            default_value_usd: 0.001,
            multistream_enabled: true,
        };

        let s = sched.stream_weights_string();
        // Each lane with non-zero weight appears as source:pct.
        let parts: Vec<&str> = s.split(',').collect();
        assert_eq!(parts.len(), 3);
        assert!(parts[0].starts_with("zion:50.0"));
        assert!(parts[1].starts_with("blake3_external:25.0"));
        assert!(parts[2].starts_with("ncl_ai:25.0"));
    }
}
