//! Minimal in-memory mempool for the ZION L1 node.
//!
//! A production mempool needs feerate eviction, RBF, and DoS limits. The Alpha
//! implementation keeps the pending transaction set simple while the rest of the
//! node stack is wired together.

use tokio::sync::Mutex;
use zion_l1_types::Hash;

use crate::transaction::Transaction;

/// Pending transaction pool.
#[derive(Default)]
pub struct Mempool {
    txs: Mutex<Vec<Transaction>>,
}

impl Mempool {
    pub fn new() -> Self {
        Self {
            txs: Mutex::new(Vec::new()),
        }
    }

    /// Add a transaction if its hash is not already present.
    pub async fn add(&self, tx: Transaction) {
        let mut txs = self.txs.lock().await;
        let hash = tx.hash();
        if !txs.iter().any(|t| t.hash() == hash) {
            txs.push(tx);
        }
    }

    /// Return a copy of the pending transactions for block template building.
    pub async fn pending(&self) -> Vec<Transaction> {
        self.txs.lock().await.clone()
    }

    /// Remove transactions included in a block.
    pub async fn remove(&self, hashes: &[Hash]) {
        let mut txs = self.txs.lock().await;
        txs.retain(|t| !hashes.contains(&t.hash()));
    }

    /// Current pending count.
    pub async fn len(&self) -> usize {
        self.txs.lock().await.len()
    }

    /// True if no transactions are pending.
    pub async fn is_empty(&self) -> bool {
        self.txs.lock().await.is_empty()
    }
}
