use crate::error::{WarpError, WarpResult};
use crate::fees::FeeEngine;
use crate::metrics::WarpMetrics;
use crate::protocol::{parse_warp_memo, DepositProof};
use crate::registry::ChainRegistry;
use crate::state::TransferStateMachine;
use crate::types::{ChainId, WarpStatus, WarpTransfer};
use crate::validator::WarpValidatorSet;
use crate::xp_bridge::WarpXpEvent;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;
use uuid::Uuid;

/// Orchestrates cross-chain transfers end-to-end.
pub struct WarpRouter {
    pub registry: ChainRegistry,
    pub fee_engine: FeeEngine,
    pub validator_set: Arc<Mutex<WarpValidatorSet>>,
    pub metrics: WarpMetrics,
    transfers: HashMap<Uuid, WarpTransfer>,
    state_machines: HashMap<Uuid, TransferStateMachine>,
    daily_volume: HashMap<String, u64>,

    /// Maximum daily throughput per chain (flowers).
    pub daily_limit: u64,
    /// Amount threshold for timelock hold.
    pub timelock_threshold: u64,
    /// XP events queued for drain by the orchestration layer.
    xp_events: Vec<WarpXpEvent>,
}

impl WarpRouter {
    pub fn new(
        registry: ChainRegistry,
        fee_engine: FeeEngine,
        validator_set: Arc<Mutex<WarpValidatorSet>>,
    ) -> Self {
        Self {
            registry,
            fee_engine,
            validator_set,
            metrics: WarpMetrics::new(),
            transfers: HashMap::new(),
            state_machines: HashMap::new(),
            daily_volume: HashMap::new(),
            daily_limit: 10_000_000_000_000,
            timelock_threshold: 1_000_000_000_000,
            xp_events: Vec::new(),
        }
    }

    /// Process an outbound transfer (ZION L1 → external chain).
    pub fn initiate_outbound(&mut self, proof: DepositProof) -> WarpResult<Uuid> {
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

        // 6. Check timelock
        if transfer.net_amount() > self.timelock_threshold {
            transfer.status = WarpStatus::TimelockHold;
            info!(
                transfer_id = %transfer_id,
                amount = transfer.amount_flowers,
                "Transfer exceeds timelock threshold — entering 24h hold"
            );
        } else {
            transfer.status = WarpStatus::Detected;
        }

        // 7. Track
        let sm = TransferStateMachine::new(transfer.status);
        self.transfers.insert(transfer_id, transfer);
        self.state_machines.insert(transfer_id, sm);
        *self.daily_volume.entry(chain_name).or_insert(0) += proof.amount_flowers;

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
        self.transfers.insert(transfer_id, transfer);
        self.state_machines.insert(transfer_id, sm);

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
    use crate::fees::FeeEngine;
    use crate::validator::WarpValidatorSet;
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
        router.registry.disable("tron").unwrap();
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
}
