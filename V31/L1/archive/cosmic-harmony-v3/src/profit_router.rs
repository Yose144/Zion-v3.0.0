//! Profit router — external coin definitions and Blake3-compatible revenue targets
//!
//! ZION's CosmicHarmony pipeline (Keccak→SHA3→Matrix→Fusion) produces ZION blocks.
//! The revenue system also supports mining external coins that share compatible
//! algorithms. Decred (DCR) uses standard Blake3 (DCP-0011, since Oct 2022),
//! and Alephium (ALPH) also uses Blake3.
//!
//! This module defines:
//! - `CoinProfile` — per-coin metadata (algorithm, default pool, protocol)
//! - `ProfitEntry` — snapshot of per-coin estimated profitability
//! - `select_best_coin` — pick the most profitable coin from a list, with hysteresis

use serde::{Deserialize, Serialize};
use zion_cosmic_harmony::{ExternalCoin, PoolPreference};

// In public_build, suppress all profit_router log output (hides external
// coin names like KAS, VRSC, RVN, etc.).  V3 never enables this feature.
#[cfg(feature = "public_build")]
macro_rules! plog {
    () => {};
    ($($arg:tt)*) => {};
}
#[cfg(not(feature = "public_build"))]
macro_rules! plog {
    ($($arg:tt)*) => { eprintln!($($arg)*) };
}

// ── Stratum protocol variant ─────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StratumProtocol {
    /// Standard Stratum v1 (mining.subscribe / mining.authorize / mining.submit)
    Stratum,
    /// EthStratum / ETH-proxy variant (eth_submitWork, eth_getWork)
    EthStratum,
    /// Zcash/Equihash-style Stratum — used by VRSC/VerusHash pools (LuckPool).
    /// Uses mining.subscribe/authorize/notify/set_target and 5-param submit.
    ZcashStratum,
    /// Pearl (PRL) custom Stratum dialect — object params (not arrays),
    /// no mining.subscribe, plain_proof base64 submit. Used by AlphaPool/suprnova.
    PearlStratum,
    /// Epic Cash — custom JSON-RPC 2.0 over TLS used by epicmine.io.
    EpicStratum,
    /// Beam — BeamStratum (JSON-RPC 2.0 over TLS) used by beam.2miners.com.
    BeamStratum,
}

impl StratumProtocol {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stratum => "stratum",
            Self::EthStratum => "ethstratum",
            Self::ZcashStratum => "zcashstratum",
            Self::PearlStratum => "pearlstratum",
            Self::EpicStratum => "epicstratum",
            Self::BeamStratum => "beamstratum",
        }
    }
}

pub fn coin_to_protocol(coin: ExternalCoin) -> StratumProtocol {
    match coin {
        ExternalCoin::Ravencoin
        | ExternalCoin::EthereumClassic
        | ExternalCoin::Evrmore
        | ExternalCoin::Meowcoin
        | ExternalCoin::Clore
        | ExternalCoin::Quai => StratumProtocol::EthStratum,
        ExternalCoin::Verus | ExternalCoin::Zclassic | ExternalCoin::Zcash => {
            StratumProtocol::ZcashStratum
        }
        ExternalCoin::Pearl => StratumProtocol::PearlStratum,
        ExternalCoin::EpicCash => StratumProtocol::EpicStratum,
        ExternalCoin::Beam => StratumProtocol::BeamStratum,
        _ => StratumProtocol::Stratum,
    }
}

// ── Coin profile (full metadata snapshot) ────────────────────────────

/// Complete profile for an external coin — enough to connect and mine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinProfile {
    pub coin: ExternalCoin,
    pub ticker: String,
    pub algorithm: String,
    pub pool_host: String,
    pub pool_port: u16,
    pub protocol: StratumProtocol,
    pub worker_name: String,
    pub enabled: bool,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disabled_reason: Option<String>,
}

impl CoinProfile {
    /// Build a default profile for a coin, splitting `default_pool()` into host:port.
    pub fn default_for(coin: ExternalCoin) -> Self {
        let (host, port) = split_host_port(coin.default_pool());
        Self {
            coin,
            ticker: coin.ticker().to_string(),
            algorithm: coin.algorithm().to_string(),
            pool_host: host,
            pool_port: port,
            protocol: coin_to_protocol(coin),
            worker_name: "zion_dynamic".to_string(),
            enabled: true,
            disabled: false,
            disabled_reason: None,
        }
    }

    /// Build profile with pool preference + region fallback chain.
    pub fn for_preference(coin: ExternalCoin, preference: PoolPreference, region: &str) -> Self {
        let pool = coin.best_pool(preference, region);
        let (host, port) = split_host_port(&pool);
        Self {
            coin,
            ticker: coin.ticker().to_string(),
            algorithm: coin.algorithm().to_string(),
            pool_host: host,
            pool_port: port,
            protocol: coin_to_protocol(coin),
            worker_name: "zion_dynamic".to_string(),
            enabled: true,
            disabled: false,
            disabled_reason: None,
        }
    }

    /// Stratum address as "host:port" string.
    pub fn pool_address(&self) -> String {
        format!("{}:{}", self.pool_host, self.pool_port)
    }

    /// Mark this profile as disabled with a reason.
    pub fn disabled(mut self, reason: &str) -> Self {
        self.disabled = true;
        self.disabled_reason = Some(reason.to_string());
        self.enabled = false;
        self
    }
}

// ── Profitability snapshot ───────────────────────────────────────────

/// A single profitability estimate for a coin (e.g. from WhatToMine or fallback).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfitEntry {
    pub coin: ExternalCoin,
    pub revenue_per_day_usd: f64,
    pub power_cost_usd: f64,
}

impl ProfitEntry {
    pub fn profit_per_day_usd(&self) -> f64 {
        self.revenue_per_day_usd - self.power_cost_usd
    }
}

/// Static fallback profitability estimates when WhatToMine is unavailable.
/// Values are approximate daily USD revenue per 100 MH/s reference hashrate.
pub fn fallback_estimates() -> Vec<ProfitEntry> {
    vec![
        ProfitEntry {
            coin: ExternalCoin::Kaspa,
            revenue_per_day_usd: 0.85,
            power_cost_usd: 0.10,
        },
        ProfitEntry {
            coin: ExternalCoin::EthereumClassic,
            revenue_per_day_usd: 0.60,
            power_cost_usd: 0.12,
        },
        ProfitEntry {
            coin: ExternalCoin::Alephium,
            revenue_per_day_usd: 0.55,
            power_cost_usd: 0.08,
        },
        ProfitEntry {
            coin: ExternalCoin::Flux,
            revenue_per_day_usd: 0.50,
            power_cost_usd: 0.10,
        },
        ProfitEntry {
            coin: ExternalCoin::Decred,
            revenue_per_day_usd: 0.45,
            power_cost_usd: 0.08,
        },
        ProfitEntry {
            coin: ExternalCoin::Ergo,
            revenue_per_day_usd: 0.40,
            power_cost_usd: 0.10,
        },
        ProfitEntry {
            coin: ExternalCoin::Ravencoin,
            revenue_per_day_usd: 0.35,
            power_cost_usd: 0.12,
        },
        ProfitEntry {
            coin: ExternalCoin::Clore,
            revenue_per_day_usd: 0.30,
            power_cost_usd: 0.10,
        },
        ProfitEntry {
            coin: ExternalCoin::Evrmore,
            revenue_per_day_usd: 0.20,
            power_cost_usd: 0.08,
        },
        ProfitEntry {
            coin: ExternalCoin::Meowcoin,
            revenue_per_day_usd: 0.15,
            power_cost_usd: 0.06,
        },
        ProfitEntry {
            coin: ExternalCoin::Monero,
            revenue_per_day_usd: 0.12,
            power_cost_usd: 0.03,
        },
        ProfitEntry {
            coin: ExternalCoin::Verus,
            revenue_per_day_usd: 0.08,
            power_cost_usd: 0.01,
        },
        ProfitEntry {
            coin: ExternalCoin::Zano,
            revenue_per_day_usd: 0.28,
            power_cost_usd: 0.12,
        },
        // ── 8 new no-DAG GPU-mineable coins (2026-07-16) ──
        ProfitEntry {
            coin: ExternalCoin::Karlsen,
            revenue_per_day_usd: 0.21,
            power_cost_usd: 0.22,
        },
        ProfitEntry {
            coin: ExternalCoin::Zclassic,
            revenue_per_day_usd: 0.15,
            power_cost_usd: 0.18,
        },
        ProfitEntry {
            coin: ExternalCoin::Qubitcoin,
            revenue_per_day_usd: 0.10,
            power_cost_usd: 0.15,
        },
        ProfitEntry {
            coin: ExternalCoin::Vertcoin,
            revenue_per_day_usd: 0.12,
            power_cost_usd: 0.18,
        },
        ProfitEntry {
            coin: ExternalCoin::IronFish,
            revenue_per_day_usd: 0.18,
            power_cost_usd: 0.22,
        },
        ProfitEntry {
            coin: ExternalCoin::Nexa,
            revenue_per_day_usd: 0.08,
            power_cost_usd: 0.20,
        },
        ProfitEntry {
            coin: ExternalCoin::Raptoreum,
            revenue_per_day_usd: 0.06,
            power_cost_usd: 0.20,
        },
        ProfitEntry {
            coin: ExternalCoin::Dynex,
            revenue_per_day_usd: 0.02,
            power_cost_usd: 0.22,
        },
        ProfitEntry {
            coin: ExternalCoin::Nervos,
            revenue_per_day_usd: 0.08,
            power_cost_usd: 0.25,
        },
        ProfitEntry {
            coin: ExternalCoin::Conflux,
            revenue_per_day_usd: 0.15,
            power_cost_usd: 0.31,
        },
        ProfitEntry {
            coin: ExternalCoin::Zcash,
            revenue_per_day_usd: 0.10,
            power_cost_usd: 0.25,
        },
        ProfitEntry {
            coin: ExternalCoin::PhoenixCoin,
            revenue_per_day_usd: 0.03,
            power_cost_usd: 0.27,
        },
        ProfitEntry {
            coin: ExternalCoin::Keryx,
            revenue_per_day_usd: 0.03,
            power_cost_usd: 0.27,
        },
    ]
}

// ── NiceHash profitability ───────────────────────────────────────────

/// Fetch current BTC price in USD from CoinGecko.
fn fetch_btc_price_usd() -> Option<f64> {
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
    let body = fetch_url_blocking_internal(url, 10).ok()?;
    let json: serde_json::Value = serde_json::from_str(&body).ok()?;
    json.get("bitcoin")
        .and_then(|b| b.get("usd"))
        .and_then(|u| u.as_f64())
}

/// Map a NiceHash algorithm name (uppercase, from API) to our `ExternalCoin`.
fn nicehash_algo_to_external_coin(algo: &str) -> Option<ExternalCoin> {
    match algo.to_uppercase().as_str() {
        "KHEAVYHASH" => Some(ExternalCoin::Kaspa),
        "KAWPOW" => Some(ExternalCoin::Ravencoin), // RVN/QUAI/CLORE share kawpow
        "ETCHASH" => Some(ExternalCoin::EthereumClassic),
        "AUTOLYKOS" => Some(ExternalCoin::Ergo),
        "VERUSHASH" => Some(ExternalCoin::Verus),
        "RANDOMXMONERO" => Some(ExternalCoin::Monero),
        "NEXAPOW" => Some(ExternalCoin::Nexa),
        "BEAMV3" => Some(ExternalCoin::Beam),
        "FISHHASH" => Some(ExternalCoin::IronFish),
        "ALEPHIUM" => Some(ExternalCoin::Alephium),
        "EAGLESONG" => Some(ExternalCoin::Nervos),
        "OCTOPUS" => Some(ExternalCoin::Conflux),
        "EQUIHASH" => Some(ExternalCoin::Zcash),
        "NEOSCRYPT" => Some(ExternalCoin::PhoenixCoin),
        "KERYXHASH" => Some(ExternalCoin::Keryx),
        // ZHASH (Equihash 144,5) is NOT FLUX (ZelHash = Equihash 125,4).
        // NiceHash ZHash is for BTG/ANON/BTCZ — we don't mine those.
        // FLUX must use alternative pools (WoolyPooly, etc.).
        // EQUIHASH192 not directly listed; ZCL uses equihash192
        _ => None,
    }
}

/// Fetch NiceHash `paying` rates from `simplemultialgo/info` API.
///
/// Returns a map of ExternalCoin → paying rate (BTC per unit hashrate per day).
/// The units vary per algorithm (per the `displayMiningFactor` field from
/// `/mining/algorithms`), so these values are **not directly comparable**
/// across algorithms. They are useful for:
/// - Monitoring NiceHash market rates over time
/// - Detecting sudden spikes in demand for a specific algorithm
/// - Relative comparison within the same algorithm
///
/// On any error returns an empty map.
fn fetch_nicehash_paying_rates() -> Vec<(ExternalCoin, f64)> {
    let url = "https://api2.nicehash.com/main/api/v2/public/simplemultialgo/info";
    let body = match fetch_url_blocking_internal(url, 10) {
        Ok(b) => b,
        Err(e) => {
            plog!("profit_router: nicehash fetch error: {e}");
            return Vec::new();
        }
    };

    let json: serde_json::Value = match serde_json::from_str(&body) {
        Ok(j) => j,
        Err(e) => {
            plog!("profit_router: nicehash parse error: {e}");
            return Vec::new();
        }
    };

    let mut rates = Vec::new();

    if let Some(algos) = json.get("miningAlgorithms").and_then(|a| a.as_array()) {
        for algo_entry in algos {
            let algo_name = algo_entry
                .get("algorithm")
                .and_then(|a| a.as_str())
                .unwrap_or("");
            let paying = algo_entry
                .get("paying")
                .and_then(|p| p.as_f64())
                .unwrap_or(0.0);

            if let Some(coin) = nicehash_algo_to_external_coin(algo_name) {
                rates.push((coin, paying));
            }
        }
    }

    plog!(
        "profit_router: nicehash paying rates fetched for {} algorithms",
        rates.len()
    );
    rates
}

// ── Live profit fetching ─────────────────────────────────────────────

/// Fetch live profitability estimates from WhatToMine API.
///
/// WhatToMine provides `https://whattomine.com/coins.json` with per-coin
/// revenue estimates in USD per GH/s-day.  We map the coin tags to our
/// `ExternalCoin` enum and return `Vec<ProfitEntry>`.
///
/// Also fetches NiceHash paying rates for monitoring/logging purposes.
/// The NiceHash rates are not merged into the profit estimates because
/// the units vary per algorithm and are not directly comparable.
///
/// On any error (network, parse, empty), falls back to `fallback_estimates()`.
pub fn fetch_live_profit_estimates() -> Vec<ProfitEntry> {
    let (entries, _) = fetch_live_profit_estimates_with_nicehash();
    entries
}

/// Fetch live profit estimates + NiceHash paying rates.
/// Returns (estimates, nicehash_rates) so callers can expose both.
pub fn fetch_live_profit_estimates_with_nicehash() -> (Vec<ProfitEntry>, Vec<(ExternalCoin, f64)>) {
    // Fetch NiceHash paying rates for monitoring.
    let nh_rates = fetch_nicehash_paying_rates();
    for (coin, paying) in &nh_rates {
        plog!("profit_router: nicehash {} paying={:.15}", coin, paying);
    }

    // Fetch WhatToMine estimates (USD/day per coin) — primary source.
    let url = "https://whattomine.com/coins.json";
    let entries = match fetch_url_blocking_internal(url, 10) {
        Ok(body) => {
            plog!("profit_router: whattomine fetched {} bytes", body.len());
            let entries = parse_whattomine_for_external_coins(&body);
            plog!("profit_router: whattomine parsed {} entries", entries.len());
            entries
        }
        Err(e) => {
            plog!("profit_router: whattomine fetch error: {e}");
            fallback_estimates()
        }
    };
    (entries, nh_rates)
}

/// Parse WhatToMine coins.json response into `Vec<ProfitEntry>`.
///
/// WhatToMine returns: `{ "coins": { "1": { "tag": "RVN", "btc_revenue": "0.00000689", ... } } }`
/// The `btc_revenue` field is BTC/day at the reference hashrate for that coin.
/// We convert to USD/day using the current BTC price from CoinGecko.
fn parse_whattomine_for_external_coins(body: &str) -> Vec<ProfitEntry> {
    let parsed: Option<serde_json::Value> = serde_json::from_str(body).ok();
    let Some(json) = parsed else {
        plog!("profit_router: whattomine parse error");
        return fallback_estimates();
    };

    let mut entries = Vec::new();
    let fallback = fallback_estimates();

    // Fetch BTC price for converting btc_revenue → USD.
    let btc_price = fetch_btc_price_usd().unwrap_or(0.0);
    plog!("profit_router: btc_price=${}", btc_price);

    if let Some(coins) = json.get("coins").and_then(|c| c.as_object()) {
        for (_id, coin_data) in coins {
            let tag = coin_data.get("tag").and_then(|t| t.as_str()).unwrap_or("");

            // WhatToMine now provides `btc_revenue` (BTC/day per reference hashrate).
            // Older API had `revenue` (USD/day). Try both for backwards compat.
            let btc_rev = coin_data
                .get("btc_revenue")
                .and_then(|r| r.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            let usd_rev = coin_data
                .get("revenue")
                .and_then(|r| r.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);

            // Prefer USD revenue if present (older API), otherwise convert BTC.
            let revenue_usd = if usd_rev > 0.0 {
                usd_rev
            } else if btc_rev > 0.0 && btc_price > 0.0 {
                btc_rev * btc_price
            } else {
                0.0
            };

            // Map WhatToMine coin tags to our ExternalCoin enum.
            if let Some(coin) = tag_to_external_coin(tag) {
                // Use the fallback power cost for this coin.
                let power_cost = fallback
                    .iter()
                    .find(|e| e.coin == coin)
                    .map(|e| e.power_cost_usd)
                    .unwrap_or(0.10);
                plog!(
                    "profit_router: whattomine {} revenue=${:.4}/day",
                    tag,
                    revenue_usd
                );
                entries.push(ProfitEntry {
                    coin,
                    revenue_per_day_usd: revenue_usd.max(0.01),
                    power_cost_usd: power_cost,
                });
            }
        }
    } else {
        plog!("profit_router: whattomine 'coins' key not found or not object");
    }

    // If we got fewer entries than fallback, merge in any missing coins.
    for fb in &fallback {
        if !entries.iter().any(|e| e.coin == fb.coin) {
            entries.push(fb.clone());
        }
    }

    if entries.is_empty() {
        fallback_estimates()
    } else {
        entries
    }
}

/// Map a WhatToMine coin tag to our `ExternalCoin` enum.
fn tag_to_external_coin(tag: &str) -> Option<ExternalCoin> {
    match tag.to_uppercase().as_str() {
        "DCR" => Some(ExternalCoin::Decred),
        "ALPH" => Some(ExternalCoin::Alephium),
        "KAS" => Some(ExternalCoin::Kaspa),
        "ERG" => Some(ExternalCoin::Ergo),
        "RVN" => Some(ExternalCoin::Ravencoin),
        "ETC" => Some(ExternalCoin::EthereumClassic),
        "XMR" => Some(ExternalCoin::Monero),
        "FLUX" => Some(ExternalCoin::Flux),
        "CLORE" => Some(ExternalCoin::Clore),
        _ => None, // EVR, MEWC not on WhatToMine
    }
}

/// Fetch a URL with a timeout using a blocking reqwest client.
fn fetch_url_blocking_internal(url: &str, timeout_secs: u64) -> Result<String, String> {
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

// ── Coin selection ───────────────────────────────────────────────────

/// Pick the most profitable coin from `entries`, applying hysteresis:
/// only switch away from `current` if another coin beats it by ≥ `hysteresis_pct`%.
/// Coins listed in `disabled` are filtered out before picking.
///
/// Returns `None` if `entries` is empty or all active entries are unprofitable.
pub fn select_best_coin(
    entries: &[ProfitEntry],
    current: Option<ExternalCoin>,
    hysteresis_pct: f64,
    disabled: &[ExternalCoin],
) -> Option<ExternalCoin> {
    let mut best: Option<&ProfitEntry> = None;
    for entry in entries {
        if disabled.contains(&entry.coin) || entry.profit_per_day_usd() <= 0.0 {
            continue;
        }
        if best.is_none_or(|b| entry.profit_per_day_usd() > b.profit_per_day_usd()) {
            best = Some(entry);
        }
    }

    let best = best?;

    // Apply hysteresis: only switch if the new coin is `hysteresis_pct`% better
    if let Some(cur) = current {
        if cur == best.coin {
            return Some(cur);
        }
        let cur_profit = entries
            .iter()
            .find(|e| e.coin == cur && !disabled.contains(&e.coin))
            .map(|e| e.profit_per_day_usd())
            .unwrap_or(0.0);

        if cur_profit > 0.0 {
            let improvement_pct = (best.profit_per_day_usd() - cur_profit) / cur_profit * 100.0;
            if improvement_pct < hysteresis_pct {
                return Some(cur);
            }
        }
    }

    Some(best.coin)
}

fn coin_disabled(coin: ExternalCoin, profiles: &[CoinProfile]) -> bool {
    profiles.iter().any(|p| p.coin == coin && p.disabled)
}

/// Return the most profitable active GPU coin from `entries`.
pub fn best_coin_for_gpu(
    entries: &[ProfitEntry],
    profiles: &[CoinProfile],
) -> Option<ExternalCoin> {
    let active: Vec<_> = entries
        .iter()
        .filter(|e| e.coin.is_gpu() && !coin_disabled(e.coin, profiles))
        .cloned()
        .collect();
    select_best_coin(&active, None, 0.0, &[])
}

/// Return the most profitable active CPU coin from `entries`.
pub fn best_coin_for_cpu(
    entries: &[ProfitEntry],
    profiles: &[CoinProfile],
) -> Option<ExternalCoin> {
    let active: Vec<_> = entries
        .iter()
        .filter(|e| e.coin.is_cpu() && !coin_disabled(e.coin, profiles))
        .cloned()
        .collect();
    select_best_coin(&active, None, 0.0, &[])
}

// ── Helpers ──────────────────────────────────────────────────────────

fn split_host_port(addr: &str) -> (String, u16) {
    if let Some(pos) = addr.rfind(':') {
        let host = addr[..pos].to_string();
        let port = addr[pos + 1..].parse::<u16>().unwrap_or(3333);
        (host, port)
    } else {
        (addr.to_string(), 3333)
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dcr_uses_blake3() {
        assert_eq!(ExternalCoin::Decred.algorithm(), "blake3_dcr");
        assert!(ExternalCoin::Decred.is_blake3());
        assert_eq!(
            ExternalCoin::Decred.default_pool(),
            "pool.woolypooly.com:3152"
        );
    }

    #[test]
    fn alph_uses_blake3() {
        assert_eq!(ExternalCoin::Alephium.algorithm(), "blake3_alph");
        assert!(ExternalCoin::Alephium.is_blake3());
    }

    #[test]
    fn blake3_coins_returns_dcr_and_alph() {
        let blake3 = ExternalCoin::blake3_coins();
        assert_eq!(blake3.len(), 2);
        assert!(blake3.contains(&ExternalCoin::Decred));
        assert!(blake3.contains(&ExternalCoin::Alephium));
    }

    #[test]
    fn from_str_loose_parses_dcr_aliases() {
        assert_eq!(
            ExternalCoin::from_str_loose("dcr"),
            Some(ExternalCoin::Decred)
        );
        assert_eq!(
            ExternalCoin::from_str_loose("Decred"),
            Some(ExternalCoin::Decred)
        );
        assert_eq!(
            ExternalCoin::from_str_loose("BLAKE3-DCR"),
            Some(ExternalCoin::Decred)
        );
        assert_eq!(
            ExternalCoin::from_str_loose("blake3dcr"),
            Some(ExternalCoin::Decred)
        );
    }

    #[test]
    fn from_str_loose_parses_others() {
        assert_eq!(
            ExternalCoin::from_str_loose("alph"),
            Some(ExternalCoin::Alephium)
        );
        assert_eq!(
            ExternalCoin::from_str_loose("KAS"),
            Some(ExternalCoin::Kaspa)
        );
        assert_eq!(
            ExternalCoin::from_str_loose("xmr"),
            Some(ExternalCoin::Monero)
        );
        assert_eq!(ExternalCoin::from_str_loose("unknown"), None);
    }

    #[test]
    fn coin_profile_default_for_dcr() {
        let profile = CoinProfile::default_for(ExternalCoin::Decred);
        assert_eq!(profile.ticker, "DCR");
        assert_eq!(profile.algorithm, "blake3_dcr");
        assert_eq!(profile.pool_host, "pool.woolypooly.com");
        assert_eq!(profile.pool_port, 3152);
        assert_eq!(profile.protocol, StratumProtocol::Stratum);
        assert!(profile.enabled);
        assert!(!profile.disabled);
        assert!(profile.disabled_reason.is_none());
    }

    #[test]
    fn select_best_coin_picks_highest_profit() {
        let entries = vec![
            ProfitEntry {
                coin: ExternalCoin::Decred,
                revenue_per_day_usd: 0.45,
                power_cost_usd: 0.08,
            },
            ProfitEntry {
                coin: ExternalCoin::Kaspa,
                revenue_per_day_usd: 0.85,
                power_cost_usd: 0.10,
            },
            ProfitEntry {
                coin: ExternalCoin::Alephium,
                revenue_per_day_usd: 0.55,
                power_cost_usd: 0.08,
            },
        ];
        let best = select_best_coin(&entries, None, 5.0, &[]);
        assert_eq!(best, Some(ExternalCoin::Kaspa));
    }

    #[test]
    fn select_best_coin_hysteresis_keeps_current() {
        let entries = vec![
            ProfitEntry {
                coin: ExternalCoin::Decred,
                revenue_per_day_usd: 0.45,
                power_cost_usd: 0.08,
            },
            ProfitEntry {
                coin: ExternalCoin::Alephium,
                revenue_per_day_usd: 0.49,
                power_cost_usd: 0.08,
            },
        ];
        // ALPH is ~10.8% better, but hysteresis is 15% → stay on DCR
        let best = select_best_coin(&entries, Some(ExternalCoin::Decred), 15.0, &[]);
        assert_eq!(best, Some(ExternalCoin::Decred));
    }

    #[test]
    fn select_best_coin_hysteresis_switches_when_large_gap() {
        let entries = vec![
            ProfitEntry {
                coin: ExternalCoin::Decred,
                revenue_per_day_usd: 0.30,
                power_cost_usd: 0.08,
            },
            ProfitEntry {
                coin: ExternalCoin::Kaspa,
                revenue_per_day_usd: 0.85,
                power_cost_usd: 0.10,
            },
        ];
        // KAS is ~240% better → switch even with 15% hysteresis
        let best = select_best_coin(&entries, Some(ExternalCoin::Decred), 15.0, &[]);
        assert_eq!(best, Some(ExternalCoin::Kaspa));
    }

    #[test]
    fn fallback_estimates_include_dcr() {
        let estimates = fallback_estimates();
        assert!(estimates.iter().any(|e| e.coin == ExternalCoin::Decred));
        let dcr = estimates
            .iter()
            .find(|e| e.coin == ExternalCoin::Decred)
            .unwrap();
        assert!(dcr.revenue_per_day_usd > 0.0);
        assert!(dcr.profit_per_day_usd() > 0.0);
    }

    #[test]
    fn all_coins_have_distinct_pools() {
        let all = ExternalCoin::all();
        let mut pools: Vec<&str> = all.iter().map(|c| c.default_pool()).collect();
        pools.sort();
        pools.dedup();
        assert_eq!(pools.len(), all.len());
    }

    #[test]
    fn display_shows_ticker() {
        assert_eq!(format!("{}", ExternalCoin::Decred), "DCR");
        assert_eq!(format!("{}", ExternalCoin::Alephium), "ALPH");
    }

    #[test]
    fn nicehash_supported_coin_gets_nh_endpoint() {
        let pool = ExternalCoin::Kaspa.best_pool(PoolPreference::NiceHash, "eu");
        assert_eq!(pool, "kheavyhash.auto.nicehash.com:9200");
    }

    #[test]
    fn nicehash_blake3_coin_falls_back() {
        let pool = ExternalCoin::Decred.best_pool(PoolPreference::NiceHash, "eu");
        assert_eq!(pool, "pool.woolypooly.com:3152");
    }

    #[test]
    fn profile_for_preference_uses_selected_pool() {
        let profile =
            CoinProfile::for_preference(ExternalCoin::Kaspa, PoolPreference::NiceHash, "eu");
        assert_eq!(profile.pool_host, "kheavyhash.auto.nicehash.com");
        assert_eq!(profile.pool_port, 9200);
    }

    #[test]
    fn coin_profile_can_be_disabled_with_reason() {
        let profile = CoinProfile::default_for(ExternalCoin::Decred).disabled("no accepted shares");
        assert!(profile.disabled);
        assert_eq!(
            profile.disabled_reason,
            Some("no accepted shares".to_string())
        );
        assert!(!profile.enabled);
    }

    #[test]
    fn best_coin_for_gpu_skips_disabled_high_profit_coin() {
        let mut profiles: Vec<CoinProfile> = ExternalCoin::all()
            .iter()
            .map(|&c| CoinProfile::default_for(c))
            .collect();
        let kas_idx = profiles
            .iter()
            .position(|p| p.coin == ExternalCoin::Kaspa)
            .unwrap();
        profiles[kas_idx] = profiles[kas_idx].clone().disabled("no accepted shares");

        let best = best_coin_for_gpu(&fallback_estimates(), &profiles);
        assert_ne!(best, Some(ExternalCoin::Kaspa));
        assert!(best.is_some_and(|c| c.is_gpu()));
    }

    #[test]
    fn best_coin_for_cpu_skips_disabled() {
        let mut profiles: Vec<CoinProfile> = ExternalCoin::all()
            .iter()
            .map(|&c| CoinProfile::default_for(c))
            .collect();
        let xmr_idx = profiles
            .iter()
            .position(|p| p.coin == ExternalCoin::Monero)
            .unwrap();
        profiles[xmr_idx] = profiles[xmr_idx].clone().disabled("no accepted shares");

        let best = best_coin_for_cpu(&fallback_estimates(), &profiles);
        assert_ne!(best, Some(ExternalCoin::Monero));
        assert!(best.is_some_and(|c| c.is_cpu()));
    }

    #[test]
    fn disabled_high_profit_coin_is_still_skipped() {
        let disabled = vec![ExternalCoin::Kaspa];
        let best = select_best_coin(&fallback_estimates(), None, 5.0, &disabled);
        assert_ne!(best, Some(ExternalCoin::Kaspa));
        assert!(best.is_some());
    }
}
