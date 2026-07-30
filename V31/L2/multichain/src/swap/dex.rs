//! DEX routing and settlement (ZionDex inside `zion-multichain`).
//!
//! The router operates over a constant-product AMM liquidity graph. Mainnet
//! Alpha supports direct swaps; multi-hop quotes are computed over one
//! intermediate pool when available.

use num_bigint::BigUint;
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
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
}
