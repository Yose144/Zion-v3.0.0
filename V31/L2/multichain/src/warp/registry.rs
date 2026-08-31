use crate::warp::error::{WarpError, WarpResult};
use crate::warp::types::{ChainId, ChainStatus};
use std::collections::HashMap;

use crate::warp::config::ChainConfig;

/// Registry of supported chains. Manages enabling/disabling chains.
pub struct ChainRegistry {
    chains: HashMap<String, ChainEntry>,
}

struct ChainEntry {
    chain_id: ChainId,
    enabled: bool,
    /// Human-readable reason if the chain is disabled (e.g. contract not deployed).
    disabled_reason: Option<String>,
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

    /// Build a registry from the WARP `chains` config. Empty config falls back
    /// to `with_defaults()` for backward compatibility.
    pub fn from_config(chains: &[ChainConfig]) -> WarpResult<Self> {
        if chains.is_empty() {
            return Ok(Self::with_defaults());
        }

        let mut reg = Self::new();
        for chain in chains {
            let chain_id = ChainId::from_config(&chain.name, &chain.family, chain.finality_blocks)
                .ok_or_else(|| {
                    WarpError::Config(format!(
                        "unsupported chain family '{}' for chain '{}' in WARP config",
                        chain.family, chain.name
                    ))
                })?;
            reg.register_with_reason(
                chain_id,
                chain.enabled,
                if chain.enabled {
                    None
                } else {
                    chain.disabled_reason.clone()
                },
            );
        }
        Ok(reg)
    }

    pub fn register(&mut self, chain: ChainId) {
        self.register_with_reason(chain, true, None);
    }

    pub fn register_with_reason(
        &mut self,
        chain: ChainId,
        enabled: bool,
        disabled_reason: Option<String>,
    ) {
        self.chains.insert(
            chain.name.clone(),
            ChainEntry {
                chain_id: chain,
                enabled,
                disabled_reason,
            },
        );
    }

    pub fn get(&self, name: &str) -> WarpResult<&ChainId> {
        let entry = self
            .chains
            .get(name)
            .ok_or_else(|| WarpError::UnsupportedChain(name.to_string()))?;
        if !entry.enabled {
            let reason = entry
                .disabled_reason
                .clone()
                .unwrap_or_else(|| "disabled by operator".to_string());
            return Err(WarpError::ChainDisabled {
                chain: name.to_string(),
                reason,
            });
        }
        Ok(&entry.chain_id)
    }

    pub fn disable(&mut self, name: &str, reason: Option<String>) -> WarpResult<()> {
        let entry = self
            .chains
            .get_mut(name)
            .ok_or_else(|| WarpError::UnsupportedChain(name.to_string()))?;
        entry.enabled = false;
        if let Some(r) = reason {
            entry.disabled_reason = Some(r);
        }
        Ok(())
    }

    pub fn enable(&mut self, name: &str) -> WarpResult<()> {
        let entry = self
            .chains
            .get_mut(name)
            .ok_or_else(|| WarpError::UnsupportedChain(name.to_string()))?;
        entry.enabled = true;
        entry.disabled_reason = None;
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

    pub fn list_chain_status(&self) -> Vec<ChainStatus> {
        self.chains
            .values()
            .map(|entry| ChainStatus {
                name: entry.chain_id.name.clone(),
                family: entry.chain_id.family.to_string(),
                enabled: entry.enabled,
                disabled_reason: entry.disabled_reason.clone(),
            })
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
    use crate::warp::types::ChainFamily;

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
    fn test_registry_get_bsc() {
        let reg = ChainRegistry::with_defaults();
        let bsc = reg.get("bsc").unwrap();
        assert_eq!(bsc.family, ChainFamily::Evm);
        assert_eq!(bsc.chain_id_numeric, Some(56));
        assert_eq!(bsc.decimals, 18);
        assert_eq!(bsc.finality_blocks, 15);
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
        reg.disable("bitcoin", Some("test disable".into())).unwrap();
        assert!(!reg.is_enabled("bitcoin"));
        assert!(reg.get("bitcoin").is_err()); // disabled
        reg.enable("bitcoin").unwrap();
        assert!(reg.get("bitcoin").is_ok());
    }

    #[test]
    fn test_registry_list_enabled() {
        let mut reg = ChainRegistry::with_defaults();
        let initial = reg.enabled_count();
        reg.disable("tron", None).unwrap();
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
        assert!(reg.disable("nonexistent", None).is_err());
    }

    #[test]
    fn test_registry_list_all() {
        let reg = ChainRegistry::with_defaults();
        let all = reg.list_all();
        assert_eq!(all.len(), 21);
        assert!(all.iter().all(|(_, enabled)| *enabled));
    }

    #[test]
    fn test_registry_from_config() {
        use crate::warp::config::ChainConfig;

        let chains = vec![
            ChainConfig {
                name: "base".into(),
                family: "evm".into(),
                enabled: true,
                rpc_url: "".into(),
                contract_address: None,
                finality_blocks: 12,
                disabled_reason: None,
            },
            ChainConfig {
                name: "aptos".into(),
                family: "aptos".into(),
                enabled: false,
                rpc_url: "".into(),
                contract_address: None,
                finality_blocks: 3,
                disabled_reason: Some("BCS not implemented".into()),
            },
        ];
        let reg = ChainRegistry::from_config(&chains).unwrap();
        assert!(reg.is_enabled("base"));
        assert!(!reg.is_enabled("aptos"));
        assert!(reg.get("aptos").is_err());
        let status = reg.list_chain_status();
        let aptos = status.iter().find(|s| s.name == "aptos").unwrap();
        assert!(!aptos.enabled);
        assert_eq!(
            aptos.disabled_reason.as_deref(),
            Some("BCS not implemented")
        );
    }
}
