//! V3 Mainnet contract addresses reused by V31 Mainnet Alpha.
//!
//! These are the canonical deployments from ZION 3.0.4 / 3.0.5; V31 starts by
//! pointing adapters and dashboards at the same contracts before migrating to
//! V31-specific deployments.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Metadata for an ERC-20 token that the multichain wallet should track.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct TokenInfo {
    pub contract: String,
    pub decimals: u8,
}

/// Uniswap V3-compatible DEX contracts (works for Uniswap and PancakeSwap V3 on Base).
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct V3Dex {
    pub factory: String,
    pub swap_router: String,
    pub quoter: String,
    pub position_manager: String,
}

/// Contract addresses for a single EVM chain.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ZionContracts {
    pub wzion: String,
    pub bridge: String,
    pub atomic_swap: String,
    pub staking: String,
    pub farm: String,
    pub governance: String,
    pub treasury: String,
    /// ERC-20 token contracts that the wallet should detect as deposits.
    #[serde(default)]
    pub tokens: HashMap<String, TokenInfo>,
    /// Uniswap V3-compatible DEX deployments keyed by DEX name (e.g. "uniswap", "pancakeswap").
    #[serde(default)]
    pub v3_dex: HashMap<String, V3Dex>,
}

impl ZionContracts {
    /// Base Mainnet deployments (verified on Basescan).
    pub fn base_mainnet() -> Self {
        let mut tokens = HashMap::new();
        tokens.insert(
            "USDC".to_string(),
            TokenInfo {
                contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".to_string(),
                decimals: 6,
            },
        );
        tokens.insert(
            "USDT".to_string(),
            TokenInfo {
                contract: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2".to_string(),
                decimals: 6,
            },
        );
        tokens.insert(
            "WETH".to_string(),
            TokenInfo {
                contract: "0x4200000000000000000000000000000000000006".to_string(),
                decimals: 18,
            },
        );
        // Beta test tokens (Base mainnet, ERC-20 faucets) — tracked so the
        // deposit watcher credits custodial balances for the ZionDex beta.
        tokens.insert(
            "tZION".to_string(),
            TokenInfo {
                contract: "0xC5E79b8C6475137aC3a982651097a219B63b0c33".to_string(),
                decimals: 18,
            },
        );
        tokens.insert(
            "tUSDT".to_string(),
            TokenInfo {
                contract: "0x677693fbFDe6a9EeA655033fffF93054B559552C".to_string(),
                decimals: 6,
            },
        );
        tokens.insert(
            "tWETH".to_string(),
            TokenInfo {
                contract: "0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F".to_string(),
                decimals: 18,
            },
        );
        let mut v3_dex = HashMap::new();
        v3_dex.insert(
            "uniswap".to_string(),
            V3Dex {
                factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD".to_string(),
                swap_router: "0x2626664c2603336E57B271c5C0b26F421741e481".to_string(),
                quoter: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a".to_string(),
                position_manager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1".to_string(),
            },
        );
        v3_dex.insert(
            "pancakeswap".to_string(),
            V3Dex {
                factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865".to_string(),
                swap_router: "0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86".to_string(),
                quoter: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997".to_string(),
                position_manager: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364".to_string(),
            },
        );
        Self {
            wzion: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6".to_string(),
            bridge: "0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467".to_string(),
            atomic_swap: "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb".to_string(),
            staking: "0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B".to_string(),
            farm: "0x167B2753F5D8D9F8e62875cc9e379d7804308B08".to_string(),
            governance: "0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8".to_string(),
            treasury: "0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD".to_string(),
            tokens,
            v3_dex,
        }
    }

    /// Non-Base EVM chains (Arbitrum / BSC / Polygon / Optimism / Avax)
    /// use the generic bridge proxy.
    pub fn non_base() -> Self {
        Self {
            wzion: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6".to_string(),
            bridge: "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721".to_string(),
            atomic_swap: "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb".to_string(),
            staking: "0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B".to_string(),
            farm: "0x167B2753F5D8D9F8e62875cc9e379d7804308B08".to_string(),
            governance: "0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8".to_string(),
            treasury: "0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD".to_string(),
            tokens: HashMap::new(),
            v3_dex: HashMap::new(),
        }
    }

    /// Contract bundle for a given chain name.
    pub fn for_chain(chain: &str) -> Option<Self> {
        match chain.to_lowercase().as_str() {
            "base" => Some(Self::base_mainnet()),
            "arbitrum" | "bsc" | "polygon" | "optimism" | "avalanche" | "avax" => {
                Some(Self::non_base())
            }
            _ => None,
        }
    }

    /// Map of all known chain contract bundles.
    pub fn all() -> std::collections::HashMap<String, Self> {
        [
            ("base".to_string(), Self::base_mainnet()),
            ("arbitrum".to_string(), Self::non_base()),
            ("bsc".to_string(), Self::non_base()),
            ("polygon".to_string(), Self::non_base()),
            ("optimism".to_string(), Self::non_base()),
            ("avalanche".to_string(), Self::non_base()),
        ]
        .into_iter()
        .collect()
    }
}

/// Convenience alias for `ZionContracts::for_chain`.
pub fn contracts_for_chain(chain: &str) -> Option<ZionContracts> {
    ZionContracts::for_chain(chain)
}

/// Convenience alias for `ZionContracts::all`.
pub fn all_contracts() -> HashMap<String, ZionContracts> {
    ZionContracts::all()
}

/// Best-effort decimals for a token on a given chain.
/// Falls back to well-known defaults (wZION = 18, USDC/USDT = 6, ETH/WETH = 18)
/// and finally to 0 if the token is unknown.
pub fn token_decimals(chain: &str, ticker: &str, contract: Option<&str>) -> u8 {
    if let Some(contracts) = ZionContracts::for_chain(chain) {
        if let Some(c) = contract {
            if let Some(info) = contracts
                .tokens
                .values()
                .find(|i| i.contract.eq_ignore_ascii_case(c))
            {
                return info.decimals;
            }
            if c.eq_ignore_ascii_case(&contracts.wzion) {
                return 18;
            }
        }
        if let Some(info) = contracts.tokens.get(ticker) {
            return info.decimals;
        }
    }

    let t = ticker.to_uppercase();
    match t.as_str() {
        "WZION" | "WETH" | "ETH" | "TZION" | "TWETH" => 18,
        "USDC" | "USDT" | "USDB" | "TUSDT" => 6,
        "DAI" => 18,
        _ => 0,
    }
}
