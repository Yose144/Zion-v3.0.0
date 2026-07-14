//! B2b share forwarder.
//!
//! Validates that a miner-computed hash meets the external target and, if so,
//! forwards the share to the active external Stratum pool.  This is the second
//! half of the B2b flow: the ZION pool collects work, the miner computes it,
//! and the pool forwards only valid shares upstream.

use anyhow::Result;
use std::sync::Arc;

use crate::auxpow_client::{AuxPowClient, ShareResult};
use crate::external_hashers::{hash_blake3, hash_to_hex, meets_randomx_target, meets_target, meets_target_little_endian};
use crate::types::{ExternalCoin, ShareForwardResult};

/// Forwards shares to the external pool currently selected by the multiplexer.
pub struct ShareForwarder {
    client: Arc<AuxPowClient>,
}

impl ShareForwarder {
    /// Create a forwarder bound to an external client.
    pub fn new(client: Arc<AuxPowClient>) -> Self {
        Self { client }
    }

    /// Try to forward a share.
    ///
    /// If `hash` does not meet `target`, the share is discarded as
    /// `BelowTarget`.  Otherwise the hash is submitted to the external pool.
    pub async fn try_forward(
        &self,
        job_id: &str,
        nonce: u64,
        hash: &[u8; 32],
        target: &[u8; 32],
        mix_hash: Option<&[u8; 32]>,
    ) -> Result<ShareForwardResult> {
        let meets = if self.client.profile().coin == ExternalCoin::XMR {
            meets_randomx_target(hash, target)
        } else if self.client.profile().coin == ExternalCoin::DCR {
            meets_target_little_endian(hash, target)
        } else {
            meets_target(hash, target)
        };
        if !meets {
            // For testing: bypass target check if ZION_AUXPOW_BYPASS_TARGET=1
            if !std::env::var("ZION_AUXPOW_BYPASS_TARGET")
                .as_deref()
                .unwrap_or("")
                .eq_ignore_ascii_case("1")
            {
                return Ok(ShareForwardResult::BelowTarget);
            }
        }
        let hash_hex = hash_to_hex(hash);
        let mix_hash_hex = mix_hash.map(hash_to_hex);
        match self.client.submit_share(job_id, nonce, &hash_hex, mix_hash_hex.as_deref()).await {
            Ok(ShareResult::Accepted) => Ok(ShareForwardResult::Accepted),
            Ok(ShareResult::Rejected(reason)) => Ok(ShareForwardResult::Rejected(reason)),
            Ok(ShareResult::Unknown) => Ok(ShareForwardResult::Unknown),
            Err(e) => Err(e),
        }
    }

    /// Convenience helper: hash a Blake3 header+nonce and submit if it meets target.
    pub async fn try_forward_blake3(
        &self,
        job_id: &str,
        header: &[u8],
        nonce: u64,
        target: &[u8; 32],
    ) -> Result<ShareForwardResult> {
        let hash = hash_blake3(header, 0, nonce);
        self.try_forward(job_id, nonce, &hash, target, None).await
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CoinProfile, ExternalCoin};
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

            let n = reader.read(&mut buf).await.unwrap();
            let req: serde_json::Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(req["method"], "mining.subscribe");
            let resp = json!({ "id": 1, "result": [["mining.set_difficulty", "sub"], 4], "error": null });
            writer.write_all((serde_json::to_string(&resp).unwrap() + "\n").as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            let n = reader.read(&mut buf).await.unwrap();
            let req: serde_json::Value = serde_json::from_slice(&buf[..n]).unwrap();
            assert_eq!(req["method"], "mining.authorize");
            let resp = json!({ "id": 2, "result": true, "error": null });
            writer.write_all((serde_json::to_string(&resp).unwrap() + "\n").as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

            let notify = json!({
                "id": null,
                "method": "mining.notify",
                "params": ["job_forward", "deadbeef", "0000ffff"]
            });
            writer.write_all((serde_json::to_string(&notify).unwrap() + "\n").as_bytes()).await.unwrap();
            writer.flush().await.unwrap();

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

    fn profile_for_mock(coin: ExternalCoin, addr: &str) -> CoinProfile {
        let pos = addr.rfind(':').unwrap();
        let mut profile = CoinProfile::default_for(coin);
        profile.pool_host = addr[..pos].to_string();
        profile.pool_port = addr[pos + 1..].parse().unwrap();
        profile
    }

    #[tokio::test]
    async fn share_below_target_is_not_forwarded() {
        let server = MockStratumServer::bind().await;
        let addr = server.addr();
        tokio::spawn(server.run(true));

        let profile = profile_for_mock(ExternalCoin::DCR, &addr);
        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("bc1qtest").await.unwrap();

        let forwarder = ShareForwarder::new(client);
        let hash = [0xFFu8; 32]; // definitely above target
        let mut target = [0x00u8; 32];
        target[31] = 0x01; // very hard target
        let result = forwarder.try_forward("job_forward", 0, &hash, &target, None).await.unwrap();
        assert_eq!(result, ShareForwardResult::BelowTarget);
    }

    #[tokio::test]
    async fn share_meeting_target_is_accepted() {
        let server = MockStratumServer::bind().await;
        let addr = server.addr();
        tokio::spawn(server.run(true));

        let profile = profile_for_mock(ExternalCoin::DCR, &addr);
        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("bc1qtest").await.unwrap();
        // Pull the notify so the client has a job, not strictly required.
        let _ = client.wait_for_job(200).await;

        let forwarder = ShareForwarder::new(client);
        let target = [0xFFu8; 32]; // trivial target
        let hash = hash_blake3(b"header", 0, 42);
        let result = forwarder.try_forward("job_forward", 42, &hash, &target, None).await.unwrap();
        assert_eq!(result, ShareForwardResult::Accepted);
    }

    #[tokio::test]
    async fn share_meeting_target_can_be_rejected() {
        let server = MockStratumServer::bind().await;
        let addr = server.addr();
        tokio::spawn(server.run(false));

        let profile = profile_for_mock(ExternalCoin::DCR, &addr);
        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("bc1qtest").await.unwrap();

        let forwarder = ShareForwarder::new(client);
        let target = [0xFFu8; 32];
        let hash = hash_blake3(b"header", 0, 7);
        let result = forwarder.try_forward("job_forward", 7, &hash, &target, None).await.unwrap();
        assert_eq!(result, ShareForwardResult::Rejected("low diff".to_string()));
    }
}
