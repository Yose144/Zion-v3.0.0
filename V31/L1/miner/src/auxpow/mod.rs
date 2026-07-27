//! AuxPoW (merged mining) support merged into `zion-miner`.

pub mod client;
pub mod hasher;
pub mod scheduler;
pub mod types;

pub use client::StratumClient;
pub use scheduler::AuxPoWScheduler;
pub use types::{Job, Share};

pub use zion_cosmic_harmony::ExternalCoin;

/// Brute-force a valid nonce for an AuxPoW job. This is a CPU scaffold; real
/// mining will use the GPU backends and dedicated external kernels.
pub fn find_share(coin: ExternalCoin, job: &Job, start: u64, limit: u64) -> Option<Share> {
    for offset in 0..limit {
        let nonce = start.wrapping_add(offset);
        let hash = hasher::hash_for_coin(coin, &job.header, nonce);
        if hasher::meets_target(&hash, &job.target) {
            return Some(Share {
                job_id: job.job_id.clone(),
                coin,
                nonce,
                hash,
            });
        }
    }
    None
}
