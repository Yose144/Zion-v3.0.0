//! V3 Mainnet contract addresses reused by V31 Mainnet Alpha.
//!
//! These are the canonical deployments from ZION 3.0.4 / 3.0.5; V31 starts by
//! pointing adapters and dashboards at the same contracts before migrating to
//! V31-specific deployments.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

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
}

impl ZionContracts {
    /// Base Mainnet deployments (verified on Basescan).
    pub fn base_mainnet() -> Self {
        Self {
            wzion: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6".to_string(),
            bridge: "0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467".to_string(),
            atomic_swap: "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb".to_string(),
            staking: "0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B".to_string(),
            farm: "0x167B2753F5D8D9F8e62875cc9e379d7804308B08".to_string(),
            governance: "0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8".to_string(),
            treasury: "0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD".to_string(),
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
