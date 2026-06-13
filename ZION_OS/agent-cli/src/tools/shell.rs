use crate::config::AgentConfig;
use crate::llm::ToolCall;
use anyhow::Result;
use serde_json::json;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

pub struct ShellTool {
    blocked: Vec<String>,
    timeout_sec: u64,
}

impl ShellTool {
    pub fn new(cfg: &AgentConfig) -> Self {
        Self {
            blocked: vec![
                "rm -rf".into(),
                "rm -r /".into(),
                "rm -rf /".into(),
                "dd if=".into(),
                "mkfs".into(),
                ":(){ :|:& };:".into(),
                "curl .* | sh".into(),
                "curl .* | bash".into(),
                "wget .* | sh".into(),
                "> /dev/sda".into(),
            ],
            timeout_sec: cfg.agent.timeout_sec,
        }
    }

    pub fn schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "shell",
                "description": "Run a shell command. Commands run in the repo root. Use read_file/edit_file instead of cat/sed.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": { "type": "string", "description": "The shell command to run" },
                        "timeout": { "type": "integer", "description": "Timeout in seconds", "default": 60 }
                    },
                    "required": ["command"]
                }
            }
        })
    }

    pub async fn execute(&self, call: &ToolCall) -> Result<String> {
        let cmd_str = call.arguments["command"].as_str().unwrap_or("");
        let timeout_sec = call.arguments["timeout"].as_u64().unwrap_or(self.timeout_sec);

        if cmd_str.trim().is_empty() {
            return Err(anyhow::anyhow!("Empty command"));
        }

        for blocked in &self.blocked {
            if cmd_str.contains(blocked) {
                return Err(anyhow::anyhow!(
                    "Command contains blocked pattern: {}. This looks destructive.",
                    blocked
                ));
            }
        }

        // Parse command
        let parts: Vec<&str> = cmd_str.split_whitespace().collect();
        if parts.is_empty() {
            return Err(anyhow::anyhow!("Empty command"));
        }

        let mut cmd = Command::new(parts[0]);
        cmd.args(&parts[1..]);

        let output = timeout(Duration::from_secs(timeout_sec), cmd.output()).await??;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        let mut result = String::new();
        if !stdout.is_empty() {
            result.push_str(&stdout);
        }
        if !stderr.is_empty() {
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str("STDERR: ");
            result.push_str(&stderr);
        }

        if result.is_empty() {
            result = format!("Exit code: {}", output.status.code().unwrap_or(-1));
        } else {
            result.push_str(&format!("\n[exit={}]", output.status.code().unwrap_or(-1)));
        }

        Ok(result)
    }
}
