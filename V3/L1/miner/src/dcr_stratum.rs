use anyhow::{anyhow, bail, Context, Result};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::time::Duration;

use crate::dcr_hash::difficulty_to_target;

/// A DCR mining job received from the pool.
#[derive(Clone)]
#[allow(dead_code)]
pub struct DcrJob {
    pub job_id: String,
    pub header: Vec<u8>,
    pub target: [u8; 32],
    /// Byte offset of the 4-byte nonce inside `header`.
    pub nonce_offset: usize,
    pub clean: bool,
}

/// Minimal Stratum v1 JSON-RPC client for DCR pools.
pub struct DcrStratumClient {
    reader: BufReader<TcpStream>,
    writer: TcpStream,
    next_id: u64,
    wallet: String,
    worker: String,
    target: [u8; 32],
}

impl DcrStratumClient {
    /// Connect to a Stratum v1 pool.
    pub fn connect(pool_addr: &str, wallet: &str, worker: &str) -> Result<Self> {
        let stream = TcpStream::connect(pool_addr)
            .with_context(|| format!("connect to DCR pool {pool_addr}"))?;
        stream.set_read_timeout(Some(Duration::from_secs(120)))?;
        stream.set_write_timeout(Some(Duration::from_secs(10)))?;
        let reader = BufReader::new(stream.try_clone().context("clone DCR stream")?);

        Ok(Self {
            reader,
            writer: stream,
            next_id: 1,
            wallet: wallet.to_string(),
            worker: worker.to_string(),
            target: [0xFF; 32],
        })
    }

    pub fn subscribe(&mut self) -> Result<()> {
        let id = self.next_id();
        self.send(&json!({
            "id": id,
            "method": "mining.subscribe",
            "params": ["zion-miner/3.0"]
        }))?;
        let resp = self.recv_blocking()?;
        if let Some(err) = resp.get("error") {
            if !err.is_null() {
                bail!("subscribe error: {err}");
            }
        }
        Ok(())
    }

    pub fn authorize(&mut self) -> Result<()> {
        let id = self.next_id();
        let worker_full = format!("{}.{}", self.wallet, self.worker);
        self.send(&json!({
            "id": id,
            "method": "mining.authorize",
            "params": [worker_full, "x"]
        }))?;

        // Pool might send set_difficulty or other notifications before the
        // authorize response — keep reading until we see our reply.
        loop {
            let msg = self.recv_blocking()?;
            if msg.get("id").and_then(|v| v.as_u64()) == Some(id) {
                if msg.get("result").and_then(|r| r.as_bool()) != Some(true) {
                    bail!("authorize rejected by pool");
                }
                return Ok(());
            }
            self.handle_notification(&msg);
        }
    }

    /// Block until the next `mining.notify` arrives.
    pub fn read_job(&mut self) -> Result<DcrJob> {
        self.set_read_timeout(120_000)?;
        loop {
            let msg = self.recv_blocking()?;
            if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
                if method == "mining.notify" {
                    return self.parse_notify(&msg);
                }
                self.handle_notification(&msg);
            }
        }
    }

    /// Non-blocking poll for a new job (100 ms timeout).
    pub fn poll_job(&mut self) -> Result<Option<DcrJob>> {
        self.set_read_timeout(100)?;

        let mut line = String::new();
        match self.reader.read_line(&mut line) {
            Ok(0) => bail!("DCR pool closed connection"),
            Ok(_) => {
                let msg: Value =
                    serde_json::from_str(line.trim()).context("parse pool message")?;
                if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
                    if method == "mining.notify" {
                        return Ok(Some(self.parse_notify(&msg)?));
                    }
                    self.handle_notification(&msg);
                }
                Ok(None)
            }
            Err(ref e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                Ok(None)
            }
            Err(e) => Err(anyhow::Error::from(e)),
        }
    }

    /// Fire-and-forget share submission. Response is consumed by poll_job.
    pub fn submit_share(&mut self, job_id: &str, nonce: u32) -> Result<()> {
        let id = self.next_id();
        let worker_full = format!("{}.{}", self.wallet, self.worker);
        self.send(&json!({
            "id": id,
            "method": "mining.submit",
            "params": [worker_full, job_id, format!("{:08x}", nonce)]
        }))
    }

    // ── internals ───────────────────────────────────────────────

    fn parse_notify(&self, msg: &Value) -> Result<DcrJob> {
        let params = msg
            .get("params")
            .and_then(|p| p.as_array())
            .ok_or_else(|| anyhow!("mining.notify missing params"))?;

        if params.is_empty() {
            bail!("mining.notify params empty");
        }

        let job_id = params[0].as_str().unwrap_or("0").to_string();

        // Format A: [job_id, header_hex_360, clean_jobs]
        if params.len() >= 2 {
            if let Some(hex) = params[1].as_str() {
                if hex.len() == 360 {
                    let header = hex_decode(hex)?;
                    let clean = params.get(2).and_then(|c| c.as_bool()).unwrap_or(false);
                    return Ok(DcrJob {
                        job_id,
                        header,
                        target: self.target,
                        nonce_offset: 140,
                        clean,
                    });
                }
            }
        }

        // Format B: Bitcoin-style [job_id, prevhash, coinb1, coinb2,
        //           merkle_branches, version, nbits, ntime, clean]
        if params.len() >= 9 {
            let prev_hash_hex = params[1].as_str().unwrap_or("");
            let version_hex = params[5].as_str().unwrap_or("01000000");
            let nbits_hex = params[6].as_str().unwrap_or("ffff001f");
            let ntime_hex = params[7].as_str().unwrap_or("00000000");
            let clean = params[8].as_bool().unwrap_or(false);

            let mut header = vec![0u8; 180];

            if let Ok(v) = hex_decode(version_hex) {
                let n = v.len().min(4);
                header[..n].copy_from_slice(&v[..n]);
            }
            if let Ok(ph) = hex_decode(prev_hash_hex) {
                let n = ph.len().min(32);
                header[4..4 + n].copy_from_slice(&ph[..n]);
            }
            if let Ok(nt) = hex_decode(ntime_hex) {
                let n = nt.len().min(4);
                header[136..136 + n].copy_from_slice(&nt[..n]);
            }
            if let Ok(nb) = hex_decode(nbits_hex) {
                let n = nb.len().min(4);
                header[108..108 + n].copy_from_slice(&nb[..n]);
            }

            return Ok(DcrJob {
                job_id,
                header,
                target: self.target,
                nonce_offset: 140,
                clean,
            });
        }

        bail!(
            "unsupported mining.notify format ({} params)",
            params.len()
        );
    }

    fn handle_notification(&mut self, msg: &Value) {
        if let Some("mining.set_difficulty") = msg.get("method").and_then(|m| m.as_str()) {
            if let Some(diff) = msg
                .get("params")
                .and_then(|p| p.as_array())
                .and_then(|a| a.first())
                .and_then(|d| d.as_f64())
            {
                self.target = difficulty_to_target(diff);
            }
        }
    }

    fn send(&mut self, msg: &Value) -> Result<()> {
        let mut line = serde_json::to_string(msg)?;
        line.push('\n');
        self.writer
            .write_all(line.as_bytes())
            .context("write to DCR pool")?;
        self.writer.flush().context("flush DCR pool")?;
        Ok(())
    }

    fn recv_blocking(&mut self) -> Result<Value> {
        let mut line = String::new();
        let n = self
            .reader
            .read_line(&mut line)
            .context("read from DCR pool")?;
        if n == 0 {
            bail!("DCR pool closed connection");
        }
        serde_json::from_str(line.trim()).context("parse DCR pool message")
    }

    fn set_read_timeout(&self, ms: u64) -> Result<()> {
        self.reader
            .get_ref()
            .set_read_timeout(Some(Duration::from_millis(ms)))
            .context("set DCR read timeout")?;
        Ok(())
    }

    fn next_id(&mut self) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }
}

fn hex_decode(hex: &str) -> Result<Vec<u8>> {
    let hex = hex.trim().trim_start_matches("0x");
    if !hex.len().is_multiple_of(2) {
        bail!("odd-length hex string");
    }
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    for chunk in hex.as_bytes().chunks(2) {
        let pair = std::str::from_utf8(chunk)?;
        bytes.push(u8::from_str_radix(pair, 16)?);
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_decode_works() {
        assert_eq!(
            hex_decode("deadbeef").unwrap(),
            vec![0xde, 0xad, 0xbe, 0xef]
        );
        assert_eq!(hex_decode("00ff").unwrap(), vec![0x00, 0xff]);
    }

    #[test]
    fn hex_decode_odd_fails() {
        assert!(hex_decode("abc").is_err());
    }

    #[test]
    fn difficulty_to_target_round_trip() {
        let target = crate::dcr_hash::difficulty_to_target(1.0);
        assert_eq!(&target[0..6], &[0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF]);
    }
}
