use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct NclClient {
    client: Client,
    base_url: String,
}

impl NclClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn list_jobs(&self) -> Result<Vec<JobInfo>> {
        let url = format!("{}/ncl/jobs", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let data: Vec<JobInfo> = resp.json().await?;
        Ok(data)
    }

    pub async fn get_job(&self, id: &str) -> Result<JobInfo> {
        let url = format!("{}/ncl/jobs/{}", self.base_url, id);
        let resp = self.client.get(&url).send().await?;
        let data: JobInfo = resp.json().await?;
        Ok(data)
    }

    pub async fn submit_job(&self, job_type: &str, payload: &str, reward: u64) -> Result<JobSubmission> {
        let url = format!("{}/ncl/jobs", self.base_url);
        let body = SubmitJobRequest {
            job_type: job_type.to_string(),
            payload: payload.to_string(),
            reward_flowers: reward,
        };
        let resp = self.client.post(&url).json(&body).send().await?;
        let data: JobSubmission = resp.json().await?;
        Ok(data)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobInfo {
    pub id: String,
    pub job_type: String,
    pub status: String,
    pub reward_flowers: u64,
    pub worker: Option<String>,
    pub result: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSubmission {
    pub job_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SubmitJobRequest {
    job_type: String,
    payload: String,
    reward_flowers: u64,
}
