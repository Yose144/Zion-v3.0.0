use crate::config::AgentConfig;
use crate::llm::ToolCall;
use anyhow::Result;

pub struct AgentMemory;

impl AgentMemory {
    pub fn new(_cfg: &AgentConfig) -> Self {
        Self
    }

    pub fn record_success(&mut self, _tool: &ToolCall, _output: &str) {}
    pub fn record_failure(&mut self, _tool: &ToolCall, _error: &str) {}
}

pub struct SessionContext {
    task: String,
    messages: Vec<crate::llm::Message>,
}

impl SessionContext {
    pub fn new(task: &str) -> Self {
        let system_prompt = format!(
            "You are Hiran Agent, an autonomous AI operator for the ZION project. \
            You have access to tools (read_file, edit_file, write_file, shell, search, git, etc.). \
            Think step by step. When editing files, ALWAYS read them first. \
            When done, use the 'finish' tool. \
            Current task: {}",
            task
        );

        Self {
            task: task.to_string(),
            messages: vec![
                crate::llm::Message::system(system_prompt),
                crate::llm::Message::user(task),
            ],
        }
    }

    pub fn build_messages(&self, _memory: &AgentMemory) -> Vec<crate::llm::Message> {
        self.messages.clone()
    }

    pub fn add_observation(&mut self, tool: &ToolCall, output: &str) {
        let content = format!(
            "Tool: {}\nArguments: {}\nResult: {}",
            tool.name,
            serde_json::to_string(&tool.arguments).unwrap_or_default(),
            output.chars().take(2000).collect::<String>()
        );
        self.messages.push(crate::llm::Message::user(content));
    }

    pub fn add_error(&mut self, tool: &ToolCall, error: &str) {
        let content = format!(
            "Tool: {} FAILED with error: {}",
            tool.name, error
        );
        self.messages.push(crate::llm::Message::user(content));
    }

    pub fn add_safety_block(&mut self, tool: &ToolCall) {
        let content = format!(
            "Tool {} was blocked by safety guardrails. Please try a different approach.",
            tool.name
        );
        self.messages.push(crate::llm::Message::user(content));
    }

    pub fn add_user_cancel(&mut self, tool: &ToolCall) {
        let content = format!(
            "User cancelled the action: {}. Proceed with alternative approach.",
            tool.name
        );
        self.messages.push(crate::llm::Message::user(content));
    }

    pub fn add_dry_run(&mut self, tool: &ToolCall) {
        let content = format!(
            "[DRY-RUN] Would have executed: {} with args {}",
            tool.name,
            serde_json::to_string(&tool.arguments).unwrap_or_default()
        );
        self.messages.push(crate::llm::Message::user(content));
    }

    pub fn add_assistant_message(&mut self, msg: &str) {
        self.messages.push(crate::llm::Message::assistant(msg));
    }

    pub fn set_system_prompt(&mut self, prompt: &str) {
        if let Some(first) = self.messages.first_mut() {
            if first.role == "system" {
                first.content = prompt.to_string();
                return;
            }
        }
        self.messages.insert(0, crate::llm::Message::system(prompt));
    }
}

pub async fn show(_cfg: &AgentConfig) -> Result<()> {
    println!("Memory: (stub — persistent memory not yet implemented)");
    Ok(())
}

pub async fn forget(_cfg: &AgentConfig, key: &str) -> Result<()> {
    println!("Forgot: {}", key);
    Ok(())
}

pub async fn search(_cfg: &AgentConfig, query: &str) -> Result<()> {
    println!("Searching memory for: {}", query);
    Ok(())
}
