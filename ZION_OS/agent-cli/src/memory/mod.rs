use crate::config::AgentConfig;
use crate::llm::ToolCall;
use anyhow::Result;

pub mod store;
use store::SessionStore;

pub struct AgentMemory {
    store: Option<SessionStore>,
    session_id: String,
}

impl AgentMemory {
    pub fn new(cfg: &AgentConfig) -> Self {
        let store = SessionStore::new(cfg).ok();
        let session_id = format!("session-{}", chrono::Utc::now().timestamp());
        Self { store, session_id }
    }

    pub fn with_id(cfg: &AgentConfig, id: &str) -> Self {
        let store = SessionStore::new(cfg).ok();
        Self {
            store,
            session_id: id.to_string(),
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn save_state(&self, task: &str, max_steps: u32) {
        if let Some(store) = &self.store {
            let _ = store.create_session(&self.session_id, task, max_steps);
        }
    }

    pub fn save_messages(&self, messages: &[crate::llm::Message]) {
        if let Some(store) = &self.store {
            let _ = store.save_messages(&self.session_id, messages);
        }
    }

    pub fn record_success(&mut self, _tool: &ToolCall, _output: &str) {}
    pub fn record_failure(&mut self, _tool: &ToolCall, _error: &str) {
        if let Some(store) = &self.store {
            let _ = store.increment_error(&self.session_id);
        }
    }

    pub fn increment_step(&self) -> u32 {
        if let Some(store) = &self.store {
            store.increment_step(&self.session_id).unwrap_or(0)
        } else {
            0
        }
    }

    pub fn set_status(&self, status: &str) {
        if let Some(store) = &self.store {
            let _ = store.set_status(&self.session_id, status);
        }
    }

    pub fn increment_retry(&self) {
        if let Some(store) = &self.store {
            let _ = store.increment_retry(&self.session_id);
        }
    }
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

    pub fn add_user_message(&mut self, msg: &str) {
        self.messages.push(crate::llm::Message::user(msg));
    }

    pub fn add_self_correction_hint(&mut self, tool: &ToolCall, error: &str) {
        let content = format!(
            "The tool '{}' failed with error: {}. \
            Please analyze the error and fix your approach. \
            You may need to read the relevant file first to understand the context, \
            then use edit_file with correct arguments.",
            tool.name, error
        );
        self.messages.push(crate::llm::Message::user(content));
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
