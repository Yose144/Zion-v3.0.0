//! Pure-Rust Ethash/ProgPoW light-cache and DAG-size helpers.
//!
//! Shared by the CUDA and OpenCL GPU DAG managers so the light cache only
//! needs to be built once per epoch on the CPU.

use sha3::{Digest, Keccak256, Keccak512};

const DAG_CACHE_ROUNDS: usize = 3;

const CACHE_BYTES_INIT: u64 = 1 << 24; // 16 MB
const CACHE_BYTES_GROWTH: u64 = 1 << 17; // 128 KB
const HASH_BYTES: u64 = 64;
const DATASET_BYTES_INIT: u64 = 1 << 30; // 1 GB
const DATASET_BYTES_GROWTH: u64 = 1 << 23; // 8 MB
const MIX_BYTES: u64 = 128;

/// A generated Ethash/ProgPoW light cache for a single epoch.
pub struct LightCache {
    data: Vec<u8>,
    pub cache_size: u64,
    pub cache_items: u64,
    pub dag_size_entries: u64,
}

impl LightCache {
    /// Return the raw light-cache bytes.
    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }

    /// Generate the light cache for the given epoch, returning `None` on
    /// allocation failure.
    pub fn new(epoch: u32) -> Option<Self> {
        let cache_size = cache_size_for_epoch(epoch) as usize;
        let cache_items = cache_size / 64;
        let dag_size_entries = dataset_size_for_epoch(epoch) / 128;
        let seed = seed_hash_for_epoch(epoch);

        let mut data = Vec::<u8>::new();
        data.try_reserve(cache_size).ok()?;
        data.resize(cache_size, 0);

        // First item = keccak512(seed)
        {
            let mut hasher = Keccak512::new();
            hasher.update(seed);
            let hash = hasher.finalize();
            data[..64].copy_from_slice(&hash);
        }

        // Chain: each item = keccak512(prev_item)
        for i in 1..cache_items {
            let mut hasher = Keccak512::new();
            hasher.update(&data[(i - 1) * 64..i * 64]);
            let hash = hasher.finalize();
            data[i * 64..(i + 1) * 64].copy_from_slice(&hash);
        }

        // RANDMEMOHASH mixing rounds
        for _r in 0..DAG_CACHE_ROUNDS {
            for i in 0..cache_items {
                let v = u32::from_le_bytes([
                    data[i * 64],
                    data[i * 64 + 1],
                    data[i * 64 + 2],
                    data[i * 64 + 3],
                ]) % cache_items as u32;
                let prev = (i + cache_items - 1) % cache_items;

                let mut tmp = [0u8; 64];
                for j in 0..64 {
                    tmp[j] = data[prev * 64 + j] ^ data[v as usize * 64 + j];
                }

                let mut hasher = Keccak512::new();
                hasher.update(tmp);
                let hash = hasher.finalize();
                data[i * 64..(i + 1) * 64].copy_from_slice(&hash);
            }
        }

        Some(LightCache {
            data,
            cache_size: cache_size as u64,
            cache_items: cache_items as u64,
            dag_size_entries,
        })
    }
}

/// Convenience wrapper matching the API expected by the OpenCL DAG manager.
pub fn generate_light_cache(epoch: u32) -> Option<LightCache> {
    LightCache::new(epoch)
}

/// Compute the cache size for a given epoch.
///
/// Follows the Ethash/ProgPoW spec: linear growth rounded down to the largest
/// size whose number of 64-byte items is prime.
pub fn cache_size_for_epoch(epoch: u32) -> u64 {
    let mut items =
        (CACHE_BYTES_INIT + (epoch as u64) * CACHE_BYTES_GROWTH - HASH_BYTES) / HASH_BYTES;
    while !is_prime_u64(items) {
        items = items.saturating_sub(2).max(1);
    }
    items * HASH_BYTES
}

/// Compute the dataset (DAG) size for a given epoch.
///
/// Follows the Ethash/ProgPoW spec: linear growth rounded down to the largest
/// size whose number of 128-byte items is prime.
pub fn dataset_size_for_epoch(epoch: u32) -> u64 {
    let mut items =
        (DATASET_BYTES_INIT + (epoch as u64) * DATASET_BYTES_GROWTH - MIX_BYTES) / MIX_BYTES;
    while !is_prime_u64(items) {
        items = items.saturating_sub(2).max(1);
    }
    items * MIX_BYTES
}

/// Compute the seed hash for an epoch by keccak-256 chaining.
pub fn seed_hash_for_epoch(epoch: u32) -> [u8; 32] {
    let mut seed = [0u8; 32];
    for _ in 0..epoch {
        let mut hasher = Keccak256::new();
        hasher.update(seed);
        seed = hasher.finalize().into();
    }
    seed
}

/// Primality test for u64 using trial division (sufficient for cache/dataset
/// item counts, which are < 2^64 and whose square roots are small).
fn is_prime_u64(n: u64) -> bool {
    if n < 2 {
        return false;
    }
    if n.is_multiple_of(2) {
        return n == 2;
    }
    if n.is_multiple_of(3) {
        return n == 3;
    }
    let mut i = 5u64;
    while i * i <= n {
        if n % i == 0 || n % (i + 2) == 0 {
            return false;
        }
        i += 6;
    }
    true
}
