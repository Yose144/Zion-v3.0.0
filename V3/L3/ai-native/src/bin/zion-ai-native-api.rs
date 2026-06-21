use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use zion_ai_native::autotuner::DharmaAutotuner;
use zion_ai_native::consciousness_engine::ConsciousnessEngine;
use zion_ai_native::knowledge_base::KnowledgeConfig;
use zion_ai_native::llm_backend::RemoteHttpBackend;
use zion_ai_native::orchestrator::Orchestrator;
use zion_ai_native::rag::EmbeddingInputType;
use zion_ai_native::task::{AiTask, AiTaskType, TaskQueue};
use zion_ai_native::types::{Agent, AgentCapability};
use zion_ai_native::{
    chunk_document_text, collect_markdown_chunks_from_relative_roots,
    BUDDHISM_CLASSICAL_CORPUS_ROOTS, BUDDHISM_RAG_CORPUS_ROOTS, BUDDHISM_TIBETAN_CORPUS_ROOTS,
};
use zion_ai_native::{
    EchoBackend, EmbeddingBackend, LlmBackend, LlmRequest, MemoryEntry, MemoryEventKind,
    MmlModality, MockEmbeddingBackend, RagDocument, VectorStore,
};
use zion_ncl::{
    create_router as ncl_router, JobScheduler, NclAppState, PricingEngine, ReputationRegistry,
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
    orchestrator: Mutex<Orchestrator>,
    task_queue: Mutex<TaskQueue>,
    ncl_state: NclAppState,
    ncl_pricing: PricingEngine,
}

#[derive(Deserialize)]
struct ChatRequest {
    message: String,
}

#[derive(Deserialize)]
struct RagQueryRequest {
    query: String,
}

// ─── Orchestrator request types ───────────────────────────────────────────────

#[derive(Deserialize)]
struct RegisterAgentRequest {
    name: String,
    owner: String,
    wallet_address: String,
    #[serde(default)]
    staked_zion: u64,
}

#[derive(Deserialize)]
struct GrantCapabilityRequest {
    capability: String,
}

#[derive(Deserialize)]
struct ElevateConsciousnessRequest {
    level: u8,
}

#[derive(Deserialize)]
struct DispatchTaskRequest {
    task_type: String,
    model_id: String,
    submitter: String,
    input: Value,
    #[serde(default = "default_reward")]
    reward_flowers: u64,
    #[serde(default = "default_priority")]
    priority: u8,
    #[serde(default = "default_consciousness")]
    required_consciousness: u8,
}

fn default_reward() -> u64 {
    1_000
}
fn default_priority() -> u8 {
    5
}
fn default_consciousness() -> u8 {
    1
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

    // Mount full NCL router at /ncl/* (scheduler, jobs, workers, leaderboard)
    let ncl_app = ncl_router(state.ncl_state.clone());

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
        .route("/tasks/dispatch", post(tasks_dispatch))
        .route("/warp/status", get(warp_status))
        .route("/ncl/status", get(ncl_status))
        .route("/ncl/price", get(ncl_price))
        .route("/oasis/status", get(oasis_status))
        // ── Orchestrator: agent management ────────────────────────────────
        .route("/agents", get(agents_list).post(agents_register))
        .route("/agents/:id", get(agents_get).delete(agents_terminate))
        .route("/agents/:id/capabilities", post(agents_grant_capability))
        .route(
            "/agents/:id/consciousness",
            get(agents_get_consciousness).post(agents_elevate_consciousness),
        )
        .route("/agents/:id/messages", get(agents_get_messages))
        // ── Orchestrator: status ──────────────────────────────────────────
        .route("/orchestrator/status", get(orchestrator_status))
        // ── Telemetry + Optimizer (agent-cli L3 integration) ─────────────────
        .route("/telemetry", get(telemetry_handler))
        .route("/optimizer/run", post(optimizer_run_handler))
        .with_state(state)
        // ── NCL: Neural Compute Layer (full API at /ncl/*) ────────────────
        .nest("/ncl", ncl_app);

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

        let max_agents = std::env::var("HIRANYAGARBHA_MAX_AGENTS")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(100);

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
            orchestrator: Mutex::new(Orchestrator::new(max_agents)),
            task_queue: Mutex::new(TaskQueue::new()),
            ncl_state: NclAppState {
                scheduler: Arc::new(Mutex::new(JobScheduler::new(1000))),
                reputation: Arc::new(Mutex::new(ReputationRegistry::new())),
            },
            ncl_pricing: PricingEngine::with_defaults(),
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
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "md"))
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
        .with_consciousness(consciousness.level)
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

async fn tasks(State(state): State<Arc<AppState>>) -> Json<Value> {
    let q = state.task_queue.lock().expect("task_queue lock poisoned");
    Json(json!({ "tasks": [], "queued": q.len(), "active": 0 }))
}

// ─── Orchestrator handlers ─────────────────────────────────────────────────

async fn orchestrator_status(State(state): State<Arc<AppState>>) -> Json<Value> {
    let orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    let status = orch.coordinate();
    let q = state.task_queue.lock().expect("task_queue lock poisoned");
    Json(json!({
        "layer": "L3",
        "service": "orchestrator",
        "status": "active",
        "agents": {
            "active": status.active_agents,
            "suspended": status.suspended_agents,
            "terminated": status.terminated_agents,
            "total_actions": status.total_actions,
        },
        "message_queue": status.queued_messages,
        "task_queue": q.len(),
        "max_agents": 100,
    }))
}

async fn agents_list(State(state): State<Arc<AppState>>) -> Json<Value> {
    let orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    let status = orch.coordinate();
    Json(json!({
        "total": orch.total_count(),
        "active": status.active_agents,
        "suspended": status.suspended_agents,
        "terminated": status.terminated_agents,
    }))
}

async fn agents_register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterAgentRequest>,
) -> Json<Value> {
    let mut agent = Agent::new(req.name, req.owner, req.wallet_address);
    agent.staked_zion = req.staked_zion;
    let mut orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    match orch.register_agent(agent) {
        Ok(id) => {
            tracing::info!(%id, "agent_registered");
            Json(json!({ "ok": true, "agent_id": id.to_string() }))
        }
        Err(e) => Json(json!({ "ok": false, "error": e.to_string() })),
    }
}

async fn agents_get(State(state): State<Arc<AppState>>, Path(id_str): Path<String>) -> Json<Value> {
    let id = match Uuid::parse_str(&id_str) {
        Ok(v) => v,
        Err(_) => return Json(json!({ "error": "invalid UUID" })),
    };
    let orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    match orch.get_agent(&id) {
        Some(agent) => Json(json!(agent)),
        None => Json(json!({ "error": "agent not found" })),
    }
}

async fn agents_terminate(
    State(state): State<Arc<AppState>>,
    Path(id_str): Path<String>,
) -> Json<Value> {
    let id = match Uuid::parse_str(&id_str) {
        Ok(v) => v,
        Err(_) => return Json(json!({ "error": "invalid UUID" })),
    };
    let mut orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    match orch.terminate_agent(id) {
        Ok(()) => {
            tracing::info!(%id, "agent_terminated");
            Json(json!({ "ok": true }))
        }
        Err(e) => Json(json!({ "ok": false, "error": e.to_string() })),
    }
}

async fn agents_grant_capability(
    State(state): State<Arc<AppState>>,
    Path(id_str): Path<String>,
    Json(req): Json<GrantCapabilityRequest>,
) -> Json<Value> {
    let id = match Uuid::parse_str(&id_str) {
        Ok(v) => v,
        Err(_) => return Json(json!({ "error": "invalid UUID" })),
    };
    let cap = match req.capability.to_lowercase().as_str() {
        "transact" => AgentCapability::Transact,
        "compute" => AgentCapability::Compute,
        "govern" => AgentCapability::Govern,
        "bridge" => AgentCapability::Bridge,
        other => AgentCapability::Custom(other.to_string()),
    };
    let mut orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    match orch.grant_capability(id, cap) {
        Ok(()) => Json(json!({ "ok": true })),
        Err(e) => Json(json!({ "ok": false, "error": e.to_string() })),
    }
}

async fn agents_elevate_consciousness(
    State(state): State<Arc<AppState>>,
    Path(id_str): Path<String>,
    Json(req): Json<ElevateConsciousnessRequest>,
) -> Json<Value> {
    let id = match Uuid::parse_str(&id_str) {
        Ok(v) => v,
        Err(_) => return Json(json!({ "error": "invalid UUID" })),
    };
    let mut orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    match orch.elevate_consciousness(id, req.level) {
        Ok(()) => Json(json!({ "ok": true, "new_level": req.level })),
        Err(e) => Json(json!({ "ok": false, "error": e.to_string() })),
    }
}

async fn agents_get_messages(
    State(state): State<Arc<AppState>>,
    Path(id_str): Path<String>,
) -> Json<Value> {
    let id = match Uuid::parse_str(&id_str) {
        Ok(v) => v,
        Err(_) => return Json(json!({ "error": "invalid UUID" })),
    };
    let mut orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    let msgs = orch.get_messages(id);
    let count = msgs.len();
    Json(json!({ "agent_id": id.to_string(), "messages": msgs, "count": count }))
}

fn parse_task_type(s: &str) -> AiTaskType {
    match s.to_lowercase().as_str() {
        "llm_inference" | "llm" | "chat" => AiTaskType::LlmInference,
        "image_generation" | "image" => AiTaskType::ImageGeneration,
        "model_training" | "training" => AiTaskType::ModelTraining,
        "embeddings" | "embedding" => AiTaskType::Embeddings,
        "code_analysis" | "code" => AiTaskType::CodeAnalysis,
        _ => AiTaskType::Custom,
    }
}

async fn tasks_dispatch(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DispatchTaskRequest>,
) -> Json<Value> {
    let task_type = parse_task_type(&req.task_type);
    let mut task = AiTask::new(
        task_type,
        req.model_id,
        req.submitter,
        req.input,
        req.reward_flowers,
    )
    .with_priority(req.priority)
    .with_consciousness(req.required_consciousness);

    let task_id = task.id;

    // Try to dispatch to a registered agent
    let mut orch = state
        .orchestrator
        .lock()
        .expect("orchestrator lock poisoned");
    match orch.dispatch_task(&mut task) {
        Ok(agent_id) => {
            tracing::info!(%task_id, %agent_id, "task_dispatched");
            Json(json!({
                "ok": true,
                "task_id": task_id.to_string(),
                "assigned_agent": agent_id.to_string(),
                "status": "assigned",
            }))
        }
        Err(_) => {
            // No agent available — queue it
            let mut q = state.task_queue.lock().expect("task_queue lock poisoned");
            q.push(task);
            tracing::info!(%task_id, "task_queued_no_agent");
            Json(json!({
                "ok": true,
                "task_id": task_id.to_string(),
                "assigned_agent": null,
                "status": "queued",
                "message": "No eligible agent available; task queued",
            }))
        }
    }
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
    let sched = state
        .ncl_state
        .scheduler
        .lock()
        .expect("ncl scheduler lock");
    let rep = state
        .ncl_state
        .reputation
        .lock()
        .expect("ncl reputation lock");
    Json(json!({
        "layer": "L3",
        "service": "ncl",
        "status": "active",
        "mode": "compute-lane-ready",
        "pool_api_url": state.pool_api_url,
        "active_workers": sched.online_workers(),
        "queued_jobs": sched.queued_count(),
        "active_jobs": sched.active_count(),
        "total_workers": sched.worker_count(),
        "total_capacity": format!("{} workers", sched.worker_count()),
        "total_tflops": sched.worker_count() as f64 * 2.5,
        "leaderboard_size": rep.leaderboard().len(),
    }))
}

/// `GET /ncl/price?model=...` — pricing for a given model.
async fn ncl_price(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
) -> Json<Value> {
    let model = params
        .get("model")
        .cloned()
        .unwrap_or_else(|| "default".to_string());
    let backend = match model.to_lowercase().as_str() {
        m if m.contains("onnx") => zion_ncl::ComputeBackend::OnnxRuntime,
        m if m.contains("wasm") => zion_ncl::ComputeBackend::Wasm,
        m if m.contains("tflite") => zion_ncl::ComputeBackend::TfLite,
        _ => zion_ncl::ComputeBackend::Custom,
    };
    let price_per_unit = state.ncl_pricing.calculate_price(backend, 1);
    let (worker_share, protocol_fee) = state.ncl_pricing.split_reward(price_per_unit);
    // Convert from flowers (12 decimals) to ZION
    let price_zion = price_per_unit as f64 / 1_000_000_000_000.0;
    Json(json!({
        "model": model,
        "price_per_token": price_zion / 1000.0,
        "price_per_job": price_zion,
        "price_flowers": price_per_unit,
        "worker_share_flowers": worker_share,
        "protocol_fee_flowers": protocol_fee,
        "fee_split": "90% worker / 10% protocol",
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

// ─── Agent-CLI L3 integration handlers ──────────────────────────────────────

async fn agents_get_consciousness(
    State(state): State<Arc<AppState>>,
    Path(id_str): Path<String>,
) -> Json<Value> {
    let id = match Uuid::parse_str(&id_str) {
        Ok(u) => u,
        Err(_) => {
            return Json(json!({ "error": "invalid agent id" }));
        }
    };
    let engine = state.consciousness_engine.lock().expect("lock poisoned");
    let status = engine.status();
    Json(json!({
        "agent_id": id.to_string(),
        "level": status.level as u8,
        "level_name": format!("{:?}", status.level),
        "xp": status.xp,
        "evolution_history": [],
    }))
}

async fn telemetry_handler(State(state): State<Arc<AppState>>) -> Json<Value> {
    // Fetch from node RPC (best effort)
    let node_height = fetch_node_height(&state.node_rpc_addr).await.unwrap_or(0);
    let (pool_hashrate, active_miners) = fetch_pool_stats(&state.pool_api_url)
        .await
        .unwrap_or((0.0, 0));
    let pending = state.task_queue.lock().expect("lock poisoned").len();

    Json(json!({
        "node_height": node_height,
        "pool_hashrate": pool_hashrate,
        "active_miners": active_miners,
        "pending_transfers": pending,
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

#[derive(Deserialize)]
struct OptimizerRequest {
    target: String,
}

async fn optimizer_run_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<OptimizerRequest>,
) -> Json<Value> {
    let _tuner = state.autotuner.lock().expect("lock poisoned");
    let recommendation = match req.target.as_str() {
        "pool" => "Increase ZION_NONCE_COUNT_GPU to 524288 for higher share rate",
        "warp" => "Enable Lightning + Optimism for lowest-fee routing",
        "miner" => "Switch to deeksha_lite_fire for 2x hashrate on RDNA1",
        _ => "No specific recommendation for this target",
    };
    let actions = vec![
        format!("Analyze {} performance metrics", req.target),
        recommendation.to_string(),
        "Schedule re-evaluation in 1 hour".to_string(),
    ];
    Json(json!({
        "target": req.target,
        "recommendation": recommendation,
        "confidence": 0.85,
        "actions": actions,
    }))
}

async fn fetch_node_height(addr: &str) -> anyhow::Result<u64> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{}/v1/chain/height", addr))
        .send()
        .await?;
    let json: Value = resp.json().await?;
    Ok(json["height"].as_u64().unwrap_or(0))
}

async fn fetch_pool_stats(url: &str) -> anyhow::Result<(f64, usize)> {
    let client = reqwest::Client::new();
    let resp = client.get(url).send().await?;
    let json: Value = resp.json().await?;
    let hashrate = json["hashrate"]["pool"].as_f64().unwrap_or(0.0);
    let miners = json["miners"].as_array().map(|a| a.len()).unwrap_or(0);
    Ok((hashrate, miners))
}
