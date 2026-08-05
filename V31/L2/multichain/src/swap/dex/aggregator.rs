//! Cross-chain liquidity aggregator (adapted from archive/ZionDex/router/src/aggregator.rs).
//!
//! The archive aggregator built a unified liquidity graph across all
//! WARP-enabled chains and used Dijkstra to find the optimal swap path
//! across AMM pools and bridge edges.  This V31 implementation reuses the
//! existing `DexRouter` (which already supports bridge pools as synthetic
//! 1:1 pools) and adds a `BridgeRegistry` so cross-chain routes can be
//! discovered automatically.

use zion_l1_types::{Amount, Asset, AssetId};

use crate::error::{MultichainError, MultichainResult};
use crate::swap::dex::intent::PathHop;
use crate::swap::dex::{DexRouter, Quote};

/// A bridgeable asset pair with the fee charged by the bridge.
#[derive(Debug, Clone)]
pub struct BridgeEdge {
    pub from: AssetId,
    pub to: AssetId,
    pub fee_bps: u16,
}

/// A path through AMM and bridge hops returned by the aggregator.
#[derive(Debug, Clone)]
pub struct CrossChainPath {
    pub hops: Vec<PathHop>,
    pub expected_out: Amount,
    pub total_fee_bps: u16,
}

/// Registry of known cross-chain bridge edges.
#[derive(Debug, Clone, Default)]
pub struct BridgeRegistry {
    edges: Vec<BridgeEdge>,
}

impl BridgeRegistry {
    pub fn new() -> Self {
        Self { edges: Vec::new() }
    }

    pub fn add(&mut self, edge: BridgeEdge) {
        self.edges.push(edge);
    }

    pub fn contains(&self, from: &AssetId, to: &AssetId) -> bool {
        self.edges
            .iter()
            .any(|e| e.from == *from && e.to == *to)
    }

    pub fn edges(&self) -> &[BridgeEdge] {
        &self.edges
    }
}

/// Aggregates AMM liquidity and bridge edges to find cross-chain swap paths.
#[derive(Debug, Clone)]
pub struct Aggregator {
    dex: DexRouter,
    bridges: BridgeRegistry,
}

impl Aggregator {
    pub fn new(dex: DexRouter) -> Self {
        Self {
            dex,
            bridges: BridgeRegistry::new(),
        }
    }

    pub fn with_registry(mut self, registry: BridgeRegistry) -> Self {
        self.bridges = registry;
        self
    }

    pub fn add_bridge(&mut self, edge: BridgeEdge) {
        self.bridges.add(edge);
    }

    pub fn bridge_registry(&self) -> &BridgeRegistry {
        &self.bridges
    }

    /// Find the best path from `from` to `to` for `amount`, considering both
    /// AMM hops and bridge hops.  Returns the best path as `CrossChainPath`.
    pub fn find_best_path(
        &self,
        from: &Asset,
        to: &Asset,
        amount: Amount,
    ) -> MultichainResult<CrossChainPath> {
        let mut dex = self.dex.clone();
        self.inject_bridge_pools(&mut dex);

        let quotes = dex.quote_multi(from, to, amount, 1, 4)?;
        let best = quotes.into_iter().next().ok_or_else(|| {
            MultichainError::Unsupported(format!("no route from {} to {}", from.id, to.id))
        })?;

        let hops = route_to_hops(&best.route, &self.bridges)?;
        Ok(CrossChainPath {
            hops,
            expected_out: best.expected_out,
            total_fee_bps: best.total_fee_bps,
        })
    }

    /// Return a regular `DexRouter` quote that includes bridge edges.
    pub fn quote(&self, from: &Asset, to: &Asset, amount: Amount) -> MultichainResult<Quote> {
        let mut dex = self.dex.clone();
        self.inject_bridge_pools(&mut dex);
        dex.quote(from, to, amount)
    }

    fn inject_bridge_pools(&self, dex: &mut DexRouter) {
        for (i, edge) in self.bridges.edges().iter().enumerate() {
            let from = Asset::native(edge.from.chain, &edge.from.ticker, 6, &edge.from.ticker);
            let to = Asset::native(edge.to.chain, &edge.to.ticker, 6, &edge.to.ticker);
            // Synthetic pool id starting at a high range to avoid collisions.
            let id = u64::MAX - i as u64;
            dex.add_bridge_pool(id, from, to, edge.fee_bps);
        }
    }
}

fn route_to_hops(
    route: &[AssetId],
    registry: &BridgeRegistry,
) -> MultichainResult<Vec<PathHop>> {
    if route.len() < 2 {
        return Err(MultichainError::Validation("route too short".to_string()));
    }

    let mut hops = Vec::with_capacity(route.len() - 1);
    for window in route.windows(2) {
        let (from, to) = (&window[0], &window[1]);
        let is_bridge = registry.contains(from, to);
        let dex = if is_bridge { "warp" } else { "amm" };
        hops.push(PathHop {
            chain: from.chain.as_str().to_string(),
            dex: dex.to_string(),
            from_token: from.clone(),
            to_token: to.clone(),
            is_bridge,
        });
    }
    Ok(hops)
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::{Asset, ChainId};

    fn zion_usdc_pool() -> crate::swap::dex::Pool {
        crate::swap::dex::Pool {
            id: 1,
            asset_a: Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            asset_b: Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin"),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
        }
    }

    #[test]
    fn same_chain_aggregator_finds_direct_amm_path() {
        let dex = DexRouter::new();
        let mut dex = dex;
        dex.add_pool(zion_usdc_pool());

        let agg = Aggregator::new(dex);
        let from = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let to = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");
        let path = agg.find_best_path(&from, &to, Amount::new(1_000_000)).unwrap();

        assert_eq!(path.hops.len(), 1);
        assert!(!path.hops[0].is_bridge);
        assert_eq!(path.hops[0].from_token.ticker, "ZION");
        assert_eq!(path.hops[0].to_token.ticker, "USDC");
        assert!(path.expected_out.0 > 0);
    }

    #[test]
    fn cross_chain_aggregator_uses_bridge_edge() {
        let mut dex = DexRouter::new();
        dex.add_pool(zion_usdc_pool());

        let mut registry = BridgeRegistry::new();
        let bridge = BridgeEdge {
            from: AssetId::new(ChainId::ZionL1, "USDC", None),
            to: AssetId::new(ChainId::Base, "wUSDC", None),
            fee_bps: 10,
        };
        registry.add(bridge);

        let agg = Aggregator::new(dex).with_registry(registry);
        let from = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let to = Asset::native(ChainId::Base, "wUSDC", 6, "Wrapped USDC");
        let path = agg.find_best_path(&from, &to, Amount::new(1_000_000)).unwrap();

        assert_eq!(path.hops.len(), 2);
        assert!(!path.hops[0].is_bridge);
        assert!(path.hops[1].is_bridge);
        assert_eq!(path.hops[1].from_token.ticker, "USDC");
        assert_eq!(path.hops[1].to_token.ticker, "wUSDC");
    }
}
