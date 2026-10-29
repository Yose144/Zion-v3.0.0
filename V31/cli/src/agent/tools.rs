//! Agent tools: read/write/replace/shell/git + OpenAI tool schemas.

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;

use super::policy::Policy;

#[derive(Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: Value,
}

pub fn openai_tool_defs() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read a UTF-8 text file relative to the working directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path inside cwd"}
                    },
                    "required": ["path"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "write_file",
                "description": "Write/overwrite a UTF-8 text file (requires confirm).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["path", "content"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "str_replace",
                "description": "Replace exact old_string with new_string in a file (requires confirm).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "old_string": {"type": "string"},
                        "new_string": {"type": "string"}
                    },
                    "required": ["path", "old_string", "new_string"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "run_shell",
                "description": "Run an allowlisted shell command in cwd (no pipes/redirects).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"}
                    },
                    "required": ["command"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "git_status",
                "description": "Run git status --short in cwd.",
                "parameters": {"type": "object", "properties": {}}
            }
        },
        {
            "type": "function",
            "function": {
                "name": "git_diff",
                "description": "Run git diff (optionally staged) in cwd.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "staged": {"type": "boolean"}
                    }
                }
            }
        }
    ])
}

/// Parse JSON-fence tool protocol from assistant text.
/// Accepts ```json {"tool":"name","args":{...}} ``` or bare `{"tool":...}`.
pub fn parse_json_fence_tools(content: &str) -> Vec<ToolCall> {
    let mut out = Vec::new();
    for candidate in extract_json_objects(content) {
        if let Ok(v) = serde_json::from_str::<Value>(&candidate) {
            if let Some(name) = v.get("tool").and_then(|t| t.as_str()) {
                let args = v.get("args").cloned().unwrap_or(json!({}));
                out.push(ToolCall {
                    id: format!("fence_{}", out.len() + 1),
                    name: name.to_string(),
                    args,
                });
            }
        }
    }
    out
}

fn extract_json_objects(content: &str) -> Vec<String> {
    let mut found = Vec::new();

    // Fenced blocks first.
    let mut rest = content;
    while let Some(start) = rest.find("```") {
        let after = &rest[start + 3..];
        let after = after
            .strip_prefix("json")
            .or_else(|| after.strip_prefix("JSON"))
            .unwrap_or(after);
        let after = after.strip_prefix('\n').unwrap_or(after);
        if let Some(end) = after.find("```") {
            let block = after[..end].trim();
            if block.starts_with('{') {
                found.push(block.to_string());
            }
            rest = &after[end + 3..];
        } else {
            break;
        }
    }

    // Also try whole-content / line-oriented bare JSON object with "tool".
    if found.is_empty() {
        for line in content.lines() {
            let t = line.trim();
            if t.starts_with('{') && t.contains("\"tool\"") {
                found.push(t.to_string());
            }
        }
        // Multi-line bare object: first `{` to matching `}`.
        if found.is_empty() {
            if let Some(start) = content.find('{') {
                if let Some(obj) = balanced_json_slice(&content[start..]) {
                    if obj.contains("\"tool\"") {
                        found.push(obj);
                    }
                }
            }
        }
    }

    found
}

fn balanced_json_slice(s: &str) -> Option<String> {
    let mut depth = 0i32;
    let mut in_str = false;
    let mut escape = false;
    for (i, ch) in s.char_indices() {
        if in_str {
            if escape {
                escape = false;
            } else if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                in_str = false;
            }
            continue;
        }
        match ch {
            '"' => in_str = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(s[..=i].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

pub async fn execute_tool(policy: &Policy, call: &ToolCall) -> Result<String> {
    let kind = Policy::confirm_kind_for_tool(&call.name);
    let summary = format!("{} {}", call.name, call.args);
    if !policy.confirm(kind, &summary)? {
        return Ok("tool cancelled by operator".into());
    }

    match call.name.as_str() {
        "read_file" => {
            let path = arg_str(&call.args, "path")?;
            let full = policy.resolve_in_jail(path)?;
            let data = std::fs::read_to_string(&full)
                .with_context(|| format!("read {}", full.display()))?;
            Ok(truncate(&data, 80_000))
        }
        "write_file" => {
            let path = arg_str(&call.args, "path")?;
            let content = arg_str(&call.args, "content")?;
            let full = policy.resolve_in_jail(path)?;
            if let Some(parent) = full.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&full, content)
                .with_context(|| format!("write {}", full.display()))?;
            Ok(format!("wrote {} bytes to {}", content.len(), full.display()))
        }
        "str_replace" => {
            let path = arg_str(&call.args, "path")?;
            let old = arg_str(&call.args, "old_string")?;
            let new = arg_str(&call.args, "new_string")?;
            let full = policy.resolve_in_jail(path)?;
            let data = std::fs::read_to_string(&full)
                .with_context(|| format!("read {}", full.display()))?;
            let matches = data.matches(old).count();
            if matches == 0 {
                bail!("old_string not found in {}", full.display());
            }
            if matches > 1 {
                bail!("old_string matched {matches} times; must be unique");
            }
            let updated = data.replacen(old, new, 1);
            std::fs::write(&full, updated)?;
            Ok(format!("replaced in {}", full.display()))
        }
        "run_shell" => {
            let command = arg_str(&call.args, "command")?;
            policy.check_shell(command)?;
            run_shell_allowlisted(&policy.cwd, command)
        }
        "git_status" => {
            policy.check_shell("git status")?;
            run_shell_allowlisted(&policy.cwd, "git status --short")
        }
        "git_diff" => {
            let staged = call
                .args
                .get("staged")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let cmd = if staged {
                "git diff --cached"
            } else {
                "git diff"
            };
            policy.check_shell(cmd)?;
            run_shell_allowlisted(&policy.cwd, cmd)
        }
        other => bail!("unknown tool: {other}"),
    }
}

fn arg_str<'a>(args: &'a Value, key: &str) -> Result<&'a str> {
    args.get(key)
        .and_then(|v| v.as_str())
        .with_context(|| format!("missing string arg `{key}`"))
}

fn run_shell_allowlisted(cwd: &Path, command: &str) -> Result<String> {
    let mut parts = command.split_whitespace();
    let prog = parts.next().context("empty command")?;
    let args: Vec<&str> = parts.collect();
    let output = Command::new(prog)
        .args(&args)
        .current_dir(cwd)
        .output()
        .with_context(|| format!("spawn `{prog}`"))?;
    let mut text = String::new();
    text.push_str(&String::from_utf8_lossy(&output.stdout));
    if !output.stderr.is_empty() {
        if !text.is_empty() {
            text.push('\n');
        }
        text.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    if !output.status.success() {
        text.push_str(&format!(
            "\n[exit {}]",
            output.status.code().unwrap_or(-1)
        ));
    }
    Ok(truncate(&text, 40_000))
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}\n…[truncated {} bytes]", &s[..max], s.len() - max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::policy::ConfirmKind;

    #[test]
    fn parse_fence_tool() {
        let content = r#"I'll read the file.
```json
{"tool":"read_file","args":{"path":"Cargo.toml"}}
```
"#;
        let calls = parse_json_fence_tools(content);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "read_file");
        assert_eq!(calls[0].args["path"], "Cargo.toml");
    }

    #[test]
    fn parse_bare_tool_json() {
        let content = r#"{"tool":"git_status","args":{}}"#;
        let calls = parse_json_fence_tools(content);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "git_status");
    }

    #[test]
    fn confirm_kinds() {
        assert_eq!(
            Policy::confirm_kind_for_tool("read_file"),
            ConfirmKind::None
        );
        assert_eq!(
            Policy::confirm_kind_for_tool("write_file"),
            ConfirmKind::Write
        );
        assert_eq!(
            Policy::confirm_kind_for_tool("run_shell"),
            ConfirmKind::Shell
        );
    }
}
