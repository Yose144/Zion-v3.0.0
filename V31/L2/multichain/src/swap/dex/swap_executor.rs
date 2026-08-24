//! Custodial swap executor that debits/credits the internal ledger and
//! optionally settles the output token on-chain.
//!
//! This is the E2E layer for ZionDex: it runs the local `DexRouter` to price a
//! swap, updates pool reserves, moves the user's internal balances, and — when
//! a `recipient` is supplied — sends the output token from the L2 hot wallet
//! using the chain's adapter.

use std::sync::Arc;

use tokio::sync::{Mutex, RwLock};
use zion_l1_types::{Address, Amount, Asset};

use crate::chain::ChainAdapterRegistry;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::multichain_wallet::ledger::WalletLedger;
use crate::multichain_wallet::types::{DexOrder, DexOrderStatus};
use crate::swap::dex::DexRouter;

/// Executor for user-facing DEX swaps against the custodial multichain wallet.
#[derive(Clone)]
pub struct SwapExecutor {
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    ledger: WalletLedger,
    router: Arc<RwLock<DexRouter>>,
}

impl SwapExecutor {
    pub fn new(
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        ledger: WalletLedger,
        router: Arc<RwLock<DexRouter>>,
    ) -> Self {
        Self {
            db,
            adapters,
            ledger,
            router,
        }
    }

    /// Execute a swap for `user_id`.
    ///
    /// 1. Debit `from` from the user's ledger.
    /// 2. Quote and execute against the in-memory `DexRouter`.
    /// 3. If `recipient` is `Some`, send the output token from the L2 hot
    ///    wallet to that address (on-chain settlement).
    /// 4. Otherwise credit the output token to the user's internal ledger.
    pub async fn execute_swap(
        &self,
        user_id: &str,
        from: &Asset,
        to: &Asset,
        amount: Amount,
        min_amount_out: Amount,
        recipient: Option<Address>,
    ) -> MultichainResult<DexOrder> {
        let order_id = uuid::Uuid::new_v4().to_string();
        let mut order = DexOrder {
            id: order_id,
            user_id: user_id.to_string(),
            from_asset_key: from.id.to_string(),
            to_asset_key: to.id.to_string(),
            amount_in: amount,
            amount_out: Amount::ZERO,
            min_amount_out,
            recipient_address: recipient.as_ref().map(|r| r.encoded.clone()),
            route: Vec::new(),
            tx_hash: None,
            status: DexOrderStatus::Pending,
            created_at: chrono::Utc::now(),
            executed_at: None,
        };

        // 1. Debit input from the user's ledger.
        self.ledger.debit(user_id, from, amount).await?;

        // 2. Quote and execute against the router.
        let mut router = self.router.write().await;
        let quote = match router.quote_multi(from, to, amount, 1, 4) {
            Ok(mut quotes) => quotes.pop().ok_or_else(|| {
                MultichainError::Unsupported(format!("no route from {} to {}", from.id, to.id))
            })?,
            Err(e) => {
                drop(router);
                self.ledger.credit(user_id, from, amount).await?;
                order.status = DexOrderStatus::Failed;
                self.save_order(&order).await?;
                return Err(e);
            }
        };

        if quote.expected_out < min_amount_out {
            drop(router);
            self.ledger.credit(user_id, from, amount).await?;
            order.status = DexOrderStatus::Failed;
            self.save_order(&order).await?;
            return Err(MultichainError::Validation(format!(
                "slippage: expected {} but min was {}",
                quote.expected_out.0, min_amount_out.0
            )));
        }

        // Phase 5: execute the full route hop-by-hop (AMM or 1:1 bridge pools).
        let mut current = amount;
        for window in quote.route.windows(2) {
            let from_id = &window[0];
            let to_id = &window[1];
            let hop_from = router.find_asset(from_id).ok_or_else(|| {
                MultichainError::Unsupported(format!("unknown hop asset {from_id}"))
            })?;
            let hop_to = router.find_asset(to_id).ok_or_else(|| {
                MultichainError::Unsupported(format!("unknown hop asset {to_id}"))
            })?;
            current = match router.execute(&hop_from, &hop_to, current) {
                Ok(out) => out,
                Err(e) => {
                    drop(router);
                    self.ledger.credit(user_id, from, amount).await?;
                    order.status = DexOrderStatus::Failed;
                    self.save_order(&order).await?;
                    return Err(e);
                }
            };
        }

        if current < min_amount_out {
            // This should not happen after the quote check, but keep the user safe.
            drop(router);
            self.ledger.credit(user_id, from, amount).await?;
            order.status = DexOrderStatus::Failed;
            self.save_order(&order).await?;
            return Err(MultichainError::Validation(
                "executed amount below minimum".to_string(),
            ));
        }

        let amount_out = current;
        order.amount_out = amount_out;
        order.route = quote.route.iter().map(|a| a.to_string()).collect();
        order.status = DexOrderStatus::Executed;
        order.executed_at = Some(chrono::Utc::now());
        drop(router);

        // 3. On-chain settlement if a recipient was supplied.
        if let Some(recipient) = recipient {
            if recipient.chain != to.id.chain {
                self.ledger.credit(user_id, from, amount).await?;
                order.status = DexOrderStatus::Failed;
                self.save_order(&order).await?;
                return Err(MultichainError::Validation(format!(
                    "recipient chain {} does not match output chain {}",
                    recipient.chain.as_str(),
                    to.id.chain.as_str()
                )));
            }

            let adapter = self
                .adapters
                .get(to.id.chain)
                .ok_or_else(|| MultichainError::AdapterNotFound(to.id.chain.as_str().to_string()))?;

            match adapter.transfer_token(to, &recipient, amount_out).await {
                Ok(tx_hash) => {
                    order.tx_hash = Some(tx_hash.to_hex());
                    order.status = DexOrderStatus::Settled;
                }
                Err(e) => {
                    // Credit the output token to the user's internal ledger so
                    // the swap is not lost; the operator can retry withdrawal.
                    self.ledger.credit(user_id, to, amount_out).await?;
                    order.status = DexOrderStatus::Failed;
                    self.save_order(&order).await?;
                    return Err(e);
                }
            }
        } else {
            // 4. Keep the output on the internal ledger.
            self.ledger.credit(user_id, to, amount_out).await?;
        }

        self.save_order(&order).await?;
        Ok(order)
    }

    async fn save_order(&self, order: &DexOrder) -> MultichainResult<()> {
        let db = self.db.lock().await;
        db.save_dex_order(order)
    }

    /// Load a previously created swap order.
    pub async fn get_order(&self, order_id: &str) -> MultichainResult<Option<DexOrder>> {
        let db = self.db.lock().await;
        db.load_dex_order(order_id)
    }

    /// List all swap orders for a user.
    pub async fn list_orders(&self, user_id: &str) -> MultichainResult<Vec<DexOrder>> {
        let db = self.db.lock().await;
        db.load_dex_orders_for_user(user_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use zion_l1_types::{Address, AssetId, ChainFamily, ChainId, Hash};

    use crate::chain::adapter::{ChainAdapter, DepositEvent};
    use crate::chain::ChainAdapterRegistry;
    use crate::multichain_wallet::ledger::WalletLedger;
    use crate::swap::dex::{DexRouter, Pool};

    struct MockAdapter {
        family: ChainFamily,
        transfer_token_calls: std::sync::Arc<std::sync::Mutex<Vec<(String, String, u128)>>>,
    }

    impl Default for MockAdapter {
        fn default() -> Self {
            Self {
                family: ChainFamily::Evm,
                transfer_token_calls: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
            }
        }
    }

    impl MockAdapter {
        fn new(family: ChainFamily) -> Self {
            Self {
                family,
                transfer_token_calls: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
            }
        }
    }

    #[async_trait]
    impl ChainAdapter for MockAdapter {
        fn name(&self) -> &str {
            "mock"
        }

        fn family(&self) -> ChainFamily {
            self.family
        }

        async fn health_check(&self) -> MultichainResult<bool> {
            Ok(true)
        }

        async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
            Ok(Vec::new())
        }

        async fn current_height(&self) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn confirmations(&self, _tx_hash: &Hash) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }

        async fn transfer_token(
            &self,
            token: &Asset,
            to: &Address,
            amount: Amount,
        ) -> MultichainResult<Hash> {
            self.transfer_token_calls
                .lock()
                .unwrap()
                .push((token.id.to_string(), to.encoded.clone(), amount.0));
            Ok(Hash([0u8; 32]))
        }

        async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
            Ok(Amount::ZERO)
        }

        async fn execute_outbound(&self, _transfer: &crate::types::Transfer) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }
    }

    fn evm_asset(chain: ChainId, ticker: &str, contract: &str) -> Asset {
        Asset {
            id: AssetId::new(chain, ticker, Some(contract.to_string())),
            decimals: 18,
            name: ticker.to_string(),
        }
    }

    #[tokio::test]
    async fn internal_swap_updates_ledger_and_pool_reserves() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let usdc = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");

        dex.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
        });

        let user_id = "user1";
        ledger.credit(user_id, &zion, Amount::new(10_000_000)).await.unwrap();

        let adapters = ChainAdapterRegistry::new();
        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let order = executor
            .execute_swap(
                user_id,
                &zion,
                &usdc,
                Amount::new(1_000_000),
                Amount::ZERO,
                None,
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Executed);
        assert!(order.amount_out.0 > 0);

        let zion_balance = ledger.balance(user_id, &zion).await.unwrap();
        assert_eq!(zion_balance.0, 9_000_000);

        let usdc_balance = ledger.balance(user_id, &usdc).await.unwrap();
        assert_eq!(usdc_balance.0, order.amount_out.0);
    }

    #[tokio::test]
    async fn external_settlement_calls_adapter_transfer_token() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let base = ChainId::Base;
        let wzion = evm_asset(base, "wZION", "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6");
        let usdc = evm_asset(base, "USDC", "0xA0b86a33E6B8");

        dex.add_pool(Pool {
            id: 1,
            asset_a: wzion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000_000_000_000_000u128),
            reserve_b: Amount::new(1_000_000_000_000_000),
            fee_bps: 30,
        });

        let user_id = "user1";
        ledger.credit(user_id, &wzion, Amount::new(10_000_000_000_000_000_000u128))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::default();
        let calls = mock.transfer_token_calls.clone();
        adapters.register(base, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(
            base,
            vec![0u8; 20],
            "0x0000000000000000000000000000000000000001",
        )
        .unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &wzion,
                &usdc,
                Amount::new(1_000_000_000_000_000_000u128),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.tx_hash.is_some());

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, usdc.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);
    }

    #[tokio::test]
    async fn zion_to_btc_swap_settles_on_bitcoin() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let btc = Asset::native(ChainId::Bitcoin, "BTC", 8, "Bitcoin");

        dex.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: btc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(10_000_000_000),
            fee_bps: 30,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &zion, Amount::new(10_000_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::new(ChainFamily::Utxo);
        let calls = mock.transfer_token_calls.clone();
        adapters.register(ChainId::Bitcoin, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(ChainId::Bitcoin, Vec::new(), "bc1qrecipient").unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &zion,
                &btc,
                Amount::new(1_000_000),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.amount_out.0 > 0);
        assert_eq!(order.route, vec![zion.id.to_string(), btc.id.to_string()]);

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, btc.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);

        let zion_balance = ledger.balance(user_id, &zion).await.unwrap();
        assert_eq!(zion_balance.0, 9_000_000);
    }

    #[tokio::test]
    async fn btc_to_zion_swap_settles_on_zion_l1() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let btc = Asset::native(ChainId::Bitcoin, "BTC", 8, "Bitcoin");

        dex.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: btc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(10_000_000_000),
            fee_bps: 30,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &btc, Amount::new(100_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::new(ChainFamily::Zion);
        let calls = mock.transfer_token_calls.clone();
        adapters.register(ChainId::ZionL1, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(ChainId::ZionL1, Vec::new(), "zion1recipient").unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &btc,
                &zion,
                Amount::new(100_000),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.amount_out.0 > 0);
        assert_eq!(order.route, vec![btc.id.to_string(), zion.id.to_string()]);

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, zion.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);
    }

    #[tokio::test]
    async fn cross_chain_bridge_hop_then_amm_settles_on_target_chain() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();

        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let wzion = Asset::with_contract(
            ChainId::Base,
            "wZION",
            "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
            18,
            "Wrapped ZION",
        );
        let usdc = Asset::with_contract(
            ChainId::Base,
            "USDC",
            "0xA0b86a33E6B8",
            6,
            "USD Coin",
        );

        // Bridge edge: ZION (ZionL1) <-> wZION (Base)
        dex.add_bridge_edge(zion.clone(), wzion.clone(), 10);

        // AMM pool on Base: wZION / USDC
        dex.add_pool(Pool {
            id: 2,
            asset_a: wzion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000_000_000_000_000u128),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &zion, Amount::new(10_000_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::new(ChainFamily::Evm);
        let calls = mock.transfer_token_calls.clone();
        adapters.register(ChainId::Base, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(
            ChainId::Base,
            vec![0u8; 20],
            "0x0000000000000000000000000000000000000002",
        )
        .unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &zion,
                &usdc,
                Amount::new(10_000_000),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.amount_out.0 > 0);
        assert_eq!(order.route.len(), 3);

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, usdc.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);

        let zion_balance = ledger.balance(user_id, &zion).await.unwrap();
        assert_eq!(zion_balance.0, 0);
    }
}
