//! # Data sources for care task executors
//!
//! Abstraction over data inputs for care task executors. In Fáze 1, all
//! executors used deterministic mock generators. In Fáze 2, we add the
//! ability to fetch real data from live L1 RPC and L3 WARP API endpoints.
//!
//! ## Design
//!
//! - [`DataSource`] trait — common interface for all data sources.
//! - [`MockDataSource`] — wraps the existing mock generators (default, no network).
//! - [`L1RpcSource`] — fetches from live L1 RPC (feature-gated: `live-data`).
//! - [`WarpApiSource`] — fetches from live L3 WARP API (feature-gated: `live-data`).
//!
//! When `live-data` is not enabled, only `MockDataSource` is available.
//! When `live-data` is enabled, executors can be configured with a live source
//! that replaces the mock generator. If the live source fails (timeout, network
//! error), it falls back to the mock generator automatically.

#[cfg(feature = "live-data")]
pub mod live;

#[cfg(feature = "live-data")]
pub use live::{L1RpcSource, WarpApiSource};

use poc_core::Hash;
use thiserror::Error;

/// Errors that can occur during data source operations.
#[derive(Debug, Error)]
pub enum DataSourceError {
    #[error("network error: {0}")]
    Network(String),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("timeout after {0}ms")]
    Timeout(u64),
    #[error("data source unavailable: {0}")]
    Unavailable(String),
}

/// A snapshot of data fetched from a data source.
#[derive(Debug, Clone)]
pub struct DataSourceSnapshot {
    /// Raw bytes of the fetched data (JSON, binary, etc.)
    pub raw: Vec<u8>,
    /// BLAKE3 hash of raw data — used as `input_hash` for executors.
    pub hash: Hash,
    /// Unix timestamp when the snapshot was taken.
    pub timestamp: u64,
}

impl DataSourceSnapshot {
    /// Creates a snapshot from raw bytes, computing the BLAKE3 hash.
    pub fn from_raw(raw: Vec<u8>, timestamp: u64) -> Self {
        let hash = *blake3::hash(&raw).as_bytes();
        Self { raw, hash, timestamp }
    }
}

/// Trait for data sources that provide input data for care task executors.
pub trait DataSource: Send + Sync {
    /// Fetches a data snapshot for the given epoch.
    fn fetch(&self, epoch: u64) -> Result<DataSourceSnapshot, DataSourceError>;

    /// Human-readable name of the data source (for logging).
    fn name(&self) -> &str;
}

/// Mock data source — generates deterministic data from epoch seed.
///
/// This wraps the existing mock generator pattern: BLAKE3(epoch) → raw bytes.
/// Used as the default (no network) and as a fallback when live sources fail.
#[derive(Debug, Clone, Default)]
pub struct MockDataSource {
    /// Label for the mock source (e.g. "mock-bridge", "mock-mempool").
    pub label: &'static str,
}

impl MockDataSource {
    pub fn new(label: &'static str) -> Self {
        Self { label }
    }
}

impl DataSource for MockDataSource {
    fn fetch(&self, epoch: u64) -> Result<DataSourceSnapshot, DataSourceError> {
        // Deterministic mock data: BLAKE3(label || epoch)
        let mut hasher = blake3::Hasher::new();
        hasher.update(self.label.as_bytes());
        hasher.update(&epoch.to_le_bytes());
        let digest = *hasher.finalize().as_bytes();

        // Raw = 64 bytes (two BLAKE3 hashes with different seeds)
        let mut raw = Vec::with_capacity(64);
        raw.extend_from_slice(&digest);
        let mut h2 = blake3::Hasher::new();
        h2.update(&digest);
        h2.update(b"suffix");
        raw.extend_from_slice(h2.finalize().as_bytes());

        let timestamp = 1700000000 + epoch * 10;
        Ok(DataSourceSnapshot::from_raw(raw, timestamp))
    }

    fn name(&self) -> &str {
        self.label
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_data_source_is_deterministic() {
        let src = MockDataSource::new("test");
        let s1 = src.fetch(42).unwrap();
        let s2 = src.fetch(42).unwrap();
        assert_eq!(s1.hash, s2.hash, "same epoch → same hash");
        assert_eq!(s1.raw, s2.raw, "same epoch → same raw data");
    }

    #[test]
    fn mock_data_source_differs_per_epoch() {
        let src = MockDataSource::new("test");
        let s1 = src.fetch(1).unwrap();
        let s2 = src.fetch(2).unwrap();
        assert_ne!(s1.hash, s2.hash, "different epoch → different hash");
    }

    #[test]
    fn mock_data_source_differs_per_label() {
        let s1 = MockDataSource::new("bridge").fetch(1).unwrap();
        let s2 = MockDataSource::new("mempool").fetch(1).unwrap();
        assert_ne!(s1.hash, s2.hash, "different label → different hash");
    }

    #[test]
    fn snapshot_from_raw_computes_hash() {
        let raw = vec![1, 2, 3, 4, 5];
        let snap = DataSourceSnapshot::from_raw(raw.clone(), 1000);
        assert_eq!(snap.raw, raw);
        assert_eq!(snap.hash, *blake3::hash(&raw).as_bytes());
        assert_eq!(snap.timestamp, 1000);
    }

    #[test]
    fn mock_data_source_name() {
        let src = MockDataSource::new("my-mock");
        assert_eq!(src.name(), "my-mock");
    }
}
