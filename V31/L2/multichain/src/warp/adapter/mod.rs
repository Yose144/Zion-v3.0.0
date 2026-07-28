pub mod aptos;
pub mod bitcoin;
pub mod cardano;
pub mod cosmos;
pub mod evm;
pub mod lightning;
pub mod near;
pub mod solana;
pub mod stellar;
pub mod sui;
pub mod ton;
pub mod tron;
pub mod zion_l1;

use crate::warp::error::WarpResult;
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;

/// Trait that all chain adapters must implement.
#[async_trait]
pub trait ChainAdapter: Send + Sync {
    /// Chain family this adapter handles.
    fn family(&self) -> ChainFamily;

    /// Chain name (e.g. "base", "solana").
    fn name(&self) -> &str;

    /// Check if the adapter is connected and functional.
    async fn health_check(&self) -> WarpResult<bool>;

    /// Watch for deposit/burn events (long-running).
    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>>;

    /// Execute a mint instruction on the destination chain.
    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String>;

    /// Get the current block height on this chain.
    async fn current_height(&self) -> WarpResult<u64>;

    /// Get confirmation count for a specific transaction.
    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64>;
}

/// Factory function — create an adapter by chain name.
/// Currently returns stub adapters; real implementations will use chain-specific SDKs.
pub fn create_adapter(chain_name: &str) -> Option<Box<dyn ChainAdapter>> {
    match chain_name {
        "ethereum" | "base" | "arbitrum" | "optimism" | "bsc" | "polygon" | "avalanche"
        | "zksync" | "linea" => Some(Box::new(evm::EvmAdapter::new(chain_name))),
        "solana" => Some(Box::new(solana::SolanaAdapter::new())),
        "tron" => Some(Box::new(tron::TronAdapter::new())),
        "stellar" => Some(Box::new(stellar::StellarAdapter::new())),
        "cardano" => Some(Box::new(cardano::CardanoAdapter::new())),
        "cosmos" => Some(Box::new(cosmos::CosmosAdapter::new())),
        "bitcoin" => Some(Box::new(bitcoin::BitcoinAdapter::new())),
        "sui" => Some(Box::new(sui::SuiAdapter::new())),
        "aptos" => Some(Box::new(aptos::AptosAdapter::new())),
        "near" => Some(Box::new(near::NearAdapter::new())),
        "ton" => Some(Box::new(ton::TonAdapter::new())),
        "lightning" => Some(Box::new(lightning::LightningAdapter::new())),
        "zion-l1" => Some(Box::new(zion_l1::ZionL1Adapter::from_config(&crate::warp::config::WarpConfig::default()))),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_adapter_evm() {
        assert!(create_adapter("ethereum").is_some());
        assert!(create_adapter("base").is_some());
        assert!(create_adapter("arbitrum").is_some());
        assert!(create_adapter("optimism").is_some());
        assert!(create_adapter("bsc").is_some());
        assert!(create_adapter("polygon").is_some());
        assert!(create_adapter("avalanche").is_some());
        assert!(create_adapter("zksync").is_some());
        assert!(create_adapter("linea").is_some());
    }

    #[test]
    fn test_create_adapter_non_evm() {
        assert!(create_adapter("solana").is_some());
        assert!(create_adapter("tron").is_some());
        assert!(create_adapter("stellar").is_some());
        assert!(create_adapter("cardano").is_some());
        assert!(create_adapter("cosmos").is_some());
        assert!(create_adapter("bitcoin").is_some());
        assert!(create_adapter("sui").is_some());
        assert!(create_adapter("aptos").is_some());
        assert!(create_adapter("near").is_some());
        assert!(create_adapter("ton").is_some());
        assert!(create_adapter("lightning").is_some());
    }

    #[test]
    fn test_create_adapter_unknown() {
        assert!(create_adapter("fantom").is_none());
        assert!(create_adapter("").is_none());
    }

    #[test]
    fn test_create_adapter_zion_l1() {
        // Note: this may return None if env vars not set, but should not panic
        let _ = create_adapter("zion-l1");
    }
}
