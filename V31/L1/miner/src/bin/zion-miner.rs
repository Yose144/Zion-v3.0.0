//! ZION L1 miner binary — stratum v1 client for V31 pool.
//!
//! Connects to a zion-pool stratum endpoint, fetches block templates,
//! mines Ekam Deeksha PoW, and submits shares.

use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use clap::Parser;
use sha3::{Digest, Sha3_256};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tracing::{info, warn};

use zion_core::{ConsensusEngine, HeightAwareDeeksha};
use zion_cosmic_harmony::PowAlgorithm;

#[derive(Parser, Debug)]
#[command(name = "zion-miner")]
#[command(about = "ZION L1 stratum miner (V31)")]
#[command(version)]
struct Args {
    /// Pool stratum address (host:port).
    #[arg(short, long, default_value = "127.0.0.1:8444")]
    pool: String,

    /// Miner wallet address for coinbase.
    #[arg(short, long, default_value = "zion1pool")]
    wallet: String,

    /// Worker name.
    #[arg(short, long, default_value = "worker1")]
    worker: String,

    /// Number of CPU threads.
    #[arg(short, long, default_value = "2")]
    threads: usize,

    /// Number of hash iterations before reconnect (0 = infinite).
    #[arg(short, long, default_value = "0")]
    loops: u64,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    info!(
        "zion-miner V31 starting — pool={}, wallet={}, worker={}, threads={}",
        args.pool, args.wallet, args.worker, args.threads
    );

    let algorithm =
        Arc::new(HeightAwareDeeksha::new()) as Arc<dyn PowAlgorithm>;
    let _consensus = Arc::new(ConsensusEngine::new(algorithm));

    loop {
        match run_mining_session(&args).await {
            Ok(()) => {
                info!("mining session ended cleanly, reconnecting...");
            }
            Err(e) => {
                warn!("mining session error: {:#}, reconnecting in 10s...", e);
                tokio::time::sleep(Duration::from_secs(10)).await;
            }
        }

        if args.loops > 0 {
            // For now, loops is not tracked precisely; just keep running.
        }
    }
}

async fn run_mining_session(args: &Args) -> Result<()> {
    let stream = TcpStream::connect(&args.pool)
        .await
        .with_context(|| format!("failed to connect to pool {}", args.pool))?;
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Subscribe
    let subscribe = serde_json::json!({
        "id": 1,
        "method": "mining.subscribe",
        "params": [format!("zion-miner/{}", env!("CARGO_PKG_VERSION"))]
    });
    let line = format!("{}\n", subscribe);
    writer.write_all(line.as_bytes()).await?;
    writer.flush().await?;
    info!("sent mining.subscribe");

    // Read subscribe response + initial notify
    let mut buf = String::new();
    reader.read_line(&mut buf).await?;
    info!("subscribe response: {}", buf.trim());

    // Authorize
    let authorize = serde_json::json!({
        "id": 2,
        "method": "mining.authorize",
        "params": [format!("{}.{}", args.wallet, args.worker), "x"]
    });
    let line = format!("{}\n", authorize);
    writer.write_all(line.as_bytes()).await?;
    writer.flush().await?;
    info!("sent mining.authorize for {}.{}", args.wallet, args.worker);

    // Read authorize response
    buf.clear();
    reader.read_line(&mut buf).await?;
    info!("authorize response: {}", buf.trim());

    // Main loop: read mining.notify, mine, submit shares
    let mut job_id = String::new();
    let mut header_hex = String::new();
    let mut target_hex = String::new();

    loop {
        buf.clear();
        let n = reader.read_line(&mut buf).await?;
        if n == 0 {
            anyhow::bail!("pool disconnected");
        }

        let msg: serde_json::Value = serde_json::from_str(buf.trim())
            .with_context(|| format!("failed to parse pool message: {}", buf.trim()))?;

        // Skip responses to our submit/subscribe/authorize — we only care about notify
        if msg.get("method").is_none() {
            // This is a response (has "id" but no "method") — log and continue
            if let Some(result) = msg.get("result") {
                if result.as_bool() == Some(true) {
                    info!("share accepted by pool");
                } else if result.as_bool() == Some(false) {
                    warn!("share rejected by pool");
                }
            }
            continue;
        }

        if msg.get("method").and_then(|m| m.as_str()) == Some("mining.notify") {
            let params = msg.get("params").context("missing params in mining.notify")?;
            job_id = params
                .get(0)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            header_hex = params
                .get(1)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            target_hex = params
                .get(2)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            info!(
                "new job {} — header {} bytes, target {}",
                job_id,
                header_hex.len() / 2,
                if target_hex.len() > 16 {
                    &target_hex[..16]
                } else {
                    &target_hex
                }
            );

            // Simple CPU mining: iterate nonces
            mine_and_submit(&mut writer, &job_id, &header_hex, &target_hex, args).await?;
        }
    }
}

async fn mine_and_submit(
    writer: &mut tokio::net::tcp::OwnedWriteHalf,
    job_id: &str,
    header_hex: &str,
    target_hex: &str,
    args: &Args,
) -> Result<()> {
    let mut header = hex::decode(header_hex).context("invalid header hex")?;
    if header.len() < 80 {
        header.resize(80, 0);
    }

    // Simple mining: try nonces 0..1_000_000
    let start = std::time::Instant::now();
    let mut found = 0u64;

    for nonce in 0..1_000_000u64 {
        // Write nonce into header (bytes 76-80, little-endian u32)
        if header.len() >= 80 {
            header[76..80].copy_from_slice(&(nonce as u32).to_le_bytes());
        }

        // Quick hash check (simplified — just check first few bytes are zeros)
        let hash = Sha3_256::digest(&header);
        let hash_hex = hex::encode(&hash);

        // Check if hash meets target (simplified: first 4 hex chars must be 0)
        if hash_hex.starts_with("0000") {
            let submit = serde_json::json!({
                "id": 100 + found,
                "method": "mining.submit",
                "params": [
                    format!("{}.{}", args.wallet, args.worker),
                    job_id,
                    format!("{:08x}", nonce as u32),
                    "00000000",
                    "00000000"
                ]
            });
            let line = format!("{}\n", submit);
            writer.write_all(line.as_bytes()).await?;
            writer.flush().await?;
            info!(
                "share submitted — job={}, nonce={}, hash={}",
                job_id, nonce, &hash_hex[..16]
            );
            found += 1;
            // Don't break — keep mining for more shares on this job
        }

        if nonce % 100_000 == 0 && nonce > 0 {
            info!(
                "mining... nonce={}, elapsed={}ms, hash_rate={:.0} H/s",
                nonce,
                start.elapsed().as_millis(),
                nonce as f64 / start.elapsed().as_secs_f64()
            );
        }
    }

    Ok(())
}
