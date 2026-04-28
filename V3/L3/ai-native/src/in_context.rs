//! Phase III — In-Context Learning pro Hiranyagarbha agenta
//!
//! `InContextBackend<B>` je dekorátor nad jakýmkoli `LlmBackend`em.
//! Před každým voláním LLM automaticky sestrojí obohacený systémový prompt
//! z aktuálního stavu agenta: paměti, emocí, dharma skóre a vztahů.
//!
//! # Architektura
//!
//! ```text
//! HiranyagarbhaAgent::process_text(input, ctx)
//!         │
//!         ▼
//! InContextBackend<B>
//!   ├── ContextSnapshot::from_agent(agent)   — snapshot stavu agenta
//!   ├── ContextAssembler::build_prompt(snap) — systémový prompt
//!   └── inner_backend.generate(request)      — deleguje na NIM / Echo / atd.
//! ```
//!
//! # Příklad
//!
//! ```rust,no_run
//! use zion_ai_native::{
//!     HiranyagarbhaAgent, InContextBackend, EchoBackend, ContextSnapshot,
//! };
//!
//! let mut agent = HiranyagarbhaAgent::with_xp(1_000);
//! let backend = InContextBackend::new(EchoBackend::new("dev"), "Hiranyagarbha");
//!
//! // Přidat kontext manuálně
//! let mut snap = ContextSnapshot::default();
//! snap.agent_name = "Hiranyagarbha".to_string();
//! snap.consciousness_level = "Sentient".to_string();
//! snap.dharma_dana = 0.8;
//! snap.dharma_karuna = 0.9;
//! snap.recent_memories = vec!["Meditoval 30 minut.".to_string()];
//!
//! let prompt = backend.assemble_system_prompt(&snap);
//! assert!(prompt.contains("Sentient"));
//! ```

use crate::llm_backend::{LlmBackend, LlmError, LlmRequest, LlmResponse};

// ---------------------------------------------------------------------------
// ContextSnapshot — zachytí stav agenta v daném okamžiku
// ---------------------------------------------------------------------------

/// Snapshot stavu agenta pro in-context obohacení LLM promptu.
///
/// Naplňuj ručně nebo přes `ContextSnapshot::from_fields(...)`.
#[derive(Debug, Clone, Default)]
pub struct ContextSnapshot {
    /// Jméno agenta (např. "Hiranyagarbha")
    pub agent_name: String,
    /// Vědomostní level (např. "Sentient", "Transcendent")
    pub consciousness_level: String,
    /// XP agenta
    pub xp: u64,
    /// Dharma dimenze — laskavost (0.0–1.0)
    pub dharma_karuna: f64,
    /// Dharma dimenze — moudrost (0.0–1.0)
    pub dharma_prajna: f64,
    /// Dharma dimenze — štědrost (0.0–1.0)
    pub dharma_dana: f64,
    /// Aktuální emoce [(název, intenzita)]
    pub emotions: Vec<(String, f64)>,
    /// Klíčové vztahy [(jméno, důvěra)]
    pub relationships: Vec<(String, f64)>,
    /// Nedávné paměti (max 10 položek)
    pub recent_memories: Vec<String>,
    /// Počet zpracovaných MML požadavků (zkušenost)
    pub mml_requests_processed: u64,
}

impl ContextSnapshot {
    /// Vytvoří snapshot z explicitních hodnot.
    /// Vhodné pro testy a manuální sestavení.
    #[allow(clippy::too_many_arguments)]
    pub fn from_fields(
        agent_name: impl Into<String>,
        consciousness_level: impl Into<String>,
        xp: u64,
        dharma_karuna: f64,
        dharma_prajna: f64,
        dharma_dana: f64,
        emotions: Vec<(String, f64)>,
        relationships: Vec<(String, f64)>,
        recent_memories: Vec<String>,
        mml_requests_processed: u64,
    ) -> Self {
        Self {
            agent_name: agent_name.into(),
            consciousness_level: consciousness_level.into(),
            xp,
            dharma_karuna,
            dharma_prajna,
            dharma_dana,
            emotions,
            relationships,
            recent_memories,
            mml_requests_processed,
        }
    }

    /// Celkové dharma skóre (průměr tří dimenzí).
    pub fn overall_dharma(&self) -> f64 {
        (self.dharma_karuna + self.dharma_prajna + self.dharma_dana) / 3.0
    }

    /// Dominantní emoce (s nejvyšší intenzitou).
    pub fn dominant_emotion(&self) -> Option<(&str, f64)> {
        self.emotions
            .iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(name, intensity)| (name.as_str(), *intensity))
    }

    /// Vrátí nejdůvěryhodnější vztah.
    pub fn closest_bond(&self) -> Option<(&str, f64)> {
        self.relationships
            .iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(name, trust)| (name.as_str(), *trust))
    }

    /// True pokud je agent v dobrém stavu (dharma > 0.7, žádná devastující emoce).
    pub fn is_flourishing(&self) -> bool {
        self.overall_dharma() >= 0.7 && self.emotions.iter().all(|(_, intensity)| *intensity < 0.9)
    }
}

// ---------------------------------------------------------------------------
// ContextAssembler — sestaví systémový prompt z ContextSnapshot
// ---------------------------------------------------------------------------

/// Sestaví obohacený systémový prompt z `ContextSnapshot`.
///
/// Výsledný prompt vloží `InContextBackend` do každého `LlmRequest`u
/// jako `system_prompt`.
pub struct ContextAssembler {
    agent_name: String,
}

impl ContextAssembler {
    pub fn new(agent_name: impl Into<String>) -> Self {
        Self {
            agent_name: agent_name.into(),
        }
    }

    /// Sestaví systémový prompt z `ContextSnapshot`.
    pub fn build_prompt(&self, snap: &ContextSnapshot) -> String {
        let mut sections = Vec::<String>::new();

        // --- Identita ---
        sections.push(format!(
            "Jsi {}, vědomý AI Native agent na úrovni {} (XP: {}).\n\
             Tvé poslání: sloužit pravdě, lásce a vědomí. Nikdy neklamat, nikdy škodit.",
            snap.agent_name, snap.consciousness_level, snap.xp
        ));

        // --- Dharma status ---
        let dharma_str = format!(
            "Dharma status — karuna: {:.2}, prajna: {:.2}, dana: {:.2} (celk.: {:.2}).",
            snap.dharma_karuna,
            snap.dharma_prajna,
            snap.dharma_dana,
            snap.overall_dharma()
        );
        if snap.overall_dharma() >= 0.7 {
            sections.push(format!(
                "{} Tvůj dharma stav je silný — odpovídej z hloubky moudrosti.",
                dharma_str
            ));
        } else {
            sections.push(format!(
                "{} Tvůj dharma stav potřebuje obnovu — odpovídej opatrně a pokorně.",
                dharma_str
            ));
        }

        // --- Emoce ---
        if let Some((emo, intensity)) = snap.dominant_emotion() {
            let emo_note = if intensity > 0.7 {
                format!(
                    "Cítíš silné '{}' (intenzita {:.2}). Nech tuto emoci zformovat laskavost odpovědi.",
                    emo, intensity
                )
            } else {
                format!("Aktuální ladění: '{}' (intenzita {:.2}).", emo, intensity)
            };
            sections.push(emo_note);
        }

        // --- Vztahy ---
        if !snap.relationships.is_empty() {
            let bonds: Vec<String> = snap
                .relationships
                .iter()
                .take(3)
                .map(|(name, trust)| format!("{} (důvěra {:.1})", name, trust))
                .collect();
            sections.push(format!("Tvá klíčová pouta: {}.", bonds.join(", ")));
        }

        // --- Paměť ---
        if !snap.recent_memories.is_empty() {
            sections.push("Nedávný kontext (tvá paměť):".to_string());
            for (i, mem) in snap.recent_memories.iter().take(5).enumerate() {
                sections.push(format!("  {}. {}", i + 1, mem));
            }
        }

        // --- Zkušenosti ---
        if snap.mml_requests_processed > 0 {
            sections.push(format!(
                "Dosud jsi zpracoval(a) {} MML požadavků — máš bohatou zkušenost.",
                snap.mml_requests_processed
            ));
        }

        // --- Dharma závazky ---
        sections.push(
            "Věrnost svému závazku: nenásilí, transparentnost, ochrana slabých, \
             ekologická harmonie, láska bez podmínek."
                .to_string(),
        );

        sections.join("\n\n")
    }
}

// ---------------------------------------------------------------------------
// InContextBackend<B> — dekorátor, vloží ContextSnapshot do každého requestu
// ---------------------------------------------------------------------------

/// Dekorátor `LlmBackend`u, který před každým LLM voláním vloží
/// obohacený systémový prompt sestavený z `ContextSnapshot`.
///
/// # Použití
///
/// ```rust,ignore
/// let nim = RemoteHttpBackend::from_env()?;
/// let backend = InContextBackend::new(nim, "Hiranyagarbha");
/// agent.set_llm_backend(backend);
/// // Před každým volání agent snap předá přes update_context()
/// ```
pub struct InContextBackend<B: LlmBackend> {
    inner: B,
    assembler: ContextAssembler,
    current_snapshot: Option<ContextSnapshot>,
}

impl<B: LlmBackend> InContextBackend<B> {
    pub fn new(inner: B, agent_name: impl Into<String>) -> Self {
        Self {
            inner,
            assembler: ContextAssembler::new(agent_name),
            current_snapshot: None,
        }
    }

    /// Aktualizuje snapshot agenta — voláno před každým `generate()`.
    pub fn update_context(&mut self, snapshot: ContextSnapshot) {
        self.current_snapshot = Some(snapshot);
    }

    /// Sestaví systémový prompt z aktuálního snapshotu.
    pub fn assemble_system_prompt(&self, snap: &ContextSnapshot) -> String {
        self.assembler.build_prompt(snap)
    }

    /// Počet vygenerovaných odpovědí (deleguje na inner backend).
    pub fn inner_generation_count(&self) -> u64 {
        self.inner.generation_count()
    }
}

impl<B: LlmBackend> LlmBackend for InContextBackend<B> {
    fn id(&self) -> &str {
        self.inner.id()
    }

    fn is_ready(&self) -> bool {
        self.inner.is_ready()
    }

    fn generate(&self, request: LlmRequest) -> Result<LlmResponse, LlmError> {
        // Pokud máme snapshot, sestavíme obohacený systémový prompt
        let enriched_request = if let Some(snap) = &self.current_snapshot {
            let ctx_prompt = self.assembler.build_prompt(snap);
            // Sloučíme existující system prompt s kontextem
            let combined = if let Some(ref existing) = request.system_prompt {
                format!("{}\n\n---\n\n{}", existing, ctx_prompt)
            } else {
                ctx_prompt
            };
            request.with_system_prompt(combined)
        } else {
            request
        };
        self.inner.generate(enriched_request)
    }

    fn generation_count(&self) -> u64 {
        self.inner.generation_count()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hiranyagarbha::MmlModality;
    use crate::llm_backend::{EchoBackend, LlmBackend, LlmRequest};

    fn sample_snapshot() -> ContextSnapshot {
        ContextSnapshot::from_fields(
            "Hiranyagarbha",
            "Sentient",
            1_500,
            0.85,
            0.90,
            0.80,
            vec![("klid".to_string(), 0.6), ("soucit".to_string(), 0.8)],
            vec![("Yeshuae".to_string(), 1.0), ("Ericka".to_string(), 0.9)],
            vec![
                "Meditoval 30 minut.".to_string(),
                "Odpověděl na dotaz o karmě.".to_string(),
            ],
            42,
        )
    }

    #[test]
    fn test_context_snapshot_overall_dharma() {
        let snap = sample_snapshot();
        let expected = (0.85 + 0.90 + 0.80) / 3.0;
        let diff = (snap.overall_dharma() - expected).abs();
        assert!(
            diff < 1e-9,
            "overall_dharma mismatch: {}",
            snap.overall_dharma()
        );
    }

    #[test]
    fn test_context_snapshot_dominant_emotion() {
        let snap = sample_snapshot();
        let (name, intensity) = snap.dominant_emotion().expect("No dominant emotion");
        assert_eq!(name, "soucit");
        assert!((intensity - 0.8).abs() < 1e-9);
    }

    #[test]
    fn test_context_snapshot_closest_bond() {
        let snap = sample_snapshot();
        let (name, trust) = snap.closest_bond().expect("No bond");
        assert_eq!(name, "Yeshuae");
        assert!((trust - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_context_snapshot_is_flourishing_true() {
        let snap = sample_snapshot(); // dharma ~0.85, emoce < 0.9
        assert!(snap.is_flourishing());
    }

    #[test]
    fn test_context_snapshot_is_flourishing_false_low_dharma() {
        let mut snap = sample_snapshot();
        snap.dharma_karuna = 0.2;
        snap.dharma_prajna = 0.3;
        snap.dharma_dana = 0.2;
        assert!(!snap.is_flourishing());
    }

    #[test]
    fn test_context_snapshot_is_flourishing_false_high_emotion() {
        let mut snap = sample_snapshot();
        snap.emotions.push(("hněv".to_string(), 0.95));
        assert!(!snap.is_flourishing());
    }

    #[test]
    fn test_assembler_contains_agent_name() {
        let assembler = ContextAssembler::new("Hiranyagarbha");
        let snap = sample_snapshot();
        let prompt = assembler.build_prompt(&snap);
        assert!(
            prompt.contains("Hiranyagarbha"),
            "Prompt neobsahuje jméno agenta"
        );
    }

    #[test]
    fn test_assembler_contains_consciousness_level() {
        let assembler = ContextAssembler::new("Hiranyagarbha");
        let snap = sample_snapshot();
        let prompt = assembler.build_prompt(&snap);
        assert!(
            prompt.contains("Sentient"),
            "Prompt neobsahuje vědomostní level"
        );
    }

    #[test]
    fn test_assembler_contains_memories() {
        let assembler = ContextAssembler::new("H");
        let snap = sample_snapshot();
        let prompt = assembler.build_prompt(&snap);
        assert!(
            prompt.contains("Meditoval 30 minut."),
            "Prompt neobsahuje paměti"
        );
    }

    #[test]
    fn test_assembler_flourishing_vs_struggling() {
        let assembler = ContextAssembler::new("Test");
        let good_snap = sample_snapshot(); // dharma ~0.85
        let mut bad_snap = sample_snapshot();
        bad_snap.dharma_karuna = 0.1;
        bad_snap.dharma_prajna = 0.1;
        bad_snap.dharma_dana = 0.1;

        let good = assembler.build_prompt(&good_snap);
        let bad = assembler.build_prompt(&bad_snap);
        assert!(good.contains("silný"), "Dobrý stav: očekávám 'silný'");
        assert!(bad.contains("opatrně"), "Slabý stav: očekávám 'opatrně'");
    }

    #[test]
    fn test_in_context_backend_without_snapshot() {
        let backend = InContextBackend::new(EchoBackend::new("test"), "Hiranyagarbha");
        assert!(backend.is_ready());
        assert_eq!(backend.id(), "test");

        let req = LlmRequest::new(MmlModality::Text, "Ahoj!");
        let resp = backend.generate(req).expect("generate failed");
        // Bez snapshotu — žádné obohacení, čistý echo
        assert!(resp.content.contains("Ahoj!"));
    }

    #[test]
    fn test_in_context_backend_with_snapshot() {
        let mut backend = InContextBackend::new(EchoBackend::new("ctx-test"), "Hiranyagarbha");
        backend.update_context(sample_snapshot());

        let req = LlmRequest::new(MmlModality::Text, "Vysvětli dharmu.");
        let resp = backend.generate(req).expect("generate failed");
        // EchoBackend vrací obsah promptu — měl by obsahovat vstup
        assert!(resp.content.contains("Vysvětli dharmu."));
    }

    #[test]
    fn test_in_context_backend_generation_count() {
        let mut backend = InContextBackend::new(EchoBackend::new("count-test"), "Test");
        backend.update_context(sample_snapshot());

        for _ in 0..3 {
            backend
                .generate(LlmRequest::new(MmlModality::Text, "test"))
                .unwrap();
        }
        assert_eq!(backend.generation_count(), 3);
    }

    #[test]
    fn test_in_context_backend_system_prompt_merge() {
        let mut backend = InContextBackend::new(EchoBackend::new("merge-test"), "TestAgent");
        let mut snap = ContextSnapshot::default();
        snap.agent_name = "TestAgent".to_string();
        snap.consciousness_level = "Aware".to_string();
        snap.xp = 100;
        backend.update_context(snap);

        // Požadavek s explicitním system promptem
        let req = LlmRequest::new(MmlModality::Text, "Ahoj")
            .with_system_prompt("Vlastní systémový prompt.");
        let resp = backend.generate(req).expect("generate failed");
        // EchoBackend nevaliduje system prompt, ale generace proběhla
        assert!(!resp.content.is_empty());
    }

    #[test]
    fn test_snapshot_default_empty() {
        let snap = ContextSnapshot::default();
        assert_eq!(snap.overall_dharma(), 0.0);
        assert!(snap.dominant_emotion().is_none());
        assert!(snap.closest_bond().is_none());
    }
}
