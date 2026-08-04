//! DEX routing and settlement (ZionDex inside `zion-multichain`).
//!
//! The router operates over a constant-product AMM liquidity graph. Mainnet
//! Alpha supports direct swaps; multi-hop quotes are computed over one
//! intermediate pool when available.

use num_bigint::BigUint;
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use zion_l1_types::{Amount, Asset, AssetId};

use crate::error::{MultichainError, MultichainResult};

/// A single constant-product AMM pool.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Pool {
    pub id: u64,
    pub asset_a: Asset,
    pub asset_b: Asset,
    pub reserve_a: Amount,
    pub reserve_b: Amount,
    pub fee_bps: u16,
}

impl Pool {
    /// True if the pool contains the exact asset pair (in either direction).
    pub fn contains(&self, a: &AssetId, b: &AssetId) -> bool {
        (self.asset_a.id == *a && self.asset_b.id == *b)
            || (self.asset_a.id == *b && self.asset_b.id == *a)
    }

    fn quote_by_id(&self, from: &AssetId, to: &AssetId, amount: Amount) -> Option<Amount> {
        let (reserve_in, reserve_out) = self.reserves_for(from, to)?;
        compute_out(reserve_in, reserve_out, amount, self.fee_bps)
    }

    fn execute_by_id(&mut self, from: &AssetId, to: &AssetId, amount: Amount) -> Option<Amount> {
        let fee_bps = self.fee_bps;
        let (reserve_in, reserve_out) = self.reserves_mut_for(from, to)?;
        let out = compute_out(*reserve_in, *reserve_out, amount, fee_bps)?;
        *reserve_in = reserve_in.saturating_add(amount);
        *reserve_out = reserve_out.saturating_sub(out);
        Some(out)
    }

    fn reserves_for(&self, from: &AssetId, to: &AssetId) -> Option<(Amount, Amount)> {
        if self.asset_a.id == *from && self.asset_b.id == *to {
            Some((self.reserve_a, self.reserve_b))
        } else if self.asset_a.id == *to && self.asset_b.id == *from {
            Some((self.reserve_b, self.reserve_a))
        } else {
            None
        }
    }

    fn reserves_mut_for(
        &mut self,
        from: &AssetId,
        to: &AssetId,
    ) -> Option<(&mut Amount, &mut Amount)> {
        if self.asset_a.id == *from && self.asset_b.id == *to {
            Some((&mut self.reserve_a, &mut self.reserve_b))
        } else if self.asset_a.id == *to && self.asset_b.id == *from {
            Some((&mut self.reserve_b, &mut self.reserve_a))
        } else {
            None
        }
    }
}

/// A quote from the DEX router.
#[derive(Clone, Debug)]
pub struct Quote {
    /// Token/contract address path from `from` to `to`.
    pub route: Vec<AssetId>,
    pub expected_out: Amount,
    pub slippage_bps: u16,
    pub total_fee_bps: u16,
}

/// In-memory AMM router.
#[derive(Clone, Debug, Default)]
pub struct DexRouter {
    pools: Vec<Pool>,
}

impl DexRouter {
    pub fn new() -> Self {
        Self { pools: Vec::new() }
    }

    pub fn add_pool(&mut self, pool: Pool) {
        self.pools.push(pool);
    }

    pub fn pools(&self) -> &[Pool] {
        &self.pools
    }

    /// Return the best route and expected output for a swap.
    pub fn quote(&self, from: &Asset, to: &Asset, amount: Amount) -> MultichainResult<Quote> {
        if amount == Amount::ZERO {
            return Ok(Quote {
                route: vec![from.id.clone(), to.id.clone()],
                expected_out: Amount::ZERO,
                slippage_bps: 0,
                total_fee_bps: 0,
            });
        }

        // Direct route.
        let mut best = self.quote_single(from, to, amount).map(|(out, fee)| Quote {
            route: vec![from.id.clone(), to.id.clone()],
            expected_out: out,
            slippage_bps: 50,
            total_fee_bps: fee,
        });

        // One-intermediate route ( aggregator preview ).
        for pool in &self.pools {
            for intermediate in [&pool.asset_a.id, &pool.asset_b.id] {
                if *intermediate == from.id || *intermediate == to.id {
                    continue;
                }
                let Some(mid) = self.quote_amount(from.id.clone(), intermediate.clone(), amount)
                else {
                    continue;
                };
                let Some(out) = self.quote_amount(intermediate.clone(), to.id.clone(), mid) else {
                    continue;
                };
                if best.as_ref().is_none_or(|q| out > q.expected_out) {
                    let fee = pool.fee_bps
                        + self
                            .find_pool(intermediate, &to.id)
                            .map_or(0, |p| p.fee_bps);
                    best = Some(Quote {
                        route: vec![from.id.clone(), intermediate.clone(), to.id.clone()],
                        expected_out: out,
                        slippage_bps: 100,
                        total_fee_bps: fee,
                    });
                }
            }
        }

        best.ok_or_else(|| {
            MultichainError::Unsupported(format!("no route from {} to {}", from.id, to.id))
        })
    }

    /// Return the top-N routes ranked by expected output.
    ///
    /// Enumerates all simple paths up to `max_hops` length (default 3),
    /// scores them by output amount, and returns the top `n` results.
    pub fn quote_multi(
        &self,
        from: &Asset,
        to: &Asset,
        amount: Amount,
        n: usize,
        max_hops: usize,
    ) -> MultichainResult<Vec<Quote>> {
        if amount == Amount::ZERO {
            return Ok(vec![Quote {
                route: vec![from.id.clone(), to.id.clone()],
                expected_out: Amount::ZERO,
                slippage_bps: 0,
                total_fee_bps: 0,
            }]);
        }

        let mut all_paths: Vec<Quote> = Vec::new();

        // Enumerate simple paths via DFS
        let mut visited: HashSet<AssetId> = HashSet::new();
        visited.insert(from.id.clone());
        let mut current_route: Vec<AssetId> = vec![from.id.clone()];
        self.dfs_paths(
            &from.id,
            &to.id,
            amount,
            0,
            max_hops,
            &mut visited,
            &mut current_route,
            &mut all_paths,
        );

        if all_paths.is_empty() {
            return Err(MultichainError::Unsupported(format!(
                "no route from {} to {}",
                from.id, to.id
            )));
        }

        // Sort by expected_out descending
        all_paths.sort_by(|a, b| b.expected_out.cmp(&a.expected_out));
        all_paths.truncate(n);
        Ok(all_paths)
    }

    /// DFS helper for multi-path enumeration.
    fn dfs_paths(
        &self,
        current: &AssetId,
        target: &AssetId,
        amount_in: Amount,
        hops: usize,
        max_hops: usize,
        visited: &mut HashSet<AssetId>,
        route: &mut Vec<AssetId>,
        results: &mut Vec<Quote>,
    ) {
        if hops > 0 && current == target {
            // Found a path to target
            let total_fee: u16 = route
                .windows(2)
                .filter_map(|w| self.find_pool(&w[0], &w[1]).map(|p| p.fee_bps))
                .sum();
            let slippage = (hops * 50) as u16;
            results.push(Quote {
                route: route.clone(),
                expected_out: amount_in,
                slippage_bps: slippage,
                total_fee_bps: total_fee,
            });
            return;
        }

        if hops >= max_hops {
            return;
        }

        // Try all pools from current node
        for pool in &self.pools {
            let next = if &pool.asset_a.id == current {
                &pool.asset_b.id
            } else if &pool.asset_b.id == current {
                &pool.asset_a.id
            } else {
                continue;
            };

            if visited.contains(next) {
                continue;
            }

            if let Some(out) = pool.quote_by_id(current, next, amount_in) {
                visited.insert(next.clone());
                route.push(next.clone());
                self.dfs_paths(
                    next,
                    target,
                    out,
                    hops + 1,
                    max_hops,
                    visited,
                    route,
                    results,
                );
                route.pop();
                visited.remove(next);
            }
        }
    }

    /// Add a cross-chain bridge edge as a synthetic pool with 1:1 ratio.
    ///
    /// This allows the router to route through bridge hops when finding
    /// multi-path quotes. The bridge fee is expressed in basis points.
    pub fn add_bridge_pool(
        &mut self,
        id: u64,
        native_asset: Asset,
        wrapped_asset: Asset,
        fee_bps: u16,
    ) {
        // Bridge pools have equal reserves (1:1 peg) with the bridge fee
        self.pools.push(Pool {
            id,
            asset_a: native_asset,
            asset_b: wrapped_asset,
            reserve_a: Amount::new(1_000_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps,
        });
    }

    /// Execute a DEX swap in-place, updating pool reserves.
    pub fn execute(
        &mut self,
        from: &Asset,
        to: &Asset,
        amount: Amount,
    ) -> MultichainResult<Amount> {
        // For Mainnet Alpha we execute the direct pool when available; multi-hop
        // execution is filled hop-by-hop once more liquidity is bootstrapped.
        let pool = self.find_pool_mut(&from.id, &to.id).ok_or_else(|| {
            MultichainError::Unsupported(format!("no direct pool from {} to {}", from.id, to.id))
        })?;
        pool.execute_by_id(&from.id, &to.id, amount)
            .ok_or_else(|| MultichainError::Validation("DEX execution failed".to_string()))
    }

    fn quote_single(&self, from: &Asset, to: &Asset, amount: Amount) -> Option<(Amount, u16)> {
        let pool = self.find_pool(&from.id, &to.id)?;
        let out = pool.quote_by_id(&from.id, &to.id, amount)?;
        Some((out, pool.fee_bps))
    }

    fn quote_amount(&self, from: AssetId, to: AssetId, amount: Amount) -> Option<Amount> {
        let pool = self.find_pool(&from, &to)?;
        pool.quote_by_id(&from, &to, amount)
    }

    pub fn find_pool(&self, from: &AssetId, to: &AssetId) -> Option<&Pool> {
        self.pools.iter().find(|p| p.contains(from, to))
    }

    fn find_pool_mut(&mut self, from: &AssetId, to: &AssetId) -> Option<&mut Pool> {
        self.pools.iter_mut().find(|p| p.contains(from, to))
    }
}

fn compute_out(
    reserve_in: Amount,
    reserve_out: Amount,
    amount_in: Amount,
    fee_bps: u16,
) -> Option<Amount> {
    if fee_bps >= 10_000 || reserve_in.0 == 0 || reserve_out.0 == 0 || amount_in.0 == 0 {
        return None;
    }
    let fee_denom = BigUint::from(10_000u64);
    let amount_in_with_fee =
        BigUint::from(amount_in.0) * BigUint::from(10_000u64 - u64::from(fee_bps));
    let reserve_in_scaled = BigUint::from(reserve_in.0) * &fee_denom;
    let numerator = BigUint::from(reserve_out.0) * amount_in_with_fee;
    let denominator = reserve_in_scaled + BigUint::from(amount_in.0) * &fee_denom;
    // amount_out = reserve_out * amount_in_with_fee / (reserve_in * fee_denom + amount_in * fee_denom)
    let out = numerator / denominator;
    out.to_u128().map(Amount::new)
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::{AssetId, ChainId};

    fn asset(chain: ChainId, ticker: &str, decimals: u8) -> Asset {
        let contract = if chain.family() == zion_l1_types::ChainFamily::Evm {
            Some("0x0000000000000000000000000000000000000000".to_string())
        } else {
            None
        };
        Asset {
            id: AssetId::new(chain, ticker, contract),
            decimals,
            name: ticker.to_string(),
        }
    }

    #[test]
    fn direct_quote_and_execute() {
        let zion = asset(ChainId::ZionL1, "ZION", 6);
        let usdc = asset(ChainId::Base, "USDC", 6);

        let mut router = DexRouter::new();
        router.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000), // 100k ZION
            reserve_b: Amount::new(1_000_000_000_000), // 1M USDC
            fee_bps: 30,
        });

        let amount = Amount::new(1_000_000); // 1 ZION
        let quote = router.quote(&zion, &usdc, amount).unwrap();
        assert!(quote.expected_out.0 > 0);
        assert_eq!(quote.route.len(), 2);

        let out = router.execute(&zion, &usdc, amount).unwrap();
        assert_eq!(out, quote.expected_out);
    }

    #[test]
    fn multi_hop_quote() {
        let zion = asset(ChainId::ZionL1, "ZION", 6);
        let eth = asset(ChainId::Ethereum, "ETH", 18);
        let usdc = asset(ChainId::Base, "USDC", 6);

        let mut router = DexRouter::new();
        router.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: eth.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(10_000_000_000_000_000_000),
            fee_bps: 30,
        });
        router.add_pool(Pool {
            id: 2,
            asset_a: eth.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(1_000_000_000_000_000_000),
            reserve_b: Amount::new(4_000_000_000_000),
            fee_bps: 30,
        });

        let amount = Amount::new(1_000_000);
        let quote = router.quote(&zion, &usdc, amount).unwrap();
        assert!(quote.expected_out.0 > 0);
        assert_eq!(quote.route.len(), 3);
    }

    #[test]
    fn multi_path_quote_returns_top_n() {
        let zion = asset(ChainId::ZionL1, "ZION", 6);
        let eth = asset(ChainId::Ethereum, "ETH", 18);
        let usdc = asset(ChainId::Base, "USDC", 6);

        let mut router = DexRouter::new();
        // Direct ZION→USDC pool
        router.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(50_000_000_000),
            reserve_b: Amount::new(500_000_000_000),
            fee_bps: 30,
        });
        // ZION→ETH pool
        router.add_pool(Pool {
            id: 2,
            asset_a: zion.clone(),
            asset_b: eth.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(10_000_000_000_000_000_000),
            fee_bps: 30,
        });
        // ETH→USDC pool
        router.add_pool(Pool {
            id: 3,
            asset_a: eth.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(1_000_000_000_000_000_000),
            reserve_b: Amount::new(4_000_000_000_000),
            fee_bps: 30,
        });

        let amount = Amount::new(1_000_000);
        let paths = router.quote_multi(&zion, &usdc, amount, 3, 3).unwrap();
        assert!(!paths.is_empty());
        assert!(paths.len() <= 3);
        // Best path should be the one with highest expected_out
        assert!(paths[0].expected_out.0 > 0);
        // Paths should be sorted descending
        for w in paths.windows(2) {
            assert!(w[0].expected_out >= w[1].expected_out);
        }
    }

    #[test]
    fn bridge_pool_enables_cross_chain_routing() {
        let zion = asset(ChainId::ZionL1, "ZION", 6);
        let wzion = asset(ChainId::Base, "wZION", 6);
        let usdc = asset(ChainId::Base, "USDC", 6);

        let mut router = DexRouter::new();
        // Bridge: ZION ↔ wZION (1:1 with 10 bps bridge fee)
        router.add_bridge_pool(100, zion.clone(), wzion.clone(), 10);
        // Base chain: wZION ↔ USDC
        router.add_pool(Pool {
            id: 2,
            asset_a: wzion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
        });

        let amount = Amount::new(1_000_000);
        // Should route ZION → wZION (bridge) → USDC
        let quote = router.quote(&zion, &usdc, amount).unwrap();
        assert!(quote.expected_out.0 > 0);
        assert_eq!(quote.route.len(), 3);
        assert_eq!(quote.route[0], zion.id);
        assert_eq!(quote.route[1], wzion.id);
        assert_eq!(quote.route[2], usdc.id);
    }

    #[test]
    fn quote_multi_no_route_returns_error() {
        let zion = asset(ChainId::ZionL1, "ZION", 6);
        let btc = asset(ChainId::Bitcoin, "BTC", 8);

        let router = DexRouter::new();
        let amount = Amount::new(1_000_000);
        let result = router.quote_multi(&zion, &btc, amount, 3, 3);
        assert!(result.is_err());
    }
}
