use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use tracing::info;

/// NEAR adapter — stub implementation.
pub struct NearAdapter;

impl Default for NearAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl NearAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for NearAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Near
    }

    fn name(&self) -> &str {
        "near"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        info!("NEAR health check — stub");
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterNotImplemented("near".into()))
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
    fn test_near_adapter_meta() {
        let a = NearAdapter::new();
        assert_eq!(a.name(), "near");
        assert_eq!(a.family(), ChainFamily::Near);
    }
}
