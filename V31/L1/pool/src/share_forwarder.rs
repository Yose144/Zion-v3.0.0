use std::sync::Arc;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use zion_cosmic_harmony::ExternalCoin;
use zion_miner::auxpow::hasher::{hash_for_coin, meets_target};
use zion_miner::auxpow::{Share as AuxShare, StratumClient};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShareForwardResult {
    BelowTarget,
    Accepted,
    Rejected(String),
    Unknown,
    NotConnected,
}

fn hash_to_hex(hash: &[u8; 32]) -> String {
    hex::encode(hash)
}

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

pub struct ShareForwarder {
    client: Arc<StratumClient>,
    coin: ExternalCoin,
}

impl ShareForwarder {
    pub fn new(client: Arc<StratumClient>, coin: ExternalCoin) -> Self {
        Self { client, coin }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn try_forward(
        &self,
        job_id: &str,
        nonce: u64,
        hash: &[u8; 32],
        target: &[u8; 32],
        mix_hash: Option<&[u8; 32]>,
        solution: Option<&[u8]>,
        algorithm: &str,
        header_bytes: &[u8],
    ) -> Result<ShareForwardResult> {
        let (effective_hash, recomputed) = if is_dag_algorithm(algorithm) {
            if let Some(_mix) = mix_hash {
                if !header_bytes.is_empty() {
                    let real_hash = hash_for_coin(self.coin, header_bytes, nonce);
                    if real_hash != *hash {
                        tracing::debug!(
                            "auxpow: dag_hash_recomputed algo={} nonce={} kernel_hash={:.16} real_hash={:.16}",
                            algorithm, nonce,
                            hash_to_hex(hash),
                            hash_to_hex(&real_hash),
                        );
                    }
                    (real_hash, true)
                } else {
                    (*hash, false)
                }
            } else {
                (*hash, false)
            }
        } else {
            (*hash, false)
        };

        let meets = if self.coin == ExternalCoin::Monero {
            let h_msb = u64::from_le_bytes(effective_hash[24..32].try_into().unwrap());
            let t_le = u64::from_le_bytes(target[..8].try_into().unwrap());
            tracing::debug!(
                "auxpow: XMR try_forward job_id={} nonce={} hash_msb=0x{:016x} target_le=0x{:016x} meets={}",
                job_id, nonce, h_msb, t_le, h_msb < t_le,
            );
            meets_target(&effective_hash, target)
        } else {
            meets_target(&effective_hash, target)
        };

        if !meets {
            if recomputed {
                tracing::debug!(
                    "auxpow: dag_share_below_real_target algo={} nonce={} real_hash={:.16} target={:.16}",
                    algorithm, nonce,
                    hash_to_hex(&effective_hash),
                    hash_to_hex(target),
                );
            }
            if !std::env::var("ZION_AUXPOW_BYPASS_TARGET")
                .as_deref()
                .unwrap_or("")
                .eq_ignore_ascii_case("1")
            {
                return Ok(ShareForwardResult::BelowTarget);
            }
        }

        let _hash_hex = hash_to_hex(&effective_hash);
        let _mix_hash_hex = mix_hash.map(hash_to_hex);
        let _solution_hex = solution.map(hex::encode);

        let share = AuxShare {
            job_id: job_id.to_string(),
            coin: self.coin,
            nonce,
            hash: effective_hash,
            extranonce2: "00".to_string(),
            ntime: "00000000".to_string(),
        };

        match self.client.submit_share(&share).await {
            Ok(()) => Ok(ShareForwardResult::Accepted),
            Err(e) => {
                tracing::warn!("auxpow: submit_share error: {e}");
                Ok(ShareForwardResult::Unknown)
            }
        }
    }

    pub async fn try_forward_blake3(
        &self,
        job_id: &str,
        header: &[u8],
        nonce: u64,
        target: &[u8; 32],
    ) -> Result<ShareForwardResult> {
        let hash = hash_for_coin(self.coin, header, nonce);
        self.try_forward(job_id, nonce, &hash, target, None, None, "blake3", &[])
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn below_target_not_forwarded() {
        let hash = [0xFFu8; 32];
        let mut target = [0x00u8; 32];
        target[31] = 0x01;
        assert!(!meets_target(&hash, &target));
    }

    #[test]
    fn meeting_target_passes() {
        let hash = [0x00u8; 32];
        let target = [0xFFu8; 32];
        assert!(meets_target(&hash, &target));
    }

    #[test]
    fn dag_algorithm_detection() {
        assert!(is_dag_algorithm("ethash"));
        assert!(is_dag_algorithm("kawpow"));
        assert!(is_dag_algorithm("progpow"));
        assert!(!is_dag_algorithm("blake3"));
        assert!(!is_dag_algorithm("kheavyhash"));
    }
}
