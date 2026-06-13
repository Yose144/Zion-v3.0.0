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
}

impl ToolRegistry {
    pub fn new(cfg: &AgentConfig) -> Self {
        Self {
            file_tool: file::FileTool::new(&cfg.paths.repo_root),
            shell_tool: shell::ShellTool::new(cfg),
            git_tool: git::GitTool::new(),
        }
    }

    pub fn schema(&self) -> serde_json::Value {
        json!([
            self.file_tool.schema(),
            self.shell_tool.schema(),
            self.git_tool.schema(),
        ])
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
            "finish" => Ok("Task finished".into()),
            "think" => Ok(format!("Thinking: {}", call.arguments)),
            _ => Err(anyhow::anyhow!("Unknown tool: {}", call.name)),
        }
    }
}
