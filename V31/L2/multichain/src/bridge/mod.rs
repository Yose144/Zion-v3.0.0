//! Bridge / lock-mint logic.
//!
//! The `Bridge` coordinates `Transfer`s with `TransferDirection::LockMint` or
//! `BurnRelease` between two `ChainAdapter`s registered in the system.

use zion_l1_types::Hash;

use crate::chain::ChainAdapterRegistry;
use crate::error::{MultichainError, MultichainResult};
use crate::types::{Transfer, TransferDirection, TransferStatus};

pub struct Bridge {
    adapters: ChainAdapterRegistry,
}

impl Bridge {
    pub fn new(adapters: ChainAdapterRegistry) -> Self {
        Self { adapters }
    }

    pub async fn submit(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        match transfer.direction {
            TransferDirection::LockMint => self.lock_mint(transfer).await,
            TransferDirection::BurnRelease => self.burn_release(transfer).await,
            _ => Err(MultichainError::Unsupported(format!(
                "direction {:?} is not a bridge operation",
                transfer.direction
            ))),
        }
    }

    async fn lock_mint(&self, transfer: &Transfer) -> MultichainResult<Hash> {
        // 1. watch source chain for lock
        // 2. wait for finality
        // 3. execute mint on target chain
        let _adapter = self
            .adapters
            .get(transfer.target.address.chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(transfer.target.address.chain.as_str().to_string()))?;

        // Placeholder: real implementation calls `execute_outbound`.
        Ok(Hash::default())
    }

    async fn burn_release(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        // 1. watch source chain for burn
        // 2. execute release on target chain
        let _adapter = self
            .adapters
            .get(transfer.target.address.chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(transfer.target.address.chain.as_str().to_string()))?;

        transfer.status = TransferStatus::Executing;
        Ok(Hash::default())
    }
}
