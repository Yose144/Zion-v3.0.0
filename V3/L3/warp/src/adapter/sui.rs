use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use tracing::info;

/// Sui adapter (MoveVM) — stub implementation.
pub struct SuiAdapter;

impl Default for SuiAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SuiAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for SuiAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Sui
    }

    fn name(&self) -> &str {
        "sui"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        info!("Sui health check — stub");
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterNotImplemented("sui".into()))
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
    fn test_sui_adapter_meta() {
        let a = SuiAdapter::new();
        assert_eq!(a.name(), "sui");
        assert_eq!(a.family(), ChainFamily::Sui);
    }
}
