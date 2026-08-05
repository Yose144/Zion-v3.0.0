//! Core data structures for the ZionDex intent layer.
//!
//! These types are self-contained (the crate does not depend on the router
//! crate) so that the intent layer can be evolved and deployed independently.

use ethers::types::U256;
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

/// Identifier for a supported chain.
///
/// This mirrors the chain set used by the ZionDex router but is defined here
/// so that the intent crate remains standalone.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChainId {
    Zion,
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
    /// Returns the canonical lowercase name of the chain.
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

    /// Broad cryptographic/account family of the chain.
    pub fn family(&self) -> ChainFamily {
        match self {
            Self::Zion => ChainFamily::Zion,
            Self::Base | Self::Arbitrum | Self::Bsc | Self::Polygon | Self::Optimism
            | Self::Avalanche => ChainFamily::Evm,
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
}

impl fmt::Display for ChainId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.name())
    }
}

impl std::str::FromStr for ChainId {
    type Err = crate::errors::Error;
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
            "aptos" | "apt" => Ok(Self::Aptos),
            "sui" => Ok(Self::Sui),
            "near" => Ok(Self::Near),
            "ton" => Ok(Self::Ton),
            other => Err(crate::errors::Error::UnknownChain(other.to_string())),
        }
    }
}

/// Broad cryptographic/account family of a chain.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

/// Lifecycle state of a swap intent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IntentStatus {
    /// Waiting for solver bids.
    Pending,
    /// A winning bid has been selected.
    Settled,
    /// The swap has been executed on-chain.
    Executed,
    /// The deadline passed before settlement/execution.
    Expired,
    /// The user cancelled the intent.
    Cancelled,
}

impl fmt::Display for IntentStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Settled => write!(f, "settled"),
            Self::Executed => write!(f, "executed"),
            Self::Expired => write!(f, "expired"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// A signed user intent to swap `amount_in` of `from_token` (on `from_chain`)
/// for at least `min_amount_out` of `to_token` (on `to_chain`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapIntent {
    /// Unique intent identifier.
    pub id: Uuid,
    /// User address (hex for EVM, base58 for Solana, etc.).
    pub user: String,
    /// Source chain.
    pub from_chain: ChainId,
    /// Destination chain.
    pub to_chain: ChainId,
    /// Source token address or symbol.
    pub from_token: String,
    /// Destination token address or symbol.
    pub to_token: String,
    /// Input amount (smallest units).
    pub amount_in: U256,
    /// Minimum acceptable output (slippage protection).
    pub min_amount_out: U256,
    /// Unix timestamp after which the intent is no longer valid.
    pub deadline: u64,
    /// Per-user replay protection nonce.
    pub nonce: u64,
    /// User signature over the EIP-712 / Ed25519 payload.
    pub signature: Vec<u8>,
    /// Current lifecycle state.
    pub status: IntentStatus,
}

impl SwapIntent {
    /// Creates a new pending intent with a fresh UUID and empty signature.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        user: impl Into<String>,
        from_chain: ChainId,
        to_chain: ChainId,
        from_token: impl Into<String>,
        to_token: impl Into<String>,
        amount_in: U256,
        min_amount_out: U256,
        deadline: u64,
        nonce: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            user: user.into(),
            from_chain,
            to_chain,
            from_token: from_token.into(),
            to_token: to_token.into(),
            amount_in,
            min_amount_out,
            deadline,
            nonce,
            signature: Vec::new(),
            status: IntentStatus::Pending,
        }
    }

    /// Returns true if the intent deadline has passed at time `now`.
    pub fn is_expired(&self, now: u64) -> bool {
        now >= self.deadline
    }
}

/// A single hop in a solver's planned execution path.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathHop {
    /// Chain the hop executes on.
    pub chain: String,
    /// DEX (or bridge) the hop uses.
    pub dex: String,
    /// Token consumed by the hop.
    pub from_token: String,
    /// Token produced by the hop.
    pub to_token: String,
    /// True if this hop crosses chains via the WARP bridge.
    pub is_bridge: bool,
}

/// A solver's competing offer to fulfill a swap intent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverBid {
    /// Intent this bid targets.
    pub intent_id: Uuid,
    /// Solver address.
    pub solver: String,
    /// Guaranteed output amount delivered to the user.
    pub amount_out: U256,
    /// Planned execution path.
    pub path: Vec<PathHop>,
    /// Solver fee in basis points (e.g. 10 = 0.1%).
    pub fee_bps: u16,
    /// Unix timestamp the bid was created.
    pub timestamp: u64,
    /// Solver signature over the bid.
    pub signature: Vec<u8>,
}

impl SolverBid {
    /// Creates a new unsigned bid.
    pub fn new(
        intent_id: Uuid,
        solver: impl Into<String>,
        amount_out: U256,
        path: Vec<PathHop>,
        fee_bps: u16,
        timestamp: u64,
    ) -> Self {
        Self {
            intent_id,
            solver: solver.into(),
            amount_out,
            path,
            fee_bps,
            timestamp,
            signature: Vec::new(),
        }
    }
}
