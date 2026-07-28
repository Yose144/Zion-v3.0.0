use crate::hiranyagarbha::MmlModality;
use crate::llm_backend::{LlmBackend, LlmRequest};
use crate::memory::{AgentMemory, MemoryEntry, MemoryEventKind};
use crate::rag::VectorStore;
use serde::{Deserialize, Serialize};

/// Represents the result of an autotuning session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutotuneReport {
    pub timestamp: String,
    pub learned_principles: Vec<String>,
    pub refined_system_prompt: String,
    pub focus_areas: Vec<String>,
}

/// The Autotuner responsible for self-improvement of the agent.
pub struct DharmaAutotuner {
    pub last_report: Option<AutotuneReport>,
}

impl Default for DharmaAutotuner {
    fn default() -> Self {
        Self::new()
    }
}

impl DharmaAutotuner {
    pub fn new() -> Self {
        Self { last_report: None }
    }

    /// Run the autotuning process using RAG and LLM.
    pub fn tune(
        &mut self,
        llm: &dyn LlmBackend,
        store: &VectorStore,
        memory: &mut AgentMemory,
    ) -> anyhow::Result<AutotuneReport> {
        tracing::info!("starting_dharma_autotune");

        // 1. Extract core principles from RAG
        let mut learned_docs = Vec::new();

        for doc in store.all().iter().take(2) {
            learned_docs.push(doc.content.clone());
        }

        if learned_docs.is_empty() {
            anyhow::bail!("No documentation found for autotuning");
        }

        // 2. Use LLM to synthesize these into a refined system prompt
        let context = learned_docs.join("\n---\n");
        let prompt = format!(
            "Analyzuj následující dokumentaci ZION projektu a vytvoř z ní 'Refined System Prompt' pro Hiranyagarbha AI Agenta. \
            Prompt musí být v češtině, technicky přesný a musí zahrnovat principy Dharmy a orchestrace.\n\nDOKUMENTACE:\n{context}"
        );

        let request = LlmRequest::new(MmlModality::Text, prompt)
            .with_system_prompt("Jsi Dharma Autotuner. Tvým úkolem je destilovat moudrost z dokumentace do operačních pravidel.")
            .with_temperature(0.2);

        let response = llm
            .generate(request)
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;

        let report = AutotuneReport {
            timestamp: chrono::Utc::now().to_rfc3339(),
            learned_principles: vec![
                "Dharma-driven decision making".to_string(),
                "Oneness principle".to_string(),
            ],
            refined_system_prompt: response.content,
            focus_areas: vec![
                "L1-L6 integration".to_string(),
                "Autonomous assistance".to_string(),
            ],
        };

        // 3. Record in memory
        memory.record(
            MemoryEntry::simple(
                MemoryEventKind::Custom("autotune".to_string()),
                "Autotuning complete. New system prompt generated.".to_string(),
            )
            .with_importance(0.8),
        );

        self.last_report = Some(report.clone());
        tracing::info!("dharma_autotune_complete");
        Ok(report)
    }
}
