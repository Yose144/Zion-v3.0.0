use zion_l1_types::{Address, Amount, Asset};

use crate::error::{MultichainError, MultichainResult};
use crate::types::{Transfer, TransferDirection, TransferStatus};

/// DEX routing and settlement.
#[derive(Debug, Default)]
pub struct DexRouter;

impl DexRouter {
    pub fn new() -> Self {
        Self
    }

    /// Return the best route and expected output for a swap.
    pub async fn quote(
        &self,
        _from: &Asset,
        _to: &Asset,
        _amount: Amount,
    ) -> MultichainResult<Quote> {
        // Placeholder: real implementation queries liquidity graph/AMM.
        Ok(Quote {
            route: vec![],
            expected_out: Amount::ZERO,
            slippage_bps: 0,
        })
    }

    pub async fn execute(&self, transfer: &mut Transfer) -> MultichainResult<()> {
        if transfer.direction != TransferDirection::Dex {
            return Err(MultichainError::Unsupported(
                "DEX execute called on non-DEX transfer".to_string(),
            ));
        }
        transfer.status = TransferStatus::Executing;
        // Placeholder: real implementation composes AMM/bridge steps.
        transfer.status = TransferStatus::Completed;
        Ok(())
    }
}

/// A quote from the DEX router.
#[derive(Clone, Debug)]
pub struct Quote {
    pub route: Vec<Address>,
    pub expected_out: Amount,
    pub slippage_bps: u16,
}
