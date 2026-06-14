use crate::config::AgentConfig;
use anyhow::Result;

pub struct Planner;

impl Planner {
    pub fn new(_cfg: &AgentConfig) -> Self {
        Self
    }

    pub fn plan(&self, task: &str) -> Result<Vec<String>> {
        let lower = task.to_lowercase();
        let mut steps = vec![];

        // Keyword-based decomposition for common ZION tasks
        if lower.contains("refactor") || lower.contains("rewrite") {
            steps.push("Analyze current code structure".into());
            steps.push("Identify dependencies and callers".into());
            steps.push("Create new implementation".into());
            steps.push("Update tests".into());
            steps.push("Run cargo check and tests".into());
        }
        if lower.contains("fix") || lower.contains("bug") {
            steps.push("Reproduce the issue".into());
            steps.push("Identify root cause".into());
            steps.push("Implement fix".into());
            steps.push("Add regression test".into());
            steps.push("Verify fix works".into());
        }
        if lower.contains("test") || lower.contains("unit test") {
            steps.push("Identify untested code paths".into());
            steps.push("Write test cases (happy path + edge cases)".into());
            steps.push("Run tests with cargo test".into());
        }
        if lower.contains("deploy") || lower.contains("release") {
            steps.push("Run full test suite".into());
            steps.push("Build release binaries".into());
            steps.push("Update version and changelog".into());
            steps.push("Tag release in git".into());
        }
        if lower.contains("doc") || lower.contains("document") {
            steps.push("Identify undocumented public APIs".into());
            steps.push("Add rustdoc comments".into());
            steps.push("Update README / status docs".into());
        }
        if lower.contains("gpu") || lower.contains("opencl") || lower.contains("cuda") {
            steps.push("Check kernel compilation".into());
            steps.push("Verify GPU device detection".into());
            steps.push("Run GPU KAT benchmarks".into());
            steps.push("Test with real pool connection".into());
        }
        if lower.contains("fork") || lower.contains("consensus") || lower.contains("hard fork") {
            steps.push("Review L1 consensus rules (AGENTS.md)".into());
            steps.push("Implement fork logic with height guard".into());
            steps.push("Add unit tests for both pre/post fork".into());
            steps.push("Verify no breaking changes before fork height".into());
        }

        if steps.is_empty() {
            steps.push("Understand the task and codebase".into());
            steps.push("Plan implementation approach".into());
            steps.push("Implement changes".into());
            steps.push("Test and verify".into());
        }

        // Always end with validation
        steps.push("Run cargo fmt + clippy".into());
        steps.push("Git diff review before commit".into());

        Ok(steps)
    }
}
