//! Append-only journal ledger with atomic balance updates.
//!
//! Every credit / debit is recorded as an immutable [`JournalEntry`] and the
//! `wallet_balances` row is updated in the same SQL transaction, giving a full
//! audit trail alongside the current balance snapshot.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use tokio::sync::Mutex;
use zion_l1_types::{Amount, Asset};

use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};

use super::ledger::asset_key;

/// Whether a journal entry increases (credit) or decreases (debit) the
/// user's balance.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum JournalEntryType {
    Credit,
    Debit,
}

impl JournalEntryType {
    pub fn as_str(self) -> &'static str {
        match self {
            JournalEntryType::Credit => "credit",
            JournalEntryType::Debit => "debit",
        }
    }
}

/// A single immutable ledger entry.
#[derive(Clone, Debug)]
pub struct JournalEntry {
    pub id: String,
    pub user_id: String,
    pub asset_key: String,
    pub entry_type: JournalEntryType,
    pub amount: Amount,
    /// "deposit", "swap", "withdraw", "bridge", "adjustment", ...
    pub reason: String,
    /// Optional deposit_id / order_id / withdrawal_id linking the entry to an
    /// external record.
    pub reference_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Append-only journal ledger backed by SQLite.
///
/// Each [`credit`](Self::credit) / [`debit`](Self::debit) call inserts a
/// `ledger_entries` row and updates the `wallet_balances` row inside a single
/// `rusqlite` transaction, so the balance snapshot and the audit trail can
/// never diverge.
#[derive(Clone)]
pub struct JournalLedger {
    db: Arc<Mutex<Db>>,
}

impl JournalLedger {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }

    /// Atomically credit `amount` of `asset` to `user_id`'s balance and
    /// append a credit journal entry.
    pub async fn credit(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
        reason: &str,
        reference_id: Option<&str>,
    ) -> MultichainResult<()> {
        let mut db = self.db.lock().await;
        let key = asset_key(asset);
        let entry_id = new_entry_id();
        db.atomic_credit(
            user_id,
            &key,
            &amount.0.to_string(),
            &entry_id,
            reason,
            reference_id,
        )
    }

    /// Atomically debit `amount` of `asset` from `user_id`'s balance and
    /// append a debit journal entry. Returns an error if the balance is
    /// insufficient.
    pub async fn debit(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
        reason: &str,
        reference_id: Option<&str>,
    ) -> MultichainResult<()> {
        let mut db = self.db.lock().await;
        let key = asset_key(asset);
        let entry_id = new_entry_id();
        db.atomic_debit(
            user_id,
            &key,
            &amount.0.to_string(),
            &entry_id,
            reason,
            reference_id,
        )
    }

    /// Read the current balance for `user_id` / `asset`.
    pub async fn balance(&self, user_id: &str, asset: &Asset) -> MultichainResult<Amount> {
        let db = self.db.lock().await;
        db.load_wallet_balance(user_id, &asset_key(asset))
    }

    /// Return the most recent `limit` journal entries for `user_id`.
    pub async fn entries_for_user(
        &self,
        user_id: &str,
        limit: u32,
    ) -> MultichainResult<Vec<JournalEntry>> {
        let db = self.db.lock().await;
        db.load_ledger_entries(user_id, limit)
    }
}

/// Generate a unique journal entry id (ULID-style timestamp + random suffix).
fn new_entry_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let rand: u64 = rand::random();
    format!("je-{ts:020x}-{rand:016x}")
}

/// Parse a stored entry-type string back into [`JournalEntryType`].
fn parse_entry_type(s: &str) -> MultichainResult<JournalEntryType> {
    match s {
        "credit" => Ok(JournalEntryType::Credit),
        "debit" => Ok(JournalEntryType::Debit),
        other => Err(MultichainError::Internal(format!(
            "invalid journal entry_type: {other}"
        ))),
    }
}

// Re-exported for `db.rs` so it can construct `JournalEntry` rows without
// duplicating the parsing helpers.
pub(crate) fn parse_journal_entry(
    id: &str,
    user_id: &str,
    asset_key: &str,
    entry_type: &str,
    amount: &str,
    reason: &str,
    reference_id: Option<&str>,
    created_at: &str,
) -> MultichainResult<JournalEntry> {
    let amount = amount.parse::<u128>().map_err(|e| {
        MultichainError::Internal(format!("invalid journal amount: {e}"))
    })?;
    Ok(JournalEntry {
        id: id.to_string(),
        user_id: user_id.to_string(),
        asset_key: asset_key.to_string(),
        entry_type: parse_entry_type(entry_type)?,
        amount: Amount::new(amount),
        reason: reason.to_string(),
        reference_id: reference_id.map(|s| s.to_string()),
        created_at: crate::db::parse_datetime_pub(created_at)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use zion_l1_types::ChainId;

    fn make_asset() -> Asset {
        Asset::native(ChainId::ZionL1, "ZION", 6, "ZION")
    }

    #[tokio::test]
    async fn credit_and_balance_round_trip() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = JournalLedger::new(db);
        let asset = make_asset();

        ledger
            .credit("alice", &asset, Amount::new(1_000), "deposit", Some("dep-1"))
            .await
            .unwrap();

        assert_eq!(ledger.balance("alice", &asset).await.unwrap(), Amount::new(1_000));

        let entries = ledger.entries_for_user("alice", 10).await.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].entry_type, JournalEntryType::Credit);
        assert_eq!(entries[0].reason, "deposit");
        assert_eq!(entries[0].reference_id.as_deref(), Some("dep-1"));
    }

    #[tokio::test]
    async fn debit_reduces_balance_and_records_entry() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = JournalLedger::new(db);
        let asset = make_asset();

        ledger
            .credit("bob", &asset, Amount::new(500), "deposit", None)
            .await
            .unwrap();
        ledger
            .debit("bob", &asset, Amount::new(200), "withdraw", Some("wd-1"))
            .await
            .unwrap();

        assert_eq!(ledger.balance("bob", &asset).await.unwrap(), Amount::new(300));

        let entries = ledger.entries_for_user("bob", 10).await.unwrap();
        assert_eq!(entries.len(), 2);
        // Newest first: the debit was inserted after the credit.
        assert_eq!(entries[0].entry_type, JournalEntryType::Debit);
        assert_eq!(entries[1].entry_type, JournalEntryType::Credit);
    }

    #[tokio::test]
    async fn debit_insufficient_balance_fails_atomically() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = JournalLedger::new(db);
        let asset = make_asset();

        let res = ledger
            .debit("carol", &asset, Amount::new(100), "withdraw", None)
            .await;
        assert!(res.is_err());

        // No journal entry should have been recorded.
        assert!(ledger.entries_for_user("carol", 10).await.unwrap().is_empty());
        assert_eq!(ledger.balance("carol", &asset).await.unwrap(), Amount::ZERO);
    }
}
