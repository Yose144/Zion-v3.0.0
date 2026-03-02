use crate::blockchain::block::Block;
use crate::blockchain::consensus;
use crate::blockchain::reward;
use crate::crypto::{keys, to_hex};
use crate::premine;
use crate::state::State;
use crate::tx::{Transaction, TxInput, TxOutput};
use axum::extract::{Path, Query};
use axum::{extract::State as AxumState, Json};
use ed25519_dalek::{Signer, SigningKey};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct Template {
    pub version: u32,
    pub height: u64,
    pub difficulty: u64,
    pub prev_hash: String,
    pub target: String,
    pub reward_atomic: u64,
    pub timestamp: u64,
    pub blob: String,
}

#[derive(Deserialize)]
pub struct Submit {
    pub data: String,
} // Deprecated/Unused if we switch to Json<Block>

pub async fn health() -> &'static str {
    "ok"
}

pub async fn stats(AxumState(state): AxumState<State>) -> Json<serde_json::Value> {
    let h = state.height.load(std::sync::atomic::Ordering::Relaxed);
    let d = state.difficulty.load(std::sync::atomic::Ordering::Relaxed);
    let tip = { state.tip.lock().unwrap().clone() };
    let health = state.metrics.health_check();
    let sync_snap = crate::p2p::get_sync_status().to_json();
    Json(serde_json::json!({
        "tps": 0,
        "network": health.network,
        "height": h,
        "difficulty": d,
        "tip": tip,
        "peers_connected": health.peers_connected,
        "mempool_size": health.mempool_size,
        "time_since_last_block": health.time_since_last_block,
        "status": health.status,
        "sync": sync_snap,
    }))
}

pub async fn get_block_template(AxumState(state): AxumState<State>) -> Json<Template> {
    let tip_h = state.height.load(std::sync::atomic::Ordering::Relaxed) as u64;
    let h = tip_h.saturating_add(1);
    let d = state.difficulty.load(std::sync::atomic::Ordering::Relaxed) as u64;
    let prev = { state.tip.lock().unwrap().clone() };
    // Use 256-bit target for proper mining
    let target = consensus::target_from_difficulty_256(d);
    let reward_atomic = reward::calculate(h, d);
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // This endpoint does not include a wallet address; keep a deterministic placeholder
    // so callers can still round-trip submitBlock(blob, nonce, wallet).
    // In practice, the pool uses the JSON-RPC getBlockTemplate path.
    let merkle_root = crate::blockchain::block::Block::calculate_merkle_root(&[]);
    let blob = Block::build_template_blob(1, h, &prev, &merkle_root, timestamp, d);
    Json(Template {
        version: 1,
        height: h,
        difficulty: d,
        prev_hash: prev,
        target,
        reward_atomic,
        timestamp,
        blob,
    })
}

pub async fn get_premine_total() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "total_zion": premine::PREMINE_TOTAL / 1_000_000,
        "total_atomic": premine::PREMINE_TOTAL,
        "total_supply": premine::TOTAL_SUPPLY / 1_000_000
    }))
}

pub async fn get_premine_summary() -> Json<serde_json::Value> {
    let all = premine::get_all_premine_addresses();
    let by_category = all
        .iter()
        .fold(std::collections::HashMap::new(), |mut map, addr| {
            let cat = addr.category.clone();
            let entry = map.entry(cat).or_insert((0u64, 0usize));
            entry.0 += addr.amount;
            entry.1 += 1;
            map
        });
    let summary: Vec<_> = by_category
        .iter()
        .map(|(cat, (amt, cnt))| {
            serde_json::json!({
                "category": cat,
                "count": cnt,
                "total_atomic": amt,
                "total_zion": amt / 1_000_000
            })
        })
        .collect();
    Json(serde_json::json!({"categories": summary}))
}

pub async fn submit_tx(
    AxumState(state): AxumState<State>,
    Json(tx): Json<Transaction>,
) -> Json<serde_json::Value> {
    let tx_id = tx.id.clone();
    println!("RPC: submit_tx received {}", tx_id);

    // 1. Verify Signatures (Stateless)
    if !tx.verify_signatures() {
        return Json(
            serde_json::json!({"status": "error", "message": "Invalid signatures or ID mismatch"}),
        );
    }

    // 2. Verify UTXOs (Context uses Storage)
    {
        for input in &tx.inputs {
            // Check for Coinbase-like inputs?
            let zero_hash = "0000000000000000000000000000000000000000000000000000000000000000";
            if input.prev_tx_hash == zero_hash {
                continue;
            }

            let key = format!("{}:{}", input.prev_tx_hash, input.output_index);
            // Storage access (Blocking I/O)
            match state.storage.get_utxo(&key).unwrap_or(None) {
                Some(output) => {
                    // Check ownership
                    let derived = keys::address_from_public_key(&input.public_key);
                    if derived.is_none() || derived.unwrap() != output.address {
                        return Json(
                            serde_json::json!({"status": "error", "message": "Input signature does not match UTXO owner"}),
                        );
                    }
                }
                None => {
                    return Json(
                        serde_json::json!({"status": "error", "message": format!("UTXO not found: {}", key)}),
                    );
                }
            }
        }
    }

    // 3. Add to mempool via unified pipeline (metrics + broadcast)
    match state.process_transaction(tx) {
        Ok(()) => Json(serde_json::json!({"status": "ok", "tx_id": tx_id})),
        Err(e) => Json(serde_json::json!({"status": "error", "message": e})),
    }
}

pub async fn submit_block(
    AxumState(state): AxumState<State>,
    Json(block): Json<Block>,
) -> Json<serde_json::Value> {
    println!(
        "RPC: submit_block received height={} hash={} txs={}",
        block.height(),
        block.calculate_hash(),
        block.transactions.len()
    );

    match state.process_block(block) {
        Ok((height, hash)) => {
            Json(serde_json::json!({"status": "ok", "height": height, "hash": hash}))
        }
        Err(e) => Json(serde_json::json!({"status": "error", "message": e})),
    }
}

pub async fn get_premine_list() -> Json<Vec<serde_json::Value>> {
    let all = premine::get_all_premine_addresses();
    let list = all
        .iter()
        .map(|addr| {
            serde_json::json!({
                "address": addr.address,
                "purpose": addr.purpose,
                "amount_atomic": addr.amount,
                "amount_zion": addr.amount / 1_000_000,
                "category": addr.category,
                "unlock_height": addr.unlock_height,
            })
        })
        .collect();
    Json(list)
}

// --- REST-style API handlers ---

pub async fn get_block_by_hash_rest(
    AxumState(state): AxumState<State>,
    Path(hash): Path<String>,
) -> Json<serde_json::Value> {
    match state.storage.get_block(&hash) {
        Ok(Some(block)) => Json(serde_json::json!({
            "status": "ok",
            "block": block
        })),
        Ok(None) => Json(serde_json::json!({
            "status": "error",
            "message": "Block not found"
        })),
        Err(e) => Json(serde_json::json!({
            "status": "error",
            "message": format!("Storage error: {}", e)
        })),
    }
}

pub async fn get_block_by_height_rest(
    AxumState(state): AxumState<State>,
    Path(height): Path<u64>,
) -> Json<serde_json::Value> {
    match state.storage.get_block_by_height(height) {
        Ok(Some(block)) => Json(serde_json::json!({
            "status": "ok",
            "block": block
        })),
        Ok(None) => Json(serde_json::json!({
            "status": "error",
            "message": "Block not found"
        })),
        Err(e) => Json(serde_json::json!({
            "status": "error",
            "message": format!("Storage error: {}", e)
        })),
    }
}

/// GET /api/blocks/range/:start/:end — batch block headers in one read txn
pub async fn get_blocks_range_rest(
    AxumState(state): AxumState<State>,
    Path((start, end)): Path<(u64, u64)>,
) -> Json<serde_json::Value> {
    match state.storage.get_blocks_in_range(start, end) {
        Ok(blocks) => {
            let headers: Vec<serde_json::Value> = blocks
                .iter()
                .map(|b| {
                    serde_json::json!({
                        "height": b.height(),
                        "hash": b.calculate_hash(),
                        "prev_hash": b.header.prev_hash,
                        "timestamp": b.header.timestamp,
                        "difficulty": b.header.difficulty,
                        "nonce": b.header.nonce,
                        "version": b.header.version,
                        "num_txes": b.transactions.len(),
                        "reward": b.transactions.first()
                            .and_then(|tx| tx.outputs.first())
                            .map(|o| o.amount)
                            .unwrap_or(0),
                    })
                })
                .collect();
            Json(serde_json::json!({
                "status": "ok",
                "count": headers.len(),
                "headers": headers
            }))
        }
        Err(e) => Json(serde_json::json!({
            "status": "error",
            "message": format!("Storage error: {}", e)
        })),
    }
}

pub async fn get_tx_rest(
    AxumState(state): AxumState<State>,
    Path(txid): Path<String>,
) -> Json<serde_json::Value> {
    // Check mempool first
    if let Some(tx) = state.mempool.get_transaction(&txid) {
        return Json(serde_json::json!({
            "status": "ok",
            "tx": tx,
            "in_mempool": true
        }));
    }

    // Check storage via tx->block index
    match state.storage.get_block_hash_for_tx(&txid) {
        Ok(Some(block_hash)) => match state.storage.get_block(&block_hash) {
            Ok(Some(block)) => {
                let tx = block.transactions.into_iter().find(|t| t.id == txid);
                match tx {
                    Some(found) => Json(serde_json::json!({
                        "status": "ok",
                        "tx": found,
                        "in_mempool": false,
                        "block_hash": block_hash
                    })),
                    None => Json(serde_json::json!({
                        "status": "error",
                        "message": "Transaction not found in block"
                    })),
                }
            }
            Ok(None) => Json(serde_json::json!({
                "status": "error",
                "message": "Block not found"
            })),
            Err(e) => Json(serde_json::json!({
                "status": "error",
                "message": format!("Storage error: {}", e)
            })),
        },
        Ok(None) => Json(serde_json::json!({
            "status": "error",
            "message": "Transaction not found"
        })),
        Err(e) => Json(serde_json::json!({
            "status": "error",
            "message": format!("Storage error: {}", e)
        })),
    }
}

pub async fn get_mempool_info_rest(AxumState(state): AxumState<State>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "size": state.mempool.size(),
        "transactions": state.mempool.get_all().iter().map(|tx| &tx.id).collect::<Vec<_>>()
    }))
}

#[derive(Deserialize)]
pub struct PaginationParams {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

pub async fn get_address_balance_rest(
    AxumState(state): AxumState<State>,
    Path(address): Path<String>,
) -> Json<serde_json::Value> {
    match state.storage.get_balance_for_address(&address) {
        Ok((total, count)) => Json(serde_json::json!({
            "status": "ok",
            "address": address,
            "utxo_count": count,
            "balance_atomic": total,
            "balance_zion": (total as f64) / 1_000_000.0,
        })),
        Err(e) => Json(serde_json::json!({
            "status": "error",
            "message": format!("Storage error: {}", e)
        })),
    }
}

pub async fn get_address_utxos_rest(
    AxumState(state): AxumState<State>,
    Path(address): Path<String>,
    Query(params): Query<PaginationParams>,
) -> Json<serde_json::Value> {
    let limit = params.limit.unwrap_or(100).clamp(1, 500);
    let offset = params.offset.unwrap_or(0);

    match state.storage.get_utxos_for_address(&address, limit, offset) {
        Ok(utxos) => {
            let list: Vec<serde_json::Value> = utxos
                .into_iter()
                .map(|(key, output)| {
                    let mut entry = serde_json::json!({
                        "key": key,
                        "amount": output.amount,
                        "amount_atomic": output.amount,
                        "amount_zion": output.amount / 1_000_000,
                        "address": output.address,
                    });
                    if let Some(m) = &output.memo {
                        entry["memo"] = serde_json::Value::String(m.clone());
                    }
                    entry
                })
                .collect();
            Json(serde_json::json!({
                "status": "ok",
                "address": address,
                "count": list.len(),
                "limit": limit,
                "offset": offset,
                "utxos": list,
            }))
        }
        Err(e) => Json(serde_json::json!({
            "status": "error",
            "message": format!("Storage error: {}", e)
        })),
    }
}

/// GET /api/sync/status — IBD / sync progress (no State needed, reads global)
pub async fn get_sync_status_rest() -> Json<serde_json::Value> {
    let snap = crate::p2p::get_sync_status().to_json();
    Json(serde_json::json!({
        "status": "ok",
        "sync": snap,
    }))
}

// ─── Bridge Unlock Endpoint (B-01) ──────────────────────────────────────────

/// Request body for POST /api/bridge/unlock
#[derive(Debug, Deserialize)]
pub struct BridgeUnlockRequest {
    /// ZION L1 recipient address (e.g. \"zion1q...\")
    pub recipient: String,
    /// Amount to unlock in atomic units (1 ZION = 1_000_000 atomic)
    pub amount_atomic: u64,
    /// EVM burn transaction hash (proof of burn, stored for audit)
    pub evm_tx_hash: String,
    /// EVM burn ID from ZIONBridge contract
    pub burn_id: String,
    /// EVM chain name (e.g. \"base\", \"base-sepolia\")
    pub evm_chain: String,
    /// Bridge relay validator identifier
    pub validator_id: String,
}

/// POST /api/bridge/unlock
///
/// Called by the bridge relay after a confirmed wZION burn on EVM.
/// Reads the bridge vault private key from `ZION_BRIDGE_VAULT_KEY` env var
/// (64-char hex = 32-byte Ed25519 secret), creates a signed ZION TX from
/// the vault to the recipient, and submits it to the L1 mempool.
///
/// Environment variables:
/// - `ZION_BRIDGE_VAULT_KEY` — 64-char hex Ed25519 secret key of bridge vault
///   If unset, returns 503 (bridge unlock not configured).
///
/// Authentication: Bearer token via ZION_RPC_TOKEN (if set).
pub async fn bridge_unlock(
    AxumState(state): AxumState<State>,
    Json(req): Json<BridgeUnlockRequest>,
) -> Json<serde_json::Value> {
    // ── 1. Read vault key from env ────────────────────────────────────────
    let vault_key_hex = match std::env::var("ZION_BRIDGE_VAULT_KEY").ok() {
        Some(k) if k.len() == 64 => k,
        Some(_) => {
            return Json(serde_json::json!({
                "status": "error",
                "message": "ZION_BRIDGE_VAULT_KEY must be exactly 64 hex chars (32 bytes)"
            }));
        }
        None => {
            return Json(serde_json::json!({
                "status": "error",
                "message": "Bridge unlock not configured: ZION_BRIDGE_VAULT_KEY not set"
            }));
        }
    };

    let vault_key_bytes: [u8; 32] = match keys::from_hex(&vault_key_hex)
        .and_then(|b| b.try_into().ok())
    {
        Some(b) => b,
        None => {
            return Json(serde_json::json!({
                "status": "error",
                "message": "ZION_BRIDGE_VAULT_KEY is not valid hex"
            }));
        }
    };

    // ── 2. Derive vault address ───────────────────────────────────────────
    let signing_key = SigningKey::from_bytes(&vault_key_bytes);
    let public_key_bytes = signing_key.verifying_key();
    let public_key_hex = to_hex(public_key_bytes.as_bytes());
    let vault_address =
        keys::zion1_address_from_public_key_bytes(public_key_bytes.as_bytes());

    // ── 3. Validate request ───────────────────────────────────────────────
    if !keys::is_valid_zion1_address_format(&req.recipient) {
        return Json(serde_json::json!({
            "status": "error",
            "message": format!("Invalid recipient address: {}", req.recipient)
        }));
    }
    if req.amount_atomic == 0 {
        return Json(serde_json::json!({
            "status": "error",
            "message": "amount_atomic must be > 0"
        }));
    }

    // ── 4. Fetch vault UTXOs ──────────────────────────────────────────────
    let utxos = match state.storage.get_utxos_for_address(&vault_address, 200, 0) {
        Ok(u) => u,
        Err(e) => {
            return Json(serde_json::json!({
                "status": "error",
                "message": format!("Storage error fetching vault UTXOs: {}", e)
            }));
        }
    };

    // ── 5. Coin selection (largest-first) ─────────────────────────────────
    // Estimate fee: 1 input, 2 outputs ≈ 600 bytes × 1 atomic/byte = 600 atomic
    let fee_atomic: u64 = 1_000; // conservative flat fee for bridge TX
    let needed = req.amount_atomic.saturating_add(fee_atomic);

    let mut sorted_utxos = utxos;
    sorted_utxos.sort_by(|a, b| b.1.amount.cmp(&a.1.amount)); // largest first

    let mut selected: Vec<(String, TxOutput)> = Vec::new();
    let mut total_in: u64 = 0;
    for utxo in sorted_utxos {
        selected.push(utxo);
        total_in = selected.iter().map(|u| u.1.amount).sum();
        if total_in >= needed {
            break;
        }
    }

    if total_in < needed {
        return Json(serde_json::json!({
            "status": "error",
            "message": format!(
                "Insufficient vault balance: have {} atomic, need {} atomic (amount {} + fee {})",
                total_in, needed, req.amount_atomic, fee_atomic
            )
        }));
    }

    let change = total_in - req.amount_atomic - fee_atomic;

    // ── 6. Build transaction ──────────────────────────────────────────────
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let inputs: Vec<TxInput> = selected
        .iter()
        .map(|(key, _)| {
            // key format: "{tx_hash}:{output_index}"
            let parts: Vec<&str> = key.rsplitn(2, ':').collect();
            let (output_index, prev_tx_hash) = if parts.len() == 2 {
                let idx = parts[0].parse::<u32>().unwrap_or(0);
                (idx, parts[1].to_string())
            } else {
                (0u32, key.clone())
            };
            TxInput {
                prev_tx_hash,
                output_index,
                signature: String::new(), // filled after hash
                public_key: public_key_hex.clone(),
            }
        })
        .collect();

    let mut outputs = vec![TxOutput {
        amount: req.amount_atomic,
        address: req.recipient.clone(),
        memo: None,
    }];
    if change > 0 {
        outputs.push(TxOutput {
            amount: change,
            address: vault_address.clone(),
            memo: None,
        });
    }

    let mut tx = Transaction {
        id: String::new(),
        version: 1,
        inputs,
        outputs,
        fee: fee_atomic,
        timestamp,
    };

    let tx_hash = tx.calculate_hash();
    tx.id = tx_hash.clone();

    // ── 7. Sign each input ────────────────────────────────────────────────
    let msg_bytes = match keys::from_hex(&tx_hash) {
        Some(b) => b,
        None => {
            return Json(serde_json::json!({
                "status": "error",
                "message": "Failed to decode tx hash for signing"
            }));
        }
    };

    for input in &mut tx.inputs {
        let sig = signing_key.sign(&msg_bytes);
        input.signature = to_hex(&sig.to_bytes());
    }

    // ── 8. Self-verify ────────────────────────────────────────────────────
    if !tx.verify_signatures() {
        return Json(serde_json::json!({
            "status": "error",
            "message": "Bridge TX self-verification failed — key mismatch"
        }));
    }

    // ── 9. Log and submit to mempool ──────────────────────────────────────
    println!(
        "🌉 Bridge unlock: {} atomic → {} | burn_id={} evm_chain={} validator={}",
        req.amount_atomic, req.recipient, req.burn_id, req.evm_chain, req.validator_id,
    );

    match state.process_transaction(tx) {
        Ok(()) => Json(serde_json::json!({
            "status": "submitted",
            "tx_hash": tx_hash,
            "recipient": req.recipient,
            "amount_atomic": req.amount_atomic,
            "vault_address": vault_address,
            "fee_atomic": fee_atomic,
            "burn_id": req.burn_id,
            "evm_chain": req.evm_chain,
        })),
        Err(e) => Json(serde_json::json!({
            "status": "error",
            "message": format!("Mempool rejected bridge TX: {}", e)
        })),
    }
}

// ─── Atomic Swap Escrow Endpoint (S-00) ─────────────────────────────────────

/// GET /api/swap/escrow-address
///
/// Returns the L1 escrow address that users should send locked ZION to when
/// initiating an atomic swap.  The address is derived from the
/// `ZION_SWAP_ESCROW_KEY` environment variable (same pattern as bridge vault).
///
/// Memo format for the LOCK transaction:
///   `SWAP:LOCK:<hash64hex>:<timeout_minutes>:<chain>:<counterparty_address>`
///
/// Example:
///   `SWAP:LOCK:abcd...64chars...:120:btc:bc1qalicebtcaddress`
pub async fn swap_escrow_address() -> Json<serde_json::Value> {
    let key_hex = match std::env::var("ZION_SWAP_ESCROW_KEY").ok() {
        Some(k) if k.len() == 64 => k,
        _ => {
            return Json(serde_json::json!({
                "status": "error",
                "message": "ZION_SWAP_ESCROW_KEY not configured on this node"
            }));
        }
    };

    let key_bytes: [u8; 32] = match keys::from_hex(&key_hex)
        .and_then(|b| b.try_into().ok())
    {
        Some(b) => b,
        None => {
            return Json(serde_json::json!({
                "status": "error",
                "message": "ZION_SWAP_ESCROW_KEY is not valid hex"
            }));
        }
    };

    let signing_key = ed25519_dalek::SigningKey::from_bytes(&key_bytes);
    let public_key_bytes = signing_key.verifying_key();
    let escrow_address =
        keys::zion1_address_from_public_key_bytes(public_key_bytes.as_bytes());

    Json(serde_json::json!({
        "status": "ok",
        "escrow_address": escrow_address,
        "memo_format": "SWAP:LOCK:<hash64hex>:<timeout_min>:<chain>:<counterparty_addr>",
        "example": "SWAP:LOCK:abcd...64chars...:120:btc:bc1qyourbtcaddress",
    }))
}
