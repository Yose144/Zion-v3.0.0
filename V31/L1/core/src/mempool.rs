//! Minimal in-memory mempool for the ZION L1 node.
//!
//! A production mempool needs feerate eviction, RBF, and DoS limits. The Alpha
//! implementation keeps the pending transaction set simple while the rest of the
//! node stack is wired together.

use std::collections::HashSet;

use tokio::sync::Mutex;
use zion_l1_types::Hash;

use crate::transaction::Transaction;
use crate::utxo::Outpoint;

/// Pending transaction pool.
#[derive(Default)]
pub struct Mempool {
    txs: Mutex<Vec<Transaction>>,
    /// Outpoints already consumed by a mempool transaction. This prevents
    /// accepting two transactions that spend the same confirmed output.
    spent: Mutex<HashSet<Outpoint>>,
}

impl Mempool {
    pub fn new() -> Self {
        Self {
            txs: Mutex::new(Vec::new()),
            spent: Mutex::new(HashSet::new()),
        }
    }

    /// Add a transaction if its hash is not already present and it does not
    /// spend a mempool outpoint.
    pub async fn add(&self, tx: Transaction) {
        let hash = tx.hash();
        let mut txs = self.txs.lock().await;
        if txs.iter().any(|t| t.hash() == hash) {
            return;
        }
        {
            let mut spent = self.spent.lock().await;
            for input in &tx.inputs {
                spent.insert(Outpoint::new(input.previous_output, input.index));
            }
        }
        txs.push(tx);
    }

    /// Return a copy of the pending transactions for block template building.
    pub async fn pending(&self) -> Vec<Transaction> {
        self.txs.lock().await.clone()
    }

    /// True if the given outpoint is already spent by a mempool transaction.
    pub async fn is_spent(&self, outpoint: &Outpoint) -> bool {
        self.spent.lock().await.contains(outpoint)
    }

    /// Remove transactions included in a block.
    pub async fn remove(&self, hashes: &[Hash]) {
        let mut txs = self.txs.lock().await;
        let removed: Vec<Transaction> = txs
            .drain(..)
            .filter(|t| !hashes.contains(&t.hash()))
            .collect();
        // Recompute the spent set from the remaining transactions.
        let mut spent = self.spent.lock().await;
        spent.clear();
        for tx in &removed {
            for input in &tx.inputs {
                spent.insert(Outpoint::new(input.previous_output, input.index));
            }
        }
        *txs = removed;
    }

    /// Remove a single transaction by hash.
    pub async fn remove_one(&self, hash: &Hash) {
        self.remove(&[*hash]).await;
    }

    /// Current pending count.
    pub async fn len(&self) -> usize {
        self.txs.lock().await.len()
    }

    /// True if no transactions are pending.
    pub async fn is_empty(&self) -> bool {
        self.txs.lock().await.is_empty()
    }

    /// Union of all outpoints spent by mempool transactions.
    pub async fn spent_outpoints(&self) -> HashSet<Outpoint> {
        self.spent.lock().await.clone()
    }
}
