use anyhow::Result;
use reqwest::Client;
use serde_json::Value;

/// Generic HTTP GET JSON helper.
pub async fn get(base_url: &str, path: &str) -> Result<Value> {
    let url = format!("{}/{}", base_url.trim_end_matches('/'), path);
    let resp = Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?
        .json::<Value>()
        .await?;
    Ok(resp)
}

/// Generic HTTP POST JSON helper.
pub async fn post(base_url: &str, path: &str, body: Value) -> Result<Value> {
    let url = format!("{}/{}", base_url.trim_end_matches('/'), path);
    let resp = Client::new()
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await?
        .json::<Value>()
        .await?;
    Ok(resp)
}

/// Health check — returns true if the endpoint responds 2xx.
pub async fn health(base_url: &str) -> Result<bool> {
    let resp = Client::new()
        .get(format!("{}/health", base_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;
    Ok(resp.map(|r| r.status().is_success()).unwrap_or(false))
}
