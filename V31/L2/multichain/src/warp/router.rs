use crate::warp::db::TransferDb;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::fees::FeeEngine;
use crate::warp::metrics::WarpMetrics;
use crate::warp::protocol::{parse_warp_memo, DepositProof};
use crate::warp::registry::ChainRegistry;
use crate::warp::state::TransferStateMachine;
use crate::warp::types::{ChainId, WarpStatus, WarpTransfer};
use crate::warp::validator::WarpValidatorSet;
use crate::warp::xp_bridge::WarpXpEvent;

use serde_json::Value;
use std::collections::HashMap;
use std::io::Write;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;
use uuid::Uuid;

/// Orchestrates cross-chain transfers end-to-end with optional SQLite persistence.
pub struct WarpRouter {
    pub registry: ChainRegistry,
    pub fee_engine: FeeEngine,
    pub validator_set: Arc<Mutex<WarpValidatorSet>>,
    pub metrics: WarpMetrics,
    pub db: Option<TransferDb>,
    transfers: HashMap<Uuid, WarpTransfer>,
    state_machines: HashMap<Uuid, TransferStateMachine>,
    daily_volume: HashMap<String, u64>,

    /// Maximum daily throughput per chain (flowers).
    pub daily_limit: u64,
    /// Amount threshold for timelock hold.
    pub timelock_threshold: u64,
    /// XP events queued for drain by the orchestration layer.
    xp_events: Vec<WarpXpEvent>,

    /// ZION L1 RPC URL for on-chain deposit proof verification (FIND-008).
    /// When `None`, proof verification is skipped (e.g. in unit tests).
    l1_rpc_url: Option<String>,
    /// Required number of confirmations on ZION L1 for a deposit to be valid.
    l1_finality_blocks: u64,
    /// Bridge vault address that deposits must pay on L1. When `Some` and
    /// L1 verification is enabled, `verify_deposit_proof` requires the
    /// on-chain transaction to pay this address with a matching memo.
    /// `None` skips the vault binding (unit tests).
    pub l1_vault_address: Option<String>,
}

impl WarpRouter {
    pub fn new(
        registry: ChainRegistry,
        fee_engine: FeeEngine,
        validator_set: Arc<Mutex<WarpValidatorSet>>,
    ) -> Self {
        Self::with_options(registry, fee_engine, validator_set, None, 12)
    }

    /// Create a router with ZION L1 verification enabled.
    /// `finality_blocks` is the minimum number of confirmations required
    /// for a `DepositProof` to be accepted in `initiate_outbound`.
    pub fn with_options(
        registry: ChainRegistry,
        fee_engine: FeeEngine,
        validator_set: Arc<Mutex<WarpValidatorSet>>,
        l1_rpc_url: Option<String>,
        finality_blocks: u64,
    ) -> Self {
        Self {
            registry,
            fee_engine,
            validator_set,
            metrics: WarpMetrics::new(),
            db: None,
            transfers: HashMap::new(),
            state_machines: HashMap::new(),
            daily_volume: HashMap::new(),
            daily_limit: 10_000_000_000_000,
            timelock_threshold: 1_000_000_000_000,
            xp_events: Vec::new(),
            l1_rpc_url,
            l1_finality_blocks: finality_blocks,
            l1_vault_address: None,
        }
    }

    /// Create a router with SQLite persistence.
    pub fn with_db(
        registry: ChainRegistry,
        fee_engine: FeeEngine,
        validator_set: Arc<Mutex<WarpValidatorSet>>,
        db: TransferDb,
        l1_rpc_url: Option<String>,
        finality_blocks: u64,
    ) -> WarpResult<Self> {
        let mut router = Self::with_options(
            registry,
            fee_engine,
            validator_set,
            l1_rpc_url,
            finality_blocks,
        );
        router.db = Some(db.clone());

        // Load all persisted transfers from DB.
        let stored = db
            .list_all()
            .map_err(|e| WarpError::Internal(format!("failed to load transfers from DB: {e}")))?;

        for t in stored {
            let id = t.id;
            let sm = TransferStateMachine::new(t.status);
            router.transfers.insert(id, t);
            router.state_machines.insert(id, sm);
        }

        // Load persisted daily volumes (FIND-009): seeds in-memory map from DB
        // so limits are enforced correctly after restart.
        for (chain, _) in router.registry.list_all() {
            if let Ok(vol) = db.load_daily_volume(chain) {
                router.daily_volume.insert(chain.clone(), vol);
            }
        }

        info!(
            "[Router] Loaded {} transfer(s) from database",
            router.transfers.len()
        );
        Ok(router)
    }

    /// Persist a transfer to the DB. A `None` DB is a no-op (tests/dev).
    /// A `Some` DB failure is propagated — callers must not publish the
    /// transfer into in-memory state until this returns `Ok`, so memory
    /// can never run ahead of the durable record.
    fn save_transfer(&self, transfer: &WarpTransfer) -> WarpResult<()> {
        if let Some(db) = &self.db {
            db.save(transfer)?;
        }
        Ok(())
    }

    /// Verify a `DepositProof` against the ZION L1 source chain (FIND-008).
    ///
    /// When `l1_rpc_url` is `None` (e.g. unit tests) verification is skipped.
    /// Otherwise the method makes a synchronous JSON-RPC call to the ZION L1
    /// node to confirm the `tx_hash` exists, is confirmed, has enough
    /// confirmations, and — if available — that the on-chain amount and sender
    /// match the proof.
    fn verify_deposit_proof(&self, proof: &DepositProof) -> WarpResult<()> {
        let rpc_url = match &self.l1_rpc_url {
            Some(url) => url,
            None => return Ok(()),
        };

        // Strip scheme + path, same as ZionL1Adapter::clean_rpc_url.
        let addr = {
            let s = rpc_url.trim();
            let s = s
                .strip_prefix("http://")
                .or(s.strip_prefix("https://"))
                .unwrap_or(s);
            s.split_once('/').map(|(h, _)| h).unwrap_or(s)
        };

        // --- getTransaction -------------------------------------------------
        let tx_info: serde_json::Value = match self.rpc_call_sync(
            addr,
            "getTransaction",
            serde_json::json!({"txid": &proof.tx_hash}),
        ) {
            Ok(v) => v,
            Err(e) => {
                return Err(WarpError::Validation(format!(
                    "deposit proof verification failed: getTransaction error: {e}"
                )))
            }
        };

        // Verify the transaction exists and is confirmed.
        if !tx_info
            .get("confirmed")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Err(WarpError::Validation(format!(
                "deposit proof verification failed: tx {} not confirmed",
                proof.tx_hash
            )));
        }

        let block_height = tx_info
            .get("block_height")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| {
                WarpError::Validation("getTransaction response missing block_height".into())
            })?;

        // --- getChainInfo ---------------------------------------------------
        let chain_info: serde_json::Value =
            match self.rpc_call_sync(addr, "getChainInfo", serde_json::json!([])) {
                Ok(v) => v,
                Err(e) => {
                    return Err(WarpError::Validation(format!(
                        "deposit proof verification failed: getChainInfo error: {e}"
                    )))
                }
            };

        let tip = chain_info
            .get("chain_height")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| {
                WarpError::Validation("getChainInfo response missing chain_height".into())
            })?;

        let confirmations = tip.saturating_sub(block_height) + 1;
        if confirmations < self.l1_finality_blocks {
            return Err(WarpError::FinalityNotReached {
                chain: "zion-l1".into(),
                confirmations,
                required: self.l1_finality_blocks,
            });
        }

        // Cross-check the proof fields against the on-chain transaction body.
        // Without these, any confirmed tx (e.g. a payment to oneself) could be
        // presented as a bridge deposit with a fabricated memo/recipient.
        let tx = tx_info.get("transaction").cloned().unwrap_or(Value::Null);

        // Sender binding: account-model txs expose `from`; reject a proof
        // whose claimed sender does not match what is on-chain.
        if let Some(from) = tx.get("from").and_then(|v| v.as_str()) {
            if from != proof.sender {
                return Err(WarpError::Validation(format!(
                    "deposit proof sender mismatch: proof={} on-chain={}",
                    proof.sender, from
                )));
            }
        }

        // Memo binding: the on-chain memo must equal the supplied proof memo
        // (it carries the `WARP:<ver>:<chain>:<recipient>` routing). UTXO txs
        // serialize `memo` as a byte array; tolerate string forms as well.
        let onchain_memo = Self::json_memo_bytes(tx.get("memo"));
        if let Some(bytes) = onchain_memo {
            if bytes != proof.memo.as_bytes() {
                return Err(WarpError::Validation(
                    "deposit proof memo does not match on-chain transaction memo".into(),
                ));
            }
        } else if !proof.memo.is_empty() {
            return Err(WarpError::Validation(
                "deposit proof supplies a memo but the on-chain transaction has none".into(),
            ));
        }

        // Vault + amount binding (fail-closed when a vault is configured).
        if let Some(vault) = &self.l1_vault_address {
            let paid = Self::vault_payment_amount(&tx, vault);
            if paid == 0 {
                return Err(WarpError::Validation(format!(
                    "deposit tx {} does not pay the bridge vault {vault}",
                    proof.tx_hash
                )));
            }
            if paid < proof.amount_flowers as u128 {
                return Err(WarpError::Validation(format!(
                    "deposit proof amount mismatch: proof={} on-chain vault payment={}",
                    proof.amount_flowers, paid
                )));
            }
        } else if let Some(onchain_amt) = Self::tx_declared_amount(&tx) {
            // Vault unset (tests): still bound the claimed amount when the
            // node exposes one, closing the previous dead top-level lookup.
            if onchain_amt < proof.amount_flowers as u128 {
                return Err(WarpError::Validation(format!(
                    "deposit proof amount mismatch: proof={} on-chain={}",
                    proof.amount_flowers, onchain_amt
                )));
            }
        }

        Ok(())
    }

    /// Extract memo bytes from a serialized tx `memo` field.
    /// `Vec<u8>` serializes as a JSON number array; accept UTF-8/hex strings too.
    fn json_memo_bytes(v: Option<&Value>) -> Option<Vec<u8>> {
        match v? {
            Value::Array(items) => Some(
                items
                    .iter()
                    .filter_map(|b| b.as_u64().map(|n| n as u8))
                    .collect(),
            ),
            Value::String(s) => hex::decode(s.strip_prefix("0x").unwrap_or(s))
                .ok()
                .or_else(|| Some(s.as_bytes().to_vec())),
            _ => None,
        }
    }

    /// Sum of tx amounts paid to `vault` (flowers). Handles account-model
    /// (`to`/`amount_zion`) and UTXO-model (`outputs[].address.encoded`) txs.
    fn vault_payment_amount(tx: &Value, vault: &str) -> u128 {
        if tx.get("to").and_then(|v| v.as_str()) == Some(vault) {
            return tx
                .get("amount_zion")
                .or_else(|| tx.get("amount_flowers"))
                .and_then(Self::json_u128)
                .unwrap_or(0);
        }
        tx.get("outputs")
            .and_then(|v| v.as_array())
            .map(|outs| {
                outs.iter()
                    .filter(|o| {
                        o.get("address").and_then(|a| {
                            a.get("encoded")
                                .and_then(|e| e.as_str())
                                .or_else(|| a.as_str())
                        }) == Some(vault)
                    })
                    .filter_map(|o| o.get("amount").and_then(Self::json_u128))
                    .sum()
            })
            .unwrap_or(0)
    }

    /// Declared tx amount regardless of recipient (fallback amount check).
    fn tx_declared_amount(tx: &Value) -> Option<u128> {
        tx.get("amount_zion")
            .or_else(|| tx.get("amount_flowers"))
            .and_then(Self::json_u128)
            .or_else(|| {
                tx.get("outputs").and_then(|v| v.as_array()).map(|outs| {
                    outs.iter()
                        .filter_map(|o| o.get("amount").and_then(Self::json_u128))
                        .sum()
                })
            })
    }

    /// Parse a JSON value as u128 (number or decimal string).
    fn json_u128(v: &Value) -> Option<u128> {
        v.as_u64()
            .map(|n| n as u128)
            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
    }

    /// Perform a synchronous JSON-RPC call over raw TCP (newline-delimited JSON).
    /// Returns the `result` object from the response envelope.
    fn rpc_call_sync(
        &self,
        addr: &str,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let request_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(1);

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        });

        let mut stream = std::net::TcpStream::connect(addr)
            .map_err(|e| format!("connect to {addr} failed: {e}"))?;

        let payload = format!("{body}\n");
        stream
            .write_all(payload.as_bytes())
            .map_err(|e| format!("write to {addr} failed: {e}"))?;
        stream
            .flush()
            .map_err(|e| format!("flush to {addr} failed: {e}"))?;

        use std::io::BufRead;
        let timeout = std::time::Duration::from_secs(10);
        stream
            .set_read_timeout(Some(timeout))
            .map_err(|e| format!("set_read_timeout failed: {e}"))?;

        let mut reader = std::io::BufReader::new(stream);
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .map_err(|e| format!("read from {addr} failed: {e}"))?;

        let resp: serde_json::Value = serde_json::from_str(line.trim())
            .map_err(|e| format!("decode response for {method}: {e}. body: {line:.200}"))?;

        if let Some(err) = resp.get("error") {
            return Err(format!(
                "rpc {method} returned error: {}",
                serde_json::to_string(err).unwrap_or_default()
            ));
        }

        match resp.get("result") {
            Some(result) => Ok(result.clone()),
            None => Err(format!("rpc {method} response has no result field")),
        }
    }

    /// Process an outbound transfer (ZION L1 → external chain).
    pub fn initiate_outbound(&mut self, proof: DepositProof) -> WarpResult<Uuid> {
        // 0. Verify deposit proof against ZION L1 source chain (FIND-008).
        self.verify_deposit_proof(&proof)?;

        // 0b. Replay protection: one L1 deposit tx = one transfer. Persisted
        // transfers reload into `transfers`, so this survives restarts.
        if self
            .transfers
            .values()
            .any(|t| t.source_tx_hash.as_deref() == Some(proof.tx_hash.as_str()))
        {
            return Err(WarpError::Validation(format!(
                "deposit tx {} already used for a WARP transfer",
                proof.tx_hash
            )));
        }

        // 1. Parse memo
        let (chain_name, recipient) = parse_warp_memo(&proof.memo)?;

        // 2. Validate destination chain
        let dest_chain = self.registry.get(&chain_name)?.clone();
        let source_chain = ChainId::zion_l1();

        // 3. Check daily limit
        let current_volume = self.daily_volume.get(&chain_name).copied().unwrap_or(0);
        if current_volume + proof.amount_flowers > self.daily_limit {
            return Err(WarpError::DailyLimitExceeded {
                amount: proof.amount_flowers,
                limit: self.daily_limit,
            });
        }

        // 4. Calculate fee
        let fee = self
            .fee_engine
            .calculate_fee(&chain_name, proof.amount_flowers)?;

        // 5. Create transfer
        let mut transfer = WarpTransfer::new(
            source_chain,
            dest_chain,
            proof.sender.clone(),
            recipient,
            proof.amount_flowers,
            fee,
            proof.memo.clone(),
        );
        transfer.source_tx_hash = Some(proof.tx_hash.clone());

        let transfer_id = transfer.id;

        // 6. Check timelock on GROSS amount (before fee subtraction) — FIND-010
        if proof.amount_flowers > self.timelock_threshold {
            transfer.status = WarpStatus::TimelockHold;
            info!(
                transfer_id = %transfer_id,
                amount = proof.amount_flowers,
                "Transfer exceeds timelock threshold (gross) — entering 24h hold"
            );
        } else {
            transfer.status = WarpStatus::Detected;
        }

        // 7. Persist BEFORE publishing into in-memory state — the durable
        //    record must exist before the transfer becomes executable, so a
        //    crash can never strand a transfer the router has accepted.
        //    The transfer row and the daily-cap increment commit in ONE
        //    transaction (4.B3): a crash can never leave a durable
        //    transfer the cap failed to count.
        if let Some(db) = &self.db {
            db.save_and_record_daily_volume(&transfer, &chain_name, proof.amount_flowers)?;
        }

        let sm = TransferStateMachine::new(transfer.status);
        self.transfers.insert(transfer_id, transfer.clone());
        self.state_machines.insert(transfer_id, sm);
        *self.daily_volume.entry(chain_name.clone()).or_insert(0) += proof.amount_flowers;

        self.metrics.record_transfer_initiated();
        info!(transfer_id = %transfer_id, "Outbound WARP transfer initiated");

        Ok(transfer_id)
    }

    /// Process an inbound transfer (external chain → ZION L1).
    pub fn initiate_inbound(
        &mut self,
        source_chain_name: &str,
        proof: DepositProof,
        recipient_zion: &str,
    ) -> WarpResult<Uuid> {
        let source_chain = self.registry.get(source_chain_name)?.clone();
        let dest_chain = ChainId::zion_l1();

        // Replay protection: one source-chain burn = one inbound transfer.
        // The L1 also dedupes unlocks on `burn_id` at consensus, but zombie
        // transfers must not be creatable via `/transfers/inbound` (which
        // bypasses the watcher's seen_txs). Keyed on burn_id when present —
        // one tx may emit several distinct burns — and on tx_hash for
        // chains without a dedicated burn identifier.
        let is_dup = self.transfers.values().any(|t| {
            if t.source_chain.name != source_chain.name {
                return false;
            }
            let burn_ids_match = match (&t.burn_id, &proof.burn_id) {
                (Some(a), Some(b)) => a == b,
                _ => false,
            };
            // tx_hash dedup applies unless the stored transfer carries a
            // real (non-fallback) burn_id — multi-burn txs stay allowed —
            // and the new proof supplies one too. A proof without burn_id
            // is ambiguous and always collides on tx_hash.
            let stored_uses_fallback = t.burn_id.as_deref() == t.source_tx_hash.as_deref();
            let tx_match = (stored_uses_fallback || proof.burn_id.is_none())
                && t.source_tx_hash.as_deref() == Some(proof.tx_hash.as_str());
            burn_ids_match || tx_match
        });
        if is_dup {
            return Err(WarpError::Validation(format!(
                "burn {:?} on {source_chain_name} already used for a WARP transfer",
                proof.burn_id.as_deref().unwrap_or(proof.tx_hash.as_str())
            )));
        }

        let fee = self
            .fee_engine
            .calculate_fee(source_chain_name, proof.amount_flowers)?;

        let mut transfer = WarpTransfer::new(
            source_chain,
            dest_chain,
            proof.sender.clone(),
            recipient_zion.to_string(),
            proof.amount_flowers,
            fee,
            format!("WARP_INBOUND:{}:{}", source_chain_name, recipient_zion),
        );
        transfer.source_tx_hash = Some(proof.tx_hash.clone());
        // burn_id comes from the source event (EVM BridgeBurn topic); fall
        // back to the tx hash — the L1 replay key just needs a stable unique
        // identifier: `{source_chain}:{burn_id}:{tx_hash}`.
        transfer.burn_id = proof
            .burn_id
            .clone()
            .or_else(|| Some(proof.tx_hash.clone()));
        transfer.status = WarpStatus::Detected;

        let transfer_id = transfer.id;

        // Persist before publishing into in-memory state (same ordering as
        // initiate_outbound — no executable transfer without a durable row).
        self.save_transfer(&transfer)?;

        let sm = TransferStateMachine::new(transfer.status);
        self.transfers.insert(transfer_id, transfer.clone());
        self.state_machines.insert(transfer_id, sm);

        self.metrics.record_transfer_initiated();
        info!(transfer_id = %transfer_id, "Inbound WARP transfer initiated");

        Ok(transfer_id)
    }

    /// Advance a transfer to the next state.
    ///
    /// The transition is validated and applied on candidate clones and
    /// persisted *first*; only after the DB write succeeds are the
    /// in-memory maps swapped. A persistence failure leaves memory, DB,
    /// XP events and metrics all at the previous state.
    pub fn advance_transfer(&mut self, id: Uuid, new_status: WarpStatus) -> WarpResult<()> {
        let mut sm = self
            .state_machines
            .get(&id)
            .cloned()
            .ok_or_else(|| WarpError::TransferNotFound(id.to_string()))?;
        sm.transition(new_status)?;

        let mut candidate = self
            .transfers
            .get(&id)
            .cloned()
            .ok_or_else(|| WarpError::TransferNotFound(id.to_string()))?;
        candidate.status = new_status;
        candidate.updated_at = chrono::Utc::now();

        self.save_transfer(&candidate)?;

        self.state_machines.insert(id, sm);
        self.transfers.insert(id, candidate.clone());

        if new_status == WarpStatus::Completed {
            self.metrics.record_transfer_completed();
            // Emit XP event for AI-native bridge
            self.xp_events.push(WarpXpEvent::from_transfer(&candidate));
        } else if new_status == WarpStatus::Failed {
            self.metrics.record_transfer_failed();
        }

        Ok(())
    }

    /// Record the destination-chain tx hash (persisted) for a transfer.
    /// Used by the inbound releaser after `submitBridgeUnlock` is accepted.
    /// Persists a candidate clone first so a DB failure leaves the stored
    /// transfer untouched and the caller can retry safely.
    pub fn set_dest_tx(&mut self, id: &Uuid, tx_hash: String) -> WarpResult<()> {
        let mut candidate = self
            .transfers
            .get(id)
            .cloned()
            .ok_or_else(|| WarpError::TransferNotFound(id.to_string()))?;
        candidate.dest_tx_hash = Some(tx_hash);
        candidate.updated_at = chrono::Utc::now();
        self.save_transfer(&candidate)?;
        self.transfers.insert(*id, candidate);
        Ok(())
    }

    pub fn get_transfer(&self, id: &Uuid) -> Option<&WarpTransfer> {
        self.transfers.get(id)
    }

    /// Get mutable reference to a transfer (for updating dest_tx_hash, etc.)
    pub fn get_transfer_mut(&mut self, id: &Uuid) -> Option<&mut WarpTransfer> {
        self.transfers.get_mut(id)
    }

    /// List all transfers, most recent first.
    pub fn list_transfers(&self) -> Vec<WarpTransfer> {
        let mut v: Vec<WarpTransfer> = self.transfers.values().cloned().collect();
        v.sort_by_key(|b| std::cmp::Reverse(b.created_at));
        v
    }

    /// List pending (non-terminal) transfers.
    pub fn list_pending(&self) -> Vec<WarpTransfer> {
        self.transfers
            .values()
            .filter(|t| !matches!(t.status, WarpStatus::Completed | WarpStatus::Failed))
            .cloned()
            .collect()
    }

    pub fn transfer_count(&self) -> usize {
        self.transfers.len()
    }

    pub fn pending_count(&self) -> usize {
        self.transfers
            .values()
            .filter(|t| !matches!(t.status, WarpStatus::Completed | WarpStatus::Failed))
            .count()
    }

    /// Drain and return all accumulated XP events (empties the internal queue).
    /// Caller should forward these to `ConsciousnessEngine::add_xp()`.
    pub fn drain_xp_events(&mut self) -> Vec<WarpXpEvent> {
        std::mem::take(&mut self.xp_events)
    }

    /// Reset daily volume counters (should be called at midnight UTC).
    pub fn reset_daily_volumes(&mut self) {
        self.daily_volume.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::fees::FeeEngine;
    use crate::warp::validator::WarpValidatorSet;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    fn test_router() -> WarpRouter {
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        WarpRouter::new(
            ChainRegistry::with_defaults(),
            FeeEngine::with_defaults(),
            validator_set,
        )
    }

    /// Router with proof verification enabled but pointing at a non-listening
    /// port so the verification step fails fast (used to exercise the rejection path).
    fn test_router_with_rpc(rpc_url: &str) -> WarpRouter {
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        WarpRouter::with_options(
            ChainRegistry::with_defaults(),
            FeeEngine::with_defaults(),
            validator_set,
            Some(rpc_url.to_string()),
            12,
        )
    }

    fn test_deposit(amount: u64, memo: &str) -> DepositProof {
        DepositProof {
            tx_hash: "tx_abc123".into(),
            block_height: 1000,
            block_hash: "block_def".into(),
            sender: "zion1sender".into(),
            amount_flowers: amount,
            memo: memo.into(),
            confirmations: 60,
            burn_id: None,
        }
    }

    #[test]
    fn test_outbound_transfer_basic() {
        let mut router = test_router();
        let proof = test_deposit(1_000_000, "WARP:1:solana:7xKXtg2CW87d97T");
        let id = router.initiate_outbound(proof).unwrap();
        let t = router.get_transfer(&id).unwrap();
        assert_eq!(t.status, WarpStatus::Detected);
        assert!(t.fee_flowers > 0);
    }

    #[test]
    fn test_outbound_rejects_duplicate_tx_hash() {
        let mut router = test_router();
        let proof = test_deposit(1_000_000, "WARP:1:solana:7xKXtg2CW87d97T");
        router.initiate_outbound(proof.clone()).unwrap();
        // Same L1 deposit tx must not mint a second transfer.
        assert!(router.initiate_outbound(proof).is_err());
    }

    #[test]
    fn test_json_memo_bytes_array_and_string() {
        let arr = serde_json::json!([87, 65, 82, 80]);
        assert_eq!(
            WarpRouter::json_memo_bytes(Some(&arr)).as_deref(),
            Some(b"WARP".as_slice())
        );
        let s = serde_json::json!("WARP:1:base:0xR");
        assert_eq!(
            WarpRouter::json_memo_bytes(Some(&s)).as_deref(),
            Some(b"WARP:1:base:0xR".as_slice())
        );
        assert!(WarpRouter::json_memo_bytes(Some(&serde_json::json!(null))).is_none());
    }

    #[test]
    fn test_vault_payment_amount_utxo_outputs() {
        let vault = "zion1warp_vault";
        let tx = serde_json::json!({
            "outputs": [
                {"amount": 500, "address": {"encoded": "zion1other"}},
                {"amount": 300, "address": {"encoded": vault}},
                {"amount": 200, "address": {"encoded": vault}}
            ]
        });
        assert_eq!(WarpRouter::vault_payment_amount(&tx, vault), 500);
        assert_eq!(WarpRouter::vault_payment_amount(&tx, "zion1none"), 0);
    }

    #[test]
    fn test_vault_payment_amount_account_tx() {
        let vault = "zion1warp_vault";
        let tx = serde_json::json!({
            "to": vault,
            "amount_zion": "1000000"
        });
        assert_eq!(WarpRouter::vault_payment_amount(&tx, vault), 1_000_000);
        // `to` is someone else → zero vault payment.
        let tx2 = serde_json::json!({"to": "zion1self", "amount_zion": "1000000"});
        assert_eq!(WarpRouter::vault_payment_amount(&tx2, vault), 0);
    }

    #[test]
    fn test_outbound_transfer_timelock() {
        let mut router = test_router();
        router.timelock_threshold = 500_000; // 0.5 ZION
        let proof = test_deposit(1_000_000, "WARP:1:base:0xRecipient");
        let id = router.initiate_outbound(proof).unwrap();
        let t = router.get_transfer(&id).unwrap();
        assert_eq!(t.status, WarpStatus::TimelockHold);
    }

    #[test]
    fn test_outbound_transfer_daily_limit() {
        let mut router = test_router();
        router.daily_limit = 500_000;
        let proof = test_deposit(1_000_000, "WARP:1:solana:addr");
        assert!(router.initiate_outbound(proof).is_err());
    }

    #[test]
    fn test_outbound_invalid_chain() {
        let mut router = test_router();
        let proof = test_deposit(1_000_000, "WARP:1:nonexistent:addr");
        assert!(router.initiate_outbound(proof).is_err());
    }

    #[test]
    fn test_outbound_invalid_memo() {
        let mut router = test_router();
        let proof = test_deposit(1_000_000, "INVALID_MEMO");
        assert!(router.initiate_outbound(proof).is_err());
    }

    #[test]
    fn test_inbound_transfer_basic() {
        let mut router = test_router();
        let proof = test_deposit(1_000_000_000, "burn_event");
        let id = router
            .initiate_inbound("base", proof, "zion1recipient")
            .unwrap();
        let t = router.get_transfer(&id).unwrap();
        assert_eq!(t.status, WarpStatus::Detected);
    }

    #[test]
    fn test_inbound_rejects_duplicate_burn() {
        let mut router = test_router();
        // No burn_id → dedup on tx_hash.
        let proof = test_deposit(1_000_000, "burn_event");
        router
            .initiate_inbound("base", proof.clone(), "zion1recipient")
            .unwrap();
        assert!(router
            .initiate_inbound("base", proof, "zion1recipient")
            .is_err());
    }

    #[test]
    fn test_inbound_multiburn_tx_allowed_but_same_burn_rejected() {
        let mut router = test_router();
        // Same tx_hash, two distinct burn_ids → two legitimate burns.
        let mut p1 = test_deposit(1_000_000, "b1");
        p1.burn_id = Some("burn_1".into());
        let mut p2 = test_deposit(2_000_000, "b2");
        p2.burn_id = Some("burn_2".into());
        router
            .initiate_inbound("base", p1.clone(), "zion1r")
            .unwrap();
        router.initiate_inbound("base", p2, "zion1r").unwrap();
        // Replaying burn_1 must fail even with a different amount.
        p1.amount_flowers = 9;
        assert!(router.initiate_inbound("base", p1, "zion1r").is_err());
    }

    #[test]
    fn test_inbound_ambiguous_proof_rejected_on_tx_match() {
        let mut router = test_router();
        // First stored with a real burn_id; a later proof for the same tx
        // WITHOUT burn_id is ambiguous → reject.
        let mut p1 = test_deposit(1_000_000, "b1");
        p1.burn_id = Some("burn_1".into());
        router.initiate_inbound("base", p1, "zion1r").unwrap();
        let p2 = test_deposit(1_000_000, "dup");
        assert!(router.initiate_inbound("base", p2, "zion1r").is_err());
    }

    #[test]
    fn test_advance_transfer() {
        let mut router = test_router();
        let proof = test_deposit(1_000_000, "WARP:1:solana:addr");
        let id = router.initiate_outbound(proof).unwrap();

        router
            .advance_transfer(id, WarpStatus::AwaitingFinality)
            .unwrap();
        assert_eq!(
            router.get_transfer(&id).unwrap().status,
            WarpStatus::AwaitingFinality
        );

        router.advance_transfer(id, WarpStatus::Validating).unwrap();
        router
            .advance_transfer(id, WarpStatus::QuorumReached)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Executing).unwrap();
        router.advance_transfer(id, WarpStatus::Completed).unwrap();

        assert_eq!(
            router.get_transfer(&id).unwrap().status,
            WarpStatus::Completed
        );
    }

    /// 4.B1 bridge smoke: a small round-trip — outbound ZION→chain leg and
    /// the matching inbound chain→ZION leg each driven through the full
    /// lifecycle to `Completed`, leaving the pending set drained.
    #[test]
    fn test_round_trip_outbound_then_inbound_completes() {
        let mut router = test_router();
        let advance_all = |router: &mut WarpRouter, id: Uuid| {
            for status in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
                WarpStatus::Executing,
                WarpStatus::Completed,
            ] {
                router.advance_transfer(id, status).unwrap();
            }
        };

        // Leg 1: ZION lock → wrapped mint on the destination chain.
        let out_proof = test_deposit(1_000_000, "WARP:1:base:0xRT");
        let out_id = router.initiate_outbound(out_proof).unwrap();
        advance_all(&mut router, out_id);

        // Leg 2: burn on the chain → ZION release back to the recipient.
        let mut in_proof = test_deposit(1_000_000, "burn_event");
        in_proof.tx_hash = "chain_tx_rt".into();
        in_proof.burn_id = Some("burn_rt".into());
        let in_id = router
            .initiate_inbound("base", in_proof, "zion1recipient")
            .unwrap();
        advance_all(&mut router, in_id);

        let out = router.get_transfer(&out_id).unwrap();
        let inc = router.get_transfer(&in_id).unwrap();
        assert_eq!(out.status, WarpStatus::Completed);
        assert_eq!(inc.status, WarpStatus::Completed);
        assert_eq!(router.pending_count(), 0);
    }

    #[test]
    fn test_transfer_count() {
        let mut router = test_router();
        assert_eq!(router.transfer_count(), 0);
        let mut proof1 = test_deposit(100_000, "WARP:1:solana:a");
        let mut proof2 = test_deposit(200_000, "WARP:1:base:b");
        proof1.tx_hash = "tx_1".into();
        proof2.tx_hash = "tx_2".into();
        router.initiate_outbound(proof1).unwrap();
        router.initiate_outbound(proof2).unwrap();
        assert_eq!(router.transfer_count(), 2);
    }

    #[test]
    fn test_pending_count() {
        let mut router = test_router();
        let proof = test_deposit(100_000, "WARP:1:solana:a");
        let id = router.initiate_outbound(proof).unwrap();
        assert_eq!(router.pending_count(), 1);
        router
            .advance_transfer(id, WarpStatus::AwaitingFinality)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Validating).unwrap();
        router
            .advance_transfer(id, WarpStatus::QuorumReached)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Executing).unwrap();
        router.advance_transfer(id, WarpStatus::Completed).unwrap();
        assert_eq!(router.pending_count(), 0);
    }

    #[test]
    fn test_reset_daily_volumes() {
        let mut router = test_router();
        let proof = test_deposit(100_000, "WARP:1:solana:a");
        router.initiate_outbound(proof).unwrap();
        assert!(!router.daily_volume.is_empty());
        router.reset_daily_volumes();
        assert!(router.daily_volume.is_empty());
    }

    #[test]
    fn test_get_transfer_nonexistent() {
        let router = test_router();
        assert!(router.get_transfer(&Uuid::new_v4()).is_none());
    }

    #[test]
    fn test_advance_nonexistent_transfer() {
        let mut router = test_router();
        let result = router.advance_transfer(Uuid::new_v4(), WarpStatus::Completed);
        assert!(result.is_err());
    }

    #[test]
    fn test_disabled_chain_rejected() {
        let mut router = test_router();
        router.registry.disable("tron", None).unwrap();
        let proof = test_deposit(100_000, "WARP:1:tron:TAddr");
        assert!(router.initiate_outbound(proof).is_err());
    }

    #[test]
    fn test_metrics_updated_on_transfers() {
        let mut router = test_router();
        let proof = test_deposit(100_000, "WARP:1:base:0x1");
        let id = router.initiate_outbound(proof).unwrap();
        assert_eq!(router.metrics.transfers_initiated(), 1);

        router
            .advance_transfer(id, WarpStatus::AwaitingFinality)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Validating).unwrap();
        router
            .advance_transfer(id, WarpStatus::QuorumReached)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Executing).unwrap();
        router.advance_transfer(id, WarpStatus::Completed).unwrap();
        assert_eq!(router.metrics.transfers_completed(), 1);
    }

    #[test]
    fn test_drain_xp_events_on_complete() {
        let mut router = test_router();
        let proof = test_deposit(5_000_000, "WARP:1:solana:addr");
        let id = router.initiate_outbound(proof).unwrap();

        // No XP events until completed
        assert!(router.drain_xp_events().is_empty());

        // Advance to completed
        router
            .advance_transfer(id, WarpStatus::AwaitingFinality)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Validating).unwrap();
        router
            .advance_transfer(id, WarpStatus::QuorumReached)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Executing).unwrap();
        router.advance_transfer(id, WarpStatus::Completed).unwrap();

        let events = router.drain_xp_events();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].amount_flowers, 5_000_000);
        // Second drain is empty
        assert!(router.drain_xp_events().is_empty());
    }

    #[test]
    fn test_no_xp_on_failure() {
        let mut router = test_router();
        let proof = test_deposit(100_000, "WARP:1:base:0x1");
        let id = router.initiate_outbound(proof).unwrap();
        router
            .advance_transfer(id, WarpStatus::AwaitingFinality)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Failed).unwrap();
        assert!(router.drain_xp_events().is_empty());
    }

    #[test]
    fn test_router_persists_to_db_and_reloads() {
        use crate::warp::db::TransferDb;

        let db = TransferDb::in_memory().unwrap();
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));

        // First router instance creates a transfer and persists it.
        {
            let mut router = WarpRouter::with_db(
                ChainRegistry::with_defaults(),
                FeeEngine::with_defaults(),
                validator_set.clone(),
                db.clone(),
                None,
                12,
            )
            .unwrap();
            let proof = test_deposit(1_000_000, "WARP:1:base:0xRecipient");
            let id = router.initiate_outbound(proof).unwrap();
            assert_eq!(router.transfer_count(), 1);

            // Advance and persist
            router
                .advance_transfer(id, WarpStatus::AwaitingFinality)
                .unwrap();
        }

        // Second router instance loads from the same DB.
        {
            let mut router = WarpRouter::with_db(
                ChainRegistry::with_defaults(),
                FeeEngine::with_defaults(),
                validator_set,
                db.clone(),
                None,
                12,
            )
            .unwrap();
            assert_eq!(router.transfer_count(), 1);

            // Find the loaded transfer
            let transfer = router.list_transfers().pop().unwrap();
            assert_eq!(transfer.status, WarpStatus::AwaitingFinality);
            assert_eq!(transfer.dest_chain.name, "base");
            assert_eq!(transfer.recipient, "0xRecipient");

            // We can continue advancing it
            router
                .advance_transfer(transfer.id, WarpStatus::Validating)
                .unwrap();
        }
    }

    #[test]
    fn test_outbound_rejects_unverified_proof() {
        let mut router = test_router_with_rpc("127.0.0.1:1");
        let proof = test_deposit(1_000_000, "WARP:1:solana:7xKXtg2CW87d97T");
        let result = router.initiate_outbound(proof);
        assert!(
            result.is_err(),
            "proof verification should fail without L1 node"
        );
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("deposit proof verification"));
    }

    // ── Fail-closed persistence tests ────────────────────────────────
    //
    // A failing save must never leave an executable transfer or a state
    // the DB doesn't have. These tests use a real file DB (an in-memory
    // DB cannot be reached by the second connection that installs the
    // fault trigger).

    fn temp_db_path() -> String {
        std::env::temp_dir()
            .join(format!("zion-warp-router-test-{}.db", Uuid::new_v4()))
            .to_string_lossy()
            .into_owned()
    }

    /// Router over a fresh file DB.
    fn file_router(db: &TransferDb) -> WarpRouter {
        let validator_set = Arc::new(Mutex::new(WarpValidatorSet::new(3)));
        WarpRouter::with_db(
            ChainRegistry::with_defaults(),
            FeeEngine::with_defaults(),
            validator_set,
            db.clone(),
            None,
            12,
        )
        .unwrap()
    }

    /// Independent connection that installs a trigger failing every
    /// `INSERT OR REPLACE` save on `transfers` (BEFORE INSERT fires for
    // the REPLACE-as-delete+insert path too).
    fn install_fail_trigger(path: &str) -> rusqlite::Connection {
        let conn = rusqlite::Connection::open(path).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER fail_transfer_save BEFORE INSERT ON transfers \
             BEGIN SELECT RAISE(FAIL, 'forced save failure'); END;",
        )
        .unwrap();
        conn
    }

    fn drop_fail_trigger(conn: &rusqlite::Connection) {
        conn.execute_batch("DROP TRIGGER fail_transfer_save")
            .unwrap();
    }

    #[test]
    fn test_initiate_fails_closed_on_save_error() {
        let path = temp_db_path();
        let db = TransferDb::open(&path).unwrap();
        let _trigger_conn = install_fail_trigger(&path);
        let mut router = file_router(&db);

        let err = router
            .initiate_outbound(test_deposit(1_000_000, "WARP:1:base:0xR"))
            .unwrap_err();
        assert!(matches!(err, WarpError::Database(_)), "got {err:?}");

        // Nothing published: no in-memory transfer, no DB row, no metrics.
        assert_eq!(router.transfer_count(), 0);
        assert_eq!(db.count().unwrap(), 0);
        assert_eq!(router.metrics.transfers_initiated(), 0);
        // (daily_volume is seeded from the DB for all chains — it must not
        // have accrued this rejected amount.)
        assert_eq!(router.daily_volume.get("base").copied().unwrap_or(0), 0);

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn test_advance_fails_closed_keeps_previous_status() {
        let path = temp_db_path();
        let db = TransferDb::open(&path).unwrap();
        let mut router = file_router(&db);
        let id = router
            .initiate_outbound(test_deposit(1_000_000, "WARP:1:base:0xR"))
            .unwrap();
        router
            .advance_transfer(id, WarpStatus::AwaitingFinality)
            .unwrap();

        let conn = install_fail_trigger(&path);
        let err = router
            .advance_transfer(id, WarpStatus::Validating)
            .unwrap_err();
        assert!(matches!(err, WarpError::Database(_)), "got {err:?}");

        // Memory and DB both still at the previous status.
        assert_eq!(
            router.get_transfer(&id).unwrap().status,
            WarpStatus::AwaitingFinality
        );
        assert_eq!(
            db.load(&id).unwrap().unwrap().status,
            WarpStatus::AwaitingFinality
        );

        // Removing the trigger lets the same transition succeed — the
        // in-memory state machine was not left half-advanced.
        drop_fail_trigger(&conn);
        router.advance_transfer(id, WarpStatus::Validating).unwrap();
        assert_eq!(
            router.get_transfer(&id).unwrap().status,
            WarpStatus::Validating
        );
        assert_eq!(
            db.load(&id).unwrap().unwrap().status,
            WarpStatus::Validating
        );
        assert_eq!(router.state_machines[&id].history().len(), 3);

        // A failed Completed transition must not emit metrics/XP.
        router
            .advance_transfer(id, WarpStatus::QuorumReached)
            .unwrap();
        router.advance_transfer(id, WarpStatus::Executing).unwrap();
        let conn2 = install_fail_trigger(&path);
        assert!(router.advance_transfer(id, WarpStatus::Completed).is_err());
        assert_eq!(router.metrics.transfers_completed(), 0);
        assert!(router.drain_xp_events().is_empty());
        assert_eq!(
            router.get_transfer(&id).unwrap().status,
            WarpStatus::Executing
        );
        drop_fail_trigger(&conn2);
        router.advance_transfer(id, WarpStatus::Completed).unwrap();
        assert_eq!(router.metrics.transfers_completed(), 1);
        assert_eq!(router.drain_xp_events().len(), 1);

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn test_set_dest_tx_fails_closed_and_retries() {
        let path = temp_db_path();
        let db = TransferDb::open(&path).unwrap();
        let mut router = file_router(&db);
        let id = router
            .initiate_outbound(test_deposit(1_000_000, "WARP:1:base:0xR"))
            .unwrap();
        for s in [
            WarpStatus::AwaitingFinality,
            WarpStatus::Validating,
            WarpStatus::QuorumReached,
            WarpStatus::Executing,
        ] {
            router.advance_transfer(id, s).unwrap();
        }

        // Missing transfer id → TransferNotFound.
        assert!(matches!(
            router.set_dest_tx(&Uuid::new_v4(), "x".into()),
            Err(WarpError::TransferNotFound(_))
        ));

        let conn = install_fail_trigger(&path);
        let err = router
            .set_dest_tx(&id, "dest_tx_hash_1".into())
            .unwrap_err();
        assert!(matches!(err, WarpError::Database(_)), "got {err:?}");

        // Hash stays unset in memory and DB — a retry is safe.
        assert!(router.get_transfer(&id).unwrap().dest_tx_hash.is_none());
        assert!(db.load(&id).unwrap().unwrap().dest_tx_hash.is_none());

        drop_fail_trigger(&conn);
        router.set_dest_tx(&id, "dest_tx_hash_1".into()).unwrap();
        assert_eq!(
            router.get_transfer(&id).unwrap().dest_tx_hash.as_deref(),
            Some("dest_tx_hash_1")
        );
        assert_eq!(
            db.load(&id).unwrap().unwrap().dest_tx_hash.as_deref(),
            Some("dest_tx_hash_1")
        );

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn test_executing_transfer_reloads_with_dest_tx() {
        let path = temp_db_path();
        let db = TransferDb::open(&path).unwrap();
        let id;
        {
            let mut router = file_router(&db);
            id = router
                .initiate_outbound(test_deposit(1_000_000, "WARP:1:base:0xR"))
                .unwrap();
            for s in [
                WarpStatus::AwaitingFinality,
                WarpStatus::Validating,
                WarpStatus::QuorumReached,
                WarpStatus::Executing,
            ] {
                router.advance_transfer(id, s).unwrap();
            }
            router.set_dest_tx(&id, "broadcast_hash".into()).unwrap();
        }

        // Fresh router over the same DB retains Executing + tx hash.
        let router = file_router(&db);
        let t = router.get_transfer(&id).unwrap();
        assert_eq!(t.status, WarpStatus::Executing);
        assert_eq!(t.dest_tx_hash.as_deref(), Some("broadcast_hash"));

        std::fs::remove_file(&path).ok();
    }
}
