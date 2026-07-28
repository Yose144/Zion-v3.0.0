//! # WARP → L3 AI XP Bridge
//!
//! When a WARP transfer reaches [`WarpStatus::Completed`], a [`WarpXpEvent`] is
//! emitted.  The event is queued inside [`WarpRouter`] and can be drained by the
//! server / orchestration layer to credit XP to the initiating agent's
//! [`ConsciousnessEngine`](https://docs.zion/l3-ai-native).
//!
//! ## XP formula
//!
//! ```text
//! base_xp     = 50
//! volume_xp   = min(amount_flowers / 1_000_000, 200)   ← up to 200 XP for large transfer
//! cross_bonus = if source != dest family { 25 } else { 0 }
//! total_xp    = base_xp + volume_xp + cross_bonus      ← max 275 per transfer
//! ```
//!
//! ## Integration example
//!
//! ```rust,ignore
//! // In main.rs / server task:
//! let events = router.drain_xp_events();
//! for ev in events {
//!     let xp = WarpXpReward::for_transfer(&ev);
//!     // consciousness_engine.add_xp(xp);
//! }
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::warp::types::{ChainFamily, WarpTransfer};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/// An XP reward event produced when a WARP transfer completes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpXpEvent {
    /// UUID of the originating transfer.
    pub transfer_id: Uuid,
    /// The initiating agent / wallet address.
    pub initiator: String,
    /// Source chain family (e.g. ZionL1).
    pub source_family: ChainFamily,
    /// Destination chain family (e.g. Evm, Solana, …).
    pub dest_family: ChainFamily,
    /// Amount bridged (flowers, 6 decimals).
    pub amount_flowers: u64,
    /// Timestamp when the transfer completed.
    pub completed_at: DateTime<Utc>,
}

impl WarpXpEvent {
    /// Create a new event from a completed [`WarpTransfer`].
    pub fn from_transfer(t: &WarpTransfer) -> Self {
        Self {
            transfer_id: t.id,
            initiator: t.sender.clone(),
            source_family: t.source_chain.family,
            dest_family: t.dest_chain.family,
            amount_flowers: t.amount_flowers,
            completed_at: t.updated_at,
        }
    }

    /// Whether this event crosses chain families (earns cross-chain bonus).
    pub fn is_cross_family(&self) -> bool {
        self.source_family != self.dest_family
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reward calculator
// ─────────────────────────────────────────────────────────────────────────────

/// Stateless XP reward calculator for completed WARP transfers.
pub struct WarpXpReward;

impl WarpXpReward {
    /// Calculate XP for a completed transfer.
    ///
    /// Returns `u64` so it can be passed directly to `ConsciousnessEngine::add_xp()`.
    pub fn for_transfer(ev: &WarpXpEvent) -> u64 {
        let base: u64 = 50;
        let volume: u64 = (ev.amount_flowers / 1_000_000).min(200);
        let cross: u64 = if ev.is_cross_family() { 25 } else { 0 };
        base + volume + cross
    }

    /// Minimum possible XP (base only, tiny amount, same-family).
    pub const MIN_XP: u64 = 50;

    /// Maximum possible XP (base + volume cap + cross bonus).
    pub const MAX_XP: u64 = 275;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::types::{ChainId, WarpStatus, WarpTransfer};

    fn base_chain() -> ChainId {
        ChainId::evm("base", 8453, 64)
    }

    fn make_transfer(amount: u64, dest: ChainId) -> WarpTransfer {
        let mut t = WarpTransfer::new(
            ChainId::zion_l1(),
            dest,
            "zion1agent".into(),
            "0xrecip".into(),
            amount,
            1_000,
            "memo".into(),
        );
        t.status = WarpStatus::Completed;
        t
    }

    #[test]
    fn test_xp_base_same_family() {
        let t = make_transfer(0, ChainId::zion_l1());
        let ev = WarpXpEvent::from_transfer(&t);
        assert!(!ev.is_cross_family());
        let xp = WarpXpReward::for_transfer(&ev);
        assert_eq!(xp, 50);
    }

    #[test]
    fn test_xp_cross_family_small() {
        let t = make_transfer(500_000, base_chain()); // < 1 ZION
        let ev = WarpXpEvent::from_transfer(&t);
        assert!(ev.is_cross_family());
        let xp = WarpXpReward::for_transfer(&ev);
        assert_eq!(xp, 50 + 25);
    }

    #[test]
    fn test_xp_cross_family_large() {
        let t = make_transfer(500_000_000_000_000, ChainId::solana());
        let ev = WarpXpEvent::from_transfer(&t);
        let xp = WarpXpReward::for_transfer(&ev);
        assert_eq!(xp, 50 + 200 + 25);
    }

    #[test]
    fn test_xp_volume_cap() {
        let t = make_transfer(1_000_000_000_000, base_chain());
        let ev = WarpXpEvent::from_transfer(&t);
        let xp = WarpXpReward::for_transfer(&ev);
        assert_eq!(xp, WarpXpReward::MAX_XP);
    }

    #[test]
    fn test_min_max_constants() {
        assert_eq!(WarpXpReward::MIN_XP, 50);
        assert_eq!(WarpXpReward::MAX_XP, 275);
    }

    #[test]
    fn test_event_from_transfer_fields() {
        let t = make_transfer(1_000_000, base_chain());
        let ev = WarpXpEvent::from_transfer(&t);
        assert_eq!(ev.initiator, "zion1agent");
        assert_eq!(ev.source_family, ChainFamily::ZionL1);
        assert_eq!(ev.dest_family, ChainFamily::Evm);
        assert_eq!(ev.amount_flowers, 1_000_000);
    }

    #[test]
    fn test_event_serializes() {
        let t = make_transfer(1_000_000, base_chain());
        let ev = WarpXpEvent::from_transfer(&t);
        let json = serde_json::to_string(&ev).unwrap();
        let back: WarpXpEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(back.transfer_id, ev.transfer_id);
    }
}
