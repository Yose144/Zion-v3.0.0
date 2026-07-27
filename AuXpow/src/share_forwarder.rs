//! B2b share forwarder.
//!
//! Validates that a miner-computed hash meets the external target and, if so,
//! forwards the share to the active external Stratum pool.  This is the second
//! half of the B2b flow: the ZION pool collects work, the miner computes it,
//! and the pool forwards only valid shares upstream.

use anyhow::Result;
use std::sync::Arc;

use crate::auxpow_client::{AuxPowClient, ShareResult};
use crate::external_hashers::{
    ethash_final_hash, ethash_header_hash, hash_blake3, hash_to_hex, meets_randomx_target,
    meets_target, meets_target_little_endian, progpow_final_hash,
};
use crate::types::{ExternalCoin, ShareForwardResult};

/// DAG-based algorithms whose GPU kernel only produces a u64 pre-check value
/// (keccak_f800) and does NOT write the full 32-byte final hash.  For these
/// algorithms the miner sets the hash field to all zeros and the pool must
/// recompute the real final hash from header + nonce + mix_hash before
/// submitting upstream.
fn is_dag_algorithm(algo: &str) -> bool {
    matches!(
        algo,
        "ethash"
            | "etchash"
            | "ethash_etc"
            | "kawpow"
            | "kawpow_rvn"
            | "kawpow_clore"
            | "kawpow_evr"
            | "kawpow_mewc"
            | "evrprogpow"
            | "evrprogpow_evr"
            | "meowpow"
            | "meowpow_mewc"
            | "progpow"
            | "progpow_epic"
            | "progpowz"
            | "progpow_zano"
    )
}

/// ProgPow variants that use keccak-f800 for the final hash (instead of
/// Ethash's keccak-512/256). EPIC and Zano share the 0.9.2 structure but
/// Zano uses a permuted math op table.
fn is_progpow_algorithm(algo: &str) -> bool {
    matches!(algo, "progpow" | "progpow_epic" | "progpowz" | "progpow_zano")
}

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
    ///
    /// For DAG algorithms (ProgPow/Ethash/KawPow) the GPU kernel only produces
    /// a u64 pre-check value and the `hash` field is all zeros.  When
    /// `algorithm` is a DAG algo, `header_bytes` and `mix_hash` are used to
    /// recompute the real final hash via `keccak256(keccak512(header || nonce)
    /// || mix_hash)` and that real hash is what gets verified against the
    /// target and submitted upstream.
    pub async fn try_forward(
        &self,
        job_id: &str,
        nonce: u64,
        hash: &[u8; 32],
        target: &[u8; 32],
        mix_hash: Option<&[u8; 32]>,
        algorithm: &str,
        header_bytes: &[u8],
    ) -> Result<ShareForwardResult> {
        // For DAG algorithms, recompute the real final hash from
        // header + nonce + mix_hash.  The GPU kernel's u64 pre-check
        // (keccak_f800) can produce false positives, so we verify the full
        // 32-byte hash here before submitting upstream.  This eliminates
        // "low difficulty" rejections from the upstream pool.
        let (effective_hash, recomputed) = if is_dag_algorithm(algorithm) {
            if let Some(mix) = mix_hash {
                if !header_bytes.is_empty() {
                    let header_hash = ethash_header_hash(header_bytes);
                    let real_hash = if is_progpow_algorithm(algorithm) {
                        progpow_final_hash(&header_hash, nonce, mix)
                    } else {
                        ethash_final_hash(&header_hash, nonce, mix)
                    };
                    if real_hash != *hash {
                        println!(
                            "auxpow: dag_hash_recomputed algo={} nonce={} kernel_hash={:.16} real_hash={:.16} mix={:.16}",
                            algorithm, nonce,
                            hash_to_hex(hash),
                            hash_to_hex(&real_hash),
                            hash_to_hex(mix),
                        );
                    }
                    (real_hash, true)
                } else {
                    // No header bytes available — fall back to the kernel hash.
                    (*hash, false)
                }
            } else {
                // No mix hash — can't recompute.  Fall back to the kernel hash.
                (*hash, false)
            }
        } else {
            (*hash, false)
        };

        let meets = if self.client.profile().coin == ExternalCoin::XMR {
            let h_msb = u64::from_le_bytes(effective_hash[24..32].try_into().unwrap());
            let t_le = u64::from_le_bytes(target[..8].try_into().unwrap());
            let hash_hex_full = hash_to_hex(&effective_hash);
            println!(
                "auxpow: XMR try_forward job_id={} nonce={} hash_msb=0x{:016x} target_le=0x{:016x} meets={} hash_hex={}",
                job_id, nonce, h_msb, t_le, h_msb < t_le, hash_hex_full
            );
            meets_randomx_target(&effective_hash, target)
        } else if self.client.profile().coin == ExternalCoin::DCR {
            // Decred BLAKE3 (DCP-0011) interprets the PoW hash as a
            // little-endian integer when comparing against the target.
            meets_target_little_endian(&effective_hash, target)
        } else if self.client.profile().coin == ExternalCoin::VRSC {
            // VerusHash v2.2: professional pools (node-stratum-pool-verus /
            // LuckPool) interpret the 32-byte hash as a little-endian integer.
            meets_target_little_endian(&effective_hash, target)
        } else if self.client.profile().coin == ExternalCoin::RTM {
            // GhostRider (Raptoreum): wrapper outputs hash in LE (gr_hash order,
            // same as yiimp's hash_bin), target from pool is BE.
            // yiimp's validation has two checks:
            //   1. Error 25 sanity: hash[30] | hash[31] must be 0 (hash < 2^240)
            //   2. Target: get_hash_difficulty(hash) <= get_hash_difficulty(target)
            //      where get_hash_difficulty reads bytes 22-29 as LE uint64.
            // A full 256-bit LE<=BE comparison is equivalent when both top bytes
            // of the hash are zero (which check 1 enforces).
            let pfx = effective_hash[30] | effective_hash[31];
            let meets_rtm = pfx == 0 && meets_target_little_endian(&effective_hash, target);
            println!(
                "auxpow: RTM try_forward job_id={} nonce={} meets={} pfx=0x{:02x} hash_hex={:.16} target_hex={:.16}",
                job_id, nonce, meets_rtm, pfx,
                hash_to_hex(&effective_hash),
                hash_to_hex(target),
            );
            meets_rtm
        } else {
            // Most other external algorithms compare hash and target as
            // big-endian 256-bit integers.
            meets_target(&effective_hash, target)
        };
        if !meets {
            if recomputed {
                println!(
                    "auxpow: dag_share_below_real_target algo={} nonce={} real_hash={:.16} target={:.16} — GPU kernel u64 pre-check false positive, dropping",
                    algorithm, nonce,
                    hash_to_hex(&effective_hash),
                    hash_to_hex(target),
                );
            }
            // For testing: bypass target check if ZION_AUXPOW_BYPASS_TARGET=1
            if !std::env::var("ZION_AUXPOW_BYPASS_TARGET")
                .as_deref()
                .unwrap_or("")
                .eq_ignore_ascii_case("1")
            {
                return Ok(ShareForwardResult::BelowTarget);
            }
        }
        // For DAG algorithms, submit the real recomputed hash (not zeros) so
        // the upstream pool's own verification matches our pre-check.
        let hash_hex = hash_to_hex(&effective_hash);
        let mix_hash_hex = mix_hash.map(hash_to_hex);

        // Stale-job pre-rejection for CPU-only coins (XMR/VRSC/RTM).  These
        // pools expire jobs very quickly; forwarding a share for a superseded
        // job wastes a round-trip and inflates the reject rate.
        if self.client.profile().coin.is_cpu() {
            if let Some(current) = self.client.current_job().await {
                if current.job_id != job_id {
                    println!(
                        "auxpow: {} stale share pre-rejected job_id={} current_job_id={}",
                        self.client.profile().coin, job_id, current.job_id
                    );
                    return Ok(ShareForwardResult::Rejected("stale job".to_string()));
                }
            }
        }

        match self.client.submit_share(job_id, nonce, &hash_hex, mix_hash_hex.as_deref()).await {
            Ok(ShareResult::Accepted) => Ok(ShareForwardResult::Accepted),
            Ok(ShareResult::Rejected(reason)) => Ok(ShareForwardResult::Rejected(reason)),
            Ok(ShareResult::Unknown) => Ok(ShareForwardResult::Unknown),
            Ok(ShareResult::NoShare) => Ok(ShareForwardResult::Unknown),
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
        self.try_forward(job_id, nonce, &hash, target, None, "blake3", &[]).await
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
        let result = forwarder.try_forward("job_forward", 0, &hash, &target, None, "blake3", &[]).await.unwrap();
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
        let result = forwarder.try_forward("job_forward", 42, &hash, &target, None, "blake3", &[]).await.unwrap();
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
        let result = forwarder.try_forward("job_forward", 7, &hash, &target, None, "blake3", &[]).await.unwrap();
        assert_eq!(result, ShareForwardResult::Rejected("low diff".to_string()));
    }

    /// ETC (Ethash) DAG share forwarding: verify that the pool-side
    /// `ethash_final_hash` recompute path works for ETC headers.
    ///
    /// When the GPU kernel produces a false positive (hash=zeros that
    /// passes the u64 pre-check), the share forwarder should:
    /// 1. Recompute the real final hash from header + nonce + mix_hash
    /// 2. Compare the real hash against the target
    /// 3. Drop the share as BelowTarget if the real hash doesn't meet target
    #[tokio::test]
    async fn etc_dag_false_positive_dropped() {
        let server = MockStratumServer::bind().await;
        let addr = server.addr();
        tokio::spawn(server.run(true));

        let profile = profile_for_mock(ExternalCoin::ETC, &addr);
        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("bc1qtest").await.unwrap();
        let _ = client.wait_for_job(200).await;

        let forwarder = ShareForwarder::new(client);

        // Simulate a GPU kernel false positive:
        // - kernel hash = all zeros (passes u64 pre-check trivially)
        // - mix_hash = some value
        // - header_bytes = 32-byte ETC header hash
        // The real ethash_final_hash will be computed from these, and if
        // it doesn't meet the target, the share should be dropped.
        let kernel_hash = [0u8; 32]; // GPU kernel false positive
        let mix_hash = [0x42u8; 32];
        let header_bytes = [0x11u8; 32]; // ETC header hash
        let mut target = [0x00u8; 32];
        target[31] = 0x01; // very hard target — real hash won't meet it

        let result = forwarder
            .try_forward("etc_job_001", 0x1234, &kernel_hash, &target, Some(&mix_hash), "ethash", &header_bytes)
            .await
            .unwrap();

        // The real hash won't meet the hard target → BelowTarget
        assert_eq!(result, ShareForwardResult::BelowTarget);
    }

    /// ETC (Ethash) DAG share with trivial target: the recomputed hash
    /// should be submitted upstream (not the kernel zeros).
    #[tokio::test]
    async fn etc_dag_real_hash_forwarded() {
        let server = MockStratumServer::bind().await;
        let addr = server.addr();
        tokio::spawn(server.run(true));

        let profile = profile_for_mock(ExternalCoin::ETC, &addr);
        let client = Arc::new(AuxPowClient::new(profile));
        client.connect("bc1qtest").await.unwrap();
        let _ = client.wait_for_job(200).await;

        let forwarder = ShareForwarder::new(client);

        let kernel_hash = [0u8; 32]; // GPU kernel false positive (zeros)
        let mix_hash = [0x42u8; 32];
        let header_bytes = [0x11u8; 32];
        let target = [0xFFu8; 32]; // trivial target — any hash meets it

        let result = forwarder
            .try_forward("etc_job_001", 0x1234, &kernel_hash, &target, Some(&mix_hash), "ethash", &header_bytes)
            .await
            .unwrap();

        // With trivial target, the recomputed hash should be accepted
        assert_eq!(result, ShareForwardResult::Accepted);
    }
}
