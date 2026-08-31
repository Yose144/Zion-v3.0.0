//! On-chain vs internal ledger reconciliation.
//!
//! Periodically compares the balance held by the service hot wallet on each
//! chain with the sum of user balances (internal ledger) and AMM pool reserves
//! for the same chain/asset. Discrepancies are persisted as reconciliation
//! reports and can be exposed as alerts.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, RwLock};
use zion_l1_types::{Address, Amount, Asset, ChainId};

use crate::chain::ChainAdapterRegistry;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::service::parse_asset_key;
use crate::swap::dex::DexRouter;
use crate::wallet::Keyring;

/// A single reconciliation report for one chain/asset.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReconciliationReport {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub chain: String,
    pub asset_key: String,
    pub hot_wallet_address: Option<String>,
    pub on_chain: Amount,
    pub internal: Amount,
    pub pool_reserves: Amount,
    pub diff: i128,
    pub alert: bool,
    pub notes: Option<String>,
}

/// Runtime configuration for the reconciliation background task.
#[derive(Clone, Debug)]
pub struct ReconcilerConfig {
    pub interval: Duration,
    /// Difference larger than this triggers an alert.
    pub alert_threshold: Amount,
    pub enabled: bool,
}

impl ReconcilerConfig {
    /// Build a runtime configuration from the serialized service config.
    pub fn from_config(c: &crate::config::ReconciliationConfig) -> MultichainResult<Self> {
        let alert_threshold = c.alert_threshold.parse::<u128>().map_err(|e| {
            MultichainError::Validation(format!("invalid reconciliation alert_threshold: {e}"))
        })?;
        Ok(Self {
            interval: Duration::from_secs(c.interval_seconds),
            alert_threshold: Amount::new(alert_threshold),
            enabled: c.enabled,
        })
    }
}

impl Default for ReconcilerConfig {
    fn default() -> Self {
        Self {
            interval: Duration::from_secs(300),
            alert_threshold: Amount::new(1_000_000), // 1 ZION atomic unit scaled
            enabled: true,
        }
    }
}

/// Reconciles on-chain balances with internal ledger + pool reserves.
#[derive(Clone)]
pub struct Reconciler {
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    keyring: Keyring,
    dex: Arc<RwLock<DexRouter>>,
    config: ReconcilerConfig,
}

impl Reconciler {
    pub fn new(
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        keyring: Keyring,
        dex: Arc<RwLock<DexRouter>>,
        config: ReconcilerConfig,
    ) -> Self {
        Self {
            db,
            adapters,
            keyring,
            dex,
            config,
        }
    }

    /// Run the reconciliation loop. Never returns unless `enabled` is false.
    pub async fn run(&self) -> MultichainResult<()> {
        if !self.config.enabled {
            return Ok(());
        }

        loop {
            if let Err(e) = self.reconcile().await {
                tracing::warn!("reconciliation failed: {e}");
            }
            tokio::time::sleep(self.config.interval).await;
        }
    }

    /// Execute a single reconciliation pass and persist the reports.
    pub async fn reconcile(&self) -> MultichainResult<Vec<ReconciliationReport>> {
        let chains: Vec<ChainId> = self.adapters.chains();
        if chains.is_empty() {
            return Ok(Vec::new());
        }

        let mut ledger_totals: HashMap<String, Amount> = HashMap::new();
        {
            let db = self.db.lock().await;
            for (asset_key, amount) in db.load_all_wallet_balances()? {
                let current = ledger_totals.entry(asset_key).or_insert(Amount::ZERO);
                *current = current.saturating_add(amount);
            }
        }

        let pool_totals = self.pool_reserves().await;

        let mut reports = Vec::new();
        for &chain in &chains {
            let native_asset = native_asset_for_chain(chain);
            let asset_key = native_asset.id.to_string();

            let hot_address = match self.hot_wallet_address(chain) {
                Ok(addr) => addr,
                Err(e) => {
                    tracing::debug!(
                        "reconciliation: cannot derive hot wallet for {}: {e}",
                        chain.as_str()
                    );
                    continue;
                }
            };

            let Some(adapter) = self.adapters.get(chain) else {
                continue;
            };

            let on_chain = match adapter.balance(&hot_address).await {
                Ok(amount) => amount,
                Err(e) => {
                    tracing::warn!(
                        "reconciliation: balance query failed for {}: {e}",
                        chain.as_str()
                    );
                    reports.push(ReconciliationReport {
                        id: uuid::Uuid::new_v4().to_string(),
                        timestamp: Utc::now(),
                        chain: chain.as_str().to_string(),
                        asset_key: asset_key.clone(),
                        hot_wallet_address: Some(hot_address.encoded),
                        on_chain: Amount::ZERO,
                        internal: *ledger_totals.get(&asset_key).unwrap_or(&Amount::ZERO),
                        pool_reserves: *pool_totals.get(&asset_key).unwrap_or(&Amount::ZERO),
                        diff: 0,
                        alert: false,
                        notes: Some(format!("balance query failed: {e}")),
                    });
                    continue;
                }
            };

            let internal = *ledger_totals.get(&asset_key).unwrap_or(&Amount::ZERO);
            let pool = *pool_totals.get(&asset_key).unwrap_or(&Amount::ZERO);
            let expected = internal.saturating_add(pool);
            let diff = on_chain.0 as i128 - expected.0 as i128;
            let alert = diff.abs() > self.config.alert_threshold.0 as i128;

            reports.push(ReconciliationReport {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                chain: chain.as_str().to_string(),
                asset_key: asset_key.clone(),
                hot_wallet_address: Some(hot_address.encoded),
                on_chain,
                internal,
                pool_reserves: pool,
                diff,
                alert,
                notes: None,
            });
        }

        // Reconcile token assets that appear in the ledger or pools but are not the
        // chain native asset. For now we record an informational report because
        // the generic `ChainAdapter` does not yet expose token balance queries for
        // every chain.
        let native_asset_keys: std::collections::HashSet<String> = chains
            .iter()
            .map(|c| native_asset_for_chain(*c).id.to_string())
            .collect();

        let mut token_keys: std::collections::HashSet<String> =
            ledger_totals.keys().cloned().collect();
        token_keys.extend(pool_totals.keys().cloned());
        token_keys.retain(|k| !native_asset_keys.contains(k));

        for asset_key in token_keys {
            let (chain, ticker, contract) = match parse_asset_key(&asset_key) {
                Ok(parts) => parts,
                Err(_) => {
                    reports.push(ReconciliationReport {
                        id: uuid::Uuid::new_v4().to_string(),
                        timestamp: Utc::now(),
                        chain: "unknown".to_string(),
                        asset_key: asset_key.clone(),
                        hot_wallet_address: None,
                        on_chain: Amount::ZERO,
                        internal: *ledger_totals.get(&asset_key).unwrap_or(&Amount::ZERO),
                        pool_reserves: *pool_totals.get(&asset_key).unwrap_or(&Amount::ZERO),
                        diff: 0,
                        alert: false,
                        notes: Some("unparseable asset key".to_string()),
                    });
                    continue;
                }
            };

            let internal = *ledger_totals.get(&asset_key).unwrap_or(&Amount::ZERO);
            let pool = *pool_totals.get(&asset_key).unwrap_or(&Amount::ZERO);

            reports.push(ReconciliationReport {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                chain: chain.as_str().to_string(),
                asset_key: asset_key.clone(),
                hot_wallet_address: None,
                on_chain: Amount::ZERO,
                internal,
                pool_reserves: pool,
                diff: 0,
                alert: false,
                notes: Some(format!(
                    "token reconciliation not implemented ({ticker}; contract={contract:?})"
                )),
            });
        }

        {
            let db = self.db.lock().await;
            for report in &reports {
                db.save_reconciliation_report(report)?;
            }
        }

        for report in &reports {
            if report.alert {
                tracing::warn!(
                    "reconciliation ALERT for {}: on-chain {} vs expected {} (diff {})",
                    report.asset_key,
                    report.on_chain.0,
                    report.internal.saturating_add(report.pool_reserves).0,
                    report.diff
                );
            }
        }

        Ok(reports)
    }

    /// Return the service hot wallet address for a given chain.
    fn hot_wallet_address(&self, chain: ChainId) -> MultichainResult<Address> {
        self.keyring.address(chain, 0, 0)
    }

    /// Aggregate AMM pool reserves by asset key.
    async fn pool_reserves(&self) -> HashMap<String, Amount> {
        let mut totals: HashMap<String, Amount> = HashMap::new();
        let guard = self.dex.read().await;
        for pool in guard.pools() {
            let a = totals
                .entry(pool.asset_a.id.to_string())
                .or_insert(Amount::ZERO);
            *a = a.saturating_add(pool.reserve_a);
            let b = totals
                .entry(pool.asset_b.id.to_string())
                .or_insert(Amount::ZERO);
            *b = b.saturating_add(pool.reserve_b);
        }
        totals
    }
}

/// Map a chain to its native asset.
fn native_asset_for_chain(chain: ChainId) -> Asset {
    use zion_l1_types::ChainFamily;
    let ticker = match chain.family() {
        ChainFamily::Utxo => "BTC",
        ChainFamily::Zion => "ZION",
        ChainFamily::Evm => "ETH",
        ChainFamily::Solana => "SOL",
        ChainFamily::Cosmos => "ATOM",
        ChainFamily::Near => "NEAR",
        ChainFamily::Ton => "TON",
        ChainFamily::Tron => "TRX",
        ChainFamily::Stellar => "XLM",
        ChainFamily::Cardano => "ADA",
        ChainFamily::Lightning => "BTC",
        ChainFamily::Move => "MOVE",
    };
    Asset::native(chain, ticker, chain.decimals(), ticker)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chain::adapter::{ChainAdapter, DepositEvent};
    use crate::multichain_wallet::ledger::WalletLedger;
    use crate::swap::dex::{DexRouter, Pool};
    use async_trait::async_trait;
    use zion_l1_types::{Address, ChainFamily, Hash};

    #[derive(Default)]
    struct MockAdapter {
        balance: Amount,
    }

    #[async_trait]
    impl ChainAdapter for MockAdapter {
        fn name(&self) -> &str {
            "mock"
        }

        fn family(&self) -> ChainFamily {
            ChainFamily::Zion
        }

        async fn health_check(&self) -> MultichainResult<bool> {
            Ok(true)
        }

        async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
            Ok(Vec::new())
        }

        async fn execute_outbound(
            &self,
            _transfer: &crate::types::Transfer,
        ) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
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

        async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
            Ok(self.balance)
        }
    }

    #[tokio::test]
    async fn reconciliation_reports_mismatch_and_alert() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = Asset::native(ChainId::ZionL1, "ZION", 8, "ZION");

        ledger
            .credit("user1", &asset, Amount::new(5_000_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(
            ChainId::ZionL1,
            Box::new(MockAdapter {
                balance: Amount::new(4_000_000),
            }),
        );

        let dex = Arc::new(RwLock::new(DexRouter::new()));
        let keyring = Keyring::generate().unwrap();

        let reconciler = Reconciler::new(
            Arc::clone(&db),
            Arc::new(adapters),
            keyring,
            Arc::clone(&dex),
            ReconcilerConfig {
                interval: Duration::from_secs(1),
                alert_threshold: Amount::new(1),
                enabled: true,
            },
        );

        let reports = reconciler.reconcile().await.unwrap();
        assert!(!reports.is_empty());

        let zion_report = reports
            .iter()
            .find(|r| r.asset_key == asset.id.to_string())
            .unwrap();
        assert_eq!(zion_report.on_chain.0, 4_000_000);
        assert_eq!(zion_report.internal.0, 5_000_000);
        assert_eq!(zion_report.diff, -1_000_000);
        assert!(zion_report.alert);

        let saved = {
            let db = db.lock().await;
            db.load_reconciliation_reports(10).unwrap()
        };
        assert_eq!(saved.len(), 1);
        assert!(saved[0].alert);
    }

    #[tokio::test]
    async fn reconciliation_includes_pool_reserves() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let zion = Asset::native(ChainId::ZionL1, "ZION", 8, "ZION");
        let btc = Asset::native(ChainId::Bitcoin, "BTC", 8, "BTC");

        ledger
            .credit("user1", &zion, Amount::new(2_000_000))
            .await
            .unwrap();

        let pool = Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: btc.clone(),
            reserve_a: Amount::new(3_000_000),
            reserve_b: Amount::new(1_000_000),
            fee_bps: 30,
        };

        let mut dex = DexRouter::new();
        dex.add_pool(pool);
        let dex = Arc::new(RwLock::new(dex));

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(
            ChainId::ZionL1,
            Box::new(MockAdapter {
                balance: Amount::new(5_000_000),
            }),
        );

        let reconciler = Reconciler::new(
            Arc::clone(&db),
            Arc::new(adapters),
            Keyring::generate().unwrap(),
            Arc::clone(&dex),
            ReconcilerConfig::default(),
        );

        let reports = reconciler.reconcile().await.unwrap();
        let zion_report = reports
            .iter()
            .find(|r| r.asset_key == zion.id.to_string())
            .unwrap();
        assert_eq!(zion_report.on_chain.0, 5_000_000);
        assert_eq!(zion_report.internal.0, 2_000_000);
        assert_eq!(zion_report.pool_reserves.0, 3_000_000);
        assert_eq!(zion_report.diff, 0);
        assert!(!zion_report.alert);
    }
}
