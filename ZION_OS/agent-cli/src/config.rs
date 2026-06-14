use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    #[serde(default)]
    pub agent: AgentSettings,
    #[serde(default)]
    pub llm: LlmConfig,
    #[serde(default)]
    pub hiran: HiranConfig,
    #[serde(default)]
    pub safety: SafetyConfig,
    #[serde(default)]
    pub paths: PathConfig,
    #[serde(default)]
    pub coding: CodingConfig,
    #[serde(default)]
    pub l3: L3Config,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSettings {
    #[serde(default = "default_max_steps")]
    pub max_steps: u32,
    #[serde(default = "default_timeout_sec")]
    pub timeout_sec: u64,
    #[serde(default = "default_auto_approve")]
    pub auto_approve_safe: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    #[serde(default = "default_api_url")]
    pub api_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_context_size")]
    pub context_size: usize,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiranConfig {
    #[serde(default)]
    pub remote_host: String,
    #[serde(default = "default_remote_port")]
    pub remote_port: u16,
    #[serde(default)]
    pub ssh_key: PathBuf,
    #[serde(default = "default_ssh_user")]
    pub ssh_user: String,
    #[serde(default = "default_remote_workspace")]
    pub remote_workspace: String,
    #[serde(default = "default_local_backup_dir")]
    pub local_backup_dir: PathBuf,
    /// Remote path to the GGUF model file for inference
    #[serde(default)]
    pub gguf_path: String,
    /// Local port for SSH tunnel to inference server (default: 8080)
    #[serde(default = "default_tunnel_local_port")]
    pub tunnel_local_port: u16,
    /// Remote port where llama-server listens (default: 8080)
    #[serde(default = "default_tunnel_remote_port")]
    pub tunnel_remote_port: u16,
    /// Remote path to llama-server binary
    #[serde(default = "default_llama_server_bin")]
    pub llama_server_bin: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyConfig {
    #[serde(default = "default_true")]
    pub l1_protection: bool,
    #[serde(default = "default_true")]
    pub destructive_confirmation: bool,
    #[serde(default = "default_true")]
    pub secret_protection: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathConfig {
    #[serde(default = "default_models_dir")]
    pub models_dir: PathBuf,
    #[serde(default = "default_checkpoints_dir")]
    pub checkpoints_dir: PathBuf,
    #[serde(default = "default_repo_root")]
    pub repo_root: PathBuf,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct L3Config {
    /// WARP bridge HTTP API URL
    #[serde(default = "default_warp_url")]
    pub warp_url: String,
    /// AI-Native daemon HTTP API URL
    #[serde(default = "default_ai_native_url")]
    pub ai_native_url: String,
    /// NCL marketplace API URL
    #[serde(default = "default_ncl_url")]
    pub ncl_url: String,
    /// Enable L3 tool use in agent loop
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingConfig {
    /// Enable coding assistant mode (auto-build, test, lint)
    #[serde(default = "default_false")]
    pub enabled: bool,
    /// Project type: rust, node, python, generic
    #[serde(default = "default_project_type")]
    pub project_type: String,
    /// Build command (e.g. "cargo build --manifest-path V3/Cargo.toml")
    #[serde(default = "default_build_cmd")]
    pub build_cmd: String,
    /// Test command (e.g. "cargo test --manifest-path V3/Cargo.toml")
    #[serde(default = "default_test_cmd")]
    pub test_cmd: String,
    /// Lint command (e.g. "cargo clippy --manifest-path V3/Cargo.toml")
    #[serde(default = "default_lint_cmd")]
    pub lint_cmd: String,
    /// Format command (e.g. "cargo fmt --manifest-path V3/Cargo.toml")
    #[serde(default = "default_fmt_cmd")]
    pub fmt_cmd: String,
    /// Auto-run build after file edits
    #[serde(default = "default_true")]
    pub auto_build: bool,
    /// Auto-run tests after build success
    #[serde(default = "default_false")]
    pub auto_test: bool,
    /// Auto-run lint after edits
    #[serde(default = "default_true")]
    pub auto_lint: bool,
}

// -- defaults --

fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}
fn default_max_steps() -> u32 {
    50
}
fn default_timeout_sec() -> u64 {
    300
}
fn default_auto_approve() -> bool {
    false
}
fn default_project_type() -> String {
    "rust".into()
}
fn default_build_cmd() -> String {
    "cargo build".into()
}
fn default_test_cmd() -> String {
    "cargo test".into()
}
fn default_lint_cmd() -> String {
    "cargo clippy".into()
}
fn default_fmt_cmd() -> String {
    "cargo fmt".into()
}
fn default_api_url() -> String {
    "http://localhost:8000/v1".into()
}
fn default_warp_url() -> String {
    "http://localhost:8460".into()
}
fn default_ai_native_url() -> String {
    "http://localhost:8460".into()
}
fn default_ncl_url() -> String {
    "http://localhost:8460".into()
}
fn default_model() -> String {
    "hiran-v2.3-merged".into()
}
fn default_context_size() -> usize {
    128_000
}
fn default_temperature() -> f32 {
    0.7
}
fn default_remote_port() -> u16 {
    31384
}
fn default_ssh_user() -> String {
    "root".into()
}
fn default_remote_workspace() -> String {
    "/workspace/hiran-v2.3".into()
}
fn default_local_backup_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("HiranV2.3-Checkpoints")
}
fn default_tunnel_local_port() -> u16 {
    8080
}
fn default_tunnel_remote_port() -> u16 {
    8080
}
fn default_llama_server_bin() -> String {
    "/workspace/llama.cpp/llama-server".into()
}
fn default_models_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("HiranModels")
}
fn default_checkpoints_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("HiranV2.3-Checkpoints")
}
fn default_repo_root() -> PathBuf {
    // Try to find git root, fallback to current dir
    PathBuf::from(".")
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            max_steps: default_max_steps(),
            timeout_sec: default_timeout_sec(),
            auto_approve_safe: default_auto_approve(),
        }
    }
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            api_url: default_api_url(),
            api_key: String::new(),
            model: default_model(),
            context_size: default_context_size(),
            temperature: default_temperature(),
        }
    }
}

impl Default for HiranConfig {
    fn default() -> Self {
        Self {
            remote_host: String::new(),
            remote_port: default_remote_port(),
            ssh_key: PathBuf::from("~/.ssh/vast/hiran_v2.4_key"),
            ssh_user: default_ssh_user(),
            remote_workspace: default_remote_workspace(),
            local_backup_dir: default_local_backup_dir(),
            gguf_path: String::new(),
            tunnel_local_port: default_tunnel_local_port(),
            tunnel_remote_port: default_tunnel_remote_port(),
            llama_server_bin: default_llama_server_bin(),
        }
    }
}

impl Default for SafetyConfig {
    fn default() -> Self {
        Self {
            l1_protection: true,
            destructive_confirmation: true,
            secret_protection: true,
        }
    }
}

impl Default for PathConfig {
    fn default() -> Self {
        Self {
            models_dir: default_models_dir(),
            checkpoints_dir: default_checkpoints_dir(),
            repo_root: default_repo_root(),
        }
    }
}

impl Default for CodingConfig {
    fn default() -> Self {
        Self {
            enabled: default_false(),
            project_type: default_project_type(),
            build_cmd: default_build_cmd(),
            test_cmd: default_test_cmd(),
            lint_cmd: default_lint_cmd(),
            fmt_cmd: default_fmt_cmd(),
            auto_build: default_true(),
            auto_test: default_false(),
            auto_lint: default_true(),
        }
    }
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            agent: AgentSettings::default(),
            llm: LlmConfig::default(),
            hiran: HiranConfig::default(),
            safety: SafetyConfig::default(),
            paths: PathConfig::default(),
            coding: CodingConfig::default(),
            l3: L3Config::default(),
        }
    }
}

pub fn config_path() -> Result<PathBuf> {
    let home = dirs::home_dir().context("Cannot determine home directory")?;
    Ok(home.join(".zion").join("agent-cli.toml"))
}

pub fn load(override_path: Option<&str>) -> Result<AgentConfig> {
    let path = match override_path {
        Some(p) => PathBuf::from(p),
        None => config_path()?,
    };

    if !path.exists() {
        return Ok(AgentConfig::default());
    }

    let text = std::fs::read_to_string(&path)
        .with_context(|| format!("Cannot read config: {}", path.display()))?;
    let cfg: AgentConfig =
        toml::from_str(&text).with_context(|| format!("Invalid config: {}", path.display()))?;
    Ok(cfg)
}

pub fn save(cfg: &AgentConfig) -> Result<()> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let text = toml::to_string_pretty(cfg)?;
    std::fs::write(&path, text)?;
    Ok(())
}

pub fn set_value(key: &str, value: &str) -> Result<()> {
    let mut cfg = load(None)?;
    let parts: Vec<&str> = key.splitn(2, '.').collect();
    match parts.as_slice() {
        ["agent", "max_steps"] => cfg.agent.max_steps = value.parse()?,
        ["agent", "timeout_sec"] => cfg.agent.timeout_sec = value.parse()?,
        ["agent", "auto_approve_safe"] => cfg.agent.auto_approve_safe = value.parse()?,
        ["llm", "api_url"] => cfg.llm.api_url = value.into(),
        ["llm", "api_key"] => cfg.llm.api_key = value.into(),
        ["llm", "model"] => cfg.llm.model = value.into(),
        ["llm", "temperature"] => cfg.llm.temperature = value.parse()?,
        ["hiran", "remote_host"] => cfg.hiran.remote_host = value.into(),
        ["hiran", "remote_port"] => cfg.hiran.remote_port = value.parse()?,
        ["hiran", "ssh_user"] => cfg.hiran.ssh_user = value.into(),
        ["hiran", "gguf_path"] => cfg.hiran.gguf_path = value.into(),
        ["hiran", "tunnel_local_port"] => cfg.hiran.tunnel_local_port = value.parse()?,
        ["hiran", "tunnel_remote_port"] => cfg.hiran.tunnel_remote_port = value.parse()?,
        ["hiran", "llama_server_bin"] => cfg.hiran.llama_server_bin = value.into(),
        ["paths", "models_dir"] => cfg.paths.models_dir = PathBuf::from(value),
        ["paths", "checkpoints_dir"] => cfg.paths.checkpoints_dir = PathBuf::from(value),
        ["paths", "repo_root"] => cfg.paths.repo_root = PathBuf::from(value),
        ["safety", "l1_protection"] => cfg.safety.l1_protection = value.parse()?,
        ["safety", "destructive_confirmation"] => cfg.safety.destructive_confirmation = value.parse()?,
        ["coding", "enabled"] => cfg.coding.enabled = value.parse()?,
        ["coding", "project_type"] => cfg.coding.project_type = value.into(),
        ["coding", "build_cmd"] => cfg.coding.build_cmd = value.into(),
        ["coding", "test_cmd"] => cfg.coding.test_cmd = value.into(),
        ["coding", "lint_cmd"] => cfg.coding.lint_cmd = value.into(),
        ["coding", "fmt_cmd"] => cfg.coding.fmt_cmd = value.into(),
        ["coding", "auto_build"] => cfg.coding.auto_build = value.parse()?,
        ["coding", "auto_test"] => cfg.coding.auto_test = value.parse()?,
        ["coding", "auto_lint"] => cfg.coding.auto_lint = value.parse()?,
        _ => anyhow::bail!("Unknown config key: {}", key),
    }
    save(&cfg)?;
    println!("{} = {}", key, value);
    Ok(())
}

pub async fn init_wizard() -> Result<()> {
    use std::io::{self, Write};

    println!("🤖 ZION Agent CLI — Configuration Wizard");
    println!();

    let mut cfg = AgentConfig::default();

    print!("LLM API URL [{}]: ", cfg.llm.api_url);
    io::stdout().flush()?;
    let mut buf = String::new();
    io::stdin().read_line(&mut buf)?;
    let s = buf.trim();
    if !s.is_empty() {
        cfg.llm.api_url = s.into();
    }

    print!("Model name [{}]: ", cfg.llm.model);
    io::stdout().flush()?;
    buf.clear();
    io::stdin().read_line(&mut buf)?;
    let s = buf.trim();
    if !s.is_empty() {
        cfg.llm.model = s.into();
    }

    print!("Remote training host (e.g. ssh1.vast.ai): ");
    io::stdout().flush()?;
    buf.clear();
    io::stdin().read_line(&mut buf)?;
    let s = buf.trim();
    if !s.is_empty() {
        cfg.hiran.remote_host = s.into();
    }

    print!("SSH key path [{}]: ", cfg.hiran.ssh_key.display());
    io::stdout().flush()?;
    buf.clear();
    io::stdin().read_line(&mut buf)?;
    let s = buf.trim();
    if !s.is_empty() {
        cfg.hiran.ssh_key = PathBuf::from(s);
    }

    print!("Local checkpoints dir [{}]: ", cfg.paths.checkpoints_dir.display());
    io::stdout().flush()?;
    buf.clear();
    io::stdin().read_line(&mut buf)?;
    let s = buf.trim();
    if !s.is_empty() {
        cfg.paths.checkpoints_dir = PathBuf::from(s);
    }

    print!("Local models dir [{}]: ", cfg.paths.models_dir.display());
    io::stdout().flush()?;
    buf.clear();
    io::stdin().read_line(&mut buf)?;
    let s = buf.trim();
    if !s.is_empty() {
        cfg.paths.models_dir = PathBuf::from(s);
    }

    println!();
    println!("🛠️  Coding Assistant Setup (optional)");
    print!("Enable coding mode? [y/N]: ");
    io::stdout().flush()?;
    buf.clear();
    io::stdin().read_line(&mut buf)?;
    if buf.trim().to_lowercase().starts_with('y') {
        cfg.coding.enabled = true;

        print!("Project type [{}]: ", cfg.coding.project_type);
        io::stdout().flush()?;
        buf.clear();
        io::stdin().read_line(&mut buf)?;
        let s = buf.trim();
        if !s.is_empty() { cfg.coding.project_type = s.into(); }

        print!("Build command [{}]: ", cfg.coding.build_cmd);
        io::stdout().flush()?;
        buf.clear();
        io::stdin().read_line(&mut buf)?;
        let s = buf.trim();
        if !s.is_empty() { cfg.coding.build_cmd = s.into(); }

        print!("Test command [{}]: ", cfg.coding.test_cmd);
        io::stdout().flush()?;
        buf.clear();
        io::stdin().read_line(&mut buf)?;
        let s = buf.trim();
        if !s.is_empty() { cfg.coding.test_cmd = s.into(); }

        print!("Lint command [{}]: ", cfg.coding.lint_cmd);
        io::stdout().flush()?;
        buf.clear();
        io::stdin().read_line(&mut buf)?;
        let s = buf.trim();
        if !s.is_empty() { cfg.coding.lint_cmd = s.into(); }

        cfg.coding.auto_build = true;
        cfg.coding.auto_lint = true;
    }

    save(&cfg)?;
    println!();
    println!("✅ Config saved to {}", config_path()?.display());
    Ok(())
}
