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
    pub agent: AgentConfig,
    #[serde(default)]
    pub deploy: DeployConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub rpc_host: String,
    pub rpc_port: u16,
    pub p2p_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinerConfig {
    pub wallet: String,
    pub threads: String,
    pub backend: String,
    pub profile: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub url: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeployConfig {
    pub default_server: String,
    pub ssh_key: String,
    pub ssh_user: String,
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            rpc_host: "91.98.122.165".into(),
            rpc_port: 8443,
            p2p_port: 8334,
        }
    }
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            host: "91.98.122.165".into(),
            port: 3333,
        }
    }
}

impl Default for MinerConfig {
    fn default() -> Self {
        Self {
            wallet: String::new(),
            threads: "auto".into(),
            backend: "auto".into(),
            profile: "pool".into(),
        }
    }
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            url: "http://91.98.122.165:8001".into(),
            model: "hiranyagarbha-v1".into(),
        }
    }
}

impl Default for DeployConfig {
    fn default() -> Self {
        Self {
            default_server: "prague".into(),
            ssh_key: "~/.ssh/zion_hetzner_key".into(),
            ssh_user: "root".into(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            node: NodeConfig::default(),
            pool: PoolConfig::default(),
            miner: MinerConfig::default(),
            agent: AgentConfig::default(),
            deploy: DeployConfig::default(),
        }
    }
}

pub fn config_path() -> Result<PathBuf> {
    let home = dirs_next()
        .context("Cannot determine home directory")?;
    Ok(home.join(".zion").join("zion.toml"))
}

pub fn load(override_path: Option<&str>) -> Result<Config> {
    let path = match override_path {
        Some(p) => PathBuf::from(p),
        None => config_path()?,
    };

    if !path.exists() {
        return Ok(Config::default());
    }

    let text = std::fs::read_to_string(&path)
        .with_context(|| format!("Cannot read config: {}", path.display()))?;
    let cfg: Config = toml::from_str(&text)
        .with_context(|| format!("Invalid config: {}", path.display()))?;
    Ok(cfg)
}

pub fn save(cfg: &Config) -> Result<()> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let text = toml::to_string_pretty(cfg)?;
    std::fs::write(&path, text)?;
    Ok(())
}

pub fn set_value(key: &str, value: &str) -> Result<()> {
    // simple dot-notation setter: node.rpc_host, agent.url, etc.
    let mut cfg = load(None)?;
    let parts: Vec<&str> = key.splitn(2, '.').collect();
    match parts.as_slice() {
        ["node", "rpc_host"] => cfg.node.rpc_host = value.into(),
        ["node", "rpc_port"] => cfg.node.rpc_port = value.parse()?,
        ["node", "p2p_port"] => cfg.node.p2p_port = value.parse()?,
        ["pool", "host"] => cfg.pool.host = value.into(),
        ["pool", "port"] => cfg.pool.port = value.parse()?,
        ["miner", "wallet"] => cfg.miner.wallet = value.into(),
        ["miner", "threads"] => cfg.miner.threads = value.into(),
        ["miner", "backend"] => cfg.miner.backend = value.into(),
        ["miner", "profile"] => cfg.miner.profile = value.into(),
        ["agent", "url"] => cfg.agent.url = value.into(),
        ["agent", "model"] => cfg.agent.model = value.into(),
        ["deploy", "ssh_key"] => cfg.deploy.ssh_key = value.into(),
        ["deploy", "ssh_user"] => cfg.deploy.ssh_user = value.into(),
        _ => anyhow::bail!("Unknown config key: {}", key),
    }
    save(&cfg)?;
    println!("✓ {} = {}", key, value);
    Ok(())
}

fn dirs_next() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

pub fn expand_path(p: &str) -> String {
    if p.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}{}", home, &p[1..]);
        }
    }
    p.to_string()
}
