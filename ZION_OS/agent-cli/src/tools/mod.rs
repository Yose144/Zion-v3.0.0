pub mod file;
pub mod git;
pub mod inference;
pub mod shell;

use crate::config::AgentConfig;
use crate::llm::ToolCall;
use anyhow::Result;
use serde_json::json;

pub struct ToolRegistry {
    file_tool: file::FileTool,
    shell_tool: shell::ShellTool,
    git_tool: git::GitTool,
    coding_cfg: crate::config::CodingConfig,
}

impl ToolRegistry {
    pub fn new(cfg: &AgentConfig) -> Self {
        Self {
            file_tool: file::FileTool::new(&cfg.paths.repo_root),
            shell_tool: shell::ShellTool::new(cfg),
            git_tool: git::GitTool::new(),
            coding_cfg: cfg.coding.clone(),
        }
    }

    pub fn schema(&self) -> serde_json::Value {
        let mut tools = vec![
            self.file_tool.schema(),
            self.shell_tool.schema(),
            self.git_tool.schema(),
        ];
        if self.coding_cfg.enabled {
            tools.push(self.build_schema());
            tools.push(self.test_schema());
            tools.push(self.lint_schema());
            tools.push(self.fmt_schema());
        }
        json!(tools)
    }

    pub async fn execute(&self, call: &ToolCall) -> Result<String> {
        match call.name.as_str() {
            "read_file" => self.file_tool.read(call).await,
            "write_file" => self.file_tool.write(call).await,
            "edit_file" => self.file_tool.edit(call).await,
            "search" => self.file_tool.search(call).await,
            "shell" => self.shell_tool.execute(call).await,
            "git_status" => self.git_tool.status(call).await,
            "git_diff" => self.git_tool.diff(call).await,
            "git_commit" => self.git_tool.commit(call).await,
            "build" => self.run_build(call).await,
            "test" => self.run_test(call).await,
            "lint" => self.run_lint(call).await,
            "format" => self.run_fmt(call).await,
            "finish" => Ok("Task finished".into()),
            "think" => Ok(format!("Thinking: {}", call.arguments)),
            _ => Err(anyhow::anyhow!("Unknown tool: {}", call.name)),
        }
    }

    fn build_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "build",
                "description": format!("Run the project build command: {}", self.coding_cfg.build_cmd),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target": { "type": "string", "description": "Optional build target" }
                    }
                }
            }
        })
    }

    fn test_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "test",
                "description": format!("Run the project test command: {}", self.coding_cfg.test_cmd),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "filter": { "type": "string", "description": "Optional test filter" }
                    }
                }
            }
        })
    }

    fn lint_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "lint",
                "description": format!("Run the project lint command: {}", self.coding_cfg.lint_cmd),
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        })
    }

    fn fmt_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "format",
                "description": format!("Run the project format command: {}", self.coding_cfg.fmt_cmd),
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        })
    }

    async fn run_build(&self, _call: &ToolCall) -> Result<String> {
        let cmd = self.coding_cfg.build_cmd.clone();
        self.run_shell_cmd(&cmd).await
    }

    async fn run_test(&self, call: &ToolCall) -> Result<String> {
        let mut cmd = self.coding_cfg.test_cmd.clone();
        if let Some(filter) = call.arguments["filter"].as_str() {
            if !filter.is_empty() {
                cmd.push_str(" ");
                cmd.push_str(filter);
            }
        }
        self.run_shell_cmd(&cmd).await
    }

    async fn run_lint(&self, _call: &ToolCall) -> Result<String> {
        let cmd = self.coding_cfg.lint_cmd.clone();
        self.run_shell_cmd(&cmd).await
    }

    async fn run_fmt(&self, _call: &ToolCall) -> Result<String> {
        let cmd = self.coding_cfg.fmt_cmd.clone();
        self.run_shell_cmd(&cmd).await
    }

    async fn run_shell_cmd(&self, cmd: &str) -> Result<String> {
        use tokio::process::Command;
        use tokio::time::{timeout, Duration};
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        if parts.is_empty() {
            return Err(anyhow::anyhow!("Empty command"));
        }
        let mut c = Command::new(parts[0]);
        c.args(&parts[1..]);
        let output = timeout(Duration::from_secs(120), c.output()).await??;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let mut result = String::new();
        if !stdout.is_empty() {
            result.push_str(&stdout);
        }
        if !stderr.is_empty() {
            if !result.is_empty() { result.push('\n'); }
            result.push_str("STDERR: ");
            result.push_str(&stderr);
        }
        if result.is_empty() {
            result = format!("Exit code: {}", output.status.code().unwrap_or(-1));
        }
        Ok(result)
    }
}
