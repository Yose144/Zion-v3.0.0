use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;

/// Stellar adapter — Stellar Asset / Soroban smart contract.
pub struct StellarAdapter;

impl Default for StellarAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl StellarAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for StellarAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Stellar
    }
    fn name(&self) -> &str {
        "stellar"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterError {
            chain: "stellar".into(),
            reason: "Stellar adapter stub".into(),
        })
    }

    async fn current_height(&self) -> WarpResult<u64> {
        Ok(0)
    }
    async fn confirmations(&self, _tx_hash: &str) -> WarpResult<u64> {
        Ok(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stellar_adapter() {
        let a = StellarAdapter::new();
        assert_eq!(a.family(), ChainFamily::Stellar);
        assert_eq!(a.name(), "stellar");
    }
}
