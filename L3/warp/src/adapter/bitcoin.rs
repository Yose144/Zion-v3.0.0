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

    #[test]
    fn test_bitcoin_adapter() {
        let a = BitcoinAdapter::new();
        assert_eq!(a.family(), ChainFamily::Bitcoin);
        assert_eq!(a.name(), "bitcoin");
    }
}
