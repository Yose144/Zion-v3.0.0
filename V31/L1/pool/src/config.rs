use zion_l1_types::{Address, ChainId};

#[derive(Clone, Debug)]
pub struct PoolConfig {
    pub port: u16,
    pub pool_fee_bps: u16,
    pub pplns_window_shares: usize,
    pub pplns_window_blocks: u64,
    pub zion_target: [u8; 32],
    pub auxpow_target: [u8; 32],
    pub pool_address: Address,
    pub worker: String,
    pub password: String,
    /// Optional Zion L1 RPC URL where solved blocks are submitted.
    pub l1_rpc_url: Option<String>,
    /// Optional path for PPLNS state persistence.
    pub state_path: Option<String>,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            port: 8444,
            pool_fee_bps: 100,
            pplns_window_shares: 10000,
            pplns_window_blocks: 100,
            zion_target: [0xFF; 32],
            auxpow_target: [0xFF; 32],
            pool_address: Address::new(ChainId::ZionL1, vec![0u8; 20], "zion1pool").unwrap(),
            worker: String::new(),
            password: String::new(),
            l1_rpc_url: None,
            state_path: None,
        }
    }
}
