use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct WarpClient {
    client: Client,
    base_url: String,
}

impl WarpClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn health(&self) -> Result<WarpHealth> {
        let url = format!("{}/health", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let data: WarpHealth = resp.json().await?;
        Ok(data)
    }

    pub async fn list_chains(&self) -> Result<Vec<ChainInfo>> {
        let url = format!("{}/chains", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let data: Vec<ChainInfo> = resp.json().await?;
        Ok(data)
    }

    pub async fn list_transfers(&self) -> Result<Vec<TransferInfo>> {
        let url = format!("{}/transfers", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let data: Vec<TransferInfo> = resp.json().await?;
        Ok(data)
    }

    pub async fn list_pending(&self) -> Result<Vec<TransferInfo>> {
        let url = format!("{}/transfers/pending", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let data: Vec<TransferInfo> = resp.json().await?;
        Ok(data)
    }

    pub async fn get_transfer(&self, id: &str) -> Result<TransferInfo> {
        let url = format!("{}/transfers/{}", self.base_url, id);
        let resp = self.client.get(&url).send().await?;
        let data: TransferInfo = resp.json().await?;
        Ok(data)
    }

    pub async fn initiate_outbound(&self, proof: &DepositProof) -> Result<TransferResponse> {
        let url = format!("{}/transfers/outbound", self.base_url);
        let resp = self.client.post(&url).json(proof).send().await?;
        let data: TransferResponse = resp.json().await?;
        Ok(data)
    }

    pub async fn initiate_inbound(
        &self,
        source_chain: &str,
        proof: &DepositProof,
        recipient: &str,
    ) -> Result<TransferResponse> {
        let url = format!("{}/transfers/inbound", self.base_url);
        let body = InboundRequest {
            source_chain: source_chain.to_string(),
            proof: proof.clone(),
            recipient: recipient.to_string(),
        };
        let resp = self.client.post(&url).json(&body).send().await?;
        let data: TransferResponse = resp.json().await?;
        Ok(data)
    }

    pub async fn advance_transfer(&self, id: &str, status: &str) -> Result<()> {
        let url = format!("{}/transfers/{}/advance", self.base_url, id);
        let body = AdvanceRequest {
            status: status.to_string(),
        };
        self.client.post(&url).json(&body).send().await?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpHealth {
    pub ok: bool,
    pub node: String,
    pub transfers_total: usize,
    pub transfers_pending: usize,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainInfo {
    pub name: String,
    pub family: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferInfo {
    pub id: String,
    pub source_chain: String,
    pub dest_chain: String,
    pub sender: String,
    pub recipient: String,
    pub amount_flowers: u64,
    pub fee_flowers: u64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositProof {
    pub tx_hash: String,
    pub block_height: u64,
    pub block_hash: String,
    pub sender: String,
    pub amount_flowers: u64,
    pub memo: String,
    pub confirmations: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferResponse {
    pub transfer_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InboundRequest {
    source_chain: String,
    proof: DepositProof,
    recipient: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AdvanceRequest {
    status: String,
}
