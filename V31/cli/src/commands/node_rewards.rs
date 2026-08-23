use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, bail, Context};
use clap::Parser;
use ed25519_dalek::{Signer, SigningKey};
use rand::RngCore;

/// Register a full node for node rewards.
#[derive(Parser)]
pub struct RegisterArgs {
    /// Multi-Chain HTTP endpoint (public site or local `warpd`).
    #[arg(short, long, default_value = "http://127.0.0.1:8454")]
    multichain_url: String,
    /// ZIS user id that owns this node.
    #[arg(short, long)]
    user_id: String,
    /// `zion1...` address that receives payouts. Defaults to the address
    /// derived from the node key.
    #[arg(short, long)]
    reward_address: Option<String>,
    /// Optional p2p bind host advertised to the reward service.
    #[arg(long)]
    bind_host: Option<String>,
    /// Optional p2p bind port advertised to the reward service.
    #[arg(long)]
    bind_port: Option<u16>,
    /// ZIS session cookie. Used to authenticate the register request.
    #[arg(long)]
    zis_session: Option<String>,
    /// ZIS API key (`zis_...`). Alternative to `--zis-session`.
    #[arg(long)]
    zis_api_key: Option<String>,
    /// Ed25519 private key as 64-char hex, or a path to a file containing it.
    /// If omitted, the key is loaded from `--key-file` or generated.
    #[arg(short = 'k', long)]
    node_key: Option<String>,
    /// File used to load/save the node private key.
    #[arg(long, default_value = "~/.zion/node-reward.key")]
    key_file: String,
}

/// Send a signed heartbeat for a registered full node.
#[derive(Parser)]
pub struct HeartbeatArgs {
    /// Multi-Chain HTTP endpoint.
    #[arg(short, long, default_value = "http://127.0.0.1:8454")]
    multichain_url: String,
    /// Ed25519 private key as 64-char hex or a path to a file containing it.
    #[arg(short = 'k', long)]
    node_key: Option<String>,
    /// File used to load/save the node private key.
    #[arg(long, default_value = "~/.zion/node-reward.key")]
    key_file: String,
    /// Current chain height observed by the node.
    #[arg(long)]
    height: u64,
    /// Number of connected peers.
    #[arg(long, default_value_t = 0)]
    peer_count: u64,
    /// Observed bandwidth metric (bytes/sec).
    #[arg(long, default_value_t = 0)]
    bandwidth: u64,
    /// Observed latency in milliseconds.
    #[arg(long, default_value_t = 0)]
    latency_ms: u64,
}

fn expand_tilde(p: &str) -> PathBuf {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(p)
}

fn load_or_generate_node_key(node_key: Option<String>, key_file: &str) -> anyhow::Result<SigningKey> {
    let key_hex = if let Some(k) = node_key {
        if k.len() == 64 && k.chars().all(|c| c.is_ascii_hexdigit()) {
            k
        } else if std::fs::metadata(&k).is_ok() {
            std::fs::read_to_string(&k)
                .with_context(|| format!("failed to read node key file {k}"))?
                .trim()
                .to_string()
        } else {
            bail!("--node-key must be a 64-char hex string or an existing file path");
        }
    } else {
        let path = expand_tilde(key_file);
        if path.exists() {
            std::fs::read_to_string(&path)
                .with_context(|| format!("failed to read node key file {}", path.display()))?
                .trim()
                .to_string()
        } else {
            let mut seed = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut seed);
            let key = hex::encode(seed);
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&path, &key)
                .with_context(|| format!("failed to write node key file {}", path.display()))?;
            eprintln!("Generated new node reward key: {}", path.display());
            key
        }
    };

    let bytes = hex::decode(key_hex.trim())
        .with_context(|| "node key is not valid hex")?;
    let arr: [u8; 32] = bytes
        .try_into()
        .map_err(|_| anyhow!("node key must be 32 bytes"))?;
    Ok(SigningKey::from_bytes(&arr))
}

fn node_address(signing_key: &SigningKey) -> String {
    zion_core::crypto::derive_address(&signing_key.verifying_key().to_bytes())
}

fn node_id(signing_key: &SigningKey) -> String {
    hex::encode(signing_key.verifying_key().to_bytes())
}

fn observed_at() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

async fn post_json(
    url: &str,
    body: serde_json::Value,
    auth: Option<&str>,
) -> anyhow::Result<serde_json::Value> {
    let client = reqwest::Client::new();
    let mut req = client.post(url).json(&body);
    if let Some(a) = auth {
        if a.starts_with("zion_session=") {
            req = req.header("cookie", a);
        } else {
            req = req.header("authorization", a);
        }
    }
    let resp = req.send().await.with_context(|| format!("HTTP POST to {url}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        bail!("request failed ({}): {}", status, text);
    }
    serde_json::from_str(&text)
        .with_context(|| format!("invalid JSON response: {text}"))
}

fn auth_header(args: &RegisterArgs) -> Option<String> {
    if let Some(api_key) = &args.zis_api_key {
        Some(format!("Bearer {api_key}"))
    } else if let Some(session) = &args.zis_session {
        Some(format!("zion_session={session}"))
    } else {
        None
    }
}

pub async fn run_register(args: RegisterArgs) -> anyhow::Result<()> {
    let signing_key = load_or_generate_node_key(args.node_key.clone(), &args.key_file)?;
    let node_id = node_id(&signing_key);
    let reward = args
        .reward_address
        .clone()
        .unwrap_or_else(|| node_address(&signing_key));
    let host = args.bind_host.clone().unwrap_or_default();
    let port = args.bind_port.unwrap_or(0);
    let user_id = args.user_id.clone();

    let payload = format!("{node_id}:{reward}:{user_id}:{host}:{port}");
    let signature = hex::encode(signing_key.sign(payload.as_bytes()).to_bytes());

    let body = serde_json::json!({
        "node_id": node_id,
        "user_id": user_id,
        "reward_address": reward,
        "bind_host": host,
        "bind_port": port,
        "signature": signature,
    });

    let url = format!("{}/v1/nodes/register", args.multichain_url.trim_end_matches('/'));
    let auth = auth_header(&args);
    let resp = post_json(&url, body, auth.as_deref()).await?;
    println!("{}", serde_json::to_string_pretty(&resp)?);
    Ok(())
}

pub async fn run_heartbeat(args: HeartbeatArgs) -> anyhow::Result<()> {
    let signing_key = load_or_generate_node_key(args.node_key, &args.key_file)?;
    let node_id = node_id(&signing_key);
    let ts = observed_at();

    let payload = format!(
        "{node_id}:{}:{}:{}:{}:{ts}",
        args.height, args.peer_count, args.bandwidth, args.latency_ms
    );
    let signature = hex::encode(signing_key.sign(payload.as_bytes()).to_bytes());

    let body = serde_json::json!({
        "node_id": node_id,
        "height": args.height,
        "peer_count": args.peer_count,
        "bandwidth": args.bandwidth,
        "latency_ms": args.latency_ms,
        "observed_at": ts,
        "signature": signature,
    });

    let url = format!("{}/v1/nodes/heartbeat", args.multichain_url.trim_end_matches('/'));
    let resp = post_json(&url, body, None).await?;
    println!("{}", serde_json::to_string_pretty(&resp)?);
    Ok(())
}
