use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct AiNativeClient {
    client: Client,
    base_url: String,
}

impl AiNativeClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn list_agents(&self) -> Result<Vec<AgentInfo>> {
        let url = format!("{}/agents", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let data: Vec<AgentInfo> = resp.json().await?;
        Ok(data)
    }

    pub async fn get_agent(&self, id: &str) -> Result<AgentInfo> {
        let url = format!("{}/agents/{}", self.base_url, id);
        let resp = self.client.get(&url).send().await?;
        let data: AgentInfo = resp.json().await?;
        Ok(data)
    }

    pub async fn get_consciousness(&self, agent_id: &str) -> Result<ConsciousnessInfo> {
        let url = format!("{}/consciousness/{}", self.base_url, agent_id);
        let resp = self.client.get(&url).send().await?;
        let data: ConsciousnessInfo = resp.json().await?;
        Ok(data)
    }

    pub async fn query_rag(&self, query: &str, top_k: usize) -> Result<Vec<RagResult>> {
        let url = format!("{}/rag/query", self.base_url);
        let body = RagQuery {
            query: query.to_string(),
            top_k,
        };
        let resp = self.client.post(&url).json(&body).send().await?;
        let data: Vec<RagResult> = resp.json().await?;
        Ok(data)
    }

    pub async fn get_telemetry(&self) -> Result<TelemetrySnapshot> {
        let url = format!("{}/telemetry", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let data: TelemetrySnapshot = resp.json().await?;
        Ok(data)
    }

    pub async fn run_optimizer(&self, target: &str) -> Result<OptimizerResult> {
        let url = format!("{}/optimizer/run", self.base_url);
        let body = OptimizerRequest {
            target: target.to_string(),
        };
        let resp = self.client.post(&url).json(&body).send().await?;
        let data: OptimizerResult = resp.json().await?;
        Ok(data)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub status: String,
    pub capabilities: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsciousnessInfo {
    pub agent_id: String,
    pub level: u8,
    pub level_name: String,
    pub xp: u64,
    pub evolution_history: Vec<EvolutionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionEntry {
    pub from_level: u8,
    pub to_level: u8,
    pub timestamp: String,
    pub trigger: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagResult {
    pub document: String,
    pub chunk: String,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RagQuery {
    query: String,
    top_k: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub node_height: u64,
    pub pool_hashrate: f64,
    pub active_miners: usize,
    pub pending_transfers: usize,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OptimizerRequest {
    target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizerResult {
    pub target: String,
    pub recommendation: String,
    pub confidence: f32,
    pub actions: Vec<String>,
}
