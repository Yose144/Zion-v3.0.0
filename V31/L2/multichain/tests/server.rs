//! HTTP-level integration tests for the `zion-multichain` API gateway.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;
use zion_l1_types::Asset;
use zion_multichain::chain::adapter::ChainAdapterRegistry;
use zion_multichain::config::{MultichainConfig, ServerConfig};
use zion_multichain::server::ApiServer;
use zion_multichain::service::MultichainService;

fn test_service() -> Arc<MultichainService> {
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
    req.extensions_mut()
        .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 1234))));
    req
}

#[tokio::test]
async fn intent_http_lifecycle_happy_path() {
    let service = test_service();
    let server = ApiServer::new(ServerConfig::default(), service);
    let app = server.router();

    // 1. Deploy a ZION/USDC pool.
    let zion = Asset::native(zion_l1_types::ChainId::ZionL1, "ZION", 6, "ZION");
    let usdc = Asset::native(zion_l1_types::ChainId::ZionL1, "USDC", 6, "USD Coin");
    let pool_body = serde_json::json!({
        "id": 1,
        "asset_a": zion,
        "asset_b": usdc,
        "reserve_a": 100000000000_u64,
        "reserve_b": 1000000000000_u64,
        "fee_bps": 30,
    });
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

    // 2. Register a solver.
    let response = app
        .clone()
        .oneshot(build_request(
            "POST",
            "/v1/swap/intent/solver/register",
            r#"{"solver":"solver-a"}"#.to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);

    // 3. Create an intent.
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
    let response = app
        .clone()
        .oneshot(build_request(
            "POST",
            "/v1/swap/intent",
            create_body.to_string(),
        ))
        .await
        .expect("request ok");
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    if status != StatusCode::OK {
        let text = String::from_utf8_lossy(&bytes);
        panic!("create_intent failed: {}: {}", status, text);
    }

    let json: serde_json::Value = serde_json::from_slice(&bytes).expect("valid json");
    let intent_id = json["intent_id"].as_str().expect("intent_id").to_string();

    // 4. Submit a bid.
    let bid_body = serde_json::json!({
        "intent_id": intent_id,
        "solver": "solver-a",
        "amount_out": 1_100_000_u64,
        "fee_bps": 10,
        "timestamp": 0,
        "path": [{
            "chain": "zion",
            "dex": "amm",
            "from_token": zion.id,
            "to_token": usdc.id,
            "is_bridge": false,
        }],
    });
    let response = app
        .clone()
        .oneshot(build_request(
            "POST",
            &format!("/v1/swap/intent/{}/bid", intent_id),
            bid_body.to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);

    // 5. Execute the intent.
    let response = app
        .clone()
        .oneshot(build_request(
            "POST",
            &format!("/v1/swap/intent/{}/execute", intent_id),
            "".to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&bytes).expect("valid json");
    assert!(json["executed"].as_bool().unwrap_or(false));

    // 6. Fetch the intent and verify status.
    let response = app
        .clone()
        .oneshot(build_request(
            "GET",
            &format!("/v1/swap/intent/{}?auth=bypass", intent_id),
            "".to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&bytes).expect("valid json");
    assert_eq!(json["intent"]["status"], "executed");
}

#[tokio::test]
async fn http_solver_endpoint_returns_bid_for_valid_intent() {
    let service = test_service();
    let server = ApiServer::new(ServerConfig::default(), service);
    let app = server.router();

    // Deploy a ZION/USDC pool.
    let zion = Asset::native(zion_l1_types::ChainId::ZionL1, "ZION", 6, "ZION");
    let usdc = Asset::native(zion_l1_types::ChainId::ZionL1, "USDC", 6, "USD Coin");
    let pool_body = serde_json::json!({
        "id": 1,
        "asset_a": zion,
        "asset_b": usdc,
        "reserve_a": 100000000000_u64,
        "reserve_b": 1000000000000_u64,
        "fee_bps": 30,
    });
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

    // Ask the local solver endpoint to price a same-chain intent.
    let intent_id = uuid::Uuid::new_v4();
    let min_amount_out = 900_000_u128;
    let solve_body = serde_json::json!({
        "id": intent_id,
        "user": "zion1user",
        "from_asset": zion.id,
        "to_asset": usdc.id,
        "amount_in": 1_000_000_u64,
        "min_amount_out": min_amount_out,
        "deadline": u64::MAX,
        "nonce": 1,
        "signature": [],
        "status": "pending",
    });
    let response = app
        .clone()
        .oneshot(build_request(
            "POST",
            "/v1/swap/solve",
            solve_body.to_string(),
        ))
        .await
        .expect("request ok");
    assert_eq!(response.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let bid: zion_multichain::swap::dex::intent::SolverBid =
        serde_json::from_slice(&bytes).expect("valid SolverBid");
    assert_eq!(bid.intent_id, intent_id);
    assert_eq!(bid.path.len(), 1);
    assert_eq!(bid.path[0].from_token, zion.id);
    assert_eq!(bid.path[0].to_token, usdc.id);
    assert!(bid.amount_out.0 >= min_amount_out);
}
