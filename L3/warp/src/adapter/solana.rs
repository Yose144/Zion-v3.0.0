use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;

/// Solana adapter — SPL Token mint/burn via Anchor program.
pub struct SolanaAdapter;

impl Default for SolanaAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SolanaAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for SolanaAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Solana
    }
    fn name(&self) -> &str {
        "solana"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        // TODO: W-05 — Connect to Solana RPC (solana-client)
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        // TODO: Watch for SPL token burn events
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterError {
            chain: "solana".into(),
            reason: "Solana adapter not yet connected".into(),
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
    fn test_solana_adapter_basic() {
        let a = SolanaAdapter::new();
        assert_eq!(a.family(), ChainFamily::Solana);
        assert_eq!(a.name(), "solana");
    }

    #[tokio::test]
    async fn test_solana_health() {
        let a = SolanaAdapter::new();
        assert!(a.health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_solana_watch_events_empty() {
        assert!(SolanaAdapter::new().watch_events().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_solana_execute_mint_is_stub() {
        let inst = MintInstruction { dest_chain: "test".into(), recipient: "7xKXtg2CW87d97T".into(), amount_dest_atomic: 100, signatures: vec![], warp_message_hash: String::new() };
        assert!(SolanaAdapter::new().execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_solana_height_and_confirmations() {
        let a = SolanaAdapter::new();
        assert_eq!(a.current_height().await.unwrap(), 0);
        assert_eq!(a.confirmations("txhash").await.unwrap(), 0);
    }
}
