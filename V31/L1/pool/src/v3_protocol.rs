//! V3-compatible pool wire protocol — PoolMessage, ExternalStreamJob, encode/decode.
//!
//! Ported from V3/L1/pool/src/lib.rs (lines 49-290).
//! These types match the V3 pool protocol so that V31 can speak the same
//! wire format as V3 nodes and existing miner tooling works without modification.

use serde::{Deserialize, Serialize};

/// V3 pool protocol version string.
pub const PROTOCOL_VERSION: &str = "zion-v3-stratum/0.2";

/// Parallel external stream job — attached to ZION Job messages so the miner
/// can run an external algorithm (VRSC, KAS, ALPH, etc.) in parallel with
/// the main Deeksha Chv3 GPU pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExternalStreamJob {
    /// External coin ticker (VRSC, KAS, ALPH, DCR, RVN, ERG, ETC, etc.)
    pub coin: String,
    /// Algorithm name (verushash, kheavyhash, blake3, kawpow, etc.)
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
    /// ntime hex string from upstream pool notify (e.g. "62d12345").
    /// Used for ZcashStratum (VRSC) submit format.
    #[serde(default)]
    pub ntime_hex: String,
}

/// V3 pool wire protocol message enum.
///
/// Tagged JSON (`{"type": "hello", ...}`) — matches V3 pool protocol exactly.
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
        /// Extracted from the job notify solution field.
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
                coin: "VRSC".into(),
                algorithm: "verushash".into(),
                job_id: "ext1".into(),
                header_hex: "aabb".into(),
                target_hex: "00ff".repeat(16),
                height: 1000,
                extranonce1_hex: "".into(),
                protocol: "stratum".into(),
                seed_hash_hex: "".into(),
                timestamp: 0,
                ntime_hex: "".into(),
            }),
            external_stream_cpu: None,
        };
        let encoded = encode_message(&msg).unwrap();
        let decoded = decode_message(&encoded).unwrap();
        assert_eq!(msg, decoded);
    }

    #[test]
    fn roundtrip_coin_preference() {
        let msg = PoolMessage::CoinPreference {
            miner_id: "bob".into(),
            gpu_coin: "KAS".into(),
            cpu_coin: "VRSC".into(),
            gpu_profit_usd_day: 1.5,
            cpu_profit_usd_day: 0.8,
        };
        let encoded = encode_message(&msg).unwrap();
        let decoded = decode_message(&encoded).unwrap();
        assert_eq!(msg, decoded);
    }
}
