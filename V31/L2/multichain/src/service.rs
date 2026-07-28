//! `MultichainService` — the orchestrator that wires adapters, the DB, and
//! the domain modules (bridge, swap, DEX, credits) into one runtime.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex as StdMutex};

use tokio::sync::{Mutex, RwLock};
use zion_l1_types::{Address, Amount, Asset, ChainId, Hash};
use zion_pool::Pool as MiningPool;

use crate::bridge::Bridge;
use crate::chain::adapters::{BitcoinAdapter, EvmAdapter, ZionL1Adapter};
use crate::chain::{BlockTemplate, ChainAdapter, ChainAdapterRegistry};
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
    pool: Option<Arc<StdMutex<MiningPool>>>,
    processed_payouts: Arc<StdMutex<HashSet<(u64, String)>>>,
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
        let pool = config.pool.as_ref().and_then(|p| {
            if p.enabled {
                Some(Arc::new(StdMutex::new(MiningPool::new(p.to_pool_config()))))
            } else {
                None
            }
        });
        Self {
            config,
            _db: db,
            adapters,
            bridge,
            keyring,
            credits: CreditsLedger::new(),
            dex: RwLock::new(DexRouter::new()),
            pool,
            processed_payouts: Arc::new(StdMutex::new(HashSet::new())),
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

    /// Fetch a mining block template from a registered chain adapter.
    pub async fn block_template(&self, chain: ChainId) -> MultichainResult<Option<BlockTemplate>> {
        let adapter = self
            .adapters
            .get(chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(chain.as_str().to_string()))?;
        adapter.block_template().await
    }

    /// Borrow the configured mining pool, if any.
    pub fn pool(&self) -> Option<Arc<StdMutex<MiningPool>>> {
        self.pool.as_ref().map(Arc::clone)
    }

    /// Execute any pending PPLNS payouts for the configured pool. Each payout
    /// is first recorded as a Dharma Credit and then settled on-chain through
    /// the Zion L1 adapter, debited only after a successful transfer. Each
    /// `(block, address)` pair is processed at most once.
    pub async fn execute_payouts(&self) -> MultichainResult<()> {
        let pool = match self.pool.as_ref() {
            Some(p) => p,
            None => return Ok(()),
        };
        let adapter = match self.adapters.get(ChainId::ZionL1) {
            Some(a) => a,
            None => return Ok(()),
        };

        let (block_height, payouts) = {
            let pool = pool
                .lock()
                .map_err(|_| MultichainError::Internal("pool lock poisoned".to_string()))?;
            match pool.last_payouts.clone() {
                Some(p) => p,
                None => return Ok(()),
            }
        };

        for payout in &payouts {
            let key = (block_height, payout.address.encoded.clone());
            {
                let processed = self.processed_payouts.lock().unwrap();
                if processed.contains(&key) {
                    continue;
                }
            }

            if let Err(e) = self.credits.credit(&payout.address, payout.amount) {
                tracing::warn!(
                    "payout credit failed: block={} to={} amount={} error={}",
                    block_height,
                    payout.address.encoded,
                    payout.amount.0,
                    e
                );
                continue;
            }

            match adapter.send_payment(&payout.address, payout.amount).await {
                Ok(hash) => {
                    if let Err(e) = self.credits.debit(&payout.address, payout.amount) {
                        tracing::warn!(
                            "payout debit failed after settlement: block={} to={} amount={} error={}",
                            block_height,
                            payout.address.encoded,
                            payout.amount.0,
                            e
                        );
                    }
                    tracing::info!(
                        "payout executed: block={} to={} amount={} tx={}",
                        block_height,
                        payout.address.encoded,
                        payout.amount.0,
                        hash.to_hex()
                    );
                    self.processed_payouts.lock().unwrap().insert(key);
                }
                Err(e) => {
                    tracing::warn!(
                        "payout settlement failed: block={} to={} amount={} error={}; credit retained",
                        block_height,
                        payout.address.encoded,
                        payout.amount.0,
                        e
                    );
                }
            }
        }

        Ok(())
    }

    /// Return pool stats, or `None` if the pool is not configured.
    pub fn pool_stats(&self) -> Option<serde_json::Value> {
        let pool = self.pool.as_ref()?;
        let pool = pool.lock().ok()?;
        let (accepted, rejected) = pool.stats();
        Some(serde_json::json!({
            "enabled": true,
            "accepted": accepted,
            "rejected": rejected,
            "pool_fee_bps": pool.config.pool_fee_bps,
            "pplns_window_shares": pool.config.pplns_window_shares,
            "pplns_window_blocks": pool.config.pplns_window_blocks,
            "pool_address": pool.config.pool_address.encoded,
        }))
    }

    /// Return the last computed pool payouts, or `None` if none exist.
    pub fn pool_payouts(&self) -> Option<serde_json::Value> {
        let pool = self.pool.as_ref()?;
        let pool = pool.lock().ok()?;
        let (block_height, payouts) = pool.last_payouts.as_ref()?;
        Some(serde_json::json!({
            "block_height": block_height,
            "payouts": payouts,
        }))
    }
}

fn build_adapter(
    cfg: &AdapterConfig,
    keyring: &Keyring,
) -> MultichainResult<Box<dyn ChainAdapter>> {
    let name_lower = cfg.chain.to_lowercase();
    match name_lower.as_str() {
        "bitcoin" | "btc" => {
            let url = if cfg.rpc_url.is_empty() {
                None
            } else {
                Some(cfg.rpc_url.as_str())
            };
            Ok(Box::new(BitcoinAdapter::new("bitcoin", url, keyring)?))
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
        "zion-l1" | "zion" | "zionl1" => {
            Ok(Box::new(ZionL1Adapter::new(&cfg.rpc_url, keyring.clone())))
        }
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
