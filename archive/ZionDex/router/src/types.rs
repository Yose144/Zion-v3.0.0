use serde::{Deserialize, Serialize};
use std::fmt;

/// Unique identifier for a chain
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChainId {
    Zion,    // L1 native
    Base,
    Arbitrum,
    Bsc,
    Polygon,
    Optimism,
    Avalanche,
    Solana,
    Tron,
    Stellar,
    Bitcoin,
    Cardano,
    Cosmos,
    Aptos,
    Sui,
    Near,
    Ton,
}

impl ChainId {
    pub fn chain_family(&self) -> ChainFamily {
        match self {
            Self::Zion => ChainFamily::Zion,
            Self::Base | Self::Arbitrum | Self::Bsc | Self::Polygon |
            Self::Optimism | Self::Avalanche => ChainFamily::Evm,
            Self::Solana => ChainFamily::Solana,
            Self::Tron => ChainFamily::Tron,
            Self::Stellar => ChainFamily::Stellar,
            Self::Bitcoin => ChainFamily::Bitcoin,
            Self::Cardano => ChainFamily::Cardano,
            Self::Cosmos => ChainFamily::Cosmos,
            Self::Aptos => ChainFamily::Aptos,
            Self::Sui => ChainFamily::Sui,
            Self::Near => ChainFamily::Near,
            Self::Ton => ChainFamily::Ton,
        }
    }

    pub fn decimals(&self) -> u8 {
        match self {
            Self::Zion => 6,
            Self::Stellar | Self::Cardano | Self::Cosmos => 6,
            Self::Bitcoin => 8,
            Self::Solana | Self::Sui | Self::Ton => 9,
            Self::Aptos => 8,
            Self::Near => 24,
            _ => 18, // EVM + Tron
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            Self::Zion => "zion",
            Self::Base => "base",
            Self::Arbitrum => "arbitrum",
            Self::Bsc => "bsc",
            Self::Polygon => "polygon",
            Self::Optimism => "optimism",
            Self::Avalanche => "avalanche",
            Self::Solana => "solana",
            Self::Tron => "tron",
            Self::Stellar => "stellar",
            Self::Bitcoin => "bitcoin",
            Self::Cardano => "cardano",
            Self::Cosmos => "cosmos",
            Self::Aptos => "aptos",
            Self::Sui => "sui",
            Self::Near => "near",
            Self::Ton => "ton",
        }
    }
}

impl fmt::Display for ChainId {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.name())
    }
}

impl std::str::FromStr for ChainId {
    type Err = anyhow::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "zion" | "l1" => Ok(Self::Zion),
            "base" => Ok(Self::Base),
            "arbitrum" | "arb" => Ok(Self::Arbitrum),
            "bsc" | "binance" => Ok(Self::Bsc),
            "polygon" | "poly" => Ok(Self::Polygon),
            "optimism" | "op" => Ok(Self::Optimism),
            "avalanche" | "avax" => Ok(Self::Avalanche),
            "solana" | "sol" => Ok(Self::Solana),
            "tron" => Ok(Self::Tron),
            "stellar" | "xlm" => Ok(Self::Stellar),
            "bitcoin" | "btc" => Ok(Self::Bitcoin),
            "cardano" | "ada" => Ok(Self::Cardano),
            "cosmos" | "atom" => Ok(Self::Cosmos),
            "aptos" => Ok(Self::Aptos),
            "sui" => Ok(Self::Sui),
            "near" => Ok(Self::Near),
            "ton" => Ok(Self::Ton),
            _ => Err(anyhow::anyhow!("unknown chain: {}", s)),
        }
    }
}

/// Chain family for execution strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ChainFamily {
    Zion,
    Evm,
    Solana,
    Tron,
    Stellar,
    Bitcoin,
    Cardano,
    Cosmos,
    Aptos,
    Sui,
    Near,
    Ton,
}

/// Token identifier — either a native asset or a contract address
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TokenId {
    /// Native chain token (ZION, ETH, SOL, etc.)
    Native { chain: ChainId, symbol: String },
    /// ERC-20 / SPL / etc. token
    Token { chain: ChainId, address: String, symbol: String, decimals: u8 },
}

impl TokenId {
    pub fn chain(&self) -> ChainId {
        match self {
            Self::Native { chain, .. } => *chain,
            Self::Token { chain, .. } => *chain,
        }
    }

    pub fn symbol(&self) -> &str {
        match self {
            Self::Native { symbol, .. } => symbol,
            Self::Token { symbol, .. } => symbol,
        }
    }

    pub fn decimals(&self) -> u8 {
        match self {
            Self::Native { chain, .. } => chain.decimals(),
            Self::Token { decimals, .. } => *decimals,
        }
    }

    /// Well-known tokens
    pub fn wzion(chain: ChainId) -> Self {
        Self::Token {
            chain,
            address: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6".into(),
            symbol: "wZION".into(),
            decimals: 18,
        }
    }

    pub fn zion() -> Self {
        Self::Native { chain: ChainId::Zion, symbol: "ZION".into() }
    }

    pub fn usdt(chain: ChainId) -> Self {
        let addr = match chain {
            ChainId::Base => "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
            ChainId::Bsc => "0x55d398326f99059fF775485246999027B3197955",
            ChainId::Tron => "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            _ => "0x0000000000000000000000000000000000000000",
        };
        Self::Token { chain, address: addr.into(), symbol: "USDT".into(), decimals: 6 }
    }

    pub fn usdc(chain: ChainId) -> Self {
        let addr = match chain {
            ChainId::Base => "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            ChainId::Arbitrum => "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            ChainId::Polygon => "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359",
            ChainId::Optimism => "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            ChainId::Avalanche => "0xB97EF9Ef8734C71904D8002F14b6D59A624cFA0E",
            ChainId::Solana => "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            _ => "0x0000000000000000000000000000000000000000",
        };
        Self::Token { chain, address: addr.into(), symbol: "USDC".into(), decimals: 6 }
    }

    pub fn weth() -> Self {
        Self::Token {
            chain: ChainId::Base,
            address: "0x4200000000000000000000000000000000000006".into(),
            symbol: "WETH".into(),
            decimals: 18,
        }
    }
}

/// DEX identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DexId {
    UniswapV3,
    UniswapV4,
    PancakeSwap,
    QuickSwap,
    TraderJoe,
    Aerodrome,
    SushiSwap,
    Raydium,
    Orca,
    SunSwap,
    Minswap,
    StonFi,
    Liquidswap,
    Cetus,
    RefFinance,
    StellarX,
    ZionDexAmm, // Our own AMM (Phase 3)
}

impl DexId {
    pub fn name(&self) -> &'static str {
        match self {
            Self::UniswapV3 => "uniswap-v3",
            Self::UniswapV4 => "uniswap-v4",
            Self::PancakeSwap => "pancakeswap",
            Self::QuickSwap => "quickswap",
            Self::TraderJoe => "traderjoe",
            Self::Aerodrome => "aerodrome",
            Self::SushiSwap => "sushiswap",
            Self::Raydium => "raydium",
            Self::Orca => "orca",
            Self::SunSwap => "sunswap",
            Self::Minswap => "minswap",
            Self::StonFi => "ston.fi",
            Self::Liquidswap => "liquidswap",
            Self::Cetus => "cetus",
            Self::RefFinance => "ref.finance",
            Self::StellarX => "stellarx",
            Self::ZionDexAmm => "ziondex-amm",
        }
    }

    pub fn supports_chain(&self, chain: ChainId) -> bool {
        matches!(
            (self, chain),
            (Self::UniswapV3 | Self::UniswapV4 | Self::Aerodrome | Self::SushiSwap, ChainId::Base)
                | (Self::UniswapV3, ChainId::Arbitrum)
                | (Self::UniswapV3, ChainId::Optimism)
                | (Self::PancakeSwap, ChainId::Bsc)
                | (Self::QuickSwap, ChainId::Polygon)
                | (Self::TraderJoe, ChainId::Avalanche)
                | (Self::Raydium | Self::Orca, ChainId::Solana)
                | (Self::SunSwap, ChainId::Tron)
                | (Self::Minswap, ChainId::Cardano)
                | (Self::StonFi, ChainId::Ton)
                | (Self::Liquidswap, ChainId::Aptos)
                | (Self::Cetus, ChainId::Sui)
                | (Self::RefFinance, ChainId::Near)
                | (Self::StellarX, ChainId::Stellar)
                | (Self::ZionDexAmm, _) // Our AMM will be on all chains
        )
    }
}

/// A single step in a swap path
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SwapStep {
    /// Same-chain swap on a DEX
    SameChainSwap {
        chain: ChainId,
        dex: DexId,
        from_token: TokenId,
        to_token: TokenId,
        amount_in: String,
        expected_amount_out: String,
        fee_bps: u16,
    },
    /// Cross-chain bridge via WARP
    Bridge {
        from_chain: ChainId,
        to_chain: ChainId,
        asset: TokenId,
        amount: String,
        fee_bps: u16,
        estimated_time_secs: u64,
    },
}

impl SwapStep {
    pub fn estimated_time_secs(&self) -> u64 {
        match self {
            Self::SameChainSwap { .. } => 10,     // ~10s for EVM block
            Self::Bridge { estimated_time_secs, .. } => *estimated_time_secs,
        }
    }

    pub fn fee_bps(&self) -> u16 {
        match self {
            Self::SameChainSwap { fee_bps, .. } => *fee_bps,
            Self::Bridge { fee_bps, .. } => *fee_bps,
        }
    }
}

/// A complete swap path from source to destination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapPath {
    pub steps: Vec<SwapStep>,
    pub expected_output: String,
    pub min_output: String,
    pub total_fee_bps: u16,
    pub estimated_time_secs: u64,
    pub price_impact_bps: u16,
}

impl SwapPath {
    pub fn hop_count(&self) -> usize {
        self.steps.len()
    }

    pub fn is_cross_chain(&self) -> bool {
        self.steps.iter().any(|s| matches!(s, SwapStep::Bridge { .. }))
    }
}

/// Quote request from the user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteRequest {
    pub src_chain: ChainId,
    pub src_token: String,   // symbol or address
    pub dest_chain: ChainId,
    pub dest_token: String,  // symbol or address
    pub amount: String,      // human-readable amount
}

/// Quote response with best path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResponse {
    pub quote_id: String,
    pub path: SwapPath,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

/// Swap execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRequest {
    pub quote_id: String,
    pub sender: String,
    pub recipient: String,
    pub max_slippage_bps: u16,
}

/// Swap execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapResponse {
    pub swap_id: String,
    pub status: SwapStatus,
    pub steps: Vec<StepStatus>,
    pub monitor_url: String,
}

/// Status of a swap
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapStatus {
    Pending,
    Executing,
    Completed,
    Failed,
    Refunded,
}

/// Status of individual step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepStatus {
    pub step_index: usize,
    pub step_type: String,
    pub status: SwapStatus,
    pub tx_hash: Option<String>,
    pub error: Option<String>,
}

/// Swap record stored in DB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRecord {
    pub id: String,
    pub quote_id: String,
    pub sender: String,
    pub recipient: String,
    pub src_chain: ChainId,
    pub dest_chain: ChainId,
    pub amount_in: String,
    pub amount_out: Option<String>,
    pub status: SwapStatus,
    pub steps: Vec<StepStatus>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub chains: Vec<ChainId>,
    pub uptime_secs: u64,
}
