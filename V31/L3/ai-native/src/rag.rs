//! # Phase V: RAG — Retrieval-Augmented Generation
//!
//! Semantic search + prompt augmentation for the Hiranyagarbha agent.
//! Works 100% via NVIDIA NIM free API — no local GPU needed.
//!
//! ## Architecture
//!
//! ```text
//! user query
//!       │
//!       ▼
//! NimEmbeddingBackend  ──→  embed(query)  ──→  Vec<f32> (1024 dim)
//!                                                  │
//!                                                  ▼
//! VectorStore ──── cosine_similarity ──── top_k ──→ Vec<RagDocument>
//!       │
//!       ▼
//! RagBackend::augment_prompt() ──→ [CONTEXT: ...] + original prompt
//!       │
//!       ▼
//! LlmBackend::generate() ──→ LlmResponse (contextually accurate)
//! ```
//!
//! ## NVIDIA NIM embedding models (free tier)
//!
//! | Model | Dim | Max tokens | Best for |
//! |-------|-----|-----------|----------|
//! | `nvidia/nv-embedqa-e5-v5` | 1024 | 512 | Q&A, documentation |
//! | `nvidia/nv-embedqa-mistral-7b-v2` | 4096 | 512 | Code, long texts |
//!
//! ## Example
//!
//! ```rust
//! use zion_ai_native::rag::{RagDocument, VectorStore};
//!
//! let mut store = VectorStore::new();
//! store.add(RagDocument::new("dharma_doc", "Dharma je kosmický zákon.", vec![0.1, 0.9]));
//! let results = store.search(&[0.1, 0.9], 1);
//! assert_eq!(results.len(), 1);
//! assert_eq!(results[0].id, "dharma_doc");
//! ```

use crate::llm_backend::{LlmBackend, LlmError, LlmRequest, LlmResponse};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── RagDocument ─────────────────────────────────────────────────────────────

/// Document in the RAG knowledge base.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagDocument {
    /// Unique ID (e.g. "docs/MAINNET.md#pool-setup")
    pub id: String,
    /// Text content of the chunk
    pub content: String,
    /// Metadata (source, date, author, …)
    pub metadata: HashMap<String, String>,
    /// Embedding vector — length depends on the chosen model
    pub embedding: Vec<f32>,
}

impl RagDocument {
    pub fn new(id: impl Into<String>, content: impl Into<String>, embedding: Vec<f32>) -> Self {
        Self {
            id: id.into(),
            content: content.into(),
            metadata: HashMap::new(),
            embedding,
        }
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

// ─── VectorStore ─────────────────────────────────────────────────────────────

/// In-memory vector database with cosine similarity search.
///
/// Phase V: intentionally simple without sqlite-vec or Qdrant.
/// Phase VI+: migrate to sqlite-vec for persistence.
#[derive(Debug, Default)]
pub struct VectorStore {
    documents: Vec<RagDocument>,
}

impl VectorStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds or replaces a document (dedup by ID).
    pub fn add(&mut self, doc: RagDocument) {
        if let Some(pos) = self.documents.iter().position(|d| d.id == doc.id) {
            self.documents[pos] = doc;
        } else {
            self.documents.push(doc);
        }
    }

    /// Removes a document by ID. Returns true if found.
    pub fn remove(&mut self, id: &str) -> bool {
        let before = self.documents.len();
        self.documents.retain(|d| d.id != id);
        self.documents.len() < before
    }

    pub fn len(&self) -> usize {
        self.documents.len()
    }

    pub fn is_empty(&self) -> bool {
        self.documents.is_empty()
    }

    /// Top-k documents sorted descending by cosine similarity.
    pub fn search(&self, query_embedding: &[f32], top_k: usize) -> Vec<&RagDocument> {
        if self.documents.is_empty() || top_k == 0 {
            return vec![];
        }
        let mut scored: Vec<(f32, &RagDocument)> = self
            .documents
            .iter()
            .map(|doc| (cosine_similarity(query_embedding, &doc.embedding), doc))
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        scored.into_iter().take(top_k).map(|(_, doc)| doc).collect()
    }

    /// Returns all IDs in the store.
    pub fn ids(&self) -> Vec<&str> {
        self.documents.iter().map(|d| d.id.as_str()).collect()
    }

    /// Returns all documents in the store.
    pub fn all(&self) -> &[RagDocument] {
        &self.documents
    }
}

// ─── Cosine similarity ───────────────────────────────────────────────────────

/// Cosine similarity of two vectors ∈ [-1.0, 1.0].
/// Returns 0.0 for empty or zero vectors.
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len().min(b.len());
    if len == 0 {
        return 0.0;
    }
    let dot: f32 = a[..len]
        .iter()
        .zip(b[..len].iter())
        .map(|(x, y)| x * y)
        .sum();
    let norm_a: f32 = a[..len].iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b[..len].iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

// ─── EmbeddingInputType ───────────────────────────────────────────────────────

/// Input type — NIM uses asymmetric embedding for better accuracy.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum EmbeddingInputType {
    /// Documents stored in the knowledge base
    Passage,
    /// Query during semantic search
    Query,
}

impl EmbeddingInputType {
    fn as_str(self) -> &'static str {
        match self {
            Self::Passage => "passage",
            Self::Query => "query",
        }
    }
}

// ─── EmbeddingBackend trait ───────────────────────────────────────────────────

/// Embedding backend abstraction — allows swapping NIM ↔ Ollama ↔ Mock.
pub trait EmbeddingBackend: Send + Sync {
    fn name(&self) -> &str;
    fn embed(
        &self,
        texts: &[&str],
        input_type: EmbeddingInputType,
    ) -> Result<Vec<Vec<f32>>, LlmError>;
    fn embedding_dim(&self) -> usize;
}

// ─── MockEmbeddingBackend ─────────────────────────────────────────────────────

/// Deterministic embedding for unit tests — does not require an API key.
#[derive(Debug)]
pub struct MockEmbeddingBackend {
    dim: usize,
}

impl MockEmbeddingBackend {
    pub fn new(dim: usize) -> Self {
        Self { dim }
    }
}

impl EmbeddingBackend for MockEmbeddingBackend {
    fn name(&self) -> &str {
        "MockEmbedding"
    }

    fn embed(
        &self,
        texts: &[&str],
        _input_type: EmbeddingInputType,
    ) -> Result<Vec<Vec<f32>>, LlmError> {
        // Deterministic embedding: ASCII average normalized to [0.0, 1.0]
        Ok(texts
            .iter()
            .map(|text| {
                let base: f32 = if text.is_empty() {
                    0.5
                } else {
                    text.chars().map(|c| c as u32 as f32).sum::<f32>() / (text.len() as f32 * 256.0)
                };
                (0..self.dim)
                    .map(|i| (base + i as f32 * 0.001).clamp(0.0, 1.0))
                    .collect()
            })
            .collect())
    }

    fn embedding_dim(&self) -> usize {
        self.dim
    }
}

// ─── NimEmbeddingBackend ──────────────────────────────────────────────────────

/// NVIDIA NIM Embedding Backend — free tier, no GPU needed.
///
/// Endpoint: `POST https://integrate.api.nvidia.com/v1/embeddings`
///
/// ## Models
/// - `nvidia/nv-embedqa-e5-v5` — default, 1024 dim, ideal for ZION docs
/// - `nvidia/nv-embedqa-mistral-7b-v2` — 4096 dim, for code/longer texts
///
/// ## Live test
/// ```bash
/// NVIDIA_API_KEY=nvapi-... cargo test -p zion-ai-native -- test_nim_embedding_live --ignored --nocapture
/// ```
#[derive(Debug, Clone)]
pub struct NimEmbeddingBackend {
    base_url: String,
    api_key: String,
    model: String,
    dim: usize,
}

impl NimEmbeddingBackend {
    /// Default: `nvidia/nv-embedqa-e5-v5`, 1024 dim.
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            base_url: "https://integrate.api.nvidia.com/v1".into(),
            api_key: api_key.into(),
            model: "nvidia/nv-embedqa-e5-v5".into(),
            dim: 1024,
        }
    }

    pub fn with_model(mut self, model: impl Into<String>, dim: usize) -> Self {
        self.model = model.into();
        self.dim = dim;
        self
    }

    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self
    }
}

impl EmbeddingBackend for NimEmbeddingBackend {
    fn name(&self) -> &str {
        "NimEmbedding"
    }

    fn embed(
        &self,
        texts: &[&str],
        input_type: EmbeddingInputType,
    ) -> Result<Vec<Vec<f32>>, LlmError> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| LlmError::InternalError(format!("HTTP client build: {e}")))?;

        let body = serde_json::json!({
            "input": texts,
            "model": self.model,
            "input_type": input_type.as_str(),
            "encoding_format": "float",
            "truncate": "END"
        });

        let resp = client
            .post(format!("{}/embeddings", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| LlmError::InternalError(format!("HTTP request: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().unwrap_or_default();
            return Err(LlmError::Rejected(format!("NIM HTTP {status}: {body}")));
        }

        let data: serde_json::Value = resp
            .json()
            .map_err(|e| LlmError::InternalError(format!("JSON parse: {e}")))?;

        data["data"]
            .as_array()
            .ok_or_else(|| LlmError::InternalError("Missing 'data' array in response".into()))?
            .iter()
            .map(|item| {
                item["embedding"]
                    .as_array()
                    .ok_or_else(|| LlmError::InternalError("Missing 'embedding' field".into()))
                    .and_then(|arr| {
                        arr.iter()
                            .map(|v| {
                                v.as_f64().map(|f| f as f32).ok_or_else(|| {
                                    LlmError::InternalError("Non-float in embedding".into())
                                })
                            })
                            .collect::<Result<Vec<f32>, _>>()
                    })
            })
            .collect()
    }

    fn embedding_dim(&self) -> usize {
        self.dim
    }
}

// ─── RagRetriever ─────────────────────────────────────────────────────────────

/// Combines `EmbeddingBackend` + `VectorStore` into a single pipeline.
pub struct RagRetriever {
    pub embedding: Box<dyn EmbeddingBackend>,
    pub store: VectorStore,
    pub top_k: usize,
}

impl RagRetriever {
    pub fn new(embedding: Box<dyn EmbeddingBackend>) -> Self {
        Self {
            embedding,
            store: VectorStore::new(),
            top_k: 3,
        }
    }

    pub fn with_top_k(mut self, k: usize) -> Self {
        self.top_k = k;
        self
    }

    /// Indexes a new document: embed → stores into VectorStore.
    pub fn index(
        &mut self,
        id: impl Into<String>,
        content: impl Into<String>,
    ) -> Result<(), LlmError> {
        let content = content.into();
        let mut embeddings = self
            .embedding
            .embed(&[content.as_str()], EmbeddingInputType::Passage)?;
        let embedding = embeddings
            .drain(..)
            .next()
            .ok_or_else(|| LlmError::InternalError("Prázdná embedding odpověď".into()))?;
        self.store.add(RagDocument::new(id, content, embedding));
        Ok(())
    }

    /// Indexes a document with metadata.
    pub fn index_with_metadata(
        &mut self,
        id: impl Into<String>,
        content: impl Into<String>,
        metadata: HashMap<String, String>,
    ) -> Result<(), LlmError> {
        let content = content.into();
        let id = id.into();
        let mut embeddings = self
            .embedding
            .embed(&[content.as_str()], EmbeddingInputType::Passage)?;
        let embedding = embeddings
            .drain(..)
            .next()
            .ok_or_else(|| LlmError::InternalError("Prázdná embedding odpověď".into()))?;
        let mut doc = RagDocument::new(id, content, embedding);
        doc.metadata = metadata;
        self.store.add(doc);
        Ok(())
    }

    /// Semantic search — returns the top-k most relevant documents.
    pub fn retrieve(&self, query: &str) -> Result<Vec<&RagDocument>, LlmError> {
        let mut embeddings = self.embedding.embed(&[query], EmbeddingInputType::Query)?;
        let query_emb = embeddings
            .drain(..)
            .next()
            .ok_or_else(|| LlmError::InternalError("Prázdná embedding odpověď".into()))?;
        Ok(self.store.search(&query_emb, self.top_k))
    }

    pub fn store_size(&self) -> usize {
        self.store.len()
    }
}

// ─── RagBackend ───────────────────────────────────────────────────────────────

/// RAG-augmented LLM backend.
///
/// Wraps any `LlmBackend` and automatically augments every prompt
/// with relevant documents from the knowledge base.
///
/// # Usage
/// ```rust
/// use zion_ai_native::rag::{MockEmbeddingBackend, RagRetriever, RagBackend};
/// use zion_ai_native::llm_backend::{EchoBackend, LlmBackend, LlmRequest};
///
/// let mut retriever = RagRetriever::new(Box::new(MockEmbeddingBackend::new(4)));
/// retriever.index("zion_doc", "ZION je PoW blockchain").unwrap();
///
/// let backend = RagBackend::new(retriever, Box::new(EchoBackend::new("test")));
/// assert_eq!(backend.id(), "RagBackend");
/// assert!(backend.is_ready());
/// ```
pub struct RagBackend {
    pub retriever: RagRetriever,
    pub inner: Box<dyn LlmBackend>,
    /// Template for the augmented prompt. Variables: {context}, {query}
    pub context_template: String,
}

impl RagBackend {
    pub fn new(retriever: RagRetriever, inner: Box<dyn LlmBackend>) -> Self {
        Self {
            retriever,
            inner,
            context_template: "[KONTEXT Z KNOWLEDGE BASE]\n{context}\n\n[DOTAZ]\n{query}".into(),
        }
    }

    fn augment_prompt(&self, query: &str) -> String {
        match self.retriever.retrieve(query) {
            Ok(docs) if !docs.is_empty() => {
                let ctx = docs
                    .iter()
                    .enumerate()
                    .map(|(i, doc)| format!("{}. [{}]: {}", i + 1, doc.id, doc.content))
                    .collect::<Vec<_>>()
                    .join("\n");
                self.context_template
                    .replace("{context}", &ctx)
                    .replace("{query}", query)
            }
            _ => query.to_string(),
        }
    }
}

impl LlmBackend for RagBackend {
    fn id(&self) -> &str {
        "RagBackend"
    }

    fn is_ready(&self) -> bool {
        self.inner.is_ready()
    }

    fn generate(&self, mut request: LlmRequest) -> Result<LlmResponse, LlmError> {
        request.user_prompt = self.augment_prompt(&request.user_prompt);
        self.inner.generate(request)
    }

    fn generation_count(&self) -> u64 {
        self.inner.generation_count()
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Cosine similarity ──

    #[test]
    fn test_cosine_identical_vectors() {
        let v = vec![1.0_f32, 0.0, 0.0];
        assert!((cosine_similarity(&v, &v) - 1.0).abs() < 1e-5);
    }

    #[test]
    fn test_cosine_orthogonal_vectors() {
        let a = vec![1.0_f32, 0.0];
        let b = vec![0.0_f32, 1.0];
        assert!(cosine_similarity(&a, &b).abs() < 1e-5);
    }

    #[test]
    fn test_cosine_opposite_vectors() {
        let a = vec![1.0_f32, 0.0];
        let b = vec![-1.0_f32, 0.0];
        assert!((cosine_similarity(&a, &b) + 1.0).abs() < 1e-5);
    }

    #[test]
    fn test_cosine_empty_returns_zero() {
        assert_eq!(cosine_similarity(&[], &[]), 0.0);
    }

    #[test]
    fn test_cosine_zero_vector_returns_zero() {
        let a = vec![0.0_f32, 0.0];
        let b = vec![1.0_f32, 1.0];
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }

    // ── VectorStore ──

    #[test]
    fn test_store_add_and_search() {
        let mut store = VectorStore::new();
        store.add(RagDocument::new(
            "dharma",
            "dharma je zákon",
            vec![1.0, 0.0, 0.0],
        ));
        store.add(RagDocument::new(
            "karma",
            "karma je odměna",
            vec![0.0, 1.0, 0.0],
        ));
        store.add(RagDocument::new(
            "moksha",
            "moksha je osvobození",
            vec![0.0, 0.0, 1.0],
        ));

        assert_eq!(store.len(), 3);
        let results = store.search(&[1.0, 0.0, 0.0], 1);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "dharma");
    }

    #[test]
    fn test_store_top_k_limit() {
        let mut store = VectorStore::new();
        for i in 0_u32..10 {
            store.add(RagDocument::new(
                format!("doc{i}"),
                format!("obsah {i}"),
                vec![i as f32, 0.0],
            ));
        }
        let results = store.search(&[9.0, 0.0], 3);
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn test_store_dedup_by_id() {
        let mut store = VectorStore::new();
        store.add(RagDocument::new("id1", "původní obsah", vec![1.0]));
        store.add(RagDocument::new("id1", "nový obsah", vec![0.5]));
        assert_eq!(store.len(), 1);
        assert_eq!(store.documents[0].content, "nový obsah");
    }

    #[test]
    fn test_store_remove() {
        let mut store = VectorStore::new();
        store.add(RagDocument::new("x", "text", vec![1.0]));
        assert!(store.remove("x"));
        assert!(!store.remove("neexistuje"));
        assert!(store.is_empty());
    }

    #[test]
    fn test_store_ids() {
        let mut store = VectorStore::new();
        store.add(RagDocument::new("a", "A", vec![1.0]));
        store.add(RagDocument::new("b", "B", vec![0.5]));
        let ids = store.ids();
        assert!(ids.contains(&"a"));
        assert!(ids.contains(&"b"));
    }

    #[test]
    fn test_store_empty_search() {
        let store = VectorStore::new();
        assert!(store.search(&[1.0], 3).is_empty());
    }

    #[test]
    fn test_store_top_k_zero() {
        let mut store = VectorStore::new();
        store.add(RagDocument::new("x", "text", vec![1.0]));
        assert!(store.search(&[1.0], 0).is_empty());
    }

    // ── MockEmbedding ──

    #[test]
    fn test_mock_embedding_dimensions() {
        let backend = MockEmbeddingBackend::new(8);
        let results = backend
            .embed(&["hello", "world"], EmbeddingInputType::Query)
            .unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].len(), 8);
        assert_eq!(results[1].len(), 8);
    }

    #[test]
    fn test_mock_embedding_deterministic() {
        let backend = MockEmbeddingBackend::new(4);
        let r1 = backend
            .embed(&["dharma"], EmbeddingInputType::Query)
            .unwrap();
        let r2 = backend
            .embed(&["dharma"], EmbeddingInputType::Query)
            .unwrap();
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_mock_embedding_empty_text() {
        let backend = MockEmbeddingBackend::new(4);
        let results = backend.embed(&[""], EmbeddingInputType::Passage).unwrap();
        assert_eq!(results.len(), 1);
        // Empty text → base = 0.5
        assert!((results[0][0] - 0.5).abs() < 0.001);
    }

    // ── RagRetriever ──

    #[test]
    fn test_retriever_index_and_retrieve() {
        let embedding = Box::new(MockEmbeddingBackend::new(4));
        let mut retriever = RagRetriever::new(embedding).with_top_k(2);

        retriever
            .index("zion", "ZION je blockchain s důkazem práce")
            .unwrap();
        retriever
            .index("ekam", "EkamField je P2P síť vědomí")
            .unwrap();
        retriever
            .index("dharma", "DharmaScore měří etické chování")
            .unwrap();

        let results = retriever.retrieve("Co je ZION?").unwrap();
        assert!(!results.is_empty());
        assert!(results.len() <= 2);
    }

    #[test]
    fn test_retriever_store_size() {
        let mut retriever = RagRetriever::new(Box::new(MockEmbeddingBackend::new(4)));
        assert_eq!(retriever.store_size(), 0);
        retriever.index("doc1", "obsah 1").unwrap();
        retriever.index("doc2", "obsah 2").unwrap();
        assert_eq!(retriever.store_size(), 2);
    }

    #[test]
    fn test_retriever_index_with_metadata() {
        let embedding = Box::new(MockEmbeddingBackend::new(4));
        let mut retriever = RagRetriever::new(embedding);
        let mut meta = HashMap::new();
        meta.insert("source".into(), "docs/README.md".into());
        retriever
            .index_with_metadata("readme", "ZION dokumentace", meta)
            .unwrap();
        let results = retriever.retrieve("dokumentace").unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].metadata["source"], "docs/README.md");
    }

    // ── RagBackend ──

    #[test]
    fn test_rag_backend_augments_prompt() {
        use crate::hiranyagarbha::MmlModality;
        use crate::llm_backend::EchoBackend;

        let embedding = Box::new(MockEmbeddingBackend::new(4));
        let mut retriever = RagRetriever::new(embedding).with_top_k(1);
        retriever
            .index("zion_doc", "ZION mining používá SHA3-512 algoritmus")
            .unwrap();

        let inner = Box::new(EchoBackend::new("test"));
        let backend = RagBackend::new(retriever, inner);

        let req = LlmRequest::new(MmlModality::Text, "Jak funguje ZION mining?");
        let resp = backend.generate(req).unwrap();
        // EchoBackend echoes prompt back — prompt must contain RAG context
        assert!(resp.content.contains("KONTEXT") || resp.content.contains("zion_doc"));
    }

    #[test]
    fn test_rag_backend_empty_store_passthrough() {
        use crate::hiranyagarbha::MmlModality;
        use crate::llm_backend::EchoBackend;

        let retriever = RagRetriever::new(Box::new(MockEmbeddingBackend::new(4)));
        let inner = Box::new(EchoBackend::new("test"));
        let backend = RagBackend::new(retriever, inner);

        let query = "dotaz bez kontextu";
        let req = LlmRequest::new(MmlModality::Text, query);
        let resp = backend.generate(req).unwrap();
        // Empty store → prompt unchanged, EchoBackend echoes exact text
        assert!(resp.content.contains(query));
    }

    // ── RagDocument ──

    #[test]
    fn test_rag_document_metadata() {
        let doc = RagDocument::new("test", "obsah", vec![])
            .with_metadata("source", "docs/README.md")
            .with_metadata("version", "2.9.6");
        assert_eq!(doc.metadata["source"], "docs/README.md");
        assert_eq!(doc.metadata["version"], "2.9.6");
    }

    /// Live test with NVIDIA NIM API — run manually:
    ///
    /// ```bash
    /// NVIDIA_API_KEY=nvapi-... cargo test -p zion-ai-native -- test_nim_embedding_live --ignored --nocapture
    /// ```
    #[test]
    #[ignore]
    fn test_nim_embedding_live() {
        let api_key = std::env::var("NVIDIA_API_KEY").expect("Nastav NVIDIA_API_KEY=nvapi-...");
        let backend = NimEmbeddingBackend::new(api_key);
        let texts = ["Co je dharma?", "ZION blockchain těžba SHA3-512"];
        let result = backend.embed(&texts, EmbeddingInputType::Query).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].len(), 1024); // nv-embedqa-e5-v5 = 1024 dim
        let sim = cosine_similarity(&result[0], &result[1]);
        println!("Cosine similarity (dharma vs mining): {sim:.4}");
        println!(
            "Dim: {}, první hodnota: {:.6}",
            result[0].len(),
            result[0][0]
        );
    }

    /// Live test RAG pipeline — embeds ZION docs, then query in Czech.
    ///
    /// ```bash
    /// NVIDIA_API_KEY=nvapi-... cargo test -p zion-ai-native -- test_nim_rag_pipeline_live --ignored --nocapture
    /// ```
    #[test]
    #[ignore]
    fn test_nim_rag_pipeline_live() {
        let api_key = std::env::var("NVIDIA_API_KEY").expect("Nastav NVIDIA_API_KEY=nvapi-...");
        let embedding = Box::new(NimEmbeddingBackend::new(api_key));
        let mut retriever = RagRetriever::new(embedding).with_top_k(2);

        retriever.index("pool_setup", "Pool server běží na port 3333, connection string: stratum+tcp://pool.zion.network:3333").unwrap();
        retriever.index("mining_algo", "ZION používá Ekam Deeksha algoritmus: SHA3-512 + AES-256 memory-hard + Golden Matrix 3x3").unwrap();
        retriever.index("dharma_score", "DharmaScore = 0.0 (chaos) → 1.0 (satori). Výpočet: 6-kroková transformace s vědomostní vrstvou").unwrap();

        let results = retriever.retrieve("Jak se připojit k poolu?").unwrap();
        println!("RAG výsledky pro 'Jak se připojit k poolu?:");
        for (i, doc) in results.iter().enumerate() {
            println!("  {}. [{}]: {}", i + 1, doc.id, doc.content);
        }
        assert!(!results.is_empty());
    }
}
