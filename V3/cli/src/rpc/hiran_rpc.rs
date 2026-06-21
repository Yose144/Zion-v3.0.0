use anyhow::Result;
use reqwest::Client;
use serde_json::{json, Value};

/// HTTP client for Hiran v2.2 Inference REST endpoint.
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
        .timeout(std::time::Duration::from_secs(120)) // Longer timeout for inference
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
    // OpenAI-compatible format
    let body = json!({
        "model": "hiran-v2.2",
        "messages": [
            {
                "role": "user",
                "content": question
            }
        ],
        "temperature": 0.7,
        "max_tokens": 1024
    });

    let resp = post(base_url, "v1/chat/completions", body).await?;

    // Extract response from OpenAI format
    let answer = resp["choices"][0]["message"]["content"]
        .as_str()
        .or_else(|| resp["response"].as_str())
        .or_else(|| resp["message"].as_str())
        .or_else(|| resp["text"].as_str())
        .unwrap_or("(no response)")
        .to_string();
    Ok(answer)
}

/// Get model information
#[allow(dead_code)]
pub async fn model_info(base_url: &str) -> Result<Value> {
    get(base_url, "v1/models").await
}

/// Get embeddings for text
#[allow(dead_code)]
pub async fn embeddings(base_url: &str, text: &str) -> Result<Value> {
    let body = json!({
        "model": "hiran-v2.2",
        "input": text
    });
    post(base_url, "v1/embeddings", body).await
}

/// Get inference metrics
#[allow(dead_code)]
pub async fn metrics(base_url: &str) -> Result<String> {
    let resp = Client::new()
        .get(format!("{}/metrics", base_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?
        .text()
        .await?;
    Ok(resp)
}
