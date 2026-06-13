use crate::config::AgentConfig;
use anyhow::Result;

pub struct Planner;

impl Planner {
    pub fn new(_cfg: &AgentConfig) -> Self {
        Self
    }

    pub fn plan(&self, _task: &str) -> Result<Vec<String>> {
        // Placeholder: would decompose task into sub-tasks
        Ok(vec![])
    }
}
