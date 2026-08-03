use crate::types::{ChainId, DexId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Router configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterConfig {
    /// RPC URLs for each chain
    pub rpc_urls: HashMap<ChainId, String>,
    /// L3 WARP bridge API URL (default: http://127.0.0.1:8453)
    pub bridge_api_url: String,
    /// Contract addresses per chain
    pub contracts: HashMap<ChainId, ChainContracts>,
    /// DEX registry — which DEXs are available on each chain
    pub dex_registry: HashMap<ChainId, Vec<DexEntry>>,
    /// Default slippage in basis points (100 = 1%)
    pub default_slippage_bps: u16,
    /// Bridge fee in basis points
    pub bridge_fee_bps: u16,
    /// Quote expiry in seconds
    pub quote_expiry_secs: u64,
    /// Server bind address
    pub bind_address: String,
    /// SQLite database path
    pub db_path: String,
}

/// Contract addresses for a chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainContracts {
    pub wzion: String,
    pub bridge: Option<String>,
    /// Uniswap V3 NonfungiblePositionManager (or equivalent)
    pub nft_position_manager: Option<String>,
    /// Uniswap V3 SwapRouter
    pub swap_router: Option<String>,
    /// Uniswap V3 QuoterV2
    pub quoter_v2: Option<String>,
    /// Factory
    pub factory: Option<String>,
    /// ZionDex AMM PoolManager (our custom AMM)
    pub ziondex_pool_manager: Option<String>,
    /// ZionDex AMM Router (user-facing)
    pub ziondex_router: Option<String>,
    /// ZionDex Hooks contract
    pub ziondex_hooks: Option<String>,
}

/// DEX entry in the registry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexEntry {
    pub dex: DexId,
    /// Pool addresses for known pairs
    pub pools: Vec<PoolEntry>,
    /// Is this DEX currently active?
    pub enabled: bool,
}

/// A known liquidity pool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolEntry {
    pub token_a: String,  // symbol
    pub token_b: String,  // symbol
    pub address: String,
    pub fee_bps: u16,
    pub chain: ChainId,
}

impl Default for RouterConfig {
    fn default() -> Self {
        let mut rpc_urls = HashMap::new();
        rpc_urls.insert(ChainId::Zion, "http://127.0.0.1:8443".into());
        rpc_urls.insert(ChainId::Base, "https://mainnet.base.org".into());
        rpc_urls.insert(ChainId::Arbitrum, "https://arb1.arbitrum.io".into());
        rpc_urls.insert(ChainId::Bsc, "https://bsc-dataseed.binance.org".into());
        rpc_urls.insert(ChainId::Polygon, "https://polygon-rpc.com".into());
        rpc_urls.insert(ChainId::Optimism, "https://mainnet.optimism.io".into());
        rpc_urls.insert(ChainId::Avalanche, "https://api.avax.network/ext/bc/C/rpc".into());
        rpc_urls.insert(ChainId::Solana, "https://api.mainnet-beta.solana.com".into());

        let mut contracts = HashMap::new();

        // Base
        contracts.insert(ChainId::Base, ChainContracts {
            wzion: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6".into(),
            bridge: Some("0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467".into()),
            nft_position_manager: Some("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1".into()),
            swap_router: Some("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45".into()),
            quoter_v2: Some("0x61fFE014bA17989E743c5F6cB21bF9697530B21e".into()),
            factory: Some("0x1F98431c8aD98523631AE4a59f267346ea31F984".into()),
            // ZionDex AMM — will be set after deploy via DeployBase.s.sol
            ziondex_pool_manager: None, // TODO: set after Base deploy
            ziondex_router: None,
            ziondex_hooks: None,
        });

        // Non-Base EVM chains (same wZION, different bridge)
        for chain in [ChainId::Arbitrum, ChainId::Bsc, ChainId::Polygon, ChainId::Optimism, ChainId::Avalanche] {
            contracts.insert(chain, ChainContracts {
                wzion: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6".into(),
                bridge: Some("0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721".into()),
                nft_position_manager: None,
                swap_router: None,
                quoter_v2: None,
                factory: None,
                ziondex_pool_manager: None,
                ziondex_router: None,
                ziondex_hooks: None,
            });
        }

        let mut dex_registry = HashMap::new();

        // Base DEXs
        dex_registry.insert(ChainId::Base, vec![
            // ZionDex AMM — our custom AMM with ZION pair fee discount (0.15%)
            DexEntry {
                dex: DexId::ZionDexAmm,
                pools: vec![
                    // Pools will be created after deploy via ZionDexPoolManager.initialize()
                    // Fee is 15 bps (0.15%) for ZION pairs — half of Uniswap's 30 bps
                    PoolEntry {
                        token_a: "wZION".into(),
                        token_b: "USDT".into(),
                        address: "0x0".into(), // TODO: set after pool initialization
                        fee_bps: 15,
                        chain: ChainId::Base,
                    },
                    PoolEntry {
                        token_a: "wZION".into(),
                        token_b: "WETH".into(),
                        address: "0x0".into(), // TODO: set after pool initialization
                        fee_bps: 15,
                        chain: ChainId::Base,
                    },
                    PoolEntry {
                        token_a: "wZION".into(),
                        token_b: "USDC".into(),
                        address: "0x0".into(), // TODO: set after pool initialization
                        fee_bps: 15,
                        chain: ChainId::Base,
                    },
                ],
                enabled: false, // Enabled after AMM deploy + pool init
            },
            // Uniswap V3 — existing pools
            DexEntry {
                dex: DexId::UniswapV3,
                pools: vec![
                    PoolEntry {
                        token_a: "wZION".into(),
                        token_b: "USDT".into(),
                        address: "0x186b46c2f04153999d44D25179cD623fD62Bfda2".into(),
                        fee_bps: 30,
                        chain: ChainId::Base,
                    },
                    PoolEntry {
                        token_a: "wZION".into(),
                        token_b: "WETH".into(),
                        address: "0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699".into(),
                        fee_bps: 100,
                        chain: ChainId::Base,
                    },
                ],
                enabled: true,
            },
            DexEntry {
                dex: DexId::Aerodrome,
                pools: vec![],
                enabled: true,
            },
        ]);

        // Solana DEXs
        dex_registry.insert(ChainId::Solana, vec![
            DexEntry { dex: DexId::Raydium, pools: vec![], enabled: true },
            DexEntry { dex: DexId::Orca, pools: vec![], enabled: true },
        ]);

        // BSC
        dex_registry.insert(ChainId::Bsc, vec![
            DexEntry { dex: DexId::PancakeSwap, pools: vec![], enabled: true },
        ]);

        // Polygon
        dex_registry.insert(ChainId::Polygon, vec![
            DexEntry { dex: DexId::QuickSwap, pools: vec![], enabled: true },
        ]);

        // Arbitrum
        dex_registry.insert(ChainId::Arbitrum, vec![
            DexEntry { dex: DexId::UniswapV3, pools: vec![], enabled: true },
        ]);

        // Optimism
        dex_registry.insert(ChainId::Optimism, vec![
            DexEntry { dex: DexId::UniswapV3, pools: vec![], enabled: true },
        ]);

        // Avalanche
        dex_registry.insert(ChainId::Avalanche, vec![
            DexEntry { dex: DexId::TraderJoe, pools: vec![], enabled: true },
        ]);

        Self {
            rpc_urls,
            bridge_api_url: "http://127.0.0.1:8453".into(), // L3 WARP server
            contracts,
            dex_registry,
            default_slippage_bps: 150,  // 1.5%
            bridge_fee_bps: 50,         // 0.5%
            quote_expiry_secs: 300,     // 5 minutes
            bind_address: "0.0.0.0:8454".into(),
            db_path: "ziondex-router.db".into(),
        }
    }
}

impl RouterConfig {
    /// Load config from a TOML file (optional — falls back to default)
    pub fn load(path: &str) -> anyhow::Result<Self> {
        if std::path::Path::new(path).exists() {
            let content = std::fs::read_to_string(path)?;
            let config: Self = toml::from_str(&content)?;
            Ok(config)
        } else {
            Ok(Self::default())
        }
    }

    /// Get the DEX registry for a chain
    pub fn dexs_for_chain(&self, chain: ChainId) -> &[DexEntry] {
        self.dex_registry.get(&chain).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Find a pool for a token pair on a chain (only enabled DEXs)
    pub fn find_pool(&self, chain: ChainId, token_a: &str, token_b: &str) -> Option<&PoolEntry> {
        self.dexs_for_chain(chain).iter()
            .filter(|e| e.enabled) // Only search enabled DEXs
            .flat_map(|e| e.pools.iter())
            .find(|p| {
                (p.token_a.eq_ignore_ascii_case(token_a) && p.token_b.eq_ignore_ascii_case(token_b))
                    || (p.token_a.eq_ignore_ascii_case(token_b) && p.token_b.eq_ignore_ascii_case(token_a))
            })
    }

    /// Find all pools for a token pair on a chain (across all DEXs, including disabled)
    pub fn find_all_pools(&self, chain: ChainId, token_a: &str, token_b: &str) -> Vec<&PoolEntry> {
        self.dexs_for_chain(chain).iter()
            .flat_map(|e| e.pools.iter())
            .filter(|p| {
                (p.token_a.eq_ignore_ascii_case(token_a) && p.token_b.eq_ignore_ascii_case(token_b))
                    || (p.token_a.eq_ignore_ascii_case(token_b) && p.token_b.eq_ignore_ascii_case(token_a))
            })
            .collect()
    }

    /// Enable a DEX on a chain (e.g., after AMM deploy)
    pub fn enable_dex(&mut self, chain: ChainId, dex: DexId) {
        if let Some(dexs) = self.dex_registry.get_mut(&chain) {
            for entry in dexs.iter_mut() {
                if entry.dex == dex {
                    entry.enabled = true;
                    break;
                }
            }
        }
    }

    /// Update pool address for a DEX (e.g., after pool initialization)
    pub fn update_pool_address(&mut self, chain: ChainId, dex: DexId, token_a: &str, token_b: &str, new_address: String) {
        if let Some(dexs) = self.dex_registry.get_mut(&chain) {
            for entry in dexs.iter_mut() {
                if entry.dex == dex {
                    for pool in entry.pools.iter_mut() {
                        if (pool.token_a.eq_ignore_ascii_case(token_a) && pool.token_b.eq_ignore_ascii_case(token_b))
                            || (pool.token_a.eq_ignore_ascii_case(token_b) && pool.token_b.eq_ignore_ascii_case(token_a))
                        {
                            pool.address = new_address;
                            return;
                        }
                    }
                }
            }
        }
    }
}
