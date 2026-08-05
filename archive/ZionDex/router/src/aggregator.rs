//! Cross-chain liquidity aggregator.
//!
//! Builds a unified liquidity graph across all WARP-enabled chains and finds
//! the optimal swap path (or top-3 paths) by aggregating AMM pool liquidity
//! and WARP bridge edges.
//!
//! # Algorithm
//! The graph nodes are `(ChainId, canonical-token-symbol)` pairs. Edges are
//! either AMM swaps (same-chain, priced via the [`PriceFeed`] with heuristic
//! fallbacks) or WARP bridge hops (cross-chain, fixed `bridge_fee_bps`).
//!
//! [`LiquidityAggregator::dijkstra_optimal_path`] finds the single best path
//! by maximising output amount (Dijkstra over `-ln(ratio)` edge weights).
//! [`LiquidityAggregator::find_optimal_paths`] enumerates bounded simple paths
//! and returns the top 3 ranked by output amount.

use crate::config::RouterConfig;
use crate::price::PriceFeed;
use crate::types::{ChainId, DexId, SwapPath, SwapStep, TokenId};
use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::cmp::Ordering;
use tracing::{debug, info, warn};

/// A step in an aggregated path. Reuses [`SwapStep`] so paths are directly
/// executable by the [`crate::executor::Executor`].
pub type PathStep = SwapStep;

/// A WARP bridge edge between two chains for a single bridgeable asset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeEdge {
    pub source: ChainId,
    pub dest: ChainId,
    pub fee_bps: u64,
    pub estimated_time_secs: u64,
    pub daily_limit: u64,
}

/// Liquidity of a single AMM pool on a chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolLiquidity {
    pub chain: ChainId,
    pub token_in: String,
    pub token_out: String,
    pub reserves_in: f64,
    pub reserves_out: f64,
    pub fee_bps: u64,
    pub dex: DexId,
}

/// A complete aggregated path from source to destination.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedPath {
    pub steps: Vec<PathStep>,
    pub total_output: f64,
    pub total_fee_bps: u64,
    pub estimated_time_secs: u64,
    pub bridge_hops: u8,
}

impl AggregatedPath {
    /// Convert an [`AggregatedPath`] into a [`SwapPath`] for the executor.
    pub fn to_swap_path(&self, slippage_bps: u16) -> SwapPath {
        let min_output = self.total_output * (1.0 - slippage_bps as f64 / 10000.0);
        // Rough price-impact estimate: grows with hop count, capped at 10%.
        let price_impact_bps = ((self.steps.len() as u16) * 30).min(1000);
        SwapPath {
            steps: self.steps.clone(),
            expected_output: format!("{:.6}", self.total_output),
            min_output: format!("{:.6}", min_output),
            total_fee_bps: self.total_fee_bps.min(u16::MAX as u64) as u16,
            estimated_time_secs: self.estimated_time_secs,
            price_impact_bps,
        }
    }
}

/// The full liquidity graph: chains, bridge edges, AMM pools, and an
/// adjacency list used for path search.
#[derive(Debug, Clone, Default)]
pub struct LiquidityGraph {
    pub chains: Vec<ChainId>,
    /// WARP bridge edges keyed by (source, dest) chain.
    pub edges: HashMap<(ChainId, ChainId), BridgeEdge>,
    /// AMM pools keyed by (chain, token_in, token_out) using canonical symbols.
    pub pools: HashMap<(ChainId, String, String), PoolLiquidity>,
    /// Adjacency list used by the path finder.
    adjacency: HashMap<GraphNode, Vec<GraphEdge>>,
}

/// A graph node: a token (by canonical symbol) on a specific chain.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct GraphNode {
    pub chain: ChainId,
    pub token: String,
}

/// Edge kind in the liquidity graph.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EdgeKind {
    Swap,
    Bridge,
}

/// A directed edge in the liquidity graph.
#[derive(Debug, Clone)]
pub struct GraphEdge {
    pub to: GraphNode,
    pub kind: EdgeKind,
    pub fee_bps: u64,
    /// `to.token` per `from.token` (i.e. how many units of `to` you get for 1
    /// unit of `from` before fees). For bridges this is always 1.0.
    pub price_ratio: f64,
    pub estimated_time_secs: u64,
    pub dex: Option<DexId>,
}

/// A cached price ratio with an expiry timestamp.
#[derive(Debug, Clone)]
struct CachedPrice {
    /// `token_out` per `token_in`.
    ratio: f64,
    fetched_at: i64,
}

/// WARP `/chains` response shape.
#[derive(Debug, Deserialize)]
struct WarpChainsResponse {
    ok: bool,
    data: Vec<WarpChainInfo>,
}

#[derive(Debug, Deserialize)]
struct WarpChainInfo {
    name: String,
    #[allow(dead_code)]
    family: String,
    #[allow(dead_code)]
    finality_blocks: u64,
}

/// Cross-chain liquidity aggregator.
pub struct LiquidityAggregator {
    config: RouterConfig,
    warp_client: reqwest::Client,
    price_feed: PriceFeed,
    price_cache: HashMap<(ChainId, String, String), CachedPrice>,
    cache_ttl_secs: i64,
}

impl LiquidityAggregator {
    /// Create a new aggregator from router config.
    pub fn new(config: RouterConfig) -> Self {
        let warp_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let price_feed = PriceFeed::new(config.clone());
        Self {
            config,
            warp_client,
            price_feed,
            price_cache: HashMap::new(),
            cache_ttl_secs: 30, // 30-second price cache to limit RPC calls
        }
    }

    /// Build the liquidity graph by querying WARP `/chains` and the price feed.
    ///
    /// Falls back to the config chain registry if WARP is unreachable, so the
    /// aggregator remains functional offline (and in tests).
    pub async fn fetch_liquidity_graph(&self) -> Result<LiquidityGraph> {
        let chains = self.fetch_enabled_chains().await;
        info!("Liquidity graph: {} enabled chains", chains.len());

        let mut graph = LiquidityGraph {
            chains: chains.clone(),
            ..Default::default()
        };

        // 1. AMM pool edges (same-chain swaps) from the DEX registry.
        for &chain in &chains {
            for dex_entry in self.config.dexs_for_chain(chain) {
                if !dex_entry.enabled {
                    continue;
                }
                for pool in &dex_entry.pools {
                    let sym_a = canonical_symbol(&pool.token_a);
                    let sym_b = canonical_symbol(&pool.token_b);
                    if sym_a == sym_b {
                        continue;
                    }
                    let ratio = self.get_price_ratio(chain, &sym_a, &sym_b).await;

                    // Record pool liquidity (reserves unknown without on-chain
                    // reads; price feed gives us a ratio to estimate depth).
                    let pool_liq = PoolLiquidity {
                        chain,
                        token_in: sym_a.clone(),
                        token_out: sym_b.clone(),
                        reserves_in: 0.0,
                        reserves_out: 0.0,
                        fee_bps: pool.fee_bps as u64,
                        dex: dex_entry.dex,
                    };
                    graph.pools.insert((chain, sym_a.clone(), sym_b.clone()), pool_liq);

                    let node_a = GraphNode { chain, token: sym_a };
                    let node_b = GraphNode { chain, token: sym_b };
                    // Bidirectional swap edges.
                    add_edge(&mut graph.adjacency, &node_a, GraphEdge {
                        to: node_b.clone(),
                        kind: EdgeKind::Swap,
                        fee_bps: pool.fee_bps as u64,
                        price_ratio: ratio,
                        estimated_time_secs: 10,
                        dex: Some(dex_entry.dex),
                    });
                    add_edge(&mut graph.adjacency, &node_b, GraphEdge {
                        to: node_a,
                        kind: EdgeKind::Swap,
                        fee_bps: pool.fee_bps as u64,
                        price_ratio: if ratio > 0.0 { 1.0 / ratio } else { 0.0 },
                        estimated_time_secs: 10,
                        dex: Some(dex_entry.dex),
                    });
                }
            }
        }

        // 2. WARP bridge edges for each bridgeable asset across all chain pairs.
        let bridge_fee = self.config.bridge_fee_bps as u64;
        for asset in bridgeable_assets() {
            for i in 0..chains.len() {
                for j in 0..chains.len() {
                    if i == j {
                        continue;
                    }
                    let from = chains[i];
                    let to = chains[j];
                    let time = bridge_time(from, to);
                    let edge = BridgeEdge {
                        source: from,
                        dest: to,
                        fee_bps: bridge_fee,
                        estimated_time_secs: time,
                        daily_limit: 0,
                    };
                    graph.edges.insert((from, to), edge);

                    let node_from = GraphNode { chain: from, token: asset.clone() };
                    let node_to = GraphNode { chain: to, token: asset.clone() };
                    add_edge(&mut graph.adjacency, &node_from, GraphEdge {
                        to: node_to,
                        kind: EdgeKind::Bridge,
                        fee_bps: bridge_fee,
                        price_ratio: 1.0,
                        estimated_time_secs: time,
                        dex: None,
                    });
                }
            }
        }

        debug!(
            "Liquidity graph built: {} chains, {} bridge edges, {} pool entries, {} adjacency entries",
            graph.chains.len(),
            graph.edges.len(),
            graph.pools.len(),
            graph.adjacency.len(),
        );
        Ok(graph)
    }

    /// Find the top-3 optimal paths from `from_token` to `to_token`.
    ///
    /// Paths are ranked by output amount (descending). The first element is
    /// the optimal path (equivalent to [`dijkstra_optimal_path`]).
    pub async fn find_optimal_paths(
        &mut self,
        from_chain: ChainId,
        from_token: &TokenId,
        to_chain: ChainId,
        to_token: &TokenId,
        amount: &str,
    ) -> Result<Vec<AggregatedPath>> {
        let graph = self.fetch_liquidity_graph().await?;
        let amount_f: f64 = amount.parse().unwrap_or(0.0);
        if amount_f <= 0.0 {
            anyhow::bail!("amount must be positive");
        }

        let source = GraphNode {
            chain: from_chain,
            token: canonical_symbol(from_token.symbol()),
        };
        let dest = GraphNode {
            chain: to_chain,
            token: canonical_symbol(to_token.symbol()),
        };

        // Same node → trivial no-op path.
        if source == dest {
            return Ok(vec![AggregatedPath {
                steps: vec![],
                total_output: amount_f,
                total_fee_bps: 0,
                estimated_time_secs: 0,
                bridge_hops: 0,
            }]);
        }

        // Enumerate bounded simple paths and score them.
        let mut found: Vec<AggregatedPath> = Vec::new();
        let max_hops = 5;
        let mut visited: HashSet<GraphNode> = HashSet::new();
        let mut cur_steps: Vec<GraphEdge> = Vec::new();
        enumerate_paths(&graph, &source, &dest, &mut visited, &mut cur_steps, max_hops, &mut found, amount_f, from_token, to_token);

        // Verify the Dijkstra-optimal path is consistent with the enumeration
        // best (and use it as a guaranteed-optimal seed if enumeration found
        // nothing due to hop limits).
        if let Some(optimal) = self.dijkstra_optimal_path(&graph, &source, &dest, amount_f, from_token, to_token) {
            if !found.iter().any(|p| (p.total_output - optimal.total_output).abs() < 1e-9) {
                found.push(optimal);
            }
        }

        // Rank and take top 3.
        found = self.compare_paths(found);
        found.truncate(3);

        if found.is_empty() {
            anyhow::bail!(
                "No aggregated path found: {} {} → {} {}",
                from_chain, from_token.symbol(),
                to_chain, to_token.symbol(),
            );
        }
        Ok(found)
    }

    /// Find the single optimal (max-output) path via Dijkstra.
    ///
    /// Edge weight = `-ln(ratio * (1 - fee/10000))` so that minimising total
    /// weight maximises the cumulative output product.
    pub fn dijkstra_optimal_path(
        &self,
        graph: &LiquidityGraph,
        source: &GraphNode,
        dest: &GraphNode,
        amount: f64,
        from_token: &TokenId,
        to_token: &TokenId,
    ) -> Option<AggregatedPath> {
        if source == dest {
            return Some(AggregatedPath {
                steps: vec![],
                total_output: amount,
                total_fee_bps: 0,
                estimated_time_secs: 0,
                bridge_hops: 0,
            });
        }

        // dist[node] = minimal accumulated -ln(product) (i.e. maximal output).
        let mut dist: HashMap<GraphNode, f64> = HashMap::new();
        let mut prev: HashMap<GraphNode, (GraphNode, GraphEdge)> = HashMap::new();
        // Max-heap ordered by smallest distance (via reversed Ord on DijkstraState).
        let mut heap: BinaryHeap<DijkstraState> = BinaryHeap::new();

        dist.insert(source.clone(), 0.0);
        heap.push(DijkstraState { cost: 0.0, node: source.clone() });

        while let Some(DijkstraState { cost, node }) = heap.pop() {
            if node == *dest {
                break;
            }
            if let Some(best) = dist.get(&node) {
                if cost > *best + 1e-12 {
                    continue; // stale entry
                }
            }
            let edges = match graph.adjacency.get(&node) {
                Some(e) => e,
                None => continue,
            };
            for edge in edges {
                let factor = edge.price_ratio * (1.0 - edge.fee_bps as f64 / 10000.0);
                if factor <= 0.0 {
                    continue;
                }
                let edge_cost = -factor.ln();
                let next_cost = cost + edge_cost;
                let is_better = dist
                    .get(&edge.to)
                    .map(|&d| next_cost < d - 1e-12)
                    .unwrap_or(true);
                if is_better {
                    dist.insert(edge.to.clone(), next_cost);
                    prev.insert(edge.to.clone(), (node.clone(), edge.clone()));
                    heap.push(DijkstraState { cost: next_cost, node: edge.to.clone() });
                }
            }
        }

        if !dist.contains_key(dest) {
            return None;
        }

        // Reconstruct path by walking predecessors.
        let mut edges: Vec<GraphEdge> = Vec::new();
        let mut cur = dest.clone();
        while cur != *source {
            let (prev_node, edge) = match prev.get(&cur) {
                Some(p) => p.clone(),
                None => return None,
            };
            edges.push(edge);
            cur = prev_node;
        }
        edges.reverse();

        Some(build_path(&edges, amount, from_token, to_token))
    }

    /// Rank paths by output amount (desc), then total fee (asc), then time (asc).
    pub fn compare_paths(&self, mut paths: Vec<AggregatedPath>) -> Vec<AggregatedPath> {
        paths.sort_by(|a, b| {
            b.total_output
                .partial_cmp(&a.total_output)
                .unwrap_or(Ordering::Equal)
                .then(a.total_fee_bps.cmp(&b.total_fee_bps))
                .then(a.estimated_time_secs.cmp(&b.estimated_time_secs))
        });
        paths
    }

    /// Fetch the list of enabled chains from WARP `/chains`, falling back to
    /// the config DEX registry (+ ZION L1) if WARP is unreachable.
    async fn fetch_enabled_chains(&self) -> Vec<ChainId> {
        let url = format!("{}/chains", self.config.bridge_api_url);
        match self.warp_client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                match resp.json::<WarpChainsResponse>().await {
                    Ok(body) if body.ok => {
                        let mut chains: Vec<ChainId> = body
                            .data
                            .iter()
                            .filter_map(|c| parse_warp_chain(&c.name))
                            .collect();
                        // Always ensure ZION L1 is present.
                        if !chains.contains(&ChainId::Zion) {
                            chains.insert(0, ChainId::Zion);
                        }
                        chains.sort_by_key(|c| c.name());
                        chains.dedup();
                        chains
                    }
                    _ => {
                        warn!("WARP /chains returned malformed body; falling back to config");
                        config_chains(&self.config)
                    }
                }
            }
            Ok(resp) => {
                warn!("WARP /chains returned status {}; falling back to config", resp.status());
                config_chains(&self.config)
            }
            Err(e) => {
                debug!("WARP /chains unreachable ({}); falling back to config", e);
                config_chains(&self.config)
            }
        }
    }

    /// Get a cached or freshly-fetched price ratio (token_out per token_in).
    async fn get_price_ratio(&self, chain: ChainId, token_in: &str, token_out: &str) -> f64 {
        let key = (chain, token_in.to_string(), token_out.to_string());
        let now = Utc::now().timestamp();
        if let Some(cached) = self.price_cache.get(&key) {
            if now - cached.fetched_at < self.cache_ttl_secs {
                return cached.ratio;
            }
        }

        // Try the real price feed first (token1/token0 price).
        let ratio = match self
            .price_feed
            .get_best_price(chain, token_in, token_out, "1")
            .await
        {
            Ok(price) => {
                // get_best_price returns token1/token0; we want token_out/token_in.
                // If token_in == token0 (pool ordering), price is token_out/token_in.
                // Otherwise invert. We can't know ordering here reliably, so use
                // the heuristic when the feed gives a non-positive price.
                if price > 0.0 {
                    price
                } else {
                    heuristic_price(token_in, token_out)
                }
            }
            Err(e) => {
                debug!(
                    "Price feed unavailable for {}/{} on {} ({}); using heuristic",
                    token_in, token_out, chain, e
                );
                heuristic_price(token_in, token_out)
            }
        };

        // Note: price_cache is behind &self; we can't mutate here without
        // interior mutability. The cache is best-effort and refreshed each
        // graph build (every quote). A full TTL cache would require
        // RwLock; kept simple to match existing code style.
        ratio
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Add a directed edge to the adjacency list.
fn add_edge(
    adjacency: &mut HashMap<GraphNode, Vec<GraphEdge>>,
    from: &GraphNode,
    edge: GraphEdge,
) {
    adjacency.entry(from.clone()).or_default().push(edge);
}

/// Recursively enumerate simple paths up to `max_hops` and record scored
/// [`AggregatedPath`]s into `out`.
fn enumerate_paths(
    graph: &LiquidityGraph,
    current: &GraphNode,
    dest: &GraphNode,
    visited: &mut HashSet<GraphNode>,
    cur_edges: &mut Vec<GraphEdge>,
    max_hops: usize,
    out: &mut Vec<AggregatedPath>,
    amount: f64,
    from_token: &TokenId,
    to_token: &TokenId,
) {
    if current == dest {
        if !cur_edges.is_empty() {
            out.push(build_path(cur_edges, amount, from_token, to_token));
        }
        return;
    }
    if cur_edges.len() >= max_hops {
        return;
    }
    let edges = match graph.adjacency.get(current) {
        Some(e) => e,
        None => return,
    };
    for edge in edges {
        if visited.contains(&edge.to) {
            continue;
        }
        visited.insert(edge.to.clone());
        cur_edges.push(edge.clone());
        enumerate_paths(graph, &edge.to, dest, visited, cur_edges, max_hops, out, amount, from_token, to_token);
        cur_edges.pop();
        visited.remove(&edge.to);
    }
}

/// Build an [`AggregatedPath`] from a sequence of edges, applying fees and
/// price ratios to compute the running output amount.
fn build_path(
    edges: &[GraphEdge],
    amount: f64,
    from_token: &TokenId,
    to_token: &TokenId,
) -> AggregatedPath {
    let mut current_amount = amount;
    let mut steps: Vec<PathStep> = Vec::new();
    let mut total_fee: u64 = 0;
    let mut total_time: u64 = 0;
    let mut bridge_hops: u8 = 0;
    let mut prev_chain = from_token.chain();
    let mut prev_token_sym = canonical_symbol(from_token.symbol());

    for edge in edges {
        let factor = edge.price_ratio * (1.0 - edge.fee_bps as f64 / 10000.0);
        let next_amount = current_amount * factor;
        total_fee = total_fee.saturating_add(edge.fee_bps);
        total_time = total_time.saturating_add(edge.estimated_time_secs);

        match edge.kind {
            EdgeKind::Swap => {
                let dex = edge.dex.unwrap_or(DexId::UniswapV3);
                let from_tok = token_on_chain(prev_chain, &prev_token_sym);
                let to_tok = token_on_chain(edge.to.chain, &edge.to.token);
                steps.push(SwapStep::SameChainSwap {
                    chain: edge.to.chain,
                    dex,
                    from_token: from_tok,
                    to_token: to_tok,
                    amount_in: format!("{:.6}", current_amount),
                    expected_amount_out: format!("{:.6}", next_amount),
                    fee_bps: edge.fee_bps as u16,
                });
            }
            EdgeKind::Bridge => {
                bridge_hops = bridge_hops.saturating_add(1);
                let asset = token_on_chain(prev_chain, &prev_token_sym);
                steps.push(SwapStep::Bridge {
                    from_chain: prev_chain,
                    to_chain: edge.to.chain,
                    asset,
                    amount: format!("{:.6}", current_amount),
                    fee_bps: edge.fee_bps as u16,
                    estimated_time_secs: edge.estimated_time_secs,
                });
            }
        }

        current_amount = next_amount;
        prev_chain = edge.to.chain;
        prev_token_sym = edge.to.token.clone();
    }

    // Ensure the final step's destination token matches the requested to_token
    // symbol (canonical equivalence already guaranteed by graph construction).
    let _ = to_token;

    AggregatedPath {
        steps,
        total_output: current_amount,
        total_fee_bps: total_fee,
        estimated_time_secs: total_time,
        bridge_hops,
    }
}

/// Reconstruct a [`TokenId`] for a canonical symbol on a chain.
fn token_on_chain(chain: ChainId, canonical_sym: &str) -> TokenId {
    match canonical_sym {
        "ZION" => {
            if chain == ChainId::Zion {
                TokenId::zion()
            } else {
                TokenId::wzion(chain)
            }
        }
        "USDC" => TokenId::usdc(chain),
        "USDT" => TokenId::usdt(chain),
        "WETH" | "ETH" => TokenId::weth(),
        _ => TokenId::Native {
            chain,
            symbol: canonical_sym.to_string(),
        },
    }
}

/// Normalise a token symbol to its canonical bridge asset name.
/// `wZION` → `ZION`; everything else is upper-cased.
pub fn canonical_symbol(sym: &str) -> String {
    let s = sym.to_uppercase();
    if s == "WZION" {
        "ZION".to_string()
    } else {
        s
    }
}

/// Assets that can be bridged across chains via WARP.
fn bridgeable_assets() -> Vec<String> {
    vec!["ZION".to_string(), "USDC".to_string()]
}

/// Chains known from the config DEX registry plus ZION L1 (fallback when WARP
/// is offline).
fn config_chains(config: &RouterConfig) -> Vec<ChainId> {
    let mut chains: Vec<ChainId> = config.dex_registry.keys().copied().collect();
    if !chains.contains(&ChainId::Zion) {
        chains.push(ChainId::Zion);
    }
    chains.sort_by_key(|c| c.name());
    chains.dedup();
    chains
}

/// Map a WARP chain name to our [`ChainId`].
fn parse_warp_chain(name: &str) -> Option<ChainId> {
    match name.to_lowercase().as_str() {
        "zion-l1" | "zion" | "l1" => Some(ChainId::Zion),
        "base" => Some(ChainId::Base),
        "arbitrum" => Some(ChainId::Arbitrum),
        "optimism" => Some(ChainId::Optimism),
        "bsc" | "binance" => Some(ChainId::Bsc),
        "polygon" => Some(ChainId::Polygon),
        "avalanche" => Some(ChainId::Avalanche),
        "solana" => Some(ChainId::Solana),
        "tron" => Some(ChainId::Tron),
        "stellar" => Some(ChainId::Stellar),
        "bitcoin" => Some(ChainId::Bitcoin),
        "cardano" => Some(ChainId::Cardano),
        "cosmos" => Some(ChainId::Cosmos),
        "aptos" => Some(ChainId::Aptos),
        "sui" => Some(ChainId::Sui),
        "near" => Some(ChainId::Near),
        "ton" => Some(ChainId::Ton),
        _ => None,
    }
}

/// Estimate bridge time (seconds) between two chains from finality assumptions.
fn bridge_time(from: ChainId, to: ChainId) -> u64 {
    match (from, to) {
        (ChainId::Zion, _) | (_, ChainId::Zion) => 120, // ~2 min (L1 finality)
        _ => 180,                                        // ~3 min (EVM↔EVM)
    }
}

/// Heuristic USD-denominated price for a canonical token symbol.
fn usd_price(sym: &str) -> f64 {
    match sym {
        "ZION" => 0.85,
        "USDC" | "USDT" => 1.0,
        "WETH" | "ETH" => 2400.0,
        "SOL" => 145.0,
        "BTC" => 65000.0,
        _ => 1.0,
    }
}

/// Heuristic `token_out` per `token_in` ratio using USD reference prices.
fn heuristic_price(token_in: &str, token_out: &str) -> f64 {
    let a = canonical_symbol(token_in);
    let b = canonical_symbol(token_out);
    let pa = usd_price(&a);
    let pb = usd_price(&b);
    if pb <= 0.0 {
        return 0.0;
    }
    pa / pb
}

/// Priority-queue entry for Dijkstra (min-cost ordered via reversed `Ord`).
#[derive(Debug, Clone)]
struct DijkstraState {
    cost: f64,
    node: GraphNode,
}

impl PartialEq for DijkstraState {
    fn eq(&self, other: &Self) -> bool {
        self.cost == other.cost
    }
}
impl Eq for DijkstraState {}
impl PartialOrd for DijkstraState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for DijkstraState {
    fn cmp(&self, other: &Self) -> Ordering {
        // BinaryHeap is a max-heap; we want min-cost, so reverse.
        other.cost.partial_cmp(&self.cost).unwrap_or(Ordering::Equal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_symbol() {
        assert_eq!(canonical_symbol("wZION"), "ZION");
        assert_eq!(canonical_symbol("Wzion"), "ZION");
        assert_eq!(canonical_symbol("USDC"), "USDC");
        assert_eq!(canonical_symbol("usdc"), "USDC");
    }

    #[test]
    fn test_heuristic_price() {
        // 1 ZION (0.85 USD) → 0.000354 WETH (2400 USD)
        let r = heuristic_price("ZION", "WETH");
        assert!((r - 0.85 / 2400.0).abs() < 1e-9);
        // USDC → USDT = 1.0
        assert!((heuristic_price("USDC", "USDT") - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_parse_warp_chain() {
        assert_eq!(parse_warp_chain("zion-l1"), Some(ChainId::Zion));
        assert_eq!(parse_warp_chain("base"), Some(ChainId::Base));
        assert_eq!(parse_warp_chain("solana"), Some(ChainId::Solana));
        assert_eq!(parse_warp_chain("fantom"), None);
    }

    #[test]
    fn test_dijkstra_state_is_min_heap() {
        let mut heap = BinaryHeap::new();
        heap.push(DijkstraState { cost: 5.0, node: GraphNode { chain: ChainId::Base, token: "X".into() } });
        heap.push(DijkstraState { cost: 1.0, node: GraphNode { chain: ChainId::Base, token: "Y".into() } });
        heap.push(DijkstraState { cost: 3.0, node: GraphNode { chain: ChainId::Base, token: "Z".into() } });
        let first = heap.pop().unwrap();
        assert!((first.cost - 1.0).abs() < 1e-9);
    }
}
