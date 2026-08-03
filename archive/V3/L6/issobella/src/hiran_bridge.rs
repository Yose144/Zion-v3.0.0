//! Hiran v2.2 AI bridge for ZION Issobella (L6 Space Layer).

use crate::config::IssobellaConfig;
use reqwest::Client;
use serde_json::json;
use std::time::Duration;

pub struct IssobellaHiranBridge {
    client: Client,
    base_url: String,
    enabled: bool,
}

impl IssobellaHiranBridge {
    pub fn new(cfg: &IssobellaConfig) -> Self {
        let base_url = cfg
            .hiran_endpoint
            .clone()
            .unwrap_or_else(|| "http://localhost:8002".to_string());
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("HTTP client build failed");
        Self {
            client,
            base_url,
            enabled: cfg.hiran_enabled,
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Evaluate a space mission plan — feasibility, risk, impact score.
    pub async fn evaluate_mission_plan(
        &self,
        mission_name: &str,
        description: &str,
        budget_zion: u64,
    ) -> anyhow::Result<String> {
        if !self.enabled {
            return Ok(
                "Hiran AI not enabled. Enable via ISSOBELLA_HIRAN_ENABLED=true.".to_string(),
            );
        }
        let prompt = format!(
            "Zhodnoť plán vesmírné mise pro ZION Issobella výzkumnou stanici.\n\
            Název mise: {mission_name}\n\
            Popis: {description}\n\
            Rozpočet: {budget_zion} ZION\n\n\
            Poskytni: hodnocení proveditelnosti (1-10), analýzu rizik (nízké/střední/vysoké), \
            vědecký dopad (1-10), technickou náročnost a doporučení pro realizaci \
            v souladu se ZION filozofií."
        );
        self.chat(&prompt).await
    }

    /// Generate a research proposal summary.
    pub async fn summarize_research(
        &self,
        title: &str,
        abstract_text: &str,
    ) -> anyhow::Result<String> {
        if !self.enabled {
            return Ok(
                "Hiran AI not enabled. Enable via ISSOBELLA_HIRAN_ENABLED=true.".to_string(),
            );
        }
        let prompt = format!(
            "Vytvoř stručné shrnutí výzkumného projektu pro ZION Issobella fond.\n\
            Název: {title}\n\
            Abstrakt: {abstract_text}\n\n\
            Shrnutí musí obsahovat: klíčové vědecké cíle, metodologii, \
            potenciální přínos pro ZION ekosystém a vesmírný výzkum, \
            a doporučení (FINANCOVAT / NEFINANCOVAT / UPRAVIT)."
        );
        self.chat(&prompt).await
    }

    /// Suggest satellite network optimization based on current topology.
    pub async fn optimize_network_topology(
        &self,
        nodes: &[String],
        constraints: &str,
    ) -> anyhow::Result<String> {
        if !self.enabled {
            return Ok(
                "Hiran AI not enabled. Enable via ISSOBELLA_HIRAN_ENABLED=true.".to_string(),
            );
        }
        let nodes_str = nodes.join(", ");
        let prompt = format!(
            "Optimalizuj topologii satelitní sítě ZION Issobella.\n\
            Aktuální uzly: {nodes_str}\n\
            Omezení: {constraints}\n\n\
            Navrhni: optimální konfiguraci spojů, doporučené orbitální parametry, \
            strategie redundance, způsoby minimalizace latence \
            a plán postupného nasazení."
        );
        self.chat(&prompt).await
    }

    /// Generate a mission log entry (narrative).
    pub async fn generate_mission_log(
        &self,
        mission_name: &str,
        event: &str,
        timestamp: &str,
    ) -> anyhow::Result<String> {
        if !self.enabled {
            return Ok(
                "Hiran AI not enabled. Enable via ISSOBELLA_HIRAN_ENABLED=true.".to_string(),
            );
        }
        let prompt = format!(
            "Vytvoř zápis do deníku mise pro ZION Issobella.\n\
            Název mise: {mission_name}\n\
            Událost: {event}\n\
            Čas: {timestamp}\n\n\
            Napiš formální, technicky přesný a zároveň inspirující zápis do lodního deníku, \
            který zachytí vědecký a historický význam události v kontextu ZION projektu."
        );
        self.chat(&prompt).await
    }

    /// Health check — returns true if Hiran endpoint is reachable.
    pub async fn health(&self) -> bool {
        if !self.enabled {
            return false;
        }
        self.client
            .get(format!("{}/health", self.base_url))
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    // ── internal ──────────────────────────────────────────────────────────────

    async fn chat(&self, user_prompt: &str) -> anyhow::Result<String> {
        let body = json!({
            "model": "hiran-v2.2",
            "messages": [
                {
                    "role": "system",
                    "content": "Jsi Hiran v2.2, AI vědecký poradce projektu ZION Issobella — \
                                vesmírné stanice a výzkumného centra. Hodnotíš vesmírné mise, \
                                výzkumné projekty a technické návrhy s vědeckou přesností \
                                a ZION filozofií."
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 512
        });

        let resp = match self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                return Ok(format!(
                    "Hiran nedosažitelný ({}). Pokračujte bez AI doporučení.",
                    e
                ));
            }
        };

        let json: serde_json::Value = match resp.json().await {
            Ok(j) => j,
            Err(e) => {
                return Ok(format!(
                    "Hiran vrátil neplatnou odpověď ({}). Pokračujte bez AI doporučení.",
                    e
                ));
            }
        };

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("Hiran nevrátil žádný obsah.")
            .to_string();

        Ok(content)
    }
}
