//! Merged / Byproduct Mining (CHv3) — safe scaffolding
//!
//! Goal:
//! - Enable "4-layer streams" WITHOUT time-switching.
//! - CHv3 pipeline already computes Keccak-256 and SHA3-512; we can export
//!   those intermediates as *signals* (and later as real aux/merged streams).
//!
//! Safety constraints:
//! - MUST NOT affect share validity / consensus.
//! - MUST be optional and cheap (sampling + no external submits).
//! - Default: enabled only if explicitly opted-in via env.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use serde_json::json;
use zion_cosmic_harmony_v3::algorithms_opt;

use crate::metrics::prometheus as metrics;

#[derive(Debug)]
pub struct MergedMiningManager {
    enabled: bool,
    /// Only compute intermediates every N valid CHv3 shares (avoid overhead).
    sample_every: u64,
    /// Leading-zero bits threshold for a "hit" signal.
    keccak_hit_zeros: u32,
    sha3_hit_zeros: u32,

    chv3_valid_seen: AtomicU64,
    samples_taken: AtomicU64,
    keccak_hits: AtomicU64,
    sha3_hits: AtomicU64,
}

impl MergedMiningManager {
    pub fn from_env() -> Arc<Self> {
        let enabled = std::env::var("ZION_MERGED_MINING")
            .map(|v| {
                let v = v.trim().to_ascii_lowercase();
                v == "1" || v == "true" || v == "yes"
            })
            .unwrap_or(false);

        let sample_every = std::env::var("ZION_MERGED_SAMPLE_EVERY")
            .ok()
            .and_then(|v| v.trim().parse::<u64>().ok())
            .filter(|&n| n > 0)
            .unwrap_or(25);

        let keccak_hit_zeros = std::env::var("ZION_MERGED_KECCAK_ZEROS")
            .ok()
            .and_then(|v| v.trim().parse::<u32>().ok())
            .unwrap_or(24);

        let sha3_hit_zeros = std::env::var("ZION_MERGED_SHA3_ZEROS")
            .ok()
            .and_then(|v| v.trim().parse::<u32>().ok())
            .unwrap_or(24);

        Arc::new(Self {
            enabled,
            sample_every,
            keccak_hit_zeros,
            sha3_hit_zeros,
            chv3_valid_seen: AtomicU64::new(0),
            samples_taken: AtomicU64::new(0),
            keccak_hits: AtomicU64::new(0),
            sha3_hits: AtomicU64::new(0),
        })
    }

    pub fn enabled(&self) -> bool {
        self.enabled
    }

    /// Observe a *valid* CHv3 share and optionally compute intermediates.
    ///
    /// `job_blob` must be hex string (may include 0x prefix).
    pub fn observe_valid_chv3_share(&self, job_blob: &str, nonce_hex: &str, height: u64) {
        if !self.enabled {
            return;
        }

        let seen = self.chv3_valid_seen.fetch_add(1, Ordering::Relaxed) + 1;

        // Sampling gate
        if self.sample_every > 1 && !seen.is_multiple_of(self.sample_every) {
            return;
        }

        // Parse nonce (share format uses u32 encoded as hex)
        let nonce_u64 = u64::from(u32::from_str_radix(nonce_hex, 16).unwrap_or(0));

        let blob_hex = job_blob.trim_start_matches("0x");
        let Ok(blob) = hex::decode(blob_hex) else {
            return;
        };

        let (_final_hash, inter) =
            algorithms_opt::cosmic_harmony_v3_with_height_intermediates(&blob, nonce_u64, height);

        self.samples_taken.fetch_add(1, Ordering::Relaxed);
        metrics::inc_chv3_byproduct_samples();

        // "Hit" signals (distribution sanity + future aux difficulty mapping)
        let keccak_zeros = leading_zero_bits_be(&inter.keccak256.data);
        if keccak_zeros >= self.keccak_hit_zeros {
            self.keccak_hits.fetch_add(1, Ordering::Relaxed);
            metrics::inc_chv3_byproduct_keccak_hits();
        }

        // SHA3 is 64B; use MSB-first over full 64 bytes
        let sha3_zeros = leading_zero_bits_be(&inter.sha3_512.data);
        if sha3_zeros >= self.sha3_hit_zeros {
            self.sha3_hits.fetch_add(1, Ordering::Relaxed);
            metrics::inc_chv3_byproduct_sha3_hits();
        }
    }

    pub fn stats_json(&self) -> serde_json::Value {
        json!({
            "enabled": self.enabled,
            "sample_every": self.sample_every,
            "keccak_hit_zeros": self.keccak_hit_zeros,
            "sha3_hit_zeros": self.sha3_hit_zeros,
            "chv3_valid_seen": self.chv3_valid_seen.load(Ordering::Relaxed),
            "samples_taken": self.samples_taken.load(Ordering::Relaxed),
            "keccak_hits": self.keccak_hits.load(Ordering::Relaxed),
            "sha3_hits": self.sha3_hits.load(Ordering::Relaxed),
        })
    }
}

#[inline]
fn leading_zero_bits_be(bytes: &[u8]) -> u32 {
    let mut zeros = 0u32;
    for &b in bytes {
        if b == 0 {
            zeros += 8;
            continue;
        }
        zeros += b.leading_zeros();
        break;
    }
    zeros
}
