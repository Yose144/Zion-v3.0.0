//! Withdrawal request processing.
//!
//! Records a user's withdrawal intent, debits the internal ledger, and submits
//! the on-chain payment through the appropriate chain adapter.

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;
use zion_l1_types::{Address, Amount, Asset, AssetId, ChainId};

use crate::chain::ChainAdapterRegistry;
use crate::contracts::token_decimals;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::multichain_wallet::ledger::WalletLedger;
use crate::multichain_wallet::types::{WithdrawalRecord, WithdrawalStatus};
use crate::solvency::SolvencyGuard;

/// Withdrawal processor.
#[derive(Clone)]
pub struct WithdrawalProcessor {
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    poll_interval: Duration,
    /// Optional solvency guard — when set, withdrawals are blocked if the hot
    /// wallet has insufficient on-chain balance.
    solvency: Option<SolvencyGuard>,
}

impl WithdrawalProcessor {
    /// `ledger` is accepted for constructor compatibility — balance
    /// mutations now go through `Db` atomic methods, not the ledger.
    pub fn new(
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        _ledger: WalletLedger,
    ) -> Self {
        Self {
            db,
            adapters,
            poll_interval: Duration::from_secs(30),
            solvency: None,
        }
    }

    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    /// Attach a `SolvencyGuard` to block withdrawals when the hot wallet has
    /// insufficient on-chain balance.
    pub fn with_solvency(mut self, guard: SolvencyGuard) -> Self {
        self.solvency = Some(guard);
        self
    }

    /// Run the withdrawal processor loop. Intended to be spawned as a background
    /// task; it never returns unless it encounters a fatal error.
    pub async fn run(&self) -> MultichainResult<()> {
        loop {
            if let Err(e) = self.process_pending().await {
                tracing::warn!("withdrawal processor poll failed: {e}");
            }
            tokio::time::sleep(self.poll_interval).await;
        }
    }

    /// Create a pending withdrawal: debit the ledger and persist the request.
    pub async fn request_withdraw(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
        recipient_address: &str,
    ) -> MultichainResult<String> {
        let recipient = parse_recipient(recipient_address, asset.id.chain)?;
        let id = uuid::Uuid::new_v4().to_string();

        // Pre-flight solvency check: verify service-controlled on-chain funds
        // (hot wallet + funded deposit addresses) cover the liability before
        // debiting the user. This prevents creating withdrawals that would
        // fail at settlement time.
        if let Some(ref guard) = self.solvency {
            guard.verify_withdrawal(asset, amount).await?;
        }

        let record = WithdrawalRecord {
            id: id.clone(),
            user_id: user_id.to_string(),
            asset_key: asset.id.to_string(),
            amount,
            recipient_address: recipient.encoded,
            tx_hash: None,
            status: WithdrawalStatus::Pending,
            created_at: chrono::Utc::now(),
            sent_at: None,
        };

        // Debit + record atomically in ONE SQLite transaction — no
        // debit→record crash window and no nested-lock credit-back
        // compensation (which deadlocked on the same Mutex).
        {
            let mut db = self.db.lock().await;
            db.atomic_debit_and_record_withdrawal(&record)?;
        }

        Ok(id)
    }

    /// Process all pending withdrawals.
    pub async fn process_pending(&self) -> MultichainResult<()> {
        let pending = {
            let db = self.db.lock().await;
            db.load_pending_withdrawals()?
        };

        for record in pending {
            if let Err(e) = self.process_one(&record).await {
                tracing::warn!("failed to process withdrawal {}: {}", record.id, e);
            }
        }
        Ok(())
    }

    async fn process_one(&self, record: &WithdrawalRecord) -> MultichainResult<()> {
        // Validate everything BEFORE claiming — an unprocessable record
        // must not be parked in `executing` by a claim that then errors.
        let asset = asset_from_key(&record.asset_key)?;
        let recipient = parse_recipient(&record.recipient_address, asset.id.chain)?;

        let adapter = self
            .adapters
            .get(asset.id.chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(asset.id.chain.as_str().to_string()))?;

        // Claim-before-send: atomically flip `pending` → `executing` under
        // one lock so a crash after broadcast never lets a later poll
        // resubmit a payment that may already be on-chain. `executing`
        // rows are NOT returned by `load_pending_withdrawals`, so an
        // ambiguous submission never auto-retries — safety > liveness.
        let claimed = {
            let db = self.db.lock().await;
            db.claim_withdrawal(&record.id)?
        };
        if !claimed {
            // Another worker claimed it, or the row is already terminal.
            return Ok(());
        }

        let tx_hash = adapter
            .transfer_token(&asset, &recipient, record.amount)
            .await;

        let mut db = self.db.lock().await;
        match tx_hash {
            Ok(hash) => {
                // Persist failure leaves the row `executing` — the
                // broadcast may already be out; never resubmit.
                db.update_withdrawal(&record.id, WithdrawalStatus::Sent, Some(&hash.to_hex()))?;
            }
            Err(e) => {
                // AMBIGUOUS OUTCOME — a generic adapter error cannot prove
                // the payment never broadcast. Hold `executing`: NO auto
                // refund, NO resend. Operator must verify on-chain state
                // and reconcile (mark Failed + credit) manually.
                tracing::error!(
                    "withdrawal {} broadcast outcome ambiguous ({}): held `executing`, no auto-refund/resend — manual reconciliation required",
                    record.id, e
                );
                return Err(e);
            }
        }
        Ok(())
    }
}

fn parse_recipient(encoded: &str, chain: ChainId) -> MultichainResult<Address> {
    let bytes = match chain.family() {
        zion_l1_types::ChainFamily::Evm => {
            let hex = encoded.strip_prefix("0x").unwrap_or(encoded);
            let bytes = hex::decode(hex)
                .map_err(|_| MultichainError::Validation("invalid evm address hex".to_string()))?;
            if bytes.len() != 20 {
                return Err(MultichainError::Validation(
                    "evm address must be 20 bytes".to_string(),
                ));
            }
            bytes
        }
        zion_l1_types::ChainFamily::Solana | zion_l1_types::ChainFamily::Near => {
            bs58::decode(encoded)
                .into_vec()
                .map_err(|_| MultichainError::Validation("invalid base58 address".to_string()))?
        }
        _ => Vec::new(),
    };
    Ok(Address::new(chain, bytes, encoded)?)
}

fn asset_from_key(asset_key: &str) -> MultichainResult<Asset> {
    let parts: Vec<&str> = asset_key.split(':').collect();
    if parts.len() < 2 {
        return Err(MultichainError::Validation(format!(
            "invalid asset key: {}",
            asset_key
        )));
    }
    let chain = chain_id_from_str(parts[0])?;
    let ticker = parts[1].to_string();
    let contract = parts.get(2).map(|s| s.to_string());
    let id = AssetId::new(chain, ticker.clone(), contract.clone());
    let decimals = token_decimals(chain.as_str(), &ticker, contract.as_deref());
    Ok(Asset {
        id,
        decimals,
        name: ticker,
    })
}

fn chain_id_from_str(s: &str) -> MultichainResult<ChainId> {
    use crate::db::chain_id_from_str;
    chain_id_from_str(s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use zion_l1_types::{Address, ChainFamily, Hash};

    use crate::chain::adapter::DepositEvent;
    use crate::multichain_wallet::ledger::WalletLedger;

    #[derive(Default)]
    struct MockAdapter {
        calls: std::sync::Arc<std::sync::Mutex<Vec<(String, String, u128)>>>,
    }

    #[async_trait]
    impl crate::chain::adapter::ChainAdapter for MockAdapter {
        fn name(&self) -> &str {
            "mock"
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
            self.calls
                .lock()
                .unwrap()
                .push((token.id.to_string(), to.encoded.clone(), amount.0));
            Ok(Hash([0u8; 32]))
        }

        async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
            Ok(Amount::ZERO)
        }

        async fn execute_outbound(
            &self,
            _transfer: &crate::types::Transfer,
        ) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }
    }

    /// Fails `transfer_token` with a generic error — models an
    /// ambiguous broadcast outcome (may or may not have gone out).
    struct FailAdapter {
        calls: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    }

    #[async_trait]
    impl crate::chain::adapter::ChainAdapter for FailAdapter {
        fn name(&self) -> &str {
            "mock"
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
        async fn current_height(&self) -> MultichainResult<u64> {
            Ok(1)
        }
        async fn confirmations(&self, _tx_hash: &Hash) -> MultichainResult<u64> {
            Ok(1)
        }
        async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
            Err(MultichainError::Internal("send failed".into()))
        }
        async fn transfer_token(
            &self,
            _token: &Asset,
            _to: &Address,
            _amount: Amount,
        ) -> MultichainResult<Hash> {
            self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            Err(MultichainError::Internal(
                "broadcast outcome unknown".into(),
            ))
        }
        async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
            Ok(Amount::ZERO)
        }
        async fn execute_outbound(
            &self,
            _transfer: &crate::types::Transfer,
        ) -> MultichainResult<Hash> {
            Err(MultichainError::Internal("unsupported".into()))
        }
    }

    fn usdc_asset() -> Asset {
        Asset {
            id: AssetId::new(ChainId::Base, "USDC", Some("0xA0b86a33E6B8".to_string())),
            decimals: 6,
            name: "USD Coin".to_string(),
        }
    }

    #[tokio::test]
    async fn withdrawal_request_debits_ledger_and_process_sends_token() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();
        let user_id = "user1";
        let amount = Amount::new(1_000_000);

        ledger
            .credit(user_id, &asset, Amount::new(10_000_000))
            .await
            .unwrap();

        let mut adapters = crate::chain::ChainAdapterRegistry::new();
        let mock = MockAdapter::default();
        let calls = mock.calls.clone();
        adapters.register(ChainId::Base, Box::new(mock));

        let processor =
            WithdrawalProcessor::new(Arc::clone(&db), Arc::new(adapters), ledger.clone());

        processor
            .request_withdraw(
                user_id,
                &asset,
                amount,
                "0x0000000000000000000000000000000000000001",
            )
            .await
            .unwrap();

        let balance = ledger.balance(user_id, &asset).await.unwrap();
        assert_eq!(balance.0, 9_000_000);

        processor.process_pending().await.unwrap();

        let db = db.lock().await;
        let pending = db.load_pending_withdrawals().unwrap();
        assert!(pending.is_empty());

        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, asset.id.to_string());
        assert_eq!(calls[0].1, "0x0000000000000000000000000000000000000001");
        assert_eq!(calls[0].2, 1_000_000);
    }

    // ── Atomic debit+record ──────────────────────────────────────────

    fn tmp_db() -> (String, Arc<Mutex<Db>>) {
        let p = std::env::temp_dir()
            .join(format!("zion-wd-{}.db", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        (p.clone(), Arc::new(Mutex::new(Db::open(&p).unwrap())))
    }

    fn processor(db: &Arc<Mutex<Db>>) -> (WithdrawalProcessor, WalletLedger) {
        let ledger = WalletLedger::new(Arc::clone(db));
        let mut adapters = crate::chain::ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(MockAdapter::default()));
        (
            WithdrawalProcessor::new(Arc::clone(db), Arc::new(adapters), ledger.clone()),
            ledger,
        )
    }

    async fn seeded(db: &Arc<Mutex<Db>>, u: &str, a: &Asset, amt: u128) -> WalletLedger {
        let (p, l) = processor(db);
        let _ = p;
        l.credit(u, a, Amount::new(amt)).await.unwrap();
        l
    }

    /// A failing withdrawal INSERT must return promptly (no deadlock on
    /// the shared Mutex) and leave balance + ledger + rows untouched.
    #[tokio::test]
    async fn request_withdraw_insert_failure_is_atomic_and_no_deadlock() {
        let (path, db) = tmp_db();
        let asset = usdc_asset();
        let ledger = seeded(&db, "u1", &asset, 10_000_000).await;
        let (p, _) = processor(&db);
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch("CREATE TRIGGER fail_wd BEFORE INSERT ON withdrawals BEGIN SELECT RAISE(FAIL,'x'); END;").unwrap();
        let r = tokio::time::timeout(
            Duration::from_secs(5),
            p.request_withdraw(
                "u1",
                &asset,
                Amount::new(1_000_000),
                "0x0000000000000000000000000000000000000001",
            ),
        )
        .await
        .expect("must not deadlock")
        .expect_err("insert fails");
        let _ = r;
        assert_eq!(ledger.balance("u1", &asset).await.unwrap().0, 10_000_000);
        let g = db.lock().await;
        assert!(g.load_pending_withdrawals().unwrap().is_empty());
        assert!(g
            .load_ledger_entries("u1", 10)
            .unwrap()
            .iter()
            .all(|e| e.reason != "withdraw"));
        drop(g);
        drop(conn);
        std::fs::remove_file(&path).ok();
    }

    #[tokio::test]
    async fn request_withdraw_insufficient_balance_rolls_back() {
        let (path, db) = tmp_db();
        let asset = usdc_asset();
        let ledger = seeded(&db, "u2", &asset, 5).await;
        let (p, _) = processor(&db);
        assert!(p
            .request_withdraw(
                "u2",
                &asset,
                Amount::new(10),
                "0x0000000000000000000000000000000000000001"
            )
            .await
            .is_err());
        assert_eq!(ledger.balance("u2", &asset).await.unwrap().0, 5);
        let g = db.lock().await;
        assert!(g.load_pending_withdrawals().unwrap().is_empty());
        drop(g);
        std::fs::remove_file(&path).ok();
    }

    #[tokio::test]
    async fn atomic_withdrawal_writes_row_journal_balance() {
        let (path, db) = tmp_db();
        let asset = usdc_asset();
        let seeded_l = seeded(&db, "u3", &asset, 10_000_000).await;
        let (p, ledger) = processor(&db);
        let _ = seeded_l;
        let id = p
            .request_withdraw(
                "u3",
                &asset,
                Amount::new(1_000_000),
                "0x0000000000000000000000000000000000000001",
            )
            .await
            .unwrap();
        assert_eq!(ledger.balance("u3", &asset).await.unwrap().0, 9_000_000);
        let g = db.lock().await;
        let pending = g.load_pending_withdrawals().unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].id, id);
        let entries = g.load_ledger_entries("u3", 10).unwrap();
        let debits: Vec<_> = entries.iter().filter(|e| e.reason == "withdraw").collect();
        assert_eq!(debits.len(), 1);
        assert_eq!(debits[0].id, format!("withdraw:{id}"));
        assert_eq!(debits[0].reference_id.as_deref(), Some(id.as_str()));
        drop(g);
        std::fs::remove_file(&path).ok();
    }

    #[tokio::test]
    async fn atomic_withdrawal_duplicate_id_no_second_debit() {
        let (path, db) = tmp_db();
        let asset = usdc_asset();
        seeded(&db, "u4", &asset, 10_000_000).await;
        let rec = WithdrawalRecord {
            id: "wd-dup".into(),
            user_id: "u4".into(),
            asset_key: asset.id.to_string(),
            amount: Amount::new(1_000_000),
            recipient_address: "0x1".into(),
            tx_hash: None,
            status: WithdrawalStatus::Pending,
            created_at: chrono::Utc::now(),
            sent_at: None,
        };
        {
            let mut g = db.lock().await;
            g.atomic_debit_and_record_withdrawal(&rec).unwrap();
            assert!(g.atomic_debit_and_record_withdrawal(&rec).is_err());
        }
        let ledger = WalletLedger::new(Arc::clone(&db));
        assert_eq!(ledger.balance("u4", &asset).await.unwrap().0, 9_000_000);
        std::fs::remove_file(&path).ok();
    }

    /// Forcing the balance-update write to fail must roll back the
    /// withdrawal row and the journal debit as well.
    #[tokio::test]
    async fn atomic_withdrawal_balance_update_failure_rolls_back_all() {
        let (path, db) = tmp_db();
        let asset = usdc_asset();
        let ledger = seeded(&db, "u5", &asset, 10_000_000).await;
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch("CREATE TRIGGER fail_bal BEFORE INSERT ON wallet_balances BEGIN SELECT RAISE(FAIL,'x'); END;").unwrap();
        let (p, _) = processor(&db);
        assert!(p
            .request_withdraw(
                "u5",
                &asset,
                Amount::new(1_000_000),
                "0x0000000000000000000000000000000000000001"
            )
            .await
            .is_err());
        assert_eq!(ledger.balance("u5", &asset).await.unwrap().0, 10_000_000);
        let g = db.lock().await;
        assert!(g.load_pending_withdrawals().unwrap().is_empty());
        assert!(g
            .load_ledger_entries("u5", 10)
            .unwrap()
            .iter()
            .all(|e| e.reason != "withdraw"));
        drop(g);
        drop(conn);
        std::fs::remove_file(&path).ok();
    }

    // ── Claim-before-send (process_one) ──────────────────────────────

    /// `executing` serializes/parses round-trip.
    #[test]
    fn withdrawal_status_executing_roundtrip() {
        use std::str::FromStr;
        assert_eq!(WithdrawalStatus::Executing.to_string(), "executing");
        assert_eq!(
            WithdrawalStatus::from_str("executing").unwrap(),
            WithdrawalStatus::Executing
        );
        let j = serde_json::to_string(&WithdrawalStatus::Executing).unwrap();
        assert_eq!(j, "\"executing\"");
        assert_eq!(
            serde_json::from_str::<WithdrawalStatus>(&j).unwrap(),
            WithdrawalStatus::Executing
        );
    }

    /// Two concurrent `process_one` calls on the same pending record —
    /// the CAS claim lets exactly ONE broadcast.
    #[tokio::test]
    async fn concurrent_process_one_sends_once() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();
        ledger
            .credit("u6", &asset, Amount::new(10_000_000))
            .await
            .unwrap();
        let calls = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let mut adapters = crate::chain::ChainAdapterRegistry::new();
        adapters.register(
            ChainId::Base,
            Box::new(MockAdapter {
                calls: calls.clone(),
            }),
        );
        let p = WithdrawalProcessor::new(Arc::clone(&db), Arc::new(adapters), ledger.clone());
        p.request_withdraw(
            "u6",
            &asset,
            Amount::new(1_000_000),
            "0x0000000000000000000000000000000000000001",
        )
        .await
        .unwrap();
        let rec = {
            let g = db.lock().await;
            g.load_pending_withdrawals().unwrap().remove(0)
        };
        let (r1, r2) = tokio::join!(p.process_one(&rec), p.process_one(&rec));
        assert!(r1.is_ok() && r2.is_ok());
        assert_eq!(calls.lock().unwrap().len(), 1, "exactly one broadcast");
        let g = db.lock().await;
        assert!(g.load_pending_withdrawals().unwrap().is_empty());
    }

    /// If the claim CAS fails (trigger), NOTHING is broadcast, the row
    /// stays `pending`, and the debit is unchanged.
    #[tokio::test]
    async fn claim_failure_sends_nothing() {
        let (path, db) = tmp_db();
        let asset = usdc_asset();
        let ledger = seeded(&db, "u7", &asset, 10_000_000).await;
        let calls = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let mut adapters = crate::chain::ChainAdapterRegistry::new();
        adapters.register(
            ChainId::Base,
            Box::new(MockAdapter {
                calls: calls.clone(),
            }),
        );
        let p = WithdrawalProcessor::new(Arc::clone(&db), Arc::new(adapters), ledger.clone());
        p.request_withdraw(
            "u7",
            &asset,
            Amount::new(1_000_000),
            "0x0000000000000000000000000000000000000001",
        )
        .await
        .unwrap();
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER fail_claim BEFORE UPDATE ON withdrawals BEGIN SELECT RAISE(FAIL,'x'); END;",
        )
        .unwrap();
        // process_pending swallows per-record errors; check side effects.
        p.process_pending().await.unwrap();
        assert_eq!(
            calls.lock().unwrap().len(),
            0,
            "a failed claim must not broadcast"
        );
        assert_eq!(
            ledger.balance("u7", &asset).await.unwrap().0,
            9_000_000,
            "debit stands, no phantom refund"
        );
        let g = db.lock().await;
        assert_eq!(g.load_pending_withdrawals().unwrap().len(), 1);
        drop(g);
        drop(conn);
        std::fs::remove_file(&path).ok();
    }

    /// Ambiguous broadcast error → `executing` hold: debit stands, no
    /// resend on later polls.
    #[tokio::test]
    async fn ambiguous_error_holds_executing_no_resend() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();
        ledger
            .credit("u8", &asset, Amount::new(10_000_000))
            .await
            .unwrap();
        let send_calls = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let mut adapters = crate::chain::ChainAdapterRegistry::new();
        adapters.register(
            ChainId::Base,
            Box::new(FailAdapter {
                calls: send_calls.clone(),
            }),
        );
        let p = WithdrawalProcessor::new(Arc::clone(&db), Arc::new(adapters), ledger.clone());
        p.request_withdraw(
            "u8",
            &asset,
            Amount::new(1_000_000),
            "0x0000000000000000000000000000000000000001",
        )
        .await
        .unwrap();
        p.process_pending().await.unwrap();
        assert_eq!(send_calls.load(std::sync::atomic::Ordering::SeqCst), 1);
        // executing — not pending — so a second poll sends nothing.
        p.process_pending().await.unwrap();
        assert_eq!(send_calls.load(std::sync::atomic::Ordering::SeqCst), 1);
        // balance still debited — NO auto-refund on ambiguous outcome.
        assert_eq!(ledger.balance("u8", &asset).await.unwrap().0, 9_000_000);
        let g = db.lock().await;
        let rows = g.load_withdrawals_for_user("u8").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].status, WithdrawalStatus::Executing);
    }

    /// Broadcast accepted but the `sent` persist fails → `executing`
    /// hold; a FRESH processor/DB handle must not resend.
    #[tokio::test]
    async fn sent_persist_failure_holds_and_never_resends() {
        let (path, db) = tmp_db();
        let asset = usdc_asset();
        seeded(&db, "u9", &asset, 10_000_000).await;
        let calls = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        {
            let mut adapters = crate::chain::ChainAdapterRegistry::new();
            adapters.register(
                ChainId::Base,
                Box::new(MockAdapter {
                    calls: calls.clone(),
                }),
            );
            let p = WithdrawalProcessor::new(
                Arc::clone(&db),
                Arc::new(adapters),
                WalletLedger::new(Arc::clone(&db)),
            );
            p.request_withdraw(
                "u9",
                &asset,
                Amount::new(1_000_000),
                "0x0000000000000000000000000000000000000001",
            )
            .await
            .unwrap();
        }
        // Fail only the transition to `sent` (claim → `executing` is fine).
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER fail_sent BEFORE UPDATE ON withdrawals WHEN NEW.status='sent' BEGIN SELECT RAISE(FAIL,'x'); END;",
        )
        .unwrap();
        {
            let mut adapters = crate::chain::ChainAdapterRegistry::new();
            adapters.register(
                ChainId::Base,
                Box::new(MockAdapter {
                    calls: calls.clone(),
                }),
            );
            let p = WithdrawalProcessor::new(
                Arc::clone(&db),
                Arc::new(adapters),
                WalletLedger::new(Arc::clone(&db)),
            );
            p.process_pending().await.unwrap();
            assert_eq!(calls.lock().unwrap().len(), 1);
        }
        // Fresh DB handle + processor = simulated restart: the executing
        // row is NOT pending → never resent.
        drop(conn);
        let db2 = Arc::new(Mutex::new(Db::open(&path).unwrap()));
        let mut adapters = crate::chain::ChainAdapterRegistry::new();
        adapters.register(
            ChainId::Base,
            Box::new(MockAdapter {
                calls: calls.clone(),
            }),
        );
        let p2 = WithdrawalProcessor::new(
            Arc::clone(&db2),
            Arc::new(adapters),
            WalletLedger::new(Arc::clone(&db2)),
        );
        p2.process_pending().await.unwrap();
        assert_eq!(calls.lock().unwrap().len(), 1);
        let g = db2.lock().await;
        let rows = g.load_withdrawals_for_user("u9").unwrap();
        assert_eq!(rows[0].status, WithdrawalStatus::Executing);
        drop(g);
        std::fs::remove_file(&path).ok();
    }
}
