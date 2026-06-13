use crate::llm::ToolCall;
use anyhow::Result;
use regex::Regex;
use serde_json::json;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub struct FileTool {
    repo_root: PathBuf,
}

impl FileTool {
    pub fn new(repo_root: &Path) -> Self {
        Self {
            repo_root: repo_root.to_path_buf(),
        }
    }

    pub fn schema(&self) -> serde_json::Value {
        json!({
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read contents of a file. Use offset and limit for large files.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative or absolute file path" },
                        "offset": { "type": "integer", "description": "Start line (1-based)", "default": 1 },
                        "limit": { "type": "integer", "description": "Max lines to read", "default": 100 }
                    },
                    "required": ["path"]
                }
            }
        })
    }

    pub async fn read(&self, call: &ToolCall) -> Result<String> {
        let path = call.arguments["path"].as_str().unwrap_or(".");
        let offset = call.arguments["offset"].as_u64().unwrap_or(1).saturating_sub(1);
        let limit = call.arguments["limit"].as_u64().unwrap_or(100) as usize;

        let full_path = self.resolve(path);
        let content = tokio::fs::read_to_string(&full_path).await?;

        let lines: Vec<&str> = content.lines().collect();
        let start = offset as usize;
        let end = (start + limit).min(lines.len());

        if start >= lines.len() {
            return Ok(format!("File has {} lines. Offset {} is out of range.", lines.len(), offset + 1));
        }

        let selected = &lines[start..end];
        let numbered: Vec<String> = selected
            .iter()
            .enumerate()
            .map(|(i, line)| format!("{}: {}", start + i + 1, line))
            .collect();

        let result = numbered.join("\n");
        let truncated = if end < lines.len() {
            format!("{}\n... ({} more lines)", result, lines.len() - end)
        } else {
            result
        };

        Ok(truncated)
    }

    pub async fn write(&self, call: &ToolCall) -> Result<String> {
        let path = call.arguments["path"].as_str().unwrap_or(".");
        let content = call.arguments["content"].as_str().unwrap_or("");

        let full_path = self.resolve(path);
        if let Some(parent) = full_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::write(&full_path, content).await?;
        Ok(format!("Wrote {} bytes to {}", content.len(), full_path.display()))
    }

    pub async fn edit(&self, call: &ToolCall) -> Result<String> {
        let path = call.arguments["path"].as_str().unwrap_or(".");
        let old = call.arguments["old_string"].as_str().ok_or_else(|| anyhow::anyhow!("Missing old_string"))?;
        let new = call.arguments["new_string"].as_str().ok_or_else(|| anyhow::anyhow!("Missing new_string"))?;

        let full_path = self.resolve(path);
        let content = tokio::fs::read_to_string(&full_path).await?;

        if !content.contains(old) {
            return Err(anyhow::anyhow!(
                "old_string not found in file. The file may have changed. Try reading it first."
            ));
        }

        let updated = content.replacen(old, new, 1);
        tokio::fs::write(&full_path, updated).await?;
        Ok(format!("Edited {} (replaced {} chars with {} chars)", full_path.display(), old.len(), new.len()))
    }

    pub async fn search(&self, call: &ToolCall) -> Result<String> {
        let pattern = call.arguments["pattern"].as_str().unwrap_or("");
        let path = call.arguments["path"].as_str().unwrap_or(".");
        let max_results = call.arguments["max_results"].as_u64().unwrap_or(20) as usize;

        let full_path = self.resolve(path);
        let re = Regex::new(pattern)?;
        let mut results = Vec::new();

        for entry in WalkDir::new(&full_path)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let file_path = entry.path();
            if let Ok(content) = std::fs::read_to_string(file_path) {
                for (i, line) in content.lines().enumerate() {
                    if re.is_match(line) {
                        let rel = file_path.strip_prefix(&self.repo_root).unwrap_or(file_path);
                        results.push(format!("{}:{}: {}", rel.display(), i + 1, line.trim()));
                        if results.len() >= max_results {
                            break;
                        }
                    }
                }
            }
            if results.len() >= max_results {
                break;
            }
        }

        if results.is_empty() {
            return Ok(format!("No matches for '{}' in {}", pattern, full_path.display()));
        }

        Ok(results.join("\n"))
    }

    fn resolve(&self, path: &str) -> PathBuf {
        let p = PathBuf::from(path);
        if p.is_absolute() {
            p
        } else {
            self.repo_root.join(p)
        }
    }
}
