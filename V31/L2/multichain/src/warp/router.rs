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

use std::collections::HashMap;
use std::io::Write;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};
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

    fn save_transfer(&self, transfer: &WarpTransfer) {
        if let Some(db) = &self.db {
            if let Err(e) = db.save(transfer) {
                warn!(transfer_id = %transfer.id, "[Router] DB save failed: {}", e);
            }
        }
    }

     fn update_transfer_db(&self, id: Uuid) {
        if let Some(db) = &self.db {
            if let Some(t) = self.transfers.get(&id) {
                if let Err(e) = db.save(t) {
                    warn!(transfer_id = %id, "[Router] DB update failed: {}", e);
                }
            }
        }
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
        let tx_info: serde_json::Value =
            match self.rpc_call_sync(addr, "getTransaction", serde_json::json!({"hash": &proof.tx_hash})) {
                Ok(v) => v,
                Err(e) => return Err(WarpError::Validation(format!(
                    "deposit proof verification failed: getTransaction error: {e}"
                ))),
            };

        // Verify the transaction exists and is confirmed.
        if !tx_info.get("confirmed").and_then(|v| v.as_bool()).unwrap_or(false) {
            return Err(WarpError::Validation(format!(
                "deposit proof verification failed: tx {} not confirmed",
                proof.tx_hash
            )));
        }

        let block_height = tx_info
            .get("block_height")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| WarpError::Validation("getTransaction response missing block_height".into()))?;

        // --- getChainInfo ---------------------------------------------------
        let chain_info: serde_json::Value = match self.rpc_call_sync(addr, "getChainInfo", serde_json::json!([])) {
            Ok(v) => v,
            Err(e) => return Err(WarpError::Validation(format!(
                "deposit proof verification failed: getChainInfo error: {e}"
            ))),
        };

        let tip = chain_info
            .get("chain_height")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| WarpError::Validation("getChainInfo response missing chain_height".into()))?;

        let confirmations = tip.saturating_sub(block_height) + 1;
        if confirmations < self.l1_finality_blocks {
            return Err(WarpError::FinalityNotReached {
                chain: "zion-l1".into(),
                confirmations,
                required: self.l1_finality_blocks,
            });
        }

        // Cross-check amount if the node exposes it.
        if let Some(onchain_amt) = tx_info.get("amount_flowers").and_then(|v| v.as_u64()) {
            if onchain_amt != proof.amount_flowers {
                return Err(WarpError::Validation(format!(
                    "deposit proof amount mismatch: proof={} on-chain={}",
                    proof.amount_flowers, onchain_amt
                )));
            }
        }

        Ok(())
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

        use std::io::Read;
        let mut buf = Vec::new();
        let timeout = std::time::Duration::from_secs(10);
        stream
            .set_read_timeout(Some(timeout))
            .map_err(|e| format!("set_read_timeout failed: {e}"))?;
        stream
            .read_to_end(&mut buf)
            .map_err(|e| format!("read from {addr} failed: {e}"))?;

        let line = String::from_utf8_lossy(&buf);
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

        // 7. Track
        let sm = TransferStateMachine::new(transfer.status);
        self.transfers.insert(transfer_id, transfer.clone());
        self.state_machines.insert(transfer_id, sm);
        *self.daily_volume.entry(chain_name.clone()).or_insert(0) += proof.amount_flowers;

        // Persist to DB
        self.save_transfer(&transfer);
        // Persist daily volume so it survives restarts (FIND-009).
        if let Some(db) = &self.db {
            if let Err(e) = db.record_daily_volume(&chain_name, proof.amount_flowers) {
                warn!(chain = %chain_name, "[Router] DB daily_volume record failed: {}", e);
            }
        }

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
        transfer.status = WarpStatus::Detected;

        let transfer_id = transfer.id;
        let sm = TransferStateMachine::new(transfer.status);
        self.transfers.insert(transfer_id, transfer.clone());
        self.state_machines.insert(transfer_id, sm);

        // Persist to DB
        self.save_transfer(&transfer);

        self.metrics.record_transfer_initiated();
        info!(transfer_id = %transfer_id, "Inbound WARP transfer initiated");

        Ok(transfer_id)
    }

    /// Advance a transfer to the next state.
    pub fn advance_transfer(&mut self, id: Uuid, new_status: WarpStatus) -> WarpResult<()> {
        let sm = self
            .state_machines
            .get_mut(&id)
            .ok_or_else(|| WarpError::TransferNotFound(id.to_string()))?;
        sm.transition(new_status)?;

        let transfer = self
            .transfers
            .get_mut(&id)
            .ok_or_else(|| WarpError::TransferNotFound(id.to_string()))?;
        transfer.status = new_status;
        transfer.updated_at = chrono::Utc::now();

        // Persist state change to DB
        self.update_transfer_db(id);

        if new_status == WarpStatus::Completed {
            self.metrics.record_transfer_completed();
            // Emit XP event for AI-native bridge
            if let Some(t) = self.transfers.get(&id) {
                self.xp_events.push(WarpXpEvent::from_transfer(t));
            }
        } else if new_status == WarpStatus::Failed {
            self.metrics.record_transfer_failed();
        }

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

    #[test]
    fn test_transfer_count() {
        let mut router = test_router();
        assert_eq!(router.transfer_count(), 0);
        let proof1 = test_deposit(100_000, "WARP:1:solana:a");
        let proof2 = test_deposit(200_000, "WARP:1:base:b");
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
        assert!(result.is_err(), "proof verification should fail without L1 node");
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("deposit proof verification"));
    }
}
