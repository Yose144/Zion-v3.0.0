use zion_l1_types::Hash;

use crate::error::{MultichainError, MultichainResult};
use crate::types::{Transfer, TransferDirection, TransferStatus};

/// HTLC atomic-swap coordinator.
#[derive(Debug, Default)]
pub struct HtlcSwap;

impl HtlcSwap {
    pub fn new() -> Self {
        Self
    }

    pub async fn initiate(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        if transfer.direction != TransferDirection::Htlc {
            return Err(MultichainError::Unsupported(
                "HTLC initiate called on non-HTLC transfer".to_string(),
            ));
        }
        if transfer.hashlock.is_none() || transfer.timelock.is_none() {
            return Err(MultichainError::Validation(
                "HTLC requires hashlock and timelock".to_string(),
            ));
        }
        transfer.status = TransferStatus::Executing;
        // Real implementation: deploy/fund contract on source chain.
        Ok(Hash::default())
    }

    pub async fn claim(&self, _secret: &[u8], transfer: &mut Transfer) -> MultichainResult<()> {
        transfer.status = TransferStatus::Completed;
        Ok(())
    }

    pub async fn refund(&self, transfer: &mut Transfer) -> MultichainResult<()> {
        transfer.status = TransferStatus::Refunded;
        Ok(())
    }
}
