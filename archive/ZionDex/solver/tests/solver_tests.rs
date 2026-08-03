//! Integration tests for the ZionDex Solver Daemon.
//!
//! These tests exercise the public API of the crate: config loading from env,
//! the router HTTP client (against a local mock server), bidding strategies,
//! stats tracking, and bid computation from a quote.

use std::net::SocketAddr;

use axum::{routing::get, Json, Router};
use ethers::types::U256;
use tokio::net::TcpListener;
use uuid::Uuid;
use ziondex_solver::config::SolverConfig;
use ziondex_solver::router_client::RouterClient;
use ziondex_solver::strategy::{BiddingStrategy, CompetitiveStrategy, FixedMarginStrategy};
use ziondex_solver::types::{
    AggregatedPath, ChainId, ExecutionResult, MultiPathQuote, SwapIntent, SwapStatus, TokenId,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Build a quote whose best path yields `output` (human-readable float).
fn make_quote(output: f64) -> MultiPathQuote {
    let path = AggregatedPath {
        steps: vec![],
        total_output: output,
        total_fee_bps: 30,
        estimated_time_secs: 10,
        bridge_hops: 0,
    };
    MultiPathQuote {
        quote_id: "qmp_test".into(),
        input_token: TokenId::Native {
            chain: ChainId::Zion,
            symbol: "ZION".into(),
        },
        input_amount: "1000".into(),
        output_token: TokenId::Token {
            chain: ChainId::Base,
            address: "0x0c49".into(),
            symbol: "wZION".into(),
            decimals: 18,
        },
        paths: vec![path],
        recommended_path_index: 0,
        expiry: chrono::Utc::now(),
    }
}

fn make_intent(min_out: U256) -> SwapIntent {
    SwapIntent::new(
        "0xuser",
        ChainId::Zion,
        ChainId::Base,
        "ZION",
        "wZION",
        U256::from(1000_000_000u64),
        min_out,
        now_secs() + 60,
        1,
    )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Config should pick up values from `ZION_SOLVER_*` env vars.
#[test]
fn test_config_from_env() {
    // Use a unique router URL so we can detect env pickup.
    std::env::set_var("ZION_SOLVER_ROUTER_URL", "http://env-router:9999");
    std::env::set_var("ZION_SOLVER_BIND", "127.0.0.1:8456");
    std::env::set_var("ZION_SOLVER_MIN_PROFIT_BPS", "7");
    std::env::set_var("ZION_SOLVER_MAX_GAS_GWEI", "42");
    std::env::set_var("ZION_SOLVER_AUCTION_TIMEOUT", "9");

    // clap reads env at parse time. We parse manually by constructing the
    // struct from env to keep the test deterministic (clap's `parse()` would
    // also read process argv, which may carry test harness flags).
    let cfg = SolverConfig {
        solver_key: std::env::var("ZION_SOLVER_KEY").ok(),
        solver_address: std::env::var("ZION_SOLVER_ADDRESS").ok(),
        router_url: std::env::var("ZION_SOLVER_ROUTER_URL").unwrap(),
        bind_address: std::env::var("ZION_SOLVER_BIND").unwrap(),
        min_profit_bps: std::env::var("ZION_SOLVER_MIN_PROFIT_BPS")
            .unwrap()
            .parse()
            .unwrap(),
        max_gas_gwei: std::env::var("ZION_SOLVER_MAX_GAS_GWEI")
            .unwrap()
            .parse()
            .unwrap(),
        auction_timeout_secs: std::env::var("ZION_SOLVER_AUCTION_TIMEOUT")
            .unwrap()
            .parse()
            .unwrap(),
    };

    let resolved = cfg.resolve().expect("env config resolves");
    assert_eq!(resolved.router_url, "http://env-router:9999");
    assert_eq!(resolved.bind_address, "127.0.0.1:8456");
    assert_eq!(resolved.min_profit_bps, 7);
    assert_eq!(resolved.max_gas_gwei, 42);
    assert_eq!(resolved.auction_timeout_secs, 9);

    // Cleanup.
    std::env::remove_var("ZION_SOLVER_ROUTER_URL");
    std::env::remove_var("ZION_SOLVER_BIND");
    std::env::remove_var("ZION_SOLVER_MIN_PROFIT_BPS");
    std::env::remove_var("ZION_SOLVER_MAX_GAS_GWEI");
    std::env::remove_var("ZION_SOLVER_AUCTION_TIMEOUT");
}

/// RouterClient.health() should return true against a mock `/health` endpoint.
#[tokio::test]
async fn test_router_client_health() {
    let app = Router::new().route(
        "/health",
        get(|| async {
            Json(serde_json::json!({
                "status": "ok",
                "version": "0.0.0-mock",
                "chains": ["zion", "base"],
                "uptime_secs": 1,
            }))
        }),
    );

    let addr: SocketAddr = "127.0.0.1:0".parse().unwrap();
    let listener = TcpListener::bind(addr).await.unwrap();
    let bound = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    let client = RouterClient::new(format!("http://{}", bound));
    let ok = client.health().await.expect("health call");
    assert!(ok, "mock router should report ok");
}

/// FixedMarginStrategy with 5 bps margin should subtract exactly 0.05% from the
/// router's best output.
#[test]
fn test_fixed_margin_strategy() {
    let strat = FixedMarginStrategy::new(5, "0xsolver");
    let quote = make_quote(1000.0);
    let intent = make_intent(U256::zero());
    let bid = strat.compute_bid(&intent, &quote).expect("bid");

    // raw = 1000 * 1e18 = 1e21; profit = 1e21 * 5 / 10000 = 5e17
    let raw = U256::from(1_000_000_000_000_000_000_000u128);
    let profit = raw * U256::from(5u64) / U256::from(10000u64);
    assert_eq!(bid.amount_out, raw - profit);
    assert_eq!(bid.solver, "0xsolver");
    assert_eq!(bid.intent_id, intent.id);
}

/// CompetitiveStrategy should adjust the margin based on gas price.
#[test]
fn test_competitive_strategy() {
    let strat = CompetitiveStrategy::new(5, 50, "0xsolver");
    // gas = max/2 = 25 -> ratio 50% -> margin = 5 + 5*50/100 = 7 bps
    assert_eq!(strat.margin_for_gas(25), 7);
    // At zero gas, margin is the minimum.
    assert_eq!(strat.margin_for_gas(0), 5);
    // At max gas, margin doubles.
    assert_eq!(strat.margin_for_gas(50), 10);

    let quote = make_quote(1000.0);
    let intent = make_intent(U256::zero());
    let bid = strat.compute_bid(&intent, &quote).expect("bid");
    let raw = U256::from(1_000_000_000_000_000_000_000u128);
    let profit = raw * U256::from(7u64) / U256::from(10000u64);
    assert_eq!(bid.amount_out, raw - profit);
}

/// SolverStats should track bids, wins, losses, and execution outcomes.
#[test]
fn test_solver_stats_tracking() {
    use ziondex_solver::types::SolverStats;
    let mut stats = SolverStats::new();

    stats.observe_intent();
    stats.observe_intent();
    stats.record_bid();
    stats.record_bid();
    stats.record_bid();
    stats.record_win();
    stats.record_loss();
    stats.record_loss();

    assert_eq!(stats.intents_seen, 2);
    assert_eq!(stats.bids_submitted, 3);
    assert_eq!(stats.auctions_won, 1);
    assert_eq!(stats.auctions_lost, 2);

    // Record a successful execution with profit + gas.
    let res = ExecutionResult {
        intent_id: Uuid::new_v4(),
        swap_id: Some("swap_1".into()),
        status: SwapStatus::Completed,
        amount_out: U256::from(100u64),
        profit: U256::from(42u64),
        gas_cost: U256::from(7u64),
        completed_at: now_secs(),
        error: None,
    };
    stats.record_execution(&res);
    assert_eq!(stats.executions_succeeded, 1);
    assert_eq!(stats.total_profit, "42");
    assert_eq!(stats.total_gas_cost, "7");

    // A failed execution bumps the failed counter.
    let fail = ExecutionResult {
        status: SwapStatus::Failed,
        ..res
    };
    stats.record_execution(&fail);
    assert_eq!(stats.executions_failed, 1);
}

/// Bid computation from a quote end-to-end (strategy -> SolverBid shape).
#[test]
fn test_bid_computation() {
    let strat = FixedMarginStrategy::new(10, "0xsolver");
    let quote = make_quote(500.0);
    let intent = make_intent(U256::zero());
    let bid = strat.compute_bid(&intent, &quote).expect("bid");

    // 10 bps margin on 500 * 1e18.
    let raw = U256::from(500_000_000_000_000_000_000u128);
    let profit = raw * U256::from(10u64) / U256::from(10000u64);
    assert_eq!(bid.amount_out, raw - profit);
    // Bid must satisfy the intent minimum (zero here).
    assert!(bid.amount_out >= intent.min_amount_out);
    // Bid references the intent.
    assert_eq!(bid.intent_id, intent.id);
    // Timestamp is recent.
    assert!(bid.timestamp > 0);
}
