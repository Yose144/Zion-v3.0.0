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

    #[test]
    fn test_tron_adapter() {
        let a = TronAdapter::new();
        assert_eq!(a.family(), ChainFamily::Tron);
        assert_eq!(a.name(), "tron");
    }
}
