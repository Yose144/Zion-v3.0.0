use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use tracing::info;

/// TON adapter (TVM) — stub implementation.
pub struct TonAdapter;

impl TonAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl ChainAdapter for TonAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Ton
    }

    fn name(&self) -> &str {
        "ton"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        info!("TON health check — stub");
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        Ok(vec![])
    }

    async fn execute_mint(&self, _instruction: &MintInstruction) -> WarpResult<String> {
        Err(WarpError::AdapterNotImplemented("ton".into()))
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
    fn test_ton_adapter_meta() {
        let a = TonAdapter::new();
        assert_eq!(a.name(), "ton");
        assert_eq!(a.family(), ChainFamily::Ton);
    }
}
