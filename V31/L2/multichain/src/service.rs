//! `MultichainService` — the orchestrator that wires adapters, the DB, and
//! the domain modules (bridge, swap, DEX, credits) into one runtime.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex as StdMutex};

use tokio::sync::{Mutex, RwLock};
use zion_l1_types::{Address, Amount, Asset, ChainId, Hash};
use zion_pool::telemetry::MinerTelemetryRegistry;
use zion_pool::Pool as MiningPool;

use crate::bridge::Bridge;
use crate::bridge::consensus::BridgeConsensus;
use crate::chain::adapters::{BitcoinAdapter, EvmAdapter, ZionL1Adapter};
use crate::chain::{BlockTemplate, ChainAdapter, ChainAdapterRegistry};
use crate::config::{AdapterConfig, MultichainConfig, NodeRewardsConfig};
use crate::contracts::ZionContracts;
use crate::credits::CreditsLedger;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::node_rewards::NodeRewards;
use crate::swap::dex::{DexRouter, Pool, Quote};
use crate::swap::dex::executor::Executor;
use crate::swap::dex::intent::{IntentStatus, SolverBid, SwapIntent};
use crate::swap::dex::solver_network::{SolverClient, SolverNetwork};
use crate::swap::IntentEngine;
use crate::swap::htlc::HtlcSwap;
use crate::types::Transfer;
use crate::wallet::Keyring;
use crate::warp::config::WarpConfig;
use crate::warp::runtime::WarpRuntime;

/// Top-level runtime for `zion-multichain`.
pub struct MultichainService {
    #[allow(dead_code)]
    config: MultichainConfig,
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    bridge: Bridge,
    htlc: HtlcSwap,
    keyring: Keyring,
    credits: CreditsLedger,
    dex: RwLock<DexRouter>,
    intent_engine: RwLock<IntentEngine>,
    pool: Option<Arc<StdMutex<MiningPool>>>,
    processed_payouts: Arc<StdMutex<HashSet<(u64, String)>>>,
    node_rewards: Arc<Mutex<NodeRewards>>,
}

fn load_keyring(config: &MultichainConfig) -> MultichainResult<Keyring> {
    if let Some(mnemonic) = config.mnemonic.as_deref() {
        return Keyring::from_mnemonic(mnemonic);
    }
    if let Ok(mnemonic) = std::env::var("WARP_MNEMONIC") {
        if !mnemonic.is_empty() {
            return Keyring::from_mnemonic(&mnemonic);
        }
    }
    Keyring::generate()
}

impl MultichainService {
    pub fn config(&self) -> &MultichainConfig {
        &self.config
    }

    pub fn node_rewards(&self) -> Arc<Mutex<NodeRewards>> {
        Arc::clone(&self.node_rewards)
    }

    pub fn new(config: MultichainConfig) -> MultichainResult<Self> {
        let db = Arc::new(Mutex::new(Db::open(&config.database.path)?));
        let keyring = load_keyring(&config)?;
        let mut adapters = ChainAdapterRegistry::new();

        for cfg in &config.adapters {
            if !cfg.enabled {
                continue;
            }
            match build_adapter(cfg, &keyring) {
                Ok(adapter) => match chain_id_by_name(&cfg.chain) {
                    Ok(chain_id) => {
                        adapters.register(chain_id, adapter);
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Skipping adapter for '{}': unknown chain id mapping: {}",
                            cfg.chain,
                            e
                        );
                    }
                },
                Err(e) => {
                    tracing::warn!(
                        "Skipping adapter for '{}': no adapter builder: {}",
                        cfg.chain,
                        e
                    );
                }
            }
        }

        // Always register a ZION L1 adapter if an L1 RPC URL is configured.
        if !config.l1_rpc_url.is_empty() {
            let l1_adapter = Box::new(ZionL1Adapter::new(&config.l1_rpc_url, keyring.clone()));
            adapters.register(ChainId::ZionL1, l1_adapter);
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
        let keyring = load_keyring(&config)?;
        Ok(Self::from_parts(config, db, Arc::new(adapters), keyring))
    }

    fn from_parts(
        config: MultichainConfig,
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        keyring: Keyring,
    ) -> Self {
        let bridge = match load_bridge_consensus() {
            Some(consensus) => Bridge::with_consensus(Arc::clone(&adapters), consensus),
            None => Bridge::new(Arc::clone(&adapters)),
        };
        let htlc = HtlcSwap::with_db(Arc::clone(&adapters), Arc::clone(&db));
        let pool = config.pool.as_ref().and_then(|p| {
            if p.enabled {
                Some(Arc::new(StdMutex::new(MiningPool::new(
                    p.to_pool_config(),
                    Arc::new(StdMutex::new(MinerTelemetryRegistry::new())),
                ))))
            } else {
                None
            }
        });
        let mut intent_engine = IntentEngine::new();
        for entry in &config.solvers {
            intent_engine.registry_mut().register_with_info(
                &entry.name,
                Some(entry.url.clone()),
                entry.reputation,
            );
        }
        let node_rewards = NodeRewards::new(
            Arc::clone(&db),
            config.node_rewards.clone(),
            config.l1_rpc_url.clone(),
        )
        .unwrap_or_else(|e| {
            tracing::warn!("failed to initialize node rewards: {e}");
            NodeRewards::new(
                Arc::clone(&db),
                NodeRewardsConfig::default(),
                config.l1_rpc_url.clone(),
            )
            .expect("default node rewards config must initialize")
        });

        Self {
            config,
            db,
            adapters,
            bridge,
            htlc,
            keyring,
            credits: CreditsLedger::new(),
            dex: RwLock::new(DexRouter::new()),
            intent_engine: RwLock::new(intent_engine),
            pool,
            processed_payouts: Arc::new(StdMutex::new(HashSet::new())),
            node_rewards: Arc::new(Mutex::new(node_rewards)),
        }
    }

    /// Load persisted AMM pools into the in-memory router.
    pub async fn load_dex_pools(&self) -> MultichainResult<()> {
        let pools = self.db.lock().await.load_pools()?;
        let mut dex = self.dex.write().await;
        for pool in pools {
            dex.add_pool(pool);
        }
        Ok(())
    }

    /// Validate and deploy a new custom AMM pool. Persists to DB and router.
    pub async fn deploy_pool(&self, mut pool: Pool) -> MultichainResult<()> {
        if pool.fee_bps >= 10_000 {
            return Err(MultichainError::Validation("fee_bps must be < 10000".to_string()));
        }
        if pool.reserve_a == Amount::ZERO || pool.reserve_b == Amount::ZERO {
            return Err(MultichainError::Validation("reserves must be non-zero".to_string()));
        }
        if pool.asset_a.id == pool.asset_b.id {
            return Err(MultichainError::Validation("pool assets must be different".to_string()));
        }

        // Auto-assign a unique id when the caller passes 0.
        if pool.id == 0 {
            let guard = self.dex.read().await;
            let existing = guard.pools();
            let max_id = existing.iter().map(|p| p.id).max().unwrap_or(0);
            drop(guard);
            pool.id = max_id + 1;
        }

        // Reject duplicate pool id or duplicate asset pair.
        {
            let dex = self.dex.read().await;
            if dex.pools().iter().any(|p| p.id == pool.id) {
                return Err(MultichainError::Validation(format!(
                    "pool id {} already exists",
                    pool.id
                )));
            }
            if dex.find_pool(&pool.asset_a.id, &pool.asset_b.id).is_some() {
                return Err(MultichainError::Validation(format!(
                    "pool for {}-{} already exists",
                    pool.asset_a.id, pool.asset_b.id
                )));
            }
        }

        self.db.lock().await.save_pool(&pool)?;
        self.dex.write().await.add_pool(pool);
        Ok(())
    }

    /// List all deployed AMM pools.
    pub async fn list_dex_pools(&self) -> Vec<Pool> {
        self.dex.read().await.pools().to_vec()
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

    /// Return the top-N DEX routes for a swap (multi-path quote).
    pub async fn dex_quote_multi(
        &self,
        from: &Asset,
        to: &Asset,
        amount: Amount,
        n: usize,
        max_hops: usize,
    ) -> MultichainResult<Vec<Quote>> {
        self.dex.read().await.quote_multi(from, to, amount, n, max_hops)
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

    /// Register a solver in the intent engine whitelist and persist it.
    pub async fn register_solver(
        &self,
        solver: impl Into<String>,
        url: Option<String>,
        reputation: u64,
    ) -> MultichainResult<bool> {
        let solver = solver.into();
        let added = self
            .intent_engine
            .write()
            .await
            .registry_mut()
            .register_with_info(&solver, url, reputation);
        if added {
            self.db.lock().await.save_solver(&solver)?;
        }
        Ok(added)
    }

    /// Create a new ZionDex intent, persist it, and return its id.
    pub async fn create_intent(&self, intent: SwapIntent) -> MultichainResult<uuid::Uuid> {
        let (id, saved) = {
            let mut engine = self.intent_engine.write().await;
            let id = engine.open_intent(intent);
            let saved = engine.get_intent(id).cloned().unwrap();
            (id, saved)
        };
        self.db.lock().await.save_intent(&saved)?;
        Ok(id)
    }

    /// Look up a ZionDex intent by id.
    pub async fn get_intent(&self, id: uuid::Uuid) -> Option<SwapIntent> {
        self.intent_engine.read().await.get_intent(id).cloned()
    }

    /// Broadcast an open intent to all registered off-chain solvers and
    /// auto-submit any bids that come back. Returns per-solver results.
    pub async fn broadcast_intent<C: SolverClient + 'static>(
        &self,
        id: uuid::Uuid,
        client: std::sync::Arc<C>,
    ) -> MultichainResult<Vec<MultichainResult<Option<SolverBid>>>> {
        let (intent, solvers) = {
            let engine = self.intent_engine.read().await;
            let intent = engine
                .get_intent(id)
                .ok_or_else(|| MultichainError::Validation("intent not found".to_string()))?
                .clone();
            let solvers = engine
                .registry()
                .list()
                .iter()
                .filter_map(|n| engine.registry().get(n))
                .cloned()
                .collect::<Vec<_>>();
            (intent, solvers)
        };

        let network = SolverNetwork::new(client);
        let results = network.broadcast(&intent, &solvers).await;

        for res in &results {
            if let Ok(Some(bid)) = res {
                let _ = self.submit_bid(bid.clone()).await;
            }
        }
        Ok(results)
    }

    /// Submit a solver bid for an existing intent and persist it.
    pub async fn submit_bid(&self, bid: SolverBid) -> MultichainResult<bool> {
        let bid_to_save = bid.clone();
        let accepted = self.intent_engine.write().await.submit_bid(bid)?;
        if accepted {
            self.db.lock().await.save_bid(&bid_to_save)?;
        }
        Ok(accepted)
    }

    /// Settle an intent, persist the new status, and return the winning bid.
    pub async fn settle_intent(
        &self,
        id: uuid::Uuid,
    ) -> MultichainResult<Option<SolverBid>> {
        let (bid, intent) = {
            let mut engine = self.intent_engine.write().await;
            let bid = engine.settle(id)?;
            let intent = engine.get_intent(id).cloned();
            (bid, intent)
        };
        if let Some(intent) = intent {
            self.db.lock().await.save_intent(&intent)?;
        }
        Ok(bid)
    }

    /// Settle an intent and execute the winning path via `Executor`.
    pub async fn execute_intent(
        &self,
        id: uuid::Uuid,
    ) -> MultichainResult<Option<Amount>> {
        let (out, saved) = {
            let mut engine = self.intent_engine.write().await;
            let mut dex = self.dex.write().await;

            let Some(bid) = engine.settle(id)? else {
                return Ok(None);
            };

            let Some(intent) = engine.get_intent(id).cloned() else {
                return Ok(None);
            };

            let executor = Executor::new(self.keyring.clone());
            let amount = executor.execute(&intent, &bid, &self.bridge, &mut dex).await?;

            let intent = engine.get_intent_mut(id).unwrap();
            intent.status = IntentStatus::Executed;
            let saved = intent.clone();
            (Some(amount), saved)
        };
        self.db.lock().await.save_intent(&saved)?;
        Ok(out)
    }

    /// Load persisted intents, bids, and solvers into the in-memory engine.
    pub async fn load_intent_engine(&self) -> MultichainResult<()> {
        let db = self.db.lock().await;
        let solvers = db.load_solvers()?;
        let intents = db.load_intents()?;
        let mut bids = Vec::new();
        for intent in &intents {
            bids.extend(db.load_bids_for_intent(&intent.id)?);
        }
        drop(db);

        let mut engine = self.intent_engine.write().await;
        for solver in solvers {
            engine.registry_mut().register(solver);
        }
        for intent in intents {
            engine.load_intent(intent);
        }
        for bid in bids {
            engine.load_bid(bid);
        }
        Ok(())
    }

    /// Access the bridge module.
    pub fn bridge(&self) -> &Bridge {
        &self.bridge
    }

    /// Submit a cross-chain bridge transfer.
    pub async fn bridge_submit(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        self.bridge.submit(transfer).await
    }

    /// Borrow the HTLC atomic-swap coordinator.
    pub fn htlc(&self) -> &HtlcSwap {
        &self.htlc
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
            let key = (block_height, payout.address.clone());
            {
                let processed = self.processed_payouts.lock().unwrap();
                if processed.contains(&key) {
                    continue;
                }
            }

            let address = match Address::new(
                ChainId::ZionL1,
                payout.address.as_bytes().to_vec(),
                &payout.address,
            ) {
                Ok(a) => a,
                Err(e) => {
                    tracing::warn!(
                        "payout address invalid: block={} to={} amount={} error={}",
                        block_height,
                        payout.address,
                        payout.amount,
                        e
                    );
                    continue;
                }
            };
            let amount = Amount::new(payout.amount as u128);

            if let Err(e) = self.credits.credit(&address, amount) {
                tracing::warn!(
                    "payout credit failed: block={} to={} amount={} error={}",
                    block_height,
                    payout.address,
                    payout.amount,
                    e
                );
                continue;
            }

            match adapter.send_payment(&address, amount).await {
                Ok(hash) => {
                    if let Err(e) = self.credits.debit(&address, amount) {
                        tracing::warn!(
                            "payout debit failed after settlement: block={} to={} amount={} error={}",
                            block_height,
                            payout.address,
                            payout.amount,
                            e
                        );
                    }
                    tracing::info!(
                        "payout executed: block={} to={} amount={} tx={}",
                        block_height,
                        payout.address,
                        payout.amount,
                        hash.to_hex()
                    );
                    self.processed_payouts.lock().unwrap().insert(key);
                }
                Err(e) => {
                    tracing::warn!(
                        "payout settlement failed: block={} to={} amount={} error={}; credit retained",
                        block_height,
                        payout.address,
                        payout.amount,
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
            "pplns_window_size": pool.config.pplns_window_size,
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

    /// Spawn the WARP bridge runtime if a `warp` config is present.
    ///
    /// Returns `Some(join_handle)` if WARP was started, `None` if no WARP
    /// configuration was provided.
    pub fn start_warp(&self) -> MultichainResult<Option<tokio::task::JoinHandle<()>>> {
        let warp_config = match self.config.warp.as_ref() {
            Some(c) => c.clone(),
            None => return Ok(None),
        };

        let runtime = WarpRuntime::new(warp_config)
            .map_err(|e| MultichainError::Internal(format!("WARP runtime init failed: {e}")))?;

        let handle = tokio::spawn(async move {
            if let Err(e) = runtime.run().await {
                tracing::error!("[MultichainService] WARP runtime exited: {e}");
            }
        });

        Ok(Some(handle))
    }

    /// Build a `WarpRuntime` from an explicit `WarpConfig` without spawning.
    ///
    /// Useful for callers that want full control over task spawning.
    pub fn warp_runtime(&self, config: WarpConfig) -> MultichainResult<WarpRuntime> {
        WarpRuntime::new(config)
            .map_err(|e| MultichainError::Internal(format!("WARP runtime init failed: {e}")))
    }
}

fn load_bridge_consensus() -> Option<BridgeConsensus> {
    let mut consensus = BridgeConsensus::new();
    match consensus.validator_set_mut().load_from_env() {
        Ok(count) if count >= consensus.validator_set().quorum => Some(consensus),
        Ok(count) => {
            tracing::warn!(
                "WARP_VALIDATOR_KEYS loaded {count} keys, but quorum is {}; bridge will run without consensus",
                consensus.validator_set().quorum
            );
            None
        }
        Err(e) => {
            tracing::warn!("WARP_VALIDATOR_KEYS not loaded: {}; bridge will run without consensus", e);
            None
        }
    }
}

fn evm_chain_id(name: &str) -> Option<ChainId> {
    match name.to_lowercase().as_str() {
        "ethereum" | "eth" => Some(ChainId::Ethereum),
        "base" => Some(ChainId::Base),
        "arbitrum" => Some(ChainId::Arbitrum),
        "optimism" | "op" => Some(ChainId::Optimism),
        "bsc" | "binance-smart-chain" => Some(ChainId::Bsc),
        "polygon" | "matic" => Some(ChainId::Polygon),
        "avalanche" | "avax" => Some(ChainId::Avalanche),
        "zksync" => Some(ChainId::Zksync),
        "linea" => Some(ChainId::Linea),
        _ => None,
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
        "zion-l1" | "zion" | "zionl1" => {
            Ok(Box::new(ZionL1Adapter::new(&cfg.rpc_url, keyring.clone())))
        }
        _ => {
            if let Some(chain_id) = evm_chain_id(&name_lower) {
                let wallet = crate::wallet::evm_relay_wallet()
                    .or_else(|_| keyring.evm_wallet(0, 0))
                    .ok();
                let contracts = ZionContracts::for_chain(&cfg.chain)
                    .unwrap_or_else(ZionContracts::non_base);
                Ok(Box::new(EvmAdapter::new(
                    cfg.chain.clone(),
                    chain_id,
                    &cfg.rpc_url,
                    wallet,
                    Some(contracts),
                )?))
            } else {
                Err(MultichainError::AdapterNotFound(format!(
                    "no adapter builder for chain '{}': add it to build_adapter()",
                    cfg.chain
                )))
            }
        }
    }
}

fn chain_id_by_name(name: &str) -> MultichainResult<ChainId> {
    let name_lower = name.to_lowercase();
    if let Some(chain_id) = evm_chain_id(&name_lower) {
        return Ok(chain_id);
    }
    match name_lower.as_str() {
        "bitcoin" | "btc" => Ok(ChainId::Bitcoin),
        "zion-l1" | "zion" | "zionl1" => Ok(ChainId::ZionL1),
        _ => Err(MultichainError::AdapterNotFound(format!(
            "unknown chain id mapping for '{}': add it to chain_id_by_name()",
            name
        ))),
    }
}
