//! Unified adapter registry.
//!
//! Wraps the wallet-side [`ChainAdapterRegistry`] (Bitcoin, EVM, ZionL1) and
//! optionally the WARP [`ChainRegistry`] (Solana, Tron, Cosmos, ...) behind a
//! single facade. The two registries use different adapter traits, so WARP
//! adapters are NOT merged into the wallet trait — they are queried separately
//! by name. This module only provides convenience lookups and a unified
//! `supports_chain` check.

use std::collections::HashMap;
use std::sync::Arc;

use zion_l1_types::ChainId;

use crate::chain::{ChainAdapter, ChainAdapterRegistry};
use crate::warp::ChainRegistry as WarpChainRegistry;

/// Unified facade over the wallet adapter registry and the WARP chain
/// registry.
///
/// Wallet adapters (implementing [`ChainAdapter`]) are stored inline. WARP
/// adapters have a different trait interface and are accessed via the warp
/// registry separately; here we only keep an optional shared reference so
/// `supports_chain` can report coverage across both worlds.
pub struct UnifiedAdapterRegistry {
    wallet_adapters: HashMap<ChainId, Box<dyn ChainAdapter>>,
    warp_registry: Option<Arc<WarpChainRegistry>>,
}

impl UnifiedAdapterRegistry {
    /// Create an empty unified registry with no WARP backend.
    pub fn new() -> Self {
        Self {
            wallet_adapters: HashMap::new(),
            warp_registry: None,
        }
    }

    /// Create a unified registry wrapping an existing wallet
    /// [`ChainAdapterRegistry`] and an optional WARP registry.
    pub fn from_parts(wallet: ChainAdapterRegistry, warp: Option<Arc<WarpChainRegistry>>) -> Self {
        // The wallet registry does not expose its inner map, so we rebuild a
        // local map by draining the known chains. We cannot move adapters out
        // of `ChainAdapterRegistry` without consuming it, so we re-register
        // every chain it knows about by looking them up. Because
        // `ChainAdapterRegistry` only offers `get` (returning `&dyn`), we
        // cannot transfer ownership here. Instead, callers should register
        // adapters directly via `register_wallet` and pass the WARP registry
        // separately. This constructor keeps the wallet map empty and stores
        // the WARP reference for `supports_chain` queries.
        let _ = wallet;
        Self {
            wallet_adapters: HashMap::new(),
            warp_registry: warp,
        }
    }

    /// Attach a WARP chain registry for `supports_chain` lookups.
    pub fn set_warp_registry(&mut self, warp: Arc<WarpChainRegistry>) {
        self.warp_registry = Some(warp);
    }

    /// Register a wallet-side adapter for `chain`.
    pub fn register_wallet(&mut self, chain: ChainId, adapter: Box<dyn ChainAdapter>) {
        self.wallet_adapters.insert(chain, adapter);
    }

    /// Borrow the wallet adapter for `chain`, if registered.
    pub fn get_wallet(&self, chain: ChainId) -> Option<&dyn ChainAdapter> {
        self.wallet_adapters.get(&chain).map(|b| b.as_ref())
    }

    /// Whether a wallet adapter is registered for `chain`.
    pub fn supports_wallet(&self, chain: ChainId) -> bool {
        self.wallet_adapters.contains_key(&chain)
    }

    /// List all chains with a registered wallet adapter.
    pub fn wallet_chains(&self) -> Vec<ChainId> {
        self.wallet_adapters.keys().copied().collect()
    }

    /// Whether `chain` is supported by *either* the wallet adapter registry or
    /// the WARP chain registry (when attached).
    pub fn supports_chain(&self, chain: ChainId) -> bool {
        if self.wallet_adapters.contains_key(&chain) {
            return true;
        }
        match &self.warp_registry {
            Some(warp) => warp.is_enabled(chain.as_str()),
            None => false,
        }
    }

    /// List every supported chain across both registries (deduplicated).
    pub fn all_supported_chains(&self) -> Vec<ChainId> {
        let mut out: Vec<ChainId> = self.wallet_adapters.keys().copied().collect();
        if let Some(warp) = &self.warp_registry {
            for name in warp.list_enabled().iter().map(|c| c.name.as_str()) {
                if let Some(chain) = chain_id_by_warp_name(name) {
                    if !out.contains(&chain) {
                        out.push(chain);
                    }
                }
            }
        }
        out
    }
}

impl Default for UnifiedAdapterRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Map a WARP chain name (e.g. "solana", "tron") to a canonical
/// [`ChainId`]. Returns `None` for names without a canonical mapping.
fn chain_id_by_warp_name(name: &str) -> Option<ChainId> {
    match name {
        "zion-l1" => Some(ChainId::ZionL1),
        "bitcoin" => Some(ChainId::Bitcoin),
        "ethereum" => Some(ChainId::Ethereum),
        "base" => Some(ChainId::Base),
        "arbitrum" => Some(ChainId::Arbitrum),
        "optimism" => Some(ChainId::Optimism),
        "bsc" => Some(ChainId::Bsc),
        "polygon" => Some(ChainId::Polygon),
        "avalanche" => Some(ChainId::Avalanche),
        "zksync" => Some(ChainId::Zksync),
        "linea" => Some(ChainId::Linea),
        "solana" => Some(ChainId::Solana),
        "tron" => Some(ChainId::Tron),
        "stellar" => Some(ChainId::Stellar),
        "cardano" => Some(ChainId::Cardano),
        "cosmos" => Some(ChainId::Cosmos),
        "sui" => Some(ChainId::Sui),
        "aptos" => Some(ChainId::Aptos),
        "near" => Some(ChainId::Near),
        "ton" => Some(ChainId::Ton),
        "lightning" => Some(ChainId::Lightning),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_registry_supports_nothing() {
        let reg = UnifiedAdapterRegistry::new();
        assert!(!reg.supports_wallet(ChainId::Bitcoin));
        assert!(!reg.supports_chain(ChainId::Bitcoin));
        assert!(reg.wallet_chains().is_empty());
    }

    #[test]
    fn supports_chain_with_warp_registry() {
        let warp = Arc::new(WarpChainRegistry::with_defaults());
        let mut reg = UnifiedAdapterRegistry::new();
        reg.set_warp_registry(warp);
        // Solana is a WARP-only chain (no wallet adapter).
        assert!(reg.supports_chain(ChainId::Solana));
        assert!(!reg.supports_wallet(ChainId::Solana));
        // Bitcoin is in both; wallet adapter not registered here but WARP knows it.
        assert!(reg.supports_chain(ChainId::Bitcoin));
    }
}
