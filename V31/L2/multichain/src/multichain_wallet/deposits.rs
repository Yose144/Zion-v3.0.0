//! Deposit watcher / credit logic.
//!
//! This module is responsible for polling chain adapters for deposits sent to
//! per-user deposit addresses and crediting the internal ledger once finality
//! is reached.

use std::sync::Arc;

use tokio::sync::Mutex;

use crate::db::Db;

/// Deposit watcher for all known deposit addresses.
#[derive(Clone)]
pub struct DepositWatcher {
    db: Arc<Mutex<Db>>,
}

impl DepositWatcher {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }
}
