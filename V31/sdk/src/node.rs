use std::time::Duration;

use serde_json::json;

use crate::config::SdkConfig;
use crate::error::{SdkError, SdkResult};
use crate::types::{BlockTemplate, NodeStatus, SubmitBlockResult};

/// Async JSON-RPC client for `zion-node`.
pub struct NodeClient {
    config: SdkConfig,
    http: reqwest::Client,
}

impl NodeClient {
    /// Create a new client pointing at `node_rpc_url`.
    pub fn new(node_rpc_url: impl Into<String>) -> Self {
        Self::with_config(SdkConfig::new(node_rpc_url))
    }

    /// Create a client from a full `SdkConfig`.
    pub fn with_config(config: SdkConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .unwrap_or_default();
        Self { config, http }
    }

    /// Call a JSON-RPC method and return the raw `result` field.
    async fn call<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> SdkResult<T> {
        let payload = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        #[cfg(feature = "tracing")]
        tracing::debug!(method, "rpc request");

        let resp = self
            .http
            .post(&self.config.node_rpc_url)
            .json(&payload)
            .send()
            .await?;

        let body: serde_json::Value = resp.json().await?;

        if let Some(err) = body.get("error") {
            if !err.is_null() {
                return Err(SdkError::Rpc(err.to_string()));
            }
        }

        let result = body
            .get("result")
            .ok_or_else(|| SdkError::Rpc("missing result field".into()))?;

        serde_json::from_value(result.clone()).map_err(Into::into)
    }

    /// Get node status.
    pub async fn status(&self) -> SdkResult<NodeStatus> {
        self.call("getStatus", json!({})).await
    }

    /// Fetch a block template for mining.
    pub async fn get_block_template(&self, miner: &str) -> SdkResult<BlockTemplate> {
        self.call("getBlockTemplate", json!({ "miner": miner }))
            .await
    }

    /// Submit a solved block (as serialized JSON).
    pub async fn submit_block(&self, block_json: &str) -> SdkResult<SubmitBlockResult> {
        let block: serde_json::Value = serde_json::from_str(block_json)?;
        self.call("submitBlock", json!({ "block": block })).await
    }

    /// Get the balance of an address.
    pub async fn get_balance(&self, address: &str) -> SdkResult<u64> {
        let result: serde_json::Value = self
            .call("getBalance", json!({ "address": address }))
            .await?;
        result
            .get("balance")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| SdkError::Rpc("missing balance field".into()))
    }

    /// Get the current chain height.
    pub async fn height(&self) -> SdkResult<u64> {
        Ok(self.status().await?.height)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_constructs() {
        let _c = NodeClient::new("http://127.0.0.1:9443");
    }
}
