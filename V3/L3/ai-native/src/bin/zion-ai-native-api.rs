use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use zion_ai_native::{
    AgentMemory, EchoBackend, EmbeddingBackend, LlmBackend, LlmRequest, MemoryEntry,
    MemoryEventKind, MmlModality, MockEmbeddingBackend, RagDocument, VectorStore,
};
use zion_ai_native::llm_backend::RemoteHttpBackend;
use zion_ai_native::rag::EmbeddingInputType;

struct RagIndexState {
    store: VectorStore,
    last_indexed_at: Option<String>,
}

struct AppState {
    started_at: Instant,
    started_at_rfc3339: String,
    remote_backend: Option<RemoteHttpBackend>,
    remote_base_url: Option<String>,
    model: String,
    backend_mode: String,
    echo_backend: EchoBackend,
    memory: Mutex<AgentMemory>,
    rag: Mutex<RagIndexState>,
    request_count: AtomicU64,
    session_count: AtomicU64,
    node_rpc_addr: String,
    pool_api_url: String,
}

#[derive(Deserialize)]
struct ChatRequest {
    message: String,
}

#[derive(Deserialize)]
struct RagQueryRequest {
    query: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let bind = std::env::var("HIRANYAGARBHA_BIND")
        .unwrap_or_else(|_| "0.0.0.0:8001".to_string())
        .parse::<SocketAddr>()?;

    let state = Arc::new(AppState::from_env());
    seed_rag(&state)?;

    let app = Router::new()
        .route("/health", get(health))
        .route("/status", get(status))
        .route("/config", get(config))
        .route("/chat", post(chat))
        .route("/memory", get(memory_list))
        .route("/memory/flush", post(memory_flush))
        .route("/rag/index", post(rag_index))
        .route("/rag/query", post(rag_query))
        .route("/tasks", get(tasks))
        .route("/warp/status", get(warp_status))
        .route("/ncl/status", get(ncl_status))
        .route("/oasis/status", get(oasis_status))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(bind).await?;
    tracing::info!(%bind, "hiranyagarbha_api_ready");
    axum::serve(listener, app).await?;
    Ok(())
}

impl AppState {
    fn from_env() -> Self {
        let model = std::env::var("LLM_MODEL").unwrap_or_else(|_| "zion-expert".to_string());
        let base_url = std::env::var("LLM_BASE_URL").ok().filter(|v| !v.trim().is_empty());
        let api_key = std::env::var("NVIDIA_API_KEY").ok().filter(|v| !v.trim().is_empty());
        let backend_pref = std::env::var("HIRANYAGARBHA_BACKEND")
            .unwrap_or_else(|_| "auto".to_string());

        let remote_backend = if backend_pref.eq_ignore_ascii_case("echo") {
            None
        } else {
            base_url
                .as_ref()
                .and_then(|url| RemoteHttpBackend::new(url.clone(), model.clone(), api_key).ok())
        };

        let backend_mode = if remote_backend.is_some() {
            "remote+echo-fallback"
        } else {
            "echo-only"
        }
        .to_string();

        Self {
            started_at: Instant::now(),
            started_at_rfc3339: Utc::now().to_rfc3339(),
            remote_backend,
            remote_base_url: base_url,
            model,
            backend_mode,
            echo_backend: EchoBackend::new("hiranyagarbha-echo-fallback"),
            memory: Mutex::new(AgentMemory::with_defaults()),
            rag: Mutex::new(RagIndexState {
                store: VectorStore::new(),
                last_indexed_at: None,
            }),
            request_count: AtomicU64::new(0),
            session_count: AtomicU64::new(0),
            node_rpc_addr: std::env::var("ZION_NODE_RPC_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:8443".to_string()),
            pool_api_url: std::env::var("ZION_POOL_API_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string()),
        }
    }
}

fn seed_rag(state: &Arc<AppState>) -> anyhow::Result<()> {
    let docs = builtin_rag_documents();
    let embedder = MockEmbeddingBackend::new(24);
    let texts: Vec<&str> = docs.iter().map(|(_, text)| text.as_str()).collect();
    let embeddings = embedder
        .embed(&texts, EmbeddingInputType::Passage)
        .map_err(|err| anyhow::anyhow!(err.to_string()))?;

    let mut rag = state.rag.lock().expect("rag lock poisoned");
    rag.store = VectorStore::new();
    for ((id, text), embedding) in docs.into_iter().zip(embeddings.into_iter()) {
        rag.store.add(RagDocument::new(id, text, embedding));
    }
    rag.last_indexed_at = Some(Utc::now().to_rfc3339());
    Ok(())
}

fn builtin_rag_documents() -> Vec<(String, String)> {
    vec![
        (
            "stack/l1".to_string(),
            "L1 ZION TerraNova je Rust core, pool a miner. Node RPC bezi na portu 8443 a pool stratum na 3333.".to_string(),
        ),
        (
            "stack/l2".to_string(),
            "L2 vrstva obsahuje bridge, DAO a DeFi. Governance a treasury guard rails patri do L2, ne do L3.".to_string(),
        ),
        (
            "stack/l3".to_string(),
            "L3 vrstva obsahuje Hiranyagarbha AI Native runtime, WARP relaye a NCL compute lane. AI Native endpoint je standardne na portu 8001.".to_string(),
        ),
        (
            "ops/server".to_string(),
            "Produkce pouziva docker-compose.v3-mainnet.yml. Website bezi na 3000, pool API na 8080, bridge health na 9101 a agent health na 8001.".to_string(),
        ),
    ]
}

fn uptime_string(started_at: Instant) -> String {
    let secs = started_at.elapsed().as_secs();
    let hours = secs / 3600;
    let minutes = (secs % 3600) / 60;
    let seconds = secs % 60;
    format!("{:02}h {:02}m {:02}s", hours, minutes, seconds)
}

fn record_event(state: &AppState, kind: MemoryEventKind, summary: impl Into<String>, importance: f32) {
    let mut memory = state.memory.lock().expect("memory lock poisoned");
    memory.record(MemoryEntry::simple(kind, summary).with_importance(importance));
}

fn generate_answer(state: &AppState, prompt: String) -> Result<(String, String, Option<String>), String> {
    let request = LlmRequest::new(MmlModality::Text, prompt.clone())
        .with_system_prompt(
            "Jsi Hiranyagarbha, AI Native agent ZION site. Odpovidej presne, technicky a cesky. Kdyz chybi LLM backend, rekni to pravdive a drz se overenych faktu.",
        )
        .with_max_tokens(320)
        .with_temperature(0.3);

    if let Some(remote) = state.remote_backend.as_ref() {
        match remote.generate(request.clone()) {
            Ok(resp) => return Ok((resp.content, resp.backend_id, None)),
            Err(err) => {
                let fallback = state
                    .echo_backend
                    .generate(request)
                    .map_err(|e| e.to_string())?;
                let degraded = format!("remote backend unavailable: {}", err);
                let content = format!(
                    "Hiranyagarbha bezi v degradovanem rezimu. Remote LLM neni dostupne, proto vracim lokalni fallback odpoved.\n\n{}",
                    fallback.content
                );
                return Ok((content, fallback.backend_id, Some(degraded)));
            }
        }
    }

    let resp = state
        .echo_backend
        .generate(request)
        .map_err(|e| e.to_string())?;
    Ok((
        format!(
            "Hiranyagarbha bezi v echo-only rezimu. L3 runtime je online, ale plny LLM backend neni pripojen.\n\n{}",
            resp.content
        ),
        resp.backend_id,
        None,
    ))
}

async fn health(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "hiranyagarbha",
        "backend_mode": state.backend_mode,
        "model": state.model,
        "uptime": uptime_string(state.started_at),
    }))
}

async fn status(State(state): State<Arc<AppState>>) -> Json<Value> {
    let memory = state.memory.lock().expect("memory lock poisoned");
    let rag = state.rag.lock().expect("rag lock poisoned");

    Json(json!({
        "service": "hiranyagarbha",
        "sessions": state.session_count.load(Ordering::Relaxed),
        "requests": state.request_count.load(Ordering::Relaxed),
        "model": state.model,
        "backend_mode": state.backend_mode,
        "uptime": uptime_string(state.started_at),
        "started_at": state.started_at_rfc3339,
        "memory": {
            "short_term": memory.short_term_len(),
            "long_term": memory.long_term_len(),
            "total_recorded": memory.total_recorded,
            "avg_importance": memory.avg_importance(),
        },
        "rag": {
            "documents": rag.store.len(),
            "last_indexed_at": rag.last_indexed_at,
        }
    }))
}

async fn config(State(state): State<Arc<AppState>>) -> Json<Value> {
    let rag = state.rag.lock().expect("rag lock poisoned");
    Json(json!({
        "service": "hiranyagarbha",
        "backend_mode": state.backend_mode,
        "model": state.model,
        "remote_base_url": state.remote_base_url,
        "node_rpc_addr": state.node_rpc_addr,
        "pool_api_url": state.pool_api_url,
        "rag_documents": rag.store.len(),
    }))
}

async fn chat(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ChatRequest>,
) -> Json<Value> {
    let prompt = payload.message.trim().to_string();
    if prompt.is_empty() {
        return Json(json!({ "error": "empty message" }));
    }

    state.request_count.fetch_add(1, Ordering::Relaxed);
    state.session_count.fetch_add(1, Ordering::Relaxed);
    record_event(&state, MemoryEventKind::MessageReceived, format!("user: {}", prompt), 0.35);

    let state_for_gen = state.clone();
    let result = tokio::task::spawn_blocking(move || generate_answer(&state_for_gen, prompt.clone()))
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);

    match result {
        Ok((response, backend_id, degraded_reason)) => {
            record_event(
                &state,
                MemoryEventKind::MessageSent,
                format!("agent via {}", backend_id),
                0.4,
            );
            Json(json!({
                "response": response,
                "backend": backend_id,
                "degraded_reason": degraded_reason,
            }))
        }
        Err(err) => {
            record_event(
                &state,
                MemoryEventKind::TaskFailed,
                format!("chat failure: {}", err),
                0.7,
            );
            Json(json!({ "error": err }))
        }
    }
}

async fn memory_list(State(state): State<Arc<AppState>>) -> Json<Value> {
    let memory = state.memory.lock().expect("memory lock poisoned");
    let entries: Vec<Value> = memory
        .recent(25)
        .into_iter()
        .filter_map(|entry| serde_json::to_value(entry).ok())
        .collect();
    Json(json!({
        "entries": entries,
        "short_term": memory.short_term_len(),
        "long_term": memory.long_term_len(),
        "total_recorded": memory.total_recorded,
    }))
}

async fn memory_flush(State(state): State<Arc<AppState>>) -> Json<Value> {
    let mut memory = state.memory.lock().expect("memory lock poisoned");
    *memory = AgentMemory::with_defaults();
    Json(json!({ "ok": true, "message": "session memory flushed" }))
}

async fn rag_index(State(state): State<Arc<AppState>>) -> Json<Value> {
    match seed_rag(&state) {
        Ok(()) => {
            record_event(&state, MemoryEventKind::Custom("rag_index".to_string()), "rag index rebuilt", 0.5);
            let rag = state.rag.lock().expect("rag lock poisoned");
            Json(json!({
                "ok": true,
                "documents": rag.store.len(),
                "last_indexed_at": rag.last_indexed_at,
            }))
        }
        Err(err) => Json(json!({ "ok": false, "error": err.to_string() })),
    }
}

async fn rag_query(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RagQueryRequest>,
) -> Json<Value> {
    let query = payload.query.trim().to_string();
    if query.is_empty() {
        return Json(json!({ "error": "empty query" }));
    }

    let embedder = MockEmbeddingBackend::new(24);
    let query_embedding = match embedder.embed(&[query.as_str()], EmbeddingInputType::Query) {
        Ok(v) => v.into_iter().next().unwrap_or_default(),
        Err(err) => return Json(json!({ "error": err.to_string() })),
    };

    let rag = state.rag.lock().expect("rag lock poisoned");
    let hits: Vec<Value> = rag
        .store
        .search(&query_embedding, 3)
        .into_iter()
        .map(|doc| json!({ "id": doc.id, "content": doc.content, "metadata": doc.metadata }))
        .collect();

    Json(json!({ "query": query, "results": hits, "documents": rag.store.len() }))
}

async fn tasks(State(_state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({ "tasks": [], "queued": 0, "active": 0 }))
}

async fn warp_status(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "layer": "L3",
        "service": "warp",
        "status": "configured",
        "mode": "relay-ready",
        "upstream_node_rpc": state.node_rpc_addr,
    }))
}

async fn ncl_status(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "layer": "L3",
        "service": "ncl",
        "status": "configured",
        "mode": "compute-lane-ready",
        "pool_api_url": state.pool_api_url,
    }))
}

async fn oasis_status(State(_state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "layer": "L4",
        "service": "oasis",
        "status": "planned",
        "message": "Oasis symbolic layer is not deployed in this mainnet runtime.",
    }))
}