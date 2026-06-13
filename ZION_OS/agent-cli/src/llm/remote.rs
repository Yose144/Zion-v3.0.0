use super::{LlmResponse, Message, ToolCall};
use crate::config::LlmConfig;
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

pub struct RemoteClient {
    client: Client,
    cfg: LlmConfig,
}

impl RemoteClient {
    pub fn new(cfg: &LlmConfig) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_else(|_| Client::new()),
            cfg: cfg.clone(),
        }
    }

    pub async fn chat_with_tools(
        &self,
        messages: &[Message],
        tools_schema: &serde_json::Value,
    ) -> Result<LlmResponse> {
        let url = format!("{}/chat/completions", self.cfg.api_url.trim_end_matches('/'));

        let msgs: Vec<serde_json::Value> = messages
            .iter()
            .map(|m| json!({"role": m.role, "content": m.content}))
            .collect();

        let body = json!({
            "model": self.cfg.model,
            "messages": msgs,
            "tools": tools_schema,
            "tool_choice": "auto",
            "temperature": self.cfg.temperature,
            "max_tokens": 4096,
        });

        let mut req = self
            .client
            .post(&url)
            .header("Content-Type", "application/json");
        if !self.cfg.api_key.is_empty() {
            req = req.bearer_auth(&self.cfg.api_key);
        }

        let resp = req.json(&body).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("LLM API error {}: {}", status, text));
        }

        let data: OpenAIResponse = resp.json().await?;

        if let Some(choice) = data.choices.first() {
            if let Some(tool_calls) = &choice.message.tool_calls {
                if let Some(tc) = tool_calls.first() {
                    let args = serde_json::from_str(&tc.function.arguments)?;
                    return Ok(LlmResponse::ToolCall(ToolCall {
                        id: tc.id.clone(),
                        name: tc.function.name.clone(),
                        arguments: args,
                    }));
                }
            }
            if let Some(content) = &choice.message.content {
                if content.is_empty() {
                    return Ok(LlmResponse::Done);
                }
                return Ok(LlmResponse::Message(content.clone()));
            }
            return Ok(LlmResponse::Done);
        }

        Ok(LlmResponse::Error("No choices in response".into()))
    }

    pub async fn chat_simple(&self, messages: &[Message]) -> Result<String> {
        let url = format!("{}/chat/completions", self.cfg.api_url.trim_end_matches('/'));

        let msgs: Vec<serde_json::Value> = messages
            .iter()
            .map(|m| json!({"role": m.role, "content": m.content}))
            .collect();

        let body = json!({
            "model": self.cfg.model,
            "messages": msgs,
            "temperature": self.cfg.temperature,
            "max_tokens": 4096,
        });

        let mut req = self
            .client
            .post(&url)
            .header("Content-Type", "application/json");
        if !self.cfg.api_key.is_empty() {
            req = req.bearer_auth(&self.cfg.api_key);
        }

        let resp = req.json(&body).send().await?;
        let data: OpenAIResponse = resp.json().await?;

        if let Some(choice) = data.choices.first() {
            return Ok(choice.message.content.clone().unwrap_or_default());
        }

        Ok(String::new())
    }
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<ToolCallRaw>>,
}

#[derive(Debug, Deserialize)]
struct ToolCallRaw {
    id: String,
    function: FunctionCall,
}

#[derive(Debug, Deserialize)]
struct FunctionCall {
    name: String,
    arguments: String,
}
