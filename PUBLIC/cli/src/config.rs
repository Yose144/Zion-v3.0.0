//! Public CLI configuration — loaded from `~/.zion/zion.toml` or env vars.
//!
//! Only public-facing fields: node RPC, pool, miner, AI endpoint.
//! No deploy, SSH, DAO, bridge, or topology config.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub node: NodeConfig,
    #[serde(default)]
    pub pool: PoolConfig,
    #[serde(default)]
    pub miner: MinerConfig,
    #[serde(default)]
    pub ai: AiConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub rpc_host: String,
    pub rpc_port: u16,
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            rpc_host: "77.42.71.94".to_string(), // public Edge node
            rpc_port: 8443,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    pub host: String,
    pub port: u16,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            host: "77.42.71.94".to_string(), // public Edge pool
            port: 8444,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinerConfig {
    pub wallet: String,
    #[serde(default = "default_algorithm")]
    pub algorithm: String,
    #[serde(default = "default_backend")]
    pub backend: String,
    #[serde(default = "default_worker")]
    pub worker_name: String,
}

fn default_algorithm() -> String {
    "deeksha_lite_v1".into()
}
fn default_backend() -> String {
    "cpu".into()
}
fn default_worker() -> String {
    "worker-1".into()
}

impl Default for MinerConfig {
    fn default() -> Self {
        Self {
            wallet: String::new(),
            algorithm: default_algorithm(),
            backend: default_backend(),
            worker_name: default_worker(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    /// Hiran inference endpoint URL (OpenAI-compatible).
    pub url: String,
    /// Model name for chat completions.
    #[serde(default = "default_ai_model")]
    pub model: String,
}

fn default_ai_model() -> String {
    "hiran-v2.2".into()
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            url: "http://77.42.71.94:8080".to_string(),
            model: default_ai_model(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            node: NodeConfig::default(),
            pool: PoolConfig::default(),
            miner: MinerConfig::default(),
            ai: AiConfig::default(),
        }
    }
}

/// Resolve config file path: `~/.zion/zion.toml`.
pub fn config_path() -> Result<PathBuf> {
    let home = dirs_home()?;
    Ok(home.join(".zion").join("zion.toml"))
}

fn dirs_home() -> Result<PathBuf> {
    if let Ok(h) = std::env::var("HOME") {
        return Ok(PathBuf::from(h));
    }
    if let Ok(h) = std::env::var("USERPROFILE") {
        return Ok(PathBuf::from(h));
    }
    anyhow::bail!("cannot determine home directory (HOME / USERPROFILE unset)")
}

/// Load config from the given path, or the default path if `None`.
/// Falls back to `Config::default()` if the file does not exist.
pub fn load(path: Option<&str>) -> Result<Config> {
    let path = match path {
        Some(p) => PathBuf::from(p),
        None => config_path()?,
    };

    if !path.exists() {
        return Ok(Config::default());
    }

    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("read config {}", path.display()))?;
    let cfg: Config = toml::from_str(&raw)
        .with_context(|| format!("parse config {}", path.display()))?;
    Ok(cfg)
}

/// Set a single config value by dotted key (e.g. `miner.wallet`).
pub fn set_value(key: &str, value: &str) -> Result<()> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut cfg = load(None).unwrap_or_default();

    match key {
        "node.rpc_host" => cfg.node.rpc_host = value.to_string(),
        "node.rpc_port" => cfg.node.rpc_port = value.parse().context("invalid port")?,
        "pool.host" => cfg.pool.host = value.to_string(),
        "pool.port" => cfg.pool.port = value.parse().context("invalid port")?,
        "miner.wallet" => cfg.miner.wallet = value.to_string(),
        "miner.algorithm" => cfg.miner.algorithm = value.to_string(),
        "miner.backend" => cfg.miner.backend = value.to_string(),
        "miner.worker_name" => cfg.miner.worker_name = value.to_string(),
        "ai.url" => cfg.ai.url = value.to_string(),
        "ai.model" => cfg.ai.model = value.to_string(),
        _ => anyhow::bail!("unknown config key: {} (valid: node.rpc_host, node.rpc_port, pool.host, pool.port, miner.wallet, miner.algorithm, miner.backend, miner.worker_name, ai.url, ai.model)", key),
    }

    let raw = toml::to_string_pretty(&cfg)?;
    std::fs::write(&path, raw)?;
    println!("✓ {} = {} → {}", key, value, path.display());
    Ok(())
}
