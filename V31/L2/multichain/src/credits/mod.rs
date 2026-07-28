//! Dharma Credits accounting ledger.
//!
//! All pool rewards, bridge fees, and DEX fees are first credited in Dharma
//! Credits. Users can later redeem them for any supported asset via the
//! Multi-Chain transfer pipeline.

use std::collections::HashMap;
use std::sync::RwLock;

use zion_l1_types::{Address, Amount};

use crate::error::{MultichainError, MultichainResult};

#[derive(Debug, Default)]
pub struct CreditsLedger {
    balances: RwLock<HashMap<String, Amount>>,
}

impl CreditsLedger {
    pub fn new() -> Self {
        Self {
            balances: RwLock::new(HashMap::new()),
        }
    }

    pub fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        let balances = self.balances.read().map_err(|_| {
            MultichainError::Internal("credits ledger poisoned".to_string())
        })?;
        Ok(balances.get(&address.encoded).copied().unwrap_or(Amount::ZERO))
    }

    pub fn credit(&self, address: &Address, amount: Amount) -> MultichainResult<()> {
        if amount == Amount::ZERO {
            return Ok(());
        }
        let mut balances = self.balances.write().map_err(|_| {
            MultichainError::Internal("credits ledger poisoned".to_string())
        })?;
        let entry = balances.entry(address.encoded.clone()).or_insert(Amount::ZERO);
        *entry = entry.saturating_add(amount);
        Ok(())
    }

    pub fn debit(&self, address: &Address, amount: Amount) -> MultichainResult<()> {
        if amount == Amount::ZERO {
            return Ok(());
        }
        let mut balances = self.balances.write().map_err(|_| {
            MultichainError::Internal("credits ledger poisoned".to_string())
        })?;
        let entry = balances.entry(address.encoded.clone()).or_insert(Amount::ZERO);
        if *entry < amount {
            return Err(MultichainError::Validation(
                "insufficient Dharma Credits balance".to_string(),
            ));
        }
        *entry = entry.saturating_sub(amount);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::{Address, Amount, ChainId};

    fn test_addr() -> Address {
        Address::new(ChainId::ZionL1, vec![0u8; 20], "zion1credits").unwrap()
    }

    #[test]
    fn credit_and_debit_update_balance() {
        let ledger = CreditsLedger::new();
        let addr = test_addr();

        ledger.credit(&addr, Amount::new(100)).unwrap();
        assert_eq!(ledger.balance(&addr).unwrap(), Amount::new(100));

        ledger.debit(&addr, Amount::new(30)).unwrap();
        assert_eq!(ledger.balance(&addr).unwrap(), Amount::new(70));
    }

    #[test]
    fn debit_overdraft_fails() {
        let ledger = CreditsLedger::new();
        let addr = test_addr();

        ledger.credit(&addr, Amount::new(10)).unwrap();
        let err = ledger.debit(&addr, Amount::new(20));

        assert!(matches!(err, Err(MultichainError::Validation(_))));
        assert_eq!(ledger.balance(&addr).unwrap(), Amount::new(10));
    }
}
