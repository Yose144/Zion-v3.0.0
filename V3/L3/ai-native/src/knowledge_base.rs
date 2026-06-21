//! # Knowledge Base — Auto-indexer for RAG pipeline
//!
//! Scans the ZION project structure, chunking documents,
//! and automatically populates the `RagRetriever` knowledge base.
//!
//! ## Supported formats
//! - `.md`  — Markdown documentation
//! - `.rs` — Rust source files (doc comments)
//! - `.toml` — TOML configuration
//! - `.py`  — Python scripts (docstrings)
//!
//! ## Example
//! ```rust
//! use zion_ai_native::knowledge_base::{KnowledgeBase, KnowledgeConfig};
//! use zion_ai_native::rag::{MockEmbeddingBackend, RagRetriever};
//!
//! let retriever = RagRetriever::new(Box::new(MockEmbeddingBackend::new(4)));
//! let config = KnowledgeConfig::default();
//! let mut kb = KnowledgeBase::new(retriever, config);
//!
//! kb.add_text("pool_setup", "ZION pool is running on port 3333.");
//! assert_eq!(kb.document_count(), 1);
//! ```

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::llm_backend::LlmError;
use crate::rag::RagRetriever;

// ─── Configuration ────────────────────────────────────────────────────────────

/// Canonical relative roots for the wider AI Native corpus.
pub const AI_NATIVE_CANONICAL_CORPUS_ROOTS: &[&str] = &[
    "README.md",
    "HIRANYAGARBHA_AI_NATIVE.md",
    "AI_NATIVE_CONCEPT_2.9.md",
    "AI-L3.md",
    "docs/book/ekam-deeksha",
    "docs/docs2.9/books",
    "docs/docs2.9/CORE",
    "docs/docs2.9/SACRED_KNOWLEDGE",
    "docs/docs2.9/COSMIC_MAP",
    "docs/docs2.9/ZION_OASIS",
    "HiranV2.1/corpus/oasis-ue5",
    "docs/docs2.9/deployment/AMENTI_LOG_INDEX.md",
    "L3/ai-native/src",
    "V3/README.md",
    "V3/ROADMAP.md",
    "V3/L2",
    "V3/L3",
];

/// Narrower profile for published V2 books via text proxy and provenance docs.
pub const V2_BOOKS_PROXY_CORPUS_ROOTS: &[&str] = &[
    "docs/docs2.9/books",
    "docs/docs2.9/deployment/AMENTI_LOG_INDEX.md",
    "docs/docs2.9/ZION_OASIS",
    "HiranV2.1/corpus/oasis-ue5",
    "docs/docs2.9/SACRED_KNOWLEDGE",
    "docs/docs2.9/COSMIC_MAP",
    "docs/docs2.9/PROJECT_OVERVIEW.md",
];

/// Zion Oasis (game / L4 design in rap) + your UE5 text entries — use as a separate RAG sweep or next to Buddhism presets.
pub const ZION_OASIS_GAME_CORPUS_ROOTS: &[&str] =
    &["docs/docs2.9/ZION_OASIS", "HiranV2.1/corpus/oasis-ue5"];

/// Hiran v2.1: downloaded / generated sutras (bhikkhusujato tree) — see `HiranV2.1/scripts/rag/`.
pub const BUDDHISM_CLASSICAL_CORPUS_ROOTS: &[&str] =
    &["HiranV2.1/data/rag/buddhism-classical/generated"];

/// Hiran v2.1: seed encyclopedia (eg Wikipedia EN) — add Kanjur/Tangyur according to license.
pub const BUDDHISM_TIBETAN_CORPUS_ROOTS: &[&str] =
    &["HiranV2.1/data/rag/buddhism-tibetan/generated"];

/// Both Buddhism RAG directories at once (metadata in YAML frontmatter for .md is `rag_index`).
pub const BUDDHISM_RAG_CORPUS_ROOTS: &[&str] = &[
    "HiranV2.1/data/rag/buddhism-classical/generated",
    "HiranV2.1/data/rag/buddhism-tibetan/generated",
];

/// Knowledge base indexer configuration.
#[derive(Debug, Clone)]
pub struct KnowledgeConfig {
    /// Maximum length of one chunk in bytes.
    pub max_chunk_size: usize,
    /// Overlap between chunks in bytes.
    pub chunk_overlap: usize,
    /// File extensions to index.
    pub extensions: Vec<String>,
    /// Directories to skip.
    pub skip_dirs: Vec<String>,
}

impl Default for KnowledgeConfig {
    fn default() -> Self {
        Self {
            max_chunk_size: 1500,
            chunk_overlap: 200,
            extensions: vec!["md".into(), "rs".into(), "toml".into(), "py".into()],
            skip_dirs: vec![
                "target".into(),
                "node_modules".into(),
                ".git".into(),
                "outputs".into(),
                "opencl_sdk".into(),
            ],
        }
    }
}

// ─── Free markdown chunks (no embedder) — API bootstrap & external ingest ──

/// One part of the document without the embedding vector.
#[derive(Debug, Clone)]
pub struct RagTextChunk {
    pub id: String,
    pub content: String,
    pub metadata: HashMap<String, String>,
}

/// Same chunking algorithm as `KnowledgeBase` indexing (configurable limits).
pub fn chunk_document_text(text: &str, config: &KnowledgeConfig) -> Vec<String> {
    chunk_text(text, config.max_chunk_size, config.chunk_overlap)
}

fn walk_markdown_files(config: &KnowledgeConfig, dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if !config.skip_dirs.contains(&file_name) {
                walk_markdown_files(config, &path, out);
            }
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            out.push(path);
        }
    }
}

fn markdown_path_to_chunks(
    workspace_root: &Path,
    path: &Path,
    config: &KnowledgeConfig,
) -> Result<Vec<RagTextChunk>, LlmError> {
    let content = fs::read_to_string(path)
        .map_err(|e| LlmError::InternalError(format!("Read {}: {e}", path.display())))?;

    if content.trim().is_empty() {
        return Ok(vec![]);
    }

    let chunks = chunk_text(&content, config.max_chunk_size, config.chunk_overlap);
    let rel = path
        .strip_prefix(workspace_root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mut out = Vec::with_capacity(chunks.len());
    for (i, chunk) in chunks.iter().enumerate() {
        let id = if chunks.len() == 1 {
            rel.clone()
        } else {
            format!("{}#chunk{i}", rel)
        };
        let mut metadata = HashMap::new();
        metadata.insert("source".into(), path.display().to_string());
        metadata.insert("extension".into(), ext.to_string());
        metadata.insert("path_repo_relative".into(), rel.clone());

        out.push(RagTextChunk {
            id,
            content: chunk.clone(),
            metadata,
        });
    }

    Ok(out)
}

/// Group markdown files under relative workspace roots (file or directory) into chunks — without calling the embedding API.
///
/// Uses the same chunking rules as `KnowledgeBase`; vector DB must embed chunks in particular.
pub fn collect_markdown_chunks_from_relative_roots(
    workspace_root: &Path,
    roots: &[&str],
    config: &KnowledgeConfig,
) -> Result<Vec<RagTextChunk>, LlmError> {
    let canonical =
        fs::canonicalize(workspace_root).unwrap_or_else(|_| workspace_root.to_path_buf());
    let mut all = Vec::new();

    for relative_root in roots {
        let rel = relative_root.trim_start_matches('/');
        let path = canonical.join(rel);

        if path.is_file() {
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                all.extend(markdown_path_to_chunks(&canonical, &path, config)?);
            }
        } else if path.is_dir() {
            let mut files = Vec::new();
            walk_markdown_files(config, &path, &mut files);
            files.sort();
            for file_path in files {
                all.extend(markdown_path_to_chunks(&canonical, &file_path, config)?);
            }
        }
    }

    Ok(all)
}

// ─── KnowledgeBase ───────────────────────────────────────────────────────────

/// Auto-indexer for RAG knowledge base.
///
/// Scans the project structure, chunks the documents, and populates the `RagRetriever`.
pub struct KnowledgeBase {
    pub retriever: RagRetriever,
    config: KnowledgeConfig,
    indexed_files: Vec<String>,
    total_chunks: usize,
}

impl KnowledgeBase {
    pub fn new(retriever: RagRetriever, config: KnowledgeConfig) -> Self {
        Self {
            retriever,
            config,
            indexed_files: Vec::new(),
            total_chunks: 0,
        }
    }

    /// Add the text document directly (without chunking).
    pub fn add_text(&mut self, id: &str, content: &str) -> Result<(), LlmError> {
        self.retriever.index(id, content)?;
        self.total_chunks += 1;
        Ok(())
    }

    /// Add a text document with metadata.
    pub fn add_text_with_metadata(
        &mut self,
        id: &str,
        content: &str,
        metadata: HashMap<String, String>,
    ) -> Result<(), LlmError> {
        self.retriever.index_with_metadata(id, content, metadata)?;
        self.total_chunks += 1;
        Ok(())
    }

    /// Scan the directory and index all supported files.
    pub fn scan_directory(&mut self, root: &Path) -> Result<ScanResult, LlmError> {
        let mut result = ScanResult::default();

        let files = self.collect_files(root);
        result.files_found = files.len();

        for file_path in &files {
            match self.index_file(file_path) {
                Ok(n_chunks) => {
                    result.files_indexed += 1;
                    result.chunks_created += n_chunks;
                    self.indexed_files.push(file_path.display().to_string());
                }
                Err(e) => {
                    result
                        .errors
                        .push(format!("{}: {}", file_path.display(), e));
                }
            }
        }

        self.total_chunks += result.chunks_created;
        Ok(result)
    }

    /// Scan multiple relative roots within the workspace root.
    ///
    /// Suitable for canonical curated corpora where we don't want to run scan nad
    /// the entire repository, but over a well-defined set of paths.
    pub fn scan_relative_roots(
        &mut self,
        workspace_root: &Path,
        roots: &[&str],
    ) -> Result<ScanResult, LlmError> {
        let mut aggregate = ScanResult::default();

        for relative_root in roots {
            let path = workspace_root.join(relative_root);

            if path.is_dir() {
                let partial = self.scan_directory(&path)?;
                aggregate.files_found += partial.files_found;
                aggregate.files_indexed += partial.files_indexed;
                aggregate.chunks_created += partial.chunks_created;
                aggregate.errors.extend(partial.errors);
            } else if path.is_file() {
                aggregate.files_found += 1;
                match self.index_file(&path) {
                    Ok(n_chunks) => {
                        aggregate.files_indexed += 1;
                        aggregate.chunks_created += n_chunks;
                        self.total_chunks += n_chunks;
                        self.indexed_files.push(path.display().to_string());
                    }
                    Err(err) => {
                        aggregate
                            .errors
                            .push(format!("{}: {}", path.display(), err));
                    }
                }
            }
        }

        Ok(aggregate)
    }

    /// Index curated AI Native corpus including book and RAG resources.
    pub fn scan_ai_native_canonical_corpus(
        &mut self,
        workspace_root: &Path,
    ) -> Result<ScanResult, LlmError> {
        self.scan_relative_roots(workspace_root, AI_NATIVE_CANONICAL_CORPUS_ROOTS)
    }

    /// Index the published V2 books layer via text proxy resources.
    pub fn scan_v2_books_proxy_corpus(
        &mut self,
        workspace_root: &Path,
    ) -> Result<ScanResult, LlmError> {
        self.scan_relative_roots(workspace_root, V2_BOOKS_PROXY_CORPUS_ROOTS)
    }

    /// Indexuj jeden soubor — chunking + embedding.
    pub fn index_file(&mut self, path: &Path) -> Result<usize, LlmError> {
        let content = fs::read_to_string(path)
            .map_err(|e| LlmError::InternalError(format!("Read {}: {e}", path.display())))?;

        if content.trim().is_empty() {
            return Ok(0);
        }

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

        let processed = match ext {
            "rs" => extract_rust_docs(&content),
            "py" => extract_python_docs(&content),
            _ => content.clone(),
        };

        if processed.trim().is_empty() {
            return Ok(0);
        }

        let chunks = chunk_text(
            &processed,
            self.config.max_chunk_size,
            self.config.chunk_overlap,
        );
        let file_id = path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("unknown");

        let mut metadata = HashMap::new();
        metadata.insert("source".into(), path.display().to_string());
        metadata.insert("extension".into(), ext.to_string());

        for (i, chunk) in chunks.iter().enumerate() {
            let chunk_id = if chunks.len() == 1 {
                file_id.to_string()
            } else {
                format!("{file_id}#chunk{i}")
            };
            self.retriever
                .index_with_metadata(&chunk_id, chunk, metadata.clone())?;
        }

        Ok(chunks.len())
    }

    /// Collects files recursively with extension filtering + skip_dirs.
    fn collect_files(&self, root: &Path) -> Vec<PathBuf> {
        let mut files = Vec::new();
        self.walk_dir(root, &mut files);
        files.sort();
        files
    }

    fn walk_dir(&self, dir: &Path, out: &mut Vec<PathBuf>) {
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if path.is_dir() {
                if !self.config.skip_dirs.contains(&file_name) {
                    self.walk_dir(&path, out);
                }
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if self.config.extensions.contains(&ext.to_string()) {
                    out.push(path);
                }
            }
        }
    }

    pub fn document_count(&self) -> usize {
        self.retriever.store_size()
    }

    pub fn total_chunks(&self) -> usize {
        self.total_chunks
    }

    pub fn indexed_files(&self) -> &[String] {
        &self.indexed_files
    }
}

// ─── ScanResult ──────────────────────────────────────────────────────────────

/// Directory scan result.
#[derive(Debug, Default)]
pub struct ScanResult {
    pub files_found: usize,
    pub files_indexed: usize,
    pub chunks_created: usize,
    pub errors: Vec<String>,
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/// Split the text into chunks with an overlay.
fn chunk_text(text: &str, max_size: usize, overlap: usize) -> Vec<String> {
    if text.len() <= max_size {
        return vec![text.to_string()];
    }

    let mut chunks = Vec::new();
    let bytes = text.as_bytes();
    let mut start = 0;

    while start < bytes.len() {
        let end = (start + max_size).min(bytes.len());

        // Look for the end of a paragraph or sentence near the end of a chunk
        let actual_end = if end < bytes.len() {
            find_break_point(text, start, end)
        } else {
            end
        };

        // Safe string slice on UTF-8 boundaries
        let chunk_str = safe_slice(text, start, actual_end);
        if !chunk_str.trim().is_empty() {
            chunks.push(chunk_str.to_string());
        }

        // Offset with overlay
        if actual_end >= bytes.len() {
            break;
        }
        let new_start = if actual_end > overlap {
            actual_end - overlap
        } else {
            actual_end
        };
        // Ensure forward progress — overlap must not return the start to the previous position
        start = if new_start <= start {
            actual_end
        } else {
            new_start
        };
    }

    chunks
}

/// Find an appropriate breakpoint (end of paragraph > end of sentence > end of word).
fn find_break_point(text: &str, start: usize, max_end: usize) -> usize {
    let segment = safe_slice(text, start, max_end);

    // Look for last \n\n (end of paragraph)
    if let Some(pos) = segment.rfind("\n\n") {
        return start + pos + 2;
    }
    // Last `. ` (end of sentence)
    if let Some(pos) = segment.rfind(". ") {
        return start + pos + 2;
    }
    // Last `\n`
    if let Some(pos) = segment.rfind('\n') {
        return start + pos + 1;
    }
    // Last space
    if let Some(pos) = segment.rfind(' ') {
        return start + pos + 1;
    }

    max_end
}

/// Safe truncation of UTF-8 string at byte positions.
fn safe_slice(text: &str, start: usize, end: usize) -> &str {
    let s = start.min(text.len());
    let e = end.min(text.len());

    // Align to UTF-8 boundary
    let s = (s..text.len())
        .find(|&i| text.is_char_boundary(i))
        .unwrap_or(text.len());
    let e = (0..=e)
        .rev()
        .find(|&i| text.is_char_boundary(i))
        .unwrap_or(s);

    if s >= e {
        ""
    } else {
        &text[s..e]
    }
}

// ─── Documentation Extractors ────────────────────────────────────────────────

/// Extract doc comments (//! and ///) from Rust file.
fn extract_rust_docs(content: &str) -> String {
    let mut docs = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(doc) = trimmed.strip_prefix("//!") {
            docs.push(doc.trim().to_string());
        } else if let Some(doc) = trimmed.strip_prefix("///") {
            docs.push(doc.trim().to_string());
        }
    }

    docs.join("\n")
}

/// Extract docstrings from a Python file.
#[allow(clippy::manual_strip)]
fn extract_python_docs(content: &str) -> String {
    let mut docs = Vec::new();
    let mut in_docstring = false;
    let mut docstring_delim = "";

    for line in content.lines() {
        let trimmed = line.trim();

        if !in_docstring {
            if trimmed.starts_with("\"\"\"") || trimmed.starts_with("'''") {
                docstring_delim = &trimmed[..3];
                in_docstring = true;
                // Single line docstring?
                if trimmed.len() > 3 && trimmed[3..].contains(docstring_delim) {
                    docs.push(trimmed[3..trimmed.len() - 3].to_string());
                    in_docstring = false;
                } else {
                    docs.push(trimmed[3..].to_string());
                }
            } else if trimmed.starts_with('#') {
                docs.push(trimmed[1..].trim().to_string());
            }
        } else if trimmed.ends_with(docstring_delim) {
            let end = trimmed.len().saturating_sub(3);
            docs.push(trimmed[..end].to_string());
            in_docstring = false;
        } else {
            docs.push(trimmed.to_string());
        }
    }

    docs.join("\n")
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rag::{MockEmbeddingBackend, RagRetriever};

    fn test_kb() -> KnowledgeBase {
        let retriever = RagRetriever::new(Box::new(MockEmbeddingBackend::new(4)));
        KnowledgeBase::new(retriever, KnowledgeConfig::default())
    }

    fn make_temp_dir(label: &str) -> PathBuf {
        let unique = format!(
            "zion-ai-native-{}-{}",
            label,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        std::env::temp_dir().join(unique)
    }

    #[test]
    fn test_add_text() {
        let mut kb = test_kb();
        kb.add_text("test1", "ZION blockchain is a PoW network.")
            .unwrap();
        assert_eq!(kb.document_count(), 1);
        assert_eq!(kb.total_chunks(), 1);
    }

    #[test]
    fn test_add_text_with_metadata() {
        let mut kb = test_kb();
        let mut meta = HashMap::new();
        meta.insert("source".into(), "README.md".into());
        kb.add_text_with_metadata("readme", "ZION readme", meta)
            .unwrap();
        assert_eq!(kb.document_count(), 1);
    }

    #[test]
    fn test_chunk_small_text() {
        let chunks = chunk_text("Short text.", 1500, 200);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "Short text.");
    }

    #[test]
    fn test_chunk_large_text() {
        let text = "A".repeat(3000);
        let chunks = chunk_text(&text, 1500, 200);
        assert!(chunks.len() >= 2);
    }

    #[test]
    fn test_chunk_respects_paragraph_break() {
        let text = format!("{}\n\n{}", "A".repeat(700), "B".repeat(900));
        let chunks = chunk_text(&text, 800, 100);
        assert!(chunks.len() >= 2);
        // First chunk should end at paragraph break
        assert!(chunks[0].trim().ends_with('A'));
    }

    #[test]
    fn test_extract_rust_docs() {
        let rs = r#"
//! Module docs
//! line 2

/// Struct doc
pub struct Foo;

fn internal() {}

/// Function doc
pub fn bar() {}
"#;
        let docs = extract_rust_docs(rs);
        assert!(docs.contains("Module docs"));
        assert!(docs.contains("Struct doc"));
        assert!(docs.contains("Function doc"));
        assert!(!docs.contains("fn internal"));
    }

    #[test]
    fn test_extract_python_docs() {
        let py = r#"
"""Module docstring."""

# A comment

def foo():
    """Function docstring.
    Multi-line.
    """
    pass
"#;
        let docs = extract_python_docs(py);
        assert!(docs.contains("Module docstring."));
        assert!(docs.contains("A comment"));
        assert!(docs.contains("Function docstring."));
    }

    #[test]
    fn test_safe_slice_handles_utf8() {
        let text = "Ekam Deeksha — Golden Seed";
        let slice = safe_slice(text, 0, 15);
        assert!(!slice.is_empty());
        // Verify that it does not end in the middle of a multibyte character
        assert!(slice.is_ascii() || slice.chars().last().is_some());
    }

    #[test]
    fn test_config_default() {
        let config = KnowledgeConfig::default();
        assert_eq!(config.max_chunk_size, 1500);
        assert_eq!(config.chunk_overlap, 200);
        assert!(config.extensions.contains(&"md".to_string()));
        assert!(config.extensions.contains(&"rs".to_string()));
        assert!(config.skip_dirs.contains(&"target".to_string()));
    }

    #[test]
    fn test_scan_nonexistent_dir() {
        let mut kb = test_kb();
        let result = kb.scan_directory(Path::new("/nonexistent/path/12345"));
        assert!(result.is_ok());
        let r = result.unwrap();
        assert_eq!(r.files_found, 0);
    }

    #[test]
    fn test_multiple_documents() {
        let mut kb = test_kb();
        kb.add_text("doc1", "ZION mining pool").unwrap();
        kb.add_text("doc2", "Ekam Deeksha algoritmus").unwrap();
        kb.add_text("doc3", "Hiranyagarbha agent").unwrap();
        assert_eq!(kb.document_count(), 3);
        assert_eq!(kb.total_chunks(), 3);
    }

    #[test]
    fn test_scan_relative_roots_handles_files_dirs_and_missing() {
        let root = make_temp_dir("kb-roots");
        let docs_dir = root.join("docs");
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(root.join("README.md"), "ZION root readme").unwrap();
        fs::write(docs_dir.join("book.md"), "Ekam Deeksha corpus").unwrap();

        let mut kb = test_kb();
        let result = kb
            .scan_relative_roots(&root, &["README.md", "docs", "missing.md"])
            .unwrap();

        assert_eq!(result.files_found, 2);
        assert_eq!(result.files_indexed, 2);
        assert!(result.chunks_created >= 2);

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn canonical_corpus_contains_hiran_ue5_oasis_scratchpad() {
        assert!(
            AI_NATIVE_CANONICAL_CORPUS_ROOTS.contains(&"HiranV2.1/corpus/oasis-ue5"),
            "UE5 Oasis blueprint curated entries for RAG (see Hiran_v2.1.md section 3.7)"
        );
    }

    #[test]
    fn test_v2_books_proxy_profile_contains_books_root() {
        assert!(V2_BOOKS_PROXY_CORPUS_ROOTS.contains(&"docs/docs2.9/books"));
        assert!(V2_BOOKS_PROXY_CORPUS_ROOTS.contains(&"docs/docs2.9/ZION_OASIS"));
        assert!(V2_BOOKS_PROXY_CORPUS_ROOTS.contains(&"HiranV2.1/corpus/oasis-ue5"));
    }

    #[test]
    fn zion_oasis_game_roots_cover_design_and_ue5_scratchpad() {
        assert!(ZION_OASIS_GAME_CORPUS_ROOTS.contains(&"docs/docs2.9/ZION_OASIS"));
        assert!(ZION_OASIS_GAME_CORPUS_ROOTS.contains(&"HiranV2.1/corpus/oasis-ue5"));
        assert_eq!(ZION_OASIS_GAME_CORPUS_ROOTS.len(), 2);
    }
    #[test]
    fn buddhism_rag_roots_reference_hiran_paths() {
        assert!(BUDDHISM_CLASSICAL_CORPUS_ROOTS[0].contains("buddhism-classical"));
        assert!(BUDDHISM_TIBETAN_CORPUS_ROOTS[0].contains("buddhism-tibetan"));
        assert_eq!(BUDDHISM_RAG_CORPUS_ROOTS.len(), 2);
    }

    #[test]
    fn test_scan_result_default() {
        let r = ScanResult::default();
        assert_eq!(r.files_found, 0);
        assert_eq!(r.files_indexed, 0);
        assert_eq!(r.chunks_created, 0);
        assert!(r.errors.is_empty());
    }

    #[test]
    #[allow(clippy::field_reassign_with_default)]
    fn test_collect_markdown_chunks_from_relative_roots() {
        let root = make_temp_dir("kb-md-chunks");
        let gen = root.join("HiranV2.1/data/rag/buddhism-classical/generated");
        fs::create_dir_all(&gen).unwrap();
        let long = "Para one.\n\n".to_string() + &"word ".repeat(400);
        fs::write(gen.join("sample.md"), long).unwrap();

        let mut cfg = KnowledgeConfig::default();
        cfg.max_chunk_size = 200;
        cfg.chunk_overlap = 20;
        cfg.extensions = vec!["md".into()];
        cfg.skip_dirs = KnowledgeConfig::default().skip_dirs;

        let roots = &["HiranV2.1/data/rag/buddhism-classical/generated"];
        let chunks = collect_markdown_chunks_from_relative_roots(&root, roots, &cfg).unwrap();
        assert!(chunks.len() >= 2, "large md should produce multiple chunks");

        fs::remove_dir_all(&root).unwrap();
    }
}
