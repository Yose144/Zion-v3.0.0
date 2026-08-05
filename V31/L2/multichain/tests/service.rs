use async_trait::async_trait;

use zion_l1_types::{Address, Amount, Asset, ChainFamily, ChainId, Hash};
use zion_multichain::chain::adapter::{ChainAdapter, ChainAdapterRegistry, DepositEvent};
use zion_multichain::config::MultichainConfig;
use zion_multichain::service::MultichainService;
use zion_multichain::swap::dex::intent::{IntentStatus, PathHop, SolverBid, SwapIntent};
use zion_multichain::swap::dex::Pool;
use zion_multichain::MultichainResult;

/// A deterministic in-memory adapter for unit testing `MultichainService`.
struct MockAdapter {
    name: &'static str,
    height: u64,
    balance: Amount,
    family: ChainFamily,
}

impl MockAdapter {
    fn new(name: &'static str, height: u64, balance: Amount, family: ChainFamily) -> Self {
        Self {
            name,
            height,
            balance,
            family,
        }
    }
}

#[async_trait]
impl ChainAdapter for MockAdapter {
    fn name(&self) -> &str {
        self.name
    }

    fn family(&self) -> ChainFamily {
        self.family
    }

    async fn health_check(&self) -> MultichainResult<bool> {
        Ok(true)
    }

    async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
        Ok(vec![])
    }

    async fn execute_outbound(
        &self,
        _transfer: &zion_multichain::Transfer,
    ) -> MultichainResult<Hash> {
        // Mock adapter does not sign real transactions; return a default hash.
        Ok(Hash::default())
    }

    async fn current_height(&self) -> MultichainResult<u64> {
        Ok(self.height)
    }

    async fn confirmations(&self, _tx_hash: &Hash) -> MultichainResult<u64> {
        Ok(0)
    }

    async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
        // Mock adapter does not sign real transactions; return a default hash.
        Ok(Hash::default())
    }

    async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
        Ok(self.balance)
    }
}

#[tokio::test]
async fn service_reports_health_and_balances() {
    let mut registry = ChainAdapterRegistry::new();
    registry.register(
        ChainId::Base,
        Box::new(MockAdapter::new(
            "base",
            12_345,
            Amount::new(1_000_000_000_000_000_000),
            ChainFamily::Evm,
        )),
    );

    let service = MultichainService::new_with_adapters(MultichainConfig::default(), registry)
        .expect("in-memory service builds");

    let health = service.health().await;
    assert!(health.get("base").copied().unwrap_or(false));

    let height = service.height(ChainId::Base).await.expect("mock height");
    assert_eq!(height, 12_345);

    let addr = Address::new(ChainId::Base, vec![0u8; 20], "0x0000...").expect("valid address");
    let balance = service.balance(&addr).await.expect("mock balance");
    assert_eq!(balance, Amount::new(1_000_000_000_000_000_000));
}

#[tokio::test]
async fn intent_lifecycle_creates_bids_settles_and_executes() {
    let mut config = MultichainConfig::default();
    config.l1_rpc_url = String::new();

    let service = MultichainService::new_with_adapters(config, ChainAdapterRegistry::new())
        .expect("in-memory service builds");

    // Deploy a ZION/USDC pool.
    let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
    let usdc = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");
    service
        .deploy_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
        })
        .await
        .expect("deploy pool");

    // Register the solver and open an intent.
    service
        .register_solver("solver-a")
        .await
        .expect("register solver");

    let intent = SwapIntent::new(
        "zion1user",
        zion.id.clone(),
        usdc.id.clone(),
        Amount::new(1_000_000),
        Amount::new(900_000),
        u64::MAX,
        1,
    );
    let id = service.create_intent(intent).await.expect("create intent");

    // Solver submits a bid that satisfies the user's minimum output.
    let bid = SolverBid::new(
        id,
        "solver-a",
        Amount::new(1_100_000),
        vec![PathHop {
            chain: "zion".into(),
            dex: "amm".into(),
            from_token: zion.id.clone(),
            to_token: usdc.id.clone(),
            is_bridge: false,
        }],
        10,
        0,
    );
    service.submit_bid(bid).await.expect("submit bid");

    // Settle and execute the intent against the AMM pool.
    let out = service.execute_intent(id).await.expect("execute").expect("some output");
    assert!(out.0 > 0);

    let intent = service.get_intent(id).await.expect("intent exists");
    assert_eq!(intent.status, zion_multichain::swap::dex::intent::IntentStatus::Executed);
}

#[tokio::test]
async fn intent_engine_loads_from_db_on_restart() {
    let db_path = std::env::temp_dir().join("multichain-intent-persist-test.db");
    let _ = std::fs::remove_file(&db_path);

    let mut config = MultichainConfig::default();
    config.l1_rpc_url = String::new();
    config.database.path = db_path.to_string_lossy().into();

    let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
    let usdc = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");

    // First service: register solver, create intent, submit bid.
    let service = MultichainService::new_with_adapters(config.clone(), ChainAdapterRegistry::new())
        .expect("first service builds");
    service
        .register_solver("solver-a")
        .await
        .expect("register solver");

    let intent = SwapIntent::new(
        "user1",
        zion.id.clone(),
        usdc.id.clone(),
        Amount::new(1_000_000),
        Amount::new(900_000),
        u64::MAX,
        1,
    );
    let id = service.create_intent(intent).await.expect("create intent");

    let bid = SolverBid::new(
        id,
        "solver-a",
        Amount::new(1_100_000),
        vec![PathHop {
            chain: "zion".into(),
            dex: "amm".into(),
            from_token: zion.id.clone(),
            to_token: usdc.id.clone(),
            is_bridge: false,
        }],
        10,
        0,
    );
    service.submit_bid(bid).await.expect("submit bid");
    drop(service);

    // Second service: load persisted state from the same file DB.
    let service2 = MultichainService::new_with_adapters(config, ChainAdapterRegistry::new())
        .expect("second service builds");
    service2.load_intent_engine().await.expect("load intent engine");

    let loaded = service2.get_intent(id).await.expect("intent loaded");
    assert_eq!(loaded.status, IntentStatus::Pending);

    // Deploy the pool and execute the loaded intent/bid end-to-end.
    service2
        .deploy_pool(Pool {
            id: 1,
            asset_a: zion,
            asset_b: usdc,
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
        })
        .await
        .expect("deploy pool");

    let out = service2
        .execute_intent(id)
        .await
        .expect("execute")
        .expect("some output");
    assert!(out.0 > 0);

    assert_eq!(
        service2.get_intent(id).await.unwrap().status,
        IntentStatus::Executed
    );
}
