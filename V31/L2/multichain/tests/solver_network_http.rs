//! End-to-end HTTP solver network test.
//!
//! Spawns a real solver `ApiServer`, registers it with a buyer `ApiServer`,
//! and exercises `HttpSolverClient` through the `/v1/swap/intent/:id/broadcast`
//! route. The winning bid is auto-submitted and then executed on the buyer.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;
use zion_l1_types::{Amount, Asset, ChainId};
use zion_multichain::chain::adapter::ChainAdapterRegistry;
use zion_multichain::config::{MultichainConfig, ServerConfig};
use zion_multichain::server::ApiServer;
use zion_multichain::service::MultichainService;

fn build_service() -> Arc<MultichainService> {
    let mut config = MultichainConfig::default();
    config.l1_rpc_url = String::new();
    config.database.path = ":memory:".to_string();

    Arc::new(
        MultichainService::new_with_adapters(config, ChainAdapterRegistry::new())
            .expect("in-memory service builds"),
    )
}

fn build_request(method: &str, uri: &str, body: String) -> Request<Body> {
    let mut req = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(body))
        .expect("valid request");
    req.extensions_mut().insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 1234))));
    req
}

async fn read_json(response: axum::response::Response<Body>) -> serde_json::Value {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).expect("valid json")
}

#[tokio::test]
async fn http_solver_client_bids_and_buyer_executes() {
    // --- Solver node -------------------------------------------------------
    let solver_service = build_service();
    let solver_server = ApiServer::new(ServerConfig::default(), Arc::clone(&solver_service));
    let solver_app = solver_server.router();

    // --- Buyer node --------------------------------------------------------
    let buyer_service = build_service();
    let buyer_server = ApiServer::new(ServerConfig::default(), Arc::clone(&buyer_service));
    let buyer_app = buyer_server.router();

    let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
    let usdc = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");

    let pool_body = serde_json::json!({
        "id": 1,
        "asset_a": zion,
        "asset_b": usdc,
        "reserve_a": 100000000000_u64,
        "reserve_b": 1000000000000_u64,
        "fee_bps": 30,
    });

    // Seed both routers with the same AMM pool.
    for app in [&solver_app, &buyer_app] {
        let response = app
            .clone()
            .oneshot(build_request(
                "POST",
                "/v1/swap/pool/deploy",
                pool_body.to_string(),
            ))
            .await
            .expect("request ok");
        assert_eq!(response.status(), StatusCode::OK);
    }

    // Start the solver server on a random local port.
    let solver_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let solver_addr = solver_listener.local_addr().unwrap();
    let solver_url = format!("http://{}", solver_addr);

    tokio::spawn(async move {
        axum::serve(
            solver_listener,
            solver_app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });

    // Register the live solver in the buyer registry.
    let register_body = serde_json::json!({
        "solver": "zion-solver",
        "url": solver_url,
        "reputation": 100,
    });
    let response = buyer_app
        .clone()
        .oneshot(build_request(
            "POST",
            "/v1/swap/intent/solver/register",
            register_body.to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);

    // Open an intent on the buyer.
    let create_body = serde_json::json!({
        "user": "zion1user",
        "from_chain": "zion",
        "from_ticker": "ZION",
        "from_contract": null,
        "to_chain": "zion",
        "to_ticker": "USDC",
        "to_contract": null,
        "amount_in": 1_000_000_u64,
        "min_amount_out": 900_000_u64,
        "deadline": u64::MAX,
        "nonce": 1,
    });
    let response = buyer_app
        .clone()
        .oneshot(build_request("POST", "/v1/swap/intent", create_body.to_string()))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);
    let json = read_json(response).await;
    let intent_id = json["intent_id"].as_str().unwrap().to_string();

    // Broadcast the intent over HTTP. The buyer's HttpSolverClient calls the
    // solver's /v1/swap/solve endpoint, receives a SolverBid, and auto-submits
    // it to the local auction.
    let response = buyer_app
        .clone()
        .oneshot(build_request(
            "POST",
            &format!("/v1/swap/intent/{}/broadcast", intent_id),
            "".to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);
    let json = read_json(response).await;
    let results = json["results"].as_array().expect("results array");
    let bids = results
        .iter()
        .filter(|r| r["status"] == "bid")
        .count();
    assert_eq!(bids, 1, "exactly one solver should bid");

    // Execute the winning bid.
    let response = buyer_app
        .clone()
        .oneshot(build_request(
            "POST",
            &format!("/v1/swap/intent/{}/execute", intent_id),
            "".to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);
    let json = read_json(response).await;
    assert!(json["executed"].as_bool().unwrap_or(false));
    let out = json["out"].as_str().and_then(|s| s.parse::<u128>().ok()).unwrap_or(0);
    assert!(out >= 900_000, "executed output {} should meet minimum", out);

    // Confirm intent is marked executed.
    let response = buyer_app
        .clone()
        .oneshot(build_request(
            "GET",
            &format!("/v1/swap/intent/{}?auth=bypass", intent_id),
            "".to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);
    let json = read_json(response).await;
    assert_eq!(json["intent"]["status"], "executed");

    // Verify the buyer received the expected output amount.
    let intent = buyer_service.get_intent(intent_id.parse().unwrap()).await.unwrap();
    let executed = zion_l1_types::Amount::new(out);
    assert!(executed >= Amount::new(900_000));
    assert_eq!(intent.status, zion_multichain::swap::dex::intent::IntentStatus::Executed);
}
