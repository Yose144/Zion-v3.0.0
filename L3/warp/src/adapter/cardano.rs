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
    use crate::protocol::MintInstruction;

    #[test]
    fn test_cardano_adapter() {
        let a = CardanoAdapter::new();
        assert_eq!(a.family(), ChainFamily::Cardano);
        assert_eq!(a.name(), "cardano");
    }

    #[tokio::test]
    async fn test_cardano_health() {
        assert!(CardanoAdapter::new().health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_cardano_watch_events_empty() {
        assert!(CardanoAdapter::new().watch_events().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_cardano_execute_mint_is_stub() {
        let inst = MintInstruction { dest_chain: "test".into(), recipient: "addr1xyz".into(), amount_dest_atomic: 100, signatures: vec![], warp_message_hash: String::new() };
        assert!(CardanoAdapter::new().execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_cardano_height_and_confirmations() {
        let a = CardanoAdapter::new();
        assert_eq!(a.current_height().await.unwrap(), 0);
        assert_eq!(a.confirmations("txhash").await.unwrap(), 0);
    }
}
