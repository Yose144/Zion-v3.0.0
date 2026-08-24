use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use zion_l1_types::{Address, Amount, ChainId};

/// A custodial multichain wallet account for a single ZIS user.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WalletAccount {
    pub user_id: String,
    pub account_index: u32,
    pub created_at: DateTime<Utc>,
}

/// Why an address exists.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AddressPurpose {
    Deposit,
    Withdraw,
    Linked,
}

impl std::fmt::Display for AddressPurpose {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Deposit => write!(f, "deposit"),
            Self::Withdraw => write!(f, "withdraw"),
            Self::Linked => write!(f, "linked"),
        }
    }
}

impl std::str::FromStr for AddressPurpose {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "deposit" => Ok(Self::Deposit),
            "withdraw" => Ok(Self::Withdraw),
            "linked" => Ok(Self::Linked),
            _ => Err(format!("unknown address purpose: {s}")),
        }
    }
}

/// A single address belonging to a wallet account.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WalletAddress {
    pub address: Address,
    pub user_id: String,
    pub chain: ChainId,
    pub chain_id: Option<String>,
    pub purpose: AddressPurpose,
    pub public_key: Option<String>,
    pub derivation_path: String,
    pub is_external: bool,
    pub created_at: DateTime<Utc>,
}

/// Internal ledger balance for a user + asset.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WalletBalance {
    pub user_id: String,
    pub asset_key: String,
    pub amount: Amount,
    pub updated_at: DateTime<Utc>,
}

/// Status of an on-chain deposit.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DepositStatus {
    Pending,
    Credited,
    Failed,
}

impl std::fmt::Display for DepositStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Credited => write!(f, "credited"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for DepositStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "credited" => Ok(Self::Credited),
            "failed" => Ok(Self::Failed),
            _ => Err(format!("unknown deposit status: {s}")),
        }
    }
}

/// An observed or expected deposit.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DepositRecord {
    pub id: String,
    pub user_id: String,
    pub chain: ChainId,
    pub chain_id: Option<String>,
    pub tx_hash: String,
    pub asset_key: String,
    pub amount: Amount,
    pub confirmations: u64,
    pub status: DepositStatus,
    pub created_at: DateTime<Utc>,
    pub credited_at: Option<DateTime<Utc>>,
}

/// Status of a withdrawal.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WithdrawalStatus {
    Pending,
    Sent,
    Failed,
}

impl std::fmt::Display for WithdrawalStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Sent => write!(f, "sent"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for WithdrawalStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "sent" => Ok(Self::Sent),
            "failed" => Ok(Self::Failed),
            _ => Err(format!("unknown withdrawal status: {s}")),
        }
    }
}

/// Status of a DEX swap order.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DexOrderStatus {
    Pending,
    Executed,
    Settled,
    Failed,
}

impl std::fmt::Display for DexOrderStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Executed => write!(f, "executed"),
            Self::Settled => write!(f, "settled"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for DexOrderStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "executed" => Ok(Self::Executed),
            "settled" => Ok(Self::Settled),
            "failed" => Ok(Self::Failed),
            _ => Err(format!("unknown dex order status: {s}")),
        }
    }
}

/// A custodial DEX swap order.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DexOrder {
    pub id: String,
    pub user_id: String,
    pub from_asset_key: String,
    pub to_asset_key: String,
    pub amount_in: Amount,
    pub amount_out: Amount,
    pub min_amount_out: Amount,
    pub recipient_address: Option<String>,
    pub route: Vec<String>,
    pub tx_hash: Option<String>,
    pub status: DexOrderStatus,
    pub created_at: DateTime<Utc>,
    pub executed_at: Option<DateTime<Utc>>,
}

/// A withdrawal request.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WithdrawalRecord {
    pub id: String,
    pub user_id: String,
    pub asset_key: String,
    pub amount: Amount,
    pub recipient_address: String,
    pub tx_hash: Option<String>,
    pub status: WithdrawalStatus,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
}
