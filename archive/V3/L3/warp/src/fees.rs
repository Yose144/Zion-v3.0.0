use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::{WarpError, WarpResult};

/// Fee configuration per route.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteFee {
    pub chain_name: String,
    /// Fee percentage (e.g. 0.001 = 0.1%)
    pub fee_rate: f64,
    /// Minimum fee in ZION flowers (6 decimals)
    pub min_fee: u64,
    /// Maximum fee in ZION flowers
    pub max_fee: u64,
}

/// Fee distribution model.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FeeDistribution {
    /// Percentage burned (permanent deflation)
    pub burn_pct: u8,
    /// Percentage to DAO treasury
    pub dao_pct: u8,
    /// Percentage to validators
    pub validator_pct: u8,
}

impl Default for FeeDistribution {
    fn default() -> Self {
        Self {
            burn_pct: 50,
            dao_pct: 25,
            validator_pct: 25,
        }
    }
}

/// Fee calculation engine.
pub struct FeeEngine {
    routes: HashMap<String, RouteFee>,
    pub distribution: FeeDistribution,
}

impl FeeEngine {
    pub fn new(distribution: FeeDistribution) -> Self {
        Self {
            routes: HashMap::new(),
            distribution,
        }
    }

    pub fn with_defaults() -> Self {
        let mut engine = Self::new(FeeDistribution::default());

        // EVM chains: 0.1%
        for chain in &["base", "arbitrum", "bsc", "polygon"] {
            engine.add_route(RouteFee {
                chain_name: chain.to_string(),
                fee_rate: 0.001,
                min_fee: 100_000,            // 0.1 ZION
                max_fee: 10_000_000_000_000, // 10,000 ZION
            });
        }

        // Solana: 0.15%
        engine.add_route(RouteFee {
            chain_name: "solana".into(),
            fee_rate: 0.0015,
            min_fee: 100_000,
            max_fee: 15_000_000_000_000,
        });

        // Tron: 0.1%
        engine.add_route(RouteFee {
            chain_name: "tron".into(),
            fee_rate: 0.001,
            min_fee: 100_000,
            max_fee: 10_000_000_000_000,
        });

        // Stellar: 0.1%
        engine.add_route(RouteFee {
            chain_name: "stellar".into(),
            fee_rate: 0.001,
            min_fee: 100_000,
            max_fee: 10_000_000_000_000,
        });

        // Cardano: 0.2%
        engine.add_route(RouteFee {
            chain_name: "cardano".into(),
            fee_rate: 0.002,
            min_fee: 200_000,
            max_fee: 20_000_000_000_000,
        });

        // Cosmos: 0.15%
        engine.add_route(RouteFee {
            chain_name: "cosmos".into(),
            fee_rate: 0.0015,
            min_fee: 100_000,
            max_fee: 15_000_000_000_000,
        });

        // Bitcoin: 0.25%
        engine.add_route(RouteFee {
            chain_name: "bitcoin".into(),
            fee_rate: 0.0025,
            min_fee: 500_000,
            max_fee: 25_000_000_000_000,
        });

        engine
    }

    pub fn add_route(&mut self, route: RouteFee) {
        self.routes.insert(route.chain_name.clone(), route);
    }

    pub fn calculate_fee(&self, chain_name: &str, amount_flowers: u64) -> WarpResult<u64> {
        let route = self
            .routes
            .get(chain_name)
            .ok_or_else(|| WarpError::UnsupportedChain(chain_name.to_string()))?;

        let raw_fee = (amount_flowers as f64 * route.fee_rate) as u64;
        let clamped = raw_fee.max(route.min_fee).min(route.max_fee);
        Ok(clamped)
    }

    /// Split the fee according to distribution percentages.
    pub fn split_fee(&self, fee_flowers: u64) -> (u64, u64, u64) {
        let burn = fee_flowers * self.distribution.burn_pct as u64 / 100;
        let dao = fee_flowers * self.distribution.dao_pct as u64 / 100;
        let validator = fee_flowers - burn - dao; // remainder to validators
        (burn, dao, validator)
    }

    pub fn route_count(&self) -> usize {
        self.routes.len()
    }

    pub fn get_route(&self, chain_name: &str) -> Option<&RouteFee> {
        self.routes.get(chain_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_defaults_have_all_routes() {
        let engine = FeeEngine::with_defaults();
        assert_eq!(engine.route_count(), 10);
    }

    #[test]
    fn test_fee_evm_basic() {
        let engine = FeeEngine::with_defaults();
        // 1000 ZION = 1_000_000_000 flowers → 0.1% = 1_000_000 (1 ZION)
        let fee = engine.calculate_fee("base", 1_000_000_000).unwrap();
        assert_eq!(fee, 1_000_000);
    }

    #[test]
    fn test_fee_minimum_enforced() {
        let engine = FeeEngine::with_defaults();
        // 0.01 ZION = 10_000 flowers → 0.1% = 10 → clamped to min 100_000
        let fee = engine.calculate_fee("base", 10_000).unwrap();
        assert_eq!(fee, 100_000);
    }

    #[test]
    fn test_fee_maximum_enforced() {
        let engine = FeeEngine::with_defaults();
        // 15M ZION → 0.1% = 15,000 ZION → clamped to max 10,000 ZION
        let fee = engine
            .calculate_fee("base", 15_000_000_000_000_000)
            .unwrap();
        assert_eq!(fee, 10_000_000_000_000);
    }

    #[test]
    fn test_fee_bitcoin_higher_rate() {
        let engine = FeeEngine::with_defaults();
        // 10,000 ZION = 10_000_000_000_000 flowers → 0.25% = 25_000_000_000
        let fee = engine.calculate_fee("bitcoin", 10_000_000_000_000).unwrap();
        assert_eq!(fee, 25_000_000_000);
    }

    #[test]
    fn test_fee_cardano_rate() {
        let engine = FeeEngine::with_defaults();
        // 10,000 ZION = 10_000_000_000_000 flowers → 0.2% = 20_000_000_000
        let fee = engine.calculate_fee("cardano", 10_000_000_000_000).unwrap();
        assert_eq!(fee, 20_000_000_000);
    }

    #[test]
    fn test_fee_unknown_chain() {
        let engine = FeeEngine::with_defaults();
        assert!(engine.calculate_fee("fantom", 1_000_000).is_err());
    }

    #[test]
    fn test_fee_distribution_default() {
        let dist = FeeDistribution::default();
        assert_eq!(dist.burn_pct + dist.dao_pct + dist.validator_pct, 100);
    }

    #[test]
    fn test_split_fee() {
        let engine = FeeEngine::with_defaults();
        let (burn, dao, validator) = engine.split_fee(1_000_000);
        assert_eq!(burn, 500_000); // 50%
        assert_eq!(dao, 250_000); // 25%
        assert_eq!(validator, 250_000); // 25%
    }

    #[test]
    fn test_split_fee_remainder() {
        let engine = FeeEngine::with_defaults();
        let (burn, dao, validator) = engine.split_fee(100);
        // 50 + 25 + remainder
        assert_eq!(burn + dao + validator, 100);
    }

    #[test]
    fn test_get_route() {
        let engine = FeeEngine::with_defaults();
        let route = engine.get_route("solana").unwrap();
        assert!((route.fee_rate - 0.0015).abs() < f64::EPSILON);
    }

    #[test]
    fn test_custom_route() {
        let mut engine = FeeEngine::new(FeeDistribution::default());
        engine.add_route(RouteFee {
            chain_name: "optimism".into(),
            fee_rate: 0.001,
            min_fee: 100_000,
            max_fee: 10_000_000_000_000,
        });
        let fee = engine.calculate_fee("optimism", 1_000_000_000).unwrap();
        assert_eq!(fee, 1_000_000);
    }
}
