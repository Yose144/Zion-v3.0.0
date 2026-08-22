use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use zion_l1_types::{Address, Amount, Asset, Hash};

/// A value-moving operation in the Multi-Chain layer.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Transfer {
    pub id: String,
    pub direction: TransferDirection,
    pub source: TransferEndpoint,
    pub target: TransferEndpoint,
    pub status: TransferStatus,
    pub hashlock: Option<Hash>,
    pub timelock: Option<u64>,
    pub preimage: Option<Hash>,
    /// For HTLC claim/refund: the on-chain lock transaction id that created
    /// the UTXO this transfer must spend (Zion L1 UTXO adapter).
    pub lock_tx_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct TransferEndpoint {
    pub address: Address,
    pub asset: Asset,
    pub amount: Amount,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferDirection {
    /// Lock on source chain, mint wrapped asset on target chain.
    LockMint,
    /// Burn wrapped asset, release native asset on target chain.
    BurnRelease,
    /// HTLC atomic swap.
    Htlc,
    /// DEX swap within or across chains.
    Dex,
}

/// Unified status machine for every transfer mode.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferStatus {
    Pending,
    Detected,
    AwaitingFinality,
    Validating,
    QuorumReached,
    Executing,
    Completed,
    Failed,
    Refunded,
    Timelocked,
}

impl Transfer {
    pub fn new(
        id: impl Into<String>,
        direction: TransferDirection,
        source: TransferEndpoint,
        target: TransferEndpoint,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: id.into(),
            direction,
            source,
            target,
            status: TransferStatus::Pending,
            hashlock: None,
            timelock: None,
            preimage: None,
            lock_tx_id: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(
            self.status,
            TransferStatus::Completed | TransferStatus::Failed | TransferStatus::Refunded
        )
    }
}
