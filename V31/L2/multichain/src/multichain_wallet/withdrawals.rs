//! Withdrawal request processing.
//!
//! Records a user's withdrawal intent, debits the internal ledger, and submits
//! the on-chain payment through the appropriate chain adapter.

use std::sync::Arc;

use tokio::sync::Mutex;

use crate::db::Db;

/// Withdrawal processor.
#[derive(Clone)]
pub struct WithdrawalProcessor {
    db: Arc<Mutex<Db>>,
}

impl WithdrawalProcessor {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }
}
