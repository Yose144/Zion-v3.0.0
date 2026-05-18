//! Hiran v2.2 Inference Integration
//!
//! This module provides integration with the Hiran v2.2 inference service
//! for hybrid RAG + local inference capabilities.

use crate::llm_backend::LlmBackend;
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

/// Hiran v2.2 inference client
pub struct HiranInferenceClient {
    base_url: String,
    client: Client,
}

impl HiranInferenceClient {
    /// Create a new Hiran inference client
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self { base_url, client }
    }

    /// Check if Hiran inference service is healthy
    pub async fn health(&self) -> Result<bool> {
        let url = format!("{}/health", self.base_url.trim_end_matches('/'));
        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await?;

        Ok(response.status().is_success())
    }

    /// Get inference status
    pub async fn status(&self) -> Result<HiranStatus> {
        let url = format!("{}/status", self.base_url.trim_end_matches('/'));
        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Hiran status request failed: {}", response.status());
        }

        let status: HiranStatus = response.json().await?;
        Ok(status)
    }

    /// Send chat completion request (OpenAI-compatible)
    pub async fn chat(&self, message: &str) -> Result<String> {
        let url = format!(
            "{}/v1/chat/completions",
            self.base_url.trim_end_matches('/')
        );

        let body = json!({
            "model": "hiran-v2.2",
            "messages": [
                {
                    "role": "system",
                    "content": "Jsi Hiran v2.2, multi-domain AI Native agent ZION sítě. Odpovídej přesně, technicky a česky."
                },
                {
                    "role": "user",
                    "content": message
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1024
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .timeout(Duration::from_secs(120))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Hiran chat request failed: {}", response.status());
        }

        let result: Value = response.json().await?;

        // Extract response from OpenAI format
        let answer = result["choices"][0]["message"]["content"]
            .as_str()
            .or_else(|| result["response"].as_str())
            .or_else(|| result["message"].as_str())
            .or_else(|| result["text"].as_str())
            .unwrap_or("(no response)")
            .to_string();

        Ok(answer)
    }

    /// Send chat completion request with RAG context
    pub async fn chat_with_context(&self, message: &str, context: &str) -> Result<String> {
        let url = format!(
            "{}/v1/chat/completions",
            self.base_url.trim_end_matches('/')
        );

        let final_prompt = if context.is_empty() {
            message.to_string()
        } else {
            format!(
                "KONTEXT Z DOKUMENTACE:\n{}\n---\nDOTAZ: {}",
                context, message
            )
        };

        let body = json!({
            "model": "hiran-v2.2",
            "messages": [
                {
                    "role": "system",
                    "content": "Jsi Hiran v2.2, multi-domain AI Native agent ZION sítě. Použij poskytnutý kontext z dokumentace pro přesné odpovědi. Odpovídej přesně, technicky a česky."
                },
                {
                    "role": "user",
                    "content": final_prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1024
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .timeout(Duration::from_secs(120))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!(
                "Hiran chat with context request failed: {}",
                response.status()
            );
        }

        let result: Value = response.json().await?;

        let answer = result["choices"][0]["message"]["content"]
            .as_str()
            .or_else(|| result["response"].as_str())
            .or_else(|| result["message"].as_str())
            .or_else(|| result["text"].as_str())
            .unwrap_or("(no response)")
            .to_string();

        Ok(answer)
    }

    /// Get embeddings for text
    pub async fn embeddings(&self, text: &str) -> Result<Vec<f32>> {
        let url = format!("{}/v1/embeddings", self.base_url.trim_end_matches('/'));

        let body = json!({
            "model": "hiran-v2.2",
            "input": text
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .timeout(Duration::from_secs(30))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Hiran embeddings request failed: {}", response.status());
        }

        let result: Value = response.json().await?;

        // Extract embedding vector
        let embedding = result["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("Invalid embedding response format"))?
            .iter()
            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
            .collect();

        Ok(embedding)
    }

    /// Get inference metrics
    pub async fn metrics(&self) -> Result<String> {
        let url = format!("{}/metrics", self.base_url.trim_end_matches('/'));
        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Hiran metrics request failed: {}", response.status());
        }

        Ok(response.text().await?)
    }
}

/// Hiran inference status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiranStatus {
    pub status: String,
    pub model: String,
    pub backend: String,
    pub device: String,
    pub uptime: String,
    #[serde(default)]
    pub request_count: u64,
    #[serde(default)]
    pub gpu_utilization: Option<f32>,
    #[serde(default)]
    pub gpu_memory_used: Option<u64>,
    #[serde(default)]
    pub gpu_memory_total: Option<u64>,
}

/// Hybrid inference backend that can use either remote LLM or local Hiran
pub enum HybridInferenceBackend {
    Remote {
        client: crate::llm_backend::RemoteHttpBackend,
    },
    LocalHiran {
        client: HiranInferenceClient,
    },
    Hybrid {
        remote_client: crate::llm_backend::RemoteHttpBackend,
        hiran_client: HiranInferenceClient,
        prefer_local: bool,
    },
}

impl HybridInferenceBackend {
    /// Create hybrid backend from environment variables
    pub fn from_env() -> Self {
        use crate::llm_backend::RemoteHttpBackend;

        let hiran_url = std::env::var("HIRAN_INFERENCE_URL")
            .ok()
            .filter(|v| !v.trim().is_empty());

        let remote_url = std::env::var("LLM_BASE_URL")
            .ok()
            .filter(|v| !v.trim().is_empty());

        let model = std::env::var("LLM_MODEL").unwrap_or_else(|_| "zion-expert".to_string());

        let api_key = std::env::var("NVIDIA_API_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty());

        let prefer_local = std::env::var("HIRAN_PREFER_LOCAL")
            .unwrap_or_else(|_| "false".to_string())
            .eq_ignore_ascii_case("true");

        match (hiran_url, remote_url) {
            (Some(hiran_url), Some(remote_url)) => {
                let remote_client =
                    RemoteHttpBackend::new(remote_url.clone(), model.clone(), api_key)
                        .expect("Failed to create remote backend");
                let hiran_client = HiranInferenceClient::new(hiran_url);

                Self::Hybrid {
                    remote_client,
                    hiran_client,
                    prefer_local,
                }
            }
            (Some(hiran_url), None) => {
                let hiran_client = HiranInferenceClient::new(hiran_url);
                Self::LocalHiran {
                    client: hiran_client,
                }
            }
            (None, Some(remote_url)) => {
                let remote_client = RemoteHttpBackend::new(remote_url, model, api_key)
                    .expect("Failed to create remote backend");
                Self::Remote {
                    client: remote_client,
                }
            }
            (None, None) => {
                // Fallback to echo backend if neither is configured
                panic!("Neither HIRAN_INFERENCE_URL nor LLM_BASE_URL configured");
            }
        }
    }

    /// Generate response using hybrid backend
    pub async fn generate(&self, prompt: &str) -> Result<String> {
        match self {
            Self::Remote { client } => {
                let request = crate::LlmRequest::new(crate::MmlModality::Text, prompt.to_string());
                let response = client.generate(request)?;
                Ok(response.content)
            }
            Self::LocalHiran { client } => client.chat(prompt).await,
            Self::Hybrid {
                remote_client,
                hiran_client,
                prefer_local,
            } => {
                let hiran_healthy = hiran_client.health().await.unwrap_or(false);

                if *prefer_local && hiran_healthy {
                    match hiran_client.chat(prompt).await {
                        Ok(response) => Ok(response),
                        Err(e) => {
                            tracing::warn!("Hiran inference failed, falling back to remote: {}", e);
                            let request = crate::LlmRequest::new(
                                crate::MmlModality::Text,
                                prompt.to_string(),
                            );
                            let response = remote_client.generate(request)?;
                            Ok(format!("[FALLBACK TO REMOTE] {}", response.content))
                        }
                    }
                } else if hiran_healthy {
                    match hiran_client.chat(prompt).await {
                        Ok(response) => Ok(response),
                        Err(e) => {
                            tracing::warn!("Hiran inference failed, falling back to remote: {}", e);
                            let request = crate::LlmRequest::new(
                                crate::MmlModality::Text,
                                prompt.to_string(),
                            );
                            let response = remote_client.generate(request)?;
                            Ok(format!("[FALLBACK TO REMOTE] {}", response.content))
                        }
                    }
                } else {
                    tracing::warn!("Hiran unhealthy, using remote backend");
                    let request =
                        crate::LlmRequest::new(crate::MmlModality::Text, prompt.to_string());
                    let response = remote_client.generate(request)?;
                    Ok(response.content)
                }
            }
        }
    }

    /// Generate response with RAG context
    pub async fn generate_with_context(&self, prompt: &str, context: &str) -> Result<String> {
        match self {
            Self::Remote { client } => {
                let final_prompt = if context.is_empty() {
                    prompt.to_string()
                } else {
                    format!(
                        "KONTEXT Z DOKUMENTACE:\n{}\n---\nDOTAZ: {}",
                        context, prompt
                    )
                };
                let request = crate::LlmRequest::new(crate::MmlModality::Text, final_prompt);
                let response = client.generate(request)?;
                Ok(response.content)
            }
            Self::LocalHiran { client } => client.chat_with_context(prompt, context).await,
            Self::Hybrid {
                remote_client,
                hiran_client,
                prefer_local,
            } => {
                let hiran_healthy = hiran_client.health().await.unwrap_or(false);

                if *prefer_local && hiran_healthy {
                    match hiran_client.chat_with_context(prompt, context).await {
                        Ok(response) => Ok(response),
                        Err(e) => {
                            tracing::warn!("Hiran inference failed, falling back to remote: {}", e);
                            let final_prompt = if context.is_empty() {
                                prompt.to_string()
                            } else {
                                format!(
                                    "KONTEXT Z DOKUMENTACE:\n{}\n---\nDOTAZ: {}",
                                    context, prompt
                                )
                            };
                            let request =
                                crate::LlmRequest::new(crate::MmlModality::Text, final_prompt);
                            let response = remote_client.generate(request)?;
                            Ok(format!("[FALLBACK TO REMOTE] {}", response.content))
                        }
                    }
                } else if hiran_healthy {
                    match hiran_client.chat_with_context(prompt, context).await {
                        Ok(response) => Ok(response),
                        Err(e) => {
                            tracing::warn!("Hiran inference failed, falling back to remote: {}", e);
                            let final_prompt = if context.is_empty() {
                                prompt.to_string()
                            } else {
                                format!(
                                    "KONTEXT Z DOKUMENTACE:\n{}\n---\nDOTAZ: {}",
                                    context, prompt
                                )
                            };
                            let request =
                                crate::LlmRequest::new(crate::MmlModality::Text, final_prompt);
                            let response = remote_client.generate(request)?;
                            Ok(format!("[FALLBACK TO REMOTE] {}", response.content))
                        }
                    }
                } else {
                    tracing::warn!("Hiran unhealthy, using remote backend");
                    let final_prompt = if context.is_empty() {
                        prompt.to_string()
                    } else {
                        format!(
                            "KONTEXT Z DOKUMENTACE:\n{}\n---\nDOTAZ: {}",
                            context, prompt
                        )
                    };
                    let request = crate::LlmRequest::new(crate::MmlModality::Text, final_prompt);
                    let response = remote_client.generate(request)?;
                    Ok(response.content)
                }
            }
        }
    }
}
