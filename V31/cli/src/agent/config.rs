//! Load/merge agent config from env + `~/.zion/agent.toml`.

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Default public Hiran gateway (OpenAI-compatible `/v1`).
pub const DEFAULT_BASE_URL: &str = "https://market.zionterranova.com/v1";
pub const DEFAULT_MARKET_URL: &str = "https://market.zionterranova.com";
pub const DEFAULT_MODEL: &str = "hiran-mini";
pub const DEFAULT_MAX_TURNS: u32 = 12;

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub base_url: String,
    pub api_key: Option<String>,
    pub model: String,
    pub cwd: PathBuf,
    pub max_turns: u32,
    /// Skip confirm for non-destructive tools (read/git_status/git_diff).
    pub yes: bool,
}

#[derive(Debug, Default, Deserialize, Serialize)]
struct TomlConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    max_turns: Option<u32>,
}

impl AgentConfig {
    /// Merge CLI overrides over env over `~/.zion/agent.toml` over defaults.
    pub fn load(
        model: Option<String>,
        cwd: Option<PathBuf>,
        max_turns: Option<u32>,
        yes: bool,
        base_url: Option<String>,
    ) -> Result<Self> {
        let toml_path = agent_toml_path();
        let file = load_toml(&toml_path).unwrap_or_default();

        let api_key = std::env::var("ZION_HIRAN_API_KEY")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .or(file.api_key.filter(|s| !s.trim().is_empty()));

        let base_url = base_url
            .or_else(|| std::env::var("ZION_HIRAN_BASE_URL").ok())
            .or(file.base_url)
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string();

        let model = model
            .or_else(|| std::env::var("ZION_HIRAN_MODEL").ok())
            .or(file.model)
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());

        let max_turns = max_turns
            .or(file.max_turns)
            .unwrap_or(DEFAULT_MAX_TURNS)
            .max(1);

        let cwd = match cwd {
            Some(p) => p.canonicalize().with_context(|| format!("cwd {}", p.display()))?,
            None => std::env::current_dir().context("current_dir")?,
        };

        Ok(Self {
            base_url,
            api_key,
            model,
            cwd,
            max_turns,
            yes,
        })
    }

    pub fn require_api_key(&self) -> Result<&str> {
        match self.api_key.as_deref() {
            Some(k) if !k.is_empty() => Ok(k),
            _ => bail!(
                "Hiran API key missing. Run `zion hiran login` or set ZION_HIRAN_API_KEY / \
                 api_key in ~/.zion/agent.toml"
            ),
        }
    }

    /// Persist api_key (+ optional base_url/model) atomically to `~/.zion/agent.toml`.
    pub fn save_api_key(api_key: &str, base_url: Option<&str>, model: Option<&str>) -> Result<PathBuf> {
        let path = agent_toml_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("mkdir {}", parent.display()))?;
        }
        let mut cfg = load_toml(&path).unwrap_or_default();
        cfg.api_key = Some(api_key.to_string());
        if let Some(u) = base_url {
            cfg.base_url = Some(u.trim_end_matches('/').to_string());
        } else if cfg.base_url.is_none() {
            cfg.base_url = Some(DEFAULT_BASE_URL.to_string());
        }
        if let Some(m) = model {
            cfg.model = Some(m.to_string());
        } else if cfg.model.is_none() {
            cfg.model = Some(DEFAULT_MODEL.to_string());
        }
        write_toml_atomic(&path, &cfg)?;
        Ok(path)
    }

    /// Clear api_key from toml (logout). Leaves other fields.
    pub fn clear_api_key() -> Result<PathBuf> {
        let path = agent_toml_path();
        let mut cfg = load_toml(&path).unwrap_or_default();
        cfg.api_key = None;
        if path.exists() || cfg.base_url.is_some() || cfg.model.is_some() {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            write_toml_atomic(&path, &cfg)?;
        }
        Ok(path)
    }

    pub fn agent_toml_path_public() -> PathBuf {
        agent_toml_path()
    }
}

/// MarketPlace apex (device-code + subscribe), not the `/v1` gateway.
pub fn market_base_url() -> String {
    std::env::var("ZION_MARKET_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_MARKET_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

fn agent_toml_path() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".zion").join("agent.toml")
    } else {
        PathBuf::from(".zion").join("agent.toml")
    }
}

fn load_toml(path: &Path) -> Result<TomlConfig> {
    if !path.exists() {
        return Ok(TomlConfig::default());
    }
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("read {}", path.display()))?;
    toml::from_str(&raw).with_context(|| format!("parse {}", path.display()))
}

fn write_toml_atomic(path: &Path, cfg: &TomlConfig) -> Result<()> {
    let body = toml::to_string_pretty(cfg).context("serialize agent.toml")?;
    let tmp = path.with_extension("toml.tmp");
    std::fs::write(&tmp, body).with_context(|| format!("write {}", tmp.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp, path).with_context(|| format!("rename {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn defaults_without_key() {
        let cfg = AgentConfig {
            base_url: DEFAULT_BASE_URL.to_string(),
            api_key: None,
            model: DEFAULT_MODEL.to_string(),
            cwd: PathBuf::from("/tmp"),
            max_turns: DEFAULT_MAX_TURNS,
            yes: false,
        };
        assert!(cfg.require_api_key().is_err());
        assert_eq!(cfg.model, "hiran-mini");
    }

    #[test]
    fn write_toml_roundtrip_redacts_on_clear() {
        let _g = ENV_LOCK.lock().unwrap();
        let dir = std::env::temp_dir().join(format!("zion-agent-toml-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        // Point HOME at temp so agent_toml_path is isolated.
        // SAFETY: single-threaded test under mutex; restored below.
        let prev = std::env::var("HOME").ok();
        std::env::set_var("HOME", &dir);

        let path = AgentConfig::save_api_key("zis_testkey123", None, None).unwrap();
        assert!(path.exists());
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(raw.contains("zis_testkey123"));

        AgentConfig::clear_api_key().unwrap();
        let raw2 = std::fs::read_to_string(&path).unwrap();
        assert!(!raw2.contains("zis_testkey123"));

        if let Some(h) = prev {
            std::env::set_var("HOME", h);
        } else {
            std::env::remove_var("HOME");
        }
        let _ = std::fs::remove_dir_all(&dir);
    }
}
