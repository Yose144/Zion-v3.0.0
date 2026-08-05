use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Unique swap request identifier
pub type SwapId = String;

/// Direction of the swap flow
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapDirection {
    /// ZION L1 → ETH/USDC on Base (lock + mint + swap)
    ZionToEvm,
    /// ETH/USDC on Base → ZION L1 (swap + burn + unlock)
    EvmToZion,
}

/// Target output token on the EVM side
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum OutputToken {
    Weth,
    Usdc,
}

/// Current status of a swap in the pipeline
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapStatus {
    /// Received and validated
    Pending,
    /// L1 lock transaction submitted
    Locking,
    /// Waiting for bridge finality
    Bridging,
    /// Swapping on Uni V3
    Swapping,
    /// Completed successfully
    Completed,
    /// Failed at some step
    Failed,
}

/// Request body for initiating a swap
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRequest {
    pub direction: SwapDirection,
    pub amount_in: String, // atomic string to avoid float issues
    pub output_token: OutputToken,
    pub zion_address: String,
    pub evm_address: String,
    pub slippage_bps: Option<u16>, // max 10000 = 100%
}

/// Stored swap record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRecord {
    pub id: SwapId,
    pub direction: SwapDirection,
    pub amount_in: String,
    pub output_token: OutputToken,
    pub zion_address: String,
    pub evm_address: String,
    pub slippage_bps: u16,
    pub status: SwapStatus,
    pub l1_lock_tx: Option<String>,
    pub bridge_mint_tx: Option<String>,
    pub swap_tx: Option<String>,
    pub amount_out: Option<String>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SwapRecord {
    pub fn new(req: SwapRequest) -> Self {
        let now = Utc::now();
        Self {
            id: format!("swap_{}", ulid::Ulid::new()),
            direction: req.direction,
            amount_in: req.amount_in,
            output_token: req.output_token,
            zion_address: req.zion_address,
            evm_address: req.evm_address,
            slippage_bps: req.slippage_bps.unwrap_or(100), // default 1%
            status: SwapStatus::Pending,
            l1_lock_tx: None,
            bridge_mint_tx: None,
            swap_tx: None,
            amount_out: None,
            error: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Public API response for a swap
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapResponse {
    pub id: SwapId,
    pub status: SwapStatus,
    pub direction: SwapDirection,
    pub amount_in: String,
    pub output_token: OutputToken,
    pub amount_out: Option<String>,
    pub l1_lock_tx: Option<String>,
    pub bridge_mint_tx: Option<String>,
    pub swap_tx: Option<String>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SwapRecord> for SwapResponse {
    fn from(r: SwapRecord) -> Self {
        Self {
            id: r.id,
            status: r.status,
            direction: r.direction,
            amount_in: r.amount_in,
            output_token: r.output_token,
            amount_out: r.amount_out,
            l1_lock_tx: r.l1_lock_tx,
            bridge_mint_tx: r.bridge_mint_tx,
            swap_tx: r.swap_tx,
            error: r.error,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

/// Quote request/response for price estimation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteRequest {
    pub direction: SwapDirection,
    pub amount_in: String,
    pub output_token: OutputToken,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResponse {
    pub amount_in: String,
    pub amount_out: String,
    pub output_token: OutputToken,
    pub price_impact_bps: u16,
    pub min_amount_out: String,
    pub slippage_bps: u16,
    pub route: String,
    pub fee_tier_bps: u16,
}
