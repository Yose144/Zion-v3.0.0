//! Shared peer manager for canonical and V3 P2P.
//!
//! Tracks known peers, active inbound connections, and ban scores. The goal is
//! to prevent connection exhaustion and to give peers a lightweight discovery
//! mechanism (GetPeers / Peers).

use std::collections::{HashMap, HashSet};
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tracing::warn;

/// Where a peer address came from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PeerSource {
    Seed,
    Inbound,
    Outbound,
    PeerExchange,
}

/// Metadata for a known peer.
#[derive(Clone, Debug)]
pub struct PeerInfo {
    pub source: PeerSource,
    pub last_seen: Instant,
    pub good: u32,
    pub bad: u32,
}

/// Ban record for an IP address.
#[derive(Clone, Debug)]
pub struct BanInfo {
    pub until: Instant,
    pub score: u32,
}

/// Connection guard. Removes the peer from the active set when dropped.
pub struct PeerGuard {
    manager: Arc<PeerManager>,
    addr: SocketAddr,
}

impl Drop for PeerGuard {
    fn drop(&mut self) {
        let mut active = self.manager.active.lock().unwrap_or_else(|e| e.into_inner());
        active.remove(&self.addr);
    }
}

/// Production P2P peer manager.
#[derive(Clone)]
pub struct PeerManager {
    local_addr: Arc<Mutex<Option<SocketAddr>>>,
    max_inbound: usize,
    ban_threshold: u32,
    ban_duration: Duration,
    peers: Arc<Mutex<HashMap<SocketAddr, PeerInfo>>>,
    banned: Arc<Mutex<HashMap<IpAddr, BanInfo>>>,
    active: Arc<Mutex<HashSet<SocketAddr>>>,
}

impl PeerManager {
    /// Create a new peer manager with sensible defaults.
    pub fn new(max_inbound: usize, ban_threshold: u32, ban_duration: Duration) -> Self {
        Self {
            local_addr: Arc::new(Mutex::new(None)),
            max_inbound,
            ban_threshold,
            ban_duration,
            peers: Arc::new(Mutex::new(HashMap::new())),
            banned: Arc::new(Mutex::new(HashMap::new())),
            active: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    /// Default production settings: 50 inbound, ban threshold 10,
    /// ban duration 1 hour.
    pub fn default_manager() -> Self {
        Self::new(50, 10, Duration::from_secs(3600))
    }

    /// Set our own public P2P address so we do not advertise it to others.
    pub async fn set_local_addr(&self, addr: SocketAddr) {
        *self.local_addr.lock().unwrap_or_else(|e| e.into_inner()) = Some(addr);
    }

    /// Return true if the IP is currently banned (loopback is never banned).
    pub async fn is_banned(&self, addr: SocketAddr) -> bool {
        let ip = addr.ip();
        if ip.is_loopback() {
            return false;
        }
        let mut banned = self.banned.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(ban) = banned.get(&ip) {
            if Instant::now() < ban.until {
                return true;
            }
            banned.remove(&ip);
        }
        false
    }

    /// Check whether an inbound connection should be accepted.
    pub async fn can_accept(&self, addr: SocketAddr) -> bool {
        if self.is_banned(addr).await {
            return false;
        }
        let active = self.active.lock().unwrap_or_else(|e| e.into_inner());
        if active.len() >= self.max_inbound {
            return false;
        }
        true
    }

    /// Acquire an active inbound slot. Returns a guard that removes the peer
    /// from the active set when dropped, or None if the peer is banned or the
    /// inbound limit is exhausted.
    pub async fn acquire(&self, addr: SocketAddr) -> Option<PeerGuard> {
        if self.is_banned(addr).await {
            warn!(%addr, "rejecting banned peer");
            return None;
        }
        let mut active = self.active.lock().unwrap_or_else(|e| e.into_inner());
        if active.len() >= self.max_inbound {
            warn!(%addr, "rejecting inbound: max peers reached");
            return None;
        }
        if active.insert(addr) {
            Some(PeerGuard {
                manager: Arc::new(self.clone()),
                addr,
            })
        } else {
            None
        }
    }

    /// Record a successful interaction with a peer.
    pub async fn record_good(&self, addr: SocketAddr) {
        let mut peers = self.peers.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(info) = peers.get_mut(&addr) {
            info.good += 1;
            info.last_seen = Instant::now();
        }
    }

    /// Record a bad interaction. If the peer exceeds the ban threshold, it is
    /// banned for the configured duration. Loopback is never banned.
    pub async fn record_bad(&self, addr: SocketAddr, score: u32) {
        let ip = addr.ip();
        if ip.is_loopback() {
            return;
        }
        let mut peers = self.peers.lock().unwrap_or_else(|e| e.into_inner());
        let mut banned = self.banned.lock().unwrap_or_else(|e| e.into_inner());

        if let Some(info) = peers.get_mut(&addr) {
            info.bad += score;
            if info.bad >= self.ban_threshold {
                let until = Instant::now() + self.ban_duration;
                warn!(%addr, %ip, until = ?self.ban_duration, "banning peer");
                banned.insert(ip, BanInfo { until, score: info.bad });
                peers.remove(&addr);
            }
        } else {
            // Peer not in known set but misbehaving; ban the IP quickly.
            banned.insert(
                ip,
                BanInfo {
                    until: Instant::now() + self.ban_duration,
                    score,
                },
            );
        }
    }

    /// Add a peer to the known set if it is not banned.
    pub async fn add_known(&self, addr: SocketAddr, source: PeerSource) {
        if self.is_banned(addr).await {
            return;
        }
        let mut peers = self.peers.lock().unwrap_or_else(|e| e.into_inner());
        peers.entry(addr).or_insert(PeerInfo {
            source,
            last_seen: Instant::now(),
            good: 0,
            bad: 0,
        });
    }

    /// Return up to `n` known peers, excluding our own address and banned ones.
    pub async fn random_peers(&self, n: usize) -> Vec<SocketAddr> {
        // Prune stale known peers so we do not advertise dead endpoints.
        self.prune_stale_peers(Duration::from_secs(300)).await;
        let local = *self.local_addr.lock().unwrap_or_else(|e| e.into_inner());
        let banned = self.banned.lock().unwrap_or_else(|e| e.into_inner()).clone();
        let peers = self.peers.lock().unwrap_or_else(|e| e.into_inner());
        peers
            .iter()
            .filter(|(addr, _)| Some(**addr) != local)
            .filter(|(addr, _)| !banned.contains_key(&addr.ip()))
            .map(|(addr, _)| *addr)
            .take(n)
            .collect()
    }

    /// V3 helper: return known peers as `PeerEndpoint` records.
    pub async fn random_endpoints(&self, n: usize) -> Vec<crate::v3_p2p::PeerEndpoint> {
        self.random_peers(n)
            .await
            .into_iter()
            .map(|addr| crate::v3_p2p::PeerEndpoint::new(addr.ip().to_string(), addr.port()))
            .collect()
    }

    /// Number of currently active inbound peers.
    pub async fn active_count(&self) -> usize {
        self.active.lock().unwrap_or_else(|e| e.into_inner()).len()
    }

    /// Number of known peers.
    pub async fn known_count(&self) -> usize {
        self.peers.lock().unwrap_or_else(|e| e.into_inner()).len()
    }

    /// Remove known peers whose last_seen is older than `max_age`, unless they
    /// are currently active inbound peers.  Keeps the known set from growing
    /// forever with ephemeral health-check connections.
    pub async fn prune_stale_peers(&self, max_age: Duration) {
        let now = Instant::now();
        let active = self.active.lock().unwrap_or_else(|e| e.into_inner()).clone();
        let mut peers = self.peers.lock().unwrap_or_else(|e| e.into_inner());
        peers.retain(|addr, info| {
            active.contains(addr) || now.duration_since(info.last_seen) <= max_age
        });
    }

    /// Return all currently active peer addresses.
    pub async fn active_peers(&self) -> Vec<SocketAddr> {
        self.active
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .cloned()
            .collect()
    }

    /// Return all known peer addresses, excluding our own and banned ones.
    pub async fn known_peers_list(&self) -> Vec<SocketAddr> {
        self.known_peers_with_metadata().await.into_keys().collect()
    }

    /// Return all known peer addresses with their metadata.
    pub async fn known_peers_with_metadata(&self) -> HashMap<SocketAddr, PeerInfo> {
        let local = *self.local_addr.lock().unwrap_or_else(|e| e.into_inner());
        let banned = self.banned.lock().unwrap_or_else(|e| e.into_inner()).clone();
        self.peers
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .filter(|(addr, _)| Some(**addr) != local)
            .filter(|(addr, _)| !banned.contains_key(&addr.ip()))
            .map(|(addr, info)| (*addr, info.clone()))
            .collect()
    }

    /// Return known peers seen within `window`, excluding our own and banned ones.
    pub async fn recent_peers(&self, window: Duration) -> Vec<SocketAddr> {
        let now = Instant::now();
        let local = *self.local_addr.lock().unwrap_or_else(|e| e.into_inner());
        let banned = self.banned.lock().unwrap_or_else(|e| e.into_inner()).clone();
        self.peers
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .filter(|(_, info)| now.duration_since(info.last_seen) <= window)
            .filter(|(addr, _)| Some(**addr) != local)
            .filter(|(addr, _)| !banned.contains_key(&addr.ip()))
            .map(|(addr, _)| *addr)
            .collect()
    }

    /// Return known peers that have had a successful interaction (good > 0) and
    /// were seen within `window`.  This excludes seeds that only ever failed.
    pub async fn recent_good_peers(&self, window: Duration) -> Vec<SocketAddr> {
        let now = Instant::now();
        let local = *self.local_addr.lock().unwrap_or_else(|e| e.into_inner());
        let banned = self.banned.lock().unwrap_or_else(|e| e.into_inner()).clone();
        self.peers
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .filter(|(_, info)| info.good > 0 && now.duration_since(info.last_seen) <= window)
            .filter(|(addr, _)| Some(**addr) != local)
            .filter(|(addr, _)| !banned.contains_key(&addr.ip()))
            .map(|(addr, _)| *addr)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn peer_manager_bans_bad_actor() {
        let pm = PeerManager::new(2, 3, Duration::from_secs(60));
        let addr: SocketAddr = "192.0.2.1:1111".parse().unwrap();

        pm.add_known(addr, PeerSource::Inbound).await;
        pm.record_bad(addr, 2).await;
        assert!(!pm.is_banned(addr).await);
        pm.record_bad(addr, 1).await;
        assert!(pm.is_banned(addr).await);
        assert!(!pm.can_accept(addr).await);
    }

    #[tokio::test]
    async fn peer_manager_never_bans_loopback() {
        let pm = PeerManager::new(2, 3, Duration::from_secs(60));
        let addr: SocketAddr = "127.0.0.1:1111".parse().unwrap();

        pm.add_known(addr, PeerSource::Inbound).await;
        pm.record_bad(addr, 100).await;
        assert!(!pm.is_banned(addr).await);
        assert!(pm.can_accept(addr).await);
    }

    #[tokio::test]
    async fn peer_manager_enforces_inbound_limit() {
        let pm = PeerManager::new(1, 10, Duration::from_secs(60));
        let a1: SocketAddr = "127.0.0.1:1111".parse().unwrap();
        let a2: SocketAddr = "127.0.0.1:1112".parse().unwrap();

        let g1 = pm.acquire(a1).await;
        assert!(g1.is_some());
        assert!(pm.acquire(a2).await.is_none());
        drop(g1);
        assert!(pm.acquire(a2).await.is_some());
    }
}
