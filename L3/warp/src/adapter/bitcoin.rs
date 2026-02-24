use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;

/// Bitcoin adapter — HTLC atomic swaps for BTC ↔ ZION.
pub struct BitcoinAdapter;

impl Default for BitcoinAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl BitcoinAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for BitcoinAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Bitcoin
    }
    fn name(&self) -> &str {
        "bitcoin"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        // Bitcoin uses HTLC, not mint — different flow
        Err(WarpError::AdapterError {
            chain: "bitcoin".into(),
            reason: "Bitcoin HTLC adapter stub — W-02".into(),
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
    fn test_bitcoin_adapter() {
        let a = BitcoinAdapter::new();
        assert_eq!(a.family(), ChainFamily::Bitcoin);
        assert_eq!(a.name(), "bitcoin");
    }

    #[tokio::test]
    async fn test_bitcoin_health() {
        let a = BitcoinAdapter::new();
        assert!(a.health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_bitcoin_watch_events_empty() {
        let events = BitcoinAdapter::new().watch_events().await.unwrap();
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn test_bitcoin_execute_mint_is_stub() {
        let inst = MintInstruction { dest_chain: "test".into(), recipient: "1BTC".into(), amount_dest_atomic: 100, signatures: vec![], warp_message_hash: String::new() };
        assert!(BitcoinAdapter::new().execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_bitcoin_height_and_confirmations() {
        let a = BitcoinAdapter::new();
        assert_eq!(a.current_height().await.unwrap(), 0);
        assert_eq!(a.confirmations("txhash").await.unwrap(), 0);
    }
}
