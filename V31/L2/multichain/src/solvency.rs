//! Solvency guard — blocks swaps and withdrawals when the service-controlled
//! on-chain balance (hot wallet + funded deposit addresses) is insufficient
//! to honour the operation.
//!
//! The guard is a *pre-flight* check: before debiting the user's internal
//! ledger for a withdrawal, or before executing a swap whose output must be
//! settled on-chain, the guard queries the chain adapter for the service's
//! real on-chain balance of the relevant asset and compares it against the
//! sum of:
//!
//!   * all user internal-ledger balances for that asset (the custodial claims),
//!   * AMM pool reserves for that asset,
//!   * the pending withdrawal queue for that asset (already debited but not yet
//!     sent on-chain),
//!   * the amount of the new operation being authorised.
//!
//! If `on_chain < claims + new_amount`, the operation is rejected with
//! [`MultichainError::InsufficientSolvency`]. This prevents the operator from
//! issuing on-chain payments that would fail or — worse — silently over-spending
//! the hot wallet when multiple withdrawals race.
//!
//! The guard is intentionally conservative: it always sums *all* outstanding
//! claims for the asset, not just the requesting user's balance. This means
//! that even if the hot wallet holds enough for one user's withdrawal, the
//! guard will reject it when the total custodial liability exceeds the
//! on-chain balance. This is the correct behaviour for a custodial system: the
//! operator must be solvent against *all* users, not just the one requesting.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{Mutex, RwLock};
use zion_l1_types::{Address, Amount, Asset, ChainId};

use crate::chain::ChainAdapterRegistry;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::swap::dex::DexRouter;
use crate::wallet::Keyring;

/// Configuration for the solvency guard.
#[derive(Clone, Debug)]
pub struct SolvencyConfig {
    /// When `true`, the guard rejects operations that would over-spend the hot
    /// wallet. When `false`, the guard logs warnings but allows the operation
    /// (useful for dev/test environments with empty hot wallets).
    pub enforce: bool,
    /// Safety margin added to the requested amount when checking solvency.
    /// Expressed in atomic units of the asset. This covers gas/buffer for
    /// on-chain transaction fees and minor reconciliation drift.
    pub margin: Amount,
}

impl Default for SolvencyConfig {
    fn default() -> Self {
        Self {
            enforce: true,
            margin: Amount::ZERO,
        }
    }
}

/// Result of a solvency check.
#[derive(Clone, Debug)]
pub struct SolvencyCheck {
    /// Asset that was checked.
    pub asset_key: String,
    /// Service-controlled on-chain balance for the asset (hot wallet plus
    /// funded deposit addresses — the same set reconciliation reports).
    pub on_chain: Amount,
    /// Total internal-ledger claims (all users) for the asset.
    pub ledger_claims: Amount,
    /// AMM pool reserves for the asset.
    pub pool_reserves: Amount,
    /// Pending withdrawals already debited but not yet sent on-chain.
    pub pending_withdrawals: Amount,
    /// The new operation amount that was being authorised.
    pub new_amount: Amount,
    /// Whether the operation is solvent (on_chain >= claims + new_amount).
    pub solvent: bool,
}

impl SolvencyCheck {
    /// Total claims including the new operation amount and safety margin.
    pub fn total_required(&self) -> Amount {
        self.ledger_claims
            .saturating_add(self.pool_reserves)
            .saturating_add(self.pending_withdrawals)
            .saturating_add(self.new_amount)
    }
}

/// Solvency guard that checks service-controlled on-chain balances (hot
/// wallet + funded deposit addresses) before allowing swaps and withdrawals.
#[derive(Clone)]
pub struct SolvencyGuard {
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    keyring: Keyring,
    dex: Arc<RwLock<DexRouter>>,
    config: SolvencyConfig,
}

impl SolvencyGuard {
    pub fn new(
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        keyring: Keyring,
        dex: Arc<RwLock<DexRouter>>,
        config: SolvencyConfig,
    ) -> Self {
        Self {
            db,
            adapters,
            keyring,
            dex,
            config,
        }
    }

    pub fn config(&self) -> &SolvencyConfig {
        &self.config
    }

    /// Derive the hot wallet address for a chain.
    fn hot_wallet_address(&self, chain: ChainId) -> MultichainResult<Address> {
        self.keyring.address(chain, 0, 0)
    }

    /// Load the total internal-ledger claims for an asset key (sum of all user
    /// balances).
    async fn ledger_claims(&self, asset_key: &str) -> Amount {
        let db = self.db.lock().await;
        db.load_all_wallet_balances()
            .unwrap_or_default()
            .into_iter()
            .filter(|(k, _)| k == asset_key)
            .map(|(_, v)| v)
            .fold(Amount::ZERO, |acc, v| acc.saturating_add(v))
    }

    /// Load pending (debited but not sent) withdrawals for an asset key.
    async fn pending_withdrawals(&self, asset_key: &str) -> Amount {
        let db = self.db.lock().await;
        db.load_pending_withdrawals()
            .unwrap_or_default()
            .into_iter()
            .filter(|w| w.asset_key == asset_key)
            .map(|w| w.amount)
            .fold(Amount::ZERO, |acc, v| acc.saturating_add(v))
    }

    /// AMM pool reserves for an asset key.
    async fn pool_reserves(&self, asset_key: &str) -> Amount {
        let guard = self.dex.read().await;
        guard
            .pools()
            .iter()
            .filter(|p| p.asset_a.id.to_string() == asset_key || p.asset_b.id.to_string() == asset_key)
            .fold(Amount::ZERO, |acc, p| {
                let reserve = if p.asset_a.id.to_string() == asset_key {
                    p.reserve_a
                } else {
                    p.reserve_b
                };
                acc.saturating_add(reserve)
            })
    }

    /// All service-controlled addresses on `chain`: the hot wallet first,
    /// then every funded deposit address (deduplicated). Custodial deposits
    /// are credited per-user and never swept automatically, so checking only
    /// the hot wallet under-reports the on-chain backing — reconciliation
    /// already uses the same address set.
    async fn service_addresses(&self, chain: ChainId, hot: &Address) -> Vec<Address> {
        let deposits: Vec<Address> = {
            let db = self.db.lock().await;
            db.load_funded_deposit_addresses()
                .unwrap_or_default()
                .into_iter()
                .filter(|w| w.chain == chain)
                .map(|w| w.address)
                .collect()
        };
        let mut out = vec![hot.clone()];
        for addr in deposits {
            if !out.contains(&addr) {
                out.push(addr);
            }
        }
        out
    }

    /// Sum `asset` balances over every service-controlled address on the
    /// chain. Balance query errors propagate — when backing cannot be
    /// measured the check must fail closed rather than under-report.
    async fn service_on_chain_balance(
        &self,
        asset: &Asset,
        chain: ChainId,
    ) -> MultichainResult<Amount> {
        let hot_address = self.hot_wallet_address(chain)?;
        let adapter = self
            .adapters
            .get(chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(chain.as_str().to_string()))?;

        let mut total = Amount::ZERO;
        for addr in self.service_addresses(chain, &hot_address).await {
            total = total.saturating_add(adapter.token_balance(asset, &addr).await?);
            // Public RPC endpoints rate-limit bursts; pace per-address queries.
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }
        Ok(total)
    }

    /// Evaluate solvency for `asset` and `new_amount` without enforcement.
    /// Always returns the `SolvencyCheck` (including `solvent=false` results)
    /// so callers like `check_all` can report insolvent assets.
    async fn evaluate(&self, asset: &Asset, new_amount: Amount) -> MultichainResult<SolvencyCheck> {
        let asset_key = asset.id.to_string();
        let chain = asset.id.chain;

        let on_chain = self.service_on_chain_balance(asset, chain).await?;
        let ledger_claims = self.ledger_claims(&asset_key).await;
        let pool_reserves = self.pool_reserves(&asset_key).await;
        let pending_withdrawals = self.pending_withdrawals(&asset_key).await;
        let new_with_margin = new_amount.saturating_add(self.config.margin);

        let total_required = ledger_claims
            .saturating_add(pool_reserves)
            .saturating_add(pending_withdrawals)
            .saturating_add(new_with_margin);

        let solvent = on_chain >= total_required;

        let check = SolvencyCheck {
            asset_key,
            on_chain,
            ledger_claims,
            pool_reserves,
            pending_withdrawals,
            new_amount: new_with_margin,
            solvent,
        };

        Ok(check)
    }

    /// Run a full solvency check for `asset` and `new_amount`.
    ///
    /// Returns `Ok(check)` if solvent, `Err(InsufficientSolvency)` if not (and
    /// enforcement is enabled), or `Ok(check)` with `solvent=false` if
    /// enforcement is disabled.
    pub async fn check(
        &self,
        asset: &Asset,
        new_amount: Amount,
    ) -> MultichainResult<SolvencyCheck> {
        let check = self.evaluate(asset, new_amount).await?;
        if !check.solvent {
            let required = check
                .ledger_claims
                .saturating_add(check.pool_reserves)
                .saturating_add(check.pending_withdrawals)
                .saturating_add(check.new_amount);
            let deficit = required.0.saturating_sub(check.on_chain.0);
            if self.config.enforce {
                tracing::warn!(
                    "SOLVENCY GUARD rejected: asset={} on_chain={} required={} deficit={}",
                    check.asset_key,
                    check.on_chain.0,
                    required.0,
                    deficit
                );
                return Err(MultichainError::InsufficientSolvency {
                    asset: check.asset_key.clone(),
                    on_chain: check.on_chain.0,
                    required: required.0,
                    deficit,
                });
            }
            tracing::warn!(
                "SOLVENCY GUARD warning (not enforced): asset={} on_chain={} required={} deficit={}",
                check.asset_key,
                check.on_chain.0,
                required.0,
                deficit
            );
        }
        Ok(check)
    }

    /// Convenience: check solvency for a withdrawal of `amount` of `asset`.
    /// Returns `Ok(())` if solvent (or enforcement disabled), `Err` otherwise.
    ///
    /// Verify a withdrawal can be honored. The user's claim is already part of
    /// `ledger_claims` (the check runs before the ledger debit), so passing the
    /// amount again would double-count it — a full-balance withdrawal would
    /// always fail on an exactly-solvent wallet. `Amount::ZERO` still applies
    /// the configured margin headroom.
    pub async fn verify_withdrawal(
        &self,
        asset: &Asset,
        _amount: Amount,
    ) -> MultichainResult<()> {
        self.check(asset, Amount::ZERO).await.map(|_| ())
    }

    /// Convenience: check solvency for a swap output of `amount_out` of `asset`.
    /// This verifies the hot wallet can deliver the output token on-chain.
    pub async fn verify_swap_output(
        &self,
        asset: &Asset,
        amount_out: Amount,
    ) -> MultichainResult<()> {
        self.check(asset, amount_out).await.map(|_| ())
    }
}

/// Run solvency checks for all assets known to the system (ledger + pools).
/// Returns a map of asset_key → SolvencyCheck. This is used by the
/// reconciliation background task and the admin API.
pub async fn check_all(guard: &SolvencyGuard) -> MultichainResult<HashMap<String, SolvencyCheck>> {
    let mut results = HashMap::new();

    // Collect all asset keys from ledger balances and pool reserves.
    let mut asset_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

    {
        let db = guard.db.lock().await;
        if let Ok(balances) = db.load_all_wallet_balances() {
            for (k, _) in balances {
                asset_keys.insert(k);
            }
        }
    }

    {
        let dex = guard.dex.read().await;
        for pool in dex.pools() {
            asset_keys.insert(pool.asset_a.id.to_string());
            asset_keys.insert(pool.asset_b.id.to_string());
        }
    }

    for key in asset_keys {
        // Parse the asset key to reconstruct the Asset descriptor.
        let asset = match parse_asset_key_to_asset(&key) {
            Some(a) => a,
            None => continue,
        };
        // evaluate() with zero new_amount gives the current solvency state,
        // including insolvent assets (enforcement is skipped here).
        match guard.evaluate(&asset, Amount::ZERO).await {
            Ok(c) => {
                results.insert(key, c);
            }
            Err(e) => {
                tracing::debug!("solvency check_all: {} failed: {}", key, e);
            }
        }
    }

    Ok(results)
}

fn parse_asset_key_to_asset(asset_key: &str) -> Option<Asset> {
    use crate::db::chain_id_from_str;
    use zion_l1_types::{Asset, AssetId};
    let parts: Vec<&str> = asset_key.split(':').collect();
    if parts.len() < 2 {
        return None;
    }
    let chain = chain_id_from_str(parts[0]).ok()?;
    let ticker = parts[1].to_string();
    let contract = parts.get(2).map(|s| s.to_string());
    let id = AssetId::new(chain, ticker.clone(), contract.clone());
    let decimals = crate::contracts::token_decimals(chain.as_str(), &ticker, contract.as_deref());
    Some(Asset {
        id,
        decimals,
        name: ticker,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chain::adapter::{ChainAdapter, DepositEvent};
    use crate::multichain_wallet::ledger::WalletLedger;
    use crate::swap::dex::{DexRouter, Pool};
    use crate::types::Transfer;
    use async_trait::async_trait;
    use zion_l1_types::{ChainFamily, Hash};

    /// Mock adapter that returns a configurable token balance.
    struct SolvencyMockAdapter {
        native_balance: Amount,
        token_balances: std::sync::Arc<std::sync::Mutex<HashMap<String, Amount>>>,
    }

    #[async_trait]
    impl ChainAdapter for SolvencyMockAdapter {
        fn name(&self) -> &str {
            "solvency-mock"
        }

        fn family(&self) -> ChainFamily {
            ChainFamily::Evm
        }

        async fn health_check(&self) -> MultichainResult<bool> {
            Ok(true)
        }

        async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
            Ok(Vec::new())
        }

        async fn execute_outbound(&self, _t: &Transfer) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }

        async fn current_height(&self) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn confirmations(&self, _h: &Hash) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn send_payment(&self, _to: &Address, _amt: Amount) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }

        async fn balance(&self, _addr: &Address) -> MultichainResult<Amount> {
            Ok(self.native_balance)
        }

        async fn token_balance(
            &self,
            asset: &Asset,
            _addr: &Address,
        ) -> MultichainResult<Amount> {
            if asset.id.contract.is_none() {
                return Ok(self.native_balance);
            }
            let map = self.token_balances.lock().unwrap();
            Ok(*map.get(&asset.id.to_string()).unwrap_or(&Amount::ZERO))
        }
    }

    fn usdc_asset() -> Asset {
        Asset::with_contract(
            ChainId::Base,
            "USDC",
            "0xA0b86a33E6B8",
            6,
            "USD Coin",
        )
    }

    #[tokio::test]
    async fn solvency_guard_rejects_when_insufficient() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();

        // User has 10M USDC in internal ledger.
        ledger
            .credit("user1", &asset, Amount::new(10_000_000))
            .await
            .unwrap();

        // Hot wallet only has 5M USDC on-chain.
        let token_balances = std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()));
        token_balances
            .lock()
            .unwrap()
            .insert(asset.id.to_string(), Amount::new(5_000_000));

        let adapter = SolvencyMockAdapter {
            native_balance: Amount::ZERO,
            token_balances,
        };

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(adapter));

        let dex = Arc::new(RwLock::new(DexRouter::new()));
        let keyring = Keyring::generate().unwrap();

        let guard = SolvencyGuard::new(
            Arc::clone(&db),
            Arc::new(adapters),
            keyring,
            Arc::clone(&dex),
            SolvencyConfig {
                enforce: true,
                margin: Amount::ZERO,
            },
        );

        // Withdrawal of 6M should fail: 10M ledger claims + 6M new = 16M required,
        // but on-chain only 5M.
        let result = guard.verify_withdrawal(&asset, Amount::new(6_000_000)).await;
        assert!(result.is_err(), "should reject insufficient withdrawal");
        match result.unwrap_err() {
            MultichainError::InsufficientSolvency { deficit, .. } => {
                assert!(deficit > 0);
            }
            other => panic!("expected InsufficientSolvency, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn solvency_guard_allows_when_sufficient() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();

        ledger
            .credit("user1", &asset, Amount::new(10_000_000))
            .await
            .unwrap();

        // Hot wallet has 20M USDC — more than enough.
        let token_balances = std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()));
        token_balances
            .lock()
            .unwrap()
            .insert(asset.id.to_string(), Amount::new(20_000_000));

        let adapter = SolvencyMockAdapter {
            native_balance: Amount::ZERO,
            token_balances,
        };

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(adapter));

        let dex = Arc::new(RwLock::new(DexRouter::new()));
        let keyring = Keyring::generate().unwrap();

        let guard = SolvencyGuard::new(
            Arc::clone(&db),
            Arc::new(adapters),
            keyring,
            Arc::clone(&dex),
            SolvencyConfig::default(),
        );

        // Withdrawal of 5M: 10M claims + 5M new = 15M required, 20M on-chain → OK.
        let result = guard.verify_withdrawal(&asset, Amount::new(5_000_000)).await;
        assert!(result.is_ok(), "should allow sufficient withdrawal");
    }

    #[tokio::test]
    async fn solvency_guard_warns_but_allows_when_not_enforced() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();

        ledger
            .credit("user1", &asset, Amount::new(10_000_000))
            .await
            .unwrap();

        let token_balances = std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()));
        token_balances
            .lock()
            .unwrap()
            .insert(asset.id.to_string(), Amount::new(1_000_000));

        let adapter = SolvencyMockAdapter {
            native_balance: Amount::ZERO,
            token_balances,
        };

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(adapter));

        let dex = Arc::new(RwLock::new(DexRouter::new()));
        let keyring = Keyring::generate().unwrap();

        let guard = SolvencyGuard::new(
            Arc::clone(&db),
            Arc::new(adapters),
            keyring,
            Arc::clone(&dex),
            SolvencyConfig {
                enforce: false,
                margin: Amount::ZERO,
            },
        );

        // Insufficient but not enforced → Ok with solvent=false.
        let check = guard.check(&asset, Amount::new(5_000_000)).await.unwrap();
        assert!(!check.solvent);
    }

    #[tokio::test]
    async fn solvency_guard_accounts_for_pool_reserves() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let usdc = usdc_asset();
        let zion = Asset::native(ChainId::Base, "ZION", 8, "ZION");

        // 5M USDC in user ledger, 5M USDC in pool reserves → 10M total claims.
        ledger
            .credit("user1", &usdc, Amount::new(5_000_000))
            .await
            .unwrap();

        let pool = Pool {
            id: 1,
            asset_a: usdc.clone(),
            asset_b: zion.clone(),
            reserve_a: Amount::new(5_000_000),
            reserve_b: Amount::new(2_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        };
        let mut dex_router = DexRouter::new();
        dex_router.add_pool(pool);
        let dex = Arc::new(RwLock::new(dex_router));

        // On-chain: 12M USDC vs claims 10M → solvent; a withdrawal merely
        // relocates an existing claim (no new liability) so it is allowed.
        let token_balances = std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()));
        token_balances
            .lock()
            .unwrap()
            .insert(usdc.id.to_string(), Amount::new(12_000_000));

        let adapter = SolvencyMockAdapter {
            native_balance: Amount::ZERO,
            token_balances: Arc::clone(&token_balances),
        };

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(adapter));

        let keyring = Keyring::generate().unwrap();
        let guard = SolvencyGuard::new(
            Arc::clone(&db),
            Arc::new(adapters),
            keyring,
            Arc::clone(&dex),
            SolvencyConfig::default(),
        );

        let result = guard.verify_withdrawal(&usdc, Amount::new(3_000_000)).await;
        assert!(result.is_ok(), "withdrawal relocates an existing claim — solvent");

        // Drop on-chain to 9M < claims 10M → insolvent even for a small withdrawal.
        token_balances
            .lock()
            .unwrap()
            .insert(usdc.id.to_string(), Amount::new(9_000_000));
        let result = guard.verify_withdrawal(&usdc, Amount::new(1_000_000)).await;
        assert!(result.is_err(), "should reject when claims exceed on-chain balance");
    }

    #[tokio::test]
    async fn check_all_reports_insolvent_assets_when_enforced() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();

        ledger
            .credit("user1", &asset, Amount::new(10_000_000))
            .await
            .unwrap();

        let token_balances = std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()));
        token_balances
            .lock()
            .unwrap()
            .insert(asset.id.to_string(), Amount::new(1_000_000));

        let adapter = SolvencyMockAdapter {
            native_balance: Amount::ZERO,
            token_balances,
        };

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(adapter));

        let dex = Arc::new(RwLock::new(DexRouter::new()));
        let keyring = Keyring::generate().unwrap();

        let guard = SolvencyGuard::new(
            Arc::clone(&db),
            Arc::new(adapters),
            keyring,
            Arc::clone(&dex),
            SolvencyConfig {
                enforce: true,
                margin: Amount::ZERO,
            },
        );

        let report = check_all(&guard).await.unwrap();
        let check = report
            .get(&asset.id.to_string())
            .expect("insolvent asset must appear in the report");
        assert!(!check.solvent);
        assert_eq!(check.on_chain, Amount::new(1_000_000));
        assert_eq!(check.ledger_claims, Amount::new(10_000_000));
    }

    /// Adapter whose `token_balance` is keyed by the queried address —
    /// needed to verify that funded deposit addresses count toward solvency.
    struct PerAddressAdapter {
        balances: HashMap<String, Amount>,
    }

    #[async_trait]
    impl ChainAdapter for PerAddressAdapter {
        fn name(&self) -> &str {
            "per-address-mock"
        }

        fn family(&self) -> ChainFamily {
            ChainFamily::Evm
        }

        async fn health_check(&self) -> MultichainResult<bool> {
            Ok(true)
        }

        async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
            Ok(Vec::new())
        }

        async fn execute_outbound(&self, _t: &Transfer) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }

        async fn current_height(&self) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn confirmations(&self, _h: &Hash) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn send_payment(&self, _to: &Address, _amt: Amount) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }

        async fn balance(&self, addr: &Address) -> MultichainResult<Amount> {
            Ok(*self.balances.get(&addr.encoded).unwrap_or(&Amount::ZERO))
        }

        async fn token_balance(&self, _asset: &Asset, addr: &Address) -> MultichainResult<Amount> {
            Ok(*self.balances.get(&addr.encoded).unwrap_or(&Amount::ZERO))
        }
    }

    #[tokio::test]
    async fn solvency_counts_funded_deposit_addresses() {
        use crate::multichain_wallet::types::{
            AddressPurpose, DepositRecord, DepositStatus, WalletAddress,
        };
        use chrono::Utc;

        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();
        let keyring = Keyring::generate().unwrap();

        // User liability is 10M USDC in the internal ledger.
        ledger
            .credit("user1", &asset, Amount::new(10_000_000))
            .await
            .unwrap();

        // Hot wallet (index 0,0) is empty; the funded deposit address
        // (index 0,1) holds the real backing.
        let hot = keyring.address(ChainId::Base, 0, 0).unwrap();
        let deposit_addr = keyring.address(ChainId::Base, 0, 1).unwrap();
        assert_ne!(hot.encoded, deposit_addr.encoded);

        {
            let db = db.lock().await;
            db.save_wallet_address(&WalletAddress {
                address: deposit_addr.clone(),
                user_id: "user1".into(),
                chain: ChainId::Base,
                chain_id: None,
                purpose: AddressPurpose::Deposit,
                public_key: None,
                derivation_path: "m/44'/0'/0'/0/1".into(),
                is_external: false,
                created_at: Utc::now(),
            })
            .unwrap();
            db.record_deposit(&DepositRecord {
                id: "dep1".into(),
                user_id: "user1".into(),
                chain: ChainId::Base,
                chain_id: None,
                tx_hash: "0xabc".into(),
                asset_key: asset.id.to_string(),
                amount: Amount::new(20_000_000),
                confirmations: 12,
                status: DepositStatus::Credited,
                created_at: Utc::now(),
                credited_at: Some(Utc::now()),
            })
            .unwrap();
        }

        let mut balances = HashMap::new();
        balances.insert(hot.encoded.clone(), Amount::ZERO);
        balances.insert(deposit_addr.encoded.clone(), Amount::new(20_000_000));
        let adapter = PerAddressAdapter { balances };

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(adapter));

        let dex = Arc::new(RwLock::new(DexRouter::new()));
        let guard = SolvencyGuard::new(
            Arc::clone(&db),
            Arc::new(adapters),
            keyring,
            Arc::clone(&dex),
            SolvencyConfig {
                enforce: true,
                margin: Amount::ZERO,
            },
        );

        // 6M withdrawal against 10M claims needs 16M backing; the deposit
        // address holds 20M, so this must pass even though the hot wallet
        // alone is empty.
        let check = guard
            .check(&asset, Amount::new(6_000_000))
            .await
            .expect("deposit-backed withdrawal must be solvent");
        assert!(check.solvent);
        assert_eq!(check.on_chain, Amount::new(20_000_000));
        assert_eq!(check.ledger_claims, Amount::new(10_000_000));
    }
}
