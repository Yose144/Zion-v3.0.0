//! Minimal PoolMessage type for miner-side autonomous profit routing.
//!
//! This is a subset of `zion_pool::v3_protocol::PoolMessage` — only the
//! `CoinPreference` variant is needed by the autonomous miner. We define it
//! locally to avoid a cyclic dependency (pool → miner → pool).

use serde::{Deserialize, Serialize};

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
        let mut s = serde_json::to_string(self)?;
        s.insert_str(0, r#"{"type":"coin_preference","#);
        // Replace leading `{` — we already inserted the type tag.
        // Actually simpler: build the full tagged JSON.
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

/// A lightweight pool message that the autonomous miner cares about.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PoolMessage {
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

/// Decode a PoolMessage from a JSON line.
pub fn decode_message(line: &str) -> Result<PoolMessage, serde_json::Error> {
    serde_json::from_str(line.trim())
}
