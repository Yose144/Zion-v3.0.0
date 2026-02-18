use async_trait::async_trait;
use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;

/// Cosmos adapter — IBC transfers and CW20 token contracts.
pub struct CosmosAdapter;

impl CosmosAdapter {
    pub fn new() -> Self { Self }
}

#[async_trait]
impl ChainAdapter for CosmosAdapter {
    fn family(&self) -> ChainFamily { ChainFamily::Cosmos }
    fn name(&self) -> &str { "cosmos" }

    async fn health_check(&self) -> WarpResult<bool> { Ok(true) }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> { Ok(vec![]) }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterError {
            chain: "cosmos".into(),
            reason: "Cosmos IBC adapter stub".into(),
        })
    }

    async fn current_height(&self) -> WarpResult<u64> { Ok(0) }
    async fn confirmations(&self, _tx_hash: &str) -> WarpResult<u64> { Ok(0) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosmos_adapter() {
        let a = CosmosAdapter::new();
        assert_eq!(a.family(), ChainFamily::Cosmos);
        assert_eq!(a.name(), "cosmos");
    }
}
