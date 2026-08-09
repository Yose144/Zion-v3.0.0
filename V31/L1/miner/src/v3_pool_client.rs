//! V3 wire protocol pool client — connects to ZION pool using the native
//! V3 JSON-line protocol (not Stratum v1). Receives Job messages with
//! embedded external_stream (AuxPoW) jobs and submits shares back.
//!
//! This is the Trinity mining client: a single connection to the pool
//! carries all 3 streams (ZION + GPU AuxPoW + CPU AuxPoW).

use anyhow::{Context, Result};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, watch, Mutex};
use tracing::{debug, info, warn};

use crate::pool_message::{decode_message, encode_message, ExternalStreamJob, PoolMessage};

/// A ZION job received from the pool (Stream 1).
#[derive(Debug, Clone)]
pub struct V3ZionJob {
    pub job_id: u64,
    pub algorithm: String,
    pub start_nonce: u64,
    pub nonce_count: u64,
    pub target_hex: String,
    pub header_hex: String,
    pub height: u64,
    pub stream_weights: String,
}

/// A complete job from the pool — ZION + optional GPU/CPU AuxPoW streams.
#[derive(Debug, Clone)]
pub struct V3JobBundle {
    pub zion: V3ZionJob,
    pub gpu_external: Option<ExternalStreamJob>,
    pub cpu_external: Option<ExternalStreamJob>,
}

/// Result of a ZION share submission.
#[derive(Debug, Clone)]
pub struct V3ShareResult {
    pub accepted: bool,
    pub status: String,
    pub block_found: bool,
    pub block_height: Option<u64>,
}

/// Result of an AuxPoW share submission.
#[derive(Debug, Clone)]
pub struct V3ExternalResult {
    pub accepted: bool,
    pub status: String,
    pub coin: String,
}

/// V3 protocol pool client. Maintains a single TCP connection to the ZION
/// pool, receives Job messages, and submits ZION + AuxPoW shares.
pub struct V3PoolClient {
    pub pool_addr: String,
    pub miner_id: String,
    pub worker_name: String,
    pub algorithm: String,
    pub backend: String,
    pub payout_address: String,
    // Writer for sending messages to the pool
    writer: Arc<Mutex<tokio::io::WriteHalf<TcpStream>>>,
    // Receiver for job bundles (from the read loop)
    job_rx: Mutex<mpsc::Receiver<V3JobBundle>>,
    // Pending share result oneshots (keyed by a monotonic ID)
    // We use a simpler approach: the read loop dispatches Result/ExternalResult
    // to dedicated channels.
    zion_result_rx: Mutex<mpsc::Receiver<V3ShareResult>>,
    ext_result_rx: Mutex<mpsc::Receiver<V3ExternalResult>>,
    // Becomes true when the read loop detects the pool has closed the
    // connection.  Used to fail fast on subsequent submits.
    conn_closed: watch::Receiver<bool>,
}

impl V3PoolClient {
    fn ensure_connected(&self) -> Result<()> {
        if *self.conn_closed.borrow() {
            anyhow::bail!("V3 pool: connection closed");
        }
        Ok(())
    }
    /// Connect to the pool and perform the V3 handshake (Hello → Welcome).
    pub async fn connect(
        pool_addr: &str,
        miner_id: &str,
        worker_name: &str,
        algorithm: &str,
        backend: &str,
        payout_address: &str,
    ) -> Result<Self> {
        let stream = TcpStream::connect(pool_addr)
            .await
            .with_context(|| format!("V3 pool connect failed: {}", pool_addr))?;
        stream.set_nodelay(true).ok();

        let (reader, writer) = tokio::io::split(stream);
        let writer = Arc::new(Mutex::new(writer));

        // Send Hello
        let hello = PoolMessage::Hello {
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            algorithm: algorithm.to_string(),
            payout_address: payout_address.to_string(),
            backend: backend.to_string(),
        };
        let hello_line = encode_message(&hello)?;
        {
            let mut w = writer.lock().await;
            w.write_all(hello_line.as_bytes()).await?;
            w.flush().await?;
        }

        // Read Welcome
        let mut lines = BufReader::new(reader).lines();
        let first_line = lines
            .next_line()
            .await
            .context("V3 pool closed before Welcome")?
            .context("V3 pool: empty first line")?;
        match decode_message(&first_line)? {
            PoolMessage::Welcome {
                protocol_version,
                algorithm: welcome_algo,
                job_ttl_ms,
            } => {
                info!(
                    "V3 pool connected: protocol={} algo={} job_ttl={}ms",
                    protocol_version, welcome_algo, job_ttl_ms
                );
            }
            other => {
                anyhow::bail!("V3 pool: expected Welcome, got {:?}", other);
            }
        }

        // Channels for dispatching messages from the read loop
        let (job_tx, job_rx) = mpsc::channel::<V3JobBundle>(64);
        let (zion_result_tx, zion_result_rx) = mpsc::channel::<V3ShareResult>(16);
        let (ext_result_tx, ext_result_rx) = mpsc::channel::<V3ExternalResult>(16);

        // Watch channel to signal when the pool closes the connection.
        let (conn_closed_tx, conn_closed_rx) = watch::channel(false);

        // Spawn the read loop
        tokio::spawn(async move {
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        // Skip empty lines (pool may send blank lines between messages)
                        if line.trim().is_empty() {
                            continue;
                        }
                        match decode_message(&line) {
                            Ok(PoolMessage::Job {
                                job_id,
                                algorithm,
                                start_nonce,
                                nonce_count,
                                target_hex,
                                header_hex,
                                height,
                                stream_weights,
                                external_stream,
                                external_stream_cpu,
                            }) => {
                                debug!(
                                    "V3 job received: id={} height={} gpu_ext={} cpu_ext={}",
                                    job_id,
                                    height,
                                    external_stream.is_some(),
                                    external_stream_cpu.is_some()
                                );
                                let bundle = V3JobBundle {
                                    zion: V3ZionJob {
                                        job_id,
                                        algorithm,
                                        start_nonce,
                                        nonce_count,
                                        target_hex,
                                        header_hex,
                                        height,
                                        stream_weights,
                                    },
                                    gpu_external: external_stream,
                                    cpu_external: external_stream_cpu,
                                };
                                if job_tx.send(bundle).await.is_err() {
                                    warn!("V3 read loop: job channel closed, exiting");
                                    let _ = conn_closed_tx.send(true);
                                    break;
                                }
                            }
                            Ok(PoolMessage::SetDifficulty { difficulty, target_hex }) => {
                                debug!(
                                    "V3 set_difficulty: diff={} target={}",
                                    difficulty, target_hex
                                );
                                // Could forward to a difficulty channel if needed
                            }
                            Ok(PoolMessage::Result {
                                accepted,
                                status,
                                block_found,
                                block_height,
                            }) => {
                                let _ = zion_result_tx
                                    .send(V3ShareResult {
                                        accepted,
                                        status,
                                        block_found,
                                        block_height,
                                    })
                                    .await;
                            }
                            Ok(PoolMessage::ExternalResult {
                                accepted,
                                status,
                                coin,
                            }) => {
                                let _ = ext_result_tx
                                    .send(V3ExternalResult {
                                        accepted,
                                        status,
                                        coin,
                                    })
                                    .await;
                            }
                            Ok(PoolMessage::Cancel { job_id, reason }) => {
                                debug!("V3 cancel: job={} reason={}", job_id, reason);
                            }
                            Ok(PoolMessage::Stale { job_id }) => {
                                debug!("V3 stale: job={}", job_id);
                            }
                            Ok(PoolMessage::Bye {
                                accepted_shares,
                                rejected_shares,
                                revenue_total_usd,
                            }) => {
                                info!(
                                    "V3 bye: accepted={} rejected={} revenue={}",
                                    accepted_shares, rejected_shares, revenue_total_usd
                                );
                                let _ = conn_closed_tx.send(true);
                                break;
                            }
                            Ok(other) => {
                                debug!("V3 ignoring: {:?}", other);
                            }
                            Err(e) => {
                                warn!("V3 decode error: {} line={}", e, line);
                            }
                        }
                    }
                    Ok(None) => {
                        warn!("V3 pool: connection closed");
                        let _ = conn_closed_tx.send(true);
                        break;
                    }
                    Err(e) => {
                        warn!("V3 pool: read error: {}", e);
                        let _ = conn_closed_tx.send(true);
                        break;
                    }
                }
            }
        });

        Ok(Self {
            pool_addr: pool_addr.to_string(),
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            algorithm: algorithm.to_string(),
            backend: backend.to_string(),
            payout_address: payout_address.to_string(),
            writer,
            job_rx: Mutex::new(job_rx),
            zion_result_rx: Mutex::new(zion_result_rx),
            ext_result_rx: Mutex::new(ext_result_rx),
            conn_closed: conn_closed_rx,
        })
    }

    /// Wait for the next job bundle from the pool (ZION + AuxPoW streams).
    pub async fn next_job(&self, timeout: Duration) -> Result<V3JobBundle> {
        self.ensure_connected()?;
        let mut rx = self.job_rx.lock().await;
        match tokio::time::timeout(timeout, rx.recv()).await {
            Ok(Some(bundle)) => Ok(bundle),
            Ok(None) => anyhow::bail!("V3 pool: job channel closed"),
            Err(_) => anyhow::bail!("V3 pool: job timeout after {:?}", timeout),
        }
    }

    /// Non-blocking check for a new job. Returns `Some(bundle)` if a new job
    /// is available, `None` if no new job has arrived since the last call.
    pub async fn try_next_job(&self) -> Option<V3JobBundle> {
        let mut rx = self.job_rx.lock().await;
        rx.try_recv().ok()
    }

    /// Submit a ZION share to the pool.
    pub async fn submit_zion_share(
        &self,
        job_id: u64,
        nonce: u64,
        hash_hex: &str,
        mix_hash_hex: Option<&str>,
        attempted_hashes: u64,
        elapsed_ms: u64,
    ) -> Result<V3ShareResult> {
        self.ensure_connected()?;
        let msg = PoolMessage::Submit {
            job_id,
            miner_id: self.miner_id.clone(),
            worker_name: self.worker_name.clone(),
            nonce,
            hash_hex: hash_hex.to_string(),
            attempted_hashes: Some(attempted_hashes),
            elapsed_ms: Some(elapsed_ms),
            mix_hash_hex: mix_hash_hex.map(|s| s.to_string()),
        };
        let line = encode_message(&msg)?;
        {
            let mut w = self.writer.lock().await;
            w.write_all(line.as_bytes()).await?;
            w.flush().await?;
        }
        // Wait for Result
        let mut rx = self.zion_result_rx.lock().await;
        match tokio::time::timeout(Duration::from_secs(30), rx.recv()).await {
            Ok(Some(result)) => Ok(result),
            Ok(None) => anyhow::bail!("V3 pool: result channel closed"),
            Err(_) => anyhow::bail!("V3 pool: share result timeout"),
        }
    }

    /// Submit an AuxPoW (external) share to the pool for forwarding to the
    /// external pool (ZANO, VRSC, etc.).
    pub async fn submit_external_share(
        &self,
        coin: &str,
        algorithm: &str,
        external_job_id: &str,
        nonce: u64,
        hash_hex: &str,
        mix_hash_hex: Option<&str>,
        extranonce1_hex: &str,
        solution_hex: &str,
        ntime_hex: &str,
    ) -> Result<V3ExternalResult> {
        self.ensure_connected()?;
        let msg = PoolMessage::ExternalSubmit {
            miner_id: self.miner_id.clone(),
            worker_name: self.worker_name.clone(),
            coin: coin.to_string(),
            algorithm: algorithm.to_string(),
            external_job_id: external_job_id.to_string(),
            nonce,
            hash_hex: hash_hex.to_string(),
            mix_hash_hex: mix_hash_hex.map(|s| s.to_string()),
            extranonce1_hex: extranonce1_hex.to_string(),
            solution_hex: solution_hex.to_string(),
            ntime_hex: ntime_hex.to_string(),
        };
        let line = encode_message(&msg)?;
        {
            let mut w = self.writer.lock().await;
            w.write_all(line.as_bytes()).await?;
            w.flush().await?;
        }
        // Wait for ExternalResult
        let mut rx = self.ext_result_rx.lock().await;
        match tokio::time::timeout(Duration::from_secs(30), rx.recv()).await {
            Ok(Some(result)) => Ok(result),
            Ok(None) => anyhow::bail!("V3 pool: external result channel closed"),
            Err(_) => anyhow::bail!("V3 pool: external share result timeout"),
        }
    }

    /// Send a CoinPreference message (for autonomous profit routing).
    pub async fn send_coin_preference(
        &self,
        gpu_coin: &str,
        cpu_coin: &str,
        gpu_profit_usd_day: f64,
        cpu_profit_usd_day: f64,
    ) -> Result<()> {
        self.ensure_connected()?;
        let msg = PoolMessage::CoinPreference {
            miner_id: self.miner_id.clone(),
            gpu_coin: gpu_coin.to_string(),
            cpu_coin: cpu_coin.to_string(),
            gpu_profit_usd_day,
            cpu_profit_usd_day,
        };
        let line = encode_message(&msg)?;
        let mut w = self.writer.lock().await;
        w.write_all(line.as_bytes()).await?;
        w.flush().await?;
        Ok(())
    }

    /// Send a NoSolution message (job expired without finding a share).
    pub async fn send_no_solution(&self, job_id: u64) -> Result<()> {
        self.ensure_connected()?;
        let msg = PoolMessage::NoSolution {
            job_id,
            miner_id: self.miner_id.clone(),
            worker_name: self.worker_name.clone(),
            attempted_hashes: None,
            elapsed_ms: None,
        };
        let line = encode_message(&msg)?;
        let mut w = self.writer.lock().await;
        w.write_all(line.as_bytes()).await?;
        w.flush().await?;
        Ok(())
    }
}

impl std::fmt::Debug for V3PoolClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("V3PoolClient")
            .field("pool_addr", &self.pool_addr)
            .field("miner_id", &self.miner_id)
            .field("worker_name", &self.worker_name)
            .finish_non_exhaustive()
    }
}
