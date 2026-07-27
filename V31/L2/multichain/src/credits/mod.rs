//! Dharma Credits accounting ledger.
//!
//! All pool rewards, bridge fees, and DEX fees are first credited in Dharma
//! Credits. Users can later redeem them for any supported asset via the
//! Multi-Chain transfer pipeline.

use zion_l1_types::{Address, Amount};

use crate::error::{MultichainError, MultichainResult};

#[derive(Debug, Default)]
pub struct CreditsLedger;

impl CreditsLedger {
    pub fn new() -> Self {
        Self
    }

    pub fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
        // Placeholder: read from DB.
        Ok(Amount::ZERO)
    }

    pub fn credit(&mut self, _address: &Address, _amount: Amount) -> MultichainResult<()> {
        // Placeholder: persist atomic credit.
        Ok(())
    }

    pub fn debit(&mut self, address: &Address, amount: Amount) -> MultichainResult<()> {
        let balance = self.balance(address)?;
        if balance < amount {
            return Err(MultichainError::Validation(
                "insufficient Dharma Credits balance".to_string(),
            ));
        }
        // Placeholder: persist atomic debit.
        Ok(())
    }
}
