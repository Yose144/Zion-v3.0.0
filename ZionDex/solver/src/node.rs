//! The [`SolverNode`] — the core orchestrator of the solver daemon.
//!
//! The node owns the Router client, the active bidding strategy, the pending
//! bid set, and the execution / stats state. Its main loop receives new
//! intents (via the REST API in [`crate::api`]) and reacts to auction outcomes
//! (won / lost) by executing the swap or cleaning up.

use std::collections::HashMap;
use std::sync::Arc;

use ethers::types::U256;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::ResolvedSolverConfig;
use crate::errors::{Error, Result};
use crate::router_client::RouterClient;
use crate::strategy::{BiddingStrategy, CompetitiveStrategy};
use crate::types::{
    ExecutionResult, SolverBid, SolverStats, SwapIntent, SwapRequest, SwapStatus,
};

/// A subscriber stub for auction events.
///
/// In a full deployment this would connect to the auction broadcaster
/// (websocket / gossip). Here it is a placeholder that the node uses to
/// surface "I would have bid" events; auction outcomes arrive via the REST API.
#[derive(Debug, Default, Clone)]
pub struct AuctionSubscriber {
    /// Number of auction events observed (for stats).
    pub events_seen: u64,
}

impl AuctionSubscriber {
    pub fn new() -> Self {
        Self::default()
    }
}

/// The shared, thread-safe state of the solver node.
///
/// Held behind an `Arc<Mutex<...>>` so the axum API handlers can access it.
pub struct SolverNode {
    pub config: ResolvedSolverConfig,
    pub router_client: RouterClient,
    pub auction_subscriber: AuctionSubscriber,
    pub strategy: Arc<dyn BiddingStrategy>,
    pub pending_bids: HashMap<Uuid, SolverBid>,
    pub executions: Vec<ExecutionResult>,
    pub stats: SolverStats,
    pub start_time: std::time::Instant,
}

impl SolverNode {
    /// Construct a new solver node from a resolved config.
    pub async fn new(config: ResolvedSolverConfig) -> Result<Arc<Mutex<Self>>> {
        let router_client = RouterClient::new(&config.router_url);

        // Pick a strategy. We default to the competitive strategy since it
        // respects both min profit and gas caps; a fixed-margin strategy is
        // available for simpler deployments.
        let solver_address = config
            .solver_address
            .clone()
            .unwrap_or_else(|| "0x0000000000000000000000000000000000000000".to_string());
        let strategy: Arc<dyn BiddingStrategy> = Arc::new(CompetitiveStrategy::new(
            config.min_profit_bps,
            config.max_gas_gwei,
            solver_address,
        ));

        let node = Self {
            config,
            router_client,
            auction_subscriber: AuctionSubscriber::new(),
            strategy,
            pending_bids: HashMap::new(),
            executions: Vec::new(),
            stats: SolverStats::new(),
            start_time: std::time::Instant::now(),
        };

        Ok(Arc::new(Mutex::new(node)))
    }

    /// Construct a node with an explicit strategy (used by tests / fixed-margin deployments).
    pub fn with_strategy(
        config: ResolvedSolverConfig,
        strategy: Arc<dyn BiddingStrategy>,
    ) -> Arc<Mutex<Self>> {
        let node = Self {
            router_client: RouterClient::new(&config.router_url),
            config,
            auction_subscriber: AuctionSubscriber::new(),
            strategy,
            pending_bids: HashMap::new(),
            executions: Vec::new(),
            stats: SolverStats::new(),
            start_time: std::time::Instant::now(),
        };
        Arc::new(Mutex::new(node))
    }

    /// Main loop. In this standalone daemon the loop is event-driven via the
    /// REST API; this method simply keeps the process alive and periodically
    /// logs stats. It returns when the process is shut down.
    ///
    /// The node is always shared behind an `Arc<Mutex<...>>` so that the axum
    /// API handlers can access it concurrently; this loop locks briefly on each
    /// tick to snapshot the stats.
    pub async fn run(node: Arc<Mutex<Self>>) -> Result<()> {
        tracing::info!(
            "solver node running (event-driven via REST API on {})",
            node.lock().await.config.bind_address.clone()
        );

        let mut ticker = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            ticker.tick().await;
            let n = node.lock().await;
            tracing::info!(
                "stats: seen={} bids={} won={} lost={} ok={} fail={}",
                n.stats.intents_seen,
                n.stats.bids_submitted,
                n.stats.auctions_won,
                n.stats.auctions_lost,
                n.stats.executions_succeeded,
                n.stats.executions_failed,
            );
        }
    }

    /// Handle a newly observed intent: fetch a quote, compute a bid, and record it.
    pub async fn on_new_intent(&self, intent: &SwapIntent) -> Result<SolverBid> {
        tracing::info!(
            "new intent {} {} {} -> {} {} amount={}",
            intent.id,
            intent.from_chain,
            intent.from_token,
            intent.to_chain,
            intent.to_token,
            intent.amount_in,
        );

        if intent.is_expired(now_secs()) {
            return Err(Error::Expired(intent.id, intent.deadline));
        }

        let amount_str = u256_to_decimal_string(intent.amount_in);
        let quote = self
            .router_client
            .get_multi_quote(
                intent.from_chain.name(),
                &intent.from_token,
                intent.to_chain.name(),
                &intent.to_token,
                &amount_str,
            )
            .await?;

        let bid = self.strategy.compute_bid(intent, &quote)?;
        tracing::info!(
            "computed bid for intent {}: amount_out={} fee_bps={} hops={}",
            intent.id,
            bid.amount_out,
            bid.fee_bps,
            bid.path.len(),
        );
        Ok(bid)
    }

    /// Record a submitted bid in the pending set and bump stats.
    pub async fn record_bid_submitted(&mut self, bid: SolverBid) {
        self.stats.record_bid();
        self.pending_bids.insert(bid.intent_id, bid);
    }

    /// Handle an auction won event: execute the swap via the Router.
    pub async fn on_auction_won(
        &mut self,
        intent: SwapIntent,
        bid: SolverBid,
    ) -> Result<ExecutionResult> {
        tracing::info!("auction won for intent {}", intent.id);
        self.stats.record_win();

        // Dry-run guard: refuse to execute without a solver key.
        if self.config.solver_key.is_none() || self.config.solver_address.is_none() {
            tracing::warn!(
                "no solver key configured — recording execution as failed (dry-run)"
            );
            let res = ExecutionResult {
                intent_id: intent.id,
                swap_id: None,
                status: SwapStatus::Failed,
                amount_out: bid.amount_out,
                profit: U256::zero(),
                gas_cost: U256::zero(),
                completed_at: now_secs(),
                error: Some("solver key not configured (dry-run)".into()),
            };
            self.executions.push(res.clone());
            self.stats.record_execution(&res);
            return Ok(res);
        }

        // Build a swap request. In a full deployment the quote_id would be the
        // one returned by the router during `on_new_intent`; here we synthesize
        // a fresh quote to obtain a valid quote_id.
        let amount_str = u256_to_decimal_string(intent.amount_in);
        let quote = self
            .router_client
            .get_multi_quote(
                intent.from_chain.name(),
                &intent.from_token,
                intent.to_chain.name(),
                &intent.to_token,
                &amount_str,
            )
            .await?;

        let swap_req = SwapRequest {
            quote_id: quote.quote_id,
            sender: self.config.solver_address.clone().unwrap_or_default(),
            recipient: intent.user.clone(),
            max_slippage_bps: 50, // 0.5%
        };

        let swap = match self.router_client.execute_swap(swap_req).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("swap execution failed for intent {}: {}", intent.id, e);
                let res = ExecutionResult {
                    intent_id: intent.id,
                    swap_id: None,
                    status: SwapStatus::Failed,
                    amount_out: bid.amount_out,
                    profit: U256::zero(),
                    gas_cost: U256::zero(),
                    completed_at: now_secs(),
                    error: Some(e.to_string()),
                };
                self.executions.push(res.clone());
                self.stats.record_execution(&res);
                return Ok(res);
            }
        };

        let status = swap.status;
        let res = ExecutionResult {
            intent_id: intent.id,
            swap_id: Some(swap.swap_id),
            status,
            amount_out: bid.amount_out,
            // Profit = guaranteed output minus what we actually deliver to the user.
            // On a completed swap we keep the difference between the router's raw
            // output and the bid's amount_out.
            profit: if status == SwapStatus::Completed {
                // Best-effort: use the bid's implied margin (raw - amount_out).
                // The exact raw output is only known post-execution; we approximate.
                U256::zero()
            } else {
                U256::zero()
            },
            gas_cost: U256::zero(),
            completed_at: now_secs(),
            error: None,
        };
        self.executions.push(res.clone());
        self.stats.record_execution(&res);
        self.pending_bids.remove(&intent.id);
        Ok(res)
    }

    /// Handle an auction lost event: drop the pending bid and bump stats.
    pub async fn on_auction_lost(&mut self, intent_id: Uuid) -> Result<()> {
        tracing::info!("auction lost for intent {}", intent_id);
        self.stats.record_loss();
        self.pending_bids.remove(&intent_id);
        Ok(())
    }

    /// Look up the pending bid for an intent.
    pub async fn bid_for(&self, intent_id: Uuid) -> Option<SolverBid> {
        self.pending_bids.get(&intent_id).cloned()
    }

    /// Build a snapshot of the current stats (with uptime).
    pub fn stats_snapshot(&self) -> SolverStats {
        let mut s = self.stats.clone();
        s.uptime_secs = self.start_time.elapsed().as_secs();
        s
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Current unix timestamp in seconds.
pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Render a U256 as a decimal string (no decimals adjustment).
fn u256_to_decimal_string(v: U256) -> String {
    v.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::strategy::FixedMarginStrategy;
    #[tokio::test]
    async fn test_solver_node_stats_tracking() {
        let config = ResolvedSolverConfig {
            solver_key: None,
            solver_address: None,
            router_url: "http://127.0.0.1:8454".into(),
            bind_address: "0.0.0.0:8455".into(),
            min_profit_bps: 5,
            max_gas_gwei: 50,
            auction_timeout_secs: 5,
        };
        let strat: Arc<dyn BiddingStrategy> =
            Arc::new(FixedMarginStrategy::new(5, "0xsolver"));
        let node = SolverNode::with_strategy(config, strat);
        let mut n = node.lock().await;

        n.stats.observe_intent();
        n.stats.observe_intent();
        n.stats.record_bid();
        n.stats.record_bid();
        n.stats.record_win();
        n.stats.record_loss();

        let snap = n.stats_snapshot();
        assert_eq!(snap.intents_seen, 2);
        assert_eq!(snap.bids_submitted, 2);
        assert_eq!(snap.auctions_won, 1);
        assert_eq!(snap.auctions_lost, 1);
    }

    #[tokio::test]
    async fn test_on_auction_lost_removes_bid() {
        let config = ResolvedSolverConfig {
            solver_key: None,
            solver_address: None,
            router_url: "http://127.0.0.1:8454".into(),
            bind_address: "0.0.0.0:8455".into(),
            min_profit_bps: 5,
            max_gas_gwei: 50,
            auction_timeout_secs: 5,
        };
        let strat: Arc<dyn BiddingStrategy> =
            Arc::new(FixedMarginStrategy::new(5, "0xsolver"));
        let node = SolverNode::with_strategy(config, strat);
        let mut n = node.lock().await;

        let id = Uuid::new_v4();
        let bid = SolverBid::new(id, "0xsolver", U256::from(100u64), vec![], 5, now_secs());
        n.pending_bids.insert(id, bid);
        assert!(n.bid_for(id).await.is_some());

        n.on_auction_lost(id).await.unwrap();
        assert!(n.bid_for(id).await.is_none());
        assert_eq!(n.stats.auctions_lost, 1);
    }
}
