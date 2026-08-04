//! ZION L1 miner binary — stratum v1 client for V31 pool.
//!
//! Connects to a zion-pool stratum endpoint, fetches block templates,
//! mines Ekam Deeksha PoW, and submits shares.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use clap::Parser;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
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

            // Mine with timeout — new jobs will interrupt after max 60s
            let mine_result = tokio::time::timeout(
                Duration::from_secs(60),
                mine_and_submit(&mut writer, &job_id, &header_hex, &target_hex, args),
            ).await;
            match mine_result {
                Ok(Ok(())) => info!("mining round complete for job {}", job_id),
                Ok(Err(e)) => return Err(e),
                Err(_) => info!("mining round timed out (60s), waiting for next job"),
            }
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

    // Parse target (32-byte hex, big-endian)
    let target_bytes = hex::decode(target_hex).unwrap_or_default();
    let mut target = [0u8; 32];
    if target_bytes.len() == 32 {
        target.copy_from_slice(&target_bytes);
    } else if !target_bytes.is_empty() {
        let len = target_bytes.len().min(32);
        target[..len].copy_from_slice(&target_bytes[..len]);
    }

    let header = Arc::new(header);
    let target = Arc::new(target);
    let job_id = job_id.to_string();
    let wallet_worker = format!("{}.{}", args.wallet, args.worker);

    // Channel: mining threads → async writer (found shares)
    let (share_tx, mut share_rx) = mpsc::unbounded_channel::<(u64, [u8; 32])>();

    // Stop flag — set when a new job arrives (checked by main loop)
    let stop = Arc::new(AtomicBool::new(false));
    let total_hashes = Arc::new(AtomicU64::new(0));
    let start = Instant::now();

    let num_threads = args.threads.max(1);
    info!("mining with {} thread(s), job={}", num_threads, job_id);

    // Spawn mining threads (sync, CPU-bound)
    let stop_clone = stop.clone();
    let header_clone = header.clone();
    let target_clone = target.clone();
    let total_hashes_clone = total_hashes.clone();
    let share_tx_clone = share_tx.clone();

    std::thread::spawn(move || {
        let deeksha = HeightAwareDeeksha::new();
        let chunk = 1_000_000u64 / num_threads as u64;
        std::thread::scope(|s| {
            for tid in 0..num_threads {
                let stop = stop_clone.clone();
                let header = header_clone.clone();
                let target = target_clone.clone();
                let total_hashes = total_hashes_clone.clone();
                let share_tx = share_tx_clone.clone();
                let deeksha = &deeksha;
                s.spawn(move || {
                    let base = tid as u64 * chunk;
                    let end = base + chunk;
                    let mut local_header = (*header).clone();
                    for nonce in base..end {
                        if stop.load(Ordering::Relaxed) {
                            return;
                        }
                        if local_header.len() >= 80 {
                            local_header[76..80].copy_from_slice(&(nonce as u32).to_le_bytes());
                        }
                        let hash = deeksha.hash(&local_header, nonce);
                        let hb: &[u8; 32] = hash.as_bytes();
                        total_hashes.fetch_add(1, Ordering::Relaxed);
                        if hb <= &*target {
                            let _ = share_tx.send((nonce, *hb));
                        }
                    }
                });
            }
        });
    });

    // Async: receive found shares and submit to pool
    let mut found = 0u64;
    let mut last_hr_log = Instant::now();

    loop {
        tokio::select! {
            Some((nonce, hash_bytes)) = share_rx.recv() => {
                let hash_hex = hex::encode(&hash_bytes);
                let submit = serde_json::json!({
                    "id": 100 + found,
                    "method": "mining.submit",
                    "params": [
                        &wallet_worker,
                        &job_id,
                        "00000000",
                        "00000000",
                        format!("{:08x}", nonce as u32)
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
            }
            _ = tokio::time::sleep(Duration::from_secs(10)), if last_hr_log.elapsed() >= Duration::from_secs(10) => {
                let hashes = total_hashes.load(Ordering::Relaxed);
                let elapsed = start.elapsed().as_secs_f64().max(0.1);
                let hr = hashes as f64 / elapsed;
                info!(
                    "mining... hashes={}, elapsed={:.0}s, hash_rate={:.0} H/s, shares={}",
                    hashes, elapsed, hr, found
                );
                last_hr_log = Instant::now();
            }
        }

        if stop.load(Ordering::Relaxed) {
            break;
        }
    }

    Ok(())
}
