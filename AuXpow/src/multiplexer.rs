//! B2b pool-side job multiplexer.
//!
//! The multiplexer keeps ZION miners connected to the ZION pool, but the
//! pool itself bridges to an external Stratum pool.  It receives external
//! jobs, repackages them as [`JobPackage`], and hands them out to ZION miners
//! through the normal ZION job distribution channel.
//!
//! This is the first POC path: **pool-side job multiplexing**.  It does not
//! require any change to ZION consensus and does not redirect miners away from
//! the ZION pool.

use anyhow::{anyhow, Result};
use std::sync::Arc;
use tracing::{info, warn};

use crate::auxpow_client::{AuxPowClient, ExternalJob};
use crate::types::{split_host_port, CoinProfile, ExternalCoin, JobPackage, PoolPreference};

/// Manages a single active external connection and exposes the current job
/// as a ZION-compatible [`JobPackage`].
pub struct JobMultiplexer {
    wallet: String,
    worker_name: String,
    preference: PoolPreference,
    region: String,
    active_client: Option<Arc<AuxPowClient>>,
}

impl JobMultiplexer {
    /// Create a new multiplexer.
    pub fn new(
        wallet: impl Into<String>,
        worker_name: impl Into<String>,
    ) -> Self {
        Self {
            wallet: wallet.into(),
            worker_name: worker_name.into(),
            preference: PoolPreference::Default,
            region: "eu".to_string(),
            active_client: None,
        }
    }

    /// Apply pool preference and region used when resolving endpoints.
    pub fn with_preference(mut self, preference: PoolPreference, region: impl Into<String>) -> Self {
        self.preference = preference;
        self.region = region.into();
        self
    }

    /// Override the wallet address (used before connecting to a coin that
    /// requires a coin-specific address, e.g. DCR requires a DCR wallet).
    pub fn set_wallet(&mut self, wallet: impl Into<String>) {
        self.wallet = wallet.into();
    }

    /// Connect to the given external coin and start polling for jobs.
    ///
    /// If another coin is already active, it is disconnected first.
    pub async fn connect(&mut self, coin: ExternalCoin) -> Result<()> {
        self.disconnect().await;

        let mut profile = CoinProfile::default_for(coin);
        profile.worker_name.clone_from(&self.worker_name);

        // Optional overrides for testing / low-difficulty pools.  Production
        // deployments normally rely on CoinProfile defaults + pool preference.
        if let Ok(host) = std::env::var("ZION_POOL_AUXPOW_POOL_HOST") {
            if !host.trim().is_empty() {
                profile.pool_host = host.trim().to_string();
            }
        }
        if let Ok(port) = std::env::var("ZION_POOL_AUXPOW_POOL_PORT") {
            if let Ok(p) = port.trim().parse::<u16>() {
                profile.pool_port = p;
            }
        }
        if let Ok(password) = std::env::var("ZION_POOL_AUXPOW_POOL_PASSWORD") {
            profile.password = password;
        }
        // Per-coin password override (e.g. ZION_POOL_AUXPOW_PASSWORD_EPIC).
        let coin_pass_key = format!("ZION_POOL_AUXPOW_PASSWORD_{}", coin.ticker());
        if let Ok(password) = std::env::var(&coin_pass_key) {
            if !password.trim().is_empty() {
                profile.password = password.trim().to_string();
            }
        }
        // Apply pool preference: NiceHash → use nicehash_pool() if supported,
        // otherwise fall back to default pool for this coin.
        let (pref_host, pref_port) = split_host_port(coin.best_pool(self.preference));
        profile.pool_host = pref_host.to_string();
        profile.pool_port = pref_port;

        // Per-coin pool host/port override (e.g. ZION_POOL_AUXPOW_POOL_HOST_KAS).
        // Takes precedence over pool preference and global overrides, allowing
        // routing a specific coin to a different pool (e.g. KAS → Herominers
        // for fixed-difficulty PPLNS instead of 2miners EthereumStratum vardiff).
        let coin_host_key = format!("ZION_POOL_AUXPOW_POOL_HOST_{}", coin.ticker());
        if let Ok(host) = std::env::var(&coin_host_key) {
            if !host.trim().is_empty() {
                profile.pool_host = host.trim().to_string();
            }
        }
        let coin_port_key = format!("ZION_POOL_AUXPOW_POOL_PORT_{}", coin.ticker());
        if let Ok(port) = std::env::var(&coin_port_key) {
            if let Ok(p) = port.trim().parse::<u16>() {
                profile.pool_port = p;
            }
        }

        info!(
            "JobMultiplexer: connecting to {} at {}:{} as worker={}",
            coin, profile.pool_host, profile.pool_port, profile.worker_name
        );

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect(&self.wallet).await?;

        // AuxPowClient::connect now spawns the poll loop internally.
        self.active_client = Some(client);

        info!("JobMultiplexer: connected to {}", coin);
        Ok(())
    }

    /// Disconnect the active external client.
    pub async fn disconnect(&mut self) {
        if let Some(client) = self.active_client.take() {
            if let Err(e) = client.disconnect().await {
                warn!("JobMultiplexer: disconnect error: {}", e);
            }
        }
    }

    /// Return the currently active coin, if any.
    pub fn active_coin(&self) -> Option<ExternalCoin> {
        self.active_client
            .as_ref()
            .map(|c| c.profile().coin)
    }

    /// Return a handle to the active external client.
    pub fn client(&self) -> Option<Arc<AuxPowClient>> {
        self.active_client.clone()
    }

    /// Get the latest external job, repackaged for ZION miners.
    pub async fn current_job(&self) -> Option<JobPackage> {
        let client = self.active_client.as_ref()?;
        let job = client.current_job().await?;
        let share_target = effective_share_target(client, &job).await;
        Some(pack_job(client.profile().coin, &job, share_target))
    }

    /// Refresh the freshness timestamp for the current external job.
    /// Called by the pool server whenever it distributes an external job
    /// to a miner, so that stale-pre-rejection is anchored to the pool's
    /// distribution time rather than the upstream pool's notification cadence.
    pub async fn touch_job_timestamp(&self) {
        if let Some(client) = self.active_client.as_ref() {
            if let Some(job) = client.current_job().await {
                client.touch_job_timestamp(&job.job_id).await;
            }
        }
    }

    /// Wait for a new external job (or the first job) up to `timeout_ms`.
    pub async fn wait_for_job(&self, timeout_ms: u64) -> Result<Option<JobPackage>> {
        let client = self.active_client.as_ref().ok_or_else(|| anyhow!("not connected"))?;
        match client.wait_for_job(timeout_ms).await? {
            Some(job) => {
                let share_target = effective_share_target(client, &job).await;
                Ok(Some(pack_job(client.profile().coin, &job, share_target)))
            }
            None => Ok(None),
        }
    }
}

impl Drop for JobMultiplexer {
    fn drop(&mut self) {
        // AuxPowClient::connect spawns the poll loop internally; dropping the
        // Arc client will eventually stop it when the stream is closed.
    }
}

/// Compute the effective share target for a job.
///
/// For many external pools the share target (boundary) is sent directly in the
/// job notification.  For these algorithms we must use the job's target_bytes,
/// because `client.share_target()` is only updated by `mining.set_difficulty` /
/// `mining.set_target` and falls back to the easiest possible target when the
/// pool does not send those messages (e.g. 2miners ETC/RVN).  Using the global
/// fallback produced all-0xFF share targets and caused low-difficulty
/// "Invalid share" rejects upstream.
///
/// Coins that rely on dynamic difficulty updates keep using `client.share_target()`.
async fn effective_share_target(client: &AuxPowClient, job: &ExternalJob) -> [u8; 32] {
    let algo = client.profile().algorithm.to_ascii_lowercase();
    let uses_notify_target = matches!(
        algo.as_str(),
        "randomx" | "ghostrider" | "ethash" | "etchash" | "kawpow"
            | "evrprogpow" | "meowpow" | "progpow" | "autolykos"
    );
    if uses_notify_target {
        // Use the target from the job notification directly
        job.target_bytes
    } else {
        client.share_target().await
    }
}

fn pack_job(coin: ExternalCoin, job: &ExternalJob, share_target: [u8; 32]) -> JobPackage {
    JobPackage {
        external_coin: coin,
        external_job_id: job.job_id.clone(),
        algorithm: job.algorithm.clone(),
        header_bytes: job.header_bytes.clone(),
        target_bytes: job.target_bytes,
        share_target_bytes: share_target,
        timestamp: job.timestamp.unwrap_or(0),
        block_number: job.block_number,
        extranonce1: job.extranonce1.clone(),
        start_nonce: 0,
        nonce_count: u64::MAX,
        seed_hash: job.seed_hash.as_ref().and_then(|s| hex::decode(s.trim_start_matches("0x")).ok()),
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ExternalCoin;
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

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

        async fn run(self, accept_share: bool) {
            let (mut socket, _) = self.listener.accept().await.unwrap();
            let (mut reader, mut writer) = socket.split();
            let mut buf = vec![0u8; 4096];

            // Subscribe
            let n = reader.read(&mut buf).await.unwrap();
            let req: serde_json::Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(req["method"], "mining.subscribe");
            let resp = json!({ "id": 1, "result": [["mining.set_difficulty", "sub"], 4], "error": null });
            writer.write_all((serde_json::to_string(&resp).unwrap() + "\n").as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Authorize
            let n = reader.read(&mut buf).await.unwrap();
            let req: serde_json::Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(req["method"], "mining.authorize");
            let resp = json!({ "id": 2, "result": true, "error": null });
            writer.write_all((serde_json::to_string(&resp).unwrap() + "\n").as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Notify
            let notify = json!({
                "id": null,
                "method": "mining.notify",
                "params": ["job_dcr_001", "aabbccddeeff00112233445566778899", "0000ffff"]
            });
            writer.write_all((serde_json::to_string(&notify).unwrap() + "\n").as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            // Submit
            let n = reader.read(&mut buf).await.unwrap();
            let req: serde_json::Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(req["method"], "mining.submit");
            let resp = if accept_share {
                json!({ "id": 100, "result": true, "error": null })
            } else {
                json!({ "id": 100, "result": false, "error": { "code": -1, "message": "low diff" } })
            };
            writer.write_all((serde_json::to_string(&resp).unwrap() + "\n").as_bytes()).await.unwrap();
            writer.flush().await.unwrap();
        }
    }

    fn parse_addr(addr: &str) -> (String, u16) {
        let pos = addr.rfind(':').unwrap();
        (addr[..pos].to_string(), addr[pos + 1..].parse().unwrap())
    }

    #[tokio::test]
    async fn multiplexer_receives_job_for_dcr() {
        let server = MockStratumServer::bind().await;
        let addr = server.addr();
        tokio::spawn(server.run(true));

        let mut profile = CoinProfile::default_for(ExternalCoin::DCR);
        let (host, port) = parse_addr(&addr);
        profile.pool_host = host;
        profile.pool_port = port;

        // Use a direct client because JobMultiplexer builds its own profile.
        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("bc1qtest").await.unwrap();

        // Wait for the notify to arrive.
        let job = client.wait_for_job(2000).await.unwrap().expect("no job received");
        let package = pack_job(ExternalCoin::DCR, &job, [0xFFu8; 32]);
        assert_eq!(package.external_coin, ExternalCoin::DCR);
        assert_eq!(package.external_job_id, "job_dcr_001");
        assert_eq!(package.algorithm, "blake3");
    }

    #[tokio::test]
    async fn multiplexer_switch_connects_and_disconnects() {
        let server = MockStratumServer::bind().await;
        let addr = server.addr();
        tokio::spawn(server.run(true));

        let mut mux = JobMultiplexer::new("bc1qtest", "zion_test");
        // Build a profile pointing at the mock server, then wrap it manually
        // because `connect` uses `default_for`.  For this unit test we create
        // a client directly and inject it.
        let mut profile = CoinProfile::default_for(ExternalCoin::KAS);
        let (host, port) = parse_addr(&addr);
        profile.pool_host = host;
        profile.pool_port = port;
        profile.worker_name = "zion_test".to_string();

        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("bc1qtest").await.unwrap();
        mux.active_client = Some(client);

        let job = mux.wait_for_job(2000).await.unwrap().expect("job");
        assert_eq!(job.external_coin, ExternalCoin::KAS);

        mux.disconnect().await;
        assert!(mux.active_coin().is_none());
    }
}
