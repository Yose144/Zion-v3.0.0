use crate::config::LlmConfig;
use crate::llm::Message;
use anyhow::{Context, Result};
use serde_json::{json, Value};
use tokio::sync::mpsc;
use futures::StreamExt;

pub enum StreamEvent {
    /// A chunk of thinking/reasoning text
    Thinking(String),
    /// A chunk of final output text
    Content(String),
    /// A tool call being formed
    ToolCallStart { id: String, name: String },
    /// Arguments for the tool call (may be partial)
    ToolCallArgs { id: String, args: String },
    /// Tool call is complete
    ToolCallEnd { id: String, name: String, arguments: Value },
    /// Done
    Done,
    /// Error
    Error(String),
}

pub struct StreamingClient {
    cfg: LlmConfig,
    client: reqwest::Client,
}

impl StreamingClient {
    pub fn new(cfg: &LlmConfig) -> Self {
        Self {
            cfg: cfg.clone(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(300))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Stream LLM response as events
    pub async fn stream_with_tools(
        &self,
        messages: &[Message],
        tools_schema: &Value,
    ) -> Result<mpsc::UnboundedReceiver<StreamEvent>> {
        let (tx, rx) = mpsc::unbounded_channel();

        let body = json!({
            "model": self.cfg.model,
            "messages": messages.iter().map(|m| json!({"role": &m.role, "content": &m.content})).collect::<Vec<_>>(),
            "tools": tools_schema,
            "stream": true,
            "temperature": self.cfg.temperature,
        });

        let resp = self
            .client
            .post(&self.cfg.api_url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.cfg.api_key))
            .json(&body)
            .send()
            .await
            .context("Failed to connect to LLM API for streaming")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            tx.send(StreamEvent::Error(format!("HTTP {}: {}", status, text)))
                .ok();
            return Ok(rx);
        }

        let mut stream = resp.bytes_stream();

        tokio::spawn(async move {
            let mut current_tool_id = String::new();
            let mut current_tool_name = String::new();
            let mut current_tool_args = String::new();
            let mut in_tool_call = false;

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(bytes.as_ref());
                        for line in text.lines() {
                            let line = line.trim();
                            if line.is_empty() || line == "data: [DONE]" {
                                continue;
                            }
                            if !line.starts_with("data: ") {
                                continue;
                            }
                            let json_str = &line[6..];
                            let parsed: Value = match serde_json::from_str(json_str) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            // Extract delta
                            if let Some(choices) = parsed.get("choices") {
                                if let Some(delta) = choices.get(0).and_then(|c| c.get("delta")) {
                                    // Tool calls
                                    if let Some(tool_calls) = delta.get("tool_calls") {
                                        if let Some(tc) = tool_calls.as_array().and_then(|a| a.first()) {
                                            if let Some(id) = tc.get("id").and_then(|v| v.as_str()) {
                                                if !id.is_empty() && id != current_tool_id {
                                                    current_tool_id = id.to_string();
                                                    current_tool_args.clear();
                                                }
                                            }
                                            if let Some(func) = tc.get("function") {
                                                if let Some(name) = func.get("name").and_then(|v| v.as_str()) {
                                                    if !name.is_empty() && name != current_tool_name {
                                                        current_tool_name = name.to_string();
                                                        in_tool_call = true;
                                                        let _ = tx.send(StreamEvent::ToolCallStart {
                                                            id: current_tool_id.clone(),
                                                            name: name.to_string(),
                                                        });
                                                    }
                                                }
                                                if let Some(args) = func.get("arguments").and_then(|v| v.as_str()) {
                                                    current_tool_args.push_str(args);
                                                    let _ = tx.send(StreamEvent::ToolCallArgs {
                                                        id: current_tool_id.clone(),
                                                        args: args.to_string(),
                                                    });
                                                }
                                            }
                                        }
                                    }

                                    // Content
                                    if let Some(content) = delta.get("content").and_then(|v| v.as_str()) {
                                        let _ = tx.send(StreamEvent::Content(content.to_string()));
                                    }

                                    // Finish reason
                                    if let Some(reason) = choices.get(0).and_then(|c| c.get("finish_reason")).and_then(|v| v.as_str()) {
                                        if reason == "tool_calls" && in_tool_call {
                                            in_tool_call = false;
                                            let args = if current_tool_args.is_empty() {
                                                json!({})
                                            } else {
                                                serde_json::from_str(&current_tool_args).unwrap_or(json!({}))
                                            };
                                            let _ = tx.send(StreamEvent::ToolCallEnd {
                                                id: current_tool_id.clone(),
                                                name: current_tool_name.clone(),
                                                arguments: args,
                                            });
                                            current_tool_id.clear();
                                            current_tool_name.clear();
                                            current_tool_args.clear();
                                        } else if reason == "stop" {
                                            let _ = tx.send(StreamEvent::Done);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(StreamEvent::Error(format!("Stream error: {}", e)));
                        break;
                    }
                }
            }
        });

        Ok(rx)
    }
}
