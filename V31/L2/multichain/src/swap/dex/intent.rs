//! Intent-based settlement types for ZionDex.
//!
//! This is the V31 port of the archive `ZionDex/intent` layer. It defines
//! user swap intents, solver bids, and a small in-memory auction engine that
//! selects the best bid for an intent. The module is intentionally
//! self-contained so the router and solver can evolve independently.

use chrono::Utc;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

use zion_l1_types::{Amount, AssetId};

use crate::error::{MultichainError, MultichainResult};

/// Lifecycle state of a swap intent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IntentStatus {
    /// Waiting for solver bids.
    Pending,
    /// A winning bid has been selected.
    Settled,
    /// The swap has been executed on-chain.
    Executed,
    /// The deadline passed before settlement/execution.
    Expired,
    /// The user cancelled the intent.
    Cancelled,
}

impl std::fmt::Display for IntentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Settled => write!(f, "settled"),
            Self::Executed => write!(f, "executed"),
            Self::Expired => write!(f, "expired"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// A single hop in a solver's planned execution path.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathHop {
    /// Chain the hop executes on (human-readable name for logging).
    pub chain: String,
    /// DEX (or bridge) the hop uses.
    pub dex: String,
    /// Token consumed by the hop.
    pub from_token: AssetId,
    /// Token produced by the hop.
    pub to_token: AssetId,
    /// True if this hop crosses chains via the WARP bridge.
    pub is_bridge: bool,
}

/// A solver's competing offer to fulfill a swap intent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverBid {
    /// Intent this bid targets.
    pub intent_id: Uuid,
    /// Solver address/identifier.
    pub solver: String,
    /// Guaranteed output amount delivered to the user.
    pub amount_out: Amount,
    /// Planned execution path.
    pub path: Vec<PathHop>,
    /// Solver fee in basis points (e.g. 10 = 0.1%).
    pub fee_bps: u16,
    /// Unix timestamp the bid was created.
    pub timestamp: u64,
    /// Solver signature over the bid (optional until signed).
    pub signature: Vec<u8>,
}

impl SolverBid {
    /// Creates a new unsigned bid.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        intent_id: Uuid,
        solver: impl Into<String>,
        amount_out: Amount,
        path: Vec<PathHop>,
        fee_bps: u16,
        timestamp: u64,
    ) -> Self {
        Self {
            intent_id,
            solver: solver.into(),
            amount_out,
            path,
            fee_bps,
            timestamp,
            signature: Vec::new(),
        }
    }

    /// Net output after the solver fee.
    pub fn net_amount_out(&self) -> Amount {
        if self.fee_bps >= 10_000 {
            return Amount::ZERO;
        }
        let fee = self.amount_out.0 * u128::from(self.fee_bps) / 10_000;
        Amount::new(self.amount_out.0 - fee)
    }

    /// Deterministic signing hash over the immutable bid fields.
    /// The solver signs this hash with its Ed25519 key.
    pub fn signing_hash(&self) -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.update(self.intent_id.as_bytes());
        hasher.update(self.solver.as_bytes());
        hasher.update(self.amount_out.0.to_le_bytes());
        hasher.update(self.fee_bps.to_le_bytes());
        hasher.update(self.timestamp.to_le_bytes());
        // Include path length + hop data for determinism.
        hasher.update(self.path.len().to_le_bytes());
        for hop in &self.path {
            hasher.update(hop.chain.as_bytes());
            hasher.update(hop.dex.as_bytes());
            hasher.update(hop.from_token.to_string().as_bytes());
            hasher.update(hop.to_token.to_string().as_bytes());
            hasher.update([if hop.is_bridge { 1u8 } else { 0u8 }]);
        }
        hasher.finalize().to_vec()
    }

    /// Verify the embedded Ed25519 signature against `pubkey` (32-byte X25519).
    /// Returns `false` if the signature is empty or verification fails.
    pub fn verify_signature(&self, pubkey: &[u8]) -> bool {
        if self.signature.is_empty() {
            return false;
        }
        if pubkey.len() != 32 {
            return false;
        }
        let verifying_key = match VerifyingKey::from_bytes(pubkey.try_into().unwrap()) {
            Ok(k) => k,
            Err(_) => return false,
        };
        let sig = match Signature::from_slice(&self.signature) {
            Ok(s) => s,
            Err(_) => return false,
        };
        verifying_key
            .verify(self.signing_hash().as_slice(), &sig)
            .is_ok()
    }
}

/// A signed user intent to swap `amount_in` of `from_token` (on `from_chain)
/// for at least `min_amount_out` of `to_token` (on `to_chain).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapIntent {
    /// Unique intent identifier.
    pub id: Uuid,
    /// User address (hex for EVM, base58 for Solana, etc.).
    pub user: String,
    /// Source token/asset.
    pub from_asset: AssetId,
    /// Destination token/asset.
    pub to_asset: AssetId,
    /// Input amount (smallest units).
    pub amount_in: Amount,
    /// Minimum acceptable output (slippage protection).
    pub min_amount_out: Amount,
    /// Unix timestamp after which the intent is no longer valid.
    pub deadline: u64,
    /// Per-user replay protection nonce.
    pub nonce: u64,
    /// User signature over the intent payload (optional until signed).
    pub signature: Vec<u8>,
    /// Current lifecycle state.
    pub status: IntentStatus,
}

impl SwapIntent {
    /// Creates a new pending intent with a fresh UUID.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        user: impl Into<String>,
        from_asset: AssetId,
        to_asset: AssetId,
        amount_in: Amount,
        min_amount_out: Amount,
        deadline: u64,
        nonce: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            user: user.into(),
            from_asset,
            to_asset,
            amount_in,
            min_amount_out,
            deadline,
            nonce,
            signature: Vec::new(),
            status: IntentStatus::Pending,
        }
    }

    /// True if the intent deadline has passed at time `now`.
    pub fn is_expired(&self, now: u64) -> bool {
        now >= self.deadline
    }

    /// True if a bid satisfies the user's minimum output.
    pub fn bid_meets_min(&self, bid: &SolverBid) -> bool {
        bid.net_amount_out() >= self.min_amount_out
    }
}

/// In-memory auction book: collects bids for each intent and picks the best.
#[derive(Debug, Default)]
pub struct IntentAuction {
    /// intent_id -> bids
    bids: HashMap<Uuid, Vec<SolverBid>>,
}

impl IntentAuction {
    pub fn new() -> Self {
        Self {
            bids: HashMap::new(),
        }
    }

    /// Load a persisted bid without lifecycle checks (used at startup).
    pub fn load_bid(&mut self, bid: SolverBid) {
        self.bids.entry(bid.intent_id).or_default().push(bid);
    }

    /// Submit a bid. Returns `false` if the target intent is not open.
    pub fn submit_bid(&mut self, intent: &SwapIntent, bid: SolverBid) -> MultichainResult<bool> {
        if bid.intent_id != intent.id {
            return Err(MultichainError::Validation(
                "bid intent_id does not match".to_string(),
            ));
        }
        if intent.status != IntentStatus::Pending {
            return Ok(false);
        }
        if intent.is_expired(Utc::now().timestamp() as u64) {
            return Ok(false);
        }
        self.bids.entry(intent.id).or_default().push(bid);
        Ok(true)
    }

    /// Pick the best bid for an intent by net output (amount_out after fee).
    /// Returns `None` if no bids satisfy the user's `min_amount_out`.
    pub fn best_bid(&self, intent: &SwapIntent) -> Option<SolverBid> {
        let bids = self.bids.get(&intent.id)?;
        bids.iter()
            .filter(|b| intent.bid_meets_min(b))
            .max_by_key(|b| b.net_amount_out())
            .cloned()
    }

    /// Settle an intent: mark it settled and return the winning bid.
    pub fn settle(&self, intent: &mut SwapIntent) -> MultichainResult<Option<SolverBid>> {
        if intent.status != IntentStatus::Pending {
            return Err(MultichainError::Validation(
                "intent is not pending".to_string(),
            ));
        }
        if intent.is_expired(Utc::now().timestamp() as u64) {
            intent.status = IntentStatus::Expired;
            return Ok(None);
        }
        match self.best_bid(intent) {
            Some(bid) => {
                intent.status = IntentStatus::Settled;
                Ok(Some(bid))
            }
            None => Ok(None),
        }
    }

    /// Cancel an intent (only allowed while Pending).
    pub fn cancel(&self, intent: &mut SwapIntent) -> MultichainResult<()> {
        if intent.status != IntentStatus::Pending {
            return Err(MultichainError::Validation(
                "only pending intents can be cancelled".to_string(),
            ));
        }
        intent.status = IntentStatus::Cancelled;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::{Amount, AssetId, ChainId};

    fn zion_usdc() -> (AssetId, AssetId) {
        let zion = AssetId::new(ChainId::ZionL1, "ZION", None);
        let usdc = AssetId::new(ChainId::Base, "USDC", None);
        (zion, usdc)
    }

    #[test]
    fn test_intent_lifecycle_and_auction() {
        let (zion, usdc) = zion_usdc();
        let mut intent = SwapIntent::new(
            "zion1user",
            zion.clone(),
            usdc.clone(),
            Amount::new(1_000_000),
            Amount::new(900_000),
            u64::MAX,
            1,
        );
        assert_eq!(intent.status, IntentStatus::Pending);

        let mut auction = IntentAuction::new();

        let bid_low = SolverBid::new(
            intent.id,
            "solver-a",
            Amount::new(950_000),
            vec![PathHop {
                chain: "zion".into(),
                dex: "amm".into(),
                from_token: zion.clone(),
                to_token: usdc.clone(),
                is_bridge: false,
            }],
            30,
            0,
        );

        let bid_high = SolverBid::new(
            intent.id,
            "solver-b",
            Amount::new(1_100_000),
            vec![PathHop {
                chain: "base".into(),
                dex: "amm".into(),
                from_token: zion,
                to_token: usdc,
                is_bridge: true,
            }],
            10,
            0,
        );

        auction.submit_bid(&intent, bid_low).unwrap();
        auction.submit_bid(&intent, bid_high).unwrap();

        let winner = auction.settle(&mut intent).unwrap().unwrap();
        assert_eq!(winner.solver, "solver-b");
        assert_eq!(intent.status, IntentStatus::Settled);

        // net amount for high bid = 1_100_000 * (1 - 0.001) = 1_098_900
        assert!(winner.net_amount_out() >= Amount::new(1_098_000));
    }

    #[test]
    fn test_bid_below_min_rejected() {
        let (zion, usdc) = zion_usdc();
        let mut intent = SwapIntent::new(
            "zion1user",
            zion.clone(),
            usdc.clone(),
            Amount::new(1_000_000),
            Amount::new(2_000_000),
            u64::MAX,
            1,
        );

        let mut auction = IntentAuction::new();
        let bid = SolverBid::new(
            intent.id,
            "solver-a",
            Amount::new(1_100_000),
            vec![PathHop {
                chain: "zion".into(),
                dex: "amm".into(),
                from_token: zion,
                to_token: usdc,
                is_bridge: false,
            }],
            0,
            0,
        );
        auction.submit_bid(&intent, bid).unwrap();

        assert!(auction.settle(&mut intent).unwrap().is_none());
        assert_eq!(intent.status, IntentStatus::Pending);
    }

    #[test]
    fn test_bid_signature_roundtrip() {
        use crate::swap::dex::intent_engine::IntentEngine;
        use ed25519_dalek::{Signature, SigningKey, Signer, Verifier, VerifyingKey};
        use rand::rngs::OsRng;

        let (zion, usdc) = zion_usdc();
        let intent = SwapIntent::new(
            "zion1user",
            zion.clone(),
            usdc,
            Amount::new(1_000_000),
            Amount::new(900_000),
            u64::MAX,
            1,
        );

        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let pubkey = verifying_key.to_bytes().to_vec();

        let mut bid = SolverBid::new(
            intent.id,
            "solver-a",
            Amount::new(950_000),
            vec![PathHop {
                chain: "zion".into(),
                dex: "amm".into(),
                from_token: zion.clone(),
                to_token: zion,
                is_bridge: false,
            }],
            30,
            0,
        );

        let msg_hash = bid.signing_hash();
        bid.signature = signing_key.sign(msg_hash.as_slice()).to_vec();

        // Valid signature + correct pubkey → OK
        assert!(bid.verify_signature(&pubkey));

        // Tamper with the bid → verification fails
        let mut tampered = bid.clone();
        tampered.amount_out = Amount::new(2_000_000);
        assert!(!tampered.verify_signature(&pubkey));

        // Empty signature → false
        let mut unsigned = bid.clone();
        unsigned.signature.clear();
        assert!(!unsigned.verify_signature(&pubkey));

        // Wrong pubkey → false
        let wrong_key = SigningKey::generate(&mut OsRng).verifying_key().to_bytes().to_vec();
        assert!(!bid.verify_signature(&wrong_key));

        // Submit with registered pubkey and correct signature → accepted
        let mut engine = IntentEngine::new();
        engine.registry_mut().register_with_pubkey(
            "solver-a",
            None,
            100,
            Some(pubkey.clone()),
        );
         engine.open_intent(intent.clone());
        assert!(engine.submit_bid(bid.clone()).unwrap());
        assert_eq!(intent.status, IntentStatus::Pending);

        // Submit with wrong signature → rejected
        let mut bad_bid = bid.clone();
        bad_bid.signature = SigningKey::generate(&mut OsRng).sign(bid.signing_hash().as_slice()).to_vec();
        let mut intent2 = SwapIntent::new("zion1user", zion_usdc().0, zion_usdc().1, Amount::new(1_000_000), Amount::new(900_000), u64::MAX, 2);
        engine.open_intent(intent2.clone());
        assert!(engine.submit_bid(bad_bid).is_err());
    }
}
