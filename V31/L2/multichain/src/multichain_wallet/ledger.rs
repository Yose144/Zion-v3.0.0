use std::sync::Arc;

use tokio::sync::Mutex;
use zion_l1_types::{Amount, Asset};

use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};

/// Internal custodial ledger. Records what each user is allowed to trade or
/// withdraw without touching on-chain balances directly.
#[derive(Clone)]
pub struct WalletLedger {
    db: Arc<Mutex<Db>>,
}

impl WalletLedger {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }

    pub async fn balance(&self, user_id: &str, asset: &Asset) -> MultichainResult<Amount> {
        let db = self.db.lock().await;
        db.load_wallet_balance(user_id, &asset_key(asset))
    }

    pub async fn credit(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
    ) -> MultichainResult<()> {
        let mut db = self.db.lock().await;
        let asset_key = asset_key(asset);
        let current = db.load_wallet_balance(user_id, &asset_key)?;
        db.save_wallet_balance(user_id, &asset_key, current.saturating_add(amount))?;
        Ok(())
    }

    pub async fn debit(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
    ) -> MultichainResult<()> {
        let mut db = self.db.lock().await;
        let asset_key = asset_key(asset);
        let current = db.load_wallet_balance(user_id, &asset_key)?;
        if current.0 < amount.0 {
            return Err(MultichainError::Validation(format!(
                "insufficient balance for {user_id} {asset_key}: have {current}, need {amount}"
            )));
        }
        db.save_wallet_balance(user_id, &asset_key, current.saturating_sub(amount))?;
        Ok(())
    }

    pub async fn set_balance(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
    ) -> MultichainResult<()> {
        let mut db = self.db.lock().await;
        db.save_wallet_balance(user_id, &asset_key(asset), amount)?;
        Ok(())
    }
}

pub fn asset_key(asset: &Asset) -> String {
    asset.id.to_string()
}
