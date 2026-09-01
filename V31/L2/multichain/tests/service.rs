use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

use zion_l1_types::{Address, Amount, Asset, ChainFamily, ChainId, Hash};
use zion_multichain::chain::adapter::{ChainAdapter, ChainAdapterRegistry, DepositEvent};
use zion_multichain::config::MultichainConfig;
use zion_multichain::service::MultichainService;
use zion_multichain::swap::dex::intent::{IntentStatus, PathHop, SolverBid, SwapIntent};
use zion_multichain::swap::dex::solver_network::MockSolverClient;
use zion_multichain::swap::dex::Pool;
use zion_multichain::MultichainResult;

/// A deterministic in-memory adapter for unit testing `MultichainService`.
struct MockAdapter {
    name: &'static str,
    height: u64,
    balance: Amount,
    family: ChainFamily,
    events: Arc<Mutex<Vec<DepositEvent>>>,
}

impl MockAdapter {
    fn new(name: &'static str, height: u64, balance: Amount, family: ChainFamily) -> Self {
        Self {
            name,
            height,
            balance,
            family,
            events: Arc::new(Mutex::new(vec![])),
        }
    }

    fn with_events(self, events: Arc<Mutex<Vec<DepositEvent>>>) -> Self {
        Self { events, ..self }
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
        Ok(self.events.lock().await.clone())
    }

    async fn watch_addresses(&self, addresses: &[Address]) -> MultichainResult<Vec<DepositEvent>> {
        Ok(self
            .events
            .lock()
            .await
            .iter()
            .filter(|e| addresses.iter().any(|a| a.encoded == e.recipient.encoded))
            .cloned()
            .collect())
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
            amm_pair: None,
            amm_factory: None,
        })
        .await
        .expect("deploy pool");

    // Register the solver and open an intent.
    service
        .register_solver("solver-a", None, 0)
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
    let out = service
        .execute_intent(id)
        .await
        .expect("execute")
        .expect("some output");
    assert!(out.0 > 0);

    let intent = service.get_intent(id).await.expect("intent exists");
    assert_eq!(
        intent.status,
        zion_multichain::swap::dex::intent::IntentStatus::Executed
    );
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
        .register_solver("solver-a", None, 0)
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
    service2
        .load_intent_engine()
        .await
        .expect("load intent engine");

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
            amm_pair: None,
            amm_factory: None,
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

#[tokio::test]
async fn cross_chain_intent_executes_bridge_hop() {
    let mut config = MultichainConfig::default();
    config.l1_rpc_url = String::new();

    let zion_events = Arc::new(Mutex::new(vec![]));
    let base_events = Arc::new(Mutex::new(vec![]));

    let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
    let wzion = Asset::native(ChainId::Base, "wZION", 6, "Wrapped ZION");

    let zion_adapter = MockAdapter::new(
        "zion",
        100,
        Amount::new(1_000_000_000_000),
        ChainFamily::Zion,
    )
    .with_events(Arc::clone(&zion_events));
    let base_adapter = MockAdapter::new(
        "base",
        12_345,
        Amount::new(1_000_000_000_000),
        ChainFamily::Evm,
    )
    .with_events(Arc::clone(&base_events));

    let mut registry = ChainAdapterRegistry::new();
    registry.register(ChainId::ZionL1, Box::new(zion_adapter));
    registry.register(ChainId::Base, Box::new(base_adapter));

    let service = MultichainService::new_with_adapters(config, registry)
        .expect("service builds with bridge adapters");

    // Source / target addresses are the service wallet on each chain.
    let source_address = service
        .wallet_address(ChainId::ZionL1, 0, 0)
        .expect("zion address");
    let target_address = service
        .wallet_address(ChainId::Base, 0, 0)
        .expect("base address");

    // Pre-seed the source adapter with a matching bridge deposit event.
    zion_events.lock().await.push(DepositEvent {
        chain: ChainId::ZionL1,
        tx_hash: Hash::default(),
        recipient: source_address,
        amount: Amount::new(1_000_000),
        memo: Some(format!("bridge:base:{}", target_address.encoded)),
        confirmations: 1,
        asset: None,
    });

    service
        .register_solver("solver-a", None, 0)
        .await
        .expect("register solver");

    let intent = SwapIntent::new(
        "user1",
        zion.id.clone(),
        wzion.id.clone(),
        Amount::new(1_000_000),
        Amount::new(900_000),
        u64::MAX,
        1,
    );
    let id = service.create_intent(intent).await.expect("create intent");

    let bid = SolverBid::new(
        id,
        "solver-a",
        Amount::new(950_000),
        vec![PathHop {
            chain: "zion".into(),
            dex: "warp".into(),
            from_token: zion.id.clone(),
            to_token: wzion.id.clone(),
            is_bridge: true,
        }],
        50,
        0,
    );
    service.submit_bid(bid).await.expect("submit bid");

    let out = service
        .execute_intent(id)
        .await
        .expect("execute bridge intent")
        .expect("some output");
    assert!(out.0 >= 900_000);

    let intent = service.get_intent(id).await.expect("intent exists");
    assert_eq!(intent.status, IntentStatus::Executed);
}

#[tokio::test]
async fn intent_broadcast_collects_and_submits_solver_bids() {
    let mut config = MultichainConfig::default();
    config.l1_rpc_url = String::new();

    let service = MultichainService::new_with_adapters(config, ChainAdapterRegistry::new())
        .expect("in-memory service builds");

    let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
    let usdc = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");

    // Register two solvers with URLs.
    service
        .register_solver("solver-a", Some("http://solver-a/bid".into()), 100)
        .await
        .expect("register a");
    service
        .register_solver("solver-b", Some("http://solver-b/bid".into()), 50)
        .await
        .expect("register b");

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

    // Pre-seed solver-a with a winning same-chain AMM bid.
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
    let client = MockSolverClient::new().with_bid("solver-a", Some(bid));

    let results = service
        .broadcast_intent(id, Arc::new(client))
        .await
        .expect("broadcast");
    assert_eq!(results.len(), 2);
    let some_count = results.iter().filter(|r| matches!(r, Ok(Some(_)))).count();
    let none_count = results.iter().filter(|r| matches!(r, Ok(None))).count();
    assert_eq!(some_count, 1);
    assert_eq!(none_count, 1);

    // Deploy the pool and execute the auto-submitted bid.
    service
         .deploy_pool(Pool {
            id: 1,
            asset_a: zion,
            asset_b: usdc,
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        })
        .await
        .expect("deploy pool");

    let out = service
        .execute_intent(id)
        .await
        .expect("execute")
        .expect("some output");
    assert!(out.0 > 0);

    assert_eq!(
        service.get_intent(id).await.unwrap().status,
        IntentStatus::Executed
    );
}

#[tokio::test]
async fn e2e_deposit_swap_withdraw() {
    let db_path = std::env::temp_dir().join("multichain-e2e-deposit-swap-withdraw-test.db");
    let _ = std::fs::remove_file(&db_path);

    let mut config = MultichainConfig::default();
    config.l1_rpc_url = String::new();
    config.database.path = db_path.to_string_lossy().into();

    // One shared event queue for the ZionL1 mock adapter.
    let events = Arc::new(Mutex::new(vec![]));
    let mut registry = ChainAdapterRegistry::new();
    registry.register(
        ChainId::ZionL1,
        Box::new(
            MockAdapter::new(
                "zion",
                100,
                Amount::new(1_000_000_000_000),
                ChainFamily::Zion,
            )
            .with_events(Arc::clone(&events)),
        ),
    );

    let service =
        MultichainService::new_with_adapters(config, registry).expect("in-memory service builds");

    let user_id = "user1";

    // 1. Derive a deposit address and store it in the wallet DB.
    let deposit = service
        .multichain_wallet()
        .derive_deposit_address(user_id, ChainId::ZionL1)
        .await
        .expect("derive deposit address");

    // 2. Simulate an on-chain ZION deposit to that address.
    events.lock().await.push(DepositEvent {
        chain: ChainId::ZionL1,
        tx_hash: Hash::default(),
        recipient: deposit.address,
        amount: Amount::new(1_000_000),
        memo: None,
        confirmations: 1,
        asset: None,
    });

    service
        .deposit_watcher()
        .poll_all()
        .await
        .expect("poll deposits");

    // 3. Verify the ledger was credited with 1 ZION.
    let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
    let balance = service
        .wallet_ledger()
        .balance(user_id, &zion)
        .await
        .expect("ledger balance");
    assert_eq!(balance.0, 1_000_000);

     // 4. Deploy a ZION/USDC pool on ZionL1.
    let usdc = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");
    service
        .deploy_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        })
        .await
        .expect("deploy pool");

    // 5. Swap 1 ZION for USDC (custodial, output stays on ledger).
    let order = service
        .swap_execute(
            user_id,
            &zion,
            &usdc,
            Amount::new(1_000_000),
            Amount::new(1),
            None,
        )
        .await
        .expect("swap execute");
    assert!(order.amount_out.0 > 0);

    let usdc_balance = service
        .wallet_ledger()
        .balance(user_id, &usdc)
        .await
        .expect("usdc balance");
    assert_eq!(usdc_balance, order.amount_out);

    // 6. Withdraw the USDC to another derived address.
    let recipient = service
        .wallet_address(ChainId::ZionL1, 0, 1)
        .expect("withdraw address");
    let withdraw_id = service
        .request_withdraw(user_id, &usdc, usdc_balance, &recipient.encoded)
        .await
        .expect("request withdraw");

    service
        .withdrawal_processor()
        .process_pending()
        .await
        .expect("process withdrawals");

    let withdrawals = service
        .withdrawals_for_user(user_id)
        .await
        .expect("list withdrawals");
    let record = withdrawals
        .iter()
        .find(|w| w.id == withdraw_id)
        .expect("withdrawal record");
    assert_eq!(
        record.status,
        zion_multichain::multichain_wallet::types::WithdrawalStatus::Sent
    );
    assert!(record.tx_hash.is_some());
}
