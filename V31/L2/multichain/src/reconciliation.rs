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
    /// Asset keys (or `chain:ticker` prefixes) excluded from alerting.
    /// Reports are still produced; the alert flag is suppressed.
    pub excluded_assets: std::collections::HashSet<String>,
}

impl ReconcilerConfig {
    /// Build a runtime configuration from the serialized service config.
    pub fn from_config(c: &crate::config::ReconciliationConfig) -> MultichainResult<Self> {
        let alert_threshold = c.alert_threshold.parse::<u128>().map_err(|e| {
            MultichainError::Validation(format!("invalid reconciliation alert_threshold: {e}"))
        })?;
        // FIND-023: bounds-check the alert threshold.  Must be > 0 (otherwise
        // every reconciliation triggers an alert) and <= 21M ZION (total supply
        // in atomic units with 6 decimals) so a misconfigured huge threshold
        // doesn't silently suppress all alerts.
        if alert_threshold == 0 {
            return Err(MultichainError::Validation(
                "reconciliation alert_threshold must be > 0".into(),
            ));
        }
        const MAX_ZION_SUPPLY: u128 = 21_000_000 * 100_000_000;
        if alert_threshold > MAX_ZION_SUPPLY {
            return Err(MultichainError::Validation(format!(
                "reconciliation alert_threshold {alert_threshold} exceeds MAX_ZION_SUPPLY ({MAX_ZION_SUPPLY})"
            )));
        }
        Ok(Self {
            interval: Duration::from_secs(c.interval_seconds),
            alert_threshold: Amount::new(alert_threshold),
            enabled: c.enabled,
            excluded_assets: c.excluded_assets.iter().cloned().collect(),
        })
    }

    /// True when `asset_key` (`chain:ticker[:contract]`) is configured as
    /// excluded — matched exactly or by its `chain:ticker` prefix.
    pub fn is_excluded(&self, asset_key: &str) -> bool {
        if self.excluded_assets.contains(asset_key) {
            return true;
        }
        // `chain:ticker` prefix entries match every contract variant.
        if let Some((chain, rest)) = asset_key.split_once(':') {
            if let Some((ticker, _)) = rest.split_once(':') {
                return self
                    .excluded_assets
                    .contains(format!("{chain}:{ticker}").as_str());
            }
        }
        false
    }
}

impl Default for ReconcilerConfig {
    fn default() -> Self {
        Self {
            interval: Duration::from_secs(300),
            alert_threshold: Amount::new(1_000_000), // 1 ZION atomic unit scaled
            enabled: true,
            excluded_assets: Default::default(),
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
        let mut deposit_addrs: HashMap<ChainId, Vec<Address>> = HashMap::new();
        {
            let db = self.db.lock().await;
            for (asset_key, amount) in db.load_all_wallet_balances()? {
                let current = ledger_totals.entry(asset_key).or_insert(Amount::ZERO);
                *current = current.saturating_add(amount);
            }
            // Custodial deposits are credited to per-user derived addresses and
            // are never swept to the hot wallet automatically, so the
            // service-controlled on-chain total must include them. Only funded
            // addresses are queried — unfunded ones contribute zero and just
            // burn public RPC rate-limit budget.
            match db.load_funded_deposit_addresses() {
                Ok(list) => {
                    for w in list {
                        deposit_addrs.entry(w.chain).or_default().push(w.address);
                    }
                }
                Err(e) => {
                    tracing::warn!("reconciliation: cannot load deposit addresses: {e}");
                }
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

            // Sum the balance over every service-controlled address: the hot
            // wallet plus all derived deposit addresses. Custodial deposits
            // are credited per-user and not swept automatically, so checking
            // only the hot wallet under-reports on-chain funds.
            let service_addrs = self.service_addresses(chain, &hot_address, &deposit_addrs);
            let mut on_chain = Amount::ZERO;
            let mut first_err: Option<String> = None;
            for addr in &service_addrs {
                let res = match adapter.balance(addr).await {
                    Err(e) if is_rate_limit(&e) => {
                        tokio::time::sleep(Duration::from_secs(2)).await;
                        adapter.balance(addr).await
                    }
                    other => other,
                };
                match res {
                    Ok(amount) => on_chain = on_chain.saturating_add(amount),
                    Err(e) => {
                        tracing::warn!(
                            "reconciliation: balance query failed for {} {}: {e}",
                            chain.as_str(),
                            addr.encoded
                        );
                        if first_err.is_none() {
                            first_err = Some(format!("balance query failed: {e}"));
                        }
                    }
                }
                // Public RPC endpoints rate-limit bursts; pace the per-address
                // queries so a full service sweep stays under the limit.
                tokio::time::sleep(Duration::from_millis(150)).await;
            }
            if on_chain == Amount::ZERO && first_err.is_some() {
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
                    notes: first_err,
                });
                continue;
            }

            let internal = *ledger_totals.get(&asset_key).unwrap_or(&Amount::ZERO);
            let pool = *pool_totals.get(&asset_key).unwrap_or(&Amount::ZERO);
            // The on-chain hot wallet holds both user balances (tracked in the
            // internal ledger) and AMM pool reserves (tracked separately in the
            // DEX).  Both must be summed to match the on-chain balance.
            let expected = internal.saturating_add(pool);
            let diff = on_chain.0 as i128 - expected.0 as i128;
            let excluded = self.config.is_excluded(&asset_key);
            let alert = !excluded && diff.abs() > self.config.alert_threshold.0 as i128;
            let notes = if excluded {
                Some(match first_err {
                    Some(n) => format!("excluded from alerting; {n}"),
                    None => "excluded from alerting".to_string(),
                })
            } else {
                first_err
            };

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
                notes,
            });
        }

        // Reconcile token assets that appear in the ledger or pools but are not the
        // chain native asset. Uses `ChainAdapter::token_balance` to query ERC-20
        // (or analogous) balances on the hot wallet.
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

            // Build the Asset descriptor for the token balance query.
            let asset = Asset {
                id: zion_l1_types::AssetId {
                    chain,
                    contract,
                    ticker: ticker.clone(),
                },
                decimals: chain.decimals(),
                name: ticker.clone(),
            };

            let (on_chain, hot_address_opt, notes) = match self.hot_wallet_address(chain) {
                Ok(hot_address) => {
                    let Some(adapter) = self.adapters.get(chain) else {
                        reports.push(ReconciliationReport {
                            id: uuid::Uuid::new_v4().to_string(),
                            timestamp: Utc::now(),
                            chain: chain.as_str().to_string(),
                            asset_key: asset_key.clone(),
                            hot_wallet_address: Some(hot_address.encoded),
                            on_chain: Amount::ZERO,
                            internal,
                            pool_reserves: pool,
                            diff: 0,
                            alert: false,
                            notes: Some("adapter not registered for token chain".to_string()),
                        });
                        continue;
                    };
                    // Sum over the hot wallet plus all derived deposit
                    // addresses — custodial deposits stay on per-user
                    // addresses until a withdrawal (or a future sweep).
                    let mut total = Amount::ZERO;
                    let mut first_err: Option<String> = None;
                    for addr in self.service_addresses(chain, &hot_address, &deposit_addrs) {
                        let res = match adapter.token_balance(&asset, &addr).await {
                            Err(e) if is_rate_limit(&e) => {
                                tokio::time::sleep(Duration::from_secs(2)).await;
                                adapter.token_balance(&asset, &addr).await
                            }
                            other => other,
                        };
                        match res {
                            Ok(amt) => total = total.saturating_add(amt),
                            Err(e) => {
                                tracing::warn!(
                                    "reconciliation: token_balance failed for {} {}: {e}",
                                    chain.as_str(),
                                    addr.encoded
                                );
                                if first_err.is_none() {
                                    first_err = Some(format!("token_balance failed: {e}"));
                                }
                            }
                        }
                        // Public RPC endpoints rate-limit bursts; pace the
                        // per-address queries.
                        tokio::time::sleep(Duration::from_millis(150)).await;
                    }
                    (total, Some(hot_address.encoded), first_err)
                }
                Err(e) => (
                    Amount::ZERO,
                    None,
                    Some(format!("cannot derive hot wallet: {e}")),
                ),
            };

            let expected = internal.saturating_add(pool);
            let diff = on_chain.0 as i128 - expected.0 as i128;
            let excluded = self.config.is_excluded(&asset_key);
            let alert = !excluded && diff.abs() > self.config.alert_threshold.0 as i128;
            let notes = if excluded {
                Some(match notes {
                    Some(n) => format!("excluded from alerting; {n}"),
                    None => "excluded from alerting".to_string(),
                })
            } else {
                notes
            };

            reports.push(ReconciliationReport {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                chain: chain.as_str().to_string(),
                asset_key: asset_key.clone(),
                hot_wallet_address: hot_address_opt,
                on_chain,
                internal,
                pool_reserves: pool,
                diff,
                alert,
                notes,
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

    /// All service-controlled addresses on `chain`: the hot wallet first,
    /// then every derived deposit address (deduplicated).
    fn service_addresses(
        &self,
        chain: ChainId,
        hot: &Address,
        deposits: &HashMap<ChainId, Vec<Address>>,
    ) -> Vec<Address> {
        let mut out = vec![hot.clone()];
        if let Some(list) = deposits.get(&chain) {
            for addr in list {
                if !out.contains(addr) {
                    out.push(addr.clone());
                }
            }
        }
        out
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

/// True when an adapter error is a public-RPC rate-limit response worth a
/// single retry (e.g. mainnet.base.org `over rate limit`, code -32016).
fn is_rate_limit(e: &MultichainError) -> bool {
    let msg = e.to_string();
    msg.contains("rate limit") || msg.contains("-32016") || msg.contains("429")
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
                excluded_assets: Default::default(),
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
    async fn reconciliation_includes_deposit_addresses() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = Asset::native(ChainId::ZionL1, "ZION", 8, "ZION");

        // User owes 8 ZION; funds are split between the hot wallet (5) and
        // the user's unswept deposit address (3).
        ledger
            .credit("user1", &asset, Amount::new(8_000_000))
            .await
            .unwrap();

        {
            let db_guard = db.lock().await;
            db_guard
                .save_wallet_address(&crate::multichain_wallet::types::WalletAddress {
                    address: Address {
                        chain: ChainId::ZionL1,
                        bytes: vec![0x42; 32],
                        encoded: "zion1deposit".to_string(),
                    },
                    user_id: "user1".to_string(),
                    chain: ChainId::ZionL1,
                    chain_id: None,
                    purpose: crate::multichain_wallet::types::AddressPurpose::Deposit,
                    public_key: None,
                    derivation_path: "m/44'/9999'/0'/0/0".to_string(),
                    is_external: false,
                    created_at: Utc::now(),
                })
                .unwrap();
            // The reconciliation query only covers *funded* deposit
            // addresses, so record a deposit for this user.
            db_guard
                .record_deposit(&crate::multichain_wallet::types::DepositRecord {
                    id: "dep1".to_string(),
                    user_id: "user1".to_string(),
                    chain: ChainId::ZionL1,
                    chain_id: None,
                    tx_hash: "deadbeef".to_string(),
                    asset_key: asset.id.to_string(),
                    amount: Amount::new(3_000_000),
                    confirmations: 10,
                    status: crate::multichain_wallet::types::DepositStatus::Credited,
                    created_at: Utc::now(),
                    credited_at: Some(Utc::now()),
                })
                .unwrap();
        }

        // MockAdapter returns the same per-address balance for every query,
        // so hot wallet (4) + deposit address (4) = 8 total.
        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(
            ChainId::ZionL1,
            Box::new(MockAdapter {
                balance: Amount::new(4_000_000),
            }),
        );

        let dex = Arc::new(RwLock::new(DexRouter::new()));
        let reconciler = Reconciler::new(
            Arc::clone(&db),
            Arc::new(adapters),
            Keyring::generate().unwrap(),
            Arc::clone(&dex),
            ReconcilerConfig {
                interval: Duration::from_secs(1),
                alert_threshold: Amount::new(1),
                enabled: true,
                excluded_assets: Default::default(),
            },
        );

        let reports = reconciler.reconcile().await.unwrap();
        let zion_report = reports
            .iter()
            .find(|r| r.asset_key == asset.id.to_string())
            .unwrap();
        // 4 (hot) + 4 (deposit address) = 8 — matches the ledger exactly.
        assert_eq!(zion_report.on_chain.0, 8_000_000);
        assert_eq!(zion_report.diff, 0);
        assert!(!zion_report.alert);
    }

    #[tokio::test]
    async fn reconciliation_excluded_assets_do_not_alert() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let zion = Asset::native(ChainId::ZionL1, "ZION", 8, "ZION");

        ledger
            .credit("user1", &zion, Amount::new(2_000_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(
            ChainId::ZionL1,
            Box::new(MockAdapter {
                balance: Amount::ZERO,
            }),
        );

        let reconciler = Reconciler::new(
            Arc::clone(&db),
            Arc::new(adapters),
            Keyring::generate().unwrap(),
            Arc::new(RwLock::new(DexRouter::new())),
            ReconcilerConfig {
                interval: Duration::from_secs(1),
                alert_threshold: Amount::new(1),
                enabled: true,
                excluded_assets: ["zion-l1:ZION"].into_iter().map(String::from).collect(),
            },
        );

        let reports = reconciler.reconcile().await.unwrap();
        let zion_report = reports
            .iter()
            .find(|r| r.asset_key == zion.id.to_string())
            .unwrap();
        // Huge drift (on-chain 0 vs internal 2M) but the asset is excluded —
        // the report row persists, only the alert flag is suppressed.
        assert_eq!(zion_report.diff, -2_000_000);
        assert!(!zion_report.alert);
        assert!(zion_report
            .notes
            .as_deref()
            .unwrap_or("")
            .contains("excluded"));
    }

    #[test]
    fn excluded_assets_match_full_key_and_ticker_prefix() {
        let cfg = ReconcilerConfig {
            excluded_assets: ["base:tZION".to_string(), "base:USDT:0xfde4".to_string()]
                .into_iter()
                .collect(),
            ..Default::default()
        };
        // `chain:ticker` prefix matches any contract variant.
        assert!(cfg.is_excluded("base:tZION:0xC5E79b8C6475137aC3a982651097a219B63b0c33"));
        // Full key matches exactly.
        assert!(cfg.is_excluded("base:USDT:0xfde4"));
        // Unrelated assets are not excluded.
        assert!(!cfg.is_excluded("base:wZION:0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"));
        assert!(!cfg.is_excluded("zion-l1:ZION"));
        // A `chain:ticker` entry does not swallow the native asset of another
        // chain sharing the ticker.
        assert!(!cfg.is_excluded("bitcoin:tZION"));
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
            amm_pair: None,
            amm_factory: None,
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
