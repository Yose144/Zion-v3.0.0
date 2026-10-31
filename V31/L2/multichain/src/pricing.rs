//! Price derivation for the public `GET /prices/:token/history` surface.
//!
//! There is **no** price-history table in the multichain store. Instead of
//! inventing one (or inventing numbers), this module derives a series from data
//! that already exists:
//!
//! * **settled DEX orders** (`dex_orders` with status `executed` / `settled`) —
//!   each one is a real trade, so `amount_out / amount_in` is an executed price
//!   at a known timestamp;
//! * **live AMM pools** (`pools`) — a constant-product pool gives a spot price
//!   from its reserves, stamped with the request time.
//!
//! Everything is a pure function over already-loaded rows so it can be tested
//! without a database, a network, or a clock.
//!
//! Honesty rules (deliberate):
//! * no order and no pool matching the pair ⇒ callers return an empty series,
//!   never a placeholder or an interpolated/extrapolated value;
//! * a point is only emitted when both amounts are non-zero and the resulting
//!   price is finite and positive;
//! * the series is labelled with its `source` so a client can tell "6 real
//!   trades" from "one pool midpoint".

use chrono::{DateTime, Duration, Utc};
use zion_l1_types::Asset;

use crate::contracts::token_decimals;
use crate::multichain_wallet::types::DexOrder;
use crate::swap::dex::Pool;

/// Maximum timeframe window accepted by `tf=` (keeps the scan bounded).
const MAX_TIMEFRAME_DAYS: i64 = 366;

/// A single point of a derived price series.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PricePoint {
    /// Unix timestamp in **milliseconds**.
    pub timestamp_ms: i64,
    /// Price of the requested token expressed in the quote asset.
    pub price: f64,
}

/// A loosely-parsed asset reference.
///
/// Accepted forms (all case-insensitive):
/// * `wZION` — bare ticker, matches the ticker on any chain;
/// * `base:wZION` — ticker on a specific chain;
/// * `base:wZION:0x0c49…` — exact asset key (ticker + contract).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AssetRef {
    pub chain: Option<String>,
    pub ticker: String,
    pub contract: Option<String>,
}

impl AssetRef {
    /// Parse a lenient asset reference. Returns `None` for empty input.
    pub fn parse(key: &str) -> Option<Self> {
        let key = key.trim();
        if key.is_empty() {
            return None;
        }
        let parts: Vec<&str> = key.splitn(3, ':').collect();
        let (chain, ticker, contract) = match parts.len() {
            1 => (None, parts[0], None),
            2 => (Some(parts[0]), parts[1], None),
            _ => (Some(parts[0]), parts[1], Some(parts[2])),
        };
        let ticker = ticker.trim();
        if ticker.is_empty() {
            return None;
        }
        Some(Self {
            chain: chain.map(|c| c.trim().to_string()),
            ticker: ticker.to_string(),
            contract: contract.map(|c| c.trim().to_string()),
        })
    }

    /// Does this reference match an asset identified by its raw parts?
    ///
    /// Unspecified parts of `self` are wildcards, so `wZION` matches
    /// `base:wZION:0x…` while `base:wZION:0x…` only matches itself.
    pub fn matches_parts(&self, chain: &str, ticker: &str, contract: Option<&str>) -> bool {
        if !self.ticker.eq_ignore_ascii_case(ticker) {
            return false;
        }
        if let Some(want_chain) = &self.chain {
            if !want_chain.eq_ignore_ascii_case(chain) {
                return false;
            }
        }
        if let Some(want_contract) = &self.contract {
            match contract {
                Some(c) if c.eq_ignore_ascii_case(want_contract) => {}
                _ => return false,
            }
        }
        true
    }

    /// Does this reference match a resolved `Asset`?
    pub fn matches_asset(&self, asset: &Asset) -> bool {
        self.matches_parts(
            asset.id.chain.as_str(),
            &asset.id.ticker,
            asset.id.contract.as_deref(),
        )
    }
}

/// Convert a raw integer amount into a human (float) amount.
pub fn human(value: u128, decimals: u8) -> f64 {
    let scale = 10f64.powi(decimals as i32);
    (value as f64) / scale
}

/// Guard against division by zero, NaN and absurd values.
pub fn sane_price(quote: f64, base: f64) -> Option<f64> {
    if !quote.is_finite() || !base.is_finite() || quote <= 0.0 || base <= 0.0 {
        return None;
    }
    let price = quote / base;
    if price.is_finite() && price > 0.0 {
        Some(price)
    } else {
        None
    }
}

/// Resolve decimals for a parsed asset reference.
///
/// Prefers the canonical contract registry (`token_decimals`), then falls back
/// to the chain's native decimals so e.g. `zion-l1:ZION` is treated as 6dp
/// rather than 0dp.
fn decimals_for_ref(asset: &AssetRef) -> u8 {
    let chain = asset.chain.as_deref().unwrap_or("");
    let decimals = token_decimals(chain, &asset.ticker, asset.contract.as_deref());
    if decimals > 0 {
        return decimals;
    }
    if let Some(chain) = &asset.chain {
        if let Ok(chain_id) = crate::service::chain_id_by_name(chain) {
            return chain_id.decimals();
        }
    }
    0
}

/// Timestamp used to place an order on the series.
///
/// `executed_at` wins over `created_at`: the trade happened at execution, the
/// order may have been created much earlier.
pub fn order_timestamp_ms(order: &DexOrder) -> i64 {
    order
        .executed_at
        .unwrap_or(order.created_at)
        .timestamp_millis()
}

/// Derive the executed price of `token` (in units of `vs`) from a DEX order.
///
/// Returns `None` unless the order trades exactly the token against the quote
/// asset — e.g. a `wZION → WETH` order cannot price `wZION` in USDT.
pub fn order_price(order: &DexOrder, token: &AssetRef, vs: &AssetRef) -> Option<f64> {
    let from = AssetRef::parse(&order.from_asset_key)?;
    let to = AssetRef::parse(&order.to_asset_key)?;

    let token_on_from = token.matches_parts(
        from.chain.as_deref().unwrap_or(""),
        &from.ticker,
        from.contract.as_deref(),
    ) && vs.matches_parts(
        to.chain.as_deref().unwrap_or(""),
        &to.ticker,
        to.contract.as_deref(),
    );
    let token_on_to = token.matches_parts(
        to.chain.as_deref().unwrap_or(""),
        &to.ticker,
        to.contract.as_deref(),
    ) && vs.matches_parts(
        from.chain.as_deref().unwrap_or(""),
        &from.ticker,
        from.contract.as_deref(),
    );

    let from_human = human(order.amount_in.0, decimals_for_ref(&from));
    let to_human = human(order.amount_out.0, decimals_for_ref(&to));

    if token_on_from {
        sane_price(to_human, from_human)
    } else if token_on_to {
        sane_price(from_human, to_human)
    } else {
        None
    }
}

/// Spot price of `token` in `vs` from a constant-product pool's reserves.
///
/// This is the pool midpoint (fees are not applied) and only expresses what the
/// AMM reserves imply right now — it is not a trade and has no history.
pub fn pool_spot(pool: &Pool, token: &AssetRef, vs: &AssetRef) -> Option<f64> {
    let (token_asset, token_reserve, vs_asset, vs_reserve) =
        if token.matches_asset(&pool.asset_a) && vs.matches_asset(&pool.asset_b) {
            (
                &pool.asset_a,
                pool.reserve_a.0,
                &pool.asset_b,
                pool.reserve_b.0,
            )
        } else if token.matches_asset(&pool.asset_b) && vs.matches_asset(&pool.asset_a) {
            (
                &pool.asset_b,
                pool.reserve_b.0,
                &pool.asset_a,
                pool.reserve_a.0,
            )
        } else {
            return None;
        };

    if token_reserve == 0 || vs_reserve == 0 {
        return None;
    }

    sane_price(
        human(vs_reserve, vs_asset.decimals),
        human(token_reserve, token_asset.decimals),
    )
}

/// Parse a `tf=` window such as `1h`, `24h`, `7d`, `30m`, `2w`.
///
/// Returns `None` for malformed input (callers map that to HTTP 400) and caps
/// the window at 366 days.
pub fn parse_timeframe(tf: &str) -> Option<Duration> {
    let tf = tf.trim().to_ascii_lowercase();
    if tf.len() < 2 {
        return None;
    }
    let (digits, unit) = tf.split_at(tf.len() - 1);
    let value: i64 = digits.parse().ok()?;
    if value <= 0 {
        return None;
    }
    let seconds = match unit {
        "m" => value.checked_mul(60)?,
        "h" => value.checked_mul(3_600)?,
        "d" => value.checked_mul(86_400)?,
        "w" => value.checked_mul(7 * 86_400)?,
        _ => return None,
    };
    let cap = MAX_TIMEFRAME_DAYS * 86_400;
    Some(Duration::seconds(seconds.min(cap)))
}

/// Where a derived series came from.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SeriesSource {
    /// Neither settled orders nor a matching pool produced a point.
    Empty,
    /// Points derived only from settled DEX orders.
    Orders,
    /// A single live pool midpoint.
    Pool,
    /// Settled DEX orders plus a live pool midpoint.
    OrdersAndPool,
}

impl SeriesSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Empty => "empty",
            Self::Orders => "orders",
            Self::Pool => "pool",
            Self::OrdersAndPool => "orders+pool",
        }
    }
}

/// Build an ascending price series out of settled orders plus live pools.
///
/// `limit` is applied to the **tail** (most recent points) so a long history
/// still shows the freshest data.
pub fn build_series(
    orders: &[DexOrder],
    pools: &[Pool],
    token: &AssetRef,
    vs: &AssetRef,
    now: DateTime<Utc>,
    limit: usize,
) -> (Vec<PricePoint>, SeriesSource) {
    let mut points: Vec<PricePoint> = orders
        .iter()
        .filter_map(|order| {
            order_price(order, token, vs).map(|price| PricePoint {
                timestamp_ms: order_timestamp_ms(order),
                price,
            })
        })
        .collect();

    let had_orders = !points.is_empty();

    let pool_point = pools.iter().find_map(|pool| {
        pool_spot(pool, token, vs).map(|price| PricePoint {
            timestamp_ms: now.timestamp_millis(),
            price,
        })
    });
    if let Some(point) = pool_point {
        points.push(point);
    }

    let source = match (had_orders, pool_point.is_some()) {
        (false, false) => SeriesSource::Empty,
        (true, false) => SeriesSource::Orders,
        (false, true) => SeriesSource::Pool,
        (true, true) => SeriesSource::OrdersAndPool,
    };

    points.sort_by_key(|p| p.timestamp_ms);
    if limit > 0 && points.len() > limit {
        let drop = points.len() - limit;
        points.drain(0..drop);
    }

    (points, source)
}

/// Most recent known price for the pair, used as an honest "last known" value
/// when the requested window contains no trades.
pub fn latest_order_point(
    orders: &[DexOrder],
    token: &AssetRef,
    vs: &AssetRef,
) -> Option<PricePoint> {
    orders
        .iter()
        .filter_map(|order| {
            order_price(order, token, vs).map(|price| PricePoint {
                timestamp_ms: order_timestamp_ms(order),
                price,
            })
        })
        .max_by_key(|p| p.timestamp_ms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::multichain_wallet::types::DexOrderStatus;
    use chrono::TimeZone;
    use zion_l1_types::{Amount, Asset, ChainId};

    const WZION: &str = "base:wZION:0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
    const USDT: &str = "base:USDT:0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";

    fn ts(secs: i64) -> DateTime<Utc> {
        Utc.timestamp_opt(secs, 0).unwrap()
    }

    fn order(
        from: &str,
        to: &str,
        amount_in: u128,
        amount_out: u128,
        created_secs: i64,
        executed_secs: Option<i64>,
    ) -> DexOrder {
        DexOrder {
            id: "order-1".to_string(),
            user_id: "u1".to_string(),
            from_asset_key: from.to_string(),
            to_asset_key: to.to_string(),
            amount_in: Amount(amount_in),
            amount_out: Amount(amount_out),
            min_amount_out: Amount(0),
            recipient_address: None,
            route: vec![],
            tx_hash: None,
            htlc_hash: None,
            status: DexOrderStatus::Executed,
            created_at: ts(created_secs),
            executed_at: executed_secs.map(ts),
        }
    }

    fn pool(a: Asset, b: Asset, reserve_a: u128, reserve_b: u128) -> Pool {
        Pool {
            id: 1,
            asset_a: a,
            asset_b: b,
            reserve_a: Amount(reserve_a),
            reserve_b: Amount(reserve_b),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        }
    }

    #[test]
    fn parse_accepts_three_forms_and_rejects_empty() {
        let bare = AssetRef::parse("wZION").unwrap();
        assert_eq!(bare.chain, None);
        assert_eq!(bare.ticker, "wZION");
        assert_eq!(bare.contract, None);

        let chain = AssetRef::parse("base:wZION").unwrap();
        assert_eq!(chain.chain.as_deref(), Some("base"));
        assert_eq!(chain.contract, None);

        let full = AssetRef::parse(WZION).unwrap();
        assert_eq!(full.chain.as_deref(), Some("base"));
        assert!(full.contract.is_some());

        assert!(AssetRef::parse("   ").is_none());
        assert!(AssetRef::parse("base:").is_none());
    }

    #[test]
    fn bare_ticker_is_a_wildcard_but_full_key_is_not() {
        let bare = AssetRef::parse("wzion").unwrap();
        assert!(bare.matches_parts("base", "wZION", Some("0xAbC")));
        assert!(bare.matches_parts("zion-l1", "wZION", None));

        let full = AssetRef::parse(WZION).unwrap();
        assert!(full.matches_parts(
            "base",
            "wZION",
            Some("0x0C493763D107AB0ABB0AEE1CA3999292D8202BB6")
        ));
        assert!(!full.matches_parts("base", "wZION", Some("0xdead")));
        assert!(!full.matches_parts("ethereum", "wZION", full.contract.as_deref()));
        assert!(!full.matches_parts("base", "USDT", full.contract.as_deref()));
    }

    #[test]
    fn timeframe_parses_and_is_capped() {
        assert_eq!(parse_timeframe("1h"), Some(Duration::seconds(3_600)));
        assert_eq!(parse_timeframe("24h"), Some(Duration::seconds(86_400)));
        assert_eq!(parse_timeframe("7d"), Some(Duration::seconds(604_800)));
        assert_eq!(parse_timeframe("30m"), Some(Duration::seconds(1_800)));
        assert_eq!(parse_timeframe("2w"), Some(Duration::seconds(1_209_600)));
        // Case + whitespace tolerated.
        assert_eq!(parse_timeframe(" 1H "), Some(Duration::seconds(3_600)));
        // Garbage is rejected.
        assert!(parse_timeframe("0h").is_none());
        assert!(parse_timeframe("h").is_none());
        assert!(parse_timeframe("24x").is_none());
        assert!(parse_timeframe("").is_none());
        // Cap: 10 years → 366 days.
        assert_eq!(
            parse_timeframe("520w"),
            Some(Duration::seconds(MAX_TIMEFRAME_DAYS * 86_400))
        );
    }

    #[test]
    fn order_price_handles_both_directions() {
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();

        // 1 wZION (18dp) → 197 USDT (6dp).
        let sell = order(
            WZION,
            USDT,
            1_000_000_000_000_000_000,
            197_000_000,
            100,
            Some(200),
        );
        let price = order_price(&sell, &token, &vs).unwrap();
        assert!((price - 197.0).abs() < 1e-9);

        // Reverse direction: 197 USDT → 1 wZION.
        let buy = order(
            USDT,
            WZION,
            197_000_000,
            1_000_000_000_000_000_000,
            100,
            Some(200),
        );
        let price = order_price(&buy, &token, &vs).unwrap();
        assert!((price - 197.0).abs() < 1e-9);
    }

    #[test]
    fn order_price_rejects_pairs_without_the_quote_asset() {
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();
        // wZION → WETH cannot price wZION in USDT.
        let weth_order = order(
            WZION,
            "base:WETH:0x4200000000000000000000000000000000000006",
            1_000_000_000_000_000_000,
            83_103_759_001,
            100,
            Some(200),
        );
        assert!(order_price(&weth_order, &token, &vs).is_none());
        // ... but it can price it in WETH.
        let weth = AssetRef::parse("WETH").unwrap();
        assert!(order_price(&weth_order, &token, &weth).is_some());
    }

    #[test]
    fn order_price_rejects_zero_amounts() {
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();
        let zero_in = order(WZION, USDT, 0, 197_000_000, 100, Some(200));
        assert!(order_price(&zero_in, &token, &vs).is_none());
        let zero_out = order(WZION, USDT, 1_000_000_000_000_000_000, 0, 100, Some(200));
        assert!(order_price(&zero_out, &token, &vs).is_none());
    }

    #[test]
    fn order_is_timestamped_by_execution_when_available() {
        let o = order(WZION, USDT, 1, 1, 100, Some(500));
        assert_eq!(order_timestamp_ms(&o), 500_000);
        let o = order(WZION, USDT, 1, 1, 100, None);
        assert_eq!(order_timestamp_ms(&o), 100_000);
    }

    #[test]
    fn pool_spot_reads_reserves_in_either_direction() {
        let wzion = Asset::with_contract(ChainId::Base, "wZION", "0x0c49", 18, "wZION");
        let usdt = Asset::with_contract(ChainId::Base, "USDT", "0xfde4", 6, "USDT");
        let p = pool(
            wzion.clone(),
            usdt.clone(),
            1_000_000_000_000_000_000,
            197_000_000,
        );

        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();
        assert!((pool_spot(&p, &token, &vs).unwrap() - 197.0).abs() < 1e-9);

        // Reverse pair ordering gives the inverse price.
        let inverted = pool(usdt, wzion, 197_000_000, 1_000_000_000_000_000_000);
        assert!((pool_spot(&inverted, &token, &vs).unwrap() - 197.0).abs() < 1e-9);
        assert!((pool_spot(&inverted, &vs, &token).unwrap() - 1.0 / 197.0).abs() < 1e-12);
    }

    #[test]
    fn pool_spot_ignores_empty_reserves_and_other_pairs() {
        let wzion = Asset::with_contract(ChainId::Base, "wZION", "0x0c49", 18, "wZION");
        let usdt = Asset::with_contract(ChainId::Base, "USDT", "0xfde4", 6, "USDT");
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();

        let empty = pool(wzion.clone(), usdt.clone(), 0, 197_000_000);
        assert!(pool_spot(&empty, &token, &vs).is_none());

        let other = pool(
            Asset::with_contract(ChainId::Base, "WETH", "0x4200", 18, "WETH"),
            usdt,
            1_000_000_000_000_000_000,
            197_000_000,
        );
        assert!(pool_spot(&other, &token, &vs).is_none());
    }

    #[test]
    fn build_series_is_sorted_limited_and_labelled() {
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();
        let orders = vec![
            order(
                WZION,
                USDT,
                1_000_000_000_000_000_000,
                190_000_000,
                100,
                Some(300),
            ),
            order(
                WZION,
                USDT,
                1_000_000_000_000_000_000,
                195_000_000,
                100,
                Some(100),
            ),
            order(
                WZION,
                USDT,
                1_000_000_000_000_000_000,
                197_000_000,
                100,
                Some(200),
            ),
        ];

        let (series, source) = build_series(&orders, &[], &token, &vs, ts(1_000), 0);
        assert_eq!(source, SeriesSource::Orders);
        assert_eq!(
            series.iter().map(|p| p.timestamp_ms).collect::<Vec<_>>(),
            vec![100_000, 200_000, 300_000]
        );
        assert!((series[0].price - 195.0).abs() < 1e-9);

        // Limit keeps the most recent tail.
        let (series, _) = build_series(&orders, &[], &token, &vs, ts(1_000), 2);
        assert_eq!(series.len(), 2);
        assert_eq!(series[1].timestamp_ms, 300_000);
    }

    #[test]
    fn build_series_appends_live_pool_midpoint() {
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();
        let orders = vec![order(
            WZION,
            USDT,
            1_000_000_000_000_000_000,
            190_000_000,
            100,
            Some(300),
        )];
        let pools = vec![pool(
            Asset::with_contract(ChainId::Base, "wZION", "0x0c49", 18, "wZION"),
            Asset::with_contract(ChainId::Base, "USDT", "0xfde4", 6, "USDT"),
            1_000_000_000_000_000_000,
            197_000_000,
        )];

        let now = ts(1_000);
        let (series, source) = build_series(&orders, &pools, &token, &vs, now, 0);
        assert_eq!(source, SeriesSource::OrdersAndPool);
        assert_eq!(series.len(), 2);
        assert_eq!(series[1].timestamp_ms, now.timestamp_millis());
        assert!((series[1].price - 197.0).abs() < 1e-9);

        // Pool-only pair still produces a labelled point.
        let (series, source) = build_series(&[], &pools, &token, &vs, now, 0);
        assert_eq!(source, SeriesSource::Pool);
        assert_eq!(series.len(), 1);
    }

    #[test]
    fn empty_series_is_honestly_empty() {
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();
        let (series, source) = build_series(&[], &[], &token, &vs, ts(1_000), 500);
        assert!(series.is_empty());
        assert_eq!(source, SeriesSource::Empty);
        assert_eq!(source.as_str(), "empty");
        assert!(latest_order_point(&[], &token, &vs).is_none());
    }

    #[test]
    fn latest_order_point_picks_newest_within_filters() {
        let token = AssetRef::parse("wZION").unwrap();
        let vs = AssetRef::parse("USDT").unwrap();
        let orders = vec![
            order(
                WZION,
                USDT,
                1_000_000_000_000_000_000,
                190_000_000,
                100,
                Some(100),
            ),
            order(
                WZION,
                USDT,
                1_000_000_000_000_000_000,
                197_000_000,
                100,
                Some(900),
            ),
            // Newer, but not a wZION/USDT trade.
            order(USDT, "base:WETH:0x4200", 197_000_000, 5, 100, Some(950)),
        ];
        let point = latest_order_point(&orders, &token, &vs).unwrap();
        assert_eq!(point.timestamp_ms, 900_000);
        assert!((point.price - 197.0).abs() < 1e-9);
    }

    #[test]
    fn decimals_fall_back_to_chain_native_decimals() {
        let zion = AssetRef::parse("zion-l1:ZION").unwrap();
        assert_eq!(decimals_for_ref(&zion), ChainId::ZionL1.decimals());
        let usdt_ref =
            AssetRef::parse("base:USDT:0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2").unwrap();
        assert_eq!(decimals_for_ref(&usdt_ref), 6);
    }
}
