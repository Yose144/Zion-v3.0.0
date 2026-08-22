//! V3 JSON-RPC compatibility layer.
//!
//! Implements the RPC surface expected by V3 nodes: `getStatus`,
//! `getBlockByHeight`, `getBlockByHash`, `getTemplate`, `submitBlock`,
//! `submitAccountTransaction`, `submitUtxoTransaction`, `getBalance`,
//! `getUtxos`.  The handler is stateless and operates on `Storage` + an
//! in-memory mempool, so it can be attached to the existing TCP RPC server.

use std::collections::HashSet;
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::sync::Mutex;

use crate::crypto;
use crate::storage::Storage;
use crate::v3_compat::{hex, AccountTransaction, UtxoTransaction, V3AcceptedBlock, V3Block};
use crate::v3_state::V3State;
use crate::v3_template::V3TemplateBuilder;

/// JSON-RPC error object.
#[derive(Debug, thiserror::Error)]
pub enum V3RpcError {
    #[error("storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
    #[error("template error: {0}")]
    Template(#[from] crate::v3_template::V3TemplateError),
    #[error("state error: {0}")]
    State(#[from] crate::v3_state::V3StateError),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("validation error: {0}")]
    Validation(String),
}

/// Extract a transaction payload from RPC params.
///
/// Callers may either send the transaction directly in `params` or wrap it
/// in `{ "transaction": <tx> }` (used by the V31 wallet / pool convention).
fn extract_transaction(params: &Value) -> Value {
    params
        .get("transaction")
        .cloned()
        .unwrap_or_else(|| params.clone())
}

/// V3 RPC handler. Keeps an in-memory mempool until it can be mined.
pub struct V3RpcHandler {
    storage: Arc<Storage>,
    mempool_account: Mutex<Vec<AccountTransaction>>,
    mempool_utxo: Mutex<Vec<UtxoTransaction>>,
    miner_address: Mutex<String>,
    humanitarian_address: Mutex<String>,
    issobella_address: Mutex<String>,
    state: V3State,
}

impl V3RpcHandler {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self {
            storage: storage.clone(),
            mempool_account: Mutex::new(Vec::new()),
            mempool_utxo: Mutex::new(Vec::new()),
            miner_address: Mutex::new(String::new()),
            humanitarian_address: Mutex::new(String::new()),
            issobella_address: Mutex::new(String::new()),
            state: V3State::new(storage),
        }
    }

    /// Set the coinbase payout addresses.
    pub async fn set_addresses(&self, miner: String, humanitarian: String, issobella: String) {
        *self.miner_address.lock().await = miner;
        *self.humanitarian_address.lock().await = humanitarian;
        *self.issobella_address.lock().await = issobella;
    }

    /// Flush the V3 compat UTXO mempool by applying state changes directly
    /// to the `v3_utxos` SQLite table.
    ///
    /// This is called after a V31 native block is accepted, so that V3 compat
    /// mempool transactions (e.g. bridge unlock) have their UTXO state changes
    /// persisted even though they are not included in V31 native blocks.
    /// Returns the number of transactions flushed.
    pub async fn flush_utxo_mempool(&self) -> usize {
        let mut mempool = self.mempool_utxo.lock().await;
        if mempool.is_empty() {
            return 0;
        }
        let txs = std::mem::take(&mut *mempool);
        let count = txs.len();
        for tx in &txs {
            // Mark inputs as spent.
            for input in &tx.inputs {
                let _ = self.storage.spend_v3_utxo(&input.prev_tx_hash, input.output_index).await;
            }
            // Create new outputs.
            for (idx, output) in tx.outputs.iter().enumerate() {
                let _ = self.storage
                    .create_v3_utxo(&tx.id, idx as u32, output.amount, &output.address)
                    .await;
            }
        }
        count
    }

    /// Dispatch a JSON-RPC method and return a JSON value suitable for the
    /// `result` field (errors are encoded as `{ "error": ... }`).
    pub async fn dispatch(&self, method: &str, params: Value) -> Value {
        let result = match method {
            "getStatus" => self.get_status().await,
            "getBlockByHeight" => self.get_block_by_height(&params).await,
            "getBlockByHash" => self.get_block_by_hash(&params).await,
            "getBlock" => self.get_block_by_hash(&params).await,
            "getTemplate" => self.get_template(&params).await,
            "submitBlock" => self.submit_block(&params).await,
            "submitAccountTransaction" => self.submit_account_tx(&params).await,
            "submitUtxoTransaction" => self.submit_utxo_tx(&params).await,
            "sendRawTransaction" => self.submit_account_tx(&params).await,
            "submitTransaction" => self.submit_account_tx(&params).await,
            "getBalance" => self.get_balance(&params).await,
            "getAccountBalance" => self.get_balance(&params).await,
            "getUtxos" => self.get_utxos(&params).await,
            "getTransaction" => self.get_transaction(&params).await,
            "getAccountTransaction" => self.get_transaction(&params).await,
            "getTransactionHistory" => self.get_transaction_history(&params).await,
            "getAddressInfo" => self.get_address_info(&params).await,
            "getBalanceAtHeight" => self.get_balance_at_height(&params).await,
            "getMempoolInfo" => self.get_mempool_info().await,
            "getSupplyInfo" => self.get_supply_info().await,
            "getBlockRange" => self.get_block_range(&params).await,
            "getNetworkStats" => self.get_network_stats().await,
            "getBridgeLocks" => self.get_bridge_locks(&params).await,
            "getBridgeVaultBalance" => self.get_bridge_vault_balance().await,
            "estimateFee" => self.estimate_fee(&params).await,
            "getTokenInfo" => self.get_token_info().await,
            "submitBridgeUnlock" => self.submit_bridge_unlock(&params).await,
            _ => Err(V3RpcError::Validation(format!(
                "unknown method: {}",
                method
            ))),
        };

        match result {
            Ok(v) => json!({ "result": v }),
            Err(e) => json!({ "error": { "message": e.to_string() } }),
        }
    }

    async fn get_status(&self) -> Result<Value, V3RpcError> {
        let tip = self.storage.v3_tip().await?;
        let (height, hash_hex) = match tip {
            Some(b) => (b.height, hex(&b.header_hash())),
            None => (0, hex(&[0u8; 32])),
        };
        let account_count = self.mempool_account.lock().await.len();
        let utxo_count = self.mempool_utxo.lock().await.len();
        Ok(json!({
            "chain_height": height,
            "tip_hash": hash_hex,
            "mempool_account_transactions": account_count,
            "mempool_utxo_transactions": utxo_count,
            "protocol_version": "3.0.5",
        }))
    }

    async fn get_block_by_height(&self, params: &Value) -> Result<Value, V3RpcError> {
        let height = params
            .get("height")
            .and_then(Value::as_u64)
            .ok_or_else(|| V3RpcError::Parse("height required".to_string()))?;
        match self.storage.get_v3_block_by_height(height).await? {
            Some(block) => Ok(serde_json::to_value(block)?),
            None => Ok(Value::Null),
        }
    }

    async fn get_block_by_hash(&self, params: &Value) -> Result<Value, V3RpcError> {
        let hash_hex = params
            .get("hash")
            .and_then(Value::as_str)
            .ok_or_else(|| V3RpcError::Parse("hash required".to_string()))?;
        let hash = decode_hex_32(hash_hex)?;
        match self.storage.get_v3_block_by_hash(&hash).await? {
            Some(block) => Ok(serde_json::to_value(block)?),
            None => Ok(Value::Null),
        }
    }

    async fn get_template(&self, params: &Value) -> Result<Value, V3RpcError> {
        let tip = self.storage.v3_tip().await?;
        let previous = tip.unwrap_or_else(crate::v3_compat::build_v3_genesis_block);

        let mut builder = V3TemplateBuilder::new(self.storage.clone());

        let miner = self.miner_address.lock().await.clone();
        if !miner.is_empty() {
            builder.set_miner_address(miner)?;
        }
        let human = self.humanitarian_address.lock().await.clone();
        let issobella = self.issobella_address.lock().await.clone();
        if !human.is_empty() || !issobella.is_empty() {
            builder.set_fee_addresses(human, issobella)?;
        }

        // Optional overrides from the RPC call.
        if let Some(m) = params.get("miner_address").and_then(Value::as_str) {
            builder.set_miner_address(m.to_string())?;
        }
        if let (Some(h), Some(i)) = (
            params.get("humanitarian_address").and_then(Value::as_str),
            params.get("issobella_address").and_then(Value::as_str),
        ) {
            builder.set_fee_addresses(h.to_string(), i.to_string())?;
        }

        builder.set_account_mempool(self.mempool_account.lock().await.clone());
        builder.set_utxo_mempool(self.mempool_utxo.lock().await.clone());

        let template = builder.build_with_lwma(&previous).await?;
        Ok(serde_json::to_value(template)?)
    }

    async fn submit_block(&self, params: &Value) -> Result<Value, V3RpcError> {
        let block: V3Block = match serde_json::from_value::<V3Block>(params.clone()) {
            Ok(b) => b,
            Err(_) => {
                // Accept the wire-format V3AcceptedBlock as well.
                let accepted: V3AcceptedBlock = serde_json::from_value(params.clone())
                    .map_err(|e| V3RpcError::Parse(e.to_string()))?;
                accepted.into_v3_block().map_err(V3RpcError::Parse)?
            }
        };

        let previous = if block.height == 0 {
            None
        } else {
            self.storage
                .get_v3_block_by_height(block.height.saturating_sub(1))
                .await?
        };

        let previous = previous.ok_or_else(|| {
            V3RpcError::Validation(format!(
                "missing previous block for height {}",
                block.height
            ))
        })?;

        let expected_difficulty = block.difficulty;
        crate::v3_compat::validate_v3_block(
            &block,
            previous.header_hash(),
            previous.header.timestamp,
            previous.height,
            expected_difficulty,
        )
        .map_err(|e| V3RpcError::Validation(e.to_string()))?;

        self.state
            .apply_block(&block)
            .await
            .map_err(|e| V3RpcError::Validation(e.to_string()))?;

        self.storage.put_v3_block(&block).await?;

        // Remove mined transactions from the mempool.
        let mined_ids: HashSet<String> =
            block.transactions.iter().map(|t| t.tx_id.clone()).collect();
        let mined_utxo: HashSet<String> =
            block.utxo_transactions.iter().map(|t| hex(&t.id)).collect();
        self.mempool_account
            .lock()
            .await
            .retain(|t| !mined_ids.contains(&t.tx_id));
        self.mempool_utxo
            .lock()
            .await
            .retain(|t| !mined_utxo.contains(&hex(&t.id)));

        Ok(json!({
            "accepted": true,
            "height": block.height,
            "hash": hex(&block.header_hash()),
        }))
    }

    async fn submit_account_tx(&self, params: &Value) -> Result<Value, V3RpcError> {
        let tx: AccountTransaction = serde_json::from_value(extract_transaction(params))
            .map_err(|e| V3RpcError::Parse(e.to_string()))?;

        validate_account_tx_for_mempool(&tx)?;

        if !crate::v3_state::verify_account_signature(&tx) {
            return Err(V3RpcError::Validation(
                "account transaction signature verification failed".to_string(),
            ));
        }

        let mut mempool = self.mempool_account.lock().await;
        if mempool.iter().any(|t| t.tx_id == tx.tx_id) {
            return Err(V3RpcError::Validation(
                "transaction already in mempool".to_string(),
            ));
        }
        mempool.push(tx.clone());

        Ok(json!({ "accepted": true, "tx_id": tx.tx_id }))
    }

    async fn submit_utxo_tx(&self, params: &Value) -> Result<Value, V3RpcError> {
        let tx: UtxoTransaction = serde_json::from_value(extract_transaction(params))
            .map_err(|e| V3RpcError::Parse(e.to_string()))?;

        if tx.id != tx.calculate_hash() {
            return Err(V3RpcError::Validation(
                "UTXO transaction id does not match calculated hash".to_string(),
            ));
        }

        if tx.inputs.is_empty() {
            return Err(V3RpcError::Validation(
                "mempool rejects coinbase UTXO transaction".to_string(),
            ));
        }

        for input in &tx.inputs {
            if !crypto::verify(&input.public_key, &tx.id, &input.signature) {
                return Err(V3RpcError::Validation(
                    "UTXO transaction signature verification failed".to_string(),
                ));
            }
            match self
                .storage
                .v3_utxo(&input.prev_tx_hash, input.output_index)
                .await?
            {
                Some(utxo) if !utxo.2 => {
                    let derived = crypto::derive_address(&input.public_key);
                    if derived != utxo.1 {
                        return Err(V3RpcError::Validation(
                            "UTXO input not owned by public key".to_string(),
                        ));
                    }
                }
                _ => {
                    return Err(V3RpcError::Validation(
                        "UTXO input does not exist or is already spent".to_string(),
                    ));
                }
            }
        }

        let mut mempool = self.mempool_utxo.lock().await;
        if mempool.iter().any(|t| t.id == tx.id) {
            return Err(V3RpcError::Validation(
                "transaction already in mempool".to_string(),
            ));
        }
        mempool.push(tx.clone());

        Ok(json!({ "accepted": true, "tx_id": hex(&tx.id) }))
    }

    async fn get_balance(&self, params: &Value) -> Result<Value, V3RpcError> {
        let address = params
            .get("address")
            .and_then(Value::as_str)
            .ok_or_else(|| V3RpcError::Parse("address required".to_string()))?;
        let (balance, nonce) = self.storage.v3_account(address).await?.unwrap_or((0, 0));
        Ok(json!({ "address": address, "balance": balance.to_string(), "nonce": nonce }))
    }

    async fn get_utxos(&self, params: &Value) -> Result<Value, V3RpcError> {
        let address = params
            .get("address")
            .and_then(Value::as_str)
            .ok_or_else(|| V3RpcError::Parse("address required".to_string()))?;
        let utxos = self.storage.v3_utxos_by_address(address).await?;
        let out: Vec<Value> = utxos
            .into_iter()
            .map(|(hash, idx, amount)| {
                json!({
                    "tx_hash": hex(&hash),
                    "output_index": idx,
                    "amount": amount,
                })
            })
            .collect();
        Ok(json!({ "address": address, "utxos": out, "count": out.len(), "model": "v3" }))
    }

    async fn get_transaction(&self, params: &Value) -> Result<Value, V3RpcError> {
        let txid = params
            .get("txid")
            .or_else(|| params.get(0))
            .and_then(Value::as_str)
            .ok_or_else(|| V3RpcError::Parse("txid required".to_string()))?;
        let height = self.storage.v3_height().await?;
        for h in 0..=height {
            if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                for tx in &block.transactions {
                    if tx.tx_id == txid {
                        return Ok(json!({
                            "transaction_model": "hybrid",
                            "transaction": tx,
                            "block_height": block.height,
                            "block_hash": hex(&block.header_hash()),
                            "confirmed": true,
                            "source": "confirmed",
                        }));
                    }
                }
                for utxo_tx in &block.utxo_transactions {
                    if hex(&utxo_tx.id) == txid {
                        return Ok(json!({
                            "transaction_model": "hybrid",
                            "transaction": utxo_tx,
                            "block_height": block.height,
                            "block_hash": hex(&block.header_hash()),
                            "confirmed": true,
                            "source": "confirmed",
                        }));
                    }
                }
            }
        }
        Ok(Value::Null)
    }

    async fn get_transaction_history(&self, params: &Value) -> Result<Value, V3RpcError> {
        let address = params
            .get("address")
            .or_else(|| params.get("account"))
            .or_else(|| params.get(0))
            .and_then(Value::as_str)
            .ok_or_else(|| V3RpcError::Parse("address required".to_string()))?;
        let offset = params
            .get("offset")
            .or_else(|| params.get(1))
            .and_then(Value::as_u64)
            .unwrap_or(0);
        let limit = params
            .get("limit")
            .or_else(|| params.get(2))
            .and_then(Value::as_u64)
            .unwrap_or(50)
            .min(1000);
        if address.is_empty() {
            return Err(V3RpcError::Validation("empty address".to_string()));
        }
        let height = self.storage.v3_height().await?;
        let mut transactions = Vec::new();
        for h in 0..=height {
            if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                for tx in &block.transactions {
                    if tx.from == address || tx.to == address {
                        transactions.push(json!({
                            "transaction": tx,
                            "tx_model": "account",
                            "block_height": block.height,
                            "block_hash": hex(&block.header_hash()),
                            "timestamp": block.header.timestamp,
                            "confirmed": true,
                        }));
                    }
                }
                for utxo_tx in &block.utxo_transactions {
                    let is_recipient = utxo_tx.outputs.iter().any(|o| o.address == address);
                    let is_sender = utxo_tx.inputs.iter().any(|input| {
                        crate::crypto::derive_address(&input.public_key) == address
                    });
                    if is_recipient || is_sender {
                        let received: u128 = utxo_tx
                            .outputs
                            .iter()
                            .filter(|o| o.address == address)
                            .map(|o| o.amount as u128)
                            .sum();
                        transactions.push(json!({
                            "transaction": utxo_tx,
                            "tx_model": "utxo",
                            "tx_hash": hex(&utxo_tx.id),
                            "block_height": block.height,
                            "block_hash": hex(&block.header_hash()),
                            "timestamp": block.header.timestamp,
                            "confirmed": true,
                            "is_sender": is_sender,
                            "is_recipient": is_recipient,
                            "received_amount_flowers": received.to_string(),
                        }));
                    }
                }
            }
        }
        transactions.sort_by(|a, b| {
            let ha = a["block_height"].as_u64().unwrap_or(0);
            let hb = b["block_height"].as_u64().unwrap_or(0);
            hb.cmp(&ha)
        });
        let total = transactions.len();
        let start = offset as usize;
        let end = (start + limit as usize).min(total);
        let page = if start < total {
            transactions[start..end].to_vec()
        } else {
            Vec::new()
        };
        Ok(json!({
            "address": address,
            "transactions": page,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": end < total,
        }))
    }

    async fn get_address_info(&self, params: &Value) -> Result<Value, V3RpcError> {
        let address = params
            .get("address")
            .or_else(|| params.get("account"))
            .or_else(|| params.get(0))
            .and_then(Value::as_str)
            .ok_or_else(|| V3RpcError::Parse("address required".to_string()))?;
        if address.is_empty() {
            return Err(V3RpcError::Validation("empty address".to_string()));
        }
        let (account_balance, nonce) = self
            .storage
            .v3_account(address)
            .await?
            .unwrap_or((0, 0));
        let utxos = self.storage.v3_utxos_by_address(address).await?;
        let utxo_balance: u128 = utxos.iter().map(|(_, _, amt)| *amt as u128).sum();
        let utxo_count = utxos.len() as u64;
        let total = utxo_balance + account_balance;
        let mut tx_count = 0u64;
        let mut first_seen: Option<u64> = None;
        let mut last_seen: Option<u64> = None;
        let height = self.storage.v3_height().await?;
        for h in 0..=height {
            if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                for tx in &block.transactions {
                    if tx.from == address || tx.to == address {
                        tx_count += 1;
                        first_seen = Some(first_seen.map_or(block.height, |h| h.min(block.height)));
                        last_seen = Some(last_seen.map_or(block.height, |h| h.max(block.height)));
                    }
                }
            }
        }
        Ok(json!({
            "address": address,
            "balance_flowers": total.to_string(),
            "balance_zion": format_zion(total),
            "transaction_count": tx_count,
            "utxo_count": utxo_count,
            "nonce": nonce,
            "first_seen_height": first_seen,
            "last_seen_height": last_seen,
            "transaction_model": "hybrid",
        }))
    }

    async fn get_balance_at_height(&self, params: &Value) -> Result<Value, V3RpcError> {
        let address = params
            .get("address")
            .or_else(|| params.get("account"))
            .or_else(|| params.get(0))
            .and_then(Value::as_str)
            .ok_or_else(|| V3RpcError::Parse("address required".to_string()))?;
        let height = params
            .get("height")
            .or_else(|| params.get(1))
            .and_then(Value::as_u64)
            .ok_or_else(|| V3RpcError::Parse("height required".to_string()))?;
        let chain_height = self.storage.v3_height().await?;
        let effective_height = height.min(chain_height);
        let mut balance: i128 = 0;
        for h in 0..=effective_height {
            if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                for tx in &block.transactions {
                    if tx.to == address {
                        balance += tx.amount_zion as i128;
                    }
                    if tx.from == address {
                        balance -= (tx.amount_zion + tx.fee_zion as u128) as i128;
                    }
                }
            }
        }
        Ok(json!({
            "address": address,
            "height": effective_height,
            "balance_zion": balance.max(0).to_string(),
            "transaction_model": "hybrid",
            "balance_scope": "confirmed_chain_only",
        }))
    }

    async fn get_mempool_info(&self) -> Result<Value, V3RpcError> {
        let account_count = self.mempool_account.lock().await.len();
        let utxo_count = self.mempool_utxo.lock().await.len();
        Ok(json!({
            "size": account_count + utxo_count,
            "account_transactions": account_count,
            "utxo_transactions": utxo_count,
            "transaction_model": "hybrid",
        }))
    }

    async fn get_supply_info(&self) -> Result<Value, V3RpcError> {
        let height = self.storage.v3_height().await?;
        let block_reward = crate::emission::block_subsidy(height.max(1));
        let mined_flowers: u128 = {
            let mut sum: u128 = 0;
            let mut h: u64 = 1;
            while h <= height {
                let decade_end =
                    ((h - 1) / crate::emission::BLOCKS_PER_DECADE + 1) * crate::emission::BLOCKS_PER_DECADE;
                let blocks_in_range = decade_end.min(height) - h + 1;
                sum += crate::emission::block_subsidy(h) as u128 * blocks_in_range as u128;
                h = decade_end + 1;
            }
            sum
        };
        let circulating = crate::emission::GENESIS_PREMINE + mined_flowers;
        let remaining = crate::emission::TOTAL_SUPPLY.saturating_sub(circulating);
        let supply_mined_pct = if crate::emission::MINING_EMISSION > 0 {
            (mined_flowers as f64 / crate::emission::MINING_EMISSION as f64) * 100.0
        } else {
            0.0
        };
        Ok(json!({
            "total_supply_flowers": crate::emission::TOTAL_SUPPLY.to_string(),
            "premine_flowers": crate::emission::GENESIS_PREMINE.to_string(),
            "mining_emission_flowers": crate::emission::MINING_EMISSION.to_string(),
            "mined_so_far_flowers": mined_flowers.to_string(),
            "circulating_supply_flowers": circulating.to_string(),
            "remaining_supply_flowers": remaining.to_string(),
            "block_reward_flowers": block_reward,
            "total_supply_zion": (crate::emission::TOTAL_SUPPLY / crate::emission::FLOWERS_PER_ZION as u128) as u64,
            "premine_zion": (crate::emission::GENESIS_PREMINE / crate::emission::FLOWERS_PER_ZION as u128) as u64,
            "mining_emission_zion": (crate::emission::MINING_EMISSION / crate::emission::FLOWERS_PER_ZION as u128) as u64,
            "mined_so_far_zion": (mined_flowers / crate::emission::FLOWERS_PER_ZION as u128) as u64,
            "circulating_supply_zion": (circulating / crate::emission::FLOWERS_PER_ZION as u128) as u64,
            "remaining_supply_zion": (remaining / crate::emission::FLOWERS_PER_ZION as u128) as u64,
            "block_reward_zion": block_reward as f64 / crate::emission::FLOWERS_PER_ZION as f64,
            "supply_mined_percent": format!("{:.6}", supply_mined_pct),
            "height": height,
            "protocol_version": 2,
        }))
    }

    async fn get_block_range(&self, params: &Value) -> Result<Value, V3RpcError> {
        let start_height = params
            .get("start_height")
            .or_else(|| params.get("from"))
            .or_else(|| params.get(0))
            .and_then(Value::as_u64)
            .ok_or_else(|| V3RpcError::Parse("start_height required".to_string()))?;
        let end_height = params
            .get("end_height")
            .or_else(|| params.get("to"))
            .or_else(|| params.get(1))
            .and_then(Value::as_u64);
        let limit = params
            .get("limit")
            .or_else(|| params.get(2))
            .and_then(Value::as_u64)
            .unwrap_or(100)
            .min(500);
        let chain_height = self.storage.v3_height().await?;
        let actual_end = end_height.unwrap_or(chain_height).min(chain_height);
        if start_height > actual_end {
            return Err(V3RpcError::Validation(
                "start_height cannot be greater than end_height".to_string(),
            ));
        }
        let requested_count = (actual_end - start_height + 1).min(limit);
        let mut blocks = Vec::new();
        for h in start_height..=(start_height + requested_count - 1).min(actual_end) {
            if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                blocks.push(serde_json::to_value(block)?);
            }
        }
        Ok(json!({
            "blocks": blocks,
            "count": blocks.len(),
            "start_height": start_height,
            "end_height": actual_end,
            "chain_height": chain_height,
            "has_more": actual_end > start_height + requested_count - 1,
        }))
    }

    async fn get_network_stats(&self) -> Result<Value, V3RpcError> {
        let height = self.storage.v3_height().await?;
        if height < 1 {
            return Ok(json!({
                "error": "insufficient blocks for statistics",
                "min_blocks_required": 2,
            }));
        }
        let sample_size = 100.min(height as usize + 1);
        let start = height.saturating_sub(sample_size as u64 - 1);
        let mut block_times = Vec::new();
        let mut total_difficulty = 0u64;
        let mut last_ts = 0u64;
        let mut current_difficulty = 0u64;
        for h in start..=height {
            if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                if last_ts > 0 {
                    block_times.push(block.header.timestamp.saturating_sub(last_ts));
                }
                total_difficulty += block.difficulty;
                current_difficulty = block.difficulty;
                last_ts = block.header.timestamp;
            }
        }
        let avg_block_time = if !block_times.is_empty() {
            block_times.iter().sum::<u64>() / block_times.len() as u64
        } else {
            60
        };
        let avg_difficulty = if sample_size > 0 {
            total_difficulty / sample_size as u64
        } else {
            0
        };
        let estimated_hashrate = if avg_block_time > 0 {
            (avg_difficulty as f64 * 4_294_967_296.0) / avg_block_time as f64
        } else {
            0.0
        };
        let hashrate_fmt = if estimated_hashrate >= 1e18 {
            format!("{:.2} EH/s", estimated_hashrate / 1e18)
        } else if estimated_hashrate >= 1e15 {
            format!("{:.2} PH/s", estimated_hashrate / 1e15)
        } else if estimated_hashrate >= 1e12 {
            format!("{:.2} TH/s", estimated_hashrate / 1e12)
        } else if estimated_hashrate >= 1e9 {
            format!("{:.2} GH/s", estimated_hashrate / 1e9)
        } else if estimated_hashrate >= 1e6 {
            format!("{:.2} MH/s", estimated_hashrate / 1e6)
        } else {
            format!("{:.2} H/s", estimated_hashrate)
        };
        let mempool_size = self.mempool_account.lock().await.len() + self.mempool_utxo.lock().await.len();
        Ok(json!({
            "chain_height": height,
            "average_block_time": avg_block_time,
            "target_block_time": 60,
            "average_difficulty": avg_difficulty,
            "current_difficulty": current_difficulty,
            "estimated_hashrate_hps": estimated_hashrate,
            "estimated_hashrate_formatted": hashrate_fmt,
            "sample_size": sample_size,
            "mempool_size": mempool_size,
            "network_hashrate": hashrate_fmt,
        }))
    }

    async fn get_bridge_locks(&self, params: &Value) -> Result<Value, V3RpcError> {
        let from_height = params
            .get("from_height")
            .or_else(|| params.get(0))
            .and_then(Value::as_u64)
            .ok_or_else(|| V3RpcError::Parse("from_height required".to_string()))?;
        let chain_height = self.storage.v3_height().await?;
        let to_height = params
            .get("to_height")
            .or_else(|| params.get(1))
            .and_then(Value::as_u64)
            .unwrap_or(chain_height)
            .min(chain_height);
        if from_height > to_height {
            return Err(V3RpcError::Validation(
                "from_height cannot be greater than to_height".to_string(),
            ));
        }
        let mut locks = Vec::new();
        for h in from_height..=to_height {
            if let Some(block) = self.storage.get_v3_block_by_height(h).await? {
                for utxo_tx in &block.utxo_transactions {
                    let sender = utxo_tx
                        .inputs
                        .first()
                        .map(|input| crate::crypto::derive_address(&input.public_key))
                        .unwrap_or_default();
                    let txid = hex(&utxo_tx.id);
                    for output in &utxo_tx.outputs {
                        if output.address != crate::fee::BRIDGE_VAULT_ADDRESS {
                            continue;
                        }
                        let Some(memo) = output.memo.as_deref() else { continue };
                        let Some(rest) = memo.strip_prefix("BRIDGE:") else { continue };
                        let Some((chain, recipient)) = rest.split_once(':') else { continue };
                        if chain.is_empty() || recipient.is_empty() {
                            continue;
                        }
                        locks.push(json!({
                            "txid": txid,
                            "block_height": block.height,
                            "sender": sender,
                            "recipient_chain": chain,
                            "recipient": recipient,
                            "amount_flowers": output.amount,
                            "amount_zion": format_zion(output.amount as u128),
                            "memo": memo,
                            "confirmed": true,
                        }));
                    }
                }
            }
        }
        Ok(json!({
            "from_height": from_height,
            "to_height": to_height,
            "locks": locks,
            "count": locks.len(),
        }))
    }

    async fn get_bridge_vault_balance(&self) -> Result<Value, V3RpcError> {
        let utxos = self
            .storage
            .v3_utxos_by_address(crate::fee::BRIDGE_VAULT_ADDRESS)
            .await?;
        let balance: u128 = utxos.iter().map(|(_, _, amt)| *amt as u128).sum();
        let height = self.storage.v3_height().await?;
        Ok(json!({
            "address": crate::fee::BRIDGE_VAULT_ADDRESS,
            "balance_flowers": balance.to_string(),
            "balance_zion": format_zion(balance),
            "chain_height": height,
        }))
    }

    async fn estimate_fee(&self, params: &Value) -> Result<Value, V3RpcError> {
        let amount_zion = params
            .get("amount")
            .or_else(|| params.get(0))
            .and_then(Value::as_str)
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let base_fee = 1_000_000u64;
        let amount_fee = (amount_zion / 10000).max(base_fee);
        let mempool_size = self.mempool_account.lock().await.len() + self.mempool_utxo.lock().await.len();
        let congestion_multiplier = if mempool_size > 1000 {
            2.0
        } else if mempool_size > 500 {
            1.5
        } else {
            1.0
        };
        let estimated_fee = (amount_fee as f64 * congestion_multiplier) as u64;
        Ok(json!({
            "estimated_fee_flowers": estimated_fee.to_string(),
            "estimated_fee_zion": format_zion(estimated_fee as u128),
            "amount_zion": amount_zion,
            "mempool_size": mempool_size,
            "congestion_multiplier": congestion_multiplier,
            "min_fee_flowers": base_fee.to_string(),
            "min_fee_zion": format_zion(base_fee as u128),
        }))
    }

    async fn get_token_info(&self) -> Result<Value, V3RpcError> {
        let utxos = self
            .storage
            .v3_utxos_by_address(crate::fee::BRIDGE_VAULT_ADDRESS)
            .await?;
        let vault_balance: u128 = utxos.iter().map(|(_, _, amt)| *amt as u128).sum();
        let height = self.storage.v3_height().await?;
        let bridge_contract = "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721";
        let wzion_contract = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6";
        Ok(json!({
            "token_name": "Wrapped ZION",
            "token_symbol": "wZION",
            "bridge_contract": bridge_contract,
            "wzion_contract": wzion_contract,
            "bridge_network": "Base Mainnet",
            "total_locked_flowers": vault_balance.to_string(),
            "total_locked_zion": format_zion(vault_balance),
            "total_minted_wzion": format_zion(vault_balance),
            "bridge_vault_address": crate::fee::BRIDGE_VAULT_ADDRESS,
            "bridge_vault_balance_flowers": vault_balance.to_string(),
            "chain_height": height,
            "peg_status": "1:1 maintained",
            "bridge_status": "operational",
        }))
    }

    async fn submit_bridge_unlock(&self, params: &Value) -> Result<Value, V3RpcError> {
        // V3 bridge relay format: params contain "recipient", "amount_flowers",
        // "burn_id", "evm_chain", "evm_tx_hash", "validator_proofs".
        // Build the transaction internally from these parameters.
        if params.get("recipient").is_some() && params.get("amount_flowers").is_some() {
            return self.submit_bridge_unlock_relay_format(params).await;
        }

        let tx: UtxoTransaction = serde_json::from_value(extract_transaction(params))
            .map_err(|e| V3RpcError::Parse(e.to_string()))?;

        if tx.id != tx.calculate_hash() {
            return Err(V3RpcError::Validation(
                "UTXO transaction id does not match calculated hash".to_string(),
            ));
        }

        let bridge_tx = crate::v3_tx::Transaction {
            id: tx.id,
            version: tx.version,
            inputs: tx
                .inputs
                .iter()
                .map(|i| crate::v3_tx::TxInput {
                    prev_tx_hash: i.prev_tx_hash,
                    output_index: i.output_index,
                    signature: i.signature.clone(),
                    public_key: i.public_key.clone(),
                })
                .collect(),
            outputs: tx
                .outputs
                .iter()
                .map(|o| crate::v3_tx::TxOutput {
                    amount: o.amount,
                    address: o.address.clone(),
                    memo: o.memo.clone(),
                })
                .collect(),
            fee: tx.fee,
            timestamp: tx.timestamp,
        };

        let block_height = self.storage.v3_height().await?;
        let utxo_rows = self
            .storage
            .v3_utxos_by_address(crate::fee::BRIDGE_VAULT_ADDRESS)
            .await?;
        let mut utxos: std::collections::HashMap<(String, u32), crate::v3_chain::SpendableUtxo> =
            std::collections::HashMap::new();
        for (hash, idx, amount) in utxo_rows {
            let key = (hex(&hash), idx);
            utxos.insert(
                key,
                crate::v3_chain::SpendableUtxo {
                    tx_hash: hex(&hash),
                    output_index: idx,
                    amount,
                    address: crate::fee::BRIDGE_VAULT_ADDRESS.to_string(),
                    height: block_height,
                },
            );
        }

        match crate::v3_bridge::validate_bridge_unlock_transaction_shape_with_utxos(
            &bridge_tx,
            &utxos,
            block_height,
        ) {
            Ok(Some(_replay_key)) => {
                let mut mempool = self.mempool_utxo.lock().await;
                if mempool.iter().any(|t| t.id == tx.id) {
                    return Err(V3RpcError::Validation(
                        "transaction already in mempool".to_string(),
                    ));
                }
                let tx_id = hex(&tx.id);
                mempool.push(tx);
                Ok(json!({
                    "accepted": true,
                    "tx_id": tx_id,
                }))
            }
            Ok(None) => Err(V3RpcError::Validation(
                "transaction is not a bridge unlock".to_string(),
            )),
            Err(msg) => Err(V3RpcError::Validation(format!(
                "bridge unlock validation failed: {msg}"
            ))),
        }
    }

    /// Handle the V3 bridge relay format for `submitBridgeUnlock`.
    ///
    /// The relay sends `{"recipient", "amount_flowers", "burn_id",
    /// "evm_chain", "evm_tx_hash", "validator_proofs"}` instead of a
    /// pre-built transaction.  We build the UTXO transaction internally
    /// using bridge vault UTXOs, embed the proofs in the memo, and submit
    /// it to the mempool.
    async fn submit_bridge_unlock_relay_format(&self, params: &Value) -> Result<Value, V3RpcError> {
        use crate::v3_bridge::{
            bridge_operation_message, bridge_unlock_memo_with_proofs,
            bridge_unlock_replay_key, load_bridge_validator_pubkey_allowlist,
            required_bridge_validator_threshold, verify_bridge_proofs,
            BridgeValidatorProof,
        };
        use crate::v3_tx::{self, Transaction as V3Tx, TxInput, TxOutput};
        use crate::fee;

        // Parse request fields
        let recipient = params
            .get("recipient")
            .and_then(|v| v.as_str())
            .ok_or_else(|| V3RpcError::Parse("missing 'recipient' field".to_string()))?;
        let amount_flowers = params
            .get("amount_flowers")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| V3RpcError::Parse("missing or invalid 'amount_flowers' field".to_string()))?;
        let burn_id = params
            .get("burn_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| V3RpcError::Parse("missing 'burn_id' field".to_string()))?;
        let evm_chain = params
            .get("evm_chain")
            .and_then(|v| v.as_str())
            .ok_or_else(|| V3RpcError::Parse("missing 'evm_chain' field".to_string()))?;
        let evm_tx_hash = params
            .get("evm_tx_hash")
            .and_then(|v| v.as_str())
            .ok_or_else(|| V3RpcError::Parse("missing 'evm_tx_hash' field".to_string()))?;

        // Parse validator proofs.  The V3 bridge relay sends each proof as:
        //   { "validator_id", "validator_public_key", "signature", ... }
        // We map these to `BridgeValidatorProof::new(validator_id, pubkey_hex, signature_hex)`.
        let proofs_raw = params
            .get("validator_proofs")
            .and_then(|v| v.as_array())
            .ok_or_else(|| V3RpcError::Parse("missing 'validator_proofs' field".to_string()))?;

        let mut proofs = Vec::new();
        for (i, p) in proofs_raw.iter().enumerate() {
            let validator_id = p
                .get("validator_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| V3RpcError::Parse(format!("proof {i}: missing 'validator_id'")))?;
            let pubkey = p
                .get("validator_public_key")
                .or_else(|| p.get("pubkey"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| V3RpcError::Parse(format!("proof {i}: missing 'validator_public_key'")))?;
            let signature = p
                .get("signature")
                .and_then(|v| v.as_str())
                .ok_or_else(|| V3RpcError::Parse(format!("proof {i}: missing 'signature'")))?;
            proofs.push(BridgeValidatorProof::new(validator_id, pubkey, signature).map_err(|e| {
                V3RpcError::Parse(format!("proof {i}: {e}"))
            })?);
        }

        // Verify proofs against the canonical operation message
        let operation_message = bridge_operation_message(
            recipient,
            amount_flowers,
            evm_chain,
            burn_id,
            evm_tx_hash,
        );
        let allowed_pubkeys = load_bridge_validator_pubkey_allowlist();
        let threshold = required_bridge_validator_threshold();
        verify_bridge_proofs(&proofs, &operation_message, &allowed_pubkeys, threshold)
            .map_err(|e| V3RpcError::Validation(format!("bridge proof verification failed: {e}")))?;

        // Replay protection is enforced at block acceptance time via the
        // memo-embedded replay key (ChainState::bridge_unlock_replay_keys).
        let _replay_key = bridge_unlock_replay_key(evm_chain, burn_id, evm_tx_hash);

        // Query bridge vault UTXOs
        let block_height = self.storage.v3_height().await?;
        let utxo_rows = self
            .storage
            .v3_utxos_by_address(fee::BRIDGE_VAULT_ADDRESS)
            .await?;

        // Build spendable UTXOs
        let mut spendable: Vec<crate::v3_chain::SpendableUtxo> = utxo_rows
            .into_iter()
            .map(|(hash, idx, amount)| crate::v3_chain::SpendableUtxo {
                tx_hash: hex(&hash),
                output_index: idx,
                amount,
                address: fee::BRIDGE_VAULT_ADDRESS.to_string(),
                height: block_height,
            })
            .collect();
        spendable.sort_by(|a, b| {
            a.height
                .cmp(&b.height)
                .then(a.tx_hash.cmp(&b.tx_hash))
                .then(a.output_index.cmp(&b.output_index))
        });

        // Select UTXOs to cover amount + fee
        let pending_height = block_height.saturating_add(1);
        let scale_fix_active =
            crate::v3_bridge::bridge_unlock_scale_fix_active(pending_height);

        let mut selected = Vec::new();
        let mut total_input = 0u64;
        let mut required_fee = fee::minimum_fee_for_size(fee::estimate_tx_size(1, 2));
        for utxo in &spendable {
            let scaled_amount = if scale_fix_active {
                crate::v3_bridge::bridge_vault_utxo_scaled_amount(utxo.amount, utxo.height)
            } else {
                utxo.amount
            };
            total_input = total_input
                .checked_add(scaled_amount)
                .ok_or_else(|| V3RpcError::Validation("input sum overflow".to_string()))?;
            selected.push(utxo.clone());
            required_fee = fee::minimum_fee_for_size(fee::estimate_tx_size(selected.len(), 2));
            let required_total = amount_flowers
                .checked_add(required_fee)
                .ok_or_else(|| V3RpcError::Validation("amount + fee overflow".to_string()))?;
            if total_input >= required_total {
                break;
            }
        }

        let required_total = amount_flowers
            .checked_add(required_fee)
            .ok_or_else(|| V3RpcError::Validation("amount + fee overflow".to_string()))?;
        if total_input < required_total {
            return Err(V3RpcError::Validation(format!(
                "bridge vault balance {} insufficient for unlock amount {} plus fee {}",
                total_input, amount_flowers, required_fee,
            )));
        }

        // Build outputs
        let mut outputs = vec![TxOutput {
            amount: amount_flowers,
            address: recipient.to_string(),
            memo: Some(bridge_unlock_memo_with_proofs(
                evm_chain,
                burn_id,
                evm_tx_hash,
                &proofs,
            )),
        }];

        let change = total_input - required_total;
        if change > 0 {
            outputs.push(TxOutput {
                amount: change,
                address: fee::BRIDGE_VAULT_ADDRESS.to_string(),
                memo: None,
            });
        }

        // Determine tx version
        let bridge_utxo_ver = if zion_cosmic_harmony_v3::tx_hash_v2_active(pending_height) {
            v3_tx::TX_HASH_V2_VERSION
        } else {
            1u32
        };

        // Build transaction
        let mut transaction = V3Tx {
            id: [0u8; 32],
            version: bridge_utxo_ver,
            inputs: selected
                .into_iter()
                .map(|utxo| TxInput {
                    prev_tx_hash: crate::chain_state::parse_fixed_hex::<32>(&utxo.tx_hash, "bridge vault utxo hash")
                        .unwrap_or([0u8; 32]),
                    output_index: utxo.output_index,
                    signature: Vec::new(),
                    public_key: Vec::new(),
                })
                .collect(),
            outputs,
            fee: required_fee,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        };
        transaction.finalize_id();

        let tx_id = hex(&transaction.id);

        // Convert to UtxoTransaction for mempool
        let utxo_tx = UtxoTransaction {
            id: transaction.id,
            version: transaction.version,
            inputs: transaction
                .inputs
                .iter()
                .map(|i| crate::v3_compat::TxInput {
                    prev_tx_hash: i.prev_tx_hash,
                    output_index: i.output_index,
                    signature: i.signature.clone(),
                    public_key: i.public_key.clone(),
                })
                .collect(),
            outputs: transaction
                .outputs
                .iter()
                .map(|o| crate::v3_compat::TxOutput {
                    amount: o.amount,
                    address: o.address.clone(),
                    memo: o.memo.clone(),
                })
                .collect(),
            fee: transaction.fee,
            timestamp: transaction.timestamp,
        };

        // Check mempool for duplicates
        let mut mempool = self.mempool_utxo.lock().await;
        if mempool.iter().any(|t| t.id == utxo_tx.id) {
            return Err(V3RpcError::Validation(
                "transaction already in mempool".to_string(),
            ));
        }
        mempool.push(utxo_tx);

        Ok(json!({
            "accepted": true,
            "tx_id": tx_id,
            "tx_hash": tx_id,
        }))
    }
}

fn format_zion(amount: u128) -> String {
    format!(
        "{}.{:06}",
        amount / crate::emission::FLOWERS_PER_ZION as u128,
        amount % crate::emission::FLOWERS_PER_ZION as u128
    )
}

fn validate_account_tx_for_mempool(tx: &AccountTransaction) -> Result<(), V3RpcError> {
    if tx.tx_id.len() != 64 || !tx.tx_id.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(V3RpcError::Validation(
            "tx_id must be 64 hex chars".to_string(),
        ));
    }
    if tx.from.is_empty() || tx.to.is_empty() {
        return Err(V3RpcError::Validation(
            "from/to must not be empty".to_string(),
        ));
    }
    if tx.from == tx.to {
        return Err(V3RpcError::Validation(
            "from and to must differ".to_string(),
        ));
    }
    if tx.amount_zion == 0 {
        return Err(V3RpcError::Validation("amount must be > 0".to_string()));
    }
    if tx.fee_zion == 0 {
        return Err(V3RpcError::Validation("fee must be > 0".to_string()));
    }
    if (tx.fee_zion as u128) > tx.amount_zion {
        return Err(V3RpcError::Validation(
            "fee must not exceed amount".to_string(),
        ));
    }
    if let Some(ref memo) = tx.memo {
        if memo.len() > 256 {
            return Err(V3RpcError::Validation("memo too long".to_string()));
        }
        if !memo.is_ascii() {
            return Err(V3RpcError::Validation("memo must be ASCII".to_string()));
        }
    }
    Ok(())
}

fn decode_hex_32(s: &str) -> Result<[u8; 32], V3RpcError> {
    let bytes = hex::decode(s).map_err(|_| V3RpcError::Parse("invalid hex".to_string()))?;
    bytes
        .try_into()
        .map_err(|_| V3RpcError::Parse("hash must be 32 bytes".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::v3_compat::build_v3_genesis_block;
    use crate::v3_state::generate_account_tx_id;

    #[tokio::test]
    async fn get_status_after_genesis() {
        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let handler = V3RpcHandler::new(storage);

        let status = handler.dispatch("getStatus", Value::Null).await;
        assert_eq!(status["result"]["chain_height"], 0);
    }

    #[tokio::test]
    async fn submit_and_retrieve_account_block() {
        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let handler = V3RpcHandler::new(storage.clone());

        // Seed genesis so block 1 has a predecessor.
        let genesis = build_v3_genesis_block();
        storage.put_v3_block(&genesis).await.unwrap();

        // Seed a sender.
        let (sk, vk) = crypto::generate_keypair();
        let from = crypto::derive_address(vk.as_bytes());
        storage
            .set_v3_account(&from, 1_000_000_000, 0)
            .await
            .unwrap();

        // Build and submit block 1.
        let mut builder = V3TemplateBuilder::new(storage.clone());
        builder.set_miner_address("miner".to_string()).unwrap();
        let mut block = builder.build(&build_v3_genesis_block(), 1).await.unwrap();

        // Sign a transfer from the funded account.
        let to = "zion1burn0000000000000000000000000000000dead";
        let amount = 100_000u128;
        let fee = 1_000u64;
        let nonce = 0u64;
        let tx_id = generate_account_tx_id(&from, to, amount as u64, nonce, None, 1);
        let sig = crypto::sign(&sk, tx_id.as_bytes());
        let tx = AccountTransaction {
            tx_id,
            from: from.clone(),
            to: to.to_string(),
            amount_zion: amount,
            fee_zion: fee,
            nonce,
            signature: hex(&sig),
            public_key: hex(vk.as_bytes()),
            memo: None,
        };
        block.transactions.push(tx);

        // Recompute merkle root.
        block.header.merkle_root = crate::v3_compat::derive_template_merkle_root_v2_blake3(
            &block.transactions,
            &block.utxo_transactions,
        );

        handler
            .dispatch("submitBlock", serde_json::to_value(&block).unwrap())
            .await;

        let retrieved = handler
            .dispatch("getBlockByHeight", json!({ "height": 1 }))
            .await;
        assert_eq!(retrieved["result"]["height"], 1);
        assert_eq!(
            retrieved["result"]["transactions"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
    }

    #[tokio::test]
    async fn submit_bridge_unlock_accepts_valid_multisig() {
        use k256::ecdsa::signature::Signer;
        use k256::ecdsa::SigningKey;
        use rand::rngs::OsRng;

        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let handler = V3RpcHandler::new(storage.clone());

        // Seed a bridge-vault UTXO that the unlock transaction will spend.
        let input_hash = [0x11u8; 32];
        storage
            .put_v3_utxos(&[(
                input_hash,
                0,
                1_000_000,
                crate::fee::BRIDGE_VAULT_ADDRESS.to_string(),
            )])
            .await
            .unwrap();

        // Generate a recipient ZION address.
        let (_sk, vk) = crate::crypto::generate_keypair();
        let recipient = crate::crypto::derive_address(vk.as_bytes());

        let source_chain = "base";
        let burn_id = "burn123";
        let evm_tx_hash = "0xdeadbeef";
        let amount = 900_000u64;
        let fee = 100_000u64;

        let operation_message = crate::v3_bridge::bridge_operation_message(
            &recipient, amount, source_chain, burn_id, evm_tx_hash,
        );

        // Build 3 validator proofs and collect pubkeys for the allowlist.
        let mut pubkeys = Vec::new();
        let mut proof_chunks = Vec::new();
        for i in 0..3 {
            let signing_key = SigningKey::random(&mut OsRng);
            let verifying_key = signing_key.verifying_key();
            let pubkey_hex = hex(verifying_key.to_sec1_bytes().as_ref());
            pubkeys.push(pubkey_hex.clone());
            let signature: k256::ecdsa::Signature = signing_key.sign(operation_message.as_bytes());
            let signature_hex = hex(signature.to_bytes().as_ref());
            proof_chunks.push(format!("val{i}:{pubkey_hex}:{signature_hex}"));
        }
        let proofs_str = proof_chunks.join(",");
        let memo = format!(
            "BRIDGE_UNLOCK:{source_chain}:{burn_id}:{evm_tx_hash}|PROOFS={proofs_str}"
        );

        // Build and hash the bridge-unlock UTXO transaction.
        let mut tx = UtxoTransaction {
            id: [0u8; 32],
            version: crate::v3_compat::TX_HASH_V2_VERSION,
            inputs: vec![crate::v3_compat::TxInput {
                prev_tx_hash: input_hash,
                output_index: 0,
                signature: Vec::new(),
                public_key: Vec::new(),
            }],
            outputs: vec![crate::v3_compat::TxOutput {
                amount,
                address: recipient,
                memo: Some(memo),
            }],
            fee,
            timestamp: 0,
        };
        tx.id = tx.calculate_hash();

        unsafe {
            std::env::set_var("ZION_BRIDGE_VALIDATOR_PUBKEYS", pubkeys.join(","));
        }

        let params = serde_json::to_value(&tx).unwrap();
        let result = handler.dispatch("submitBridgeUnlock", params).await;

        assert!(
            result["result"]["accepted"].as_bool().unwrap_or(false),
            "submitBridgeUnlock rejected valid bridge unlock: {:?}",
            result
        );
        assert_eq!(result["result"]["tx_id"].as_str().unwrap(), hex(&tx.id));
    }
}
