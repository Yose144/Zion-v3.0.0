use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;

/// Cardano adapter — Native Token via Plutus smart contracts.
pub struct CardanoAdapter;

impl Default for CardanoAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CardanoAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for CardanoAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Cardano
    }
    fn name(&self) -> &str {
        "cardano"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterError {
            chain: "cardano".into(),
            reason: "Cardano adapter stub".into(),
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
    fn test_cardano_adapter() {
        let a = CardanoAdapter::new();
        assert_eq!(a.family(), ChainFamily::Cardano);
        assert_eq!(a.name(), "cardano");
    }
}
