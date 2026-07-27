use serde::{Deserialize, Serialize};

use crate::chain::ChainId;

/// Globally unique asset identifier within the ZION ecosystem.
#[derive(Clone, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub struct AssetId {
    pub chain: ChainId,
    pub contract: Option<String>,
    pub ticker: String,
}

impl AssetId {
    pub fn new(chain: ChainId, ticker: impl Into<String>, contract: Option<String>) -> Self {
        Self {
            chain,
            contract,
            ticker: ticker.into(),
        }
    }

    /// Native coin of a chain.
    pub fn native(chain: ChainId, ticker: impl Into<String>) -> Self {
        Self::new(chain, ticker, None)
    }
}

impl std::fmt::Display for AssetId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.contract {
            Some(c) => write!(f, "{}:{}:{}", self.chain.as_str(), self.ticker, c),
            None => write!(f, "{}:{}", self.chain.as_str(), self.ticker),
        }
    }
}

/// Asset metadata used for decimal conversion, display, and routing.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Asset {
    pub id: AssetId,
    pub decimals: u8,
    pub name: String,
}

impl Asset {
    pub fn native(chain: ChainId, ticker: impl Into<String>, decimals: u8, name: impl Into<String>) -> Self {
        Self {
            id: AssetId::native(chain, ticker),
            decimals,
            name: name.into(),
        }
    }

    pub fn with_contract(
        chain: ChainId,
        ticker: impl Into<String>,
        contract: impl Into<String>,
        decimals: u8,
        name: impl Into<String>,
    ) -> Self {
        let ticker = ticker.into();
        let contract = contract.into();
        Self {
            id: AssetId::new(chain, ticker.clone(), Some(contract.clone())),
            decimals,
            name: name.into(),
        }
    }

    /// Convert a decimal (human-readable) amount to the smallest unit.
    pub fn to_smallest(&self, human: f64) -> u128 {
        let factor = 10f64.powi(self.decimals as i32);
        (human * factor).round() as u128
    }

    /// Convert smallest-unit amount to a human-readable decimal string.
    pub fn to_human(&self, smallest: u128) -> String {
        let factor = 10u128.pow(self.decimals as u32);
        let integer = smallest / factor;
        let frac = smallest % factor;
        format!("{}.{:0>width$}", integer, frac, width = self.decimals as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_asset_display() {
        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        assert_eq!(zion.id.to_string(), "zion-l1:ZION");
    }

    #[test]
    fn decimal_conversion_round_trip() {
        let usdc = Asset::with_contract(ChainId::Base, "USDC", "0xA0b86a33E6B8", 6, "USD Coin");
        let smallest = usdc.to_smallest(1.23);
        assert_eq!(smallest, 1_230_000);
        assert_eq!(usdc.to_human(smallest), "1.230000");
    }
}
