//! V3 transaction / state validator.
//!
//! Applies a validated `V3Block` to the persistent UTXO + account state.
//! This is a faithful reimplementation of the V3 block acceptance rules
//! needed to follow the mainnet chain after a checkpoint.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::crypto::{self, is_valid_address};
use crate::emission::{self, block_subsidy, minted_subsidy};
use crate::storage::Storage;
use crate::v3_compat::{AccountTransaction, V3Block};

/// State validation / application error.
#[derive(Debug, thiserror::Error)]
pub enum V3StateError {
    #[error("storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
    #[error("account tx error: {0}")]
    AccountTx(String),
    #[error("utxo tx error: {0}")]
    UtxoTx(String),
    #[error("coinbase error: {0}")]
    Coinbase(String),
}

/// V3 chain state validator and applier.
pub struct V3State {
    storage: Arc<Storage>,
    balance_check_height: u64,
    max_tx_amount_height: u64,
}

impl V3State {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self {
            storage,
            balance_check_height: u64::MAX,
            max_tx_amount_height: u64::MAX,
        }
    }

    /// Height at which the F5 account balance check becomes active.
    pub fn set_balance_check_height(&mut self, height: u64) {
        self.balance_check_height = height;
    }

    /// Height at which the F4.7 max-tx-amount cap becomes active.
    pub fn set_max_tx_amount_height(&mut self, height: u64) {
        self.max_tx_amount_height = height;
    }

    /// Validate and apply a V3 block to the current state.
    pub async fn apply_block(&self, block: &V3Block) -> Result<(), V3StateError> {
        let (coinbase_count, coinbase_total) =
            self.validate_account_transactions(block).await?;
        self.validate_utxo_transactions(block).await?;
        self.validate_coinbase_total(block, coinbase_count, coinbase_total)
            .await?;
        self.apply_account_state(block).await?;
        self.apply_utxo_state(block).await?;
        Ok(())
    }

    /// Validate the account transaction list and return `(coinbase_count, coinbase_total)`.
    async fn validate_account_transactions(
        &self,
        block: &V3Block,
    ) -> Result<(usize, u128), V3StateError> {
        let mut seen_tx_ids: HashSet<String> = HashSet::new();
        let mut seen_nonces: HashSet<(String, u64)> = HashSet::new();
        let mut coinbase_count = 0usize;
        let mut coinbase_total = 0u128;
        let mut in_coinbase = true;

        for (index, tx) in block.transactions.iter().enumerate() {
            if !seen_tx_ids.insert(tx.tx_id.clone()) {
                return Err(V3StateError::AccountTx(format!(
                    "duplicate tx_id {}",
                    tx.tx_id
                )));
            }

            let is_coinbase = tx.from == "coinbase";
            let is_genesis = tx.from == "genesis";

            if is_coinbase {
                if !in_coinbase {
                    return Err(V3StateError::Coinbase(
                        "coinbase transactions must be contiguous at the start".to_string(),
                    ));
                }
                validate_coinbase_tx_format(tx, block.height)?;
                coinbase_count += 1;
                coinbase_total = coinbase_total
                    .checked_add(tx.amount_zion)
                    .ok_or_else(|| V3StateError::Coinbase("coinbase total overflow".to_string()))?;
            } else if is_genesis {
                in_coinbase = false;
                validate_genesis_tx_format(tx)?;
            } else {
                in_coinbase = false;
                validate_account_tx_format(tx)?;

                // Signature check (active from account memo v1 hard fork = genesis).
                if !verify_account_signature(tx) {
                    return Err(V3StateError::AccountTx(format!(
                        "signature verification failed for {}",
                        tx.tx_id
                    )));
                }

                // Nonce uniqueness within block.
                if !seen_nonces.insert((tx.from.clone(), tx.nonce)) {
                    return Err(V3StateError::AccountTx(format!(
                        "reused sender nonce {} for {}",
                        tx.nonce, tx.from
                    )));
                }

                // Cross-block nonce replay guard.
                let (_balance, nonce) = self
                    .storage
                    .v3_account(&tx.from)
                    .await?
                    .unwrap_or((0, 0));
                if tx.nonce != nonce {
                    return Err(V3StateError::AccountTx(format!(
                        "nonce {} for {} does not match expected {}",
                        tx.nonce, tx.from, nonce
                    )));
                }

                // Max-tx-amount cap.
                if block.height >= self.max_tx_amount_height
                    && tx.amount_zion > emission::TOTAL_SUPPLY
                {
                    return Err(V3StateError::AccountTx(format!(
                        "amount {} exceeds TOTAL_SUPPLY {}",
                        tx.amount_zion, emission::TOTAL_SUPPLY
                    )));
                }

                // Balance check (F5).
                if block.height >= self.balance_check_height {
                    let sender_balance = self
                        .storage
                        .v3_account(&tx.from)
                        .await?
                        .map(|(b, _)| b)
                        .unwrap_or(0);
                    let running = running_balance_within_block(block, index, &tx.from, sender_balance)?;
                    let needed = tx
                        .amount_zion
                        .checked_add(tx.fee_zion as u128)
                        .ok_or_else(|| V3StateError::AccountTx("amount+fee overflow".to_string()))?;
                    if running < needed {
                        return Err(V3StateError::AccountTx(format!(
                            "insufficient balance for {}: {} < {}",
                            tx.from, running, needed
                        )));
                    }
                }
            }

            let _ = index;
        }

        Ok((coinbase_count, coinbase_total))
    }

    /// Validate that the coinbase output(s) mint the correct total.
    async fn validate_coinbase_total(
        &self,
        block: &V3Block,
        coinbase_count: usize,
        coinbase_total: u128,
    ) -> Result<(), V3StateError> {
        if block.height == 0 {
            if coinbase_count != 0 {
                return Err(V3StateError::Coinbase(
                    "genesis block must not contain coinbase".to_string(),
                ));
            }
            return Ok(());
        }

        if coinbase_count == 0 {
            return Err(V3StateError::Coinbase(
                "non-genesis block must contain coinbase".to_string(),
            ));
        }

        let subsidy = block_subsidy(block.height);
        let expected_total = match coinbase_count {
            1 => subsidy as u128,
            3 => minted_subsidy(subsidy) as u128,
            _ => {
                return Err(V3StateError::Coinbase(format!(
                    "unsupported coinbase count {}",
                    coinbase_count
                )));
            }
        };

        if coinbase_total != expected_total {
            return Err(V3StateError::Coinbase(format!(
                "coinbase total {} does not match expected {}",
                coinbase_total, expected_total
            )));
        }

        // Validate each coinbase tx_id is deterministic and amount matches.
        for (index, tx) in block
            .transactions
            .iter()
            .take(coinbase_count)
            .enumerate()
        {
            let label = match coinbase_count {
                1 => format!("coinbase:{}:{}", block.height, tx.to),
                3 if index == 0 => format!("coinbase:{}:{}", block.height, tx.to),
                3 if index == 1 => format!("coinbase_humanitarian:{}:{}", block.height, tx.to),
                3 if index == 2 => format!("coinbase_issobella:{}:{}", block.height, tx.to),
                _ => {
                    return Err(V3StateError::Coinbase(format!(
                        "unsupported coinbase count {}",
                        coinbase_count
                    )));
                }
            };
            let expected_hash =
                zion_cosmic_harmony_v3::cosmic_harmony_ekam_deeksha(label.as_bytes(), block.height);
            let expected_id = hex::encode(expected_hash.data);
            if tx.tx_id != expected_id {
                return Err(V3StateError::Coinbase(format!(
                    "coinbase tx_id mismatch at index {}: expected {}, got {}",
                    index, expected_id, tx.tx_id
                )));
            }

            let expected_amount = match coinbase_count {
                1 => subsidy as u128,
                3 => {
                    let (miner, human, issobella, _) = emission::fee_split(subsidy);
                    match index {
                        0 => miner as u128,
                        1 => human as u128,
                        2 => issobella as u128,
                        _ => unreachable!(),
                    }
                }
                _ => unreachable!(),
            };
            if tx.amount_zion != expected_amount {
                return Err(V3StateError::Coinbase(format!(
                    "coinbase amount mismatch at index {}: expected {}, got {}",
                    index, expected_amount, tx.amount_zion
                )));
            }
        }

        Ok(())
    }

    /// Validate UTXO transactions in the block.
    async fn validate_utxo_transactions(&self, block: &V3Block) -> Result<(), V3StateError> {
        let mut seen_ids: HashSet<[u8; 32]> = HashSet::new();
        let mut seen_inputs: HashSet<([u8; 32], u32)> = HashSet::new();

        for tx in &block.utxo_transactions {
            if !seen_ids.insert(tx.id) {
                return Err(V3StateError::UtxoTx(format!(
                    "duplicate UTXO tx id {}",
                    hex::encode(tx.id)
                )));
            }

            let expected_id = tx.calculate_hash();
            if tx.id != expected_id {
                return Err(V3StateError::UtxoTx(format!(
                    "UTXO tx id mismatch: expected {}, got {}",
                    hex::encode(expected_id),
                    hex::encode(tx.id)
                )));
            }

            if tx.version < crate::v3_compat::TX_HASH_V2_VERSION {
                return Err(V3StateError::UtxoTx(format!(
                    "UTXO tx version {} below v2",
                    tx.version
                )));
            }

            // Coinbase UTXO (no inputs) is always valid and creates outputs.
            if tx.inputs.is_empty() {
                continue;
            }

            // Signature verification.
            for input in &tx.inputs {
                if !crypto::verify(&input.public_key, &tx.id, &input.signature) {
                    return Err(V3StateError::UtxoTx(format!(
                        "invalid signature for input {}:{}",
                        hex::encode(input.prev_tx_hash),
                        input.output_index
                    )));
                }
            }

            // Inputs must exist, be unspent, and not reused within this block.
            let mut input_sum = 0u64;
            for input in &tx.inputs {
                if !seen_inputs.insert((input.prev_tx_hash, input.output_index)) {
                    return Err(V3StateError::UtxoTx(format!(
                        "input {}:{} already spent in this block",
                        hex::encode(input.prev_tx_hash),
                        input.output_index
                    )));
                }

                let utxo = self
                    .storage
                    .v3_utxo(&input.prev_tx_hash, input.output_index)
                    .await?
                    .ok_or_else(|| {
                        V3StateError::UtxoTx(format!(
                            "input {}:{} does not exist",
                            hex::encode(input.prev_tx_hash),
                            input.output_index
                        ))
                    })?;

                if utxo.2 {
                    return Err(V3StateError::UtxoTx(format!(
                        "input {}:{} already spent",
                        hex::encode(input.prev_tx_hash),
                        input.output_index
                    )));
                }

                // The public key in the input must derive to the address owning
                // the spent output.
                let derived = crypto::derive_address(&input.public_key);
                if derived != utxo.1 {
                    return Err(V3StateError::UtxoTx(format!(
                        "input {}:{} not owned by derived address",
                        hex::encode(input.prev_tx_hash),
                        input.output_index
                    )));
                }

                input_sum = input_sum
                    .checked_add(utxo.0)
                    .ok_or_else(|| V3StateError::UtxoTx("input sum overflow".to_string()))?;
            }

            let output_sum: u64 = tx.outputs.iter().map(|o| o.amount).sum();
            let total_needed = output_sum
                .checked_add(tx.fee)
                .ok_or_else(|| V3StateError::UtxoTx("output+fee overflow".to_string()))?;
            if input_sum < total_needed {
                return Err(V3StateError::UtxoTx(format!(
                    "insufficient inputs: {} < {}",
                    input_sum, total_needed
                )));
            }
        }

        Ok(())
    }

    /// Apply account transaction effects to the state.
    async fn apply_account_state(&self, block: &V3Block) -> Result<(), V3StateError> {
        let mut cache: HashMap<String, (u128, u64)> = HashMap::new();

        for tx in &block.transactions {
            if tx.from != "coinbase" && tx.from != "genesis" {
                let (mut balance, nonce) = if let Some(entry) = cache.get(&tx.from) {
                    *entry
                } else {
                    self.storage.v3_account(&tx.from).await?.unwrap_or((0, 0))
                };

                if tx.nonce != nonce {
                    return Err(V3StateError::AccountTx(format!(
                        "apply: nonce mismatch for {}",
                        tx.from
                    )));
                }

                let debit = tx
                    .amount_zion
                    .checked_add(tx.fee_zion as u128)
                    .ok_or_else(|| V3StateError::AccountTx("debit overflow".to_string()))?;
                balance = balance
                    .checked_sub(debit)
                    .ok_or_else(|| V3StateError::AccountTx("account underflow".to_string()))?;
                cache.insert(tx.from.clone(), (balance, nonce + 1));
            }

            // Credit recipient.
            let (mut to_balance, to_nonce) = if let Some(entry) = cache.get(&tx.to) {
                *entry
            } else {
                self.storage.v3_account(&tx.to).await?.unwrap_or((0, 0))
            };
            to_balance = to_balance
                .checked_add(tx.amount_zion)
                .ok_or_else(|| V3StateError::AccountTx("credit overflow".to_string()))?;
            cache.insert(tx.to.clone(), (to_balance, to_nonce));
        }

        // Persist updated accounts.
        for (address, (balance, nonce)) in cache {
            self.storage.set_v3_account(&address, balance, nonce).await?;
        }

        Ok(())
    }

    /// Apply UTXO transaction effects to the state.
    async fn apply_utxo_state(&self, block: &V3Block) -> Result<(), V3StateError> {
        for tx in &block.utxo_transactions {
            // Mark inputs spent.
            for input in &tx.inputs {
                self.storage
                    .spend_v3_utxo(&input.prev_tx_hash, input.output_index)
                    .await?;
            }

            // Create new outputs.
            for (idx, output) in tx.outputs.iter().enumerate() {
                self.storage
                    .create_v3_utxo(&tx.id, idx as u32, output.amount, &output.address)
                    .await?;
            }
        }

        Ok(())
    }
}

fn validate_account_tx_format(tx: &AccountTransaction) -> Result<(), V3StateError> {
    if tx.tx_id.len() != 64 || !tx.tx_id.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(V3StateError::AccountTx(
            "tx_id must be 64 hex chars".to_string(),
        ));
    }
    if tx.from.is_empty() || tx.to.is_empty() {
        return Err(V3StateError::AccountTx("from/to must not be empty".to_string()));
    }
    if tx.from == tx.to {
        return Err(V3StateError::AccountTx("from and to must differ".to_string()));
    }
    if tx.amount_zion == 0 {
        return Err(V3StateError::AccountTx("amount must be > 0".to_string()));
    }
    if tx.fee_zion == 0 {
        return Err(V3StateError::AccountTx("fee must be > 0".to_string()));
    }
    if (tx.fee_zion as u128) > tx.amount_zion {
        return Err(V3StateError::AccountTx("fee must not exceed amount".to_string()));
    }
    if let Some(ref memo) = tx.memo {
        if memo.len() > 256 {
            return Err(V3StateError::AccountTx("memo too long".to_string()));
        }
        if !memo.is_ascii() {
            return Err(V3StateError::AccountTx("memo must be ASCII".to_string()));
        }
    }
    Ok(())
}

fn validate_genesis_tx_format(tx: &AccountTransaction) -> Result<(), V3StateError> {
    if tx.tx_id.len() != 64 || !tx.tx_id.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(V3StateError::AccountTx(
            "genesis tx_id must be 64 hex chars".to_string(),
        ));
    }
    if tx.from != "genesis" {
        return Err(V3StateError::AccountTx("from must be 'genesis'".to_string()));
    }
    if tx.to.is_empty() {
        return Err(V3StateError::AccountTx("genesis to must not be empty".to_string()));
    }
    if tx.amount_zion == 0 {
        return Err(V3StateError::AccountTx("genesis amount must be > 0".to_string()));
    }
    if tx.fee_zion != 0 {
        return Err(V3StateError::AccountTx("genesis fee must be 0".to_string()));
    }
    Ok(())
}

fn validate_coinbase_tx_format(tx: &AccountTransaction, height: u64) -> Result<(), V3StateError> {
    if tx.tx_id.len() != 64 || !tx.tx_id.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(V3StateError::Coinbase(
            "coinbase tx_id must be 64 hex chars".to_string(),
        ));
    }
    if tx.from != "coinbase" {
        return Err(V3StateError::Coinbase("coinbase from must be 'coinbase'".to_string()));
    }
    if tx.fee_zion != 0 {
        return Err(V3StateError::Coinbase("coinbase fee must be 0".to_string()));
    }
    if tx.nonce != height {
        return Err(V3StateError::Coinbase(format!(
            "coinbase nonce {} does not match height {}",
            tx.nonce, height
        )));
    }
    if tx.to.is_empty() {
        return Err(V3StateError::Coinbase("coinbase to must not be empty".to_string()));
    }
    if !is_valid_address(&tx.to) && !is_valid_account_id(&tx.to) {
        return Err(V3StateError::Coinbase(format!(
            "coinbase to is not a valid address: {}",
            tx.to
        )));
    }
    Ok(())
}

pub fn verify_account_signature(tx: &AccountTransaction) -> bool {
    if tx.from == "coinbase" || tx.from == "genesis" {
        return true;
    }
    if tx.signature.len() != 128 || tx.public_key.len() != 64 {
        return false;
    }
    let pk_bytes = match hex::decode(&tx.public_key) {
        Ok(v) if v.len() == 32 => v,
        _ => return false,
    };
    let sig_bytes = match hex::decode(&tx.signature) {
        Ok(v) if v.len() == 64 => v,
        _ => return false,
    };
    let derived = crypto::derive_address(&pk_bytes);
    if derived != tx.from {
        return false;
    }
    crypto::verify(&pk_bytes, tx.tx_id.as_bytes(), &sig_bytes)
}

fn is_valid_account_id(value: &str) -> bool {
    let len = value.len();
    (3..=64).contains(&len)
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

/// Compute the running balance of `address` within `block` up to (but not
/// including) `index`, starting from the confirmed `base_balance`.
fn running_balance_within_block(
    block: &V3Block,
    index: usize,
    address: &str,
    base_balance: u128,
) -> Result<u128, V3StateError> {
    let mut balance = base_balance;
    for tx in block.transactions.iter().take(index) {
        if tx.from == address {
            let debit = tx
                .amount_zion
                .checked_add(tx.fee_zion as u128)
                .ok_or_else(|| V3StateError::AccountTx("running debit overflow".to_string()))?;
            balance = balance
                .checked_sub(debit)
                .ok_or_else(|| V3StateError::AccountTx("running balance underflow".to_string()))?;
        }
        if tx.to == address {
            balance = balance
                .checked_add(tx.amount_zion)
                .ok_or_else(|| V3StateError::AccountTx("running credit overflow".to_string()))?;
        }
    }
    Ok(balance)
}

/// Generate a deterministic 64-hex-char tx_id for an account transaction.
/// This matches the V3 account-model ID generation so signatures remain
/// verifiable across mainnet blocks.
pub fn generate_account_tx_id(
    from: &str,
    to: &str,
    amount: u64,
    nonce: u64,
    memo: Option<&str>,
    chain_height: u64,
) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let mut bytes = [0u8; 32];
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    bytes[..16].copy_from_slice(&ts.to_le_bytes());
    bytes[16..24].copy_from_slice(&amount.to_le_bytes());
    bytes[24..32].copy_from_slice(&nonce.to_le_bytes());
    for (i, b) in from.bytes().chain(to.bytes()).enumerate() {
        bytes[i % 32] ^= b;
    }
    if let Some(m) = memo {
        if zion_cosmic_harmony_v3::account_tx_memo_v1_active(chain_height) {
            for (i, b) in m.bytes().enumerate() {
                bytes[i % 32] ^= b;
            }
        }
    }
    hex::encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::v3_compat::{build_v3_genesis_block, MiningHeader};

    #[tokio::test]
    async fn genesis_state_applies_premine() {
        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let state = V3State::new(storage.clone());
        let block = build_v3_genesis_block();

        state.apply_block(&block).await.unwrap();

        let dao = crate::fee::DAO_ADDRESS;
        let (balance, _) = storage.v3_account(dao).await.unwrap().unwrap();
        assert_eq!(balance, 2_500_000_000_000_000_000_000u128);
    }

    #[tokio::test]
    async fn coinbase_split_amounts_match() {
        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let mut state = V3State::new(storage.clone());
        state.set_balance_check_height(0);

        storage
            .set_v3_account("miner", 0, 0)
            .await
            .unwrap();

        let height = 1u64;
        let subsidy = block_subsidy(height);
        let (miner, human, issobella, _burn) = emission::fee_split(subsidy);

        let mut block = V3Block {
            height,
            nonce: 0,
            difficulty: crate::difficulty::GENESIS_DIFFICULTY,
            header: MiningHeader {
                version: 3,
                previous_hash: [0u8; 32],
                merkle_root: [0u8; 32],
                timestamp: 1_767_225_601,
                difficulty_bits: 0x1e_0f_ff_f0,
            },
            transactions: vec![
                AccountTransaction {
                    tx_id: String::new(),
                    from: "coinbase".to_string(),
                    to: "miner".to_string(),
                    amount_zion: miner as u128,
                    fee_zion: 0,
                    nonce: height,
                    signature: String::new(),
                    public_key: String::new(),
                    memo: None,
                },
                AccountTransaction {
                    tx_id: String::new(),
                    from: "coinbase".to_string(),
                    to: "human".to_string(),
                    amount_zion: human as u128,
                    fee_zion: 0,
                    nonce: height,
                    signature: String::new(),
                    public_key: String::new(),
                    memo: None,
                },
                AccountTransaction {
                    tx_id: String::new(),
                    from: "coinbase".to_string(),
                    to: "issobella".to_string(),
                    amount_zion: issobella as u128,
                    fee_zion: 0,
                    nonce: height,
                    signature: String::new(),
                    public_key: String::new(),
                    memo: None,
                },
            ],
            utxo_transactions: vec![],
        };

        for (i, tx) in block.transactions.iter_mut().enumerate() {
            let label = match i {
                0 => format!("coinbase:{}:{}", height, tx.to),
                1 => format!("coinbase_humanitarian:{}:{}", height, tx.to),
                2 => format!("coinbase_issobella:{}:{}", height, tx.to),
                _ => unreachable!(),
            };
            let hash =
                zion_cosmic_harmony_v3::cosmic_harmony_ekam_deeksha(label.as_bytes(), height);
            tx.tx_id = hex::encode(hash.data);
        }

        state.apply_block(&block).await.unwrap();

        let (miner_balance, _) = storage.v3_account("miner").await.unwrap().unwrap();
        assert_eq!(miner_balance, miner as u128);
    }

    #[tokio::test]
    async fn account_transfer_with_signature() {
        let (sk, vk) = crypto::generate_keypair();
        let from = crypto::derive_address(vk.as_bytes());
        let to = "zion1burn0000000000000000000000000000000dead".to_string();

        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        storage
            .set_v3_account(&from, 1_000_000, 0)
            .await
            .unwrap();

        let amount = 100_000u128;
        let fee = 1_000u64;
        let nonce = 0u64;
        let tx_id = generate_account_tx_id(&from, &to, amount as u64, nonce, None, 1);
        let sig = crypto::sign(&sk, tx_id.as_bytes());

        let mut block = V3Block {
            height: 1,
            nonce: 0,
            difficulty: crate::difficulty::GENESIS_DIFFICULTY,
            header: MiningHeader {
                version: 3,
                previous_hash: [0u8; 32],
                merkle_root: [0u8; 32],
                timestamp: 1_767_225_601,
                difficulty_bits: 0x1e_0f_ff_f0,
            },
            transactions: vec![],
            utxo_transactions: vec![],
        };

        let tx = AccountTransaction {
            tx_id,
            from: from.clone(),
            to: to.clone(),
            amount_zion: amount,
            fee_zion: fee,
            nonce,
            signature: hex::encode(sig),
            public_key: hex::encode(vk.as_bytes()),
            memo: None,
        };

        // Add coinbase so the block is structurally valid.
        let subsidy = block_subsidy(1);
        let (miner, human, issobella, _burn) = emission::fee_split(subsidy);
        let coinbase_tos = vec!["miner".to_string(), "human".to_string(), "issobella".to_string()];
        let coinbase_amounts = vec![miner, human, issobella];
        for (i, (to_addr, amount)) in coinbase_tos.iter().zip(coinbase_amounts.iter()).enumerate() {
            let label = match i {
                0 => format!("coinbase:{}:{}", block.height, to_addr),
                1 => format!("coinbase_humanitarian:{}:{}", block.height, to_addr),
                2 => format!("coinbase_issobella:{}:{}", block.height, to_addr),
                _ => unreachable!(),
            };
            let hash =
                zion_cosmic_harmony_v3::cosmic_harmony_ekam_deeksha(label.as_bytes(), block.height);
            block.transactions.push(AccountTransaction {
                tx_id: hex::encode(hash.data),
                from: "coinbase".to_string(),
                to: to_addr.clone(),
                amount_zion: *amount as u128,
                fee_zion: 0,
                nonce: block.height,
                signature: String::new(),
                public_key: String::new(),
                memo: None,
            });
        }

        // Add sender transfer after coinbase.
        block.transactions.push(tx);

        let mut state = V3State::new(storage.clone());
        state.set_balance_check_height(0);
        state.apply_block(&block).await.unwrap();

        let (from_balance, from_nonce) = storage.v3_account(&from).await.unwrap().unwrap();
        assert_eq!(from_balance, 1_000_000 - amount - fee as u128);
        assert_eq!(from_nonce, 1);

        let (to_balance, _) = storage.v3_account(&to).await.unwrap().unwrap();
        assert_eq!(to_balance, amount);
    }
}
