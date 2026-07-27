//! `MultichainService` — the orchestrator that wires adapters, the DB, and
//! the domain modules (bridge, swap, DEX, credits) into one runtime.

use std::collections::HashMap;

use zion_l1_types::{Address, Amount, ChainId};

use crate::chain::adapters::{BitcoinAdapter, EvmAdapter, ZionL1Adapter};
use crate::chain::{ChainAdapter, ChainAdapterRegistry};
use crate::config::{AdapterConfig, MultichainConfig};
use crate::credits::CreditsLedger;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};

/// Top-level runtime for `zion-multichain`.
pub struct MultichainService {
    config: MultichainConfig,
    _db: Db,
    adapters: ChainAdapterRegistry,
    credits: CreditsLedger,
}

impl MultichainService {
    pub fn new(config: MultichainConfig) -> MultichainResult<Self> {
        let db = Db::open(&config.database.path)?;
        let mut adapters = ChainAdapterRegistry::new();

        for cfg in &config.adapters {
            if !cfg.enabled {
                continue;
            }
            let adapter = build_adapter(cfg)?;
            let chain_id = chain_id_by_name(&cfg.chain)?;
            adapters.register(chain_id, adapter);
        }

        Ok(Self {
            config,
            _db: db,
            adapters,
            credits: CreditsLedger::new(),
        })
    }

    /// Returns a snapshot of health for every registered chain.
    pub async fn health(&self) -> HashMap<String, bool> {
        let mut out = HashMap::new();
        for chain in self.adapters.chains() {
            let ok = match self.adapters.get(chain) {
                Some(a) => a.health_check().await.unwrap_or(false),
                None => false,
            };
            out.insert(chain.as_str().to_string(), ok);
        }
        out
    }

    /// List the chain ids currently registered.
    pub fn chains(&self) -> Vec<String> {
        self.adapters
            .chains()
            .into_iter()
            .map(|c| c.as_str().to_string())
            .collect()
    }

    /// Read the current height for a registered chain.
    pub async fn height(&self, chain: ChainId) -> MultichainResult<u64> {
        let adapter = self
            .adapters
            .get(chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(chain.as_str().to_string()))?;
        adapter.current_height().await
    }

    /// Read the native balance for `address` on `chain`.
    pub async fn balance(&self, address: &Address) -> MultichainResult<Amount> {
        let chain = address.chain;
        let adapter = self
            .adapters
            .get(chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(chain.as_str().to_string()))?;
        adapter.balance(address).await
    }

    /// Access the Dharma Credits ledger.
    pub fn credits(&self) -> &CreditsLedger {
        &self.credits
    }

    /// Mutable access to the Dharma Credits ledger.
    pub fn credits_mut(&mut self) -> &mut CreditsLedger {
        &mut self.credits
    }

    /// Borrow the raw adapter registry (useful for tests and advanced callers).
    pub fn adapters(&self) -> &ChainAdapterRegistry {
        &self.adapters
    }
}

fn build_adapter(cfg: &AdapterConfig) -> MultichainResult<Box<dyn ChainAdapter>> {
    let name_lower = cfg.chain.to_lowercase();
    match name_lower.as_str() {
        "bitcoin" | "btc" => Ok(Box::new(BitcoinAdapter::new("bitcoin")?)),
        "base" => Ok(Box::new(EvmAdapter::new(
            "base",
            ChainId::Base,
            &cfg.rpc_url,
        )?)),
        "ethereum" | "eth" => Ok(Box::new(EvmAdapter::new(
            "ethereum",
            ChainId::Ethereum,
            &cfg.rpc_url,
        )?)),
        "zion-l1" | "zion" | "zionl1" => Ok(Box::new(ZionL1Adapter::new(&cfg.rpc_url))),
        _ => Err(MultichainError::AdapterNotFound(format!(
            "no adapter builder for chain '{}': add it to build_adapter()",
            cfg.chain
        ))),
    }
}

fn chain_id_by_name(name: &str) -> MultichainResult<ChainId> {
    let name_lower = name.to_lowercase();
    match name_lower.as_str() {
        "bitcoin" | "btc" => Ok(ChainId::Bitcoin),
        "base" => Ok(ChainId::Base),
        "ethereum" | "eth" => Ok(ChainId::Ethereum),
        "zion-l1" | "zion" | "zionl1" => Ok(ChainId::ZionL1),
        _ => Err(MultichainError::AdapterNotFound(format!(
            "unknown chain id mapping for '{}': add it to chain_id_by_name()",
            name
        ))),
    }
}
