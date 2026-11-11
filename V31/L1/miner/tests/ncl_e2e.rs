//! E2E: miner ↔ NCL (opt-in spike) proti **reálnému** axum serveru.
//!
//! Ověřuje celý řetěz, který dřív v kódu neexistoval (`V33_GAP_ANALYSIS.md`
//! §N3 „miner nemá žádnou referenci na NCL"):
//!
//! 1. server založí frontu a přijme job přes `POST /jobs`,
//! 2. miner se zaregistruje pod **svým** id (`POST /workers` s `id`),
//! 3. miner si job vyzvedne (`GET /jobs/next/:worker_id`),
//! 4. spočítá `blake3(input_hash)` a nahlásí `POST /jobs/:id/complete`,
//! 5. job skončí `Completed` s tím správným `output_hash`.
//!
//! Test záměrně netestuje odměny — spike žádnou payout cestu nemá.

use std::time::Duration;

use zion_ncl::api::{create_router, NclAppState};
use zion_ncl::{JobScheduler, ReputationRegistry};

/// Jak dlouho čekat, než se job dokončí (poll 250 ms × 60 = 15 s strop).
const WAIT_STEPS: usize = 60;
const WAIT_STEP: Duration = Duration::from_millis(250);

#[tokio::test]
async fn miner_claims_job_and_reports_completion() {
    // ── server ────────────────────────────────────────────────────────
    let state = NclAppState::ephemeral(JobScheduler::new(100), ReputationRegistry::new());
    let app = create_router(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind ephemeral port");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    let base = format!("http://{addr}");
    let client = reqwest::Client::new();

    // ── job do fronty (přes veřejné API, jako to dělá submitter) ───────
    let submit = client
        .post(format!("{base}/jobs"))
        .json(&serde_json::json!({
            "submitter": "zion1user",
            "model_id": "spike-model",
            "backend": "Custom",
            "input_hash": "abc123",
            "reward_flowers": 1000,
            "max_duration_secs": 30
        }))
        .send()
        .await
        .expect("POST /jobs");
    assert!(submit.status().is_success(), "submit: {}", submit.status());
    let job_id = submit
        .json::<serde_json::Value>()
        .await
        .expect("submit json")["job_id"]
        .as_str()
        .expect("job_id")
        .to_string();

    // ── miner loop ────────────────────────────────────────────────────
    let config = zion_miner::ncl::NclConfig {
        url: base.clone(),
        worker_id: "miner-e2e".into(),
        address: "zion1miner".into(),
        backends: vec!["custom".into()],
        max_concurrent: 1,
        poll: Duration::from_millis(250),
        http_timeout: Duration::from_millis(2000),
    };
    tokio::spawn(zion_miner::ncl::run_loop(config));

    // ── čekej na dokončení ────────────────────────────────────────────
    let expected = blake3::hash(b"abc123").to_hex().to_string();
    let mut final_status = String::new();
    let mut output_hash = String::new();
    let mut worker_seen = false;

    for _ in 0..WAIT_STEPS {
        tokio::time::sleep(WAIT_STEP).await;
        let job = client
            .get(format!("{base}/jobs/{job_id}"))
            .send()
            .await
            .expect("GET /jobs/:id")
            .json::<serde_json::Value>()
            .await
            .expect("job json");

        final_status = job["status"].as_str().unwrap_or_default().to_string();
        output_hash = job["output_hash"].as_str().unwrap_or_default().to_string();
        if job["worker_id"].as_str() == Some("miner-e2e") {
            worker_seen = true;
        }
        if final_status == "Completed" {
            break;
        }
    }

    assert!(
        worker_seen,
        "job nepřevzal miner pod svým id (worker_id v jobu chybí)"
    );
    assert_eq!(final_status, "Completed", "job nedoběhl do Completed");
    assert_eq!(
        output_hash, expected,
        "output_hash neodpovídá blake3(input_hash)"
    );

    // Worker si po dokončení uvolnil kapacitu → další poll vrací 204.
    let empty = client
        .get(format!("{base}/jobs/next/miner-e2e"))
        .send()
        .await
        .expect("GET /jobs/next");
    assert_eq!(empty.status().as_u16(), 204, "prázdná fronta = 204");
}
