//! Node Discovery — ZION P2P Network
//!
//! Implements automatic node discovery through:
//! 1. **Peer Exchange** — periodically ask connected peers for their peer lists (GetPeers/Peers)
//! 2. **DNS Re-resolve** — periodically re-check DNS seed records for new IPs
//! 3. **Persist & Restore** — discovered nodes saved to disk, loaded on next start
//!
//! Translated from Python `TREE_NODES/discovery/node_discovery.py` into Rust.

use crate::p2p::messages::Message;
use crate::p2p::peers::PeerManager;
use crate::p2p::seeds::{resolve_dns_seeds, SEED_NODES};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;

/// How often to ask all connected peers for their peer lists (peer exchange).
const PEER_EXCHANGE_INTERVAL_SECS: u64 = 300; // 5 min

/// How often to re-resolve DNS seeds and attempt new outbound connections.
const DNS_REFRESH_INTERVAL_SECS: u64 = 1800; // 30 min

/// Maximum unique discovered peers to keep in the "known" pool.
const MAX_KNOWN_PEERS: usize = 1_000;

/// Start the peer-exchange loop.
///
/// Every `PEER_EXCHANGE_INTERVAL_SECS` seconds, a `GetPeers` message is broadcast
/// to all currently-connected peers. When peers respond with `Peers { peers }`,
/// `handle_peers_response` is called to merge new addresses into `PeerManager`.
pub fn start_peer_exchange(peers: Arc<PeerManager>) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(PEER_EXCHANGE_INTERVAL_SECS));
        ticker.tick().await; // skip immediate first tick

        loop {
            ticker.tick().await;

            let active = peers.active_count();
            if active == 0 {
                continue;
            }

            println!(
                "[Discovery] Peer-exchange: asking {} connected peers for their peer lists",
                active
            );
            peers.broadcast_message(Message::GetPeers);
        }
    });
}

/// Start the DNS re-resolve loop.
///
/// Periodically re-resolves DNS seed hostnames and tries new TCP connections
/// so the node keeps discovering fresh peers as the network grows.
pub fn start_dns_refresh(peers: Arc<PeerManager>) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(DNS_REFRESH_INTERVAL_SECS));
        ticker.tick().await; // skip first tick (seeds already resolved on startup)

        loop {
            ticker.tick().await;

            println!("[Discovery] Refreshing DNS seeds...");
            for seed in SEED_NODES {
                // Only non-IP seeds need DNS lookup
                if seed.contains('.') && seed.split(':').next().map_or(true, |h| !h.parse::<std::net::IpAddr>().is_ok()) {
                    let domain = match seed.rsplit_once(':') {
                        Some((host, _port)) => host.to_string(),
                        None => seed.to_string(),
                    };
                    if let Ok(addrs) = resolve_dns_seeds(&domain).await {
                        for addr in addrs {
                            let addr_str = addr.to_string();
                            if peers.known_peer_count() < MAX_KNOWN_PEERS {
                                peers.add_discovered(&addr_str);
                            }
                        }
                    }
                }
            }
        }
    });
}

/// Handle an incoming `Peers` response from a connected peer.
///
/// Called from the main message loop in `mod.rs` when we receive
/// `Message::Peers { peers }`. Merges new addresses into PeerManager
/// without connecting immediately — the outbound connector will pick
/// them up on the next cycle.
pub fn handle_peers_response(
    pm: &Arc<PeerManager>,
    new_peers: Vec<String>,
    already_known: &mut HashSet<String>,
) {
    let mut added = 0usize;
    for addr_str in new_peers {
        if already_known.contains(&addr_str) {
            continue;
        }
        if pm.known_peer_count() >= MAX_KNOWN_PEERS {
            break;
        }
        already_known.insert(addr_str.clone());
        pm.add_discovered(&addr_str);
        added += 1;
    }
    if added > 0 {
        println!("[Discovery] Added {} new peers from peer-exchange", added);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handle_peers_response_dedup() {
        // Basic dedup test — same peer shouldn't be added twice
        let pm = Arc::new(PeerManager::new());
        let mut seen: HashSet<String> = HashSet::new();

        // First batch
        handle_peers_response(
            &pm,
            vec!["1.2.3.4:8334".to_string(), "5.6.7.8:8334".to_string()],
            &mut seen,
        );
        assert_eq!(seen.len(), 2);

        // Same batch again — should not increase `seen`
        handle_peers_response(
            &pm,
            vec!["1.2.3.4:8334".to_string(), "5.6.7.8:8334".to_string()],
            &mut seen,
        );
        assert_eq!(seen.len(), 2, "Duplicates must be ignored");
    }

    #[test]
    fn test_handle_peers_response_new_peers() {
        let pm = Arc::new(PeerManager::new());
        let mut seen: HashSet<String> = HashSet::new();

        handle_peers_response(
            &pm,
            vec!["10.0.0.1:8334".into(), "10.0.0.2:8334".into()],
            &mut seen,
        );
        assert_eq!(seen.len(), 2);

        // Third new peer
        handle_peers_response(&pm, vec!["10.0.0.3:8334".into()], &mut seen);
        assert_eq!(seen.len(), 3);
    }

    #[test]
    fn test_interval_constants_sane() {
        assert!(PEER_EXCHANGE_INTERVAL_SECS >= 60, "Exchange too frequent");
        assert!(DNS_REFRESH_INTERVAL_SECS > PEER_EXCHANGE_INTERVAL_SECS);
        assert!(MAX_KNOWN_PEERS >= 100);
    }
}
