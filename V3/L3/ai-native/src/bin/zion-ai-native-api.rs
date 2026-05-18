use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use zion_ai_native::autotuner::DharmaAutotuner;
use zion_ai_native::consciousness_engine::ConsciousnessEngine;
use zion_ai_native::knowledge_base::KnowledgeConfig;
use zion_ai_native::llm_backend::RemoteHttpBackend;
use zion_ai_native::rag::EmbeddingInputType;
use zion_ai_native::{
    chunk_document_text, collect_markdown_chunks_from_relative_roots,
    BUDDHISM_CLASSICAL_CORPUS_ROOTS, BUDDHISM_RAG_CORPUS_ROOTS, BUDDHISM_TIBETAN_CORPUS_ROOTS,
};
use zion_ai_native::{
    EchoBackend, EmbeddingBackend, LlmBackend, LlmRequest, MemoryEntry, MemoryEventKind,
    MmlModality, MockEmbeddingBackend, RagDocument, VectorStore,
};

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
    consciousness_engine: Mutex<ConsciousnessEngine>,
    rag: Mutex<RagIndexState>,
    autotuner: Mutex<DharmaAutotuner>,
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
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let bind = std::env::var("HIRANYAGARBHA_BIND")
        .unwrap_or_else(|_| "0.0.0.0:8001".to_string())
        .parse::<SocketAddr>()?;

    let state = Arc::new(AppState::from_env());

    // Auto-seed RAG on startup
    if let Err(e) = seed_rag(&state) {
        tracing::error!(error = %e, "failed_to_auto_seed_rag");
    }

    // Spawn Autotune in background
    let autotune_state = state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        let mut tuner = autotune_state
            .autotuner
            .lock()
            .expect("autotuner lock poisoned");
        let rag = autotune_state.rag.lock().expect("rag lock poisoned");
        if let Some(llm) = autotune_state.remote_backend.as_ref() {
            let mut consciousness = autotune_state
                .consciousness_engine
                .lock()
                .expect("consciousness lock poisoned");
            if let Ok(report) = tuner.tune(llm, &rag.store, &mut consciousness.memory) {
                consciousness.on_autotune(&report);
            }
        }
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/status", get(status))
        .route("/config", get(config))
        .route("/chat", post(chat))
        .route("/memory", get(memory_list))
        .route("/memory/flush", post(memory_flush))
        .route("/rag/index", post(rag_index))
        .route("/rag/query", post(rag_query))
        .route("/rag/autotune", post(rag_autotune))
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
        let base_url = std::env::var("LLM_BASE_URL")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let api_key = std::env::var("NVIDIA_API_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let backend_pref =
            std::env::var("HIRANYAGARBHA_BACKEND").unwrap_or_else(|_| "auto".to_string());

        let remote_backend = if backend_pref.eq_ignore_ascii_case("echo") {
            None
        } else {
            base_url
                .as_ref()
                .and_then(|url| RemoteHttpBackend::new(url.clone(), model.clone(), api_key).ok())
        };

        let backend_mode = backend_pref.clone();

        Self {
            started_at: Instant::now(),
            started_at_rfc3339: Utc::now().to_rfc3339(),
            remote_backend,
            remote_base_url: base_url,
            model,
            backend_mode,
            echo_backend: EchoBackend::new("hiranyagarbha-echo-fallback"),
            consciousness_engine: Mutex::new(ConsciousnessEngine::new("hiranyagarbha-v2")),
            rag: Mutex::new(RagIndexState {
                store: VectorStore::new(),
                last_indexed_at: None,
            }),
            autotuner: Mutex::new(DharmaAutotuner::new()),
            request_count: AtomicU64::new(0),
            session_count: AtomicU64::new(0),
            node_rpc_addr: std::env::var("ZION_NODE_RPC_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:8443".to_string()),
            pool_api_url: std::env::var("ZION_POOL_API_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string()),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum BuddhismRagPreset {
    Off,
    All,
    Classical,
    Tibetan,
}

fn buddhism_rag_preset() -> BuddhismRagPreset {
    match std::env::var("ZION_RAG_BUDDHISM")
        .unwrap_or_default()
        .to_lowercase()
        .as_str()
    {
        "" | "0" | "false" | "no" => BuddhismRagPreset::Off,
        "classical" => BuddhismRagPreset::Classical,
        "tibetan" => BuddhismRagPreset::Tibetan,
        _ => BuddhismRagPreset::All,
    }
}

fn workspace_root_path() -> PathBuf {
    std::env::var("ZION_WORKSPACE_ROOT")
        .ok()
        .map(PathBuf::from)
        .filter(|p| !p.as_os_str().is_empty())
        .and_then(|p| p.canonicalize().ok())
        .or_else(|| {
            std::env::current_dir()
                .ok()
                .and_then(|p| p.canonicalize().ok())
        })
        .unwrap_or_else(|| PathBuf::from("."))
}

fn chunk_zion_docs_flag() -> bool {
    match std::env::var("ZION_RAG_CHUNK_DOCS").as_deref() {
        Ok("0") | Ok("false") | Ok("no") => false,
        Ok(_) => true,
        Err(_) => true,
    }
}

fn seed_rag(state: &Arc<AppState>) -> anyhow::Result<()> {
    tracing::info!("seeding_rag_start");
    let kb_cfg = KnowledgeConfig::default();
    let chunk_docs = chunk_zion_docs_flag();
    let mut entries: Vec<(String, String, HashMap<String, String>)> = Vec::new();

    match load_docs_from_disk() {
        Ok(docs) => {
            tracing::info!(count = docs.len(), "loaded_docs_from_disk");
            for (id, text) in docs {
                if chunk_docs && !text.trim().is_empty() {
                    let parts = chunk_document_text(&text, &kb_cfg);
                    if parts.is_empty() {
                        continue;
                    }
                    for (i, part) in parts.iter().enumerate() {
                        let chunk_id = if parts.len() == 1 {
                            id.clone()
                        } else {
                            format!("{}#chunk{}", id, i)
                        };
                        let mut m = HashMap::new();
                        m.insert("source".into(), "zion-docs".into());
                        m.insert("origin_path".into(), id.clone());
                        entries.push((chunk_id, part.clone(), m));
                    }
                } else {
                    let mut m = HashMap::new();
                    m.insert("source".into(), "zion-docs".into());
                    entries.push((id, text, m));
                }
            }
        }
        Err(err) => {
            tracing::warn!(error = %err, "failed_to_load_docs_from_disk_using_builtin");
            for (id, text) in builtin_rag_documents() {
                entries.push((id, text, HashMap::new()));
            }
        }
    }

    let ws = workspace_root_path();
    let preset = buddhism_rag_preset();
    if preset != BuddhismRagPreset::Off {
        let roots: &[&str] = match preset {
            BuddhismRagPreset::Classical => BUDDHISM_CLASSICAL_CORPUS_ROOTS,
            BuddhismRagPreset::Tibetan => BUDDHISM_TIBETAN_CORPUS_ROOTS,
            BuddhismRagPreset::All => BUDDHISM_RAG_CORPUS_ROOTS,
            BuddhismRagPreset::Off => unreachable!("preset Off filtered above"),
        };
        match collect_markdown_chunks_from_relative_roots(&ws, roots, &kb_cfg) {
            Ok(chunks) => {
                tracing::info!(
                    count = chunks.len(),
                    preset = ?preset,
                    workspace = %ws.display(),
                    "buddhism_rag_chunks_loaded"
                );
                for c in chunks {
                    entries.push((c.id, c.content, c.metadata));
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "buddhism_rag_scan_failed");
            }
        }
    }

    if entries.is_empty() {
        anyhow::bail!("rag seed has no documents");
    }

    let embedder = MockEmbeddingBackend::new(24);
    let texts: Vec<&str> = entries.iter().map(|(_, t, _)| t.as_str()).collect();
    let embeddings = embedder
        .embed(&texts, EmbeddingInputType::Passage)
        .map_err(|err| anyhow::anyhow!(err.to_string()))?;

    let mut rag = state.rag.lock().expect("rag lock poisoned");
    rag.store = VectorStore::new();
    for ((id, content, meta), embedding) in entries.into_iter().zip(embeddings.into_iter()) {
        let mut doc = RagDocument::new(id, content, embedding);
        doc.metadata = meta;
        rag.store.add(doc);
    }
    rag.last_indexed_at = Some(Utc::now().to_rfc3339());
    tracing::info!(total = rag.store.len(), "seeding_rag_complete");
    Ok(())
}

fn load_docs_from_disk() -> anyhow::Result<Vec<(String, String)>> {
    let mut docs = Vec::new();
    let base_path =
        std::env::var("ZION_DOCS_PATH").unwrap_or_else(|_| "/root/zion-2.9.6/docs".to_string());

    if !std::path::Path::new(&base_path).exists() {
        anyhow::bail!("Docs path not found");
    }

    for entry in walkdir::WalkDir::new(base_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "md"))
    {
        let path = entry.path();
        let content = std::fs::read_to_string(path)?;
        let id = path.to_string_lossy().to_string();
        docs.push((id, content));
    }

    if docs.is_empty() {
        anyhow::bail!("No markdown files found");
    }

    Ok(docs)
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
        (
            "terranova/seal6".to_string(),
            "TX_HASH_V2_ACTIVATION_HEIGHT a BODY_ROOT_V2_ACTIVATION_HEIGHT: v produkčním buildu (bez feature testnet_fork_rehearsal) jsou **0** — nový řetězec od genesis používá tx-hash v2 a BLAKE3 Merkle body root od prvního bloku. Rehearsal testnet používá cargo feature `testnet_fork_rehearsal` a sdílenou konečnou výšku v deeksha.rs. Další konsensusové pečetě (např. CHv4.2 dual-spin) mohou zůstat u64::MAX dokud je neaktivuje governance.".to_string(),
        ),
        (
            "terranova/dormant".to_string(),
            "Dormant kód v ZIONu není mrtvý kód, ale otestovaný a schválený upgrade, který je v repozitáři připraven k aktivaci v budoucnu. Je to civilizační závazek a nástroj pro bezpečný hard fork.".to_string(),
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

fn record_event(
    state: &AppState,
    kind: MemoryEventKind,
    summary: impl Into<String>,
    importance: f32,
) {
    let mut consciousness = state
        .consciousness_engine
        .lock()
        .expect("consciousness lock poisoned");
    consciousness
        .memory
        .record(MemoryEntry::simple(kind, summary).with_importance(importance));
}

fn generate_answer(
    state: &AppState,
    prompt: String,
) -> Result<(String, String, Option<String>), String> {
    let consciousness = state
        .consciousness_engine
        .lock()
        .expect("consciousness lock poisoned");
    let rag = state.rag.lock().expect("rag lock poisoned");

    // 1. Get RAG context
    let embedder = MockEmbeddingBackend::new(24);
    let query_embedding = embedder
        .embed(&[&prompt], EmbeddingInputType::Query)
        .map_err(|e| e.to_string())?
        .into_iter()
        .next()
        .unwrap_or_default();

    let hits = rag.store.search(&query_embedding, 2);
    let context = hits
        .iter()
        .map(|d| d.content.as_str())
        .collect::<Vec<_>>()
        .join("\n---\n");

    // 2. Build system prompt
    let mut system_prompt =
        "Jsi Hiranyagarbha, AI Native agent ZION site. Odpovidej presne, technicky a cesky."
            .to_string();

    // Try to use refined prompt from autotuner if it exists
    if let Ok(tuner) = state.autotuner.lock() {
        if let Some(report) = &tuner.last_report {
            system_prompt = report.refined_system_prompt.clone();
        }
    }

    let final_prompt = if context.is_empty() {
        prompt
    } else {
        format!(
            "KONTEXT Z DOKUMENTACE:\n{}\n---\nDOTAZ: {}",
            context, prompt
        )
    };

    let request = LlmRequest::new(MmlModality::Text, final_prompt)
        .with_system_prompt(system_prompt)
        .with_consciousness(consciousness.level.clone())
        .with_max_tokens(450)
        .with_temperature(0.2);

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
    let consciousness = state
        .consciousness_engine
        .lock()
        .expect("consciousness lock poisoned");
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
            "short_term": consciousness.memory.short_term_len(),
            "long_term": consciousness.memory.long_term_len(),
            "total_recorded": consciousness.memory.total_recorded,
            "avg_importance": consciousness.memory.avg_importance(),
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
        "zion_workspace_root": workspace_root_path().display().to_string(),
        "zion_rag_buddhism": std::env::var("ZION_RAG_BUDDHISM").unwrap_or_default(),
        "zion_rag_chunk_docs": chunk_zion_docs_flag(),
    }))
}

async fn chat(State(state): State<Arc<AppState>>, Json(req): Json<ChatRequest>) -> Json<Value> {
    let prompt = req.message.trim().to_string();
    if prompt.is_empty() {
        return Json(json!({ "error": "empty message" }));
    }

    state.request_count.fetch_add(1, Ordering::Relaxed);
    let result = generate_answer(&state, prompt.clone());
    let mut consciousness = state
        .consciousness_engine
        .lock()
        .expect("consciousness lock poisoned");
    match result {
        Ok((answer, context, source)) => {
            consciousness.memory.record(
                MemoryEntry::new(MemoryEventKind::MessageReceived, prompt, json!({}))
                    .with_importance(0.4),
            );
            consciousness.memory.record(
                MemoryEntry::new(MemoryEventKind::MessageSent, answer.clone(), json!({}))
                    .with_importance(0.5),
            );
            Json(json!({ "answer": answer, "context": context, "source": source }))
        }
        Err(err) => {
            consciousness.memory.record(
                MemoryEntry::new(
                    MemoryEventKind::TaskFailed,
                    "chat_request",
                    json!({ "error": err }),
                )
                .with_importance(0.8),
            );
            Json(json!({ "error": err }))
        }
    }
}

async fn memory_list(State(state): State<Arc<AppState>>) -> Json<Value> {
    let consciousness = state
        .consciousness_engine
        .lock()
        .expect("consciousness lock poisoned");
    Json(json!({ "memories": consciousness.memory.recall_all() }))
}

async fn memory_flush(State(state): State<Arc<AppState>>) -> Json<Value> {
    let mut consciousness = state
        .consciousness_engine
        .lock()
        .expect("consciousness lock poisoned");
    consciousness.memory.flush();
    Json(json!({ "ok": true }))
}

async fn rag_index(State(state): State<Arc<AppState>>) -> Json<Value> {
    match seed_rag(&state) {
        Ok(()) => {
            record_event(
                &state,
                MemoryEventKind::Custom("rag_index".to_string()),
                "rag index rebuilt",
                0.5,
            );
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

async fn rag_autotune(State(state): State<Arc<AppState>>) -> Json<Value> {
    let mut tuner = state.autotuner.lock().expect("autotuner lock poisoned");
    let rag = state.rag.lock().expect("rag lock poisoned");
    if let Some(llm) = state.remote_backend.as_ref() {
        let mut consciousness = state
            .consciousness_engine
            .lock()
            .expect("consciousness lock poisoned");
        match tuner.tune(llm, &rag.store, &mut consciousness.memory) {
            Ok(report) => {
                consciousness.on_autotune(&report);
                Json(json!({ "ok": true, "report": report }))
            }
            Err(err) => Json(json!({ "ok": false, "error": err.to_string() })),
        }
    } else {
        Json(json!({ "ok": false, "error": "No remote LLM backend available for autotuning" }))
    }
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
