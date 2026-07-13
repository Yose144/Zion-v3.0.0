//! Stream Profit System — profit-based weight computation for Deeksha Chv3 pipeline.
//!
//! All revenue streams live INSIDE the Deeksha Chv3 pipeline.  This module
//! defines the data structures and logic for computing optimal stream weights
//! based on live profitability data.
//!
//! ## Streams
//!
//! The Deeksha Chv3 pipeline produces these revenue streams as byproducts:
//!
//! | Stream       | Pipeline step(s)              | Revenue source                    |
//! |-------------|-------------------------------|-----------------------------------|
//! | Zion        | GoldenMatrix, MemHard, Fusion | ZION block rewards                |
//! | KeccakBonus | Keccak-256 (step 1)           | NiceHash Keccak hash-power sales  |
//! | Sha3Bonus   | SHA3-512 (step 2)             | NiceHash SHA3 hash-power sales    |
//! | NclAi       | NpuMix (step 5)               | NCL AI compute marketplace        |
//! | DeekshaLite | Lite variant (AES path)       | ZION lite blocks (GCN-friendly)   |
//! | ThermalBonus| Fire variant (thermal path)   | Useful heat / winter heating      |
//!
//! ## Weight computation
//!
//! Profit data is fetched periodically (default 120 s) from external APIs.
//! Each stream's weight is proportional to its profit-per-unit-GPU-time.
//! Hysteresis prevents rapid oscillation between streams.

use serde::{Deserialize, Serialize};

use crate::revenue::RevenueSource;
use crate::stream_layers::DeekshaStep;

// ============================================================================
// CONSTANTS
// ============================================================================

/// Minimum weight for any enabled stream (prevents starvation).
pub const MIN_STREAM_WEIGHT: f64 = 0.02; // 2 %

/// Default hysteresis percentage — only switch if new stream is this much
/// better than the current dominant stream.
pub const DEFAULT_HYSTERESIS_PCT: f64 = 15.0;

/// Default profit fetch interval in seconds.
pub const DEFAULT_PROFIT_INTERVAL_SECS: u64 = 120;

/// Default stream allocation when profit data is unavailable.
///
/// Matches the canonical 50/25/25 split:
///   Zion 50 %, KeccakBonus+Sha3Bonus 25 % (multi-algo), NclAi 25 %.
pub const DEFAULT_ZION_WEIGHT: f64 = 0.50;
pub const DEFAULT_MULTIALGO_WEIGHT: f64 = 0.25;
pub const DEFAULT_NCL_WEIGHT: f64 = 0.25;

// ============================================================================
// PROFIT DATA
// ============================================================================

/// Profitability snapshot for a single Deeksha Chv3 stream.
///
/// `revenue_per_day_usd` is the estimated gross USD revenue per day at a
/// reference GPU hashrate.  `cost_per_day_usd` is the electricity + overhead
/// cost allocated to this stream.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamProfitEntry {
    pub source: RevenueSource,
    pub revenue_per_day_usd: f64,
    pub cost_per_day_usd: f64,
    /// Optional raw data from the API (e.g. NiceHash order price).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_label: Option<String>,
}

impl StreamProfitEntry {
    pub fn profit_per_day_usd(&self) -> f64 {
        self.revenue_per_day_usd - self.cost_per_day_usd
    }
}

/// Complete profit snapshot for all Deeksha Chv3 streams.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StreamProfitSnapshot {
    pub entries: Vec<StreamProfitEntry>,
    /// Unix timestamp of the last successful API fetch.
    pub timestamp: u64,
    /// Whether this snapshot came from a live API or fallback estimates.
    pub live: bool,
}

impl StreamProfitSnapshot {
    /// Static fallback estimates when no API is available.
    ///
    /// Values are conservative daily USD estimates per 100 MH/s reference
    /// hashrate at $0.12/kWh electricity.
    pub fn fallback() -> Self {
        let entries = vec![
            StreamProfitEntry {
                source: RevenueSource::Zion,
                revenue_per_day_usd: 1.50,
                cost_per_day_usd: 0.20,
                api_label: Some("fallback".to_string()),
            },
            StreamProfitEntry {
                source: RevenueSource::KeccakBonus,
                revenue_per_day_usd: 0.45,
                cost_per_day_usd: 0.05,
                api_label: Some("fallback".to_string()),
            },
            StreamProfitEntry {
                source: RevenueSource::Sha3Bonus,
                revenue_per_day_usd: 0.30,
                cost_per_day_usd: 0.05,
                api_label: Some("fallback".to_string()),
            },
            StreamProfitEntry {
                source: RevenueSource::NclAi,
                revenue_per_day_usd: 0.80,
                cost_per_day_usd: 0.08,
                api_label: Some("fallback".to_string()),
            },
            StreamProfitEntry {
                source: RevenueSource::DeekshaLite,
                revenue_per_day_usd: 1.20,
                cost_per_day_usd: 0.15,
                api_label: Some("fallback".to_string()),
            },
            StreamProfitEntry {
                source: RevenueSource::ThermalBonus,
                revenue_per_day_usd: 0.25,
                cost_per_day_usd: 0.02,
                api_label: Some("fallback".to_string()),
            },
        ];
        Self {
            entries,
            timestamp: 0,
            live: false,
        }
    }

    /// Find an entry for a specific revenue source.
    pub fn entry_for(&self, source: RevenueSource) -> Option<&StreamProfitEntry> {
        self.entries.iter().find(|e| e.source == source)
    }
}

// ============================================================================
// STREAM WEIGHTS
// ============================================================================

/// Normalised weight for a single Deeksha Chv3 stream (0.0 – 1.0).
///
/// All weights in a `StreamWeights` collection sum to 1.0.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct StreamWeight {
    pub source: RevenueSource,
    pub weight: f64,
}

/// Complete set of stream weights for the Deeksha Chv3 pipeline.
///
/// The pool computes these from a `StreamProfitSnapshot` and sends them
/// to miners in job messages.  Miners use them to parameterise the GPU
/// kernel's work distribution across pipeline steps.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StreamWeights {
    pub weights: Vec<StreamWeight>,
    /// Profit snapshot that produced these weights (for logging).
    pub snapshot_ts: u64,
    pub live: bool,
}

impl StreamWeights {
    /// Default 50/25/25 split (Zion / multi-algo / NCL).
    pub fn default_split() -> Self {
        Self {
            weights: vec![
                StreamWeight {
                    source: RevenueSource::Zion,
                    weight: DEFAULT_ZION_WEIGHT,
                },
                StreamWeight {
                    source: RevenueSource::KeccakBonus,
                    weight: DEFAULT_MULTIALGO_WEIGHT * 0.6,
                },
                StreamWeight {
                    source: RevenueSource::Sha3Bonus,
                    weight: DEFAULT_MULTIALGO_WEIGHT * 0.4,
                },
                StreamWeight {
                    source: RevenueSource::NclAi,
                    weight: DEFAULT_NCL_WEIGHT,
                },
            ],
            snapshot_ts: 0,
            live: false,
        }
    }

    /// Compute profit-based weights from a profit snapshot.
    ///
    /// Each stream's weight is proportional to its profit-per-day.
    /// Streams with negative profit get `MIN_STREAM_WEIGHT` (not zero,
    /// to avoid starvation — the miner still does some work for each stream).
    /// Hysteresis is applied relative to the `current` weights to prevent
    /// rapid oscillation.
    pub fn from_profit(
        snapshot: &StreamProfitSnapshot,
        current: Option<&StreamWeights>,
        enabled_sources: &[RevenueSource],
        hysteresis_pct: f64,
    ) -> Self {
        if snapshot.entries.is_empty() {
            return Self::default_split();
        }

        // Collect profit values for enabled streams.
        let mut profits: Vec<(RevenueSource, f64)> = Vec::new();
        for &source in enabled_sources {
            let profit = snapshot
                .entry_for(source)
                .map(|e| e.profit_per_day_usd())
                .unwrap_or(0.0);
            // Floor at a small positive value so even unprofitable streams
            // get a minimal allocation.
            let floored = profit.max(0.01);
            profits.push((source, floored));
        }

        if profits.is_empty() {
            return Self::default_split();
        }

        // Apply hysteresis: if current weights exist, dampen changes.
        if let Some(cur) = current {
            for (source, profit) in &mut profits {
                if let Some(cur_w) = cur.weights.iter().find(|w| w.source == *source) {
                    // Dampen: blend current weight's implied profit with new profit.
                    // This prevents a single API spike from causing a large shift.
                    let blended = cur_w.weight * *profit * 0.5 + *profit * 0.5;
                    *profit = blended;
                }
            }
        }

        // Normalise to [0, 1].
        let total: f64 = profits.iter().map(|(_, p)| *p).sum();
        if total <= 0.0 {
            return Self::default_split();
        }

        let mut weights: Vec<StreamWeight> = profits
            .iter()
            .map(|(source, profit)| StreamWeight {
                source: *source,
                weight: (*profit / total).max(MIN_STREAM_WEIGHT),
            })
            .collect();

        // Re-normalise after applying minimum weights.
        let weight_sum: f64 = weights.iter().map(|w| w.weight).sum();
        if weight_sum > 0.0 {
            for w in &mut weights {
                w.weight /= weight_sum;
            }
        }

        // Apply hysteresis: check if the dominant stream changed.
        if let Some(cur) = current {
            let new_dominant = weights
                .iter()
                .max_by(|a, b| a.weight.partial_cmp(&b.weight).unwrap_or(std::cmp::Ordering::Equal))
                .map(|w| w.source);
            let old_dominant = cur
                .weights
                .iter()
                .max_by(|a, b| a.weight.partial_cmp(&b.weight).unwrap_or(std::cmp::Ordering::Equal))
                .map(|w| w.source);

            if let (Some(new), Some(old)) = (new_dominant, old_dominant) {
                if new != old {
                    // Check if the improvement exceeds hysteresis threshold.
                    let new_profit = snapshot
                        .entry_for(new)
                        .map(|e| e.profit_per_day_usd())
                        .unwrap_or(0.0);
                    let old_profit = snapshot
                        .entry_for(old)
                        .map(|e| e.profit_per_day_usd())
                        .unwrap_or(0.0);
                    if old_profit > 0.0 {
                        let improvement =
                            (new_profit - old_profit) / old_profit * 100.0;
                        if improvement < hysteresis_pct {
                            // Keep current weights — improvement not large enough.
                            return cur.clone();
                        }
                    }
                }
            }
        }

        Self {
            weights,
            snapshot_ts: snapshot.timestamp,
            live: snapshot.live,
        }
    }

    /// Get the weight for a specific revenue source.
    pub fn weight_for(&self, source: RevenueSource) -> f64 {
        self.weights
            .iter()
            .find(|w| w.source == source)
            .map(|w| w.weight)
            .unwrap_or(0.0)
    }

    /// Map stream weights to pipeline step work-unit multipliers.
    ///
    /// Each DeekshaStep maps to a revenue stream.  The multiplier tells
    /// the GPU kernel how much extra work to do for that step relative
    /// to the base pipeline.
    ///
    /// A multiplier of 1.0 means "base work only" (no extra).  A multiplier
    /// of 2.0 means "double the work" for that step.
    pub fn to_step_multipliers(&self) -> Vec<(DeekshaStep, f64)> {
        // Base work units from stream_layers.rs
        let base: [(DeekshaStep, RevenueSource, u64); 11] = [
            (DeekshaStep::Keccak256, RevenueSource::KeccakBonus, 5),
            (DeekshaStep::Sha3_512, RevenueSource::Sha3Bonus, 5),
            (DeekshaStep::GoldenMatrix, RevenueSource::Zion, 10),
            (DeekshaStep::MemoryHard, RevenueSource::Zion, 55),
            (DeekshaStep::NpuMix, RevenueSource::NclAi, 15),
            (DeekshaStep::CosmicFusion, RevenueSource::Zion, 10),
            (DeekshaStep::AesMix, RevenueSource::DeekshaLite, 5),
            (DeekshaStep::ThermalLoop, RevenueSource::DeekshaLite, 3),
            (DeekshaStep::KeccakFinal, RevenueSource::Zion, 2),
            (DeekshaStep::AesMixFire, RevenueSource::ThermalBonus, 10),
            (DeekshaStep::ThermalLoopFire, RevenueSource::ThermalBonus, 15),
        ];

        // Compute per-stream total base weight for normalisation.
        let mut stream_base: std::collections::HashMap<RevenueSource, f64> =
            std::collections::HashMap::new();
        for (_, source, units) in &base {
            *stream_base.entry(*source).or_insert(0.0) += *units as f64;
        }

        base.iter()
            .map(|(step, source, units)| {
                let stream_weight = self.weight_for(*source);
                let stream_base = stream_base.get(source).copied().unwrap_or(1.0);
                // Step multiplier = stream_weight * (step_units / stream_base_units) * total_base
                // This distributes the stream's weight across its steps proportionally.
                let multiplier = if stream_base > 0.0 {
                    1.0 + stream_weight * (*units as f64 / stream_base) * 10.0
                } else {
                    1.0
                };
                (*step, multiplier)
            })
            .collect()
    }

    /// Human-readable description for logging.
    pub fn describe(&self) -> String {
        let parts: Vec<String> = self
            .weights
            .iter()
            .map(|w| format!("{}={:.1}%", w.source.as_str(), w.weight * 100.0))
            .collect();
        format!(
            "stream_weights[{}] {}",
            if self.live { "live" } else { "fallback" },
            parts.join(" ")
        )
    }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/// Configuration for the stream profit system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamProfitConfig {
    /// Enable profit-based stream switching.
    pub enabled: bool,
    /// Profit API URL (e.g. "https://api.nicehash.com/api/v2/...").
    /// If empty, uses fallback estimates only.
    pub api_url: String,
    /// API provider: "nicehash", "whattomine", "coingecko", or "fallback".
    pub api_provider: String,
    /// Fetch interval in seconds.
    pub interval_secs: u64,
    /// Hysteresis percentage for switching.
    pub hysteresis_pct: f64,
    /// Comma-separated list of enabled stream source names.
    /// Default: "zion,keccak_bonus,sha3_bonus,ncl_ai"
    pub enabled_sources: String,
    /// API key (optional, for authenticated APIs).
    #[serde(skip_serializing)]
    pub api_key: String,
}

impl Default for StreamProfitConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_url: String::new(),
            api_provider: "fallback".to_string(),
            interval_secs: DEFAULT_PROFIT_INTERVAL_SECS,
            hysteresis_pct: DEFAULT_HYSTERESIS_PCT,
            enabled_sources: "zion,keccak_bonus,sha3_bonus,ncl_ai".to_string(),
            api_key: String::new(),
        }
    }
}

impl StreamProfitConfig {
    /// Parse from environment variables.
    pub fn from_env() -> Self {
        let enabled = std::env::var("ZION_STREAM_PROFIT_SWITCH")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        let api_url = std::env::var("ZION_STREAM_PROFIT_API").unwrap_or_default();
        let api_provider = std::env::var("ZION_STREAM_PROFIT_API_PROVIDER")
            .unwrap_or_else(|_| "fallback".to_string());
        let interval_secs = std::env::var("ZION_STREAM_PROFIT_INTERVAL")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_PROFIT_INTERVAL_SECS);
        let hysteresis_pct = std::env::var("ZION_STREAM_HYSTERESIS_PCT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_HYSTERESIS_PCT);
        let enabled_sources = std::env::var("ZION_STREAM_PROFIT_SOURCES")
            .unwrap_or_else(|_| "zion,keccak_bonus,sha3_bonus,ncl_ai".to_string());
        let api_key = std::env::var("ZION_STREAM_PROFIT_API_KEY").unwrap_or_default();

        Self {
            enabled,
            api_url,
            api_provider,
            interval_secs,
            hysteresis_pct,
            enabled_sources,
            api_key,
        }
    }

    /// Parse the enabled_sources string into a list of RevenueSources.
    pub fn parse_enabled_sources(&self) -> Vec<RevenueSource> {
        self.enabled_sources
            .split(',')
            .filter_map(|s| match s.trim().to_ascii_lowercase().as_str() {
                "zion" => Some(RevenueSource::Zion),
                "keccak_bonus" | "keccak" => Some(RevenueSource::KeccakBonus),
                "sha3_bonus" | "sha3" => Some(RevenueSource::Sha3Bonus),
                "ncl_ai" | "ncl" => Some(RevenueSource::NclAi),
                "deeksha_lite" | "lite" => Some(RevenueSource::DeekshaLite),
                "thermal_bonus" | "thermal" => Some(RevenueSource::ThermalBonus),
                _ => None,
            })
            .collect()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_snapshot_has_all_streams() {
        let snap = StreamProfitSnapshot::fallback();
        assert!(snap.entry_for(RevenueSource::Zion).is_some());
        assert!(snap.entry_for(RevenueSource::KeccakBonus).is_some());
        assert!(snap.entry_for(RevenueSource::Sha3Bonus).is_some());
        assert!(snap.entry_for(RevenueSource::NclAi).is_some());
        assert!(snap.entry_for(RevenueSource::DeekshaLite).is_some());
        assert!(snap.entry_for(RevenueSource::ThermalBonus).is_some());
    }

    #[test]
    fn default_split_sums_to_one() {
        let w = StreamWeights::default_split();
        let sum: f64 = w.weights.iter().map(|w| w.weight).sum();
        assert!((sum - 1.0).abs() < 0.01, "weights must sum to 1.0, got {}", sum);
    }

    #[test]
    fn from_profit_produces_valid_weights() {
        let snap = StreamProfitSnapshot::fallback();
        let cfg = StreamProfitConfig::default();
        let sources = cfg.parse_enabled_sources();
        let weights = StreamWeights::from_profit(&snap, None, &sources, 15.0);

        let sum: f64 = weights.weights.iter().map(|w| w.weight).sum();
        assert!((sum - 1.0).abs() < 0.01, "weights must sum to 1.0, got {}", sum);
        assert!(!weights.weights.is_empty());
    }

    #[test]
    fn hysteresis_prevents_rapid_switching() {
        let snap1 = StreamProfitSnapshot::fallback();
        let cfg = StreamProfitConfig::default();
        let sources = cfg.parse_enabled_sources();
        let w1 = StreamWeights::from_profit(&snap1, None, &sources, 15.0);

        // Slightly different snapshot — NclAi slightly more profitable.
        let mut snap2 = snap1.clone();
        if let Some(e) = snap2.entries.iter_mut().find(|e| e.source == RevenueSource::NclAi) {
            e.revenue_per_day_usd += 0.05; // Small change
        }

        let w2 = StreamWeights::from_profit(&snap2, Some(&w1), &sources, 15.0);
        // With hysteresis, weights should not change much.
        let zion_diff = (w1.weight_for(RevenueSource::Zion) - w2.weight_for(RevenueSource::Zion)).abs();
        assert!(zion_diff < 0.1, "hysteresis should prevent large shifts, diff={}", zion_diff);
    }

    #[test]
    fn step_multipliers_are_positive() {
        let w = StreamWeights::default_split();
        let mults = w.to_step_multipliers();
        assert!(!mults.is_empty());
        for (_, m) in &mults {
            assert!(*m >= 1.0, "multiplier should be >= 1.0, got {}", m);
        }
    }

    #[test]
    fn config_from_env_defaults() {
        // No env vars set — should use defaults.
        let cfg = StreamProfitConfig::from_env();
        assert!(!cfg.enabled);
        assert_eq!(cfg.api_provider, "fallback");
        assert_eq!(cfg.interval_secs, DEFAULT_PROFIT_INTERVAL_SECS);
    }

    #[test]
    fn parse_enabled_sources() {
        let cfg = StreamProfitConfig {
            enabled_sources: "zion,keccak_bonus,ncl_ai".to_string(),
            ..Default::default()
        };
        let sources = cfg.parse_enabled_sources();
        assert_eq!(sources.len(), 3);
        assert!(sources.contains(&RevenueSource::Zion));
        assert!(sources.contains(&RevenueSource::KeccakBonus));
        assert!(sources.contains(&RevenueSource::NclAi));
    }

    #[test]
    fn describe_produces_readable_output() {
        let w = StreamWeights::default_split();
        let desc = w.describe();
        assert!(desc.contains("zion"));
        assert!(desc.contains("keccak_bonus"));
        assert!(desc.contains("ncl_ai"));
    }
}
