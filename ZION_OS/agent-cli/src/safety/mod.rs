use crate::config::AgentConfig;
use crate::llm::ToolCall;
use anyhow::Result;

pub struct SafetyChecker {
    l1_protection: bool,
    destructive_confirmation: bool,
    secret_protection: bool,
}

impl SafetyChecker {
    pub fn new(cfg: &AgentConfig) -> Self {
        Self {
            l1_protection: cfg.safety.l1_protection,
            destructive_confirmation: cfg.safety.destructive_confirmation,
            secret_protection: cfg.safety.secret_protection,
        }
    }

    pub fn is_allowed(&self, call: &ToolCall) -> Result<bool> {
        match call.name.as_str() {
            "write_file" | "edit_file" => {
                let path = call.arguments["path"].as_str().unwrap_or("");
                if self.l1_protection && is_l1_path(path) {
                    return Ok(false);
                }
                if self.secret_protection && is_secret_path(path) {
                    return Ok(false);
                }
            }
            "read_file" => {
                let path = call.arguments["path"].as_str().unwrap_or("");
                if self.secret_protection && is_secret_path(path) {
                    return Ok(false);
                }
            }
            "shell" => {
                let cmd = call.arguments["command"].as_str().unwrap_or("");
                if is_destructive_command(cmd) {
                    return Ok(false);
                }
            }
            "git_commit" => {
                // Always allowed, but may require approval depending on auto_approve
            }
            _ => {}
        }
        Ok(true)
    }

    pub fn requires_approval(&self, call: &ToolCall) -> bool {
        if !self.destructive_confirmation {
            return false;
        }
        match call.name.as_str() {
            "write_file" | "edit_file" => true,
            "shell" => {
                let cmd = call.arguments["command"].as_str().unwrap_or("");
                cmd.contains("git push") || cmd.contains("cargo publish")
            }
            "git_commit" => false,
            _ => false,
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
}

fn is_secret_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains("secret")
        || lower.contains("key")
        || lower.contains("wallet")
        || lower.contains("mnemonic")
        || lower.contains("private")
        || lower.ends_with(".env")
}

fn is_destructive_command(cmd: &str) -> bool {
    let lower = cmd.to_lowercase();
    lower.contains("rm -rf")
        || lower.contains("rm -r /")
        || lower.contains("dd if=/dev/zero")
        || lower.contains("mkfs")
        || lower.contains(":(){ :|:& };:")
        || lower.contains("curl") && lower.contains("| sh")
        || lower.contains("curl") && lower.contains("| bash")
}
