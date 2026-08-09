//! V3 pool wire protocol — PoolMessage, ExternalStreamJob, encode/decode.
//!
//! Full port of `zion_pool::v3_protocol` to the miner side. This allows the
//! miner to receive Job messages with embedded external_stream (AuxPoW) jobs
//! and submit ExternalShare results back through the pool's AuxPoW bridge,
//! instead of connecting directly to external pools.
//!
//! Matches V3 pool protocol exactly — see `zion_pool::v3_protocol` for the
//! pool-side definition. We define it locally to avoid a cyclic dependency.

use serde::{Deserialize, Serialize};

/// V3 pool protocol version string.
pub const PROTOCOL_VERSION: &str = "zion-v3-stratum/0.2";

/// Parallel external stream job — attached to ZION Job messages so the miner
/// can run an external algorithm (VRSC, ZANO, KAS, ALPH, etc.) in parallel
/// with the main Deeksha GPU pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExternalStreamJob {
    /// External coin ticker (VRSC, ZANO, KAS, ALPH, DCR, RVN, ERG, ETC, etc.)
    pub coin: String,
    /// Algorithm name (verushash, progpow_zano, kheavyhash, blake3, kawpow, etc.)
    pub algorithm: String,
    /// External job ID (from upstream pool)
    pub job_id: String,
    /// Header/blob hex (algorithm-specific format)
    pub header_hex: String,
    /// Share target hex (32 bytes, big-endian)
    pub target_hex: String,
    /// Block height on external chain
    pub height: u64,
    /// Extranonce1 hex (for coins that use it)
    #[serde(default)]
    pub extranonce1_hex: String,
    /// Pool protocol (stratum, ethstratum, zcashstratum)
    #[serde(default)]
    pub protocol: String,
    /// Seed hash for RandomX (XMR) — 32-byte hex (64 chars).
    #[serde(default)]
    pub seed_hash_hex: String,
    /// Timestamp from upstream pool notify (KAS kheavyhash).
    #[serde(default)]
    pub timestamp: u64,
}

/// Miner → pool: coin preference for autonomous profit routing.
///
/// Sent by the miner when `ZION_AUTONOMOUS=1` to tell the pool which
/// external coins it wants to mine on Stream 2 (GPU) and Stream 3 (CPU).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CoinPreference {
    pub miner_id: String,
    #[serde(default)]
    pub gpu_coin: String,
    #[serde(default)]
    pub cpu_coin: String,
    #[serde(default)]
    pub gpu_profit_usd_day: f64,
    #[serde(default)]
    pub cpu_profit_usd_day: f64,
}

impl CoinPreference {
    /// Encode as a JSON string suitable for sending to the pool.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        Ok(serde_json::json!({
            "type": "coin_preference",
            "miner_id": self.miner_id,
            "gpu_coin": self.gpu_coin,
            "cpu_coin": self.cpu_coin,
            "gpu_profit_usd_day": self.gpu_profit_usd_day,
            "cpu_profit_usd_day": self.cpu_profit_usd_day,
        })
        .to_string())
    }
}

/// V3 pool wire protocol message enum.
///
/// Tagged JSON (`{"type": "hello", ...}`) — matches V3 pool protocol exactly.
/// The miner uses this to parse incoming Job messages (with embedded
/// external_stream jobs) and to encode Submit/ExternalSubmit messages.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[allow(clippy::large_enum_variant)]
pub enum PoolMessage {
    Hello {
        miner_id: String,
        worker_name: String,
        algorithm: String,
        #[serde(default)]
        payout_address: String,
        #[serde(default)]
        backend: String,
    },
    Welcome {
        protocol_version: String,
        algorithm: String,
        job_ttl_ms: u64,
    },
    Job {
        job_id: u64,
        algorithm: String,
        start_nonce: u64,
        nonce_count: u64,
        target_hex: String,
        header_hex: String,
        height: u64,
        #[serde(default)]
        stream_weights: String,
        #[serde(default)]
        external_stream: Option<ExternalStreamJob>,
        #[serde(default)]
        external_stream_cpu: Option<ExternalStreamJob>,
    },
    Submit {
        job_id: u64,
        miner_id: String,
        worker_name: String,
        nonce: u64,
        hash_hex: String,
        #[serde(default)]
        attempted_hashes: Option<u64>,
        #[serde(default)]
        elapsed_ms: Option<u64>,
        #[serde(default)]
        mix_hash_hex: Option<String>,
    },
    NoSolution {
        job_id: u64,
        miner_id: String,
        worker_name: String,
        #[serde(default)]
        attempted_hashes: Option<u64>,
        #[serde(default)]
        elapsed_ms: Option<u64>,
    },
    Result {
        accepted: bool,
        status: String,
        #[serde(default)]
        block_found: bool,
        #[serde(default)]
        block_height: Option<u64>,
    },
    Stale {
        job_id: u64,
    },
    Cancel {
        job_id: u64,
        reason: String,
    },
    Bye {
        accepted_shares: u64,
        rejected_shares: u64,
        revenue_total_usd: String,
    },
    SetDifficulty {
        difficulty: u64,
        target_hex: String,
    },
    ProxyRedirect {
        host: String,
        port: u16,
        coin: String,
        algorithm: String,
    },
    ShareRelay {
        miner_id: String,
        worker_name: String,
        height: u64,
        difficulty: u64,
        relay_origin: String,
    },
    ExternalSubmit {
        miner_id: String,
        worker_name: String,
        coin: String,
        algorithm: String,
        external_job_id: String,
        nonce: u64,
        hash_hex: String,
        #[serde(default)]
        mix_hash_hex: Option<String>,
        #[serde(default)]
        extranonce1_hex: String,
        /// Equihash solution hex (for ZcashStratum/VRSC submit).
        #[serde(default)]
        solution_hex: String,
        /// ntime hex from the upstream pool job notify.
        #[serde(default)]
        ntime_hex: String,
    },
    PearlSubmit {
        miner_id: String,
        worker_name: String,
        coin: String,
        algorithm: String,
        external_job_id: String,
        hash_hex: String,
        plain_proof_b64: String,
        mining_job_b64: String,
    },
    ExternalResult {
        accepted: bool,
        status: String,
        coin: String,
    },
    CoinPreference {
        miner_id: String,
        #[serde(default)]
        gpu_coin: String,
        #[serde(default)]
        cpu_coin: String,
        #[serde(default)]
        gpu_profit_usd_day: f64,
        #[serde(default)]
        cpu_profit_usd_day: f64,
    },
}

/// Encode a PoolMessage as a JSON line (with trailing newline).
pub fn encode_message(message: &PoolMessage) -> Result<String, serde_json::Error> {
    let mut line = serde_json::to_string(message)?;
    line.push('\n');
    Ok(line)
}

/// Decode a PoolMessage from a JSON line.
pub fn decode_message(line: &str) -> Result<PoolMessage, serde_json::Error> {
    serde_json::from_str(line.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_hello() {
        let msg = PoolMessage::Hello {
            miner_id: "alice".into(),
            worker_name: "rig1".into(),
            algorithm: "ekam_deeksha".into(),
            payout_address: "".into(),
            backend: "cpu".into(),
        };
        let encoded = encode_message(&msg).unwrap();
        let decoded = decode_message(&encoded).unwrap();
        assert_eq!(msg, decoded);
    }

    #[test]
    fn roundtrip_job_with_external_stream() {
        let msg = PoolMessage::Job {
            job_id: 42,
            algorithm: "ekam_deeksha".into(),
            start_nonce: 0,
            nonce_count: 1_000_000,
            target_hex: "00ff".repeat(16),
            header_hex: "deadbeef".into(),
            height: 100,
            stream_weights: "".into(),
            external_stream: Some(ExternalStreamJob {
                coin: "ZANO".into(),
                algorithm: "progpow_zano".into(),
                job_id: "ext1".into(),
                header_hex: "aabb".into(),
                target_hex: "00ff".repeat(16),
                height: 3805439,
                extranonce1_hex: "".into(),
                protocol: "ethstratum".into(),
                seed_hash_hex: "".into(),
                timestamp: 0,
            }),
            external_stream_cpu: Some(ExternalStreamJob {
                coin: "VRSC".into(),
                algorithm: "verushash".into(),
                job_id: "ext2".into(),
                header_hex: "ccdd".into(),
                target_hex: "00ff".repeat(16),
                height: 1000,
                extranonce1_hex: "".into(),
                protocol: "zcashstratum".into(),
                seed_hash_hex: "".into(),
                timestamp: 0,
            }),
        };
        let encoded = encode_message(&msg).unwrap();
        let decoded = decode_message(&encoded).unwrap();
        assert_eq!(msg, decoded);
    }

    #[test]
    fn roundtrip_external_submit() {
        let msg = PoolMessage::ExternalSubmit {
            miner_id: "vega-smos".into(),
            worker_name: "vega-smos".into(),
            coin: "ZANO".into(),
            algorithm: "progpow_zano".into(),
            external_job_id: "ext1".into(),
            nonce: 12345,
            hash_hex: "abcd".into(),
            mix_hash_hex: Some("eff0".into()),
            extranonce1_hex: "".into(),
            solution_hex: "".into(),
            ntime_hex: "".into(),
        };
        let encoded = encode_message(&msg).unwrap();
        let decoded = decode_message(&encoded).unwrap();
        assert_eq!(msg, decoded);
    }

    #[test]
    fn roundtrip_coin_preference() {
        let msg = PoolMessage::CoinPreference {
            miner_id: "bob".into(),
            gpu_coin: "ZANO".into(),
            cpu_coin: "VRSC".into(),
            gpu_profit_usd_day: 1.5,
            cpu_profit_usd_day: 0.8,
        };
        let encoded = encode_message(&msg).unwrap();
        let decoded = decode_message(&encoded).unwrap();
        assert_eq!(msg, decoded);
    }

    #[test]
    fn decode_job_from_pool() {
        // Simulate a Job message that the pool would send
        let line = r#"{"type":"job","job_id":100,"algorithm":"deeksha_lite_v1","start_nonce":0,"nonce_count":1000000,"target_hex":"0000ffff","header_hex":"aabb","height":116,"stream_weights":"","external_stream":{"coin":"ZANO","algorithm":"progpow_zano","job_id":"ext1","header_hex":"ccdd","target_hex":"00ff","height":3805439,"extranonce1_hex":"","protocol":"ethstratum","seed_hash_hex":"","timestamp":0},"external_stream_cpu":{"coin":"VRSC","algorithm":"verushash","job_id":"ext2","header_hex":"eeff","target_hex":"00ff","height":1000,"extranonce1_hex":"","protocol":"zcashstratum","seed_hash_hex":"","timestamp":0}}"#;
        let msg = decode_message(line).unwrap();
        match msg {
            PoolMessage::Job {
                external_stream,
                external_stream_cpu,
                ..
            } => {
                assert!(external_stream.is_some());
                assert!(external_stream_cpu.is_some());
                let ext = external_stream.unwrap();
                assert_eq!(ext.coin, "ZANO");
                assert_eq!(ext.algorithm, "progpow_zano");
                let ext_cpu = external_stream_cpu.unwrap();
                assert_eq!(ext_cpu.coin, "VRSC");
                assert_eq!(ext_cpu.algorithm, "verushash");
            }
            _ => panic!("expected Job message"),
        }
    }
}
