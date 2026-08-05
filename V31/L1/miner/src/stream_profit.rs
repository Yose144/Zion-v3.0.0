//! Live stream profit oracle with caching, rate limiting, and safe fallback.
//!
//! Fetches WhatToMine and NiceHash revenue estimates for external coins,
//! falls back to `CoinProfile` estimates when the APIs are unavailable or
//! no API keys are configured.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tracing::{debug, warn};
use zion_cosmic_harmony::{CoinProfile, ExternalCoin};

/// Estimated daily revenue for a single external coin.
#[derive(Debug, Clone, Copy)]
pub struct ProfitEstimate {
    pub coin: ExternalCoin,
    pub revenue_usd_per_day: f64,
    pub live: bool,
}

#[derive(Debug)]
struct OracleState {
    last_fetch: Option<Instant>,
    cache: Vec<ProfitEstimate>,
    request_count: u64,
    window_start: Instant,
}

/// Cached, rate-limited live profit oracle.
///
/// Reads API keys from `WHATTOMAINE_API_KEY` and `NICEHASH_API_KEY`.
/// If neither key is set, the oracle returns a fallback table derived from
/// `CoinProfile` without making network requests.
#[derive(Debug)]
pub struct StreamProfitOracle {
    whattomine_key: Option<String>,
    nicehash_key: Option<String>,
    min_fetch_interval: Duration,
    max_requests_per_window: u64,
    window_secs: u64,
    state: Mutex<OracleState>,
}

impl Default for StreamProfitOracle {
    fn default() -> Self {
        Self::new()
    }
}

impl StreamProfitOracle {
    pub fn new() -> Self {
        Self::with_interval(Duration::from_secs(60))
    }

    pub fn with_interval(min_fetch_interval: Duration) -> Self {
        let whattomine_key = std::env::var("WHATTOMAINE_API_KEY")
            .ok()
            .filter(|s| !s.is_empty());
        let nicehash_key = std::env::var("NICEHASH_API_KEY")
            .ok()
            .filter(|s| !s.is_empty());

        Self {
            whattomine_key,
            nicehash_key,
            min_fetch_interval,
            max_requests_per_window: 10,
            window_secs: 60,
            state: Mutex::new(OracleState {
                last_fetch: None,
                cache: Vec::new(),
                request_count: 0,
                window_start: Instant::now(),
            }),
        }
    }

    /// Return revenue estimates for all known external coins.
    ///
    /// Uses a cached snapshot if it is still fresh.  Only performs a live
    /// network fetch when at least one API key is configured and the rate
    /// limiter allows.
    pub fn get_estimates(&self) -> Vec<ProfitEstimate> {
        let now = Instant::now();
        let mut state = self
            .state
            .lock()
            .expect("stream profit oracle state poisoned");

        if let Some(last) = state.last_fetch {
            if now.duration_since(last) < self.min_fetch_interval && !state.cache.is_empty() {
                debug!("stream_profit: returning {} cached estimates", state.cache.len());
                return state.cache.clone();
            }
        }

        if now.duration_since(state.window_start).as_secs() >= self.window_secs {
            state.window_start = now;
            state.request_count = 0;
        }

        if state.request_count >= self.max_requests_per_window {
            warn!("stream_profit: rate limit reached; using fallback");
            return fallback_estimates();
        }
        state.request_count += 1;

        if self.whattomine_key.is_none() && self.nicehash_key.is_none() {
            debug!("stream_profit: no API keys configured; using CoinProfile fallback");
            let estimates = fallback_estimates();
            state.cache = estimates.clone();
            state.last_fetch = Some(now);
            return estimates;
        }

        let mut live: HashMap<ExternalCoin, f64> = HashMap::new();

        if let Some(ref key) = self.whattomine_key {
            match fetch_whattomine(key) {
                Ok(map) => {
                    for (coin, revenue) in map {
                        live.insert(coin, revenue);
                    }
                }
                Err(e) => warn!("stream_profit: WhatToMine fetch failed: {e}"),
            }
        }

        if self.nicehash_key.is_some() {
            match fetch_nicehash() {
                Ok(map) => {
                    for (coin, revenue) in map {
                        let entry = live.entry(coin).or_insert(0.0);
                        *entry = entry.max(revenue);
                    }
                }
                Err(e) => warn!("stream_profit: NiceHash fetch failed: {e}"),
            }
        }

        let estimates: Vec<ProfitEstimate> = fallback_estimates()
            .into_iter()
            .map(|mut e| {
                if let Some(revenue) = live.get(&e.coin) {
                    e.revenue_usd_per_day = *revenue;
                    e.live = true;
                }
                e
            })
            .collect();

        state.cache = estimates.clone();
        state.last_fetch = Some(now);
        estimates
    }

    /// Estimate a single coin, falling back to `CoinProfile` if no live data.
    pub fn estimate(&self, coin: ExternalCoin) -> ProfitEstimate {
        self.get_estimates()
            .into_iter()
            .find(|e| e.coin == coin)
            .unwrap_or_else(|| fallback_for_coin(coin))
    }
}

/// Fallback revenue for a single coin derived from its `CoinProfile`.
pub fn fallback_for_coin(coin: ExternalCoin) -> ProfitEstimate {
    let profile = CoinProfile::for_coin(coin);
    // CoinProfile stores per-unit profit; scale to a conservative daily
    // revenue figure.  The 24x multiplier aligns the placeholder profile
    // values with the historical daily revenue table in `autonomous.rs`.
    let revenue = profile.estimate_profit(1.0) * 24.0;
    ProfitEstimate {
        coin,
        revenue_usd_per_day: revenue,
        live: false,
    }
}

/// Fallback revenue estimates for every known external coin.
pub fn fallback_estimates() -> Vec<ProfitEstimate> {
    ExternalCoin::ALL
        .iter()
        .copied()
        .map(fallback_for_coin)
        .collect()
}

fn fetch_whattomine(api_key: &str) -> Result<HashMap<ExternalCoin, f64>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://whattomine.com/coins.json?api_key={}", api_key);
    let resp = client.get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("whattomine HTTP {}", resp.status()));
    }
    let body = resp.text().map_err(|e| e.to_string())?;
    parse_whattomine(&body)
}

fn parse_whattomine(body: &str) -> Result<HashMap<ExternalCoin, f64>, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("whattomine JSON: {e}"))?;
    let mut map = HashMap::new();

    if let Some(coins) = json.get("coins").and_then(|c| c.as_object()) {
        for (_id, data) in coins {
            let tag = data.get("tag").and_then(|t| t.as_str()).unwrap_or("");
            let revenue = data
                .get("revenue")
                .and_then(|r| r.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            if revenue <= 0.0 {
                continue;
            }
            if let Some(coin) = ExternalCoin::from_str_loose(tag) {
                map.insert(coin, revenue);
            }
        }
    }

    if map.is_empty() {
        return Err("whattomine response contained no usable coins".into());
    }
    Ok(map)
}

fn fetch_nicehash() -> Result<HashMap<ExternalCoin, f64>, String> {
    let btc_price = fetch_btc_price().unwrap_or(60_000.0);

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let url = "https://api2.nicehash.com/main/api/v2/public/simplemultialgo/info";
    let resp = client.get(url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("nicehash HTTP {}", resp.status()));
    }
    let body = resp.text().map_err(|e| e.to_string())?;
    parse_nicehash(&body, btc_price)
}

fn parse_nicehash(body: &str, btc_price_usd: f64) -> Result<HashMap<ExternalCoin, f64>, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("nicehash JSON: {e}"))?;
    let mut map: HashMap<ExternalCoin, f64> = HashMap::new();

    if let Some(algorithms) = json.get("miningAlgorithms").and_then(|a| a.as_array()) {
        for algo in algorithms {
            let name = algo
                .get("algorithm")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_uppercase();
            let paying = algo
                .get("paying")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            if paying <= 0.0 {
                continue;
            }

            // NiceHash `paying` is in BTC per unit per day for the
            // algorithm's normalized speed.  Multiply by a reference BTC
            // price and a constant scale to get a comparable USD/day value.
            let revenue = paying * btc_price_usd * 1_000.0;

            for coin in nicehash_algo_to_coins(&name) {
                let entry = map.entry(coin).or_insert(0.0);
                *entry = entry.max(revenue);
            }
        }
    }

    if map.is_empty() {
        return Err("nicehash response contained no usable algorithms".into());
    }
    Ok(map)
}

fn nicehash_algo_to_coins(algo: &str) -> Vec<ExternalCoin> {
    match algo {
        "KHEAVYHASH" => vec![ExternalCoin::Kaspa],
        "KAWPOW" => vec![
            ExternalCoin::Ravencoin,
            ExternalCoin::Clore,
            ExternalCoin::Meowcoin,
            ExternalCoin::Quai,
            ExternalCoin::Evrmore,
        ],
        "ETCHASH" => vec![ExternalCoin::EthereumClassic],
        "AUTOLYKOS" => vec![ExternalCoin::Ergo],
        "ZELHASH" => vec![ExternalCoin::Flux],
        "BEAMV3" => vec![ExternalCoin::Beam],
        "FISHHASH" => vec![ExternalCoin::IronFish],
        "EQUIHASH" | "EQUIHASH192" | "ZHASH" | "EQUIHASH192_7" => {
            vec![ExternalCoin::Zcash, ExternalCoin::Zclassic]
        }
        "OCTOPUS" => vec![ExternalCoin::Conflux],
        "EAGLESONG" => vec![ExternalCoin::Nervos],
        "NEOSCRYPT" => vec![ExternalCoin::PhoenixCoin],
        "KERYXHASH" => vec![ExternalCoin::Keryx],
        "RANDOMXMONERO" | "RANDOMX" => vec![ExternalCoin::Monero],
        "VERUSHASH" => vec![ExternalCoin::Verus],
        "GHOSTRIDER" => vec![ExternalCoin::Raptoreum],
        "ALEPHIUM" => vec![ExternalCoin::Alephium],
        "DECRED" => vec![ExternalCoin::Decred],
        "NEXAPOW" => vec![ExternalCoin::Nexa],
        "DYNEXSOLVE" => vec![ExternalCoin::Dynex],
        "VERTHASH" => vec![ExternalCoin::Vertcoin],
        "QHASH" => vec![ExternalCoin::Qubitcoin],
        "PROGPOW" => vec![ExternalCoin::EpicCash],
        "PROGPOWZ" => vec![ExternalCoin::Zano],
        "SHA256" => vec![ExternalCoin::Bitcoin],
        _ => Vec::new(),
    }
}

fn fetch_btc_price() -> Option<f64> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .ok()?;
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
    let resp = client.get(url).send().ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body = resp.text().ok()?;
    let json: serde_json::Value = serde_json::from_str(&body).ok()?;
    json.get("bitcoin")?.get("usd")?.as_f64()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_estimates_cover_all_coins() {
        let estimates = fallback_estimates();
        assert_eq!(estimates.len(), ExternalCoin::ALL.len());
        for coin in ExternalCoin::ALL {
            assert!(estimates.iter().any(|e| e.coin == *coin));
        }
    }

    #[test]
    fn oracle_returns_fallback_without_keys() {
        std::env::remove_var("WHATTOMAINE_API_KEY");
        std::env::remove_var("NICEHASH_API_KEY");
        let oracle = StreamProfitOracle::new();
        let estimates = oracle.get_estimates();
        assert!(!estimates.is_empty());
        assert!(estimates.iter().all(|e| !e.live));
    }

    #[test]
    fn oracle_caches_fallback_snapshot() {
        std::env::remove_var("WHATTOMAINE_API_KEY");
        std::env::remove_var("NICEHASH_API_KEY");
        let oracle = StreamProfitOracle::with_interval(Duration::from_secs(60));
        let first = oracle.get_estimates();
        let second = oracle.get_estimates();
        assert_eq!(first.len(), second.len());
        assert!(!first.iter().any(|e| e.live));
    }

    #[test]
    fn rate_limit_keeps_serving_fallback() {
        let oracle = StreamProfitOracle::with_interval(Duration::from_secs(0));
        for i in 0..15 {
            let estimates = oracle.get_estimates();
            assert!(!estimates.is_empty(), "estimates empty on iteration {i}");
        }
    }

    #[test]
    fn parse_whattomine_maps_known_tags() {
        let body = r#"{
            "coins": {
                "1": { "tag": "KAS", "revenue": "1.20" },
                "2": { "tag": "ALPH", "revenue": "0.65" },
                "3": { "tag": "UNKNOWN", "revenue": "0.10" }
            }
        }"#;
        let map = parse_whattomine(body).unwrap();
        assert_eq!(map.len(), 2);
        assert!((map[&ExternalCoin::Kaspa] - 1.20).abs() < 0.001);
        assert!((map[&ExternalCoin::Alephium] - 0.65).abs() < 0.001);
    }

    #[test]
    fn parse_nicehash_maps_algorithms_to_coins() {
        let body = r#"{
            "miningAlgorithms": [
                { "algorithm": "KHEAVYHASH", "speed": "1000000000.0", "paying": "0.0001" },
                { "algorithm": "KAWPOW", "speed": "1000000000.0", "paying": "0.00005" },
                { "algorithm": "RANDOMXMONERO", "speed": "1000000.0", "paying": "0.0002" }
            ]
        }"#;
        let map = parse_nicehash(body, 60_000.0).unwrap();
        assert!(map.contains_key(&ExternalCoin::Kaspa));
        assert!(map.contains_key(&ExternalCoin::Ravencoin) || map.contains_key(&ExternalCoin::Clore));
        assert!(map.contains_key(&ExternalCoin::Monero));
    }
}
