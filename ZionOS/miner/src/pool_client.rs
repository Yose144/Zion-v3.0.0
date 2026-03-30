//! Pool protocol client — JSON-line stratum over TCP.
//!
//! Protocol flow:
//!   → Hello        (miner announces identity)
//!   ← Welcome      (pool confirms algorithm + TTL)
//!   ← SetDifficulty (pool sets share target — may arrive before each Job)
//!   ← Job          (header + nonce range + share target)
//!   → Submit | NoSolution
//!   ← Result       (accepted / rejected)

use anyhow::{anyhow, bail, Context, Result};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::time::Duration;
use zion_core::{DifficultyTarget, MiningHeader, MiningJob};
use zion_pool::{decode_message, encode_message, PoolMessage};

/// Parsed job ready for mining.
#[derive(Debug, Clone)]
pub struct PoolJob {
    pub job: MiningJob,
    pub share_target: DifficultyTarget,
}

/// Active pool session.
pub struct PoolClient {
    reader: BufReader<TcpStream>,
    writer: TcpStream,
    pub miner_id: String,
    pub worker_name: String,
    pub algorithm: String,
    pub job_ttl_ms: u64,
    /// Current share target (updated by SetDifficulty messages).
    pub share_target: DifficultyTarget,
    line_buf: String,
}

impl PoolClient {
    /// Connect to pool, perform handshake, return ready client.
    pub fn connect(addr: &str, miner_id: &str, worker_name: &str) -> Result<Self> {
        let stream = TcpStream::connect(addr)
            .with_context(|| format!("TCP connect to {addr}"))?;
        stream.set_read_timeout(Some(Duration::from_secs(300)))?;
        stream.set_write_timeout(Some(Duration::from_secs(30)))?;

        let reader = BufReader::new(stream.try_clone()?);
        let writer = stream;

        let mut client = Self {
            reader,
            writer,
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            algorithm: String::new(),
            job_ttl_ms: 0,
            share_target: DifficultyTarget::MAX,
            line_buf: String::with_capacity(4096),
        };

        // → Hello
        let hello = PoolMessage::Hello {
            miner_id: miner_id.to_string(),
            worker_name: worker_name.to_string(),
            algorithm: zion_core::consensus_profile().to_string(),
        };
        client.send(&hello)?;

        // ← Welcome
        let welcome = client.recv()?;
        match welcome {
            PoolMessage::Welcome {
                algorithm,
                job_ttl_ms,
                ..
            } => {
                client.algorithm = algorithm;
                client.job_ttl_ms = job_ttl_ms;
            }
            other => bail!("expected Welcome, got {other:?}"),
        }

        // ← SetDifficulty (optional, pool may send before first job)
        // We peek-read: if it's SetDifficulty we consume it, otherwise
        // we save the line for next_job() to parse.
        let msg = client.recv()?;
        match msg {
            PoolMessage::SetDifficulty {
                target_hex, ..
            } => {
                client.share_target = DifficultyTarget::from_hex(&target_hex)
                    .map_err(|e| anyhow!("bad target_hex in SetDifficulty: {e}"))?;
                eprintln!("[pool] share_target={target_hex}");
            }
            // Not SetDifficulty — must be a Job, store it
            other => {
                // Push it back by encoding and storing
                let line = encode_message(&other)?;
                client.line_buf = line;
            }
        }

        eprintln!(
            "[pool] connected to {addr} algo={} ttl={}ms",
            client.algorithm, client.job_ttl_ms
        );

        Ok(client)
    }

    /// Read the next job from pool. Handles interleaved SetDifficulty, Stale, Cancel.
    pub fn next_job(&mut self) -> Result<PoolJob> {
        loop {
            let msg = if !self.line_buf.is_empty() {
                let line = std::mem::take(&mut self.line_buf);
                decode_message(&line)
                    .with_context(|| format!("decode buffered message: {line}"))?
            } else {
                self.recv()?
            };

            match msg {
                PoolMessage::Job {
                    job_id,
                    start_nonce,
                    nonce_count,
                    target_hex,
                    header_hex,
                    height,
                    ..
                } => {
                    let target = DifficultyTarget::from_hex(&target_hex)
                        .map_err(|e| anyhow!("bad target_hex: {e}"))?;
                    let header_bytes = parse_hex_fixed::<80>(&header_hex)
                        .with_context(|| "parse header_hex")?;
                    let header = MiningHeader::from_bytes(header_bytes);

                    // Job target overrides share target if present
                    self.share_target = target;

                    return Ok(PoolJob {
                        job: MiningJob {
                            job_id,
                            header,
                            target,
                            start_nonce,
                            nonce_count,
                            height,
                        },
                        share_target: target,
                    });
                }
                PoolMessage::SetDifficulty {
                    target_hex, ..
                } => {
                    self.share_target = DifficultyTarget::from_hex(&target_hex)
                        .map_err(|e| anyhow!("bad SetDifficulty target: {e}"))?;
                    eprintln!("[pool] difficulty retarget → {target_hex}");
                    continue;
                }
                PoolMessage::Stale { job_id } => {
                    eprintln!("[pool] stale job_id={job_id}");
                    continue;
                }
                PoolMessage::Cancel { job_id, reason } => {
                    eprintln!("[pool] cancel job_id={job_id} reason={reason}");
                    continue;
                }
                other => bail!("expected Job, got {other:?}"),
            }
        }
    }

    /// Submit a found nonce + hash to the pool. Returns (accepted, status).
    pub fn submit_share(
        &mut self,
        job_id: u64,
        nonce: u64,
        hash: &[u8; 32],
        attempted: u64,
        elapsed_ms: u64,
    ) -> Result<(bool, String)> {
        let msg = PoolMessage::Submit {
            job_id,
            miner_id: self.miner_id.clone(),
            worker_name: self.worker_name.clone(),
            nonce,
            hash_hex: hex(hash),
            attempted_hashes: Some(attempted),
            elapsed_ms: Some(elapsed_ms),
        };
        self.send(&msg)?;

        let result = self.recv_result()?;
        match result {
            PoolMessage::Result { accepted, status } => Ok((accepted, status)),
            other => bail!("expected Result, got {other:?}"),
        }
    }

    /// Submit no_solution for a fully-scanned nonce range.
    pub fn submit_no_solution(
        &mut self,
        job_id: u64,
        attempted: u64,
        elapsed_ms: u64,
    ) -> Result<()> {
        let msg = PoolMessage::NoSolution {
            job_id,
            miner_id: self.miner_id.clone(),
            worker_name: self.worker_name.clone(),
            attempted_hashes: Some(attempted),
            elapsed_ms: Some(elapsed_ms),
        };
        self.send(&msg)?;

        // Pool always sends a Result even for NoSolution
        let _result = self.recv_result()?;
        Ok(())
    }

    // ── internal ──

    fn send(&mut self, msg: &PoolMessage) -> Result<()> {
        let line = encode_message(msg)?;
        self.writer
            .write_all(line.as_bytes())
            .context("pool write")?;
        self.writer.flush().context("pool flush")?;
        Ok(())
    }

    fn recv(&mut self) -> Result<PoolMessage> {
        let mut line = String::new();
        self.reader
            .read_line(&mut line)
            .context("pool read")?;
        if line.is_empty() {
            bail!("pool disconnected (EOF)");
        }
        decode_message(&line).with_context(|| format!("decode: {line}"))
    }

    /// Read next message, skipping Stale/Cancel until we get a Result.
    fn recv_result(&mut self) -> Result<PoolMessage> {
        loop {
            let msg = self.recv()?;
            match &msg {
                PoolMessage::Result { .. } => return Ok(msg),
                PoolMessage::Stale { job_id } => {
                    eprintln!("[pool] stale job_id={job_id} (during result wait)");
                    continue;
                }
                PoolMessage::Cancel { job_id, reason } => {
                    eprintln!("[pool] cancel job_id={job_id} reason={reason} (during result wait)");
                    continue;
                }
                PoolMessage::SetDifficulty { target_hex, .. } => {
                    if let Ok(t) = DifficultyTarget::from_hex(target_hex) {
                        self.share_target = t;
                    }
                    eprintln!("[pool] difficulty retarget → {target_hex} (during result wait)");
                    continue;
                }
                other => bail!("expected Result, got {other:?}"),
            }
        }
    }
}

// ── hex helpers ──

fn hex(data: &[u8]) -> String {
    data.iter().map(|b| format!("{b:02x}")).collect()
}

fn parse_hex_fixed<const N: usize>(s: &str) -> Result<[u8; N]> {
    let s = s.trim();
    if s.len() != N * 2 {
        bail!("expected {} hex chars, got {}", N * 2, s.len());
    }
    let mut out = [0u8; N];
    for (i, chunk) in s.as_bytes().chunks(2).enumerate() {
        let hi = hex_nibble(chunk[0])?;
        let lo = hex_nibble(chunk[1])?;
        out[i] = (hi << 4) | lo;
    }
    Ok(out)
}

fn hex_nibble(c: u8) -> Result<u8> {
    match c {
        b'0'..=b'9' => Ok(c - b'0'),
        b'a'..=b'f' => Ok(c - b'a' + 10),
        b'A'..=b'F' => Ok(c - b'A' + 10),
        _ => bail!("invalid hex char: {}", c as char),
    }
}
