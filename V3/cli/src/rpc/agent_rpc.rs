use anyhow::Result;
use reqwest::Client;
use serde_json::{json, Value};

/// HTTP client for Hiranyagarbha AI Native REST endpoint.
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

pub async fn health(base_url: &str) -> Result<bool> {
    let resp = Client::new()
        .get(format!("{}/health", base_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;
    Ok(resp.map(|r| r.status().is_success()).unwrap_or(false))
}

pub async fn ask(base_url: &str, question: &str) -> Result<String> {
    let body = json!({ "message": question });
    let resp = post(base_url, "chat", body).await?;
    let answer = resp["response"]
        .as_str()
        .or_else(|| resp["message"].as_str())
        .or_else(|| resp["text"].as_str())
        .unwrap_or("(no response)")
        .to_string();
    Ok(answer)
}
