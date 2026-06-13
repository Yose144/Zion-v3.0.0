pub mod remote;

use crate::config::LlmConfig;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

impl Message {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: content.into(),
        }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: content.into(),
        }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".into(),
            content: content.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug)]
pub enum LlmResponse {
    ToolCall(ToolCall),
    Message(String),
    Done,
    Error(String),
}

pub struct LlmClient {
    cfg: LlmConfig,
    inner: remote::RemoteClient,
}

impl LlmClient {
    pub fn new(cfg: &LlmConfig) -> Self {
        Self {
            cfg: cfg.clone(),
            inner: remote::RemoteClient::new(cfg),
        }
    }

    pub async fn chat_with_tools(
        &self,
        messages: &[Message],
        tools_schema: &serde_json::Value,
    ) -> Result<LlmResponse> {
        self.inner.chat_with_tools(messages, tools_schema).await
    }

    pub async fn chat_simple(&self, messages: &[Message]) -> Result<String> {
        self.inner.chat_simple(messages).await
    }
}
