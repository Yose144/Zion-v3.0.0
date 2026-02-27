//! Profit Switching Engine for CH3 External Mining
//!
//! Periodically fetches profitability data from WhatToMine API,
//! compares coins, and switches the active mining target to the
//! most profitable coin, respecting hysteresis and cooldown.
//!
//! Architecture:
//!   ProfitSwitcher ──poll──→ WhatToMine API (primary)
//!       │                  ↘  Minerstat API   (secondary)
//!       │                  ↘  LastValidSnapshot (tertiary)
//!       │                  ↘  Static estimates  (quaternary)
//!       │
//!       │  ← CoinProfitData (outlier-clamped) ─────────────┘
//!       │
//!       ├── Outlier clamp: rolling-median × OUTLIER_MAX_RATIO
//!       ├── Compare: current vs best coin
//!       ├── If best > current + threshold → switch (stability > profitability spike)
//!       └── Audit log: reason written on every decision
//!
//! Integration:
//!   - main.rs spawns ProfitSwitcher::run()
//!   - Revenue proxy reads active_coin to route jobs
//!   - Pool external miner filters jobs by active coin
//!   - API endpoint /api/v1/profit/status exposes state

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{watch, RwLock};
use tracing::{debug, error, info, warn};

// ── Outlier protection constants ────────────────────────────────
/// Maximum ratio over rolling median before a profit score is clamped.
/// e.g. if median is 50 and a coin reports 400, it gets clamped to 50 * 5 = 250.
const OUTLIER_MAX_RATIO: f64 = 5.0;
/// How many polling rounds to keep in the rolling history (≈25 min at 300s interval)
const ROLLING_HISTORY_ROUNDS: usize = 5;

// ═══════════════════════════════════════════════════════════════
// GPU Detection — CH3 Rule: No GPU → 25% CPU → XMR (MoneroOcean)
// ═══════════════════════════════════════════════════════════════

/// Detect if the server has a usable GPU for mining.
/// Checks NVIDIA (nvidia-smi), AMD (rocm-smi), and env override.
///
/// CH3 Architecture Rule:
///   - GPU present → ProfitSwitcher picks best GPU coin (ETH/RVN/ERG/KAS)
///   - No GPU → Revenue 25% forced to XMR (RandomX, CPU-only, MoneroOcean)
fn detect_gpu_available() -> bool {
    // Allow manual override via environment variable
    if let Ok(val) = std::env::var("ZION_HAS_GPU") {
        let has = matches!(val.to_lowercase().as_str(), "1" | "true" | "yes");
        info!(
            "🎮 GPU override via ZION_HAS_GPU={} → {}",
            val,
            if has { "GPU mode" } else { "CPU-only mode" }
        );
        return has;
    }

    // Check NVIDIA GPU
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .arg("--query-gpu=name")
        .arg("--format=csv,noheader")
        .output()
    {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout);
            let name = name.trim();
            if !name.is_empty() {
                info!("🎮 NVIDIA GPU detected: {}", name);
                return true;
            }
        }
    }

    // Check AMD GPU
    if let Ok(output) = std::process::Command::new("rocm-smi")
        .arg("--showproductname")
        .output()
    {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout);
            if name.contains("GPU") || name.contains("Radeon") || name.contains("Instinct") {
                info!("🎮 AMD GPU detected");
                return true;
            }
        }
    }

    // Check if any /dev/dri render nodes exist (Linux GPU)
    if std::path::Path::new("/dev/dri/renderD128").exists() {
        // Could be integrated graphics — check if it's a real mining GPU
        // For now, require explicit nvidia-smi/rocm-smi detection
        debug!("🎮 /dev/dri found but no nvidia-smi/rocm-smi — treating as CPU-only");
    }

    info!("🎮 No GPU detected → CPU-only mode (Revenue 25% → XMR/MoneroOcean)");
    false
}

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

/// Profit switching configuration
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProfitSwitchConfig {
    /// Enable/disable automatic switching
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// How often to check profitability (seconds)
    #[serde(default = "default_check_interval")]
    pub check_interval_secs: u64,
    /// Minimum profit advantage to trigger a switch (percentage)
    #[serde(default = "default_threshold")]
    pub switch_threshold_pct: f64,
    /// Minimum time between switches (seconds)
    #[serde(default = "default_cooldown")]
    pub min_switch_interval_secs: u64,
    /// Coins to consider (empty = all enabled in config)
    #[serde(default)]
    pub preferred_coins: Vec<String>,
    /// Coins to never switch to
    #[serde(default)]
    pub excluded_coins: Vec<String>,
    /// Default coin when no profitability data available
    #[serde(default = "default_fallback")]
    pub fallback_coin: String,
}

fn default_true() -> bool {
    true
}
fn default_check_interval() -> u64 {
    300
} // 5 minutes
fn default_threshold() -> f64 {
    10.0
} // 10%
fn default_cooldown() -> u64 {
    1800
} // 30 minutes
fn default_fallback() -> String {
    "XMR".to_string()
}

impl Default for ProfitSwitchConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            check_interval_secs: 300,
            switch_threshold_pct: 10.0,
            min_switch_interval_secs: 1800,
            // GPU coins ranked by typical Feb 2026 profitability:
            // KAS (kHeavyHash), ETC (Ethash), ALPH (Blake3), FLUX (ZelHash),
            // RVN (KawPow), ERG (Autolykos v2), CLORE (KawPow), NEXA (NexaPoW)
            // DCR (Blake3/DCP-0011), EPIC (ProgPow), CFX/Conflux (Octopus)
            // XMR included as CPU fallback (MoneroOcean auto-algo)
            preferred_coins: vec![
                "KAS".to_string(),
                "ETC".to_string(),
                "ALPH".to_string(),
                "FLUX".to_string(),
                "RVN".to_string(),
                "ERG".to_string(),
                "DCR".to_string(),
                "EPIC".to_string(),
                "CFX".to_string(),
                "ZANO".to_string(),
                "CLORE".to_string(),
                "NEXA".to_string(),
                "XMR".to_string(),
            ],
            excluded_coins: vec![],
            fallback_coin: "ETC".to_string(),
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Profitability Data
// ═══════════════════════════════════════════════════════════════

/// Profitability data for a single coin
#[derive(Debug, Clone, Serialize)]
pub struct CoinProfitData {
    pub coin: String,
    pub algorithm: String,
    pub price_usd: f64,
    pub btc_revenue_24h: f64,
    pub usd_revenue_24h: f64,
    pub difficulty: f64,
    pub block_reward: f64,
    pub nethash: f64,
    pub profit_score: f64, // Normalized score (higher = more profitable)
    pub timestamp: i64,
}

/// Switch event record
#[derive(Debug, Clone, Serialize)]
pub struct SwitchEvent {
    pub from_coin: String,
    pub to_coin: String,
    pub reason: String,
    pub profit_advantage_pct: f64,
    pub timestamp: i64,
}

// ═══════════════════════════════════════════════════════════════
// WhatToMine API Client
// ═══════════════════════════════════════════════════════════════

/// WhatToMine API response structures
#[derive(Debug, Deserialize)]
struct WtmGpuResponse {
    coins: HashMap<String, WtmCoinData>,
}

#[derive(Debug, Deserialize)]
struct WtmCoinData {
    #[serde(default)]
    tag: String,
    #[serde(default)]
    algorithm: String,
    #[serde(default)]
    block_reward: f64,
    #[serde(default)]
    difficulty: f64,
    #[serde(default)]
    nethash: f64,
    #[serde(default, alias = "exchange_rate")]
    exchange_rate: f64,
    #[serde(default, alias = "btc_revenue")]
    btc_revenue: String,
    #[serde(default, alias = "estimated_rewards")]
    _estimated_rewards: String,
    #[serde(default)]
    _profitability: f64,
    #[serde(default)]
    profitability24: f64,
}

/// Fetch profitability data from WhatToMine GPU + ASIC APIs
/// GPU API (coins.json): ETC, RVN, ERG, FLUX, etc.
/// ASIC API (asic.json): KAS, ALPH, XMR, LTC, etc.
async fn fetch_whattomine(coins: &[String]) -> Result<Vec<CoinProfitData>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    // Fetch both APIs in parallel
    let (gpu_result, asic_result) = tokio::join!(
        fetch_wtm_endpoint(&client, "https://whattomine.com/coins.json", coins),
        fetch_wtm_endpoint(&client, "https://whattomine.com/asic.json", coins),
    );

    let mut results = Vec::new();

    match gpu_result {
        Ok(mut data) => {
            info!("💹 WhatToMine GPU: {} coins matched", data.len());
            results.append(&mut data);
        }
        Err(e) => warn!("💹 WhatToMine GPU API error: {}", e),
    }

    match asic_result {
        Ok(mut data) => {
            info!("💹 WhatToMine ASIC: {} coins matched", data.len());
            // Merge: if a coin exists in both APIs, keep the one with higher score
            for asic_coin in data.drain(..) {
                if let Some(existing) = results
                    .iter_mut()
                    .find(|r: &&mut CoinProfitData| r.coin == asic_coin.coin)
                {
                    if asic_coin.profit_score > existing.profit_score {
                        *existing = asic_coin;
                    }
                } else {
                    results.push(asic_coin);
                }
            }
        }
        Err(e) => warn!("💹 WhatToMine ASIC API error: {}", e),
    }

    if results.is_empty() {
        return Err("No data from either WhatToMine API".to_string());
    }

    // Sort by profitability (descending)
    results.sort_by(|a, b| {
        b.profit_score
            .partial_cmp(&a.profit_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(results)
}

/// Fetch a single WhatToMine endpoint and parse results
async fn fetch_wtm_endpoint(
    client: &reqwest::Client,
    url: &str,
    coins: &[String],
) -> Result<Vec<CoinProfitData>, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Request to {} failed: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!("{} HTTP {}", url, response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Body read from {} failed: {}", url, e))?;

    let wtm: WtmGpuResponse =
        serde_json::from_str(&body).map_err(|e| format!("Parse {} failed: {}", url, e))?;

    let now = Utc::now().timestamp();
    let mut results = Vec::new();

    // Map WhatToMine coin names to our tags
    let coin_map: HashMap<&str, &str> = [
        ("Ethereum Classic", "ETC"),
        ("EthereumPoW", "ETHW"),
        ("Ravencoin", "RVN"),
        ("Kaspa", "KAS"),
        ("Ergo", "ERG"),
        ("Alephium", "ALPH"),
        ("Flux", "FLUX"),
        ("Nexa", "NEXA"),
        ("Neoxa", "NEOXA"),
        ("Clore.ai", "CLORE"),
        ("Monero", "XMR"),
        ("Litecoin", "LTC"),
        ("Decred", "DCR"),
        ("Epic Cash", "EPIC"),
        ("Conflux", "CFX"),
        ("Zano", "ZANO"),
    ]
    .iter()
    .cloned()
    .collect();

    for (name, data) in &wtm.coins {
        // Skip Nicehash entries
        if name.starts_with("Nicehash") {
            continue;
        }

        let tag = coin_map
            .get(name.as_str())
            .map(|t| t.to_string())
            .unwrap_or_else(|| data.tag.clone());

        // Filter: only coins we care about
        if !coins.is_empty() && !coins.iter().any(|c| c.eq_ignore_ascii_case(&tag)) {
            continue;
        }

        let btc_rev: f64 = data.btc_revenue.parse().unwrap_or(0.0);
        let usd_rev = btc_rev * data.exchange_rate;

        results.push(CoinProfitData {
            coin: tag.to_uppercase(),
            algorithm: data.algorithm.clone(),
            price_usd: data.exchange_rate,
            btc_revenue_24h: btc_rev,
            usd_revenue_24h: usd_rev,
            difficulty: data.difficulty,
            block_reward: data.block_reward,
            nethash: data.nethash,
            profit_score: data.profitability24,
            timestamp: now,
        });
    }

    Ok(results)
}

/// Fallback: manual profitability estimation when WhatToMine is unavailable
fn estimate_profitability_fallback(coins: &[String]) -> Vec<CoinProfitData> {
    let now = Utc::now().timestamp();

    // Static estimates based on typical February 2026 values.
    // Scores are WhatToMine-normalised profitability (higher = mine this first).
    // Order: KAS > ETC > ALPH > FLUX > RVN > ERG > DCR > EPIC > CFX > CLORE > NEXA > XMR(CPU)
    let estimates: Vec<(&str, &str, f64)> = vec![
        ("KAS",   "kHeavyHash",  85.0), // ASIC+GPU, consistently top GPU coin
        ("ETC",   "Ethash",      60.0), // high liquidity, stable revenue
        ("ALPH",  "Blake3",      55.0), // ASIC‑resistant Blake3, rising network
        ("FLUX",  "ZelHash",     50.0), // Equihash 125,4 — ASIC‑resistant
        ("RVN",   "KawPow",      40.0), // GPU-only KawPow
        ("ERG",   "Autolykos2",  35.0), // Autolykos v2 — memory-hard GPU
        ("DCR",   "blake3-dcr",  45.0), // Decred Blake3 — high-profit, ASIC+GPU
        ("EPIC",  "progpow-epic",38.0), // Epic Cash ProgPow GPU
        ("CFX",   "octopus",     42.0), // Conflux Octopus — SHA3 DAG, 4 GB+
        ("ZANO",  "progpowz",    36.0), // Zano ProgPowZ — identické konstanty jako ProgPow 0.9.2
        ("CLORE", "KawPow",      28.0), // KawPow clone, smaller market
        ("NEXA",  "NexaPoW",     22.0), // NexaPoW SHA3d — smaller cap
        ("XMR",   "RandomX",     90.0), // CPU fallback via MoneroOcean
    ];

    estimates
        .iter()
        .filter(|(tag, _, _)| coins.is_empty() || coins.iter().any(|c| c.eq_ignore_ascii_case(tag)))
        .map(|(tag, algo, score)| CoinProfitData {
            coin: tag.to_string(),
            algorithm: algo.to_string(),
            price_usd: 0.0,
            btc_revenue_24h: 0.0,
            usd_revenue_24h: 0.0,
            difficulty: 0.0,
            block_reward: 0.0,
            nethash: 0.0,
            profit_score: *score,
            timestamp: now,
        })
        .collect()
}

// ═══════════════════════════════════════════════════════════════
// Minerstat Secondary Feed
// ═══════════════════════════════════════════════════════════════

/// Minerstat API coin entry (free endpoint, no API key)
#[derive(Debug, Deserialize)]
struct MinerstatCoin {
    #[serde(default)]
    coin: String,
    #[serde(default)]
    algorithm: String,
    #[serde(default)]
    price: f64,
    #[serde(default)]
    reward_block: f64,
    #[serde(default)]
    network_hashrate: f64,
    #[serde(default)]
    difficulty: f64,
}

/// Fetch profitability data from minerstat.com as a secondary/fallback feed.
/// https://api.minerstat.com/v2/coins?list=ETC,RVN,ERG,KAS,XMR
async fn fetch_minerstat(coins: &[String]) -> Result<Vec<CoinProfitData>, String> {
    if coins.is_empty() {
        return Err("No coins specified".to_string());
    }

    let list = coins.join(",").to_uppercase();
    let url = format!("https://api.minerstat.com/v2/coins?list={}", list);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&url)
        .header("User-Agent", "zion-pool/2.9.6")
        .send()
        .await
        .map_err(|e| format!("Minerstat request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Minerstat HTTP {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Minerstat body read failed: {}", e))?;

    // Minerstat returns a JSON object keyed by UPPERCASE coin symbol
    let map: HashMap<String, MinerstatCoin> =
        serde_json::from_str(&body).map_err(|e| format!("Minerstat parse error: {}", e))?;

    let now = Utc::now().timestamp();
    let mut results: Vec<CoinProfitData> = map
        .into_values()
        .filter(|c| !c.coin.is_empty())
        .map(|c| {
            // Estimate a profit score proportional to price/difficulty (no BTC revenue in this API)
            let pseudo_score = if c.difficulty > 0.0 {
                c.price * c.reward_block / (c.difficulty * 1e-12).max(1e-12)
            } else {
                c.price
            };
            CoinProfitData {
                coin: c.coin.to_uppercase(),
                algorithm: c.algorithm,
                price_usd: c.price,
                btc_revenue_24h: 0.0,
                usd_revenue_24h: pseudo_score,
                difficulty: c.difficulty,
                block_reward: c.reward_block,
                nethash: c.network_hashrate,
                profit_score: pseudo_score,
                timestamp: now,
            }
        })
        .collect();

    // Normalise so the max score = 100 (for compatibility with WhatToMine's scale)
    if let Some(max_score) = results
        .iter()
        .map(|c| c.profit_score)
        .reduce(f64::max)
        .filter(|&m| m > 0.0)
    {
        let scale = 100.0 / max_score;
        for r in &mut results {
            r.profit_score *= scale;
        }
    }

    results.sort_by(|a, b| {
        b.profit_score
            .partial_cmp(&a.profit_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(results)
}

// ═══════════════════════════════════════════════════════════════
// ZPool.ca API Feed
// ═══════════════════════════════════════════════════════════════

/// ZPool /api/status response entry pro jeden algoritmus
#[derive(Debug, Deserialize)]
struct ZpoolAlgoEntry {
    #[serde(default)]
    name: String,
    #[serde(default)]
    hashrate: f64,
    #[serde(default)]
    estimate_current: String,
    #[serde(default)]
    estimate_last24h: String,
    #[serde(default)]
    mbtc_mh_factor: f64,
}

/// Fetch profitability z zpool.ca /api/status.
///
/// ZPool je algo-based: těžíš algoritmus a zpool automaticky volí nejziskovější
/// coin v daném algu, vyplácí v BTC. Mapujeme algo → náš coin tag.
/// Profit score = estimate_last24h × mbtc_mh_factor × 1000 (mBTC/MH/day).
async fn fetch_zpool(coins: &[String]) -> Result<Vec<CoinProfitData>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let body = client
        .get("https://www.zpool.ca/api/status")
        .header("User-Agent", "zion-pool/2.9.6")
        .send()
        .await
        .map_err(|e| format!("ZPool request failed: {}", e))?
        .text()
        .await
        .map_err(|e| format!("ZPool body error: {}", e))?;

    let map: HashMap<String, ZpoolAlgoEntry> =
        serde_json::from_str(&body).map_err(|e| format!("ZPool parse error: {}", e))?;

    // ZPool algo → náš coin tag
    // ZPool aggreguje více coinů per algo; estimate reflektuje nejziskovější coin v algu.
    let algo_map: HashMap<&str, &str> = [
        ("kawpow",     "RVN"),   // Ravencoin (KawPow)
        ("ethash",     "ETC"),   // Ethereum Classic (Ethash)
        ("autolykos",  "ERG"),   // Ergo (Autolykos v2)
        ("kheavyhash", "KAS"),   // Kaspa (kHeavyHash)
        ("blake3",     "ALPH"),  // Alephium dominuje ZPool blake3 pool
        ("firopow",    "EPIC"),  // Epic Cash (FiroPow ≈ ProgPow variant)
    ]
    .iter()
    .cloned()
    .collect();

    let now = Utc::now().timestamp();
    let mut results: Vec<CoinProfitData> = map
        .into_values()
        .filter_map(|entry| {
            let coin_tag = algo_map.get(entry.name.as_str())?;
            if !coins.is_empty() && !coins.iter().any(|c| c.eq_ignore_ascii_case(coin_tag)) {
                return None;
            }
            let est_24h: f64 = entry.estimate_last24h.parse().unwrap_or(0.0);
            let est_cur: f64 = entry.estimate_current.parse().unwrap_or(0.0);
            let estimate = if est_24h > 0.0 { est_24h } else { est_cur };
            if estimate <= 0.0 || entry.mbtc_mh_factor <= 0.0 {
                return None;
            }
            // mBTC/MH/day
            let profit_raw = estimate * entry.mbtc_mh_factor * 1000.0;
            Some(CoinProfitData {
                coin: coin_tag.to_string(),
                algorithm: entry.name.clone(),
                price_usd: 0.0,
                btc_revenue_24h: estimate,
                usd_revenue_24h: profit_raw,
                difficulty: 0.0,
                block_reward: 0.0,
                nethash: entry.hashrate,
                profit_score: profit_raw,
                timestamp: now,
            })
        })
        .collect();

    if results.is_empty() {
        return Err("ZPool returned no matching coins".to_string());
    }

    // Normalizace: max = 100 (kompatibilní s WhatToMine / Minerstat)
    if let Some(max_score) = results
        .iter()
        .map(|c| c.profit_score)
        .reduce(f64::max)
        .filter(|&m| m > 0.0)
    {
        let scale = 100.0 / max_score;
        for r in &mut results {
            r.profit_score *= scale;
        }
    }

    results.sort_by(|a, b| {
        b.profit_score
            .partial_cmp(&a.profit_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(results)
}

/// Sloučení dvou profit feedů — pro coiny přítomné v obou se průměrují skóre,
/// pro coiny jen v jednom feedu se skóre zachovává. Výsledek seřazen sestupně.
fn merge_profit_feeds(
    primary: Vec<CoinProfitData>,
    secondary: Vec<CoinProfitData>,
) -> Vec<CoinProfitData> {
    let mut merged: HashMap<String, CoinProfitData> = primary
        .into_iter()
        .map(|c| (c.coin.to_uppercase(), c))
        .collect();
    for coin in secondary {
        let key = coin.coin.to_uppercase();
        match merged.entry(key) {
            std::collections::hash_map::Entry::Occupied(mut e) => {
                // Průměr obou feedů — křížová validace snižuje šum
                let ex = e.get_mut();
                ex.profit_score = (ex.profit_score + coin.profit_score) / 2.0;
            }
            std::collections::hash_map::Entry::Vacant(e) => {
                e.insert(coin);
            }
        }
    }
    let mut result: Vec<CoinProfitData> = merged.into_values().collect();
    result.sort_by(|a, b| {
        b.profit_score
            .partial_cmp(&a.profit_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    result
}

// ═══════════════════════════════════════════════════════════════
// Outlier Protection — rolling-median clamp
// ═══════════════════════════════════════════════════════════════

/// Clamp outlier profit scores using a rolling median across recent rounds.
///
/// Any coin whose `profit_score` exceeds `median * OUTLIER_MAX_RATIO` is
/// clamped down to that ceiling.  This prevents a single bad data point
/// (WhatToMine glitch, tiny-hashrate coin with inflated mBTC) from causing
/// an immediate algo switch.
///
/// Returns the number of coins clamped.
fn apply_outlier_clamp(data: &mut Vec<CoinProfitData>, history: &VecDeque<Vec<(String, f64)>>) -> usize {
    if data.is_empty() {
        return 0;
    }

    // Build a flat view of all per-coin scores across all history rounds.
    let all_scores: Vec<f64> = if history.is_empty() {
        data.iter().map(|c| c.profit_score).collect()
    } else {
        history
            .iter()
            .flat_map(|round| round.iter().map(|(_, s)| *s))
            .filter(|s| *s > 0.0)
            .collect()
    };

    if all_scores.is_empty() {
        return 0;
    }

    // Compute median of the historical distribution
    let mut sorted = all_scores.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = if sorted.len() % 2 == 0 {
        (sorted[sorted.len() / 2 - 1] + sorted[sorted.len() / 2]) / 2.0
    } else {
        sorted[sorted.len() / 2]
    };

    let ceiling = median * OUTLIER_MAX_RATIO;
    let mut clamped = 0;

    for coin in data.iter_mut() {
        if coin.profit_score > ceiling && ceiling > 0.0 {
            warn!(
                "💹 Outlier clamp: {} score {:.1} → {:.1} (median={:.1}, ratio={:.1}x)",
                coin.coin,
                coin.profit_score,
                ceiling,
                median,
                coin.profit_score / median
            );
            coin.profit_score = ceiling;
            clamped += 1;
        }
    }

    clamped
}

// ═══════════════════════════════════════════════════════════════
// Profit Switcher
// ═══════════════════════════════════════════════════════════════

/// The main profit switching engine
pub struct ProfitSwitcher {
    config: ProfitSwitchConfig,
    /// Currently active mining coin
    active_coin: RwLock<String>,
    /// Watch channel to notify consumers of coin switches
    coin_tx: watch::Sender<String>,
    coin_rx: watch::Receiver<String>,
    /// Latest profitability data
    profit_data: RwLock<Vec<CoinProfitData>>,
    /// Last-valid snapshot from any successful feed fetch.
    /// Used when all live feeds fail so we don't degrade to static estimates.
    last_valid_snapshot: RwLock<Option<Vec<CoinProfitData>>>,
    /// Rolling history of per-coin scores for outlier detection
    /// Each entry is a round: Vec<(coin, score)>
    rolling_history: RwLock<VecDeque<Vec<(String, f64)>>>,
    /// History of switch events
    switch_history: RwLock<Vec<SwitchEvent>>,
    /// Timestamp of last switch
    last_switch_time: AtomicU64,
    /// Total number of switches
    total_switches: AtomicU64,
    /// Number of successful API fetches
    api_fetches: AtomicU64,
    /// Number of failed API fetches
    api_errors: AtomicU64,
    /// CPU-only mode: no GPU detected → always mine XMR via RandomX
    /// CH3 Architecture: 25% Revenue → MoneroOcean (auto-algo CPU)
    cpu_only_mode: AtomicBool,
}

impl ProfitSwitcher {
    pub fn new(config: ProfitSwitchConfig) -> Arc<Self> {
        let gpu_available = detect_gpu_available();
        let cpu_only = !gpu_available;

        // CH3 Rule: No GPU → force CPU revenue coin (XMR or VRSC)
        // Configure with ZION_CPU_REVENUE_COIN=vrsc to use VerusHash instead of RandomX.
        let cpu_revenue_coin = std::env::var("ZION_CPU_REVENUE_COIN")
            .unwrap_or_else(|_| "XMR".to_string())
            .to_uppercase();
        let initial_coin = if cpu_only {
            info!(
                "💹 CPU-only mode: Revenue 25% locked to {} ({})",
                cpu_revenue_coin,
                if cpu_revenue_coin == "VRSC" {
                    "VerusHash → LuckPool"
                } else {
                    "RandomX → MoneroOcean"
                }
            );
            cpu_revenue_coin.clone()
        } else {
            config.fallback_coin.clone()
        };

        let (coin_tx, coin_rx) = watch::channel(initial_coin.clone());

        Arc::new(Self {
            config,
            active_coin: RwLock::new(initial_coin),
            coin_tx,
            coin_rx,
            profit_data: RwLock::new(Vec::new()),
            last_valid_snapshot: RwLock::new(None),
            rolling_history: RwLock::new(VecDeque::with_capacity(ROLLING_HISTORY_ROUNDS + 1)),
            switch_history: RwLock::new(Vec::new()),
            last_switch_time: AtomicU64::new(0),
            total_switches: AtomicU64::new(0),
            api_fetches: AtomicU64::new(0),
            api_errors: AtomicU64::new(0),
            cpu_only_mode: AtomicBool::new(cpu_only),
        })
    }

    /// Check if running in CPU-only mode (no GPU → XMR locked)
    pub fn is_cpu_only(&self) -> bool {
        self.cpu_only_mode.load(Ordering::Relaxed)
    }

    /// Subscribe to coin switch notifications
    pub fn subscribe(&self) -> watch::Receiver<String> {
        self.coin_rx.clone()
    }

    /// Get the currently active mining coin
    pub async fn active_coin(&self) -> String {
        self.active_coin.read().await.clone()
    }

    /// Get current profitability data
    pub async fn profit_data(&self) -> Vec<CoinProfitData> {
        self.profit_data.read().await.clone()
    }

    /// Get switch history
    pub async fn switch_history(&self) -> Vec<SwitchEvent> {
        self.switch_history.read().await.clone()
    }

    /// Get stats as JSON for API
    pub async fn stats_json(&self) -> serde_json::Value {
        let active = self.active_coin.read().await.clone();
        let profit = self.profit_data.read().await.clone();
        let history = self.switch_history.read().await.clone();
        let has_snapshot = self.last_valid_snapshot.read().await.is_some();
        let rolling_rounds = self.rolling_history.read().await.len();

        // Build profitability table
        let profit_table: Vec<serde_json::Value> = profit
            .iter()
            .map(|p| {
                serde_json::json!({
                    "coin": p.coin,
                    "algorithm": p.algorithm,
                    "profit_score": p.profit_score,
                    "price_usd": p.price_usd,
                    "btc_revenue_24h": p.btc_revenue_24h,
                    "usd_revenue_24h": p.usd_revenue_24h,
                    "is_active": p.coin.eq_ignore_ascii_case(&active),
                })
            })
            .collect();

        // Last 10 switch events
        let recent_switches: Vec<serde_json::Value> = history
            .iter()
            .rev()
            .take(10)
            .map(|s| {
                serde_json::json!({
                    "from": s.from_coin,
                    "to": s.to_coin,
                    "reason": s.reason,
                    "advantage_pct": s.profit_advantage_pct,
                    "timestamp": s.timestamp,
                })
            })
            .collect();

        serde_json::json!({
            "enabled": self.config.enabled,
            "active_coin": active,
            "cpu_only_mode": self.cpu_only_mode.load(Ordering::Relaxed),
            "gpu_detected": !self.cpu_only_mode.load(Ordering::Relaxed),
            "check_interval_secs": self.config.check_interval_secs,
            "switch_threshold_pct": self.config.switch_threshold_pct,
            "min_switch_interval_secs": self.config.min_switch_interval_secs,
            "total_switches": self.total_switches.load(Ordering::Relaxed),
            "api_fetches": self.api_fetches.load(Ordering::Relaxed),
            "api_errors": self.api_errors.load(Ordering::Relaxed),
            "has_snapshot": has_snapshot,
            "rolling_history_rounds": rolling_rounds,
            "outlier_max_ratio": OUTLIER_MAX_RATIO,
            "profitability": profit_table,
            "recent_switches": recent_switches,
        })
    }

    /// Main run loop — periodically check profitability and switch if needed
    pub async fn run(self: Arc<Self>) {
        if !self.config.enabled {
            info!("💹 Profit Switcher DISABLED — mining all enabled coins");
            return;
        }

        // ── CH3 CPU-Only Mode ──
        // No GPU detected → lock Revenue 25% to XMR (RandomX) permanently.
        // This saves server CPU by skipping WhatToMine API polling entirely.
        // The miner uses its native RandomX implementation (via zion_core),
        // pool's RevenueProxy connects to MoneroOcean and forwards XMR jobs.
        if self.cpu_only_mode.load(Ordering::Relaxed) {
            let cpu_coin = std::env::var("ZION_CPU_REVENUE_COIN")
                .unwrap_or_else(|_| "XMR".to_string())
                .to_uppercase();
            let desc = if cpu_coin == "VRSC" {
                "VRSC (VerusHash → LuckPool)"
            } else {
                "XMR (RandomX → MoneroOcean)"
            };
            info!("╔════════════════════════════════════════════════════════╗");
            info!("║  💹 CPU-ONLY MODE — Revenue 25% → {}  ║", desc);
            info!("║  No GPU detected. Profit switching DISABLED.           ║");
            info!("║  Set ZION_CPU_REVENUE_COIN=vrsc|xmr to change.        ║");
            info!("║  Set ZION_HAS_GPU=1 to override to GPU mode.          ║");
            info!("╚════════════════════════════════════════════════════════╝");

            // Force the configured CPU coin and keep it locked
            *self.active_coin.write().await = cpu_coin.clone();
            let _ = self.coin_tx.send(cpu_coin.clone());

            // Stay alive but don't poll WhatToMine — just sleep forever
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
            }
        }

        info!(
            "💹 Profit Switcher started (interval={}s, threshold={}%, cooldown={}s, fallback={})",
            self.config.check_interval_secs,
            self.config.switch_threshold_pct,
            self.config.min_switch_interval_secs,
            self.config.fallback_coin,
        );

        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(
            self.config.check_interval_secs,
        ));

        // First tick is immediate
        interval.tick().await;

        loop {
            // Fetch profitability data
            let coins = if self.config.preferred_coins.is_empty() {
                vec![
                    "KAS".to_string(),
                    "ETC".to_string(),
                    "ALPH".to_string(),
                    "FLUX".to_string(),
                    "RVN".to_string(),
                    "ERG".to_string(),
                    "DCR".to_string(),
                    "EPIC".to_string(),
                    "CFX".to_string(),
                    "ZANO".to_string(),
                    "CLORE".to_string(),
                    "NEXA".to_string(),
                    "XMR".to_string(),
                ]
            } else {
                self.config.preferred_coins.clone()
            };

            // ── Feed chain: WTM + ZPool parallel → Minerstat → Snapshot → Static ───
            // Tier 1a: WhatToMine (primární — coin-level data)
            // Tier 1b: ZPool.ca   (algo-level, nezávislý, parallel) → sloučeno s WTM
            // Tier 2:  Minerstat  (sekundární — nezávislý zdroj, bez API klíče)
            // Tier 3:  LastValidSnapshot (poslední dobrá data)
            // Tier 4:  Static estimates  (hardcoded konzervativní hodnoty)
            let (wtm_result, zpool_result) = tokio::join!(
                fetch_whattomine(&coins),
                fetch_zpool(&coins),
            );

            let wtm_ok   = matches!(&wtm_result,   Ok(d) if !d.is_empty());
            let zpool_ok = matches!(&zpool_result, Ok(d) if !d.is_empty());

            let (mut profit_data, feed_name): (Vec<CoinProfitData>, &str) = if wtm_ok || zpool_ok {
                self.api_fetches.fetch_add(1, Ordering::Relaxed);
                match (wtm_result, zpool_result) {
                    (Ok(wtm), Ok(zp)) if !wtm.is_empty() && !zp.is_empty() => {
                        info!(
                            "💹 [WTM+ZPool] WhatToMine={} ZPool={} coins — merging feeds",
                            wtm.len(), zp.len()
                        );
                        (merge_profit_feeds(wtm, zp), "wtm+zpool")
                    }
                    (Ok(wtm), zp_r) if !wtm.is_empty() => {
                        if let Err(e) = zp_r { warn!("💹 ZPool error: {}", e); }
                        info!(
                            "💹 [WhatToMine] {} coins, top={} (score={:.1})",
                            wtm.len(), wtm[0].coin, wtm[0].profit_score
                        );
                        (wtm, "whattomine")
                    }
                    (wtm_r, Ok(zp)) if !zp.is_empty() => {
                        if let Err(e) = wtm_r { warn!("💹 WhatToMine error: {}", e); }
                        info!(
                            "💹 [ZPool] {} coins, top={} (score={:.1})",
                            zp.len(), zp[0].coin, zp[0].profit_score
                        );
                        (zp, "zpool")
                    }
                    _ => unreachable!("wtm_ok || zpool_ok garantuje aspoň jeden Ok"),
                }
            } else {
                // Oba primární feedy selhaly → Tier 2: Minerstat
                let wtm_msg   = match &wtm_result   { Err(e) => e.clone(), Ok(_) => "empty".to_string() };
                let zpool_msg = match &zpool_result { Err(e) => e.clone(), Ok(_) => "empty".to_string() };
                warn!("💹 WhatToMine: {} / ZPool: {} — trying Minerstat", wtm_msg, zpool_msg);
                self.api_errors.fetch_add(1, Ordering::Relaxed);

                match fetch_minerstat(&coins).await {
                    Ok(data) if !data.is_empty() => {
                        info!(
                            "💹 [Minerstat] {} coins, top={} (score={:.1})",
                            data.len(), data[0].coin, data[0].profit_score,
                        );
                        (data, "minerstat")
                    }
                    ms_err => {
                        if let Err(ref e) = ms_err {
                            warn!("💹 Minerstat error: {} — checking last-valid snapshot", e);
                        } else {
                            warn!("💹 Minerstat returned no coins — checking last-valid snapshot");
                        }

                        // Tier 3: LastValidSnapshot
                        let snapshot = self.last_valid_snapshot.read().await.clone();
                        if let Some(snap) = snapshot {
                            warn!(
                                "💹 [Snapshot] Using cached data ({} coins) — live feeds down",
                                snap.len()
                            );
                            (snap, "snapshot")
                        } else {
                            // Tier 4: Static estimates
                            error!("💹 [StaticFallback] All feeds failed and no snapshot — using hardcoded estimates");
                            (estimate_profitability_fallback(&coins), "static")
                        }
                    }
                }
            };

            // ── Outlier protection: rolling-median clamp ─────────────────
            let history = self.rolling_history.read().await;
            let clamped = apply_outlier_clamp(&mut profit_data, &history);
            drop(history);
            if clamped > 0 {
                info!("💹 Outlier clamp applied to {} coin(s) from {} feed", clamped, feed_name);
            }

            // Update rolling history (keep ROLLING_HISTORY_ROUNDS rounds)
            {
                let round: Vec<(String, f64)> = profit_data
                    .iter()
                    .map(|c| (c.coin.clone(), c.profit_score))
                    .collect();
                let mut hist = self.rolling_history.write().await;
                hist.push_back(round);
                while hist.len() > ROLLING_HISTORY_ROUNDS {
                    hist.pop_front();
                }
            }

            // Update last-valid snapshot when data comes from a live feed
            if feed_name != "static" && feed_name != "snapshot" {
                *self.last_valid_snapshot.write().await = Some(profit_data.clone());
            }

            // Re-sort after outlier clamp (scores may have changed)
            profit_data.sort_by(|a, b| {
                b.profit_score
                    .partial_cmp(&a.profit_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            // Store latest data
            *self.profit_data.write().await = profit_data.clone();

            // Evaluate switch
            self.evaluate_switch(&profit_data, feed_name).await;

            // Wait for next interval
            interval.tick().await;
        }
    }

    /// Evaluate whether to switch coins based on profitability data.
    /// Every decision (switch, hold, or block) is emitted as a structured AUDIT log line.
    async fn evaluate_switch(&self, profit_data: &[CoinProfitData], feed: &str) {
        if profit_data.is_empty() {
            return;
        }

        let current_coin = self.active_coin.read().await.clone();

        // Find the most profitable coin (excluding excluded list)
        let best = profit_data
            .iter()
            .filter(|p| {
                !self
                    .config
                    .excluded_coins
                    .iter()
                    .any(|e| e.eq_ignore_ascii_case(&p.coin))
            })
            .max_by(|a, b| {
                a.profit_score
                    .partial_cmp(&b.profit_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

        let best = match best {
            Some(b) => b,
            None => return,
        };

        // Find current coin's profitability
        let current_profit = profit_data
            .iter()
            .find(|p| p.coin.eq_ignore_ascii_case(&current_coin))
            .map(|p| p.profit_score)
            .unwrap_or(0.0);

        // Calculate advantage percentage
        let advantage_pct = if current_profit > 0.0 {
            ((best.profit_score - current_profit) / current_profit) * 100.0
        } else {
            100.0 // If current has 0 profit, any positive coin is infinitely better
        };

        // Already mining the best coin?
        if best.coin.eq_ignore_ascii_case(&current_coin) {
            info!(
                "AUDIT profit_switch decision=hold coin={} score={:.1} feed={} reason=already_optimal",
                current_coin, current_profit, feed
            );
            debug!(
                "💹 Already mining best coin: {} (score={:.1})",
                current_coin, current_profit
            );
            return;
        }

        // Check threshold (stability > profitability spike)
        if advantage_pct < self.config.switch_threshold_pct {
            info!(
                "AUDIT profit_switch decision=hold coin={} best={} advantage_pct={:.1} threshold={:.1} feed={} reason=below_threshold",
                current_coin, best.coin, advantage_pct, self.config.switch_threshold_pct, feed
            );
            debug!(
                "💹 {} is better ({:.1} vs {:.1}, +{:.1}%) but below threshold ({}%)",
                best.coin,
                best.profit_score,
                current_profit,
                advantage_pct,
                self.config.switch_threshold_pct
            );
            return;
        }

        // Check cooldown
        let now = Utc::now().timestamp() as u64;
        let last_switch = self.last_switch_time.load(Ordering::Relaxed);
        if last_switch > 0 && (now - last_switch) < self.config.min_switch_interval_secs {
            let remaining = self.config.min_switch_interval_secs - (now - last_switch);
            info!(
                "AUDIT profit_switch decision=hold coin={} best={} advantage_pct={:.1} cooldown_remaining_secs={} feed={} reason=cooldown",
                current_coin, best.coin, advantage_pct, remaining, feed
            );
            info!(
                "💹 Want to switch {} → {} (+{:.1}%) but cooldown active ({}s remaining)",
                current_coin, best.coin, advantage_pct, remaining
            );
            return;
        }

        // === SWITCH! ===
        info!(
            "AUDIT profit_switch decision=switch from={} to={} advantage_pct={:.1} score_new={:.1} score_old={:.1} feed={} reason=profitability",
            current_coin, best.coin, advantage_pct, best.profit_score, current_profit, feed
        );
        info!(
            "🔄 PROFIT SWITCH: {} → {} (advantage: +{:.1}%, score: {:.1} vs {:.1}) [feed={}]",
            current_coin, best.coin, advantage_pct, best.profit_score, current_profit, feed
        );

        // Update active coin
        *self.active_coin.write().await = best.coin.clone();
        let _ = self.coin_tx.send(best.coin.clone());
        self.last_switch_time.store(now, Ordering::Relaxed);
        self.total_switches.fetch_add(1, Ordering::Relaxed);

        // Record event
        let event = SwitchEvent {
            from_coin: current_coin,
            to_coin: best.coin.clone(),
            reason: format!(
                "Profitability advantage: +{:.1}% (score {:.1} vs {:.1}) via {}",
                advantage_pct, best.profit_score, current_profit, feed
            ),
            profit_advantage_pct: advantage_pct,
            timestamp: now as i64,
        };

        self.switch_history.write().await.push(event);

        // Keep only last 100 events
        let mut history = self.switch_history.write().await;
        if history.len() > 100 {
            let drain_count = history.len() - 100;
            history.drain(..drain_count);
        }
    }

    /// Force switch to a specific coin (manual override via API)
    pub async fn force_switch(&self, coin: &str) -> Result<(), String> {
        let current = self.active_coin.read().await.clone();

        if current.eq_ignore_ascii_case(coin) {
            return Err(format!("Already mining {}", coin));
        }

        info!("🔄 MANUAL SWITCH: {} → {} (forced by API)", current, coin);

        let now = Utc::now().timestamp() as u64;
        *self.active_coin.write().await = coin.to_uppercase();
        let _ = self.coin_tx.send(coin.to_uppercase());
        self.last_switch_time.store(now, Ordering::Relaxed);
        self.total_switches.fetch_add(1, Ordering::Relaxed);

        let event = SwitchEvent {
            from_coin: current,
            to_coin: coin.to_uppercase(),
            reason: "Manual switch via API".to_string(),
            profit_advantage_pct: 0.0,
            timestamp: now as i64,
        };
        self.switch_history.write().await.push(event);

        Ok(())
    }
}
