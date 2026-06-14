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
    l3_enabled: bool,
    warp_url: String,
    ai_url: String,
}

impl ToolRegistry {
    pub fn new(cfg: &AgentConfig) -> Self {
        Self {
            file_tool: file::FileTool::new(&cfg.paths.repo_root),
            shell_tool: shell::ShellTool::new(cfg),
            git_tool: git::GitTool::new(),
            coding_cfg: cfg.coding.clone(),
            l3_enabled: cfg.l3.enabled,
            warp_url: cfg.l3.warp_url.clone(),
            ai_url: cfg.l3.ai_native_url.clone(),
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
        if self.l3_enabled {
            tools.push(self.warp_list_chains_schema());
            tools.push(self.warp_list_transfers_schema());
            tools.push(self.warp_get_transfer_schema());
            tools.push(self.ai_list_agents_schema());
            tools.push(self.ai_query_rag_schema());
            tools.push(self.ai_get_telemetry_schema());
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
            "warp_list_chains" => self.warp_list_chains().await,
            "warp_list_transfers" => self.warp_list_transfers().await,
            "warp_get_transfer" => self.warp_get_transfer(call).await,
            "ai_list_agents" => self.ai_list_agents().await,
            "ai_query_rag" => self.ai_query_rag(call).await,
            "ai_get_telemetry" => self.ai_get_telemetry().await,
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

    // ── L3 WARP schemas ──

    fn warp_list_chains_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "warp_list_chains",
                "description": "List all enabled WARP bridge chains",
                "parameters": { "type": "object", "properties": {} }
            }
        })
    }

    fn warp_list_transfers_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "warp_list_transfers",
                "description": "List recent WARP cross-chain transfers",
                "parameters": { "type": "object", "properties": {} }
            }
        })
    }

    fn warp_get_transfer_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "warp_get_transfer",
                "description": "Get details of a specific WARP transfer by ID",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string", "description": "Transfer UUID" }
                    },
                    "required": ["id"]
                }
            }
        })
    }

    // ── L3 AI-Native schemas ──

    fn ai_list_agents_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "ai_list_agents",
                "description": "List registered AI agents in the L3 orchestrator",
                "parameters": { "type": "object", "properties": {} }
            }
        })
    }

    fn ai_query_rag_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "ai_query_rag",
                "description": "Query the L3 RAG knowledge base",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search query" },
                        "top_k": { "type": "integer", "description": "Number of results (default 5)" }
                    },
                    "required": ["query"]
                }
            }
        })
    }

    fn ai_get_telemetry_schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "ai_get_telemetry",
                "description": "Get live telemetry from ZION node, pool, and miners",
                "parameters": { "type": "object", "properties": {} }
            }
        })
    }

    // ── L3 WARP execute ──

    async fn warp_list_chains(&self) -> Result<String> {
        let client = crate::l3::WarpClient::new(&self.warp_url);
        let chains = client.list_chains().await?;
        Ok(serde_json::to_string_pretty(&chains)?)
    }

    async fn warp_list_transfers(&self) -> Result<String> {
        let client = crate::l3::WarpClient::new(&self.warp_url);
        let transfers = client.list_transfers().await?;
        Ok(serde_json::to_string_pretty(&transfers)?)
    }

    async fn warp_get_transfer(&self, call: &ToolCall) -> Result<String> {
        let id = call.arguments["id"].as_str().unwrap_or("");
        if id.is_empty() {
            return Err(anyhow::anyhow!("Missing transfer id"));
        }
        let client = crate::l3::WarpClient::new(&self.warp_url);
        let transfer = client.get_transfer(id).await?;
        Ok(serde_json::to_string_pretty(&transfer)?)
    }

    // ── L3 AI-Native execute ──

    async fn ai_list_agents(&self) -> Result<String> {
        let client = crate::l3::AiNativeClient::new(&self.ai_url);
        let agents = client.list_agents().await?;
        Ok(serde_json::to_string_pretty(&agents)?)
    }

    async fn ai_query_rag(&self, call: &ToolCall) -> Result<String> {
        let query = call.arguments["query"].as_str().unwrap_or("");
        let top_k = call.arguments["top_k"].as_u64().unwrap_or(5) as usize;
        let client = crate::l3::AiNativeClient::new(&self.ai_url);
        let results = client.query_rag(query, top_k).await?;
        Ok(serde_json::to_string_pretty(&results)?)
    }

    async fn ai_get_telemetry(&self) -> Result<String> {
        let client = crate::l3::AiNativeClient::new(&self.ai_url);
        let telemetry = client.get_telemetry().await?;
        Ok(serde_json::to_string_pretty(&telemetry)?)
    }
}
