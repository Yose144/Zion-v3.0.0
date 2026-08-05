//! Off-chain solver discovery and broadcast for ZionDex.
//!
//! `SolverClient` is a pluggable trait for asking a registered solver to bid
//! on an open `SwapIntent`.  The default `HttpSolverClient` sends the intent
//! over HTTP and expects a `SolverBid` JSON response.  `MockSolverClient` is
//! useful for unit tests.  `SolverNetwork` broadcasts a single intent to many
//! solvers concurrently.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use tokio::task::JoinSet;

use crate::error::{MultichainError, MultichainResult};
use crate::swap::dex::intent::{SolverBid, SwapIntent};
use crate::swap::dex::intent_engine::SolverInfo;

/// A client that asks a single off-chain solver for a bid.
#[async_trait]
pub trait SolverClient: Send + Sync {
    /// Ask `solver` to bid on `intent`. Returns `None` if the solver declines.
    async fn request_bid(
        &self,
        intent: &SwapIntent,
        solver: &SolverInfo,
    ) -> MultichainResult<Option<SolverBid>>;
}

/// Default HTTP client for off-chain solvers.
#[derive(Debug, Default, Clone)]
pub struct HttpSolverClient;

impl HttpSolverClient {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl SolverClient for HttpSolverClient {
    async fn request_bid(
        &self,
        _intent: &SwapIntent,
        _solver: &SolverInfo,
    ) -> MultichainResult<Option<SolverBid>> {
        // TODO: POST intent JSON to solver.url and parse SolverBid response.
        // Kept as a placeholder until solver REST protocol is finalized.
        Err(MultichainError::Unsupported(
            "HTTP off-chain solver client not yet active".to_string(),
        ))
    }
}

/// In-memory solver client for tests. Pre-seeded with a bid per solver name.
#[derive(Debug, Default, Clone)]
pub struct MockSolverClient {
    bids: HashMap<String, Option<SolverBid>>,
}

impl MockSolverClient {
    pub fn new() -> Self {
        Self {
            bids: HashMap::new(),
        }
    }

    pub fn with_bid(mut self, solver: impl Into<String>, bid: Option<SolverBid>) -> Self {
        self.bids.insert(solver.into(), bid);
        self
    }
}

#[async_trait]
impl SolverClient for MockSolverClient {
    async fn request_bid(
        &self,
        _intent: &SwapIntent,
        solver: &SolverInfo,
    ) -> MultichainResult<Option<SolverBid>> {
        Ok(self.bids.get(&solver.name).cloned().unwrap_or(None))
    }
}

/// Broadcasts an intent to multiple solvers concurrently and collects bids.
#[derive(Clone)]
pub struct SolverNetwork<C: SolverClient> {
    client: Arc<C>,
}

impl<C: SolverClient + 'static> SolverNetwork<C> {
    pub fn new(client: Arc<C>) -> Self {
        Self { client }
    }

    /// Concurrently request bids from `solvers` for `intent`. Returns a vector
    /// of per-solver results in the same order as `solvers`.
    pub async fn broadcast(
        &self,
        intent: &SwapIntent,
        solvers: &[SolverInfo],
    ) -> Vec<MultichainResult<Option<SolverBid>>> {
        let mut set = JoinSet::new();
        for solver in solvers {
            let client = Arc::clone(&self.client);
            let solver = solver.clone();
            let intent = intent.clone();
            set.spawn(async move { client.request_bid(&intent, &solver).await });
        }

        let mut results = Vec::with_capacity(solvers.len());
        while let Some(res) = set.join_next().await {
            match res {
                Ok(r) => results.push(r),
                Err(e) => results.push(Err(MultichainError::Internal(format!("solver task: {e}")))),
            }
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zion_l1_types::{Amount, AssetId, ChainId};

    fn sample_intent() -> SwapIntent {
        SwapIntent::new(
            "user1",
            AssetId::new(ChainId::ZionL1, "ZION", None),
            AssetId::new(ChainId::ZionL1, "USDC", None),
            Amount::new(1_000_000),
            Amount::new(900_000),
            u64::MAX,
            1,
        )
    }

    fn sample_bid() -> SolverBid {
        let intent = sample_intent();
        SolverBid::new(
            intent.id,
            "solver-a",
            Amount::new(950_000),
            vec![],
            10,
            0,
        )
    }

    #[tokio::test]
    async fn network_broadcasts_to_multiple_solvers() {
        let client = MockSolverClient::new().with_bid("solver-a", Some(sample_bid()));
        let network = SolverNetwork::new(Arc::new(client));

        let solvers = vec![
            SolverInfo {
                name: "solver-a".into(),
                url: Some("http://solver-a/bid".into()),
                reputation: 100,
            },
            SolverInfo {
                name: "solver-b".into(),
                url: Some("http://solver-b/bid".into()),
                reputation: 50,
            },
        ];

        let results = network.broadcast(&sample_intent(), &solvers).await;
        assert_eq!(results.len(), 2);
        assert!(results[0].as_ref().unwrap().is_some());
        assert!(results[1].as_ref().unwrap().is_none());
    }
}
