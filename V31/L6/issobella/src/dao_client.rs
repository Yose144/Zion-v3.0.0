//! DAO client — submits mission/research proposals to the L2 DAO for governance approval.
//!
//! Calls the DAO REST API at the configured `ZION_DAO_API_ADDR` (default
//! `http://127.0.0.1:8456`). The proposal is NOT executed automatically; the
//! DAO still requires voting, timelock, and guardian multi-sig.

use crate::config::IssobellaConfig;
use serde::{Deserialize, Serialize};

/// Number of flowers per 1 ZION.
pub const FLOWERS_PER_ZION: u64 = 1_000_000;

/// Configuration for the DAO client.
#[derive(Clone)]
pub struct DaoClientConfig {
    pub dao_api_url: String,
    pub api_key: String,
    pub proposer: String,
    pub proposer_balance: u64,
    pub snapshot_block: u64,
}

impl Default for DaoClientConfig {
    fn default() -> Self {
        Self {
            dao_api_url: std::env::var("ZION_DAO_API_ADDR")
                .unwrap_or_else(|_| "http://127.0.0.1:8456".to_string()),
            api_key: std::env::var("ZION_DAO_API_KEY").unwrap_or_default(),
            proposer: std::env::var("ZION_DAO_PROPOSER").unwrap_or_default(),
            proposer_balance: std::env::var("ZION_DAO_PROPOSER_BALANCE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0),
            snapshot_block: std::env::var("ZION_DAO_SNAPSHOT_BLOCK")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0),
        }
    }
}

impl From<&IssobellaConfig> for DaoClientConfig {
    fn from(cfg: &IssobellaConfig) -> Self {
        Self {
            dao_api_url: cfg.dao_api_url.clone(),
            api_key: cfg.dao_api_key.clone(),
            proposer: cfg.dao_proposer.clone(),
            proposer_balance: cfg.dao_proposer_balance,
            snapshot_block: cfg.dao_snapshot_block,
        }
    }
}

/// Request body matching `V31/L2/dao/src/api.rs::CreateProposalRequest`.
#[derive(Debug, Serialize)]
pub struct CreateDaoProposalRequest {
    pub title: String,
    pub description: String,
    pub proposal_type: ProposalTypeDto,
    pub proposer: String,
    pub proposer_balance: u64,
    pub snapshot_block: u64,
}

/// Externally tagged DTO for `ProposalType`.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "data")]
pub enum ProposalTypeDto {
    Treasury {
        recipient: String,
        amount: u64,
        purpose: String,
    },
    Grant {
        recipient: String,
        amount: u64,
        milestones: Vec<String>,
        duration_days: u32,
    },
    Humanitarian {
        category: String,
        amount: u64,
        region: String,
        description: String,
    },
}

/// Generic DAO API response wrapper (`{ "success": bool, "data": ... }`).
#[derive(Debug, Deserialize)]
pub struct DaoApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
}

/// Inner `data` object returned by `POST /api/dao/proposals`.
#[derive(Debug, Deserialize)]
pub struct DaoProposalData {
    pub proposal_id: u64,
}

/// Public response returned by this client.
#[derive(Debug, Serialize, Deserialize)]
pub struct DaoProposalResponse {
    pub proposal_id: u64,
    pub status: String,
}

/// Input for submitting an Issobella mission as a DAO proposal.
#[derive(Debug, Clone)]
pub struct MissionProposalInput {
    pub title: String,
    pub description: String,
    pub mission_type: String,
    pub amount_zion: u64,
    pub recipient_address: String,
}

pub struct DaoClient {
    config: DaoClientConfig,
    http: reqwest::Client,
}

impl DaoClient {
    pub fn new(config: DaoClientConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self { config, http }
    }

    /// Submit an Issobella mission as a DAO Treasury proposal.
    pub async fn submit_mission_proposal(
        &self,
        mission: &MissionProposalInput,
    ) -> anyhow::Result<DaoProposalResponse> {
        if self.config.proposer.is_empty() {
            return Err(anyhow::anyhow!(
                "DAO proposer not configured (set ZION_DAO_PROPOSER)"
            ));
        }
        if mission.amount_zion == 0 {
            return Err(anyhow::anyhow!("Mission budget must be greater than zero"));
        }
        if mission.recipient_address.is_empty() {
            return Err(anyhow::anyhow!("Mission funding address is required"));
        }

        let amount_flowers = mission
            .amount_zion
            .checked_mul(FLOWERS_PER_ZION)
            .ok_or_else(|| anyhow::anyhow!("Mission budget overflow"))?;

        let req = CreateDaoProposalRequest {
            title: mission.title.clone(),
            description: mission.description.clone(),
            proposer: self.config.proposer.clone(),
            proposer_balance: self.config.proposer_balance,
            snapshot_block: self.config.snapshot_block,
            proposal_type: ProposalTypeDto::Treasury {
                recipient: mission.recipient_address.clone(),
                amount: amount_flowers,
                purpose: format!(
                    "Issobella mission ({}) — {}",
                    mission.mission_type, mission.title
                ),
            },
        };

        self.create_proposal(req).await
    }

    async fn create_proposal(
        &self,
        req: CreateDaoProposalRequest,
    ) -> anyhow::Result<DaoProposalResponse> {
        let url = format!("{}/api/dao/proposals", self.config.dao_api_url);

        let resp = self
            .http
            .post(&url)
            .header("x-dao-key", &self.config.api_key)
            .json(&req)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("DAO API error: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("DAO API returned {}: {}", status, body));
        }

        let api_resp: DaoApiResponse<DaoProposalData> = resp
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("DAO parse error: {}", e))?;

        if !api_resp.success {
            return Err(anyhow::anyhow!("DAO API reported failure"));
        }

        let data = api_resp
            .data
            .ok_or_else(|| anyhow::anyhow!("DAO response missing data"))?;

        Ok(DaoProposalResponse {
            proposal_id: data.proposal_id,
            status: "submitted".to_string(),
        })
    }
}
