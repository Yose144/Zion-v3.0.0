use crate::config::AgentConfig;
use crate::llm::ToolCall;
use anyhow::Result;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RiskLevel {
    Safe,       // read-only, no side effects
    Medium,     // file edits, local commands
    Dangerous,  // git push, destructive commands, L1 paths
    Blocked,    // always blocked (rm -rf, secret files)
}

impl RiskLevel {
    pub fn can_auto_approve(&self, auto_level: AutoApproveLevel) -> bool {
        match (self, auto_level) {
            (RiskLevel::Safe, _) => true,
            (RiskLevel::Medium, AutoApproveLevel::Medium) => true,
            (RiskLevel::Medium, AutoApproveLevel::Dangerous) => true,
            (RiskLevel::Dangerous, AutoApproveLevel::Dangerous) => true,
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AutoApproveLevel {
    None,       // manual approval for everything
    Safe,       // auto-approve read-only tools
    Medium,     // auto-approve file edits + safe commands
    Dangerous,  // auto-approve everything except Blocked
}

impl AutoApproveLevel {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "safe" => AutoApproveLevel::Safe,
            "medium" => AutoApproveLevel::Medium,
            "dangerous" | "all" => AutoApproveLevel::Dangerous,
            _ => AutoApproveLevel::None,
        }
    }
}

pub struct SafetyChecker {
    l1_protection: bool,
    secret_protection: bool,
    auto_level: AutoApproveLevel,
}

impl SafetyChecker {
    pub fn new(cfg: &AgentConfig) -> Self {
        let auto_level = if cfg.agent.auto_approve_safe {
            AutoApproveLevel::from_str("medium")
        } else {
            AutoApproveLevel::None
        };

        Self {
            l1_protection: cfg.safety.l1_protection,
            secret_protection: cfg.safety.secret_protection,
            auto_level,
        }
    }

    pub fn new_with_level(cfg: &AgentConfig, level: AutoApproveLevel) -> Self {
        Self {
            l1_protection: cfg.safety.l1_protection,
            secret_protection: cfg.safety.secret_protection,
            auto_level: level,
        }
    }

    /// Classify the risk of a tool call
    pub fn classify(&self, call: &ToolCall) -> RiskLevel {
        match call.name.as_str() {
            "read_file" | "search" | "git_status" | "git_diff" | "think" | "finish" => {
                RiskLevel::Safe
            }
            "build" | "test" | "lint" | "format" => RiskLevel::Safe,
            "write_file" | "edit_file" => {
                let path = call.arguments["path"].as_str().unwrap_or("");
                if self.l1_protection && is_l1_path(path) {
                    return RiskLevel::Blocked;
                }
                if self.secret_protection && is_secret_path(path) {
                    return RiskLevel::Blocked;
                }
                RiskLevel::Medium
            }
            "shell" => {
                let cmd = call.arguments["command"].as_str().unwrap_or("");
                if is_destructive_command(cmd) {
                    return RiskLevel::Blocked;
                }
                if is_dangerous_command(cmd) {
                    return RiskLevel::Dangerous;
                }
                RiskLevel::Medium
            }
            "git_commit" => RiskLevel::Medium,
            "git_push" | "git_force_push" => RiskLevel::Dangerous,
            _ => RiskLevel::Medium,
        }
    }

    /// Check if tool call is allowed (not blocked)
    pub fn is_allowed(&self, call: &ToolCall) -> Result<bool> {
        Ok(self.classify(call) != RiskLevel::Blocked)
    }

    /// Check if this call requires user approval
    pub fn requires_approval(&self, call: &ToolCall) -> bool {
        let risk = self.classify(call);
        !risk.can_auto_approve(self.auto_level)
    }

    /// Get human-readable description of why approval is needed
    pub fn approval_reason(&self, call: &ToolCall) -> String {
        match self.classify(call) {
            RiskLevel::Blocked => "BLOCKED by safety guardrails".into(),
            RiskLevel::Dangerous => "DANGEROUS action requires explicit approval".into(),
            RiskLevel::Medium => "MEDIUM risk action (file edit or command)".into(),
            RiskLevel::Safe => "SAFE — should have been auto-approved".into(),
        }
    }
}

fn is_l1_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains("v3/l1/core/src/")
        || lower.contains("v3/l1/cosmic-harmony/src/")
        || lower.contains("emission.rs")
        || lower.contains("genesis.rs")
        || lower.contains("fee.rs")
        || lower.contains("crypto.rs")
        || lower.contains("consensus.rs")
        || lower.contains("canonical")
}

fn is_secret_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains("secret")
        || lower.contains("private_key")
        || lower.contains("wallet_seed")
        || lower.contains("mnemonic")
        || lower.ends_with(".env")
        || lower.contains("ssh_key")
        || lower.contains("api_key")
        || lower.contains("token")
}

fn is_destructive_command(cmd: &str) -> bool {
    let lower = cmd.to_lowercase();
    lower.contains("rm -rf /")
        || lower.contains("rm -rf ~")
        || lower.contains("rm -rf *")
        || lower.contains("dd if=/dev/zero")
        || lower.contains("mkfs")
        || lower.contains(":(){ :|:& };:")
        || (lower.contains("curl") && lower.contains("| sh"))
        || (lower.contains("curl") && lower.contains("| bash"))
        || lower.contains("> /dev/sda")
        || lower.contains("format c:")
}

fn is_dangerous_command(cmd: &str) -> bool {
    let lower = cmd.to_lowercase();
    lower.contains("git push")
        || lower.contains("git push --force")
        || lower.contains("git push -f")
        || lower.contains("cargo publish")
        || lower.contains("npm publish")
        || lower.contains("docker system prune")
        || lower.contains("docker rm -f")
}
