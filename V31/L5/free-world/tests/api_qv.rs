//! HTTP integration tests for quadratic voting + write-key auth.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tower::ServiceExt;
use zion_free_world::api::{free_world_router, AppState};
use zion_free_world::db::{FreeWorldDb, GrantRecord};
use zion_free_world::hiran_bridge::FreeWorldHiranBridge;
use zion_free_world::metrics::FreeWorldMetrics;
use zion_free_world::FreeWorldConfig;

const KEY: &str = "test-write-key";

fn test_app(api_key: &str) -> (axum::Router, Arc<Mutex<FreeWorldDb>>) {
    let cfg = FreeWorldConfig::default();
    let db = Arc::new(Mutex::new(FreeWorldDb::open(":memory:").unwrap()));
    let state = AppState {
        db: db.clone(),
        api_key: api_key.to_string(),
        metrics: Arc::new(FreeWorldMetrics::new()),
        hiran: Arc::new(FreeWorldHiranBridge::new(&cfg)),
        config: cfg,
    };
    (free_world_router(state), db)
}

fn request(method: &str, uri: &str, api_key: Option<&str>, body: Option<Value>) -> Request<Body> {
    let mut b = Request::builder().method(method).uri(uri);
    if let Some(k) = api_key {
        b = b.header("x-api-key", k);
    }
    match body {
        Some(v) => b
            .header("content-type", "application/json")
            .body(Body::from(v.to_string()))
            .unwrap(),
        None => b.body(Body::empty()).unwrap(),
    }
}

async fn body_json(resp: axum::response::Response) -> Value {
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

fn seed_grant(db: &Arc<Mutex<FreeWorldDb>>, title: &str, amount: u64, approved: bool) -> String {
    let grant = GrantRecord::new(title, "humanitarian", amount);
    let id = grant.id.clone();
    let db = db.lock().unwrap();
    db.insert_grant(&grant).unwrap();
    if approved {
        db.update_grant_status(&id, "approved", None).unwrap();
    }
    id
}

async fn create_round(app: &axum::Router, grant_ids: Vec<String>) -> (StatusCode, Value) {
    let resp = app
        .clone()
        .oneshot(request(
            "POST",
            "/api/v1/rounds",
            Some(KEY),
            Some(json!({
                "title": "Test round",
                "credits_per_voter": 100,
                "matching_pool_zion": 1000,
                "grant_ids": grant_ids,
            })),
        ))
        .await
        .unwrap();
    let status = resp.status();
    (status, body_json(resp).await)
}

async fn open_round(app: &axum::Router, id: &str) -> StatusCode {
    app.clone()
        .oneshot(request(
            "POST",
            &format!("/api/v1/rounds/{id}/open"),
            Some(KEY),
            None,
        ))
        .await
        .unwrap()
        .status()
}

async fn cast_ballot(
    app: &axum::Router,
    id: &str,
    voter: &str,
    votes: Value,
) -> (StatusCode, Value) {
    let resp = app
        .clone()
        .oneshot(request(
            "POST",
            &format!("/api/v1/rounds/{id}/ballots"),
            Some(KEY),
            Some(json!({ "voter_id": voter, "votes": votes })),
        ))
        .await
        .unwrap();
    let status = resp.status();
    (status, body_json(resp).await)
}

// ── write auth ──

#[tokio::test]
async fn post_without_key_returns_401() {
    let (app, _db) = test_app(KEY);
    let resp = app
        .oneshot(request(
            "POST",
            "/api/v1/rounds",
            None,
            Some(json!({"title": "x", "matching_pool_zion": 1, "grant_ids": ["g"]})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn post_with_wrong_key_returns_401() {
    let (app, _db) = test_app(KEY);
    let resp = app
        .oneshot(request(
            "POST",
            "/api/v1/rounds",
            Some("wrong-key"),
            Some(json!({"title": "x", "matching_pool_zion": 1, "grant_ids": ["g"]})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn empty_configured_key_returns_503() {
    let (app, _db) = test_app("");
    let resp = app
        .oneshot(request(
            "POST",
            "/api/v1/rounds",
            Some(KEY),
            Some(json!({"title": "x", "matching_pool_zion": 1, "grant_ids": ["g"]})),
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body = body_json(resp).await;
    assert_eq!(
        body["error"],
        "write API disabled: FREE_WORLD_API_KEY not set"
    );
}

#[tokio::test]
async fn get_rounds_is_public() {
    let (app, _db) = test_app(KEY);
    let resp = app
        .oneshot(request("GET", "/api/v1/rounds", None, None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn health_and_metrics_public() {
    let (app, _db) = test_app(KEY);
    for uri in ["/health", "/metrics"] {
        let resp = app
            .clone()
            .oneshot(request("GET", uri, None, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK, "{uri}");
    }
}

#[tokio::test]
async fn existing_grant_post_requires_key() {
    let (app, _db) = test_app(KEY);
    let body = json!({"title": "G", "category": "c", "amount_zion": 5});
    let resp = app
        .clone()
        .oneshot(request("POST", "/api/v1/grants", None, Some(body.clone())))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    let resp = app
        .oneshot(request("POST", "/api/v1/grants", Some(KEY), Some(body)))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
}

// ── round lifecycle ──

#[tokio::test]
async fn create_round_rejects_non_approved_grant() {
    let (app, db) = test_app(KEY);
    let pending = seed_grant(&db, "Pending", 100, false);
    let (status, _) = create_round(&app, vec![pending]).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn create_round_rejects_unknown_grant() {
    let (app, _db) = test_app(KEY);
    let (status, _) = create_round(&app, vec!["no-such-grant".to_string()]).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ballot_on_draft_then_open_then_close() {
    let (app, db) = test_app(KEY);
    let g1 = seed_grant(&db, "G1", 10_000, true);
    let g2 = seed_grant(&db, "G2", 10_000, true);

    let (status, body) = create_round(&app, vec![g1.clone(), g2.clone()]).await;
    assert_eq!(status, StatusCode::CREATED);
    let round_id = body["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(body["data"]["status"], "draft");

    // Ballot on draft → 409
    let (status, _) = cast_ballot(
        &app,
        &round_id,
        "voter-a",
        json!([{"grant_id": g1, "votes": 3}]),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // Open → ballot ok
    assert_eq!(open_round(&app, &round_id).await, StatusCode::OK);

    let (status, body) = cast_ballot(
        &app,
        &round_id,
        "voter-a",
        json!([{"grant_id": g1, "votes": 3}, {"grant_id": g2, "votes": 4}]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["credits_spent"], 25);
    assert_eq!(body["data"]["credits_remaining"], 75);
    assert_eq!(body["data"]["voter_id"], "voter-a");

    // Resubmission replaces the voter's ballot.
    let (status, _) = cast_ballot(
        &app,
        &round_id,
        "voter-a",
        json!([{"grant_id": g2, "votes": 2}]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = cast_ballot(
        &app,
        &round_id,
        "voter-b",
        json!([{"grant_id": g1, "votes": 1}]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Results not available pre-close.
    let resp = app
        .clone()
        .oneshot(request(
            "GET",
            &format!("/api/v1/rounds/{round_id}/results"),
            None,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CONFLICT);

    // Close.
    let resp = app
        .clone()
        .oneshot(request(
            "POST",
            &format!("/api/v1/rounds/{round_id}/close"),
            Some(KEY),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    let results = &body["data"];
    // Only the LATEST ballot of voter-a counts: g1:1 vote (voter-b), g2:2 (voter-a).
    assert_eq!(results["ballots"], 2);
    assert_eq!(results["total_votes"], 3);
    assert_eq!(
        results["allocated_zion"].as_u64().unwrap() + results["unallocated_zion"].as_u64().unwrap(),
        1000
    );
    let grants = results["grants"].as_array().unwrap();
    let g1_tally = grants.iter().find(|g| g["grant_id"] == g1).unwrap();
    let g2_tally = grants.iter().find(|g| g["grant_id"] == g2).unwrap();
    assert_eq!(g1_tally["votes"], 1);
    assert_eq!(g1_tally["voters"], 1);
    assert_eq!(g2_tally["votes"], 2);
    assert_eq!(g2_tally["voters"], 1);

    // Ballot on closed → 409.
    let (status, _) = cast_ballot(
        &app,
        &round_id,
        "voter-c",
        json!([{"grant_id": g1, "votes": 1}]),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // Open a closed round → 409.
    assert_eq!(open_round(&app, &round_id).await, StatusCode::CONFLICT);

    // Results are served frozen.
    let resp = app
        .clone()
        .oneshot(request(
            "GET",
            &format!("/api/v1/rounds/{round_id}/results"),
            None,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let frozen = body_json(resp).await["data"].clone();
    assert_eq!(frozen, *results);
}

#[tokio::test]
async fn results_frozen_after_grant_change() {
    let (app, db) = test_app(KEY);
    let g1 = seed_grant(&db, "G1", 10_000, true);
    let (status, body) = create_round(&app, vec![g1.clone()]).await;
    assert_eq!(status, StatusCode::CREATED);
    let round_id = body["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(open_round(&app, &round_id).await, StatusCode::OK);
    cast_ballot(&app, &round_id, "v", json!([{"grant_id": g1, "votes": 2}])).await;
    app.clone()
        .oneshot(request(
            "POST",
            &format!("/api/v1/rounds/{round_id}/close"),
            Some(KEY),
            None,
        ))
        .await
        .unwrap();

    let resp = app
        .clone()
        .oneshot(request(
            "GET",
            &format!("/api/v1/rounds/{round_id}/results"),
            None,
            None,
        ))
        .await
        .unwrap();
    let before = body_json(resp).await["data"].clone();

    // Mutate the grant — results must not change.
    {
        let db = db.lock().unwrap();
        db.update_grant_status(&g1, "rejected", None).unwrap();
    }

    let resp = app
        .clone()
        .oneshot(request(
            "GET",
            &format!("/api/v1/rounds/{round_id}/results"),
            None,
            None,
        ))
        .await
        .unwrap();
    let after = body_json(resp).await["data"].clone();
    assert_eq!(before, after);
}

#[tokio::test]
async fn unknown_round_is_404_everywhere() {
    let (app, _db) = test_app(KEY);
    for (method, uri, key) in [
        ("GET", "/api/v1/rounds/nope", None),
        ("GET", "/api/v1/rounds/nope/results", None),
        ("POST", "/api/v1/rounds/nope/open", Some(KEY)),
        ("POST", "/api/v1/rounds/nope/close", Some(KEY)),
    ] {
        let resp = app
            .clone()
            .oneshot(request(method, uri, key, None))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND, "{method} {uri}");
    }
    let (status, _) = cast_ballot(&app, "nope", "v", json!([{"grant_id": "g", "votes": 1}])).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn invalid_ballot_is_400() {
    let (app, db) = test_app(KEY);
    let g1 = seed_grant(&db, "G1", 10_000, true);
    let (_, body) = create_round(&app, vec![g1.clone()]).await;
    let round_id = body["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(open_round(&app, &round_id).await, StatusCode::OK);

    // unknown grant
    let (status, _) = cast_ballot(
        &app,
        &round_id,
        "v",
        json!([{"grant_id": "xx", "votes": 1}]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    // over budget: 11² = 121 > 100 credits
    let (status, _) =
        cast_ballot(&app, &round_id, "v", json!([{"grant_id": g1, "votes": 11}])).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    // empty ballot
    let (status, _) = cast_ballot(&app, &round_id, "v", json!([])).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}
