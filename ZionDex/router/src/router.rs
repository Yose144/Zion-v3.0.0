use crate::aggregator::LiquidityAggregator;
use crate::config::RouterConfig;
use crate::price::PriceFeed;
use crate::types::*;
use anyhow::Result;
use tracing::{debug, info};

/// The core path-finding router
pub struct Router {
    config: RouterConfig,
    price_feed: PriceFeed,
    aggregator: tokio::sync::Mutex<LiquidityAggregator>,
}

impl Router {
    pub fn new(config: RouterConfig) -> Self {
        let price_feed = PriceFeed::new(config.clone());
        let aggregator = LiquidityAggregator::new(config.clone());
        Self {
            config,
            price_feed,
            aggregator: tokio::sync::Mutex::new(aggregator),
        }
    }

    /// Find the best swap path from src to dest
    ///
    /// Algorithm:
    /// 1. Direct same-chain swap (if src_chain == dest_chain)
    /// 2. Single bridge (if src_token == dest_token, just bridge)
    /// 3. Swap → Bridge → Swap (cross-chain)
    /// 4. Bridge → Swap (if dest_token exists on src_chain)
    /// 5. Swap → Bridge (if src_token exists on dest_chain)
    ///
    /// Returns top 3 paths sorted by expected output
    pub async fn find_paths(
        &self,
        src_chain: ChainId,
        src_token: &TokenId,
        dest_chain: ChainId,
        dest_token: &TokenId,
        amount: &str,
    ) -> Result<Vec<SwapPath>> {
        info!(
            "Finding paths: {} {} → {} {} (amount: {})",
            src_chain, src_token.symbol(),
            dest_chain, dest_token.symbol(),
            amount
        );

        let mut paths = Vec::new();

        // Case 1: Same chain, same token — no-op
        if src_chain == dest_chain && src_token == dest_token {
            return Ok(vec![SwapPath {
                steps: vec![],
                expected_output: amount.to_string(),
                min_output: amount.to_string(),
                total_fee_bps: 0,
                estimated_time_secs: 0,
                price_impact_bps: 0,
            }]);
        }

        // Case 2: Same chain — direct swap
        if src_chain == dest_chain {
            if let Some(path) = self.try_same_chain_swap(src_chain, src_token, dest_token, amount).await? {
                paths.push(path);
            }
        }

        // Cross-chain: delegate to the liquidity aggregator, which compares
        // routes across all enabled intermediate chains (e.g. via Base vs
        // Arbitrum vs direct USDC bridge) and returns the top paths by output.
        if src_chain != dest_chain {
            match self.find_cross_chain_paths(src_chain, src_token, dest_chain, dest_token, amount).await {
                Ok(agg_paths) => {
                    for ap in agg_paths {
                        paths.push(ap.to_swap_path(self.config.default_slippage_bps));
                    }
                }
                Err(e) => {
                    debug!("Aggregator found no cross-chain paths ({}); falling back to heuristics", e);
                    // Fallback to the legacy single-path heuristics below.
                }
            }
        }

        // Legacy fallback heuristics (only add if the aggregator returned nothing).
        if src_chain != dest_chain && paths.is_empty() {
            // Case 3: Single bridge (same token or bridge-equivalent, different chain)
            if is_bridge_equivalent(src_token, dest_token, src_chain, dest_chain) {
                if let Some(path) = self.try_bridge_only(src_chain, dest_chain, src_token, amount).await? {
                    paths.push(path);
                }
            }

            // Case 4: Swap → Bridge → Swap (general cross-chain)
            if let Some(path) = self.try_swap_bridge_swap(src_chain, src_token, dest_chain, dest_token, amount).await? {
                paths.push(path);
            }

            // Case 5: Bridge → Swap (bridge ZION, then swap on dest chain)
            if src_token == &TokenId::zion() {
                if let Some(path) = self.try_bridge_swap(src_chain, dest_chain, dest_token, amount).await? {
                    paths.push(path);
                }
            }

            // Case 6: Swap → Bridge (swap to ZION, then bridge)
            if dest_token == &TokenId::zion() {
                if let Some(path) = self.try_swap_bridge(src_chain, dest_chain, src_token, amount).await? {
                    paths.push(path);
                }
            }
        }

        // Sort by expected output (descending) and take top 3
        paths.sort_by(|a, b| {
            b.expected_output
                .parse::<f64>()
                .unwrap_or(0.0)
                .partial_cmp(&a.expected_output.parse::<f64>().unwrap_or(0.0))
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        paths.truncate(3);

        if paths.is_empty() {
            anyhow::bail!(
                "No path found: {} {} → {} {}",
                src_chain, src_token.symbol(),
                dest_chain, dest_token.symbol()
            );
        }

        debug!("Found {} paths", paths.len());
        Ok(paths)
    }

    /// Find cross-chain paths via the [`LiquidityAggregator`].
    ///
    /// Returns the aggregator's top-3 ranked paths. The caller is responsible
    /// for converting [`crate::aggregator::AggregatedPath`] into [`SwapPath`]s.
    async fn find_cross_chain_paths(
        &self,
        src_chain: ChainId,
        src_token: &TokenId,
        dest_chain: ChainId,
        dest_token: &TokenId,
        amount: &str,
    ) -> Result<Vec<crate::aggregator::AggregatedPath>> {
        let mut agg = self.aggregator.lock().await;
        agg.find_optimal_paths(src_chain, src_token, dest_chain, dest_token, amount).await
    }

    /// Try a same-chain swap
    async fn try_same_chain_swap(
        &self,
        chain: ChainId,
        from_token: &TokenId,
        to_token: &TokenId,
        amount: &str,
    ) -> Result<Option<SwapPath>> {
        // Check if any DEX on this chain has a pool for this pair
        let pool = self.config.find_pool(chain, from_token.symbol(), to_token.symbol());
        if pool.is_none() {
            return Ok(None);
        }

        let pool = pool.unwrap();
        let fee_bps = pool.fee_bps;
        let dex_id = pool_dex(chain);

        let amount_f: f64 = amount.parse().unwrap_or(0.0);

        // Try to fetch real price from pool slot0
        let (expected_out, price_impact) = match self.price_feed.fetch_uniswap_v3_price(chain, &pool.address).await {
            Ok(price_info) => {
                // Use real price from pool
                // price = token1/token0 — need to determine direction
                let price = price_info.price;
                // Adjust for token ordering (pool might be token0=USDT, token1=wZION)
                let effective_price = if from_token.symbol().to_uppercase() == pool.token_a.to_uppercase() {
                    // Selling token_a → buying token_b → price is token_b/token_a
                    // If pool price = token1/token0 and token_a = token0, then price = token_b/token_a
                    price
                } else {
                    // Selling token_b → buying token_a → invert price
                    if price > 0.0 { 1.0 / price } else { 0.0 }
                };

                let gross_out = amount_f * effective_price;
                let net_out = gross_out * (1.0 - fee_bps as f64 / 10000.0);

                // Estimate price impact based on liquidity
                let impact = if price_info.liquidity > 0 {
                    let liq_f = price_info.liquidity as f64;
                    ((amount_f / liq_f) * 10000.0) as u16
                } else {
                    50 // default 0.5%
                };

                info!("Real price for {}/{} on {}: price={}, out={}",
                    from_token.symbol(), to_token.symbol(), chain, effective_price, net_out);
                (net_out, impact.min(1000))
            }
            Err(e) => {
                debug!("Using fallback price for {}/{} on {}: {}",
                    from_token.symbol(), to_token.symbol(), chain, e);
                // Fallback: conservative ratio with fee
                let expected_out = amount_f * (1.0 - fee_bps as f64 / 10000.0);
                (expected_out, 50)
            }
        };

        let min_out = expected_out * (1.0 - self.config.default_slippage_bps as f64 / 10000.0);

        Ok(Some(SwapPath {
            steps: vec![SwapStep::SameChainSwap {
                chain,
                dex: dex_id,
                from_token: from_token.clone(),
                to_token: to_token.clone(),
                amount_in: amount.to_string(),
                expected_amount_out: format!("{:.6}", expected_out),
                fee_bps,
            }],
            expected_output: format!("{:.6}", expected_out),
            min_output: format!("{:.6}", min_out),
            total_fee_bps: fee_bps,
            estimated_time_secs: 10,
            price_impact_bps: price_impact,
        }))
    }

    /// Try a bridge-only path (same token, different chain)
    async fn try_bridge_only(
        &self,
        from_chain: ChainId,
        to_chain: ChainId,
        asset: &TokenId,
        amount: &str,
    ) -> Result<Option<SwapPath>> {
        let bridge_fee = self.config.bridge_fee_bps;
        let amount_f: f64 = amount.parse().unwrap_or(0.0);
        let expected_out = amount_f * (1.0 - bridge_fee as f64 / 10000.0);
        let min_out = expected_out * 0.99;

        Ok(Some(SwapPath {
            steps: vec![SwapStep::Bridge {
                from_chain,
                to_chain,
                asset: asset.clone(),
                amount: amount.to_string(),
                fee_bps: bridge_fee,
                estimated_time_secs: estimate_bridge_time(from_chain, to_chain),
            }],
            expected_output: format!("{:.6}", expected_out),
            min_output: format!("{:.6}", min_out),
            total_fee_bps: bridge_fee,
            estimated_time_secs: estimate_bridge_time(from_chain, to_chain),
            price_impact_bps: 0,
        }))
    }

    /// Try swap → bridge → swap (general cross-chain)
    async fn try_swap_bridge_swap(
        &self,
        src_chain: ChainId,
        src_token: &TokenId,
        dest_chain: ChainId,
        dest_token: &TokenId,
        amount: &str,
    ) -> Result<Option<SwapPath>> {
        // Path: src_token → ZION (on src_chain) → bridge → wZION (on dest_chain) → dest_token
        let zion_on_src = TokenId::Native { chain: src_chain, symbol: "ZION".into() };
        let wzion_on_dest = TokenId::wzion(dest_chain);

        // Step 1: Swap src_token → ZION on src_chain
        let swap1 = self.try_same_chain_swap(src_chain, src_token, &zion_on_src, amount).await?;
        // Step 2: Bridge ZION → wZION
        let bridge_amount = swap1.as_ref().map(|p| p.expected_output.clone()).unwrap_or_else(|| amount.to_string());
        let bridge = self.try_bridge_only(src_chain, dest_chain, &zion_on_src, &bridge_amount).await?;
        // Step 3: Swap wZION → dest_token on dest_chain
        let swap2_amount = bridge.as_ref().map(|p| p.expected_output.clone()).unwrap_or_else(|| bridge_amount.clone());
        let swap2 = self.try_same_chain_swap(dest_chain, &wzion_on_dest, dest_token, &swap2_amount).await?;

        if swap1.is_none() || bridge.is_none() || swap2.is_none() {
            return Ok(None);
        }

        let mut steps = Vec::new();
        let mut total_fee = 0u16;
        let mut total_time = 0u64;

        for path in [swap1.unwrap(), bridge.unwrap(), swap2.unwrap()] {
            total_fee += path.total_fee_bps;
            total_time += path.estimated_time_secs;
            steps.extend(path.steps);
        }

        let final_out = steps.last()
            .and_then(|s| match s {
                SwapStep::SameChainSwap { expected_amount_out, .. } => Some(expected_amount_out.clone()),
                _ => None,
            })
            .unwrap_or_else(|| "0".into());

        Ok(Some(SwapPath {
            steps,
            expected_output: final_out.clone(),
            min_output: format!("{:.6}", final_out.parse::<f64>().unwrap_or(0.0) * 0.97),
            total_fee_bps: total_fee,
            estimated_time_secs: total_time,
            price_impact_bps: 100,
        }))
    }

    /// Try bridge → swap (ZION → bridge → wZION → swap to dest_token)
    async fn try_bridge_swap(
        &self,
        src_chain: ChainId,
        dest_chain: ChainId,
        dest_token: &TokenId,
        amount: &str,
    ) -> Result<Option<SwapPath>> {
        let zion = TokenId::zion();
        let wzion_on_dest = TokenId::wzion(dest_chain);

        let bridge = self.try_bridge_only(src_chain, dest_chain, &zion, amount).await?;
        let bridge_amount = bridge.as_ref().map(|p| p.expected_output.clone()).unwrap_or_else(|| amount.to_string());
        let swap = self.try_same_chain_swap(dest_chain, &wzion_on_dest, dest_token, &bridge_amount).await?;

        if bridge.is_none() || swap.is_none() {
            return Ok(None);
        }

        let mut steps = Vec::new();
        let mut total_fee = 0u16;
        let mut total_time = 0u64;

        for path in [bridge.unwrap(), swap.unwrap()] {
            total_fee += path.total_fee_bps;
            total_time += path.estimated_time_secs;
            steps.extend(path.steps);
        }

        let final_out = steps.last()
            .and_then(|s| match s {
                SwapStep::SameChainSwap { expected_amount_out, .. } => Some(expected_amount_out.clone()),
                _ => None,
            })
            .unwrap_or_else(|| "0".into());

        Ok(Some(SwapPath {
            steps,
            expected_output: final_out.clone(),
            min_output: format!("{:.6}", final_out.parse::<f64>().unwrap_or(0.0) * 0.97),
            total_fee_bps: total_fee,
            estimated_time_secs: total_time,
            price_impact_bps: 80,
        }))
    }

    /// Try swap → bridge (swap to ZION on src_chain, then bridge to dest)
    async fn try_swap_bridge(
        &self,
        src_chain: ChainId,
        dest_chain: ChainId,
        src_token: &TokenId,
        amount: &str,
    ) -> Result<Option<SwapPath>> {
        let zion_on_src = TokenId::Native { chain: src_chain, symbol: "ZION".into() };

        let swap = self.try_same_chain_swap(src_chain, src_token, &zion_on_src, amount).await?;
        let swap_amount = swap.as_ref().map(|p| p.expected_output.clone()).unwrap_or_else(|| amount.to_string());
        let bridge = self.try_bridge_only(src_chain, dest_chain, &zion_on_src, &swap_amount).await?;

        if swap.is_none() || bridge.is_none() {
            return Ok(None);
        }

        let mut steps = Vec::new();
        let mut total_fee = 0u16;
        let mut total_time = 0u64;

        for path in [swap.unwrap(), bridge.unwrap()] {
            total_fee += path.total_fee_bps;
            total_time += path.estimated_time_secs;
            steps.extend(path.steps);
        }

        let final_out = steps.last()
            .and_then(|s| match s {
                SwapStep::Bridge { amount, .. } => Some(amount.clone()),
                _ => None,
            })
            .unwrap_or_else(|| "0".into());

        Ok(Some(SwapPath {
            steps,
            expected_output: final_out.clone(),
            min_output: format!("{:.6}", final_out.parse::<f64>().unwrap_or(0.0) * 0.97),
            total_fee_bps: total_fee,
            estimated_time_secs: total_time,
            price_impact_bps: 80,
        }))
    }
}

/// Check if two tokens are bridge-equivalent (ZION native ↔ wZION ERC-20)
fn is_bridge_equivalent(src: &TokenId, dest: &TokenId, src_chain: ChainId, dest_chain: ChainId) -> bool {
    // Same token on different chains
    if src == dest {
        return true;
    }
    // ZION (native L1) ↔ wZION (EVM) — same asset, different representation
    let src_is_zion = matches!(src, TokenId::Native { symbol, chain: _ } if symbol.eq_ignore_ascii_case("ZION"));
    let dest_is_wzion = matches!(dest, TokenId::Token { symbol, .. } if symbol.eq_ignore_ascii_case("wZION"));
    let src_is_wzion = matches!(src, TokenId::Token { symbol, .. } if symbol.eq_ignore_ascii_case("wZION"));
    let dest_is_zion = matches!(dest, TokenId::Native { symbol, chain: _ } if symbol.eq_ignore_ascii_case("ZION"));

    (src_is_zion && dest_is_wzion) || (src_is_wzion && dest_is_zion)
}

/// Estimate bridge time between chains (in seconds)
fn estimate_bridge_time(from: ChainId, to: ChainId) -> u64 {
    match (from, to) {
        // ZION L1 → EVM: lock + validator confirm + mint
        (ChainId::Zion, _) | (_, ChainId::Zion) => 120,  // ~2 min
        // EVM → EVM: burn + unlock + mint
        _ => 180,  // ~3 min
    }
}

/// Get the DEX ID for a pool on a chain
fn pool_dex(chain: ChainId) -> DexId {
    match chain {
        ChainId::Base => DexId::UniswapV3,
        ChainId::Bsc => DexId::PancakeSwap,
        ChainId::Polygon => DexId::QuickSwap,
        ChainId::Arbitrum => DexId::UniswapV3,
        ChainId::Optimism => DexId::UniswapV3,
        ChainId::Avalanche => DexId::TraderJoe,
        ChainId::Solana => DexId::Raydium,
        _ => DexId::UniswapV3,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_same_chain_same_token() {
        let router = Router::new(RouterConfig::default());
        let wzion = TokenId::wzion(ChainId::Base);
        let paths = router.find_paths(ChainId::Base, &wzion, ChainId::Base, &wzion, "100").await.unwrap();
        assert_eq!(paths.len(), 1);
        assert!(paths[0].steps.is_empty());
    }

    #[tokio::test]
    async fn test_same_chain_swap() {
        let router = Router::new(RouterConfig::default());
        let wzion = TokenId::wzion(ChainId::Base);
        let usdt = TokenId::usdt(ChainId::Base);
        let paths = router.find_paths(ChainId::Base, &wzion, ChainId::Base, &usdt, "1000").await.unwrap();
        assert!(!paths.is_empty());
        assert!(!paths[0].steps.is_empty());
    }

    #[tokio::test]
    async fn test_bridge_only() {
        let router = Router::new(RouterConfig::default());
        let zion = TokenId::zion();
        let wzion_base = TokenId::wzion(ChainId::Base);
        // ZION on L1 → wZION on Base is a bridge
        let paths = router.find_paths(ChainId::Zion, &zion, ChainId::Base, &wzion_base, "1000").await.unwrap();
        assert!(!paths.is_empty());
    }
}
