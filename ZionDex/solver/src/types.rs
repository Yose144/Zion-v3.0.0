//! Local data types for the ZionDex Solver Daemon.
//!
//! These types are intentionally defined locally (rather than imported from
//! the `ziondex-router` or `ziondex-intent` crates) so that the solver daemon
//! remains a fully standalone service that only talks to the Router over HTTP
//! and to the auction broadcaster over its own REST API.
//!
//! The shapes mirror:
//! - the intent crate's `SwapIntent` / `SolverBid` / `PathHop`
//! - the router's `MultiPathQuote` / `SwapRequest` / `SwapResponse`

use ethers::types::U256;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Intent-layer types (mirror `ziondex-intent::types`)
// ---------------------------------------------------------------------------

/// Identifier for a supported chain. Mirrors the router/intent chain set.
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
    /// Canonical lowercase name of the chain.
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

impl std::fmt::Display for ChainId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
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

/// Lifecycle state of a swap intent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IntentStatus {
    Pending,
    Settled,
    Executed,
    Expired,
    Cancelled,
}

impl std::fmt::Display for IntentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
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

// ---------------------------------------------------------------------------
// Router API response types (mirror `ziondex-router` quote/swap shapes)
// ---------------------------------------------------------------------------

/// A token identifier as returned by the Router's quote endpoints.
///
/// Mirrors the router's `TokenId` enum (tagged JSON).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TokenId {
    /// Native chain token (ZION, ETH, SOL, etc.).
    Native { chain: ChainId, symbol: String },
    /// ERC-20 / SPL / etc. token.
    Token {
        chain: ChainId,
        address: String,
        symbol: String,
        decimals: u8,
    },
}

impl TokenId {
    pub fn symbol(&self) -> &str {
        match self {
            Self::Native { symbol, .. } => symbol,
            Self::Token { symbol, .. } => symbol,
        }
    }
}

/// A single step in an aggregated swap path. Mirrors the router's `SwapStep`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SwapStep {
    /// Same-chain swap on a DEX.
    SameChainSwap {
        chain: ChainId,
        dex: String,
        from_token: TokenId,
        to_token: TokenId,
        amount_in: String,
        expected_amount_out: String,
        fee_bps: u16,
    },
    /// Cross-chain bridge via WARP.
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
    /// Human-readable step type label.
    pub fn type_label(&self) -> &'static str {
        match self {
            Self::SameChainSwap { .. } => "same_chain_swap",
            Self::Bridge { .. } => "bridge",
        }
    }

    /// Fee (in bps) charged by this step.
    pub fn fee_bps(&self) -> u16 {
        match self {
            Self::SameChainSwap { fee_bps, .. } => *fee_bps,
            Self::Bridge { fee_bps, .. } => *fee_bps,
        }
    }
}

/// A complete aggregated path from source to destination, as returned by the
/// Router's `GET /quote/multi` endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedPath {
    pub steps: Vec<SwapStep>,
    /// Expected output amount (human-readable float string from the router).
    pub total_output: f64,
    pub total_fee_bps: u64,
    pub estimated_time_secs: u64,
    pub bridge_hops: u8,
}

/// Multi-path quote response from `GET /quote/multi`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiPathQuote {
    pub quote_id: String,
    pub input_token: TokenId,
    pub input_amount: String,
    pub output_token: TokenId,
    /// Top paths, sorted by output amount (descending).
    pub paths: Vec<AggregatedPath>,
    /// Index into `paths` of the recommended (best) path.
    pub recommended_path_index: usize,
    /// Quote expiry timestamp.
    pub expiry: chrono::DateTime<chrono::Utc>,
}

impl MultiPathQuote {
    /// Returns the recommended (best) path, or `None` if the quote is empty.
    pub fn best_path(&self) -> Option<&AggregatedPath> {
        self.paths.get(self.recommended_path_index)
    }

    /// Returns the highest expected output amount across all paths.
    pub fn best_output(&self) -> f64 {
        self.paths.first().map(|p| p.total_output).unwrap_or(0.0)
    }
}

/// Swap execution request body for `POST /swap`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRequest {
    pub quote_id: String,
    pub sender: String,
    pub recipient: String,
    pub max_slippage_bps: u16,
}

/// Status of a swap.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapStatus {
    Pending,
    Executing,
    Completed,
    Failed,
    Refunded,
}

/// Status of an individual step within a swap.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepStatus {
    pub step_index: usize,
    pub step_type: String,
    pub status: SwapStatus,
    pub tx_hash: Option<String>,
    pub error: Option<String>,
}

/// Swap execution response from `POST /swap`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapResult {
    pub swap_id: String,
    pub status: SwapStatus,
    pub steps: Vec<StepStatus>,
    pub monitor_url: String,
}

/// Router health-check response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub chains: Vec<ChainId>,
    pub uptime_secs: u64,
}

// ---------------------------------------------------------------------------
// Solver-internal types
// ---------------------------------------------------------------------------

/// Outcome of an executed winning swap.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    /// Intent that was fulfilled.
    pub intent_id: Uuid,
    /// Router swap id (if the swap was submitted to the Router).
    pub swap_id: Option<String>,
    /// Final status.
    pub status: SwapStatus,
    /// Output amount delivered to the user.
    pub amount_out: U256,
    /// Solver profit (amount_out kept above the user guarantee), in smallest units.
    pub profit: U256,
    /// Gas paid for execution (smallest units of the gas token).
    pub gas_cost: U256,
    /// Timestamp the execution completed.
    pub completed_at: u64,
    /// Optional error message (on failure).
    pub error: Option<String>,
}

/// Aggregated solver statistics.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SolverStats {
    /// Total intents observed.
    pub intents_seen: u64,
    /// Bids submitted to the auction.
    pub bids_submitted: u64,
    /// Auctions won.
    pub auctions_won: u64,
    /// Auctions lost.
    pub auctions_lost: u64,
    /// Executions that completed successfully.
    pub executions_succeeded: u64,
    /// Executions that failed.
    pub executions_failed: u64,
    /// Cumulative profit (smallest units), tracked as a decimal string for U256 safety.
    pub total_profit: String,
    /// Cumulative gas cost (smallest units), tracked as a decimal string.
    pub total_gas_cost: String,
    /// Solver uptime in seconds.
    pub uptime_secs: u64,
}

impl SolverStats {
    /// Create an empty stats block.
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a newly observed intent.
    pub fn observe_intent(&mut self) {
        self.intents_seen += 1;
    }

    /// Record a submitted bid.
    pub fn record_bid(&mut self) {
        self.bids_submitted += 1;
    }

    /// Record an auction won.
    pub fn record_win(&mut self) {
        self.auctions_won += 1;
    }

    /// Record an auction lost.
    pub fn record_loss(&mut self) {
        self.auctions_lost += 1;
    }

    /// Record the outcome of an execution, accumulating profit/gas.
    pub fn record_execution(&mut self, res: &ExecutionResult) {
        match res.status {
            SwapStatus::Completed => self.executions_succeeded += 1,
            SwapStatus::Failed => self.executions_failed += 1,
            _ => {}
        }
        self.total_profit = add_u256_dec(&self.total_profit, &res.profit);
        self.total_gas_cost = add_u256_dec(&self.total_gas_cost, &res.gas_cost);
    }
}

/// Add two U256 values represented as decimal strings, returning a decimal string.
/// Empty strings are treated as zero.
fn add_u256_dec(a: &str, b: &U256) -> String {
    let av = if a.is_empty() {
        U256::zero()
    } else {
        U256::from_dec_str(a).unwrap_or(U256::zero())
    };
    (av + b).to_string()
}
