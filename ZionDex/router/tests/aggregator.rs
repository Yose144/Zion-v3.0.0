//! Integration tests for the cross-chain liquidity aggregator.
//!
//! These tests run against the default [`RouterConfig`] (which registers
//! Base/Arbitrum/Solana/… chains and a few Uniswap V3 pools on Base). The
//! WARP bridge API is expected to be offline in CI, so the aggregator falls
//! back to the config chain registry — making the tests deterministic.

use ziondex_router::aggregator::{LiquidityAggregator, PoolLiquidity};
use ziondex_router::config::RouterConfig;
use ziondex_router::types::{ChainId, SwapStep, TokenId};

/// Helper: build an aggregator from the default config.
fn make_aggregator() -> LiquidityAggregator {
    LiquidityAggregator::new(RouterConfig::default())
}

#[tokio::test]
async fn test_graph_building_with_config_chains() {
    let agg = make_aggregator();
    let graph = agg.fetch_liquidity_graph().await.expect("graph build");

    // Chains fall back to the config DEX registry (+ ZION L1).
    assert!(graph.chains.contains(&ChainId::Zion), "ZION L1 must be present");
    assert!(graph.chains.contains(&ChainId::Base), "Base must be present");
    assert!(graph.chains.contains(&ChainId::Arbitrum), "Arbitrum must be present");

    // Bridge edges exist between distinct chains for each bridgeable asset.
    assert!(
        graph.edges.contains_key(&(ChainId::Zion, ChainId::Base)),
        "ZION→Base bridge edge missing"
    );
    assert!(
        graph.edges.contains_key(&(ChainId::Base, ChainId::Arbitrum)),
        "Base→Arbitrum bridge edge missing"
    );
    // No self-edges.
    assert!(!graph.edges.contains_key(&(ChainId::Base, ChainId::Base)));

    // The enabled Base wZION/USDT pool is registered (canonicalised to ZION/USDT).
    let pool_key = (ChainId::Base, "ZION".to_string(), "USDT".to_string());
    let pool: &PoolLiquidity = graph
        .pools
        .get(&pool_key)
        .expect("wZION/USDT pool should be registered on Base");
    assert_eq!(pool.fee_bps, 30, "wZION/USDT Uniswap V3 fee is 30 bps");
}

#[tokio::test]
async fn test_bridge_only_single_hop() {
    // ZION (L1) → wZION (Base): a single WARP bridge hop.
    let mut agg = make_aggregator();
    let zion = TokenId::zion();
    let wzion_base = TokenId::wzion(ChainId::Base);

    let paths = agg
        .find_optimal_paths(ChainId::Zion, &zion, ChainId::Base, &wzion_base, "1000")
        .await
        .expect("should find bridge path");

    assert!(!paths.is_empty());
    let best = &paths[0];
    assert_eq!(best.steps.len(), 1, "best path should be a single bridge hop");
    assert_eq!(best.bridge_hops, 1);
    // Bridge fee is 50 bps → output = 1000 * 0.995 = 995.
    assert!(
        (best.total_output - 995.0).abs() < 1e-6,
        "expected ~995 output, got {}",
        best.total_output
    );
    assert!(matches!(best.steps[0], SwapStep::Bridge { .. }));
}

#[tokio::test]
async fn test_two_hop_bridge_then_swap() {
    // ZION (L1) → wZION (Base) → USDT (Base): bridge + swap = 2 hops.
    let mut agg = make_aggregator();
    let zion = TokenId::zion();
    let usdt_base = TokenId::usdt(ChainId::Base);

    let paths = agg
        .find_optimal_paths(ChainId::Zion, &zion, ChainId::Base, &usdt_base, "1000")
        .await
        .expect("should find bridge+swap path");

    assert!(!paths.is_empty());
    let best = &paths[0];
    assert_eq!(best.steps.len(), 2, "best path should be 2 hops");
    assert_eq!(best.bridge_hops, 1, "exactly one bridge hop");
    // Fees: bridge 50 bps + wZION/USDT swap 30 bps = 80 bps.
    assert_eq!(best.total_fee_bps, 80, "total fee should be 80 bps");
    // Step ordering: bridge first, then swap.
    assert!(matches!(best.steps[0], SwapStep::Bridge { .. }));
    assert!(matches!(best.steps[1], SwapStep::SameChainSwap { .. }));
}

#[tokio::test]
async fn test_three_hop_route_exists() {
    // ZION (L1) → USDT (Base): the optimal is 2 hops, but 3-hop variants
    // (via an intermediate chain) should also be enumerated and returned.
    let mut agg = make_aggregator();
    let zion = TokenId::zion();
    let usdt_base = TokenId::usdt(ChainId::Base);

    let paths = agg
        .find_optimal_paths(ChainId::Zion, &zion, ChainId::Base, &usdt_base, "1000")
        .await
        .expect("should find paths");

    // The best path is the 2-hop bridge+swap.
    assert_eq!(paths[0].steps.len(), 2);
    assert_eq!(paths[0].bridge_hops, 1);

    // At least one returned path should be a 3-hop route (2 bridges + 1 swap).
    let three_hop = paths.iter().find(|p| p.steps.len() == 3);
    assert!(
        three_hop.is_some(),
        "expected at least one 3-hop path, got step counts: {:?}",
        paths.iter().map(|p| p.steps.len()).collect::<Vec<_>>()
    );
    let th = three_hop.unwrap();
    assert_eq!(th.bridge_hops, 2, "3-hop path should have 2 bridge hops");
    // Fees: 50 + 50 + 30 = 130 bps.
    assert_eq!(th.total_fee_bps, 130);
}

#[tokio::test]
async fn test_fee_calculation_across_hops() {
    // Verify total_fee_bps equals the sum of per-step fees.
    let mut agg = make_aggregator();
    let zion = TokenId::zion();
    let usdt_base = TokenId::usdt(ChainId::Base);

    let paths = agg
        .find_optimal_paths(ChainId::Zion, &zion, ChainId::Base, &usdt_base, "1000")
        .await
        .expect("should find paths");

    for p in &paths {
        let summed: u64 = p.steps.iter().map(|s| s.fee_bps() as u64).sum();
        assert_eq!(
            p.total_fee_bps, summed,
            "total_fee_bps {} != sum of step fees {}",
            p.total_fee_bps, summed
        );
    }
}

#[tokio::test]
async fn test_aggregator_picks_highest_output() {
    // ZION (L1) → wZION (Base): the direct 1-hop bridge must rank above any
    // multi-hop bridge variant (which pays more fees).
    let mut agg = make_aggregator();
    let zion = TokenId::zion();
    let wzion_base = TokenId::wzion(ChainId::Base);

    let paths = agg
        .find_optimal_paths(ChainId::Zion, &zion, ChainId::Base, &wzion_base, "1000")
        .await
        .expect("should find paths");

    assert!(paths.len() >= 1, "should return at least one path");
    // Paths are sorted by output descending.
    for w in paths.windows(2) {
        assert!(
            w[0].total_output >= w[1].total_output,
            "paths not sorted by output: {} then {}",
            w[0].total_output,
            w[1].total_output
        );
    }
    // The top path is the single direct bridge (highest output).
    assert_eq!(paths[0].steps.len(), 1);
    assert!((paths[0].total_output - 995.0).abs() < 1e-6);

    // Any longer path must have strictly lower output.
    for p in paths.iter().skip(1) {
        assert!(
            p.total_output < paths[0].total_output,
            "non-best path should have lower output"
        );
    }
}

#[tokio::test]
async fn test_compare_paths_ranks_by_output() {
    let agg = make_aggregator();
    use ziondex_router::aggregator::{AggregatedPath, PathStep};

    // Construct three synthetic paths with known outputs.
    let mk = |output: f64, fee: u64, time: u64| AggregatedPath {
        steps: vec![],
        total_output: output,
        total_fee_bps: fee,
        estimated_time_secs: time,
        bridge_hops: 0,
    };
    let _ = PathStep::Bridge {
        from_chain: ChainId::Zion,
        to_chain: ChainId::Base,
        asset: TokenId::zion(),
        amount: "1".into(),
        fee_bps: 50,
        estimated_time_secs: 120,
    };

    let ranked = agg.compare_paths(vec![
        mk(100.0, 80, 200),
        mk(300.0, 80, 200),
        mk(200.0, 80, 200),
    ]);
    assert_eq!(ranked.len(), 3);
    assert!((ranked[0].total_output - 300.0).abs() < 1e-9);
    assert!((ranked[1].total_output - 200.0).abs() < 1e-9);
    assert!((ranked[2].total_output - 100.0).abs() < 1e-9);
}

#[tokio::test]
async fn test_same_chain_uses_aggregator_no_op() {
    // Same chain + same token → trivial no-op path with full amount.
    let mut agg = make_aggregator();
    let wzion = TokenId::wzion(ChainId::Base);
    let paths = agg
        .find_optimal_paths(ChainId::Base, &wzion, ChainId::Base, &wzion, "1000")
        .await
        .expect("no-op path");
    assert_eq!(paths.len(), 1);
    assert!(paths[0].steps.is_empty());
    assert!((paths[0].total_output - 1000.0).abs() < 1e-9);
    assert_eq!(paths[0].total_fee_bps, 0);
}
