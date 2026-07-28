use chrono::Utc;
use sha2::{Digest, Sha256};
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
        let hashlock = transfer.hashlock.ok_or_else(|| {
            MultichainError::Validation("HTLC requires hashlock".to_string())
        })?;
        if transfer.timelock.is_none() {
            return Err(MultichainError::Validation(
                "HTLC requires timelock".to_string(),
            ));
        }
        transfer.status = TransferStatus::Executing;
        // Real implementation: deploy/fund contract on source chain.
        Ok(hashlock)
    }

    pub async fn claim(&self, secret: &[u8], transfer: &mut Transfer) -> MultichainResult<()> {
        let expected = transfer.hashlock.ok_or_else(|| {
            MultichainError::Validation("HTLC missing hashlock".to_string())
        })?;
        let actual = hash_sha256(secret);
        if actual != expected {
            return Err(MultichainError::Validation(
                "HTLC secret does not match hashlock".to_string(),
            ));
        }
        transfer.status = TransferStatus::Completed;
        Ok(())
    }

    pub async fn refund(&self, transfer: &mut Transfer) -> MultichainResult<()> {
        let timelock = transfer.timelock.ok_or_else(|| {
            MultichainError::Validation("HTLC missing timelock".to_string())
        })?;
        let now = Utc::now().timestamp() as u64;
        if now < timelock {
            return Err(MultichainError::Validation(format!(
                "HTLC timelock not expired ({now} < {timelock})"
            )));
        }
        transfer.status = TransferStatus::Refunded;
        Ok(())
    }
}

fn hash_sha256(data: &[u8]) -> Hash {
    Hash::new(Sha256::digest(data).into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TransferEndpoint;
    use zion_l1_types::{Address, Amount, Asset, ChainId};

    fn htlc_transfer(secret: &[u8], timelock: u64) -> Transfer {
        let hashlock = hash_sha256(secret);
        let source = TransferEndpoint {
            address: Address::new(ChainId::Bitcoin, vec![0u8; 20], "bc1qtest").unwrap(),
            asset: Asset::native(ChainId::Bitcoin, "BTC", 8, "Bitcoin"),
            amount: Amount::new(1000),
        };
        let target = TransferEndpoint {
            address: Address::new(ChainId::Ethereum, vec![0u8; 20], "0xdead").unwrap(),
            asset: Asset::native(ChainId::Ethereum, "ETH", 18, "Ether"),
            amount: Amount::new(1000),
        };
        let mut t = Transfer::new("htlc-1", TransferDirection::Htlc, source, target);
        t.hashlock = Some(hashlock);
        t.timelock = Some(timelock);
        t
    }

    #[tokio::test]
    async fn htlc_claim_succeeds_with_valid_secret() {
        let secret = b"preimage";
        let mut transfer = htlc_transfer(secret, u64::MAX);

        HtlcSwap::new().initiate(&mut transfer).await.unwrap();
        HtlcSwap::new().claim(secret, &mut transfer).await.unwrap();

        assert_eq!(transfer.status, TransferStatus::Completed);
    }

    #[tokio::test]
    async fn htlc_claim_fails_with_invalid_secret() {
        let secret = b"preimage";
        let mut transfer = htlc_transfer(secret, u64::MAX);

        HtlcSwap::new().initiate(&mut transfer).await.unwrap();
        let err = HtlcSwap::new().claim(b"wrong", &mut transfer).await;

        assert!(matches!(err, Err(MultichainError::Validation(_))));
    }

    #[tokio::test]
    async fn htlc_refund_fails_before_timelock() {
        let mut transfer = htlc_transfer(b"preimage", u64::MAX);

        HtlcSwap::new().initiate(&mut transfer).await.unwrap();
        let err = HtlcSwap::new().refund(&mut transfer).await;

        assert!(matches!(err, Err(MultichainError::Validation(_))));
    }
}
