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
    use crate::protocol::MintInstruction;

    #[test]
    fn test_stellar_adapter() {
        let a = StellarAdapter::new();
        assert_eq!(a.family(), ChainFamily::Stellar);
        assert_eq!(a.name(), "stellar");
    }

    #[tokio::test]
    async fn test_stellar_health() {
        assert!(StellarAdapter::new().health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_stellar_watch_events_empty() {
        assert!(StellarAdapter::new().watch_events().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_stellar_execute_mint_is_stub() {
        let inst = MintInstruction { dest_chain: "test".into(), recipient: "GADDR".into(), amount_dest_atomic: 100, signatures: vec![], warp_message_hash: String::new() };
        assert!(StellarAdapter::new().execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_stellar_height_and_confirmations() {
        let a = StellarAdapter::new();
        assert_eq!(a.current_height().await.unwrap(), 0);
        assert_eq!(a.confirmations("txhash").await.unwrap(), 0);
    }
}
