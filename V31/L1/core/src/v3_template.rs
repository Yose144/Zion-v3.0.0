//! V3 block template builder and miner.
//!
//! Builds the next `V3Block` from the current tip, optional mempool, and
//! configured miner/fee addresses, then scans nonces until the PoW target is met.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::is_valid_address;
use crate::emission::{block_subsidy, fee_split};
use crate::storage::Storage;
use crate::v3_compat::{
    derive_template_merkle_root_v2_blake3, AccountTransaction, MiningHeader, UtxoTransaction, V3Block,
};

/// Template builder error.
#[derive(Debug, thiserror::Error)]
pub enum V3TemplateError {
    #[error("storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
    #[error("invalid address: {0}")]
    InvalidAddress(String),
    #[error("invalid configuration: {0}")]
    Config(String),
}

/// Builder for the next V3 block template.
pub struct V3TemplateBuilder {
    storage: Arc<Storage>,
    miner_address: String,
    humanitarian_address: String,
    issobella_address: String,
    mempool_account: Vec<AccountTransaction>,
    mempool_utxo: Vec<UtxoTransaction>,
}

impl V3TemplateBuilder {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self {
            storage,
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            mempool_account: Vec::new(),
            mempool_utxo: Vec::new(),
        }
    }

    /// Set the miner payout address. Required to produce a coinbase.
    pub fn set_miner_address(&mut self, addr: String) -> Result<(), V3TemplateError> {
        if !addr.is_empty() && !is_valid_address(&addr) && !is_valid_account_id(&addr) {
            return Err(V3TemplateError::InvalidAddress(addr));
        }
        self.miner_address = addr;
        Ok(())
    }

    /// Set fee-split destination addresses. When both are non-empty, the
    /// coinbase is split 89/5/5 (1% pool fee is burned).
    pub fn set_fee_addresses(
        &mut self,
        humanitarian: String,
        issobella: String,
    ) -> Result<(), V3TemplateError> {
        if !humanitarian.is_empty() && !is_valid_address(&humanitarian) && !is_valid_account_id(&humanitarian) {
            return Err(V3TemplateError::InvalidAddress(humanitarian));
        }
        if !issobella.is_empty() && !is_valid_address(&issobella) && !is_valid_account_id(&issobella) {
            return Err(V3TemplateError::InvalidAddress(issobella));
        }
        self.humanitarian_address = humanitarian;
        self.issobella_address = issobella;
        Ok(())
    }

    /// Add account-model mempool transactions.
    pub fn set_account_mempool(&mut self, txs: Vec<AccountTransaction>) {
        self.mempool_account = txs;
    }

    /// Add UTXO mempool transactions.
    pub fn set_utxo_mempool(&mut self, txs: Vec<UtxoTransaction>) {
        self.mempool_utxo = txs;
    }

    /// Build the block template for height `previous.height + 1`.
    ///
    /// `difficulty` is the target difficulty for the new block (use the LWMA
    /// difficulty from `crate::difficulty::lwma_next_difficulty`).
    pub async fn build(
        &self,
        previous: &V3Block,
        difficulty: u64,
    ) -> Result<V3Block, V3TemplateError> {
        let next_height = previous.height.saturating_add(1);
        let previous_hash = previous.header_hash();

        let mut transactions: Vec<AccountTransaction> = Vec::new();
        let mut total_fees: u64 = 0;

        // Coinbase.
        if !self.miner_address.is_empty() {
            let subsidy = block_subsidy(next_height);
            let has_split = !self.humanitarian_address.is_empty() && !self.issobella_address.is_empty();

            if has_split {
                let (miner_amt, human_amt, issobella_amt, _) = fee_split(subsidy);
                // V3 insert order: issobella, humanitarian, miner (then reverse in block?)
                // The resulting `transactions` vector is 0=miner, 1=humanitarian, 2=issobella
                // because we push in reverse after building.
                let issobella_tx = mk_coinbase(
                    "coinbase_issobella",
                    next_height,
                    &self.issobella_address,
                    issobella_amt,
                );
                let human_tx = mk_coinbase(
                    "coinbase_humanitarian",
                    next_height,
                    &self.humanitarian_address,
                    human_amt,
                );
                let miner_tx = mk_coinbase("coinbase", next_height, &self.miner_address, miner_amt);

                transactions.push(miner_tx);
                transactions.push(human_tx);
                transactions.push(issobella_tx);
            } else {
                let tx = mk_coinbase("coinbase", next_height, &self.miner_address, subsidy);
                transactions.push(tx);
            }
        }

        // Mempool.
        for tx in &self.mempool_account {
            total_fees = total_fees.saturating_add(tx.fee_zion);
            transactions.push(tx.clone());
        }

        for tx in &self.mempool_utxo {
            total_fees = total_fees.saturating_add(tx.fee);
        }

        // Note: V3 coinbase does not include user fees in the minted amount.
        // The fees are implicitly burned unless the coinbase split is used.
        // Total coinbase minted = minted_subsidy(subsidy) when split, else subsidy.
        let _ = total_fees;

        let merkle_root = derive_template_merkle_root_v2_blake3(&transactions, &self.mempool_utxo);
        let target = crate::v3_compat::difficulty_to_target(difficulty);
        let bits = crate::v3_compat::target_to_compact(&target);

        let header = MiningHeader {
            version: 3,
            previous_hash,
            merkle_root,
            timestamp: now_secs(),
            difficulty_bits: bits,
        };

        Ok(V3Block {
            height: next_height,
            nonce: 0,
            difficulty,
            header,
            transactions,
            utxo_transactions: self.mempool_utxo.clone(),
        })
    }

    /// Build the template using the LWMA difficulty computed from the storage
    /// window ending at the current tip.
    pub async fn build_with_lwma(&self, previous: &V3Block) -> Result<V3Block, V3TemplateError> {
        let window = self
            .storage
            .v3_difficulty_window(crate::difficulty::LWMA_WINDOW + 1)
            .await?;
        let difficulty = crate::difficulty::lwma_next_difficulty(&window);
        self.build(previous, difficulty).await
    }
}

fn mk_coinbase(prefix: &str, height: u64, to: &str, amount: u64) -> AccountTransaction {
    let label = format!("{}:{}:{}", prefix, height, to);
    let hash = zion_cosmic_harmony_v3::cosmic_harmony_ekam_deeksha(label.as_bytes(), height);
    AccountTransaction {
        tx_id: crate::v3_compat::hex(&hash.data),
        from: "coinbase".to_string(),
        to: to.to_string(),
        amount_zion: u128::from(amount),
        fee_zion: 0,
        nonce: height,
        signature: String::new(),
        public_key: String::new(),
        memo: None,
    }
}

fn is_valid_account_id(value: &str) -> bool {
    let len = value.len();
    (3..=64).contains(&len)
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Mine a V3 block by scanning nonces.
pub struct V3Miner;

impl V3Miner {
    /// Scan nonces from `start` to `start + count` and return the first nonce
    /// that makes `block.header_hash()` meet the target encoded in
    /// `block.header.difficulty_bits`.
    pub fn mine(block: &mut V3Block, start: u64, count: u64) -> Option<u64> {
        let target = crate::v3_compat::compact_to_target(block.header.difficulty_bits);
        Self::mine_with_target(block, &target.bytes, start, count)
    }

    /// Mine against an explicit 32-byte target.
    pub fn mine_with_target(
        block: &mut V3Block,
        target: &[u8; 32],
        start: u64,
        count: u64,
    ) -> Option<u64> {
        for offset in 0..count {
            let nonce = start.saturating_add(offset);
            block.nonce = nonce;
            let hash = block.header_hash();
            if &hash <= target {
                return Some(nonce);
            }
        }
        None
    }

    /// Convenience: mine against the all-ff target (test-only).
    pub fn mine_test(block: &mut V3Block, start: u64, count: u64) -> Option<u64> {
        Self::mine_with_target(block, &[0xff; 32], start, count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::emission::minted_subsidy;
    use crate::v3_compat::build_v3_genesis_block;

    #[tokio::test]
    async fn build_split_template() {
        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let mut builder = V3TemplateBuilder::new(storage);
        builder
            .set_miner_address("miner".to_string())
            .unwrap();
        builder
            .set_fee_addresses("human".to_string(), "issobella".to_string())
            .unwrap();

        let genesis = build_v3_genesis_block();
        let template = builder.build(&genesis, 1).await.unwrap();

        assert_eq!(template.height, 1);
        assert_eq!(template.transactions.len(), 3);
        assert_eq!(template.transactions[0].from, "coinbase");
        assert_eq!(template.transactions[0].to, "miner");
        assert_eq!(template.transactions[1].to, "human");
        assert_eq!(template.transactions[2].to, "issobella");
        assert_eq!(
            template.transactions[0].amount_zion,
            fee_split(block_subsidy(1)).0 as u128
        );
        assert_eq!(
            template.transactions.iter().map(|t| t.amount_zion).sum::<u128>(),
            minted_subsidy(block_subsidy(1)) as u128
        );
    }

    #[test]
    fn mine_with_max_target() {
        let mut block = build_v3_genesis_block();
        block.header.difficulty_bits = 0;
        // Use the test helper with the all-ff target.
        let nonce = V3Miner::mine_test(&mut block, 0, 1).expect("should find nonce at max target");
        assert_eq!(nonce, 0);
    }
}
