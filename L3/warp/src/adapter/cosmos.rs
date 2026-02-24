use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;

/// Cosmos adapter — IBC transfers and CW20 token contracts.
pub struct CosmosAdapter;

impl Default for CosmosAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CosmosAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for CosmosAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Cosmos
    }
    fn name(&self) -> &str {
        "cosmos"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterError {
            chain: "cosmos".into(),
            reason: "Cosmos IBC adapter stub".into(),
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
    use crate::protocol::MintInstruction;

    #[test]
    fn test_cosmos_adapter() {
        let a = CosmosAdapter::new();
        assert_eq!(a.family(), ChainFamily::Cosmos);
        assert_eq!(a.name(), "cosmos");
    }

    #[tokio::test]
    async fn test_cosmos_health() {
        assert!(CosmosAdapter::new().health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_cosmos_watch_events_empty() {
        assert!(CosmosAdapter::new().watch_events().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_cosmos_execute_mint_is_stub() {
        let inst = MintInstruction { dest_chain: "test".into(), recipient: "cosmos1abc".into(), amount_dest_atomic: 100, signatures: vec![], warp_message_hash: String::new() };
        assert!(CosmosAdapter::new().execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_cosmos_height_and_confirmations() {
        let a = CosmosAdapter::new();
        assert_eq!(a.current_height().await.unwrap(), 0);
        assert_eq!(a.confirmations("txhash").await.unwrap(), 0);
    }
}
