//! Stratum v1 client for external pool connection.
//!
//! Implements the standard Stratum v1 protocol:
//!   1. `mining.subscribe` — register with the pool
//!   2. `mining.authorize` — authenticate with wallet.worker
//!   3. `mining.notify` — receive jobs (job_id, header, target)
//!   4. `mining.submit` — submit shares (job_id, nonce, hash)
//!
//! Also supports EthStratum variant (eth_getWork / eth_submitWork) for
//! Ethash/KawPow coins. (TODO — currently only Stratum v1 is implemented.)
//!
//! The client is designed to be used by the `AuxPowScheduler` which
//! manages profit-switching and circuit breaker logic.

use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::TcpStream;
use tokio::sync::{Mutex, Notify};
use tokio::time::timeout;
use tracing::{debug, info, warn};

use crate::types::{CoinProfile, ExternalCoin};

/// Stratum protocol variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StratumProtocol {
    /// Standard Stratum v1 (mining.subscribe / mining.authorize / mining.submit)
    Stratum,
    /// EthStratum / ETH-proxy variant (eth_submitWork, eth_getWork)
    EthStratum,
}

impl ExternalCoin {
    pub fn protocol(self) -> StratumProtocol {
        match self {
            Self::DCR | Self::ALPH | Self::KAS | Self::FLUX | Self::XMR => StratumProtocol::Stratum,
            Self::ERG | Self::RVN | Self::ETC | Self::EVR | Self::MEWC | Self::CLORE => {
                StratumProtocol::EthStratum
            }
        }
    }
}

/// A job received from the external pool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalJob {
    pub job_id: String,
    /// Hex-encoded header / preimage (coin-specific format).
    pub header_hex: String,
    /// Hex-encoded target (big-endian).
    pub target_hex: String,
    /// Optional seed hash (for Ethash DAG-based coins).
    pub seed_hash: Option<String>,
    /// Optional block number (for Ethash).
    pub block_number: Option<u64>,
    /// Algorithm name for this job.
    pub algorithm: String,
    /// Raw bytes of the header (decoded from header_hex).
    #[serde(skip)]
    pub header_bytes: Vec<u8>,
    /// Raw target bytes (decoded from target_hex).
    #[serde(skip)]
    pub target_bytes: [u8; 32],
}

/// Share submission result from the pool.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShareResult {
    Accepted,
    Rejected(String),
    Unknown,
}

/// Stratum v1 client for an external mining pool.
pub struct AuxPowClient {
    profile: CoinProfile,
    protocol: StratumProtocol,
    stream: Arc<Mutex<Option<OwnedWriteHalf>>>,
    reader: Arc<Mutex<Option<BufReader<OwnedReadHalf>>>>,
    current_job: Arc<Mutex<Option<ExternalJob>>>,
    subscribed: Arc<Mutex<bool>>,
    authorized: Arc<Mutex<bool>>,
    /// Notify when a new job arrives.
    job_notify: Arc<Notify>,
    /// Shutdown signal.
    shutdown: Arc<Notify>,
    connected: Arc<Mutex<bool>>,
}

impl AuxPowClient {
    /// Create a new client for the given coin profile.
    pub fn new(profile: CoinProfile) -> Self {
        let protocol = profile.coin.protocol();
        Self {
            profile,
            protocol,
            stream: Arc::new(Mutex::new(None)),
            reader: Arc::new(Mutex::new(None)),
            current_job: Arc::new(Mutex::new(None)),
            subscribed: Arc::new(Mutex::new(false)),
            authorized: Arc::new(Mutex::new(false)),
            job_notify: Arc::new(Notify::new()),
            shutdown: Arc::new(Notify::new()),
            connected: Arc::new(Mutex::new(false)),
        }
    }

    /// Connect to the external pool and perform subscribe + authorize.
    pub async fn connect(&self, payout_wallet: &str) -> Result<()> {
        let addr = self.profile.pool_address();
        info!(
            "AuxPow: connecting to {} ({}) for {}",
            addr,
            self.protocol.as_str(),
            self.profile.coin
        );

        let stream = timeout(Duration::from_secs(15), TcpStream::connect(&addr))
            .await
            .map_err(|_| anyhow!("connect timeout to {}", addr))?
            .context("TCP connect failed")?;

        // Split into reader and writer
        let (reader_half, writer_half) = stream.into_split();
        let buf_reader = BufReader::new(reader_half);

        *self.stream.lock().await = Some(writer_half);
        *self.reader.lock().await = Some(buf_reader);
        *self.connected.lock().await = true;

        // Subscribe
        self.subscribe().await?;
        // Authorize
        self.authorize(payout_wallet).await?;

        info!("AuxPow: connected and authorized for {}", self.profile.coin);
        Ok(())
    }

    /// Send `mining.subscribe` and wait for response.
    async fn subscribe(&self) -> Result<()> {
        let req = json!({
            "id": 1,
            "method": "mining.subscribe",
            "params": ["zion-auxpow/0.1", null]
        });
        let resp = self.send_request(&req).await?;
        if resp.get("result").is_some() {
            *self.subscribed.lock().await = true;
            println!("auxpow: subscribed to {} — result={}", self.profile.coin, resp.get("result").unwrap_or(&serde_json::Value::Null));
            Ok(())
        } else {
            bail!("subscribe failed: {:?}", resp.get("error"));
        }
    }

    /// Send `mining.authorize` with wallet.worker name.
    /// For zpool coins, password is `c=BTC` to force BTC payout.
    /// For 2miners coins, password is ignored (send `c=BTC` anyway, harmless).
    async fn authorize(&self, payout_wallet: &str) -> Result<()> {
        let worker = format!("{}.{}", payout_wallet, self.profile.worker_name);
        let password = "c=BTC";
        println!(
            "auxpow: authorizing worker={} password={} on {}",
            worker, password, self.profile.coin
        );
        let req = json!({
            "id": 2,
            "method": "mining.authorize",
            "params": [worker, password]
        });
        let resp = self.send_request(&req).await?;
        let ok = resp
            .get("result")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if ok {
            *self.authorized.lock().await = true;
            println!("auxpow: authorized as {} on {}", worker, self.profile.coin);
            Ok(())
        } else {
            let err = resp.get("error");
            println!(
                "auxpow: authorize FAILED for {} on {} — result={:?} error={:?}",
                worker,
                self.profile.coin,
                resp.get("result"),
                err
            );
            bail!("authorize failed: {:?}", err);
        }
    }

    /// Send a JSON-RPC request and read the response.
    /// Skips notifications (messages with `method` field) until it finds
    /// a response with matching `id`.
    async fn send_request(&self, req: &Value) -> Result<Value> {
        let req_id = req.get("id").cloned();
        let mut line = serde_json::to_string(req)?;
        line.push('\n');

        {
            let mut stream_guard = self.stream.lock().await;
            if let Some(ref mut stream) = *stream_guard {
                stream.write_all(line.as_bytes()).await?;
                stream.flush().await?;
            } else {
                bail!("not connected");
            }
        }

        // Read lines until we find a response with matching id.
        // Pools may send notifications (mining.set_difficulty, mining.notify)
        // between our request and the response — skip those.
        loop {
            let resp = self.read_line().await?;
            let value: Value = serde_json::from_str(&resp)?;

            // Check if this is a notification (has "method" field, no matching id)
            if value.get("method").is_some() {
                // It's a notification — dispatch it and keep reading
                debug!("AuxPow: skipping notification during request: {}", value.get("method").unwrap_or(&serde_json::Value::Null));
                // Handle the notification inline
                if let Some(method) = value.get("method").and_then(|m| m.as_str()) {
                    if method == "mining.notify" {
                        if let Some(params) = value.get("params") {
                            if let Ok(job) = self.parse_notify_params(params) {
                                *self.current_job.lock().await = Some(job);
                                self.job_notify.notify_waiters();
                            }
                        }
                    }
                }
                continue;
            }

            // Check if id matches (if request has an id)
            if let Some(ref expected_id) = req_id {
                if let Some(resp_id) = value.get("id") {
                    if resp_id == expected_id {
                        return Ok(value);
                    }
                    // Different id — keep reading (shouldn't happen normally)
                    debug!("AuxPow: skipping response with mismatched id");
                    continue;
                }
            }

            // No id in request (shouldn't happen for our requests) — return first non-notification
            return Ok(value);
        }
    }

    /// Read a single line from the stratum stream.
    async fn read_line(&self) -> Result<String> {
        let mut guard = self.reader.lock().await;
        if let Some(ref mut reader) = *guard {
            let mut buf = String::new();
            reader.read_line(&mut buf).await?;
            if buf.is_empty() {
                bail!("connection closed by remote");
            }
            Ok(buf.trim().to_string())
        } else {
            bail!("no reader available");
        }
    }

    /// Read and dispatch incoming messages (jobs, etc.).
    /// Call this in a loop in a background task.
    pub async fn poll_messages(&self) -> Result<()> {
        let line = self.read_line().await?;
        let msg: Value = serde_json::from_str(&line)?;

        // Check if this is a notification (no "id" or id is null)
        let method = msg.get("method").and_then(|m| m.as_str());

        if let Some(method) = method {
            match method {
                "mining.notify" => {
                    if let Some(params) = msg.get("params") {
                        let job = self.parse_notify_params(params)?;
                        debug!(
                            "AuxPow: received job {} for {}",
                            job.job_id, self.profile.coin
                        );
                        *self.current_job.lock().await = Some(job);
                        self.job_notify.notify_waiters();
                    }
                }
                "mining.set_difficulty" => {
                    if let Some(params) = msg.get("params") {
                        if let Some(diff) = params.get(0).and_then(|d| d.as_f64()) {
                            debug!("AuxPow: difficulty set to {:.2} for {}", diff, self.profile.coin);
                        }
                    }
                }
                _ => {
                    debug!("AuxPow: unknown method '{}' from {}", method, self.profile.coin);
                }
            }
        }

        Ok(())
    }

    /// Parse `mining.notify` params into an `ExternalJob`.
    fn parse_notify_params(&self, params: &Value) -> Result<ExternalJob> {
        // Stratum v1 mining.notify params:
        // [job_id, prevhash, coinbase1, coinbase2, branches, version, nbits, ntime, clean_jobs]
        //
        // For Blake3 coins (DCR/ALPH), the format may differ.
        // We store the raw params and let the hasher extract what it needs.
        //
        // Simplified: we take job_id and the first hex string as header,
        // and nbits as target.

        let arr = params
            .as_array()
            .ok_or_else(|| anyhow!("notify params not array"))?;

        if arr.is_empty() {
            bail!("empty notify params");
        }

        let job_id = arr[0]
            .as_str()
            .unwrap_or("unknown")
            .to_string();

        // For DCR/ALPH stratum, params typically are:
        // [job_id, header_hex, target_hex]
        // or the standard format above.
        //
        // We try both formats.
        let (header_hex, target_hex) = if arr.len() >= 3 {
            // Try simplified format: [job_id, header, target]
            let h = arr[1].as_str().unwrap_or("");
            let t = arr[2].as_str().unwrap_or("");
            if !h.is_empty() && !t.is_empty() && h.len() > 32 {
                (h.to_string(), t.to_string())
            } else {
                // Standard format: extract nbits as target
                let nbits = arr
                    .get(6)
                    .and_then(|v| v.as_str())
                    .unwrap_or("ffffffff");
                (arr[1].as_str().unwrap_or("").to_string(), nbits.to_string())
            }
        } else {
            bail!("insufficient notify params");
        };

        let header_bytes = hex::decode(header_hex.trim_start_matches("0x"))
            .unwrap_or_default();
        let target_bytes = crate::external_hashers::parse_target_hex(&target_hex)
            .unwrap_or([0xFFu8; 32]);

        Ok(ExternalJob {
            job_id,
            header_hex,
            target_hex,
            seed_hash: None,
            block_number: None,
            algorithm: self.profile.algorithm.clone(),
            header_bytes,
            target_bytes,
        })
    }

    /// Get the current job, if any.
    pub async fn current_job(&self) -> Option<ExternalJob> {
        self.current_job.lock().await.clone()
    }

    /// Wait for a new job with timeout.
    pub async fn wait_for_job(&self, timeout_ms: u64) -> Result<Option<ExternalJob>> {
        let result = timeout(
            Duration::from_millis(timeout_ms),
            self.job_notify.notified(),
        )
        .await;
        if result.is_ok() {
            Ok(self.current_job().await)
        } else {
            Ok(None)
        }
    }

    /// Submit a share to the pool.
    ///
    /// Returns whether the pool accepted or rejected the share.
    pub async fn submit_share(
        &self,
        job_id: &str,
        nonce: u64,
        hash_hex: &str,
    ) -> Result<ShareResult> {
        let nonce_hex = format!("{:016x}", nonce);
        let req = json!({
            "id": 100,
            "method": "mining.submit",
            "params": [self.profile.worker_name.clone(), job_id, nonce_hex, hash_hex]
        });

        let resp = self.send_request(&req).await?;

        let accepted = resp
            .get("result")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if accepted {
            debug!("AuxPow: share accepted for {}", self.profile.coin);
            Ok(ShareResult::Accepted)
        } else if let Some(err) = resp.get("error") {
            if err.is_null() {
                return Ok(ShareResult::Unknown);
            }
            let reason = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown");
            warn!("AuxPow: share rejected for {}: {}", self.profile.coin, reason);
            Ok(ShareResult::Rejected(reason.to_string()))
        } else {
            Ok(ShareResult::Unknown)
        }
    }

    /// Check if the client is connected.
    pub async fn is_connected(&self) -> bool {
        *self.connected.lock().await
    }

    /// Disconnect from the pool.
    pub async fn disconnect(&self) -> Result<()> {
        *self.stream.lock().await = None;
        *self.reader.lock().await = None;
        *self.connected.lock().await = false;
        *self.subscribed.lock().await = false;
        *self.authorized.lock().await = false;
        self.shutdown.notify_waiters();
        info!("AuxPow: disconnected from {}", self.profile.coin);
        Ok(())
    }

    /// Get the coin profile.
    pub fn profile(&self) -> &CoinProfile {
        &self.profile
    }

    /// Get the protocol variant.
    pub fn protocol(&self) -> StratumProtocol {
        self.protocol
    }
}

impl StratumProtocol {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stratum => "stratum",
            Self::EthStratum => "ethstratum",
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// Mock stratum server for testing.
    struct MockStratumServer {
        listener: TcpListener,
    }

    impl MockStratumServer {
        async fn bind() -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            Self { listener }
        }

        fn addr(&self) -> String {
            self.listener.local_addr().unwrap().to_string()
        }

        /// Run the mock server: accept one connection, handle subscribe + authorize,
        /// send a notify, then handle submit.
        async fn run(self, accept_share: bool) {
            let (mut socket, _) = self.listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 4096];

            // Read subscribe
            let n = reader.read(&mut buf).await.unwrap();
            let subscribe_req: Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(subscribe_req["method"], "mining.subscribe");

            // Send subscribe response
            let subscribe_resp = json!({
                "id": 1,
                "result": [["mining.set_difficulty", "subscription_id"], 4],
                "error": null
            });
            let resp_str = serde_json::to_string(&subscribe_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Read authorize
            let n = reader.read(&mut buf).await.unwrap();
            let auth_req: Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(auth_req["method"], "mining.authorize");

            // Send authorize response
            let auth_resp = json!({
                "id": 2,
                "result": true,
                "error": null
            });
            let resp_str = serde_json::to_string(&auth_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Send mining.notify
            let notify = json!({
                "id": null,
                "method": "mining.notify",
                "params": ["job_001", "aabbccdd", "0000ffff"]
            });
            let notify_str = serde_json::to_string(&notify).unwrap() + "\n";
            writer.write_all(notify_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Read submit
            let n = reader.read(&mut buf).await.unwrap();
            let submit_req: Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(submit_req["method"], "mining.submit");

            // Send submit response
            let submit_resp = if accept_share {
                json!({ "id": 100, "result": true, "error": null })
            } else {
                json!({
                    "id": 100,
                    "result": false,
                    "error": { "code": -1, "message": "Low difficulty share" }
                })
            };
            let resp_str = serde_json::to_string(&submit_resp).unwrap() + "\n";
            writer.write_all(resp_str.as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Keep connection alive briefly
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    #[tokio::test]
    async fn client_connect_subscribe_authorize() {
        let mock = MockStratumServer::bind().await;
        let addr = mock.addr();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let mock_task = tokio::spawn(async move {
            mock.run(true).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::DCR);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = AuxPowClient::new(profile);
        client.connect("bc1qtestwallet").await.unwrap();

        assert!(client.is_connected().await);

        // Wait for job notification
        tokio::time::sleep(Duration::from_millis(50)).await;
        client.poll_messages().await.unwrap();

        let job = client.current_job().await;
        assert!(job.is_some());
        let job = job.unwrap();
        assert_eq!(job.job_id, "job_001");

        // Submit a share
        let result = client
            .submit_share("job_001", 42, "abcdef0123456789")
            .await
            .unwrap();
        assert_eq!(result, ShareResult::Accepted);

        client.disconnect().await.unwrap();

        mock_task.await.unwrap();
    }

    #[tokio::test]
    async fn client_rejected_share() {
        let mock = MockStratumServer::bind().await;
        let addr = mock.addr();
        let (host, port) = addr.rsplit_once(':').unwrap();
        let port: u16 = port.parse().unwrap();

        let mock_task = tokio::spawn(async move {
            mock.run(false).await;
        });

        let mut profile = CoinProfile::default_for(ExternalCoin::DCR);
        profile.pool_host = host.to_string();
        profile.pool_port = port;

        let client = AuxPowClient::new(profile);
        client.connect("bc1qtestwallet").await.unwrap();

        tokio::time::sleep(Duration::from_millis(50)).await;
        client.poll_messages().await.unwrap();

        let result = client
            .submit_share("job_001", 42, "abcdef0123456789")
            .await
            .unwrap();

        match result {
            ShareResult::Rejected(reason) => {
                assert!(reason.contains("Low difficulty"));
            }
            _ => panic!("expected Rejected, got {:?}", result),
        }

        client.disconnect().await.unwrap();
        mock_task.await.unwrap();
    }

    #[test]
    fn protocol_mapping() {
        assert_eq!(ExternalCoin::DCR.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ALPH.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::KAS.protocol(), StratumProtocol::Stratum);
        assert_eq!(ExternalCoin::ETC.protocol(), StratumProtocol::EthStratum);
        assert_eq!(ExternalCoin::RVN.protocol(), StratumProtocol::EthStratum);
    }

    #[test]
    fn protocol_as_str() {
        assert_eq!(StratumProtocol::Stratum.as_str(), "stratum");
        assert_eq!(StratumProtocol::EthStratum.as_str(), "ethstratum");
    }
}
