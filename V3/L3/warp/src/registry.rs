use crate::error::{WarpError, WarpResult};
use crate::types::ChainId;
use std::collections::HashMap;

/// Registry of supported chains. Manages enabling/disabling chains.
pub struct ChainRegistry {
    chains: HashMap<String, ChainEntry>,
}

struct ChainEntry {
    chain_id: ChainId,
    enabled: bool,
}

impl ChainRegistry {
    pub fn new() -> Self {
        Self {
            chains: HashMap::new(),
        }
    }

    /// Create a registry pre-populated with all 10 default chains.
    pub fn with_defaults() -> Self {
        let mut reg = Self::new();
        // EVM chains
        reg.register(ChainId::evm("ethereum", 1, 12));
        reg.register(ChainId::evm("base", 8453, 12));
        reg.register(ChainId::evm("arbitrum", 42161, 20));
        reg.register(ChainId::evm("optimism", 10, 20));
        reg.register(ChainId::evm("bsc", 56, 15));
        reg.register(ChainId::evm("polygon", 137, 128));
        reg.register(ChainId::evm("avalanche", 43114, 20));
        reg.register(ChainId::evm("zksync", 324, 20));
        reg.register(ChainId::evm("linea", 59144, 20));
        // Non-EVM
        reg.register(ChainId::solana());
        reg.register(ChainId::tron());
        reg.register(ChainId::stellar());
        reg.register(ChainId::cardano());
        reg.register(ChainId::cosmos());
        reg.register(ChainId::bitcoin());
        reg.register(ChainId::sui());
        reg.register(ChainId::aptos());
        reg.register(ChainId::near());
        reg.register(ChainId::ton());
        reg.register(ChainId::lightning());
        // Always available
        reg.register(ChainId::zion_l1());
        reg
    }

    pub fn register(&mut self, chain: ChainId) {
        self.chains.insert(
            chain.name.clone(),
            ChainEntry {
                chain_id: chain,
                enabled: true,
            },
        );
    }

    pub fn get(&self, name: &str) -> WarpResult<&ChainId> {
        let entry = self
            .chains
            .get(name)
            .ok_or_else(|| WarpError::UnsupportedChain(name.to_string()))?;
        if !entry.enabled {
            return Err(WarpError::ChainDisabled {
                chain: name.to_string(),
            });
        }
        Ok(&entry.chain_id)
    }

    pub fn disable(&mut self, name: &str) -> WarpResult<()> {
        let entry = self
            .chains
            .get_mut(name)
            .ok_or_else(|| WarpError::UnsupportedChain(name.to_string()))?;
        entry.enabled = false;
        Ok(())
    }

    pub fn enable(&mut self, name: &str) -> WarpResult<()> {
        let entry = self
            .chains
            .get_mut(name)
            .ok_or_else(|| WarpError::UnsupportedChain(name.to_string()))?;
        entry.enabled = true;
        Ok(())
    }

    pub fn is_enabled(&self, name: &str) -> bool {
        self.chains.get(name).map(|e| e.enabled).unwrap_or(false)
    }

    pub fn list_enabled(&self) -> Vec<&ChainId> {
        self.chains
            .values()
            .filter(|e| e.enabled)
            .map(|e| &e.chain_id)
            .collect()
    }

    pub fn list_all(&self) -> Vec<(&String, bool)> {
        self.chains
            .iter()
            .map(|(name, entry)| (name, entry.enabled))
            .collect()
    }

    pub fn chain_count(&self) -> usize {
        self.chains.len()
    }

    pub fn enabled_count(&self) -> usize {
        self.chains.values().filter(|e| e.enabled).count()
    }
}

impl Default for ChainRegistry {
    fn default() -> Self {
        Self::with_defaults()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ChainFamily;

    #[test]
    fn test_registry_defaults() {
        let reg = ChainRegistry::with_defaults();
        assert_eq!(reg.chain_count(), 21); // 9 EVM + 11 non-EVM + ZION L1
    }

    #[test]
    fn test_registry_get_base() {
        let reg = ChainRegistry::with_defaults();
        let base = reg.get("base").unwrap();
        assert_eq!(base.family, ChainFamily::Evm);
        assert_eq!(base.decimals, 18);
    }

    #[test]
    fn test_registry_get_solana() {
        let reg = ChainRegistry::with_defaults();
        let sol = reg.get("solana").unwrap();
        assert_eq!(sol.family, ChainFamily::Solana);
    }

    #[test]
    fn test_registry_get_unknown() {
        let reg = ChainRegistry::with_defaults();
        assert!(reg.get("fantom").is_err());
    }

    #[test]
    fn test_registry_disable_enable() {
        let mut reg = ChainRegistry::with_defaults();
        assert!(reg.is_enabled("bitcoin"));
        reg.disable("bitcoin").unwrap();
        assert!(!reg.is_enabled("bitcoin"));
        assert!(reg.get("bitcoin").is_err()); // disabled
        reg.enable("bitcoin").unwrap();
        assert!(reg.get("bitcoin").is_ok());
    }

    #[test]
    fn test_registry_list_enabled() {
        let mut reg = ChainRegistry::with_defaults();
        let initial = reg.enabled_count();
        reg.disable("tron").unwrap();
        assert_eq!(reg.enabled_count(), initial - 1);
    }

    #[test]
    fn test_registry_custom_chain() {
        let mut reg = ChainRegistry::new();
        reg.register(ChainId::evm("optimism", 10, 20));
        assert_eq!(reg.chain_count(), 1);
        let opt = reg.get("optimism").unwrap();
        assert_eq!(opt.chain_id_numeric, Some(10));
    }

    #[test]
    fn test_registry_disable_unknown() {
        let mut reg = ChainRegistry::with_defaults();
        assert!(reg.disable("nonexistent").is_err());
    }

    #[test]
    fn test_registry_list_all() {
        let reg = ChainRegistry::with_defaults();
        let all = reg.list_all();
        assert_eq!(all.len(), 21);
        assert!(all.iter().all(|(_, enabled)| *enabled));
    }
}
