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

use crate::ext_warn;
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
    /// When the read loop received this job. Used to bound share
    /// submission to the advertised job TTL — the pool keeps recent
    /// jobs around, so a superseded job_id is still accepted.
    pub received_at: std::time::Instant,
}

/// A complete job from the pool — ZION + optional GPU/CPU AuxPoW streams.
#[derive(Debug, Clone)]
pub struct V3JobBundle {
    pub zion: V3ZionJob,
    pub gpu_external: Option<ExternalStreamJob>,
    pub cpu_external: Option<ExternalStreamJob>,
    /// Second GPU external stream (Quad mode). None on pools that don't
    /// emit `external_stream_2`, or when the embedded stream-1 coin
    /// collided with the configured gpu2 preference.
    pub gpu_external_2: Option<ExternalStreamJob>,
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
    // Job bundles are published by the read loop into a watch channel.
    // `send_replace` never blocks, so a stalled mining stream can neither
    // wedge the read loop on a full queue nor starve the other streams of
    // fresh jobs. `next_job`/`try_next_job` share this receiver; external
    // streams subscribe via `subscribe_jobs()`.
    job_rx: Mutex<watch::Receiver<Option<V3JobBundle>>>,
    job_tx: watch::Sender<Option<V3JobBundle>>,
    // Pending share result oneshots (keyed by a monotonic ID)
    // We use a simpler approach: the read loop dispatches Result/ExternalResult
    // to dedicated channels.
    zion_result_rx: Mutex<mpsc::Receiver<V3ShareResult>>,
    // Per-coin external result channels, keyed by uppercase coin ticker.
    // A dedicated channel per coin prevents cross-coin result mismatch
    // when two GPU streams (e.g. QTU + ZANO) submit concurrently.
    // Senders are shared with the read loop; receivers are created lazily
    // on first submit for a coin and held per-coin so concurrent submits
    // for the SAME coin serialize on the receiver mutex.
    ext_result_senders:
        std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, mpsc::Sender<V3ExternalResult>>>>,
    ext_result_receivers: Mutex<
        std::collections::HashMap<String, std::sync::Arc<Mutex<mpsc::Receiver<V3ExternalResult>>>>,
    >,
    // Becomes true when the read loop detects the pool has closed the
    // connection.  Used to fail fast on subsequent submits.
    conn_closed: watch::Receiver<bool>,
    // Latest ZION job_id pushed by the pool.  The pool drops superseded jobs,
    // so a share mined for an older job_id is guaranteed `unknown_job`.
    latest_zion_job_id: std::sync::Arc<std::sync::atomic::AtomicU64>,
}

/// Max time a single write to the pool socket may take. Without a bound, a
/// stalled TCP send direction wedges the shared writer mutex and freezes
/// every stream's submission path until the connection dies on its own.
const WRITE_TIMEOUT: Duration = Duration::from_secs(10);

impl V3PoolClient {
    fn ensure_connected(&self) -> Result<()> {
        if *self.conn_closed.borrow() {
            anyhow::bail!("V3 pool: connection closed");
        }
        Ok(())
    }

    /// True once the read loop has observed the connection closing
    /// (EOF, read error, or a Bye message from the pool).
    pub fn is_closed(&self) -> bool {
        *self.conn_closed.borrow()
    }

    /// A receiver that signals when the connection dies — either when the
    /// read loop marks it closed or when the read loop task exits and drops
    /// the sender. Stream tasks use it to abort mining immediately instead of
    /// finishing a scan on a dead connection (which previously looked like a
    /// mining stall and ended in a watchdog kill).
    pub fn conn_closed_receiver(&self) -> watch::Receiver<bool> {
        self.conn_closed.clone()
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

        // Send Hello.  ZION_ZIS_TOKEN carries a ZIS API key (`zis_…`)
        // which binds the session to a ZIS user when the pool has ZIS
        // auth enabled (phase C); empty = anonymous wallet-mode session.
        let auth_token = std::env::var("ZION_ZIS_TOKEN").unwrap_or_default();
        let hello = PoolMessage::Hello {
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            algorithm: algorithm.to_string(),
            payout_address: payout_address.to_string(),
            backend: backend.to_string(),
            auth_token,
        };
        let hello_line = encode_message(&hello)?;
        {
            let mut w = writer.lock().await;
            tokio::time::timeout(WRITE_TIMEOUT, async {
                w.write_all(hello_line.as_bytes()).await?;
                w.flush().await
            })
            .await
            .context("V3 pool: hello write timeout")??;
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
                zis_user,
            } => {
                info!(
                    "V3 pool connected: protocol={} algo={} job_ttl={}ms{}",
                    protocol_version, welcome_algo, job_ttl_ms,
                    if zis_user.is_empty() {
                        String::new()
                    } else {
                        format!(" zis_user={}", zis_user)
                    }
                );
            }
            other => {
                anyhow::bail!("V3 pool: expected Welcome, got {:?}", other);
            }
        }

        // Channels for dispatching messages from the read loop.
        // Jobs use a watch channel: consumers only ever need the newest
        // bundle and the read loop must never block on a full queue
        // (previously an mpsc(64) drained only by Stream 1 — when that
        // stream hung, the queue filled, the read loop stalled, and the
        // external streams kept mining a frozen job -> stale-share storm).
        let (job_tx, job_rx) = watch::channel::<Option<V3JobBundle>>(None);
        let job_tx_loop = job_tx.clone();
        let (zion_result_tx, zion_result_rx) = mpsc::channel::<V3ShareResult>(16);
        // Per-coin result dispatch: the read loop looks up the channel for
        // the result's coin ticker; submit creates channel pairs lazily so
        // any coin (ZANO, QTU, VRSC, …) gets isolated result routing.
        let ext_result_senders = std::sync::Arc::new(std::sync::Mutex::new(
            std::collections::HashMap::<String, mpsc::Sender<V3ExternalResult>>::new(),
        ));
        let ext_senders_loop = ext_result_senders.clone();

        // Watch channel to signal when the pool closes the connection.
        let (conn_closed_tx, conn_closed_rx) = watch::channel(false);

        // Tracks the newest ZION job_id seen by the read loop so the mining
        // path can detect a stale share before submitting it.
        let latest_zion_job_id =
            std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
        let latest_zion_in_loop = latest_zion_job_id.clone();

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
                                external_stream_2,
                            }) => {
                                debug!(
                                    "V3 job received: id={} height={} gpu_ext={} cpu_ext={} gpu_ext2={}",
                                    job_id,
                                    height,
                                    external_stream.is_some(),
                                    external_stream_cpu.is_some(),
                                    external_stream_2.is_some()
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
                                        received_at: std::time::Instant::now(),
                                    },
                                    gpu_external: external_stream,
                                    cpu_external: external_stream_cpu,
                                    gpu_external_2: external_stream_2,
                                };
                                latest_zion_in_loop
                                    .store(job_id, std::sync::atomic::Ordering::Relaxed);
                                let _ = job_tx_loop.send_replace(Some(bundle));
                            }
                            Ok(PoolMessage::SetDifficulty {
                                difficulty,
                                target_hex,
                            }) => {
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
                                // try_send — never block the read loop on
                                // share-result backpressure; a waiting submit
                                // simply hits its own timeout instead.
                                if zion_result_tx
                                    .try_send(V3ShareResult {
                                        accepted,
                                        status,
                                        block_found,
                                        block_height,
                                    })
                                    .is_err()
                                {
                                    warn!("V3 read loop: zion result channel full, dropping result");
                                }
                            }
                            Ok(PoolMessage::ExternalResult {
                                accepted,
                                status,
                                coin,
                            }) => {
                                let result = V3ExternalResult {
                                    accepted,
                                    status,
                                    coin: coin.clone(),
                                };
                                // Dispatch by coin ticker — each stream's
                                // submissions wait on the channel for the
                                // coin they submitted, so two concurrent
                                // GPU coins can never consume each
                                // other's results.
                                let coin_upper = coin.to_uppercase();
                                let tx = ext_senders_loop
                                    .lock()
                                    .unwrap()
                                    .get(&coin_upper)
                                    .cloned();
                                match tx {
                                    Some(tx) => {
                                        if tx.try_send(result).is_err() {
                                            warn!("V3 read loop: external result channel full, dropping result");
                                        }
                                    }
                                    None => {
                                        warn!(
                                            coin = %coin_upper,
                                            "V3 read loop: external result for unsubscribed coin, dropping"
                                        );
                                    }
                                }
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
            job_tx,
            zion_result_rx: Mutex::new(zion_result_rx),
            ext_result_senders,
            ext_result_receivers: Mutex::new(std::collections::HashMap::new()),
            conn_closed: conn_closed_rx,
            latest_zion_job_id,
        })
    }

    /// Wait for the next job bundle from the pool (ZION + AuxPoW streams).
    ///
    /// Returns the newest unseen bundle; intermediate bundles published while
    /// the caller was busy are coalesced (only the latest is ever relevant).
    pub async fn next_job(&self, timeout: Duration) -> Result<V3JobBundle> {
        self.ensure_connected()?;
        let mut rx = self.job_rx.lock().await;
        // Abort the wait as soon as the connection dies — previously a dead
        // session kept waiting here for the full timeout even though no job
        // could ever arrive, hiding real disconnects behind a misleading
        // "job timeout" error and stalling reconnects by up to 60s.
        let mut conn_closed = self.conn_closed.clone();
        let wait = async {
            // Fast path: a bundle published before this call is still unseen.
            if rx.has_changed().unwrap_or(false) {
                if let Some(bundle) = rx.borrow_and_update().clone() {
                    return Ok(bundle);
                }
            }
            loop {
                // NOTE: `changed()` marks the newest value as seen when it
                // resolves — `has_changed()` afterwards is always false, so
                // the bundle must be read here, not re-tested for freshness.
                tokio::select! {
                    changed = rx.changed() => {
                        if changed.is_err() {
                            anyhow::bail!("V3 pool: job channel closed");
                        }
                        if let Some(bundle) = rx.borrow().clone() {
                            return Ok(bundle);
                        }
                    }
                    _ = conn_closed.changed() => {
                        anyhow::bail!("V3 pool: connection closed");
                    }
                }
            }
        };
        match tokio::time::timeout(timeout, wait).await {
            Ok(res) => res,
            Err(_) => anyhow::bail!("V3 pool: job timeout after {:?}", timeout),
        }
    }

    /// Non-blocking check for a new job. Returns `Some(bundle)` if a new job
    /// is available, `None` if no new job has arrived since the last call.
    pub async fn try_next_job(&self) -> Option<V3JobBundle> {
        let mut rx = self.job_rx.lock().await;
        if rx.has_changed().unwrap_or(false) {
            rx.borrow_and_update().clone()
        } else {
            None
        }
    }

    /// Subscribe to the job bundle stream. External mining streams subscribe
    /// directly so their job feed is independent of Stream 1's mining loop.
    pub fn subscribe_jobs(&self) -> watch::Receiver<Option<V3JobBundle>> {
        self.job_tx.subscribe()
    }

    /// The most recent ZION job_id received from the pool.
    ///
    /// Used before submitting a share: the pool drops superseded jobs, so a
    /// share mined for an older job_id is guaranteed to come back
    /// `unknown_job`.  Comparing job ids is precise — a new bundle pushed
    /// only because an AuxPoW stream changed keeps the same ZION job_id and
    /// the share remains valid.
    pub fn latest_zion_job_id(&self) -> u64 {
        self.latest_zion_job_id
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Write one JSON-line message to the pool socket with a hard timeout.
    async fn write_line(&self, line: &str) -> Result<()> {
        let mut w = self.writer.lock().await;
        tokio::time::timeout(WRITE_TIMEOUT, async {
            w.write_all(line.as_bytes()).await?;
            w.flush().await
        })
        .await
        .context("V3 pool: write timeout")??;
        Ok(())
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
        self.write_line(&line).await?;
        // Wait for Result
        let mut rx = self.zion_result_rx.lock().await;
        match tokio::time::timeout(Duration::from_secs(30), rx.recv()).await {
            Ok(Some(result)) => Ok(result),
            Ok(None) => anyhow::bail!("V3 pool: result channel closed"),
            Err(_) => anyhow::bail!("V3 pool: share result timeout"),
        }
    }

    /// Submit an AuxPoW (external) share to the pool for forwarding to the
    /// external pool (ZANO, VRSC, QTU, …). The result is awaited on the
    /// per-coin channel — results are dispatched by coin ticker, so two
    /// concurrent GPU streams never consume each other's results.
    ///
    /// IMPORTANT: results for the same coin can arrive concurrently from
    /// both GPU slots only if the miner config serves the same coin twice
    /// — pool-side dedup prevents that, and the receiver mutex serializes
    /// same-coin submits anyway.
    #[allow(clippy::too_many_arguments)]
    pub async fn submit_external_share(
        &self,
        coin: &str,
        algorithm: &str,
        external_job_id: &str,
        nonce: u64,
        nonce_hex: Option<&str>,
        hash_hex: &str,
        mix_hash_hex: Option<&str>,
        extranonce1_hex: &str,
        solution_hex: &str,
        ntime_hex: &str,
    ) -> Result<V3ExternalResult> {
        self.ensure_connected()?;
        // Ensure the per-coin result channel exists BEFORE the submit is
        // written — a fast result arriving before the sender is registered
        // would be dropped by the read loop and this call would time out.
        let coin_key = coin.to_uppercase();
        let rx_arc = {
            let mut rxs = self.ext_result_receivers.lock().await;
            match rxs.get(&coin_key) {
                Some(rx) => rx.clone(),
                None => {
                    let (tx, rx) = mpsc::channel::<V3ExternalResult>(16);
                    self.ext_result_senders
                        .lock()
                        .unwrap()
                        .insert(coin_key.clone(), tx);
                    let rx = std::sync::Arc::new(Mutex::new(rx));
                    rxs.insert(coin_key, rx.clone());
                    rx
                }
            }
        };
        let msg = PoolMessage::ExternalSubmit {
            miner_id: self.miner_id.clone(),
            worker_name: self.worker_name.clone(),
            coin: coin.to_string(),
            algorithm: algorithm.to_string(),
            external_job_id: external_job_id.to_string(),
            nonce,
            nonce_hex: nonce_hex.map(|s| s.to_string()),
            hash_hex: hash_hex.to_string(),
            mix_hash_hex: mix_hash_hex.map(|s| s.to_string()),
            extranonce1_hex: extranonce1_hex.to_string(),
            solution_hex: solution_hex.to_string(),
            ntime_hex: ntime_hex.to_string(),
        };
        let line = encode_message(&msg)?;
        self.write_line(&line).await?;
        // Wait for ExternalResult on the per-coin channel.
        // First drain any stale results left over from previous timed-out
        // submissions — without this, a late-arriving result from a previous
        // share would be picked up as the result for THIS share, causing
        // false rejections ("result shifting").
        let mut rx = rx_arc.lock().await;
        while let Ok(stale) = rx.try_recv() {
            ext_warn!(
                coin = %stale.coin,
                accepted = stale.accepted,
                status = %stale.status,
                "drained stale external result (leftover from timed-out submission)"
            );
        }
        match tokio::time::timeout(Duration::from_secs(30), rx.recv()).await {
            Ok(Some(result)) => Ok(result),
            Ok(None) => anyhow::bail!("V3 pool: external result channel closed"),
            Err(_) => anyhow::bail!("V3 pool: external share result timeout"),
        }
    }

    /// Send a CoinPreference message (for autonomous profit routing).
    /// `gpu_coin_2` pins the second GPU stream (Quad mode); pass "" when
    /// the miner runs a single GPU external stream.
    pub async fn send_coin_preference(
        &self,
        gpu_coin: &str,
        cpu_coin: &str,
        gpu_coin_2: &str,
        gpu_profit_usd_day: f64,
        cpu_profit_usd_day: f64,
    ) -> Result<()> {
        self.ensure_connected()?;
        let msg = PoolMessage::CoinPreference {
            miner_id: self.miner_id.clone(),
            gpu_coin: gpu_coin.to_string(),
            cpu_coin: cpu_coin.to_string(),
            gpu_coin_2: gpu_coin_2.to_string(),
            gpu_profit_usd_day,
            cpu_profit_usd_day,
        };
        let line = encode_message(&msg)?;
        self.write_line(&line).await
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
        self.write_line(&line).await
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pool_message::ExternalStreamJob;
    use tokio::net::TcpListener;

    fn job_line(id: u64, ext_job_id: &str) -> String {
        encode_message(&PoolMessage::Job {
            job_id: id,
            algorithm: "ekam_deeksha".into(),
            start_nonce: 0,
            nonce_count: 1_000_000,
            target_hex: "ff".repeat(64),
            header_hex: "00".repeat(64),
            height: id,
            stream_weights: String::new(),
            external_stream: None,
            external_stream_cpu: Some(ExternalStreamJob {
                coin: "VRSC".into(),
                algorithm: "verushash".into(),
                job_id: ext_job_id.into(),
                header_hex: "11".repeat(64),
                target_hex: "ff".repeat(64),
                height: id,
                extranonce1_hex: "aabbccdd".into(),
                protocol: String::new(),
                seed_hash_hex: String::new(),
                timestamp: 0,
                ntime_hex: "00000000".into(),
                eq_params: "".into(),
                eq_pers: "".into(),
            }),
            external_stream_2: None,
        })
        .unwrap()
    }

    fn ext_job(coin: &str, algo: &str, job_id: &str) -> ExternalStreamJob {
        ExternalStreamJob {
            coin: coin.into(),
            algorithm: algo.into(),
            job_id: job_id.into(),
            header_hex: "22".repeat(64),
            target_hex: "ff".repeat(64),
            height: 1,
            extranonce1_hex: "aabbccdd".into(),
            protocol: String::new(),
            seed_hash_hex: String::new(),
            timestamp: 0,
            ntime_hex: "00000000".into(),
            eq_params: "".into(),
            eq_pers: "".into(),
        }
    }

    /// Quad mode: the Job line's `external_stream_2` must land in
    /// `V3JobBundle.gpu_external_2` alongside the first GPU stream.
    #[tokio::test]
    async fn job_bundle_carries_second_gpu_stream() {
        let addr = spawn_mock_pool(|_lines, mut writer| async move {
            let line = encode_message(&PoolMessage::Job {
                job_id: 9,
                algorithm: "ekam_deeksha".into(),
                start_nonce: 0,
                nonce_count: 1_000_000,
                target_hex: "ff".repeat(64),
                header_hex: "00".repeat(64),
                height: 9,
                stream_weights: String::new(),
                external_stream: Some(ext_job("QTU", "qpow-poseidon2", "qtu_1")),
                external_stream_cpu: Some(ext_job("VRSC", "verushash", "vrsc_1")),
                external_stream_2: Some(ext_job("ZANO", "progpow_zano", "zano_1")),
            })
            .unwrap();
            writer.write_all(line.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();
            tokio::time::sleep(Duration::from_secs(5)).await;
        })
        .await;

        let client = V3PoolClient::connect(&addr, "m", "w", "ekam_deeksha", "cpu", "p")
            .await
            .unwrap();
        let bundle = client
            .next_job(Duration::from_secs(5))
            .await
            .expect("quad job never arrived");
        assert_eq!(bundle.gpu_external.unwrap().job_id, "qtu_1");
        assert_eq!(bundle.cpu_external.unwrap().coin, "VRSC");
        let gpu2 = bundle.gpu_external_2.expect("gpu_external_2 missing");
        assert_eq!(gpu2.coin, "ZANO");
        assert_eq!(gpu2.job_id, "zano_1");
    }

    /// Two concurrent GPU streams submitting different coins must each get
    /// their own result even when the pool replies in the opposite order —
    /// the old is_vrsc two-channel dispatch cross-consumed results.
    #[tokio::test]
    async fn external_results_routed_by_coin() {
        let addr = spawn_mock_pool(|mut lines, mut writer| async move {
            // Read both ExternalSubmit lines (order of submission is
            // nondeterministic — just consume two).
            let l1 = lines.next_line().await.unwrap().unwrap();
            let l2 = lines.next_line().await.unwrap().unwrap();
            assert!(l1.contains("external_submit") && l2.contains("external_submit"));
            // Reply REVERSED: ZANO result first, then QTU.
            for coin in ["ZANO", "QTU"] {
                let line = encode_message(&PoolMessage::ExternalResult {
                    accepted: true,
                    status: format!("{coin}-ok"),
                    coin: coin.into(),
                })
                .unwrap();
                writer.write_all(line.as_bytes()).await.unwrap();
            }
            writer.flush().await.unwrap();
            tokio::time::sleep(Duration::from_secs(5)).await;
        })
        .await;

        let client = std::sync::Arc::new(
            V3PoolClient::connect(&addr, "m", "w", "ekam_deeksha", "cpu", "p")
                .await
                .unwrap(),
        );
        let c2 = client.clone();
        let zano = tokio::spawn(async move {
            c2.submit_external_share("ZANO", "progpow_zano", "z1", 1, None, &"ab".repeat(32), None, "", "", "")
                .await
        });
        let qtu = client
            .submit_external_share("QTU", "qpow-poseidon2", "q1", 1, None, &"cd".repeat(32), None, "", "", "")
            .await
            .expect("QTU submit failed");
        let zano = zano.await.unwrap().expect("ZANO submit failed");
        assert_eq!(qtu.coin, "QTU");
        assert_eq!(qtu.status, "QTU-ok");
        assert_eq!(zano.coin, "ZANO");
        assert_eq!(zano.status, "ZANO-ok");
    }

    /// Spawns a mock V3 pool on loopback. Returns the address the client
    /// should dial; `server_fn` runs after the Hello/Welcome handshake and
    /// receives the socket halves for the rest of the scripted exchange.
    async fn spawn_mock_pool<F, Fut>(server_fn: F) -> String
    where
        F: FnOnce(
                tokio::io::Lines<BufReader<tokio::io::ReadHalf<TcpStream>>>,
                tokio::io::WriteHalf<TcpStream>,
            ) -> Fut
            + Send
            + 'static,
        Fut: std::future::Future<Output = ()> + Send,
    {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (reader, mut writer) = tokio::io::split(stream);
            let mut lines = BufReader::new(reader).lines();
            // Consume Hello, reply Welcome.
            let _hello = lines.next_line().await.unwrap().unwrap();
            let welcome = encode_message(&PoolMessage::Welcome {
                protocol_version: "zion-v3-stratum/0.2".into(),
                algorithm: "ekam_deeksha".into(),
                job_ttl_ms: 60_000,
                zis_user: String::new(),
            })
            .unwrap();
            writer.write_all(welcome.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();
            server_fn(lines, writer).await;
        });
        addr
    }

    /// Regression test for the stale-share storm: the read loop must keep
    /// delivering jobs and results even when no consumer drains them.
    /// With the old mpsc(64) queue, a wedged Stream 1 filled the queue and
    /// the read loop blocked on `send()`, freezing the whole connection.
    #[tokio::test]
    async fn read_loop_never_blocks_on_job_delivery() {
        let addr = spawn_mock_pool(|_lines, mut writer| async move {
            // Blast 200 job bundles — far beyond the old 64-deep queue —
            // with nobody consuming them.
            for i in 1..=200u64 {
                let line = job_line(i, &format!("ext{i}"));
                writer.write_all(line.as_bytes()).await.unwrap();
            }
            // Then respond to whatever the client sends next.
            tokio::time::sleep(Duration::from_millis(50)).await;
            let result = encode_message(&PoolMessage::Result {
                accepted: true,
                status: "accepted".into(),
                block_found: false,
                block_height: None,
            })
            .unwrap();
            let _ = writer.write_all(result.as_bytes()).await;
            let _ = writer.flush().await;
        })
        .await;

        let client = V3PoolClient::connect(
            &addr,
            "miner",
            "worker",
            "ekam_deeksha",
            "cpu",
            "payout",
        )
        .await
        .unwrap();

        // The newest job bundle must be visible to subscribers without any
        // next_job() polling in between.
        let mut rx = client.subscribe_jobs();
        let bundle = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                rx.changed().await.unwrap();
                if let Some(b) = rx.borrow().clone() {
                    if b.zion.job_id == 200 {
                        return b;
                    }
                }
            }
        })
        .await
        .expect("latest job bundle never reached subscribers");
        assert_eq!(bundle.cpu_external.unwrap().job_id, "ext200");

        // A share submit must still round-trip even though the read loop
        // processed 200 jobs with no consumer attached until now.
        let res = client
            .submit_zion_share(200, 42, &"ab".repeat(32), None, 1, 1)
            .await
            .expect("share submit failed — read loop wedged");
        assert!(res.accepted);
    }

    /// Regression test for the `changed()`/`has_changed()` inversion: a job
    /// published while `next_job` is parked in `rx.changed()` must be
    /// returned immediately. `changed()` marks the newest value as seen when
    /// it resolves, so re-testing `has_changed()` afterwards is always false
    /// — the old loop swallowed every published job and starved until the
    /// 60s timeout (live symptom: Stream 1 never mined, every session died
    /// on the job TTL while streams 2/3 kept working).
    #[tokio::test]
    async fn next_job_returns_job_published_while_awaiting() {
        let addr = spawn_mock_pool(|_lines, mut writer| async move {
            // Give the client a moment to call next_job and park in
            // rx.changed(), then publish exactly one job and go quiet —
            // a second send must not be required to wake the waiter.
            tokio::time::sleep(Duration::from_millis(300)).await;
            let line = job_line(7, "ext7");
            writer.write_all(line.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();
            tokio::time::sleep(Duration::from_secs(10)).await;
        })
        .await;

        let client = V3PoolClient::connect(
            &addr,
            "miner",
            "worker",
            "ekam_deeksha",
            "cpu",
            "payout",
        )
        .await
        .unwrap();

        let bundle = client
            .next_job(Duration::from_secs(5))
            .await
            .expect("next_job must return a job published while awaiting");
        assert_eq!(bundle.zion.job_id, 7);
    }

    /// A pool session that dies before sending any job must surface as a
    /// fast connection error, not a 60s "job timeout". Regression test for
    /// the Trustee crash-loop: a dropped session made next_job wait the full
    /// timeout, and an in-flight scan kept hashing on a dead connection until
    /// the watchdog killed the miner.
    #[tokio::test]
    async fn next_job_aborts_when_connection_dies() {
        let addr = spawn_mock_pool(|_lines, _writer| async move {
            // Stay silent, then drop the socket — simulates a session the
            // pool accepted and then dropped mid-handshake.
            tokio::time::sleep(Duration::from_millis(200)).await;
        })
        .await;

        let client = V3PoolClient::connect(
            &addr,
            "miner",
            "worker",
            "ekam_deeksha",
            "cpu",
            "payout",
        )
        .await
        .unwrap();

        let start = std::time::Instant::now();
        let err = client
            .next_job(Duration::from_secs(60))
            .await
            .expect_err("next_job should fail on a dropped connection");
        assert!(
            start.elapsed() < Duration::from_secs(10),
            "next_job waited {:?} on a dead connection",
            start.elapsed()
        );
        let msg = err.to_string();
        assert!(
            msg.contains("connection closed"),
            "expected connection-closed error, got: {msg}"
        );
        assert!(client.is_closed());
    }
}
