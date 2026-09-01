//! Intent-based settlement engine for ZionDex.
//!
//! `IntentEngine` combines user swap intents, a solver whitelist, and an
//! in-memory auction book. It can settle an intent by selecting the best
//! solver bid and then execute the winning path on-chain through the local
//! AMM router or the WARP bridge.

use std::collections::HashMap;

use uuid::Uuid;

use zion_l1_types::{Amount, Asset};

use super::intent::{IntentAuction, IntentStatus, SolverBid, SwapIntent};
use super::{DexRouter, MultichainError, MultichainResult};
use crate::contracts::token_decimals;

/// Off-chain contact / reputation metadata for a registered solver.
#[derive(Debug, Clone, Default)]
pub struct SolverInfo {
    pub name: String,
    pub url: Option<String>,
    pub reputation: u64,
    /// Ed25519 public key (32 bytes) for verifying signed bids.
    /// `None` means unsigned bids are accepted (development mode).
    pub pubkey: Option<Vec<u8>>,
}

/// Whitelist of solvers allowed to submit bids in this engine.
#[derive(Debug, Default)]
pub struct SolverRegistry {
    solvers: HashMap<String, SolverInfo>,
}

impl SolverRegistry {
    pub fn new() -> Self {
        Self {
            solvers: HashMap::new(),
        }
    }

    /// Register a solver without an advertised URL.
    pub fn register(&mut self, solver: impl Into<String>) -> bool {
        let name = solver.into();
        self.solvers
            .insert(
                name.clone(),
                SolverInfo {
                    name,
                    ..Default::default()
                },
            )
            .is_none()
    }

    /// Register a solver with an optional URL, initial reputation, and pubkey.
    pub fn register_with_info(
        &mut self,
        name: impl Into<String>,
        url: Option<String>,
        reputation: u64,
    ) -> bool {
        self.register_with_pubkey(name, url, reputation, None)
    }

    /// Register a solver with Ed25519 pubkey for bid signature verification.
    pub fn register_with_pubkey(
        &mut self,
        name: impl Into<String>,
        url: Option<String>,
        reputation: u64,
        pubkey: Option<Vec<u8>>,
    ) -> bool {
        let name = name.into();
        let is_new = !self.solvers.contains_key(&name);
        let mut info = self.solvers.remove(&name).unwrap_or_default();
        info.name = name.clone();
        if url.is_some() || is_new {
            info.url = url;
        }
        info.reputation = reputation;
        info.pubkey = pubkey;
        self.solvers.insert(name, info);
        is_new
    }

    pub fn deregister(&mut self, solver: &str) -> bool {
        self.solvers.remove(solver).is_some()
    }

    pub fn is_registered(&self, solver: &str) -> bool {
        self.solvers.contains_key(solver)
    }

    pub fn list(&self) -> Vec<String> {
        self.solvers.keys().cloned().collect()
    }

    pub fn get(&self, solver: &str) -> Option<&SolverInfo> {
        self.solvers.get(solver)
    }

    pub fn get_mut(&mut self, solver: &str) -> Option<&mut SolverInfo> {
        self.solvers.get_mut(solver)
    }
}

/// In-memory engine managing ZionDex swap intents and solver bids.
#[derive(Debug, Default)]
pub struct IntentEngine {
    auctions: HashMap<Uuid, (SwapIntent, IntentAuction)>,
    registry: SolverRegistry,
}

impl IntentEngine {
    pub fn new() -> Self {
        Self {
            auctions: HashMap::new(),
            registry: SolverRegistry::new(),
        }
    }

    pub fn registry(&self) -> &SolverRegistry {
        &self.registry
    }

    pub fn registry_mut(&mut self) -> &mut SolverRegistry {
        &mut self.registry
    }

    /// Open a new intent and return its id.
    pub fn open_intent(&mut self, intent: SwapIntent) -> Uuid {
        let id = intent.id;
        self.auctions.insert(id, (intent, IntentAuction::new()));
        id
    }

    /// Restore a persisted intent (used at startup).
    pub fn load_intent(&mut self, intent: SwapIntent) {
        self.auctions
            .insert(intent.id, (intent, IntentAuction::new()));
    }

    /// Restore a persisted bid (used at startup).
    pub fn load_bid(&mut self, bid: SolverBid) {
        if let Some((_, auction)) = self.auctions.get_mut(&bid.intent_id) {
            auction.load_bid(bid);
        }
    }

    /// Look up an intent by id.
    pub fn get_intent(&self, id: Uuid) -> Option<&SwapIntent> {
        self.auctions.get(&id).map(|(i, _)| i)
    }

    /// Look up an intent mutably by id.
    pub fn get_intent_mut(&mut self, id: Uuid) -> Option<&mut SwapIntent> {
        self.auctions.get_mut(&id).map(|(i, _)| i)
    }

    /// Submit a bid for an intent. The solver must be on the whitelist.
    /// If the solver has a registered pubkey, the bid signature is verified (FIND-012).
    pub fn submit_bid(&mut self, bid: SolverBid) -> MultichainResult<bool> {
        let solver_info = self
            .registry
            .get(&bid.solver)
            .ok_or_else(|| MultichainError::Validation(format!("solver {} is not registered", bid.solver)))?;

        if let Some(pubkey) = &solver_info.pubkey {
            if !bid.verify_signature(pubkey) {
                return Err(MultichainError::Validation(format!(
                    "solver {} bid signature verification failed",
                    bid.solver
                )));
            }
        }

        let Some((intent, auction)) = self.auctions.get_mut(&bid.intent_id) else {
            return Err(MultichainError::Validation("intent not found".to_string()));
        };
        auction.submit_bid(intent, bid)
    }

    /// Settle an intent and return the winning bid, if any.
    pub fn settle(&mut self, id: Uuid) -> MultichainResult<Option<SolverBid>> {
        let Some((intent, auction)) = self.auctions.get_mut(&id) else {
            return Err(MultichainError::Validation("intent not found".to_string()));
        };
        auction.settle(intent)
    }

    /// Settle an intent and execute the winning path against `router`.
    ///
    /// Same-chain AMM hops are executed directly on `DexRouter`. Cross-chain
    /// or bridge hops are rejected for now.
    pub fn settle_and_execute(
        &mut self,
        id: Uuid,
        router: &mut DexRouter,
    ) -> MultichainResult<Option<Amount>> {
        let (intent, auction) = self
            .auctions
            .get_mut(&id)
            .ok_or_else(|| MultichainError::Validation("intent not found".to_string()))?;

        let Some(bid) = auction.settle(intent)? else {
            return Ok(None);
        };

        if !intent.bid_meets_min(&bid) {
            return Err(MultichainError::Validation(
                "winning bid does not meet minimum output".to_string(),
            ));
        }

        if bid.path.is_empty() {
            return Err(MultichainError::Validation(
                "winning bid has empty execution path".to_string(),
            ));
        }

        // Reject bridge/cross-chain paths until WARP execution is wired.
        for hop in &bid.path {
            if hop.is_bridge {
                return Err(MultichainError::Unsupported(
                    "cross-chain bridge execution not yet implemented".to_string(),
                ));
            }
        }

        let mut amount = intent.amount_in;
        for window in bid.path.windows(2) {
            let (a, b) = (&window[0], &window[1]);
            if a.to_token != b.from_token {
                return Err(MultichainError::Validation(
                    "solver path is not continuous".to_string(),
                ));
            }
        }

        for hop in &bid.path {
            let from = Self::asset_from_id(&hop.from_token);
            let to = Self::asset_from_id(&hop.to_token);
            amount = router.execute(&from, &to, amount)?;
        }

        intent.status = IntentStatus::Executed;
        Ok(Some(amount))
    }

    fn asset_from_id(id: &zion_l1_types::AssetId) -> Asset {
        let decimals = if let Some(c) = id.contract.as_deref() {
            token_decimals(id.chain.as_str(), &id.ticker, Some(c))
        } else {
            id.chain.decimals()
        };
        Asset {
            id: id.clone(),
            decimals,
            name: id.ticker.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::intent::PathHop;
    use super::*;
    use zion_l1_types::{AssetId, ChainId};

    fn zion_usdc() -> (AssetId, AssetId) {
        let zion = AssetId::new(ChainId::ZionL1, "ZION", None);
        let usdc = AssetId::new(ChainId::ZionL1, "USDC", None);
        (zion, usdc)
    }

    fn make_pool(id: u64, asset_a: Asset, asset_b: Asset) -> super::super::Pool {
        super::super::Pool {
            id,
            asset_a,
            asset_b,
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        }
    }

    fn make_asset(id: &AssetId) -> Asset {
        Asset {
            id: id.clone(),
            decimals: 6,
            name: id.ticker.clone(),
        }
    }

    #[test]
    fn test_intent_engine_full_lifecycle() {
        let (zion, usdc) = zion_usdc();
        let zion_asset = make_asset(&zion);
        let usdc_asset = make_asset(&usdc);

        let mut engine = IntentEngine::new();
        engine.registry_mut().register("solver-a");

        let intent = SwapIntent::new(
            "user1",
            zion.clone(),
            usdc.clone(),
            Amount::new(1_000_000),
            Amount::new(900_000),
            u64::MAX,
            1,
        );
        let id = engine.open_intent(intent);

        let bid = SolverBid::new(
            id,
            "solver-a",
            Amount::new(1_100_000),
            vec![PathHop {
                chain: "zion".into(),
                dex: "amm".into(),
                from_token: zion.clone(),
                to_token: usdc.clone(),
                is_bridge: false,
                amount_in: Amount::new(1_000_000),
                amount_out: Amount::new(1_100_000),
            }],
            10,
            0,
        );
        assert!(engine.submit_bid(bid).unwrap());

        let mut router = DexRouter::new();
        router.add_pool(make_pool(1, zion_asset, usdc_asset));

        let out = engine.settle_and_execute(id, &mut router).unwrap().unwrap();
        assert!(out.0 > 0);

        let intent = engine.get_intent(id).unwrap();
        assert_eq!(intent.status, IntentStatus::Executed);
    }

    #[test]
    fn test_unregistered_solver_rejected() {
        let (zion, usdc) = zion_usdc();
        let mut engine = IntentEngine::new();

        let intent = SwapIntent::new(
            "user1",
            zion,
            usdc,
            Amount::new(1_000_000),
            Amount::new(1),
            u64::MAX,
            1,
        );
        let id = engine.open_intent(intent);

        let bid = SolverBid::new(id, "rogue", Amount::new(1_100_000), vec![], 0, 0);
        assert!(engine.submit_bid(bid).is_err());
    }
}
