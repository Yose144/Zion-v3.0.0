use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;

/// Tron adapter — TRC-20 mint/burn via TVM.
pub struct TronAdapter;

impl Default for TronAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl TronAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for TronAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Tron
    }
    fn name(&self) -> &str {
        "tron"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterError {
            chain: "tron".into(),
            reason: "Tron adapter stub".into(),
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
    fn test_tron_adapter() {
        let a = TronAdapter::new();
        assert_eq!(a.family(), ChainFamily::Tron);
        assert_eq!(a.name(), "tron");
    }

    #[tokio::test]
    async fn test_tron_health() {
        assert!(TronAdapter::new().health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_tron_watch_events_empty() {
        assert!(TronAdapter::new().watch_events().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_tron_execute_mint_is_stub() {
        let inst = MintInstruction { dest_chain: "test".into(), recipient: "TAddr".into(), amount_dest_atomic: 100, signatures: vec![], warp_message_hash: String::new() };
        assert!(TronAdapter::new().execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_tron_height_and_confirmations() {
        let a = TronAdapter::new();
        assert_eq!(a.current_height().await.unwrap(), 0);
        assert_eq!(a.confirmations("txhash").await.unwrap(), 0);
    }
}
