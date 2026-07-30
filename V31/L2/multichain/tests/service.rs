use async_trait::async_trait;

use zion_l1_types::{Address, Amount, ChainFamily, ChainId, Hash};
use zion_multichain::chain::adapter::{ChainAdapter, ChainAdapterRegistry, DepositEvent};
use zion_multichain::config::MultichainConfig;
use zion_multichain::service::MultichainService;
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
