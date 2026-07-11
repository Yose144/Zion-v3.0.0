use crate::aggregator::{AggregatedPath, LiquidityAggregator};
use crate::config::RouterConfig;
use crate::router::Router;
use crate::types::*;
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use tracing::info;
use uuid::Uuid;

/// A multi-path quote returning the top-3 aggregated paths ranked by output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiPathQuote {
    pub quote_id: String,
    pub input_token: TokenId,
    pub input_amount: String,
    pub output_token: TokenId,
    /// Top 3 paths, sorted by output amount (descending).
    pub paths: Vec<AggregatedPath>,
    /// Index into `paths` of the recommended (best) path.
    pub recommended_path_index: usize,
    pub expiry: DateTime<Utc>,
}

/// Quote engine — calculates prices, slippage, fees
pub struct QuoteEngine {
    pub config: RouterConfig,
    router: Router,
    aggregator: tokio::sync::Mutex<LiquidityAggregator>,
}

impl QuoteEngine {
    pub fn new(config: RouterConfig) -> Self {
        let router = Router::new(config.clone());
        let aggregator = LiquidityAggregator::new(config.clone());
        Self {
            config,
            router,
            aggregator: tokio::sync::Mutex::new(aggregator),
        }
    }

    /// Generate a quote for a swap request
    pub async fn quote(&self, req: &QuoteRequest) -> Result<QuoteResponse> {
        info!(
            "Quote request: {} {} → {} {} (amount: {})",
            req.src_chain, req.src_token,
            req.dest_chain, req.dest_token,
            req.amount
        );

        // Resolve token symbols to TokenId
        let src_token = resolve_token(req.src_chain, &req.src_token);
        let dest_token = resolve_token(req.dest_chain, &req.dest_token);

        // Find best path
        let paths = self.router.find_paths(
            req.src_chain,
            &src_token,
            req.dest_chain,
            &dest_token,
            &req.amount,
        ).await?;

        let best_path = paths.into_iter().next().ok_or_else(|| {
            anyhow::anyhow!("No path found")
        })?;

        let quote_id = format!("q_{}", Uuid::new_v4().simple());

        Ok(QuoteResponse {
            quote_id,
            path: best_path,
            expires_at: Utc::now() + Duration::seconds(self.config.quote_expiry_secs as i64),
        })
    }

    /// Generate a multi-path quote returning the top-3 aggregated paths.
    ///
    /// Same-chain requests delegate to the router's existing path finder.
    /// Cross-chain requests use the [`LiquidityAggregator`] to compare routes
    /// across all enabled intermediate chains.
    pub async fn quote_multi(&self, req: &QuoteRequest) -> Result<MultiPathQuote> {
        info!(
            "Multi-path quote: {} {} → {} {} (amount: {})",
            req.src_chain, req.src_token,
            req.dest_chain, req.dest_token,
            req.amount
        );

        let src_token = resolve_token(req.src_chain, &req.src_token);
        let dest_token = resolve_token(req.dest_chain, &req.dest_token);

        let paths: Vec<AggregatedPath> = if req.src_chain == req.dest_chain {
            // Same-chain: use the router's existing path finder and convert.
            let swap_paths = self.router.find_paths(
                req.src_chain,
                &src_token,
                req.dest_chain,
                &dest_token,
                &req.amount,
            ).await?;
            swap_paths.into_iter().map(|sp| swap_path_to_aggregated(&sp)).collect()
        } else {
            // Cross-chain: use the liquidity aggregator.
            let mut agg = self.aggregator.lock().await;
            agg.find_optimal_paths(
                req.src_chain,
                &src_token,
                req.dest_chain,
                &dest_token,
                &req.amount,
            ).await?
        };

        if paths.is_empty() {
            anyhow::bail!("No path found");
        }

        let quote_id = format!("qmp_{}", Uuid::new_v4().simple());

        Ok(MultiPathQuote {
            quote_id,
            input_token: src_token,
            input_amount: req.amount.clone(),
            output_token: dest_token,
            recommended_path_index: 0,
            paths,
            expiry: Utc::now() + Duration::seconds(self.config.quote_expiry_secs as i64),
        })
    }

    /// Validate that a quote is still valid (not expired)
    pub fn is_valid(&self, quote: &QuoteResponse) -> bool {
        Utc::now() < quote.expires_at
    }
}

/// Convert a [`SwapPath`] (single-path router output) into an [`AggregatedPath`]
/// so the multi-path quote has a uniform shape.
fn swap_path_to_aggregated(sp: &SwapPath) -> AggregatedPath {
    let total_output: f64 = sp.expected_output.parse().unwrap_or(0.0);
    let bridge_hops = sp.steps.iter().filter(|s| matches!(s, SwapStep::Bridge { .. })).count() as u8;
    AggregatedPath {
        steps: sp.steps.clone(),
        total_output,
        total_fee_bps: sp.total_fee_bps as u64,
        estimated_time_secs: sp.estimated_time_secs,
        bridge_hops,
    }
}

/// Resolve a token symbol string to a TokenId
fn resolve_token(chain: ChainId, symbol: &str) -> TokenId {
    match symbol.to_uppercase().as_str() {
        "ZION" => TokenId::zion(),
        "WZION" => TokenId::wzion(chain),
        "USDT" => TokenId::usdt(chain),
        "USDC" => TokenId::usdc(chain),
        "WETH" | "ETH" => TokenId::weth(),
        // If it looks like an address, treat it as a token
        s if s.starts_with("0x") || s.starts_with("zion1") => TokenId::Token {
            chain,
            address: s.to_string(),
            symbol: "UNKNOWN".into(),
            decimals: chain.decimals(),
        },
        _ => TokenId::Native { chain, symbol: symbol.to_string() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_quote_same_chain() {
        let engine = QuoteEngine::new(RouterConfig::default());
        let req = QuoteRequest {
            src_chain: ChainId::Base,
            src_token: "wZION".into(),
            dest_chain: ChainId::Base,
            dest_token: "USDT".into(),
            amount: "1000".into(),
        };
        let result = engine.quote(&req).await;
        assert!(result.is_ok(), "Quote should succeed: {:?}", result);
        let quote = result.unwrap();
        assert!(!quote.quote_id.is_empty());
        assert!(!quote.path.steps.is_empty());
    }

    #[tokio::test]
    async fn test_quote_cross_chain() {
        let engine = QuoteEngine::new(RouterConfig::default());
        let req = QuoteRequest {
            src_chain: ChainId::Zion,
            src_token: "ZION".into(),
            dest_chain: ChainId::Base,
            dest_token: "wZION".into(),
            amount: "1000".into(),
        };
        let result = engine.quote(&req).await;
        assert!(result.is_ok(), "Cross-chain quote should succeed: {:?}", result);
    }

    #[tokio::test]
    async fn test_quote_multi_cross_chain() {
        let engine = QuoteEngine::new(RouterConfig::default());
        let req = QuoteRequest {
            src_chain: ChainId::Zion,
            src_token: "ZION".into(),
            dest_chain: ChainId::Base,
            dest_token: "wZION".into(),
            amount: "1000".into(),
        };
        let result = engine.quote_multi(&req).await;
        assert!(result.is_ok(), "Multi-path quote should succeed: {:?}", result);
        let mq = result.unwrap();
        assert!(!mq.paths.is_empty(), "should return at least one path");
        assert!(mq.recommended_path_index < mq.paths.len());
        // Paths are sorted by output descending.
        for w in mq.paths.windows(2) {
            assert!(w[0].total_output >= w[1].total_output, "paths not sorted by output");
        }
    }

    #[tokio::test]
    async fn test_quote_multi_same_chain() {
        let engine = QuoteEngine::new(RouterConfig::default());
        let req = QuoteRequest {
            src_chain: ChainId::Base,
            src_token: "wZION".into(),
            dest_chain: ChainId::Base,
            dest_token: "USDT".into(),
            amount: "1000".into(),
        };
        let result = engine.quote_multi(&req).await;
        assert!(result.is_ok(), "Same-chain multi quote should succeed: {:?}", result);
    }

    #[test]
    fn test_resolve_token() {
        let t = resolve_token(ChainId::Base, "wZION");
        assert_eq!(t.symbol(), "wZION");

        let t = resolve_token(ChainId::Zion, "ZION");
        assert_eq!(t.symbol(), "ZION");

        let t = resolve_token(ChainId::Base, "USDT");
        assert_eq!(t.symbol(), "USDT");
    }
}
