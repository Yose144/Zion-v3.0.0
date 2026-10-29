//! Sandbox policy: cwd jail, secret-path deny, shell allowlist, confirm gates.

use anyhow::{bail, Result};
use std::path::{Component, Path, PathBuf};

/// Shell commands (first argv token) permitted without operator override.
pub const SHELL_ALLOWLIST: &[&str] = &[
    "cargo", "npm", "npx", "git", "rg", "ls", "cat", "head", "tail", "wc", "pwd", "echo",
    "find", "which", "file", "stat", "diff", "sed", "awk", "sort", "uniq", "grep", "tree",
    "rustc", "python3", "python", "node", "make", "true", "false", "test", "printf",
];

#[derive(Debug, Clone)]
pub struct Policy {
    pub cwd: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmKind {
    None,
    Write,
    Shell,
}

impl Policy {
    pub fn new(cwd: PathBuf) -> Self {
        Self { cwd }
    }

    /// Resolve `path` relative to cwd and ensure it stays inside the jail.
    pub fn resolve_in_jail(&self, path: &str) -> Result<PathBuf> {
        let raw = Path::new(path);
        let candidate = if raw.is_absolute() {
            raw.to_path_buf()
        } else {
            self.cwd.join(raw)
        };

        // Normalize without requiring the path to exist (for write targets).
        let normalized = normalize_path(&candidate);
        let cwd_norm = normalize_path(&self.cwd);

        if !normalized.starts_with(&cwd_norm) {
            bail!(
                "path escapes cwd jail: {} (cwd={})",
                normalized.display(),
                cwd_norm.display()
            );
        }

        if is_denied_secret_path(&normalized) {
            bail!("access denied to secret-like path: {}", normalized.display());
        }

        Ok(normalized)
    }

    pub fn check_shell(&self, command: &str) -> Result<()> {
        let trimmed = command.trim();
        if trimmed.is_empty() {
            bail!("empty shell command");
        }
        // Block obvious chaining that could smuggle denied binaries.
        if trimmed.contains("&&")
            || trimmed.contains("||")
            || trimmed.contains(';')
            || trimmed.contains('|')
            || trimmed.contains('`')
            || trimmed.contains("$(")
            || trimmed.contains('>')
            || trimmed.contains('<')
        {
            bail!("shell metacharacters not allowed in MVP (no pipes/redirects/chaining)");
        }

        let first = first_token(trimmed).ok_or_else(|| anyhow::anyhow!("empty shell command"))?;
        let base = Path::new(first)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(first);

        if !SHELL_ALLOWLIST.iter().any(|a| *a == base) {
            bail!(
                "shell command `{base}` not in allowlist (allowed: {})",
                SHELL_ALLOWLIST.join(", ")
            );
        }
        Ok(())
    }

    pub fn confirm_kind_for_tool(name: &str) -> ConfirmKind {
        match name {
            "write_file" | "str_replace" => ConfirmKind::Write,
            "run_shell" => ConfirmKind::Shell,
            _ => ConfirmKind::None,
        }
    }

    /// Returns Ok(true) if execution may proceed.
    pub fn confirm(&self, kind: ConfirmKind, summary: &str) -> Result<bool> {
        match kind {
            ConfirmKind::None => Ok(true),
            ConfirmKind::Write | ConfirmKind::Shell => {
                // Writes/shell always confirm unless ZION_AGENT_FORCE_YES=1 (ops escape).
                // `--yes` only skips non-destructive prompts (already handled via ConfirmKind::None).
                if std::env::var("ZION_AGENT_FORCE_YES").ok().as_deref() == Some("1") {
                    return Ok(true);
                }
                use std::io::IsTerminal;
                if !std::io::stdin().is_terminal() {
                    bail!(
                        "refusing {} without TTY confirm: {summary} \
                         (set ZION_AGENT_FORCE_YES=1 for non-interactive)",
                        match kind {
                            ConfirmKind::Write => "write",
                            ConfirmKind::Shell => "shell",
                            ConfirmKind::None => "action",
                        }
                    );
                }
                use dialoguer::Confirm;
                let prompt = match kind {
                    ConfirmKind::Write => format!("Allow write? {summary}"),
                    ConfirmKind::Shell => format!("Allow shell? {summary}"),
                    ConfirmKind::None => summary.to_string(),
                };
                Ok(Confirm::new().with_prompt(prompt).default(false).interact()?)
            }
        }
    }
}

fn first_token(cmd: &str) -> Option<&str> {
    cmd.split_whitespace().next()
}

/// Lexical normalize: collapse `.` / `..` without filesystem access.
fn normalize_path(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::Prefix(p) => out.push(p.as_os_str()),
            Component::RootDir => out.push("/"),
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            Component::Normal(c) => out.push(c),
        }
    }
    out
}

/// Deny `.env*`, `*mnemonic*`, `*key*` path segments (case-insensitive).
pub fn is_denied_secret_path(path: &Path) -> bool {
    for comp in path.components() {
        let Component::Normal(os) = comp else {
            continue;
        };
        let Some(name) = os.to_str() else {
            continue;
        };
        let lower = name.to_ascii_lowercase();
        if lower.starts_with(".env") {
            return true;
        }
        if lower.contains("mnemonic") {
            return true;
        }
        // `*key*` — match key-bearing names, avoid false positives like "keyboard".
        if lower.contains("privatekey")
            || lower.contains("privkey")
            || lower.ends_with(".key")
            || lower == "key"
            || lower.starts_with("key.")
            || lower.contains("_key")
            || lower.contains("-key")
            || lower.contains("apikey")
            || lower.contains("secret")
        {
            return true;
        }
        // Broad `*key*` per plan — also catch `validator.key`, `wallet_keys.json`.
        if lower.contains("key")
            && (lower.contains('.')
                || lower.contains('_')
                || lower.contains('-')
                || lower == "keys"
                || lower.ends_with("key"))
        {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pol(tmp: &Path) -> Policy {
        Policy::new(tmp.to_path_buf())
    }

    #[test]
    fn jail_blocks_escape() {
        let cwd = PathBuf::from("/tmp/zion-agent-jail");
        let p = pol(&cwd);
        assert!(p.resolve_in_jail("../etc/passwd").is_err());
        assert!(p.resolve_in_jail("/etc/passwd").is_err());
    }

    #[test]
    fn jail_allows_relative_inside() {
        let cwd = PathBuf::from("/tmp/zion-agent-jail");
        let p = pol(&cwd);
        let got = p.resolve_in_jail("src/main.rs").unwrap();
        assert_eq!(got, PathBuf::from("/tmp/zion-agent-jail/src/main.rs"));
    }

    #[test]
    fn deny_env_and_key_paths() {
        assert!(is_denied_secret_path(Path::new("/proj/.env")));
        assert!(is_denied_secret_path(Path::new("/proj/.env.local")));
        assert!(is_denied_secret_path(Path::new("/proj/mnemonic.txt")));
        assert!(is_denied_secret_path(Path::new("/proj/validator.key")));
        assert!(is_denied_secret_path(Path::new("/proj/api_key.json")));
        assert!(!is_denied_secret_path(Path::new("/proj/src/main.rs")));
        assert!(!is_denied_secret_path(Path::new("/proj/Cargo.toml")));
    }

    #[test]
    fn shell_allowlist() {
        let p = pol(Path::new("/tmp"));
        assert!(p.check_shell("cargo test -p zion-cli").is_ok());
        assert!(p.check_shell("rg pattern src").is_ok());
        assert!(p.check_shell("rm -rf /").is_err());
        assert!(p.check_shell("cargo test && rm -rf /").is_err());
        assert!(p.check_shell("ls | cat").is_err());
    }
}
