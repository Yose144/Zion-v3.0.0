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
        let mut active = self
            .manager
            .active
            .lock()
            .unwrap_or_else(|e| e.into_inner());
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
    /// Operator-configured peers (`--peer`). They are never banned: a seed that
    /// stops answering is an operational problem, not an attack. Banning a seed
    /// deadlocks the cluster — both sides ban each other's IP and `can_accept`
    /// then rejects every inbound connection, with no unban path but a restart.
    seed_ips: Arc<Mutex<HashSet<IpAddr>>>,
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
            seed_ips: Arc::new(Mutex::new(HashSet::new())),
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

    /// Return true if the IP is currently banned (loopback and seed IPs are
    /// never banned).
    pub async fn is_banned(&self, addr: SocketAddr) -> bool {
        let ip = addr.ip();
        if ip.is_loopback() || self.is_seed_ip(ip) {
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

    /// Register an operator-configured seed IP. Idempotent.
    pub async fn add_seed_ip(&self, addr: SocketAddr) {
        self.seed_ips
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(addr.ip());
    }

    fn is_seed_ip(&self, ip: IpAddr) -> bool {
        self.seed_ips
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains(&ip)
    }

    /// Lift the ban for `ip`. Returns true when a ban was actually removed.
    pub async fn unban(&self, ip: IpAddr) -> bool {
        self.banned
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&ip)
            .is_some()
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
    ///
    /// Success also clears the accumulated bad score and lifts an active ban:
    /// a peer that just answered is demonstrably reachable, so keeping it
    /// banned would only keep the two nodes from ever reconnecting.
    pub async fn record_good(&self, addr: SocketAddr) {
        {
            let mut peers = self.peers.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(info) = peers.get_mut(&addr) {
                info.good += 1;
                info.bad = 0;
                info.last_seen = Instant::now();
            }
        }
        let ip = addr.ip();
        if !ip.is_loopback() {
            self.banned
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .remove(&ip);
        }
    }

    /// Record a bad interaction. If the peer reaches the ban threshold, its IP
    /// is banned for the configured duration. Loopback and seed IPs are never
    /// banned.
    ///
    /// The score accumulates even for addresses that are not (yet) in the known
    /// set. Banning an unknown address on a single failure used to be enough to
    /// take a whole cluster down: the seed sync loop records one failure every
    /// 30 s, and because a banned peer is never re-added, each attempt landed in
    /// this branch and re-banned the operator's own peer for another hour.
    pub async fn record_bad(&self, addr: SocketAddr, score: u32) {
        let ip = addr.ip();
        if ip.is_loopback() || self.is_seed_ip(ip) {
            return;
        }
        let mut peers = self.peers.lock().unwrap_or_else(|e| e.into_inner());
        let mut banned = self.banned.lock().unwrap_or_else(|e| e.into_inner());

        let ban_now = {
            let info = peers.entry(addr).or_insert(PeerInfo {
                source: PeerSource::Inbound,
                last_seen: Instant::now(),
                good: 0,
                bad: 0,
            });
            info.bad = info.bad.saturating_add(score);
            info.last_seen = Instant::now();
            info.bad >= self.ban_threshold
        };

        if ban_now {
            let bad = peers.get(&addr).map(|info| info.bad).unwrap_or(score);
            warn!(%addr, %ip, until = ?self.ban_duration, "banning peer");
            banned.insert(
                ip,
                BanInfo {
                    until: Instant::now() + self.ban_duration,
                    score: bad,
                },
            );
            peers.remove(&addr);
        }
    }

    /// Add a peer to the known set if it is not banned.
    pub async fn add_known(&self, addr: SocketAddr, source: PeerSource) {
        // Register seeds before the ban check: a seed must stay a seed even if
        // a stale ban for its IP is still in the map.
        if source == PeerSource::Seed {
            self.add_seed_ip(addr).await;
        }
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
        let banned = self
            .banned
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
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
        let active = self
            .active
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
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
        let banned = self
            .banned
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
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
        let banned = self
            .banned
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
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
        let banned = self
            .banned
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
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

    /// Regression: a seed peer used to be banned after 10 failed sync attempts,
    /// and because the ban is per-IP and `can_accept` honours it, both ends of a
    /// two-node cluster could ban each other permanently. Seeds are operator
    /// configuration, not attackers.
    #[tokio::test]
    async fn seed_peer_is_never_banned_and_never_rejected() {
        let pm = PeerManager::new(4, 3, Duration::from_secs(60));
        let seed: SocketAddr = "198.51.100.7:8336".parse().unwrap();

        pm.add_known(seed, PeerSource::Seed).await;
        for _ in 0..50 {
            pm.record_bad(seed, 5).await;
        }

        assert!(!pm.is_banned(seed).await);
        assert!(pm.can_accept(seed).await);
        assert!(pm.acquire(seed).await.is_some());
    }

    /// Regression: `record_bad` on an address outside the known set used to ban
    /// the IP on the very first failure, with no threshold and no log — which is
    /// how the seed loop re-banned an already-banned peer every 30 s.
    #[tokio::test]
    async fn unknown_peer_bans_only_after_threshold() {
        let pm = PeerManager::new(4, 3, Duration::from_secs(60));
        let addr: SocketAddr = "192.0.2.44:1111".parse().unwrap();

        pm.record_bad(addr, 1).await;
        assert!(!pm.is_banned(addr).await, "one strike must not ban");

        pm.record_bad(addr, 1).await;
        pm.record_bad(addr, 1).await;
        assert!(pm.is_banned(addr).await, "threshold reached");
    }

    #[tokio::test]
    async fn record_good_resets_score_and_lifts_ban() {
        let pm = PeerManager::new(4, 3, Duration::from_secs(3600));
        let addr: SocketAddr = "192.0.2.55:1111".parse().unwrap();

        pm.add_known(addr, PeerSource::Inbound).await;
        pm.record_bad(addr, 3).await;
        assert!(pm.is_banned(addr).await);

        pm.record_good(addr).await;
        assert!(
            !pm.is_banned(addr).await,
            "a peer that answers is not banned"
        );
        assert!(pm.can_accept(addr).await);
    }

    #[tokio::test]
    async fn unban_lifts_ban_and_reports_whether_it_did() {
        let pm = PeerManager::new(4, 3, Duration::from_secs(3600));
        let addr: SocketAddr = "192.0.2.66:1111".parse().unwrap();

        pm.add_known(addr, PeerSource::Inbound).await;
        pm.record_bad(addr, 3).await;
        assert!(pm.unban(addr.ip()).await, "existing ban removed");
        assert!(!pm.is_banned(addr).await);
        assert!(!pm.unban(addr.ip()).await, "second call is a no-op");
    }

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
