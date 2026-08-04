//! Share relay — fire-and-forget forwarding of shares from Edge pool to Core pool.
//!
//! Ported from V3/L1/pool/src/bin/server.rs `relay_share_fire_and_forget` (lines 916-928).
//! Used in Edge pool mode to forward shares to a Core pool for unified PPLNS accounting.

use std::time::Duration;

use anyhow::Result;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use crate::v3_protocol::{encode_message, PoolMessage};

/// Fire-and-forget relay of a ShareRelay message to an upstream pool.
///
/// Connects with a 3-second write timeout, sends the message, and closes.
/// Does NOT read the response — this is intentional to minimize latency.
pub async fn relay_share_fire_and_forget(upstream_addr: &str, relay: &PoolMessage) -> Result<()> {
    let mut stream = TcpStream::connect(upstream_addr).await?;

    let line = encode_message(relay)?;
    // Write with timeout
    let write_fut = stream.write_all(line.as_bytes());
    tokio::time::timeout(Duration::from_secs(3), write_fut)
        .await
        .map_err(|_| anyhow::anyhow!("relay write timeout"))??;
    stream.flush().await?;

    tracing::debug!(
        "share_relayed upstream={} msg_type={}",
        upstream_addr,
        message_type(relay)
    );
    Ok(())
}

/// Synchronous version for use in non-async contexts.
pub fn relay_share_blocking(upstream_addr: &str, relay: &PoolMessage) -> Result<()> {
    use std::io::{Read, Write};
    use std::net::TcpStream as StdTcpStream;

    let mut stream = StdTcpStream::connect_timeout(
        &upstream_addr
            .parse()
            .map_err(|e| anyhow::anyhow!("invalid upstream addr: {}", e))?,
        Duration::from_secs(3),
    )?;
    stream.set_write_timeout(Some(Duration::from_secs(3)))?;

    let line = encode_message(relay)?;
    stream.write_all(line.as_bytes())?;
    stream.flush()?;

    // Drain any response (fire-and-forget, but don't leave RST)
    let _ = stream.read(&mut [0u8; 64]);
    Ok(())
}

fn message_type(msg: &PoolMessage) -> &'static str {
    match msg {
        PoolMessage::ShareRelay { .. } => "share_relay",
        PoolMessage::Submit { .. } => "submit",
        PoolMessage::ExternalSubmit { .. } => "external_submit",
        _ => "other",
    }
}

/// Configuration for the share relay.
#[derive(Clone, Debug)]
pub struct ShareRelayConfig {
    /// Upstream pool address (e.g., "127.0.0.1:8444").
    pub upstream_pool_addr: Option<String>,
}

impl ShareRelayConfig {
    pub fn from_env() -> Self {
        let upstream = std::env::var("ZION_UPSTREAM_POOL_ADDR")
            .ok()
            .filter(|s| !s.is_empty());
        Self {
            upstream_pool_addr: upstream,
        }
    }

    pub fn enabled(&self) -> bool {
        self.upstream_pool_addr.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relay_config_from_env_default() {
        std::env::remove_var("ZION_UPSTREAM_POOL_ADDR");
        let cfg = ShareRelayConfig::from_env();
        assert!(!cfg.enabled());
    }

    #[test]
    fn relay_config_from_env_set() {
        std::env::set_var("ZION_UPSTREAM_POOL_ADDR", "127.0.0.1:8444");
        let cfg = ShareRelayConfig::from_env();
        assert!(cfg.enabled());
        assert_eq!(
            cfg.upstream_pool_addr.as_deref(),
            Some("127.0.0.1:8444")
        );
        std::env::remove_var("ZION_UPSTREAM_POOL_ADDR");
    }

    #[test]
    fn message_type_identifies_relay() {
        let msg = PoolMessage::ShareRelay {
            miner_id: "alice".into(),
            worker_name: "rig1".into(),
            height: 100,
            difficulty: 5000,
            relay_origin: "127.0.0.1:8445".into(),
        };
        assert_eq!(message_type(&msg), "share_relay");
    }
}
