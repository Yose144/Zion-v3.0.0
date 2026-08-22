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

use crate::warp::config::{ChainConfig, WarpConfig};
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
/// Returns real chain adapters with RPC connectivity. Contract addresses
/// are configured via env vars (see each adapter's `from_env` / `new`).
pub fn create_adapter(chain_name: &str) -> Option<Box<dyn ChainAdapter>> {
    let cfg = ChainConfig {
        name: chain_name.to_string(),
        family: "evm".to_string(),
        enabled: true,
        rpc_url: String::new(),
        contract_address: None,
        finality_blocks: 12,
        disabled_reason: None,
    };
    create_adapter_from_config(&cfg, &WarpConfig::default())
}

/// Factory function from `WarpConfig` — uses per-chain `rpc_url` and
/// `contract_address` overrides when present, falling back to env vars.
pub fn create_adapter_from_config(
    cfg: &ChainConfig,
    warp: &WarpConfig,
) -> Option<Box<dyn ChainAdapter>> {
    let name = cfg.name.as_str();
    let rpc = if cfg.rpc_url.is_empty() {
        None
    } else {
        Some(cfg.rpc_url.as_str())
    };
    let contract = cfg.contract_address.as_deref();
    match name {
        "ethereum" | "base" | "arbitrum" | "optimism" | "bsc" | "polygon" | "avalanche"
        | "zksync" | "linea" => Some(Box::new(evm::EvmAdapter::new_with_config(
            name, rpc, contract,
        ))),
        "solana" => Some(Box::new(solana::SolanaAdapter::from_config(cfg))),
        "tron" => Some(Box::new(tron::TronAdapter::from_config(cfg))),
        "stellar" => Some(Box::new(stellar::StellarAdapter::from_config(cfg))),
        "cardano" => Some(Box::new(cardano::CardanoAdapter::from_config(cfg))),
        "cosmos" => Some(Box::new(cosmos::CosmosAdapter::from_config(cfg))),
        "bitcoin" => Some(Box::new(bitcoin::BitcoinAdapter::from_config(cfg))),
        "sui" => Some(Box::new(sui::SuiAdapter::from_config(cfg))),
        "aptos" => Some(Box::new(aptos::AptosAdapter::from_config(cfg))),
        "near" => Some(Box::new(near::NearAdapter::from_config(cfg))),
        "ton" => Some(Box::new(ton::TonAdapter::from_config(cfg))),
        "lightning" => Some(Box::new(lightning::LightningAdapter::from_config(cfg))),
        "zion-l1" => Some(Box::new(zion_l1::ZionL1Adapter::from_config(warp))),
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
