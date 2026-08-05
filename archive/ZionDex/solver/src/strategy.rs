//! Bidding strategies for the solver daemon.
//!
//! A [`BiddingStrategy`] turns a [`SwapIntent`] plus a Router [`MultiPathQuote`]
//! into a [`SolverBid`]. Two concrete strategies are provided:
//!
//! - [`FixedMarginStrategy`] — takes the router's best output and subtracts a
//!   fixed margin (in bps) as the solver's profit, offering the rest to the user.
//! - [`CompetitiveStrategy`] — adjusts the margin based on estimated gas cost,
//!   trying to maximize win rate while never dropping below `min_profit_bps`.

use crate::errors::{Error, Result};
use crate::types::{MultiPathQuote, PathHop, SolverBid, SwapIntent, SwapStep};
use ethers::types::U256;

/// A strategy that computes a solver bid from an intent and a quote.
pub trait BiddingStrategy: Send + Sync {
    /// Compute a bid for `intent` given the router's `quote`.
    fn compute_bid(&self, intent: &SwapIntent, quote: &MultiPathQuote) -> Result<SolverBid>;
}

/// Fixed-margin strategy: take `margin_bps` of the router's best output as
/// profit, offer the remainder to the user.
pub struct FixedMarginStrategy {
    /// Profit taken in basis points (e.g. 5 = 0.05%).
    pub margin_bps: u16,
    /// Solver address used in the bid.
    pub solver_address: String,
}

impl FixedMarginStrategy {
    pub fn new(margin_bps: u16, solver_address: impl Into<String>) -> Self {
        Self {
            margin_bps,
            solver_address: solver_address.into(),
        }
    }
}

impl BiddingStrategy for FixedMarginStrategy {
    fn compute_bid(&self, intent: &SwapIntent, quote: &MultiPathQuote) -> Result<SolverBid> {
        if self.margin_bps > 10000 {
            return Err(Error::Other(format!(
                "margin_bps {} exceeds 10000",
                self.margin_bps
            )));
        }

        let best = quote.best_path().ok_or_else(|| Error::NoPath {
            from: intent.from_token.clone(),
            to: intent.to_token.clone(),
        })?;

        // Router reports total_output as a human-readable float. Convert to the
        // destination token's smallest units using the output token decimals.
        let decimals = output_decimals(quote) as u32;
        let raw_out = float_to_smallest_units(best.total_output, decimals);

        // profit = raw_out * margin_bps / 10000
        let margin = U256::from(self.margin_bps);
        let profit = raw_out * margin / U256::from(10000u64);
        let amount_out = raw_out - profit;

        if amount_out < intent.min_amount_out {
            return Err(Error::BidBelowMinimum {
                bid: amount_out.to_string(),
                min: intent.min_amount_out.to_string(),
            });
        }

        let path = path_to_hops(best);
        let fee_bps = best.total_fee_bps.min(u16::MAX as u64) as u16;
        let ts = now_secs();

        Ok(SolverBid::new(
            intent.id,
            self.solver_address.clone(),
            amount_out,
            path,
            fee_bps,
            ts,
        ))
    }
}

/// Competitive strategy: shrinks the margin when gas is cheap and grows it
/// when gas is expensive, but never below `min_profit_bps`.
pub struct CompetitiveStrategy {
    /// Minimum acceptable profit in basis points.
    pub min_profit_bps: u16,
    /// Maximum gas price the solver is willing to pay (gwei).
    pub max_gas_gwei: u64,
    /// Solver address used in the bid.
    pub solver_address: String,
    /// Estimated gas units for a typical cross-chain swap execution.
    pub estimated_gas_units: u64,
}

impl CompetitiveStrategy {
    pub fn new(
        min_profit_bps: u16,
        max_gas_gwei: u64,
        solver_address: impl Into<String>,
    ) -> Self {
        Self {
            min_profit_bps,
            max_gas_gwei,
            solver_address: solver_address.into(),
            // ~350k gas covers a same-chain swap + a bridge hop on L2.
            estimated_gas_units: 350_000,
        }
    }

    /// Compute the margin (in bps) to take, given an assumed gas price (gwei).
    ///
    /// The margin scales linearly with the ratio `gas / max_gas`: at gas=0 we
    /// take `min_profit_bps`, at gas=`max_gas_gwei` we take `2 * min_profit_bps`.
    pub fn margin_for_gas(&self, gas_gwei: u64) -> u16 {
        let base = self.min_profit_bps as u64;
        let ratio = if self.max_gas_gwei == 0 {
            1
        } else {
            // clamp gas into [0, max]
            gas_gwei.clamp(0, self.max_gas_gwei) * 100 / self.max_gas_gwei.max(1)
        };
        // margin = base + base * ratio / 100  -> in [base, 2*base]
        let margin = base + base * ratio / 100;
        margin.min(u16::MAX as u64) as u16
    }
}

impl BiddingStrategy for CompetitiveStrategy {
    fn compute_bid(&self, intent: &SwapIntent, quote: &MultiPathQuote) -> Result<SolverBid> {
        let best = quote.best_path().ok_or_else(|| Error::NoPath {
            from: intent.from_token.clone(),
            to: intent.to_token.clone(),
        })?;

        // Estimate the gas price we'd pay. In a real deployment this would come
        // from an oracle; here we use a conservative fraction of the cap.
        let gas_gwei = self.max_gas_gwei / 2;
        let margin_bps = self.margin_for_gas(gas_gwei);

        let decimals = output_decimals(quote) as u32;
        let raw_out = float_to_smallest_units(best.total_output, decimals);

        let profit = raw_out * U256::from(margin_bps) / U256::from(10000u64);
        let amount_out = raw_out - profit;

        if amount_out < intent.min_amount_out {
            // Try to stay competitive by trimming to the minimum acceptable.
            let min = intent.min_amount_out;
            if raw_out <= min {
                return Err(Error::BidBelowMinimum {
                    bid: raw_out.to_string(),
                    min: min.to_string(),
                });
            }
            // Offer exactly the minimum (zero profit) to maximize win chance.
            return Ok(SolverBid::new(
                intent.id,
                self.solver_address.clone(),
                min,
                path_to_hops(best),
                best.total_fee_bps.min(u16::MAX as u64) as u16,
                now_secs(),
            ));
        }

        // Track gas cost in smallest units of the gas token (18 decimals for EVM).
        // The node records the realized gas cost at execution time; we compute it
        // here only to validate profitability (raw_out - amount_out >= gas_cost).
        let gas_cost = gwei_to_smallest_units(gas_gwei * self.estimated_gas_units);
        let realized_profit = raw_out - amount_out;
        if realized_profit < gas_cost && amount_out > intent.min_amount_out {
            // Gas would eat the margin; fall back to the minimum profit bid.
            let min_profit = raw_out * U256::from(self.min_profit_bps) / U256::from(10000u64);
            if raw_out > intent.min_amount_out + min_profit {
                return Ok(SolverBid::new(
                    intent.id,
                    self.solver_address.clone(),
                    raw_out - min_profit,
                    path_to_hops(best),
                    best.total_fee_bps.min(u16::MAX as u64) as u16,
                    now_secs(),
                ));
            }
        }

        let path = path_to_hops(best);
        let fee_bps = best.total_fee_bps.min(u16::MAX as u64) as u16;
        Ok(SolverBid::new(
            intent.id,
            self.solver_address.clone(),
            amount_out,
            path,
            fee_bps,
            now_secs(),
        ))
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Convert a router `AggregatedPath` into a vector of [`PathHop`]s.
fn path_to_hops(path: &crate::types::AggregatedPath) -> Vec<PathHop> {
    path.steps
        .iter()
        .map(|s| match s {
            SwapStep::SameChainSwap {
                chain,
                dex,
                from_token,
                to_token,
                ..
            } => PathHop {
                chain: chain.to_string(),
                dex: dex.clone(),
                from_token: from_token.symbol().to_string(),
                to_token: to_token.symbol().to_string(),
                is_bridge: false,
            },
            SwapStep::Bridge {
                from_chain,
                to_chain,
                asset,
                ..
            } => PathHop {
                chain: format!("{}->{}", from_chain, to_chain),
                dex: "warp".to_string(),
                from_token: asset.symbol().to_string(),
                to_token: asset.symbol().to_string(),
                is_bridge: true,
            },
        })
        .collect()
}

/// Determine the decimals of the output token from the quote.
fn output_decimals(quote: &MultiPathQuote) -> u8 {
    match &quote.output_token {
        crate::types::TokenId::Native { chain, .. } => chain_decimals(*chain),
        crate::types::TokenId::Token { decimals, .. } => *decimals,
    }
}

/// Canonical decimals per chain (mirrors the router's `ChainId::decimals`).
fn chain_decimals(chain: crate::types::ChainId) -> u8 {
    use crate::types::ChainId::*;
    match chain {
        Zion | Stellar | Cardano | Cosmos => 6,
        Bitcoin | Aptos => 8,
        Solana | Sui | Ton => 9,
        Near => 24,
        // EVM + Tron
        Base | Arbitrum | Bsc | Polygon | Optimism | Avalanche | Tron => 18,
    }
}

/// Convert a human-readable float amount into smallest-unit U256.
fn float_to_smallest_units(amount: f64, decimals: u32) -> U256 {
    if !amount.is_finite() || amount <= 0.0 {
        return U256::zero();
    }
    let scale = 10u64.pow(decimals.min(18)) as f64;
    let scaled = amount * scale;
    if scaled > (u128::MAX as f64) {
        // Clamp to u128 range; U256 from u128 is safe.
        U256::from(u128::MAX)
    } else {
        U256::from(scaled as u128)
    }
}

/// Convert gwei * gas_units into smallest units (wei, 18 decimals).
fn gwei_to_smallest_units(gwei_times_units: u64) -> U256 {
    // 1 gwei = 1e9 wei
    U256::from(gwei_times_units) * U256::from(1_000_000_000u64)
}

/// Current unix timestamp in seconds.
fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AggregatedPath, ChainId, TokenId};

    fn make_quote(output: f64) -> MultiPathQuote {
        let path = AggregatedPath {
            steps: vec![SwapStep::SameChainSwap {
                chain: ChainId::Base,
                dex: "uniswap-v3".to_string(),
                from_token: TokenId::Native {
                    chain: ChainId::Zion,
                    symbol: "ZION".into(),
                },
                to_token: TokenId::Token {
                    chain: ChainId::Base,
                    address: "0x0c49".into(),
                    symbol: "wZION".into(),
                    decimals: 18,
                },
                amount_in: "1000".into(),
                expected_amount_out: format!("{}", output),
                fee_bps: 30,
            }],
            total_output: output,
            total_fee_bps: 30,
            estimated_time_secs: 10,
            bridge_hops: 0,
        };
        MultiPathQuote {
            quote_id: "qmp_test".into(),
            input_token: TokenId::Native {
                chain: ChainId::Zion,
                symbol: "ZION".into(),
            },
            input_amount: "1000".into(),
            output_token: TokenId::Token {
                chain: ChainId::Base,
                address: "0x0c49".into(),
                symbol: "wZION".into(),
                decimals: 18,
            },
            paths: vec![path],
            recommended_path_index: 0,
            expiry: chrono::Utc::now(),
        }
    }

    fn make_intent(min_out: U256) -> SwapIntent {
        SwapIntent::new(
            "0xuser",
            ChainId::Zion,
            ChainId::Base,
            "ZION",
            "wZION",
            U256::from(1000_000_000u64),
            min_out,
            now_secs() + 60,
            1,
        )
    }

    #[test]
    fn test_fixed_margin_strategy() {
        let strat = FixedMarginStrategy::new(5, "0xsolver");
        let quote = make_quote(1000.0);
        let intent = make_intent(U256::zero());
        let bid = strat.compute_bid(&intent, &quote).expect("bid");
        // raw_out = 1000 * 1e18 = 1e21; profit = 1e21 * 5 / 10000 = 5e17
        let raw = U256::from(1_000_000_000_000_000_000_000u128);
        let profit = raw * U256::from(5u64) / U256::from(10000u64);
        assert_eq!(bid.amount_out, raw - profit);
        assert_eq!(bid.solver, "0xsolver");
        assert_eq!(bid.path.len(), 1);
        assert!(!bid.path[0].is_bridge);
    }

    #[test]
    fn test_fixed_margin_below_minimum() {
        let strat = FixedMarginStrategy::new(5, "0xsolver");
        let quote = make_quote(1000.0);
        // Set min above what we can offer -> error.
        let intent = make_intent(U256::from(u128::MAX));
        assert!(strat.compute_bid(&intent, &quote).is_err());
    }

    #[test]
    fn test_competitive_strategy_adjusts_for_gas() {
        let strat = CompetitiveStrategy::new(5, 50, "0xsolver");
        // At max_gas/2 = 25 gwei, ratio = 50%, margin = 5 + 5*50/100 = 7 bps.
        assert_eq!(strat.margin_for_gas(25), 7);
        // At 0 gwei, margin = min profit.
        assert_eq!(strat.margin_for_gas(0), 5);
        // At max gas, margin = 2 * min.
        assert_eq!(strat.margin_for_gas(50), 10);
        // Clamped above max.
        assert_eq!(strat.margin_for_gas(999), 10);
    }

    #[test]
    fn test_competitive_strategy_bid() {
        let strat = CompetitiveStrategy::new(5, 50, "0xsolver");
        let quote = make_quote(1000.0);
        let intent = make_intent(U256::zero());
        let bid = strat.compute_bid(&intent, &quote).expect("bid");
        // margin = 7 bps at gas=25
        let raw = U256::from(1_000_000_000_000_000_000_000u128);
        let profit = raw * U256::from(7u64) / U256::from(10000u64);
        assert_eq!(bid.amount_out, raw - profit);
    }

    #[test]
    fn test_float_to_smallest_units() {
        assert_eq!(float_to_smallest_units(0.0, 18), U256::zero());
        assert_eq!(
            float_to_smallest_units(1.0, 18),
            U256::from(1_000_000_000_000_000_000u64)
        );
        assert_eq!(float_to_smallest_units(1.0, 6), U256::from(1_000_000u64));
    }

    #[test]
    fn test_gwei_to_smallest_units() {
        // 1 gwei * 1 unit = 1e9 wei
        assert_eq!(gwei_to_smallest_units(1), U256::from(1_000_000_000u64));
    }
}
