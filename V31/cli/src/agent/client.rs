//! OpenAI-compatible Hiran gateway client (non-streaming MVP).

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::tools::{self, ToolCall};

#[derive(Debug, Clone)]
pub struct HiranClient {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
    model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ApiToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ApiFunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiFunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
    #[serde(default)]
    error: Option<ApiError>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChatMessage,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    data: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    id: String,
}

impl HiranClient {
    pub fn new(base_url: &str, api_key: &str, model: &str) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .user_agent(format!("zion-cli/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .context("build http client")?;
        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            model: model.to_string(),
        })
    }

    pub fn model(&self) -> &str {
        &self.model
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn apply_auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if self.api_key.is_empty() {
            req
        } else {
            req.header("X-API-Key", &self.api_key)
                .header("Authorization", format!("Bearer {}", self.api_key))
        }
    }

    pub async fn list_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/models", self.base_url);
        let resp = self
            .apply_auth(self.http.get(&url))
            .send()
            .await
            .context("GET /models")?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            bail!("GET /models failed ({status}): {body}");
        }
        let parsed: ModelsResponse =
            serde_json::from_str(&body).with_context(|| format!("parse models: {body}"))?;
        Ok(parsed.data.into_iter().map(|m| m.id).collect())
    }

    /// Cheap connectivity probe — prefers `/models`, falls back to error text.
    pub async fn status(&self) -> Result<(u16, String)> {
        let url = format!("{}/models", self.base_url);
        let resp = self
            .apply_auth(self.http.get(&url))
            .send()
            .await
            .context("status probe")?;
        let code = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        Ok((code, body))
    }

    /// GET /v1/usage — requires API key; returns raw JSON value.
    pub async fn usage(&self) -> Result<serde_json::Value> {
        if self.api_key.is_empty() {
            bail!("API key required for /usage");
        }
        let url = format!("{}/usage", self.base_url);
        let resp = self
            .apply_auth(self.http.get(&url))
            .send()
            .await
            .context("GET /usage")?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            bail!("GET /usage failed ({status}): {body}");
        }
        serde_json::from_str(&body).with_context(|| format!("parse usage: {body}"))
    }

    pub async fn chat(
        &self,
        messages: &[ChatMessage],
        with_tools: bool,
    ) -> Result<ChatMessage> {
        let url = format!("{}/chat/completions", self.base_url);
        let mut body = json!({
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2048,
        });
        if with_tools {
            body["tools"] = tools::openai_tool_defs();
            body["tool_choice"] = json!("auto");
        }

        let resp = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .header("X-API-Key", &self.api_key)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .context("POST /chat/completions")?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            bail!("chat/completions failed ({status}): {text}");
        }

        // Some gateways wrap errors in 200 with error field.
        if let Ok(err_probe) = serde_json::from_str::<Value>(&text) {
            if let Some(msg) = err_probe
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
            {
                bail!("chat/completions error: {msg}");
            }
        }

        let parsed: ChatCompletionResponse =
            serde_json::from_str(&text).with_context(|| format!("parse chat response: {text}"))?;
        if let Some(err) = parsed.error {
            bail!(
                "chat/completions error: {}",
                err.message.unwrap_or_else(|| "unknown".into())
            );
        }
        let choice = parsed
            .choices
            .into_iter()
            .next()
            .context("empty choices from chat/completions")?;
        let _ = choice.finish_reason;
        Ok(choice.message)
    }

    /// Single-turn ask without tools (for `zion hiran ask`).
    pub async fn ask(&self, system: &str, user: &str) -> Result<String> {
        let messages = vec![
            ChatMessage {
                role: "system".into(),
                content: Some(system.into()),
                tool_calls: None,
                tool_call_id: None,
                name: None,
            },
            ChatMessage {
                role: "user".into(),
                content: Some(user.into()),
                tool_calls: None,
                tool_call_id: None,
                name: None,
            },
        ];
        let reply = self.chat(&messages, false).await?;
        Ok(reply.content.unwrap_or_default())
    }
}

/// Extract tool calls from an assistant message (native tool_calls or JSON fence).
pub fn extract_tool_calls(msg: &ChatMessage) -> Vec<ToolCall> {
    let mut out = Vec::new();

    if let Some(calls) = &msg.tool_calls {
        for c in calls {
            let args: Value = serde_json::from_str(&c.function.arguments).unwrap_or(json!({}));
            out.push(ToolCall {
                id: c.id.clone(),
                name: c.function.name.clone(),
                args,
            });
        }
        if !out.is_empty() {
            return out;
        }
    }

    if let Some(content) = &msg.content {
        out.extend(tools::parse_json_fence_tools(content));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_native_tool_calls() {
        let msg = ChatMessage {
            role: "assistant".into(),
            content: None,
            tool_calls: Some(vec![ApiToolCall {
                id: "call_1".into(),
                call_type: "function".into(),
                function: ApiFunctionCall {
                    name: "read_file".into(),
                    arguments: r#"{"path":"Cargo.toml"}"#.into(),
                },
            }]),
            tool_call_id: None,
            name: None,
        };
        let calls = extract_tool_calls(&msg);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "read_file");
        assert_eq!(calls[0].args["path"], "Cargo.toml");
    }
}
