use crate::llm::ToolCall;
use anyhow::Result;
use serde_json::json;
use tokio::process::Command;

pub struct GitTool;

impl GitTool {
    pub fn new() -> Self {
        Self
    }

    pub fn schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "git_status",
                "description": "Show git status (modified, staged, untracked files)",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        })
    }

    pub async fn status(&self, _call: &ToolCall) -> Result<String> {
        let output = Command::new("git")
            .args(["status", "--short"])
            .output()
            .await?;
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }

    pub async fn diff(&self, call: &ToolCall) -> Result<String> {
        let args = call.arguments["args"].as_array();
        let mut cmd = Command::new("git");
        cmd.arg("diff");
        if let Some(a) = args {
            for v in a {
                if let Some(s) = v.as_str() {
                    cmd.arg(s);
                }
            }
        }
        let output = cmd.output().await?;
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }

    pub async fn commit(&self, call: &ToolCall) -> Result<String> {
        let message = call.arguments["message"].as_str().unwrap_or("Agent commit");
        let output = Command::new("git")
            .args(["add", "-A"])
            .output()
            .await?;
        let add_out = String::from_utf8_lossy(&output.stdout);

        let output = Command::new("git")
            .args(["commit", "-m", message])
            .output()
            .await?;
        let commit_out = String::from_utf8_lossy(&output.stdout);

        Ok(format!("{}{}", add_out, commit_out))
    }
}
