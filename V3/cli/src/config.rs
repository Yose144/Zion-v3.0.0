use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub struct ValidationReport {
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ValidationReport {
    pub fn is_ok(&self) -> bool {
        self.errors.is_empty()
    }
}

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
    #[serde(default)]
    pub bridge: BridgeConfig,
    #[serde(default)]
    pub dao: DaoConfig,
    #[serde(default)]
    pub cli: CliConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliConfig {
    #[serde(default = "default_true")]
    pub auto_update_check: bool,
}

fn default_true() -> bool {
    true
}

impl Default for CliConfig {
    fn default() -> Self {
        Self {
            auto_update_check: true,
        }
    }
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
    pub btc_wallet: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeConfig {
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaoConfig {
    pub port: u16,
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
            btc_wallet: String::new(),
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

impl Default for BridgeConfig {
    fn default() -> Self {
        Self { port: 8888 }
    }
}

impl Default for DaoConfig {
    fn default() -> Self {
        Self { port: 8081 }
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
            bridge: BridgeConfig::default(),
            dao: DaoConfig::default(),
            cli: CliConfig::default(),
        }
    }
}

pub fn config_path() -> Result<PathBuf> {
    let home = dirs_next().context("Cannot determine home directory")?;
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
    let cfg: Config =
        toml::from_str(&text).with_context(|| format!("Invalid config: {}", path.display()))?;
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
        ["miner", "btc_wallet"] => cfg.miner.btc_wallet = value.into(),
        ["miner", "threads"] => cfg.miner.threads = value.into(),
        ["miner", "backend"] => cfg.miner.backend = value.into(),
        ["miner", "profile"] => cfg.miner.profile = value.into(),
        ["agent", "url"] => cfg.agent.url = value.into(),
        ["agent", "model"] => cfg.agent.model = value.into(),
        ["deploy", "default_server"] => cfg.deploy.default_server = value.into(),
        ["deploy", "ssh_key"] => cfg.deploy.ssh_key = value.into(),
        ["deploy", "ssh_user"] => cfg.deploy.ssh_user = value.into(),
        ["bridge", "port"] => cfg.bridge.port = value.parse()?,
        ["dao", "port"] => cfg.dao.port = value.parse()?,
        ["cli", "auto_update_check"] => cfg.cli.auto_update_check = value.parse()?,
        _ => anyhow::bail!("Unknown config key: {}. Valid keys: node.rpc_host, node.rpc_port, node.p2p_port, pool.host, pool.port, miner.wallet, miner.btc_wallet, miner.threads, miner.backend, miner.profile, agent.url, agent.model, deploy.ssh_key, deploy.ssh_user, deploy.default_server, bridge.port, dao.port, cli.auto_update_check", key),
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

pub fn validate(cfg: &Config) -> ValidationReport {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if cfg.node.rpc_host.trim().is_empty() {
        errors.push("node.rpc_host must not be empty".to_string());
    }
    if cfg.node.rpc_port == 0 {
        errors.push("node.rpc_port must be greater than 0".to_string());
    }
    if cfg.node.p2p_port == 0 {
        errors.push("node.p2p_port must be greater than 0".to_string());
    }
    if cfg.pool.host.trim().is_empty() {
        errors.push("pool.host must not be empty".to_string());
    }
    if cfg.pool.port == 0 {
        errors.push("pool.port must be greater than 0".to_string());
    }

    match cfg.miner.backend.trim().to_ascii_lowercase().as_str() {
        "auto" | "cpu" | "gpu" | "metal" | "opencl" | "ocl" | "cuda" => {}
        other => errors.push(format!(
            "miner.backend has unsupported value '{}'. Supported: auto, cpu, gpu, metal, opencl, cuda",
            other
        )),
    }

    match cfg.miner.profile.trim().to_ascii_lowercase().as_str() {
        "pool" | "solo" | "benchmark" | "bench" | "dual" => {}
        other => errors.push(format!(
            "miner.profile has unsupported value '{}'. Supported: pool, solo, benchmark, dual",
            other
        )),
    }

    if cfg.agent.url.trim().is_empty() {
        errors.push("agent.url must not be empty".to_string());
    } else if !cfg.agent.url.starts_with("http://") && !cfg.agent.url.starts_with("https://") {
        errors.push("agent.url must start with http:// or https://".to_string());
    }

    let ssh_key = expand_path(&cfg.deploy.ssh_key);
    if ssh_key.trim().is_empty() {
        errors.push("deploy.ssh_key must not be empty".to_string());
    } else if !std::path::Path::new(&ssh_key).exists() {
        warnings.push(format!(
            "deploy.ssh_key does not exist on disk: {}",
            ssh_key
        ));
    }

    if cfg.deploy.ssh_user.trim().is_empty() {
        errors.push("deploy.ssh_user must not be empty".to_string());
    }

    if cfg.miner.profile.trim().eq_ignore_ascii_case("dual")
        && cfg.miner.btc_wallet.trim().is_empty()
    {
        warnings.push("miner.profile is dual but miner.btc_wallet is empty; DCR sidecar will rely on env or fallback BTC payout wallet".to_string());
    }

    ValidationReport { errors, warnings }
}
