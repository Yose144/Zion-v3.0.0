use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use tracing::info;

/// Aptos adapter (MoveVM) — stub implementation.
pub struct AptosAdapter;

impl Default for AptosAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AptosAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for AptosAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Aptos
    }

    fn name(&self) -> &str {
        "aptos"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        info!("Aptos health check — stub");
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterNotImplemented("aptos".into()))
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
    fn test_aptos_adapter_meta() {
        let a = AptosAdapter::new();
        assert_eq!(a.name(), "aptos");
        assert_eq!(a.family(), ChainFamily::Aptos);
    }
}
