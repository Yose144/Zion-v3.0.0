//! # Live data sources (L1 RPC + L3 WARP API)
//!
//! Feature-gated behind `live-data`. When enabled, these sources fetch real
//! data from the ZION network endpoints. On failure (timeout, network error),
//! they fall back to [`super::MockDataSource`].
//!
//! ## Endpoints
//!
//! - **L1 RPC**: `http://rpc.zionterranova.com:8443` — public RPC proxy
//! - **L3 WARP**: `http://127.0.0.1:8453` — local WARP API
//!
//! Both use `ureq` (synchronous HTTP client, already in workspace deps).

use super::{DataSource, DataSourceError, DataSourceSnapshot, MockDataSource};

/// L1 RPC data source — fetches block height and mempool stats.
///
/// Queries the public L1 RPC endpoint for:
/// - Current block height
/// - Mempool transaction count
/// - Recent block hash
///
/// On failure, falls back to `MockDataSource`.
#[derive(Clone)]
pub struct L1RpcSource {
    /// RPC endpoint URL (e.g. `http://rpc.zionterranova.com:8443`).
    url: String,
    /// Timeout in milliseconds.
    timeout_ms: u64,
    /// Fallback mock source.
    fallback: MockDataSource,
}

impl L1RpcSource {
    /// Creates a new L1 RPC source with the default public endpoint.
    pub fn new() -> Self {
        Self {
            url: "http://rpc.zionterranova.com:8443".into(),
            timeout_ms: 5_000,
            fallback: MockDataSource::new("mock-l1-rpc"),
        }
    }

    /// Creates a source with a custom URL (for testing or local nodes).
    pub fn with_url(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            timeout_ms: 5_000,
            fallback: MockDataSource::new("mock-l1-rpc"),
        }
    }

    /// Sets a custom timeout.
    pub fn with_timeout(mut self, ms: u64) -> Self {
        self.timeout_ms = ms;
        self
    }

    /// Returns the configured URL.
    pub fn url(&self) -> &str {
        &self.url
    }

    /// Attempts to fetch data from the L1 RPC. On any error, falls back to mock.
    fn fetch_live(&self, epoch: u64) -> Result<DataSourceSnapshot, DataSourceError> {
        // Build a JSON-RPC request for block height
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "getblockcount",
            "params": [],
            "id": epoch
        });

        let agent = ureq::AgentBuilder::new()
            .timeout(std::time::Duration::from_millis(self.timeout_ms))
            .build();

        let response = agent
            .post(&self.url)
            .send_json(body)
            .map_err(|e| {
                let msg = format!("{e}");
                if msg.contains("timeout") || msg.contains("timed out") {
                    DataSourceError::Timeout(self.timeout_ms)
                } else {
                    DataSourceError::Network(msg)
                }
            })?;

        let raw = response
            .into_string()
            .map_err(|e| DataSourceError::Parse(format!("response read: {e}")))?
            .into_bytes();

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Ok(DataSourceSnapshot::from_raw(raw, timestamp))
    }
}

impl Default for L1RpcSource {
    fn default() -> Self {
        Self::new()
    }
}

impl DataSource for L1RpcSource {
    fn fetch(&self, epoch: u64) -> Result<DataSourceSnapshot, DataSourceError> {
        match self.fetch_live(epoch) {
            Ok(snap) => Ok(snap),
            Err(e) => {
                // Log and fall back to mock
                eprintln!("[L1RpcSource] live fetch failed ({}), falling back to mock", e);
                self.fallback.fetch(epoch)
            }
        }
    }

    fn name(&self) -> &str {
        "l1-rpc"
    }
}

/// L3 WARP API data source — fetches bridge status and pending locks.
///
/// Queries the local WARP API for:
/// - `/api/bridge/status` — locked_zion, minted_wzion, pending_locks, TVL
///
/// On failure, falls back to `MockDataSource`.
#[derive(Clone)]
pub struct WarpApiSource {
    /// WARP API endpoint URL (e.g. `http://127.0.0.1:8453`).
    url: String,
    /// Timeout in milliseconds.
    timeout_ms: u64,
    /// Fallback mock source.
    fallback: MockDataSource,
}

impl WarpApiSource {
    /// Creates a new WARP API source with the default local endpoint.
    pub fn new() -> Self {
        Self {
            url: "http://127.0.0.1:8453".into(),
            timeout_ms: 3_000,
            fallback: MockDataSource::new("mock-warp-api"),
        }
    }

    /// Creates a source with a custom URL.
    pub fn with_url(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            timeout_ms: 3_000,
            fallback: MockDataSource::new("mock-warp-api"),
        }
    }

    /// Sets a custom timeout.
    pub fn with_timeout(mut self, ms: u64) -> Self {
        self.timeout_ms = ms;
        self
    }

    /// Returns the configured URL.
    pub fn url(&self) -> &str {
        &self.url
    }

    /// Attempts to fetch bridge status from the WARP API.
    fn fetch_live(&self, epoch: u64) -> Result<DataSourceSnapshot, DataSourceError> {
        let agent = ureq::AgentBuilder::new()
            .timeout(std::time::Duration::from_millis(self.timeout_ms))
            .build();

        let endpoint = format!("{}/api/bridge/status", self.url);
        let response = agent
            .get(&endpoint)
            .call()
            .map_err(|e| {
                let msg = format!("{e}");
                if msg.contains("timeout") || msg.contains("timed out") {
                    DataSourceError::Timeout(self.timeout_ms)
                } else {
                    DataSourceError::Network(msg)
                }
            })?;

        let raw = response
            .into_string()
            .map_err(|e| DataSourceError::Parse(format!("response read: {e}")))?
            .into_bytes();

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Ok(DataSourceSnapshot::from_raw(raw, timestamp))
    }
}

impl Default for WarpApiSource {
    fn default() -> Self {
        Self::new()
    }
}

impl DataSource for WarpApiSource {
    fn fetch(&self, epoch: u64) -> Result<DataSourceSnapshot, DataSourceError> {
        match self.fetch_live(epoch) {
            Ok(snap) => Ok(snap),
            Err(e) => {
                eprintln!("[WarpApiSource] live fetch failed ({}), falling back to mock", e);
                self.fallback.fetch(epoch)
            }
        }
    }

    fn name(&self) -> &str {
        "warp-api"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn l1_rpc_source_default_url() {
        let src = L1RpcSource::new();
        assert_eq!(src.url(), "http://rpc.zionterranova.com:8443");
    }

    #[test]
    fn l1_rpc_source_custom_url() {
        let src = L1RpcSource::with_url("http://localhost:9443");
        assert_eq!(src.url(), "http://localhost:9443");
    }

    #[test]
    fn l1_rpc_source_falls_back_to_mock_on_failure() {
        // Use a port that's almost certainly not listening
        let src = L1RpcSource::with_url("http://127.0.0.1:1").with_timeout(100);
        let snap = src.fetch(1).expect("should fall back to mock, not error");
        // Mock data is 64 bytes
        assert_eq!(snap.raw.len(), 64, "fallback mock should produce 64 bytes");
    }

    #[test]
    fn warp_api_source_default_url() {
        let src = WarpApiSource::new();
        assert_eq!(src.url(), "http://127.0.0.1:8453");
    }

    #[test]
    fn warp_api_source_custom_url() {
        let src = WarpApiSource::with_url("http://localhost:9999");
        assert_eq!(src.url(), "http://localhost:9999");
    }

    #[test]
    fn warp_api_source_falls_back_to_mock_on_failure() {
        let src = WarpApiSource::with_url("http://127.0.0.1:1").with_timeout(100);
        let snap = src.fetch(1).expect("should fall back to mock, not error");
        assert_eq!(snap.raw.len(), 64, "fallback mock should produce 64 bytes");
    }

    #[test]
    fn l1_rpc_source_name() {
        let src = L1RpcSource::new();
        assert_eq!(src.name(), "l1-rpc");
    }

    #[test]
    fn warp_api_source_name() {
        let src = WarpApiSource::new();
        assert_eq!(src.name(), "warp-api");
    }

    #[test]
    fn l1_rpc_source_with_timeout() {
        let src = L1RpcSource::new().with_timeout(500);
        assert_eq!(src.timeout_ms, 500);
    }

    #[test]
    fn warp_api_source_with_timeout() {
        let src = WarpApiSource::new().with_timeout(500);
        assert_eq!(src.timeout_ms, 500);
    }
}
