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
    pub hiran: Option<HiranConfig>,
    #[serde(default)]
    pub deploy: DeployConfig,
    #[serde(default)]
    pub bridge: BridgeConfig,
    #[serde(default)]
    pub dao: DaoConfig,
    #[serde(default)]
    pub swap: SwapConfig,
    #[serde(default)]
    pub atomic_swap: AtomicSwapConfig,
    #[serde(default)]
    pub cli: CliConfig,
    #[serde(default)]
    pub topology: TopologyConfig,
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
    pub websocket_port: Option<u16>,
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
    #[serde(default = "default_algorithm")]
    pub algorithm: String,
}

fn default_algorithm() -> String {
    "deeksha_lite_v1".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub url: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiranConfig {
    pub model_path: String,
    pub backend: String,
    pub device: String,
    pub port: u16,
    pub max_context: usize,
    pub temperature: f32,
    pub top_p: f32,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapConfig {
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicSwapConfig {
    pub port: u16,
}

/// Host configuration for a single node in the core+edge topology.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyHostConfig {
    pub rpc_host: String,
    pub rpc_port: u16,
    pub p2p_port: u16,
    pub pool_host: String,
    pub pool_port: u16,
    pub vpn_ip: Option<String>,
}

/// Overall topology configuration (core + edge).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyConfig {
    #[serde(default)]
    pub core: TopologyHostConfig,
    #[serde(default)]
    pub edge: TopologyHostConfig,
}

impl Default for NodeConfig {
    fn default() -> Self {
        Self {
            rpc_host: "127.0.0.1".into(),
            rpc_port: 8443,
            p2p_port: 8333,
            websocket_port: Some(8445),
        }
    }
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            host: "77.42.71.94".into(),
            port: 8444,
        }
    }
}

impl Default for TopologyHostConfig {
    fn default() -> Self {
        Self {
            rpc_host: "127.0.0.1".into(),
            rpc_port: 8443,
            p2p_port: 8333,
            pool_host: "127.0.0.1".into(),
            pool_port: 8444,
            vpn_ip: None,
        }
    }
}

impl Default for TopologyConfig {
    fn default() -> Self {
        Self {
            core: TopologyHostConfig {
                rpc_host: "127.0.0.1".into(),
                rpc_port: 8443,
                p2p_port: 8333,
                pool_host: "127.0.0.1".into(),
                pool_port: 8444,
                vpn_ip: Some("100.86.102.5".into()),
            },
            edge: TopologyHostConfig {
                rpc_host: "100.76.16.108".into(),
                rpc_port: 8443,
                p2p_port: 8333,
                pool_host: "77.42.71.94".into(),
                pool_port: 8444,
                vpn_ip: Some("100.76.16.108".into()),
            },
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
            algorithm: default_algorithm(),
        }
    }
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            url: "http://127.0.0.1:8002".into(),
            model: "hiranyagarbha-v2.2".into(),
        }
    }
}

impl Default for HiranConfig {
    fn default() -> Self {
        Self {
            model_path: "/models/hiran-v2.2-q5_k_m.gguf".into(),
            backend: "llama_cpp".into(),
            device: "cuda".into(),
            port: 8002,
            max_context: 4096,
            temperature: 0.7,
            top_p: 0.9,
        }
    }
}

impl Default for DeployConfig {
    fn default() -> Self {
        Self {
            default_server: "edge".into(),
            ssh_key: "~/.ssh/ssh-key-zion-edge".into(),
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

impl Default for SwapConfig {
    fn default() -> Self {
        Self { port: 8889 }
    }
}

impl Default for AtomicSwapConfig {
    fn default() -> Self {
        Self { port: 8452 }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            node: NodeConfig::default(),
            pool: PoolConfig::default(),
            miner: MinerConfig::default(),
            agent: AgentConfig::default(),
            hiran: Some(HiranConfig::default()),
            deploy: DeployConfig::default(),
            bridge: BridgeConfig::default(),
            dao: DaoConfig::default(),
            swap: SwapConfig::default(),
            atomic_swap: AtomicSwapConfig::default(),
            cli: CliConfig::default(),
            topology: TopologyConfig::default(),
        }
    }
}

impl Config {
    /// Resolve the active RPC endpoint for the core node.
    pub fn core_rpc(&self) -> (&str, u16) {
        (&self.topology.core.rpc_host, self.topology.core.rpc_port)
    }

    /// Resolve the active RPC endpoint for the edge node.
    pub fn edge_rpc(&self) -> (&str, u16) {
        (&self.topology.edge.rpc_host, self.topology.edge.rpc_port)
    }

    /// Resolve the active pool endpoint for the core node.
    pub fn core_pool(&self) -> (&str, u16) {
        (&self.topology.core.pool_host, self.topology.core.pool_port)
    }

    /// Resolve the active pool endpoint for the edge node.
    pub fn edge_pool(&self) -> (&str, u16) {
        (&self.topology.edge.pool_host, self.topology.edge.pool_port)
    }

    /// Pick the appropriate RPC endpoint based on a target name.
    /// Recognised targets: `core`, `edge`, `local` (alias for core), `vpn` (alias for edge).
    pub fn target_rpc<'a>(&'a self, target: &'a str) -> (&'a str, u16) {
        match target.trim().to_ascii_lowercase().as_str() {
            "edge" | "vpn" | "relay" => self.edge_rpc(),
            "core" | "local" | "master" => self.core_rpc(),
            _ => {
                // Fallback: if target looks like host:port, use it directly
                if target.contains(':') {
                    let parts: Vec<&'a str> = target.splitn(2, ':').collect();
                    if let Ok(port) = parts[1].parse() {
                        return (parts[0], port);
                    }
                }
                self.core_rpc()
            }
        }
    }

    /// Pick the appropriate pool endpoint based on a target name.
    pub fn target_pool<'a>(&'a self, target: &'a str) -> (&'a str, u16) {
        match target.trim().to_ascii_lowercase().as_str() {
            "edge" | "vpn" | "relay" => self.edge_pool(),
            "core" | "local" | "master" => self.core_pool(),
            _ => {
                if target.contains(':') {
                    let parts: Vec<&'a str> = target.splitn(2, ':').collect();
                    if let Ok(port) = parts[1].parse() {
                        return (parts[0], port);
                    }
                }
                self.edge_pool()
            }
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
        ["node", "websocket_port"] => cfg.node.websocket_port = Some(value.parse()?),
        ["pool", "host"] => cfg.pool.host = value.into(),
        ["pool", "port"] => cfg.pool.port = value.parse()?,
        ["miner", "wallet"] => cfg.miner.wallet = value.into(),
        ["miner", "btc_wallet"] => cfg.miner.btc_wallet = value.into(),
        ["miner", "threads"] => cfg.miner.threads = value.into(),
        ["miner", "backend"] => cfg.miner.backend = value.into(),
        ["miner", "profile"] => cfg.miner.profile = value.into(),
        ["miner", "algorithm"] => cfg.miner.algorithm = value.into(),
        ["agent", "url"] => cfg.agent.url = value.into(),
        ["agent", "model"] => cfg.agent.model = value.into(),
        ["hiran", "model_path"] => {
            if cfg.hiran.is_none() {
                cfg.hiran = Some(HiranConfig::default());
            }
            cfg.hiran.as_mut().unwrap().model_path = value.into();
        }
        ["hiran", "backend"] => {
            if cfg.hiran.is_none() {
                cfg.hiran = Some(HiranConfig::default());
            }
            cfg.hiran.as_mut().unwrap().backend = value.into();
        }
        ["hiran", "device"] => {
            if cfg.hiran.is_none() {
                cfg.hiran = Some(HiranConfig::default());
            }
            cfg.hiran.as_mut().unwrap().device = value.into();
        }
        ["hiran", "port"] => {
            if cfg.hiran.is_none() {
                cfg.hiran = Some(HiranConfig::default());
            }
            cfg.hiran.as_mut().unwrap().port = value.parse()?;
        }
        ["hiran", "max_context"] => {
            if cfg.hiran.is_none() {
                cfg.hiran = Some(HiranConfig::default());
            }
            cfg.hiran.as_mut().unwrap().max_context = value.parse()?;
        }
        ["hiran", "temperature"] => {
            if cfg.hiran.is_none() {
                cfg.hiran = Some(HiranConfig::default());
            }
            cfg.hiran.as_mut().unwrap().temperature = value.parse()?;
        }
        ["hiran", "top_p"] => {
            if cfg.hiran.is_none() {
                cfg.hiran = Some(HiranConfig::default());
            }
            cfg.hiran.as_mut().unwrap().top_p = value.parse()?;
        }
        ["deploy", "default_server"] => cfg.deploy.default_server = value.into(),
        ["deploy", "ssh_key"] => cfg.deploy.ssh_key = value.into(),
        ["deploy", "ssh_user"] => cfg.deploy.ssh_user = value.into(),
        ["bridge", "port"] => cfg.bridge.port = value.parse()?,
        ["dao", "port"] => cfg.dao.port = value.parse()?,
        ["cli", "auto_update_check"] => cfg.cli.auto_update_check = value.parse()?,
        // topology.core.*
        ["topology.core", "rpc_host"] => cfg.topology.core.rpc_host = value.into(),
        ["topology.core", "rpc_port"] => cfg.topology.core.rpc_port = value.parse()?,
        ["topology.core", "p2p_port"] => cfg.topology.core.p2p_port = value.parse()?,
        ["topology.core", "pool_host"] => cfg.topology.core.pool_host = value.into(),
        ["topology.core", "pool_port"] => cfg.topology.core.pool_port = value.parse()?,
        ["topology.core", "vpn_ip"] => cfg.topology.core.vpn_ip = Some(value.into()),
        // topology.edge.*
        ["topology.edge", "rpc_host"] => cfg.topology.edge.rpc_host = value.into(),
        ["topology.edge", "rpc_port"] => cfg.topology.edge.rpc_port = value.parse()?,
        ["topology.edge", "p2p_port"] => cfg.topology.edge.p2p_port = value.parse()?,
        ["topology.edge", "pool_host"] => cfg.topology.edge.pool_host = value.into(),
        ["topology.edge", "pool_port"] => cfg.topology.edge.pool_port = value.parse()?,
        ["topology.edge", "vpn_ip"] => cfg.topology.edge.vpn_ip = Some(value.into()),
        _ => anyhow::bail!("Unknown config key: {}. Valid keys: node.rpc_host, node.rpc_port, node.p2p_port, node.websocket_port, pool.host, pool.port, miner.wallet, miner.btc_wallet, miner.threads, miner.backend, miner.profile, miner.algorithm, agent.url, agent.model, hiran.model_path, hiran.backend, hiran.device, hiran.port, hiran.max_context, hiran.temperature, hiran.top_p, deploy.ssh_key, deploy.ssh_user, deploy.default_server, bridge.port, dao.port, cli.auto_update_check, topology.core.rpc_host, topology.core.rpc_port, topology.core.p2p_port, topology.core.pool_host, topology.core.pool_port, topology.core.vpn_ip, topology.edge.rpc_host, topology.edge.rpc_port, topology.edge.p2p_port, topology.edge.pool_host, topology.edge.pool_port, topology.edge.vpn_ip", key),
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

    // Validate topology config
    if cfg.topology.core.rpc_host.trim().is_empty() {
        errors.push("topology.core.rpc_host must not be empty".to_string());
    }
    if cfg.topology.core.rpc_port == 0 {
        errors.push("topology.core.rpc_port must be greater than 0".to_string());
    }
    if cfg.topology.edge.rpc_host.trim().is_empty() {
        errors.push("topology.edge.rpc_host must not be empty".to_string());
    }
    if cfg.topology.edge.rpc_port == 0 {
        errors.push("topology.edge.rpc_port must be greater than 0".to_string());
    }
    if cfg.topology.edge.pool_host.trim().is_empty() {
        errors.push("topology.edge.pool_host must not be empty".to_string());
    }
    if cfg.topology.edge.pool_port == 0 {
        errors.push("topology.edge.pool_port must be greater than 0".to_string());
    }
    if cfg.topology.core.vpn_ip.as_ref().map(|s| s.trim().is_empty()).unwrap_or(false) {
        warnings.push("topology.core.vpn_ip is empty".to_string());
    }
    if cfg.topology.edge.vpn_ip.as_ref().map(|s| s.trim().is_empty()).unwrap_or(false) {
        warnings.push("topology.edge.vpn_ip is empty".to_string());
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

    match cfg.miner.algorithm.trim().to_ascii_lowercase().as_str() {
        "deeksha_lite_v1" | "lite" | "dl" | "dlv1"
        | "deeksha_lite_fire" | "fire" | "dlfire"
        | "cosmic_harmony_ekam_deeksha_v2" | "ekam" | "ekam_v2" | "full" => {}
        other => errors.push(format!(
            "miner.algorithm has unsupported value '{}'. Supported: deeksha_lite_v1, deeksha_lite_fire, cosmic_harmony_ekam_deeksha_v2",
            other
        )),
    }

    if cfg.agent.url.trim().is_empty() {
        errors.push("agent.url must not be empty".to_string());
    } else if !cfg.agent.url.starts_with("http://") && !cfg.agent.url.starts_with("https://") {
        errors.push("agent.url must start with http:// or https://".to_string());
    }

    // Validate hiran config if present
    if let Some(ref hiran_cfg) = cfg.hiran {
        if hiran_cfg.model_path.trim().is_empty() {
            errors.push("hiran.model_path must not be empty".to_string());
        }
        match hiran_cfg.backend.trim().to_ascii_lowercase().as_str() {
            "llama_cpp" | "onnx" | "tensorrt" => {}
            other => errors.push(format!(
                "hiran.backend has unsupported value '{}'. Supported: llama_cpp, onnx, tensorrt",
                other
            )),
        }
        match hiran_cfg.device.trim().to_ascii_lowercase().as_str() {
            "cuda" | "cpu" | "auto" => {}
            other => errors.push(format!(
                "hiran.device has unsupported value '{}'. Supported: cuda, cpu, auto",
                other
            )),
        }
        if hiran_cfg.port == 0 {
            errors.push("hiran.port must be greater than 0".to_string());
        }
        if hiran_cfg.max_context == 0 {
            errors.push("hiran.max_context must be greater than 0".to_string());
        }
        if !(0.0..=2.0).contains(&hiran_cfg.temperature) {
            errors.push("hiran.temperature must be between 0.0 and 2.0".to_string());
        }
        if !(0.0..=1.0).contains(&hiran_cfg.top_p) {
            errors.push("hiran.top_p must be between 0.0 and 1.0".to_string());
        }
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
