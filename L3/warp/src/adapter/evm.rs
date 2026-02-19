use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;

/// EVM adapter supporting Base, Arbitrum, BSC, Polygon.
/// Uses ethers-rs for real RPC calls (stub for now).
pub struct EvmAdapter {
    chain_name: String,
}

impl EvmAdapter {
    pub fn new(chain_name: &str) -> Self {
        Self {
            chain_name: chain_name.to_string(),
        }
    }
}

#[async_trait]
impl ChainAdapter for EvmAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Evm
    }
    fn name(&self) -> &str {
        &self.chain_name
    }

    async fn health_check(&self) -> WarpResult<bool> {
        // TODO: W-01 — Connect to real EVM RPC via ethers-rs
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        // TODO: Watch for BridgeBurn events on wZION contract
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        // TODO: Call bridgeMint() on wZION contract
        Err(WarpError::AdapterError {
            chain: self.chain_name.clone(),
            reason: "EVM adapter not yet connected to real RPC".into(),
        })
    }

    async fn current_height(&self) -> WarpResult<u64> {
        // TODO: eth_blockNumber
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
    fn test_evm_adapter_name() {
        let adapter = EvmAdapter::new("base");
        assert_eq!(adapter.name(), "base");
        assert_eq!(adapter.family(), ChainFamily::Evm);
    }

    #[test]
    fn test_evm_adapter_arbitrum() {
        let adapter = EvmAdapter::new("arbitrum");
        assert_eq!(adapter.name(), "arbitrum");
    }

    #[tokio::test]
    async fn test_evm_health_check() {
        let adapter = EvmAdapter::new("bsc");
        assert!(adapter.health_check().await.unwrap());
    }

    #[tokio::test]
    async fn test_evm_watch_events_empty() {
        let adapter = EvmAdapter::new("polygon");
        let events = adapter.watch_events().await.unwrap();
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn test_evm_execute_mint_stub() {
        let adapter = EvmAdapter::new("base");
        let inst = MintInstruction {
            dest_chain: "base".into(),
            recipient: "0xabc".into(),
            amount_dest_atomic: 1_000_000_000_000_000_000,
            signatures: vec![],
            warp_message_hash: "hash".into(),
        };
        assert!(adapter.execute_mint(&inst).await.is_err());
    }
}
