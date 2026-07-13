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

    /// Parse a compact stream-weights string as sent by the pool in job messages.
    ///
    /// Format: `source:weight,source:weight,...` where source is the canonical
    /// `RevenueSource::as_str()` name and weight is either a percentage (0-100)
    /// or a normalised fraction (0-1).  Missing sources default to 0.0.
    pub fn parse(s: &str) -> Result<Self, String> {
        let mut weights: Vec<StreamWeight> = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for part in s.split(',') {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }
            let (name, value) = part.split_once(':').ok_or_else(|| {
                format!("invalid stream weight segment (expected name:value): {}", part)
            })?;
            let source = match name.trim().to_ascii_lowercase().as_str() {
                "zion" => RevenueSource::Zion,
                "keccak_bonus" | "keccak" => RevenueSource::KeccakBonus,
                "sha3_bonus" | "sha3" => RevenueSource::Sha3Bonus,
                "ncl_ai" | "ncl" => RevenueSource::NclAi,
                "deeksha_lite" | "lite" => RevenueSource::DeekshaLite,
                "thermal_bonus" | "thermal" => RevenueSource::ThermalBonus,
                "profit_switch" => RevenueSource::ProfitSwitch,
                "blake3_external" | "blake3" => RevenueSource::Blake3External,
                "kheavyhash_external" | "kheavyhash" => RevenueSource::KHeavyHashExternal,
                "autolykos_external" | "autolykos" => RevenueSource::AutolykosExternal,
                "kawpow_external" | "kawpow" => RevenueSource::KawPowExternal,
                "ethash_external" | "ethash" => RevenueSource::EthashExternal,
                other => return Err(format!("unknown revenue source: {}", other)),
            };
            let raw: f64 = value
                .trim()
                .parse()
                .map_err(|e| format!("invalid weight value for {}: {}", name, e))?;
            let weight = if raw > 1.0 { raw / 100.0 } else { raw };
            if !(0.0..=1.0).contains(&weight) {
                return Err(format!("weight for {} out of range: {}", name, raw));
            }
            if !seen.insert(source) {
                return Err(format!("duplicate revenue source: {}", name));
            }
            weights.push(StreamWeight { source, weight });
        }
        Ok(Self {
            weights,
            snapshot_ts: 0,
            live: false,
        })
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
// LIVE API FETCHING
// ============================================================================

/// Fetch a live profit snapshot from an external API.
///
/// Currently supports:
/// - "whattomine" — WhatToMine coins JSON API
/// - "coingecko" — CoinGecko simple price API
/// - "fallback" or any other — static fallback estimates
///
/// On any API error, falls back to static estimates.
pub fn fetch_profit_snapshot(config: &StreamProfitConfig) -> StreamProfitSnapshot {
    match config.api_provider.as_str() {
        "whattomine" => fetch_whattomine(config),
        "coingecko" => fetch_coingecko(config),
        _ => StreamProfitSnapshot::fallback(),
    }
}

/// Fetch profitability from WhatToMine API.
///
/// WhatToMine provides `https://whattomine.com/coins.json` with revenue
/// estimates per coin. We map these to Deeksha Chv3 internal streams:
/// - Keccak/SHA3 coins → KeccakBonus / Sha3Bonus streams
/// - NCL/AI → NclAi stream (estimated from GPU compute market)
/// - ZION → Zion stream (block reward estimate)
fn fetch_whattomine(config: &StreamProfitConfig) -> StreamProfitSnapshot {
    let url = if config.api_url.is_empty() {
        "https://whattomine.com/coins.json"
    } else {
        &config.api_url
    };

    // Use a blocking HTTP client with a short timeout.
    // The background thread is not async, so we use reqwest::blocking.
    // If reqwest::blocking is not available, fall back to static estimates.
    match fetch_url_blocking(url, 10) {
        Ok(body) => parse_whattomine_response(&body),
        Err(e) => {
            eprintln!("stream_profit: whattomine fetch error: {e}");
            let mut snap = StreamProfitSnapshot::fallback();
            snap.live = false;
            snap
        }
    }
}

/// Fetch prices from CoinGecko API.
fn fetch_coingecko(config: &StreamProfitConfig) -> StreamProfitSnapshot {
    let url = if config.api_url.is_empty() {
        "https://api.coingecko.com/api/v3/simple/price?ids=decred,alephium,kaspa,ergo,ravencoin,ethereum-classic,monero,flux&vs_currencies=usd"
    } else {
        &config.api_url
    };

    match fetch_url_blocking(url, 10) {
        Ok(body) => parse_coingecko_response(&body),
        Err(e) => {
            eprintln!("stream_profit: coingecko fetch error: {e}");
            let mut snap = StreamProfitSnapshot::fallback();
            snap.live = false;
            snap
        }
    }
}

/// Fetch a URL with a timeout using a blocking reqwest client.
///
/// Returns the response body as a string, or an error on failure.
fn fetch_url_blocking(url: &str, timeout_secs: u64) -> Result<String, String> {
    // We use a tokio runtime here because the pool already has tokio
    // available, and reqwest 0.12 requires it. The background thread
    // can afford to block briefly.
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| format!("tokio runtime error: {e}"))?;

    rt.block_on(async move {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .user_agent("ZION-Pool/3.0.4")
            .build()
            .map_err(|e| format!("reqwest client error: {e}"))?;

        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("reqwest send error: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }

        resp.text()
            .await
            .map_err(|e| format!("reqwest body error: {e}"))
    })
}

/// Parse WhatToMine coins.json response into a StreamProfitSnapshot.
///
/// WhatToMine returns: { "coins": { "1": { "name": "...", "tag": "DCR", "revenue": "0.45", ... } } }
fn parse_whattomine_response(body: &str) -> StreamProfitSnapshot {
    // Use serde_json to parse the response.
    let parsed: Option<serde_json::Value> = serde_json::from_str(body).ok();
    let Some(json) = parsed else {
        eprintln!("stream_profit: whattomine parse error");
        return StreamProfitSnapshot::fallback();
    };

    let mut entries = Vec::new();
    let fallback = StreamProfitSnapshot::fallback();

    // WhatToMine coins are keyed by numeric ID.
    if let Some(coins) = json.get("coins").and_then(|c| c.as_object()) {
        for (_id, coin_data) in coins {
            let tag = coin_data
                .get("tag")
                .and_then(|t| t.as_str())
                .unwrap_or("");
            let revenue = coin_data
                .get("revenue")
                .and_then(|r| r.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);

            // Map coin tags to Deeksha Chv3 internal streams.
            // WhatToMine revenue is per-GH/s-day in USD.
            match tag.to_uppercase().as_str() {
                "DCR" | "ALPH" => {
                    // Blake3 coins → KeccakBonus stream (similar hash-power market)
                    entries.push(StreamProfitEntry {
                        source: RevenueSource::KeccakBonus,
                        revenue_per_day_usd: revenue.max(0.01),
                        cost_per_day_usd: 0.05,
                        api_label: Some(format!("whattomine:{}", tag)),
                    });
                }
                "KAS" => {
                    // kHeavyHash → Sha3Bonus stream
                    entries.push(StreamProfitEntry {
                        source: RevenueSource::Sha3Bonus,
                        revenue_per_day_usd: revenue.max(0.01),
                        cost_per_day_usd: 0.05,
                        api_label: Some(format!("whattomine:{}", tag)),
                    });
                }
                _ => {} // Skip coins we don't map to internal streams
            }
        }
    }

    // Always include Zion and NclAi from fallback (no WhatToMine equivalent).
    if let Some(zion) = fallback.entry_for(RevenueSource::Zion) {
        entries.push(zion.clone());
    }
    if let Some(ncl) = fallback.entry_for(RevenueSource::NclAi) {
        entries.push(ncl.clone());
    }
    if let Some(lite) = fallback.entry_for(RevenueSource::DeekshaLite) {
        entries.push(lite.clone());
    }
    if let Some(thermal) = fallback.entry_for(RevenueSource::ThermalBonus) {
        entries.push(thermal.clone());
    }

    // If no external coins were found, add fallback KeccakBonus/Sha3Bonus.
    if !entries.iter().any(|e| e.source == RevenueSource::KeccakBonus) {
        if let Some(k) = fallback.entry_for(RevenueSource::KeccakBonus) {
            entries.push(k.clone());
        }
    }
    if !entries.iter().any(|e| e.source == RevenueSource::Sha3Bonus) {
        if let Some(s) = fallback.entry_for(RevenueSource::Sha3Bonus) {
            entries.push(s.clone());
        }
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    StreamProfitSnapshot {
        entries,
        timestamp,
        live: true,
    }
}

/// Parse CoinGecko simple/price response into a StreamProfitSnapshot.
///
/// CoinGecko returns: { "decred": { "usd": 12.5 }, "alephium": { "usd": 0.35 }, ... }
fn parse_coingecko_response(body: &str) -> StreamProfitSnapshot {
    let parsed: Option<serde_json::Value> = serde_json::from_str(body).ok();
    let Some(json) = parsed else {
        eprintln!("stream_profit: coingecko parse error");
        return StreamProfitSnapshot::fallback();
    };

    let fallback = StreamProfitSnapshot::fallback();
    let mut entries = Vec::new();

    // Helper: get USD price for a coin ID.
    let get_price = |id: &str| -> f64 {
        json.get(id)
            .and_then(|c| c.get("usd"))
            .and_then(|u| u.as_f64())
            .unwrap_or(0.0)
    };

    // Map coin prices to Deeksha Chv3 internal streams.
    // These are spot prices, not mining revenue — but they give us
    // relative profitability signals.
    let dcr_price = get_price("decred");
    let alph_price = get_price("alephium");
    let kas_price = get_price("kaspa");

    // Blake3 coins (DCR, ALPH) → KeccakBonus stream
    let blake3_revenue = (dcr_price * 0.04 + alph_price * 0.08).max(0.01);
    entries.push(StreamProfitEntry {
        source: RevenueSource::KeccakBonus,
        revenue_per_day_usd: blake3_revenue,
        cost_per_day_usd: 0.05,
        api_label: Some("coingecko:dcr+alph".to_string()),
    });

    // kHeavyHash (KAS) → Sha3Bonus stream
    let khh_revenue = (kas_price * 0.05).max(0.01);
    entries.push(StreamProfitEntry {
        source: RevenueSource::Sha3Bonus,
        revenue_per_day_usd: khh_revenue,
        cost_per_day_usd: 0.05,
        api_label: Some("coingecko:kas".to_string()),
    });

    // Zion and NclAi from fallback (no CoinGecko equivalent).
    if let Some(zion) = fallback.entry_for(RevenueSource::Zion) {
        entries.push(zion.clone());
    }
    if let Some(ncl) = fallback.entry_for(RevenueSource::NclAi) {
        entries.push(ncl.clone());
    }
    if let Some(lite) = fallback.entry_for(RevenueSource::DeekshaLite) {
        entries.push(lite.clone());
    }
    if let Some(thermal) = fallback.entry_for(RevenueSource::ThermalBonus) {
        entries.push(thermal.clone());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    StreamProfitSnapshot {
        entries,
        timestamp,
        live: true,
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
