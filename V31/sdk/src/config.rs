/// SDK configuration.
#[derive(Clone, Debug)]
pub struct SdkConfig {
    /// Node RPC URL (e.g. `http://127.0.0.1:9443`).
    pub node_rpc_url: String,
    /// Request timeout in seconds.
    pub timeout_secs: u64,
}

impl Default for SdkConfig {
    fn default() -> Self {
        Self {
            node_rpc_url: "http://127.0.0.1:9443".to_string(),
            timeout_secs: 15,
        }
    }
}

impl SdkConfig {
    pub fn new(node_rpc_url: impl Into<String>) -> Self {
        Self {
            node_rpc_url: node_rpc_url.into(),
            ..Default::default()
        }
    }

    pub fn with_timeout(mut self, secs: u64) -> Self {
        self.timeout_secs = secs;
        self
    }
}
