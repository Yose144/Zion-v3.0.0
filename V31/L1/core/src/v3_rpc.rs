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

    /// Dispatch a JSON-RPC method and return a JSON value suitable for the
    /// `result` field (errors are encoded as `{ "error": ... }`).
    pub async fn dispatch(&self, method: &str, params: Value) -> Value {
        let result = match method {
            "getStatus" => self.get_status().await,
            "getBlockByHeight" => self.get_block_by_height(&params).await,
            "getBlockByHash" => self.get_block_by_hash(&params).await,
            "getTemplate" => self.get_template(&params).await,
            "submitBlock" => self.submit_block(&params).await,
            "submitAccountTransaction" => self.submit_account_tx(&params).await,
            "submitUtxoTransaction" => self.submit_utxo_tx(&params).await,
            "getBalance" => self.get_balance(&params).await,
            "getUtxos" => self.get_utxos(&params).await,
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
        let tx: AccountTransaction =
            serde_json::from_value(params.clone()).map_err(|e| V3RpcError::Parse(e.to_string()))?;

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
        let tx: UtxoTransaction =
            serde_json::from_value(params.clone()).map_err(|e| V3RpcError::Parse(e.to_string()))?;

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
        Ok(json!({ "address": address, "utxos": out }))
    }
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
}
