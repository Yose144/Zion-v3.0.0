//! `MultichainService` — the orchestrator that wires adapters, the DB, and
//! the domain modules (bridge, swap, DEX, credits) into one runtime.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{Mutex, RwLock};
use zion_l1_types::{Address, Amount, Asset, ChainId, Hash};

use crate::bridge::Bridge;
use crate::chain::adapters::{BitcoinAdapter, EvmAdapter, ZionL1Adapter};
use crate::chain::{ChainAdapter, ChainAdapterRegistry};
use crate::config::{AdapterConfig, MultichainConfig};
use crate::contracts::ZionContracts;
use crate::credits::CreditsLedger;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::swap::dex::{DexRouter, Pool, Quote};
use crate::types::Transfer;
use crate::wallet::Keyring;

/// Top-level runtime for `zion-multichain`.
pub struct MultichainService {
    #[allow(dead_code)]
    config: MultichainConfig,
    #[allow(dead_code)]
    _db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    bridge: Bridge,
    keyring: Keyring,
    credits: CreditsLedger,
    dex: RwLock<DexRouter>,
}

impl MultichainService {
    pub fn new(config: MultichainConfig) -> MultichainResult<Self> {
        let db = Arc::new(Mutex::new(Db::open(&config.database.path)?));
        let keyring = Keyring::generate()?;
        let mut adapters = ChainAdapterRegistry::new();

        for cfg in &config.adapters {
            if !cfg.enabled {
                continue;
            }
            let adapter = build_adapter(cfg, &keyring)?;
            let chain_id = chain_id_by_name(&cfg.chain)?;
            adapters.register(chain_id, adapter);
        }

        Ok(Self::from_parts(config, db, Arc::new(adapters), keyring))
    }

    /// Build a service from an already-constructed registry. Useful in tests
    /// and for advanced callers that create adapters programmatically.
    pub fn new_with_adapters(
        config: MultichainConfig,
        adapters: ChainAdapterRegistry,
    ) -> MultichainResult<Self> {
        let db = Arc::new(Mutex::new(Db::open(&config.database.path)?));
        let keyring = Keyring::generate()?;
        Ok(Self::from_parts(config, db, Arc::new(adapters), keyring))
    }

    fn from_parts(
        config: MultichainConfig,
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        keyring: Keyring,
    ) -> Self {
        let bridge = Bridge::new(Arc::clone(&adapters));
        Self {
            config,
            _db: db,
            adapters,
            bridge,
            keyring,
            credits: CreditsLedger::new(),
            dex: RwLock::new(DexRouter::new()),
        }
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

    /// Add an AMM liquidity pool to the DEX router.
    pub async fn add_dex_pool(&self, pool: Pool) {
        self.dex.write().await.add_pool(pool);
    }

    /// Return a DEX quote for swapping `amount` of `from` into `to`.
    pub async fn dex_quote(
        &self,
        from: &Asset,
        to: &Asset,
        amount: Amount,
    ) -> MultichainResult<Quote> {
        self.dex.read().await.quote(from, to, amount)
    }

    /// Execute a DEX swap and return the output amount.
    pub async fn dex_swap(
        &self,
        from: &Asset,
        to: &Asset,
        amount: Amount,
    ) -> MultichainResult<Amount> {
        self.dex.write().await.execute(from, to, amount)
    }

    /// Access the bridge module.
    pub fn bridge(&self) -> &Bridge {
        &self.bridge
    }

    /// Submit a cross-chain bridge transfer.
    pub async fn bridge_submit(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        self.bridge.submit(transfer).await
    }

    /// Access the wallet keyring.
    pub fn keyring(&self) -> &Keyring {
        &self.keyring
    }

    /// Derive a wallet address for a chain.
    pub fn wallet_address(
        &self,
        chain: ChainId,
        account: u32,
        index: u32,
    ) -> MultichainResult<Address> {
        self.keyring.address(chain, account, index)
    }

    /// Sign a message with the wallet key for a chain.
    pub fn wallet_sign(
        &self,
        chain: ChainId,
        message: &[u8],
        account: u32,
        index: u32,
    ) -> MultichainResult<Vec<u8>> {
        self.keyring.sign(chain, message, account, index)
    }

    /// Borrow the raw adapter registry (useful for tests and advanced callers).
    pub fn adapters(&self) -> &ChainAdapterRegistry {
        self.adapters.as_ref()
    }
}

fn build_adapter(cfg: &AdapterConfig, keyring: &Keyring) -> MultichainResult<Box<dyn ChainAdapter>> {
    let name_lower = cfg.chain.to_lowercase();
    match name_lower.as_str() {
        "bitcoin" | "btc" => {
            let url = if cfg.rpc_url.is_empty() {
                None
            } else {
                Some(cfg.rpc_url.as_str())
            };
            Ok(Box::new(BitcoinAdapter::new("bitcoin", url)?))
        }
        "base" => {
            let wallet = keyring.evm_wallet(0, 0).ok();
            let contracts = ZionContracts::for_chain("base");
            Ok(Box::new(EvmAdapter::new(
                "base",
                ChainId::Base,
                &cfg.rpc_url,
                wallet,
                contracts,
            )?))
        }
        "ethereum" | "eth" => {
            let wallet = keyring.evm_wallet(0, 0).ok();
            let contracts = ZionContracts::for_chain("ethereum");
            Ok(Box::new(EvmAdapter::new(
                "ethereum",
                ChainId::Ethereum,
                &cfg.rpc_url,
                wallet,
                contracts,
            )?))
        }
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
